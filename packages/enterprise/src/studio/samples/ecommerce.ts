import type { EntitySchema } from '../../schema.js'
import type { FormatRule } from '../project.js'
import { screen, formScreen, boardScreen, detailScreen, project, dashScreen, statusPills, pad, ids, type SampleApp } from './shared.js'

const products: EntitySchema = {
  name: 'products',
  label: 'Product',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'sku', type: 'text', label: 'SKU', input: { editorType: 'mask', mask: 'AAA-#####', help: 'Warehouse stock code' } },
    { field: 'category', type: 'enum', required: true, options: [
      { value: 'electronics', label: 'Electronics', color: '#6366f1' },
      { value: 'home', label: 'Home', color: '#10b981' },
      { value: 'apparel', label: 'Apparel', color: '#f59e0b' },
      { value: 'office', label: 'Office', color: '#0ea5e9' },
    ] },
    { field: 'price', type: 'number', label: 'Price ($)', required: true, min: 0, defaultValue: 0, input: { prefix: '$', help: 'Retail price' } },
    { field: 'stock', type: 'number', label: 'In stock', min: 0, defaultValue: 0 },
    // Derived: inventory value on hand (display-only, never stored).
    { field: 'stockValue', type: 'number', label: 'Stock value ($)', readonly: true, formula: 'price * stock' },
    { field: 'rating', type: 'number', label: 'Rating', min: 1, max: 5, defaultValue: 3, input: { editorType: 'rating', help: '1-5 customer rating' } },
    { field: 'tags', type: 'text', label: 'Tags', input: { editorType: 'chips', help: 'Merchandising tags' } },
    { field: 'color', type: 'text', label: 'Swatch', input: { editorType: 'color', help: 'Primary colorway' } },
    { field: 'imageUrl', type: 'text', label: 'Image', format: 'url', input: { placeholder: 'https://…' } },
    { field: 'active', type: 'boolean', label: 'Active', defaultValue: true },
  ],
}

const customers: EntitySchema = {
  name: 'customers',
  label: 'Customer',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', format: 'email', required: true },
    { field: 'phone', type: 'text', input: { editorType: 'phone', help: 'Primary contact number' } },
    { field: 'country', type: 'text', label: 'Country', input: { editorType: 'country', help: 'Billing country' } },
    { field: 'tier', type: 'enum', required: true, options: [
      { value: 'free', label: 'Free', color: '#94a3b8' },
      { value: 'plus', label: 'Plus', color: '#6366f1' },
      { value: 'vip', label: 'VIP', color: '#f59e0b' },
    ] },
    { field: 'joinedAt', type: 'datetime', label: 'Joined', input: { help: 'Signup date and time' } },
    { field: 'active', type: 'boolean', defaultValue: true },
  ],
}

const orders: EntitySchema = {
  name: 'orders',
  label: 'Order',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'ref', type: 'text', label: 'Reference' },
    { field: 'customerId', type: 'relation', label: 'Customer', relation: { entity: 'customers', foreignKey: 'customerId', labelField: 'name' } },
    { field: 'status', type: 'enum', required: true, options: [
      { value: 'pending', label: 'Pending', color: '#f59e0b' },
      { value: 'paid', label: 'Paid', color: '#6366f1' },
      { value: 'shipped', label: 'Shipped', color: '#10b981' },
      { value: 'refunded', label: 'Refunded', color: '#ef4444' },
    ] },
    { field: 'total', type: 'number', label: 'Total ($)', required: true, min: 0, input: { prefix: '$' } },
    { field: 'discount', type: 'number', label: 'Discount (%)', min: 0, max: 100, defaultValue: 0, input: { editorType: 'slider', help: 'Order-level discount' } },
    // Derived: revenue after the discount is applied (display-only).
    { field: 'net', type: 'number', label: 'Net ($)', readonly: true, formula: 'total - total * discount / 100' },
    { field: 'placedAt', type: 'datetime', label: 'Placed' },
  ],
}

// Order grid formatting: status pills plus numeric thresholds - big-ticket orders
// green + bold, tiny orders muted, and steep discounts flagged red so margin risk
// pops without reading a number.
const orderFormats: FormatRule[] = [
  ...statusPills(orders, 'status'),
  { field: 'total', op: 'gte', value: 500, color: '#16a34a', bold: true },
  { field: 'total', op: 'lt', value: 100, color: '#94a3b8' },
  { field: 'discount', op: 'gte', value: 20, color: '#dc2626', bold: true },
]

// Product grid formatting: category pills plus stock thresholds - out-of-stock /
// low stock red + bold, healthy stock green, and premium prices bold.
const productFormats: FormatRule[] = [
  ...statusPills(products, 'category'),
  { field: 'stock', op: 'lt', value: 10, color: '#dc2626', bold: true },
  { field: 'stock', op: 'gte', value: 200, color: '#16a34a' },
  { field: 'price', op: 'gte', value: 300, bold: true },
]

const seed = {
  products: [
    { id: 'p1', name: 'Mechanical Keyboard', sku: 'ELE-01001', category: 'electronics', price: 120, stock: 42, rating: 5, tags: ['Bestseller', 'New'], color: '#111827', imageUrl: 'https://cdn.shopadmin.io/p/keyboard.png', active: true },
    { id: 'p2', name: 'Standing Desk', sku: 'HOM-02002', category: 'home', price: 480, stock: 12, rating: 4, tags: ['Ergonomic'], color: '#a16207', imageUrl: 'https://cdn.shopadmin.io/p/desk.png', active: true },
    { id: 'p3', name: 'Noise-Cancelling Headphones', sku: 'ELE-01003', category: 'electronics', price: 260, stock: 0, rating: 4, tags: ['Premium', 'Audio'], color: '#1e3a8a', imageUrl: 'https://cdn.shopadmin.io/p/headphones.png', active: false },
    { id: 'p4', name: 'Ergonomic Mouse', sku: 'ELE-01004', category: 'electronics', price: 60, stock: 130, rating: 5, tags: ['Ergonomic', 'Wireless'], color: '#374151', imageUrl: 'https://cdn.shopadmin.io/p/mouse.png', active: true },
    { id: 'p5', name: 'Desk Lamp', sku: 'HOM-02005', category: 'home', price: 45, stock: 88, rating: 3, tags: ['Home'], color: '#f59e0b', imageUrl: 'https://cdn.shopadmin.io/p/lamp.png', active: true },
    { id: 'p6', name: 'Cotton Hoodie', sku: 'APP-03006', category: 'apparel', price: 55, stock: 210, rating: 4, tags: ['Cotton', 'Casual'], color: '#6366f1', imageUrl: 'https://cdn.shopadmin.io/p/hoodie.png', active: true },
    { id: 'p7', name: 'Notebook Pack', sku: 'OFF-04007', category: 'office', price: 18, stock: 500, rating: 5, tags: ['Bulk'], color: '#10b981', imageUrl: 'https://cdn.shopadmin.io/p/notebook.png', active: true },
  ],
  customers: [
    { id: 'c1', name: 'Ada Lovelace', email: 'ada@analytic.io', phone: '+1 (415) 555-0110', country: 'United States', tier: 'vip', joinedAt: '2025-01-15T09:20:00Z', active: true },
    { id: 'c2', name: 'Alan Turing', email: 'alan@bletchley.uk', phone: '+44 20 7946 0111', country: 'United Kingdom', tier: 'plus', joinedAt: '2025-03-02T14:05:00Z', active: true },
    { id: 'c3', name: 'Grace Hopper', email: 'grace@navy.mil', phone: '+1 (202) 555-0112', country: 'United States', tier: 'vip', joinedAt: '2024-11-08T11:45:00Z', active: true },
    { id: 'c4', name: 'Linus Torvalds', email: 'linus@kernel.org', phone: '+358 9 5550113', country: 'Finland', tier: 'plus', joinedAt: '2025-05-21T08:30:00Z', active: true },
    { id: 'c5', name: 'Barbara Liskov', email: 'barbara@sub.dev', phone: '+1 (650) 555-0114', country: 'United States', tier: 'free', joinedAt: '2025-02-17T16:10:00Z', active: false },
    { id: 'c6', name: 'Guido van Rossum', email: 'guido@py.org', phone: '+31 20 5550115', country: 'Netherlands', tier: 'plus', joinedAt: '2025-04-09T10:00:00Z', active: true },
  ],
  orders: [
    { id: 'o1', ref: 'ORD-1001', customerId: 'c1', status: 'shipped', total: 640, discount: 10, placedAt: '2026-06-12T14:30:00Z' },
    { id: 'o2', ref: 'ORD-1002', customerId: 'c2', status: 'paid', total: 120, discount: 0, placedAt: '2026-06-18T09:15:00Z' },
    { id: 'o3', ref: 'ORD-1003', customerId: 'c3', status: 'pending', total: 305, discount: 15, placedAt: '2026-07-01T18:40:00Z' },
    { id: 'o4', ref: 'ORD-1004', customerId: 'c1', status: 'refunded', total: 260, discount: 0, placedAt: '2026-05-22T12:05:00Z' },
    { id: 'o5', ref: 'ORD-1005', customerId: 'c4', status: 'shipped', total: 78, discount: 5, placedAt: '2026-07-03T07:50:00Z' },
    { id: 'o6', ref: 'ORD-1006', customerId: 'c6', status: 'paid', total: 540, discount: 20, placedAt: '2026-07-08T20:25:00Z' },
    { id: 'o7', ref: 'ORD-1007', customerId: 'c3', status: 'pending', total: 45, discount: 0, placedAt: '2026-07-10T13:00:00Z' },
    { id: 'o8', ref: 'ORD-1008', customerId: 'c2', status: 'shipped', total: 198, discount: 25, placedAt: '2026-06-28T15:35:00Z' },
  ],
}

export const ecommerce: SampleApp = {
  id: 'ecommerce',
  name: 'E-commerce admin',
  description: 'Products, customers and orders - enterprise revenue + catalog dashboards (KPI revenue sparkline + target, gauges, area sales trend, category x stock pivot, tabbed breakdowns), filtered status-pill grids with low-stock red formatting and row actions, per-customer order-history master/detail, and rich edit forms (SKU mask, star rating, tags, color swatch, phone, country, discount slider).',
  emoji: '\u{1F6D2}',
  accent: '#10b981',
  build: () => {
    const productRows = pad(products, seed.products, 18)
    const customerRows = pad(customers, seed.customers, 16)
    const orderRows = pad(orders, seed.orders, 34, { customerId: ids(customerRows) })
    return project({
      title: 'Shop Admin',
      brand: 'Shop Admin',
      accent: '#10b981',
      preset: 'vercel',
      navStyle: 'top-nav',
      footer: '© Shop Inc.',
      entities: [products, customers, orders],
      seed: { products: productRows, customers: customerRows, orders: orderRows },
      screens: [
        // Revenue dashboard: KPI cards (a revenue card with a sparkline over placed
        // dates + a $12k target), a target gauge, a status breakdown + pie, a
        // sales-over-time area trend, a tabbed breakdown, and a status-pill order grid.
        dashScreen(orders, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Revenue', measure: 'total', reduce: 'sum', format: 'currency', trendField: 'placedAt', trendReduce: 'sum', target: 12000, span: 1 },
          { kpi: 'Orders', reduce: 'count', span: 1 },
          { kpi: 'Avg order', measure: 'total', reduce: 'avg', format: 'currency', span: 1 },
          { gauge: 'Revenue vs $15k target', measure: 'total', reduce: 'sum', min: 0, max: 15000, unit: '$', span: 1 },
          { chart: 'status', measure: 'total', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'placedAt', measure: 'total', reduce: 'sum', type: 'area', span: 3 },
          { tabs: [
            { label: 'Revenue by status', tiles: [{ chart: 'status', measure: 'total', reduce: 'sum', type: 'bar' }] },
            { label: 'Orders by status', tiles: [{ chart: 'status', reduce: 'count', type: 'bar' }] },
          ], span: 3 },
          { grid: true, format: orderFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Catalog dashboard: stock + price KPIs (units compact-formatted), a rating
        // gauge, category breakdowns, a category x active pivot of stock, a faceted
        // filter, and a product grid with low-stock red formatting + inline edit.
        // Fulfillment board: orders as cards in status columns (pending/paid/shipped/refunded).
        boardScreen(orders, { id: 'board', title: 'Fulfillment', order: 1 }, { groupBy: 'status', titleField: 'ref', badgeField: 'total', filter: ['status', 'customerId'] }),
        // Customer 360: shopper header (tier pill) with an order-history timeline
        // (by placed date, colored by fulfillment status, $ order totals).
        detailScreen(customers, { id: 'customer-360', title: 'Customer 360', order: 2 }, {
          titleField: 'name', subtitleField: 'country', statusField: 'tier',
          related: [{ entity: 'orders', foreignKey: 'customerId', label: 'Orders', titleField: 'ref', subtitleField: 'total', dateField: 'placedAt', statusField: 'status' }],
        }),
        dashScreen(products, { id: 'catalog', title: 'Catalog', order: 3 }, [
          { kpi: 'Products', reduce: 'count', span: 1 },
          { kpi: 'Units in stock', measure: 'stock', reduce: 'sum', format: 'compact', span: 1 },
          { kpi: 'Avg price', measure: 'price', reduce: 'avg', format: 'currency', span: 1 },
          { gauge: 'Avg rating', measure: 'rating', reduce: 'avg', min: 0, max: 5, span: 1 },
          { chart: 'category', measure: 'stock', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'category', reduce: 'count', type: 'pie', span: 1 },
          { pivot: { rows: ['category'], cols: ['active'], measure: 'stock', aggregate: 'sum' }, span: 3 },
          { filter: ['category', 'active'], span: 3 },
          { grid: true, format: productFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        screen(customers, 'master-detail', { id: 'customers', title: 'Customers', order: 4, child: orders, foreignKey: 'customerId', linkScreen: 'customer-360' }),
        formScreen(products, { id: 'products', title: 'Products', order: 5 }, undefined, { format: productFormats, summaries: true, rowActions: [{ kind: 'edit' }] }, ['category', 'tags', 'active']),
        formScreen(orders, { id: 'orders', title: 'Orders', order: 6 }, undefined, { format: orderFormats, summaries: true, rowActions: [{ kind: 'edit' }] }, ['status', 'customerId']),
      ],
    })
  },
}
