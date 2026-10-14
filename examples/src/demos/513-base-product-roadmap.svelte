<script lang="ts">
  /**
   * 513. SvGrid Base: product roadmap
   * ---------------------------------
   * A product team's roadmap as a ready-to-use base with two tables.
   * Features have a quarter, status, teams, lead, impact, effort, dates and
   * customer votes. Feedback holds what customers asked for, each request
   * linked to the feature it is about; a feature lists its requests and
   * counts them.
   *
   * The Features views: the roadmap grouped by quarter (each group showing
   * its count, total effort in days and votes), the status board, a timeline
   * calendar from start to target date, the "Now" view filtered to work in
   * progress, and the form anyone can use to request a feature.
   */
  import { SvBase, enableBase, type BaseTable } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  type Feature = {
    id: number
    feature: string
    quarter: string
    status: string
    teams: string[]
    lead: string
    impact: number
    effort: number
    start: string
    target: string
    votes: number
    spec: string
    requests?: string[]
  }

  const QUARTERS = [
    { value: 'Q4 2026', color: '#2d7ff9' },
    { value: 'Q1 2027', color: '#18bfff' },
    { value: 'Q2 2027', color: '#20d9d2' },
    { value: 'Later', color: '#94a3b8' },
  ]
  const STATUS = [
    { value: 'Planned', color: '#94a3b8' },
    { value: 'In progress', color: '#2d7ff9' },
    { value: 'In beta', color: '#8b46ff' },
    { value: 'Shipped', color: '#20c933' },
    { value: 'Blocked', color: '#f82b60' },
  ]
  const TEAMS = [
    { value: 'Web', color: '#2d7ff9' },
    { value: 'Mobile', color: '#ff6f2c' },
    { value: 'Platform', color: '#8b46ff' },
    { value: 'Data', color: '#20c933' },
    { value: 'Design', color: '#ff08c2' },
  ]
  const FEATURES = [
    'Single sign-on with SAML',
    'Offline mode for the mobile app',
    'Audit log export',
    'Dark mode',
    'Bulk edit from the selection bar',
    'Two-factor recovery codes',
    'Usage-based billing',
    'Public API v2',
    'Shared views with permissions',
    'In-app onboarding checklist',
    'Data retention policies',
    'Webhooks with retries',
    'Comments and mentions',
    'Faster search index',
    'Custom domains',
    'Accessibility audit fixes',
    'Templates gallery',
    'Workspace analytics',
    'Slack notifications',
    'Calendar sync',
  ]
  const day = (n: number) => new Date(Date.UTC(2026, 9, 1 + n)).toISOString().slice(0, 10)
  let nextId = FEATURES.length + 1
  const features: Feature[] = FEATURES.map((feature, i) => {
    const q = Math.min(3, Math.floor(i / 5))
    const start = q * 30 + ((i * 7) % 20)
    const status = q === 0 ? STATUS[[1, 3, 2, 1, 4][i % 5]!]!.value : q === 1 ? STATUS[i % 3 === 0 ? 1 : 0]!.value : 'Planned'
    return {
      id: i + 1,
      feature,
      quarter: QUARTERS[q]!.value,
      status,
      teams: [TEAMS[i % 5]!.value, ...(i % 3 === 1 ? [TEAMS[(i + 2) % 5]!.value] : [])],
      lead: ['u2', 'u3', 'u4', 'u7', 'u8'][i % 5]!,
      impact: 1 + ((i * 3) % 5),
      effort: 2 + ((i * 5) % 12),
      start: day(start),
      target: day(start + 14 + ((i * 3) % 21)),
      votes: 4 + ((i * 37) % 180),
      spec: i % 3 === 0 ? `https://example.com/specs/${i + 1}` : '',
    }
  })

  // What customers asked for, each request about one feature.
  const PLANS = [
    { value: 'Free', color: '#94a3b8' },
    { value: 'Team', color: '#2d7ff9' },
    { value: 'Enterprise', color: '#8b46ff' },
  ]
  const ASKS: Array<[string, string, number, number]> = [
    ['We need SAML before security signs off', 'Contoso', 2, 0],
    ['Field techs lose signal in basements', 'Northwind Traders', 1, 1],
    ['Auditors want a CSV of every change', 'Litware', 2, 2],
    ['Please add dark mode, the night shift asks daily', 'Tailspin Toys', 0, 3],
    ['Editing 200 rows one by one takes an hour', 'Fabrikam', 1, 4],
    ['Bill us by seats used, not seats bought', 'Adventure Works', 2, 6],
    ['Our integration needs API v2 webhooks', 'Wide World Importers', 2, 7],
    ['Share a view with a client, read-only', 'Proseware', 1, 8],
    ['New hires do not know where to start', 'Contoso', 1, 9],
    ['Retries on failed webhooks, please', 'Litware', 2, 11],
    ['Mention a teammate in a comment', 'Fabrikam', 0, 12],
    ['Search is slow on large workspaces', 'Northwind Traders', 2, 13],
    ['Dark mode for presentations', 'Proseware', 0, 3],
    ['SSO with our Okta setup', 'Litware', 2, 0],
  ]
  const feedback = ASKS.map(([request, customer, plan, feature], i) => ({
    id: `f${i + 1}`,
    request,
    customer,
    plan: PLANS[plan]!.value,
    received: day(i * 2),
    feature: [String(feature + 1)],
  }))
  for (const f of features) f.requests = feedback.filter((r) => r.feature[0] === String(f.id)).map((r) => r.id)

  const featureColumns: any[] = [
    { field: 'feature', header: 'Feature', width: 280, fieldType: 'text' },
    { field: 'quarter', header: 'Quarter', width: 132, fieldType: 'singleSelect', fieldProps: { options: QUARTERS } },
    { field: 'status', header: 'Status', width: 130, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
    { field: 'teams', header: 'Teams', width: 180, fieldType: 'multiSelect', fieldProps: { options: TEAMS } },
    { field: 'lead', header: 'Lead', width: 160, fieldType: 'user' },
    { field: 'impact', header: 'Impact', width: 130, fieldType: 'rating', fieldProps: { max: 5, color: '#fcb400' } },
    { field: 'effort', header: 'Effort (days)', width: 120, fieldType: 'number', fieldProps: { format: 'integer', summary: 'sum' } },
    { field: 'start', header: 'Start', width: 140, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
    { field: 'target', header: 'Target', width: 140, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
    { field: 'votes', header: 'Votes', width: 100, fieldType: 'number', fieldProps: { format: 'integer', showBar: false, summary: 'sum' } },
    { field: 'requests', header: 'Requests', width: 260, fieldType: 'link', fieldProps: { table: 'roadmap-feedback', multiple: true, inverse: 'feature' } },
    { field: 'requestCount', header: 'Asked by', width: 110, fieldType: 'count', fieldProps: { linkField: 'requests' } },
    { field: 'spec', header: 'Spec', width: 220, fieldType: 'url' },
  ]

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'roadmap-features',
      name: 'Features',
      primaryField: 'feature',
      data: features,
      columns: featureColumns,
      views: [
        { id: 'roadmap', name: 'Roadmap by quarter', type: 'grid', color: { mode: 'field', field: 'status' }, state: { grouping: ['quarter'], sorting: [{ id: 'quarter', desc: false }, { id: 'impact', desc: true }] } },
        { id: 'board', name: 'Status board', type: 'kanban', stackBy: 'status' },
        { id: 'timeline', name: 'Timeline', type: 'calendar', dateField: 'start', endField: 'target', color: { mode: 'field', field: 'status' } },
        { id: 'effort', name: 'Effort by team', type: 'chart', chart: { kind: 'barH', x: 'teams', y: 'effort' } },
        {
          id: 'now',
          name: 'Now',
          type: 'grid',
          state: {
            sorting: [{ id: 'target', desc: false }],
            advancedFilter: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'status', kind: 'select', op: 'isAnyOf', value: ['In progress', 'In beta', 'Blocked'] }] },
          },
        },
        { id: 'request', name: 'Request a feature', type: 'form', formFields: ['feature', 'teams', 'impact', 'spec'], formDescription: 'What should we build, and who is it for? Product reviews requests every Friday.' },
      ],
      props: { rowAdder: { label: 'Add feature', defaults: () => ({ id: nextId++, feature: '', status: 'Planned', quarter: 'Later', teams: [], votes: 0 }) } },
    },
    {
      id: 'roadmap-feedback',
      name: 'Feedback',
      primaryField: 'request',
      data: feedback,
      columns: [
        { field: 'request', header: 'Request', width: 340, fieldType: 'text' },
        { field: 'customer', header: 'Customer', width: 180, fieldType: 'text' },
        { field: 'plan', header: 'Plan', width: 120, fieldType: 'singleSelect', fieldProps: { options: PLANS } },
        { field: 'feature', header: 'Feature', width: 240, fieldType: 'link', fieldProps: { table: 'roadmap-features', multiple: false, inverse: 'requests' } },
        { field: 'received', header: 'Received', width: 150, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
      ],
      views: [
        { id: 'all', name: 'All feedback', type: 'grid', state: { sorting: [{ id: 'received', desc: true }] } },
        { id: 'by-plan', name: 'By plan', type: 'kanban', stackBy: 'plan' },
      ],
      props: { rowAdder: { label: 'Add request' } },
    },
  ])
</script>

<section class="base-demo">
  <SvBase
    bind:tables
    editable
    sortable
    showRowNumbers
    expandRows
    pinSplitter
    summary
    rowNumberWidth={64}
    showRowSelection={false}
    rowHeight={40}
    containerHeight="100%"
    selectionBar={['selectAll', 'editFields', 'deleteRows']}
    columnAdder
    fieldMenu
  />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; }
</style>
