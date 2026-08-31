<script lang="ts">
  /**
   * 169. Per-cell custom borders - KPI region on a real spreadsheet
   * ----------------------------------------------------------------
   * Opens like Excel: row gutter 1..1000, column letters A..Z, every
   * cell editable. Rows 1..16 hold a KPI scorecard whose borders
   * encode performance bands - everything below is empty, like a
   * fresh sheet.
   *
   * `spreadsheetLayout` paints HOT-style per-edge borders via an
   * absolute-positioned overlay div inside each cell (no border-
   * collapse fights). Edit any Plan or Actual cell - subtotals and
   * borders recompute live.
   */
  import { tick } from 'svelte'
  import {
    SvGrid,
    tableFeatures,
    renderSnippet,
    spreadsheetLayout,
    type ColumnDef,
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
  type Row = { rn: number } & Record<ColKey, string | number>

  const TOTAL_ROWS = 1000

  type Section = 'engineering' | 'sales' | 'marketing'
  const SECTION_COLORS: Record<Section, string> = {
    engineering: '#8b5cf6',
    sales:       '#06b6d4',
    marketing:   '#ec4899',
  }
  const PERF_BEAT  = '#10b981'
  const PERF_HIT   = '#3b82f6'
  const PERF_NEAR  = '#f59e0b'
  const PERF_MISS  = '#ef4444'
  const CHAMPION   = '#eab308'
  const TOTAL_FG   = '#0f172a'

  function emptyRow(rn: number): Row {
    const r: Record<string, unknown> = { rn }
    for (const c of COL_LETTERS) r[c] = ''
    return r as Row
  }

  // Build the sheet with the KPI region in rows 1..16
  // Columns: A=team, B=Q1, C=Q2, D=Q3, E=Q4, F=Target
  function buildSeed(): Row[] {
    const out = Array.from({ length: TOTAL_ROWS }, (_, i) => emptyRow(i + 1))
    const set = (rowOneBased: number, col: ColKey, v: string | number) => {
      out[rowOneBased - 1]![col] = v
    }
    // Row 1 - title
    set(1, 'A', 'QUARTERLY KPI SCORECARD')
    // Row 2 - headers
    set(2, 'A', 'Team'); set(2, 'B', 'Q1'); set(2, 'C', 'Q2'); set(2, 'D', 'Q3'); set(2, 'E', 'Q4'); set(2, 'F', 'Target/Q')
    // Rows 3..6: Engineering header + 3 teams + subtotal
    set(3, 'A', 'Engineering')
    set(4, 'A', 'Platform team');  set(4, 'B', 1_240); set(4, 'C', 1_380); set(4, 'D', 1_510); set(4, 'E', 1_690); set(4, 'F', 1_500)
    set(5, 'A', 'Data team');      set(5, 'B',   980); set(5, 'C', 1_010); set(5, 'D', 1_140); set(5, 'E', 1_320); set(5, 'F', 1_200)
    set(6, 'A', 'Reliability');    set(6, 'B',   620); set(6, 'C',   590); set(6, 'D',   710); set(6, 'E',   650); set(6, 'F',   720)
    set(7, 'A', 'Engineering total')
    // Rows 8..11: Sales
    set(8, 'A', 'Sales')
    set(9,  'A', 'Enterprise');    set(9,  'B', 2_400); set(9,  'C', 2_650); set(9,  'D', 3_120); set(9,  'E', 3_780); set(9,  'F', 2_900)
    set(10, 'A', 'Mid-market');    set(10, 'B', 1_650); set(10, 'C', 1_580); set(10, 'D', 1_720); set(10, 'E', 1_840); set(10, 'F', 1_800)
    set(11, 'A', 'SMB');           set(11, 'B',   910); set(11, 'C',   780); set(11, 'D',   840); set(11, 'E',   720); set(11, 'F', 1_000)
    set(12, 'A', 'Sales total')
    // Rows 13..16: Marketing
    set(13, 'A', 'Marketing')
    set(14, 'A', 'Brand');         set(14, 'B',   320); set(14, 'C',   350); set(14, 'D',   410); set(14, 'E',   460); set(14, 'F',   400)
    set(15, 'A', 'Demand gen');    set(15, 'B',   540); set(15, 'C',   620); set(15, 'D',   590); set(15, 'E',   810); set(15, 'F',   650)
    set(16, 'A', 'Community');     set(16, 'B',   180); set(16, 'C',   210); set(16, 'D',   165); set(16, 'E',   140); set(16, 'F',   220)
    set(17, 'A', 'Marketing total')
    set(18, 'A', 'Company total')
    return out
  }

  let rows = $state<Row[]>(buildSeed())

  // Row classification (0-based engine indices).
  const ITEM_ROWS = {
    engineering: [3, 4, 5],
    sales:       [8, 9, 10],
    marketing:   [13, 14, 15],
  } as const
  const HEADER_ROWS = { engineering: 2, sales: 7, marketing: 12 }
  const SUBTOTAL_ROWS = { engineering: 6, sales: 11, marketing: 16 }
  const TOTAL_ROW = 17
  const QUARTERS: ColKey[] = ['B', 'C', 'D', 'E']
  const TARGET_COL: ColKey = 'F'

  function recompute() {
    const sums = {
      engineering: { B: 0, C: 0, D: 0, E: 0, F: 0 },
      sales:       { B: 0, C: 0, D: 0, E: 0, F: 0 },
      marketing:   { B: 0, C: 0, D: 0, E: 0, F: 0 },
    } as Record<Section, Record<'B'|'C'|'D'|'E'|'F', number>>
    for (const sec of ['engineering','sales','marketing'] as const) {
      for (const r of ITEM_ROWS[sec]) {
        for (const c of [...QUARTERS, TARGET_COL]) {
          const v = rows[r]![c]
          if (typeof v === 'number') sums[sec][c as 'B'|'C'|'D'|'E'|'F'] += v
        }
      }
      const subRow = rows[SUBTOTAL_ROWS[sec]]!
      for (const c of [...QUARTERS, TARGET_COL]) subRow[c] = sums[sec][c as 'B'|'C'|'D'|'E'|'F']
    }
    const totalRow = rows[TOTAL_ROW]!
    for (const c of [...QUARTERS, TARGET_COL]) {
      totalRow[c] = sums.engineering[c as 'B'|'C'|'D'|'E'|'F']
                  + sums.sales[c as 'B'|'C'|'D'|'E'|'F']
                  + sums.marketing[c as 'B'|'C'|'D'|'E'|'F']
    }
  }
  recompute()

  let api = $state<SvGridApi<typeof features, Row> | null>(null)

  function onCellValueChange(e: { rowIndex: number; columnId: string; newValue: unknown }) {
    const col = e.columnId as ColKey
    if (col === 'A') return // text column, no recompute needed
    const r = rows[e.rowIndex]!
    if (typeof e.newValue === 'string') {
      const n = Number(e.newValue.trim())
      if (Number.isFinite(n) && e.newValue.trim() !== '') (r as any)[col] = n
    }
    recompute()
    rows = [...rows]
  }

  const features = tableFeatures({})

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'rn', header: '', width: 56, align: 'center', editable: false,
      cellClass: 'sv-row-gutter',
      cell: (ctx) => renderSnippet(RowNumCell, { row: ctx.row.original }) },
    { field: 'A', header: 'A', width: 220, align: 'left', editorType: 'text',
      cell: (ctx) => renderSnippet(LabelCell, { row: ctx.row.original, value: ctx.row.original.A, rowIdx: ctx.row.index }) },
    ...(['B','C','D','E','F'] as const).map((c) => ({
      field: c,
      header: c,
      width: 110,
      align: 'right' as const,
      editorType: 'number' as const,
      cell: (ctx: { row: { original: Row; index: number } }) => renderSnippet(NumCell, {
        row: ctx.row.original, value: ctx.row.original[c], rowIdx: ctx.row.index,
      }),
    }) as ColumnDef<typeof features, Row>),
    ...(['G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'] as const).map((c) => ({
      field: c,
      header: c,
      width: 90,
      align: 'left' as const,
      editorType: 'text' as const,
    }) as ColumnDef<typeof features, Row>),
  ]
  const columnOrder = columns.map((c) => c.field as string)

  // ---- Border specs ------------------------------------------------
  function classifyRow(r: number): { section: Section | null; isHeader: boolean; isItem: boolean; isSubtotal: boolean; isTotal: boolean } {
    if (r === HEADER_ROWS.engineering) return { section: 'engineering', isHeader: true,  isItem: false, isSubtotal: false, isTotal: false }
    if (r === HEADER_ROWS.sales)       return { section: 'sales',       isHeader: true,  isItem: false, isSubtotal: false, isTotal: false }
    if (r === HEADER_ROWS.marketing)   return { section: 'marketing',   isHeader: true,  isItem: false, isSubtotal: false, isTotal: false }
    if (r === SUBTOTAL_ROWS.engineering) return { section: 'engineering', isHeader: false, isItem: false, isSubtotal: true, isTotal: false }
    if (r === SUBTOTAL_ROWS.sales)       return { section: 'sales',       isHeader: false, isItem: false, isSubtotal: true, isTotal: false }
    if (r === SUBTOTAL_ROWS.marketing)   return { section: 'marketing',   isHeader: false, isItem: false, isSubtotal: true, isTotal: false }
    if (r === TOTAL_ROW)                 return { section: null,          isHeader: false, isItem: false, isSubtotal: false, isTotal: true }
    for (const sec of ['engineering','sales','marketing'] as const) {
      if ((ITEM_ROWS[sec] as readonly number[]).includes(r)) return { section: sec, isHeader: false, isItem: true, isSubtotal: false, isTotal: false }
    }
    return { section: null, isHeader: false, isItem: false, isSubtotal: false, isTotal: false }
  }

  function perfBorder(actual: number, target: number) {
    if (target <= 0) return { width: 1, style: 'solid' as const, color: '#cbd5e1' }
    const ratio = actual / target
    if (ratio >= 1.10) return { width: 3, style: 'double' as const, color: PERF_BEAT }
    if (ratio >= 0.95) return { width: 2, style: 'solid'  as const, color: PERF_HIT  }
    if (ratio >= 0.85) return { width: 2, style: 'dotted' as const, color: PERF_NEAR }
    return                       { width: 2, style: 'dashed' as const, color: PERF_MISS }
  }

  const KPI_COLUMNS = ['A','B','C','D','E','F'] as const
  const borders = $derived.by<CellBorderSpec[]>(() => {
    const out: CellBorderSpec[] = []
    // Title row (row 0): heavy bottom across the KPI region
    for (const col of KPI_COLUMNS) {
      out.push({ rowIndex: 0, columnId: col, bottom: { width: 2, color: TOTAL_FG } })
    }
    // Header row (row 1): bottom border under column titles
    for (const col of KPI_COLUMNS) {
      out.push({ rowIndex: 1, columnId: col, bottom: { width: 2, color: '#94a3b8' } })
    }
    for (let r = 2; r <= 17; r += 1) {
      const cls = classifyRow(r)
      if (cls.isHeader && cls.section) {
        const c = SECTION_COLORS[cls.section]
        for (const col of KPI_COLUMNS) out.push({ rowIndex: r, columnId: col, bottom: { width: 3, color: c } })
      } else if (cls.isItem) {
        const target = typeof rows[r]![TARGET_COL] === 'number' ? rows[r]![TARGET_COL] as number : 0
        const championValue = Math.max(
          ...QUARTERS.map((q) => (typeof rows[r]![q] === 'number' ? rows[r]![q] as number : -Infinity)),
        )
        for (const q of QUARTERS) {
          const v = rows[r]![q]
          if (typeof v !== 'number') continue
          const b = perfBorder(v, target)
          const spec: CellBorderSpec = { rowIndex: r, columnId: q, bottom: b }
          if (v === championValue && target > 0) {
            spec.top    = { width: 3, style: 'solid', color: CHAMPION }
            spec.left   = { width: 3, style: 'solid', color: CHAMPION }
            spec.right  = { width: 3, style: 'solid', color: CHAMPION }
            spec.bottom = { width: 3, style: 'solid', color: CHAMPION }
          }
          out.push(spec)
        }
      } else if (cls.isSubtotal && cls.section) {
        const c = SECTION_COLORS[cls.section]
        for (const col of KPI_COLUMNS) {
          out.push({
            rowIndex: r, columnId: col,
            top:    { width: 1, style: 'solid', color: c },
            bottom: { width: 2, style: 'solid', color: c },
          })
        }
      } else if (cls.isTotal) {
        for (const col of KPI_COLUMNS) {
          out.push({
            rowIndex: r, columnId: col,
            top:    { width: 3, style: 'double', color: TOTAL_FG },
            bottom: { width: 2, style: 'solid',  color: TOTAL_FG },
          })
        }
      }
    }
    return out
  })

  function sectionAccent(s: Section): string { return SECTION_COLORS[s] }
</script>

{#snippet RowNumCell({ row }: { row: Row })}
  <span class="row-num">{row.rn}</span>
{/snippet}

{#snippet LabelCell({ row, value, rowIdx }: { row: Row; value: string | number; rowIdx: number })}
  {@const cls = classifyRow(rowIdx)}
  <span
    class="kpi-label"
    class:is-title={rowIdx === 0}
    class:is-header={cls.isHeader}
    class:is-item={cls.isItem}
    class:is-subtotal={cls.isSubtotal}
    class:is-total={cls.isTotal}
    style:--accent={cls.section ? sectionAccent(cls.section) : '#0f172a'}
  >{value}</span>
{/snippet}

{#snippet NumCell({ row, value, rowIdx }: { row: Row; value: string | number; rowIdx: number })}
  {@const cls = classifyRow(rowIdx)}
  {#if typeof value === 'number' && Number.isFinite(value)}
    <span
      class:cell-subtotal={cls.isSubtotal}
      class:cell-total={cls.isTotal}
    >{Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)}</span>
  {:else}
    <span>{value === '' ? '' : value}</span>
  {/if}
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3 no-zebra">
  <header>
    <h2 class="text-base font-semibold">Per-cell borders on a real spreadsheet</h2>
    <p class="text-xs mt-1" style="color: var(--sg-muted);">
      Spreadsheet shell: row numbers 1..{TOTAL_ROWS}, columns A..Z. Rows 1..18 hold a KPI
      scorecard. Edit any team's quarter or target value (columns B..F) - subtotals
      recompute and <code>spreadsheetLayout</code> repaints the borders:
      <strong>green double</strong> = beat by 10%+, blue solid = hit, amber dotted = near
      miss, red dashed = bad miss. The best quarter on each row gets a colored full frame.
    </p>
  </header>

  <div class="legend">
    <span class="legend-swatch swatch-beat"></span><span>Beat target +10%</span>
    <span class="legend-swatch swatch-hit"></span><span>Hit target</span>
    <span class="legend-swatch swatch-near"></span><span>Slightly missed</span>
    <span class="legend-swatch swatch-miss"></span><span>Badly missed</span>
    <span class="legend-swatch swatch-champion"></span><span>Best quarter</span>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="kpi-wrap"
    bind:this={gridWrapper}
    onclick={maybeRefocusGrid}
    use:spreadsheetLayout={{ borders, columnOrder }}
  >
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      sortable={false}
      filterable={false}
      selectionMode="cell"
      showColumnFilters={false}
      showRowSelection={false}
      enableInlineEditing={true}
      enableCellSelection={true}
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
  .kpi-wrap {
    flex: 1;
    min-height: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    overflow: hidden;
    background: var(--sg-bg, #ffffff);
  }

  /* Row-number gutter: cell is interactive so :hover fires + the
     row-resize strip works, but every visual side-effect of selecting
     it is suppressed (no ring, no fill handle, no range tint). */
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
  /* Hide the column-menu hamburger + sort + filter triggers on the
     row-header column header. */
  :global([data-svgrid-header-col="rn"] .sv-grid-col-menu-btn),
  :global([data-svgrid-header-col="rn"] .sv-grid-col-filter-btn),
  :global([data-svgrid-header-col="rn"] .sv-grid-header-sort) {
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
  .legend {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 14px;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    padding: 6px 10px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
    background: var(--sg-header-bg, #f8fafc);
  }
  .legend-swatch {
    display: inline-block;
    width: 22px;
    height: 0;
    margin-right: 4px;
  }
  .swatch-beat     { border-bottom: 3px double #10b981; }
  .swatch-hit      { border-bottom: 2px solid  #3b82f6; }
  .swatch-near     { border-bottom: 2px dotted #f59e0b; }
  .swatch-miss     { border-bottom: 2px dashed #ef4444; }
  .swatch-champion { height: 10px; width: 14px; border: 2px solid #eab308; margin-right: 4px; }

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
  :global(.kpi-label) { color: var(--sg-fg, #0f172a); font-size: 13px; }
  :global(.kpi-label.is-title) {
    font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
    font-size: 12px; color: var(--sg-fg, #0f172a);
  }
  :global(.kpi-label.is-header) {
    font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;
    font-size: 11px; color: var(--accent, #64748b);
  }
  :global(.kpi-label.is-item)     { padding-left: 14px; color: var(--sg-fg, #334155); }
  :global(.kpi-label.is-subtotal) {
    font-weight: 700; padding-left: 14px; color: var(--accent, #0f172a);
  }
  :global(.kpi-label.is-total)    {
    font-weight: 800; font-size: 13.5px; color: var(--sg-fg, #0f172a);
  }
  :global(.cell-subtotal) { font-weight: 700; }
  :global(.cell-total)    { font-weight: 800; }
</style>
