---
title: Offloading Heavy Grid Compute to a Web Worker
description: Keep the UI responsive by moving expensive grid work - parsing, aggregating, filtering huge datasets - off the main thread into a Web Worker.
date: 2026-09-20
category: Performance
tags: performance, web worker, threading, recipe, svelte data grid
author: Victor Vidolov
---

Virtualization keeps rendering cheap, but some work is just heavy no matter what, parsing a multi-megabyte upload, aggregating hundreds of thousands of rows, running a gnarly custom filter. Do that on the main thread and the whole UI freezes mid-scroll. A Web Worker moves it off-thread so the grid stays alive. Here is when it is worth it, and how.

![A drag-to-fill handle in SvGrid.](/blog-media/fill-handle.png)
*A drag-to-fill handle in SvGrid.*

## When it is worth it

Reach for a worker when a computation blocks the main thread long enough to drop frames or freeze interaction:

- Parsing large CSV/JSON uploads.
- Aggregating or grouping very large in-memory datasets.
- Expensive custom transforms (geo, stats, joins) over many rows.

For ordinary sorting and filtering, the engine and virtualization are fast enough, do not add a worker you do not need.

## The pattern

Run the heavy function in a worker and post the result back; set it as the grid's `data`:

```ts
// worker.ts
self.onmessage = (e) => {
  const result = aggregate(e.data.rows) // heavy work, off the main thread
  self.postMessage(result)
}
```

```svelte
<script lang="ts">
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  let rows = $state<Row[]>([])
  worker.onmessage = (e) => (rows = e.data)
  function recompute(input: Row[]) { worker.postMessage({ rows: input }) }
</script>

<SvGrid data={rows} columns={columns} features={features} />
```

Vite supports the `new Worker(new URL(...), { type: 'module' })` form directly.

## Mind the transfer cost

Posting data to and from a worker copies it (structured clone), which is not free for huge arrays. So:

- Do enough work in the worker to justify the copy.
- Consider transferable objects (ArrayBuffer) for very large numeric payloads.
- Show a loading state while the worker runs, see [empty, loading, and error states](empty-loading-and-error-states-svelte-grid).

## Keep the UI honest

While the worker computes, the grid should show a non-blocking loading indicator, and the rest of the page stays interactive, which is the entire point. When the result returns, swap it into `data` and virtualization renders it instantly.
