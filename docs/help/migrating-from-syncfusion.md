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
| `toolbar` export                         | `sv-grid-pro` export pack                  |

## Shape of the change

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
- **Optional Pro pack** for export / import / pivot / AI.

## What to weigh

- Syncfusion ships **one of the largest feature sets and suites**
  available, plus Blazor support. If you need that breadth or Blazor,
  weigh it against the Svelte-native fit.

## See also

- [SvGrid vs Syncfusion Grid](https://svgrid.com/compare/syncfusion-grid) - the side-by-side comparison
- [Data export and printing - Pro](./export.md) - the Pro export pack
- [Getting started](../getting-started.md) - a working grid in ~15 lines

## Frequently asked questions

### Is SvGrid free, unlike the Syncfusion commercial license?

`sv-grid-core` is MIT - free for everyone, with no revenue or team-size
conditions. Syncfusion's community license is free only for qualifying small
teams; otherwise it is commercial.

### How do Syncfusion columns map to SvGrid?

`field` stays `field`, `headerText` becomes `header`, and `template` becomes a
`renderSnippet` cell. Sorting / filtering / grouping move to registered
features.

### Does SvGrid support Blazor?

No - SvGrid is Svelte 5 only. If you need Blazor, that is a genuine reason to
stay on Syncfusion. For a Svelte stack, SvGrid is the native fit.
