<script lang="ts">
  /**
   * 113. Cursor-based (keyset) pagination
   * -------------------------------------
   * Offset pagination breaks at scale: the server has to scan-and-skip
   * for every "page N" request, and concurrent writes shift items
   * across page boundaries. Cursor (keyset) pagination is the modern
   * answer - the server returns a `nextCursor` token derived from the
   * last row's sort key. The next request says "give me 25 items
   * AFTER this cursor".
   *
   * Tradeoffs vs offset:
   *   - No "page 7 of 200" jump-around. Only prev / next is meaningful.
   *   - Stable under concurrent writes (no skipped / duplicated rows).
   *   - Server doesn't scan-and-skip; it does a single indexed range
   *     read (O(log N + pageSize)) regardless of how deep the user is.
   *
   * The mock server here uses `(createdAt, id)` as the sort key so the
   * cursor is `${createdAt}|${id}`. Real implementations use whatever
   * indexed column makes the query plan happy.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  type Event = {
    id: string
    createdAt: string  // ISO timestamp
    actor: string
    action: 'created' | 'updated' | 'deleted' | 'invited' | 'commented' | 'archived'
    target: string
    metadata: string
  }

  // ---- Mock dataset on the "server" -----------------------------------
  let prng = 0x12C0DE
  function rand() { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(a: readonly T[]): T { return a[Math.floor(rand() * a.length)]! }

  const ACTORS = ['Ava Thompson','Liam Park','Noah Singh','Emma Garcia','Olivia Chen',
                  'Mason Rivera','Sophia Brown','Lucas Patel','Mia Johnson','Ethan Wright']
  const ACTIONS: Event['action'][] = ['created', 'updated', 'deleted', 'invited', 'commented', 'archived']
  const TARGETS = ['workspace/marketing','document/Q3-strategy','board/incidents',
                   'project/release-2.4','dataset/customers','team/engineering',
                   'dashboard/finance','channel/general','workflow/onboarding']

  // 5,000 events spanning the last 30 days, sorted by createdAt DESC.
  const ALL_EVENTS: Event[] = (() => {
    const out: Event[] = []
    const now = Date.now()
    for (let i = 0; i < 5_000; i++) {
      const offsetMs = Math.floor(rand() * 30 * 86_400_000)
      const date = new Date(now - offsetMs)
      out.push({
        id:        `evt_${i.toString(36).padStart(4, '0')}_${Math.floor(rand() * 0xFFFFFF).toString(16)}`,
        createdAt: date.toISOString(),
        actor:     pick(ACTORS),
        action:    pick(ACTIONS),
        target:    pick(TARGETS),
        metadata:  `req_${Math.floor(rand() * 0xFFFFFFFF).toString(16).padStart(8, '0')}`,
      })
    }
    out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return out
  })()

  // ---- Mock server endpoint -------------------------------------------
  type Cursor = string  // `${createdAt}|${id}` - encodes the sort key
  type ServerResponse = {
    rows: Event[]
    nextCursor: Cursor | null  // null when no more pages
    prevCursor: Cursor | null
    totalApprox: number        // server-side approximation; real APIs may not provide
    queryMs: number
  }

  function encodeCursor(row: Event): Cursor { return `${row.createdAt}|${row.id}` }
  function decodeCursor(c: Cursor): { createdAt: string; id: string } | null {
    const [t, i] = c.split('|')
    return t && i ? { createdAt: t, id: i } : null
  }

  /**
   * Fetch a page given a cursor and direction. Real implementation
   * would translate this to a SQL `WHERE (createdAt, id) < (?, ?)
   * ORDER BY createdAt DESC, id DESC LIMIT N` query.
   */
  async function fetchPage(opts: {
    cursor: Cursor | null
    direction: 'forward' | 'backward'
    pageSize: number
  }): Promise<ServerResponse> {
    const t0 = performance.now()
    // Simulate 80-180ms server latency
    await new Promise<void>((r) => setTimeout(r, 80 + Math.random() * 100))

    const idx = opts.cursor
      ? ALL_EVENTS.findIndex((e) => encodeCursor(e) === opts.cursor)
      : -1
    // Forward: rows AFTER cursor (older). Backward: rows BEFORE.
    let slice: Event[]
    if (opts.direction === 'forward') {
      const start = idx >= 0 ? idx + 1 : 0
      slice = ALL_EVENTS.slice(start, start + opts.pageSize)
    } else {
      const end = idx >= 0 ? idx : 0
      const start = Math.max(0, end - opts.pageSize)
      slice = ALL_EVENTS.slice(start, end)
    }

    return {
      rows: slice,
      nextCursor: slice.length > 0 ? encodeCursor(slice[slice.length - 1]!) : null,
      prevCursor: slice.length > 0 ? encodeCursor(slice[0]!) : null,
      totalApprox: ALL_EVENTS.length,
      queryMs: Math.round(performance.now() - t0),
    }
  }

  // ---- Client state ----------------------------------------------------
  let pageSize = $state(25)
  let loading = $state(false)
  let rows = $state<Event[]>([])
  let nextCursor = $state<Cursor | null>(null)
  let prevCursor = $state<Cursor | null>(null)
  let cursorStack = $state<Cursor[]>([])  // history of cursors for prev navigation
  let lastQueryMs = $state(0)
  let pagesLoaded = $state(0)

  async function loadFirst() {
    loading = true
    const res = await fetchPage({ cursor: null, direction: 'forward', pageSize })
    rows = res.rows
    nextCursor = res.nextCursor
    prevCursor = null
    cursorStack = []
    lastQueryMs = res.queryMs
    pagesLoaded = 1
    loading = false
  }

  async function loadNext() {
    if (!nextCursor) return
    loading = true
    cursorStack = [...cursorStack, prevCursor ?? '']
    const res = await fetchPage({ cursor: nextCursor, direction: 'forward', pageSize })
    rows = res.rows
    prevCursor = res.prevCursor
    nextCursor = res.nextCursor
    lastQueryMs = res.queryMs
    pagesLoaded += 1
    loading = false
  }

  async function loadPrev() {
    if (cursorStack.length === 0) return
    loading = true
    const previousAnchor = cursorStack[cursorStack.length - 1] || null
    cursorStack = cursorStack.slice(0, -1)
    // Re-fetch the previous page using FORWARD direction from the saved anchor
    const res = await fetchPage({ cursor: previousAnchor, direction: 'forward', pageSize })
    rows = res.rows
    prevCursor = res.prevCursor
    nextCursor = res.nextCursor
    lastQueryMs = res.queryMs
    loading = false
  }

  // Boot
  $effect(() => { void loadFirst() })

  // ---- Columns ---------------------------------------------------------
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const columns: ColumnDef<typeof features, Event>[] = [
    { field: 'id',        header: 'Event id',  width: 200, editable: false,
      cellClass: () => 'mono-cell' },
    { field: 'createdAt', header: 'Created',   width: 200, editable: false,
      format: { type: 'datetime' } },
    { field: 'actor',     header: 'Actor',     width: 160, editable: false },
    { field: 'action',    header: 'Action',    width: 120, editable: false,
      cellClass: (ctx) => `action-${ctx.getValue()}` },
    { field: 'target',    header: 'Target',    width: 220, editable: false,
      cellClass: () => 'mono-cell' },
    { field: 'metadata',  header: 'Request id',width: 160, editable: false,
      cellClass: () => 'mono-cell' },
  ]

  const fmtCursor = (c: Cursor | null) => c
    ? c.replace('|', '\n…|') // line-break for readability in the badge
    : '∅'
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip ---------------------------------------------------- -->
  <div class="kpi-strip shrink-0">
    <div class="kpi"><div class="kpi-label">Page</div><div class="kpi-value">{pagesLoaded}</div></div>
    <div class="kpi"><div class="kpi-label">Rows on screen</div><div class="kpi-value">{rows.length}</div></div>
    <div class="kpi"><div class="kpi-label">Page size</div>
      <select bind:value={pageSize} class="size-select" onchange={() => loadFirst()}>
        {#each [10, 25, 50, 100] as n (n)}<option value={n}>{n}</option>{/each}
      </select>
    </div>
    <div class="kpi"><div class="kpi-label">Last query</div><div class="kpi-value tabular">{lastQueryMs} ms</div></div>
    <div class="kpi"><div class="kpi-label">Dataset</div><div class="kpi-value tabular">~{(5_000).toLocaleString()}</div></div>
  </div>

  <!-- Pagination bar ------------------------------------------------- -->
  <div class="pagebar shrink-0">
    <button class="pgbtn" disabled={loading || cursorStack.length === 0} onclick={loadPrev}>← Previous</button>
    <button class="pgbtn" disabled={loading || !nextCursor} onclick={loadNext}>Next →</button>
    <button class="pgbtn alt" disabled={loading} onclick={loadFirst}>↺ Reset</button>

    <div class="cursors">
      <div class="cursor-card">
        <span class="cursor-label">prevCursor</span>
        <code>{fmtCursor(prevCursor)}</code>
      </div>
      <div class="cursor-card">
        <span class="cursor-label">nextCursor</span>
        <code>{fmtCursor(nextCursor)}</code>
      </div>
    </div>
  </div>

  <div class="explain shrink-0">
    <strong>Why cursors over offset?</strong>
    <span>Server runs a single indexed range read for every page (O(log N + pageSize))
    instead of scan-and-skip; concurrent writes don't shift items across page boundaries;
    and the URL stays stable when you bookmark "page 47". Cost: no jump-to-page UI.</span>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="none"
      selectionMode="cell"
      enableInlineEditing={false}
      enableCellSelection={true}
      rowHeight={32}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>

<style>
  .kpi-strip { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; padding: 8px 12px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
               color: var(--sg-muted, #64748b); font-weight: 700; }
  .kpi-value { font-size: 20px; font-weight: 700; line-height: 1.1; color: var(--sg-fg, #0f172a); }
  .kpi-value.tabular { font-variant-numeric: tabular-nums; }
  .size-select {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px; padding: 2px 6px; font-size: 14px; font-weight: 700;
    width: fit-content;
  }

  .pagebar {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: color-mix(in srgb, var(--sg-accent, #6366f1) 4%, transparent 96%);
    border-radius: 8px; padding: 10px 12px;
  }
  .pgbtn {
    background: var(--sg-accent, #6366f1); color: var(--sg-on-accent, #fff);
    border: 0; border-radius: 6px; padding: 6px 14px;
    font-size: 13px; font-weight: 700; cursor: pointer;
  }
  .pgbtn.alt {
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1);
  }
  .pgbtn:hover:not(:disabled) { filter: brightness(1.08); }
  .pgbtn:disabled { opacity: 0.4; cursor: default; filter: grayscale(1); }

  .cursors { display: flex; gap: 6px; flex: 1; min-width: 0; }
  /* Phone: after Previous / Next / Reset there is ~100px left on the line,
     so the two cursor cards were 50px wide and their PREVCURSOR / NEXTCURSOR
     labels painted past them. Give the cards their own line. */
  @media (max-width: 639px) {
    .cursors { flex-basis: 100%; }
  }
  .cursor-card {
    flex: 1; min-width: 0;
    background: var(--sg-bg, #fff);
    border: 1px dashed var(--sg-border, #cbd5e1);
    border-radius: 6px; padding: 4px 8px;
    display: flex; flex-direction: column; gap: 1px;
  }
  .cursor-label {
    font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--sg-accent, #6366f1); font-weight: 700;
  }
  .cursor-card code {
    font-family: ui-monospace, monospace; font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .explain {
    border: 1px solid color-mix(in oklab, var(--sg-accent, #6366f1) 30%, transparent);
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 5%, var(--sg-bg, #fff));
    border-radius: 8px; padding: 8px 12px;
    font-size: 12px; color: var(--sg-fg, #0f172a);
    line-height: 1.4;
  }
  .explain strong { color: var(--sg-accent, #4338ca); margin-right: 4px; }

  :global(td.mono-cell) {
    font-family: ui-monospace, monospace; font-size: 11.5px;
    color: var(--sg-muted, #64748b);
  }
  :global(td.action-created)   { color: #166534; font-weight: 600; }
  :global(td.action-updated)   { color: #6366f1; font-weight: 600; }
  :global(td.action-deleted)   { color: #b91c1c; font-weight: 700; }
  :global(td.action-invited)   { color: #92400e; font-weight: 600; }
  :global(td.action-commented) { color: #475569; }
  :global(td.action-archived)  { color: #94a3b8; }
</style>
