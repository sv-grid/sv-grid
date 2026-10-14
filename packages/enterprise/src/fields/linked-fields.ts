/**
 * A linked table's fields as columns a record view can draw: each declared
 * field filled in by its type, or every key of the record when the table
 * declares none.
 */
import { fillFieldColumn } from './registry.svelte'
import { idOf, rowsOf, type LinkedField, type LinkedTable } from './sources.svelte'

export function linkedFields(table: LinkedTable, row?: Record<string, unknown>): LinkedField[] {
  const declared = table.fields?.length
    ? table.fields
    : Object.keys(row ?? {})
        .filter((k) => k !== 'id')
        .map((k) => ({ field: k, header: k }))
  const withPrimary = declared.some((f) => f.field === table.primaryField) ? declared : [{ field: table.primaryField, header: 'Name' }, ...declared]
  // A rollup or count reads a link field of the same table: every field is its context.
  const all = withPrimary.map((f) => ({ id: f.field, ...f }))
  return withPrimary.map((f) => {
    const typed = 'fieldType' in f && f.fieldType
    const def = typed ? fillFieldColumn({ field: f.field, header: f.header, fieldType: f.fieldType, fieldProps: (f as { fieldProps?: Record<string, unknown> }).fieldProps }, all) : { field: f.field, header: f.header }
    return { id: f.field, header: f.header, def }
  })
}

/** A field's value in a linked record: computed for a formula, lookup, rollup or count. */
export function linkedValue(f: LinkedField, row: Record<string, unknown>): unknown {
  const fn = f.def.fieldFn as ((r: Record<string, unknown>) => unknown) | undefined
  return fn ? fn(row) : row[f.def.field]
}

/** A record of the table by id. */
export function linkedRow(table: LinkedTable, rowId: string): Record<string, unknown> | undefined {
  return rowsOf(table).find((r) => idOf(table, r) === rowId)
}

/** A value as the field shows it, as text. */
export function linkedText(f: LinkedField, value: unknown, row: unknown): string {
  const fmt = f.def.formatter as ((c: { value: unknown; row: unknown; column: unknown }) => unknown) | undefined
  if (fmt) return String(fmt({ value, row, column: { id: f.id, columnDef: f.def } }) ?? '')
  if (Array.isArray(value)) return value.join(', ')
  return value == null ? '' : String(value)
}
