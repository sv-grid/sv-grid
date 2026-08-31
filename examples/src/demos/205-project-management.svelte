<script lang="ts">
  /**
   * 205. Project management board
   * -----------------------------
   * A project tracker built entirely from stock SvGrid props - no custom
   * drag code, no hand-rolled pagination. It shows how much you get for
   * free by composing the built-ins:
   *
   *   - Nested, COLLAPSIBLE column groups (Task / Details / Timeline /
   *     Progress). Each group keeps a primary column always visible and
   *     tags its secondary columns `columnGroupShow: 'open'`, so the group
   *     header grows a collapse toggle.
   *   - `showRowNumbers` + `rowDragManaged` turn the number column into a
   *     drag grip - grab a row and reorder the plan.
   *   - Status / Priority / Assignee are `editorType: 'list'` dropdowns;
   *     the dates are `editorType: 'date'`. Double-click any cell to edit.
   *   - A custom `cell` snippet renders the progress bar; edits to the
   *     Progress number flow straight back into the bar.
   *   - Client pagination (10 / page) via `showPagination`.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  type Status = 'Not Started' | 'In Progress' | 'In Review' | 'Completed' | 'Blocked'
  type Priority = 'Critical' | 'High' | 'Medium' | 'Low'

  type Task = {
    id: string
    name: string
    status: Status
    priority: Priority
    assignee: string
    start: string   // ISO yyyy-mm-dd
    due: string     // ISO yyyy-mm-dd
    progress: number
    description: string
  }

  // ---- Palette --------------------------------------------------------
  // Soft-tinted status pills (light fill + same-hue text), Linear-style.
  const STATUS_COLOR: Record<Status, string> = {
    'Not Started': '#64748b',
    'In Progress': '#3b82f6',
    'In Review':   '#f59e0b',
    'Completed':   '#10b981',
    'Blocked':     '#ef4444',
  }
  // Priority badges are solid, filled, white text.
  const PRIORITY_COLOR: Record<Priority, string> = {
    'Critical': '#b91c1c',
    'High':     '#2563eb',
    'Medium':   '#64748b',
    'Low':      '#0d9488',
  }

  const STATUS_OPTS: Status[] = ['Not Started', 'In Progress', 'In Review', 'Completed', 'Blocked']
  const PRIORITY_OPTS: Priority[] = ['Critical', 'High', 'Medium', 'Low']
  const ASSIGNEES = [
    'Alice Chen', 'Bob Martinez', 'Diana Park', 'Carlos Silva', 'Hannah Lee',
    'Erik Johansson', 'Fatima Al-Hassan', 'George Thompson', 'Priya Shah', 'Sven Berg',
  ]

  // ---- Seed data (25 rows -> 3 pages at 10/page) ----------------------
  let data = $state<Task[]>([
    { id: 'PRJ-001', name: 'Design system overhaul',      status: 'In Progress', priority: 'High',     assignee: 'Alice Chen',       start: '2025-01-15', due: '2025-03-15', progress: 65,  description: 'Update all UI components to the new brand' },
    { id: 'PRJ-002', name: 'API v3 migration',            status: 'In Progress', priority: 'Critical', assignee: 'Bob Martinez',     start: '2025-02-01', due: '2025-04-30', progress: 30,  description: 'Migrate REST API to v3 with breaking changes' },
    { id: 'PRJ-003', name: 'Mobile app redesign',         status: 'Not Started', priority: 'High',     assignee: 'Diana Park',       start: '2025-03-01', due: '2025-06-30', progress: 0,   description: 'Complete redesign of the mobile experience' },
    { id: 'PRJ-004', name: 'Database optimization',       status: 'Completed',   priority: 'Critical', assignee: 'Carlos Silva',     start: '2024-11-01', due: '2025-01-31', progress: 100, description: 'Query optimization and indexing pass' },
    { id: 'PRJ-005', name: 'User onboarding flow',        status: 'In Review',   priority: 'Medium',   assignee: 'Hannah Lee',       start: '2025-01-10', due: '2025-02-28', progress: 90,  description: 'New interactive first-run walkthrough' },
    { id: 'PRJ-006', name: 'Analytics dashboard',         status: 'In Progress', priority: 'High',     assignee: 'Erik Johansson',   start: '2025-01-20', due: '2025-03-31', progress: 45,  description: 'Real-time metrics and KPI dashboards' },
    { id: 'PRJ-007', name: 'Payment gateway integration', status: 'Blocked',     priority: 'Critical', assignee: 'Fatima Al-Hassan', start: '2025-02-10', due: '2025-04-15', progress: 20,  description: 'Waiting on vendor sandbox credentials' },
    { id: 'PRJ-008', name: 'Email notification system',   status: 'Completed',   priority: 'Medium',   assignee: 'George Thompson',  start: '2024-12-01', due: '2025-02-15', progress: 100, description: 'Automated email templates and delivery' },
    { id: 'PRJ-009', name: 'Search functionality upgrade',status: 'In Progress', priority: 'High',     assignee: 'Alice Chen',       start: '2025-02-05', due: '2025-03-20', progress: 55,  description: 'Elasticsearch integration and tuning' },
    { id: 'PRJ-010', name: 'CI/CD pipeline setup',        status: 'Completed',   priority: 'High',     assignee: 'Bob Martinez',     start: '2024-10-15', due: '2025-01-10', progress: 100, description: 'Automated test and deploy pipeline' },
    { id: 'PRJ-011', name: 'Accessibility audit',         status: 'In Review',   priority: 'Medium',   assignee: 'Diana Park',       start: '2025-01-25', due: '2025-03-05', progress: 80,  description: 'WCAG 2.2 AA conformance across the app' },
    { id: 'PRJ-012', name: 'Localization (de, fr, ja)',   status: 'In Progress', priority: 'Medium',   assignee: 'Priya Shah',       start: '2025-02-12', due: '2025-04-20', progress: 40,  description: 'Translate UI strings and format locales' },
    { id: 'PRJ-013', name: 'SSO and SCIM provisioning',   status: 'Not Started', priority: 'High',     assignee: 'Sven Berg',        start: '2025-03-10', due: '2025-05-30', progress: 0,   description: 'SAML SSO plus SCIM user provisioning' },
    { id: 'PRJ-014', name: 'Billing portal v2',           status: 'In Progress', priority: 'High',     assignee: 'Carlos Silva',     start: '2025-01-08', due: '2025-03-25', progress: 70,  description: 'Self-serve invoices, tax IDs, seats' },
    { id: 'PRJ-015', name: 'Webhook reliability',         status: 'In Review',   priority: 'Medium',   assignee: 'Erik Johansson',   start: '2025-01-18', due: '2025-02-27', progress: 85,  description: 'Retry queues and DLQ visibility' },
    { id: 'PRJ-016', name: 'Data warehouse migration',    status: 'Blocked',     priority: 'Critical', assignee: 'Hannah Lee',       start: '2025-02-20', due: '2025-05-15', progress: 15,  description: 'Blocked on network security review' },
    { id: 'PRJ-017', name: 'Security posture review',     status: 'Not Started', priority: 'Low',      assignee: 'Fatima Al-Hassan', start: '2025-04-01', due: '2025-05-20', progress: 0,   description: 'Quarterly SOC 2 posture assessment' },
    { id: 'PRJ-018', name: 'Marketing site replatform',   status: 'In Progress', priority: 'High',     assignee: 'George Thompson',  start: '2025-01-22', due: '2025-04-10', progress: 50,  description: 'Move site to new CMS and edge stack' },
    { id: 'PRJ-019', name: 'Push notification revamp',    status: 'Completed',   priority: 'Medium',   assignee: 'Diana Park',       start: '2024-11-20', due: '2025-01-30', progress: 100, description: 'APNs and FCM reliability fixes' },
    { id: 'PRJ-020', name: 'Feature flag platform',       status: 'In Progress', priority: 'Medium',   assignee: 'Alice Chen',       start: '2025-02-03', due: '2025-04-05', progress: 35,  description: 'Gradual rollout and targeting rules' },
    { id: 'PRJ-021', name: 'Customer health scoring',     status: 'In Review',   priority: 'High',     assignee: 'Priya Shah',       start: '2025-01-14', due: '2025-03-12', progress: 75,  description: 'Churn-risk model and CS dashboards' },
    { id: 'PRJ-022', name: 'Offline mode for field app',  status: 'Not Started', priority: 'Medium',   assignee: 'Sven Berg',        start: '2025-03-15', due: '2025-06-15', progress: 0,   description: 'Local-first sync and conflict handling' },
    { id: 'PRJ-023', name: 'Cost monitoring alerts',      status: 'In Progress', priority: 'Low',      assignee: 'Bob Martinez',     start: '2025-02-08', due: '2025-03-18', progress: 60,  description: 'Cloud spend anomaly detection' },
    { id: 'PRJ-024', name: 'GraphQL federation',          status: 'Blocked',     priority: 'High',     assignee: 'Carlos Silva',     start: '2025-02-25', due: '2025-05-01', progress: 25,  description: 'Blocked on subgraph schema alignment' },
    { id: 'PRJ-025', name: 'Docs and API reference',      status: 'In Progress', priority: 'Low',      assignee: 'Erik Johansson',   start: '2025-01-30', due: '2025-03-28', progress: 48,  description: 'Auto-generated reference plus guides' },
  ])

  const features = tableFeatures({
    rowSortingFeature, columnFilteringFeature, columnGroupingFeature,
  })

  const dateFmt = { type: 'date', pattern: 'y-m-d' } as const

  // ---- Columns: four collapsible groups -------------------------------
  const columns: ColumnDef<typeof features, Task>[] = [
    {
      id: 'g-task', header: 'Task', openByDefault: true,
      columns: [
        { field: 'id', header: 'ID', width: 100, editable: false, columnGroupShow: 'open' },
        {
          field: 'name', header: 'Task Name', width: 210, editorType: 'text',
          cell: (ctx) => renderSnippet(NameCell, { row: ctx.row.original }),
        },
      ],
    },
    {
      id: 'g-details', header: 'Details', openByDefault: true,
      columns: [
        {
          field: 'status', header: 'Status', width: 140,
          editorType: 'list', editorOptions: STATUS_OPTS,
          cell: (ctx) => renderSnippet(StatusCell, { value: ctx.row.original.status }),
        },
        {
          field: 'priority', header: 'Priority', width: 130, columnGroupShow: 'open',
          editorType: 'list', editorOptions: PRIORITY_OPTS,
          cell: (ctx) => renderSnippet(PriorityCell, { value: ctx.row.original.priority }),
        },
        {
          field: 'assignee', header: 'Assignee', width: 160, columnGroupShow: 'open',
          editorType: 'list', editorOptions: ASSIGNEES,
          cell: (ctx) => renderSnippet(AssigneeCell, { value: ctx.row.original.assignee }),
        },
      ],
    },
    {
      id: 'g-timeline', header: 'Timeline', openByDefault: true,
      columns: [
        { field: 'due', header: 'Due Date', width: 130, editorType: 'date', format: dateFmt },
        { field: 'start', header: 'Start Date', width: 130, editorType: 'date', format: dateFmt, columnGroupShow: 'open' },
      ],
    },
    {
      id: 'g-progress', header: 'Progress', openByDefault: true,
      columns: [
        {
          field: 'progress', header: 'Progress', width: 170, editorType: 'number',
          cell: (ctx) => renderSnippet(ProgressCell, { row: ctx.row.original }),
        },
        { field: 'description', header: 'Description', width: 240, editorType: 'text', columnGroupShow: 'open' },
      ],
    },
  ]

  function progressColor(row: Task): string {
    if (row.status === 'Completed' || row.progress >= 100) return '#16a34a'
    if (row.status === 'Blocked') return '#ef4444'
    if (row.progress >= 60) return '#2563eb'
    if (row.progress >= 25) return '#f59e0b'
    if (row.progress <= 0) return '#cbd5e1'
    return '#f59e0b'
  }
</script>

{#snippet NameCell({ row }: { row: Task })}
  <span class="pm-name">{row.name}</span>
{/snippet}

{#snippet StatusCell({ value }: { value: Status })}
  <span class="pm-cell-flex">
    <span class="pm-pill" style:--c={STATUS_COLOR[value]}>{value}</span>
    <span class="pm-caret" aria-hidden="true">▾</span>
  </span>
{/snippet}

{#snippet PriorityCell({ value }: { value: Priority })}
  <span class="pm-cell-flex">
    <span class="pm-badge" style:background={PRIORITY_COLOR[value]}>{value}</span>
    <span class="pm-caret" aria-hidden="true">▾</span>
  </span>
{/snippet}

{#snippet AssigneeCell({ value }: { value: string })}
  <span class="pm-cell-flex">
    <span class="pm-assignee">{value}</span>
    <span class="pm-caret" aria-hidden="true">▾</span>
  </span>
{/snippet}

{#snippet ProgressCell({ row }: { row: Task })}
  <div class="pm-progress">
    <div class="pm-progress-track">
      <div class="pm-progress-fill" style:width={Math.min(100, Math.max(0, row.progress)) + '%'} style:background={progressColor(row)}></div>
    </div>
    <span class="pm-progress-text">{row.progress}%</span>
  </div>
{/snippet}

<section class="pm-shell">
  <header class="pm-head">
    <h1 class="pm-title">Project Management</h1>
    <p class="pm-sub">
      Project tracker with date cells, status/priority dropdowns, custom progress bar renderer, nested headers, and drag-to-reorder rows.
    </p>
  </header>

  <div class="pm-grid-wrap">
    <SvGrid responsive={true}
      data={data}
      columns={columns}
      features={features}
      selectionMode="none"
      showRowNumbers={true}
      rowNumberWidth={48}
      rowDragManaged={true}
      enableInlineEditing={true}
      enableCellSelection={false}
      showPagination={true}
      pageSize={10}
      pageSizeOptions={[10, 25, 50]}
      rowHeight={44}
      containerHeight="100%"
      fitColumns={false}
    />
  </div>
</section>

<style>
  .pm-shell {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
    min-height: 0;
    color: var(--sg-fg, #0f172a);
  }
  .pm-head { flex-shrink: 0; }
  .pm-title {
    margin: 0 0 2px;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  .pm-sub {
    margin: 0;
    font-size: 12.5px;
    color: var(--sg-muted, #64748b);
  }
  .pm-grid-wrap {
    flex: 1;
    min-height: 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--sg-border, #e2e8f0);
  }

  /* Task name */
  :global(.pm-name) {
    font-weight: 600;
    color: var(--sg-fg, #0f172a);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Flex wrapper so the dropdown caret hugs the right edge */
  :global(.pm-cell-flex) {
    display: flex;
    align-items: center;
    width: 100%;
    min-width: 0;
    height: 100%;
  }

  /* Status pill (soft tint) */
  :global(.pm-pill) {
    --c: #64748b;
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 600;
    background: color-mix(in srgb, var(--c) 14%, transparent);
    color: var(--c);
    white-space: nowrap;
  }

  /* Priority badge (solid fill) */
  :global(.pm-badge) {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
    letter-spacing: 0.01em;
  }

  :global(.pm-assignee) {
    font-size: 12.5px;
    color: var(--sg-fg, #0f172a);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Trailing dropdown caret, right-aligned to hint the list editor */
  :global(.pm-caret) {
    margin-left: auto;
    padding-left: 6px;
    font-size: 9px;
    color: var(--sg-muted, #94a3b8);
    flex-shrink: 0;
  }

  /* Progress bar */
  :global(.pm-progress) {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 100%;
    min-width: 0;
  }
  :global(.pm-progress-track) {
    flex: 1;
    height: 8px;
    background: var(--sg-header-bg, #eef2f6);
    border-radius: 999px;
    overflow: hidden;
  }
  :global(.pm-progress-fill) {
    height: 100%;
    border-radius: 999px;
    transition: width 200ms ease;
  }
  :global(.pm-progress-text) {
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--sg-muted, #64748b);
    min-width: 34px;
    text-align: right;
  }
</style>
