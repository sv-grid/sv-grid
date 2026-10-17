<script lang="ts" module>
  /**
   * Ask bar block - an "Ask about your data" bar over 30 invoices in an SvGrid.
   * A plain-words question runs aiFilter from the kit, which turns it into
   * column filters and a sort and applies them to the grid; a question that
   * starts with "summarize" runs aiSummarize over the rows on screen instead.
   * SvTextInput with an error state, SvButton with loading, SvChip suggested
   * queries, SvAlert for a failed call, SvBadge for the active model, and a
   * Clear button that brings every row back. Pure UI-kit, --sg-* themed.
   *
   * Headless: createAskBar() below owns the question, the provider fallback,
   * the aiFilter / aiSummarize calls, the answer and the error state with no
   * markup; the grid stays in your render and hands its api to the core. The
   * component under it is one styled render of that core; import createAskBar
   * from this file (or `npx @svgrid/ui add ai-ask-bar --headless` for the core
   * alone) to draw your own.
   */
  import {
    aiFilter, aiSummarize, setAIProvider, getAIProvider, hasAIProvider, mockAIProvider,
    type AIRowSource, type AIFilterResult, type AIFilterClause, type AISummary, type TableFeatures,
  } from '@svgrid/grid'

  export type Invoice = { amount: number; customer: string; owner: string; region: string; status: string; due: string; id: string }
  /** The part of the grid api the core uses; the api from SvGrid's onApiReady fits. */
  export type AskBarGrid = AIRowSource<TableFeatures, Invoice> & {
    getDisplayedRows(): ReadonlyArray<Invoice>
    clearAllFilters(): void
    clearSort(): void
  }
  export type AskBarOptions = {
    invoices?: Invoice[]
    suggestions?: string[]
    /** Called after clear() brings every row back. */
    onClear?: (total: number) => void
  }

  const customers = ['Acme Foods', 'Blue Harbor', 'Cobalt Labs', 'Delta Freight', 'Evergreen Co', 'Fable Studio']
  const owners = ['Sasha Kim', 'Jamie Ortiz', 'Morgan Lee', 'Riley Chen']
  const regions = ['EMEA', 'APAC', 'LATAM', 'NA']
  const statuses = ['Paid', 'Pending', 'Overdue', 'Paid', 'Pending']
  const SAMPLE: Invoice[] = Array.from({ length: 30 }, (_, i) => ({
    amount: 600 + ((i * 7919) % 11400),
    customer: customers[i % customers.length]!,
    owner: owners[(i * 3) % owners.length]!,
    region: regions[(i * 5 + 1) % regions.length]!,
    status: statuses[(i * 2) % statuses.length]!,
    due: `2026-${String(7 + (i % 4)).padStart(2, '0')}-${String(1 + ((i * 11) % 28)).padStart(2, '0')}`,
    id: `INV-${2041 + i}`,
  }))
  const SUGGESTIONS = ['Pending invoices over $5k', 'Owned by Sasha, highest first', 'Invoices for "Cobalt"', 'Summarize what is on screen']
  const OPS: Record<AIFilterClause['operator'], string> = {
    contains: 'contains', equals: '=', startsWith: 'starts with', greaterThan: '>', lessThan: '<', isBlank: 'is blank',
  }

  // setAIProvider is global. When your app registers a model at start-up (see
  // the docs: root +layout.svelte), every call goes to it. Until then the core
  // lends itself mockAIProvider for the length of one call so it runs offline,
  // and never replaces a provider the app already set.
  async function withProvider<T>(run: () => Promise<T>): Promise<T> {
    if (hasAIProvider()) return run()
    setAIProvider(mockAIProvider)
    try { return await run() } finally { if (getAIProvider() === mockAIProvider) setAIProvider(null) }
  }

  export function createAskBar(opts: AskBarOptions = {}) {
    const invoices = opts.invoices ?? SAMPLE
    const offline = !hasAIProvider() || getAIProvider() === mockAIProvider

    let api = $state<AskBarGrid | null>(null)
    let question = $state('')
    let busy = $state(false)
    let inputError = $state('')
    let failure = $state('')
    let plan = $state<AIFilterResult | null>(null)
    let summary = $state<AISummary | null>(null)
    let shown = $state(invoices.length)

    async function ask(q = question) {
      question = q
      if (!api) return
      const grid = api
      if (!q.trim()) { inputError = 'Type a question first'; return }
      inputError = ''; failure = ''; busy = true
      try {
        if (/^\s*summari[sz]e/i.test(q)) {
          const view = grid.getDisplayedRows()
          const all = grid.getData()
          summary = await withProvider(() => aiSummarize(grid, { target: { kind: 'selection', rowIndices: view.map((r) => all.indexOf(r)) }, question: q }))
        } else {
          summary = null
          plan = await withProvider(() => aiFilter(grid, q, { apply: true }))
          // Let the grid re-run its row pipeline before counting what it shows.
          await new Promise((r) => setTimeout(r))
          shown = grid.getDisplayedRows().length
        }
      } catch (e) {
        failure = e instanceof Error ? e.message : String(e)
      } finally {
        busy = false
      }
    }

    function clear() {
      api?.clearAllFilters(); api?.clearSort()
      plan = null; summary = null; failure = ''; question = ''; shown = invoices.length
      opts.onClear?.(invoices.length)
    }

    return {
      invoices,
      suggestions: opts.suggestions ?? SUGGESTIONS,
      /** True when no app provider is registered (or it is mockAIProvider). */
      offline,
      /** Hand the grid's api over from onApiReady. */
      get api() { return api },
      set api(v: AskBarGrid | null) { api = v },
      get question() { return question },
      set question(v: string) { question = v },
      get busy() { return busy },
      get inputError() { return inputError },
      /** The error message of a failed call, or ''. */
      get failure() { return failure },
      get plan() { return plan },
      get summary() { return summary },
      /** Rows on screen after the last answer. */
      get shown() { return shown },
      /** True when there is something for Clear to undo. */
      get canClear() { return !!(plan || summary || failure) },
      ask,
      clear,
      /** "status = Pending", for showing how the model read the question. */
      describe: (f: AIFilterClause) => `${f.field} ${OPS[f.operator]} ${f.value ?? ''}`,
      /** Spread on the ask <form>. */
      formProps: () => ({ onsubmit: (e: Event) => { e.preventDefault(); void ask() } }),
    }
  }
</script>

<script lang="ts">
  import {
    SvGrid, SvTextInput, SvButton, SvChip, SvAlert, SvBadge, SvToaster, toast,
    tableFeatures, rowSortingFeature, columnFilteringFeature, type GridColumns,
  } from '@svgrid/grid'

  const columns: GridColumns<Invoice> = [
    { field: 'id', header: 'Invoice', width: 100, hideBelow: 480 },
    { field: 'customer', header: 'Customer', width: 140 },
    { field: 'owner', header: 'Owner', width: 120, hideBelow: 640 },
    { field: 'region', header: 'Region', width: 90, hideBelow: 640 },
    { field: 'status', header: 'Status', width: 112 },
    { field: 'due', header: 'Due', width: 110, hideBelow: 640 },
    { field: 'amount', header: 'Amount', width: 110, editorType: 'number', format: { type: 'currency', currency: 'USD' } },
  ]
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const bar = createAskBar({ onClear: (n) => toast(`Showing all ${n} invoices`) })
</script>

<main class="sv-askbar">
  <header class="sv-askbar-head">
    <div>
      <h2>Ask about your invoices</h2>
      <p class="sv-askbar-muted">Q3 billing for Northwind. Ask in plain words; the answer becomes filters you can see and clear.</p>
    </div>
    <SvBadge variant={bar.offline ? 'neutral' : 'success'} size="sm">{bar.offline ? 'Offline demo model' : 'Connected model'}</SvBadge>
  </header>

  <form class="sv-askbar-ask" {...bar.formProps()}>
    <div class="sv-askbar-q">
      <SvTextInput label="Ask about your data" bind:value={bar.question} placeholder="e.g. pending invoices in EMEA over $5k" error={bar.inputError} block>
        {#snippet leading()}
          <svg class="sv-askbar-spark" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor" /></svg>
        {/snippet}
      </SvTextInput>
    </div>
    <div class="sv-askbar-ask-actions">
      <SvButton type="submit" loading={bar.busy}>Ask</SvButton>
      <SvButton variant="ghost" onclick={bar.clear} disabled={bar.busy || !bar.canClear}>Clear</SvButton>
    </div>
  </form>

  <div class="sv-askbar-chips" aria-label="Suggested questions">
    {#each bar.suggestions as s (s)}
      <SvChip size="sm" onClick={() => bar.ask(s)} disabled={bar.busy}>{s}</SvChip>
    {/each}
  </div>

  {#if bar.failure}
    <SvAlert variant="danger" title="The model could not answer" soft>
      {bar.failure}
      {#snippet actions()}<SvButton size="sm" variant="outline" onclick={() => bar.ask()}>Try again</SvButton>{/snippet}
    </SvAlert>
  {:else if bar.summary}
    <section class="sv-askbar-answer" aria-live="polite">
      <h3>Summary of {bar.shown} invoices</h3>
      <p>{bar.summary.text}</p>
      <ul>{#each bar.summary.bullets as b (b)}<li>{b}</li>{/each}</ul>
    </section>
  {:else if bar.plan}
    <section class="sv-askbar-answer" aria-live="polite">
      <h3>{bar.shown} of {bar.invoices.length} invoices match</h3>
      <p>{bar.plan.rationale}</p>
      {#if bar.plan.filters.length || bar.plan.sort.length}
        <div class="sv-askbar-clauses">
          {#each bar.plan.filters as f, i (i)}<SvBadge size="sm">{bar.describe(f)}</SvBadge>{/each}
          {#each bar.plan.sort as s, i (i)}<SvBadge size="sm">sort {s.field} {s.desc ? 'desc' : 'asc'}</SvBadge>{/each}
        </div>
      {/if}
    </section>
  {/if}

  <div class="sv-askbar-grid-wrap">
    <SvGrid data={bar.invoices} {columns} {features} containerHeight={340} fitColumns responsive showRowSelection={false}
      onApiReady={(a) => (bar.api = a)} />
  </div>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-askbar {
    width: 100%; box-sizing: border-box; max-width: 880px; margin: 0 auto; min-height: 560px;
    display: flex; flex-direction: column; gap: 14px; padding: 28px 24px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-askbar-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  h2 { margin: 0 0 4px; font-size: 22px; font-weight: 700; letter-spacing: -.01em; }
  h3 { margin: 0 0 6px; font-size: 14px; font-weight: 600; }
  .sv-askbar-muted { margin: 0; font-size: 13.5px; color: var(--sg-muted, #64748b); max-width: 60ch; }
  .sv-askbar-ask { display: flex; align-items: flex-end; gap: 10px; }
  .sv-askbar-q { flex: 1; min-width: 0; }
  .sv-askbar-ask-actions { display: flex; gap: 6px; }
  .sv-askbar-spark { display: block; color: var(--sg-accent, #4f46e5); }
  .sv-askbar-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .sv-askbar-answer {
    padding: 14px 16px; border-radius: var(--sg-radius-lg, 12px); font-size: 13.5px; line-height: 1.5;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 4%, var(--sg-bg, #fff));
  }
  .sv-askbar-answer p { margin: 0; }
  .sv-askbar-answer ul { margin: 8px 0 0; padding-left: 18px; list-style: disc; }
  .sv-askbar-clauses { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .sv-askbar-grid-wrap { min-width: 0; }

  @media (max-width: 640px) {
    .sv-askbar { padding: 20px 12px; }
    .sv-askbar-head { flex-direction: column; gap: 8px; }
    .sv-askbar-ask { flex-direction: column; align-items: stretch; }
    .sv-askbar-ask-actions > :global(*) { flex: 1; }
  }
</style>
