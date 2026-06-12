# Browser & runtime support

The shipping target matrix. If your environment isn't listed, assume
unsupported until you've validated the linked feature surfaces below.

## Browsers

| Browser           | Version | Status      | Notes                                                                 |
| ----------------- | ------- | ----------- | --------------------------------------------------------------------- |
| Chrome / Chromium | 100+    | Supported   | Primary development target. Tested every release.                     |
| Edge              | 100+    | Supported   | Same Chromium base as Chrome.                                         |
| Firefox           | 100+    | Supported   | Tested every release. The custom scrollbar paints natively.           |
| Safari (macOS)    | 15.4+   | Supported   | Pointer Events shim landed in 15.4 - older Safari hits edge cases.    |
| Safari (iOS)      | 15.4+   | Supported   | Touch UX known limitations - see "Mobile" below.                      |
| Opera             | 86+     | Supported   | Chromium-based.                                                       |
| IE 11             | n/a     | Unsupported | Not feasible: Svelte 5 itself requires modern JS.                     |
| Old WebViews      | varies  | Best-effort | Anything with `ResizeObserver` + ES2020 syntax should work.           |

The lower bound is **the oldest version with native `ResizeObserver`,
`IntersectionObserver`, Pointer Events, and `Object.hasOwn`**. SvGrid
uses these directly; we don't polyfill in the package.

## JavaScript baseline

SvGrid is built and shipped as **ESM only** with ES2020 syntax. The
published bundle assumes:

- `const`, `let`, arrow functions, classes, async/await, `??`, `?.`
- `Promise`, `Map`, `Set`, `WeakMap`, `Symbol`
- `Array.prototype.flatMap`, `Object.fromEntries`, `Object.hasOwn`
- `globalThis`

If you need to ship to a baseline lower than ES2020, transpile
`sv-grid-community` in your own build (Vite, Rollup, esbuild). The
package source contains no syntax above ES2022.

## DOM APIs

The grid uses these browser APIs directly:

| API                                  | Where                                                                     | Polyfillable?       |
| ------------------------------------ | ------------------------------------------------------------------------- | ------------------- |
| `ResizeObserver`                     | Auto-resizing the grid container + column widths                          | Yes (`resize-observer-polyfill`) |
| `IntersectionObserver`               | Virtualization viewport check                                             | Yes                              |
| Pointer Events (`pointerdown`/`-up`) | Selection, fill handle, column resize                                     | Yes                              |
| `Element.scrollTo({ behavior })`     | Programmatic row scroll, smooth-scroll API                                | Yes                              |
| `URL.createObjectURL`                | Export (xlsx, pdf, csv, tsv, html)                                        | Required             |
| `Blob`, `File`                       | Export + import                                                           | Required             |
| `document.execCommand('copy')` *or* `Clipboard API` | Copy/paste cell selection (graceful fallback)         | Either               |

If you're shipping to a sandboxed environment where some of these are
locked down, see the [CSP guidance](./security.md#csp-guidance) section
on the security page.

## Node / SSR

SvGrid is SSR-compatible. The render component does nothing on the
server beyond emitting the wrapper markup with an `aria-busy` shell -
the data + interactions hydrate on the client. Demo
[19. Server-side rendering](https://svgrid.com/#/demos/19-ssr)
shows a sandboxed pre-hydration snapshot.

### Tested SSR runtimes

| Runtime       | Version | Status     |
| ------------- | ------- | ---------- |
| Node.js       | 18 LTS+ | Supported  |
| Bun           | 1.0+    | Supported  |
| Deno          | 1.40+   | Supported  |
| SvelteKit     | 2.x     | Supported  |
| Astro         | 4.x+    | Supported  |
| Cloudflare Workers (with SvelteKit adapter) | latest | Supported (no FS access from the grid) |

### What the grid does NOT do on the server

- No `window` / `document` access in module initialisation.
- No event listeners.
- No `ResizeObserver` / `IntersectionObserver`.
- No `localStorage`.
- No virtualization (server emits a placeholder shell; client takes
  over on hydration).

If you see a "lifecycle_function_unavailable" error from Svelte during
SSR, that's coming from a custom cell snippet of yours - not from the
grid. Guard `document` / `window` reads inside an `onMount` or
`$effect`.

## Build tools

| Tool          | Version | Status     |
| ------------- | ------- | ---------- |
| Vite          | 5+      | Recommended. Tested with vite 5, 6, and 7. |
| Rollup        | 4+      | Supported. SvGrid is published as ESM and is tree-shakeable. |
| esbuild       | 0.20+   | Supported. |
| Webpack       | 5+      | Supported with `experiments.outputModule` or a CJS-compatible Svelte loader. |
| Turbopack     | n/a     | Untested. Should work given ESM compatibility. |

Tree-shaking works at the named-export granularity - `import { SvGrid,
tableFeatures } from 'sv-grid-community'` pulls in only the surfaces
you reference. Each feature module (sorting, filtering, etc.) is its
own export.

## Mobile

Mobile browsers render the grid correctly but the UX makes the
following compromises:

- **Touch drag selection** is supported on Pointer-Event browsers but
  doesn't show the same handles as desktop.
- **Cell editing** opens the native keyboard; multi-cell paste from the
  iOS clipboard works via the standard `Clipboard API`.
- **Column resize** is awkward on screens narrower than ~600 CSS pixels
  because the resize handles are 4 px wide. Configure pinned columns
  for narrow screens instead.
- **Pinned columns** are supported and recommended for mobile.

For a mobile-first workflow, prefer a card list view at smaller
viewports and switch to the grid above an `md` breakpoint.

## See also

- [Security & supply chain](./security.md) - including a CSP-friendly
  config snippet.
- [Performance benchmarks](./benchmarks.md) - measured throughput on a
  documented machine.
- [Testing and quality](./testing-and-quality.md) - the test suite and
  what it covers.
