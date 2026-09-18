---
"@svgrid/enterprise": minor
---

Two leftovers from the spreadsheet work, both noted in the docs as not done.

**Sort on a colour.** A level of the Sort dialog now chooses what it reads:
the value, the cell colour or the font colour. The colour list offers the
ones that column actually carries, and the colour picked goes On Top or On
Bottom while every other row keeps the order it had. That is Excel's model
rather than a shortcut: two colours are not greater or lesser than one
another, so there is no order to sort them by. A conditional format's
colour counts, since sorting by a colour you can see is the point.
`sortOrder` takes the colour reader as a fourth argument, and a level
without one sorts nothing rather than guessing.

**NUMBERVALUE.** `NUMBERVALUE(text, [decimal], [group])` reads a number
written the way another country writes one, with the separators given
rather than guessed, trailing percent signs dividing by a hundred each, and
empty text reading as zero.
