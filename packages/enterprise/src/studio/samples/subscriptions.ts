import type { EntitySchema } from '../../schema.js'
import { screen, project, dashScreen, pad, ids, type SampleApp } from './shared.js'

const plans: EntitySchema = {
  name: 'plans',
  label: 'Plan',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'price', type: 'number', label: 'Price ($)' },
    { field: 'interval', type: 'enum', options: [
      { value: 'monthly', label: 'Monthly', color: '#6366f1' },
      { value: 'yearly', label: 'Yearly', color: '#10b981' },
    ] },
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
  ],
}

const subs: EntitySchema = {
  name: 'subscriptions',
  label: 'Subscription',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'customerId', type: 'relation', label: 'Customer', relation: { entity: 'customers', foreignKey: 'customerId', labelField: 'name' } },
    { field: 'planId', type: 'relation', label: 'Plan', relation: { entity: 'plans', foreignKey: 'planId', labelField: 'name' } },
    { field: 'status', type: 'enum', options: [
      { value: 'trialing', label: 'Trialing', color: '#0ea5e9' },
      { value: 'active', label: 'Active', color: '#10b981' },
      { value: 'past_due', label: 'Past due', color: '#f59e0b' },
      { value: 'canceled', label: 'Canceled', color: '#ef4444' },
    ] },
    { field: 'mrr', type: 'number', label: 'MRR ($)' },
    { field: 'startedAt', type: 'date', label: 'Started at' },
  ],
}

const seed = {
  plans: [
    { id: 'pl1', name: 'Starter', price: 29, interval: 'monthly' },
    { id: 'pl2', name: 'Growth', price: 99, interval: 'monthly' },
    { id: 'pl3', name: 'Scale', price: 299, interval: 'monthly' },
    { id: 'pl4', name: 'Starter Annual', price: 290, interval: 'yearly' },
    { id: 'pl5', name: 'Growth Annual', price: 990, interval: 'yearly' },
    { id: 'pl6', name: 'Enterprise', price: 2400, interval: 'yearly' },
  ],
  customers: [
    { id: 'cu1', name: 'Northwind Traders', email: 'billing@northwind.com', country: 'United States' },
    { id: 'cu2', name: 'Fabrikam', email: 'accounts@fabrikam.co', country: 'United Kingdom' },
    { id: 'cu3', name: 'Contoso', email: 'finance@contoso.de', country: 'Germany' },
    { id: 'cu4', name: 'Adventure Works', email: 'ap@adventure-works.ca', country: 'Canada' },
    { id: 'cu5', name: 'Tailspin Toys', email: 'billing@tailspin.com', country: 'Australia' },
    { id: 'cu6', name: 'Wingtip', email: 'accounts@wingtip.io', country: 'United States' },
  ],
  subscriptions: [
    { id: 'sb1', customerId: 'cu1', planId: 'pl2', status: 'active', mrr: 99, startedAt: '2026-01-15' },
    { id: 'sb2', customerId: 'cu2', planId: 'pl1', status: 'trialing', mrr: 29, startedAt: '2026-07-01' },
    { id: 'sb3', customerId: 'cu3', planId: 'pl3', status: 'active', mrr: 299, startedAt: '2025-11-20' },
    { id: 'sb4', customerId: 'cu4', planId: 'pl6', status: 'past_due', mrr: 200, startedAt: '2025-09-10' },
    { id: 'sb5', customerId: 'cu5', planId: 'pl2', status: 'canceled', mrr: 0, startedAt: '2026-03-05' },
    { id: 'sb6', customerId: 'cu6', planId: 'pl5', status: 'active', mrr: 82, startedAt: '2026-02-28' },
    { id: 'sb7', customerId: 'cu1', planId: 'pl1', status: 'active', mrr: 29, startedAt: '2026-05-18' },
  ],
}

export const subscriptions: SampleApp = {
  id: 'subscriptions',
  name: 'Subscriptions',
  description: 'Customers, plans and subscriptions - MRR and status dashboards.',
  emoji: '\u{1F504}',
  accent: '#14b8a6',
  build: () => {
    const planRows = pad(plans, seed.plans, 8)
    const customerRows = pad(customers, seed.customers, 18)
    const subRows = pad(subs, seed.subscriptions, 32, { customerId: ids(customerRows), planId: ids(planRows) })
    return project({
      title: 'SubHub',
      brand: 'SubHub',
      accent: '#14b8a6',
      footer: '',
      entities: [plans, customers, subs],
      seed: { plans: planRows, customers: customerRows, subscriptions: subRows },
      screens: [
        dashScreen(subs, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Subscriptions', reduce: 'count' },
          { kpi: 'Total MRR', measure: 'mrr', reduce: 'sum' },
          { kpi: 'Avg MRR', measure: 'mrr', reduce: 'avg' },
          { chart: 'status', measure: 'mrr', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Largest MRR', measure: 'mrr', reduce: 'max', span: 1 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, span: 3 },
        ]),
        dashScreen(plans, { id: 'plans-overview', title: 'Plans', order: 1 }, [
          { kpi: 'Plans', reduce: 'count' },
          { kpi: 'Avg price', measure: 'price', reduce: 'avg' },
          { kpi: 'Top price', measure: 'price', reduce: 'max' },
          { chart: 'interval', measure: 'price', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Cheapest', measure: 'price', reduce: 'min', span: 1 },
          { chart: 'interval', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, span: 3 },
        ]),
        screen(customers, 'master-detail', { id: 'customers', title: 'Customers', order: 2, child: subs, foreignKey: 'customerId' }),
        screen(subs, 'crud', { id: 'subscriptions', title: 'Subscriptions', order: 3 }),
        screen(plans, 'crud', { id: 'plans', title: 'Plans', order: 4 }),
      ],
    })
  },
}
