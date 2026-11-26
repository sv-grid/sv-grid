---
'@svgrid/enterprise': patch
---

Base: a record added with a link already in it (Add a record in a group of a view grouped by a link field) is written before the link back on the other record, so that update names it by the key the database gave it. It went first, with the page's own id, and a database that makes the keys refused it ("Not saved", though the record was stored).
