---
"@svgrid/grid": patch
---

Mounting is cheaper per body cell. A cell read its editing, row-editing,
selection and fill-drag state through four `{@const}`s, which made four
derived values per cell on every mount; it now reads them through one,
which is `null` for a cell in none of those states. The cell's hover
handling (drag-select across cells, the column and validation tooltips)
uses `pointerover`/`pointerout`, which Svelte delegates to one listener,
instead of `pointerenter`/`pointerleave`, which added two listeners to every
cell. Measured on a 100k-row mount (25 rows x 9 columns), the two took
about 5 ms off a mount task of about 32 ms.
