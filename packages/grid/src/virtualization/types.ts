export type VirtualItem = {
  index: number
  start: number
  size: number
  end: number
  key: string
}

export type VirtualizerOptions = {
  count: number
  /**
   * Per-item size. Pass a number for a uniform layout (fast path) or a
   * function for variable sizing - the virtualizer will build cumulative
   * offsets and use binary lookup to find the visible window. The function
   * receives the item index and must return its pixel size.
   */
  estimateSize: number | ((index: number) => number)
  overscan?: number
  /**
   * Items kept on the side the scroll is moving away from (`overscan` is kept
   * ahead of it). Defaults to `overscan`, a symmetric window. Before the
   * first scroll there is no direction and both sides get `overscan`.
   */
  overscanBehind?: number
  /**
   * Keep the rendered window while a scroll leaves at least this many items
   * rendered ahead of it, and move the window only when the scroll runs past
   * that: the window is then rebuilt with the full `overscan` ahead, so it
   * moves `overscan - overscanMin + 1` items at a time instead of one. Each
   * move costs about the same whether one item enters or several, so fewer,
   * larger moves are less work, and the scroll frames in between change
   * nothing. A window built at rest, or after a jump to items outside the
   * rendered window, carries `overscanMin` instead of `overscan`. Undefined
   * moves the window on every item boundary, always with `overscan`.
   */
  overscanMin?: number
  viewportHeight: number
  scrollOffset?: number
  /** Internal: the sign of the last scroll movement (-1, 0, 1). */
  scrollDirection?: number
}

export type VirtualizerState = {
  items: Array<VirtualItem>
  totalSize: number
  startIndex: number
  endIndex: number
  scrollOffset: number
  viewportHeight: number
}
