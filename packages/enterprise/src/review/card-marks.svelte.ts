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

type Source = { cardMark(rowId: string): CardMark | null }

const sources = new WeakMap<object, Source>()
let generation = $state(0)

/** Called by a review once its grid's `getRowId` is known. */
export function registerCardMarks(getRowId: object, source: Source): void {
  sources.set(getRowId, source)
  // Registration runs while the grid reads its columns or formats, where state
  // must not change; the cards hear about it a microtask later.
  queueMicrotask(() => (generation += 1))
}

/** The mark for a card's row, or null (no review on this grid, or nothing pending). */
export function cardMarkFor(getRowId: ((row: any, index: number) => string) | undefined, row: unknown, index: number): CardMark | null {
  void generation
  if (!getRowId) return null
  const source = sources.get(getRowId)
  return source ? source.cardMark(String(getRowId(row, index))) : null
}
