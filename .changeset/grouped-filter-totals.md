---
"@svgrid/grid": minor
---

Grouping fixes for the advanced filter and the footer totals.

- An advanced filter over collapsed groups hid every group: it tested only the
  rows in the list, and a collapsed group has none there. A collapsed group
  is now tested through its own rows and stays, closed, when any of them
  match. A group with no match no longer stays because a group after it had
  one.
- The footer totals (`summary`) added up the group rows when the grid was
  grouped, so an expanded group counted twice and a column with its own
  `summary` showed nothing while the groups were closed. The footer now
  totals the records, with the advanced filter applied, whether the groups
  are open or closed.
- A column takes `sortValue`, the number to sort a value by in place of the
  value itself: a status option's position in its list, say, so "To do"
  comes before "Done". Grouped rows follow it too.
- `BoardLane` takes `hideWhenEmpty`.
