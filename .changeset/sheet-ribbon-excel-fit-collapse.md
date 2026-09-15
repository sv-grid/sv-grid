---
"@svgrid/enterprise": minor
---

Spreadsheet ribbon: one icon style, Excel's two-step fit, and a collapsed state.

- The icon set is redrawn as one family: 16px outlines at one stroke, no
  filled slabs. Wrap Text, the decimal buttons, Headings, Unfreeze, the
  chart, the table, Remove Duplicates, Format Cells, Conditional
  Formatting and its Data Bars / Colour Scales / Icon Sets, and Data
  Validation are new drawings; Undo and Redo are open curved arrows.
- Undo and Redo moved into the Editing group as its first column of
  small icons, beside AutoSum; the Undo group of its own is gone. Small
  buttons are 22px squares around their 16px icon, Excel's size.
- Every group carries an icon of its own for the button it folds into.
  Font folded to a "grow" arrow and Number to a dollar sign because the
  fold borrowed the group's first item.
- The band fits its width in Excel's order: groups go compact from the
  right first (small buttons keep the icon, drop the label, the title
  stays in the tooltip), and only when every group is compact do groups
  fold, again from the right, into one large button each. The three
  widths of every group are measured off an invisible copy of the band,
  the collapse chevron is in the sum, and the folded button puts its
  label on the group-label row with the icon centred above it. The band
  used to fold four Home groups where two compact ones would have fitted,
  and the last group sat 18px past the edge.
- The ribbon collapses: double-click a tab, the chevron at the band's end
  or Ctrl+F1 leaves the tab row alone; a tab click then shows that tab's
  band over the sheet until a command runs, Escape or a click elsewhere,
  and the pin at its end or Ctrl+F1 brings the band back. `collapsed` is
  a bindable prop of `SvSheetRibbon`; the shell raises `toggle-ribbon`.
- Merge & Center greys out on a protected sheet, as the other formatting
  buttons do.
- The collapse chevron carried the class name `collapse`, which a host
  page's utility CSS reads as `visibility: collapse`; it has its own name.
