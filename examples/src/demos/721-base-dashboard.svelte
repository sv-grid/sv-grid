<script lang="ts">
  /**
   * 721. SvGrid Base: dashboard view
   * --------------------------------
   * A sales base with three tables (Deals, Accounts, Activities) and a
   * dashboard view on Deals that sums up all three. Each tile reads one
   * table with its own filter: the open pipeline and what was won as money,
   * the share of deals won, the pipeline by stage, accounts by industry,
   * the biggest open deals, and the activities due in the next seven days.
   *
   * "Edit dashboard" adds a tile (a number, a chart, a list of records or a
   * progress bar), edits or removes one, sets its size and moves it by drag
   * or with the arrows. The tiles are saved on the view, so they come back
   * with `tables`. Change a deal in the "All deals" view and the tiles
   * follow; a record in a list tile opens in its own table. Click a number
   * or progress tile, or a bar or slice of a chart, to list the records
   * behind it and open one.
   */
  import { SvBase, enableBase, type BaseTable, type FieldFilter } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  const STAGES = [
    { value: 'Lead', color: '#94a3b8' },
    { value: 'Qualified', color: '#18bfff' },
    { value: 'Proposal', color: '#2d7ff9' },
    { value: 'Negotiation', color: '#fcb400' },
    { value: 'Won', color: '#20c933' },
    { value: 'Lost', color: '#f82b60' },
  ]
  const INDUSTRIES = [
    { value: 'Wholesale', color: '#ff6f2c' },
    { value: 'Manufacturing', color: '#2d7ff9' },
    { value: 'Software', color: '#8b46ff' },
    { value: 'Retail', color: '#fcb400' },
    { value: 'Healthcare', color: '#20c933' },
  ]
  const KINDS = [
    { value: 'Call', color: '#18bfff' },
    { value: 'Email', color: '#8b46ff' },
    { value: 'Meeting', color: '#ff6f2c' },
  ]
  // Dates around today, so "due this week" always has something in it.
  const day = (n: number) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // ---- Sample records -------------------------------------------------------

  const ACCOUNTS: Array<[string, string, number]> = [
    ['Northwind Traders', 'Wholesale', 420],
    ['Contoso', 'Manufacturing', 2600],
    ['Fabrikam', 'Software', 880],
    ['Adventure Works', 'Retail', 310],
    ['Tailspin Toys', 'Retail', 140],
    ['Litware', 'Healthcare', 560],
    ['Proseware', 'Software', 95],
  ]
  const PRODUCTS = ['Platform license', 'Team plan', 'Renewal', 'Expansion', 'Pilot']
  const STAGE_OF = [0, 1, 2, 3, 4, 2, 1, 3, 0, 5, 2, 4, 1, 3, 2, 0, 4, 3, 1, 2, 5, 4]
  const deals = STAGE_OF.map((s, i) => {
    const acct = i % ACCOUNTS.length
    return {
      id: `d${i + 1}`,
      deal: `${ACCOUNTS[acct]![0]}: ${PRODUCTS[(i + Math.floor(i / ACCOUNTS.length)) % PRODUCTS.length]}`,
      account: [`a${acct + 1}`],
      stage: STAGES[s]!.value,
      owner: ['u1', 'u2', 'u4', 'u7'][i % 4]!,
      value: 8000 + ((i * 7919) % 60) * 1500,
      close: day(((i * 5) % 70) - 20),
    }
  })
  const accounts = ACCOUNTS.map(([name, industry, employees], i) => ({
    id: `a${i + 1}`,
    name,
    industry,
    employees,
    deals: deals.filter((d) => d.account[0] === `a${i + 1}`).map((d) => d.id),
  }))
  const ACTIVITIES: Array<[string, string, number, boolean]> = [
    ['Call Contoso about the security review', 'Call', 0, false],
    ['Send the Fabrikam proposal', 'Email', 1, false],
    ['Pricing call with Northwind', 'Meeting', 2, false],
    ['Demo for Litware clinical team', 'Meeting', 3, false],
    ['Follow up on the Proseware pilot', 'Email', 5, false],
    ['Renewal check-in with Adventure Works', 'Call', 6, false],
    ['Quarterly review with Tailspin', 'Meeting', 12, false],
    ['Thank-you note to Contoso', 'Email', -2, true],
    ['Kickoff call with Litware', 'Call', -5, true],
  ]
  const activities = ACTIVITIES.map(([subject, kind, due, done], i) => ({ id: `act${i + 1}`, subject, kind, owner: ['u1', 'u2', 'u4', 'u7'][i % 4]!, due: day(due), done }))

  // ---- The dashboard's filters -------------------------------------------------

  const OPEN: FieldFilter = { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'stage', kind: 'select', op: 'isNoneOf', value: ['Won', 'Lost'] }] }
  const WON: FieldFilter = { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'stage', kind: 'select', op: 'is', value: 'Won' }] }
  const DUE_THIS_WEEK: FieldFilter = {
    kind: 'fieldFilter',
    conjunction: 'and',
    conditions: [
      { column: 'due', kind: 'date', op: 'isWithin', value: { span: 'nextWeek' } },
      { column: 'done', kind: 'checkbox', op: 'is', value: false },
    ],
  }

  // ---- The base ---------------------------------------------------------------

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'dash-deals',
      name: 'Deals',
      primaryField: 'deal',
      data: deals,
      columns: [
        { id: 'deal', field: 'deal', header: 'Deal', width: 260, fieldType: 'text' },
        { id: 'account', field: 'account', header: 'Account', width: 180, fieldType: 'link', fieldProps: { table: 'dash-accounts', multiple: false, inverse: 'deals' } },
        { id: 'stage', field: 'stage', header: 'Stage', width: 130, fieldType: 'singleSelect', fieldProps: { options: STAGES } },
        { id: 'owner', field: 'owner', header: 'Owner', width: 160, fieldType: 'user' },
        { id: 'value', field: 'value', header: 'Value', width: 130, fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', precision: 0, summary: 'sum' } },
        { id: 'close', field: 'close', header: 'Close date', width: 150, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
      ],
      views: [
        {
          id: 'overview',
          name: 'Sales overview',
          type: 'dashboard',
          dashboard: [
            { id: 'pipeline', kind: 'number', title: 'Open pipeline', aggregation: 'sum', field: 'value', filter: OPEN, caption: 'Quarter target $600,000' },
            { id: 'won', kind: 'number', title: 'Won', aggregation: 'sum', field: 'value', filter: WON },
            { id: 'avg', kind: 'number', title: 'Average open deal', aggregation: 'avg', field: 'value', filter: OPEN },
            { id: 'rate', kind: 'progress', title: 'Deals won', filter: WON },
            { id: 'by-stage', kind: 'chart', title: 'Pipeline by stage', chart: { kind: 'bar', x: 'stage', y: 'value' } },
            { id: 'due', kind: 'list', title: 'Activities due this week', table: 'dash-activities', filter: DUE_THIS_WEEK, sortBy: 'due', limit: 6 },
            { id: 'industry', kind: 'chart', title: 'Accounts by industry', table: 'dash-accounts', chart: { kind: 'donut', x: 'industry' } },
            { id: 'top', kind: 'list', title: 'Biggest open deals', filter: OPEN, sortBy: 'value', sortDesc: true, limit: 6 },
          ],
        },
        { id: 'deals', name: 'All deals', type: 'grid', color: { mode: 'field', field: 'stage' }, state: { sorting: [{ id: 'value', desc: true }] } },
        { id: 'pipeline', name: 'Pipeline', type: 'kanban', stackBy: 'stage' },
      ],
      props: { rowAdder: { label: 'Add deal', defaults: () => ({ stage: 'Lead' }) } },
    },
    {
      id: 'dash-accounts',
      name: 'Accounts',
      primaryField: 'name',
      data: accounts,
      columns: [
        { id: 'name', field: 'name', header: 'Account', width: 220, fieldType: 'text' },
        { id: 'industry', field: 'industry', header: 'Industry', width: 150, fieldType: 'singleSelect', fieldProps: { options: INDUSTRIES } },
        { id: 'deals', field: 'deals', header: 'Deals', width: 280, fieldType: 'link', fieldProps: { table: 'dash-deals', multiple: true, inverse: 'account' } },
        { id: 'pipeline', field: 'pipeline', header: 'Deal value', width: 150, fieldType: 'rollup', fieldProps: { linkField: 'deals', field: 'value', aggregation: 'SUM' } },
        { id: 'employees', field: 'employees', header: 'Employees', width: 120, fieldType: 'number', fieldProps: { format: 'integer' } },
      ],
      views: [{ id: 'accounts', name: 'All accounts', type: 'grid' }],
      props: { rowAdder: { label: 'Add account' } },
    },
    {
      id: 'dash-activities',
      name: 'Activities',
      primaryField: 'subject',
      data: activities,
      columns: [
        { id: 'subject', field: 'subject', header: 'Activity', width: 300, fieldType: 'text' },
        { id: 'kind', field: 'kind', header: 'Type', width: 120, fieldType: 'singleSelect', fieldProps: { options: KINDS } },
        { id: 'owner', field: 'owner', header: 'Owner', width: 160, fieldType: 'user' },
        { id: 'due', field: 'due', header: 'Due', width: 150, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { id: 'done', field: 'done', header: 'Done', width: 90, fieldType: 'checkbox' },
      ],
      views: [{ id: 'activities', name: 'All activities', type: 'grid', state: { sorting: [{ id: 'due', desc: false }] } }],
      props: { rowAdder: { label: 'Add activity', defaults: () => ({ done: false }) } },
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
    rowNumberWidth={64}
    showRowSelection={false}
    rowHeight={40}
    containerHeight="100%"
    columnAdder
    fieldMenu
  />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 560px; height: 100%; }
</style>
