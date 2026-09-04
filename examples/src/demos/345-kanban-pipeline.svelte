<script lang="ts">
  // Kanban board rendering is an Enterprise feature - register the renderer.
  import { enableBoardView } from "@svgrid/enterprise";
  enableBoardView();
  /**
   * 345. Sales pipeline (custom cards + $ totals + persistence)
   * ----------------------------------------------------------
   * A CRM deal board: stages as lanes, rich deal cards, and a live total-value
   * roll-up per stage via `board.laneSummary`. Moves and edits persist to
   * localStorage through onCardMove / onCardCommit, so a reload restores the
   * board. Hit Reset to reseed.
   */
  import { SvGrid, SvAvatar, tableFeatures, rowSortingFeature, columnFilteringFeature, type ColumnDef, type BoardCardMoveEvent, type BoardCardCommitEvent } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let view = $state<'board' | 'table'>('board')

  type Deal = {
    id: number
    company: string
    stage: string
    amount: number
    owner: string
    closeDate: string
  }

  const SEED: Deal[] = [
    { id: 1, company: 'Northwind Traders', stage: 'lead', amount: 12000, owner: 'Sam Rivera', closeDate: '2026-08-14' },
    { id: 2, company: 'Contoso', stage: 'qualified', amount: 48000, owner: 'Lee Park', closeDate: '2026-08-02' },
    { id: 3, company: 'Fabrikam', stage: 'proposal', amount: 120000, owner: 'Ada Cole', closeDate: '2026-07-28' },
    { id: 4, company: 'Adventure Works', stage: 'qualified', amount: 26000, owner: 'Sam Rivera', closeDate: '2026-09-01' },
    { id: 5, company: 'Tailspin Toys', stage: 'won', amount: 64000, owner: 'Ada Cole', closeDate: '2026-07-10' },
    { id: 6, company: 'Wingtip', stage: 'lead', amount: 9000, owner: 'Lee Park', closeDate: '2026-08-20' },
    { id: 7, company: 'Proseware', stage: 'proposal', amount: 85000, owner: 'Sam Rivera', closeDate: '2026-08-08' },
    { id: 8, company: 'Litware', stage: 'lost', amount: 30000, owner: 'Lee Park', closeDate: '2026-07-05' },
  ]

  const KEY = 'svgrid-demo-pipeline'
  const LAYOUT_KEY = 'svgrid-demo-pipeline-layout'
  let resetToken = $state(0)
  const load = (): Deal[] => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return structuredClone(SEED)
  }
  let rows = $state<Deal[]>(load())
  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(rows)) } catch { /* ignore */ }
  }

  const columns: ColumnDef<any, Deal>[] = [
    { field: 'company', header: 'Company', editorType: 'text' },
    { field: 'amount', header: 'Amount', editorType: 'number' },
    { field: 'owner', header: 'Owner', editorType: 'text' },
    { field: 'closeDate', header: 'Close date', editorType: 'text' },
    { field: 'stage', header: 'Stage' },
  ]

  const lanes = [
    { id: 'lead', title: 'Lead' },
    { id: 'qualified', title: 'Qualified', color: '#3b82f6' },
    { id: 'proposal', title: 'Proposal', color: '#f59e0b' },
    { id: 'won', title: 'Won', color: '#22c55e' },
    { id: 'lost', title: 'Lost', color: '#ef4444' },
  ]

  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const laneTotal = (list: Deal[]) => usd.format(list.reduce((s, d) => s + d.amount, 0))

  function onCardMove(e: BoardCardMoveEvent<Deal>) {
    e.row.stage = e.toLane
    persist()
  }
  function onCardCommit(e: BoardCardCommitEvent<Deal>) {
    Object.assign(e.row, e.values)
    persist()
  }
  function reset() {
    rows = structuredClone(SEED)
    persist()
    try { localStorage.removeItem(LAYOUT_KEY) } catch { /* ignore */ }
    resetToken += 1 // remount the board so it drops its restored layout
  }
</script>

<section class="kb flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0">
    <div class="kb-note text-sm">
      The same <strong>&lt;SvGrid&gt;</strong>, two views. Deal stages as lanes with a
      live <strong>total value</strong> per stage. The whole board layout - card order,
      edits, collapsed lanes - persists via <code>board.persistKey</code>; reload and it's
      exactly as you left it. Reset to reseed.
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <div class="kb-seg inline-flex rounded-md border overflow-hidden text-sm">
        <button class="kb-seg-btn px-3 py-1 {view === 'board' ? 'kb-on' : ''}"
          onclick={() => (view = 'board')}>Board</button>
        <button class="kb-seg-btn px-3 py-1 {view === 'table' ? 'kb-on' : ''}"
          onclick={() => (view = 'table')}>Table</button>
      </div>
      <button
        class="kb-btn px-3 py-1 text-sm rounded-md border"
        onclick={reset}>Reset</button>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    {#if view === 'board'}
      {#key resetToken}
        <SvGrid responsive={true}
      columnResize
          data={rows}
          columns={columns}
          getRowId={(r) => String(r.id)}
          containerHeight="100%"
          board={{
            groupBy: 'stage',
            lanes,
            editable: true,
            collapsibleLanes: true,
            persistKey: LAYOUT_KEY,
            laneSummary: (list) => laneTotal(list as Deal[]),
            onCardMove,
            onCardCommit,
            card: dealCard,
          }}
        />
      {/key}
    {:else}
      <SvGrid responsive={true}
      columnResize
        data={rows}
        columns={columns}
        features={features}
        getRowId={(r) => String(r.id)}
        sortable
        filterable
        enableInlineEditing
        rowHeight={36}
        containerHeight="100%"
        fitColumns
      />
    {/if}
  </div>

  <footer class="kb-muted text-sm shrink-0">
    {rows.length} deals · {laneTotal(rows)} in pipeline
  </footer>
</section>

{#snippet dealCard(d: Deal)}
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between gap-2">
      <span class="font-semibold text-[0.82rem]">{d.company}</span>
      <span class="kb-amount text-[0.8rem] font-semibold">{usd.format(d.amount)}</span>
    </div>
    <div class="kb-muted flex items-center justify-between gap-2 text-[0.72rem]">
      <span class="inline-flex items-center gap-1.5">
        <SvAvatar name={d.owner} size={18} />
        {d.owner.split(' ')[0]}
      </span>
      <span>{d.closeDate}</span>
    </div>
  </div>
{/snippet}

<style>
  /* Deal value stays green - it reads as money, not chrome - so it is a
   * local prop with a dark variant rather than a theme token. */
  .kb { --kb-amount: #16a34a; }
  :global([data-theme='dark']) .kb { --kb-amount: #4ade80; }

  .kb-note  { color: var(--sg-muted, #475569); }
  .kb-muted { color: var(--sg-muted, #64748b); }
  .kb-seg   { border-color: var(--sg-border, #cbd5e1); }
  .kb-seg-btn {
    background: transparent;
    color: inherit;
    border: 0;
    cursor: pointer;
  }
  .kb-seg-btn.kb-on { background: var(--sg-accent, #1e293b); color: var(--sg-on-accent, #fff); }
  .kb-btn {
    border-color: var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
  }
  .kb-btn:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .kb-amount { color: var(--kb-amount, #16a34a); }
</style>
