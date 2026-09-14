# Migrating from Kendo UI Grid (Telerik)

Kendo UI Grid is the polished, commercial enterprise grid from Telerik /
Progress, available for jQuery, React, Vue, and Angular. Moving to SvGrid
trades the multi-framework commercial suite for a Svelte-5-native grid
with an MIT core - and a much cheaper paid tier.

> Estimated effort: **3-6 hours** per grid - column / event translation
> plus re-theming.
>
> Kendo's exact API differs across its jQuery / React / Vue / Angular
> flavours; map your version's column and event names onto the SvGrid
> equivalents below.

<!-- facts:start kendo-ui-grid -->
> **Facts, checked 12 Sep 2026.** `@progress/kendo-react-grid` 16.1.0, Commercial (see licence file), last published 8 Sep 2026, 385,000 npm downloads in the 30 days to 10 Sep 2026. `@svgrid/grid` 3.0.3, MIT, last published 11 Sep 2026, 16,900 npm downloads in the same window. Bundle, minified and gzipped, each package built alone with Svelte external: SvGrid 3.0.3 84.5 KB JS + 9.5 KB CSS (measured 12 Sep 2026). Kendo UI Grid pricing, as its site states it: telerik.com lists the Kendo UI bundle at $799, $849 or $1,299 per developer per year depending on the support tier, and KendoReact alone from $649 per developer per year; no free tier for the grid (https://www.telerik.com/purchase.aspx, read 12 Sep 2026). SvGrid: MIT core; @svgrid/enterprise from $599 per developer per year. Side by side, with sources: [SvGrid vs Kendo UI Grid (Telerik)](https://svgrid.com/compare/kendo-ui-grid/).
<!-- facts:end -->

## Concept map

| Kendo UI Grid                            | sv-grid                                   |
| ---------------------------------------- | ----------------------------------------- |
| `columns: [{ field, title }]`            | `columns: [{ field, header }]`             |
| `template` / cell render                 | `cell: (c) => renderSnippet(...)`          |
| `editable` + editor                      | `enableInlineEditing` + `editorType`       |
| `sortable` / `filterable`                | `rowSortingFeature` / `columnFilteringFeature` |
| `group` / aggregates                     | `columnGroupingFeature` + `api.setGroupBy()` |
| `dataSource` (local / remote)            | `data` array or `externalSort/Filter`      |
| `pageable`                               | `showPagination`                           |
| Kendo themes (Default / Bootstrap)       | `--sg-*` tokens / Tailwind                 |
| Grid events (`change`, `dataBound`)      | `onCellValueChange`, `onApiReady`, ...      |

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
- $('#grid').kendoGrid({
-   dataSource: { data: rows, pageSize: 25 },
-   sortable: true, filterable: true, pageable: true, editable: true,
-   columns: [
-     { field: 'name',   title: 'Name' },
-     { field: 'amount', title: 'Amount', format: '{0:c}' },
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

- **Svelte 5 native** instead of a jQuery / multi-framework suite.
- **MIT community core** - no per-developer license for the grid itself.
- **Paid support at a fraction of enterprise-suite pricing.**
- **No design-system lock-in** - theme via `--sg-*` tokens.

## What to weigh

- Kendo bundles a **huge component suite** (charts, scheduler, editor)
  and decades of vendor support. If you need the whole suite across
  several frameworks, that has real value.

## Frequently asked questions

### Is SvGrid a cheaper alternative to Kendo UI Grid?

For a Svelte stack, yes: the `@svgrid/grid` core is MIT (free, including
commercial use), and the paid `@svgrid/enterprise` tier is a fraction of enterprise
component-suite pricing.

### How long does a Kendo Grid migration take?

About 3-6 hours per grid. It is a column / event rename pass plus re-theming;
the columns and editing concepts map closely.

### Does SvGrid match Kendo's feature set?

For the grid itself it covers the common enterprise surface - sorting,
Excel-style filters, grouping, virtualization, editing, master/detail, tree.
Kendo's value beyond that is the wider suite and multi-framework parity.

## What you end up with

Sorting, filtering, grouping and editing, with the column menu Kendo users expect.

```svelte {runnable}
<SvGrid data={rows} {columns} groupBy={['department']} groupable sortable filterable editable />
```

## See also

- [SvGrid vs Kendo UI Grid](https://svgrid.com/compare/kendo-ui-grid/) - the side-by-side comparison
- [Pricing](https://svgrid.com/pricing/) - the SvGrid Enterprise tiers
- [Architecture](./architecture.md) - engine + render-component split
