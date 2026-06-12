<script lang="ts">
  /**
   * 51. AI assistant (Pro)
   * ----------------------
   * Demonstrates the sv-grid-pro AI feature pack. The grid stays
   * model-agnostic; the demo wires the bundled `mockAIProvider` so
   * everything works end-to-end without any keys. In production you
   * register your own adapter that calls OpenAI / Anthropic / a proxy:
   *
   *   setAIProvider(async ({ prompt, responseFormat, signal }) => {
   *     const r = await fetch('/api/ai', { method: 'POST', body: prompt, signal })
   *     return r.text()
   *   })
   *
   * Four panels, four AI features:
   *
   *   1. **Ask** - natural-language filter / sort plan. Preview the
   *      filters the model proposes; one click applies them.
   *   2. **Smart fill** - column-completion from worked examples.
   *      Type one or two values into "tier", hit "Propose rest".
   *   3. **Summarize** - one-paragraph summary of the current view,
   *      a selection, or a single row.
   *   4. **Classify** - bucket free-text rows into predefined labels
   *      ("at-risk", "expanding", "steady") with confidence.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from 'sv-grid-community'
  import {
    installPro,
    setLicenseKey,
    dismissUnlicensedNudge,
    setAIProvider,
    mockAIProvider,
    type ProGridApi,
    type AIFilterResult,
    type AISmartFillResult,
    type AISummary,
    type AIClassifyResult,
  } from 'sv-grid-pro'

  // ---- Domain ---------------------------------------------------------

  type Account = {
    id: string
    company: string
    owner: string
    region: 'NA' | 'EMEA' | 'APAC' | 'LATAM'
    industry: string
    arr: number
    employees: number
    nps: number
    lastTouch: string         // ISO date
    notes: string             // free-text - what the classifier reads
    tier: string              // committed value (Smart Fill commit or manual edit)
    proposedTier: string      // AI proposal awaiting accept
    tierConfidence: number
    sentiment: string         // committed value (Classify commit)
    proposedSentiment: string // AI proposal awaiting commit
    sentimentConfidence: number
  }

  // ---- Seed -----------------------------------------------------------

  const COMPANIES = [
    'Northwind Logistics', 'Helios Holdings', 'Vertex Trust', 'Pacific Industries',
    'Atlas Group', 'Stellar Networks', 'Quantum Bio', 'Apex Resources',
    'Crescent Labs', 'Polaris Systems', 'Aurora Materials', 'Sigma Capital',
    'Pioneer Mining', 'Granite Markets', 'Cobalt Engineering', 'Sentinel Health',
    'Tessera Energy', 'Vanguard Foods', 'Cascade Bio', 'Meridian Retail',
  ]
  const OWNERS = ['Sasha Park', 'Jamie Chen', 'Robin Diaz', 'Casey Singh', 'Drew Olsen', 'Morgan Tran']
  const REGIONS: readonly Account['region'][] = ['NA', 'EMEA', 'APAC', 'LATAM']
  const INDUSTRIES = ['SaaS', 'Manufacturing', 'Logistics', 'Financial Services', 'Healthcare', 'Energy', 'Retail']

  const NOTE_TEMPLATES = [
    'Renewal looking solid, expanding into 2 new business units next quarter.',
    'Champion left the company, no clear backfill. ARR at risk if not stabilised.',
    'Steady usage, no major changes. Quiet but reliable.',
    'Procurement flagged budget cuts; spend review scheduled for next month.',
    'Discussion about adding 200 seats and the analytics module.',
    'Support escalation last week left a sour taste. Watching closely.',
    'Pilot with the EMEA team converted. Looking at full org rollout in Q3.',
    'Renewal pushed back two months while legal redlines the new MSA.',
    'Open ticket about reporting performance. Engineering has eyes on it.',
    'Looks healthy on the surface, but usage is trending down month over month.',
  ]

  let prng = 0xA1A2A3A4 >>> 0
  function rnd(): number {
    prng = (prng * 1664525 + 1013904223) >>> 0
    return prng / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }

  function seedAccounts(): Account[] {
    return COMPANIES.map((name, i) => ({
      id: `ACC-${(1000 + i).toString()}`,
      company: name,
      owner: pick(OWNERS),
      region: pick(REGIONS),
      industry: pick(INDUSTRIES),
      arr: Math.round((40_000 + rnd() * 760_000) / 1000) * 1000,
      employees: 30 + Math.floor(rnd() * 1500),
      nps: -10 + Math.floor(rnd() * 70),
      lastTouch: new Date(Date.now() - Math.floor(rnd() * 90) * 86_400_000).toISOString().slice(0, 10),
      notes: pick(NOTE_TEMPLATES),
      tier: '',
      proposedTier: '',
      tierConfidence: 0,
      sentiment: '',
      proposedSentiment: '',
      sentimentConfidence: 0,
    }))
  }

  // ---- Reactive state -------------------------------------------------

  // Mock provider so the demo works without an API key. In a real app
  // this is the seam where you wire your model call.
  setLicenseKey('SVPRO-DEV-AI')
  dismissUnlicensedNudge()
  setAIProvider(mockAIProvider)

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let accounts = $state<Account[]>(seedAccounts())
  let api = $state<ProGridApi<typeof features, Account> | null>(null)
  let activeIndex = $state<number>(0)

  // Tab state
  type Tab = 'ask' | 'fill' | 'summary' | 'classify'
  let tab = $state<Tab>('ask')

  // Shared "loading" state per panel.
  let busy = $state<Tab | null>(null)
  let errorMsg = $state<string | null>(null)

  // Ask (NL filter)
  let askQuery = $state<string>('show accounts with ARR over $200k in EMEA, highest first')
  let askPlan = $state<AIFilterResult | null>(null)

  // Smart fill
  let fillExamples = $state<Array<{ company: string; tier: string }>>([
    { company: COMPANIES[0]!, tier: 'enterprise' },
    { company: COMPANIES[1]!, tier: 'growth' },
  ])
  let fillResult = $state<AISmartFillResult | null>(null)

  // Summary
  let summaryScope = $state<'all' | 'row'>('all')
  let summaryQuestion = $state<string>('Which accounts should I worry about?')
  let summary = $state<AISummary | null>(null)

  // Classify
  const CLASSES = ['at-risk', 'expanding', 'steady'] as const
  let classifyResult = $state<AIClassifyResult | null>(null)

  // ---- Actions --------------------------------------------------------

  async function runAsk(): Promise<void> {
    if (!api) return
    busy = 'ask'; errorMsg = null; askPlan = null
    try {
      askPlan = await api.ai.filter(askQuery)
    } catch (e) { errorMsg = (e as Error).message }
    finally { busy = null }
  }

  function applyAskPlan(): void {
    if (!api || !askPlan) return
    api.clearAllFilters()
    api.clearSort()
    for (const f of askPlan.filters) {
      api.setFilter(f.field, { operator: f.operator, value: f.value ?? '' })
    }
    const last = askPlan.sort[askPlan.sort.length - 1]
    if (last) api.setSort(last.field, last.desc ? 'desc' : 'asc')
  }

  async function runSmartFill(): Promise<void> {
    if (!api) return
    busy = 'fill'; errorMsg = null; fillResult = null
    try {
      fillResult = await api.ai.smartFill({
        field: 'tier',
        examples: fillExamples.map((ex) => ({
          input: accounts.find((a) => a.company === ex.company) ?? {},
          output: ex.tier,
        })),
      })
      // Write proposals onto the data so the grid cells pick them up.
      const byIdx = new Map(fillResult.predictions.map((p) => [p.rowIndex, p]))
      accounts = accounts.map((a, i) => {
        const p = byIdx.get(i)
        if (!p) return a
        return { ...a, proposedTier: String(p.value), tierConfidence: p.confidence }
      })
    } catch (e) { errorMsg = (e as Error).message }
    finally { busy = null }
  }

  function acceptFillPrediction(rowIndex: number, value: unknown): void {
    accounts = accounts.map((a, i) => (
      i === rowIndex ? { ...a, tier: String(value), proposedTier: '', tierConfidence: 0 } : a
    ))
    if (fillResult) {
      fillResult = {
        ...fillResult,
        predictions: fillResult.predictions.filter((p) => p.rowIndex !== rowIndex),
      }
    }
  }
  function acceptAllFill(): void {
    if (!fillResult) return
    const byIndex = new Map(fillResult.predictions.map((p) => [p.rowIndex, String(p.value)]))
    accounts = accounts.map((a, i) => (
      byIndex.has(i)
        ? { ...a, tier: byIndex.get(i)!, proposedTier: '', tierConfidence: 0 }
        : a
    ))
    fillResult = { ...fillResult, predictions: [] }
  }

  async function runSummarize(): Promise<void> {
    if (!api) return
    busy = 'summary'; errorMsg = null; summary = null
    try {
      summary = await api.ai.summarize({
        target: summaryScope === 'row' ? { kind: 'row', rowIndex: activeIndex } : { kind: 'all' },
        question: summaryQuestion.trim() || undefined,
      })
    } catch (e) { errorMsg = (e as Error).message }
    finally { busy = null }
  }

  async function runClassify(): Promise<void> {
    if (!api) return
    busy = 'classify'; errorMsg = null; classifyResult = null
    try {
      classifyResult = await api.ai.classify({
        inputField: 'notes',
        outputField: 'sentiment',
        classes: [...CLASSES],
        classDescriptions: {
          'at-risk':   'churn signals, escalations, lost champion, declining usage',
          'expanding': 'new modules, more seats, additional regions, deeper adoption',
          'steady':    'no signals in either direction',
        },
      })
      // Write proposals onto the row data so the Sentiment cell picks them
      // up via standard Svelte reactivity. Without this the grid wouldn't
      // know to re-render cells when classifyResult changes.
      const byIdx = new Map(classifyResult.predictions.map((p) => [p.rowIndex, p]))
      accounts = accounts.map((a, i) => {
        const p = byIdx.get(i)
        if (!p) return a
        return { ...a, proposedSentiment: p.value, sentimentConfidence: p.confidence }
      })
    } catch (e) { errorMsg = (e as Error).message }
    finally { busy = null }
  }
  function applyClassify(): void {
    if (!classifyResult) return
    const byIndex = new Map(classifyResult.predictions.map((p) => [p.rowIndex, p.value]))
    accounts = accounts.map((a, i) => (
      byIndex.has(i)
        ? { ...a, sentiment: byIndex.get(i)!, proposedSentiment: '', sentimentConfidence: 0 }
        : a
    ))
  }

  // ---- Formatters -----------------------------------------------------

  function fmtMoneyShort(n: number): string {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`
    return `$${n}`
  }
</script>

<!-- ─────────────────── CELL SNIPPETS ─────────────────── -->

{#snippet TierCell(props: { row: Account; rowIndex: number })}
  <span class="ai-tier-cell">
    {#if props.row.tier}
      <span class={`ai-tier ai-tier-${props.row.tier}`}>{props.row.tier}</span>
    {:else if props.row.proposedTier}
      <span class={`ai-tier ai-tier-${props.row.proposedTier}`} title={`confidence ${Math.round(props.row.tierConfidence * 100)}%`}>
        {props.row.proposedTier}
        <button type="button" class="ai-accept" onclick={(e) => { e.stopPropagation(); acceptFillPrediction(props.rowIndex, props.row.proposedTier) }}>✓</button>
      </span>
    {:else}
      <span class="ai-muted">-</span>
    {/if}
  </span>
{/snippet}

{#snippet SentimentCell(props: { row: Account; rowIndex: number })}
  {@const committed = props.row.sentiment}
  {@const proposed = props.row.proposedSentiment}
  {@const val = committed || proposed}
  {#if val}
    <span class={`ai-sent ai-sent-${val}`} title={!committed ? `proposed (${Math.round(props.row.sentimentConfidence * 100)}%)` : ''}>
      {val}{#if !committed && proposed}<span class="ai-pred-dot" aria-hidden="true"></span>{/if}
    </span>
  {:else}
    <span class="ai-muted">-</span>
  {/if}
{/snippet}

{#snippet NotesCell(props: { row: Account })}
  <span class="ai-notes" title={props.row.notes}>{props.row.notes}</span>
{/snippet}

{#snippet ArrCell(props: { row: Account })}
  <span class="ai-arr tabular-nums">{fmtMoneyShort(props.row.arr)}</span>
{/snippet}

<!-- ─────────────────── LAYOUT ─────────────────── -->

<section class="ai-shell flex flex-1 min-h-0 gap-3">
  <!-- AI panel (left) -->
  <aside class="ai-panel">
    <header class="ai-header">
      <div class="ai-header-row">
        <span class="ai-badge">PRO · AI</span>
        <span class="ai-header-title">Grid Assistant</span>
      </div>
      <p class="ai-header-sub">
        Powered by your provider via <code>setAIProvider()</code>. This demo
        uses the bundled deterministic mock so no key is required.
      </p>
    </header>

    <nav class="ai-tabs">
      {#each [
        { id: 'ask',      label: 'Ask' },
        { id: 'fill',     label: 'Smart fill' },
        { id: 'summary',  label: 'Summarise' },
        { id: 'classify', label: 'Classify' },
      ] as t (t.id)}
        <button type="button" class={`ai-tab ${tab === t.id ? 'ai-tab-active' : ''}`} onclick={() => (tab = t.id as Tab)}>
          {t.label}
        </button>
      {/each}
    </nav>

    <div class="ai-tab-body">
      {#if tab === 'ask'}
        <label class="ai-field">
          <span>Ask in plain English</span>
          <textarea rows="3" bind:value={askQuery} placeholder="e.g. accounts losing momentum in EMEA, by NPS"></textarea>
        </label>
        <button type="button" class="ai-btn ai-btn-primary" disabled={busy === 'ask'} onclick={runAsk}>
          {busy === 'ask' ? 'Planning...' : 'Plan filter'}
        </button>
        {#if askPlan}
          <div class="ai-result">
            <div class="ai-rationale">{askPlan.rationale}</div>
            {#if askPlan.filters.length || askPlan.sort.length}
              <ul class="ai-clauses">
                {#each askPlan.filters as f, i (i)}
                  <li><strong>{f.field}</strong> <span class="ai-muted">{f.operator}</span> <code>{f.value ?? ''}</code></li>
                {/each}
                {#each askPlan.sort as s, i (`s${i}`)}
                  <li>sort <strong>{s.field}</strong> <span class="ai-muted">{s.desc ? 'desc' : 'asc'}</span></li>
                {/each}
              </ul>
              <button type="button" class="ai-btn ai-btn-primary ai-btn-block" onclick={applyAskPlan}>Apply to grid</button>
            {:else}
              <div class="ai-muted">No filter clauses inferred.</div>
            {/if}
          </div>
        {/if}
      {:else if tab === 'fill'}
        <div class="ai-hint">Provide one or two example values for the <strong>tier</strong> column, then let the assistant propose the rest.</div>
        <div class="ai-examples">
          {#each fillExamples as ex, i (i)}
            <div class="ai-example-row">
              <select bind:value={ex.company}>
                {#each COMPANIES as c (c)}<option>{c}</option>{/each}
              </select>
              <span class="ai-arrow">-&gt;</span>
              <input type="text" bind:value={ex.tier} placeholder="enterprise" />
            </div>
          {/each}
        </div>
        <button type="button" class="ai-btn ai-btn-primary" disabled={busy === 'fill'} onclick={runSmartFill}>
          {busy === 'fill' ? 'Inferring...' : 'Propose rest'}
        </button>
        {#if fillResult}
          <div class="ai-result">
            <div class="ai-rationale">{fillResult.rationale}</div>
            <div class="ai-fill-summary">
              {fillResult.predictions.length} proposal{fillResult.predictions.length === 1 ? '' : 's'} pending.
              {#if fillResult.predictions.length}
                <button type="button" class="ai-btn ai-btn-sm" onclick={acceptAllFill}>Accept all</button>
              {/if}
            </div>
          </div>
        {/if}
      {:else if tab === 'summary'}
        <div class="ai-scope">
          <label><input type="radio" bind:group={summaryScope} value="all" /> Whole view</label>
          <label><input type="radio" bind:group={summaryScope} value="row" /> Active row</label>
        </div>
        <label class="ai-field">
          <span>Focus question (optional)</span>
          <input type="text" bind:value={summaryQuestion} placeholder="What should I worry about?" />
        </label>
        <button type="button" class="ai-btn ai-btn-primary" disabled={busy === 'summary'} onclick={runSummarize}>
          {busy === 'summary' ? 'Reading rows...' : 'Summarise'}
        </button>
        {#if summary}
          <div class="ai-result ai-summary">
            <p>{summary.text}</p>
            {#if summary.bullets.length}
              <ul class="ai-bullets">
                {#each summary.bullets as b, i (i)}<li>{b}</li>{/each}
              </ul>
            {/if}
            {#if summary.highlightedFields.length}
              <div class="ai-highlight">
                Key fields:
                {#each summary.highlightedFields as f, i (i)}<span class="ai-chip">{f}</span>{/each}
              </div>
            {/if}
          </div>
        {/if}
      {:else if tab === 'classify'}
        <div class="ai-hint">
          Bucket the <strong>notes</strong> column into one of:
          <span class="ai-chip ai-sent-at-risk">at-risk</span>
          <span class="ai-chip ai-sent-expanding">expanding</span>
          <span class="ai-chip ai-sent-steady">steady</span>
        </div>
        <button type="button" class="ai-btn ai-btn-primary" disabled={busy === 'classify'} onclick={runClassify}>
          {busy === 'classify' ? 'Reading notes...' : 'Classify all rows'}
        </button>
        {#if classifyResult}
          <div class="ai-result">
            <div class="ai-fill-summary">
              {classifyResult.predictions.length} prediction{classifyResult.predictions.length === 1 ? '' : 's'} - visible in the <em>Sentiment</em> column.
              {#if classifyResult.predictions.length}
                <button type="button" class="ai-btn ai-btn-sm" onclick={applyClassify}>Commit all</button>
              {/if}
            </div>
          </div>
        {/if}
      {/if}

      {#if errorMsg}
        <div class="ai-error">{errorMsg}</div>
      {/if}
    </div>

    <footer class="ai-footer">
      Provider: <code>mockAIProvider</code> · License: <code>SVPRO-DEV-AI</code>
    </footer>
  </aside>

  <!-- Grid (right) -->
  <div class="ai-grid-wrap flex-1 min-w-0">
    <SvGrid
      data={accounts}
      columns={[
        { field: 'company',  header: 'Company',   width: 200 },
        { field: 'owner',    header: 'Owner',     width: 130 },
        { field: 'region',   header: 'Region',    width: 90 },
        { field: 'industry', header: 'Industry',  width: 130 },
        { field: 'arr',      header: 'ARR',       editorType: 'number', width: 110, editable: false,
          cell: (ctx) => renderSnippet(ArrCell, { row: ctx.row.original }) },
        { field: 'employees', header: 'Employees', editorType: 'number', width: 100 },
        { field: 'nps',       header: 'NPS',       editorType: 'number', width: 80 },
        { field: 'lastTouch', header: 'Last touch', width: 110 },
        { field: 'tier',      header: 'Tier',      width: 140,
          cell: (ctx) => renderSnippet(TierCell, { row: ctx.row.original, rowIndex: ctx.row.index }) },
        { field: 'sentiment', header: 'Sentiment', width: 130, editable: false,
          cell: (ctx) => renderSnippet(SentimentCell, { row: ctx.row.original, rowIndex: ctx.row.index }) },
        { field: 'notes',     header: 'Notes',     width: 320, editable: false,
          cell: (ctx) => renderSnippet(NotesCell, { row: ctx.row.original }) },
      ] satisfies ColumnDef<typeof features, Account>[]}
      features={features}
      filterMode="menu"
      selectionMode="row"
      showRowSelection={false}
      showPagination={false}
      enableInlineEditing={true}
      enableCellSelection={false}
      enableRowSummaries={false}
      rowHeight={44}
      containerHeight="100%"
      fitColumns={false}
      onApiReady={(a) => { api = installPro(a) }}
      onActiveCellChange={(args) => { activeIndex = args.rowIndex }}
    />
  </div>
</section>

<style>
  .ai-shell { min-height: 0; }

  /* AI panel */
  .ai-panel {
    width: 360px;
    flex-shrink: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .ai-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(14, 165, 233, 0.04));
  }
  :global([data-theme='dark']) .ai-header {
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(14, 165, 233, 0.08));
  }
  .ai-header-row { display: flex; align-items: center; gap: 8px; }
  .ai-badge {
    background: linear-gradient(135deg, #2563eb, #0ea5e9);
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 4px;
    letter-spacing: 0.06em;
  }
  .ai-header-title { font-size: 15px; font-weight: 700; }
  .ai-header-sub {
    margin: 6px 0 0;
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
    line-height: 1.4;
  }
  .ai-header-sub code {
    font-size: 11px;
    background: var(--sg-header-bg, #f1f5f9);
    padding: 0 4px;
    border-radius: 3px;
  }

  .ai-tabs {
    display: flex;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f1f5f9);
  }
  .ai-tab {
    flex: 1 1 0;
    border: 0;
    background: transparent;
    color: var(--sg-muted, #64748b);
    padding: 8px 6px;
    font-size: 12px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
  }
  .ai-tab:hover { color: var(--sg-fg, #1e293b); }
  .ai-tab-active {
    color: var(--sg-accent, #2563eb);
    border-bottom-color: var(--sg-accent, #2563eb);
    font-weight: 600;
    background: var(--sg-bg, #ffffff);
  }

  .ai-tab-body {
    padding: 14px 16px;
    overflow: auto;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .ai-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ai-field > span {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sg-muted, #64748b);
  }
  .ai-field textarea,
  .ai-field input,
  .ai-scope label,
  .ai-example-row select,
  .ai-example-row input {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 5px;
    padding: 6px 9px;
    font-size: 12.5px;
    font-family: inherit;
  }
  .ai-field textarea { resize: vertical; min-height: 56px; }

  .ai-hint {
    font-size: 12px;
    color: var(--sg-muted, #64748b);
    background: var(--sg-header-bg, #f1f5f9);
    padding: 8px 10px;
    border-radius: 6px;
    line-height: 1.4;
  }
  .ai-examples { display: flex; flex-direction: column; gap: 6px; }
  .ai-example-row { display: flex; align-items: center; gap: 6px; }
  .ai-example-row select { flex: 1 1 0; }
  .ai-example-row input { width: 110px; }
  .ai-arrow { font-family: ui-monospace, monospace; color: var(--sg-muted, #64748b); }

  .ai-scope { display: flex; gap: 14px; font-size: 12.5px; align-items: center; }
  .ai-scope label { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; padding: 0; border: 0; background: transparent; }

  .ai-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12.5px;
    cursor: pointer;
  }
  .ai-btn-primary {
    border-color: transparent;
    background: linear-gradient(135deg, #2563eb, #0ea5e9);
    color: #fff;
    font-weight: 600;
  }
  .ai-btn-primary:disabled { opacity: 0.6; cursor: progress; }
  .ai-btn-block { width: 100%; }
  .ai-btn-sm { padding: 3px 9px; font-size: 11px; margin-left: 6px; }

  .ai-result {
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 12.5px;
  }
  .ai-rationale {
    font-size: 12px;
    color: var(--sg-muted, #64748b);
    font-style: italic;
  }
  .ai-clauses {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12.5px;
  }
  .ai-clauses code {
    background: var(--sg-bg, #ffffff);
    padding: 0 4px;
    border-radius: 3px;
    font-size: 11.5px;
  }
  .ai-fill-summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .ai-summary p { margin: 0; line-height: 1.45; }
  .ai-bullets { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; font-size: 12px; }
  .ai-highlight { display: flex; flex-wrap: wrap; gap: 5px; font-size: 11.5px; color: var(--sg-muted, #64748b); align-items: center; }
  .ai-chip {
    display: inline-block;
    background: var(--sg-bg, #ffffff);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 999px;
    padding: 1px 8px;
    font-size: 11px;
    font-weight: 600;
  }

  .ai-error {
    background: #fee2e2;
    color: #b91c1c;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 12px;
  }
  :global([data-theme='dark']) .ai-error { background: rgba(239, 68, 68, 0.18); color: #f87171; }

  .ai-footer {
    padding: 8px 14px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f1f5f9);
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
  }
  .ai-footer code {
    background: var(--sg-bg, #ffffff);
    padding: 0 4px;
    border-radius: 3px;
  }

  /* Grid wrap */
  .ai-grid-wrap {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }

  /* Cell snippets - global because they live in cell scope */
  :global(.ai-tier-cell) { display: inline-flex; align-items: center; gap: 6px; }
  :global(.ai-tier) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 9px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  :global(.ai-tier-enterprise) { background: #f3e8ff; color: #6b21a8; }
  :global(.ai-tier-growth)     { background: #dbeafe; color: #1d4ed8; }
  :global(.ai-tier-starter)    { background: #e2e8f0; color: #475569; }
  :global([data-theme='dark'] .ai-tier-enterprise) { background: rgba(168,85,247,.2); color: #d8b4fe; }
  :global([data-theme='dark'] .ai-tier-growth)     { background: rgba(59,130,246,.2); color: #93c5fd; }
  :global([data-theme='dark'] .ai-tier-starter)    { background: rgba(148,163,184,.2); color: #cbd5e1; }
  :global(.ai-accept) {
    border: 0;
    background: rgba(34, 197, 94, 0.18);
    color: #166534;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 11px;
    line-height: 1;
    font-weight: 800;
  }
  :global([data-theme='dark'] .ai-accept) { color: #4ade80; }

  :global(.ai-sent) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  :global(.ai-sent-at-risk)   { background: #fee2e2; color: #b91c1c; }
  :global(.ai-sent-expanding) { background: #dcfce7; color: #166534; }
  :global(.ai-sent-steady)    { background: #e2e8f0; color: #475569; }
  :global([data-theme='dark'] .ai-sent-at-risk)   { background: rgba(239,68,68,.18); color: #f87171; }
  :global([data-theme='dark'] .ai-sent-expanding) { background: rgba(34,197,94,.18); color: #4ade80; }
  :global([data-theme='dark'] .ai-sent-steady)    { background: rgba(148,163,184,.2); color: #cbd5e1; }
  :global(.ai-pred-dot) {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: linear-gradient(135deg, #2563eb, #0ea5e9);
  }

  :global(.ai-notes) {
    display: inline-block;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
  :global(.ai-arr) { font-weight: 600; }
  :global(.ai-muted) { color: var(--sg-muted, #64748b); }
</style>
