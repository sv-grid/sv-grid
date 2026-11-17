---
'@svgrid/grid': patch
---

Footer totals over windowed data (a server row model) read only the loaded
rows. They were computed by walking every entry, which built a row for each of
a million and held the page for over a second after every scroll. The totals
are the same, and the entries not loaded still count as records.
