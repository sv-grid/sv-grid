-- The event planning template, as Postgres tables. Made by baseToSql (@svgrid/enterprise/base);
-- the svgrid: comments keep what SQL has no type for, so baseFromDatabase opens it as the same base.

create table "events" (
  "id" text primary key default gen_random_uuid()::text,
  "event" text,
  "date" date,
  "status" text,
  "venue" text,
  "owner" text,
  "budget" double precision,
  "capacity" double precision
);
create table "attendees" (
  "id" text primary key default gen_random_uuid()::text,
  "name" text,
  "event_id" text,
  "ticket" text,
  "email" text,
  "company" text,
  "checked_in" boolean
);
create table "checklist" (
  "id" text primary key default gen_random_uuid()::text,
  "item" text,
  "event_id" text,
  "team" text,
  "due" date,
  "done" boolean
);

comment on column "events"."event" is 'svgrid:{"field":"event","header":"Event","width":220,"fieldType":"text"}';
comment on column "events"."date" is 'svgrid:{"field":"date","header":"Date","width":160,"fieldType":"date","fieldProps":{"dateFormat":"friendly"}}';
comment on column "events"."status" is 'svgrid:{"field":"status","header":"Status","width":130,"fieldType":"singleSelect","fieldProps":{"options":[{"value":"Idea","color":"#94a3b8"},{"value":"Planning","color":"#fcb400"},{"value":"Confirmed","color":"#2d7ff9"},{"value":"Done","color":"#20c933"}]}}';
comment on column "events"."venue" is 'svgrid:{"field":"venue","header":"Venue","width":200,"fieldType":"text"}';
comment on column "events"."owner" is 'svgrid:{"field":"owner","header":"Owner","width":150,"fieldType":"user"}';
comment on column "events"."budget" is 'svgrid:{"field":"budget","header":"Budget","width":120,"fieldType":"number","fieldProps":{"format":"currency","symbol":"$","precision":0,"summary":"sum"}}';
comment on column "events"."capacity" is 'svgrid:{"field":"capacity","header":"Capacity","width":110,"fieldType":"number","fieldProps":{"format":"integer"}}';
comment on table "events" is 'svgrid:{"v":1,"name":"Events","position":0,"primaryField":"event","order":["event","date","status","venue","owner","budget","capacity","attendees","registered","left","checklist"],"extra":[{"field":"attendees","header":"Attendees","width":240,"fieldType":"link","fieldProps":{"table":"attendees","multiple":true,"inverse":"event"}},{"field":"registered","header":"Registered","width":120,"fieldType":"count","fieldProps":{"linkField":"attendees"}},{"field":"left","header":"Seats left","width":120,"fieldType":"formula","fieldProps":{"formula":"{Capacity} - {Registered}","result":"number","precision":0}},{"field":"checklist","header":"Checklist","width":240,"fieldType":"link","fieldProps":{"table":"checklist","multiple":true,"inverse":"event"}}],"views":[{"id":"calendar","name":"Calendar","type":"calendar","dateField":"date","color":{"mode":"field","field":"status"},"state":{"sorting":[],"grouping":[],"columnWidths":{"event":220,"date":160,"status":130,"venue":200,"owner":150,"budget":120,"capacity":110,"attendees":240,"registered":120,"left":120,"checklist":240},"columnPinning":{"left":["event"],"right":[]},"columnOrder":["event","date","status","venue","owner","budget","capacity","attendees","registered","left","checklist"],"hiddenColumns":[],"globalFilter":"","columnFilters":{},"facetFilters":{}},"rowHeight":40},{"id":"board","name":"Planning board","type":"kanban","stackBy":"status"},{"id":"all","name":"All events","type":"grid","color":{"mode":"field","field":"status"},"state":{"sorting":[{"id":"date","desc":false}]}}],"automations":[{"id":"confirmed","name":"Confirmed event gets its checklist","enabled":true,"trigger":{"type":"recordMatches"},"condition":{"kind":"fieldFilter","conjunction":"and","conditions":[{"column":"status","kind":"select","op":"is","value":"Confirmed"}]},"actions":[{"type":"createRecord","table":"checklist","values":{"item":"Sign the venue contract","team":"Venue","due":"today+3"},"linkField":"event"},{"type":"createRecord","table":"checklist","values":{"item":"Book catering","team":"Catering","due":"today+7"},"linkField":"event"},{"type":"createRecord","table":"checklist","values":{"item":"Announce {Event}","team":"Marketing","due":"today+2"},"linkField":"event"},{"type":"notify","message":"{Event} is confirmed: its checklist is ready","severity":"success"}]},{"id":"full","name":"Sold out","enabled":true,"trigger":{"type":"recordMatches"},"condition":{"kind":"fieldFilter","conjunction":"and","conditions":[{"column":"left","kind":"number","op":"lte","value":0}]},"actions":[{"type":"highlight","fields":["left","registered"],"background":"#fee2e2","color":"#991b1b"},{"type":"notify","message":"{Event} is full ({Registered} of {Capacity})","severity":"warning"}]}]}';
comment on column "attendees"."name" is 'svgrid:{"field":"name","header":"Name","width":190,"fieldType":"text"}';
comment on column "attendees"."event_id" is 'svgrid:{"field":"event","header":"Event","width":200,"fieldType":"link","fieldProps":{"table":"events","multiple":false,"inverse":"attendees"}}';
comment on column "attendees"."ticket" is 'svgrid:{"field":"ticket","header":"Ticket","width":120,"fieldType":"singleSelect","fieldProps":{"options":[{"value":"General","color":"#2d7ff9"},{"value":"VIP","color":"#8b46ff"},{"value":"Speaker","color":"#ff6f2c"},{"value":"Press","color":"#20d9d2"}]}}';
comment on column "attendees"."email" is 'svgrid:{"field":"email","header":"Email","width":230,"fieldType":"email"}';
comment on column "attendees"."company" is 'svgrid:{"field":"company","header":"Company","width":160,"fieldType":"text"}';
comment on column "attendees"."checked_in" is 'svgrid:{"field":"checkedIn","header":"Checked in","width":110,"fieldType":"checkbox","fieldProps":{"color":"#20c933"}}';
comment on table "attendees" is 'svgrid:{"v":1,"name":"Attendees","position":1,"primaryField":"name","order":["name","event","ticket","email","company","checkedIn"],"extra":[],"views":[{"id":"guests","name":"Guest list","type":"grid","state":{"grouping":["event"]}},{"id":"tickets","name":"Tickets by type","type":"chart","chart":{"kind":"donut","x":"ticket"}},{"id":"rsvp","name":"RSVP","type":"form","formFields":["name","email","company","event","ticket"],"formTitle":"Save your seat","formDescription":"Pick the event and the ticket. We send the details by email."}],"automations":[{"id":"rsvp","name":"Welcome a guest","enabled":true,"trigger":{"type":"formSubmitted","view":"rsvp"},"actions":[{"type":"notify","message":"{Name} is in for {Event}","severity":"success"}]}]}';
comment on column "checklist"."item" is 'svgrid:{"field":"item","header":"Item","width":260,"fieldType":"text"}';
comment on column "checklist"."event_id" is 'svgrid:{"field":"event","header":"Event","width":200,"fieldType":"link","fieldProps":{"table":"events","multiple":false,"inverse":"checklist"}}';
comment on column "checklist"."team" is 'svgrid:{"field":"team","header":"Team","width":130,"fieldType":"singleSelect","fieldProps":{"options":[{"value":"Venue","color":"#2d7ff9"},{"value":"Catering","color":"#20c933"},{"value":"Marketing","color":"#ff6f2c"}]}}';
comment on column "checklist"."due" is 'svgrid:{"field":"due","header":"Due","width":160,"fieldType":"date","fieldProps":{"dateFormat":"friendly"}}';
comment on column "checklist"."done" is 'svgrid:{"field":"done","header":"Done","width":80,"fieldType":"checkbox","fieldProps":{"color":"#20c933"}}';
comment on table "checklist" is 'svgrid:{"v":1,"name":"Checklist","position":2,"primaryField":"item","order":["item","event","team","due","done"],"extra":[],"views":[{"id":"open","name":"To do","type":"grid","state":{"grouping":["event"],"sorting":[{"id":"due","desc":false}]}},{"id":"teams","name":"By team","type":"kanban","stackBy":"team"}]}';

insert into "events" ("id", "event", "date", "status", "venue", "owner", "budget", "capacity") values
  ('e1', 'Customer summit', current_date + 12, 'Confirmed', 'Harbor Hall, Lisbon', 'u1', 42000, 6),
  ('e2', 'Partner dinner', current_date + 5, 'Confirmed', 'Casa Azul, Porto', 'u2', 6500, 4),
  ('e3', 'Product launch webinar', current_date + 26, 'Planning', 'Online', 'u3', 3000, 500),
  ('e4', 'Design meetup', current_date + 40, 'Idea', 'The Foundry, Berlin', 'u4', 1200, 60),
  ('e5', 'Team offsite', current_date - 9, 'Done', 'Lake house, Sintra', 'u1', 15800, 25);
insert into "attendees" ("id", "name", "event_id", "ticket", "email", "company", "checked_in") values
  ('a1', 'Maria Anders', 'e1', 'VIP', 'maria@northwind.example', 'Northwind', false),
  ('a2', 'Ken Sato', 'e1', 'General', 'ken@contoso.example', 'Contoso', false),
  ('a3', 'Rita Gomez', 'e1', 'Speaker', 'rita@fabrikam.example', 'Fabrikam', false),
  ('a4', 'Tom Wood', 'e1', 'General', 'tom@tailspin.example', 'Tailspin', false),
  ('a5', 'Lee Wong', 'e1', 'Press', 'lee@adatum.example', 'Adatum', false),
  ('a6', 'Omar Haddad', 'e2', 'VIP', 'omar@litware.example', 'Litware', false),
  ('a7', 'Eva Novak', 'e2', 'VIP', 'eva@proseware.example', 'Proseware', false),
  ('a8', 'Sam Reyes', 'e2', 'General', 'sam@woodgrove.example', 'Woodgrove', false),
  ('a9', 'Ines Costa', 'e3', 'General', 'ines@lucerne.example', 'Lucerne', false),
  ('a10', 'Jon Berg', 'e3', 'Speaker', 'jon@fourthcoffee.example', 'Fourth Coffee', false),
  ('a11', 'Ana Lima', 'e5', 'General', 'ana@relecloud.example', 'Relecloud', true),
  ('a12', 'Ravi Iyer', 'e5', 'General', 'ravi@wingtip.example', 'Wingtip', true);
insert into "checklist" ("id", "item", "event_id", "team", "due", "done") values
  ('c1', 'Sign the venue contract', 'e1', 'Venue', current_date - 2, true),
  ('c2', 'Order catering for 120', 'e1', 'Catering', current_date + 6, false),
  ('c3', 'Send the agenda to attendees', 'e1', 'Marketing', current_date + 8, false),
  ('c4', 'Book a private room', 'e2', 'Venue', current_date + 1, true),
  ('c5', 'Set up the webinar page', 'e3', 'Marketing', current_date + 14, false);

alter table "attendees" add foreign key ("event_id") references "events"("id") on delete set null;
alter table "checklist" add foreign key ("event_id") references "events"("id") on delete set null;
