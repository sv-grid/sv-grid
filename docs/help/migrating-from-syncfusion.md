# Migrating from Syncfusion Grid

Syncfusion Grid is a comprehensive commercial grid across JavaScript,
React, Vue, Angular, and Blazor, with a free community license for
qualifying small teams. Moving to SvGrid trades the multi-framework suite
for a Svelte-5-native grid with an unconditional MIT core.

> Estimated effort: **3-6 hours** per grid.
>
> Syncfusion's option names vary across its framework flavours; map your
> version's columns and events onto the SvGrid equivalents below.

## Concept map

| Syncfusion Grid                          | sv-grid                                   |
| ---------------------------------------- | ----------------------------------------- |
| `columns: [{ field, headerText }]`       | `columns: [{ field, header }]`             |
| `template` / cell template               | `cell: (c) => renderSnippet(...)`          |
| `editSettings` + `editType`              | `enableInlineEditing` + `editorType`       |
| `allowSorting` / `allowFiltering`        | `rowSortingFeature` / `columnFilteringFeature` |
| `allowGrouping` + `aggregates`           | `columnGroupingFeature` + aggregates       |
| `detailTemplate`                         | `rowExpandingFeature` / master-detail rows |
| `dataSource` (local / `DataManager`)     | `data` array or `externalSort/Filter`      |
| `allowPaging` + `pageSettings`           | `showPagination`                           |
| `toolbar` export                         | `@svgrid/enterprise` export pack                  |

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
- <ejs-grid [dataSource]="rows" [allowSorting]="true" [allowFiltering]="true"
-           [allowPaging]="true" [editSettings]="{ allowEditing: true }">
-   <e-columns>
-     <e-column field="name"   headerText="Name"></e-column>
-     <e-column field="amount" headerText="Amount" format="C2"></e-column>
-   </e-columns>
- </ejs-grid>

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

- **Svelte 5 native** instead of a multi-framework commercial suite.
- **Unconditional MIT core** - no revenue / headcount threshold like the
  Syncfusion community license.
- **Optional Enterprise pack** for export / import / pivot / AI.

## What to weigh

- Syncfusion ships **one of the largest feature sets and suites**
  available, plus Blazor support. If you need that breadth or Blazor,
  weigh it against the Svelte-native fit.

## Frequently asked questions

### Is SvGrid free, unlike the Syncfusion commercial license?

`@svgrid/grid` is MIT - free for everyone, with no revenue or team-size
conditions. Syncfusion's community license is free only for qualifying small
teams; otherwise it is commercial.

### How do Syncfusion columns map to SvGrid?

`field` stays `field`, `headerText` becomes `header`, and `template` becomes a
`renderSnippet` cell. Sorting / filtering / grouping move to registered
features.

### Does SvGrid support Blazor?

No - SvGrid is Svelte 5 only. If you need Blazor, that is a genuine reason to
stay on Syncfusion. For a Svelte stack, SvGrid is the native fit.

## What you end up with

Sort, filter, group and inline edit - the four things a Syncfusion grid is usually doing.

```svelte {runnable}
<SvGrid data={rows} {columns} groupBy={['department']} groupable sortable filterable editable />
```

## See also

- [SvGrid vs Syncfusion Grid](https://svgrid.com/compare/syncfusion-grid/) - the side-by-side comparison
- [Data export and printing - Enterprise](./export.md) - the Enterprise export pack
- [Getting started](../getting-started.md) - a working grid in ~15 lines
