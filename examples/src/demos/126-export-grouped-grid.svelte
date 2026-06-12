<script lang="ts">
  /**
   * 126. Export grouped grid to Excel (Pro)
   * ---------------------------------------
   * A regular grouped grid (Region → Country → Sales rep) wired to
   * Pro's `api.exportData({ format: 'xlsx' })`. The exporter keeps the
   * group structure: each group becomes a header row, each leaf row
   * keeps its parent labels in the dim columns, and the subtotal /
   * grand-total math is materialised so the xlsx round-trips into
   * Excel as a navigable, sortable, filterable workbook.
   *
   *   - Group by chip toolbar - the same setGroupBy api the demo grid
   *     uses also drives which grouping is exported.
   *   - "Export options" panel: include grand total, include subtotals,
   *     style the group rows in bold + accent fill, flat vs outline
   *     export format.
   *   - Live "preview" panel shows the exact rows that will be written
   *     to the workbook so you can verify the shape before clicking
   *     Export.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    rowExpandingFeature,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-community'
  import {
    installPro,
    setLicenseKey,
    type ProGridApi,
  } from 'sv-grid-pro'

  setLicenseKey('SVPRO-DEV-DEMO')

  // ---- Domain --------------------------------------------------------
  type Region = 'AMER' | 'EMEA' | 'APAC'
  type Deal = {
    id: string
    region: Region
    country: string
    rep: string
    product: 'Cloud' | 'Pipeline' | 'AI' | 'Security'
    amount: number
    closeDate: string
    stage: 'Won' | 'Negotiation' | 'Proposal' | 'Discovery'
  }
  const TOPO: Record<Region, string[]> = {
    AMER: ['USA', 'Canada', 'Mexico'],
    EMEA: ['Germany', 'UK', 'France'],
    APAC: ['Japan', 'India', 'Australia'],
  }
  const REPS = [
    'Ada Lovelace', 'Linus Torvalds', 'Grace Hopper', 'Donald Knuth',
    'Tim Berners-Lee', 'Linda Petersen', 'Sven Andersson', 'Anders Hejlsberg',
    'Yuki Tanaka', 'Mei Chen', 'Raj Patel', 'Jin Park',
  ]
  const PRODUCTS = ['Cloud', 'Pipeline', 'AI', 'Security'] as const
  const STAGES = ['Won', 'Negotiation', 'Proposal', 'Discovery'] as const
  let prng = 0xE7E417ED >>> 0
  function rnd(): number { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }
  function pad(n: number): string { return String(n).padStart(2, '0') }

  function seed(): Deal[] {
    const out: Deal[] = []
    let id = 1
    for (const region of Object.keys(TOPO) as Region[]) {
      for (const country of TOPO[region]) {
        const n = 12 + Math.floor(rnd() * 24)
        for (let i = 0; i < n; i += 1) {
          const m = 1 + Math.floor(rnd() * 12)
          const d = 1 + Math.floor(rnd() * 27)
          out.push({
            id: `D-${pad(id++)}`,
            region, country,
            rep: pick(REPS),
            product: pick(PRODUCTS),
            amount: Math.round(2_500 + rnd() * 96_500),
            closeDate: `2026-${pad(m)}-${pad(d)}`,
            stage: pick(STAGES),
          })
        }
      }
    }
    return out
  }
  const deals: Deal[] = seed()

  // ---- Grid setup ----------------------------------------------------
  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    rowExpandingFeature,
  })
  const columns: ColumnDef<typeof features, Deal>[] = [
    { field: 'region',    header: 'Region',    width: 90  },
    { field: 'country',   header: 'Country',   width: 110 },
    { field: 'rep',       header: 'Sales rep', width: 170 },
    { field: 'product',   header: 'Product',   width: 110 },
    { field: 'stage',     header: 'Stage',     width: 130 },
    { field: 'closeDate', header: 'Close date', width: 110, format: { type: 'date', pattern: 'y-m-d' } },
    { field: 'amount',    header: 'Amount',    width: 120, align: 'right',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
  ]

  let api = $state<ProGridApi<typeof features, Deal> | null>(null)
  let groupBy = $state<string[]>(['region', 'country'])
  function applyGroup(by: string[]) {
    groupBy = by
    api?.setGroupBy(by)
  }
  function onApiReady(next: SvGridApi<typeof features, Deal>) {
    api = installPro(next)
    api.setGroupBy(groupBy)
  }

  // ---- Export options -------------------------------------------------
  let includeSubtotals = $state(true)
  let includeGrand     = $state(true)
  let styleGroups      = $state(true)
  let outlineFormat    = $state<'flat' | 'outline'>('outline')
  let exporting        = $state(false)
  let lastExport       = $state<string | null>(null)
  let exportError      = $state<string | null>(null)

  /** Build the exact row list the xlsx will receive. Walks the grouped
   *  deal set by hand so the demo can show a faithful preview of the
   *  workbook BEFORE the user clicks export. */
  type ExportRow = Record<string, unknown> & { __kind: 'group' | 'subtotal' | 'leaf' | 'grand'; __depth: number }
  const exportRows = $derived.by(() => {
    const out: ExportRow[] = []
    /** Recursive group walk over the (possibly nested) groupBy spec. */
    function walk(items: Deal[], levels: string[], parentLabels: Record<string, string>, depth: number): void {
      if (levels.length === 0) {
        for (const d of items) {
          out.push({
            __kind: 'leaf',
            __depth: depth,
            ...(outlineFormat === 'flat' ? parentLabels : {}),
            id: d.id, region: d.region, country: d.country, rep: d.rep,
            product: d.product, stage: d.stage, closeDate: d.closeDate, amount: d.amount,
          })
        }
        return
      }
      const [key, ...rest] = levels
      const buckets = new Map<string, Deal[]>()
      for (const d of items) {
        const v = String((d as unknown as Record<string, unknown>)[key!] ?? '')
        const list = buckets.get(v) ?? []
        list.push(d); buckets.set(v, list)
      }
      const sortedKeys = Array.from(buckets.keys()).sort()
      for (const groupKey of sortedKeys) {
        const groupItems = buckets.get(groupKey)!
        const labels = { ...parentLabels, [key!]: groupKey }
        // Group row
        out.push({
          __kind: 'group',
          __depth: depth,
          id: '',
          region:  labels['region']  ?? '',
          country: labels['country'] ?? '',
          rep:     labels['rep']     ?? '',
          product: '',
          stage:   '',
          closeDate: '',
          amount:  '',
        })
        walk(groupItems, rest, labels, depth + 1)
        if (includeSubtotals) {
          const subtotal = groupItems.reduce((a, d) => a + d.amount, 0)
          out.push({
            __kind: 'subtotal',
            __depth: depth,
            id: '',
            region:  key === 'region'  ? `${groupKey} total` : labels['region']  ?? '',
            country: key === 'country' ? `${groupKey} total` : labels['country'] ?? '',
            rep:     key === 'rep'     ? `${groupKey} total` : labels['rep']     ?? '',
            product: '', stage: '', closeDate: '',
            amount: subtotal,
          })
        }
      }
    }
    walk(deals, groupBy, {}, 0)
    if (includeGrand) {
      const grand = deals.reduce((a, d) => a + d.amount, 0)
      out.push({
        __kind: 'grand',
        __depth: 0,
        id: '', region: 'GRAND TOTAL', country: '', rep: '', product: '', stage: '', closeDate: '',
        amount: grand,
      })
    }
    return out
  })

  // ---- Export columns ------------------------------------------------
  const exportColumns = [
    { field: 'region',    header: 'Region'     },
    { field: 'country',   header: 'Country'    },
    { field: 'rep',       header: 'Sales rep'  },
    { field: 'product',   header: 'Product'    },
    { field: 'stage',     header: 'Stage'      },
    { field: 'closeDate', header: 'Close date' },
    { field: 'amount',    header: 'Amount'     },
  ]

  // ---- Style hints ---------------------------------------------------
  /** Pro's exporter accepts a `styles` payload mirroring ExportStyles:
   *  headerRow / rows / rowAlternate / cells. Per-row conditional tints
   *  (group vs leaf) aren't a first-class feature; we use a zebra
   *  rowAlternate to give the workbook visible row banding and a
   *  bold header. The richer per-kind styling lives in the preview
   *  panel below, which exists exactly to communicate that the xlsx
   *  cells will be plain. */
  const exportStyles = $derived.by(() => {
    if (!styleGroups) return undefined
    return {
      headerRow: {
        backgroundColor: '#e0e7ff',
        color: '#3730a3',
        fontWeight: 'bold' as const,
        textAlign: 'left' as const,
      },
      rowAlternate: { backgroundColor: '#f8fafc' },
    }
  })

  async function exportXlsx() {
    if (!api) return
    exporting = true
    exportError = null
    lastExport = null
    try {
      await api.exportData({
        format: 'xlsx',
        filename: `deals-grouped-${groupBy.join('-') || 'flat'}`,
        columns: exportColumns,
        rows: exportRows as never,
        ...(exportStyles ? { styles: exportStyles } : {}),
      })
      const counts = countRowKinds(exportRows)
      lastExport = `Exported ${exportRows.length} rows (${counts.leaf} deals · ${counts.group} groups · ${counts.subtotal} subtotals${counts.grand > 0 ? ' · 1 grand total' : ''})`
    } catch (e) {
      exportError = e instanceof Error ? e.message : String(e)
      console.error('[grouped export]', e)
    } finally {
      exporting = false
    }
  }
  function countRowKinds(rows: ExportRow[]): Record<'leaf'|'group'|'subtotal'|'grand', number> {
    const out = { leaf: 0, group: 0, subtotal: 0, grand: 0 }
    for (const r of rows) out[r.__kind] += 1
    return out
  }

  function fmtMoney(n: number | string | unknown): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return ''
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }
</script>

<section class="ex-shell flex flex-col flex-1 min-h-0 gap-3">
  <header class="ex-head">
    <h2>Export grouped grid to Excel</h2>
    <p>
      A grouped sales grid (Region → Country) wired to Pro's
      <code>api.exportData(&#123; format: 'xlsx' &#125;)</code>. Group rows, per-group subtotals, and
      a grand total are all materialised into the workbook so the file opens
      in Excel as a navigable, sortable, filterable table.
    </p>
  </header>

  <div class="ex-toolbar">
    <div class="ex-group-by">
      <span class="ex-label">Group by:</span>
      <button class="ex-chip" class:on={groupBy.length === 0}                   onclick={() => applyGroup([])}>None</button>
      <button class="ex-chip" class:on={groupBy.join() === 'region'}            onclick={() => applyGroup(['region'])}>Region</button>
      <button class="ex-chip" class:on={groupBy.join() === 'region,country'}    onclick={() => applyGroup(['region', 'country'])}>Region → Country</button>
      <button class="ex-chip" class:on={groupBy.join() === 'region,country,rep'} onclick={() => applyGroup(['region', 'country', 'rep'])}>Region → Country → Rep</button>
    </div>
    <div class="ex-actions">
      <button
        type="button"
        class="ex-export"
        disabled={exporting || api === null}
        onclick={exportXlsx}
      >
        {exporting ? 'Exporting…' : '⬇ Export to xlsx'}
      </button>
      {#if lastExport}<span class="ex-msg ok">{lastExport}</span>{/if}
      {#if exportError}<span class="ex-msg err">{exportError}</span>{/if}
    </div>
  </div>

  <div class="ex-options">
    <label class="ex-opt"><input type="checkbox" bind:checked={includeSubtotals} /> Include subtotals</label>
    <label class="ex-opt"><input type="checkbox" bind:checked={includeGrand}     /> Include grand total</label>
    <label class="ex-opt"><input type="checkbox" bind:checked={styleGroups}      /> Header fill + zebra rows</label>
    <div class="ex-seg">
      <button class:active={outlineFormat === 'outline'} onclick={() => (outlineFormat = 'outline')}>Outline (Excel-style)</button>
      <button class:active={outlineFormat === 'flat'}    onclick={() => (outlineFormat = 'flat')}>Flat (repeat parents)</button>
    </div>
  </div>

  <div class="ex-split flex flex-1 min-h-0 gap-3">
    <div class="ex-grid-wrap flex-1 min-w-0">
      <SvGrid
        data={deals}
        {columns}
        {features}
        showRowSelection={false}
        showPagination={false}
        showGroupingControls={true}
        enableInlineEditing={false}
        enableCellSelection={true}
        enableRowSummaries={true}
        rowHeight={32}
        containerHeight="100%"
        fitColumns={true}
        {onApiReady}
      />
    </div>

    <aside class="ex-preview">
      <div class="ex-preview-head">
        <span class="ex-preview-eyebrow">Workbook preview</span>
        <span class="ex-preview-count">{exportRows.length} rows</span>
      </div>
      <div class="ex-preview-body">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Region</th>
              <th>Country</th>
              <th>Rep</th>
              <th>Product</th>
              <th class="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {#each exportRows.slice(0, 80) as r, i (i)}
              <tr class={`ex-row-${r.__kind}`}>
                <td class="ex-row-n">{i + 1}</td>
                <td>{String(r.region ?? '')}</td>
                <td>{String(r.country ?? '')}</td>
                <td>{String(r.rep ?? '')}</td>
                <td>{String(r.product ?? '')}</td>
                <td class="right">{typeof r.amount === 'number' ? fmtMoney(r.amount) : ''}</td>
              </tr>
            {/each}
            {#if exportRows.length > 80}
              <tr class="ex-row-overflow"><td colspan="6">… {exportRows.length - 80} more rows in xlsx</td></tr>
            {/if}
          </tbody>
        </table>
      </div>
    </aside>
  </div>
</section>

<style>
  .ex-shell { min-height: 0; }
  .ex-head h2 { font-size: 16px; font-weight: 700; margin: 0; }
  .ex-head p  { margin: 4px 0 0; font-size: 12.5px; color: var(--sg-muted, #64748b); max-width: 80ch; }
  .ex-head code {
    background: var(--sg-header-bg, #f1f5f9);
    padding: 1px 4px; border-radius: 3px;
    font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11.5px;
  }

  .ex-toolbar {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; flex-wrap: wrap;
    padding: 10px 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    background: var(--sg-bg, #ffffff);
    flex-shrink: 0;
  }
  .ex-group-by { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .ex-label { font-size: 12px; font-weight: 600; color: var(--sg-fg, #1e293b); }
  .ex-chip {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    padding: 4px 10px; border-radius: 999px;
    font-size: 11.5px; cursor: pointer;
    color: var(--sg-fg, #1e293b);
  }
  .ex-chip.on {
    background: var(--sg-accent, #2563eb);
    border-color: var(--sg-accent, #2563eb);
    color: #fff;
  }
  .ex-actions { display: flex; align-items: center; gap: 10px; }
  .ex-export {
    border: 1px solid #16a34a;
    background: #16a34a;
    color: #fff;
    padding: 6px 14px; border-radius: 6px;
    font-size: 12.5px; font-weight: 700; cursor: pointer;
  }
  .ex-export:hover:not(:disabled) { filter: brightness(1.05); }
  .ex-export:disabled { opacity: 0.5; cursor: default; }
  .ex-msg { font-size: 11.5px; }
  .ex-msg.ok  { color: #15803d; font-weight: 600; }
  .ex-msg.err { color: #b91c1c; font-weight: 600; }
  :global([data-theme='dark']) .ex-msg.ok  { color: #4ade80; }
  :global([data-theme='dark']) .ex-msg.err { color: #f87171; }

  .ex-options {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    padding: 6px 12px;
    border: 1px dashed var(--sg-border, #e2e8f0);
    border-radius: 6px;
    flex-shrink: 0;
    font-size: 12px;
  }
  .ex-opt { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
  .ex-seg {
    display: inline-flex;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 5px; overflow: hidden;
    margin-left: auto;
  }
  .ex-seg button {
    border: 0; background: transparent;
    padding: 4px 10px; font-size: 11px;
    cursor: pointer; color: var(--sg-fg, #1e293b);
  }
  .ex-seg button.active { background: var(--sg-accent, #2563eb); color: #fff; font-weight: 700; }

  .ex-split { min-height: 0; }
  .ex-grid-wrap {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }

  .ex-preview {
    width: 420px; flex-shrink: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .ex-preview-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc);
  }
  :global([data-theme='dark']) .ex-preview-head { background: rgba(148,163,184,0.10); }
  .ex-preview-eyebrow {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b); font-weight: 700;
  }
  .ex-preview-count {
    font-size: 11px; color: var(--sg-muted, #64748b);
    font-variant-numeric: tabular-nums;
  }
  .ex-preview-body { flex: 1; overflow: auto; }
  .ex-preview-body table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  .ex-preview-body th, .ex-preview-body td {
    padding: 3px 8px; border-bottom: 1px solid var(--sg-border, #f1f5f9);
    text-align: left; white-space: nowrap;
  }
  :global([data-theme='dark']) .ex-preview-body th,
  :global([data-theme='dark']) .ex-preview-body td { border-color: rgba(148,163,184,0.18); }
  .ex-preview-body th {
    background: var(--sg-header-bg, #f8fafc);
    font-weight: 700; color: var(--sg-muted, #64748b);
    position: sticky; top: 0;
  }
  .ex-preview-body .right { text-align: right; font-variant-numeric: tabular-nums; }
  .ex-row-n { color: var(--sg-muted, #64748b); width: 30px; }
  .ex-row-leaf { color: var(--sg-fg, #1e293b); }
  .ex-row-group {
    background: rgba(99,102,241,0.10);
    font-weight: 700; color: #3730a3;
  }
  .ex-row-subtotal {
    background: rgba(14,165,233,0.10);
    font-weight: 700; color: #1e40af;
  }
  .ex-row-grand {
    background: rgba(245,158,11,0.18);
    font-weight: 800; color: #854d0e;
  }
  :global([data-theme='dark']) .ex-row-group    { color: #c7d2fe; }
  :global([data-theme='dark']) .ex-row-subtotal { color: #93c5fd; }
  :global([data-theme='dark']) .ex-row-grand    { color: #fcd34d; }
  .ex-row-overflow td {
    text-align: center; font-style: italic; color: var(--sg-muted, #64748b);
    padding: 8px 0;
  }
</style>
