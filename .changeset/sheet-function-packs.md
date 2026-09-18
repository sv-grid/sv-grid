---
"@svgrid/enterprise": minor
---

Financial, math, statistics, text and date function packs in the sheet
engine.

PMT, IPMT, PPMT, PV, FV, NPER, RATE, NPV, IRR and SLN with Excel's sign
convention; SUMPRODUCT, PRODUCT, SUMSQ, CEILING and FLOOR (both flavours),
MROUND, TRUNC, LOG, LOG10, LN, EXP, PI, RAND, RANDBETWEEN, SIGN, EVEN, ODD,
QUOTIENT, GCD, LCM, FACT; LARGE, SMALL, PERCENTILE and QUARTILE (both
flavours), VAR and STDEV sample and population, MODE, GEOMEAN, AVERAGEIFS,
MAXIFS, MINIFS, CORREL, SLOPE, INTERCEPT, FORECAST; PROPER, REPT, VALUE,
CHAR, CODE, UNICHAR, UNICODE, EXACT, CLEAN, REPLACE, T, N; WEEKDAY, EDATE,
NETWORKDAYS, WORKDAY, WEEKNUM, HOUR, MINUTE, SECOND, TIME, DATEVALUE,
TIMEVALUE, DAYS360, YEARFRAC; CHOOSE, ROWS, COLUMNS; and ISERROR, ISERR,
ISNA, which the evaluator dispatches so they see the error first. All on by
default, described in Insert Function under a new Financial group, and
hinted in the formula bar. An argument left out between commas, as in
`PMT(A1, A2, A3, , 1)`, reads as a blank so the defaults apply; a trailing
comma is the same rather than a parse error.
