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

  import {
    freshCondition,
    freshGroup,
    fromBuilderTree,
    toBuilderTree,
    MAX_BUILDER_DEPTH,
    type BuilderGroup,
    type BuilderNode,
  } from './expressions/builder-tree'

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
  // The conversion itself lives in expressions/builder-tree.ts, so the round
  // trip can be tested without mounting this component.

  const initial = toBuilderTree(value, columns)
  let root = $state<BuilderGroup>(initial ?? freshGroup(columns))
  // If the incoming value cannot be shown as a tree, start in text mode so
  // nothing is lost.
  if (!initial && mode === 'builder') mode = 'text'

  let text = $state(stringifyPredicate(value, columns))
  let textError = $state<string | null>(null)

  /**
   * The last expression WE produced, serialized. Everything below is seeded
   * once at init, so without this the editor would ignore a `value` assigned
   * from outside - loading a saved filter or clicking a preset would update the
   * grid while the editor kept showing the old conditions.
   *
   * Compared by VALUE, not by reference. Reference comparison looks right and
   * is cheaper, but `value` is $bindable: the object that comes back in is not
   * the object we assigned, so the check never matched and the effect re-seeded
   * the tree after every one of our own edits. Flat lists survived that because
   * they round-trip exactly; a nested group does not, since a group holding one
   * condition serializes to the bare condition, so adding a group appeared to
   * do nothing at all.
   */
  let lastEmittedJson = $state<string>(JSON.stringify(value))

  $effect(() => {
    const incoming = value
    if (JSON.stringify(incoming) === untrack(() => lastEmittedJson)) return
    untrack(() => {
      const next = toBuilderTree(incoming, columns)
      if (next) {
        root = next
      } else if (mode === 'builder') {
        // Not representable as a tree; text mode keeps it intact.
        mode = 'text'
      }
      text = stringifyPredicate(incoming, columns)
      textError = null
      lastEmittedJson = JSON.stringify(incoming)
    })
  })

  const columnOptions = $derived(columns.map((c) => ({ value: c.id, label: c.name ?? c.id })))

  function opsFor(columnId: string) {
    const type = columnById(columns, columnId)?.type
    return operatorsForType(type).map((o) => ({ value: o.value, label: o.label }))
  }

  // --- Emit ----------------------------------------------------------------

  function emitBuilder() {
    const expr = fromBuilderTree(root)
    lastEmittedJson = JSON.stringify(expr)
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
        lastEmittedJson = JSON.stringify(expr)
        value = expr
        onChange?.(expr)
      }
    } catch (err) {
      textError = err instanceof ExpressionParseError ? err.message : 'Invalid expression'
    }
  }

  // Mutations take the parent group and an index rather than a path, because
  // the recursive markup already holds the parent it is rendering.

  function addCondition(group: BuilderGroup) {
    group.children.push(freshCondition(columns))
    emitBuilder()
  }

  function addGroup(group: BuilderGroup) {
    // A nested group defaults to the OPPOSITE combinator. Nesting an "all"
    // inside an "all" is a no-op the user would then have to correct, so the
    // default is the one that makes the new group mean something.
    group.children.push(
      freshGroup(columns, group.combinator === 'and' ? 'or' : 'and'),
    )
    emitBuilder()
  }

  function removeChild(group: BuilderGroup, i: number) {
    group.children.splice(i, 1)
    // The root must always offer somewhere to type. A nested group is allowed
    // to empty out, because removing its last child is how you delete it.
    if (group === root && group.children.length === 0) {
      group.children.push(freshCondition(columns))
    }
    emitBuilder()
  }

  function setColumn(cond: Extract<BuilderNode, { kind: 'cond' }>, columnId: string) {
    const ops = opsFor(columnId)
    cond.column = columnId
    if (!ops.some((o) => o.value === cond.op)) cond.op = ops[0]?.value ?? 'equals'
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
      return toBuilderTree(parsePredicate(text, columns), columns) != null
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
        const tree = toBuilderTree(expr, columns)
        if (!tree) {
          textError = 'This expression uses column maths - stay in text mode'
          return
        }
        root = tree
        lastEmittedJson = JSON.stringify(expr)
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
    {@render groupBody(root, 0)}
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

<!--
  One condition row: column, operator, and whichever value control the operator
  needs. `cond` is the live state object, so writing to it mutates the tree in
  place and `emitBuilder` re-reads the whole thing.
-->
{#snippet conditionRow(cond: Extract<BuilderNode, { kind: 'cond' }>, parent: BuilderGroup, i: number)}
  <div class="sx-row">
    <SvDropDownList
      size="sm"
      options={columnOptions}
      value={cond.column}
      onChange={(v) => setColumn(cond, String(v))}
      ariaLabel="Column" />
    <SvDropDownList
      size="sm"
      options={opsFor(cond.column)}
      value={cond.op}
      onChange={(v) => { cond.op = v as ExcelFilterOperator; emitBuilder() }}
      ariaLabel="Operator" />
    {#if isValueless(cond.op)}
      <span class="sx-noval">-</span>
    {:else if isSetOperator(cond.op)}
      <SvTagsInput
        value={cond.values}
        onChange={(vals) => { cond.values = vals; emitBuilder() }}
        placeholder="Add value…"
        ariaLabel="Values" />
    {:else if isRangeOperator(cond.op)}
      <SvTextInput
        size="sm"
        value={cond.value}
        onChange={(v) => { cond.value = v; emitBuilder() }}
        placeholder="From"
        ariaLabel="From" />
      <SvTextInput
        size="sm"
        value={cond.valueTo}
        onChange={(v) => { cond.valueTo = v; emitBuilder() }}
        placeholder="To"
        ariaLabel="To" />
    {:else}
      <SvTextInput
        size="sm"
        value={cond.value}
        onChange={(v) => { cond.value = v; emitBuilder() }}
        placeholder="Value"
        ariaLabel="Value" />
    {/if}
    <button
      type="button"
      class="sx-del"
      onclick={() => removeChild(parent, i)}
      aria-label="Remove condition">✕</button>
  </div>
{/snippet}

<!--
  A group and everything under it. Recursive: a snippet may render itself, which
  is what lets one definition cover arbitrary nesting.

  `depth` only drives presentation and whether another level may be added.
  toBuilderTree enforces the same limit on the way in, so an expression too deep
  to render never reaches here in the first place.
-->
{#snippet groupBody(group: BuilderGroup, depth: number)}
  <div class="sx-combinator">
    {#if group.negated}
      <span class="sx-not">NOT</span>
    {/if}
    Match
    <SvDropDownList
      size="sm"
      options={[{ value: 'and', label: 'all' }, { value: 'or', label: 'any' }]}
      value={group.combinator}
      onChange={(v) => { group.combinator = v as 'and' | 'or'; emitBuilder() }}
      ariaLabel="Combine conditions" />
    of the following:
  </div>
  <div class="sx-rows">
    {#each group.children as child, i (i)}
      {#if child.kind === 'cond'}
        {@render conditionRow(child, group, i)}
      {:else}
        <div class="sx-group">
          <div class="sx-group-head">
            <button
              type="button"
              class="sx-neg"
              class:sx-neg-on={child.negated}
              aria-pressed={child.negated}
              title="Negate this group"
              onclick={() => { child.negated = !child.negated; emitBuilder() }}>NOT</button>
            <span class="sx-group-spacer"></span>
            <button
              type="button"
              class="sx-del"
              onclick={() => removeChild(group, i)}
              aria-label="Remove group">✕</button>
          </div>
          {@render groupBody(child, depth + 1)}
        </div>
      {/if}
    {/each}
  </div>
  <div class="sx-actions">
    <button type="button" class="sx-add" onclick={() => addCondition(group)}>
      + Add condition
    </button>
    {#if depth < MAX_BUILDER_DEPTH - 1}
      <button type="button" class="sx-add" onclick={() => addGroup(group)}>
        + Add group
      </button>
    {/if}
  </div>
{/snippet}

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
  .sx-actions { display: flex; gap: 7px; flex-wrap: wrap; }
  .sx-add { align-self: flex-start; border: 1px dashed color-mix(in srgb, var(--sg-accent, #4f46e5) 45%, currentColor); background: transparent; color: var(--sg-accent, #4f46e5); border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.13s ease; }
  .sx-add:hover { background: color-mix(in srgb, var(--sg-accent, #4f46e5) 10%, transparent); }
  /* A nested group. The left rule is what makes the nesting readable at a
     glance - without it the rows of a subgroup look like siblings of the rows
     above them, which is exactly the ambiguity the group exists to remove. */
  .sx-group {
    display: flex; flex-direction: column; gap: 8px;
    border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
    border-left: 3px solid color-mix(in srgb, var(--sg-accent, #4f46e5) 55%, transparent);
    border-radius: 9px; padding: 9px; margin-left: 2px;
    background: color-mix(in srgb, currentColor 3%, transparent);
  }
  .sx-group-head { display: flex; align-items: center; gap: 6px; }
  .sx-group-spacer { flex: 1; }
  .sx-neg {
    border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
    background: transparent; color: inherit; opacity: 0.6;
    border-radius: 6px; padding: 2px 8px; font-size: 10.5px; font-weight: 700;
    letter-spacing: 0.04em; cursor: pointer; transition: background 0.13s ease, opacity 0.13s ease;
  }
  .sx-neg:hover { opacity: 1; }
  .sx-neg-on {
    background: var(--sg-danger, #dc2626); border-color: var(--sg-danger, #dc2626);
    color: #fff; opacity: 1;
  }
  .sx-not { font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; color: var(--sg-danger, #dc2626); }
  .sx-error { margin: 0; font-size: 12px; color: var(--sg-danger, #dc2626); }
  .sx-hint { margin: 0; font-size: 12px; opacity: 0.55; }
</style>
