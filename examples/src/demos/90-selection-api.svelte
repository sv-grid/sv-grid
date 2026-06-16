<script lang="ts">
  /**
   * 90. Selection API + events
   * --------------------------
   * Drives cell selection programmatically and observes changes via the
   * `onCellSelectionChange` event:
   *
   *   - `api.selectCells([[r1, c1, r2, c2]])` - select a rectangle
   *   - `api.getSelected()`                   - read the current rectangles
   *   - `onCellSelectionChange={(ranges) => …}` - subscribe to changes
   *
   * Try the toolbar buttons (programmatic) and also drag a range with
   * the mouse (user-driven). Both paths fire the same event.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-core'

  type Row = {
    id: number
    company: string
    sector: string
    region: 'NA' | 'EMEA' | 'APAC'
    ceo: string
    marketCap: number   // $M
    revenue: number     // $M
    employees: number
    pe: number
  }

  const COMPANIES = [
    ['Apple',          'Tech',      'NA',   'Tim Cook',          3_100_000,  394_328,  164_000, 32.4],
    ['Microsoft',      'Tech',      'NA',   'Satya Nadella',     3_050_000,  211_915,  221_000, 34.2],
    ['NVIDIA',         'Tech',      'NA',   'Jensen Huang',      2_950_000,   60_922,   29_600, 75.1],
    ['Alphabet',       'Tech',      'NA',   'Sundar Pichai',     2_100_000,  307_394,  182_502, 26.8],
    ['Amazon',         'Retail',    'NA',   'Andy Jassy',        1_900_000,  574_785, 1_525_000, 51.9],
    ['Saudi Aramco',   'Energy',    'EMEA', 'Amin Nasser',       1_840_000,  494_891,   73_311, 16.7],
    ['Meta',           'Tech',      'NA',   'Mark Zuckerberg',   1_240_000,  134_902,   67_317, 28.9],
    ['Berkshire H.',   'Finance',   'NA',   'Warren Buffett',      870_000,  302_089,  396_500, 9.6],
    ['Eli Lilly',      'Pharma',    'NA',   'David Ricks',         765_000,   34_124,   43_000, 132.8],
    ['TSMC',           'Tech',      'APAC', 'C.C. Wei',            720_000,   69_298,   76_478, 21.4],
    ['JPMorgan Chase', 'Finance',   'NA',   'Jamie Dimon',         580_000,  154_792,  309_926, 11.8],
    ['Tesla',          'Auto',      'NA',   'Elon Musk',           560_000,   96_773,  140_473, 65.2],
    ['Visa',           'Finance',   'NA',   'Ryan McInerney',      550_000,   32_653,   28_800, 30.1],
    ['Walmart',        'Retail',    'NA',   'Doug McMillon',       540_000,  648_125, 2_100_000, 30.9],
    ['Novo Nordisk',   'Pharma',    'EMEA', 'Lars F. Jorgensen',   520_000,   33_700,   64_319, 41.7],
    ['Mastercard',     'Finance',   'NA',   'Michael Miebach',     420_000,   25_098,   33_400, 38.4],
    ['LVMH',           'Luxury',    'EMEA', 'Bernard Arnault',     400_000,   91_822,  213_523, 25.6],
    ['Samsung',        'Tech',      'APAC', 'Han Jong-hee',        390_000,  198_456,  267_860, 16.9],
    ['ASML',           'Tech',      'EMEA', 'Christophe Fouquet',  340_000,   30_124,   42_544, 39.2],
    ['Toyota',         'Auto',      'APAC', 'Koji Sato',           310_000,  311_823,  375_235, 9.4],
  ] as const

  let rows = $state<Row[]>(COMPANIES.map((c, i) => ({
    id: i + 1,
    company: c[0], sector: c[1], region: c[2] as Row['region'], ceo: c[3],
    marketCap: c[4], revenue: c[5], employees: c[6], pe: c[7],
  })))

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Row> | null>(null)

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'id',         header: '#',          width: 60,  editable: false, align: 'right' },
    { field: 'company',    header: 'Company',    width: 160 },
    { field: 'sector',     header: 'Sector',     width: 110 },
    { field: 'region',     header: 'Region',     width: 90,
      cellClass: (ctx) => `region-${String(ctx.getValue()).toLowerCase()}` },
    { field: 'ceo',        header: 'CEO',        width: 180 },
    { field: 'marketCap',  header: 'Market Cap', width: 140, align: 'right',
      format: { type: 'number', options: { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 } } },
    { field: 'revenue',    header: 'Revenue',    width: 130, align: 'right',
      format: { type: 'number', options: { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 } } },
    { field: 'employees',  header: 'Employees',  width: 130, align: 'right',
      format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'pe',         header: 'P/E',        width: 90,  align: 'right',
      format: { type: 'number', options: { maximumFractionDigits: 1 } } },
  ]
  const COLUMN_IDS = columns.map((c) => c.field as string)

  // ---- Live state mirrored from the event -------------------------------
  type Range = [number, number, number, number]
  let currentRange = $state<Range | null>(null)

  type Event = { at: string; range: Range | null; source: string }
  let log = $state<Event[]>([])
  let logSource = $state<string>('init')

  function push(source: string, ranges: Range[]) {
    const now = new Date()
    const at = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`
    currentRange = ranges[0] ?? null
    log = [{ at, range: currentRange, source }, ...log].slice(0, 12)
  }

  function onCellSelectionChange(ranges: Range[]) {
    push(logSource, ranges)
    logSource = 'mouse / keyboard'
  }

  // ---- Programmatic actions ---------------------------------------------
  function selectColumn(field: string) {
    const col = COLUMN_IDS.indexOf(field)
    if (col < 0) return
    logSource = `selectCells - column "${field}"`
    api?.selectCells([[0, col, rows.length - 1, col]])
  }
  function selectRow(rowIndex: number) {
    logSource = `selectCells - row ${rowIndex + 1}`
    api?.selectCells([[rowIndex, 0, rowIndex, COLUMN_IDS.length - 1]])
  }
  function selectAll() {
    logSource = 'selectCells - whole grid'
    api?.selectCells([[0, 0, rows.length - 1, COLUMN_IDS.length - 1]])
  }
  function selectMetrics() {
    const first = COLUMN_IDS.indexOf('marketCap')
    const last = COLUMN_IDS.indexOf('pe')
    logSource = 'selectCells - "Market Cap → P/E" for top 5'
    api?.selectCells([[0, first, 4, last]])
  }
  function selectTopMover() {
    // Top 3 tech companies by market cap.
    const top = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.sector === 'Tech')
      .sort((a, b) => b.r.marketCap - a.r.marketCap)
      .slice(0, 3)
      .map((x) => x.i)
    if (top.length === 0) return
    const r1 = Math.min(...top); const r2 = Math.max(...top)
    logSource = 'selectCells - top-3 Tech rows'
    api?.selectCells([[r1, 1, r2, COLUMN_IDS.length - 1]])
  }
  function clearSelection() {
    logSource = 'selectCells - clear'
    api?.selectCells([])
  }

  function readSelection() {
    const sel = api?.getSelected() ?? []
    if (sel.length === 0) { alert('Nothing selected. Drag a range or click a programmatic button first.'); return }
    const [r1, c1, r2, c2] = sel[0]!
    const cellCount = (r2 - r1 + 1) * (c2 - c1 + 1)
    const colNames = COLUMN_IDS.slice(c1, c2 + 1).map((f) => columns.find((c) => c.field === f)?.header).join(', ')
    alert(`api.getSelected() returned 1 rectangle:\n  rows ${r1 + 1}-${r2 + 1}\n  cols: ${colNames}\n  ${cellCount} cell${cellCount === 1 ? '' : 's'} total`)
  }

  function copyTsv() {
    const sel = api?.getSelected() ?? []
    if (sel.length === 0) return
    const [r1, c1, r2, c2] = sel[0]!
    const lines: string[] = []
    for (let r = r1; r <= r2; r++) {
      const cells: string[] = []
      for (let c = c1; c <= c2; c++) {
        const v = api?.getCellValue(r, COLUMN_IDS[c]!)
        cells.push(v == null ? '' : String(v))
      }
      lines.push(cells.join('\t'))
    }
    navigator.clipboard?.writeText(lines.join('\n'))
    logSource = 'copyTsv - via getSelected + getCellValue'
    push(logSource, sel)
  }

  // ---- Derived KPI panel --------------------------------------------------
  const summary = $derived.by(() => {
    const r = currentRange
    if (!r) return null
    const [r1, c1, r2, c2] = r
    const cellCount = (r2 - r1 + 1) * (c2 - c1 + 1)
    let sum = 0; let count = 0; let min = Infinity; let max = -Infinity
    for (let row = r1; row <= r2; row++) {
      for (let col = c1; col <= c2; col++) {
        const v = api?.getCellValue(row, COLUMN_IDS[col]!)
        if (typeof v === 'number' && Number.isFinite(v)) {
          sum += v; count++
          if (v < min) min = v
          if (v > max) max = v
        }
      }
    }
    return {
      cellCount,
      rowCount: r2 - r1 + 1,
      colCount: c2 - c1 + 1,
      sum: count > 0 ? sum : null,
      avg: count > 0 ? sum / count : null,
      min: count > 0 ? min : null,
      max: count > 0 ? max : null,
      numericCells: count,
    }
  })

  const fmtN = (n: number) =>
    Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M`
    : Math.abs(n) >= 1_000   ? `${(n / 1_000).toFixed(1)}k`
                             : `${n.toFixed(1)}`
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <!-- Toolbar ------------------------------------------------------------ -->
  <div class="toolbar shrink-0">
    <div class="tb-group">
      <span class="tb-label">selectCells:</span>
      <button class="tb-btn" type="button" onclick={() => selectColumn('marketCap')}>Market Cap column</button>
      <button class="tb-btn" type="button" onclick={() => selectColumn('revenue')}>Revenue column</button>
      <button class="tb-btn" type="button" onclick={() => selectRow(0)}>Row 1 (Apple)</button>
      <button class="tb-btn" type="button" onclick={selectMetrics}>Top 5 × Metrics</button>
      <button class="tb-btn" type="button" onclick={selectTopMover}>Top 3 Tech rows</button>
      <button class="tb-btn" type="button" onclick={selectAll}>Whole grid</button>
      <button class="tb-btn danger" type="button" onclick={clearSelection}>Clear</button>
    </div>
    <div class="tb-group">
      <span class="tb-label">getSelected:</span>
      <button class="tb-btn primary" type="button" onclick={readSelection}>Inspect rectangle</button>
      <button class="tb-btn primary" type="button" onclick={copyTsv}>Copy as TSV</button>
    </div>
  </div>

  <!-- Live selection panel ----------------------------------------------- -->
  <div class="panels shrink-0">
    <div class="panel">
      <div class="panel-head">Live selection</div>
      <div class="panel-body">
        {#if currentRange}
          <div class="ls-grid">
            <div><span class="ls-label">Rows</span><span class="ls-value">{currentRange[0] + 1} - {currentRange[2] + 1}</span></div>
            <div><span class="ls-label">Cols</span><span class="ls-value">{currentRange[1] + 1} - {currentRange[3] + 1}</span></div>
            <div><span class="ls-label">Cells</span><span class="ls-value">{summary?.cellCount ?? 0}</span></div>
            <div><span class="ls-label">Numeric</span><span class="ls-value">{summary?.numericCells ?? 0}</span></div>
          </div>
          {#if summary && summary.sum !== null}
            <div class="ls-stats">
              <span><strong>SUM</strong> {fmtN(summary.sum)}</span>
              <span><strong>AVG</strong> {fmtN(summary.avg!)}</span>
              <span><strong>MIN</strong> {fmtN(summary.min!)}</span>
              <span><strong>MAX</strong> {fmtN(summary.max!)}</span>
            </div>
          {/if}
        {:else}
          <div class="ls-empty">No selection. Drag a range, or use a toolbar button.</div>
        {/if}
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">onCellSelectionChange events</div>
      <div class="panel-body">
        {#if log.length === 0}
          <div class="ls-empty">No events fired yet. Drag or click a toolbar button.</div>
        {:else}
          <ul class="ev-list">
            {#each log as e (e.at + e.source)}
              <li class="ev">
                <span class="ev-time">{e.at}</span>
                <span class="ev-source">{e.source}</span>
                <span class="ev-range">
                  {#if e.range}
                    [{e.range[0]}, {e.range[1]}, {e.range[2]}, {e.range[3]}]
                  {:else}
                    cleared
                  {/if}
                </span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </div>

  <!-- Grid --------------------------------------------------------------- -->
  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={32}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
      {onCellSelectionChange}
    />
  </div>
</section>

<style>
  /* Toolbar */
  .toolbar {
    display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    padding: 8px 12px;
  }
  .tb-group { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .tb-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--sg-muted, #64748b);
    padding-right: 4px;
  }
  .tb-btn {
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px;
    padding: 5px 10px; font-size: 12px; font-weight: 600;
    cursor: pointer;
  }
  .tb-btn:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.1)); }
  .tb-btn.primary {
    background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
    border-color: transparent;
  }
  .tb-btn.primary:hover { filter: brightness(1.1); }
  .tb-btn.danger { color: #b91c1c; border-color: #fecaca; }
  .tb-btn.danger:hover { background: #fef2f2; }

  /* Side-by-side panels */
  .panels { display: grid; grid-template-columns: 1fr 1.4fr; gap: 12px; }
  .panel {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; overflow: hidden;
  }
  .panel-head {
    padding: 8px 12px; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(180deg,
      color-mix(in oklab, #6366f1 4%, transparent),
      transparent);
  }
  .panel-body { padding: 10px 12px; }
  .ls-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 12px; }
  .ls-label { display: block; font-size: 10px; text-transform: uppercase;
              letter-spacing: 0.05em; color: var(--sg-muted, #64748b); }
  .ls-value { display: block; font-size: 16px; font-weight: 700;
              font-variant-numeric: tabular-nums; color: var(--sg-fg, #0f172a); }
  .ls-stats {
    display: flex; gap: 14px; flex-wrap: wrap;
    margin-top: 10px; padding-top: 10px;
    border-top: 1px dashed var(--sg-border, #e2e8f0);
    font-size: 12px; color: var(--sg-fg, #0f172a);
    font-variant-numeric: tabular-nums;
  }
  .ls-stats strong { color: #6366f1; font-weight: 800; margin-right: 4px;
                     font-size: 10px; letter-spacing: 0.06em; }
  .ls-empty { font-size: 12px; font-style: italic; color: var(--sg-muted, #64748b); }

  .ev-list { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none;
             max-height: 132px; overflow-y: auto; }
  .ev {
    display: grid; grid-template-columns: 90px 1fr auto; gap: 8px;
    align-items: center; padding: 3px 6px;
    border-radius: 4px; font-size: 12px;
  }
  .ev:first-child { background: color-mix(in oklab, #6366f1 8%, transparent); }
  .ev-time { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
             font-size: 11px; color: var(--sg-muted, #64748b); }
  .ev-source { font-weight: 600; color: var(--sg-fg, #0f172a); overflow: hidden;
               text-overflow: ellipsis; white-space: nowrap; }
  .ev-range { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              font-size: 11px; color: #6366f1; font-weight: 700; }

  :global(td.region-na)   { color: #6366f1; font-weight: 600; }
  :global(td.region-emea) { color: #14b8a6; font-weight: 600; }
  :global(td.region-apac) { color: #ec4899; font-weight: 600; }
</style>
