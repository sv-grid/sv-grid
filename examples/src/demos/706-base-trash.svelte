<script lang="ts">
  /**
   * 706. SvGrid Base: trash and restore
   * -----------------------------------
   * Deleted records, fields and tables go to the trash, not away. The trash
   * button at the end of the tab bar says how many items it holds; it lists
   * them newest first with who deleted them and when, and Restore puts one
   * back: a record in its table at the place it had, with its links; a field
   * with its values; a table as a tab. Items stay 30 days (`trashDays`).
   *
   * The trash is plain data (`bind:trash`), so an app stores it with the
   * tables. This one starts with three items other people deleted earlier:
   * a deal, a field and a whole table. Delete something yourself, then use
   * Restore in the notice, or open the trash.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, type BaseTable, type BaseTrashItem } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  const ago = (days: number, hours = 0) => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString()
  const STAGE = [
    { value: 'Lead', color: '#94a3b8' },
    { value: 'Qualified', color: '#2d7ff9' },
    { value: 'Proposal', color: '#8b46ff' },
    { value: 'Won', color: '#20c933' },
    { value: 'Lost', color: '#f82b60' },
  ]
  const DEALS: Array<[string, string, string, number, string]> = [
    ['Northwind renewal', 'a1', 'Proposal', 48000, 'u2'],
    ['Contoso pilot', 'a2', 'Qualified', 12000, 'u1'],
    ['Fabrikam expansion', 'a3', 'Won', 96000, 'u4'],
    ['Litware onboarding', 'a4', 'Lead', 8000, 'u3'],
    ['Northwind support plan', 'a1', 'Lead', 6000, 'u2'],
  ]
  const deals = DEALS.map(([deal, account, stage, amount, owner], i) => ({ id: `d${i + 1}`, deal, account: [account], stage, amount, owner, region: ['EMEA', 'NA', 'NA', 'APAC', 'EMEA'][i] }))
  const accounts = [
    { id: 'a1', name: 'Northwind Traders', industry: 'Retail' },
    { id: 'a2', name: 'Contoso', industry: 'Manufacturing' },
    { id: 'a3', name: 'Fabrikam', industry: 'Finance' },
    { id: 'a4', name: 'Litware', industry: 'Software' },
  ].map((a) => ({ ...a, deals: deals.filter((d) => d.account[0] === a.id).map((d) => d.id) }))

  const dealColumns = [
    { field: 'deal', header: 'Deal', width: 240, fieldType: 'text' },
    { field: 'account', header: 'Account', width: 200, fieldType: 'link', fieldProps: { table: 'trash-accounts', multiple: false, inverse: 'deals' } },
    { field: 'stage', header: 'Stage', width: 130, fieldType: 'singleSelect', fieldProps: { options: STAGE } },
    { field: 'amount', header: 'Amount', width: 130, fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', precision: 0 } },
    { field: 'owner', header: 'Owner', width: 160, fieldType: 'user' },
  ]

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'trash-deals',
      name: 'Deals',
      primaryField: 'deal',
      data: deals,
      columns: dealColumns,
      views: [{ id: 'pipeline', name: 'Pipeline', type: 'grid', color: { mode: 'field', field: 'stage' } }],
      props: { rowAdder: { label: 'Add deal', defaults: () => ({ stage: 'Lead' }) } },
    },
    {
      id: 'trash-accounts',
      name: 'Accounts',
      primaryField: 'name',
      data: accounts,
      columns: [
        { field: 'name', header: 'Account', width: 220, fieldType: 'text' },
        { field: 'industry', header: 'Industry', width: 150, fieldType: 'text' },
        { field: 'deals', header: 'Deals', width: 320, fieldType: 'link', fieldProps: { table: 'trash-deals', multiple: true, inverse: 'account' } },
      ],
      views: [{ id: 'all', name: 'All accounts', type: 'grid' }],
    },
  ])

  // What other people deleted before you opened the base.
  let trash = $state<BaseTrashItem[]>([
    {
      id: 'seed-deal',
      kind: 'record',
      table: 'trash-deals',
      index: 2,
      row: { id: 'd9', deal: 'Adventure Works trial', account: [], stage: 'Lost', amount: 4000, owner: 'u5', region: 'NA' },
      deletedAt: ago(0, 3),
      deletedBy: 'u5',
    },
    {
      id: 'seed-field',
      kind: 'field',
      table: 'trash-deals',
      index: 5,
      column: { field: 'region', header: 'Region', width: 120, fieldType: 'singleSelect', fieldProps: { options: [{ value: 'EMEA', color: '#2d7ff9' }, { value: 'NA', color: '#20c933' }, { value: 'APAC', color: '#ff6f2c' }] } },
      deletedAt: ago(1, 2),
      deletedBy: 'u2',
    },
    {
      id: 'seed-table',
      kind: 'table',
      index: 2,
      table: {
        id: 'trash-leads',
        name: 'Old leads',
        primaryField: 'name',
        columns: [
          { field: 'name', header: 'Lead', width: 220, fieldType: 'text' },
          { field: 'source', header: 'Source', width: 140, fieldType: 'text' },
          { field: 'email', header: 'Email', width: 220, fieldType: 'email' },
        ],
        data: [
          { id: 'l1', name: 'Tailspin Toys', source: 'Webinar', email: 'buyers@tailspin.example' },
          { id: 'l2', name: 'Wide World Importers', source: 'Referral', email: 'ops@wwi.example' },
          { id: 'l3', name: 'Proseware', source: 'Trade show', email: 'hello@proseware.example' },
        ],
        views: [{ id: 'all', name: 'All leads', type: 'grid' }],
      },
      deletedAt: ago(5),
      deletedBy: 'u4',
    },
  ])
</script>

<section class="base-demo">
  <p class="base-demo-tip">
    The trash at the top right holds {trash.length} {trash.length === 1 ? 'item' : 'items'}. Open it to restore the deal, the Region field or the Old leads table, or delete
    a deal yourself (right-click, Delete record) and press Restore in the notice.
  </p>
  <SvBase
    bind:tables
    bind:trash
    editable
    sortable
    showRowNumbers
    expandRows
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
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; gap: 10px; }
  .base-demo-tip { margin: 0; font-size: 13px; line-height: 1.5; color: var(--sg-muted, #64748b); }
</style>
