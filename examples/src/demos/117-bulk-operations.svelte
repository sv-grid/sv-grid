<script lang="ts">
  /**
   * 117. Server-side bulk operations (with progress + per-row result)
   * -----------------------------------------------------------------
   * Pick N rows → choose an action (approve / archive / re-assign /
   * delete) → submit. The mock server processes the batch with a
   * configurable concurrency, reports per-row success/failure, and
   * lets the user cancel mid-flight. Every row carries its outcome.
   *
   * Patterns shown:
   *   - Row-checkbox selection driving a sticky action bar (Gmail /
   *     Linear pattern).
   *   - Concurrency picker (1, 4, 10 parallel) - real APIs typically
   *     cap concurrency to play nice with downstream services.
   *   - Live progress bar + per-row outcome chip (queued, running,
   *     succeeded, failed, cancelled).
   *   - Cancel button that aborts in-flight requests and stops the
   *     queue without rolling back the rows that already succeeded.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  type Application = {
    id: string
    company: string
    amount: number
    status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'archived'
    submittedAt: string
    risk: 'low' | 'medium' | 'high'
  }

  let prng = 0xBEEF
  function rand() { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(a: readonly T[]): T { return a[Math.floor(rand() * a.length)]! }
  function int(min: number, max: number) { return Math.floor(min + rand() * (max - min + 1)) }

  const COMPANIES = ['Helios','Vertex','Atlas','Quantum','Stellar','Apex','Crescent','Sigma',
                     'Pioneer','Aurora','Granite','Cobalt','Meridian','Polaris','Sentinel',
                     'Tessera','Cascade','Beacon','Wavelength','Lumen','Echo','Cipher',
                     'Nimbus','Caldera','Sterling','Onyx','Slate','Ember','Verdant','Halcyon']

  let rows = $state<Application[]>(Array.from({ length: 28 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - int(0, 60))
    return {
      id: `APP-${(50_000 + i).toString()}`,
      company: `${pick(COMPANIES)} ${pick(['Labs', 'Group', 'Industries'])}`,
      amount: int(15_000, 480_000),
      status: pick(['pending', 'in_review', 'pending']),
      submittedAt: d.toISOString().slice(0, 10),
      risk: pick(['low', 'medium', 'low', 'high']),
    }
  }))

  // ---- Selection (in-demo so the bulk bar can read it) ----------------
  let selected = $state<Set<string>>(new Set())
  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    selected = next
  }
  function toggleAll() {
    if (selected.size === rows.length) selected = new Set()
    else selected = new Set(rows.map((r) => r.id))
  }
  const allChecked = $derived(selected.size === rows.length && rows.length > 0)
  const someChecked = $derived(selected.size > 0 && selected.size < rows.length)

  // ---- Bulk run state -------------------------------------------------
  type Action = 'approve' | 'archive' | 'reassign' | 'delete'
  type Outcome = 'idle' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

  let action = $state<Action>('approve')
  let concurrency = $state(4)
  let outcomes = $state<Record<string, { state: Outcome; message?: string }>>({})
  let runActive = $state(false)
  let cancelRequested = $state(false)
  let runStats = $state({ ok: 0, fail: 0, cancelled: 0, total: 0, startedAt: 0, finishedAt: 0 })

  function setOutcome(id: string, state: Outcome, message?: string) {
    outcomes = { ...outcomes, [id]: { state, message } }
  }

  // ---- Mock server processor ------------------------------------------
  async function processOne(row: Application, action: Action, signal: AbortSignal): Promise<{ ok: boolean; message?: string }> {
    // 200-700ms per row
    const latency = 200 + Math.random() * 500
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (signal.aborted) { reject(new Error('cancelled')); return }
        // Random rejections so the demo shows mixed outcomes
        if (action === 'approve' && row.risk === 'high' && Math.random() < 0.6) {
          resolve({ ok: false, message: 'Risk score too high for auto-approval' })
        } else if (action === 'delete' && row.amount > 250_000 && Math.random() < 0.7) {
          resolve({ ok: false, message: 'Cannot delete: amount > $250k requires CFO approval' })
        } else if (Math.random() < 0.08) {
          resolve({ ok: false, message: 'Upstream service timeout' })
        } else {
          resolve({ ok: true })
        }
      }, latency)
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('cancelled')) })
    })
  }

  // ---- Pool runner: at most N in flight at any time ------------------
  let abortCtrl: AbortController | null = null
  async function runBulk() {
    if (selected.size === 0 || runActive) return
    runActive = true
    cancelRequested = false
    abortCtrl = new AbortController()
    const ids = Array.from(selected)
    runStats = { ok: 0, fail: 0, cancelled: 0, total: ids.length, startedAt: performance.now(), finishedAt: 0 }
    // Mark every selected row as queued
    outcomes = { ...outcomes, ...Object.fromEntries(ids.map((id) => [id, { state: 'queued' } as { state: Outcome; message?: string }])) }

    let cursor = 0
    async function worker(): Promise<void> {
      while (cursor < ids.length) {
        if (cancelRequested) break
        const id = ids[cursor++]!
        const row = rows.find((r) => r.id === id)
        if (!row) continue
        setOutcome(id, 'running')
        try {
          const result = await processOne(row, action, abortCtrl!.signal)
          if (cancelRequested) { setOutcome(id, 'cancelled'); runStats = { ...runStats, cancelled: runStats.cancelled + 1 }; continue }
          if (result.ok) {
            setOutcome(id, 'succeeded')
            runStats = { ...runStats, ok: runStats.ok + 1 }
            applySuccessfulAction(id, action)
          } else {
            setOutcome(id, 'failed', result.message)
            runStats = { ...runStats, fail: runStats.fail + 1 }
          }
        } catch {
          setOutcome(id, 'cancelled')
          runStats = { ...runStats, cancelled: runStats.cancelled + 1 }
        }
      }
    }
    const pool = Array.from({ length: Math.min(concurrency, ids.length) }, worker)
    await Promise.all(pool)

    // Mark any rows that never started as cancelled
    for (const id of ids) {
      const o = outcomes[id]
      if (o?.state === 'queued') setOutcome(id, 'cancelled')
    }
    runStats = { ...runStats, finishedAt: performance.now() }
    runActive = false
    cancelRequested = false
    abortCtrl = null
  }

  function applySuccessfulAction(id: string, action: Action) {
    if (action === 'delete') {
      rows = rows.filter((r) => r.id !== id)
      selected = new Set([...selected].filter((s) => s !== id))
    } else if (action === 'approve') {
      rows = rows.map((r) => r.id === id ? { ...r, status: 'approved' } : r)
    } else if (action === 'archive') {
      rows = rows.map((r) => r.id === id ? { ...r, status: 'archived' } : r)
    } else if (action === 'reassign') {
      rows = rows.map((r) => r.id === id ? { ...r, status: 'in_review' } : r)
    }
  }

  function cancelRun() {
    if (!runActive) return
    cancelRequested = true
    abortCtrl?.abort()
  }

  function clearOutcomes() { outcomes = {} }

  // ---- KPIs ----------------------------------------------------------
  const progress = $derived.by(() => {
    const inFlight = Object.values(outcomes).filter((o) => o.state === 'running').length
    const done = runStats.ok + runStats.fail + runStats.cancelled
    return {
      done,
      inFlight,
      pct: runStats.total > 0 ? Math.round((done / runStats.total) * 100) : 0,
    }
  })
  const elapsedMs = $derived.by(() => {
    if (!runStats.startedAt) return 0
    return Math.round((runStats.finishedAt || performance.now()) - runStats.startedAt)
  })

  // ---- Columns -------------------------------------------------------
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const columns: ColumnDef<typeof features, Application>[] = [
    {
      id: 'select', header: '', width: 36, editable: false,
      cell: (c) => renderSnippet(SelectCell, { id: c.row.original.id }),
    },
    { field: 'id',          header: 'Application', width: 110, editable: false },
    { field: 'company',     header: 'Company',     width: 200, editable: false },
    { field: 'amount',      header: 'Amount',      width: 130, align: 'right', editable: false,
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
    { field: 'risk',        header: 'Risk',        width:  90, editable: false,
      cellClass: (ctx) => `risk-${ctx.getValue()}` },
    { field: 'status',      header: 'Status',      width: 120, editable: false,
      cellClass: (ctx) => `app-status-${String(ctx.getValue()).replaceAll('_', '-')}` },
    { field: 'submittedAt', header: 'Submitted',   width: 120, editable: false },
    {
      id: 'outcome', header: 'Outcome', width: 220, editable: false,
      cell: (c) => renderSnippet(OutcomeCell, { id: c.row.original.id }),
    },
  ]
</script>

{#snippet SelectCell(props: { id: string })}
  <input class="row-cbx" type="checkbox" aria-label="Select row"
    checked={selected.has(props.id)}
    onchange={() => toggle(props.id)}
    onclick={(e) => e.stopPropagation()} />
{/snippet}

{#snippet OutcomeCell(props: { id: string })}
  {@const o = outcomes[props.id]}
  {#if !o || o.state === 'idle'}
    <span class="oc oc-idle">-</span>
  {:else if o.state === 'queued'}
    <span class="oc oc-queued">queued</span>
  {:else if o.state === 'running'}
    <span class="oc oc-running"><span class="oc-spin"></span> running</span>
  {:else if o.state === 'succeeded'}
    <span class="oc oc-ok">✓ succeeded</span>
  {:else if o.state === 'cancelled'}
    <span class="oc oc-cancelled">⊘ cancelled</span>
  {:else}
    <span class="oc oc-fail" title={o.message ?? ''}>! {o.message ?? 'failed'}</span>
  {/if}
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <!-- Action bar (sticky-ish: just at the top of the panel) ----- -->
  <div class="action-bar shrink-0" class:is-active={selected.size > 0}>
    <div class="ab-left">
      <label class="select-all">
        <input type="checkbox"
          checked={allChecked}
          indeterminate={someChecked}
          onchange={toggleAll} />
        <span>{selected.size} selected</span>
      </label>
    </div>

    <div class="ab-mid">
      <label class="ctrl">
        <span>Action</span>
        <select bind:value={action} disabled={runActive}>
          <option value="approve">✓ Approve</option>
          <option value="reassign">↺ Re-assign for review</option>
          <option value="archive">📦 Archive</option>
          <option value="delete">🗑 Delete</option>
        </select>
      </label>
      <label class="ctrl">
        <span>Concurrency</span>
        <select bind:value={concurrency} disabled={runActive}>
          <option value={1}>1 (serial)</option>
          <option value={4}>4 (default)</option>
          <option value={10}>10 (aggressive)</option>
        </select>
      </label>
    </div>

    <div class="ab-right">
      {#if runActive}
        <button class="btn danger" onclick={cancelRun}>⏹ Cancel run</button>
      {:else}
        <button class="btn primary" disabled={selected.size === 0} onclick={runBulk}>
          Run on {selected.size} {selected.size === 1 ? 'row' : 'rows'}
        </button>
      {/if}
      <button class="btn alt" disabled={runActive || Object.keys(outcomes).length === 0} onclick={clearOutcomes}>
        Clear outcomes
      </button>
    </div>
  </div>

  <!-- Progress bar ---------------------------------------------- -->
  {#if runStats.total > 0}
    <div class="progress shrink-0">
      <div class="progress-bar">
        <div class="progress-fill" style:width={`${progress.pct}%`}></div>
      </div>
      <div class="progress-meta">
        <span><strong>{progress.done}</strong> / {runStats.total} done</span>
        <span><span class="dot ok"></span>{runStats.ok} ok</span>
        <span><span class="dot fail"></span>{runStats.fail} failed</span>
        <span><span class="dot cancelled"></span>{runStats.cancelled} cancelled</span>
        <span><span class="dot running"></span>{progress.inFlight} in flight</span>
        <span class="elapsed">{elapsedMs} ms elapsed</span>
      </div>
    </div>
  {/if}

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={false}
      enableRowSummaries={false}
      rowHeight={32}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>

<style>
  .action-bar {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; padding: 10px 12px;
    transition: border-color 150ms;
  }
  .action-bar.is-active {
    border-color: color-mix(in oklab, var(--sg-accent, #6366f1) 40%, transparent);
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 5%, transparent);
  }
  .ab-left { display: inline-flex; align-items: center; gap: 12px; }
  .select-all { display: inline-flex; align-items: center; gap: 6px;
                font-size: 13px; font-weight: 700; color: var(--sg-fg, #0f172a); cursor: pointer; }
  .select-all input { accent-color: var(--sg-accent, #6366f1); }

  .ab-mid { display: inline-flex; align-items: center; gap: 12px; }
  .ctrl { display: inline-flex; align-items: center; gap: 6px; }
  /* Phone: ACTION and CONCURRENCY with their selects do not fit one line;
     let the middle cluster wrap rather than truncate the labels. */
  @media (max-width: 639px) {
    .ab-mid { flex-wrap: wrap; }
    .ctrl > span { white-space: nowrap; }
  }
  .ctrl > span { font-size: 10px; font-weight: 800; letter-spacing: 0.06em;
                 text-transform: uppercase; color: var(--sg-muted, #64748b); }
  .ctrl select {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px; padding: 4px 8px; font-size: 12px; font-weight: 600;
  }
  .ab-right { margin-left: auto; display: inline-flex; gap: 6px; }
  .btn {
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px; padding: 6px 14px;
    font-size: 12.5px; font-weight: 700; cursor: pointer;
  }
  .btn:hover:not(:disabled) { background: var(--sg-row-hover-bg, color-mix(in oklab, #6366f1 6%, transparent)); }
  .btn:disabled { opacity: 0.45; cursor: default; filter: grayscale(1); }
  .btn.primary {
    background: var(--sg-accent, #6366f1); color: var(--sg-on-accent, #fff); border-color: transparent;
  }
  .btn.danger { background: #dc2626; color: #fff; border-color: transparent; }
  .btn.danger:hover { filter: brightness(1.08); }
  .btn.alt { color: var(--sg-muted, #64748b); }

  /* Progress ---------------------------------------------------- */
  .progress {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; padding: 8px 12px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .progress-bar {
    height: 8px; background: var(--sg-row-hover-bg, rgba(148,163,184,0.15));
    border-radius: 4px; overflow: hidden;
  }
  .progress-fill {
    /* Runs from the theme accent to green: the green end is the "done"
       signal, so it stays semantic rather than following the theme. */
    height: 100%; background: linear-gradient(90deg, var(--sg-accent, #6366f1), #16a34a);
    transition: width 200ms ease-out;
  }
  .progress-meta {
    display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
  .progress-meta strong { color: var(--sg-accent, #6366f1); font-variant-numeric: tabular-nums; }
  .progress-meta .dot { display: inline-block; width: 8px; height: 8px;
                        border-radius: 50%; margin-right: 4px; }
  .progress-meta .dot.ok        { background: #16a34a; }
  .progress-meta .dot.fail      { background: #dc2626; }
  .progress-meta .dot.cancelled { background: var(--sg-muted, #94a3b8); }
  .progress-meta .dot.running   { background: var(--sg-accent, #6366f1);
                                  animation: pulse 1.4s ease-out infinite; }
  @keyframes pulse {
    0%, 100% { opacity: 1; } 50% { opacity: 0.35; }
  }
  .progress-meta .elapsed { margin-left: auto; font-variant-numeric: tabular-nums; }

  /* Outcome chips ---------------------------------------------- */
  :global(.oc) {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 1px 9px; border-radius: 999px;
    font-size: 11px; font-weight: 700;
  }
  :global(.oc-idle)      { color: var(--sg-muted, #94a3b8); font-weight: 400; }
  :global(.oc-queued)    { background: var(--sg-bg-subtle, var(--sg-header-bg, #f1f5f9)); color: var(--sg-muted, #475569); }
  :global(.oc-running)   { background: color-mix(in oklab, var(--sg-accent, #6366f1) 14%, transparent);
                           color: var(--sg-accent, #5b21b6); }
  :global(.oc-ok)        { background: #dcfce7; color: #166534; }
  :global(.oc-fail)      { background: #fee2e2; color: #991b1b;
                           max-width: 200px;
                           white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  :global(.oc-cancelled) { background: var(--sg-bg-subtle, var(--sg-header-bg, #f8fafc)); color: var(--sg-muted, #64748b); }
  :global(.oc-spin) {
    display: inline-block; width: 9px; height: 9px;
    border: 1.5px solid color-mix(in oklab, var(--sg-accent, #5b21b6) 30%, transparent);
    border-top-color: var(--sg-accent, #5b21b6);
    border-radius: 50%; animation: oc-spin 700ms linear infinite;
  }
  @keyframes oc-spin { to { transform: rotate(360deg); } }

  /* Row decorations -------------------------------------------- */
  :global(.row-cbx) { width: 13px; height: 13px; accent-color: var(--sg-accent, #6366f1); cursor: pointer; }
  :global(td.risk-low)    { color: #16a34a; font-weight: 600; }
  :global(td.risk-medium) { color: #d97706; font-weight: 600; }
  :global(td.risk-high)   { color: #b91c1c; font-weight: 700; }

  :global(td.app-status-pending)   { color: var(--sg-accent, #6366f1); font-weight: 600; }
  :global(td.app-status-in-review) { color: #f59e0b; font-weight: 600; }
  :global(td.app-status-approved)  { color: #16a34a; font-weight: 700; }
  :global(td.app-status-archived)  { color: var(--sg-muted, #94a3b8); }
  :global(td.app-status-rejected)  { color: #b91c1c; font-weight: 600; }
</style>
