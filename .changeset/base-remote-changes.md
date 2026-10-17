---
"@svgrid/enterprise": minor
---

SvGrid Base shows changes made in the database by someone else: another
user, a script, an AI agent. When a table's `realtime` source reports a
change, the cells that moved are tinted and the row number gets a dot until
the record is opened; the view bar counts them ("3 changed by Ana Ruiz") and
marks them all seen on a click. The record's activity credits each change to
the name in its `lastModifiedBy` field and shows the value before it. New
`onRemoteChange` prop on `<SvBase>` and `onRemoteChange` option on
`createBaseSync`, with the `BaseRemoteChange` type. Demo 700 is a support
inbox triaged by an agent that writes to Postgres. A base built from a
database reads a `created_by` text column as Created by and `updated_by` or
`modified_by` as Last modified by.
