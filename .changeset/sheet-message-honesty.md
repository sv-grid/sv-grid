---
"@svgrid/enterprise": patch
---

Three messages that described something other than what happened, found by
driving the shell in a browser:

- **Insert > Link told a filled-in address it was empty.** A target carrying
  a scheme the shell will not open is refused, which is right, but the
  dialog reported it with "Type an address", sending the user back to a
  field they had filled in. It now names the addresses a cell does open.
- **Clicking such a link said it "goes nowhere on this workbook".** That is
  the message for an address that cannot be found here; a `javascript:`
  target is not that. The two are said apart now.
- **Editing a table announced a new one.** The Create Table dialog is also
  how an existing table is edited, and picking a style from the gallery
  ended with "Orders covers A1:E13", which reports a table being made. An
  edit now names the look it wears.
