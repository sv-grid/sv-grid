---
'@sv-grid/enterprise': patch
---

`=2^3^2` is 64 and `=-2^2` is 4, as they are in Excel

Two operator-binding rules were the way most languages have them rather than
the way Excel does. `^` bound to the right, so `=2^3^2` was 512 where Excel
gives 64, and unary minus bound looser than `^`, so `=-2^2` was -4 where
Excel gives 4. Both are now Excel's, checked against a real spreadsheet
rather than from memory: `^` associates to the left, and unary minus binds
tighter than it, with the postfix `%` tighter still (`=-2%` is -0.02).

A formula reading back out of the engine follows: `=A1^(B1^C1)` keeps its
brackets and `=(A1^B1)^C1` no longer needs them, which is what a fill, a
paste and a saved file all go through.
