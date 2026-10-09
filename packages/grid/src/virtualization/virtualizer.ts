import type { VirtualItem, VirtualizerOptions, VirtualizerState } from './types'

type VirtualizerListener = () => void

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function sameOptions(a: VirtualizerOptions, b: VirtualizerOptions) {
  return (
    a.count === b.count &&
    a.estimateSize === b.estimateSize &&
    (a.overscan ?? 6) === (b.overscan ?? 6) &&
    a.overscanBehind === b.overscanBehind &&
    a.overscanMin === b.overscanMin &&
    a.viewportHeight === b.viewportHeight &&
    (a.scrollOffset ?? 0) === (b.scrollOffset ?? 0)
  )
}

function sameState(a: VirtualizerState, b: VirtualizerState) {
  if (
    a.totalSize !== b.totalSize ||
    a.startIndex !== b.startIndex ||
    a.endIndex !== b.endIndex ||
    a.viewportHeight !== b.viewportHeight ||
    a.items.length !== b.items.length
  ) {
    return false
  }
  // Per-item start+size check: catches column-resize cases where the total
  // is unchanged (e.g. column A grew, column B shrunk to compensate under
  // fit-to-width). Without this, the virtualizer skips the emit and the
  // grid renders with stale widths.
  for (let i = 0; i < a.items.length; i += 1) {
    const ai = a.items[i]!
    const bi = b.items[i]!
    if (ai.index !== bi.index || ai.start !== bi.start || ai.size !== bi.size || ai.key !== bi.key) return false
  }
  return true
}

// Slot-based keying: the key is a SLOT number, not the data index, so the
// same N <tr> nodes stay alive for the lifetime of the grid and scrolling
// never mounts or unmounts a row. With data-index keys, scrolling down one
// row meant the old topmost key disappeared and a new bottommost key
// appeared, so Svelte unmounted the top <tr> and mounted a fresh one at the
// bottom on every scroll tick.
//
// The slot for data index i is `i mod N`, N being the window length. That
// matters for what a one-row scroll costs: while N holds, a row that stays
// inside the window keeps its slot, so Svelte keeps its <tr> and touches
// nothing in it, and only the row that entered gets new content - the keyed
// each moves that one <tr> to the other end with a single `insertBefore`.
// The earlier `i - startIndex` slot scheme handed EVERY rendered row a new
// index on every one-row scroll, so an arrow key re-rendered all ~30 rows x
// every rendered column to shift the data up by one.
//
// The modulus has to be EXACTLY N, not merely >= N: under a larger modulus
// the window's residues are a proper subset, so each one-row scroll drops
// one residue and picks up another, and Svelte unmounts a <tr> and mounts a
// fresh one instead of moving it (measured: mount + unmount per arrow key,
// zero moves). When N changes - the top and bottom overscan clamping on the
// first and last rows, a resize, variable row heights - every slot remaps
// and the whole window re-renders once, which is what the old scheme did on
// every tick.
function slotKey(index: number, windowLength: number): string {
  return `virtual_slot_${index % windowLength}`
}

function buildUniformItems(
  startIndex: number,
  endIndex: number,
  estimateSize: number,
): Array<VirtualItem> {
  const items: Array<VirtualItem> = []
  const windowLength = endIndex - startIndex + 1
  for (let index = startIndex; index <= endIndex; index += 1) {
    const start = index * estimateSize
    items.push({
      index,
      start,
      size: estimateSize,
      end: start + estimateSize,
      key: slotKey(index, windowLength),
    })
  }
  return items
}

/**
 * The window to render when no DOM measurement exists yet.
 *
 * The virtualizer learns its real `count` from an effect, and effects do not
 * run during SSR - so on a server it still thinks `count` is 0 and returns an
 * empty window. That is why `<SvGrid>` used to emit an empty `<tbody>`: the
 * rows were in the row model, but nothing asked for them. Crawlers and no-JS
 * clients saw an empty shell.
 *
 * Deliberately deterministic - anchored at index 0 with no scroll offset - so
 * the server and the first client render produce identical markup and
 * hydration does not mismatch. The measuring effect replaces it a tick later.
 */
export function buildPreMeasureItems(
  count: number,
  estimateSize: number,
  viewportHeight: number,
  overscan: number,
): Array<VirtualItem> {
  if (count <= 0) return []
  const size = Math.max(estimateSize, 1)
  const visible = Math.ceil(Math.max(viewportHeight, 0) / size)
  const endIndex = Math.max(Math.min(visible + Math.max(overscan, 0), count - 1), 0)
  return buildUniformItems(0, endIndex, size)
}

function buildVariableItems(
  startIndex: number,
  endIndex: number,
  offsets: Array<number>,
): Array<VirtualItem> {
  const items: Array<VirtualItem> = []
  const windowLength = endIndex - startIndex + 1
  for (let index = startIndex; index <= endIndex; index += 1) {
    const start = offsets[index] ?? 0
    const end = offsets[index + 1] ?? start
    items.push({
      index,
      start,
      size: end - start,
      end,
      key: slotKey(index, windowLength),
    })
  }
  return items
}

/** The items under the viewport at the current scroll offset, before any
 *  overscan. */
function visibleRange(
  options: VirtualizerOptions,
  /** Pre-built cumulative offsets for the variable-size path. */
  offsets: Array<number> | null,
) {
  const count = Math.max(options.count, 0)
  const viewportHeight = Math.max(options.viewportHeight, 0)

  if (typeof options.estimateSize === 'function' && offsets) {
    const totalSize = offsets[count] ?? 0
    const maxOffset = Math.max(totalSize - viewportHeight, 0)
    const scrollOffset = clamp(options.scrollOffset ?? 0, 0, maxOffset)

    // First index whose end > scrollOffset.
    let lo = 0
    let hi = count
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if ((offsets[mid + 1] ?? 0) <= scrollOffset) lo = mid + 1
      else hi = mid
    }
    const visibleStart = lo

    // First index whose start >= scrollOffset + viewportHeight.
    const viewportEnd = scrollOffset + viewportHeight
    lo = visibleStart
    hi = count
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if ((offsets[mid] ?? 0) < viewportEnd) lo = mid + 1
      else hi = mid
    }
    const visibleEnd = Math.max(lo - 1, visibleStart)
    return { count, viewportHeight, totalSize, scrollOffset, visibleStart, visibleEnd, uniformSize: 0 }
  }

  // Uniform-size fast path (original behavior).
  const uniformSize = Math.max(
    typeof options.estimateSize === 'number' ? options.estimateSize : 1,
    1,
  )
  const totalSize = count * uniformSize
  const maxOffset = Math.max(totalSize - viewportHeight, 0)
  const scrollOffset = clamp(options.scrollOffset ?? 0, 0, maxOffset)

  const visibleStart = Math.floor(scrollOffset / uniformSize)
  const visibleCount = Math.ceil(viewportHeight / uniformSize)
  const visibleEnd = Math.min(visibleStart + visibleCount, Math.max(count - 1, 0))
  return { count, viewportHeight, totalSize, scrollOffset, visibleStart, visibleEnd, uniformSize }
}

function createState(
  options: VirtualizerOptions,
  /** Pre-built cumulative offsets for the variable-size path. */
  offsets: Array<number> | null,
  /** The scroll moved on from the window already rendered. With
   *  `overscanMin`, only then does the full `overscan` go ahead; a window
   *  built at rest or after a jump carries `overscanMin`, so a thumb drag
   *  that jumps every frame renders no more than it needs. */
  scrolling = false,
): VirtualizerState {
  const full = Math.max(options.overscan ?? 6, 0)
  const overscan =
    options.overscanMin === undefined || scrolling ? full : clamp(options.overscanMin, 0, full)
  // The overscan goes ahead of the scroll and `overscanBehind` behind it:
  // items behind the movement were just scrolled past, and a horizontal
  // scroll that kept three columns on each side drew ~40% more cells than it
  // needed to (350 vs 275 in the wide benchmark).
  const behind = Math.min(Math.max(options.overscanBehind ?? full, 0), overscan)
  const direction = options.scrollDirection ?? 0
  const overscanBefore = direction > 0 ? behind : overscan
  const overscanAfter = direction < 0 ? behind : overscan
  const { count, viewportHeight, totalSize, scrollOffset, visibleStart, visibleEnd, uniformSize } =
    visibleRange(options, offsets)

  const startIndex = count === 0 ? 0 : clamp(visibleStart - overscanBefore, 0, count - 1)
  const endIndex = count === 0 ? -1 : clamp(visibleEnd + overscanAfter, 0, count - 1)

  let items: Array<VirtualItem> = []
  if (endIndex >= startIndex) {
    items = uniformSize > 0
      ? buildUniformItems(startIndex, endIndex, uniformSize)
      : buildVariableItems(startIndex, endIndex, offsets!)
  }
  return {
    items,
    totalSize,
    startIndex,
    endIndex,
    scrollOffset,
    viewportHeight,
  }
}

/** Cached cumulative-offset table for the variable-size virtualizer path.
 * Rebuilt only when count or the size function changes; reused across the
 * many `recalc()` calls that happen during scroll. */
type OffsetCache = {
  fn: (index: number) => number
  count: number
  offsets: Array<number>
} | null

export function createVirtualizer(initial: VirtualizerOptions) {
  let options = initial
  let offsetCache: OffsetCache = null

  function getOffsets(): Array<number> | null {
    if (typeof options.estimateSize !== 'function') return null
    const count = Math.max(options.count, 0)
    if (
      offsetCache &&
      offsetCache.fn === options.estimateSize &&
      offsetCache.count === count
    ) {
      return offsetCache.offsets
    }
    const sizeFn = options.estimateSize
    const offsets = new Array<number>(count + 1)
    offsets[0] = 0
    // A size of 0 is a real size: a collapsed row or column takes no room
    // and both searches below stay monotonic over equal offsets. Only a
    // negative size is nonsense. The floor used to be 1, which left every
    // hidden column a one-pixel sliver.
    for (let i = 0; i < count; i += 1) {
      offsets[i + 1] = offsets[i]! + Math.max(sizeFn(i), 0)
    }
    offsetCache = { fn: sizeFn, count, offsets }
    return offsets
  }

  let state = createState(options, getOffsets())
  const listeners = new Set<VirtualizerListener>()

  function emit() {
    listeners.forEach((listener) => listener())
  }

  function recalc(scrolling = false) {
    const next = createState(options, getOffsets(), scrolling)
    if (sameState(state, next)) return
    // Hand back the previous item object for a row whose index, offset, size
    // and slot did not change. The grid's row {#each} is keyed by slot, so a
    // row that stays in the window keeps its <tr>, but a new item object
    // still invalidated everything that row and its cells derive from it:
    // every scroll frame re-checked ~300 cells to render the two that came
    // into view, and Svelte's dependency marking was most of the frame's
    // script time (measured 4.8 of 8.3 ms on a 100k-row grid).
    if (state.items.length > 0 && next.items.length > 0) {
      const first = state.items[0]!.index
      const items = next.items
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i]!
        const prev = state.items[item.index - first]
        if (prev && prev.index === item.index && prev.start === item.start && prev.size === item.size && prev.key === item.key) {
          items[i] = prev
        }
      }
    }
    state = next
    emit()
  }

  /**
   * What a scroll does to the window already rendered, with `overscanMin`:
   * 'hold' while that window still covers the visible items plus
   * `overscanMin` ahead of the scroll, 'move' once the scroll runs past that
   * (the window moves on with the full overscan ahead), and 'jump' when the
   * visible items are nowhere in it. Without `overscanMin` every scroll moves
   * the window.
   */
  function scrollStep(): 'hold' | 'move' | 'jump' {
    const min = options.overscanMin
    if (min === undefined || state.items.length === 0) return 'move'
    const ahead = clamp(min, 0, Math.max(options.overscan ?? 6, 0))
    const { count, viewportHeight, totalSize, visibleStart, visibleEnd } = visibleRange(options, getOffsets())
    if (count === 0 || viewportHeight !== state.viewportHeight || totalSize !== state.totalSize) return 'jump'
    if (visibleStart > state.endIndex || visibleEnd < state.startIndex) return 'jump'
    const direction = options.scrollDirection ?? 0
    const needStart = Math.max(visibleStart - (direction < 0 ? ahead : 0), 0)
    const needEnd = Math.min(visibleEnd + (direction > 0 ? ahead : 0), count - 1)
    return state.startIndex <= needStart && state.endIndex >= needEnd ? 'hold' : 'move'
  }

  return {
    setOptions(next: Partial<VirtualizerOptions>) {
      const merged = { ...options, ...next }
      // Passing a size function means "sizes may have changed", even when it is
      // the same reference: the documented variable-height pattern is a stable
      // function reading a mutable map, and keying the cache on identity alone
      // left the offsets and total stale after a row grew (#102).
      const remeasure = typeof next.estimateSize === 'function'
      if (!remeasure && sameOptions(options, merged)) return
      options = merged
      if (remeasure) offsetCache = null
      recalc()
    },
    /** Drop the cached offsets and re-read every size from `estimateSize`.
     *  Call after the sizes a stable size function reports have changed. */
    measure() {
      offsetCache = null
      recalc()
    },
    setScrollOffset(scrollOffset: number) {
      const previous = options.scrollOffset ?? 0
      if (previous === scrollOffset) return
      options = { ...options, scrollOffset, scrollDirection: scrollOffset > previous ? 1 : -1 }
      const step = scrollStep()
      if (step === 'hold') return
      recalc(step === 'move')
    },
    setViewportHeight(viewportHeight: number) {
      if (options.viewportHeight === viewportHeight) return
      options = { ...options, viewportHeight }
      recalc()
    },
    scrollToIndex(index: number) {
      const boundedIndex = clamp(index, 0, Math.max(options.count - 1, 0))
      // Read the current state's totals so the offset is correct under both
      // uniform and per-index sizing.
      const totalSize = state.totalSize
      let targetOffset: number
      if (typeof options.estimateSize === 'function') {
        // Use the cached cumulative offsets if present.
        const offsets = getOffsets()
        if (offsets) {
          targetOffset = offsets[boundedIndex] ?? 0
        } else {
          let acc = 0
          const sizeFn = options.estimateSize
          for (let i = 0; i < boundedIndex; i += 1) acc += Math.max(sizeFn(i), 1)
          targetOffset = acc
        }
      } else {
        targetOffset = boundedIndex * Math.max(options.estimateSize, 1)
      }
      const maxOffset = Math.max(totalSize - options.viewportHeight, 0)
      const nextOffset = clamp(targetOffset, 0, maxOffset)
      if ((options.scrollOffset ?? 0) === nextOffset) return
      options = { ...options, scrollOffset: nextOffset }
      recalc()
    },
    getVirtualItems() {
      return state.items
    },
    getTotalSize() {
      return state.totalSize
    },
    /** Cumulative offset of row `index` from the top in px, regardless
     *  of whether `estimateSize` is uniform or per-index. Uses the
     *  cached offsets array under function-form sizing so the lookup
     *  is O(1) instead of O(index). */
    getOffsetForIndex(index: number): number {
      if (index <= 0) return 0
      const count = Math.max(options.count, 0)
      const bounded = Math.min(index, count)
      if (typeof options.estimateSize === 'function') {
        const offsets = getOffsets()
        if (offsets) return offsets[bounded] ?? 0
        let acc = 0
        const fn = options.estimateSize
        for (let i = 0; i < bounded; i += 1) acc += Math.max(fn(i), 1)
        return acc
      }
      return bounded * Math.max(options.estimateSize, 1)
    },
    /** Height of row `index` in px (whichever estimateSize provides). */
    getSizeForIndex(index: number): number {
      if (index < 0 || index >= options.count) return 0
      if (typeof options.estimateSize === 'function') {
        return Math.max(options.estimateSize(index), 1)
      }
      return Math.max(options.estimateSize, 1)
    },
    getState() {
      return state
    },
    subscribe(listener: VirtualizerListener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
