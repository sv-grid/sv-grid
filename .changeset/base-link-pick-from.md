---
'@svgrid/enterprise': minor
---

A link field's `pickFrom` (in the field editor, "Pick records from") names a
view of the linked table: the link picker lists only the records its filter
keeps, and says which view. `baseFromAirtable` maps Airtable's "Limit record
selection to a view". `RecordStore.search` takes a filter expression;
`LinkedTable` has `views()`.
