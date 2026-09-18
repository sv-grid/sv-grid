---
"@svgrid/enterprise": patch
---

Four defects a quality pass found, each with the test that would have
caught it:

- **A table pointed at a sheet that no longer had that name.** Renaming a
  sheet rewrote every formula and every defined name, but not the tables on
  it, so `=SUM(Orders[Amount])` read `#REF!` from the moment the sheet was
  renamed. The tables follow the rename now, and go when the sheet is
  deleted.
- **A copied sheet had no table of its own.** Copying a sheet that held one
  left the copy's `[@Qty]` formulas with nothing to resolve them, every one
  of them `#REF!`. The copy gets a table of its own under a free name, as
  Excel's Move or Copy does, and the name avoids the `T2` shape that reads
  as a cell reference.
- **A filled table header could not be read.** The header's text was white
  whatever the fill, which on the pale accents is about 2:1, and the fill
  lived in a layer behind the text so a contrast checker measured white on
  white. The colour now travels with the text, the readable one of black
  and white is chosen, and the one accent where neither clears the bar is
  darkened until white does.
- **Every ribbon group was a landmark.** A named `<section>` is a region,
  so one sheet published a dozen of them and two sheets on a page published
  duplicates. They are groups now, which is what they are.

Also fixed in the file: a chart's trendline was written after its
categories, and the schema orders a series the other way round, which Excel
reports as a file needing repair.
