/**
 * virtual - a tiny, framework-free fixed-row windowing helper shared by the
 * selection controls so their option lists scale to tens of thousands of rows
 * without rendering them all. The renderer measures the viewport + tracks
 * scrollTop (DOM concerns) and passes them in; this returns the slice to render
 * plus the top/bottom spacer heights that keep the scrollbar honest.
 */
export type VirtualRange = {
  /** First item index to render (inclusive). */
  start: number
  /** Last item index to render (exclusive). */
  end: number
  /** Spacer height above the rendered slice (px). */
  padTop: number
  /** Spacer height below the rendered slice (px). */
  padBottom: number
  /** Total scrollable height of all rows (px). */
  totalHeight: number
}

export type VirtualParams = {
  scrollTop: number
  viewportHeight: number
  rowHeight: number
  count: number
  /** Extra rows rendered above/below the viewport to avoid blank flashes. */
  overscan?: number
}

/** Compute the visible window for a fixed-row-height list (pure). */
export function virtualRange(params: VirtualParams): VirtualRange {
  const { scrollTop, viewportHeight, rowHeight, count } = params
  const overscan = params.overscan ?? 6
  const total = Math.max(0, count) * Math.max(0, rowHeight)
  if (rowHeight <= 0 || count <= 0) {
    return { start: 0, end: Math.max(0, count), padTop: 0, padBottom: 0, totalHeight: total }
  }
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight)
  const start = Math.max(0, first - overscan)
  const visible = Math.max(1, Math.ceil(Math.max(0, viewportHeight) / rowHeight))
  const end = Math.min(count, first + visible + overscan)
  return {
    start,
    end,
    padTop: start * rowHeight,
    padBottom: Math.max(0, (count - end) * rowHeight),
    totalHeight: total,
  }
}

/**
 * The scrollTop that brings item `index` fully into a fixed-row viewport,
 * scrolling the least amount (returns the current scrollTop if already visible).
 * Pure - the renderer applies it to the element.
 */
export function scrollToIndex(
  index: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
): number {
  const top = index * rowHeight
  const bottom = top + rowHeight
  if (top < scrollTop) return top
  if (bottom > scrollTop + viewportHeight) return bottom - viewportHeight
  return scrollTop
}
