<script lang="ts">
  /**
   * SvAdvancedFilter - the advanced-filter panel (Pro).
   *
   * Mounted beside the grid by the consumer, like `<SvGridAlerts>`; there is no
   * grid-side renderer to register.
   *
   * The panel holds a DRAFT expression and only pushes it to the grid on Apply.
   * `SvExpressionEditor` emits on every keystroke, which is right for an alert
   * rule editor but would re-run the whole filter pipeline per character here.
   * Holding the draft also makes the live "matches N" counter a genuine preview
   * of what Apply would do, rather than a lagging echo of what already happened.
   */
  import { untrack } from 'svelte'
  import SvExpressionEditor from './SvExpressionEditor.svelte'
  import { exprColumnsFromGrid } from './advanced-filter/expr-columns-from-grid'
  import type { ExprColumn } from './expressions/expression-columns'
  import type { PredicateExpr } from './expressions/expression-types'

  type MinimalApi = {
    getColumns(): ReadonlyArray<{
      id: string
      field?: string
      header: string
      visible: boolean
      editorType?: string
    }>
    getData?: () => ReadonlyArray<Record<string, unknown>>
    setAdvancedFilter(expr: unknown): void
    getAdvancedFilter(): unknown
    isAdvancedFilterActive(): boolean
  }

  type Props = {
    /** The grid's API, from `onApiReady` / `bind:api`. */
    api: MinimalApi
    /** Rows for the live match preview. Defaults to the grid's own data. */
    rows?: ReadonlyArray<Record<string, unknown>>
    /** Override the derived column list. */
    columns?: ReadonlyArray<ExprColumn>
    /** Include columns the user has hidden. Default false. */
    includeHidden?: boolean
    /** Called after Apply / Clear with the expression now on the grid. */
    onApply?: (expr: PredicateExpr | null) => void
    /**
     * The expression the panel shows, bindable. Assign it to drive the panel
     * from outside - a preset button, a saved view - and the draft re-seeds to
     * match. Without this a parent that calls `api.setAdvancedFilter()` itself
     * would filter the grid while the panel kept showing its old draft.
     */
    expression?: PredicateExpr | null
  }

  let {
    api,
    rows,
    columns,
    includeHidden = false,
    onApply,
    expression = $bindable<PredicateExpr | null>(undefined as never),
  }: Props = $props()

  const EMPTY: PredicateExpr = { kind: 'const', value: true }

  const resolvedColumns = $derived(
    columns ?? exprColumnsFromGrid(api, { includeHidden }),
  )
  const previewRows = $derived(rows ?? api.getData?.() ?? [])

  /** The expression currently ON the grid, seeded once from it. */
  let applied = $state<PredicateExpr | null>(
    (untrack(() => api.getAdvancedFilter()) as PredicateExpr | null) ?? null,
  )
  /** What the editor is editing. Not pushed until Apply. */
  let draft = $state<PredicateExpr>(applied ?? EMPTY)

  const isDirty = $derived(JSON.stringify(draft) !== JSON.stringify(applied ?? EMPTY))
  const canClear = $derived(applied != null)

  /**
   * Follow an externally assigned `expression`. Compared by reference so the
   * panel's own writes below are skipped and this cannot loop.
   */
  let lastSynced = $state<PredicateExpr | null | undefined>(undefined)
  $effect(() => {
    const incoming = expression
    if (incoming === undefined || incoming === untrack(() => lastSynced)) return
    untrack(() => {
      lastSynced = incoming
      applied = incoming
      draft = incoming ?? { kind: 'const', value: true }
    })
  })

  function apply() {
    api.setAdvancedFilter(draft as never)
    applied = draft
    lastSynced = draft
    expression = draft
    onApply?.(draft)
  }

  function clear() {
    api.setAdvancedFilter(null)
    applied = null
    lastSynced = null
    expression = null
    // Reassign so the editor re-seeds - it compares by reference.
    draft = { kind: 'const', value: true }
    onApply?.(null)
  }

  function revert() {
    draft = applied ?? { kind: 'const', value: true }
  }

  /** True when an expression is set but no engine is registered to run it. */
  const inactive = $derived(applied != null && !api.isAdvancedFilterActive())
</script>

<section class="sv-adv-filter" aria-label="Advanced filter">
  <header class="sv-adv-filter__head">
    <h2 class="sv-adv-filter__title">Advanced filter</h2>
    {#if applied}
      <span class="sv-adv-filter__badge" aria-label="A filter is applied">Active</span>
    {/if}
  </header>

  {#if inactive}
    <p class="sv-adv-filter__warn" role="status">
      A filter is set but no advanced-filter engine is registered, so no rows are
      being removed. Call <code>enableAdvancedFilter()</code> from
      <code>@svgrid/enterprise</code>.
    </p>
  {/if}

  <SvExpressionEditor columns={resolvedColumns} bind:value={draft} rows={previewRows} />

  <footer class="sv-adv-filter__actions">
    <button type="button" class="sv-adv-filter__btn is-primary" disabled={!isDirty} onclick={apply}>
      Apply
    </button>
    <button type="button" class="sv-adv-filter__btn" disabled={!isDirty} onclick={revert}>
      Revert
    </button>
    <button type="button" class="sv-adv-filter__btn" disabled={!canClear} onclick={clear}>
      Clear
    </button>
  </footer>
</section>

<style>
  .sv-adv-filter {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid var(--sg-border);
    border-radius: 8px;
    background: var(--sg-bg);
    color: var(--sg-fg);
  }
  .sv-adv-filter__head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .sv-adv-filter__title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
  }
  .sv-adv-filter__badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.1rem 0.4rem;
    border-radius: 9999px;
    background: var(--sg-accent);
    color: var(--sg-on-accent);
  }
  .sv-adv-filter__warn {
    margin: 0;
    font-size: 0.8rem;
    color: var(--sg-muted);
  }
  .sv-adv-filter__actions {
    display: flex;
    gap: 0.5rem;
  }
  .sv-adv-filter__btn {
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--sg-border);
    background: var(--sg-bg);
    color: var(--sg-fg);
    font-size: 0.85rem;
    cursor: pointer;
  }
  .sv-adv-filter__btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .sv-adv-filter__btn.is-primary {
    background: var(--sg-accent);
    color: var(--sg-on-accent);
    border-color: var(--sg-accent);
  }
</style>
