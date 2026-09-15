<script lang="ts">
  /**
   * 456. Sales report workbook
   * ---------------------------
   * The document a sales manager keeps open all quarter, on the shell:
   *
   *   Orders     24 orders. The unit price is an XLOOKUP into Products, the
   *              discount an IF on the quantity, the net a formula on both.
   *   Products   the price list the lookup reads.
   *   Summary    every figure is live: COUNTIF / SUMIF by region, share of a
   *              named total, RANK, per-rep attainment against target and
   *              an IFS that turns it into a status, INDEX / MATCH for the
   *              best region, and a sentence built with &.
   *
   * Nothing on Summary is typed in. Change a quantity on Orders, or a price
   * on Products, and the whole page follows: the dependency graph spans the
   * three sheets and recomputes only what the edit reached.
   *
   *   Name Box   NetSales and TotalRevenue are defined names. The formulas
   *              use them by name, and the Name Box lists them: pick one to
   *              jump to it.
   *   Formats    the header bands, currency, percent and the title size
   *              travel with the workbook through the `formats` prop, so the
   *              document opens looking the way it was saved.
   *
   * Try: set the quantity of the Pro seat order on row 2 to 30, then open
   * Summary. North moved, the ranks re-sorted, Ana went from Close to On
   * track, and the discount count went up by one.
   */
  import { SvSheet, createWorkbook, type CellFormatEntry } from '@svgrid/enterprise'

  // ---- the data, as a manager would have typed it -------------------------
  const ORDERS: ReadonlyArray<readonly [string, string, string, string, number]> = [
    ['2026-07-01', 'North', 'Ana',   'Pro seat',        12],
    ['2026-07-02', 'South', 'Ben',   'Standard seat',    6],
    ['2026-07-03', 'East',  'Chloe', 'Onboarding',       1],
    ['2026-07-06', 'West',  'Dev',   'Enterprise seat',  8],
    ['2026-07-08', 'North', 'Ana',   'Premium support',  3],
    ['2026-07-10', 'East',  'Chloe', 'Pro seat',        15],
    ['2026-07-14', 'South', 'Ben',   'Training day',     2],
    ['2026-07-17', 'West',  'Dev',   'Standard seat',   20],
    ['2026-07-21', 'North', 'Ana',   'Enterprise seat',  4],
    ['2026-07-24', 'East',  'Chloe', 'Premium support',  6],
    ['2026-07-28', 'South', 'Ben',   'Pro seat',         9],
    ['2026-08-03', 'West',  'Dev',   'Onboarding',       1],
    ['2026-08-05', 'North', 'Ana',   'Standard seat',   30],
    ['2026-08-07', 'East',  'Chloe', 'Enterprise seat', 10],
    ['2026-08-11', 'South', 'Ben',   'Premium support',  2],
    ['2026-08-13', 'West',  'Dev',   'Pro seat',        11],
    ['2026-08-18', 'North', 'Ana',   'Training day',     3],
    ['2026-08-21', 'East',  'Chloe', 'Standard seat',   14],
    ['2026-08-25', 'South', 'Ben',   'Enterprise seat',  5],
    ['2026-08-28', 'West',  'Dev',   'Premium support',  4],
    ['2026-09-01', 'North', 'Ana',   'Pro seat',        18],
    ['2026-09-04', 'East',  'Chloe', 'Onboarding',       2],
    ['2026-09-08', 'South', 'Ben',   'Standard seat',   10],
    ['2026-09-11', 'West',  'Dev',   'Enterprise seat', 12],
  ]
  const LAST = ORDERS.length + 1            // the last order sits on row 25
  const TOTAL_ROW = LAST + 2                // one blank row, then the totals

  const REGIONS = ['North', 'South', 'East', 'West'] as const
  const REPS: ReadonlyArray<readonly [string, number]> = [
    ['Ana', 8000], ['Ben', 6000], ['Chloe', 8500], ['Dev', 7000],
  ]

  // Rows are 1-based in the formulas and 0-based in the arrays, as they are
  // in any sheet built from code; the `r` here is the 1-based one.
  const orders = [
    ['Date', 'Region', 'Rep', 'Product', 'Qty', 'Unit price', 'Amount', 'Discount', 'Net'],
    ...ORDERS.map(([date, region, rep, product, qty], i) => {
      const r = i + 2
      return [
        date, region, rep, product, String(qty),
        `=XLOOKUP(D${r},Products!A2:A7,Products!C2:C7)`,
        `=E${r}*F${r}`,
        `=IF(E${r}>=10,5%,0)`,
        `=G${r}*(1-H${r})`,
      ]
    }),
    [],
    ['Total', '', '', '', `=SUM(E2:E${LAST})`, '', `=SUM(G2:G${LAST})`, '', `=SUM(I2:I${LAST})`],
  ]

  const products = [
    ['Product', 'Category', 'Unit price'],
    ['Standard seat',   'Licences', '49'],
    ['Pro seat',        'Licences', '89'],
    ['Enterprise seat', 'Licences', '149'],
    ['Onboarding',      'Services', '1200'],
    ['Training day',    'Services', '850'],
    ['Premium support', 'Support',  '300'],
  ]

  const summary = [
    ['Q3 2026 sales summary'],
    ['Every figure on this sheet is a formula over Orders. Edit an order and it follows.'],
    [],
    ['Region', 'Orders', 'Revenue', 'Avg order', 'Share', 'Rank'],
    ...REGIONS.map((region, i) => {
      const r = i + 5
      return [
        region,
        `=COUNTIF(Orders!B2:B${LAST},A${r})`,
        `=SUMIF(Orders!B2:B${LAST},A${r},NetSales)`,
        `=C${r}/B${r}`,
        `=C${r}/TotalRevenue`,
        `=RANK(C${r},C5:C8)`,
      ]
    }),
    ['Total', '=SUM(B5:B8)', '=SUM(NetSales)', '=C9/B9', '=SUM(E5:E8)'],
    [],
    ['Rep', 'Revenue', 'Target', 'Attainment', 'Status'],
    ...REPS.map(([rep, target], i) => {
      const r = i + 12
      return [
        rep,
        `=SUMIF(Orders!C2:C${LAST},A${r},NetSales)`,
        String(target),
        `=B${r}/C${r}`,
        `=IFS(D${r}>=1,"On track",D${r}>=0.9,"Close",TRUE,"Behind")`,
      ]
    }),
    ['Total', '=SUM(B12:B15)', '=SUM(C12:C15)', '=B16/C16', '=IFS(D16>=1,"On track",D16>=0.9,"Close",TRUE,"Behind")'],
    [],
    ['Best region', '=INDEX(A5:A8,MATCH(1,F5:F8,0))'],
    ['Largest order', '=MAX(NetSales)'],
    ['Discounted orders', `=COUNTIF(Orders!H2:H${LAST},">0")&" of "&COUNTA(Orders!A2:A${LAST})`],
  ]

  const wb = createWorkbook([
    { name: 'Summary', cells: summary },
    { name: 'Orders', cells: orders },
    { name: 'Products', cells: products },
  ])
  // Absolute, the way Excel writes them: a name that moved with the cursor
  // would be a relative reference with a friendlier spelling, not a name.
  wb.names.define('NetSales', `=Orders!$I$2:$I$${LAST}`)
  wb.names.define('TotalRevenue', '=Summary!$C$9')

  // ---- formats: what makes it read as a document rather than a grid -------
  // Fills are literal colours, as they are in Excel, so each carries its own
  // text colour and stays readable on a dark theme.
  const BAND = { bold: true, fill: '#e2e8f0', color: '#0f172a' } as const
  const TOTAL = { bold: true, fill: '#eef2ff', color: '#1e1b4b' } as const
  const MONEY = { numFmt: '$#,##0.00' } as const
  const WHOLE = { numFmt: '$#,##0' } as const
  const PERCENT = { numFmt: '0.0%' } as const

  // Keys are addresses. A bare one formats the sheet active at mount, which
  // is Summary; `Orders!F2` reaches another sheet the way a formula would.
  type Entry = Record<string, CellFormatEntry>
  const across = (sheet: string, cols: string, row: number, entry: CellFormatEntry): Entry =>
    Object.fromEntries([...cols].map((c) => [`${sheet}${c}${row}`, entry]))
  const down = (sheet: string, col: string, from: number, to: number, entry: CellFormatEntry): Entry =>
    Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [`${sheet}${col}${from + i}`, entry]))

  const summaryFormats = {
    // title, note, two banded tables, two total rows, the facts
    A1: { bold: true, fontSize: 17 },
    A2: { italic: true, color: '#64748b' },
    ...across('', 'ABCDEF', 4, BAND),
    ...down('', 'C', 5, 9, WHOLE), ...down('', 'D', 5, 9, WHOLE), ...down('', 'E', 5, 9, PERCENT),
    ...across('', 'ABCDEF', 9, TOTAL),
    C9: { ...TOTAL, ...WHOLE }, D9: { ...TOTAL, ...WHOLE }, E9: { ...TOTAL, ...PERCENT },
    ...across('', 'ABCDE', 11, BAND),
    ...down('', 'B', 12, 16, WHOLE), ...down('', 'C', 12, 16, WHOLE), ...down('', 'D', 12, 16, PERCENT),
    ...across('', 'ABCDE', 16, TOTAL),
    B16: { ...TOTAL, ...WHOLE }, C16: { ...TOTAL, ...WHOLE }, D16: { ...TOTAL, ...PERCENT },
    A18: { bold: true }, A19: { bold: true }, A20: { bold: true },
    B19: MONEY,
  }

  const O = 'Orders!'
  const orderFormats = {
    ...across(O, 'ABCDEFGHI', 1, BAND),
    ...down(O, 'F', 2, LAST, MONEY), ...down(O, 'G', 2, LAST, MONEY),
    ...down(O, 'H', 2, LAST, { numFmt: '0%' }), ...down(O, 'I', 2, LAST, MONEY),
    ...across(O, 'ABCDEFGHI', TOTAL_ROW, TOTAL),
    [`${O}G${TOTAL_ROW}`]: { ...TOTAL, ...MONEY }, [`${O}I${TOTAL_ROW}`]: { ...TOTAL, ...MONEY },
  }
  const productFormats = {
    ...across('Products!', 'ABC', 1, BAND),
    ...down('Products!', 'C', 2, 7, MONEY),
  }
</script>

<section class="wrap flex flex-col flex-1 min-h-0">
  <SvSheet
    workbook={wb}
    height="100%"
    rows={30}
    columns={10}
    columnWidths={{ A: 170, D: 140 }}
    formats={{ ...summaryFormats, ...orderFormats, ...productFormats }}
  />
  <p class="note shrink-0">
    Start on <strong>Summary</strong>, then change a quantity on
    <strong>Orders</strong> or a price on <strong>Products</strong> and come
    back: the ranks, shares and statuses have already moved. Open the Name
    Box to jump to <code>NetSales</code> or <code>TotalRevenue</code>; press
    Ctrl+` to see the formulas behind every cell.
  </p>
</section>

<style>
  .wrap { gap: 8px; }
  .note { margin: 0; font-size: 13px; line-height: 1.6; color: var(--sg-muted, #64748b); }
  .note code {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 12px;
    padding: 1px 4px;
    border-radius: 4px;
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--sg-fg, #0f172a);
  }
</style>
