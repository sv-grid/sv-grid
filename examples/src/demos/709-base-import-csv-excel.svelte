<script lang="ts">
  /**
   * 709. SvGrid Base: import CSV or Excel
   * -------------------------------------
   * A CSV, TSV, Excel (.xlsx) or JSON file goes into a base two ways:
   *
   *  - as a new table (the list of tables, "Import a file as a table"): each
   *    column becomes a field typed from its values. "$1,200" makes a
   *    currency, "yes / no" a checkbox, dates a date, an email column an
   *    email, a column that repeats a few values a single select with a
   *    color per value. The dialog shows each guess and lets you change it.
   *  - as records of the shown table (the table's menu, "Import records from
   *    a file"): each column of the file goes to the field it names, matched
   *    by name; new select values become options.
   *
   * The file is read in the page and the import is one undo step. The two
   * buttons below hand the base a sample file through `openImport(mode, file)`,
   * the same dialog the menus open.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, type BaseTable } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  const STAGE = [
    { value: 'New', color: '#94a3b8' },
    { value: 'Contacted', color: '#2d7ff9' },
    { value: 'Customer', color: '#20c933' },
  ]
  let tables = $state.raw<BaseTable[]>([
    {
      id: 'import-contacts',
      name: 'Contacts',
      primaryField: 'name',
      data: [
        { id: 'c1', name: 'Mara Lindqvist', company: 'Northwind Traders', email: 'mara@northwind.example', stage: 'Customer', subscribed: true },
        { id: 'c2', name: 'Tomas Reyes', company: 'Contoso', email: 'tomas@contoso.example', stage: 'Contacted', subscribed: false },
      ],
      columns: [
        { field: 'name', header: 'Name', width: 200, fieldType: 'text' },
        { field: 'company', header: 'Company', width: 190, fieldType: 'text' },
        { field: 'email', header: 'Email', width: 230, fieldType: 'email' },
        { field: 'stage', header: 'Stage', width: 130, fieldType: 'singleSelect', fieldProps: { options: STAGE } },
        { field: 'subscribed', header: 'Subscribed', width: 110, fieldType: 'checkbox' },
      ],
      views: [{ id: 'all', name: 'All contacts', type: 'grid', color: { mode: 'field', field: 'stage' } }],
    },
  ])

  // A sign-up export whose columns are named like the table's fields, in another order, with one extra column.
  const CONTACTS_CSV = `Email,Name,Company,Stage,Subscribed,Signed up from
priya@fabrikam.example,Priya Nair,Fabrikam,New,yes,Webinar
li.wei@litware.example,Li Wei,Litware,Contacted,no,Pricing page
sam@tailspin.example,Sam Okoro,Tailspin Toys,Trial,yes,Referral
ines@proseware.example,Ines Duarte,Proseware,New,yes,Webinar
`
  // An inventory sheet for a new table: a currency, a number, a checkbox, a date, a select.
  const PRODUCTS_TSV = [
    ['Product', 'SKU', 'Category', 'Price', 'In stock', 'Reorder', 'Last counted', 'Supplier email'],
    ['Standing desk', 'DSK-120', 'Furniture', '$649.00', '14', 'no', '2026-10-28', 'orders@deskco.example'],
    ['Monitor arm', 'ARM-02', 'Accessories', '$89.00', '3', 'yes', '2026-10-28', 'sales@mounts.example'],
    ['Task chair', 'CHR-77', 'Furniture', '$329.00', '9', 'no', '2026-10-27', 'orders@deskco.example'],
    ['Desk lamp', 'LMP-10', 'Lighting', '$45.50', '0', 'yes', '2026-10-27', 'hello@lumen.example'],
    ['Cable tray', 'CBL-04', 'Accessories', '$24.00', '41', 'no', '2026-10-26', 'sales@mounts.example'],
    ['Footrest', 'FTR-01', 'Furniture', '$59.00', '6', 'no', '2026-10-26', 'orders@deskco.example'],
    ['Webcam light', 'LMP-22', 'Lighting', '$39.00', '2', 'yes', '2026-10-25', 'hello@lumen.example'],
  ].map((r) => r.join('\t')).join('\n')

  let base = $state<ReturnType<typeof SvBase> | null>(null)
  const file = (text: string, name: string, type: string) => new File([text], name, { type })

  function importContacts() {
    base?.openImport('append', file(CONTACTS_CSV, 'signups.csv', 'text/csv'))
  }
  function importProducts() {
    base?.openImport('new', file(PRODUCTS_TSV, 'products.tsv', 'text/tab-separated-values'))
  }
</script>

<section class="base-demo">
  <div class="base-demo-bar">
    <button type="button" class="base-demo-btn" onclick={importContacts}>Import signups.csv into Contacts</button>
    <button type="button" class="base-demo-btn" onclick={importProducts}>Import products.tsv as a new table</button>
    <span class="base-demo-tip">Or use your own file: the table menu (▾ next to Contacts) or the list of tables.</span>
  </div>
  <SvBase
    bind:this={base}
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
  <SvToaster />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; gap: 10px; }
  .base-demo-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .base-demo-btn {
    height: 32px; padding: 0 12px; font: inherit; font-size: 13px; cursor: pointer; border-radius: var(--sg-radius, 6px);
    color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0);
  }
  .base-demo-btn:hover { border-color: var(--sg-accent, #2563eb); }
  .base-demo-tip { font-size: 13px; color: var(--sg-muted, #64748b); }
</style>
