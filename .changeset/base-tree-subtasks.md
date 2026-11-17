---
"@svgrid/enterprise": minor
"@svgrid/grid": minor
---

Base tree views become a way to build a tree: Add subtask (row menu, and a "+" at the end of a row's name), Enter to type the next one and Escape to stop, Alt+Shift+Right and Left to indent and outdent, and a row dropped on another to nest it, never under its own subtask. A link to its own table gets a field back on request (`addSubtasks`, made when a tree view is kept), so counts and rollups add up a record's subtasks. A filter keeps a match under its greyed parents. Sync: a link written to a source whose server makes the keys names a record this page made by its stored key, and an answer's numeric ids are read back as the page's own. Grid: `treeData.keepAncestors` (context rows, `__treeContext`, not counted, left out of `getDisplayedRows`), `treeData.onAddChild` and `addChildLabel` (the "+"), a tree row takes a drop as a child whether or not it has children, and footer totals add up every record of a tree, folded or not.
