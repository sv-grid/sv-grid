<script lang="ts">
  /**
   * 171. Persistent grid state - CRM contacts
   * ------------------------------------------
   * Built on the existing `createNamedViews` + `localStorageViews`
   * surface, plus `attachAutoSavedView`: a single reserved slot
   * captures whatever the user just did to the grid (sort / filter /
   * hide / resize / reorder columns) and restores it on next load.
   *
   * To make the persistence meaningful, this is a CRM-style contacts
   * grid with 10+ columns: pipeline stages, deal sizes, owners, last-
   * contact dates and tags. Hide the columns you don't care about,
   * sort by pipeline value, reorder the layout - reload the page,
   * everything is right where you left it.
   */
  import { onDestroy } from 'svelte'
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    renderSnippet,
    createNamedViews,
    localStorageViews,
    attachAutoSavedView,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Stage = 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost'
  type Tier = 'Strategic' | 'Enterprise' | 'Mid-market' | 'SMB'

  type Row = {
    id: number
    name: string
    company: string
    title: string
    email: string
    phone: string
    stage: Stage
    tier: Tier
    dealValue: number
    closeProbability: number
    lastContact: string
    nextAction: string
    owner: string
    region: string
    tags: string
  }

  const NAMES = [
    'Sarah Chen', 'Marcus Rodriguez', 'Priya Patel', 'James Williams', 'Yuki Tanaka',
    'Olivia Schmidt', 'Carlos Mendoza', 'Aisha Okonkwo', 'David Park', 'Elena Volkov',
    'Mohammed Al-Rashid', 'Sofia Rossi', 'Liam Murphy', 'Hannah Cohen', 'Ravi Sharma',
    'Isabella Martinez', 'Thomas Klein', 'Mei Lin', 'Alexander Petrov', 'Grace Adebayo',
    'Noah Goldberg', 'Camille Dubois', 'Hiroshi Yamamoto', 'Zara Hussain', 'Ethan Walker',
  ]
  const COMPANIES = [
    'Northwind Industries', 'Acme Robotics', 'Vanguard Materials', 'Helios Sensors',
    'Pacific Components', 'Cascade Robotics', 'Polaris Precision', 'Atlas Aerospace',
    'Meridian Logistics', 'Stratus Analytics', 'Cobalt Energy', 'Apex Pharma',
    'Lumen Networks', 'Quantum Bio', 'Beacon Health', 'Synergy Capital', 'Citadel Defense',
    'Tessera Software', 'Helix Genetics', 'Borealis Mining', 'Ironclad Security',
    'Lighthouse Media', 'Continuum AI', 'Foundry Materials', 'Westwind Manufacturing',
  ]
  const TITLES = [
    'VP Engineering', 'Director of IT', 'CTO', 'Head of Procurement',
    'Operations Manager', 'Senior Buyer', 'Plant Manager', 'CIO',
    'Director of R&D', 'Engineering Lead', 'CFO', 'Director of Operations',
  ]
  const STAGES: Stage[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']
  const TIERS: Tier[]   = ['Strategic', 'Enterprise', 'Mid-market', 'SMB']
  const OWNERS = ['B. Markov', 'A. Lindberg', 'D. Watanabe', 'R. Greene', 'C. Okafor', 'S. Reyes']
  const REGIONS = ['Americas', 'EMEA', 'APAC']
  const TAGS_POOL = [
    ['Strategic', 'Renewal'],
    ['Net-new', 'Inbound'],
    ['Expansion', 'Multi-year'],
    ['At risk', 'Renewal'],
    ['Pilot', 'POC'],
    ['Champion identified'],
    ['Stalled', 'Re-engage'],
    ['Hot lead'],
    ['Compliance review'],
    ['Custom contract'],
  ]
  const ACTIONS = [
    'Send proposal', 'Demo scheduled', 'Awaiting signature', 'Pricing review',
    'Technical evaluation', 'Procurement intro', 'Reference call', 'Renewal Q4',
    'Follow-up email', 'Contract redlines',
  ]

  function rng(seed: number) {
    let s = seed >>> 0
    return () => {
      s = (s * 1_103_515_245 + 12_345) >>> 0
      return s / 0xffffffff
    }
  }
  const r = rng(20260622)
  const rows: Row[] = Array.from({ length: 60 }, (_, i) => {
    const nameIdx = Math.floor(r() * NAMES.length)
    const name = NAMES[nameIdx]!
    const first = name.split(' ')[0]!.toLowerCase()
    const last = name.split(' ')[1]!.toLowerCase()
    const company = COMPANIES[Math.floor(r() * COMPANIES.length)]!
    const stage = STAGES[Math.floor(r() * STAGES.length)]!
    const tier = TIERS[Math.floor(r() * TIERS.length)]!
    const baseValue =
      tier === 'Strategic' ? 220_000 : tier === 'Enterprise' ? 95_000 : tier === 'Mid-market' ? 32_000 : 9_500
    const prob =
      stage === 'Closed Won'  ? 1.0 :
      stage === 'Closed Lost' ? 0.0 :
      stage === 'Negotiation' ? 0.7 + r() * 0.2 :
      stage === 'Proposal'    ? 0.45 + r() * 0.2 :
      stage === 'Qualified'   ? 0.25 + r() * 0.15 :
                                 0.05 + r() * 0.12
    const dayOffset = Math.floor(r() * 60)
    const date = new Date(Date.UTC(2026, 5, 22) - dayOffset * 86_400_000)
    return {
      id: i + 1,
      name,
      company,
      title: TITLES[Math.floor(r() * TITLES.length)]!,
      email: `${first}.${last}@${company.toLowerCase().replace(/[^a-z]/g, '')}.example`,
      phone: `+1 ${200 + Math.floor(r() * 700)}-${100 + Math.floor(r() * 800)}-${1000 + Math.floor(r() * 8999)}`,
      stage,
      tier,
      dealValue: Math.round(baseValue * (0.6 + r() * 1.4)),
      closeProbability: Math.round(prob * 100) / 100,
      lastContact: date.toISOString().slice(0, 10),
      nextAction: ACTIONS[Math.floor(r() * ACTIONS.length)]!,
      owner: OWNERS[Math.floor(r() * OWNERS.length)]!,
      region: REGIONS[Math.floor(r() * REGIONS.length)]!,
      tags: TAGS_POOL[Math.floor(r() * TAGS_POOL.length)]!.join(' / '),
    }
  })

  const STAGE_COLOR: Record<Stage, string> = {
    'Lead':         '#94a3b8',
    'Qualified':    '#3b82f6',
    'Proposal':     '#8b5cf6',
    'Negotiation':  '#f59e0b',
    'Closed Won':   '#10b981',
    'Closed Lost':  '#ef4444',
  }
  const TIER_COLOR: Record<Tier, string> = {
    'Strategic':  '#0ea5e9',
    'Enterprise': '#6366f1',
    'Mid-market': '#14b8a6',
    'SMB':        '#64748b',
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature, rowSelectionFeature })

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'id',           header: '#',                 width: 60,  align: 'right', editable: false },
    { field: 'name',         header: 'Contact',           width: 170, editorType: 'text',
      cell: (ctx) => renderSnippet(NameCell, { row: ctx.row.original }) },
    { field: 'company',      header: 'Company',           width: 200, editorType: 'text' },
    { field: 'title',        header: 'Title',             width: 170, editorType: 'text' },
    { field: 'stage',        header: 'Stage',             width: 140,
      editorType: 'list',
      editorOptions: STAGES as unknown as string[],
      cell: (ctx) => renderSnippet(StageBadge, { value: ctx.row.original.stage }) },
    { field: 'tier',         header: 'Tier',              width: 130,
      editorType: 'list',
      editorOptions: TIERS as unknown as string[],
      cell: (ctx) => renderSnippet(TierBadge, { value: ctx.row.original.tier }) },
    { field: 'dealValue',    header: 'Deal value',        width: 130, align: 'right',
      editorType: 'number',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'closeProbability', header: 'P(close)',      width: 110, align: 'right',
      editorType: 'number',
      cell: (ctx) => renderSnippet(ProbCell, { value: ctx.row.original.closeProbability }) },
    { field: 'lastContact',  header: 'Last contact',      width: 120, editorType: 'date' },
    { field: 'nextAction',   header: 'Next action',       width: 180,
      editorType: 'list',
      editorOptions: ACTIONS },
    { field: 'owner',        header: 'Owner',             width: 120,
      editorType: 'list',
      editorOptions: OWNERS },
    { field: 'region',       header: 'Region',            width: 110,
      editorType: 'list',
      editorOptions: REGIONS },
    { field: 'email',        header: 'Email',             width: 240, editorType: 'text' },
    { field: 'phone',        header: 'Phone',             width: 160, editorType: 'text' },
    { field: 'tags',         header: 'Tags',              width: 220, editorType: 'text' },
  ]

  const STORAGE_KEY = 'svgrid-demo:171-crm'
  const storage = localStorageViews(STORAGE_KEY)
  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let detach: (() => void) | null = null

  function onApiReady(next: SvGridApi<typeof features, Row>) {
    api = next
    const views = createNamedViews(next, { storage })
    detach = attachAutoSavedView(next, views)
  }
  function resetSavedState() {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
    location.reload()
  }
  function showSaved() {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    alert(raw ? raw : '(nothing saved yet - change a column width / sort / filter to trigger the save)')
  }
  function stageColor(s: Stage) { return STAGE_COLOR[s] }
  function tierColor(t: Tier)   { return TIER_COLOR[t] }

  onDestroy(() => detach?.())
</script>

{#snippet NameCell({ row }: { row: Row })}
  <div class="name-cell">
    <span class="name-avatar" style="background: {tierColor(row.tier)}">
      {row.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
    </span>
    <div class="name-text">
      <div class="name-line">{row.name}</div>
      <div class="name-sub">{row.title}</div>
    </div>
  </div>
{/snippet}

{#snippet StageBadge({ value }: { value: Stage })}
  <span class="badge" style="--bg: {stageColor(value)}">{value}</span>
{/snippet}

{#snippet TierBadge({ value }: { value: Tier })}
  <span class="badge badge-soft" style="--bg: {tierColor(value)}">{value}</span>
{/snippet}

{#snippet ProbCell({ value }: { value: number })}
  <div class="prob-cell">
    <span class="prob-num">{Math.round(value * 100)}%</span>
    <span class="prob-bar"><span class="prob-fill" style="width: {Math.round(value * 100)}%"></span></span>
  </div>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <header>
    <h2 class="text-base font-semibold">CRM contacts - layout persists across reloads</h2>
    <p class="text-xs mt-1" style="color: var(--sg-muted);">
      Sort by <em>Deal value</em>, filter by <em>Stage</em>, hide the columns you don't care about,
      drag a column to a new position, then <strong>reload the tab</strong>. The state lives in
      <code>localStorage</code> under the key <code>{STORAGE_KEY}</code>, written through
      <code>createNamedViews</code> + <code>attachAutoSavedView</code>.
    </p>
    <div class="mt-2 flex gap-2 text-xs">
      <button class="ps-btn" onclick={showSaved}>Show saved JSON</button>
      <button class="ps-btn ps-btn-danger" onclick={resetSavedState}>Clear saved state + reload</button>
    </div>
  </header>

  <div class="ps-wrap">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      sortable
      filterable
      selectionMode="row"
      showRowSelection={true}
      showColumnFilters={true}
      showPagination={false}
      enableInlineEditing={true}
      enableCellSelection={false}
      enableRowSummaries={false}
      rowHeight={48}
      containerHeight="100%"
      fitColumns={false}
      onApiReady={onApiReady}
    />
  </div>
</section>

<style>
  .ps-wrap {
    flex: 1; min-height: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    overflow: hidden;
  }
  .ps-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #0f172a);
    padding: 4px 10px;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }
  .ps-btn:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .ps-btn-danger {
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
  }
  .ps-btn-danger:hover { background: rgba(239, 68, 68, 0.08); }

  :global(.name-cell) { display: flex; align-items: center; gap: 10px; }
  :global(.name-avatar) {
    flex: none;
    width: 30px; height: 30px;
    border-radius: 50%;
    color: white;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    display: inline-flex; align-items: center; justify-content: center;
  }
  :global(.name-text)  { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
  :global(.name-line)  { font-size: 13px; font-weight: 600; color: var(--sg-fg, #0f172a); }
  :global(.name-sub)   { font-size: 11px; color: var(--sg-muted, #64748b); }

  :global(.badge) {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    background: var(--bg, #64748b);
    color: white;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  :global(.badge.badge-soft) {
    background: color-mix(in srgb, var(--bg) 14%, transparent);
    color: var(--bg);
    border: 1px solid color-mix(in srgb, var(--bg) 35%, transparent);
  }

  :global(.prob-cell)  { display: inline-flex; flex-direction: column; gap: 2px; align-items: flex-end; }
  :global(.prob-num)   { font-size: 12px; font-weight: 600; color: var(--sg-fg, #0f172a); }
  :global(.prob-bar)   {
    width: 60px; height: 5px;
    background: var(--sg-row-hover-bg, #e2e8f0);
    border-radius: 999px;
    overflow: hidden;
  }
  :global(.prob-fill)  {
    display: block; height: 100%;
    background: linear-gradient(90deg, #f59e0b, #10b981);
  }
</style>
