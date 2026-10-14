<script lang="ts">
  /**
   * 515. SvGrid Base: inventory
   * ---------------------------
   * A studio's equipment and stock as a ready-to-use base with two tables.
   * Each item has a photo, category, location, supplier, quantity, unit cost,
   * the stock value (a formula: Qty times Unit cost), its condition, who has
   * it checked out and when it was last counted. Suppliers list the items
   * they supply, how many, and the units in stock, linked both ways.
   *
   * The Items views: the stock list grouped by category with value totals, a
   * photo gallery, items by location as a Kanban (drag one to move it), the
   * "Reorder" view of what runs low, and the form for adding an item.
   */
  import { SvBase, enableBase, type Attachment, type BaseTable } from '@svgrid/enterprise/base'
  import { productShot, type ProductKind } from '../shared/gallery-art'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  type Item = {
    id: number
    item: string
    photo: Attachment[]
    category: string
    location: string
    supplier: string[]
    qty: number
    unitCost: number
    condition: number
    checkedOut: string
    audited: string
    sku: string
  }

  const CATEGORIES = [
    { value: 'Furniture', color: '#c46f4e' },
    { value: 'Lighting', color: '#fcb400' },
    { value: 'Kitchen', color: '#20c933' },
    { value: 'Audio', color: '#8b46ff' },
    { value: 'Decor', color: '#2d7ff9' },
    { value: 'Plants', color: '#20d9d2' },
  ]
  const LOCATIONS = [
    { value: 'Studio A', color: '#2d7ff9' },
    { value: 'Studio B', color: '#8b46ff' },
    { value: 'Warehouse', color: '#94a3b8' },
    { value: 'Showroom', color: '#ff6f2c' },
  ]
  const ITEMS: Array<[string, ProductKind, string, string, number]> = [
    ['Lounge chair, sage', 'chair', '#8a9a7b', 'Furniture', 640],
    ['Dining chair, navy', 'chair', '#34495e', 'Furniture', 290],
    ['Dining chair, oat', 'chair', '#d8cbb3', 'Furniture', 290],
    ['Arc floor lamp', 'lamp', '#efe6d8', 'Lighting', 410],
    ['Table lamp, black', 'lamp', '#2f2f33', 'Lighting', 160],
    ['Table lamp, sand', 'lamp', '#d9b38c', 'Lighting', 160],
    ['Stoneware mug, slate', 'mug', '#6d8fa3', 'Kitchen', 18],
    ['Stoneware mug, rust', 'mug', '#9e5a3c', 'Kitchen', 18],
    ['Espresso cup, forest', 'mug', '#2e3d34', 'Kitchen', 12],
    ['Bookshelf speaker', 'speaker', '#3a3d42', 'Audio', 380],
    ['Portable speaker, olive', 'speaker', '#6b7f6e', 'Audio', 140],
    ['Wall clock, brass', 'clock', '#b08d57', 'Decor', 95],
    ['Desk clock, celadon', 'clock', '#9fb4a8', 'Decor', 70],
    ['Fiddle leaf fig', 'plant', '#c67b5c', 'Plants', 85],
    ['Snake plant', 'plant', '#e9e4dc', 'Plants', 45],
  ]
  // Who supplies each category.
  const SUPPLIERS = [
    ['Nordic Home Supply', 'orders@nordichome.example.com', 14, ['Furniture', 'Decor']],
    ['Lumen & Co', 'trade@lumen.example.com', 10, ['Lighting']],
    ['Kiln Ceramics', 'hello@kiln.example.com', 21, ['Kitchen']],
    ['Signal Audio', 'b2b@signal.example.com', 7, ['Audio']],
    ['Greenhouse Co', 'shop@greenhouse.example.com', 5, ['Plants']],
  ] as const
  const supplierOf = (category: string) => `s${SUPPLIERS.findIndex((s) => (s[3] as readonly string[]).includes(category)) + 1}`
  const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n)).toISOString().slice(0, 10)
  let nextId = ITEMS.length + 1
  const items: Item[] = ITEMS.map(([item, kind, color, category, unitCost], i) => ({
    id: i + 1,
    item,
    photo: [{ id: `ph${i}`, name: `${item.toLowerCase().replace(/[^a-z]+/g, '-')}.svg`, type: 'image/svg+xml', url: productShot(kind, color) }],
    category,
    location: LOCATIONS[(i * 3) % LOCATIONS.length]!.value,
    supplier: [supplierOf(category)],
    qty: [12, 2, 30, 4, 1, 9, 48, 6, 3, 2, 7, 1, 5, 3, 0][i]!,
    unitCost,
    condition: 2 + ((i * 3) % 4),
    checkedOut: i % 4 === 1 ? ['u2', 'u3', 'u4'][i % 3]! : '',
    audited: day((i * 4) % 40),
    sku: `INV-${String(1000 + i * 7)}`,
  }))
  const suppliers = SUPPLIERS.map(([name, email, leadDays], i) => ({
    id: `s${i + 1}`,
    name,
    email,
    leadDays,
    items: items.filter((it) => it.supplier[0] === `s${i + 1}`).map((it) => String(it.id)),
  }))

  const itemColumns: any[] = [
    { field: 'item', header: 'Item', width: 230, fieldType: 'text' },
    { field: 'photo', header: 'Photo', width: 104, fieldType: 'attachment', fieldProps: { accept: 'image/*', maxFiles: 3 } },
    { field: 'category', header: 'Category', width: 150, fieldType: 'singleSelect', fieldProps: { options: CATEGORIES } },
    { field: 'location', header: 'Location', width: 130, fieldType: 'singleSelect', fieldProps: { options: LOCATIONS } },
    { field: 'supplier', header: 'Supplier', width: 180, fieldType: 'link', fieldProps: { table: 'inventory-suppliers', multiple: false, inverse: 'items' } },
    { field: 'qty', header: 'Qty', width: 90, fieldType: 'number', fieldProps: { format: 'integer', summary: 'sum' } },
    { field: 'unitCost', header: 'Unit cost', width: 132, fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', precision: 2 } },
    { field: 'value', header: 'Stock value', width: 150, fieldType: 'formula', fieldProps: { formula: '{Qty} * {Unit cost}', result: 'currency', precision: 2, summary: 'sum' } },
    { field: 'condition', header: 'Condition', width: 130, fieldType: 'rating', fieldProps: { max: 5, color: '#20c933' } },
    { field: 'checkedOut', header: 'Checked out to', width: 170, fieldType: 'user' },
    { field: 'audited', header: 'Last counted', width: 150, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
    { field: 'sku', header: 'SKU', width: 120, fieldType: 'barcode' },
  ]

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'inventory-items',
      name: 'Items',
      primaryField: 'item',
      data: items,
      columns: itemColumns,
      views: [
        { id: 'stock', name: 'Stock by category', type: 'grid', state: { grouping: ['category'], sorting: [{ id: 'category', desc: false }, { id: 'item', desc: false }] } },
        { id: 'photos', name: 'Photos', type: 'gallery', coverField: 'photo' },
        { id: 'where', name: 'By location', type: 'kanban', stackBy: 'location' },
        { id: 'units', name: 'Units by location', type: 'chart', chart: { kind: 'bar', x: 'location', y: 'qty' } },
        {
          id: 'reorder',
          name: 'Reorder',
          type: 'grid',
          color: { mode: 'conditions', rules: [{ color: '#f82b60', condition: { column: 'qty', kind: 'number', op: 'eq', value: 0 } }, { color: '#fcb400', condition: { column: 'qty', kind: 'number', op: 'lte', value: 3 } }] },
          state: {
            sorting: [{ id: 'qty', desc: false }],
            advancedFilter: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'qty', kind: 'number', op: 'lte', value: 3 }] },
          },
        },
        { id: 'add', name: 'Add an item', type: 'form', formFields: ['item', 'photo', 'category', 'location', 'supplier', 'qty', 'unitCost'], formDescription: 'New stock or equipment. It shows in the list as soon as you submit.' },
      ],
      props: { rowAdder: { label: 'Add item', defaults: () => ({ id: nextId++, item: '', photo: [], qty: 0, condition: 5 }) } },
    },
    {
      id: 'inventory-suppliers',
      name: 'Suppliers',
      primaryField: 'name',
      data: suppliers,
      columns: [
        { field: 'name', header: 'Supplier', width: 200, fieldType: 'text' },
        { field: 'email', header: 'Orders', width: 260, fieldType: 'email' },
        { field: 'leadDays', header: 'Lead time (days)', width: 150, fieldType: 'number', fieldProps: { format: 'integer' } },
        { field: 'items', header: 'Items', width: 320, fieldType: 'link', fieldProps: { table: 'inventory-items', multiple: true, inverse: 'supplier' } },
        { field: 'itemCount', header: 'Item count', width: 120, fieldType: 'count', fieldProps: { linkField: 'items' } },
        { field: 'units', header: 'Units in stock', width: 140, fieldType: 'rollup', fieldProps: { linkField: 'items', field: 'qty', aggregation: 'SUM' } },
      ],
      views: [{ id: 'suppliers', name: 'All suppliers', type: 'grid' }],
      props: { rowAdder: { label: 'Add supplier' } },
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
    rowHeight={44}
    containerHeight="100%"
    selectionBar={['selectAll', 'editFields', 'deleteRows']}
    columnAdder
    fieldMenu
  />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; }
</style>
