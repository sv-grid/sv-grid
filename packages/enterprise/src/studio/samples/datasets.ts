/**
 * Starter datasets for the guided "new app" flow.
 *
 * Where `sampleApps` are finished, hand-laid-out showcases, these are just DATA:
 * a small pair of related entities plus realistic seed rows. The guided wizard
 * (and `svgrid-studio init`) feeds them through `crudAppFromSchemas`, so the
 * user sees the same generated app shape they would get from their own database
 * - only without having to connect one first.
 *
 * Each dataset carries a parent and a child linked by a relation, plus at least
 * one colored enum, so the generated app has status pills, a chart dimension and
 * a related-records tab out of the box.
 *
 * Pure + node-safe: `build()` returns fresh data on every call.
 */
import type { EntitySchema } from '../../schema.js'
import { pad, ids } from './shared.js'

type Row = Record<string, unknown>

/** A ready-made pair of entities + seed rows, offered as a starting point. */
export type StarterDataset = {
  /** Stable id (also the wizard / CLI selection value). */
  id: string
  /** Display name, e.g. "Customers & orders". */
  name: string
  /** One-line description for the picker card. */
  description: string
  /** A single emoji used as the card icon. */
  emoji: string
  /** Build the schemas + seed (fresh each call). */
  build: () => { entities: EntitySchema[]; seed: Record<string, Row[]> }
}

// --- 1. Customers & orders ---------------------------------------------------

function customersOrders(): { entities: EntitySchema[]; seed: Record<string, Row[]> } {
  const customers: EntitySchema = {
    name: 'customers',
    label: 'Customer',
    idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, readonly: true },
      { field: 'name', type: 'text', label: 'Customer', required: true, minLength: 2 },
      { field: 'email', type: 'text', label: 'Email', format: 'email' },
      { field: 'city', type: 'text', label: 'City' },
      { field: 'tier', type: 'enum', label: 'Tier', options: [
        { value: 'free', label: 'Free', color: '#64748b' },
        { value: 'pro', label: 'Pro', color: '#2563eb' },
        { value: 'enterprise', label: 'Enterprise', color: '#7c3aed' },
      ] },
      { field: 'since', type: 'dateString', label: 'Customer since' },
    ],
  }
  const orders: EntitySchema = {
    name: 'orders',
    label: 'Order',
    idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, readonly: true },
      { field: 'reference', type: 'text', label: 'Reference', required: true },
      { field: 'customer_id', type: 'relation', label: 'Customer', relation: { entity: 'customers', labelField: 'name' } },
      { field: 'total', type: 'number', label: 'Total ($)', min: 0 },
      { field: 'status', type: 'enum', label: 'Status', options: [
        { value: 'pending', label: 'Pending', color: '#f59e0b' },
        { value: 'paid', label: 'Paid', color: '#16a34a' },
        { value: 'shipped', label: 'Shipped', color: '#2563eb' },
        { value: 'refunded', label: 'Refunded', color: '#dc2626' },
      ] },
      { field: 'placed', type: 'dateString', label: 'Placed' },
    ],
  }
  const customerRows: Row[] = [
    { id: 'cu1', name: 'Northwind Traders', email: 'ops@northwind.test', city: 'Seattle', tier: 'enterprise', since: '2023-02-14' },
    { id: 'cu2', name: 'Blue Harbour Foods', email: 'hello@blueharbour.test', city: 'Bristol', tier: 'pro', since: '2024-06-02' },
    { id: 'cu3', name: 'Cedar & Co', email: 'accounts@cedar.test', city: 'Toronto', tier: 'pro', since: '2024-11-19' },
    { id: 'cu4', name: 'Meridian Labs', email: 'buy@meridian.test', city: 'Berlin', tier: 'free', since: '2025-03-08' },
    { id: 'cu5', name: 'Fairlight Studio', email: 'studio@fairlight.test', city: 'Melbourne', tier: 'pro', since: '2025-05-21' },
    { id: 'cu6', name: 'Alpine Outfitters', email: 'orders@alpine.test', city: 'Zurich', tier: 'enterprise', since: '2022-09-30' },
  ]
  const orderRows: Row[] = [
    { id: 'or1', reference: 'INV-1041', customer_id: 'cu1', total: 4820, status: 'paid', placed: '2026-01-12' },
    { id: 'or2', reference: 'INV-1042', customer_id: 'cu2', total: 615, status: 'shipped', placed: '2026-01-15' },
    { id: 'or3', reference: 'INV-1043', customer_id: 'cu1', total: 1290, status: 'pending', placed: '2026-01-19' },
    { id: 'or4', reference: 'INV-1044', customer_id: 'cu3', total: 340, status: 'refunded', placed: '2026-01-23' },
    { id: 'or5', reference: 'INV-1045', customer_id: 'cu6', total: 7150, status: 'paid', placed: '2026-02-02' },
  ]
  return {
    entities: [customers, orders],
    seed: {
      customers: pad(customers, customerRows, 24),
      orders: pad(orders, orderRows, 40, { customer_id: ids(customerRows) }),
    },
  }
}

// --- 2. Products & categories ------------------------------------------------

function productsCategories(): { entities: EntitySchema[]; seed: Record<string, Row[]> } {
  const categories: EntitySchema = {
    name: 'categories',
    label: 'Category',
    idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, readonly: true },
      { field: 'name', type: 'text', label: 'Category', required: true },
      { field: 'description', type: 'text', label: 'Description' },
    ],
  }
  const products: EntitySchema = {
    name: 'products',
    label: 'Product',
    idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, readonly: true },
      { field: 'name', type: 'text', label: 'Product', required: true, minLength: 2 },
      { field: 'category_id', type: 'relation', label: 'Category', relation: { entity: 'categories', labelField: 'name' } },
      { field: 'price', type: 'number', label: 'Price ($)', min: 0 },
      { field: 'stock', type: 'number', label: 'In stock', min: 0 },
      { field: 'status', type: 'enum', label: 'Status', options: [
        { value: 'active', label: 'Active', color: '#16a34a' },
        { value: 'low', label: 'Low stock', color: '#f59e0b' },
        { value: 'discontinued', label: 'Discontinued', color: '#64748b' },
      ] },
    ],
  }
  const categoryRows: Row[] = [
    { id: 'ca1', name: 'Beverages', description: 'Coffee, tea, soft drinks' },
    { id: 'ca2', name: 'Condiments', description: 'Sauces, spreads, seasonings' },
    { id: 'ca3', name: 'Produce', description: 'Fresh fruit and vegetables' },
    { id: 'ca4', name: 'Bakery', description: 'Bread, pastries, cakes' },
    { id: 'ca5', name: 'Household', description: 'Cleaning and kitchen supplies' },
  ]
  const productRows: Row[] = [
    { id: 'pr1', name: 'Single-origin coffee', category_id: 'ca1', price: 14.5, stock: 92, status: 'active' },
    { id: 'pr2', name: 'Green tea sampler', category_id: 'ca1', price: 9.75, stock: 12, status: 'low' },
    { id: 'pr3', name: 'Smoked chilli sauce', category_id: 'ca2', price: 6.2, stock: 240, status: 'active' },
    { id: 'pr4', name: 'Sourdough loaf', category_id: 'ca4', price: 5, stock: 30, status: 'active' },
    { id: 'pr5', name: 'Bamboo dish brush', category_id: 'ca5', price: 4.4, stock: 0, status: 'discontinued' },
  ]
  return {
    entities: [categories, products],
    seed: {
      categories: pad(categories, categoryRows, 12),
      products: pad(products, productRows, 36, { category_id: ids(categoryRows) }),
    },
  }
}

// --- 3. Projects & tasks -----------------------------------------------------

function projectsTasks(): { entities: EntitySchema[]; seed: Record<string, Row[]> } {
  const projects: EntitySchema = {
    name: 'projects',
    label: 'Project',
    idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, readonly: true },
      { field: 'name', type: 'text', label: 'Project', required: true, minLength: 2 },
      { field: 'owner', type: 'text', label: 'Owner' },
      { field: 'status', type: 'enum', label: 'Status', options: [
        { value: 'planning', label: 'Planning', color: '#64748b' },
        { value: 'active', label: 'Active', color: '#2563eb' },
        { value: 'blocked', label: 'Blocked', color: '#dc2626' },
        { value: 'done', label: 'Done', color: '#16a34a' },
      ] },
      { field: 'budget', type: 'number', label: 'Budget ($)', min: 0 },
      { field: 'due', type: 'dateString', label: 'Due' },
    ],
  }
  const tasks: EntitySchema = {
    name: 'tasks',
    label: 'Task',
    idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, readonly: true },
      { field: 'title', type: 'text', label: 'Task', required: true, minLength: 2 },
      { field: 'project_id', type: 'relation', label: 'Project', relation: { entity: 'projects', labelField: 'name' } },
      { field: 'assignee', type: 'text', label: 'Assignee' },
      { field: 'priority', type: 'enum', label: 'Priority', options: [
        { value: 'low', label: 'Low', color: '#64748b' },
        { value: 'medium', label: 'Medium', color: '#f59e0b' },
        { value: 'high', label: 'High', color: '#dc2626' },
      ] },
      { field: 'estimate', type: 'number', label: 'Estimate (h)', min: 0 },
      { field: 'done', type: 'boolean', label: 'Done' },
      { field: 'due', type: 'dateString', label: 'Due' },
    ],
  }
  const projectRows: Row[] = [
    { id: 'pj1', name: 'Website redesign', owner: 'Dana Iqbal', status: 'active', budget: 48000, due: '2026-04-30' },
    { id: 'pj2', name: 'Mobile checkout', owner: 'Sam Oyelaran', status: 'blocked', budget: 96000, due: '2026-06-15' },
    { id: 'pj3', name: 'Warehouse migration', owner: 'Riya Kapoor', status: 'planning', budget: 130000, due: '2026-09-01' },
    { id: 'pj4', name: 'Support portal', owner: 'Theo Marchand', status: 'done', budget: 25000, due: '2025-12-12' },
  ]
  const taskRows: Row[] = [
    { id: 'ts1', title: 'Audit current pages', project_id: 'pj1', assignee: 'Dana Iqbal', priority: 'medium', estimate: 12, done: true, due: '2026-02-10' },
    { id: 'ts2', title: 'New component library', project_id: 'pj1', assignee: 'Nils Berg', priority: 'high', estimate: 40, done: false, due: '2026-03-20' },
    { id: 'ts3', title: 'Payment provider spike', project_id: 'pj2', assignee: 'Sam Oyelaran', priority: 'high', estimate: 16, done: false, due: '2026-02-28' },
    { id: 'ts4', title: 'Inventory data mapping', project_id: 'pj3', assignee: 'Riya Kapoor', priority: 'low', estimate: 24, done: false, due: '2026-05-05' },
  ]
  return {
    entities: [projects, tasks],
    seed: {
      projects: pad(projects, projectRows, 16),
      tasks: pad(tasks, taskRows, 48, { project_id: ids(projectRows) }),
    },
  }
}

// --- 4. Employees & departments ---------------------------------------------

function employeesDepartments(): { entities: EntitySchema[]; seed: Record<string, Row[]> } {
  const departments: EntitySchema = {
    name: 'departments',
    label: 'Department',
    idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, readonly: true },
      { field: 'name', type: 'text', label: 'Department', required: true },
      { field: 'location', type: 'text', label: 'Location' },
      { field: 'headcount', type: 'number', label: 'Headcount', min: 0 },
    ],
  }
  const employees: EntitySchema = {
    name: 'employees',
    label: 'Employee',
    idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, readonly: true },
      { field: 'name', type: 'text', label: 'Name', required: true, minLength: 2 },
      { field: 'email', type: 'text', label: 'Email', format: 'email' },
      { field: 'department_id', type: 'relation', label: 'Department', relation: { entity: 'departments', labelField: 'name' } },
      { field: 'role', type: 'text', label: 'Role' },
      { field: 'salary', type: 'number', label: 'Salary ($)', min: 0 },
      { field: 'status', type: 'enum', label: 'Status', options: [
        { value: 'active', label: 'Active', color: '#16a34a' },
        { value: 'onboarding', label: 'Onboarding', color: '#2563eb' },
        { value: 'leave', label: 'On leave', color: '#f59e0b' },
        { value: 'alumni', label: 'Alumni', color: '#64748b' },
      ] },
      { field: 'started', type: 'dateString', label: 'Start date' },
    ],
  }
  const departmentRows: Row[] = [
    { id: 'de1', name: 'Engineering', location: 'Lisbon', headcount: 42 },
    { id: 'de2', name: 'Sales', location: 'Chicago', headcount: 18 },
    { id: 'de3', name: 'Support', location: 'Manila', headcount: 25 },
    { id: 'de4', name: 'Finance', location: 'London', headcount: 9 },
  ]
  const employeeRows: Row[] = [
    { id: 'em1', name: 'Aisha Rahman', email: 'aisha@example.test', department_id: 'de1', role: 'Staff engineer', salary: 142000, status: 'active', started: '2021-08-16' },
    { id: 'em2', name: 'Marcus Webb', email: 'marcus@example.test', department_id: 'de2', role: 'Account executive', salary: 88000, status: 'active', started: '2023-01-09' },
    { id: 'em3', name: 'Lena Fischer', email: 'lena@example.test', department_id: 'de3', role: 'Support lead', salary: 76000, status: 'leave', started: '2022-04-25' },
    { id: 'em4', name: 'Diego Santos', email: 'diego@example.test', department_id: 'de4', role: 'Financial analyst', salary: 81000, status: 'onboarding', started: '2026-01-05' },
  ]
  return {
    entities: [departments, employees],
    seed: {
      departments: pad(departments, departmentRows, 10),
      employees: pad(employees, employeeRows, 40, { department_id: ids(departmentRows) }),
    },
  }
}

// --- 5. Support tickets ------------------------------------------------------

function ticketsAccounts(): { entities: EntitySchema[]; seed: Record<string, Row[]> } {
  const accounts: EntitySchema = {
    name: 'accounts',
    label: 'Account',
    idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, readonly: true },
      { field: 'company', type: 'text', label: 'Company', required: true, minLength: 2 },
      { field: 'contact', type: 'text', label: 'Primary contact' },
      { field: 'plan', type: 'enum', label: 'Plan', options: [
        { value: 'starter', label: 'Starter', color: '#64748b' },
        { value: 'growth', label: 'Growth', color: '#2563eb' },
        { value: 'scale', label: 'Scale', color: '#7c3aed' },
      ] },
      { field: 'seats', type: 'number', label: 'Seats', min: 1 },
    ],
  }
  const tickets: EntitySchema = {
    name: 'tickets',
    label: 'Ticket',
    idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, readonly: true },
      { field: 'subject', type: 'text', label: 'Subject', required: true, minLength: 3 },
      { field: 'account_id', type: 'relation', label: 'Account', relation: { entity: 'accounts', labelField: 'company' } },
      { field: 'priority', type: 'enum', label: 'Priority', options: [
        { value: 'low', label: 'Low', color: '#64748b' },
        { value: 'normal', label: 'Normal', color: '#2563eb' },
        { value: 'urgent', label: 'Urgent', color: '#dc2626' },
      ] },
      { field: 'status', type: 'enum', label: 'Status', options: [
        { value: 'open', label: 'Open', color: '#f59e0b' },
        { value: 'pending', label: 'Pending', color: '#2563eb' },
        { value: 'solved', label: 'Solved', color: '#16a34a' },
      ] },
      { field: 'hours', type: 'number', label: 'Hours logged', min: 0 },
      { field: 'opened', type: 'dateString', label: 'Opened' },
    ],
  }
  const accountRows: Row[] = [
    { id: 'ac1', company: 'Halcyon Retail', contact: 'Priya Nair', plan: 'scale', seats: 220 },
    { id: 'ac2', company: 'Redwood Clinic', contact: 'Tom Alvarez', plan: 'growth', seats: 45 },
    { id: 'ac3', company: 'Vector Freight', contact: 'Ingrid Holm', plan: 'starter', seats: 8 },
    { id: 'ac4', company: 'Pinehill Academy', contact: 'Joy Adeyemi', plan: 'growth', seats: 60 },
  ]
  const ticketRows: Row[] = [
    { id: 'tk1', subject: 'Export fails on large report', account_id: 'ac1', priority: 'urgent', status: 'open', hours: 3.5, opened: '2026-02-03' },
    { id: 'tk2', subject: 'Add a second admin seat', account_id: 'ac2', priority: 'low', status: 'solved', hours: 0.5, opened: '2026-01-28' },
    { id: 'tk3', subject: 'Webhook retries stop after an hour', account_id: 'ac3', priority: 'normal', status: 'pending', hours: 2, opened: '2026-02-06' },
    { id: 'tk4', subject: 'SSO metadata refresh', account_id: 'ac4', priority: 'normal', status: 'open', hours: 1.25, opened: '2026-02-11' },
  ]
  return {
    entities: [accounts, tickets],
    seed: {
      accounts: pad(accounts, accountRows, 12),
      tickets: pad(tickets, ticketRows, 44, { account_id: ids(accountRows) }),
    },
  }
}

/** Every starter dataset, in picker order. */
export const starterDatasets: StarterDataset[] = [
  { id: 'customers-orders', name: 'Customers & orders', description: 'Accounts with their order history - the classic back-office pair.', emoji: '🧾', build: customersOrders },
  { id: 'products-categories', name: 'Products & categories', description: 'A product catalog with stock levels and categories.', emoji: '📦', build: productsCategories },
  { id: 'projects-tasks', name: 'Projects & tasks', description: 'Project tracker with assignees, priorities and due dates.', emoji: '🗂️', build: projectsTasks },
  { id: 'employees-departments', name: 'Employees & departments', description: 'A staff directory with departments, roles and salaries.', emoji: '👥', build: employeesDepartments },
  { id: 'tickets-accounts', name: 'Support tickets', description: 'Customer accounts with a support queue by priority and status.', emoji: '🎧', build: ticketsAccounts },
]

/** Look up a starter dataset by id. */
export function getStarterDataset(id: string): StarterDataset | undefined {
  return starterDatasets.find((d) => d.id === id)
}
