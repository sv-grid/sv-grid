-- The bug tracker template, as Postgres tables. Made by baseToSql (@svgrid/enterprise/base);
-- the svgrid: comments keep what SQL has no type for, so baseFromDatabase opens it as the same base.

create table "bugs" (
  "id" text primary key default gen_random_uuid()::text,
  "svgrid_order" bigint generated always as identity,
  "bug" text,
  "severity" text,
  "status" text,
  "areas" text[],
  "assignee" text,
  "reporter" text,
  "release_id" text,
  "reported" date,
  "fixed_on" date,
  "steps" text
);
create table "releases" (
  "id" text primary key default gen_random_uuid()::text,
  "svgrid_order" bigint generated always as identity,
  "version" text,
  "ships" date,
  "notes" text
);

comment on column "bugs"."bug" is 'svgrid:{"field":"bug","header":"Bug","width":280,"fieldType":"text"}';
comment on column "bugs"."severity" is 'svgrid:{"field":"severity","header":"Severity","width":120,"fieldType":"singleSelect","fieldProps":{"options":[{"value":"Critical","color":"#f82b60"},{"value":"High","color":"#ff6f2c"},{"value":"Medium","color":"#fcb400"},{"value":"Low","color":"#94a3b8"}]}}';
comment on column "bugs"."status" is 'svgrid:{"field":"status","header":"Status","width":130,"fieldType":"singleSelect","fieldProps":{"options":[{"value":"New","color":"#8b46ff"},{"value":"Triaged","color":"#18bfff"},{"value":"In progress","color":"#2d7ff9"},{"value":"Fixed","color":"#20c933"},{"value":"Won''t fix","color":"#666666"}]}}';
comment on column "bugs"."areas" is 'svgrid:{"field":"areas","header":"Areas","width":170,"fieldType":"multiSelect","fieldProps":{"options":[{"value":"UI","color":"#2d7ff9"},{"value":"API","color":"#8b46ff"},{"value":"Data","color":"#20d9d2"},{"value":"Auth","color":"#ff6f2c"},{"value":"Billing","color":"#20c933"}]}}';
comment on column "bugs"."assignee" is 'svgrid:{"field":"assignee","header":"Assignee","width":160,"fieldType":"user"}';
comment on column "bugs"."reporter" is 'svgrid:{"field":"reporter","header":"Reported by","width":160,"fieldType":"user"}';
comment on column "bugs"."release_id" is 'svgrid:{"field":"release","header":"Release","width":110,"fieldType":"link","fieldProps":{"table":"releases","multiple":false,"inverse":"bugs"}}';
comment on column "bugs"."reported" is 'svgrid:{"field":"reported","header":"Reported","width":150,"fieldType":"date","fieldProps":{"dateFormat":"friendly"}}';
comment on column "bugs"."fixed_on" is 'svgrid:{"field":"fixedOn","header":"Fixed on","width":150,"fieldType":"date","fieldProps":{"dateFormat":"friendly"}}';
comment on column "bugs"."steps" is 'svgrid:{"field":"steps","header":"Steps to reproduce","width":260,"fieldType":"longText"}';
comment on table "bugs" is 'svgrid:{"v":1,"name":"Bugs","position":0,"primaryField":"bug","order":["bug","severity","status","fix","areas","assignee","reporter","release","reported","fixedOn","steps"],"extra":[{"field":"fix","header":"Fix","width":96,"fieldType":"button","fieldProps":{"label":"Start","color":"#2d7ff9"}}],"views":[{"id":"triage","name":"Triage","type":"grid","color":{"mode":"field","field":"severity"},"state":{"sorting":[{"id":"severity","desc":false}],"grouping":["status"],"columnWidths":{"bug":280,"severity":120,"status":130,"fix":96,"areas":170,"assignee":160,"reporter":160,"release":110,"reported":150,"fixedOn":150,"steps":260},"columnPinning":{"left":["bug"],"right":[]},"columnOrder":["bug","severity","status","fix","areas","assignee","reporter","release","reported","fixedOn","steps"],"hiddenColumns":[],"globalFilter":"","columnFilters":{},"facetFilters":{}},"rowHeight":40},{"id":"board","name":"Board","type":"kanban","stackBy":"status","color":{"mode":"field","field":"severity"}},{"id":"critical","name":"Critical now","type":"grid","state":{"advancedFilter":{"kind":"fieldFilter","conjunction":"and","conditions":[{"column":"severity","kind":"select","op":"is","value":"Critical"},{"column":"status","kind":"select","op":"isNoneOf","value":["Fixed","Won''t fix"]}]}}},{"id":"areas","name":"Bugs by area","type":"chart","chart":{"kind":"barH","x":"areas"}},{"id":"report","name":"Report a bug","type":"form","formFields":["bug","severity","areas","reporter","steps"],"formTitle":"Report a bug","formDescription":"What went wrong, and how to see it happen."}],"automations":[{"id":"critical","name":"Critical bug","enabled":true,"trigger":{"type":"recordMatches"},"condition":{"kind":"fieldFilter","conjunction":"and","conditions":[{"column":"severity","kind":"select","op":"is","value":"Critical"},{"column":"status","kind":"select","op":"isNoneOf","value":["Fixed","Won''t fix"]}]},"actions":[{"type":"highlight","background":"#fee2e2","color":"#991b1b"},{"type":"notify","message":"Critical: {Bug} ({Assignee})","severity":"error"}]},{"id":"fixed","name":"Stamp the fix date","enabled":true,"trigger":{"type":"recordUpdated","fields":["status"]},"condition":{"kind":"fieldFilter","conjunction":"and","conditions":[{"column":"status","kind":"select","op":"is","value":"Fixed"}]},"actions":[{"type":"updateRecord","values":{"fixedOn":"today"}}]},{"id":"reported","name":"New report","enabled":true,"trigger":{"type":"formSubmitted","view":"report"},"actions":[{"type":"updateRecord","values":{"status":"New","reported":"today"}},{"type":"notify","message":"New bug: {Bug}","severity":"warning"}]},{"id":"start","name":"Start fixing","enabled":true,"trigger":{"type":"button","field":"fix"},"actions":[{"type":"updateRecord","values":{"status":"In progress"}}]}]}';
comment on column "releases"."version" is 'svgrid:{"field":"version","header":"Version","width":110,"fieldType":"text"}';
comment on column "releases"."ships" is 'svgrid:{"field":"ships","header":"Ships","width":160,"fieldType":"date","fieldProps":{"dateFormat":"friendly"}}';
comment on column "releases"."notes" is 'svgrid:{"field":"notes","header":"Notes","width":240,"fieldType":"longText"}';
comment on table "releases" is 'svgrid:{"v":1,"name":"Releases","position":1,"primaryField":"version","order":["version","ships","bugs","count","notes"],"extra":[{"field":"bugs","header":"Bugs","width":360,"fieldType":"link","fieldProps":{"table":"bugs","multiple":true,"inverse":"release"}},{"field":"count","header":"Bug count","width":110,"fieldType":"count","fieldProps":{"linkField":"bugs"}}],"views":[{"id":"all","name":"All releases","type":"grid","state":{"sorting":[{"id":"ships","desc":false}]}},{"id":"calendar","name":"Release calendar","type":"calendar","dateField":"ships"}]}';

insert into "bugs" ("id", "bug", "severity", "status", "areas", "assignee", "reporter", "release_id", "reported", "fixed_on", "steps") values
  ('1', 'Checkout button does nothing on Safari 17', 'Critical', 'In progress', array['UI', 'Billing']::text[], 'u2', 'u5', 'r2', current_date - 3, null, '1. Add an item
2. Open the cart in Safari 17
3. Press Checkout'),
  ('2', 'Invoices show last month''s tax rate', 'High', 'Triaged', array['Billing', 'Data']::text[], 'u4', 'u6', 'r2', current_date - 5, null, 'Create an invoice dated the 1st of a month.'),
  ('3', 'Sign-in link expires after 1 minute', 'High', 'Fixed', array['Auth']::text[], 'u3', 'u7', 'r1', current_date - 14, current_date - 9, 'Request a sign-in link and wait 70 seconds.'),
  ('4', 'Dark mode: table header unreadable', 'Medium', 'Fixed', array['UI']::text[], 'u1', 'u8', 'r1', current_date - 20, current_date - 16, 'Turn on dark mode, open Reports.'),
  ('5', 'Export to CSV drops the last row', 'Critical', 'New', array['Data']::text[], null, 'u5', 'r2', current_date - 1, null, 'Export any report with more than 1,000 rows.'),
  ('6', 'API returns 500 on empty filter', 'Medium', 'In progress', array['API']::text[], 'u2', 'u6', 'r2', current_date - 4, null, 'GET /api/orders?status='),
  ('7', 'Avatar upload hangs at 99%', 'Low', 'Triaged', array['UI']::text[], 'u1', 'u7', 'r3', current_date - 8, null, 'Upload a PNG over 5 MB.'),
  ('8', 'Webhook retries flood the log', 'Medium', 'New', array['API', 'Data']::text[], null, 'u8', 'r3', current_date - 2, null, 'Point a webhook at a URL that answers 503.'),
  ('9', 'Password rules not shown on sign-up', 'Low', 'Won''t fix', array['Auth', 'UI']::text[], 'u3', 'u5', 'r1', current_date - 30, null, 'Open the sign-up page.'),
  ('10', 'Refund marks the order paid twice', 'High', 'Fixed', array['Billing']::text[], 'u4', 'u6', 'r1', current_date - 18, current_date - 12, 'Refund part of an order.');
insert into "releases" ("id", "version", "ships", "notes") values
  ('r1', '2.4', current_date - 7, 'Billing fixes and dark mode.'),
  ('r2', '2.5', current_date + 10, 'Checkout and exports.'),
  ('r3', '2.6', current_date + 31, 'API polish.');

alter table "bugs" add foreign key ("release_id") references "releases"("id") on delete set null;
