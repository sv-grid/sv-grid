---
"@svgrid/enterprise": patch
---

`NUMBERVALUE` follows Excel's rule about where a group separator may sit: a
thousands mark AFTER the decimal separator is `#VALUE!`, not a number. It
was dropping every group separator wherever it stood, so `1.5,5` read back
as fifteen and a half rather than as the typo it is.
