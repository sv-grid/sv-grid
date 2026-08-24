<script lang="ts">
  /**
   * SvExpressionEditor - authors a predicate expression, either as a structured
   * list of conditions (default) or as free text. Live-validates and, given a
   * `rows` sample, shows how many rows currently match. Reuses the grid UI kit
   * (SvDropDownList / SvTextInput / SvTagsInput) so it feels like the filter row.
   */
  import {
    SvDropDownList,
    SvTextInput,
    SvTextArea,
    SvTagsInput,
    type ExcelFilterOperator,
  } from '@svgrid/grid'
  import { untrack } from 'svelte'
  import { evaluatePredicate } from './expressions/evaluate'
  import {
    ExpressionParseError,
    parsePredicate,
    stringifyPredicate,
    validateExpression,
  } from './expressions/parse'
  import {
    columnById,
    isRangeOperator,
    isSetOperator,
    isValueless,
    operatorsForType,
    type ExprColumn,
  } from './expressions/expression-columns'
  import type { PredicateExpr } from './expressions/expression-types'

  type Condition = {
    column: string
    op: ExcelFilterOperator
    value: string
    valueTo: string
    values: string[]
  }

  type Props = {
    columns: ReadonlyArray<ExprColumn>
    value?: PredicateExpr
    rows?: ReadonlyArray<Record<string, unknown>>
    onChange?: (value: PredicateExpr) => void
    mode?: 'builder' | 'text'
  }

  let {
    columns,
    value = $bindable<PredicateExpr>({ kind: 'const', value: true }),
    rows = [],
    onChange,
    mode = $bindable<'builder' | 'text'>('builder'),
  }: Props = $props()

  // --- Builder <-> predicate conversion ------------------------------------

  function toConditions(expr: PredicateExpr): { combinator: 'and' | 'or'; conditions: Condition[] } | null {
    // `const true` is how "no filter yet" is spelled. Treat it as an empty
    // builder rather than an unrepresentable expression, so a fresh panel opens
    // on a ready-to-fill condition row instead of dropping into text mode
    // showing the word `true`.
    if (expr.kind === 'const') {
      return expr.value ? { combinator: 'and', conditions: [freshCondition()] } : null
    }
    const parts =
      expr.kind === 'and' || expr.kind === 'or' ? expr.parts : [expr]
    const combinator = expr.kind === 'or' ? 'or' : 'and'
    const conditions: Condition[] = []
    for (const p of parts) {
      if (p.kind !== 'cmp') return null // scalarCmp / nested -> text mode only
      conditions.push({
        column: p.column,
        op: p.op,
        value: p.value != null && !Array.isArray(p.value) ? String(p.value) : '',
        valueTo: p.valueTo != null ? String(p.valueTo) : '',
        values: Array.isArray(p.value) ? p.value.map(String) : [],
      })
    }
    return { combinator, conditions }
  }

  function fromConditions(combinator: 'and' | 'or', conditions: Condition[]): PredicateExpr {
    const parts: PredicateExpr[] = conditions.map((c) => {
      const base = { kind: 'cmp' as const, column: c.column, op: c.op }
      if (isValueless(c.op)) return base
      if (isSetOperator(c.op)) return { ...base, value: c.values }
      if (isRangeOperator(c.op)) return { ...base, value: c.value, valueTo: c.valueTo }
      return { ...base, value: c.value }
    })
    if (parts.length === 0) return { kind: 'const', value: true }
    if (parts.length === 1) return parts[0]
    return { kind: combinator, parts }
  }

  const initial = toConditions(value)
  let combinator = $state<'and' | 'or'>(initial?.combinator ?? 'and')
  let conditions = $state<Condition[]>(
    initial?.conditions ?? [freshCondition()],
  )
  // If the incoming value is not representable as a flat condition list, start
  // in text mode so nothing is lost.
  if (!initial && mode === 'builder') mode = 'text'

  let text = $state(stringifyPredicate(value, columns))
  let textError = $state<string | null>(null)

  /**
   * The last expression WE produced. Everything below is seeded once at init,
   * so without this the editor would ignore a `value` assigned from outside -
   * loading a saved filter or clicking a preset would update the grid while the
   * editor kept showing the old conditions.
   *
   * Compared by reference on purpose: our own emits assign the very object we
   * just built, so they are skipped, while any expression from elsewhere is a
   * different object and re-seeds the UI.
   */
  let lastEmitted: PredicateExpr | null = $state(value)

  $effect(() => {
    const incoming = value
    if (incoming === untrack(() => lastEmitted)) return
    untrack(() => {
      const next = toConditions(incoming)
      if (next) {
        combinator = next.combinator
        conditions = next.conditions
      } else if (mode === 'builder') {
        // Not representable as a flat list; text mode keeps it intact.
        mode = 'text'
      }
      text = stringifyPredicate(incoming, columns)
      textError = null
      lastEmitted = incoming
    })
  })

  function freshCondition(): Condition {
    const first = columns[0]
    const ops = operatorsForType(first?.type)
    return { column: first?.id ?? '', op: ops[0]?.value ?? 'equals', value: '', valueTo: '', values: [] }
  }

  const columnOptions = $derived(columns.map((c) => ({ value: c.id, label: c.name ?? c.id })))

  function opsFor(columnId: string) {
    const type = columnById(columns, columnId)?.type
    return operatorsForType(type).map((o) => ({ value: o.value, label: o.label }))
  }

  // --- Emit ----------------------------------------------------------------

  function emitBuilder() {
    const expr = fromConditions(combinator, conditions)
    lastEmitted = expr
    value = expr
    text = stringifyPredicate(expr, columns)
    textError = null
    onChange?.(expr)
  }

  function emitText() {
    if (!text.trim()) {
      textError = 'Expression is empty'
      return
    }
    try {
      const expr = parsePredicate(text, columns)
      const problems = validateExpression(expr, columns)
      textError = problems.length ? problems.join('; ') : null
      if (!problems.length) {
        lastEmitted = expr
        value = expr
        onChange?.(expr)
      }
    } catch (err) {
      textError = err instanceof ExpressionParseError ? err.message : 'Invalid expression'
    }
  }

  function addCondition() {
    conditions = [...conditions, freshCondition()]
    emitBuilder()
  }
  function removeCondition(i: number) {
    conditions = conditions.filter((_, idx) => idx !== i)
    if (conditions.length === 0) conditions = [freshCondition()]
    emitBuilder()
  }
  function setColumn(i: number, columnId: string) {
    const ops = opsFor(columnId)
    conditions[i].column = columnId
    if (!ops.some((o) => o.value === conditions[i].op)) conditions[i].op = ops[0]?.value ?? 'equals'
    emitBuilder()
  }

  /**
   * Whether the text currently in the box could be shown in the builder.
   *
   * Drives the Builder tab's disabled state. Letting the user click a tab that
   * then refuses with a red error is worse than showing up front that this
   * particular expression has to be edited as text - the refusal is a property
   * of the expression, not a mistake the user made.
   */
  const builderAvailable = $derived.by(() => {
    if (mode === 'builder') return true
    try {
      return toConditions(parsePredicate(text, columns)) != null
    } catch {
      // Half-typed text is not a reason to lock the tab; switchMode reports
      // the parse error properly if they do click.
      return true
    }
  })

  function switchMode(next: 'builder' | 'text') {
    if (next === mode) return
    if (next === 'text') {
      text = stringifyPredicate(value, columns)
      textError = null
    } else {
      // Re-seed the builder from the parsed text, if representable.
      try {
        const expr = parsePredicate(text, columns)
        const c = toConditions(expr)
        if (!c) {
          textError = 'This expression uses maths or grouping - stay in text mode'
          return
        }
        combinator = c.combinator
        conditions = c.conditions
        lastEmitted = expr
        value = expr
      } catch {
        textError = 'Fix the expression before switching'
        return
      }
    }
    mode = next
  }

  // --- Live preview --------------------------------------------------------

  // Cap how many rows the live "matches" counter scans. Rule editors are often
  // opened over the full grid (100k+ rows) and this recomputes on every keystroke
  // / condition edit, so an uncapped scan would freeze the editor. We sample the
  // first N rows and label the count as approximate when the set is larger.
  const PREVIEW_SAMPLE = 2000

  const matchPreview = $derived.by(() => {
    const total = rows.length
    if (!total) return null
    const limit = total > PREVIEW_SAMPLE ? PREVIEW_SAMPLE : total
    try {
      let n = 0
      for (let i = 0; i < limit; i++) {
        const row = rows[i]
        if (row && evaluatePredicate(value, { row })) n++
      }
      return { n, sampled: limit, total }
    } catch {
      return null
    }
  })
</script>

<div class="sx-editor">
  <div class="sx-head">
    <div class="sx-modes" role="tablist" aria-label="Expression editor mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'builder'}
        class:sx-active={mode === 'builder'}
        disabled={!builderAvailable}
        title={builderAvailable
          ? undefined
          : 'The builder shows a flat list of conditions, so it cannot represent column maths, aggregates or nested groups. Edit this one as text.'}
        onclick={() => switchMode('builder')}>Builder</button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'text'}
        class:sx-active={mode === 'text'}
        onclick={() => switchMode('text')}>Text</button>
    </div>
    {#if matchPreview}
      <span class="sx-match" aria-live="polite">
        {#if matchPreview.sampled < matchPreview.total}
          Matches ~{matchPreview.n} of first {matchPreview.sampled}
        {:else}
          Matches {matchPreview.n} of {matchPreview.total}
        {/if}
      </span>
    {/if}
  </div>

  {#if mode === 'builder'}
    <div class="sx-combinator">
      Match
      <SvDropDownList
        size="sm"
        options={[{ value: 'and', label: 'all' }, { value: 'or', label: 'any' }]}
        value={combinator}
        onChange={(v) => { combinator = v as 'and' | 'or'; emitBuilder() }}
        ariaLabel="Combine conditions" />
      of the following:
    </div>
    <div class="sx-rows">
      {#each conditions as cond, i (i)}
        <div class="sx-row">
          <SvDropDownList
            size="sm"
            options={columnOptions}
            value={cond.column}
            onChange={(v) => setColumn(i, String(v))}
            ariaLabel="Column" />
          <SvDropDownList
            size="sm"
            options={opsFor(cond.column)}
            value={cond.op}
            onChange={(v) => { conditions[i].op = v as ExcelFilterOperator; emitBuilder() }}
            ariaLabel="Operator" />
          {#if isValueless(cond.op)}
            <span class="sx-noval">-</span>
          {:else if isSetOperator(cond.op)}
            <SvTagsInput
              value={cond.values}
              onChange={(vals) => { conditions[i].values = vals; emitBuilder() }}
              placeholder="Add value…"
              ariaLabel="Values" />
          {:else if isRangeOperator(cond.op)}
            <SvTextInput
              size="sm"
              value={cond.value}
              onChange={(v) => { conditions[i].value = v; emitBuilder() }}
              placeholder="From"
              ariaLabel="From" />
            <SvTextInput
              size="sm"
              value={cond.valueTo}
              onChange={(v) => { conditions[i].valueTo = v; emitBuilder() }}
              placeholder="To"
              ariaLabel="To" />
          {:else}
            <SvTextInput
              size="sm"
              value={cond.value}
              onChange={(v) => { conditions[i].value = v; emitBuilder() }}
              placeholder="Value"
              ariaLabel="Value" />
          {/if}
          <button type="button" class="sx-del" onclick={() => removeCondition(i)} aria-label="Remove condition">✕</button>
        </div>
      {/each}
    </div>
    <button type="button" class="sx-add" onclick={addCondition}>+ Add condition</button>
  {:else}
    <SvTextArea
      value={text}
      onChange={(v) => { text = v; emitText() }}
      rows={3}
      placeholder={'e.g. price > 100 AND region IN ("EU", "US")'}
      ariaLabel="Expression text" />
    {#if textError}
      <p class="sx-error" role="alert">{textError}</p>
    {:else}
      <p class="sx-hint">Use AND / OR / NOT, CONTAINS, IN (…), BETWEEN … AND …, and column maths.</p>
    {/if}
  {/if}
</div>

<style>
  /* Theme-agnostic surfaces (see SvGridAlerts): currentColor + inherit. */
  .sx-editor {
    display: flex; flex-direction: column; gap: 10px; font-family: var(--sg-font, inherit); color: inherit;
    background: color-mix(in srgb, currentColor 4%, transparent);
    border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
    border-radius: 10px; padding: 12px;
  }
  .sx-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .sx-modes { display: inline-flex; padding: 2px; border: 1px solid color-mix(in srgb, currentColor 16%, transparent); border-radius: 8px; gap: 2px; }
  .sx-modes button { border: 0; background: transparent; color: inherit; opacity: 0.65; padding: 4px 12px; font-size: 12px; font-weight: 500; border-radius: 6px; cursor: pointer; transition: background 0.13s ease, opacity 0.13s ease; }
  .sx-modes button:hover { opacity: 1; }
  .sx-modes button.sx-active { background: var(--sg-accent, #4f46e5); color: #fff; opacity: 1; }
  /* Not representable as a flat condition list - the tooltip says why. */
  .sx-modes button:disabled { opacity: 0.35; cursor: not-allowed; }
  .sx-modes button:disabled:hover { opacity: 0.35; }
  .sx-match {
    font-size: 11.5px; font-weight: 600; color: var(--sg-accent, #4f46e5);
    background: color-mix(in srgb, var(--sg-accent, #4f46e5) 14%, transparent);
    padding: 3px 9px; border-radius: 999px;
  }
  .sx-combinator { display: flex; align-items: center; gap: 6px; font-size: 12px; opacity: 0.7; }
  .sx-rows { display: flex; flex-direction: column; gap: 7px; }
  .sx-row {
    /* minmax(0, 2fr), not 2fr: a grid track sizes to its content by default, so
       the value input refused to shrink and pushed the row out of any narrow
       panel (the form builder's rules pane, a docked alerts panel). */
    display: grid; grid-template-columns: minmax(90px, 1fr) minmax(90px, 1fr) minmax(0, 2fr) auto; gap: 7px; align-items: center;
    border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 9px; padding: 8px;
  }
  .sx-noval { text-align: center; font-size: 13px; opacity: 0.5; }
  .sx-del { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 0; background: transparent; color: inherit; opacity: 0.55; cursor: pointer; font-size: 13px; border-radius: 7px; transition: background 0.13s ease, color 0.13s ease, opacity 0.13s ease; }
  .sx-del:hover { color: var(--sg-danger, #dc2626); opacity: 1; background: color-mix(in srgb, var(--sg-danger, #dc2626) 12%, transparent); }
  .sx-add { align-self: flex-start; border: 1px dashed color-mix(in srgb, var(--sg-accent, #4f46e5) 45%, currentColor); background: transparent; color: var(--sg-accent, #4f46e5); border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.13s ease; }
  .sx-add:hover { background: color-mix(in srgb, var(--sg-accent, #4f46e5) 10%, transparent); }
  .sx-error { margin: 0; font-size: 12px; color: var(--sg-danger, #dc2626); }
  .sx-hint { margin: 0; font-size: 12px; opacity: 0.55; }
</style>
