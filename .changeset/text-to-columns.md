---
"@svgrid/enterprise": minor
---

Add Text to Columns and Remove Duplicates.

Both are pure functions rather than commands, because they get run from a
button, a menu, a paste handler or a test, and none of those want a keystroke.

`splitText` is a scan rather than a `String.split`: a quoted field may contain
the delimiter and a doubled quote is an escaped one, and splitting first then
repairing is how CSV parsers get subtly wrong. It takes several delimiters
(longest first, so `", "` wins over `","`), collapses runs for
space-separated text, trims, and takes a field limit.

`textToColumns` pads every row out to the widest. Writing a ragged result into
a grid leaves whatever was already in the cell, so a row that split into two
fields would keep stale text in the third column.

`guessDelimiter` scores a candidate on appearing in most rows **and** the same
number of times in each, so a comma inside one field does not beat the tab
that actually separates the columns.

`findDuplicates` reports which rows to keep and which duplicate another rather
than removing them, so the caller decides what removal means for its data
structure and a UI can say "3 duplicates found" first. Comparison is
case-insensitive by default, matching Excel: that surprises people, which is
exactly why it matches rather than being tidier. `removeDuplicates` is the
wrapper that applies it.
