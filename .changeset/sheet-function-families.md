---
"@svgrid/enterprise": minor
---

Four function families the spreadsheet had none of: trigonometry, engineering,
database and the statistical distributions. The engine carries 348 functions
now, up from 194.

Trigonometry is the circular, inverse and hyperbolic sets with `DEGREES`,
`RADIANS` and `SQRTPI`. `ATAN2` takes its arguments x first, as Excel does and
as no C-family `atan2` does, and a reciprocal at a pole is `#DIV/0!` rather
than infinity.

Engineering is the base conversions (a negative written as ten-digit two's
complement, `places` ignored where the complement already fills the width),
the bitwise set over BigInt so it works past 2^32, `DELTA`, `GESTEP`, the
error integrals and `CONVERT` with the SI prefixes and Excel's affine
temperature scales.

Database is the twelve `D*` aggregates over Excel's criteria-block grammar:
conditions across a row are ANDed, rows are ORed, a blank cell is no
condition, and `DGET` refuses anything but exactly one match.

The distributions are normal, Student t, chi-squared, F, binomial, negative
binomial, Poisson, hypergeometric, exponential, lognormal, gamma, beta and
Weibull, with their inverses, the confidence intervals, the four hypothesis
tests and the descriptive measures (`SKEW`, `KURT`, `TRIMMEAN`, the `*A`
family, covariance, `PEARSON`, `RSQ`, `STEYX`, `PROB`). Excel renamed this
whole family in 2010 and kept the old names working, so both spellings are
registered and the places they disagree are the ones this documents:
`CHIDIST` is the right tail where `CHISQ.DIST` is the left, `TDIST` takes a
tail count where `T.DIST` takes a flag, and `TINV` is two-tailed where `T.INV`
is not.

Two bugs fixed alongside. Insert Function kept its own copy of the
evaluator's function names and the copy had fallen behind, so `LET`, `LAMBDA`,
the lambda helpers and `SUBTOTAL` were missing from the dialog despite having
descriptions written for them; there is one list now. And the set of names
that need Excel's `_xlfn.` prefix in a saved file had fallen behind the
engine, so `TEXTBEFORE`, `TEXTAFTER`, `FLOOR.MATH`, `CEILING.MATH`,
`STDEV.P`, `STDEV.S`, `VAR.P`, `VAR.S`, `MODE.SNGL`, the `PERCENTILE` and
`QUARTILE` pairs and `FORECAST.LINEAR` were written plainly and opened in
Excel as `#NAME?`. A test now holds the set against the engine, which caught
a name in it that the engine cannot evaluate.
