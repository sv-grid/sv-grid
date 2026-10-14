<script lang="ts">
  /**
   * A chart view: the records the view shows (its filter applies), grouped
   * and counted or added up as its setting says. The grid stays mounted
   * under it, hidden: it is where the records, the filter and the sort live.
   */
  import { SvChart } from '@svgrid/grid'
  import { dataRows, gridOf } from './grid-access'
  import { chartFormatter, chartSpec, type ChartSetting } from './chart-view'

  let { api, setting }: { api: any; setting: ChartSetting | undefined } = $props()

  const ctrl = $derived(api ? gridOf(api) : null)
  const rows = $derived(ctrl ? dataRows(ctrl).map((r) => r.original) : [])
  const formatValue = $derived(ctrl && setting ? chartFormatter(ctrl, setting) : undefined)
  const spec = $derived.by(() => {
    const s = ctrl && setting ? chartSpec(ctrl, setting, rows) : null
    if (!s || !formatValue || s.type === 'pie' || s.orientation === 'horizontal') return s
    // The value axis gutter fits the widest tick as the field writes it
    // ("$1,000,000"); the chart's own default fits its short "1M" style.
    const max = Math.max(0, ...s.series.flatMap((x) => x.values))
    const top = max > 0 ? 10 ** Math.ceil(Math.log10(max)) : 1
    const width = Math.max(48, Math.round(formatValue(top).length * 6.4 + 14))
    return { ...s, yAxis: { width } }
  })
  const isPie = $derived(setting?.kind === 'pie' || setting?.kind === 'donut')
</script>

<div class="sv-fchart">
  {#if spec && spec.categories.length}
    <div class="sv-fchart-plot">
      <SvChart {spec} {formatValue} autosize legend={isPie} dataLabels={isPie} />
    </div>
  {:else}
    <p class="sv-fchart-empty">{spec ? 'No records to chart. The view\'s filter may hide them all.' : 'Choose a field to chart in Customize chart.'}</p>
  {/if}
</div>

<style>
  .sv-fchart {
    position: absolute; inset: 0; display: flex; flex-direction: column; box-sizing: border-box; padding: 16px 20px 12px;
    background: var(--sg-bg, #fff); font-family: var(--sg-font, inherit);
  }
  .sv-fchart-plot { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
  .sv-fchart-plot > :global(*) { flex: 1 1 auto; min-height: 0; }
  .sv-fchart-empty { margin: auto; font-size: 14px; color: var(--sg-muted, #64748b); }
</style>
