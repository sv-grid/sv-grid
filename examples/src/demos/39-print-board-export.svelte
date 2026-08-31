<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 39. Print & boardroom export
   * ----------------------------
   * Quarterly P&L by department - the kind of table a CFO drops into
   * a board pack. The interesting work is BELOW the grid:
   *
   *   1. **Sandbox-popup print.** "Print / save PDF" opens a fresh
   *      window containing only the printable HTML (cover sheet +
   *      plain table with inlined styles) and calls `print()` on it.
   *      That keeps the print dialog clean - none of the host
   *      website's sidebar, header, or other chrome bleeds onto the
   *      paper, which is the failure mode any "naive `window.print()`"
   *      implementation hits.
   *
   *   2. **Boardroom cover page.** The popup leads with a styled
   *      cover sheet (company name, period, owner, signature line)
   *      so the printed deck reads as one document, not a screenshot.
   *
   *   3. **Page-size + orientation switcher.** Letter / A4 / Legal in
   *      portrait or landscape - written into the popup's `@page`
   *      rule so the browser's print pipeline picks them up.
   *
   *   4. **CSV / HTML export.** Both reuse the same `buildPrintableHtml`
   *      builder as Print, so the saved file matches the printed sheet
   *      exactly. CSV downloads as `p-and-l.csv`, HTML as
   *      `p-and-l.html` for archival or re-printing.
   *
   * No external PDF library - the browser's native print-to-PDF is
   * how every enterprise reporting tool actually generates the
   * deliverable.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  // ---- Domain ---------------------------------------------------------

  type Period = 'Q1' | 'Q2' | 'Q3' | 'Q4'
  type LineItem = {
    department: string
    code: string
    name: string
    q1: number
    q2: number
    q3: number
    q4: number
    fy: number
    yoyDelta: number
    owner: string
  }

  // ---- Seed -----------------------------------------------------------

  const SEED_ROWS: Array<Omit<LineItem, 'fy' | 'yoyDelta'>> = [
    { department: 'Revenue',          code: 'REV-001', name: 'Product subscriptions',   q1: 4_200_000, q2: 4_580_000, q3: 4_910_000, q4: 5_320_000, owner: 'A. Park'   },
    { department: 'Revenue',          code: 'REV-002', name: 'Professional services',   q1: 1_120_000, q2: 1_245_000, q3: 1_390_000, q4: 1_510_000, owner: 'A. Park'   },
    { department: 'Revenue',          code: 'REV-003', name: 'Hardware sales',          q1:   840_000, q2:   910_000, q3:   930_000, q4:   1_020_000, owner: 'A. Park' },
    { department: 'Revenue',          code: 'REV-004', name: 'Marketplace fees',        q1:   210_000, q2:   245_000, q3:   290_000, q4:   330_000, owner: 'A. Park'   },
    { department: 'Cost of revenue',  code: 'COR-001', name: 'Hosting & infrastructure', q1:  -680_000, q2:  -720_000, q3:  -780_000, q4:  -830_000, owner: 'J. Chen'  },
    { department: 'Cost of revenue',  code: 'COR-002', name: 'Customer support',        q1:  -310_000, q2:  -330_000, q3:  -360_000, q4:  -390_000, owner: 'J. Chen' },
    { department: 'Cost of revenue',  code: 'COR-003', name: 'Hardware COGS',           q1:  -510_000, q2:  -540_000, q3:  -560_000, q4:  -620_000, owner: 'J. Chen' },
    { department: 'Sales & marketing', code: 'SAM-001', name: 'Brand marketing',        q1:  -420_000, q2:  -480_000, q3:  -510_000, q4:  -560_000, owner: 'R. Diaz' },
    { department: 'Sales & marketing', code: 'SAM-002', name: 'Demand generation',     q1:  -680_000, q2:  -740_000, q3:  -810_000, q4:  -890_000, owner: 'R. Diaz' },
    { department: 'Sales & marketing', code: 'SAM-003', name: 'Sales compensation',    q1:  -920_000, q2:  -970_000, q3: -1_040_000, q4: -1_120_000, owner: 'R. Diaz' },
    { department: 'Sales & marketing', code: 'SAM-004', name: 'Channel partnerships',  q1:  -180_000, q2:  -210_000, q3:  -240_000, q4:  -270_000, owner: 'R. Diaz' },
    { department: 'Research & dev',    code: 'RND-001', name: 'Platform engineering',  q1:  -1_140_000, q2: -1_210_000, q3: -1_290_000, q4: -1_370_000, owner: 'C. Singh' },
    { department: 'Research & dev',    code: 'RND-002', name: 'Applied ML',            q1:  -540_000, q2:  -590_000, q3:  -640_000, q4:  -710_000, owner: 'C. Singh' },
    { department: 'Research & dev',    code: 'RND-003', name: 'Design',                q1:  -310_000, q2:  -330_000, q3:  -360_000, q4:  -390_000, owner: 'C. Singh' },
    { department: 'G & A',             code: 'GNA-001', name: 'Finance & accounting',  q1:  -240_000, q2:  -260_000, q3:  -270_000, q4:  -290_000, owner: 'D. Olsen' },
    { department: 'G & A',             code: 'GNA-002', name: 'Legal & compliance',    q1:  -170_000, q2:  -180_000, q3:  -195_000, q4:  -210_000, owner: 'D. Olsen' },
    { department: 'G & A',             code: 'GNA-003', name: 'People ops',            q1:  -210_000, q2:  -225_000, q3:  -245_000, q4:  -265_000, owner: 'D. Olsen' },
    { department: 'G & A',             code: 'GNA-004', name: 'Office & facilities',   q1:  -130_000, q2:  -140_000, q3:  -150_000, q4:  -160_000, owner: 'D. Olsen' },
  ]

  const rows: LineItem[] = SEED_ROWS.map((r) => ({
    ...r,
    fy: r.q1 + r.q2 + r.q3 + r.q4,
    yoyDelta: Math.round(((r.q1 + r.q2 + r.q3 + r.q4) * (0.04 + Math.random() * 0.18)) * (Math.random() < 0.85 ? 1 : -1)),
  }))

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // ---- Print controls --------------------------------------------------

  type PageSize = 'Letter' | 'A4' | 'Legal'
  type Orientation = 'portrait' | 'landscape'

  let pageSize = $state<PageSize>('Letter')
  let orientation = $state<Orientation>('landscape')
  let printPreview = $state(false)
  let coverPage = $state(true)
  let companyName = $state('Helios Industries, Inc.')
  let preparedBy = $state('A. Park · CFO')
  let periodLabel = $state('FY 2025 - full year actuals')

  // The `@page` rule lives in the print-popup's own document head
  // (see `buildPrintableHtml`), so we don't need to inject anything
  // on the host document.

  // ---- Aggregates ------------------------------------------------------

  const totals = $derived.by(() => {
    const sums = { q1: 0, q2: 0, q3: 0, q4: 0, fy: 0, yoy: 0 }
    const byDept = new Map<string, { q1: number; q2: number; q3: number; q4: number; fy: number; yoy: number }>()
    for (const r of rows) {
      sums.q1 += r.q1; sums.q2 += r.q2; sums.q3 += r.q3; sums.q4 += r.q4
      sums.fy += r.fy; sums.yoy += r.yoyDelta
      const d = byDept.get(r.department) ?? { q1: 0, q2: 0, q3: 0, q4: 0, fy: 0, yoy: 0 }
      d.q1 += r.q1; d.q2 += r.q2; d.q3 += r.q3; d.q4 += r.q4
      d.fy += r.fy; d.yoy += r.yoyDelta
      byDept.set(r.department, d)
    }
    return { total: sums, byDept }
  })

  // ---- Actions ---------------------------------------------------------

  /**
   * Build the full standalone HTML document for the report. Used by
   * both Print (rendered into a new window before calling `print()`)
   * and Export HTML (saved as a file). Putting it through one builder
   * means the printable paper view and the saved file always agree.
   *
   * The opening / closing inline-stylesheet tags are concatenated at
   * runtime - if we put the literal token in the source, Svelte's
   * compiler sees it as a real component style block and the build
   * chokes.
   */
  function buildPrintableHtml(): string {
    const STYLE_OPEN = '<' + 'style>'
    const STYLE_CLOSE = '<' + '/' + 'style>'

    const rowsHtml = rows
      .map((r) => `<tr>
        <td>${r.department}</td>
        <td>${r.code}</td>
        <td>${r.name}</td>
        <td class="num">${fmtMoney(r.q1)}</td>
        <td class="num">${fmtMoney(r.q2)}</td>
        <td class="num">${fmtMoney(r.q3)}</td>
        <td class="num">${fmtMoney(r.q4)}</td>
        <td class="num strong">${fmtMoney(r.fy)}</td>
        <td class="num">${r.yoyDelta >= 0 ? '+' : '−'}${fmtMoney(Math.abs(r.yoyDelta))}</td>
        <td>${r.owner}</td>
      </tr>`)
      .join('\n')

    const totalsRow = `<tr class="totals">
      <td colspan="3">FY OPERATING INCOME</td>
      <td class="num">${fmtMoney(totals.total.q1)}</td>
      <td class="num">${fmtMoney(totals.total.q2)}</td>
      <td class="num">${fmtMoney(totals.total.q3)}</td>
      <td class="num">${fmtMoney(totals.total.q4)}</td>
      <td class="num strong">${fmtMoney(totals.total.fy)}</td>
      <td></td>
      <td></td>
    </tr>`

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const coverHtml = coverPage ? `<section class="cover">
      <div class="logo">⬢</div>
      <h1>${companyName}</h1>
      <h2>${periodLabel}</h2>
      <div class="meta-grid">
        <div><strong>Prepared by</strong> ${preparedBy}</div>
        <div><strong>Date</strong> ${today}</div>
      </div>
      <div class="sig">
        <div class="sig-line"></div>
        <div class="sig-label">Signature · ${preparedBy}</div>
      </div>
    </section>` : ''

    const inlineCss = STYLE_OPEN + `
      @page { size: ${pageSize} ${orientation}; margin: 18mm; }
      * { box-sizing: border-box; }
      body {
        font-family: Inter, system-ui, -apple-system, sans-serif;
        color: #1e293b;
        margin: 0;
        padding: 0;
      }
      .cover {
        min-height: 90vh;
        padding: 40px 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
        page-break-after: always;
        break-after: page;
      }
      .logo {
        width: 48px; height: 48px;
        background: #2563eb;
        color: #fff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        border-radius: 6px;
      }
      .cover h1 { font-size: 28px; margin: 8px 0 0 0; }
      .cover h2 { font-size: 16px; margin: 0; color: #64748b; font-weight: 400; }
      .meta-grid {
        display: flex;
        gap: 40px;
        font-size: 13px;
        margin-top: 12px;
      }
      .meta-grid strong { color: #64748b; margin-right: 6px; font-weight: 600; }
      .sig {
        margin-top: auto;
        padding-top: 60px;
      }
      .sig-line { width: 220px; height: 1px; background: #1e293b; margin-bottom: 4px; }
      .sig-label { font-size: 11px; color: #64748b; }
      .title-strip {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        padding: 0 0 14px 0;
        border-bottom: 2px solid #1e293b;
        margin-bottom: 12px;
      }
      .title-strip h1 { font-size: 20px; margin: 0; }
      .title-strip p { margin: 2px 0 0 0; color: #64748b; font-size: 12px; }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11.5px;
      }
      thead { display: table-header-group; }
      th, td {
        padding: 7px 9px;
        border-bottom: 1px solid #cbd5e1;
        vertical-align: top;
      }
      th {
        text-align: left;
        background: #f1f5f9;
        font-weight: 700;
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .num { text-align: right; font-variant-numeric: tabular-nums; }
      .strong { font-weight: 700; color: #1d4ed8; }
      tr { page-break-inside: avoid; break-inside: avoid; }
      tr.totals td {
        border-top: 2px solid #1e293b;
        background: #f8fafc;
        font-weight: 700;
        text-transform: uppercase;
        font-size: 10.5px;
        letter-spacing: 0.05em;
      }
    ` + STYLE_CLOSE

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${companyName} - ${periodLabel}</title>
${inlineCss}
</head>
<body>
${coverHtml}
<header class="title-strip">
  <div>
    <h1>${companyName}</h1>
    <p>${periodLabel} · prepared by ${preparedBy}</p>
  </div>
  <div>
    <p><strong>FY income:</strong> ${fmtFull(totals.total.fy)}</p>
  </div>
</header>
<table>
  <thead><tr>
    <th>Department</th><th>Code</th><th>Line item</th>
    <th class="num">Q1</th><th class="num">Q2</th><th class="num">Q3</th><th class="num">Q4</th>
    <th class="num">FY</th><th class="num">YoY Δ</th><th>Owner</th>
  </tr></thead>
  <tbody>${rowsHtml}${totalsRow}</tbody>
</table>
</body>
</html>`
  }

  /**
   * Open a sandbox window containing only the printable HTML, then
   * trigger the browser's print dialog on it. We do NOT use
   * `window.print()` on the current page because the page is full of
   * website chrome (sidebar, header) that the demo's `@media print`
   * CSS can't reach - it lives in the global stylesheet, not our
   * scoped block. Printing the popup gets a clean paper view.
   */
  function doPrint(): void {
    if (typeof window === 'undefined') return
    const win = window.open('', '_blank', 'width=900,height=720')
    if (!win) {
      // Popup blocked - fall back so the user gets SOMETHING.
      window.print()
      return
    }
    win.document.open()
    win.document.write(buildPrintableHtml())
    win.document.close()
    // Let the doc paint before the print dialog reads its layout.
    // Some browsers ignore an immediate `print()` on an empty layout.
    const fire = () => {
      try {
        win.focus()
        win.print()
      } catch {
        /* user closed the popup before we could print */
      }
    }
    if (win.document.readyState === 'complete') {
      setTimeout(fire, 100)
    } else {
      win.addEventListener('load', () => setTimeout(fire, 100))
    }
  }

  function escapeCsv(value: unknown): string {
    const s = String(value ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  function downloadFile(name: string, mime: string, content: string): void {
    if (typeof document === 'undefined') return
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  function exportCsv(): void {
    const header = ['Department', 'Code', 'Line item', 'Q1', 'Q2', 'Q3', 'Q4', 'FY', 'YoY Δ', 'Owner']
    const lines: string[] = [header.join(',')]
    for (const r of rows) {
      lines.push([r.department, r.code, r.name, r.q1, r.q2, r.q3, r.q4, r.fy, r.yoyDelta, r.owner].map(escapeCsv).join(','))
    }
    downloadFile('p-and-l.csv', 'text/csv;charset=utf-8', lines.join('\n'))
  }
  function exportHtml(): void {
    // Same builder as Print so the saved file matches the printed
    // sheet 1:1 - the recipient can re-print it later and get the
    // exact same paper layout.
    downloadFile('p-and-l.html', 'text/html;charset=utf-8', buildPrintableHtml())
  }

  // ---- Formatters ------------------------------------------------------

  function fmtMoney(n: number): string {
    const sign = n < 0 ? '-' : ''
    const abs = Math.abs(n)
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
    return `${sign}$${abs.toFixed(0)}`
  }
  function fmtFull(n: number): string {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet DeptCell(props: { row: LineItem })}
  <span class="pb-dept">{props.row.department}</span>
{/snippet}

{#snippet NumCell(props: { value: number; em?: boolean })}
  <span class={`pb-num ${props.em ? 'pb-num-em' : ''} ${props.value < 0 ? 'pb-num-neg' : ''}`}>
    {fmtMoney(props.value)}
  </span>
{/snippet}

{#snippet YoYCell(props: { row: LineItem })}
  {@const positive = props.row.yoyDelta >= 0}
  <span class={`pb-yoy ${positive ? 'pb-yoy-pos' : 'pb-yoy-neg'}`}>
    {positive ? '▲' : '▼'} {fmtMoney(Math.abs(props.row.yoyDelta))}
  </span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="pb-shell flex flex-col flex-1 min-h-0 gap-3" class:pb-print-preview={printPreview}>
  <!-- Print-only cover page -->
  {#if coverPage}
    <div class="pb-cover">
      <div class="pb-cover-logo">⬢</div>
      <h1 class="pb-cover-title">{companyName}</h1>
      <h2 class="pb-cover-sub">{periodLabel}</h2>
      <div class="pb-cover-meta">
        <div><strong>Prepared by</strong> {preparedBy}</div>
        <div><strong>Date</strong> {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      </div>
      <div class="pb-cover-sig">
        <div class="pb-cover-sig-line"></div>
        <div class="pb-cover-sig-label">Signature · {preparedBy}</div>
      </div>
    </div>
  {/if}

  <!-- Toolbar (hidden on print) -->
  <div class="pb-toolbar">
    <div class="pb-toolbar-group">
      <label class="pb-input-label">
        <span>Page</span>
        <select bind:value={pageSize} class="pb-select">
          <option>Letter</option><option>A4</option><option>Legal</option>
        </select>
      </label>
      <label class="pb-input-label">
        <span>Orientation</span>
        <select bind:value={orientation} class="pb-select">
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </label>
      <label class="pb-check">
        <input type="checkbox" bind:checked={coverPage} />
        <span>Cover page</span>
      </label>
      <label class="pb-check">
        <input type="checkbox" bind:checked={printPreview} />
        <span>Print preview</span>
      </label>
    </div>
    <div class="pb-toolbar-group pb-toolbar-actions">
      <button type="button" class="pb-btn" onclick={exportCsv}>⤓ CSV</button>
      <button type="button" class="pb-btn" onclick={exportHtml}>⤓ HTML</button>
      <button type="button" class="pb-btn pb-btn-primary" onclick={doPrint}>🖨 Print / save PDF</button>
    </div>
  </div>

  <!-- Title strip -->
  <header class="pb-title-strip">
    <div>
      <h2 class="pb-title">{companyName}</h2>
      <p class="pb-sub">{periodLabel} · prepared by {preparedBy}</p>
    </div>
    <div class="pb-grand-totals">
      <div class="pb-grand">
        <div class="pb-grand-label">Revenue</div>
        <div class="pb-grand-value">{fmtFull(rows.filter((r) => r.department === 'Revenue').reduce((s, r) => s + r.fy, 0))}</div>
      </div>
      <div class="pb-grand">
        <div class="pb-grand-label">Operating expense</div>
        <div class="pb-grand-value">{fmtFull(rows.filter((r) => r.department !== 'Revenue').reduce((s, r) => s + r.fy, 0))}</div>
      </div>
      <div class="pb-grand pb-grand-em">
        <div class="pb-grand-label">FY operating income</div>
        <div class="pb-grand-value">{fmtFull(totals.total.fy)}</div>
      </div>
    </div>
  </header>

  <!-- Grid -->
  <div class="flex-1 min-h-0 pb-grid-host">
    <SvGrid responsive={true}
      data={rows}
      columns={[
        { field: 'department', header: 'Department', width: 180, editable: false,
          cell: (ctx) => renderSnippet(DeptCell, { row: ctx.row.original }) },
        { field: 'code', header: 'Code', width: 110, editable: false },
        { field: 'name', header: 'Line item', width: 240, editable: false },
        { field: 'q1', header: 'Q1', editorType: 'number', width: 100, editable: false,
          cell: (ctx) => renderSnippet(NumCell, { value: ctx.row.original.q1 }) },
        { field: 'q2', header: 'Q2', editorType: 'number', width: 100, editable: false,
          cell: (ctx) => renderSnippet(NumCell, { value: ctx.row.original.q2 }) },
        { field: 'q3', header: 'Q3', editorType: 'number', width: 100, editable: false,
          cell: (ctx) => renderSnippet(NumCell, { value: ctx.row.original.q3 }) },
        { field: 'q4', header: 'Q4', editorType: 'number', width: 100, editable: false,
          cell: (ctx) => renderSnippet(NumCell, { value: ctx.row.original.q4 }) },
        { field: 'fy', header: 'FY', editorType: 'number', width: 130, editable: false,
          cell: (ctx) => renderSnippet(NumCell, { value: ctx.row.original.fy, em: true }) },
        { field: 'yoyDelta', header: 'YoY Δ', editorType: 'number', width: 130, editable: false,
          cell: (ctx) => renderSnippet(YoYCell, { row: ctx.row.original }) },
        { field: 'owner', header: 'Owner', width: 110, editable: false },
      ] satisfies ColumnDef<typeof features, LineItem>[]}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      enableInlineEditing={false}
      enableCellSelection={true}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>

<style>
  .pb-shell { height: 100%; }

  /* Print preview "paper" simulation in screen view. The sheet stays
   * white on a grey desk in every theme - it is standing in for real
   * paper, so these are deliberately not theme tokens. */
  .pb-print-preview {
    background: linear-gradient(180deg, #cbd5e1 0%, #94a3b8 100%);
    padding: 20px;
    border-radius: 10px;
  }
  .pb-print-preview > * {
    background: #ffffff;
    color: #1e293b;
    border-radius: 4px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  }
  .pb-print-preview > .pb-toolbar {
    background: #ffffff;
    margin-bottom: 14px;
    padding: 8px 12px;
  }

  /* Cover page */
  .pb-cover {
    padding: 32px 40px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 160px;
  }
  .pb-cover-logo {
    font-size: 36px;
    color: var(--sg-accent, #2563eb);
  }
  .pb-cover-title {
    font-size: 26px;
    margin: 0;
  }
  .pb-cover-sub {
    font-size: 16px;
    color: var(--sg-muted, #64748b);
    font-weight: 400;
    margin: 0;
  }
  .pb-cover-meta {
    display: flex;
    gap: 32px;
    font-size: 13px;
    margin-top: 8px;
    color: var(--sg-fg, #1e293b);
  }
  .pb-cover-meta strong { color: var(--sg-muted, #64748b); margin-right: 6px; }
  .pb-cover-sig {
    margin-top: auto;
    padding-top: 32px;
  }
  .pb-cover-sig-line {
    width: 200px;
    height: 1px;
    background: var(--sg-fg, #1e293b);
    margin-bottom: 4px;
  }
  .pb-cover-sig-label {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
  }

  /* Toolbar */
  .pb-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    background: var(--sg-bg, #ffffff);
    flex-shrink: 0;
  }
  .pb-toolbar-group {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .pb-input-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
  .pb-select {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 5px;
    padding: 3px 6px;
    font-size: 12px;
  }
  .pb-check {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--sg-fg, #1e293b);
  }
  .pb-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 12px;
    cursor: pointer;
  }
  .pb-btn:hover { background: var(--sg-header-bg, #f1f5f9); }
  .pb-btn-primary {
    border-color: transparent;
    background: var(--sg-accent, #2563eb);
    color: var(--sg-on-accent, #fff);
  }
  .pb-btn-primary:hover { filter: brightness(1.05); }

  /* Title strip */
  .pb-title-strip {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    padding: 12px 16px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    background: var(--sg-bg, #ffffff);
    flex-shrink: 0;
  }
  .pb-title { font-size: 18px; margin: 0; }
  .pb-sub   { font-size: 12px; color: var(--sg-muted, #64748b); margin: 2px 0 0 0; }
  .pb-grand-totals {
    display: flex;
    gap: 22px;
  }
  .pb-grand-label {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sg-muted, #64748b);
  }
  .pb-grand-value {
    font-size: 16px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .pb-grand-em .pb-grand-value {
    color: var(--sg-accent, #2563eb);
    font-size: 18px;
  }

  .pb-grid-host {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    overflow: hidden;
    background: var(--sg-bg, #ffffff);
  }

  /* Cell badges */
  :global(.pb-dept) { font-weight: 600; }
  :global(.pb-num) {
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  }
  :global(.pb-num-em) { color: var(--sg-accent, #2563eb); font-weight: 700; }
  :global(.pb-num-neg) { color: #b91c1c; }
  :global([data-theme='dark'] .pb-num-neg) { color: #f87171; }

  :global(.pb-yoy) {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  :global(.pb-yoy-pos) { background: #dcfce7; color: #166534; }
  :global(.pb-yoy-neg) { background: #fee2e2; color: #b91c1c; }
  :global([data-theme='dark'] .pb-yoy-pos) { background: rgba(34,197,94,.18); color: #4ade80; }
  :global([data-theme='dark'] .pb-yoy-neg) { background: rgba(239,68,68,.18); color: #f87171; }

  /* Print-only table: hidden on screen, becomes the printable view. */
  /* Print uses a sandbox popup (see `doPrint`), so we don't need
   * `@media print` rules in this scoped stylesheet - every CSS the
   * paper view sees is embedded directly in the popup's document head. */
  /* Phone: the grand-total figure is wider than its cell and painted over the label. */
  @media (max-width: 639px), (max-height: 500px) and (pointer: coarse) {
    .pb-grand-value { font-size: 14px; overflow-wrap: anywhere; }
  }
</style>
