# KPI card blocks

The metric tiles at the top of an app dashboard: a few numbers someone checks
every morning, with enough context to tell whether they moved. Each block is one
`.svelte` file built from `SvCard`, `SvStat`, `SvSparkline`, `SvBadge`,
`SvSegmented` and `SvSwitchButton`, themed from the `--sg-*` tokens.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/kpi-cards"></div>

See them first with `npx @svgrid/ui try blocks/kpi-cards`. No project needed.

## With icons

Each card has a tinted icon tile, today's value and the 7-day average. The cards
are toggle buttons with `aria-pressed`: click one and it takes the accent
border, and the `SvCard` panel underneath shows that metric's last seven days as
a bar and a value per day.

<div data-docs-demo="556-block-kpi-cards-icon" data-height="560"></div>

`npx @svgrid/ui add kpi-cards-icon`

## With trend

Four `SvStat` cards that compare each metric with the period before: the change
with an up or down arrow, green when the move is good and red when it is bad,
and the previous value. Churn rate and time to convert pass `invert`, so a drop
shows green; churn moves in percentage points. The `SvSegmented` switch (7d,
30d, 90d) changes every number on the row.

<div data-docs-demo="557-block-kpi-cards-trend" data-height="320"></div>

`npx @svgrid/ui add kpi-cards-trend`

## With sparklines

Live service metrics. Each card shows the current value, the average and peak
over the last 30 seconds, and an `SvSparkline` area chart as wide as the card.
With the Live `SvSwitchButton` on, every card gets a new point each second and
drops its oldest one; turn it off and the numbers stop. The timer lives in an
`$effect`, so it is cleared when Live goes off and when the block unmounts.

<div data-docs-demo="559-block-kpi-cards-sparkline" data-height="340"></div>

`npx @svgrid/ui add kpi-cards-sparkline`

## Loading the numbers in SvelteKit

Each block's core takes its numbers as a `metrics` option and falls back to the
sample array when you pass none. In a SvelteKit app, return that array from the
page's server `load` and read it from `data`. Tag the load with `depends` so the
page can ask for fresh numbers without a navigation:

```ts
// src/routes/dashboard/+page.server.ts
import type { PageServerLoad } from './$types'
import { getTrendMetrics } from '$lib/server/metrics'

export const load: PageServerLoad = async ({ depends }) => {
  depends('app:metrics')
  // [{ label, unit, invert?, now: { '7d', '30d', '90d' }, prev: { ... } }, ...]
  // in the trend block's TrendMetric shape
  return { metrics: await getTrendMetrics() }
}
```

In the block file, take the array as a prop and hand it to the core:

```ts
let { metrics }: { metrics?: TrendMetric[] } = $props()

const kpi = createKpiTrendCards({ metrics })
```

`invalidate('app:metrics')` reruns that load and gives `data.metrics` a new
array. Call it on a timer, from a Refresh button, or both:

```svelte
<!-- src/routes/dashboard/+page.svelte -->
<script lang="ts">
  import { invalidate } from '$app/navigation'
  import { SvButton } from '@svgrid/grid'
  import KpiTrend from '$lib/components/ui/kpi-cards-trend.svelte'

  let { data } = $props()
  let refreshing = $state(false)

  // Poll once a minute while the page is open; the teardown stops it on leave.
  $effect(() => {
    const t = setInterval(() => invalidate('app:metrics'), 60_000)
    return () => clearInterval(t)
  })

  async function refresh() {
    refreshing = true
    await invalidate('app:metrics')
    refreshing = false
  }
</script>

<SvButton variant="secondary" loading={refreshing} onclick={refresh}>Refresh</SvButton>

{#key data.metrics}
  <KpiTrend metrics={data.metrics} />
{/key}
```

A core reads its options once, when it is created, so the `{#key}` block
creates the block again whenever the array changes. The period switch lives in
the core and starts back on its default (30d) each time. To keep the visitor's
choice across refreshes, add a `period` prop next to `metrics` and pass it to
`createKpiTrendCards({ metrics, period })`, or keep it in `?period=` and read
it from `page.url.searchParams`. `invalidateAll()` works in place of
`invalidate('app:metrics')` if you would rather rerun every load on the page.

For the live block, a one-second `invalidate` is a server round trip per tick.
Create its core with `live: false` so the sample random walk never starts, and
call `tick(values)` from an `EventSource` or websocket handler with one number
per metric, in card order. Each call appends a point and drops the oldest:

```ts
const kpi = createLiveKpis({ live: false })

$effect(() => {
  const source = new EventSource('/api/metrics/stream')
  source.onmessage = (e) => kpi.tick(JSON.parse(e.data))
  return () => source.close()
})
```

The Live switch in the block then only toggles the sample walk, so wire it to
open and close the stream instead, or remove it.

## Headless

Each block's `<script module>` exports its core: `createKpiIconCards()`,
`createKpiTrendCards()` and `createLiveKpis()`. The core holds the numbers, the formatting and any
selection, period or live state, with no markup. Take one alone with
`npx @svgrid/ui add kpi-cards-icon --headless` and render your own tiles; the
card props carry `aria-pressed` and the click handler:

```svelte
<script lang="ts">
  import { createKpiIconCards } from './kpi-cards-icon.svelte.js'

  let { data } = $props()
  const kpi = createKpiIconCards({ metrics: data.metrics })
</script>

{#each kpi.metrics as m (m.key)}
  <button {...kpi.cardProps(m.key)}>
    {m.label}: {kpi.fmt(m, kpi.today(m))}, 7-day avg {kpi.fmt(m, kpi.avg(m))}
  </button>
{/each}

<ol aria-label={`${kpi.current.label}, last 7 days`}>
  {#each kpi.current.days as v, i (i)}
    <li>
      <span class="bar" style:height={kpi.barHeight(v)}></span>
      {kpi.dayLabels[i]} {kpi.short(kpi.current, v)}
    </li>
  {/each}
</ol>
```

## See also

- [UI blocks overview](./index.md)
- [SvStat](../ui-components/sv-stat.md)
- [SvSparkline](../ui-components/sv-sparkline.md)
