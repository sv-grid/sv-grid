---
'@svgrid/enterprise': minor
'@svgrid/grid': patch
---

`createWorkerDataSource` runs a grid's queries in a Web Worker. The worker
holds the rows and answers each `getRows` with a columnar engine
(`createColumnarDataSource`): each field is kept as its distinct values plus
an integer code per row, built in idle time after the rows load, so a filter
or search is decided once per distinct value, a sort is a counting sort over
integer ranks, and a grouping buckets rows by code. It answers exactly as
`createInMemoryDataSource` does, and hands the advanced filter expression,
pivot and sorts on mixed-type fields to that reference implementation. Only
the requested block crosses back. The worker side is `serveWorkerDataSource`
from the new `@svgrid/enterprise/worker` entry point, which has no Svelte or
DOM in its import graph. Aborted block requests are dropped from the worker's
queue before they run. Demo 500 puts it beside the free grid on the same data.

The server row model no longer re-maps every row of a level of leaves on each
change: it keeps the mapped rows and redoes only the ones the cache replaced,
and copies a flat level out in one slice. Grid row objects for unchanged rows
keep their identity across updates.

`createServerRowModel` takes `keepRowsWhileLoading` (milliseconds): after a
sort, a filter or a regroup, the rows on screen stay until the new answer's
first block lands or the time runs out, so a fast source goes from the old
rows to the new ones without a skeleton frame and with one render instead of
two. A failed block ends the wait. Off by default.

`createInMemoryDataSource` takes a third argument, `{ cacheResults: true }`,
which keeps the last 8 filtered and sorted results and answers another row
range of the same query by slicing one. It is off by default. Sorting text
now uses one shared `Intl.Collator`, which orders the same as the previous
`localeCompare`, and the `min` / `max` aggregates no longer throw a
`RangeError` on a group of more than about 150,000 rows (the V8 limit on
spread arguments).

In `@svgrid/grid`: the global search box no longer builds and keeps a cell
object per column on every row it checks; it reads the row values directly.
The dev-only config check no longer walks every placeholder row of a large
row model looking for a sample. Reusing a row object on a data change skips
clearing memoised values that were never computed.
