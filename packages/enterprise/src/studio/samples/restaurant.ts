import type { EntitySchema } from '../../schema.js'
import { screen, project, dashScreen, type SampleApp } from './shared.js'

const menuItems: EntitySchema = {
  name: 'menuItems',
  label: 'Menu item',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'category', type: 'enum', options: [
      { value: 'starter', label: 'Starter', color: '#6366f1' },
      { value: 'main', label: 'Main', color: '#10b981' },
      { value: 'dessert', label: 'Dessert', color: '#ec4899' },
      { value: 'drink', label: 'Drink', color: '#0ea5e9' },
    ] },
    { field: 'price', type: 'number', label: 'Price ($)' },
    { field: 'available', type: 'boolean', label: 'Available' },
  ],
}

const tables: EntitySchema = {
  name: 'tables',
  label: 'Table',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'seats', type: 'number', label: 'Seats' },
    { field: 'area', type: 'enum', options: [
      { value: 'indoor', label: 'Indoor', color: '#6366f1' },
      { value: 'patio', label: 'Patio', color: '#10b981' },
      { value: 'bar', label: 'Bar', color: '#f59e0b' },
    ] },
  ],
}

const orders: EntitySchema = {
  name: 'orders',
  label: 'Order',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'tableId', type: 'relation', label: 'Table', relation: { entity: 'tables', foreignKey: 'tableId', labelField: 'name' } },
    { field: 'status', type: 'enum', options: [
      { value: 'open', label: 'Open', color: '#0ea5e9' },
      { value: 'served', label: 'Served', color: '#f59e0b' },
      { value: 'paid', label: 'Paid', color: '#10b981' },
      { value: 'void', label: 'Void', color: '#ef4444' },
    ] },
    { field: 'total', type: 'number', label: 'Total ($)' },
    { field: 'guests', type: 'number', label: 'Guests' },
    { field: 'placedAt', type: 'date', label: 'Placed at' },
  ],
}

const seed = {
  menuItems: [
    { id: 'mi1', name: 'Bruschetta', category: 'starter', price: 9, available: true },
    { id: 'mi2', name: 'Caesar Salad', category: 'starter', price: 11, available: true },
    { id: 'mi3', name: 'Margherita Pizza', category: 'main', price: 16, available: true },
    { id: 'mi4', name: 'Ribeye Steak', category: 'main', price: 32, available: true },
    { id: 'mi5', name: 'Tiramisu', category: 'dessert', price: 8, available: true },
    { id: 'mi6', name: 'Espresso', category: 'drink', price: 4, available: true },
    { id: 'mi7', name: 'House Red', category: 'drink', price: 12, available: false },
  ],
  tables: [
    { id: 'tb1', name: 'Table 1', seats: 2, area: 'indoor' },
    { id: 'tb2', name: 'Table 2', seats: 4, area: 'indoor' },
    { id: 'tb3', name: 'Table 5', seats: 6, area: 'patio' },
    { id: 'tb4', name: 'Table 8', seats: 4, area: 'patio' },
    { id: 'tb5', name: 'Bar 1', seats: 1, area: 'bar' },
    { id: 'tb6', name: 'Bar 2', seats: 1, area: 'bar' },
  ],
  orders: [
    { id: 'or1', tableId: 'tb1', status: 'paid', total: 54, guests: 2, placedAt: '2026-07-10' },
    { id: 'or2', tableId: 'tb2', status: 'served', total: 88, guests: 4, placedAt: '2026-07-11' },
    { id: 'or3', tableId: 'tb3', status: 'open', total: 132, guests: 6, placedAt: '2026-07-12' },
    { id: 'or4', tableId: 'tb4', status: 'paid', total: 76, guests: 4, placedAt: '2026-07-12' },
    { id: 'or5', tableId: 'tb5', status: 'void', total: 18, guests: 1, placedAt: '2026-07-13' },
    { id: 'or6', tableId: 'tb1', status: 'open', total: 42, guests: 2, placedAt: '2026-07-14' },
    { id: 'or7', tableId: 'tb3', status: 'served', total: 165, guests: 5, placedAt: '2026-07-14' },
  ],
}

export const restaurant: SampleApp = {
  id: 'restaurant',
  name: 'Restaurant',
  description: 'Menu, tables and orders - sales and order-status dashboards.',
  emoji: '\u{1F37D}',
  accent: '#f97316',
  build: () =>
    project({
      title: 'Bistro',
      brand: 'Bistro',
      accent: '#f97316',
      footer: '',
      entities: [menuItems, tables, orders],
      seed,
      screens: [
        dashScreen(orders, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Orders', reduce: 'count' },
          { kpi: 'Total sales', measure: 'total', reduce: 'sum' },
          { kpi: 'Avg ticket', measure: 'total', reduce: 'avg' },
          { chart: 'status', measure: 'total', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Largest order', measure: 'total', reduce: 'max', span: 1 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, span: 3 },
        ]),
        screen(tables, 'master-detail', { id: 'tables', title: 'Tables', order: 1, child: orders, foreignKey: 'tableId' }),
        screen(orders, 'crud', { id: 'orders', title: 'Orders', order: 2 }),
        screen(menuItems, 'crud', { id: 'menuItems', title: 'Menu items', order: 3 }),
      ],
    }),
}
