/**
 * "Start from live data" gallery: starter `StudioProject`s wired to a REAL data
 * source instead of an in-memory seed - so one click gives you an app that talks
 * to actual Postgres or a live API, then generates a runnable project bound to
 * the same source.
 *
 * These are deliberately separate from `sampleApps` (which are polished,
 * memory-backed, enterprise-layout showcases). A live-data starter's value is
 * the *binding*: embedded Postgres (PGlite), a hosted Supabase project, or a
 * public REST API.
 *
 * Pure + node-safe: plain data built from the same ops the designer uses, so
 * each round-trips through parse/serialize and generates like any project.
 */
import type { EntitySchema } from '../../schema.js'
import { listScreen, dashScreen, detailScreen, type SampleApp } from './shared.js'
import { sanitizeProject, type EntityDataSource, type Screen, type StudioProject, type ShellStyle } from '../project.js'

type Row = Record<string, unknown>

// ---- Northwind schemas (shared by the PGlite + Supabase starters) ----------

const products: EntitySchema = {
  name: 'products',
  label: 'Product',
  idField: 'id',
  fields: [
    { field: 'id', type: 'number', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', label: 'Product', required: true, minLength: 2 },
    { field: 'category_id', type: 'number', label: 'Category #', min: 1, max: 8 },
    { field: 'unit_price', type: 'number', label: 'Unit Price ($)', min: 0 },
    { field: 'units_in_stock', type: 'number', label: 'In Stock', min: 0 },
    { field: 'discontinued', type: 'boolean' },
  ],
}

const customers: EntitySchema = {
  name: 'customers',
  label: 'Customer',
  idField: 'id',
  fields: [
    { field: 'id', type: 'number', primaryKey: true, readonly: true },
    { field: 'company', type: 'text', label: 'Company', required: true, minLength: 2 },
    { field: 'contact', type: 'text', label: 'Contact' },
    { field: 'city', type: 'text', label: 'City' },
    { field: 'country', type: 'text', label: 'Country' },
  ],
}

/** The `order_lines` join view (Supabase) - read-only. */
const orderLines: EntitySchema = {
  name: 'order_lines',
  label: 'Order line',
  idField: 'id',
  fields: [
    { field: 'id', type: 'number', primaryKey: true, readonly: true },
    { field: 'order_id', type: 'number', label: 'Order #', readonly: true },
    { field: 'order_date', type: 'dateString', label: 'Date', readonly: true },
    { field: 'customer', type: 'text', label: 'Customer', readonly: true },
    { field: 'product', type: 'text', label: 'Product', readonly: true },
    { field: 'category', type: 'text', label: 'Category', readonly: true },
    { field: 'quantity', type: 'number', label: 'Qty', readonly: true },
    { field: 'unit_price', type: 'number', label: 'Unit Price ($)', readonly: true },
    { field: 'line_total', type: 'number', label: 'Line Total ($)', readonly: true },
    { field: 'ship_country', type: 'text', label: 'Ship To', readonly: true },
  ],
}

// ---- Curated Northwind seed (for the PGlite starter) ------------------------

const PRODUCTS: Row[] = [
  { id: 1, name: 'Chai', category_id: 1, unit_price: 18, units_in_stock: 39, discontinued: false },
  { id: 2, name: 'Chang', category_id: 1, unit_price: 19, units_in_stock: 17, discontinued: false },
  { id: 3, name: 'Aniseed Syrup', category_id: 2, unit_price: 10, units_in_stock: 13, discontinued: false },
  { id: 4, name: "Chef Anton's Cajun Seasoning", category_id: 2, unit_price: 22, units_in_stock: 53, discontinued: false },
  { id: 5, name: "Grandma's Boysenberry Spread", category_id: 2, unit_price: 25, units_in_stock: 120, discontinued: false },
  { id: 6, name: "Uncle Bob's Organic Dried Pears", category_id: 7, unit_price: 30, units_in_stock: 15, discontinued: false },
  { id: 7, name: 'Northwoods Cranberry Sauce', category_id: 2, unit_price: 40, units_in_stock: 6, discontinued: false },
  { id: 8, name: 'Mishi Kobe Niku', category_id: 6, unit_price: 97, units_in_stock: 29, discontinued: true },
  { id: 9, name: 'Ikura', category_id: 8, unit_price: 31, units_in_stock: 31, discontinued: false },
  { id: 10, name: 'Queso Cabrales', category_id: 4, unit_price: 21, units_in_stock: 22, discontinued: false },
  { id: 11, name: 'Konbu', category_id: 8, unit_price: 6, units_in_stock: 24, discontinued: false },
  { id: 12, name: 'Tofu', category_id: 7, unit_price: 23.25, units_in_stock: 35, discontinued: false },
  { id: 13, name: 'Genen Shouyu', category_id: 2, unit_price: 15.5, units_in_stock: 39, discontinued: false },
  { id: 14, name: 'Pavlova', category_id: 3, unit_price: 17.45, units_in_stock: 29, discontinued: false },
  { id: 15, name: 'Alice Mutton', category_id: 6, unit_price: 39, units_in_stock: 0, discontinued: true },
  { id: 16, name: 'Carnarvon Tigers', category_id: 8, unit_price: 62.5, units_in_stock: 42, discontinued: false },
]

const CUSTOMERS: Row[] = [
  { id: 1, company: 'Alfreds Futterkiste', contact: 'Maria Anders', city: 'Berlin', country: 'Germany' },
  { id: 2, company: 'Ana Trujillo Emparedados', contact: 'Ana Trujillo', city: 'México D.F.', country: 'Mexico' },
  { id: 3, company: 'Antonio Moreno Taquería', contact: 'Antonio Moreno', city: 'México D.F.', country: 'Mexico' },
  { id: 4, company: 'Around the Horn', contact: 'Thomas Hardy', city: 'London', country: 'UK' },
  { id: 5, company: 'Berglunds snabbköp', contact: 'Christina Berglund', city: 'Luleå', country: 'Sweden' },
  { id: 6, company: 'Blauer See Delikatessen', contact: 'Hanna Moos', city: 'Mannheim', country: 'Germany' },
  { id: 7, company: 'Bólido Comidas preparadas', contact: 'Martín Sommer', city: 'Madrid', country: 'Spain' },
  { id: 8, company: "Bon app'", contact: 'Laurence Lebihan', city: 'Marseille', country: 'France' },
  { id: 9, company: 'Bottom-Dollar Markets', contact: 'Elizabeth Lincoln', city: 'Tsawassen', country: 'Canada' },
  { id: 10, company: "B's Beverages", contact: 'Victoria Ashworth', city: 'London', country: 'UK' },
]

// ---- Hosted Supabase sample (see docs/enterprise/studio/supabase-sample.md) --
// Read-only anon RLS, so the publishable key is safe to embed.
const SUPABASE_URL = 'https://rbnnlzgtfzsylllniozo.supabase.co'
const SUPABASE_KEY = 'sb_publishable_SiT7CxGl4Z_Du1opTYbxVA_VQWumPUN'

/** Assemble a starter project from entities + screens + explicit per-entity sources. */
function assemble(opts: {
  title: string
  brand: string
  accent: string
  mode?: 'light' | 'dark'
  preset?: string
  navStyle?: ShellStyle
  entities: EntitySchema[]
  screens: Screen[]
  sources: Record<string, EntityDataSource>
  dataSource: StudioProject['dataSource']
}): StudioProject {
  return sanitizeProject({
    title: opts.title,
    entities: opts.entities,
    screens: opts.screens,
    dataSource: opts.dataSource,
    dataSources: opts.sources,
    theme: {
      accent: opts.accent,
      ...(opts.mode ? { mode: opts.mode } : {}),
      ...(opts.preset ? { preset: opts.preset } : {}),
      shell: { style: opts.navStyle ?? 'sidebar', brand: opts.brand, footer: '', navPosition: 'left' },
    },
  })
}

// ---- Starters ---------------------------------------------------------------

/** Northwind on embedded Postgres (PGlite) - real SQL + CRUD, zero backend. */
const northwindPglite: SampleApp = {
  id: 'live-northwind-pglite',
  name: 'Northwind · Local Postgres',
  description: 'The Northwind sample on a real in-browser Postgres (PGlite). Full CRUD, no server, no keys.',
  emoji: '🐘',
  accent: '#2f6f4f',
  build: () =>
    assemble({
      title: 'Northwind (Local Postgres)',
      brand: 'Northwind',
      accent: '#2f6f4f',
      preset: 'material',
      dataSource: 'pglite',
      entities: [products, customers],
      screens: [
        dashScreen(products, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Products', reduce: 'count', span: 1 },
          { kpi: 'Avg price', measure: 'unit_price', reduce: 'avg', format: 'currency', span: 1 },
          { kpi: 'In stock', measure: 'units_in_stock', reduce: 'sum', span: 1 },
          { kpi: 'Priciest', measure: 'unit_price', reduce: 'max', format: 'currency', span: 1 },
          { chart: 'category_id', measure: 'unit_price', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'discontinued', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, rowLink: { screen: 'product-detail', sourceField: 'id', targetField: 'id' }, span: 3 },
        ]),
        detailScreen(products, { id: 'product-detail', title: 'Product', order: 1 }, {
          titleField: 'name', metricFields: ['unit_price', 'units_in_stock'],
          sections: [{ label: 'Catalog', fields: ['category_id', 'discontinued'] }],
        }),
        listScreen(customers, { id: 'customers', title: 'Customers', order: 2 }, { grid: { rowLink: { screen: 'customer-detail', sourceField: 'id', targetField: 'id' } } }),
        detailScreen(customers, { id: 'customer-detail', title: 'Customer', order: 3 }, {
          titleField: 'company', subtitleField: 'contact',
          sections: [{ label: 'Location', fields: ['city', 'country'] }],
        }),
      ],
      sources: {
        products: { kind: 'pglite', table: 'products', seed: PRODUCTS },
        customers: { kind: 'pglite', table: 'customers', seed: CUSTOMERS },
      },
    }),
}

/** Northwind on a hosted Supabase project - live PostgREST, incl. the join view. */
const northwindSupabase: SampleApp = {
  id: 'live-northwind-supabase',
  name: 'Northwind · Supabase',
  description: 'A hosted, read-only Northwind on Supabase. Browse the five-table order_lines join view live over PostgREST.',
  emoji: '⚡',
  accent: '#3ecf8e',
  build: () =>
    assemble({
      title: 'Northwind (Supabase)',
      brand: 'Northwind',
      accent: '#3ecf8e',
      mode: 'dark',
      preset: 'vercel',
      dataSource: 'supabase',
      entities: [orderLines, products, customers],
      screens: [
        // Sales dashboard over the join view: revenue KPIs + breakdowns by category /
        // country / product, a faceted filter, and the raw order-lines grid.
        dashScreen(orderLines, { id: 'sales', title: 'Sales', order: 0 }, [
          { kpi: 'Line items', reduce: 'count', span: 1 },
          { kpi: 'Revenue', measure: 'line_total', reduce: 'sum', format: 'currency', span: 1 },
          { kpi: 'Avg line', measure: 'line_total', reduce: 'avg', format: 'currency', span: 1 },
          { kpi: 'Units sold', measure: 'quantity', reduce: 'sum', span: 1 },
          { chart: 'category', measure: 'line_total', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'ship_country', measure: 'line_total', reduce: 'sum', type: 'pie', span: 1 },
          { chart: 'product', measure: 'line_total', reduce: 'sum', type: 'bar', span: 3 },
          { filter: ['category', 'ship_country'], span: 3 },
          { grid: true, span: 3 },
        ]),
        listScreen(products, { id: 'products', title: 'Products', order: 1 }, { grid: { rowLink: { screen: 'product-360', sourceField: 'id', targetField: 'id' } } }),
        // Product 360: unit price / stock tiles + a timeline of the order lines for
        // this product. The view has no FK ids, so the timeline matches by name.
        detailScreen(products, { id: 'product-360', title: 'Product', order: 2 }, {
          titleField: 'name', metricFields: ['unit_price', 'units_in_stock'],
          sections: [{ label: 'Catalog', fields: ['category_id', 'discontinued'] }],
          related: [{ entity: 'order_lines', foreignKey: 'product', parentField: 'name', label: 'Orders', titleField: 'customer', subtitleField: 'line_total', dateField: 'order_date' }],
        }),
        listScreen(customers, { id: 'customers', title: 'Customers', order: 3 }, { grid: { rowLink: { screen: 'customer-360', sourceField: 'id', targetField: 'id' } } }),
        // Customer 360: an order-history timeline matched by company name.
        detailScreen(customers, { id: 'customer-360', title: 'Customer', order: 4 }, {
          titleField: 'company', subtitleField: 'contact',
          sections: [{ label: 'Location', fields: ['city', 'country'] }],
          related: [{ entity: 'order_lines', foreignKey: 'customer', parentField: 'company', label: 'Orders', titleField: 'product', subtitleField: 'line_total', dateField: 'order_date' }],
        }),
      ],
      sources: {
        order_lines: { kind: 'supabase', table: 'order_lines', url: SUPABASE_URL, key: SUPABASE_KEY },
        products: { kind: 'supabase', table: 'products', url: SUPABASE_URL, key: SUPABASE_KEY },
        customers: { kind: 'supabase', table: 'customers', url: SUPABASE_URL, key: SUPABASE_KEY },
      },
    }),
}

/** A live public REST feed (DummyJSON products) - no backend, no keys. */
const dummyjsonRest: SampleApp = {
  id: 'live-dummyjson-rest',
  name: 'Products · Live REST',
  description: 'A live product feed from the public DummyJSON API over createRestDataSource. No backend, no keys.',
  emoji: '🛰️',
  accent: '#6d5efc',
  build: () => {
    const restProduct: EntitySchema = {
      name: 'products',
      label: 'Product',
      idField: 'id',
      fields: [
        { field: 'id', type: 'number', primaryKey: true, readonly: true },
        { field: 'title', type: 'text', label: 'Product' },
        { field: 'brand', type: 'text', label: 'Brand' },
        { field: 'category', type: 'text', label: 'Category' },
        { field: 'price', type: 'number', label: 'Price ($)' },
        { field: 'rating', type: 'number', label: 'Rating' },
        { field: 'stock', type: 'number', label: 'Stock' },
      ],
    }
    return assemble({
      title: 'Live Products (REST)',
      brand: 'Live Feed',
      accent: '#6d5efc',
      preset: 'shadcn',
      dataSource: 'rest',
      entities: [restProduct],
      // A page size that covers the whole catalogue: the grid asks for one page,
      // so it reads the entire live feed in a single request. (DummyJSON pages by
      // `skip`, not `offset`, so deep server-paging would need a REST adapter -
      // see docs/enterprise/studio/rest-api.md.)
      screens: [
        // Catalog dashboard: price / rating / stock KPIs + category & brand breakdowns
        // over the live feed, with the grid drilling into a product page.
        dashScreen(restProduct, { id: 'catalog', title: 'Catalog', order: 0 }, [
          { kpi: 'Products', reduce: 'count', span: 1 },
          { kpi: 'Avg price', measure: 'price', reduce: 'avg', format: 'currency', span: 1 },
          { kpi: 'Avg rating', measure: 'rating', reduce: 'avg', span: 1 },
          { kpi: 'In stock', measure: 'stock', reduce: 'sum', span: 1 },
          { chart: 'category', reduce: 'count', type: 'bar', span: 2 },
          { chart: 'brand', measure: 'price', reduce: 'avg', type: 'bar', span: 1 },
          { filter: ['category', 'brand'], span: 3 },
          { grid: true, pageSize: 200, rowLink: { screen: 'product-detail', sourceField: 'id', targetField: 'id' }, span: 3 },
        ]),
        detailScreen(restProduct, { id: 'product-detail', title: 'Product', order: 1 }, {
          titleField: 'title', subtitleField: 'brand', metricFields: ['price', 'rating', 'stock'],
          sections: [{ label: 'Details', fields: ['category', 'brand'] }],
        }),
      ],
      sources: {
        // Rows + total read from DummyJSON's { products, total } envelope. `limit=0`
        // asks DummyJSON for the whole catalogue so the dashboard aggregates it all.
        products: {
          kind: 'rest',
          baseUrl: 'https://dummyjson.com',
          path: 'products',
          method: 'GET',
          params: [{ name: 'limit', location: 'query', type: 'number', value: '0' }],
          rowsPath: 'products',
          totalPath: 'total',
        },
      },
    })
  },
}

/** Starters wired to a real data source, in gallery order. */
export const liveDataSamples: SampleApp[] = [northwindPglite, northwindSupabase, dummyjsonRest]

/** Look up a live-data starter by id. */
export function getLiveDataSample(id: string): SampleApp | undefined {
  return liveDataSamples.find((s) => s.id === id)
}
