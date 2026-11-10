# Changelog

The user-facing log of what shipped. Format follows
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/).

Every release has up to six sections:
- **Added** - new features
- **Changed** - existing functionality, behaviour changes
- **Deprecated** - soon-to-be-removed features
- **Removed** - features removed in this release
- **Fixed** - bug fixes
- **Security** - vulnerability patches (with CVE ids when applicable)

Pre-release entries live under `## [Unreleased]`. They graduate to a
dated heading on publish via `pnpm changeset version` (see
[.changeset/README.md](../.changeset/README.md)).

For machine-readable releases, fetch
[`/changelog.json`](/changelog.json) - same content, parseable shape.

## [Unreleased]

### @svgrid/grid

#### Added

- **`trustedHtml(html)`.** `sanitizeHtml`, ready for an HTML sink on a page that requires Trusted
  Types: there it is a `TrustedHTML` of the `svgrid` policy, elsewhere the same string.

- **`toggleOnSecondClick` on a checkbox column.** The first click selects the cell, a click on the selected cell toggles it, and a finger toggles on the tap. Off by default.

- **`parseClipboardText`, and more for the fill and paste hooks.** `parseClipboardText(text)` splits a
  paste into rows of cells, for a consumer whose copy quotes a cell. `processCellForFill` also gets
  `sources` and `index`, and `processCellFromClipboard` gets `cell`, the place in the pasted block.
  Left out, a grid fills and pastes as it did.

- **`keepFocus`.** When the focused control of a region is removed or disabled, focus
  moves to the control now in its place, not to the body. `createFocusTrap` and
  `menuFocus` use it, so dialogs, drawers and menus have it. `use:keepFocus` gives it
  to any other region.
- **`describedBy` on `SvModal`.** The id of what a dialog says, read with its title.

- **`holdRowsOnWrite`.** A paste, a clear or a fill changes rows where they stand, as a
  typed edit does, for an app that orders the view itself when the person moves on.
- **`onPasteOverflow`.** The lines of a paste past the last row, split into cells, inside
  the paste's undo step. Without it they are dropped, as before.
- **`gridLabel`.** The accessible name of the grid, on its table element. SvGrid Base
  passes the table's name.
- **Very long grids scroll true at both ends.** Past the height a browser paints
  cleanly the grid now scales its scroll, with a pixel staying a pixel near each end,
  so the rows past about 560,000 of a million draw as they should and Ctrl+End
  reaches the last row.
- **`onColumnVisibilityChange` and `onColumnPinningChange`.** Hiding,
  showing, pinning or unpinning a column, from the column menu, the api
  setters or `api.setState`, now calls back with the hidden ids or the
  `{ left, right }` pinning, the same shapes `api.getState()` reports. Both
  are deduped on the value and do not fire on mount. An app saving the
  layout no longer has to poll `getState()` to notice either. The
  `<sv-grid>` element fires `columnvisibilitychange` and
  `columnpinningchange`.

- **`SvGridProps` is exported.** The full prop type, for a wrapper that
  forwards a typed options bag to `<SvGrid>`. Without it a wrapper had to
  hand-write a `declare module "@svgrid/grid"` stub, which shadows the
  package's own types.

- **`chartSpecToTable`.** The rows and columns a spec amounts to, in the
  shape `SvGrid` takes: one row per category with a column per series (a
  grouped axis adds a Group column, a histogram From and To, candles their
  four prices, a box plot its five numbers), per point for a scatter, per
  link for a sankey or chord, per leaf for a tree map or sunburst with a
  column per level, per day for a calendar, one row for a gauge. Number
  columns carry the chart's format (a right-axis series its axis's) and a
  date axis is a date column. The gallery demos' Chart | Grid switch is this
  behind a sortable grid.

- **The Chart panel charts the pivot in pivot mode.** With `pivot` and
  `charting` on one grid, the pivot bar carries the Chart toggle and the
  panel draws the pivot on screen: row groups as categories (nested rows a
  grouped axis), column groups as series, the measures' format on the axis,
  totals left out. The data pickers step aside with a note and the Type
  select keeps the shapes a pivot can take; Stacked, 100%, Horizontal, the
  Format tab, the builder, saved charts, export and Describe still apply. A
  click on a bar filters the innermost row dimension when the grid has a
  column for it, which re-runs the pivot. It used to chart the source rows by
  the source columns whatever was on screen. The mapping is
  `pivotResultToChartSpec` (with `pivotChartType`, `pivotFilterColumn`)
  in the lazy chart engine; enterprise's `pivotToChartSpec` is the same
  function. `bucketsToChartSpec` (server aggregates as a spec) moved there
  from the controller, out of the base bundle.

- **Scatter points select.** A click or Enter on a scatter or bubble point
  selects it the way a bar selects: the point's `label` (or its series) is
  the category, its y the value, and `selectable`, `bind:selected`,
  `onSelectionChange` and `onSelect` all apply. The dots had no click
  handler, so on a scatter chart those props did nothing.
- **`ChartPointRef.index`.** A selected bar carries its category index
  beside its label, and two refs with an index match only on the same one.
  A grouped axis repeats its leaf labels (Q1 to Q4 under each year), so a
  click on the second Q2 used to select the first Q2 with it. A ref written
  without an index still matches by label.
- **Data labels on a 100% chart read the share.** Under `stacked100` the
  axis is already a share whatever `valueFormat` says; the labels on the
  bars now say "18%" as well, rather than "$18", or "1800%" when the format
  was percent. A `dataLabels.formatter` still receives the raw value and the
  tooltip keeps it.
- **A series on the right axis reads in that axis's format.** The tooltip,
  the screen-reader table, the live region and the data labels format a
  series with `axis: 'right'` through `y2Axis.format` or `formatter`, so a
  margin of 0.29 beside a revenue in dollars reads "29%" and not "$0.29".
  Without a format of its own the right axis is plain numbers, as its ticks
  are.
- **The breadcrumb survives `toolbar={false}`.** A drilled sunburst, tree
  map or pie with the toolbar off still shows its breadcrumb in a strip of
  its own; it used to have no way back up.
- **Chart axis model.** `xAxis`, `yAxis` and `y2Axis` on a spec take
  `min`, `max`, `nice`, `tickCount`, `tickInterval`, `format` or a
  `formatter`, `title`, `gridLines`, `labelRotation`, `reversed` and, for
  the x axis, `type: 'number'` for a numeric axis that spreads categories by
  value. `referenceBands` shade a range on either axis, `referenceLines` can
  be vertical, `title` / `subtitle` / `caption` frame the chart. Series
  gained `marker` shapes and per-point `markers` / `colors`, `strokeWidth`,
  `dash`, `opacity`, `gradient`, `step` lines, `connectNulls` and a
  `nullAs` policy; `dataLabels` takes a placement, a formatter and overlap
  hiding; the component takes a `tooltip` snippet, `tooltipFormat`,
  `tooltipMode: 'single'`, a `legend` side and a `legendItem` snippet, and
  `autosize`. `rowsToChartSpec` reduces with `min`, `max`, `median`,
  `first`, `last`, `countDistinct` and `pN` and buckets a date dimension by
  `day` / `week` / `month` / `quarter` / `year`.
- **Decimation for long series.** `decimate: 'auto'` (the default) thins a
  line or area with more points than pixels through LTTB, which keeps the
  shape; `{ method: 'minmax' }` keeps every spike. Zoom is applied first, so
  zooming into 300 of 100,000 points shows all 300. `lttb`, `minMaxIndices`,
  `decimateSpec` and `pickCategories` are exported.
- **Thirteen more chart types**: `histogram` (with `binValues` and
  `rowsToHistogramSpec`), `range-bar`, `range-area`, `lollipop`,
  `dumbbell`, `pareto` (`paretoSpec`), `stream` (`stackOffset: 'wiggle'` or
  `'silhouette'`), `sunburst`, `radial-bar`, `radial-column`,
  `nightingale`, `chord` and `bullet`; plus hollow and Heikin-Ashi candles
  (`candleStyle`) and pyramid / cone funnels (`funnelShape`). All of them are
  in the grid panel's picker, gated on what the current columns can feed.
- **Zoom, pan and presets.** `zoomable` takes an object: `wheel` (`true` or
  `'modifier'` for Ctrl + wheel), `pinch`, `pan` (`'shift'`, `'mode'` or
  both) and `axis` (`'x'`, `'y'`, `'xy'`). The window is a bindable
  `zoom` prop of category indices with `zoomTo` / `resetZoom` on the
  component and an `onZoom` callback; `rangePresets` puts 1W / 1M / 3M / 6M /
  YTD / 1Y / All in the toolbar on a time axis.
- **Synchronized charts.** Charts with the same `syncGroup` share their
  crosshair and zoom window, matched by label and then by date. The grid
  panel's `syncTabs` keeps one window across its chart tabs.
- **Context menu, animation, drilldown, selection, keyboard.** `contextMenu`
  (built-in export / zoom / series items, your own `MenuItem`s, or a function
  of the clicked point; Shift + F10 opens it), `animate` (a data-update tween
  and `'fade'` / `'grow'` / `'wipe'` enter effects, off under reduced
  motion), `drillable` + `drillPath` for tree maps and sunbursts with a
  breadcrumb, `selectable` + `selected` + `onSelectionChange` for point
  selection with dimming, Up / Down stepping through series with a polite live
  region (`announce`).
- **Financial toolkit.** `bollingerBands`, `rsi`, `macd`, `vwap`, `atr`,
  `stochastic`, `wma` and `obv`, NaN-padded like the moving averages;
  `'wma:N'`, `'bb:N:K'` (a shaded band) and `'vwap'` overlays;
  `indicatorPane` and `SvChartPanes`, which stacks indicator panes under a
  price chart with one x axis, one gutter and one crosshair; `rowsToOhlcSpec`
  and `resampleOhlc` (daily bars to weeks / months); `lastPriceLine`;
  annotation `shape` (`'flag'`, `'pin'`, `'square'`) with a tooltip
  `text`; `volumes` on a series.
- **Drawing tools.** `drawable` puts trend line, horizontal ray, Fibonacci
  retracement, rectangle, arrow and note tools in the toolbar; the drawings
  are data points (`spec.drawings`, `onDrawingsChange`) so they survive a
  zoom, a resize or new data. A selected drawing has draggable handles and
  Delete removes it.
- **PDF and print** with no PDF library: `chartToPdfBlob`, `downloadChartPdf`
  (a one-page A4 or Letter PDF with the chart as a JPEG and the titles as
  text) and `printChart`, in the toolbar, the context menu and the panel's
  export menu.
- **Chart builder in the grid panel.** The Build button opens a modal with a
  type gallery (a live thumbnail per type), the data pickers and a Format tab
  (titles, legend and label placement, axis title / min / max / format / grid
  lines, per-series colour / type / axis / marker / width). The format is
  `ChartFormatState` on the chart tab, applied by `applyChartFormat` to every
  derived spec, saved with the view and reachable through
  `configureChart({ format })`. A link toggle unlinks a chart from the grid
  (`configureChart({ frozen: true })`) so it keeps its data while you filter.
  `charting.onChartCreated` / `onChartChanged` report the panel's lifecycle;
  `charting` also takes `zoom`, `rangePresets`, `syncGroup`, `syncTabs`,
  `contextMenu` and `animate`.
- **Candlesticks from the grid panel.** Pick Candlestick or OHLC bars and the
  panel finds the Date, Open, High, Low, Close and Volume columns by name;
  Indicators chips add panes and overlays; `configureChart({ ohlc,
  indicators })` and the AI chart plan reach the same thing.
- **A scatter series' `overlay` is a regression of y on x.** Until now the
  scatter layout ignored `overlay` (the fits ran on the index, which a
  scatter has no use for). The regressions (`linearFit`, `polynomialFit`,
  `exponentialFit`, `logarithmicFit`, `powerFit`) take an optional `xs`
  and return `predict(x)`; `regressionFit(values, overlay, xs)` names one by
  its overlay string; a scatter series with `overlay` gets the curve drawn
  across the plot (sampled evenly in log space on a log axis) and its
  equation and R-squared in the point tooltip.
- **Chart gallery: fourteen full-size demos, one per family, and a docs page
  for them.** Bars, lines, areas, pie / donut / sunburst, scatter and bubble,
  combination, histogram and box plot, heat map and calendar, radar and
  radial, tree map and sunburst, sankey and chord, waterfall / funnel /
  pareto, gauges and bullets, and an annotated chart (demos 438 to 451),
  each with its own data and the switches that family needs, embedded on
  `help/charts/gallery` and the type pages.
- **Grid chart panel: a deeper Format tab, one set of pickers, a
  localized panel and saved charts.** The builder's Format tab adds series
  labels, the crosshair's axis pills, a compact rule below a width
  (`compactBelow`, through `CHART_RESPONSIVE_PRESETS.compact`), a stack
  group per bar or area series and the chart's font, size, background and
  text colour (`ChartFormatState.seriesLabels` / `crosshairLabels` /
  `compactBelow` / `series[].stack` / `style`). The panel's pickers and the
  builder's Data tab are one component (`SvGridChartPickers`), so the two
  cannot disagree about what a type needs. Every string the panel and the
  builder show is a `chart*` key on `localization.text`
  (`GridChartPanelMessages`, loaded with the panel; `GridMessages` is now
  the chrome map and the panel map together). `api.saveChart(name)`,
  `applySavedChart`, `removeSavedChart`, `getSavedCharts` and
  `configureChart({ saved })` keep a tab's whole configuration under a name;
  the panel has a popover for them and `getState()` carries `savedCharts`
  when there are any.
- **Chart diagnostics, a plain-language description, live feeds and a JSON
  schema.** `validateChartSpec` returns what is off about a spec (unknown
  keys with the nearest name, an unknown type, a series short of the
  categories, a log axis at zero, an overlay the engine does not read, an
  anchor naming no category, and more); `SvChart` logs the findings once per
  spec in development, `aiChart` attaches the errors to its plan, and the
  MCP server's `svgrid_check_code` applies the rules to a static spec
  literal with a rename for a misspelt key. `chartSummary` reads a chart in
  a sentence (trend, extremes, shares, correlation, last close) and
  `SvChart` hands it to assistive technology as `aria-description` and the
  table caption (`describe`), the context menu and the panel copy it, and
  `aiExplainChart` grounds an Explain button on it. `appendPoints` builds
  the next spec of a feed with every per-category array kept in step and a
  rolling window, and `live` on the chart skips the tween and enter effect.
  `docs/schemas/chart-spec.json` is generated from the types, served at
  svgrid.com/schemas and by `svgrid_get`, and a test keeps it equal to the
  validator's lists.
- **Series and interaction depth.** Areas join `stack` groups like bars
  (`stacked100` and `stackOffset` run per pile); a numeric x axis takes
  `scale: 'log'` (even decades, 2 / 5 minors, non-positive categories
  dropped, decimation in log positions); regression overlays `poly:N`,
  `exp`, `log` and `power` next to `linear`, each carrying `r2` and
  `equation` on the overlay line and read in the tooltip, with
  `linearFit` / `polynomialFit` / `exponentialFit` / `logarithmicFit` /
  `powerFit` / `rSquared` / `computeOverlayFit` / `overlayName` exported
  and `charting.trend` accepting the new names; hovering a mark dims the
  other series (`hoverHighlight`, on by default, snapping within 18px) and
  `onHover` reports the point once per change; `tooltipPosition` parks the
  tooltip in a plot corner and `tooltipSticky` pins it on a click; data
  labels take `rotation` and `connector` (pushed clear of a collision with
  a leader line); `spec.style` sets a chart's font, size, background and
  text / grid colours over the tokens (`chartStyleVars`), honoured by the
  exports.
- **Accessibility pass on the chart.** Every non-cartesian family (pie,
  sunburst and the radial charts, heat map, calendar, tree map, funnel,
  sankey nodes and links, radar, scatter) is one Tab stop with a roving
  focus: arrows walk the marks (a heat map by row and column, a calendar by
  day and week), Home / End / PageUp / PageDown jump, the focused mark
  raises its tooltip, Enter / Space select or drill, and every mark is named
  and has a focus ring. Zoom from the keyboard: `+` / `-` / `0` on a
  focused category and Shift + arrows to pan, and the brush is a `slider`
  (arrows pan and resize, Home / End, `0`). The toolbar is a `toolbar`, the
  tooltip a `tooltip`, decorative icons are hidden from the tree. Forced
  colors (Windows High Contrast) keep the data colours and repaint the
  chrome with the system palette. `localeText` on `SvChart` (and
  `charting.localeText` for the grid panel) translates every string the
  chart renders itself, with `ChartMessages`, `defaultChartMessages`,
  `resolveChartMessages` and `chartMessage` exported. A new
  `tests/e2e/chart-a11y.spec.ts` runs axe-core against the rendered chart
  on three demos and drives the keyboard model in a real browser.
- **Stack groups, series labels, responsive rules, pie callouts.** `stack`
  on a bar series names the pile it joins, so plan and actual stack side by
  side in each category and the axis fits the tallest stack; `seriesLabels`
  names each line at its last point in a reserved gutter, pushed apart where
  lines end together; `responsive` patches the spec by the rendered size
  (axes merge one level deep, a rule's `legend` moves or hides the
  component's legend; `resolveResponsive` and `matchResponsiveRules` are
  exported); `dataLabels: { placement: 'outside' }` on a pie draws callout
  labels with leaders instead of percentages, and a spec can carry its own
  `dataLabels`; `visible: false` starts a series hidden with its legend chip
  dimmed; the crosshair reads off the axes with a category pill and a value
  pill (`crosshairLabels={false}` turns them off).
- **`moveCells` - drag a selected range to move or copy it.** Grab a selected
  range by its border and drop it somewhere else. Move by default, copy with
  Ctrl / Cmd, and the modifier is read at DROP time so it can be pressed or
  released mid-drag. On whenever cell selection is on; `moveCells={false}`
  opts out. A drop is refused outright - nothing changes - when it would land
  off-grid or when any source or destination cell is read-only, rather than
  moving the part that fits and silently dropping the rest.
- **`selectionBar` - a floating bar over the grid while rows are selected**,
  showing the count and the actions that apply to the whole selection. `true`
  gives the count and a Clear button; an array is shorthand for `{ actions }`;
  the object form also sets `position` (`'bottom'` default, or `'top'`),
  `maxVisible` and `hideClear`. The prop and its types are free; the bar
  itself is an Enterprise renderer, and without it the grid shows a short upsell
  in its place, the same way the scheduler and board views do.
- **Edge auto-scroll for every drag that extends a rectangle** - the fill
  handle, the range move, and plain drag-select. All three were previously
  capped at whatever was already on screen when the drag began, which on a grid
  built for 100k rows meant the gesture mostly did not work. One shared rAF loop
  scrolls the container when the pointer is inside a 40px edge band, on a linear
  ramp to 20px/frame, in both axes. It keeps scrolling with the pointer parked
  still, which is the whole point of holding at an edge.
- **Row and column resizing, both opt-in** (`rowResize`, `columnResize`).
  `columnResize` gives every header a drag handle: drag the edge, double-click
  it to size the column to its content, or focus it and use Left/Right (Shift
  for a 1px step). `rowResize` does the same vertically and brings the
  row-header column with it, since that is where the grip belongs; the grid
  stores the heights itself, so neither needs a function-valued `rowHeight`.
  Both load their code on demand, so a grid that leaves them off downloads
  neither.
- **`ColumnDef.resizable`** - per-column opt-out, consulted only when the grid
  has `columnResize` on. `resizable: false` removes that column's handle
  entirely, so the drag, the arrow keys and double-click-to-autosize all go with
  it, and the column menu drops its Autosize item. For the columns whose width
  is part of the layout: a row-number gutter, a checkbox column, a fixed icon
  column. Programmatic sizing (`api.setColumnWidth`, `api.autosizeColumn`,
  `fitColumns`) still applies.
- **`SvGridViewState` is exported.** It is the return type of the public
  `api.getState()`, so writing a typed "named views" feature previously meant
  either re-declaring the shape or reaching into an internal path.
- **Form layer depth in `SvForm` / `createForm`.** Schema-driven forms gained:
  conditional / dependent fields (`visible` and `disabled` accept a
  `(values) => boolean` predicate; hidden fields drop out of validation and the
  submit payload), grouped **sections** and a multi-step **wizard** (`stepper`,
  with per-step validation gating), repeatable **field arrays**
  (`type: 'array'` with `itemFields`, plus `addItem` / `removeItem` / `moveItem`),
  **async validation** (debounced, stale-response-guarded, per-field
  `validating` state), **dirty tracking + `reset()`**, and **submit states**
  (`isSubmitting`, an async `onSubmit`, and `setErrors()` for server-side field
  errors). New demos: dynamic form, wizard, and field array.
- **Public headless cores for the menu / select family** (`createMenu`,
  `createPopoverSelect`, shared `list-nav`), so the popup pickers can be driven
  headlessly and composed into custom UI.
- **`color` on `ListOption`** - render a small color swatch before the label in
  `SvListBox` and `SvDropDownList`.
- **`block` on `SvDateTimePicker`** - stretch the field to fill its container
  (100% width), so it fills a grid cell when used as an editor.
- **`onClosed` on `SvDrawer`** - fires after the exit animation ends and the
  drawer leaves the DOM.
- **`loading` on `SvField`**, and **`locked`** on `SvDockLayout` /
  `SvDockManager`.
- **`summary` on `<SvGrid>`** - shortcut alias for `enableRowSummaries`,
  which turns on the footer row that aggregates every filtered row. It wins
  when both are set, the same precedence `selectable` has over
  `enableCellSelection`.
- **`summary` on a column** - choose that column's footer aggregate
  (`'sum'`, `'avg'`, `'min'`, `'max'`, `'count'`, `'countDistinct'`,
  `'extent'`, `'first'`, or a custom function), or `false` to leave the cell
  blank. Without it a column keeps the old default: sum a numeric column,
  `Count: N` otherwise.
- **Development-time configuration checks.** The grid used to fail silently on
  the most common mistakes - a misspelled `field` rendered a column of blank
  cells and printed nothing. It now warns once per problem, in dev builds only:

  - a column `field`, `groupBy` entry, `treeData.parentField` / `idField` or
    `treeData.column` that does not exist (with a "did you mean" for near misses),
  - two columns resolving to the same id,
  - `pageSize` set when pagination was never turned on,
  - a column marked `sortable` while sorting is not enabled,
  - `initialColumnPinning` while column virtualization is on, which silently
    prevents the columns from sticking,
  - `externalPagination` without `rowCount`, `externalSort` without
    `onSortingChange`, and `externalFilter` without `onFiltersChange`.

  The checks live in a lazy chunk behind a dev-only branch, so a production
  build never loads them and the base bundle is unchanged.

#### Changed

- **`showColumnFilters` no longer puts an input in the header.** Set to
  `true`, it also drew a plain "Filter" text box in every header cell,
  which with `showFilterRow` made two filter inputs per column. It now
  only turns on the column menu's filter section, as documented. For
  always-visible inputs use the filter row: `showFilterRow` or
  `filterMode="row"`.
- **The find bar loads on the first Ctrl+F.** It is its own chunk now, so a
  grid nobody searches does not carry it; the first open shows the bar once
  the chunk has loaded.
- **`alignedGridGroup` loads its module on demand.** The shared group that
  mirrors horizontal scroll and column widths between grids is now a lazy
  chunk, fetched by the first grid that sets the prop, the way managed row
  drag is. A grid outside a group no longer carries it, which kept the base
  bundle under its 100 KB budget after this release's scroll and mount
  changes. Mirroring starts once the chunk has loaded, a frame on a warm
  cache.
- **BREAKING: column resizing is now off by default.** Every column used to have
  a drag handle unconditionally - there was no prop, no per-column option and no
  way to turn it off, so a `width` you set was only ever a starting value a user
  could drag away. Set `columnResize` to get the handles back; the 241 demos in
  this repo that want them now say so. Sorting and filtering have always been
  opt-in behind `sortable` / `filterable`, and resizing was the odd one out.
- **BREAKING: the footer summary row is now off by default.**
  `enableRowSummaries` used to default to `true`, so a plain
  `<SvGrid {data} {columns} />` grew an aggregate footer nobody asked for and
  every caller that did not want one had to opt out - 375 call sites in this
  repo passed `enableRowSummaries={false}` against 6 that opted in, and the
  API reference already documented the default as `false`. If you were
  relying on the old behaviour, add `summary` (or `enableRowSummaries`).
- **Ember is now the default theme preset** (`defaultThemePreset` in
  `@svgrid/grid/themes`). It is what the demo gallery and svgrid.com open on, so
  a scaffolded or Studio-generated app now looks like the demos unless you pick
  a preset. Previously the default was Tailwind.
- **Popup editors keep themselves on screen.** `SvAutoComplete`, `SvComboBox`,
  `SvDropDownList` and the date pickers now measure the space to the viewport
  edge: the panel flips up when there is not enough room below and clamps its
  `max-height` to the available height, so a picker opened near the bottom of the
  window no longer spills off screen.
- **Dock manager pop-out to a new window is now off by default**
  (`allowPopout={false}`); opt in explicitly. Added a dedicated pop-out demo.

#### Fixed

- **`fitColumns` with `responsive` fills the row when a `hideBelow` column is hidden.** The fit still
  counted the hidden column's width, so the shown columns stopped short and left a blank strip that
  wide at the right edge.
- **Cut clears only what reached the clipboard.** Ctrl+X, the Cut menu item and the cut command
  cleared the cells at once, before the clipboard write had finished, so a write the browser refused
  (a page without focus, a denied permission) lost the values. The clear now waits for the write, and
  runs only if the text landed and the selection has not moved meanwhile.
  `copySelectionToClipboard()` returns a promise of whether the text landed.
- **The pinned-column divider in a contrast theme.** Forced colors keep a fill's alpha, so the
  `pinSplitter` divider stayed a faint line and vanished on `Canvas`. It is drawn in `CanvasText`,
  and in `Highlight` under the pointer, with focus and while dragged.
- **Chart panel: an Export item that is off looks off.** The PDF item that cannot draw the chart's
  text said why but looked like the items that work; it is dimmed as an off CSV item is.
- **Scheduler model: a day the clocks change is drawn by the clock.** `layoutDayEvents` placed an
  event by the real minutes since midnight, so on a 25-hour day every event sat an hour below the
  row its time is labelled with, and on a 23-hour day an hour above; an event in the last hour of a
  band fell out of it. It now counts wall-clock minutes (`wallMinutes`, `atWallMinute`, both new
  exports). On a week that starts on a 23-hour Sunday, `monthWeekSegments` put Monday's bars under
  Sunday. `timelineAxis` for `timelineDay` ends the band at its hour by the clock and names each
  real hour by its clock (a 25-hour day shows 1 AM twice), where it left a gap or an overlap.
- **A menu item that is off keeps the arrow keys.** `menuFocus`, `createMenu` (`SvMenu`,
  `SvContextMenu`, `SvMenuList`) and the column and context menus mark it `aria-disabled` and keep
  it in the arrow-key and first-letter order, as the ARIA menu pattern does, so a screen reader
  hears it and why it is off. Its click does nothing. Before, the arrows skipped it.
- **Forced colors: the header checkbox of a part-selected grid keeps its dash.** The dash was a
  fill, which a contrast theme removes, so the box read as empty.
- **A chart's PDF refusal is seen at the toolbar and in the grid's chart panel.** For a title the
  PDF's font cannot draw, the toolbar's PDF button did nothing on screen: the reason went to the
  screen reader only. It is now marked off (`aria-disabled`, the reason as its tooltip) once it is
  pointed at or focused, and a press shows the reason in the button. The chart panel's Export menu
  wrote no file and said nothing; its PDF item now reads the reason and is off.
- **The chart panel's Export menu takes the keyboard.** Arrow keys, Home, End and first letters move
  in it, focus goes to its first item when it opens and back to Export when it closes (it fell to the
  page). Its CSV item, when the chart has no table of values, stays focusable and says why.
- **Rich text renders under Trusted Types.** `SvRichCell`, `SvRichText` and the sanitizer passed plain
  strings to `DOMParser`, `{@html}` and `innerHTML`, so a page with `require-trusted-types-for 'script'`
  threw and drew nothing. They now go through one policy, `svgrid`, made only where the browser has
  `trustedTypes`. A CSP with a policy list needs `trusted-types svgrid svelte-trusted-html`
  ([SECURITY.md](https://github.com/sv-grid/sv-grid/blob/main/SECURITY.md#trusted-types)).
- **Chart Print runs under Trusted Types.** `printChart` built its window with `document.write`; it
  now builds it node by node and draws the chart as a `data:` image.
- **A chart PDF never writes `?` for a letter.** Its text is in the PDF's built-in Helvetica, which
  has Western European letters only. The euro sign, curly quotes and dashes now come out right. A
  title, subtitle or caption with other letters (Cyrillic, Greek, CJK, Hebrew, emoji) is refused: the
  menu's PDF item says which text and points to PNG or SVG, and `chartToPdfBlob` and `buildChartPdf`
  throw a `ChartPdfTextError` naming it. `pdfUndrawable()` tells beforehand.

- **A block cache that refreshes a block still being read frees that read's slot.** `refresh()`,
  `applyRows` and an insert or remove gave up a read in flight without counting it as done, so
  `loading` stayed true for good, and with `maxConcurrentRequests` reached no block loaded again.

- **The "Could not load these rows." line of a failed run sits on the first row wholly on screen.**
  It sat on the first rendered row, which overscan puts above the screen, so a person scrolled
  into a failed block saw a tinted band and no words.

- **An edit deep in a server row model no longer walks the rows.** `find`, `findIndex`, `some` and `indexOf` on windowed
  data read only what is loaded, a paste, clear or fill over rows held in place copies only those, and `cellEdited`
  hands over `rowId`.

- **A filter's count is said once.** Opening or closing a group under a filter no longer repeats
  it, and a closed group counts the records the filter keeps: it read "28 of 30" with 24 shown.
- **`createFocusTrap` and `menuFocus` never drop focus to the body.** An opener that left the page,
  or turned disabled or hidden, hands focus to what held it. A dialog opened from a menu item goes
  back to what the menu went back to. A tooltip closes with Escape.

- **CSV: a cell that starts with a line feed is guarded.** Tab and carriage return were,
  and a spreadsheet reads `\n=1+1` as a formula too.
- **A commit keeps the keyboard in the grid.** A pick in a select or dropdown cell, or
  Escape on a multi select, left focus on the body and arrows dead. Tab in a dropdown
  cell left the grid; it now commits and moves on, as the docs say.
- **Group rows follow their state.** `aria-expanded`, the chevron and the button's
  label went stale until the row was drawn again.
- **A grouped grid behaves as a treegrid.** Left and Right close and open a group, Enter
  and Space toggle it, and rows of records carry `aria-level`. Enter on a group's row
  used to move down.
- **The filter count counts records.** "28 of 34 rows match" included group headers.
- **A menu scrolls to the item the keyboard moved to.**
- **A first click on the cell seeded on mount selects it.** It used to open the editor.
- **Moving a column by hand is an undo step**, as a resize is. The api's setter records none.
- **"Add condition" in the filter menu keeps focus**, and closing that menu goes back
  to the funnel.

- **Keyboard and focus.** The Menu key and Shift+F10 open the context menu of the
  active cell. The column and context menus take focus, walk with the arrows, Home,
  End and first letters, and give focus back. `menuFocus` gives a menu of your own
  the same. The find bar takes focus when opened from a focused control.
- **Focus stays in view.** Moving the active cell, or tabbing to a header control,
  stops clear of pinned columns on either side and above a sticky footer.
- **Right to left.** The left and right arrows go where they point, horizontal
  scrolling to the active cell works, and the pin splitter follows the pinned columns.
- **A grouped grid is a `treegrid`**, and a group row's cell is the active descendant.
- **Menus, filter panel and find bar translate** through `localization.text`, as do
  the row number, select row, column menu, filter and resize names. `setModalCloseLabel`
  names the x on every `SvModal`.
- **Ember**'s muted text reaches 4.5:1 on a pinned header. The column menu button is
  24 px.
- **IME.** A key of a composition no longer moves the cell or commits the editor.
- **Smaller base bundle.** What a fill or a range move writes when the drag ends loads
  with the drag (`range-commit.ts`).
- **`SvRichText` sanitizes its value.** It wrote `value` to `innerHTML`, so a stored string ran
  its handlers. `value` now goes through `sanitizeHtml` on the way in and out, and `sanitizeHtml`
  keeps a text alignment, rebuilt from scratch, so the alignment buttons survive it.
- **CSV injection through a list.** `escapeFormulas` guarded strings only, so a multi-select value
  `=1+1` written with `rawValues: true` reached the file as a formula. It now guards everything
  but numbers.
- **Open groups stay open.** In a grid with no `expanded` prop, a change to any other
  prop, such as new `data`, folded every group the person had opened.
- **A row model that groups on the server is not grouped again in the page.**
  With `rowModel` from `createServerRowModel` and a grouping in the grid's
  state (a view, `groupBy`), the grid bucketed the rows it had loaded under
  its own group rows. A model with `group` accessors now hands over its rows
  as they are; the grouping state stays for whatever shows it.

- **A `rowModel` set after mount still sorts and filters on the server.**
  The grid read `externalSort` and `externalFilter` once, at mount. A model
  handed over later (one loaded on demand) was sorted and filtered again in
  the page, placeholders included: with a million rows behind it, a view
  filter held the page for seconds. The grid now follows the model's
  `setSort` and `setFilter` whenever it arrives.

- **`SvRichText` lists had no bullets or numbers in apps with a CSS reset.**
  Tailwind's preflight sets `list-style: none` on every list, so a bulleted
  list in the editor read as plain lines. The editor now sets `disc` and
  `decimal` itself.

- **A custom column header did not sort when its label was clicked, and did
  not see the sort change.** The header wrapper is itself `role="button"`, so
  the check meant to skip clicks on buttons inside a custom header matched the
  wrapper and skipped every click on the header's own text; only a click on
  empty header background sorted. The `header:` callback also ran once, so
  `ctx.column.getIsSorted()` kept its first value. Both are fixed: a click on
  the label sorts, a button inside the header still gets its own click, and
  the callback runs again when the column's sort changes.
- **Grouping five million rows ran out of memory.** Every group row carried
  ten closures and a Map of its ancestors' values, and a million rows grouped
  five deep make about a million group rows. Group rows now share their
  methods and keep their state in one object. Grouping 1,000,000 rows that
  way adds about 500 MB instead of 785 MB, and 5,000,000 rows group in 56 s
  on a laptop within Chrome's default heap.
- **Every selection change serialized the whole selection.** Deciding
  whether to call `onRowSelectionChange` ran `JSON.stringify` over the
  selection state; selecting half of a 5,000,000-row grid built a string of
  tens of megabytes per change. The two states are now compared key by key.
- **A mount built rows nobody could see, and laid the grid out five
  times.** The first paint now draws the rows on screen and at most two
  overscan rows, and the rest of `overscan` follows a frame after that paint:
  a 520 px grid built 26 rows to show 14. Reading the scroll position of the
  container the grid had just created, and each scrollbar measuring its
  track on connect and on every attribute change, forced four layouts of the
  half-built grid before it painted. The position is now confirmed on the
  next frame and the track is measured by the scrollbar's resize observer;
  the one forced layout left is the container size the windows need.
- **The scrollbar thumb trailed the rows by a frame.** The custom scrollbar
  read the scroll position on the frame after the scroll flush, so the thumb
  moved one frame late and each scroll step paid a second style pass and
  paint for it. The flush now hands the scrollbar the position it already
  has, and the scrollbar keeps its measured track instead of measuring it
  inside the flush.
- **A vertical scroll frame repainted every rendered row.** Body rows were
  not positioned, so on any frame that moved or rewrote a row Chrome painted
  every rendered row again cell by cell. Flex-layout body rows are now
  `position: relative` (no z-index, no clip), which lets the browser reuse an
  unchanged row's paint whole. In six interleaved rounds of the 100,000-row
  browser bench, a 60 px scroll step went from 4.05 to 3.68 ms of
  main-thread work (median). Sticky frozen and group rows keep
  `position: sticky`.
- **Expanding one group re-grouped every row.** A toggle re-ran the row
  pipeline, and the grouping stage bucketed all rows again although only the
  expansion had changed. It now keeps its groups while its input rows,
  grouping and columns are the same. On a 100,000-row grid grouped by five
  columns, one expand went from 521 to 98 ms, and expanding or collapsing
  every group from 473 to 82 ms.
- **A calendar date with `timeZone: 'UTC'` showed the day before.** A
  bare date string such as `'2026-10-07'` is read as local midnight, so a
  date `format` whose `options` carried `timeZone: 'UTC'` (the usual fix
  from when such strings were read as UTC) showed October 6th anywhere east
  of UTC. A calendar date has no zone: `timeZone` is now ignored for one,
  on screen and in exports.
- **A cell note's corner marker sat at the grid's corner.** The marker is
  positioned against its cell, but a cell with a note was not positioned, so
  it anchored to the grid. A cell with a note is now a positioning context,
  like the active cell.
- **A sort or filter kept every column's value on every row.** Reading one
  column built and cached an array of all of a row's values, so sorting a
  1,000,000-row grid by one column left 1,000,000 of them behind. A plain
  `field` column is now read from the data; a computed (`fieldFn`) column
  still builds the array. The heap a sorted and filtered 1,000,000 x 9 grid
  adds went from 196 MB to 128 MB in the browser harness.
- **`applyTransaction({ remove })` scanned the data once per row object.**
  Removing 10,000 row objects from 1,000,000 rows took about 1.8 s to find
  them; past eight objects the transaction now builds one identity map.
- **Group footer and grand-total rows drew checkboxes.** With
  `showRowSelection`, each totals row had a row-selection checkbox, and
  ticking it selected the synthetic row. A checkbox column with no `aggregate`
  showed a checkbox too, holding a leaf's value carried over from the group
  row. Totals rows keep the selection cell for alignment but leave it empty,
  and a boolean column without an aggregate renders nothing there.
- **Toggling a checkbox cell did not fire `onCellValueChange`.** A click or
  Space on a checkbox cell wrote the row and stopped, so an app that saves
  edits from `onCellValueChange` lost every checkbox change, and Ctrl+Z could
  not take one back. The toggle now takes the inline editor's commit path:
  one undo step, then `onCellValueChange` with the old and new value and the
  row's position in `data`.

- **Arrow keys lagged whenever the active cell had to scroll.** On the
  10,000 x 53 large-dataset demo one ArrowDown at the bottom of the viewport
  cost about 37 ms of main-thread work and painted over two frames; it is now
  about 8 ms and paints once. Five things added up. Every rendered row was
  measured with `getBoundingClientRect` on each scroll tick, on a grid that
  had no `autoRowHeight` to use the number for, which forced a table layout
  per row (about 30 per key press). The scroll geometry the custom scrollbar
  reads was pulled inside a derived at the start of the flush, forcing a
  second full table layout that the row writes then invalidated. The
  virtualizer keyed rows by their position in the window, so a one-row
  scroll rewrote all ~30 rows x every rendered column; rows are now keyed
  `index mod windowLength`, so the rows that stay keep their `<tr>` untouched
  and the one that entered is moved with a single `insertBefore`. The row
  window only updated after the browser's `scroll` event and a
  `requestAnimationFrame`, a frame after the key press; keyboard navigation
  now syncs the virtualizer inline, since it knows where it scrolled. And
  each cell carried three selection-dependent deriveds plus the fill handle's
  `{#if}`, re-marked on every move; they are one `{@const}` now, `null` for
  a plain cell. Also closed on the way: `key in editedCellValues` on a deep
  `$state` proxy created a signal per rendered cell that never went away, and
  the header checkbox's tri-state walked every row on each arrow key.

- **A heat map drew a series legend in colours its cells never use.** The
  ramp on the right is its key; the row of palette chips under it (and a
  calendar's) is gone.

- **A time axis put its ticks on nothing in particular.** `xType: 'time'`
  stepped a fixed 30 or 365 days from the Unix epoch, so a tick labelled
  "2025" stood weeks from New Year, a "Jun 25" tick sat mid-June, and a
  thirty-month axis carried two labels on a plot with room for eight. Ticks
  now land on calendar boundaries in UTC (days, Mondays, the first of a
  month, quarter or year, or every few years) at about one label per 90px,
  and each label is sized to the gap between ticks rather than the axis span,
  so a quarterly axis no longer reads "2024, 2024, 2024, 2025". The labels
  are read in UTC too: a local-time read of a 'YYYY-MM-DD' category in the
  Americas labelled every tick with the day before.
- **The tooltip echoed the ISO date.** On a time or ordinal-time axis the
  tooltip title, the crosshair pill and the live region wrote "2025-06-01";
  they write "Jun 2025" when every category is the first of a month, "2025"
  when every one is New Year, and "Jun 1, 2025" otherwise, through
  `xAxis.formatter` when one is set. A calendar cell names its day the same
  way. The category in `onHover`, `onSelect` and `selected` is unchanged.
- **The screen-reader table and the CSV read "NaN".** A NaN gap (the way a
  forecast series marks the months before it starts) wrote the word "NaN"
  into the hidden data table and the CSV export, and a `null` fell back to
  0, which told a screen reader the outage month had no sign-ups. Both are
  empty cells now.
- **"Double-click again to clear" left a legend chip isolated and hidden.**
  A double-click arrives as click, click, dblclick: with a chip isolated the
  first click cleared the isolation, the second hid the chip and the dblclick
  isolated it again. A click that clears an isolation is remembered for a
  moment, and the double-click that follows it on the same chip clears; on
  another chip it moves the isolation there.
- **A radar ignored `yAxis.min` / `max`.** The rim was always the data
  maximum, so scores out of 100 filled the dial to whatever the best score
  was and two radars could not be compared. The rim honours a pinned axis,
  a value past it sits on it, and a pinned minimum is the centre.
- **A pie sized its gutters by the widest label on either side.** Small
  slices with long names on the left kept the same room on the right for a
  "Chrome 62%", and the pie drew at half the radius the pane had. The
  gutters are per side, the pie sits centred in what they leave, the floor
  radius is a quarter of the short side, and each side truncates to its own
  room.
- **A waterfall tooltip read "$0" on a total.** A total bar holds 0 in the
  data and its running sum in the geometry; the tooltip and the
  screen-reader table now read the drawn value. Its x labels also tilt by
  the same fit rule as a bar chart's, with the angle the renderer needs:
  they were flagged as rotated with no angle and drew truncated instead.
- **Histogram edges read "1.3k, 1.3k".** Bin edges are written at the
  precision their width needs (whole numbers with separators for a 44ms
  bin, two decimals for a 0.2 bin) rather than in the compact tick form that
  gave two neighbouring edges one label.
- **A heat map ignored `dataLabels` in the spec.** The cell label read the
  component prop alone, so `dataLabels: { show: true }` in the spec drew
  nothing. Colour legends on heat maps and calendars also round their steps
  to the precision the range earns ("20, 94, 167", not "20, 93.5, 167").
- **The range area read as three lines.** Its band filled at the wash an
  area under a line gets, with both edges at full stroke. The band is the
  mark: it fills at 0.35 and its edges are thin.
- **Annotate mode pinned a tooltip instead of a note** when `tooltipSticky`
  was on too; the annotate click now owns the click.
- **Drawings on a time axis warned on every point.** The drawing tools write
  a timestamp for every pointer position, and the spec validator matched
  those against the category list. It skips the check on a time or number
  axis, as it already did for reference lines and annotations.
- **The panel's export menu and saved-charts dialog ignored Escape.** Both
  close on Escape and hand focus back to the button that opened them.
- **A gauge wrote "99.2 %".** A symbol unit (%, degrees) hugs the number; a
  word unit ("ms") keeps its space.
- **The right axis title was clipped.** Its glyphs point outward under the
  rotation and ran past the edge of the SVG.
- **Pie callout labels ran off the chart in a narrow pane.** The pie kept a
  fixed 34px margin for its outside labels whatever their length, so a
  "Samsung Internet 3%" in a 380px pane was clipped to "%" and "Cl". The
  radius now makes room for the widest label on each side, keeps at least a
  fifth of the short side, and hands the renderer a per-side character
  budget to truncate to when even that is not enough.
- **The brush strip inherited the chart's titles, axis labels and marks.**
  A title and subtitle took 45 of the strip's 88 pixels and the x labels
  another 30, leaving the mini-map a five-pixel smear under an empty band.
  The brush spec now mutes titles, axis titles and labels, reference lines
  and bands, annotations, drawings, series labels and data labels.
- **A category chart tilted its x labels by count, not by fit.** More than
  eight categories, or any label over nine characters, tilted every label
  to -40 degrees even on a thousand-pixel chart with room to spare. `auto`
  now tilts only when the widest label does not fit its slot.
- **A heat map wrote every column label whatever the cell width**, so
  twenty-four hours at 33px a cell read "00:0001:0002:00". The column
  labels thin out the way a bar chart's do.
- **A calendar labelled the padding days of the next year.** The grid pads
  the range to a full week, and a December ending on a Thursday picked up a
  "Jan" tick for the two padding days. Month labels stay inside the range.
- **A waterfall could not open on a value.** A total bar always read the
  running sum, so "Revenue 4300" marked as a total drew as zero and every
  bar after it hung below the axis. A total with a value now sets the sum;
  a total with 0 still reads it.
- **`rowsToChartSpec` with `topN` duplicated a category called "Other".**
  A real "Other" in the data came out beside the folded one, two categories
  with one name, which the renderer threw on as a duplicate key. The tail
  now folds into that category.
- **A pin annotation showed "O…" and nothing else.** The head held
  `truncate(label, 2)`, an initial plus an ellipsis, and no label was written
  beside it. The head carries the initial and the label sits beside the pin
  like a dot's does.
- **A chart's hidden data table took up to 17,000px of scrollable space.**
  The screen-reader table (one row per category, capped at 1,000) carried the
  visually-hidden recipe itself, but on a `<table>` `height: 1px` and
  `width: 1px` are minimums and `overflow: hidden` does not clip, so the
  table was invisible and as tall as its rows, and every scroll container
  around a chart (the demo pages first of all) scrolled on through that much
  empty space. The clip now sits on a wrapping div; the table keeps its id,
  which the svg still points at.
- **Two ARIA faults the axe audit found.** The chart's SVG was
  `role="img"`, whose children are presentational to assistive technology,
  so the focusable marks inside it (category zones, slices, a drawing) were
  a nested-interactive violation and could be skipped by a screen reader; an
  interactive chart is a labelled `group` now (a thumbnail with
  `interactive={false}` stays an image). Sankey links carried an
  `aria-label` with no role, which ARIA prohibits; they are named images in
  the focus order.
- **A tree map ignored `spec.tree`.** The field is documented as an alias of
  `treemap` and the sunburst honoured it; the tree map read only `treemap`.
- **An autosized chart with a side legend grew without end in a plain block.**
  `legend="left"` / `"right"` lays the chart out as a three-row grid, and a
  grid puts a gap between every track whether or not the toolbar and brush
  rows have anything in them. The autosize maths counted a gap only for the
  chrome that existed, so in a parent that does not pin the height, the host
  measured 8 or 16px taller than the plot it was told to fit, the plot grew
  into it, and the next measurement grew again - a few hundred pixels a
  second until the page ran out. Hiding the legend at runtime had the
  opposite fault: a dimension binding keeps its last value once its element
  is gone, so the vanished legend went on being subtracted and the plot
  ratcheted down to its 120px floor. Both fixed; a fixed-height parent hid
  them, which is why the docs' sizing example never showed either.
- **`block` did nothing on eight editors.** The prop is declared once in
  `SvEditorProps`, and its own doc comment describes the symptom: "in a form
  grid a row of inputs each stopping at a different width reads as broken".
  `SvDropDownList`, `SvComboBox`, `SvMultiSelect`, `SvTreeSelect`,
  `SvGridSelect`, `SvAutoComplete`, `SvTextArea` and `SvDateRangeInput`
  accepted it by type and ignored it, so they stopped at their own 200-280px
  default while the text inputs beside them filled the row. `<SvForm>` was
  also not passing it to seven of the controls it mounts - both halves had to be
  fixed for a form row to line up.
- **`cellDataType: 'dateString'` stored a timestamp after an edit.**
  Committing ran through the shared date coercion (`new Date(v).toISOString()`),
  so picking Christmas stored `2026-12-25T01:00:00.000Z` and the cell showed a
  timestamp beside neighbours showing plain dates - on a calendar day that
  depended on the user's timezone, since the conversion went through UTC. The
  picked date is now kept as the picked date.
- **The filter row mounted a native date input** while the cell editor mounted
  the grid's own picker, so one column looked like two different products
  depending on where you touched it. Both use the grid's picker now.
- **`editorType: 'number'` dropped the character you were typing.** The
  editor mounted `<input type="number">`, whose value sanitization reports
  `""` for anything not already a valid float - so `12.` read as empty, and
  typing `12.5` produced `125`. Same for a lone `-` and `1e`. It is a
  text input with `inputmode="decimal"` and a digit filter now; the trade is
  the native spinner.
- **Cell context menus and the comment editor floated at stale coordinates
  after a scroll.** Both are positioned at raw cursor coordinates and rendered
  `position: fixed`, but neither was in the scroll effect's gate, so they hung
  over unrelated cells. The comment editor SAVES on scroll rather than
  discarding - backdrop-click and Escape are the gestures that mean "throw this
  away"; a scroll is not, and must not destroy typed text.
- **The footer summary row server-rendered as empty cells.** The totals were
  assigned from an `$effect`, and effects never run during SSR - so the server
  emitted a summary row that took up space and drew its border but held no
  numbers. They appeared only after hydration (a visible pop-in), and never at
  all for a reader with JavaScript off. A grid under the aggregation cell
  limit now derives its totals synchronously, so they ship with the HTML; a
  very large grid keeps the rAF-deferred effect so it still paints before it
  totals. `pnpm ssr:check` asserts the real aggregate now.
- **The grid painted one unmeasured frame on every mount.** `hasMeasured`
  gates the custom scrollbars, the 16px scrollbar gutter on a trailing
  right-aligned column and the top pager (which carries a `border-top`), but
  it only flipped inside the `ResizeObserver` callback - and that callback is
  deliberately deferred by one `requestAnimationFrame`, so the browser was
  guaranteed to paint a frame with those missing and correct it on the next.
  On a first load that was the "flashing scrollbar"; in an app that recreates
  the grid per navigation (a `{#key}` around it, or a route that remounts) it
  showed up as the grid flashing on every sort / filter / page change, with a
  stray border line. The container is now measured synchronously in the mount
  effect - before the first paint - and the observer still handles later
  resizes. Covered by an e2e regression test, since jsdom has no layout to
  miss a paint with.
- **Pager page-size trigger rendered as a stock button until first click.** The
  closed trigger is a placeholder until the lazy dropdown chunk loads, but its
  box styling only existed in that chunk's scoped CSS, so server-rendered and
  freshly-mounted pagers showed a UA-bordered, left-hugging `<button>` inside the
  bordered box. The placeholder now gets the same rules from `SvGrid.css`.
- **Virtualized lists no longer flash blank on a fast scrollbar-thumb drag.**
  A fast drag can move the viewport into the windowed list's off-screen padding
  faster than JS can re-render the rows there; the padding now paints faint row
  skeletons, so `SvListBox` / `SvDropDownList` stay visually filled at any scroll
  speed. Also removed an app-wide `flushSync` from the scroll handler that could
  stall the very first scroll.
- **Dock manager auto-hide now shows every tab of a multi-tab leaf.** Sending a
  leaf with two or more tabs to auto-hide created a single edge tab; it now
  creates one edge tab per pane.
- **Ticking one row in a large grid took over a second.** Once any row was
  selected, every change walked all rows through the lazy row list to work out
  the header checkbox. At 1,000,000 rows (jsdom) one tick went from 1.3-1.8 s
  to 4-36 ms, and select-all from 4.2 s to 0.4 s.
- **Tab never left the grid.** Every Tab was consumed and the cursor clamped
  at the last cell, so no key moved focus out (WCAG 2.1.2). Tab on the last
  cell and Shift+Tab on the first now leave the grid.
- **No focus indicator when the grid is reached by Tab, or under forced
  colors.** The active-cell ring stayed hidden until a click, and Windows High
  Contrast removed it (it is a box-shadow). It now shows on keyboard focus, and
  forced colors get a `Highlight` outline.
- **The cell editor had no accessible name.** The text, number and multi-line
  editors are now labelled with their column's header.

#### Security

- **CSV / formula injection in exports.** `exportCsv`, `exportTsv` and the
  chart's CSV download wrote text such as `=HYPERLINK(...)` as is, which a
  spreadsheet runs as a formula. Text starting with `=`, `+`, `-`, `@`, a tab
  or a carriage return is now written with a leading `'`; numbers and signed
  numbers in text form (`-12.50`) are unchanged. `escapeFormulas: false` turns
  it off; `copyToClipboard` takes `escapeFormulas: true` to turn it on.

### @svgrid/enterprise

#### Added

- **SvGrid Base: Delete forever can be one transaction.** `transaction` next to `execute` on
  `createSqlDataSource`, `createBaseEndpoint` and `baseFromDatabase`, and `linkedFrom` on
  `createKitHandlers`, make it one server step. See Undo, trash and import for each driver.

- **SvGrid Base: Edit fields says what it sets off.** Past 10,000 records its question gives the
  number of automation runs the change can start, and "Also run automations" can be unticked.

- **SvGrid Base: a comment not sent stays with its record.** Stepping to another record no longer
  carries it into that record's box, and closing the record keeps it and says so.

- **SvGrid Base: `baseFromEndpoint` takes a live feed.** `realtime: (table, apply) => stop` is called per
  table and per junction table.

- **Gantt: `pickUpToMove` and `text`.** Keyboard moves in the scheduler's way, and every
  word of the view for a page in another language. Base uses both.

- **SvGrid Base: soft delete.** `softDelete: 'deleted_at'` on `createSqlDataSource` and
  `createSupabaseDataSource` marks a record instead of removing it. Reads, counts, groups,
  totals, lookups and rollups skip it, a restore clears the mark and rewrites nothing, and
  emptying the trash is the real delete. `createKitHandlers` takes `restore` and `purge`,
  inside the tenant's `scope`.
- **SvGrid Base: a view always gets its answer.** When a data source cannot run a
  filter, sort, group or total on a computed field, or fails on one, the page reads
  the table a block at a time, works the field out with the cells' code and serves
  the view by id, with the count in the tab bar. A record that changes is updated
  where it stands, and taking the sort or filter away stops the read. `computes` on
  `baseSource` says what the source can work out itself; a `queryRecords` backend
  needs `computes: () => true` to keep those requests in the database.
- **SvGrid Base: "+" opens a draft.** On a big table a new record is stored at its
  first value and not at the click, so one closed empty leaves nothing behind. It
  starts with the values of the view's filter, what the database fills in comes back
  into it, and one the database refuses keeps its values and tries again. "+" is in
  every view of records, and Ctrl+Z takes a stored record out again.
- **SvGrid Base: add a field from the header.** `columnAdder` is on by default for
  whoever may change the schema, and the "+" stays at the right edge of a wide
  table. `createSqlDataSource` with `schemaChanges` adds the column on Postgres,
  MySQL and SQLite, `addField` on `baseSource` does it on your own source, and a
  source that cannot shows the `ALTER TABLE` to run. A new field never takes over a
  column already in the table.
- **SvGrid Base: Undo keeps what it cannot write.** A record goes back with every column
  read, and a column the database generates is left to the database, on any engine.
- **SvGrid Base, in use.** A record's position is the view's own ("1 of 1,000,000"),
  and Next and Previous read past what is loaded. A click or Enter opens a Board card.
  Ctrl K works from anywhere on the page. A group of mixed ticks shows as mixed, group
  headers show what the cell shows, and a field deleted from a view's filter leaves it
  (undo brings the condition back). A record outside the view's filter says so.
- **SvGrid Base: select all means all.** On a big table the header checkbox selects
  every record of the view as a rule, and the count says so. The selection bar's
  Delete reads what the rule covers, asks with the exact number, and deletes in
  blocks with a Stop button. Up to 10,000 can be undone, in one write.
- **Block writes.** `ServerDataSource` gains optional `createRows` and `deleteRows`;
  `createSqlDataSource` and `createSupabaseDataSource` implement both.
- **`filterModel.searchIn`.** The fields a global search may look in. A base sets it
  so that a field hidden by a share or a permission cannot be probed by searching.
- **Server row model:** `pin` and `unpin` show a row above the list that no block
  holds, outside the count, and `leafTotal` gives a grouped view its true size.
- **Computed SQL:** dates, `MAX` and `MIN` on MySQL and SQLite, `FIND` on MySQL, and
  `ROUND` and `INT` on SQLite.
- **SvGrid Base: a table has no size limit.** A table used to stop at `limit`
  records, 10,000 by default, and a table on `serverRows` kept that many in the
  page for everything but its grid views. Now no read stops short. A table that
  outgrows the page (`holdInPage`, the new name of `limit`) is read from the
  database a part at a time, by itself, and the page holds none of its records.
  Links, lookups and rollups read records by id, and a rollup over a link stored
  on the big table is added up by the server: in demo 723, a table of 200
  customers shows each one's orders and revenue over a million. The link picker,
  search across tables and the grid's search box search the whole table.
  Automations run on any record, and a scheduled one on every match. Share
  links show the whole table. A new record's autonumber is the table's next.
  New in the data source contract: `groupRawKeys`, for a link grouped by id.

- **SvGrid Base: `createSqlDataSource` runs a view's filter.** It used to leave
  `filterModel.expression` out, so a filtered view on a SQL table showed every
  record. It also filters, sorts, groups and adds up on formulas, lookups and
  rollups now: `computedSql` (`@svgrid/enterprise/base/compute`) turns them into
  SQL, or says it cannot rather than answer differently from the cell.

- **SvGrid Base: formulas in SQL say what a cell says.** More functions translate
  (`SWITCH`, text slices, `MOD`, `POWER`, `SQRT`, days and weeks on dates), and
  each is checked against a cell on real Postgres, MySQL and SQLite over blanks,
  negatives and quotes. `generatedColumnSql` writes a formula as a generated
  column for Supabase, and `generated` makes a filter read it.

- **SvGrid Base: `schemaChanges` on `createSqlDataSource`.** On Postgres a field's
  type change is one `ALTER` and a table's copy one `CREATE`. Off by default.
  Without it, a big table's values are rewritten sixteen writes at a time.

- **SvGrid Base: Supabase with aggregates off.** How a project starts. Kanban
  lanes and link counts now read their size with plain counts, and a total that
  needs aggregates says how to turn them on (`AggregatesOffError`).

- **SvGrid Base: a link edits from either side of a big table.** A customer's
  orders tick in the picker, and each tick writes that order. Names pasted into
  a link cell are found on the server.

- **SvGrid Base: changing a field's type on a big table converts its values.**
  It asks first, then uses `convertField` or rewrites them a block at a time.

- **SvGrid Base: Download as SQL writes every record of a big table,** a block
  at a time. Duplicate table copies records that fit in the page, or in the
  database with the `duplicate` option.

- **SvGrid Base: a Kanban lane keeps its order.** Sorted by a number field, a
  card dropped elsewhere in its lane writes that number.

- **SvGrid Base: every view reads a whole table of millions.** Views other than
  grids used to show the first records of a big table.
  Now a Kanban lane shows its true size and reads its cards as they scroll by;
  a calendar reads the dates on screen, with each busy day's size and a "+N
  more" that lists all of that day; a Gantt reads its rows by start date; a
  gallery, list and inbox draw and read what is in sight; a chart and a
  dashboard have the server add up. It is the same `getRows` request a grid view
  sends, so a source that answers a grid view answers these. `queryRecords` now
  answers `aggregations` and `needsGrandTotal`. In demo 723 (a dev build, one
  laptop), each view of the million opens in under a second.

- **SvGrid Base: a Rich text field type (`fieldType: 'richText'`).** It edits
  in a panel over the cell with a formatting toolbar: bold, italic, underline,
  strikethrough, bullet and numbered lists, links and clear formatting.
  `fieldProps: { toolbar: 'full' }` adds headings, quotes, code blocks, undo
  and redo. Ctrl+B / I / U format the selection and Ctrl+K adds a link;
  Ctrl+Enter, Tab or a click outside saves and Escape cancels. The value is
  HTML, sanitized when it is stored and again before it is drawn. A grid row
  shows the formatting on one line, a taller row height as lines, and the
  expanded record and the form show all of it. Search, the filter, sorting,
  copy, lookups and formulas read the words without the markup. Converting
  from long text renders its Markdown; converting back keeps a line per
  paragraph and list item. Demo 722 (release notes) shows both toolbars, a
  filter view and a formula over a note; demo 511 (content calendar) uses it
  for the brief. The long text option that renders Markdown is now labelled "Format
  with Markdown", to tell the two apart.

- **SvGrid Base in your language.** Every word a base shows (the tab bar,
  the view bar and its panels, the record view, forms, the field editor and
  the field types, menus, notices, color and icon names) comes from one table
  of about 1,100 messages. `setBaseMessages(words)`, `<SvBase messages>` or
  `<sv-base>`'s `messages` property hand over the words you have; the rest
  stay English. Counts take `.one` / `.other` forms, and a `plural` rule
  for languages with more. `BASE_MESSAGES` lists every key with its English.
  A trash item for a table with one record now reads "1 record", not
  "1 records".

- **SvGrid Base: Vote and Sparkline field types.** A vote field keeps who
  voted (user ids): a click on the cell, Enter or Space adds the signed-in
  person's vote or takes it back, through the grid's edit path, so undo and
  protected fields hold. It sorts by the count and filters as people ("has any
  of me"). A sparkline field draws a list of numbers as a line, area or column
  chart, typed and pasted as `3, 7, 4, 9`, sorted by the last value.

- **SvGrid Base: a trash kept in your backend.** `<SvBase trashStore={{ list, add,
  remove }}>` reads the trash when the base opens and tells the store of every
  item deleted, restored, undone or emptied, so it survives a reload and is
  the same for everyone.

- **SvGrid Base on a phone: boards and calendars.** A Kanban lane takes the
  table's width and snaps into place as you swipe; a calendar opens in its
  agenda. Gallery cards and forms were one column already.

- **SvGrid Base: tables of millions of records.** `baseSource(ds, { serverRows: true })`
  has a table's grid views read it a block at a time through the server row
  model, with the view's filter (`filterModel.expression`), sort, groups and
  search sent to the server, and its edits, new records and deletes written by
  id. Kanban, calendar, gallery and the other views show the first `limit`
  records, and say so. Grouped views get one row per key with its count from
  the server, and the view bar counts the server's records. `queryRecords`
  answers such a request over records a Node server holds,
  `fieldFilterToSql` turns a view's filter into a `WHERE` clause for
  Postgres, MySQL or SQLite, and `fieldFilterToPostgrest` /
  `supabaseFieldFilter` into a PostgREST filter: `createSupabaseDataSource`
  has a new `expression` hook, and `baseFromSupabase` a `serverRows`
  option. A link edited there changes the field that links back for that
  record only (`linkChanged`), not for the records the page never loaded.
  Demo 723 pages through 1,000,000 orders.

- **SvGrid Base: formulas on a server (`@svgrid/enterprise/base/compute`).**
  `computeRecords(tables, tableId)` works out every formula, lookup, rollup
  and count with the grid's own engine, and `evaluateFilter` /
  `filterRecords` test records against a view's filter, with no DOM and no
  Svelte, so an API, an AI tool or a report sees the values people see. A
  test works out a base both ways and compares them record by record.

- **SvGrid Base: permissions.** `<SvBase permissions>` (and a table's own
  `permissions`) take `canEdit`, `canCreate`, `canDelete`,
  `canEditSchema`, `canEditViews`, `canComment`, `fields` (`'hidden'` or
  `'readOnly'` per field) and `viewsOnly`. The screen offers only what the
  person may do: no "+" row or Insert record without `canCreate`, no field
  editor or table menu without `canEditSchema`, view changes kept in the page
  without `canEditViews`. A hidden field takes the formulas, lookups and
  rollups that read it along, and the stored records and columns are never
  changed by what a person is not shown. `<sv-base>` takes the same as its
  `permissions` attribute.

- **SvGrid Base: realtime changes update only what changed.** The
  `realtime` callback's `apply(changes)` takes inserts, updates (the whole
  record or just the changed columns) and deletes, or Supabase Realtime events
  as they come, and updates those records in place, a burst at once, with the
  same highlight and credit as before. `baseFromSupabase` uses it. `apply()`
  with nothing still reads the table again.

- **SvGrid Base: a record history that lasts.** `setRecordHistory({ list, add })`
  reads a record's history from your audit log each time it is opened (a
  promise is fine) and hands it each change made in the page.

- **Change review in the record view.** An expanded record lists its pending
  proposals under their fields, with Accept and Reject per field and for the
  record. `review.acceptRecord`, `rejectRecord`, `pendingIn`, `sources`,
  `pendingFrom` and `revertSource` (everything one agent did, across its
  sets) are new, and the panel has a From picker when more than one source
  has proposals.

- **SvGrid Base: undo for tables, form footers and link allowlists.** Adding,
  renaming, duplicating, deleting and importing a table are undo steps.
  `formPrefill` takes a list of the fields a link may fill
  (`prefillFields` on `SvBaseForm`), and a form view takes `formFooter`
  text or `<SvBase formFooter>` as a snippet. `<SvBase onMention>` hears
  mentions. `<sv-base>` fires `cellchange`, `recordadd`, `recordsdelete`,
  `trashchange` and `mention`, and takes a `read-only` attribute.

- **A grouped grid prints its groups.** `print()` printed a grouped grid's
  leaf rows only. It now prints a header row above each group, "Region: EU
  (12)", indented by level; `groupRows: false` leaves them out.

- **`print({ open: false })` returns the printable document.** `print()` and
  `printGrid()` now resolve to the HTML they built, and `open: false` skips
  the print window and dialog, for a preview pane or anything that times the
  printable view. It is a plain table, not the grid.

- **PDF: `pdf.fit`, `pdf.repeatColumns` and `pdf.font`.** `fit` chooses what
  happens when the columns do not fit across the page (shrink the text, split
  the columns over pages, or both, the default); `repeatColumns` says how many
  leading columns repeat on each page of a split. `font` prints with a font
  you supply, base64 or a URL, for scripts Roboto lacks (Chinese, Japanese,
  Korean, Arabic, Hebrew, Thai, Indic, emoji); without one the export now
  warns when it sees them.
- **PDF export in a worker: `pdf.worker` and `@svgrid/enterprise/pdf-worker`.**
  pdfmake renders in one synchronous run, about a second per thousand rows on
  a desktop machine, and on the page that froze the tab. With
  `pdf.worker: () => new Worker(...)` and a worker script that calls
  `servePdfWorker()`, the document goes to the worker as data and the page
  stays responsive: a 5,000-row export took about two seconds while the page
  kept drawing at 60 fps, with progress through `onProgress` and an abort that
  terminates the worker. A PDF of more than 2,000 rows rendered on the page now
  logs a warning that points here. `buildPdfDocData` and `hydratePdfDoc` split
  the document builder for this; `buildPdfDocDefinition` works as before.
- **Grouped PDFs total like the grid.** Subtotals use each column's
  `aggregate` (avg, min, max, count, countDistinct, a function) instead of
  always summing, a total row closes the table (`pdf.grandTotal: false` to
  leave it out), and group names are formatted as on screen. `getColumns()` in
  `@svgrid/grid` now reports each column's `aggregate` for this.
- **PDF: `pdf.labels`, `pdf.watermark`, `pdf.author`.** Replace the footer's
  page and date text and the subtotal and total labels; print a faint
  watermark across every page; and fill the document properties, so a viewer
  shows the report's title rather than the file name.
- **PDF column widths follow the text.** Each column gets at least its
  longest word and the rest of the page goes to the columns with the most to
  say, instead of equal widths: a 60-row, 8-column order list went from three
  pages to two.
- **The pivot designer's Chart view grew up.** It offers every shape a pivot
  can take (bar, line, area, lollipop, pareto, the three radial forms, pie,
  funnel, waterfall, radar, heat map, stream) in the panel's groups, with
  Stacked, 100% and Horizontal where the type uses them, the chart's own
  toolbar (PNG, SVG, PDF, print, copy), its spoken summary and a legend
  under the plot. It had six types and a Stacked box.

- **`pivotToChartSpec` carries the measure's format and name.** Pass the
  value chip's `format` and the chart reads "$470k" on the axis and
  "$469,662" in the tooltip, in the measure's currency and locale; percentage
  points get a formatter that appends the sign. With one measure the value
  axis is named after it (`yAxisTitle` overrides, `null` for none). The
  designer's Chart view passes the format when its measures agree, and
  formats plainly when a layout mixes a currency and a count.

- **PDF export with charts and a KPI strip.** `pdf.charts` prints charts with
  the table: a rendered chart's element is rasterised on export through the
  grid chart's PNG path, or pass an image data URL; each takes a title, a
  caption and a width, and goes above the table or below it
  (`chartsPosition`). `pdf.kpis` prints a strip of headline numbers, each a
  label over a big value with an optional coloured delta line. Roadmap
  discussion 36.
- **The selection bar renderer, plus bulk edit.** `enableSelectionBar()`
  (or `installEnterprise`) registers the renderer behind the free
  `selectionBar` prop. The bar carries a count chip, your actions, an overflow
  menu past `maxVisible`, and Clear; at phone width it collapses to icons and
  keeps an accessible name on each. **Edit fields** opens a drawer that edits
  one or many rows at once: a field the selection disagrees on opens blank and
  stays per-row unless you touch it, so applying to 40 rows does not flatten the
  values you did not mean to change.
- **Scheduler booking rules and conflict detection.** New model helpers
  (`overlapCount` for per-resource overlaps, `overlapsBands` for working-hours
  bands) back resource double-booking checks and business-hours enforcement.
  New demos: booking rules, financial trading hours, and HR shift coverage.

#### Fixed

- **SvGrid Base: one Undo or Redo at a time.** Redo pressed while a range Undo on a paged table was
  still writing read the records before the Undo's later blocks landed: the data ended undone or half
  pasted while the page said "Redone: edit 6,000 records". Now a second Undo or Redo while one runs is
  refused with "Undo is still running." and the buttons show it busy. An Undo or Redo of more than one
  block runs in the paste's dialog with its count and Stop, leaving the page asks first, and what it did
  is said when it ends, with the records or cells it changed (not those a teammate kept, a deleted
  record or a refused write). A small paste's count is said once its writes have answered.
  The dialog covers every Undo and Redo of more than a block: a delete (its Undo says the records
  it put back, not those a teammate restored first), the records a paste added, and more than
  1,000 cells of a table the page holds. A cell undo of a record the view no longer shows holds its
  turn until that record's write has answered.
- **SvGrid Base: Undo of a new record before its insert answers.** The step was a cell edit until the
  database answered, so Undo wrote an empty name and the record stayed. The "add record" step now
  exists from the moment the row does, what is typed into the record folds into it, and Undo waits for
  the insert, then takes the record out. A refused new record's Activity no longer shows what was typed.
- **SvGrid Base: Try again from a record that fell to the end.** It wrote the first line into that
  record and offered to add the rest as new records. Now it writes nothing and says how many rows stand
  below the record against how many the first try covered; the dialog of a Try again names the rows it
  writes, which it covers on screen.
- **SvGrid Base: a range over 1,000 records on Supabase or PostgREST is written.** The ids check read the
  whole range in one request, and a server that answers 1,000 rows at most (`db-max-rows`, the Supabase
  default) gave fewer back: every paste, clear, fill, one value or copy of more than 1,000 records said
  "Records moved" and wrote nothing. A short answer now reads on, a page of the server's own size at a
  time, and only a different id sequence counts as moved; a source with no cap still answers each check in
  one request. These checks select the key alone on Supabase and PostgREST. A download, a duplicated table
  and a view's group reads from a source that sends no count also read on past a short answer.
- **SvGrid Base: a Cut the browser refused says so.** It did nothing in silence; now "The browser would
  not put the cells on the clipboard, so nothing was cut."
- **SvGrid Base: a notice that stays no longer covers "+ Add record" or a record's Delete and Close.**
  Notices in the bottom-right corner start above the button, or an open record's footer, where they
  meet.
- **SvGrid Base: a table named by its key keeps its records.** A table with no text column shows
  its key as its first field. A record added there was deleted and created again under a new key at
  the next change of any record, a tab switch or a sort, on Postgres, MySQL and SQL Server: a foreign
  key with `ON DELETE CASCADE` took its children with it, "record created" automations ran each time
  and a table that marks deletes filled its trash. Edit field on the key could change its type, which
  wrote every record again under a new key, and offered "Who can edit its values". With a feed, a new
  record's key stayed blank and the page counted its own insert as a teammate's change. The key field
  now holds the key the database gave the record, in the key's own type, from a read, a write's answer
  or a feed; no edit, paste, fill, undo or field change writes it. Edit field on it changes its name
  and description only, and Duplicate field makes an ordinary field. A key column named `id` is the
  field `id_key` in the table's description, which `rename` maps back to `id`.
- **SvGrid Base: a table with `customer` and `customer_id` opens.** The link from `customer_id`
  took the name `customer`, so two fields shared one id: the tab threw, showed the previous
  table's records, and the link and its field back were lost. Two keys that read as one name
  (`owner` and `owner_id`) did the same. Now a link whose name is taken keeps its column's name as
  its id and is headed "Customer (link)", or by its column when both are links ("Owner id"); both
  fields show, and each link keeps its field back.
- **SvGrid Base: a client's filter on the tenant column is combined with the scope.** The scope
  replaced it, so `tenant_id = 2` asked by tenant 1 answered all of tenant 1's rows, and an
  `updateWhere` with that filter changed them. The two are combined now: another tenant's value
  finds no rows and changes none.
- **SvGrid Base: a refused write names the record as stored.** A refused edit of the name field
  named the record by the value that was refused ("Could not save Label of boom"). A refusal by a
  foreign key of three columns named no field when the edit was to one of them: it names the key's
  fields now. The top bar's "Not saved" names them too.
- **SvGrid Base: the status line opened in full shows no transport text.** It showed
  `svgrid kit: 409 Conflict - {json}` after the reason. It shows the reason, and the server's own
  words when it sent some that the reason does not say. A line with nothing more still opens, to read a
  reason the bar cuts short. Notices that quoted an error (a delete, a copy, a bulk edit, the
  trash) say the reason in words in place of the endpoint's or the REST API's status and body.
- **SvGrid Base: a new record of a table whose database makes the key is read by no one before it
  has its key.** On a paged table, a draft (or a record whose insert was on its way) was asked for
  by its page id, and so were the records linking to it: Postgres refused the read on an integer
  key ("invalid input syntax for type integer"), and that text showed as a notice. Such a record is
  left out of those reads until the database has given it its key. A read that fails says so in
  words; the driver's text goes to the browser console.
- **SvGrid Base: Duplicate field on a database table the base cannot add a column to copies
  nothing.** It copied the values into a column that was not there, so their writes could not land.
  It now says the copy needs a column and gives the statement that adds it.
- **SvGrid Base on a REST API: the API's reason is shown, and a refusal of the values offers no Try
  again.** `createRestDataSource` passes `{ error }` or `{ message }` on as the reason, so a `422`
  says "The server said: Amount must be 0 or more." where it said that no reason came. A server's
  words that do not end a sentence get a full stop, so "You entered: -500" after them reads apart. A `400`,
  `409` or `422` from any source offers no Try again, which would send the same values.
- **SvGrid Base on Postgres: a foreign key to a table of another schema on the search path is a
  link.** `public.notes.task_id -> app.tasks` stayed plain text with both schemas on the path and
  both tables in the base. A key now links when its table is the one its bare name reaches. A key
  to a table that an earlier schema's table of that name hides stays plain, in its own schema too.
- **SvGrid Base: a grouped paged view shows your own changes in its open groups.** Round 7 made a
  teammate's change read every open group again; every other refresh still read only the group
  rows. With no feed, a record you deleted stayed listed in its open group (and typing into it said
  it no longer exists), a record you restored from the trash or brought back with Undo did not show,
  and a new record, an edit that moved a record to another group, a renamed option, a converted field
  and the read after "Records moved" left the open groups as they were, while the counts changed.
  The server row model's `refresh()` with no route now reads the group rows and the loaded records of
  every open group on a grouped view, as `refresh({ all: true })` does, so every caller gets it.
  `refresh({ route: [] })` still reads the top level alone. On a grouped view or tree data an app's
  own `refresh()` now also reads the loaded blocks of each open group or node.
- **SvGrid Base: a teammate's change to a sorted field takes its place in a paged view.** A feed that
  sends the row patched it where it stood, so a record whose sorted field changed stayed out of order
  until something else read the view. A change to a field the view sorts or groups by now reads the
  view again (every open group, when grouped); a change to any other field still patches the row and
  reads nothing. A view sorted or grouped by a formula or lookup reads again on any change, since a
  change to a field it reads moves it too.
- **SvGrid Base: a face is never another person's while it loads.** User, created-by and
  last-modified-by cells reuse their faces by position on a scroll, and the browser kept drawing the
  last person's picture beside the new name until the new picture loaded. Another picture now gets
  a new `<img>`, empty until it loads, as attachment thumbnails do; the same picture keeps its
  element. The attachment preview's Next and Previous do the same.
- **SvGrid Base: a checkbox cell is named by its field.** It read "Checked" or "Not checked" in
  English whatever `setBaseMessages` set, and a screen reader heard the state twice. Its name is the
  field's name (`fields.typeCheckbox` when the field has none), and `aria-checked` says the state.
- **SvGrid Base: an image in rich text stays on the cell's line.** Under a reset that makes `img` a
  block (Tailwind's preflight), an image in a rich text cell took a line of its own: the text after it
  was cut off, or ran into the next row.
- **Scheduler: a move keeps the event's length by the clock.** A drag, a keyboard carry, a timeline
  drag, the other selected events of a move, a series edit, Duplicate and a new event at a slot
  added real minutes to the start. On the night the clocks go back a one-hour event dropped on 1 am
  read and was stored as 1am - 1am, and a 45-minute one dropped on 1:30 ended at 1:15. The end is
  now the start plus the event's length by the clock, the length it had when picked up. An end the
  clocks skip lands after the skip, as a start does: on the night they go forward a one-hour event
  dropped on 1:30 reads 1:30am - 3:30am, one hour in real time. A timeline month drag over a
  25-hour day ended an hour past midnight; a new all-day event on a timeline month was 24 hours,
  not one day. Both now keep whole days.
- **Scheduler: the Agenda and the tooltip say when an event over several days ends.** A timed event
  from Monday to Friday read "12am - 12am"; it reads "12am - Oct 30, 12am". An all-day one over several
  days shows its first and last day instead of "all day".
- **Scheduler: a keyboard carry lands at the time carried.** Each arrow stepped from where the last
  one landed, so an event picked up on Saturday at 2:30 am showed 3:30 am on the Sunday the clocks
  skip 2:30, and stayed at 3:30 am on Monday and after. Every step now counts from where the event
  was picked up (days by the calendar, slots by the clock), and a slot step always goes the way
  pressed. With 15-minute slots a step down from 1:45 am on that night landed at 3:45 am; it lands
  at 3:00 am.
- **Scheduler: the event in hand stays in view.** A carry by the arrow keys never scrolled the
  calendar: the event went under the sticky header and out of sight. The day, week and timeline
  views now scroll with it, and a Gantt chart scrolls with a bar moved by the arrows.
- **Scheduler: the top edge of an event that ends at midnight resizes it.** Dragged from 11 pm to
  10 pm, an 11pm - 12am event became 12am - 12am, a whole day, and was written so. Its end is now
  read as 24:00 of its day.
- **Scheduler: Duplicate can copy the event.** It called `onEventAdd` with the times alone, so the
  copy was a blank "New event". `onEventDuplicate(source, start, end, resourceId, allDay)` gets the
  event it copies. In a base Duplicate on a calendar event copies the record, as a card's Duplicate
  does. A whole-day event with no end field copied onto its own day; it copies onto the day after.
- **SvGrid Base: keyboard focus shows on menu items under forced colours.** The "All tables" menu,
  the table menu and a summary's menu drew focus as a tint, which a contrast theme removes. They draw
  a `Highlight` outline there.
- **SvGrid Base: a checkbox change is said in words.** A screen reader heard "Done changed to true";
  it hears "Done changed to checked" (`viewbar.valueChecked` and `viewbar.valueUnchecked`), and the
  record's Activity and the Inbox read the same words. A checkbox cell is `aria-readonly` only when it
  cannot be changed.
- **SvGrid Base: the tenant column never names a record.** A table under `tenantColumn` with no
  `name` column took its first text column, the tenant, as every record's name: link chips all read
  "A" and errors said "Could not save Site id of A". The primary field is now the first text column
  that is not the tenant, not a key column and not a foreign key column (one that links nothing, a key
  of three columns or into another schema, included). With none, the record's key names it and shows
  as the first column, read-only, pinned and never hidden, moved or deleted, as any primary field is;
  links, errors and the record view read that name. An integer `tenant_id` placed first is passed over
  the same way, and the tenant is never the first column. `EntitySchema.foreignKeyColumns` lists every
  foreign key column a database read found.
- **SvGrid Base: an empty database opens as "No tables yet".** `createBaseEndpoint` with `allTables`
  answered a database with no tables with a `403`, which the scaffolded page read as "set
  `authorize`", in development too. It now answers `200` with no tables and reads the database again
  on the next request, so tables made by `db:setup` show on a reload. On Postgres `allTables` listed
  only `public` while every query reached tables through the search path: it now lists the tables of
  `current_schemas(false)`, the first of a name winning as `to_regclass` resolves it, and the svgrid
  comments, the key default and the column types of a table come from that same table.
- **SvGrid Base: a refused write says what is known.** A foreign key refusing a write (a value naming
  a record that is not there) read "Other records depend on it." with Try again: it now reads "The
  record Site id points to is not there." with no Try again, and the endpoint sends `409` with
  `code: 'link-missing'` and the key's `fields` when the database says which. A delete keeps
  `linked`. A write the server answered with an error (`request-failed`, a trigger's `RAISE
  EXCEPTION`) read "The server gave no reason, so it may not have been stored."; it now reads "Not
  saved: The server answered with an error. Whoever runs it can see why in its log." Only a write
  with no answer says "may not have been stored". New messages `shell.why.linkMissing`,
  `shell.why.linkMissingField`, `shell.why.linkMissingFields` and `shell.why.serverError`;
  `shell.why.unknown` has new words.
- **SvGrid Base: a new record the database refused takes no second create.** Add row opens the new
  record's first cell; when its insert failed (an id column too narrow, say) while that cell was open,
  the row waited for the editor, and what was typed into it sent a create again (in a browser on
  MySQL, two more), each failing with its own notice. What is typed now goes with the failed record,
  for its Try again where there is one, the notice says "Could not add" with the name typed and the
  reason, and the row goes when the editor closes. A refused new record that stays listed (while another
  editor is open, or a draft on a table read a part at a time whose refusal no retry can change, such
  as an id column too narrow) takes no edit: a click, a double
  click, a typed key or a paste on it shows its notice instead of an editor, so nothing typed into it
  is dropped. An editor open on it when the refusal comes is closed with what it holds, which the
  notice names. A draft refused for a reason a retry may get past (no answer, a server error) keeps
  taking edits, and its next edit sends it again, as before.
- **SvGrid Base: a query with no `pageSize` is a `400`.** It was a `500` ("planToSql: limit must be a
  non-negative integer"). `pageSize`, and `startRow` and `endRow` when given, must be whole numbers of
  0 or more, or their digits; the answer says so.
- **SvGrid Base: two foreign keys to one table give fields back named for their keys.** Customers got
  "Orders" and "Orders 2" for `customer_id` and `rev_customer_id`; they are now "Orders (Customer)"
  and "Orders (Rev customer)". One key alone keeps the plain name.
- **`npx @svgrid/create`: the base template asks for current packages and has a favicon.** Its
  `package.json` asked for `@svgrid/grid ^3.0.11` and `@svgrid/enterprise ^3.1.16`, and it had no
  favicon, so the browser's request for one was a 404 on every page. It now has the SvGrid icon
  (`favicon.ico`, 16 and 32 pixel PNGs, and an Apple touch icon). The pivot dashboard and
  SvelteKit templates' floors moved up too.
- **SvGrid Base: three records that move at once during a range read stop it.** On a sorted paged
  view, one teammate's edit that moved a record from the part read to past the end, one from the part
  not read into the part read, and one from past the end into the part not read, left every block's
  seam, the far end and the count as they were and repeated no record. A 6,000-line paste then wrote
  about 500 lines to the record beside the right one and said "Changed 6,000 of 6,000 records". The
  whole id sequence is checked now, in requests that ask for ids alone: a range longer than a block
  reads its ids first, in place of the record at the far end, and each block must bring the same ids
  in the same places; once the last block is read, the ids of the whole range are read again and must
  be the very ids read, in the same order. Any difference writes nothing. This holds for a range of
  one block too, and for copy, clear, one value and fill. A teammate's move inside the part already
  read now stops the job too, where before the paste went ahead. `createSqlDataSource` reads ids
  alone for these requests (`idsOnly`); a source that does not know the hint sends whole rows.
- **SvGrid Base: Try again after "Records moved" goes from the first record selected.** In the same
  view it pasted by position: after a teammate's edit moved a record above the selection, every line
  landed one record down, a selected record got nothing and one outside the selection got a line. Try
  again now finds the first record selected by its id, goes from there over as many rows below it as
  before, as the list stands at the click, and selects those rows first so the screen shows what it
  writes. The notice says so: "Records moved while this was read. Nothing was changed. Try again
  pastes from "Acme" down over the rows as they are now." If that record is gone or no longer
  among the rows shown, Try again writes nothing and says so. Opening or closing a group since counts
  as a change of the view. Paste, one value, clear, fill and copy alike. Messages `shell.rangeMoved`
  and `shell.copyMoved` are replaced by `shell.rangeMovedPaste`, `shell.rangeMovedValue`,
  `shell.rangeMovedClear`, `shell.rangeMovedFill` and `shell.copyMovedFrom` (with `{name}`): a
  `setBaseMessages` override of the old keys needs the new ones.
- **SvGrid Base: Undo and Redo of a range say how many records kept a teammate's value.** Undo of
  a 2,500-record paste where a teammate had changed one record said "Someone has changed this cell
  since" before its blocks were written. It now says "Someone has changed 1 of these records since,
  so it keeps their value." once the blocks are done. A small range undone cell by cell says "1 of
  these cells" in the same case, after its checks.
- **SvGrid Base: a grouped paged view shows a teammate's change in its open groups.** A change from
  the feed re-read only the group rows: an open group kept showing old values with no sign they were
  old, a record moved to another group stayed listed under the old one, and with the changed fields in
  the feed the counts did not follow either. The group rows and the loaded records of every open group
  are now read again, so a value shows in place, a record whose group changed moves to its new group,
  and the counts follow. A feed that sends the changed fields patches the row at once and reads the
  groups again only when a grouped field changed. A group closed at the time reads again when it is
  opened. A read that fails keeps every group's rows and says so in the top bar, as an ungrouped view
  does. The server row model's `refresh({ all: true })` is what does it.
- **SvGrid Base: Retry in a failed block takes the pointer under the pinned column divider.** Over
  the button the divider showed its resize cursor and its line, and the click relied on being passed
  on. The divider now lets the pointer through to the button while it is over it, and is the divider
  again once the pointer leaves. Its line is no longer drawn across a failed block's band, so the
  words and Retry are clear of it; everywhere else the line is as it was, under forced colours too.
- **SvGrid Base: the top bar's full reason can be read on any device.** A narrow window cut the line
  short with an ellipsis, and the tooltip held only the server's own words, which a touch screen
  cannot show. A line with a reason is now a button: a tap, a click or Enter opens it in full,
  wrapped, with the server's words under it, and the bar grows only while it is open. Another press,
  or the notice going, closes it. The tooltip holds the whole line, then the server's words. A screen
  reader hears the line and the server's words once, from the button, which carries `aria-expanded`.
- **SvGrid Base: each Restore in the trash is named by its record.** A screen reader heard a list of
  "Restore" buttons; it hears "Restore Task 4", as Delete forever already said "Delete Task 4
  forever". New message `shell.restoreItem`.
- **SvGrid Base: "All tables" says which table is shown.** Its tables are radio items now, the shown
  one checked, so the tick is announced as well as drawn.
- **Calendar: Day and Week on a day the clocks change.** Events were drawn an hour off their rows on
  a 25- or 23-hour day, in the page and in Base, and a drop or a slot wrote the time of the wrong
  row. They are drawn, dropped and written by the clock now. A carry by the arrow keys steps by the
  clock too: the night the clocks go back, 1:30 and one step is 2:00, not the second 1:00, and the
  event keeps its length. A Pro timeline's working hours on such a day, and the days after it, start
  at their hour; they were an hour early, and on a 25-hour day one day was counted twice.
- **Calendar: an event over several days says its last day.** Its name gave the first day only, so a
  bar from Monday to Thursday was heard as a Monday event.
- **SvGrid Base, WebKit with a finger: a tap beside a link selects, as everywhere else.** WebKit sends
  the press of a tap to the cell and its click to a link, chip or star a few pixels away. That
  click followed the link, opened the linked record or set the rating on the first tap. A click
  now acts only when the press began on the same thing; on a cell already selected a tap beside a
  link does what a mouse click there does, which opens the cell's editor, and does not follow it.
- **SvGrid Base, forced colors: a ticked checkbox shows its tick.** The white tick sat on a fill that
  a contrast theme removes, so every ticked box read as empty. The tick, a given rating icon and
  your vote are drawn in the theme's text color.
- **SvGrid Base: a menu item that is off is heard with why.** Download as Excel without jszip, and
  Delete table on the last table, are in the arrow-key order of their menu (`aria-disabled`).
- **SvGrid Base: deleting the last record of a group in a list keeps focus among the records.**
  Focus went up to the group's header. It goes to the record after it, the first of the next group,
  or to the record before it when it was the last of the list.
- **SvGrid Base: two records that trade places during a range read stop it.** A paste, copy, clear,
  one value or fill on a sorted paged view checked the ends of each block it read. When a teammate's
  edit moved one record into the part read and another out of it, the ends stayed put: one record was
  read twice, the other never, and the paste wrote a line to the wrong record and said "Changed 6,000
  of 6,000 records". A record read twice now counts as moved, and nothing is written.
- **SvGrid Base: Try again after "Records moved" acts only in the view it came from.** Pressed after
  a switch to another view of the table, it pasted into the records at the same positions there,
  which nobody had selected. It now writes nothing if the view, its sort, filter, groups or shown
  fields changed, and says "That view is no longer open, so nothing was changed." or "The view has
  changed since, so nothing was changed." The same holds for the answer to a job's question: past
  10,000 records, new records past the last row, and a delete.
- **SvGrid Base: the read count of a range goes up a block at a time.** It read "2,000", "3,999",
  "5,998" records so far: each block after the first read one record of the last again and counted
  one less. Each block now brings 2,000 new records.
- **SvGrid Base: the notice of a save that stopped part way goes with its Undo.** It stayed after the
  Undo and still said "Undo takes these back."
- **SvGrid Base: a bulk delete that finds records gone says so in one notice.** "Deleted 2,598
  records" with Restore and "Deleted 2,598 of 2,600 records" came together; now the notice with
  Restore says "Deleted 2,598 of 2,600 records".
- **SvGrid Base: an edit of a record a teammate deleted reads "This record no longer exists."** It
  read "The record is no longer there, or you may not change it.", which suggested a permission
  problem.
- **SvGrid Base: records that link to each other in a circle delete in one go.** A delete block of
  `n1 -> n3 -> n2 -> n1` went level by level and found no record to start from, so Postgres and SQL
  Server answered "Other records depend on this one". Records in a circle now go in one statement,
  which Postgres, SQL Server and SQLite take. MySQL checks each row as it deletes and refuses them;
  the page says so in words, and that the link of one of them must be emptied first. Delete forever
  out of the trash does the same.
- **SvGrid Base on SQL Server: the trash asked with no limit is its count alone.** It read one record
  where Postgres and MySQL read none.
- **SvGrid Base on Postgres: a foreign key of two columns links again.** The catalog query paired
  every column of a key with every referenced one, so `(tenant, order_id) -> orders(tenant, id)` read
  as four keys: links showed empty and valid ones were refused. Keys are now read column by column in
  key order on every database, and only within the schema the base reads (a table of the same name in
  another schema, or a key into one, is no longer mixed in, on Postgres, MySQL and SQL Server). A key
  of the tenant column and one more is a link through that one within the tenant, and the tenant
  column stays the read-only tenant instead of an empty link field. Any other key of more than one
  column links nothing and is named in the log. On Supabase, PostgREST does not describe a key of two
  columns, so neither column is a link there.
- **SvGrid Base: every link through a pair table, and the field that links back, is named for its
  pair table** once the plain name is taken: "Tags (Ot rev)", never "Tags 2".
- **SvGrid Base: the All tables menu never squeezes an item.** With many tables, or with the Excel item
  that says jszip is missing, items shrank into each other; the menu now scrolls instead.
- **SvGrid Base: importing an .xlsx without jszip says so in plain words**, as the Excel download
  does, instead of the developer's install command. `importData` and `readImportMatrix` reject with
  `code: 'no-jszip'`.
- **Scaffold: dialogs, menus and the rich text editor use the app's font.** The `base`, `sveltekit`
  and `pivot-dashboard` templates set the font on the layout only, and what moves to `<body>` was in
  the browser's serif.
- **SvGrid Base: a cold automation server judges every record of a block by what it held before.**
  The first write after the server started read the tables after that write, so a pasted block of 45
  "Won" ran the rule for one record, and could run it for a record that was Won already. The `audit`
  hook now has a `before` that `createKitHandlers` awaits before each write, so the first read lands
  first. Pass your own audit hook as `automations.audit('tasks', yourHook)` to keep it; a hook you wrap
  yourself loses `before`, and then each record of the first request goes by the fields the write named.
- **SvGrid Base: a paged view whose read after a teammate's change fails keeps its rows.** One failed
  refresh replaced every loaded row with "Could not load these rows". The rows stay, the top bar says
  the table could not be read, and Try again reads them again. New on the server row model:
  `keepRowsOnRefreshError` and `staleBlocks` on each level. The top bar's Try again no longer slides out
  of sight on a narrow window, and a failed block's Retry under the pinned columns' divider takes the click.
- **SvGrid Base: one feed for a base on an endpoint.** The docs showed one `EventSource` per table and
  junction table. On HTTP/1.1, which a Vite or Node dev server speaks, a browser opens at most six
  connections to a host, so a base of six tables left no connection for a write: "Still saving" for
  good. `baseFromEndpoint` takes `feed: (apply) => stop`, one connection whose messages name their
  table, and `createBaseFeed` shares one connection among `baseSource`s.
- **SvGrid Base: the trash of the person who deleted follows a teammate.** A teammate's Restore and
  Delete forever left the record in the deleter's trash and its count, open or closed.
- **SvGrid Base: focus stays off another record's Restore.** When a teammate's change took away the item
  holding focus in the trash, or turned its Restore off, focus moved to the next record's Restore, and
  Enter restored a record nobody chose. It goes to the list.
- **SvGrid Base: a failed write gives the reason the server sent.** An endpoint that answered
  `{ "error": "..." }` without a code read as "The server gave no reason". The page now says "The server
  said: ..." for a write and "The server answered with an error: ..." for a read. The endpoint's own
  500 sends `code: 'request-failed'` and keeps the driver's words in its log, as before.
- **SvGrid Base: a range on a sorted paged view writes nothing when a teammate moves a record under it.**
  A paste, one value, Delete, a fill and a copy read the range a block at a time, by place in the view.
  A teammate's edit that moved one record during the read shifted the next block by one, so lines
  landed on the neighbours and one could land outside the selection, while the page said "Changed 6,000
  of 6,000 records". Each block now reads the last record of the one before again and checks it, and
  the record at the far end is read first and checked at the end. If one moved, nothing is written or
  copied, the page says "Records moved while this was read. Nothing was changed. Try again.", and Try
  again does the same action on the same cells, on the rows as they stand then. A double click on the
  fill handle that finds records moved says so too; it stopped in silence.
- **SvGrid Base: new records keep the order they were made in.** `newRecordId()` put two random
  characters before its count, and its clock part ran over every 16.8 hours, so a paste past the last
  row of a paged table showed its new records shuffled. An id is now `rec`, the whole time, a count
  within the millisecond and four random characters: 19 characters, in creation order, and it never
  runs over. Ids made before stay as they are. **Breaking:** ids were 12 characters, so a text id
  column narrower than 19 (`varchar(12)`, `varchar(16)`) now refuses every new record. Widen it to
  19 or more before you upgrade. The base says so in words: "Record ids need 19 characters; this
  table's id column holds 16."
- **SvGrid Base: the screen shows a range job when it says it is done.** After a range job or its Undo
  on a paged table, "Changed 3,000 of 3,000 records" came while the cells on screen kept their old
  values for a second or two. The rows on screen now take each block as it lands, also the blocks that
  landed before one failed.
- **SvGrid Base: a record a teammate deleted no longer fails a scoped block on a table without soft
  delete.** Under a `scope`, a key no tenant holds, live or in a trash, is gone: a block skips it and
  finishes, one record by itself answers "This record no longer exists", and the key is not sent to
  the source. Another tenant's record, live or in its trash, is still a 403.
- **SvGrid Base on MySQL: a parent deletes with its children.** Delete, and Delete forever, of a block
  holding records of a table linked to itself and the records that link to them failed on MySQL with
  "Other records depend on it". The block now goes a level at a time, the records that link first.
- **SvGrid Base: a block's answer is used.** A paste whose values a server hook changed read each
  record again, a request a record: 400 for a 400-line paste. The answer is now followed in one step,
  and what a lookup needs of those records is read in one request.
- **SvGrid Base: a rich text field renders under Trusted Types.** It was a blank page under
  `require-trusted-types-for 'script'`. A base with a field of every type now renders there, with its
  record view and rich text editor (`base-trusted-types.spec.ts`). The paths that still do not run
  under it are listed in SECURITY.md.
- **SvGrid Base: "Download this view as Excel" says why when it cannot run.** Without the `jszip`
  package the item did nothing. It now says the app needs jszip, and a download that fails says so.
- **SvGrid Base: a checkbox is a real TRUE or FALSE in Excel**, not the words `true` and `false`.
  `exportGrid` with `rawValues` writes a boolean value as a boolean cell too.
- **SvGrid Base: a "Could not delete" notice goes once its records are deleted after all**, instead of
  staying beside "Deleted 3 records".
- **SvGrid Base: two pair tables between the same two tables are two fields with two names.** Both were
  named after the other table, and a third got the second's field id. The second is now named for its
  pair table, as "Tags (Order tags t)".
- **SvGrid Base on Supabase: `date` and `timestamptz` columns are date fields**, read by the Postgres
  type PostgREST names, as on the other databases. They were text.

- **SvGrid Base: a keyboard move in a month calendar stays in sight.** A month drawn in five weeks reads a sixth
  that is not drawn. An event carried into it went out of sight, focus went to another record, Space picked that
  one up, and the first showed on a date it did not hold. The view now goes to the next month with the event, and
  a key on another event while one is in hand acts on the one in hand. An arrow across a change of the clocks moves
  a whole day: a week down used to land an all-day event on the evening before.

- **SvGrid Base: a finger follows the mouse in a cell.** A tap on a link, email, phone or URL cell selects it, and
  the next tap follows the link, so on a tablet such a cell can be selected, copied and edited. A tap beside a
  checkbox's box or on a checklist selects the cell. A tap on the box, a star, a vote or a button acts at once.

- **SvGrid Base: a selected list row or gallery card no longer looks focused.** It has the grid's selected-row fill
  and a tick by its title; the ring is focus alone. Under forced colors the tick stays.

- **SvGrid Base: focus stays with the record.** After Undo of a board move focus goes with the card, not to the card
  that took its place, on a board read from a server too. After a confirmed Delete from a list it goes to the next
  record, not to its group. A note on why a record stays open (a comment not sent or not saved) is said aloud.

- **SvGrid Base: group totals of a paged grouped view are right after each write.** After a
  read that a slow backend had not answered when the next write asked for another, every
  later write kept the old rows and totals on screen for 10 seconds, so the totals showed
  the write before. The block cache now frees a read's slot when it gives that read up (in
  `@svgrid/grid`, below).

- **SvGrid Base: a paged view that cannot read its next part says so in view.** The tab bar
  says "Could not load *table*" with the reason and Try again, as a table read whole does,
  and the grid's "Could not load these rows." with Retry sits on the first row wholly on
  screen, not on a row above it.

- **SvGrid Base: a cold automation server sees its first change whatever the row carries.**
  An endpoint's row with a column no field names (a tenant, a sequence) made the first
  change after a start look like a change of nothing, and no rule ran.

- **SvGrid Base: a paged group of records that link to nothing reads "Empty"**, as a lookup
  group does, instead of a blank label.

- **SvGrid Base: an open trash follows a teammate's Delete forever and Restore.** It reads
  the table's trash again when the feed reports a change, and a record whose Delete forever
  stopped half way no longer reads "just now".

- **SvGrid Base: `queryRecords` counts from the other side of a link again, and its "is
  empty" agrees with its groups.** A count or rollup over records that point at a
  customer read 0 when the tables given to `queryRecords` held no such customer. A link
  grouped by id now groups by the id it stores. A view filter "is empty" on a link now takes
  a key to a record the linked table does not hold, as the Empty group and the cell do.
- **SvGrid Base: a paged table whose database stops answering no longer leaves an unhandled
  rejection behind.** The count read beside a grouped view's groups, the record read for a
  feed that sent only the changed fields, and the count read of a dashboard or calendar each
  failed with nothing waiting for them. A feed's record that cannot be read now makes the
  view read it again later, and an Undo of a cell the grid no longer holds says the database
  could not be reached instead of doing nothing in silence.
- **SvGrid Base: a block write of 20 records or more on a table the page holds offers Try again,
  and shows what the server stored.** A paste, a clear or an Undo of that many records that
  failed said so with no Try again, and two failed blocks of 1,500 records read as "2 changes". Now the notice
  counts records and Try again reads them first, sends what is still as it was, and says how
  many cells and records it left. Each block's records are read back once it lands, so a
  trigger's or a hook's value shows at once, and Undo finds it.
- **SvGrid Base: a new record not stored yet inside a range is no longer passed over in
  silence.** A range job left it out with no word, a paste over it shifted every line up a
  row, a fill from it emptied the cells it reached, and a copy dropped its line. Now the job
  says how many it left, a paste keeps its line for it, a fill takes its value, and a copy
  has its line.
- **SvGrid Base: a range job on Supabase or PostgREST counts and stops within 200 records,
  and stops when a record fails.** Differing values go one request each there, and a block of
  1,000 held the count and Stop for 1,000 requests. A failed request now stops the other
  fifteen at once, so the count of what landed is what the database holds, and a record a
  row level policy skipped is a failure, not a write that passed.
- **SvGrid Base: Delete or Backspace in an open single select empties it.** A click on a
  selected select cell opens it, and the key then did nothing.
- **SvGrid Base: Undo of a range or Edit fields on a server with a hook takes back what the
  hook stored.** It took the stored value for a teammate's and left it.
- **SvGrid Base: an undo no longer writes over a teammate's change made a moment after yours.**
  On SQL Server and MySQL a write is read back with a second statement, and a teammate's write
  landing between the two was taken for the answer to yours: Undo then thought the cell still
  yours and put your old value over theirs. SQL Server now writes and reads in one transaction
  of one batch. MySQL does with the source's `transaction`; without one the gap stays, and the
  docs say so.

- **SvGrid Base: day filters and a chart's months follow the viewer.** On `timestamptz` and
  `datetimeoffset` columns "is 8 March", "today" and a chart's months were the database's days.
  The page now sends each date condition with the moments its days start and end where the
  person is, and a chart reads each part of the span with one UTC offset in that offset. A date
  and a wall clock read as before.

- **SvGrid Base: a table keyed by both ends is a link to many.** A pair table with both key columns foreign keys is a link on SQL and Supabase, under a scope too, and a removed link deletes that one pair. Before, on Supabase it was a tab whose delete took every pair sharing the first column, and on SQL it stopped the whole base. Any other composite key, or no key, leaves that table out with a log line and the rest opens. `keys` names a unique column for such a table or a view. A table or view with no declared key, even with a column called `id`, is now left out until you do.
- **SvGrid Base: the page shows what the server stored.** After a typed edit, paste, Add row, record edit or undo the cell holds the row the server answered: a hook's value, a stamped tenant, a default. Undo goes back from that value. The tenant column shows and takes no edit, and hiding it no longer makes the table a `403`.
- **SvGrid Base: a self-linked record and its parent come back together.** The link check of a block counts the keys in that block, and a block writes parents first.
- **SvGrid Base: lists in `json` and `jsonb` columns.** A multi select, a vote or a sparkline saves on `pg`, `postgres.js`, MySQL, SQL Server and SQLite, cast by what the column is.
- **SvGrid Base: SQL Server sorts, filters and groups on formulas and lookups in SQL.** What it cannot say is refused at once, where the table used to be read into the page.
- **SvGrid Base: `maxPageSize` below 1,000 works.** The page follows the server's limit, on reads and on blocks.
- **SvGrid Base: Edit fields on Supabase is a request per 200 records** for records given one value, and a row level policy that skips a record stops the block and says so.
- **SvGrid Base: small server fixes.** A bad page or a private field name in a request is a `400`. A MySQL key past 2^53 links. A cross-site browser request is not believed for its `X-Forwarded-Host`. `isSecretColumn` knows `pass`, `userpassword`, `adminpass`, `apikeys`, `secretkey`, `pwhash`, `database_url`, `dsn` and `webhook_url`. The evaluation card builds no HTML string, so Trusted Types pass. A scaffold's theme script is a file, so a strict CSP passes. A PDF preview gives the focus back with the pointer over the file.
- **Compliance docs.** No GPG fingerprint is claimed, one security address, canvas use and the print popup stated as they are.
- **SvGrid Base: a table that cannot be read says so and stays said.** Where the records would be: "Could not load Deals", why, and Try again. No empty table, Add row or "Not saved" on the way.
- **SvGrid Base: Excel files hold real cells.** Numbers, percents, dates and times are numbers with the field's format, whatever a database driver gave as text: on Postgres, MySQL and SQL Server, held or paged, with lookups and rollups. A yes or no field reads the same word on every driver. A link, a select or a person with a number for a key reads by name, in CSV too.
- **SvGrid Base: a click to select a cell changes nothing.** The first click on a link, email or phone selects the cell, and the next one follows it. Ctrl or Cmd click follows at once and a double-click edits. A click on a checkbox's box, a star, a vote or a button acts at once; a click on the rest of the cell only selects it. A finger's tap follows the same rules.
- **SvGrid Base: a calendar's day sizes are the viewer's days.** On a column of moments (`timestamptz`, `datetimeoffset`) the sizes and each day's list follow the page's zone, across a change of the clocks. A date or a wall clock reads the same everywhere and is told as it reads.
- **SvGrid Base: a big change's automations show and stop.** The Edit fields question says how long the runs will likely take and what a closed tab means. The bar shows how far they are, with Stop, and the tab warns before it closes. Waiting runs no longer hold their records, runs on records in the page leave the tab its turns, and a run that cannot read its record no longer stops the ones after it.
- **SvGrid Base: memory comes back after a bulk edit.** The page keeps the changes of the latest 20,000 records of a table, and no key per record written.
- **SvGrid Base: a grouped view on a table read by parts reads like one in the page.** Groups in option order, drawn as the field draws them, with the records they hold at every level (a driver's COUNT as text included), and totals for the fields with a sum, an average, a lowest or a highest in the footer.
- **SvGrid Base: Undo says what a drag did.** A bar and the bars it pushed are one step, and a card or a bar reads "Undo move record". "Generate for all" on an AI field asks first when records hold values, and one Undo takes the whole run back.
- **SvGrid Base: a link kept in a `text[]`, `jsonb` or MySQL `json` column.** An `in` filter on one asks whether any value matches, so opening a Gantt on a self link no longer raises `malformed array literal`.
- **SvGrid Base: nothing shows under Apply in Edit fields.** The row now covers the drawer's padding.
- **SvGrid Base: a multi-column paste, clear or fill on a paged table writes every column.** It
  wrote the first column of each row and put the old value back in the others, with no message.
- **SvGrid Base: a range on a paged table is the whole range.** Paste, one value over a range,
  Delete, fill and Ctrl+Enter reach every record the selection covers, loaded or not, through the
  Edit fields dialog: read and written in blocks, with progress, Stop, a count at the end and one
  Undo step. They used to reach only the rows the page held, and "All changes saved" said nothing
  of the rest. Up to 200 cells of loaded rows stay instant, with no dialog.
- **SvGrid Base: a copy of rows not loaded reads them first.** It wrote blank lines and a $0.00
  for each. Up to 2,000,000 cells it reads with progress; past that it copies nothing, says the
  number, and points to Download.
- **SvGrid Base: Undo and Redo of a range do not freeze the tab.** A big range is one step that
  reads and writes in blocks, and on rows held in the page a step's cells go back in one pass.
- **SvGrid Base: a paste past the last row.** A line where no value fits makes no record. Past 10
  new records it asks first, with the number. They go in one block, and Undo takes them out in one.
- **SvGrid Base: a paste while a view reloads makes no record.** It says the view is loading. A
  write that reads the view again leaves the rows on screen until the new ones arrive.
- **SvGrid Base: a paste and a clear stamp last modified fields and the record's activity**, as a
  typed edit and a fill do.
- **SvGrid Base: Undo takes back the Try again of what it undid.** A press on that button wrote
  the undone value, with no step to undo. Esc during a drag of the fill handle or a range now
  cancels it.
- **SvGrid Base: Delete forever no longer cuts links on a record that comes back.** A teammate's
  Restore during the purge, a server failure at any step or a closed page could leave a restored
  record with its foreign keys empty, and a failed purge could overwrite a teammate's new link. The
  record is now claimed first, so no restore meets a half done purge, the keys are written only
  where they still hold what was expected, and the purge reports the ids it deleted.

- **SvGrid Base: a restore is not a creation.** Restore and Undo of a delete ran "record created"
  server automations, which rewrote the record. The first change after the automation server starts
  is seen too.

- **SvGrid Base: a record a teammate trashed no longer fails a block with "no permission".** Under a
  `scope`, a block skips it and finishes, as it does with no scope, and one record says it is gone.
  The audit log and `afterDelete` no longer name a record the delete did not change.

- **SvGrid Base: a link to a trashed record is empty everywhere.** "Is empty", "is not empty", one
  Empty group with no raw key, sort, count and the picker, on held and paged tables. An undo to a
  record deleted forever says so, with no key and no Try again, and a link written to a trashed
  record says why it shows empty.

- **SvGrid Base: your own edit with a lost answer is yours.** A read finds it landed: no failure, no
  Try again and no "changed by someone else". Undo of a hard delete no longer asks for a restore the
  table cannot do, and a write that was refused or found its record gone leaves no undo step.

- **Board: a keyboard move writes once, on the drop.** The arrows only show where a card is going, and
  `onCardMove` and `onCardReorder` fire when it is dropped, from where it was picked up. Escape used to put the
  card back on screen while the record kept the new lane. Tab or a click elsewhere puts it back too, focus stays on
  the card, and on a `server` board the drop marker shows the way until the drop.
- **Scheduler: Escape works past the edge of a view.** A carried event used to leave the view and take Escape with
  it. The view now follows the event, and Escape brings both back.
- **Scheduler: an all-day bar in Week or Day takes the keyboard.** Space opened it instead of picking it up, and it had
  no name with its date. It now moves as any event does; up and down move it a week.
- **SvGrid Base: a list read from a server takes Tab.** Flat or grouped it is one stop, on the record you were last
  on, and the arrows walk records, not the row buttons. Grouped lists read from a server also take Home, End, Right
  and Left. Right and Left swap in a right-to-left page.
- **SvGrid Base: Enter on a list row's button opens its menu**, not the record, and a selected row shows it and
  says "Selected".
- **SvGrid Base: focus no longer falls to the page.** The selection bar goes back to Delete after its question, and to
  where you were after Clear, Escape or a confirmed Delete. A sent form puts focus on its thank-you and says it. A
  dashboard tile moved by its buttons keeps focus on the button pressed, which at either end is off, so a second
  Enter does nothing.
- **SvGrid Base: a comment's question and Next.** Escape on "Delete this comment?" leaves the question, not the
  record, and focus starts on Cancel. Next and Previous wait for a comment being changed, and say so, instead of
  dropping the text. A click outside a record with text not sent says why it stays open.
- **SvGrid Base: small accessibility fixes.** A link chip in a list row is no longer a button inside a button, Add
  table keeps its 26 px on a phone, a mail link in a record is 24 px tall, and the Menu key cannot open the browser's
  menu over a card's. A record with no name reads "Untitled" everywhere.
- **Edit fields on a big table no longer freezes the page.** It runs in the dialog a delete uses, with progress and
  Stop. Past 10,000 records it asks first, with the exact number. A failure part way stops there, reads the block back,
  says how many records changed, and keeps Undo for those; it used to carry on, say none were saved and leave no Undo.
- **Bulk writes through `createBaseEndpoint` go in blocks.** `createMany`, `updateMany` and `deleteMany` carry up to
  1,000 records a request, and records given the same values are one statement. `authorize`, `scope`, `validate`,
  `checkWrite`, hooks and `audit` hold for each record as on a one-record write.
- **An edit, a paste, an undo or a redo deep in a big table is as quick as one at the top.** Each walked every row
  before it, several times over.
- **A calendar on a date-with-time field groups by day in the database** (`groupDays`, on every dialect), and a month
  moved past stops sending its days. `groupMonths` works on SQL Server and SQLite too.
- **`createSqlDataSource`: `updateRows` keeps the time** of a schema `date` over a timestamp on Postgres, where a cast
  dropped it, and writes records given the same values without a CASE. A block's statements carry the tenant.
- **The link picker's Enter waits for the server's answer.** On a table a server searches it took a row of the last
  search, or made a record whose name was there.
- **A table read a part at a time asks for 200 records a block by default,** not 100: a sorted read costs a sort of the
  table whatever it returns.

- **`createBaseEndpoint`: a junction table under a tenant `scope`.** A junction holding the tenant
  stays a link to many with `tenantColumn`, and one holding none takes `{ through: 'order_id' }`, so
  a pair belongs to the tenant of that record on every path. A `null` for a junction between scoped
  tables used to share every tenant's pairs: it is now a `403`, and the log says what to do.

- **`createBaseEndpoint`: a link stays inside the tenant.** A foreign key written through the route
  must name a record inside its table's `scope`, in blocks too. Another tenant's record and no
  record get the same `409` with `code: 'link-refused'`. Before, a tenant could point at another's
  record, block its delete, and learn which keys exist.

- **Base: a table keyed by a secret does not start.** A key named like a credential reached every
  reader, because a key cannot be hidden. Such a table is now left out, the log says why, and
  `exposeSecretKeys` serves it by name. A foreign key holding that value stays out too.
  `isSecretColumn` also knows `passcode`, `user_pass`, `session_key`, `activation_key`,
  `remember_digest`, `hashed_pw` and `mfa_seed`.

- **`baseFromSupabase` asks only for what it shows.** It read `*`, so a column `hide` held back still
  reached the page, and a table with a column `anon` may not read failed. `createSupabaseDataSource` takes
  `schemaColumns`, and a base sets it. A record brought back by undo gets a hidden column's default.

- **Escape closes a PDF preview.** Chrome's viewer took the focus as it loaded, and keys pressed there
  never reached the page. The focus now comes back to the dialog, unless a person went into the file.

- **`createKitHandlers` takes JSON from its own site only.** A `POST` that is not
  `application/json` is a `415`, and one from another site a `403`, on `vite dev` as well as in a
  build. A page on another host goes in `origins`. A caller of `handle` that sent no content type
  must now send one.

- **Server logs hold no value a driver quoted.** The handlers log codes and names, and take the value
  out of the text: a SQL Server or MySQL duplicate key, a Postgres `detail`, mysql2's `sql`.

- **A color from data cannot reach a style.** An option's color, a record's value used as a color and
  a label's color now go through `safeColor` on the Board, the scheduler, the Gantt, `SvBoard`,
  `SvRecordDetail`, `SvSchedule` and the automations dialog, and a spreadsheet file's formats through
  `entryToStyle`.

- **`GET` keeps an automation's outbound details from those who do not need them.** A webhook or
  an email is described only to a person `authorize` lets change the table, and an automation that
  runs on the server sends no URL, header or address to any page. `sharedTables` drops them too,
  with what a view said of a hidden field.

- **Print and the HTML export run no script.** A cell's link is `http`, `https`, `mailto`, `tel` or
  `blob` only, a rule's color cannot leave its attribute, and the document carries `script-src 'none'`.

- **`baseToSql` keeps a title inside its comment.** A table named with a line break could start a
  statement of its own in the downloaded file.

- **Compliance pages.** `gdpr.md`, `hipaa.md`, `soc2.md` and the compliance overview now say what
  holds for `@svgrid/grid` and what SvGrid Base adds. The doc site's host was wrong in `gdpr.md`.

- **SvGrid Base: the fill handle fills by the field, not by the look of the stored value.** One
  source cell copies in every field, so a person, an option, a color or a time no longer counts up
  to the next one. Two or more source cells continue a series in number and date fields and repeat
  in every other. A value the field cannot hold is not written, and the page says so. Ctrl+D copies
  down, and is one undo step.
- **SvGrid Base: a copy writes what the cell shows, and a paste brings the same value back.** Percent,
  duration, currency, date and time cells copy as shown, so Excel gets `50%` and `1:30`, and a paste no
  longer turns 50% into 1%. Inside a page the stored value comes back in full: 12.5% shown as 13%,
  bold in rich text, the right one of two people with one name.
- **SvGrid Base: one multi-line cell in is one cell out.** Copy quotes a cell holding a line break or
  a tab, and a paste reads quoted text, Excel's included, so the record below is left alone.
- **SvGrid Base: import keeps what a file says.** A date keeps its calendar day in every time zone, a
  percent reads as the grid reads it, a person matches by name or email, and a name that matches
  nobody is no longer stored as a person. Link fields can be mapped by the linked record's name. The
  dialog says how many cells it could not match. A type change from text to a date or a person reads
  the same way, and a rating stays within the field's maximum.
- **SvGrid Base: a downloaded view reads back to the same values.** A percent is written `12.5%` and a
  duration `1:30:15`, where the stored 0.125 and 5400 would read as something else in an import, and a
  name with a comma in a list is quoted. In Excel a percent stays a number with a percent format, and
  an import reads an Excel cell as it shows: a percent as a percent, a date cell as that date. A select
  option is known by its label as well as its value, so an import adds no copy of it.
- **SvGrid Base shows its own notices.** A host with no `<SvToaster />` now sees every failure, refusal
  and Restore. A host that has one keeps it, and nothing shows twice.
- **SvGrid Base: Add record in a grouped view goes to the new record's first cell.** A new record in a
  group of its own opened no editor, so typing pressed the button again and made blank records.
- **SvGrid Base: undoing a delete after a restore on another tab keeps both sides of a link.** Roll-ups
  on the other table were left short.
- **SvGrid Base: smaller things.** Space on a Vote cell votes. A click beside the number in a record's
  number editor keeps the edit. Enter in the new view's name closes the view menu. The undo button and
  the screen-reader message name a fill, a paste or a bulk edit by its cells, and a redo is said as a redo.

- **SvGrid Base: focus no longer falls to the page.** A dialog or menu whose opener went, or
  cannot take focus (a menu item, a row button hidden under the dialog, a field just deleted),
  hands focus to what held it, which is the grid, or to the next card. Pin, Hide field, Delete
  field, Expand record, Comment, a deleted card or calendar event, and Undo or Redo on the last
  step all leave the keyboard in place.
- **SvGrid Base: Remove on a dashboard tile takes the keyboard to its question,** which is read
  out. A second Enter cancels; it no longer lands on the next tile's buttons.
- **SvGrid Base: Escape in a comment keeps the text.** It leaves the box, and acts as Cancel on
  a comment being changed. Text not sent holds the record open against Escape, which then says
  why, and against a click outside.
- **SvGrid Base: cards and list rows keep the record's actions.** At a phone's width, in a
  gallery and in a list, the Menu key, Shift+F10, a long press and a button on the card open
  expand, comment, select, insert, duplicate and delete. Selection shows on the card and in the
  selection bar. `gallery.cardMenu`, `gallery.isSelected` and `gallery.text` are new.
- **Board:** "Add card to Lead" and "+ Add a card" show the focus ring. An empty lane no longer
  says it is a list. **Link preview, tooltips:** Escape closes a link preview, a grid tooltip, and
  a calendar or Gantt tooltip with the pointer still on it, and a pointer crossing the gap to a
  link preview keeps it open.
- **SvGrid Base:** a rating cell's name and a gallery's name are translated. Run now with no
  record writes "(no record)" for a field token, not the raw `{Deal}`. A view bar button reached
  at a phone's width comes fully into sight. A percent bar keeps its fill under forced colors.

- **SvGrid Base: a tenant's trash on MySQL and SQLite.** With `scope` and `softDelete` the tenant
  was bound before the ids, and `?` is matched by position, so Undo, Restore and Delete forever
  found nothing: a restore said the record was deleted forever, and a Delete forever reported
  success and left the row.
- **SvGrid Base: a soft delete leaves foreign keys alone.** It used to clear them in other tables,
  and a restore after a reload or by a teammate never brought them back. The clearing now happens
  at Delete forever, in the tables of the base. A hard delete is as it was.
- **SvGrid Base: a database's numbers show as stored.** Introspection reads a column's scale:
  `numeric(12,2)` holding 19.99 shows `$19.99`, not `$20`, and an integer shows no decimals. A column
  with no declared scale takes the places its values show. On SQL Server `money` has four. MySQL's
  `tinyint(1)` is a checkbox, a `time` column a time of day and never a select, and a Postgres
  `text[]` a multiple select that can be edited.
- **SvGrid Base: an insert whose answer was lost.** A read says whether it landed: the record is
  taken, what was typed goes to it, and nothing false is said. A key the database makes is found by
  the record's values, in a table the page holds. A 5xx with no code now says the server did not
  answer, not that the database refused, and a delete or an edit that landed is not told as a failure
  or as a teammate's change.
- **SvGrid Base: a refused undo shows the value it found.** Without a feed the cell kept the value the
  database no longer held.
- **SvGrid Base: JSON keeps every digit.** A `json` or `jsonb` column is read and written as text, so
  a number past 2^53 is not rounded by a read, an undo or an edit.
- **SvGrid Base: a notice goes with its base.** The toast queue belongs to the page, so a "Deleted ... Restore" or a Try again
  outlived the base that made it, and the next base on the page drew a button that did nothing. Restore now goes with its base, and a
  failure keeps its words, what was typed included, with no button.
- **SvGrid Base: smaller things from teams.** Someone who may not delete hears no error from the trash,
  and the panel says why it is empty. A permission refusal offers no Try again and leaves no undo step. A
  paged view with a filter drops a record a teammate moved out of it. A teammate's restore lands at the
  record's place. A Delete forever takes the "Deleted ... Restore" notice with it, and a number deleted
  in this page is not given to the next record while it stays open.

- **BREAKING: `scope` refuses an empty tenant.** A value of `''` used to drop the predicate,
  so a person with no organisation read, rewrote and deleted every tenant's rows. Now a
  resolver that returns nothing, or a rule whose value is empty, blank or not a single value,
  is a `403` on every read and write, and `createBaseEndpoint` leaves the table out of `GET`.
  Only `null` means no scope. `scope: (table) => ...` must return `null` for a table every
  tenant shares: returning nothing now closes it.
- **SQL Server runs.** `dialect: 'mssql'` wrote `LIMIT` and `RETURNING`, so nothing could. It
  now pages with `OFFSET ... FETCH`, reads a key back with `OUTPUT INSERTED ... INTO` (a table
  with triggers works), writes an identity key under `IDENTITY_INSERT`, stays under 2,100
  parameters and 1,000 rows, and keeps `datetime`, `datetimeoffset`, `bigint` and `decimal`
  exact. Run against SQL Server 2022. Formulas are worked out in the page there. Studio's
  connection string for it was a URL the `mssql` driver cannot read.
- **BREAKING: a PDF preview frames only bytes it read.** A file on another origin went into the
  frame as it was, and could draw a sign-in form under the base's own title and move the tab.
  A file the page cannot read, because its host sends no CORS headers, now offers a download.
- **An id from a client reaches the source as text.** A number was bound as a number, and on
  MySQL with a loose `sql_mode` `id = 0` matched every id not starting with a digit. An empty
  id is a `400`.
- **`patch: { id }` no longer changes a record's key.**
- **A webhook connects to the address it checked.** A name could answer one way for the check
  and another for the connection. On Node the call now goes to the checked addresses, and a
  name that does not resolve is not sent. More ranges are refused: `192.0.0.0/24`,
  `198.18.0.0/15`, the documentation blocks, `fec0::/10`, and IPv6 forms wrapping an internal
  address (`::a.b.c.d`, NAT64, 6to4, Teredo).
- **`isSecretColumn` knows more names.** Any `token` (`remember_token`, `token_hash`),
  `pass_hash`, `password1`, `pin`, `recovery_codes`, `credit_card`, `iban` and others. It reads
  the name only, and the docs now say that is a default, not a guarantee.
- **`createBaseEndpoint` takes `validate`, `hooks` and `maxPageSize`.** Writes through it could
  not be checked on the server. `validate: true` asks nothing of a `NOT NULL` column with a
  default, and a schema read from a database no longer marks such a column required.
- **A refused write says why, through an endpoint too.** A constraint was a `500` and "The
  database refused it". It is now a `409` with a `code`, and the person reads which rule it
  was, without the driver's words. An autonumber clash through an endpoint now takes the
  next number, as it does on a direct source.
- **Thrown text stays on the server.** A message thrown by `authorize` or `scope` reached the
  client, connection strings included. It now reads `forbidden`, unless the `Error` has
  `expose: true`.
- **A read has a ceiling.** `createKitHandlers` returns at most `maxPageSize` rows (20,000 by
  default) with the true count, so `pageSize: 1000000000` no longer reads a table in one go.
- **An alert rule's style is a color.** `red;background-image:url(...)` fired a request to
  another host each time a cell painted.
- **A group key that is an object is refused.** A driver could write one as SQL of its own.
- **A filter on a number past 15 digits compares exactly.** Rounded, a tenant id could be
  someone else's.
- **A scaffold's production build says what is closed.** It read "The database did not answer:
  403. Is DATABASE_URL set", which sent you to the wrong fix.
- **Two dev console warnings are gone**: `state_proxy_equality_mismatch`, once for each field
  of each table, and `ownership_invalid_binding` on `views`.
- **"Not in view (1 record)".** It read "1 records".
- **Forms take the mouse again.** Typed boxes ignored a click or a tap, and so did an
  open editor in a record. A star clicked in a form is now the answer; it used to open
  the editor.
- **A record's Account picker no longer links what nobody chose.** Enter on the list as it
  opened ticked its first record, and Done saved it. Enter now closes it unchanged, and
  a picker left as it opened writes nothing.
- **Focus no longer falls to the page.** Comments, a form's pickers, the form builder,
  dashboards, filter conditions, automations, attachments, import, the inbox and the
  field editor keep the keyboard on the logical next control, and comment changes,
  tile moves and form builder moves are said aloud.
- **Base has the fill handle its docs promise.**
- **The form builder's field list holds still.** A field turned off keeps its row, and back
  on it takes the place the row shows.
- **Timeline.** Delete on a bar asks first, as does Delete in a calendar's menu. A bar moves by
  Space and the arrows with one write, stands clear of the task table when focused, opens
  its menu with Shift+F10 with focus in it, reads as a table, keeps its shape in forced
  colors, and every word goes through the base's messages. A drop on a weekend stays
  there.
- **Attachments: Enter on Remove removes the file.** It opened the preview.
- **Dashboards ask before a tile is removed.**
- **Form number boxes read as the field does** ("25%", "$1,250.50") and edit in its units.
- **Escape in a number or a rating in a record leaves the box.** It closed the record.
- **Typing on a focused record field starts the edit**, and Enter in the field type search
  takes the first type.
- **A double-click on a week's all-day row adds an all-day record.**
- **Automations:** step buttons name their step, moves are said, and the open automation
  carries `aria-current`. **Delete record** ties its text to the dialog.
- **SvGrid Base: Edit fields writes to the ticked records and nobody else.** In a sorted,
  filtered or grouped view each value that landed moved its row, and the next one went to
  whatever had taken its place, so records nobody ticked changed and Undo wrote more wrong
  values. Every cell is now worked out first and written by record, in one write and one
  undo step, on tables in the page, on SQL tables and on tables read a part at a time,
  where Edit fields did nothing at all before. Text a field cannot read, such as `abc` in a
  number, stops the form with a message and writes nothing.
- **SvGrid Base: Delete, paste and fill stay on their records.** A row held under a typed
  edit but moved at once under Delete or a paste, so a second press hit another record.
  The row now holds until the cursor moves on, whatever wrote it.
- **SvGrid Base: a paste past the last row adds records,** as one undo step with the cells
  it wrote. It used to drop those lines without a word.
- **SvGrid Base: one rule for pasted values a field cannot read.** A number, a select, a
  date, a person, a link, a rating or a checkbox given text it cannot read keeps its value,
  and one notice says so. An unknown link name no longer wipes the link, and an unknown
  name no longer lands in a person field as a person nobody has.
- **SvGrid Base: a write with no answer is not given up on.** A write past `writeTimeout`
  stays out: later writes to its record wait behind it, writes to other records go on, and
  the status says so. It can no longer land late over a newer value, a late insert leaves
  no second record behind a Try again, and a late delete keeps its copy in the trash until
  the outcome is known. A rollback now leaves a value written after the failed one.
- **SvGrid Base: the undo guard fails closed.** A cell undo reads the record first, with a
  feed or without one, and is refused with a message when that read fails, so a feed down
  without a word can no longer take a teammate's value out. The step stays the next to try.
- **SvGrid Base: Try again checks first.** It reads the record, leaves a value that changed
  since, whoever changed it, and says so, also when the record was deleted.
- **SvGrid Base: a failed read before a delete stops the delete.** That block stays, and
  the person is told, instead of going ahead on a stale copy.
- **SvGrid Base: editors in a record are held for.** A teammate's change waits while a field
  of the record view is being edited, as it does for a cell.
- **SvGrid Base: fewer false "changed by someone else".** A number the database rounded, a
  person's own undo on a table read a part at a time, and a feed's word on an earlier write
  of the same record are no longer reported as a teammate's. A read that started before a
  write no longer puts the old value back. Undo refused "alone" after 1.234 in a column of
  two decimals goes through.
- **SvGrid Base: undo and redo run no automation.** A redo of a status change added its
  checklist items again on every press.
- **SvGrid Base: a second restorer is told nothing is wrong.** Two people restoring the same
  record at once: the second sees it back, not "Another record already has this value".
- **SvGrid Base: wrong words on the history.** A column resize read "Undo cell edit", and a
  redo was logged as "undid".
- **SvGrid Base: soft delete keeps a record's junction links.** A delete of a record marked
  with `softDelete` dropped its junction rows and a restore did not put them back, so tags
  were gone after a reload. Junction rows now stay, at either end of the link, and a restore
  writes nothing. A marked record shows in no link. Delete forever removes them with the row.
- **SvGrid Base: Delete forever is final, and only once the database says so.** A purge the
  database refused left the record marked with no way to reach it, under a notice saying it
  was in the table. The item now stays in the trash until the purge is confirmed, the notice
  says so, and in one Empty trash the free records still go. Ctrl+Z could put a purged record
  back from the page's copy: the undo step now ends, and a stale undo in another window
  refuses. A single Delete forever now asks first, as Empty trash does.
- **SvGrid Base: the trash of a soft delete table reads the table.** Marked rows show after a
  reload with no trash store, for whoever may delete. **Behaviour change:** those rows appear
  in the trash, those marked by other tools too. They do not age out: `trashDays` still only
  purges what the page's trash holds.
- **SvGrid Base: `softDelete` on `createBaseEndpoint`, `baseFromDatabase` and
  `baseFromSupabase`.** The endpoint could not use soft delete at all. The column stays out
  of the fields, and the description tells the page.
- **SvGrid Base: the mark cannot be written.** With the column on the schema a client could
  create a record already deleted, or mark one through an update. `createSqlDataSource`,
  `createSupabaseDataSource` and `createKitHandlers` now leave it out of every write.
- **SvGrid Base: teammates hear of soft deletes.** A restored record reached a table read a
  part at a time only on a reload-style feed, and a delete through `createKitDataSource` stayed
  on teammates' screens. `createKitHandlers` now says which column marks records and the page
  learns it. `apply({ type: 'update', id })` reads that one record, which is how a feed reports
  a junction change; `baseFromSupabase` listens to junction tables by itself.
- **SvGrid Base: a new record does not take a marked record's number.** On a table the page
  holds it did, and the restored record was renumbered. Autonumber now reads past marked rows
  on Kit and Supabase too.
- **SvGrid Base: a very large soft delete purges a block at a time.** Closing the page used to
  leave everything not yet purged marked.
- **`createKitHandlers`: restore and purge tell the server what happened.** **Behaviour
  change:** the `audit` hook now gets `restore` and `purge` actions, one entry per record that
  really changed, in place of `update` and `delete` with ids joined by commas, and a purge of
  another tenant's id logs nothing. `beforeDelete` and `afterDelete` run on a purge with
  `purge: true`, and `beforeRestore` and `afterRestore` are new. On a table with no `softDelete`
  `restore` and `purge` answer 405.
- **SvGrid Base: formulas and lookups through `createBaseEndpoint` run in the database.**
  A sort on a formula read the whole table into the page, because the server's source
  was never told the base's fields. It now works from the fields the server holds (the
  `svgrid:` comments, or the new `computed` option for MySQL and SQLite) and says which it
  works out in `serverComputes`. A request names a field and brings no definition. A link
  is followed only for a person who may read the other table, and not into a table
  `scope` covers. A field changed in the page goes back to being worked out in the page.
- **SvGrid Base: a sort, group or negative filter on a lookup reads the other table once.**
  Sorts and groups use a `LEFT JOIN`, and "does not contain", "is not", "is empty", "is
  none of" and "not equal" a `NOT EXISTS`, in place of a subquery per record. A record with no
  link, or a link to a record marked deleted, matches as it did.
- **SvGrid Base: a view counts once per query.** A block read asks for rows alone once the
  view has its count. The count is read again after a write through the page, a change
  from a feed, a block that does not fit it, or 30 seconds. With no feed, a teammate's new
  record reaches the count in that time, at the next read.
- **SvGrid Base: blocks read their keys first.** A read with text copies or a join finds the
  block's keys, then reads those rows, so a sort or an `OFFSET` no longer carries whole rows.
- **SvGrid Base: a date condition compares the column to a range** on Postgres and MySQL,
  so an index on it serves a calendar and a filter. `DATE(col)` and `col::date` could not
  use one. SQLite keeps `DATE()`, which reads the offsets in its text.
- **SvGrid Base: a read nobody waits for stops.** `execute` gets `{ signal }` on reads, no
  further statement of a stopped read is sent, and `createKitHandlers` passes
  `request.signal` on.
- **SvGrid Base: a chart on dates is one grouped statement**, and group charts, board lanes
  and calendar days no longer run a count they do not use. A dashboard reads its tiles
  once as it opens, and tiles on one query share its count.
- **SvGrid Base: a view switch shows no old count or rows** under the new view's name.
- **SvGrid Base: a bulk delete reads by key** in place of a growing `OFFSET`, with a count at
  each end of the read.
- **SvGrid Base on MySQL: a descending sort reads an index backwards.** Its tie-break on the
  key follows the sort's direction there, so records with the same date now come newest
  key first. `date DESC, id ASC` sorted every row.
- **`baseFromDatabase` and `createBaseEndpoint` open a MySQL database.** The column read used
  `generated`, a reserved word, as a bare alias, and MySQL refused the statement.
- **`createBaseEndpoint`: the first description no longer groups a unique column.** A column
  that shows more than 12 different values in a sample of 5,000 rows cannot be a select.

- **Server row model: a drag of the scrollbar reads where it stops.** A jump of more
  than a block waits for the viewport to stand still (`leapPauseMs`, default 60), a
  read the viewport has left stops through `request.signal`, and the rows on screen
  go first in the queue. Placeholder rows keep their row number and line up with the
  columns.
- **SvGrid Base: Gallery, List, Inbox, Board lanes and the Timeline read ahead of a
  scroll,** further the faster it goes and the slower the source, and a drag of the
  scrollbar reads where it stops.
- **SvGrid Base: a typed column or view filter waits for a pause,** as the search box
  does; a pick from a list applies at once.
- **SvGrid Base: a busy calendar asks for its days' sizes in one grouped request.** It
  skips empty days, and after a write reads only the days whose size moved. A record
  with an end date, or a backend that does not group, stays a read per day.
- **SvGrid Base: reading a table through in the page keeps 4 requests open** past the
  first blocks, instead of waiting for one at a time.
- **SvGrid Base: a Calendar and a Timeline no longer stay in memory after a view
  switch** on a Svelte older than 5.57.2 by these two routes. Svelte 5.55 to 5.57.1
  keep other parts of a destroyed grid linked as well: use 5.57.2 or later.
- **SvGrid Base: every record action from the keyboard and on touch.** The Menu key
  and Shift+F10 open the record menu with focus in it, the row number has an actions
  button on a touch screen, a long press opens the menu, and the record view can
  delete its record. The field menu and the table menus take focus, walk with the
  arrows and give focus back. A field moves from its menu or from Hide fields.
- **SvGrid Base: the rows are one tab stop.** Tab goes on to the header and footer
  controls; it walks cells after a click or in an open editor, and says the way out.
- **SvGrid Base: forms have real inputs.** Typed fields are labelled inputs with
  required and invalid states and autofill; a failed submit goes to the first error
  and reads it out.
- **SvGrid Base: what changes is said aloud.** Edits, clears, pastes, undo and redo
  reach a screen reader, and a calendar event moves only once picked up with Space.
- **SvGrid Base: contrast.** Text on a filled accent control now follows
  `--sg-on-accent`, and accent-colored text in the chrome is plain ink. Text on a colored
  pill or bar stays white on saturated colors, by design; the VPAT gives the ratios.
- **SvGrid Base: forced colors, right to left, translation.** Switches, the active
  tab and view and the "+" keep their state under forced colors. Arrow keys and the
  pin line follow `dir="rtl"`. `setBaseMessages` now reaches the grid's own menus,
  find bar and labels (`grid.*`) and the calendar (`viewbar.calendar.*`).
- **SvGrid Base: smaller fixes.** Focus stays in the grid after a delete, panels hold
  Tab, Search moves into the find bar, targets are 24 px, an IME composition keeps
  its Enter, and a calendar on a phone keeps its title on one line.
- **SvGrid Base: a select option has an identity.** Renaming one in the field editor renames it on every
  record, in a multi select too, keeps its cards in their lane, and reaches the view filters, condition colors,
  form logic, dashboard tiles, automations and the field's default that name it. Removing one says how many
  records hold it, next to Save, and clears them. Undo takes it all back. On a table in a database it is a write
  to each record holding it, a block at a time. A card whose value is no option goes to Uncategorized, not off
  the board.
- **SvGrid Base: views show the data.** A board, calendar, timeline and gallery follow an undo and a record edit
  at once. Calendars and timelines leave undo to the base, so a drag is one Ctrl+Z and not two that cancel out.
- **SvGrid Base: sort, filter and group apply again after an edit**, holding a grid row only while it is the
  active row, and the count follows. An undo reaches a record the view no longer shows.
- **SvGrid Base: the bulk bar is part of a base.** Ticking records shows it, with Delete, in every template,
  and never the developer note. `selectionBar={false}` turns it off.
- **SvGrid Base: a formula reads names.** `{Account}` and `{Owner}` give what the cell shows, not record and
  user ids.
- **SvGrid Base: deleting a field says what it drives**, by view and automation. A view asks in its own row, goes to
  the trash, and is one step of undo. A field deleted from a view no longer leaves it saying "Colored by field".
- **SvGrid Base: columns resize and move by drag** by default, and a restored field goes back to its place.
- **SvGrid Base: Hide fields keeps its rows still** while fields are switched.
- **SvGrid Base: the warning for a type change sits next to Save**, in sight.
- **SvGrid Base: comments can be edited and deleted by their author.** `update` and `remove` on a comment store.
- **SvGrid Base: activity stays true.** An undo and a redo are noted, and a local edit shows old to new.
- **SvGrid Base: Timeline is in Create in every base**, its renderer loading on demand, and the roadmap template's
  Timeline is one.
- **SvGrid Base: a form builder.** "Customize form" sets the title, the words and the fields, their order and which
  are required. An empty form does not send.
- **SvGrid Base: Space on a group row opens nothing**, where it opened an empty record that lost what was typed.
- **SvGrid Base: smaller things.** The link picker takes arrows and Enter and keeps its size, and a second click no
  longer closes it. A link cell selects on the first click. One click sets a rating in a form. Next and Previous on a
  card walk the board. Find and the field type search take the focus. A
  header opens its menu on a right click. New groups start open. The row height menu marks the current height. A
  multi-day event's tooltip says its days.
- **The schema is the whitelist, for reads and writes (breaking).** `createSqlDataSource` names
  the schema's columns in every `SELECT` and `RETURNING`, and drops every key off the schema
  from a write. A group level off the schema is refused with `leafCounts` too. A trusted
  source in the same process as the page can ask for the old behaviour with
  `wholeRecords: true`; `createKitHandlers` refuses to start on one.
- **Nothing a client sends reaches a private key.** `createKitHandlers` strips `__svgrid*` keys,
  keys off the schema and `readonly` fields before `authorize`, `validate`, hooks and the
  source see the row, so a write can no longer cross a `scope` or swap a validated value. A
  write left with nothing is a 422. A `scope` field off the schema refuses the request.
- **Handlers no longer send driver text (breaking).** A failure is logged on the server and the
  client gets a plain message. A record that is gone is a 404 with `code: 'row-not-found'`,
  which `createKitDataSource` keeps on its error. A request off the schema is a 400 that says so.
- **`createBaseEndpoint` starts closed (breaking).** It refuses to start without `authorize` or
  `public: true`, and without `tables` or `allTables: true`, with a message that says what to do.
  `GET` asks `authorize` and describes only the tables it allows. A table `authorize` gives no
  guard for is closed. It takes `scope`. Columns named like a credential stay out of a base
  (`hide`, `isSecretColumn`): never the primary field, never sampled as options, and through the
  endpoint not read or written. A field with `hidden: true` is no field of a base.
- **A record's text cannot name a secret.** A webhook fills its URL, headers and body in one pass,
  so `{secret:DATABASE_URL}` typed into a field goes out as that text.
- **Server webhooks stay off internal addresses (breaking).** `createAutomationServer` refuses
  private, local and link-local addresses, by name and by what the name resolves to, and does not
  follow redirects. `allowInternalWebhooks: true` opts out.
- **A PDF preview runs nothing.** A file is read first and framed as a copy typed by us, only if
  its bytes are a PDF. An HTML file calling itself a PDF offers a download.
- **Hidden fields and tables stay out of search, Download as SQL and the row number tooltip.**
  `lockViews={false}` on `SvBase` is honoured with `tables`. `permittedRecords` is what to send
  from a server; `permittedTables` keeps hidden values in its records, and the docs no longer
  point at it for that.
- **A CSV is read for what it is.** The separator and encoding are found and shown to change. A
  quote inside a word is text, and a quote never closed no longer swallows the file. Rows that do
  not fit the header, values a field cannot hold, records that repeat a name, a file that is not
  UTF-8 and one that is not text are all reported before the import. A decimal comma stays a
  decimal, and `1,50` is no longer read as 150. `readImportMatrix` returns `delimiter`,
  `encoding` and `warnings`. Errors from a bad .xlsx or JSON file read as sentences.
- **Large tables.** Import, summaries, dashboards, chart axes, rollups, pivots and spreadsheet
  ranges no longer throw `Maximum call stack size exceeded` past about 120,000 values (`maxOf`,
  `minOf` in place of `Math.max(...values)`).
- **Download a view.** The list of tables has CSV and Excel downloads of the shown view: its
  fields and records as they read on screen, formulas, links, people, checklists and attachments
  included. `recordsAsShown` gives the same in code.
- **Smaller holes.** A protected field is not asked in a form of someone not on its list. A paste
  outside a select's options is not written. Rich text in a base keeps no `class`, and an image on
  another site becomes a link instead of a request. A color from data that is more than a color
  is dropped. JSON import no longer fills `constructor`-like columns from the prototype, and a key
  first seen late in a file is a column.
- **SvGrid Base: opening a cell and leaving it writes nothing.** A number, bigint,
  time, timestamp, date or JSON value used to be rewritten as the editor showed it.
- **SvGrid Base: a number is stored as typed.** 19.99 in a field that shows one
  decimal stays 19.99; only an integer field rounds. A number past 15 significant
  digits stays exact as text, in the cell, the box and the write. A rollup with a
  `precision` keeps the linked field's symbol.
- **SvGrid Base: dates and times no longer change with the browser's zone.** Dates,
  times, bigints and decimals are read as the database writes them, so a naive
  timestamp shows one wall clock everywhere, a typed time keeps it, and an undo or
  restore writes back what was read. On PostgREST a bigint past 2^53 is read again as
  text.
- **SvGrid Base: dates read as people type them.** `12/24/2026`, `2026-12-23`,
  `Dec 22, 2026` and `12/21` all work in the new date editor (`fieldDate`), and text
  that is no date says so.
- **SvGrid Base: cell keys.** Enter on a selected cell opens its editor, a key typed on
  a date or link cell starts editing, and Space ticks a checkbox cell.
- **SvGrid Base: JSON in a text field shows as JSON** instead of `[object Object]`, and
  the Delete key leaves NULL as NULL and empties a number or date column without an error.
- **SvGrid Base: a record added or deleted survives a view switch.** On a table the page
  holds, the grid went back to its `data` on any option change, so records added (by the
  row, Duplicate, a Kanban card, a form) vanished and deleted ones came back. What the
  grid holds is now what it is handed.
- **SvGrid Base: Undo and Redo leave a teammate's cell alone.** A cell changed since keeps
  the later value and the page says so, cell by cell in a paste. Without a live feed the
  page reads the record first.
- **SvGrid Base: a record's way back is whole, and safe.** Undo and restore on a table the
  page holds write every column read, under the record's own key, and the record stays in
  the trash until the database has it; a failed undo can be pressed again. A restored
  record whose Autonumber was given out again takes the next one.
- **SvGrid Base: the trash gets the record as it is at the delete.** A delete reads the
  records at that moment, also after a confirm dialog, and a record moved out of a bulk
  choice while the question stood stays.
- **SvGrid Base: typing is safe from teammates.** Changes from others, by feed or by a read,
  wait while a cell editor is open, so what is typed is not cut short. If the record went
  meanwhile, the person is told, with their text.
- **SvGrid Base: a delete that did not happen is not reported as done.** One a row-level
  policy skipped, or the database refused, stays in the table and out of the trash, and the
  notice comes after the delete, not before.
- **SvGrid Base: failures a person can act on.** A failed write names the record and the
  field in plain words, shows what was entered and offers Try again; "Not saved" stays until
  that record is written. A write with no answer warns and then lets the rest go
  (`writeTimeout`).
- **SvGrid Base: Ctrl+Z of a new record on `NOT NULL DEFAULT ''`.** An emptied cell goes back
  to what the database gave it, not to NULL.
- **SvGrid Base: the trash tells the truth.** With nothing keeping it, the panel says items go
  with the page.
- **Supabase: the find box takes `%`, `_`, commas, quotes and brackets as text**, and a table
  with text keys can add records with default options.
- **SvGrid Base, smaller things.** The selection bar counts on a table the page holds, a draft
  shows no number until it has one, and a write coming back in the database's words (`5.00`
  for 5) is nobody else's change.
- **SvGrid Base: a group on a date opens on its records.** On Postgres and MySQL the
  key of a date field's group went through a JS Date, so it lost what is past the
  millisecond and took the page's zone, and outside UTC the group read nothing. The key
  is now text the database writes and compares. A delete can also leave out any group
  at any level: every source reports a group's records as `leafCount` when a base asks.
- **SvGrid Base: two people adding at once do not share an Autonumber.** They could get the
  same number. Each record is checked once stored and the later one moves on; a UNIQUE
  column refuses the second and the write tries the next number.
- **SvGrid Base: Undo of an added record keeps a teammate's work.** One someone has
  changed since stays, with a message, and Redo does not add it twice. Redo of a delete
  puts the records in the trash as they are now, not as they were.
- **SvGrid Base: Undo brings times back exactly.** A delete reads time columns as the
  database writes them, so microseconds and a local time the clocks skipped survive on
  every Postgres and MySQL driver. `dateStrings` is no longer needed.
- **SvGrid Base: Undo works on a server in any language.** Generated columns are read
  from the schema and left out before a write, and a refusal is told by its error code.
  `createSupabaseDataSource` keeps the code on the errors it throws.
- **SvGrid Base: Undo leaves other people's work alone.** Undoing a step on a table held
  in the page put back a snapshot of all its records, which took out whatever teammates
  had changed since, and wrote that to the database. A step now undoes what it did and
  nothing else, and a new record closed empty takes only itself out.
- **`createSqlDataSource` on MySQL.** Writes ended in `RETURNING`, which MySQL does
  not have, unless you set `returning: false`. That is now the default there. A
  record with an auto-increment key now gets the key the insert made.
- **Formula text in SQL.** A string in a formula could break out of its literal on
  MySQL through a backslash, and a pivot key from stored data the same way. Both are
  closed, on every dialect.
- **Formulas in SQL say what a cell says, or leave it to the page.** Functions whose
  results differ between a database and a cell (`UPPER`, `FLOOR`, `TODAY` and others,
  listed in the docs) no longer run in SQL.
- **`createSqlDataSource`:** a filter on a column the plan does not know is an error
  and not a wider answer; `in` with an empty list matches nothing; `notEquals`,
  `notContains`, `endsWith`, `isNotBlank` and `notIn` run as themselves and no longer
  as `contains`; a blank group key matches NULL and ''; `updateRow` on a record that
  is gone is an error with `code: 'row-not-found'`; `createRows` keeps a column's
  default. A filter or sort on a field added at run time works.
- **SvGrid Base:** a write the database refused no longer reads as saved after a later
  edit; records in the trash leave it only once they are proven back, whole, with the
  columns the base shows no field for and under the key they had; times go back as they
  came on MySQL and on Postgres; junction links come back with a restored record and
  survive a refused delete; a table whose records have no id of their own no longer
  breaks the grid or the trash; writes still queued
  when the page leaves finish, and the browser asks first; a form says so when the
  database refused the record; a field named ID no longer writes over the record's
  key; a formula edited on a big table runs at once, in the database too.
- **Scrolling a very long list.** In a gallery, list, board lane or timeline past the
  height a browser scrolls, the scrollbar and the list stopped agreeing near both
  ends. A scrollbar step there now moves the list by the same step.
- **SvGrid Base: a table of a million records scrolls without stalls.** With
  `serverRows`, the view bar counted records by reading every row of the
  server row model, each one made on read, on every block that arrived; the
  record view looked for its record the same way. The count now comes from
  the server (`rowCount`, and the top groups' counts when grouped), and the
  record view looks near the row it was opened from first. Number, currency
  and date cells also keep their `Intl` formatters instead of building one
  per cell. In demo 723 (a dev build, one laptop), 40 wheel steps went from 9.3 s of blocked main
  thread to about 0.1 s, and opening the filtered view from 6.5 s to 0.5 s.

- **SvGrid Base: switching views on a big table no longer freezes the page.**
  A grouped view on `serverRows` set a row height per row and opened its
  groups, and both read every row of the row model; now it keeps one height
  and leaves server groups closed, since each opens with a request. A board
  of more than 200 records draws only the cards in sight in each lane (the
  board measures a card when `cardHeight` is not set). The board also keeps
  each card's key instead of working it out on every read. In demo 723 (a dev
  build, one laptop), the slowest switch went from 3.2 s to 0.4 s.

- **SvGrid Base: a view that left out part of its state kept the last view's.**
  A view declared with only `grouping` took over the sort, hidden fields and
  other state of the view before it. Whatever a view's `state` leaves out
  now starts plain. A saved view is unchanged: it stores all of it.

- **SvGrid Gantt: the task table's header stays at the top.** It scrolled away
  with the rows in any plan taller than the chart.

- **SvGrid Base: a record past what a table read was taken for a deleted one.**
  When a table on a `source` was read again at its limit, a record that had
  moved past the limit was dropped from the page and reported as deleted.
  A read at the limit now keeps the records it did not see.

- **A pivot filtered its rows again for every column.** For each row group,
  `createPivotModel` went through the group's rows once per column-axis leaf.
  The rows are now bucketed by column path in one pass, in the same order,
  and the result is the same. On one laptop, a pivot of 100,000 rows over
  Year x Month went from 3.6 s to 0.6 s, and 1,000,000 rows from 147 s to
  4 s.
- **A grouped Excel export slowed down with the square of its rows.** The
  writer looked up each string cell's shared-string index, and checked the
  group rows already written, by scanning an array. Both are hash lookups
  now and the file is byte for byte the same. A 10,000-row export grouped by
  five columns went from 4.8 s to 0.45 s, and 100,000 rows finish in 9 s.
- **A sheet chart hung below the window was not drawn until a scroll.** The
  sheet measured its objects once after mount, from their anchor cells, and
  the grid now adds most of its overscan rows a frame after its first paint;
  a chart hung from a row in between had no cell to measure. While an object
  has no box, rows the grid adds now measure it again.

- **A wide grid lost columns in the PDF.** pdfmake sizes a column no narrower
  than its longest word, so a 22-column report ran off the right edge and only
  15 columns printed, without a warning. The columns are now fitted to the
  page (see `pdf.fit` above).
- **A row taller than a page was missing from the PDF.** Rows are kept whole
  on a page, and pdfmake drops a row that cannot fit on any page. Such a row
  now breaks across pages.
- **Conditional-format icons printed as empty boxes in the PDF.** The arrow,
  triangle and traffic-light glyphs are not in Roboto; they are drawn as
  shapes now.
- **The PDF footer could show yesterday's date.** It printed the UTC date, so
  an export after midnight east of Greenwich was dated the day before. It
  prints the local date, and the footer follows custom page margins.
- **Grouped PDFs dropped conditional formatting and links.** They now carry
  both, as flat exports do.
- **Booleans printed as "true" and "false" in the PDF.** They print a tick or
  nothing, like the grid's checkbox. An icon set's `iconOnly` is honoured too:
  it printed the value next to the icon.
- **A number or date column passed in `columns` without `align` printed
  left-aligned in the PDF.** It right-aligns from its `format`, as on screen.
- **A pivot chart drew an empty cell as a zero bar.** An average over no rows
  is `null` in the pivot and the bridge read it as 0; it is a gap on the
  chart now. A sum over no rows stays the 0 the engine wrote.

- **PDF export depended on pdfmake's fonts registering themselves.**
  `pdfmake/build/vfs_fonts` registers its font map only as a side effect of
  being imported while a global `pdfMake` already exists, and the export's
  own lookup for the map never matched the shape the module has shipped since
  pdfmake 0.2.8 (the module is the map), so it registered nothing and relied
  on that side effect. Under a bundler the global can be a stale instance (a
  dev server re-optimising its dependencies mid-session is enough), and the
  export then failed with "File 'Roboto-Medium.ttf' not found in virtual file
  system" while its promise never settled. The map is now found in every
  shape the module has had (`resolvePdfVfs`) and handed to the instance that
  creates the document (`registerPdfFonts`, through `addVirtualFileSystem`
  and the `vfs` property), and an installed pdfmake whose fonts module has
  no map is reported instead of failing later.
- **Studio emitted no theme for the fragment export and the CLI `add`
  scaffolds.** Only the full app's `+layout.svelte` carried the `--sg-*` tokens;
  `eject --fragment` (which drops that file) shipped an `app.css` with one
  hard-coded accent, and `svgrid-studio add` / `add --all` wrote none at all. The
  tokens now come from one helper (`themeTokenCss`): `src/app.css` carries them
  for the full app and the fragment, and the `add` scaffolds emit them in
  `<svelte:head>`. Drop-in outputs wrap them in `@layer svgrid-studio`, so a host
  app that already defines its own tokens keeps its look. `add` also honours
  `--theme` / `--dark`, and a project with no theme picked gets Ember (the demo
  theme) instead of Tailwind.
- **Scheduler column alignment.** The all-day lane, day/time-grid header, and
  body columns now reserve the scrollbar width consistently, so the columns line
  up instead of drifting by the scrollbar's width.
- **Excel export color-scale conditional formatting.** A color scale's `min` /
  `mid` / `max` are optional, so the export could build an `(string | undefined)[]`
  where a `string[]` was expected; it now falls back to the same `#ffffff` /
  `#000000` defaults the grid renders with. Because `@svgrid/enterprise` ships its
  `src`, this had surfaced as a stray `svelte-check` error in consuming apps - a
  clean app now type-checks with zero errors.

#### Security

- **SvGrid Base: a pair table with the tenant in its key could be read and changed by another tenant.**
  On `order_tags (tenant, order_id, tag_id)` with `tenantColumn` and a scope, the pair id a client sent
  overwrote the scope's tenant, so an editor of tenant B read tenant A's pairs by id and deleted them
  with `delete` and `deleteMany`, on Postgres, MySQL and SQL Server. The scope now wins: an id naming
  another tenant's pair reads nothing, and a delete of it is a `403`, as on a `{ through }` pair.
- **SvGrid Base: a `{ through }` pair read could hand out another tenant's key.** A pair written
  straight into the database between tenant A's order and tenant B's tag reached A in raw rows. A read
  of a junction (a pair table, or one with its own key) now leaves out a row whose other end is a record
  of another tenant, where that end's table holds its own tenant column. Delete forever still clears
  such a row.

- **A crafted .xlsx could crash the tab.** `importData` and the spreadsheet's
  File > Open filled every gap before a cell with blanks, sized by the cell
  reference in the file: `<c r="ZZZZZZZ1">` asked for about eight billion.
  `importData` now rejects a cell past column XFD; the spreadsheet skips a cell
  outside the sheet, as it does other malformed parts. Both refuse a sheet that
  would need more than ten million blank cells to lay out.
- **A zip bomb could exhaust the tab's memory.** Every .xlsx and .ods reader
  (`importData`, File > Open, `documentFromXlsx`, `documentFromOds`) unzipped
  each part whole before looking at it, so a small file whose parts inflate to
  gigabytes was read into memory first. Parts are now unzipped as a stream and
  counted as they inflate; a file whose parts pass 256 MB together is refused
  at that point.
- **CSV and TSV from `exportData` neutralise formula-like text**, through the
  same `@svgrid/grid` serializer (see the grid's Security entry).

### @svgrid/grid-wc

#### Added

- **`<sv-chart>`**, the standalone chart as a custom element, at
  `@svgrid/grid-wc/chart` with React (`/react/chart`), Vue (`/vue/chart`)
  and Angular (`SvChartComponent`) wrappers. Its surface is generated from
  `SvChart`'s own props type the way `<sv-grid>`'s is from the grid's, so the
  26 props and 7 events stay in step; `spec` is a property, the primitives
  are attributes, and a prop that takes a boolean or a string (`legend`) keeps
  a string attribute where a bare attribute means true. Its own build in
  `dist/chart` carries none of the grid.
- **Typed event handlers.** Each wrapper's `on<Event>` prop used to be
  `(detail: unknown) => void`, so reading `newValue` meant casting first -
  a poor advertisement for a typed wrapper. The detail type is now lifted from
  the grid's own callback signature, so 16 of the 19 events arrive fully typed
  (`TData` degrades to `Record<string, unknown>`; anything referring to a
  type that only exists inside `@svgrid/grid` stays `unknown` rather than
  naming something a consumer cannot resolve).

- **React, Vue and Angular components**, as subpath imports:
  `@svgrid/grid-wc/react`, `/vue` and `/angular`. Each is generated from the
  same surface as the elements, so all 98 properties and 20 events are typed
  props on every one of them and none can drift from the grid. Each framework is
  an OPTIONAL peer dependency, so a plain-HTML consumer installs none of them,
  and the wrappers are 1.3-3.7 KB gzip because they reuse the one element bundle
  rather than shipping a second copy of the grid.

  They exist because a raw custom element is genuinely awkward in each:
  **React 18 and earlier stringify object props onto attributes**, so
  `columns={cols}` silently becomes `"[object Object]"` and the grid renders
  empty; **Vue** needs `isCustomElement` build config and a `.prop` modifier
  on every object binding; **Angular** needs `CUSTOM_ELEMENTS_SCHEMA` in every
  component that shows a grid, and gets no typed inputs. The Angular wrapper is
  compiled with ng-packagr in partial-Ivy mode, so it is consumable by a normal
  Angular build, and its selector is the element's own tag - `<sv-grid>` and
  `<sv-grid-shadow>` - with no template of its own, so there is no extra wrapper
  element in the DOM and the tag is the same one you write in plain HTML.

  All three also handle two ordering problems a hand-written wrapper meets:
  the element renders BEFORE a framework assigns properties in an effect, and
  `apiready` fires once during that first mount - before React can bind a
  listener at all. The handle is parked on the element and each wrapper replays
  it.
- **The package ships TypeScript declarations.** It previously had none, so
  `import '@svgrid/grid-wc'` was an error under `moduleResolution: bundler`
  and `document.querySelector('sv-grid')` came back as a bare `Element`. The
  generated `.d.ts` augments `HTMLElementTagNameMap` and
  `HTMLElementEventMap`, so the element and its events are typed without
  hand-written declarations.
- **`<sv-grid-shadow>` - the grid in an open shadow root**, so a host page's
  CSS cannot reach it. Same properties, attributes and events as `<sv-grid>`;
  a separate element rather than an attribute because Svelte resolves
  `customElement.shadow` at compile time, so no runtime flag can switch it.
  Isolation is one-directional and the docs say so: page CSS stops at the
  boundary, but the grid's own stylesheet is still injected into the document,
  because about twenty overlay surfaces portal to `document.body` on purpose
  to escape ancestor clipping. `--sg-*` theme tokens reach in unchanged,
  including a theme file's dark variant - custom properties are inherited, and
  inheritance crosses a shadow boundary.
- **The elements now expose the whole grid.** `<sv-grid>` declared **7 props
  and 2 events** by hand against a `Props` type with 100 props and 19
  callbacks, so grouping, pagination, pinning, tree data, master/detail, board,
  scheduler and every Enterprise feature were unreachable from a non-Svelte
  host - while the docs said they "all come along". The surface is now
  **generated** from `<SvGrid>`'s own types: **98 properties** (72 with
  kebab-case attributes, 26 property-only) and **20 events**, with CI failing if
  the two drift. Costs 1.6 KiB gzip.
- **Every grid callback is a DOM `CustomEvent`**, `detail` being the
  callback's argument - or, for the one callback taking two, an object keyed by
  its parameter names. `onApiReady` also parks the imperative handle on the
  element as `el.api`, because an event fires once and a host binding a
  listener later would otherwise never reach it.

#### Fixed

- **Importing the package on a server threw `customElements is not defined`.**
  Svelte registers each element with a bare top-level
  `customElements.define(...)`, so any server-rendered React app
  (TanStack Start, which Lovable now generates, Next.js, Remix) crashed on
  `import { SvGrid } from '@svgrid/grid-wc/react'`. The build now guards the
  registration; on a server the import is inert and SSR emits a plain
  `<sv-grid>` that upgrades on hydration. Guarded by `test/ssr.test.ts`.
- **The React wrapper lost props the grid reads once at mount.** It wrote
  props in a passive `useEffect`, which runs after paint; the element mounts a
  microtask after insertion, so it had already mounted with defaults and
  `pageSize={25}` showed 10 rows a page (the wrapper's own pagination example
  did). Props are now written in a layout effect, before the element mounts.
  The same change in the `<sv-chart>` wrapper.
- **`style` on the React wrappers took `Record<string, string | number>`,** so
  passing a React `CSSProperties` object failed to type-check. It is
  `CSSProperties` now.
- **The React wrapper re-did all its work on every parent render.** Both of its
  effects had no dependency array, so any state change anywhere in the parent
  reassigned all 98 properties and rebound all 20 event listeners - 40 listener
  mutations per keystroke. It now writes only values that actually changed and
  binds listeners once through a handler ref. Measured: 20 no-op re-renders
  produce 0 listener adds, 0 removes and 0 property writes.

- **The element threw when it rendered before its props were assigned.**
  Generating the prop list replaced the elements' own `data = []` /
  `columns = []` defaults with a bare `$props()`, so a consumer that assigns
  properties AFTER the element upgrades - which is what React and Angular both
  do, in an effect - got
  `TypeError: Cannot read properties of undefined (reading 'map')` and a grid
  that never rendered. Only a real framework app was late enough to reproduce
  it; an HTML fixture sets the properties in the same tick and never sees it.

#### Changed

- **Only arrays, objects and functions changed shape: they are property-only.**
  An HTML attribute is a string, so `columns='[object Object]'` cannot work
  and no attribute is offered for the 26 props that are not primitives. The
  published `rowclick` and `selectionchange` events keep the exact
  `detail` they shipped with, and `selectable` keeps meaning row-selection
  checkboxes - `<SvGrid>`'s prop of that name is an alias of
  `enableCellSelection`, and forwarding it would have silently repointed a
  published attribute at a different feature.
- **Styles arrive with the code that needs them.** The build used to put every
  stylesheet in the bundle, lazy chunks included, into the entry, so a page
  that never opened the chart, a date picker or a menu still downloaded their
  CSS. Each chunk now carries its own styles and adds them to the document
  and to every open shadow root when it loads. `<sv-grid>`'s entry went from
  107 KiB to 98.5 KiB gzip while the chart grew.

### Tooling & docs

#### Added

- **Every chart gallery demo switches between Chart and Grid.** A segmented
  control first in each demo's toolbar flips every pane to a sortable grid
  of the rows the chart was drawn from, and back, the way the board demos
  switch Board and Table. The from-the-grid page shows the pattern in a
  runnable.

- **Charting a pivot is documented.** The pivot page has a section on
  `pivotToChartSpec` (the mapping, every option, a runnable that pivots
  orders and charts them by quarter) and on the designer's Chart view
  (`chartable`, `defaultView`); the charts hub and the from-the-grid page
  link to it, the /api pivot section lists the function, and the generated
  reference covers `pivot-chart.ts`. Demo 359's data now puts every
  country in every quarter and category, so its groups are four bars, not
  one.

- **27 runnable framework examples**, nine each for React, Vue and Angular:
  a first grid, sorting and filtering, editing and saving, row selection,
  grouping and totals, pagination, server-side data, theming, and Excel export
  from the Enterprise pack. Every one has
  an **Open in StackBlitz** button that boots a full editable project - no local
  install - and a new
  [React, Vue or Angular](/docs/help/web-components/frameworks) landing page
  puts the thirty-second path first.

  They are real apps in the repository (`packages/grid-wc/examples/`), not
  snippets, and CI compiles all of them with each framework's own compiler -
  including `ngc --strictTemplates`, so a wrong Angular binding fails the
  build. The doc listings are generated from those files, so a page cannot
  describe a version of an example that no longer exists.

  The Vue templates get an extra check of their own: Vue treats an unknown
  attribute as a legal fallthrough, so `<SvGrid sortabel />` type-checks
  cleanly and silently does nothing. Verified - the same typo fails the React
  and Angular compilers and passes `vue-tsc` - so the Vue examples are also
  checked against the generated surface.

- **A Web Components docs category.** Eight pages under
  `help/web-components/` - quick start, a generated `<sv-grid>` reference,
  shadow DOM, React, Vue, Angular, TypeScript and limitations - replacing a
  single page that was filed under "Layout & Styling". The reference tables are
  generated from the grid's types, and a guard checks that the counts quoted in
  prose still match the surface.
- **The docs run.** A `svelte` code fence tagged `{runnable}` is extracted at build time
  into a real component, so a doc page shows the source and the working result
  together rather than highlighted text. 504 examples across the corpus, taking
  the median doc page from 1 example to 3; each one is compiled by `svelte-check`
  in CI, so an example that stops working fails the build instead of rotting in
  place.
- **`@svgrid/ui` recipe scaffolder** - `npx @svgrid/ui add <component>` drops a
  ready-to-edit starter (e.g. `add calendar`) into your app, complementing the
  shadcn-style component pages (Preview / Code, install tabs) across the UI kit.
- **See a component before you wire it in** (`@svgrid/ui` 0.3.x).
  `npx @svgrid/ui try <component>` spins up a zero-setup Vite + Svelte sandbox and
  opens the component in your browser; `add --preview` writes a
  `src/routes/preview/<id>` route (plus a `/preview` index) in a SvelteKit app.
  `add` now installs `@svgrid/grid` by default (`--no-install` to opt out) and
  prints the exact `try` command for whatever you just added, so the "see it"
  step is never a dead end.
- **AI coding Skill** (`skills/svgrid`, installable with
  `npx skills add sv-grid/sv-grid`) - an always-on house-style guidance layer
  that complements `@svgrid/mcp`.
- **The rest of the toolkit is findable.** `packages/grid/README.md` gained an
  "Also in the box" section, and the site footer gained a **Toolkit** column
  (SvGrid UI, Kanban board, Scheduler, Dock layout, Studio, Web components).
  The 84 SvGrid UI components have always been exported from `@svgrid/grid`
  itself - `SvButton`, `SvCalendar`, `SvDateTimePicker`, `SvDockLayout`,
  `SvToaster` and the rest are already installed for every grid user - but
  nothing on the highest-traffic surfaces said so.

#### Changed

- **Doc examples show code and result at once.** The runnable card used to be a
  Preview / Code toggle with an in-page editor; it is now the source above the
  live example, both visible, with Copy. A tab hides half of a teaching example
  and makes comparing the two a click, and dropping the editor took the
  on-demand TypeScript compiler chunk off every docs page with it.
- **`npm create @svgrid` starts on Ember** (the demo theme) instead of Tailwind,
  for every template; `--theme <id>` still picks any preset. The `sveltekit`
  template is now listed on the starters page, and the `sv add @svgrid` demo route
  imports the Ember stylesheet so it no longer renders unthemed.

#### Fixed

- **The base scaffold lists `jszip`**, so "Download this view as Excel" works in a new app. Its README no
  longer says a new table appears on reload with the Postgres setup: that route reads the tables once
  per server process, so restart it or call `refresh()`.

- **14 doc examples drew an empty or broken box under their code.** Every
  `{runnable}` block was run against the published packages in a clean Vite
  app. Five needed a SvelteKit load, an `/api` server or a WebSocket (two
  showed "This example failed to load." on svgrid.com) and one is a component
  file that needs props; they are now `{norun}`, a new fence flag: still
  type-checked, never mounted, never promoted back to runnable. The other
  eight now run: the custom header, the real-time cell flash, the
  inline-snippet cell renderer, and the alert, loading-overlay, scroll-area,
  sparkline and toaster examples. The toaster page also said hidden toasts
  appear as room frees; their timers keep running while hidden, which the
  page now says.
- **`build:lib` in the enterprise package deleted the node bundle.**
  `svelte-package` wipes `dist/`, so a library build alone removed
  `dist/node/studio.js` and the MCP server failed to start until
  `build:node` was run by hand. The library build rebuilds the bundle it
  removed.

- **Docs images and tutorial media 404'd under a site base.** The markdown
  writes them root-absolute (`/docs-media/...`, `/tutorials/...`), which is
  right at svgrid.com and wrong under the `/sv-grid/` base the e2e server
  uses: every docs image and tutorial poster was missing there. The page
  prefixes the base in the HTML before it paints, and an e2e spec loads a
  page with both and checks nothing under those roots 404s.

- **Twenty-one links on the chart pages went to GitHub 404s.** The split
  wrote every cross-link with one `../` too many, and the site's link
  resolver falls back to a GitHub URL for a page it does not know. Fixed on
  the pages, and every relative link under docs/ is now a test
  (`tools/docs-relative-links.test.ts`); the link checker existed but only
  ran by hand before a release.
- **Links into the generated reference tree went to GitHub too.** The tree
  is hidden from the docs routes; a link to it lands on the /api page, on the
  module's section where it has one.
- **The chart gallery said "the source is under each example" and it was
  not.** Each gallery card now carries the demo's own script and markup on a
  Code tab, written by `tools/gallery-doc-code.mjs` from the demo file and
  guarded by a drift test, so the code beside a preview is the code that
  renders it.
- **A demo page flattened a bulleted banner into one paragraph**, dashes and
  backticks included. The page reads the pitch as blocks: a list where the
  banner wrote one, `<code>` where it wrote backticks, on the prerendered
  and the hydrated page alike.
- **`demo-doc-embed` skipped a demo the page only linked to**, so a
  placement for it never landed, and it opened a new "More examples" section
  below "See also", which the coverage test requires to be last. Present
  means embedded, and the section opens above "See also".
- **Regenerating the doc snippets took the dev server's file watcher with
  it.** The extractor removed and recreated its output directory, and on
  Windows the watch did not re-attach, so an edited runnable kept serving
  its old chunk while the source beside it showed the new code. It writes in
  place and removes only what no longer belongs.
- **The Getting started chart page had no live example.** Its code blocks
  were `ts` and a Svelte block referencing rows it never declared; four of
  them run now, and the hub's first example runs with its own rows and a
  filter row, so the chart is seen following the grid.

- **The e2e suite adopted any server on :5180.** Playwright reuses whatever
  answers on the port, and a Vite dev server returns the app shell for any
  path, so a website dev server started by hand (base `/`) passed the
  readiness check and the fourteen path-routed and module-importing specs
  failed with nothing pointing at the server. The config now probes the port
  first (`tests/e2e/lib/site-server-probe.mjs` reads the base off Vite's
  client script tag), reuses a server that serves the site under `/sv-grid/`,
  skips one that serves anything else with a line saying so, and starts its
  own on the next free port; `SVGRID_E2E_PORT` pins one.
- **The website dev server re-optimised dependencies mid-session.** The
  search index, the docs renderer, the /api runner's compilers, the PDF
  exporter and the grid's `esm-env` sit behind dynamic imports the start-up
  scan does not reach, so the first page to touch each one triggered
  "optimized dependencies changed. reloading" on every open page. In the e2e
  suite that reload landed mid-test on a cold cache and failed whichever spec
  was on a page at the time. They are pre-bundled at start-up now
  (`optimizeDeps.include`), and `esm-env` is a declared devDependency of the
  website so it resolves from there.
- **The /api runner check sampled an example's outcome two frames after
  Run.** An example awaiting an export or a fetch was still running, so a
  failure that arrived later, or one thrown inside a library callback the
  runner's try/catch cannot see, passed. The check now waits for the runner
  to report an outcome and counts an uncaught error or rejection during the
  run as a failure of that example.
- **181 doc pages had content stranded below "See also".** Authoring passes
  appended new sections to the end of the file, which buried them under what
  reads as the page footer: on `help/filtering/number-filter`, for instance, the
  `between` example sat below the link list and a reader would never reach it.
  The footer is back at the bottom on every page, and a test now fails if a
  section lands under it.
- **The documented way to lock one column's width never worked.**
  `docs/help/columns/column-sizing.md` matched headers on `data-col-id`, which is
  the attribute on *body* cells - the selector matched nothing. Header cells
  carry `data-svgrid-header-col`. (`ColumnDef.resizable` is now the real answer.)
- **`blockKey` was missing from `tools/lib/md-snippets.d.mts`.** The function was
  exported from the `.mjs` and worked at runtime, so nothing caught it until the
  website was type-checked.
- **`@svgrid/mcp` reports its real version.** The MCP server's
  `serverInfo.version` was hardcoded to `0.1.0`; it now reads the package version.
- **`@svgrid/create-studio` scaffold builds out of the box.** The generated app
  shipped an orphaned `/products` route referencing an entity that was never
  defined; the `Product` schema, seed, data source, nav, and home card are now
  complete, so `npm run build` succeeds on a fresh scaffold.
- **API-docs accuracy pass across all 74 UI-component pages.** Corrected the
  `SvDockLayout`, `SvDockManager`, and `SvDateTimePicker` prop tables (added 13
  missing dock-layout props; removed a `size` prop `SvDateTimePicker` never had),
  and filled scattered gaps (`loading`, `onClosed`, `min` / `max`, `dir`,
  `width` / `height`, `ariaLabel`, and the shared field-contract on
  `SvFileUpload`).

### @svgrid/mcp

#### Changed

- **A cold `npx -y @svgrid/mcp` installs 20 packages instead of 111.** The
  server speaks MCP over stdio itself instead of through
  `@modelcontextprotocol/sdk`, whose HTTP and OAuth dependencies (Express, Hono,
  JOSE, AJV) a stdio server never runs. On an empty npm cache the install took
  6 to 8 seconds instead of 12, which had left little room under an MCP client's
  30 second connect timeout. The protocol is unchanged: version negotiation,
  errors and every tool, resource and prompt answer as before.

## [1.0.0] - 2026-06-16

Initial public release - the Svelte 5-native data grid: `@svgrid/grid`
(MIT core) and `@svgrid/enterprise` (the paid feature pack).

### @svgrid/grid

- **New** `onCellValueChange` callback on `<SvGrid>`. Fires after every
  inline edit commits with `{ rowIndex, columnId, oldValue, newValue,
  row }`. The recommended hook for server-side persistence and cascading
  recomputes; see demo `18-cascade-editing` and
  [Saving values](./help/editing/saving-values.md).
- **New** `externalSort` + `externalFilter` props. Grid records the UI
  state but does NOT re-order / filter rows - the consumer owns the
  pipeline. Paired with `onSortingChange` / `onFiltersChange` for
  server-side data and tree-data scenarios.
- **New** `onSortingChange(sorting)` / `onFiltersChange(filters)`
  callbacks. Fire on every change with the consolidated payload shapes
  documented in the [SvGrid reference](./reference/SvGrid.md).
- **New** `onRowSelectionChange(selection, rows)` and
  `onActiveCellChange(cell)` callbacks.
- **New** `fitColumns` prop. Scales column widths to fill the viewport,
  with rounding-residue absorbed in the last scalable column. Shrinks
  down to 85 % of natural widths; beyond that a horizontal scrollbar
  appears.
- **New** `showRowNumbers` prop. Leading 1-based row-number column,
  rendered before any selection column.
- **New** `pageSize` prop on `<SvGrid>`. Initial page size for the
  built-in pager.
- **Improved** column virtualizer now detects per-item size changes,
  not just total size. Fixes a regression where resizing a column under
  `fitColumns` left other columns stale.
- **Improved** the wrapper-managed filter pipeline no longer applies
  filters to the pre-paginated view - the filter UI always sees the
  full dataset, not just the visible page. (Removed
  `paginatedRowModel` from the engine pipeline; pagination is applied
  AFTER filters by the wrapper.)

### @svgrid/enterprise

- **New** package. The paid feature pack adds:
  - **Export** to xlsx / pdf / csv / tsv / html, with theme-matched
    styles, multi-sheet workbooks, header + footer with logo, embedded
    cell images. See [Export](./help/export.md).
  - **Print** with repeat-on-page headers, optional cover page,
    page-size + orientation.
  - **Import** from xlsx / csv / tsv / json with column mapping +
    per-row validation. See [Import](./help/import.md).
  - **AI assistant**: provider-agnostic helpers for natural-language
    filter, smart fill, summarize, and classify. Bring your own model
    adapter. See [AI](./help/ai.md).
  - **Pivot tables** via `createPivotModel(data, config)` and
    `pro.pivot.build(config)`. Row + column axes, 8 built-in
    aggregators or custom, grand-total row + column, subtotals,
    custom axis sort. See [Pivot tables](./help/pivot.md).
- **New** `installEnterprise(api)` augments a `SvGridApi` with `exportData`,
  `print`, `importData`, `ai.*`, and `pivot.*` methods.
- **Soft-gated licensing**: features run unlicensed but the grid shows
  a small watermark + a one-time console nudge. `setLicenseKey('SVENTERPRISE-…')`
  at app startup clears both.

### Examples gallery

- **New demos** (56-59): theme-matched export, branded export with
  header + footer + logo, export with cell images, multi-sheet export.
- **New demos** (52-pivot-table, 51-ai-assistant, 53-excel-import):
  reference implementations for each Enterprise feature.
- **New demos** for industry verticals: stock market (live ticks),
  HR team, finances ledger, industrial IoT, localization, CSP
  compliant, accessibility, cascade editing, server-side rendering,
  industrial dashboard, healthcare EMR, logistics, compliance queue,
  field service, gantt, scheduler, CRM, admin dashboard, seller panel.
- **New** "Source" button on every demo opens the raw `.svelte` file
  in a modal with a Copy-to-clipboard button. Wired via
  `import.meta.glob('../demos/*.svelte', { query: '?raw' })` so it
  picks up new demos automatically.

### Docs

- **New** [Enterprise feature pack](./enterprise/README.md) landing page.
- **New** [API reference](./reference/index.md) with hand-curated
  pages for `<SvGrid>`, `SvGridApi`, `ColumnDef`, features, and the
  full Enterprise surface.
- **New** [Why headless?](./why-headless.md) explains the layered
  architecture and when to drop down to the headless core.
- **New** [Tailwind integration](./help/tailwind.md) walks the
  `--sg-*` token surface, dark-mode wiring via `data-theme`, and the
  override hooks for the stable `.sv-grid-*` class names.
- **Split** [Getting started](./getting-started.md) into six short
  pages (install / first-grid / data-and-columns / features /
  theme-and-density / going-to-production); the old single-page
  version is preserved at
  [getting-started-full.md](./getting-started-full.md).
- **Cleaned** every code sample against the live library surface.
  Removed phantom APIs: `state={...}`, `rowModels={...}`,
  `initialState={...}`, `manualFiltering`, `manualSorting`,
  `manualPagination`, `onColumnFiltersChange`, the wrapper `getRowId`
  prop, per-column `enableSorting` / `enableColumnFilter` /
  `enableGrouping` flags, the never-shipped
  `@svgrid/grid/themes/default.css` import.
- **Em-dashes globally swept to hyphens** (`-` → `-`) across all
  source-controlled text. Codified as a rule for new content.

## How we version

| Tier              | What it means                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| **Major** (1.x)   | Breaking change to a Stable API. Includes prop / method renames, type-narrowing, default-behaviour changes.    |
| **Minor**         | New Stable API. New Experimental API. New demo. Doc rewrites that touch the public-facing claims.              |
| **Patch**         | Bug fixes. Type-only fixes. Internal refactors with no public surface change. Doc typo fixes.                  |

The [API stability page](./help/api-stability.md) annotates each export
with its current tier (`Stable`, `Experimental`, `Internal`). As of 1.0,
`Stable` APIs follow semver; `Experimental` APIs may still change in a
minor release.
