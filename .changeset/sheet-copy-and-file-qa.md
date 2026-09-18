---
"@svgrid/enterprise": patch
---

Two more a quality pass found, in what a file and a copy carry:

- **A link with a scheme the shell will not follow came in from a file.**
  The writer already leaves such a target out, but the reader took whatever
  a `hyperlink` relationship pointed at, so opening a workbook someone sent
  put `javascript:...` into the document, to be shown, saved again and
  handed on. It is dropped on the way in now.
- **A duplicated sheet shared its objects' identities with the sheet it came
  from.** The copy's charts, pictures, sparklines and PivotTables carried
  the same ids, so a shell that tracks the selected object by id followed
  the copy's one across a sheet switch: select a chart, move to the copy,
  press Delete, and the copy's chart went. The copy gets its own ids, the
  way Excel's Move or Copy does, and the shell drops the object selection
  when the active sheet changes, since a selection belongs to a sheet.

With them, a QA round over what a stranger's file holds: names carrying XML
characters, a dimension claiming the whole grid, a row addressed past the
end of it, a merge written back to front, and a sheet part that is not XML.
