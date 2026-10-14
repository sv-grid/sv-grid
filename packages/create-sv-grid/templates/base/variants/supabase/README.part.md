## Your data

1. In the Supabase dashboard, open the SQL editor and run `db/schema.sql`
   (skip it to use tables you already have).
2. Run `db/policies.sql` to let the anon key read and write them while you
   try it out, and to turn on Realtime. Replace those policies with your own
   before real data goes in.
3. Copy `.env.example` to `.env` with your project URL and anon key
   (Project Settings > API), then `npm run dev`.
