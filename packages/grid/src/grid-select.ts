/**
 * grid-select - pure helper behind <SvGridSelect>: filter option rows by a
 * free-text query across a set of fields (case-insensitive substring match).
 * Framework-free + pure so it is unit-tested directly.
 */
export type Row = Record<string, unknown>

/** Rows where ANY of `fields` contains `query` (case-insensitive). Blank query
 *  returns every row. */
export function filterGridRows<T extends Row>(
  rows: ReadonlyArray<T>,
  fields: ReadonlyArray<string>,
  query: string,
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...rows]
  return rows.filter((row) =>
    fields.some((f) => String(row[f] ?? '').toLowerCase().includes(q)),
  )
}
