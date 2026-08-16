# Migrating from DevExtreme DataGrid (DevExpress)

DevExtreme DataGrid is a deep, commercial multi-framework grid from
DevExpress (jQuery, React, Vue, Angular). Moving to SvGrid trades the
commercial suite for a Svelte-5-native grid with an MIT core and a far
lower-cost paid tier.

> Estimated effort: **3-6 hours** per grid.
>
> DevExtreme's option names vary by framework flavour; map your version's
> columns and events onto the SvGrid equivalents below.

## Concept map

| DevExtreme DataGrid                      | sv-grid                                   |
| ---------------------------------------- | ----------------------------------------- |
| `columns: [{ dataField, caption }]`      | `columns: [{ field, header }]`             |
| `cellTemplate`                           | `cell: (c) => renderSnippet(...)`          |
| `editing: { mode, allowUpdating }`       | `enableInlineEditing` + `editorType`       |
| `sorting` / `filterRow` / `headerFilter` | `rowSortingFeature` / `columnFilteringFeature` |
| `grouping` + `summary`                   | `columnGroupingFeature` + aggregates       |
| `masterDetail`                           | `rowExpandingFeature` / master-detail rows |
| `dataSource` (store / remote)            | `data` array or `externalSort/Filter`      |
| `paging` + `pager`                       | `showPagination`                           |
| `export`                                 | `@svgrid/enterprise` export pack                  |
| `stateStoring`                           | persist column state yourself (saved views) |

## Shape of the change

```diff
- $('#grid').dxDataGrid({
-   dataSource: rows,
-   paging: { pageSize: 25 },
-   sorting: { mode: 'multiple' }, filterRow: { visible: true },
-   editing: { mode: 'cell', allowUpdating: true },
-   columns: [
-     { dataField: 'name',   caption: 'Name' },
-     { dataField: 'amount', caption: 'Amount', format: 'currency' },
-   ],
- })

+ <SvGrid
+   data={rows}
+   columns={[
+     { field: 'name',   header: 'Name' },
+     { field: 'amount', header: 'Amount', format: { type: 'currency', currency: 'USD' } },
+   ]}
+   features={tableFeatures({ rowSortingFeature, columnFilteringFeature })}
+   showPagination enableInlineEditing />
```

## Why teams switch

- **Svelte 5 native** instead of a multi-framework commercial library.
- **MIT community core** plus an optional Enterprise pack for export / import /
  pivot / AI.
- **Much lower-cost paid tier.**

## What to weigh

- DevExtreme has a **larger built-in feature surface** (state storing,
  broad export, a full suite). If you depend on those, factor them in -
  `stateStoring` in particular becomes a saved-views pattern you wire up.

## See also

- [SvGrid vs DevExtreme DataGrid](https://svgrid.com/compare/devextreme-datagrid/) - the side-by-side comparison
- [Saved views](./saved-views.md) - the state-persistence pattern
- [Data export and printing - Enterprise](./export.md) - the Enterprise export pack

## Frequently asked questions

### How do DevExtreme columns map to SvGrid?

`dataField` becomes `field`, `caption` becomes `header`, and `cellTemplate`
becomes a `renderSnippet` cell. Sorting / filtering / grouping move from grid
options to registered features.

### Is SvGrid cheaper than DevExtreme?

For a Svelte stack, yes - the core is MIT and the paid tier is far below
commercial-suite pricing. You give up DevExtreme's multi-framework reach and
some built-in features like `stateStoring`.

### Does SvGrid export like DevExtreme?

Yes, via the `@svgrid/enterprise` pack: Excel, PDF, CSV, TSV, and HTML export plus a
printable view.
