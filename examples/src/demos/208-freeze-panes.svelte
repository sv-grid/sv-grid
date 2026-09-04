<script lang="ts">
  /**
   * 208. Freeze panes
   * ------------------
   * A plain <SvGrid responsive={true}> as an Excel freeze-panes sheet. The row-number gutter is
   * sticky by construction; pinning the first two letter columns
   * (initialColumnPinning) keeps Account + Owner in view while you scroll across
   * a full year of months, and the sticky header keeps A..O in view while you
   * scroll down. HyperFormula keeps the row totals (O) and the Total row live.
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
    type HyperFormulaInstance,
    type HyperFormulaSheet,
  } from '@svgrid/grid'

  function colLetters(n: number): string[] {
    return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i))
  }
  const letters = colLetters(26) // A=Account, B=Owner, C..N=Jan..Dec, O=Total, P..Z empty
  const MIN_ROWS = 80
  const monthCols = letters.slice(2, 14) // C..N
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  type Row = Record<string, unknown>

  const ACCOUNTS = ['Salaries','Contractors','Cloud & hosting','SaaS tools','Office rent','Utilities','Travel','Marketing','Advertising','Events','Legal','Accounting','Insurance','Hardware','Software licenses','Recruiting','Training','Support','R&D','Misc']
  const OWNERS = ['People','Eng','Eng','Eng','Ops','Ops','Ops','Growth','Growth','Growth','Finance','Finance','Finance','Eng','Eng','People','People','Support','Eng','Ops']

  function seededAmount(a: number, m: number): number {
    const x = Math.sin((a + 1) * 12.9898 + (m + 1) * 78.233) * 43758.5453
    return Math.round(((800 + a * 140) * (0.6 + (x - Math.floor(x)) * 0.9)) / 10) * 10
  }

  const HEADER = 1
  const FIRST = 2
  const lastData = FIRST + ACCOUNTS.length - 1
  const totalRow = lastData + 1

  const empty = (): Row => Object.fromEntries(letters.map((c) => [c, ''])) as Row
  const seed: Row[] = Array.from({ length: Math.max(totalRow, MIN_ROWS) }, empty)
  const put = (row: number, col: string, v: unknown) => { seed[row - 1]![col] = v }

  put(HEADER, 'A', 'Account'); put(HEADER, 'B', 'Owner')
  MONTHS.forEach((mn, i) => put(HEADER, monthCols[i]!, mn))
  put(HEADER, 'O', 'Total')
  ACCOUNTS.forEach((name, a) => {
    const row = FIRST + a
    put(row, 'A', name); put(row, 'B', OWNERS[a]!)
    monthCols.forEach((c, m) => put(row, c, seededAmount(a, m)))
    put(row, 'O', `=SUM(${monthCols[0]}${row}:${monthCols[11]}${row})`)
  })
  put(totalRow, 'A', 'Total')
  ;[...monthCols, 'O'].forEach((c) => put(totalRow, c, `=SUM(${c}${FIRST}:${c}${lastData})`))

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

  function fmt(v: unknown): string {
    if (v == null || v === '') return ''
    if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { maximumFractionDigits: 2 })
    return String(v)
  }

  const columns: ColumnDef<typeof features, Row>[] = letters.map((letter) => ({
    field: letter,
    header: letter,
    width: letter === 'A' ? 150 : letter === 'B' ? 96 : 88,
    align: letter === 'A' || letter === 'B' ? 'left' : 'right',
    editorType: 'text',
    cellClass: (ctx: { row: { index: number } }) => {
      const rn = ctx.row.index + 1
      if (rn === HEADER) return 'sheet-head'
      if (rn === totalRow) return 'sheet-total'
      if (letter === 'B') return 'sheet-label' // A is the frozen header column (global style)
      return ''
    },
    cell: (ctx: { row: { index: number } }) => renderSnippet(Cell, { value: computed[ctx.row.index]?.[letter] }),
  }))

  let heights = $state<Record<number, number>>({})
  const rowHeight = (i: number) => heights[i] ?? 24
  const onRowResize = (i: number, h: number) => (heights = { ...heights, [i]: h })
</script>

{#snippet Cell({ value }: { value: unknown })}
  <span class="cellv">{fmt(value)}</span>
{/snippet}

<section class="sheet-demo">
  <header class="bs-head">
    <h1 class="bs-title">Freeze panes</h1>
    <p class="bs-sub">
      Scroll <strong>right</strong> across the twelve months - <em>Account</em> and
      <em>Owner</em> stay frozen (pinned columns) next to the sticky row-number gutter.
      Scroll <strong>down</strong> - the header stays frozen on top. Edit any month and the
      row total (O) and bottom Total row recompute.
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
      initialColumnPinning={{ left: ['A', 'B'] }}
      columnVirtualization={false}
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
     freeze-panes-specific tints live here. -->
<style>
  .sheet :global(.sv-grid-cell.sheet-total) { background: color-mix(in srgb, var(--sg-accent, #2563eb) 12%, var(--sg-bg, #fff) 88%) !important; font-weight: 700; }
  /* Opaque (mix of two solid colors, no `transparent`) - it's a pinned column,
     so a see-through background would let scrolled content bleed through. */
  .sheet :global(.sv-grid-cell.sheet-label) { text-align: left; font-weight: 600; background: color-mix(in srgb, var(--sg-header-bg, #f1f5f9) 65%, var(--sg-bg, #fff) 35%) !important; }
</style>
