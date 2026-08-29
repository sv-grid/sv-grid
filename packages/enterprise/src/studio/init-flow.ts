/**
 * runStudioInit - the guided "build a CRUD app" flow behind `svgrid-studio init`.
 *
 * Asks a handful of questions (where the data lives, which tables, which pages,
 * what it looks like), then builds a project with `crudAppFromSchemas` - the same
 * generator the designer's "New app" wizard uses - and writes a runnable app plus
 * its `studio.config.json`.
 *
 * Prompts, the filesystem, and the database are all injected, so the orchestration
 * is pure and unit-testable and this file stays node-free (no process / fs / driver
 * imports). The CLI bin supplies readline, node:fs, and the DB drivers.
 */
import type { EntitySchema } from '../schema.js'
import type { StudioIO } from './cli.js'
import { crudAppFromSchemas, type CrudEditingMode, type CrudScreenKind, type CrudSuiteOptions } from './screen-suites.js'
import { starterDatasets, getStarterDataset } from './samples/datasets.js'
import { introspectDatabase, listDatabaseTables, countTableRows, type DbExecute, type SqlDialectName } from './introspect-db.js'
import { introspectOpenApi } from './introspect-openapi.js'
import { introspectJson } from './introspect.js'
import { introspectSupabaseTable, listSupabaseTables } from '../sources/introspect-supabase.js'
import { buildConnectionString, isFileDialect, type SqlConnectionParts } from './db-connect-string.js'
import { emitStudioAppBundle } from './emit-project.js'
import { mergeManaged, skipUserOwned } from './scaffold.js'
import { getStudioTheme, studioThemes } from './themes.js'
import { UserError } from './user-error.js'
import { serializeProject, type DataSourceKind, type EntityDataSource, type ProjectTheme, type StudioProject } from './project.js'

/** Terminal I/O, injected so the flow can be scripted in tests. */
export type PromptIO = {
  /** Ask a question; `def` is used when the user just hits Enter. */
  ask: (question: string, def?: string) => Promise<string>
  /** Print a line (progress, headings, results). */
  say: (line: string) => void
}

/** Live-database access, injected by the bin (drivers are node-only). */
export type DbGateway = {
  /** Make sure the dialect's driver is installed; report why not if it isn't. */
  ensureDriver: (dialect: SqlDialectName) => Promise<{ ok: boolean; message?: string }>
  connect: (dialect: SqlDialectName, url: string) => Promise<DbExecute>
}

/** Read a REST endpoint or an OpenAPI document (injected: the bin uses fetch/fs). */
export type FetchText = (source: string) => Promise<string>

export type InitFlags = {
  /** Where to write the app. Default `.`. */
  out?: string
  /** Skip the source question and go straight to a live database. */
  db?: SqlDialectName
  /** Connection string for `db`. */
  url?: string
  /** Supabase project URL - skips the source question and both prompts. */
  supabaseUrl?: string
  /** Supabase anon key. */
  supabaseKey?: string
  /** Pick a starter dataset by id, skipping the source question. */
  dataset?: string
  /** Theme preset id. */
  theme?: string
  dark?: boolean
  /** App title (skips the question). */
  title?: string
  /** Take every default; ask nothing that has one. */
  yes?: boolean
  /** Write into a folder that already holds another app, without asking. */
  force?: boolean
}

export type InitResult = {
  project: StudioProject
  /** Paths written, in order. */
  written: string[]
  /** What to tell the user to do next. */
  nextSteps: string[]
}

const SOURCES = [
  { key: 'sample', label: 'Sample data', hint: 'a seeded pair of related tables - see a working app immediately' },
  { key: 'db', label: 'An existing database', hint: 'Postgres, MySQL, SQL Server or SQLite - reads your tables' },
  { key: 'supabase', label: 'Supabase', hint: 'project URL + anon key, read over the REST API - no driver needed' },
  { key: 'pglite', label: 'Local Postgres in the browser (PGlite)', hint: 'real SQL, persists, no server to set up' },
  { key: 'rest', label: 'A REST API or OpenAPI spec', hint: 'infers the tables from the endpoint' },
] as const
type SourceKey = (typeof SOURCES)[number]['key']

const DIALECTS: SqlDialectName[] = ['postgres', 'supabase', 'mysql', 'mssql', 'sqlite']

/** Shown above the connection prompt so the expected shape is never a guess. */
const CONNECTION_EXAMPLES: Record<string, string> = {
  postgres: 'postgres://user:password@localhost:5432/mydb',
  supabase: 'postgres://postgres:password@db.abcdefgh.supabase.co:5432/postgres',
  mysql: 'mysql://user:password@localhost:3306/mydb',
  mssql: 'Server=localhost,1433;Database=mydb;User Id=sa;Password=secret;Encrypt=false',
  sqlite: './data.db',
}

/**
 * Files that mean the target folder already holds an app. Writing the bundle
 * over one of these replaces it wholesale (they carry no managed markers), so
 * the flow stops and asks first. A `studio.config.json` is the exception: that
 * folder IS a Studio app, and re-running init there is a regenerate.
 */
const CLOBBER_MARKERS = [
  'package.json',
  'svelte.config.js',
  'svelte.config.ts',
  'vite.config.ts',
  'src/routes/+layout.svelte',
  '.env',
]

/** Ask a numbered-list question; returns the chosen index. */
async function pick(prompts: PromptIO, heading: string, items: { label: string; hint?: string }[], def = 1): Promise<number> {
  prompts.say('')
  prompts.say(heading)
  items.forEach((item, i) => prompts.say(`  ${i + 1}. ${item.label}${item.hint ? ` - ${item.hint}` : ''}`))
  const answer = (await prompts.ask('Pick a number:', String(def))).trim()
  const n = Number(answer)
  return Number.isFinite(n) && n >= 1 && n <= items.length ? n - 1 : def - 1
}

const isYes = (answer: string, def: boolean): boolean => {
  const a = answer.trim().toLowerCase()
  if (!a) return def
  return a === 'y' || a === 'yes'
}

/** Parse "all", "none", a comma list of names, or a list of 1-based numbers. */
export function parseSelection(answer: string, items: string[]): string[] {
  const raw = answer.trim()
  if (!raw || raw.toLowerCase() === 'all' || raw === '*') return items
  if (raw.toLowerCase() === 'none') return []
  const picked: string[] = []
  for (const part of raw.split(',').map((p) => p.trim()).filter(Boolean)) {
    const n = Number(part)
    if (Number.isFinite(n) && n >= 1 && n <= items.length) {
      const item = items[n - 1]!
      if (!picked.includes(item)) picked.push(item)
      continue
    }
    const match = items.find((i) => i.toLowerCase() === part.toLowerCase())
    if (match && !picked.includes(match)) picked.push(match)
  }
  return picked
}

/** The rows of a REST response: a bare array, or the usual wrapper key. */
function unwrapRows(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[]
  if (body && typeof body === 'object') {
    for (const key of ['data', 'items', 'results', 'rows', 'records']) {
      const v = (body as Record<string, unknown>)[key]
      if (Array.isArray(v)) return v as Record<string, unknown>[]
    }
    return [body as Record<string, unknown>]
  }
  return []
}

type Gathered = {
  schemas: EntitySchema[]
  sources: Record<string, EntityDataSource>
  seed: Record<string, Record<string, unknown>[]>
  kind: DataSourceKind
  title?: string
}

/** Step 1-2: where does the data come from, and what tables does it have? */
async function gatherData(flags: InitFlags, prompts: PromptIO, db: DbGateway | null, fetchText: FetchText | null): Promise<Gathered> {
  let source: SourceKey = 'sample'
  if (flags.db) source = 'db'
  else if (flags.supabaseUrl) source = 'supabase'
  else if (flags.dataset) source = 'sample'
  else if (!flags.yes) source = SOURCES[await pick(prompts, 'Where should the app get its data?', [...SOURCES])]!.key

  if (source === 'db') return gatherFromDatabase(flags, prompts, db)
  if (source === 'supabase') return gatherFromSupabase(flags, prompts)
  if (source === 'rest') return gatherFromRest(prompts, fetchText)

  // Sample data, stored in memory or in PGlite.
  let datasetId = flags.dataset ?? starterDatasets[0]!.id
  if (!flags.dataset && !flags.yes) {
    const i = await pick(prompts, 'Pick a starter dataset:', starterDatasets.map((d) => ({ label: d.name, hint: d.description })))
    datasetId = starterDatasets[i]!.id
  }
  const dataset = getStarterDataset(datasetId)
  if (!dataset) {
    throw new UserError(
      `Unknown dataset "${datasetId}".`,
      `Try one of: ${starterDatasets.map((d) => d.id).join(', ')}`,
    )
  }
  const { entities, seed } = dataset.build()
  const kind: DataSourceKind = source === 'pglite' ? 'pglite' : 'memory'
  const sources: Record<string, EntityDataSource> = {}
  for (const e of entities) sources[e.name] = kind === 'pglite' ? { kind: 'pglite', table: e.name } : { kind: 'memory' }
  prompts.say(`  Using ${dataset.name} (${entities.length} tables).`)
  return { schemas: entities, sources, seed, kind, title: dataset.name }
}

async function gatherFromDatabase(flags: InitFlags, prompts: PromptIO, db: DbGateway | null): Promise<Gathered> {
  if (!db) throw new UserError('Connecting to a database is not available here.')
  let dialect = flags.db
  if (!dialect) {
    const i = await pick(prompts, 'Which database?', DIALECTS.map((d) => ({ label: d })))
    dialect = DIALECTS[i]!
  }
  let url = flags.url ?? ''
  if (!url) {
    if (isFileDialect(dialect)) {
      url = (await prompts.ask('Database file:', './data.db')).trim()
    } else {
      // Show the shape of the answer: a bare "Connection string:" prompt is the
      // most common place a first run stalls.
      prompts.say('')
      prompts.say(`  Example: ${CONNECTION_EXAMPLES[dialect] ?? CONNECTION_EXAMPLES.postgres}`)
      const answer = (await prompts.ask('Connection string (blank to enter host/port instead):', '')).trim()
      url = answer || buildConnectionString(dialect, await askConnectionParts(prompts))
    }
  }
  if (!url) throw new UserError('A connection string is required.')

  const driver = await db.ensureDriver(dialect)
  if (!driver.ok) throw new UserError(driver.message ?? `Could not install the ${dialect} driver.`)

  prompts.say('  Connecting...')
  // A refused connection, a bad host, wrong credentials: the driver throws its
  // own message here. That is the user's connection string to fix, not a defect,
  // so keep the driver's wording but stop it looking like a crash.
  let execute: DbExecute
  let tables: string[]
  try {
    execute = await db.connect(dialect, url)
    tables = await listDatabaseTables(dialect, execute)
  } catch (e) {
    throw new UserError(
      `Could not read the database: ${e instanceof Error ? e.message : String(e)}`,
      `Check the connection string. Expected shape: ${CONNECTION_EXAMPLES[dialect] ?? CONNECTION_EXAMPLES.postgres}`,
    )
  }
  if (tables.length === 0) {
    throw new UserError(
      'Connected, but the database has no tables.',
      'Check that the connection string points at the right database and schema.',
    )
  }

  const counts = await countTableRows(dialect, execute, tables)
  prompts.say('')
  prompts.say(`Found ${tables.length} ${tables.length === 1 ? 'table' : 'tables'}:`)
  counts.forEach((t, i) => prompts.say(`  ${i + 1}. ${t.name}${t.rows == null ? '' : ` (${t.rows} rows)`}`))
  const answer = flags.yes ? 'all' : await prompts.ask('Which tables? (all, or a comma list of names/numbers)', 'all')
  const picked = parseSelection(answer, tables)
  if (picked.length === 0) throw new UserError('No tables picked - nothing to build.')

  const schemas: EntitySchema[] = []
  const sources: Record<string, EntityDataSource> = {}
  for (const table of picked) {
    try {
      const schema = await introspectDatabase({ dialect, table, execute })
      schemas.push(schema)
      sources[schema.name] = { kind: 'sql', table, dialect }
    } catch (e) {
      // One unreadable table must never sink the run.
      prompts.say(`  ! Skipped ${table}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (schemas.length === 0) throw new UserError('None of the picked tables could be read.')
  prompts.say(`  Read ${schemas.length} ${schemas.length === 1 ? 'table' : 'tables'}.`)
  return { schemas, sources, seed: {}, kind: 'sql' }
}

/**
 * Supabase reads over its own REST API, so this needs no driver and no
 * DbGateway - just the project URL and the anon key.
 */
async function gatherFromSupabase(flags: InitFlags, prompts: PromptIO): Promise<Gathered> {
  if (!flags.supabaseUrl || !flags.supabaseKey) {
    // The designer's wizard says where these live; the CLI used to leave people
    // hunting for them.
    prompts.say('')
    prompts.say("  Both are in your Supabase project's API settings (Project Settings -> API).")
    prompts.say('  The URL looks like https://abcdefgh.supabase.co')
  }
  const url = (flags.supabaseUrl ?? (await prompts.ask('Project URL:', ''))).trim()
  const key = (flags.supabaseKey ?? (await prompts.ask('Anon key:', ''))).trim()
  if (!url || !key) throw new UserError('Both the project URL and the anon key are required.')

  prompts.say('  Reading the API...')
  let tables: string[]
  try {
    tables = await listSupabaseTables(url, key)
  } catch (e) {
    throw new UserError(
      `Could not reach ${url}: ${e instanceof Error ? e.message : String(e)}`,
      "Check the project URL and anon key in Project Settings -> API.",
    )
  }
  let picked: string[]
  if (tables.length) {
    prompts.say('')
    prompts.say(`Found ${tables.length} ${tables.length === 1 ? 'table' : 'tables'}:`)
    tables.forEach((t, i) => prompts.say(`  ${i + 1}. ${t}`))
    const answer = flags.yes ? 'all' : await prompts.ask('Which tables? (all, or a comma list of names/numbers)', 'all')
    picked = parseSelection(answer, tables)
  } else {
    // The API doc is often CORS-blocked or restricted; naming the tables by hand
    // still works because each one is introspected individually.
    prompts.say("  Couldn't list the tables (the API doc may be restricted for this key).")
    const typed = await prompts.ask('Table names (comma separated):', '')
    picked = typed.split(',').map((t) => t.trim()).filter(Boolean)
  }
  if (picked.length === 0) throw new UserError('No tables picked - nothing to build.')

  const schemas: EntitySchema[] = []
  const sources: Record<string, EntityDataSource> = {}
  for (const table of picked) {
    const schema = await introspectSupabaseTable({ url, key, table })
    if (!schema?.fields.length) {
      prompts.say(`  ! Skipped ${table}: no columns could be read.`)
      continue
    }
    schemas.push(schema as EntitySchema)
    sources[schema.name] = { kind: 'supabase', table, url, key }
  }
  if (schemas.length === 0) throw new UserError('None of the picked tables could be read.')
  prompts.say(`  Read ${schemas.length} ${schemas.length === 1 ? 'table' : 'tables'}.`)
  return { schemas, sources, seed: {}, kind: 'supabase' }
}

async function askConnectionParts(prompts: PromptIO): Promise<SqlConnectionParts> {
  return {
    host: (await prompts.ask('Host:', 'localhost')).trim(),
    port: (await prompts.ask('Port:', '')).trim(),
    database: (await prompts.ask('Database:', 'app')).trim(),
    user: (await prompts.ask('User:', 'postgres')).trim(),
    password: (await prompts.ask('Password:', '')).trim(),
  }
}

async function gatherFromRest(prompts: PromptIO, fetchText: FetchText | null): Promise<Gathered> {
  if (!fetchText) throw new UserError('Reading a REST endpoint is not available here.')
  const src = (await prompts.ask('OpenAPI spec (file or URL), or a REST endpoint returning rows:', '')).trim()
  if (!src) throw new UserError('A spec path/URL or endpoint is required.')
  const text = await fetchText(src)

  // An OpenAPI document describes every resource; a plain endpoint gives one.
  if (/"(openapi|swagger|paths)"\s*:/.test(text)) {
    const { entities, sources, warnings } = introspectOpenApi(text)
    for (const w of warnings) prompts.say(`  ! ${w}`)
    if (entities.length === 0) throw new UserError('The spec described no collection resources.')
    prompts.say(`  Read ${entities.length} REST ${entities.length === 1 ? 'resource' : 'resources'}.`)
    return { schemas: entities, sources, seed: {}, kind: 'rest' }
  }

  let rows: Record<string, unknown>[]
  try {
    rows = unwrapRows(JSON.parse(text) as unknown)
  } catch {
    throw new UserError(
      `${src} did not return JSON.`,
      'Point this at an endpoint that returns rows, or at an OpenAPI (JSON) document.',
    )
  }
  if (rows.length === 0) throw new UserError('The endpoint returned no rows to read a shape from.')
  // A local file path or a bare hostname reaches this line too; `new URL` would
  // throw a raw "Invalid URL" that reads like a crash.
  let url: URL
  try {
    url = new URL(src)
  } catch {
    throw new UserError(
      `"${src}" is not a full URL, so there is no endpoint to call at runtime.`,
      'Pass the absolute endpoint, for example https://api.example.com/widgets',
    )
  }
  const path = url.pathname.replace(/^\/+|\/+$/g, '')
  const suggested = path.split('/').filter(Boolean).pop() || 'items'
  const name = ((await prompts.ask('Table name:', suggested)).trim() || suggested).replace(/\W+/g, '_')
  const schema = introspectJson(name, rows)
  prompts.say(`  Read ${schema.fields.length} fields from ${rows.length} rows.`)
  return {
    schemas: [schema],
    sources: { [name]: { kind: 'rest', baseUrl: url.origin, path, method: 'GET', params: [] } },
    seed: {},
    kind: 'rest',
  }
}

/** Step 3: which pages does each table get, and how are rows edited? */
async function askScreens(schemas: EntitySchema[], flags: InitFlags, prompts: PromptIO): Promise<Record<string, CrudSuiteOptions>> {
  const perEntity: Record<string, CrudSuiteOptions> = {}
  let editing: CrudEditingMode = 'form'
  let full = true

  if (!flags.yes) {
    full = isYes(await prompts.ask('\nGenerate a list, an edit form and a record page for each table? (Y/n)', 'y'), true)
    const modes: { label: string; value: CrudEditingMode }[] = [
      { label: 'A popup form', value: 'form' },
      { label: 'In the grid (like a spreadsheet)', value: 'inline' },
      { label: 'On the record page', value: 'detail' },
    ]
    editing = modes[await pick(prompts, 'How should rows be edited?', modes)]!.value
  }

  for (const schema of schemas) {
    const hasChildren = schemas.some((e) => e.fields.some((f) => f.type === 'relation' && f.relation?.entity === schema.name))
    const screens: CrudScreenKind[] = full
      ? hasChildren || editing === 'detail' ? ['list', 'form', 'detail'] : ['list', 'form']
      : ['list']
    perEntity[schema.name] = { screens, editing }
  }
  return perEntity
}

/** Step 4: the app's look. */
async function askTheme(flags: InitFlags, prompts: PromptIO): Promise<ProjectTheme | undefined> {
  let preset = flags.theme?.trim().toLowerCase()
  if (preset && !getStudioTheme(preset)) {
    prompts.say(`  ! Unknown theme "${preset}" - using ember.`)
    preset = undefined
  }
  if (!preset && !flags.yes) {
    const i = await pick(prompts, 'Theme:', studioThemes.map((t) => ({ label: t.name, hint: t.id })))
    preset = studioThemes[i]?.id
  }
  preset ??= 'ember'
  const dark = flags.dark ?? (flags.yes ? false : isYes(await prompts.ask('Dark mode? (y/N)', 'n'), false))
  return { preset, mode: dark ? 'dark' : 'light' }
}

/** Prefix a path with the output folder (`.` writes into the current one). */
const inDir = (outDir: string, path: string): string =>
  (!outDir || outDir === '.' ? '' : outDir.replace(/[\\/]+$/, '') + '/') + path

/** Which marker files are present in `outDir` right now. */
async function markersIn(outDir: string, io: StudioIO): Promise<Set<string>> {
  const found = new Set<string>()
  for (const marker of CLOBBER_MARKERS) {
    if ((await io.readFile(inDir(outDir, marker))) != null) found.add(marker)
  }
  return found
}

/**
 * Stop before overwriting somebody else's app.
 *
 * `init` defaults to the current folder, and bare `svgrid-studio` in a terminal
 * runs it, so a mistaken run inside an existing project would replace its
 * package.json, svelte config and .env without a word. Re-running init on a
 * folder Studio itself generated is a regenerate, not a clobber, so a
 * `studio.config.json` waves the check through.
 *
 * `before` is the set of markers seen at startup, and only those count. Picking a
 * database makes Studio install a driver into this folder first, which writes a
 * package.json - without the snapshot the flow would trip over a file it had
 * just created itself and refuse to build anything.
 */
async function confirmTargetFolder(
  outDir: string,
  flags: InitFlags,
  prompts: PromptIO,
  io: StudioIO,
  before: Set<string> | null,
): Promise<void> {
  if (flags.force) return
  if ((await io.readFile(inDir(outDir, 'studio.config.json'))) != null) return

  const present = await markersIn(outDir, io)
  // `before` only describes the folder it was taken in; anywhere else, whatever
  // is on disk now was there before we started.
  const found = CLOBBER_MARKERS.filter((m) => present.has(m) && (before == null || before.has(m)))
  if (found.length === 0) return

  const where = !outDir || outDir === '.' ? 'This folder' : outDir
  const message = `${where} already has ${found.join(', ')}, and Studio would overwrite ${found.length === 1 ? 'it' : 'them'}.`
  if (flags.yes) {
    throw new UserError(message, 'Pick an empty folder with --out <dir>, or pass --force to overwrite anyway.')
  }
  prompts.say('')
  prompts.say(`  ! ${message}`)
  if (!isYes(await prompts.ask('Overwrite? (y/N)', 'n'), false)) {
    throw new UserError('Stopped without writing anything.', 'Re-run with --out <dir> to build somewhere else.')
  }
}

/** Merge-write the generated files, preserving edits outside managed regions. */
async function writeAll(files: { path: string; contents: string; userOwned?: boolean }[], outDir: string, io: StudioIO): Promise<string[]> {
  const written: string[] = []
  for (const file of files) {
    const path = inDir(outDir, file.path)
    const existing = await io.readFile(path)
    if (skipUserOwned(file, existing != null)) continue
    await io.writeFile(path, mergeManaged(existing, file.contents))
    written.push(path)
  }
  return written
}

/**
 * The whole guided flow: ask, build, write. Returns the project and what was
 * written so the caller can print next steps (or assert them in a test).
 */
export async function runStudioInit(
  flags: InitFlags,
  prompts: PromptIO,
  db: DbGateway | null,
  io: StudioIO,
  fetchText: FetchText | null = null,
): Promise<InitResult> {
  prompts.say('SvGrid Studio - let\'s build your app.')

  // Snapshot the likely target before anything (a driver install, say) can add
  // files to it, so the overwrite guard below judges the folder as the user left
  // it rather than as Studio just changed it.
  const candidateDir = flags.out ?? '.'
  const markersBefore = await markersIn(candidateDir, io)

  const data = await gatherData(flags, prompts, db, fetchText)
  const perEntity = await askScreens(data.schemas, flags, prompts)
  const theme = await askTheme(flags, prompts)

  const defaultTitle = flags.title ?? data.title ?? 'My app'
  const title = flags.yes || flags.title ? defaultTitle : (await prompts.ask('\nApp name:', defaultTitle)).trim() || defaultTitle
  const outDir = flags.out ?? (flags.yes ? '.' : (await prompts.ask('Write it where?', '.')).trim() || '.')
  await confirmTargetFolder(outDir, flags, prompts, io, outDir === candidateDir ? markersBefore : null)

  const project = crudAppFromSchemas(data.schemas, {
    title,
    dataSource: data.kind,
    sources: data.sources,
    seed: data.seed,
    perEntity,
    overviewDashboard: true,
    ...(theme ? { theme } : {}),
  })

  const files = emitStudioAppBundle(project)
  const written = await writeAll(files, outDir, io)
  // The design itself, so `svgrid-studio designer` reopens exactly this app.
  const configPath = inDir(outDir, 'studio.config.json')
  await io.writeFile(configPath, serializeProject(project))
  written.push(configPath)

  prompts.say('')
  prompts.say(`Built "${title}": ${data.schemas.length} ${data.schemas.length === 1 ? 'table' : 'tables'}, ${project.screens.length} screens, ${written.length} files.`)

  const nextSteps = [
    ...(outDir && outDir !== '.' ? [`cd ${outDir}`] : []),
    'npm install',
    'npm run dev',
    'svgrid-studio designer   # keep editing it visually',
  ]
  return { project, written, nextSteps }
}
