/**
 * runStudioAdd - the one-command pipeline behind `@svgrid/studio add`: read a
 * schema, introspect it, scaffold the files, merge-write them (preserving user
 * edits outside managed regions), and verify the output compiles. This is the
 * whole "CRUD screen in seconds" flow.
 *
 * Filesystem access is injected (`StudioIO`), so the orchestration is pure and
 * unit-testable; the actual CLI bin supplies node:fs. No process/fs imports
 * here, so it also runs in the browser (e.g. the designer's future
 * write-to-project action).
 */
import type { EntitySchema } from '../schema.js'
import { introspectDrizzle, introspectDrizzleAll, introspectJson } from './introspect.js'
import { introspectPrisma, introspectPrismaAll } from './introspect-prisma.js'
import { MANAGED_START, mergeManaged, scaffold, skipUserOwned, type ScaffoldOptions } from './scaffold.js'
import { scaffoldApp, type ScaffoldAppOptions } from './scaffold-app.js'
import { verifyScaffold, type VerifyResult } from './verify.js'

/** A `.prisma` file (by extension or a `model X {` block) parses as Prisma; otherwise Drizzle. */
function isPrismaSource(path: string, source: string): boolean {
  return /\.prisma$/i.test(path) || /\bmodel\s+\w+\s*\{/.test(source)
}

export type StudioIO = {
  /** Read a file; resolve to null when it doesn't exist. */
  readFile: (path: string) => Promise<string | null>
  /** Write a file, creating parent directories as needed. */
  writeFile: (path: string, contents: string) => Promise<void>
}

export type AddOptions = ScaffoldOptions & {
  /** Path to a Drizzle schema file to introspect. */
  from?: string
  /** Which table in the Drizzle file to use (defaults to the first). */
  table?: string
  /** Sample JSON rows to infer from, as an alternative to `from`. */
  rows?: Array<Record<string, unknown>>
  /** Entity name (required with `rows`, ignored with `from`). */
  name?: string
  /** A ready EntitySchema, bypassing introspection. */
  schema?: EntitySchema
}

export type AddResult = {
  schema: EntitySchema
  /** Paths written, in order. */
  written: string[]
  /** Existing files without managed markers, left alone; the new version went to `parkedAs`. */
  conflicts: ParkedFile[]
  verify: VerifyResult
}

/** Resolve an EntitySchema from whichever input was provided. */
export async function resolveSchema(options: AddOptions, io: StudioIO): Promise<EntitySchema> {
  if (options.schema) return options.schema
  if (options.from) {
    const src = await io.readFile(options.from)
    if (src == null) throw new Error(`runStudioAdd: schema file not found: ${options.from}`)
    return isPrismaSource(options.from, src)
      ? introspectPrisma(src, options.table)
      : introspectDrizzle(src, options.table)
  }
  if (options.rows) {
    return introspectJson(options.name ?? options.route ?? 'entity', options.rows)
  }
  throw new Error('runStudioAdd: provide `from` (a Drizzle or Prisma schema file), `rows`, or `schema`')
}

/**
 * Resolve **every** entity from a Drizzle or Prisma schema file (the `--all
 * --from` path), linked so foreign keys become working relation lookups.
 */
export async function resolveSchemas(from: string, io: StudioIO): Promise<EntitySchema[]> {
  const src = await io.readFile(from)
  if (src == null) throw new Error(`runStudioAddApp: schema file not found: ${from}`)
  return isPrismaSource(from, src) ? introspectPrismaAll(src) : introspectDrizzleAll(src)
}

/** A generated file that was not written over an existing one, and where it went instead. */
export type ParkedFile = { path: string; parkedAs: string }

/**
 * Where to park a generated file next to `path`: `<path>.new`, unless that holds
 * something else (an earlier run's copy the user may be merging), then the first
 * free `<path>.new.1`, `.new.2`, ... A slot already holding these exact contents
 * is reused, so re-running does not pile up copies.
 */
async function freeNewPath(path: string, contents: string, io: StudioIO): Promise<string> {
  for (let i = 0; ; i++) {
    const candidate = i === 0 ? `${path}.new` : `${path}.new.${i}`
    const there = await io.readFile(candidate)
    if (there == null || there === contents) return candidate
  }
}

/**
 * Merge-write a set of generated files, preserving user edits outside managed
 * regions.
 *
 * A file already on disk with no managed markers is somebody's own code (the
 * create-studio starter's nav layout, a hand-written page), and a merge would
 * replace it whole. Those get the new version beside them as `<file>.new`, the
 * same convention the designer uses for a hand-edited file, and come back in
 * `conflicts`. Unlike the designer, an existing `.new` with other contents is
 * kept: the copy goes to `.new.1` and up (see freeNewPath). A folder `init` generated (it has studio.config.json) is the
 * exception: its files are Studio's own output, and regenerating them is the
 * point.
 */
async function writeAll(files: { path: string; contents: string; userOwned?: boolean }[], io: StudioIO): Promise<{ written: string[]; conflicts: ParkedFile[] }> {
  const written: string[] = []
  const conflicts: ParkedFile[] = []
  const studioApp = (await io.readFile('studio.config.json')) != null
  for (const file of files) {
    const existing = await io.readFile(file.path)
    // User-owned companions (a screen's `handlers.ts`) carry no managed markers -
    // they're scaffolded once and then the developer's code forever. Skip if it
    // already exists so a regenerate never clobbers hand-written logic. See
    // HANDLERS-DESIGN.md (the round-trip contract).
    if (skipUserOwned(file, existing != null)) continue
    if (existing != null && !studioApp && existing !== file.contents && !existing.includes(MANAGED_START)) {
      const parkedAs = await freeNewPath(file.path, file.contents, io)
      await io.writeFile(parkedAs, file.contents)
      conflicts.push({ path: file.path, parkedAs })
      continue
    }
    // Regenerating? Replace only the managed region, keep the user's edits.
    await io.writeFile(file.path, mergeManaged(existing, file.contents))
    written.push(file.path)
  }
  return { written, conflicts }
}

export async function runStudioAdd(options: AddOptions, io: StudioIO): Promise<AddResult> {
  const schema = await resolveSchema(options, io)
  const { files } = scaffold(schema, options)
  const { written, conflicts } = await writeAll(files, io)
  const verify = await verifyScaffold(files)
  return { schema, written, conflicts, verify }
}

export type AddAppResult = {
  written: string[]
  /** Existing files without managed markers, left alone; the new version went to `parkedAs`. */
  conflicts: ParkedFile[]
  verify: VerifyResult
}

/** The stylesheets an `init`-generated layout imports, in cascade order. */
const APP_STYLESHEETS = ['app.css', 'custom.css']

/**
 * Fill the app-shell options the caller left out from the app already on disk,
 * so `add --all` in a folder `init` generated keeps its stylesheets, title and
 * theme. The shell layout from `init` carries no managed markers, so the merge
 * write replaces it whole; anything it imported or named has to be carried
 * over here or it is lost.
 *
 * Title: studio.config.json (shell brand, then title), else the `appTitle`
 * constant of a layout an earlier `add --all` wrote.
 */
async function appShellDefaults(options: ScaffoldAppOptions, io: StudioIO): Promise<ScaffoldAppOptions> {
  const stylesheets = options.stylesheets ?? []
  if (!options.stylesheets) {
    for (const css of APP_STYLESHEETS) {
      if ((await io.readFile(`src/${css}`)) != null) stylesheets.push(css)
    }
  }

  let title: string | undefined
  let theme: { preset?: unknown; mode?: unknown; shell?: { brand?: unknown } } | undefined
  const config = await io.readFile('studio.config.json')
  if (config != null) {
    try {
      const parsed = JSON.parse(config) as { title?: unknown; theme?: typeof theme }
      theme = parsed.theme
      const brand = typeof theme?.shell?.brand === 'string' ? theme.shell.brand.trim() : ''
      title = brand || (typeof parsed.title === 'string' ? parsed.title : undefined)
    } catch {
      /* unreadable config: fall back to the layout below */
    }
  }
  if (!title) {
    const layout = await io.readFile('src/routes/+layout.svelte')
    const m = layout?.match(/const appTitle = ("(?:[^"\\]|\\.)*")/)
    if (m) {
      try {
        title = JSON.parse(m[1]!) as string
      } catch {
        /* not a JSON string literal: keep the default */
      }
    }
  }

  return {
    ...options,
    stylesheets,
    ...(options.appTitle == null && title ? { appTitle: title } : {}),
    ...(options.theme == null && typeof theme?.preset === 'string' ? { theme: theme.preset } : {}),
    ...(options.dark == null && theme?.mode === 'dark' ? { dark: true } : {}),
  }
}

/**
 * Scaffold a whole multi-entity app - every entity's screen plus a nav layout
 * and home page - and merge-write it. The `--all` path behind `svgrid-studio`.
 */
export async function runStudioAddApp(
  schemas: EntitySchema[],
  options: ScaffoldAppOptions,
  io: StudioIO,
): Promise<AddAppResult> {
  const { files } = scaffoldApp(schemas, await appShellDefaults(options, io))
  const { written, conflicts } = await writeAll(files, io)
  const verify = await verifyScaffold(files)
  return { written, conflicts, verify }
}
