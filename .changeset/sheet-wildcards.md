---
'@sv-grid/enterprise': patch
---

Excel's wildcards, which matched nothing at all

`*`, `?` and the `~` escape were read as ordinary characters everywhere, so
`=COUNTIF(A:A, "North*")` counted zero, `=SUMIF` added nothing and
`=MATCH("Sou*", A1:A9, 0)` answered `#N/A`. They now work across the
conditional family (`COUNTIF`, `SUMIF`, `AVERAGEIF`, their plural forms and
`MAXIFS` / `MINIFS`), the `"=x*"` and `"<>x*"` criterion forms, the exact
lookups (`VLOOKUP`, `HLOOKUP`, `MATCH` with mode 0), `XLOOKUP` under match
mode 2 as Excel gates it, and `SEARCH`, which takes wildcards where `FIND`,
the literal case-sensitive twin, does not. Only text takes part in a wildcard
match, as in Excel, so a number is never turned into text to meet `"1*"`.
