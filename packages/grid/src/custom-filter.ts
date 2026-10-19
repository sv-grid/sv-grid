import type { CustomColumnFilter, RowData } from './core'

/**
 * Whether a column's custom-filter model narrows anything. The column's own
 * `isActive` decides when it has one; otherwise a model is active unless it
 * is `null`, `undefined`, an empty string or an empty array.
 */
export function customFilterIsActive<TData extends RowData>(
  filter: CustomColumnFilter<TData> | undefined,
  model: unknown,
): boolean {
  if (!filter) return false
  if (filter.isActive) return filter.isActive(model)
  if (model == null || model === '') return false
  if (Array.isArray(model) && model.length === 0) return false
  return true
}
