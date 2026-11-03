<script lang="ts">
  /**
   * 719. SvGrid Base: list view
   * ---------------------------
   * A product feedback base read as a list: one entry per record, its name
   * in bold and three fields under it, so long titles stay readable on a
   * narrow screen. The list takes the view's filter, sort and groups from the
   * grid underneath: "By area" groups by Area and sorts by Votes, "Planned"
   * is filtered to one status. A group header folds its records.
   *
   * Click a record or press Enter to open it; Up and Down move, Home and End
   * jump. "Customize list" in the view bar picks the fields under the name
   * (kept in the view as `listFields`). Switch to the phone width to see the
   * same list at 390px.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, type BaseTable } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const AREA = [
    { value: 'Reports', color: '#2d7ff9' },
    { value: 'Mobile app', color: '#8b46ff' },
    { value: 'Billing', color: '#fcb400' },
    { value: 'Integrations', color: '#20c933' },
  ]
  const STATUS = [
    { value: 'New', color: '#94a3b8' },
    { value: 'Under review', color: '#2d7ff9' },
    { value: 'Planned', color: '#8b46ff' },
    { value: 'Shipped', color: '#20c933' },
  ]
  const FEEDBACK: Array<[string, string, string, number, string, number, string]> = [
    ['Schedule a report to go out every Monday morning', 'Reports', 'Planned', 48, 'Northwind Freight', -12, 'u2'],
    ['Export a filtered report to PDF with our logo on it', 'Reports', 'Under review', 31, 'Bluebird Clinics', -6, 'u3'],
    ['Offline mode for drivers who lose signal on rural routes', 'Mobile app', 'Planned', 57, 'Northwind Freight', -20, 'u4'],
    ['Scan a barcode to find the record instead of typing the code', 'Mobile app', 'New', 12, 'Harbor Supply', -2, ''],
    ['Pay invoices by bank transfer, not only by card', 'Billing', 'Shipped', 40, 'Atlas Legal', -45, 'u5'],
    ['Show VAT on its own line on every invoice', 'Billing', 'Under review', 22, 'Kestrel Studio', -8, 'u5'],
    ['Two-way sync with the accounting system we already use', 'Integrations', 'Under review', 64, 'Atlas Legal', -15, 'u2'],
    ['Post to a team chat channel when a deal is won', 'Integrations', 'New', 9, 'Kestrel Studio', -1, ''],
    ['Dark mode for the mobile app at night shifts', 'Mobile app', 'Shipped', 35, 'Bluebird Clinics', -60, 'u4'],
    ['Compare this quarter with the last one in the same chart', 'Reports', 'New', 18, 'Harbor Supply', -3, ''],
    ['A webhook when a record changes, with the old and new values', 'Integrations', 'Planned', 27, 'Northwind Freight', -9, 'u3'],
    ['Let the finance team see invoices without edit rights', 'Billing', 'New', 6, 'Atlas Legal', -1, ''],
  ]

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'list-feedback',
      name: 'Feedback',
      primaryField: 'title',
      data: FEEDBACK.map(([title, area, status, votes, customer, when, owner], i) => ({
        id: `f${i + 1}`,
        title,
        area,
        status,
        votes,
        customer,
        submitted: day(when),
        owner: owner || null,
      })),
      columns: [
        { field: 'title', header: 'Feedback', width: 360, fieldType: 'text' },
        { field: 'status', header: 'Status', width: 140, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
        { field: 'votes', header: 'Votes', width: 90, fieldType: 'number', fieldProps: { format: 'integer' } },
        { field: 'customer', header: 'Customer', width: 170, fieldType: 'text' },
        { field: 'area', header: 'Area', width: 140, fieldType: 'singleSelect', fieldProps: { options: AREA } },
        { field: 'submitted', header: 'Submitted', width: 130, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'owner', header: 'Owner', width: 150, fieldType: 'user' },
      ],
      views: [
        {
          id: 'by-area',
          name: 'By area',
          type: 'list',
          listFields: ['status', 'votes', 'customer'],
          state: { sorting: [{ id: 'area', desc: false }, { id: 'votes', desc: true }], grouping: ['area'], hiddenColumns: [], advancedFilter: null },
        },
        {
          id: 'planned',
          name: 'Planned',
          type: 'list',
          listFields: ['area', 'owner', 'submitted'],
          state: {
            sorting: [{ id: 'votes', desc: true }],
            grouping: [],
            hiddenColumns: [],
            advancedFilter: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'status', kind: 'select', op: 'is', value: 'Planned' }] },
          },
        },
        { id: 'all', name: 'All feedback', type: 'grid' },
      ],
      props: { rowAdder: { label: 'Add feedback', defaults: () => ({ status: 'New', votes: 1, submitted: day(0) }) } },
    },
  ])

  let phone = $state(false)
</script>

<section class="base-demo">
  <div class="base-demo-bar">
    <div class="base-demo-seg" role="radiogroup" aria-label="Width">
      <button type="button" role="radio" aria-checked={!phone} class:is-on={!phone} onclick={() => (phone = false)}>Desktop</button>
      <button type="button" role="radio" aria-checked={phone} class:is-on={phone} onclick={() => (phone = true)}>Phone (390px)</button>
    </div>
    <span class="base-demo-tip">Click a record or press Enter to open it. Up and Down move.</span>
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
