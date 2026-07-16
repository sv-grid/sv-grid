import type { EntitySchema } from '../../schema.js'
import { screen, project, dashScreen, pad, ids, type SampleApp } from './shared.js'

const customers: EntitySchema = {
  name: 'customers',
  label: 'Customer',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'email', type: 'text', format: 'email' },
    { field: 'plan', type: 'enum', options: [
      { value: 'free', label: 'Free', color: '#94a3b8' },
      { value: 'pro', label: 'Pro', color: '#6366f1' },
      { value: 'business', label: 'Business', color: '#f59e0b' },
    ] },
  ],
}

const agents: EntitySchema = {
  name: 'agents',
  label: 'Agent',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'email', type: 'text', format: 'email' },
    { field: 'team', type: 'enum', options: [
      { value: 'billing', label: 'Billing', color: '#10b981' },
      { value: 'technical', label: 'Technical', color: '#6366f1' },
      { value: 'onboarding', label: 'Onboarding', color: '#f59e0b' },
    ] },
  ],
}

const tickets: EntitySchema = {
  name: 'tickets',
  label: 'Ticket',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'subject', type: 'text', required: true },
    { field: 'customerId', type: 'relation', label: 'Customer', relation: { entity: 'customers', foreignKey: 'customerId', labelField: 'name' } },
    { field: 'agentId', type: 'relation', label: 'Agent', relation: { entity: 'agents', foreignKey: 'agentId', labelField: 'name' } },
    { field: 'priority', type: 'enum', options: [
      { value: 'low', label: 'Low', color: '#94a3b8' },
      { value: 'normal', label: 'Normal', color: '#6366f1' },
      { value: 'high', label: 'High', color: '#f59e0b' },
      { value: 'urgent', label: 'Urgent', color: '#ef4444' },
    ] },
    { field: 'status', type: 'enum', options: [
      { value: 'open', label: 'Open', color: '#6366f1' },
      { value: 'pending', label: 'Pending', color: '#f59e0b' },
      { value: 'resolved', label: 'Resolved', color: '#10b981' },
      { value: 'closed', label: 'Closed', color: '#94a3b8' },
    ] },
    { field: 'channel', type: 'enum', options: [
      { value: 'email', label: 'Email' },
      { value: 'chat', label: 'Chat' },
      { value: 'phone', label: 'Phone' },
    ] },
    { field: 'firstResponseMins', type: 'number', label: 'First response (min)' },
    { field: 'satisfaction', type: 'number', label: 'CSAT (1-5)' },
    { field: 'createdAt', type: 'date', label: 'Created' },
  ],
}

const seed = {
  customers: [
    { id: 'c1', name: 'Ada Lovelace', email: 'ada@analytic.io', plan: 'business' },
    { id: 'c2', name: 'Alan Turing', email: 'alan@bletchley.uk', plan: 'pro' },
    { id: 'c3', name: 'Grace Hopper', email: 'grace@navy.mil', plan: 'business' },
    { id: 'c4', name: 'Linus Torvalds', email: 'linus@kernel.org', plan: 'pro' },
    { id: 'c5', name: 'Barbara Liskov', email: 'barbara@sub.dev', plan: 'free' },
  ],
  agents: [
    { id: 'a1', name: 'Sam Rivera', email: 'sam@support.io', team: 'technical' },
    { id: 'a2', name: 'Jamie Chen', email: 'jamie@support.io', team: 'billing' },
    { id: 'a3', name: 'Priya Patel', email: 'priya@support.io', team: 'onboarding' },
  ],
  tickets: [
    { id: 'tk1', subject: 'Cannot reset password', customerId: 'c1', agentId: 'a1', priority: 'high', status: 'open', channel: 'email', firstResponseMins: 12, satisfaction: 4, createdAt: '2026-07-10' },
    { id: 'tk2', subject: 'Invoice discrepancy', customerId: 'c2', agentId: 'a2', priority: 'normal', status: 'pending', channel: 'email', firstResponseMins: 45, satisfaction: 3, createdAt: '2026-07-08' },
    { id: 'tk3', subject: 'API returns 500', customerId: 'c3', agentId: 'a1', priority: 'urgent', status: 'open', channel: 'chat', firstResponseMins: 4, satisfaction: 5, createdAt: '2026-07-12' },
    { id: 'tk4', subject: 'How do I export data?', customerId: 'c4', agentId: 'a3', priority: 'low', status: 'resolved', channel: 'chat', firstResponseMins: 20, satisfaction: 5, createdAt: '2026-07-02' },
    { id: 'tk5', subject: 'Upgrade to Business', customerId: 'c5', agentId: 'a3', priority: 'normal', status: 'closed', channel: 'phone', firstResponseMins: 8, satisfaction: 4, createdAt: '2026-06-28' },
    { id: 'tk6', subject: 'SSO configuration', customerId: 'c1', agentId: 'a1', priority: 'high', status: 'pending', channel: 'email', firstResponseMins: 60, satisfaction: 2, createdAt: '2026-07-11' },
    { id: 'tk7', subject: 'Double charge refund', customerId: 'c2', agentId: 'a2', priority: 'urgent', status: 'resolved', channel: 'phone', firstResponseMins: 15, satisfaction: 4, createdAt: '2026-07-05' },
    { id: 'tk8', subject: 'Feature request: dark mode', customerId: 'c3', agentId: 'a3', priority: 'low', status: 'open', channel: 'chat', firstResponseMins: 90, satisfaction: 3, createdAt: '2026-07-13' },
  ],
}

export const support: SampleApp = {
  id: 'support',
  name: 'Support desk',
  description: 'Tickets, customers and agents - a triage dashboard by status, priority and channel.',
  emoji: '\u{1F3AF}',
  accent: '#0ea5e9',
  build: () => {
    const customerRows = pad(customers, seed.customers, 16)
    const agentRows = pad(agents, seed.agents, 6)
    const ticketRows = pad(tickets, seed.tickets, 36, { customerId: ids(customerRows), agentId: ids(agentRows) })
    return project({
      title: 'Support Desk',
      brand: 'Support Desk',
      accent: '#0ea5e9',
      footer: '',
      entities: [customers, agents, tickets],
      seed: { customers: customerRows, agents: agentRows, tickets: ticketRows },
      screens: [
        dashScreen(tickets, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Tickets', reduce: 'count' },
          { kpi: 'Avg response (min)', measure: 'firstResponseMins', reduce: 'avg' },
          { kpi: 'Avg CSAT', measure: 'satisfaction', reduce: 'avg' },
          { chart: 'status', reduce: 'count', type: 'bar', span: 2 },
          { kpi: 'Slowest (min)', measure: 'firstResponseMins', reduce: 'max', span: 1 },
          { chart: 'priority', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'channel', reduce: 'count', type: 'bar', span: 2 },
          { grid: true, span: 3 },
        ]),
        dashScreen(tickets, { id: 'performance', title: 'Performance', order: 1 }, [
          { kpi: 'Avg response (min)', measure: 'firstResponseMins', reduce: 'avg' },
          { kpi: 'Avg CSAT', measure: 'satisfaction', reduce: 'avg' },
          { kpi: 'Slowest (min)', measure: 'firstResponseMins', reduce: 'max' },
          { chart: 'channel', measure: 'firstResponseMins', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Best CSAT', measure: 'satisfaction', reduce: 'max', span: 1 },
          { chart: 'priority', measure: 'satisfaction', reduce: 'avg', type: 'bar', span: 1 },
          { grid: true, span: 3 },
        ]),
        screen(tickets, 'crud', { id: 'tickets', title: 'Tickets', order: 2 }),
        screen(customers, 'master-detail', { id: 'customers', title: 'Customers', order: 3, child: tickets, foreignKey: 'customerId' }),
        screen(agents, 'crud', { id: 'agents', title: 'Agents', order: 4 }),
      ],
    })
  },
}
