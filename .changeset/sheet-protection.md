---
"@svgrid/enterprise": minor
---

Sheet protection: Format Cells > Protection, Format > Lock Cell, and Review
> Protect Sheet / Unprotect Sheet.

Excel's model: every cell is locked to begin with, the ones that may change
are unlocked, and protecting the sheet turns the flags on. A locked cell on
a protected sheet refuses to change wherever the change comes from (typing,
F2, Delete, the formula bar, paste, a fill, Find and Replace, a sort, the
formats), the formatting buttons grey out while the selection holds one,
Insert, Delete, Row Height, Column Width, AutoFit, Hide and Unhide are off
for the whole sheet and the resize handles go away; the refusal is Excel's
sentence in the status bar. Unlocked cells take every edit as before.
Protect and Unprotect are one undo each; the flag rides in `getState()` as
`protected` and the unlocked cells as `locked: false`; `onChange` reports
`protection`. No password. `CellFormatEntry.locked`, `isLocked`,
`rectsHaveLocked` and `rectsMixLocked` from `@svgrid/enterprise/sheet`;
`SheetFormatTarget.guard`/`refused`, `StructureTarget.canApply`/`refused`
for a shell of your own; the fills, stamps and AutoSum ask `cmd.canEdit`.
The ribbon has a Review tab; a dropdown entry can be a `toggle`.
