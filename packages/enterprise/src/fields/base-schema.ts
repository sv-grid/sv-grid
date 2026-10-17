/**
 * Base tables from a database's own description: the `EntitySchema` that
 * `introspectSupabaseTable`, `introspectDatabase` or `introspectDrizzle`
 * read.
 *
 * Column types become field types, helped by the column's name (`email`,
 * `phone`, `price`, `notes`, `rating`, `updated_by`); an enum, or a text column that keeps
 * repeating a handful of values, becomes a single select with colored
 * options; a foreign key becomes a link to the table it names, with a field
 * in that table that links back; a table that only pairs two others
 * (`task_tags`) becomes a link to many records instead of a tab of its own.
 * Each table gets views that fit its fields: a grid, a Kanban board by its
 * first select, a calendar by its first date.
 *
 * The result is first a `BaseTableSpec`: plain JSON, so a server can send it
 * to the page. `baseTablesFromSpec` then gives each table its source.
 */
import type { ServerDataSource } from '@svgrid/grid'
import type { EntityField, EntitySchema } from '../schema'
import { addInverse, colId, type BaseTable } from './base-tables'
import { baseSource, type BaseSourceOptions, type ForeignKeyLink } from './base-sync'
import { BRIGHT } from './palette'
import type { FieldView } from './view-model'
import type { BaseJunctionComment, BaseTableComment } from './base-sql'

type Def = Record<string, any>

/** How a link field is kept, by table name rather than by source: JSON-safe. */
export type BaseLinkSpec = { column: string } | { through: string; from: string; to: string; idField?: string }

/** A base table as plain data: what `describeDatabase` reads and an endpoint sends. */
export type BaseTableSpec = Omit<BaseTable, 'source' | 'data'> & {
  /** How its link fields are stored. */
  links?: Record<string, BaseLinkSpec>
  /** The record's key column. */
  idField?: string
  /** The database makes the key of a new record. */
  serverIds?: boolean
  /** Column names that differ from field names: `{ fixedOn: 'fixed_on' }`. */
  rename?: Record<string, string>
}

/** Values a text column holds, most used first, for turning it into a select. */
export type ColumnValues = Record<string, Record<string, Array<{ value: string; count: number }>>>

const title = (s: string) => s.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().replace(/^\w/, (c) => c.toUpperCase())
/** `project_id` -> `project`: the link field's name for a foreign key column. */
const linkName = (column: string) => column.replace(/_?id$/i, '') || column

const MONEY = /(^|_)(price|amount|cost|budget|revenue|salary|total|fee|value|spend|mrr|arr)($|_)/i
const LONG = /(^|_)(notes?|description|body|comment|comments|summary|details|bio|content|message)($|_)/i
// Who changed or added a row, as the app (or an agent) writes it: a user id the base names from its people list.
const MODIFIED_BY = /^(updated|modified|last_modified|edited)_?by$/i
const CREATED_BY = /^created_?by$/i

function fieldOf(f: EntityField): Def {
  const header = f.label ?? title(f.field)
  const base = { id: f.field, field: f.field, header }
  const editor = f.input?.editorType
  switch (f.type) {
    case 'number':
      if (editor === 'rating') return { ...base, fieldType: 'rating', fieldProps: { max: 5 } }
      if (MONEY.test(f.field)) return { ...base, fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', precision: 0, summary: 'sum' } }
      return { ...base, fieldType: 'number' }
    case 'boolean':
      return { ...base, fieldType: 'checkbox' }
    case 'date':
    case 'dateString':
      return { ...base, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } }
    case 'datetime':
      return { ...base, fieldType: 'date', fieldProps: { dateFormat: 'friendly', time: true } }
    case 'enum':
      return { ...base, fieldType: 'singleSelect', fieldProps: { options: (f.options ?? []).map((o, i) => ({ value: String(o.value), color: o.color ?? BRIGHT[i % BRIGHT.length]!.value })) } }
    case 'json':
      return { ...base, fieldType: 'longText' }
    default:
      if (f.format === 'email') return { ...base, fieldType: 'email' }
      if (f.format === 'url') return { ...base, fieldType: 'url' }
      if (editor === 'phone') return { ...base, fieldType: 'phone' }
      if (MODIFIED_BY.test(f.field)) return { ...base, fieldType: 'lastModifiedBy' }
      if (CREATED_BY.test(f.field)) return { ...base, fieldType: 'createdBy' }
      if (LONG.test(f.field)) return { ...base, fieldType: 'longText' }
      return { ...base, fieldType: 'text' }
  }
}

/** A width that shows a value of the type whole: a friendly date, an amount, an address. */
function widthFor(d: Def): number {
  switch (d.fieldType) {
    case 'date':
      return d.fieldProps?.time ? 210 : 170
    case 'longText':
      return 240
    case 'email':
    case 'url':
      return 200
    case 'link':
      return 180
    case 'checkbox':
      return 90
    case 'rating':
      return 120
    case 'number':
      return Math.max(110, String(d.header).length * 9 + 40)
    default:
      return Math.max(130, Math.min(200, String(d.header).length * 9 + 60))
  }
}

const PRIMARY = /^(name|title|subject|label|full_?name|display_?name|summary|headline)$/i

/** One table's fields, its primary field and how its foreign keys are stored. */
export function baseFieldsFromSchema(entity: EntitySchema): { columns: Def[]; primaryField: string; idField: string; links: Record<string, ForeignKeyLink> } {
  const idField = entity.idField ?? entity.fields.find((f) => f.primaryKey)?.field ?? 'id'
  const columns: Def[] = []
  const links: Record<string, ForeignKeyLink> = {}
  for (const f of entity.fields) {
    if (f.field === idField) continue
    if (f.type === 'relation' && f.relation) {
      const column = f.relation.foreignKey ?? f.field
      const name = linkName(f.field)
      links[name] = { column }
      columns.push({ id: name, field: name, header: f.label ? f.label.replace(/\s*id$/i, '') : title(name), fieldType: 'link', fieldProps: { table: f.relation.entity, multiple: false } })
    } else columns.push(fieldOf(f))
  }
  const primary = columns.find((d) => PRIMARY.test(String(d.field))) ?? columns.find((d) => d.fieldType === 'text') ?? columns[0]
  // The primary field leads.
  if (primary && columns[0] !== primary) columns.splice(0, 0, ...columns.splice(columns.indexOf(primary), 1))
  for (const d of columns) d.width ??= d === primary ? 220 : widthFor(d)
  return { columns, primaryField: primary ? String(primary.field) : idField, idField, links }
}

/** A table that only pairs two others: its key, two foreign keys, and at most a timestamp. */
function isJunction(e: EntitySchema): { from: EntityField; to: EntityField } | null {
  const rest = e.fields.filter((f) => !f.primaryKey && !/^(created|updated)_?(at|on)$/i.test(f.field))
  const rels = rest.filter((f) => f.type === 'relation' && f.relation)
  return rest.length === 2 && rels.length === 2 ? { from: rels[0]!, to: rels[1]! } : null
}

export type DescribeOptions = {
  /** Values of text columns, to make the ones that repeat a few values single selects. */
  values?: ColumnValues
  /** The database makes the key of each table's new records (by table). */
  serverIds?: (table: EntitySchema) => boolean
  /** Add a Kanban and a calendar view where the fields allow (default true). */
  views?: boolean
  /** Add the field that links back for each link (default true; false when the database says which they are). */
  inverses?: boolean
  /** 'links': the tables that link to the most others first (when nobody chose an order). */
  order?: 'given' | 'links'
}

/** Whether a column's values read as a choice: a few values, each used more than once. */
function asChoices(values: Array<{ value: string; count: number }> | undefined): string[] | null {
  if (!values?.length || values.length > 12) return null
  const used = values.reduce((n, v) => n + v.count, 0)
  if (used < values.length * 2 || values.some((v) => v.value.length > 40)) return null
  return values.map((v) => v.value)
}

/**
 * Base tables as plain data from database descriptions: fields, links (a
 * junction table becomes a link to many), choices, the fields that link
 * back, and views.
 */
export function baseSpecFromSchemas(entities: ReadonlyArray<EntitySchema | null | undefined>, options: DescribeOptions = {}): BaseTableSpec[] {
  const all = entities.filter((e): e is EntitySchema => !!e)
  const junctions = new Map(all.map((e) => [e.name, isJunction(e)] as const).filter((x): x is [string, { from: EntityField; to: EntityField }] => !!x[1]))
  const names = new Set(all.filter((e) => !junctions.has(e.name)).map((e) => e.name))
  let specs: BaseTableSpec[] = all
    .filter((e) => !junctions.has(e.name))
    .map((e) => {
      const { columns, primaryField, idField, links } = baseFieldsFromSchema(e)
      // A foreign key to a table outside the set stays a plain value.
      let kept = columns.map((d) => (d.fieldType === 'link' && !names.has(d.fieldProps.table) ? { ...d, field: links[d.field]!.column, id: links[d.field]!.column, header: title(links[d.field]!.column), fieldType: 'text', fieldProps: undefined } : d))
      // A text column that repeats a handful of values: a single select.
      kept = kept.map((d) => {
        const choices = d.fieldType === 'text' && d.field !== primaryField ? asChoices(options.values?.[e.name]?.[String(d.field)]) : null
        return choices ? { ...d, width: 140, fieldType: 'singleSelect', fieldProps: { options: choices.map((value, i) => ({ value, color: BRIGHT[i % BRIGHT.length]!.value })) } } : d
      })
      const keptLinks: Record<string, BaseLinkSpec> = Object.fromEntries(Object.entries(links).filter(([field]) => kept.some((d) => d.field === field)))
      return {
        id: e.name,
        name: e.label && e.label !== e.name ? e.label : title(e.name),
        primaryField,
        columns: kept,
        idField,
        serverIds: options.serverIds?.(e) ?? false,
        links: keptLinks,
      }
    })
  // A junction table: a link to many on its first table, through it.
  for (const [jname, j] of junctions) {
    const fromTable = j.from.relation!.entity
    const toTable = j.to.relation!.entity
    const owner = specs.find((s) => s.id === fromTable)
    if (!owner || !names.has(toTable)) continue
    const field = owner.columns.some((d) => d.field === toTable) ? `${toTable}_links` : toTable
    const target = specs.find((s) => s.id === toTable)
    owner.columns = [...owner.columns, { id: field, field, header: target?.name ?? title(toTable), width: 220, fieldType: 'link', fieldProps: { table: toTable, multiple: true } }]
    owner.links = { ...owner.links, [field]: { through: jname, from: j.from.relation!.foreignKey ?? j.from.field, to: j.to.relation!.foreignKey ?? j.to.field } }
  }
  // Every link gets the field that links back in the other table.
  if (options.inverses !== false) specs = withInverses(specs)
  if (options.views !== false) specs = specs.map((s) => ({ ...s, views: s.views ?? viewsFor(s) }))
  if (options.order === 'links') {
    // The table that points at the most others leads: orders before customers.
    const out = (s: BaseTableSpec) => Object.keys(s.links ?? {}).length
    specs = specs.map((s, i) => [s, i] as const).sort((a, b) => out(b[0]) - out(a[0]) || a[1] - b[1]).map(([s]) => s)
  }
  return specs
}

/** Every link gets the field that links back in the other table, unless it has one. */
export function withInverses(specs: BaseTableSpec[]): BaseTableSpec[] {
  let tables = specs.map((x) => ({ ...x, data: [] })) as BaseTable[]
  for (const t of [...tables]) for (const d of t.columns) if (d.fieldType === 'link' && d.fieldProps?.table !== t.id && !d.fieldProps?.inverse) tables = addInverse(tables, t.id, colId(d))
  return tables.map(({ data: _data, ...rest }) => rest as BaseTableSpec)
}

/** What a database's svgrid: comments say (see baseToSql), by SQL table and column. */
export type BaseComments = {
  tables: Map<string, BaseTableComment>
  columns: Map<string, Def>
  junctions: Map<string, BaseJunctionComment['junction']>
}

/**
 * Lay what the comments keep over the base read from the columns: each
 * field as it was (its type, options, format, name), the fields with no
 * column (formulas, rollups, buttons, the fields that link back), a link to
 * many under its own name, and the table's name, views and automations.
 */
export function applyBaseComments(specs: BaseTableSpec[], comments: BaseComments): BaseTableSpec[] {
  return specs.map((s0) => {
    const s: BaseTableSpec = { ...s0, columns: [...s0.columns], links: { ...(s0.links ?? {}) }, rename: { ...(s0.rename ?? {}) } }
    s.columns = s.columns.map((d) => {
      const field = String(d.field)
      const link = s.links![field]
      if (link && 'through' in link) {
        const j = comments.junctions.get(link.through)
        if (!j) return d
        delete s.links![field]
        s.links![j.field] = link
        return { ...d, id: j.field, field: j.field }
      }
      const sqlColumn = link ? link.column : field
      const def = comments.columns.get(`${s.id}.${sqlColumn}`)
      if (!def) return d
      const name = String(def.field)
      if (link) {
        delete s.links![field]
        s.links![name] = { column: sqlColumn }
      } else if (name !== sqlColumn) s.rename![name] = sqlColumn
      return { ...def, id: name, field: name }
    })
    const c = comments.tables.get(s.id)
    if (!c) return s
    // Fields with no column, and a link to many as it was defined.
    for (const e of c.extra) {
      const at = s.columns.findIndex((d) => String(d.field) === String(e.field))
      if (at >= 0) s.columns[at] = { ...e, id: e.field }
      else s.columns.push({ ...e, id: e.field })
    }
    const order = new Map(c.order.map((f, i) => [f, i]))
    s.columns.sort((a, b) => (order.get(String(a.field)) ?? 999) - (order.get(String(b.field)) ?? 999))
    return {
      ...s,
      name: c.name,
      ...(c.primaryField ? { primaryField: c.primaryField } : {}),
      ...(c.views ? { views: c.views as FieldView[] } : {}),
      ...(c.automations ? { automations: c.automations as BaseTable['automations'] } : {}),
    }
  })
}

/** A grid colored by the first select, a board by it, a calendar by the first date. */
function viewsFor(s: BaseTableSpec): FieldView[] {
  const select = s.columns.find((d) => d.fieldType === 'singleSelect')
  const date = s.columns.find((d) => d.fieldType === 'date')
  const views: FieldView[] = [{ id: 'grid', name: `All ${s.name.toLowerCase()}`, type: 'grid', ...(select ? { color: { mode: 'field', field: String(select.field) } } : {}) }]
  if (select) views.push({ id: 'board', name: `By ${String(select.header).toLowerCase()}`, type: 'kanban', stackBy: String(select.field) })
  if (date) views.push({ id: 'calendar', name: `${date.header} calendar`, type: 'calendar', dateField: String(date.field), ...(select ? { color: { mode: 'field', field: String(select.field) } } : {}) })
  return views
}

/**
 * Base tables from their specs: each gets a source from `sourceFor(table)`
 * (also called for a junction table, by its name).
 */
export function baseTablesFromSpec(
  specs: ReadonlyArray<BaseTableSpec>,
  sourceFor: (table: string, spec?: BaseTableSpec) => ServerDataSource<any>,
  options: (spec: BaseTableSpec) => Omit<BaseSourceOptions, 'links' | 'idField' | 'serverIds'> = () => ({}),
): BaseTable[] {
  return specs.map((s) => {
    const { links = {}, idField, serverIds, rename, ...table } = s
    const resolved: BaseSourceOptions['links'] = {}
    for (const [field, l] of Object.entries(links)) resolved[field] = 'through' in l ? { through: sourceFor(l.through), from: l.from, to: l.to, ...(l.idField ? { idField: l.idField } : {}) } : l
    return { ...table, data: [], source: baseSource(sourceFor(s.id, s), { ...options(s), links: resolved, idField, serverIds, ...(rename && Object.keys(rename).length ? { columns: rename } : {}) }) }
  })
}

/**
 * Base tables for a set of database tables, each on its own source, with a
 * field that links back for every foreign key between them.
 *
 * ```ts
 * const schemas = await Promise.all(['projects', 'tasks'].map((table) => introspectSupabaseTable({ url, key, table })))
 * tables = baseTablesFromSchemas(schemas, (s) => createSupabaseDataSource({ client, table: s.name, schema: s }))
 * ```
 */
export function baseTablesFromSchemas(
  entities: ReadonlyArray<EntitySchema | null | undefined>,
  sourceFor: (entity: EntitySchema) => ServerDataSource<any>,
  options: (entity: EntitySchema) => Omit<BaseSourceOptions, 'links' | 'idField'> = () => ({}),
): BaseTable[] {
  const list = entities.filter((e): e is EntitySchema => !!e)
  const byName = new Map(list.map((e) => [e.name, e]))
  const specs = baseSpecFromSchemas(list, { views: false, serverIds: (e) => !!options(e).serverIds })
  return baseTablesFromSpec(
    specs.map((s) => ({ ...s, views: s.views ?? [{ id: 'grid', name: 'Grid view', type: 'grid' }] })),
    (table) => sourceFor(byName.get(table)!),
    (s) => {
      const { serverIds: _s, ...rest } = options(byName.get(s.id)!)
      return rest
    },
  )
}
