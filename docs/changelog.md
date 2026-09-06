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

### Tooling & docs

#### Added

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
