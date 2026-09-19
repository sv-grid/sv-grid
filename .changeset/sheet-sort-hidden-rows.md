---
'@sv-grid/enterprise': patch
---

A sort no longer moves data through hidden rows

Sorting a block that spanned a filtered or hidden row treated it as one more
row of data: its contents were shuffled along with the rest, so a row the
filter had hidden could surface with someone else's values in it and the value
it held could vanish behind the filter. The sheet now sorts the rows on the
screen among the places on the screen and leaves a folded-away row exactly as
it was, which is what Excel does, and the status bar says how many stayed put.
