<script lang="ts">
  /**
   * SvSparkline - a tiny inline chart (line / area / bar / win-loss) from a number
   * array. A thin SVG renderer over the pure `buildSparkline` geometry (shared
   * with the grid's sparkline cell). Theme-driven (defaults to `--sg-accent`).
   *
   * ```svelte
   * <SvSparkline data={[3, 7, 4, 9, 6, 11, 8]} type="area" />
   * ```
   */
  import { buildSparkline, type SparklineType } from './sparkline'

  type Props = {
    data: ReadonlyArray<number>
    type?: SparklineType
    width?: number
    height?: number
    color?: string
    negativeColor?: string
    lineWidth?: number
    /** Fix the value scale instead of deriving it from the data. */
    min?: number
    max?: number
    /** End-cap dot on the last point (line / area). Default true. */
    lastPoint?: boolean
    ariaLabel?: string
  }

  let {
    data,
    type = 'line',
    width = 88,
    height = 22,
    color,
    negativeColor,
    lineWidth,
    min,
    max,
    lastPoint = true,
    ariaLabel,
  }: Props = $props()

  const geo = $derived(
    buildSparkline([...data], { type, width, height, color, negativeColor, lineWidth, min, max, lastPoint }),
  )
</script>

{#if geo}
  <svg
    class="sv-spark"
    width={geo.width}
    height={geo.height}
    viewBox={`0 0 ${geo.width} ${geo.height}`}
    preserveAspectRatio="none"
    role="img"
    aria-label={ariaLabel ?? 'sparkline'}
  >
    {#if type === 'area' && geo.areaPath}
      <path d={geo.areaPath} fill={geo.color} fill-opacity="0.15" stroke="none" />
    {/if}
    {#if (type === 'line' || type === 'area') && geo.linePath}
      <path d={geo.linePath} fill="none" stroke={geo.color} stroke-width={geo.lineWidth} stroke-linejoin="round" stroke-linecap="round" />
    {/if}
    {#if type === 'bar' || type === 'winloss'}
      {#each geo.bars as b, i (i)}
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="0.5" fill={b.negative ? geo.negativeColor : geo.color} />
      {/each}
    {/if}
    {#if lastPoint && geo.lastPoint && (type === 'line' || type === 'area')}
      <circle cx={geo.lastPoint.x} cy={geo.lastPoint.y} r={geo.lineWidth + 0.8} fill={geo.color} />
    {/if}
  </svg>
{/if}

<style>
  .sv-spark { display: inline-block; vertical-align: middle; overflow: visible; }
</style>
