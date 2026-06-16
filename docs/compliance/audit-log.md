# Audit log integration

A typed, tamper-evident audit trail of every user action in the
grid, in under 50 lines. Pattern works for any backend - your
existing audit table, Datadog logs, an immutable ledger (DynamoDB
with conditional writes, AWS QLDB, Kafka), or a write-once S3
bucket.

> Live in [demo 35 (Permissions, audit & history)](https://svgrid.com/#/demos/35-permissions-audit)
> and [demo 49 (Admin dashboard)](https://svgrid.com/#/demos/49-admin-dashboard).

## What's in scope

Every event the grid surfaces:

| Event           | Grid callback                          | Audit record                                              |
| --------------- | -------------------------------------- | --------------------------------------------------------- |
| Cell edit       | `onCellValueChange`                    | `{actor, resource, before, after, ts}`                    |
| Row selection   | `onRowSelectionChange`                 | `{actor, selectedIds, ts}`                                |
| Filter change   | `onFiltersChange`                      | `{actor, filters, ts}`                                    |
| Sort change     | `onSortingChange`                      | `{actor, sort, ts}`                                       |
| Group change    | `onGroupingChange`                     | `{actor, groupBy, ts}`                                    |
| Bulk row delete | wrap `api.removeRows(...)`              | `{actor, deletedIds, ts}`                                 |
| Bulk import     | wrap `api.addRows(...)` after smart-paste | `{actor, addedIds, source: 'paste', ts}`                |
| Export          | wrap `api.exportData(...)`              | `{actor, format, rowCount, columns, ts}`                  |

## Minimal implementation

```svelte
<script lang="ts">
  import { SvGrid, type SvGridApi } from '@svgrid/grid'

  type AuditRecord = {
    actor: string
    action: string
    resource: string
    before?: unknown
    after?: unknown
    ts: string
  }

  async function audit(rec: Omit<AuditRecord, 'ts'>) {
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...rec, ts: new Date().toISOString() }),
    })
  }

  let api = $state<SvGridApi<typeof features, Patient> | null>(null)
</script>

<SvGrid
  {data} {columns} features={features}
  onCellValueChange={(e) => audit({
    actor:    currentUser.id,
    action:   'cell.edit',
    resource: `patient/${e.row.id}/${e.columnId}`,
    before:   e.oldValue,
    after:    e.newValue,
  })}
  onApiReady={(next) => (api = next)}
/>
```

For the `api.removeRows / addRows / exportData` actions, wrap each
imperative call site:

```ts
async function deleteSelected() {
  if (!api) return
  const ids = selectedRows.map((r) => r.id)
  api.removeRows(ids)
  await audit({ actor: currentUser.id, action: 'row.delete', resource: `patient/${ids.join(',')}` })
}
```

## Tamper-evident pattern (SHA-256 chain)

When a "trust but verify" auditor wants to confirm the log wasn't
edited in the database, append the SHA-256 of the previous record to
each new one. Cheap, no extra service needed:

```ts
async function append(rec: AuditRecord) {
  const prev = await fetch('/api/audit/latest-hash').then((r) => r.text())
  const enc  = new TextEncoder()
  const payload = JSON.stringify({ ...rec, prevHash: prev })
  const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(payload))
  const hash    = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  await fetch('/api/audit', {
    method: 'POST',
    body: JSON.stringify({ ...rec, prevHash: prev, hash }),
  })
}
```

Now any audit-log tampering breaks the chain - one Merkle-style
verify scan over the log catches it.

## Buffer + flush pattern (production-grade)

Fire-and-forget HTTP per edit is fine for low-traffic admin apps; for
a heavy editor (spreadsheet-style work) buffer and flush:

```ts
const buf: AuditRecord[] = []
let flushTimer: number | null = null

function buffer(rec: Omit<AuditRecord, 'ts'>) {
  buf.push({ ...rec, ts: new Date().toISOString() })
  if (flushTimer === null) {
    flushTimer = window.setTimeout(flush, 2000)
  }
}

async function flush() {
  flushTimer = null
  if (buf.length === 0) return
  const batch = buf.splice(0)
  try {
    await fetch('/api/audit/batch', { method: 'POST', body: JSON.stringify(batch) })
  } catch {
    buf.unshift(...batch)  // retry next tick
  }
}

window.addEventListener('beforeunload', flush)
```

The `beforeunload` flush is the trick: even if the user closes the
tab mid-session, the buffer ships.

## What an auditor wants to see

When demonstrating the audit trail to an external auditor, the four
demonstrations:

1. **End-to-end edit trace.** Open a row, edit the salary field,
   show the audit record in your backend within 5s.
2. **Tamper detection.** SQL-update a row in the audit table to a
   different value; show that the SHA chain breaks.
3. **Role gating.** Log in as a viewer (no edit rights); attempt to
   edit; show the audit record is `{action: 'edit.denied', reason:
   'rbac'}`.
4. **Retention.** Show your retention policy: "audit records older
   than 7 years are archived to S3 with object-lock; nothing is ever
   deleted."

## See also

- [Observability](../help/observability.md) - the broader callback surface
- [SOC 2 posture](./soc2.md)
- [HIPAA posture](./hipaa.md)
- [Demo 35 - Permissions, audit & history](https://svgrid.com/#/demos/35-permissions-audit)
