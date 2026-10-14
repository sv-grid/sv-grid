<script lang="ts">
  /**
   * The view bar's "Color": no colors, the option colors of a single select,
   * or conditions in order, each with its own color (the first match colors
   * the row's header).
   */
  import { panelFocus } from './panel-focus'
  import { filterKindOf, newCondition, operatorsFor, defaultValue, type FieldCondition, type FilterOp } from '../filter-model'
  import { fieldColumns } from '../grid-access'
  import { BRIGHT } from '../palette'
  import type { ColorSetting } from '../view-model'
  import ConditionValue from './ConditionValue.svelte'

  let { ctrl, setting, onChange }: { ctrl: any; setting: ColorSetting; onChange: (s: ColorSetting) => void } = $props()

  const selects = $derived(fieldColumns(ctrl).filter((c) => c.fieldType === 'singleSelect'))
  const columns = $derived(fieldColumns(ctrl).filter((c) => filterKindOf(c.def)))
  const rules = $derived(setting.mode === 'conditions' ? setting.rules : [])

  function mode(m: ColorSetting['mode']) {
    if (m === 'none') return onChange({ mode: 'none' })
    if (m === 'field') return selects[0] ? onChange({ mode: 'field', field: selects[0].field }) : undefined
    onChange({ mode: 'conditions', rules: rules.length ? rules : [] })
  }
  function setRules(next: Array<{ color: string; condition: FieldCondition }>) {
    onChange({ mode: 'conditions', rules: next })
  }
  function addRule() {
    const c = columns[0]
    const condition = c && newCondition(c.id, c.def)
    if (!condition) return
    setRules([...rules, { color: BRIGHT[rules.length % BRIGHT.length]!.value, condition }])
  }
  const put = (i: number, r: { color: string; condition: FieldCondition } | null) =>
    setRules(r ? rules.map((x, j) => (j === i ? r : x)) : rules.filter((_, j) => j !== i))
  function changeOp(c: FieldCondition, op: FilterOp): FieldCondition {
    return { ...c, op, value: defaultValue(c.kind, op) }
  }
</script>

<div class="sv-fvb-panel sv-fvb-panel-wide sv-fcolor" use:panelFocus>
  <div class="sv-fcolor-modes" role="radiogroup" aria-label="Color rows">
    {#each [['none', 'None'], ['field', 'Select field'], ['conditions', 'Conditions']] as [m, label] (m)}
      <button
        type="button"
        role="radio"
        aria-checked={setting.mode === m}
        class="sv-fcolor-mode"
        class:is-on={setting.mode === m}
        disabled={m === 'field' && !selects.length}
        onclick={() => mode(m as ColorSetting['mode'])}>{label}</button
      >
    {/each}
  </div>

  {#if setting.mode === 'field'}
    <p class="sv-fvb-title">Color records the same as a single select field</p>
    <select class="sv-fvb-select" aria-label="Select field" value={setting.field} onchange={(e) => onChange({ mode: 'field', field: (e.currentTarget as HTMLSelectElement).value })}>
      {#each selects as s (s.id)}<option value={s.field}>{s.header}</option>{/each}
    </select>
  {:else if setting.mode === 'conditions'}
    <p class="sv-fvb-title">Color records that match a condition; the first match wins</p>
    {#each rules as r, i (i)}
      {@const col = columns.find((x) => x.id === r.condition.column)}
      <div class="sv-fcolor-row">
        <label class="sv-fcolor-swatch" style:background={r.color} title="Color">
          <select aria-label="Color" value={r.color} onchange={(e) => put(i, { ...r, color: (e.currentTarget as HTMLSelectElement).value })}>
            {#each BRIGHT as b (b.value)}<option value={b.value}>{b.label}</option>{/each}
          </select>
        </label>
        <select
          class="sv-fvb-select"
          aria-label="Field"
          value={r.condition.column}
          onchange={(e) => {
            const c = columns.find((x) => x.id === (e.currentTarget as HTMLSelectElement).value)
            const condition = c && newCondition(c.id, c.def)
            if (condition) put(i, { ...r, condition })
          }}
        >
          {#each columns as x (x.id)}<option value={x.id}>{x.header}</option>{/each}
        </select>
        <select class="sv-fvb-select" aria-label="Operator" value={r.condition.op} onchange={(e) => put(i, { ...r, condition: changeOp(r.condition, (e.currentTarget as HTMLSelectElement).value as FilterOp) })}>
          {#each operatorsFor(r.condition.kind) as o (o.op)}<option value={o.op}>{o.label}</option>{/each}
        </select>
        <span class="sv-fcolor-value">
          {#if col}<ConditionValue column={col} condition={r.condition} onChange={(value) => put(i, { ...r, condition: { ...r.condition, value } })} />{/if}
        </span>
        <button type="button" class="sv-fvb-icon-btn" aria-label="Remove condition" onclick={() => put(i, null)}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
      </div>
    {/each}
    <div class="sv-fvb-foot">
      <button type="button" class="sv-fvb-text-btn" onclick={addRule}>+ Add condition</button>
    </div>
  {:else}
    <p class="sv-fvb-empty">Rows are not colored</p>
  {/if}
</div>

<style>
  .sv-fcolor { width: 560px; max-width: 100%; }
  .sv-fcolor-modes { display: inline-flex; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 8px; padding: 2px; margin-bottom: 8px; }
  .sv-fcolor-mode { border: 0; border-radius: 6px; padding: 3px 10px; background: none; color: inherit; font: inherit; cursor: pointer; }
  .sv-fcolor-mode.is-on { background: color-mix(in srgb, var(--sg-accent, #2563eb) 14%, transparent); color: var(--sg-fg, #0f172a); }
  .sv-fcolor-mode:disabled { opacity: 0.45; cursor: default; }
  .sv-fcolor-row { display: grid; grid-template-columns: 24px 130px 120px minmax(0, 1fr) 28px; gap: 6px; align-items: start; margin: 6px 0; }
  .sv-fcolor-row > :global(*) { min-width: 0; }
  .sv-fcolor-swatch { position: relative; width: 22px; height: 22px; margin-top: 3px; border-radius: 6px; cursor: pointer; }
  .sv-fcolor-swatch select { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
</style>
