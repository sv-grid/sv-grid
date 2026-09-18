/**
 * Size budget for the custom elements, measured on the BUILT bundles.
 *
 * Separate from `packages/grid/scripts/measure-size.mjs` because that script
 * bundles from source with its own vite config, and a custom element only
 * exists when compiled with `customElement: true`. Measuring the real dist is
 * both simpler and closer to what a consumer downloads.
 *
 * Until this file existed grid-wc had no budget at all - which is part of why
 * nobody noticed the elements exposed 7 of 100 props, and why nobody would have
 * noticed them getting heavy either.
 *
 * KiB (1024), not vite's kB (1000). The two differ by ~2.4% at this size, which
 * is enough to look like a regression that is not there - it did once.
 */
import { gzipSync } from 'node:zlib'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, '..', 'dist')

/**
 * Entry-file gzip, in KiB. The entry is what a `<script type="module" src>`
 * pulls first; its lazy chunks load on demand and are deliberately not counted.
 *
 * 102.5 -> 106.0 when the surface became generated. The elements went from 7
 * props and 2 events to 98 and 19, so grouping, pagination, pinning, tree data,
 * master/detail, board, scheduler and the enterprise features became reachable
 * from a non-Svelte host at all. Measured 102.5 -> 104.1 KiB, so 1.6 KiB for
 * roughly fourteen times the API. The budget kept ~2 KiB of headroom, which was
 * about one more feature's worth of props.
 *
 * 106.0 -> 107.1 and 106.5 -> 107.3, and the headroom is now 0.3 KiB rather
 * than 2. None of the growth is in the element layer: it is the grid's own base
 * bundle, +0.8 KiB for the `icons` prop and the chart panel's type picker
 * (measured 84.4 KB against 83.6 before, see the note in
 * packages/grid/scripts/measure-size.mjs). An element inlines the grid, so any
 * grid base change lands here at roughly 1:1.
 *
 * The cushion is gone on purpose. It was sized for a layer that only moved when
 * someone touched the element surface, and it silently absorbed grid-side growth
 * instead. Tracking the measurement closely means a grid base increase now has to
 * be acknowledged in both budgets, which is two edits and the intended cost: this
 * file is the only thing that measures what a non-Svelte consumer actually
 * downloads, and 2 KiB is a lot of room to grow into unnoticed.
 *
 * 107.1 -> 107.5 and 107.3 -> 107.8. Measured 107.2 / 107.5, so +0.4 for a wave
 * of charting work, and this is the two-edit cost that note above predicted -
 * the growth is the grid's base, reaching the element at 1:1.
 *
 * What landed in base: locale-aware value formatting wired through the
 * controller and the chart-view config (a chart of localized data now reads in
 * that locale without being told twice), and the base half of box plots and
 * error bars. What did NOT land here is the interesting part - the chart engine
 * is a separate chunk (`SvGridChart-*.js`), so box plots, candlesticks, the
 * custom-series seam, interactive annotations and the large-series work cost a
 * `<sv-grid>` consumer nothing unless they chart. That chunk grew 27.6 -> 31.9
 * KB over the same period, all of it deferred.
 *
 * 107.5 -> 98.8 and 107.8 -> 99.4 with the chart depth program (four waves:
 * axis model, thirteen series types, interaction + motion, financial +
 * builder). Measured 98.5 / 99.1: DOWN, on a program that added code, because
 * the wave that grew the chart also fixed how the element carries CSS.
 *
 * Lib-mode vite emits ONE stylesheet for the whole bundle, lazy chunks
 * included, and inlineCss put it in the entry. So every lazy component's
 * styles (the chart's, the date pickers', the menus', the builder's) were in
 * the first download of a page that never used them: 15.8 KiB gzip of the
 * old 114.3 measured after the program's code landed. The build now sets
 * `cssCodeSplit: true` and inlineCss gives each chunk its own styles, injected
 * into document.head when that chunk loads and handed to adopt-styles for the
 * shadow roots. The entry keeps the grid's own sheet only.
 *
 * What the program added to the entry underneath that: the grid's base went
 * 84.7 -> 86.1 KB (see measure-size.mjs), the charting config pass-through and
 * the per-tab state the builder and the price chart need, all wiring, with
 * the logic in the lazy engine.
 *
 * <sv-chart> is the standalone chart element, in its own build (dist/chart).
 * Measured 56.8 KiB: the chart component + engine + the Svelte runtime, with
 * the context menu, PDF writer and export as lazy chunks. It carries none of
 * the grid.
 *
 * 57.1 -> 60.1 for <sv-chart> with the gap-closing pass after the program
 * (2026-09-13). Measured 59.8: stack groups, series end labels, responsive
 * rules, pie callouts, the crosshair axis pills and the series `visible`
 * seed, the same 2.7 KB the grid's chart surface grew by (measure-size.mjs
 * has the breakdown) plus the surface entry for the new crosshairLabels
 * attribute. Every one is a spec field a chart may carry, so none is lazy.
 * The two grid elements did not move.
 *
 * 60.1 -> 62.7 for <sv-chart> with the accessibility pass (2026-09-13).
 * Measured 62.4: the chart's strings as a localizable message map, a roving
 * focus with arrow navigation and a name on every mark of the ten
 * non-cartesian families, keyboard zoom on the plot and the brush as a
 * slider (measure-size.mjs has the breakdown), plus the surface entry for
 * the new localeText property. The grid elements moved 0.1 KiB for the
 * localeText pass-through in ChartingConfig.
 *
 * 62.7 -> 66.3 for <sv-chart> with the series and interaction depth wave of
 * program 2 (2026-09-13). Measured 66.0: the regression fits, the log x
 * axis, area stack piles, hover highlight, corner and pinned tooltips, label
 * leaders and style vars (measure-size.mjs has the breakdown) plus four
 * surface entries (hover-highlight, tooltip-position, tooltip-sticky and
 * the hover event). The grid elements did not move.
 *
 * 98.8 -> 99.5 and 99.4 -> 100.1 for the grid elements with the panel and
 * builder wave of program 2 (2026-09-13). Measured 99.2 / 99.8, so 0.6 KiB:
 * the saved-charts state and its five API methods on the base controller
 * (the tab serialisation they share with the view state became one
 * table-driven pair, which paid for most of them: the grid's base moved
 * 86.2 -> 86.3 KB), the localizationText getter the lazy panel reads its
 * strings through, and the panel's stylesheet, which lives in the grid's
 * own sheet and gained the builder-form layout of the shared pickers and
 * the saved-charts popover. The pickers, the messages and the builder's
 * new Format fields are all in the lazy panel chunk. <sv-chart> did not
 * move.
 *
 * 66.3 -> 67.0 for <sv-chart> with the gallery pass (2026-09-13). Measured
 * 66.7: the scatter regression curve, callout sizing by label width, the
 * muted brush spec, heat map label thinning, the calendar's month range,
 * the waterfall opening total, pin labels and fit-based x label rotation,
 * the same 0.7 KB the grid's chart surface grew by (measure-size.mjs has
 * the breakdown). No surface entry changed. The grid elements did not move.
 *
 * 67.0 -> 68.6 for <sv-chart> with the QA pass after the gallery
 * (2026-09-13). Measured 68.3: calendar-aligned time ticks with UTC labels,
 * date categories written out in the tooltip and pill, right-axis series
 * read in that axis's format, scatter points that select, the breadcrumb
 * outside the toolbar, the legend double-click fix, indexed selection refs,
 * share labels on 100% charts, waterfall totals in the tooltip and table,
 * the radar rim, per-side pie gutters, bin edge precision, heat map labels
 * from the spec, rounded legend steps, gauge units and the range-area band:
 * the same 1.6 KB the grid's chart surface grew by (measure-size.mjs has
 * the list). No surface entry changed. The grid elements did not move.
 *
 * 99.5 -> 105.7 and 100.1 -> 106.2 for the grid elements with the spreadsheet
 * shell program and the charts commit before it. Measured 105.4 / 105.9: the
 * grid's base went 86.4 -> 91.5 (packages/grid/scripts/measure-size.mjs has
 * the per-feature breakdown: merged cells, HTML copy and paste, the keyboard
 * command seam, frozen rows and hidden lines with resize undo, Excel's entry
 * keys, fill by date and trend, menu icons), reaching the elements at 1:1,
 * plus the surface entries for the new props and events (98 -> 104
 * properties, 20 -> 23 events). Nothing sheet-specific is in it: the
 * spreadsheet itself is @svgrid/enterprise.
 *
 * 105.7 -> 107.5 and 106.2 -> 108.0 for the server-side row model program
 * (2026-09-17). Measured 107.2 / 107.7: the grid's base went 91.6 -> 93.0
 * (measure-size.mjs: the block cache, infinite mode on the flat controller,
 * the rowModel / placeholder / selection-model / visible-range seams, the
 * group-row editing guard), reaching the elements at 1:1, plus the surface
 * entries for the new props and events (104 -> 108 properties, 23 -> 25
 * events: rowModel, rowPlaceholder, rowSelectionModel, pivotResultColumns,
 * onVisibleRangeChange, onRetryRow). The Enterprise row model itself is
 * not in it.
 *
 * 107.5 -> 107.9 and 108.0 -> 108.4 for the Gantt view's free half
 * (2026-09-18). Measured 107.6 / 108.1: the grid's base went 93.1 -> 93.4
 * (measure-size.mjs: the `gantt` prop, the gantt-view seam and the view branch
 * in SvGrid.svelte), reaching the elements at 1:1, plus one surface entry
 * (108 -> 109 properties; no new events - the Gantt reports through callbacks
 * inside its config object, not through grid-level events). The Gantt itself -
 * renderer, layout model, axis, planning helpers - is @svgrid/enterprise and
 * costs an element consumer nothing. This is the two-edit cost the note above
 * describes, for the third time: a prop on the grid is a prop on the elements.
 */
const BUDGET_KIB = {
  '<sv-grid>': { file: join(dist, 'sv-grid-element.js'), budget: 107.9 },
  '<sv-grid-shadow>': { file: join(dist, 'shadow', 'sv-grid-shadow-element.js'), budget: 108.4 },
  '<sv-chart>': { file: join(dist, 'chart', 'sv-chart-element.js'), budget: 68.6 },
}

const failures = []
for (const [label, { file, budget }] of Object.entries(BUDGET_KIB)) {
  if (!existsSync(file)) {
    console.error(`check-size: ${file} is missing - run the build first.`)
    process.exit(1)
  }
  const gz = gzipSync(readFileSync(file)).length / 1024
  const over = gz > budget
  console.log(
    `=> ${label.padEnd(18)} entry gzip ${gz.toFixed(1)} KiB (budget ${budget} KiB${over ? ' - OVER' : ''})`,
  )
  if (over) failures.push(`${label}: ${gz.toFixed(1)} KiB exceeds ${budget} KiB`)
}

if (failures.length) {
  console.error('\nSize budget exceeded:')
  for (const f of failures) console.error(`  - ${f}`)
  console.error(
    '\nRaise the budget only with a note saying what was added and what it\n' +
      'bought, in the style of the comment above. Never ratchet it silently.',
  )
  process.exit(1)
}
