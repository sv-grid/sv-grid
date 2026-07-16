import type { EntitySchema } from '../../schema.js'
import { screen, project, dashScreen, type SampleApp } from './shared.js'

const courses: EntitySchema = {
  name: 'courses',
  label: 'Course',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'department', type: 'enum', label: 'Department', options: [
      { value: 'cs', label: 'Computer Science', color: '#6366f1' },
      { value: 'math', label: 'Mathematics', color: '#0ea5e9' },
      { value: 'biology', label: 'Biology', color: '#10b981' },
      { value: 'arts', label: 'Arts', color: '#ec4899' },
    ] },
    { field: 'credits', type: 'number', label: 'Credits' },
    { field: 'capacity', type: 'number', label: 'Capacity' },
  ],
}

const students: EntitySchema = {
  name: 'students',
  label: 'Student',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'email', type: 'text', format: 'email' },
    { field: 'year', type: 'enum', label: 'Year', options: [
      { value: 'freshman', label: 'Freshman', color: '#0ea5e9' },
      { value: 'sophomore', label: 'Sophomore', color: '#6366f1' },
      { value: 'junior', label: 'Junior', color: '#f59e0b' },
      { value: 'senior', label: 'Senior', color: '#10b981' },
    ] },
  ],
}

const enrollments: EntitySchema = {
  name: 'enrollments',
  label: 'Enrollment',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'studentId', type: 'relation', label: 'Student', relation: { entity: 'students', foreignKey: 'studentId', labelField: 'name' } },
    { field: 'courseId', type: 'relation', label: 'Course', relation: { entity: 'courses', foreignKey: 'courseId', labelField: 'name' } },
    { field: 'status', type: 'enum', label: 'Status', options: [
      { value: 'enrolled', label: 'Enrolled', color: '#6366f1' },
      { value: 'completed', label: 'Completed', color: '#10b981' },
      { value: 'dropped', label: 'Dropped', color: '#ef4444' },
    ] },
    { field: 'grade', type: 'number', label: 'Grade' },
  ],
}

const seed = {
  courses: [
    { id: 'cr1', name: 'Intro to Algorithms', department: 'cs', credits: 4, capacity: 120 },
    { id: 'cr2', name: 'Linear Algebra', department: 'math', credits: 3, capacity: 90 },
    { id: 'cr3', name: 'Molecular Biology', department: 'biology', credits: 4, capacity: 60 },
    { id: 'cr4', name: 'Renaissance Painting', department: 'arts', credits: 2, capacity: 40 },
    { id: 'cr5', name: 'Data Structures', department: 'cs', credits: 4, capacity: 110 },
    { id: 'cr6', name: 'Calculus III', department: 'math', credits: 3, capacity: 85 },
  ],
  students: [
    { id: 'st1', name: 'Liam Carter', email: 'liam.carter@campus.edu', year: 'freshman' },
    { id: 'st2', name: 'Emma Nguyen', email: 'emma.nguyen@campus.edu', year: 'sophomore' },
    { id: 'st3', name: 'Noah Silva', email: 'noah.silva@campus.edu', year: 'junior' },
    { id: 'st4', name: 'Ava Johansson', email: 'ava.johansson@campus.edu', year: 'senior' },
    { id: 'st5', name: 'Mateo Rossi', email: 'mateo.rossi@campus.edu', year: 'sophomore' },
    { id: 'st6', name: 'Isla Murphy', email: 'isla.murphy@campus.edu', year: 'freshman' },
  ],
  enrollments: [
    { id: 'en1', studentId: 'st1', courseId: 'cr1', status: 'enrolled', grade: 0 },
    { id: 'en2', studentId: 'st2', courseId: 'cr2', status: 'completed', grade: 88 },
    { id: 'en3', studentId: 'st3', courseId: 'cr3', status: 'completed', grade: 92 },
    { id: 'en4', studentId: 'st4', courseId: 'cr4', status: 'dropped', grade: 0 },
    { id: 'en5', studentId: 'st5', courseId: 'cr1', status: 'enrolled', grade: 0 },
    { id: 'en6', studentId: 'st6', courseId: 'cr5', status: 'completed', grade: 79 },
    { id: 'en7', studentId: 'st3', courseId: 'cr6', status: 'completed', grade: 84 },
    { id: 'en8', studentId: 'st2', courseId: 'cr5', status: 'enrolled', grade: 0 },
  ],
}

export const school: SampleApp = {
  id: 'school',
  name: 'School',
  description: 'Students, courses and enrollments - capacity and enrollment dashboards.',
  emoji: '\u{1F393}',
  accent: '#6366f1',
  build: () =>
    project({
      title: 'Campus',
      brand: 'Campus',
      accent: '#6366f1',
      footer: '',
      entities: [courses, students, enrollments],
      seed,
      screens: [
        dashScreen(courses, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Courses', reduce: 'count' },
          { kpi: 'Total capacity', measure: 'capacity', reduce: 'sum' },
          { kpi: 'Avg credits', measure: 'credits', reduce: 'avg' },
          { chart: 'department', measure: 'capacity', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Max credits', measure: 'credits', reduce: 'max', span: 1 },
          { chart: 'department', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, span: 3 },
        ]),
        screen(courses, 'master-detail', { id: 'courses', title: 'Courses', order: 1, child: enrollments, foreignKey: 'courseId' }),
        screen(students, 'crud', { id: 'students', title: 'Students', order: 2 }),
        screen(enrollments, 'crud', { id: 'enrollments', title: 'Enrollments', order: 3 }),
      ],
    }),
}
