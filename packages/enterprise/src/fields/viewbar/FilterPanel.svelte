<script lang="ts">
  /**
   * The view bar's "Filter": "Where [field] [operator] [value]" rows joined
   * by "and" or "or", and condition groups one level deep. Each change
   * filters the grid at once; a condition without a value yet is left out.
   *
   * With `onChange` it edits `value` instead of the grid's filter: an alert
   * rule's condition is written with it, inside the rule's dialog.
   */
  import { panelFocus } from './panel-focus'
  import {
    defaultValue,
    filterKindOf,
    isGroup,
    newCondition,
    operatorsFor,
    type FieldCondition,
    type FieldConditionGroup,
    type FieldFilter,
    type FilterOp,
  } from '../filter-model'
  import { fieldColumns } from '../grid-access'
  import ConditionValue from './ConditionValue.svelte'

  let {
    ctrl,
    api,
    value,
    onChange,
    title = 'In this view, show records',
    empty = 'No filter conditions are applied to this view',
  }: {
    ctrl: any
    api?: any
    /** With `onChange`: the filter shown, in place of the grid's. */
    value?: FieldFilter | null
    onChange?: (filter: FieldFilter) => void
    title?: string
    empty?: string
  } = $props()

  const columns = $derived(fieldColumns(ctrl).filter((c) => filterKindOf(c.def)))
  const filter = $derived.by<FieldFilter>(() => {
    const f = (onChange ? value : ctrl.advancedFilter) as FieldFilter | null | undefined
    return f?.kind === 'fieldFilter' ? f : { kind: 'fieldFilter', conjunction: 'and', conditions: [] }
  })

  function save(next: FieldFilter) {
    if (onChange) return onChange(next)
    if (next.conditions.length) api.setAdvancedFilter(next)
    else api.clearAdvancedFilter()
  }
  const first = () => columns[0]
  function addCondition(groupAt?: number) {
    const c = first()
    if (!c) return
    const cond = newCondition(c.id, c.def)
    if (!cond) return
    const conditions = [...filter.conditions]
    if (groupAt == null) conditions.push(cond)
    else {
      const g = conditions[groupAt] as FieldConditionGroup
      conditions[groupAt] = { ...g, conditions: [...g.conditions, cond] }
    }
    save({ ...filter, conditions })
  }
  function addGroup() {
    const c = first()
    const cond = c && newCondition(c.id, c.def)
    if (!cond) return
    save({ ...filter, conditions: [...filter.conditions, { conjunction: 'and', conditions: [cond] }] })
  }
  /** Replace (or with null remove) a condition, at the top level or in a group. */
  function put(at: number, inner: number | null, next: FieldCondition | null) {
    const conditions = [...filter.conditions]
    if (inner == null) {
      if (next) conditions[at] = next
      else conditions.splice(at, 1)
    } else {
      const g = conditions[at] as FieldConditionGroup
      const list = [...g.conditions]
      if (next) list[inner] = next
      else list.splice(inner, 1)
      if (list.length) conditions[at] = { ...g, conditions: list }
      else conditions.splice(at, 1)
    }
    save({ ...filter, conditions })
  }
  function setConjunction(at: number | null, conj: 'and' | 'or') {
    if (at == null) return save({ ...filter, conjunction: conj })
    const conditions = [...filter.conditions]
    conditions[at] = { ...(conditions[at] as FieldConditionGroup), conjunction: conj }
    save({ ...filter, conditions })
  }

  // A panel in a popover takes focus when it opens; one inside a dialog does not.
  function takeFocus(node: HTMLElement, on: boolean) {
    return on ? panelFocus(node) : undefined
  }

  function changeField(c: FieldCondition, columnId: string): FieldCondition {
    const col = columns.find((x) => x.id === columnId)
    return (col && newCondition(col.id, col.def)) || c
  }
  /** A new operator keeps the value when it takes the same shape of value. */
  function changeOp(c: FieldCondition, op: FilterOp): FieldCondition {
    const shape = (o: FilterOp) =>
      c.kind === 'date' ? (o === 'isWithin' ? 'span' : 'day') : c.kind === 'select' ? (o === 'is' || o === 'isNot' ? 'one' : 'many') : 'same'
    const keep = shape(op) === shape(c.op) && op !== 'isEmpty' && op !== 'isNotEmpty'
    return { ...c, op, value: keep && c.value !== undefined ? c.value : defaultValue(c.kind, op) }
  }
</script>

{#snippet row(c: FieldCondition, index: number, conj: 'and' | 'or', setConj: (v: 'and' | 'or') => void, at: number, inner: number | null)}
  {@const col = columns.find((x) => x.id === c.column)}
  <div class="sv-ff-row">
    <span class="sv-ff-conj">
      {#if index === 0}
        Where
      {:else if index === 1}
        <select class="sv-fvb-select" aria-label="Join conditions with" value={conj} onchange={(e) => setConj((e.currentTarget as HTMLSelectElement).value as 'and' | 'or')}>
          <option value="and">and</option>
          <option value="or">or</option>
        </select>
      {:else}
        {conj}
      {/if}
    </span>
    <select class="sv-fvb-select" aria-label="Field" value={c.column} onchange={(e) => put(at, inner, changeField(c, (e.currentTarget as HTMLSelectElement).value))}>
      {#each columns as x (x.id)}<option value={x.id}>{x.header}</option>{/each}
    </select>
    <select class="sv-fvb-select" aria-label="Operator" value={c.op} onchange={(e) => put(at, inner, changeOp(c, (e.currentTarget as HTMLSelectElement).value as FilterOp))}>
      {#each operatorsFor(c.kind) as o (o.op)}<option value={o.op}>{o.label}</option>{/each}
    </select>
    <span class="sv-ff-value">
      {#if col}<ConditionValue column={col} condition={c} onChange={(value) => put(at, inner, { ...c, value })} />{/if}
    </span>
    <button type="button" class="sv-fvb-icon-btn" aria-label="Remove condition" title="Remove condition" onclick={() => put(at, inner, null)}>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
  </div>
{/snippet}

<div class="sv-fvb-panel sv-fvb-panel-wide sv-ff" class:is-inline={!!onChange} use:takeFocus={!onChange}>
  {#if filter.conditions.length}
    {#if title}<p class="sv-fvb-title">{title}</p>{/if}
    {#each filter.conditions as c, i (i)}
      {#if isGroup(c)}
        {@const g = c}
        <div class="sv-ff-row">
          <span class="sv-ff-conj">
            {#if i === 0}Where{:else if i === 1}
              <select class="sv-fvb-select" aria-label="Join conditions with" value={filter.conjunction} onchange={(e) => setConjunction(null, (e.currentTarget as HTMLSelectElement).value as 'and' | 'or')}>
                <option value="and">and</option>
                <option value="or">or</option>
              </select>
            {:else}{filter.conjunction}{/if}
          </span>
          <div class="sv-ff-group">
            {#each g.conditions as inner, j (j)}
              {@render row(inner, j, g.conjunction, (v) => setConjunction(i, v), i, j)}
            {/each}
            <button type="button" class="sv-fvb-text-btn" onclick={() => addCondition(i)}>+ Add condition</button>
          </div>
        </div>
      {:else}
        {@render row(c, i, filter.conjunction, (v) => setConjunction(null, v), i, null)}
      {/if}
    {/each}
  {:else}
    <p class="sv-fvb-empty">{empty}</p>
  {/if}
  <div class="sv-fvb-foot">
    <button type="button" class="sv-fvb-text-btn" onclick={() => addCondition()}>+ Add condition</button>
    <button type="button" class="sv-fvb-text-btn" onclick={addGroup}>+ Add condition group</button>
  </div>
</div>

<style>
  .sv-ff { width: 700px; max-width: 100%; }
  .sv-ff.is-inline { width: auto; }
  .sv-ff-row { display: grid; grid-template-columns: 64px 140px 130px minmax(0, 1fr) 28px; gap: 6px; align-items: start; margin: 6px 0; }
  .sv-ff-row > :global(*) { min-width: 0; }
  .sv-ff-conj { padding-top: 5px; color: var(--sg-muted, #64748b); }
  .sv-ff-value { min-width: 0; }
  .sv-ff-group {
    grid-column: 2 / -1; padding: 4px 8px; border-radius: 8px;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 4%, transparent);
    border: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-ff-group .sv-ff-row { grid-template-columns: 56px 120px 120px minmax(0, 1fr) 28px; }
</style>
