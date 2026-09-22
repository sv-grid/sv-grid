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

Production build, gzipped, Svelte excluded as a peer. The table is
generated from `docs/_data/svgrid-size.json` by `node tools/sync-guide-facts.mjs`
(the file `pnpm size:json` writes), and the method and the lazy-chunk
breakdown are on the [bundle size reference](./bundle-size.md). An earlier
version of this page typed these and sat a month behind the measurement.

<!-- size:start -->
Re-measured **22 Sep 2026** at `@svgrid/grid` 3.0.4 with the script that ships in the repo (`pnpm size:json`):

| Target | Base JS (gzip) | CSS (gzip) | Loaded on demand |
| --- | ---: | ---: | ---: |
| Headless core (`createSvGrid`) | **2.7 KB** | - | - |
| Headless subpath (`@svgrid/grid/core`) | **8.0 KB** | - | - |
| Full render component (`<SvGrid>`) | **97.6 KB** | **10.5 KB** | **183.6 KB** |
| Standalone chart (`<SvChart>`) | **71.7 KB** | - | **15.0 KB** |
<!-- size:end -->

The "loaded on demand" column is the code reachable only through
`import()`: charts, the date-time editor, the menus, export. Outside the
grid package, and not in the ledger: the `@svgrid/enterprise` core is a few
kilobytes of export, print and import shells; `jszip` loads on the first
xlsx export or import and `pdfmake` with its fonts on the first PDF export,
both as optional peers, neither in your synchronous bundle.

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

<!-- tutorial:million-rows-scroll -->
<figure class="docs-tutorial" id="tutorial-million-rows-scroll" data-docs-tutorial="million-rows-scroll">
<video class="docs-tutorial-video" src="/tutorials/million-rows-scroll.mp4" poster="/tutorials/million-rows-scroll.poster.webp" width="960" height="540" muted loop playsinline preload="none" aria-label="One million rows in SvGrid, 32 second tutorial"><track kind="captions" srclang="en" label="English" src="/tutorials/million-rows-scroll.vtt" default>Your browser does not play embedded video. <a href="/tutorials/million-rows-scroll.mp4">Download the MP4</a>.</video>
<figcaption><strong>One million rows in SvGrid</strong> (32 s, silent).</figcaption>
<details class="docs-tutorial-transcript"><summary>Transcript</summary>
<p>This SvGrid holds one million rows, generated in the browser, with sorting, filtering and inline editing switched on.</p>
<p>Rows are virtualized, so only the ones in view are drawn. Scroll, and the frame rate stays flat.</p>
<p>Jump anywhere in the set. The row numbers show the scale, and the grid keeps every row reachable.</p>
<p>Row and column virtualization are the same machinery, so wide grids get the same treatment. Nothing to configure.</p>
</details>
</figure>
<!-- /tutorial:million-rows-scroll -->

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

## Streaming updates

**Measured.** Run `pnpm bench --case=tick-1k-of-100k-sorted` to reproduce.
A tick is a new data array in which K row objects were replaced with new
prices, handed to a grid sorted by that column, so the order has to stay
current. 100,000 rows x 9 columns, same rig as above:

| Operation                                            | Median | The same tick through a full sort |
| ---------------------------------------------------- | ------ | --------------------------------- |
| Tick: 100 rows replaced, sorted by the ticking column | 6 ms   | 31 ms                             |
| Tick: 1,000 rows replaced, sorted by the ticking column | 9 ms | 31 ms                             |

The right-hand column is the "Sort by one column" row above: before this
round, any new data array re-sorted every row, so a 100-row tick cost
exactly what a header click did. The sorted stage now keeps its previous
output with each row's sort key, drops the rows that were replaced, sorts
the K replacements among themselves and merges them back in one linear
pass: O(n + K log K) instead of O(n log n) key builds and comparisons. The
filtered stage does the same for a replacement whose membership did not
change. The result is byte-identical to a full sort, which a test pins by
comparing the two on every kind of key the sort specialises
(`core.tick-repair.test.ts`).

Three conditions, all checked, none assumed: the array has the same length
(an add or a remove is structural and takes the full path), at least one
object was replaced and no more than a quarter of them (a new array with
every object the same is the documented "I mutated rows in place, re-read
them" refresh and runs the full pipeline), and the sorting state, filters
and columns are the same objects as last time. The rows that were kept are
assumed unchanged in value as well as identity, which is what an immutable
update guarantees and an in-place mutation does not: a feed that mutates
rows in place must pass a new array with no replacements to refresh.

The counter CI gates for this is cell reads on the kept rows during a tick,
budgeted at zero: a repaired sort never re-reads a row it kept, a full sort
reads all of them.

What the component adds on top of the engine per tick is a rebuild of the
base rows (2 ms at 100k, reusing every row object that did not change) and
the render of the visible window. Three things on that path used to be
O(rows) per data change and are not now: the header checkbox state walked
every row to conclude "none selected" (30 ms at 100k), the expanded-rows
stage copied all rows into a new array with nothing expanded, and the
dev-time config check filtered every row to pick ten samples. The browser
harness in the [comparison](./comparison.md) measures the whole thing,
render included, against the other grids on the same tick; that column
lands with its next recorded run.

## Spreadsheet engine

**Measured.** Run `pnpm bench` with `@svgrid/enterprise` built
(`pnpm --filter @svgrid/enterprise build:lib`) to reproduce; the cases live
in `tools/bench/sheet-cases.mjs`. These were taken on a CI-class Linux
container with Node v22, not the workstation the table above used, so
compare the rows with each other rather than with the grid's.

Two different questions, because a spreadsheet is asked both: what does
opening a workbook full of formulas cost once, and what does one keystroke
cost all day.

| Case                                                     | Median  | Cells evaluated | Retained |
| -------------------------------------------------------- | ------- | --------------- | -------- |
| Open 1,000 rows, one `SUM` per row                        | 8 ms    | 1,000           | 1.6 MB   |
| Open 10,000 rows, one `SUM` per row                       | 91 ms   | 10,000          | 16.5 MB  |
| Open 50,000 rows, one `SUM` per row                       | 547 ms  | 50,000          | 84.2 MB  |
| Type in one cell of a 10,000-row sheet                    | 0 ms    | 1               | -        |
| Type in a column a single `SUM` of 10,000 cells reads     | 14 ms   | 1               | -        |
| Type at the top of a 10,000-row dependency chain          | 71 ms   | 10,000          | -        |

Read the third column first: it is the one CI gates, and the one that says
what the engine is doing. A keystroke costs **one evaluation**, not a
sheet's worth, because the dependency graph recomputes what read the cell
and nothing else. The column-`SUM` row is the interesting pair: one
evaluation, 14 ms, because that single `SUM` re-reads its 10,000 cells. The
chain row is the worst case a sheet can have, a running balance where every
row reads the row above it: 10,000 evaluations for one keystroke, which is
the true cost of that shape and not a bug.

So the practical ceiling, on this container: **a sheet of tens of thousands
of formula rows opens in well under a second and edits instantly**, and the
thing that changes that is not the sheet's size but how much of it one cell
feeds. 50,000 formula rows retain about 84 MB, roughly 1.7 KB per row for
the text, the cached value and the graph edges.

A chain longer than about a thousand rows used to overflow the JavaScript
stack on the first keystroke and land `#NUM!` in the cell. The workbook now
primes a deep chain from its far end instead of recursing through it, so
the only limit left is the sheet's own size.

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
| Cells evaluated opening a 10,000-row sheet     | 10,004 | 10,000 |
| Cells evaluated by one keystroke in that sheet | 4      | 1      |
| Cells evaluated when a 10,000-cell `SUM` reads the edit | 3 | 1  |

A count is a claim about the algorithm; a millisecond is a claim about the
hardware. Only the first belongs in CI. Budgets live beside each case in
`tools/bench/cases.mjs`, and the spreadsheet's in
`tools/bench/sheet-cases.mjs`.

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

### The Server-Side Row Model over one million rows

Demo [467](https://svgrid.com/demos/467-server-row-model-1m/) runs the
Enterprise row model over a columnar in-memory warehouse of a million rows,
grouped Region > Country. `tests/perf/server-row-model.spec.ts` drives it in
headless Chromium (a developer workstation, 17 September 2026; a release
ritual, not a gate):

| Scenario                                                      | Result                                        |
| ------------------------------------------------------------- | --------------------------------------------- |
| First paint, navigation to the first group row (includes building the warehouse in the page) | 2.4 s |
| Scroll 60,000 px through an open country of 62,000 leaves     | 17 leaf requests, 0.28 per 1,000 px (one block of 100 rows is 3,400 px) |
| Worst frame while blocks streamed in                          | 83 ms (layout of the changed rows; the grid keeps the row objects a block did not touch) |
| Heap before / after streaming 700,000 px with `maxBlocksInCache: 24` | 225 MB / 225 MB - evicted blocks are collected |
| Warehouse: a million rows as typed arrays                     | 22 MB; a cold sort on a new column 0.8 to 1.1 s, cached after; a grouped level 140 ms; a pivot with a grand total 330 ms |

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

It ships a small bundle (the measured figures for the full render component
and for the headless core alone are in the table above) and virtualizes by
default. Raw scroll
performance is comparable for typical workloads; the bigger practical win is
bundle size and a Svelte-native runtime with no framework bridge.

## See also

- [Browser support](./browser-support.md) - the matrix the benchmarks
  ran against.
- [Testing and quality](./testing-and-quality.md) - the coverage
  thresholds that gate every release.
