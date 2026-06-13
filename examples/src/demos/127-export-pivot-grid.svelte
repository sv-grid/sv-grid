<script lang="ts">
  /**
   * 127. Export pivot grid to Excel (Pro)
   * -------------------------------------
   * `createPivotModel` produces flat `PivotRow[]` with one numeric
   * value per leaf column id. The exporter accepts any row+column shape
   * - so a pivot grid round-trips into a workbook in two steps:
   *
   *   1. Project each PivotRow into a flat `Record<string, value>` whose
   *      keys are the FINAL column headers ("AMER · Q1 · Revenue")
   *      instead of the engine's internal ids ("pv__AMER__Q1__m0").
   *   2. Pass the result to `api.exportData({ format: 'xlsx',
   *      columns, rows })`.
   *
   * The toolbar at the top lets you toggle each axis of the export:
   *   - include / exclude subtotal rows
   *   - include / exclude the grand total row
   *   - include / exclude the grand total column
   *   - one sheet OR one sheet per top-level row group (Pro
   *     multi-sheet export)
   *   - custom filename + filename strategy ("snake_case" / "kebab"
   *     / "title")
   *
   * Every option is shown live in the "Workbook preview" panel on the
   * right so the user sees what the xlsx will contain BEFORE clicking
   * Export.
   */
  import {
    SvGrid,
    tableFeatures,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-community'
  import {
    createPivotModel,
    installPro,
    setLicenseKey,
    type ProGridApi,
    type PivotRow,
    type PivotValueConfig,
  } from 'sv-grid-pro'

  setLicenseKey('SVPRO-DEV-DEMO')

  // ---- Domain --------------------------------------------------------
  type Region = 'AMER' | 'EMEA' | 'APAC'
  type Fact = {
    region: Region
    country: string
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
    revenue: number
    units: number
  }
  const TOPO: Record<Region, string[]> = {
    AMER: ['USA', 'Canada', 'Mexico'],
    EMEA: ['Germany', 'UK', 'France'],
    APAC: ['Japan', 'India', 'Australia'],
  }
  let prng = 0xEEE7E777 >>> 0
  function rnd(): number { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function seed(): Fact[] {
    const out: Fact[] = []
    for (const region of Object.keys(TOPO) as Region[]) {
      for (const country of TOPO[region]) {
        for (const q of ['Q1', 'Q2', 'Q3', 'Q4'] as Fact['quarter'][]) {
          for (let i = 0; i < 8; i += 1) {
            out.push({
              region, country, quarter: q,
              revenue: Math.round(4_000 + rnd() * 96_000),
              units:   Math.round(1 + rnd() * 80),
            })
          }
        }
      }
    }
    return out
  }
  const facts: Fact[] = seed()

  // ---- Export options ------------------------------------------------
  let includeSubtotals = $state(true)
  let includeGrandRow  = $state(true)
  let includeGrandCol  = $state(true)
  let multiSheet       = $state<'single' | 'per-region'>('single')
  let filename         = $state('quarterly-revenue')
  let exporting        = $state(false)
  let lastExport       = $state<string | null>(null)
  let exportError      = $state<string | null>(null)

  // ---- Pivot model (config tracks the user's toggles) ----------------
  const features = tableFeatures({})
  const values: PivotValueConfig<Fact>[] = [
    { field: 'revenue', agg: 'sum', label: 'Revenue' },
    { field: 'units',   agg: 'sum', label: 'Units'   },
  ]
  const pivot = $derived(createPivotModel<typeof features, Fact>(facts, {
    rows: ['region', 'country'],
    cols: ['quarter'],
    values,
    grandTotalRow: includeGrandRow,
    grandTotalCol: includeGrandCol,
    rowSubtotals: includeSubtotals,
  }))

  // ---- Pro install ---------------------------------------------------
  let api = $state<ProGridApi<typeof features, PivotRow> | null>(null)
  function onApiReady(next: SvGridApi<typeof features, PivotRow>) {
    api = installPro(next)
  }

  // ---- Grid columns (purely visual; the exporter builds its own) -----
  const columns = $derived(pivot.columns.map((c, i) => {
    if (i === 0) {
      return {
        ...c,
        width: 220,
        cell: (ctx) => renderSnippet(LabelCell, { row: ctx.row.original }),
      } as ColumnDef<typeof features, PivotRow>
    }
    return decorate(c) as ColumnDef<typeof features, PivotRow>
  }))
  function decorate(c: ColumnDef<typeof features, PivotRow>): ColumnDef<typeof features, PivotRow> {
    if (c.columns?.length) return { ...c, columns: c.columns.map(decorate) }
    const id = c.id ?? ''
    return {
      ...c,
      width: 110,
      align: 'right',
      cell: (ctx) => fmtCell(Number(ctx.row.original[id] ?? 0), id),
      cellClass: (ctx) => kindClass(ctx.row.original),
    }
  }
  function kindClass(row: PivotRow): string {
    if (row.__pivotKind === 'grandTotal') return 'pv-row-grand'
    if (row.__pivotKind === 'group')      return 'pv-row-group'
    return ''
  }
  function fmtCell(v: number, id: string): string {
    if (!Number.isFinite(v) || v === 0) return ''
    const isUnits = id.endsWith('__m1')
    if (isUnits) return v.toLocaleString('en-US')
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000)     return `$${Math.round(v / 1_000)}k`
    return `$${Math.round(v)}`
  }

  // ---- Export-shaped column list -------------------------------------
  /** Walk the engine's column tree and produce flat ExportColumn[] -
   *  one per leaf, with a HUMAN-READABLE label built from the parent
   *  chain (e.g. "Q1 · Revenue", "Total · Revenue"). */
  type LeafCol = { id: string; header: string }
  const exportLeafCols = $derived.by(() => {
    const out: LeafCol[] = []
    function walk(c: ColumnDef<typeof features, PivotRow>, path: string[]) {
      if (c.columns && c.columns.length > 0) {
        const label = String(c.header ?? c.id ?? '')
        // The engine's grand-total group is just labelled "Total" so it
        // joins naturally into "Total · Revenue".
        for (const child of c.columns) walk(child, [...path, label])
        return
      }
      const measureLabel = String(c.header ?? c.id ?? '')
      const header = path.length > 0 ? `${path.join(' · ')} · ${measureLabel}` : measureLabel
      out.push({ id: c.id ?? '', header })
    }
    for (let i = 1; i < pivot.columns.length; i += 1) walk(pivot.columns[i]!, [])
    return out
  })

  /** Build the rows the exporter will receive: one row per visible
   *  PivotRow, with the row dim columns (Region, Country, Kind) at the
   *  front and every leaf column value promoted up.
   *
   *  Only LEAF rows are emitted - Smart's groupBy: ['region'] will
   *  wrap them in native Excel outline groups, and the engine's own
   *  subtotal / grand rows are skipped (they'd double-count under the
   *  outline). */
  const exportRows = $derived.by(() => {
    const byId = new Map(pivot.rows.map((x) => [x.__pivotId, x] as const))
    function chainOf(r: PivotRow): string[] {
      const out: string[] = []
      let cur: PivotRow | undefined = r
      while (cur) {
        out.unshift(String(cur.__pivotLabel))
        const pid: string | null = cur.__pivotParentId
        cur = pid ? byId.get(pid) : undefined
      }
      return out
    }
    return pivot.rows
      .filter((r) => r.__pivotKind === 'leaf' || r.__pivotKind === 'grandTotal')
      .map((r) => {
        const chain = chainOf(r)
        const row: Record<string, unknown> = {
          kind: r.__pivotKind,
          region:  r.__pivotKind === 'grandTotal' ? 'GRAND TOTAL' : chain[0] ?? '',
          country: r.__pivotKind === 'grandTotal' ? '' : chain[1] ?? '',
        }
        for (const lc of exportLeafCols) {
          const v = r[lc.id]
          row[lc.header] = typeof v === 'number' ? Math.round(v * 1000) / 1000 : v ?? ''
        }
        return row
      })
  })
  const exportColumns = $derived.by(() => {
    const base = [
      { field: 'region',  header: 'Region'  },
      { field: 'country', header: 'Country' },
      { field: 'kind',    header: 'Kind'    },
    ]
    return [
      ...base,
      ...exportLeafCols.map((lc) => ({ field: lc.header, header: lc.header })),
    ]
  })

  // ---- Per-region sheet builder --------------------------------------
  type SheetEntry = { label: string; rows: ReadonlyArray<Record<string, unknown>> }
  const exportSheets = $derived.by<SheetEntry[]>(() => {
    if (multiSheet !== 'per-region') return []
    const byRegion = new Map<string, Record<string, unknown>[]>()
    for (const r of exportRows) {
      const region = String(r.region ?? '')
      if (!region || r.kind === 'grandTotal') continue
      const list = byRegion.get(region) ?? []
      list.push(r); byRegion.set(region, list)
    }
    return Array.from(byRegion.entries()).map(([region, rows]) => ({
      label: region,
      rows,
    }))
  })

  function deriveFilename(base: string): string {
    const cleaned = base.trim() || 'pivot'
    return cleaned.replace(/[^a-z0-9_-]+/gi, '-')
  }

  const previewRows = $derived(
    multiSheet === 'per-region' ? (exportSheets[0]?.rows ?? []) : exportRows
  )

  // ---- Export driver -------------------------------------------------
  async function exportXlsx() {
    if (!api) return
    exporting = true
    exportError = null
    lastExport = null
    try {
      if (multiSheet === 'per-region' && exportSheets.length > 0) {
        await api.exportData({
          format: 'xlsx',
          filename: deriveFilename(filename),
          sheets: exportSheets.map((s) => ({
            label: s.label,
            rows: s.rows as never,
            columns: exportColumns,
          })) as never,
        })
        lastExport = `Exported ${exportSheets.length} sheets (${exportSheets.map((s) => s.label).join(', ')})`
      } else {
        await api.exportData({
          format: 'xlsx',
          filename: deriveFilename(filename),
          columns: exportColumns,
          rows: exportRows as never,
          // Smart's native row-outline grouping: each region becomes
          // an Excel outline group with a +/- button in the row header.
          groupBy: ['region'],
        })
        lastExport = `Exported ${exportRows.length} rows · ${exportColumns.length} columns (Excel outline rows grouped by Region)`
      }
    } catch (e) {
      exportError = e instanceof Error ? e.message : String(e)
      console.error('[pivot export]', e)
    } finally {
      exporting = false
    }
  }
</script>

{#snippet LabelCell(props: { row: PivotRow })}
  {@const row = props.row}
  <span class="pv-label"
        style={`padding-left: ${Math.max(0, row.__pivotDepth - 1) * 14 + 6}px`}>
    {#if row.__pivotKind === 'grandTotal'}
      <strong>Grand total</strong>
    {:else if row.__pivotKind === 'group'}
      <strong>{row.__pivotLabel}</strong>
    {:else}
      <span>{row.__pivotLabel}</span>
    {/if}
  </span>
{/snippet}

<section class="ep-shell flex flex-col flex-1 min-h-0 gap-3">
  <header class="ep-head">
    <h2>Export pivot grid to Excel</h2>
    <p>
      Pro's exporter takes whatever rows + columns you hand it - the demo
      walks <code>pivot.columns</code> to derive readable header labels
      ("Q1 · Revenue" instead of "pv__Q1__m0") and projects every visible
      PivotRow into that shape before calling
      <code>api.exportData(&#123; format: 'xlsx' &#125;)</code>. Toggle the options
      below and watch the workbook preview update live.
    </p>
  </header>

  <div class="ep-toolbar">
    <div class="ep-opts">
      <label class="ep-opt"><input type="checkbox" bind:checked={includeSubtotals} /> Subtotals</label>
      <label class="ep-opt"><input type="checkbox" bind:checked={includeGrandRow}  /> Grand row</label>
      <label class="ep-opt"><input type="checkbox" bind:checked={includeGrandCol}  /> Grand column</label>
      <span class="ep-divider" aria-hidden="true"></span>
      <span class="ep-label">Workbook:</span>
      <div class="ep-seg">
        <button class:active={multiSheet === 'single'}     onclick={() => (multiSheet = 'single')}>Single sheet</button>
        <button class:active={multiSheet === 'per-region'} onclick={() => (multiSheet = 'per-region')}>One sheet per region</button>
      </div>
      <span class="ep-divider" aria-hidden="true"></span>
      <span class="ep-label">File:</span>
      <input class="ep-input" type="text" bind:value={filename} placeholder="quarterly-revenue" />
    </div>
    <div class="ep-actions">
      <button
        type="button"
        class="ep-export"
        disabled={exporting || api === null}
        onclick={exportXlsx}
      >
        {exporting ? 'Exporting…' : '⬇ Export to xlsx'}
      </button>
      {#if lastExport}<span class="ep-msg ok">{lastExport}</span>{/if}
      {#if exportError}<span class="ep-msg err">{exportError}</span>{/if}
    </div>
  </div>

  <div class="ep-split flex flex-1 min-h-0 gap-3">
    <div class="ep-grid-wrap flex-1 min-w-0">
      <SvGrid
        data={pivot.rows}
        {columns}
        {features}
        showRowSelection={false}
        showPagination={false}
        enableInlineEditing={false}
        enableCellSelection={false}
        rowHeight={32}
        containerHeight="100%"
        fitColumns={false}
        {onApiReady}
      />
    </div>

    <aside class="ep-preview">
      <div class="ep-preview-head">
        <span class="ep-preview-eyebrow">Workbook preview</span>
        {#if multiSheet === 'per-region'}
          <span class="ep-preview-count">{exportSheets.length} sheets · {exportSheets.reduce((a, s) => a + s.rows.length, 0)} rows</span>
        {:else}
          <span class="ep-preview-count">{exportRows.length} rows · {exportColumns.length} cols</span>
        {/if}
      </div>

      {#if multiSheet === 'per-region'}
        <div class="ep-tab-strip">
          {#each exportSheets as s, i (s.label)}
            <span class="ep-tab" class:active={i === 0}>{s.label}</span>
          {/each}
        </div>
      {/if}

      <div class="ep-preview-body">
        <table>
          <thead>
            <tr>
              {#each exportColumns.slice(0, 6) as c (c.field)}
                <th class:right={c.field !== 'region' && c.field !== 'country' && c.field !== 'kind'}>{c.header}</th>
              {/each}
              {#if exportColumns.length > 6}
                <th class="ep-overflow">… +{exportColumns.length - 6}</th>
              {/if}
            </tr>
          </thead>
          <tbody>
            {#each previewRows.slice(0, 40) as r, i (i)}
              <tr class={`ep-row-${r.kind}`}>
                {#each exportColumns.slice(0, 6) as c (c.field)}
                  {@const v = r[c.field]}
                  <td class:right={c.field !== 'region' && c.field !== 'country' && c.field !== 'kind'}>
                    {typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : String(v ?? '')}
                  </td>
                {/each}
                {#if exportColumns.length > 6}
                  <td class="ep-overflow">…</td>
                {/if}
              </tr>
            {/each}
            {#if previewRows.length > 40}
              <tr class="ep-row-overflow"><td colspan={Math.min(exportColumns.length, 7)}>… {previewRows.length - 40} more rows in xlsx</td></tr>
            {/if}
          </tbody>
        </table>
      </div>
    </aside>
  </div>
</section>

<style>
  .ep-shell { min-height: 0; }
  .ep-head h2 { font-size: 16px; font-weight: 700; margin: 0; }
  .ep-head p  { margin: 4px 0 0; font-size: 12.5px; color: var(--sg-muted, #64748b); max-width: 80ch; }
  .ep-head code {
    background: var(--sg-header-bg, #f1f5f9);
    padding: 1px 4px; border-radius: 3px;
    font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11.5px;
  }

  .ep-toolbar {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; flex-wrap: wrap;
    padding: 10px 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    background: var(--sg-bg, #ffffff);
    flex-shrink: 0;
  }
  .ep-opts { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .ep-opt { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer; }
  .ep-label { font-size: 12px; font-weight: 600; color: var(--sg-fg, #1e293b); }
  .ep-divider { width: 1px; height: 18px; background: var(--sg-border, #e2e8f0); }
  .ep-seg {
    display: inline-flex;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 5px; overflow: hidden;
  }
  .ep-seg button {
    border: 0; background: transparent;
    padding: 4px 10px; font-size: 11px;
    cursor: pointer; color: var(--sg-fg, #1e293b);
  }
  .ep-seg button.active { background: var(--sg-accent, #2563eb); color: #fff; font-weight: 700; }
  .ep-input {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    border-radius: 5px;
    padding: 4px 8px; font-size: 12px;
    width: 180px;
  }

  .ep-actions { display: flex; align-items: center; gap: 10px; }
  .ep-export {
    border: 1px solid #16a34a;
    background: #16a34a;
    color: #fff;
    padding: 6px 14px; border-radius: 6px;
    font-size: 12.5px; font-weight: 700; cursor: pointer;
  }
  .ep-export:hover:not(:disabled) { filter: brightness(1.05); }
  .ep-export:disabled { opacity: 0.5; cursor: default; }
  .ep-msg { font-size: 11.5px; }
  .ep-msg.ok  { color: #15803d; font-weight: 600; }
  .ep-msg.err { color: #b91c1c; font-weight: 600; }
  :global([data-theme='dark']) .ep-msg.ok  { color: #4ade80; }
  :global([data-theme='dark']) .ep-msg.err { color: #f87171; }

  .ep-split { min-height: 0; }
  .ep-grid-wrap {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }

  .ep-preview {
    width: 460px; flex-shrink: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .ep-preview-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc);
  }
  :global([data-theme='dark']) .ep-preview-head { background: rgba(148,163,184,0.10); }
  .ep-preview-eyebrow {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b); font-weight: 700;
  }
  .ep-preview-count { font-size: 11px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .ep-tab-strip {
    display: flex; gap: 0;
    padding: 0 8px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc);
    overflow-x: auto;
  }
  :global([data-theme='dark']) .ep-tab-strip { background: rgba(148,163,184,0.10); }
  .ep-tab {
    padding: 5px 10px; font-size: 11px; cursor: default;
    color: var(--sg-muted, #64748b);
    border-bottom: 2px solid transparent;
  }
  .ep-tab.active {
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #1e293b);
    font-weight: 700;
    border-bottom-color: var(--sg-accent, #2563eb);
  }
  .ep-preview-body { flex: 1; overflow: auto; }
  .ep-preview-body table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .ep-preview-body th, .ep-preview-body td {
    padding: 3px 8px; border-bottom: 1px solid var(--sg-border, #f1f5f9);
    text-align: left; white-space: nowrap;
  }
  :global([data-theme='dark']) .ep-preview-body th,
  :global([data-theme='dark']) .ep-preview-body td { border-color: rgba(148,163,184,0.18); }
  .ep-preview-body th {
    background: var(--sg-header-bg, #f8fafc);
    font-weight: 700; color: var(--sg-muted, #64748b);
    position: sticky; top: 0;
  }
  .ep-preview-body .right { text-align: right; font-variant-numeric: tabular-nums; }
  .ep-overflow { color: var(--sg-muted, #94a3b8); font-style: italic; }

  .ep-row-leaf { color: var(--sg-fg, #1e293b); }
  .ep-row-group {
    background: rgba(99,102,241,0.10);
    font-weight: 700; color: #3730a3;
  }
  .ep-row-grandTotal {
    background: rgba(245,158,11,0.18);
    font-weight: 800; color: #854d0e;
  }
  :global([data-theme='dark']) .ep-row-group      { color: #c7d2fe; }
  :global([data-theme='dark']) .ep-row-grandTotal { color: #fcd34d; }
  .ep-row-overflow td {
    text-align: center; font-style: italic; color: var(--sg-muted, #64748b);
    padding: 8px 0;
  }

  /* Grid pivot row tints */
  :global(.pv-label) { display: inline-flex; align-items: center; font-size: 12.5px; }
  :global(.pv-row-group) { background: rgba(99,102,241,0.10) !important; font-weight: 700; }
  :global(.pv-row-grand) { background: rgba(245,158,11,0.18) !important; font-weight: 800; color: #854d0e; }
  :global([data-theme='dark']) :global(.pv-row-grand) { color: #fcd34d; }
</style>
