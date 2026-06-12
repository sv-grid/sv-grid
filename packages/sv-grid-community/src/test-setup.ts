// Vitest setup. jsdom doesn't ship ResizeObserver, IntersectionObserver,
// or the layout APIs SvGrid touches inside its mount effects. Provide
// minimal no-op stubs so component mounting completes without crashing.

if (typeof globalThis.ResizeObserver === 'undefined') {
  // @ts-expect-error - assigning to a globalThis property the env doesn't ship
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  // @ts-expect-error - same
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
}

// jsdom's HTMLElement.scrollIntoView is a no-op; some grid code calls it
// during the first effect. Make sure the method exists on every element.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  // @ts-expect-error - patching a missing DOM method
  Element.prototype.scrollIntoView = function () {}
}

// jsdom returns 0 for offset* and getBoundingClientRect; the grid only uses
// these for visual layout (column widths, virtualization windowing), so the
// zeros are harmless for behavioral tests.

export {}
