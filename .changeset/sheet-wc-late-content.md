---
"@svgrid/enterprise": patch
---

`<sv-sheet>` ignored the content a plain page gives it.

A custom element is upgraded the moment its definition loads, which is
before the script that assigns its properties runs. The shell had therefore
mounted on an empty sheet by the time `sheet.data = [...]` arrived, and the
component reads its document once on purpose, so the assignment showed
nothing: the element's own quick start left an empty Sheet1 on the page.

Two things were wrong. The shell now remounts on content that arrives after
it is on the page, and `ready` no longer feeds the element its own answer:
it parks the document on the host, `document` is one of the element's
props, so what came back read as content the host had supplied and pinned
the element to it for good. The parked document is marked and told apart.

A remount happens only while nothing has been done to the sheet. Once a
cell has been written, a later `data`, `workbook` or `document` is ignored
rather than throwing the work away, which is what a React render passing a
fresh array does on every parent update. `setState` and `newWorkbook` load
content over a sheet that has been edited, as before.
