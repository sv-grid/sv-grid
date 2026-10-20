/**
 * @svgrid/mcp the way a client runs it: JSON-RPC over stdio, spoken here by
 * hand so nothing in the SDK smooths over what the server writes.
 *
 * The cold start is the regression this exists for. `npx -y @svgrid/mcp` with
 * an empty npm cache took 30-46 s on Windows while enterprise was a dependency,
 * past the 30 s an MCP client waits for the `initialize` reply. It gets its
 * own empty cache, not the run's: other checks fill the shared one first.
 */
import { spawn } from 'node:child_process'
import { join, kill, tail, writeFileSync } from '../lib.mjs'

export const name = 'mcp'
export const description = 'npx @svgrid/mcp cold start, every tool/resource/prompt over stdio, project-local Studio'

/** The client gives up at 30 s; fail with margin to spare. */
const START_LIMIT_MS = 25_000

const CORE = ['svgrid_search', 'svgrid_get', 'svgrid_check_code', 'svgrid_preview', 'svgrid_scaffold']
const STUDIO = ['studio_project', 'studio_apply', 'studio_configure', 'studio_build']

const GOOD_SNIPPET = `<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import '@svgrid/grid/themes/ember.css'

  type Row = { name: string; age: number }
  const data: Row[] = [
    { name: 'Ada', age: 36 },
    { name: 'Grace', age: 85 },
  ]
  const columns: GridColumns<Row> = [
    { field: 'name', header: 'Name' },
    { field: 'age', header: 'Age' },
  ]
</script>

<SvGrid {data} {columns} sortable filterable />
`

const SVELTE4_SNIPPET = `<script lang="ts">
  import { SvGrid } from 'svelte-grid'

  export let data = []
  const columns = [{ field: 'name', header: 'Name' }]
</script>

<SvGrid {data} {columns} sortable />
`

/**
 * A minimal MCP client over a child's stdio. Newline-delimited JSON both ways;
 * anything on stdout that is not a JSON-RPC message is kept, because a banner
 * there corrupts the stream for a real client.
 */
function startServer(cmd, { cwd, env }) {
  const t0 = Date.now()
  const child = spawn(cmd, { cwd, shell: true, env: { ...process.env, ...env } })
  const pending = new Map()
  const stray = []
  let stdout = ''
  let stderr = ''
  let nextId = 1
  let exited = null

  child.stdout.on('data', (d) => {
    stdout += d
    let i
    while ((i = stdout.indexOf('\n')) >= 0) {
      const line = stdout.slice(0, i).replace(/\r$/, '')
      stdout = stdout.slice(i + 1)
      if (!line.trim()) continue
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        stray.push(line)
        continue
      }
      if (msg?.jsonrpc !== '2.0') stray.push(line)
      if (msg?.id != null && pending.has(msg.id)) pending.get(msg.id).done(msg)
    }
  })
  child.stderr.on('data', (d) => (stderr += d))
  child.on('exit', (code) => {
    exited = code
    for (const p of pending.values()) p.fail(new Error(`server exited (${code}) before answering ${p.method}\nstderr:\n${tail(stderr)}`))
    pending.clear()
  })

  const send = (msg) => child.stdin.write(JSON.stringify(msg) + '\n')

  /** One request; resolves with the whole JSON-RPC response (result or error). */
  function request(method, params, timeout = 90_000) {
    if (exited !== null) return Promise.reject(new Error(`server already exited (${exited})\nstderr:\n${tail(stderr)}`))
    const id = nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`${method} got no reply within ${timeout} ms\nstderr:\n${tail(stderr)}`))
      }, timeout)
      pending.set(id, {
        method,
        done: (msg) => {
          clearTimeout(timer)
          pending.delete(id)
          resolve(msg)
        },
        fail: (e) => {
          clearTimeout(timer)
          reject(e)
        },
      })
      send({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) })
    })
  }

  /** The result of a request, or throw with the JSON-RPC error. */
  async function call(method, params, timeout) {
    const res = await request(method, params, timeout)
    if (res.error) throw new Error(`${method} returned error ${res.error.code}: ${res.error.message}`)
    return res.result
  }

  /** initialize + notifications/initialized; returns the ms from spawn to the reply. */
  async function handshake(timeout) {
    const result = await call(
      'initialize',
      { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'svgrid-post-publish', version: '1.0.0' } },
      timeout,
    )
    const ms = Date.now() - t0
    send({ jsonrpc: '2.0', method: 'notifications/initialized' })
    return { ms, result }
  }

  return { child, call, request, handshake, stray, stderr: () => stderr, stop: () => kill(child) }
}

/** tools/call; returns { text, isError, result }. */
async function tool(server, name, args) {
  const result = await server.call('tools/call', { name, arguments: args })
  const text = (result.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n')
  return { text, isError: result.isError === true, result }
}

/** Tool output that is JSON (search, check_code), with or without a trailing docs line. */
function jsonOf(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error(`no JSON in tool output:\n${text.slice(0, 600)}`)
  return JSON.parse(text.slice(start, end + 1))
}

const secs = (ms) => `${(ms / 1000).toFixed(1)} s`

export async function run(ctx) {
  const v = ctx.versions.mcp
  const ve = ctx.versions.enterprise

  // ---- 1. cold npx, the configuration every MCP client doc shows ----------
  const coldDir = ctx.dir('mcp-cold')
  const coldEnv = { ...ctx.env, npm_config_cache: join(coldDir, '.npm-cache') }
  let server
  let started = false

  await ctx.step(`cold \`npx -y @svgrid/mcp@${v}\` answers initialize in < ${START_LIMIT_MS / 1000} s (empty npm cache)`, async () => {
    server = startServer(`npx -y @svgrid/mcp@${v}`, { cwd: coldDir, env: coldEnv })
    const { ms, result } = await server.handshake(120_000)
    started = true
    if (result?.serverInfo?.name !== '@svgrid/mcp') throw new Error(`serverInfo is ${JSON.stringify(result?.serverInfo)}`)
    if (result?.serverInfo?.version !== v) throw new Error(`serverInfo.version ${result?.serverInfo?.version}, expected ${v}`)
    const caps = Object.keys(result?.capabilities ?? {})
    for (const c of ['tools', 'resources', 'prompts']) if (!caps.includes(c)) throw new Error(`capabilities lack ${c}: ${caps.join(', ')}`)
    if (ms >= START_LIMIT_MS) throw new Error(`initialize took ${secs(ms)} from spawn (install + start); a client gives up at 30 s`)
    return `${secs(ms)} install + start`
  })
  if (!started) {
    server?.stop()
    return
  }

  try {
    // Before tools/list, which is what warms the corpus: both of these load it.
    await ctx.step('two requests sent at once on a cold corpus both answer correctly', async () => {
      const t = Date.now()
      const [search, api] = await Promise.all([
        tool(server, 'svgrid_search', { query: 'pin a column' }),
        tool(server, 'svgrid_get', { ref: 'api' }),
      ])
      if (search.isError) throw new Error(`svgrid_search errored: ${search.text.slice(0, 400)}`)
      if (api.isError) throw new Error(`svgrid_get api errored: ${api.text.slice(0, 400)}`)
      const s = jsonOf(search.text)
      if (!s.docs?.hits?.length) throw new Error(`search returned no doc hits: ${search.text.slice(0, 400)}`)
      if (!/SvGrid|props|columns/i.test(api.text) || api.text.length < 500) throw new Error(`api reference looks empty: ${api.text.slice(0, 400)}`)
      return `both in ${secs(Date.now() - t)}`
    })

    await ctx.step('tools/list has the five core tools', async () => {
      const { tools } = await server.call('tools/list', {})
      const names = tools.map((t) => t.name)
      const missing = CORE.filter((n) => !names.includes(n))
      if (missing.length) throw new Error(`missing: ${missing.join(', ')} (listed: ${names.join(', ')})`)
      const noSchema = tools.filter((t) => t.inputSchema?.type !== 'object').map((t) => t.name)
      if (noSchema.length) throw new Error(`no object inputSchema: ${noSchema.join(', ')}`)
      return `${names.length} tools`
    })

    let docSlug
    let demoId
    await ctx.step('svgrid_search finds docs, demos and API for "pin a column"', async () => {
      const r = await tool(server, 'svgrid_search', { query: 'pin a column' })
      if (r.isError) throw new Error(r.text.slice(0, 400))
      const s = jsonOf(r.text)
      docSlug = s.docs?.hits?.[0]?.slug
      demoId = s.examples?.hits?.[0]?.id
      if (!docSlug) throw new Error(`no doc hit: ${r.text.slice(0, 400)}`)
      if (!demoId) throw new Error(`no demo hit: ${r.text.slice(0, 400)}`)
      return `${s.docs.total} docs, ${s.examples.total} demos, ${s.api?.total ?? 0} api; top doc ${docSlug}`
    })

    await ctx.step('svgrid_get returns the doc and the demo source the search found', async () => {
      if (!docSlug || !demoId) throw new Error('search step found nothing to fetch')
      const doc = await tool(server, 'svgrid_get', { ref: docSlug })
      if (doc.isError || doc.text.length < 300) throw new Error(`doc ${docSlug}: ${doc.text.slice(0, 400)}`)
      const demo = await tool(server, 'svgrid_get', { ref: demoId, kind: 'example' })
      if (demo.isError) throw new Error(`demo ${demoId}: ${demo.text.slice(0, 400)}`)
      if (!/<script/.test(demo.text) || !/@svgrid\/grid/.test(demo.text)) throw new Error(`demo ${demoId} is not Svelte source using @svgrid/grid:\n${demo.text.slice(0, 400)}`)
      return `${docSlug} ${doc.text.length} chars, ${demoId} ${demo.text.length} chars`
    })

    await ctx.step('svgrid_check_code passes a correct Svelte 5 grid', async () => {
      const r = await tool(server, 'svgrid_check_code', { source: GOOD_SNIPPET, filename: 'People.svelte' })
      if (r.isError) throw new Error(r.text.slice(0, 600))
      const p = jsonOf(r.text)
      const errors = (p.diagnostics ?? []).filter((d) => d.severity === 'error')
      if (p.ok !== true || errors.length) throw new Error(`ok=${p.ok}:\n${JSON.stringify(p.diagnostics, null, 2).slice(0, 1500)}`)
      return `${(p.diagnostics ?? []).length} diagnostics, none errors`
    })

    await ctx.step('svgrid_check_code flags `export let` + svelte-grid and returns a fixed copy', async () => {
      const r = await tool(server, 'svgrid_check_code', { source: SVELTE4_SNIPPET, filename: 'Grid.svelte' })
      if (r.isError) throw new Error(r.text.slice(0, 600))
      const p = jsonOf(r.text)
      const rules = (p.diagnostics ?? []).map((d) => d.rule)
      const problems = []
      if (p.ok !== false) problems.push(`ok is ${p.ok}`)
      if (!rules.includes('svgrid/lookalike-package')) problems.push(`no svgrid/lookalike-package diagnostic (rules: ${rules.join(', ')})`)
      const exportLet = (p.diagnostics ?? []).find((d) => /export let/.test(d.message ?? ''))
      if (!exportLet) problems.push('no diagnostic mentions `export let`')
      // The tool promises "the line to fix"; `export let data` is on line 4.
      else if (exportLet.line !== 4) problems.push(`the \`export let\` diagnostic points at line ${exportLet.line}; it is on line 4`)
      if (typeof p.fixed !== 'string') problems.push('no `fixed` copy')
      else {
        if (/['"]svelte-grid['"]/.test(p.fixed)) problems.push('`fixed` still imports svelte-grid')
        if (!/from ['"]@svgrid\/grid['"]/.test(p.fixed)) problems.push('`fixed` does not import @svgrid/grid')
      }
      if (problems.length) throw new Error(`${problems.join('\n')}\n${r.text.slice(0, 1500)}`)
      return `${rules.length} diagnostics (${[...new Set(rules)].join(', ')}), ${p.applied?.length ?? 0} fixes applied`
    })

    await ctx.step('svgrid_preview renders rows and a shipped demo', async () => {
      const r = await tool(server, 'svgrid_preview', {
        title: 'Team',
        columns: [
          { field: 'name', header: 'Name', width: 160 },
          { field: 'role', header: 'Role' },
        ],
        data: [
          { name: 'Ada', role: 'Engineer' },
          { name: 'Grace', role: 'Admiral' },
        ],
      })
      if (r.isError) throw new Error(r.text.slice(0, 400))
      if (!/2 rows x 2 columns/.test(r.text)) throw new Error(`summary: ${r.text.slice(0, 400)}`)
      const sc = r.result.structuredContent
      if (sc?.data?.length !== 2 || sc?.columns?.length !== 2) throw new Error(`structuredContent: ${JSON.stringify(sc).slice(0, 400)}`)
      const uri = r.result._meta?.['ui/resourceUri']
      if (uri !== 'ui://svgrid/preview.html') throw new Error(`_meta ui/resourceUri is ${uri}`)
      if (!demoId) return 'rows only (no demo id from search)'
      const d = await tool(server, 'svgrid_preview', { demo: demoId })
      if (d.isError || !/<script/.test(d.text)) throw new Error(`demo preview ${demoId}: ${d.text.slice(0, 400)}`)
      return `rows + demo ${demoId}`
    })

    await ctx.step('svgrid_scaffold without enterprise says to install @svgrid/enterprise locally', async () => {
      const r = await tool(server, 'svgrid_scaffold', { from: 'json', name: 'people', rows: [{ id: 1, name: 'Ada' }], route: '/people' })
      if (!r.isError) throw new Error(`expected an isError answer, got:\n${r.text.slice(0, 400)}`)
      if (!/npm i -D @svgrid\/mcp @svgrid\/enterprise/.test(r.text)) throw new Error(`message lacks the install command:\n${r.text}`)
      return r.text.split('. ')[0]
    })

    let docUri
    await ctx.step('resources/list paginates with a cursor to the whole corpus', async () => {
      const seen = new Set()
      let cursor
      let pages = 0
      do {
        const res = await server.call('resources/list', cursor ? { cursor } : {})
        pages++
        if (res.resources.length > 100) throw new Error(`page ${pages} has ${res.resources.length} items`)
        for (const r of res.resources) {
          if (seen.has(r.uri)) throw new Error(`duplicate ${r.uri} on page ${pages}`)
          seen.add(r.uri)
          if (!docUri && r.uri.startsWith('svgrid://doc/')) docUri = r.uri
        }
        cursor = res.nextCursor
        if (pages > 50) throw new Error('more than 50 pages: the cursor does not advance')
      } while (cursor)
      if (!seen.has('ui://svgrid/preview.html')) throw new Error('the preview UI resource is not listed')
      const docs = [...seen].filter((u) => u.startsWith('svgrid://doc/')).length
      const demos = [...seen].filter((u) => u.startsWith('svgrid://example/')).length
      if (docs < 50 || demos < 50) throw new Error(`only ${docs} docs and ${demos} demos listed`)
      return `${seen.size} resources in ${pages} pages (${docs} docs, ${demos} demos)`
    })

    await ctx.step('resources/read returns a doc and the preview UI', async () => {
      if (!docUri) throw new Error('no doc resource listed')
      const doc = await server.call('resources/read', { uri: docUri })
      const text = doc.contents?.[0]?.text ?? ''
      if (doc.contents?.[0]?.mimeType !== 'text/markdown' || text.length < 100) throw new Error(`${docUri}: ${JSON.stringify(doc).slice(0, 300)}`)
      const ui = await server.call('resources/read', { uri: 'ui://svgrid/preview.html' })
      const html = ui.contents?.[0]?.text ?? ''
      if (!/<html|<script/i.test(html)) throw new Error(`preview UI is not HTML: ${html.slice(0, 200)}`)
      return `${docUri.replace('svgrid://doc/', '')} ${text.length} chars, preview UI ${html.length} chars (${ui.contents[0].mimeType})`
    })

    await ctx.step('prompts/list and prompts/get build_grid', async () => {
      const { prompts } = await server.call('prompts/list', {})
      const names = prompts.map((p) => p.name)
      if (!names.includes('build_grid')) throw new Error(`no build_grid in ${names.join(', ')}`)
      const p = await server.call('prompts/get', { name: 'build_grid', arguments: { description: 'orders with customer, total and status, sortable' } })
      const body = p.messages?.[0]?.content?.text ?? ''
      if (!/orders with customer/.test(body) || !/svgrid_check_code/.test(body)) throw new Error(`prompt body:\n${body.slice(0, 600)}`)
      return `${names.length} prompts: ${names.join(', ')}`
    })

    await ctx.step('stdout carries only JSON-RPC messages', async () => {
      if (server.stray.length) throw new Error(`non-JSON-RPC lines on stdout:\n${server.stray.slice(0, 5).join('\n')}`)
    })
  } finally {
    server.stop()
  }

  // ---- 2. project-local server with enterprise beside it (Studio) ---------
  const proj = ctx.dir('mcp-project')
  await ctx.step(`project: npm i -D @svgrid/mcp@${v} @svgrid/enterprise@${ve}`, async () => {
    writeFileSync(join(proj, 'package.json'), JSON.stringify({ name: 'mcp-project', private: true, type: 'module' }, null, 2))
    const r = await ctx.ok(`npm i -D @svgrid/mcp@${v} @svgrid/enterprise@${ve}`, { cwd: proj })
    return `${secs(r.ms)}`
  })

  let local
  started = false
  await ctx.step(`project: \`npx svgrid-mcp\` with SVGRID_MCP_STUDIO=1 answers initialize in < ${START_LIMIT_MS / 1000} s`, async () => {
    local = startServer('npx svgrid-mcp', { cwd: proj, env: { ...ctx.env, SVGRID_MCP_STUDIO: '1', SVGRID_LICENSE_KEY: '' } })
    const { ms, result } = await local.handshake(120_000)
    started = true
    if (result?.serverInfo?.version !== v) throw new Error(`serverInfo.version ${result?.serverInfo?.version}, expected ${v}`)
    if (ms >= START_LIMIT_MS) throw new Error(`initialize took ${secs(ms)}`)
    return secs(ms)
  })
  if (!started) {
    local?.stop()
    return
  }

  try {
    await ctx.step('project: tools/list adds the Studio tools', async () => {
      const { tools } = await local.call('tools/list', {})
      const names = tools.map((t) => t.name)
      const missing = [...CORE, ...STUDIO].filter((n) => !names.includes(n))
      if (missing.length) throw new Error(`missing: ${missing.join(', ')}\nlisted: ${names.join(', ')}\nstderr:\n${tail(local.stderr())}`)
      return `${names.length} tools`
    })

    let files
    await ctx.step('project: svgrid_scaffold from JSON rows returns files that compile', async () => {
      const r = await tool(local, 'svgrid_scaffold', {
        from: 'json',
        name: 'people',
        rows: [
          { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', active: true, age: 36 },
          { id: 2, name: 'Grace Hopper', email: 'grace@example.com', active: false, age: 85 },
        ],
        route: '/people',
      })
      if (r.isError) throw new Error(r.text.slice(0, 800))
      const at = r.text.search(/^\{/m)
      if (at < 0) throw new Error(`no JSON body:\n${r.text.slice(0, 800)}`)
      const body = JSON.parse(r.text.slice(at))
      files = body.files
      if (!Array.isArray(files) || files.length < 3) throw new Error(`files: ${JSON.stringify(files).slice(0, 400)}`)
      const summary = r.text.slice(0, at).split('\n').find((l) => l.startsWith('// ') && !/commercial|SVGRID_LICENSE_KEY|pricing|After writing/.test(l)) ?? ''
      if (body.verify && body.verify.ok === false) throw new Error(`verify failed: ${summary}\n${JSON.stringify(body.verify).slice(0, 800)}`)
      return `${files.map((f) => f.path).join(', ')}; ${summary.replace(/^\/\/ /, '')}`
    })

    await ctx.step('project: scaffold with route "/people" writes no `//` in paths or imports', async () => {
      if (!files) throw new Error('no files from the scaffold step')
      const bad = []
      for (const f of files) {
        if (f.path.includes('//')) bad.push(`path ${f.path}`)
        // A doubled slash inside a path or specifier, not a comment or a URL scheme.
        for (const m of String(f.contents).matchAll(/[\w$]\/\/[\w$]/g)) {
          const line = String(f.contents).slice(0, m.index).split('\n').length
          bad.push(`${f.path}:${line} ${String(f.contents).split('\n')[line - 1].trim()}`)
        }
      }
      if (bad.length) throw new Error(`doubled slashes:\n${bad.join('\n')}`)
    })

    await ctx.step('project: stdout carries only JSON-RPC messages', async () => {
      if (local.stray.length) throw new Error(`non-JSON-RPC lines on stdout:\n${local.stray.slice(0, 5).join('\n')}`)
    })
  } finally {
    local.stop()
  }
}
