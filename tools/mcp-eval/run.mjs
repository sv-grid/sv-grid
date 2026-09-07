#!/usr/bin/env node
/**
 * Score the SvGrid MCP server against a fixed set of realistic asks.
 *
 * Why this exists: every tool description, ranking tweak and token budget in
 * this server has been argued from first principles and spot-checked by hand.
 * That is how the API search shipped returning 210 of 240 names for "pin a
 * column" - it looked fine in review and was obviously broken the moment
 * anyone measured it. Anthropic's tool-writing guidance is blunt about this:
 * evaluation is how tools actually improve.
 *
 * Deterministic and model-free. Each task asserts what the SERVER returns for a
 * given call, so it costs nothing, runs in CI, and cannot flake. A
 * model-in-the-loop harness would measure something else and is a separate
 * decision.
 *
 *   node tools/mcp-eval/run.mjs            score and print a report
 *   node tools/mcp-eval/run.mjs --check    fail if worse than the baseline
 *   node tools/mcp-eval/run.mjs --save     write the current scores as baseline
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const SERVER = join(ROOT, 'packages', 'mcp', 'dist', 'index.js')
const BASELINE = join(HERE, 'baseline.json')

const args = process.argv.slice(2)
const check = args.includes('--check')
const save = args.includes('--save')

if (!existsSync(SERVER)) {
  console.error('mcp-eval: build the server first - pnpm --filter @svgrid/mcp build')
  process.exit(1)
}

// ---- a minimal MCP client over stdio ---------------------------------------

function client() {
  const child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'ignore'] })
  const pending = new Map()
  let id = 0
  let buf = ''
  child.stdout.on('data', (chunk) => {
    buf += chunk.toString()
    let nl
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      try {
        const msg = JSON.parse(line)
        if (msg.id != null && pending.has(msg.id)) {
          pending.get(msg.id)(msg)
          pending.delete(msg.id)
        }
      } catch {
        /* not a frame */
      }
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mine = ++id
      pending.set(mine, resolve)
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: mine, method, params }) + '\n')
      setTimeout(() => reject(new Error(`timeout on ${method}`)), 60_000)
    })
  return { child, send, calls: () => id }
}

const textOf = (reply) =>
  (reply?.result?.content ?? [])
    .map((c) => c.text ?? '')
    .join('')
    .split('\n\nSvGrid reference')[0]

const jsonOf = (reply) => {
  try {
    return JSON.parse(textOf(reply))
  } catch {
    return null
  }
}

// ---- scoring ---------------------------------------------------------------

/** Did every expected id show up in the hits for its corpus? */
function scoreRetrieval(body, expect) {
  const misses = []
  for (const [corpus, wanted] of Object.entries(expect)) {
    const hits = (body?.[corpus]?.hits ?? []).map((h) => h.slug ?? h.id ?? h.name)
    for (const want of wanted) {
      if (!hits.includes(want)) misses.push(`${corpus}:${want} (got ${hits.slice(0, 3).join(', ') || 'nothing'})`)
    }
  }
  return misses
}

function scoreNegative(body, expect) {
  const misses = []
  if (expect.empty) {
    const total =
      (body?.docs?.total ?? 0) + (body?.examples?.total ?? 0) + (body?.api?.total ?? 0)
    // A query with no good answer must come back empty, not with the least-bad
    // thing. Returning noise here is worse than returning nothing: it reads
    // like an answer.
    if (total > 0) misses.push(`expected nothing, got ${total} hit(s)`)
  }
  if (expect.partial) {
    // Not every off-topic query can return nothing - "kubernetes ingress
    // controller" does hit pages containing "controller". The requirement is
    // that the server SAYS so, rather than presenting loose matches as answers.
    if (body?.docs?.partial !== true) misses.push('loose matches were not flagged as partial')
  }
  if (expect.hint) {
    const hint = String(body?.hint ?? '')
    if (!hint.includes(expect.hint)) misses.push(`hint was ${JSON.stringify(hint.slice(0, 60))}`)
  }
  return misses
}

async function main() {
  const { tasks } = JSON.parse(readFileSync(join(HERE, 'tasks.json'), 'utf8'))
  const { child, send, calls } = client()

  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'mcp-eval', version: '1.0.0' },
  })
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n')

  const results = []
  let bytes = 0

  for (const task of tasks) {
    let misses = []
    let reply

    if (task.band === 'retrieval') {
      reply = await send('tools/call', {
        name: 'svgrid_search',
        arguments: { query: task.query, limit: 10 },
      })
      misses = scoreRetrieval(jsonOf(reply), task.expect)
    } else if (task.band === 'negative') {
      if (task.ref) {
        reply = await send('tools/call', { name: 'svgrid_get', arguments: { ref: task.ref } })
        const text = textOf(reply)
        misses = text.includes(task.expect.hint) ? [] : [`got ${JSON.stringify(text.slice(0, 60))}`]
      } else {
        const argsFor = task.query
          ? { query: task.query }
          : task.category
            ? { category: task.category, kind: 'examples' }
            : { section: task.section, kind: 'docs' }
        reply = await send('tools/call', { name: 'svgrid_search', arguments: argsFor })
        misses = scoreNegative(jsonOf(reply), task.expect)
      }
    } else if (task.band === 'repair') {
      reply = await send('tools/call', {
        name: 'svgrid_check_code',
        arguments: { source: task.source, filename: `${task.id}.svelte` },
      })
      const body = jsonOf(reply) ?? {}
      if (task.expectNoChange) {
        // Correct code must come back untouched. This is the property that
        // makes auto-fix safe to run at all.
        if (body.applied) misses.push(`rewrote correct code: ${body.applied.join(', ')}`)
      } else {
        if (!body.applied?.length) misses.push('nothing was fixed')
        else {
          // The real grade: re-check the corrected source. Anything left means
          // the fix did not finish the job.
          const again = await send('tools/call', {
            name: 'svgrid_check_code',
            arguments: { source: body.fixed, filename: `${task.id}.svelte` },
          })
          const left = (jsonOf(again)?.diagnostics ?? []).filter((d) => d.severity === 'error')
          if (left.length) misses.push(`${left.length} error(s) survived the fix: ${left.map((d) => d.rule).join(', ')}`)
        }
      }
    }

    bytes += textOf(reply).length
    results.push({ id: task.id, band: task.band, pass: misses.length === 0, misses })
  }

  child.kill()

  // ---- report --------------------------------------------------------------

  const byBand = {}
  for (const r of results) {
    byBand[r.band] ??= { pass: 0, total: 0 }
    byBand[r.band].total++
    if (r.pass) byBand[r.band].pass++
  }
  const passed = results.filter((r) => r.pass).length
  const score = { passed, total: results.length, byBand, toolCalls: calls(), bytes }

  console.log('SvGrid MCP eval\n')
  for (const r of results) {
    console.log(`  ${r.pass ? 'ok  ' : 'FAIL'} ${r.band.padEnd(10)} ${r.id}`)
    for (const m of r.misses) console.log(`         ${m}`)
  }
  console.log()
  for (const [band, s] of Object.entries(byBand)) {
    console.log(`  ${band.padEnd(10)} ${s.pass}/${s.total}`)
  }
  console.log(`\n  overall    ${passed}/${results.length}`)
  console.log(`  tool calls ${score.toolCalls}`)
  console.log(`  response   ${score.bytes} chars (~${Math.round(score.bytes / 4)} tokens)`)

  if (save) {
    writeFileSync(BASELINE, JSON.stringify(score, null, 2) + '\n')
    console.log(`\n  baseline written to ${BASELINE}`)
    return
  }

  if (check) {
    if (!existsSync(BASELINE)) {
      console.error('\nmcp-eval: no baseline. Run with --save first.')
      process.exit(1)
    }
    const base = JSON.parse(readFileSync(BASELINE, 'utf8'))
    if (passed < base.passed) {
      console.error(
        `\nmcp-eval: REGRESSION - ${passed}/${results.length} passed, baseline was ${base.passed}.`,
      )
      for (const r of results.filter((x) => !x.pass)) console.error(`  ${r.id}: ${r.misses.join('; ')}`)
      process.exit(1)
    }
    if (passed > base.passed) {
      console.log(`\nmcp-eval: improved on the baseline (${base.passed} -> ${passed}). Run --save to record it.`)
    } else {
      console.log('\nmcp-eval: matches the baseline.')
    }
  }
}

main().catch((err) => {
  console.error(`mcp-eval failed: ${err?.stack ?? err}`)
  process.exit(1)
})
