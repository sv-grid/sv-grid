---
"@svgrid/grid": patch
---

The `<SvGrid>` base bundle is back under 100 KB gzip (102.7 -> 97.1 KB),
with no API change. Four parts now load the first time a grid needs them:

- the column menu's actions, the right-click menu's items and the comment
  editor load with the menu overlay on the first menu open;
- the footer loads when the grid paginates or shows a status bar;
- conditional formatting loads with the first `conditionalFormats`;
- sparkline drawing loads with the first sparkline column.

A paginated grid draws its pager, and a formatted grid its formats, one
module load after mount (a frame on a warm cache). Tests that read the
pager or a format straight after mounting should wait for it, for example
with `vi.waitFor`.
