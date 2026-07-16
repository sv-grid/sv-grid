/**
 * withEntityRules - apply an `EntitySchema`'s computed fields and lifecycle
 * hooks to any `ServerDataSource`, at the mutation boundary. It's a transparent
 * wrapper: pass the result to `createServerDataSource` (or straight to the grid)
 * and every read row gets its computed fields materialized, while writes run the
 * schema's before/after hooks and cross-field validation.
 *
 *   const source = withEntityRules(createSqlDataSource(...), orderSchema)
 *
 * - `getRows`   -> each row through `applyComputed` (grid can sort/filter the
 *                  computed value within the fetched page).
 * - `createRow` -> `hooks.validate` + `hooks.beforeCreate` (may transform the
 *                  payload or throw), then `applyComputed` on the returned row,
 *                  then `hooks.afterCreate`.
 * - `updateRow` -> the same with `beforeUpdate` / `afterUpdate`.
 * - `deleteRow` -> `hooks.beforeDelete` (throw to veto) then `hooks.afterDelete`.
 *
 * Optional write methods stay optional, and any extra source capabilities
 * (`getAggregate`, `rows()`) pass through untouched. Returning `applyComputed`
 * rows from every method keeps the controller's optimistic reconciliation
 * correct (a source must return the same row shape from all methods).
 */
import type { RowData, ServerDataSource } from '@svgrid/grid'
import { applyComputed, validateEntity, type EntitySchema } from '../schema'

function firstError(errors: Record<string, string>): string {
  return Object.values(errors)[0] ?? 'Validation failed'
}

export function withEntityRules<TData extends RowData, S extends ServerDataSource<TData>>(
  source: S,
  schema: EntitySchema<TData>,
): S {
  const hooks = schema.hooks ?? {}
  const compute = (row: TData) => applyComputed(schema, row)

  const wrapped: ServerDataSource<TData> = {
    async getRows(request) {
      const res = await source.getRows(request)
      return { ...res, rows: res.rows.map(compute) }
    },
  }

  if (source.createRow) {
    const create = source.createRow.bind(source)
    wrapped.createRow = async (input) => {
      const errors = await validateEntity(schema, input)
      if (Object.keys(errors).length) throw new Error(firstError(errors))
      const payload = hooks.beforeCreate ? await hooks.beforeCreate(input) : input
      const row = compute(await create(payload))
      await hooks.afterCreate?.(row)
      return row
    }
  }

  if (source.updateRow) {
    const update = source.updateRow.bind(source)
    wrapped.updateRow = async (id, patch) => {
      const errors = await validateEntity(schema, patch)
      if (Object.keys(errors).length) throw new Error(firstError(errors))
      const payload = hooks.beforeUpdate ? await hooks.beforeUpdate(id, patch) : patch
      const row = compute(await update(id, payload))
      await hooks.afterUpdate?.(row)
      return row
    }
  }

  if (source.deleteRow) {
    const del = source.deleteRow.bind(source)
    wrapped.deleteRow = async (id) => {
      await hooks.beforeDelete?.(id)
      await del(id)
      await hooks.afterDelete?.(id)
    }
  }

  return { ...source, ...wrapped } as S
}
