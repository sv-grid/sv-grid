#!/usr/bin/env node
/**
 * SvGrid Studio CLI. Scaffold a full CRUD screen from a Drizzle schema in one
 * command - the "CRUD app in seconds" entry point.
 *
 *   npx @svgrid/studio add customers --from src/lib/db/schema.ts
 *   npx @svgrid/studio add orders    --from src/lib/db/schema.ts --sql
 *
 * All the work (introspect -> scaffold -> merge-write -> verify) lives in the
 * tested `runStudioAdd` orchestrator; this file is just argument parsing plus
 * the node:fs wiring.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import {
  buildStudioBugReport,
  createProject,
  deployCommands,
  introspectDatabase,
  introspectOpenApi,
  listDatabaseTables,
  missingEnvKeys,
  parseProject,
  resolveDeployTarget,
  resolveSchemas,
  runStudioAdd,
  runStudioAddApp,
  serializeProject,
  setEntityDataSource,
  summarizeVerify,
  type EntitySchema,
  type SqlDialectName,
  type StudioIO,
  type StudioProject,
} from '@svgrid/enterprise/studio'
import { connect } from './db-connect.js'
import { DRIVER_FOR, installDriver, isDriverInstalled } from './driver-install.js'
import { startDesignerServer } from './designer-server.js'
import { ensureApp, startAppServer, type AppServer } from './dev.js'

const io: StudioIO = {
  readFile: async (path) => {
    try {
      return await readFile(path, 'utf8')
    } catch {
      return null
    }
  },
  writeFile: async (path, contents) => {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, contents)
  },
}

type Parsed = {
  route?: string
  table?: string
  from?: string
  apiRoute?: string
  dataSource?: 'memory' | 'sql'
  db?: SqlDialectName
  url?: string
  all?: boolean
  help?: boolean
  // `designer` command:
  config?: string
  outDir?: string
  port?: number
  noOpen?: boolean
  template?: string
  target?: string
  dryRun?: boolean
  ai?: boolean
  appPort?: number
}

function parse(args: string[]): Parsed {
  const out: Parsed = {}
  const positional: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (a === '--from') out.from = args[++i]
    else if (a === '--table') out.table = args[++i]
    else if (a === '--route') out.route = args[++i]
    else if (a === '--api') out.apiRoute = args[++i]
    else if (a === '--sql') out.dataSource = 'sql'
    else if (a === '--db') out.db = args[++i] as SqlDialectName
    else if (a === '--url') out.url = args[++i]
    else if (a === '--all') out.all = true
    else if (a === '--config') out.config = args[++i]
    else if (a === '--out') out.outDir = args[++i]
    else if (a === '--port') out.port = Number(args[++i])
    else if (a === '--template') out.template = args[++i]
    else if (a === '--no-open') out.noOpen = true
    else if (a === '--target') out.target = args[++i]
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--ai') out.ai = true
    else if (a === '--app-port') out.appPort = Number(args[++i])
    else if (a === '-h' || a === '--help') out.help = true
    else if (!a.startsWith('-')) positional.push(a)
  }
  const name = positional[0]
  if (name && !out.route) out.route = name
  if (name && !out.table) out.table = name
  return out
}

const HELP = `svgrid-studio - scaffold CRUD screens from a schema file or a live database

Usage:
  svgrid-studio designer                            # open the visual designer in your browser
  svgrid-studio add <name> --from <schema>          # one table/model from a schema file
  svgrid-studio add --all   --from <schema>         # every table/model, linked
  svgrid-studio add <name> --db <dialect> --url <conn>   # one table from a live database
  svgrid-studio add --all   --db <dialect> --url <conn>  # every table from a live database
  svgrid-studio openapi <file|url>                   # import an OpenAPI (JSON) spec -> studio.config.json
  svgrid-studio dev                                 # designer + the RUNNING app, side by side (HMR)
  svgrid-studio deploy [--target <provider>] [--dry-run]  # build + deploy via the provider CLI

Deploy (build first, then the provider CLI; target from --target, else
studio.config.json, else the adapter in svelte.config.js):
  --target <p>     vercel | netlify | cloudflare | node
  --dry-run        print the resolved commands without running anything

Designer (visual app builder, auto-saves to studio.config.json):
  --template <id>  open a ready-made sample app (crm | ecommerce | projects | support)
  --config <path>  studio.config.json to load + auto-save (default: ./studio.config.json)
  --out <dir>      folder to write the generated app into (default: .)
  --port <n>       port to serve on (default: 4321)
  --no-open        don't open the browser
  --ai             enable the AI copilot (needs ANTHROPIC_API_KEY in the environment)
  --app-port <n>   dev: port for the generated app's dev server (default: designer port + 1)

Schema files: a Drizzle schema.ts or a Prisma schema.prisma (auto-detected).
  Foreign keys become searchable relation lookups; enums become select fields.

Databases: postgres | supabase | mysql | mssql | sqlite
  (the matching driver - pg / mysql2 / mssql / better-sqlite3 - must be installed)

Options:
  --from <path>    Drizzle (.ts) or Prisma (.prisma) schema file to introspect
  --db <dialect>   Connect to a live database and read its catalog
  --url <conn>     Connection string / file path for --db
  --all            Scaffold a screen for every table/model (+ nav & home)
  --table <name>   Which table/model to use (defaults to <name>)
  --sql            Wire a real SQL data source (default with --db)
  --route <seg>    Route segment (default: <name> / table name)
  --api <path>     API route path (default: /api/<route>)
  -h, --help       Show this help

Examples:
  svgrid-studio add customers --from src/lib/db/schema.ts
  svgrid-studio add --all     --from prisma/schema.prisma
  svgrid-studio add customers --db postgres --url $DATABASE_URL --sql
  svgrid-studio add --all     --db supabase --url $DATABASE_URL
`

function report(name: string, written: string[], verifyLine: string): void {
  process.stdout.write(`Scaffolded "${name}":\n`)
  for (const path of written) process.stdout.write(`  + ${path}\n`)
  process.stdout.write(`  ${verifyLine}\n`)
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2)
  const opts = parse(rest)

  // --- import an OpenAPI spec into a studio.config.json ---------------------
  if (cmd === 'openapi' && !opts.help) {
    const src = opts.from ?? rest.find((a) => !a.startsWith('-'))
    if (!src) {
      process.stderr.write('openapi: pass a spec - `svgrid-studio openapi ./openapi.json` (or a URL)\n')
      process.exit(1)
    }
    const text = /^https?:\/\//.test(src) ? await (await fetch(src)).text() : await readFile(src, 'utf8')
    const { entities, sources, warnings } = introspectOpenApi(text)
    let project = createProject(entities, { title: 'API app' })
    for (const [name, source] of Object.entries(sources)) project = setEntityDataSource(project, name, source)
    const outPath = opts.config ?? 'studio.config.json'
    await writeFile(outPath, serializeProject(project))
    process.stdout.write(`Imported ${entities.length} REST resource(s) -> ${outPath}\n`)
    for (const w of warnings) process.stdout.write(`  ! ${w}\n`)
    process.stdout.write(`Next: svgrid-studio designer   (open it visually)  or  svgrid-studio dev\n`)
    return
  }

  // --- live dev loop: designer + the real app, side by side ----------------
  if (cmd === 'dev' && !opts.help) {
    const configPath = opts.config ?? 'studio.config.json'
    const outDir = opts.outDir ?? '.'
    const port = Number.isFinite(opts.port) ? (opts.port as number) : 4321
    const appPort = Number.isFinite(opts.appPort) ? (opts.appPort as number) : port + 1
    const log = (l: string) => process.stdout.write(l + '\n')

    const hasApp = await ensureApp(resolve(outDir), resolve(configPath), log)
    let app: AppServer | null = null
    if (hasApp) {
      app = await startAppServer({ outDir, port: appPort, log })
      log(`\n  app:      ${app.url} (Vite dev server - designer saves hot-reload it)`)
    } else {
      log(`\n  No app here yet - design something and hit "Save to folder"; the app server starts on the first save.`)
    }
    process.on('SIGINT', () => {
      app?.stop()
      process.exit(0)
    })
    await startDesignerServer({
      configPath,
      outDir,
      port,
      open: !opts.noOpen,
      template: opts.template,
      ai: !!opts.ai,
      appUrl: app?.url,
      onGenerated: async () => {
        if (app) await app.syncDeps()
        else {
          app = await startAppServer({ outDir, port: appPort, log })
          log(`  app:      ${app.url} (started after first save)`)
        }
      },
    })
    return
  }

  // --- visual designer -----------------------------------------------------
  if (cmd === 'designer' && !opts.help) {
    await startDesignerServer({
      configPath: opts.config ?? 'studio.config.json',
      outDir: opts.outDir ?? '.',
      port: Number.isFinite(opts.port) ? (opts.port as number) : 4321,
      open: !opts.noOpen,
      template: opts.template,
      ai: !!opts.ai,
    })
    // Keep the process alive; the server holds the event loop until Ctrl+C.
    return
  }

  // --- deploy --------------------------------------------------------------
  if (cmd === 'deploy' && !opts.help) {
    const read = (p: string) => io.readFile(p)
    const resolution = resolveDeployTarget({
      flag: opts.target,
      configJson: await read('studio.config.json'),
      svelteConfig: (await read('svelte.config.js')) ?? (await read('svelte.config.ts')),
    })
    if (!resolution.ok) {
      process.stderr.write(`deploy: ${resolution.reason}\n`)
      process.exit(1)
    }
    const plan = deployCommands(resolution.provider)
    process.stdout.write(`Deploying to ${plan.provider} (from ${resolution.source === 'flag' ? '--target' : resolution.source === 'config' ? 'studio.config.json' : 'svelte.config.js adapter'}).\n`)
    // Preflight: env keys the app declares but the local .env doesn't set.
    const missing = missingEnvKeys(await read('.env.example'), await read('.env'))
    if (missing.length) process.stdout.write(`! Unset env keys (set them on the host too): ${missing.join(', ')}\n`)
    for (const note of plan.notes) process.stdout.write(`  ${note}\n`)
    const commands = [plan.build, ...(plan.deploy ? [plan.deploy] : [])]
    if (opts.dryRun) {
      process.stdout.write(commands.map((c) => `> ${c}\n`).join(''))
      return
    }
    for (const command of commands) {
      process.stdout.write(`\n> ${command}\n`)
      const res = spawnSync(command, { stdio: 'inherit', shell: true })
      if (res.status !== 0) {
        if (command !== plan.build) {
          process.stderr.write(`deploy: "${command}" failed. If the provider CLI isn't set up yet, log in first (see the note above) and re-run.\n`)
        }
        process.exit(res.status ?? 1)
      }
    }
    return
  }

  if (cmd !== 'add' || opts.help) {
    process.stdout.write(HELP)
    process.exit(opts.help || !cmd ? 0 : 1)
  }

  // --- live database -------------------------------------------------------
  if (opts.db) {
    if (!opts.url) {
      process.stderr.write('svgrid-studio: --url is required with --db\n\n' + HELP)
      process.exit(1)
    }
    // Studio detects the project's package manager and installs the driver for
    // the user - they never need to know `pg`/`mysql2`/etc. must be present
    // before --db works (mirrors the designer's "Install driver" flow).
    const cwd = process.cwd()
    if (!isDriverInstalled(opts.db, cwd)) {
      const driver = DRIVER_FOR[opts.db]
      process.stdout.write(`Installing ${driver} (required for --db ${opts.db})...\n`)
      const result = await installDriver(opts.db, cwd)
      if (!result.ok) {
        process.stderr.write(
          `svgrid-studio: could not install "${driver}" automatically.\n${result.output}\n` +
            `Run \`${result.manager} install ${driver}\` yourself and try again.\n`,
        )
        process.exit(1)
      }
      process.stdout.write(`Installed ${driver}.\n`)

      // The install child process can report success before the new module is
      // reliably resolvable (seen on Windows - antivirus/file-sync tools can
      // briefly hold the just-written files). Poll rather than racing straight
      // into connect(), which would resolve the driver too early and crash.
      const deadline = Date.now() + 5000
      while (!isDriverInstalled(opts.db, cwd) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 200))
      }
      if (!isDriverInstalled(opts.db, cwd)) {
        process.stderr.write(
          `svgrid-studio: installed "${driver}" but it's still not resolvable from this directory.\n` +
            `Something (antivirus, a file-sync tool) may be holding a lock on the new files. Try running the command again.\n`,
        )
        process.exit(1)
      }
    }

    const execute = await connect(opts.db, opts.url)
    // A dialect dataSource emits a fully-connected +server.ts (driver + DATABASE_URL);
    // --sql keeps the generic execute() stub instead.
    const ds = opts.dataSource === 'sql' ? 'sql' : opts.db

    if (opts.all) {
      // Whole app: every table + a nav layout and home page.
      const tables = await listDatabaseTables(opts.db, execute)
      if (tables.length === 0) {
        process.stderr.write('svgrid-studio: no tables found\n')
        process.exit(1)
      }
      const schemas: EntitySchema[] = []
      for (const table of tables) {
        schemas.push(await introspectDatabase({ dialect: opts.db, table, execute }))
      }
      const res = await runStudioAddApp(schemas, { dataSource: ds }, io)
      report(`app (${schemas.length} entities)`, res.written, summarizeVerify(res.verify))
      process.stdout.write(`\nRun \`npm run dev\` and open /\n`)
      return
    }

    const table = opts.table ?? opts.route!
    const schema = await introspectDatabase({ dialect: opts.db, table, execute })
    const res = await runStudioAdd({ schema, route: opts.route ?? table, dataSource: ds }, io)
    report(table, res.written, summarizeVerify(res.verify))
    process.stdout.write(`\nRun \`npm run dev\` and open /${opts.route ?? table}\n`)
    return
  }

  // --- schema file (Drizzle or Prisma) -------------------------------------
  if (!opts.from) {
    process.stderr.write('svgrid-studio: pass --from <schema.ts|schema.prisma> or --db <dialect> --url <conn>\n\n' + HELP)
    process.exit(1)
  }

  if (opts.all) {
    // Whole app from every table/model in the file, linked by foreign keys.
    const schemas = await resolveSchemas(opts.from, io)
    if (schemas.length === 0) {
      process.stderr.write('svgrid-studio: no tables/models found in ' + opts.from + '\n')
      process.exit(1)
    }
    const res = await runStudioAddApp(schemas, { dataSource: opts.dataSource }, io)
    report(`app (${schemas.length} entities)`, res.written, summarizeVerify(res.verify))
    process.stdout.write(`\nRun \`npm run dev\` and open /\n`)
    return
  }

  const result = await runStudioAdd(
    { from: opts.from, table: opts.table, route: opts.route, apiRoute: opts.apiRoute, dataSource: opts.dataSource },
    io,
  )
  report(result.schema.name, result.written, summarizeVerify(result.verify))
  process.stdout.write(`\nRun \`npm run dev\` and open /${opts.route ?? result.schema.name}\n`)
}

/** Best-effort: read the CLI's own version from its package.json. */
async function cliVersion(): Promise<string> {
  try {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version?: string }
    return pkg.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * On an uncaught crash, write a SANITIZED bug report (studio.config.json from
 * cwd is attached with credentials + seed data stripped) and print a prefilled
 * GitHub issue link. Reporting must never mask the original error.
 */
async function writeCrashReport(err: unknown): Promise<void> {
  let project: StudioProject | undefined
  try {
    project = parseProject(await readFile('studio.config.json', 'utf8'))
  } catch {
    /* no config in cwd - a plain crash report */
  }
  const report = buildStudioBugReport({
    project,
    error: err instanceof Error ? err : { message: String(err) },
    action: `svgrid-studio ${process.argv.slice(2).join(' ')}`.trim(),
    env: { studioVersion: await cliVersion(), node: process.version, os: process.platform },
  })
  await writeFile('svgrid-studio-report.md', report.markdown, 'utf8')
  const removed = report.redactions.length ? ` (${report.redactions.length} secret/data item(s) removed)` : ''
  process.stderr.write(
    `\nThat looks like a bug. A sanitized report was written to svgrid-studio-report.md${removed}.\n` +
      `Report it (opens a prefilled GitHub issue):\n${report.issueUrl}\n`,
  )
}

main().catch(async (err: unknown) => {
  process.stderr.write(`svgrid-studio: ${err instanceof Error ? err.message : String(err)}\n`)
  try {
    await writeCrashReport(err)
  } catch {
    /* never let reporting swallow the real failure */
  }
  process.exit(1)
})
