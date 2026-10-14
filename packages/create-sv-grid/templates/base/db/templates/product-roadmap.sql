-- The product roadmap template, as Postgres tables. Made by baseToSql (@svgrid/enterprise/base);
-- the svgrid: comments keep what SQL has no type for, so baseFromDatabase opens it as the same base.

create table "features" (
  "id" text primary key default gen_random_uuid()::text,
  "feature" text,
  "quarter" text,
  "status" text,
  "teams" text[],
  "lead" text,
  "impact" double precision,
  "effort" double precision,
  "start" date,
  "target" date,
  "votes" double precision,
  "spec" text
);
create table "feedback" (
  "id" text primary key default gen_random_uuid()::text,
  "request" text,
  "customer" text,
  "plan" text,
  "feature_id" text,
  "received" date
);

comment on column "features"."feature" is 'svgrid:{"field":"feature","header":"Feature","width":280,"fieldType":"text"}';
comment on column "features"."quarter" is 'svgrid:{"field":"quarter","header":"Quarter","width":132,"fieldType":"singleSelect","fieldProps":{"options":[{"value":"Q4 2026","color":"#2d7ff9"},{"value":"Q1 2027","color":"#18bfff"},{"value":"Q2 2027","color":"#20d9d2"},{"value":"Later","color":"#94a3b8"}]}}';
comment on column "features"."status" is 'svgrid:{"field":"status","header":"Status","width":130,"fieldType":"singleSelect","fieldProps":{"options":[{"value":"Planned","color":"#94a3b8"},{"value":"In progress","color":"#2d7ff9"},{"value":"In beta","color":"#8b46ff"},{"value":"Shipped","color":"#20c933"},{"value":"Blocked","color":"#f82b60"}]}}';
comment on column "features"."teams" is 'svgrid:{"field":"teams","header":"Teams","width":180,"fieldType":"multiSelect","fieldProps":{"options":[{"value":"Web","color":"#2d7ff9"},{"value":"Mobile","color":"#ff6f2c"},{"value":"Platform","color":"#8b46ff"},{"value":"Data","color":"#20c933"},{"value":"Design","color":"#ff08c2"}]}}';
comment on column "features"."lead" is 'svgrid:{"field":"lead","header":"Lead","width":160,"fieldType":"user"}';
comment on column "features"."impact" is 'svgrid:{"field":"impact","header":"Impact","width":130,"fieldType":"rating","fieldProps":{"max":5,"color":"#fcb400"}}';
comment on column "features"."effort" is 'svgrid:{"field":"effort","header":"Effort (days)","width":120,"fieldType":"number","fieldProps":{"format":"integer","summary":"sum"}}';
comment on column "features"."start" is 'svgrid:{"field":"start","header":"Start","width":140,"fieldType":"date","fieldProps":{"dateFormat":"friendly"}}';
comment on column "features"."target" is 'svgrid:{"field":"target","header":"Target","width":140,"fieldType":"date","fieldProps":{"dateFormat":"friendly"}}';
comment on column "features"."votes" is 'svgrid:{"field":"votes","header":"Votes","width":100,"fieldType":"number","fieldProps":{"format":"integer","showBar":false,"summary":"sum"}}';
comment on column "features"."spec" is 'svgrid:{"field":"spec","header":"Spec","width":220,"fieldType":"url"}';
comment on table "features" is 'svgrid:{"v":1,"name":"Features","position":0,"primaryField":"feature","order":["feature","quarter","status","teams","lead","impact","effort","start","target","votes","requests","requestCount","spec"],"extra":[{"field":"requests","header":"Requests","width":260,"fieldType":"link","fieldProps":{"table":"feedback","multiple":true,"inverse":"feature"}},{"field":"requestCount","header":"Asked by","width":110,"fieldType":"count","fieldProps":{"linkField":"requests"}}],"views":[{"id":"roadmap","name":"Roadmap by quarter","type":"grid","color":{"mode":"field","field":"status"},"state":{"sorting":[{"id":"quarter","desc":false},{"id":"impact","desc":true}],"grouping":["quarter"],"columnWidths":{"feature":280,"quarter":132,"status":130,"teams":180,"lead":160,"impact":130,"effort":120,"start":140,"target":140,"votes":100,"requests":260,"requestCount":110,"spec":220},"columnPinning":{"left":["feature"],"right":[]},"columnOrder":["feature","quarter","status","teams","lead","impact","effort","start","target","votes","requests","requestCount","spec"],"hiddenColumns":[],"globalFilter":"","columnFilters":{},"facetFilters":{}},"rowHeight":40},{"id":"board","name":"Status board","type":"kanban","stackBy":"status"},{"id":"timeline","name":"Timeline","type":"calendar","dateField":"start","endField":"target","color":{"mode":"field","field":"status"}},{"id":"effort","name":"Effort by team","type":"chart","chart":{"kind":"barH","x":"teams","y":"effort"}},{"id":"now","name":"Now","type":"grid","state":{"sorting":[{"id":"target","desc":false}],"advancedFilter":{"kind":"fieldFilter","conjunction":"and","conditions":[{"column":"status","kind":"select","op":"isAnyOf","value":["In progress","In beta","Blocked"]}]}}},{"id":"request","name":"Request a feature","type":"form","formFields":["feature","teams","impact","spec"],"formDescription":"What should we build, and who is it for? Product reviews requests every Friday."}]}';
comment on column "feedback"."request" is 'svgrid:{"field":"request","header":"Request","width":340,"fieldType":"text"}';
comment on column "feedback"."customer" is 'svgrid:{"field":"customer","header":"Customer","width":180,"fieldType":"text"}';
comment on column "feedback"."plan" is 'svgrid:{"field":"plan","header":"Plan","width":120,"fieldType":"singleSelect","fieldProps":{"options":[{"value":"Free","color":"#94a3b8"},{"value":"Team","color":"#2d7ff9"},{"value":"Enterprise","color":"#8b46ff"}]}}';
comment on column "feedback"."feature_id" is 'svgrid:{"field":"feature","header":"Feature","width":240,"fieldType":"link","fieldProps":{"table":"features","multiple":false,"inverse":"requests"}}';
comment on column "feedback"."received" is 'svgrid:{"field":"received","header":"Received","width":150,"fieldType":"date","fieldProps":{"dateFormat":"friendly"}}';
comment on table "feedback" is 'svgrid:{"v":1,"name":"Feedback","position":1,"primaryField":"request","order":["request","customer","plan","feature","received"],"extra":[],"views":[{"id":"all","name":"All feedback","type":"grid","state":{"sorting":[{"id":"received","desc":true}]}},{"id":"by-plan","name":"By plan","type":"kanban","stackBy":"plan"}]}';

insert into "features" ("id", "feature", "quarter", "status", "teams", "lead", "impact", "effort", "start", "target", "votes", "spec") values
  ('1', 'Single sign-on with SAML', 'Q4 2026', 'In progress', array['Web']::text[], 'u2', 1, 2, current_date - 13, current_date + 1, 4, 'https://example.com/specs/1'),
  ('2', 'Offline mode for the mobile app', 'Q4 2026', 'Shipped', array['Mobile', 'Data']::text[], 'u3', 4, 7, current_date - 6, current_date + 11, 41, null),
  ('3', 'Audit log export', 'Q4 2026', 'In beta', array['Platform']::text[], 'u4', 2, 12, current_date + 1, current_date + 21, 78, null),
  ('4', 'Dark mode', 'Q4 2026', 'In progress', array['Data']::text[], 'u7', 5, 5, current_date - 12, current_date + 11, 115, 'https://example.com/specs/4'),
  ('5', 'Bulk edit from the selection bar', 'Q4 2026', 'Blocked', array['Design', 'Mobile']::text[], 'u8', 3, 10, current_date - 5, current_date + 21, 152, null),
  ('6', 'Two-factor recovery codes', 'Q1 2027', 'Planned', array['Web']::text[], 'u2', 1, 3, current_date + 32, current_date + 61, 9, null),
  ('7', 'Usage-based billing', 'Q1 2027', 'In progress', array['Mobile']::text[], 'u3', 4, 8, current_date + 19, current_date + 51, 46, 'https://example.com/specs/7'),
  ('8', 'Public API v2', 'Q1 2027', 'Planned', array['Platform', 'Design']::text[], 'u4', 2, 13, current_date + 26, current_date + 40, 83, null),
  ('9', 'Shared views with permissions', 'Q1 2027', 'Planned', array['Data']::text[], 'u7', 5, 6, current_date + 33, current_date + 50, 120, null),
  ('10', 'In-app onboarding checklist', 'Q1 2027', 'In progress', array['Design']::text[], 'u8', 3, 11, current_date + 20, current_date + 40, 157, 'https://example.com/specs/10'),
  ('11', 'Data retention policies', 'Q2 2027', 'Planned', array['Web', 'Platform']::text[], 'u2', 1, 4, current_date + 57, current_date + 80, 14, null),
  ('12', 'Webhooks with retries', 'Q2 2027', 'Planned', array['Mobile']::text[], 'u3', 4, 9, current_date + 64, current_date + 90, 51, null),
  ('13', 'Comments and mentions', 'Q2 2027', 'Planned', array['Platform']::text[], 'u4', 2, 2, current_date + 51, current_date + 80, 88, 'https://example.com/specs/13'),
  ('14', 'Faster search index', 'Q2 2027', 'Planned', array['Data', 'Web']::text[], 'u7', 5, 7, current_date + 58, current_date + 90, 125, null),
  ('15', 'Custom domains', 'Q2 2027', 'Planned', array['Design']::text[], 'u8', 3, 12, current_date + 65, current_date + 79, 162, null),
  ('16', 'Accessibility audit fixes', 'Later', 'Planned', array['Web']::text[], 'u2', 1, 5, current_date + 82, current_date + 99, 19, 'https://example.com/specs/16'),
  ('17', 'Templates gallery', 'Later', 'Planned', array['Mobile', 'Data']::text[], 'u3', 4, 10, current_date + 89, current_date + 109, 56, null),
  ('18', 'Workspace analytics', 'Later', 'Planned', array['Platform']::text[], 'u4', 2, 3, current_date + 96, current_date + 119, 93, null),
  ('19', 'Slack notifications', 'Later', 'Planned', array['Data']::text[], 'u7', 5, 8, current_date + 83, current_date + 109, 130, 'https://example.com/specs/19'),
  ('20', 'Calendar sync', 'Later', 'Planned', array['Design', 'Mobile']::text[], 'u8', 3, 13, current_date + 90, current_date + 119, 167, null);
insert into "feedback" ("id", "request", "customer", "plan", "feature_id", "received") values
  ('f1', 'We need SAML before security signs off', 'Contoso', 'Enterprise', '1', current_date - 13),
  ('f2', 'Field techs lose signal in basements', 'Northwind Traders', 'Team', '2', current_date - 11),
  ('f3', 'Auditors want a CSV of every change', 'Litware', 'Enterprise', '3', current_date - 9),
  ('f4', 'Please add dark mode, the night shift asks daily', 'Tailspin Toys', 'Free', '4', current_date - 7),
  ('f5', 'Editing 200 rows one by one takes an hour', 'Fabrikam', 'Team', '5', current_date - 5),
  ('f6', 'Bill us by seats used, not seats bought', 'Adventure Works', 'Enterprise', '7', current_date - 3),
  ('f7', 'Our integration needs API v2 webhooks', 'Wide World Importers', 'Enterprise', '8', current_date - 1),
  ('f8', 'Share a view with a client, read-only', 'Proseware', 'Team', '9', current_date + 1),
  ('f9', 'New hires do not know where to start', 'Contoso', 'Team', '10', current_date + 3),
  ('f10', 'Retries on failed webhooks, please', 'Litware', 'Enterprise', '12', current_date + 5),
  ('f11', 'Mention a teammate in a comment', 'Fabrikam', 'Free', '13', current_date + 7),
  ('f12', 'Search is slow on large workspaces', 'Northwind Traders', 'Enterprise', '14', current_date + 9),
  ('f13', 'Dark mode for presentations', 'Proseware', 'Free', '4', current_date + 11),
  ('f14', 'SSO with our Okta setup', 'Litware', 'Enterprise', '1', current_date + 13);

alter table "feedback" add foreign key ("feature_id") references "features"("id") on delete set null;
