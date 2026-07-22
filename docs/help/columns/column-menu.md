# Column menu

Every column header carries a menu button (⋮). By default it's a flat list of
actions plus a "Choose columns" submenu. Opt into the **tabbed** layout
with `columnMenuTabs`:

<div data-docs-demo="185-column-menu-tabs" data-height="480"></div>

```svelte
<SvGrid {data} {columns} {features} columnMenuTabs />
```

The tabbed menu has three tabs:

- **General** - sort ascending / descending / clear, pin left / right / unpin,
  autosize this / all columns, group / ungroup by the column, reset columns.
- **Filter** - the column's filter UI (operator + value, a second AND/OR
  condition, and the value checklist). Shown only when filtering is enabled for
  the column. This is the same UI the header's funnel icon opens, so the two
  stay in sync.
- **Columns** - a quick visibility checklist for every column, without leaving
  the menu.

The menu opens on the **General** tab. The **Filter** tab is omitted for columns
that aren't filterable (`filterable: false` or no `field`).

```svelte
<!-- The menu appears automatically; filtering enables the Filter tab. -->
<SvGrid {data} {columns} features={tableFeatures({ rowSortingFeature, columnFilteringFeature })} />
```

For a docked, always-visible version of the Columns and Filters lists, see the
[tool panel](./tool-panel.md).

## See also

- [Filter conditions](../filtering/filter-conditions.md)
- [Tool panel](./tool-panel.md)
- [Column groups](./column-groups.md)
