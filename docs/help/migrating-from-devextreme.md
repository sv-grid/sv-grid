# Migrating from DevExtreme DataGrid (DevExpress)

DevExtreme DataGrid is a deep, commercial multi-framework grid from
DevExpress (jQuery, React, Vue, Angular). Moving to SvGrid trades the
commercial suite for a Svelte-5-native grid with an MIT core and a far
lower-cost paid tier.

> Estimated effort: **3-6 hours** per grid.
>
> DevExtreme's option names vary by framework flavour; map your version's
> columns and events onto the SvGrid equivalents below.

<!-- facts:start devextreme-datagrid -->
> **Facts, checked 12 Sep 2026.** `devextreme` 26.1.4, Commercial (see licence file), last published 7 Aug 2026, 1,180,000 npm downloads in the 30 days to 10 Sep 2026. `@svgrid/grid` 3.0.3, MIT, last published 11 Sep 2026, 16,900 npm downloads in the same window. Bundle, minified and gzipped, each package built alone with Svelte external: SvGrid 3.0.4 95.8 KB JS + 10.5 KB CSS (measured 20 Sep 2026). DevExtreme DataGrid pricing, as its site states it: js.devexpress.com lists DevExtreme Complete at $899.99 per developer for a 12-month subscription with updates and support, renewing at $449.99; no free or non-commercial tier is shown (https://js.devexpress.com/Buy/, read 12 Sep 2026). SvGrid: MIT core; @svgrid/enterprise from $599 per developer per year. Side by side, with sources: [SvGrid vs DevExtreme DataGrid (DevExpress)](https://svgrid.com/compare/devextreme-datagrid/).
<!-- facts:end -->

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

The example at the end of this page runs against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  let rows = $state<Person[]>(people)

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200, editorType: 'text' },
    { field: 'department', header: 'Department', width: 150, editorType: 'text' },
    { field: 'city',       header: 'City',       width: 140, editorType: 'text' },
    { field: 'age',        header: 'Age',        width: 90,  editorType: 'number' },
    { field: 'salary',     header: 'Salary',     width: 130, editorType: 'number', format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

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

## What you end up with

Grouping with totals plus the filter row, the DevExtreme default layout.

```svelte {runnable}
<SvGrid data={rows} {columns} groupBy={['department']} summary groupable sortable filterMode="row" />
```

## See also

- [SvGrid vs DevExtreme DataGrid](https://svgrid.com/compare/devextreme-datagrid/) - the side-by-side comparison
- [Saved views](./saved-views.md) - the state-persistence pattern
- [Data export and printing - Enterprise](./export.md) - the Enterprise export pack
