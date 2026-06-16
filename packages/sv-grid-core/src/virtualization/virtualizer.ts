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
    if (ai.index !== bi.index || ai.start !== bi.start || ai.size !== bi.size) return false
  }
  return true
}

// Slot-based keying: the key is the POSITION of the item inside the
// visible window (slot 0 = topmost rendered row, slot 1 = next, etc.)
// - NOT the data index. As the user scrolls, the window's startIndex
// changes but the slot keys stay the same (0..N-1), so Svelte recycles
// the existing <tr> DOM nodes and only updates their data + position.
//
// This avoids the mount/unmount churn that previously fired on every
// scroll tick: with data-index keys, scrolling down 1 row meant the old
// topmost key disappeared and a new bottommost key appeared, forcing
// Svelte to unmount the top <tr> and mount a fresh one at the bottom.
// Slot-based keys keep the same N <tr> nodes alive for the lifetime of
// the grid; scroll just translates them via the top spacer.
function buildUniformItems(
  startIndex: number,
  endIndex: number,
  estimateSize: number,
): Array<VirtualItem> {
  const items: Array<VirtualItem> = []
  for (let index = startIndex; index <= endIndex; index += 1) {
    const start = index * estimateSize
    items.push({
      index,
      start,
      size: estimateSize,
      end: start + estimateSize,
      key: `virtual_slot_${index - startIndex}`,
    })
  }
  return items
}

function buildVariableItems(
  startIndex: number,
  endIndex: number,
  offsets: Array<number>,
): Array<VirtualItem> {
  const items: Array<VirtualItem> = []
  for (let index = startIndex; index <= endIndex; index += 1) {
    const start = offsets[index] ?? 0
    const end = offsets[index + 1] ?? start
    items.push({
      index,
      start,
      size: end - start,
      end,
      key: `virtual_slot_${index - startIndex}`,
    })
  }
  return items
}

function createState(
  options: VirtualizerOptions,
  /** Pre-built cumulative offsets for the variable-size path. */
  offsets: Array<number> | null,
): VirtualizerState {
  const count = Math.max(options.count, 0)
  const overscan = Math.max(options.overscan ?? 6, 0)
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

    const startIndex = count === 0 ? 0 : clamp(visibleStart - overscan, 0, count - 1)
    const endIndex = count === 0 ? -1 : clamp(visibleEnd + overscan, 0, count - 1)

    return {
      items: endIndex >= startIndex ? buildVariableItems(startIndex, endIndex, offsets) : [],
      totalSize,
      startIndex,
      endIndex,
      scrollOffset,
      viewportHeight,
    }
  }

  // Uniform-size fast path (original behavior).
  const estimateSize = Math.max(
    typeof options.estimateSize === 'number' ? options.estimateSize : 1,
    1,
  )
  const totalSize = count * estimateSize
  const maxOffset = Math.max(totalSize - viewportHeight, 0)
  const scrollOffset = clamp(options.scrollOffset ?? 0, 0, maxOffset)

  const visibleStart = Math.floor(scrollOffset / estimateSize)
  const visibleCount = Math.ceil(viewportHeight / estimateSize)
  const visibleEnd = Math.min(visibleStart + visibleCount, Math.max(count - 1, 0))

  const startIndex = count === 0 ? 0 : clamp(visibleStart - overscan, 0, count - 1)
  const endIndex = count === 0 ? -1 : clamp(visibleEnd + overscan, 0, count - 1)

  return {
    items: endIndex >= startIndex ? buildUniformItems(startIndex, endIndex, estimateSize) : [],
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
    for (let i = 0; i < count; i += 1) {
      offsets[i + 1] = offsets[i]! + Math.max(sizeFn(i), 1)
    }
    offsetCache = { fn: sizeFn, count, offsets }
    return offsets
  }

  let state = createState(options, getOffsets())
  const listeners = new Set<VirtualizerListener>()

  function emit() {
    listeners.forEach((listener) => listener())
  }

  function recalc() {
    const next = createState(options, getOffsets())
    if (sameState(state, next)) return
    state = next
    emit()
  }

  return {
    setOptions(next: Partial<VirtualizerOptions>) {
      const merged = { ...options, ...next }
      if (sameOptions(options, merged)) return
      options = merged
      recalc()
    },
    setScrollOffset(scrollOffset: number) {
      if ((options.scrollOffset ?? 0) === scrollOffset) return
      options = { ...options, scrollOffset }
      recalc()
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
    getState() {
      return state
    },
    subscribe(listener: VirtualizerListener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
