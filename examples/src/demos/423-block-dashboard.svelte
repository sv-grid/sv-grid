<script lang="ts" module>
  /**
   * Analytics dashboard block - a full overview page: a header with a range
   * SvSegmented and actions, a KPI row (SvStat + SvSparkline in SvCards), a
   * revenue SvChart, a recent-activity SvTimeline, a top-products list with
   * SvProgress bars and a team list with SvAvatar and SvBadge. No grid
   * dependency. Pure UI-kit, --sg-* themed.
   *
   * Headless: createDashboard() below owns the data, the selected range, the
   * chart spec and the refresh / export actions with no markup. The component
   * under it is one styled render of that core; import createDashboard from
   * this file (or `npx @svgrid/ui add dashboard --headless` for the core
   * alone) to draw your own.
   */
  import type { ChartSpec, TimelineItem } from '@svgrid/grid'

  export type DashboardKpi = {
    label: string; value: string; delta: number; invert?: boolean; spark: number[]; color: string
  }
  export type DashboardMonth = { month: string; value: number }
  export type DashboardProduct = { name: string; pct: number; revenue: string }
  export type DashboardMember = { name: string; role: string; status: 'online' | 'away' | 'offline' }
  export type DashboardRange = { value: string; label: string }
  export type DashboardOptions = {
    /** Tiles across the top; each one is an SvStat with a sparkline. Pass one
     *  list, or one list per range value to switch them with the range. */
    kpis?: DashboardKpi[] | Record<string, DashboardKpi[]>
    /** Monthly recurring revenue for the bar chart. */
    revenue?: DashboardMonth[]
    products?: DashboardProduct[]
    activity?: TimelineItem[]
    team?: DashboardMember[]
    ranges?: DashboardRange[]
    /** Initially selected range value. */
    range?: string
    /** Load the numbers for a newly picked range. */
    onRangeChange?: (range: string) => void
    onRefresh?: (range: string) => Promise<void> | void
    onExport?: (range: string) => void
  }

  const TILE_LABELS = ['Revenue', 'New customers', 'Active accounts', 'Churn rate']
  const TILE_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b']
  /** One row of four tiles from [value, delta, spark]; churn is lower-is-better. */
  const tiles = (rows: [string, number, number[]][]): DashboardKpi[] =>
    rows.map(([value, delta, spark], i) => ({
      label: TILE_LABELS[i]!, value, delta, spark, color: TILE_COLORS[i]!, invert: i === 3 || undefined,
    }))

  const SAMPLE = {
    kpis: {
      '7d': tiles([
        ['$11,480', 4.2, [9, 11, 10, 13, 12, 14, 15, 16]],
        ['286', 2.7, [38, 41, 36, 44, 40, 42, 45, 43]],
        ['18.6k', 0.4, [16.9, 17, 17.1, 17.1, 17.2, 17.3, 17.4, 17.5]],
        ['1.9%', -0.1, [2.1, 2, 2.1, 2, 1.9, 2, 1.9, 1.9]],
      ]),
      '30d': tiles([
        ['$48,120', 12.4, [12, 18, 15, 22, 20, 28, 26, 34]],
        ['1,240', 8.1, [30, 24, 28, 20, 26, 22, 31, 29]],
        ['18.6k', 3.2, [8, 9, 11, 10, 13, 12, 15, 17]],
        ['1.8%', -0.6, [4, 3.5, 3.8, 3, 2.6, 2.4, 2, 1.8]],
      ]),
      qtd: tiles([
        ['$138,900', 9.6, [31, 36, 34, 41, 39, 45, 48, 52]],
        ['3,610', 6.4, [80, 92, 85, 101, 96, 110, 104, 118]],
        ['18.6k', 5.1, [15.2, 15.6, 16, 16.4, 17, 17.5, 18.1, 18.6]],
        ['1.7%', -0.8, [2.6, 2.5, 2.3, 2.2, 2, 1.9, 1.8, 1.7]],
      ]),
      ytd: tiles([
        ['$412,300', 21.8, [28, 33, 37, 36, 44, 49, 55, 61]],
        ['10,950', 14.3, [880, 940, 1010, 990, 1120, 1180, 1240, 1310]],
        ['18.6k', 11.6, [12.1, 13, 13.8, 14.9, 15.7, 16.6, 17.5, 18.6]],
        ['2.1%', -1.4, [3.5, 3.2, 3, 2.8, 2.6, 2.4, 2.2, 2.1]],
      ]),
    } as Record<string, DashboardKpi[]>,
    revenue: [
      { month: 'Mar', value: 62 }, { month: 'Apr', value: 48 }, { month: 'May', value: 71 }, { month: 'Jun', value: 55 },
      { month: 'Jul', value: 83 }, { month: 'Aug', value: 76 }, { month: 'Sep', value: 94 }, { month: 'Oct', value: 88 },
    ] as DashboardMonth[],
    products: [
      { name: 'Analytics Cloud', pct: 82, revenue: '$18.2k' },
      { name: 'Data Studio', pct: 64, revenue: '$12.9k' },
      { name: 'Grid Enterprise', pct: 51, revenue: '$9.4k' },
      { name: 'Scheduler Pro', pct: 33, revenue: '$5.1k' },
    ] as DashboardProduct[],
    activity: [
      { title: 'New enterprise deal - Boeing', description: '$24,000 ARR', time: '12m ago', color: '#10b981' },
      { title: 'Grace invited 3 teammates', time: '1h ago' },
      { title: 'Export job completed', description: 'Q3 revenue.xlsx', time: '3h ago' },
      { title: 'Churn alert cleared', description: 'Acme renewed', time: 'Yesterday', color: '#f59e0b' },
    ] as TimelineItem[],
    team: [
      { name: 'Ada Lovelace', role: 'Owner', status: 'online' },
      { name: 'Grace Hopper', role: 'Admin', status: 'online' },
      { name: 'Alan Turing', role: 'Editor', status: 'away' },
      { name: 'Katherine Johnson', role: 'Viewer', status: 'offline' },
    ] as DashboardMember[],
    ranges: [
      { value: '7d', label: '7d' }, { value: '30d', label: '30d' },
      { value: 'qtd', label: 'QTD' }, { value: 'ytd', label: 'YTD' },
    ] as DashboardRange[],
  }

  export function createDashboard(opts: DashboardOptions = {}) {
    // Data is read once; recreate the core (or key the block) to swap it.
    const ranges = opts.ranges ?? SAMPLE.ranges
    const revenue = opts.revenue ?? SAMPLE.revenue
    let range = $state(opts.range ?? '30d')
    let refreshing = $state(false)
    const kpiSource = opts.kpis ?? SAMPLE.kpis
    /** The tiles for the selected range (or the one list you passed). */
    const kpis = $derived(Array.isArray(kpiSource) ? kpiSource : (kpiSource[range] ?? []))

    // A bar spec for SvChart (or any renderer that reads ChartSpec).
    const revenueSpec: ChartSpec = {
      type: 'bar',
      categories: revenue.map((r) => r.month),
      series: [{ label: 'MRR', values: revenue.map((r) => r.value), color: '#6366f1' }],
      valueFormat: 'currency',
    }

    async function refresh() {
      if (refreshing) return
      refreshing = true
      try {
        await opts.onRefresh?.(range)
      } catch {
        // the caller reports the failure; keep the numbers on screen
      } finally {
        refreshing = false
      }
    }

    return {
      get kpis() { return kpis },
      revenue,
      revenueSpec,
      products: opts.products ?? SAMPLE.products,
      activity: opts.activity ?? SAMPLE.activity,
      team: opts.team ?? SAMPLE.team,
      ranges,
      get range() { return range },
      /** Accepts a number too, so a segmented control can bind to it. */
      set range(v: string | number | null) {
        if (v == null || String(v) === range) return
        range = String(v)
        opts.onRangeChange?.(range)
      },
      get refreshing() { return refreshing },
      refresh,
      exportReport: () => opts.onExport?.(range),
      /** Spread on a plain <button> for one range option. */
      rangeProps: (value: string) => ({
        type: 'button' as const,
        'aria-pressed': range === value,
        onclick: () => {
          if (range === value) return
          range = value
          opts.onRangeChange?.(value)
        },
      }),
    }
  }
</script>

<script lang="ts">
  import {
    SvCard, SvStat, SvSparkline, SvSegmented, SvButton, SvBadge, SvAvatar,
    SvProgress, SvTimeline, SvDivider, SvChart, SvToaster, toast,
  } from '@svgrid/grid'

  const dash = createDashboard({
    onExport: () => toast('Exporting report...'),
    // Replace with your reload; the demo waits on a timer.
    onRefresh: () =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 900)), {
        loading: 'Refreshing metrics...', success: 'Up to date', error: 'Failed',
      }),
  })
</script>

<div class="sv-dash">
  <header class="sv-dash-top">
    <div>
      <h2>Overview</h2>
      <p class="sv-dash-muted">Welcome back, Ada. Here's how things are trending.</p>
    </div>
    <div class="sv-dash-actions">
      <SvSegmented bind:value={dash.range} options={dash.ranges} />
      <SvButton variant="outline" size="md" onclick={dash.exportReport}>Export</SvButton>
      <SvButton variant="primary" size="md" onclick={dash.refresh}>Refresh</SvButton>
    </div>
  </header>

  <!-- KPI row -->
  <section class="sv-dash-kpis">
    {#each dash.kpis as k (k.label)}
      <SvCard>
        <SvStat label={k.label} value={k.value} delta={k.delta} invert={k.invert} hint="vs last period">
          {#snippet chart()}<SvSparkline data={k.spark} type="area" color={k.color} width={96} height={30} />{/snippet}
        </SvStat>
      </SvCard>
    {/each}
  </section>

  <!-- Main split -->
  <section class="sv-dash-split">
    <SvCard title="Revenue" subtitle="Monthly recurring, last {dash.revenue.length} months">
      <div class="sv-dash-chart">
        <SvChart spec={dash.revenueSpec} legend={false} height={200} />
      </div>
    </SvCard>

    <SvCard title="Recent activity">
      <SvTimeline items={dash.activity} />
    </SvCard>
  </section>

  <!-- Bottom split -->
  <section class="sv-dash-split-2">
    <SvCard title="Top products" subtitle="Share of revenue this period">
      <ul class="sv-dash-prod">
        {#each dash.products as p (p.name)}
          <li>
            <div class="sv-dash-prod-head">
              <span>{p.name}</span>
              <strong>{p.revenue}</strong>
            </div>
            <SvProgress value={p.pct} />
          </li>
        {/each}
      </ul>
    </SvCard>

    <SvCard title="Team">
      <ul class="sv-dash-team">
        {#each dash.team as t (t.name)}
          <li>
            <SvAvatar name={t.name} size="sm" status={t.status} />
            <div class="sv-dash-who">
              <span>{t.name}</span>
              <span class="sv-dash-muted">{t.role}</span>
            </div>
            <SvBadge variant={t.role === 'Owner' ? 'accent' : 'neutral'} size="sm">{t.role}</SvBadge>
          </li>
        {/each}
      </ul>
      <SvDivider />
      <SvButton variant="ghost" block size="sm" onclick={() => toast('Invite dialog')}>+ Invite teammate</SvButton>
    </SvCard>
  </section>
</div>

<SvToaster position="bottom-right" />

<style>
  .sv-dash {
    padding: 20px; display: flex; flex-direction: column; gap: 16px; width: 100%; box-sizing: border-box;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a);
  }
  .sv-dash-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .sv-dash-top h2 { margin: 0; font-size: 24px; letter-spacing: -.02em; }
  .sv-dash-muted { color: var(--sg-muted, #64748b); font-size: 13px; margin: 2px 0 0; }
  .sv-dash-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

  .sv-dash-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
  .sv-dash-split { display: grid; grid-template-columns: 1.6fr 1fr; gap: 12px; }
  .sv-dash-split-2 { display: grid; grid-template-columns: 1.3fr 1fr; gap: 12px; }

  .sv-dash-chart { width: 100%; }

  .sv-dash-prod { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
  .sv-dash-prod-head { display: flex; justify-content: space-between; font-size: 13.5px; margin-bottom: 6px; }
  .sv-dash-prod-head strong { font-variant-numeric: tabular-nums; }

  .sv-dash-team { list-style: none; margin: 0 0 6px; padding: 0; display: flex; flex-direction: column; }
  .sv-dash-team li { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--sg-border, #eef2f7); }
  .sv-dash-who { display: flex; flex-direction: column; line-height: 1.3; font-size: 13.5px; }
  .sv-dash-who .sv-dash-muted { font-size: 12px; }

  @media (max-width: 860px) {
    .sv-dash-split, .sv-dash-split-2 { grid-template-columns: minmax(0, 1fr); }
  }
</style>
