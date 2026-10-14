<script lang="ts">
  /**
   * "Customize chart": the chart's kind, the field the records are grouped
   * by, and the value - the number of records, or a number field's sum or
   * average. Each change shows at once and is kept in the view.
   */
  import { panelFocus } from './panel-focus'
  import { CHART_KINDS, chartXColumns, chartYColumns, type ChartKind, type ChartSetting } from '../chart-view'

  let { ctrl, setting, onChange }: { ctrl: any; setting: ChartSetting; onChange: (next: ChartSetting) => void } = $props()

  const xs = $derived(chartXColumns(ctrl))
  const ys = $derived(chartYColumns(ctrl))
  const hasX = $derived(xs.some((c) => c.id === setting.x))
  const valueOf = (e: Event) => (e.currentTarget as HTMLSelectElement).value

  function setY(v: string) {
    const { y: _old, aggregation: _agg, ...rest } = setting
    onChange(v ? { ...rest, y: v, aggregation: setting.aggregation ?? 'sum' } : rest)
  }
</script>

<div class="sv-fvb-panel sv-fchart-panel" use:panelFocus>
  <p class="sv-fvb-title">Chart</p>
  <label class="sv-fchart-field">
    <span>Type</span>
    <select class="sv-fvb-select" value={setting.kind} onchange={(e) => onChange({ ...setting, kind: valueOf(e) as ChartKind })}>
      {#each CHART_KINDS as k (k.kind)}<option value={k.kind}>{k.label}</option>{/each}
    </select>
  </label>
  <label class="sv-fchart-field">
    <span>Group by</span>
    <select class="sv-fvb-select" value={setting.x} onchange={(e) => onChange({ ...setting, x: valueOf(e) })}>
      <!-- No field yet (or the one picked was deleted): a prompt, so any pick is a change. -->
      {#if !hasX}<option value={setting.x} disabled>Choose a field</option>{/if}
      {#each xs as c (c.id)}<option value={c.id}>{c.header}</option>{/each}
    </select>
  </label>
  <label class="sv-fchart-field">
    <span>Value</span>
    <select class="sv-fvb-select" value={setting.y ?? ''} onchange={(e) => setY(valueOf(e))}>
      <option value="">Number of records</option>
      {#each ys as c (c.id)}<option value={c.id}>{c.header}</option>{/each}
    </select>
  </label>
  {#if setting.y}
    <label class="sv-fchart-field">
      <span>Combine</span>
      <select class="sv-fvb-select" value={setting.aggregation ?? 'sum'} onchange={(e) => onChange({ ...setting, aggregation: valueOf(e) as 'sum' | 'avg' })}>
        <option value="sum">Sum</option>
        <option value="avg">Average</option>
      </select>
    </label>
  {/if}
</div>

<style>
  .sv-fchart-panel { display: flex; flex-direction: column; gap: 10px; min-width: 260px; }
  .sv-fchart-field { display: grid; grid-template-columns: 90px 1fr; align-items: center; gap: 8px; font-size: 13px; }
  .sv-fchart-field > span { color: var(--sg-muted, #64748b); }
</style>
