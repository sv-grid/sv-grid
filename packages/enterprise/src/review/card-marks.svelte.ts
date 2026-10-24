/**
 * Pending proposals on board and gallery cards. A card renderer gets the grid's
 * rows and its `getRowId`, not the grid api, so a review registers itself by
 * that function (the same object it reads through `api.getOption`; SvGrid
 * Base keeps one per table) and a card asks for its row's mark.
 *
 * Small and on its own: the board and gallery import it without the review
 * module. The registry is reactive: a card drawn before its review registered
 * (the grid api arrives after the first draw) draws again when it does.
 */

export type CardMark = {
  count: number
  /** "Region -> EMEA, Phone -> 555-123-4567", for the card's title. */
  text: string
}

type Source = {
  cardMark(rowId: string): CardMark | null
  /** Whether a row object is one of this review's grid rows. */
  owns(row: unknown): boolean
}

// Several grids can share one getRowId function (Svelte hoists a static inline
// arrow), so a function maps to every review that registered it, and a card
// takes its mark from the review whose grid holds its row.
const sources = new WeakMap<object, Set<Source>>()
let generation = $state(0)

/** Called by a review once its grid's `getRowId` is known. */
export function registerCardMarks(getRowId: object, source: Source): void {
  const list = sources.get(getRowId) ?? new Set<Source>()
  list.add(source)
  sources.set(getRowId, list)
  // Registration runs while the grid reads its columns or formats, where state
  // must not change; the cards hear about it a microtask later.
  queueMicrotask(() => (generation += 1))
}

/** The mark for a card's row, or null (no review on this grid, or nothing pending). */
export function cardMarkFor(getRowId: ((row: any, index: number) => string) | undefined, row: unknown, index: number): CardMark | null {
  void generation
  if (!getRowId) return null
  const list = sources.get(getRowId)
  if (!list) return null
  for (const source of list) if (source.owns(row)) return source.cardMark(String(getRowId(row, index)))
  return null
}
