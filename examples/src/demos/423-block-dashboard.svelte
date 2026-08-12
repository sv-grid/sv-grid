<script lang="ts">
  /**
   * Analytics dashboard block - a full overview page composed from the UI kit
   * (shadcn dashboard-01 style). A header row with range Segmented + actions, a
   * KPI grid (SvStat + SvSparkline), a "revenue" bar panel, a recent-activity
   * SvTimeline, and a top-products list with SvProgress bars. No grid dependency.
   */
  import {
    SvCard, SvStat, SvSparkline, SvSegmented, SvButton, SvBadge, SvAvatar,
    SvProgress, SvTimeline, SvDivider, SvChart, SvToaster, toast,
    type TimelineItem, type ChartSpec,
  } from '@svgrid/grid'

  let range = $state<string | number>('30d')

  const kpis = [
    { label: 'Revenue', value: '$48,120', delta: 12.4, spark: [12, 18, 15, 22, 20, 28, 26, 34], color: '#4f46e5' },
    { label: 'New customers', value: '1,240', delta: 8.1, spark: [30, 24, 28, 20, 26, 22, 31, 29], color: '#0ea5e9' },
    { label: 'Active accounts', value: '18.6k', delta: 3.2, spark: [8, 9, 11, 10, 13, 12, 15, 17], color: '#10b981' },
    { label: 'Churn rate', value: '1.8%', delta: -0.6, invert: true, spark: [4, 3.5, 3.8, 3, 2.6, 2.4, 2, 1.8], color: '#f59e0b' },
  ]

  const revenue = [
    { m: 'Mar', v: 62 }, { m: 'Apr', v: 48 }, { m: 'May', v: 71 }, { m: 'Jun', v: 55 },
    { m: 'Jul', v: 83 }, { m: 'Aug', v: 76 }, { m: 'Sep', v: 94 }, { m: 'Oct', v: 88 },
  ]
  // Drive the real SvGridChart from a spec rather than hand-rolled bars.
  const revenueSpec: ChartSpec = {
    type: 'bar',
    categories: revenue.map((r) => r.m),
    series: [{ label: 'MRR', values: revenue.map((r) => r.v), color: '#6366f1' }],
    valueFormat: 'currency',
  }

  const products = [
    { name: 'Analytics Cloud', pct: 82, rev: '$18.2k' },
    { name: 'Data Studio', pct: 64, rev: '$12.9k' },
    { name: 'Grid Enterprise', pct: 51, rev: '$9.4k' },
    { name: 'Scheduler Pro', pct: 33, rev: '$5.1k' },
  ]

  const activity: TimelineItem[] = [
    { title: 'New enterprise deal - Boeing', description: '$24,000 ARR', time: '12m ago', color: '#10b981' },
    { title: 'Grace invited 3 teammates', time: '1h ago' },
    { title: 'Export job completed', description: 'Q3 revenue.xlsx', time: '3h ago' },
    { title: 'Churn alert cleared', description: 'Acme renewed', time: 'Yesterday', color: '#f59e0b' },
  ]

  function refresh() {
    toast.promise(new Promise<void>((res) => setTimeout(res, 900)), {
      loading: 'Refreshing metrics...', success: 'Up to date', error: 'Failed',
    })
  }
</script>

<div class="dash">
  <header class="top">
    <div>
      <h1>Overview</h1>
      <p class="muted">Welcome back, Ada. Here's how things are trending.</p>
    </div>
    <div class="top-actions">
      <SvSegmented
        bind:value={range}
        options={[
          { value: '7d', label: '7d' },
          { value: '30d', label: '30d' },
          { value: 'qtd', label: 'QTD' },
          { value: 'ytd', label: 'YTD' },
        ]}
      />
      <SvButton variant="outline" size="md" onclick={() => toast('Exporting report...')}>Export</SvButton>
      <SvButton variant="primary" size="md" onclick={refresh}>Refresh</SvButton>
    </div>
  </header>

  <!-- KPI row -->
  <section class="kpis">
    {#each kpis as k (k.label)}
      <SvCard>
        <SvStat label={k.label} value={k.value} delta={k.delta} invert={k.invert} hint="vs last period">
          {#snippet chart()}<SvSparkline data={k.spark} type="area" color={k.color} width={96} height={30} />{/snippet}
        </SvStat>
      </SvCard>
    {/each}
  </section>

  <!-- Main split -->
  <section class="split">
    <SvCard title="Revenue" subtitle="Monthly recurring, last 8 months">
      <div class="chart">
        <SvChart spec={revenueSpec} legend={false} height={200} />
      </div>
    </SvCard>

    <SvCard title="Recent activity">
      <SvTimeline items={activity} />
    </SvCard>
  </section>

  <!-- Bottom split -->
  <section class="split-2">
    <SvCard title="Top products" subtitle="Share of revenue this period">
      <ul class="prod">
        {#each products as p (p.name)}
          <li>
            <div class="prod-head">
              <span>{p.name}</span>
              <strong>{p.rev}</strong>
            </div>
            <SvProgress value={p.pct} />
          </li>
        {/each}
      </ul>
    </SvCard>

    <SvCard title="Team">
      <ul class="team">
        {#each [{ n: 'Ada Lovelace', r: 'Owner', s: 'online' }, { n: 'Grace Hopper', r: 'Admin', s: 'online' }, { n: 'Alan Turing', r: 'Editor', s: 'away' }, { n: 'Katherine Johnson', r: 'Viewer', s: 'offline' }] as t (t.n)}
          <li>
            <SvAvatar name={t.n} size="sm" status={t.s as 'online' | 'away' | 'offline'} />
            <div class="who">
              <span>{t.n}</span>
              <span class="muted">{t.r}</span>
            </div>
            <SvBadge variant={t.r === 'Owner' ? 'accent' : 'neutral'} size="sm">{t.r}</SvBadge>
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
  .dash { padding: 20px; display: flex; flex-direction: column; gap: 16px; background: var(--sg-bg-subtle, var(--sg-header-bg, #f8fafc)); color: var(--sg-fg, #0f172a); }
  .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .top h1 { margin: 0; font-size: 24px; letter-spacing: -.02em; }
  .muted { color: var(--sg-muted, #64748b); font-size: 13px; margin: 2px 0 0; }
  .top-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
  .split { display: grid; grid-template-columns: 1.6fr 1fr; gap: 12px; }
  .split-2 { display: grid; grid-template-columns: 1.3fr 1fr; gap: 12px; }

  .chart { width: 100%; }

  .prod { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
  .prod-head { display: flex; justify-content: space-between; font-size: 13.5px; margin-bottom: 6px; }
  .prod-head strong { font-variant-numeric: tabular-nums; }

  .team { list-style: none; margin: 0 0 6px; padding: 0; display: flex; flex-direction: column; }
  .team li { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--sg-border, #eef2f7); }
  .who { display: flex; flex-direction: column; line-height: 1.3; font-size: 13.5px; }
  .who .muted { font-size: 12px; }

  @media (max-width: 860px) {
    .split, .split-2 { grid-template-columns: 1fr; }
  }
</style>
