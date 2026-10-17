---
"@svgrid/grid": patch
---

A cell editor registered with `registerCellEditor` could throw
"Cannot read properties of undefined (reading 'props')" when its edit ended.
When the edit commits, the grid clears the editing cell before the editor
unmounts; an editor that read one of its props in that moment (an input
firing `onChange` on the blur its commit causes, as `SvNumberInput` does)
made the grid look its registration up again from the cleared cell, and the
lookup came back empty. The grid now keeps the registration of the mounted
editor for its whole life.
