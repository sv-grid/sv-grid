# Spreadsheet extension plan

Internal planning note. `docs/_internal/` is skipped by
`tools/build-docs-index.mjs`, so nothing here reaches docs.json, llms.txt or
the site. Ship a feature, then move its sentence into the public docs.

Written 2026-09-18 against the `main` head after the "Spreadsheet mode"
commit (`43c01c2`). Accepted the same day.

## Status

**Every gap in section 2 is shipped**, bar one the measurements argued
against: recalculation off the main thread, and the sparse storage that
would go with it. The bench says a 50k-row sheet opens in about half a
second and an edit costs one evaluation, so a worker would add a boundary
and buy nothing today; the row is left standing rather than struck through
so the decision is visible rather than forgotten.

Shipped on the plan's branch, one commit per item:

- Phase B item 1: the function packs (financial, math and statistics, text
  and date, CHOOSE / ROWS / COLUMNS, the ISERROR family), on by default
  rather than behind `withCustomFunctions`, since a sheet user expects PMT
  to work without registering anything. The parser reads an omitted
  argument as a blank.
- Phase C items 1 to 4: Input Message and Circle Invalid Data; Format
  Cells Accounting and Special (the compiler learned padding tokens,
  conditions and integer masks); the Sort dialog; tab Hide, Unhide,
  Duplicate and a confirmed Delete.
- Phase B item 2: ROW, COLUMN, ADDRESS, OFFSET and INDIRECT, with the
  volatile set in the workbook.
- Phase C item 5: AutoFilter Date Filters, Filter by Color and Top 10.
- Phase C item 6: the conditional formatting formula rule and data bars
  with a negative axis.
- Phase C item 7: Trace Precedents, Trace Dependents and Remove Arrows.
- Phase A items 1 to 3: `documentToXlsx` / `documentFromXlsx` with a
  round-trip test, and the File tab (New, Open, Save As, Export CSV, with
  Ctrl+O and Ctrl+S).
- Phase C item 8, threads: `CommentThread` (author, time, replies,
  resolved) beside the plain note in the same map, the thread card in the
  comment box, `commentAuthor` on the shell, and Excel's threaded comment
  parts in the xlsx writer and reader.
- Phase C item 8, protection: the Protect Sheet dialog with Excel's allow
  list, Allow Edit Ranges, `protection: { allow, ranges }` in the state
  beside the flag, and `sheetProtection` attributes and `protectedRanges`
  in the xlsx both ways. Phase C is complete.
- Phase D, charts and pictures: `sheet/objects.ts` (the anchor, the
  chart's range and spec, shifting), `objects` per sheet in the document,
  the object layer in the shell with move, resize, select and delete, the
  Chart dialog, and Insert > Chart and Insert > Picture on the ribbon.
  Insert > Chart no longer needs `extras`.
- Phase B item 4: the `SheetEngine` seam on `createWorkbook`, the
  built-in engine as the default, and `createHyperFormulaEngine` mirroring
  the cells into a HyperFormula instance.
- Phase E item 3: `<sv-sheet>` under `@svgrid/enterprise/wc`, its surface
  generated from the shell's Props (element props, types, React and Vue
  wrappers, docs tables, a `--check` the tests run), built by
  `scripts/build-wc.mjs` with Svelte and the grid bundled in.
- Phase B item 3: dynamic arrays. The array pack (FILTER, UNIQUE, SORT,
  SORTBY, SEQUENCE, TRANSPOSE, TEXTSPLIT), array arithmetic with Excel's
  broadcasting, spill ranges kept by the workbook with `#SPILL!` and
  `#CALC!`, the blue outline on the active spill, and array formulas with
  the dynamic-array metadata in the xlsx both ways.
- Phase A items 4 and 5: `PageSetup` per sheet, the Page Layout tab
  (margins, orientation, size, print area, print titles, gridlines,
  headings, the Page Setup dialog), File > Print over `sheetPrintHtml`,
  and `pageSetup` / `pageMargins` / `printOptions` / the print names in
  the xlsx both ways. Phase A is complete.
- Phase E item 4: `skills/svgrid/rules/sheet.md` with the shell's house
  rules, a `build_sheet` prompt in `@svgrid/mcp`, and a Spreadsheet block
  in Studio that emits `<SvSheet>` over `sheetCellsFromRows(allRows)`.
- Excel's `IMAGE` function: a picture in the cell rather than over it,
  `sheet/cell-images.ts` reading the call off the formula, drawn in the
  cell and on the printed page, and stored as `_xlfn.IMAGE`.
- Sparklines and objects on the printed page: `sparklineSvg` over the
  grid's own geometry, a chart drawn offscreen to SVG at its own size, both
  placed against their anchor cell by `sheetPrintHtml`, and the default
  print area grown to hold a chart anchored below the numbers.
- The two leftovers noted inside shipped rows: Sort On (cell colour and
  font colour) in the Sort dialog and the sort engine, and NUMBERVALUE.
- Objects in the .xlsx: `sheet/xlsx-drawing.ts` (the drawing part, a
  picture in `xl/media`, a chart part carrying its references rather than
  cached numbers, and the reader that gives both back, two-cell anchors
  included), plus sparklines in the worksheet's x14 extension list both
  ways. A picture whose source is a URL is left out on purpose.
- Presence, the last of Phase F item 3: `sheet/presence.ts` (a person, a
  stable colour, the sheet and rectangle they are on, the fifteen-second
  prune), a `presence` prop the shell draws over the cells and an
  `onPresence` callback for this user's own selection, a fifth delta kind
  that rides the same wire without touching the document, and demo 478
  showing both cursors.
- The table styles gallery: `sheet/table-styles.ts` with Excel's eighteen
  built-in names and their accents, `style` on a table region, the shell
  drawing each table in its own colours, the gallery in the Create Table
  dialog with Insert > Table Styles beside it, and `tableStyleInfo` in the
  xlsx both ways.
- The autosave-to-a-server recipe in the shell page, and the saved-state
  shape in the docs brought up to date with tables, iteration, links,
  sparklines and pivots.
- Evaluate Formula and Error Checking: `sheet/evaluate-steps.ts` (a
  formula walked one part at a time, each part handed back to the workbook
  as a formula so the meanings cannot drift, an untaken IF branch skipped)
  and `sheet/error-check.ts` (error cells, and the formula that breaks its
  column's pattern), both as dialogs on the Formula Auditing group and both
  exported as functions. The shared printer learned the lambda call node
  while it was there, which fixes filling a `LAMBDA(...)(...)` cell down.
- Iterative calculation: `workbook.iteration` and `setIteration`, a
  re-entrant read answering with the cell's previous value rather than
  `#CYCLE!`, passes over `graph.cycles()` until the largest move is under
  the tolerance or the cap is spent, Formulas > Calculation Options in the
  shell, the setting in `getState()` and in the xlsx as `calcPr`.
- Format as Table: a table registry on the workbook wired into the eval
  context, so the structured references the parser already read finally
  resolve; Insert > Table and Ctrl+T with Excel's dialog, the banded look
  drawn rather than written, auto-expand that fills the calculated columns
  into a new row, the cells behind a structured reference recorded in the
  dependency graph, and the tables in the .xlsx both ways. `extras` is dead
  and the prop is ignored.
- LET and LAMBDA, with MAP, BYROW, BYCOL, REDUCE, SCAN and MAKEARRAY: a
  lexical scope in the evaluator's context, lambdas as a value only the
  formula can hold, immediate and curried calls through a `(` node the
  parser builds, and the helpers spilling like the other array functions.
  The xlsx writer learned Excel's `_xlfn.` prefixes while it was there,
  which also fixes every dynamic-array formula written before now opening
  in Excel as `#NAME?`.
- Hyperlinks (the last of the small gaps in section 2): `sheet/links.ts`
  with the links per sheet, Insert > Link and Ctrl+K, Insert > Remove, the
  `HYPERLINK` function and a clickable cell for it, internal targets that
  move the selection, and the links in the .xlsx both ways.
- Phase F item 3: collaboration. `sheet/delta.ts` with `createDeltaStream`,
  `applySheetDelta` and four delta kinds (cells as raw text, a structural
  edit, one part of one sheet's state, the whole document for sheets and a
  restore), last-writer-wins per cell and said so. It needed three seams
  that ship on their own: `workbook.subscribeWrites`, `document.patch`, and
  a shell that follows its document rather than waiting for `refresh()`.
  Demo 478 wires two sheets together and logs the wire. Presence is left
  where the plan put it, as a grid overlay over the selection. Phase F is
  complete but for item 2, which the bench says is not called for yet.
- Phase F item 1: the spreadsheet bench. `tools/bench/sheet-cases.mjs` fills
  a sheet with a formula per row at 1k, 10k and 50k, times opening it and
  one keystroke in it (plain, under a 10k-cell SUM, and at the top of a 10k
  chain), and counts CELL EVALUATIONS through the engine seam, which is what
  CI gates. The ceiling is published in `docs/help/benchmarks.md` and in the
  shell's own page. What the bench found and this fixed: a dependency chain
  longer than about a thousand rows overflowed the stack on the first
  keystroke and left `#NUM!` in the cell; the workbook now primes a deep
  chain from its far end. What it found and did NOT change: an edit costs
  one evaluation, a 50k-row sheet opens in about half a second and retains
  about 84 MB, so sparse storage and a worker (item 2) are not called for
  yet.
- Phase D, PivotTable: `sheet/pivot-range.ts` (the definition, the records
  read from a range, the block the engine's result becomes, shifting) over
  the existing `pivot.ts`, `pivots` per sheet in the document, Insert >
  PivotTable and Insert > Refresh on the Tables group, and the Create
  PivotTable dialog with its field list. The result is written as cells in
  one undo. Phase D is complete but for the objects in the .xlsx.
- Phase D, sparklines: `sheet/sparklines.ts` (the group, its two ranges,
  the series a cell draws, the shared scale, shifting), `sparklines` per
  sheet in the document, the Sparklines group on the Insert tab (Line,
  Column, Win/Loss, Edit, Clear), the Create Sparklines dialog, and the
  drawing inside the cell over the free `<SvSparkline>`. Not done: the
  sparklines in the .xlsx (Excel keeps them in an x14 extension) and on
  the printed page, which is built from what each cell says.
- Phase E item 2: the RTL, touch and accessibility audits, as
  `tests/e2e/sheet-a11y.spec.ts` (an axe pass over every band of the shell
  on five demos, light and dark, plus the keyboard model), `sheet-rtl.spec.ts`
  and `mobile/sheet-touch.spec.ts`. What they found and what was fixed: the
  grid's pinned columns and row gutter stuck to the physical left edge
  (now logical insets), the object layer hung objects from the physical
  left (now the inline start), both tab strips lacked Home, End and
  focus-follows-selection, the Name Box carried the address as a
  placeholder rather than a value, the empty row-number corner, the
  focusable resize separator with no `aria-valuenow`, the watermark
  appended inside the `role="grid"` table, and three small-text colours
  under 4.5:1 on a host theme's accent. Phase E is complete.
- Phase E item 1: `SheetMessages`, `SheetLocalization` and the
  `localization` prop, threaded through Svelte context to the ribbon,
  the formula bar, the tab strip, every dialog and the status bar; the
  ribbon's keys are read off the model. The rule descriptions in the
  Rules Manager and the function names stay English.

Deviations from the plan: Data Validation is a plain dropdown, not a split
button, because the ribbon model forbids a dropdown that emits its own
face; the xlsx reader uses DOMParser (present in browsers and jsdom) and
throws a clear error where it is absent. Tables, charts and images do not
ride in the file. Demos 474 and 475 show the milestone and are registered in the
example gallery; their entries in the website's demo registry (a private
submodule not checked out here) are still to add.

## 1. Where the spreadsheet stands

Three layers exist today, and any extension lands in one of them.

| Layer | Package | Where | What it is |
| --- | --- | --- | --- |
| Sheet-shaped grid | `@svgrid/grid` (MIT) | `packages/grid/src/spreadsheet.ts`, `merges.ts`, `hyperformula-adapter.ts` | `spreadsheetLayout`, A..Z headers, row gutter, merged cells, fill handle, range selection, the optional HyperFormula peer |
| Engine and keyboard layer | `@svgrid/enterprise/sheet` | `packages/enterprise/src/sheet/*.ts` | tokenizer, parser, evaluator, dependency graph, workbook, defined names, tables, format store, number-format compiler, paste special, find/replace, structure edits, freeze, validation, conditional formats, comments, protection, auto-filter, goal seek, Excel shortcuts |
| Shell | `@svgrid/enterprise` | `packages/enterprise/src/SvSheet.svelte` (4114 lines) plus `SvSheetRibbon`, `SvFormulaBar`, `SvSheetTabs` and sixteen `SvSheet*` dialog components | ribbon with Home / Insert / Formulas / Data / Review / View, Name Box and fx bar, tab strip, status bar, the document model (`sheet/document.ts`) with `getState` / `setState` / `onChange` |

Measured while writing this note:

| What | Count | How |
| --- | --- | --- |
| Functions implemented in `sheet/functions.ts` | 60 | `grep -c "^  [A-Z][A-Z0-9]*:"` |
| Sheet demos (27, 83, 173, 207 to 212, 356, 452 to 466) | 25 | `ls examples/src/demos` |
| Sheet test files (`sheet/*.test.ts`, `SvSheet*`, `SvFormulaBar*`) | 42 | `ls` |
| Pending `.changeset` files about the sheet | many | `ls .changeset` - unreleased; the release that carries them has not been cut |

Two facts shaped the plan as it was written. Both have since been fixed;
the Status section above says by what.

- **The shell cannot use HyperFormula.** `Workbook` evaluates through its
  own `evaluate`; `SvSheet.svelte` and `sheet/workbook.ts` do not mention
  HyperFormula. The adapter lives in the free grid for a plain `<SvGrid>`.
  Function breadth in the shell is therefore the 60 functions above.
- **Files do not round-trip.** `import.ts` reads the first sheet of an xlsx
  as rows (its own comment: "does NOT try to be a fully-featured Excel
  reader"), `export.ts` writes grid rows, and the ribbon has no File tab and
  no save, open or print action (`RIBBON_ACTIONS` in `sheet/ribbon.ts`).
  A document made in the shell can only leave it as `getState()` JSON.

The public docs already list the intentional gaps under "What it does not do"
in `docs/help/cells/spreadsheet-shell.md`. That list is the contract: every
item shipped from this plan deletes a line there.

## 2. The gaps, graded

Effort tags follow `docs/help/missing-features.md`: S under a week, M a few
weeks, L a quarter-scale piece of work.

### Files and print

| Gap | Today | Effort |
| --- | --- | --- |
| ~~Open an xlsx as a whole document~~ | shipped: `documentFromXlsx`, File > Open | done |
| ~~Save the document as xlsx~~ | shipped: `documentToXlsx`, File > Save As | done |
| ~~CSV out of the active sheet~~ | shipped: File > Export CSV; CSV in is still the grid's importer | done |
| ~~Print and Page Layout~~ | shipped: the Page Layout tab, the Page Setup dialog, File > Print, `pageSetup` in the state and the xlsx | done |
| ~~Persistence hooks (autosave to a server)~~ | shipped: the Autosave to a server recipe in the shell page, with the debounce, the one-in-flight rule and the revision header, and the state shape brought up to date | done |

### Formula engine

| Gap | Today | Effort |
| --- | --- | --- |
| ~~Financial functions (PMT, PV, FV, NPV, IRR, RATE, NPER)~~ | shipped, with IPMT, PPMT and SLN | done |
| ~~Math and statistics (SUMPRODUCT, PRODUCT, CEILING, FLOOR, TRUNC, LOG, EXP, PI, RAND, RANDBETWEEN, LARGE, SMALL, PERCENTILE, QUARTILE, VAR, MODE, AVERAGEIFS, MAXIFS, MINIFS, CORREL, FORECAST)~~ | shipped | done |
| ~~Text (PROPER, REPT, VALUE, CHAR, CODE, EXACT)~~ | shipped, with TEXTSPLIT from the spill work and NUMBERVALUE | done |
| ~~Date (WEEKDAY, EDATE, NETWORKDAYS, WORKDAY, WEEKNUM, HOUR, MINUTE, SECOND, TIME)~~ | shipped, with DATEVALUE, TIMEVALUE, DAYS360, YEARFRAC | done |
| ~~Reference functions (INDIRECT, OFFSET, ROW, COLUMN, ROWS, COLUMNS, ADDRESS, CHOOSE)~~ | shipped; INDIRECT and OFFSET are volatile, recomputed on every write | done |
| ~~Dynamic arrays and spill (FILTER, UNIQUE, SORT, SORTBY, SEQUENCE, `#SPILL!`)~~ | shipped: `evaluateSpill`, spill ranges in the workbook, array arithmetic with broadcasting, TRANSPOSE and TEXTSPLIT too | done |
| ~~LET / LAMBDA~~ | shipped, with MAP, BYROW, BYCOL, REDUCE, SCAN and MAKEARRAY, and the `_xlfn.` prefixes in the file | done |
| ~~A pluggable engine (HyperFormula behind the shell)~~ | shipped: an `engine` option on `createWorkbook`, with `createHyperFormulaEngine` | done |
| ~~Iterative calculation (circular references with a cap)~~ | shipped: `workbook.iteration`, Formulas > Calculation Options, the two limits, `calcPr` in the xlsx both ways | done |

### Ribbon parity

| Gap | Today | Effort |
| --- | --- | --- |
| ~~Formula auditing: Trace Precedents / Dependents~~ | shipped, with Evaluate Formula and Error Checking beside them | done |
| ~~Conditional formatting: formula rule, negative axis and second colour on data bars~~ | shipped | done |
| ~~AutoFilter: Date Filters, Filter by Color, custom Top 10~~ | shipped | done |
| ~~Validation: Input Message, Circle Invalid Data~~ | shipped | done |
| ~~Format Cells: Accounting, Special~~ | shipped | done |
| ~~Custom Sort dialog (several keys, header row)~~ | shipped, with Sort On: cell colour and font colour | done |
| ~~Comments as threads (author, time, replies, resolve)~~ | shipped: the thread card, `commentAuthor`, and Excel's threaded parts in the xlsx | done |
| ~~Protection: allowed ranges and the allow list~~ | shipped: the Protect Sheet dialog, Allow Edit Ranges, `sheetProtection` in the xlsx. A password is still not one: a lock in the browser is not a secret | done |
| ~~Sheet tabs: hide / unhide, duplicate, delete with confirm~~ | shipped; move between workbooks not done | done |
| ~~Format as Table~~ | shipped: `workbook.tables`, Insert > Table and Ctrl+T, the banded look, auto-expand, the styles gallery, the xlsx both ways | done |

### Objects on the sheet

| Gap | Today | Effort |
| --- | --- | --- |
| ~~Charts anchored to cells, fed by a range~~ | shipped: the object layer, Insert > Chart, the Chart dialog, and the chart part in the .xlsx both ways | done |
| ~~Sparklines in cells~~ | shipped: the groups in the document, Insert > Sparklines (Line, Column, Win/Loss, Edit, Clear), drawn over `<SvSparkline>`, in the .xlsx both ways, and on the printed page | done |
| ~~Hyperlinks (HYPERLINK function and Insert > Link)~~ | shipped: links per sheet, Insert > Link and Ctrl+K, the function, internal targets, and the xlsx both ways | done |
| ~~Images floating over the cells~~ | shipped: Insert > Picture, carried in the document as a data URL, and in the .xlsx both ways. In a cell is shipped too, as Excel's `IMAGE` function. A floating picture that is a URL rather than a data URL is left out of the file | done |
| ~~PivotTable from a range~~ | shipped: `SheetPivot` in the document, Insert > PivotTable and Refresh, the result written as cells | done |

### Reach

| Gap | Today | Effort |
| --- | --- | --- |
| ~~Localised ribbon, dialog and status-bar strings~~ | shipped: `SheetMessages` in one flat map, `localization={{ text, locale }}`, the ribbon's keys read off the model | done |
| ~~RTL sheet (columns run right to left, A on the right)~~ | shipped: audited with a Playwright spec, and the sticky pinning, the object layer and the row-resize maths fixed with logical properties | done |
| ~~Touch: fill handle, range drag, ribbon on phones~~ | shipped: audited on a phone viewport with a Playwright spec, the shell's touch targets and the ribbon fold fixed where it found them | done |
| ~~Accessibility audit of ribbon and dialogs~~ | shipped: axe over the shell in both themes, the ribbon tablist given a roving tabindex, and what it found fixed | done |
| ~~`<sv-sheet>` web component with React / Vue / Angular wrappers~~ | shipped under `@svgrid/enterprise/wc`, its surface generated from the shell's props with a `--check` the tests run | done |
| ~~Studio, MCP, skill rules know the sheet~~ | shipped: `skills/svgrid/rules/sheet.md`, a `build_sheet` prompt in `@svgrid/mcp`, and a Spreadsheet block in Studio | done |

### Scale and collaboration

| Gap | Today | Effort |
| --- | --- | --- |
| ~~Large sheets~~ | measured: `pnpm bench` over the engine at 1k, 10k and 50k rows, the ceiling published in `docs/help/benchmarks.md`, and the deep-chain stack overflow it found fixed. Sparse storage is not called for | done |
| Recalculation off the main thread | none | L |
| ~~Co-editing (deltas, presence, conflict)~~ | shipped: `createDeltaStream` with five delta kinds, `applySheetDelta`, the presence overlay and `onPresence`, last writer wins per cell and said so. No server and no operational transform, on purpose | done |

## 3. Phases

Ordered by what a buyer of the Enterprise pack asks for first. Each phase
ships on its own; none blocks the next except where marked.

### Phase A. Files (L)

The single most-asked question a spreadsheet gets is "can I open my file".

1. **`sheet/xlsx-document.ts`** with `documentToXlsx(doc)` and
   `documentFromXlsx(bytes)`. Reuse the OOXML writer in `export-ooxml.ts`
   and the zip reader in `import.ts`, but drive them from `SheetDocument`,
   not grid rows: cell text as `<f>` when it starts with `=`, formats from
   the format store as `<xf>` entries, merges, frozen panes, hidden lines,
   column widths and row heights, defined names, comments as legacy notes,
   data validation and conditional formatting where OOXML has a direct
   equivalent, tables. Import maps the same the other way.
2. **Round-trip tests** in the style of `export-xlsx-roundtrip.test.ts`:
   build a document, write, read, compare `getState()`.
3. **File tab** on the ribbon: New, Open, Save as xlsx, Export CSV, Print.
   Open and Save use the browser's file input and download; a host can take
   any of them over through `onAction`, which is how a server-backed app
   will save.
4. ~~**Print**: a Page Layout tab with orientation, margins, print area,
   repeat header rows, feeding `export-print.ts` with the sheet's formats.~~
   Shipped, with a builder of its own (`sheet/print.ts`) rather than the
   grid's, because merges, widths and per-cell formats need a different
   table.
5. ~~Docs: a new `docs/help/cells/sheet-files.md`; remove "no Page Layout"
   from the shell page; a demo that opens a bundled xlsx.~~ Done as the
   Files and Page Layout sections of the shell page rather than a page of
   their own, and demo 474 saves and reopens a file.

### Phase B. Engine breadth (M, then L for spill)

1. **Function packs** as separate modules under `sheet/functions/`
   (`financial.ts`, `math-stats.ts`, `text.ts`, `date.ts`, `reference.ts`),
   registered through the existing `withCustomFunctions` seam so the
   `/sheet` chunk does not grow for apps that never call them. Each pack
   ships with golden tests against values computed in Excel, extending
   `engine.golden.test.ts`, and entries in `function-catalog.ts` and
   `autocomplete.ts` `SIGNATURES` so the fx dialog and autocomplete see
   them.
2. **Reference functions** need one engine change: `precedentsOf` cannot
   see through `INDIRECT` or `OFFSET`. Mark such cells volatile in the
   dependency graph (recompute on every change) as Excel does.
3. ~~**Dynamic arrays**: `evaluate` returns a matrix, the workbook owns spill
   ranges, a blocked spill is `#SPILL!`, `translateFormula` and
   `fixupReferences` treat the anchor as the formula cell. This is the L
   item; do it after the packs so FILTER, UNIQUE, SORT and SEQUENCE land on
   a working spill.~~ Shipped: `evaluateSpill` beside `evaluate` rather
   than a matrix from it, so every existing caller keeps its value.
4. ~~**Pluggable engine**: an `engine` option on `createWorkbook` with the
   built-in evaluator as default and a HyperFormula implementation moved
   from `packages/grid/src/hyperformula-adapter.ts`'s contract. Keeps the
   promise in `spreadsheet-formulas.md` ("the HyperFormula adapter is still
   there") true for the shell, not only for a bare grid.~~ Shipped, with a
   narrower seam than planned: an engine answers a formula's value and the
   grid it spills, and the workbook keeps the graph, the cache, the cycles
   and the spill ranges, since those are read off the reference grammar
   rather than the engine. Phase B is complete.

### Phase C. Ribbon parity (M)

Small, independent items. Take them in this order, each one deleting a
line from "What it does not do":

1. Validation Input Message and Circle Invalid Data (S).
2. Format Cells Accounting and Special (S); `compileNumberFormat` already
   handles the patterns, the dialog only lacks the pages.
3. Custom Sort dialog (S).
4. Sheet tab hide / unhide, duplicate, delete (S).
5. AutoFilter Date Filters, Filter by Color, Top 10 with a count (M).
6. Conditional formatting formula rule and two-colour data bars with a
   negative axis (M).
7. Formula auditing arrows from `deps.ts` drawn on the grid's overlay
   layer, the same layer `spreadsheetLayout` uses for borders (M).
8. ~~Comment threads and protection with allowed ranges (M each). Threads
   change the `comments` shape in `SheetState`; keep reading the old shape.~~ Shipped.

### Phase D. Objects (L)

~~Charts first, because the chart engine is already free in `@svgrid/grid`
and demo 356 proves the data path. An object layer over the grid holds
anchored rectangles (chart, image, sparkline group), stored in the document,
moved with insert and delete through `shiftRect` in `rects.ts`, and
serialised by Phase A.~~ Charts, pictures and sparklines shipped: the
layer, the anchor, the Chart dialog, Insert > Chart and Insert > Picture,
and the sparkline groups with their own dialog on the Insert tab. The PivotTable over a range came last, as
planned, on `pivot.ts` with the sheet range as its row source. Not done:
any of them in the .xlsx (a chart part is a large piece of OOXML of its
own, and a sparkline is an x14 extension).

### Phase E. Reach (M)

1. ~~**Localisation**: a `SheetMessages` type and a `localization` prop on
   `SvSheet`, threaded to the ribbon, dialogs and status bar the way
   `GridMessages` works. Format the status-bar numbers with the locale
   instead of `en-US`.~~ Shipped.
2. ~~RTL, touch and accessibility audits with Playwright specs under
   `tests/`, fixing what they find.~~ Shipped, with the fixes listed in
   the Status section. Left as it is on purpose: a font colour or fill
   the DOCUMENT sets is used as it stands on a dark theme, as Excel does.
3. ~~**`<sv-sheet>`**: a commercial web component entry under
   `@svgrid/enterprise` (it already builds a CDN bundle with Svelte
   external), with wrappers generated the way `grid-wc` generates React,
   Vue and Angular ones. Licensing rule from `AGENTS.md`: nothing moves into
   an MIT package.~~ Shipped as `@svgrid/enterprise/wc` with React and Vue
   wrappers; Angular uses the element with `CUSTOM_ELEMENTS_SCHEMA`, since a
   partial-Ivy build needs ng-packagr in the pack, which it does not carry.
4. ~~Studio codegen for a sheet page, MCP eval prompts that ask for a sheet,
   and a `skills/svgrid/rules/sheet.md` with the shell's house rules
   (`refresh()` after outside writes, `cmd.batch` for one undo, qualified
   addresses in `formats`).~~ Shipped: a Spreadsheet block in Studio over
   `sheetCellsFromRows`, a `build_sheet` prompt on the MCP server, and the
   rules file.

### Phase F. Scale and collaboration (L)

1. ~~Measure first: a `tools/bench.mjs` case that fills a sheet with a
   formula per row at growing sizes and records type-to-paint time. Publish
   the ceiling in the docs rather than a guess.~~ Shipped, with the
   evaluation counters gated in CI and the ceiling in the docs.
2. If the bench says so: sparse cell storage in `Workbook`, batched
   recalculation, and a worker build of the evaluator behind the `engine`
   seam from Phase B. The bench does not say so yet: one keystroke is one
   evaluation, 50k formula rows open in about half a second and retain
   about 84 MB. The one thing it did say, a deep chain overflowing the
   stack, is fixed. Revisit at 500k rows, or when a sheet arrives that is
   mostly empty, where dense `string[][]` storage is the waste.
3. ~~Collaboration: turn `SheetChangeReason` into a delta stream (each
   reason already names its sheet and kind; add the payload), an
   `applyDelta` on the document, and a recipe with a socket server. Presence
   (other users' active cells) is a grid overlay. Conflict handling starts as
   last-writer-wins per cell, documented as such.~~ Shipped as
   `createDeltaStream` / `applySheetDelta`, with the socket recipe in the
   shell's docs and demo 478. Presence is still a grid overlay and still to
   do.

## 4. Rules that apply to every phase

- The sheet is Enterprise. New sheet code goes under `packages/enterprise`;
  a grid-level seam it needs (an overlay layer, an object host) goes in
  `packages/grid` as a registered feature so it tree-shakes.
- Anything the shell does not need on first paint is a lazy import or a
  separate subpath, so `@svgrid/enterprise/sheet` stays the shortcuts and
  engine only.
- A feature is done when it has: unit tests beside the module, a browser
  test where the grid is involved, a demo in `examples/src/demos/` with the
  matching entry in `website/src/lib/demos.ts` (`pnpm demos:count`), a
  docs page or section, the line removed from "What it does not do", a
  changeset, and the shortcut listed in `keyboard-shortcuts.md` when it has
  one.
- No em-dash characters. No typed numbers: bundle size from `pnpm size`,
  demo counts from `pnpm demos:count`.
- Excel's behaviour is the spec. When Excel and Google Sheets differ,
  follow Excel and note the difference in the docs.

## 5. Suggested first milestone

Phase A items 1 to 3 (xlsx in and out, File tab) plus Phase B item 1
(function packs, financial first) and Phase C items 1 to 4. That is the set
a trial user hits in the first hour: open a file, see PMT work, validate
input, sort by two keys, save the file back. Everything else waits on
feedback from that.

## 6. Open questions for the maintainer

1. Should xlsx open and save be a ribbon File tab, or stay host-driven
   through `onAction` with only the functions exported? The plan assumes
   both: the tab by default, `onAction` to take it over.
2. Is HyperFormula behind the shell worth its licence story, or should the
   built-in engine grow until the adapter can be retired?
3. Does the `<sv-sheet>` element ship inside `@svgrid/enterprise` or as its
   own commercial package? Pricing decides that, not code.
4. Collaboration: is a reference server part of the product, or only a
   recipe against the delta stream?
