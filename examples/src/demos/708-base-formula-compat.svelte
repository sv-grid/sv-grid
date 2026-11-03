<script lang="ts">
  /**
   * 708. SvGrid Base: Airtable formulas
   * -----------------------------------
   * A formula playground and the list of every function in Airtable's
   * formula reference, with what a Base formula does with each.
   *
   * Orders has a Result field whose formula is the one in the box above the
   * base. Pick an Airtable-style example or type your own: the column works
   * it out for every order as you type, and a formula that does not compile
   * says why under the box (its cells show #ERROR). The examples use the
   * functions Base added for Airtable: WORKDAY_DIFF, DATETIME_FORMAT with
   * SET_TIMEZONE, REGEX_REPLACE, ARRAYSLICE, WEEKNUM, RECORD_ID. The last
   * example calls CREATED_TIME(), which Base does not have.
   *
   * The Airtable functions tab is `airtableFormulaSupport()`: each function,
   * its group, and Supported, Supported with a difference or Not supported,
   * read from FORMULA_FUNCTIONS. Search it from the view bar, or switch to
   * the board grouped by status.
   */
  import { FormulaError, SvBase, airtableFormulaSupport, enableBase, formulaError, type BaseTable } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  const day = (offset: number, hour?: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    if (hour == null) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    d.setHours(hour, 15, 0, 0)
    return d.toISOString()
  }

  const EXAMPLES: Array<{ label: string; formula: string }> = [
    { label: 'Working days to ship', formula: 'WORKDAY_DIFF({Placed}, {Shipped})' },
    { label: 'Day it was placed', formula: 'DATETIME_FORMAT({Placed}, "dddd, MMMM Do [at] h:mm A")' },
    { label: 'Placed, Tokyo time', formula: 'DATETIME_FORMAT(SET_TIMEZONE({Placed}, "Asia/Tokyo"), "MMM D, HH:mm Z")' },
    { label: 'Order size', formula: 'IF({Amount} >= 1000, "Large", IF({Amount} >= 250, "Medium", "Small"))' },
    { label: 'Email domain', formula: 'REGEX_REPLACE({Email}, "^.*@", "")' },
    { label: 'Unit price, rounded up', formula: 'ROUNDUP({Amount} / {Qty}, 1)' },
    { label: 'Next step', formula: 'SWITCH({Status}, "Waiting", "Pack it", "Packed", "Ship it", "Done")' },
    { label: 'First two tags', formula: 'ARRAYJOIN(ARRAYSLICE({Tags}, 1, 2), " + ")' },
    { label: 'Week placed', formula: '"W" & WEEKNUM({Placed}, "Monday") & " " & YEAR({Placed})' },
    { label: 'Ship by (3 working days)', formula: 'WORKDAY({Placed}, 3)' },
    { label: 'Order link', formula: '"https://example.com/orders/" & ENCODE_URL_COMPONENT({Order}) & "?r=" & RECORD_ID()' },
    { label: 'Age (not in Base)', formula: 'DATETIME_DIFF(TODAY(), CREATED_TIME(), "days")' },
  ]

  const STATUS = [
    { value: 'Waiting', color: '#ffeab6' },
    { value: 'Packed', color: '#d0f0fd' },
    { value: 'Shipped', color: '#d1f7c4' },
  ]
  const TAGS = [
    { value: 'Rush', color: '#ffdce5' },
    { value: 'Gift', color: '#ede2fe' },
    { value: 'Wholesale', color: '#cfdfff' },
    { value: 'Repeat', color: '#c2f5e9' },
  ]
  // [order, customer, email, placed (days ago, hour), shipped (days after placed), amount, qty, status, tags]
  const ORDERS: Array<[string, string, string, [number, number], number | null, number, number, string, string[]]> = [
    ['SO-1041', 'Northwind Traders', 'buyer@northwind.example', [-12, 9], 3, 1840, 24, 'Shipped', ['Wholesale', 'Repeat']],
    ['SO-1042', 'Fabrikam', 'orders@fabrikam.example', [-10, 14], 6, 312.5, 5, 'Shipped', ['Rush']],
    ['SO-1043', 'Tailspin Toys', 'ops@tailspin.example', [-8, 11], 2, 96, 12, 'Shipped', ['Gift', 'Rush', 'Repeat']],
    ['SO-1044', 'Contoso', 'purchasing@contoso.example', [-5, 16], null, 4210, 60, 'Packed', ['Wholesale']],
    ['SO-1045', 'Adventure Works', 'hello@adventure.example', [-3, 10], null, 640, 8, 'Packed', []],
    ['SO-1046', 'Litware', 'it@litware.example', [-2, 8], null, 189.9, 3, 'Waiting', ['Gift']],
    ['SO-1047', 'Proseware', 'team@proseware.example', [-1, 19], null, 1275, 15, 'Waiting', ['Repeat', 'Rush']],
  ]
  const orders = ORDERS.map(([order, customer, email, [placed, hour], ship, amount, qty, status, tags], i) => ({
    id: `rec${String(i + 1).padStart(3, '0')}`,
    order,
    customer,
    email,
    placed: day(placed, hour),
    shipped: ship == null ? null : day(placed + ship),
    amount,
    qty,
    status,
    tags,
  }))

  const ORDER_COLUMNS: Array<Record<string, any>> = [
    { field: 'order', header: 'Order', width: 110, fieldType: 'text' },
    { field: 'customer', header: 'Customer', width: 170, fieldType: 'text' },
    { field: 'result', header: 'Result', width: 260, fieldType: 'formula', fieldProps: { formula: EXAMPLES[0]!.formula, result: 'auto' } },
    { field: 'placed', header: 'Placed', width: 180, fieldType: 'date', fieldProps: { time: true, dateFormat: 'friendly' } },
    { field: 'shipped', header: 'Shipped', width: 150, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
    { field: 'amount', header: 'Amount', width: 120, fieldType: 'number', fieldProps: { format: 'currency', precision: 2 } },
    { field: 'qty', header: 'Qty', width: 80, fieldType: 'number', fieldProps: { format: 'integer' } },
    { field: 'status', header: 'Status', width: 120, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
    { field: 'tags', header: 'Tags', width: 200, fieldType: 'multiSelect', fieldProps: { options: TAGS } },
    { field: 'email', header: 'Email', width: 220, fieldType: 'email' },
  ]

  // The functions tab: what airtableFormulaSupport() says, never typed here.
  const LABEL = { supported: 'Supported', different: 'Supported with a difference', unsupported: 'Not supported' } as const
  const support = airtableFormulaSupport()
  const functions = support.map((f) => ({ id: f.name, name: f.name, group: f.group, status: LABEL[f.status], note: f.note }))
  const counts = {
    supported: support.filter((f) => f.status === 'supported').length,
    different: support.filter((f) => f.status === 'different').length,
    unsupported: support.filter((f) => f.status === 'unsupported').length,
  }

  let formula = $state(EXAMPLES[0]!.formula)
  let picked = $state(EXAMPLES[0]!.formula)

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'fc-orders',
      name: 'Orders',
      primaryField: 'order',
      data: orders,
      columns: ORDER_COLUMNS,
      views: [{ id: 'all', name: 'All orders', type: 'grid' }],
      props: { rowAdder: { label: 'Add order', defaults: () => ({ placed: day(0, 9), status: 'Waiting', qty: 1, tags: [] }) } },
    },
    {
      id: 'fc-functions',
      name: 'Airtable functions',
      primaryField: 'name',
      data: functions,
      columns: [
        { field: 'name', header: 'Function', width: 210, fieldType: 'text' },
        {
          field: 'status', header: 'SvGrid Base', width: 210, fieldType: 'singleSelect',
          fieldProps: { options: [{ value: LABEL.supported, color: '#d1f7c4' }, { value: LABEL.different, color: '#ffeab6' }, { value: LABEL.unsupported, color: '#ffdce5' }] },
        },
        {
          field: 'group', header: 'Group', width: 120, fieldType: 'singleSelect',
          fieldProps: { options: ['Text', 'Logical', 'Numeric', 'Date', 'Array', 'Record'].map((value) => ({ value })) },
        },
        { field: 'note', header: 'Notes', width: 520, fieldType: 'longText' },
      ],
      views: [
        { id: 'by-group', name: 'By group', type: 'grid', state: { grouping: ['group'] } },
        { id: 'by-status', name: 'By status', type: 'kanban', stackBy: 'status' },
      ],
      props: { editable: false },
    },
  ])

  /** The Result field's formula is the box's: the column works it out again. */
  function setFormula(next: string) {
    formula = next
    tables = tables.map((t) =>
      t.id !== 'fc-orders' ? t : { ...t, columns: t.columns.map((c) => (c.field === 'result' ? { ...c, fieldProps: { ...c.fieldProps, formula: next } } : c)) },
    )
  }
  function pick(next: string) {
    picked = next
    setFormula(next)
  }

  // The message the field editor would show: {Name} is another field of Orders, by header or key.
  const keys = new Map(ORDER_COLUMNS.filter((c) => c.field !== 'result').flatMap((c) => [[c.field, c.field], [c.header.toLowerCase(), c.field]]))
  const resolve = (name: string) => {
    const n = name.trim().toLowerCase()
    if (n === 'result') throw new FormulaError('A formula cannot read its own field {Result}')
    return keys.get(n) ?? null
  }
  const error = $derived(formula.trim() ? formulaError(formula, resolve) : null)
</script>

<section class="base-demo">
  <div class="fc-bar">
    <label class="fc-pick">
      <span>Example</span>
      <select value={picked} onchange={(e) => pick(e.currentTarget.value)}>
        {#each EXAMPLES as ex (ex.formula)}
          <option value={ex.formula}>{ex.label}</option>
        {/each}
      </select>
    </label>
    <label class="fc-formula">
      <span>Result =</span>
      <input
        value={formula}
        oninput={(e) => setFormula(e.currentTarget.value)}
        spellcheck="false"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby="fc-status"
      />
    </label>
    <p id="fc-status" class="fc-status" class:fc-bad={!!error} role="status">
      {#if error}
        {error}
      {:else}
        Of {support.length} Airtable functions: {counts.supported} supported, {counts.different} with a difference, {counts.unsupported} not supported.
      {/if}
    </p>
  </div>

  <div class="fc-base">
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
      fieldMenu
    />
  </div>
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; gap: 10px; }
  .fc-bar {
    flex: 0 0 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 12px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px);
    background: var(--sg-header-bg, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a); font-size: 13px;
  }
  .fc-pick, .fc-formula { display: flex; align-items: center; gap: 8px; }
  .fc-pick span, .fc-formula span { font-weight: 600; color: var(--sg-muted, #64748b); white-space: nowrap; }
  .fc-formula { flex: 1 1 360px; min-width: 0; }
  .fc-pick select, .fc-formula input {
    height: 32px; padding: 0 8px; border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 6px);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font: inherit;
  }
  .fc-formula input { flex: 1; min-width: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; }
  .fc-formula input[aria-invalid='true'] { border-color: var(--sg-danger, #dc2626); }
  .fc-status { flex-basis: 100%; margin: 0; color: var(--sg-muted, #64748b); }
  .fc-status.fc-bad { color: var(--sg-danger, #dc2626); }
  .fc-base { flex: 1 1 auto; min-height: 380px; display: flex; flex-direction: column; }
</style>
