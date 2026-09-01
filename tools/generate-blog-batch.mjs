#!/usr/bin/env node
/**
 * Drain the blog topic queue in one run.
 *
 * `generate-blog-post.mjs --next` writes exactly one post and exits non-zero if
 * that post fails validation, which is right for the daily cron: one post a
 * day, a failure is visible, tomorrow tries again. It is the wrong shape for
 * backfilling a queue - a single stubborn topic stops the batch, and one
 * `--next` per topic re-reads the whole corpus every time.
 *
 * This wraps it:
 *   - keeps going after a failure, and reports which topics failed and why,
 *   - stops immediately on an error that will not fix itself (no credit, bad
 *     key), because grinding through 60 topics against a dead API just burns
 *     wall-clock and prints the same message sixty times,
 *   - takes a limit so you can buy a few posts, read them, and continue.
 *
 *   node tools/generate-blog-batch.mjs            # drain the whole queue
 *   node tools/generate-blog-batch.mjs --limit 5  # write at most 5
 *   node tools/generate-blog-batch.mjs --dry-run  # print, write nothing
 *
 * Env is the same as generate-blog-post.mjs (ANTHROPIC_API_KEY, and
 * ANTHROPIC_WORKSPACE_ID when the key is identity-linked).
 */
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTopics, isTopicConsumed } from './lib/blog-topics.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const GENERATOR = join(HERE, 'generate-blog-post.mjs')

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const limitAt = argv.indexOf('--limit')
const LIMIT = limitAt === -1 ? Infinity : Number.parseInt(argv[limitAt + 1] ?? '0', 10)

/** Errors where retrying the next topic is pointless. */
const FATAL = [
  /credit balance is too low/i,
  /authentication_error/i,
  /API key is invalid/i,
  /anthropic-workspace-id/i,
  /permission_error/i,
]

const { topics } = loadTopics(ROOT)
const pending = topics.filter((t) => !isTopicConsumed(ROOT, t.slug))

if (!pending.length) {
  console.log('Nothing to do: every queued topic already has a post.')
  process.exit(0)
}

const target = Math.min(pending.length, LIMIT)
console.log(`${pending.length} topic(s) pending; generating ${target}${DRY_RUN ? ' (dry run)' : ''}.\n`)

const written = []
const failed = []
let stoppedEarly = null

for (let i = 0; i < target; i++) {
  const topic = pending[i]
  process.stdout.write(`[${i + 1}/${target}] ${topic.slug} ... `)

  const args = ['--topic', topic.slug]
  if (DRY_RUN) args.push('--dry-run')
  const res = spawnSync(process.execPath, [GENERATOR, ...args], {
    cwd: ROOT,
    encoding: 'utf-8',
    env: process.env,
    // A post is ~8k output tokens; give the model room before we call it stuck.
    timeout: 10 * 60 * 1000,
  })

  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`
  const fatal = FATAL.find((re) => re.test(out))
  if (fatal) {
    console.log('FATAL')
    stoppedEarly = out.trim().split('\n').find((l) => fatal.test(l)) ?? out.trim().slice(0, 200)
    break
  }

  if (res.status === 0) {
    console.log('ok')
    written.push(topic.slug)
  } else {
    // The generator prints "failed validation after N attempts: <reasons>".
    const why = /failed validation[^:]*:\s*(.*)/.exec(out)?.[1]?.trim()
    console.log('failed')
    failed.push({ slug: topic.slug, why: why ?? out.trim().split('\n').slice(-1)[0] ?? 'unknown' })
  }
}

console.log(`\nwritten: ${written.length}   failed: ${failed.length}`)
if (failed.length) {
  console.log('\nfailed topics (rerun individually with --topic <slug>):')
  for (const f of failed) console.log(`  ${f.slug}\n      ${f.why}`)
}
if (stoppedEarly) {
  console.log(`\nStopped early - this will not fix itself by retrying:\n  ${stoppedEarly}`)
  process.exitCode = 1
}
