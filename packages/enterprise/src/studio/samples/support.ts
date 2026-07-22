import type { EntitySchema } from '../../schema.js'
import { screen, formScreen, boardScreen, detailScreen, project, dashScreen, statusPills, pad, ids, type SampleApp } from './shared.js'

const customers: EntitySchema = {
  name: 'customers',
  label: 'Customer',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', format: 'email', required: true, input: { help: 'Primary contact address' } },
    { field: 'phone', type: 'text', input: { editorType: 'phone', help: 'Support callback number' } },
    { field: 'country', type: 'text', label: 'Country', input: { editorType: 'country', help: 'Billing country' } },
    { field: 'accountNo', type: 'text', label: 'Account #', input: { editorType: 'mask', mask: '####-####', help: 'Internal billing account number' } },
    { field: 'plan', type: 'enum', required: true, defaultValue: 'free', options: [
      { value: 'free', label: 'Free', color: '#94a3b8' },
      { value: 'pro', label: 'Pro', color: '#6366f1' },
      { value: 'business', label: 'Business', color: '#f59e0b' },
    ] },
    { field: 'signupAt', type: 'datetime', label: 'Signed up', input: { editorType: 'datetime', help: 'When the account was created' } },
    { field: 'health', type: 'number', label: 'Account health', min: 1, max: 5, defaultValue: 3, input: { editorType: 'rating', help: '1-5 relationship score' } },
    { field: 'active', type: 'boolean', defaultValue: true },
  ],
}

const agents: EntitySchema = {
  name: 'agents',
  label: 'Agent',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', format: 'email', required: true, input: { help: 'Work address' } },
    { field: 'team', type: 'enum', required: true, defaultValue: 'technical', options: [
      { value: 'billing', label: 'Billing', color: '#10b981' },
      { value: 'technical', label: 'Technical', color: '#6366f1' },
      { value: 'onboarding', label: 'Onboarding', color: '#f59e0b' },
    ] },
    { field: 'phone', type: 'text', input: { editorType: 'phone', help: 'Desk extension' } },
    { field: 'skills', type: 'text', label: 'Skills', input: { editorType: 'chips', help: 'Tools and specialities' } },
    { field: 'capacity', type: 'number', label: 'Capacity (%)', min: 0, max: 100, defaultValue: 80, input: { editorType: 'slider', help: 'Share of a full ticket load' } },
    { field: 'csat', type: 'number', label: 'CSAT', min: 1, max: 5, defaultValue: 3, input: { editorType: 'rating', help: 'Rolling satisfaction score' } },
    { field: 'calendarColor', type: 'text', label: 'Calendar color', defaultValue: '#6366f1', input: { editorType: 'color', help: 'Shown on the shift calendar' } },
    { field: 'active', type: 'boolean', defaultValue: true },
  ],
}

const tickets: EntitySchema = {
  name: 'tickets',
  label: 'Ticket',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'subject', type: 'text', required: true, minLength: 3 },
    { field: 'customerId', type: 'relation', label: 'Customer', relation: { entity: 'customers', foreignKey: 'customerId', labelField: 'name' } },
    { field: 'agentId', type: 'relation', label: 'Agent', relation: { entity: 'agents', foreignKey: 'agentId', labelField: 'name' } },
    { field: 'priority', type: 'enum', required: true, defaultValue: 'normal', options: [
      { value: 'low', label: 'Low', color: '#94a3b8' },
      { value: 'normal', label: 'Normal', color: '#6366f1' },
      { value: 'high', label: 'High', color: '#f59e0b' },
      { value: 'urgent', label: 'Urgent', color: '#ef4444' },
    ] },
    { field: 'status', type: 'enum', required: true, defaultValue: 'open', options: [
      { value: 'open', label: 'Open', color: '#6366f1' },
      { value: 'pending', label: 'Pending', color: '#f59e0b' },
      { value: 'resolved', label: 'Resolved', color: '#10b981' },
      { value: 'closed', label: 'Closed', color: '#94a3b8' },
    ] },
    { field: 'channel', type: 'enum', options: [
      { value: 'email', label: 'Email', color: '#6366f1' },
      { value: 'chat', label: 'Chat', color: '#10b981' },
      { value: 'phone', label: 'Phone', color: '#f59e0b' },
    ] },
    { field: 'tags', type: 'text', label: 'Tags', input: { editorType: 'chips', help: 'Topic labels for routing' } },
    { field: 'createdAt', type: 'datetime', label: 'Created', input: { editorType: 'datetime', help: 'When the ticket was opened' } },
    { field: 'firstResponseMins', type: 'number', label: 'First response (min)', min: 0, input: { help: 'Time to the first agent reply' } },
    { field: 'satisfaction', type: 'number', label: 'CSAT', min: 1, max: 5, input: { editorType: 'rating', help: 'Customer rating on close' } },
    { field: 'estimateHrs', type: 'number', label: 'Estimate (hrs)', min: 0, defaultValue: 1, input: { help: 'Estimated effort to resolve' } },
    { field: 'hourlyRate', type: 'number', label: 'Rate ($/hr)', min: 0, defaultValue: 90, input: { help: 'Billed support rate' } },
    // Derived: estimated support cost for the ticket (display-only, never seeded).
    { field: 'cost', type: 'number', label: 'Cost ($)', readonly: true, formula: 'estimateHrs * hourlyRate' },
  ],
}

const seed = {
  customers: [
    { id: 'c1', name: 'Ada Lovelace', email: 'ada@analytic.io', phone: '+1 (415) 555-0101', country: 'United States', accountNo: '4021-7788', plan: 'business', signupAt: '2025-09-12T09:15:00Z', health: 5, active: true },
    { id: 'c2', name: 'Alan Turing', email: 'alan@bletchley.uk', phone: '+44 20 7946 0102', country: 'United Kingdom', accountNo: '5590-2143', plan: 'pro', signupAt: '2025-11-03T14:20:00Z', health: 4, active: true },
    { id: 'c3', name: 'Grace Hopper', email: 'grace@navy.mil', phone: '+1 (202) 555-0103', country: 'United States', accountNo: '7781-6620', plan: 'business', signupAt: '2026-01-21T10:05:00Z', health: 5, active: true },
    { id: 'c4', name: 'Linus Torvalds', email: 'linus@kernel.org', phone: '+1 (503) 555-0104', country: 'United States', accountNo: '3312-9087', plan: 'pro', signupAt: '2026-03-08T08:45:00Z', health: 3, active: true },
    { id: 'c5', name: 'Barbara Liskov', email: 'barbara@sub.dev', phone: '+1 (617) 555-0105', country: 'United States', accountNo: '9001-4455', plan: 'free', signupAt: '2026-05-30T16:30:00Z', health: 2, active: false },
  ],
  agents: [
    { id: 'a1', name: 'Sam Rivera', email: 'sam@support.io', team: 'technical', phone: '+1 (415) 555-0201', skills: ['TypeScript', 'AWS', 'GraphQL'], capacity: 85, csat: 5, calendarColor: '#6366f1', active: true },
    { id: 'a2', name: 'Jamie Chen', email: 'jamie@support.io', team: 'billing', phone: '+1 (312) 555-0202', skills: ['SQL', 'Leadership'], capacity: 70, csat: 4, calendarColor: '#10b981', active: true },
    { id: 'a3', name: 'Priya Patel', email: 'priya@support.io', team: 'onboarding', phone: '+1 (206) 555-0203', skills: ['Product', 'UX', 'Figma'], capacity: 60, csat: 4, calendarColor: '#f59e0b', active: true },
  ],
  tickets: [
    { id: 'tk1', subject: 'Cannot reset password', customerId: 'c1', agentId: 'a1', priority: 'high', status: 'open', channel: 'email', tags: ['auth', 'login'], createdAt: '2026-07-10T08:30:00Z', firstResponseMins: 12, satisfaction: 4, estimateHrs: 2, hourlyRate: 90 },
    { id: 'tk2', subject: 'Invoice discrepancy', customerId: 'c2', agentId: 'a2', priority: 'normal', status: 'pending', channel: 'email', tags: ['billing'], createdAt: '2026-07-08T11:05:00Z', firstResponseMins: 45, satisfaction: 3, estimateHrs: 1, hourlyRate: 75 },
    { id: 'tk3', subject: 'API returns 500', customerId: 'c3', agentId: 'a1', priority: 'urgent', status: 'open', channel: 'chat', tags: ['api', 'outage'], createdAt: '2026-07-12T15:40:00Z', firstResponseMins: 4, satisfaction: 5, estimateHrs: 4, hourlyRate: 120 },
    { id: 'tk4', subject: 'How do I export data?', customerId: 'c4', agentId: 'a3', priority: 'low', status: 'resolved', channel: 'chat', tags: ['export'], createdAt: '2026-07-02T09:20:00Z', firstResponseMins: 20, satisfaction: 5, estimateHrs: 1, hourlyRate: 60 },
    { id: 'tk5', subject: 'Upgrade to Business', customerId: 'c5', agentId: 'a3', priority: 'normal', status: 'closed', channel: 'phone', tags: ['upgrade', 'billing'], createdAt: '2026-06-28T13:10:00Z', firstResponseMins: 8, satisfaction: 4, estimateHrs: 1, hourlyRate: 75 },
    { id: 'tk6', subject: 'SSO configuration', customerId: 'c1', agentId: 'a1', priority: 'high', status: 'pending', channel: 'email', tags: ['sso', 'security'], createdAt: '2026-07-11T10:00:00Z', firstResponseMins: 60, satisfaction: 2, estimateHrs: 3, hourlyRate: 120 },
    { id: 'tk7', subject: 'Double charge refund', customerId: 'c2', agentId: 'a2', priority: 'urgent', status: 'resolved', channel: 'phone', tags: ['refund', 'billing'], createdAt: '2026-07-05T16:25:00Z', firstResponseMins: 15, satisfaction: 4, estimateHrs: 2, hourlyRate: 90 },
    { id: 'tk8', subject: 'Feature request: dark mode', customerId: 'c3', agentId: 'a3', priority: 'low', status: 'open', channel: 'chat', tags: ['feature'], createdAt: '2026-07-13T12:50:00Z', firstResponseMins: 90, satisfaction: 3, estimateHrs: 5, hourlyRate: 100 },
  ],
}

export const support: SampleApp = {
  id: 'support',
  name: 'Support desk',
  description: 'Tickets, customers and agents - triage + SLA dashboards (CSAT sparkline + gauge, pivot, tabbed breakdown), a team-capacity dashboard, status-pill grids, master/detail, and rich edit forms.',
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
      preset: 'atlassian',
      footer: '',
      entities: [customers, agents, tickets],
      seed: { customers: customerRows, agents: agentRows, tickets: ticketRows },
      screens: [
        // Triage dashboard: volume + CSAT KPIs (CSAT card trends over created date),
        // a CSAT gauge, status/priority/channel breakdowns, a tabbed view, and a
        // ticket grid with status AND priority pills.
        dashScreen(tickets, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Open tickets', reduce: 'count', span: 1 },
          { kpi: 'Avg first response', measure: 'firstResponseMins', reduce: 'avg', span: 1 },
          { kpi: 'Avg CSAT', measure: 'satisfaction', reduce: 'avg', trendField: 'createdAt', trendReduce: 'avg', span: 1 },
          { gauge: 'Avg CSAT', measure: 'satisfaction', reduce: 'avg', min: 0, max: 5, span: 1 },
          { chart: 'status', reduce: 'count', type: 'bar', span: 2 },
          { chart: 'priority', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'channel', reduce: 'count', type: 'bar', span: 2 },
          { tabs: [
            { label: 'By status', tiles: [{ chart: 'status', reduce: 'count', type: 'bar' }] },
            { label: 'By priority', tiles: [{ chart: 'priority', reduce: 'count', type: 'bar' }] },
            { label: 'By channel', tiles: [{ chart: 'channel', reduce: 'count', type: 'bar' }] },
          ], span: 3 },
          { grid: true, format: [...statusPills(tickets, 'status'), ...statusPills(tickets, 'priority')], summaries: true, span: 3 },
        ]),
        // SLA / quality: response + CSAT KPIs, a CSAT gauge, and a pivot of CSAT by
        // priority (rows) x status (columns).
        // Ticket board: tickets as cards in status columns (drag to change status).
        boardScreen(tickets, { id: 'board', title: 'Board', order: 1 }, { groupBy: 'status', titleField: 'subject', subtitleField: 'priority', filter: ['priority', 'channel', 'agentId'] }),
        // Customer 360: account header (plan pill + health tile) with a timeline of
        // the customer's tickets (newest first, colored by status).
        detailScreen(customers, { id: 'customer-360', title: 'Customer 360', order: 2 }, {
          titleField: 'name', subtitleField: 'email', statusField: 'plan', metricFields: ['health'],
          related: [{ entity: 'tickets', foreignKey: 'customerId', label: 'Tickets', titleField: 'subject', subtitleField: 'priority', dateField: 'createdAt', statusField: 'status' }],
        }),
        dashScreen(tickets, { id: 'performance', title: 'Performance', order: 3 }, [
          { kpi: 'Avg first response', measure: 'firstResponseMins', reduce: 'avg', span: 1 },
          { kpi: 'Avg CSAT', measure: 'satisfaction', reduce: 'avg', span: 1 },
          { kpi: 'Est. hours', measure: 'estimateHrs', reduce: 'sum', format: 'number', span: 1 },
          { gauge: 'Avg CSAT', measure: 'satisfaction', reduce: 'avg', min: 0, max: 5, span: 1 },
          { chart: 'channel', measure: 'firstResponseMins', reduce: 'avg', type: 'bar', span: 2 },
          { chart: 'priority', measure: 'satisfaction', reduce: 'avg', type: 'bar', span: 1 },
          { pivot: { rows: ['priority'], cols: ['status'], measure: 'satisfaction', aggregate: 'avg' }, span: 3 },
        ]),
        // Team load: capacity gauge + a per-agent capacity leaderboard.
        dashScreen(agents, { id: 'team', title: 'Team', order: 4 }, [
          { kpi: 'Agents', reduce: 'count', span: 1 },
          { kpi: 'Avg capacity', measure: 'capacity', reduce: 'avg', format: 'percent', span: 1 },
          { kpi: 'Avg CSAT', measure: 'csat', reduce: 'avg', span: 1 },
          { gauge: 'Avg team capacity', measure: 'capacity', reduce: 'avg', min: 0, max: 100, unit: '%', span: 1 },
          { chart: 'name', measure: 'capacity', reduce: 'avg', type: 'bar', span: 2 },
          { chart: 'team', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, format: statusPills(agents, 'team'), summaries: true, span: 3 },
        ]),
        formScreen(tickets, { id: 'tickets', title: 'Tickets', order: 5 }, undefined, { format: [...statusPills(tickets, 'status'), ...statusPills(tickets, 'priority')], summaries: true }),
        screen(customers, 'master-detail', { id: 'customers', title: 'Customers', order: 6, child: tickets, foreignKey: 'customerId', linkScreen: 'customer-360' }),
        formScreen(agents, { id: 'agents', title: 'Agents', order: 7 }),
      ],
    })
  },
}
