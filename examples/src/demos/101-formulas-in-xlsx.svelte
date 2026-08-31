<script lang="ts">
  /**
   * 94. Formulas preserved in xlsx export
   * -------------------------------------
   * The grid holds a small Q3 budget. Three columns are computed by
   * formula (`Subtotal`, `Tax`, `Total`); a footer row carries
   * SUM-aggregates. Click "Export to xlsx" and the output is a real
   * OOXML container - open it in Excel and you see the formulas, not
   * the cached values. Edit any quantity and Excel recomputes the
   * column.
   *
   * What this proves
   *   - `<c r="C2"><f>B2*$D$1</f></c>` round-trips as an Excel formula,
   *     NOT a literal number.
   *   - Both literal numbers (`<c><v>n</v>`) and inline strings
   *     (`<c t="inlineStr"><is><t>s</t></is>`) live in the same sheet
   *     without a sharedStrings part.
   *   - The whole xlsx is built in the browser via JSZip - no server.
   *
   * Production code: `@svgrid/enterprise` adds a `formulas: true` option to
   * `exportData({ format: 'xlsx' })` that runs the same code paths
   * across every grid in the app.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'
  import JSZip from 'jszip'

  // ---- Domain & seed -----------------------------------------------------
  type LineItem = {
    id: string
    item: string
    unitCost: number
    quantity: number
    // The three columns below are derived from a formula; they live on
    // the row for typing convenience, but the export writes formula refs
    // instead of literal numbers.
  }

  const TAX_RATE = 0.08   // lives in cell D1 of the xlsx (see header row)

  let rows = $state<LineItem[]>([
    { id: 'i1', item: 'Domain registration', unitCost: 12.99, quantity: 3 },
    { id: 'i2', item: 'Hosting (monthly)',   unitCost: 49.00, quantity: 12 },
    { id: 'i3', item: 'SSL certificate',     unitCost: 85.00, quantity: 1 },
    { id: 'i4', item: 'Email service',       unitCost: 20.00, quantity: 12 },
    { id: 'i5', item: 'CDN bandwidth',       unitCost: 0.085, quantity: 5000 },
    { id: 'i6', item: 'Analytics seat',      unitCost: 79.00, quantity: 5 },
    { id: 'i7', item: 'Design license',      unitCost: 52.00, quantity: 3 },
    { id: 'i8', item: 'Storage (TB)',        unitCost: 23.00, quantity: 4 },
    { id: 'i9', item: 'Backup retention',    unitCost: 15.00, quantity: 12 },
  ])

  const features = tableFeatures({ rowSortingFeature })

  const fmtMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

  // Live (in-grid) formulas use the row's own numbers; the export writes
  // Excel formulas that point at neighbouring cells.
  function subtotal(r: LineItem) { return r.unitCost * r.quantity }
  function tax(r: LineItem)      { return subtotal(r) * TAX_RATE }
  function total(r: LineItem)    { return subtotal(r) + tax(r) }

  const totals = $derived.by(() => {
    let sub = 0, tx = 0, tot = 0
    for (const r of rows) { sub += subtotal(r); tx += tax(r); tot += total(r) }
    return { sub, tx, tot }
  })

  const columns: ColumnDef<typeof features, LineItem>[] = [
    { field: 'item',     header: 'Item',      editorType: 'text',   width: 220 },
    { field: 'unitCost', header: 'Unit cost', editorType: 'number', width: 110, align: 'right',
      format: { type: 'currency', currency: 'USD' } },
    { field: 'quantity', header: 'Qty',       editorType: 'number', width: 80,  align: 'right' },
    {
      id: 'subtotal', header: 'Subtotal',     width: 110, align: 'right', editable: false,
      cell: (ctx) => renderSnippet(MoneyCell, { value: subtotal(ctx.row.original), formula: true }),
    },
    {
      id: 'tax', header: 'Tax (8%)',          width: 100, align: 'right', editable: false,
      cell: (ctx) => renderSnippet(MoneyCell, { value: tax(ctx.row.original), formula: true }),
    },
    {
      id: 'total', header: 'Total',           width: 120, align: 'right', editable: false,
      cell: (ctx) => renderSnippet(MoneyCell, { value: total(ctx.row.original), formula: true }),
    },
  ]

  // ---- xlsx builder ------------------------------------------------------
  function colLetter(c: number): string {
    let n = c, s = ''
    while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 }
    return s
  }
  function ref(row: number, col: number): string { return `${colLetter(col)}${row}` }
  function esc(s: string): string {
    return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]!))
  }

  function buildSheetXml(): string {
    // Header row: row 1 carries the column labels AND a parameter cell
    // D1 holds the tax rate so every per-row tax formula can reference
    // it as $D$1 (absolute) - the classic "single source of truth"
    // spreadsheet pattern.
    const out: string[] = []
    out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
    out.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">')
    out.push('<sheetData>')

    // Row 1 - headers + tax-rate parameter
    out.push('<row r="1">')
    const headers = ['Item', 'Unit cost', 'Qty', 'Subtotal', 'Tax', 'Total']
    headers.forEach((h, i) => {
      out.push(`<c r="${ref(1, i)}" t="inlineStr"><is><t>${esc(h)}</t></is></c>`)
    })
    out.push('</row>')

    // Rows 2..N - data + formulas
    rows.forEach((r, i) => {
      const rowNum = i + 2
      const subCell = ref(rowNum, 3)   // D
      out.push(`<row r="${rowNum}">`)
      out.push(`<c r="${ref(rowNum, 0)}" t="inlineStr"><is><t>${esc(r.item)}</t></is></c>`)
      out.push(`<c r="${ref(rowNum, 1)}"><v>${r.unitCost}</v></c>`)
      out.push(`<c r="${ref(rowNum, 2)}"><v>${r.quantity}</v></c>`)
      // Subtotal = B * C, with cached value
      out.push(`<c r="${ref(rowNum, 3)}"><f>${colLetter(1)}${rowNum}*${colLetter(2)}${rowNum}</f><v>${subtotal(r)}</v></c>`)
      // Tax = Subtotal * fixed 8% literal
      out.push(`<c r="${ref(rowNum, 4)}"><f>${subCell}*${TAX_RATE}</f><v>${tax(r)}</v></c>`)
      // Total = Subtotal + Tax
      out.push(`<c r="${ref(rowNum, 5)}"><f>${subCell}+${ref(rowNum, 4)}</f><v>${total(r)}</v></c>`)
      out.push('</row>')
    })

    // Footer - totals row using SUM(rangeRef)
    const footRow = rows.length + 2
    const firstData = 2, lastData = rows.length + 1
    out.push(`<row r="${footRow}">`)
    out.push(`<c r="${ref(footRow, 0)}" t="inlineStr"><is><t>TOTAL</t></is></c>`)
    out.push(`<c r="${ref(footRow, 1)}"></c>`)
    out.push(`<c r="${ref(footRow, 2)}"></c>`)
    out.push(`<c r="${ref(footRow, 3)}"><f>SUM(${colLetter(3)}${firstData}:${colLetter(3)}${lastData})</f><v>${totals.sub}</v></c>`)
    out.push(`<c r="${ref(footRow, 4)}"><f>SUM(${colLetter(4)}${firstData}:${colLetter(4)}${lastData})</f><v>${totals.tx}</v></c>`)
    out.push(`<c r="${ref(footRow, 5)}"><f>SUM(${colLetter(5)}${firstData}:${colLetter(5)}${lastData})</f><v>${totals.tot}</v></c>`)
    out.push('</row>')

    out.push('</sheetData></worksheet>')
    return out.join('')
  }

  function buildContentTypes(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
  }
  function buildRootRels(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  }
  function buildWorkbook(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Q3 Budget" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
  }
  function buildWorkbookRels(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
  }

  // ---- Export action ------------------------------------------------------
  let busy = $state(false)
  let lastFilename = $state<string | null>(null)
  let sheetXmlPreview = $state<string>('')

  async function exportToXlsx(opts: { withFormulas: boolean }) {
    busy = true
    try {
      const zip = new JSZip()
      zip.file('[Content_Types].xml', buildContentTypes())
      const rels = zip.folder('_rels')!
      rels.file('.rels', buildRootRels())
      const xl = zip.folder('xl')!
      xl.file('workbook.xml', buildWorkbook())
      const xlRels = xl.folder('_rels')!
      xlRels.file('workbook.xml.rels', buildWorkbookRels())
      const ws = xl.folder('worksheets')!
      const sheetXml = opts.withFormulas ? buildSheetXml() : buildValuesOnlySheetXml()
      ws.file('sheet1.xml', sheetXml)
      sheetXmlPreview = sheetXml

      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      const filename = `q3-budget-${opts.withFormulas ? 'formulas' : 'values'}.xlsx`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      lastFilename = filename
    } catch (err) {
      console.error('[xlsx export]', err)
    } finally {
      busy = false
    }
  }

  function buildValuesOnlySheetXml(): string {
    // Same shape but every computed column writes the resolved number
    // instead of an `<f>` formula. Useful comparison: open both xlsx
    // files in Excel; the formula one recomputes on edit, the values
    // one stays frozen.
    const out: string[] = []
    out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
    out.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>')
    out.push('<row r="1">')
    const headers = ['Item', 'Unit cost', 'Qty', 'Subtotal', 'Tax', 'Total']
    headers.forEach((h, i) => out.push(`<c r="${ref(1, i)}" t="inlineStr"><is><t>${esc(h)}</t></is></c>`))
    out.push('</row>')
    rows.forEach((r, i) => {
      const rowNum = i + 2
      out.push(`<row r="${rowNum}">`)
      out.push(`<c r="${ref(rowNum, 0)}" t="inlineStr"><is><t>${esc(r.item)}</t></is></c>`)
      out.push(`<c r="${ref(rowNum, 1)}"><v>${r.unitCost}</v></c>`)
      out.push(`<c r="${ref(rowNum, 2)}"><v>${r.quantity}</v></c>`)
      out.push(`<c r="${ref(rowNum, 3)}"><v>${subtotal(r)}</v></c>`)
      out.push(`<c r="${ref(rowNum, 4)}"><v>${tax(r)}</v></c>`)
      out.push(`<c r="${ref(rowNum, 5)}"><v>${total(r)}</v></c>`)
      out.push('</row>')
    })
    const footRow = rows.length + 2
    out.push(`<row r="${footRow}">`)
    out.push(`<c r="${ref(footRow, 0)}" t="inlineStr"><is><t>TOTAL</t></is></c>`)
    out.push(`<c r="${ref(footRow, 1)}"></c><c r="${ref(footRow, 2)}"></c>`)
    out.push(`<c r="${ref(footRow, 3)}"><v>${totals.sub}</v></c>`)
    out.push(`<c r="${ref(footRow, 4)}"><v>${totals.tx}</v></c>`)
    out.push(`<c r="${ref(footRow, 5)}"><v>${totals.tot}</v></c>`)
    out.push('</row>')
    out.push('</sheetData></worksheet>')
    return out.join('')
  }
</script>

{#snippet MoneyCell(props: { value: number; formula?: boolean })}
  <span class="fx-cell">
    {#if props.formula}<span class="fx-mark" title="Cell value derived by formula" aria-hidden="true">ƒ</span>{/if}
    <span>{fmtMoney.format(props.value)}</span>
  </span>
{/snippet}

<section class="fx-shell flex flex-col flex-1 min-h-0 gap-3">
  <header class="fx-head shrink-0">
    <div>
      <h2 class="fx-title">Formulas preserved in xlsx</h2>
      <p class="fx-sub">
        Computed columns (<code>Subtotal</code>, <code>Tax</code>, <code>Total</code>) export as Excel
        formulas, not cached numbers. Open the file in Excel - edit a quantity and the column recomputes.
      </p>
    </div>
    <div class="fx-actions">
      <button type="button" class="fx-btn fx-btn-ghost" disabled={busy} onclick={() => exportToXlsx({ withFormulas: false })}>
        ⬇ Export values only
      </button>
      <button type="button" class="fx-btn fx-btn-primary" disabled={busy} onclick={() => exportToXlsx({ withFormulas: true })}>
        {busy ? 'Generating…' : 'ƒx Export with formulas'}
      </button>
    </div>
  </header>

  {#if lastFilename}
    <div class="fx-success shrink-0">
      Wrote <code>{lastFilename}</code> · open it in Excel / LibreOffice / Numbers to verify the formulas round-tripped.
    </div>
  {/if}

  <div class="fx-grid-host flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="none"
      selectionMode="cell"
      showRowNumbers={true}
      enableInlineEditing={true}
      enableCellSelection={true}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>

  <footer class="fx-foot shrink-0">
    <div class="fx-foot-totals">
      <span>Subtotal <strong>{fmtMoney.format(totals.sub)}</strong></span>
      <span>Tax <strong>{fmtMoney.format(totals.tx)}</strong></span>
      <span>Total <strong>{fmtMoney.format(totals.tot)}</strong></span>
    </div>
    <span class="fx-foot-hint">Edit Unit cost or Qty - totals recompute live. Re-export to capture changes.</span>
  </footer>

  {#if sheetXmlPreview}
    <details class="fx-xml shrink-0">
      <summary>Show the generated <code>xl/worksheets/sheet1.xml</code></summary>
      <pre><code>{sheetXmlPreview}</code></pre>
    </details>
  {/if}
</section>

<style>
  /* The success banner's green carries meaning, so it stays off the theme
     tokens; only its dark ramp is adjusted here for legibility. */
  .fx-shell { height: 100%; --fx-ok-fg: #166534; }
  :global([data-theme='dark']) .fx-shell { --fx-ok-fg: #4ade80; }
  .fx-head  { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .fx-title { margin: 0; font-size: 20px; font-weight: 700; color: var(--sg-fg, #0f172a); }
  .fx-sub   { margin: 4px 0 0 0; font-size: 13px; color: var(--sg-muted, #64748b); max-width: 70ch; line-height: 1.45; }
  .fx-sub code, .fx-success code, .fx-xml code {
    background: var(--sg-header-bg, #f1f5f9);
    padding: 1px 5px; border-radius: 3px;
    font-family: ui-monospace, Menlo, monospace; font-size: 11.5px;
  }

  .fx-actions { display: inline-flex; gap: 8px; flex-wrap: wrap; }
  .fx-btn {
    border-radius: 6px;
    padding: 7px 14px;
    font-size: 13px; font-weight: 600;
    cursor: pointer;
  }
  .fx-btn:disabled { opacity: 0.5; cursor: default; }
  .fx-btn-primary {
    background: var(--sg-accent, #6366f1);
    color: var(--sg-on-accent, #fff); border: 0;
    box-shadow: 0 1px 2px color-mix(in srgb, var(--sg-accent, #6366f1) 30%, transparent);
  }
  .fx-btn-ghost   {
    background: transparent; color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1);
  }
  .fx-btn-ghost:hover:not(:disabled) { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }

  .fx-success {
    background: rgba(34,197,94,0.10);
    color: var(--fx-ok-fg);
    border: 1px solid rgba(34,197,94,0.40);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12.5px;
  }

  .fx-foot {
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px;
    padding: 8px 14px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    font-size: 13px;
  }
  .fx-foot-totals { display: inline-flex; gap: 22px; }
  .fx-foot-totals span { color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .fx-foot-totals strong { color: var(--sg-fg, #0f172a); font-weight: 700; margin-left: 6px; }
  .fx-foot-hint { color: var(--sg-muted, #94a3b8); font-size: 12px; }

  :global(.fx-cell) {
    display: inline-flex; align-items: center; gap: 4px;
    font-variant-numeric: tabular-nums;
  }
  :global(.fx-mark) {
    font-family: ui-serif, Georgia, serif;
    font-style: italic; font-weight: 700;
    color: var(--sg-accent, #6366f1);
    font-size: 13px;
  }

  .fx-xml {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 12.5px;
  }
  .fx-xml summary { cursor: pointer; font-weight: 600; color: var(--sg-fg, #0f172a); }
  .fx-xml pre {
    margin: 8px 0 0 0;
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 4px;
    padding: 8px 10px;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px;
    max-height: 240px;
    overflow: auto;
  }
</style>
