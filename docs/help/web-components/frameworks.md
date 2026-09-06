# SvGrid with React, Vue or Angular

Pick your framework and you have a running grid in about thirty seconds - no
local setup, nothing to configure.

## The 30-second path

**1.** Install one package:

<div data-docs-install="@svgrid/grid-wc"></div>

**2.** Import the component for your framework and render it:

| Framework | Import | Tag |
| --- | --- | --- |
| React | `import { SvGrid } from '@svgrid/grid-wc/react'` | `<SvGrid data={rows} columns={cols} sortable filterable />` |
| Vue | `import { SvGrid } from '@svgrid/grid-wc/vue'` | `<SvGrid :data="rows" :columns="cols" sortable filterable />` |
| Angular | `import { SvGridComponent } from '@svgrid/grid-wc/angular'` | `<sv-grid [data]="rows" [columns]="cols" [sortable]="true" />` |

That is the whole integration. All 98 properties and 20 events of the grid are
typed props on every one of them.

**Or skip step 1** and open a working project right now:

<div data-docs-sandbox="react:basic" data-title="A first grid"></div>
<div data-docs-sandbox="vue:basic" data-title="A first grid"></div>
<div data-docs-sandbox="angular:basic" data-title="A first grid"></div>

## The examples

<!-- BEGIN generated recipe table - packages/grid-wc/scripts/sync-example-docs.mjs -->

The same nine apps in each framework, so you can compare them
directly - only the framework differs, never the data or the grid
configuration. Every one is compiled in CI, so what you open is what works.

| Recipe | What it shows | React | Vue | Angular |
| --- | --- | --- | --- | --- |
| A first grid | Rows, columns, and the two features almost every table wants | [→](./react.md#a-first-grid) | [→](./vue.md#a-first-grid) | [→](./angular.md#a-first-grid) |
| Sorting and filtering | A filter row under the headers, multi-column sort, and the current sort read back into your own state | [→](./react.md#sorting-and-filtering) | [→](./vue.md#sorting-and-filtering) | [→](./angular.md#sorting-and-filtering) |
| Editing and saving | Inline editing, with each committed edit arriving through `cellvaluechange` | [→](./react.md#editing-and-saving) | [→](./vue.md#editing-and-saving) | [→](./angular.md#editing-and-saving) |
| Row selection | Checkboxes, with the selected rows handed straight to you - both the selection map and the rows themselves | [→](./react.md#row-selection) | [→](./vue.md#row-selection) | [→](./angular.md#row-selection) |
| Grouping and totals | Group by one or two columns with an aggregate in the group row | [→](./react.md#grouping-and-totals) | [→](./vue.md#grouping-and-totals) | [→](./angular.md#grouping-and-totals) |
| Pagination | Client-side paging | [→](./react.md#pagination) | [→](./vue.md#pagination) | [→](./angular.md#pagination) |
| Server-side data | The grid renders the page you hand it and tells you when the user wants another | [→](./react.md#server-side-data) | [→](./vue.md#server-side-data) | [→](./angular.md#server-side-data) |
| Theming | The `--sg-*` custom properties | [→](./react.md#theming) | [→](./vue.md#theming) | [→](./angular.md#theming) |
| Excel export (Enterprise) | The paid pack from a non-Svelte host | [→](./react.md#excel-export-enterprise) | [→](./vue.md#excel-export-enterprise) | [→](./angular.md#excel-export-enterprise) |

<!-- END generated recipe table -->
## What each wrapper is actually for

The grid is a custom element underneath, and a custom element is awkward in each
framework in a different way. Each wrapper removes exactly that awkwardness:

- **React** - React 18 and earlier stringify object props onto **attributes**,
  so `columns={cols}` silently becomes `"[object Object]"` and the grid renders
  empty with no error. The wrapper assigns them as properties on every version.
- **Vue** - removes the `isCustomElement` build config and the `.prop` modifier
  that every object binding would otherwise need.
- **Angular** - removes `CUSTOM_ELEMENTS_SCHEMA` from every component that shows
  a grid, and gives you typed `@Input` / `@Output` instead of an untyped
  element. Its selector is the element's own tag, so there is no extra wrapper
  element in your DOM.

All three also handle two ordering problems you would otherwise meet yourself:
the element renders **before** a framework assigns properties in an effect, and
`apiready` fires once during that first mount - before React can bind a listener
at all.

## The imperative api

Every wrapper exposes the grid api once it is ready:

- **React** - a ref: `grid.current?.api`
- **Vue** - a template ref: `grid.value?.api`
- **Angular** - the component instance: `grid.api`

## Not using a framework?

`<sv-grid>` works in plain HTML with one `<script>` tag - see
[Quick start](./quick-start.md).

## See also

- [`<sv-grid>` reference](./sv-grid.md) - every property, attribute and event.
- [Shadow DOM](./shadow-dom.md) - for pages whose CSS you do not control.
- [TypeScript](./typescript.md) - typing the raw element, if you use it directly.
- [Limitations](./limitations.md) - what cannot cross the boundary.
