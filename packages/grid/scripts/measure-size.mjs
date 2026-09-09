/**
 * Measure the real gzipped cost of the two things the homepage/README claim:
 *   - "full render component" = <SvGrid> and everything it pulls in
 *   - "headless core"         = createGrid/createSvGrid engine, no rendering
 *
 * Each is bundled in ISOLATION with Svelte kept external (it's a peer dep, so it
 * does NOT count toward what SvGrid adds to a consumer's bundle), minified, then
 * gzipped. This mirrors what a real app that imports only that symbol ships.
 */
import { build } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { gzipSync } from 'node:zlib'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const pkgSrc = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const ENTRIES = {
  'full render component (SvGrid)': `export { default } from ${JSON.stringify(pkgSrc + 'SvGrid.svelte')}`,
  'headless core (createGrid)': `export { createGrid, createSvGrid } from ${JSON.stringify(pkgSrc + 'createGrid.svelte.ts')}`,
  // The whole published '@svgrid/grid/core' subpath, not just createGrid - this
  // is the number a consumer actually pays for `import ... from '@svgrid/grid/core'`.
  "headless subpath (@svgrid/grid/core)": `export * from ${JSON.stringify(pkgSrc + 'headless.ts')}`,
  // Charting, measured on its own.
  //
  // The chart chunks are the largest deferred feature in the package and they
  // had no ceiling at all: the budgets below only ever applied to an entry's
  // BASE bundle, and charts are lazy from SvGrid's point of view, so they were
  // invisible to `--check`. Giving the renderer its own entry makes
  // "renderer + engine" the base number of its own isolated build, which the
  // existing check then guards with no new machinery.
  //
  // Deliberately not budgeted: SvGrid's lazy total. It aggregates eleven
  // unrelated chunks, so a ceiling there would fire on a date-picker change.
  'chart surface (SvChart)': `export { default } from ${JSON.stringify(pkgSrc + 'SvGridChart.svelte')}`,
}

/**
 * Base-JS ceilings, in KB gzip. `--check` fails when an entry exceeds its
 * budget, so a stray static import cannot silently undo a lazy boundary.
 *
 * That has happened: GridFooter once statically imported SvGridDropdown, which
 * dragged 5.9 KB into base AND defeated SvGrid.svelte's own `import()` of the
 * same component. Nothing caught it.
 *
 * Budgets are a small margin above the measured number - tighten them when a
 * change legitimately lowers the floor, and never raise one without saying why
 * in the commit.
 */
const BUDGET_KB = {
  // 77.3 -> 77.9 when #69 and #66 landed: the deferred drop-indicator clear
  // (a frame handle + its cancel paths) and the touch-drag entry point, which
  // has to watch the gesture itself while its module is being fetched. The
  // touch implementation proper is a lazy chunk (`row-drag-touch`), so this is
  // the irreducible base half of two bug fixes, not drift.
  //
  // 78.1 -> 78.2 with the per-column `summary` aggregator: createSummaries now
  // dispatches through applyGroupAggregate for a column that declares its own
  // summary, and the `summary` shortcut prop carries a derived + a ctx getter.
  // createSummaries is on the static path, so both land in base. The budget
  // goes to 78.5 to restore the ~0.3 KB of headroom this file has always kept -
  // it had been ratcheted flush against the measurement, so a one-byte feature
  // failed CI. The dev-only config checks from the same batch cost base nothing:
  // `DEV` folds to false in a production build and Rollup drops the block.
  //
  // 78.5 -> 78.9 for the row-pipeline rewrite. `createSortedRowModel` now
  // resolves each sort clause once and precomputes a key array instead of
  // resolving the column inside the comparator (that was 1,528,947 array scans
  // for a single-clause 100k sort), plus a distinct-value ranking path so text
  // columns collate O(distinct log distinct) times rather than O(n log n).
  // `applyGroupAggregate` became a single pass. Measured payoff: single-column
  // sort 351 ms -> 35 ms, three-column 569 ms -> 49 ms, grouping 229 ms ->
  // 106 ms, and a latent RangeError crash on large groups gone. All of it is
  // engine code on the static path, so it lands in base. 0.1 KB measured, and
  // the budget goes to 78.9 to keep the usual 0.3 KB of headroom rather than
  // sitting flush against the measurement again.
  //
  // 78.9 -> 79.3 for the sort / filter / group round. A stride sample decides
  // whether text sorting should rank distinct values before paying to collect
  // them; grouping tracks each bucket's raw value so deeper levels stop
  // re-scanning a column an ancestor already fixed; the Excel filter's fold
  // takes an ASCII fast path. Measured: text sort 117 -> 63 ms, grouping
  // 57 -> 49 ms, the compiled filter 21 -> 3 ms on ASCII. 0.1 KB measured,
  // budget set 0.3 KB above it to keep the usual headroom.
  //
  // 79.3 -> 79.6 for the three symbol keys that hold a row's private fields.
  // They replaced plain `_ctx` / `_values` / `_cells` properties, which were
  // enumerable and therefore serialised: `JSON.stringify(oneRow)` reached
  // `options.data` through the context pointer and grew with the dataset
  // (981 chars at 3 rows, 67,719 at 3,000), making stringifying a row model
  // quadratic. Symbols are skipped by JSON, `Object.keys` and `for...in` while
  // still being copied by object spread, which the grouping and tree row models
  // depend on. Pinned by core.row-shape.test.ts.
  //
  // 79.6 -> 80.0 for the `columnResize` / `rowResize` props. Measured 79.4
  // without either, 79.7 with both, so 0.3 KB. The row-resize ACTION is not in
  // that number - importing it statically cost a further 1.1 KB and put the
  // base over on its own, so SvGrid pulls it through `import()` and it lands in
  // the lazy chunks (84.2 -> 85.5 KB); a grid that never sets `rowResize` never
  // fetches it.
  //
  // 80.0 -> 79.4, BELOW where this all started, when `columnResize` flipped to
  // off-by-default and the column drag moved out to a `columnResize` action of
  // its own. The handles are injected by that action instead of rendered by
  // SvGrid, so the markup, the keyboard handler, the pointer/rAF drag and five
  // pieces of controller state all left the base graph together: 79.7 -> 79.1,
  // with the lazy chunks going 85.5 -> 86.9. Ratcheted to 0.3 KB above the new
  // measurement rather than left slack at 80.0 - a budget that no longer
  // tracks the code stops catching the next static import.
  //
  // 79.4 -> 80.9 for `moveCells` - Excel-style drag-and-drop of a selected
  // range. Measured 79.1 without it and 80.6 with, so 1.5 KB, the largest
  // single feature bump this file records. It is all base by necessity: the
  // grab test has to answer synchronously inside `onCellPointerDown` (it
  // decides whether the pointerdown starts a move or a selection), the hover
  // test runs on window pointermove before any button is pressed, and the drop
  // preview reuses the fill marquee, which is evaluated per rendered cell.
  //
  // The obvious lazy boundary was tried and REJECTED on measurement. Moving
  // the drop commit - the refusal rules, the snapshot, the writes and the undo
  // append, the biggest single block - into its own `import()`ed module took
  // base to 80.3 and pushed the lazy chunks 87.0 -> 87.7. 0.3 KB, bought with
  // an async mutation path in a data grid and a race (however remote) between
  // a fetch and a pointerup. Not a trade worth making; if someone revisits
  // this, re-measure first rather than assuming the split pays.
  //
  // 80.9 -> 81.4 for drag edge auto-scroll. 80.6 -> 81.1 measured, so 0.5 KB
  // for one rAF loop shared by all three drags that extend a rectangle: the
  // fill handle, the range move, and plain drag-select. All three were capped
  // at whatever was already on screen when the drag began, which on a grid
  // built for 100k rows means the feature mostly did not work. Shared
  // deliberately - three copies of the ramp and the re-target would have cost
  // more than this and drifted apart.
  //
  // 81.4 -> 81.8 for the FREE half of `selectionBar`: the registry seam, the
  // prop normalisation (three shapes down to one config), the derived selection
  // target, and the upsell note shown when no renderer is registered. Measured
  // 81.1 -> 81.5, so 0.4 KB.
  //
  // The bar itself is NOT in this number. It is a Pro renderer in
  // @svgrid/enterprise, arriving through `registerSelectionBarView` the same
  // way the scheduler and board views do, so a free grid pays for the prop and
  // nothing else - and a paid one pays only once enterprise is imported.
  //
  // 81.8 -> 82.1 for the shared licensing line under every Enterprise upsell
  // (board, scheduler, pivot, selection bar). One snippet plus two message
  // strings, rendered four times - four hand-written paragraphs would have
  // cost more AND drifted apart. Pinned by svgrid.upsell-license.test.ts.
  //
  // 82.1 -> 82.9 for the two `dateString` fixes. A `dateString` column holds
  // an ISO date STRING, but committing an edit ran through the shared date
  // coercion, which does `new Date(v).toISOString()` - so picking Christmas
  // stored `2026-12-25T01:00:00.000Z` and the cell showed a timestamp beside
  // neighbours showing plain dates, on a calendar day that depended on the
  // user's timezone. And the filter row mounted a NATIVE date input while the
  // cell editor mounted the grid's own picker, so one column looked like two
  // different products depending on where you touched it.
  //
  // Measured 0.4 KB for the filter-row picker (82.2 with the branch and its
  // lazy loader ablated, 82.6 with them) and 0.4 KB for the rest - the
  // `dateOnly` coercion path, `toIsoDateLocal`, and `usesRichDateFilter`.
  //
  // The component itself is NOT in this number: it arrives through the same
  // `import()` the cell editor uses, gated on a column actually declaring a
  // date editor, because most grids never show a filter row and most that do
  // have no date column. What is left in base is the template branch and the
  // loader, and a template branch cannot be deferred - it is the thing that
  // decides whether to load anything at all.
  //
  // 82.9 -> 83.2 for `between` on a date column. The operator picked Between
  // and then filtered nothing: the rich-picker branch won for every operator,
  // so the row got ONE date field, `valueTo` stayed empty, and `condActive`
  // ignores a between whose second bound is unset. Between now swaps in a
  // range field, which also fits a narrow date column - two single-date
  // pickers plus their buttons did not, and the last button spilled onto the
  // next column where no click could reach it.
  //
  // Measured 0.3 KB for the branch and its lazy loader (82.7 with both
  // ablated, 83.0 with them); the rest of the same batch of filter/editor
  // fixes fits under the old ceiling. Budget set 0.2 KB above the measurement
  // rather than flush against it, because the previous flush ceiling turned an
  // ordinary bug fix into a size failure.
  //
  // SvDateRangeInput itself is NOT in this number - it arrives through
  // `import()`, gated on a date column actually being set to Between, so a
  // grid that never picks the operator never pays for it. What stays in base
  // is the template branch and the loader, and a template branch cannot be
  // deferred: it is the thing that decides whether to load anything at all.
  //
  // 83.2 -> 83.6 for the filter-menu batch: the checklist now counts each
  // value and offers only the ones still reachable under the OTHER columns'
  // filters, and "select all" acts on the search results instead of silently
  // clearing the column.
  //
  // Measured 83.3 with the counting/narrowing scan ablated and 83.4 with it,
  // so that part is ~0.1 KB; the rest is lifting the per-column filter stages
  // out of `allRowsBeforePagination` into `applyColumnFilters` (which is what
  // lets the facet list reuse the pipeline rather than re-implement it) plus
  // the select-all rework in menus.ts.
  //
  // The date controls the menu grew are NOT in this number, and neither is
  // any of the menu markup: GridMenus is a lazy chunk and the pickers are a
  // further `import()` inside it, gated on the open column being a date. The
  // measurement confirms it - SvDateTimePicker, SvDateRangeInput and
  // date-format all still report as lazy.
  // 83.6 -> 84.2 for the `icons` prop: every glyph the grid draws for its own
  // chrome now resolves through one snippet, so a consumer can replace any of
  // them by name.
  //
  // Measured 83.4 before and 83.9 after, so 0.5 KB. I expected this to come out
  // flat, on the theory that folding nine inline SVGs into the shared root would
  // pay for the lookup - it did not. What actually lands in base is the override
  // branch and the glyph-table branch (two per icon call, and `icon` is rendered
  // 40-odd times), the GRID_ICON_GLYPHS table itself, and the five new path arms.
  // The savings were smaller than that because Svelte was already hoisting the
  // repeated inline SVGs into shared template fragments, so the duplication I
  // was counting on removing had largely been compiled away already.
  //
  // GridMenus is a lazy chunk, so its 15 icon call sites cost base nothing, and
  // SvGroupCell / SvRowGroupPanel are not imported by SvGrid at all. CSS went
  // the other way, 9.5 -> 9.4 KB, because the menu-search magnifier stopped
  // being a base64 data URI.
  //
  // Not deferrable: this is the branch that decides what to draw, so it has to
  // be present before anything can be drawn. Budget set 0.3 KB above the
  // measurement, the usual headroom.
  //
  // 84.2 -> 84.5 for opening the chart panel's type picker from four types to
  // thirteen. Measured 83.9 before and 84.2 after, so 0.3 KB.
  //
  // The picker itself is in SvGridChartPanel, which is lazy and costs base
  // nothing. What lands here is the controller half: a `dates` bucket on
  // `chartableColumns`, `columnIsDate` lifted out so the panel can ask it of
  // columns nobody has picked yet, the scatter Y field on the tab state, the
  // cross-filter gate, and the dispatch that routes scatter / gauge / treemap
  // / calendar / sankey to their builders. The controller already derives the
  // chart spec in base, so this follows the shape that was already there
  // rather than adding a new one.
  // 84.5 -> 84.8, and this one buys NOTHING - it restores headroom that should
  // never have been given up. The last two bumps set the budget flush against
  // the measurement, so base sat at exactly 84.5 with nothing to spare, and a
  // round of work that touched only LAZY files (the chart renderer and engine)
  // came out at 84.502 and failed the check. Two bytes.
  //
  // This file has already learned that lesson once, a few entries up: "it had
  // been ratcheted flush against the measurement, so a one-byte feature failed
  // CI". Same mistake, same fix - 0.3 KB of headroom, which is the margin every
  // other entry here keeps and roughly one small feature's worth of room.
  'full render component (SvGrid)': 84.8,
  'headless core (createGrid)': 3.0,
  // 5.0 -> 5.3 for the specialised single-clause sort comparators. Most sorts
  // are one column, and that comparator runs O(n log n) times - 1.66M calls for
  // 100k rows - so hoisting the clause lookup out of it and inlining the
  // numeric subtraction is worth the four extra closures: a single-column sort
  // went 32 ms -> 27 ms and a text sort 62 ms -> 59 ms. The budget keeps the
  // usual ~0.3 KB of headroom above the measurement.
  'headless subpath (@svgrid/grid/core)': 5.3,
  // Measured 26.3 KB: SvGridChart.svelte plus the chart.ts engine it statically
  // imports. Nobody pays this unless they chart - SvGrid reaches both through
  // `import()` - but it is the biggest deferred thing in the package and until
  // now nothing stopped it growing, because `--check` only ever saw base
  // bundles and charts are never in one. Budget set 0.3 KB above the
  // measurement, the same headroom the entries above keep.
  //
  // 26.6 -> 27.8 for candlesticks / OHLC and the ordinal-time axis. Measured
  // 26.3 before and 27.5 after, so 1.2 KB: the candle layout block, the
  // `ordinalDateTicks` unit search, the two markup branches, and OHLC rows in
  // the tooltip and the screen-reader table. The axis half is most of it and
  // is not candle-specific - any daily series of business days now gets an
  // x axis whose marks and labels agree.
  //
  // SvGrid's own base is untouched at 83.9 KB, which is the point: none of
  // this reaches a grid that never charts.
  //
  // 27.8 -> 28.2 for locale-aware value formatting. Measured 27.6 before and
  // 28.0 after, so 0.4 KB, and it buys a chart that can say what currency it is
  // drawing. `formatChartValue` hard-coded a `$`, so every axis, data label and
  // tooltip on every chart outside the dollar zone was labelled in the wrong
  // currency, with no prop to fix it.
  //
  // The 0.4 is the Intl branch plus `getNumberFormatter`, which chart.ts now
  // imports from cell-formatting instead of caching its own. The cache is not
  // optional at any price: `Intl.NumberFormat` is expensive enough to construct
  // that a chart with 200 data labels would build 200 of them a frame. Writing
  // a second, leaner cache here would shave maybe 0.2 KB and leave two of them
  // to keep in step, which is a bad trade.
  //
  // SvGrid's base is again untouched (84.4 KB): cell-formatting was already
  // there for column formats, so this only shows up for a standalone SvChart.
  //
  // 28.2 -> 29.6 for box plots and error bars. Measured 28.0 before and 29.3
  // after, so 1.3 KB for the two marks that answer "how spread out" rather than
  // "how much" - the box geometry and its renderer, `boxStats` with the 1.5 IQR
  // whisker rule, `rowsToBoxSpec`, the error-bar geometry, and five tooltip rows
  // per box.
  //
  // Base did NOT move for this, and that took work: the controller used to name
  // scatter and gauge itself, so every direct chart type was bytes in the base
  // bundle of grids that never chart. That dispatch moved into the engine
  // (`rowsToDirectSpec`), which paid for box plots and leaves the next direct
  // type free.
  //
  // 29.6 -> 30.6 for large-series rendering. Measured 29.3 before and 30.3
  // after, so 1.0 KB, and it is the best-paying kilobyte in this file: a
  // 20,000-point line chart went from 63,024 DOM nodes and 4,711 ms to 3,072
  // nodes and 617 ms, measured in Chromium on the same build with the new paths
  // toggled off and on.
  //
  // The engine was never the problem - `buildChart` does 100k points in about
  // 140 ms. Four separate things emitted one node PER CATEGORY: a `<circle>`
  // per point, a hit `<rect>` per category whose `aria-label` called
  // `catRows()` at render time, a `<text>` per axis label, and a screen-reader
  // table row. Under ~4px a category none of them could be read or aimed at
  // anyway, so they collapse to one hovered dot, one hit surface, ~40 thinned
  // labels and a capped table.
  //
  // 30.6 -> 31.0 for the custom-series seam. Measured 30.3 before and 30.7
  // after, so 0.4 KB: `chartScales`, the axis domains reported on the geometry,
  // and the two snippet call sites.
  //
  // The alternative design was a registry of custom mark types, like the
  // chart-view / board-view seams. It was rejected because a chart mark is
  // markup, not a component: handing over the geometry and the scales lets a
  // caller draw with ordinary SVG in a snippet, and costs a fraction of what a
  // registry plus its resolution would.
  //
  // 31.0 -> 31.6 for interactive annotations. Measured 30.7 before and 31.3
  // after, so 0.6 KB: the toolbar toggle, the removable markers and their
  // keyboard handling.
  //
  // Cheap because annotate mode does not add a gesture - it takes over the
  // category one. Drag was already zoom and double-click already reset, so a
  // new gesture would have needed its own hit testing and its own pointer
  // bookkeeping. Reusing `select()` also means it works from the keyboard for
  // nothing, since the category hit zones already navigate with arrows.
  //
  // 31.6 -> 32.1 for the enter animation and the reduced-motion guard.
  // Measured 31.3 before and 31.8 after, so 0.5 KB - all of it the CSS, which
  // Svelte inlines into the component's JS.
  'chart surface (SvChart)': 32.1,
}

const CHECK = process.argv.includes('--check')
const failures = []

const kb = (n) => (n / 1024).toFixed(1) + ' KB'

for (const [label, code] of Object.entries(ENTRIES)) {
  const dir = mkdtempSync(join(tmpdir(), 'svgrid-size-'))
  const entry = join(dir, 'entry.js')
  writeFileSync(entry, code)

  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [svelte({ emitCss: false })],
    build: {
      write: false,
      lib: { entry, formats: ['es'], fileName: () => 'out.js' },
      minify: true,
      sourcemap: false,
      cssCodeSplit: false,
      rollupOptions: { external: ['svelte', /^svelte\//] },
    },
  })

  const outputs = result[0]?.output ?? result.output ?? []
  const chunks = new Map(outputs.filter((o) => o.type === 'chunk').map((o) => [o.fileName, o]))
  // A chunk is "base" if it's reachable from the entry via STATIC imports only
  // (it loads synchronously with the entry); "lazy" if reached only via import().
  const base = new Set()
  const walk = (name) => {
    if (!name || base.has(name)) return
    base.add(name)
    for (const dep of chunks.get(name)?.imports ?? []) walk(dep)
  }
  walk(outputs.find((o) => o.type === 'chunk' && o.isEntry)?.fileName)

  let baseJs = 0, lazyJs = 0, css = 0
  for (const o of outputs) {
    const content = o.type === 'chunk' ? o.code : o.source
    const bytes = Buffer.byteLength(content)
    const gz = gzipSync(content, { level: 9 }).length
    const kind = o.fileName.endsWith('.css') ? 'css' : base.has(o.fileName) ? 'base' : 'lazy'
    if (kind === 'css') css += gz
    else if (kind === 'base') baseJs += gz
    else lazyJs += gz
    if (!CHECK) {
      console.log(`   ${kind.padEnd(6)} ${o.fileName.padEnd(28)} raw ${kb(bytes).padStart(9)}   gzip ${kb(gz).padStart(9)}`)
    }
  }
  const entryJs = baseJs
  const budget = BUDGET_KB[label]
  const overBudget = budget != null && entryJs / 1024 > budget
  if (overBudget) {
    failures.push(`${label}: base JS ${kb(entryJs)} exceeds the ${budget} KB budget`)
  }
  console.log(
    `=> ${label}: base JS gzip ${kb(entryJs)}` +
      (budget != null ? ` (budget ${budget} KB${overBudget ? ' - OVER' : ''})` : '') +
      (css ? ` + CSS ${kb(css)}` : '') +
      (lazyJs ? `   |  lazy chunks (loaded on demand) ${kb(lazyJs)}` : '') +
      '\n',
  )
}

if (CHECK) {
  if (failures.length) {
    console.error('\nSize budget exceeded:')
    for (const f of failures) console.error('  - ' + f)
    console.error(
      '\nSomething moved into the base graph. Usual cause: a static import of a\n' +
        'module that is supposed to load via import(). Check the newest imports in\n' +
        'SvGrid.svelte and anything it reaches.',
    )
    process.exit(1)
  }
  console.log('All entries within budget.')
}
