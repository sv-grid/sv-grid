---
"@svgrid/enterprise": patch
---

The spreadsheet shell under a right-to-left layout, a finger and a screen
reader, with Playwright specs that hold it there. An anchored object now
hangs from its cell's inline start, so a chart on an `dir="rtl"` sheet
grows leftwards inside the sheet instead of out of it, and its grip and
drag follow. Both tab strips gained the tablist keyboard model they owed:
Home and End, arrows mirrored with the reading order, and focus following
the selection so a screen reader is not left on the old tab. The Name Box
carries the active cell's address as its value rather than as a
placeholder, selected on focus so typing still replaces it. The active
ribbon tab, the active sheet tab and the blue filtered row numbers are
mixed toward the text colour, which clears 4.5:1 under a host theme whose
accent or info colour is a light one.
