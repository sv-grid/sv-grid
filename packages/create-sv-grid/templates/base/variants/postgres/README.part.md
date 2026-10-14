## Your data

The base reads your Postgres through `src/routes/api/base/+server.ts`; the
page never sees the connection string.

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. `npm run db:setup` creates the tables in `db/schema.sql` (skip it to use
   tables you already have: the base shows every table it finds).
3. `npm run dev`.
