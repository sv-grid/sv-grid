# SvGrid - Examples Gallery

370+ runnable demos covering the full SvGrid feature surface. The first ten
below are the guided tour; the rest are grouped by feature in the running app
and on [svgrid.com/demos](https://svgrid.com/demos/).

```bash
# from the repo root
pnpm install
pnpm dev
# open http://localhost:5174
```

## Start here

| # | Title | Source | What it shows |
| - | ----- | ------ | ------------- |
| 1 | Quick start                      | [01-quick-start.svelte](src/demos/01-quick-start.svelte) | The smallest possible grid - 10 rows, 5 columns, zero config. |
| 2 | Sort · Filter · Paginate         | [02-sort-filter-paginate.svelte](src/demos/02-sort-filter-paginate.svelte) | Multi-column sort, filter row, page-size selector against ~5k rows. |
| 3 | Excel-style filters              | [03-excel-filters.svelte](src/demos/03-excel-filters.svelte) | Header filter menu + active-chip strip + imperative quick-presets. |
| 4 | Selection + copy/paste           | [04-selection-copy-paste.svelte](src/demos/04-selection-copy-paste.svelte) | Row + cell-range selection, summary footer over selected rows. |
| 5 | Inline editing                   | [05-inline-editing.svelte](src/demos/05-inline-editing.svelte) | Typed editors (text / number / checkbox / date) + dirty tracking + save. |
| 6 | 100k rows · 100 columns          | [06-large-dataset.svelte](src/demos/06-large-dataset.svelte) | Row + column virtualization, chunked load with progress indicator. |
| 7 | Grouping + aggregation           | [07-grouping-aggregation.svelte](src/demos/07-grouping-aggregation.svelte) | Group by department / country / both, row-summaries footer. |
| 8 | Tree + master/detail             | [08-tree-and-master-detail.svelte](src/demos/08-tree-and-master-detail.svelte) | Indented file-system tree + a master/detail orders to lines view. |
| 9 | Server-side data                 | [09-server-side.svelte](src/demos/09-server-side.svelte) | Debounced query, abort-cancellation, page navigation against a mock endpoint. |
| 10 | Custom cells + themes           | [10-custom-cells-and-themes.svelte](src/demos/10-custom-cells-and-themes.svelte) | `renderSnippet` cells (avatar, pill, progress, sparkline), density + theme toggles. |

## Adding a demo

Two edits, always:

1. `src/demos/<id>-<slug>.svelte` in this folder.
2. A matching `demo('<id>-<slug>', ...)` entry in `website/src/lib/demos.ts`.

`pnpm demos:count` fails if the two disagree. Community demos take a lighter
path - see [src/demos/community/README.md](src/demos/community/README.md).

## Shared

- [`src/shared/seed.ts`](src/shared/seed.ts) - deterministic `makePeople()` and `makeWidePeople()` fixtures (Mulberry32 PRNG).
- [`src/shared/registry.ts`](src/shared/registry.ts) - demo list driving the sidebar.
- [`src/index.css`](src/index.css) - shared theme tokens (`--sg-*`) plus pill / sparkbar / focus-ring helpers.
- [`src/mobile.css`](src/mobile.css) - the phone/tablet layer, shared with the website. See below.

## Mobile

Demos are written desktop-first. `src/mobile.css` adapts them at 767px and
639px and is imported by **both** this gallery and the website, so one edit
covers both surfaces.

Its hard rule: **every declaration lives inside a `max-width` media query**, so
desktop rendering is untouched. `node tools/check-mobile-css.mjs` enforces that
and runs as part of `pnpm lint`.

Most demos need nothing - the shared layer handles collapsing KPI strips,
wrapping toolbars, stacking fixed-px panel splits, and letting flex rows shrink.

Height matters as much as width. The pane that holds the grid
(`<div class="flex-1 min-h-0">` under the root section) is floored at 360px on
phones: everything above it is `shrink-0`, so without the floor a tall KPI
strip or a wrapped chip toolbar squeezes the grid to 0px inside the
fixed-height shell - and since nothing overflows, the page cannot even scroll
to it (the trading desk did exactly this on a Galaxy S24 Ultra). With the
floor the surplus overflows into the shell's `<main>`, which scrolls. A demo
with heavy chrome should still trim it on phones in its own `<style>` (see the
`@media (max-width: 639px)` block in `00-trading-desk.svelte`) so the grid gets
the screen rather than the floor.
A demo that genuinely cannot fit a phone (a gantt canvas, a scheduler console)
keeps its desktop layout and **pans inside the demo stage** instead of being cut
off. Opt in from the demo's own `<style>`, and tag the element so the audit
knows the overflow is deliberate:

```svelte
<section class="gc-shell ..." data-mobile-pan>
...
@media (max-width: 767px) {
  .gc-shell { min-width: 900px; }
}
```

Check your work:

```bash
pnpm dev                    # gallery on :5174
pnpm audit:mobile           # sweeps every demo at 390x844
pnpm audit:mobile http://localhost:5174 45-gantt-chart   # or just one
pnpm test:e2e:mobile        # the phone-viewport regression gate
```

`audit:mobile` fails if the page can scroll sideways, and separately lists
content that an ancestor clips - correct for a carousel track, silent data loss
for anything the reader needs. It also reports a starved grid pane, content cut
off at the bottom by a non-scrolling ancestor (`vcut`), and content wider than
its own box (`spill`). Add `--shots=DIR` to save a phone screenshot per demo,
and `--vp=384x745` to use a Galaxy S24 Ultra with the URL bar showing instead
of the default iPhone 13 metrics.

Sweep landscape too (`--vp=844x390`): a phone on its side matches no width
query, only `(max-height: 500px) and (pointer: coarse)`, and a 390px-tall
screen is where fixed-height shells clip the most. A demo-side rule that only
fixes heights (not a stacking rule) should carry both guards:
`@media (max-width: 639px), (max-height: 500px) and (pointer: coarse)`.

And tablet portrait (`--vp=768x1024`). It is the same trap in a third shape:
above every width query here, so none of this layer applies, while the stage
is only ~720px. Both shells now drawer the sidebar there (it otherwise left a
432px stage - narrower than on a phone), and the layer's last block restores
just the contained pan, so the chart demos' 560px side panel stays reachable.
All three extra shapes are gated on `pointer: coarse`, which is what makes
them provably invisible to a desktop window of the same size.

The audit's `starved` gate scales with viewport height, so at 1024px tall it
wants a 364px pane; a demo reported at ~350px there is fine, not a regression.

Two layout traps the sweep keeps finding, both fixed with a phone-only rule in
the demo's `<style>`:

- A card that hides overflow (rounded corners) and sits in a flex column has an
  automatic minimum height of 0, so it shrinks to whatever the stage has left
  and clips its own footer. Give it `flex-shrink: 0` (or `flex: 1 0 auto` if it
  is the `flex-1` pane) on phones and let the page scroll.
- A CSS-grid layout with a definite height hands its rows only the leftover
  space, so once the grid row is floored the side panel's row gets cut. Use
  `grid-auto-rows: max-content` on phones and cap the panel's list with a
  `max-height` so it scrolls inside its card.

Two more worth knowing, because the fix differs by orientation:

- In **landscape** a stacking fix is the wrong tool - the layout is still a row
  at 844px, so `flex: 1 0 auto` there sizes *widths*. Let the over-tall child
  scroll instead (`overflow-y: auto`), which is what 122/124 do.
- Width caps still matter in landscape even though it is 844px wide: an editor
  sits in a panel or a form cell, not the viewport. That is why the fixed-width
  control caps are repeated in the landscape block.

## Layout

```
examples/
├─ src/
│  ├─ App.svelte         # sidebar + hash router
│  ├─ main.ts            # entry
│  ├─ index.css          # shared tokens & helper classes
│  ├─ mobile.css         # phone/tablet layer (also imported by the website)
│  ├─ demos/             # one .svelte file per example
│  │  ├─ community/      # community-contributed demos
│  │  └─ prompts/        # generated AI prompt sidecars
│  └─ shared/            # seed data, registry
├─ index.html
├─ package.json
├─ svelte.config.js
├─ tailwind.config.cjs
├─ postcss.config.cjs
└─ vite.config.js
```

Each demo is intentionally self-contained - there are no helpers imported across
demos. Read the source alongside the running app; it is the canonical form of
the answer to "how do I do X with SvGrid?".
