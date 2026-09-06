# `<sv-grid>` reference

Every property, attribute and event of the custom element.

**This page is generated** from `<SvGrid>`'s own `Props` type by
`packages/grid-wc/scripts/generate-surface.mjs`, and CI fails if it drifts. The
element used to declare 7 props and 2 events by hand while the docs claimed
"grouping, sorting, pagination all come along" - a hand-written table is how
that happens.

## Attributes vs properties

`groupable` is an attribute; `groupBy` is an array, so it is property-only. This grid uses both.

<div data-docs-demo="07-grouping-aggregation" data-height="480"></div>

The distinction matters more here than anywhere else in the API:

- **An attribute is a string.** Primitives (`boolean`, `number`, `string`) can
  be written in HTML: `<sv-grid page-size="25" show-row-numbers>`.
- **Arrays, objects and functions cannot.** `columns='[object Object]'` is not
  a thing. Assign them in script: `el.columns = [...]`.

Both work through the property, so `el.pageSize = 25` is equally valid. The
attribute is the extra convenience, offered only where it can work.

```html
<sv-grid id="grid" sortable filterable page-size="25" row-height="32"></sv-grid>
<script type="module">
  const grid = document.getElementById('grid')
  grid.columns = [{ field: 'name', header: 'Name' }]   // property: an array
  grid.data = rows                                      // property: an array
</script>
```

<!-- BEGIN generated reference - packages/grid-wc/scripts/generate-surface.mjs -->

### Attributes (72)

Primitives, so they work in plain HTML as well as through a property.

| Attribute | Property | Type |
| --- | --- | --- |
| `pivot-mode` | `pivotMode` | `boolean` |
| `context-menu` | `contextMenu` | `boolean \| ReadonlyArray<ContextMenuItem<TData>>` |
| `selection-bar` | `selectionBar` | `\| boolean \| ReadonlyArray<SelectionBarAction<TData> \| SelectionBarBuiltin> \| SelectionB...` |
| `sortable` | `sortable` | `boolean` |
| `filterable` | `filterable` | `boolean` |
| `editable` | `editable` | `boolean` |
| `groupable` | `groupable` | `boolean` |
| `group-footers` | `groupFooters` | `boolean` |
| `grand-total-row` | `grandTotalRow` | `boolean` |
| `group-display-mode` | `groupDisplayMode` | `GroupDisplayType` |
| `auto-group-column-header` | `autoGroupColumnHeader` | `string` |
| `auto-group-column-width` | `autoGroupColumnWidth` | `number` |
| `pageable` | `pageable` | `boolean` |
| `loading` | `loading` | `boolean` |
| `loading-overlay` | `loadingOverlay` | `boolean` |
| `loading-skeleton-rows` | `loadingSkeletonRows` | `number` |
| `error` | `error` | `string \| null` |
| `empty-message` | `emptyMessage` | `string` |
| `show-global-filter` | `showGlobalFilter` | `boolean` |
| `show-column-filters` | `showColumnFilters` | `boolean` |
| `filter-mode` | `filterMode` | `"row" \| "menu" \| "global" \| "none"` |
| `show-grouping-controls` | `showGroupingControls` | `boolean` |
| `show-row-selection` | `showRowSelection` | `boolean` |
| `show-pagination` | `showPagination` | `boolean` |
| `page-size` | `pageSize` | `number` |
| `pagination-position` | `paginationPosition` | `'top' \| 'bottom' \| 'both'` |
| `external-pagination` | `externalPagination` | `boolean` |
| `row-count` | `rowCount` | `number` |
| `page-index` | `pageIndex` | `number` |
| `virtualization` | `virtualization` | `boolean` |
| `row-height` | `rowHeight` | `number \| ((rowIndex: number) => number)` |
| `auto-row-height` | `autoRowHeight` | `boolean` |
| `row-resize` | `rowResize` | `boolean` |
| `header-height` | `headerHeight` | `number` |
| `overscan` | `overscan` | `number` |
| `container-height` | `containerHeight` | `number \| string` |
| `column-virtualization` | `columnVirtualization` | `boolean` |
| `column-overscan` | `columnOverscan` | `number` |
| `column-width` | `columnWidth` | `number` |
| `fit-columns` | `fitColumns` | `boolean` |
| `column-resize` | `columnResize` | `boolean` |
| `responsive` | `responsive` | `boolean \| { breakpoint?: number }` |
| `show-filter-menu` | `showFilterMenu` | `boolean` |
| `show-filter-row` | `showFilterRow` | `boolean` |
| `enable-cell-selection` | `enableCellSelection` | `boolean` |
| `move-cells` | `moveCells` | `boolean` |
| `enable-row-hover` | `enableRowHover` | `boolean` |
| `copy-headers-to-clipboard` | `copyHeadersToClipboard` | `boolean` |
| `enable-inline-editing` | `enableInlineEditing` | `boolean` |
| `full-row-editing` | `fullRowEditing` | `boolean` |
| `enable-row-summaries` | `enableRowSummaries` | `boolean` |
| `summary` | `summary` | `boolean` |
| `status-bar` | `statusBar` | `\| boolean \| { ... }` |
| `tool-panel` | `toolPanel` | `boolean` |
| `charting` | `charting` | `boolean \| ChartingConfig<TData>` |
| `column-menu-tabs` | `columnMenuTabs` | `boolean` |
| `tool-panel-default-open` | `toolPanelDefaultOpen` | `boolean` |
| `tool-panel-default-tab` | `toolPanelDefaultTab` | `"columns" \| "filters"` |
| `selection-mode` | `selectionMode` | `"row" \| "cell" \| "both" \| "none"` |
| `show-row-numbers` | `showRowNumbers` | `boolean` |
| `zebra-rows` | `zebraRows` | `boolean` |
| `row-number-width` | `rowNumberWidth` | `number` |
| `external-sort` | `externalSort` | `boolean` |
| `external-filter` | `externalFilter` | `boolean` |
| `editable-comments` | `editableComments` | `boolean` |
| `conditional-stat-scope` | `conditionalStatScope` | `"filtered" \| "visible" \| "all"` |
| `enable-column-reorder` | `enableColumnReorder` | `boolean` |
| `infer-column-types` | `inferColumnTypes` | `boolean` |
| `row-drag-managed` | `rowDragManaged` | `boolean` |
| `row-drag-group` | `rowDragGroup` | `string` |
| `aligned-grid-group` | `alignedGridGroup` | `string` |
| `filter-locale` | `filterLocale` | `string \| ReadonlyArray<string>` |

### Properties only (26)

Arrays, objects and functions. An HTML attribute is a string, so these can
only be assigned in script: `el.columns = [...]`.

| Property | Type |
| --- | --- |
| `data` | `ReadonlyArray<TData>` |
| `columns` | `Array<ColumnDef<TFeatures, TData>>` |
| `board` | `BoardConfig<TFeatures, TData>` |
| `scheduler` | `SchedulerConfig<TFeatures, TData>` |
| `chart` | `ChartViewConfig<TFeatures, TData>` |
| `pivot` | `GridPivotConfig<TData>` |
| `features` | `TFeatures` |
| `treeData` | `{ ... }` |
| `groupBy` | `ReadonlyArray<string>` |
| `expanded` | `Record<string, boolean>` |
| `localization` | `GridLocalization` |
| `pageSizeOptions` | `number[]` |
| `initialColumnPinning` | `{ ... }` |
| `processCellForClipboard` | `(params: { ... }) => unknown` |
| `initialSorting` | `Array<{ id: string; desc: boolean }>` |
| `initialAdvancedFilter` | `GridPredicateExpr \| null` |
| `getRowId` | `(row: TData, index: number) => string` |
| `rowClass` | `(ctx: { row: TData; rowIndex: number; }) => string \| ReadonlyArray<string> \| Record<str...` |
| `notes` | `Record<string, Record<string, string>>` |
| `conditionalFormats` | `ReadonlyArray<ConditionalFormat<TData>>` |
| `isDetailRow` | `(row: TData, rowIndex: number) => boolean` |
| `serverGroup` | `{ ... }` |
| `serverFilterValues` | `(columnId: string) => Promise<string[]>` |
| `pinnedTopRows` | `ReadonlyArray<TData>` |
| `pinnedBottomRows` | `ReadonlyArray<TData>` |
| `columnOrder` | `ReadonlyArray<string>` |

### Events (19)

`detail` is the callback's argument. The one callback that takes two carries
an object keyed by its parameter names.

| Event | From | `detail` |
| --- | --- | --- |
| `pivotmodechange` | `onPivotModeChange` | `on` |
| `expandedchange` | `onExpandedChange` | `expanded` |
| `paginationchange` | `onPaginationChange` | `pagination` |
| `apiready` | `onApiReady` | `api` |
| `rowselectionchange` | `onRowSelectionChange` | `{ selection, rows }` |
| `cellselectionchange` | `onCellSelectionChange` | `ranges` |
| `sortingchange` | `onSortingChange` | `sorting` |
| `advancedfilterchange` | `onAdvancedFilterChange` | `expr` |
| `filterschange` | `onFiltersChange` | `filters` |
| `notechange` | `onNoteChange` | `event` |
| `cellvaluechange` | `onCellValueChange` | `event` |
| `activecellchange` | `onActiveCellChange` | `cell` |
| `cellclick` | `onCellClick` | `event` |
| `rowclick` | `onRowClick` | `row` - published detail is the row, not the whole click event |
| `celldoubleclick` | `onCellDoubleClick` | `event` |
| `rowdoubleclick` | `onRowDoubleClick` | `event` |
| `scrollbottomreached` | `onScrollBottomReached` | `event` |
| `columnorderchange` | `onColumnOrderChange` | `order` |
| `rowdragend` | `onRowDragEnd` | `event` |

Plus one alias kept from before the surface was generated:

| Event | From | `detail` |
| --- | --- | --- |
| `selectionchange` | `onRowSelectionChange` | `rows` - published alias of rowselectionchange, detail is the selected rows |

### Not exposed (2)

| Prop | Why |
| --- | --- |
| `selectable` | element-level shorthand for row selection - see GridBody.svelte |
| `renderDetailRow` | Svelte snippet - cannot cross the custom-element boundary |

<!-- END generated reference -->


## The imperative API

The api surface `apiready` hands you.

<div data-docs-demo="90-selection-api" data-height="460"></div>

`onApiReady` fires once with the grid's api. Because a listener bound after
mount would miss it, the handle is also parked on the element:

```js
grid.addEventListener('apiready', (e) => e.detail.exportCsv())
// or, at any time later:
grid.api.exportCsv()
```


## See also

- [Quick start](./quick-start.md) - the CDN path, no build step.
- [Limitations](./limitations.md) - what cannot cross the boundary.
- [Shadow DOM](./shadow-dom.md) - `<sv-grid-shadow>` and style isolation.
