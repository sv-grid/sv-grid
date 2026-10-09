/**
 * The row model for windowed data (see windowed-data.ts).
 *
 * No build loop and no pipeline stages: `rows` is itself windowed. A row
 * object is made the first time an index is read and kept (up to
 * WINDOWED_ROW_CAP) while its data object is the same one, so scrolling back
 * does not rebuild what is still loaded, and scrolling a 100M-row source end
 * to end keeps a few thousand rows, not 100M.
 *
 * Installed into the core by the first createWindowedData() call rather than
 * imported by core.ts, so a grid that is never handed windowed data does not
 * bundle any of this.
 */
import {
  BASE_ROW_METHODS,
  ROW_CELLS,
  ROW_CTX,
  ROW_FILTER_GEN,
  ROW_FILTER_POS,
  ROW_SORT_DROPPED,
  ROW_SORT_KEY,
  ROW_VALUES,
  registerWindowedRowModel,
  type BaseRowCtx,
  type BaseRowState,
  type Column,
  type Row,
  type RowData,
  type RowModel,
} from './core'
import { makeWindowedArray, windowedSourceOf } from './windowed-brand'

/** The windowed-data version a row's memoised values belong to. */
const ROW_WINDOW_GEN = Symbol('svgrid.row.windowGen')
const WINDOWED_ROW_CAP = 20_000

let installed = false

export function enableWindowedRowModel(): void {
  if (installed) return
  installed = true
  registerWindowedRowModel(<TData extends RowData>(ctx: {
    rowCtxFor: (columns: Array<Column<TData>>) => BaseRowCtx<TData>
    getRowId: () => ((row: TData, index: number) => string) | undefined
  }) => {
    // Per grid: the model for the current input, and the row objects built
    // so far, by index.
    let current: { input: unknown; columns: Array<Column<TData>>; model: RowModel<TData> } | null = null
    const rows = new Map<number, BaseRowState<TData>>()
    let generation = 0

    return (data: unknown, columns: Array<Column<TData>>): RowModel<TData> | null => {
      const source = windowedSourceOf<TData>(data)
      if (!source) return null
      if (current && current.input === data && current.columns === columns) return current.model
      if (!current || current.columns !== columns) rows.clear()
      const rowCtx = ctx.rowCtxFor(columns)
      const getRowId = ctx.getRowId()
      const gen = ++generation
      const m = BASE_ROW_METHODS as unknown as BaseRowState<TData>
      const rowAt = (index: number): Row<TData> | undefined => {
        if (index < 0 || index >= source.length) return undefined
        const original = source.at(index)
        if (original === undefined) return undefined
        const kept = rows.get(index) as (BaseRowState<TData> & { [ROW_WINDOW_GEN]?: number }) | undefined
        if (kept && kept.original === original) {
          // A new data version may follow an in-place edit of the object, as
          // in the dense path: drop the memoised values once per version.
          if (kept[ROW_WINDOW_GEN] !== gen) {
            kept[ROW_VALUES] = null
            kept[ROW_CELLS] = null
            kept[ROW_WINDOW_GEN] = gen
          }
          return kept
        }
        const row = {
          id: getRowId ? getRowId(original, index) : String(index),
          index,
          original,
          depth: 0,
          [ROW_CTX]: rowCtx,
          [ROW_VALUES]: null,
          [ROW_CELLS]: null,
          [ROW_FILTER_GEN]: 0,
          [ROW_FILTER_POS]: -1,
          [ROW_SORT_DROPPED]: 0,
          [ROW_SORT_KEY]: undefined,
          [ROW_WINDOW_GEN]: gen,
          getCanExpand: m.getCanExpand,
          getIsExpanded: m.getIsExpanded,
          toggleExpanded: m.toggleExpanded,
          getIsSelected: m.getIsSelected,
          toggleSelected: m.toggleSelected,
          getAllCells: m.getAllCells,
          getCellValueByColumnId: m.getCellValueByColumnId,
        } as unknown as BaseRowState<TData>
        rows.set(index, row)
        if (rows.size > WINDOWED_ROW_CAP) {
          // Oldest first (Map keeps insertion order); a quarter at a time.
          let drop = WINDOWED_ROW_CAP / 4
          for (const key of rows.keys()) {
            if (drop-- <= 0) break
            rows.delete(key)
          }
        }
        return row
      }
      const model: RowModel<TData> = { rows: makeWindowedArray(source.length, rowAt) as Array<Row<TData>> }
      current = { input: data, columns, model }
      return model
    }
  })
}
