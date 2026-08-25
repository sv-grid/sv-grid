# Testing & Quality

SvGrid ships with a comprehensive automated test suite. This page is the
honest accounting of what we test, what we don't, and where coverage
stands today.

## Headline numbers

> **79.6% line coverage** on the measurable surface
> (`pnpm --filter @svgrid/grid test:lib`)

| Metric | Coverage | Threshold |
| ------ | -------- | --------- |
| Lines | 79.65% | >= 79% |
| Statements | 73.74% | >= 73% |
| Branches | 64.37% | >= 63% |
| Functions | 74.18% | >= 73% |

The thresholds are a **ratchet, not a target**: each sits just under the measured
value so a drop fails the build while ordinary churn does not. They were once set
at 90/90/80/75, which was aspirational rather than real and kept CI red.

The figure excludes the render components - `SvGrid.svelte`, the chart panel,
menus, the footer and the cell editor. Their layout, scroll and paint branches
depend on real browser metrics that jsdom reports as zero, so line coverage there
measures nothing useful; they are covered by behavioural mount tests instead.

Run the suite locally:

```bash
pnpm test            # alias for: pnpm --filter @svgrid/grid test:lib
pnpm test:types      # svelte-check on every package
```

The full coverage report lands in
`packages/grid/coverage/index.html`.

## What's measured

The **testable surface** is the headless engine, helpers, and pure logic
functions:

- `core.ts` (createSvGrid, row models, sortFns, filterFns) - ≥ 89% lines
- `a11y.ts` (ARIA prop builders) - 100% lines
- `keyboard.ts` (intent + next-cell math) - 100% lines
- `cell-formatting.ts` (locale / currency / percent / date helpers) - 100% lines
- `editors/cell-editors.ts` (parseEditorValue for every editor type) - 100% lines
- `filtering/excel-filters.ts` (every Excel-style operator + edge cases) - 100% lines
- `render-component.ts` (renderSnippet / renderComponent factories) - 100% lines
- `subscribe.ts` (store subscription + shallow-compare) - 100% lines
- `virtualization/*` - ≥ 86% lines

## What's measured separately

Two files are tested via **behavioral mount tests** rather than line coverage
because their branches depend on real browser layout (offsetWidth, scroll
dimensions, ResizeObserver fires) that jsdom returns as zero:

- **`SvGrid.svelte`** - the 4000-line render component. Covered by **60+
  behavioral mount tests** across
  [`svgrid.behavior.test.ts`](https://github.com/sv-grid/sv-grid/blob/main/packages/grid/src/svgrid.behavior.test.ts),
  [`svgrid.interaction.test.ts`](https://github.com/sv-grid/sv-grid/blob/main/packages/grid/src/svgrid.interaction.test.ts),
  and
  [`svgrid.api.test.ts`](https://github.com/sv-grid/sv-grid/blob/main/packages/grid/src/svgrid.api.test.ts).
  Each test mounts the real `<SvGrid />` in jsdom and exercises a specific
  feature: sort, filter, pagination, inline editing, cell selection,
  grouping, row selection, column add/remove, keyboard navigation, etc.
- **`sv-grid-scrollbar.ts`** - a custom element that paints scrollbar
  glyphs from layout measurements. Its paint loop runs in a real browser;
  jsdom can't exercise it.

## What's excluded

The coverage report excludes:

- `SvGrid.svelte` (covered behaviorally - see above)
- `FlexRender.svelte` (covered by `flex-render.test.ts` + every SvGrid mount)
- `sv-grid-scrollbar.ts` (custom element)
- `static-functions.ts` (pure re-exports)
- `createGridState.svelte.ts` (downstream-adapter thin layer)
- `test-fixtures/**`, `test-setup.ts`, `**/*.test.ts`, `**/*.d.ts`

The exclusion list is part of `packages/grid/vite.config.ts`
and is documented inline with the reasoning for each entry.

## Test files

| File | Surface | Tests |
| ---- | ------- | ----- |
| `createGrid.test.ts` | Headless `createSvGrid` instance | Unit |
| `svgrid.features.test.ts` | Row-model composition (core → filter → sort → group → expand → paginate) | Integration |
| `svgrid.api.test.ts` | The imperative `SvGridApi` exposed via `onApiReady` | Mounted |
| `svgrid.behavior.test.ts` | Wide behavior coverage: 30+ scenarios mounting the real component | Mounted |
| `svgrid.interaction.test.ts` | Keyboard / pointer / scroll / edit events | Mounted |
| `svgrid.wrapper.test.ts` | Source-string safety net | Static |
| `svgrid.features.test.ts` | Feature composition + state hydration | Headless |
| `core.coverage.test.ts` | Row / cell lazy getters, sortFns, filterFns, grouping | Unit |
| `cell-formatting.test.ts` | Locale / currency / percent / date helpers | Unit |
| `subscribe.test.ts` | Store subscription + shallowCompare | Unit |
| `render-component.test.ts` | renderSnippet / renderComponent factories | Unit |
| `flex-render.test.ts` | `<FlexRender />` discriminator (string / fn / config) | Mounted |
| `editors/cell-editors.test.ts` | `parseEditorValue` per editor type | Unit |
| `filtering/excel-filters.test.ts` | Every operator + every edge case | Unit |
| `keyboard.test.ts` | `getKeyboardIntent` / `getNextActiveCell` | Pure unit |
| `a11y.test.ts`, `a11y.contract.test.ts` | ARIA prop builders + contract | Pure unit |
| `core.performance.test.ts` | Engine performance under large row counts | Benchmark |

Total: **2,308 tests** across **179 test files** in `@svgrid/grid`, plus **1,607** across **101** in `@svgrid/enterprise` (the table above lists the core suites; the full set also covers clipboard, selection, menus, editing, columns, charts, spreadsheet, server-side data, collaboration, and more).

## Quality controls beyond unit tests

- **TypeScript strict mode** across both packages. `pnpm test:types`
  must pass on every PR (currently 0 errors / 0 warnings).
- **ESLint** at `pnpm lint`, with the Svelte plugin.
- **Publint** at `pnpm --filter @svgrid/grid test:build` checks the
  published `exports` map.
- **CSP-strict runtime**: no `eval`, no `new Function`, no inline scripts.
  Demo `16-csp-compliant` includes a runtime self-check.
- **SSR snapshot**: demo `19-ssr` proves the grid renders meaningful HTML
  before hydration.
- **Accessibility contracts**: `a11y.contract.test.ts` asserts that root,
  row, header, and cell prop builders produce a consistent ARIA tree.
- **Mount-based behavioral tests** mount the real `<SvGrid />` in jsdom
  with polyfilled `ResizeObserver` / `IntersectionObserver` / `scrollIntoView`
  and exercise the imperative API end-to-end.

## How to contribute a test

1. Pick a behavior you want to lock down. Bias toward
   *"user does X, grid does Y"* over *"function Z returns W"*.
2. If the behavior involves the rendered DOM, mount the component using
   the pattern in `svgrid.api.test.ts`:
   ```ts
   import { mount, unmount } from 'svelte'
   import SvGrid from './SvGrid.svelte'

   const target = document.createElement('div')
   document.body.appendChild(target)
   const app = mount(SvGrid, {
     target,
     props: { data, columns, features, onApiReady: (a) => { api = a } },
   })
   // exercise + assert
   unmount(app)
   ```
3. If the behavior is pure (a row model, a sort comparator, an a11y prop
   builder), add to one of the existing unit-test files.
4. Run `pnpm --filter @svgrid/grid exec vitest run <file>` to iterate
   fast.
5. Open the PR; include the before/after coverage delta in the description.

## CI

`.github/workflows/test.yml` runs on every push and PR:

- build the library with `svelte-package`
- `svelte-check` on every package
- unit + behavioural tests with coverage, against the ratchet above
- the Enterprise suite, and the web-component suite against its built bundle
- docs guardrails (snippets in the docs must still compile)
- **`pnpm ssr:check`** - builds `<SvGrid>` with `generate: "server"` and asserts
  the server HTML really contains rows. Added after the grid silently stopped
  server-rendering: both virtualizers learn their count from an `$effect`, and
  effects never run during SSR, so the server shipped an empty `<tbody>` while
  the docs claimed otherwise. Nothing caught it.
- **`pnpm size:check`** - fails when the base bundle exceeds its budget. A stray
  static import of something meant to load via `import()` inflates the bundle and
  can defeat an existing lazy boundary; that has happened here before.
- a coverage summary uploaded as an artifact and posted on the PR

The deploy workflow (`.github/workflows/deploy-website.yml`) builds the library
and the website separately.
