# Audit trail

An audit trail records **who changed what, and when** - a baseline requirement
for any regulated or multi-user app. Studio records writes **server-side**, at
the API route, so the trail can't be skipped by a tampered client, and ships an
**Audit log** viewer screen.

![Writes are recorded server-side at the generated API route, capturing who, what, and when into an append-only audit log surfaced by an Audit log viewer screen.](/docs-media/studio-audit.svg)

## Turn it on

In the [visual designer](./app-designer.md), open the inspector with no block
selected and expand **Audit trail** > **Record create / update / delete**. Because
auditing happens at the API route, at least one entity must be bound to a **SQL**
[data source](./databases.md) (in-memory entities mutate in the browser, with no
server route to record). The flag also lives on the project model:

```ts
const project = { /* ... */, audit: true }
```

## What gets generated

- **`src/lib/audit.ts`** - the `AuditEntry` schema, an in-memory `auditSource`,
  and `recordAudit()`. It's in-memory by default (resets on restart); swap the
  source for a SQL / Supabase one to persist the trail - `recordAudit` and the
  viewer keep working unchanged.
- **Each connected route** passes an `audit` hook to `createKitHandlers` that
  calls `recordAudit` after every successful write, tagging the entity, the
  record id, the changed fields, and the **actor** (from `event.locals.role` /
  `.user`).
- **`/audit`** - a read-only grid viewer, added to the nav, reading the trail
  through **`/api/audit`**.

```ts
// generated into each connected route
export const { POST } = createKitHandlers({
  schema: ordersSchema,
  source,
  validate: true,
  audit: (e) => recordAudit({
    entity: 'orders', action: e.action, recordId: e.id,
    values: e.values, actor: String(e.event.locals?.role ?? 'system'),
  }),
})
```

## The `audit` hook (hand-written apps too)

Like RBAC's `authorize`, `audit` is a `createKitHandlers` option you can use
directly. It runs **after** a successful create / update / delete with the
change details, and is **best-effort** - a throw is logged, never failing the
write it records:

```ts
import { createKitHandlers } from '@svgrid/enterprise'

export const { POST } = createKitHandlers({
  schema: orderSchema,
  source,
  audit: async ({ action, id, values, result, event }) => {
    await db.insert('audit', {
      at: new Date().toISOString(),
      actor: event.locals?.user ?? 'system',
      entity: 'orders', action, recordId: id,
      changed: values && Object.keys(values),
    })
  },
})
```

`action` is `'create' | 'update' | 'delete'`, `id` is the affected row, `values`
is the create input / update patch, and `result` is the row the source returned.

## Persisting the trail

The generated store is in-memory so the demo runs with zero setup. For
production, point it at a table - the audit entries are just another entity:

```ts
// src/lib/audit.ts
export const auditSource = createSqlDataSource<AuditEntry>({
  schema: auditSchema, table: 'audit', execute,
})
```

Now the trail survives restarts and is queryable like any other table, and the
`/audit` viewer shows it unchanged.

## See also

- [Access control (RBAC)](./access-control.md) - the `authorize` guard on the same route
- [Business logic](./business-logic.md) - server-enforced validation on the same route
- [Databases](./databases.md) - persist the trail in SQL / Supabase
