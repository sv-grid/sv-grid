<script lang="ts">
  /**
   * 723. SvGrid Base: a million records
   * ------------------------------------
   * An orders table of 1,000,000 records on `baseSource(ds, { serverRows: true })`.
   * Every view reads all million, each its own way, and each request carries
   * the view's filter, sort and groups:
   *
   *   - All orders: scroll to the bottom; blocks load as they come on screen.
   *   - Big EU orders: a view filter (Region is EU, Amount over 4,000) the
   *     server runs over the million, not over the loaded rows.
   *   - By status: grouped on the server, one row per status with its count;
   *     open one and its orders load.
   *   - Board: each lane its true size, its cards read as they scroll by.
   *   - Calendar: the dates on screen; a busy day's first orders, its count,
   *     and "+N more" lists the rest.
   *   - Timeline: a Gantt by date, the rows in sight read as they scroll.
   *   - Gallery, List, Inbox: only the records in sight are drawn and read.
   *   - Revenue by month, Dashboard: the server adds up, over every order.
   *
   * Customers is a table of 200 records: each one's orders and revenue are a
   * count and a rollup over the million, from one grouped request. Returns
   * links to single orders, read by id; its picker searches all of them.
   *
   * Edit a cell, add an order with "+", or delete one from the row menu: each
   * write goes to the server by id. Tax is a formula, worked out in the page
   * for the rows on screen.
   *
   * The "server" (shared/base-million.ts) keeps the orders in typed arrays and
   * answers with the base's own filter engine, as a Node backend would with
   * `queryRecords` or a SQL one with `fieldFilterToSql`.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, baseSource, type BaseTable } from '@svgrid/enterprise/base'
  import { enableGanttView, enableSelectionBar } from '@svgrid/enterprise'
  import { usePeople } from '../shared/base-people'
  import { createMillionOrders, customerRows, REGIONS, STATUSES } from '../shared/base-million'

  enableBase()
  enableGanttView()
  enableSelectionBar()
  usePeople()

  const COLORS = ['#2d7ff9', '#20c933', '#fcb400', '#8b46ff', '#f82b60']
  const options = (values: string[]) => values.map((value, i) => ({ value, color: COLORS[i % COLORS.length] }))
  const orders = createMillionOrders()

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'orders',
      name: 'Orders',
      primaryField: 'order',
      data: [],
      source: baseSource(orders, { serverRows: { blockSize: 200 }, links: { account: { column: 'account' } }, computes: (def) => def.field === 'tax', addField: async () => {} }),
      columns: [
        { field: 'order', header: 'Order', width: 130, fieldType: 'text' },
        { field: 'account', header: 'Customer', width: 200, fieldType: 'link', fieldProps: { table: 'customers', multiple: false, inverse: 'orders' } },
        { field: 'tier', header: 'Tier', width: 90, fieldType: 'lookup', fieldProps: { linkField: 'account', field: 'tier' } },
        { field: 'status', header: 'Status', width: 120, fieldType: 'singleSelect', fieldProps: { options: options(STATUSES) } },
        { field: 'region', header: 'Region', width: 140, fieldType: 'singleSelect', fieldProps: { options: options(REGIONS) } },
        { field: 'amount', header: 'Amount', width: 120, fieldType: 'currency', fieldProps: { precision: 2 } },
        { field: 'tax', header: 'Tax', width: 110, fieldType: 'formula', fieldProps: { formula: '{Amount} * 0.2', result: 'currency', precision: 2 } },
        { field: 'date', header: 'Ordered', width: 130, fieldType: 'date' },
        { field: 'owner', header: 'Owner', width: 150, fieldType: 'user' },
      ],
      views: [
        { id: 'all', name: 'All orders', type: 'grid' },
        {
          id: 'big-eu',
          name: 'Big EU orders',
          type: 'grid',
          state: {
            sorting: [{ id: 'amount', desc: true }],
            advancedFilter: {
              kind: 'fieldFilter',
              conjunction: 'and',
              conditions: [
                { column: 'region', kind: 'select', op: 'is', value: 'EU' },
                { column: 'amount', kind: 'number', op: 'gt', value: 4000 },
              ],
            },
          },
        },
        { id: 'by-status', name: 'By status', type: 'grid', state: { grouping: ['status'] } },
        { id: 'board', name: 'Board', type: 'kanban', stackBy: 'status' },
        { id: 'calendar', name: 'Calendar', type: 'calendar', dateField: 'date' },
        { id: 'timeline', name: 'Timeline', type: 'gantt', dateField: 'date' },
        { id: 'gallery', name: 'Gallery', type: 'gallery' },
        { id: 'list', name: 'List', type: 'list' },
        { id: 'list-region', name: 'List by region', type: 'list', state: { grouping: ['region'] } },
        { id: 'inbox', name: 'Inbox', type: 'inbox', inboxDateField: 'date' },
        { id: 'revenue', name: 'Revenue by month', type: 'chart', chart: { kind: 'bar', x: 'date', y: 'amount' } },
        {
          id: 'dashboard',
          name: 'Dashboard',
          type: 'dashboard',
          dashboard: [
            { id: 'orders', kind: 'number', title: 'Orders' },
            { id: 'revenue', kind: 'number', title: 'Revenue', aggregation: 'sum', field: 'amount' },
            { id: 'average', kind: 'number', title: 'Average order', aggregation: 'avg', field: 'amount' },
            {
              id: 'shipped',
              kind: 'progress',
              title: 'Shipped',
              filter: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'status', kind: 'select', op: 'is', value: 'Shipped' }] },
            },
            { id: 'by-region', kind: 'chart', title: 'Revenue by region', chart: { kind: 'bar', x: 'region', y: 'amount' } },
            { id: 'biggest', kind: 'list', title: 'Biggest orders', sortBy: 'amount', sortDesc: true, limit: 6 },
          ],
        },
      ],
    },
    {
      id: 'customers',
      name: 'Customers',
      primaryField: 'name',
      data: customerRows(),
      columns: [
        { field: 'name', header: 'Customer', width: 220, fieldType: 'text' },
        { field: 'tier', header: 'Tier', width: 110, fieldType: 'singleSelect', fieldProps: { options: options(['Gold', 'Silver', 'Bronze']) } },
        { field: 'orders', header: 'Orders', width: 300, fieldType: 'link', fieldProps: { table: 'orders', multiple: true, inverse: 'account' } },
        { field: 'orderCount', header: 'Order count', width: 150, fieldType: 'count', fieldProps: { linkField: 'orders' } },
        { field: 'revenue', header: 'Revenue', width: 150, fieldType: 'rollup', fieldProps: { linkField: 'orders', field: 'amount', aggregation: 'SUM' } },
      ],
      views: [{ id: 'all', name: 'All customers', type: 'grid' }],
    },
    {
      id: 'returns',
      name: 'Returns',
      primaryField: 'reason',
      data: ['Damaged in transit', 'Wrong size', 'Arrived late', 'Changed mind', 'Duplicate order'].map((reason, i) => ({ id: `r${i}`, reason, order: [`o${i * 199_999 + 7}`] })),
      columns: [
        { field: 'reason', header: 'Reason', width: 220, fieldType: 'text' },
        { field: 'order', header: 'Order', width: 160, fieldType: 'link', fieldProps: { table: 'orders', multiple: false } },
        { field: 'amount', header: 'Amount', width: 130, fieldType: 'lookup', fieldProps: { linkField: 'order', field: 'amount' } },
        { field: 'status', header: 'Order status', width: 160, fieldType: 'lookup', fieldProps: { linkField: 'order', field: 'status' } },
      ],
      views: [{ id: 'all', name: 'All returns', type: 'grid' }],
    },
  ])
</script>

<section class="base-demo">
  <p class="base-demo-tip">
    1,000,000 orders, and everything reads all of them: pick <strong>Board</strong> or <strong>Dashboard</strong> from
    the view menu, see each customer's revenue in <strong>Customers</strong>, or search for SO-777777.
  </p>
  <SvBase bind:tables editable sortable showRowNumbers showRowSelection={false} expandRows rowNumberWidth={84} containerHeight="100%" fieldMenu selectionBar={{ actions: ['editFields', 'deleteRows'] }} />
  <SvToaster />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; gap: 10px; }
  .base-demo-tip { margin: 0; font-size: 13px; line-height: 1.5; color: var(--sg-muted, #64748b); }
</style>
