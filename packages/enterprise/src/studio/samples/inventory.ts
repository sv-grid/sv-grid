import type { EntitySchema } from '../../schema.js'
import { screen, project, dashScreen, type SampleApp } from './shared.js'

const suppliers: EntitySchema = {
  name: 'suppliers',
  label: 'Supplier',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'country', type: 'text' },
    { field: 'rating', type: 'number', label: 'Rating' },
  ],
}

const products: EntitySchema = {
  name: 'products',
  label: 'Product',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'sku', type: 'text', label: 'SKU' },
    { field: 'category', type: 'enum', options: [
      { value: 'electronics', label: 'Electronics', color: '#6366f1' },
      { value: 'office', label: 'Office', color: '#0ea5e9' },
      { value: 'home', label: 'Home', color: '#10b981' },
      { value: 'tools', label: 'Tools', color: '#f59e0b' },
    ] },
    { field: 'price', type: 'number', label: 'Price ($)' },
    { field: 'stock', type: 'number', label: 'In stock' },
  ],
}

const purchaseOrders: EntitySchema = {
  name: 'purchaseOrders',
  label: 'Purchase order',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'ref', type: 'text', label: 'Ref', required: true },
    { field: 'supplierId', type: 'relation', label: 'Supplier', relation: { entity: 'suppliers', foreignKey: 'supplierId', labelField: 'name' } },
    { field: 'status', type: 'enum', options: [
      { value: 'draft', label: 'Draft', color: '#94a3b8' },
      { value: 'ordered', label: 'Ordered', color: '#0ea5e9' },
      { value: 'received', label: 'Received', color: '#10b981' },
      { value: 'cancelled', label: 'Cancelled', color: '#ef4444' },
    ] },
    { field: 'total', type: 'number', label: 'Total ($)' },
    { field: 'orderedAt', type: 'date', label: 'Ordered at' },
  ],
}

const seed = {
  suppliers: [
    { id: 'sp1', name: 'Shenzhen Components', country: 'China', rating: 4.6 },
    { id: 'sp2', name: 'Nordic Office Supply', country: 'Sweden', rating: 4.2 },
    { id: 'sp3', name: 'Bavaria Tools', country: 'Germany', rating: 4.8 },
    { id: 'sp4', name: 'Pacific Home Goods', country: 'United States', rating: 3.9 },
    { id: 'sp5', name: 'Kyoto Electronics', country: 'Japan', rating: 4.5 },
    { id: 'sp6', name: 'Toronto Distributors', country: 'Canada', rating: 4.1 },
  ],
  products: [
    { id: 'pr1', name: 'USB-C Hub', sku: 'ELEC-001', category: 'electronics', price: 39, stock: 420 },
    { id: 'pr2', name: 'Standing Desk', sku: 'OFF-101', category: 'office', price: 480, stock: 35 },
    { id: 'pr3', name: 'Ceramic Mug Set', sku: 'HOME-210', category: 'home', price: 24, stock: 610 },
    { id: 'pr4', name: 'Cordless Drill', sku: 'TOOL-305', category: 'tools', price: 129, stock: 88 },
    { id: 'pr5', name: 'Mechanical Keyboard', sku: 'ELEC-002', category: 'electronics', price: 95, stock: 240 },
    { id: 'pr6', name: 'Ergonomic Chair', sku: 'OFF-102', category: 'office', price: 320, stock: 52 },
    { id: 'pr7', name: 'LED Desk Lamp', sku: 'HOME-211', category: 'home', price: 45, stock: 175 },
  ],
  purchaseOrders: [
    { id: 'po1', ref: 'PO-4001', supplierId: 'sp1', status: 'received', total: 8200, orderedAt: '2026-01-10' },
    { id: 'po2', ref: 'PO-4002', supplierId: 'sp2', status: 'ordered', total: 14500, orderedAt: '2026-02-04' },
    { id: 'po3', ref: 'PO-4003', supplierId: 'sp3', status: 'draft', total: 3300, orderedAt: '2026-02-18' },
    { id: 'po4', ref: 'PO-4004', supplierId: 'sp4', status: 'cancelled', total: 2100, orderedAt: '2026-01-22' },
    { id: 'po5', ref: 'PO-4005', supplierId: 'sp5', status: 'received', total: 19800, orderedAt: '2026-03-01' },
    { id: 'po6', ref: 'PO-4006', supplierId: 'sp6', status: 'ordered', total: 6400, orderedAt: '2026-03-12' },
  ],
}

export const inventory: SampleApp = {
  id: 'inventory',
  name: 'Inventory',
  description: 'Products, suppliers and purchase orders - stock levels and spend at a glance.',
  emoji: '\u{1F4E6}',
  accent: '#f59e0b',
  build: () =>
    project({
      title: 'Warehouse',
      brand: 'Warehouse',
      accent: '#f59e0b',
      footer: '',
      entities: [suppliers, products, purchaseOrders],
      seed,
      screens: [
        dashScreen(products, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Products', reduce: 'count' },
          { kpi: 'Total stock', measure: 'stock', reduce: 'sum' },
          { kpi: 'Avg price', measure: 'price', reduce: 'avg' },
          { chart: 'category', measure: 'stock', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Top price', measure: 'price', reduce: 'max', span: 1 },
          { chart: 'category', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, span: 3 },
        ]),
        screen(suppliers, 'master-detail', { id: 'suppliers', title: 'Suppliers', order: 1, child: purchaseOrders, foreignKey: 'supplierId' }),
        screen(products, 'crud', { id: 'products', title: 'Products', order: 2 }),
        screen(purchaseOrders, 'crud', { id: 'purchaseOrders', title: 'Purchase orders', order: 3 }),
      ],
    }),
}
