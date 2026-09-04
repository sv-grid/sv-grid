<!-- Documented in: docs/help/grouping-aggregation.md -->
<script lang="ts">
  /**
   * 427. Group display modes + footers
   * ----------------------------------
   * Three ways to draw grouped rows, and a subtotal row per group:
   *
   *   groupDisplayMode="groupRows"        full-width banner per group (default)
   *   groupDisplayMode="singleColumn"     one combined Group column
   *   groupDisplayMode="multipleColumns"  one column per grouped field
   *   groupFooters                        subtotal row closing each group
   *
   * Grouped by TWO fields (Region, then Tier) - with only one grouping level
   * the two column modes are identical by definition.
   *
   * Paging counts DATA rows: a page holds `pageSize` real rows and reprints the
   * banners they sit under, and footers are inserted after paging so they never
   * eat the budget.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnGroupingFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnGroupingFeature })

  type Sale = {
    id: number
    region: string
    tier: string
    rep: string
    deals: number
    revenue: number
  }

  let seed = 0x5eed
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)

  const REGIONS = ['Americas', 'EMEA', 'APAC']
  const TIERS = ['Enterprise', 'Mid-market']
  const REPS = ['Ada L.', 'Grace H.', 'Alan T.', 'Margaret H.', 'Linus T.', 'Donald K.', 'Barbara L.', 'Ken T.']

  const rows: Sale[] = Array.from({ length: 60 }, (_, i) => ({
    id: i + 1,
    region: REGIONS[i % REGIONS.length]!,
    tier: TIERS[Math.floor(i / REGIONS.length) % TIERS.length]!,
    rep: REPS[Math.floor(rnd() * REPS.length)]!,
    deals: 1 + Math.floor(rnd() * 9),
    revenue: Math.round(5_000 + rnd() * 95_000),
  }))

  const columns: ColumnDef<typeof features, Sale>[] = [
    { field: 'region', header: 'Region', width: 140 },
    { field: 'tier',   header: 'Tier',   width: 140 },
    { field: 'rep',    header: 'Rep',    width: 150 },
    { field: 'deals',  header: 'Deals',  width: 110, align: 'right', aggregate: 'sum' },
    {
      field: 'revenue', header: 'Revenue', width: 150, align: 'right', aggregate: 'sum',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
  ]

  type Mode = 'groupRows' | 'singleColumn' | 'multipleColumns'
  const MODES: Array<{ id: Mode; label: string; hint: string }> = [
    { id: 'groupRows',       label: 'groupRows',       hint: 'A full-width banner per group. The default.' },
    { id: 'singleColumn',    label: 'singleColumn',    hint: 'One Group column holding both levels, indented by depth.' },
    { id: 'multipleColumns', label: 'multipleColumns', hint: 'A column per grouped field - Region and Tier each get one.' },
  ]

  let mode = $state<Mode>('groupRows')
  let footers = $state(true)
  let pageSize = $state(10)

  const activeHint = $derived(MODES.find((m) => m.id === mode)?.hint ?? '')
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div
    class="shrink-0 rounded-lg border px-4 py-3"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Grouped by Region → Tier
    </p>
    <p class="mt-1 text-xs" style="color: var(--sg-muted);">
      In the two column modes the grouped columns fold into synthetic ones and
      the group row becomes an ordinary row - so its subtotals line up under
      <strong>Deals</strong> and <strong>Revenue</strong> instead of sitting in a
      full-width strip.
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-3">
      <div class="inline-flex overflow-hidden rounded-md border" style="border-color: var(--sg-border);">
        {#each MODES as m (m.id)}
          <button
            type="button" class="px-3 py-1 text-xs"
            style={mode === m.id
              ? 'background: var(--sg-accent, #2563eb); color: var(--sg-on-accent, #fff);'
              : 'background: transparent; color: var(--sg-fg);'}
            onclick={() => (mode = m.id)}
          >{m.label}</button>
        {/each}
      </div>

      <label class="inline-flex items-center gap-1.5 text-xs" style="color: var(--sg-fg);">
        <input type="checkbox" bind:checked={footers} />
        Group footers
      </label>

      <label class="inline-flex items-center gap-1.5 text-xs" style="color: var(--sg-fg);">
        Page size
        <select
          bind:value={pageSize}
          class="rounded border px-1.5 py-0.5 text-xs"
          style="border-color: var(--sg-border); background: var(--sg-bg); color: var(--sg-fg);"
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={25}>25</option>
        </select>
      </label>
    </div>

    <p class="mt-2 text-xs" style="color: var(--sg-muted);">{activeHint}</p>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      columnResize
      responsive={true}
      data={rows}
      {columns}
      {features}
      groupable
      groupFooters={footers}
      groupDisplayMode={mode}
      pageable
      {pageSize}
      selectionMode="none"
      rowHeight={34}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(a: SvGridApi<typeof features, Sale>) => {
        queueMicrotask(() => a.setGroupBy(['region', 'tier']))
      }}
    />
  </div>
</section>
