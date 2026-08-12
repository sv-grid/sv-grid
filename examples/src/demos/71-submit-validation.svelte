<script lang="ts">
  /**
   * 71. Submit-time validation
   * --------------------------
   * Different from per-keystroke validation (demo 24). Here the user
   * edits freely and clicks "Submit" - the grid then runs a row-level
   * validator. Invalid rows are highlighted and listed in an errors
   * panel; the form blocks submission until every row passes.
   *
   * Pattern: keep a `pending` map of unresolved edits; on Submit, run
   * the validator against the in-memory rows, derive `errors`, and only
   * push the payload to "the server" when `errors.length === 0`.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  type Lead = {
    id: string
    company: string
    email: string
    phone: string
    revenue: number
    status: 'new' | 'contacted' | 'qualified'
  }

  let rows = $state<Lead[]>([
    { id: 'L-001', company: 'Acme Corp',  email: 'sales@acme.io',     phone: '+1 555 0101', revenue: 250_000,  status: 'new' },
    { id: 'L-002', company: '',            email: 'tim@globex',         phone: '5551111',     revenue: 0,        status: 'new' },
    { id: 'L-003', company: 'Initech',    email: 'peter@initech.com',  phone: '+1 555 4488', revenue: -100,     status: 'contacted' },
    { id: 'L-004', company: 'Umbrella',   email: 'jill',               phone: '+44 20 7000', revenue: 1_400_000,status: 'qualified' },
    { id: 'L-005', company: 'Stark Inc.', email: 'tony@stark.com',     phone: '+1 555 7777', revenue: 9_900_000,status: 'qualified' },
  ])

  type Issue = { rowId: string; rowIndex: number; field: keyof Lead; message: string }
  let errors = $state<Issue[]>([])
  let submitted = $state<string | null>(null)

  /** Row-level rules. Return one Issue per failed field. */
  function validate(row: Lead, ix: number): Issue[] {
    const out: Issue[] = []
    if (!row.company.trim())
      out.push({ rowId: row.id, rowIndex: ix, field: 'company', message: 'Company is required' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
      out.push({ rowId: row.id, rowIndex: ix, field: 'email',   message: 'Email is malformed' })
    if (row.phone.replace(/\D/g, '').length < 7)
      out.push({ rowId: row.id, rowIndex: ix, field: 'phone',   message: 'Phone needs at least 7 digits' })
    if (!Number.isFinite(row.revenue) || row.revenue < 0)
      out.push({ rowId: row.id, rowIndex: ix, field: 'revenue', message: 'Revenue cannot be negative' })
    return out
  }

  function submit() {
    submitted = null
    const all: Issue[] = []
    rows.forEach((r, i) => all.push(...validate(r, i)))
    errors = all
    if (all.length === 0) {
      submitted = `Submitted ${rows.length} leads successfully at ${new Date().toLocaleTimeString()}`
    }
  }
  function reset() { errors = []; submitted = null }

  const errorsByRowId = $derived(() => {
    const m = new Map<string, Set<string>>()
    for (const e of errors) {
      if (!m.has(e.rowId)) m.set(e.rowId, new Set())
      m.get(e.rowId)!.add(e.field as string)
    }
    return m
  })

  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Lead>[] = [
    { field: 'id',      header: 'Lead',    editorType: 'text', width: 90 },
    {
      field: 'company', header: 'Company', editorType: 'text', width: 180,
      cellClass: (ctx) =>
        errorsByRowId().get(ctx.row.original.id)?.has('company') ? 'cell-invalid' : '',
    },
    {
      field: 'email',   header: 'Email',   editorType: 'text', width: 200,
      cellClass: (ctx) =>
        errorsByRowId().get(ctx.row.original.id)?.has('email')   ? 'cell-invalid' : '',
    },
    {
      field: 'phone',   header: 'Phone',   editorType: 'text', width: 150,
      cellClass: (ctx) =>
        errorsByRowId().get(ctx.row.original.id)?.has('phone')   ? 'cell-invalid' : '',
    },
    {
      field: 'revenue', header: 'Revenue', editorType: 'number', width: 160,
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
      cellClass: (ctx) =>
        errorsByRowId().get(ctx.row.original.id)?.has('revenue') ? 'cell-invalid' : '',
    },
    { field: 'status', header: 'Status', editorType: 'list', width: 140,
      editorOptions: ['new', 'contacted', 'qualified'] },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-2 text-sm shrink-0">
    <button type="button" onclick={submit}
      class="sv-btn-primary rounded-md px-3 py-1.5 font-medium"
      >Submit all leads</button>
    <button type="button" onclick={reset}
      class="sv-btn rounded-md px-3 py-1.5"
      >Clear errors</button>
    {#if submitted}
      <span class="text-emerald-600 dark:text-emerald-400 text-xs">✓ {submitted}</span>
    {/if}
  </div>

  {#if errors.length > 0}
    <div role="alert" aria-live="polite"
      class="rounded-md border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30 px-3 py-2 text-sm shrink-0">
      <div class="font-medium text-rose-700 dark:text-rose-300 mb-1">
        Fix {errors.length} issue{errors.length === 1 ? '' : 's'} before submitting:
      </div>
      <ul class="list-disc list-inside text-rose-700/90 dark:text-rose-300/90 max-h-28 overflow-auto">
        {#each errors as e (`${e.rowId}-${e.field}`)}
          <li>
            <code>{e.rowId}</code>
            <span class="sv-sep">·</span>
            <strong>{e.field}</strong>: {e.message}
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="none"
      selectionMode="cell"
      showRowNumbers={false}
      showPagination={false}
      enableInlineEditing={true}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>

<style>
  /* Toolbar chrome tracks the grid theme; the rose invalid-cell tint below
     is a validation signal, so it stays fixed. */
  .sv-btn-primary {
    border: 1px solid var(--sg-accent, #4f46e5);
    background: var(--sg-accent, #4f46e5);
    color: var(--sg-on-accent, #fff);
  }
  .sv-btn-primary:hover { filter: brightness(1.08); }
  .sv-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
  }
  .sv-btn:hover { background: var(--sg-row-hover-bg, #f8fafc); }
  .sv-sep { color: var(--sg-muted, #64748b); }

  :global(td.cell-invalid) {
    background: rgba(244, 63, 94, 0.12);
    box-shadow: inset 0 0 0 1px #f43f5e;
  }
</style>
