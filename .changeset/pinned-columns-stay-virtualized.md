---
"@svgrid/grid": minor
---

Pinned columns no longer switch column virtualization off. Pinned cells are
`position: sticky`, so they have to stay in the DOM, and the grid kept them
there by rendering one unbroken run of columns from the first column (a left
pin) to the last (a right pin): pinning both edges of a 1,000-column grid put
1,001 cells in every row. The grid now renders three runs, the pinned-left
columns, the virtual window and the pinned-right columns, with a spacer cell
for the columns between them, so the same grid renders about twenty cells
per row. Every row template (body, header, group header, filter row, footer,
sticky group and pinned rows) draws the spacer at the same place, a column
group or a merged cell that crosses a seam is split at it, and the column
menu now offers Pin / Unpin with column virtualization on. The
`validateGridConfig` warning that asked for `columnVirtualization={false}`
next to `initialColumnPinning` is removed.
