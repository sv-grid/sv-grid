<script lang="ts">
  /**
   * 210. Format Cells
   * ------------------
   * The Excel Home -> Number experience on a plain <SvGrid responsive={true}>. Select a range of
   * cells and apply a display format (Currency, Percent, Thousands, Number,
   * Date, General) - only the rendering changes; the stored value and every
   * formula are untouched. HyperFormula keeps Gross profit, Margin and the Total
   * column live, so a computed % formats exactly like a typed number.
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
    type SvGridApi,
    type HyperFormulaInstance,
    type HyperFormulaSheet,
  } from '@svgrid/grid'

  type FmtKind = 'general' | 'number' | 'currency' | 'percent' | 'thousands' | 'date'
  function colLetters(n: number): string[] {
    return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i))
  }
  const letters = colLetters(18) // A=Metric, B..E=Q1..Q4, F=FY, G..R empty
  type Row = Record<string, unknown>

  const empty = (): Row => Object.fromEntries(letters.map((c) => [c, ''])) as Row
  const seed: Row[] = Array.from({ length: 40 }, empty)
  const put = (row: number, col: string, v: unknown) => { seed[row - 1]![col] = v }

  put(1, 'A', 'Metric'); put(1, 'B', 'Q1'); put(1, 'C', 'Q2'); put(1, 'D', 'Q3'); put(1, 'E', 'Q4'); put(1, 'F', 'FY')
  put(2, 'A', 'Revenue');      put(2, 'B', 412000); put(2, 'C', 468500); put(2, 'D', 501200); put(2, 'E', 559800); put(2, 'F', '=SUM(B2:E2)')
  put(3, 'A', 'COGS');         put(3, 'B', 173000); put(3, 'C', 191200); put(3, 'D', 205600); put(3, 'E', 224900); put(3, 'F', '=SUM(B3:E3)')
  put(4, 'A', 'Gross profit'); ['B','C','D','E'].forEach((c) => put(4, c, `=${c}2-${c}3`)); put(4, 'F', '=SUM(B4:E4)')
  put(5, 'A', 'Margin');       ['B','C','D','E'].forEach((c) => put(5, c, `=${c}4/${c}2`)); put(5, 'F', '=F4/F2')
  put(6, 'A', 'Units sold');   put(6, 'B', 1840); put(6, 'C', 2075); put(6, 'D', 2210); put(6, 'E', 2460); put(6, 'F', '=SUM(B6:E6)')
  put(7, 'A', 'Avg price');    ['B','C','D','E'].forEach((c) => put(7, c, `=${c}2/${c}6`)); put(7, 'F', '=F2/F6')

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

  // Per-cell format map, keyed "rowIndex:letter". 0-based rows: 1 Revenue,
  // 2 COGS, 3 Gross profit, 4 Margin, 5 Units, 6 Avg price.
  const VALUE_COLS = ['B', 'C', 'D', 'E', 'F']
  const ROW_FORMAT: Record<number, FmtKind> = { 1: 'currency', 2: 'currency', 3: 'currency', 4: 'percent', 5: 'thousands', 6: 'currency' }
  const seedFormats: Record<string, FmtKind> = {}
  for (const [r, kind] of Object.entries(ROW_FORMAT)) for (const c of VALUE_COLS) seedFormats[`${r}:${c}`] = kind
  let formats = $state<Record<string, FmtKind>>(seedFormats)

  let api = $state<SvGridApi<typeof features, Row> | null>(null)

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

  function applyFormat(kind: FmtKind) {
    if (!api) return
    const sel = api.getSelected()
    if (sel.length === 0) return
    const next = { ...formats }
    for (const [r0, c0, r1, c1] of sel) {
      const rMin = Math.min(r0, r1), rMax = Math.max(r0, r1)
      const cMin = Math.min(c0, c1), cMax = Math.max(c0, c1)
      for (let r = rMin; r <= rMax; r++)
        for (let c = Math.max(0, cMin); c <= cMax; c++) {
          const letter = letters[c]
          if (letter) next[`${r}:${letter}`] = kind
        }
    }
    formats = next
    raw = raw.slice() // repaint cell bodies
  }

  function display(kind: FmtKind | undefined, v: unknown): string {
    if (v == null || v === '') return ''
    const n = typeof v === 'number' ? v : Number(v)
    const num = Number.isFinite(n)
    switch (kind) {
      case 'currency': return num ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : String(v)
      case 'percent': return num ? n.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 }) : String(v)
      case 'number': return num ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v)
      case 'thousands': return num ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : String(v)
      case 'date': { const d = v instanceof Date ? v : new Date(String(v)); return isNaN(+d) ? String(v) : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }
      default: return num && Number.isInteger(n) ? String(n) : num ? String(Math.round(n * 100) / 100) : String(v)
    }
  }

  const columns: ColumnDef<typeof features, Row>[] = letters.map((letter) => ({
    field: letter,
    header: letter,
    width: letter === 'A' ? 140 : ['B', 'C', 'D', 'E', 'F'].includes(letter) ? 104 : 88,
    align: letter === 'A' ? 'left' : 'right',
    editorType: 'text',
    cellClass: (ctx: { row: { index: number } }) => (ctx.row.index === 0 ? 'sheet-head' : ''),
    cell: (ctx: { row: { index: number } }) =>
      renderSnippet(Cell, { rowIndex: ctx.row.index, letter, value: computed[ctx.row.index]?.[letter] }),
  }))

  let heights = $state<Record<number, number>>({})
  const rowHeight = (i: number) => heights[i] ?? 26
  const onRowResize = (i: number, h: number) => (heights = { ...heights, [i]: h })

  const BTNS: { kind: FmtKind; label: string }[] = [
    { kind: 'general', label: 'General' }, { kind: 'number', label: '1,234.56' }, { kind: 'currency', label: '$' },
    { kind: 'percent', label: '%' }, { kind: 'thousands', label: '1,234' }, { kind: 'date', label: 'Date' },
  ]
</script>

{#snippet Cell({ rowIndex, letter, value }: { rowIndex: number; letter: string; value: unknown })}
  <span class="cellv">{display(formats[`${rowIndex}:${letter}`], value)}</span>
{/snippet}

<section class="sheet-demo">
  <header class="bs-head">
    <h1 class="bs-title">Format Cells</h1>
    <p class="bs-sub">
      Drag a rectangle across cells, then click a format - <strong>$</strong>, <strong>%</strong>,
      <strong>1,234</strong> - and only the display changes; the value and every formula are
      untouched. The Margin row is a computed fraction shown as a percent; edit any Revenue or
      COGS cell and it re-derives.
    </p>
  </header>

  <div class="fmt-toolbar">
    <span class="fmt-label">Number format</span>
    {#each BTNS as b (b.kind)}
      <button type="button" class="fmt-btn" onclick={() => applyFormat(b.kind)}>{b.label}</button>
    {/each}
    <span class="fmt-hint">select a range, then pick a format</span>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="sheet" use:rowResize={{ onResize: onRowResize, min: 20, max: 320 }}>
    <SvGrid responsive={true}
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
      onApiReady={(a) => (api = a)}
      onCellValueChange={(e) => { if (e.columnId !== '__rownum__') commitCell(e.rowIndex, e.columnId, e.newValue) }}
    />
  </div>
</section>

<!-- Shared Excel chrome is `.sheet-demo` in src/index.css; only the
     format toolbar lives here. -->
<style>
  .fmt-toolbar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 6px 8px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 6px; background: var(--sg-header-bg, #f8fafc); flex-shrink: 0; }
  .fmt-label { font-size: 12px; font-weight: 700; color: var(--sg-muted, #64748b); }
  .fmt-btn { padding: 4px 10px; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 5px; background: var(--sg-bg, #fff); font-size: 12.5px; font-weight: 600; cursor: pointer; color: var(--sg-fg, #0f172a); font-variant-numeric: tabular-nums; }
  .fmt-btn:hover { background: var(--sg-row-hover-bg, #eef2f8); border-color: var(--sg-accent, #94a3b8); }
  .fmt-hint { font-size: 11.5px; color: var(--sg-muted, #94a3b8); margin-left: auto; font-style: italic; }
</style>
