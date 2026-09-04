/**
 * Walk every markdown file under `docs/`, extract shell fences, and assert that
 * every command the docs tell a reader to run actually exists.
 *
 * This guards a specific failure we shipped: `docs/help/benchmarks.md` published
 * a full table of performance numbers, instructed the reader to reproduce them
 * with `pnpm bench --json` / `--baseline=`, and stated that "regressions over
 * 10% fail CI on the main branch". There was no `bench` script in any
 * package.json, no `tools/bench*.mjs`, and no such CI step. It survived
 * releases because nothing checked - `docs-snippets.test.ts` type-checks TS
 * fences, but no test had ever looked at a bash fence.
 *
 * The first thing an evaluator arriving from a competitor's benchmark blog
 * does is paste that command.
 *
 * Run with: `pnpm vitest run tools/docs-commands.test.ts`.
 *
 * Fence annotations recognised in the language tag (e.g. `bash {nocheck}`),
 * matching the convention in docs-snippets.test.ts:
 *   - `nocheck` - skip this block entirely (illustrative shell, another repo's
 *                 commands, a transcript of output)
 */
import { readFile, readdir, access } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const DOCS_DIR = join(ROOT, 'docs')

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '_internal') continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else if (entry.name.endsWith('.md')) yield p
  }
}

type Fence = { file: string; line: number; body: string }

function extractShellFences(file: string, src: string): Fence[] {
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1)
  const out: Fence[] = []
  const lines = src.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const m = /^```([a-zA-Z]+)(?:\s+\{([^}]*)\})?\s*$/.exec(lines[i] ?? '')
    if (!m) {
      i += 1
      continue
    }
    const lang = m[1]!.toLowerCase()
    const flags = new Set((m[2] ?? '').split(/[,\s]+/).filter(Boolean))
    const start = i + 1
    let j = start
    while (j < lines.length && !/^```\s*$/.test(lines[j] ?? '')) j += 1
    if ((lang === 'bash' || lang === 'sh' || lang === 'shell') && !flags.has('nocheck')) {
      out.push({ file, line: start, body: lines.slice(start, j).join('\n') })
    }
    i = j + 1
  }
  return out
}

/** Every `scripts` key across the workspace, as `pnpm <key>` would resolve it. */
async function collectWorkspaceScripts(): Promise<Set<string>> {
  const names = new Set<string>()
  const manifests = [join(ROOT, 'package.json')]
  for (const dir of ['packages', 'workers']) {
    let entries: Awaited<ReturnType<typeof readdir>>
    try {
      entries = await readdir(join(ROOT, dir), { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (e.isDirectory()) manifests.push(join(ROOT, dir, e.name, 'package.json'))
    }
  }
  for (const m of manifests) {
    try {
      const pkg = JSON.parse(await readFile(m, 'utf-8')) as { scripts?: Record<string, string> }
      for (const k of Object.keys(pkg.scripts ?? {})) names.add(k)
    } catch {
      // A package without a manifest is not this test's problem.
    }
  }
  return names
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(join(ROOT, p))
    return true
  } catch {
    return false
  }
}

/**
 * Package managers this repo does not use. A doc showing `npm install @svgrid/grid`
 * is instructing the READER's project, not this workspace, so those lines carry
 * no claim about our scripts and are skipped wholesale.
 */
const FOREIGN_RUNNERS = /^(npm|yarn|bun|npx|bunx|deno)\b/

/**
 * `pnpm` subcommands that are pnpm's own, not a script name. `pnpm install`
 * resolves without any `scripts` entry; `pnpm bench` does not.
 *
 * `test` and `start` are deliberately absent: they look like builtins but are
 * script-runner shorthands, so `pnpm test` still fails when no `test` script
 * exists. Leaving them out means we check them.
 */
const PNPM_BUILTINS = new Set([
  'install', 'i', 'add', 'remove', 'rm', 'update', 'up', 'why', 'list', 'ls',
  'outdated', 'audit', 'link', 'unlink', 'exec', 'dlx', 'create', 'init',
  'publish', 'pack', 'store', 'setup', 'config', 'run',
  'approve-builds', 'rebuild', 'prune', 'fetch', 'deploy', 'licenses', 'patch',
  'patch-commit', 'import', 'server', 'root', 'bin', 'env', 'dedupe',
])

type Claim = { kind: 'script' | 'file'; value: string; raw: string }

/**
 * Pull the checkable claims out of one shell fence. Deliberately conservative:
 * a line we cannot parse confidently produces no claim rather than a guess,
 * because a false failure here trains people to delete the test.
 */
function claimsIn(body: string): Claim[] {
  const out: Claim[] = []
  for (const rawLine of body.split('\n')) {
    // Strip a leading prompt marker and an inline comment.
    let line = rawLine.replace(/^\s*[$>]\s+/, '').trim()
    line = line.replace(/\s+#.*$/, '').trim()
    if (!line || line.startsWith('#')) continue
    if (FOREIGN_RUNNERS.test(line)) continue

    // `pnpm [--filter X] [-r] <script> [args]`
    const pnpm = /^pnpm\s+(.*)$/.exec(line)
    if (pnpm) {
      const tokens = pnpm[1]!.split(/\s+/)
      let k = 0
      // Skip flags and their values (--filter <pkg>, -C <dir>, -w, -r, ...).
      while (k < tokens.length) {
        const t = tokens[k]!
        if (t === '--filter' || t === '-F' || t === '-C' || t === '--dir') { k += 2; continue }
        if (t.startsWith('-')) { k += 1; continue }
        break
      }
      let name = tokens[k]
      if (name === 'run') name = tokens[k + 1]
      if (!name || name.startsWith('-')) continue
      if (PNPM_BUILTINS.has(name)) continue
      out.push({ kind: 'script', value: name, raw: line })
      continue
    }

    // `node tools/foo.mjs`, `node packages/grid/scripts/bar.mjs`
    const node = /^node\s+(?:--[\w-]+(?:=\S+)?\s+)*([\w./-]+\.(?:mjs|cjs|js|ts))\b/.exec(line)
    if (node) {
      const p = node[1]!
      // Only claims about paths in THIS repo. A relative path inside a
      // reader's own project (`node ./scripts/mine.mjs`) is not ours to check.
      if (/^(tools|packages|scripts|workers)\//.test(p)) {
        out.push({ kind: 'file', value: p, raw: line })
      }
    }
  }
  return out
}

describe('docs shell commands', () => {
  it('every pnpm script and repo script path the docs name actually exists', async () => {
    const scripts = await collectWorkspaceScripts()
    const failures: string[] = []
    let checked = 0

    for await (const file of walk(DOCS_DIR)) {
      const src = await readFile(file, 'utf-8')
      const rel = relative(ROOT, file).replace(/\\/g, '/')
      for (const fence of extractShellFences(file, src)) {
        for (const claim of claimsIn(fence.body)) {
          checked += 1
          if (claim.kind === 'script') {
            if (!scripts.has(claim.value)) {
              failures.push(
                `${rel}:${fence.line} - \`${claim.raw}\`\n` +
                `  no "${claim.value}" script in any workspace package.json`,
              )
            }
          } else if (!(await exists(claim.value))) {
            failures.push(
              `${rel}:${fence.line} - \`${claim.raw}\`\n` +
              `  ${claim.value} does not exist`,
            )
          }
        }
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `${failures.length} of ${checked} documented commands do not exist:\n\n` +
        failures.join('\n\n') +
        `\n\nEither add the script/file, or fix the doc. If a fence is ` +
        `illustrative rather than runnable here, tag it \`\`\`bash {nocheck}.`,
      )
    }

    // Tripwire, not a coverage target. Most shell fences in docs/ are
    // `pnpm add <pkg>` aimed at the reader's project, which carries no claim
    // about our scripts; only a dozen or so lines name something in this
    // repo. The floor exists because if the fence regex ever stops matching,
    // this test goes green while checking nothing - the same shape of bug it
    // was written to catch. Raise it when the real count grows.
    expect(checked).toBeGreaterThanOrEqual(10)
  })
})
