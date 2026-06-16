# Conditional form schema

A pattern for declarative field-visibility and editability rules
inside a grid. Instead of writing imperative `if`/`else` checks
across many `cell` callbacks and `editable` props, you declare a
**schema** of `when`-rules per field and the grid evaluates them per
row.

This is the data-entry pattern that procurement / KYC / onboarding
flows usually need: some fields apply only to certain record types,
others lock once the workflow moves past a state. SvGrid's `editable:
(ctx) => boolean` callback supports per-cell rules out of the box;
this recipe layers a small schema on top so the rules live next to
the data, not scattered through the column definitions.

<div data-docs-demo="82-conditional-form-schema" data-height="600"></div>

## The schema shape

A `Rule` is a predicate plus a human-readable reason. A
`FieldSchema` carries up to two rules per field - one for
**visibility** (the cell renders the value or `-`), one for
**editability** (the editor can open).

```ts
type Rule<T> = {
  when: (row: T) => boolean
  reason: string
}
type FieldSchema<T> = {
  visible?:  Rule<T>
  editable?: Rule<T>
}

const schema: Partial<Record<keyof Application, FieldSchema<Application>>> = {
  taxId: {
    visible: { when: (r) => r.recordType === 'business',
               reason: 'Tax ID only applies to businesses.' },
  },
  rejectionReason: {
    visible:  { when: (r) => r.status === 'rejected',
                reason: 'Reason only applies to rejected applications.' },
    editable: { when: (r) => r.status === 'rejected',
                reason: 'Only editable while status is rejected.' },
  },
  contactEmail: {
    editable: { when: (r) => r.status === 'draft' || r.status === 'pending',
                reason: 'Locked once the application is approved or rejected.' },
  },
}
```

Three helper functions translate the schema into runtime decisions:

```ts
function isVisible<T>(schema: Partial<Record<keyof T, FieldSchema<T>>>, field: keyof T, row: T): boolean {
  const s = schema[field]
  return !s?.visible || s.visible.when(row)
}
function isEditable<T>(schema: Partial<Record<keyof T, FieldSchema<T>>>, field: keyof T, row: T): boolean {
  const s = schema[field]
  if (!isVisible(schema, field, row)) return false
  return !s?.editable || s.editable.when(row)
}
function lockReason<T>(schema: Partial<Record<keyof T, FieldSchema<T>>>, field: keyof T, row: T): string | null {
  const s = schema[field]
  if (!s) return null
  if (s.visible  && !s.visible.when(row))  return s.visible.reason
  if (s.editable && !s.editable.when(row)) return s.editable.reason
  return null
}
```

You feed the editability decision into SvGrid's `editable` callback,
and the visibility decision into the cell's `cell` snippet.

## Complete drop-in example

A KYC application list with three record types (individual, business,
nonprofit) and a four-state workflow (draft → pending → approved /
rejected). Every column's visibility and editability comes from the
schema.

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
    type CellContext,
  } from '@svgrid/grid'

  type RecordType = 'individual' | 'business' | 'nonprofit'
  type Status     = 'draft' | 'pending' | 'approved' | 'rejected'

  type Application = {
    id: string
    legalName: string
    recordType: RecordType
    status: Status
    taxId: string
    ein: string
    ssnLast4: string
    contactEmail: string
    rejectionReason: string
  }

  let rows = $state<Application[]>([
    { id: 'A001', legalName: 'Atlas Holdings LLC',  recordType: 'business',   status: 'pending',  taxId: '47-1234567', ein: '',           ssnLast4: '',     contactEmail: 'cfo@atlas.example',  rejectionReason: '' },
    { id: 'A002', legalName: 'Helios Foundation',   recordType: 'nonprofit',  status: 'approved', taxId: '',           ein: '88-7654321', ssnLast4: '',     contactEmail: 'admin@helios.org',   rejectionReason: '' },
    { id: 'A003', legalName: 'Sarah Chen',          recordType: 'individual', status: 'draft',    taxId: '',           ein: '',           ssnLast4: '4421', contactEmail: 'sarah.chen@x.com',    rejectionReason: '' },
    { id: 'A004', legalName: 'Vertex Capital',      recordType: 'business',   status: 'rejected', taxId: '94-9876543', ein: '',           ssnLast4: '',     contactEmail: 'ops@vertex.example', rejectionReason: 'Missing 2024 audit.' },
  ])

  // ---- The schema --------------------------------------------------------
  type Rule = { when: (r: Application) => boolean; reason: string }
  type FieldSchema = { visible?: Rule; editable?: Rule }

  const schema: Partial<Record<keyof Application, FieldSchema>> = {
    taxId:    { visible: { when: (r) => r.recordType === 'business',   reason: 'Tax ID only applies to businesses.' } },
    ein:      { visible: { when: (r) => r.recordType === 'nonprofit',  reason: 'EIN only applies to nonprofits.' } },
    ssnLast4: { visible: { when: (r) => r.recordType === 'individual', reason: 'SSN only applies to individuals.' } },
    rejectionReason: {
      visible:  { when: (r) => r.status === 'rejected', reason: 'Only applies to rejected applications.' },
      editable: { when: (r) => r.status === 'rejected', reason: 'Only editable while status is rejected.' },
    },
    legalName:    { editable: { when: (r) => r.status === 'draft' || r.status === 'pending', reason: 'Locked once approved or rejected.' } },
    contactEmail: { editable: { when: (r) => r.status === 'draft' || r.status === 'pending', reason: 'Locked once approved or rejected.' } },
    recordType:   { editable: { when: (r) => r.status === 'draft',  reason: 'Record type locks at submission.' } },
  }

  function isVisible(field: keyof Application, row: Application): boolean {
    const s = schema[field]
    return !s?.visible || s.visible.when(row)
  }
  function isEditable(field: keyof Application, row: Application): boolean {
    const s = schema[field]
    if (!isVisible(field, row)) return false
    return !s?.editable || s.editable.when(row)
  }
  function lockReason(field: keyof Application, row: Application): string | null {
    const s = schema[field]
    if (!s) return null
    if (s.visible  && !s.visible.when(row))  return s.visible.reason
    if (s.editable && !s.editable.when(row)) return s.editable.reason
    return null
  }

  // ---- Plug into ColumnDef -----------------------------------------------
  const features = tableFeatures({ rowSortingFeature })

  function ruleEditable<K extends keyof Application>(field: K) {
    return (ctx: CellContext<Application>) => isEditable(field, ctx.row.original)
  }

  function condColumn<K extends keyof Application>(
    field: K,
    header: string,
    editorType: ColumnDef<typeof features, Application>['editorType'],
    extra: Partial<ColumnDef<typeof features, Application>> = {},
  ): ColumnDef<typeof features, Application> {
    return {
      field,
      header,
      editorType,
      editable: ruleEditable(field),
      cell: (ctx) => renderSnippet(Cell, { row: ctx.row.original, field }),
      ...extra,
    } as ColumnDef<typeof features, Application>
  }

  const columns: ColumnDef<typeof features, Application>[] = [
    { field: 'id',         header: 'ID',         editorType: 'text', width: 80, editable: false },
    condColumn('legalName',  'Legal name', 'text', { width: 200 }),
    {
      field: 'recordType', header: 'Type',
      editorType: 'list',
      editorOptions: ['individual', 'business', 'nonprofit'] as unknown as ReadonlyArray<string>,
      editable: ruleEditable('recordType'),
      width: 130,
    },
    {
      field: 'status', header: 'Status',
      editorType: 'list',
      editorOptions: ['draft', 'pending', 'approved', 'rejected'] as unknown as ReadonlyArray<string>,
      width: 130,
    },
    condColumn('taxId',           'Tax ID',         'text', { width: 130 }),
    condColumn('ein',             'EIN',            'text', { width: 130 }),
    condColumn('ssnLast4',        'SSN (last 4)',   'text', { width: 110 }),
    condColumn('contactEmail',    'Email',          'text', { width: 200 }),
    condColumn('rejectionReason', 'Reject reason',  'text', { width: 280 }),
  ]
</script>

{#snippet Cell(props: { row: Application; field: keyof Application })}
  {@const visible  = isVisible(props.field, props.row)}
  {@const editable = isEditable(props.field, props.row)}
  {@const reason   = lockReason(props.field, props.row)}
  <span
    title={reason ?? ''}
    style="display: inline-flex; gap: 6px; align-items: center;
           font-style: {visible ? 'normal' : 'italic'};
           color: {visible ? (editable ? 'inherit' : '#64748b') : '#94a3b8'};"
  >
    {visible ? String(props.row[props.field] ?? '') : '-'}
    {#if visible && !editable}
      <span aria-hidden="true">🔒</span>
    {/if}
  </span>
{/snippet}

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  enableInlineEditing={true}
  enableCellSelection={true}
  rowHeight={44}
  containerHeight="100%"
/>
```

## What happens at runtime

Try editing each row in the demo above:

- **A003 (Sarah Chen, draft):** SSN field renders `4421`. EIN and Tax ID
  show `-`. Changing `recordType` to `business` causes Tax ID to start
  rendering and SSN to switch to `-`.
- **A001 (Atlas Holdings, pending):** Tax ID is editable. Setting
  `status` to `approved` locks the email and legal name fields with
  the 🔒 indicator.
- **A004 (Vertex Capital, rejected):** Rejection reason is visible and
  editable. Setting `status` back to `pending` blanks the reason
  visually (still in the data, just hidden).

## Composing more rules

Stack rules per field by AND-ing inside a single `when`:

```ts
{
  field: 'managerApprovalNote',
  editable: {
    when: (r) => r.status === 'pending' && r.amount > 10_000,
    reason: 'Required only when status is pending AND amount > $10,000.',
  },
}
```

For OR semantics, write it directly:

```ts
{
  field: 'taxId',
  visible: {
    when: (r) => r.recordType === 'business' || r.recordType === 'nonprofit',
    reason: 'Tax ID applies to business and nonprofit records.',
  },
}
```

## Patterns that pair well

- **PII masking** - combine schema with `currentUser.role` checks
  (see [Demo 35 - Permissions, audit & history](../../examples/src/demos/35-permissions-audit.svelte))
- **Validation while editing** - schema gates *which* fields can be
  edited; validation gates *which values* commit. See
  [Validation](./editing/validation.md).
- **Mobile card view** - the same schema works inside the card-mode
  edit panel; just import the helpers and skip rendering hidden fields.

## See also

- [Demo 82 - Conditional form schema](../../examples/src/demos/82-conditional-form-schema.svelte) - full enterprise example
- [Edit components](./editing/edit-components.md)
- [Validation](./editing/validation.md)
- [Permissions audit](../../examples/src/demos/35-permissions-audit.svelte) - role-based version of the same pattern
