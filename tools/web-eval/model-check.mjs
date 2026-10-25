#!/usr/bin/env node
/**
 * Ask a real model to build with SvGrid from svgrid.com alone, and check what
 * it writes. The companion of run.mjs: that one proves the paths exist and fit
 * a fetch; this one shows whether a model takes them and ends with code that
 * uses the real API.
 *
 * Each ask in model-tasks.json goes to a fresh `claude -p` session that may
 * only use WebFetch, and only on svgrid.com: no MCP server, no repository, no
 * web search. The component it answers with is checked by the MCP server's own
 * svgrid_check_code (imports, props, column keys and api methods against this
 * version), and must match the task's `need` patterns and none of its
 * `forbid` ones. The URLs it read are printed, which is how the docs gaps that
 * misled it were found (a pagination page that said "register the row model"
 * led to an <SvGrid options> prop that does not exist).
 *
 * Not for CI: it runs a model, takes minutes per ask and costs tokens, and
 * models vary run to run. Run it by hand after a change to the docs or the
 * agent-facing files, ideally twice for an ask that failed.
 *
 *   node tools/web-eval/model-check.mjs                    every ask once
 *   node tools/web-eval/model-check.mjs row-position 2     one ask, twice
 *
 * Needs the Claude Code CLI on PATH (or CLAUDE_BIN) and a built MCP server:
 * pnpm --filter @svgrid/mcp build. Answers are written to
 * tools/web-eval/.model-check/ (gitignored).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const SERVER = join(ROOT, 'packages', 'mcp', 'dist', 'index.js')
const OUT = join(HERE, '.model-check')
const CLAUDE = process.env.CLAUDE_BIN ?? 'claude'

if (!existsSync(SERVER)) {
  console.error('model-check: build the MCP server first - pnpm --filter @svgrid/mcp build')
  process.exit(1)
}
mkdirSync(join(OUT, 'empty'), { recursive: true })

const prompt = (ask) =>
  'You are writing code for a Svelte 5 app that uses SvGrid. You may only use the WebFetch tool, and only on https://svgrid.com ' +
  '(start at https://svgrid.com/llms.txt). Do not answer SvGrid API questions from memory: check every import, prop and method ' +
  `on the site before you use it.\n\nTask: ${ask}\n\n` +
  'Reply with exactly one complete Svelte 5 component in a ```svelte code block, then a line starting "Read:" listing the svgrid.com URLs you used.'

// ---- the model -------------------------------------------------------------

/**
 * One `claude -p` session. The prompt goes in on stdin, so no shell ever
 * quotes it: on Windows the CLI is a .cmd shim that only a shell can start.
 */
function ask(text) {
  const args = [
    '-p',
    '--allowedTools', '"WebFetch(domain:svgrid.com)"',
    '--disallowedTools', 'WebSearch', 'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Task',
    '--strict-mcp-config',
    '--output-format', 'stream-json', '--verbose',
  ]
  return new Promise((resolve) => {
    // An empty folder, so no project instructions or memory reach the session.
    // One command string: Node deprecates an argument list together with a shell.
    const child = spawn([CLAUDE, ...args].join(' '), { cwd: join(OUT, 'empty'), shell: true })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', () => {})
    child.on('error', (e) => resolve({ urls: [], result: '', error: e.message }))
    const timer = setTimeout(() => child.kill(), 15 * 60_000)
    child.on('close', () => {
      clearTimeout(timer)
      const urls = []
      let result = ''
      for (const line of out.split('\n')) {
        try {
          const m = JSON.parse(line)
          if (m.type === 'assistant') for (const c of m.message?.content ?? []) if (c.type === 'tool_use' && c.input?.url) urls.push(c.input.url)
          if (m.type === 'result') result = m.result ?? ''
        } catch {}
      }
      resolve({ urls, result })
    })
    child.stdin.end(text)
  })
}

// ---- the checker: svgrid_check_code over stdio ---------------------------------

function checker() {
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
      } catch {}
    }
  })
  const send = (method, params) =>
    new Promise((resolve) => {
      const n = ++id
      pending.set(n, resolve)
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n')
    })
  return {
    async init() {
      await send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'model-check', version: '1' } })
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
    },
    /** The error messages svgrid_check_code reports for a component. */
    async errors(source) {
      const r = await send('tools/call', { name: 'svgrid_check_code', arguments: { source, filename: 'App.svelte' } })
      const text = r.result?.content?.[0]?.text ?? ''
      try {
        return (JSON.parse(text).diagnostics ?? []).filter((d) => (d.severity ?? 'error') === 'error').map((d) => d.message)
      } catch {
        return [`checker answered: ${text.slice(0, 120)}`]
      }
    },
    close: () => child.kill(),
  }
}

// ---- run ---------------------------------------------------------------------------

const { tasks } = JSON.parse(readFileSync(join(HERE, 'model-tasks.json'), 'utf8'))
const [only, timesArg] = process.argv.slice(2)
const times = Number(timesArg) || 1
const selected = (only ? tasks.filter((t) => t.id === only) : tasks).flatMap((t) =>
  Array.from({ length: times }, (_, i) => ({ ...t, run: times > 1 ? `${t.id}-${i + 1}` : t.id })),
)
if (!selected.length) {
  console.error(`model-check: no ask "${only}"; the ids are ${tasks.map((t) => t.id).join(', ')}`)
  process.exit(1)
}

const check = checker()
await check.init()
let passed = 0
for (const t of selected) {
  const started = Date.now()
  const { urls, result, error } = await ask(prompt(t.ask))
  const code = /```svelte\n([\s\S]*?)```/.exec(result)?.[1] ?? ''
  writeFileSync(join(OUT, `${t.run}.answer.md`), result)
  writeFileSync(join(OUT, `${t.run}.svelte`), code)
  const errors = error ? [`could not start ${CLAUDE}: ${error}`] : code ? await check.errors(code) : ['no ```svelte block in the answer']
  const missing = (t.need ?? []).filter((p) => !new RegExp(p).test(code))
  const forbidden = (t.forbid ?? []).filter((p) => new RegExp(p).test(code))
  const pass = !errors.length && !missing.length && !forbidden.length
  if (pass) passed++
  const why = [errors.length && `errors: ${errors.join(' | ')}`, missing.length && `missing: ${missing.join(', ')}`, forbidden.length && `forbidden: ${forbidden.join(', ')}`].filter(Boolean).join('; ')
  console.log(`${pass ? 'PASS' : 'FAIL'} ${t.run} (${Math.round((Date.now() - started) / 1000)}s, ${urls.length} fetches)${why ? ' ' + why : ''}`)
  console.log(`     read: ${urls.map((u) => u.replace('https://svgrid.com', '')).join(' ')}`)
}
check.close()
console.log(`model-check: ${passed}/${selected.length} passed; answers in ${OUT}`)
process.exit(passed === selected.length ? 0 : 1)
