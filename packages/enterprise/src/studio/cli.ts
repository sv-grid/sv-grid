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
import { mergeManaged, scaffold, skipUserOwned, type ScaffoldOptions } from './scaffold.js'
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

/** Merge-write a set of generated files, preserving user edits outside managed regions. */
async function writeAll(files: { path: string; contents: string; userOwned?: boolean }[], io: StudioIO): Promise<string[]> {
  const written: string[] = []
  for (const file of files) {
    const existing = await io.readFile(file.path)
    // User-owned companions (a screen's `handlers.ts`) carry no managed markers -
    // they're scaffolded once and then the developer's code forever. Skip if it
    // already exists so a regenerate never clobbers hand-written logic. See
    // HANDLERS-DESIGN.md (the round-trip contract).
    if (skipUserOwned(file, existing != null)) continue
    // Regenerating? Replace only the managed region, keep the user's edits.
    await io.writeFile(file.path, mergeManaged(existing, file.contents))
    written.push(file.path)
  }
  return written
}

export async function runStudioAdd(options: AddOptions, io: StudioIO): Promise<AddResult> {
  const schema = await resolveSchema(options, io)
  const { files } = scaffold(schema, options)
  const written = await writeAll(files, io)
  const verify = await verifyScaffold(files)
  return { schema, written, verify }
}

export type AddAppResult = { written: string[]; verify: VerifyResult }

/**
 * Scaffold a whole multi-entity app - every entity's screen plus a nav layout
 * and home page - and merge-write it. The `--all` path behind `svgrid-studio`.
 */
export async function runStudioAddApp(
  schemas: EntitySchema[],
  options: ScaffoldAppOptions,
  io: StudioIO,
): Promise<AddAppResult> {
  const { files } = scaffoldApp(schemas, options)
  const written = await writeAll(files, io)
  const verify = await verifyScaffold(files)
  return { written, verify }
}
