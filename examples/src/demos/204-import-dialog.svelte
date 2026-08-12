<script lang="ts">
  /**
   * 204. Import dialog - drag-drop / paste, auto-mapping, typed preview (Enterprise)
   * -------------------------------------------------------------------------------
   * The round-trip partner of the export demos. Open the dialog, drop a file
   * (or paste rows from Excel), and SvImportDialog:
   *   - auto-maps the headers that line up (Company / Product / Country / Qty),
   *   - leaves the two that don't (Sold On, Unit Price) for a one-click
   *     retarget in the mapping UI - that's what the selects are for,
   *   - coerces each column with its own format (Price -> number, Sell date
   *     -> ISO date), flagging any cell that won't convert,
   *   - previews the typed rows, then appends the clean ones to the grid.
   *
   * The "Copy sample CSV" button drops a spreadsheet-shaped clipboard payload
   * so you can try the Paste tab end-to-end without leaving the page.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import {
    installEnterprise,
    setLicenseKey,
    dismissUnlicensedNudge,
    SvImportDialog,
    type EnterpriseGridApi,
    type ImportResult,
  } from '@svgrid/enterprise'
  import { makeOrders, type Order } from '../shared/seed'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  dismissUnlicensedNudge()

  const features = tableFeatures({ rowSortingFeature })

  let rows = $state<Order[]>(makeOrders(12))
  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  let lastImport = $state('')
  let copied = $state(false)

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'company', header: 'Company', width: 150 },
    { field: 'product', header: 'Product', width: 160 },
    { field: 'country', header: 'Country', width: 120 },
    {
      field: 'sellDate',
      header: 'Sell date',
      width: 130,
      format: { type: 'date', pattern: 'y-m-d' },
    },
    {
      field: 'quantity',
      header: 'Qty',
      width: 90,
      align: 'right',
      format: { type: 'number', options: { maximumFractionDigits: 0 } },
    },
    {
      field: 'price',
      header: 'Price',
      width: 120,
      align: 'right',
      format: { type: 'currency', currency: 'USD' },
    },
  ]

  // A deliberately "messy" sample: headers phrased differently from the grid
  // (Unit Price / Sold On), currency + thousands separators, and one bad
  // price cell so the validation highlight is visible.
  const sampleCsv = [
    'Company,Product,Country,Sold On,Qty,Unit Price',
    'Initech,Laptop Pro,USA,2026-05-02,12,"$1,299.00"',
    'Umbrella,4K Monitor,Germany,2026-05-04,40,"$449.50"',
    'Hooli,Wireless Mouse,Japan,2026-05-06,150,"$29.99"',
    'Stark Industries,Mechanical Keyboard,USA,2026-05-09,8,"$119.00"',
    'Wayne Enterprises,USB-C Dock,France,2026-05-11,25,not-a-price',
  ].join('\n')

  function onReady(next: SvGridApi<typeof features, Order>) {
    api = installEnterprise(next)
  }

  function onImported(result: ImportResult<Order>) {
    lastImport = `Imported ${result.rows.length} row${result.rows.length === 1 ? '' : 's'}`
      + (result.errors.length ? ` (${result.errors.length} cells needed a second look)` : '')
  }

  async function copySample() {
    try {
      await navigator.clipboard.writeText(sampleCsv)
      copied = true
      setTimeout(() => (copied = false), 1600)
    } catch {
      copied = false
    }
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="text-sm shrink-0 imp-intro">
    Open <strong>Import</strong>, then drop a file or use the <strong>Paste</strong> tab.
    <code>Company</code>, <code>Product</code>, <code>Country</code> and
    <code>Qty</code> auto-map; retarget <code>Sold On</code> &rarr;
    <code>Sell date</code> and <code>Unit Price</code> &rarr; <code>Price</code>
    with one click each. Values are coerced with each column's format, and the
    one bad price is flagged in the preview. Map a header to
    <strong>Import as new field</strong> to configure a column inline - name,
    kind (Number / Currency / Date / <strong>Dropdown</strong>...), visibility,
    and dropdown options - and it's created with the matching format + editor.
    Or switch the footer toggle to <strong>Replace all</strong> (with
    <strong>Replace columns</strong>) to make the grid match the file outright.
    Everything writes through the grid <code>api</code>.
  </div>

  <div class="flex flex-wrap items-center gap-2 shrink-0">
    <SvImportDialog {api} onImported={onImported} />
    <button class="btn" onclick={copySample}>{copied ? 'Copied ✓' : 'Copy sample CSV'}</button>
    {#if lastImport}<span class="text-xs text-green-600 dark:text-green-400">{lastImport}</span>{/if}
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      enableInlineEditing={true}
      showPagination={false}
      rowHeight={34}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={onReady}
    />
  </div>

  <footer class="text-xs shrink-0 imp-foot">
    Enterprise feature. Parse-once, chunked non-blocking mapping (won't freeze
    on 100k rows), size + row + error guard-rails, prototype-pollution-safe
    field handling, cancel, and a focus-trapped dialog. The engine
    (<code>importData</code>) reads Excel .xlsx, CSV, TSV, and JSON - the dialog
    is the drop-in UI around it.
  </footer>
</section>

<style>
  /* Page chrome follows the active grid theme via --sg-* tokens. */
  .btn {
    border-radius: 0.375rem;
    border: 1px solid var(--sg-border, rgb(203 213 225));
    padding: 0.3rem 0.7rem;
    font-size: 0.8rem;
    font-weight: 500;
    background: var(--sg-bg, white);
    color: var(--sg-fg, rgb(15 23 42));
    cursor: pointer;
  }
  .btn:hover { background: var(--sg-row-hover-bg, white); }
  .imp-intro { color: var(--sg-fg, rgb(71 85 105)); }
  .imp-foot { color: var(--sg-muted, rgb(100 116 139)); }
</style>
