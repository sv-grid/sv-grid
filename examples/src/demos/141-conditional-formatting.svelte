<!-- Documented in: docs/help/cells/conditional-formatting.md -->
<script lang="ts">
  /**
   * 141. Conditional formatting
   * ---------------------------
   * Excel-style, value-driven cell coloring as a declarative engine prop -
   * no per-cell snippet. Pass every rule in one `conditionalFormats` array;
   * later entries win. This demo showcases the gradient engine:
   *
   *   dataBar     in-cell proportional bar (now gradient-filled)
   *   colorScale  alpha heat map · zero-centred · N-stop bands · compareColumn
   *   iconSet     arrows / traffic / triangles by threshold
   *   rule        apply a style when a predicate matches
   *
   * Two live toggles show the headline additions: the alpha ramp (a
   * translucent tint that composites over zebra/selection) and
   * `conditionalStatScope`, which rescales the ramp to the visible rows.
   */
  import {
    SvGrid,
    tableFeatures,
    columnFilteringFeature,
    type ColumnDef,
    type ConditionalFormat,
    type SvGridApi,
  } from '@svgrid/grid'

  // Filtering must be enabled for `conditionalStatScope` to be observable and
  // for the in-grid filter (below) to take effect.
  const features = tableFeatures({ columnFilteringFeature })

  type Row = {
    id: number
    rep: string
    region: string
    revenue: number
    filled: number
    target: number
    pnl: number
    growth: number
    score: number
    risk: number
  }

  let seed = 0x51ed
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)

  const REPS = ['Ada L.', 'Grace H.', 'Alan T.', 'Margaret H.', 'Linus T.', 'Donald K.', 'Brian K.', 'Dennis R.', 'Barbara L.', 'Ken T.']
  const REGIONS = ['Americas', 'EMEA', 'APAC']
  const rows: Row[] = REPS.map((rep, id) => {
    const target = Math.round(40 + rnd() * 60)
    return {
      id,
      rep,
      region: REGIONS[id % 3]!,
      revenue: Math.round(20_000 + rnd() * 380_000),
      target,
      filled: Math.round(target * (0.5 + rnd())), // ~50%..150% of target
      pnl: Math.round((rnd() - 0.45) * 90_000), // spans negative + positive
      growth: Math.round((rnd() - 0.4) * 60),
      score: Math.round(rnd() * 100),
      risk: Math.round(rnd() * 100),
    }
  })

  // --- Live controls -------------------------------------------------------
  let alphaMode = $state(true)
  let statScope = $state<'visible' | 'all'>('all')
  let topOnly = $state(false)
  let api = $state<SvGridApi<typeof features, Row> | null>(null)

  // Whether ANY filter currently narrows the grid - the demo's own toggle OR
  // a column menu. Fed by `onFiltersChange` so it stays true to what's really
  // on screen. `conditionalStatScope` only has a visible effect while some
  // rows are hidden: with every row visible, "visible" and "all" describe the
  // same set, so the ramp is identical and the toggle looks inert. Gating the
  // control on this makes that relationship obvious instead of surprising.
  let rowsHidden = $state(0)
  const anyFilter = $derived(rowsHidden > 0)

  function onFiltersChange(f: { global: string; columns: unknown[] }) {
    const active = f.global.trim() !== '' || f.columns.length > 0
    // Count how many rows the filter removed, for the live status line.
    rowsHidden = active ? rows.length - (api?.getDisplayedRows().length ?? rows.length) : 0
  }

  // Filter INSIDE the grid (not by swapping `data`) so the two stat scopes
  // actually differ: the grid narrows the visible rows while the full dataset
  // stays intact behind them. With `visible` the ramp rescales to the rows on
  // screen; with `all` it stays anchored to every row. Driven from the
  // checkbox handler (not a reactive `$effect`) so a single user action maps
  // to a single imperative filter call.
  function applyTopOnly(next: boolean) {
    topOnly = next
    if (next) api?.setFilter('score', { operator: 'greaterThan', value: '55' })
    else api?.clearFilter('score')
  }

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'rep', header: 'Rep', width: 130 },
    { field: 'region', header: 'Region', width: 110 },
    {
      field: 'revenue',
      header: 'Revenue',
      width: 190,
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
    { field: 'filled', header: 'Filled / target', width: 150, align: 'right' },
    { field: 'target', header: 'Target', width: 110, align: 'right' },
    {
      field: 'pnl',
      header: 'P&L',
      width: 150,
      align: 'right',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
    { field: 'growth', header: 'Growth %', width: 120, align: 'right' },
    { field: 'score', header: 'Health score', width: 150, align: 'center' },
    { field: 'risk', header: 'Risk', width: 130, align: 'center' },
  ]

  const conditionalFormats = $derived<ConditionalFormat<Row>[]>([
    // Gradient-filled data bar across the revenue range.
    { type: 'dataBar', columns: ['revenue'], color: '#3b82f6', gradient: true },
    // Column comparison: tint each cell by filled / target on the same row.
    {
      type: 'colorScale',
      columns: ['filled'],
      mode: 'alpha',
      base: '#2563eb',
      compareColumn: 'target',
      tooltip: 'percent',
    },
    // Zero-centred diverging scale: red below 0, green above, neutral at 0.
    {
      type: 'colorScale',
      columns: ['pnl'],
      min: '#ef4444',
      mid: '#f8fafc',
      max: '#22c55e',
      zeroCentred: true,
    },
    // Health score - toggle between the alpha heat map and a hue ramp.
    alphaMode
      ? { type: 'colorScale', columns: ['score'], mode: 'alpha', base: '#0ea5e9', tooltip: 'percent' }
      : { type: 'colorScale', columns: ['score'], min: '#fca5a5', mid: '#fde68a', max: '#86efac', minValue: 0, maxValue: 100 },
    // Banded / traffic-light: green -> amber -> red across the risk range.
    {
      type: 'colorScale',
      columns: ['risk'],
      stops: [
        { offset: 0, color: '#22c55e' },
        { offset: 0.5, color: '#f59e0b' },
        { offset: 1, color: '#ef4444' },
      ],
    },
    // Arrows by growth threshold (down < 0 <= flat < 10 <= up)...
    { type: 'iconSet', columns: ['growth'], set: 'arrows', thresholds: [0, 10] },
    // ...and a rule reddening negative growth.
    {
      type: 'rule',
      columns: ['growth'],
      when: ({ value }) => Number(value) < 0,
      color: '#dc2626',
      fontWeight: 700,
    },
  ])
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div
    class="shrink-0 rounded-lg border px-4 py-3"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Gradient conditional formatting via <code>conditionalFormats</code>
    </p>
    <p class="mt-1 text-xs" style="color: var(--sg-muted);">
      Revenue = gradient data bar · Filled = alpha tint vs target (hover for %)
      · P&amp;L = zero-centred red/green · Growth = arrows + red negatives ·
      Health = heat map · Risk = banded traffic-light. One array, no per-cell
      snippets.
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-4 text-xs">
      <label class="inline-flex items-center gap-2" style="color: var(--sg-fg);">
        <input type="checkbox" bind:checked={alphaMode} />
        Alpha heat map on Health score
      </label>

      <label class="inline-flex items-center gap-2" style="color: var(--sg-fg);">
        <input
          type="checkbox"
          checked={topOnly}
          onchange={(e) => applyTopOnly(e.currentTarget.checked)}
        />
        Show top performers only
      </label>

      <span
        class="inline-flex items-center gap-2"
        style="color: var(--sg-fg); opacity: {anyFilter ? 1 : 0.45};"
        title={anyFilter ? '' : 'Apply a filter first - with every row visible, "visible" and "all" describe the same set, so the ramp does not change.'}
      >
        Stat scope:
        <button
          type="button"
          class="rounded px-2 py-0.5 border"
          disabled={!anyFilter}
          style="border-color: var(--sg-border); background: {statScope === 'visible' ? 'var(--sg-accent, #2563eb)' : 'transparent'}; color: {statScope === 'visible' ? '#fff' : 'var(--sg-fg)'}; cursor: {anyFilter ? 'pointer' : 'not-allowed'};"
          onclick={() => (statScope = 'visible')}
        >visible</button>
        <button
          type="button"
          class="rounded px-2 py-0.5 border"
          disabled={!anyFilter}
          style="border-color: var(--sg-border); background: {statScope === 'all' ? 'var(--sg-accent, #2563eb)' : 'transparent'}; color: {statScope === 'all' ? '#fff' : 'var(--sg-fg)'}; cursor: {anyFilter ? 'pointer' : 'not-allowed'};"
          onclick={() => (statScope = 'all')}
        >all</button>
      </span>
    </div>
    <p class="mt-2 text-[11px]" style="color: var(--sg-muted);">
      {#if anyFilter}
        <strong>{rowsHidden}</strong> row{rowsHidden === 1 ? '' : 's'} hidden by the
        filter. Now the scope matters: <strong>visible</strong> rescales the ramp
        across the {rows.length - rowsHidden} rows on screen, while
        <strong>all</strong> keeps it anchored to the full {rows.length}.
      {:else}
        Filter the grid first (toggle <em>Show top performers only</em>, or any
        column menu). The stat scope only rescales the ramp once some rows are
        hidden - with every row visible, <strong>visible</strong> and
        <strong>all</strong> are the same set.
      {/if}
    </p>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      responsive={true}
      data={rows}
      columns={columns}
      features={features}
      conditionalFormats={conditionalFormats}
      conditionalStatScope={statScope}
      filterMode="menu"
      selectionMode="none"
      enableRowSummaries={false}
      rowHeight={38}
      containerHeight="100%"
      fitColumns={true}
      onFiltersChange={onFiltersChange}
      onApiReady={(next) => (api = next)}
    />
  </div>
</section>
