import type { EntitySchema } from '../../schema.js'
import type { FormatRule } from '../project.js'
import { screen, formScreen, boardScreen, calendarScreen, project, dashScreen, detailScreen, statusPills, pad, ids, type SampleApp } from './shared.js'

const plans: EntitySchema = {
  name: 'plans',
  label: 'Plan',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2, input: { help: 'Public plan name shown at checkout' } },
    { field: 'price', type: 'number', label: 'Price ($)', required: true, min: 0, defaultValue: 0, input: { prefix: '$', help: 'Recurring charge per interval' } },
    { field: 'interval', type: 'enum', required: true, defaultValue: 'monthly', options: [
      { value: 'monthly', label: 'Monthly', color: '#6366f1' },
      { value: 'yearly', label: 'Yearly', color: '#10b981' },
    ] },
    { field: 'seats', type: 'number', label: 'Included seats', min: 1, defaultValue: 1, input: { help: 'Users allowed on this plan' } },
    { field: 'features', type: 'text', label: 'Included features', input: { editorType: 'chips', help: 'What this plan unlocks' } },
    { field: 'color', type: 'text', label: 'Badge color', defaultValue: '#6366f1', input: { editorType: 'color', help: 'Plan badge in the UI' } },
    { field: 'popular', type: 'boolean', label: 'Featured', defaultValue: false },
  ],
}

const customers: EntitySchema = {
  name: 'customers',
  label: 'Customer',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2, input: { help: 'Billing account name' } },
    { field: 'email', type: 'text', format: 'email', required: true, input: { help: 'Where invoices are sent' } },
    { field: 'phone', type: 'text', label: 'Phone', input: { editorType: 'phone', help: 'Billing contact number' } },
    { field: 'country', type: 'text', label: 'Country', input: { editorType: 'country', help: 'Billing country' } },
    { field: 'taxId', type: 'text', label: 'Tax ID', input: { editorType: 'mask', mask: '##-#######', help: 'VAT / tax registration number' } },
    { field: 'satisfaction', type: 'number', label: 'Satisfaction', min: 1, max: 5, defaultValue: 3, input: { editorType: 'rating', help: '1-5 account health score' } },
    { field: 'since', type: 'date', label: 'Customer since' },
    { field: 'active', type: 'boolean', defaultValue: true },
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
    { field: 'status', type: 'enum', required: true, defaultValue: 'trialing', options: [
      { value: 'trialing', label: 'Trialing', color: '#0ea5e9' },
      { value: 'active', label: 'Active', color: '#10b981' },
      { value: 'past_due', label: 'Past due', color: '#f59e0b' },
      { value: 'canceled', label: 'Canceled', color: '#ef4444' },
    ] },
    { field: 'mrr', type: 'number', label: 'MRR ($)', required: true, min: 0, defaultValue: 0, input: { prefix: '$', help: 'Monthly recurring revenue' } },
    { field: 'seats', type: 'number', label: 'Seats', min: 1, defaultValue: 1, input: { help: 'Provisioned seats' } },
    { field: 'usage', type: 'number', label: 'Usage (%)', min: 0, max: 100, defaultValue: 0, input: { editorType: 'slider', help: 'Share of plan limits consumed' } },
    { field: 'startedAt', type: 'date', label: 'Started at' },
    { field: 'renewsAt', type: 'datetime', label: 'Renews at', input: { editorType: 'datetime', help: 'Next billing timestamp' } },
    // Derived: annualized revenue from the monthly rate (display-only).
    { field: 'annual', type: 'number', label: 'Annual ($)', readonly: true, formula: 'mrr * 12' },
    // Derived: revenue per seat (display-only, never stored).
    { field: 'perSeat', type: 'number', label: 'MRR / seat ($)', readonly: true, formula: 'mrr / seats' },
    { field: 'autoRenew', type: 'boolean', label: 'Auto-renew', defaultValue: true },
  ],
}

// Subscription grid formatting: status pills, plus numeric thresholds (healthy
// MRR green + bold, churned $0 rows red, near-limit usage red + bold, idle usage
// muted) - data-driven color, not just status pills.
const subFormats: FormatRule[] = [
  ...statusPills(subs, 'status'),
  { field: 'mrr', op: 'gte', value: 200, color: '#16a34a', bold: true },
  { field: 'mrr', op: 'eq', value: 0, color: '#dc2626' },
  { field: 'usage', op: 'gte', value: 80, color: '#dc2626', bold: true },
  { field: 'usage', op: 'lt', value: 20, color: '#94a3b8' },
]

const seed = {
  plans: [
    { id: 'pl1', name: 'Starter', price: 29, interval: 'monthly', seats: 3, features: ['Email support', 'Basic analytics'], color: '#6366f1', popular: false },
    { id: 'pl2', name: 'Growth', price: 99, interval: 'monthly', seats: 10, features: ['Priority support', 'Advanced analytics', 'Integrations'], color: '#10b981', popular: true },
    { id: 'pl3', name: 'Scale', price: 299, interval: 'monthly', seats: 25, features: ['SSO', 'Audit logs', 'Dedicated CSM', 'API access'], color: '#8b5cf6', popular: false },
    { id: 'pl4', name: 'Starter Annual', price: 290, interval: 'yearly', seats: 3, features: ['Email support', 'Basic analytics'], color: '#6366f1', popular: false },
    { id: 'pl5', name: 'Growth Annual', price: 990, interval: 'yearly', seats: 10, features: ['Priority support', 'Advanced analytics', 'Integrations'], color: '#10b981', popular: true },
    { id: 'pl6', name: 'Enterprise', price: 2400, interval: 'yearly', seats: 100, features: ['SSO', 'Custom contracts', '24/7 support', 'SLA'], color: '#f59e0b', popular: false },
  ],
  customers: [
    { id: 'cu1', name: 'Northwind Traders', email: 'billing@northwind.com', phone: '+1 (415) 555-0101', country: 'United States', taxId: '12-3456789', satisfaction: 4, since: '2025-03-12', active: true },
    { id: 'cu2', name: 'Fabrikam', email: 'accounts@fabrikam.co', phone: '+44 20 7946 0102', country: 'United Kingdom', taxId: '44-2233445', satisfaction: 3, since: '2025-06-01', active: true },
    { id: 'cu3', name: 'Contoso', email: 'finance@contoso.de', phone: '+49 30 5550103', country: 'Germany', taxId: '49-8877665', satisfaction: 5, since: '2024-11-20', active: true },
    { id: 'cu4', name: 'Adventure Works', email: 'ap@adventure-works.ca', phone: '+1 (416) 555-0104', country: 'Canada', taxId: '11-9988776', satisfaction: 2, since: '2025-01-08', active: true },
    { id: 'cu5', name: 'Tailspin Toys', email: 'billing@tailspin.com', phone: '+61 2 5550 0105', country: 'Australia', taxId: '61-4455667', satisfaction: 3, since: '2025-09-05', active: false },
    { id: 'cu6', name: 'Wingtip', email: 'accounts@wingtip.io', phone: '+1 (212) 555-0106', country: 'United States', taxId: '13-2211009', satisfaction: 4, since: '2026-02-18', active: true },
  ],
  subscriptions: [
    { id: 'sb1', customerId: 'cu1', planId: 'pl2', status: 'active', mrr: 99, seats: 10, usage: 72, startedAt: '2026-01-15', renewsAt: '2026-08-15T09:00:00Z', autoRenew: true },
    { id: 'sb2', customerId: 'cu2', planId: 'pl1', status: 'trialing', mrr: 29, seats: 3, usage: 20, startedAt: '2026-07-01', renewsAt: '2026-07-15T09:00:00Z', autoRenew: true },
    { id: 'sb3', customerId: 'cu3', planId: 'pl3', status: 'active', mrr: 299, seats: 25, usage: 88, startedAt: '2025-11-20', renewsAt: '2026-08-20T10:00:00Z', autoRenew: true },
    { id: 'sb4', customerId: 'cu4', planId: 'pl6', status: 'past_due', mrr: 200, seats: 100, usage: 55, startedAt: '2025-09-10', renewsAt: '2026-09-10T09:00:00Z', autoRenew: false },
    { id: 'sb5', customerId: 'cu5', planId: 'pl2', status: 'canceled', mrr: 0, seats: 10, usage: 5, startedAt: '2026-03-05', renewsAt: '2026-09-05T09:00:00Z', autoRenew: false },
    { id: 'sb6', customerId: 'cu6', planId: 'pl5', status: 'active', mrr: 82, seats: 10, usage: 64, startedAt: '2026-02-28', renewsAt: '2027-02-28T09:00:00Z', autoRenew: true },
    { id: 'sb7', customerId: 'cu1', planId: 'pl1', status: 'active', mrr: 29, seats: 3, usage: 41, startedAt: '2026-05-18', renewsAt: '2026-08-18T09:00:00Z', autoRenew: true },
  ],
}

export const subscriptions: SampleApp = {
  id: 'subscriptions',
  name: 'Subscriptions',
  description: 'Customers, plans and subscriptions - revenue + growth + plan dashboards (MRR sparkline over start dates, a $30k target, a usage gauge, status/interval charts, a status x auto-renew pivot, tabs), filtered status-pill grids with row actions, master/detail, and rich edit forms (phone, country, tax-id mask, satisfaction rating, usage slider, feature chips, plan color, renewal datetime).',
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
      preset: 'notion',
      footer: '',
      entities: [plans, customers, subs],
      seed: { plans: planRows, customers: customerRows, subscriptions: subRows },
      screens: [
        // Revenue dashboard: KPI cards (a Total MRR card with a sparkline over start
        // dates + a $30k target), a usage gauge, an MRR-by-status funnel, a pie, a
        // tabbed breakdown, and a status-pill subscription grid with row actions.
        dashScreen(subs, { id: 'overview', title: 'Revenue', order: 0 }, [
          { kpi: 'Total MRR', measure: 'mrr', reduce: 'sum', format: 'currency', trendField: 'startedAt', trendReduce: 'sum', target: 30000, span: 1 },
          { kpi: 'Subscriptions', reduce: 'count', span: 1 },
          { kpi: 'Avg MRR', measure: 'mrr', reduce: 'avg', format: 'currency', span: 1 },
          { gauge: 'Avg usage', measure: 'usage', reduce: 'avg', min: 0, max: 100, unit: '%', span: 1 },
          { chart: 'status', measure: 'mrr', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { tabs: [
            { label: 'MRR by status', tiles: [{ chart: 'status', measure: 'mrr', reduce: 'sum', type: 'bar' }] },
            { label: 'Subscriptions by status', tiles: [{ chart: 'status', reduce: 'count', type: 'bar' }] },
          ], span: 3 },
          { grid: true, format: subFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Growth: revenue + usage KPIs, an MRR-over-time area trend, and a pivot of MRR
        // by status (rows) x auto-renew (columns) to surface churn / non-renewing spend.
        dashScreen(subs, { id: 'growth', title: 'Growth', order: 1 }, [
          { kpi: 'Total MRR', measure: 'mrr', reduce: 'sum', format: 'currency', span: 1 },
          { kpi: 'Avg usage', measure: 'usage', reduce: 'avg', format: 'percent', span: 1 },
          { kpi: 'Largest MRR', measure: 'mrr', reduce: 'max', format: 'currency', span: 1 },
          { chart: 'startedAt', measure: 'mrr', reduce: 'sum', type: 'area', span: 3 },
          { pivot: { rows: ['status'], cols: ['autoRenew'], measure: 'mrr', aggregate: 'sum' }, span: 3 },
        ]),
        // Plans dashboard: pricing KPIs, an average-seats gauge, interval breakdowns, a
        // filter, and a plan grid with interval status pills and inline edit actions.
        dashScreen(plans, { id: 'plans-overview', title: 'Plans', order: 2 }, [
          { kpi: 'Plans', reduce: 'count', span: 1 },
          { kpi: 'Avg price', measure: 'price', reduce: 'avg', format: 'currency', span: 1 },
          { kpi: 'Top price', measure: 'price', reduce: 'max', format: 'currency', span: 1 },
          { gauge: 'Avg seats', measure: 'seats', reduce: 'avg', min: 0, max: 100, span: 1 },
          { chart: 'interval', measure: 'price', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'interval', reduce: 'count', type: 'pie', span: 1 },
          { filter: ['interval', 'popular'], span: 3 },
          { grid: true, format: statusPills(plans, 'interval'), summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Customer 360: a record detail page - header (name + email + satisfaction
        // tile), a tabbed Overview, and a Subscriptions timeline of the customer's subs.
        detailScreen(customers, { id: 'customer-360', title: 'Customer 360', order: 3 }, {
          titleField: 'name', subtitleField: 'email',
          metricFields: ['satisfaction'],
          related: [{ entity: 'subscriptions', foreignKey: 'customerId', label: 'Subscriptions', titleField: 'planId', subtitleField: 'mrr', dateField: 'startedAt', statusField: 'status' }],
        }),
        screen(customers, 'master-detail', { id: 'customers', title: 'Customers', order: 4, child: subs, foreignKey: 'customerId', linkScreen: 'customer-360' }),
        // Subscriptions status board: filter by status / plan / customer, with status
        // pills + numeric thresholds and inline edit.
        formScreen(subs, { id: 'subscriptions', title: 'Subscriptions', order: 5 }, undefined, { format: subFormats, summaries: true, rowActions: [{ kind: 'edit' }] }, ['status', 'planId', 'customerId']),
        formScreen(plans, { id: 'plans-form', title: 'Manage plans', order: 6 }, undefined, { format: statusPills(plans, 'interval'), summaries: true, rowActions: [{ kind: 'edit' }] }, ['interval', 'popular']),
        // Lifecycle board: subscriptions as draggable Kanban lanes by status
        // (Trialing -> Active -> Past due -> Canceled), card = customer + MRR.
        boardScreen(subs, { id: 'board', title: 'Lifecycle', order: 7 }, { groupBy: 'status', titleField: 'customerId', badgeField: 'mrr', subtitleField: 'planId', filter: ['status', 'planId'] }),
        // Renewals calendar: subscriptions placed by their next renewal date.
        calendarScreen(subs, { id: 'renewals', title: 'Renewals', order: 8 }, { dateField: 'renewsAt', titleField: 'customerId', filter: ['status', 'planId'] }),
      ],
    })
  },
}
