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
  from the controller, which kept the base bundle at 86.4 KB.

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

### @svgrid/enterprise

#### Added

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
