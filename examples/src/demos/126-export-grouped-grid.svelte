<script lang="ts">
  /**
   * 126. Export grouped grid to Excel (Pro)
   * ---------------------------------------
   * A flat sales grid grouped by Region (and optionally Country),
   * exported with Smart's native row-outline grouping:
   *
   *   await api.exportData({
   *     format: 'xlsx',
   *     filename: 'deals',
   *     groupBy: ['region', 'country'],   // ← outline rows in xlsx
   *   })
   *
   * The exporter wraps every cluster of rows in an Excel outline row
   * with the +/- expand button - the file opens in Excel with native
   * Data → Outline behavior, no extra rows materialized by hand.
   *
   * The toolbar lets the user pick grouping levels (None / Region /
   * Region → Country / Region → Country → Rep), and the preview panel
   * mirrors what the exported workbook will contain.
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
  } from '@svgrid/grid'
  import {
    installEnterprise,
    setLicenseKey,
    type EnterpriseGridApi,
  } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-DEMO')

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

  let api = $state<EnterpriseGridApi<typeof features, Deal> | null>(null)
  let groupBy = $state<string[]>(['region', 'country'])
  function applyGroup(by: string[]) {
    groupBy = by
    api?.setGroupBy(by)
  }
  function onApiReady(next: SvGridApi<typeof features, Deal>) {
    api = installEnterprise(next)
    api.setGroupBy(groupBy)
  }

  // ---- Export options -------------------------------------------------
  let zebra      = $state(true)
  let exporting  = $state(false)
  let lastExport = $state<string | null>(null)
  let exportError = $state<string | null>(null)

  /** Same column-field mapping the grid uses - the exporter projects
   *  each row to these fields in order. */
  const exportColumns = [
    { field: 'region',    header: 'Region'     },
    { field: 'country',   header: 'Country'    },
    { field: 'rep',       header: 'Sales rep'  },
    { field: 'product',   header: 'Product'    },
    { field: 'stage',     header: 'Stage'      },
    { field: 'closeDate', header: 'Close date' },
    { field: 'amount',    header: 'Amount'     },
  ]
  /** Sort deals by the groupBy fields so groups are contiguous - Smart
   *  expects each group's rows to come together in the input stream. */
  const sortedDeals = $derived.by(() => {
    if (groupBy.length === 0) return deals
    return [...deals].sort((a, b) => {
      for (const k of groupBy) {
        const av = String((a as unknown as Record<string, unknown>)[k] ?? '')
        const bv = String((b as unknown as Record<string, unknown>)[k] ?? '')
        if (av < bv) return -1
        if (av > bv) return 1
      }
      return 0
    })
  })

  /** Group counts for the preview panel + status note. */
  const groupCounts = $derived.by(() => {
    if (groupBy.length === 0) return [] as Array<{ label: string; count: number }>
    const counts = new Map<string, number>()
    for (const d of sortedDeals) {
      const key = groupBy.map((k) => String((d as unknown as Record<string, unknown>)[k] ?? '')).join(' / ')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.entries()).map(([label, count]) => ({ label, count }))
  })

  async function exportXlsx() {
    if (!api) return
    exporting = true
    exportError = null
    lastExport = null
    try {
      const styles = zebra
        ? {
            headerRow: {
              backgroundColor: '#e0e7ff',
              color: '#3730a3',
              fontWeight: 'bold' as const,
              textAlign: 'left' as const,
            },
            rowAlternate: { backgroundColor: '#f8fafc' },
          }
        : undefined
      await api.exportData({
        format: 'xlsx',
        filename: `deals-grouped-${groupBy.join('-') || 'flat'}`,
        columns: exportColumns,
        rows: sortedDeals,
        // Smart's NATIVE Excel outline rows. Open the file in Excel
        // and the +/- buttons appear in the row header gutter for
        // every group level. No manually-materialised subtotal rows.
        ...(groupBy.length > 0 ? { groupBy } : {}),
        ...(styles ? { styles } : {}),
      })
      lastExport =
        groupBy.length > 0
          ? `Exported ${sortedDeals.length} rows in ${groupCounts.length} groups (Excel outline rows enabled)`
          : `Exported ${sortedDeals.length} flat rows`
    } catch (e) {
      exportError = e instanceof Error ? e.message : String(e)
      console.error('[grouped export]', e)
    } finally {
      exporting = false
    }
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
      Wired to Pro's new <code>groupBy</code> export option, which maps straight to
      Smart DataExporter's native row-outline grouping. The xlsx opens in
      Excel with the +/- outline buttons in the row header gutter at every
      group level - no manually-emitted subtotal rows, the exporter wraps
      each cluster of rows automatically.
    </p>
  </header>

  <div class="ex-toolbar">
    <div class="ex-group-by">
      <span class="ex-label">Group by:</span>
      <button class="ex-chip" class:on={groupBy.length === 0}                    onclick={() => applyGroup([])}>None</button>
      <button class="ex-chip" class:on={groupBy.join() === 'region'}             onclick={() => applyGroup(['region'])}>Region</button>
      <button class="ex-chip" class:on={groupBy.join() === 'region,country'}     onclick={() => applyGroup(['region', 'country'])}>Region → Country</button>
      <button class="ex-chip" class:on={groupBy.join() === 'region,country,rep'} onclick={() => applyGroup(['region', 'country', 'rep'])}>Region → Country → Rep</button>
    </div>
    <div class="ex-actions">
      <label class="ex-opt"><input type="checkbox" bind:checked={zebra} /> Header fill + zebra rows</label>
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

  <div class="ex-split flex flex-1 min-h-0 gap-3">
    <div class="ex-grid-wrap flex-1 min-w-0">
      <SvGrid responsive={true}
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
        <span class="ex-preview-eyebrow">Export shape</span>
        <span class="ex-preview-count">{sortedDeals.length} rows · {groupCounts.length || 0} groups</span>
      </div>
      <div class="ex-preview-body">
        {#if groupBy.length === 0}
          <p class="ex-preview-empty">
            Flat export - every deal becomes one xlsx row, no grouping.
          </p>
        {:else}
          <p class="ex-preview-empty">
            Each cluster below becomes one collapsible outline row in the
            xlsx. The header row gutter in Excel will show ▲/▼ buttons to
            fold groups at each level.
          </p>
          <ul class="ex-group-list">
            {#each groupCounts.slice(0, 30) as g (g.label)}
              <li class="ex-group-li">
                <span class="ex-group-name">{g.label}</span>
                <span class="ex-group-count">{g.count} rows</span>
              </li>
            {/each}
            {#if groupCounts.length > 30}
              <li class="ex-group-overflow">… +{groupCounts.length - 30} more groups</li>
            {/if}
          </ul>
        {/if}

        <div class="ex-snippet-block">
          <div class="ex-snippet-title">Call</div>
          <pre class="ex-snippet"><code>{`await api.exportData({
  format: 'xlsx',
  filename: 'deals-grouped',
  columns: [/* 7 fields */],
  rows: sortedDeals,${groupBy.length > 0 ? `\n  groupBy: ${JSON.stringify(groupBy)},` : ''}${zebra ? '\n  styles: { headerRow, rowAlternate },' : ''}
})`}</code></pre>
        </div>
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
  .ex-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .ex-opt { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer; }
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

  .ex-split { min-height: 0; }
  .ex-grid-wrap {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }

  .ex-preview {
    width: 380px; flex-shrink: 0;
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
  .ex-preview-count { font-size: 11px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .ex-preview-body { flex: 1; overflow: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
  .ex-preview-empty { font-size: 12px; color: var(--sg-muted, #64748b); margin: 0; line-height: 1.5; }
  .ex-group-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 3px; }
  .ex-group-li {
    display: grid; grid-template-columns: 1fr auto; gap: 8px;
    align-items: center;
    padding: 4px 8px;
    border-radius: 5px;
    background: rgba(99,102,241,0.06);
    font-size: 11.5px;
  }
  :global([data-theme='dark']) .ex-group-li { background: rgba(99,102,241,0.14); }
  .ex-group-name { font-weight: 600; }
  .ex-group-count { font-size: 10.5px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .ex-group-overflow {
    text-align: center; font-style: italic; font-size: 11px;
    color: var(--sg-muted, #64748b); padding: 4px 0;
    list-style: none;
  }

  .ex-snippet-block {
    border-top: 1px dashed var(--sg-border, #e2e8f0);
    padding-top: 10px;
  }
  .ex-snippet-title {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b); font-weight: 700; margin-bottom: 6px;
  }
  .ex-snippet {
    margin: 0; padding: 8px 10px;
    background: #0f172a; color: #e2e8f0;
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 11px;
    line-height: 1.5;
    overflow: auto;
  }
</style>
