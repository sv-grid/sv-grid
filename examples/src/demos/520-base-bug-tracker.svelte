<script lang="ts">
  /**
   * 520. SvGrid Base: bug tracker
   * -----------------------------
   * A team's bugs and releases as a ready-to-use base. Each bug has a
   * severity, a status, the areas it touches, who reported it and who is on
   * it, the release it ships in, the steps to reproduce, and when it was
   * reported and fixed. Each release lists its bugs and how many are open.
   *
   * Views: the triage list grouped by status, the board by status (drag a
   * card to move it on), what is critical now, bugs by area as a chart, and
   * the "Report a bug" form.
   *
   * Automations ("4 automations" in the view bar):
   *  - a critical bug that is not fixed turns its row red and raises a notice;
   *  - setting Status to Fixed stamps "Fixed on" with today;
   *  - a bug sent with the form starts as New and announces itself;
   *  - "Start" in the Fix column moves a bug to In progress.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, type BaseAutomation, type BaseTable } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  /** A 'YYYY-MM-DD' this many days from today, so the base stays current. */
  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const SEVERITY = [
    { value: 'Critical', color: '#f82b60' },
    { value: 'High', color: '#ff6f2c' },
    { value: 'Medium', color: '#fcb400' },
    { value: 'Low', color: '#94a3b8' },
  ]
  const STATUS = [
    { value: 'New', color: '#8b46ff' },
    { value: 'Triaged', color: '#18bfff' },
    { value: 'In progress', color: '#2d7ff9' },
    { value: 'Fixed', color: '#20c933' },
    { value: "Won't fix", color: '#666666' },
  ]
  const AREAS = [
    { value: 'UI', color: '#2d7ff9' },
    { value: 'API', color: '#8b46ff' },
    { value: 'Data', color: '#20d9d2' },
    { value: 'Auth', color: '#ff6f2c' },
    { value: 'Billing', color: '#20c933' },
  ]

  // [bug, severity, status, areas, reporter, assignee, release, reported (days ago), fixed (days ago or null), steps]
  const BUGS: Array<[string, string, string, string[], string, string, string, number, number | null, string]> = [
    ['Checkout button does nothing on Safari 17', 'Critical', 'In progress', ['UI', 'Billing'], 'u5', 'u2', 'r2', 3, null, '1. Add an item\n2. Open the cart in Safari 17\n3. Press Checkout'],
    ['Invoices show last month\'s tax rate', 'High', 'Triaged', ['Billing', 'Data'], 'u6', 'u4', 'r2', 5, null, 'Create an invoice dated the 1st of a month.'],
    ['Sign-in link expires after 1 minute', 'High', 'Fixed', ['Auth'], 'u7', 'u3', 'r1', 14, 9, 'Request a sign-in link and wait 70 seconds.'],
    ['Dark mode: table header unreadable', 'Medium', 'Fixed', ['UI'], 'u8', 'u1', 'r1', 20, 16, 'Turn on dark mode, open Reports.'],
    ['Export to CSV drops the last row', 'Critical', 'New', ['Data'], 'u5', '', 'r2', 1, null, 'Export any report with more than 1,000 rows.'],
    ['API returns 500 on empty filter', 'Medium', 'In progress', ['API'], 'u6', 'u2', 'r2', 4, null, 'GET /api/orders?status='],
    ['Avatar upload hangs at 99%', 'Low', 'Triaged', ['UI'], 'u7', 'u1', 'r3', 8, null, 'Upload a PNG over 5 MB.'],
    ['Webhook retries flood the log', 'Medium', 'New', ['API', 'Data'], 'u8', '', 'r3', 2, null, 'Point a webhook at a URL that answers 503.'],
    ['Password rules not shown on sign-up', 'Low', "Won't fix", ['Auth', 'UI'], 'u5', 'u3', 'r1', 30, null, 'Open the sign-up page.'],
    ['Refund marks the order paid twice', 'High', 'Fixed', ['Billing'], 'u6', 'u4', 'r1', 18, 12, 'Refund part of an order.'],
  ]
  const RELEASES = [
    { id: 'r1', version: '2.4', ships: day(-7), notes: 'Billing fixes and dark mode.' },
    { id: 'r2', version: '2.5', ships: day(10), notes: 'Checkout and exports.' },
    { id: 'r3', version: '2.6', ships: day(31), notes: 'API polish.' },
  ]

  let nextId = BUGS.length + 1
  const bugs = BUGS.map(([bug, severity, status, areas, reporter, assignee, release, reported, fixed, steps], i) => ({
    id: i + 1,
    bug,
    severity,
    status,
    areas,
    reporter,
    assignee,
    release: [release],
    reported: day(-reported),
    fixedOn: fixed == null ? null : day(-fixed),
    steps,
  }))
  const releases = RELEASES.map((r) => ({ ...r, bugs: bugs.filter((b) => b.release[0] === r.id).map((b) => String(b.id)) }))

  const notFixed = { column: 'status', kind: 'select', op: 'isNoneOf', value: ['Fixed', "Won't fix"] } as const
  const automations: BaseAutomation[] = [
    {
      id: 'critical',
      name: 'Critical bug',
      enabled: true,
      trigger: { type: 'recordMatches' },
      condition: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'severity', kind: 'select', op: 'is', value: 'Critical' }, notFixed] },
      actions: [
        { type: 'highlight', background: '#fee2e2', color: '#991b1b' },
        { type: 'notify', message: 'Critical: {Bug} ({Assignee})', severity: 'error' },
      ],
    },
    {
      id: 'fixed',
      name: 'Stamp the fix date',
      enabled: true,
      trigger: { type: 'recordUpdated', fields: ['status'] },
      condition: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'status', kind: 'select', op: 'is', value: 'Fixed' }] },
      actions: [{ type: 'updateRecord', values: { fixedOn: 'today' } }],
    },
    {
      id: 'reported',
      name: 'New report',
      enabled: true,
      trigger: { type: 'formSubmitted', view: 'report' },
      actions: [
        { type: 'updateRecord', values: { status: 'New', reported: 'today' } },
        { type: 'notify', message: 'New bug: {Bug}', severity: 'warning' },
      ],
    },
    {
      id: 'start',
      name: 'Start fixing',
      enabled: true,
      trigger: { type: 'button', field: 'fix' },
      actions: [{ type: 'updateRecord', values: { status: 'In progress' } }],
    },
  ]

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'bugs-bugs',
      name: 'Bugs',
      primaryField: 'bug',
      data: bugs,
      columns: [
        { field: 'bug', header: 'Bug', width: 280, fieldType: 'text' },
        { field: 'severity', header: 'Severity', width: 120, fieldType: 'singleSelect', fieldProps: { options: SEVERITY } },
        { field: 'status', header: 'Status', width: 130, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
        { field: 'fix', header: 'Fix', width: 96, fieldType: 'button', fieldProps: { label: 'Start', color: '#2d7ff9' } },
        { field: 'areas', header: 'Areas', width: 170, fieldType: 'multiSelect', fieldProps: { options: AREAS } },
        { field: 'assignee', header: 'Assignee', width: 160, fieldType: 'user' },
        { field: 'reporter', header: 'Reported by', width: 160, fieldType: 'user' },
        { field: 'release', header: 'Release', width: 110, fieldType: 'link', fieldProps: { table: 'bugs-releases', multiple: false, inverse: 'bugs' } },
        { field: 'reported', header: 'Reported', width: 150, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'fixedOn', header: 'Fixed on', width: 150, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'steps', header: 'Steps to reproduce', width: 260, fieldType: 'longText' },
      ],
      views: [
        { id: 'triage', name: 'Triage', type: 'grid', color: { mode: 'field', field: 'severity' }, state: { grouping: ['status'], sorting: [{ id: 'severity', desc: false }] } },
        { id: 'board', name: 'Board', type: 'kanban', stackBy: 'status', color: { mode: 'field', field: 'severity' } },
        {
          id: 'critical',
          name: 'Critical now',
          type: 'grid',
          state: { advancedFilter: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'severity', kind: 'select', op: 'is', value: 'Critical' }, notFixed] } },
        },
        { id: 'areas', name: 'Bugs by area', type: 'chart', chart: { kind: 'barH', x: 'areas' } },
        { id: 'report', name: 'Report a bug', type: 'form', formFields: ['bug', 'severity', 'areas', 'reporter', 'steps'], formTitle: 'Report a bug', formDescription: 'What went wrong, and how to see it happen.' },
      ],
      automations,
      props: { rowAdder: { label: 'Add bug', defaults: () => ({ id: nextId++, status: 'New', areas: [], reported: day(0) }) } },
    },
    {
      id: 'bugs-releases',
      name: 'Releases',
      primaryField: 'version',
      data: releases,
      columns: [
        { field: 'version', header: 'Version', width: 110, fieldType: 'text' },
        { field: 'ships', header: 'Ships', width: 160, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'bugs', header: 'Bugs', width: 360, fieldType: 'link', fieldProps: { table: 'bugs-bugs', multiple: true, inverse: 'release' } },
        { field: 'count', header: 'Bug count', width: 110, fieldType: 'count', fieldProps: { linkField: 'bugs' } },
        { field: 'notes', header: 'Notes', width: 240, fieldType: 'longText' },
      ],
      views: [
        { id: 'all', name: 'All releases', type: 'grid', state: { sorting: [{ id: 'ships', desc: false }] } },
        { id: 'calendar', name: 'Release calendar', type: 'calendar', dateField: 'ships' },
      ],
      props: { rowAdder: { label: 'Add release' } },
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
    rowNumberWidth={64}
    showRowSelection={false}
    rowHeight={40}
    containerHeight="100%"
    selectionBar={['selectAll', 'editFields', 'deleteRows']}
    columnAdder
    fieldMenu
  />
  <SvToaster />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; }
</style>
