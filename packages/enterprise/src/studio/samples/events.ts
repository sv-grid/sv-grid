import type { EntitySchema } from '../../schema.js'
import type { FormatRule } from '../project.js'
import { screen, formScreen, calendarScreen, project, dashScreen, detailScreen, statusPills, pad, ids, type SampleApp } from './shared.js'

const eventsEntity: EntitySchema = {
  name: 'events',
  label: 'Event',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 3, input: { help: 'Public event title' } },
    { field: 'category', type: 'enum', label: 'Category', required: true, defaultValue: 'conference', options: [
      { value: 'conference', label: 'Conference', color: '#6366f1' },
      { value: 'workshop', label: 'Workshop', color: '#10b981' },
      { value: 'webinar', label: 'Webinar', color: '#0ea5e9' },
      { value: 'meetup', label: 'Meetup', color: '#f59e0b' },
    ] },
    { field: 'status', type: 'enum', label: 'Status', required: true, defaultValue: 'draft', options: [
      { value: 'draft', label: 'Draft', color: '#94a3b8' },
      { value: 'published', label: 'Published', color: '#6366f1' },
      { value: 'sold_out', label: 'Sold out', color: '#ef4444' },
      { value: 'done', label: 'Done', color: '#10b981' },
    ] },
    { field: 'capacity', type: 'number', label: 'Capacity', required: true, min: 1, max: 5000, defaultValue: 100, input: { help: 'Maximum seats available' } },
    { field: 'price', type: 'number', label: 'Ticket price ($)', min: 0, defaultValue: 0, input: { prefix: '$', help: 'Standard ticket price' } },
    // Derived: projected gross if the event sells out (display-only, never stored).
    { field: 'revenue', type: 'number', label: 'Max revenue ($)', readonly: true, formula: 'price * capacity' },
    { field: 'startAt', type: 'datetime', label: 'Starts at', required: true, input: { editorType: 'datetime', help: 'Local start date and time' } },
    { field: 'topics', type: 'text', label: 'Topics', input: { editorType: 'chips', help: 'Session themes / tracks' } },
    { field: 'color', type: 'text', label: 'Brand color', defaultValue: '#6366f1', input: { editorType: 'color', help: 'Accent used on the event page' } },
    { field: 'website', type: 'text', label: 'Website', format: 'url', input: { placeholder: 'https://…', help: 'Landing page URL' } },
  ],
}

const attendees: EntitySchema = {
  name: 'attendees',
  label: 'Attendee',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', format: 'email', required: true, input: { help: 'Used for the confirmation email' } },
    { field: 'phone', type: 'text', label: 'Phone', input: { editorType: 'phone', help: 'Mobile for event reminders' } },
    { field: 'country', type: 'text', label: 'Country', input: { editorType: 'country', help: 'Billing country' } },
    { field: 'company', type: 'text', label: 'Company' },
    { field: 'interests', type: 'text', label: 'Interests', input: { editorType: 'chips', help: 'Topics this attendee follows' } },
    { field: 'vip', type: 'boolean', label: 'VIP', defaultValue: false },
  ],
}

const registrations: EntitySchema = {
  name: 'registrations',
  label: 'Registration',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'eventId', type: 'relation', label: 'Event', relation: { entity: 'events', foreignKey: 'eventId', labelField: 'name' } },
    { field: 'attendeeId', type: 'relation', label: 'Attendee', relation: { entity: 'attendees', foreignKey: 'attendeeId', labelField: 'name' } },
    { field: 'ticket', type: 'enum', label: 'Ticket', required: true, defaultValue: 'standard', options: [
      { value: 'standard', label: 'Standard', color: '#6366f1' },
      { value: 'vip', label: 'VIP', color: '#f59e0b' },
      { value: 'student', label: 'Student', color: '#10b981' },
    ] },
    { field: 'amount', type: 'number', label: 'Amount ($)', min: 0, defaultValue: 0, input: { prefix: '$', help: 'Charged after any discount' } },
    { field: 'discount', type: 'number', label: 'Discount (%)', min: 0, max: 100, defaultValue: 0, input: { editorType: 'slider', help: 'Promo discount applied' } },
    { field: 'status', type: 'enum', label: 'Status', required: true, defaultValue: 'confirmed', options: [
      { value: 'confirmed', label: 'Confirmed', color: '#10b981' },
      { value: 'cancelled', label: 'Cancelled', color: '#ef4444' },
      { value: 'waitlist', label: 'Waitlist', color: '#94a3b8' },
    ] },
    { field: 'registeredAt', type: 'datetime', label: 'Registered at', input: { editorType: 'datetime', help: 'When the ticket was booked' } },
    { field: 'rating', type: 'number', label: 'Feedback', min: 1, max: 5, input: { editorType: 'rating', help: 'Post-event satisfaction (1-5)' } },
  ],
}

// Registration grid formatting: status + ticket-tier pills, plus numeric
// thresholds (big-ticket amounts bold, poor ratings red, top ratings green) -
// data-driven color, not just status pills.
const registrationFormats: FormatRule[] = [
  ...statusPills(registrations, 'status'),
  ...statusPills(registrations, 'ticket'),
  { field: 'amount', op: 'gte', value: 300, bold: true },
  { field: 'rating', op: 'lte', value: 2, color: '#dc2626' },
  { field: 'rating', op: 'gte', value: 5, color: '#16a34a', bold: true },
]

// Event grid formatting: status + category pills, plus capacity / price
// thresholds (large-venue capacity bold, free events muted, premium tickets green).
const eventFormats: FormatRule[] = [
  ...statusPills(eventsEntity, 'status'),
  ...statusPills(eventsEntity, 'category'),
  { field: 'capacity', op: 'gte', value: 500, bold: true },
  { field: 'price', op: 'eq', value: 0, color: '#94a3b8' },
  { field: 'price', op: 'gte', value: 400, color: '#16a34a', bold: true },
]

const seed = {
  events: [
    { id: 'ev1', name: 'Svelte Summit 2026', category: 'conference', status: 'published', capacity: 800, price: 490, startAt: '2026-09-12T09:00:00.000Z', topics: ['Svelte', 'Frontend', 'Performance'], color: '#6366f1', website: 'https://sveltesummit.com' },
    { id: 'ev2', name: 'Grid Performance Workshop', category: 'workshop', status: 'sold_out', capacity: 50, price: 150, startAt: '2026-07-28T13:30:00.000Z', topics: ['Grids', 'Virtualization'], color: '#10b981', website: 'https://svgrid.com/workshop' },
    { id: 'ev3', name: 'Data Apps Webinar', category: 'webinar', status: 'done', capacity: 500, price: 0, startAt: '2026-05-19T16:00:00.000Z', topics: ['Studio', 'No-code'], color: '#0ea5e9', website: 'https://svgrid.com/webinar' },
    { id: 'ev4', name: 'Frontend Meetup Berlin', category: 'meetup', status: 'published', capacity: 120, price: 25, startAt: '2026-08-06T18:00:00.000Z', topics: ['Community', 'Svelte'], color: '#f59e0b', website: 'https://frontend.berlin' },
    { id: 'ev5', name: 'AI in Tooling Conference', category: 'conference', status: 'draft', capacity: 600, price: 420, startAt: '2026-11-03T09:30:00.000Z', topics: ['AI', 'DevTools', 'MCP'], color: '#8b5cf6', website: 'https://aitooling.dev' },
    { id: 'ev6', name: 'TypeScript Deep Dive', category: 'workshop', status: 'published', capacity: 60, price: 320, startAt: '2026-10-15T10:00:00.000Z', topics: ['TypeScript', 'Types'], color: '#3b82f6', website: 'https://tsdeepdive.io' },
  ],
  attendees: [
    { id: 'at1', name: 'Clara Voss', email: 'clara.voss@nimbus.io', phone: '+1 (415) 555-0110', country: 'United States', company: 'Nimbus', interests: ['Svelte', 'Performance'], vip: true },
    { id: 'at2', name: 'Diego Martins', email: 'diego.martins@lumen.dev', phone: '+55 11 95555-0111', country: 'Brazil', company: 'Lumen', interests: ['Frontend'], vip: false },
    { id: 'at3', name: 'Priya Anand', email: 'priya.anand@quanta.co', phone: '+91 80 5550 0112', country: 'India', company: 'Quanta', interests: ['AI', 'DevTools'], vip: false },
    { id: 'at4', name: 'Felix Braun', email: 'felix.braun@orbit.tech', phone: '+49 30 5550113', country: 'Germany', company: 'Orbit', interests: ['TypeScript', 'Grids'], vip: true },
    { id: 'at5', name: 'Hana Sato', email: 'hana.sato@meridian.jp', phone: '+81 3 5550 0114', country: 'Japan', company: 'Meridian', interests: ['Community'], vip: false },
    { id: 'at6', name: 'Lucas Moreau', email: 'lucas.moreau@volta.fr', phone: '+33 1 55 55 0115', country: 'France', company: 'Volta', interests: ['Studio', 'No-code'], vip: false },
  ],
  registrations: [
    { id: 'rg1', eventId: 'ev1', attendeeId: 'at1', ticket: 'vip', amount: 490, discount: 0, status: 'confirmed', registeredAt: '2026-06-01T10:15:00.000Z', rating: 5 },
    { id: 'rg2', eventId: 'ev1', attendeeId: 'at2', ticket: 'standard', amount: 190, discount: 0, status: 'confirmed', registeredAt: '2026-06-02T14:40:00.000Z', rating: 4 },
    { id: 'rg3', eventId: 'ev2', attendeeId: 'at3', ticket: 'standard', amount: 150, discount: 0, status: 'waitlist', registeredAt: '2026-06-10T09:05:00.000Z', rating: 3 },
    { id: 'rg4', eventId: 'ev3', attendeeId: 'at4', ticket: 'student', amount: 0, discount: 100, status: 'confirmed', registeredAt: '2026-04-28T11:20:00.000Z', rating: 5 },
    { id: 'rg5', eventId: 'ev4', attendeeId: 'at5', ticket: 'standard', amount: 25, discount: 0, status: 'cancelled', registeredAt: '2026-07-01T17:30:00.000Z', rating: 2 },
    { id: 'rg6', eventId: 'ev6', attendeeId: 'at6', ticket: 'vip', amount: 320, discount: 0, status: 'confirmed', registeredAt: '2026-07-03T08:45:00.000Z', rating: 4 },
    { id: 'rg7', eventId: 'ev1', attendeeId: 'at5', ticket: 'student', amount: 90, discount: 50, status: 'confirmed', registeredAt: '2026-06-05T20:10:00.000Z', rating: 5 },
    { id: 'rg8', eventId: 'ev4', attendeeId: 'at2', ticket: 'standard', amount: 25, discount: 0, status: 'confirmed', registeredAt: '2026-07-08T12:00:00.000Z', rating: 4 },
  ],
}

export const events: SampleApp = {
  id: 'events',
  name: 'Events',
  description: 'Events, attendees and registrations - sales + events dashboards (KPI sparklines, revenue target, feedback + capacity gauges, amount-over-time area trend, category x status pivot, tabs), filtered status-pill grids with row actions, master/detail, and rich edit forms (datetime, topic chips, brand color, phone, country, feedback rating, discount slider) with a computed max-revenue field.',
  emoji: '\u{1F39F}\u{FE0F}',
  accent: '#ec4899',
  build: () => {
    const eventRows = pad(eventsEntity, seed.events, 24)
    const attendeeRows = pad(attendees, seed.attendees, 70)
    const registrationRows = pad(registrations, seed.registrations, 90, { eventId: ids(eventRows), attendeeId: ids(attendeeRows) })
    return project({
      title: 'Evently',
      brand: 'Evently',
      accent: '#ec4899',
      preset: 'catppuccin',
      mode: 'dark',
      navStyle: 'top-nav',
      footer: '',
      entities: [eventsEntity, attendees, registrations],
      seed: { events: eventRows, attendees: attendeeRows, registrations: registrationRows },
      screens: [
        // Sales dashboard: registration KPIs (a revenue card with a sparkline over
        // register dates + a $50k target), a feedback gauge, ticket / status
        // breakdowns, an amount-over-time area trend, a ticket x status pivot, a
        // tabbed breakdown, and a status-pill registration grid.
        dashScreen(registrations, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Ticket revenue', measure: 'amount', reduce: 'sum', format: 'currency', trendField: 'registeredAt', trendReduce: 'sum', target: 50000, span: 1 },
          { kpi: 'Registrations', reduce: 'count', span: 1 },
          { kpi: 'Avg ticket', measure: 'amount', reduce: 'avg', format: 'currency', span: 1 },
          { gauge: 'Avg feedback', measure: 'rating', reduce: 'avg', min: 0, max: 5, span: 1 },
          { chart: 'ticket', measure: 'amount', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'registeredAt', measure: 'amount', reduce: 'sum', type: 'area', span: 3 },
          { pivot: { rows: ['ticket'], cols: ['status'], measure: 'amount', aggregate: 'sum' }, span: 3 },
          { tabs: [
            { label: 'Revenue by ticket', tiles: [{ chart: 'ticket', measure: 'amount', reduce: 'sum', type: 'bar' }] },
            { label: 'Registrations by status', tiles: [{ chart: 'status', reduce: 'count', type: 'bar' }] },
          ], span: 3 },
          { grid: true, format: registrationFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Events dashboard: catalog KPIs (an avg-price card trending over start
        // dates), a capacity gauge, category breakdowns, a category x status pivot, a
        // tabbed view, a filter, and an event grid with status + category pills.
        dashScreen(eventsEntity, { id: 'catalog', title: 'Catalog', order: 1 }, [
          { kpi: 'Events', reduce: 'count', span: 1 },
          { kpi: 'Total capacity', measure: 'capacity', reduce: 'sum', format: 'compact', span: 1 },
          { kpi: 'Avg price', measure: 'price', reduce: 'avg', format: 'currency', trendField: 'startAt', trendReduce: 'avg', span: 1 },
          { gauge: 'Avg capacity', measure: 'capacity', reduce: 'avg', min: 0, max: 1000, span: 1 },
          { chart: 'category', measure: 'capacity', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'category', reduce: 'count', type: 'pie', span: 1 },
          { pivot: { rows: ['category'], cols: ['status'], measure: 'price', aggregate: 'avg' }, span: 3 },
          { tabs: [
            { label: 'Capacity by category', tiles: [{ chart: 'category', measure: 'capacity', reduce: 'sum', type: 'bar' }] },
            { label: 'Price by category', tiles: [{ chart: 'category', measure: 'price', reduce: 'avg', type: 'bar' }] },
          ], span: 3 },
          { filter: ['category', 'status'], span: 3 },
          { grid: true, format: eventFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Schedule: a month calendar placing every event on its start date, tinted
        // by category. The signature "real app" scheduling view.
        calendarScreen(eventsEntity, { id: 'schedule', title: 'Schedule', order: 2 }, { dateField: 'startAt', titleField: 'name', colorField: 'category', filter: ['category', 'status'] }),
        // Event 360: a full record page for one event - header with status pill and
        // capacity / price tiles, a tabbed overview, and a registrations timeline.
        detailScreen(eventsEntity, { id: 'event-detail', title: 'Event detail', order: 3 }, {
          titleField: 'name', statusField: 'status', metricFields: ['capacity', 'price'],
          related: [{ entity: 'registrations', foreignKey: 'eventId', label: 'Registrations', titleField: 'attendeeId', subtitleField: 'amount', dateField: 'registeredAt', statusField: 'status' }],
        }),
        screen(eventsEntity, 'master-detail', { id: 'events', title: 'Events', order: 4, child: registrations, foreignKey: 'eventId', linkScreen: 'event-detail' }),
        formScreen(registrations, { id: 'registrations', title: 'Registrations', order: 5 }, undefined, { format: registrationFormats, summaries: true, rowActions: [{ kind: 'edit' }] }, ['ticket', 'status']),
        formScreen(attendees, { id: 'attendees', title: 'Attendees', order: 6 }, undefined, {}, ['country', 'company', 'vip']),
      ],
    })
  },
}
