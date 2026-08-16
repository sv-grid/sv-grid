# Comparison: SvGrid vs AG Grid vs TanStack Table

The three projects solve overlapping problems, and the right choice
depends on the framework you ship on and your budget.

## TL;DR

| Project              | Lives in                                 | Ships                                   | Bundle (typical) | License            |
| -------------------- | ---------------------------------------- | --------------------------------------- | ---------------- | ------------------ |
| **SvGrid**           | Svelte 5                                 | Headless core + Svelte render + Enterprise pack | ~2 KB headless / ~80 KB full (gzip) | MIT (Community) / commercial (Enterprise) |
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
- You need **every grid feature shipped** out of the box: row drag,
  master-detail with built-in API, range selection, status bar,
  context menu, column tool panel, integrated charts (Enterprise),
  Excel-native pivot UI (Enterprise), server-side row model
  (Enterprise).
- You need **enterprise commercial support** with SLAs. AG sells it;
  SvGrid Enterprise support is best-effort.

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
| Server-side row model           | external mode    | external mode | -              | ✓ (built-in)       | external mode  |
| CSP-clean (no eval, no inline)  | ✓                | ✓          | ✓                 | ✓                  | n/a            |
| Meaningful SSR markup           | ✓                | ✓          | -                 | -                  | depends on FW  |
| Excel / PDF / CSV export        | -                | ✓          | -                 | ✓ (Enterprise)     | -              |
| Excel / CSV import              | -                | ✓          | -                 | -                  | -              |
| AI assistant                    | -                | ✓ (BYO provider) | -           | -                  | -              |
| Pivot table                     | -                | ✓          | -                 | ✓                  | (custom)       |
| Integrated charts               | -                | -          | -                 | ✓                  | -              |
| Theming via CSS variables       | ✓ (`--sg-*`)     | ✓          | ✓ (theme builder) | ✓                  | n/a            |
| Source-button per demo          | ✓ (gallery)      | ✓          | -                 | -                  | -              |

## Bundle size

Measured gzipped, with Svelte treated as a peer dependency and excluded
(the bundlephobia convention):

| @svgrid/grid path                          | Gzipped | Minified |
| ----------------------------------------------- | ------- | -------- |
| Headless core (`createGrid` + a row model)      | ~2 KB   | ~7 KB    |
| Full `<SvGrid>` render component                | ~80 KB  | ~293 KB  |

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

## See also

- [Why headless?](../why-headless.md) - the design decision behind
  SvGrid's two-layer architecture.
- [Migrating from AG Grid](./migrating-from-ag-grid.md) - the
  practical recipe.
- [Enterprise feature pack](../enterprise/README.md) - what SvGrid charges for.
- [Missing features](./missing-features.md) - the honest gap list
  versus AG Grid Enterprise.

## Frequently asked questions

### What is the best data grid for Svelte 5?

For a Svelte-5-native grid with a batteries-included render component, SvGrid is
built around runes and snippets. TanStack Table is a strong headless-only
choice if you want to build the DOM layer yourself across frameworks. AG Grid is
the most feature-complete but lives in React/Angular/Vue first and is heavy to
bridge into Svelte 5.

### Is SvGrid a good AG Grid alternative?

Yes, for Svelte projects. SvGrid ships a much smaller bundle (~80 KB gzipped
for the full render component, ~2 KB headless) than AG Grid Community, is
MIT-licensed for commercial use, and offers `@svgrid/enterprise` for
export/pivot/import at a per-developer price instead of AG Grid Enterprise's
per-deployment licensing. It does not yet match every AG Grid Enterprise
feature - see the missing-features list for the honest gaps.

### SvGrid vs TanStack Table - which should I pick?

Pick SvGrid if you want virtualization, Excel-style filters, selection, and
inline editing working out of the box on Svelte 5. Pick TanStack Table if you
want a framework-agnostic headless engine and are happy to build the rendering,
virtualization, and editing UI yourself. Both are MIT-licensed.

### How big is the SvGrid bundle?

Measured gzipped (Svelte excluded as a peer dependency): ~2 KB for the
headless core and ~80 KB for the full `<SvGrid>` render component (~293 KB
minified), plus ~9 KB of CSS. Charts, date/time editors, menus, and export
add another ~64 KB that loads on demand rather than up front. Enterprise
features are separate, lazy-loaded subpath imports, so you ship only what
you import.
