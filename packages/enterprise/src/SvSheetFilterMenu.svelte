<script lang="ts">
  /**
   * The menu an AutoFilter arrow drops: Excel's, in its order. Sort A to Z
   * and Z to A, Clear Filter From the column, a condition (Text Filters or
   * Number Filters: equals, greater than, contains, between and the rest,
   * two of them joined with And / Or), a search box, (Select All) and the
   * column's values to tick, OK and Cancel. The shell mounts it inside the
   * popover anchored to the header cell.
   */
  import type { ExcelFilterOperator } from '@svgrid/grid/filtering'
  import { valuesFilter, type ColumnFilter, type FilterValue, type FilterCondition } from './sheet/auto-filter'

  type Props = {
    /** The header text, for Clear Filter From "X". */
    header: string
    /** The column's values with their counts. */
    values: ReadonlyArray<FilterValue>
    /** The filter on the column now, if any. */
    filter: ColumnFilter | null
    /** Whether the column holds numbers, for Number Filters over Text Filters. */
    numeric: boolean
    onSort: (direction: 'asc' | 'desc') => void
    onApply: (filter: ColumnFilter | null) => void
    onCancel: () => void
  }

  let { header, values, filter, numeric, onSort, onApply, onCancel }: Props = $props()

  const TEXT_OPS: ReadonlyArray<[ExcelFilterOperator, string]> = [
    ['equals', 'Equals'], ['notEquals', 'Does Not Equal'], ['startsWith', 'Begins With'], ['endsWith', 'Ends With'],
    ['contains', 'Contains'], ['notContains', 'Does Not Contain'], ['isBlank', 'Is Blank'], ['isNotBlank', 'Is Not Blank'],
  ]
  const NUMBER_OPS: ReadonlyArray<[ExcelFilterOperator, string]> = [
    ['equals', 'Equals'], ['notEquals', 'Does Not Equal'], ['greaterThan', 'Greater Than'], ['lessThan', 'Less Than'],
    ['between', 'Between'], ['isBlank', 'Is Blank'], ['isNotBlank', 'Is Not Blank'],
  ]
  const ops = $derived(numeric ? NUMBER_OPS : TEXT_OPS)

  let search = $state('')
  let ticked = $state<Set<string>>(new Set())
  let mode = $state<'values' | 'condition'>('values')
  let op1 = $state<ExcelFilterOperator>('equals')
  let v1 = $state('')
  let v1to = $state('')
  let join = $state<'and' | 'or'>('and')
  let op2 = $state<ExcelFilterOperator | ''>('')
  let v2 = $state('')
  let v2to = $state('')
  let searchBox = $state<HTMLInputElement | null>(null)

  $effect(() => {
    // Open on the column's state: the ticks it has, or the condition it has.
    const f = filter
    const all = values.map((v) => v.text)
    if (f?.kind === 'values') ticked = new Set(all.filter((t) => !f.excluded.includes(t)))
    else ticked = new Set(all)
    mode = f?.kind === 'condition' ? 'condition' : 'values'
    if (f?.kind === 'condition') {
      op1 = f.first.op; v1 = f.first.value ?? ''; v1to = f.first.valueTo ?? ''
      join = f.join ?? 'and'
      op2 = f.second?.op ?? ''; v2 = f.second?.value ?? ''; v2to = f.second?.valueTo ?? ''
    } else {
      op1 = 'equals'; v1 = ''; v1to = ''; join = 'and'; op2 = ''; v2 = ''; v2to = ''
    }
    search = ''
    queueMicrotask(() => searchBox?.focus())
  })

  const shown = $derived.by(() => {
    const needle = search.trim().toLowerCase()
    return needle ? values.filter((v) => v.text.toLowerCase().includes(needle)) : values
  })
  const allShownTicked = $derived(shown.length > 0 && shown.every((v) => ticked.has(v.text)))
  const noneShownTicked = $derived(shown.every((v) => !ticked.has(v.text)))

  function toggle(text: string) {
    const next = new Set(ticked)
    if (next.has(text)) next.delete(text)
    else next.add(text)
    ticked = next
    mode = 'values'
  }
  function toggleAll() {
    const next = new Set(ticked)
    if (allShownTicked) for (const v of shown) next.delete(v.text)
    else for (const v of shown) next.add(v.text)
    ticked = next
    mode = 'values'
  }
  const needsValue = (op: ExcelFilterOperator | '') => op !== '' && op !== 'isBlank' && op !== 'isNotBlank'
  const conditionValid = $derived(
    (!needsValue(op1) || v1.trim() !== '') && (op1 !== 'between' || v1to.trim() !== '')
      && (op2 === '' || !needsValue(op2) || v2.trim() !== '') && (op2 !== 'between' || v2to.trim() !== ''),
  )

  function ok() {
    if (mode === 'condition') {
      if (!conditionValid) return
      const first: FilterCondition = { op: op1, ...(needsValue(op1) ? { value: v1.trim() } : {}), ...(op1 === 'between' ? { valueTo: v1to.trim() } : {}) }
      const second: FilterCondition | undefined = op2 === ''
        ? undefined
        : { op: op2, ...(needsValue(op2) ? { value: v2.trim() } : {}), ...(op2 === 'between' ? { valueTo: v2to.trim() } : {}) }
      onApply({ kind: 'condition', first, ...(second ? { join, second } : {}) })
      return
    }
    // A search applies its results, as Excel's does: the values it hides
    // are out, whatever their ticks, and the ticked matches stay.
    const keep = search.trim() ? new Set(shown.filter((v) => ticked.has(v.text)).map((v) => v.text)) : ticked
    onApply(valuesFilter(values.map((v) => v.text), keep))
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); ok() }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="sv-sheet-filter-menu" role="dialog" aria-label={`Filter ${header}`} onkeydown={onKeyDown}>
  <button type="button" class="row" onclick={() => onSort('asc')}>{numeric ? 'Sort Smallest to Largest' : 'Sort A to Z'}</button>
  <button type="button" class="row" onclick={() => onSort('desc')}>{numeric ? 'Sort Largest to Smallest' : 'Sort Z to A'}</button>
  <hr />
  <button type="button" class="row" disabled={!filter} onclick={() => onApply(null)}>Clear Filter From "{header}"</button>
  <details class="conditions" open={mode === 'condition'} ontoggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) mode = 'condition' }}>
    <summary>{numeric ? 'Number Filters' : 'Text Filters'}</summary>
    <div class="condition">
      <select bind:value={op1} aria-label="First condition" onchange={() => (mode = 'condition')}>
        {#each ops as [op, label] (op)}<option value={op}>{label}</option>{/each}
      </select>
      {#if needsValue(op1)}<input type="text" bind:value={v1} aria-label="First value" oninput={() => (mode = 'condition')} />{/if}
      {#if op1 === 'between'}<span>and</span><input type="text" bind:value={v1to} aria-label="First upper value" />{/if}
    </div>
    <div class="join">
      <label class="check"><input type="radio" name="sv-sheet-filter-join" value="and" bind:group={join} /> And</label>
      <label class="check"><input type="radio" name="sv-sheet-filter-join" value="or" bind:group={join} /> Or</label>
    </div>
    <div class="condition">
      <select bind:value={op2} aria-label="Second condition">
        <option value="">(none)</option>
        {#each ops as [op, label] (op)}<option value={op}>{label}</option>{/each}
      </select>
      {#if needsValue(op2)}<input type="text" bind:value={v2} aria-label="Second value" />{/if}
      {#if op2 === 'between'}<span>and</span><input type="text" bind:value={v2to} aria-label="Second upper value" />{/if}
    </div>
  </details>
  <hr />
  <input bind:this={searchBox} type="search" class="search" placeholder="Search" aria-label="Search values" bind:value={search} />
  <div class="values" role="group" aria-label="Values">
    <label class="check all">
      <input type="checkbox" checked={allShownTicked} indeterminate={!allShownTicked && !noneShownTicked} onchange={toggleAll} />
      (Select All{search.trim() ? ' Search Results' : ''})
    </label>
    {#each shown as v (v.text)}
      <label class="check">
        <input type="checkbox" checked={ticked.has(v.text)} onchange={() => toggle(v.text)} />
        <span class="text">{v.text === '' ? '(Blanks)' : v.text}</span>
        <span class="count">{v.count}</span>
      </label>
    {/each}
    {#if shown.length === 0}<div class="none">No matches.</div>{/if}
  </div>
  <div class="sv-sheet-dialog-buttons">
    <button type="button" class="btn primary" onclick={ok} disabled={mode === 'condition' ? !conditionValid : noneShownTicked && !search.trim()}>OK</button>
    <button type="button" class="btn" onclick={onCancel}>Cancel</button>
  </div>
</div>

<style>
  .sv-sheet-filter-menu {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 260px;
    padding: 6px;
    font-size: 12px;
    color: var(--sg-fg, #242424);
  }
  hr { width: 100%; margin: 2px 0; border: 0; border-top: 1px solid var(--sg-border, #d1d1d1); }
  .row {
    padding: 5px 8px;
    font: inherit;
    text-align: left;
    color: inherit;
    background: transparent;
    border: 0;
    border-radius: 3px;
    cursor: pointer;
  }
  .row:hover:not(:disabled) { background: var(--sg-row-hover-bg, #f0f0f0); }
  .row:disabled { opacity: 0.5; cursor: default; }
  .conditions summary { padding: 5px 8px; cursor: pointer; border-radius: 3px; }
  .conditions summary:hover { background: var(--sg-row-hover-bg, #f0f0f0); }
  .condition, .join { display: flex; align-items: center; gap: 6px; padding: 3px 8px; }
  .condition select { flex: 0 0 120px; }
  .condition input { flex: 1 1 60px; min-width: 40px; }
  select, input[type="text"], .search {
    height: 24px;
    padding: 0 6px;
    font: inherit;
    color: inherit;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: 3px;
  }
  .search { width: 100%; box-sizing: border-box; }
  .values {
    max-height: 180px;
    overflow-y: auto;
    padding: 2px 4px;
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: 3px;
  }
  .check { display: flex; align-items: center; gap: 6px; padding: 2px 4px; cursor: default; }
  .check.all { font-weight: 600; }
  .check .text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .check .count { color: var(--sg-muted, #616161); }
  .none { padding: 4px; color: var(--sg-muted, #616161); }
</style>
