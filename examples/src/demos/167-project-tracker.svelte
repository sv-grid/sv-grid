<script lang="ts">
  /**
   * 167. Project tracker (Enterprise PM workspace)
   * -----------------------------------------------
   * A Linear / Asana / Monday-style project tracker built on SvGrid.
   * The visual language is restrained: subtle tinted pills + chips,
   * compact toolbar, sparkline-feel KPI cards. Everything drives off
   * the same `data` array so edits flow through to KPIs, phase cards,
   * and group aggregates instantly.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    columnGroupingFeature,
    rowExpandingFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  // ---- Domain ---------------------------------------------------------
  type Phase = 'New requests' | 'Under review' | 'Launch ready' | 'Backlog'
  type Status = 'New' | 'In Review' | 'In Progress' | 'Blocked' | 'Ready'
  type Priority = 'Urgent' | 'High' | 'Medium' | 'Low'
  type Risk = 'High' | 'Medium' | 'Low'
  type Department =
    | 'Product' | 'Engineering' | 'Customer Success' | 'Design'
    | 'Support' | 'Marketing' | 'Data' | 'Security'

  type Project = {
    id: string
    name: string
    isNew: boolean
    progress: number       // 0..100
    owner: string
    ownerInitial: string
    summary: string
    status: Status
    priority: Priority
    risk: Risk
    department: Department
    skills: string[]
    budget: number         // USD
    spent: number          // USD spent so far
    due: string            // ISO date
    phase: Phase
  }

  // Deterministic helpers used to fill in due dates without changing the
  // identity of the source SEED below.
  function dueDateFor(idx: number): string {
    const start = new Date(2026, 5, 25) // June 25, 2026
    const d = new Date(start.getTime() + idx * 5 * 86_400_000)
    return d.toISOString().slice(0, 10)
  }

  const SEED: Project[] = [
    // ----- New requests --------------------------------------------------
    { id: 'PRJ-101', name: 'Mobile checkout launch',
      isNew: true, progress: 20, owner: 'Jamal Wright', ownerInitial: 'JW',
      summary: 'Ship checkout v1 for iOS + Android with Apple/Google Pay',
      status: 'New', priority: 'High', risk: 'Medium',
      department: 'Product', skills: ['React', 'TypeScript', 'Mobile'],
      budget: 95_000, spent: 18_000, due: dueDateFor(0), phase: 'New requests' },
    { id: 'PRJ-102', name: 'Enterprise SSO rollout',
      isNew: true, progress: 15, owner: 'Riya Patel', ownerInitial: 'RP',
      summary: 'SAML SSO + SCIM provisioning for enterprise customers',
      status: 'New', priority: 'Medium', risk: 'Low',
      department: 'Engineering', skills: ['Angular', 'TypeScript', 'Auth'],
      budget: 80_000, spent: 12_000, due: dueDateFor(1), phase: 'New requests' },
    { id: 'PRJ-103', name: 'Q3 onboarding revamp',
      isNew: true, progress: 10, owner: 'Elena Cruz', ownerInitial: 'EC',
      summary: 'Activation flow, docs, first-week checklist',
      status: 'New', priority: 'Medium', risk: 'Low',
      department: 'Customer Success', skills: ['Vue', 'Design', 'Content'],
      budget: 60_000, spent: 6_000, due: dueDateFor(2), phase: 'New requests' },
    { id: 'PRJ-104', name: 'Design system token audit',
      isNew: true, progress: 5, owner: 'Sara Lindqvist', ownerInitial: 'SL',
      summary: 'Audit + normalize design tokens across web and mobile',
      status: 'New', priority: 'Low', risk: 'Low',
      department: 'Design', skills: ['TypeScript', 'Design', 'Tooling'],
      budget: 45_000, spent: 2_500, due: dueDateFor(3), phase: 'New requests' },
    { id: 'PRJ-105', name: 'AI support triage beta',
      isNew: true, progress: 15, owner: 'Aiko Tanaka', ownerInitial: 'AT',
      summary: 'Pilot AI triage for L1 tickets with human-in-the-loop',
      status: 'New', priority: 'Urgent', risk: 'Medium',
      department: 'Support', skills: ['React', 'Node', 'Data'],
      budget: 105_000, spent: 19_000, due: dueDateFor(4), phase: 'New requests' },

    // ----- Under review --------------------------------------------------
    { id: 'PRJ-201', name: 'Pricing engine optimization',
      isNew: false, progress: 60, owner: 'Rafael Diaz', ownerInitial: 'RD',
      summary: 'Quote + discount calc engine targeting sub-100ms p95',
      status: 'In Review', priority: 'High', risk: 'Medium',
      department: 'Engineering', skills: ['TypeScript', 'Node'],
      budget: 130_000, spent: 78_000, due: dueDateFor(8), phase: 'Under review' },
    { id: 'PRJ-202', name: 'Marketing site replatform',
      isNew: false, progress: 45, owner: 'Lin Wei', ownerInitial: 'LW',
      summary: 'Move site to new CMS + edge stack, target sub-1s LCP',
      status: 'In Review', priority: 'High', risk: 'Medium',
      department: 'Marketing', skills: ['Vue', 'Design'],
      budget: 110_000, spent: 49_000, due: dueDateFor(10), phase: 'Under review' },
    { id: 'PRJ-203', name: 'Data warehouse migration',
      isNew: false, progress: 35, owner: 'Yuki Tanaka', ownerInitial: 'YT',
      summary: 'Move analytics to new warehouse with dbt models',
      status: 'In Review', priority: 'Medium', risk: 'Low',
      department: 'Data', skills: ['Node', 'Data'],
      budget: 95_000, spent: 33_000, due: dueDateFor(12), phase: 'Under review' },
    { id: 'PRJ-204', name: 'Security posture review',
      isNew: false, progress: 0, owner: 'Chen Wei', ownerInitial: 'CW',
      summary: 'Quarterly security + SOC 2 compliance posture review',
      status: 'Blocked', priority: 'Low', risk: 'High',
      department: 'Security', skills: ['Angular', 'Security'],
      budget: 75_000, spent: 0, due: dueDateFor(14), phase: 'Under review' },

    // ----- Launch ready --------------------------------------------------
    { id: 'PRJ-301', name: 'Webhook reliability',
      isNew: false, progress: 90, owner: 'Mei Sato', ownerInitial: 'MS',
      summary: 'Retry queues + DLQ visibility for outbound webhooks',
      status: 'Ready', priority: 'High', risk: 'Low',
      department: 'Engineering', skills: ['Node', 'TypeScript'],
      budget: 100_000, spent: 90_000, due: dueDateFor(16), phase: 'Launch ready' },
    { id: 'PRJ-302', name: 'Billing portal v2',
      isNew: false, progress: 85, owner: 'Diego Reyes', ownerInitial: 'DR',
      summary: 'Self-serve invoices, tax IDs, seat management',
      status: 'Ready', priority: 'High', risk: 'Low',
      department: 'Product', skills: ['React', 'TypeScript'],
      budget: 120_000, spent: 102_000, due: dueDateFor(18), phase: 'Launch ready' },
    { id: 'PRJ-303', name: 'iOS push reliability',
      isNew: false, progress: 80, owner: 'Ana Silva', ownerInitial: 'AS',
      summary: 'APNs reliability fixes + richer notification surface',
      status: 'Ready', priority: 'Medium', risk: 'Low',
      department: 'Engineering', skills: ['TypeScript', 'Mobile'],
      budget: 85_000, spent: 68_000, due: dueDateFor(20), phase: 'Launch ready' },
    { id: 'PRJ-304', name: 'EU residency tier',
      isNew: false, progress: 80, owner: 'Sven Berg', ownerInitial: 'SB',
      summary: 'Frankfurt residency tier, audit-ready DPA + DPIA',
      status: 'Ready', priority: 'Medium', risk: 'Low',
      department: 'Security', skills: ['Data', 'Security'],
      budget: 90_000, spent: 72_000, due: dueDateFor(22), phase: 'Launch ready' },
    { id: 'PRJ-305', name: 'Onboarding emails refresh',
      isNew: false, progress: 90, owner: 'Priya Shah', ownerInitial: 'PS',
      summary: '7-touch onboarding sequence with persona branching',
      status: 'Ready', priority: 'Low', risk: 'Low',
      department: 'Customer Success', skills: ['Design', 'Content'],
      budget: 70_000, spent: 63_000, due: dueDateFor(24), phase: 'Launch ready' },

    // ----- Backlog -------------------------------------------------------
    { id: 'PRJ-401', name: 'Field service dispatch',
      isNew: false, progress: 25, owner: 'Tomas Vilar', ownerInitial: 'TV',
      summary: 'Mobile dispatch app for field techs with offline mode',
      status: 'In Progress', priority: 'Medium', risk: 'Medium',
      department: 'Product', skills: ['React', 'Mobile'],
      budget: 110_000, spent: 28_000, due: dueDateFor(28), phase: 'Backlog' },
    { id: 'PRJ-402', name: 'Internal AI knowledge base',
      isNew: false, progress: 30, owner: 'Hana Kobayashi', ownerInitial: 'HK',
      summary: 'Slack-grounded AI assistant for internal product knowledge',
      status: 'In Progress', priority: 'Medium', risk: 'Medium',
      department: 'Support', skills: ['Node', 'Data'],
      budget: 50_000, spent: 14_000, due: dueDateFor(32), phase: 'Backlog' },
  ]

  let data = $state<Project[]>(SEED)

  // ---- Feature set ---------------------------------------------------
  const features = tableFeatures({
    rowSortingFeature, columnFilteringFeature,
    rowSelectionFeature, columnGroupingFeature, rowExpandingFeature,
  })

  // ---- Theme tokens used by the chip cells ---------------------------
  // Modern subtle-tint pills: light fill (color/14% alpha) + same-hue
  // dark text (or vice-versa in dark mode). Looks like Linear / Notion.
  const STATUS_COLOR: Record<Status, string> = {
    'New':         '#3b82f6',
    'In Review':   '#f59e0b',
    'In Progress': '#8b5cf6',
    'Blocked':     '#ef4444',
    'Ready':       '#10b981',
  }
  const PRIORITY_COLOR: Record<Priority, string> = {
    'Urgent': '#dc2626',
    'High':   '#ef4444',
    'Medium': '#f59e0b',
    'Low':    '#64748b',
  }
  const RISK_COLOR: Record<Risk, string> = {
    'High':   '#ef4444',
    'Medium': '#f59e0b',
    'Low':    '#10b981',
  }
  const DEPT_COLOR: Record<Department, string> = {
    'Product':          '#3b82f6',
    'Engineering':      '#8b5cf6',
    'Customer Success': '#06b6d4',
    'Design':           '#ec4899',
    'Support':          '#14b8a6',
    'Marketing':        '#f97316',
    'Data':             '#0ea5e9',
    'Security':         '#7c3aed',
  }
  /** Avatar gradient picked from a stable hash of the initials. */
  const AVATAR_GRADIENTS = [
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #ec4899, #f97316)',
    'linear-gradient(135deg, #06b6d4, #3b82f6)',
    'linear-gradient(135deg, #10b981, #14b8a6)',
    'linear-gradient(135deg, #f59e0b, #ef4444)',
    'linear-gradient(135deg, #8b5cf6, #ec4899)',
    'linear-gradient(135deg, #0ea5e9, #10b981)',
    'linear-gradient(135deg, #7c3aed, #06b6d4)',
  ]
  function avatarGradient(initials: string): string {
    let h = 0
    for (let i = 0; i < initials.length; i += 1) h = (h * 31 + initials.charCodeAt(i)) >>> 0
    return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]!
  }

  const STATUS_OPTS = ['New', 'In Review', 'In Progress', 'Blocked', 'Ready']
  const PRIORITY_OPTS = ['Urgent', 'High', 'Medium', 'Low']
  const RISK_OPTS = ['High', 'Medium', 'Low']
  const DEPT_OPTS = Object.keys(DEPT_COLOR)
  const SKILL_OPTS = [
    'React', 'Angular', 'Vue', 'TypeScript', 'Node',
    'Design', 'Data', 'Security', 'Mobile', 'Auth', 'Tooling', 'Content',
  ]

  // ---- KPI strip -----------------------------------------------------
  const kpi = $derived.by(() => {
    const total = data.length
    const inProgress = data.filter((p) => p.status === 'In Progress' || p.status === 'In Review' || p.status === 'New').length
    const ready      = data.filter((p) => p.status === 'Ready').length
    const blocked    = data.filter((p) => p.status === 'Blocked').length
    const budget     = data.reduce((s, p) => s + p.budget, 0)
    const spent      = data.reduce((s, p) => s + p.spent, 0)
    const avgProg    = total ? Math.round(data.reduce((s, p) => s + p.progress, 0) / total) : 0
    return { total, inProgress, ready, blocked, budget, spent, avgProg, burn: budget > 0 ? spent / budget : 0 }
  })

  // ---- Selection-aware bulk-action state ----------------------------
  let api = $state<SvGridApi<typeof features, Project> | null>(null)
  let selectedCount = $state(0)
  let selectedIds = $state<string[]>([])
  let isGrouped = $state(false)
  let showFilters = $state(false)
  let sortOpen = $state(false)
  let sortLabel = $state<string>('None')

  /** Sort presets the dropdown surfaces. Mapping to (columnId, direction)
   *  + null entry to clear. Labels show in the dropdown + the toolbar. */
  const SORT_PRESETS: Array<{ label: string; column: string | null; desc: boolean }> = [
    { label: 'None',                     column: null,       desc: false },
    { label: 'Name (A → Z)',             column: 'name',     desc: false },
    { label: 'Name (Z → A)',             column: 'name',     desc: true  },
    { label: 'Progress (high → low)',    column: 'progress', desc: true  },
    { label: 'Progress (low → high)',    column: 'progress', desc: false },
    { label: 'Due date (soonest)',       column: 'due',      desc: false },
    { label: 'Due date (latest)',        column: 'due',      desc: true  },
    { label: 'Budget (highest)',         column: 'budget',   desc: true  },
    { label: 'Budget (lowest)',          column: 'budget',   desc: false },
  ]
  function applySort(preset: typeof SORT_PRESETS[number]) {
    sortLabel = preset.label
    sortOpen = false
    if (!preset.column) api?.clearSort()
    else api?.setSort(preset.column, preset.desc ? 'desc' : 'asc')
  }
  // Close the sort dropdown on outside click.
  $effect(() => {
    if (!sortOpen) return
    function on(e: MouseEvent) {
      const t = e.target as HTMLElement | null
      if (t && t.closest('[data-pt-sort]')) return
      sortOpen = false
    }
    window.addEventListener('mousedown', on)
    return () => window.removeEventListener('mousedown', on)
  })

  function patch(ids: string[], change: Partial<Project>) {
    data = data.map((p) => ids.includes(p.id) ? { ...p, ...change } : p)
  }
  function markReady()    { patch(selectedIds, { status: 'Ready',   progress: 100 }) }
  function blockSelected(){ patch(selectedIds, { status: 'Blocked' }) }
  function moveToLaunch() { patch(selectedIds, { phase: 'Launch ready' }) }
  function deleteSelected(){
    const ids = new Set(selectedIds)
    data = data.filter((p) => !ids.has(p.id))
    api?.clearRowSelection()
  }
  function newProject() {
    const idx = data.length + 1
    const next: Project = {
      id: `PRJ-${500 + idx}`,
      name: 'New project',
      isNew: true, progress: 0,
      owner: 'You', ownerInitial: 'YO',
      summary: 'Click to add an executive summary',
      status: 'New', priority: 'Medium', risk: 'Low',
      department: 'Product', skills: [], budget: 50_000, spent: 0,
      due: dueDateFor(idx + 5), phase: 'New requests',
    }
    data = [next, ...data]
  }
  function toggleGrouping() {
    isGrouped = !isGrouped
    if (!api) return
    if (isGrouped) {
      api.setGroupBy(['phase'])
      // Expand every phase group so the user sees the rows under each
      // header right away (rather than landing on collapsed groups).
      queueMicrotask(() => {
        api?.setRowExpanded('phase:New requests', true)
        api?.setRowExpanded('phase:Under review', true)
        api?.setRowExpanded('phase:Launch ready', true)
        api?.setRowExpanded('phase:Backlog', true)
      })
    } else {
      api.setGroupBy([])
    }
  }

  // ---- Columns -------------------------------------------------------
  const columns = $derived<ColumnDef<typeof features, Project>[]>([
    {
      field: 'id', header: 'ID', width: 100, editable: false,
      cell: (ctx) => renderSnippet(IdCell, { row: ctx.row.original }),
    },
    {
      field: 'name', header: 'Project', editorType: 'text', width: 320,
      cell: (ctx) => renderSnippet(NameCell, { row: ctx.row.original }),
    },
    {
      field: 'owner', header: 'Owner', editorType: 'text', width: 200,
      cell: (ctx) => renderSnippet(OwnerCell, { row: ctx.row.original }),
    },
    {
      field: 'status', header: 'Status', editorType: 'list',
      editorOptions: STATUS_OPTS, width: 140,
      cell: (ctx) => renderSnippet(PillCell, {
        text: ctx.row.original.status, color: STATUS_COLOR[ctx.row.original.status as Status],
      }),
    },
    {
      field: 'priority', header: 'Priority', editorType: 'list',
      editorOptions: PRIORITY_OPTS, width: 130,
      cell: (ctx) => renderSnippet(PillCell, {
        text: ctx.row.original.priority, color: PRIORITY_COLOR[ctx.row.original.priority as Priority],
      }),
    },
    {
      field: 'department', header: 'Team', editorType: 'list',
      editorOptions: DEPT_OPTS, width: 180,
      cell: (ctx) => renderSnippet(DeptCell, { row: ctx.row.original }),
    },
    {
      field: 'skills', header: 'Tags', editorType: 'chips',
      editorOptions: SKILL_OPTS, editorMultiple: true, width: 230,
      cell: (ctx) => renderSnippet(SkillsCell, { row: ctx.row.original }),
    },
    {
      field: 'risk', header: 'Risk', editorType: 'list',
      editorOptions: RISK_OPTS, width: 100,
      cell: (ctx) => renderSnippet(PillCell, {
        text: ctx.row.original.risk, color: RISK_COLOR[ctx.row.original.risk as Risk], dim: true,
      }),
    },
    {
      field: 'due', header: 'Due', editorType: 'text', width: 120,
      cell: (ctx) => renderSnippet(DueCell, { row: ctx.row.original }),
    },
    {
      field: 'budget', header: 'Budget', editorType: 'number', width: 160,
      cell: (ctx) => renderSnippet(BudgetCell, { row: ctx.row.original }),
    },
    {
      field: 'summary', header: 'Summary', editorType: 'text', width: 320,
      cell: (ctx) => renderSnippet(SummaryCell, { row: ctx.row.original }),
    },
  ])

  // ---- Phase summary cards on the right of the toolbar --------------
  const PHASE_ORDER: Phase[] = ['New requests', 'Under review', 'Launch ready', 'Backlog']
  const PHASE_COLOR: Record<Phase, string> = {
    'New requests':  '#3b82f6',
    'Under review':  '#f59e0b',
    'Launch ready':  '#10b981',
    'Backlog':       '#64748b',
  }
  const phaseStats = $derived(PHASE_ORDER.map((phase) => {
    const items = data.filter((p) => p.phase === phase)
    const avg = items.length ? Math.round(items.reduce((s, p) => s + p.progress, 0) / items.length) : 0
    const blocked = items.filter((p) => p.status === 'Blocked').length
    const ready   = items.filter((p) => p.status === 'Ready').length
    return { phase, count: items.length, avg, blocked, ready }
  }))

  function fmtMoney(n: number): string {
    if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000)     return '$' + Math.round(n / 1_000) + 'k'
    return '$' + n
  }
  function fmtDue(iso: string): { label: string; tone: 'overdue' | 'soon' | 'ok' } {
    const today = new Date('2026-06-25T00:00:00Z').getTime()
    const due = new Date(iso + 'T00:00:00Z').getTime()
    const days = Math.round((due - today) / 86_400_000)
    if (days < 0) return { label: `${-days}d overdue`, tone: 'overdue' }
    if (days <= 7) return { label: `in ${days}d`, tone: 'soon' }
    const d = new Date(iso)
    return { label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), tone: 'ok' }
  }
</script>

{#snippet IdCell({ row }: { row: Project })}
  <span class="pt-id">{row.id}</span>
{/snippet}

{#snippet NameCell({ row }: { row: Project })}
  <div class="pt-name">
    <div class="pt-name-top">
      <span class="pt-name-text">{row.name}</span>
      {#if row.isNew}<span class="pt-new-pill">NEW</span>{/if}
    </div>
    <div class="pt-progress">
      <div class="pt-progress-track">
        <div class="pt-progress-fill"
          style:width={row.progress + '%'}
          style:background={row.progress >= 75 ? '#10b981' : row.progress >= 35 ? '#f59e0b' : '#94a3b8'}>
        </div>
      </div>
      <span class="pt-progress-text">{row.progress}%</span>
    </div>
  </div>
{/snippet}

{#snippet OwnerCell({ row }: { row: Project })}
  <div class="pt-owner">
    <span class="pt-avatar" style:background={avatarGradient(row.ownerInitial)}>
      {row.ownerInitial}
    </span>
    <span class="pt-owner-name">{row.owner}</span>
  </div>
{/snippet}

{#snippet PillCell({ text, color, dim }: { text: string; color: string; dim?: boolean })}
  <span class="pt-pill" style:--c={color} class:is-dim={dim}>
    <span class="pt-pill-dot" style:background={color}></span>
    {text}
  </span>
{/snippet}

{#snippet DeptCell({ row }: { row: Project })}
  <span class="pt-dept" style:--c={DEPT_COLOR[row.department]}>{row.department}</span>
{/snippet}

{#snippet SkillsCell({ row }: { row: Project })}
  <div class="pt-skills">
    {#each row.skills.slice(0, 2) as s (s)}
      <span class="pt-skill">{s}</span>
    {/each}
    {#if row.skills.length > 2}
      <span class="pt-skill pt-skill-more" title={row.skills.slice(2).join(', ')}>
        +{row.skills.length - 2}
      </span>
    {/if}
  </div>
{/snippet}

{#snippet DueCell({ row }: { row: Project })}
  {@const due = fmtDue(row.due)}
  <span class="pt-due pt-due-{due.tone}">{due.label}</span>
{/snippet}

{#snippet BudgetCell({ row }: { row: Project })}
  <div class="pt-budget">
    <div class="pt-budget-top">
      <span class="pt-budget-spent">{fmtMoney(row.spent)}</span>
      <span class="pt-budget-sep">/</span>
      <span class="pt-budget-total">{fmtMoney(row.budget)}</span>
    </div>
    <div class="pt-budget-track">
      <div class="pt-budget-fill"
        style:width={Math.min(100, (row.spent / Math.max(1, row.budget)) * 100) + '%'}
        style:background={row.spent > row.budget ? '#ef4444' : row.spent > row.budget * 0.85 ? '#f59e0b' : '#10b981'}>
      </div>
    </div>
  </div>
{/snippet}

{#snippet SummaryCell({ row }: { row: Project })}
  <span class="pt-summary" title={row.summary}>{row.summary}</span>
{/snippet}

<section class="pt-shell">
  <!-- Page header + primary action ----------------------------------- -->
  <header class="pt-page-head">
    <div>
      <div class="pt-eyebrow">PM workspace</div>
      <h1 class="pt-title">Active projects</h1>
      <p class="pt-lede">
        {kpi.total} projects across {phaseStats.length} phases · {kpi.avgProg}% avg complete
        {#if kpi.blocked > 0} · <span class="pt-warn">{kpi.blocked} blocked</span>{/if}
      </p>
    </div>
    <div class="pt-page-actions">
      <button class="pt-btn pt-btn-ghost" title="Import projects">
        <span aria-hidden="true">↥</span> Import
      </button>
      <button class="pt-btn pt-btn-ghost" title="Export">
        <span aria-hidden="true">↧</span> Export
      </button>
      <button class="pt-btn pt-btn-primary" onclick={newProject}>
        <span aria-hidden="true">+</span> New project
      </button>
    </div>
  </header>

  <!-- KPI strip -------------------------------------------------------- -->
  <div class="pt-kpis">
    <div class="pt-kpi">
      <div class="pt-kpi-label">Total projects</div>
      <div class="pt-kpi-value">{kpi.total}</div>
      <div class="pt-kpi-meta">across {phaseStats.length} phases</div>
    </div>
    <div class="pt-kpi" data-accent="blue">
      <div class="pt-kpi-label">In progress</div>
      <div class="pt-kpi-value">{kpi.inProgress}</div>
      <div class="pt-kpi-bar"><span style:width={(kpi.inProgress / Math.max(1, kpi.total)) * 100 + '%'}></span></div>
    </div>
    <div class="pt-kpi" data-accent="green">
      <div class="pt-kpi-label">Launch ready</div>
      <div class="pt-kpi-value">{kpi.ready}</div>
      <div class="pt-kpi-bar"><span style:width={(kpi.ready / Math.max(1, kpi.total)) * 100 + '%'}></span></div>
    </div>
    <div class="pt-kpi" data-accent={kpi.blocked > 0 ? 'red' : 'neutral'}>
      <div class="pt-kpi-label">Blocked</div>
      <div class="pt-kpi-value">{kpi.blocked}</div>
      <div class="pt-kpi-meta">{kpi.blocked === 0 ? 'all clear' : 'needs attention'}</div>
    </div>
    <div class="pt-kpi" data-accent="violet">
      <div class="pt-kpi-label">Budget burn</div>
      <div class="pt-kpi-value">{Math.round(kpi.burn * 100)}%</div>
      <div class="pt-kpi-meta">{fmtMoney(kpi.spent)} of {fmtMoney(kpi.budget)}</div>
    </div>
  </div>

  <!-- Phase pipeline cards -------------------------------------------- -->
  <div class="pt-pipeline">
    {#each phaseStats as ps (ps.phase)}
      <div class="pt-pcard" style:--c={PHASE_COLOR[ps.phase]}>
        <div class="pt-pcard-top">
          <span class="pt-pcard-dot"></span>
          <span class="pt-pcard-name">{ps.phase}</span>
          <span class="pt-pcard-count">{ps.count}</span>
        </div>
        <div class="pt-pcard-bar">
          <div class="pt-pcard-fill" style:width={ps.avg + '%'}></div>
        </div>
        <div class="pt-pcard-meta">
          {ps.avg}% avg · {ps.ready} ready
          {#if ps.blocked > 0}<span class="pt-warn"> · {ps.blocked} blocked</span>{/if}
        </div>
      </div>
    {/each}
  </div>

  <!-- Toolbar --------------------------------------------------------- -->
  <div class="pt-toolbar">
    <div class="pt-toolbar-group">
      <button class="pt-btn pt-btn-ghost" onclick={toggleGrouping} class:is-active={isGrouped}>
        <span aria-hidden="true">▤</span> Group by phase
      </button>

      <!-- Sort dropdown ------------------------------------------ -->
      <div class="pt-sort-wrap" data-pt-sort>
        <button
          class="pt-btn pt-btn-ghost"
          class:is-active={sortLabel !== 'None'}
          onclick={() => (sortOpen = !sortOpen)}
          aria-haspopup="true"
          aria-expanded={sortOpen}
        >
          <span aria-hidden="true">⇅</span>
          Sort{sortLabel !== 'None' ? ': ' + sortLabel : ''}
          <span class="pt-caret" aria-hidden="true">▾</span>
        </button>
        {#if sortOpen}
          <div class="pt-popover" role="menu" data-pt-sort>
            {#each SORT_PRESETS as preset (preset.label)}
              <button
                type="button"
                role="menuitem"
                class="pt-popover-item"
                class:is-active={sortLabel === preset.label}
                onclick={() => applySort(preset)}
              >{preset.label}</button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Filter toggle ------------------------------------------ -->
      <button
        class="pt-btn pt-btn-ghost"
        class:is-active={showFilters}
        onclick={() => (showFilters = !showFilters)}
        title={showFilters ? 'Hide column filters' : 'Show column filters'}
      >
        <span aria-hidden="true">⌖</span> {showFilters ? 'Hide filters' : 'Filter'}
      </button>
    </div>

    {#if selectedCount > 0}
      <div class="pt-toolbar-sel">
        <span class="pt-sel-counter">{selectedCount} selected</span>
        <button class="pt-btn pt-btn-ghost" onclick={markReady}>
          <span aria-hidden="true">✓</span> Mark ready
        </button>
        <button class="pt-btn pt-btn-ghost" onclick={blockSelected}>
          <span aria-hidden="true">⊘</span> Block
        </button>
        <button class="pt-btn pt-btn-ghost" onclick={moveToLaunch}>
          <span aria-hidden="true">⤴</span> Move to launch
        </button>
        <button class="pt-btn pt-btn-danger" onclick={deleteSelected}>
          <span aria-hidden="true">🗑</span> Delete
        </button>
      </div>
    {/if}
  </div>

  <!-- Grid ------------------------------------------------------------ -->
  <div class="pt-grid-wrap">
    <SvGrid responsive={true}
      data={data}
      columns={columns}
      features={features}
      filterMode="row"
      selectionMode="row"
      showRowSelection={true}
      showFilterRow={showFilters}
      showColumnFilters={false}
      showGroupingControls={false}
      enableInlineEditing={true}
      enableCellSelection={false}
      rowHeight={52}
      containerHeight="100%"
      fitColumns={false}
      onApiReady={(next) => { api = next }}
      onRowSelectionChange={(_, rows) => {
        selectedCount = rows.length
        selectedIds = rows.map((r) => r.id)
      }}
    />
  </div>
</section>

<style>
  .pt-shell {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    min-height: 0;
    color: var(--sg-fg, #0f172a);
  }

  /* ----- Page header ------------------------------------------ */
  .pt-page-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-shrink: 0;
  }
  .pt-eyebrow {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--sg-muted, #64748b);
    font-weight: 700;
  }
  .pt-title {
    margin: 2px 0 4px;
    font-size: 22px;
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.01em;
    color: var(--sg-fg, #0f172a);
  }
  .pt-lede {
    margin: 0;
    font-size: 12.5px;
    color: var(--sg-muted, #64748b);
  }
  .pt-warn { color: #ef4444; font-weight: 600; }
  .pt-page-actions {
    display: flex; gap: 6px; align-items: center;
    flex-shrink: 0;
  }

  /* ----- Buttons --------------------------------------------- */
  .pt-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 11px;
    border-radius: 6px;
    background: transparent;
    color: var(--sg-fg, #0f172a);
    border: 1px solid transparent;
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 500;
    transition: background 80ms ease, border-color 80ms ease, color 80ms ease;
    white-space: nowrap;
  }
  .pt-btn:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }
  .pt-btn:disabled { color: var(--sg-muted, #94a3b8); opacity: 0.55; cursor: not-allowed; }
  .pt-btn-ghost { border-color: var(--sg-border, #e2e8f0); }
  .pt-btn-ghost.is-active { background: color-mix(in srgb, var(--sg-accent, #3b82f6) 12%, transparent); border-color: var(--sg-accent, #3b82f6); color: var(--sg-accent, #3b82f6); }
  .pt-btn-primary {
    background: var(--sg-accent, #3b82f6);
    color: var(--sg-on-accent, white);
    border-color: var(--sg-accent, #3b82f6);
    font-weight: 600;
  }
  .pt-btn-primary:hover { background: color-mix(in srgb, var(--sg-accent, #3b82f6) 88%, black); }
  .pt-btn-danger { color: #ef4444; border-color: rgba(239, 68, 68, 0.3); }
  .pt-btn-danger:hover { background: rgba(239, 68, 68, 0.10); border-color: #ef4444; }

  /* ----- KPI strip ------------------------------------------- */
  .pt-kpis {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 10px;
    flex-shrink: 0;
  }
  .pt-kpi {
    --kpi: var(--sg-muted, #64748b);
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    border: 1px solid var(--sg-border, #e2e8f0);
    position: relative;
    overflow: hidden;
  }
  .pt-kpi::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: var(--kpi);
    opacity: 0.5;
  }
  .pt-kpi[data-accent='blue']    { --kpi: #3b82f6; }
  .pt-kpi[data-accent='green']   { --kpi: #10b981; }
  .pt-kpi[data-accent='red']     { --kpi: #ef4444; }
  .pt-kpi[data-accent='violet']  { --kpi: #8b5cf6; }
  .pt-kpi[data-accent='neutral'] { --kpi: var(--sg-muted, #64748b); }
  .pt-kpi-label {
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
  }
  .pt-kpi-value {
    margin: 6px 0 2px;
    font-size: 26px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    color: var(--kpi);
  }
  .pt-kpi-meta {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
  }
  .pt-kpi-bar {
    margin-top: 8px;
    height: 4px;
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 2px;
    overflow: hidden;
  }
  .pt-kpi-bar span {
    display: block;
    height: 100%;
    background: var(--kpi);
    border-radius: 2px;
    transition: width 200ms ease;
  }

  /* ----- Phase pipeline -------------------------------------- */
  .pt-pipeline {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    flex-shrink: 0;
  }
  .pt-pcard {
    --c: var(--sg-muted, #64748b);
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
  }
  .pt-pcard-top {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }
  .pt-pcard-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--c);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 20%, transparent);
  }
  .pt-pcard-name {
    font-size: 12.5px;
    font-weight: 700;
    flex: 1;
  }
  .pt-pcard-count {
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--sg-muted, #64748b);
    padding: 1px 7px;
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 999px;
  }
  .pt-pcard-bar {
    height: 4px;
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 5px;
  }
  .pt-pcard-fill {
    height: 100%;
    background: var(--c);
    border-radius: 2px;
    transition: width 200ms ease;
  }
  .pt-pcard-meta {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
  }

  /* ----- Toolbar --------------------------------------------- */
  .pt-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 8px;
    border-radius: 8px;
    background: var(--sg-bg, #ffffff);
    border: 1px solid var(--sg-border, #e2e8f0);
    flex-shrink: 0;
    min-height: 44px;
  }
  .pt-toolbar-group, .pt-toolbar-sel { display: flex; align-items: center; gap: 4px; }
  .pt-caret { font-size: 9px; color: var(--sg-muted, #94a3b8); margin-left: 2px; }

  /* Sort dropdown popover */
  .pt-sort-wrap { position: relative; }
  .pt-popover {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 50;
    min-width: 200px;
    background: var(--sg-bg, #ffffff);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 8px;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
    padding: 4px;
  }
  .pt-popover-item {
    display: block;
    width: 100%;
    text-align: left;
    border: 0;
    background: transparent;
    padding: 6px 10px;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
    cursor: pointer;
    border-radius: 5px;
    font-weight: 500;
  }
  .pt-popover-item:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }
  .pt-popover-item.is-active {
    background: color-mix(in srgb, var(--sg-accent, #3b82f6) 14%, transparent);
    color: var(--sg-accent, #3b82f6);
    font-weight: 600;
  }
  .pt-sel-counter {
    color: var(--sg-muted, #64748b);
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    margin-right: 8px;
    padding-right: 8px;
    border-right: 1px solid var(--sg-border, #e2e8f0);
  }

  /* ----- Grid wrap ------------------------------------------- */
  .pt-grid-wrap {
    flex: 1;
    min-height: 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--sg-border, #e2e8f0);
  }

  /* ----- Cell: ID -------------------------------------------- */
  :global(.pt-id) {
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    font-weight: 600;
  }

  /* ----- Cell: Name + progress bar --------------------------- */
  :global(.pt-name) {
    display: flex;
    flex-direction: column;
    gap: 3px;
    height: 100%;
    justify-content: center;
    min-width: 0;
  }
  :global(.pt-name-top) {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  :global(.pt-name-text) {
    font-weight: 600;
    color: var(--sg-fg, #0f172a);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }
  :global(.pt-new-pill) {
    background: color-mix(in srgb, var(--sg-accent, #3b82f6) 16%, transparent);
    color: var(--sg-accent, #3b82f6);
    font-size: 9px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 3px;
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }
  :global(.pt-progress) {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  :global(.pt-progress-track) {
    flex: 1;
    height: 4px;
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 2px;
    overflow: hidden;
  }
  :global(.pt-progress-fill) {
    height: 100%;
    border-radius: 2px;
    transition: width 200ms ease;
  }
  :global(.pt-progress-text) {
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    min-width: 30px;
    text-align: right;
  }

  /* ----- Cell: Owner ----------------------------------------- */
  :global(.pt-owner) {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 100%;
    min-width: 0;
  }
  :global(.pt-avatar) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    color: white;
    font-weight: 700;
    font-size: 11px;
    flex-shrink: 0;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    letter-spacing: 0.01em;
  }
  :global(.pt-owner-name) {
    font-size: 12.5px;
    color: var(--sg-fg, #0f172a);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ----- Cell: Pills (status, priority, risk) ---------------- */
  :global(.pt-pill) {
    --c: var(--sg-muted, #64748b);
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px 3px 7px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    background: color-mix(in srgb, var(--c) 14%, transparent);
    color: var(--c);
    white-space: nowrap;
  }
  :global(.pt-pill.is-dim) {
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--c) 30%, transparent);
  }
  :global(.pt-pill-dot) {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ----- Cell: Department chip ------------------------------- */
  :global(.pt-dept) {
    --c: var(--sg-muted, #64748b);
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--c) 12%, transparent);
    color: var(--c);
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
  }

  /* ----- Cell: Skills (tags) --------------------------------- */
  :global(.pt-skills) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    overflow: hidden;
    min-width: 0;
  }
  :global(.pt-skill) {
    padding: 2px 7px;
    border-radius: 4px;
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--sg-fg, #475569);
    font-size: 10.5px;
    font-weight: 600;
    white-space: nowrap;
    border: 1px solid var(--sg-border, #e2e8f0);
  }
  :global(.pt-skill-more) {
    background: transparent;
    color: var(--sg-muted, #64748b);
    cursor: help;
  }

  /* ----- Cell: Due ------------------------------------------- */
  :global(.pt-due) {
    font-size: 12px;
    font-weight: 600;
    color: var(--sg-fg, #0f172a);
    font-variant-numeric: tabular-nums;
  }
  :global(.pt-due-soon)    { color: #f59e0b; }
  :global(.pt-due-overdue) { color: #ef4444; }

  /* ----- Cell: Budget --------------------------------------- */
  :global(.pt-budget) {
    display: flex;
    flex-direction: column;
    gap: 3px;
    height: 100%;
    justify-content: center;
    min-width: 0;
  }
  :global(.pt-budget-top) {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: var(--sg-fg, #0f172a);
  }
  :global(.pt-budget-spent) { font-weight: 700; }
  :global(.pt-budget-sep)   { color: var(--sg-muted, #94a3b8); margin: 0 3px; }
  :global(.pt-budget-total) { color: var(--sg-muted, #64748b); }
  :global(.pt-budget-track) {
    height: 4px;
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 2px;
    overflow: hidden;
  }
  :global(.pt-budget-fill) {
    height: 100%;
    border-radius: 2px;
    transition: width 200ms ease;
  }

  /* ----- Cell: Summary -------------------------------------- */
  :global(.pt-summary) {
    display: inline-block;
    width: 100%;
    color: var(--sg-muted, #64748b);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Mobile */
  @media (max-width: 1100px) {
    .pt-kpis { grid-template-columns: repeat(3, 1fr); }
    .pt-pipeline { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 700px) {
    .pt-kpis, .pt-pipeline { grid-template-columns: repeat(2, 1fr); }
    .pt-page-head { flex-direction: column; align-items: stretch; }
  }
</style>
