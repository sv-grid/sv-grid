# SvGrid Help

Topic-oriented documentation for SvGrid. Each page is a focused
explanation of one feature with copy-paste code that runs against the
shipping library - written for SvGrid, not translated from another grid.

Start with [Getting Started](../getting-started.md) if you have not
already.

> **Tier badges.** Pages whose title ends with `- Pro` describe a
> feature that ships in the paid `sv-grid-pro` add-on. Everything else
> is part of the open-source `sv-grid-community` package. The same
> visual convention is used throughout this documentation.

Live reference - the trading-desk demo runs the full feature set at
real-world scale:

<div data-docs-demo="00-trading-desk" data-height="560"></div>

## Background

- [Why headless?](../why-headless.md) - what the headless core gives you and when to reach for it
- [Architecture overview](./architecture.md) - the three-layer model: your data, the engine, the renderer
- [Glossary](./glossary.md) - terminology used across the docs (accessor, snippet, row model, ...)
- [Tailwind integration](./tailwind.md) - re-theming the grid via `--sg-*` tokens, dark-mode wiring, what *not* to do
- [**Pro feature pack**](../pro/README.md) - landing page for the paid add-on; what's in it + how to license it
- [Data export and printing - Pro](./export.md) - Excel, PDF, CSV, TSV, HTML, and Print
- [Data import - Pro](./import.md) - Excel, CSV, TSV, and JSON import with column mapping + validation
- [AI assistant - Pro](./ai.md) - natural-language filter, smart fill, summarise, classify; bring-your-own model adapter
- [Pivot tables - Pro](./pivot.md) - `createPivotModel` + nested column headers; designer UI is a separate demo
- **Migrating to SvGrid** - column / API translation guides from other grids:
  [AG Grid](./migrating-from-ag-grid.md) ·
  [TanStack Table](./migrating-from-tanstack-table.md) ·
  [MUI X DataGrid](./migrating-from-mui-x.md) ·
  [Handsontable](./migrating-from-handsontable.md) ·
  [Glide Data Grid](./migrating-from-glide.md) ·
  [svelte-headless-table](./migrating-from-svelte-headless-table.md) ·
  [SVAR Svelte DataGrid](./migrating-from-svar-svelte-datagrid.md) ·
  [@vincjo/datatables](./migrating-from-vincjo-datatables.md) ·
  [Flowbite / Skeleton / shadcn tables](./migrating-from-ui-kit-tables.md) ·
  [Tabulator](./migrating-from-tabulator.md) ·
  [Grid.js](./migrating-from-gridjs.md) ·
  [React Data Grid](./migrating-from-react-data-grid.md) ·
  [PrimeVue / PrimeNG / PrimeReact](./migrating-from-primevue-datatable.md) ·
  [Kendo UI Grid](./migrating-from-kendo-grid.md) ·
  [DevExtreme](./migrating-from-devextreme.md) ·
  [Syncfusion](./migrating-from-syncfusion.md) ·
  [jqxGrid](./migrating-from-jqxgrid.md) ·
  [Smart.Grid](./migrating-from-smart-grid.md)

## Patterns & playbooks

- [Recipes / Cookbook](./recipes.md) - 20+ copy-paste patterns from sort/filter/paginate to inline edit + cascading totals to streaming, each paired with a live interactive demo
- [AI Smart Paste](./ai-smart-paste.md) - vCard / Markdown / signature-block / CSV parsing with email typo correction, phone normalization, and multi-language headers
- [Spreadsheet formulas](./spreadsheet-formulas.md) - in-cell `=SUM` / `=IF` / `=COUNTIF` with cell refs, ranges, cycle detection
- [Mobile / responsive card view](./mobile-card-view.md) - the same `$state` array driving a desktop grid and a touch-friendly card list
- [Conditional form schema](./conditional-form-schema.md) - declarative `when` rules for per-cell visibility and editability
- [Server-side data](./server-side-data.md) - paginated fetch, server-driven sort + filter, sparse infinite scroll (with velocity-aware chunk loading + abort guards)
- [Real-time / streaming updates](./real-time.md) - poll vs WebSocket, delta merge, pause-while-editing, backpressure
- [Grouping & aggregation](./grouping-aggregation.md) - built-in aggregators, custom group cells, group-vs-leaf sort, performance notes
- [Columns hierarchy + manager](./columns-hierarchy.md) - side-panel column tree with drag-to-reorder, collapsible groups, summary columns
- [State maintenance](./state-maintenance.md) - capture / apply, undo / redo, bookmarks, JSON IO, debounced auto-save
- [Saved views & persistence](./saved-views.md) - localStorage / server-side persistence, view migration, URL sharing
- [Internationalisation & RTL](./i18n-rtl.md) - locale-aware formatting, RTL layout flip, CJK column widths, mixed-direction safety

## Enterprise readiness

- [Security & supply chain](./security.md) - peer-dep table, CSP guidance, SBOM generation, vulnerability handling, data residency
- [Browser & runtime support](./browser-support.md) - tested browsers + versions, SSR runtimes, build tools, DOM-API requirements, mobile
- [Accessibility](./accessibility.md) - WAI-ARIA 1.2 grid pattern, WCAG 2.1 AA mapping, keyboard map, forced-colors + reduced-motion
- [Performance benchmarks](./benchmarks.md) - first paint, sustained scroll FPS, sort / filter / group, memory, bundle size, on a documented machine
- [Testing your grid](./testing.md) - unit tests against the engine, jsdom component tests, Playwright e2e, axe-core for a11y regressions
- [API stability & semver policy](./api-stability.md) - the promise we make to you about breaking changes + deprecation lifecycle
- [**API reference**](../reference/index.md) - exhaustive prop/method/type tables for `<SvGrid>`, `SvGridApi`, `ColumnDef`, features, and the Pro surface
- [API stability badges](./api-reference.md) - flat index of every Stable export with its tier badge
- [Changelog](../changelog.md) - reverse-chronological log of every shipped change
- [Error reference](./errors.md) - every typed error this surface throws, with the trigger and the fix

## Production checklist

A focused walkthrough for the questions enterprise teams ask before
shipping. Each link drops you straight into the relevant topic page.

| Concern                          | Reach for                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Performance with >10k rows       | [Performance benchmarks](./benchmarks.md) + [Row pagination](./rows/row-pagination.md)             |
| Server-side data                 | [Server-side data](./server-side-data.md) - paginated fetch, server-driven sort, sparse infinite scroll |
| Real-time / streaming updates    | [Real-time / streaming](./real-time.md) - delta merge, pause-while-editing, backpressure           |
| Tree / hierarchical data         | [Tree rows](./rows/tree-rows.md) - flat-array + expanded-map pattern, lazy load, keyboard nav      |
| Pivot / multi-level headers      | [Pivot tables](./pivot.md) + [Column groups](./columns/column-groups.md)                           |
| Grouping + aggregation           | [Grouping & aggregation](./grouping-aggregation.md) - built-in aggregators + custom group cells    |
| Inline editing with validation   | [Editing overview](./editing/overview.md) + [Validation while editing](./editing/validation.md)    |
| Theming + dark mode              | [Tailwind integration](./tailwind.md) - the `--sg-*` token list                                    |
| Accessibility / WAI-ARIA         | [Accessibility](./accessibility.md) - WCAG 2.1 AA mapping + keyboard map + forced-colors           |
| Internationalisation / RTL       | [Internationalisation & RTL](./i18n-rtl.md) - locales, formatting, mixed-direction safety          |
| Saved views / layout persistence | [Saved views](./saved-views.md) - localStorage / server-side persistence + migration               |
| Export to Excel / PDF / CSV      | [Data export and printing](./export.md)                                                            |
| Excel / CSV / JSON import        | [Data import](./import.md) - file picker -> column map -> preview -> commit                       |
| Add AI to the grid               | [AI assistant](./ai.md) - one provider adapter, four helpers                                       |
| Multi-app deployment licensing   | [Pricing](https://svgrid.com/#/pricing) - Multiple App License covers an org        |
| Testing the grid                 | [Testing your grid](./testing.md) + [Testing and quality](./testing-and-quality.md)                |

If a question is missing from this table, **press `Ctrl/Cmd + K`** in
the docs sidebar - the search box indexes every page's title, headings,
and body and ranks matches by where they hit.

## Core features

### Columns

- [Column definitions](./columns/column-definitions.md)
- [Updating definitions](./columns/updating-definitions.md)
- [Column state](./columns/column-state.md)
- [Column headers - styling & height](./columns/column-headers.md)
- [Column groups](./columns/column-groups.md)
- [Column sizing](./columns/column-sizing.md)
- [Column moving](./columns/column-moving.md)
- [Column pinning](./columns/column-pinning.md)
- [Column spanning](./columns/column-spanning.md)
- [Custom header components](./columns/custom-header-components.md)

### Rows

- [Row data](./rows/row-data.md)
- [Row sorting](./rows/row-sorting.md)
- [Row spanning](./rows/row-spanning.md)
- [Row pinning](./rows/row-pinning.md)
- [Row height](./rows/row-height.md)
- [Styling rows](./rows/styling-rows.md)
- [Row pagination](./rows/row-pagination.md)
- [Accessing rows](./rows/accessing-rows.md)
- [Row dragging](./rows/row-dragging.md)
- [Full-width rows](./rows/full-width-rows.md)
- [Tree rows (expand / collapse)](./rows/tree-rows.md)

### Cells

- [Getting values](./cells/getting-values.md)
- [Text formatting](./cells/text-formatting.md)
- [Cell components](./cells/cell-components.md)
- [Cell data types](./cells/cell-data-types.md)
- [Styling cells](./cells/styling-cells.md)
- [Highlighting changes](./cells/highlighting-changes.md)
- [Tooltips](./cells/tooltips.md)
- [Expressions](./cells/expressions.md)
- [View refresh](./cells/view-refresh.md)
- [Cell text selection](./cells/cell-text-selection.md)

### Filtering

- [Overview](./filtering/overview.md)
- [Text filter](./filtering/text-filter.md)
- [Number filter](./filtering/number-filter.md)
- [Date filter](./filtering/date-filter.md)
- [Set filter](./filtering/set-filter.md)
- [Filter conditions](./filtering/filter-conditions.md)
- [Applying filters](./filtering/applying-filters.md)
- [Filter API](./filtering/filter-api.md)
- [Custom column filters](./filtering/custom-column-filters.md)
- [Floating filters](./filtering/floating-filters.md)

### Editing

- [Overview](./editing/overview.md)
- [Start / stop editing](./editing/start-stop-editing.md)
- [Parsing values](./editing/parsing-values.md)
- [Saving values](./editing/saving-values.md)
- [Edit components](./editing/edit-components.md)
- [Provided cell editors](./editing/provided-editors.md)
- [Undo / redo](./editing/undo-redo.md)
- [Full-row editing](./editing/full-row.md)
- [Validation](./editing/validation.md)

## Conventions

Each topic page is structured as:

1. **What it is** - a one-sentence definition.
2. **When to use it** - the situation that calls for this feature.
3. **Minimal example** - copy-pasteable code that runs.
4. **Reference** - the relevant exports and prop names.
5. **Gotchas** - known limits, gaps, or things that surprise people.

Pages explicitly note when a feature is **not yet implemented** in the
community build so you know what you can rely on. The current
gap list is at [missing-features.md](./missing-features.md).
