<script lang="ts">
  /**
   * 97. Side-drawer edit form
   * -------------------------
   * The Linear / Notion pattern: click a row, a polished form slides in
   * from the right with every field, atomic Save / Cancel, dirty-state
   * indicator, validation summary, and keyboard escape. The grid is the
   * "list" view; the drawer is the "detail" view - lighter weight than
   * a full master/detail page, more useful than inline editing for
   * records with > 4-5 fields.
   *
   * The drawer's editor is just plain Svelte - it mutates a draft copy
   * of the record, then commits on Save by replacing the corresponding
   * grid row.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Status = 'open' | 'in_review' | 'approved' | 'rejected' | 'archived'
  type Priority = 'low' | 'normal' | 'high' | 'urgent'

  type Application = {
    id: string
    company: string
    contact: string
    email: string
    amount: number
    purpose: string
    status: Status
    priority: Priority
    submittedAt: string
    notes: string
  }

  const STATUSES: { value: Status; label: string; tone: string }[] = [
    { value: 'open',      label: 'Open',      tone: '#6366f1' },
    { value: 'in_review', label: 'In review', tone: '#f59e0b' },
    { value: 'approved',  label: 'Approved',  tone: '#10b981' },
    { value: 'rejected',  label: 'Rejected',  tone: '#ef4444' },
    { value: 'archived',  label: 'Archived',  tone: '#64748b' },
  ]
  const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'urgent']

  let rows = $state<Application[]>([
    { id: 'APP-9001', company: 'Helios Holdings',  contact: 'Ava Thompson',   email: 'ava@helios.co',     amount:  85_000, purpose: 'Working capital expansion to support Q3 inventory ramp.', status: 'open',      priority: 'high',   submittedAt: '2026-05-21', notes: 'Existing customer, 4-year history.' },
    { id: 'APP-9002', company: 'Vertex Partners',  contact: 'Liam Park',      email: 'liam@vertex.io',    amount: 250_000, purpose: 'Equipment financing for new manufacturing line.',           status: 'in_review', priority: 'urgent', submittedAt: '2026-05-22', notes: 'Pending UCC-1 filing.' },
    { id: 'APP-9003', company: 'Atlas Trading',    contact: 'Noah Singh',     email: 'noah@atlas.trade',  amount:  42_000, purpose: 'Bridge loan for receivables gap.',                          status: 'approved',  priority: 'normal', submittedAt: '2026-05-18', notes: 'Auto-approved under $50k threshold.' },
    { id: 'APP-9004', company: 'Quantum Logistics',contact: 'Emma Garcia',    email: 'emma@quantum.fyi',  amount: 120_000, purpose: 'Fleet upgrade for cold-chain capability.',                  status: 'open',      priority: 'normal', submittedAt: '2026-05-25', notes: '' },
    { id: 'APP-9005', company: 'Stellar Resources',contact: 'Olivia Chen',    email: 'oc@stellar.energy', amount:  74_000, purpose: 'Inventory financing for Q3 seasonal surge.',                status: 'rejected',  priority: 'low',    submittedAt: '2026-05-15', notes: 'DSCR below threshold.' },
    { id: 'APP-9006', company: 'Apex Networks',    contact: 'Mason Rivera',   email: 'mr@apex.net',       amount: 195_000, purpose: 'Office expansion lease deposit + buildout.',                status: 'in_review', priority: 'high',   submittedAt: '2026-05-26', notes: 'Awaiting personal guarantee.' },
    { id: 'APP-9007', company: 'Crescent Bio',     contact: 'Sophia Brown',   email: 'sb@crescent.bio',   amount: 310_000, purpose: 'R&D capex - sequencer + reagents.',                         status: 'open',      priority: 'urgent', submittedAt: '2026-05-27', notes: 'Founder is repeat borrower.' },
    { id: 'APP-9008', company: 'Sigma Energy',     contact: 'Lucas Patel',    email: 'lp@sigma.energy',   amount:  64_000, purpose: 'Working capital line increase.',                           status: 'archived',  priority: 'low',    submittedAt: '2026-05-10', notes: 'Customer withdrew application.' },
    { id: 'APP-9009', company: 'Pioneer Materials',contact: 'Mia Johnson',    email: 'mj@pioneer.co',     amount: 156_000, purpose: 'New product line tooling.',                                 status: 'open',      priority: 'normal', submittedAt: '2026-05-28', notes: '' },
    { id: 'APP-9010', company: 'Aurora Labs',      contact: 'Ethan Wright',   email: 'ew@aurora.dev',     amount:  92_000, purpose: 'Cloud infra prepay (2-year commitment).',                   status: 'in_review', priority: 'normal', submittedAt: '2026-05-29', notes: 'Verifying AWS billing history.' },
  ])

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Application> | null>(null)

  // ---- Drawer state ------------------------------------------------------
  let drawerOpen = $state(false)
  let editing = $state<Application | null>(null)   // the original record
  let draft = $state<Application | null>(null)     // mutable copy

  function openFor(row: Application) {
    editing = row
    draft = { ...row }
    drawerOpen = true
  }
  function close() {
    drawerOpen = false
    editing = null
    draft = null
  }

  // ---- Dirty + validation -----------------------------------------------
  const isDirty = $derived.by(() => {
    if (!editing || !draft) return false
    return Object.keys(draft).some(
      (k) => (draft as Record<string, unknown>)[k] !== (editing as unknown as Record<string, unknown>)[k],
    )
  })
  const errors = $derived.by(() => {
    if (!draft) return [] as string[]
    const out: string[] = []
    if (!draft.company.trim()) out.push('Company is required.')
    if (!draft.contact.trim()) out.push('Contact name is required.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email)) out.push('Email must be a valid address.')
    if (!(draft.amount >= 1_000 && draft.amount <= 1_000_000)) out.push('Amount must be between $1,000 and $1,000,000.')
    if (!draft.purpose.trim() || draft.purpose.length < 12) out.push('Purpose must be at least 12 characters.')
    return out
  })
  const canSave = $derived(isDirty && errors.length === 0)

  function save() {
    if (!canSave || !draft || !editing) return
    const next = rows.map((r) => (r.id === editing!.id ? { ...draft! } : r))
    rows = next
    close()
  }

  // ---- Keyboard: Esc closes, Ctrl+Enter saves ----------------------------
  function onDrawerKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); close() }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save() }
  }

  // ---- Toolbar -----------------------------------------------------------
  function newApplication() {
    const next: Application = {
      id: `APP-${9000 + rows.length + 1}`,
      company: 'New applicant', contact: '', email: '',
      amount: 50_000, purpose: '', status: 'open', priority: 'normal',
      submittedAt: new Date().toISOString().slice(0, 10), notes: '',
    }
    rows = [next, ...rows]
    openFor(next)
  }

  // ---- KPI strip --------------------------------------------------------
  const totals = $derived.by(() => ({
    count: rows.length,
    open: rows.filter((r) => r.status === 'open').length,
    inReview: rows.filter((r) => r.status === 'in_review').length,
    approved: rows.filter((r) => r.status === 'approved').length,
    pipeline: rows.filter((r) => r.status === 'open' || r.status === 'in_review')
      .reduce((s, r) => s + r.amount, 0),
  }))
  const usd = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000   ? `$${(n / 1_000).toFixed(0)}k`
                   : `$${n.toFixed(0)}`

  const columns: ColumnDef<typeof features, Application>[] = [
    { field: 'id',          header: 'Application', width: 110, editable: false },
    { field: 'company',     header: 'Company',     width: 180, editable: false },
    { field: 'contact',     header: 'Contact',     width: 150, editable: false },
    { field: 'amount',      header: 'Amount',      width: 130, align: 'right', editable: false,
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
    { field: 'status',      header: 'Status',      width: 130, editable: false,
      cellClass: (ctx) => `status-${String(ctx.getValue()).replaceAll('_', '-')}` },
    { field: 'priority',    header: 'Priority',    width: 110, editable: false,
      cellClass: (ctx) => `pri-${ctx.getValue()}` },
    { field: 'submittedAt', header: 'Submitted',   width: 120, editable: false },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip ---------------------------------------------------- -->
  <div class="kpi-strip shrink-0">
    <div class="kpi"><div class="kpi-label">Applications</div><div class="kpi-value">{totals.count}</div></div>
    <div class="kpi"><div class="kpi-label">Open</div><div class="kpi-value" style="color:#6366f1">{totals.open}</div></div>
    <div class="kpi"><div class="kpi-label">In review</div><div class="kpi-value" style="color:#f59e0b">{totals.inReview}</div></div>
    <div class="kpi"><div class="kpi-label">Approved</div><div class="kpi-value" style="color:#10b981">{totals.approved}</div></div>
    <div class="kpi"><div class="kpi-label">Pipeline</div><div class="kpi-value">{usd(totals.pipeline)}</div></div>
    <div class="kpi action">
      <button class="new-btn" onclick={newApplication}>+ New application</button>
      <div class="kpi-hint">click any row to edit</div>
    </div>
  </div>

  <div class="flex-1 min-h-0 grid-host"
    onclick={(e) => {
      const cell = (e.target as HTMLElement | null)?.closest<HTMLElement>('td[data-svgrid-row]')
      if (!cell) return
      const idx = Number(cell.dataset.svgridRow)
      const row = Number.isFinite(idx) ? rows[idx] : null
      if (row) openFor(row)
    }}
    role="presentation"
  >
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="row"
      showRowSelection={false}
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={false}
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
    />
  </div>
</section>

{#if drawerOpen && draft}
  <!-- Backdrop ----------------------------------------------------- -->
  <button type="button" class="drawer-backdrop"
    aria-label="Close drawer"
    onclick={close}></button>

  <!-- Drawer ------------------------------------------------------- -->
  <aside class="drawer" role="dialog" aria-modal="true" aria-label="Edit application"
    onkeydown={onDrawerKey}>
    <header class="drawer-head">
      <div>
        <div class="drawer-eyebrow">Application</div>
        <h3 class="drawer-title">{draft.id} · {draft.company}</h3>
      </div>
      <div class="drawer-head-right">
        {#if isDirty}
          <span class="drawer-dirty">● Unsaved changes</span>
        {/if}
        <button class="drawer-close" onclick={close} aria-label="Close">✕</button>
      </div>
    </header>

    <div class="drawer-body">
      <div class="field">
        <label for="d-company">Company</label>
        <input id="d-company" bind:value={draft.company} autocomplete="off" />
      </div>

      <div class="field-row">
        <div class="field">
          <label for="d-contact">Contact</label>
          <input id="d-contact" bind:value={draft.contact} autocomplete="off" />
        </div>
        <div class="field">
          <label for="d-email">Email</label>
          <input id="d-email" type="email" bind:value={draft.email} autocomplete="off" />
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="d-amount">Amount (USD)</label>
          <input id="d-amount" type="number" min="1000" max="1000000" step="1000"
            bind:value={draft.amount} />
        </div>
        <div class="field">
          <label for="d-submitted">Submitted</label>
          <input id="d-submitted" type="date" bind:value={draft.submittedAt} />
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="d-status">Status</label>
          <select id="d-status" bind:value={draft.status}>
            {#each STATUSES as s (s.value)}<option value={s.value}>{s.label}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="d-priority">Priority</label>
          <select id="d-priority" bind:value={draft.priority}>
            {#each PRIORITIES as p (p)}<option value={p}>{p}</option>{/each}
          </select>
        </div>
      </div>

      <div class="field">
        <label for="d-purpose">Purpose</label>
        <textarea id="d-purpose" rows="3" bind:value={draft.purpose}></textarea>
      </div>

      <div class="field">
        <label for="d-notes">Internal notes</label>
        <textarea id="d-notes" rows="3" bind:value={draft.notes}
          placeholder="Visible only to reviewers"></textarea>
      </div>

      {#if errors.length}
        <div class="errors" role="alert">
          <strong>Fix the following before saving:</strong>
          <ul>
            {#each errors as e, i (i)}<li>{e}</li>{/each}
          </ul>
        </div>
      {/if}
    </div>

    <footer class="drawer-foot">
      <span class="drawer-kbd">Esc to close · Ctrl+Enter to save</span>
      <div class="drawer-actions">
        <button class="btn" onclick={close}>Cancel</button>
        <button class="btn primary" disabled={!canSave} onclick={save}>
          Save {isDirty ? 'changes' : ''}
        </button>
      </div>
    </footer>
  </aside>
{/if}

<style>
  .kpi-strip { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
  .kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; padding: 8px 12px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
               color: var(--sg-muted, #64748b); }
  .kpi-value { font-size: 20px; font-weight: 700; color: var(--sg-fg, #0f172a);
               font-variant-numeric: tabular-nums; line-height: 1.1; }
  .kpi.action { background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.05));
                border-color: transparent; align-items: stretch; justify-content: space-between; }
  .new-btn {
    background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
    border: 0; border-radius: 6px; padding: 7px 12px; font-size: 13px;
    font-weight: 600; cursor: pointer;
  }
  .new-btn:hover { filter: brightness(1.07); }
  .kpi-hint { font-size: 10px; color: var(--sg-muted, #64748b); text-align: center; }

  .grid-host :global(tr) { cursor: pointer; }

  /* Status / priority pills via cellClass ------------------------- */
  :global(td.status-open)       { color: #6366f1; font-weight: 600; }
  :global(td.status-in-review)  { color: #f59e0b; font-weight: 600; }
  :global(td.status-approved)   { color: #10b981; font-weight: 600; }
  :global(td.status-rejected)   { color: #ef4444; font-weight: 600; }
  :global(td.status-archived)   { color: #94a3b8; }
  :global(td.pri-urgent)        { color: #b91c1c; font-weight: 700; }
  :global(td.pri-high)          { color: #c2410c; font-weight: 600; }
  :global(td.pri-normal)        { color: #475569; }
  :global(td.pri-low)           { color: #94a3b8; }

  /* ---------- Drawer ---------- */
  .drawer-backdrop {
    position: fixed; inset: 0; z-index: 80;
    background: rgba(15, 23, 42, 0.42);
    border: 0; padding: 0; cursor: default;
    animation: drw-fade 150ms ease-out;
  }
  .drawer {
    position: fixed; top: 0; right: 0; bottom: 0; z-index: 81;
    width: min(540px, 96vw);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-left: 1px solid var(--sg-border, #e2e8f0);
    box-shadow: -20px 0 60px rgba(15,23,42,0.18);
    display: flex; flex-direction: column;
    animation: drw-slide 220ms cubic-bezier(0.22, 0.61, 0.36, 1);
  }
  @keyframes drw-fade  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes drw-slide { from { transform: translateX(100%); } to { transform: translateX(0); } }

  .drawer-head {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(180deg, color-mix(in oklab, #6366f1 5%, var(--sg-bg, #fff)), transparent);
  }
  .drawer-eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
                    color: var(--sg-muted, #64748b); font-weight: 700; }
  .drawer-title { font-size: 16px; font-weight: 700; margin: 2px 0 0; line-height: 1.3; }
  .drawer-head-right { display: flex; align-items: center; gap: 10px; }
  .drawer-dirty {
    font-size: 11px; font-weight: 700; color: #f59e0b;
    background: color-mix(in oklab, #f59e0b 15%, transparent);
    padding: 3px 8px; border-radius: 999px;
  }
  .drawer-close {
    background: transparent; border: 0; cursor: pointer;
    color: var(--sg-muted, #64748b);
    width: 28px; height: 28px; border-radius: 4px; font-size: 16px;
  }
  .drawer-close:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.12));
                       color: var(--sg-fg, #0f172a); }

  .drawer-body { padding: 16px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; flex: 1; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .field label {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.05em; color: var(--sg-muted, #64748b);
  }
  .field input, .field select, .field textarea {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px; padding: 7px 10px; font-size: 14px;
    font-family: inherit; outline: none;
  }
  .field textarea { resize: vertical; min-height: 60px; }
  .field input:focus, .field select:focus, .field textarea:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px color-mix(in oklab, #6366f1 22%, transparent);
  }

  .errors {
    border: 1px solid #fecaca;
    background: #fef2f2;
    color: #991b1b;
    border-radius: 6px; padding: 10px 12px; font-size: 13px;
  }
  .errors strong { display: block; margin-bottom: 4px; }
  .errors ul { margin: 0; padding-left: 18px; }

  .drawer-foot {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px 20px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
  }
  .drawer-kbd { font-size: 11px; color: var(--sg-muted, #94a3b8); }
  .drawer-actions { display: flex; gap: 8px; }
  .btn {
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px; padding: 7px 14px;
    font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .btn:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.1)); }
  .btn.primary {
    background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
    border-color: transparent;
  }
  .btn.primary:hover { filter: brightness(1.08); }
  .btn:disabled { opacity: 0.45; cursor: default; }
</style>
