<script lang="ts">
  /**
   * 498. A tab that is a table, and rows that fold away
   * ---------------------------------------------------
   * Two things a business workbook wants that a sheet of cells is bad at.
   *
   * The Orders tab is BOUND: it holds records rather than cells, and it
   * renders as the data grid, with its own headers, sorting, filtering and
   * inline editing. Name it in `gridSheets` and that is the whole setup.
   *
   * The interesting part is what happens next. The records are projected
   * into the workbook's cells, header row and all, so the Summary tab
   * reads the bound tab with ordinary formulas:
   *
   *   =SUM(Orders!C2:C7)                    the totals down the column
   *   =SUMPRODUCT(Orders!C2:C7, Orders!D2:D7)
   *   =VLOOKUP("Gadget", Orders!B2:D7, 2, FALSE)
   *
   * Nothing in the formula engine, the dependency graph or the file
   * writers is told that Orders is a different kind of tab. That is what
   * makes a bound tab worth having rather than an embedded widget.
   *
   * The Summary tab also shows the second thing: Data > Group. The three
   * regional blocks are grouped under their subtotals, so each one folds
   * away behind the button on its total row, and the numbered buttons at
   * the corner of the bar show the whole sheet at one depth.
   *
   * Try: edit a Qty on Orders and watch every figure on Summary follow.
   * Sort Orders by Region. On Summary, click the minus beside a region to
   * fold it, then press 1 at the top of the bar to fold them all and 2 to
   * open them again. Save As: the groups ride into the .xlsx as Excel's
   * own outline levels, and the bound tab goes out as the cells it
   * projects.
   */
  import { SvSheet, createWorkbook, createSheetDocument } from '@svgrid/enterprise'
  import { groupLines, emptyOutline } from '@svgrid/enterprise/sheet'

  type Order = { region: string; item: string; qty: number; price: number }

  const orders: Order[] = [
    { region: 'North', item: 'Widget', qty: 12, price: 9.5 },
    { region: 'North', item: 'Gadget', qty: 4, price: 24 },
    { region: 'South', item: 'Widget', qty: 7, price: 9.5 },
    { region: 'South', item: 'Sprocket', qty: 18, price: 3.25 },
    { region: 'West', item: 'Gadget', qty: 9, price: 24 },
    { region: 'West', item: 'Sprocket', qty: 22, price: 3.25 },
  ]

  // The Summary tab is ordinary cells. Every formula on it reaches across
  // to Orders, which is bound; the engine cannot tell.
  const summary: string[][] = [
    ['Regional summary', '', ''],
    ['North', '=SUMPRODUCT((Orders!A2:A7="North")*Orders!C2:C7*Orders!D2:D7)', 'revenue'],
    ['North units', '=SUMIF(Orders!A2:A7, "North", Orders!C2:C7)', ''],
    ['North subtotal', '=B2', ''],
    ['South', '=SUMPRODUCT((Orders!A2:A7="South")*Orders!C2:C7*Orders!D2:D7)', 'revenue'],
    ['South units', '=SUMIF(Orders!A2:A7, "South", Orders!C2:C7)', ''],
    ['South subtotal', '=B5', ''],
    ['West', '=SUMPRODUCT((Orders!A2:A7="West")*Orders!C2:C7*Orders!D2:D7)', 'revenue'],
    ['West units', '=SUMIF(Orders!A2:A7, "West", Orders!C2:C7)', ''],
    ['West subtotal', '=B8', ''],
    ['', '', ''],
    ['All regions', '=B4+B7+B10', 'the three subtotals'],
    ['Units in total', '=SUM(Orders!C2:C7)', 'straight off the bound tab'],
    ['Gadget price', '=VLOOKUP("Gadget", Orders!B2:D7, 3, FALSE)', 'a lookup across'],
  ]

  const wb = createWorkbook([
    { name: 'Orders', cells: [] },
    { name: 'Summary', cells: summary },
  ])
  const doc = createSheetDocument({ workbook: wb })

  const state = doc.get('Summary')
  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }
  state.formats.set([[0, 0, 0, 2]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
  for (const r of [3, 6, 9]) state.formats.set([[r, 0, r, 1]], { bold: true }, at)
  state.formats.set([[11, 0, 13, 1]], { bold: true }, at)
  state.formats.set([[1, 1, 13, 1]], { numFmt: '#,##0.00' }, at)
  state.formats.set([[2, 1, 2, 1]], { numFmt: '#,##0' }, at)
  state.formats.set([[5, 1, 5, 1]], { numFmt: '#,##0' }, at)
  state.formats.set([[8, 1, 8, 1]], { numFmt: '#,##0' }, at)
  state.formats.set([[12, 1, 12, 1]], { numFmt: '#,##0' }, at)
  state.formats.set([[0, 2, 13, 2]], { color: '#64748b' }, at)
  state.widths.A = 180
  state.widths.B = 150
  state.widths.C = 220

  // The detail rows of each region, grouped under the subtotal that
  // follows them. The summary line is the one after the detail, which is
  // where Excel puts the collapse button.
  let rowOutline = emptyOutline()
  for (const [from, to] of [[1, 2], [4, 5], [7, 8]] as const) {
    rowOutline = groupLines(rowOutline, from, to)
  }
  state.outline = { rows: rowOutline, cols: emptyOutline() }
</script>

<SvSheet
  document={doc}
  height="100%"
  rows={18}
  columns={6}
  gridSheets={{
    Orders: {
      fields: [
        { field: 'region', label: 'Region', width: 120 },
        { field: 'item', label: 'Item', width: 140 },
        { field: 'qty', label: 'Qty', type: 'number', width: 90 },
        { field: 'price', label: 'Price', type: 'number', width: 110 },
      ],
      rows: orders,
      editable: true,
    },
  }}
/>
