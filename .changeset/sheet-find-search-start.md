---
'@sv-grid/enterprise': patch
---

FIND and SEARCH now begin where you tell them to

Both advertised an optional `[start]` argument in the function list and then
ignored it, so `=FIND("a", "banana", 3)` answered 2 rather than 4 and the
usual walk to the next occurrence stood still. The position given is now
honoured, truncated as Excel truncates it, `#VALUE!` below 1 or past the end
of the text, and the position reported is still counted from the start of the
text.
