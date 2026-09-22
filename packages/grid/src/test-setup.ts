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

// jsdom lacks the Web Animations API that Svelte 5 transitions (e.g. the chart
// drawer's slide-in) drive via element.animate(). Provide a no-op so mounting
// transitioned components doesn't throw "element.animate is not a function".
if (typeof Element !== 'undefined' && !Element.prototype.animate) {
  ;(Element.prototype as any).animate = function () {
    return {
      cancel() {},
      finish() {},
      play() {},
      pause() {},
      reverse() {},
      addEventListener() {},
      removeEventListener() {},
      finished: Promise.resolve(),
      currentTime: 0,
      playState: 'finished',
      onfinish: null,
      oncancel: null,
    }
  }
}

// jsdom has no canvas: getContext() returns null and prints "Not implemented:
// HTMLCanvasElement's getContext() method" through its virtual console on
// every call, hundreds of lines per run that bury the real warnings. The
// callers (the sheet's text measuring, the picture rasteriser) already treat a
// null context as "no canvas", so answering null quietly changes nothing a
// test can see; a test that needs a context still spies on the prototype.
if (typeof HTMLCanvasElement !== 'undefined') {
  ;(HTMLCanvasElement.prototype as any).getContext = function () {
    return null
  }
}

export {}
