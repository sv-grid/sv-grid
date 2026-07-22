import type { EntitySchema } from '../../schema.js'
import type { FormatRule } from '../project.js'
import { screen, formScreen, calendarScreen, detailScreen, project, dashScreen, statusPills, pad, ids, type SampleApp } from './shared.js'

const menuItems: EntitySchema = {
  name: 'menuItems',
  label: 'Menu item',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'category', type: 'enum', required: true, options: [
      { value: 'starter', label: 'Starter', color: '#6366f1' },
      { value: 'main', label: 'Main', color: '#10b981' },
      { value: 'dessert', label: 'Dessert', color: '#ec4899' },
      { value: 'drink', label: 'Drink', color: '#0ea5e9' },
    ] },
    { field: 'price', type: 'number', label: 'Price ($)', required: true, min: 0, input: { prefix: '$' } },
    { field: 'dietaryTags', type: 'text', label: 'Dietary tags', input: { editorType: 'chips', help: 'Dietary labels, e.g. Vegan / Gluten-free' } },
    { field: 'spiceLevel', type: 'number', label: 'Spice level', min: 0, max: 5, defaultValue: 0, input: { editorType: 'slider', help: '0 mild to 5 fiery' } },
    { field: 'prepMinutes', type: 'number', label: 'Prep (min)', min: 0 },
    { field: 'rating', type: 'number', label: 'Rating', min: 0, max: 5, input: { editorType: 'rating' } },
    { field: 'available', type: 'boolean', label: 'Available', defaultValue: true },
  ],
}

const tables: EntitySchema = {
  name: 'tables',
  label: 'Table',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'seats', type: 'number', label: 'Seats', required: true, min: 1, max: 20 },
    { field: 'section', type: 'enum', required: true, options: [
      { value: 'indoor', label: 'Indoor', color: '#6366f1' },
      { value: 'patio', label: 'Patio', color: '#10b981' },
      { value: 'bar', label: 'Bar', color: '#f59e0b' },
      { value: 'private', label: 'Private', color: '#a855f7' },
    ] },
    { field: 'color', type: 'text', label: 'Map color', defaultValue: '#6366f1', input: { editorType: 'color', help: 'Swatch used on the floor plan' } },
  ],
}

const orders: EntitySchema = {
  name: 'orders',
  label: 'Order',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'tableId', type: 'relation', label: 'Table', relation: { entity: 'tables', foreignKey: 'tableId', labelField: 'name' } },
    { field: 'status', type: 'enum', required: true, options: [
      { value: 'open', label: 'Open', color: '#0ea5e9' },
      { value: 'served', label: 'Served', color: '#f59e0b' },
      { value: 'paid', label: 'Paid', color: '#10b981' },
      { value: 'void', label: 'Void', color: '#ef4444' },
    ] },
    { field: 'total', type: 'number', label: 'Total ($)', required: true, min: 0, input: { prefix: '$' } },
    { field: 'partySize', type: 'number', label: 'Party size', min: 1, max: 20 },
    { field: 'tipPercent', type: 'number', label: 'Tip (%)', min: 0, max: 30, defaultValue: 15, input: { editorType: 'slider', help: 'Gratuity applied to the total' } },
    // Derived: total plus gratuity (display-only, never stored).
    { field: 'grandTotal', type: 'number', label: 'Grand total ($)', readonly: true, formula: 'total + total * tipPercent / 100' },
    { field: 'customerPhone', type: 'text', label: 'Customer phone', input: { editorType: 'phone' } },
    { field: 'reservationTime', type: 'datetime', label: 'Reservation' },
    { field: 'placedAt', type: 'date', label: 'Placed at' },
  ],
}

const seed = {
  menuItems: [
    { id: 'mi1', name: 'Bruschetta', category: 'starter', price: 9, dietaryTags: ['Vegetarian'], spiceLevel: 0, prepMinutes: 8, rating: 4, available: true },
    { id: 'mi2', name: 'Caesar Salad', category: 'starter', price: 11, dietaryTags: ['Vegetarian', 'Gluten-free'], spiceLevel: 0, prepMinutes: 6, rating: 4, available: true },
    { id: 'mi3', name: 'Margherita Pizza', category: 'main', price: 16, dietaryTags: ['Vegetarian'], spiceLevel: 1, prepMinutes: 14, rating: 5, available: true },
    { id: 'mi4', name: 'Ribeye Steak', category: 'main', price: 32, dietaryTags: ['Gluten-free', 'High-protein'], spiceLevel: 2, prepMinutes: 22, rating: 5, available: true },
    { id: 'mi5', name: 'Spicy Arrabbiata', category: 'main', price: 18, dietaryTags: ['Vegan', 'Spicy'], spiceLevel: 4, prepMinutes: 16, rating: 4, available: true },
    { id: 'mi6', name: 'Tiramisu', category: 'dessert', price: 8, dietaryTags: ['Vegetarian'], spiceLevel: 0, prepMinutes: 5, rating: 5, available: true },
    { id: 'mi7', name: 'Espresso', category: 'drink', price: 4, dietaryTags: ['Vegan'], spiceLevel: 0, prepMinutes: 3, rating: 4, available: true },
    { id: 'mi8', name: 'House Red', category: 'drink', price: 12, dietaryTags: ['Vegan'], spiceLevel: 0, prepMinutes: 2, rating: 3, available: false },
  ],
  tables: [
    { id: 'tb1', name: 'Table 1', seats: 2, section: 'indoor', color: '#6366f1' },
    { id: 'tb2', name: 'Table 2', seats: 4, section: 'indoor', color: '#6366f1' },
    { id: 'tb3', name: 'Table 5', seats: 6, section: 'patio', color: '#10b981' },
    { id: 'tb4', name: 'Table 8', seats: 4, section: 'patio', color: '#10b981' },
    { id: 'tb5', name: 'Bar 1', seats: 1, section: 'bar', color: '#f59e0b' },
    { id: 'tb6', name: 'Bar 2', seats: 1, section: 'bar', color: '#f59e0b' },
    { id: 'tb7', name: 'Salon', seats: 10, section: 'private', color: '#a855f7' },
  ],
  orders: [
    { id: 'or1', tableId: 'tb1', status: 'paid', total: 54, partySize: 2, tipPercent: 18, customerPhone: '+1 (415) 555-0142', reservationTime: '2026-07-10T19:30:00', placedAt: '2026-07-10' },
    { id: 'or2', tableId: 'tb2', status: 'served', total: 88, partySize: 4, tipPercent: 15, customerPhone: '+1 (415) 555-0187', reservationTime: '2026-07-11T20:00:00', placedAt: '2026-07-11' },
    { id: 'or3', tableId: 'tb3', status: 'open', total: 132, partySize: 6, tipPercent: 20, customerPhone: '+1 (628) 555-0110', reservationTime: '2026-07-12T18:45:00', placedAt: '2026-07-12' },
    { id: 'or4', tableId: 'tb4', status: 'paid', total: 76, partySize: 4, tipPercent: 15, customerPhone: '+1 (415) 555-0163', reservationTime: '2026-07-12T21:15:00', placedAt: '2026-07-12' },
    { id: 'or5', tableId: 'tb5', status: 'void', total: 18, partySize: 1, tipPercent: 0, customerPhone: '+1 (510) 555-0199', reservationTime: '2026-07-13T17:30:00', placedAt: '2026-07-13' },
    { id: 'or6', tableId: 'tb1', status: 'open', total: 42, partySize: 2, tipPercent: 18, customerPhone: '+1 (415) 555-0125', reservationTime: '2026-07-14T19:00:00', placedAt: '2026-07-14' },
    { id: 'or7', tableId: 'tb7', status: 'served', total: 265, partySize: 10, tipPercent: 22, customerPhone: '+1 (628) 555-0148', reservationTime: '2026-07-14T20:30:00', placedAt: '2026-07-14' },
  ],
}

// Order grid formatting: status pills, plus numeric thresholds (big tickets bold,
// tiny tickets red, generous tips green + bold) - data-driven color, not just
// status pills.
const orderFormats: FormatRule[] = [
  ...statusPills(orders, 'status'),
  { field: 'total', op: 'gte', value: 150, bold: true },
  { field: 'total', op: 'lt', value: 30, color: '#dc2626' },
  { field: 'tipPercent', op: 'gte', value: 20, color: '#16a34a', bold: true },
]

// Menu grid formatting: category pills, plus spice / rating / price thresholds
// (fiery dishes red + bold, five-star dishes green + bold, premium plates bold).
const menuFormats: FormatRule[] = [
  ...statusPills(menuItems, 'category'),
  { field: 'spiceLevel', op: 'gte', value: 4, color: '#dc2626', bold: true },
  { field: 'rating', op: 'gte', value: 5, color: '#16a34a', bold: true },
  { field: 'price', op: 'gte', value: 25, bold: true },
]

export const restaurant: SampleApp = {
  id: 'restaurant',
  name: 'Restaurant',
  description: 'Menu, tables and orders - sales + menu dashboards (KPI sparkline + target, sales-over-time area trend, order-status pie, day x status pivot, rating gauge, tabs), filtered status-pill grids with row actions, tables/orders master-detail, and rich edit forms (chips, spice slider, rating, color swatch, phone, reservation datetime).',
  emoji: '\u{1F37D}',
  accent: '#f97316',
  build: () => {
    const menuRows = pad(menuItems, seed.menuItems, 40)
    const tableRows = pad(tables, seed.tables, 16)
    const orderRows = pad(orders, seed.orders, 90, { tableId: ids(tableRows) })
    return project({
      title: 'Bistro',
      brand: 'Bistro',
      accent: '#f97316',
      preset: 'bootstrap',
      navStyle: 'top-nav',
      footer: '',
      entities: [menuItems, tables, orders],
      seed: { menuItems: menuRows, tables: tableRows, orders: orderRows },
      screens: [
        // Sales dashboard: KPI cards (a total-sales card with a sparkline over
        // placed dates + a $2k target), a sales-vs-target gauge, a sales-over-time
        // area trend, an order-status pie, a day x status value pivot, a tabbed
        // breakdown, and a status-pill order grid with inline edit actions.
        dashScreen(orders, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Total sales', measure: 'total', reduce: 'sum', format: 'currency', trendField: 'placedAt', trendReduce: 'sum', target: 2000, span: 1 },
          { kpi: 'Orders', reduce: 'count', span: 1 },
          { kpi: 'Avg ticket', measure: 'total', reduce: 'avg', format: 'currency', span: 1 },
          { gauge: 'Sales vs $3k target', measure: 'total', reduce: 'sum', min: 0, max: 3000, unit: '$', span: 1 },
          { chart: 'placedAt', measure: 'total', reduce: 'sum', type: 'area', span: 2 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'status', measure: 'total', reduce: 'sum', type: 'bar', span: 3 },
          { pivot: { rows: ['placedAt'], cols: ['status'], measure: 'total', aggregate: 'sum' }, span: 3 },
          { tabs: [
            { label: 'Sales by status', tiles: [{ chart: 'status', measure: 'total', reduce: 'sum', type: 'bar' }] },
            { label: 'Orders by status', tiles: [{ chart: 'status', reduce: 'count', type: 'bar' }] },
          ], span: 3 },
          { grid: true, format: orderFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Menu dashboard: price / spice / rating KPIs, an average-rating gauge, a
        // price-by-category bar + a category pie, a category x availability price
        // pivot, a tabbed breakdown, a faceted filter, and a category-pill menu grid.
        dashScreen(menuItems, { id: 'menu', title: 'Menu', order: 1 }, [
          { kpi: 'Menu items', reduce: 'count', span: 1 },
          { kpi: 'Avg price', measure: 'price', reduce: 'avg', format: 'currency', span: 1 },
          { kpi: 'Avg spice', measure: 'spiceLevel', reduce: 'avg', span: 1 },
          { gauge: 'Avg rating', measure: 'rating', reduce: 'avg', min: 0, max: 5, span: 1 },
          { chart: 'category', measure: 'price', reduce: 'avg', type: 'bar', span: 2 },
          { chart: 'category', reduce: 'count', type: 'pie', span: 1 },
          { pivot: { rows: ['category'], cols: ['available'], measure: 'price', aggregate: 'avg' }, span: 3 },
          { tabs: [
            { label: 'Price by category', tiles: [{ chart: 'category', measure: 'price', reduce: 'avg', type: 'bar' }] },
            { label: 'Rating by category', tiles: [{ chart: 'category', measure: 'rating', reduce: 'avg', type: 'bar' }] },
          ], span: 3 },
          { filter: ['category', 'available'], span: 3 },
          { grid: true, format: menuFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        calendarScreen(orders, { id: 'reservations', title: 'Reservations', order: 2 }, { dateField: 'reservationTime', titleField: 'tableId', colorField: 'status', filter: ['status', 'tableId'] }),
        detailScreen(tables, { id: 'table-detail', title: 'Table detail', order: 3 }, {
          titleField: 'name', statusField: 'section', metricFields: ['seats'],
          related: [{ entity: 'orders', foreignKey: 'tableId', label: 'Orders', titleField: 'customerPhone', subtitleField: 'total', dateField: 'reservationTime', statusField: 'status' }],
        }),
        screen(tables, 'master-detail', { id: 'tables', title: 'Tables', order: 4, child: orders, foreignKey: 'tableId', linkScreen: 'table-detail' }),
        formScreen(orders, { id: 'orders', title: 'Orders', order: 5 }, undefined, { format: orderFormats, summaries: true, rowActions: [{ kind: 'edit' }] }, ['tableId', 'status']),
        formScreen(menuItems, { id: 'menuItems', title: 'Menu items', order: 6 }, undefined, { format: menuFormats, summaries: true, rowActions: [{ kind: 'edit' }] }, ['category', 'dietaryTags', 'available']),
      ],
    })
  },
}
