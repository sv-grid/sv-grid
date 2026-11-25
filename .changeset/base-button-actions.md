---
'@svgrid/enterprise': minor
---

SvGrid Base Button field: an action. Open a link (now also a formula, as
Airtable's button takes one, and `mailto:`, `tel:`, `sms:` and same-site links),
run automations, change the record (one undo step, with a done label once it
holds the values), fill in from a record template, run a record action (Print),
copy text, duplicate, delete or open the record. Any button can be limited to
records that match a condition and can ask before it runs; a person who may
only read cannot press one that changes records. Automations on the button run
after its action and read `{pressed.name}`, `{pressed.email}` and `{pressed.id}`.
The field editor has two new property kinds for it: `filter` and `recordValues`.
