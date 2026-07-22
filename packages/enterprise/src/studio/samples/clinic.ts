import type { EntitySchema } from '../../schema.js'
import type { FormatRule } from '../project.js'
import { screen, formScreen, calendarScreen, detailScreen, project, dashScreen, statusPills, pad, ids, type SampleApp } from './shared.js'

const doctors: EntitySchema = {
  name: 'doctors',
  label: 'Doctor',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', format: 'email', required: true },
    { field: 'phone', type: 'text', input: { editorType: 'phone' } },
    { field: 'specialty', type: 'enum', label: 'Specialty', required: true, options: [
      { value: 'gp', label: 'General Practice', color: '#6366f1' },
      { value: 'cardiology', label: 'Cardiology', color: '#ef4444' },
      { value: 'dermatology', label: 'Dermatology', color: '#f59e0b' },
      { value: 'pediatrics', label: 'Pediatrics', color: '#10b981' },
    ] },
    { field: 'rating', type: 'number', label: 'Patient rating', min: 1, max: 5, defaultValue: 4, input: { editorType: 'rating', help: '1-5 average patient rating' } },
    { field: 'calendarColor', type: 'text', label: 'Calendar color', input: { editorType: 'color', help: 'Color used on the schedule' } },
  ],
}

const patients: EntitySchema = {
  name: 'patients',
  label: 'Patient',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', format: 'email', required: true },
    { field: 'phone', type: 'text', input: { editorType: 'phone' } },
    { field: 'dob', type: 'date', label: 'Date of birth', required: true },
    { field: 'bloodType', type: 'enum', label: 'Blood type', options: [
      { value: 'O+', label: 'O+', color: '#ef4444' },
      { value: 'O-', label: 'O-', color: '#f97316' },
      { value: 'A+', label: 'A+', color: '#6366f1' },
      { value: 'A-', label: 'A-', color: '#8b5cf6' },
      { value: 'B+', label: 'B+', color: '#10b981' },
      { value: 'B-', label: 'B-', color: '#14b8a6' },
      { value: 'AB+', label: 'AB+', color: '#f59e0b' },
      { value: 'AB-', label: 'AB-', color: '#eab308' },
    ] },
    { field: 'insuranceNumber', type: 'text', label: 'Insurance #', input: { editorType: 'mask', mask: 'AAA-######', placeholder: 'AAA-000000' } },
    { field: 'allergies', type: 'text', label: 'Allergies', input: { editorType: 'chips', help: 'Known allergies' } },
  ],
}

const appointments: EntitySchema = {
  name: 'appointments',
  label: 'Appointment',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'patientId', type: 'relation', label: 'Patient', required: true, relation: { entity: 'patients', foreignKey: 'patientId', labelField: 'name' } },
    { field: 'doctorId', type: 'relation', label: 'Doctor', required: true, relation: { entity: 'doctors', foreignKey: 'doctorId', labelField: 'name' } },
    { field: 'status', type: 'enum', label: 'Status', defaultValue: 'scheduled', options: [
      { value: 'scheduled', label: 'Scheduled', color: '#6366f1' },
      { value: 'completed', label: 'Completed', color: '#10b981' },
      { value: 'cancelled', label: 'Cancelled', color: '#ef4444' },
      { value: 'no_show', label: 'No show', color: '#94a3b8' },
    ] },
    { field: 'scheduledAt', type: 'datetime', label: 'Scheduled at', required: true },
    { field: 'durationMins', type: 'number', label: 'Duration (min)', min: 15, max: 120, defaultValue: 30, input: { editorType: 'slider', step: 15, help: 'Visit length in minutes' } },
    { field: 'fee', type: 'number', label: 'Fee ($)', min: 0 },
    // Derived: fee plus 8% tax (display-only, never seeded).
    { field: 'total', type: 'number', label: 'Total w/ tax ($)', readonly: true, formula: 'fee * 1.08' },
    { field: 'satisfaction', type: 'number', label: 'Satisfaction', min: 1, max: 5, input: { editorType: 'rating', help: '1-5 visit rating' } },
  ],
}

// Appointment grid formatting: status pills plus numeric thresholds (low
// satisfaction red, perfect scores green + bold, high-value fees bold) - data-driven
// color, not just status pills.
const apptFormats: FormatRule[] = [
  ...statusPills(appointments, 'status'),
  { field: 'satisfaction', op: 'lt', value: 3, color: '#dc2626' },
  { field: 'satisfaction', op: 'gte', value: 5, color: '#16a34a', bold: true },
  { field: 'fee', op: 'gte', value: 250, bold: true },
]

const seed = {
  doctors: [
    { id: 'dr1', name: 'Dr. Sarah Mendes', email: 'sarah.mendes@healthclinic.com', phone: '+1 (415) 555-0301', specialty: 'gp', rating: 5, calendarColor: '#6366f1' },
    { id: 'dr2', name: 'Dr. James Whitfield', email: 'james.whitfield@healthclinic.com', phone: '+1 (415) 555-0302', specialty: 'cardiology', rating: 4, calendarColor: '#ef4444' },
    { id: 'dr3', name: 'Dr. Aisha Rahman', email: 'aisha.rahman@healthclinic.com', phone: '+1 (650) 555-0303', specialty: 'dermatology', rating: 5, calendarColor: '#f59e0b' },
    { id: 'dr4', name: 'Dr. Marcus Liang', email: 'marcus.liang@healthclinic.com', phone: '+1 (212) 555-0304', specialty: 'pediatrics', rating: 4, calendarColor: '#10b981' },
    { id: 'dr5', name: 'Dr. Elena Popova', email: 'elena.popova@healthclinic.com', phone: '+1 (312) 555-0305', specialty: 'gp', rating: 3, calendarColor: '#3b82f6' },
    { id: 'dr6', name: 'Dr. Thomas Becker', email: 'thomas.becker@healthclinic.com', phone: '+1 (206) 555-0306', specialty: 'cardiology', rating: 4, calendarColor: '#8b5cf6' },
  ],
  patients: [
    { id: 'pt1', name: 'Oliver Grant', email: 'oliver.grant@example.com', phone: '+1 (415) 555-0201', dob: '1984-03-12', bloodType: 'O+', insuranceNumber: 'AET-100482', allergies: ['Penicillin'] },
    { id: 'pt2', name: 'Maya Fernandez', email: 'maya.fernandez@example.com', phone: '+1 (415) 555-0202', dob: '1991-11-04', bloodType: 'A-', insuranceNumber: 'BCX-204817', allergies: ['Peanuts', 'Latex'] },
    { id: 'pt3', name: 'Noah Kim', email: 'noah.kim@example.com', phone: '+1 (650) 555-0203', dob: '2015-06-22', bloodType: 'B+', insuranceNumber: 'CDN-330298', allergies: [] },
    { id: 'pt4', name: 'Sophia Rossi', email: 'sophia.rossi@example.com', phone: '+1 (212) 555-0204', dob: '1978-09-30', bloodType: 'AB+', insuranceNumber: 'DEF-419926', allergies: ['Aspirin'] },
    { id: 'pt5', name: 'Ethan Walsh', email: 'ethan.walsh@example.com', phone: '+1 (312) 555-0205', dob: '2001-01-18', bloodType: 'O-', insuranceNumber: 'EGH-528140', allergies: ['Pollen', 'Dust'] },
    { id: 'pt6', name: 'Amara Okafor', email: 'amara.okafor@example.com', phone: '+1 (206) 555-0206', dob: '1996-07-08', bloodType: 'A+', insuranceNumber: 'FIJ-610355', allergies: ['Shellfish'] },
  ],
  appointments: [
    { id: 'ap1', patientId: 'pt1', doctorId: 'dr1', status: 'completed', scheduledAt: '2026-06-02T09:30:00Z', durationMins: 30, fee: 120, satisfaction: 5 },
    { id: 'ap2', patientId: 'pt2', doctorId: 'dr2', status: 'scheduled', scheduledAt: '2026-07-18T14:00:00Z', durationMins: 45, fee: 260, satisfaction: 4 },
    { id: 'ap3', patientId: 'pt3', doctorId: 'dr4', status: 'completed', scheduledAt: '2026-06-14T10:15:00Z', durationMins: 20, fee: 90, satisfaction: 5 },
    { id: 'ap4', patientId: 'pt4', doctorId: 'dr3', status: 'cancelled', scheduledAt: '2026-05-27T11:00:00Z', durationMins: 30, fee: 150, satisfaction: 3 },
    { id: 'ap5', patientId: 'pt5', doctorId: 'dr1', status: 'no_show', scheduledAt: '2026-06-09T15:30:00Z', durationMins: 30, fee: 120, satisfaction: 2 },
    { id: 'ap6', patientId: 'pt6', doctorId: 'dr6', status: 'scheduled', scheduledAt: '2026-07-21T08:45:00Z', durationMins: 60, fee: 280, satisfaction: 4 },
    { id: 'ap7', patientId: 'pt1', doctorId: 'dr5', status: 'completed', scheduledAt: '2026-06-30T13:00:00Z', durationMins: 25, fee: 110, satisfaction: 5 },
    { id: 'ap8', patientId: 'pt4', doctorId: 'dr2', status: 'completed', scheduledAt: '2026-07-03T16:20:00Z', durationMins: 45, fee: 260, satisfaction: 4 },
  ],
}

export const clinic: SampleApp = {
  id: 'clinic',
  name: 'Clinic',
  description: 'Patients, doctors and appointments - visits, revenue and satisfaction dashboards (KPI sparkline + target, satisfaction gauge, status/specialty charts, a scheduled-at revenue trend, a pivot, and a tabbed breakdown), filtered status-pill grids with row actions, patient master/detail, and rich edit forms (phone, blood-type, insurance mask, allergy chips, duration slider, ratings).',
  emoji: '\u{1FA7A}',
  accent: '#ef4444',
  build: () => {
    const doctorRows = pad(doctors, seed.doctors, 18)
    const patientRows = pad(patients, seed.patients, 60)
    const appointmentRows = pad(appointments, seed.appointments, 90, { patientId: ids(patientRows), doctorId: ids(doctorRows) })
    return project({
      title: 'HealthClinic',
      brand: 'HealthClinic',
      accent: '#ef4444',
      preset: 'material',
      footer: '',
      entities: [doctors, patients, appointments],
      seed: { doctors: doctorRows, patients: patientRows, appointments: appointmentRows },
      screens: [
        // Appointments dashboard: visit + revenue KPIs (a revenue card that trends
        // over scheduledAt with a $2k target), a satisfaction gauge (0-5), status
        // revenue/volume charts, a scheduled-at revenue area trend, a fee-by-status
        // pivot, a tabbed breakdown, a status filter, and a status-pill grid.
        dashScreen(appointments, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Appointments', reduce: 'count', span: 1 },
          { kpi: 'Total revenue', measure: 'fee', reduce: 'sum', format: 'currency', trendField: 'scheduledAt', trendReduce: 'sum', target: 2000, span: 1 },
          { kpi: 'Avg fee', measure: 'fee', reduce: 'avg', format: 'currency', span: 1 },
          { gauge: 'Avg satisfaction', measure: 'satisfaction', reduce: 'avg', min: 0, max: 5, span: 1 },
          { chart: 'status', measure: 'fee', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'scheduledAt', measure: 'fee', reduce: 'sum', type: 'area', span: 3 },
          { pivot: { rows: ['status'], cols: [], measure: 'fee', aggregate: 'sum' }, span: 3 },
          { tabs: [
            { label: 'Revenue by status', tiles: [{ chart: 'status', measure: 'fee', reduce: 'sum', type: 'bar' }] },
            { label: 'Visits by status', tiles: [{ chart: 'status', reduce: 'count', type: 'bar' }] },
          ], span: 3 },
          { filter: ['status'], span: 3 },
          { grid: true, format: statusPills(appointments, 'status'), summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Doctors dashboard: roster + rating KPIs, an average-rating gauge (0-5),
        // specialty breakdowns (pie + avg-rating bar), a specialty filter, and a
        // specialty-pill roster grid.
        dashScreen(doctors, { id: 'specialties', title: 'Specialties', order: 1 }, [
          { kpi: 'Doctors', reduce: 'count', span: 1 },
          { kpi: 'Avg rating', measure: 'rating', reduce: 'avg', span: 1 },
          { kpi: 'Top rating', measure: 'rating', reduce: 'max', span: 1 },
          { gauge: 'Avg patient rating', measure: 'rating', reduce: 'avg', min: 0, max: 5, span: 1 },
          { chart: 'specialty', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'specialty', measure: 'rating', reduce: 'avg', type: 'bar', span: 2 },
          { filter: ['specialty'], span: 3 },
          { grid: true, format: statusPills(doctors, 'specialty'), summaries: true, span: 3 },
        ]),
        calendarScreen(appointments, { id: 'schedule', title: 'Schedule', order: 2 }, { dateField: 'scheduledAt', titleField: 'patientId', colorField: 'status', filter: ['status', 'doctorId'] }),
        // Patient 360: chart header (blood-type pill) with a visit-history timeline -
        // each appointment titled by its doctor (relation resolved), colored by status.
        detailScreen(patients, { id: 'patient-360', title: 'Patient 360', order: 3 }, {
          titleField: 'name', subtitleField: 'email', statusField: 'bloodType',
          related: [{ entity: 'appointments', foreignKey: 'patientId', label: 'Visits', titleField: 'doctorId', subtitleField: 'fee', dateField: 'scheduledAt', statusField: 'status' }],
        }),
        screen(patients, 'master-detail', { id: 'patients', title: 'Patients', order: 4, child: appointments, foreignKey: 'patientId', linkScreen: 'patient-360' }),
        formScreen(appointments, { id: 'appointments', title: 'Appointments', order: 5 }, undefined, { format: apptFormats, summaries: true, rowActions: [{ kind: 'edit' }] }, ['status']),
        formScreen(doctors, { id: 'doctors', title: 'Doctors', order: 6 }, undefined, {}, ['specialty']),
      ],
    })
  },
}
