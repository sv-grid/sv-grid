<script lang="ts">
  /**
   * 503. Big data: up to 10,000,000 rows x 10,000 columns
   * ------------------------------------------------------
   * One SvGrid on the Enterprise server row model. The rows live behind a Web
   * Worker that answers the model's requests like a database would: it sorts
   * (radix, exact), filters, groups and applies edits over a generated
   * dataset, and sends back only the ids of the rows asked for. The page
   * builds just the rows on screen, so the grid's memory and per-scroll work
   * do not grow with the row count.
   *
   * Pick a size, then sort a column, type in a filter, group, or edit a cell
   * (balance, rating, status, game, bought, the months and the metrics are
   * editable). "Run benchmark" times each of those against the current size
   * and lists the results. Every number on the page is measured live in this
   * browser.
   */
  import { onDestroy, onMount } from 'svelte'
  import {
    SvGrid,
    renderComponent,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type ConditionalFormat,
    type SvGridApi,
  } from '@svgrid/grid'
  import { createServerRowModel, serverGroupText, SvGroupCell, type ServerRowModelGridRow } from '@svgrid/enterprise'
  import { createBigDataClient, type Activity, type BigRow } from '../shared/bigdata/client'
  import {
    columnsFor,
    COUNTRY_BY_NAME,
    CONTINENTS,
    GAMES,
    LANGUAGES,
    STATUSES,
    type BigColumn,
  } from '../shared/bigdata/data'

  // What the grid holds: a data row or a group row, each carrying __group.
  type GridRow = ServerRowModelGridRow<BigRow>

  const ROW_OPTIONS = [10_000, 100_000, 1_000_000, 10_000_000]
  const COL_OPTIONS = [10, 25, 100, 1_000, 10_000]
  const GROUPINGS: Array<{ label: string; by: string[] }> = [
    { label: 'None', by: [] },
    { label: 'Continent > Country', by: ['continent', 'country'] },
    { label: 'Country', by: ['country'] },
    { label: 'Game', by: ['game'] },
    { label: 'Status', by: ['status'] },
    { label: 'Rating', by: ['rating'] },
  ]

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
  const full = new Intl.NumberFormat('en-US')
  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : ms >= 10 ? `${Math.round(ms)} ms` : `${ms.toFixed(1)} ms`)
  const sizeLabel = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000}M` : n >= 1_000 ? `${n / 1_000}K` : String(n))

  let rowCount = $state(1_000_000)
  let colCount = $state(25)
  let grouping = $state(0)
  let search = $state('')
  let activity = $state<Activity>({})
  let ctl = $state<ReturnType<typeof createServerRowModel<BigRow>> | null>(null)
  let columns = $state<ColumnDef<any, GridRow>[]>([])
  let pinning = $state<{ left: string[]; right: string[] }>({ left: [], right: [] })
  let api: SvGridApi<any, GridRow> | null = null
  let gridKey = $state(0)
  let readyMs = $state<number | null>(null)
  let editNote = $state('')

  const client = createBigDataClient((a) => (activity = a))

  // ---- columns ---------------------------------------------------------------

  const chip = (labels: readonly string[]) => ({ getValue }: { getValue: () => unknown }) => {
    const value = getValue()
    const i = labels.indexOf(String(value))
    return i < 0 ? 'bd-chip' : `bd-chip bd-c${i % 8}`
  }
  const moneyClass = ({ getValue }: { getValue: () => unknown }) => {
    const value = getValue()
    const n = Number(value)
    if (!Number.isFinite(n)) return ''
    return n < 0 ? 'bd-neg' : n >= 15_000 ? 'bd-pos3' : n >= 8_000 ? 'bd-pos2' : n >= 2_000 ? 'bd-pos1' : ''
  }
  const heatClass = ({ getValue }: { getValue: () => unknown }) => {
    const value = getValue()
    const n = Number(value)
    return Number.isFinite(n) ? `bd-h${Math.min(9, Math.max(0, Math.floor(n / 100)))}` : ''
  }
  const stars = (v: unknown) => {
    const n = Math.round(Number(v))
    return Number.isFinite(n) && n >= 1 ? '★'.repeat(Math.min(5, n)) + '☆'.repeat(Math.max(0, 5 - n)) : String(v ?? '')
  }

  /** A data row, as opposed to a group row of the server row model. */
  const isLeaf = (row: { original?: unknown } | undefined) =>
    (row?.original as { __group?: { kind?: string } } | undefined)?.__group?.kind === 'leaf'
  /** Format data rows; a group row has no value in this column, so show nothing. */
  const leafOnly =
    (fmt: (value: unknown) => string) =>
    ({ value, row }: { value: unknown; row: { original?: unknown } }) =>
      isLeaf(row) ? fmt(value) : ''
  const editableLeaf = (ctx: { row: { original?: unknown } }) => isLeaf(ctx.row)

  function toColumnDef(c: BigColumn): ColumnDef<any, GridRow> {
    const base = { field: c.field, header: c.header, width: c.width } as ColumnDef<any, GridRow>
    switch (c.field) {
      case 'id':
        return { ...base, align: 'right', cellClass: 'bd-id', editable: false, formatter: leafOnly((v) => full.format(Number(v))) }
      case 'name':
        // The group column too: a group row shows its chevron, label and row
        // count here; a data row shows the person's name.
        return {
          id: 'name',
          header: 'Name',
          width: 250,
          editable: false,
          cellClass: 'bd-name',
          fieldFn: (row) => serverGroupText(row as never, 'name'),
          cell: (ctx) =>
            renderComponent(SvGroupCell, {
              row: ctx.row.original as never,
              onToggle: () => ctl?.group.onToggle(ctx.row.original as never),
              leafField: 'name',
            }),
        }
      case 'email':
        return { ...base, cellClass: 'bd-muted', editable: false, formatter: leafOnly((v) => String(v)) }
      case 'country':
        return { ...base, editable: false, formatter: leafOnly((v) => `${COUNTRY_BY_NAME.get(String(v))?.flag ?? ''} ${String(v)}`) }
      case 'language':
        return { ...base, editable: false, cellClass: chip(LANGUAGES), formatter: leafOnly((v) => String(v)) }
      case 'continent':
        return { ...base, editable: false, cellClass: chip(CONTINENTS), formatter: leafOnly((v) => String(v)) }
      case 'game':
        return { ...base, cellClass: chip(GAMES), editable: editableLeaf, editorType: 'select', editorOptions: [...GAMES], formatter: leafOnly((v) => String(v)) }
      case 'bought':
        // A boolean renders as a checkbox on data rows; group rows have none.
        return { ...base, align: 'center', editable: editableLeaf, formatter: leafOnly((v) => (v ? 'Yes' : 'No')) }
      case 'rating':
        return {
          ...base,
          cellClass: 'bd-stars',
          editable: editableLeaf,
          editorType: 'number',
          // On a group row the value is the average rating.
          formatter: ({ value, row }) => (isLeaf(row) ? stars(value) : value == null ? '' : `avg ${Number(value).toFixed(1)}`),
        }
      case 'balance':
        return { ...base, align: 'right', editable: editableLeaf, editorType: 'number', formatter: ({ value }) => (value == null ? '' : usd.format(Number(value))) }
      case 'status':
        return { ...base, editable: editableLeaf, editorType: 'select', editorOptions: [...STATUSES], cellClass: ({ getValue }) => { const value = getValue(); return value ? `bd-pill bd-s-${String(value).toLowerCase()}` : '' }, formatter: leafOnly((v) => String(v)) }
      case 'joined':
        return { ...base, editable: false, cellClass: 'bd-muted', formatter: leafOnly((v) => String(v)) }
      case 'total':
        return { ...base, align: 'right', editable: false, cellClass: 'bd-total', formatter: ({ value }) => (value == null ? '' : usd.format(Number(value))) }
      default:
        if (c.kind === 'money') {
          return { ...base, align: 'right', editable: editableLeaf, editorType: 'number', cellClass: moneyClass, formatter: leafOnly((v) => usd.format(Number(v))) }
        }
        // A metric is not on the row object: read it from the row index, so
        // 10,000 columns cost nothing until a cell is on screen.
        return {
          id: c.field,
          header: c.header,
          width: c.width,
          fieldFn: (row) => client.cell(row, c.field),
          align: 'right',
          editable: editableLeaf,
          editorType: 'number',
          cellClass: heatClass,
          formatter: ({ value }) => (value == null ? '' : Number(value).toFixed(2)),
        }
    }
  }

  // Data bars with fixed ranges: the grid never scans the 10M rows for a min
  // and max, it scales each cell against the range the data is drawn from.
  const conditionalFormats: ConditionalFormat<GridRow>[] = [
    { type: 'dataBar', columns: ['balance'], color: '#3b82f6', gradient: true, minValue: 0, maxValue: 999_999 },
    { type: 'dataBar', columns: ['total'], color: '#10b981', negativeColor: '#ef4444', minValue: -60_000, maxValue: 240_000 },
  ]

  // ---- the dataset -----------------------------------------------------------

  async function rebuild() {
    readyMs = null
    editNote = ''
    const t0 = performance.now()
    ctl?.dispose()
    ctl = null
    await client.configure(rowCount, colCount)
    const cols = columnsFor(colCount)
    columns = cols.map(toColumnDef)
    const fields = new Set(cols.map((c) => c.field))
    pinning = {
      left: fields.has('name') ? ['name'] : [],
      right: fields.has('total') ? ['total'] : [],
    }
    ctl = createServerRowModel<BigRow>(client.source, {
      blockSize: 100,
      maxBlocksInCache: 80,
      blockLoadDebounceMs: 30,
      keepRowsWhileLoading: 800,
      groupBy: GROUPINGS[grouping]!.by.filter((f) => fields.has(f)),
      aggregations: [
        { col: 'balance', fn: 'sum' },
        { col: 'total', fn: 'sum' },
        { col: 'rating', fn: 'avg' },
      ],
      childCount: (r) => Number((r as Record<string, unknown>).__count) || undefined,
      getRowId: (r) => String(r.id),
    })
    gridKey += 1
    await waitPainted()
    readyMs = performance.now() - t0
  }

  function setGrouping(i: number) {
    grouping = i
    ctl?.setGroupBy(GROUPINGS[i]!.by.filter((f) => columns.some((c) => c.field === f)))
  }

  let searchTimer: ReturnType<typeof setTimeout> | null = null
  function onSearch(value: string) {
    search = value
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      if (ctl) ctl.setFilter({ ...ctl.getState().filterModel, global: value })
    }, 250)
  }

  async function onEdit(e: { row: GridRow; columnId: string; newValue: unknown; oldValue: unknown }) {
    const meta = (e.row as Record<string, unknown>).__group as { kind?: string } | undefined
    if (meta && meta.kind !== 'leaf') return
    if (Object.is(e.newValue, e.oldValue)) return
    const value = typeof e.oldValue === 'number' ? Number(e.newValue) : e.newValue
    await ctl?.updateRow(String(e.row.id), { [e.columnId]: value } as Partial<BigRow>)
    const r = activity.edit
    editNote = r ? `Saved in ${fmtMs(r.ms)} in the worker; ${r.patchedViews} cached view${r.patchedViews === 1 ? '' : 's'} patched in place` : ''
  }

  // ---- measuring -------------------------------------------------------------

  /** Resolve once the rows on screen are real rows, not loading placeholders. */
  function waitPainted(timeout = 180_000): Promise<void> {
    const start = performance.now()
    return new Promise((resolve) => {
      const check = () => {
        const host = document.querySelector('.bd-grid')
        const rows = host ? [...host.querySelectorAll('tbody tr')] : []
        const busy = rows.some((r) => r.getAttribute('aria-busy') === 'true')
        const loading = !!host?.querySelector('.sv-grid-loading-overlay, .sv-grid-skeleton-row')
        if ((rows.length > 0 && !busy && !loading) || performance.now() - start > timeout) {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          return
        }
        requestAnimationFrame(check)
      }
      requestAnimationFrame(check)
    })
  }

  // Frame meter: frames per second and the longest frame in the last second.
  let fps = $state(0)
  let longest = $state(0)
  let domCells = $state(0)
  let heapMb = $state<number | null>(null)
  let raf = 0
  onMount(() => {
    let frames = 0
    let worst = 0
    let last = performance.now()
    let windowStart = last
    const loop = (t: number) => {
      frames += 1
      worst = Math.max(worst, t - last)
      last = t
      if (t - windowStart >= 1000) {
        fps = Math.round((frames * 1000) / (t - windowStart))
        longest = worst
        frames = 0
        worst = 0
        windowStart = t
        domCells = document.querySelectorAll('.bd-grid td').length
        const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
        heapMb = mem ? Math.round(mem.usedJSHeapSize / 1e6) : null
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    void rebuild()
  })
  onDestroy(() => {
    cancelAnimationFrame(raf)
    ctl?.dispose()
    client.dispose()
  })

  // ---- benchmark -----------------------------------------------------------------

  type BenchRow = { step: string; ms: number; worker?: number; note: string }
  let bench = $state<BenchRow[]>([])
  let benchRunning = $state(false)

  /**
   * Resolve when the step is really done: no request is waiting on the worker
   * and the rows on screen are real, for four frames running (so a debounced
   * request has had its chance to start). Returns the time of the first of
   * those frames, so the wait itself is not counted.
   */
  function waitSettled(timeout = 600_000): Promise<number> {
    const start = performance.now()
    let quietSince = 0
    let quietFrames = 0
    return new Promise((resolve) => {
      const check = (t: number) => {
        const host = document.querySelector('.bd-grid')
        const rows = host ? [...host.querySelectorAll('tbody tr')] : []
        const busy = rows.some((r) => r.getAttribute('aria-busy') === 'true')
        const quiet = client.pending() === 0 && rows.length > 0 && !busy
        if (quiet) {
          if (quietFrames === 0) quietSince = t
          quietFrames += 1
        } else {
          quietFrames = 0
        }
        if (quietFrames >= 4 || t - start > timeout) {
          resolve(quietFrames >= 4 ? quietSince : t)
          return
        }
        requestAnimationFrame(check)
      }
      requestAnimationFrame(check)
    })
  }

  async function timed(step: string, note: string, action: () => unknown): Promise<void> {
    const seq = activity.compute?.seq ?? 0
    const t0 = performance.now()
    await action()
    const settled = await waitSettled()
    const ms = settled - t0
    // The worker's compute time, if this step made the worker compute anything.
    const w = activity.compute
    bench = [...bench, { step, ms, worker: w && w.seq > seq ? w.ms : undefined, note }]
  }

  function scroller(): HTMLElement | null {
    return document.querySelector('.bd-grid .sv-grid-container')
  }

  async function runBenchmark() {
    if (benchRunning) return
    benchRunning = true
    bench = []
    grouping = 0
    search = ''
    try {
      await timed('Load the dataset', `${full.format(rowCount)} rows x ${full.format(colCount)} columns`, () => rebuild())
      await timed('Jump to the middle', `row ${full.format(Math.floor(rowCount / 2))}`, () => {
        const s = scroller()
        if (s) s.scrollTop = (s.scrollHeight - s.clientHeight) / 2
      })
      await timed('Jump to the last row', `row ${full.format(rowCount)}`, () => {
        const s = scroller()
        if (s) s.scrollTop = s.scrollHeight
      })
      if (colCount >= 100) {
        await timed('Scroll to the last column', `${full.format(colCount)} columns`, () => {
          const s = scroller()
          if (s) s.scrollLeft = s.scrollWidth
        })
      }
      await timed('Sort by bank balance', 'radix sort, every row', () => api?.setSort('balance', 'desc'))
      await timed('Filter: country is Japan', 'one pass over every row', () =>
        api?.setFilter('country', { operator: 'equals', value: 'Japan' } as never),
      )
      await timed('Clear the filter', 'back to the sorted view, cached', () => api?.clearAllFilters?.())
      await timed('Group by continent and country', 'counts and sums in one pass', () => setGrouping(1))
      await timed('Expand Europe', 'the first level of children', () => ctl?.expandGroup(['Europe']))
      await timed('Ungroup', '', () => setGrouping(0))
    } finally {
      benchRunning = false
    }
  }

  const cells = $derived(rowCount * colCount)
  const opLabel: Record<string, string> = {
    identity: 'Served in id order',
    cached: 'Served from the cached view',
    scan: 'Filtered',
    sort: 'Sorted',
    'scan+sort': 'Filtered and sorted',
    group: 'Grouped',
  }
</script>

<section class="bd-wrap">
  <div class="bd-controls">
    <div class="bd-field">
      <span class="bd-label">Rows</span>
      <div class="bd-seg" role="radiogroup" aria-label="Rows">
        {#each ROW_OPTIONS as n (n)}
          <button role="radio" aria-checked={rowCount === n} class:on={rowCount === n} disabled={benchRunning} onclick={() => { rowCount = n; void rebuild() }}>{sizeLabel(n)}</button>
        {/each}
      </div>
    </div>
    <div class="bd-field">
      <span class="bd-label">Columns</span>
      <div class="bd-seg" role="radiogroup" aria-label="Columns">
        {#each COL_OPTIONS as n (n)}
          <button role="radio" aria-checked={colCount === n} class:on={colCount === n} disabled={benchRunning} onclick={() => { colCount = n; void rebuild() }}>{sizeLabel(n)}</button>
        {/each}
      </div>
    </div>
    <div class="bd-field">
      <span class="bd-label">Group by</span>
      <select value={grouping} disabled={benchRunning} onchange={(e) => setGrouping(Number(e.currentTarget.value))}>
        {#each GROUPINGS as g, i (g.label)}<option value={i}>{g.label}</option>{/each}
      </select>
    </div>
    <div class="bd-field bd-grow">
      <span class="bd-label">Search</span>
      <input type="search" placeholder="name, email, country, game, status" value={search} oninput={(e) => onSearch(e.currentTarget.value)} />
    </div>
    <button class="bd-run" onclick={runBenchmark} disabled={benchRunning}>{benchRunning ? 'Running...' : 'Run benchmark'}</button>
  </div>

  <div class="bd-stats">
    <div class="bd-stat"><span class="k">Rows</span><span class="v">{full.format(rowCount)}</span></div>
    <div class="bd-stat"><span class="k">Columns</span><span class="v">{full.format(colCount)}</span></div>
    <div class="bd-stat"><span class="k">Cells</span><span class="v">{compact.format(cells)}</span></div>
    <div class="bd-stat"><span class="k">Cells in the DOM</span><span class="v">{full.format(domCells)}</span></div>
    <div class="bd-stat"><span class="k">Frame rate</span><span class="v">{fps} fps</span><span class="s">longest frame {fmtMs(longest)}</span></div>
    {#if heapMb != null}<div class="bd-stat"><span class="k">JS heap</span><span class="v">{heapMb} MB</span></div>{/if}
    <div class="bd-stat bd-wide">
      <span class="k">Last query</span>
      {#if activity.progress}
        <span class="v">{activity.progress.phase}...</span>
        <span class="bd-bar"><span style={`width:${Math.round((activity.progress.done / Math.max(1, activity.progress.total)) * 100)}%`}></span></span>
      {:else if activity.last}
        <span class="v">{fmtMs(activity.last.ms)}</span>
        <span class="s">{opLabel[activity.last.op] ?? activity.last.op}{activity.last.scanned ? `, ${compact.format(activity.last.scanned)} rows read` : ''} - worker time</span>
      {:else}
        <span class="v">-</span>
      {/if}
    </div>
    {#if readyMs != null}<div class="bd-stat"><span class="k">Ready in</span><span class="v">{fmtMs(readyMs)}</span></div>{/if}
  </div>

  {#if editNote}<p class="bd-note">{editNote}</p>{/if}

  {#if bench.length}
    <div class="bd-bench">
      <table>
        <thead><tr><th>Step</th><th>On screen</th><th>Worker</th><th></th></tr></thead>
        <tbody>
          {#each bench as b (b.step)}
            <tr><td>{b.step}</td><td class="num">{fmtMs(b.ms)}</td><td class="num">{b.worker != null ? fmtMs(b.worker) : '-'}</td><td class="dim">{b.note}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <div class="bd-grid">
    {#if ctl}
      {#key gridKey}
        <SvGrid
          rowModel={ctl}
          {columns}
          {features}
          {conditionalFormats}
          initialColumnPinning={pinning}
          sortable
          filterable
          filterMode="menu"
          editable
          columnResize
          stickyGroupRows
          rowHeight={34}
          containerHeight="100%"
          onCellValueChange={onEdit}
          onApiReady={(next) => (api = next)}
        />
      {/key}
    {/if}
  </div>
</section>

<style>
  .bd-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    color: var(--sg-fg, #0f172a);
  }
  .bd-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px;
  }
  .bd-field { display: flex; flex-direction: column; gap: 4px; }
  .bd-grow { flex: 1 1 200px; }
  .bd-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sg-muted, #64748b); }
  .bd-seg {
    display: inline-flex;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    overflow: hidden;
  }
  .bd-seg button {
    font: inherit;
    font-size: 13px;
    padding: 6px 11px;
    border: 0;
    border-right: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    cursor: pointer;
    font-variant-numeric: tabular-nums;
  }
  .bd-seg button:last-child { border-right: 0; }
  .bd-seg button.on { background: var(--sg-fg, #0f172a); color: var(--sg-bg, #fff); font-weight: 600; }
  .bd-seg button:disabled { cursor: default; opacity: 0.6; }
  .bd-controls select,
  .bd-controls input {
    font: inherit;
    font-size: 13px;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
  }
  .bd-run {
    font: inherit;
    font-weight: 600;
    font-size: 13px;
    padding: 7px 14px;
    border-radius: 8px;
    border: 1px solid var(--sg-fg, #0f172a);
    background: var(--sg-fg, #0f172a);
    color: var(--sg-bg, #fff);
    cursor: pointer;
  }
  .bd-run:disabled { opacity: 0.6; cursor: default; }
  .bd-seg button:focus-visible,
  .bd-run:focus-visible,
  .bd-controls select:focus-visible,
  .bd-controls input:focus-visible { outline: 2px solid var(--sg-accent, #ea580c); outline-offset: 1px; }

  .bd-stats { display: flex; flex-wrap: wrap; gap: 8px; }
  .bd-stat {
    display: flex;
    flex-direction: column;
    min-width: 120px;
    padding: 8px 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
  }
  .bd-stat.bd-wide { min-width: 260px; flex: 1 1 260px; }
  .bd-stat .k { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sg-muted, #64748b); }
  .bd-stat .v { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.25; }
  .bd-stat .s { font-size: 12px; color: var(--sg-muted, #64748b); }
  .bd-bar { display: block; height: 6px; margin-top: 6px; border-radius: 3px; background: var(--sg-header-bg, #f1f5f9); overflow: hidden; }
  .bd-bar > span { display: block; height: 100%; background: linear-gradient(90deg, #3b82f6, #10b981); transition: width 120ms linear; }
  .bd-note { margin: 0; font-size: 13px; color: var(--sg-muted, #64748b); }

  .bd-bench { overflow-x: auto; }
  .bd-bench table { border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
  .bd-bench th, .bd-bench td { padding: 4px 12px; border-bottom: 1px solid var(--sg-border, #e2e8f0); text-align: left; white-space: nowrap; }
  .bd-bench th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sg-muted, #64748b); font-weight: 600; }
  .bd-bench td.num { text-align: right; font-weight: 600; }
  .bd-bench td.dim { color: var(--sg-muted, #64748b); }

  .bd-grid { flex: 1; min-height: 320px; display: flex; flex-direction: column; }

  /* ---- cell palette (data colours, not chrome) ------------------------------- */
  .bd-grid :global(.bd-id) { color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .bd-grid :global(.bd-muted) { color: var(--sg-muted, #64748b); }
  .bd-grid :global(.bd-name) { font-weight: 600; }
  .bd-grid :global(.bd-total) { font-weight: 700; }
  .bd-grid :global(.bd-stars) { color: #f59e0b; letter-spacing: 1px; }
  .bd-grid :global(.bd-yes) { color: #10b981; font-weight: 700; }
  .bd-grid :global(.bd-no) { color: var(--sg-muted, #94a3b8); }
  .bd-grid :global(.bd-neg) { color: #ef4444; }
  .bd-grid :global(.bd-pos1) { color: #16a34a; }
  .bd-grid :global(.bd-pos2) { color: #15803d; font-weight: 600; }
  .bd-grid :global(.bd-pos3) { color: #047857; font-weight: 700; }
  .bd-grid :global(.bd-chip),
  .bd-grid :global(.bd-pill) { font-weight: 600; font-size: 12px; }
  .bd-grid :global(.bd-c0) { color: #2563eb; }
  .bd-grid :global(.bd-c1) { color: #9333ea; }
  .bd-grid :global(.bd-c2) { color: #db2777; }
  .bd-grid :global(.bd-c3) { color: #ea580c; }
  .bd-grid :global(.bd-c4) { color: #0891b2; }
  .bd-grid :global(.bd-c5) { color: #65a30d; }
  .bd-grid :global(.bd-c6) { color: #ca8a04; }
  .bd-grid :global(.bd-c7) { color: #4f46e5; }
  .bd-grid :global(.bd-s-active) { color: #16a34a; }
  .bd-grid :global(.bd-s-churned) { color: #dc2626; }
  .bd-grid :global(.bd-s-pending) { color: #d97706; }
  .bd-grid :global(.bd-s-vip) { color: #7c3aed; }
  .bd-grid :global(.bd-h0) { background: color-mix(in srgb, #8b5cf6 4%, transparent); }
  .bd-grid :global(.bd-h1) { background: color-mix(in srgb, #8b5cf6 8%, transparent); }
  .bd-grid :global(.bd-h2) { background: color-mix(in srgb, #8b5cf6 12%, transparent); }
  .bd-grid :global(.bd-h3) { background: color-mix(in srgb, #8b5cf6 16%, transparent); }
  .bd-grid :global(.bd-h4) { background: color-mix(in srgb, #8b5cf6 20%, transparent); }
  .bd-grid :global(.bd-h5) { background: color-mix(in srgb, #ec4899 18%, transparent); }
  .bd-grid :global(.bd-h6) { background: color-mix(in srgb, #ec4899 24%, transparent); }
  .bd-grid :global(.bd-h7) { background: color-mix(in srgb, #f97316 24%, transparent); }
  .bd-grid :global(.bd-h8) { background: color-mix(in srgb, #f97316 32%, transparent); }
  .bd-grid :global(.bd-h9) { background: color-mix(in srgb, #ef4444 34%, transparent); }

  @media (max-width: 640px) {
    .bd-stat { min-width: calc(50% - 4px); }
    .bd-seg button { padding: 6px 8px; }
  }
</style>
