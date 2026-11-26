---
'@svgrid/enterprise': patch
---

Dates in the page's language: `setBaseMessages(words, { locale: 'bg' })` (or
`setDateLocale('bg')`) writes a calendar's month and weekday names, a Gantt's
axis, range and bar dates, a board card's date and the inbox's and record
panel's dates in that language, not the browser's (or English, which the
Gantt's axis and the scheduler's timeline always used). Unset, nothing changes.
