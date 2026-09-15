---
"@svgrid/grid": minor
---

Two clipboard hooks for the HTML flavour: `clipboardHtml` and
`onPasteClipboard`.

The grid wrote `text/plain` alone and read it back with `readText`, and
Ctrl+V took the key from the browser to do so, which meant the native
`paste` event, the one carrying a spreadsheet's `text/html`, never reached
the grid in a secure context. `clipboardHtml({ rects, text })` runs once per
copy and returns the HTML to put beside the text; the grid writes both
through the `copy` event so plain HTTP works too, and through
`navigator.clipboard.write` where the event is refused. With
`onPasteClipboard` set, Ctrl+V leaves the key to the browser, the `paste`
event hands the hook `{ text, html, source: 'event' }` as the source wrote
it, and an 80ms fallback reads both types from the async clipboard
(`source: 'async'`) where the event does not arrive. Return `true` once the
cells are written; anything else lets the grid paste the text as before. The
hook runs inside the paste's history group, so what it writes is one Ctrl+Z
with the grid's own writes. Neither hook changes anything when unset.

Also: `resizeColumnByUser` and `resizeRowByUser` report `onColumnResize` /
`onRowResize` on undo and redo as well as on the drag.
