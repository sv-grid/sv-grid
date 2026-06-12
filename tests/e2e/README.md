# E2E tests (Playwright)

Real-browser tests for the parts jsdom can't exercise:

- Drag-and-drop (column reorder, row reorder).
- `position: sticky` measurements after a real scroll (pinned rows).
- Keystroke-driven filter inputs (locale-aware filter).
- Async loaders + cascading checkboxes (set filter).

## Setup

One-time browser install (downloads ~150 MB of Chromium):

```sh
pnpm test:e2e:install
```

The config uses the gallery's existing Vite dev server on port 5180; it will start (or reuse) the server automatically.

## Running

```sh
# headless, full output
pnpm test:e2e

# interactive UI (recommended for development)
pnpm test:e2e:ui

# a single spec
pnpm test:e2e column-reorder
```

## Files

| File | Covers |
| --- | --- |
| `column-reorder.spec.ts` | Drag headers, toolbar reorder buttons, localStorage persistence |
| `pinned-rows.spec.ts` | Top/bottom pinned tbodies, sticky-after-scroll, computed CSS |
| `locale-filter.spec.ts` | Real keystrokes in the global filter, locale switcher |
| `set-filter.spec.ts` | Async-loaded values, tree-list cascade, Excel funnel discoverability |

## Conventions

- Each spec self-resets state in `beforeEach` (localStorage etc).
- `expect.poll(() => ...)` instead of fixed sleeps; the grid reacts on micro-tasks so polling is sub-ms most of the time.
- DOM selectors use the engine's own data attributes: `[data-svgrid-header-col]`, `[data-pinned-row]`, `.sv-grid-pinned-top-body`, etc. They're stable - the unit suite asserts them too.
- No screenshot-diff testing; we assert behavior not pixels.

## Coverage split with the jsdom suite

The vitest + jsdom suite (`pnpm test`) covers:

- All pure helpers (e.g. `normalizeForFilter`, `buildFillPattern`).
- Mount + API exercise (`api.setColumnOrder`, `api.setFacetFilter`, `api.setFilter`).
- DOM attribute / class invariants the engine emits.

This E2E suite covers what jsdom can't:

- Native `DragEvent` (jsdom omits it).
- Layout (`getComputedStyle`, scroll-induced sticky positioning).
- Async-loader → real timers → UI updates.
- Real focus / keyboard-scrolling.

If a test would work in jsdom, prefer adding it there - the vitest suite runs in ~10s while Playwright takes ~30-60s with browser startup.
