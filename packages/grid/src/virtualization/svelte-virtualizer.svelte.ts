import { createVirtualizer } from './virtualizer'
import type { VirtualizerOptions } from './types'

export function createSvelteVirtualizer(options: VirtualizerOptions) {
  const virtualizer = createVirtualizer(options)
  let version = $state(0)

  virtualizer.subscribe(() => {
    version += 1
  })

  return {
    get version() {
      return version
    },
    setOptions: virtualizer.setOptions,
    setScrollOffset: virtualizer.setScrollOffset,
    setViewportHeight: virtualizer.setViewportHeight,
    scrollToIndex: virtualizer.scrollToIndex,
    getVirtualItems: virtualizer.getVirtualItems,
    getTotalSize: virtualizer.getTotalSize,
    getOffsetForIndex: virtualizer.getOffsetForIndex,
    getSizeForIndex: virtualizer.getSizeForIndex,
    getState: virtualizer.getState,
  }
}
