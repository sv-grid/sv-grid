---
"@svgrid/enterprise": patch
---

The server row model loads its first block when the grid first reports the
rows on screen. Its first load used to come from the grid reporting the
starting sort on mount; the grid no longer reports a mount as a sort change,
and a model nothing else touched - no sort, no filter, a pivot layout equal
to the one it was built with - then never sent a request: the server-side
pivot showed "No rows to display" and the 10M-row demo stayed on its loading
rows. Later viewports scroll the model as before.
