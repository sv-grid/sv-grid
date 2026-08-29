<script lang="ts">
  /**
   * 399. Alert Rules engine (Enterprise)
   * ------------------------------------
   * A live trading desk. Prices walk every second; end users define ALERT RULES
   * at runtime - no code - that watch the data and react: raise a toast, tint the
   * row, flash the cell, or log it. Rules are authored in a visual builder (or a
   * free-text expression), persisted to localStorage, and shareable as JSON.
   *
   * In-grid sparklines, live tick flashes and colour-coded moves make it read
   * like a real terminal. Engine + overlay: @svgrid/enterprise.
   */
  import { SvGrid, SvToaster, renderSnippet, type ColumnDef, type SvGridApi } from '@svgrid/grid'
  import type { ConditionalFormat } from '@svgrid/grid/format'
  import { SvGridAlerts, alertStore, enableAlerts, setLicenseKey, type AlertRule, type ExprColumn } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableAlerts()

  type Quote = { symbol: string; name: string; sector: string; price: number; changePct: number; bid: number; ask: number; volume: number; history: number[] }

  const SECTOR_COLOR: Record<string, string> = {
    Consumer: '#0ea5e9', Health: '#10b981', Industrial: '#f59e0b', Tech: '#6366f1',
    Energy: '#84cc16', Auto: '#ef4444', Finance: '#14b8a6', Logistics: '#a855f7',
    Materials: '#eab308', Media: '#ec4899', Travel: '#f97316',
  }

  const base: Omit<Quote, 'history' | 'bid' | 'ask'>[] = [
    { symbol: 'ATO', name: 'Atomic Foods', sector: 'Consumer', price: 182, changePct: 0, volume: 12400 },
    { symbol: 'NVX', name: 'Novax Labs', sector: 'Health', price: 645, changePct: 0, volume: 8800 },
    { symbol: 'ORB', name: 'Orbital Systems', sector: 'Industrial', price: 712, changePct: 0, volume: 15200 },
    { symbol: 'QLM', name: 'Quantum Loom', sector: 'Tech', price: 388, changePct: 0, volume: 22100 },
    { symbol: 'VRD', name: 'Verdant Energy', sector: 'Energy', price: 96, changePct: 0, volume: 30500 },
    { symbol: 'HLX', name: 'Helix Motors', sector: 'Auto', price: 274, changePct: 0, volume: 9100 },
    { symbol: 'BYT', name: 'Byte Dynamics', sector: 'Tech', price: 934, changePct: 0, volume: 41200 },
    { symbol: 'CRS', name: 'Crestline Bank', sector: 'Finance', price: 118, changePct: 0, volume: 18700 },
    { symbol: 'MDL', name: 'Meridian Labs', sector: 'Health', price: 523, changePct: 0, volume: 6400 },
    { symbol: 'PLR', name: 'Polaris Freight', sector: 'Logistics', price: 61, changePct: 0, volume: 27800 },
    { symbol: 'SVN', name: 'Sovereign Gold', sector: 'Materials', price: 786, changePct: 0, volume: 5300 },
    { symbol: 'TDL', name: 'Tidal Media', sector: 'Media', price: 44, changePct: 0, volume: 52100 },
    { symbol: 'AUR', name: 'Aurora Power', sector: 'Energy', price: 209, changePct: 0, volume: 14600 },
    { symbol: 'KND', name: 'Kindred Retail', sector: 'Consumer', price: 157, changePct: 0, volume: 20300 },
    { symbol: 'FRN', name: 'Fern Biotech', sector: 'Health', price: 812, changePct: 0, volume: 7700 },
    { symbol: 'GRV', name: 'Granite Ventures', sector: 'Finance', price: 333, changePct: 0, volume: 11200 },
    { symbol: 'NMB', name: 'Nimbus Cloud', sector: 'Tech', price: 671, changePct: 0, volume: 33400 },
    { symbol: 'OMR', name: 'Omerta Steel', sector: 'Materials', price: 88, changePct: 0, volume: 24900 },
    { symbol: 'VLT', name: 'Voltaic Auto', sector: 'Auto', price: 405, changePct: 0, volume: 16800 },
    { symbol: 'ZPH', name: 'Zephyr Air', sector: 'Travel', price: 72, changePct: 0, volume: 29600 },
  ]

  // Seed a plausible 20-point history around each price (deterministic).
  const seedHistory = (p: number) => Array.from({ length: 20 }, (_, i) => +(p * (1 + Math.sin(i / 2.3) * 0.03 - (20 - i) * 0.001)).toFixed(2))
  const seed: Quote[] = base.map((q) => ({ ...q, bid: +(q.price - q.price * 0.001).toFixed(2), ask: +(q.price + q.price * 0.001).toFixed(2), history: seedHistory(q.price) }))

  let rows = $state.raw<Quote[]>(seed)
  let alertFormats = $state<ConditionalFormat<Quote>[]>([])
  let paused = $state(false)
  let api = $state<SvGridApi<any, Quote> | null>(null)

  const gainers = $derived(rows.filter((r) => r.changePct > 0).length)
  const topMover = $derived([...rows].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0])

  const columns: ColumnDef<any, Quote>[] = [
    { id: 'symbol', header: 'Symbol', field: 'symbol', width: 84, cell: (ctx) => renderSnippet(SymbolCell, { row: ctx.row.original }) },
    { id: 'name', header: 'Name', field: 'name', width: 150 },
    { id: 'sector', header: 'Sector', field: 'sector', width: 118, cell: (ctx) => renderSnippet(SectorCell, { row: ctx.row.original }) },
    { id: 'price', header: 'Last', field: 'price', editorType: 'number', width: 96, cellFlash: true, format: { type: 'currency', currency: 'USD' } },
    { id: 'changePct', header: 'Change', field: 'changePct', editorType: 'number', width: 100, cell: (ctx) => renderSnippet(ChangeCell, { row: ctx.row.original }) },
    { id: 'bid', header: 'Bid', field: 'bid', editorType: 'number', width: 90, format: { type: 'currency', currency: 'USD' } },
    { id: 'ask', header: 'Ask', field: 'ask', editorType: 'number', width: 90, format: { type: 'currency', currency: 'USD' } },
    { id: 'volume', header: 'Volume', field: 'volume', editorType: 'number', width: 100, format: { type: 'number' } },
    { id: 'trend', header: '20-tick', field: 'history', width: 100, sparkline: { type: 'area', color: '#6366f1', lineWidth: 1.5 } },
  ]

  const exprColumns: ExprColumn[] = [
    { id: 'symbol', name: 'Symbol', type: 'text' },
    { id: 'name', name: 'Name', type: 'text' },
    { id: 'sector', name: 'Sector', type: 'text' },
    { id: 'price', name: 'Last price', type: 'number' },
    { id: 'changePct', name: 'Change %', type: 'number' },
    { id: 'bid', name: 'Bid', type: 'number' },
    { id: 'ask', name: 'Ask', type: 'number' },
    { id: 'volume', name: 'Volume', type: 'number' },
  ]

  const seededRules: AlertRule[] = [
    {
      id: 'price-over-700', name: 'Price over 700', enabled: true, severity: 'warning', scope: 'row',
      predicate: { kind: 'cmp', column: 'price', op: 'greaterThan', value: 700 },
      trigger: { type: 'dataChange' },
      actions: [{ kind: 'toast', message: '{name} ({symbol}) crossed 700 -> {value}' }, { kind: 'highlight', style: { background: '#fef3c7', color: '#92400e' } }],
      createdAt: 0,
    },
    {
      id: 'sharp-move', name: 'Sharp move (>3% in a tick)', enabled: true, severity: 'error', scope: 'cell', columns: ['price'],
      predicate: { kind: 'const', value: true },
      trigger: { type: 'relativeChange', expr: { kind: 'percentChange', column: 'price', op: '>', value: 3, abs: true } },
      actions: [{ kind: 'cellFlash' }, { kind: 'toast', message: 'Sharp move on {symbol}: now {value}' }],
      createdAt: 0,
    },
  ]

  function tick() {
    if (paused) return
    rows = rows.map((q) => {
      const drift = (Math.random() - 0.48) * 0.03
      const price = Math.max(1, +(q.price * (1 + drift)).toFixed(2))
      const changePct = +(((price - q.price) / q.price) * 100).toFixed(2)
      return {
        ...q, price, changePct,
        bid: +(price - price * 0.001).toFixed(2), ask: +(price + price * 0.001).toFixed(2),
        volume: q.volume + Math.round(Math.random() * 800),
        history: [...q.history.slice(1), price],
      }
    })
  }
  $effect(() => {
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  })

  function jumpTo(rowId: string | undefined) {
    if (!rowId) return
    const i = rows.findIndex((q) => q.symbol === rowId)
    if (i >= 0) { api?.scrollToRow?.(i); api?.selectRows?.([rowId]) }
  }
</script>

{#snippet SymbolCell(props: { row: Quote })}
  <span class="sym"><span class="sym-badge" style={`background:${SECTOR_COLOR[props.row.sector] ?? '#64748b'}`}>{props.row.symbol.slice(0, 2)}</span>{props.row.symbol}</span>
{/snippet}
{#snippet SectorCell(props: { row: Quote })}
  <span class="chip" style={`color:${SECTOR_COLOR[props.row.sector] ?? '#64748b'}; background:color-mix(in srgb, ${SECTOR_COLOR[props.row.sector] ?? '#64748b'} 15%, transparent)`}>{props.row.sector}</span>
{/snippet}
{#snippet ChangeCell(props: { row: Quote })}
  {@const up = props.row.changePct >= 0}
  <span class="chg" style={`color:${up ? '#16a34a' : '#dc2626'}`}>
    <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">{#if up}<path d="M6 2 L11 9 L1 9 Z" fill="currentColor" />{:else}<path d="M6 10 L1 3 L11 3 Z" fill="currentColor" />{/if}</svg>
    {up ? '+' : ''}{props.row.changePct.toFixed(2)}%
  </span>
{/snippet}

<div class="app">
  <header class="app-bar">
    <div class="app-title">
      <span class="app-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg></span>
      <div>
        <h2>Market Watch <span class="live" class:paused>{paused ? 'Paused' : 'Live'}</span></h2>
        <p>Live desk with runtime alert rules - toast, highlight and flash as prices move. No code.</p>
      </div>
    </div>
    <div class="app-tools">
      <button type="button" class="btn" onclick={() => (paused = !paused)}>
        {#if paused}<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>Resume{:else}<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>Pause{/if}
      </button>
      <SvGridAlerts data={rows} columns={exprColumns} getRowId={(r) => r.symbol} rules={seededRules} storageKey="svgrid-demo:alerts" bind:formats={alertFormats} onJump={(e) => jumpTo(e.rowId)} />
    </div>
  </header>

  <div class="kpis">
    <div class="kpi"><span class="kpi-label">Symbols</span><span class="kpi-value">{rows.length}</span></div>
    <div class="kpi"><span class="kpi-label">Gainers</span><span class="kpi-value" style="color:#16a34a">{gainers}<span class="kpi-sub"> / {rows.length}</span></span></div>
    <div class="kpi"><span class="kpi-label">Top mover</span><span class="kpi-value">{topMover?.symbol ?? '-'}<span class="kpi-sub" style={`color:${(topMover?.changePct ?? 0) >= 0 ? '#16a34a' : '#dc2626'}`}> {(topMover?.changePct ?? 0) >= 0 ? '+' : ''}{topMover?.changePct?.toFixed(2)}%</span></span></div>
    <div class="kpi"><span class="kpi-label">Alerts fired</span><span class="kpi-value" style="color:var(--sg-accent,#4f46e5)">{alertStore.events.length}</span></div>
  </div>

  <div class="app-grid">
    <SvGrid data={rows} {columns} getRowId={(r) => r.symbol} conditionalFormats={alertFormats} onApiReady={(a) => (api = a)} containerHeight={320} />
  </div>

  <footer class="app-foot">
    <span class="legend"><span class="legend-swatch" style="background:#fef3c7"></span> Price &gt; 700</span>
    <span class="legend"><span class="legend-swatch" style="background:var(--sg-cell-flash,#fde68a)"></span> Sharp move flash</span>
    <span class="foot-hint">Click <strong>Manage alerts</strong> to add your own rule - it persists across reloads.</span>
  </footer>
</div>

<SvToaster position="bottom-right" />

<style>
  .app { border: 1px solid color-mix(in srgb, currentColor 13%, transparent); border-radius: 16px; overflow: hidden; background: color-mix(in srgb, currentColor 2%, transparent); font-family: var(--sg-font, inherit); color: inherit; }
  /* Phone: this root hides overflow (rounded corners), which makes its automatic
     min-height 0 - so as a flex item of the demo stage it shrank to the stage and
     clipped its own footer. Keep its content height; the page scrolls instead. */
  @media (max-width: 767px) {
    .app { flex-shrink: 0; }
  }
  .app-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 15px 18px; border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent); flex-wrap: wrap; }
  .app-title { display: flex; align-items: center; gap: 13px; }
  .app-icon { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; background: color-mix(in srgb, var(--sg-accent, #4f46e5) 15%, transparent); color: var(--sg-accent, #4f46e5); flex: none; }
  .app-title h2 { margin: 0; font-size: 16px; font-weight: 650; display: flex; align-items: center; gap: 9px; }
  .app-title p { margin: 2px 0 0; font-size: 12.5px; opacity: 0.6; max-width: 52ch; line-height: 1.45; }
  .live { font-size: 10.5px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: #16a34a; background: color-mix(in srgb, #16a34a 14%, transparent); padding: 2px 8px 2px 16px; border-radius: 999px; position: relative; }
  .live::before { content: ''; position: absolute; left: 7px; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; border-radius: 999px; background: #16a34a; box-shadow: 0 0 0 0 color-mix(in srgb, #16a34a 60%, transparent); animation: pulse 1.6s infinite; }
  .live.paused { color: #d97706; background: color-mix(in srgb, #d97706 14%, transparent); }
  .live.paused::before { background: #d97706; animation: none; }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, #16a34a 55%, transparent) } 70% { box-shadow: 0 0 0 6px transparent } 100% { box-shadow: 0 0 0 0 transparent } }
  @media (prefers-reduced-motion: reduce) { .live::before { animation: none } }
  .app-tools { display: inline-flex; align-items: center; gap: 8px; }
  .btn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 13px; border-radius: 9px; font-size: 13px; font-weight: 500; cursor: pointer; color: inherit; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); background: color-mix(in srgb, currentColor 5%, transparent); transition: background 0.14s ease, border-color 0.14s ease; }
  .btn:hover { background: color-mix(in srgb, currentColor 13%, transparent); border-color: color-mix(in srgb, currentColor 36%, transparent); }

  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1px; background: color-mix(in srgb, currentColor 10%, transparent); border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent); }
  .kpi { padding: 12px 16px; background: color-mix(in srgb, currentColor 2%, transparent); display: flex; flex-direction: column; gap: 3px; }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.55; font-weight: 600; }
  .kpi-value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; }
  .kpi-sub { font-size: 12px; font-weight: 600; opacity: 0.75; }

  .app-grid { padding: 12px; }
  .app-foot { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 11px 18px; border-top: 1px solid color-mix(in srgb, currentColor 10%, transparent); font-size: 12px; opacity: 0.85; }
  .legend { display: inline-flex; align-items: center; gap: 6px; }
  .legend-swatch { width: 12px; height: 12px; border-radius: 3px; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); }
  .foot-hint { opacity: 0.7; }

  /* cell renderers */
  :global(.sym) { display: inline-flex; align-items: center; gap: 7px; font-weight: 600; }
  :global(.sym-badge) { width: 22px; height: 22px; border-radius: 6px; display: inline-grid; place-items: center; font-size: 10px; font-weight: 700; color: #fff; }
  :global(.chip) { font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }
  :global(.chg) { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; font-variant-numeric: tabular-nums; }
</style>
