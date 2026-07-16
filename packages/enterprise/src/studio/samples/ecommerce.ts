import type { EntitySchema } from '../../schema.js'
import { screen, project, dashScreen, pad, ids, type SampleApp } from './shared.js'

const products: EntitySchema = {
  name: 'products',
  label: 'Product',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'category', type: 'enum', options: [
      { value: 'electronics', label: 'Electronics', color: '#6366f1' },
      { value: 'home', label: 'Home', color: '#10b981' },
      { value: 'apparel', label: 'Apparel', color: '#f59e0b' },
      { value: 'office', label: 'Office', color: '#0ea5e9' },
    ] },
    { field: 'price', type: 'number', label: 'Price ($)' },
    { field: 'stock', type: 'number', label: 'In stock' },
    { field: 'active', type: 'boolean' },
  ],
}

const customers: EntitySchema = {
  name: 'customers',
  label: 'Customer',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'email', type: 'text', format: 'email' },
    { field: 'country', type: 'text' },
    { field: 'tier', type: 'enum', options: [
      { value: 'free', label: 'Free', color: '#94a3b8' },
      { value: 'plus', label: 'Plus', color: '#6366f1' },
      { value: 'vip', label: 'VIP', color: '#f59e0b' },
    ] },
    { field: 'active', type: 'boolean' },
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
    { field: 'status', type: 'enum', options: [
      { value: 'pending', label: 'Pending', color: '#f59e0b' },
      { value: 'paid', label: 'Paid', color: '#6366f1' },
      { value: 'shipped', label: 'Shipped', color: '#10b981' },
      { value: 'refunded', label: 'Refunded', color: '#ef4444' },
    ] },
    { field: 'total', type: 'number', label: 'Total ($)' },
    { field: 'placedAt', type: 'date', label: 'Placed' },
  ],
}

const seed = {
  products: [
    { id: 'p1', name: 'Mechanical Keyboard', category: 'electronics', price: 120, stock: 42, active: true },
    { id: 'p2', name: 'Standing Desk', category: 'home', price: 480, stock: 12, active: true },
    { id: 'p3', name: 'Noise-Cancelling Headphones', category: 'electronics', price: 260, stock: 0, active: false },
    { id: 'p4', name: 'Ergonomic Mouse', category: 'electronics', price: 60, stock: 130, active: true },
    { id: 'p5', name: 'Desk Lamp', category: 'home', price: 45, stock: 88, active: true },
    { id: 'p6', name: 'Cotton Hoodie', category: 'apparel', price: 55, stock: 210, active: true },
    { id: 'p7', name: 'Notebook Pack', category: 'office', price: 18, stock: 500, active: true },
  ],
  customers: [
    { id: 'c1', name: 'Ada Lovelace', email: 'ada@analytic.io', country: 'United States', tier: 'vip', active: true },
    { id: 'c2', name: 'Alan Turing', email: 'alan@bletchley.uk', country: 'United Kingdom', tier: 'plus', active: true },
    { id: 'c3', name: 'Grace Hopper', email: 'grace@navy.mil', country: 'United States', tier: 'vip', active: true },
    { id: 'c4', name: 'Linus Torvalds', email: 'linus@kernel.org', country: 'Finland', tier: 'plus', active: true },
    { id: 'c5', name: 'Barbara Liskov', email: 'barbara@sub.dev', country: 'United States', tier: 'free', active: false },
    { id: 'c6', name: 'Guido van Rossum', email: 'guido@py.org', country: 'Netherlands', tier: 'plus', active: true },
  ],
  orders: [
    { id: 'o1', ref: 'ORD-1001', customerId: 'c1', status: 'shipped', total: 640, placedAt: '2026-06-12' },
    { id: 'o2', ref: 'ORD-1002', customerId: 'c2', status: 'paid', total: 120, placedAt: '2026-06-18' },
    { id: 'o3', ref: 'ORD-1003', customerId: 'c3', status: 'pending', total: 305, placedAt: '2026-07-01' },
    { id: 'o4', ref: 'ORD-1004', customerId: 'c1', status: 'refunded', total: 260, placedAt: '2026-05-22' },
    { id: 'o5', ref: 'ORD-1005', customerId: 'c4', status: 'shipped', total: 78, placedAt: '2026-07-03' },
    { id: 'o6', ref: 'ORD-1006', customerId: 'c6', status: 'paid', total: 540, placedAt: '2026-07-08' },
    { id: 'o7', ref: 'ORD-1007', customerId: 'c3', status: 'pending', total: 45, placedAt: '2026-07-10' },
    { id: 'o8', ref: 'ORD-1008', customerId: 'c2', status: 'shipped', total: 198, placedAt: '2026-06-28' },
  ],
}

export const ecommerce: SampleApp = {
  id: 'ecommerce',
  name: 'E-commerce admin',
  description: 'Products, customers and orders with a revenue dashboard and per-customer order history.',
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
      footer: '© Shop Inc.',
      entities: [products, customers, orders],
      seed: { products: productRows, customers: customerRows, orders: orderRows },
      screens: [
        dashScreen(orders, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Orders', reduce: 'count' },
          { kpi: 'Revenue', measure: 'total', reduce: 'sum' },
          { kpi: 'Avg order', measure: 'total', reduce: 'avg' },
          { chart: 'status', measure: 'total', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Largest order', measure: 'total', reduce: 'max', span: 1 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, span: 3 },
        ]),
        dashScreen(products, { id: 'catalog', title: 'Catalog', order: 1 }, [
          { kpi: 'Products', reduce: 'count' },
          { kpi: 'Units in stock', measure: 'stock', reduce: 'sum' },
          { kpi: 'Avg price', measure: 'price', reduce: 'avg' },
          { chart: 'category', measure: 'stock', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Priciest', measure: 'price', reduce: 'max', span: 1 },
          { chart: 'category', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, span: 3 },
        ]),
        screen(customers, 'master-detail', { id: 'customers', title: 'Customers', order: 2, child: orders, foreignKey: 'customerId' }),
        screen(products, 'crud', { id: 'products', title: 'Products', order: 3 }),
        screen(orders, 'crud', { id: 'orders', title: 'Orders', order: 4 }),
      ],
    })
  },
}
