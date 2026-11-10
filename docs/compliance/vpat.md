# Accessibility Conformance Report (VPAT 2.5Rev, INT)

**Product:** SvGrid (`@svgrid/grid`, `@svgrid/enterprise`, SvGrid Base)
**Report version:** 2.5
**Report date:** 2026-11-08
**Standards:** WCAG 2.2 Level A and AA, Revised Section 508, EN 301 549 v3.2.1
**Contact:** support@jqwidgets.com

This report follows the **VPAT 2.5Rev International edition**. Version 1.0
(2026-08-24) covered WCAG 2.1. This version moves to WCAG 2.2, re-checks every
row against the code, and corrects four rows that version 1.0 overstated
(2.1.1, 2.1.2, 2.4.3, 2.4.7). The defects behind 2.1.2 and 2.4.7 were fixed
while this report was written; the rest are listed as gaps below.

Version 2.1 adds SvGrid Base, which version 2.0 did not cover and for which
several of its rows were false. An expert review of Base in real browsers on
2026-11-06 found them, the defects behind them were fixed, and each row below
was re-read after the fix. Where a plain `<SvGrid>` and Base differ, the row says
which it means.

Version 2.2 follows a second review of Base on 2026-11-06. It found rows of 2.1
that were not true (2.4.7, 2.4.11, the expanded state under 4.1.2, the Ember text
pairs under 1.4.3, and 1.4.11 on the Gantt view). The defects behind them were
fixed, and every row below was checked again against that review's findings.

Version 2.3 follows a third review of Base on 2026-11-07, in Chrome, Edge, Firefox
and WebKit. It found rows of 2.2 that were not true (2.4.7, 1.4.11, 1.4.13, the
"every other Ember token pair" sentence of 1.4.3, and the text of 2.1.1, 2.4.3,
1.4.10 and 4.1.3). The defects behind 2.1.1, 2.4.3, 2.4.7, 1.4.10 and 4.1.3 were
fixed. Colors are not changed by an accessibility fix without the product owner, so
1.4.3 and 1.4.11 now state the pairs that fail, with their measured ratios.

Version 2.4 follows a fourth review of Base on 2026-11-07, in Chrome, Edge, Firefox
and WebKit. It found rows of 2.3 that were not true (1.4.1, 1.4.3, 2.1.1, 2.4.3,
2.5.7, 2.5.8, 3.3.1, 4.1.2, 4.1.3, and the Grid board and Scheduler rows). The
defects behind 2.1.1, 2.4.3, 4.1.2, 4.1.3 and those two rows were fixed, and part of
2.5.8. 1.4.1, 1.4.3, 2.5.7, 2.5.8 and 3.3.1 now say what stays.

Version 2.5 follows a fifth review of Base on 2026-11-08, in Chrome, Edge, Firefox
and WebKit. It found rows of 2.4 that were not true or not whole (1.3.1, 1.4.11,
2.4.3, 2.5.8 and the Scheduler row): a calendar drew events an hour off on a day
the clocks change, an event over several days was named by its first day, a ticked
checkbox read as empty under forced colors, and a delete of the last record of a
group sent focus to its header. Those defects were fixed. 2.5.8 now names the rating
icons, which stay as they are until the product owner rules.

> **This is a self-assessment, not a third-party audit.** Every "Supports"
> names the test or the code behind it. Where a criterion depends on your
> content or your theme, the row says so.

## What SvGrid is, for the purposes of this report

SvGrid is a **software component** that renders a data grid inside a page you
control. Page-level criteria (page title, language of page, bypass blocks,
consistent navigation, consistent help) are **Not Applicable** to the
component; you remain responsible for them in the host page.

Several criteria are **shared**: the grid supplies roles, names and keyboard
behaviour, and you supply cell content. A custom cell renderer that emits an
image without alt text fails 1.1.1 whatever the grid does. Those rows read
*Supports, with author responsibility*.

## Evaluation methods

| Method | What it covers | Where it runs |
| --- | --- | --- |
| `axe-core` in jsdom | Roles, names, relationships, duplicate ids, nested interactive controls. Plain grid, filter row + global filter, row selection, pagination, an invalid cell, an open cell editor | `packages/grid/src/a11y.axe.test.ts`, every commit |
| `axe-core` in Chromium | The same plus the layout rules jsdom cannot run (`color-contrast`, `target-size`), tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, on the quick-start demo in the default theme | `tests/e2e/grid-a11y.spec.ts`, every commit |
| Keyboard and focus in Chromium | Tab leaves the grid at both ends; focus is visible when the keyboard brings it in; the forced-colors indicator | `tests/e2e/grid-a11y.spec.ts` |
| Base by keyboard, touch and live region, in Chromium | Record, field and table menus, Tab in the rows, focus clear of pins, announcements, the calendar move, forms, panels, find, right to left, a long press, and axe over the six views of the CRM sample | `tests/e2e/base-a11y.spec.ts` |
| axe over Base, by hand | `wcag2a` to `wcag22aa` and `best-practice`, in Chromium with the Ember theme. On 2026-11-07: every view of all 11 sample bases in light, and of Sales CRM, Product roadmap and Hiring tracker in dark, plus a dashboard, dashboard edit and the record view. The views report the pairs stated under 1.4.3, and these, since fixed: an empty board lane's `aria-required-children`, the same rule on a list grouped on a server, a link chip's `nested-interactive` in a list, and `target-size` on Add table at a phone's width and a mail link in a record. After those fixes `nested-interactive`, `target-size`, `aria-required-children` and `button-name` pass over the list views of demos 719 and 723, a grouped list and the first two views of four bases at 360 px, and a record; the 55-view runs were not repeated after them. The record view and the dashboard in dark add Delete record, and the automations panel adds two more, all under 1.4.3. On 2026-11-06: three bases, the view bar's panels and the field editor | Not repeated on every commit |
| Focus, treegrid and Gantt in three browsers | What happens when a focused control goes (comments, forms, the form builder, dashboards, filters, automations, attachments, import, the inbox, the field editor, boards, calendars, cards, column menus, Undo), commits from select cells, group rows by keyboard, a column menu's End, and the Gantt view by keyboard, under right to left and forced colors, plus `heading-order` and `color-contrast` on comments, automations and a dashboard | `tests/e2e/base-focus.spec.ts`, `tests/e2e/base-gantt-a11y.spec.ts`; Chromium on every commit, Firefox and WebKit by hand on 2026-11-06, and the walks added on 2026-11-07 by hand in Chrome, Edge, Firefox and WebKit |
| Keyboard parity, by hand | 19 checks of menus, Tab, pins, announcements, right to left, find and the calendar move, on 2026-11-06 | Firefox and WebKit through Playwright, headless |
| WCAG contrast computation | Body, secondary, header, zebra, hover, selection and on-accent text at 4.5:1, and the accent at 3:1, for **all 20 built-in themes in light and dark**. One named exemption: Ember's text on its accent, pinned at its measured ratios (see 1.4.3) | `packages/grid/src/themes/contrast.test.ts` |
| ARIA contract and announcement tests | Role and `aria-*` builders; the live-region messages on a mounted grid | `a11y.test.ts`, `a11y.contract.test.ts`, `a11y.announce.test.ts`, `a11y/*.test.ts` |
| Third review, by hand | Focus, keyboard, emulated touch, viewports of 640x512 and 320x256 for 200 and 400 percent zoom, emulated forced colors, pseudo-translation, and each row below, on 2026-11-07 | Chrome, Edge, Firefox and WebKit through Playwright; not every check in every browser |
| Keyboard paths in three browsers | A keyboard move and Escape on a board and a calendar, a calendar carry past the last week a month of five weeks draws and across a change of the clocks, a day calendar on a 23- and a 25-hour day (`scheduler-clock-change.spec.ts`), Undo of a board move, a list in every shape (rows in the page, grouped, read from a server, a phone), a selected row and card told from the focused one, the selection bar and a list's next record after Delete, a form sent, a dashboard tile moved to either end and Enter again, a comment's question and its notes said aloud | `tests/e2e/base-keyboard-paths.spec.ts`; Chromium on every commit, Firefox and WebKit by hand on 2026-11-07 and 2026-11-08 |
| A finger in a cell | A tap on a link, email, phone or URL cell selects it and the next tap follows; beside a checkbox's box or on a checklist a tap selects; the box, a star and a vote act on the tap | `tests/e2e/base-first-click.spec.ts`; Chromium on every commit, Firefox and WebKit by hand on 2026-11-08 |
| Fourth review, by hand | Each row below, axe in dark over all 55 views of the 11 sample bases, axe over the same views at a phone's width, right to left, and pseudo-translation, on 2026-11-07 | Chrome, Edge, Firefox and WebKit through Playwright; not every check in every browser |
| Code review | Each row below, re-read against the source on 2026-10-25 and again on 2026-11-07 | This report |

### Known limits of this evidence

- **No screen-reader pass (NVDA, JAWS, VoiceOver) has been recorded, for the
  grid or for Base.** Rows that depend on assistive-technology behaviour rest on
  the ARIA implementation, the axe runs and reading the text of the live region.
- No real iPhone, iPad, on-screen keyboard, macOS Safari or IME has been used.
  Touch was emulated in Chromium, the IME checks are synthetic events, and the
  Menu key's real `contextmenu` was simulated, not pressed.
- Browser zoom itself was not used. The 200 and 400 percent results come from
  viewports of 640x512 and 320x256.
- Forced colors was checked by emulation.
- In WebKit the axe checks on a comment and a dashboard were run with axe directly
  in the page: the Playwright wrapper for axe stalled on those two states there.
- A chart view's hidden data table keeps English words ("Category", "bar chart")
  under a full `setBaseMessages`. The Gantt view's words go through the base's
  messages; its dates are the browser's locale. Pseudo-translation over import,
  attachments, comments, dashboard edit and the Gantt on 2026-11-07 left these and
  two accessible names, a rating's and a gallery's, which are fixed.
- Base keyboard walks now cover the grid, calendar, form, panels, automations
  builder, dashboard edit mode, attachments, import, the Gantt view, cards and
  `<sv-base>`. They were walked in a browser, by a person's keys through Playwright,
  not by a user of assistive technology. Text spacing (1.4.12) has no automated test.
- Walked on 2026-11-07: phone flows (record, value edit, board, calendar, chart,
  form, Timeline) with touch emulated, a keyboard at 400 percent, and the axe runs
  named above.
- Walked on 2026-11-07 in the fourth review, and seen to be true: 1.3.2, 1.3.4,
  1.3.5, 2.1.4, 2.5.1, 3.2.1, 3.2.2, 3.3.2, 3.3.3, and 2.4.11 on cards at 360 and
  320 px. The sheet's keyboard row and Kanban's drag-only gap were read and walked
  there too.
- Not covered: the export menu, the import dialog and the change review rows by
  keyboard in that review; the pivot designer by keyboard; the sheet in dark; 1.4.12
  on what the third and fourth reviews added; a second run of the scheduler's
  "+N more" size.
- The browser axe run on the plain grid covers one configuration (the
  quick-start demo, default theme). The jsdom runs cover the others with
  virtualization off.
- Only the built-in themes are contrast-tested. A custom theme is yours to
  verify; the method is in [accessibility](../help/accessibility.md).

## WCAG 2.2 Level A

| Criterion | Conformance | Remarks |
| --- | --- | --- |
| 1.1.1 Non-text Content | Supports, with author responsibility | Grid controls carry text or `aria-label`. Content you render in cells is yours. |
| 1.2.1-1.2.3 Time-based Media | Not Applicable | No audio or video. |
| 1.3.1 Info and Relationships | Partially Supports | Native `<table>` semantics plus `grid` / `treegrid`, `rowgroup`, `row`, `columnheader`, `gridcell`, `aria-rowcount`, `aria-colcount`, and absolute `aria-rowindex` / `aria-colindex` on body cells. A grouped grid is a `treegrid`: group rows and record rows both carry `aria-level`. Base: a month calendar is a `table` of weeks and days, and each event's name holds its date; an event over several days names its first and its last day (until 2026-11-08 only the first). A Gantt's task list is a `table` of rows, cells and column headers with `aria-rowindex`, and its bars are a named group of buttons that each say their dates, length and progress. Gaps: a Gantt's task nesting is shown by indent and its chevrons, not by `aria-level`, and a bar is not tied to its row of the task table; header rows carry no `aria-rowindex` and header cells no `aria-colindex` (matters under column virtualization); a cell range selection is shown visually but not exposed through `aria-selected`. |
| 1.3.2 Meaningful Sequence | Supports | DOM order follows visual order, pinned columns included. |
| 1.3.3 Sensory Characteristics | Supports | Sort state is exposed through `aria-sort`, not only by the icon. |
| 1.4.1 Use of Color | Partially Supports; author responsibility for what you configure | Sort shows an arrow as well as `aria-sort`, and row selection a tick in its checkbox as well as `aria-selected`. In Base a selected list row or gallery card has the grid's selected-row fill and a tick by its title, which stays under forced colors, and says "Selected" to a screen reader; the focus ring marks focus alone, and a form's error is a line of text under the field. **Gap: a cell failing `validate` is seen as a red tint and ring.** `aria-invalid` and the message reach assistive technology, and the message shows on hover, so a sighted keyboard user sees the tint with no text (grid and Base cells; see 3.3.1). **Gap: a Base pie or donut ties its slices to the legend by color,** with a percent on the slice. The name of a slice is in its tooltip, on hover, and in the chart's hidden data table. Conditional formatting you configure is yours. |
| 1.4.2 Audio Control | Not Applicable | No audio. |
| 2.1.1 Keyboard | Partially Supports | Navigation, row selection, sorting, filtering, editing, undo, column and row resize (arrow keys on the focused handle) and tree / group expand all work from the keyboard: on a group's row Left and Right close and open it, Enter and Space toggle it, and Ctrl+Enter does on any cell. The Menu key and Shift+F10 open the context menu, and the column and context menus take focus and walk with arrows, Home, End and first letters. Base: every record action (expand, comment, select, insert, duplicate, copy, paste, delete) is in that menu, the record view can delete, a calendar event moves with Space and the arrows, an all-day bar in Week or Day too, a field moves from its menu or from Hide fields, and an attachment is removed by its button or the Delete key. Cards at a phone's width, a gallery and a list open the same menu by the Menu key, Shift+F10, a long press or a button on the card or row, which takes Enter and Space, without copy and paste, which work on a cell. A list takes Tab and walks by arrows in every shape: rows in the page, grouped, read from a server, on a phone (`base-keyboard-paths.spec.ts`). A board card and a calendar event have shorter menus of their own (`base-focus.spec.ts`). On a Gantt bar Space picks it up, the arrows move it, Delete asks first, and Shift+F10 opens its menu with focus in it. Gaps: drawing a dependency link between two Gantt bars and dragging its progress grip are pointer actions (progress has + and -, and a link is a field in the record); managed row dragging (`rowDragManaged`) has no keyboard path; on a plain grid moving a column has one only through the tool panel's Move up / Move down; a custom header renderer gets `role="button"` with `tabindex="-1"`. |
| 2.1.2 No Keyboard Trap | Supports | Tab on the last cell and Shift+Tab on the first move focus off the grid (`tests/e2e/grid-a11y.spec.ts`). Before 2026-10-25 every Tab was consumed and no key left the grid. A plain grid's Tab walks every cell, so on a very large grid Ctrl+End then Tab is the practical way out. Base's rows are one stop; where Tab walks cells there, a line on screen and the live region give the way out, Esc then Tab. A view bar panel keeps Tab inside it and Escape closes it. |
| 2.1.4 Character Key Shortcuts | Supports | Typing a character starts editing only while focus is on the grid (the "active only on focus" exception). |
| 2.2.1 Timing Adjustable | Not Applicable | No time limits. |
| 2.2.2 Pause, Stop, Hide | Supports, with author responsibility | The grid starts no auto-updating content. A live feed you push into it is yours to make pausable. The cell flash stops under `prefers-reduced-motion`. |
| 2.3.1 Three Flashes or Below Threshold | Supports | The cell flash is one fade per value change. |
| 2.4.1 Bypass Blocks | Not Applicable | Page-level. |
| 2.4.2 Page Titled | Not Applicable | Page-level. |
| 2.4.3 Focus Order | Partially Supports | Plain grid: Tab walks the cells and leaves at either end, so it is not one tab stop, and header and footer controls come after the last cell. Base: for a keyboard user the rows are one tab stop and Tab goes on to the header and footer controls. Tab walks cells only after a click on a cell, or from an open editor, which an arrow key or Escape ends. Column and context menus give focus back when they close, and focus stays in the grid after a record is deleted. A commit in any cell editor leaves focus in the grid. A control that goes while it holds focus hands it to the control in its place (`keepFocus`, in dialogs, drawers, menus and view bar panels, on dashboards, the inbox, boards, calendars, cards, lists, the Gantt view, and beside Undo and Redo). A dialog or menu whose opener left the page, or can no longer take focus, gives it to what held the opener: the grid, after Expand record, Comment, Pin, Hide field or Delete field, or the next card (`createFocusTrap`, `menuFocus`, `base-focus.spec.ts`). So the grid gets it back, not the header control a column menu came from, when that control has gone. A question that replaces a control takes focus itself, as Remove on a dashboard tile, Delete on the selection bar and Delete on a comment do, and Escape on it goes back without closing what it sits in. The selection bar gives focus back when it goes: to Delete after its question, and after Clear, Escape or a confirmed Delete to where focus was before the bar, or the next record. A form sent puts focus on its thank-you, and Submit another on the new form's title. A dashboard tile moved by its buttons keeps focus on the button pressed; at either end that button is off (`aria-disabled`) and keeps focus, so a second Enter does nothing. Escape on a keyboard move leaves focus on the card or event, past the edge of a calendar's view too, and while an event is in hand focus stays on it: in a month drawn in five weeks the view goes on to the next month with it. Undo of a board move puts focus back on the card, and a confirmed Delete in a list on the record after it: the first record of the next group when it was the last of its group (its group's header until 2026-11-08), and the record before it when it was the last of the list. A list is one tab stop on the record last moved to, then that record's button (`base-keyboard-paths.spec.ts`). In a gallery every card is a stop, so the selection bar comes after them all: 39 Tabs from the first of 12 cards. Verdict stays partial because of the plain grid's Tab order above and that gallery order. |
| 2.4.4 Link Purpose (In Context) | Supports, with author responsibility | Links in cells are yours. |
| 2.5.1 Pointer Gestures | Supports | No multipoint or path-based gesture is required. |
| 2.5.2 Pointer Cancellation | Supports | A pointer-down on a cell only moves the active cell and starts a selection; buttons, menus, sorting and editing act on click (the up event). |
| 2.5.3 Label in Name | Supports | Accessible names of grid controls contain their visible text. |
| 2.5.4 Motion Actuation | Not Applicable | No motion input. |
| 3.1.1 Language of Page | Not Applicable | Page-level. |
| 3.2.1 On Focus | Supports | Focus alone never changes context. |
| 3.2.2 On Input | Supports | Filtering and editing update the grid in place. |
| 3.2.6 Consistent Help | Not Applicable | Page-level. |
| 3.3.1 Error Identification | Partially Supports; author responsibility for what counts as invalid | Base forms support it: a field in error gets `aria-invalid`, its message shows under it and is tied to it with `aria-describedby`, a failed submit is announced and focus goes to the first field in error. Gap: a cell failing its column's `validate`, in a plain grid or a base, gets `aria-invalid="true"` and its message reaches assistive technology as text read with the cell, but on screen the message shows on hover only: a sighted keyboard user sees the tint and no text. A base's email, web or phone cell takes any text and shows what is no address as plain text with no link; a form refuses it. |
| 3.3.2 Labels or Instructions | Partially Supports | Cell editors are named after their column (`a11y.axe.test.ts`). Base forms: typed fields are `<input>`s with a `<label>` and `aria-required`. Fields with a picker (select, date, file, link, rating) are buttons named with the field and "required" until opened. Gap: the inline filter-row input has a placeholder and no label. |
| 3.3.7 Redundant Entry | Not Applicable | The grid runs no multi-step process. |
| 4.1.2 Name, Role, Value | Partially Supports | Grid structure, selection checkboxes (`aria-checked`, including `mixed`), sort buttons, expanders and editors expose name, role and state, and axe's rules for them pass in both runs. A group row's `aria-expanded`, chevron and button label follow its state, on a mounted row that stays in place (`svgrid.group-props-reactive.svelte.test.ts`). Base: the table tabs, panel buttons (`aria-expanded`), calendar view buttons (`aria-pressed`), board lanes and record fields pass axe. A menu item that is off is `aria-disabled` and stays in the arrow-key and first-letter order, so a screen reader moving through the menu hears it and why (Download as Excel without jszip, Delete table on the last table, a column menu's Unpin); until 2026-11-08 the arrows skipped it (`menu-focus.test.ts`, `SvMenu.test.ts`). A selected card or list row says so in its text, as neither has `aria-selected`. A Base checkbox cell is named by its field and says its state once, by `aria-checked`; until 2026-11-09 its name was its state, in English whatever the app's words. It is `aria-readonly` only where it cannot be changed (until 2026-11-09, always), and a change to it is said as "checked" or "unchecked", not "true" or "false". A list row is one button with a separate actions button beside it, and a link chip in it is text for the pointer, not a control of its own, so axe's `nested-interactive` passes. Gaps: range selection state (see 1.3.1) and custom header renderers (see 2.1.1). |
| 4.1.3 Status Messages | Partially Supports | Filter match counts, cleared filters and bulk selection changes go to a visually hidden `role="status"` region (`a11y.announce.test.ts`). What the tree already carries (the active cell, `aria-sort`, one row's `aria-selected`) is not repeated there. Base adds cell edits, clears, pastes, undo and redo, a failed form, each step of a calendar or Gantt move, comment changes, tile and form builder moves, automation step moves and a file removed. Opening or closing a group is left to `aria-expanded` on the row, in a plain grid and in Base: it says nothing, and a filter's count is not repeated (`base-focus.spec.ts`). A dashboard tile's Remove question is read out, a form sent says the record was added, a board card's and calendar event's cancelled move is said, and Next held by a comment being changed says why. Gap: a plain grid does not announce a cell edit or an undo. How these queue in a screen reader has not been heard (see *Known limits*). |

WCAG 2.2 removed 4.1.1 Parsing; it is not listed.

## WCAG 2.2 Level AA

| Criterion | Conformance | Remarks |
| --- | --- | --- |
| 1.2.4, 1.2.5 Captions, Audio Description | Not Applicable | No media. |
| 1.3.4 Orientation | Supports | No orientation lock. |
| 1.3.5 Identify Input Purpose | Partially Supports | Not applicable to a plain grid, which collects no personal data about the user. Base forms can: an email, phone or web address field carries its `autocomplete` purpose, a text field gets one from an English name (Name, City, Company...), and `fieldProps.autocomplete` sets any other, which a form in another language needs. |
| 1.4.3 Contrast (Minimum) | Partially Supports; author responsibility for custom themes | **Ember, the default preset, does not meet this criterion on filled accent controls.** Its text on them is white by design: 3.53:1 in light (`#ff3e00`) and 3.12:1 in dark (`#ff5a1f`), below 4.5:1. In Base that is an active calendar view button, a form's Submit button and other accent-filled buttons. To meet AA, use another preset, override the accent (the text color is then recomputed), or set `--sg-on-accent: #18181b` (5.01:1 light, 5.68:1 dark). The other 19 presets pass 4.5:1 in light and dark, text on the accent included, and the Ember token pairs that `contrast.test.ts` lists do too. That test covers those tokens, not each component's own colors. **Six more pairs in Base are under 4.5:1 and stay as they are until the product owner rules:** Delete record in the record view, in dark (`#b91c1c` on `#0c0a09`, 3.05:1); the selected Runs label of the automations panel, in light (`#ff3e00` as text, 3.38:1); the Done badge of a run (white on `#16a34a`, 3.29:1); a button field's label on a row a rule colors, in dark (Start, `#fafaf9` on `#fee2e2`, 1.33:1, barely legible); a link chip's text in a list (4.48:1, 4.13:1 on hover); and a Day or Week calendar's `:30` time labels (`#a8a4a1`, 2.47:1). A comment's time and a selected automation's trigger line failed axe until 2026-11-06, and are now checked in `base-focus.spec.ts`. **Base: text on a colored chip or bar does not meet this criterion on every color.** It is white on saturated colors by design, picked for how it reads rather than by the WCAG ratio: 8 of the 40 option colors are under 4.5:1, the lowest 2.78:1 on bright orange (`#ff6f2c`), and a color set outside the palette can be too. To meet AA, use the lightest or light option colors, which take dark text. A custom theme that sets `--sg-accent` should set `--sg-on-accent` with it. |
| 1.4.4 Resize Text | Supports | Sizes are CSS pixel tokens that scale with browser zoom. No automated 200% test yet. |
| 1.4.5 Images of Text | Supports | None. |
| 1.4.10 Reflow | Partially Supports | A table with many columns scrolls horizontally at 320 CSS px, which tabular data needs. The `responsive` prop and per-column `hideBelow` reduce the column set at narrow widths. Base: under 600 px of table width a grid view turns into cards, or a list when it is grouped, with no sideways page scroll at 320 px, and the record's actions stay (see 2.1.1). What a card has not got: copy and paste of a cell, drag of a row or column, and the footer's summaries. |
| 1.4.11 Non-text Contrast | Partially Supports | The accent used for the focus ring and selection is tested at 3:1 against the background in every theme. Gridlines are decorative and not held to 3:1. Base, board, calendar and Gantt keep switches, active states, event shapes and bars under forced colors (checked by emulation; the Gantt's has a test in `base-gantt-a11y.spec.ts`), and a percent bar keeps its fill. Under forced colors a ticked checkbox, a given rating icon and your vote are drawn in the theme's text color; until 2026-11-08 a ticked box drew its white tick on a fill the theme removes and read as empty. The grid's own row checkbox keeps its tick, and its header the mixed dash, which the theme also removed (`base-first-click.spec.ts`, `grid-a11y.spec.ts`). The pinned-column divider is drawn in `CanvasText`, and `Highlight` when it is pointed at, focused or dragged; until 2026-11-09 the theme kept its faint fill and it could not be seen. A Gantt bar's own color is the field's, picked by the author. **Gap: an input's boundary in Ember light is under 3:1.** Form and record field boxes, filter inputs and selects, the comment box and form builder inputs have a 1 px `#e7e5e4` border on white, 1.26:1, with the same fill as the page; the table search box is 1.20:1 on its `#fafaf9` bar. `contrast.test.ts` does not test `--sg-border`. The color stands until the product owner rules. An off switch's track is 1.6:1 on white and its white knob 1.6:1 on the track; the knob's place also shows the state. |
| 1.4.12 Text Spacing | Supports | Row height and padding are tokens; no automated text-spacing test yet. A review on 2026-11-06 applied the spacing and ran a clipped-text detector over the grid, board, calendar, chart, form, filter, menu and record, and it found one case: a footer summary can shorten to an ellipsis ("$3,502,5..."). The full value stays in the DOM text and its tooltip. |
| 1.4.13 Content on Hover or Focus | Partially Supports | `SvTooltip`, popovers and Base's link preview close with Escape, with the pointer still on what opened them, and stay while hovered; a pointer crossing the gap to a link preview keeps it (`base-focus.spec.ts`). The grid's cell and note tooltips, and the `tooltip` of a calendar or Gantt, close with Escape too. Gaps: those three go when the pointer leaves what opened them, so the pointer cannot move onto them, and a chart's hover tooltip has no Escape of its own: it goes with the pointer. |
| 2.4.5 Multiple Ways | Not Applicable | Page-level. |
| 2.4.6 Headings and Labels | Supports | Column headers name their columns. |
| 2.4.7 Focus Visible | Supports | The active cell has an accent ring, shown when the keyboard brings focus to the grid, and a system `Highlight` outline under forced colors (`grid-a11y.spec.ts`). Before 2026-10-25 a grid reached by Tab showed no indicator, and forced colors removed the ring. A menu scrolls to the item the keyboard moves to, and a Gantt bar brought to focus by the keyboard shows its outline clear of the task table (`base-focus.spec.ts`, `base-gantt-a11y.spec.ts`). A board's add buttons had none until 2026-11-07, and a sweep of the panels, automations, trash, grouped view, form builder, dashboard, inbox, list and timeline found no other (`base-focus.spec.ts`). Under forced colors a menu item with focus has a `Highlight` outline; until 2026-11-09 Base's table menus and a summary's menu showed focus as a tint the theme removes (checked by emulation in Chrome and Edge, with the grid's row and column menus, the chart's Export menu and the calendar's event menu). |
| 2.4.11 Focus Not Obscured (Minimum) | Supports | Moving the active cell scrolls it into view below the sticky header and clear of the pinned columns on either side, and a header control reached by Tab stops clear of them too (`selection.test.ts`, `base-a11y.spec.ts`). A Gantt bar reached by the keyboard scrolls clear of the task table and the scale, and a menu keeps its focused item inside its scroll area (`base-gantt-a11y.spec.ts`, `base-focus.spec.ts`). A calendar event carried by the arrow keys scrolls the day, week or timeline view with it; until 2026-11-09 it went under the sticky header and out of view (`scheduler-clock-change.spec.ts`). |
| 2.5.7 Dragging Movements | Partially Supports | Range selection has Shift+click, the fill handle has double-click, column order has the tool panel buttons. Gaps: managed row dragging and column resize by pointer have no single-pointer alternative, and reordering attachments and checklist items has a keyboard path but no single-pointer one. |
| 2.5.8 Target Size (Minimum) | Partially Supports | axe's `target-size` rule passes in Chromium on the quick-start demo and over Base's views, at a phone's width too. Gaps, measured on 2026-11-07: the sheet's ribbon (Paste options 57 x 20.6 px, Format Painter 22 x 24 px, a group's launcher 14 x 14 px, on three demos; `sheet-a11y.spec.ts` leaves `wcag22aa` out) and a scheduler's "+N more" (50 x 17.3 px, one run). Base: a rating field's icons are 15 x 15 px at a 16 px pitch (from the code), so neither the 24 px size nor the spacing exception is met, and no other pointer control on the page sets a rating; they stay until the product owner rules on a larger control. Add table on a phone, 17 to 19 px wide until 2026-11-07, is 26 px, and a mail link in a record, 22.4 px tall, is 24 px. Plain grid: the selection checkbox (16 px), tree toggle (14 px) and resize handle (5 px) are under 24 px and pass on the spacing exception; a body-row checkbox's whole cell is also clickable. Base: the row checkbox, expand and column menu targets are 24 px. The custom scrollbars' 16 px arrows are out of the tab order and pass as the equivalent exception: the wheel, the thumb and the keyboard do the same. On a phone, by emulation, axe's `target-size` passes on cards, a board and a grouped list; a lane's 20 px add button passes on the spacing exception. |
| 3.1.2 Language of Parts | Not Applicable | Page-level. |
| 3.2.3 Consistent Navigation | Not Applicable | Page-level. |
| 3.2.4 Consistent Identification | Supports | Controls are named the same way across instances. |
| 3.3.3 Error Suggestion | Supports, with author responsibility | The string `validate` returns reaches the user verbatim. |
| 3.3.4 Error Prevention (Legal, Financial, Data) | Not Applicable | No such transaction originates in the grid. |
| 3.3.8 Accessible Authentication (Minimum) | Not Applicable | No authentication. |

## Enterprise components

Rows above describe `<SvGrid>`. The Enterprise components add their own
surfaces:

| Component | Status |
| --- | --- |
| `<SvSheet>` spreadsheet shell | axe in Chromium over 11 demos, light and dark; ribbon and sheet tabs use roving tabindex; dialogs take focus and return it (`tests/e2e/sheet-a11y.spec.ts`). |
| Export menu, import dialog | `role="menu"` with arrow keys and Escape; `role="dialog"` with focus moved in and restored. |
| Change review panel | Keyboard decisions (J / K, Enter, A, R), focus kept after a decision, axe-tested (`review/SvReviewPanel.dom.test.ts`). |
| SvGrid Base (`SvBase`) | Covered row by row above. axe, keyboard walks and the limits of that evidence are under *Evaluation methods* and *Known limits*. Not checked: no screen reader. |
| Gantt (`SvGridGantt`) | Bars are focusable, scroll clear of the task table, open their menu from the keyboard and announce moves; the task list is a `table`; bars keep their shape under forced colors. `gantt.text` translates its words. An arrow on a bar writes at once unless `pickUpToMove` is on, which Base sets. Gaps: dependency links and the progress grip by pointer only (see 2.1.1); each bar is a tab stop. |
| Grid board (`SvGridBoard`) | Cards and lanes move by keyboard with a polite live region: Space grabs, the arrows show where the card is going, Space or Enter drops it. Nothing is written until the drop, which is one write. Escape, Tab or a click elsewhere puts the card back with nothing written, and with Escape focus stays on it; on a board read from a server the card waits in its lane and the drop marker shows the way. `board.text` translates its words and announcements. |
| Scheduler (`SvGridScheduler`) | Space picks the focused event up, arrows carry it, Space or Enter puts it down, Escape cancels, each step announced. An all-day bar in Week or Day takes the same keys and has a name with its date, which it lacked until 2026-11-07; up and down move it a week. Past the edge of the view (in a month, the weeks it draws) the view goes with the event, and Escape brings both back with focus on it; while an event is in hand, keys on another event act on the one in hand; Tab or a click elsewhere cancels too. A month is a `table`. An event over several days names its first and its last day. On a day the clocks change (23 or 25 hours) Day and Week draw an event on the rows its times are labelled with, and a drop, a slot and a carry write the time of the row; until 2026-11-08 they were an hour off on such a day (`scheduler-clock-change.spec.ts`). A move by mouse or keys keeps the event's length by the clock; until 2026-11-09 a one-hour event carried onto the repeated 1 am read 1am - 1am. The Agenda shows the last day of an event over several days, which its text left out until 2026-11-09. `scheduler.text` translates its words. Gap: no keyboard resize of an event. |
| Kanban (`SvBoard`), pivot designer | Gap: cards between lanes, and pivot fields between wells, move by drag only. The pivot designer adds fields by keyboard. |

## Other gaps on record

Not tied to a single criterion, and on the list for remediation:

- A few accessible names are hard-coded English ("Fill handle", "Note", "Resize
  row", the scrollbars' arrows, a plain gallery's search box) instead of going
  through `localization.text`.
- RTL is tested in the browser on Base and the sheet, not on a plain grid.
- No screen-reader pass recorded (see *Known limits*).
- PDF exports are not tagged PDF (PDF/UA): the renderer, pdfmake, writes no
  structure tree, so a screen reader reads a PDF table as loose text. Exports
  to XLSX and HTML keep the table structure; offer one of those where an
  accessible document is required.

## Revised Section 508

Section 508 incorporates **WCAG 2.0 Level A and AA** by reference. Every WCAG
2.0 criterion appears in the tables above with the same verdict.

| Chapter | Conformance | Remarks |
| --- | --- | --- |
| 302 Functional Performance Criteria | Partially Supports | Operation without vision relies on the ARIA grid pattern (no recorded screen-reader pass); operation without fine motor control is limited by the drag-only actions under 2.1.1 and 2.5.7. |
| 501-504 Software | See WCAG tables | The grid is web content inside a host application and exposes the platform accessibility API through ARIA. |
| 602 Support Documentation | Supports | [Accessibility](../help/accessibility.md) documents roles, the keyboard map and how to verify a custom theme. |

## EN 301 549

EN 301 549 v3.2.1 incorporates **WCAG 2.1 Level A and AA** for web content
(clause 9) and software (clause 11). Its criteria are a subset of the WCAG 2.2
tables above and carry the same verdicts.

## Reproducing these results

```bash
pnpm --filter @svgrid/grid test:lib     # jsdom axe, contrast, ARIA contract, announcements
npx playwright test tests/e2e/grid-a11y.spec.ts tests/e2e/base-a11y.spec.ts tests/e2e/base-focus.spec.ts tests/e2e/base-keyboard-paths.spec.ts tests/e2e/base-gantt-a11y.spec.ts --project=chromium
```

Both run in CI on every commit, so a regression in a "Supports" row fails the
build.

## See also

- [Accessibility](../help/accessibility.md) - roles, keyboard map, how to verify a custom theme
- [Compliance overview](./index.md) - the other procurement questions
