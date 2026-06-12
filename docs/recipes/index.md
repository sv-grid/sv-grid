# Recipes / cookbook

Copy-paste patterns for sv-grid. Every recipe is a complete, runnable
snippet you can drop into your app. Each pairs with a live demo in
the [gallery](https://svgrid.com/#/demos).

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
- [Use SvGrid from React (custom-element bridge)](./use-svgrid-from-react.md)

## See also

- [Help topic pages](../help/index.md) - the conceptual story behind each recipe
- [Demo gallery](https://svgrid.com/#/demos) - every recipe runs live
- [API reference](../reference/index.md) - exhaustive prop / method tables
