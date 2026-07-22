<script lang="ts">
  /**
   * 122. Pivot - Drill-through (Pro)
   * --------------------------------
   * Click any aggregated pivot cell, the right rail opens with the exact
   * source rows that contributed to that aggregation. The drill-through
   * is computed against the raw fact table by walking the clicked row's
   * ancestor labels (dimensions in `layout.rows`) and decoding the
   * column id into the column-axis dimensions + measure. The numbers on
   * the right always agree with the cell on the left because both
   * summarise the same filtered fact slice.
   *
   * Works for leaf cells AND subtotals AND the grand-total row: drilling
   * a region row returns every fact across that region, drilling the
   * grand-total returns the entire dataset.
   *
   * Built on `<SvPivotDesigner>` - the designer handles the wells,
   * field rail, presets, totals toggles, and the expand chevron; this
   * demo just wires `onCellClick` to open the drill rail.
   */
  import {
    SvGrid,
    tableFeatures,
    type ColumnDef,
  } from '@svgrid/grid'
  import {
    SvPivotDesigner,
    setLicenseKey,
    type PivotField,
    type PivotLayout,
    type PivotRow,
  } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-DEMO')

  // ---- Domain ---------------------------------------------------------
  type Region = 'AMER' | 'EMEA' | 'APAC'
  type Channel = 'Online' | 'Retail' | 'Wholesale'
  type Fact = {
    id: number
    date: string         // ISO yyyy-mm-dd
    year: number
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
    region: Region
    country: string
    city: string
    channel: Channel
    customer: string
    revenue: number
    units: number
  }

  const TOPO: Record<Region, Record<string, string[]>> = {
    AMER: { USA: ['New York', 'Austin', 'Seattle'], Canada: ['Toronto', 'Vancouver'] },
    EMEA: { Germany: ['Berlin', 'Munich'], UK: ['London', 'Manchester'], France: ['Paris'] },
    APAC: { Japan: ['Tokyo', 'Osaka'], India: ['Mumbai', 'Bangalore'] },
  }
  const CHANNELS: Channel[] = ['Online', 'Retail', 'Wholesale']
  const CUSTOMERS = [
    'Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Vandelay', 'Pied Piper',
    'Hooli', 'Stark Industries', 'Tyrell', 'Wayne Ent.', 'Wonka', 'Cyberdyne',
  ]
  let prng = 0xDA7A101
  function rnd(): number { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(a: readonly T[]): T { return a[Math.floor(rnd() * a.length)]! }

  function seed(): Fact[] {
    const out: Fact[] = []
    let id = 1
    for (let i = 0; i < 1800; i += 1) {
      const region = pick(['AMER','EMEA','APAC'] as const)
      const country = pick(Object.keys(TOPO[region]))
      const city = pick(TOPO[region][country]!)
      const year = pick([2025, 2026] as const)
      const q = pick(['Q1','Q2','Q3','Q4'] as const)
      const monthBase = q === 'Q1' ? 1 : q === 'Q2' ? 4 : q === 'Q3' ? 7 : 10
      const month = monthBase + Math.floor(rnd() * 3)
      const day = 1 + Math.floor(rnd() * 27)
      const revenue = Math.round(1500 + rnd() * 38_500)
      out.push({
        id: id++,
        date: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
        year, quarter: q,
        region, country, city,
        channel: pick(CHANNELS),
        customer: pick(CUSTOMERS),
        revenue,
        units: 1 + Math.floor(rnd() * 60),
      })
    }
    return out
  }
  const facts = seed()

  // ---- Designer wiring -----------------------------------------------
  const fields: PivotField<Fact>[] = [
    { field: 'region',   label: 'Region',   kind: 'dimension', group: 'Geography' },
    { field: 'country',  label: 'Country',  kind: 'dimension', group: 'Geography' },
    { field: 'city',     label: 'City',     kind: 'dimension', group: 'Geography' },
    { field: 'year',     label: 'Year',     kind: 'dimension', group: 'Time' },
    { field: 'quarter',  label: 'Quarter',  kind: 'dimension', group: 'Time' },
    { field: 'channel',  label: 'Channel',  kind: 'dimension', group: 'Sales' },
    { field: 'revenue',  label: 'Revenue',  kind: 'measure',   defaultAgg: 'sum',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'units',    label: 'Units',    kind: 'measure',   defaultAgg: 'sum' },
  ]
  let layout = $state<PivotLayout>({
    rows: ['region', 'country', 'city'],
    cols: ['year', 'quarter'],
    values: [
      { field: 'revenue', agg: 'sum', label: 'Revenue',
        format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
      { field: 'units',   agg: 'sum', label: 'Units' },
    ],
    filters: [],
    hideGrandTotals: false,
  })

  // ---- Drill: ancestor walk uses the LIVE layout dims ----------------
  /** Walk the clicked row up its parent chain and bucket each ancestor
   *  label by the matching row-axis dimension. The chain's ORDINAL
   *  position maps to layout.rows[i]. We can't key on `__pivotDepth`
   *  because the engine counts the synthetic root as level 0. */
  function rowFilterFor(row: PivotRow, allRows: PivotRow[]): Record<string, string> {
    if (row.__pivotKind === 'grandTotal') return {}
    const chain: PivotRow[] = []
    let cur: PivotRow | undefined = row
    while (cur) {
      chain.unshift(cur)
      const pid: string | null = cur.__pivotParentId
      cur = pid ? allRows.find((r) => r.__pivotId === pid) : undefined
    }
    const out: Record<string, string> = {}
    for (let i = 0; i < chain.length && i < layout.rows.length; i += 1) {
      out[layout.rows[i]!] = String(chain[i]!.__pivotLabel)
    }
    return out
  }
  /** Decode column id "pv__2026__Q2__m0" -> { year: '2026', quarter: 'Q2', mIdx: 0 }. */
  function colFilterFor(colId: string): { filter: Record<string, string>; measure: 'revenue' | 'units' } {
    const parts = colId.startsWith('pv__') ? colId.slice(4).split('__') : []
    const mIdx = parts.length && parts[parts.length - 1]!.startsWith('m')
      ? Number(parts[parts.length - 1]!.slice(1)) : 0
    const dimParts = parts.slice(0, parts.length - 1)
    const filter: Record<string, string> = {}
    for (let i = 0; i < dimParts.length && i < layout.cols.length; i += 1) {
      filter[layout.cols[i]!] = dimParts[i]!
    }
    const valueChip = layout.values[mIdx]
    const measure = (valueChip?.field as 'revenue' | 'units' | undefined) ?? 'revenue'
    return { filter, measure }
  }

  // ---- Drill state ----------------------------------------------------
  type Drill = {
    rowLabel: string
    colId: string
    rowFilter: Record<string, string>
    colFilter: Record<string, string>
    facts: Fact[]
    total: number
    measure: 'revenue' | 'units'
  }
  let drill = $state<Drill | null>(null)
  /** Cache of the last pivot rebuild so drill can walk parent chains. */
  let lastPivotRows = $state<PivotRow[]>([])

  function openDrill(row: PivotRow, colId: string) {
    const rf = rowFilterFor(row, lastPivotRows)
    const { filter: cf, measure } = colFilterFor(colId)
    const matched = facts.filter((f) => {
      for (const [k, v] of Object.entries(rf)) if (String((f as Record<string, unknown>)[k]) !== v) return false
      for (const [k, v] of Object.entries(cf)) if (String((f as Record<string, unknown>)[k]) !== v) return false
      return true
    })
    const total = matched.reduce((a, f) => a + (measure === 'units' ? f.units : f.revenue), 0)
    drill = {
      rowLabel: row.__pivotKind === 'grandTotal' ? 'Grand total' : String(row.__pivotLabel),
      colId, rowFilter: rf, colFilter: cf, facts: matched, total, measure,
    }
  }
  function closeDrill() { drill = null }

  function fmtMoney(n: number): string {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }
  function fmtNum(n: number): string { return n.toLocaleString('en-US') }

  const drillBreadcrumb = $derived.by(() => {
    if (!drill) return ''
    const parts: string[] = []
    for (const v of Object.values(drill.rowFilter)) parts.push(v)
    for (const v of Object.values(drill.colFilter)) parts.push(v)
    return parts.length ? parts.join(' · ') : 'All facts'
  })

  // ---- Drill-table columns (right rail) -------------------------------
  const drillFeatures = tableFeatures({})
  const drillCols: Array<ColumnDef<typeof drillFeatures, Fact>> = [
    { field: 'date',     header: 'Date',     width: 100, editable: false },
    { field: 'customer', header: 'Customer', width: 150, editable: false },
    { field: 'channel',  header: 'Channel',  width: 90,  editable: false },
    { field: 'revenue',  header: 'Revenue',  width: 110, editable: false, align: 'right',
      cell: (ctx) => fmtMoney(Number(ctx.getValue() ?? 0)) },
    { field: 'units',    header: 'Units',    width: 70,  editable: false, align: 'right' },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <header class="dt-header">
    <h2>Pivot - Drill-through</h2>
    <p>
      Click any value cell. The right rail shows the source facts behind the aggregation - the
      cell value equals the rail's total, always. Try a leaf, a subtotal, or the grand total
      row. The drill logic reads the LIVE layout's row + column dimensions, so it keeps working
      when you reshape the pivot in the wells.
    </p>
  </header>

  <div class="dt-split flex flex-1 min-h-0 gap-3">
    <div class={`dt-pivot-wrap flex-1 min-w-0 ${drill ? 'has-drill' : ''}`}>
      <SvPivotDesigner
        data={facts}
        {fields}
        bind:layout
        expandable
        onPivot={(rows) => { lastPivotRows = rows }}
        onCellClick={(e) => {
          if (e.columnId === '__pivotRowHeader') return
          openDrill(e.row, e.columnId)
        }}
      />
    </div>

    {#if drill}
      <aside class="dt-rail" aria-label="Drill-through panel">
        <div class="dt-rail-head">
          <div class="dt-rail-titles">
            <span class="dt-rail-eyebrow">Drill-through</span>
            <h3 class="dt-rail-title">{drillBreadcrumb}</h3>
          </div>
          <button type="button" class="dt-rail-close" onclick={closeDrill} aria-label="Close">×</button>
        </div>

        <div class="dt-rail-kpis">
          <div class="dt-kpi">
            <div class="dt-kpi-label">{drill.measure === 'units' ? 'Units' : 'Revenue'}</div>
            <div class="dt-kpi-value">{drill.measure === 'units' ? fmtNum(drill.total) : fmtMoney(drill.total)}</div>
          </div>
          <div class="dt-kpi">
            <div class="dt-kpi-label">Facts</div>
            <div class="dt-kpi-value">{fmtNum(drill.facts.length)}</div>
          </div>
          <div class="dt-kpi">
            <div class="dt-kpi-label">Avg / fact</div>
            <div class="dt-kpi-value">
              {#if drill.facts.length === 0}-
              {:else if drill.measure === 'units'}{fmtNum(Math.round(drill.total / drill.facts.length))}
              {:else}{fmtMoney(Math.round(drill.total / drill.facts.length))}
              {/if}
            </div>
          </div>
        </div>

        <div class="dt-rail-grid">
          <SvGrid responsive={true}
            data={drill.facts}
            columns={drillCols}
            features={drillFeatures}
            showRowSelection={false}
            showPagination={false}
            enableInlineEditing={false}
            enableCellSelection={false}
            rowHeight={28}
            containerHeight="100%"
            fitColumns={false}
          />
        </div>

        <div class="dt-rail-foot">
          Showing every source fact at this intersection. Reshape the pivot in the wells on the
          left - the drill recomputes against the new dimensions on the next click.
        </div>
      </aside>
    {/if}
  </div>
</section>

<style>
  .dt-header h2 { font-size: 16px; font-weight: 700; margin: 0; }
  .dt-header p  { margin: 4px 0 0; font-size: 12.5px; color: var(--sg-muted, #64748b); max-width: 80ch; }

  .dt-split { min-height: 0; }
  .dt-pivot-wrap {
    border: 0;
    overflow: hidden;
    transition: flex-basis 200ms ease;
  }
  .dt-pivot-wrap.has-drill { flex: 1; }

  .dt-rail {
    width: 420px;
    flex-shrink: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .dt-rail-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(14,165,233,0.06));
  }
  :global([data-theme='dark']) .dt-rail-head {
    background: linear-gradient(135deg, rgba(99,102,241,0.20), rgba(14,165,233,0.12));
  }
  .dt-rail-titles { display: flex; flex-direction: column; min-width: 0; }
  .dt-rail-eyebrow {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b); font-weight: 700;
  }
  .dt-rail-title {
    margin: 2px 0 0; font-size: 14px; font-weight: 700;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .dt-rail-close {
    border: 0; background: transparent;
    font-size: 18px; line-height: 1; cursor: pointer; padding: 0 4px;
    color: var(--sg-muted, #64748b);
  }
  .dt-rail-close:hover { color: var(--sg-fg, #1e293b); }

  .dt-rail-kpis {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 8px; padding: 12px 14px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    flex-shrink: 0;
  }
  .dt-kpi {
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 6px;
    padding: 8px 10px;
  }
  .dt-kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sg-muted, #64748b); }
  .dt-kpi-value { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 3px; }

  .dt-rail-grid { flex: 1; min-height: 0; }
  .dt-rail-foot {
    padding: 8px 14px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    font-size: 11px; color: var(--sg-muted, #64748b);
  }
</style>
