---
"@svgrid/enterprise": minor
---

Charts, pictures and sparklines now ride in the .xlsx, both ways. Save As
wrote the cells, the formats and the rules and left everything floating
over them behind; a file opened here did the same in reverse.

A sheet's objects go out as Excel's own drawing part: a picture's bytes in
`xl/media` with a one-cell anchor, a chart as a chart part of its own, with
the relationships and content types the package needs. A chart part carries
the REFERENCES its series read rather than a copy of the numbers, so Excel
redraws it from the cells beside it instead of from a snapshot that can
disagree with them. A file being opened gives its pictures and charts back
the same way, including a two-cell anchor from another producer, whose size
is measured across the cells it spans.

Sparklines go into the worksheet's extension list, which is where Excel
keeps them: one group per definition, one entry per cell, with the colours
and the shared scale, and they come back as the same groups.

The one thing left behind is a picture whose source is a URL rather than a
`data:` URL: its bytes are not in the document to write, and a file with a
broken image in it is worse than one without the image.
