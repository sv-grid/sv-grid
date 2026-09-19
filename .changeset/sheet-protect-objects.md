---
"@svgrid/enterprise": patch
---

A protected sheet kept its cells and lost its sparklines.

Protection was checked by each command that writes, and three paths were
missing it: Insert > Delete on a selected chart or picture, the chart Setup
dialog (whose OK writes the chart back and whose Delete removes it), and
the sparkline Edit dialog, which opened on a protected sheet and whose
Delete took the group away. The cells refused, the drawing over them did
not.

The refusal now sits on the write itself, `putObjects` and `putSparklines`,
so the ribbon, a dialog, the keyboard and a drag all mean the same thing;
the dialogs that would write also stay shut. `clearSparklines`,
`insertChart`, `insertPicture` and the drag handles were already guarded,
which is what made these three read as oversights rather than a decision.
