<script lang="ts">
  /**
   * 437. Workbook - several sheets that read each other
   * ----------------------------------------------------
   * Three sheets and one formula engine spanning them.
   *
   *   Prices    a lookup table
   *   Orders    =VLOOKUP into Prices, so editing a price moves every order
   *   Summary   =SUM over Orders, so it moves again
   *
   * Edit a price on the first tab and watch the change travel two sheets.
   * Nothing recomputes that did not need to: the dependency graph spans
   * sheets, so a change propagates exactly as far as it has to.
   *
   *   Tabs              click to switch, double-click or F2 to rename, drag
   *                     to reorder, + to add.
   *   Ctrl+PageDown/Up  next / previous sheet. No wrapping, as in Excel.
   *   Shift+F11         new sheet.
   *
   * A cell past the written area reads as BLANK, not #REF!, so =SUM(B1:B100)
   * over a short sheet is an ordinary thing to write.
   */
  import { SvGrid, tableFeatures, renderSnippet, type GridColumns } from '@svgrid/grid'
  import {
    enableSheet, setWorkbook,
    SvSheetTabs, SvFormulaBar,
    createWorkbook, formatCellValue,
    type SheetCellValue,
  } from '@svgrid/enterprise'

  enableSheet()

  const LETTERS = ['A', 'B', 'C', 'D'] as const

  const seed = () => [
    {
      name: 'Prices',
      cells: [
        ['SKU', 'Unit'],
        ['SKU-100', '10'],
        ['SKU-110', '25'],
        ['SKU-120', '40'],
      ],
    },
    {
      name: 'Orders',
      cells: [
        ['SKU', 'Qty', 'Unit', 'Total'],
        ['SKU-100', '3', "=VLOOKUP(A2,Prices!A2:B4,2)", '=B2*C2'],
        ['SKU-120', '2', "=VLOOKUP(A3,Prices!A2:B4,2)", '=B3*C3'],
        ['SKU-110', '5', "=VLOOKUP(A4,Prices!A2:B4,2)", '=B4*C4'],
      ],
    },
    {
      name: 'Summary',
      cells: [
        ['Metric', 'Value'],
        ['Orders', '=COUNT(Orders!B2:B4)'],
        ['Units', '=SUM(Orders!B2:B4)'],
        ['Revenue', '=SUM(Orders!D2:D4)'],
        ['Average', '=ROUND(B4/B3,2)'],
      ],
    },
  ]

  let version = $state(0)
  let active = $state({ rowIndex: 1, colIndex: 1 })

  const wb = createWorkbook(seed(), { onRecalc: () => (version += 1) })
  setWorkbook(wb, () => { version += 1; active = { rowIndex: 0, colIndex: 0 } })

  type SheetRow = { id: string; index: number }

  const rows = $derived.by<SheetRow[]>(() => {
    void version
    const n = Math.max(wb.rowCount(wb.active), 6)
    return Array.from({ length: n }, (_, i) => ({ id: `r${i}`, index: i }))
  })

  const colCount = $derived.by(() => {
    void version
    return Math.max(wb.colCount(wb.active), 4)
  })

  function shown(r: number, c: number): { text: string; error: boolean } {
    void version
    const value: SheetCellValue = wb.getValue(wb.active, r, c)
    const error = typeof value === 'object' && value !== null && 'error' in value
    return { text: formatCellValue(value), error }
  }

  const activeRaw = $derived.by(() => {
    void version
    return wb.getRaw(wb.active, active.rowIndex, active.colIndex)
  })

  function commit(text: string) {
    wb.setRaw(wb.active, active.rowIndex, active.colIndex, text)
    version += 1
  }

  const features = tableFeatures({})
  const columns = $derived<GridColumns<SheetRow>>(
    Array.from({ length: colCount }, (_, c) => ({
      id: LETTERS[c] ?? `col${c}`,
      header: LETTERS[c] ?? String(c),
      width: c === 0 ? 150 : 120,
      editable: false,
      cell: (cc: { row: { original: SheetRow } }) =>
        renderSnippet(Cell, { r: cc.row.original.index, c }),
    })),
  )
</script>

{#snippet Cell(props: { r: number; c: number })}
  {@const cell = shown(props.r, props.c)}
  {@const isActive = active.rowIndex === props.r && active.colIndex === props.c}
  {@const raw = wb.getRaw(wb.active, props.r, props.c)}
  <button
    type="button"
    class="cell"
    class:active={isActive}
    class:error={cell.error}
    class:formula={raw.startsWith('=')}
    title={raw}
    onclick={() => (active = { rowIndex: props.r, colIndex: props.c })}
  >{cell.text}</button>
{/snippet}

<section class="wrap">
  <SvFormulaBar
    active={active}
    value={activeRaw}
    onCommit={commit}
    onNavigate={(cell) => (active = cell)}
  />

  <SvGrid
    data={rows}
    {columns}
    {features}
    selectionMode="cell"
    enableCellSelection={true}
    filterMode="none"
    containerHeight={230}
  />

  <SvSheetTabs workbook={wb} onChange={() => (version += 1)} />

  <p class="note">
    Change a Unit price on <strong>Prices</strong>, then look at
    <strong>Orders</strong> and <strong>Summary</strong>: the VLOOKUP and both
    SUMs have already moved. Blue cells hold a formula; the bar shows the
    source behind whichever one is selected.
  </p>
</section>

<style>
  .wrap { display: flex; flex-direction: column; gap: 8px; }
  .cell {
    display: block; width: 100%; height: 100%; text-align: inherit;
    font: inherit; border: 0; background: transparent; color: inherit;
    padding: 0 2px; cursor: pointer;
  }
  .cell.formula { color: var(--sg-color-accent, #4f46e5); }
  .cell.error { color: var(--sg-color-danger, #dc2626); font-family: ui-monospace, Menlo, monospace; }
  .cell.active { box-shadow: inset 0 0 0 2px var(--sg-color-accent, #6366f1); border-radius: 2px; }
  .note { margin: 0; font-size: 13px; line-height: 1.6; color: var(--sg-color-muted, #64748b); }
</style>
