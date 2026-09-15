---
"@svgrid/grid": minor
---

The fill handle continues an uneven run of numbers along its linear trend,
as Excel's AutoFill does: 1, 2, 4 fills 5.33, 6.83, 8.33 rather than
repeating the three. An even step is the same line, so 2, 4, 6 still
fills 8, 10, 12. `buildFillPattern` is exported, so a host can say what a
fill will write before it lands.
