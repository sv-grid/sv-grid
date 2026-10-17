-- "An AI agent and your team, one table": the tickets table for the video.
-- Run once in the Supabase SQL editor (project rbnnlzgtfzsylllniozo).
-- A demo table only: the publishable key may read and update it, so do not
-- put real data in it. Running it again resets the tickets.

drop table if exists public.tickets;

create table public.tickets (
  id text primary key,
  subject text not null default '',
  customer text,
  message text,
  received timestamptz default now(),
  category text,
  priority text,
  reply text,
  review text,
  assignee text,
  -- Who changed the row last: the base names it from its people list.
  updated_by text
);

insert into public.tickets (id, subject, customer, message, received, priority, updated_by) values
  ('k1', 'Charged twice for October', 'mira@northwind.example', 'My card shows two charges for the October invoice.', now() - interval '17 minutes', 'Normal', 'u2'),
  ('k2', 'Can''t log in after a password reset', 'tom@contoso.example', 'The reset link worked, but the new password is refused.', now() - interval '34 minutes', 'Normal', 'u2'),
  ('k3', 'Export to PDF cuts off the last column', 'li@fabrikam.example', 'Wide tables lose their last column in the PDF.', now() - interval '51 minutes', 'Normal', 'u2'),
  ('k4', 'Please add dark mode to the mobile app', 'sara@litware.example', 'Our team works night shifts.', now() - interval '68 minutes', 'Normal', 'u2'),
  ('k5', 'Invoice shows the wrong VAT number', 'jon@adatum.example', 'The VAT number on invoice 2291 is our old one.', now() - interval '85 minutes', 'Normal', 'u2'),
  ('k6', 'Love the new export, can''t wait for Excel export', 'eva@tailspin.example', 'CSV works great for us. Any plans for .xlsx?', now() - interval '102 minutes', 'Normal', 'u2'),
  ('k7', 'The site is down for our whole team', 'raj@woodgrove.example', 'Every page returns an error since 9:10.', now() - interval '119 minutes', 'Normal', 'u2'),
  ('k8', 'How do I add a teammate?', 'ana@proseware.example', 'We hired someone and want to give them access.', now() - interval '136 minutes', 'Normal', 'u2'),
  ('k9', 'Refund for unused seats', 'kim@fourth.example', 'We removed 5 seats mid-month.', now() - interval '153 minutes', 'Normal', 'u2'),
  ('k10', 'Dashboard is slow with 50k rows', 'ola@wingtip.example', 'It takes several seconds to open since we imported last year.', now() - interval '170 minutes', 'Normal', 'u2');

alter table public.tickets enable row level security;
create policy "demo: anyone can read tickets" on public.tickets for select to anon, authenticated using (true);
create policy "demo: anyone can update tickets" on public.tickets for update to anon, authenticated using (true) with check (true);

-- Realtime: the base hears every change to the table.
alter publication supabase_realtime add table public.tickets;
