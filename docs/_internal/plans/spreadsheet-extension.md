# Spreadsheet extension plan

Internal planning note. `docs/_internal/` is skipped by
`tools/build-docs-index.mjs`, so nothing here reaches docs.json, llms.txt or
the site. Ship a feature, then move its sentence into the public docs.

Written 2026-09-18 against the `main` head after the "Spreadsheet mode"
commit (`43c01c2`). Accepted the same day.

## Status

The first milestone (section 5) shipped on the plan's branch, one commit
per item:

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
  Ctrl+O and Ctrl+S). Print and Page Layout (item 4) are not done.
- Phase C item 8, threads: `CommentThread` (author, time, replies,
  resolved) beside the plain note in the same map, the thread card in the
  comment box, `commentAuthor` on the shell, and Excel's threaded comment
  parts in the xlsx writer and reader.
- Phase E item 1: `SheetMessages`, `SheetLocalization` and the
  `localization` prop, threaded through Svelte context to the ribbon,
  the formula bar, the tab strip, every dialog and the status bar; the
  ribbon's keys are read off the model. The rule descriptions in the
  Rules Manager and the function names stay English.

Deviations from the plan: Data Validation is a plain dropdown, not a split
button, because the ribbon model forbids a dropdown that emits its own
face; the xlsx reader uses DOMParser (present in browsers and jsdom) and
throws a clear error where it is absent. Tables, charts and images do not
ride in the file. Demo 474 shows the milestone; its entry in the website's
demo registry (a private submodule not checked out here) is still to add.

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

Two facts shape the plan:

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
| Print and Page Layout | `export-print.ts` prints grid rows; no Page Layout tab, no page setup, no print area | M |
| Persistence hooks (autosave to a server) | `onChange` + `getState()`; demo 465 does localStorage | S (docs and a recipe) |

### Formula engine

| Gap | Today | Effort |
| --- | --- | --- |
| ~~Financial functions (PMT, PV, FV, NPV, IRR, RATE, NPER)~~ | shipped, with IPMT, PPMT and SLN | done |
| ~~Math and statistics (SUMPRODUCT, PRODUCT, CEILING, FLOOR, TRUNC, LOG, EXP, PI, RAND, RANDBETWEEN, LARGE, SMALL, PERCENTILE, QUARTILE, VAR, MODE, AVERAGEIFS, MAXIFS, MINIFS, CORREL, FORECAST)~~ | shipped | done |
| ~~Text (PROPER, REPT, VALUE, CHAR, CODE, EXACT)~~ | shipped; TEXTSPLIT waits on spill, NUMBERVALUE not done | done |
| ~~Date (WEEKDAY, EDATE, NETWORKDAYS, WORKDAY, WEEKNUM, HOUR, MINUTE, SECOND, TIME)~~ | shipped, with DATEVALUE, TIMEVALUE, DAYS360, YEARFRAC | done |
| ~~Reference functions (INDIRECT, OFFSET, ROW, COLUMN, ROWS, COLUMNS, ADDRESS, CHOOSE)~~ | shipped; INDIRECT and OFFSET are volatile, recomputed on every write | done |
| Dynamic arrays and spill (FILTER, UNIQUE, SORT, SORTBY, SEQUENCE, `#SPILL!`) | the evaluator returns one value per cell; no spill ranges in the workbook | L |
| LET / LAMBDA | none | M, after spill |
| A pluggable engine (HyperFormula behind the shell) | `withCustomFunctions` is the only seam | M |
| Iterative calculation (circular references with a cap) | cycles are `#CYCLE!` | S |

### Ribbon parity

| Gap | Today | Effort |
| --- | --- | --- |
| ~~Formula auditing: Trace Precedents / Dependents~~ | shipped; Evaluate Formula and Error Checking not done | done |
| ~~Conditional formatting: formula rule, negative axis and second colour on data bars~~ | shipped | done |
| ~~AutoFilter: Date Filters, Filter by Color, custom Top 10~~ | shipped | done |
| ~~Validation: Input Message, Circle Invalid Data~~ | shipped | done |
| ~~Format Cells: Accounting, Special~~ | shipped | done |
| ~~Custom Sort dialog (several keys, header row)~~ | shipped; by colour not done | done |
| Comments as threads (author, time, replies, resolve) | one note per cell | M |
| Protection: password, allowed ranges, per-user | lock flag only | M |
| ~~Sheet tabs: hide / unhide, duplicate, delete with confirm~~ | shipped; move between workbooks not done | done |
| Styles gallery and Format as Table | `styles` ribbon id exists; verify what it does | S |

### Objects on the sheet

| Gap | Today | Effort |
| --- | --- | --- |
| Charts anchored to cells, fed by a range | Insert > Chart is an `extras` entry the application answers; demo 356 shows the grid chart panel over a formula sheet | L |
| Sparklines in cells | the grid has sparkline columns, the sheet has no Insert > Sparkline | M |
| Hyperlinks (HYPERLINK function and Insert > Link) | none | S |
| Images in cells or floating | grid export knows images; sheet does not | M |
| PivotTable from a range | the pivot engine exists; no Insert > PivotTable | L |

### Reach

| Gap | Today | Effort |
| --- | --- | --- |
| Localised ribbon, dialog and status-bar strings | English literals; the grid's `localization` prop does not reach the shell; the status bar hard-codes `en-US` | M |
| RTL sheet (columns run right to left, A on the right) | grid supports RTL; the shell is untested | S to audit, M to fix |
| Touch: fill handle, range drag, ribbon on phones | ribbon folds at narrow widths; five touch mentions in the shell | M |
| Accessibility audit of ribbon and dialogs | grid is WAI-ARIA 1.2; shell not audited | M |
| `<sv-sheet>` web component with React / Vue / Angular wrappers | `grid-wc` has `<sv-grid>` and `<sv-chart>` only; the sheet is commercial, so the element cannot live in the MIT `grid-wc` | L |
| Studio, MCP, skill rules know the sheet | MCP demo data carries the sheet demos; Studio codegen and `skills/svgrid/rules` do not mention it | S |

### Scale and collaboration

| Gap | Today | Effort |
| --- | --- | --- |
| Large sheets | `Workbook` keeps `string[][]` per sheet plus a `values` map; defaults are 50 x 12; no measured ceiling | M (measure first) |
| Recalculation off the main thread | none | L |
| Co-editing (deltas, presence, conflict) | `onChange` reports fourteen change kinds (`SheetChangeReason` in `document.ts`), full-state save and restore; the grid has `real-time.md` and `collaboration.md`, neither mentions the sheet | L |

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
4. **Print**: a Page Layout tab with orientation, margins, print area,
   repeat header rows, feeding `export-print.ts` with the sheet's formats.
5. Docs: a new `docs/help/cells/sheet-files.md`; remove "no Page Layout"
   from the shell page; a demo that opens a bundled xlsx.

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
3. **Dynamic arrays**: `evaluate` returns a matrix, the workbook owns spill
   ranges, a blocked spill is `#SPILL!`, `translateFormula` and
   `fixupReferences` treat the anchor as the formula cell. This is the L
   item; do it after the packs so FILTER, UNIQUE, SORT and SEQUENCE land on
   a working spill.
4. **Pluggable engine**: an `engine` option on `createWorkbook` with the
   built-in evaluator as default and a HyperFormula implementation moved
   from `packages/grid/src/hyperformula-adapter.ts`'s contract. Keeps the
   promise in `spreadsheet-formulas.md` ("the HyperFormula adapter is still
   there") true for the shell, not only for a bare grid.

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
8. ~~Comment threads~~ (shipped) and protection with allowed ranges (M each). Threads
   change the `comments` shape in `SheetState`; keep reading the old shape.

### Phase D. Objects (L)

Charts first, because the chart engine is already free in `@svgrid/grid`
and demo 356 proves the data path. An object layer over the grid holds
anchored rectangles (chart, image, sparkline group), stored in the document,
moved with insert and delete through `shiftRect` in `rects.ts`, and
serialised by Phase A. PivotTable from a range comes last and reuses
`pivot.ts` with a sheet range as its row source.

### Phase E. Reach (M)

1. ~~**Localisation**: a `SheetMessages` type and a `localization` prop on
   `SvSheet`, threaded to the ribbon, dialogs and status bar the way
   `GridMessages` works. Format the status-bar numbers with the locale
   instead of `en-US`.~~ Shipped.
2. RTL, touch and accessibility audits with Playwright specs under
   `tests/`, fixing what they find.
3. **`<sv-sheet>`**: a commercial web component entry under
   `@svgrid/enterprise` (it already builds a CDN bundle with Svelte
   external), with wrappers generated the way `grid-wc` generates React,
   Vue and Angular ones. Licensing rule from `AGENTS.md`: nothing moves into
   an MIT package.
4. Studio codegen for a sheet page, MCP eval prompts that ask for a sheet,
   and a `skills/svgrid/rules/sheet.md` with the shell's house rules
   (`refresh()` after outside writes, `cmd.batch` for one undo, qualified
   addresses in `formats`).

### Phase F. Scale and collaboration (L)

1. Measure first: a `tools/bench.mjs` case that fills a sheet with a
   formula per row at growing sizes and records type-to-paint time. Publish
   the ceiling in the docs rather than a guess.
2. If the bench says so: sparse cell storage in `Workbook`, batched
   recalculation, and a worker build of the evaluator behind the `engine`
   seam from Phase B.
3. Collaboration: turn `SheetChangeReason` into a delta stream (each
   reason already names its sheet and kind; add the payload), an
   `applyDelta` on the document, and a recipe with a socket server. Presence
   (other users' active cells) is a grid overlay. Conflict handling starts as
   last-writer-wins per cell, documented as such.

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
