# The spreadsheet shell

Everything between the ribbon and the sheet tabs, as one component.

```svelte
<script>
  import { SvSheet, createWorkbook } from '@svgrid/enterprise'

  const wb = createWorkbook([
    { name: 'Budget', cells: [['Line', 'Jan'], ['Rent', '2400']] },
  ])
</script>

<SvSheet workbook={wb} />
```

<div data-docs-demo="27-spreadsheet-ribbon" data-height="640"></div>

That is the whole required API. `<SvSheet />` with no props at all opens an
empty single-sheet workbook, which is what "open a spreadsheet" means.

## What you get

| Part | Comes from |
| --- | --- |
| Ribbon: Home, Insert, Formulas, Data | `SvSheetRibbon` |
| Name Box and fx bar, showing the RAW text of the active cell | `SvFormulaBar` |
| A..Z headers over the built-in 1..N row gutter | `SvGrid` |
| Sheet tabs: switch, rename, reorder, add | `SvSheetTabs` |
| Sum / Average / Count of the selection | the shell |
| Every Excel shortcut | `enableSheet()` |

This is composition, not a second grid. All of it already existed and was
being re-assembled by hand in four separate demos. What the component adds is
the wiring BETWEEN the parts, done once:

- The formula bar shows the raw text while the grid shows the computed value.
  Editing in the bar edits the formula, not its result.
- The format store is keyed by row id, so sorting cannot strand formatting on
  whatever row took that index.
- Insert and delete go through the workbook, so references are rewritten on
  every sheet rather than only the active one.
- The fill handle translates references, so `=B2` filled down becomes `=B3`.
- The tab strip is told when a shortcut moved the active sheet, so
  `Ctrl+PageUp` and the tabs cannot disagree.
- AutoSum measures its run against evaluated values, so a column of subtotals
  counts as numbers rather than as `"=SUM(...)"` strings.

## The ribbon and the keyboard are the same thing

Click a bold cell and the Bold button lights up. Press `Ctrl+B` and it goes
out. Neither is reacting to the other: both call one function in
`sheet/shortcuts.ts`, and the button's pressed state is read from the format
store rather than tracked separately.

That is why `sheet/ribbon.ts` is a table of data rather than markup. An item
either carries a `run` that calls a real action, or an `emits` naming
something the ribbon cannot do alone:

```ts
{ id: 'bold', label: 'B', title: 'Bold', keys: 'Ctrl+B',
  kind: 'toggle',
  run: (cmd) => toggleFormat(cmd, 'bold'),
  isOn: (cmd) => everyCellHas(cmd, (e) => e?.bold === true) }
```

Buttons that need chrome the library does not ship - a function picker, a
Goal Seek dialog, Text to Columns options - set `emits` and arrive at your
`onAction` handler instead:

```svelte
<SvSheet
  {wb}
  onAction={(action, cmd) => {
    if (action === 'goal-seek') openMyGoalSeekDialog(cmd)
  }}
/>
```

`recalculate`, `toggle-formulas` (Excel's `Ctrl+` `` ` ``) and `toggle-filter`
are handled by the shell itself and never reach `onAction`.

## Props

| Prop | Default | What it does |
| --- | --- | --- |
| `workbook` | a new empty one | The document to edit. |
| `data` | | Seed sheets, when not supplying a workbook. |
| `rows` / `columns` | 50 / 12 | Minimum size, so a sparse sheet still looks like a sheet. |
| `height` | 420 | Grid viewport height. |
| `columnWidth` | 104 | Default column width. |
| `columnWidths` | | Per-column overrides keyed by letter: `{ A: 150 }`. |
| `formats` | | Cell formats keyed by A1 address: `{ B2: { bold: true } }`. |
| `showRibbon` / `showFormulaBar` / `showTabs` / `showStatusBar` | `true` | Hide any part of the chrome. |
| `onAction` | | Ribbon actions the shell does not handle itself. |
| `onReady` | | The `SvGridApi`, once the grid has mounted. |

`formats` matters more than it looks: without it a sheet can only be
formatted by hand after it loads, which makes it impossible to ship a
document that opens the way it was saved.

```svelte
<SvSheet
  workbook={wb}
  columnWidths={{ A: 150 }}
  formats={{
    A1: { bold: true, fill: '#e2e8f0', color: '#0f172a' },
    E2: { numFmt: '#,##0' },
    B13: { numFmt: '0.0%' },
  }}
/>
```

## Theming

The chrome is painted with the grid's own `--sg-*` tokens, not Excel's
palette. It reads as Excel through layout - labelled ribbon groups, the fx
bar, the row gutter, the tab strip - and still matches whatever theme the app
runs. Pick the `excel` theme preset to have it wear Excel's colours as well.

Hard-coding Microsoft's greens would have made it the one component in the
library that ignores the theme, and it would have clashed inside every app
that has a design system of its own.

## Using the parts separately

`SvSheet` is a composition of exported components, so anything it does you
can do by hand when you want a different arrangement:

```svelte
<SvSheetRibbon cmd={() => api?.getCommandContext() ?? null} onChange={refresh} />
<SvFormulaBar {active} value={raw} onCommit={commit} />
<SvGrid ... />
<SvSheetTabs workbook={wb} {version} onChange={refresh} />
```

`api.getCommandContext()` is the seam that makes this work. A keyboard
command is handed a context on every keystroke; a ribbon button has no
keystroke to ride in on, and without it every action would have to be
re-implemented against the public api and kept in step by hand.

## What it does not do

- **No Page Layout or Review tab.** Print setup, comments and track-changes
  have nothing behind them in the grid, and a tab of disabled buttons is
  worse than no tab.
- **No Format Cells dialog.** `Ctrl+1` and the ribbon button both emit
  `format-cells`; what that dialog should look like is a design decision, not
  a spreadsheet one.
- **Row freeze is partial.** Columns freeze properly through pinning; the
  row half is documented in
  [missing features](../missing-features.md).

## See also

- [Excel keyboard shortcuts](./keyboard-shortcuts.md)
- [Formulas](../spreadsheet-formulas.md)
- [Number formats](./number-formats.md)
- [Workbooks](./workbooks.md)
