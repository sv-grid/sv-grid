/**
 * An `EntitySchema` read off the rows themselves, for a worker data source
 * that was handed plain objects. The in-memory source only filters, sorts and
 * groups on fields its schema declares, and the type decides how a request's
 * string values are compared: `'35'` is a number for a number field and text
 * for a text one.
 */
import type { RowData } from '@svgrid/grid'
import type { EntityField, EntityFieldType, EntitySchema } from '../schema'

/** Rows read to decide each field's type. */
const SAMPLE_SIZE = 200

export type InferSchemaOptions = {
  /** The row id field. Default: `id` when the rows have one, else the first field. */
  idField?: string
  /** The schema's name. Default `rows`. */
  name?: string
}

/**
 * A field is `number` or `boolean` when every non-empty sampled value is one,
 * and `text` otherwise. Dates come out as `text`: send them as ISO strings,
 * which sort and compare correctly as text, or as epoch numbers.
 */
export function inferSchemaFromRows<TData extends RowData>(
  rows: ReadonlyArray<TData>,
  options: InferSchemaOptions = {},
): EntitySchema<TData> {
  const sample = rows.slice(0, SAMPLE_SIZE)
  const seen = new Map<string, Set<string>>()
  for (const row of sample) {
    for (const [field, value] of Object.entries(row)) {
      let kinds = seen.get(field)
      if (!kinds) seen.set(field, (kinds = new Set()))
      if (value != null && value !== '') kinds.add(typeof value)
    }
  }
  const fields = [...seen].map(([field, kinds]): EntityField<TData> => {
    let type: EntityFieldType = 'text'
    if (kinds.size === 1 && kinds.has('number')) type = 'number'
    else if (kinds.size === 1 && kinds.has('boolean')) type = 'boolean'
    return { field: field as EntityField<TData>['field'], type }
  })
  const idField = options.idField ?? (seen.has('id') ? 'id' : fields[0]?.field) ?? 'id'
  return {
    name: options.name ?? 'rows',
    idField: idField as EntitySchema<TData>['idField'],
    fields,
  }
}
