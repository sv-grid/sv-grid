<script lang="ts">
  /**
   * 435. Formula bar, Name Box and per-cell number formats
   * ------------------------------------------------------
   * The Excel "cell" experience on a plain <SvGrid>: a formula bar showing the
   * RAW text behind the active cell, a Name Box that jumps to an address, and
   * number formats that live on the CELL rather than the column.
   *
   *   Formula bar   Click any cell. The grid shows the computed value; the bar
   *                 shows what was typed. Start a formula with = and function
   *                 names autocomplete (shortest match first), with a
   *                 signature hint while you fill in arguments.
   *   Name Box      Type C7 and press Enter to jump there. The dropdown holds
   *                 defined names; picking one selects what it refers to.
   *   Formats       Select cells and press Ctrl+Shift+4 for currency, 5 for
   *                 percent, 1 for a thousands number. Ctrl+B / I / U style
   *                 them. Only the DISPLAY changes; the stored value and every
   *                 formula reading it are untouched.
   *
   * The format store keys on row id, not row index, so sorting the grid does
   * not leave the formatting behind on whatever row took that position.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type GridColumns,
  } from '@svgrid/grid'
  import {
    enableSheet,
    SvFormulaBar,
    createFormatStore,
    createNames,
    setFormatTarget,
    compileNumberFormat,
    entryToStyle,
    parseFormula,
    evaluateFormula,
    formatCellValue,
    withCustomFunctions,
    type SheetCellValue,
  } from '@svgrid/enterprise'

  enableSheet()

  type Row = {
    id: string
    item: string
    units: string
    price: string
    revenue: string
    margin: string
  }

  const FIELDS = ['item', 'units', 'price', 'revenue', 'margin'] as const
  type Field = (typeof FIELDS)[number]

  const start = (): Row[] => [
    { id: 'r1', item: 'Widget',  units: '1200', price: '24.5',  revenue: '=B1*C1', margin: '=D1/2200' },
    { id: 'r2', item: 'Gadget',  units: '860',  price: '41',    revenue: '=B2*C2', margin: '=D2/2200' },
    { id: 'r3', item: 'Doohick', units: '2400', price: '8.75',  revenue: '=B3*C3', margin: '=D3/2200' },
    { id: 'r4', item: 'Gizmo',   units: '540',  price: '112.4', revenue: '=B4*C4', margin: '=D4/2200' },
    { id: 'r5', item: 'TOTAL',   units: '=SUM(B1:B4)', price: '', revenue: '=SUM(D1:D4)', margin: '' },
  ]

  let rows = $state<Row[]>(start())
  let active = $state<{ rowIndex: number; colIndex: number } | null>({ rowIndex: 0, colIndex: 3 })
  let formatVersion = $state(0)

  const store = createFormatStore()
  const names = createNames({ Target: '=$B$5' })

  // Seed a couple of formats so the demo opens looking like a real sheet.
  const lookup = {
    rowIdAt: (i: number) => rows[i]?.id ?? null,
    columnIdAt: (i: number) => FIELDS[i] ?? null,
  }
  store.set([[0, 2, 4, 3]], { numFmt: '$#,##0.00' }, lookup)
  store.set([[0, 4, 4, 4]], { numFmt: '0.0%' }, lookup)
  store.set([[4, 0, 4, 4]], { bold: true }, lookup)

  setFormatTarget({ store, lookup, onChange: () => (formatVersion += 1) })

  // ---- the engine -----------------------------------------------------
  const functions = withCustomFunctions(undefined)

  function raw(rowIndex: number, colIndex: number): string {
    const field = FIELDS[colIndex]
    return field ? (rows[rowIndex]?.[field] ?? '') : ''
  }

  const ctx = {
    resolve: (_sheet: string | null, r: number, c: number): SheetCellValue => {
      if (r < 0 || r >= rows.length || c < 0 || c >= FIELDS.length) return { error: '#REF!' }
      return compute(r, c)
    },
    lastRow: () => rows.length - 1,
    resolveName: (name: string): SheetCellValue | undefined => {
      const node = names.resolve(name)
      return node ? evaluateFormula(node, ctx) : undefined
    },
    functions,
  }

  function compute(r: number, c: number): SheetCellValue {
    const text = raw(r, c).trim()
    if (text === '') return ''
    if (!text.startsWith('=')) {
      const n = Number(text)
      return Number.isFinite(n) ? n : text
    }
    try {
      return evaluateFormula(parseFormula(text), ctx)
    } catch {
      return { error: '#PARSE!' }
    }
  }

  function display(r: number, c: number): { text: string; color?: string } {
    void formatVersion
    const value = compute(r, c)
    const rowId = rows[r]?.id
    const columnId = FIELDS[c]
    const entry = rowId && columnId ? store.get(rowId, columnId) : undefined
    if (typeof value === 'object' && value !== null && 'error' in value) {
      return { text: value.error, color: '#dc2626' }
    }
    if (!entry?.numFmt) return { text: formatCellValue(value) }
    return compileNumberFormat(entry.numFmt).format(value)
  }

  const activeRaw = $derived(active ? raw(active.rowIndex, active.colIndex) : '')

  function commit(text: string) {
    if (!active) return
    const field = FIELDS[active.colIndex]
    if (!field) return
    const next = rows.map((row, i) =>
      i === active!.rowIndex ? { ...row, [field]: text } : row,
    )
    rows = next
  }

  const features = tableFeatures({ rowSortingFeature })

  const columns = $derived<GridColumns<Row>>(
    FIELDS.map((field, c) => ({
      id: field,
      field,
      header: `${String.fromCharCode(65 + c)}  ${field}`,
      width: c === 0 ? 140 : 130,
      editable: false,
      cell: (cellCtx: { row: { index: number } }) =>
        renderSnippet(Cell, { r: cellCtx.row.index, c }),
    })),
  )
</script>

{#snippet Cell(props: { r: number; c: number })}
  {@const shown = display(props.r, props.c)}
  {@const rowId = rows[props.r]?.id}
  {@const columnId = FIELDS[props.c]}
  {@const entry = rowId && columnId ? store.get(rowId, columnId) : undefined}
  {@const isActive = active?.rowIndex === props.r && active?.colIndex === props.c}
  <button
    type="button"
    class="cell"
    class:active={isActive}
    style={`${entryToStyle(entry)};${shown.color ? `color:${shown.color}` : ''}`}
    onclick={() => (active = { rowIndex: props.r, colIndex: props.c })}
    title={raw(props.r, props.c)}
  >{shown.text}</button>
{/snippet}

<section class="wrap">
  <SvFormulaBar
    {active}
    value={activeRaw}
    onCommit={commit}
    onNavigate={(cell) => (active = cell)}
    names={names.list()}
    onSelectName={(name) => {
      const node = names.resolve(name)
      if (node && node.k === 'ref' && node.ref.row !== null) {
        active = { rowIndex: node.ref.row, colIndex: node.ref.col }
      }
    }}
  />

  <SvGrid
    data={rows}
    {columns}
    {features}
    selectionMode="cell"
    enableCellSelection={true}
    filterMode="none"
    statusBar={true}
    containerHeight={260}
  />

  <p class="note">
    Click a cell, then try <kbd>Ctrl+Shift+4</kbd> (currency),
    <kbd>Ctrl+Shift+5</kbd> (percent), <kbd>Ctrl+B</kbd>. Sort by clicking a
    header: the formatting follows its row rather than staying on the index.
    Column D holds <code>=B*C</code>; edit units or price in the bar and
    everything downstream recomputes.
  </p>
</section>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cell {
    display: block;
    width: 100%;
    height: 100%;
    text-align: inherit;
    font: inherit;
    border: 0;
    background: transparent;
    color: inherit;
    padding: 0 2px;
    cursor: pointer;
  }
  .cell.active {
    box-shadow: inset 0 0 0 2px var(--sg-color-accent, #6366f1);
    border-radius: 2px;
  }
  .note {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--sg-color-muted, #64748b);
  }
  kbd {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px;
    border: 1px solid var(--sg-color-border, #cbd5e1);
    border-radius: 3px;
    padding: 0 4px;
  }
  code {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 12px;
  }
</style>
