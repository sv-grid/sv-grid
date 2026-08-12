<script lang="ts">
  /**
   * 06. Large dataset, virtualized
   * ------------------------------
   * Row + column virtualization make a wide grid scroll smoothly.
   *
   * The data is a sales team where each rep carries a rolling monthly ledger -
   * Revenue / Units / Margin per month going back a couple of years. That's a
   * genuinely wide real-world shape (not placeholder "Metric N" columns), so
   * scrolling both axes exercises the virtualizer on data that means something.
   *
   * The user can scale it up at runtime. The default is 10,000 rows × 55
   * columns - a realistic enterprise size that mounts in well under a second.
   * The 100,000-row option pushes the grid hard; expect a brief pause on
   * mount, then smooth scrolling once the virtualizer is live.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from '@svgrid/grid'
  import { makeWidePeople, metricKind, type WidePerson } from '../shared/seed'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
  })

  // `cols` is the number of monthly-KPI columns; the label counts the 5 fixed
  // identity columns too. The smaller tiers keep cols a multiple of 3 so months
  // group cleanly; the top tier fills to a round 100 columns (the last month is
  // partial, which the KPI-cycling handles fine).
  type Size = { rows: number; cols: number; label: string }
  const sizes: Size[] = [
    { rows: 1_000,   cols: 24, label: '1k × 29' },
    { rows: 10_000,  cols: 48, label: '10k × 53' },
    { rows: 50_000,  cols: 72, label: '50k × 77' },
    { rows: 100_000, cols: 95, label: '100k × 100' },
  ]

  let size = $state<Size>(sizes[1]!)
  let busy = $state(false)
  let rows = $state.raw<WidePerson[]>([])
  let columns = $state.raw<ColumnDef<typeof features, WidePerson>[]>([])
  let mountedAt = $state(0)

  // Month labels for the rolling ledger, newest first: "Aug '26", "Jul '26"…
  // One label per calendar month back from today.
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  function monthLabel(back: number): string {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1)
    return `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`
  }

  // Each wide column is one month of one KPI, cycling Revenue / Units / Margin.
  // The header and number format follow the KPI, so the grid reads like a real
  // performance ledger rather than "Metric 0 … Metric 94".
  const KPI = [
    { name: 'Revenue', format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { name: 'Units',   format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { name: 'Margin',  format: { type: 'percent', valueIsPercentPoints: true, options: { maximumFractionDigits: 1 } } },
  ] as const

  function buildColumns(metrics: number): ColumnDef<typeof features, WidePerson>[] {
    const base: ColumnDef<typeof features, WidePerson>[] = [
      { field: 'firstName',  header: 'First name', editorType: 'text', width: 140 },
      { field: 'lastName',   header: 'Last name',  editorType: 'text', width: 140 },
      { field: 'department', header: 'Team',       editorType: 'text', width: 130 },
      { field: 'country',    header: 'Region',     editorType: 'text', width: 100 },
      { field: 'status',     header: 'Status',     editorType: 'text', width: 110 },
    ]
    const ledger: ColumnDef<typeof features, WidePerson>[] = []
    for (let i = 0; i < metrics; i++) {
      const kpi = KPI[metricKind(i)]!
      // Three KPIs share each month, so month N advances every 3 columns.
      const month = monthLabel(Math.floor(i / 3))
      ledger.push({
        field: `metric_${i}` as `metric_${number}`,
        header: `${month} · ${kpi.name}`,
        editorType: 'number',
        format: kpi.format,
        width: 150,
      })
    }
    return [...base, ...ledger]
  }

  async function load(next: Size) {
    busy = true
    // Unmount the grid first so the heavy old rows are GC'd before the new ones
    // are generated. Without this, peak memory is ~2× the larger size.
    rows = []
    columns = []
    await new Promise((r) => requestAnimationFrame(r))
    const t0 = performance.now()
    const generated = makeWidePeople(next.rows, next.cols, 1337)
    columns = buildColumns(next.cols)
    rows = generated
    size = next
    mountedAt = Math.round(performance.now() - t0)
    busy = false
  }

  // Initial load
  $effect(() => {
    if (rows.length === 0 && !busy) load(size)
  })
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-2 text-sm shrink-0">
    <span class="font-medium">Dataset:</span>
    {#each sizes as option (option.label)}
      {@const active = option.rows === size.rows && option.cols === size.cols}
      <button
        type="button"
        onclick={() => load(option)}
        disabled={busy || active}
        class="rounded border px-3 py-1 ds-btn {active ? 'ds-btn-on font-semibold' : ''} disabled:opacity-50"
      >{option.label}</button>
    {/each}
    <span class="ml-auto ds-meta">
      {#if busy}
        Generating…
      {:else if rows.length}
        {size.rows.toLocaleString()} rows · {size.cols + 5} columns · generated in {mountedAt} ms
      {/if}
    </span>
  </div>

  {#if rows.length}
    <div class="flex-1 min-h-0">
      <SvGrid responsive={true}
        data={rows}
        columns={columns}
        features={features}
        filterMode="menu"
        selectionMode="cell"
        showPagination={false}
        enableInlineEditing={false}
        enableCellSelection={true}
        enableRowSummaries={false}
        showRowNumbers={true}
        virtualization={true}
        columnVirtualization={true}
        rowHeight={32}
        overscan={8}
        columnOverscan={3}
        columnWidth={150}
        containerHeight="100%"
      />
    </div>
  {/if}
</section>

<style>
  /* Toolbar chrome follows the active grid theme via --sg-* tokens. */
  .ds-btn {
    border-color: var(--sg-border, #cbd5e1);
    background: var(--sg-bg, transparent);
    color: var(--sg-fg, inherit);
  }
  .ds-btn:not(.ds-btn-on):hover:not(:disabled) { background: var(--sg-row-hover-bg, transparent); }
  .ds-btn-on { background: var(--sg-bg-subtle, var(--sg-header-bg, #e2e8f0)); }
  .ds-meta { color: var(--sg-muted, #64748b); }
</style>
