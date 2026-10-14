---
"@svgrid/enterprise": minor
---

SvGrid Base: a base as Postgres SQL, and back.

- `baseToSql(tables)` writes the tables, foreign keys, the tables behind
  links to many, and the records. Field settings SQL has no type for
  (select options and colors, number formats, formula, lookup, rollup and
  count fields, buttons), the views and the automations go into
  `svgrid:` comments on the tables and columns. Dates near today are
  written as `current_date + n`; keys get a `gen_random_uuid()` default.
- `baseFromDatabase`, `createBaseEndpoint` and `baseFromSupabase` read the
  comments back, so the database opens as the same base, tabs in their
  order. Without them it opens from the columns, as before.
- "Download as SQL" in the "All tables" menu of `<SvBase>`.
- `applyBaseComments`, `withInverses` and `sqlName` for apps that build
  specs themselves.
