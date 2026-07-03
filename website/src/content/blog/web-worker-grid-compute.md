---
title: Offloading Heavy Grid Compute to a Web Worker
description: Parsing large datasets and running aggregations on the main thread blocks scroll and animation. Here is how to move that work to a Web Worker and wire the result back into SvGrid.
date: 2026-09-20
updated: "2026-07-02"
category: Performance
tags: performance, web worker, threading, recipe, svelte data grid
author: Victor Vidolov
---
A 400 ms main-thread stall is invisible in a profiler if you are not looking for it. But users feel it every time - the page locks mid-scroll, a button press goes unanswered, a spinner freezes. Virtualization solves the rendering side of large data. It does nothing for the computation side.

The typical culprits: parsing a 4 MB CSV the user uploaded, computing a 90-day rolling aggregate over 300,000 rows, or running a cross-column statistical join before the grid can render anything meaningful. These are not rendering problems. A Web Worker handles them on a separate OS thread while the main thread keeps animating and responding.

## Why the main thread stalls at all

JavaScript is single-threaded. When you call a function that runs for 350 ms, the browser cannot process input events, run CSS animations, or paint frames during that entire window. Virtualization does not help here because the DOM work is cheap - the data transformation before `data` is set is the problem.

The structured-clone cost of crossing the `postMessage` boundary is often cited as a concern, but in practice it is small relative to the compute savings. For 200,000 plain objects with six fields each, the clone is 30-50 ms and runs asynchronously - the main thread is not blocked during the copy, only during the dispatch. The worker then does its computation on its own thread. The main thread wakes up when `onmessage` fires with the result.

## What the worker owns and what SvGrid owns

The split is important. The worker is responsible for exactly one thing: heavy data transformation that you would otherwise do before setting the `data` prop. SvGrid retains full ownership of everything after that - column filtering, sorting, grouping, pagination, cell rendering, selection state, undo/redo. Those features run fast on the main thread because they operate on already-reduced data.

For a sales analytics dashboard with 200,000 raw deal rows, the worker computes region-level aggregates. The grid receives the 4 to 50 summary rows and handles all subsequent interactivity itself. The worker is not re-invoked when the user resorts or regroups.

```ts
// src/workers/aggregate.worker.ts
// Pure computation - no DOM, no Svelte, no @svgrid/grid imports.

export type DealRow = {
  id: string
  region: string
  stage: string
  amount: number
  probability: number
  closeDate: string
}

export type RegionSummary = {
  region: string
  totalAmount: number
  avgProbability: number
  dealCount: number
  weightedForecast: number
}

type InMessage = { rows: DealRow[]; gen: number }
type OutMessage = { summary: RegionSummary[]; gen: number }

self.onmessage = (e: MessageEvent<InMessage>) => {
  const { rows, gen } = e.data

  const buckets = new Map<string, { amount: number; prob: number; count: number }>()

  for (const row of rows) {
    const b = buckets.get(row.region) ?? { amount: 0, prob: 0, count: 0 }
    b.amount += row.amount
    b.prob   += row.probability
    b.count  += 1
    buckets.set(row.region, b)
  }

  const summary: RegionSummary[] = []
  for (const [region, b] of buckets) {
    summary.push({
      region,
      totalAmount:      b.amount,
      avgProbability:   Math.round(b.prob / b.count),
      dealCount:        b.count,
      weightedForecast: Math.round(b.amount * (b.prob / b.count) / 100),
    })
  }

  self.postMessage({ summary, gen } satisfies OutMessage)
}
```

Notice the `gen` field echoed back. That is a generation counter that lets the component discard stale results if the user triggers a second compute before the first finishes. Workers process messages serially - two back-to-back `postMessage` calls will produce two results in order, and the second can overwrite the first in a way that looks correct but is not if you care which input produced the result.

## Wiring the worker to SvGrid

Vite handles worker bundling natively when you use the `new URL(..., import.meta.url)` form. No plugin needed. The worker is emitted as a separate chunk and tree-shaken independently.

```svelte
<!-- src/routes/SalesDashboard.svelte -->
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnGroupingFeature,
    rowSelectionFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import type { DealRow, RegionSummary } from '../workers/aggregate.worker'

  const features = tableFeatures({
    rowSortingFeature,
    columnGroupingFeature,
    rowSelectionFeature,
  })

  let rows     = $state<RegionSummary[]>([])
  let loading  = $state(false)
  let genRef   = 0

  type OutMessage = { summary: RegionSummary[]; gen: number }

  // Worker is created inside $effect so SSR cannot touch it.
  $effect(() => {
    const worker = new Worker(
      new URL('../workers/aggregate.worker.ts', import.meta.url),
      { type: 'module' },
    )

    worker.onmessage = (e: MessageEvent<OutMessage>) => {
      // Discard if a newer request is in-flight.
      if (e.data.gen !== genRef) return
      rows    = e.data.summary
      loading = false
    }

    worker.onerror = (err) => {
      console.error('aggregate worker failed', err)
      loading = false
    }

    async function run() {
      loading = true
      genRef  = genRef + 1
      const gen = genRef
      const res  = await fetch('/api/deals')
      const data: DealRow[] = await res.json()
      worker.postMessage({ rows: data, gen })
    }

    run()

    // Terminate when the component unmounts.
    return () => worker.terminate()
  })

  let api = $state<SvGridApi<typeof features, RegionSummary> | null>(null)

  const columns: ColumnDef<typeof features, RegionSummary>[] = [
    { id: 'region',           field: 'region',           header: 'Region',            width: 160 },
    { id: 'dealCount',        field: 'dealCount',         header: 'Deals',             width: 80,  type: 'number' },
    { id: 'totalAmount',      field: 'totalAmount',       header: 'Total Amount',      width: 150, type: 'number',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { id: 'avgProbability',   field: 'avgProbability',    header: 'Avg Prob %',        width: 110, type: 'number' },
    { id: 'weightedForecast', field: 'weightedForecast',  header: 'Weighted Forecast', width: 160, type: 'number',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
  ]
</script>

{#if loading}
  <p class="status">Computing aggregates off-thread...</p>
{/if}

<SvGrid
  data={rows}
  {columns}
  {features}
  onApiReady={(ready) => { api = ready }}
  sortable
  groupable
  rowHeight={36}
  style="height: 420px;"
/>
```

The component renders an empty grid while the worker runs. SvGrid's built-in empty-state handling covers that case cleanly - no spinner injection needed. When `rows` is set, the grid reacts and renders all summary rows.

## Transferables vs structured clone

Most payloads are plain object arrays and must go through structured clone. The 30-50 ms copy cost for 200,000 objects is acceptable for a one-time initial load.

If your data is already numeric - say, a `Float64Array` of price values - you can transfer it with zero copy:

```ts
// In the component, if your payload is a typed array:
const buffer = new Float64Array(rawPrices)
worker.postMessage({ buffer, gen }, [buffer.buffer])
// buffer.buffer is now detached on the main thread - do not read it after this line.

// In the worker:
self.onmessage = (e: MessageEvent<{ buffer: Float64Array; gen: number }>) => {
  const { buffer, gen } = e.data
  let sum = 0
  for (let i = 0; i < buffer.length; i++) sum += buffer[i]
  self.postMessage({ result: sum / buffer.length, gen })
}
```

Transferables are the right move for bulk numeric data processed from a typed array. For mixed-schema objects with strings and booleans, structured clone is your only option, and the cost is typically small enough not to matter.

## SSR and the Worker constructor

In SvelteKit, any code that runs at the module level during server-side rendering cannot reference `Worker`. Creating the worker inside `$effect` solves this because effects only run in the browser. Do not construct workers at component module scope:

```ts
// Wrong: runs on the server, crashes SSR.
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })

// Correct: only runs in the browser, inside $effect.
$effect(() => {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  return () => worker.terminate()
})
```

The cleanup function returned from `$effect` is the right place to call `worker.terminate()`. Without it, navigating away from the page leaves an OS thread running until the tab closes.

## When a worker is not the answer

If the dataset is large enough that even fetching it is slow, a server-side data source is a better fit. SvGrid's `createServerDataSource` sends the sort, filter, and pagination state to your API and receives only the current page. The computation happens on the server where memory is not a constraint and the result is already aggregated before it leaves the network. A worker helps when the data is already on the client and the bottleneck is CPU.

For workloads under roughly 50,000 rows with simple aggregations, the clone overhead may outweigh the benefit. A synchronous loop over 10,000 objects takes 2-5 ms on a modern machine. Wrapping it in a worker adds 30 ms of transfer overhead and the complexity of the messaging protocol. The right threshold depends on your specific computation, but if you do not see the freeze in a profiler with CPU throttling at 4x, a worker is probably unnecessary.

The pattern shown here - worker computes, SvGrid handles all interactivity - is the right split for initial data preparation and report-style aggregations where the raw dataset is fixed for the user session. For workloads that need re-computation every time the user changes a filter, consider whether you can send just the filter parameters to the worker rather than the full raw dataset on each pass.
