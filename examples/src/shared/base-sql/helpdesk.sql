-- Help desk: support agents and the tickets they work on.
create table agents (
  id serial primary key,
  name text not null,
  email text,
  team text
);
create table tickets (
  id serial primary key,
  subject text not null,
  priority text,
  status text,
  opened_on date,
  customer_email text,
  description text,
  agent_id int references agents(id)
);

insert into agents (name, email, team) values
  ('Ana Ruiz', 'ana@example.com', 'Billing'), ('Ben Okafor', 'ben@example.com', 'Technical'),
  ('Cleo Park', 'cleo@example.com', 'Technical'), ('Dev Shah', 'dev@example.com', 'Billing');
insert into tickets (subject, priority, status, opened_on, customer_email, description, agent_id) values
  ('Charged twice in March', 'High', 'Open', current_date - 1, 'jo@example.com', 'Two identical charges on the card.', 1),
  ('Cannot reset password', 'Medium', 'Pending', current_date - 3, 'li@example.com', 'The email never arrives.', 2),
  ('Export to CSV is empty', 'High', 'Open', current_date, 'sam@example.com', null, 3),
  ('Invoice address change', 'Low', 'Solved', current_date - 8, 'max@example.com', null, 4),
  ('API rate limit question', 'Low', 'Pending', current_date - 2, 'kim@example.com', 'Is 100 per minute per key?', 2),
  ('Refund for annual plan', 'Medium', 'Open', current_date - 4, 'ada@example.com', null, 1),
  ('SSO login loops', 'High', 'Pending', current_date - 1, 'raj@example.com', 'Redirects back to login.', 3),
  ('Typo on pricing page', 'Low', 'Solved', current_date - 12, 'eve@example.com', null, null);
