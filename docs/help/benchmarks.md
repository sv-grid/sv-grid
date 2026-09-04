# Performance benchmarks

Every number on this page is produced by a checked-in script:

| Table                      | Command         | Where it runs |
| -------------------------- | --------------- | ------------- |
| Bundle size                | `pnpm size`     | Node          |
| Sort / filter / group, memory | `pnpm bench` | Node          |
| First paint, scroll        | `pnpm bench:dom` | Chromium     |

An earlier version of this page published a table of timings that no
script produced, and told readers to reproduce them with a `pnpm bench`
command that did not exist. Where a figure has since been re-measured and
came out worse than the old claim, the section says so rather than
quietly restating it.

The one number worth trusting on any grid's benchmark page is the one you
measured yourself, on your data shape, on your hardware. The
[benchmark harness recipe](../recipes/benchmark-harness.md) is a
copy-paste `<SvGrid>` probe that measures time-to-first-paint across any
(rows x columns) matrix.

Live load - 100k rows x 100 columns with row + column virtualization:

<div data-docs-demo="06-large-dataset" data-height="500"></div>

## Test rig

The engine table below was measured on this configuration. Your absolute
numbers will differ; the ratios between rows are the transferable part.

| Component | Spec                                             |
| --------- | ------------------------------------------------ |
| Machine   | Developer workstation, win32 x64. Not a dedicated bench rig |
| Engine    | Node v24.18.0, median of 9 runs after a warm-up   |
| Browser   | Chromium via Playwright, best of 2 runs           |
| Dataset   | 100,000 rows x 9 columns, seeded so runs compare  |
| Target    | The built `@svgrid/grid/core`, not `src/`         |

Median rather than mean, so one GC pause cannot move a number. The
`min`/`max` columns the harness prints are worth reading: the spread on a
sort run is around 10%, which is why **elapsed time is reported but never
gated in CI**. What CI gates instead is described under
[What CI enforces](#what-ci-enforces).

## Bundle size

Production build, gzipped. The first two rows come from
`node packages/grid/scripts/measure-size.mjs` (Svelte excluded as a peer);
see the [bundle size reference](../reference/bundle-size.md).

| Surface                             | gzip   | Notes                                  |
| ----------------------------------- | ------ | -------------------------------------- |
| `@svgrid/grid` (full `<SvGrid>`)    | 77 kB  | One import covers the entire renderer; + 9 kB CSS |
| Headless engine (`createGrid`)      | 2 kB   | If you bring your own renderer         |
| Lazy chunks (charts, date editors, menus, export) | 64 kB | Loaded on demand, not in the initial bundle |
| `@svgrid/enterprise` core           | 8 kB   | Export + print + import shells         |
| `@svgrid/enterprise` import module only | 6 kB | Imported via `'@svgrid/enterprise/import'` |
| Peer: `jszip`                       | 35 kB  | Loaded on first `xlsx` export *or* import |
| Peer: `pdfmake` + vfs               | ~280 kB| Loaded on first `pdf` export only      |

The AI helpers are no longer in this table: they moved into the free
`@svgrid/grid` and tree-shake out unless you import them.

Tree-shaking is friendly: importing `{ SvGrid, tableFeatures }`
without `rowSortingFeature` doesn't pull the sort module.

## First paint

**Measured.** Run `pnpm bench:dom`. Driven against demo
`06-large-dataset` in Chromium: click a dataset size, stop the clock on
the first painted frame that shows the new rows.

| Scenario            | Total    | Building the data | Grid    |
| ------------------- | -------- | ----------------- | ------- |
| 1,000 x 29 cols     | 180 ms   | 3 ms              | 177 ms  |
| 10,000 x 53 cols    | 315 ms   | 31 ms             | 284 ms  |
| 50,000 x 77 cols    | 652 ms   | 220 ms            | 432 ms  |
| 100,000 x 100 cols  | 1,205 ms | 633 ms            | 572 ms  |

"Building the data" is the demo generating synthetic rows - at the top
size that is 9.5 million cells of test data, which a real app with data
already in hand does not pay. "Grid" is the remainder.

**"Grid" overstates the grid's own cost, and by a lot.** A CPU profile of
the 100k x 100 mount attributes 28% of the window to the demo's data
generator and another 14% to garbage collection, most of it cleaning up
after that generator. The demo's self-reported build time counts only the
generator's own execution, not the GC pressure it creates, so subtracting
it leaves a good deal of the demo's cost inside the "Grid" column. Roughly
half the total is the harness rather than the component.

Two further caveats:

- These come from a developer machine, not a dedicated bench rig, and
  run-to-run variance is roughly 2x. Treat the column ratios as the
  signal and the absolute values as a ceiling.
- **The row-pipeline optimisations above did not move these numbers**, and
  should not be read as having done so. Mounting a grid with no sort and no
  filter never enters those code paths; both row models return early.

An earlier version of this page claimed 110 ms for the 100k x 100 case,
which was never measured. Getting a trustworthy figure needs a mount
harness that feeds pre-built data, so the number is not dominated by the
cost of inventing it.

## Scroll performance

**Measured.** Run `pnpm bench:dom`. Sustained vertical scroll at 60
px/frame over 240 frames, sampling the interval between animation frames:

| Scenario               | p50     | p95     | max     | Dropped frames |
| ---------------------- | ------- | ------- | ------- | -------------- |
| 100k rows x 100 cols   | 16.7 ms | 17.7 ms | 18.8 ms | 0 of 240       |
| 1,000,000 rows x 9 cols | 16.7 ms | 18.1 ms | 19.1 ms | 0 of 240       |

This is the part of the grid that holds up well: a million rows scrolls
without dropping a frame, and the 100-column case is indistinguishable
from it because row and column virtualization are the same machinery.

Read the numbers correctly, though. The harness drives scrolling from
`requestAnimationFrame`, so an interval can never come in below the
display refresh - 16.7 ms on a 60 Hz panel is the floor, not a
measurement of how cheap a frame is. What the table shows is that the
grid **holds** the frame budget, with zero frames over 1.5x the median.
It cannot show headroom above 60 fps.

An earlier version of this page claimed a p95 of 8 ms and "~120 fps".
No harness in the repository could have produced that figure, and this
one structurally cannot.

## Sort, filter, group

**Measured.** Run `pnpm bench` to reproduce. In-memory row-pipeline
operations on 100,000 rows x 9 columns:

| Operation                                     | Median  | Was     | Change |
| --------------------------------------------- | ------- | ------- | ------ |
| Sort by one column                            | 27 ms   | 351 ms  | 13x    |
| Sort by three columns (multi-sort)            | 48 ms   | 569 ms  | 12x    |
| Sort by a date column                         | 40 ms   | 773 ms  | 19x    |
| Sort by a text column (collated)              | 59 ms   | -       | new    |
| Filter, one operator                          | 5 ms    | 19 ms   | 4x     |
| Filter, five operators ANDed                  | 7 ms    | 24 ms   | 3.5x   |
| Filter via the compiled Excel filter          | 3 ms    | -       | new    |
| ... the same, on fully accented text          | 22 ms   | -       | new    |
| Group by two columns + three aggregators      | 50 ms   | 229 ms  | 4.6x   |
| Toggle one row's checkbox (filtered + sorted) | 0 ms    | 103 ms  | gone   |
| Export CSV, 10k rows x 9 cols                 | 10 ms   | 8 ms    | -      |

The last two rows are the path `<SvGrid>` actually takes. The plain "filter,
one operator" rows drive the headless row model, whose default match is a
substring compare - but the menu and filter-row surfaces compile through
`compileExcelFilter`, which folds every value (decompose, strip diacritics,
lowercase) so that "cafe" matches "CAFÉ". This suite had no case touching
that fold until a browser profile showed it was the most expensive single
function in a filter. It now takes a fast path for pure-ASCII values, where
decomposition and diacritic-stripping are provably no-ops: 3 ms rather than
21 ms for the same 100,000 rows. Accented data still pays the full fold,
which is the 21 ms row, and gets the same answer it always did.

Each case runs in a **fresh process**. They used to share one, which made
every figure depend on the order cases ran in: a case running eighth
carried seven predecessors' heap, and grouping measured 169 ms in a full
run against 51 ms on its own. An earlier version of this table published
the contaminated 106 ms for grouping. Forcing a garbage collection between
cases did not fix it - the cost is a warmed, fragmented heap rather than
uncollected garbage - so the harness now pays a few seconds of process
startup per case and reports numbers that mean the same thing whether you
run one case or all of them.

Text sorting has no "was", because this suite did not measure it until a
browser comparison showed it was the slowest operation for every grid
tested. Collation is what makes it expensive, and two things help:

- **Columns whose distinct values are far fewer than their rows** - a
  status, a region, an owner - collate the distinct values once and sort
  rows by rank. That is what took the three-column case to 48 ms. A stride
  sample decides whether to try, because collecting distinct values costs
  about 9 ms on a column where nearly all of them are unique and saves
  about 19 ms where they repeat, so guessing wrong either way is
  measurable.
- **`localeCompare` rather than a hoisted `Intl.Collator`.** The
  specification defines the former as constructing a collator per call, so
  caching one looks like the obvious win - and it is measurably slower,
  because V8 fast-paths `localeCompare` and going through a collator object
  misses that path. 33 ms against 83 ms sorting 100k ASCII strings, with
  byte-identical ordering. This page briefly published the slower version;
  re-measure before "optimising" it again.

A third thing helps every sort: **the single-clause case gets its own
comparator.** Most sorts are one column, and the comparator runs O(n log n)
times - 1.66 million calls for 100,000 rows - so the general loop's clause
lookup, property loads and indirect call are paid 1.66 million times for
values that never change. Hoisting them into a closure, and inlining the
subtraction for numeric columns, is worth about 15% on a single-column sort.

Grouping got faster for a different reason: a group row shows the value
its children agree on, and finding that used to mean scanning every child
even for a column an outer level had already grouped by, where the answer
is fixed by construction.

Medians hold steady across runs; the min/max the harness also prints do
not, because this is a working developer machine rather than a quiet bench
rig. A single sample can land 3x the median when something else on the box
wakes up. That noise is the whole reason CI gates counters instead.

The "Was" column is the first measurement this harness took, before any of
it was optimised. Building the harness is what exposed the defects; each
one is now closed and has a counter that fails the build if it returns:

- **Sorting resolved the clause's column inside the comparator.** A
  single-clause sort of 100k rows called `getAllColumns()` 1,528,947
  times, scanning the column array on each. It now resolves once, and the
  comparator reads a precomputed key array instead of walking the row.
- **The date comparator allocated two `Date` objects per comparison.**
  Timestamps are now computed once per row, which is most of why sorting a
  date column went from the slowest case to a fast one.
- **Filtering materialised every row's full `Cell[]`** to read one field,
  defeating the lazy per-row cell cache: 100,000 cell arrays built and
  thrown away for a one-operator filter. Now zero.
- **Toggling a checkbox re-ran the whole pipeline.** `rowSelection` sat in
  the row-model cache key, so selecting a row re-filtered and re-sorted the
  entire dataset even though nothing in the pipeline reads it. Selection is
  now free.
- **Group aggregation allocated three arrays per aggregated column per
  group**, then finished with `Math.min(...values)`. It is a single pass
  now. The spread also crashed outright on a large enough group, which is
  fixed as a side effect.
- **Text sorting collated on every comparison.** Distinct values are now
  ranked once where a column has few enough of them.

Numbers here will move; the command that produces them will not.

## What CI enforces

Elapsed time is too noisy on a shared runner to fail a build on, and a
flaky performance gate gets switched off within a month. So `pnpm
bench:check` gates **work counters** instead - counts of algorithmic work,
identical on every machine:

| Counter                                       | Budget | Actual |
| --------------------------------------------- | ------ | ------ |
| `getAllColumns` calls inside a 1-clause sort   | 8      | 1      |
| `getAllColumns` calls inside a 3-clause sort   | 24     | 1      |
| `getAllCells` materialisations while filtering | 0      | 0      |
| Filter re-runs caused by a selection change    | 0      | 0      |
| Sort re-runs caused by a selection change      | 0      | 0      |

A count is a claim about the algorithm; a millisecond is a claim about the
hardware. Only the first belongs in CI. Budgets live beside each case in
`tools/bench/cases.mjs`.

Each case also declares which counters must be *present*, not just within
budget. Without that, a stage that stopped running altogether would satisfy
every budget by doing no work, which is the failure mode a gate like this
is most likely to develop.

## Memory

**Measured** (`pnpm bench`, Node heap): building the row model for
100,000 rows x 9 columns retains **16.0 MB**, or roughly 160 bytes per
row, with no renderer attached.

It was 64.9 MB until recently. Each row was an object literal whose seven
methods were closures, so a 100k-row grid allocated 700k closures and a
closure scope per row before painting anything. The methods are now
defined once and shared, reading their row through `this`: 4x less memory
and about 7x faster to build. They are still assigned as own properties
rather than put on a prototype, because `Row` is public and several row
models legitimately do `{ ...row, depth }` - a spread copies own
properties but not a prototype, so a class would silently strip the
methods off a cloned row.

An earlier version of this page said "~22 MB". That figure was not
measured. Node's heap accounting is not the same as a browser's, so read
this as the engine's own cost rather than what a tab will show.

Two claims here are structural rather than measured, and both hold:

- Virtualization keeps the rendered DOM to the visible window regardless
  of dataset size, so `<td>` count does not scale with row count.
- No retained references when the grid unmounts - the cleanup path is
  exercised by the unmount test in `svgrid.behavior.test.ts`.

## Server-side / chunked loading

Demo [33. Server-side infinite scroll](https://svgrid.com/demos/33-server-infinite/) covers the chunked-load path. Numbers from that demo:

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
pnpm --filter @svgrid/grid build   # the bench runs the BUILT engine
pnpm bench                          # engine + memory tables
pnpm size                           # bundle table
pnpm bench:dom                      # first paint + scroll, in Chromium
```

The bench takes a few options:

```bash
pnpm bench --json                        # machine-readable, for trend tracking
pnpm bench --baseline=tools/bench/baseline.json   # adds a delta column
pnpm bench --case=sort-1col              # one case
pnpm bench:check                         # the work-counter gate CI runs
```

`pnpm bench` runs against the built `@svgrid/grid/core` rather than
`src/`, so it also smoke-tests the entry a consumer actually imports.

`pnpm bench:dom` drives Chromium through Playwright against the examples
gallery, which lives in this repository, so it needs no private
submodule. It is a Playwright project rather than part of `pnpm test:e2e`,
and it is deliberately not in CI - see below.

For your own workload, the [benchmark harness
recipe](../recipes/benchmark-harness.md) and the [FPS HUD
recipe](../recipes/profiling-with-fps-hud.md) are copy-paste probes you
can drop into your app.

## What we *don't* claim

- That we are faster than any other grid. Nothing on *this* page is a
  head-to-head measurement. Everything here is sv-grid measured against
  sv-grid, which supports "this got 10x faster" and not "this is faster
  than X". For a real comparison there is a separate grid-agnostic
  harness - `pnpm bench:compare`, results and caveats in
  [Comparison](./comparison.md) - and it does not say we win everything.
- That first paint is good. The grid half of the 100k x 100 case is still
  the worst number on this page, and this round did not touch it.
- Any scroll figure above 60 fps. The harness is rAF-driven and cannot
  observe headroom past the display refresh. "Zero dropped frames" is the
  claim; "120 fps" is not.
- Lab-grade first-paint numbers. Those come from a developer machine with
  roughly 2x run-to-run variance, not a dedicated rig.
- "Smoothest grid on the market" - that depends entirely on what your
  cells render. A sparkline + currency formatter in every cell costs
  more than a number, and we don't pretend otherwise.
- "Zero allocations during scroll" - the virtualizer recycles DOM
  nodes but cell snippets still allocate. The numbers above include
  real-world snippets (status pills, mini-bars).
- Single-thread performance > 1M rows. For >1M, do the heavy lifting
  on the server and feed chunks through the [server-side infinite
  scroll pattern](https://svgrid.com/demos/33-server-infinite/).

## Frequently asked questions

### How fast is SvGrid?

It virtualizes both rows and columns, so only the visible window is in the DOM,
and a million rows scrolls without dropping a frame. On the data side, a
single-column sort of 100,000 rows takes about 27 ms and a one-operator filter
about 5 ms. Every table on this page comes from a checked-in script you can run
yourself, and the numbers moved because the harness exposed real defects rather
than because the prose was rewritten.

### How many rows can SvGrid handle?

Client-side, 100k+ rows scroll smoothly thanks to virtualization. For millions
of rows, page or chunk from the server (see Server-side data). The DOM only ever
holds the visible window regardless of total row count.

### How fast is SvGrid, and how big is it?

It ships a much smaller bundle (~77 KB gzipped for the full render component,
or ~2 KB for the headless core) and virtualizes by default. Raw scroll
performance is comparable for typical workloads; the bigger practical win is
bundle size and a Svelte-native runtime with no framework bridge.

## See also

- [Browser support](./browser-support.md) - the matrix the benchmarks
  ran against.
- [Testing and quality](./testing-and-quality.md) - the coverage
  thresholds that gate every release.
