# Migrating from Smart.Grid (Smart Web Components)

Smart.Grid (htmlelements.com) and SvGrid come from the **same team**.
Smart.Grid is a framework-agnostic custom element - it even works inside
Svelte today - while SvGrid is the reactive, Svelte-5-native option. If
you are standardising a Svelte app on idiomatic components, this guide
maps a Smart.Grid setup onto SvGrid.

> Estimated effort: **2-4 hours** per grid. The main shift is from a
> custom element bound through properties / attributes to a reactive
> Svelte component.

## Vocabulary cheat sheet

| Smart.Grid (web component)               | sv-grid                                   |
| ---------------------------------------- | ----------------------------------------- |
| `<smart-grid>` element                   | `<SvGrid ... />`                           |
| `grid.dataSource = new Smart.DataAdapter`| `data` array (or `externalSort/Filter`)    |
| `{ label: 'Name', dataField: 'name' }`   | `{ header: 'Name', field: 'name' }`        |
| `template` / cell template               | `cell: (c) => renderSnippet(...)`          |
| `editing` + editor                       | `enableInlineEditing` + `editorType`       |
| `sorting` / `filtering`                  | `rowSortingFeature` / `columnFilteringFeature` |
| `grouping`                               | `columnGroupingFeature` + `api.setGroupBy()` |
| `paging` + `pager`                       | `showPagination`                           |
| element events (`change`, ...)           | `onCellValueChange`, `onApiReady`          |
| `theme` attribute                        | `--sg-*` tokens / Tailwind                 |

## Before / after

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
- <smart-grid id="grid" sorting filtering paging></smart-grid>
- <script>
-   const grid = document.querySelector('#grid')
-   grid.dataSource = new Smart.DataAdapter({ dataSource: rows, dataFields: [...] })
-   grid.columns = [
-     { label: 'Name',   dataField: 'name' },
-     { label: 'Amount', dataField: 'amount' },
-   ]
- </script>

+ <script lang="ts">
+   import {
+     SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature,
+     type ColumnDef,
+   } from '@svgrid/grid'
+   const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
+   const columns: ColumnDef<typeof features, Row>[] = [
+     { field: 'name',   header: 'Name' },
+     { field: 'amount', header: 'Amount', format: { type: 'currency', currency: 'USD' } },
+   ]
+ </script>
+
+ <SvGrid data={rows} columns={columns} features={features} showPagination />
```

## What changes

- **Custom element + DataAdapter → reactive `$state`.** Data binding is a
  prop, not an assigned `dataSource`.
- **Element templates → Svelte snippets** via `renderSnippet`.
- **`theme` attribute → `--sg-*` tokens.**

## A note on family

Smart.Grid is a genuinely good framework-agnostic grid from the same
team, and it runs in Svelte as a web component. The reason to pick SvGrid
is *idiomatic* Svelte: runes, snippets, and an MIT core. If you need one
grid across Angular, React, Vue, Svelte, and vanilla, Smart.Grid is the
right call.

## Frequently asked questions

### Is SvGrid from the same team as Smart.Grid?

Yes. Smart Web Components (htmlelements.com) and SvGrid are built by the same
team. SvGrid is the Svelte-5-native option with an MIT community core.

### Can I keep using Smart.Grid in Svelte instead?

Yes - Smart.Grid is a web component and works inside Svelte. Choose SvGrid when
you want an idiomatic Svelte component (runes + snippets) rather than a custom
element bound through properties.

### How do Smart.Grid columns map to SvGrid?

`label` becomes `header`, `dataField` becomes `field`, and element templates
become `renderSnippet` cells. Sorting / filtering / grouping move to registered
features.

## More examples

### Smart.Chart integration

Mounts a <smart-chart> web component (htmlelements.com) and pipes the grid\'s displayed rows into its dataSource. Re-aggregates on every filter / sort.

<div data-docs-demo="77-smart-chart" data-height="460"></div>

## What you end up with

Sorting, filtering and editing with a footer summary.

```svelte {runnable}
<SvGrid data={rows} {columns} sortable filterable editable summary />
```

## The ported grid, running

Sorting, filtering, editing and a totals row - the working set a Smart grid
usually carries, as props.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    city: string
    age: number
    salary: number
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', city: 'Portland', age: 54, salary: 155000 },
  ]

  let rows = $state<Person[]>(seed.map((p) => ({ ...p })))

  const columns: GridColumns<Person> = [
    { field: 'name',   header: 'Name',   width: 180, editorType: 'text' },
    { field: 'city',   header: 'City',   width: 150, editorType: 'text' },
    { field: 'salary', header: 'Salary', width: 150, editorType: 'number', summary: 'sum',
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<SvGrid data={rows} {columns} sortable filterable editable summary />
```

## See also

- [SvGrid vs Smart.Grid](https://svgrid.com/compare/smart-grid/) - the side-by-side comparison
- [About SvGrid](https://svgrid.com/about/) - built by jQWidgets / htmlelements.com
- [Cell components](./cells/cell-components.md) - snippet-based custom cells
