# Comparison: SvGrid vs AG Grid vs TanStack Table

The three projects solve overlapping problems, and the right choice
depends on the framework you ship on and your budget.

## TL;DR

| Project              | Lives in                                 | Ships                                   | Bundle (typical) | License            |
| -------------------- | ---------------------------------------- | --------------------------------------- | ---------------- | ------------------ |
| **SvGrid**           | Svelte 5                                 | Headless core + Svelte render + Enterprise pack | ~2 KB headless / ~77 KB full (gzip) | MIT (Community) / commercial (Enterprise) |
| **AG Grid Community**| React, Angular, Vue, plain JS            | Full grid + renderer                    | ~340 KB                                   | MIT                                |
| **AG Grid Enterprise**| same                                    | Adds pivot, integrated charts, server-side row model, more | ~600 KB+ | Commercial                         |
| **TanStack Table**   | React, Vue, Svelte, Solid, Qwik, Lit, JS | Headless engine **only**                | ~12-14 KB                                 | MIT                                |

## When SvGrid is the right choice

- You're on **Svelte 5** and want a grid that uses the runtime's idioms
  (snippets for cells, `$state` for data, `$derived` for aggregates) -
  not a React-port pretending to be Svelte.
- You want a **headless core you can render yourself** AND a
  default-styled component for the 80% case. Most "headless" libraries
  make you write the markup; most "monolith" libraries make you fight
  the markup. SvGrid does both in one package.
- You need **clean theming via CSS custom properties** and a documented
  `--sg-*` token surface, not a hard-coded class soup.
- You ship under **strict CSP** (no `eval`, no `new Function`, no
  inline scripts). SvGrid runs clean; AG Grid Community does too.
  TanStack Table is engine-only so the question doesn't apply.
- You want **SSR markup that is meaningful before hydration** (good
  first paint, SEO, SvelteKit `+page.server` integration). SvGrid +
  TanStack Table both qualify. AG Grid renders client-side.

## When AG Grid is the right choice

- You're on **React, Angular, or Vue**, not Svelte. SvGrid is
  Svelte-only.
- You need **server-side pivoting**, or a push-based **viewport row model**
  for a real-time trading blotter. SvGrid ships pivot, charts and a
  server-side row model (sort / filter / group / infinite), but not those
  two.
- You need **pluggable custom filter components or custom tool panels**.
  SvGrid's tool panel is a fixed Columns + Filters pair.
- You want a vendor with **a decade of enterprise procurement paperwork**
  already on file.

## When TanStack Table is the right choice

- You want a **rendering-framework-agnostic engine** so the same
  business logic powers React + Svelte + Solid surfaces in your
  monorepo.
- You're already in the TanStack ecosystem (Query, Router, Form,
  Virtual) and want one mental model.
- You're happy writing **all the markup yourself** - the row recycling,
  the keyboard map, the ARIA roles, the focus management, the
  drag-to-resize. That's the cost of "engine only".

## Feature parity at a glance

|                                 | SvGrid Community | SvGrid Enterprise | AG Grid Community | AG Grid Enterprise | TanStack Table |
| ------------------------------- | ---------------- | ---------- | ----------------- | ------------------ | -------------- |
| Headless core (engine only)     | ✓                | ✓          | -                 | -                  | ✓              |
| Default render component        | ✓ (Svelte 5)     | ✓          | ✓ (each FW)       | ✓                  | -              |
| Sort (multi-column)             | ✓                | ✓          | ✓                 | ✓                  | ✓              |
| Filter menu (operator + facet)  | ✓                | ✓          | ✓                 | ✓                  | -              |
| Filter row                      | ✓                | ✓          | ✓                 | ✓                  | -              |
| Pagination                      | ✓                | ✓          | ✓                 | ✓                  | ✓              |
| Grouping + aggregation          | ✓                | ✓          | basic             | ✓ (advanced)       | ✓ (engine)     |
| Tree / expand-collapse rows     | ✓                | ✓          | basic             | ✓                  | ✓              |
| Cell range selection + copy/paste | ✓              | ✓          | ✓ (Enterprise)    | ✓                  | -              |
| Inline editing (5 editor types) | ✓                | ✓          | ✓                 | ✓                  | -              |
| Column virtualization           | ✓                | ✓          | ✓                 | ✓                  | -              |
| Row virtualization              | ✓                | ✓          | ✓                 | ✓                  | -              |
| Column pinning (left/right)     | ✓                | ✓          | ✓                 | ✓                  | -              |
| Fit-to-width with shrink        | ✓                | ✓          | partial           | ✓                  | -              |
| WAI-ARIA grid pattern           | ✓                | ✓          | ✓                 | ✓                  | -              |
| Server-side row model           | ✓ (built-in)     | ✓ (built-in) | -              | ✓ (built-in)       | external mode  |
| CSP-clean (no eval, no inline)  | ✓                | ✓          | ✓                 | ✓                  | n/a            |
| Meaningful SSR markup           | ✓                | ✓          | -                 | -                  | depends on FW  |
| CSV / TSV / JSON export         | ✓                | ✓          | ✓                 | ✓                  | -              |
| Excel (.xlsx) / PDF export      | -                | ✓          | -                 | ✓ (Enterprise)     | -              |
| Excel / CSV import              | -                | ✓          | -                 | -                  | -              |
| AI assistant                    | -                | ✓ (BYO provider) | -           | -                  | -              |
| Pivot table                     | -                | ✓          | -                 | ✓                  | (custom)       |
| Integrated charts               | ✓                | ✓          | -                 | ✓ (paid add-on)    | -              |
| Runtime dependencies            | 0                | 0          | 2                 | 2                  | 1              |
| Support response time           | GitHub (best-effort) | 1 business day; 1h sev-1 on Enterprise | GitHub (best-effort) | no number published | GitHub (best-effort) |
| Theming via CSS variables       | ✓ (`--sg-*`)     | ✓          | ✓ (theme builder) | ✓                  | n/a            |
| Source-button per demo          | ✓ (gallery)      | ✓          | -                 | -                  | -              |

## Bundle size

Measured gzipped, with Svelte treated as a peer dependency and excluded
(the bundlephobia convention):

| @svgrid/grid path                          | Gzipped | Minified |
| ----------------------------------------------- | ------- | -------- |
| Headless core (`createGrid` + a row model)      | ~2 KB   | ~7 KB    |
| Full `<SvGrid>` render component                | ~77 KB  | ~340 KB  |

Add ~9 KB gzipped for the render component's CSS. A further ~64 KB of
charts, date/time editors, menus, and export splits into `import()` chunks
that load on demand rather than shipping in your initial bundle. Re-measure
any time with `node packages/grid/scripts/measure-size.mjs`; see the
[bundle size reference](../reference/bundle-size.md).

The full render component is the whole grid - virtualization, Excel-style
filters, inline editing, grouping, tree, master/detail, and accessibility -
in one import. For reference, the headless core is lighter than TanStack
Table's headless engine (~12-14 KB), and the render component is a fraction
of AG Grid Community (commonly cited around 340 KB minified). `@svgrid/enterprise`
features are separate subpath imports that lazy-load, so they add nothing to
your initial bundle until used.

## Measured performance

A vendor's own benchmark is worth nothing unless you can rerun it, so the
harness is in the repository and takes an adapter per grid. Adding another
grid is about forty lines in `examples/src/bench/adapters.ts` and nothing
else.

```bash
# headless, prints the table below
BENCH_REPEATS=7 BENCH_GRIDS=svgrid,aggrid pnpm bench:compare

# or drive it by hand
pnpm --filter @svgrid/grid-example-gallery dev   # then open /bench.html
```

### What was measured

| | |
| --- | --- |
| Versions | `@svgrid/grid` 2.6.21, `ag-grid-community` 35.3.1 (both MIT) |
| Dataset | 100,000 rows x 9 columns, seeded so every run gets identical data |
| Container | 1000 x 520 px, row height 32, column width 140, default theme each |
| Browser | Chromium via Playwright, one fresh page per grid |
| Machine | Developer workstation, win32 x64. Not a dedicated bench rig |
| Statistic | Fastest of 7 samples per run; the table shows the range over 6 runs |

Each operation is timed until the grid's DOM reflects it, plus one frame:

- **Mount** - fresh container, create the grid, until rows are painted.
- **Sort** - change the sort on one column, until the new order is painted.
  Text sorts `name` (~80k distinct values), numeric sorts `amount`.
- **Filter** - apply a `contains` filter to one column.
- **Scroll** - 180 frames at 60 px/frame, sampling frame intervals.

### Results

| Operation           | SvGrid | AG Grid Community | |
| ------------------- | ------ | ----------------- | --- |
| Mount               | 65 ms  (59-86) | **58 ms**  (53-59) | AG Grid ahead ~10% |
| Sort, text column   | **150 ms** (147-200) | 370 ms (350-444) | SvGrid ~2.5x |
| Sort, numeric column| **116 ms** (100-133) | 392 ms (351-479) | SvGrid ~3.4x |
| Filter, one column  | 100 ms (99-117) | 192 ms (167-217) | not comparable, see below |
| Scroll p95          | **34.6 ms** | 34.9 ms | both dropped 0 of 180 frames |
| Rows kept in the DOM | 27    | 35                | both virtualize, as expected |

Read that as: **sorting is two to three times faster, scrolling is level,
and mounting is close with AG Grid still ahead.** Anyone claiming a single
headline number for a grid comparison is selling something.

**The filter row is not a fair comparison and is shown only because hiding a
number we win looks worse than explaining it.** The two grids' single-column
filter APIs differ enough that the harness drives AG Grid's quick filter,
which searches every column - strictly more work than the single-column
`contains` SvGrid performs. Do not read 2x into it.

Sorting is where the real distance comes from, and it is not subtle: SvGrid
resolves each sort clause once and precomputes a key array, and for a
column whose distinct values are far fewer than its rows it collates the
distinct values once and sorts by rank. Mounting is the other direction -
see the honest accounting in [benchmarks](./benchmarks.md).

Two methodology notes, both of which were bugs in this harness before they
were notes, and both of which changed the numbers by more than any code
change did:

- **Each grid runs in a fresh page.** They used to run one after another in
  the same one, where the first warmed the JIT, fragmented the heap and
  left 100k rows of garbage for the next. Back-to-back runs on an idle
  machine disagreed with themselves by 2x. Run-to-run variance is now
  1-3%.
- **Operations are timed until the DOM changes, not for a fixed two
  frames.** The old fixed wait put a ~33 ms floor under every number - an
  operation that recomputed nothing at all measured 33.7 ms, and a mount
  whose rows were already in the DOM measured 33 ms of pure waiting - which
  flattered whichever grid was slower.
- **Each figure is the fastest of seven samples, not the median.** Noise
  only ever adds time, so the minimum is the cleanest estimate of what the
  machine can do, and medians on this box drifted 30% between consecutive
  runs - more than most of the differences being measured. Applied
  identically to every grid.

What this table deliberately does not include:

- **Features neither grid measures the same way.** Grouping, pivot, editing
  and export all differ enough in shape that a single timing would compare
  two different amounts of work. The filter row above is the one case we
  publish anyway, labelled, rather than quietly dropping a result that
  happens to favour us.
- **Any grid we cannot license for this.** The harness is grid-agnostic on
  purpose, but some commercial grids licence their software in ways that
  restrict using it to produce competitive claims. Where that is the case
  we do not ship an adapter, and we would rather have an obviously
  incomplete table than a legally dubious one. Run your own shortlist.
- **Your workload.** One dataset shape, one machine, one browser, default
  configuration for both. If a grid decision rides on this, clone the
  harness and put your own data in it.

## Migrating from AG Grid

The most common starting point. See
[Migrating from AG Grid](./migrating-from-ag-grid.md) for a
30-minute, side-by-side translation of column defs, features,
filtering, editing, and the imperative API.

## Migrating from TanStack Table

The map is one-to-one - SvGrid's headless core is API-compatible with
TanStack Table's React adapter in 90% of cases. The big differences:

- Replace `useReactTable(opts)` with `createSvGrid(opts)`. Identical
  state machine.
- Replace `getCoreRowModel()` calls with the same name from
  `@svgrid/grid`.
- The render layer changes - TanStack hands you `flexRender` + the
  row model; SvGrid lets you keep that headless approach OR drop in
  the default `<SvGrid>` component.

## Pricing

SvGrid Community is MIT - free for commercial use, no attribution
required at runtime. SvGrid Enterprise is a paid license; see
<https://svgrid.com/pricing/> for per-seat / per-app / multi-app tiers.

AG Grid Community is MIT. AG Grid Enterprise pricing is on
ag-grid.com; expect a per-developer annual license plus a separate
deployment license for production.

TanStack Table is MIT.

## Frequently asked questions

### What is the best data grid for Svelte 5?

For a Svelte-5-native grid with a batteries-included render component, SvGrid is
built around runes and snippets. TanStack Table is a strong headless-only
choice if you want to build the DOM layer yourself across frameworks. AG Grid is
the most feature-complete but lives in React/Angular/Vue first and is heavy to
bridge into Svelte 5.

### Is SvGrid a good AG Grid alternative?

Yes, for Svelte projects. SvGrid ships a much smaller bundle (~77 KB gzipped
for the full render component, ~2 KB headless) than AG Grid Community, is
MIT-licensed for commercial use, and offers `@svgrid/enterprise` for
export/pivot/import at a per-developer price instead of AG Grid Enterprise's
per-deployment licensing. On the measured benchmark above it sorts a 100,000-row
column two to three times faster and scrolls level; AG Grid mounts about 10%
quicker. It does not yet match every AG Grid Enterprise feature - see the
missing-features list for the honest gaps.

### SvGrid vs TanStack Table - which should I pick?

Pick SvGrid if you want virtualization, Excel-style filters, selection, and
inline editing working out of the box on Svelte 5. Pick TanStack Table if you
want a framework-agnostic headless engine and are happy to build the rendering,
virtualization, and editing UI yourself. Both are MIT-licensed.

### How big is the SvGrid bundle?

Measured gzipped (Svelte excluded as a peer dependency): ~2 KB for the
headless core and ~77 KB for the full `<SvGrid>` render component (~340 KB
minified), plus ~9 KB of CSS. Charts, date/time editors, menus, and export
add another ~64 KB that loads on demand rather than up front. Enterprise
features are separate, lazy-loaded subpath imports, so you ship only what
you import.

## See also

- [Why headless?](../why-headless.md) - the design decision behind
  SvGrid's two-layer architecture.
- [Migrating from AG Grid](./migrating-from-ag-grid.md) - the
  practical recipe.
- [Enterprise feature pack](../enterprise/README.md) - what SvGrid charges for.
- [Missing features](./missing-features.md) - the honest gap list
  versus AG Grid Enterprise.
