<script lang="ts" module>
  /**
   * Page heading with stats block - a dashboard page header: h1 and scope
   * line, a "Download report" SvButton, and an SvSegmented range switch
   * (7d / 30d / 90d). Under it a row of four SvStat values with deltas
   * (refund rate uses `invert`, so a drop reads green) and a light bar strip;
   * all of it re-reads when the range changes. SvToaster confirms the
   * download. Pure UI-kit, --sg-* themed.
   *
   * Headless: createRevenueHeading() below owns the range, the figures for
   * that range and the report download with no markup. The component under it
   * is one styled render of that core; import createRevenueHeading from this
   * file (or `npx @svgrid/ui add page-headings-stats --headless` for the core
   * alone) to draw your own.
   */
  const RANGE_IDS = ['7d', '30d', '90d'] as const
  export type RevenueRange = (typeof RANGE_IDS)[number]
  export type RevenueKpi = { label: string; value: string; delta: number; invert?: boolean }
  export type RevenueView = { kpis: RevenueKpi[]; bars: number[] }
  export type RevenueHeadingOptions = {
    /** Figures per range; bars are heights in percent. Load these from your API. */
    data?: Record<RevenueRange, RevenueView>
    range?: RevenueRange
    /** Build the report for a range; throw (or reject) to report a failure. */
    onDownload?: (range: RevenueRange) => Promise<void> | void
  }

  const SAMPLE_DATA: Record<RevenueRange, RevenueView> = {
    '7d': {
      kpis: [
        { label: 'Revenue', value: '$48.2k', delta: 6.1 },
        { label: 'Orders', value: '1,284', delta: 3.4 },
        { label: 'Avg. order', value: '$37.54', delta: 2.6 },
        { label: 'Refund rate', value: '1.8%', delta: -0.4, invert: true },
      ],
      bars: [52, 61, 48, 70, 66, 74, 81],
    },
    '30d': {
      kpis: [
        { label: 'Revenue', value: '$196k', delta: 12.4 },
        { label: 'Orders', value: '5,402', delta: 8.9 },
        { label: 'Avg. order', value: '$36.28', delta: 3.2 },
        { label: 'Refund rate', value: '2.1%', delta: 0.3, invert: true },
      ],
      bars: [40, 46, 44, 52, 58, 55, 63, 60, 68, 72, 70, 79],
    },
    '90d': {
      kpis: [
        { label: 'Revenue', value: '$571k', delta: -2.8 },
        { label: 'Orders', value: '15,930', delta: -1.1 },
        { label: 'Avg. order', value: '$35.84', delta: -1.7 },
        { label: 'Refund rate', value: '2.4%', delta: -0.6, invert: true },
      ],
      bars: [72, 68, 75, 70, 64, 60, 66, 58, 62, 57, 61, 65, 63],
    },
  }
  const COMPARED: Record<RevenueRange, string> = { '7d': 'previous 7 days', '30d': 'previous 30 days', '90d': 'previous quarter' }
  const RANGES = RANGE_IDS.map((v) => ({ value: v, label: v }))

  export function createRevenueHeading(opts: RevenueHeadingOptions = {}) {
    // Sample figures stand in when the app passes none; an unknown range reads as 30d.
    const data = opts.data ?? SAMPLE_DATA
    // string | number so it binds straight to a segmented control.
    let range = $state<string | number>(opts.range ?? '30d')
    let downloading = $state(false)

    const r = $derived<RevenueRange>(range === '7d' || range === '90d' ? range : '30d')
    const view = $derived(data[r])

    async function download() {
      if (downloading) return
      downloading = true
      try {
        await opts.onDownload?.(r)
      } catch {
        // The caller reports the failure.
      } finally {
        downloading = false
      }
    }

    return {
      ranges: RANGES,
      get range() { return range },
      set range(v: string | number) { range = v },
      /** The range as a known key ('30d' for anything unknown). */
      get current() { return r },
      get view() { return view },
      /** "vs previous 30 days" style hint for the current range. */
      get compared() { return `vs ${COMPARED[r]}` },
      get downloading() { return downloading },
      download,
      /** The delta to show: percentage points for inverted (rate) KPIs, percent otherwise. */
      deltaOf: (k: RevenueKpi): string | number => (k.invert ? `${k.delta > 0 ? '+' : ''}${k.delta} pp` : k.delta),
    }
  }
</script>

<script lang="ts">
  import { SvSegmented, SvStat, SvButton, SvToaster, toast } from '@svgrid/grid'

  const revenue = createRevenueHeading({
    // Replace with your report request.
    onDownload: (r) =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 900)), {
        loading: 'Building the PDF...',
        success: `revenue-${r}.pdf is ready`,
        error: 'Report failed',
      }),
  })
</script>

<div class="sv-ph-stats">
  <header class="sv-ph-stats-head">
    <div class="sv-ph-stats-titles">
      <h1>Revenue</h1>
      <p class="sv-ph-stats-sub">Acme Analytics store, all regions, USD</p>
    </div>
    <div class="sv-ph-stats-actions">
      <SvSegmented bind:value={revenue.range} ariaLabel="Date range" options={revenue.ranges} />
      <SvButton variant="secondary" loading={revenue.downloading} onclick={revenue.download}>Download report</SvButton>
    </div>
  </header>

  <div class="sv-ph-stats-kpis">
    {#each revenue.view.kpis as k (k.label)}
      <!-- Refund rate moves in percentage points, so it gets a preformatted delta. -->
      <SvStat label={k.label} value={k.value} invert={k.invert} hint={revenue.compared}
        delta={revenue.deltaOf(k)} trend={k.delta > 0 ? 'up' : 'down'} />
    {/each}
  </div>

  <div class="sv-ph-stats-bars" aria-hidden="true">
    {#each revenue.view.bars as h, i (i)}
      <span style:height={`${h}%`}></span>
    {/each}
  </div>
</div>

<SvToaster position="bottom-right" />

<style>
  .sv-ph-stats {
    min-height: 380px; padding: 28px 32px; box-sizing: border-box;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 14px);
  }
  .sv-ph-stats-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px 24px; flex-wrap: wrap; }
  .sv-ph-stats-titles { min-width: 0; }
  h1 { margin: 0; font-weight: 700; font-size: 26px; line-height: 1.2; letter-spacing: -.02em; }
  .sv-ph-stats-sub { margin: 6px 0 0; font-size: 14px; color: var(--sg-muted, #64748b); }
  .sv-ph-stats-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

  .sv-ph-stats-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }

  .sv-ph-stats-bars {
    display: flex; align-items: flex-end; gap: 6px; height: 96px; margin-top: 16px; padding: 12px 14px 0;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); background: var(--sg-bg-subtle, #f8fafc);
  }
  .sv-ph-stats-bars span {
    flex: 1; min-width: 0; border-radius: 4px 4px 0 0;
    background: color-mix(in srgb, var(--sg-muted, #64748b) 28%, transparent);
    transition: height .25s ease;
  }
  .sv-ph-stats-bars span:last-child { background: color-mix(in srgb, var(--sg-muted, #64748b) 55%, transparent); }

  @media (max-width: 760px) {
    .sv-ph-stats-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 640px) {
    .sv-ph-stats { padding: 20px 16px; }
    h1 { font-size: 22px; }
    .sv-ph-stats-actions { width: 100%; justify-content: space-between; }
    .sv-ph-stats-kpis { gap: 8px; }
  }
</style>
