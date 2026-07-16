import type { EntitySchema } from '../../schema.js'
import { screen, project, dashScreen, type SampleApp } from './shared.js'

const eventsEntity: EntitySchema = {
  name: 'events',
  label: 'Event',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'category', type: 'enum', label: 'Category', options: [
      { value: 'conference', label: 'Conference', color: '#6366f1' },
      { value: 'workshop', label: 'Workshop', color: '#10b981' },
      { value: 'webinar', label: 'Webinar', color: '#0ea5e9' },
      { value: 'meetup', label: 'Meetup', color: '#f59e0b' },
    ] },
    { field: 'status', type: 'enum', label: 'Status', options: [
      { value: 'draft', label: 'Draft', color: '#94a3b8' },
      { value: 'published', label: 'Published', color: '#6366f1' },
      { value: 'sold_out', label: 'Sold out', color: '#ef4444' },
      { value: 'done', label: 'Done', color: '#10b981' },
    ] },
    { field: 'capacity', type: 'number', label: 'Capacity' },
    { field: 'date', type: 'date', label: 'Date' },
  ],
}

const attendees: EntitySchema = {
  name: 'attendees',
  label: 'Attendee',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'email', type: 'text', format: 'email' },
    { field: 'company', type: 'text', label: 'Company' },
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
    { field: 'ticket', type: 'enum', label: 'Ticket', options: [
      { value: 'standard', label: 'Standard', color: '#6366f1' },
      { value: 'vip', label: 'VIP', color: '#f59e0b' },
      { value: 'student', label: 'Student', color: '#10b981' },
    ] },
    { field: 'amount', type: 'number', label: 'Amount ($)' },
    { field: 'status', type: 'enum', label: 'Status', options: [
      { value: 'confirmed', label: 'Confirmed', color: '#10b981' },
      { value: 'cancelled', label: 'Cancelled', color: '#ef4444' },
      { value: 'waitlist', label: 'Waitlist', color: '#94a3b8' },
    ] },
  ],
}

const seed = {
  events: [
    { id: 'ev1', name: 'Svelte Summit 2026', category: 'conference', status: 'published', capacity: 800, date: '2026-09-12' },
    { id: 'ev2', name: 'Grid Performance Workshop', category: 'workshop', status: 'sold_out', capacity: 50, date: '2026-07-28' },
    { id: 'ev3', name: 'Data Apps Webinar', category: 'webinar', status: 'done', capacity: 500, date: '2026-05-19' },
    { id: 'ev4', name: 'Frontend Meetup Berlin', category: 'meetup', status: 'published', capacity: 120, date: '2026-08-06' },
    { id: 'ev5', name: 'AI in Tooling Conference', category: 'conference', status: 'draft', capacity: 600, date: '2026-11-03' },
    { id: 'ev6', name: 'TypeScript Deep Dive', category: 'workshop', status: 'published', capacity: 60, date: '2026-10-15' },
  ],
  attendees: [
    { id: 'at1', name: 'Clara Voss', email: 'clara.voss@nimbus.io', company: 'Nimbus' },
    { id: 'at2', name: 'Diego Martins', email: 'diego.martins@lumen.dev', company: 'Lumen' },
    { id: 'at3', name: 'Priya Anand', email: 'priya.anand@quanta.co', company: 'Quanta' },
    { id: 'at4', name: 'Felix Braun', email: 'felix.braun@orbit.tech', company: 'Orbit' },
    { id: 'at5', name: 'Hana Sato', email: 'hana.sato@meridian.jp', company: 'Meridian' },
    { id: 'at6', name: 'Lucas Moreau', email: 'lucas.moreau@volta.fr', company: 'Volta' },
  ],
  registrations: [
    { id: 'rg1', eventId: 'ev1', attendeeId: 'at1', ticket: 'vip', amount: 490, status: 'confirmed' },
    { id: 'rg2', eventId: 'ev1', attendeeId: 'at2', ticket: 'standard', amount: 190, status: 'confirmed' },
    { id: 'rg3', eventId: 'ev2', attendeeId: 'at3', ticket: 'standard', amount: 150, status: 'waitlist' },
    { id: 'rg4', eventId: 'ev3', attendeeId: 'at4', ticket: 'student', amount: 0, status: 'confirmed' },
    { id: 'rg5', eventId: 'ev4', attendeeId: 'at5', ticket: 'standard', amount: 25, status: 'cancelled' },
    { id: 'rg6', eventId: 'ev6', attendeeId: 'at6', ticket: 'vip', amount: 320, status: 'confirmed' },
    { id: 'rg7', eventId: 'ev1', attendeeId: 'at5', ticket: 'student', amount: 90, status: 'confirmed' },
    { id: 'rg8', eventId: 'ev4', attendeeId: 'at2', ticket: 'standard', amount: 25, status: 'confirmed' },
  ],
}

export const events: SampleApp = {
  id: 'events',
  name: 'Events',
  description: 'Events, attendees and registrations - ticket sales and attendance dashboards.',
  emoji: '\u{1F39F}\u{FE0F}',
  accent: '#ec4899',
  build: () =>
    project({
      title: 'Evently',
      brand: 'Evently',
      accent: '#ec4899',
      footer: '',
      entities: [eventsEntity, attendees, registrations],
      seed,
      screens: [
        dashScreen(registrations, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Registrations', reduce: 'count' },
          { kpi: 'Ticket revenue', measure: 'amount', reduce: 'sum' },
          { kpi: 'Avg ticket', measure: 'amount', reduce: 'avg' },
          { chart: 'ticket', measure: 'amount', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Top ticket', measure: 'amount', reduce: 'max', span: 1 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, span: 3 },
        ]),
        screen(eventsEntity, 'master-detail', { id: 'events', title: 'Events', order: 1, child: registrations, foreignKey: 'eventId' }),
        screen(registrations, 'crud', { id: 'registrations', title: 'Registrations', order: 2 }),
        screen(attendees, 'crud', { id: 'attendees', title: 'Attendees', order: 3 }),
      ],
    }),
}
