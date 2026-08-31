<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 43. Compliance / regulatory queue
   * ---------------------------------
   * Submissions waiting on review, sorted by SLA age. The view a
   * compliance officer would live in during the work day - every
   * column reinforces "this is the regulated record of record":
   *
   *   - **SLA badge** turns yellow at 50 % of remaining time, orange
   *     at 80 %, red at breach. Updates live via a 30-second tick.
   *
   *   - **Workflow column** is editable only by roles whose approver
   *     level matches the case's current step. Lower levels see it
   *     locked, upper levels see it open - same pattern as the
   *     permissions demo, narrowed to one column.
   *
   *   - **Approver chain** shows L1 / L2 / L3 with a ✓ stamp once
   *     each level has signed off and an empty seat once a level is
   *     blocked / pending.
   *
   *   - **Immutable history popover** opens when you click a case
   *     id. Every status change in the case's lifetime appears in
   *     order, oldest first, with the actor + a timestamp the
   *     officer can quote in a regulatory audit response.
   *
   * A "Submit / Reject / Return" toolbar lets the current role act
   * on the selected case - the actions are gated to match how a real
   * approval workflow would behave (only your level can advance to
   * the next; reject ends the case; return sends it back a level).
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  // ---- Domain ---------------------------------------------------------

  type CaseStatus =
    | 'open'
    | 'awaiting_l1'
    | 'awaiting_l2'
    | 'awaiting_l3'
    | 'approved'
    | 'rejected'
    | 'returned'

  type CaseKind = 'submission' | 'change_request' | 'cross_border' | 'audit_finding' | 'incident'
  type Priority = 'std' | 'high' | 'critical'
  type Role = 'viewer' | 'l1' | 'l2' | 'l3'

  type ChainStep = {
    level: 1 | 2 | 3
    approver?: string
    decidedAt?: number
    /** "approved" | "rejected" | "returned" | undefined for pending */
    action?: 'approved' | 'rejected' | 'returned'
  }

  type HistoryEntry = {
    id: number
    at: number
    actor: string
    action: string
    note?: string
  }

  type Case = {
    id: string
    title: string
    kind: CaseKind
    priority: Priority
    status: CaseStatus
    owner: string
    submittedAt: number
    /** SLA deadline as epoch ms. */
    dueAt: number
    chain: ChainStep[]
    history: HistoryEntry[]
  }

  // ---- Seeds ----------------------------------------------------------

  const KINDS: readonly CaseKind[] = ['submission', 'change_request', 'cross_border', 'audit_finding', 'incident']
  const PRIORITIES: readonly Priority[] = ['std', 'high', 'critical']
  const TITLES: Record<CaseKind, string[]> = {
    submission: ['New product filing', 'Annual report submission', 'Renewal package'],
    change_request: ['Process change CR', 'Vendor onboarding CR', 'Policy update CR'],
    cross_border: ['EU representative filing', 'APAC market access', 'Customs declaration'],
    audit_finding: ['Internal audit finding', 'External audit response', 'SOX deficiency'],
    incident: ['GxP deviation', 'Data integrity incident', 'Privacy breach report'],
  }
  const OWNERS = ['M. Park', 'J. Chen', 'R. Diaz', 'C. Singh', 'D. Olsen', 'A. Mehta']
  const APPROVERS_L1 = ['L1 · Reese Khan', 'L1 · Quinn Tran', 'L1 · Riley Cohen']
  const APPROVERS_L2 = ['L2 · Avery Mehta', 'L2 · Morgan Nair']
  const APPROVERS_L3 = ['L3 · Sasha Park', 'L3 · Jamie Chen']

  let prng = 0x6A0EB001
  function rnd(): number {
    prng = (prng * 1664525 + 1013904223) >>> 0
    return prng / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }

  let historySeq = 0
  function newHistory(action: string, actor: string, at: number): HistoryEntry {
    historySeq += 1
    return { id: historySeq, at, actor, action }
  }

  function seedCase(i: number): Case {
    const kind = pick(KINDS)
    const titleVariants = TITLES[kind]
    const submitted = Date.now() - Math.floor(rnd() * 10) * 86_400_000
    const slaHours = pick([24, 48, 72, 96, 168])
    const dueAt = submitted + slaHours * 3600_000
    const status: CaseStatus = pick(['awaiting_l1', 'awaiting_l1', 'awaiting_l2', 'awaiting_l3', 'returned'])
    const priority: Priority = pick(PRIORITIES)
    const chain: ChainStep[] = [
      { level: 1, approver: pick(APPROVERS_L1) },
      { level: 2 },
      { level: 3 },
    ]
    const history: HistoryEntry[] = [
      newHistory('Submitted for review', pick(OWNERS), submitted),
    ]
    if (status === 'awaiting_l2' || status === 'awaiting_l3') {
      chain[0]!.action = 'approved'
      chain[0]!.decidedAt = submitted + 3600_000
      history.push(newHistory('L1 approved', chain[0]!.approver!, chain[0]!.decidedAt!))
      chain[1]!.approver = pick(APPROVERS_L2)
    }
    if (status === 'awaiting_l3') {
      chain[1]!.action = 'approved'
      chain[1]!.decidedAt = submitted + 2 * 3600_000
      history.push(newHistory('L2 approved', chain[1]!.approver!, chain[1]!.decidedAt!))
      chain[2]!.approver = pick(APPROVERS_L3)
    }
    if (status === 'returned') {
      chain[0]!.action = 'returned'
      chain[0]!.decidedAt = submitted + 2 * 3600_000
      history.push(newHistory('L1 returned for clarification', chain[0]!.approver!, chain[0]!.decidedAt!))
    }
    return {
      id: `CMP-${(10_000 + i).toString(36).toUpperCase()}`,
      title: pick(titleVariants),
      kind,
      priority,
      status,
      owner: pick(OWNERS),
      submittedAt: submitted,
      dueAt,
      chain,
      history,
    }
  }
  function seedQueue(n: number): Case[] {
    const out: Case[] = []
    for (let i = 0; i < n; i += 1) out.push(seedCase(i))
    return out
  }

  // ---- State ----------------------------------------------------------

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let cases = $state<Case[]>(seedQueue(36))
  let role = $state<Role>('l1')
  let selectedId = $state<string | null>(null)
  let now = $state(Date.now())

  // 30-second SLA-tick keeps the live colors honest without burning CPU.
  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 30_000)
    return () => clearInterval(id)
  })

  const selectedCase = $derived.by(() =>
    selectedId ? cases.find((c) => c.id === selectedId) ?? null : null,
  )

  // ---- Permission rules ----------------------------------------------

  function canAct(role: Role, status: CaseStatus): boolean {
    if (role === 'viewer') return false
    if (status === 'awaiting_l1') return role === 'l1'
    if (status === 'awaiting_l2') return role === 'l2'
    if (status === 'awaiting_l3') return role === 'l3'
    return false
  }

  // ---- Actions --------------------------------------------------------

  function nameForRole(): string {
    if (role === 'l1') return APPROVERS_L1[0]!
    if (role === 'l2') return APPROVERS_L2[0]!
    if (role === 'l3') return APPROVERS_L3[0]!
    return 'Viewer'
  }

  function advance(targetCase: Case, action: 'approved' | 'rejected' | 'returned'): void {
    if (!canAct(role, targetCase.status)) return
    const idx = cases.findIndex((c) => c.id === targetCase.id)
    if (idx < 0) return
    const c = { ...targetCase, chain: targetCase.chain.map((s) => ({ ...s })), history: targetCase.history.slice() }
    const stepIdx = role === 'l1' ? 0 : role === 'l2' ? 1 : 2
    const step = c.chain[stepIdx]!
    step.action = action
    step.decidedAt = Date.now()
    step.approver = step.approver ?? nameForRole()
    c.history.push(newHistory(
      `${role.toUpperCase()} ${action === 'approved' ? 'approved' : action === 'rejected' ? 'rejected' : 'returned'}`,
      nameForRole(),
      Date.now(),
    ))
    if (action === 'rejected') {
      c.status = 'rejected'
    } else if (action === 'returned') {
      c.status = 'returned'
    } else if (stepIdx === 0) {
      c.status = 'awaiting_l2'
      c.chain[1] = { ...c.chain[1]!, approver: pick(APPROVERS_L2) }
    } else if (stepIdx === 1) {
      c.status = 'awaiting_l3'
      c.chain[2] = { ...c.chain[2]!, approver: pick(APPROVERS_L3) }
    } else {
      c.status = 'approved'
    }
    const next = cases.slice()
    next[idx] = c
    cases = next
  }

  function reopenReturned(target: Case): void {
    const idx = cases.findIndex((c) => c.id === target.id)
    if (idx < 0) return
    const c = { ...target, chain: target.chain.map((s) => ({ ...s })), history: target.history.slice() }
    c.status = 'awaiting_l1'
    c.chain[0] = { level: 1, approver: c.chain[0]!.approver }
    c.history.push(newHistory('Resubmitted after return', target.owner, Date.now()))
    const next = cases.slice()
    next[idx] = c
    cases = next
  }

  // ---- KPI derivations -------------------------------------------------

  const kpis = $derived.by(() => {
    let breached = 0
    let dueSoon = 0
    let approved = 0
    let returned = 0
    for (const c of cases) {
      if (c.status === 'approved') approved += 1
      else if (c.status === 'returned') returned += 1
      else {
        const remain = c.dueAt - now
        if (remain <= 0) breached += 1
        else if (remain < 0.2 * (c.dueAt - c.submittedAt)) dueSoon += 1
      }
    }
    return {
      total: cases.length,
      breached, dueSoon, approved, returned,
      yourTurn: cases.filter((c) => canAct(role, c.status)).length,
    }
  })

  // ---- Formatters ------------------------------------------------------

  function fmtTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  }
  function fmtDate(ts: number): string {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
  }
  function fmtRemaining(c: Case): string {
    if (c.status === 'approved' || c.status === 'rejected') return '-'
    const remain = c.dueAt - now
    const negative = remain < 0
    const abs = Math.abs(remain)
    const hours = Math.floor(abs / 3600_000)
    const minutes = Math.floor((abs % 3600_000) / 60_000)
    if (hours >= 24) return `${negative ? '−' : ''}${Math.floor(hours / 24)}d ${hours % 24}h`
    return `${negative ? '−' : ''}${hours}h ${minutes}m`
  }
  function slaTone(c: Case): 'ok' | 'warn' | 'hot' | 'breach' {
    if (c.status === 'approved' || c.status === 'rejected' || c.status === 'returned') return 'ok'
    const remain = c.dueAt - now
    if (remain <= 0) return 'breach'
    const ratio = remain / (c.dueAt - c.submittedAt)
    if (ratio < 0.2) return 'hot'
    if (ratio < 0.5) return 'warn'
    return 'ok'
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet IdCell(props: { row: Case })}
  <button
    type="button"
    class="cq-id"
    onclick={() => (selectedId = props.row.id)}
  >
    <span class="mono">{props.row.id}</span>
  </button>
{/snippet}

{#snippet TitleCell(props: { row: Case })}
  <span class="cq-title">{props.row.title}</span>
  <div class="cq-kind">{props.row.kind.replace('_', ' ')}</div>
{/snippet}

{#snippet PriorityCell(props: { row: Case })}
  <span class={`cq-priority cq-priority-${props.row.priority}`}>{props.row.priority}</span>
{/snippet}

{#snippet StatusCell(props: { row: Case })}
  <span class={`cq-status cq-status-${props.row.status}`}>{props.row.status.replace('_', ' ')}</span>
{/snippet}

{#snippet SlaCell(props: { row: Case })}
  {@const tone = slaTone(props.row)}
  <span class={`cq-sla cq-sla-${tone}`}>
    <span class="cq-sla-dot"></span>
    <span class="cq-sla-text tabular-nums">{fmtRemaining(props.row)}</span>
  </span>
{/snippet}

{#snippet ChainCell(props: { row: Case })}
  <span class="cq-chain">
    {#each props.row.chain as step (step.level)}
      {@const acted = step.action === 'approved' || step.action === 'rejected' || step.action === 'returned'}
      <span class={`cq-step ${step.action ? `cq-step-${step.action}` : (props.row.status === `awaiting_l${step.level}` ? 'cq-step-active' : '')}`}>
        L{step.level}
        {#if step.action === 'approved'}<span class="cq-step-mark">✓</span>{/if}
        {#if step.action === 'rejected'}<span class="cq-step-mark">✗</span>{/if}
        {#if step.action === 'returned'}<span class="cq-step-mark">↺</span>{/if}
      </span>
      {#if step.level < 3}<span class="cq-step-arrow">·</span>{/if}
    {/each}
  </span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="cq-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="cq-kpi-strip">
    <div class="cq-kpi">
      <div class="cq-kpi-label">In queue</div>
      <div class="cq-kpi-value tabular-nums">{kpis.total}</div>
      <div class="cq-kpi-foot">{kpis.approved} approved · {kpis.returned} returned</div>
    </div>
    <div class="cq-kpi">
      <div class="cq-kpi-label">Breached SLA</div>
      <div class={`cq-kpi-value tabular-nums ${kpis.breached > 0 ? 'cq-down' : ''}`}>{kpis.breached}</div>
      <div class="cq-kpi-foot">{kpis.dueSoon} due soon</div>
    </div>
    <div class="cq-kpi">
      <div class="cq-kpi-label">Your turn</div>
      <div class={`cq-kpi-value tabular-nums ${kpis.yourTurn > 0 ? 'cq-up' : ''}`}>{kpis.yourTurn}</div>
      <div class="cq-kpi-foot">awaiting {role.toUpperCase()}</div>
    </div>
    <div class="cq-kpi">
      <div class="cq-kpi-label">Last refreshed</div>
      <div class="cq-kpi-value tabular-nums">{fmtTime(now)}</div>
      <div class="cq-kpi-foot">SLA tick every 30s</div>
    </div>
    <div class="cq-kpi">
      <div class="cq-kpi-label">Role</div>
      <div class={`cq-kpi-value cq-role cq-role-${role}`}>{role.toUpperCase()}</div>
      <div class="cq-kpi-foot">{nameForRole()}</div>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="cq-toolbar">
    <span class="cq-role-row">
      <span class="cq-label">Acting as</span>
      {#each [{id: 'viewer', label: 'Viewer'}, {id: 'l1', label: 'L1'}, {id: 'l2', label: 'L2'}, {id: 'l3', label: 'L3'}] as r (r.id)}
        <button
          type="button"
          class={`cq-role-btn cq-role-${r.id}`}
          class:cq-role-active={role === r.id}
          onclick={() => (role = r.id as Role)}
        >{r.label}</button>
      {/each}
    </span>
    {#if selectedCase}
      <div class="cq-toolbar-actions">
        <span class="cq-selected">Selected: <strong>{selectedCase.id}</strong></span>
        {#if canAct(role, selectedCase.status)}
          <button type="button" class="cq-btn cq-btn-primary" onclick={() => advance(selectedCase, 'approved')}>Approve</button>
          <button type="button" class="cq-btn cq-btn-warn" onclick={() => advance(selectedCase, 'returned')}>Return</button>
          <button type="button" class="cq-btn cq-btn-danger" onclick={() => advance(selectedCase, 'rejected')}>Reject</button>
        {:else if selectedCase.status === 'returned'}
          <button type="button" class="cq-btn cq-btn-primary" onclick={() => reopenReturned(selectedCase)}>Resubmit</button>
        {:else}
          <span class="cq-locked">- not your step -</span>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Main: grid + history side panel -->
  <div class="cq-body">
    <div class="cq-grid-wrap">
      <SvGrid responsive={true}
        data={cases}
        columns={[
          { field: 'id', header: 'Case', width: 130, editable: false,
            cell: (ctx) => renderSnippet(IdCell, { row: ctx.row.original }) },
          { field: 'title', header: 'Title', width: 240, editable: false,
            cell: (ctx) => renderSnippet(TitleCell, { row: ctx.row.original }) },
          { field: 'priority', header: 'Priority', width: 100, editable: false,
            cell: (ctx) => renderSnippet(PriorityCell, { row: ctx.row.original }) },
          // Status is display-only - workflow advances through the
          // Approve / Return / Reject toolbar buttons, not by editing
          // the status cell directly. That keeps the state machine
          // honest (an L1 can't jump a case straight to "approved").
          { field: 'status', header: 'Status', width: 140, editable: false,
            cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }) },
          { field: 'dueAt', header: 'SLA', editorType: 'number', width: 130, editable: false,
            cell: (ctx) => renderSnippet(SlaCell, { row: ctx.row.original }) },
          { field: 'chain', header: 'Approver chain', width: 220, editable: false,
            cell: (ctx) => renderSnippet(ChainCell, { row: ctx.row.original }) },
          { field: 'owner', header: 'Submitter', width: 130, editable: false },
          { field: 'submittedAt', header: 'Submitted', editorType: 'number', width: 110, editable: false,
            cell: (ctx) => fmtDate(ctx.row.original.submittedAt) },
        ] satisfies ColumnDef<typeof features, Case>[]}
        features={features}
        filterMode="menu"
        selectionMode="cell"
        enableInlineEditing={role !== 'viewer'}
        enableCellSelection={true}
        rowHeight={48}
        containerHeight="100%"
        fitColumns={false}
        onCellValueChange={() => {}}
        onActiveCellChange={(args) => {
          const c = cases[args.rowIndex]
          if (c) selectedId = c.id
        }}
      />
    </div>

    <aside class="cq-history">
      <header class="cq-history-head">Immutable history</header>
      {#if selectedCase}
        <div class="cq-history-meta">
          <strong>{selectedCase.id}</strong>
          <span class="cq-history-sub">{selectedCase.title}</span>
        </div>
        <div class="cq-history-list">
          {#each selectedCase.history as h (h.id)}
            <div class="cq-history-row">
              <span class="cq-history-time">{fmtTime(h.at)}</span>
              <span class="cq-history-actor">{h.actor}</span>
              <span class="cq-history-action">{h.action}</span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="cq-history-empty">Select a case to view its trail.</div>
      {/if}
    </aside>
  </div>
</section>

<style>
  /* KPI strip */
  .cq-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    flex-shrink: 0;
  }
  .cq-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .cq-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 6px;
  }
  .cq-kpi-value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.1;
  }
  .cq-kpi-foot {
    margin-top: 6px;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
  }
  .cq-up { color: #16a34a; }
  .cq-down { color: #dc2626; }
  :global([data-theme='dark']) .cq-up { color: #4ade80; }
  :global([data-theme='dark']) .cq-down { color: #f87171; }
  .cq-role { font-size: 18px; }
  .cq-role-l1 { color: #1d4ed8; }
  .cq-role-l2 { color: #ca8a04; }
  .cq-role-l3 { color: #b91c1c; }
  .cq-role-viewer { color: #475569; }

  /* Toolbar */
  .cq-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .cq-role-row { display: inline-flex; gap: 6px; align-items: center; }
  .cq-label { font-size: 11.5px; color: var(--sg-muted, #64748b); }
  .cq-role-btn {
    padding: 4px 12px;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 999px;
    font-size: 12px;
    cursor: pointer;
  }
  .cq-role-active {
    border-color: transparent;
    box-shadow: 0 0 0 2px var(--sg-accent, #2563eb) inset;
    font-weight: 600;
  }
  .cq-toolbar-actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }
  .cq-selected {
    font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
  .cq-selected strong { color: var(--sg-accent, #2563eb); }
  .cq-locked {
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
    font-style: italic;
  }
  .cq-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 12px;
    cursor: pointer;
  }
  .cq-btn-primary {
    background: var(--sg-accent, #2563eb);
    border-color: transparent;
    color: var(--sg-on-accent, #fff);
  }
  .cq-btn-warn {
    background: #ca8a04;
    border-color: transparent;
    color: #fff;
  }
  .cq-btn-danger {
    background: #dc2626;
    border-color: transparent;
    color: #fff;
  }

  /* Body */
  .cq-body {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 10px;
  }
  .cq-grid-wrap { min-width: 0; }

  /* Cells */
  :global(.mono) { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
  :global(.cq-id) {
    background: transparent;
    border: 0;
    padding: 0;
    cursor: pointer;
    color: var(--sg-accent, #2563eb);
  }
  :global(.cq-id:hover) { text-decoration: underline; }

  :global(.cq-title) { font-weight: 500; }
  :global(.cq-kind) {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    text-transform: capitalize;
  }

  :global(.cq-priority) {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 4px;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
  }
  :global(.cq-priority-std)      { background: #e2e8f0; color: #475569; }
  :global(.cq-priority-high)     { background: #fef3c7; color: #92400e; }
  :global(.cq-priority-critical) { background: #fee2e2; color: #b91c1c; }
  :global([data-theme='dark'] .cq-priority-std)      { background: rgba(148,163,184,.2); color: #cbd5e1; }
  :global([data-theme='dark'] .cq-priority-high)     { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .cq-priority-critical) { background: rgba(239,68,68,.18); color: #f87171; }

  :global(.cq-status) {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: capitalize;
  }
  :global(.cq-status-awaiting_l1) { background: #dbeafe; color: #1d4ed8; }
  :global(.cq-status-awaiting_l2) { background: #fef3c7; color: #92400e; }
  :global(.cq-status-awaiting_l3) { background: #fee2e2; color: #b91c1c; }
  :global(.cq-status-approved)    { background: #dcfce7; color: #166534; }
  :global(.cq-status-rejected)    { background: #e2e8f0; color: #475569; }
  :global(.cq-status-returned)    { background: #ffedd5; color: #9a3412; }
  :global(.cq-status-open)        { background: #e0e7ff; color: #3730a3; }

  :global(.cq-sla) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
  }
  :global(.cq-sla-dot) {
    display: inline-block;
    width: 7px; height: 7px; border-radius: 50%;
    background: currentColor;
  }
  :global(.cq-sla-ok)     { color: #16a34a; }
  :global(.cq-sla-warn)   { color: #ca8a04; }
  :global(.cq-sla-hot)    { color: #ea580c; }
  :global(.cq-sla-breach) { color: #dc2626; }
  :global([data-theme='dark'] .cq-sla-ok)     { color: #4ade80; }
  :global([data-theme='dark'] .cq-sla-warn)   { color: #fbbf24; }
  :global([data-theme='dark'] .cq-sla-hot)    { color: #fb923c; }
  :global([data-theme='dark'] .cq-sla-breach) { color: #f87171; }

  :global(.cq-chain) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  :global(.cq-step) {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--sg-muted, #64748b);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  :global(.cq-step-active) {
    background: var(--sg-accent, #2563eb);
    color: var(--sg-on-accent, #fff);
  }
  :global(.cq-step-approved) { background: #dcfce7; color: #166534; }
  :global(.cq-step-rejected) { background: #fee2e2; color: #b91c1c; }
  :global(.cq-step-returned) { background: #ffedd5; color: #9a3412; }
  :global([data-theme='dark'] .cq-step-approved) { background: rgba(34,197,94,.18); color: #4ade80; }
  :global([data-theme='dark'] .cq-step-rejected) { background: rgba(239,68,68,.18); color: #f87171; }
  :global([data-theme='dark'] .cq-step-returned) { background: rgba(249,115,22,.18); color: #fdba74; }
  :global(.cq-step-mark) { font-size: 11px; }
  :global(.cq-step-arrow) { color: var(--sg-muted, #64748b); }

  /* History panel */
  .cq-history {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .cq-history-head {
    padding: 10px 12px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f1f5f9);
    font-size: 11.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .cq-history-meta {
    padding: 10px 12px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cq-history-meta strong { color: var(--sg-accent, #2563eb); font-family: ui-monospace, Menlo, monospace; }
  .cq-history-sub { font-size: 11.5px; color: var(--sg-muted, #64748b); }
  .cq-history-list {
    flex: 1 1 auto;
    overflow: auto;
    padding: 4px 0;
  }
  .cq-history-row {
    display: grid;
    grid-template-columns: 60px 1fr;
    grid-template-rows: auto auto;
    gap: 2px;
    padding: 8px 12px;
    font-size: 11.5px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .cq-history-time {
    grid-row: 1;
    color: var(--sg-muted, #64748b);
    font-family: ui-monospace, Menlo, monospace;
  }
  .cq-history-actor {
    grid-row: 1;
    grid-column: 2;
    font-weight: 600;
  }
  .cq-history-action {
    grid-column: 1 / -1;
    color: var(--sg-fg, #1e293b);
  }
  .cq-history-empty {
    padding: 16px;
    text-align: center;
    color: var(--sg-muted, #64748b);
    font-style: italic;
    font-size: 11.5px;
  }
  /* Phone: content-sized rows so the history panel is not clipped under the grid. */
  @media (max-width: 639px), (max-height: 500px) and (pointer: coarse) {
    .cq-body { grid-auto-rows: max-content; }
    .cq-history { max-height: 50vh; }
  }
</style>
