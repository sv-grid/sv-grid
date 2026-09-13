# Testing & Quality

SvGrid ships with a comprehensive automated test suite. This page is the
honest accounting of what we test, what we don't, and where coverage
stands today.

## Headline numbers

> **81.4% line coverage** on the measurable surface
> (`pnpm --filter @svgrid/grid test:lib`)

| Metric | Coverage | Threshold |
| ------ | -------- | --------- |
| Lines | 81.36% | >= 81% |
| Statements | 75.15% | >= 74% |
| Branches | 66.54% | >= 65% |
| Functions | 75.08% | >= 74% |

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

## The API QA phase

`packages/grid/src/qa/` is a sweep over the **public surface** rather than a
feature: 327 cases in `@svgrid/grid` plus 85 in `@svgrid/enterprise`, each checked
against the contract that member's reference page or doc comment states - 120
props, 84 api members, 35 column options, 19 callbacks, the whole headless
engine, and everything `installEnterprise` adds. The component cases mount the
real `<SvGrid>`; the engine cases run `createSvGrid` / `createSvGridCore` with no
component at all; the enterprise cases mount the real grid and install onto the
api the component hands back, rather than onto a stub.

| Suite | Surface |
| ----- | ------- |
| `qa.api-cells-rows.test.ts` | `getCellValue` / `setCellValue`, row add + remove, `applyTransaction`, editing, undo / redo |
| `qa.api-columns.test.ts` | Column add / remove, visibility, width, autosize, pinning, order |
| `qa.api-filter-sort-group.test.ts` | Sort, every filter operator + surface, facets, grouping, expansion, the advanced filter |
| `qa.api-selection-nav.test.ts` | Row + cell-range selection, active cell, scrolling, pagination, find |
| `qa.api-state-export-chart.test.ts` | `getState` / `setState`, `setOption` overrides, CSV / TSV / JSON / clipboard, the chart panel |
| `qa.props-core.test.ts` | Data state, layout, virtualization, filter / selection / editing surfaces, sort, pagination, grouping, the shortcuts |
| `qa.props-extras.test.ts` | Row chrome, notes, conditional formatting, clipboard hooks, status bar, tool panel, tree data, localization, server hooks, board / scheduler / chart / pivot modes |
| `qa.events.test.ts` | The DOM-driven callbacks (clicks, double clicks, scroll-bottom) plus `icons` and the seed props |
| `qa.columndef.test.ts` | Every `ColumnDef` option: value source, rendering slots, layout, column groups, editing, per-column opt-outs, aggregation |
| `qa.headless.test.ts` | The engine: `createSvGrid` options, the instance members, state slices, the row-model pipeline, `Row` / `Column` / `Header` shapes, features, `sortFns` / `filterFns`, the no-runes `createSvGridCore` entry |

And in `packages/enterprise/src/qa/`:

| Suite | Surface |
| ----- | ------- |
| `qa.install.dom.test.ts` | What `installEnterprise` adds, that it returns the same object, idempotence, and the view renderers it registers |
| `qa.export.dom.test.ts` | Every `exportData` format, the row / column scopes, csv tuning, progress, abort, `copyExport`, `print`, and the static `exportGrid` / `printGrid` |
| `qa.import.dom.test.ts` | `importData` parsing, sniffing, coercion, `columnMap` / `autoMap` / `columnTypes`, validation, preview vs commit |
| `qa.pivot.dom.test.ts` | `pivot.build` / `buildFrom`, `createPivotModel`, the config switches and all eight `pivotAggregators` |
| `qa.ai.dom.test.ts` | The seven `pro.ai.*` helpers against `mockAIProvider`, including the required-option errors |
| `qa.advanced-filter.dom.test.ts` | The seam the install closes: a stored expression that the community grid cannot evaluate starts dropping rows |
| `qa.license.dom.test.ts` | `setLicenseKey` / `clearLicenseKey` / `isLicenseKeySet` / `checkLicenseKey`, the soft gate, and the nudge |
| `qa.surface.dom.test.ts` | The enterprise gate: every `EnterpriseGridApi`, `ai.*` and `pivot.*` member exercised, plus every registration the install performs |
| `qa.surface.test.ts` | The gate: parses the `SvGridApi` and `Props` types and fails when a member has no QA case, and checks the runtime api object matches the type exactly |

The gate is the point. A new prop, column option, engine member or api member
cannot ship without a QA case, and a member that quietly stops working fails
here even when no feature suite covers it. The phase found eight defects:

1. A dead filter funnel whenever `filterMode` was not `'menu'`.
2. `CSS.escape` crashing autosize outside a real browser.
3. `error` losing to `loading` on the first render, against its own contract.
4. `getActiveCell()` reporting the mount seed as a focused cell.
5. The per-column `tooltip` never firing while virtualization was on (default).
6. `grid.setSorting()` missing from the engine, though the docs and the
   `Updater` example both used it and every sibling slice had a setter.
7. `grid.setOptions()` writing to a store nothing read, so swapping `data` or
   `columns` through it did nothing.
8. An unknown filter-fn name crashing the row model with `filter.fn is not a
   function` - one typo in a clause rendered the whole grid empty. It now falls
   back to the documented default and warns once.
9. Half the state slice types (`ColumnFiltersState`, `PaginationState`,
   `GroupingState`, `ExpandedState`, `RowSelectionState`, `ColumnFilter`)
   missing from the main barrel, so a controlled consumer could not type the
   handlers `SvGridOptions` asks for without the `/core` subpath.
10. `SVGRID_VERSION` in `@svgrid/enterprise` drifted from its `package.json` at
    the 3.0.1 release, because the release bumps the manifest alone and its
    commit carries `[skip ci]`, so the guard test never ran. Synced, and the
    release script now rewrites the constant when it bumps the package.

11. `pro.copyExport()` wrote a BOM into the clipboard, so a paste into Excel or
    Sheets carried a stray U+FEFF in the first header cell. The free
    `copyToClipboard` already forced it off.
12. `pivotAggregators.min` / `.max` spread the whole bucket into `Math.min(...)`,
    throwing `RangeError: Maximum call stack size exceeded` past roughly 100k
    values - so a min or max measure over a large pivot cell crashed. One
    accumulation pass now, the same fix the grid's own aggregators got.
13. `dismissUnlicensedNudge()` - documented as "hide the console nudge for the
    rest of the session" - reset the shown flag instead, so it re-armed the
    nudge. A test calling it to quieten its output got more output.
14. `ImportColumnMap` was typed `Record<string, string>` while `columnMap`'s own
    doc comment (and the parser) support `null` to drop a source column, so the
    documented call did not type-check.
15. `aiSummarize` / `aiClassify` / `aiSmartFill` threw `Cannot read properties of
    undefined` when a required option was missing. They now name the option.

Plus the docs: two editing pages promising that editing never touches the
caller's rows, stale operator / option / registry lists on three reference
pages, an enterprise reference whose `importData` types and AI option shapes did
not match the code, and an Enterprise landing page that described the pack as
"export, import and pivot tables" while leaving out the Kanban board and
scheduler renderers, print, the advanced filter, alerts, the selection bar and
bulk edit.

Run it alone with:

```bash
pnpm --filter @svgrid/grid exec vitest run src/qa
```

## What's excluded

The coverage report excludes:

- `SvGrid.svelte` (covered behaviorally - see above)
- `FlexRender.svelte` (covered by `flex-render.test.ts` + every SvGrid mount)
- `sv-grid-scrollbar.ts` (custom element)
- `static-functions.ts` (pure re-exports)
- `createGridState.svelte.ts` (downstream-adapter thin layer)
- `test-fixtures/**`, `test-setup.ts`, `qa/harness.svelte.ts`, `**/*.test.ts`,
  `**/*.d.ts`

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
| `qa/*.test.ts` | The API QA phase: every prop, every `SvGridApi` member, every callback | Mounted |

Total: **3,214 tests** across **214 test files** in `@svgrid/grid`, plus **1,743** across **111** in `@svgrid/enterprise` (the table above lists the core suites; the full set also covers clipboard, selection, menus, editing, columns, charts, spreadsheet, server-side data, collaboration, and more).

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
