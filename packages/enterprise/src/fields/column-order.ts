/**
 * The full column order with the shown columns in `visual` order and every
 * other column (hidden ones) left in its slot, so reordering what is shown
 * does not move what is hidden. (The grid's pin splitter keeps the same rule.)
 */
export function orderKeepingScreen(base: ReadonlyArray<string>, visual: ReadonlyArray<string>): string[] {
  const inBase = new Set(base)
  const shown = visual.filter((id) => inBase.has(id))
  const shownSet = new Set(shown)
  let i = 0
  return base.map((id) => (shownSet.has(id) ? (shown[i++] ?? id) : id))
}
