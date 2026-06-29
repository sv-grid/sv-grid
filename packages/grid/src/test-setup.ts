// Vitest setup. jsdom doesn't ship ResizeObserver, IntersectionObserver,
// or the layout APIs SvGrid touches inside its mount effects. Provide
// minimal no-op stubs so component mounting completes without crashing.
//
// These assign to globals/prototypes the jsdom env doesn't fully type, so
// the targets are cast to `any`. We deliberately avoid expect-error
// suppression directives: when a stub happens to line up with the lib types,
// such a directive becomes "unused" and svelte-check fails the build (an
// unused expect-error directive is itself an error).

if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  ;(globalThis as any).IntersectionObserver = class {
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
  ;(Element.prototype as any).scrollIntoView = function () {}
}

// jsdom returns 0 for offset* and getBoundingClientRect; the grid only uses
// these for visual layout (column widths, virtualization windowing), so the
// zeros are harmless for behavioral tests.

export {}
