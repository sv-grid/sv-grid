---
"@svgrid/enterprise": patch
---

`createSupabaseDataSource` and `createSupabaseRealtime` now check the license
edition like the other Studio data sources do. They were still on the
edition-blind nudge, so a Grid key that opened the REST or SQL source got the
Suite notice and one that opened the Supabase source did not. The gate is the
same soft one: the source runs either way, a Grid key just gets the watermark
and the one-time notice naming the Suite edition.
