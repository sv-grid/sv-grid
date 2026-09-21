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
import { writeFileSync, mkdtempSync, readFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  //
  // 84.8 -> 85.3 for the keyboard command seam. Measured 84.5 without it and
  // 85.0 with, so 0.5 KB, against the 0.4 KB this file records for the free
  // half of `selectionBar` - the closest comparable seam. Three things are in
  // that number and all of them are base by necessity, because they answer
  // synchronously inside a keydown handler:
  //
  //   - `shortcut-registry.ts`, a prioritised handler chain. It exists because
  //     `GridKeyboardIntent` is a closed public union with no member that could
  //     mean "jump to the edge of the data region", and widening it would break
  //     any consumer switching on it exhaustively. Running registered handlers
  //     BEFORE the intent is computed sidesteps that.
  //   - `command-context.ts`, the handle those handlers read the grid through.
  //     All getters, and built only when `hasGridShortcuts()` is true, so a
  //     grid with nothing registered pays one array-length read per keystroke.
  //   - `history.ts`, group-aware undo.
  //
  // A shrink pass ran first, as the header above asks. Dropping `refresh()`
  // from the context (the one member `api.refresh()` already covers with no
  // index translation in it) took 85.1 -> 85.0. Folding the context into the
  // registry to save a module boundary was tried and REJECTED on measurement:
  // it went the wrong way, 85.0 -> 85.1, because two modules tree-shake better
  // than one. Re-measure before trying that again rather than assuming.
  //
  // The COMMANDS are not in this number. Ctrl+Arrow, Ctrl+D, paste special and
  // the rest are enterprise code arriving through `registerGridShortcuts` the
  // same way the scheduler, board and selection bar views do, so a free grid
  // pays for the dispatcher and nothing else.
  //
  // The history rewrite is in it too, and was close to free: it replaced three
  // open-coded slice/push/cap blocks in editing.ts and clipboard.ts and two
  // open-coded undo/redo blocks in build-api.ts and keyboard-handlers.ts with
  // one shared module, which is why 0.5 KB buys a registry AND a context AND
  // grouped undo.
  'full render component (SvGrid)': 85.3,
  // 84.8 -> 85.4 for the chart depth program's second wave. Measured 84.7
  // before and 85.1 after, so 0.4 KB, all of it in the controller: three more
  // fields on the per-chart tab state (histogram bins, funnel shape, candle
  // style) with their getters, setters, state round-trip and configureChart
  // keys; the direct-dispatch guard naming the five types that must not fall
  // through to the bar path; and the cross-filter rule excluding the three
  // new families a click cannot map back to one value. The thirteen new chart
  // types themselves are in the lazy engine chunk (see the chart surface
  // entry); this is the same two-edit cost the type picker paid before.
  //
  // 85.4 -> 86.4 for the program's last two waves. Measured 85.1 before and
  // 86.1 after, so 1.0 KB, again all controller: the ChartingConfig
  // pass-through (zoom / presets / sync / menu / animate / lifecycle events)
  // and the per-tab state that the builder, the price chart and the link
  // toggle need (zoom window, OHLC column picks, indicator list, format
  // state, frozen snapshot) with their getters, round-trip and configureChart
  // keys, plus the freeze / unfreeze methods and the debounced onChartChanged
  // effect. The OHLC column guessing, the indicator split and the format
  // applier were moved INTO the lazy engine (guessOhlcColumns,
  // splitPanelIndicators, ohlcDirectOptions, applyChartFormat) so the base
  // pays for the wiring and not the logic; a grid that never charts still
  // loads none of the engine.
  'full render component (SvGrid)': 86.4,
  // 86.4 -> 91.8 for the spreadsheet shell's grid-side primitives, plus the
  // main-branch charts commit that preceded them. Measured 91.5. This is the
  // largest single step this file records, so the breakdown is by feature,
  // from `scripts/attribute-size.mjs` run against a worktree at the last
  // commit before the program (b337027) and against HEAD; the per-file
  // numbers are estimates from the source map (they over-count shared
  // compression by about a third), the 4.0 KB total is real:
  //
  //   - 1.1 KB before the program: main's "Keyboard navigation Performance
  //     and Charts" commit landed at 87.5 against this 86.4 budget, so the
  //     check was already red when the branch merged (the chart value
  //     settings pass-through and the tab-run origin, both controller).
  //   - merged cells (~1.1): merges.ts (index, covered/origin lookups,
  //     range expansion, step-past), the merge windows and the origin /
  //     continuation / skip decision in the body row, selection snapping to
  //     the origin, api.getMergedCells. Render-path, so base.
  //   - HTML clipboard (~1.0): copy writes text/html beside the text through
  //     a one-shot copy listener with the ClipboardItem fallback
  //     (clipboardHtml), and Ctrl+V hands the native paste event's HTML to
  //     onPasteClipboard with the 80 ms async fallback. The copy path has
  //     to be synchronous inside the gesture, so it cannot be lazy.
  //   - the keyboard command seam (~0.7): command-context.ts and history.ts,
  //     acknowledged at 85.3 above on the branch but never carried into
  //     main's copy of this budget.
  //   - frozen rows, collapsed rows and columns, resize undo (~0.9): the
  //     frozen band's height and offsets, the collapsed sets the
  //     virtualizer and navigation read, and the size changes recorded in
  //     history. Controller and build-api.
  //   - Excel's entry keys and hidden-line navigation (~0.7): Enter and Tab
  //     inside a range with the tab origin, arrows stepping past collapsed
  //     lines. keyboard.ts and keyboard-handlers.ts.
  //   - fill by date and by linear trend (~0.2), canEdit on the command
  //     context, context-menu icons and built-in overrides (~0.1).
  //
  // None of it is sheet logic: formulas, formats, validation, conditional
  // formats, comments, protection, AutoFilter, the merge commands and the
  // ribbon are all in @svgrid/enterprise. What landed here is what a plain
  // data grid can use on its own (mergedCells, frozenRows, hidden lines,
  // Excel entry keys, HTML copy and paste), which was the program's rule for
  // what goes in the free grid. A shrink pass found nothing worth its
  // complexity: every piece is on a synchronous render, keydown or copy
  // path, and a lazy boundary there would paint merges a frame late or lose
  // the copy gesture. The two-edit cost the grid-wc note describes applies:
  // the elements moved by the same amount.
  //
  // 91.8 -> 93.3 for the server-side row model program (2026-09-17).
  // Measured 93.0. The server grouping model and its two components LEFT
  // the free grid for @svgrid/enterprise; what came in is the free half of
  // the line - AG Grid Community's infinite row model, matched one for one -
  // and the four seams the Enterprise model plugs into:
  //
  //   - server-block-cache.ts (~0.9): blocks keyed by index, LRU eviction,
  //     in-flight dedupe, abort, a concurrency queue, debounce, retry,
  //     unknown row count, patch / insert / remove for transactions.
  //   - createServerDataSource's infinite mode (~0.3): the cache wired to
  //     the flat controller, writes routed through it.
  //   - the seams (~0.6): the rowModel prop and its proxy fallback (data,
  //     loading, sort, filter, viewport, placeholders, group accessors,
  //     selection, filter values, paging, pinned rows, pivot columns), the
  //     visible-range effect, placeholder rows with the skeleton and the
  //     failed row's Retry, the rowSelectionModel routing in selection.ts
  //     and build-api, autoPageSize measurement, the group-row editing guard.
  //
  // Measured at the start of the program (main at the moved-out state) it
  // was 91.6; the block cache and the seams are on the render and scroll
  // path, so none of it can be lazy. The row model itself, transactions,
  // selection rules and pivot are Enterprise and add nothing here.
  //
  // 93.3 -> 93.7 for the Gantt view's free half (2026-09-18). Measured 93.4,
  // up from 93.1. The whole Gantt is in @svgrid/enterprise - the renderer, the
  // layout model, the axis, the planning helpers. What lands here is only what
  // `<SvGrid gantt={...}>` needs to compile and mount it: the `gantt` prop and
  // its config types (erased), the gantt-view registry seam, the view branch in
  // SvGrid.svelte (its root, the search box, the upsell note) and three
  // localized strings. That is the same shape the board and scheduler already
  // pay for, and the price of the prop living on the grid rather than behind a
  // second component import. The two-edit cost the grid-wc note describes
  // applies: the elements moved by the same amount.
  //
  // 93.7 -> 95.1 for sticky group rows and sized detail rows (2026-09-19).
  // Measured 94.8, up from 93.5. `stickyGroupRows` walks back from the first
  // row under the header to its ancestor group rows and, under
  // virtualization, renders a copy of each in a band the top spacer pays
  // for (the band snippet is most of the 1.3 KB: a row of cells drawn
  // through the same cell renderers, without the interactive attributes);
  // without virtualization the rows themselves are made sticky. It serves
  // server-side groups, client grouping and tree data from one code path.
  // `detailRowHeight` sizes detail rows for the virtualizer, which is what
  // lets master-detail keep virtualization on. Both sit on the render and
  // scroll path, so neither can be lazy. The row model side of master-
  // detail is @svgrid/enterprise and adds nothing here. The two-edit cost
  // the grid-wc note describes applies: the elements moved by the same
  // amount, plus two surface entries.
  //
  // 95.1 -> 95.9 for the detail-toggle column (2026-09-20). Measured 95.8,
  // up from 95.0. `showDetailToggle` is a third system column beside the
  // row numbers and the selection checkbox: a chevron cell in the body row
  // (the bulk of the 0.8 KB, with its aria state and the click), a blank
  // cell in every other row kind (header levels, filter row, summary,
  // pinned rows, the sticky band, skeletons) and the colspan and offset
  // arithmetic that keeps full-width rows and left-pinned columns lined up.
  // A system column cannot be lazy: it is part of every row. The demos had
  // each drawn their own chevron in a data column, which took the menu,
  // the resize handle and the active cell along with it.
  'full render component (SvGrid)': 95.9,
  'headless core (createGrid)': 3.0,
  // 5.0 -> 5.3 for the specialised single-clause sort comparators. Most sorts
  // are one column, and that comparator runs O(n log n) times - 1.66M calls for
  // 100k rows - so hoisting the clause lookup out of it and inlining the
  // numeric subtraction is worth the four extra closures: a single-column sort
  // went 32 ms -> 27 ms and a text sort 62 ms -> 59 ms. The budget keeps the
  // usual ~0.3 KB of headroom above the measurement.
  //
  // 5.3 -> 6.8 (measured 5.1 -> 6.5) when the three virtualizers joined the
  // entry. They are window arithmetic with no DOM and a custom renderer over
  // 50k rows needs one, but they were only on the barrel, so every Headless
  // demo imported the barrel to reach `createSvelteVirtualizer` and the
  // "import the engine alone" claim was not what the demo source did. This
  // row is the everything-imported ceiling; `createSvGrid` on its own is the
  // row above and did not move.
  'headless subpath (@svgrid/grid/core)': 6.8,
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
  //
  // 32.1 -> 32.4 for splitting the 3,300-line engine into modules. Measured
  // 31.8 before and 32.1 after, so 0.3 KB: one exported function per chart
  // family instead of one branch, each taking a shared ctx, plus the facade's
  // re-exports. Nothing moved between chunks - chart.ts is still the single
  // lazy engine chunk - so a grid that never charts pays nothing. This is the
  // foundation the chart depth program builds on (axis config, new families,
  // decimation), and it was not going to be done inside one function.
  //
  // 32.4 -> 40.4 for the chart depth program's foundation wave. Measured 32.1
  // before and 40.1 after, so 8.0 KB, split 5.8 engine / 2.2 renderer:
  //   - per-axis config (min / max / tick count and interval / formatter /
  //     grid lines / label rotation / reversed / labels off / fixed width),
  //     a numeric x axis, reference bands, x reference lines, title /
  //     subtitle / caption framing on every family;
  //   - null policy, step lines, marker shapes, per-point colours and
  //     markers, stroke width / dash / opacity / gradient fills;
  //   - data labels placed and thinned by the engine (placement, formatter,
  //     overlap hiding) instead of inline heuristics in the markup;
  //   - seven more reducers (min / max / median / percentile / first / last /
  //     distinct count) and calendar bucketing in rowsToChartSpec;
  //   - LTTB and min / max decimation, with the zoom slice routed through the
  //     same category picker so the per-category arrays stay in step;
  //   - a tooltip snippet + format hook + single-series mode, legend
  //     placement + item snippet, and autosize.
  // Still nothing in base: SvGrid measures 84.7 KB before and after. This is
  // the wave that lifts the chart from 'a chart in a grid' to something with
  // an axis model, which every later wave builds on.
  //
  // 40.4 -> 46.7 for the chart depth program's series-type wave. Measured 40.1
  // before and 46.4 after, so 6.3 KB, split 5.5 engine / 0.8 renderer:
  // histogram (with binValues and Sturges / FD / sqrt rules), range bar, range
  // area, lollipop, dumbbell, pareto, stream (wiggle and silhouette
  // baselines), sunburst, radial bar, radial column, nightingale, chord and
  // bullet, plus the hollow / Heikin-Ashi candle styles and the pyramid / cone
  // funnel shapes. Thirteen families for the price of one and a half of the
  // old ones; the polar five share one arc-path builder, which is most of
  // why. Still nothing a grid that never charts pays for.
  //
  // 46.7 -> 53.8 for the chart depth program's interaction wave. Measured 46.4
  // before and 53.5 after, so 7.1 KB, split 3.5 engine / 3.6 renderer:
  //   - chart-zoom (wheel / pan / pinch windows, range presets, nearest-by-
  //     time matching, 0.9), chart-motion (the geometry interpolator, 2.0),
  //     chart-sync (0.3), drillTree / pathTo (0.3);
  //   - in the renderer: the bindable zoom window with zoomTo / resetZoom,
  //     wheel + pinch + pan gestures and the y-axis window, preset buttons,
  //     sync-group publish / mirror effects, the data-update tween and the
  //     grow / wipe enter effects, sunburst and tree map drilldown with a
  //     breadcrumb, point selection with dimming, series stepping with the
  //     live region, and the keyboard opener for the context menu.
  // The menu itself is the lazy `SvChartMenu` chunk (6.3 KB with the shared
  // menu list, popover and dismissable layer), fetched on the first
  // right-click. The interpolator was tried as a lazy chunk too and rejected:
  // it shares the arc and line path builders with the engine, so Rollup hoisted
  // those into a third chunk and base grew by 0.8 KB to move 1.2 KB out. SvGrid
  // base 85.1 -> 85.2 for the ChartingConfig pass-through (zoom / presets /
  // sync / menu / animate) and the per-tab zoom window in the controller.
  //
  // 53.8 -> 59.6 for the chart depth program's financial wave. Measured 53.5
  // before and 59.3 after, so 5.8 KB:
  //   - the overlays a price series can carry (Bollinger with its band path,
  //     VWAP, WMA) pull the indicator module's overlay half into the engine;
  //     the pane indicators (RSI, MACD, stochastic, ATR, OBV) are only reached
  //     through indicatorPane / SvChartPanes and tree-shake out of this entry;
  //   - the last-price pill, annotation shapes (flag / pin / square) with a
  //     tooltip, reader drawings resolved to pixels (trend, ray, fib levels,
  //     rect, arrow, text) and the drawing tools: tool state, data-space
  //     conversion, handles, keyboard removal, the toolbar buttons;
  //   - PDF and print are a lazy chunk (chart-export-pdf, 2.4 KB) loaded on
  //     the first click; the shared chart-export module became its own base
  //     chunk because the renderer and that lazy chunk both import it, which
  //     moves bytes between chunks and adds none.
  // The builder (SvGridChartBuilder + chart-samples, 12.6 KB) and SvChartPanes
  // are lazy from the grid panel and never load for a chart outside it.
  //
  // 59.6 -> 62.3 for the gap-closing pass after the program (2026-09-13).
  // Measured 59.3 before and 62.1 after, so 2.8 KB, all in the engine and the
  // renderer of a plain chart: stack groups (the bar layout became slot-based
  // so a named stack, a lone bar and a stem each get a column, and the domain
  // totals per stack), series end labels (a reserved gutter plus the
  // push-apart), responsive rules (the rule matcher and the one-level axis
  // merge, run first in buildChart), pie callouts (the leader layout and the
  // per-side push-apart), the crosshair axis pills and the series `visible`
  // seed. Each is a spec field a chart may carry, so none can be lazy.
  //
  // 62.3 -> 65.3 for the accessibility pass (2026-09-13). Measured 62.1
  // before and 65.0 after, so 2.9 KB: the chart's strings moved into
  // chart-messages (60 keys with English defaults, the resolver and the
  // placeholder filler, so localeText can replace any of them); a roving
  // focus with arrow / Home / End / PageUp / PageDown navigation, a focus
  // tooltip and a name on every mark of the ten non-cartesian families,
  // each a few closures the compiler emits per element; keyboard zoom and
  // pan on the plot and the brush as a slider. The forced-colors rules are
  // CSS and do not count here. None of it can be lazy: the strings and the
  // handlers are what the first render puts in the DOM.
  //
  // 65.3 -> 68.8 for the series and interaction depth wave of program 2
  // (2026-09-13). Measured 65.0 before and 68.5 after, so 3.5 KB: four
  // regression fits with their normal-equation solver and R-squared
  // (chart-stats, reached through the overlay dispatch every cartesian chart
  // runs, so not lazy), the log x axis in layoutX / layoutScatter /
  // chartScales and lttb's explicit positions, area piles keyed by stack,
  // the hover highlight (nearest series with a snap distance, the
  // once-per-change onHover report), the corner and pinned tooltip, data
  // label push-apart with leaders, and the style vars on the host. The 32
  // font-size rules became calc() expressions, which is CSS and not counted.
  //
  // 68.8 -> 69.4 for the diagnostics / summary / live wave of program 2
  // (2026-09-13). Measured 68.5 before and 69.2 after, so 0.7 KB, of which
  // 0.3 is code: the describe and live props, the summary state and its
  // lazy import, aria-description and the caption, the Describe menu item
  // and the dev-only diagnostics hook. The validator (3.6 KB) and the
  // summary (2.7 KB) load through import() and sit in the lazy column. The
  // other 0.4 is the bundler: the summary shares formatChartValue with the
  // engine, so what both use is hoisted into a chunk of its own, and a chunk
  // gzips worse alone than inlined. It first hoisted all of chart-scale and
  // chart-stats (1.3 KB of locality for no new code); chart-format.ts and
  // chart-trend.ts now hold exactly what is shared, so the hoisted chunk is
  // 0.6 KB. Adding an import from a lazy chart module into a big engine
  // module brings that cost back; check this line when you do.
  //
  // 69.4 -> 70.2 for the gallery pass (2026-09-13). Measured 69.2 before
  // and 69.9 after, so 0.7 KB, all engine and renderer: the regressions take
  // an x array and return predict() so a scatter's overlay is y on x, and
  // the scatter layout samples that curve across the plot; the pie sizes its
  // radius by the widest callout and hands the renderer a per-side
  // character budget; the brush spec mutes titles, axis labels and marks;
  // the heat map thins its column labels; the calendar keeps month labels
  // inside the range; a waterfall total with a value anchors the running
  // sum; a pin annotation writes its label; and x labels tilt by fit rather
  // than by count. Each is a layout rule every chart may hit, so none can be
  // lazy.
  //
  // 70.2 -> 71.9 for the QA pass after the gallery (2026-09-13). Measured
  // 70.0 before and 71.6 after: calendar-aligned time ticks sized to the
  // plot with UTC labels; a date category written out in the tooltip, the
  // crosshair pill and the live region; a series on the right axis read in
  // that axis's format everywhere; scatter points that select; the
  // breadcrumb outside the toolbar; a double-click that clears an isolation;
  // a selection ref that carries its category index; 100% data labels as
  // shares; the waterfall tooltip and table reading the drawn totals; the
  // radar rim on yAxis.min / max; per-side pie gutters; bin edges labelled
  // at their width's precision; heat map cell labels from the spec; legend
  // steps rounded; gauge units; the range area drawn as a band. Every one
  // is a rule the renderer or a layout applies on every chart, so none can
  // be lazy.
  'chart surface (SvChart)': 71.9,
}

const CHECK = process.argv.includes('--check')
// `--json` also writes docs/_data/svgrid-size.json, the one place the site
// reads SvGrid's own size from: the comparison pages, the comparison guides
// and the README quote it from there instead of typing a number that was true
// the day someone last ran this script.
const JSON_OUT = process.argv.includes('--json')
const SIZE_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs', '_data', 'svgrid-size.json')
const JSON_KEYS = {
  'full render component (SvGrid)': 'full',
  'headless core (createGrid)': 'headless',
  'headless subpath (@svgrid/grid/core)': 'core',
  'chart surface (SvChart)': 'chart',
}
const failures = []
const measured = {}

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
  measured[JSON_KEYS[label] ?? label] = {
    baseGzipKb: Number((baseJs / 1024).toFixed(1)),
    cssGzipKb: Number((css / 1024).toFixed(1)),
    lazyGzipKb: Number((lazyJs / 1024).toFixed(1)),
  }
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

if (JSON_OUT) {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const out = {
    readme: 'Written by packages/grid/scripts/measure-size.mjs --json (pnpm size --json). Gzip level 9 of the minified Vite library build with Svelte external. Read by tools/lib/competitor-facts.mjs; never edit by hand.',
    measuredAt: new Date().toISOString().slice(0, 10),
    version: pkg.version,
    entries: measured,
  }
  mkdirSync(dirname(SIZE_FILE), { recursive: true })
  writeFileSync(SIZE_FILE, JSON.stringify(out, null, 2) + '\n')
  console.log(`wrote ${SIZE_FILE}`)
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
