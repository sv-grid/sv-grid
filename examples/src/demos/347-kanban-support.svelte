<script lang="ts">
  // Kanban board rendering is an Enterprise feature - register the renderer.
  import { enableBoardView } from "@svgrid/enterprise";
  enableBoardView();
  /**
   * 347. Support triage (priority swimlanes + search + SLA)
   * ------------------------------------------------------
   * A helpdesk triage board: status lanes crossed with a swimlane per priority,
   * a search box front-and-center, and an SLA colour bar on each card driven by
   * ticket age. Drag a ticket to a new status, or across a band to re-triage
   * its priority.
   */
  import { SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature, type ColumnDef, type BoardCardMoveEvent, type BoardCardCommitEvent } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let view = $state<'board' | 'table'>('board')

  type Ticket = {
    id: number
    subject: string
    status: string
    priority: string
    customer: string
    ageH: number
  }

  let rows = $state<Ticket[]>([
    { id: 101, subject: 'Login loop after SSO', status: 'new', priority: 'Urgent', customer: 'Contoso', ageH: 26 },
    { id: 102, subject: 'Export missing columns', status: 'open', priority: 'High', customer: 'Fabrikam', ageH: 9 },
    { id: 103, subject: 'Typo on billing page', status: 'new', priority: 'Low', customer: 'Wingtip', ageH: 3 },
    { id: 104, subject: 'API 500 on bulk update', status: 'open', priority: 'Urgent', customer: 'Northwind', ageH: 40 },
    { id: 105, subject: 'Dark mode contrast', status: 'pending', priority: 'Normal', customer: 'Litware', ageH: 14 },
    { id: 106, subject: 'Slow board with 10k cards', status: 'open', priority: 'High', customer: 'Proseware', ageH: 5 },
    { id: 107, subject: 'Refund request', status: 'pending', priority: 'Normal', customer: 'Tailspin', ageH: 20 },
    { id: 108, subject: 'Feature: swimlanes', status: 'resolved', priority: 'Low', customer: 'Adventure', ageH: 2 },
    { id: 109, subject: 'Webhook retries', status: 'new', priority: 'High', customer: 'Contoso', ageH: 33 },
  ])

  const columns: ColumnDef<any, Ticket>[] = [
    { field: 'subject', header: 'Subject', editorType: 'text' },
    { field: 'customer', header: 'Customer', editorType: 'text' },
    { field: 'priority', header: 'Priority' },
    { field: 'status', header: 'Status' },
  ]

  const lanes = [
    { id: 'new', title: 'New' },
    { id: 'open', title: 'Open', color: '#3b82f6' },
    { id: 'pending', title: 'Pending', color: '#f59e0b' },
    { id: 'resolved', title: 'Resolved', color: '#22c55e' },
  ]

  // SLA: red past 24h, amber past 8h, else green.
  const sla = (h: number) => (h >= 24 ? '#ef4444' : h >= 8 ? '#f59e0b' : '#22c55e')

  function onCardMove(e: BoardCardMoveEvent<Ticket>) {
    e.row.status = e.toLane
    if (e.toSwimlane != null) e.row.priority = e.toSwimlane
  }
  function onCardCommit(e: BoardCardCommitEvent<Ticket>) {
    Object.assign(e.row, e.values)
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0">
    <div class="kb-lead text-sm">
      The same <strong>&lt;SvGrid&gt;</strong>, two views. Status lanes x a priority
      swimlane; search filters every field; the bar is the SLA (red &gt; 24h, amber &gt; 8h).
    </div>
    <div class="kb-seg inline-flex rounded-md overflow-hidden text-sm shrink-0">
      <button class="kb-seg-btn px-3 py-1 {view === 'board' ? 'kb-on' : ''}"
        onclick={() => (view = 'board')}>Board</button>
      <button class="kb-seg-btn px-3 py-1 {view === 'table' ? 'kb-on' : ''}"
        onclick={() => (view = 'table')}>Table</button>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    {#if view === 'board'}
      <SvGrid responsive={true}
        data={rows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        containerHeight="100%"
        board={{
          groupBy: 'status',
          lanes,
          swimlaneBy: 'priority',
        collapsibleSwimlanes: true,
          editable: true,
          searchPlaceholder: 'Search tickets...',
          laneSummary: (list) => `${list.length}`,
          onCardMove,
          onCardCommit,
          card: ticketCard,
        }}
      />
    {:else}
      <SvGrid responsive={true}
        data={rows}
        columns={columns}
        features={features}
        getRowId={(r) => String(r.id)}
        sortable
        filterable
        enableInlineEditing
        showPagination={false}
        rowHeight={36}
        containerHeight="100%"
        fitColumns
      />
    {/if}
  </div>

  <footer class="kb-foot text-sm shrink-0">
    {rows.length} open tickets · {rows.filter((t) => t.ageH >= 24).length} breaching SLA
  </footer>
</section>

{#snippet ticketCard(t: Ticket)}
  <div class="flex gap-2">
    <span class="w-1 rounded-full shrink-0" style="background:{sla(t.ageH)}"></span>
    <div class="flex flex-col gap-1 min-w-0">
      <div class="font-semibold text-[0.8rem] leading-snug truncate">{t.subject}</div>
      <div class="kb-card-meta flex items-center justify-between gap-2 text-[0.72rem]">
        <span class="truncate">{t.customer}</span>
        <span class="tabular-nums shrink-0">#{t.id} · {t.ageH}h</span>
      </div>
    </div>
  </div>
{/snippet}

<style>
  .kb-lead { color: var(--sg-fg, #475569); }
  .kb-foot { color: var(--sg-muted, #64748b); }
  .kb-seg { border: 1px solid var(--sg-border, #cbd5e1); }
  .kb-seg-btn { background: transparent; color: var(--sg-fg, #0f172a); }
  .kb-seg-btn:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .kb-seg-btn.kb-on { background: var(--sg-accent, #1e293b); color: var(--sg-on-accent, #fff); }
  .kb-card-meta { color: var(--sg-muted, #64748b); }
</style>
