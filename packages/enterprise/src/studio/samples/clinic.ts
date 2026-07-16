import type { EntitySchema } from '../../schema.js'
import { screen, project, dashScreen, type SampleApp } from './shared.js'

const doctors: EntitySchema = {
  name: 'doctors',
  label: 'Doctor',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'email', type: 'text', format: 'email' },
    { field: 'specialty', type: 'enum', label: 'Specialty', options: [
      { value: 'gp', label: 'General Practice', color: '#6366f1' },
      { value: 'cardiology', label: 'Cardiology', color: '#ef4444' },
      { value: 'dermatology', label: 'Dermatology', color: '#f59e0b' },
      { value: 'pediatrics', label: 'Pediatrics', color: '#10b981' },
    ] },
  ],
}

const patients: EntitySchema = {
  name: 'patients',
  label: 'Patient',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'email', type: 'text', format: 'email' },
    { field: 'phone', type: 'text' },
    { field: 'dob', type: 'date', label: 'Date of birth' },
  ],
}

const appointments: EntitySchema = {
  name: 'appointments',
  label: 'Appointment',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'patientId', type: 'relation', label: 'Patient', relation: { entity: 'patients', foreignKey: 'patientId', labelField: 'name' } },
    { field: 'doctorId', type: 'relation', label: 'Doctor', relation: { entity: 'doctors', foreignKey: 'doctorId', labelField: 'name' } },
    { field: 'status', type: 'enum', label: 'Status', options: [
      { value: 'scheduled', label: 'Scheduled', color: '#6366f1' },
      { value: 'completed', label: 'Completed', color: '#10b981' },
      { value: 'cancelled', label: 'Cancelled', color: '#ef4444' },
      { value: 'no_show', label: 'No show', color: '#94a3b8' },
    ] },
    { field: 'fee', type: 'number', label: 'Fee ($)' },
    { field: 'durationMins', type: 'number', label: 'Duration (min)' },
    { field: 'date', type: 'date', label: 'Date' },
  ],
}

const seed = {
  doctors: [
    { id: 'dr1', name: 'Dr. Sarah Mendes', email: 'sarah.mendes@healthclinic.com', specialty: 'gp' },
    { id: 'dr2', name: 'Dr. James Whitfield', email: 'james.whitfield@healthclinic.com', specialty: 'cardiology' },
    { id: 'dr3', name: 'Dr. Aisha Rahman', email: 'aisha.rahman@healthclinic.com', specialty: 'dermatology' },
    { id: 'dr4', name: 'Dr. Marcus Liang', email: 'marcus.liang@healthclinic.com', specialty: 'pediatrics' },
    { id: 'dr5', name: 'Dr. Elena Popova', email: 'elena.popova@healthclinic.com', specialty: 'gp' },
    { id: 'dr6', name: 'Dr. Thomas Becker', email: 'thomas.becker@healthclinic.com', specialty: 'cardiology' },
  ],
  patients: [
    { id: 'pt1', name: 'Oliver Grant', email: 'oliver.grant@example.com', phone: '+1 (415) 555-0201', dob: '1984-03-12' },
    { id: 'pt2', name: 'Maya Fernandez', email: 'maya.fernandez@example.com', phone: '+1 (415) 555-0202', dob: '1991-11-04' },
    { id: 'pt3', name: 'Noah Kim', email: 'noah.kim@example.com', phone: '+1 (650) 555-0203', dob: '2015-06-22' },
    { id: 'pt4', name: 'Sophia Rossi', email: 'sophia.rossi@example.com', phone: '+1 (212) 555-0204', dob: '1978-09-30' },
    { id: 'pt5', name: 'Ethan Walsh', email: 'ethan.walsh@example.com', phone: '+1 (312) 555-0205', dob: '2001-01-18' },
    { id: 'pt6', name: 'Amara Okafor', email: 'amara.okafor@example.com', phone: '+1 (206) 555-0206', dob: '1996-07-08' },
  ],
  appointments: [
    { id: 'ap1', patientId: 'pt1', doctorId: 'dr1', status: 'completed', fee: 120, durationMins: 30, date: '2026-06-02' },
    { id: 'ap2', patientId: 'pt2', doctorId: 'dr2', status: 'scheduled', fee: 260, durationMins: 45, date: '2026-07-18' },
    { id: 'ap3', patientId: 'pt3', doctorId: 'dr4', status: 'completed', fee: 90, durationMins: 20, date: '2026-06-14' },
    { id: 'ap4', patientId: 'pt4', doctorId: 'dr3', status: 'cancelled', fee: 150, durationMins: 30, date: '2026-05-27' },
    { id: 'ap5', patientId: 'pt5', doctorId: 'dr1', status: 'no_show', fee: 120, durationMins: 30, date: '2026-06-09' },
    { id: 'ap6', patientId: 'pt6', doctorId: 'dr6', status: 'scheduled', fee: 280, durationMins: 60, date: '2026-07-21' },
    { id: 'ap7', patientId: 'pt1', doctorId: 'dr5', status: 'completed', fee: 110, durationMins: 25, date: '2026-06-30' },
    { id: 'ap8', patientId: 'pt4', doctorId: 'dr2', status: 'completed', fee: 260, durationMins: 45, date: '2026-07-03' },
  ],
}

export const clinic: SampleApp = {
  id: 'clinic',
  name: 'Clinic',
  description: 'Patients, doctors and appointments - visits and revenue dashboards.',
  emoji: '\u{1FA7A}',
  accent: '#ef4444',
  build: () =>
    project({
      title: 'HealthClinic',
      brand: 'HealthClinic',
      accent: '#ef4444',
      footer: '',
      entities: [doctors, patients, appointments],
      seed,
      screens: [
        dashScreen(appointments, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Appointments', reduce: 'count' },
          { kpi: 'Total revenue', measure: 'fee', reduce: 'sum' },
          { kpi: 'Avg fee', measure: 'fee', reduce: 'avg' },
          { chart: 'status', measure: 'fee', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Top fee', measure: 'fee', reduce: 'max', span: 1 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, span: 3 },
        ]),
        screen(patients, 'master-detail', { id: 'patients', title: 'Patients', order: 1, child: appointments, foreignKey: 'patientId' }),
        screen(appointments, 'crud', { id: 'appointments', title: 'Appointments', order: 2 }),
        screen(doctors, 'crud', { id: 'doctors', title: 'Doctors', order: 3 }),
      ],
    }),
}
