---
"@svgrid/enterprise": minor
---

The table styles gallery. A table's look was the theme's accent and nothing
else; it is now one of eighteen presets, six colours in three tones, under
the names Excel stores them by (`TableStyleMedium2`), plus None for cells
that keep exactly the formats they carry.

The style lives on the table as `style`, so it rides in `getState()` with
the rest of the region and goes into the .xlsx as `tableStyleInfo`, both
ways: a table saved here opens in Excel wearing the same style, and one
opened from a file keeps the style it arrived with. The look is still drawn
rather than written into the cells, so a row typed under the last one
arrives already banded and converting back to a range leaves nothing to
clean up.

The gallery is in the Create Table dialog, and Insert > Table Styles opens
that dialog on the table the cursor is in. `TABLE_STYLES`,
`tableStyleColours`, `findTableStyle` and `DEFAULT_TABLE_STYLE` are
exported for an application that wants to show the presets its own way.
