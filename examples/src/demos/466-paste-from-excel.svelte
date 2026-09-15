<script lang="ts">
  /**
   * 466. Paste from Excel: formats and formulas survive
   * ---------------------------------------------------
   * Excel puts two things on the clipboard when you copy a block: the tab
   * separated text every grid takes, and an HTML document with the formats
   * in a style block keyed by class, the formulas in x:fmla and the raw
   * numbers in x:num. The sheet reads the second one, so a paste from Excel
   * arrives with its bold, its fills, its number formats and its formulas,
   * moved to where they landed; Google Sheets' flavour (data-sheets-formula)
   * reads the same way. Copying OUT writes both flavours, so a block pasted
   * into Excel keeps its formats too.
   *
   * There is no Excel in the browser, so the buttons here put exactly what
   * Excel puts on the clipboard: the same markup, byte for byte the parts
   * that matter. Click one, click a cell, press Ctrl+V. Then open Excel or
   * Sheets, copy a few cells of your own and paste them: the result is the
   * same.
   *
   * Try: "Copy an Excel block", click B3, Ctrl+V. The header is bold on a
   * yellow fill, the prices read $1,234.50, the Total column is a formula
   * (click one and read the bar) that has been moved to the rows it landed
   * on. Paste Special > Values drops the formulas; Formats drops the text.
   */
  import { SvSheet, createWorkbook, type CellFormatEntry } from '@svgrid/enterprise'

  const wb = createWorkbook([{
    name: 'Sheet1',
    cells: [
      ['A paste target. Click a cell, then Ctrl+V.'],
    ],
  }])
  const formats: Record<string, CellFormatEntry> = { A1: { italic: true, color: '#64748b' } }

  // ---- what Excel for Windows puts on the clipboard -------------------------
  // Trimmed to the parts that matter: the style block, the classes on the
  // cells, x:num for the raw number, x:fmla for the formula, the DISPLAY text
  // as the cell's content. Excel's own dump is longer, not different. The
  // style tags are spelled in two halves: a literal one inside a script is
  // taken for the component's own style block by the Svelte preprocessor.
  const STYLE = ['<', 'style>'].join('')
  const END_STYLE = ['</', 'style>'].join('')
  const EXCEL_HTML = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>${STYLE}
<!--table {mso-displayed-decimal-separator:"\\.";}
.xl65 {font-weight:700;background:#FFEB9C;color:#7F6000;text-align:center;border:.5pt solid #BFBFBF;}
.xl66 {mso-number-format:"\\$\\#\\,\\#\\#0\\.00";text-align:right;}
.xl67 {mso-number-format:"0";text-align:right;}
.xl68 {mso-number-format:"\\$\\#\\,\\#\\#0\\.00";font-weight:700;color:#006100;background:#C6EFCE;text-align:right;}
.xl69 {font-style:italic;color:#595959;}
-->
${END_STYLE}</head><body>
<table border=0 cellpadding=0 cellspacing=0>
<tr><td class=xl65>Item</td><td class=xl65>Unit price</td><td class=xl65>Qty</td><td class=xl65>Total</td></tr>
<tr><td>Desk lamp</td><td class=xl66 x:num="1234.5">$1,234.50</td><td class=xl67 x:num="3">3</td><td class=xl68 x:num="3703.5" x:fmla="=B2*C2">$3,703.50</td></tr>
<tr><td>Monitor arm</td><td class=xl66 x:num="89.99">$89.99</td><td class=xl67 x:num="12">12</td><td class=xl68 x:num="1079.88" x:fmla="=B3*C3">$1,079.88</td></tr>
<tr><td>Cable tray</td><td class=xl66 x:num="17.25">$17.25</td><td class=xl67 x:num="40">40</td><td class=xl68 x:num="690" x:fmla="=B4*C4">$690.00</td></tr>
<tr><td class=xl69>Prices exclude tax</td><td></td><td></td><td class=xl68 x:num="5473.38" x:fmla="=SUM(D2:D4)">$5,473.38</td></tr>
</table></body></html>`
  const EXCEL_TEXT = [
    'Item\tUnit price\tQty\tTotal',
    'Desk lamp\t$1,234.50\t3\t$3,703.50',
    'Monitor arm\t$89.99\t12\t$1,079.88',
    'Cable tray\t$17.25\t40\t$690.00',
    'Prices exclude tax\t\t\t$5,473.38',
  ].join('\n')

  // ---- and Google Sheets' -----------------------------------------------------
  // Sheets writes inline styles and carries the formula in data-sheets-formula
  // and the typed value in data-sheets-value, a JSON object keyed by type.
  const SHEETS_HTML = `<meta charset="utf-8"><google-sheets-html-origin><table><tbody>
<tr><td style="font-weight:bold;background-color:#d9ead3;">Region</td><td style="font-weight:bold;background-color:#d9ead3;">Target</td><td style="font-weight:bold;background-color:#d9ead3;">Actual</td><td style="font-weight:bold;background-color:#d9ead3;">Attainment</td></tr>
<tr><td>North</td><td data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:150000}" style="text-align:right;">150,000</td><td data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:155700}" style="text-align:right;">155,700</td><td data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:1.038}" data-sheets-formula="=R[0]C[-1]/R[0]C[-2]" data-sheets-numberformat="{&quot;1&quot;:2,&quot;2&quot;:&quot;0.0%&quot;}" style="text-align:right;color:#38761d;">103.8%</td></tr>
<tr><td>South</td><td data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:120000}" style="text-align:right;">120,000</td><td data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:104700}" style="text-align:right;">104,700</td><td data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:0.8725}" data-sheets-formula="=R[0]C[-1]/R[0]C[-2]" data-sheets-numberformat="{&quot;1&quot;:2,&quot;2&quot;:&quot;0.0%&quot;}" style="text-align:right;color:#cc0000;">87.3%</td></tr>
</tbody></table></google-sheets-html-origin>`
  const SHEETS_TEXT = ['Region\tTarget\tActual\tAttainment', 'North\t150,000\t155,700\t103.8%', 'South\t120,000\t104,700\t87.3%'].join('\n')

  let status = $state('')
  async function copy(html: string, text: string, what: string) {
    try {
      // Both flavours at once, the way Excel does it: a plain text for the
      // grids that read only that, the HTML for the ones that read more.
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) }),
      ])
      status = `${what} is on the clipboard. Click a cell and press Ctrl+V.`
    } catch {
      status = 'The browser refused the clipboard (it needs a secure context and a click). Copy from Excel itself instead.'
    }
  }
</script>

<section class="wrap flex flex-col flex-1 min-h-0">
  <div class="bar">
    <button type="button" class="btn" onclick={() => copy(EXCEL_HTML, EXCEL_TEXT, 'An Excel block')}>Copy an Excel block</button>
    <button type="button" class="btn" onclick={() => copy(SHEETS_HTML, SHEETS_TEXT, 'A Google Sheets block')}>Copy a Google Sheets block</button>
    <span class="status">{status}</span>
  </div>
  <SvSheet workbook={wb} height="100%" rows={20} columns={9} columnWidths={{ A: 170 }} {formats} />
  <p class="note shrink-0">
    The buttons put on the clipboard what Excel and Google Sheets put there:
    the formats in a <code>&lt;style&gt;</code> block or inline, the formulas
    in <code>x:fmla</code> or <code>data-sheets-formula</code>, the raw
    numbers beside the display text. Paste into the sheet and the block
    arrives formatted, its formulas moved to the cells they landed on. A
    copy from the sheet writes the same two flavours back.
  </p>
</section>

<style>
  .wrap { gap: 8px; }
  .bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 6px 10px;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
    background: var(--sg-header-bg, #f1f5f9);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
  }
  .btn {
    padding: 4px 10px;
    font: inherit;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 4px;
    cursor: pointer;
  }
  .btn:hover { background: var(--sg-row-hover-bg, #f8fafc); }
  .status { color: var(--sg-muted, #64748b); }
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
