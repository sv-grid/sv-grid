<script lang="ts" module>
  /**
   * Stats with trends block - a weekly report section: four figures, each
   * with an inline SVG icon, the previous week's value and a trend chip.
   * Metrics where lower is better (churn, load time) flip the chip color.
   * The Export CSV SvButton writes the raw numbers to a Blob, downloads it
   * through an object URL (revoked after) and confirms with SvToaster.
   * Values are formatted with Intl.NumberFormat. Pure UI-kit, --sg-* themed.
   *
   * Headless: createWeeklyReport() below owns the metrics, the change and
   * better-or-worse rule, the formatting and the CSV text with no markup; the
   * download itself is yours. The component under it is one styled render of
   * that core; import createWeeklyReport from this file (or `npx @svgrid/ui
   * add stats-trends --headless` for the core alone) to draw your own.
   */
  export type WeekMetric = {
    id: string; label: string; icon: string; value: number; previous: number
    format: Intl.NumberFormatOptions; lowerIsBetter?: boolean
  }
  export type WeekRow = WeekMetric & { change: number; good: boolean; shown: string; prevShown: string; changeText: string }
  export type WeekInfo = { name: string; range: string; file: string }
  export type WeeklyReportOptions = {
    week?: WeekInfo
    metrics?: WeekMetric[]
    /** Receives the CSV text and a file name; save or upload it. */
    onExport?: (csv: string, fileName: string) => void
    locale?: string
  }

  // Raw values for week 41 and week 40. Icon = one SVG path on a 20x20 box.
  const SAMPLE_WEEK: WeekInfo = { name: 'Week 41', range: 'Oct 5 - Oct 11, 2026', file: 'acme-week-41.csv' }
  const SAMPLE_METRICS: WeekMetric[] = [
    { id: 'signups', label: 'New signups', value: 1284, previous: 1140, format: {}, icon: 'M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 8c0-3 2.2-5 5-5s5 2 5 5M15 6v6M12 9h6' },
    { id: 'teams', label: 'Active teams', value: 3912, previous: 3870, format: {}, icon: 'M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6.5 0a2.5 2.5 0 1 0 0-5M2 17c0-3 2.2-5 5-5s5 2 5 5m2.5-4.6c1.9.4 3.5 2 3.5 4.6' },
    { id: 'churn', label: 'Accounts churned', value: 18, previous: 25, format: {}, lowerIsBetter: true, icon: 'M8 3H4v14h4M12 6l4 4-4 4M16 10H8' },
    { id: 'load', label: 'Median dashboard load', value: 1.21, previous: 1.08, lowerIsBetter: true, format: { style: 'unit', unit: 'second', unitDisplay: 'short', maximumFractionDigits: 2 }, icon: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-12v4l3 2' },
  ]

  function csvCell(v: string | number): string {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }

  export function createWeeklyReport(opts: WeeklyReportOptions = {}) {
    // Rows are computed once; the CSV carries the raw numbers, not the formatted text.
    const week = opts.week ?? SAMPLE_WEEK
    const metrics = opts.metrics ?? SAMPLE_METRICS
    const pct = new Intl.NumberFormat(opts.locale, { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' })
    const rows: WeekRow[] = metrics.map((m) => {
      const f = new Intl.NumberFormat(opts.locale, m.format)
      const change = (m.value - m.previous) / m.previous
      const good = m.lowerIsBetter ? change <= 0 : change >= 0
      return { ...m, change, good, shown: f.format(m.value), prevShown: f.format(m.previous), changeText: pct.format(change) }
    })

    /** Raw numbers, one row per metric, with a header line. */
    function csv(): string {
      const lines = [
        ['metric', 'this_week', 'previous_week', 'change_pct'],
        ...metrics.map((m) => [m.label, m.value, m.previous, ((m.value - m.previous) / m.previous * 100).toFixed(1)]),
      ]
      return lines.map((l) => l.map(csvCell).join(',')).join('\n') + '\n'
    }

    return {
      week,
      rows,
      csv,
      exportCsv: () => opts.onExport?.(csv(), week.file),
    }
  }
</script>

<script lang="ts">
  import { SvButton, SvToaster, toast } from '@svgrid/grid'

  function download(text: string, fileName: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    // Give the browser a tick to start the download before the URL goes away.
    setTimeout(() => URL.revokeObjectURL(url), 0)
    toast.success(`${fileName} downloaded`, { title: 'Export ready' })
  }

  const report = createWeeklyReport({ onExport: download })
</script>

<section class="sv-stats-trends" aria-labelledby="stats-trends-title">
  <header class="sv-stats-trends-head">
    <div>
      <h2 id="stats-trends-title">{report.week.name} report</h2>
      <p class="sv-stats-trends-sub">{report.week.range}, compared with the week before.</p>
    </div>
    <SvButton variant="secondary" onclick={report.exportCsv}>
      {#snippet icon()}
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 2v8m-3.5-3.5L8 10l3.5-3.5M2.5 13.5h11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
      {/snippet}
      Export CSV
    </SvButton>
  </header>

  <ul class="sv-stats-trends-list">
    {#each report.rows as m (m.id)}
      <li class="sv-stats-trends-item">
        <span class="sv-stats-trends-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="20" height="20"><path d={m.icon} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </span>
        <span class="sv-stats-trends-label">{m.label}</span>
        <span class="sv-stats-trends-value">{m.shown}</span>
        <span class="sv-stats-trends-foot">
          <span class="sv-stats-trends-chip" class:sv-stats-trends-bad={!m.good}>
            <svg viewBox="0 0 10 10" width="10" height="10" class:sv-stats-trends-down={m.change < 0} aria-hidden="true"><path d="M5 1.5 9 8.5H1z" fill="currentColor" /></svg>
            {m.changeText}
            <span class="sv-stats-trends-sr">{m.good ? '(better)' : '(worse)'}</span>
          </span>
          <span class="sv-stats-trends-prev">from {m.prevShown}</span>
        </span>
      </li>
    {/each}
  </ul>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-stats-trends {
    width: 100%; box-sizing: border-box;
    display: flex; flex-direction: column; justify-content: center;
    min-height: 320px; padding: 36px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 14px);
  }
  .sv-stats-trends-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px 24px; flex-wrap: wrap; margin-bottom: 28px; }
  h2 { margin: 0; font-size: 26px; font-weight: 700; line-height: 1.2; letter-spacing: -.02em; }
  .sv-stats-trends-sub { margin: 6px 0 0; font-size: 14px; color: var(--sg-muted, #64748b); }

  .sv-stats-trends-list { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 32px 28px; margin: 0; padding: 0; list-style: none; }
  .sv-stats-trends-item { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .sv-stats-trends-icon {
    display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; margin-bottom: 8px;
    border-radius: var(--sg-radius, 8px); color: var(--sg-fg, #0f172a);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, var(--sg-bg, #fff));
  }
  .sv-stats-trends-icon svg, .sv-stats-trends-chip svg { display: block; }
  .sv-stats-trends-label { font-size: 14px; color: var(--sg-muted, #64748b); }
  .sv-stats-trends-value { font-size: 36px; font-weight: 700; line-height: 1.1; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
  .sv-stats-trends-foot { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 13px; }
  .sv-stats-trends-chip {
    display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px;
    font-weight: 600; font-variant-numeric: tabular-nums;
    color: var(--sg-success, #16a34a); background: color-mix(in srgb, var(--sg-success, #16a34a) 13%, transparent);
  }
  .sv-stats-trends-chip.sv-stats-trends-bad { color: var(--sg-danger, #dc2626); background: color-mix(in srgb, var(--sg-danger, #dc2626) 13%, transparent); }
  .sv-stats-trends-chip svg.sv-stats-trends-down { transform: rotate(180deg); }
  .sv-stats-trends-prev { color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .sv-stats-trends-sr {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }

  @media (max-width: 900px) {
    .sv-stats-trends-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 520px) {
    .sv-stats-trends { padding: 24px 16px; }
    h2 { font-size: 22px; }
    .sv-stats-trends-list { gap: 26px 14px; }
    .sv-stats-trends-value { font-size: 28px; }
  }
</style>
