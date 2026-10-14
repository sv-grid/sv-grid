-- For trying the base out: everyone with the anon key can read and write
-- every table, and Realtime sends their changes. Replace these policies with
-- your own before you put real data in.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('drop policy if exists "base: try it out" on public.%I', t.tablename);
    execute format('create policy "base: try it out" on public.%I for all to anon, authenticated using (true) with check (true)', t.tablename);
    begin
      execute format('alter publication supabase_realtime add table public.%I', t.tablename);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
