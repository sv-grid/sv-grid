<script lang="ts">
  /**
   * 81. Mobile card view
   * --------------------
   * On wide screens this is a normal SvGrid. Under a viewport breakpoint
   * (≤ 720 px) the grid hides and the same `$state` array renders as
   * touch-friendly cards. Tap a card to expand into an edit panel,
   * which writes back through `api.setCellValue` so dirty tracking,
   * filtering, and external observers see the same writes whether the
   * edit came from the desktop grid or the mobile card.
   *
   * The headless engine is the single source of truth for both views.
   * Filter / sort state lives on `api`, so swiping between viewport
   * sizes preserves the user's working set.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-community'

  type Status = 'open' | 'in_progress' | 'blocked' | 'done'
  type Priority = 'low' | 'med' | 'high' | 'urgent'

  type Ticket = {
    id: string
    title: string
    assignee: string
    status: Status
    priority: Priority
    dueDate: string
    estimateHours: number
  }

  const STATUS_OPTS: Status[]  = ['open', 'in_progress', 'blocked', 'done']
  const PRIO_OPTS:   Priority[] = ['low', 'med', 'high', 'urgent']
  const STATUS_LABEL: Record<Status, string> = {
    open: 'Open', in_progress: 'In progress', blocked: 'Blocked', done: 'Done',
  }

  let rows = $state<Ticket[]>([
    { id: 't01', title: 'Onboarding wizard',          assignee: 'Ada Lovelace',     status: 'in_progress', priority: 'high',   dueDate: '2026-06-15', estimateHours: 12 },
    { id: 't02', title: 'Stripe webhook retry',       assignee: 'Linus Torvalds',   status: 'open',        priority: 'urgent', dueDate: '2026-06-10', estimateHours: 6  },
    { id: 't03', title: 'Search index migration',     assignee: 'Grace Hopper',     status: 'blocked',     priority: 'med',    dueDate: '2026-06-22', estimateHours: 16 },
    { id: 't04', title: 'Dark mode polish',           assignee: 'Margaret Hamilton',status: 'done',        priority: 'low',    dueDate: '2026-06-02', estimateHours: 4  },
    { id: 't05', title: 'Audit log retention',        assignee: 'Donald Knuth',     status: 'in_progress', priority: 'high',   dueDate: '2026-06-18', estimateHours: 8  },
    { id: 't06', title: 'Pricing page refresh',       assignee: 'Barbara Liskov',   status: 'open',        priority: 'med',    dueDate: '2026-06-30', estimateHours: 10 },
    { id: 't07', title: 'Health-check endpoint',      assignee: 'Alan Turing',      status: 'done',        priority: 'low',    dueDate: '2026-06-05', estimateHours: 3  },
    { id: 't08', title: 'Postgres connection pool',   assignee: 'Edsger Dijkstra',  status: 'in_progress', priority: 'urgent', dueDate: '2026-06-12', estimateHours: 14 },
    { id: 't09', title: 'Feature flag cleanup',       assignee: 'Niklaus Wirth',    status: 'blocked',     priority: 'low',    dueDate: '2026-06-28', estimateHours: 5  },
    { id: 't10', title: 'On-call rotation rewrite',   assignee: 'Brendan Eich',     status: 'open',        priority: 'high',   dueDate: '2026-06-20', estimateHours: 9  },
  ])

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Ticket> | null>(null)

  // ---- Viewport tracking ------------------------------------------------
  // The same JS code path drives both renders, so a single boolean swap
  // is enough to pivot the layout.
  const MOBILE_MAX = 720
  let isMobile = $state(false)
  function syncViewport() {
    if (typeof window !== 'undefined') isMobile = window.innerWidth <= MOBILE_MAX
  }
  $effect(() => {
    syncViewport()
    window.addEventListener('resize', syncViewport)
    return () => window.removeEventListener('resize', syncViewport)
  })

  // Allow a manual override so the demo is testable on desktop without
  // resizing the viewport. Defaults to `cards` so the demo's headline
  // affordance is what greets the user.
  let forceView = $state<'auto' | 'grid' | 'cards'>('cards')
  const showCards = $derived(forceView === 'cards' || (forceView === 'auto' && isMobile))

  // ---- Filtering on the cards mirrors the grid's text filter ------------
  let search = $state('')
  const visibleRows = $derived.by(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.assignee.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q),
    )
  })

  // ---- Edit modal -------------------------------------------------------
  // Tapping a card's Edit button opens the row in a centred modal.
  // Writes flow through `setCell` like before, so the underlying $state
  // (and the grid if it's mounted) sees every change live.
  let editingId = $state<string | null>(null)
  const editingRow = $derived(rows.find((r) => r.id === editingId) ?? null)

  function openEdit(id: string)  { editingId = id }
  function closeEdit()           { editingId = null }

  // Esc closes the modal.
  $effect(() => {
    if (editingId === null) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeEdit() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function setCell<K extends keyof Ticket>(rowId: string, field: K, value: Ticket[K]) {
    const ix = rows.findIndex((r) => r.id === rowId)
    if (ix === -1) return
    // Replace the array slot with a NEW object instead of mutating its
    // property. Svelte 5's $state proxy reliably observes assignments
    // on the array itself (setCell is called from the modal whether the
    // grid is mounted or not, so we cannot depend on `api.setCellValue`
    // being live - the api reference can be stale if the grid was
    // mounted and then unmounted via the view toggle).
    rows[ix] = { ...rows[ix]!, [field]: value }
  }

  // ---- Grid columns -----------------------------------------------------
  const columns: ColumnDef<typeof features, Ticket>[] = [
    { field: 'id',       header: 'ID',       editorType: 'text', width: 80, editable: false },
    { field: 'title',    header: 'Title',    editorType: 'text', width: 220 },
    { field: 'assignee', header: 'Assignee', editorType: 'text', width: 180 },
    { field: 'status',   header: 'Status',
      editorType: 'list', editorOptions: STATUS_OPTS as unknown as ReadonlyArray<string>, width: 140 },
    { field: 'priority', header: 'Priority',
      editorType: 'list', editorOptions: PRIO_OPTS as unknown as ReadonlyArray<string>, width: 120 },
    { field: 'dueDate',  header: 'Due',      editorType: 'date', width: 130,
      format: { type: 'date', pattern: 'y-m-d' } },
    { field: 'estimateHours', header: 'Est. h', editorType: 'number', width: 100 },
  ]

  // ---- Display helpers --------------------------------------------------
  function initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
  }
  function avatarHue(name: string): string {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
    return `hsl(${h % 360}deg 60% 52%)`
  }
  function fmtDate(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  // ---- KPI strip --------------------------------------------------------
  const openN     = $derived(rows.filter((r) => r.status === 'open').length)
  const blockedN  = $derived(rows.filter((r) => r.status === 'blocked').length)
  const urgentN   = $derived(rows.filter((r) => r.priority === 'urgent').length)
  const totalEst  = $derived(rows.reduce((a, r) => a + r.estimateHours, 0))

  // ---- Due-date helpers -------------------------------------------------
  const todayIso = new Date().toISOString().slice(0, 10)
  function daysUntil(iso: string): number {
    const d = new Date(iso).getTime()
    const t = new Date(todayIso).getTime()
    if (Number.isNaN(d) || Number.isNaN(t)) return 0
    return Math.round((d - t) / 86_400_000)
  }
  function dueState(iso: string, status: Status): 'overdue' | 'soon' | 'ok' | 'done' {
    if (status === 'done') return 'done'
    const n = daysUntil(iso)
    if (n < 0)  return 'overdue'
    if (n <= 3) return 'soon'
    return 'ok'
  }
  function dueLabel(iso: string, status: Status): string {
    if (status === 'done') return 'Closed'
    const n = daysUntil(iso)
    if (n < 0)  return `${Math.abs(n)}d overdue`
    if (n === 0) return 'Due today'
    if (n === 1) return 'Due tomorrow'
    return `${n}d left`
  }
</script>

<section class="mb-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="mb-kpi-strip shrink-0">
    <div class="mb-kpi"><div class="mb-kpi-label">Open</div><div class="mb-kpi-value">{openN}</div></div>
    <div class="mb-kpi mb-kpi-warn"><div class="mb-kpi-label">Blocked</div><div class="mb-kpi-value">{blockedN}</div></div>
    <div class="mb-kpi mb-kpi-urgent"><div class="mb-kpi-label">Urgent</div><div class="mb-kpi-value">{urgentN}</div></div>
    <div class="mb-kpi"><div class="mb-kpi-label">Est. hours</div><div class="mb-kpi-value">{totalEst}</div></div>
  </div>

  <!-- Toolbar: search + view switch -->
  <div class="mb-toolbar shrink-0">
    <input
      type="search"
      bind:value={search}
      placeholder="Search title, assignee, ID…"
      class="mb-search"
      aria-label="Search tickets"
    />
    <div class="mb-view-switch" role="group" aria-label="View mode">
      <button type="button" class:mb-view-on={forceView === 'auto'}  onclick={() => (forceView = 'auto')}>Auto</button>
      <button type="button" class:mb-view-on={forceView === 'grid'}  onclick={() => (forceView = 'grid')}>Grid</button>
      <button type="button" class:mb-view-on={forceView === 'cards'} onclick={() => (forceView = 'cards')}>Cards</button>
    </div>
    <span class="mb-hint">
      Default is the touch-friendly card view. Click <strong>Grid</strong> for the same data as a desktop spreadsheet, or <strong>Auto</strong> to pivot on viewport width.
    </span>
  </div>

  <!-- The pivot -->
  <div class="flex-1 min-h-0">
    {#if showCards}
      <div class="mb-cards-scroll">
        {#each visibleRows as r (r.id)}
          {@const due  = dueState(r.dueDate, r.status)}
          <article class={`mb-card mb-prio-${r.priority}`}>
            <!-- Always-visible card body: every field at a glance -->
            <div class={`mb-prio-bar mb-prio-bar-${r.priority}`} aria-hidden="true"></div>
            <div class="mb-card-body">
              <!-- Row 1: id + status + priority + edit button -->
              <div class="mb-row-1">
                <span class="mb-id">{r.id}</span>
                <span class={`mb-status-tag mb-status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                <span class={`mb-prio-tag mb-prio-tag-${r.priority}`}>
                  <span class="mb-prio-dot" aria-hidden="true"></span>
                  {r.priority}
                </span>
                <button type="button" class="mb-edit-toggle"
                  onclick={() => openEdit(r.id)}
                  aria-label={`Edit ${r.title}`}
                >
                  ✎ Edit
                </button>
              </div>

              <!-- Row 2: title -->
              <div class="mb-card-title">{r.title}</div>

              <!-- Row 3: detail grid - every field, never hidden -->
              <dl class="mb-detail-grid">
                <div class="mb-detail">
                  <dt>Assignee</dt>
                  <dd class="mb-assignee">
                    <span class="mb-avatar" style={`background: ${avatarHue(r.assignee)}`}>{initials(r.assignee)}</span>
                    <span class="mb-assignee-name">{r.assignee}</span>
                  </dd>
                </div>
                <div class="mb-detail">
                  <dt>Due</dt>
                  <dd class={`mb-due mb-due-${due}`}>
                    <span class="mb-due-icon" aria-hidden="true">📅</span>
                    <span>{fmtDate(r.dueDate)}</span>
                    <span class="mb-due-label">· {dueLabel(r.dueDate, r.status)}</span>
                  </dd>
                </div>
                <div class="mb-detail">
                  <dt>Estimate</dt>
                  <dd>
                    <span class="mb-due-icon" aria-hidden="true">⏱</span>
                    <span class="mb-est">{r.estimateHours}</span>
                    <span class="mb-est-unit">hours</span>
                  </dd>
                </div>
              </dl>
            </div>
          </article>
        {/each}
        {#if visibleRows.length === 0}
          <p class="mb-empty">No tickets match "{search}".</p>
        {/if}
      </div>
    {:else}
      <div class="mb-grid-host">
        <SvGrid
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
          rowClass={({ row }) => {
            const r = row as Ticket
            const d = dueState(r.dueDate, r.status)
            return {
              'mb-grid-row-overdue': d === 'overdue',
              'mb-grid-row-soon':    d === 'soon',
              'mb-grid-row-done':    r.status === 'done',
            }
          }}
          onApiReady={(next) => (api = next)}
        />
      </div>
    {/if}
  </div>

  <!-- Edit modal: opens when a card's Edit button is clicked -->
  {#if editingRow}
    {@const r = editingRow}
    <div class="mb-modal-backdrop"
      role="presentation"
      onclick={(e) => { if (e.target === e.currentTarget) closeEdit() }}
    >
      <div class="mb-modal" role="dialog" aria-modal="true" aria-label={`Edit ${r.id}`}>
        <header class="mb-modal-head">
          <div class="mb-modal-title-wrap">
            <div class="mb-modal-id-row">
              <span class="mb-id">{r.id}</span>
              <span class={`mb-status-tag mb-status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
              <span class={`mb-prio-tag mb-prio-tag-${r.priority}`}>
                <span class="mb-prio-dot" aria-hidden="true"></span>{r.priority}
              </span>
            </div>
            <h3 class="mb-modal-title">{r.title}</h3>
          </div>
          <button type="button" class="mb-modal-close" onclick={closeEdit} aria-label="Close">✕</button>
        </header>

        <div class="mb-modal-body">
          <div class="mb-field-grid">
            <label class="mb-field mb-field-wide">
              <span class="mb-field-label">Title</span>
              <input type="text" value={r.title}
                oninput={(e) => setCell(r.id, 'title', (e.currentTarget as HTMLInputElement).value)} />
            </label>
            <label class="mb-field mb-field-wide">
              <span class="mb-field-label">Assignee</span>
              <input type="text" value={r.assignee}
                oninput={(e) => setCell(r.id, 'assignee', (e.currentTarget as HTMLInputElement).value)} />
            </label>
            <label class="mb-field">
              <span class="mb-field-label">Status</span>
              <select value={r.status}
                onchange={(e) => setCell(r.id, 'status', (e.currentTarget as HTMLSelectElement).value as Status)}>
                {#each STATUS_OPTS as s (s)}<option value={s}>{STATUS_LABEL[s]}</option>{/each}
              </select>
            </label>
            <label class="mb-field">
              <span class="mb-field-label">Priority</span>
              <select value={r.priority}
                onchange={(e) => setCell(r.id, 'priority', (e.currentTarget as HTMLSelectElement).value as Priority)}>
                {#each PRIO_OPTS as p (p)}<option value={p}>{p}</option>{/each}
              </select>
            </label>
            <label class="mb-field">
              <span class="mb-field-label">Due date</span>
              <input type="date" value={r.dueDate}
                onchange={(e) => setCell(r.id, 'dueDate', (e.currentTarget as HTMLInputElement).value)} />
            </label>
            <label class="mb-field">
              <span class="mb-field-label">Estimate (h)</span>
              <input type="number" min="0" step="1" value={r.estimateHours}
                oninput={(e) => setCell(r.id, 'estimateHours', +(e.currentTarget as HTMLInputElement).value)} />
            </label>
          </div>
        </div>

        <footer class="mb-modal-foot">
          <span class="mb-modal-hint">Changes apply live · Esc or backdrop closes</span>
          <button type="button" class="mb-collapse" onclick={closeEdit}>Done</button>
        </footer>
      </div>
    </div>
  {/if}
</section>

<style>
  .mb-shell { height: 100%; }

  /* KPI strip */
  .mb-kpi-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  .mb-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .mb-kpi-warn   { border-left: 3px solid #f59e0b; }
  .mb-kpi-urgent { border-left: 3px solid #ef4444; }
  .mb-kpi-label  { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sg-muted, #64748b); }
  .mb-kpi-value  { font-size: 22px; font-weight: 700; line-height: 1.1; color: var(--sg-fg, #0f172a); }

  /* Toolbar */
  .mb-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 13px; }
  .mb-search {
    flex: 1 1 240px; max-width: 360px;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 8px; padding: 6px 12px; font-size: 13px; outline: none;
  }
  .mb-search:focus { border-color: var(--sg-accent, #2563eb); box-shadow: 0 0 0 3px color-mix(in oklab, var(--sg-accent, #2563eb) 22%, transparent); }
  .mb-view-switch {
    display: inline-flex; border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 8px; overflow: hidden;
  }
  .mb-view-switch button {
    border: 0; background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    padding: 6px 14px; font-size: 12.5px; cursor: pointer;
    border-right: 1px solid var(--sg-border, #cbd5e1);
  }
  .mb-view-switch button:last-child { border-right: 0; }
  .mb-view-switch button:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }
  .mb-view-on {
    background: var(--sg-accent, #2563eb) !important;
    color: #fff !important; font-weight: 600;
  }
  .mb-hint { color: var(--sg-muted, #64748b); font-size: 12px; }

  /* ---- Card list - two-column on wider mobile, single on phone -------- */
  .mb-cards-scroll {
    height: 100%; overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 10px;
    padding: 2px 4px 12px 2px;
    align-content: start;
  }
  .mb-card {
    display: flex; align-items: stretch;
    min-height: 140px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    transition: border-color 140ms ease, box-shadow 140ms ease, transform 80ms ease;
  }
  :global([data-theme='dark']) .mb-card { background: #0f172a; border-color: #1e293b; }
  .mb-card:hover {
    border-color: var(--sg-accent, #6366f1);
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
  }
  /* Priority bar - a coloured vertical strip on the left edge */
  .mb-prio-bar {
    width: 4px; flex-shrink: 0;
  }
  .mb-prio-bar-low    { background: #94a3b8; }
  .mb-prio-bar-med    { background: #0ea5e9; }
  .mb-prio-bar-high   { background: #f59e0b; }
  .mb-prio-bar-urgent { background: linear-gradient(180deg, #ef4444, #b91c1c); }

  .mb-card-body {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column; gap: 10px;
    padding: 12px 14px 14px;
  }

  .mb-row-1 {
    display: flex; align-items: center; gap: 6px;
    flex-wrap: wrap;
  }
  .mb-id {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    color: var(--sg-muted, #94a3b8);
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 4px;
    padding: 2px 7px;
  }
  :global([data-theme='dark']) .mb-id { background: rgba(148,163,184,0.16); color: #cbd5e1; }
  .mb-edit-toggle {
    margin-left: auto;
    background: transparent;
    border: 1px solid transparent;
    color: var(--sg-muted, #64748b);
    font-size: 12px; font-weight: 600;
    padding: 3px 10px; border-radius: 6px;
    cursor: pointer;
    transition: background 100ms, color 100ms, border-color 100ms;
  }
  .mb-edit-toggle:hover {
    background: var(--sg-row-hover-bg, rgba(148,163,184,0.12));
    color: var(--sg-fg, #0f172a);
  }
  .mb-edit-toggle.is-open {
    background: var(--sg-accent, #2563eb);
    color: #fff;
  }

  .mb-card-title {
    font-size: 15px; font-weight: 600;
    color: #0f172a;
    line-height: 1.35;
    word-break: break-word;
  }
  :global([data-theme='dark']) .mb-card-title { color: #f1f5f9; }

  /* ---- Detail grid (assignee / due / estimate) ---- */
  .mb-detail-grid {
    margin: 0;
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 8px 14px;
    padding-top: 4px;
    border-top: 1px dashed var(--sg-border, #e2e8f0);
  }
  .mb-detail { display: flex; flex-direction: column; min-width: 0; }
  .mb-detail dt {
    font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--sg-muted, #94a3b8); font-weight: 600;
    margin-bottom: 2px;
  }
  .mb-detail dd {
    margin: 0;
    font-size: 12.5px; color: #0f172a;
    display: inline-flex; align-items: center; gap: 5px;
    min-width: 0;
  }
  :global([data-theme='dark']) .mb-detail dd { color: #f1f5f9; }

  .mb-assignee       { font-weight: 500; }
  .mb-assignee-name  { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mb-avatar {
    width: 22px; height: 22px; border-radius: 50%;
    color: #fff; font-size: 10px; font-weight: 700;
    display: inline-flex; align-items: center; justify-content: center;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.20);
    flex-shrink: 0;
  }

  .mb-due-icon       { font-size: 12px; opacity: 0.7; }
  .mb-due-label      { color: var(--sg-muted, #94a3b8); font-size: 11px; }
  .mb-due-overdue    { color: #b91c1c; font-weight: 600; }
  .mb-due-overdue .mb-due-label { color: #b91c1c; }
  .mb-due-soon       { color: #b45309; font-weight: 600; }
  .mb-due-soon .mb-due-label { color: #b45309; }
  .mb-due-done       { color: var(--sg-muted, #94a3b8); }

  .mb-est            { font-weight: 700; font-variant-numeric: tabular-nums; }
  .mb-est-unit       { font-size: 11px; color: var(--sg-muted, #94a3b8); }

  :global([data-theme='dark']) .mb-detail-grid { border-top-color: rgba(148,163,184,0.20); }
  :global([data-theme='dark']) .mb-due-overdue { color: #fca5a5; }
  :global([data-theme='dark']) .mb-due-overdue .mb-due-label { color: #fca5a5; }
  :global([data-theme='dark']) .mb-due-soon    { color: #fbbf24; }
  :global([data-theme='dark']) .mb-due-soon .mb-due-label { color: #fbbf24; }

  /* ---- Priority tag ------------------------------------------------- */
  .mb-prio-tag {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 2px 9px; border-radius: 999px;
    font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  }
  .mb-prio-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .mb-prio-tag-low    { background: #f1f5f9; color: #475569; }
  .mb-prio-tag-med    { background: #dbeafe; color: #1e40af; }
  .mb-prio-tag-high   { background: #fed7aa; color: #9a3412; }
  .mb-prio-tag-urgent { background: #fee2e2; color: #991b1b; box-shadow: inset 0 0 0 1px #ef4444; }
  :global([data-theme='dark'] .mb-prio-tag-low)    { background: rgba(148,163,184,0.18); color: #cbd5e1; }
  :global([data-theme='dark'] .mb-prio-tag-med)    { background: rgba(59,130,246,0.18); color: #93c5fd; }
  :global([data-theme='dark'] .mb-prio-tag-high)   { background: rgba(245,158,11,0.20); color: #fbbf24; }
  :global([data-theme='dark'] .mb-prio-tag-urgent) { background: rgba(239,68,68,0.22); color: #fca5a5; box-shadow: inset 0 0 0 1px #ef4444; }

  /* ---- Status tag --------------------------------------------------- */
  .mb-status-tag {
    display: inline-block;
    padding: 2px 9px; border-radius: 999px;
    font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  }
  .mb-status-open        { background: #f1f5f9; color: #334155; }
  .mb-status-in_progress { background: #dbeafe; color: #1e3a8a; }
  .mb-status-blocked     { background: #fee2e2; color: #991b1b; }
  .mb-status-done        { background: #dcfce7; color: #166534; }
  :global([data-theme='dark'] .mb-status-open)        { background: rgba(148,163,184,0.18); color: #cbd5e1; }
  :global([data-theme='dark'] .mb-status-in_progress) { background: rgba(59,130,246,0.20); color: #93c5fd; }
  :global([data-theme='dark'] .mb-status-blocked)     { background: rgba(239,68,68,0.22); color: #fca5a5; }
  :global([data-theme='dark'] .mb-status-done)        { background: rgba(34,197,94,0.18); color: #4ade80; }

  /* ---- Grid host - tonal stripe + due-date row tints ---------------- */
  .mb-grid-host {
    height: 100%;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  }
  :global([data-theme='dark']) .mb-grid-host { background: #0f172a; border-color: #1e293b; }
  :global(.mb-grid-host td)                  { font-size: 13px; }
  :global(.mb-grid-host thead th) {
    font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--sg-muted, #64748b);
    background: var(--sg-header-bg, #f8fafc);
  }
  :global(.mb-grid-host tr.mb-grid-row-overdue td) { background: rgba(239, 68, 68, 0.08); }
  :global(.mb-grid-host tr.mb-grid-row-soon td)    { background: rgba(245, 158, 11, 0.06); }
  :global(.mb-grid-host tr.mb-grid-row-done td)    { color: var(--sg-muted, #94a3b8); }
  :global(.mb-grid-host tbody tr:hover td)         { background: rgba(99, 102, 241, 0.06); }

  /* ---- Edit modal --------------------------------------------------- */
  .mb-modal-backdrop {
    position: fixed; inset: 0; z-index: 100;
    display: flex; align-items: center; justify-content: center;
    background: rgba(15, 23, 42, 0.50);
    backdrop-filter: blur(2px);
    padding: 16px;
    animation: mb-fade-in 120ms ease;
  }
  @keyframes mb-fade-in { from { opacity: 0; } to { opacity: 1; } }
  .mb-modal {
    width: 100%; max-width: 520px; max-height: 90vh;
    display: flex; flex-direction: column;
    background: #ffffff;
    color: #0f172a;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);
    overflow: hidden;
    animation: mb-pop 160ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes mb-pop { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  :global([data-theme='dark']) .mb-modal { background: #0f172a; color: #f1f5f9; border-color: #1e293b; }

  .mb-modal-head {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  :global([data-theme='dark']) .mb-modal-head { background: #1e293b; border-bottom-color: #334155; }
  .mb-modal-title-wrap { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .mb-modal-id-row     { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .mb-modal-title {
    margin: 0; font-size: 16px; font-weight: 700;
    color: #0f172a; line-height: 1.3;
  }
  :global([data-theme='dark']) .mb-modal-title { color: #f1f5f9; }
  .mb-modal-close {
    flex: none; background: transparent; border: 0;
    color: #64748b; font-size: 18px; line-height: 1;
    width: 32px; height: 32px; border-radius: 6px; cursor: pointer;
  }
  .mb-modal-close:hover { background: rgba(148, 163, 184, 0.16); color: #0f172a; }
  :global([data-theme='dark']) .mb-modal-close:hover { color: #f1f5f9; }

  .mb-modal-body { padding: 16px; overflow-y: auto; }

  .mb-modal-foot {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  :global([data-theme='dark']) .mb-modal-foot { background: #1e293b; border-top-color: #334155; }
  .mb-modal-hint { font-size: 11px; color: #64748b; }
  :global([data-theme='dark']) .mb-modal-hint { color: #94a3b8; }
  .mb-field-grid {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .mb-field-wide { grid-column: 1 / -1; }
  .mb-field {
    display: flex; flex-direction: column; gap: 4px;
  }
  .mb-field-label {
    font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--sg-muted, #64748b); font-weight: 600;
  }
  .mb-field input, .mb-field select {
    font-size: 13px; padding: 7px 10px;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px; outline: none;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .mb-field input:focus, .mb-field select:focus {
    border-color: var(--sg-accent, #2563eb);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--sg-accent, #2563eb) 22%, transparent);
  }
  .mb-edit-actions {
    display: flex; justify-content: flex-end;
    margin-top: 12px;
  }
  .mb-collapse {
    border: 0;
    background: var(--sg-accent, #2563eb); color: #fff;
    border-radius: 6px; padding: 8px 18px;
    font-weight: 600; font-size: 13px;
    cursor: pointer;
  }
  .mb-collapse:hover { filter: brightness(1.06); }
  .mb-empty {
    text-align: center; padding: 32px;
    color: var(--sg-muted, #64748b); font-size: 13px;
  }

  /* On small screens, only the list stacks to one column. The card
     itself - including its 3-column Assignee/Due/Estimate detail row -
     stays visually identical to the desktop layout. The edit drawer
     fields drop to one column because tiny inputs side-by-side aren't
     fun to tap. */
  @media (max-width: 480px) {
    .mb-cards-scroll  { grid-template-columns: 1fr; }
    .mb-kpi-strip     { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .mb-field-grid    { grid-template-columns: 1fr; }
    .mb-field-wide    { grid-column: auto; }
  }
</style>
