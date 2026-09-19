---
"@svgrid/enterprise": patch
---

Five more Excel format rules, on the date and time side:

- **A pattern naming the meridiem puts the hour on a 12-hour clock.**
  `h:mm AM/PM` over three in the afternoon read `15:00 PM`; it reads
  `3:00 PM`, as a clock face does. A pattern without one stays on the
  24-hour clock. (The test suite had this one written down the wrong way
  round, asserting `15:05 PM`.)
- **`A/P` prints the letter**, `a/p` the lower-case one, and `am/pm` the
  lower-case pair: Excel prints what the token spells, and all four used to
  come out as `AM` or `PM`.
- **`mmmmm` is the month's first letter**, not `mmmm` followed by a stray
  month number: `September9` is now `S`.
- **Times round to the finest unit the pattern shows.** 23:59:40 under
  `hh:mm` reads `00:00` with the date rolled over, as Excel does, rather
  than truncating to `23:59`. A date-only pattern still truncates.
- **Fractional seconds** (`ss.0`, `ss.00`, `ss.000`) show the milliseconds
  rather than printing the zeros as literal text.

And on the number side, the integer placeholders of a scientific pattern set
the step its exponent moves in, so `##0.0E+0` is engineering notation:
12345 reads `12.3E+3` where it used to read `1.2E+4`, and `0.00E+00` is
unchanged.
