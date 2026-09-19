---
'@sv-grid/enterprise': patch
---

Excel's leading apostrophe now forces text

Typing `'007` showed `'007`, apostrophe and all, so the one way Excel gives
you to keep a leading zero, a part number that reads as a date, or the text of
a formula did not work. The prefix is now read as Excel reads it: what follows
is text whatever it looks like, and the apostrophe is not part of the value,
so it never reaches the display, the print sheet, a CSV export or a
comparison, while the formula bar still shows what was typed. The .xlsx writer
sends the text without it, and the reader gives a string cell the prefix back
when its text would otherwise read as a number, a boolean or a formula, so
`007` survives the round trip instead of returning as 7.
