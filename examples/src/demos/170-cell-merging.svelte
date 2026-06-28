<script lang="ts">
  /**
   * 170. Cell merging - invoice region on a real spreadsheet
   * ---------------------------------------------------------
   * Opens like Excel: row gutter 1..1000, column letters A..Z. The
   * first ~21 rows hold a full invoice (brand banner, bill-from /
   * bill-to blocks, meta block, line items, totals, notes box,
   * signature lines) assembled from `MergeSpec` + `CellBorderSpec`.
   * Below the invoice the sheet is empty - free typing space.
   *
   * Editable: line-item Qty / Rate (column C / D), addresses, meta
   * values, notes - free text. The invoice's amount, subtotal, tax
   * and total recompute on every commit.
   */
  import { tick } from 'svelte'
  import {
    SvGrid,
    tableFeatures,
    renderSnippet,
    spreadsheetLayout,
    type ColumnDef,
    type MergeSpec,
    type CellBorderSpec,
    type SvGridApi,
  } from '@svgrid/grid'

  let gridWrapper: HTMLDivElement | null = null
  function focusGrid() {
    const tableEl = gridWrapper?.querySelector<HTMLElement>('table.sv-grid-table')
    tableEl?.focus({ preventScroll: true })
  }
  function maybeRefocusGrid(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    if (!target) return
    if (target.closest('input, button, select, textarea, [tabindex]')) return
    tick().then(focusGrid)
  }

  const COL_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'] as const
  type ColKey = typeof COL_LETTERS[number]
  type Row = { rn: number; kind: Kind } & Record<ColKey, string | number>

  type Kind =
    | 'blank' | 'brand' | 'spacer' | 'addressLabel' | 'addressBody' | 'meta'
    | 'itemsHeader' | 'item' | 'subtotal' | 'tax' | 'grandTotal'
    | 'notesBanner' | 'notes' | 'signLabel' | 'signLine'

  const TOTAL_ROWS = 1000

  function emptyRow(rn: number): Row {
    const r: Record<string, unknown> = { rn, kind: 'blank' }
    for (const c of COL_LETTERS) r[c] = ''
    return r as Row
  }

  // Build the seed sheet with the invoice in rows 1..21 (0-indexed 0..20)
  function buildSeed(): Row[] {
    const out = Array.from({ length: TOTAL_ROWS }, (_, i) => emptyRow(i + 1))
    const set = (rowOneBased: number, kind: Kind, partial: Partial<Record<ColKey, string | number>>) => {
      const r = out[rowOneBased - 1]!
      r.kind = kind
      for (const [k, v] of Object.entries(partial)) (r as any)[k] = v
    }
    // Row 1 - brand band
    set(1, 'brand',        { A: 'NORTHWIND INDUSTRIES        INVOICE' })
    set(2, 'spacer',       {})
    set(3, 'addressLabel', { A: 'BILL FROM',  C: 'BILL TO' })
    set(4, 'addressBody',  {
      A: 'Northwind Industries Inc.\n1208 Market St, Suite 400\nChicago, IL 60607\nbilling@northwind.example',
      C: 'Acme Robotics LLC\n55 Innovation Way\nAustin, TX 78701\nap@acme.example',
    })
    set(5, 'spacer',       {})
    set(6, 'meta',         { C: 'Invoice #',  D: 'INV-2026-104' })
    set(7, 'meta',         { C: 'Issue date', D: '2026-06-22'   })
    set(8, 'meta',         { C: 'Due date',   D: '2026-07-22'   })
    set(9, 'itemsHeader',  { A: 'Description', B: 'Qty', C: 'Rate', D: 'Amount' })
    set(10,'item',         { A: 'Engineering hours - Backend',  B: 84, C: 175, D: 0 })
    set(11,'item',         { A: 'Engineering hours - Frontend', B: 62, C: 175, D: 0 })
    set(12,'item',         { A: 'Design hours - UI / UX',       B: 28, C: 160, D: 0 })
    set(13,'item',         { A: 'Project management',           B: 12, C: 150, D: 0 })
    set(14,'item',         { A: 'Cloud infrastructure (monthly)',B: 1, C: 980, D: 0 })
    set(15,'subtotal',     { A: 'Subtotal',    D: 0 })
    set(16,'tax',          { A: 'Tax (8.25%)', D: 0 })
    set(17,'grandTotal',   { A: 'TOTAL DUE',   D: 0 })
    set(18,'notesBanner',  { A: 'NOTES' })
    set(19,'notes',        { A: 'Wire transfer or ACH preferred. Bank details on request. Late payments accrue interest at 1.5% per month.' })
    set(20,'signLabel',    { A: 'Authorized signature', C: 'Customer signature' })
    set(21,'signLine',     {})
    return out
  }

  let rows = $state<Row[]>(buildSeed())

  const TAX_RATE = 0.0825
  function recompute() {
    let subtotal = 0
    for (const r of rows) {
      if (r.kind === 'item') {
        const qty = typeof r.B === 'number' ? r.B : Number(r.B) || 0
        const rate = typeof r.C === 'number' ? r.C : Number(r.C) || 0
        r.D = qty * rate
        subtotal += qty * rate
      }
    }
    for (const r of rows) {
      if (r.kind === 'subtotal')   r.D = subtotal
      if (r.kind === 'tax')        r.D = subtotal * TAX_RATE
      if (r.kind === 'grandTotal') r.D = subtotal * (1 + TAX_RATE)
    }
  }
  recompute()
  function onCellValueChange(e: { rowIndex: number; columnId: string; newValue: unknown }) {
    const col = e.columnId as ColKey
    const r = rows[e.rowIndex]!
    if ((col === 'B' || col === 'C') && r.kind === 'item' && typeof e.newValue === 'string') {
      const n = Number(e.newValue.trim())
      if (Number.isFinite(n)) (r as any)[col] = n
    }
    recompute()
    rows = [...rows]
  }

  const features = tableFeatures({})
  let api = $state<SvGridApi<typeof features, Row> | null>(null)

  function isInvoiceItem(rowIdx: number, col: ColKey): boolean {
    const r = rows[rowIdx]
    if (!r) return false
    if (r.kind === 'item' && (col === 'B' || col === 'C')) return true
    if (r.kind === 'addressBody' && (col === 'A' || col === 'C')) return true
    if (r.kind === 'meta' && col === 'D') return true
    if (r.kind === 'notes' && col === 'A') return true
    return false
  }

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'rn', header: '', width: 56, align: 'center', editable: false,
      cellClass: 'sv-row-gutter',
      cell: (ctx) => renderSnippet(RowNumCell, { row: ctx.row.original }) },
    { field: 'A', header: 'A', width: 280, align: 'left',
      editable: (ctx) => ctx.row.original.kind === 'blank'
                      || ctx.row.original.kind === 'addressBody'
                      || ctx.row.original.kind === 'item'
                      || ctx.row.original.kind === 'notes',
      editorType: 'text',
      cell: (ctx) => renderSnippet(ACell, { row: ctx.row.original, rowIdx: ctx.row.index }) },
    { field: 'B', header: 'B', width: 90, align: 'right',
      editable: (ctx) => ctx.row.original.kind === 'blank' || ctx.row.original.kind === 'item',
      editorType: 'number',
      cell: (ctx) => renderSnippet(SimpleCell, { row: ctx.row.original, value: ctx.row.original.B }) },
    { field: 'C', header: 'C', width: 160, align: 'right',
      editable: (ctx) => ctx.row.original.kind === 'blank'
                      || ctx.row.original.kind === 'item'
                      || ctx.row.original.kind === 'addressBody'
                      || ctx.row.original.kind === 'meta',
      editorType: 'text',
      cell: (ctx) => renderSnippet(CCell, { row: ctx.row.original }) },
    { field: 'D', header: 'D', width: 170, align: 'right',
      editable: (ctx) => ctx.row.original.kind === 'blank' || ctx.row.original.kind === 'meta',
      editorType: 'text',
      cell: (ctx) => renderSnippet(DCell, { row: ctx.row.original }) },
    ...COL_LETTERS.filter((c) => c !== 'A' && c !== 'B' && c !== 'C' && c !== 'D').map((c) => ({
      field: c,
      header: c,
      width: 90,
      align: 'left' as const,
      editorType: 'text' as const,
    })),
  ]
  const columnOrder = columns.map((c) => c.field as string)

  // --- Merges (only for the invoice region, rows 0..20) -------------
  const merges: MergeSpec[] = [
    // Brand band: A..F
    { rowIndex: 0,  columnId: 'A', colspan: 6 },
    { rowIndex: 1,  columnId: 'A', colspan: 6 },
    { rowIndex: 4,  columnId: 'A', colspan: 6 },
    // Address labels: A+B / C+D+E+F
    { rowIndex: 2,  columnId: 'A', colspan: 2 },
    { rowIndex: 2,  columnId: 'C', colspan: 4 },
    // Address bodies
    { rowIndex: 3,  columnId: 'A', colspan: 2 },
    { rowIndex: 3,  columnId: 'C', colspan: 4 },
    // Meta value cell: D + E + F
    { rowIndex: 5,  columnId: 'D', colspan: 3 },
    { rowIndex: 6,  columnId: 'D', colspan: 3 },
    { rowIndex: 7,  columnId: 'D', colspan: 3 },
    // Item rows: amount D + E + F
    ...[9, 10, 11, 12, 13].map((r) => ({ rowIndex: r, columnId: 'D', colspan: 3 } as MergeSpec)),
    // Totals: label spans A..C, amount D + E + F
    { rowIndex: 14, columnId: 'A', colspan: 3 }, { rowIndex: 14, columnId: 'D', colspan: 3 },
    { rowIndex: 15, columnId: 'A', colspan: 3 }, { rowIndex: 15, columnId: 'D', colspan: 3 },
    { rowIndex: 16, columnId: 'A', colspan: 3 }, { rowIndex: 16, columnId: 'D', colspan: 3 },
    // Notes banner + body: A..F
    { rowIndex: 17, columnId: 'A', colspan: 6 },
    { rowIndex: 18, columnId: 'A', colspan: 6 },
    // Signatures: A+B+C / D+E+F
    { rowIndex: 19, columnId: 'A', colspan: 3 }, { rowIndex: 19, columnId: 'D', colspan: 3 },
    { rowIndex: 20, columnId: 'A', colspan: 3 }, { rowIndex: 20, columnId: 'D', colspan: 3 },
  ]

  // --- Borders ------------------------------------------------------
  const accent = '#0f172a'
  const muted = '#cbd5e1'
  const brand = '#2563eb'
  const borders: CellBorderSpec[] = [
    // Brand band heavy bottom
    { rowIndex: 0, columnId: 'A', bottom: { width: 3, color: brand } },
    // Address labels: bottom underline
    { rowIndex: 2, columnId: 'A', bottom: { width: 1, color: muted } },
    { rowIndex: 2, columnId: 'C', bottom: { width: 1, color: muted } },
    // Address body boxes: 4-edge thin frame
    { rowIndex: 3, columnId: 'A',
      top: { width: 1, color: muted }, bottom: { width: 1, color: muted },
      left: { width: 1, color: muted }, right: { width: 1, color: muted } },
    { rowIndex: 3, columnId: 'C',
      top: { width: 1, color: muted }, bottom: { width: 1, color: muted },
      left: { width: 1, color: muted }, right: { width: 1, color: muted } },
    // Meta rows: bottom border on C + D
    ...[5, 6, 7].flatMap((r) => ([
      { rowIndex: r, columnId: 'C', bottom: { width: 1, color: muted } } as CellBorderSpec,
      { rowIndex: r, columnId: 'D', bottom: { width: 1, color: muted } } as CellBorderSpec,
    ])),
    // Items header: top + bottom
    ...['A','B','C','D'].map((col) => ({
      rowIndex: 8, columnId: col,
      top:    { width: 2, color: accent } as const,
      bottom: { width: 2, color: accent } as const,
    } as CellBorderSpec)),
    // Subtotal + tax bottom hairlines on D
    { rowIndex: 14, columnId: 'D', top: { width: 1, color: accent }, bottom: { width: 1, color: muted } },
    { rowIndex: 15, columnId: 'D', bottom: { width: 1, color: muted } },
    // Grand total Excel-style
    { rowIndex: 16, columnId: 'D',
      top: { width: 2, color: accent },
      bottom: { width: 3, style: 'double', color: accent } },
    // Notes box outline
    { rowIndex: 17, columnId: 'A',
      top: { width: 1, color: muted }, left: { width: 1, color: muted }, right: { width: 1, color: muted } },
    { rowIndex: 18, columnId: 'A',
      bottom: { width: 1, color: muted }, left: { width: 1, color: muted }, right: { width: 1, color: muted } },
    // Signature top lines
    { rowIndex: 20, columnId: 'A', top: { width: 1, color: accent } },
    { rowIndex: 20, columnId: 'D', top: { width: 1, color: accent } },
  ]
</script>

{#snippet RowNumCell({ row }: { row: Row })}
  <span class="row-num">{row.rn}</span>
{/snippet}

{#snippet ACell({ row, rowIdx }: { row: Row; rowIdx: number })}
  <span
    class="inv-desc"
    class:is-brand={row.kind === 'brand'}
    class:is-addressLabel={row.kind === 'addressLabel'}
    class:is-addressBody={row.kind === 'addressBody'}
    class:is-itemsHeader={row.kind === 'itemsHeader'}
    class:is-subtotal={row.kind === 'subtotal'}
    class:is-tax={row.kind === 'tax'}
    class:is-grand={row.kind === 'grandTotal'}
    class:is-notesBanner={row.kind === 'notesBanner'}
    class:is-notes={row.kind === 'notes'}
    class:is-signLabel={row.kind === 'signLabel'}
  >{row.A}</span>
{/snippet}

{#snippet SimpleCell({ row, value }: { row: Row; value: number | string })}
  <span class:cell-itemsHeader={row.kind === 'itemsHeader'}>{value === '' ? '' : value}</span>
{/snippet}

{#snippet CCell({ row }: { row: Row })}
  {#if row.kind === 'item' && typeof row.C === 'number'}
    <span>{Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(row.C)}</span>
  {:else if row.kind === 'addressLabel'}
    <span class="inv-addr-label">{row.C}</span>
  {:else if row.kind === 'addressBody'}
    <span class="inv-addr-body">{row.C}</span>
  {:else if row.kind === 'meta'}
    <span class="inv-meta-label">{row.C}</span>
  {:else if row.kind === 'itemsHeader'}
    <span class="cell-itemsHeader">{row.C}</span>
  {:else if row.kind === 'signLabel'}
    <span class="inv-sign-label">{row.C}</span>
  {:else}
    <span>{row.C === '' ? '' : row.C}</span>
  {/if}
{/snippet}

{#snippet DCell({ row }: { row: Row })}
  {#if row.kind === 'meta'}
    <span class="inv-meta-value">{row.D}</span>
  {:else if row.kind === 'itemsHeader'}
    <span class="cell-itemsHeader">{row.D}</span>
  {:else if typeof row.D === 'number' && row.D !== 0 && (row.kind === 'item' || row.kind === 'subtotal' || row.kind === 'tax' || row.kind === 'grandTotal')}
    <span
      class:inv-amount-total={row.kind === 'subtotal' || row.kind === 'tax'}
      class:inv-amount-grand={row.kind === 'grandTotal'}
    >{Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(row.D)}</span>
  {:else}
    <span>{row.D === '' ? '' : row.D}</span>
  {/if}
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3 no-zebra">
  <header>
    <h2 class="text-base font-semibold">Cell merging on a real spreadsheet</h2>
    <p class="text-xs mt-1" style="color: var(--sg-muted);">
      Spreadsheet shell: row numbers 1..{TOTAL_ROWS}, columns A..Z. Rows 1..21 hold a full
      invoice built from <code>MergeSpec</code> + <code>CellBorderSpec</code> (brand band,
      bill-from / bill-to blocks, meta block, line items, totals, notes, signatures). Edit any
      <em>Qty</em> or <em>Rate</em> in the line items, or any address / meta value - amounts,
      subtotal, tax and TOTAL DUE recompute live. Type anywhere below row 21 - blank cells
      behave like an empty sheet.
    </p>
  </header>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="inv-wrap"
    bind:this={gridWrapper}
    onclick={maybeRefocusGrid}
    use:spreadsheetLayout={{ merges, borders, columnOrder }}
  >
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      sortable={false}
      filterable={false}
      selectionMode="cell"
      showColumnFilters={false}
      showPagination={false}
      showRowSelection={false}
      enableInlineEditing={true}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={28}
      containerHeight="100%"
      fitColumns={false}
      virtualization={true}
      columnVirtualization={true}
      onApiReady={(next) => { api = next; tick().then(focusGrid) }}
      onCellValueChange={onCellValueChange}
    />
  </div>
</section>

<style>
  .inv-wrap {
    flex: 1;
    min-height: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    overflow: hidden;
    background: var(--sg-bg, #ffffff);
  }

  /* Row-number gutter: cell stays interactive so :hover fires, but
     every visual side-effect of selecting it is suppressed. */
  :global(.sv-grid-cell.sv-row-gutter) {
    cursor: default;
  }
  :global(.sv-grid-cell.sv-row-gutter.sv-grid-cell-active),
  :global(.sv-grid-cell.sv-row-gutter[data-selected-range="true"]) {
    box-shadow: none !important;
  }
  :global(.sv-grid-cell.sv-row-gutter .sv-grid-fill-handle) {
    display: none !important;
  }
  /* Spreadsheet UX: no zebra, no row hover - only the row + column
     headers tint on hover. */
  :global(.no-zebra .sv-grid-table tbody tr:nth-child(even) .sv-grid-cell),
  :global(.no-zebra .sv-grid-table tbody tr:nth-child(odd)  .sv-grid-cell),
  :global(.no-zebra .sv-grid-table tbody tr:hover .sv-grid-cell) {
    background: transparent !important;
  }
  :global(.no-zebra .sv-grid-table tbody tr .sv-grid-cell.sv-row-gutter) {
    background: var(--sg-header-bg, #f1f5f9) !important;
  }
  :global(.no-zebra .sv-grid-table tbody tr .sv-grid-cell.sv-row-gutter:hover) {
    background: var(--sg-row-hover-bg, #e2e8f0) !important;
  }
  :global(.no-zebra .sv-grid-column:hover) {
    background: var(--sg-row-hover-bg, #e2e8f0) !important;
  }
  :global(.row-num) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 11px;
    font-weight: 600;
    color: var(--sg-muted, #64748b);
  }
  /* Hide the column-menu hamburger + sort + filter triggers on the
     row-header column header. */
  :global([data-svgrid-header-col="rn"] .sv-grid-col-menu-btn),
  :global([data-svgrid-header-col="rn"] .sv-grid-col-filter-btn),
  :global([data-svgrid-header-col="rn"] .sv-grid-header-sort) {
    display: none !important;
  }
  :global(.inv-desc) {
    color: var(--sg-fg, #0f172a);
    font-size: 13px;
    white-space: pre-line;
    line-height: 1.45;
    display: inline-block;
    width: 100%;
  }
  :global(.inv-desc.is-brand) {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #2563eb;
    padding: 4px 12px;
  }
  :global(.inv-desc.is-addressLabel),
  :global(.inv-addr-label) {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--sg-muted, #64748b);
  }
  :global(.inv-desc.is-addressBody),
  :global(.inv-addr-body) {
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--sg-fg, #0f172a);
    white-space: pre-line;
    padding: 4px 8px;
    display: inline-block;
    width: 100%;
  }
  :global(.inv-desc.is-itemsHeader),
  :global(.cell-itemsHeader) {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--sg-fg, #0f172a);
  }
  :global(.inv-meta-label) {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sg-muted, #64748b);
  }
  :global(.inv-meta-value) {
    font-size: 12px;
    font-weight: 600;
    color: var(--sg-fg, #0f172a);
  }
  :global(.inv-desc.is-subtotal),
  :global(.inv-desc.is-tax) {
    text-align: right;
    width: 100%;
    display: inline-block;
    font-weight: 600;
    color: var(--sg-fg, #0f172a);
  }
  :global(.inv-desc.is-grand) {
    text-align: right;
    width: 100%;
    display: inline-block;
    font-weight: 800;
    font-size: 14px;
    color: #0f172a;
  }
  :global(.inv-amount-total) { font-weight: 700; }
  :global(.inv-amount-grand) { font-weight: 800; font-size: 14px; color: #0f172a; }
  :global(.inv-desc.is-notesBanner) {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #2563eb;
    background: #eff6ff;
    padding: 4px 10px;
    display: inline-block;
    width: 100%;
  }
  :global(.inv-desc.is-notes) {
    font-size: 12px;
    color: var(--sg-muted, #475569);
    padding: 4px 10px;
    line-height: 1.5;
  }
  :global(.inv-desc.is-signLabel),
  :global(.inv-sign-label) {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--sg-muted, #64748b);
  }
</style>
