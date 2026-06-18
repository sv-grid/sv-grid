---
title: Pagination Patterns - Offset, Cursor, and Infinite Scroll
description: Choose the right paging strategy for your Svelte data grid and wire offset, cursor, and infinite-scroll patterns to SvGrid.
date: 2026-01-06
category: Data
tags: pagination, cursor, infinite scroll, svelte data grid
author: Victor Vidolov
---

"Add pagination" sounds like one task, but it is really a choice between three patterns, and the right one depends on your backend more than your grid. SvGrid handles classic page controls and pairs cleanly with cursor and infinite-scroll backends, here is how to pick.

![Server-driven pagination in SvGrid](/blog-media/server-row-model.png)
*A server row model paging data in SvGrid.*

## Classic offset pagination

The familiar "Page 3 of 50" model. Enable the pager and pick a page size:

```svelte
<SvGrid
  data={pageRows}
  columns={columns}
  features={features}
  showPagination={true}
  pageSize={50}
  rowCount={total}
  onPaginationChange={(p) => load(p.pageIndex)}
/>
```

Offset paging is simple and lets users jump to any page. Its weakness is large offsets, `OFFSET 100000` is slow on most databases, and rows shifting between requests can cause skips.

## Cursor pagination

For big or fast-changing datasets, cursor paging is more robust. Instead of "skip 100000", you ask for "the 50 rows after this key". Track the cursor your API returns and request the next slice:

```ts
let cursor = null
async function next() {
  const res = await api.page({ after: cursor, limit: 50 })
  cursor = res.nextCursor
  rows = res.items
}
```

Cursor paging stays fast at any depth and does not skip rows when the underlying data changes. The trade-off is you cannot jump straight to an arbitrary page.

## Infinite scroll

For feeds and exploratory browsing, append the next page as the user scrolls near the bottom rather than showing page controls. Combine this with virtualization so the DOM stays bounded even as the in-memory array grows, load more data, but never render more nodes than the viewport needs.

## Which should you use?

| Pattern        | Best for                                  |
| -------------- | ----------------------------------------- |
| Offset         | Small/medium sets, jump-to-page needed    |
| Cursor         | Large or fast-changing data, deep paging  |
| Infinite scroll| Feeds, browsing, mobile                   |

## Frequently asked questions

### How do I paginate a Svelte data grid?

Enable `showPagination` and set `pageSize`. For server-side data, listen to `onPaginationChange`, fetch the page, and pass a total `rowCount` for the pager.

### When should I use cursor pagination instead of offset?

Use cursor paging for large or frequently changing datasets and deep paging, where offset queries get slow and rows can shift between requests.
