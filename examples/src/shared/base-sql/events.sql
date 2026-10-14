-- Events: venues, events and their speakers.
create table venues (
  id serial primary key,
  name text not null,
  city text,
  capacity int
);
create table events (
  id serial primary key,
  title text not null,
  status text,
  starts_on date,
  ticket_price numeric,
  notes text,
  venue_id int references venues(id)
);
create table speakers (
  id serial primary key,
  name text not null,
  email text,
  company text
);
create table event_speakers (
  id serial primary key,
  event_id int references events(id) on delete cascade,
  speaker_id int references speakers(id) on delete cascade
);

insert into venues (name, city, capacity) values
  ('Harbor Hall', 'Lisbon', 800), ('The Foundry', 'Berlin', 350), ('Pier 9', 'San Francisco', 1200);
insert into events (title, status, starts_on, ticket_price, notes, venue_id) values
  ('Svelte Summit', 'On sale', current_date + 12, 149, 'Main stage and two workshop rooms.', 1),
  ('Data Night', 'Planned', current_date + 30, 0, 'Free meetup; pizza after.', 2),
  ('Design Systems Day', 'Sold out', current_date + 5, 199, null, 3),
  ('Edge Conf', 'On sale', current_date + 45, 249, 'Hybrid: stream for remote tickets.', 3),
  ('Accessibility Lab', 'Planned', current_date + 60, 89, null, 2),
  ('Founders Breakfast', 'Done', current_date - 10, 35, 'Sold 80 seats.', 1),
  ('Rust Meetup', 'Done', current_date - 25, 0, null, 2),
  ('AI in Practice', 'Sold out', current_date + 18, 179, 'Waitlist is open.', 1);
insert into speakers (name, email, company) values
  ('Ana Ruiz', 'ana@example.com', 'Northwind'), ('Ben Okafor', 'ben@example.com', 'Contoso'),
  ('Cleo Park', 'cleo@example.com', 'Fabrikam'), ('Dev Shah', 'dev@example.com', 'Northwind');
insert into event_speakers (event_id, speaker_id) values
  (1, 1), (1, 3), (2, 2), (3, 3), (4, 1), (4, 4), (5, 2), (8, 4);
