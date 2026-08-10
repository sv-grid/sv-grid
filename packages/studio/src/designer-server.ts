/**
 * The local server behind `npx @svgrid/studio designer`. A tiny zero-dep
 * `node:http` server that:
 *   - serves the pre-built designer SPA from `@svgrid/enterprise/dist/designer`
 *   - GET  /api/project   -> the saved studio.config.json (or a starter project)
 *   - POST /api/project   -> auto-save the design back to studio.config.json
 *   - POST /api/generate  -> write the generated app bundle into the launch folder
 *
 * All the model + codegen work is reused from `@svgrid/enterprise/studio` (the
 * Svelte-free Node bundle); this file is just HTTP + node:fs wiring. Keeping it
 * dependency-free means the CLI runs on bare Node.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, resolve, extname } from 'node:path'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import {
  parseProject,
  serializeProject,
  introspectDatabase,
  listDatabaseTables,
  probeConnection,
  linkRelationLabels,
  buildConnectionString,
  getSampleApp,
  starterProject as buildStarterProject,
  skipUserOwned,
  type EntitySchema,
  type GeneratedFile,
  type SqlConnectionParts,
  type SqlDialectName,
  type StudioProject,
} from '@svgrid/enterprise/studio'
import { connect } from './db-connect.js'
import { runCopilot } from './copilot.js'
import { DRIVER_FOR, installDriver, isDriverInstalled } from './driver-install.js'

export type DesignerServerOptions = {
  /** studio.config.json path to load + auto-save. */
  configPath: string
  /** Directory the generated app is written into. */
  outDir: string
  /** Port to listen on. */
  port: number
  /** Open the browser on start. */
  open: boolean
  /** Sample-app id to seed a fresh session with (`--template <id>`). */
  template?: string
  /** Enable the AI copilot endpoint (`--ai`); requires ANTHROPIC_API_KEY. */
  ai?: boolean
  /** `studio dev`: the running generated app's URL, advertised to the SPA. */
  appUrl?: string
  /** `studio dev`: called after each successful Save-to-folder (dep sync). */
  onGenerated?: () => void | Promise<void>
  /** Log lines (defaults to process.stdout). */
  log?: (line: string) => void
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

/** The runtime deps the generated code imports, keyed by a source needle. */
const RUNTIME_DEPS: Array<[needle: string, dep: string, version: string]> = [
  ["from '@supabase/supabase-js'", '@supabase/supabase-js', '^2.45.0'],
  ["import pg from 'pg'", 'pg', '^8.11.0'],
  ["from 'mysql2/promise'", 'mysql2', '^3.9.0'],
  ["import mssql from 'mssql'", 'mssql', '^10.0.0'],
  ["import Database from 'better-sqlite3'", 'better-sqlite3', '^11.0.0'],
]

/** Resolve the shipped static designer bundle (`dist/designer`). */
function resolveDesignerDir(): string {
  const require = createRequire(import.meta.url)
  const pkgJson = require.resolve('@svgrid/enterprise/package.json')
  const dir = join(dirname(pkgJson), 'dist', 'designer')
  if (!existsSync(join(dir, 'index.html'))) {
    throw new Error(
      'The designer bundle is missing. Reinstall @svgrid/enterprise, or run its build (`npm run build`).',
    )
  }
  return dir
}

/** The project a fresh session opens with: a chosen sample app (`--template`), or the
 *  default enterprise-ready Customers CRUD showcase (rich grid + export + popup form,
 *  seeded) - so the first screen is a complete, generate-and-copy-ready SvGrid app. */
function starterProject(templateId?: string): StudioProject {
  if (templateId) {
    const app = getSampleApp(templateId)
    if (app) return app.build()
  }
  return buildStarterProject()
}

function send(res: ServerResponse, status: number, body: string, type = 'application/json; charset=utf-8'): void {
  res.writeHead(status, { 'content-type': type })
  res.end(body)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** Serve a file from the static bundle (SPA fallback to index.html). */
function serveStatic(res: ServerResponse, dir: string, urlPath: string): void {
  // Strip the query, decode, and normalize away any `..` traversal.
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0]!)).replace(/^(\.\.[/\\])+/, '')
  let filePath = join(dir, clean)
  if (!filePath.startsWith(dir)) filePath = join(dir, 'index.html')
  if (clean === '/' || clean === '\\' || !existsSync(filePath)) filePath = join(dir, 'index.html')
  res.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' })
  createReadStream(filePath).pipe(res)
}

/** Write the generated app bundle to disk and add any runtime deps it imports.
 *
 *  Clobber guard: `.studio/manifest.json` records the hash of every file Studio
 *  last wrote. On regenerate, a file the USER has since edited (disk differs from
 *  the manifest) gets the new version written as `<file>.new` + reported as a
 *  conflict, instead of silently overwriting their work. Files Studio wrote and
 *  nobody touched are overwritten as before. */
export async function writeBundle(outDir: string, files: GeneratedFile[]): Promise<{ written: number; conflicts: string[] }> {
  const manifestPath = join(outDir, '.studio', 'manifest.json')
  let manifest: Record<string, string> = {}
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, string>
  } catch {
    /* first generate (or pre-manifest project) - guard activates from now on */
  }
  const sha = (s: string) => createHash('sha256').update(s).digest('hex')
  const conflicts: string[] = []
  let written = 0
  for (const f of files) {
    const full = join(outDir, f.path)
    // User-owned companions (a screen's handlers.ts) are scaffolded once, then the
    // developer's forever: never overwrite one that already exists on disk. This is
    // the make-or-break round-trip guarantee. See HANDLERS-DESIGN.md.
    if (skipUserOwned(f, existsSync(full))) continue
    const newHash = sha(f.contents)
    if (existsSync(full)) {
      const onDisk = await readFile(full, 'utf8').catch(() => null)
      const diskHash = onDisk == null ? null : sha(onDisk)
      if (diskHash === newHash) {
        manifest[f.path] = newHash // already identical - nothing to write
        continue
      }
      const lastGenerated = manifest[f.path]
      if (lastGenerated !== undefined && diskHash !== null && diskHash !== lastGenerated) {
        // Locally modified since the last generate AND the regenerated content
        // differs: park it next to the user's version instead of clobbering.
        await writeFile(full + '.new', f.contents)
        conflicts.push(f.path)
        continue
      }
    }
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, f.contents)
    manifest[f.path] = newHash
    written++
  }
  await mkdir(dirname(manifestPath), { recursive: true })
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  const allSource = files.map((f) => f.contents).join('\n')
  const pkgPath = join(outDir, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as { dependencies?: Record<string, string> }
      let changed = false
      for (const [needle, dep, version] of RUNTIME_DEPS) {
        if (allSource.includes(needle)) {
          pkg.dependencies = { ...pkg.dependencies, [dep]: version }
          changed = true
        }
      }
      if (changed) await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
    } catch {
      // leave package.json untouched if it isn't valid JSON
    }
  }
  return { written, conflicts }
}

/** Best-effort open the default browser (no dependency). */
function openBrowser(url: string): void {
  const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '""', url] : [url]
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref()
  } catch {
    // ignore - the URL is printed anyway
  }
}

/** Start the designer server. Resolves once it is listening. */
export async function startDesignerServer(opts: DesignerServerOptions): Promise<{ url: string; close: () => void }> {
  const log = opts.log ?? ((line) => process.stdout.write(line + '\n'))
  const dir = resolveDesignerDir()
  const configPath = resolve(process.cwd(), opts.configPath)
  const outDir = resolve(process.cwd(), opts.outDir)

  const server = createServer((req, res) => {
    void handle(req, res).catch((err: unknown) => {
      send(res, 500, JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
    })
  })

  // Copilot is live only when BOTH the flag and the key are present; the SPA
  // probes /api/capabilities and only then wires (and shows) the Copilot button.
  const copilotKey = process.env.ANTHROPIC_API_KEY
  const copilotOn = !!opts.ai && !!copilotKey

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url ?? '/'
    const path = url.split('?')[0]!

    if (path === '/api/capabilities' && req.method === 'GET') {
      send(res, 200, JSON.stringify({ copilot: copilotOn, ...(opts.appUrl ? { appUrl: opts.appUrl } : {}) }))
      return
    }

    if (path === '/api/copilot' && req.method === 'POST') {
      if (!copilotOn) {
        send(res, 404, JSON.stringify({ error: 'Copilot is not enabled. Start with --ai and set ANTHROPIC_API_KEY.' }))
        return
      }
      const body = await readBody(req)
      const { prompt, project } = JSON.parse(body) as { prompt?: string; project?: string }
      if (!prompt || !project) {
        send(res, 400, JSON.stringify({ error: 'prompt and project are required' }))
        return
      }
      log(`  copilot: ${prompt.slice(0, 80)}`)
      const updated = await runCopilot(prompt, project, { apiKey: copilotKey! })
      send(res, 200, updated)
      return
    }

    if (path === '/api/project' && req.method === 'GET') {
      const json = existsSync(configPath) ? await readFile(configPath, 'utf8') : null
      // Round-trip through parse/serialize so we hand the client a normalized,
      // validated project (or the starter / chosen sample when there's no saved config).
      const project = json ? parseProject(json) : starterProject(opts.template)
      send(res, 200, serializeProject(project))
      return
    }

    if (path === '/api/project' && req.method === 'POST') {
      const body = await readBody(req)
      const project = parseProject(body) // validate before persisting
      await mkdir(dirname(configPath), { recursive: true })
      await writeFile(configPath, serializeProject(project))
      send(res, 200, JSON.stringify({ ok: true, saved: configPath }))
      return
    }

    if (path === '/api/generate' && req.method === 'POST') {
      const body = await readBody(req)
      const parsed = JSON.parse(body) as { files?: GeneratedFile[] }
      const files = Array.isArray(parsed.files) ? parsed.files : []
      if (files.length === 0) {
        send(res, 400, JSON.stringify({ error: 'no files to write' }))
        return
      }
      const { written, conflicts } = await writeBundle(outDir, files)
      log(`  generated ${written} files -> ${outDir}`)
      if (conflicts.length) {
        log(`  ! ${conflicts.length} file(s) were edited by hand since the last generate - the new`)
        log(`    version was written NEXT TO yours as "<file>.new" (merge or replace, then delete it):`)
        for (const c of conflicts) log(`    - ${c}  ->  ${c}.new`)
      }
      // `studio dev`: give the app-server loop a chance to install newly added
      // deps + restart; plain file rewrites are picked up by Vite's HMR.
      await opts.onGenerated?.()
      send(res, 200, JSON.stringify({ ok: true, count: written, conflicts, outDir }))
      return
    }

    // Assemble a connection string from guided-form fields (host/port/user/...).
    if (path === '/api/build-connection' && req.method === 'POST') {
      const body = await readBody(req)
      const reqBody = JSON.parse(body) as { dialect?: SqlDialectName; parts?: SqlConnectionParts }
      if (!reqBody.dialect) {
        send(res, 400, JSON.stringify({ error: 'dialect is required' }))
        return
      }
      try {
        const url = buildConnectionString(reqBody.dialect, reqBody.parts ?? {})
        send(res, 200, JSON.stringify({ url }))
      } catch (err) {
        send(res, 400, JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
      }
      return
    }

    // Install the dialect's driver into the user's project (auto-detects the PM).
    if (path === '/api/install-driver' && req.method === 'POST') {
      const body = await readBody(req)
      const reqBody = JSON.parse(body) as { dialect?: SqlDialectName }
      if (!reqBody.dialect) {
        send(res, 400, JSON.stringify({ error: 'dialect is required' }))
        return
      }
      const cwd = process.cwd()
      log(`  installing ${DRIVER_FOR[reqBody.dialect]} driver...`)
      const result = await installDriver(reqBody.dialect, cwd)
      log(result.ok ? `  driver ready (${result.package})` : `  driver install failed (${result.package})`)
      send(res, result.ok ? 200 : 500, JSON.stringify(result))
      return
    }

    if (path === '/api/introspect' && req.method === 'POST') {
      const body = await readBody(req)
      const reqBody = JSON.parse(body) as {
        dialect?: SqlDialectName
        url?: string
        action?: 'tables' | 'introspect' | 'test'
        tables?: string[]
      }
      const { dialect, url, action } = reqBody
      if (!dialect || !url) {
        send(res, 400, JSON.stringify({ error: 'dialect and url are required' }))
        return
      }
      let execute
      try {
        execute = await connect(dialect, url)
      } catch (err) {
        // Missing driver / bad connection string - report it, don't crash. When
        // the driver is simply absent, flag it so the UI can offer to install it.
        const msg = err instanceof Error ? err.message : String(err)
        const driver = DRIVER_FOR[dialect]
        const missingDriver = /cannot find|module not found|err_module/i.test(msg) && !isDriverInstalled(dialect, process.cwd())
        const hint = missingDriver ? ` Install the "${driver}" driver in this project (npm i ${driver}).` : ''
        send(res, 502, JSON.stringify({ error: `Could not connect: ${msg}.${hint}`, missingDriver, driver }))
        return
      }
      if (action === 'test') {
        // "Test connection": prove connectivity + show real row counts per table.
        try {
          const probe = await probeConnection(dialect, execute, { counts: true })
          send(res, 200, JSON.stringify(probe))
        } catch (err) {
          send(res, 502, JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
        }
        return
      }
      if (action === 'introspect') {
        const tables = Array.isArray(reqBody.tables) ? reqBody.tables : []
        const schemas: EntitySchema[] = []
        const errors: { table: string; message: string }[] = []
        // Resilient per table: one bad table (odd type, permissions) shouldn't
        // sink the whole import - collect what worked and report the rest.
        for (const table of tables) {
          try {
            schemas.push(await introspectDatabase({ dialect, table, execute }))
          } catch (err) {
            errors.push({ table, message: err instanceof Error ? err.message : String(err) })
          }
        }
        // Resolve each relation's label field against the other picked tables.
        send(res, 200, JSON.stringify({ schemas: linkRelationLabels(schemas), errors }))
        return
      }
      // Default: list the tables so the wizard can offer a pick list.
      const tables = await listDatabaseTables(dialect, execute)
      send(res, 200, JSON.stringify({ tables }))
      return
    }

    if (path.startsWith('/api/')) {
      send(res, 404, JSON.stringify({ error: 'not found' }))
      return
    }

    serveStatic(res, dir, url)
  }

  const url = `http://localhost:${opts.port}`
  await new Promise<void>((ready, fail) => {
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        fail(new Error(`Port ${opts.port} is already in use. Pick another with --port <n>.`))
      } else {
        fail(err)
      }
    })
    server.listen(opts.port, () => ready())
  })

  if (opts.template && !getSampleApp(opts.template)) {
    const { sampleApps } = await import('@svgrid/enterprise/studio')
    log(`  (unknown --template "${opts.template}"; try: ${sampleApps.map((s) => s.id).join(', ')})`)
  }
  log(`\n  SvGrid Studio designer running at ${url}`)
  log(`  config:  ${configPath}`)
  log(`  output:  ${outDir}`)
  if (copilotOn) log(`  copilot: ON (Anthropic)`)
  else if (opts.ai) log(`  copilot: OFF - --ai was passed but ANTHROPIC_API_KEY is not set`)
  log(`  (edits auto-save; "Save to folder" writes the app. Ctrl+C to stop.)\n`)
  if (opts.open) openBrowser(url)

  return { url, close: () => server.close() }
}
