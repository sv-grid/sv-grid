<script lang="ts">
  /**
   * SvChartPanes - a price chart with indicator panes stacked under it, the
   * way a trading terminal lays them out: one shared x axis (labelled on the
   * last pane only), one value-axis gutter width so the plots line up, and
   * one crosshair / zoom window across all of them.
   *
   * Composition, not a new layout: every pane is a full `SvChart` in a sync
   * group of its own, so tooltips, keyboard navigation, the screen-reader
   * table, export and the context menu all come for free, and the geometry
   * stays single-plot. The main chart takes every `SvChart` prop.
   */
  import SvGridChart from './SvGridChart.svelte'
  import { indicatorPane, type ChartIndicatorSpec } from './chart-indicators'
  import type { ChartSpec, ChartZoomWindow } from './chart-types'
  import type { SvChartProps } from './SvGridChart.types'

  type Props = Omit<SvChartProps, 'spec' | 'syncGroup' | 'zoom'> & {
    /** The price spec: a candlestick / OHLC / line chart with the series the
     *  indicators read (`ohlc` and `volumes` on it for the volume-based ones). */
    spec: ChartSpec
    /** The panes under the price, top to bottom. */
    indicators?: ChartIndicatorSpec[]
    /** A sync group to share with charts outside the stack. Default: private. */
    syncGroup?: string
    /** Width of the value-axis gutter every pane uses, so the plots line up.
     *  Default 56. */
    axisWidth?: number
    /** The shared zoom window, bindable. */
    zoom?: ChartZoomWindow | null
  }
  let {
    spec,
    indicators = [],
    syncGroup,
    axisWidth = 56,
    zoom = $bindable(null),
    onZoom,
    zoomable,
    legend,
    toolbar,
    ...rest
  }: Props = $props()

  const uid = `svcp-${Math.random().toString(36).slice(2, 8)}`
  const group = $derived(syncGroup ?? uid)
  // Every pane is laid out at the stack's pixel width, so the panes line up
  // and none of them is a 520px viewBox stretched across a 900px column.
  // Heights stay what the specs say; only the width follows the container.
  let hostW = $state(0)
  const widthOf = (s: ChartSpec) => (hostW > 0 && !s.width ? { width: Math.round(hostW) } : {})
  /** The price chart hides its x labels when a pane below will show them. */
  const mainSpec = $derived<ChartSpec>({
    ...spec,
    ...widthOf(spec),
    xAxis: { ...spec.xAxis, ...(indicators.length ? { labels: false } : {}) },
    yAxis: { ...spec.yAxis, width: axisWidth },
    ...(spec.y2Axis || spec.series.some((s) => s.axis === 'right') ? { y2Axis: { ...spec.y2Axis, width: axisWidth } } : {}),
  })
  // The pane's title is drawn by this component as a small corner label
  // rather than by the chart frame, which would take a third of a 100px
  // pane for it.
  const panes = $derived(
    indicators.map((ind, i) => {
      const { title, ...pane } = indicatorPane(spec, ind)
      return {
        title: title ?? ind.kind,
        spec: {
          ...pane,
          ...widthOf(pane),
          xAxis: { ...pane.xAxis, labels: i === indicators.length - 1 },
          yAxis: { ...pane.yAxis, width: axisWidth },
        } satisfies ChartSpec,
      }
    }),
  )
</script>

<div class="sv-chart-panes" bind:clientWidth={hostW}>
  <div class="sv-chart-pane is-main">
    <SvGridChart spec={mainSpec} syncGroup={group} bind:zoom {onZoom} {zoomable} {legend} {toolbar} {...rest} />
  </div>
  {#each panes as pane, i (`${indicators[i]?.kind}-${i}`)}
    <div class="sv-chart-pane is-indicator" data-indicator={indicators[i]?.kind}>
      <span class="sv-chart-pane-title" style:left={`${axisWidth + 6}px`}>{pane.title}</span>
      <SvGridChart spec={pane.spec} syncGroup={group} zoomable={zoomable ? { drag: false, wheel: typeof zoomable === 'object' ? zoomable.wheel : false, pan: typeof zoomable === 'object' ? zoomable.pan : false } : false} legend={false} toolbar={false} interactive localeText={rest.localeText} />
    </div>
  {/each}
</div>

<style>
  .sv-chart-panes {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .sv-chart-pane {
    position: relative;
    min-width: 0;
  }
  /* The title of a pane sits in its top-left corner, small, like a terminal. */
  /* Placed just right of the value-axis gutter, clear of the tick labels. */
  .sv-chart-pane-title {
    position: absolute;
    top: 2px;
    z-index: 1;
    font-size: 10px;
    font-weight: 600;
    color: var(--sg-muted, #64748b);
    pointer-events: none;
  }
</style>
