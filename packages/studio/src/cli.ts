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
import { createInterface } from 'node:readline/promises'
import { dirname, resolve } from 'node:path'
import {
  buildStudioBugReport,
  createProject,
  deployCommands,
  emitStudioAppBundle,
  emitStudioFragment,
  introspectDatabase,
  introspectOpenApi,
  runtimeDeps,
  listDatabaseTables,
  missingEnvKeys,
  parseProject,
  resolveDeployTarget,
  resolveSchemas,
  runStudioAdd,
  runStudioAddApp,
  runStudioInit,
  serializeProject,
  setEntityDataSource,
  summarizeVerify,
  type EntitySchema,
  type InitFlags,
  type PromptIO,
  type SqlDialectName,
  type StudioIO,
  type StudioProject,
} from '@svgrid/enterprise/studio'
import { connect } from './db-connect.js'
import { ensureDriverInstalled } from './driver-install.js'
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
  fragment?: boolean
  // `init` command:
  dataset?: string
  theme?: string
  dark?: boolean
  title?: string
  yes?: boolean
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
    else if (a === '--fragment') out.fragment = true
    else if (a === '--dataset') out.dataset = args[++i]
    else if (a === '--theme') out.theme = args[++i]
    else if (a === '--dark') out.dark = true
    else if (a === '--title') out.title = args[++i]
    else if (a === '-y' || a === '--yes') out.yes = true
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
  svgrid-studio init                                # guided: pick your data, get a working CRUD app
  svgrid-studio designer                            # open the visual designer in your browser
  svgrid-studio add <name> --from <schema>          # one table/model from a schema file
  svgrid-studio add --all   --from <schema>         # every table/model, linked
  svgrid-studio add <name> --db <dialect> --url <conn>   # one table from a live database
  svgrid-studio add --all   --db <dialect> --url <conn>  # every table from a live database
  svgrid-studio openapi <file|url>                   # import an OpenAPI (JSON) spec -> studio.config.json
  svgrid-studio eject [--fragment]                  # write the app (or a drop-in fragment) from studio.config.json
  svgrid-studio dev                                 # designer + the RUNNING app, side by side (HMR)
  svgrid-studio deploy [--target <provider>] [--dry-run]  # build + deploy via the provider CLI

Guided setup (init) - asks where your data lives, which tables you want, and
which pages each gets, then writes a runnable app + studio.config.json.
Running \`svgrid-studio\` with no arguments starts it too.
  --db <dialect> --url <conn>   skip the questions and read a live database
  --dataset <id>   start from sample data (customers-orders, products-categories,
                   projects-tasks, employees-departments, tickets-accounts)
  --title <name>   app name
  --out <dir>      folder to write the app into (default: .)
  --theme <id>     design-system preset      --dark   dark mode
  -y, --yes        take every default, ask nothing

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
  svgrid-studio init
  svgrid-studio init --db postgres --url $DATABASE_URL --out my-app
  svgrid-studio add customers --from src/lib/db/schema.ts
  svgrid-studio add --all     --from prisma/schema.prisma
  svgrid-studio add customers --db postgres --url $DATABASE_URL --sql
  svgrid-studio add --all     --db supabase --url $DATABASE_URL
`

/**
 * Terminal prompts for the guided `init`.
 *
 * Lines are queued from a listener attached up front rather than read one at a
 * time with `rl.question()`: on a pipe or a redirected file, readline delivers
 * the whole buffer at once, and anything arriving before the next question is
 * asked would simply be dropped. Once input runs out we answer with each
 * question's default, so a scripted run finishes instead of hanging.
 */
function terminalPrompts(): PromptIO & { close: () => void } {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const waiting: ((line: string | null) => void)[] = []
  const buffered: string[] = []
  let ended = false

  rl.on('line', (line) => {
    const next = waiting.shift()
    if (next) next(line)
    else buffered.push(line)
  })
  rl.on('close', () => {
    ended = true
    for (const resolve of waiting.splice(0)) resolve(null)
  })

  const nextLine = (): Promise<string | null> => {
    if (buffered.length) return Promise.resolve(buffered.shift()!)
    if (ended) return Promise.resolve(null)
    return new Promise((resolve) => waiting.push(resolve))
  }

  return {
    ask: async (question, def) => {
      process.stdout.write(`${question}${def ? ` (${def})` : ''} `)
      const line = await nextLine()
      if (line === null) {
        process.stdout.write(`${def ?? ''}\n`) // echo the default we fell back to
        return def ?? ''
      }
      return line.trim() || def || ''
    },
    say: (line) => process.stdout.write(line + '\n'),
    close: () => rl.close(),
  }
}

/** Read an OpenAPI spec / REST response from a URL or a local file. */
const fetchText = async (source: string): Promise<string> =>
  /^https?:\/\//.test(source) ? (await fetch(source)).text() : readFile(source, 'utf8')

/** The guided "build me a CRUD app" flow. */
async function runInit(flags: InitFlags): Promise<void> {
  const prompts = terminalPrompts()
  try {
    const result = await runStudioInit(flags, prompts, {
      ensureDriver: (dialect) => ensureDriverInstalled(dialect, process.cwd(), prompts.say),
      connect: (dialect, url) => connect(dialect, url),
    }, io, fetchText)
    process.stdout.write('\nNext:\n')
    for (const stepLine of result.nextSteps) process.stdout.write(`  ${stepLine}\n`)
  } finally {
    prompts.close()
  }
}

function report(name: string, written: string[], verifyLine: string): void {
  process.stdout.write(`Scaffolded "${name}":\n`)
  for (const path of written) process.stdout.write(`  + ${path}\n`)
  process.stdout.write(`  ${verifyLine}\n`)
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2)
  const opts = parse(rest)

  // --- guided setup: the few-clicks path from nothing to a CRUD app ---------
  // Bare `svgrid-studio` in a terminal starts here too: with no argument, the
  // most useful thing we can do is walk the user through building an app.
  if ((cmd === 'init' || (!cmd && process.stdin.isTTY)) && !opts.help) {
    await runInit({
      ...(opts.outDir ? { out: opts.outDir } : {}),
      ...(opts.db ? { db: opts.db } : {}),
      ...(opts.url ? { url: opts.url } : {}),
      ...(opts.dataset ? { dataset: opts.dataset } : {}),
      ...(opts.theme ? { theme: opts.theme } : {}),
      ...(opts.dark ? { dark: true } : {}),
      ...(opts.title ? { title: opts.title } : {}),
      ...(opts.yes ? { yes: true } : {}),
    })
    return
  }

  // --- eject: write the app (or a fragment) from studio.config.json ---------
  if (cmd === 'eject' && !opts.help) {
    const configPath = opts.config ?? 'studio.config.json'
    const json = await io.readFile(configPath)
    if (json == null) {
      process.stderr.write(`eject: ${configPath} not found - run \`svgrid-studio designer\` first, or pass --config.\n`)
      process.exit(1)
    }
    const project = parseProject(json)
    const outDir = opts.outDir ?? '.'
    const files = opts.fragment ? emitStudioFragment(project) : emitStudioAppBundle(project)
    for (const f of files) {
      const full = resolve(outDir, f.path)
      await mkdir(dirname(full), { recursive: true })
      await writeFile(full, f.contents)
    }
    process.stdout.write(`Wrote ${files.length} ${opts.fragment ? 'fragment' : 'app'} file(s) -> ${resolve(outDir)}\n`)
    if (opts.fragment) {
      const deps = runtimeDeps(project, files.map((f) => f.contents).join('\n'))
      const install = Object.keys(deps).filter((d) => d !== '@svgrid/grid' && d !== '@svgrid/enterprise')
      process.stdout.write(`Fragment: merge src/routes + src/lib into your app, import src/app.css, then:\n  npm install ${install.join(' ') || '@svgrid/grid @svgrid/enterprise'}\nSee FRAGMENT.md for the full runbook.\n`)
    }
    return
  }

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
    const driver = await ensureDriverInstalled(opts.db, cwd, (l) => process.stdout.write(l + '\n'))
    if (!driver.ok) {
      process.stderr.write(`svgrid-studio: ${driver.message}\n`)
      process.exit(1)
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
