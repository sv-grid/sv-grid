---
"@svgrid/enterprise": minor
"@svgrid/grid": patch
---

SvGrid Base grid:

- Right-click a record for its menu: Expand record, Comment, Insert record above or
  below (in its group), Duplicate record, Copy, Paste and Delete record. New
  records get their own id and the next autonumber and fire `onRowAdd`. An
  app's own `contextMenu` still wins. A card on a Kanban board has the same
  menu, with "Move to" a lane. Delete record asks first.
- A record with comments shows the count by its row number and on its card;
  a click opens the record with the comment box focused.
- The summary row and "+ Add row" share the column headers' ground
  (`--sg-summary-bg` sets another), with no column lines through the summary
  row. The primary field's summary cell shows the record count by default.
- "+ Add row" sits under the summary row, so the sums come right after the
  records.
- Group rows are drawn taller than records, with room between the field's
  name and its value. Kanban cards space their fields out more.
- Grid: a `footEnd` extension slot, drawn in the footer under the summary row;
  the sticky footer sits above pinned body cells, and while the selection bar
  is up it stays last, with the bar's strip below it (no rows show under it). Board: `commentCount` and
  `onCommentsOpen` for comments kept outside the row.
