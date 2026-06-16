<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 48. CRM - sales pipeline / deal board
   * --------------------------------------
   * The view every sales VP opens first thing Monday morning. Each row
   * is a deal; every column makes a decision someone has to defend on
   * Friday's forecast call.
   *
   *   1. **Pipeline KPI strip.** Pipeline value, weighted value, win
   *      rate, average deal size, cycle time. Computed from the row
   *      set so filter/stage selection re-rolls the totals live.
   *
   *   2. **Stage funnel chips.** Click a stage chip to scope the grid
   *      to that bucket. Counts on each chip refresh as deals advance.
   *
   *   3. **Editable in place.** Owner, stage, probability and next
   *      step are inline-editable; the activity panel + KPIs reflect
   *      the new state on the next keystroke.
   *
   *   4. **Deal detail aside.** Click any row -> right-side card with
   *      contact, recent activity, MEDDIC-ish health signals, and
   *      "advance / mark won / mark lost" buttons that mutate the row.
   *
   *   5. **Forecast bar.** Per-stage weighted contribution rolled up
   *      against the quarter's quota, with a delta vs. plan.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  // ---- Domain ---------------------------------------------------------

  type Stage = 'qualify' | 'discover' | 'propose' | 'negotiate' | 'won' | 'lost'
  type Health = 'green' | 'yellow' | 'red'

  type Activity = { type: 'call' | 'email' | 'meeting' | 'note'; when: string; summary: string }

  type Deal = {
    id: string
    company: string
    contact: string
    role: string
    owner: string
    region: 'NA' | 'EMEA' | 'APAC' | 'LATAM'
    industry: string
    arr: number
    probability: number  // 0-100
    stage: Stage
    /** epoch ms */
    closeDate: number
    age: number   // days in current stage
    source: 'inbound' | 'outbound' | 'partner' | 'expansion'
    nextStep: string
    health: Health
    activity: Activity[]
  }

  // ---- Seed -----------------------------------------------------------

  const COMPANIES = [
    'Northwind Logistics', 'Helios Holdings', 'Vertex Trust', 'Pacific Industries',
    'Atlas Group', 'Stellar Networks', 'Quantum Bio', 'Apex Resources',
    'Crescent Labs', 'Polaris Systems', 'Aurora Materials', 'Sigma Capital',
    'Pioneer Mining', 'Granite Markets', 'Cobalt Engineering', 'Sentinel Health',
    'Tessera Energy', 'Vanguard Foods', 'Cascade Bio', 'Meridian Retail',
    'Aspen Insurance', 'Bluestone Travel', 'Foundry Construction', 'Halcyon Media',
    'Ironwood Defense', 'Juniper Telecom', 'Keystone Banking', 'Larkspur Pharma',
  ]
  const FIRSTS = ['Alex', 'Jamie', 'Casey', 'Drew', 'Robin', 'Morgan', 'Riley', 'Quinn', 'Avery', 'Reese']
  const LASTS = ['Park', 'Singh', 'Khan', 'Cohen', 'Nakamura', 'Silva', 'Diaz', 'Mehta', 'Olsen', 'Tran', 'Chen', 'Brooks']
  const TITLES = ['VP Operations', 'CIO', 'Head of IT', 'CFO', 'COO', 'VP Engineering', 'Procurement Lead', 'CTO', 'Director, Ops']
  const OWNERS = ['S. Park', 'J. Chen', 'R. Diaz', 'C. Singh', 'D. Olsen', 'M. Tran', 'A. Mehta']
  const REGIONS: readonly Deal['region'][] = ['NA', 'EMEA', 'APAC', 'LATAM']
  const INDUSTRIES = ['SaaS', 'Manufacturing', 'Logistics', 'Financial Services', 'Healthcare', 'Energy', 'Retail', 'Media']
  const SOURCES: readonly Deal['source'][] = ['inbound', 'outbound', 'partner', 'expansion']
  const STAGES: readonly Stage[] = ['qualify', 'discover', 'propose', 'negotiate', 'won', 'lost']

  const STAGE_INFO: Record<Stage, { label: string; position: number; defaultProb: number; tone: string }> = {
    qualify:   { label: 'Qualify',   position: 1, defaultProb: 10, tone: '#94a3b8' },
    discover:  { label: 'Discover',  position: 2, defaultProb: 30, tone: '#0ea5e9' },
    propose:   { label: 'Propose',   position: 3, defaultProb: 60, tone: '#6366f1' },
    negotiate: { label: 'Negotiate', position: 4, defaultProb: 80, tone: '#a855f7' },
    won:       { label: 'Won',       position: 5, defaultProb: 100, tone: '#16a34a' },
    lost:      { label: 'Lost',      position: 5, defaultProb: 0,  tone: '#dc2626' },
  }

  let prng = 0xC0DEC0DE >>> 0
  function rnd(): number {
    prng = (prng * 1664525 + 1013904223) >>> 0
    return prng / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }

  const TODAY = Date.now()

  function seedActivity(stage: Stage): Activity[] {
    const samples: Array<Activity> = [
      { type: 'call',    when: '2 days ago',  summary: 'Discovery call with procurement + ops lead. Pain confirmed.' },
      { type: 'email',   when: '5 days ago',  summary: 'Sent ROI brief and reference case study.' },
      { type: 'meeting', when: '8 days ago',  summary: 'Demo for ops team. 7 attendees, recording shared.' },
      { type: 'note',    when: '11 days ago', summary: 'Internal: legal flagged DPA review will take 2 weeks.' },
      { type: 'call',    when: '14 days ago', summary: 'Champion intro to CFO. Budget aligned to Q3.' },
    ]
    if (stage === 'qualify') return samples.slice(0, 1)
    if (stage === 'discover') return samples.slice(0, 2)
    if (stage === 'propose') return samples.slice(0, 3)
    return samples
  }

  function seedDeals(): Deal[] {
    const out: Deal[] = []
    for (let i = 0; i < COMPANIES.length; i += 1) {
      const stage = pick(STAGES)
      const ageBase = stage === 'qualify' ? 5 : stage === 'discover' ? 14 : stage === 'propose' ? 25 : stage === 'negotiate' ? 38 : 50
      const arr = Math.round((30_000 + rnd() * 470_000) / 1000) * 1000
      const closeOffsetDays = stage === 'won' || stage === 'lost'
        ? -Math.floor(rnd() * 30)
        : 14 + Math.floor(rnd() * 75)
      const healthRoll = rnd()
      const health: Health = stage === 'lost' ? 'red'
        : healthRoll < 0.55 ? 'green'
        : healthRoll < 0.85 ? 'yellow' : 'red'
      out.push({
        id: `D-${(i + 1001).toString()}`,
        company: COMPANIES[i]!,
        contact: `${pick(FIRSTS)} ${pick(LASTS)}`,
        role: pick(TITLES),
        owner: pick(OWNERS),
        region: pick(REGIONS),
        industry: pick(INDUSTRIES),
        arr,
        probability: STAGE_INFO[stage].defaultProb + Math.floor(rnd() * 11) - 5,
        stage,
        closeDate: TODAY + closeOffsetDays * 86_400_000,
        age: ageBase + Math.floor(rnd() * 12),
        source: pick(SOURCES),
        nextStep:
          stage === 'qualify' ? 'Schedule discovery call' :
          stage === 'discover' ? 'Send tailored ROI brief' :
          stage === 'propose' ? 'Walk through pricing' :
          stage === 'negotiate' ? 'Resolve legal redlines' :
          stage === 'won' ? 'Kickoff onboarding' :
          'Loss debrief',
        health,
        activity: seedActivity(stage),
      })
    }
    return out
  }

  // ---- Reactive state -------------------------------------------------

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let deals = $state<Deal[]>(seedDeals())
  let stageFilter = $state<Stage | 'open' | 'all'>('open')
  let search = $state('')
  // svelte-ignore state_referenced_locally
  let selectedId = $state<string | null>(deals[0]?.id ?? null)

  /** The quarter's quota the team is supposed to land. Drives the
   *  forecast bar at the top. */
  const QUOTA = 2_500_000

  const filteredDeals = $derived.by(() => {
    const q = search.trim().toLowerCase()
    return deals.filter((d) => {
      if (stageFilter === 'open' && (d.stage === 'won' || d.stage === 'lost')) return false
      if (stageFilter !== 'open' && stageFilter !== 'all' && d.stage !== stageFilter) return false
      if (!q) return true
      return (
        d.company.toLowerCase().includes(q) ||
        d.contact.toLowerCase().includes(q) ||
        d.owner.toLowerCase().includes(q) ||
        d.industry.toLowerCase().includes(q)
      )
    })
  })

  const stageCounts = $derived.by(() => {
    const out: Record<Stage, number> = { qualify: 0, discover: 0, propose: 0, negotiate: 0, won: 0, lost: 0 }
    for (const d of deals) out[d.stage] += 1
    return out
  })

  const kpis = $derived.by(() => {
    const open = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost')
    const wonDeals = deals.filter((d) => d.stage === 'won')
    const lostDeals = deals.filter((d) => d.stage === 'lost')
    const closed = wonDeals.length + lostDeals.length
    const pipeline = open.reduce((s, d) => s + d.arr, 0)
    const weighted = open.reduce((s, d) => s + d.arr * (d.probability / 100), 0) + wonDeals.reduce((s, d) => s + d.arr, 0)
    const winRate = closed === 0 ? 0 : Math.round((wonDeals.length / closed) * 100)
    const avgDeal = deals.length ? Math.round(deals.reduce((s, d) => s + d.arr, 0) / deals.length) : 0
    const closedAges = [...wonDeals, ...lostDeals].map((d) => d.age)
    const avgCycle = closedAges.length ? Math.round(closedAges.reduce((s, a) => s + a, 0) / closedAges.length) : 0
    const wonValue = wonDeals.reduce((s, d) => s + d.arr, 0)
    return { pipeline, weighted, winRate, avgDeal, avgCycle, wonValue }
  })

  // Per-stage weighted contribution (for the forecast bar)
  const forecastStripe = $derived.by(() => {
    const stripe: Array<{ stage: Stage; amount: number }> = []
    for (const s of STAGES) {
      const sum = deals
        .filter((d) => d.stage === s)
        .reduce((acc, d) => acc + d.arr * (d.probability / 100), 0)
      if (sum > 0) stripe.push({ stage: s, amount: sum })
    }
    return stripe
  })

  const selectedDeal = $derived(deals.find((d) => d.id === selectedId) ?? null)

  // ---- Mutations ------------------------------------------------------

  function updateDeal(id: string, patch: Partial<Deal>): void {
    deals = deals.map((d) => (d.id === id ? { ...d, ...patch } : d))
  }

  function advanceStage(id: string): void {
    const d = deals.find((x) => x.id === id)
    if (!d) return
    const order: Stage[] = ['qualify', 'discover', 'propose', 'negotiate', 'won']
    const ix = order.indexOf(d.stage)
    if (ix < 0 || ix >= order.length - 1) return
    const next = order[ix + 1]!
    updateDeal(id, { stage: next, probability: STAGE_INFO[next].defaultProb, age: 0 })
  }
  function markWon(id: string): void { updateDeal(id, { stage: 'won', probability: 100, age: 0 }) }
  function markLost(id: string): void { updateDeal(id, { stage: 'lost', probability: 0, age: 0 }) }

  // ---- Formatters -----------------------------------------------------

  function fmtMoney(n: number): string {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }
  function fmtMoneyShort(n: number): string {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`
    return `$${n}`
  }
  function fmtDate(ts: number): string {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  function daysToClose(ts: number): string {
    const days = Math.round((ts - TODAY) / 86_400_000)
    if (days === 0) return 'today'
    if (days > 0) return `in ${days}d`
    return `${-days}d late`
  }

  const STAGE_OPTIONS = STAGES.map((s) => ({ value: s, label: STAGE_INFO[s].label }))
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet CompanyCell(props: { row: Deal })}
  <span class="crm-co">
    <span class="crm-co-icon" style={`background:${STAGE_INFO[props.row.stage].tone}22; color:${STAGE_INFO[props.row.stage].tone}`}>
      {props.row.company.charAt(0)}
    </span>
    <span class="crm-co-text">
      <span class="crm-co-name">{props.row.company}</span>
      <span class="crm-co-sub">{props.row.contact} - {props.row.role}</span>
    </span>
  </span>
{/snippet}

{#snippet StageCell(props: { row: Deal })}
  {@const info = STAGE_INFO[props.row.stage]}
  <span class="crm-stage">
    <span class={`crm-stage-pill crm-stage-${props.row.stage}`}>{info.label}</span>
    <span class="crm-stage-track">
      {#each [1, 2, 3, 4, 5] as i (i)}
        <span class={`crm-stage-step ${info.position >= i ? 'crm-stage-step-on' : ''} ${props.row.stage === 'lost' ? 'crm-stage-step-lost' : ''}`}></span>
      {/each}
    </span>
  </span>
{/snippet}

{#snippet ProbCell(props: { row: Deal })}
  <span class="crm-prob">
    <span class="crm-prob-bar">
      <span class="crm-prob-fill" style={`width: ${props.row.probability}%; background:${STAGE_INFO[props.row.stage].tone}`}></span>
    </span>
    <span class="tabular-nums">{props.row.probability}%</span>
  </span>
{/snippet}

{#snippet ArrCell(props: { row: Deal })}
  <span class="crm-arr">
    <span class="crm-arr-amt tabular-nums">{fmtMoney(props.row.arr)}</span>
    <span class="crm-arr-w tabular-nums">w. {fmtMoneyShort(props.row.arr * props.row.probability / 100)}</span>
  </span>
{/snippet}

{#snippet CloseCell(props: { row: Deal })}
  {@const days = Math.round((props.row.closeDate - TODAY) / 86_400_000)}
  {@const late = days < 0 && props.row.stage !== 'won' && props.row.stage !== 'lost'}
  <span class={`crm-close ${late ? 'crm-close-late' : ''}`}>
    <span class="tabular-nums">{fmtDate(props.row.closeDate)}</span>
    <span class="crm-close-sub tabular-nums">{daysToClose(props.row.closeDate)}</span>
  </span>
{/snippet}

{#snippet HealthCell(props: { row: Deal })}
  <span class={`crm-health crm-health-${props.row.health}`}>
    <span class="crm-health-dot"></span>
    <span class="crm-health-age tabular-nums">{props.row.age}d</span>
  </span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="crm-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="crm-kpi-strip">
    <div class="crm-kpi">
      <div class="crm-kpi-label">Open pipeline</div>
      <div class="crm-kpi-value tabular-nums">{fmtMoneyShort(kpis.pipeline)}</div>
      <div class="crm-kpi-foot">{stageCounts.qualify + stageCounts.discover + stageCounts.propose + stageCounts.negotiate} live deals</div>
    </div>
    <div class="crm-kpi">
      <div class="crm-kpi-label">Weighted</div>
      <div class="crm-kpi-value tabular-nums">{fmtMoneyShort(kpis.weighted)}</div>
      <div class="crm-kpi-foot">incl. {fmtMoneyShort(kpis.wonValue)} already won</div>
    </div>
    <div class="crm-kpi">
      <div class="crm-kpi-label">Win rate</div>
      <div class={`crm-kpi-value tabular-nums ${kpis.winRate >= 40 ? 'crm-up' : kpis.winRate <= 25 ? 'crm-down' : ''}`}>{kpis.winRate}%</div>
      <div class="crm-kpi-foot">{stageCounts.won} won / {stageCounts.lost} lost YTD</div>
    </div>
    <div class="crm-kpi">
      <div class="crm-kpi-label">Avg deal size</div>
      <div class="crm-kpi-value tabular-nums">{fmtMoneyShort(kpis.avgDeal)}</div>
      <div class="crm-kpi-foot">across {deals.length} opportunities</div>
    </div>
    <div class="crm-kpi">
      <div class="crm-kpi-label">Avg cycle</div>
      <div class="crm-kpi-value tabular-nums">{kpis.avgCycle}d</div>
      <div class="crm-kpi-foot">quote-to-close on closed deals</div>
    </div>
  </div>

  <!-- Forecast bar -->
  <div class="crm-forecast">
    <div class="crm-forecast-head">
      <span class="crm-forecast-title">Q forecast vs quota</span>
      <span class="crm-forecast-amounts tabular-nums">
        <strong>{fmtMoneyShort(kpis.weighted)}</strong> /
        <span class="crm-muted">{fmtMoneyShort(QUOTA)}</span>
        <span class={`crm-forecast-delta ${kpis.weighted >= QUOTA ? 'crm-up' : 'crm-down'}`}>
          {kpis.weighted >= QUOTA ? '+' : ''}{fmtMoneyShort(kpis.weighted - QUOTA)}
        </span>
      </span>
    </div>
    <div class="crm-forecast-bar">
      {#each forecastStripe as seg (seg.stage)}
        <span
          class={`crm-forecast-seg crm-stage-${seg.stage}`}
          style={`flex: ${seg.amount} 0 0; background: ${STAGE_INFO[seg.stage].tone};`}
          title={`${STAGE_INFO[seg.stage].label}: ${fmtMoney(seg.amount)}`}
        ></span>
      {/each}
      <span class="crm-forecast-quota" style={`left: ${Math.min(100, Math.max(0, (QUOTA / Math.max(kpis.weighted, QUOTA)) * 100))}%`} title="Quota line"></span>
    </div>
  </div>

  <!-- Stage chips + search -->
  <div class="crm-toolbar">
    <div class="crm-chips">
      <button type="button" class={`crm-chip ${stageFilter === 'open' ? 'crm-chip-active' : ''}`} onclick={() => (stageFilter = 'open')}>
        Open <span class="crm-chip-n tabular-nums">{stageCounts.qualify + stageCounts.discover + stageCounts.propose + stageCounts.negotiate}</span>
      </button>
      {#each STAGES as s (s)}
        <button type="button" class={`crm-chip crm-chip-${s} ${stageFilter === s ? 'crm-chip-active' : ''}`} onclick={() => (stageFilter = s)}>
          {STAGE_INFO[s].label} <span class="crm-chip-n tabular-nums">{stageCounts[s]}</span>
        </button>
      {/each}
      <button type="button" class={`crm-chip ${stageFilter === 'all' ? 'crm-chip-active' : ''}`} onclick={() => (stageFilter = 'all')}>
        All <span class="crm-chip-n tabular-nums">{deals.length}</span>
      </button>
    </div>
    <input
      type="search"
      class="crm-search"
      placeholder="Search company, contact, owner..."
      bind:value={search}
    />
  </div>

  <!-- Body: grid + detail -->
  <div class="crm-body flex flex-1 min-h-0 gap-3">
    <div class="crm-master flex-1 min-w-0">
      <SvGrid
        data={filteredDeals}
        columns={[
          { field: 'company', header: 'Account', width: 240, editable: false,
            cell: (ctx) => renderSnippet(CompanyCell, { row: ctx.row.original }) },
          { field: 'stage', header: 'Stage', editorType: 'list', width: 170,
            editorOptions: STAGE_OPTIONS,
            cell: (ctx) => renderSnippet(StageCell, { row: ctx.row.original }) },
          { field: 'probability', header: 'Prob.', editorType: 'number', width: 130,
            cell: (ctx) => renderSnippet(ProbCell, { row: ctx.row.original }) },
          { field: 'arr', header: 'ARR', editorType: 'number', width: 150, editable: false,
            cell: (ctx) => renderSnippet(ArrCell, { row: ctx.row.original }) },
          { field: 'owner', header: 'Owner', width: 100, editorType: 'list',
            editorOptions: OWNERS },
          { field: 'closeDate', header: 'Close', width: 130, editable: false,
            cell: (ctx) => renderSnippet(CloseCell, { row: ctx.row.original }) },
          { field: 'age', header: 'Health / Age', width: 120, editable: false,
            cell: (ctx) => renderSnippet(HealthCell, { row: ctx.row.original }) },
          { field: 'industry', header: 'Industry', width: 130 },
          { field: 'region', header: 'Region', width: 90, editorType: 'list',
            editorOptions: REGIONS as unknown as string[] },
          { field: 'nextStep', header: 'Next step', width: 240 },
        ] satisfies ColumnDef<typeof features, Deal>[]}
        features={features}
        filterMode="menu"
        selectionMode="row"
        showRowSelection={false}
        showPagination={false}
        enableInlineEditing={true}
        enableCellSelection={false}
        enableRowSummaries={false}
        rowHeight={50}
        containerHeight="100%"
        fitColumns={true}
        onCellValueChange={(args) => {
          // Auto-bump probability when the user re-stages the deal so
          // the forecast bar stays believable.
          if (args.columnId === 'stage') {
            const nextStage = args.newValue as Stage
            updateDeal(args.row.id, { stage: nextStage, probability: STAGE_INFO[nextStage].defaultProb })
          }
        }}
        onActiveCellChange={(args) => {
          const row = filteredDeals[args.rowIndex]
          if (row && row.id !== selectedId) selectedId = row.id
        }}
      />
    </div>

    <!-- Detail card -->
    <aside class="crm-detail">
      {#if !selectedDeal}
        <div class="crm-empty">Click a deal to inspect its activity history.</div>
      {:else}
        {@const d = selectedDeal}
        <header class="crm-detail-head">
          <div class="crm-detail-id">
            <span class={`crm-stage-pill crm-stage-${d.stage}`}>{STAGE_INFO[d.stage].label}</span>
            <span class={`crm-health crm-health-${d.health}`}><span class="crm-health-dot"></span></span>
            <span class="crm-detail-source">{d.source}</span>
          </div>
          <div class="crm-detail-title">{d.company}</div>
          <div class="crm-detail-sub">{d.id} - {d.contact} ({d.role})</div>
          <div class="crm-detail-amounts tabular-nums">
            <span class="crm-detail-arr">{fmtMoney(d.arr)}</span>
            <span class="crm-detail-w">weighted {fmtMoneyShort(d.arr * d.probability / 100)}</span>
          </div>
        </header>

        <div class="crm-detail-grid">
          <div class="crm-detail-kv"><span>Owner</span><strong>{d.owner}</strong></div>
          <div class="crm-detail-kv"><span>Region</span><strong>{d.region}</strong></div>
          <div class="crm-detail-kv"><span>Industry</span><strong>{d.industry}</strong></div>
          <div class="crm-detail-kv"><span>Close</span><strong>{fmtDate(d.closeDate)}</strong></div>
        </div>

        <div class="crm-section-title">Next step</div>
        <div class="crm-next-step">{d.nextStep}</div>

        <div class="crm-section-title">Recent activity</div>
        <ul class="crm-activity">
          {#each d.activity as a, i (i)}
            <li class={`crm-act crm-act-${a.type}`}>
              <span class="crm-act-icon">
                {a.type === 'call' ? '📞' : a.type === 'email' ? '✉' : a.type === 'meeting' ? '👥' : '📝'}
              </span>
              <div class="crm-act-body">
                <div class="crm-act-when">{a.when}</div>
                <div class="crm-act-summary">{a.summary}</div>
              </div>
            </li>
          {:else}
            <li class="crm-act-empty">No recorded touches yet.</li>
          {/each}
        </ul>

        <footer class="crm-detail-actions">
          <button type="button" class="crm-btn" onclick={() => markLost(d.id)} disabled={d.stage === 'lost' || d.stage === 'won'}>Mark lost</button>
          <button type="button" class="crm-btn" onclick={() => advanceStage(d.id)} disabled={d.stage === 'won' || d.stage === 'lost' || d.stage === 'negotiate'}>Advance stage</button>
          <button type="button" class="crm-btn crm-btn-primary" onclick={() => markWon(d.id)} disabled={d.stage === 'won' || d.stage === 'lost'}>Mark won</button>
        </footer>
      {/if}
    </aside>
  </div>
</section>

<style>
  /* KPI strip */
  .crm-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    flex-shrink: 0;
  }
  .crm-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .crm-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 6px;
  }
  .crm-kpi-value { font-size: 22px; font-weight: 700; line-height: 1.1; }
  .crm-kpi-foot { margin-top: 6px; font-size: 11px; color: var(--sg-muted, #64748b); }
  .crm-up { color: #16a34a; }
  .crm-down { color: #dc2626; }
  :global([data-theme='dark']) .crm-up { color: #4ade80; }
  :global([data-theme='dark']) .crm-down { color: #f87171; }
  .crm-muted { color: var(--sg-muted, #64748b); }

  /* Forecast bar */
  .crm-forecast {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 10px 14px;
    flex-shrink: 0;
  }
  .crm-forecast-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .crm-forecast-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
  }
  .crm-forecast-amounts { font-size: 13px; }
  .crm-forecast-delta { margin-left: 8px; font-size: 12px; }
  .crm-forecast-bar {
    position: relative;
    display: flex;
    height: 14px;
    border-radius: 7px;
    overflow: hidden;
    background: var(--sg-input-bg, #e2e8f0);
  }
  :global([data-theme='dark']) .crm-forecast-bar { background: rgba(148,163,184,0.18); }
  .crm-forecast-seg { display: block; height: 100%; }
  .crm-forecast-quota {
    position: absolute;
    top: -2px; bottom: -2px;
    border-left: 2px dashed var(--sg-fg, #1e293b);
    width: 0;
  }

  /* Toolbar */
  .crm-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .crm-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .crm-chip {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 999px;
    padding: 4px 10px 4px 12px;
    font-size: 12px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .crm-chip:hover { background: var(--sg-header-bg, #f1f5f9); }
  .crm-chip-active {
    background: var(--sg-accent, #2563eb);
    border-color: transparent;
    color: #fff;
  }
  .crm-chip-n {
    font-size: 11px;
    background: rgba(15, 23, 42, 0.08);
    padding: 1px 7px;
    border-radius: 999px;
  }
  .crm-chip-active .crm-chip-n { background: rgba(255, 255, 255, 0.22); }
  .crm-search {
    flex: 1 1 200px;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12.5px;
    min-width: 200px;
    max-width: 320px;
  }

  /* Body */
  .crm-body { min-height: 0; }
  .crm-master {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }

  /* Company cell */
  :global(.crm-co) { display: inline-flex; align-items: center; gap: 10px; }
  :global(.crm-co-icon) {
    width: 30px; height: 30px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
    flex-shrink: 0;
  }
  :global(.crm-co-text) { display: inline-flex; flex-direction: column; line-height: 1.2; min-width: 0; }
  :global(.crm-co-name) { font-weight: 600; }
  :global(.crm-co-sub) {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Stage cell */
  :global(.crm-stage) { display: inline-flex; flex-direction: column; gap: 4px; }
  :global(.crm-stage-pill) {
    display: inline-block;
    padding: 1px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    width: fit-content;
  }
  :global(.crm-stage-qualify)   { background: #e2e8f0; color: #475569; }
  :global(.crm-stage-discover)  { background: #dbeafe; color: #1d4ed8; }
  :global(.crm-stage-propose)   { background: #e0e7ff; color: #4338ca; }
  :global(.crm-stage-negotiate) { background: #f3e8ff; color: #6b21a8; }
  :global(.crm-stage-won)       { background: #dcfce7; color: #166534; }
  :global(.crm-stage-lost)      { background: #fee2e2; color: #b91c1c; }
  :global([data-theme='dark'] .crm-stage-qualify)   { background: rgba(148,163,184,.2); color: #cbd5e1; }
  :global([data-theme='dark'] .crm-stage-discover)  { background: rgba(59,130,246,.2); color: #93c5fd; }
  :global([data-theme='dark'] .crm-stage-propose)   { background: rgba(99,102,241,.22); color: #a5b4fc; }
  :global([data-theme='dark'] .crm-stage-negotiate) { background: rgba(168,85,247,.22); color: #d8b4fe; }
  :global([data-theme='dark'] .crm-stage-won)       { background: rgba(34,197,94,.2); color: #4ade80; }
  :global([data-theme='dark'] .crm-stage-lost)      { background: rgba(239,68,68,.22); color: #f87171; }

  :global(.crm-stage-track) { display: inline-flex; gap: 3px; }
  :global(.crm-stage-step) {
    width: 14px; height: 4px;
    border-radius: 2px;
    background: var(--sg-input-bg, #e2e8f0);
  }
  :global([data-theme='dark'] .crm-stage-step) { background: rgba(148,163,184,0.25); }
  :global(.crm-stage-step-on) { background: #16a34a; }
  :global(.crm-stage-step-lost) { background: #dc2626; }
  :global(.crm-stage-step-lost.crm-stage-step-on) { background: #dc2626; }

  /* Probability cell */
  :global(.crm-prob) { display: inline-flex; align-items: center; gap: 6px; width: 100%; }
  :global(.crm-prob-bar) {
    flex: 1 1 0;
    height: 6px;
    background: var(--sg-input-bg, #e2e8f0);
    border-radius: 999px;
    overflow: hidden;
  }
  :global([data-theme='dark'] .crm-prob-bar) { background: rgba(148,163,184,0.22); }
  :global(.crm-prob-fill) { display: block; height: 100%; border-radius: 999px; transition: width 200ms ease; }

  /* ARR cell */
  :global(.crm-arr) { display: inline-flex; flex-direction: column; line-height: 1.2; }
  :global(.crm-arr-amt) { font-weight: 700; font-variant-numeric: tabular-nums; }
  :global(.crm-arr-w) { font-size: 11px; color: var(--sg-muted, #64748b); }

  /* Close cell */
  :global(.crm-close) { display: inline-flex; flex-direction: column; line-height: 1.2; }
  :global(.crm-close-sub) { font-size: 11px; color: var(--sg-muted, #64748b); }
  :global(.crm-close-late .crm-close-sub) { color: #dc2626; font-weight: 600; }
  :global([data-theme='dark'] .crm-close-late .crm-close-sub) { color: #f87171; }

  /* Health cell */
  :global(.crm-health) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-variant-numeric: tabular-nums;
  }
  :global(.crm-health-dot) {
    width: 9px; height: 9px;
    border-radius: 50%;
    background: #94a3b8;
    box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.18);
  }
  :global(.crm-health-green .crm-health-dot)  { background: #16a34a; box-shadow: 0 0 0 3px rgba(34,197,94,.18); }
  :global(.crm-health-yellow .crm-health-dot) { background: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,.20); }
  :global(.crm-health-red .crm-health-dot)    { background: #dc2626; box-shadow: 0 0 0 3px rgba(239,68,68,.20); }
  :global(.crm-health-age) { font-size: 11px; color: var(--sg-muted, #64748b); }

  /* Detail panel */
  .crm-detail {
    width: 360px;
    flex-shrink: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    display: flex;
    flex-direction: column;
    overflow: auto;
  }
  .crm-empty {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    font-style: italic;
    color: var(--sg-muted, #64748b);
    text-align: center;
  }
  .crm-detail-head {
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .crm-detail-id {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .crm-detail-source {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
  }
  .crm-detail-title { font-size: 17px; font-weight: 700; line-height: 1.2; }
  .crm-detail-sub { font-size: 11.5px; color: var(--sg-muted, #64748b); margin-top: 2px; }
  .crm-detail-amounts { margin-top: 8px; display: flex; gap: 10px; align-items: baseline; }
  .crm-detail-arr { font-size: 18px; font-weight: 700; }
  .crm-detail-w { font-size: 11px; color: var(--sg-muted, #64748b); }
  .crm-detail-grid {
    padding: 12px 16px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .crm-detail-kv {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .crm-detail-kv span {
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .crm-detail-kv strong { font-size: 12.5px; font-weight: 600; }
  .crm-section-title {
    padding: 12px 16px 4px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
  }
  .crm-next-step {
    padding: 0 16px 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--sg-fg, #1e293b);
  }
  .crm-activity {
    list-style: none;
    padding: 4px 16px 12px;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .crm-act {
    display: flex;
    gap: 10px;
    padding: 6px 8px;
    border-radius: 6px;
    background: var(--sg-header-bg, #f1f5f9);
  }
  .crm-act-icon { font-size: 14px; }
  .crm-act-body { display: flex; flex-direction: column; line-height: 1.2; }
  .crm-act-when {
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .crm-act-summary { font-size: 12.5px; }
  .crm-act-empty {
    padding: 8px 0;
    font-size: 12px;
    color: var(--sg-muted, #64748b);
    font-style: italic;
  }
  .crm-detail-actions {
    margin-top: auto;
    padding: 12px 16px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    display: flex;
    gap: 6px;
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  .crm-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 12px;
    cursor: pointer;
  }
  .crm-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .crm-btn:not(:disabled):hover { background: var(--sg-header-bg, #f1f5f9); }
  .crm-btn-primary {
    border-color: transparent;
    background: var(--sg-accent, #2563eb);
    color: #fff;
  }
</style>
