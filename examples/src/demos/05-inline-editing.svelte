<script lang="ts">
  /**
   * 05. Inline editing
   * ------------------
   * Typed editors per column with a professional save/reset workflow.
   * Department uses a list dropdown; Country uses a list with the seed's
   * country codes; status is a list of three values. Edits are tracked
   * locally (dirty markers) and applied on "Save".
   *
   * What this demo shows:
   *   - Per-column `editorType` selection - text / number / date / list /
   *     checkbox - plus formatted display values.
   *   - Live dirty-cell + dirty-row counts surfaced in a KPI strip.
   *   - Save / Reset controls disabled until something changes; clicking
   *     Save persists the edits into the local "server" snapshot so the
   *     dirty markers clear and Reset goes back to the last save point.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-community'
  import { makePeople, type Person, type Status } from '../shared/seed'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
  })

  // Realistic enterprise rows. The seed already produces enough variety
  // (countries, departments, statuses) that the dropdown editors all
  // have natural options to land on.
  const DEPARTMENTS = ['Engineering', 'Design', 'Product', 'Sales', 'Support', 'Operations'] as const
  const COUNTRIES   = ['US', 'UK', 'DE', 'FR', 'JP', 'BR', 'IN', 'AU', 'CA', 'NL'] as const
  const STATUSES: Status[] = ['active', 'pending', 'inactive']

  // One brand color per department / status. The list editor turns these into
  // colored chips in its dropdown, and the cell renders the same chip - so the
  // value looks identical whether you're viewing or picking it.
  const DEPT_COLOR: Record<string, string> = {
    Engineering: '#3b82f6', Design: '#ec4899', Product: '#6366f1',
    Sales: '#22c55e', Support: '#f59e0b', Operations: '#8b5cf6',
  }
  const STATUS_COLOR: Record<Status, string> = {
    active: '#22c55e', pending: '#f59e0b', inactive: '#94a3b8',
  }

  /** Soft, theme-aware pill style derived from one base color. Mirrors the
   *  grid's own colored-chip helper so cell + dropdown chips match exactly. */
  function chipStyle(color: string): string {
    return (
      `background: color-mix(in srgb, ${color} 22%, transparent);` +
      `border: 1px solid color-mix(in srgb, ${color} 45%, transparent);` +
      `color: color-mix(in srgb, ${color} 80%, var(--sg-fg, #0f172a));`
    )
  }

  let rows = $state<Person[]>(makePeople(40))
  let api = $state<SvGridApi<typeof features, Person> | null>(null)
  let dirty = $state<Record<string, true>>({})

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName', header: 'First name', editorType: 'text', width: 140 },
    { field: 'lastName',  header: 'Last name',  editorType: 'text', width: 140 },
    {
      field: 'department', header: 'Department',
      editorType: 'list',
      editorOptions: DEPARTMENTS.map((d) => ({ value: d, color: DEPT_COLOR[d] })),
      width: 150,
      cell: (ctx) => renderSnippet(DeptCell, { row: ctx.row.original }),
    },
    {
      field: 'country', header: 'Country',
      editorType: 'list',
      editorOptions: COUNTRIES as unknown as ReadonlyArray<string>,
      width: 110,
    },
    {
      field: 'status', header: 'Status',
      editorType: 'list',
      editorOptions: [
        { value: 'active',   label: 'Active',   color: STATUS_COLOR.active },
        { value: 'pending',  label: 'Pending',  color: STATUS_COLOR.pending },
        { value: 'inactive', label: 'Inactive', color: STATUS_COLOR.inactive },
      ],
      width: 130,
      cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }),
    },
    { field: 'age', header: 'Age', editorType: 'number', width: 90 },
    {
      field: 'salary', header: 'Salary',
      editorType: 'number',
      width: 140,
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
    {
      field: 'joinedAt', header: 'Joined',
      editorType: 'date',
      width: 130,
      format: { type: 'date', pattern: 'y-m-d' },
    },
    { field: 'active', header: 'Active', editorType: 'checkbox', width: 90 },
  ]

  // svelte-ignore state_referenced_locally
  let initial = rows.map((r) => ({ ...r }))

  function reset() {
    rows = initial.map((r) => ({ ...r }))
    dirty = {}
  }

  function save() {
    initial = rows.map((r) => ({ ...r }))
    dirty = {}
    // In a real app: persist `rows` to the server here.
  }

  // The wrapper applies edits to its internal copy. We mirror them into `rows`
  // by reading through the imperative API after each store change.
  let lastSyncedSerialized = ''
  $effect(() => {
    if (!api) return
    const snapshot = api.getData() as ReadonlyArray<Person>
    const serialized = JSON.stringify(snapshot)
    if (serialized === lastSyncedSerialized) return
    lastSyncedSerialized = serialized
    const next: Record<string, true> = {}
    for (let i = 0; i < snapshot.length; i++) {
      const a = snapshot[i]!
      const b = initial[i]
      if (!b) continue
      for (const key of Object.keys(a) as Array<keyof Person>) {
        if (a[key] !== b[key]) next[`${a.id}.${key}`] = true
      }
    }
    dirty = next
    rows = snapshot.map((r) => ({ ...r }))
  })

  const dirtyCount = $derived(Object.keys(dirty).length)
  const dirtyRows  = $derived(new Set(Object.keys(dirty).map((k) => k.split('.')[0]!)).size)
  const activeCount = $derived(rows.filter((r) => r.status === 'active').length)
  const totalSalary = $derived(rows.reduce((s, r) => s + r.salary, 0))
  const fmtMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const STATUS_LABEL: Record<Status, string> = { active: 'Active', pending: 'Pending', inactive: 'Inactive' }
</script>

{#snippet DeptCell(props: { row: Person })}
  <span class="ie-dept" style={chipStyle(DEPT_COLOR[props.row.department] ?? '#64748b')}>
    {props.row.department}
  </span>
{/snippet}

{#snippet StatusCell(props: { row: Person })}
  <span class={`ie-status ie-status-${props.row.status}`}>
    <span class="ie-status-dot" aria-hidden="true"></span>
    {STATUS_LABEL[props.row.status]}
  </span>
{/snippet}

<section class="ie-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip + save bar -->
  <div class="ie-kpi-strip shrink-0">
    <div class="ie-kpi">
      <div class="ie-kpi-label">Employees</div>
      <div class="ie-kpi-value tabular-nums">{rows.length}</div>
      <div class="ie-kpi-foot">{activeCount} active</div>
    </div>
    <div class="ie-kpi">
      <div class="ie-kpi-label">Payroll</div>
      <div class="ie-kpi-value tabular-nums">{fmtMoney.format(totalSalary)}</div>
      <div class="ie-kpi-foot">monthly total</div>
    </div>
    <div class="ie-kpi {dirtyCount > 0 ? 'ie-kpi-warn' : ''}">
      <div class="ie-kpi-label">Pending edits</div>
      <div class="ie-kpi-value tabular-nums">{dirtyCount}</div>
      <div class="ie-kpi-foot">{dirtyRows} row{dirtyRows === 1 ? '' : 's'} affected</div>
    </div>
    <div class="ie-actions">
      <button type="button" class="ie-btn ie-btn-ghost" onclick={reset} disabled={dirtyCount === 0}>
        Reset
      </button>
      <button type="button" class="ie-btn ie-btn-primary" onclick={save} disabled={dirtyCount === 0}>
        Save changes
      </button>
    </div>
  </div>

  <div class="ie-hint shrink-0">
    Double-click a cell or press <kbd>F2</kbd> to edit. <kbd>Enter</kbd> commits, <kbd>Esc</kbd> cancels.
    Department / Country / Status are dropdown editors; Active is a checkbox; Joined opens a date picker.
  </div>

  <div class="flex-1 min-h-0 ie-grid-host">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showRowNumbers={true}
      showPagination={false}
      enableInlineEditing={true}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={40}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
    />
  </div>
</section>

<style>
  .ie-shell { height: 100%; }

  /* KPI strip */
  .ie-kpi-strip {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
    gap: 10px;
    align-items: stretch;
  }
  .ie-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .ie-kpi-warn { border-left: 3px solid #f59e0b; }
  .ie-kpi-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sg-muted, #64748b); }
  .ie-kpi-value { font-size: 22px; font-weight: 700; line-height: 1.1; color: var(--sg-fg, #0f172a); }
  .ie-kpi-foot  { font-size: 11px; color: var(--sg-muted, #94a3b8); }

  .ie-actions { display: flex; align-items: center; gap: 8px; padding: 6px 4px; }
  .ie-btn {
    border-radius: 6px;
    padding: 8px 16px;
    font-size: 13px; font-weight: 600;
    cursor: pointer;
    transition: filter 120ms ease, background 120ms ease, border-color 120ms ease;
  }
  .ie-btn:disabled { opacity: 0.45; cursor: default; }
  .ie-btn-ghost {
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1);
  }
  .ie-btn-ghost:hover:not(:disabled) { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }
  .ie-btn-primary {
    background: var(--sg-accent, #2563eb);
    color: #fff;
    border: 1px solid transparent;
    box-shadow: 0 1px 2px rgba(37, 99, 235, 0.25);
  }
  .ie-btn-primary:hover:not(:disabled) { filter: brightness(1.06); }

  /* Inline hint band */
  .ie-hint {
    border: 1px dashed var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 12.5px;
    color: var(--sg-muted, #475569);
    line-height: 1.5;
  }
  .ie-hint kbd {
    font-family: ui-monospace, Menlo, monospace;
    background: var(--sg-header-bg, #f1f5f9);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 3px;
    padding: 0 5px;
    font-size: 11px;
    color: var(--sg-fg, #0f172a);
  }

  /* Department pill. Color comes from an inline style (chipStyle) so it's
     identical to the list editor's dropdown chip. */
  :global(.ie-dept) {
    display: inline-block;
    padding: 2px 10px; border-radius: 999px;
    font-size: 11.5px; font-weight: 600;
    border: 1px solid transparent;
  }

  /* Status pill with a small dot. */
  :global(.ie-status) {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 2px 10px; border-radius: 999px;
    font-size: 11.5px; font-weight: 600;
  }
  :global(.ie-status-dot) { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  :global(.ie-status-active)   { background: #dcfce7; color: #166534; }
  :global(.ie-status-pending)  { background: #fef3c7; color: #92400e; }
  :global(.ie-status-inactive) { background: #fee2e2; color: #991b1b; }
  :global([data-theme='dark'] .ie-status-active)   { background: rgba(34,197,94,0.20); color: #4ade80; }
  :global([data-theme='dark'] .ie-status-pending)  { background: rgba(245,158,11,0.20); color: #fbbf24; }
  :global([data-theme='dark'] .ie-status-inactive) { background: rgba(239,68,68,0.22); color: #fca5a5; }
</style>
