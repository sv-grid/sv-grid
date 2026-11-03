<script lang="ts">
  /**
   * 720. SvGrid Base: inbox view
   * ----------------------------
   * A support queue as an inbox: the tickets on the left, newest first by
   * Received (`inboxDateField`), the picked one on the right with its fields,
   * to read and edit in place. The view's filter applies: Solved tickets are
   * left out.
   *
   * The tickets live in a small in-page database read through `baseSource`.
   * Teammates change it from elsewhere: a few seconds after the page opens
   * Cleo, Dev and Elena move some tickets and a new one arrives, and "A
   * teammate changes a ticket" does it again. The base reads the change and
   * marks the record unread: bold, with a dot, and what changed listed on top
   * of the record, credited from the Last changed by field. Picking a ticket
   * marks it read; "Mark all read" marks the rest.
   *
   * Down or j picks the next ticket, Up or k the previous, Enter opens the
   * full record with its comments. Narrower than 640px the inbox shows the
   * list, then the ticket with a way back.
   */
  import { onMount } from 'svelte'
  import { SvToaster, type ServerDataSource } from '@svgrid/grid'
  import { SvBase, baseSource, enableBase, type BaseTable } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  type Row = Record<string, unknown>
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
  const STATUS = [
    { value: 'New', color: '#2d7ff9' },
    { value: 'Open', color: '#fcb400' },
    { value: 'Waiting on customer', color: '#8b46ff' },
    { value: 'Solved', color: '#20c933' },
  ]
  const PRIORITY = [
    { value: 'Urgent', color: '#f82b60' },
    { value: 'High', color: '#ff6f2c' },
    { value: 'Normal', color: '#94a3b8' },
  ]
  const TICKETS: Array<[string, string, string, string, string, number, string]> = [
    ['Invoice shows the wrong company address', 'billing@atlaslegal.example', 'Open', 'Normal', 'u2', 35, 'Our new address has been in the account settings since March, but the October invoice still has the old one.'],
    ['Cannot sign in after the password reset', 'ops@northwind.example', 'New', 'Urgent', '', 50, 'The reset link works, then the sign-in page says the password is wrong. Three people on the team have the same problem.'],
    ['CSV export cuts off long notes', 'data@harborsupply.example', 'Open', 'High', 'u4', 95, 'Notes longer than about 250 characters end in the middle of a word in the exported file.'],
    ['How do I add a teammate as read-only?', 'hello@kestrel.example', 'Waiting on customer', 'Normal', 'u5', 160, 'We want our accountant to see the invoices but not change anything.'],
    ['Charged twice for November', 'finance@bluebird.example', 'Open', 'High', 'u2', 240, 'Two identical charges on the card statement, a minute apart.'],
    ['Report builder is slow with a year of data', 'ops@northwind.example', 'Open', 'Normal', 'u4', 380, 'Opening the yearly report takes about forty seconds; a quarter is fine.'],
    ['Please add a Monday digest email', 'hello@kestrel.example', 'New', 'Normal', '', 600, 'A short summary of last week would save us a meeting.'],
    ['Webhook retries flood our endpoint', 'dev@atlaslegal.example', 'Waiting on customer', 'High', 'u3', 900, 'After a timeout we got the same event 40 times in a minute.'],
    ['Thanks for the quick fix yesterday', 'finance@bluebird.example', 'Solved', 'Normal', 'u5', 1500, 'The import works again. Closing this from our side.'],
  ]

  // ---- The database: tickets kept in this page, read and written like a real one --------
  const store = new Map<string, Row>(
    TICKETS.map(([subject, customer, status, priority, assignee, ago, message], i) => [
      `t${i + 1}`,
      { id: `t${i + 1}`, subject, customer, status, priority, assignee: assignee || null, received: minutesAgo(ago), message, modified_by: 'u1' },
    ]),
  )
  const ds: ServerDataSource<Row> = {
    async getRows() {
      return { rows: [...store.values()].map((r) => ({ ...r })), rowCount: store.size }
    },
    async createRow(input) {
      const row = { ...input }
      store.set(String(row.id), row)
      return { ...row }
    },
    async updateRow(id, patch) {
      store.set(String(id), { ...store.get(String(id)), ...patch })
      return { ...store.get(String(id))! }
    },
    async deleteRow(id) {
      store.delete(String(id))
    },
  }
  // What the base listens to: a database's realtime channel would call these.
  const listeners = new Set<() => void>()
  const realtime = (onChange: () => void) => {
    listeners.add(onChange)
    return () => listeners.delete(onChange)
  }

  const notSolved = { kind: 'fieldFilter' as const, conjunction: 'and' as const, conditions: [{ column: 'status', kind: 'select' as const, op: 'isNot' as const, value: 'Solved' }] }
  let tables = $state.raw<BaseTable[]>([
    {
      id: 'inbox-tickets',
      name: 'Tickets',
      primaryField: 'subject',
      data: [],
      columns: [
        { field: 'subject', header: 'Subject', width: 300, fieldType: 'text' },
        { field: 'customer', header: 'Customer', width: 210, fieldType: 'email' },
        { field: 'status', header: 'Status', width: 170, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
        { field: 'priority', header: 'Priority', width: 110, fieldType: 'singleSelect', fieldProps: { options: PRIORITY } },
        { field: 'assignee', header: 'Assignee', width: 150, fieldType: 'user' },
        { field: 'received', header: 'Received', width: 170, fieldType: 'date', fieldProps: { dateFormat: 'friendly', time: true } },
        { field: 'message', header: 'Message', width: 320, fieldType: 'longText' },
        { field: 'modified_by', header: 'Last changed by', width: 150, fieldType: 'lastModifiedBy' },
      ],
      views: [
        {
          id: 'inbox',
          name: 'Inbox',
          type: 'inbox',
          inboxDateField: 'received',
          listFields: ['customer', 'status', 'priority'],
          state: { sorting: [], grouping: [], hiddenColumns: [], advancedFilter: notSolved },
        },
        { id: 'all', name: 'All tickets', type: 'grid', state: { sorting: [{ id: 'received', desc: true }], grouping: [], hiddenColumns: [], advancedFilter: null } },
      ],
      source: baseSource(ds, { realtime }),
      props: { rowAdder: { label: 'Add ticket', defaults: () => ({ status: 'New', priority: 'Normal', received: new Date().toISOString() }) } },
    },
  ])

  // ---- Teammates, changing tickets from elsewhere -------------------------------------
  const CHANGES: Array<(n: number) => void> = [
    () => patch('t2', { status: 'Open', assignee: 'u3', modified_by: 'u3' }),
    () => patch('t5', { status: 'Waiting on customer', priority: 'Normal', modified_by: 'u2' }),
    (n) =>
      store.set(`n${n}`, {
        id: `n${n}`,
        subject: 'Mobile app crashes when opening a photo',
        customer: 'field@harborsupply.example',
        status: 'New',
        priority: 'Urgent',
        assignee: null,
        received: new Date().toISOString(),
        message: 'Since this morning the app closes as soon as a photo attachment is tapped.',
        modified_by: 'u4',
      }),
    () => patch('t3', { priority: 'Urgent', assignee: 'u5', modified_by: 'u5' }),
    () => patch('t6', { status: 'Waiting on customer', modified_by: 'u4' }),
    () => patch('t4', { status: 'Open', message: 'They replied: read-only for one person, the accountant.', modified_by: 'u5' }),
  ]
  let next = 0
  function patch(id: string, values: Row) {
    const row = store.get(id)
    if (row) store.set(id, { ...row, ...values })
  }
  /** One teammate's change, then the database tells its listeners. */
  function teammate() {
    const change = CHANGES[next % CHANGES.length]!
    next += 1
    change(next)
    for (const on of listeners) on()
  }
  onMount(() => {
    // The first changes land once the base has read the tickets.
    const timers = [1500, 1800, 2100].map((ms) => setTimeout(teammate, ms))
    return () => timers.forEach(clearTimeout)
  })

  let phone = $state(false)
</script>

<section class="base-demo">
  <div class="base-demo-bar">
    <button type="button" class="base-demo-btn" onclick={teammate}>A teammate changes a ticket</button>
    <div class="base-demo-seg" role="radiogroup" aria-label="Width">
      <button type="button" role="radio" aria-checked={!phone} class:is-on={!phone} onclick={() => (phone = false)}>Desktop</button>
      <button type="button" role="radio" aria-checked={phone} class:is-on={phone} onclick={() => (phone = true)}>Phone (390px)</button>
    </div>
    <span class="base-demo-tip">j and k move through the tickets; Enter opens one in full.</span>
  </div>
  <div class="base-demo-stage" class:is-device={phone}>
    <div class="base-demo-device" style:width={phone ? '390px' : '100%'}>
      <SvBase bind:tables editable sortable expandRows showRowNumbers rowHeight={40} containerHeight="100%" fieldMenu />
    </div>
  </div>
  <SvToaster />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 620px; height: 100%; gap: 10px; }
  .base-demo-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .base-demo-btn {
    height: 32px; padding: 0 12px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 6px);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font: inherit; font-size: 13px; cursor: pointer;
  }
  .base-demo-btn:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; }
  .base-demo-seg { display: inline-flex; padding: 2px; border-radius: var(--sg-radius, 6px); background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, transparent); }
  .base-demo-seg button {
    height: 28px; padding: 0 10px; border: 0; border-radius: calc(var(--sg-radius, 6px) - 2px); background: none;
    color: var(--sg-muted, #64748b); font: inherit; font-size: 13px; cursor: pointer;
  }
  .base-demo-seg button.is-on { background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); box-shadow: 0 0 0 1px var(--sg-border, #e2e8f0); }
  .base-demo-tip { font-size: 13px; color: var(--sg-muted, #64748b); }
  .base-demo-stage { flex: 1; min-height: 0; display: flex; justify-content: center; }
  .base-demo-stage.is-device { padding: 8px 0; background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, transparent); border-radius: var(--sg-radius-lg, 10px); }
  .base-demo-device { max-width: 100%; height: 100%; min-height: 560px; }
  .is-device .base-demo-device { max-height: 720px; box-shadow: 0 0 0 8px var(--sg-fg, #0f172a); border-radius: 18px; overflow: hidden; }
</style>
