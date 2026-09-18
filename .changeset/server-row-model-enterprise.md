---
'@svgrid/grid': major
'@svgrid/enterprise': minor
---

Move the server-side GROUP row model into `@svgrid/enterprise`.

The free grid keeps the whole server datasource contract and the flat
controller: `ServerDataSource`, `ServerRequest`, `ServerResult`,
`createServerDataSource` (sort, filter, paging, CRUD, optimistic updates), the
`serverGroup` keyboard + treegrid prop, and `serverFilterValues`. Talking to a
server about flat rows is free, and stays free.

What grouping and tree data need on top of that - the lazy group tree, its
per-node cache, aggregation rows, subtotal footers, skeleton placeholders,
intra-group paging, and the two components that draw them - is now Enterprise,
alongside the backend adapters (`planQuery`, `planToSql`,
`createInMemoryDataSource`, `createSqlDataSource`, the REST and Supabase
sources) that have always lived there.

**Breaking:** these five exports left `@svgrid/grid`. Change the import; nothing
else changes, and a golden test in the new package pins the display rows to
prove it.

```diff
-import { createServerGroupModel, serverGroupRows, serverGroupNav, SvGroupCell, SvRowGroupPanel } from '@svgrid/grid'
+import { createServerGroupModel, serverGroupRows, serverGroupNav, SvGroupCell, SvRowGroupPanel } from '@svgrid/enterprise'
```

The types moved with them (`ServerGroupController`, `ServerGroupControllerOptions`,
`ServerGroupState`, `ServerGroupGridRow`). `@svgrid/enterprise/server` is a new
subpath for apps that want the row model without the rest of the barrel, and
`installEnterprise(api)` now calls `enableServerRowModel()`.

Like every other Enterprise feature this is soft-gated: it works without a
license key, and shows the unlicensed watermark plus a one-time console notice.

Also in `@svgrid/grid`: `ServerControllerOptions` is now exported. It is the
options type for `createServerDataSource` and was missing from the barrel, so
building an options object as a named value did not type-check.
