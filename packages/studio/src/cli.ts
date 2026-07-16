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
import { dirname } from 'node:path'
import {
  introspectDatabase,
  listDatabaseTables,
  resolveSchemas,
  runStudioAdd,
  runStudioAddApp,
  summarizeVerify,
  type EntitySchema,
  type SqlDialectName,
  type StudioIO,
} from '@svgrid/enterprise/studio'
import { connect } from './db-connect.js'
import { startDesignerServer } from './designer-server.js'

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

Designer (visual app builder, auto-saves to studio.config.json):
  --template <id>  open a ready-made sample app (crm | ecommerce | projects | support)
  --config <path>  studio.config.json to load + auto-save (default: ./studio.config.json)
  --out <dir>      folder to write the generated app into (default: .)
  --port <n>       port to serve on (default: 4321)
  --no-open        don't open the browser

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

  // --- visual designer -----------------------------------------------------
  if (cmd === 'designer' && !opts.help) {
    await startDesignerServer({
      configPath: opts.config ?? 'studio.config.json',
      outDir: opts.outDir ?? '.',
      port: Number.isFinite(opts.port) ? (opts.port as number) : 4321,
      open: !opts.noOpen,
      template: opts.template,
    })
    // Keep the process alive; the server holds the event loop until Ctrl+C.
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

main().catch((err: unknown) => {
  process.stderr.write(`svgrid-studio: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
