# My base

A table database app on your data, made with
[SvGrid Base](https://svgrid.com/docs/help/base/start/): every table of your
database is a tab, with fields typed from its columns, links from its foreign
keys, and grid, Kanban and calendar views. Edits are written back to the
database.

```bash
npm install
npm run dev
```

<!-- svgrid-base-data -->

## Make it yours

- **Tables**: `db/schema.sql` holds the tables the app started with. Add a
  table or a column to the database and reload: the base reads it.
  `db/templates/` has the other templates; copy one over `db/schema.sql` to
  start from it instead.
- **What SQL has no type for** (a select's colors, formulas, views,
  automations) is kept in `svgrid:` comments on the tables and columns.
  Dropping them loses only that: the base still opens from the columns.
- **Fields**: change a field's type, add views, filters, colors and forms in
  the app itself. To keep them, store the tables `onTablesChange` hands you
  (see [the docs](https://svgrid.com/docs/help/base/data/)).
- **Automations**: "Automations" in the view bar runs actions when records
  change ([guide](https://svgrid.com/docs/help/base/automations/)).

SvGrid Base is part of the Suite edition of `@svgrid/enterprise`. Without a
license key it runs with a watermark, so you can build and try everything
first.
