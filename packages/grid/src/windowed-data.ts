/**
 * Windowed data: an array the grid can index without anyone having built it.
 *
 * A server row model knows how many rows there are and holds a few blocks of
 * them. Handing the grid a dense array of `rowCount` entries (placeholders
 * for everything not loaded) made every block landing cost O(rowCount): the
 * array itself, a copy in the controller, and a row object per entry in the
 * core. At 10M rows that was ~1 GB of heap and ~1 s per block; at 100M the
 * grid never painted.
 *
 * `createWindowedData(length, at)` returns a real `Array` (a Proxy over one)
 * whose `length` is the row count and whose entries are read through `at(i)`
 * on demand. The grid recognises it (`windowedSourceOf`) and builds row
 * objects only for the indices it actually reads - the rows on screen, plus
 * whatever a user action touches. Iterating one still works (it is an array),
 * but costs O(length), so the grid's per-update paths check for it first.
 *
 * Windowed data is final: the source has already sorted, filtered and grouped
 * it, so the grid's own sort / filter / group stages do not run over it.
 *
 * The row model that reads it (windowed-row-model.ts) is installed by the
 * first call here, so a grid never handed windowed data does not bundle it.
 */
import { makeWindowedArray } from './windowed-brand'
import { enableWindowedRowModel } from './windowed-row-model'

export { windowedSourceOf, isWindowedData, type WindowedSource } from './windowed-brand'

/**
 * An array of `length` entries read through `at(i)`. Each call returns a new
 * array identity, which is how a source tells the grid its rows changed.
 */
export function createWindowedData<T>(length: number, at: (index: number) => T | undefined): T[] {
  enableWindowedRowModel()
  return makeWindowedArray(length, at)
}
