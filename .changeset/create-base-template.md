---
"@svgrid/create": minor
---

A `base` template: a table database app on your own data, made with SvGrid
Base. The wizard asks where the data lives (Postgres in the browser, your
Postgres behind a SvelteKit endpoint, or Supabase with Realtime) and which
template to start from: project tracker, sales CRM, content calendar,
product roadmap, hiring tracker, inventory, bug tracker, event planning,
OKRs, expense approvals, employee onboarding, or your own tables. Each
template is SQL with its records, views and automations, written to
`db/schema.sql`; the others stay in `db/templates/`. `--data` and
`--sample` answer on the command line:

```bash
npm create @svgrid@latest my-base -- -t base --data postgres --sample sales-crm
```
