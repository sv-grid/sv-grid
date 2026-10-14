<script lang="ts">
  /**
   * 523. SvGrid Base: expense approvals
   * -----------------------------------
   * A team's expenses and budgets as a ready-to-use base. An expense has an
   * amount, a category, the date, who spent it, a receipt, a status through
   * approval to payment, and who approved it. Each budget category lists its
   * expenses, what was spent (a rollup) and what is left (a formula).
   *
   * Views: this month's expenses with totals, the approval board, spend by
   * category as a pie, receipts as a gallery, and the "Submit an expense"
   * form.
   *
   * Automations ("4 automations" in the view bar of Expenses):
   *  - an expense over $1,000 goes to Needs approval and says so;
   *  - "Approve" in the Review column approves it and records who and when;
   *  - a rejected expense turns red;
   *  - one sent with the form starts as Submitted.
   * Budgets has one more: a category over its budget raises a notice.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, type Attachment, type BaseTable } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  /** A receipt drawn here, so the demo needs no image host. */
  function receipt(name: string, total: number): Attachment {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200" viewBox="0 0 160 200"><rect width="160" height="200" fill="#fdfcf7"/><path d="M0 196 l10 -6 l10 6 l10 -6 l10 6 l10 -6 l10 6 l10 -6 l10 6 l10 -6 l10 6 l10 -6 l10 6 l10 -6 l10 6 l10 -6 l10 6 V200 H0z" fill="#e7e2d4"/><text x="80" y="34" text-anchor="middle" font-family="monospace" font-size="13" fill="#333">${name.slice(0, 18)}</text><g fill="#bbb"><rect x="20" y="56" width="90" height="6"/><rect x="20" y="72" width="70" height="6"/><rect x="20" y="88" width="100" height="6"/><rect x="20" y="104" width="60" height="6"/></g><text x="20" y="150" font-family="monospace" font-size="13" fill="#333">TOTAL</text><text x="140" y="150" text-anchor="end" font-family="monospace" font-size="13" fill="#333">$${total}</text></svg>`
    return { id: `r-${name}`, name: `${name.toLowerCase().replace(/[^a-z]+/g, '-')}.svg`, type: 'image/svg+xml', url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` }
  }

  const STATUS = [
    { value: 'Draft', color: '#94a3b8' },
    { value: 'Submitted', color: '#18bfff' },
    { value: 'Needs approval', color: '#fcb400' },
    { value: 'Approved', color: '#20c933' },
    { value: 'Rejected', color: '#f82b60' },
    { value: 'Paid', color: '#2d7ff9' },
  ]

  const budgets = [
    { id: 'b1', category: 'Travel', monthly: 6000 },
    { id: 'b2', category: 'Software', monthly: 2500 },
    { id: 'b3', category: 'Meals', monthly: 1200 },
    { id: 'b4', category: 'Equipment', monthly: 4000 },
  ]
  // [what, amount, category, days ago, spent by, status, approver]
  const ROWS: Array<[string, number, string, number, string, string, string]> = [
    ['Flight to the Lisbon summit', 642, 'b1', 3, 'u1', 'Approved', 'u4'],
    ['Hotel, 3 nights', 1180, 'b1', 3, 'u1', 'Needs approval', ''],
    ['Design tool, annual seat', 588, 'b2', 9, 'u3', 'Paid', 'u4'],
    ['Team lunch after launch', 236, 'b3', 1, 'u2', 'Submitted', ''],
    ['4K monitor', 899, 'b4', 6, 'u3', 'Approved', 'u4'],
    ['Laptop for new hire', 2340, 'b4', 2, 'u2', 'Needs approval', ''],
    ['Taxi to the airport', 54, 'b1', 4, 'u1', 'Paid', 'u4'],
    ['Error tracking, monthly', 120, 'b2', 12, 'u3', 'Paid', 'u4'],
    ['Client dinner', 312, 'b3', 5, 'u2', 'Rejected', 'u4'],
    ['Conference tickets x3', 1497, 'b1', 8, 'u1', 'Approved', 'u4'],
  ]
  let nextId = ROWS.length + 1
  const expenses = ROWS.map(([what, amount, budget, ago, spentBy, status, approver], i) => ({
    id: i + 1,
    what,
    amount,
    budget: [budget],
    date: day(-ago),
    spentBy,
    status,
    approver,
    approvedOn: approver ? day(-ago + 1) : null,
    receipt: [receipt(what, amount)],
  }))
  const withLinks = budgets.map((b) => ({ ...b, expenses: expenses.filter((e) => e.budget[0] === b.id).map((e) => String(e.id)) }))

  const statusIs = (value: string) => ({ kind: 'fieldFilter' as const, conjunction: 'and' as const, conditions: [{ column: 'status', kind: 'select' as const, op: 'is' as const, value }] })

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'exp-expenses',
      name: 'Expenses',
      primaryField: 'what',
      data: expenses,
      columns: [
        { field: 'what', header: 'Expense', width: 240, fieldType: 'text' },
        { field: 'amount', header: 'Amount', width: 120, fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', precision: 2, summary: 'sum' } },
        { field: 'budget', header: 'Category', width: 140, fieldType: 'link', fieldProps: { table: 'exp-budgets', multiple: false, inverse: 'expenses' } },
        { field: 'status', header: 'Status', width: 150, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
        { field: 'review', header: 'Review', width: 110, fieldType: 'button', fieldProps: { label: 'Approve', color: '#20c933' } },
        { field: 'date', header: 'Date', width: 150, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'spentBy', header: 'Spent by', width: 160, fieldType: 'user' },
        { field: 'receipt', header: 'Receipt', width: 100, fieldType: 'attachment', fieldProps: { accept: 'image/*,application/pdf', maxFiles: 3 } },
        { field: 'approver', header: 'Approved by', width: 160, fieldType: 'user' },
        { field: 'approvedOn', header: 'Approved on', width: 150, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
      ],
      views: [
        { id: 'month', name: 'This month', type: 'grid', color: { mode: 'field', field: 'status' }, state: { sorting: [{ id: 'date', desc: true }] } },
        { id: 'board', name: 'Approvals', type: 'kanban', stackBy: 'status' },
        { id: 'spend', name: 'Spend by category', type: 'chart', chart: { kind: 'pie', x: 'budget', y: 'amount' } },
        { id: 'receipts', name: 'Receipts', type: 'gallery', coverField: 'receipt' },
        { id: 'submit', name: 'Submit an expense', type: 'form', formFields: ['what', 'amount', 'budget', 'date', 'spentBy', 'receipt'], formTitle: 'Submit an expense', formDescription: 'Over $1,000 goes to a manager for approval.' },
      ],
      automations: [
        {
          id: 'big',
          name: 'Big expenses need approval',
          enabled: true,
          trigger: { type: 'recordMatches' },
          condition: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'amount', kind: 'number', op: 'gt', value: 1000 }, { column: 'status', kind: 'select', op: 'isAnyOf', value: ['Draft', 'Submitted'] }] },
          actions: [
            { type: 'updateRecord', values: { status: 'Needs approval' } },
            { type: 'notify', message: '{Expense} ({Amount}) needs approval', severity: 'warning' },
          ],
        },
        {
          id: 'approve',
          name: 'Approve',
          enabled: true,
          trigger: { type: 'button', field: 'review' },
          actions: [{ type: 'updateRecord', values: { status: 'Approved', approver: 'Dev Shah', approvedOn: 'today' } }, { type: 'notify', message: 'Approved: {Expense}', severity: 'success' }],
        },
        {
          id: 'rejected',
          name: 'Rejected stands out',
          enabled: true,
          trigger: { type: 'recordMatches' },
          condition: statusIs('Rejected'),
          actions: [{ type: 'highlight', fields: ['status', 'amount'], background: '#fee2e2', color: '#991b1b' }],
        },
        {
          id: 'submitted',
          name: 'Submitted with the form',
          enabled: true,
          trigger: { type: 'formSubmitted', view: 'submit' },
          actions: [{ type: 'updateRecord', values: { status: 'Submitted' } }],
        },
      ],
      props: { rowAdder: { label: 'Add expense', defaults: () => ({ id: nextId++, status: 'Draft', date: day(0), receipt: [] }) } },
    },
    {
      id: 'exp-budgets',
      name: 'Budgets',
      primaryField: 'category',
      data: withLinks,
      columns: [
        { field: 'category', header: 'Category', width: 160, fieldType: 'text' },
        { field: 'monthly', header: 'Monthly budget', width: 150, fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', precision: 0 } },
        { field: 'expenses', header: 'Expenses', width: 320, fieldType: 'link', fieldProps: { table: 'exp-expenses', multiple: true, inverse: 'budget' } },
        { field: 'spent', header: 'Spent', width: 130, fieldType: 'rollup', fieldProps: { linkField: 'expenses', field: 'amount', aggregation: 'SUM' } },
        { field: 'left', header: 'Left', width: 130, fieldType: 'formula', fieldProps: { formula: '{Monthly budget} - {Spent}', result: 'currency', precision: 0 } },
      ],
      views: [{ id: 'all', name: 'All categories', type: 'grid' }],
      automations: [
        {
          id: 'over',
          name: 'Over budget',
          enabled: true,
          trigger: { type: 'recordMatches' },
          condition: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'left', kind: 'number', op: 'lt', value: 0 }] },
          actions: [
            { type: 'highlight', fields: ['left'], background: '#fee2e2', color: '#991b1b' },
            { type: 'notify', message: '{Category} is over budget: {Left}', severity: 'error' },
          ],
        },
      ],
      props: { rowAdder: { label: 'Add category' } },
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
  <SvToaster />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; }
</style>
