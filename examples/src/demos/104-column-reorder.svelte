<script lang="ts">
  /**
   * 104. Column reorder (drag headers)
   * ----------------------------------
   * The grid renders `data-svgrid-header-col="<id>"` on every header,
   * so user-land can wire HTML5 drag-and-drop directly onto them.
   * On drop, we mutate the order of the `columns` array we pass to
   * `<SvGrid>` - the grid re-renders in the new order.
   *
   * No library work required. Drop indicator is a vertical bar painted
   * with CSS on the header that the cursor is currently over.
   *
   * For a "save view" workflow, persist `columns.map(c => c.id)` to
   * localStorage and restore on mount.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from 'sv-grid-community'

  type Row = {
    symbol: string
    name: string
    sector: string
    price: number
    change: number
    changePct: number
    volume: number
    marketCap: number
    pe: number
    yield: number
    week52High: number
    week52Low: number
  }

  // Tiny seeded set (real prices snapshotted, no live feed for the demo).
  let rows = $state<Row[]>([
    { symbol: 'AAPL', name: 'Apple',     sector: 'Tech',    price: 198.42, change:  +1.84, changePct: +0.94, volume: 48_241_900, marketCap: 3_100_000, pe: 32.4, yield: 0.52, week52High: 210.18, week52Low: 161.40 },
    { symbol: 'MSFT', name: 'Microsoft', sector: 'Tech',    price: 412.18, change:  -2.40, changePct: -0.58, volume: 22_124_500, marketCap: 3_050_000, pe: 34.2, yield: 0.74, week52High: 421.55, week52Low: 309.45 },
    { symbol: 'NVDA', name: 'NVIDIA',    sector: 'Tech',    price: 124.89, change:  +5.21, changePct: +4.36, volume: 295_881_100, marketCap: 2_950_000, pe: 75.1, yield: 0.01, week52High: 144.42, week52Low:  39.23 },
    { symbol: 'GOOGL',name: 'Alphabet',  sector: 'Tech',    price: 178.92, change:  +0.84, changePct: +0.47, volume: 18_456_200, marketCap: 2_100_000, pe: 26.8, yield: 0.46, week52High: 191.75, week52Low: 121.46 },
    { symbol: 'AMZN', name: 'Amazon',    sector: 'Retail',  price: 188.31, change:  +1.18, changePct: +0.63, volume: 36_120_400, marketCap: 1_900_000, pe: 51.9, yield: 0.00, week52High: 201.20, week52Low: 118.35 },
    { symbol: 'META', name: 'Meta',      sector: 'Tech',    price: 502.71, change:  -3.62, changePct: -0.72, volume: 12_894_000, marketCap: 1_240_000, pe: 28.9, yield: 0.39, week52High: 542.81, week52Low: 274.38 },
    { symbol: 'BRK',  name: 'Berkshire', sector: 'Finance', price: 432.10, change:  +0.92, changePct: +0.21, volume:  3_217_800, marketCap:   870_000, pe:  9.6, yield: 0.00, week52High: 442.18, week52Low: 332.30 },
    { symbol: 'LLY',  name: 'Eli Lilly', sector: 'Pharma',  price: 826.42, change:  +9.18, changePct: +1.12, volume:  3_142_900, marketCap:   765_000, pe:132.8, yield: 0.61, week52High: 882.30, week52Low: 549.12 },
    { symbol: 'TSM',  name: 'TSMC',      sector: 'Tech',    price: 174.96, change:  +2.51, changePct: +1.46, volume: 16_410_200, marketCap:   720_000, pe: 21.4, yield: 1.27, week52High: 198.42, week52Low: 100.58 },
    { symbol: 'JPM',  name: 'JPMorgan',  sector: 'Finance', price: 209.42, change:  +0.16, changePct: +0.08, volume:  9_840_100, marketCap:   580_000, pe: 11.8, yield: 2.34, week52High: 219.81, week52Low: 145.96 },
    { symbol: 'TSLA', name: 'Tesla',     sector: 'Auto',    price: 178.92, change:  -3.41, changePct: -1.87, volume: 102_815_000, marketCap:   560_000, pe: 65.2, yield: 0.00, week52High: 278.98, week52Low: 138.80 },
    { symbol: 'V',    name: 'Visa',      sector: 'Finance', price: 274.18, change:  +1.05, changePct: +0.38, volume:  6_280_400, marketCap:   550_000, pe: 30.1, yield: 0.79, week52High: 290.96, week52Low: 227.66 },
  ])

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // ---- The mutable column order. Each item carries the full ColumnDef
  // plus an id so we can find / swap them.
  type Col = ColumnDef<typeof features, Row> & { id: string }
  const ALL_COLS: Col[] = [
    { id: 'symbol',     field: 'symbol',     header: 'Symbol',      width: 90,  editable: false },
    { id: 'name',       field: 'name',       header: 'Company',     width: 150, editable: false },
    { id: 'sector',     field: 'sector',     header: 'Sector',      width: 110, editable: false },
    { id: 'price',      field: 'price',      header: 'Price',       width: 100, editable: false, align: 'right',
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 2 } } },
    { id: 'change',     field: 'change',     header: 'Change $',    width: 100, editable: false, align: 'right',
      cellClass: (ctx) => `change-${(ctx.getValue() as number) >= 0 ? 'pos' : 'neg'}`,
      format: { type: 'number', options: { signDisplay: 'always', maximumFractionDigits: 2 } } },
    { id: 'changePct',  field: 'changePct',  header: 'Change %',    width: 100, editable: false, align: 'right',
      cellClass: (ctx) => `change-${(ctx.getValue() as number) >= 0 ? 'pos' : 'neg'}`,
      format: { type: 'number', options: { signDisplay: 'always', maximumFractionDigits: 2, style: 'percent' } } },
    { id: 'volume',     field: 'volume',     header: 'Volume',      width: 130, editable: false, align: 'right',
      format: { type: 'number', options: { notation: 'compact', maximumFractionDigits: 1 } } },
    { id: 'marketCap',  field: 'marketCap',  header: 'Market cap',  width: 130, editable: false, align: 'right',
      format: { type: 'number', options: { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 } } },
    { id: 'pe',         field: 'pe',         header: 'P/E',         width:  80, editable: false, align: 'right' },
    { id: 'yield',      field: 'yield',      header: 'Yield %',     width:  90, editable: false, align: 'right',
      format: { type: 'number', options: { maximumFractionDigits: 2 } } },
    { id: 'week52High', field: 'week52High', header: '52w High',    width: 100, editable: false, align: 'right',
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 2 } } },
    { id: 'week52Low',  field: 'week52Low',  header: '52w Low',     width: 100, editable: false, align: 'right',
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 2 } } },
  ]
  const COL_BY_ID = new Map(ALL_COLS.map((c) => [c.id, c]))

  function loadOrder(): string[] {
    try {
      const raw = localStorage.getItem('sv-104-column-order')
      if (raw) {
        const arr = JSON.parse(raw) as string[]
        if (Array.isArray(arr) && arr.every((id) => COL_BY_ID.has(id))) return arr
      }
    } catch { /* ignore */ }
    return ALL_COLS.map((c) => c.id)
  }
  let order = $state<string[]>(loadOrder())
  $effect(() => {
    try { localStorage.setItem('sv-104-column-order', JSON.stringify(order)) } catch { /* ignore */ }
  })

  const orderedColumns = $derived(order.map((id) => COL_BY_ID.get(id)!).filter(Boolean))

  // ---- Drag-and-drop wiring --------------------------------------------
  // Mutation observer makes every rendered header draggable + attaches
  // the dragstart/over/leave/drop handlers. The grid keeps re-rendering
  // headers (sort, resize, virtualization) so we re-attach on every
  // mutation rather than once at mount.
  let gridHost = $state<HTMLElement | null>(null)
  let dragId = $state<string | null>(null)
  let dropOnId = $state<string | null>(null)
  let dropSide = $state<'before' | 'after' | null>(null)

  function attachHeaderHandlers(el: HTMLElement) {
    const id = el.dataset.svgridHeaderCol
    if (!id) return
    if (el.dataset.svDragWired === '1') return
    el.dataset.svDragWired = '1'
    el.setAttribute('draggable', 'true')
    el.style.cursor = 'grab'
    el.addEventListener('dragstart', (ev) => {
      dragId = id
      ev.dataTransfer?.setData('text/plain', id)
      ev.dataTransfer!.effectAllowed = 'move'
    })
    el.addEventListener('dragover', (ev) => {
      if (!dragId || dragId === id) return
      ev.preventDefault()
      ev.dataTransfer!.dropEffect = 'move'
      const rect = el.getBoundingClientRect()
      dropSide = ev.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
      dropOnId = id
    })
    el.addEventListener('dragleave', () => {
      if (dropOnId === id) { dropOnId = null; dropSide = null }
    })
    el.addEventListener('drop', (ev) => {
      ev.preventDefault()
      if (!dragId || dragId === id) { reset(); return }
      const next = order.slice()
      const from = next.indexOf(dragId)
      next.splice(from, 1)
      let to = next.indexOf(id)
      if (dropSide === 'after') to += 1
      next.splice(to, 0, dragId)
      order = next
      reset()
    })
    el.addEventListener('dragend', reset)
  }
  function reset() { dragId = null; dropOnId = null; dropSide = null }

  $effect(() => {
    if (!gridHost) return
    const apply = () => {
      gridHost!.querySelectorAll<HTMLElement>('[data-svgrid-header-col]').forEach(attachHeaderHandlers)
    }
    apply()
    const mo = new MutationObserver(apply)
    mo.observe(gridHost, { childList: true, subtree: true })
    return () => mo.disconnect()
  })

  // Drop-indicator overlay rect (computed in real time from the hovered
  // header element). Renders absolutely-positioned inside gridHost.
  let indicatorRect = $state<{ x: number; y: number; h: number } | null>(null)
  $effect(() => {
    if (!dropOnId || !dropSide || !gridHost) { indicatorRect = null; return }
    const el = gridHost.querySelector<HTMLElement>(`[data-svgrid-header-col="${CSS.escape(dropOnId)}"]`)
    if (!el) { indicatorRect = null; return }
    const r = el.getBoundingClientRect()
    const host = gridHost.getBoundingClientRect()
    indicatorRect = {
      x: (dropSide === 'before' ? r.left : r.right) - host.left,
      y: r.top - host.top,
      h: r.height,
    }
  })

  function resetOrder() { order = ALL_COLS.map((c) => c.id) }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="info shrink-0">
    <p>
      <strong>Drag any column header</strong> left or right to reorder. A vertical indicator shows where it will land. The order persists across reloads (localStorage). The "Symbol" column stays pinned-left because of <code>pin: 'left'</code> on the columnDef - try dragging within the pinned zone.
    </p>
    <div class="info-actions">
      <code class="order-readout">{order.slice(0, 6).join(' › ')}{order.length > 6 ? ' › …' : ''}</code>
      <button class="reset-btn" onclick={resetOrder}>Reset order</button>
    </div>
  </div>

  <div class="grid-host flex-1 min-h-0" bind:this={gridHost}>
    <SvGrid
      data={rows}
      columns={orderedColumns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={34}
      containerHeight="100%"
      fitColumns={false}
    />

    {#if indicatorRect}
      <div class="drop-indicator"
        style:left={`${indicatorRect.x - 2}px`}
        style:top={`${indicatorRect.y}px`}
        style:height={`${indicatorRect.h}px`}
        aria-hidden="true"></div>
    {/if}
  </div>
</section>

<style>
  .info {
    display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(135deg, rgba(99,102,241,0.04), rgba(168,85,247,0.03));
    border-radius: 8px; padding: 10px 14px;
    font-size: 13px; color: var(--sg-fg, #0f172a);
  }
  .info p { margin: 0; flex: 1; min-width: 320px; }
  .info code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: rgba(99,102,241,0.10); padding: 1px 5px; border-radius: 3px;
    color: #4338ca; font-size: 12px;
  }
  .info-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .order-readout { font-size: 11px; max-width: 360px;
                   overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .reset-btn {
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px; padding: 5px 10px; font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .reset-btn:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.1)); }

  .grid-host { position: relative; }
  .drop-indicator {
    position: absolute; width: 4px;
    background: linear-gradient(180deg, #6366f1, #8b5cf6);
    border-radius: 2px;
    box-shadow: 0 0 8px #6366f1;
    pointer-events: none;
    z-index: 50;
    animation: drop-pulse 700ms ease-in-out infinite alternate;
  }
  @keyframes drop-pulse { from { opacity: 0.6; } to { opacity: 1; } }

  /* While a column is being dragged, dim it slightly so the user sees it
     was picked up. The grid sets draggable=true via our mutation observer,
     so dragging works without any other wiring. */
  .grid-host :global([data-svgrid-header-col][draggable]:hover) {
    background: color-mix(in oklab, #6366f1 4%, transparent);
  }
  .grid-host :global([data-svgrid-header-col][draggable]:active) { cursor: grabbing !important; }

  :global(td.change-pos) { color: #16a34a; font-weight: 700; font-variant-numeric: tabular-nums; }
  :global(td.change-neg) { color: #dc2626; font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
