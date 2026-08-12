<script lang="ts">
  /**
   * 88. Staged / batch editing - compensation review (Pro)
   * ------------------------------------------------------
   * Real-world scenario: comp review cycle. HR opens the grid with
   * proposed salary + bonus + level changes. Each edit goes into a
   * draft buffer instead of writing through; the right rail shows the
   * pending diff per employee with totals + the cost impact. The user
   * commits the whole batch atomically (one server roundtrip) or
   * reverts to the original snapshot.
   *
   * Built on `createStagedEditing<TData>()` from @svgrid/enterprise. The grid
   * surface is plain SvGrid - the staging engine sits next to it.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import {
    createStagedEditing,
    installEnterprise,
    setLicenseKey,
    type EnterpriseGridApi,
    type StagedChange,
  } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-DEMO')

  type Level = 'L3' | 'L4' | 'L5' | 'L6' | 'L7'
  type Employee = {
    id: string
    name: string
    team: 'Engineering' | 'Design' | 'Product' | 'Sales' | 'Support'
    level: Level
    salary: number
    bonus: number
    rating: 'Below' | 'Meets' | 'Exceeds' | 'Outstanding'
    promotionReason: string
  }

  let rows = $state<Employee[]>([
    { id: 'e01', name: 'Ada Lovelace',     team: 'Engineering', level: 'L6', salary: 215_000, bonus: 30_000, rating: 'Outstanding', promotionReason: 'Shipped the new pivot engine; coached two L4s to L5.' },
    { id: 'e02', name: 'Linus Torvalds',   team: 'Engineering', level: 'L7', salary: 280_000, bonus: 50_000, rating: 'Outstanding', promotionReason: 'Architected the row-virtualizer rewrite; cut frame time by 60%.' },
    { id: 'e03', name: 'Grace Hopper',     team: 'Engineering', level: 'L6', salary: 220_000, bonus: 28_000, rating: 'Exceeds', promotionReason: '' },
    { id: 'e04', name: 'Margaret Hamilton',team: 'Engineering', level: 'L5', salary: 185_000, bonus: 18_000, rating: 'Exceeds', promotionReason: 'Owned the editor pipeline rewrite.' },
    { id: 'e05', name: 'Don Knuth',         team: 'Engineering', level: 'L7', salary: 295_000, bonus: 45_000, rating: 'Outstanding', promotionReason: '' },
    { id: 'e06', name: 'Edsger Dijkstra',  team: 'Engineering', level: 'L6', salary: 225_000, bonus: 32_000, rating: 'Meets', promotionReason: '' },
    { id: 'e07', name: 'Barbara Liskov',   team: 'Engineering', level: 'L7', salary: 290_000, bonus: 48_000, rating: 'Exceeds', promotionReason: '' },
    { id: 'e08', name: 'Tim Berners-Lee',  team: 'Product',     level: 'L6', salary: 200_000, bonus: 25_000, rating: 'Meets', promotionReason: '' },
    { id: 'e09', name: 'Yukihiro Matsumoto',team: 'Engineering',level: 'L5', salary: 175_000, bonus: 15_000, rating: 'Meets', promotionReason: '' },
    { id: 'e10', name: 'Brendan Eich',     team: 'Engineering', level: 'L6', salary: 210_000, bonus: 26_000, rating: 'Below', promotionReason: '' },
    { id: 'e11', name: 'Anders Hejlsberg', team: 'Engineering', level: 'L7', salary: 275_000, bonus: 42_000, rating: 'Exceeds', promotionReason: '' },
    { id: 'e12', name: 'Bjarne Stroustrup',team: 'Engineering', level: 'L7', salary: 285_000, bonus: 44_000, rating: 'Meets', promotionReason: '' },
  ])

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<EnterpriseGridApi<typeof features, Employee> | null>(null)
  const stage = createStagedEditing<Employee>()

  // Tick to refresh the panel after each record / drop. The stage
  // buffer is plain JS state outside Svelte's reactivity.
  let tick = $state(0)
  const pending = $derived.by(() => { void tick; return stage.changes() })
  const grouped = $derived.by(() => { void tick; return stage.changesByRow() })
  const dirty   = $derived.by(() => { void tick; return stage.isDirty() })

  // Cost impact preview: sum of staged salary deltas + bonus deltas.
  const costImpact = $derived.by(() => {
    void tick
    let salaryDelta = 0
    let bonusDelta  = 0
    for (const c of stage.changes()) {
      const before = Number(c.original) || 0
      const after  = Number(c.staged)  || 0
      if (c.columnId === 'salary') salaryDelta += after - before
      else if (c.columnId === 'bonus') bonusDelta += after - before
    }
    return { salaryDelta, bonusDelta, total: salaryDelta + bonusDelta }
  })

  let committing = $state(false)
  let lastResult = $state<string | null>(null)

  async function commit() {
    committing = true
    lastResult = null
    try {
      await stage.commit(async () => {
        await new Promise((r) => setTimeout(r, 700))  // simulate /api/comp/batch
      })
      lastResult = `Committed ${pending.length} change${pending.length === 1 ? '' : 's'}`
    } catch (e) {
      lastResult = `Commit failed: ${String(e)}`
    } finally {
      committing = false
      tick++
    }
  }

  function revert() {
    if (!api) return
    const n = pending.length
    stage.revert((rowIndex, columnId, original) => {
      api!.setCellValue(rowIndex, columnId, original)
    })
    tick++
    lastResult = `Reverted ${n} change${n === 1 ? '' : 's'}`
  }

  function dropChange(c: StagedChange<Employee>) {
    if (!api) return
    api.setCellValue(c.rowIndex, c.columnId, c.original)
    stage.drop(c.rowId, c.columnId)
    tick++
  }

  const fmtMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  function fmtCellValue(c: StagedChange<Employee>, which: 'original' | 'staged'): string {
    const v = which === 'original' ? c.original : c.staged
    if (v == null || v === '') return '-'
    if (c.columnId === 'salary' || c.columnId === 'bonus') return fmtMoney.format(Number(v))
    return String(v)
  }
  function fmtColumn(id: string): string {
    return ({
      name: 'Name', team: 'Team', level: 'Level', salary: 'Salary',
      bonus: 'Bonus', rating: 'Rating', promotionReason: 'Reason',
    } as Record<string, string>)[id] ?? id
  }

  const columns: ColumnDef<typeof features, Employee>[] = [
    { field: 'name',     header: 'Employee', editable: false, width: 170, tooltip: 'Read-only - change through HRIS' },
    { field: 'team',     header: 'Team',     editable: false, width: 120 },
    { field: 'level',    header: 'Level',
      editorType: 'select', editorOptions: ['L3', 'L4', 'L5', 'L6', 'L7'], width: 100 },
    { field: 'rating',   header: 'Rating',
      editorType: 'rich-select',
      editorOptions: ['Below', 'Meets', 'Exceeds', 'Outstanding'], width: 140 },
    { field: 'salary',   header: 'Salary',
      editorType: 'number',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } }, width: 140 },
    { field: 'bonus',    header: 'Bonus',
      editorType: 'number',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } }, width: 130 },
    { field: 'promotionReason', header: 'Promotion reason',
      editorType: 'textarea', width: 280,
      tooltip: 'Required when raising level. Multi-line; press Tab or Ctrl+Enter to commit.' },
  ]
</script>

<section class="staged-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- Header strip -->
  <header class="staged-head shrink-0">
    <div class="head-left">
      <span class="head-badge">Pro</span>
      <div>
        <h2>2026 Comp review · Engineering</h2>
        <p>Edit any cell - changes stage as a draft until you Commit.</p>
      </div>
    </div>
    <div class="head-actions">
      <button type="button" class="ghost"
        disabled={committing || !dirty}
        onclick={revert}>
        ↺ Revert all
      </button>
      <button type="button" class="primary"
        disabled={committing || !dirty}
        onclick={commit}>
        {#if committing}
          Committing…
        {:else}
          ✓ Commit {pending.length} change{pending.length === 1 ? '' : 's'}
        {/if}
      </button>
    </div>
  </header>

  <!-- KPI strip -->
  <div class="kpi-row shrink-0">
    <div class="kpi">
      <div class="kpi-label">Employees</div>
      <div class="kpi-value">{rows.length}</div>
    </div>
    <div class="kpi" class:kpi-pending={pending.length > 0}>
      <div class="kpi-label">Pending edits</div>
      <div class="kpi-value">{pending.length}</div>
      <div class="kpi-sub">{grouped.length} employee{grouped.length === 1 ? '' : 's'} affected</div>
    </div>
    <div class="kpi" class:kpi-up={costImpact.salaryDelta > 0} class:kpi-down={costImpact.salaryDelta < 0}>
      <div class="kpi-label">Salary delta</div>
      <div class="kpi-value">{costImpact.salaryDelta >= 0 ? '+' : ''}{fmtMoney.format(costImpact.salaryDelta)}</div>
    </div>
    <div class="kpi" class:kpi-up={costImpact.bonusDelta > 0} class:kpi-down={costImpact.bonusDelta < 0}>
      <div class="kpi-label">Bonus delta</div>
      <div class="kpi-value">{costImpact.bonusDelta >= 0 ? '+' : ''}{fmtMoney.format(costImpact.bonusDelta)}</div>
    </div>
    <div class="kpi kpi-accent">
      <div class="kpi-label">Total impact</div>
      <div class="kpi-value">{costImpact.total >= 0 ? '+' : ''}{fmtMoney.format(costImpact.total)}</div>
      <div class="kpi-sub">annualised</div>
    </div>
  </div>

  {#if lastResult}
    <div class="result-banner shrink-0">{lastResult}</div>
  {/if}

  <div class="layout flex-1 min-h-0">
    <!-- Grid -->
    <div class="grid-card min-h-0">
      <SvGrid responsive={true}
        data={rows}
        columns={columns}
        features={features}
        filterMode="menu"
        selectionMode="cell"
        showPagination={false}
        enableInlineEditing={true}
        enableCellSelection={true}
        enableRowSummaries={false}
        rowHeight={40}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(next) => (api = installEnterprise(next))}
        onCellValueChange={(e) => { stage.record(e); tick++ }}
      />
    </div>

    <!-- Right rail: pending changes per row -->
    <aside class="stage-rail">
      <header>
        <strong>Pending changes</strong>
        {#if dirty}<span class="badge">{pending.length}</span>{/if}
      </header>
      {#if !dirty}
        <div class="empty">
          <div class="empty-icon">✎</div>
          <p><strong>No pending changes.</strong></p>
          <p>Edit any cell - level, rating, salary, bonus, or reason - and the diff lands here.</p>
        </div>
      {:else}
        <div class="rail-body">
          {#each grouped as g (g.rowId)}
            {@const emp = rows.find((r) => r.id === g.rowId)}
            <article class="emp-card">
              <header class="emp-head">
                <div class="emp-id">
                  <span class="emp-avatar" aria-hidden="true">{(emp?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                  <div>
                    <div class="emp-name">{emp?.name ?? g.rowId}</div>
                    <div class="emp-meta">{emp?.team} · {emp?.level}</div>
                  </div>
                </div>
                <span class="emp-cnt">{g.cells.length} change{g.cells.length === 1 ? '' : 's'}</span>
              </header>
              <ul class="emp-diffs">
                {#each g.cells as c (c.columnId)}
                  <li>
                    <span class="diff-col">{fmtColumn(c.columnId)}</span>
                    <span class="diff-from">{fmtCellValue(c, 'original')}</span>
                    <span class="diff-arrow">→</span>
                    <span class="diff-to">{fmtCellValue(c, 'staged')}</span>
                    <button type="button" class="diff-drop"
                      aria-label="Discard this change"
                      title="Discard"
                      onclick={() => dropChange(c)}>×</button>
                  </li>
                {/each}
              </ul>
            </article>
          {/each}
        </div>
      {/if}
    </aside>
  </div>
</section>

<style>
  .staged-shell {
    font-family: inherit;
    /* Diff colours carry meaning (removed vs added) rather than brand, so they
       stay red/green under every preset - only their lightness tracks the mode
       so they stay legible on a dark ground. */
    --diff-neg: #b91c1c;
    --diff-pos: #047857;
  }
  :global([data-theme="dark"]) .staged-shell {
    --diff-neg: #f87171;
    --diff-pos: #34d399;
  }

  /* ---- Header ---- */
  .staged-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; flex-wrap: wrap;
    padding: 14px 16px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg-subtle, var(--sg-header-bg, #f8fafc));
    border-radius: 10px;
  }
  .head-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .head-badge {
    display: inline-block;
    background: var(--sg-accent, #6366f1);
    color: var(--sg-on-accent, #fff); font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
    padding: 4px 10px; border-radius: 999px; text-transform: uppercase;
  }
  .staged-head h2 { margin: 0; font-size: 16px; font-weight: 700; color: var(--sg-fg, #0f172a); }
  .staged-head p  { margin: 2px 0 0; font-size: 12.5px; color: var(--sg-muted, #64748b); }
  .head-actions { display: inline-flex; gap: 8px; align-items: center; }
  .head-actions .ghost {
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 6px; padding: 7px 14px;
    font-size: 12.5px; font-weight: 600; cursor: pointer;
  }
  .head-actions .ghost:hover:not(:disabled) { background: var(--sg-row-hover-bg, rgba(148, 163, 184, 0.10)); }
  .head-actions .ghost:disabled { opacity: 0.4; cursor: default; }
  .head-actions .primary {
    background: #047857; color: #fff; border: 0; border-radius: 6px;
    padding: 7px 16px; font-size: 12.5px; font-weight: 700; cursor: pointer;
    box-shadow: 0 2px 8px rgba(4, 120, 87, 0.18);
  }
  .head-actions .primary:hover:not(:disabled) { background: #065f46; }
  .head-actions .primary:disabled { background: var(--sg-row-hover-bg, #e2e8f0); color: var(--sg-muted, #94a3b8); cursor: default; box-shadow: none; }

  /* ---- KPI strip ---- */
  .kpi-row {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
  }
  .kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .kpi-label { font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sg-muted, #64748b); font-weight: 600; }
  .kpi-value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--sg-fg, #0f172a); line-height: 1.1; }
  .kpi-sub   { font-size: 11px; color: var(--sg-muted, #94a3b8); }
  .kpi-pending { border-left: 3px solid #f59e0b; }
  .kpi-up      { border-left: 3px solid #10b981; }
  .kpi-up .kpi-value      { color: var(--diff-pos, #047857); }
  .kpi-down    { border-left: 3px solid #ef4444; }
  .kpi-down .kpi-value    { color: var(--diff-neg, #b91c1c); }
  .kpi-accent  { border-left: 3px solid var(--sg-accent, #6366f1); background: linear-gradient(135deg, color-mix(in srgb, var(--sg-accent, #6366f1) 6%, transparent), transparent); }
  .kpi-accent .kpi-value  { color: var(--sg-accent, #4338ca); }

  .result-banner {
    padding: 8px 14px;
    background: rgba(16, 185, 129, 0.10);
    color: var(--diff-pos, #047857);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 8px;
    font-size: 12.5px; font-weight: 600;
  }

  /* ---- Layout ---- */
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: 12px;
    min-height: 0;
  }
  .grid-card {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    overflow: hidden;
    min-width: 0;
  }

  /* ---- Right rail ---- */
  .stage-rail {
    display: flex; flex-direction: column; min-height: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px; overflow: hidden;
  }
  .stage-rail header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc);
  }
  .stage-rail header strong { font-size: 13px; color: var(--sg-fg, #0f172a); }
  .stage-rail .badge {
    background: var(--sg-accent, #4338ca); color: var(--sg-on-accent, #fff);
    font-size: 11px; font-weight: 700;
    padding: 2px 8px; border-radius: 999px;
  }

  .empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    flex: 1; padding: 24px; text-align: center; gap: 4px;
    color: var(--sg-muted, #94a3b8);
  }
  .empty-icon {
    width: 48px; height: 48px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sg-muted, #94a3b8) 12%, transparent);
    display: grid; place-items: center;
    color: var(--sg-muted, #94a3b8);
    font-size: 22px;
    margin-bottom: 6px;
  }
  .empty p { margin: 0; font-size: 13px; line-height: 1.45; max-width: 240px; }
  .empty p strong { color: var(--sg-fg, #0f172a); }

  .rail-body {
    overflow-y: auto;
    padding: 10px;
    display: flex; flex-direction: column; gap: 8px;
    min-height: 0;
  }

  .emp-card {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    overflow: hidden;
  }
  .emp-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 6px;
    padding: 8px 10px;
    background: var(--sg-bg-subtle, var(--sg-header-bg, #f8fafc));
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .emp-id { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
  .emp-avatar {
    width: 28px; height: 28px; border-radius: 999px;
    background: var(--sg-accent, #6366f1);
    color: var(--sg-on-accent, #fff); font-size: 11px; font-weight: 700;
    display: grid; place-items: center;
    flex-shrink: 0;
  }
  .emp-name { font-size: 13px; font-weight: 600; color: var(--sg-fg, #0f172a); }
  .emp-meta { font-size: 10.5px; color: var(--sg-muted, #64748b); }
  .emp-cnt  { font-size: 10.5px; color: var(--sg-muted, #64748b); }

  .emp-diffs { list-style: none; margin: 0; padding: 4px 0; }
  .emp-diffs li {
    display: grid;
    grid-template-columns: 90px 1fr 14px 1fr 22px;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    font-size: 12px;
  }
  .emp-diffs li + li { border-top: 1px dashed var(--sg-border, rgba(148, 163, 184, 0.20)); }
  .diff-col   { font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sg-muted, #64748b); font-weight: 600; }
  .diff-from  { color: var(--diff-neg, #b91c1c); text-decoration: line-through; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .diff-arrow { color: var(--sg-muted, #94a3b8); text-align: center; }
  .diff-to    { color: var(--diff-pos, #047857); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .diff-drop  {
    background: transparent; border: 0;
    color: var(--sg-muted, #94a3b8);
    width: 22px; height: 22px; border-radius: 4px;
    cursor: pointer; font-size: 14px; line-height: 1;
  }
  .diff-drop:hover { background: rgba(239, 68, 68, 0.10); color: var(--diff-neg, #b91c1c); }
</style>
