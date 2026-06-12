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
  viewportHeight: number
  scrollOffset?: number
}

export type VirtualizerState = {
  items: Array<VirtualItem>
  totalSize: number
  startIndex: number
  endIndex: number
  scrollOffset: number
  viewportHeight: number
}
