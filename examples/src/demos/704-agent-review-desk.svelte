<script lang="ts">
  /**
   * 704. Agent review desk (app template)
   * -------------------------------------
   * A CRM agent cleans a customer table, and nothing it does lands until a
   * person says so. The agent works through the same tools a real model would
   * get from createGridTools:
   *
   *   grid_describe        what the table holds and what it may edit
   *   grid_query_rows      the rows, with their row ids
   *   grid_propose_edits   edits, each with a reason and a confidence
   *
   * Every step it takes shows in the strip under the header with the tool
   * call it made. Its edits arrive as proposals: the cell shows the proposed
   * value with the old one struck through, and the review panel groups them
   * by what they do, the risky groups first. Two of its region guesses are
   * wrong, and it says it is unsure of them.
   *
   * Accept or reject a group; one Ctrl+Z in the grid undoes it. Edit a cell
   * before accepting its proposal and your value stays. The Log tab lists
   * every decision (onDecision, where an app writes its audit trail). Revert
   * run proposes undoing what was accepted (revertSet); Copy for approver
   * puts the review on the clipboard as JSON for someone else to merge.
   *
   * The agent is a script standing in for a model, so the demo runs offline.
   *
   * Grid, buttons: @svgrid/grid. Change review, agent tools: @svgrid/enterprise.
   */
  import { onMount } from 'svelte'
  import { SvGrid, SvButton, renderSnippet, type GridColumns, type SvGridApi } from '@svgrid/grid'
  import {
    createReview,
    createGridTools,
    SvReviewPanel,
    type GridTool,
    type ReviewDecision,
  } from '@svgrid/enterprise/review'

  type Customer = {
    id: string
    company: string
    contact: string
    email: string
    phone: string
    country: string
    region: string
    segment: string
    arr: number
  }

  // ---- data -------------------------------------------------------------

  const NAMES = ['Acme Robotics', 'Bluefin Labs', 'Cobalt Freight', 'Driftwood Media', 'Ember Analytics', 'Fjord Outdoor',
    'Granite Health', 'Harbor Logistics', 'Ion Energy', 'Juniper Foods', 'Kestrel Air', 'Lumen Optics', 'Mosaic Retail',
    'Nimbus Cloud', 'Orchid Beauty', 'Pinecone Games', 'Quarry Steel', 'Radiant Solar', 'Saffron Spices', 'Tundra Gear',
    'Umbra Security', 'Vertex Bio', 'Willow Insurance', 'Xenon Motors', 'Yarrow Pharma', 'Zephyr Travel', 'Atlas Mapping',
    'Beacon Schools', 'Cypress Legal', 'Delta Dental', 'Echo Audio', 'Falcon Drones', 'Garnet Jewels', 'Helix Genomics',
    'Indigo Textiles', 'Jade Ceramics']
  const PEOPLE = ['maria lopez', 'wei zhang', 'aisha bello', 'tom fischer', 'emma dubois', 'liam walsh', 'sofia ricci',
    'noah park', 'yuki sato', 'omar nasser', 'lena berg', 'ravi iyer']
  const COUNTRIES = ['United States', 'usa', 'Germany', 'U.S.', 'Japan', 'US', 'United Kingdom', 'United States of America',
    'Brazil', 'France', 'U.S.A.', 'India']
  const US = new Set(['usa', 'U.S.', 'US', 'United States of America', 'U.S.A.'])
  const REGION: Record<string, string> = { 'United States': 'AMER', Brazil: 'AMER', Germany: 'EMEA', 'United Kingdom': 'EMEA', France: 'EMEA', Japan: 'APAC', India: 'APAC' }
  const titleCase = (s: string) => s.replace(/\b\p{Ll}/gu, (c) => c.toUpperCase())

  function seed(): Customer[] {
    return NAMES.map((name, i) => {
      const person = PEOPLE[i % PEOPLE.length]!
      const country = COUNTRIES[i % COUNTRIES.length]!
      const domain = name.split(' ')[0]!.toLowerCase()
      const [a, b, c] = [200 + ((i * 37) % 700), 100 + ((i * 53) % 800), 1000 + ((i * 271) % 9000)]
      const arr = (18 + ((i * 47) % 160)) * 1000
      return {
        id: `cus-${1001 + i}`,
        company: i % 4 === 0 ? `${name}  ` : i % 9 === 2 ? ` ${name}` : name,
        contact: i % 3 === 0 ? person.toUpperCase() : titleCase(person),
        email: i % 2 === 0 ? `${titleCase(person).replace(' ', '.')}@${titleCase(domain)}.COM` : `${person.replace(' ', '.')}@${domain}.com`,
        phone: i % 5 === 4 ? `${a}-${b}-${c}` : i % 3 === 1 ? `${a}.${b}.${c}` : `(${a}) ${b}-${c}`,
        country,
        region: i % 4 === 1 ? '' : REGION[US.has(country) ? 'United States' : country] ?? '',
        segment: '',
        // Seven accounts came over from the old billing system in cents.
        arr: i % 5 === 2 ? arr * 100 : arr,
      }
    })
  }

  let rows = $state(seed())
  let api = $state<SvGridApi<any, Customer> | null>(null)

  // ---- review -------------------------------------------------------------

  type LogEntry = { id: number; at: number; text: string; tone: 'accept' | 'reject' | 'undo' }
  let log = $state<LogEntry[]>([])
  let logSeq = 0
  const FIELD_LABEL: Record<string, string> = { company: 'Company', contact: 'Contact', email: 'Email', phone: 'Phone', country: 'Country', region: 'Region', segment: 'Segment', arr: 'ARR' }

  function describeDecision(d: ReviewDecision): LogEntry {
    const fields = [...new Set(d.proposals.map((p) => FIELD_LABEL[p.field] ?? p.field))].join(', ')
    const n = d.proposals.length
    const what = `${n} ${n === 1 ? 'change' : 'changes'} to ${fields}`
    const text =
      d.action === 'accept' ? `Accepted ${what}`
      : d.action === 'reject' ? `Rejected ${what}`
      : d.action === 'undo' ? `Undid the ${d.of} of ${what}`
      : `Redid the ${d.of} of ${what}`
    return { id: ++logSeq, at: d.at, text, tone: d.action === 'accept' || (d.action === 'redo' && d.of === 'accept') ? 'accept' : d.action === 'reject' ? 'reject' : 'undo' }
  }

  const review = createReview<Customer>({
    api: () => api,
    setRows: (next) => (rows = next),
    user: 'You',
    onDecision: (d) => (log = [describeDecision(d), ...log]),
  })

  const AGENT = { kind: 'agent' as const, id: 'crm-agent', label: 'CRM agent' }
  const tools = createGridTools({
    review,
    api: () => api,
    source: AGENT,
    fields: ['company', 'contact', 'email', 'phone', 'country', 'region', 'segment', 'arr'],
  })
  const tool = (name: string) => tools.find((t) => t.name === name) as GridTool

  // ---- the agent --------------------------------------------------------

  type Step = { id: number; title: string; call: string; result: string; state: 'running' | 'done' }
  let steps = $state<Step[]>([])
  const SHORT: Record<string, string> = {
    'Read the customer table': 'Read the table',
    'Trim stray spaces in company names': 'Trim spaces',
    'Put contact names in title case': 'Title-case names',
    'Lower-case email addresses': 'Lower-case emails',
    'Use one phone format': 'One phone format',
    'Map country spellings to one name': 'Map countries',
    'Fill missing regions': 'Fill regions',
    'Convert ARR booked in cents': 'ARR from cents',
    'Tag each account with a segment': 'Tag segments',
  }
  // The newest step stays in view as the strip grows.
  let stepsEl = $state<HTMLOListElement | null>(null)
  $effect(() => {
    void steps.length
    queueMicrotask(() => stepsEl?.scrollTo({ left: stepsEl.scrollWidth, behavior: 'smooth' }))
  })
  let agentState = $state<'idle' | 'running' | 'done'>('idle')
  let runToken = 0

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
  type Edit = { rowId: string; field: string; value: unknown; reason?: string; confidence?: number }

  async function step(title: string, call: string, work: () => Promise<string>, token: number) {
    if (token !== runToken) return false
    const s: Step = { id: steps.length + 1, title, call, result: '', state: 'running' }
    steps = [...steps, s]
    await sleep(650)
    if (token !== runToken) return false
    const result = await work()
    steps = steps.map((x) => (x.id === s.id ? { ...x, result, state: 'done' } : x))
    return true
  }

  async function propose(title: string, edits: Edit[]) {
    const out = (await tool('grid_propose_edits').execute({ title, edits })) as { proposed: number }
    return `${out.proposed} proposed`
  }

  async function runAgent() {
    const token = ++runToken
    steps = []
    agentState = 'running'
    let table: Customer[] = []
    const ok = await step('Read the customer table', 'grid_describe() · grid_query_rows()', async () => {
      const d = (await tool('grid_describe').execute({})) as { rowCount: number; columns: unknown[] }
      table = ((await tool('grid_query_rows').execute({})) as { rows: Array<Customer & { rowId: string }> }).rows.map((r) => ({ ...r, id: r.rowId }))
      return `${d.rowCount} rows, ${d.columns.length} columns`
    }, token)
    if (!ok) return
    const each = (fn: (r: Customer) => Edit | null) => table.map(fn).filter((e): e is Edit => e !== null)

    const plan: Array<[string, string, () => Edit[]]> = [
      ['Trim stray spaces in company names', 'company', () =>
        each((r) => (r.company !== r.company.trim() ? { rowId: r.id, field: 'company', value: r.company.trim() } : null))],
      ['Put contact names in title case', 'contact', () =>
        each((r) => (r.contact === r.contact.toUpperCase() ? { rowId: r.id, field: 'contact', value: titleCase(r.contact.toLowerCase()) } : null))],
      ['Lower-case email addresses', 'email', () =>
        each((r) => (r.email !== r.email.toLowerCase() ? { rowId: r.id, field: 'email', value: r.email.toLowerCase() } : null))],
      ['Use one phone format', 'phone', () =>
        each((r) => {
          const d = r.phone.replace(/\D/g, '')
          const v = `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
          return v !== r.phone ? { rowId: r.id, field: 'phone', value: v } : null
        })],
      ['Map country spellings to one name', 'country', () =>
        each((r) => (US.has(r.country) ? { rowId: r.id, field: 'country', value: 'United States', reason: `"${r.country}" is the United States` } : null))],
      ['Fill missing regions', 'region', () =>
        each((r) => {
          if (r.region) return null
          const country = US.has(r.country) ? 'United States' : r.country
          // Two guesses come from the company name, and the agent says so.
          if (r.id === 'cus-1006') return { rowId: r.id, field: 'region', value: 'APAC', confidence: 0.38, reason: 'guessed from the company name' }
          if (r.id === 'cus-1018') return { rowId: r.id, field: 'region', value: 'EMEA', confidence: 0.44, reason: 'guessed from the company name' }
          return { rowId: r.id, field: 'region', value: REGION[country], confidence: 0.94, reason: `from Country (${country})` }
        })],
      ['Convert ARR booked in cents', 'arr', () =>
        each((r) => (r.arr >= 1_000_000 ? { rowId: r.id, field: 'arr', value: r.arr / 100, reason: 'imported from billing in cents' } : null))],
      ['Tag each account with a segment', 'segment', () =>
        each((r) => {
          const arr = r.arr >= 1_000_000 ? r.arr / 100 : r.arr
          return { rowId: r.id, field: 'segment', value: arr >= 120_000 ? 'Enterprise' : arr >= 60_000 ? 'Mid-market' : 'SMB', confidence: 0.86, reason: 'from ARR bands' }
        })],
    ]
    for (const [title, field, build] of plan) {
      const edits = build()
      const done = await step(title, `grid_propose_edits(${edits.length} × ${field})`, () => propose(title, edits), token)
      if (!done) return
    }
    if (token === runToken) agentState = 'done'
  }

  function runAgain() {
    review.clear()
    rows = seed()
    log = []
    void runAgent()
  }

  // ---- after review -------------------------------------------------------

  let note = $state('')
  function revertRun() {
    let n = 0
    for (const s of review.sets()) {
      if (s.source.id !== AGENT.id) continue
      const set = review.revertSet(s.id)
      if (set) n += set.proposals.length
    }
    note = n ? `${n} reverts proposed: review them like any other change` : 'Nothing accepted to revert'
  }
  async function copyForApprover() {
    const json = JSON.stringify(review.toJSON())
    try {
      await navigator.clipboard.writeText(json)
      note = `Copied ${review.sets().length} sets (${Math.round(json.length / 1024)} KB of JSON) for an approver to merge`
    } catch {
      note = 'The browser blocked the clipboard'
    }
  }

  // ---- derived chrome -----------------------------------------------------

  const tally = $derived.by(() => {
    const t = { proposed: 0, pending: 0, accepted: 0, rejected: 0 }
    for (const p of review.proposals()) {
      t.proposed++
      if (p.status === 'pending' || p.status === 'conflict') t.pending++
      else if (p.status === 'accepted') t.accepted++
      else if (p.status === 'rejected' || p.status === 'stale') t.rejected++
    }
    return t
  })
  const status = $derived(
    agentState === 'running' ? { text: 'Agent working', tone: 'info' }
    : tally.pending ? { text: 'Waiting for review', tone: 'warning' }
    : tally.proposed ? { text: 'All reviewed', tone: 'success' }
    : { text: 'Idle', tone: 'muted' },
  )

  let side = $state<'review' | 'log'>('review')
  let narrow = $state(false)
  let view = $state<'grid' | 'side'>('grid')

  onMount(() => {
    const mq = window.matchMedia('(max-width: 860px)')
    const sync = () => (narrow = mq.matches)
    sync()
    mq.addEventListener('change', sync)
    const t = setTimeout(() => void runAgent(), 500)
    return () => {
      mq.removeEventListener('change', sync)
      clearTimeout(t)
      runToken++
    }
  })

  const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const SEGMENT_TONE: Record<string, string> = { Enterprise: '#7c3aed', 'Mid-market': '#0e7490', SMB: '#64748b' }
  const columns: GridColumns<Customer> = [
    { field: 'company', header: 'Company', width: 180, editable: true },
    { field: 'contact', header: 'Contact', width: 140, editable: true },
    { field: 'email', header: 'Email', width: 220, editable: true },
    { field: 'phone', header: 'Phone', width: 130, editable: true },
    { field: 'country', header: 'Country', width: 150, editable: true },
    { field: 'region', header: 'Region', width: 90, editable: true },
    { field: 'segment', header: 'Segment', width: 120, editable: true, cell: (ctx) => renderSnippet(segmentCell, { value: ctx.getValue() as string }) },
    { field: 'arr', header: 'ARR', width: 120, editable: true, editorType: 'number', format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
  ]
</script>

{#snippet segmentCell({ value }: { value: string })}
  {#if value}<span class="ard-seg" style:--seg={SEGMENT_TONE[value] ?? '#64748b'}>{value}</span>{/if}
{/snippet}

<div class="ard">
  <header class="ard-head">
    <div class="ard-title">
      <span class="ard-logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 6h16M4 12h10M4 18h7" /><path d="M16 16l2 2 4-4" /></svg>
      </span>
      <div>
        <h2>Customer master data</h2>
        <p>Northbeam CRM · cleanup by <strong>CRM agent</strong> · {rows.length} accounts</p>
      </div>
      <span class="ard-status is-{status.tone}"><span class="ard-dot" aria-hidden="true"></span>{status.text}</span>
    </div>
    <dl class="ard-stats">
      <div><dt>Proposed</dt><dd>{tally.proposed}</dd></div>
      <div><dt>Pending</dt><dd>{tally.pending}</dd></div>
      <div><dt>Accepted</dt><dd class="is-good">{tally.accepted}</dd></div>
      <div><dt>Rejected</dt><dd>{tally.rejected}</dd></div>
    </dl>
  </header>

  <div class="ard-agent" aria-live="polite">
    <ol class="ard-steps" bind:this={stepsEl}>
      {#each steps as s (s.id)}
        <li class="ard-step is-{s.state}" title="{s.title}: {s.call}">
          <span class="ard-step-icon" aria-hidden="true">
            {#if s.state === 'running'}<span class="ard-spin"></span>{:else}<svg viewBox="0 0 24 24" width="12" height="12"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{/if}
          </span>
          <span class="ard-step-text">
            <span class="ard-step-title">{SHORT[s.title] ?? s.title}</span>
            <code>{s.call}</code>
          </span>
          {#if s.result}<span class="ard-step-result">{s.result}</span>{/if}
        </li>
      {:else}
        <li class="ard-step is-idle">The agent starts in a moment…</li>
      {/each}
    </ol>
    <div class="ard-actions">
      <SvButton size="sm" variant="outline" disabled={agentState === 'running'} onclick={runAgain}>Run again</SvButton>
      <SvButton size="sm" variant="ghost" disabled={!tally.accepted} onclick={revertRun}>Revert run</SvButton>
      <SvButton size="sm" variant="ghost" disabled={!tally.proposed} onclick={copyForApprover}>Copy for approver</SvButton>
    </div>
  </div>
  {#if note}<p class="ard-note" role="status">{note}</p>{/if}

  {#if narrow}
    <div class="ard-tabs" role="tablist" aria-label="Show">
      <button type="button" role="tab" aria-selected={view === 'grid'} onclick={() => (view = 'grid')}>Table</button>
      <button type="button" role="tab" aria-selected={view === 'side'} onclick={() => (view = 'side')}>Review ({tally.pending})</button>
    </div>
  {/if}

  <div class="ard-body">
    <div class="ard-grid" class:ard-hidden={narrow && view !== 'grid'}>
      <SvGrid
        data={rows}
        columns={review.columns(columns)}
        getRowId={(r) => r.id}
        conditionalFormats={review.formats}
        editable
        rowHeight={34}
        initialColumnPinning={{ left: ['company'] }}
        containerHeight={narrow ? 300 : 430}
        onApiReady={(a) => (api = a)}
      />
    </div>
    <aside class="ard-side" class:ard-hidden={narrow && view !== 'side'}>
      <div class="ard-tabs" role="tablist" aria-label="Side panel">
        <button type="button" role="tab" aria-selected={side === 'review'} onclick={() => (side = 'review')}>Review</button>
        <button type="button" role="tab" aria-selected={side === 'log'} onclick={() => (side = 'log')}>{log.length ? `Log (${log.length})` : 'Log'}</button>
      </div>
      <div class="ard-side-body">
        {#if side === 'review'}
          <SvReviewPanel {review} title="The agent's changes" />
        {:else}
          <ol class="ard-log">
            {#each log as e (e.id)}
              <li class="is-{e.tone}">
                <span class="ard-log-dot" aria-hidden="true"></span>
                <span class="ard-log-text">{e.text}</span>
                <time>{time(e.at)}</time>
              </li>
            {:else}
              <li class="is-empty">Decisions show up here, newest first, with who made them: what an app writes to its audit trail from onDecision.</li>
            {/each}
          </ol>
        {/if}
      </div>
    </aside>
  </div>
</div>

<style>
  .ard {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 12px;
    overflow: hidden;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    font-family: var(--sg-font, inherit);
    font-size: 13px;
  }
  .ard-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    padding: 14px 18px;
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
  }
  .ard-title { display: flex; align-items: center; gap: 12px; min-width: 0; flex-wrap: wrap; }
  .ard-logo {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    flex: none;
    border-radius: 9px;
    background: var(--sg-fg, #0f172a);
    color: var(--sg-bg, #fff);
  }
  .ard-logo svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .ard-title h2 { margin: 0; font-size: 16px; font-weight: 650; letter-spacing: -0.01em; }
  .ard-title p { margin: 2px 0 0; font-size: 12px; color: var(--sg-muted, #64748b); }
  .ard-title strong { color: var(--sg-fg, #0f172a); font-weight: 600; }
  .ard-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 650;
    --tone: var(--sg-muted, #64748b);
    color: color-mix(in srgb, var(--tone) 80%, var(--sg-fg, #0f172a));
    background: color-mix(in srgb, var(--tone) 13%, transparent);
  }
  .ard-status.is-info { --tone: var(--sg-info, #0284c7); }
  .ard-status.is-warning { --tone: var(--sg-warning, #d97706); }
  .ard-status.is-success { --tone: var(--sg-success, #16a34a); }
  .ard-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--tone); }
  .ard-status.is-info .ard-dot { animation: ard-pulse 1.1s ease-in-out infinite; }
  @keyframes ard-pulse { 50% { opacity: 0.3; } }

  .ard-stats { display: flex; gap: 22px; margin: 0; }
  .ard-stats div { display: flex; flex-direction: column; align-items: flex-end; }
  .ard-stats dt { font-size: 11px; color: var(--sg-muted, #64748b); }
  .ard-stats dd { margin: 0; font-size: 18px; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
  .ard-stats dd.is-good { color: var(--sg-success, #16a34a); }

  .ard-agent {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 18px;
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
    background: var(--sg-bg-subtle, var(--sg-header-bg, #f8fafc));
  }
  .ard-steps {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 6px;
    margin: 0;
    padding: 2px 0;
    list-style: none;
    overflow-x: auto;
    scrollbar-width: thin;
  }
  .ard-step {
    display: flex;
    align-items: center;
    gap: 7px;
    flex: none;
    max-width: 260px;
    padding: 5px 10px 5px 7px;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 8px;
    background: var(--sg-bg, #fff);
    animation: ard-in 0.25s ease-out;
  }
  @keyframes ard-in { from { opacity: 0; transform: translateY(3px); } }
  .ard-step.is-idle { color: var(--sg-muted, #64748b); border-style: dashed; animation: none; }
  .ard-step-icon {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    flex: none;
    border-radius: 50%;
    color: var(--sg-bg, #fff);
    background: var(--sg-success, #16a34a);
  }
  .ard-step-icon svg { fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
  .ard-step.is-running .ard-step-icon { background: none; }
  .ard-spin {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--sg-info, #0284c7) 25%, transparent);
    border-top-color: var(--sg-info, #0284c7);
    animation: ard-rot 0.7s linear infinite;
  }
  @keyframes ard-rot { to { transform: rotate(360deg); } }
  .ard-step-text { display: flex; flex-direction: column; min-width: 0; }
  .ard-step-title { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ard-step code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ard-step-result { font-size: 11.5px; font-weight: 650; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .ard-actions { display: flex; gap: 6px; flex: none; }
  .ard-note { margin: 0; padding: 7px 18px; font-size: 12px; color: var(--sg-muted, #64748b); border-bottom: 1px solid var(--sg-border, #e5e7eb); }

  .ard-body { display: grid; grid-template-columns: minmax(0, 1fr) 360px; min-height: 0; }
  .ard-grid { min-width: 0; padding: 12px 0 12px 12px; }
  .ard-side { min-width: 0; display: flex; flex-direction: column; border-left: 1px solid var(--sg-border, #e5e7eb); margin-left: 12px; }
  .ard-side-body { max-height: 430px; overflow: auto; padding: 0 12px 12px; }
  .ard-side-body :global(.sv-review) { border: 0; padding: 0; }
  .ard-tabs { display: flex; gap: 2px; padding: 8px 12px 0; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .ard-tabs button {
    padding: 6px 10px;
    margin-bottom: -1px;
    font: inherit;
    font-size: 12.5px;
    font-weight: 550;
    color: var(--sg-muted, #64748b);
    background: none;
    border: 0;
    border-bottom: 2px solid transparent;
    cursor: pointer;
  }
  .ard-tabs button[aria-selected='true'] { color: var(--sg-fg, #0f172a); border-bottom-color: var(--sg-fg, #0f172a); }
  .ard-tabs button:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: -2px; }

  .ard-log { list-style: none; margin: 0; padding: 10px 0 0; display: flex; flex-direction: column; }
  .ard-log li { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; align-items: baseline; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .ard-log li.is-empty { display: block; color: var(--sg-muted, #64748b); border: 0; line-height: 1.5; }
  .ard-log-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--sg-muted, #94a3b8); transform: translateY(-1px); }
  .ard-log .is-accept .ard-log-dot { background: var(--sg-success, #16a34a); }
  .ard-log .is-reject .ard-log-dot { background: var(--sg-danger, #dc2626); }
  .ard-log time { font-size: 11px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }

  /* Data palette: segment pills carry their own colours. */
  .ard-seg {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--seg);
    background: color-mix(in srgb, var(--seg) 12%, transparent);
  }
  .ard-hidden { display: none; }

  @media (max-width: 860px) {
    .ard-head { padding: 12px 14px; gap: 10px; }
    .ard-logo { display: none; }
    .ard-stats { gap: 14px; }
    .ard-stats dd { font-size: 15px; }
    .ard-side-body { max-height: 340px; }
    .ard-agent { flex-direction: column; align-items: stretch; padding: 10px 14px; }
    .ard-body { grid-template-columns: minmax(0, 1fr); }
    .ard-grid { padding: 10px; }
    .ard-side { margin-left: 0; border-left: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ard-step, .ard-spin, .ard-status.is-info .ard-dot { animation: none; }
  }
</style>
