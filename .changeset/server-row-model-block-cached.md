---
'@svgrid/enterprise': minor
'@svgrid/grid': minor
---

`createServerRowModel`: the server-side row model, block-cached at every level.

The previous model (`createServerGroupModel`, still exported) fetched one block
per group and appended more behind a "Load N more" button. This one runs a
block cache per level - the top level and every expanded group or tree node -
so a group with a hundred thousand rows scrolls like a flat table of a hundred
thousand rows: blocks load as the viewport reaches them, rows not yet reached
are placeholders the grid draws as skeletons, blocks are evicted least-recently
seen, failed blocks show a Retry, and one concurrency cap spans every level.

```ts
import { createServerRowModel } from '@svgrid/enterprise'
const ctl = createServerRowModel(source, {
  groupBy: ['region', 'country'],
  aggregations: [{ col: 'amount', fn: 'sum' }],
  groupFooters: true,
  grandTotalRow: 'pinnedBottom',
  onChange: (s) => (view = s),
})
```

```svelte
<SvGrid rowModel={ctl} {columns} />
```

Beyond scrolling, the options and methods every server row model is expected
to have: `childCount` (the badge beside a group key, and the group's scrollbar
before it opens), `isGroupOpenByDefault`, `expandAll({ includeUnloaded })` /
`collapseAll`, `levelParams` for per-level block size / cache size / "load the
whole level" (`infinite: false`), `refresh({ route, purge })` that reloads one
level in place (or drops the subtree and starts over), `retryLoads`,
`applyRowData` to fill a level without a request, `hideOpenParents`,
`allowUnbalancedGroups`, `purgeClosedGroups`, `getLevelState` /
`getCacheState`, `debug`, and the `onStoreRefreshed` / `onGroupOpened` /
`onLoadError` events.

Sorting and filtering re-fetch selectively, the way a server row model should:
sorting a column that is neither grouped nor aggregated re-orders leaves only,
sorting a grouped column re-fetches its own level, sorting an aggregated column
re-fetches everything (`sortAllLevels: true` forces that, `clientSideSort:
true` sorts a fully loaded level in the browser). A filter reloads everything
unless `onlyRefreshFilteredGroups` narrows it to the levels it touches.

**Grand totals.** With `grandTotalRow` set, the root request carries
`needsGrandTotal: true` and the source answers `grandTotal` (an object sets
it, `null` removes it, absent keeps the cached one). The row has the fixed id
`sv-grand-total`, group footers `sv-group-total:<route>`, so transactions can
address them. `'top'` / `'bottom'` put it in the list; `'pinnedTop'` /
`'pinnedBottom'` pin it through the grid.

**Backends.** `planQuery` now emits `childGroupBy` and `grandTotal`, and
records `pathPredicates`; `planToSql` adds `COUNT(...) AS "childCount"` to
every grouped SELECT and hands back `grandTotalSelect` /
`grandTotalWhereText` / `grandTotalParams` for the total as its own
statement; `createInMemoryDataSource`, `createSqlDataSource`,
`createRestDataSource` and `createSupabaseDataSource` all answer both.

Also fixed: `createSqlDataSource.getRows` never ran the grouped SELECT that
`planToSql` produced - a grouped request got the flat leaf query back, with a
row count of rows rather than groups. It now uses `select` / `groupByText` /
`countText` like the docs said it did.

In `@svgrid/grid` (additive): `ServerRequest.needsGrandTotal` / `parentRow` /
`context`, `ServerResult.grandTotal`, `ServerDataSource.destroy`,
`ServerGroupRow.childCount`, the `ServerGrandTotalRow` and
`ServerPlaceholderRow` display kinds, `createRowPlaceholder`,
`BlockCache.applyRows`, `GridRowModel.pinnedTopRows` / `pinnedBottomRows`,
and a Svelte-free `@svgrid/grid/server` subpath carrying the server
primitives for code (an endpoint, a worker, a test without the compiler)
that must not import `SvGrid.svelte`.
