/**
 * Import an OpenAPI 3.x document (JSON) into Studio entities + REST data sources.
 * Point at a spec and get a modelled app: each REST resource ( `GET /pets` +
 * `GET /pets/{id}` + POST/PUT/DELETE ) becomes one EntitySchema and one
 * `RestSource`, with fields mapped from the resource's JSON Schema.
 *
 * v1 scope: OpenAPI 3.x JSON only (YAML deferred), single-file `$ref` into
 * `components/schemas`. Pure + Svelte-free like the rest of the studio core.
 */
import type { EntityField, EntityFieldType, EntitySchema } from '../schema.js'
import type { EntityDataSource, RequestParam, RestSource } from './project.js'

type Json = Record<string, unknown>
type OpenApiDoc = {
  openapi?: string
  servers?: Array<{ url?: string }>
  paths?: Record<string, Json>
  components?: { schemas?: Record<string, Json> }
}

export type OpenApiImport = {
  entities: EntitySchema[]
  sources: Record<string, EntityDataSource>
  /** Non-fatal notes (skipped paths, unresolved refs) to surface in the UI. */
  warnings: string[]
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

/** Resolve a local `#/components/schemas/Foo` ref (one level). */
function resolveRef(doc: OpenApiDoc, ref: string): Json | null {
  const m = ref.match(/^#\/components\/schemas\/(.+)$/)
  if (!m) return null
  return (doc.components?.schemas?.[m[1]!] as Json) ?? null
}

/** Follow a `$ref` to its target schema (guards against a self/cyclic ref). */
function deref(doc: OpenApiDoc, node: Json | undefined, seen = new Set<string>()): Json | null {
  if (!node) return null
  const ref = node['$ref']
  if (typeof ref === 'string') {
    if (seen.has(ref)) return null
    seen.add(ref)
    return deref(doc, resolveRef(doc, ref) ?? undefined, seen)
  }
  return node
}

/** The component-schema name a `$ref` points at, or null. */
function refName(node: Json | undefined): string | null {
  const ref = node?.['$ref']
  const m = typeof ref === 'string' ? ref.match(/^#\/components\/schemas\/(.+)$/) : null
  return m ? m[1]! : null
}

const titleCase = (s: string) => s.replace(/[-_]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()).trim()
const singular = (s: string) => (s.endsWith('ies') ? s.slice(0, -3) + 'y' : s.endsWith('ses') ? s.slice(0, -2) : s.endsWith('s') && !s.endsWith('ss') ? s.slice(0, -1) : s)

/** Map one JSON-Schema property to an EntityField type (+ enum options). */
function fieldType(doc: OpenApiDoc, prop: Json, entityByRef: Map<string, string>): { type: EntityFieldType; options?: Array<{ value: string; label: string }>; relation?: string } {
  // A `$ref` to a schema that became one of our entities -> a relation.
  const rn = refName(prop)
  if (rn && entityByRef.has(rn)) return { type: 'relation', relation: entityByRef.get(rn)! }
  const schema = deref(doc, prop) ?? prop
  const enumVals = schema['enum']
  if (Array.isArray(enumVals) && enumVals.every((v) => typeof v === 'string' || typeof v === 'number')) {
    return { type: 'enum', options: enumVals.map((v) => ({ value: String(v), label: titleCase(String(v)) })) }
  }
  const t = schema['type']
  const fmt = schema['format']
  if (t === 'integer' || t === 'number') return { type: 'number' }
  if (t === 'boolean') return { type: 'boolean' }
  if (t === 'array' || t === 'object') return { type: 'json' }
  if (t === 'string') {
    if (fmt === 'date') return { type: 'dateString' }
    if (fmt === 'date-time') return { type: 'datetime' }
    return { type: 'text' }
  }
  return { type: 'text' }
}

/** Object schema -> EntityField[]. `id`/pk detection + required + relations. */
function schemaToFields(doc: OpenApiDoc, objectSchema: Json, entityByRef: Map<string, string>): EntityField[] {
  const props = (deref(doc, objectSchema)?.['properties'] as Record<string, Json> | undefined) ?? {}
  const required = new Set((deref(doc, objectSchema)?.['required'] as string[] | undefined) ?? [])
  const fields: EntityField[] = []
  for (const [name, rawProp] of Object.entries(props)) {
    const ft = fieldType(doc, rawProp, entityByRef)
    const isPk = name === 'id' || name === '_id'
    const field: EntityField = {
      field: name,
      label: titleCase(name),
      type: ft.type,
      ...(isPk ? { primaryKey: true } : {}),
      ...(required.has(name) && !isPk ? { required: true } : {}),
      ...(ft.options ? { options: ft.options } : {}),
      ...(ft.relation ? { relation: { entity: ft.relation, labelField: 'name', foreignKey: name } } : {}),
    }
    fields.push(field)
  }
  return fields
}

/** The item schema for a resource: the 200 response of GET-by-id, else the array
 *  item of the list response, else the POST request body. */
function itemSchemaFor(doc: OpenApiDoc, ops: Record<string, Json>): Json | null {
  const bodySchema = (op: Json | undefined, kind: 'response' | 'request'): Json | null => {
    if (!op) return null
    const content =
      kind === 'response'
        ? ((op['responses'] as Json | undefined)?.['200'] as Json | undefined)?.['content']
        : (op['requestBody'] as Json | undefined)?.['content']
    const json = (content as Json | undefined)?.['application/json'] as Json | undefined
    return (json?.['schema'] as Json | undefined) ?? null
  }
  const byId = bodySchema(ops.getOne, 'response')
  if (byId) return deref(doc, byId)
  const list = bodySchema(ops.list, 'response')
  if (list) {
    const s = deref(doc, list)
    if (s?.['type'] === 'array') return deref(doc, s['items'] as Json)
    // wrapped: { data: [ item ] } / { items: [...] } / { results: [...] }
    for (const key of ['data', 'items', 'results', 'rows']) {
      const wrapped = deref(doc, (s?.['properties'] as Record<string, Json> | undefined)?.[key])
      if (wrapped?.['type'] === 'array') return deref(doc, wrapped['items'] as Json)
    }
  }
  const created = bodySchema(ops.create, 'request')
  return created ? deref(doc, created) : null
}

/** The `application/json` schema node of an operation's 200 response, else null. */
function responseSchema(op: Json | undefined): Json | undefined {
  const content = ((op?.['responses'] as Json | undefined)?.['200'] as Json | undefined)?.['content'] as Json | undefined
  return (content?.['application/json'] as Json | undefined)?.['schema'] as Json | undefined
}

/** The dotted rows path for a list response ('data'/'items'/...), or undefined
 *  when the response is a bare array. */
function rowsPathFor(doc: OpenApiDoc, listOp: Json | undefined): string | undefined {
  const s = deref(doc, responseSchema(listOp))
  if (!s || s['type'] === 'array') return undefined
  for (const key of ['data', 'items', 'results', 'rows']) {
    if (deref(doc, (s['properties'] as Record<string, Json> | undefined)?.[key])?.['type'] === 'array') return key
  }
  return undefined
}

function paramsFor(doc: OpenApiDoc, op: Json | undefined): RequestParam[] {
  const raw = (op?.['parameters'] as Json[] | undefined) ?? []
  const out: RequestParam[] = []
  for (const p of raw) {
    const param = deref(doc, p) ?? p
    const loc = param['in']
    const name = param['name']
    if (typeof name !== 'string' || (loc !== 'query' && loc !== 'path' && loc !== 'header')) continue
    out.push({ name, location: loc, type: 'string' })
  }
  return out
}

/** Split "/pets/{petId}" -> { collection: "/pets", isItem: true }. A collection
 *  path ends in a static segment; an item path ends in a `{param}`. */
function classifyPath(path: string): { collection: string; isItem: boolean } {
  const segs = path.split('/').filter(Boolean)
  if (segs.length && /^\{.+\}$/.test(segs.at(-1)!)) return { collection: '/' + segs.slice(0, -1).join('/'), isItem: true }
  return { collection: path, isItem: false }
}

/** Parse + introspect an OpenAPI 3.x JSON document into entities + REST sources. */
export function introspectOpenApi(specText: string): OpenApiImport {
  let doc: OpenApiDoc
  try {
    doc = JSON.parse(specText) as OpenApiDoc
  } catch {
    throw new Error('Could not parse the OpenAPI document. v1 supports JSON only - convert a YAML spec to JSON first (e.g. https://editor.swagger.io export).')
  }
  if (!doc || typeof doc !== 'object' || !doc.paths) throw new Error('Not an OpenAPI document: no "paths" object found.')

  const warnings: string[] = []
  const baseUrl = (doc.servers?.[0]?.url ?? '').replace(/\/+$/, '')

  // Group operations by resource (collection path).
  type Res = { name: string; collection: string; ops: Record<string, Json> }
  const byCollection = new Map<string, Res>()
  for (const [path, item] of Object.entries(doc.paths)) {
    const { collection, isItem } = classifyPath(path)
    const segs = collection.split('/').filter(Boolean)
    const last = segs.at(-1)
    if (!last || /^\{.+\}$/.test(last)) { warnings.push(`Skipped path "${path}" (no clear resource name).`); continue }
    const name = singular(last).replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()
    const res = byCollection.get(collection) ?? { name, collection, ops: {} }
    for (const method of HTTP_METHODS) {
      const op = item[method] as Json | undefined
      if (!op) continue
      if (method === 'get') res.ops[isItem ? 'getOne' : 'list'] = op
      else if (method === 'post' && !isItem) res.ops.create = op
      else if ((method === 'put' || method === 'patch') && isItem) res.ops.update = op
      else if (method === 'delete' && isItem) res.ops.delete = op
    }
    byCollection.set(collection, res)
  }

  // Two passes: map each resource's component schema NAME -> entity name first,
  // so a property that `$ref`s another resource's schema becomes a relation.
  const resources = [...byCollection.values()].filter((r) => r.ops.list || r.ops.getOne || r.ops.create)
  const entityByRef = new Map<string, string>()
  for (const r of resources) {
    for (const opKey of ['getOne', 'list', 'create'] as const) {
      const op = r.ops[opKey]
      const schema = responseSchema(op) ?? ((((op?.['requestBody'] as Json | undefined)?.['content'] as Json | undefined)?.['application/json'] as Json | undefined)?.['schema'] as Json | undefined)
      const direct = refName(schema)
      if (direct) entityByRef.set(direct, r.name)
      const arrItem = refName(deref(doc, schema)?.['items'] as Json | undefined)
      if (arrItem) entityByRef.set(arrItem, r.name)
    }
  }

  const entities: EntitySchema[] = []
  const sources: Record<string, EntityDataSource> = {}
  const seenNames = new Set<string>()
  for (const r of resources) {
    let name = r.name
    while (seenNames.has(name)) name = name + '_'
    seenNames.add(name)
    const item = itemSchemaFor(doc, r.ops)
    if (!item) { warnings.push(`Resource "${r.collection}" has no readable schema - skipped.`); continue }
    const fields = schemaToFields(doc, item, entityByRef)
    if (!fields.length) { warnings.push(`Resource "${r.collection}" resolved no fields - skipped.`); continue }
    if (!fields.some((f) => f.primaryKey)) {
      const idish = fields.find((f) => /id$/i.test(f.field))
      if (idish) idish.primaryKey = true
      else fields.unshift({ field: 'id', label: 'Id', type: 'text', primaryKey: true })
    }
    const idField = fields.find((f) => f.primaryKey)!.field
    entities.push({ name, label: titleCase(name), idField, fields })
    const path = r.collection.replace(/^\/+/, '')
    const source: RestSource = {
      kind: 'rest',
      baseUrl,
      path,
      method: 'GET',
      params: paramsFor(doc, r.ops.list),
      idField,
      ...(rowsPathFor(doc, r.ops.list) ? { rowsPath: rowsPathFor(doc, r.ops.list) } : {}),
    }
    sources[name] = source
  }

  if (!entities.length) throw new Error('No REST resources with a readable schema were found in the document.')
  return { entities, sources, warnings }
}
