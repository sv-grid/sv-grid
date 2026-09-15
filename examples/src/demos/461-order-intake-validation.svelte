<script lang="ts">
  /**
   * 461. Order intake: data validation
   * ----------------------------------
   * The order form a sales desk fills in all day, with Excel's Data
   * Validation keeping bad entries out at the keyboard:
   *
   *   Region, Product   lists. The arrow on the cell (or Alt+Down) drops
   *                     the choices; Product reads its list from the Lists
   *                     sheet, so adding a product there adds it here.
   *   Qty               a whole number from 1 to 500, Stop style: 900 is
   *                     refused with the message, Retry reopens the cell.
   *   Discount          a decimal up to 20%, Warning style: 35% asks
   *                     whether to keep it, Yes lets it through.
   *   Ship by           a date on or after the order date in column A: the
   *                     bound is =A2, a relative formula that moves with
   *                     the row, as it does in Excel.
   *   Unit price, Total formulas: the price is an XLOOKUP into the Lists
   *                     sheet, the total follows Qty, price and discount.
   *
   * Validation checks what is TYPED, as Excel's does: a paste lands as it
   * is. Data > Data Validation opens on the rule at the active cell, and
   * Clear All takes a rule off a selection.
   *
   * Try: type 900 into a Qty cell, then 0.35 into a Discount cell, then a
   * date before the order date into Ship by. Pick a product from the arrow
   * on a blank row and watch the price and total fill in.
   */
  import { SvSheet, createWorkbook, createSheetDocument, type CellFormatEntry } from '@svgrid/enterprise'

  const PRODUCTS: ReadonlyArray<readonly [string, number]> = [
    ['Standard seat', 49], ['Pro seat', 89], ['Enterprise seat', 149],
    ['Onboarding', 1200], ['Training day', 850], ['Premium support', 300],
  ]
  const REGIONS = ['North', 'South', 'East', 'West']

  const ORDERS: ReadonlyArray<readonly [string, string, string, number, number, string]> = [
    ['2026-09-01', 'North', 'Pro seat',        12, 0,    '2026-09-05'],
    ['2026-09-01', 'East',  'Onboarding',       1, 0,    '2026-09-15'],
    ['2026-09-02', 'South', 'Standard seat',   40, 0.1,  '2026-09-04'],
    ['2026-09-03', 'West',  'Enterprise seat',  8, 0.05, '2026-09-10'],
    ['2026-09-04', 'North', 'Premium support',  3, 0,    '2026-09-04'],
    ['2026-09-04', 'East',  'Training day',     2, 0,    '2026-09-22'],
    ['2026-09-05', 'South', 'Pro seat',        25, 0.15, '2026-09-09'],
    ['2026-09-08', 'West',  'Standard seat',   15, 0,    '2026-09-12'],
  ]
  const ROWS = 16                        // eight filled, eight open for entry
  const LAST = ROWS + 1

  const orders = [
    ['Order date', 'Region', 'Product', 'Qty', 'Unit price', 'Discount', 'Ship by', 'Total'],
    ...Array.from({ length: ROWS }, (_, i) => {
      const r = i + 2
      const o = ORDERS[i]
      const typed = o ? [o[0], o[1], o[2], String(o[3]), '', String(o[4]), o[5], ''] : ['', '', '', '', '', '', '', '']
      typed[4] = `=IF(C${r}="","",XLOOKUP(C${r},Lists!A2:A7,Lists!B2:B7))`
      typed[7] = `=IF(OR(C${r}="",D${r}=""),"",D${r}*E${r}*(1-F${r}))`
      return typed
    }),
    [],
    ['Orders', `=COUNTA(C2:C${LAST})`, '', `=SUM(D2:D${LAST})`, '', '', 'Total', `=SUM(H2:H${LAST})`],
  ]
  const lists = [
    ['Product', 'Unit price', '', 'Region'],
    ...PRODUCTS.map(([name, price], i) => [name, String(price), '', REGIONS[i] ?? '']),
  ]

  const wb = createWorkbook([
    { name: 'Orders', cells: orders },
    { name: 'Lists', cells: lists },
  ])

  // The rules live in the document, as they would in a saved workbook.
  const doc = createSheetDocument({ workbook: wb })
  const body = (col: number) => [[1, col, ROWS, col]] as const
  doc.get('Orders').validation = [
    { id: 'region', rects: body(1), allow: 'list', value1: '=Lists!$D$2:$D$5', ignoreBlank: true, inCellDropdown: true,
      alert: { style: 'stop', title: 'Region', message: 'Pick one of the four regions.' } },
    { id: 'product', rects: body(2), allow: 'list', value1: '=Lists!$A$2:$A$7', ignoreBlank: true, inCellDropdown: true,
      alert: { style: 'stop', title: 'Product', message: 'Pick a product from the price list on the Lists sheet.' } },
    { id: 'qty', rects: body(3), allow: 'whole', operator: 'between', value1: '1', value2: '500', ignoreBlank: true, inCellDropdown: false,
      alert: { style: 'stop', title: 'Quantity', message: 'A whole number from 1 to 500. Larger orders go through the sales desk.' } },
    { id: 'discount', rects: body(5), allow: 'decimal', operator: 'between', value1: '0', value2: '0.2', ignoreBlank: true, inCellDropdown: false,
      alert: { style: 'warning', title: 'Discount', message: 'Discounts above 20% need a manager\'s approval. Keep it anyway?' } },
    // A relative bound: =A2 on G2 reads A5 on G5, as Excel moves it.
    { id: 'ship', rects: body(6), allow: 'date', operator: 'greaterOrEqual', value1: '=A2', ignoreBlank: true, inCellDropdown: false,
      alert: { style: 'stop', title: 'Ship by', message: 'The ship-by date has to be on or after the order date in column A.' } },
  ]
  doc.get('Orders').freeze = { rows: 1, cols: 0 }

  const BAND = { bold: true, fill: '#e2e8f0', color: '#0f172a' } as const
  const MONEY = { numFmt: '$#,##0.00' } as const
  const PERCENT = { numFmt: '0%' } as const
  const TOTAL = { bold: true, fill: '#eef2ff', color: '#1e1b4b' } as const

  type Entry = Record<string, CellFormatEntry>
  const across = (sheet: string, cols: string, row: number, entry: CellFormatEntry): Entry =>
    Object.fromEntries([...cols].map((c) => [`${sheet}${c}${row}`, entry]))
  const down = (col: string, from: number, to: number, entry: CellFormatEntry): Entry =>
    Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [`${col}${from + i}`, entry]))

  const formats: Entry = {
    ...across('', 'ABCDEFGH', 1, BAND),
    ...down('E', 2, LAST, MONEY), ...down('F', 2, LAST, PERCENT), ...down('H', 2, LAST, MONEY),
    ...across('', 'ABCDEFGH', LAST + 2, TOTAL),
    [`H${LAST + 2}`]: { ...TOTAL, ...MONEY },
    ...across('Lists!', 'ABD', 1, BAND),
    ...down('Lists!B', 2, 7, MONEY),
  }
</script>

<section class="wrap flex flex-col flex-1 min-h-0">
  <SvSheet document={doc} height="100%" rows={22} columns={9} columnWidths={{ A: 110, C: 150, G: 110 }} {formats} />
  <p class="note shrink-0">
    Rows 10 to 17 are open. Pick a Region and a Product from the arrows, type
    a Qty, and the price and total fill in. Try <strong>900</strong> in Qty
    (a Stop), <strong>0.35</strong> in Discount (a Warning you can keep),
    or a Ship by date earlier than the order date. Data &gt; Data Validation
    shows the rule behind the active cell.
  </p>
</section>

<style>
  .wrap { gap: 8px; }
  .note { margin: 0; font-size: 13px; line-height: 1.6; color: var(--sg-muted, #64748b); }
</style>
