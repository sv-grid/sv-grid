/**
 * list-nav - the pure, framework-free navigation math shared by the roving-focus
 * cores (createListbox, createPopoverSelect, createMenu). No runes, no DOM - just
 * index arithmetic, so it is unit-testable on its own and behaves identically
 * everywhere. The cores wrap these in `$state`.
 */

/** Indices of items that can take roving focus / selection - i.e. the ones the
 *  caller does not mark disabled. `count` is the total item count; `isDisabled`
 *  is consulted per index (a separator counts as disabled to the caller). */
export function enabledIndices(count: number, isDisabled?: (index: number) => boolean): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i++) if (!isDisabled?.(i)) out.push(i)
  return out
}

/**
 * The next index when moving `delta` steps through `list`, wrapping around the
 * ends. `current` need not be in `list` (it may sit on a disabled item): when it
 * is absent we start just before the head so `delta: 1` lands on the first entry
 * and `delta: -1` on the last-but-one - the same behaviour every existing core
 * already had. Returns `-1` for an empty list.
 */
export function wrapMove(list: readonly number[], current: number, delta: number): number {
  const len = list.length
  if (len === 0) return -1
  const pos = list.indexOf(current)
  return list[(pos + delta + len) % len]!
}
