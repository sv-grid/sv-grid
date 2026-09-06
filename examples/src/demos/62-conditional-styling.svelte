<script lang="ts">
  /**
   * 62. Conditional styling - support ticket queue
   * ---------------------------------------------
   * Enterprise-style triage board, modelled on Linear / Zendesk's queue
   * views. Two hooks do the heavy lifting:
   *
   *   - `rowClass(ctx)` adds row-level state classes (`breach`, `risk`,
   *     `done`) - a thin vertical accent strip on the leftmost cell.
   *   - `cellClass(ctx)` paints subtle column-level chips (status pills,
   *     priority dots, plan badges) and a calm horizontal load bar.
   *
   * The aim is tonal, not loud: low-saturation backgrounds, single-bar
   * accents, type that stays readable. Numbers + dates use tabular nums.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type GridColumns,
  } from '@svgrid/grid'

  type Status   = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
  type Priority = 'low' | 'normal' | 'high' | 'urgent'
  type Ticket = {
    id: string
    subject: string
    customer: string
    plan: 'Free' | 'Pro' | 'Enterprise'
    priority: Priority
    status: Status
    agent: string
    agentLoad: number
    openedAt: string
    slaDueAt: string
    csat: number | null
  }

  let prng = 0xDEC0DED
  function rand(): number { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(a: readonly T[]): T { return a[Math.floor(rand() * a.length)]! }

  const SUBJECTS = [
    'API rate limiting in production',
    'Cannot connect SSO provider',
    'Billing - invoice PDF blank',
    'Export crashes on 50MB file',
    'Mobile app stuck on splash',
    'Webhook deliveries delayed',
    '2FA codes not arriving',
    'Custom domain DNS verification',
    'Search index out of sync',
    'OAuth scopes incorrect',
    'Audit log missing entries',
    'Pagination off by one',
    'Slow dashboard load',
    'CSV import skipping rows',
    'Webhook retry storm',
  ]
  const CUSTOMERS = [
    'Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Pied Piper',
    'Stark Industries', 'Wayne Enterprises', 'Wonka Industries', 'Tyrell Corp',
    'Sirius Cybernetics', 'Aperture Science',
  ]
  const AGENTS = ['Mira Sato', 'Jordan Wells', 'Ada Iyer', 'Luis Pérez', 'Yara Khan', 'Sven Hagen']
  const PLANS:       Ticket['plan'][] = ['Free', 'Pro', 'Enterprise']
  const PRIORITIES:  Priority[]       = ['low', 'normal', 'high', 'urgent']
  const STATUSES:    Status[]         = ['open', 'in_progress', 'waiting', 'resolved', 'closed']

  function isoOffset(days: number): string {
    return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
  }
  const today = new Date().toISOString().slice(0, 10)

  const rows: Ticket[] = Array.from({ length: 36 }, (_, i) => {
    const openedOffset = -Math.floor(rand() * 18)
    const slaOffset    = openedOffset + 1 + Math.floor(rand() * 8)
    const status       = pick(STATUSES)
    return {
      id:        `T-${(1000 + i).toString()}`,
      subject:   pick(SUBJECTS),
      customer:  pick(CUSTOMERS),
      plan:      pick(PLANS),
      priority:  pick(PRIORITIES),
      status,
      agent:     pick(AGENTS),
      agentLoad: Math.floor(rand() * 100),
      openedAt:  isoOffset(openedOffset),
      slaDueAt:  isoOffset(slaOffset),
      csat:      status === 'resolved' || status === 'closed'
        ? Math.floor(rand() * 50) + 50
        : null,
    }
  })

  function slaState(t: Ticket): 'breach' | 'risk' | 'ok' {
    if (t.status === 'resolved' || t.status === 'closed') return 'ok'
    if (t.slaDueAt < today) return 'breach'
    const dueIn = (new Date(t.slaDueAt).getTime() - Date.now()) / 86_400_000
    if (dueIn <= 2) return 'risk'
    return 'ok'
  }

  const counts = $derived.by(() => {
    let breach = 0, risk = 0, open = 0
    for (const r of rows) {
      const s = slaState(r)
      if (s === 'breach') breach += 1
      else if (s === 'risk') risk += 1
      if (r.status !== 'resolved' && r.status !== 'closed') open += 1
    }
    return { breach, risk, open }
  })

  const features = tableFeatures({
    rowSortingFeature, columnFilteringFeature,
  })

  const columns: GridColumns<Ticket> = [
    {
      field: 'id', header: 'ID', editorType: 'text', width: 76,
      cellClass: (ctx) => `id-cell sla-${slaState(ctx.row.original)}`,
    },
    {
      field: 'subject', header: 'Subject', editorType: 'text', width: 240,
      cell: (ctx) => renderSnippet(SubjectCell, { row: ctx.row.original }),
    },
    { field: 'customer', header: 'Customer', editorType: 'text', width: 140 },
    {
      field: 'plan', header: 'Plan', editorType: 'text', width: 96,
      cell: (ctx) => renderSnippet(PlanCell, { plan: ctx.row.original.plan }),
    },
    {
      field: 'priority', header: 'Priority', editorType: 'text', width: 108,
      cell: (ctx) => renderSnippet(PriorityCell, { p: ctx.row.original.priority }),
    },
    {
      field: 'status', header: 'Status', editorType: 'text', width: 124,
      cell: (ctx) => renderSnippet(StatusCell, { s: ctx.row.original.status }),
    },
    { field: 'agent', header: 'Agent', editorType: 'text', width: 130 },
    {
      field: 'agentLoad', header: 'Load', editorType: 'number', width: 120,
      cell: (ctx) => renderSnippet(LoadCell, { v: Number(ctx.getValue() ?? 0) }),
    },
    {
      field: 'slaDueAt', header: 'SLA due', editorType: 'date', width: 116,
      format: { type: 'date', pattern: 'y-m-d' },
      cellClass: (ctx) => `sla-due sla-${slaState(ctx.row.original)}`,
    },
    {
      field: 'csat', header: 'CSAT', editorType: 'number', width: 100,
      cell: (ctx) => renderSnippet(CsatCell, { v: ctx.row.original.csat }),
    },
  ]

  const STATUS_LABEL: Record<Status, string> = {
    open: 'Open', in_progress: 'In progress', waiting: 'Waiting',
    resolved: 'Resolved', closed: 'Closed',
  }
</script>

{#snippet SubjectCell(props: { row: Ticket })}
  <span class="subject">
    <span class="subject-line">{props.row.subject}</span>
    <span class="subject-meta">opened {props.row.openedAt}</span>
  </span>
{/snippet}

{#snippet PlanCell(props: { plan: Ticket['plan'] })}
  <span class="plan-badge plan-{props.plan.toLowerCase()}">{props.plan}</span>
{/snippet}

{#snippet PriorityCell(props: { p: Priority })}
  <span class="priority priority-{props.p}">
    <span class="priority-dot"></span>
    <span>{props.p[0]!.toUpperCase() + props.p.slice(1)}</span>
  </span>
{/snippet}

{#snippet StatusCell(props: { s: Status })}
  <span class="status status-{props.s}">{STATUS_LABEL[props.s]}</span>
{/snippet}

{#snippet LoadCell(props: { v: number })}
  {@const tone = props.v >= 80 ? 'hi' : props.v >= 50 ? 'mid' : 'low'}
  <span class="load load-{tone}">
    <span class="load-track">
      <span class="load-fill" style="width: {Math.min(100, Math.max(0, props.v))}%"></span>
    </span>
    <span class="load-num">{props.v}%</span>
  </span>
{/snippet}

{#snippet CsatCell(props: { v: number | null })}
  {#if props.v == null}
    <span class="csat-empty">–</span>
  {:else}
    {@const tone = props.v >= 90 ? 'great' : props.v < 70 ? 'poor' : 'ok'}
    <span class="csat csat-{tone}">{props.v}</span>
  {/if}
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="grid grid-cols-3 gap-2 shrink-0">
    <div class="kpi">
      <div class="kpi-label">Open</div>
      <div class="kpi-value">{counts.open}</div>
    </div>
    <div class="kpi kpi-warn">
      <div class="kpi-label">At risk</div>
      <div class="kpi-value">{counts.risk}</div>
    </div>
    <div class="kpi kpi-breach">
      <div class="kpi-label">SLA breached</div>
      <div class="kpi-value">{counts.breach}</div>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      columnResize
      data={rows}
      columns={columns}
      features={features}
      rowClass={({ row }) => {
        const s = slaState(row)
        return {
          'row-breach': s === 'breach',
          'row-risk':   s === 'risk',
          'row-done':   row.status === 'resolved' || row.status === 'closed',
        }
      }}
      filterMode="menu"
      selectionMode="cell"
      showRowNumbers={false}
      showPagination={true}
      pageSize={20}
      enableInlineEditing={false}
      enableCellSelection={true}
      rowHeight={48}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>

<style>
  /* ---- KPI strip ---- */
  .kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    padding: 10px 14px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .kpi-label { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--sg-muted, #64748b); }
  .kpi-value { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--sg-fg, #0f172a); }
  .kpi-warn   { border-left: 3px solid #f59e0b; }
  .kpi-breach { border-left: 3px solid #ef4444; }

  /* ---- Row accents - thin left bar on the ID cell only ---- */
  :global(td.id-cell)            { position: relative; font-variant-numeric: tabular-nums; color: var(--sg-muted, #64748b); }
  :global(td.id-cell.sla-breach)::before,
  :global(td.id-cell.sla-risk)::before {
    content: ''; position: absolute; left: 0; top: 4px; bottom: 4px; width: 3px; border-radius: 2px;
  }
  :global(td.id-cell.sla-breach)::before { background: #ef4444; }
  :global(td.id-cell.sla-risk)::before   { background: #f59e0b; }

  :global(tr.row-done) { color: var(--sg-muted, #94a3b8); }
  :global(tr.row-done .sv-grid-cell) { opacity: 0.7; }

  /* ---- Subject - two-line cell ---- */
  .subject       { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
  .subject-line  { font-weight: 500; color: var(--sg-fg, #0f172a); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .subject-meta  { font-size: 11px; color: var(--sg-muted, #94a3b8); margin-top: 2px; }

  /* ---- Plan badges - flat, monochrome by tier ---- */
  .plan-badge        { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
  .plan-free         { background: var(--sg-bg-subtle, var(--sg-header-bg, #f1f5f9)); color: var(--sg-muted, #475569); }
  .plan-pro          { background: #e0e7ff; color: #4338ca; }
  .plan-enterprise   { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }

  /* ---- Priority - solid dot + label ---- */
  .priority          { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
  .priority-dot      { width: 8px; height: 8px; border-radius: 999px; flex: none; }
  .priority-urgent   { color: #b91c1c; }
  .priority-urgent   .priority-dot { background: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.18); }
  .priority-high     { color: #c2410c; }
  .priority-high     .priority-dot { background: #f97316; }
  .priority-normal   { color: var(--sg-fg, #475569); }
  .priority-normal   .priority-dot { background: var(--sg-muted, #94a3b8); }
  .priority-low      { color: var(--sg-muted, #64748b); }
  .priority-low      .priority-dot { background: var(--sg-border, #cbd5e1); }

  /* ---- Status pills - low-saturation tonal chips ---- */
  .status            { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; }
  .status-open        { background: #eff6ff; color: #1d4ed8; }
  .status-in_progress { background: #f5f3ff; color: #6d28d9; }
  .status-waiting     { background: #fffbeb; color: #b45309; }
  .status-resolved    { background: #ecfdf5; color: #047857; }
  .status-closed      { background: var(--sg-bg-subtle, var(--sg-header-bg, #f1f5f9)); color: var(--sg-muted, #475569); }

  /* ---- Load - calm bar + numeric ---- */
  .load              { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
  .load-track        { width: 64px; height: 6px; border-radius: 3px; background: var(--sg-bg-subtle, var(--sg-header-bg, #e2e8f0)); overflow: hidden; flex: none; }
  .load-fill         { display: block; height: 100%; border-radius: 3px; }
  .load-low  .load-fill { background: #10b981; }
  .load-mid  .load-fill { background: #f59e0b; }
  .load-hi   .load-fill { background: #ef4444; }
  .load-num          { font-variant-numeric: tabular-nums; font-size: 12px; color: var(--sg-muted, #64748b); }

  /* ---- SLA due cell - tone the date if breach/risk ---- */
  :global(td.sla-due)            { font-variant-numeric: tabular-nums; }
  :global(td.sla-due.sla-breach) { color: #b91c1c; font-weight: 600; }
  :global(td.sla-due.sla-risk)   { color: #b45309; }

  /* ---- CSAT - quiet number, only colour the extremes ---- */
  .csat              { display: inline-block; font-variant-numeric: tabular-nums; font-weight: 600; padding: 0 4px; border-radius: 4px; }
  .csat-great        { background: #ecfdf5; color: #047857; }
  .csat-ok           { color: var(--sg-fg, #0f172a); }
  .csat-poor         { background: #fef2f2; color: #b91c1c; }
  .csat-empty        { color: var(--sg-muted, #cbd5e1); font-weight: 400; }
</style>
