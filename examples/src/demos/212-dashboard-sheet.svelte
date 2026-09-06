<script lang="ts">
  /**
   * 212. Dashboard sheet (sparklines + heatmap)
   * --------------------------------------------
   * A plain <SvGrid responsive={true}> that reads like an Excel dashboard. Each channel row shows
   * an inline SVG trend sparkline (a per-column custom cell) and an eight-week
   * heatmap shaded by volume (value-driven cellClass). Total and Avg are live
   * =SUM / =AVERAGE formulas (HyperFormula) - edit any weekly cell and the
   * sparkline reshapes, the heatmap re-shades and the totals update.
   */
  import { onDestroy } from 'svelte'
  import { HyperFormula } from 'hyperformula'
  import {
    SvGrid,
    tableFeatures,
    renderSnippet,
    rowResize,
    createHyperFormulaSheet,
    type ColumnDef,
    type GridColumns,
    type HyperFormulaInstance,
    type HyperFormulaSheet,
  } from '@svgrid/grid'

  function colLetters(n: number): string[] {
    return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i))
  }
  const letters = colLetters(20) // A=Channel, B=Total, C=Avg, D=Trend, E..L=W1..W8, M..T empty
  const WEEK_COLS = letters.slice(4, 12) // E..L (8 weeks)
  const WEEKS = WEEK_COLS.length
  const MIN_ROWS = 40
  type Row = Record<string, unknown>

  const CHANNELS: { name: string; weekly: number[] }[] = [
    { name: 'Organic search', weekly: [820, 910, 880, 1020, 1180, 1240, 1310, 1420] },
    { name: 'Paid search',    weekly: [640, 700, 590, 760, 720, 810, 880, 940] },
    { name: 'Social',         weekly: [310, 420, 560, 480, 610, 720, 690, 810] },
    { name: 'Referral',       weekly: [180, 210, 240, 230, 260, 300, 320, 360] },
    { name: 'Email',          weekly: [420, 400, 460, 510, 540, 500, 580, 620] },
    { name: 'Direct',         weekly: [520, 540, 560, 600, 640, 700, 720, 760] },
    { name: 'Partnerships',   weekly: [90, 120, 160, 140, 210, 260, 240, 320] },
    { name: 'Marketplace',    weekly: [140, 180, 170, 220, 260, 300, 340, 410] },
  ]

  const empty = (): Row => Object.fromEntries(letters.map((c) => [c, ''])) as Row
  const HEADERS = ['Channel', 'Total', 'Avg', 'Trend', ...Array.from({ length: WEEKS }, (_, i) => `W${i + 1}`)]
  const seed: Row[] = [Object.fromEntries(letters.map((c, i) => [c, HEADERS[i] ?? ''])) as Row]
  CHANNELS.forEach((ch, i) => {
    const r = empty()
    r.A = ch.name
    r.B = `=SUM(E${i + 2}:L${i + 2})`
    r.C = `=ROUND(AVERAGE(E${i + 2}:L${i + 2}),0)`
    WEEK_COLS.forEach((c, w) => (r[c] = ch.weekly[w]!))
    seed.push(r)
  })
  while (seed.length < MIN_ROWS) seed.push(empty()) // empty grid below, Excel-style

  const hf = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' })
  hf.addSheet('Sheet1')
  const sheet: HyperFormulaSheet<Row> = createHyperFormulaSheet({
    hyperformula: hf as unknown as HyperFormulaInstance,
    rows: seed.map((r) => ({ ...r })),
    fields: letters as unknown as ReadonlyArray<keyof Row & string>,
  })
  let raw = $state<Row[]>(sheet.raw)
  let computed = $state<Row[]>(sheet.computed)
  const features = tableFeatures({})

  function commitCell(rowIndex: number, columnId: string, value: unknown) {
    let next: unknown = value
    if (typeof next === 'string' && next.trim() !== '' && !next.trim().startsWith('=')) {
      const n = Number(next)
      if (Number.isFinite(n)) next = n
    }
    const snap = sheet.update(rowIndex, columnId, next)
    computed = snap.computed
    raw = snap.raw
  }
  onDestroy(() => sheet.destroy())

  const fmt = (v: unknown) => (v == null || v === '' ? '' : typeof v === 'number' ? v.toLocaleString('en-US') : String(v))
  function weeklyFor(rowIndex: number): number[] {
    if (rowIndex < 1 || rowIndex > CHANNELS.length) return [] // no sparkline on empty rows
    return WEEK_COLS.map((c) => Number(raw[rowIndex]?.[c]) || 0)
  }
  const scale = $derived.by(() => {
    let min = Infinity, max = -Infinity
    for (let r = 1; r < raw.length; r++) for (const c of WEEK_COLS) {
      const n = Number(raw[r]?.[c])
      if (Number.isFinite(n)) { min = Math.min(min, n); max = Math.max(max, n) }
    }
    return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 1 : max }
  })

  function cellClass(rowIndex: number, letter: string): string {
    if (rowIndex === 0) return 'sheet-head'
    if (WEEK_COLS.includes(letter)) {
      const n = Number(raw[rowIndex]?.[letter])
      if (!Number.isFinite(n)) return ''
      const { min, max } = scale
      const t = max > min ? (n - min) / (max - min) : 0
      return `db-heat db-h${Math.min(4, Math.floor(t * 5))}`
    }
    if (letter === 'A') return 'db-label'
    if (letter === 'B' || letter === 'C') return 'db-kpi'
    return ''
  }

  const columns: GridColumns<Row> = letters.map((letter) => {
    const base: ColumnDef<typeof features, Row> = {
      field: letter,
      header: letter,
      width: letter === 'A' ? 150 : letter === 'B' ? 78 : letter === 'C' ? 70 : letter === 'D' ? 104 : 62,
      align: 'right',
      editorType: 'text',
      cellClass: (ctx: { row: { index: number } }) => cellClass(ctx.row.index, letter),
      cell: (ctx: { row: { index: number } }) => renderSnippet(Cell, { value: computed[ctx.row.index]?.[letter] }),
    }
    if (letter === 'D') {
      base.align = 'center'
      base.editable = false
      base.cell = (ctx: { row: { index: number } }) => renderSnippet(Spark, { values: weeklyFor(ctx.row.index), head: ctx.row.index === 0 })
    }
    return base
  })

  let heights = $state<Record<number, number>>({})
  const rowHeight = (i: number) => heights[i] ?? 26
  const onRowResize = (i: number, h: number) => (heights = { ...heights, [i]: h })
</script>

{#snippet Cell({ value }: { value: unknown })}
  <span class="cellv">{fmt(value)}</span>
{/snippet}

{#snippet Spark({ values, head }: { values: number[]; head: boolean })}
  {#if head}
    <span class="db-spark-h">Trend</span>
  {:else if values.length}
    {@const max = Math.max(...values, 1)}
    {@const min = Math.min(...values, 0)}
    {@const span = max - min || 1}
    {@const W = 90}
    {@const H = 22}
    {@const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - ((v - min) / span) * H}`).join(' ')}
    <svg class="db-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={`0,${H} ${pts} ${W},${H}`} class="db-spark-area" />
      <polyline points={pts} class="db-spark-line" />
      <circle cx={W} cy={H - ((values[values.length - 1]! - min) / span) * H} r="1.8" class="db-spark-dot" />
    </svg>
  {/if}
{/snippet}

<section class="sheet-demo">
  <header class="bs-head">
    <h1 class="bs-title">Dashboard sheet</h1>
    <p class="bs-sub">
      Weekly signups by channel as an Excel-style dashboard on a plain
      <code>&lt;SvGrid&gt;</code>: an inline <strong>sparkline</strong> per row and an eight-week
      <strong>heatmap</strong>. <em>Total</em> and <em>Avg</em> are live <code>=SUM</code> /
      <code>=AVERAGE</code> formulas - edit any weekly cell (W1-W8) and the sparkline, heatmap
      and totals all update.
    </p>
  </header>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="sheet" use:rowResize={{ onResize: onRowResize, min: 20, max: 320 }}>
    <SvGrid responsive={true}
      columnResize
      data={raw}
      columns={columns}
      features={features}
      sortable={false}
      filterable={false}
      selectionMode="cell"
      showRowNumbers={true}
      rowNumberWidth={46}
      showColumnFilters={false}
      showRowSelection={false}
      enableInlineEditing={true}
      enableRowHover={false}
      enableCellSelection={true}
      contextMenu={['copy', 'cut', 'paste', 'clear']}
      rowHeight={rowHeight}
      containerHeight="100%"
      fitColumns={false}
      onCellValueChange={(e) => { if (e.columnId !== '__rownum__') commitCell(e.rowIndex, e.columnId, e.newValue) }}
    />
  </div>
</section>

<!-- Shared Excel chrome is `.sheet-demo` in src/index.css; only the
     dashboard heatmap + sparkline styles live here. -->
<style>
  .sheet :global(.sv-grid-cell.db-label) { text-align: left; font-weight: 600; }
  .sheet :global(.sv-grid-cell.db-kpi) { font-weight: 700; }
  .sheet :global(.sv-grid-cell.db-heat) { font-weight: 600; }
  /* Heatmap ramp derived from the theme accent so it re-tints per theme. */
  .sheet :global(.sv-grid-cell.db-h0) { background: color-mix(in srgb, var(--sg-accent, #6366f1) 8%, transparent) !important; }
  .sheet :global(.sv-grid-cell.db-h1) { background: color-mix(in srgb, var(--sg-accent, #6366f1) 18%, transparent) !important; }
  .sheet :global(.sv-grid-cell.db-h2) { background: color-mix(in srgb, var(--sg-accent, #6366f1) 32%, transparent) !important; }
  .sheet :global(.sv-grid-cell.db-h3) { background: color-mix(in srgb, var(--sg-accent, #6366f1) 48%, transparent) !important; }
  .sheet :global(.sv-grid-cell.db-h4) { background: color-mix(in srgb, var(--sg-accent, #6366f1) 66%, transparent) !important; color: var(--sg-on-accent, #fff) !important; }
  .db-spark { width: 90px; height: 22px; display: inline-block; vertical-align: middle; overflow: visible; }
  .db-spark-line { fill: none; stroke: var(--sg-accent, #4f46e5); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .db-spark-area { fill: color-mix(in srgb, var(--sg-accent, #4f46e5) 14%, transparent); stroke: none; }
  .db-spark-dot { fill: var(--sg-accent, #4f46e5); }
  .db-spark-h { font-size: 12px; color: var(--sg-muted, #475569); font-weight: 700; }
</style>
