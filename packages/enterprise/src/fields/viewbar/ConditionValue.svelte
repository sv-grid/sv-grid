<script lang="ts">
  /**
   * A filter condition's value, in the control its field and operator call
   * for: a text box, a number, an option (or several, as pills), a person,
   * checked / unchecked, a day relative to today or a date, a span of days.
   */
  import { ME, type DateSpan, type DateTarget, type FieldCondition } from '../filter-model'
  import type { FieldColumn } from '../grid-access'
  import { fieldPropsOf, originalColumn } from '../registry.svelte'
  import { getFieldUsers } from '../sources.svelte'
  import { textOn } from '../palette'

  let { column, condition, onChange }: { column: FieldColumn; condition: FieldCondition; onChange: (value: unknown) => void } = $props()

  type Choice = { value: string; label: string; color?: string }
  const choices = $derived.by<Choice[]>(() => {
    // "Me" first: whoever is signed in when the filter runs, so one view serves everyone.
    if (column.fieldType === 'user' || column.fieldType === 'createdBy' || column.fieldType === 'lastModifiedBy')
      return [{ value: ME, label: 'Me' }, ...getFieldUsers().map((u) => ({ value: u.id, label: u.name }))]
    const p = fieldPropsOf(originalColumn(column.def)) as { options?: Array<{ value: string; color?: string }> }
    return (p.options ?? []).map((o) => ({ value: o.value, label: o.value, ...(o.color ? { color: o.color } : {}) }))
  })
  const many = $derived(condition.kind === 'multi' || (condition.kind === 'select' && condition.op !== 'is' && condition.op !== 'isNot'))
  const picked = $derived(new Set(Array.isArray(condition.value) ? (condition.value as string[]) : []))
  function toggle(v: string) {
    const next = new Set(picked)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    onChange([...next])
  }

  const DAYS: ReadonlyArray<{ value: DateTarget['mode']; label: string }> = [
    { value: 'today', label: 'today' },
    { value: 'tomorrow', label: 'tomorrow' },
    { value: 'yesterday', label: 'yesterday' },
    { value: 'oneWeekAgo', label: 'one week ago' },
    { value: 'oneWeekFromNow', label: 'one week from now' },
    { value: 'oneMonthAgo', label: 'one month ago' },
    { value: 'oneMonthFromNow', label: 'one month from now' },
    { value: 'exactDate', label: 'exact date' },
  ]
  const SPANS: ReadonlyArray<{ value: DateSpan['span']; label: string }> = [
    { value: 'pastWeek', label: 'the past week' },
    { value: 'pastMonth', label: 'the past month' },
    { value: 'pastYear', label: 'the past year' },
    { value: 'nextWeek', label: 'the next week' },
    { value: 'nextMonth', label: 'the next month' },
    { value: 'nextYear', label: 'the next year' },
    { value: 'pastDays', label: 'the past number of days' },
    { value: 'nextDays', label: 'the next number of days' },
  ]
  const target = $derived((condition.value ?? { mode: 'today' }) as DateTarget & { date?: string })
  const span = $derived((condition.value ?? { span: 'pastWeek' }) as DateSpan)
  const textValue = $derived(typeof condition.value === 'string' || typeof condition.value === 'number' ? String(condition.value) : '')
</script>

{#if condition.op === 'isEmpty' || condition.op === 'isNotEmpty'}
  <span class="sv-fcv-none"></span>
{:else if condition.kind === 'checkbox'}
  <label class="sv-fcv-check">
    <input type="checkbox" checked={condition.value !== false} onchange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)} />
    {condition.value !== false ? 'checked' : 'unchecked'}
  </label>
{:else if condition.kind === 'select' && !many}
  <select class="sv-fvb-select" aria-label="Value" value={String(condition.value ?? '')} onchange={(e) => onChange((e.currentTarget as HTMLSelectElement).value)}>
    <option value="" disabled>Select an option</option>
    {#each choices as c (c.value)}<option value={c.value}>{c.label}</option>{/each}
  </select>
{:else if many}
  <div class="sv-fcv-pills" role="group" aria-label="Values">
    {#each choices as c (c.value)}
      <button
        type="button"
        class="sv-fcv-pill"
        class:is-on={picked.has(c.value)}
        aria-pressed={picked.has(c.value)}
        style:--pill={c.color ?? 'var(--sg-accent, #2563eb)'}
        style:--pill-fg={c.color ? textOn(c.color) : '#fff'}
        onclick={() => toggle(c.value)}>{c.label}</button
      >
    {:else}
      <span class="sv-fcv-empty">No options</span>
    {/each}
  </div>
{:else if condition.kind === 'date' && condition.op === 'isWithin'}
  <span class="sv-fcv-pair">
    <select
      class="sv-fvb-select"
      aria-label="Span"
      value={span.span}
      onchange={(e) => onChange({ span: (e.currentTarget as HTMLSelectElement).value, ...(span.days ? { days: span.days } : {}) })}
    >
      {#each SPANS as s (s.value)}<option value={s.value}>{s.label}</option>{/each}
    </select>
    {#if span.span === 'pastDays' || span.span === 'nextDays'}
      <input
        class="sv-fvb-input sv-fcv-days"
        type="number"
        min="1"
        aria-label="Days"
        value={span.days ?? ''}
        oninput={(e) => onChange({ span: span.span, days: Number((e.currentTarget as HTMLInputElement).value) })}
      />
    {/if}
  </span>
{:else if condition.kind === 'date'}
  <span class="sv-fcv-pair">
    <select
      class="sv-fvb-select"
      aria-label="Day"
      value={target.mode}
      onchange={(e) => {
        const mode = (e.currentTarget as HTMLSelectElement).value
        onChange(mode === 'exactDate' ? { mode, date: target.date ?? '' } : { mode })
      }}
    >
      {#each DAYS as d (d.value)}<option value={d.value}>{d.label}</option>{/each}
    </select>
    {#if target.mode === 'exactDate'}
      <input
        class="sv-fvb-input"
        type="date"
        aria-label="Date"
        value={target.date ?? ''}
        oninput={(e) => onChange({ mode: 'exactDate', date: (e.currentTarget as HTMLInputElement).value })}
      />
    {/if}
  </span>
{:else}
  <input
    class="sv-fvb-input"
    type="text"
    inputmode={condition.kind === 'number' ? 'decimal' : undefined}
    placeholder="Enter a value"
    aria-label="Value"
    value={textValue}
    oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
  />
{/if}

<style>
  .sv-fcv-none { display: block; }
  .sv-fcv-check { display: inline-flex; align-items: center; gap: 6px; }
  .sv-fcv-pair { display: flex; gap: 6px; min-width: 0; }
  .sv-fcv-days { width: 70px; }
  .sv-fcv-pills { display: flex; flex-wrap: wrap; gap: 4px; }
  .sv-fcv-pill {
    border: 1px solid var(--sg-border, #cbd5e1); border-radius: 999px; padding: 1px 9px; font: inherit; font-size: 12px;
    background: transparent; color: inherit; cursor: pointer;
  }
  .sv-fcv-pill.is-on { background: var(--pill); border-color: var(--pill); color: var(--pill-fg); }
  .sv-fcv-empty { color: var(--sg-muted, #64748b); font-size: 12px; }
</style>
