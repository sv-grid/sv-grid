-- The okrs template, as Postgres tables. Made by baseToSql (@svgrid/enterprise/base);
-- the svgrid: comments keep what SQL has no type for, so baseFromDatabase opens it as the same base.

create table "key_results" (
  "id" text primary key default gen_random_uuid()::text,
  "svgrid_order" bigint generated always as identity,
  "kr" text,
  "objective_id" text,
  "confidence" text,
  "start" double precision,
  "current" double precision,
  "target" double precision,
  "unit" text,
  "updated" date
);
create table "objectives" (
  "id" text primary key default gen_random_uuid()::text,
  "svgrid_order" bigint generated always as identity,
  "objective" text,
  "quarter" text,
  "owner" text
);

comment on column "key_results"."kr" is 'svgrid:{"field":"kr","header":"Key result","width":300,"fieldType":"text"}';
comment on column "key_results"."objective_id" is 'svgrid:{"field":"objective","header":"Objective","width":240,"fieldType":"link","fieldProps":{"table":"objectives","multiple":false,"inverse":"krs"}}';
comment on column "key_results"."confidence" is 'svgrid:{"field":"confidence","header":"Confidence","width":130,"fieldType":"singleSelect","fieldProps":{"options":[{"value":"On track","color":"#20c933"},{"value":"At risk","color":"#fcb400"},{"value":"Off track","color":"#f82b60"},{"value":"Achieved","color":"#2d7ff9"}]}}';
comment on column "key_results"."start" is 'svgrid:{"field":"start","header":"Start","width":90,"fieldType":"number","fieldProps":{"format":"decimal","precision":1}}';
comment on column "key_results"."current" is 'svgrid:{"field":"current","header":"Current","width":100,"fieldType":"number","fieldProps":{"format":"decimal","precision":1}}';
comment on column "key_results"."target" is 'svgrid:{"field":"target","header":"Target","width":90,"fieldType":"number","fieldProps":{"format":"decimal","precision":1}}';
comment on column "key_results"."unit" is 'svgrid:{"field":"unit","header":"Unit","width":100,"fieldType":"text"}';
comment on column "key_results"."updated" is 'svgrid:{"field":"updated","header":"Checked in","width":150,"fieldType":"date","fieldProps":{"dateFormat":"friendly"}}';
comment on table "key_results" is 'svgrid:{"v":1,"name":"Key results","position":0,"primaryField":"kr","order":["kr","objective","progress","confidence","start","current","target","unit","updated"],"extra":[{"field":"progress","header":"Progress","width":160,"fieldType":"formula","fieldProps":{"formula":"MAX(0, MIN(1, ({Current} - {Start}) / ({Target} - {Start})))","result":"percent","precision":0}}],"views":[{"id":"by-objective","name":"By objective","type":"grid","color":{"mode":"field","field":"confidence"},"state":{"sorting":[],"grouping":["objective"],"columnWidths":{"kr":300,"objective":240,"progress":160,"confidence":130,"start":90,"current":100,"target":90,"unit":100,"updated":150},"columnPinning":{"left":["kr"],"right":[]},"columnOrder":["kr","objective","progress","confidence","start","current","target","unit","updated"],"hiddenColumns":[],"globalFilter":"","columnFilters":{},"facetFilters":{}},"rowHeight":40},{"id":"board","name":"Confidence","type":"kanban","stackBy":"confidence"},{"id":"checkin","name":"Weekly check-in","type":"grid","state":{"hiddenColumns":["objective","start","unit"],"sorting":[{"id":"updated","desc":false}]}}],"automations":[{"id":"off-track","name":"Off track","enabled":true,"trigger":{"type":"recordMatches"},"condition":{"kind":"fieldFilter","conjunction":"and","conditions":[{"column":"confidence","kind":"select","op":"is","value":"Off track"}]},"actions":[{"type":"highlight","background":"#fee2e2","color":"#991b1b"},{"type":"notify","message":"{Key result} is off track ({Objective})","severity":"error"}]},{"id":"achieved","name":"Target reached","enabled":true,"trigger":{"type":"recordMatches"},"condition":{"kind":"fieldFilter","conjunction":"and","conditions":[{"column":"progress","kind":"number","op":"gte","value":1}]},"actions":[{"type":"updateRecord","values":{"confidence":"Achieved","updated":"today"}},{"type":"notify","message":"Achieved: {Key result}","severity":"success"}]}]}';
comment on column "objectives"."objective" is 'svgrid:{"field":"objective","header":"Objective","width":300,"fieldType":"text"}';
comment on column "objectives"."quarter" is 'svgrid:{"field":"quarter","header":"Quarter","width":130,"fieldType":"singleSelect","fieldProps":{"options":[{"value":"Q3","color":"#94a3b8"},{"value":"Q4","color":"#2d7ff9"},{"value":"Q1 next year","color":"#8b46ff"}]}}';
comment on column "objectives"."owner" is 'svgrid:{"field":"owner","header":"Owner","width":160,"fieldType":"user"}';
comment on table "objectives" is 'svgrid:{"v":1,"name":"Objectives","position":1,"primaryField":"objective","order":["objective","quarter","owner","krs","progress"],"extra":[{"field":"krs","header":"Key results","width":320,"fieldType":"link","fieldProps":{"table":"key_results","multiple":true,"inverse":"objective"}},{"field":"progress","header":"Progress","width":140,"fieldType":"rollup","fieldProps":{"linkField":"krs","field":"progress","aggregation":"AVERAGE"}}],"views":[{"id":"all","name":"All objectives","type":"grid","state":{"grouping":["quarter"]}},{"id":"chart","name":"Progress by objective","type":"chart","chart":{"kind":"barH","x":"objective","y":"progress","aggregation":"avg"}}]}';

insert into "key_results" ("id", "kr", "objective_id", "confidence", "start", "current", "target", "unit", "updated") values
  ('k1', 'Time to first value under 10 minutes', 'o1', 'On track', 34, 18, 10, 'minutes', current_date - 2),
  ('k2', 'Activation rate to 60%', 'o1', 'At risk', 41, 47, 60, '%', current_date - 4),
  ('k3', 'Support tickets per new account to 0.5', 'o1', 'Off track', 1.8, 1.6, 0.5, 'tickets', current_date - 6),
  ('k4', 'Net revenue retention to 115%', 'o2', 'On track', 104, 109, 115, '%', current_date - 1),
  ('k5', 'Upgrade 40 accounts to the annual plan', 'o2', 'On track', 0, 26, 40, 'accounts', current_date - 3),
  ('k6', 'Page load (p75) under 1.2 s', 'o3', 'At risk', 2.4, 1.5, 1.2, 'seconds', current_date - 2),
  ('k7', 'Crash-free sessions to 99.8%', 'o3', 'Achieved', 99.1, 99.8, 99.8, '%', current_date - 5),
  ('k8', 'Hire 6 engineers', 'o4', 'On track', 0, 5, 6, 'people', current_date - 9),
  ('k9', 'Engagement score to 80', 'o4', 'At risk', 71, 74, 80, 'points', current_date - 12);
insert into "objectives" ("id", "objective", "quarter", "owner") values
  ('o1', 'Make onboarding effortless', 'Q4', 'u1'),
  ('o2', 'Grow revenue from existing customers', 'Q4', 'u2'),
  ('o3', 'Ship a faster product', 'Q4', 'u3'),
  ('o4', 'Build a team people want to join', 'Q3', 'u4');

alter table "key_results" add foreign key ("objective_id") references "objectives"("id") on delete set null;
