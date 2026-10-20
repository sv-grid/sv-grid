## Your data

The base reads your Postgres through `src/routes/api/base/+server.ts`; the
page never sees the connection string. Set it up before the first run:

```bash
npm install
cp .env.example .env   # set DATABASE_URL
npm run db:setup       # creates the tables in db/schema.sql
npm run dev
```

Skip `npm run db:setup` to use tables you already have: the base shows every
table it finds.
