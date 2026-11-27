---
'@svgrid/enterprise': patch
---

Base: "Show the critical path" in Customize Gantt (`criticalPath`), Duplicate on an automation (a copy right after it, switched off), the trigger "When a record enters a view" (`recordEntersView`, the view's filter as it is when the record changes), the step "Delete the record" (`deleteRecord`; `server.remove` on the runner's options), and the formula functions `CREATED_TIME()` and `LAST_MODIFIED_TIME()` (the row's `created_at` / `updated_at`, else `createdTime` / `lastModifiedTime`).
