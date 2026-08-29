<script lang="ts">
  /**
   * 387. Meridian Capital - a research & earnings desk (enterprise)
   * -------------------------------------------------------------
   * One dataset, five surfaces, in a dockable workspace: the SAME research
   * events render as a Scheduler (calendar), a Grid (table), a Kanban pipeline
   * (by workflow stage), and a Chart (exposure by asset class) - all inside an
   * SvDockManager you can drag / resize / float. Editing in any view (drag an
   * event, move a card, edit a cell) writes back to the one `rows` array, so
   * every surface stays in sync. Grid is the hero.
   */
  import {
    SvGrid,
    SvGridChart,
    SvDockManager,
    dockGroup,
    dockTabs,
    dockPane,
    type DockManagerState,
    type ChartSpec,
    type ColumnDef,
    type SchedulerResource,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerEventCommitEvent,
    type BoardCardMoveEvent,
    type BoardCardCommitEvent,
  } from '@svgrid/grid'
  import { enableSchedulerView, enableBoardView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()
  enableBoardView()

  type Stage = 'To review' | 'Modeling' | 'Published' | 'Archived'
  type Klass = 'Earnings' | 'Macro' | 'Meeting' | 'Roadshow'
  type Ev = {
    id: number; title: string; ticker: string; kind: Klass; analyst: string
    stage: Stage; exposure: number; start: string; end: string; color: string
  }

  const KIND: Record<Klass, string> = { Earnings: '#4f46e5', Macro: '#0891b2', Meeting: '#16a34a', Roadshow: '#d97706' }
  const kinds = Object.keys(KIND) as Klass[]
  const STAGE: Record<Stage, string> = { 'To review': '#94a3b8', Modeling: '#d97706', Published: '#16a34a', Archived: '#64748b' }
  const stages = Object.keys(STAGE) as Stage[]
  const analysts = ['Priya', 'Marco', 'Dana', 'Lena']

  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const monday = new Date()
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const at = (day: number, h: number, m = 0) => { const d = new Date(monday); d.setDate(monday.getDate() + day); d.setHours(h, m, 0, 0); return iso(d) }
  const mk = (e: Omit<Ev, 'color'>): Ev => ({ ...e, color: KIND[e.kind] })

  let seq = 100
  let rows = $state<Ev[]>([
    mk({ id: 1, title: 'NVDA Q3 earnings call', ticker: 'NVDA', kind: 'Earnings', analyst: 'Priya', stage: 'Modeling', exposure: 42, start: at(0, 9, 0), end: at(0, 10, 0) }),
    mk({ id: 2, title: 'CPI print', ticker: 'MACRO', kind: 'Macro', analyst: 'Marco', stage: 'To review', exposure: 30, start: at(0, 8, 30), end: at(0, 9, 0) }),
    mk({ id: 3, title: 'AAPL mgmt meeting', ticker: 'AAPL', kind: 'Meeting', analyst: 'Dana', stage: 'To review', exposure: 28, start: at(0, 13, 0), end: at(0, 14, 0) }),
    mk({ id: 4, title: 'TSLA Q3 earnings', ticker: 'TSLA', kind: 'Earnings', analyst: 'Lena', stage: 'Modeling', exposure: 25, start: at(1, 9, 30), end: at(1, 10, 30) }),
    mk({ id: 5, title: 'Fed minutes', ticker: 'MACRO', kind: 'Macro', analyst: 'Marco', stage: 'Published', exposure: 18, start: at(1, 14, 0), end: at(1, 14, 30) }),
    mk({ id: 6, title: 'MSFT roadshow', ticker: 'MSFT', kind: 'Roadshow', analyst: 'Priya', stage: 'To review', exposure: 22, start: at(2, 10, 0), end: at(2, 12, 0) }),
    mk({ id: 7, title: 'AMZN earnings prep', ticker: 'AMZN', kind: 'Earnings', analyst: 'Dana', stage: 'Modeling', exposure: 31, start: at(2, 9, 0), end: at(2, 9, 45) }),
    mk({ id: 8, title: 'Jobs report', ticker: 'MACRO', kind: 'Macro', analyst: 'Marco', stage: 'To review', exposure: 20, start: at(3, 8, 30), end: at(3, 9, 0) }),
    mk({ id: 9, title: 'GOOGL earnings', ticker: 'GOOGL', kind: 'Earnings', analyst: 'Lena', stage: 'Published', exposure: 27, start: at(3, 11, 0), end: at(3, 12, 0) }),
    mk({ id: 10, title: 'JPM investor day', ticker: 'JPM', kind: 'Roadshow', analyst: 'Priya', stage: 'Modeling', exposure: 16, start: at(3, 14, 0), end: at(3, 16, 0) }),
    mk({ id: 11, title: 'META mgmt call', ticker: 'META', kind: 'Meeting', analyst: 'Dana', stage: 'Published', exposure: 19, start: at(4, 9, 30), end: at(4, 10, 30) }),
    mk({ id: 12, title: 'AMD earnings', ticker: 'AMD', kind: 'Earnings', analyst: 'Lena', stage: 'Archived', exposure: 14, start: at(4, 13, 0), end: at(4, 14, 0) }),
    mk({ id: 13, title: 'Retail sales', ticker: 'MACRO', kind: 'Macro', analyst: 'Marco', stage: 'To review', exposure: 12, start: at(4, 8, 30), end: at(4, 9, 0) }),
    mk({ id: 14, title: 'ORCL roadshow', ticker: 'ORCL', kind: 'Roadshow', analyst: 'Priya', stage: 'Modeling', exposure: 15, start: at(2, 15, 0), end: at(2, 16, 30) }),
  ])

  const resources: SchedulerResource[] = analysts.map((a) => ({ id: a, title: a }))

  const columns: ColumnDef<any, Ev>[] = [
    { field: 'title', header: 'Event', editorType: 'text', width: 190 },
    { field: 'ticker', header: 'Ticker', editorType: 'text', width: 90 },
    { field: 'kind', header: 'Class', editorType: 'list', editorOptions: kinds.map((k) => ({ value: k, label: k, color: KIND[k] })), width: 110 },
    { field: 'analyst', header: 'Analyst', editorType: 'list', editorOptions: analysts.map((a) => ({ value: a, label: a })), width: 100 },
    { field: 'stage', header: 'Stage', editorType: 'list', editorOptions: stages.map((s) => ({ value: s, label: s, color: STAGE[s] })), width: 120 },
    { field: 'exposure', header: 'Exposure ($M)', editorType: 'number', width: 120 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]

  // Chart: exposure ($M) by asset class, split by stage (stacked). Derived, so
  // moving a card / editing a cell re-draws it live.
  const chartSpec = $derived<ChartSpec>({
    type: 'bar',
    stacked: true,
    categories: kinds,
    series: stages.map((st) => ({
      label: st,
      color: STAGE[st],
      values: kinds.map((k) => rows.filter((r) => r.kind === k && r.stage === st).reduce((s, r) => s + r.exposure, 0)),
    })),
  })

  function onEventMove(e: SchedulerEventMoveEvent<Ev>) { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource != null) e.row.analyst = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Ev>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Ev>) { Object.assign(e.row, e.values); e.row.color = KIND[e.row.kind] ?? e.row.color }
  function onCardMove(e: BoardCardMoveEvent<Ev>) { e.row.stage = e.toLane as Stage }
  function onCardCommit(e: BoardCardCommitEvent<Ev>) { Object.assign(e.row, e.values); e.row.color = KIND[e.row.kind] ?? e.row.color }

  const LAYOUT_KEY = 'svgrid-financial-layout-v1'
  const defaultWorkspace = (): DockManagerState => ({
    main: dockGroup('row', [
      dockGroup('column', [
        dockTabs([dockPane('calendar', 'Calendar', { minSize: 200 })]),
        dockTabs([dockPane('board', 'Pipeline', { minSize: 160 })]),
      ], [0.56, 0.44]),
      dockGroup('column', [
        dockTabs([dockPane('chart', 'Exposure', { minSize: 140 })]),
        dockTabs([dockPane('grid', 'Events', { minSize: 140 })]),
      ], [0.42, 0.58]),
    ], [0.62, 0.38]),
    floating: [],
    autoHide: [],
  })
  function loadWorkspace(): DockManagerState {
    try { const s = localStorage.getItem(LAYOUT_KEY); if (s) return JSON.parse(s) as DockManagerState } catch { /* ignore */ }
    return defaultWorkspace()
  }
  let workspace = $state<DockManagerState>(loadWorkspace())
  $effect(() => { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(workspace)) } catch { /* ignore */ } })

  let chartW = $state(0)
  let chartH = $state(0)
</script>

{#snippet eventBody(row: Ev)}
  <span class="fin-ev"><span class="fin-ev-tk">{row.ticker}</span><span class="fin-ev-t">{row.title}</span></span>
{/snippet}
{#snippet card(row: Ev)}
  <div class="fin-card">
    <div class="fin-card-top"><span class="fin-card-dot" style:background={KIND[row.kind]}></span><span class="fin-card-tk">{row.ticker}</span><span class="fin-card-exp">${row.exposure}M</span></div>
    <div class="fin-card-title">{row.title}</div>
    <div class="fin-card-sub">{row.kind} · {row.analyst}</div>
  </div>
{/snippet}

<section class="fin">
  <header class="fin-head">
    <div class="fin-brand">📈 Meridian Capital <span class="fin-brand-sub">Research &amp; earnings desk</span></div>
    <div class="fin-hint">One dataset, four synced views in a dockable workspace - drag a tab or splitter to rearrange.</div>
    <button class="fin-reset" onclick={() => (workspace = defaultWorkspace())}>Reset layout</button>
  </header>
  <div class="fin-stage">
    <SvDockManager bind:workspace minSize={120}>
      {#snippet pane(p)}
        {#if p.id === 'calendar'}
          <div class="fin-pane">
            <SvGrid data={rows} columns={columns} getRowId={(r) => String(r.id)} containerHeight="100%"
              scheduler={{
                startField: 'start', endField: 'end', titleField: 'title', colorField: 'color',
                resourceField: 'analyst', resources,
                views: ['week', 'day'], initialView: 'week', initialDate: monday, weekStartsOn: 1,
                dayStartHour: 7, dayEndHour: 18, event: eventBody, tooltip: true, editable: true, drawer: true,
                onEventMove, onEventResize, onEventCommit,
              }} />
          </div>
        {:else if p.id === 'board'}
          <div class="fin-pane">
            <SvGrid data={rows} columns={columns} getRowId={(r) => String(r.id)} containerHeight="100%"
              board={{ groupBy: 'stage', lanes: stages.map((s) => ({ id: s, title: s, color: STAGE[s] })), editable: true, card, onCardMove, onCardCommit }} />
          </div>
        {:else if p.id === 'grid'}
          <div class="fin-pane">
            <SvGrid data={rows} columns={columns} getRowId={(r) => String(r.id)} containerHeight="100%" sortable enableInlineEditing showPagination={false} rowHeight={30} fitColumns />
          </div>
        {:else if p.id === 'chart'}
          <div class="fin-pane fin-chartwrap" bind:clientWidth={chartW} bind:clientHeight={chartH}>
            {#if chartW > 20 && chartH > 20}
              <SvGridChart spec={chartSpec} width={chartW - 12} height={chartH - 12} />
            {/if}
          </div>
        {/if}
      {/snippet}
    </SvDockManager>
  </div>
</section>

<style>
  .fin { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .fin-head { display: flex; align-items: center; gap: 14px; padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .fin-brand { font-weight: 700; }
  .fin-brand-sub { font-weight: 400; font-size: 0.74rem; color: var(--sg-muted, #6b7280); margin-left: 6px; }
  .fin-hint { font-size: 0.76rem; color: var(--sg-muted, #6b7280); flex: 1 1 auto; }
  .fin-reset { padding: 4px 10px; font-size: 0.8rem; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
  .fin-reset:hover { border-color: var(--sg-accent, #4f46e5); color: var(--sg-accent, #4f46e5); }
  .fin-stage { flex: 1 1 auto; min-height: 360px; padding: 8px; }
  .fin-pane { height: 100%; min-height: 0; }
  .fin-chartwrap { display: grid; place-items: center; padding: 6px; box-sizing: border-box; }
  .fin-ev { display: flex; align-items: baseline; gap: 5px; min-width: 0; }
  .fin-ev-tk { font-weight: 700; font-size: 0.7em; }
  .fin-ev-t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fin-card { display: flex; flex-direction: column; gap: 2px; }
  .fin-card-top { display: flex; align-items: center; gap: 6px; }
  .fin-card-dot { width: 8px; height: 8px; border-radius: 50%; }
  .fin-card-tk { font-weight: 700; font-size: 0.78rem; }
  .fin-card-exp { margin-left: auto; font-size: 0.72rem; color: var(--sg-muted, #6b7280); }
  .fin-card-title { font-size: 0.82rem; font-weight: 600; }
  .fin-card-sub { font-size: 0.72rem; color: var(--sg-muted, #6b7280); }
  /* Phone: keep the desk at its content height (hidden overflow made it shrink to the
     stage) and let the 720px docking workspace pan inside the card. */
  @media (max-width: 639px), (max-height: 500px) and (pointer: coarse) {
    .fin { flex-shrink: 0; overflow-x: auto; }
  }
</style>
