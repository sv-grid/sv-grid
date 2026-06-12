# Performance benchmarks

Headline numbers from the regression suite. Every figure below is from
the same hardware + browser configuration, re-measured on each release;
the script that produces them lives in
`packages/sv-grid-community/scripts/bench.ts` and is checked in.

Live load - 100k rows x 100 columns with row + column virtualization:

<div data-docs-demo="06-large-dataset" data-height="500"></div>

## Test rig

| Component | Spec                                      |
| --------- | ----------------------------------------- |
| CPU       | Apple M2 (8-core), 10W TDP                |
| RAM       | 16 GB LPDDR5                              |
| Browser   | Chrome 131 (release channel)              |
| Display   | 1 page worth of cells visible at any time |
| Throttle  | None - the regression run isn't throttled, but we also publish a separate "4x slow-down" line below for each scenario |

Numbers are the median of 5 runs after a warm-up pass. We track the
**95th percentile of frame time** during scroll rather than mean FPS -
the former catches jank that mean averages smooths over.

## Bundle size

Production build, gzipped, measured on the `dist/` output:

| Surface                             | Brotli | gzip   | Notes                                  |
| ----------------------------------- | ------ | ------ | -------------------------------------- |
| `sv-grid-community` (full)          | 41 kB  | 49 kB  | One import covers the entire renderer  |
| Headless engine (no `<SvGrid>`)     | 11 kB  | 13 kB  | If you bring your own renderer         |
| `sv-grid-pro` core                  | 7 kB   | 8 kB   | Export + print + import + AI shells    |
| `sv-grid-pro` AI module only        | 4 kB   | 5 kB   | Imported via `'sv-grid-pro/ai'`        |
| `sv-grid-pro` import module only    | 5 kB   | 6 kB   | Imported via `'sv-grid-pro/import'`    |
| Peer: `jszip`                       | 30 kB  | 35 kB  | Loaded on first `xlsx` export *or* import |
| Peer: `pdfmake` + vfs               | ~200 kB| ~280 kB| Loaded on first `pdf` export only      |

Tree-shaking is friendly: importing `{ SvGrid, tableFeatures }`
without `rowSortingFeature` doesn't pull the sort module.

## First paint

100k synthetic rows, 9 columns, default density, no virtualization
override. Measured from `mount()` to the first row painting:

| Scenario                          | Time (ms) |
| --------------------------------- | --------- |
| 10 rows × 9 cols                  | 4         |
| 1,000 rows × 9 cols               | 14        |
| 10,000 rows × 9 cols              | 38        |
| 100,000 rows × 9 cols (virtualized) | 82      |
| 100,000 rows × 100 cols (row + col virtualization) | 110 |

The slope is sub-linear because virtualization caps the rendered cell
count regardless of dataset size.

## Scroll performance

Sustained vertical scroll, 60 px/frame, measured as the 95th
percentile frame time:

| Scenario                              | p95 frame | Equivalent FPS |
| ------------------------------------- | --------- | -------------- |
| 100k rows × 9 cols                    | 8 ms      | ~120 fps        |
| 100k rows × 100 cols (col virt)       | 11 ms     | ~90 fps         |
| 100k rows × 9 cols, custom cell snippets w/ sparklines | 14 ms | ~70 fps |
| 100k rows × 9 cols, **4x CPU throttle** | 22 ms   | ~45 fps         |

Horizontal scroll on a 100-column grid stays under 12 ms p95 because
the column virtualizer is identical machinery.

## Sort, filter, group

In-memory operations on 100k rows:

| Operation                             | Time (ms) |
| ------------------------------------- | --------- |
| Sort 100k rows by one column          | 18        |
| Sort 100k rows by 3 columns (multi-sort) | 28     |
| Filter 100k rows (one operator)       | 9         |
| Filter 100k rows (5 operators ANDed)  | 17        |
| Group 100k rows by 2 columns + 3 aggregators | 36 |
| Pivot 100k facts → 4 row dims × 2 col dims × 3 measures (see demo 52) | 62 |

The sort path uses a stable comparator built per-column to keep
allocations down; the filter pipeline short-circuits on the first
failing predicate.

## Memory

Heap snapshot at idle, 100k rows × 9 columns loaded, after a full
scroll pass:

- ~22 MB heap (the Row objects + the visible-cell pool).
- Virtualization keeps the rendered DOM under ~600 `<td>` nodes
  regardless of dataset size.
- No retained references when the grid unmounts - the cleanup path is
  exercised by the unmount test in `svgrid.behavior.test.ts`.

## Server-side / chunked loading

Demo [33. Server-side infinite scroll](https://svgrid.com/#/demos/33-server-infinite) covers the chunked-load path. Numbers from that demo:

| Scenario                                         | Result                                  |
| ------------------------------------------------ | --------------------------------------- |
| Initial paint, sparse 100k-row dataset           | 110 ms to first chunk visible           |
| Scroll 50,000 rows in 1.5 s (fast wheel-flick)   | 16 chunk requests cancelled mid-flight  |
| Sort 100k server-side rows                       | round-trip dominated by the mock latency (50-140 ms) |

## AI helpers

End-to-end timings against the bundled `mockAIProvider`:

| Helper          | Median time (ms) |
| --------------- | ---------------- |
| `aiFilter`      | 350-750 (mock latency dominated) |
| `aiSmartFill` (50 rows) | 400-900 |
| `aiSummarize`   | 350-750          |
| `aiClassify` (20 rows)  | 400-750  |

Against a real model the latency is provider-side. The grid's own
prompt-build + result-parse work stays under ~6 ms even for 1000-row
classify jobs.

## Import / export

| Operation                            | Time   |
| ------------------------------------ | ------ |
| Parse CSV, 10k rows × 9 cols         | 28 ms  |
| Parse xlsx, 10k rows × 9 cols        | 140 ms (jszip unzip-dominated) |
| Export CSV, 10k rows × 9 cols        | 18 ms  |
| Export xlsx, 10k rows × 9 cols       | 220 ms |
| Export PDF, 1k rows × 9 cols (pdfmake) | 700 ms |

## Reproducing locally

```bash
git clone https://github.com/sv-grid/sv-grid
cd sv-grid
pnpm install
pnpm bench       # runs the suite, prints the same table
pnpm bench --json > my-results.json  # for trend tracking
```

The bench script also produces a comparison table against the previous
run if you pass `--baseline=path/to/prev.json`. Regressions over 10%
fail CI on the main branch.

## What we *don't* claim

- "Smoothest grid on the market" - that depends entirely on what your
  cells render. A sparkline + currency formatter in every cell costs
  more than a number, and we don't pretend otherwise.
- "Zero allocations during scroll" - the virtualizer recycles DOM
  nodes but cell snippets still allocate. The numbers above include
  real-world snippets (status pills, mini-bars).
- Single-thread performance > 1M rows. For >1M, do the heavy lifting
  on the server and feed chunks through the [server-side infinite
  scroll pattern](https://svgrid.com/#/demos/33-server-infinite).

## See also

- [Browser support](./browser-support.md) - the matrix the benchmarks
  ran against.
- [Testing and quality](./testing-and-quality.md) - the coverage
  thresholds that gate every release.

## Frequently asked questions

### How fast is SvGrid?

It virtualizes both rows and columns, so only the visible window is in the DOM -
a 100,000-row × 100-column grid scrolls smoothly. The numbers on this page come
from a checked-in regression suite re-measured on every release, not marketing
estimates.

### How many rows can SvGrid handle?

Client-side, 100k+ rows scroll smoothly thanks to virtualization. For millions
of rows, page or chunk from the server (see Server-side data). The DOM only ever
holds the visible window regardless of total row count.

### Is SvGrid faster than AG Grid or TanStack Table?

It ships a much smaller bundle (~42 KB gzipped for the full render component,
or ~7.5 KB for the headless core) and virtualizes by default. Raw scroll
performance is comparable for typical workloads; the bigger practical win is
bundle size and a Svelte-native runtime with no framework bridge.
