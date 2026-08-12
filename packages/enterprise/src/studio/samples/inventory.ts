import type { EntitySchema } from '../../schema.js'
import type { FormatRule } from '../project.js'
import { screen, formScreen, boardScreen, detailScreen, project, dashScreen, statusPills, pad, ids, type SampleApp } from './shared.js'

// Excel-style chrome: a green header band over the brand, a green command bar
// (the toolbar), square-cornered nav rows with a green left-marker on the active
// sheet. Pairs with the square-cornered `excel` preset.
const EXCEL_CSS = `.sv-app.theme-excel .sv-app__side { background: #f3f2f1; border-right: 1px solid #d0cfce; padding: 0 0 12px; }
.sv-app.theme-excel .sv-app__sidehead { background: #107c41; margin: 0 0 6px; padding: 13px 14px; }
.sv-app.theme-excel .sv-app__brandtext { color: #fff; font-weight: 700; }
.sv-app.theme-excel .sv-app__collapse { color: rgba(255, 255, 255, 0.85); }
.sv-app.theme-excel .sv-app__links { padding: 0 8px; }
.sv-app.theme-excel .sv-app__link { border-radius: 0; padding: 7px 12px; border-left: 3px solid transparent; }
.sv-app.theme-excel .sv-app__link.is-active { background: #e7f2ec; color: #0b5c31; border-left-color: #107c41; font-weight: 600; }
.sv-app.theme-excel .sv-app__foot { padding-left: 12px; }
.sv-app.theme-excel .sv-app__toolbar { background: #107c41; border-bottom: 1px solid #0b5c31; }
.sv-app.theme-excel .sv-app__search { background: rgba(255, 255, 255, 0.16); border-color: rgba(255, 255, 255, 0.3); }
.sv-app.theme-excel .sv-app__search-in { color: #fff; }
.sv-app.theme-excel .sv-app__search-in::placeholder { color: rgba(255, 255, 255, 0.78); }
.sv-app.theme-excel .sv-app__search-ic, .sv-app.theme-excel .sv-app__kbd { color: #fff; }`

const suppliers: EntitySchema = {
  name: 'suppliers',
  label: 'Supplier',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'country', type: 'text', label: 'Country', input: { editorType: 'country', help: 'Country of dispatch' } },
    { field: 'email', type: 'text', format: 'email', required: true, input: { placeholder: 'orders@supplier.com' } },
    { field: 'phone', type: 'text', input: { editorType: 'phone' } },
    { field: 'rating', type: 'number', label: 'Rating', min: 1, max: 5, defaultValue: 3, input: { editorType: 'rating', help: '1-5 quality score' } },
    { field: 'leadDays', type: 'number', label: 'Lead time (days)', min: 0, defaultValue: 14, input: { help: 'Typical days from order to delivery' } },
    { field: 'color', type: 'text', label: 'Accent', defaultValue: '#f59e0b', input: { editorType: 'color', help: 'Chart accent color' } },
    { field: 'active', type: 'boolean', label: 'Active', defaultValue: true },
  ],
}

const products: EntitySchema = {
  name: 'products',
  label: 'Product',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'sku', type: 'text', label: 'SKU', required: true, input: { editorType: 'mask', mask: 'AAA-####', help: 'Stock keeping unit' } },
    { field: 'category', type: 'enum', required: true, options: [
      { value: 'electronics', label: 'Electronics', color: '#6366f1' },
      { value: 'office', label: 'Office', color: '#0ea5e9' },
      { value: 'home', label: 'Home', color: '#10b981' },
      { value: 'tools', label: 'Tools', color: '#f59e0b' },
    ] },
    { field: 'tags', type: 'text', label: 'Tags', input: { editorType: 'chips', help: 'Search and filter keywords' } },
    { field: 'price', type: 'number', label: 'Price ($)', min: 0, required: true },
    { field: 'discount', type: 'number', label: 'Discount (%)', min: 0, max: 100, defaultValue: 0, input: { editorType: 'slider', help: 'Current promotional discount' } },
    { field: 'stock', type: 'number', label: 'In stock', min: 0, defaultValue: 0 },
    { field: 'reorderLevel', type: 'number', label: 'Reorder level', min: 0, defaultValue: 20, input: { help: 'Restock when stock drops below this' } },
    // Derived: value of stock on hand (display-only, never stored).
    { field: 'stockValue', type: 'number', label: 'Stock value ($)', readonly: true, formula: 'price * stock' },
    { field: 'active', type: 'boolean', label: 'Active', defaultValue: true },
  ],
}

const purchaseOrders: EntitySchema = {
  name: 'purchaseOrders',
  label: 'Purchase order',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'ref', type: 'text', label: 'Ref', required: true, minLength: 2 },
    { field: 'supplierId', type: 'relation', label: 'Supplier', relation: { entity: 'suppliers', foreignKey: 'supplierId', labelField: 'name' } },
    { field: 'productId', type: 'relation', label: 'Product', relation: { entity: 'products', foreignKey: 'productId', labelField: 'name' } },
    { field: 'status', type: 'enum', defaultValue: 'draft', options: [
      { value: 'draft', label: 'Draft', color: '#94a3b8' },
      { value: 'ordered', label: 'Ordered', color: '#0ea5e9' },
      { value: 'received', label: 'Received', color: '#10b981' },
      { value: 'cancelled', label: 'Cancelled', color: '#ef4444' },
    ] },
    { field: 'qty', type: 'number', label: 'Quantity', min: 1, defaultValue: 1, required: true },
    { field: 'unitCost', type: 'number', label: 'Unit cost ($)', min: 0, defaultValue: 0 },
    // Derived: line total from quantity and unit cost (display-only, never stored).
    { field: 'total', type: 'number', label: 'Total ($)', readonly: true, formula: 'qty * unitCost' },
    { field: 'orderedAt', type: 'date', label: 'Ordered at', input: { editorType: 'datetime', help: 'When the order was placed' } },
  ],
}

const seed = {
  suppliers: [
    { id: 'sp1', name: 'Shenzhen Components', country: 'China', email: 'sales@shenzhencomp.com', phone: '+86 755 5550 101', rating: 5, leadDays: 21, color: '#6366f1', active: true },
    { id: 'sp2', name: 'Nordic Office Supply', country: 'Sweden', email: 'orders@nordicoffice.se', phone: '+46 8 5550 102', rating: 4, leadDays: 10, color: '#10b981', active: true },
    { id: 'sp3', name: 'Bavaria Tools', country: 'Germany', email: 'info@bavariatools.de', phone: '+49 89 5550103', rating: 5, leadDays: 14, color: '#f59e0b', active: true },
    { id: 'sp4', name: 'Pacific Home Goods', country: 'United States', email: 'hello@pacifichome.com', phone: '+1 (415) 555-0104', rating: 4, leadDays: 7, color: '#0ea5e9', active: true },
    { id: 'sp5', name: 'Kyoto Electronics', country: 'Japan', email: 'sales@kyotoelec.jp', phone: '+81 75 5550 105', rating: 5, leadDays: 18, color: '#8b5cf6', active: true },
    { id: 'sp6', name: 'Toronto Distributors', country: 'Canada', email: 'orders@torontodist.ca', phone: '+1 (416) 555-0106', rating: 4, leadDays: 12, color: '#ef4444', active: false },
  ],
  products: [
    { id: 'pr1', name: 'USB-C Hub', sku: 'ELE-0001', category: 'electronics', tags: ['usb-c', 'hub', 'charging'], price: 39, discount: 10, stock: 420, reorderLevel: 100, active: true },
    { id: 'pr2', name: 'Standing Desk', sku: 'OFF-0101', category: 'office', tags: ['adjustable', 'ergonomic'], price: 480, discount: 5, stock: 35, reorderLevel: 20, active: true },
    { id: 'pr3', name: 'Ceramic Mug Set', sku: 'HOM-0210', category: 'home', tags: ['kitchen', 'ceramic'], price: 24, discount: 0, stock: 610, reorderLevel: 150, active: true },
    { id: 'pr4', name: 'Cordless Drill', sku: 'TOO-0305', category: 'tools', tags: ['power', 'cordless', '18v'], price: 129, discount: 15, stock: 88, reorderLevel: 40, active: true },
    { id: 'pr5', name: 'Mechanical Keyboard', sku: 'ELE-0002', category: 'electronics', tags: ['mechanical', 'rgb', 'usb'], price: 95, discount: 8, stock: 240, reorderLevel: 80, active: true },
    { id: 'pr6', name: 'Ergonomic Chair', sku: 'OFF-0102', category: 'office', tags: ['ergonomic', 'mesh'], price: 320, discount: 12, stock: 52, reorderLevel: 25, active: true },
    { id: 'pr7', name: 'LED Desk Lamp', sku: 'HOM-0211', category: 'home', tags: ['lighting', 'led', 'dimmable'], price: 45, discount: 0, stock: 175, reorderLevel: 60, active: true },
  ],
  purchaseOrders: [
    { id: 'po1', ref: 'PO-4001', supplierId: 'sp1', productId: 'pr1', status: 'received', qty: 200, unitCost: 28, orderedAt: '2026-01-10T09:30:00.000Z' },
    { id: 'po2', ref: 'PO-4002', supplierId: 'sp2', productId: 'pr2', status: 'ordered', qty: 30, unitCost: 360, orderedAt: '2026-02-04T14:15:00.000Z' },
    { id: 'po3', ref: 'PO-4003', supplierId: 'sp3', productId: 'pr4', status: 'draft', qty: 25, unitCost: 92, orderedAt: '2026-02-18T11:00:00.000Z' },
    { id: 'po4', ref: 'PO-4004', supplierId: 'sp4', productId: 'pr3', status: 'cancelled', qty: 100, unitCost: 15, orderedAt: '2026-01-22T16:45:00.000Z' },
    { id: 'po5', ref: 'PO-4005', supplierId: 'sp5', productId: 'pr5', status: 'received', qty: 150, unitCost: 68, orderedAt: '2026-03-01T08:20:00.000Z' },
    { id: 'po6', ref: 'PO-4006', supplierId: 'sp6', productId: 'pr7', status: 'ordered', qty: 120, unitCost: 30, orderedAt: '2026-03-12T13:10:00.000Z' },
  ],
}

// Product grid formatting: category status pills, a LOW STOCK red-bold threshold
// (stock under 10 units needs reordering now), and a green highlight on deep
// promotional discounts - data-driven color, not just status pills.
const productFormats: FormatRule[] = [
  ...statusPills(products, 'category'),
  { field: 'stock', op: 'lt', value: 10, color: '#dc2626', bold: true },
  { field: 'discount', op: 'gte', value: 15, color: '#16a34a', bold: true },
]

export const inventory: SampleApp = {
  id: 'inventory',
  name: 'Inventory',
  description: 'Products, suppliers and purchase orders - an Excel-style warehouse app behind a sign-in (clerk and manager roles), with stock and purchasing dashboards (target KPIs, an order-trend sparkline, a reorder gauge, a category pie, a supplier x status pivot, tabbed breakdowns), a low-stock red grid plus a status-pill order grid with row actions, suppliers master/detail, and rich edit forms (country, phone, supplier rating, SKU mask, tag chips, discount slider, order datetime).',
  emoji: '\u{1F4E6}',
  accent: '#107c41',
  build: () => {
    const supplierRows = pad(suppliers, seed.suppliers, 24)
    const productRows = pad(products, seed.products, 60)
    const poRows = pad(purchaseOrders, seed.purchaseOrders, 90, { supplierId: ids(supplierRows), productId: ids(productRows) })
    return project({
      title: 'Warehouse',
      brand: 'Warehouse',
      accent: '#107c41',
      preset: 'excel',
      footer: '',
      // Excel/spreadsheet-style shell: green header + command bar, square sheets.
      appClass: 'theme-excel',
      customCss: EXCEL_CSS,
      // Sign-in with two roles. Clerks manage stock but cannot delete; purchasing
      // analytics and the supplier directory are manager-only.
      auth: { enabled: true, protect: true },
      access: {
        enabled: true,
        defaultRole: 'clerk',
        roles: [
          { role: 'manager', screens: '*', actions: '*' },
          { role: 'clerk', screens: ['overview', 'product-detail', 'products', 'board'], actions: ['create', 'update'] },
        ],
      },
      entities: [suppliers, products, purchaseOrders],
      seed: { suppliers: supplierRows, products: productRows, purchaseOrders: poRows },
      screens: [
        // Stock dashboard: KPI cards (units-in-stock card carries a 5,000-unit
        // target), a stock-level gauge, category breakdowns (bar + pie), a tabbed
        // view, and a status-pill product grid where LOW STOCK rows turn red-bold.
        dashScreen(products, { id: 'overview', title: 'Stock', order: 0 }, [
          { kpi: 'Products', reduce: 'count', span: 1 },
          { kpi: 'Units in stock', measure: 'stock', reduce: 'sum', target: 5000, span: 1 },
          { kpi: 'Avg price', measure: 'price', reduce: 'avg', format: 'currency', span: 1 },
          { gauge: 'Avg stock on hand', measure: 'stock', reduce: 'avg', min: 0, max: 500, span: 1 },
          { chart: 'category', measure: 'stock', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'category', reduce: 'count', type: 'pie', span: 1 },
          { tabs: [
            { label: 'Stock by category', tiles: [{ chart: 'category', measure: 'stock', reduce: 'sum', type: 'bar' }] },
            { label: 'Avg price by category', tiles: [{ chart: 'category', measure: 'price', reduce: 'avg', type: 'bar' }] },
          ], span: 3 },
          { grid: true, format: productFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Purchasing dashboard: order-volume + cost KPIs (units-ordered card trends
        // over the order date as a sparkline), an average-unit-cost gauge, status
        // breakdowns, an order-quantity-over-time area trend, a supplier x status
        // pivot, a tabbed view, and a status-pill purchase-order grid.
        dashScreen(purchaseOrders, { id: 'purchasing', title: 'Purchasing', order: 1 }, [
          { kpi: 'Purchase orders', reduce: 'count', span: 1 },
          { kpi: 'Units ordered', measure: 'qty', reduce: 'sum', trendField: 'orderedAt', trendReduce: 'sum', span: 1 },
          { kpi: 'Avg unit cost', measure: 'unitCost', reduce: 'avg', format: 'currency', span: 1 },
          { gauge: 'Avg unit cost', measure: 'unitCost', reduce: 'avg', min: 0, max: 400, unit: '$', span: 1 },
          { chart: 'status', measure: 'qty', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'orderedAt', measure: 'qty', reduce: 'sum', type: 'area', span: 3 },
          { pivot: { rows: ['supplierId'], cols: ['status'], measure: 'qty', aggregate: 'sum' }, span: 3 },
          { tabs: [
            { label: 'Qty by status', tiles: [{ chart: 'status', measure: 'qty', reduce: 'sum', type: 'bar' }] },
            { label: 'Orders by status', tiles: [{ chart: 'status', reduce: 'count', type: 'bar' }] },
          ], span: 3 },
          { grid: true, format: statusPills(purchaseOrders, 'status'), summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Product detail: a full record page - header (name + SKU + category pill),
        // stock / price metric tiles, an Overview of pricing and reorder fields, and a
        // Purchase orders timeline of the orders placed for the product.
        detailScreen(products, { id: 'product-detail', title: 'Product detail', order: 2 }, {
          titleField: 'name', subtitleField: 'sku', statusField: 'category',
          metricFields: ['stock', 'price'],
          sections: [
            { label: 'Pricing', fields: ['discount', 'tags'] },
            { label: 'Stock', fields: ['reorderLevel', 'active'] },
          ],
          related: [{ entity: 'purchaseOrders', foreignKey: 'productId', label: 'Purchase orders', titleField: 'ref', subtitleField: 'qty', dateField: 'orderedAt', statusField: 'status' }],
        }),
        screen(suppliers, 'master-detail', { id: 'suppliers', title: 'Suppliers', order: 3, child: purchaseOrders, foreignKey: 'supplierId' }),
        formScreen(products, { id: 'products', title: 'Products', order: 4 }, undefined, { format: productFormats, summaries: true, rowActions: [{ kind: 'edit' }], rowLink: { screen: 'product-detail', sourceField: 'id', targetField: 'id' } }, ['category', 'active']),
        formScreen(purchaseOrders, { id: 'purchaseOrders', title: 'Purchase orders', order: 5 }, undefined, { format: statusPills(purchaseOrders, 'status'), summaries: true, rowActions: [{ kind: 'edit' }] }, ['status', 'supplierId']),
        // Purchasing board: purchase orders as draggable Kanban lanes by status
        // (Draft -> Ordered -> Received), card = ref + order total.
        boardScreen(purchaseOrders, { id: 'board', title: 'Orders board', order: 6 }, { groupBy: 'status', titleField: 'ref', badgeField: 'qty', subtitleField: 'supplierId', filter: ['status', 'supplierId'] }),
      ],
    })
  },
}
