import type { EntitySchema } from '../../schema.js'
import type { FormatRule } from '../project.js'
import { screen, formScreen, schedulerScreen, detailScreen, project, dashScreen, statusPills, pad, ids, type SampleApp } from './shared.js'

const classes: EntitySchema = {
  name: 'classes',
  label: 'Class',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'type', type: 'enum', required: true, options: [
      { value: 'yoga', label: 'Yoga', color: '#10b981' },
      { value: 'spin', label: 'Spin', color: '#0ea5e9' },
      { value: 'hiit', label: 'HIIT', color: '#ef4444' },
      { value: 'strength', label: 'Strength', color: '#6366f1' },
    ] },
    { field: 'capacity', type: 'number', label: 'Capacity', required: true, min: 1, defaultValue: 20, input: { help: 'Maximum attendees per session' } },
    { field: 'durationMins', type: 'number', label: 'Duration (min)', min: 15, max: 120, defaultValue: 60, input: { suffix: ' min' } },
    { field: 'intensity', type: 'number', label: 'Intensity', min: 0, max: 5, defaultValue: 3, input: { editorType: 'slider', help: 'Effort level from easy (0) to brutal (5)' } },
    // Derived: training load = intensity x duration (display-only, never stored).
    { field: 'load', type: 'number', label: 'Load', readonly: true, formula: 'intensity * durationMins' },
    { field: 'color', type: 'text', label: 'Schedule colour', input: { editorType: 'color', help: 'Shown on the timetable' } },
    { field: 'trainer', type: 'text', label: 'Lead trainer' },
  ],
}

const members: EntitySchema = {
  name: 'members',
  label: 'Member',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', format: 'email', required: true },
    { field: 'phone', type: 'text', input: { editorType: 'phone', help: 'Mobile for class reminders' } },
    { field: 'country', type: 'text', label: 'Country', input: { editorType: 'country' } },
    { field: 'plan', type: 'enum', label: 'Membership', required: true, options: [
      { value: 'basic', label: 'Basic', color: '#94a3b8' },
      { value: 'plus', label: 'Plus', color: '#0ea5e9' },
      { value: 'elite', label: 'Elite', color: '#f59e0b' },
    ] },
    { field: 'status', type: 'enum', required: true, defaultValue: 'active', options: [
      { value: 'active', label: 'Active', color: '#10b981' },
      { value: 'paused', label: 'Paused', color: '#f59e0b' },
      { value: 'expired', label: 'Expired', color: '#ef4444' },
    ] },
    { field: 'joinDate', type: 'date', label: 'Joined' },
    { field: 'goals', type: 'text', label: 'Goals', input: { editorType: 'chips', help: 'What this member is training for' } },
    { field: 'monthlyFee', type: 'number', label: 'Monthly fee ($)', min: 0, defaultValue: 49, input: { prefix: '$' } },
    // Derived: yearly commitment from the monthly fee (display-only).
    { field: 'annualFee', type: 'number', label: 'Annual fee ($)', readonly: true, formula: 'monthlyFee * 12' },
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
    { field: 'status', type: 'enum', required: true, defaultValue: 'booked', options: [
      { value: 'booked', label: 'Booked', color: '#0ea5e9' },
      { value: 'attended', label: 'Attended', color: '#10b981' },
      { value: 'no_show', label: 'No show', color: '#ef4444' },
    ] },
    { field: 'bookedAt', type: 'datetime', label: 'Booked at', input: { editorType: 'datetime', help: 'When the spot was reserved' } },
    { field: 'rating', type: 'number', label: 'Feedback', min: 0, max: 5, defaultValue: 0, input: { editorType: 'rating', help: 'Post-class member rating' } },
  ],
}

const seed = {
  classes: [
    { id: 'cl1', name: 'Sunrise Yoga', type: 'yoga', capacity: 20, durationMins: 60, intensity: 2, color: '#10b981', trainer: 'Maya Cohen' },
    { id: 'cl2', name: 'Power Spin', type: 'spin', capacity: 24, durationMins: 45, intensity: 4, color: '#0ea5e9', trainer: 'Rob Sena' },
    { id: 'cl3', name: 'HIIT Blast', type: 'hiit', capacity: 16, durationMins: 30, intensity: 5, color: '#ef4444', trainer: 'Tara Voss' },
    { id: 'cl4', name: 'Iron Strength', type: 'strength', capacity: 12, durationMins: 50, intensity: 4, color: '#6366f1', trainer: 'Marcus Lee' },
    { id: 'cl5', name: 'Flow Yoga', type: 'yoga', capacity: 18, durationMins: 75, intensity: 3, color: '#22c55e', trainer: 'Maya Cohen' },
    { id: 'cl6', name: 'Endurance Spin', type: 'spin', capacity: 22, durationMins: 60, intensity: 3, color: '#38bdf8', trainer: 'Rob Sena' },
  ],
  members: [
    { id: 'mb1', name: 'Olivia Grant', email: 'olivia.grant@example.com', phone: '+1 (415) 555-0111', country: 'United States', plan: 'elite', status: 'active', joinDate: '2025-01-12', goals: ['Weight loss', 'Flexibility'], monthlyFee: 99 },
    { id: 'mb2', name: 'James Carter', email: 'james.carter@example.com', phone: '+44 20 7946 0112', country: 'United Kingdom', plan: 'plus', status: 'active', joinDate: '2025-03-04', goals: ['Strength'], monthlyFee: 69 },
    { id: 'mb3', name: 'Hana Kim', email: 'hana.kim@example.com', phone: '+82 2 555 0113', country: 'South Korea', plan: 'basic', status: 'paused', joinDate: '2025-05-20', goals: ['Stress relief'], monthlyFee: 39 },
    { id: 'mb4', name: 'Diego Morales', email: 'diego.morales@example.com', phone: '+34 91 555 0114', country: 'Spain', plan: 'plus', status: 'active', joinDate: '2024-11-08', goals: ['Endurance', 'Cardio'], monthlyFee: 69 },
    { id: 'mb5', name: 'Zara Ahmed', email: 'zara.ahmed@example.com', phone: '+971 4 555 0115', country: 'United Arab Emirates', plan: 'elite', status: 'expired', joinDate: '2024-08-15', goals: ['Toning'], monthlyFee: 99 },
    { id: 'mb6', name: 'Ben Walker', email: 'ben.walker@example.com', phone: '+1 (650) 555-0116', country: 'United States', plan: 'basic', status: 'active', joinDate: '2025-06-01', goals: ['General fitness'], monthlyFee: 39 },
    { id: 'mb7', name: 'Chloe Dubois', email: 'chloe.dubois@example.com', phone: '+33 1 42 55 0117', country: 'France', plan: 'plus', status: 'active', joinDate: '2025-02-18', goals: ['Flexibility', 'Balance'], monthlyFee: 69 },
  ],
  bookings: [
    { id: 'bk1', memberId: 'mb1', classId: 'cl1', status: 'attended', bookedAt: '2026-07-01T06:30:00.000Z', rating: 5 },
    { id: 'bk2', memberId: 'mb2', classId: 'cl2', status: 'attended', bookedAt: '2026-07-01T18:00:00.000Z', rating: 4 },
    { id: 'bk3', memberId: 'mb3', classId: 'cl1', status: 'no_show', bookedAt: '2026-07-02T06:30:00.000Z', rating: 0 },
    { id: 'bk4', memberId: 'mb4', classId: 'cl3', status: 'booked', bookedAt: '2026-07-03T12:15:00.000Z', rating: 0 },
    { id: 'bk5', memberId: 'mb5', classId: 'cl4', status: 'attended', bookedAt: '2026-07-03T19:00:00.000Z', rating: 5 },
    { id: 'bk6', memberId: 'mb6', classId: 'cl2', status: 'attended', bookedAt: '2026-07-04T18:00:00.000Z', rating: 3 },
    { id: 'bk7', memberId: 'mb7', classId: 'cl5', status: 'booked', bookedAt: '2026-07-05T09:00:00.000Z', rating: 0 },
    { id: 'bk8', memberId: 'mb1', classId: 'cl6', status: 'attended', bookedAt: '2026-07-05T17:30:00.000Z', rating: 4 },
  ],
}

// Class grid formatting: type pills plus numeric thresholds (tight rooms red,
// roomy sessions green + bold, brutal-intensity classes bold red) - data-driven
// color, not just status pills.
const classFormats: FormatRule[] = [
  ...statusPills(classes, 'type'),
  { field: 'capacity', op: 'lt', value: 15, color: '#dc2626' },
  { field: 'capacity', op: 'gte', value: 24, color: '#16a34a', bold: true },
  { field: 'intensity', op: 'gte', value: 4, color: '#dc2626', bold: true },
]

// Member grid formatting: status + plan pills, plus premium-fee highlight.
const memberFormats: FormatRule[] = [
  ...statusPills(members, 'status'),
  ...statusPills(members, 'plan'),
  { field: 'monthlyFee', op: 'gte', value: 90, bold: true },
]

// Booking grid formatting: status pills plus rating thresholds (poor feedback
// red, strong feedback green + bold).
const bookingFormats: FormatRule[] = [
  ...statusPills(bookings, 'status'),
  { field: 'rating', op: 'lt', value: 3, color: '#dc2626' },
  { field: 'rating', op: 'gte', value: 4, color: '#16a34a', bold: true },
]

export const gym: SampleApp = {
  id: 'gym',
  name: 'Gym',
  description: 'Members, classes and bookings - membership, class and attendance dashboards (KPI sparklines + a fee target, capacity and feedback gauges, a plan-by-status pivot, join-date and booking trends, tabbed breakdowns), filtered status-pill grids with row actions, master/detail, and rich edit forms.',
  emoji: '🏋️',
  accent: '#22c55e',
  build: () => {
    const classRows = pad(classes, seed.classes, 12)
    const memberRows = pad(members, seed.members, 22)
    const classPool = ids(classRows)
    const memberPool = ids(memberRows)
    const bookingRows = pad(bookings, seed.bookings, 30, { memberId: memberPool, classId: classPool })
    return project({
      title: 'FitClub',
      brand: 'FitClub',
      accent: '#22c55e',
      preset: 'dracula',
      mode: 'dark',
      footer: '© FitClub',
      entities: [classes, members, bookings],
      seed: { classes: classRows, members: memberRows, bookings: bookingRows },
      screens: [
        // Membership dashboard: revenue + member KPIs (a monthly-revenue card with a
        // sparkline over join dates + a $1.5k target), a fee gauge, plan / status
        // breakdowns, a join-date revenue trend, a plan x status pivot, a tabbed
        // breakdown, a faceted filter, and a status-pill member grid.
        dashScreen(members, { id: 'membership', title: 'Membership', order: 0 }, [
          { kpi: 'Members', reduce: 'count', span: 1 },
          { kpi: 'Monthly revenue', measure: 'monthlyFee', reduce: 'sum', format: 'currency', trendField: 'joinDate', trendReduce: 'sum', target: 1500, span: 1 },
          { kpi: 'Avg fee', measure: 'monthlyFee', reduce: 'avg', format: 'currency', span: 1 },
          { gauge: 'Avg monthly fee vs $150', measure: 'monthlyFee', reduce: 'avg', min: 0, max: 150, unit: '$', span: 1 },
          { chart: 'plan', measure: 'monthlyFee', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'joinDate', measure: 'monthlyFee', reduce: 'sum', type: 'area', span: 3 },
          { pivot: { rows: ['plan'], cols: ['status'], measure: 'monthlyFee', aggregate: 'sum' }, span: 3 },
          { tabs: [
            { label: 'Revenue by plan', tiles: [{ chart: 'plan', measure: 'monthlyFee', reduce: 'sum', type: 'bar' }] },
            { label: 'Members by status', tiles: [{ chart: 'status', reduce: 'count', type: 'bar' }] },
          ], span: 3 },
          { filter: ['plan', 'status', 'country'], span: 3 },
          { grid: true, format: memberFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Class insights: capacity + intensity KPIs, an average-capacity gauge, type
        // breakdowns, a tabbed capacity / intensity view, and a class grid with type
        // pills plus capacity / intensity thresholds.
        dashScreen(classes, { id: 'schedule', title: 'Class insights', order: 1 }, [
          { kpi: 'Classes', reduce: 'count', span: 1 },
          { kpi: 'Total capacity', measure: 'capacity', reduce: 'sum', span: 1 },
          { kpi: 'Avg intensity', measure: 'intensity', reduce: 'avg', span: 1 },
          { gauge: 'Avg capacity', measure: 'capacity', reduce: 'avg', min: 0, max: 30, span: 1 },
          { chart: 'type', measure: 'capacity', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'type', reduce: 'count', type: 'pie', span: 1 },
          { tabs: [
            { label: 'Capacity by type', tiles: [{ chart: 'type', measure: 'capacity', reduce: 'sum', type: 'bar' }] },
            { label: 'Intensity by type', tiles: [{ chart: 'type', measure: 'intensity', reduce: 'avg', type: 'bar' }] },
            { label: 'Duration by type', tiles: [{ chart: 'type', measure: 'durationMins', reduce: 'avg', type: 'bar' }] },
          ], span: 3 },
          { grid: true, format: classFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Attendance: booking + feedback KPIs (avg rating trends over booking time), a
        // feedback gauge, status breakdown, a rating-over-time area trend, a filter,
        // and a status-pill booking grid with rating thresholds.
        dashScreen(bookings, { id: 'attendance', title: 'Attendance', order: 2 }, [
          { kpi: 'Bookings', reduce: 'count', span: 1 },
          { kpi: 'Avg rating', measure: 'rating', reduce: 'avg', trendField: 'bookedAt', trendReduce: 'avg', span: 1 },
          { kpi: 'Top rating', measure: 'rating', reduce: 'max', span: 1 },
          { gauge: 'Avg feedback', measure: 'rating', reduce: 'avg', min: 0, max: 5, span: 1 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'bookedAt', measure: 'rating', reduce: 'avg', type: 'area', span: 2 },
          { filter: ['status'], span: 3 },
          { grid: true, format: bookingFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Resource scheduler: a column per class, bookings placed by time (who's in each
        // class), tinted by status, with drag-to-reschedule (week view). Was a month calendar.
        schedulerScreen(bookings, { id: 'schedule-cal', title: 'Schedule', order: 3 }, { startField: 'bookedAt', titleField: 'memberId', colorField: 'status', resourceField: 'classId', initialView: 'week' }),
        detailScreen(members, { id: 'member-360', title: 'Member 360', order: 4 }, {
          titleField: 'name', subtitleField: 'email', statusField: 'status',
          metricFields: ['monthlyFee'],
          related: [{ entity: 'bookings', foreignKey: 'memberId', label: 'Bookings', titleField: 'classId', dateField: 'bookedAt', statusField: 'status' }],
        }),
        screen(classes, 'master-detail', { id: 'classes', title: 'Classes', order: 5, child: bookings, foreignKey: 'classId' }),
        formScreen(members, { id: 'members', title: 'Members', order: 6 }, undefined, { format: memberFormats, summaries: true, rowActions: [{ kind: 'edit' }], rowLink: { screen: 'member-360', sourceField: 'id', targetField: 'id' } }, ['plan', 'status', 'country']),
        formScreen(bookings, { id: 'bookings', title: 'Bookings', order: 7 }, undefined, { format: bookingFormats, summaries: true }, ['status']),
      ],
    })
  },
}
