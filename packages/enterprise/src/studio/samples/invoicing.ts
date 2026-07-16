import type { EntitySchema } from '../../schema.js'
import { screen, project, dashScreen, type SampleApp } from './shared.js'

const clients: EntitySchema = {
  name: 'clients',
  label: 'Client',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'email', type: 'text', format: 'email' },
    { field: 'company', type: 'text', label: 'Company' },
    { field: 'country', type: 'text' },
  ],
}

const invoices: EntitySchema = {
  name: 'invoices',
  label: 'Invoice',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'number', type: 'text', label: 'Number', required: true },
    { field: 'clientId', type: 'relation', label: 'Client', relation: { entity: 'clients', foreignKey: 'clientId', labelField: 'name' } },
    { field: 'status', type: 'enum', options: [
      { value: 'draft', label: 'Draft', color: '#94a3b8' },
      { value: 'sent', label: 'Sent', color: '#0ea5e9' },
      { value: 'paid', label: 'Paid', color: '#10b981' },
      { value: 'overdue', label: 'Overdue', color: '#ef4444' },
    ] },
    { field: 'amount', type: 'number', label: 'Amount ($)' },
    { field: 'issuedAt', type: 'date', label: 'Issued at' },
    { field: 'dueDate', type: 'date', label: 'Due date' },
  ],
}

const seed = {
  clients: [
    { id: 'cl1', name: 'Ada Lovelace', email: 'ada@globex.com', company: 'Globex', country: 'United States' },
    { id: 'cl2', name: 'Alan Turing', email: 'alan@initech.co', company: 'Initech', country: 'United Kingdom' },
    { id: 'cl3', name: 'Grace Hopper', email: 'grace@umbrella.de', company: 'Umbrella', country: 'Germany' },
    { id: 'cl4', name: 'Linus Torvalds', email: 'linus@hooli.com', company: 'Hooli', country: 'United States' },
    { id: 'cl5', name: 'Barbara Liskov', email: 'barbara@soylent.ca', company: 'Soylent', country: 'Canada' },
    { id: 'cl6', name: 'Katherine Johnson', email: 'kj@stark.com', company: 'Stark Industries', country: 'United States' },
  ],
  invoices: [
    { id: 'in1', number: 'INV-2026-001', clientId: 'cl1', status: 'paid', amount: 4800, issuedAt: '2026-01-12', dueDate: '2026-02-11' },
    { id: 'in2', number: 'INV-2026-002', clientId: 'cl2', status: 'sent', amount: 2600, issuedAt: '2026-02-03', dueDate: '2026-03-05' },
    { id: 'in3', number: 'INV-2026-003', clientId: 'cl3', status: 'overdue', amount: 9100, issuedAt: '2026-01-20', dueDate: '2026-02-19' },
    { id: 'in4', number: 'INV-2026-004', clientId: 'cl4', status: 'draft', amount: 1500, issuedAt: '2026-03-01', dueDate: '2026-03-31' },
    { id: 'in5', number: 'INV-2026-005', clientId: 'cl5', status: 'paid', amount: 800, issuedAt: '2026-02-14', dueDate: '2026-03-16' },
    { id: 'in6', number: 'INV-2026-006', clientId: 'cl6', status: 'sent', amount: 13200, issuedAt: '2026-03-08', dueDate: '2026-04-07' },
    { id: 'in7', number: 'INV-2026-007', clientId: 'cl1', status: 'overdue', amount: 3400, issuedAt: '2026-01-05', dueDate: '2026-02-04' },
  ],
}

export const invoicing: SampleApp = {
  id: 'invoicing',
  name: 'Invoicing',
  description: 'Clients and invoices with a revenue dashboard - billed, paid and overdue.',
  emoji: '\u{1F9FE}',
  accent: '#0ea5e9',
  build: () =>
    project({
      title: 'Acme Invoicing',
      brand: 'Acme Invoicing',
      accent: '#0ea5e9',
      footer: '© Acme',
      entities: [clients, invoices],
      seed,
      screens: [
        dashScreen(invoices, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Invoices', reduce: 'count' },
          { kpi: 'Total billed', measure: 'amount', reduce: 'sum' },
          { kpi: 'Avg invoice', measure: 'amount', reduce: 'avg' },
          { chart: 'status', measure: 'amount', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Largest invoice', measure: 'amount', reduce: 'max', span: 1 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, span: 3 },
        ]),
        screen(clients, 'master-detail', { id: 'clients', title: 'Clients', order: 1, child: invoices, foreignKey: 'clientId' }),
        screen(invoices, 'crud', { id: 'invoices', title: 'Invoices', order: 2 }),
        screen(clients, 'crud', { id: 'clientsList', title: 'Clients', order: 3 }),
      ],
    }),
}
