---
'@svgrid/enterprise': minor
'@svgrid/grid': minor
---

Paging on the server-side row model, and levels that load one block per click.

```ts
const ctl = createServerRowModel(source, {
  groupBy: ['region', 'country'],
  pagination: { pageSize: 25, pageSizes: [10, 25, 50], paginateChildRows: true },
  levelParams: (level) => (level === 2 ? { loadMore: true } : {}),
})
```

`pagination` pages the top level: a page is `pageSize` top-level rows, each
shown with whatever is open beneath it; with `paginateChildRows` the page is
cut from the flattened tree instead, children counted. Blocks stay
independent of pages, so a page of 20 over blocks of 100 costs one request
per five pages, and turning to a page whose block is cached costs none. The
grid's footer pager drives it through the `rowModel` prop (`pageable` on the
grid); `setPage` / `setPageSize` do the same from code, and `state.pagination`
says where the pager stands. `autoPageSize` asks the grid to fit the page to
its body, re-measured as it resizes; `pageSizes` fills the footer's selector.

`levelParams` gained `loadMore`: that level shows the blocks it has loaded
and a "Load N more" row (the `more` display kind `SvGroupCell` already
draws) while the server holds more; the row's toggle, or
`loadMoreChildren(route)`, fetches the next block. Scrolling over such a
level fetches nothing.

In `@svgrid/grid`: `GridRowModel.pagination` takes `pageSizes` and
`autoPageSize`; the grid feeds the first to the footer's selector and, for
the second, measures its body and calls `setPageSize` with the rows that
fit.

Demo 344 switches between the three ways leaves arrive: scroll, load more,
paged.
