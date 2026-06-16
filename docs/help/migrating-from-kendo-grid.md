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

## See also

- [SvGrid vs Kendo UI Grid](https://svgrid.com/compare/kendo-ui-grid) - the side-by-side comparison
- [Pricing](https://svgrid.com/pricing) - the SvGrid Enterprise tiers
- [Architecture](./architecture.md) - engine + render-component split

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
