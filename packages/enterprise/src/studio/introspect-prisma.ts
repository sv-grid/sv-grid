/**
 * Prisma introspection - turn a `schema.prisma` into `EntitySchema`s, the peer
 * of the Drizzle reader in `introspect.ts`. Same contract: a pure, best-effort
 * text parse (no `@prisma/*` dependency, no code execution), funnelled through
 * the shared `buildEntitySchema` so grid + form come out identical to every
 * other introspection path.
 *
 *   - `introspectPrisma(source, model?)` -> one model's schema.
 *   - `introspectPrismaAll(source)`      -> every model, linked (relations
 *     resolve their display field from the related model).
 *
 * Scalar types map to entity field types; `@id` marks the key; a missing `?`
 * means required; `enum` blocks become enum fields; and a `@relation(fields:
 * [fk], references: [id])` navigation turns the scalar `fk` column into a
 * relation field with a searchable lookup.
 */
import { linkRelationLabels, type EntityFieldType, type EntitySchema } from '../schema.js'
import { buildEntitySchema, type IntrospectedColumn } from '../sources/schema-from-columns.js'

/** Prisma scalar type -> entity field type. Unknown scalars fall back to text. */
const PRISMA_TYPE_MAP: Record<string, EntityFieldType> = {
  Int: 'number',
  BigInt: 'number',
  Float: 'number',
  Decimal: 'number',
  String: 'text',
  Boolean: 'boolean',
  DateTime: 'datetime',
  Json: 'json',
  Bytes: 'text',
}

type PrismaModel = { name: string; body: string }
type Relations = Map<string, { table: string; column: string }>

/** Find each `model X { ... }` / `enum X { ... }` block and return its inner body. */
function blocks(source: string, keyword: 'model' | 'enum'): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = []
  const re = new RegExp(`${keyword}\\s+(\\w+)\\s*\\{`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const open = m.index + m[0].length - 1
    let depth = 0
    for (let i = open; i < source.length; i++) {
      const ch = source[i]
      if (ch === '{') depth++
      else if (ch === '}' && --depth === 0) {
        out.push({ name: m[1]!, body: source.slice(open + 1, i) })
        re.lastIndex = i
        break
      }
    }
  }
  return out
}

/** Strip comments and blank lines; return meaningful field/attribute lines. */
function lines(body: string): string[] {
  return body
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter(Boolean)
}

/** Enum block -> its member names (one identifier per line, `@map` ignored). */
function enumValues(body: string): string[] {
  return lines(body)
    .map((l) => l.match(/^(\w+)/)?.[1])
    .filter((v): v is string => Boolean(v))
}

/** Collect `@relation(fields: [fk], references: [ref])` FKs declared in a model. */
function relationsOf(modelLines: string[]): Relations {
  const rels: Relations = new Map()
  for (const line of modelLines) {
    const rel = line.match(/@relation\([^)]*fields:\s*\[(\w+)\][^)]*references:\s*\[(\w+)\]/)
    if (!rel) continue
    const type = line.match(/^\w+\s+(\w+)/)?.[1]
    if (type) rels.set(rel[1]!, { table: type, column: rel[2]! })
  }
  return rels
}

/** Field names of a composite key (`@@id([a, b])`), else empty. */
function compositeKey(modelLines: string[]): string[] {
  for (const line of modelLines) {
    const m = line.match(/^@@id\(\s*\[([^\]]*)\]/)
    if (m) return m[1]!.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

/** Parse one model body into neutral columns, skipping navigation fields. */
function columnsFor(model: PrismaModel, modelNames: Set<string>, enums: Map<string, string[]>): IntrospectedColumn[] {
  const modelLines = lines(model.body)
  const relations = relationsOf(modelLines)
  const columns: IntrospectedColumn[] = []

  for (const line of modelLines) {
    if (line.startsWith('@@')) continue // block attribute (@@id, @@index, @@map, ...)
    const field = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?(.*)$/)
    if (!field) continue
    const [, name, baseType, list, optional, attrs = ''] = field

    // A navigation field (points at another model) is virtual - the stored FK
    // scalar column carries the relation. Skip it (its @relation was captured).
    if (modelNames.has(baseType!)) continue

    const col: IntrospectedColumn = { name: name! }
    if (enums.has(baseType!)) col.enumValues = enums.get(baseType!)
    else col.type = PRISMA_TYPE_MAP[baseType!] ?? 'text'

    if (/@id\b/.test(attrs)) col.primaryKey = true
    // Required = not optional and not a list.
    if (!optional && !list) col.required = true

    const ref = relations.get(name!)
    if (ref) col.references = { table: ref.table, column: ref.column }

    columns.push(col)
  }

  // Composite key (`@@id([a, b])`): flag the members. buildEntitySchema keys off
  // the first (a join table's screen targets its first key column).
  const composite = compositeKey(modelLines)
  if (composite.length && !columns.some((c) => c.primaryKey)) {
    for (const c of columns) if (composite.includes(c.name)) c.primaryKey = true
  }

  return columns
}

function parseModels(source: string): {
  models: PrismaModel[]
  modelNames: Set<string>
  enums: Map<string, string[]>
} {
  const models = blocks(source, 'model')
  const enums = new Map(blocks(source, 'enum').map((e) => [e.name, enumValues(e.body)]))
  const modelNames = new Set(models.map((m) => m.name))
  return { models, modelNames, enums }
}

/** Parse one Prisma model into an `EntitySchema`. Defaults to the first model. */
export function introspectPrisma(source: string, model?: string): EntitySchema {
  const { models, modelNames, enums } = parseModels(source)
  if (models.length === 0) {
    throw new Error('introspectPrisma: no `model X { ... }` definition found in source')
  }
  const picked = model ? models.find((m) => m.name === model) : models[0]
  if (!picked) throw new Error(`introspectPrisma: model "${model}" not found in source`)

  const columns = columnsFor(picked, modelNames, enums)
  if (columns.length === 0) {
    throw new Error(`introspectPrisma: parsed model "${picked.name}" but found no fields`)
  }
  return buildEntitySchema(picked.name, columns)
}

/**
 * Parse **every** model in a `schema.prisma` into a linked set of schemas.
 * Foreign keys become relation fields and `linkRelationLabels` resolves each
 * lookup's display field from the related model.
 */
export function introspectPrismaAll(source: string): EntitySchema[] {
  const { models, modelNames, enums } = parseModels(source)
  if (models.length === 0) {
    throw new Error('introspectPrisma: no `model X { ... }` definition found in source')
  }
  const schemas = models
    .map((m) => ({ m, columns: columnsFor(m, modelNames, enums) }))
    .filter(({ columns }) => columns.length > 0)
    .map(({ m, columns }) => buildEntitySchema(m.name, columns))
  return linkRelationLabels(schemas)
}
