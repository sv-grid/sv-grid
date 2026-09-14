<!-- Documented in: docs/help/charts/gallery.md -->
<script lang="ts">
  /**
   * 445. Heat maps and calendars
   * ----------------------------
   * Two ways to colour a value in a grid of cells:
   *
   * - The heat map is a matrix: `categories` are the columns (hours of the
   *   day) and each series is a row (a day of the week), its `values` the
   *   cells. `colorScale` picks the ramp: `'sequential'`, `'diverging'`
   *   (centred on zero, for a change or a difference), or your own stops.
   *   Click a cell to select it.
   * - The calendar is a year of days from `calendarValues`, one square per
   *   day laid out in weeks with the months labelled; `calendarStart` and
   *   `calendarEnd` pin the range so an empty month still shows.
   * - `dataLabels` writes the value in the cell where there is room.
   *
   * Free, in @svgrid/grid.
   */
  import { SvChart, type ChartSelection, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  let seed = 31
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`)
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  // Support tickets per hour: office hours on weekdays, a lunch dip, quiet weekends.
  const load = (d: number, h: number) => {
    const weekend = d >= 5
    const office = h >= 8 && h <= 18 ? 1 : 0.15
    const lunch = h === 12 || h === 13 ? 0.6 : 1
    return Math.round((weekend ? 6 : 28) * office * lunch * (0.8 + rnd() * 0.4))
  }
  const thisWeek = DAYS.map((_, d) => HOURS.map((_, h) => load(d, h)))
  const lastWeek = DAYS.map((_, d) => HOURS.map((_, h) => load(d, h)))

  let scale = $state<'sequential' | 'diverging' | 'custom'>('sequential')
  let mode = $state<'volume' | 'change'>('volume')
  let labels = $state(false)
  let picked = $state<ChartSelection | null>(null)

  const heat = $derived<ChartSpec>({
    type: 'heatmap',
    categories: HOURS,
    series: DAYS.map((day, d) => ({
      label: day,
      values: mode === 'volume' ? thisWeek[d]! : thisWeek[d]!.map((v, h) => v - lastWeek[d]![h]!),
    })),
    colorScale: scale === 'custom' ? ['#fef3c7', '#f59e0b', '#7c2d12'] : scale,
    title: mode === 'volume' ? 'Support tickets by hour' : 'Change against last week',
    subtitle: mode === 'volume' ? 'This week, tickets opened per hour' : 'Tickets per hour, this week minus last week',
    dataLabels: { show: labels },
    height: 300,
  })

  const days: Array<{ date: string; value: number }> = []
  for (let i = 0; i < 365; i += 1) {
    const d = new Date(Date.UTC(2026, 0, 1 + i))
    const dow = d.getUTCDay()
    const base = dow === 0 || dow === 6 ? 40 : 190
    const season = 1 + 0.35 * Math.sin(((i - 60) / 365) * Math.PI * 2)
    days.push({ date: d.toISOString().slice(0, 10), value: Math.round(base * season * (0.75 + rnd() * 0.5)) })
  }
  const calendar: ChartSpec = {
    type: 'calendar',
    categories: [],
    series: [],
    calendarValues: days,
    calendarStart: '2026-01-01',
    calendarEnd: '2026-12-31',
    colorScale: 'sequential',
    title: 'Tickets per day, 2026',
    subtitle: 'One square per day; weekends are the quiet rows',
    height: 190,
  }

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="ctl">
      Values
      <select bind:value={mode}>
        <option value="volume">Tickets this week</option>
        <option value="change">Change vs last week</option>
      </select>
    </label>
    <label class="ctl">
      Colours
      <select bind:value={scale}>
        <option value="sequential">Sequential</option>
        <option value="diverging">Diverging</option>
        <option value="custom">Custom stops</option>
      </select>
    </label>
    <label class="chk"><input type="checkbox" bind:checked={labels} /> Values in the cells</label>
    <span class="note">
      {picked ? `${picked.series} ${picked.category}: ${picked.value}` : 'A day by hour matrix with three colour ramps, and a year of days as a calendar. Click a cell.'}
    </span>
  </header>

  <div class="pane">
    {#if view === 'chart'}
      <SvChart spec={heat} legend={false} selectable onSelect={(s) => (picked = s)} autosize />
    {:else}
      <ChartDataGrid spec={heat} />
    {/if}
  </div>
  <div class="pane">
    {#if view === 'chart'}
      <SvChart spec={calendar} legend={false} autosize />
    {:else}
      <ChartDataGrid spec={calendar} />
    {/if}
  </div>
</section>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 10px;
    overflow: auto;
  }
  .chrome {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    flex: none;
  }
  .note {
    font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
  .chk,
  .ctl {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
    white-space: nowrap;
  }
  .ctl select {
    font: inherit;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
    background: var(--sg-bg, #fff);
    color: inherit;
    padding: 2px 6px;
  }
  .pane {
    flex: none;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 8px 10px;
    min-width: 0;
  }
</style>
