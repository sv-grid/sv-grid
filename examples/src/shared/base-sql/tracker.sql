-- Project tracker: projects, their tasks, the people on them, and tags.
create table people (
  id serial primary key,
  name text not null,
  email text,
  team text
);
create table projects (
  id serial primary key,
  name text not null,
  status text,
  due_on date,
  budget numeric,
  lead_id int references people(id)
);
create table tasks (
  id serial primary key,
  title text not null,
  status text,
  priority text,
  due_on date,
  notes text,
  done boolean not null default false,
  project_id int references projects(id) on delete set null,
  assignee_id int references people(id)
);
create table tags (
  id serial primary key,
  name text not null
);
create table task_tags (
  id serial primary key,
  task_id int not null references tasks(id) on delete cascade,
  tag_id int not null references tags(id) on delete cascade
);

insert into people (name, email, team) values
  ('Ana Ruiz', 'ana@example.com', 'Design'), ('Ben Okafor', 'ben@example.com', 'Engineering'),
  ('Cleo Park', 'cleo@example.com', 'Engineering'), ('Dev Shah', 'dev@example.com', 'Marketing');
insert into projects (name, status, due_on, budget, lead_id) values
  ('Website relaunch', 'Active', current_date + 21, 24000, 1),
  ('Billing revamp', 'Active', current_date + 45, 38000, 2),
  ('Mobile app', 'Planned', current_date + 90, 52000, 3);
insert into tasks (title, status, priority, due_on, notes, done, project_id, assignee_id) values
  ('Landing page copy', 'Done', 'Medium', current_date - 4, 'Approved by marketing.', true, 1, 4),
  ('Pricing table', 'In progress', 'High', current_date + 3, null, false, 1, 1),
  ('Launch email', 'Todo', 'Medium', current_date + 9, null, false, 1, 4),
  ('Invoice PDFs', 'In progress', 'High', current_date + 6, 'Use the new template.', false, 2, 2),
  ('Tax rules by country', 'Blocked', 'High', current_date + 12, 'Waiting on legal.', false, 2, 3),
  ('Card retries', 'Todo', 'Low', current_date + 20, null, false, 2, 2),
  ('Offline mode', 'Todo', 'Medium', current_date + 34, null, false, 3, 3),
  ('Push notifications', 'Todo', 'Low', current_date + 40, null, false, 3, 1);
insert into tags (name) values ('Design'), ('Backend'), ('Frontend'), ('Risk');
insert into task_tags (task_id, tag_id) values (1, 1), (2, 1), (2, 3), (4, 2), (5, 2), (5, 4), (7, 3), (8, 3);
