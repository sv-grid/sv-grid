# E2E tests (Playwright)

Real-browser tests for the parts jsdom can't exercise:

- Drag-and-drop (column reorder, row reorder).
- `position: sticky` measurements after a real scroll (pinned rows).
- Keystroke-driven filter inputs (locale-aware filter).
- Async loaders + cascading checkboxes (set filter).
- Whether the /api reference's examples actually run (`pnpm api:check` proves they compile; only a browser proves they mount and execute).

## Setup

One-time browser install (downloads ~150 MB of Chromium):

```sh
pnpm test:e2e:install
```

The specs navigate to `/sv-grid/#/demos/<id>`, which are **website** routes, not the example gallery (`pnpm dev`, port 5174). The config starts the website's dev server on port 5180 with `SVGRID_SITE_BASE=/sv-grid/`, or reuses one you already have running there.

Two consequences:

- `website/` is a private submodule, so this suite only runs on a checkout that has it. That is also why it is not in CI.
- If you start the server by hand, set the base too. In Git Bash, `SVGRID_SITE_BASE=/sv-grid/` gets path-mangled into `C:/Program Files/Git/sv-grid/`; use PowerShell or prefix with `MSYS_NO_PATHCONV=1`.

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
| `api-examples.spec.ts` | Every /api member's example compiles, mounts, and runs; plus the "Open in playground" hand-off |

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
