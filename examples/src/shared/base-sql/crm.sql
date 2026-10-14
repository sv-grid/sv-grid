-- Sales CRM: companies, the people there, and the deals with them.
create table companies (
  id serial primary key,
  name text not null,
  industry text,
  website text,
  country text
);
create table contacts (
  id serial primary key,
  name text not null,
  email text,
  phone text,
  role text,
  company_id int references companies(id) on delete set null
);
create table deals (
  id serial primary key,
  title text not null,
  stage text,
  amount numeric,
  close_on date,
  notes text,
  company_id int references companies(id) on delete set null,
  contact_id int references contacts(id) on delete set null
);

insert into companies (name, industry, website, country) values
  ('Northwind Traders', 'Retail', 'https://northwind.example', 'Germany'),
  ('Contoso', 'Manufacturing', 'https://contoso.example', 'United States'),
  ('Fabrikam', 'Software', 'https://fabrikam.example', 'United States'),
  ('Tailspin Toys', 'Retail', 'https://tailspin.example', 'Canada');
insert into contacts (name, email, phone, role, company_id) values
  ('Maria Anders', 'maria@northwind.example', '+49 30 1234567', 'Buyer', 1),
  ('Ken Sato', 'ken@contoso.example', '+1 206 555 0100', 'CTO', 2),
  ('Rita Gomez', 'rita@fabrikam.example', '+1 415 555 0142', 'VP Sales', 3),
  ('Tom Wood', 'tom@tailspin.example', '+1 604 555 0199', 'Buyer', 4);
insert into deals (title, stage, amount, close_on, notes, company_id, contact_id) values
  ('Annual renewal', 'Won', 48000, current_date - 12, 'Three-year term.', 1, 1),
  ('Second warehouse', 'Proposal', 125000, current_date + 18, null, 1, 1),
  ('Pilot for 40 seats', 'Qualified', 22000, current_date + 30, null, 2, 2),
  ('Platform upgrade', 'Negotiation', 87000, current_date + 9, 'Legal review this week.', 3, 3),
  ('Support plan', 'Lost', 9000, current_date - 3, 'Went with an in-house team.', 2, 2),
  ('Holiday catalog', 'Proposal', 31000, current_date + 25, null, 4, 4),
  ('Analytics add-on', 'Qualified', 14000, current_date + 40, null, 3, 3),
  ('Store rollout', 'Negotiation', 66000, current_date + 14, null, 4, 4);
