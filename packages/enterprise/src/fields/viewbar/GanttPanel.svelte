<script lang="ts">
  /**
   * "Customize timeline": the fields a Gantt view draws with - when a record
   * starts and ends, the percent field its bar fills with, and the link field
   * naming the records it waits for (drawn as arrows). Each change shows at
   * once and is kept in the view.
   */
  import { panelFocus } from './panel-focus'
  import { dateColumns, dependencyColumns, progressColumns, type FieldView } from '../view-model'

  type Settings = Pick<FieldView, 'dateField' | 'endField' | 'progressField' | 'dependencyField'>
  let { ctrl, view, onChange }: { ctrl: any; view: Settings; onChange: (next: Settings) => void } = $props()

  const dates = $derived(dateColumns(ctrl))
  const progress = $derived(progressColumns(ctrl))
  const deps = $derived(dependencyColumns(ctrl))
  const valueOf = (e: Event) => (e.currentTarget as HTMLSelectElement).value || undefined
  const set = (key: keyof Settings, e: Event) => onChange({ ...view, [key]: valueOf(e) })
</script>

<div class="sv-fvb-panel sv-fgantt-panel" use:panelFocus>
  <p class="sv-fvb-title">Timeline</p>
  <label class="sv-fgantt-field">
    <span>Start date</span>
    <select class="sv-fvb-select" value={view.dateField} onchange={(e) => set('dateField', e)}>
      {#each dates as c (c.id)}<option value={c.id}>{c.header}</option>{/each}
    </select>
  </label>
  <label class="sv-fgantt-field">
    <span>End date</span>
    <select class="sv-fvb-select" value={view.endField ?? ''} onchange={(e) => set('endField', e)}>
      <option value="">None (a milestone)</option>
      {#each dates.filter((c) => c.id !== view.dateField) as c (c.id)}<option value={c.id}>{c.header}</option>{/each}
    </select>
  </label>
  <label class="sv-fgantt-field">
    <span>Progress</span>
    <select class="sv-fvb-select" value={view.progressField ?? ''} onchange={(e) => set('progressField', e)} disabled={!progress.length}>
      <option value="">None</option>
      {#each progress as c (c.id)}<option value={c.id}>{c.header}</option>{/each}
    </select>
  </label>
  <label class="sv-fgantt-field">
    <span>Depends on</span>
    <select class="sv-fvb-select" value={view.dependencyField ?? ''} onchange={(e) => set('dependencyField', e)} disabled={!deps.length}>
      <option value="">None</option>
      {#each deps as c (c.id)}<option value={c.id}>{c.header}</option>{/each}
    </select>
  </label>
  {#if !deps.length}
    <p class="sv-fgantt-hint">Arrows between records come from a link field to this same table.</p>
  {/if}
</div>

<style>
  .sv-fgantt-panel { display: flex; flex-direction: column; gap: 10px; min-width: 280px; }
  .sv-fgantt-field { display: grid; grid-template-columns: 96px 1fr; align-items: center; gap: 8px; font-size: 13px; }
  .sv-fgantt-field > span { color: var(--sg-muted, #64748b); }
  .sv-fgantt-hint { margin: 0; max-width: 280px; font-size: 12px; color: var(--sg-muted, #64748b); }
</style>
