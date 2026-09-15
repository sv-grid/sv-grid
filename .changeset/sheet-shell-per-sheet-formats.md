---
"@svgrid/enterprise": minor
---

`SvSheet`: formats per sheet, a Name Box that jumps, `refresh()`, and `height="100%"`.

Four things a multi-sheet document needed from the shell.

**Formats are per sheet.** One format store served the whole workbook, so
bold on `Summary!C5` was bold on `Orders!C5` too, and a currency format on
one sheet's column turned another sheet's rank column into `$1.00`. The
shell now keeps a store per sheet and rebinds the ribbon and structural-edit
targets whenever the active sheet changes, whether by tab click, shortcut or
the Name Box. `formats` keys may carry a sheet: `'Orders!F2'` or
`"'Price list'!C2"`; a bare address formats the sheet active at mount. A
renamed sheet keeps its formats and a removed one drops them, through two
new `SvSheetTabs` callbacks, `onRename` and `onRemove`.

**The Name Box jumps.** `SvFormulaBar` always raised `onSelectName`; the
shell never listened, so picking a name did nothing. It now selects what the
name refers to, switching sheets first when it lives elsewhere, and the list
of names is read under the version counter so a name defined at runtime
shows up.

**`refresh()`.** Every edit made through the shell repaints it, including
`cmd.setCellValue` from an `onAction` handler. A write the shell cannot see
- a Name Manager redefining a name, a solver applying with `wb.setRaw`, an
import replacing a sheet - did not, and the cells kept showing the values
from before. `bind:this={sheet}` and `sheet.refresh()` after such a write.

**`height="100%"`.** The chrome around the grid is about 290px tall, so a
fixed grid height was a fixed component height with that added on, and in
the demo gallery the tab strip ended up under the section below. With
`'100%'` the shell is a flex item that fills its column and the grid takes
whatever the chrome leaves.

**The ribbon is Excel's ribbon.** Rebuilt on Excel's geometry: three rows
of 24px per group, large buttons (icon over label) beside stacks of small
ones, an Undo group, Excel's names, dialog-box launchers in the group
corners, and a hand-drawn monochrome line-icon set (`sheet/ribbon-icons.ts`)
in `currentColor`, black or white with the theme. Fill Colour, Font Colour and Borders
are split buttons with Excel's colour picker (theme row, five tints and
shades each, standard colours) and Excel's borders menu, applied to the
selection the way Excel applies them. Font, size and number format combos
show the active cell's value. Paste pastes (`cmd.paste()`). Every format
change goes through the grid's undo history (`cmd.recordUndo`), so Ctrl+Z
and the Undo button work on Bold, a fill, a border. The ribbon folds groups
from the right into dropdown buttons when the band is too narrow, and
unfolds them again, as Excel's does.

**The rest of the shell matches.** `look="excel"` (the default) sets
Excel's light or dark palette on the shell's tokens; `look="theme"` keeps
the host's. The formula bar has Excel's Name Box with its arrow, Cancel /
Enter while editing and fx. Column headers are 22px and centred, rows 22px
(`rowHeight`), numbers right-aligned by General alignment, row numbers
centred, hairlines between every column letter and every row number and
around the Select All corner, the headers the selection touches shaded a
step darker with a 2px accent line on the edge facing the cells, no hover
wash on cells. The selection rectangle is Excel's: the range tinted and
framed in 2px accent, the active cell inside it left unshaded with no ring of
its own, and the fill handle a small square on the bottom-right corner. Sheet tabs carry scroll arrows, a round New Sheet button and
a right-click menu (Insert, Delete, Rename, Move); the delete button is gone
from the tab face. The status bar reads Ready on the left and Average /
Count / Sum on the right.

**The sheet answers the pointer as Excel's does.** A column letter selects
the column, a row number the row, the corner the sheet, Shift+click extends,
and headers shade under the pointer. Rows resize from the gutter edge. A
right-click on a cell opens Excel's menu (Cut, Copy, Paste, Paste Special,
Insert / Delete Rows and Columns, Clear Contents, Clear Formats, Format
Cells). The in-cell editor opens with the caret after the text rather than
selecting it, and widens over the cells to its right as a long formula is
typed. While a formula is being written, in the cell or the formula bar, the
cells it refers to are outlined in their own colours - Excel's range finder.

**Structural edits are one undo, and formats move with their cells.**
Inserting or deleting rows and columns used to leave the formula rewrites in
the history on their own, so Ctrl+Z after an insert would revert the
formulas and leave the rows; and the shell's positional format store kept a
band on row 5 while the cells that carried it moved to row 6. The structure
target can now snapshot and restore the workbook (`StructureTarget.snapshot`
/ `restore`), the edit records one undo step over it, and the shell remaps
its format stores on every insert and delete (`SheetFormatStore.remapRows`
/ `remapColumns`). The ribbon's Insert and Delete act on the row when a
plain cell is selected, as Excel's do, instead of declining.

**A QA pass over all of it fixed four more.** A fill stopped 12px short
of the cell's left edge and a hairline short top and bottom, because the
grid pads a left-aligned td and a block child only rises to its line
height; the cell now owns the td's whole box, and the selection frame and
range-finder colours are painted as overlays above the content, so they
show over filled cells and darken the fill a shade as Excel's do. One
inserted row turned `=SUM(A1:A3)` into `=SUM(A1:A5)` and a cycle,
because the structure command rewrote the sheet's references and the
workbook then rewrote every sheet again (`StructureTarget.rewritesReferences`
tells the command to leave them to the workbook). Accepting a function from
the formula bar's autocomplete inserted `SUM()` with the caret inside, so
typing the arguments ended in `))` and `#PARSE!`; it inserts `SUM(` as
Excel does, and a formula entered with parentheses left open is closed on
entry (`balanceParens`), as Excel closes it. Right-clicking a cell outside
the selection now selects it first, so the menu acts on the cell under the
pointer. The range finder reads lowercase and `$`-anchored references.

**A second, deeper pass fixed five more.** Inserting a column on Summary
shifted `NetSales = Orders!$I$2:$I$25` along with it, so every SUMIF on
the summary read $0: the workbook rewrote every defined name and every
qualified reference for an edit on any sheet. A reference now moves only
when it points INTO the edited sheet (`fixupReferences` takes the edit's
sheet and the formula's own), so a name on Orders and a `=Orders!B2` on
Summary hold still while `=B2` on Summary moves. Typing in the formula bar
and clicking another cell to finish put the text into the cell just
clicked, because the grid had moved the active cell before the bar's blur
landed; the bar now commits into the cell the edit started in, and the
write goes through the grid's command context, so Ctrl+Z takes it back
like any other edit. An address typed into the Name Box moved the label
and nothing else; it moves the cursor and hands focus back to the sheet,
and a defined name picked from its list does the same, so the next
keystroke edits the cell it landed on. On a phone the ribbon's band,
narrower than its seven folded groups, hid Cells and Editing behind an
overflow; it scrolls sideways. And Enter after an in-cell edit stayed on
the cell; it moves down now, in the grid itself.

**The clipboard is Excel's.** Ctrl+V did nothing in the shell: the grid's
paste wrote into its own row copies, which the sheet's cells never read,
and told nobody. Copy now puts the text each cell shows on the system
clipboard (a formula cell copies its value, as Excel's does for another
application) and keeps the formulas and formats for a paste back into the
sheet, where the formula moves by the distance it travelled: `=A1*2`
copied from B1 to B3 reads `=A3*2`. A cut block is moved as it was. Text
from elsewhere is pasted as it is. One paste is one Ctrl+Z, formats
included.

**Four dialogs of the shell's own.** Ctrl+1, Ctrl+H, Ctrl+Shift+V, the
launchers in the corner of the ribbon groups, the cell menu's Paste
Special... and Format Cells... and the formula bar's fx all raised an
action and did nothing unless the application had written a dialog for
it; none of the demos had. The shell now carries Find and Replace (Find
Next / Find All / Replace / Replace All, match case, whole cell, values or
formulas; Replace All is one undo), Paste Special (All / Formulas / Values
/ Formats, the four operations, Skip blanks, Transpose), Format Cells
(Number with a live sample, Alignment, Font, Border presets, Fill; opens
on the active cell's format and applies only what changed to the whole
selection, as one undo) and Insert Function (search, category, signature
and description; OK starts the cell on `=NAME(`). `onAction` still fires
first for every one of them; a handler that returns `true` keeps the
shell's dialog closed, so an application can put its own in place.
Exported as `SvSheetFindReplace`, `SvSheetPasteSpecial`,
`SvSheetFormatCells` and `SvSheetInsertFunction`, with
`functionCatalog()` behind the last.

**Sheet renames follow through.** Renaming Orders to Q3 Sales left every
`=Orders!B2` on the other sheets and every name defined on it reading
`#REF!`. `renameSheet` rewrites them through the parser, so a string
literal that happens to say Orders is left alone and the new name comes
out quoted when it needs to be. A replacement from Find and Replace goes
through the grid too, so it is in the history.

**A click on the active cell is a click.** The grid opens an editor when
the cell that is already active is clicked again, and the sheet inherited
that: clicking the cell you are on to get back to it after a dialog put
the next Ctrl+B into an editor. The sheet turns that off
(`editOnSecondClick={false}`); Excel edits on double-click or F2.

**Entries are read the way Excel reads them.** A typed `12%` was the
text "12%", left-aligned, and `#VALUE!` in any formula over it. It is the
number 0.12 now, shown as a percentage; `$1,200` is 1200 shown as
currency, `1,234.5` keeps its separator. The entry names a value and a
format (`parseEntry`), the cell takes both unless it already has a number
format, and the two undo together.

**Alt+Enter and F4.** Alt+Enter committed the cell. It is a line break
now: the cell's editor is the grid's multiline text editor, the cell turns
on Wrap Text as it lands, wrapped text keeps its breaks (`pre-wrap`, not
`normal`), and the row grows to show every line, after Alt+Enter and after
Wrap Text on the ribbon or in Format Cells alike. F4 while editing, in the
cell or in the formula bar, turns the reference at the caret through
`$A$1`, `A$1`, `$A1` and back, both ends of a range together
(`cycleReference`). Ctrl+End goes to the last used cell rather than the
grid's last row. The formula bar follows an in-cell edit as it is typed, and
the cell follows the bar.

**The formula bar keeps line breaks.** The bar was an `<input>`, and an
input strips line breaks: a cell showing "alpha" over "beta" read
"alphabeta" in the bar, and any edit there committed the two lines as one.
The bar is a textarea now, with Excel's chevron at its end: one line until
the chevron expands it, then every line up to six, and Alt+Enter typed in
the bar breaks the line and expands it. The bar never grows on its own for
the active cell: a bar that grew for a two-line cell and shrank on the next
click moved the sheet under the pointer mid-click, and the click landed a
row below where it was pressed.

**The anchor is the active cell.** Ctrl+Shift+Arrow stepped from the
active cell, which the grid had moved to the range's far corner, so it
reached the same edge on every press; it now grows from the far corner
(`selectionFocus`) and leaves the active cell at the anchor. The anchor
inside a range was tinted like the rest of the range: the tint rule
outranked the active cell's on specificity. It is white now, as in Excel.

**Hide and Unhide.** On the column letter and row number menus and on
Ctrl+9, Ctrl+0, Ctrl+Shift+9 and Ctrl+Shift+0, raised as `hide-rows`,
`hide-columns`, `unhide-rows` and `unhide-columns` so an application can
take them over. A hidden line is the grid's collapsed column or row: it
keeps its letter or number and every reference to it, and takes no room.
Unhide reveals what the selection spans, or the hidden lines next to it
when it spans none, so a right-click on C with B hidden gets B back. The
cursor on a line just hidden steps to the next one that shows, and a
Ctrl+Arrow whose edge is hidden lands on the last cell of the run that
shows, or on the first of the next run, never on the hidden cell. A hide is
one Ctrl+Z, belongs to its sheet, moves with an insert or delete and comes
back when that is undone. Column widths now move with their columns on an
insert or delete too: they used to stay with the letter, so an insert
before a widened C left the width on the new column and C at the default;
and the structural undo restores widths and hidden lines along with the
heights.

**AutoComplete.** A cell typed into offers the text entries of its column's
run, as Excel does: when what was typed fits exactly one of them, the rest
of the entry appears selected in the cell; typing on overwrites it,
Backspace takes it away, Enter or Tab accepts it in the entry's own case.
Numbers, formulas and booleans are never offered, an ambiguous prefix
offers nothing, and a blank row ends the run. `completeEntry` is the rule,
exported.

**The range finder draws ranges, and colours the text.** A referenced
range was outlined cell by cell, a box around each of B5, B6, B7 and B8
where Excel draws one box around B5:B8; and the reference in the formula's
text, which the code promised to colour, stayed black, since an input
cannot colour a run of its text. Each range is one rectangle now, each cell
carrying only the edges it sits on, and the text is coloured in the cell
editor and in the formula bar through a mirror of the text laid over the
field with the references in colour, the field's own text transparent
under it and the caret still the browser's. `referenceSpans` is the rule,
exported, and the bar takes it as `highlight`.

**Ctrl+Shift+" copies the value from above.** Ctrl+' copied the text of
the cell above, formula and all, and there was no way to take the number a
formula shows. Ctrl+Shift+" writes what the cell above shows, through the
attached engine (`copyValueFromAbove`); without one it is the text, and an
error above copies nothing.

**Ctrl+Shift+& and Ctrl+Shift+_.** Excel's outline-border and remove-borders
keys, on the Borders menu's own `applyBorders`, which moved into the
shortcut layer (the ribbon re-exports it) so a key can reach it without
the ribbon importing itself.

**The Clipboard group is Excel's.** Cut, Copy and a new Format Painter
stand beside the large Paste as icons alone, the way Excel draws them, and
Paste is a split button: the icon pastes and "Paste" with its chevron
opens Paste, Formulas, Values, Formatting, Transpose and Paste Special...,
each raised as an action (`paste-formulas`, `paste-values`,
`paste-formats`, `paste-transpose`) that the shell answers through its
Paste Special engine. The ribbon's `dropdown` kind took a `split` form for
it. Format Painter picks up the selection's formats, shows the brush, and
the next click or drag takes them as one undo: a single cell takes the
whole block from that corner, a range has it tiled, a cell whose source had
no format loses its own. Enter paints onto the current selection; Escape,
or the button again, puts the brush down. Raised as `format-painter`.

**Home > Cells > Format is Excel's menu.** The Format button opened Format
Cells and nothing else. It is Excel's dropdown now, with its section labels:
Cell Size (Row Height..., AutoFit Row Height, Column Width..., AutoFit
Column Width, the last two one undo each), Visibility (Hide and Unhide
rows and columns, with their keys) and Format Cells... at the end. The
ribbon grew a `dropdown` item kind for it: the face opens the list and every
entry raises its own action (`row-height`, `autofit-rows`, `column-width`,
`autofit-columns` join the action ids). The ribbon's fit test also counted
two pixels of band padding that are not there and folded a group that
would have fit.

**Row heights are the sheet's.** A row dragged taller snapped back on the
next keystroke: the grid kept dragged heights by index and cleared them on
every data change, and every edit changes the sheet's data. The grid keys
them by row now, and the shell keeps a set per sheet, moves them with their
rows through an insert or delete, and puts them in the structural undo. The
fill handle's drag is one Ctrl+Z, as Ctrl+D already was.

**Column letters and row numbers have menus.** Right-clicking either did
nothing. It selects the column or row (unless it is already inside the
selection) and opens the cell menu for it, with Insert and Delete for that
axis only and Column Width... or Row Height... at the bottom, each a small
box that sizes every column or row the selection spans. The ribbon's Number
Format combo reads "Percentage" for any percent pattern, not only the
preset's, so a typed 12% shows its category (`formatCategory`).

**The last few Excel habits.** A number too wide for its column reads as
a run of # signs rather than a truncated figure, and reads as itself once
the column fits it. `true` and `FALSE` typed into a cell are booleans:
centred, upper case, and TRUE to `IF`. Ctrl+Shift+End extends the
selection to the last used cell and Ctrl+Shift+Home to A1. The fill handle
moves both references of `=A1+B1` when dragged, fills down to the end of
the neighbouring column on a double-click, and undoes as one step.

**The Data and Formulas tabs work everywhere.** Sort A to Z, Sort Z to A,
Goal Seek, Text to Columns, Remove Duplicates and the Name Manager raised
an action and did nothing unless the application had a dialog for it,
which one demo each did. The shell carries all of them now: Sort orders the
current region (or the selection) by the active cell's column, numbers
before text and blanks last, a header row of text over numbers left in
place, values and formats moving together as one undo; the four dialogs
are the ones the demos had, exported as `SvSheetNameManager`,
`SvSheetGoalSeek`, `SvSheetTextToColumns` and `SvSheetRemoveDuplicates`,
and what they did is said in the status bar's Ready slot for a few
seconds, as Excel's message boxes say it. `onAction` still hears every
action first and `true` takes one over; the three demos do that, as the
worked examples of a replacement. Insert > Table and Insert > Chart have
nothing behind them in the library, so they are left off the ribbon, group
and all, unless `extras={['insert-table', 'insert-chart']}` says the
application answers them (`SvSheetRibbon` takes `without`). A ribbon
button that raises an action hands focus back to the sheet like the rest,
so a dialog it opens returns focus to the sheet, and Ctrl+Z after Sort is
not a press on the Sort button.

**Freeze Panes freezes rows too.** Freeze at B5 pinned column A and
left rows 1-4 scrolling away: the grid could only pin read-only copies of
rows, and the shell would not pretend. The grid freezes its own rows now
(`frozenRows`), `applyFreeze` sets both halves through the api, and the
shell keeps the panes per sheet, back with the sheet and gone with
Unfreeze. Freeze and Unfreeze are raised as actions (`freeze-panes`,
`unfreeze-panes`) an application can take over.

**The tooltips tell the truth.** The ribbon's tooltips promised F9,
Ctrl+`, Ctrl+Shift+L, Shift+F3, Ctrl+F3, Ctrl+T and Ctrl+Shift+> / <, and
none of them was bound. All are now: the first six raise the action their
button raises (`setRibbonActionHandler` on a plain grid; the shell answers
them itself, Ctrl+T only with Insert > Table in `extras`), the last two are
the font-size ladder (`nudgeFontSize`, moved to the shortcut layer).

**Text spills.** A title in A1 used to end in an ellipsis at the cell edge.
Text now runs over empty neighbours and is clipped by the first cell that
holds something, as in Excel; numbers, filled cells and right- or
centre-aligned cells stay inside their own.

Also: the ribbon hands focus back to the grid after each action it runs
itself, so the keystroke after a click on Bold reaches the sheet rather than
re-pressing Bold.
