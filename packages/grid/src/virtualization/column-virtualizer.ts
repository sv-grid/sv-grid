import { createVirtualizer } from './virtualizer'

export type ColumnSizeEstimator = (index: number) => number

export function createColumnVirtualizer(input: {
  count: number
  viewportWidth: number
  scrollOffset?: number
  overscan?: number
  /** Either a uniform size (number) or a per-column size function. */
  estimateSize?: number | ColumnSizeEstimator
}) {
  const virtualizer = createVirtualizer({
    count: input.count,
    estimateSize: input.estimateSize ?? 140,
    viewportHeight: input.viewportWidth,
    scrollOffset: input.scrollOffset ?? 0,
    overscan: input.overscan ?? 4,
  })

  return {
    ...virtualizer,
    setViewportWidth(viewportWidth: number) {
      virtualizer.setViewportHeight(viewportWidth)
    },
    setHorizontalOffset(scrollOffset: number) {
      virtualizer.setScrollOffset(scrollOffset)
    },
  }
}
