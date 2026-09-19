---
'@sv-grid/enterprise': patch
---

The filter region crosses into an .ods and back

OpenDocument keeps a sheet's filter beside its tables, as a database range,
which is where LibreOffice leaves the arrows a user turned on. The reader
takes one now, so a filtered sheet from LibreOffice arrives filtered, and the
writer puts one back, so a sheet filtered here opens filtered over there.
