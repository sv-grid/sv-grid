-- The sales crm template, as Postgres tables. Made by baseToSql (@svgrid/enterprise/base);
-- the svgrid: comments keep what SQL has no type for, so baseFromDatabase opens it as the same base.

create table "deals" (
  "id" text primary key default gen_random_uuid()::text,
  "deal" text,
  "account_id" text,
  "contact_id" text,
  "stage" text,
  "owner" text,
  "value" double precision,
  "probability" double precision,
  "close" date,
  "next_step" text,
  "source" text,
  "priority" double precision
);
create table "accounts" (
  "id" text primary key default gen_random_uuid()::text,
  "name" text,
  "industry" text,
  "employees" double precision,
  "city" text
);
create table "contacts" (
  "id" text primary key default gen_random_uuid()::text,
  "name" text,
  "title" text,
  "account_id" text,
  "email" text,
  "phone" text
);

comment on column "deals"."deal" is 'svgrid:{"id":"deal","field":"deal","header":"Deal","width":280,"fieldType":"text"}';
comment on column "deals"."account_id" is 'svgrid:{"id":"account","field":"account","header":"Account","width":180,"fieldType":"link","fieldProps":{"table":"accounts","multiple":false,"inverse":"deals"}}';
comment on column "deals"."contact_id" is 'svgrid:{"id":"contact","field":"contact","header":"Contact","width":170,"fieldType":"link","fieldProps":{"table":"contacts","multiple":false,"inverse":"deals"}}';
comment on column "deals"."stage" is 'svgrid:{"id":"stage","field":"stage","header":"Stage","width":130,"fieldType":"singleSelect","fieldProps":{"options":[{"value":"Lead","color":"#94a3b8"},{"value":"Qualified","color":"#18bfff"},{"value":"Proposal","color":"#2d7ff9"},{"value":"Negotiation","color":"#fcb400"},{"value":"Won","color":"#20c933"},{"value":"Lost","color":"#f82b60"}]}}';
comment on column "deals"."owner" is 'svgrid:{"id":"owner","field":"owner","header":"Owner","width":160,"fieldType":"user"}';
comment on column "deals"."value" is 'svgrid:{"id":"value","field":"value","header":"Value","width":130,"fieldType":"number","fieldProps":{"format":"currency","symbol":"$","precision":0,"summary":"sum"}}';
comment on column "deals"."probability" is 'svgrid:{"id":"probability","field":"probability","header":"Probability","width":150,"fieldType":"number","fieldProps":{"format":"percent","precision":0,"showBar":true,"summary":"avg"}}';
comment on column "deals"."close" is 'svgrid:{"id":"close","field":"close","header":"Close date","width":160,"fieldType":"date","fieldProps":{"dateFormat":"friendly"}}';
comment on column "deals"."next_step" is 'svgrid:{"id":"nextStep","field":"nextStep","header":"Next step","width":200,"fieldType":"text"}';
comment on column "deals"."source" is 'svgrid:{"id":"source","field":"source","header":"Source","width":120,"fieldType":"singleSelect","fieldProps":{"options":[{"value":"Inbound","color":"#20c933"},{"value":"Referral","color":"#8b46ff"},{"value":"Outbound","color":"#ff6f2c"},{"value":"Event","color":"#18bfff"}]}}';
comment on column "deals"."priority" is 'svgrid:{"id":"priority","field":"priority","header":"Priority","width":120,"fieldType":"rating","fieldProps":{"max":5,"icon":"flag","color":"#f82b60"}}';
comment on table "deals" is 'svgrid:{"v":1,"name":"Deals","position":0,"primaryField":"deal","order":["deal","account","contact","stage","owner","value","probability","close","nextStep","source","priority"],"extra":[],"views":[{"id":"deals","name":"All deals","type":"grid","color":{"mode":"field","field":"stage"},"state":{"sorting":[{"id":"value","desc":true}],"grouping":[],"columnWidths":{"deal":280,"account":180,"contact":170,"stage":130,"owner":160,"value":130,"probability":150,"close":160,"nextStep":200,"source":120,"priority":120},"columnPinning":{"left":["deal"],"right":[]},"columnOrder":["deal","account","contact","stage","owner","value","probability","close","nextStep","source","priority"],"hiddenColumns":[],"globalFilter":"","columnFilters":{},"facetFilters":{}},"rowHeight":40},{"id":"pipeline","name":"Pipeline","type":"kanban","stackBy":"stage"},{"id":"closing","name":"Closing calendar","type":"calendar","dateField":"close","color":{"mode":"field","field":"stage"}},{"id":"by-stage","name":"Pipeline value by stage","type":"chart","chart":{"kind":"bar","x":"stage","y":"value"}},{"id":"open","name":"Open deals by owner","type":"grid","state":{"grouping":["owner"],"sorting":[{"id":"owner","desc":false},{"id":"close","desc":false}],"advancedFilter":{"kind":"fieldFilter","conjunction":"and","conditions":[{"column":"stage","kind":"select","op":"isNoneOf","value":["Won","Lost"]}]}}},{"id":"lead","name":"New lead","type":"form","formFields":["deal","account","contact","owner","value","source","nextStep"],"formDescription":"A lead from a call, an event or a referral. It starts in the Lead stage."}]}';
comment on column "accounts"."name" is 'svgrid:{"id":"name","field":"name","header":"Account","width":220,"fieldType":"text"}';
comment on column "accounts"."industry" is 'svgrid:{"id":"industry","field":"industry","header":"Industry","width":150,"fieldType":"singleSelect","fieldProps":{"options":[{"value":"Wholesale","color":"#ff6f2c"},{"value":"Manufacturing","color":"#2d7ff9"},{"value":"Software","color":"#8b46ff"},{"value":"Retail","color":"#fcb400"},{"value":"Logistics","color":"#18bfff"},{"value":"Healthcare","color":"#20c933"},{"value":"Education","color":"#f82b60"}]}}';
comment on column "accounts"."employees" is 'svgrid:{"id":"employees","field":"employees","header":"Employees","width":120,"fieldType":"number","fieldProps":{"format":"integer"}}';
comment on column "accounts"."city" is 'svgrid:{"id":"city","field":"city","header":"City","width":130,"fieldType":"text"}';
comment on table "accounts" is 'svgrid:{"v":1,"name":"Accounts","position":1,"primaryField":"name","order":["name","industry","deals","pipeline","dealCount","contacts","employees","city"],"extra":[{"id":"deals","field":"deals","header":"Deals","width":260,"fieldType":"link","fieldProps":{"table":"deals","multiple":true,"inverse":"account"}},{"id":"pipeline","field":"pipeline","header":"Pipeline value","width":170,"fieldType":"rollup","fieldProps":{"linkField":"deals","field":"value","aggregation":"SUM"}},{"id":"dealCount","field":"dealCount","header":"Deal count","width":120,"fieldType":"count","fieldProps":{"linkField":"deals"}},{"id":"contacts","field":"contacts","header":"Contacts","width":220,"fieldType":"link","fieldProps":{"table":"contacts","multiple":true,"inverse":"account"}}],"views":[{"id":"accounts","name":"All accounts","type":"grid","state":{"sorting":[{"id":"name","desc":false}]}},{"id":"by-industry","name":"By industry","type":"kanban","stackBy":"industry"}]}';
comment on column "contacts"."name" is 'svgrid:{"id":"name","field":"name","header":"Name","width":190,"fieldType":"text"}';
comment on column "contacts"."title" is 'svgrid:{"id":"title","field":"title","header":"Title","width":190,"fieldType":"text"}';
comment on column "contacts"."account_id" is 'svgrid:{"id":"account","field":"account","header":"Account","width":180,"fieldType":"link","fieldProps":{"table":"accounts","multiple":false,"inverse":"contacts"}}';
comment on column "contacts"."email" is 'svgrid:{"id":"email","field":"email","header":"Email","width":260,"fieldType":"email"}';
comment on column "contacts"."phone" is 'svgrid:{"id":"phone","field":"phone","header":"Phone","width":150,"fieldType":"phone"}';
comment on table "contacts" is 'svgrid:{"v":1,"name":"Contacts","position":2,"primaryField":"name","order":["name","title","account","deals","email","phone"],"extra":[{"id":"deals","field":"deals","header":"Deals","width":260,"fieldType":"link","fieldProps":{"table":"deals","multiple":true,"inverse":"contact"}}],"views":[{"id":"contacts","name":"All contacts","type":"grid"},{"id":"add","name":"Add a contact","type":"form","formFields":["name","title","account","email","phone"]}]}';

insert into "deals" ("id", "deal", "account_id", "contact_id", "stage", "owner", "value", "probability", "close", "next_step", "source", "priority") values
  ('d1', 'Northwind Traders: Platform license', 'a1', 'c1', 'Lead', 'u1', 8000, 0.1, current_date - 8, 'Send proposal', 'Inbound', 1),
  ('d2', 'Contoso: Team plan', 'a2', 'c4', 'Qualified', 'u2', 141500, 0.25, current_date - 5, 'Book a demo', 'Referral', 4),
  ('d3', 'Fabrikam: Renewal', 'a3', 'c5', 'Proposal', 'u4', 140000, 0.5, current_date - 2, 'Security review', 'Outbound', 2),
  ('d4', 'Adventure Works: Expansion', 'a4', 'c8', 'Negotiation', 'u7', 138500, 0.75, current_date + 1, 'Pricing call', 'Event', 5),
  ('d5', 'Tailspin Toys: Pilot', 'a5', 'c9', 'Won', 'u1', 137000, 1, current_date + 4, null, 'Inbound', 3),
  ('d6', 'Wide World Importers: Enterprise plan', 'a6', 'c12', 'Proposal', 'u2', 135500, 0.5, current_date + 7, 'Kickoff scheduled', 'Referral', 1),
  ('d7', 'Litware: Platform license', 'a7', 'c13', 'Qualified', 'u4', 134000, 0.25, current_date + 10, 'Follow up next quarter', 'Outbound', 4),
  ('d8', 'Proseware: Team plan', 'a8', 'c16', 'Negotiation', 'u7', 132500, 0.75, current_date + 13, 'Send proposal', 'Event', 2),
  ('d9', 'Northwind Traders: Team plan', 'a1', 'c1', 'Lead', 'u1', 131000, 0.1, current_date + 16, 'Book a demo', 'Inbound', 5),
  ('d10', 'Contoso: Renewal', 'a2', 'c4', 'Lost', 'u2', 129500, 0, current_date + 19, null, 'Referral', 3),
  ('d11', 'Fabrikam: Expansion', 'a3', 'c5', 'Proposal', 'u4', 128000, 0.5, current_date + 22, 'Pricing call', 'Outbound', 1),
  ('d12', 'Adventure Works: Pilot', 'a4', 'c8', 'Won', 'u7', 126500, 1, current_date + 25, null, 'Event', 4),
  ('d13', 'Tailspin Toys: Enterprise plan', 'a5', 'c9', 'Qualified', 'u1', 125000, 0.25, current_date + 28, 'Kickoff scheduled', 'Inbound', 2),
  ('d14', 'Wide World Importers: Platform license', 'a6', 'c12', 'Negotiation', 'u2', 123500, 0.75, current_date + 31, 'Follow up next quarter', 'Referral', 5),
  ('d15', 'Litware: Team plan', 'a7', 'c13', 'Proposal', 'u4', 122000, 0.5, current_date + 34, 'Send proposal', 'Outbound', 3),
  ('d16', 'Proseware: Renewal', 'a8', 'c16', 'Lead', 'u7', 120500, 0.1, current_date + 37, 'Book a demo', 'Event', 1),
  ('d17', 'Northwind Traders: Renewal', 'a1', 'c1', 'Won', 'u1', 119000, 1, current_date + 40, null, 'Inbound', 4),
  ('d18', 'Contoso: Expansion', 'a2', 'c4', 'Negotiation', 'u2', 117500, 0.75, current_date - 7, 'Pricing call', 'Referral', 2),
  ('d19', 'Fabrikam: Pilot', 'a3', 'c5', 'Qualified', 'u4', 116000, 0.25, current_date - 4, 'Legal redlines', 'Outbound', 5),
  ('d20', 'Adventure Works: Enterprise plan', 'a4', 'c8', 'Proposal', 'u7', 114500, 0.5, current_date - 1, 'Kickoff scheduled', 'Event', 3),
  ('d21', 'Tailspin Toys: Platform license', 'a5', 'c9', 'Lost', 'u1', 113000, 0, current_date + 2, null, 'Inbound', 1),
  ('d22', 'Wide World Importers: Team plan', 'a6', 'c12', 'Negotiation', 'u2', 111500, 0.75, current_date + 5, 'Send proposal', 'Referral', 4),
  ('d23', 'Litware: Renewal', 'a7', 'c13', 'Proposal', 'u4', 110000, 0.5, current_date + 8, 'Book a demo', 'Outbound', 2),
  ('d24', 'Proseware: Expansion', 'a8', 'c16', 'Qualified', 'u7', 108500, 0.25, current_date + 11, 'Security review', 'Event', 5),
  ('d25', 'Northwind Traders: Expansion', 'a1', 'c1', 'Won', 'u1', 107000, 1, current_date + 14, null, 'Inbound', 3),
  ('d26', 'Contoso: Pilot', 'a2', 'c4', 'Lead', 'u2', 105500, 0.1, current_date + 17, 'Legal redlines', 'Referral', 1),
  ('d27', 'Fabrikam: Enterprise plan', 'a3', 'c5', 'Proposal', 'u4', 104000, 0.5, current_date + 20, 'Kickoff scheduled', 'Outbound', 4),
  ('d28', 'Adventure Works: Platform license', 'a4', 'c8', 'Negotiation', 'u7', 102500, 0.75, current_date + 23, 'Follow up next quarter', 'Event', 2),
  ('d29', 'Tailspin Toys: Team plan', 'a5', 'c9', 'Qualified', 'u1', 101000, 0.25, current_date + 26, 'Send proposal', 'Inbound', 5),
  ('d30', 'Wide World Importers: Renewal', 'a6', 'c12', 'Proposal', 'u2', 99500, 0.5, current_date + 29, 'Book a demo', 'Referral', 3);
insert into "accounts" ("id", "name", "industry", "employees", "city") values
  ('a1', 'Northwind Traders', 'Wholesale', 420, 'Seattle'),
  ('a2', 'Contoso', 'Manufacturing', 2600, 'Chicago'),
  ('a3', 'Fabrikam', 'Software', 880, 'Austin'),
  ('a4', 'Adventure Works', 'Retail', 310, 'Denver'),
  ('a5', 'Tailspin Toys', 'Retail', 140, 'Portland'),
  ('a6', 'Wide World Importers', 'Logistics', 1200, 'Rotterdam'),
  ('a7', 'Litware', 'Healthcare', 560, 'Boston'),
  ('a8', 'Proseware', 'Education', 95, 'Dublin');
insert into "contacts" ("id", "name", "title", "account_id", "email", "phone") values
  ('c1', 'Maya Lindqvist', 'Head of Operations', 'a1', 'maya.lindqvist@northwindtraders.example.com', '+1 555 0110'),
  ('c2', 'Tom Becker', 'Procurement lead', 'a1', 'tom.becker@northwindtraders.example.com', '+1 555 0111'),
  ('c3', 'Priya Raman', 'CFO', 'a2', 'priya.raman@contoso.example.com', '+1 555 0112'),
  ('c4', 'Luis Ortega', 'IT director', 'a2', 'luis.ortega@contoso.example.com', '+1 555 0113'),
  ('c5', 'Grace Kim', 'VP Engineering', 'a3', 'grace.kim@fabrikam.example.com', '+1 555 0114'),
  ('c6', 'Owen Price', 'Platform lead', 'a3', 'owen.price@fabrikam.example.com', '+1 555 0115'),
  ('c7', 'Sofia Rossi', 'COO', 'a4', 'sofia.rossi@adventureworks.example.com', '+1 555 0116'),
  ('c8', 'Ken Watanabe', 'Store systems', 'a4', 'ken.watanabe@adventureworks.example.com', '+1 555 0117'),
  ('c9', 'Nora Ali', 'Founder', 'a5', 'nora.ali@tailspintoys.example.com', '+1 555 0118'),
  ('c10', 'Jack Moran', 'Head of Product', 'a5', 'jack.moran@tailspintoys.example.com', '+1 555 0119'),
  ('c11', 'Eva Novak', 'Supply chain director', 'a6', 'eva.novak@wideworldimporters.example.com', '+1 555 0120'),
  ('c12', 'Ravi Menon', 'Finance manager', 'a6', 'ravi.menon@wideworldimporters.example.com', '+1 555 0121'),
  ('c13', 'Hannah Cole', 'CIO', 'a7', 'hannah.cole@litware.example.com', '+1 555 0122'),
  ('c14', 'Marco Bianchi', 'Clinical systems', 'a7', 'marco.bianchi@litware.example.com', '+1 555 0123'),
  ('c15', 'Ines Duarte', 'Head of IT', 'a8', 'ines.duarte@proseware.example.com', '+1 555 0124'),
  ('c16', 'Leo Hart', 'Dean of Operations', 'a8', 'leo.hart@proseware.example.com', '+1 555 0125');

alter table "deals" add foreign key ("account_id") references "accounts"("id") on delete set null;
alter table "deals" add foreign key ("contact_id") references "contacts"("id") on delete set null;
alter table "contacts" add foreign key ("account_id") references "accounts"("id") on delete set null;
