import type { EntitySchema } from '../../schema.js'
import { screen, project, dashScreen, type SampleApp } from './shared.js'

const classes: EntitySchema = {
  name: 'classes',
  label: 'Class',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'type', type: 'enum', options: [
      { value: 'yoga', label: 'Yoga', color: '#10b981' },
      { value: 'spin', label: 'Spin', color: '#0ea5e9' },
      { value: 'hiit', label: 'HIIT', color: '#ef4444' },
      { value: 'strength', label: 'Strength', color: '#6366f1' },
    ] },
    { field: 'capacity', type: 'number', label: 'Capacity' },
    { field: 'durationMins', type: 'number', label: 'Duration (min)' },
  ],
}

const members: EntitySchema = {
  name: 'members',
  label: 'Member',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'email', type: 'text', format: 'email' },
    { field: 'plan', type: 'enum', options: [
      { value: 'basic', label: 'Basic', color: '#94a3b8' },
      { value: 'plus', label: 'Plus', color: '#0ea5e9' },
      { value: 'elite', label: 'Elite', color: '#f59e0b' },
    ] },
    { field: 'status', type: 'enum', options: [
      { value: 'active', label: 'Active', color: '#10b981' },
      { value: 'paused', label: 'Paused', color: '#f59e0b' },
      { value: 'expired', label: 'Expired', color: '#ef4444' },
    ] },
  ],
}

const bookings: EntitySchema = {
  name: 'bookings',
  label: 'Booking',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'memberId', type: 'relation', label: 'Member', relation: { entity: 'members', foreignKey: 'memberId', labelField: 'name' } },
    { field: 'classId', type: 'relation', label: 'Class', relation: { entity: 'classes', foreignKey: 'classId', labelField: 'name' } },
    { field: 'status', type: 'enum', options: [
      { value: 'booked', label: 'Booked', color: '#0ea5e9' },
      { value: 'attended', label: 'Attended', color: '#10b981' },
      { value: 'no_show', label: 'No show', color: '#ef4444' },
    ] },
    { field: 'rating', type: 'number', label: 'Rating' },
  ],
}

const seed = {
  classes: [
    { id: 'cl1', name: 'Sunrise Yoga', type: 'yoga', capacity: 20, durationMins: 60 },
    { id: 'cl2', name: 'Power Spin', type: 'spin', capacity: 24, durationMins: 45 },
    { id: 'cl3', name: 'HIIT Blast', type: 'hiit', capacity: 16, durationMins: 30 },
    { id: 'cl4', name: 'Iron Strength', type: 'strength', capacity: 12, durationMins: 50 },
    { id: 'cl5', name: 'Flow Yoga', type: 'yoga', capacity: 18, durationMins: 75 },
    { id: 'cl6', name: 'Endurance Spin', type: 'spin', capacity: 22, durationMins: 60 },
  ],
  members: [
    { id: 'mb1', name: 'Olivia Grant', email: 'olivia.grant@example.com', plan: 'elite', status: 'active' },
    { id: 'mb2', name: 'James Carter', email: 'james.carter@example.com', plan: 'plus', status: 'active' },
    { id: 'mb3', name: 'Hana Kim', email: 'hana.kim@example.com', plan: 'basic', status: 'paused' },
    { id: 'mb4', name: 'Diego Morales', email: 'diego.morales@example.com', plan: 'plus', status: 'active' },
    { id: 'mb5', name: 'Zara Ahmed', email: 'zara.ahmed@example.com', plan: 'elite', status: 'expired' },
    { id: 'mb6', name: 'Ben Walker', email: 'ben.walker@example.com', plan: 'basic', status: 'active' },
    { id: 'mb7', name: 'Chloe Dubois', email: 'chloe.dubois@example.com', plan: 'plus', status: 'active' },
  ],
  bookings: [
    { id: 'bk1', memberId: 'mb1', classId: 'cl1', status: 'attended', rating: 5 },
    { id: 'bk2', memberId: 'mb2', classId: 'cl2', status: 'attended', rating: 4 },
    { id: 'bk3', memberId: 'mb3', classId: 'cl1', status: 'no_show', rating: 0 },
    { id: 'bk4', memberId: 'mb4', classId: 'cl3', status: 'booked', rating: 0 },
    { id: 'bk5', memberId: 'mb5', classId: 'cl4', status: 'attended', rating: 5 },
    { id: 'bk6', memberId: 'mb6', classId: 'cl2', status: 'attended', rating: 3 },
    { id: 'bk7', memberId: 'mb7', classId: 'cl5', status: 'booked', rating: 0 },
    { id: 'bk8', memberId: 'mb1', classId: 'cl6', status: 'attended', rating: 4 },
  ],
}

export const gym: SampleApp = {
  id: 'gym',
  name: 'Gym',
  description: 'Members, classes and bookings - capacity and attendance dashboards.',
  emoji: '🏋️',
  accent: '#22c55e',
  build: () =>
    project({
      title: 'FitClub',
      brand: 'FitClub',
      accent: '#22c55e',
      footer: '',
      entities: [classes, members, bookings],
      seed,
      screens: [
        dashScreen(classes, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Classes', reduce: 'count' },
          { kpi: 'Total capacity', measure: 'capacity', reduce: 'sum' },
          { kpi: 'Avg duration', measure: 'durationMins', reduce: 'avg' },
          { chart: 'type', measure: 'capacity', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Longest class', measure: 'durationMins', reduce: 'max', span: 1 },
          { chart: 'type', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, span: 3 },
        ]),
        screen(classes, 'master-detail', { id: 'classes', title: 'Classes', order: 1, child: bookings, foreignKey: 'classId' }),
        screen(members, 'crud', { id: 'members', title: 'Members', order: 2 }),
        screen(bookings, 'crud', { id: 'bookings', title: 'Bookings', order: 3 }),
      ],
    }),
}
