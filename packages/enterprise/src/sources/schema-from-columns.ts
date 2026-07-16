/**
 * The shared "columns -> EntitySchema" core. Every introspection path (SQL
 * catalog, PostgREST/OpenAPI, a sample row, manual entry) discovers columns in
 * its own way, then hands a normalized list here to assemble a consistent
 * `EntitySchema` - primary key resolution, readonly on the key, enum options,
 * and a sane default type. Keeping this in one place means the grid + form come
 * out identical no matter which path found the columns.
 */
import type { RowData } from '@svgrid/grid'
import type { EntityField, EntityFieldType, EntitySchema } from '../schema.js'

/** A discovered foreign key: this column references `table`.`column`. */
export type ColumnReference = {
  /** Referenced table (becomes the relation's `entity`). */
  table: string
  /** Referenced column (usually the related PK). */
  column?: string
  /** Field on the related entity to show the user. Defaults to `'name'`. */
  labelField?: string
}

/** One discovered column, backend-neutral. */
export type IntrospectedColumn = {
  name: string
  /** Actual DB column, when it differs from `name` (e.g. Drizzle `created_at` vs key `createdAt`). */
  dbColumn?: string
  /** High-level type. Defaults to `'text'` when a path can't determine it. */
  type?: EntityFieldType
  primaryKey?: boolean
  /** NOT NULL (becomes a required, non-key field). */
  required?: boolean
  /** Allowed values, for enum columns. */
  enumValues?: string[]
  /** Foreign key: makes this a `relation` field with a searchable lookup. */
  references?: ColumnReference
}

/** Assemble an EntitySchema from discovered columns. */
export function buildEntitySchema<TData extends RowData = RowData>(
  table: string,
  columns: IntrospectedColumn[],
): EntitySchema<TData> {
  if (!columns.length) throw new Error(`buildEntitySchema: "${table}" has no columns`)

  // Primary key: first flagged pk, else a column literally named "id", else the
  // first column (so update/delete always have a key to target).
  const explicitPk = columns.find((c) => c.primaryKey)?.name
  const idField = explicitPk ?? columns.find((c) => /^id$/i.test(c.name))?.name ?? columns[0]!.name

  const fields: EntityField<TData>[] = columns.map((c) => {
    const isPk = c.name === idField
    // A foreign-key column (that isn't the PK) becomes a relation field, so the
    // form renders a lookup and master-detail can be inferred.
    if (c.references && !isPk) {
      const rel = { field: c.name, type: 'relation' as const } as EntityField<TData>
      rel.relation = {
        entity: c.references.table,
        foreignKey: c.name,
        labelField: c.references.labelField ?? 'name',
      }
      if (c.dbColumn) rel.dbColumn = c.dbColumn
      if (c.required) rel.required = true
      return rel
    }

    const type: EntityFieldType = c.enumValues?.length ? 'enum' : (c.type ?? 'text')
    const f = { field: c.name, type } as EntityField<TData>
    if (c.dbColumn) f.dbColumn = c.dbColumn
    if (isPk) {
      f.primaryKey = true
      f.readonly = true
    } else if (c.required) {
      f.required = true
    }
    if (type === 'enum' && c.enumValues?.length) {
      f.options = c.enumValues.map((v) => ({ value: v, label: v }))
    }
    return f
  })

  return { name: table, label: table, idField, fields }
}

// Schema-level relation helpers live in ../schema (studio consumes them under
// node16 resolution); re-exported here so introspection consumers get one entry.
export { pickLabelField, linkRelationLabels } from '../schema.js'
