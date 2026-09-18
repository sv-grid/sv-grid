---
"@svgrid/enterprise": minor
---

Print and Page Layout on the spreadsheet shell. The Page Layout tab
carries Excel's Page Setup group (Margins, Orientation, Size, Print Area,
Print Titles, and the Page Setup dialog on the launcher) and Sheet
Options (Print Gridlines, Print Headings), per sheet and in the document
as `pageSetup`, each change one undo. File > Print (Ctrl+P) lays the
sheet out as one HTML document from `sheetPrintHtml` (the print area or
the used range, widths and heights, hidden lines left out, merges as
spans, formats and conditional styles, title rows repeated per page) and
hands it to the browser's print dialog; `print()` and `printHtml()` are
on the component. The setup goes to and from the xlsx as `pageSetup`,
`pageMargins`, `printOptions` and Excel's `Print_Area` and `Print_Titles`
names.
