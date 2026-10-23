/**
 * The filter operators modules added through the grid extension's
 * `filterOperators`, kept in a plain module: the server path
 * (`toServerFilterColumns`) is runes-free and must not import
 * grid-extension.svelte.ts. `registerGridExtension` fills it.
 */
import type { GridFilterOperator } from './grid-extension.svelte'

export const addedFilterOperators: Record<string, GridFilterOperator> = {}
