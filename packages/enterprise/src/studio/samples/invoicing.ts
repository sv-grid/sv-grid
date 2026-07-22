import type { EntitySchema } from '../../schema.js'
import type { FormatRule } from '../project.js'
import { screen, formScreen, boardScreen, detailScreen, project, dashScreen, statusPills, pad, ids, type SampleApp } from './shared.js'

const clients: EntitySchema = {
  name: 'clients',
  label: 'Client',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', format: 'email', required: true, input: { help: 'Billing contact email' } },
    { field: 'phone', type: 'text', input: { editorType: 'phone', help: 'Primary contact number' } },
    { field: 'company', type: 'text', label: 'Company' },
    { field: 'country', type: 'text', label: 'Country', input: { editorType: 'country', help: 'Billing country' } },
    { field: 'website', type: 'text', format: 'url', input: { placeholder: 'https://…' } },
    { field: 'taxId', type: 'text', label: 'Tax ID', input: { editorType: 'mask', mask: '##-#######', help: 'EIN / VAT number' } },
    { field: 'satisfaction', type: 'number', label: 'Satisfaction', min: 1, max: 5, defaultValue: 3, input: { editorType: 'rating', help: '1-5 relationship score' } },
    { field: 'segments', type: 'text', label: 'Segments', input: { editorType: 'chips', help: 'Account tags / segments' } },
    { field: 'onboardedAt', type: 'datetime', label: 'Onboarded', input: { editorType: 'datetime', help: 'When the client signed on' } },
    { field: 'active', type: 'boolean', label: 'Active', defaultValue: true },
  ],
}

const invoices: EntitySchema = {
  name: 'invoices',
  label: 'Invoice',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'number', type: 'text', label: 'Number', required: true, input: { editorType: 'mask', mask: 'INV-####-###', help: 'Invoice reference' } },
    { field: 'clientId', type: 'relation', label: 'Client', relation: { entity: 'clients', foreignKey: 'clientId', labelField: 'name' } },
    { field: 'status', type: 'enum', required: true, options: [
      { value: 'draft', label: 'Draft', color: '#94a3b8' },
      { value: 'sent', label: 'Sent', color: '#0ea5e9' },
      { value: 'paid', label: 'Paid', color: '#10b981' },
      { value: 'overdue', label: 'Overdue', color: '#ef4444' },
    ] },
    { field: 'subtotal', type: 'number', label: 'Subtotal ($)', required: true, min: 0, input: { help: 'Amount before tax' } },
    { field: 'taxRate', type: 'number', label: 'Tax rate (%)', min: 0, max: 30, defaultValue: 10, input: { editorType: 'slider', help: 'Applied sales tax' } },
    // Derived: subtotal grossed up by the tax rate (display-only, never stored).
    { field: 'total', type: 'number', label: 'Total ($)', readonly: true, formula: 'subtotal + subtotal * taxRate / 100' },
    { field: 'color', type: 'text', label: 'Label color', input: { editorType: 'color', help: 'Swatch used in reports' } },
    { field: 'issueDate', type: 'date', label: 'Issue date' },
    { field: 'dueDate', type: 'date', label: 'Due date' },
    { field: 'notes', type: 'text', label: 'Notes', input: { span: 2, help: 'Internal remarks' } },
  ],
}

// Invoice grid formatting: status pills, plus numeric thresholds - big-ticket
// invoices bold green, tiny invoices muted red - so the grid reads as a
// data-driven ledger, not just colored statuses.
const invoiceFormats: FormatRule[] = [
  ...statusPills(invoices, 'status'),
  { field: 'subtotal', op: 'gte', value: 10000, color: '#16a34a', bold: true },
  { field: 'subtotal', op: 'lt', value: 1000, color: '#dc2626' },
]

// Client grid formatting: satisfaction thresholds (at-risk red, delighted green).
const clientFormats: FormatRule[] = [
  { field: 'satisfaction', op: 'lte', value: 2, color: '#dc2626', bold: true },
  { field: 'satisfaction', op: 'gte', value: 5, color: '#16a34a', bold: true },
]

const seed = {
  clients: [
    { id: 'cl1', name: 'Ada Lovelace', email: 'ada@globex.com', phone: '+1 (415) 555-0101', company: 'Globex', country: 'United States', website: 'https://globex.com', taxId: '12-3456789', satisfaction: 5, segments: ['Enterprise', 'Retainer'], onboardedAt: '2025-09-12T09:30:00.000Z', active: true },
    { id: 'cl2', name: 'Alan Turing', email: 'alan@initech.co', phone: '+44 20 7946 0102', company: 'Initech', country: 'United Kingdom', website: 'https://initech.co', taxId: '98-7654321', satisfaction: 4, segments: ['SMB'], onboardedAt: '2025-11-03T14:15:00.000Z', active: true },
    { id: 'cl3', name: 'Grace Hopper', email: 'grace@umbrella.de', phone: '+49 30 5550103', company: 'Umbrella', country: 'Germany', website: 'https://umbrella.de', taxId: '44-2019876', satisfaction: 5, segments: ['Enterprise', 'Priority'], onboardedAt: '2025-06-21T08:00:00.000Z', active: true },
    { id: 'cl4', name: 'Linus Torvalds', email: 'linus@hooli.com', phone: '+1 (650) 555-0104', company: 'Hooli', country: 'United States', website: 'https://hooli.com', taxId: '31-5558822', satisfaction: 2, segments: ['At risk'], onboardedAt: '2025-03-17T16:45:00.000Z', active: false },
    { id: 'cl5', name: 'Barbara Liskov', email: 'barbara@soylent.ca', phone: '+1 (416) 555-0105', company: 'Soylent', country: 'Canada', website: 'https://soylent.ca', taxId: '77-1002003', satisfaction: 3, segments: ['SMB', 'Trial'], onboardedAt: '2026-01-08T11:20:00.000Z', active: true },
    { id: 'cl6', name: 'Katherine Johnson', email: 'kj@stark.com', phone: '+1 (212) 555-0106', company: 'Stark Industries', country: 'United States', website: 'https://stark.com', taxId: '20-4455667', satisfaction: 5, segments: ['Enterprise'], onboardedAt: '2025-08-29T13:10:00.000Z', active: true },
  ],
  invoices: [
    { id: 'in1', number: 'INV-2026-001', clientId: 'cl1', status: 'paid', subtotal: 4800, taxRate: 8, color: '#10b981', issueDate: '2026-01-12', dueDate: '2026-02-11', notes: 'Q1 platform license' },
    { id: 'in2', number: 'INV-2026-002', clientId: 'cl2', status: 'sent', subtotal: 2600, taxRate: 20, color: '#0ea5e9', issueDate: '2026-02-03', dueDate: '2026-03-05', notes: 'Data pipeline setup' },
    { id: 'in3', number: 'INV-2026-003', clientId: 'cl3', status: 'overdue', subtotal: 9100, taxRate: 19, color: '#ef4444', issueDate: '2026-01-20', dueDate: '2026-02-19', notes: 'Compliance suite - reminder sent' },
    { id: 'in4', number: 'INV-2026-004', clientId: 'cl4', status: 'draft', subtotal: 1500, taxRate: 0, color: '#94a3b8', issueDate: '2026-03-01', dueDate: '2026-03-31', notes: 'Pending scope sign-off' },
    { id: 'in5', number: 'INV-2026-005', clientId: 'cl5', status: 'paid', subtotal: 800, taxRate: 13, color: '#10b981', issueDate: '2026-02-14', dueDate: '2026-03-16', notes: 'Onboarding fee' },
    { id: 'in6', number: 'INV-2026-006', clientId: 'cl6', status: 'sent', subtotal: 13200, taxRate: 8, color: '#0ea5e9', issueDate: '2026-03-08', dueDate: '2026-04-07', notes: 'Annual analytics contract' },
    { id: 'in7', number: 'INV-2026-007', clientId: 'cl1', status: 'overdue', subtotal: 3400, taxRate: 8, color: '#ef4444', issueDate: '2026-01-05', dueDate: '2026-02-04', notes: 'Add-on seats - past due' },
  ],
}

export const invoicing: SampleApp = {
  id: 'invoicing',
  name: 'Invoicing',
  description: 'Clients and invoices - billing + collections + client dashboards (revenue KPI sparkline over issue dates + a target, a revenue gauge, area trend, status pivot, tabbed breakdown), status-pill invoice grids with overdue / big-ticket conditional formatting, drill-through, row actions, master/detail, and rich edit forms.',
  emoji: '\u{1F9FE}',
  accent: '#0ea5e9',
  build: () => {
    const clientRows = pad(clients, seed.clients, 12)
    const pool = ids(clientRows)
    const invoiceRows = pad(invoices, seed.invoices, 30, { clientId: pool })
    return project({
      title: 'Acme Invoicing',
      brand: 'Acme Invoicing',
      accent: '#0ea5e9',
      preset: 'antd',
      footer: '© Acme',
      entities: [clients, invoices],
      seed: { clients: clientRows, invoices: invoiceRows },
      screens: [
        // Billing dashboard: KPI cards (a billed-revenue card with a sparkline over
        // issue dates + a $60k target), a revenue gauge, a status revenue bar, a
        // status pie, a revenue-over-time area trend, a tabbed breakdown, and a
        // status-pill invoice grid with big-ticket / tiny-invoice thresholds.
        dashScreen(invoices, { id: 'overview', title: 'Billing', order: 0 }, [
          { kpi: 'Billed revenue', measure: 'subtotal', reduce: 'sum', format: 'currency', trendField: 'issueDate', trendReduce: 'sum', target: 60000, span: 1 },
          { kpi: 'Invoices', reduce: 'count', span: 1 },
          { kpi: 'Avg invoice', measure: 'subtotal', reduce: 'avg', format: 'currency', span: 1 },
          { gauge: 'Revenue vs $80k target', measure: 'subtotal', reduce: 'sum', min: 0, max: 80000, unit: '$', span: 1 },
          { chart: 'status', measure: 'subtotal', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'issueDate', measure: 'subtotal', reduce: 'sum', type: 'area', span: 3 },
          { tabs: [
            { label: 'Revenue by status', tiles: [{ chart: 'status', measure: 'subtotal', reduce: 'sum', type: 'bar' }] },
            { label: 'Invoices by status', tiles: [{ chart: 'status', reduce: 'count', type: 'bar' }] },
          ], span: 3 },
          { grid: true, format: invoiceFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Collections: outstanding + tax KPIs, a tax-rate gauge, a revenue-over-time
        // area trend, a pivot of revenue by status (rows) x client (columns), and a
        // status-pill grid with inline edit actions.
        // Invoice board: invoices as cards in status columns (draft/sent/paid/overdue).
        boardScreen(invoices, { id: 'board', title: 'Board', order: 1 }, { groupBy: 'status', titleField: 'number', badgeField: 'subtotal', filter: ['status', 'clientId'] }),
        // Client 360: account header + satisfaction tile with a timeline of the
        // client's invoices (by issue date, colored by payment status).
        detailScreen(clients, { id: 'client-360', title: 'Client 360', order: 2 }, {
          titleField: 'name', subtitleField: 'company', metricFields: ['satisfaction'],
          related: [{ entity: 'invoices', foreignKey: 'clientId', label: 'Invoices', titleField: 'number', subtitleField: 'subtotal', dateField: 'issueDate', statusField: 'status' }],
        }),
        dashScreen(invoices, { id: 'collections', title: 'Collections', order: 3 }, [
          { kpi: 'Outstanding', measure: 'subtotal', reduce: 'sum', format: 'currency', span: 1 },
          { kpi: 'Largest invoice', measure: 'subtotal', reduce: 'max', format: 'currency', span: 1 },
          { kpi: 'Avg tax rate', measure: 'taxRate', reduce: 'avg', format: 'percent', span: 1 },
          { gauge: 'Avg tax rate', measure: 'taxRate', reduce: 'avg', min: 0, max: 30, unit: '%', span: 1 },
          { chart: 'issueDate', measure: 'subtotal', reduce: 'sum', type: 'area', span: 3 },
          { pivot: { rows: ['status'], cols: ['clientId'], measure: 'subtotal', aggregate: 'sum' }, span: 3 },
          { grid: true, format: statusPills(invoices, 'status'), summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Clients dashboard: portfolio KPIs, a satisfaction gauge, country + segment
        // breakdowns, a country x active pivot, a faceted filter, and a client grid
        // (satisfaction thresholds) that drills into that client's invoices.
        dashScreen(clients, { id: 'clientsDash', title: 'Clients', order: 4 }, [
          { kpi: 'Clients', reduce: 'count', span: 1 },
          { kpi: 'Avg satisfaction', measure: 'satisfaction', reduce: 'avg', span: 1 },
          { kpi: 'Top satisfaction', measure: 'satisfaction', reduce: 'max', span: 1 },
          { gauge: 'Avg satisfaction', measure: 'satisfaction', reduce: 'avg', min: 0, max: 5, span: 1 },
          { chart: 'country', measure: 'satisfaction', reduce: 'avg', type: 'bar', span: 2 },
          { chart: 'active', reduce: 'count', type: 'pie', span: 1 },
          { pivot: { rows: ['country'], cols: ['active'], measure: 'satisfaction', aggregate: 'avg' }, span: 3 },
          { filter: ['country', 'company', 'active'], span: 3 },
          { grid: true, format: clientFormats, summaries: true, rowLink: { screen: 'invoices', sourceField: 'id', targetField: 'clientId' }, span: 3 },
        ]),
        screen(clients, 'master-detail', { id: 'clients', title: 'Clients book', order: 5, child: invoices, foreignKey: 'clientId', linkScreen: 'client-360' }),
        formScreen(invoices, { id: 'invoices', title: 'Invoices', order: 6 }, undefined, { format: invoiceFormats, summaries: true, rowActions: [{ kind: 'edit' }] }, ['status', 'clientId', 'issueDate']),
        formScreen(clients, { id: 'clientsForm', title: 'Client details', order: 7 }, undefined, { format: clientFormats }, ['country', 'segments', 'active']),
      ],
    })
  },
}
