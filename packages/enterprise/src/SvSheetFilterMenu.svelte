<script lang="ts">
  /**
   * The menu an AutoFilter arrow drops: Excel's, in its order. Sort A to Z
   * and Z to A, Clear Filter From the column, a condition (Text Filters or
   * Number Filters: equals, greater than, contains, between and the rest,
   * two of them joined with And / Or), a search box, (Select All) and the
   * column's values to tick, OK and Cancel. The shell mounts it inside the
   * popover anchored to the header cell.
   */
  import { useSheetText } from './sheet-text'
  import type { ExcelFilterOperator } from '@svgrid/grid/filtering'
  import { valuesFilter, type ColumnFilter, type FilterValue, type FilterCondition, type DatePeriod } from './sheet/auto-filter'

  type Props = {
    /** The header text, for Clear Filter From "X". */
    header: string
    /** The column's values with their counts. */
    values: ReadonlyArray<FilterValue>
    /** The filter on the column now, if any. */
    filter: ColumnFilter | null
    /** Whether the column holds numbers, for Number Filters over Text Filters. */
    numeric: boolean
    /** Whether the column holds dates, for Date Filters. */
    dates?: boolean
    /** The fills the column's cells carry (null for none), for Filter by
     *  Color; the entry is left off with fewer than two. */
    fills?: ReadonlyArray<string | null>
    onSort: (direction: 'asc' | 'desc') => void
    onApply: (filter: ColumnFilter | null) => void
    onCancel: () => void
  }

  let { header, values, filter, numeric, dates = false, fills = [], onSort, onApply, onCancel }: Props = $props()
  const t = useSheetText()

  const PERIODS: ReadonlyArray<DatePeriod> = [
    'equals', 'before', 'after', 'between', 'tomorrow', 'today', 'yesterday',
    'nextWeek', 'thisWeek', 'lastWeek', 'nextMonth', 'thisMonth', 'lastMonth',
    'nextQuarter', 'thisQuarter', 'lastQuarter', 'nextYear', 'thisYear', 'lastYear', 'yearToDate',
  ]
  const typedPeriod = (p: DatePeriod) => p === 'equals' || p === 'before' || p === 'after' || p === 'between'

  const TEXT_OPS: ReadonlyArray<ExcelFilterOperator> = [
    'equals', 'notEquals', 'startsWith', 'endsWith', 'contains', 'notContains', 'isBlank', 'isNotBlank',
  ]
  const NUMBER_OPS: ReadonlyArray<ExcelFilterOperator> = [
    'equals', 'notEquals', 'greaterThan', 'lessThan', 'between', 'isBlank', 'isNotBlank',
  ]
  const ops = $derived(numeric ? NUMBER_OPS : TEXT_OPS)

  let search = $state('')
  let ticked = $state<Set<string>>(new Set())
  let mode = $state<'values' | 'condition' | 'date' | 'top'>('values')
  let period = $state<DatePeriod>('today')
  let d1 = $state('')
  let d2 = $state('')
  let topSide = $state<'top' | 'bottom'>('top')
  let topCount = $state(10)
  let topUnit = $state<'items' | 'percent'>('items')
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
    if (f?.kind === 'values') ticked = new Set(f.included ? all.filter((t) => f.included!.includes(t)) : all.filter((t) => !f.excluded.includes(t)))
    else ticked = new Set(all)
    mode = f?.kind === 'condition' ? 'condition' : f?.kind === 'date' ? 'date' : f?.kind === 'top' ? 'top' : 'values'
    period = f?.kind === 'date' ? f.period : 'today'
    d1 = f?.kind === 'date' ? f.value ?? '' : ''
    d2 = f?.kind === 'date' ? f.valueTo ?? '' : ''
    topSide = f?.kind === 'top' && !f.top ? 'bottom' : 'top'
    topCount = f?.kind === 'top' ? f.count : 10
    topUnit = f?.kind === 'top' && f.percent ? 'percent' : 'items'
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

  const dateValid = $derived(
    !typedPeriod(period) || (d1.trim() !== '' && (period !== 'between' || d2.trim() !== '')),
  )
  const topValid = $derived(Number.isFinite(topCount) && topCount > 0)

  function ok() {
    if (mode === 'date') {
      if (!dateValid) return
      onApply({ kind: 'date', period, ...(typedPeriod(period) ? { value: d1.trim() } : {}), ...(period === 'between' ? { valueTo: d2.trim() } : {}) })
      return
    }
    if (mode === 'top') {
      if (!topValid) return
      onApply({ kind: 'top', top: topSide === 'top', count: Math.trunc(topCount), ...(topUnit === 'percent' ? { percent: true } : {}) })
      return
    }
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
<div class="sv-sheet-filter-menu" role="dialog" aria-label={t('filter.label', { header })} onkeydown={onKeyDown}>
  <button type="button" class="row" onclick={() => onSort('asc')}>{t(numeric ? 'filter.sortSmallest' : 'filter.sortAsc')}</button>
  <button type="button" class="row" onclick={() => onSort('desc')}>{t(numeric ? 'filter.sortLargest' : 'filter.sortDesc')}</button>
  <hr />
  <button type="button" class="row" disabled={!filter} onclick={() => onApply(null)}>{t('filter.clear', { header })}</button>
  {#if fills.length > 1}
    <!-- Excel's Filter by Color: the fills the column carries, as swatches. -->
    <details class="conditions colours" open={filter?.kind === 'color'}>
      <summary>{t('filter.byColor')}</summary>
      <div class="swatches" role="group" aria-label={t('filter.byColorGroup')}>
        {#each fills as fill (fill ?? '')}
          <button
            type="button"
            class="swatch"
            class:none={fill === null}
            class:on={filter?.kind === 'color' && (filter.fill ?? '') === (fill ?? '')}
            style:background={fill ?? undefined}
            title={fill ?? t('filter.noFill')}
            aria-label={fill ? t('filter.byFill', { fill }) : t('filter.byNoFill')}
            onclick={() => onApply({ kind: 'color', fill })}
          >{#if fill === null}{t('filter.noFill')}{/if}</button>
        {/each}
      </div>
    </details>
  {/if}
  {#if dates}
    <details class="conditions" open={mode === 'date'} ontoggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) mode = 'date' }}>
      <summary>{t('filter.dateFilters')}</summary>
      <div class="condition">
        <select bind:value={period} aria-label={t('filter.datePeriod')} onchange={() => (mode = 'date')}>
          {#each PERIODS as id (id)}<option value={id}>{t(`filter.period.${id}`)}</option>{/each}
        </select>
        {#if typedPeriod(period)}<input type="date" bind:value={d1} aria-label={t('filter.date')} oninput={() => (mode = 'date')} />{/if}
        {#if period === 'between'}<span>{t('filter.and')}</span><input type="date" bind:value={d2} aria-label={t('filter.secondDate')} />{/if}
      </div>
    </details>
  {/if}
  <details class="conditions" open={mode === 'condition'} ontoggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) mode = 'condition' }}>
    <summary>{t(numeric ? 'filter.numberFilters' : 'filter.textFilters')}</summary>
    <div class="condition">
      <select bind:value={op1} aria-label={t('filter.firstCondition')} onchange={() => (mode = 'condition')}>
        {#each ops as op (op)}<option value={op}>{t(`filter.op.${op}`)}</option>{/each}
      </select>
      {#if needsValue(op1)}<input type="text" bind:value={v1} aria-label={t('filter.firstValue')} oninput={() => (mode = 'condition')} />{/if}
      {#if op1 === 'between'}<span>{t('filter.and')}</span><input type="text" bind:value={v1to} aria-label={t('filter.firstUpperValue')} />{/if}
    </div>
    <div class="join">
      <label class="check"><input type="radio" name="sv-sheet-filter-join" value="and" bind:group={join} /> {t('filter.joinAnd')}</label>
      <label class="check"><input type="radio" name="sv-sheet-filter-join" value="or" bind:group={join} /> {t('filter.joinOr')}</label>
    </div>
    <div class="condition">
      <select bind:value={op2} aria-label={t('filter.secondCondition')}>
        <option value="">{t('filter.none')}</option>
        {#each ops as op (op)}<option value={op}>{t(`filter.op.${op}`)}</option>{/each}
      </select>
      {#if needsValue(op2)}<input type="text" bind:value={v2} aria-label={t('filter.secondValue')} />{/if}
      {#if op2 === 'between'}<span>{t('filter.and')}</span><input type="text" bind:value={v2to} aria-label={t('filter.secondUpperValue')} />{/if}
    </div>
  </details>
  {#if numeric}
    <details class="conditions" open={mode === 'top'} ontoggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) mode = 'top' }}>
      <summary>{t('filter.top10')}</summary>
      <div class="condition top">
        <select bind:value={topSide} aria-label={t('filter.topOrBottom')} onchange={() => (mode = 'top')}>
          <option value="top">{t('filter.top')}</option>
          <option value="bottom">{t('filter.bottom')}</option>
        </select>
        <input type="number" min="1" bind:value={topCount} aria-label={t('filter.howMany')} oninput={() => (mode = 'top')} />
        <select bind:value={topUnit} aria-label={t('filter.itemsOrPercent')}>
          <option value="items">{t('filter.items')}</option>
          <option value="percent">{t('filter.percent')}</option>
        </select>
      </div>
    </details>
  {/if}
  <hr />
  <input bind:this={searchBox} type="search" class="search" placeholder={t('filter.search')} aria-label={t('filter.searchValues')} bind:value={search} />
  <div class="values" role="group" aria-label={t('filter.values')}>
    <label class="check all">
      <input type="checkbox" checked={allShownTicked} indeterminate={!allShownTicked && !noneShownTicked} onchange={toggleAll} />
      {t(search.trim() ? 'filter.selectAllResults' : 'filter.selectAll')}
    </label>
    {#each shown as v (v.text)}
      <label class="check">
        <input type="checkbox" checked={ticked.has(v.text)} onchange={() => toggle(v.text)} />
        <span class="text">{v.text === '' ? t('filter.blanks') : v.text}</span>
        <span class="count">{v.count}</span>
      </label>
    {/each}
    {#if shown.length === 0}<div class="none">{t('filter.noMatches')}</div>{/if}
  </div>
  <div class="sv-sheet-dialog-buttons">
    <button type="button" class="btn primary" onclick={ok} disabled={mode === 'condition' ? !conditionValid : mode === 'date' ? !dateValid : mode === 'top' ? !topValid : noneShownTicked && !search.trim()}>{t('ok')}</button>
    <button type="button" class="btn" onclick={onCancel}>{t('cancel')}</button>
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
  .condition.top select { flex: 0 0 80px; }
  .condition.top input { flex: 0 0 56px; }
  .swatches { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 8px; }
  .swatch {
    width: 22px;
    height: 22px;
    padding: 0;
    font: inherit;
    font-size: 10px;
    color: inherit;
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: 3px;
    cursor: pointer;
  }
  .swatch.none { width: auto; padding: 0 6px; background: var(--sg-bg, #fff); }
  .swatch.on { outline: 2px solid var(--sg-accent, #217346); outline-offset: 1px; }
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
