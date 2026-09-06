# Recipes / cookbook

Copy-paste patterns for sv-grid. Every recipe is a complete, runnable
snippet you can drop into your app. Each pairs with a live demo in
the [gallery](https://svgrid.com/demos/).

> Looking for the conceptual story? Start with
> [Architecture](../help/architecture.md) and the
> [Help topic index](../help/index.md). Recipes are the "show me a
> working solution" angle on the same material.

## By task

### Loading + persistence
- [Server-side filter with TanStack Query](./server-side-filter-with-tanstack-query.md)
- [Loading data from REST + GraphQL](./loading-data.md)
- [Persist column layout to URL](./persist-column-layout-to-url.md)
- [Persist column layout to localStorage (saved views)](./saved-views.md)
- [Cursor-based infinite scroll](./cursor-based-infinite-scroll.md)
- [Auto-save edits with debounce](./autosave-with-debounce.md)

### Editing
- [Bulk-edit selected rows](./bulk-edit-selected-rows.md)
- [Submit-time validation with error summary](./submit-time-validation.md)
- [Dependent dropdowns (Country → State → City)](./dependent-dropdowns.md)
- [Undo / redo for grid edits](./undo-redo-edits.md)
- [Role-based editable columns](./role-based-editing.md)

### Layout
- [Two-grid master/detail](./two-grid-master-detail.md)
- [Kanban board over the same `$state`](./kanban-from-grid-data.md)
- [Mobile card view with grid-on-desktop](./mobile-card-pivot.md)
- [Drag-drop columns to reorder](./drag-drop-columns.md)
- [Pin first column on horizontal scroll](./pin-first-column.md)

### Filtering + search
- [External search box with highlighted matches](./external-search.md)
- [Saved filter sets](./saved-filter-sets.md)
- [Between-operator filters for date ranges](./between-date-filter.md)

### Visuals
- [Conditional row coloring](./conditional-row-coloring.md)
- [Heatmap-tinted numeric cells](./heatmap-cells.md)
- [Sparkline cell renderer](./sparkline-cells.md)
- [Barcode (EAN-13) label cells](./barcode-cells.md)
- [Theme tokens for Ant / MUI / Fluent / shadcn](./theme-presets.md)

### Real-time
- [WebSocket streaming with backpressure](./websocket-streaming.md)
- [Chart.js sync from grid filter state](./chartjs-sync.md)

### AI
- [Smart paste: CSV / TSV / free-form → typed rows](./smart-paste.md)
- [NL filter wired to your LLM](./nl-filter.md)

### Export + import
- [Theme-matched xlsx export](./theme-matched-export.md)
- [Multi-sheet xlsx export](./multi-sheet-export.md)

### Performance
- [1 million rows with virtualization](./million-rows.md)
- [Lazy-load expand on demand](./lazy-load-expand.md)

### Framework interop
- [SvGrid in React](../help/web-components/react.md) - now part of the Web Components section, rewritten against the published element rather than a hand-authored one

### Developer recipes
- [Build your own feature plugin](./build-a-feature-plugin.md) - extend `tableFeatures()` with a row-accent or audit hook
- [Cell renderer patterns](./cell-renderer-patterns.md) - string / fn / `renderSnippet` / `renderComponent`
- [Custom filter functions](./custom-filter-functions.md) - semver, CIDR, fuzzy, regex
- [Form library bridge](./form-library-bridge.md) - drive grid edits from Felte / Superforms / native `<form>`
- [Testing your grid](./testing-your-grid.md) - Vitest unit, @testing-library/svelte, Playwright E2E
- [Profiling with a FPS HUD](./profiling-with-fps-hud.md) - live FPS + frame budget + DOM row count
- [Benchmark harness](./benchmark-harness.md) - measure paint time across (rows × cols) on your machine
- [Grid state inspector](./grid-state-inspector.md) - dev-only side panel polling every public api reader

## More examples

### HR team directory

Employee directory with avatars, status badges, group by team / location / status.

<div data-docs-demo="12-hr-team" data-height="560"></div>

### Manufacturing operations

Plant-floor view: KPI cards + active-runs grid with progress bars, status pills, live 5-second tick.

<div data-docs-demo="32-manufacturing-ops" data-height="560"></div>

### Project management board

Nested, collapsible column groups (Task / Details / Timeline / Progress), status + priority + assignee dropdowns, date cells, a custom progress-bar renderer, drag-to-reorder rows, and client pagination - all from stock props.

<div data-docs-demo="205-project-management" data-height="560"></div>

### Test systems monitor (live ops)

Operations console for a fleet of connected test & measurement systems: live status, utilization sparklines, temperature, alarms, firmware, and calibration with stable row identity (getRowId). Select systems for bulk actions (acknowledge alarms, schedule calibration), group by site, KPI strip, search + filters, and master-detail with live instrument tags. Virtualized to fleet scale.

<div data-docs-demo="120-test-systems-monitor" data-height="560"></div>

### Project tracker (PM workspace)

Linear-style project workspace: KPI strip (Projects / In progress / Ready / Blocked / Budget), bulk-action toolbar (Mark ready, Block, Move to launch, Delete) that enables on selection, phase-grouped rows with per-phase aggregate cards, NEW pill + SVG progress ring on the name column, avatar owner, colour-block Status / Priority / Risk cells, Department chip, multi-skills chips, inline filter row.

<div data-docs-demo="167-project-tracker" data-height="560"></div>

### Invoice builder

An adornment-heavy money form: currency prefixes, % suffixes, masked tax IDs (frame adornments), line items with SvPopconfirm delete + Undo action toasts, live SvStat totals, an SvHoverCard tax hint, and a promise toast on Send. Pure UI-kit composition.

<div data-docs-demo="343-invoice-builder" data-height="520"></div>

### Industrial - IoT sensors

Live sensor floor: threshold-driven status, sparkline trends, group by line.

<div data-docs-demo="14-industrial" data-height="460"></div>

### Industrial dashboard

KPI cards plus live line-status and active-alarms grids, on a 2-second tick.

<div data-docs-demo="20-industrial-dashboard" data-height="460"></div>

## See also

- [Help topic pages](../help/index.md) - the conceptual story behind each recipe
- [Demo gallery](https://svgrid.com/demos/) - every recipe runs live
- [API reference](../reference/index.md) - exhaustive prop / method tables
