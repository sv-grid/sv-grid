## Your data

Set up the project before the first run:

1. In the Supabase dashboard, open the SQL editor and run `db/schema.sql`
   (skip it to use tables you already have).
2. Run `db/policies.sql` to let the anon key read and write them while you
   try it out, and to turn on Realtime. Replace those policies with your own
   before real data goes in.
3. Install, put your project URL and anon key (Project Settings > API) in
   `.env`, and run the app:

```bash
npm install
cp .env.example .env   # set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY
npm run dev
```
