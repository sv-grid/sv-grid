import type { EntitySchema } from '../../schema.js'
import type { FormatRule } from '../project.js'
import { screen, formScreen, project, dashScreen, detailScreen, statusPills, pad, ids, type SampleApp } from './shared.js'

const courses: EntitySchema = {
  name: 'courses',
  label: 'Course',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'department', type: 'enum', label: 'Department', required: true, options: [
      { value: 'cs', label: 'Computer Science', color: '#6366f1' },
      { value: 'math', label: 'Mathematics', color: '#0ea5e9' },
      { value: 'biology', label: 'Biology', color: '#10b981' },
      { value: 'arts', label: 'Arts', color: '#ec4899' },
    ] },
    { field: 'credits', type: 'number', label: 'Credits', required: true, min: 0, max: 6, defaultValue: 3, input: { help: 'Credit hours awarded on completion' } },
    { field: 'capacity', type: 'number', label: 'Capacity', required: true, min: 1, input: { help: 'Maximum seats per term' } },
    { field: 'fee', type: 'number', label: 'Fee ($)', min: 0, defaultValue: 0, input: { prefix: '$', help: 'Tuition charged per seat' } },
    { field: 'topics', type: 'text', label: 'Topics', input: { editorType: 'chips', help: 'Syllabus themes, e.g. Workshop / Hands-on' } },
    { field: 'rating', type: 'number', label: 'Rating', min: 0, max: 5, defaultValue: 0, input: { editorType: 'rating', help: 'Average student rating' } },
    { field: 'color', type: 'text', label: 'Catalog color', defaultValue: '#6366f1', input: { editorType: 'color', help: 'Swatch shown in the course catalog' } },
    // Derived: projected tuition if every seat is filled (display-only, never stored).
    { field: 'revenue', type: 'number', label: 'Revenue ($)', readonly: true, formula: 'fee * capacity' },
    { field: 'active', type: 'boolean', label: 'Active', defaultValue: true },
  ],
}

const students: EntitySchema = {
  name: 'students',
  label: 'Student',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', format: 'email', required: true },
    { field: 'phone', type: 'text', label: 'Phone', input: { editorType: 'phone', help: 'Primary contact number' } },
    { field: 'country', type: 'text', label: 'Country', input: { editorType: 'country', help: 'Country of residence' } },
    { field: 'sisId', type: 'text', label: 'SIS number', input: { editorType: 'mask', mask: 'SIS-######', help: 'Student information system id' } },
    { field: 'gpa', type: 'number', label: 'GPA', min: 0, max: 4, defaultValue: 0, input: { step: 0.1, precision: 2, help: 'Grade point average, 0 to 4' } },
    { field: 'year', type: 'enum', label: 'Year', required: true, options: [
      { value: 'freshman', label: 'Freshman', color: '#0ea5e9' },
      { value: 'sophomore', label: 'Sophomore', color: '#6366f1' },
      { value: 'junior', label: 'Junior', color: '#f59e0b' },
      { value: 'senior', label: 'Senior', color: '#10b981' },
    ] },
    { field: 'enrolledAt', type: 'datetime', label: 'Enrolled at', input: { help: 'First matriculation date' } },
    { field: 'active', type: 'boolean', label: 'Active', defaultValue: true },
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
    { field: 'term', type: 'enum', label: 'Term', required: true, options: [
      { value: 'fall2025', label: 'Fall 2025', color: '#6366f1' },
      { value: 'spring2026', label: 'Spring 2026', color: '#10b981' },
      { value: 'summer2026', label: 'Summer 2026', color: '#f59e0b' },
    ] },
    { field: 'status', type: 'enum', label: 'Status', required: true, options: [
      { value: 'enrolled', label: 'Enrolled', color: '#6366f1' },
      { value: 'completed', label: 'Completed', color: '#10b981' },
      { value: 'dropped', label: 'Dropped', color: '#ef4444' },
    ] },
    { field: 'grade', type: 'number', label: 'Grade', min: 0, max: 100, defaultValue: 0, input: { help: 'Final score, 0 to 100' } },
    { field: 'attendance', type: 'number', label: 'Attendance (%)', min: 0, max: 100, defaultValue: 100, input: { editorType: 'slider', suffix: '%', help: 'Share of sessions attended' } },
    // Derived: attendance-weighted final score (display-only, never stored).
    { field: 'finalScore', type: 'number', label: 'Final score', readonly: true, formula: 'grade * attendance / 100' },
    { field: 'enrolledOn', type: 'date', label: 'Enrolled on' },
  ],
}

// Enrollment grid formatting: term + status pills, plus attendance/grade
// thresholds (chronic absentees red, near-perfect attendance green + bold,
// top grades bold) - data-driven color, not just status pills.
const enrollmentFormats: FormatRule[] = [
  ...statusPills(enrollments, 'status'),
  ...statusPills(enrollments, 'term'),
  { field: 'attendance', op: 'lt', value: 50, color: '#dc2626' },
  { field: 'attendance', op: 'gte', value: 90, color: '#16a34a', bold: true },
  { field: 'grade', op: 'gte', value: 90, bold: true },
]

// Course catalog formatting: department pills plus rating / capacity thresholds
// (five-star courses green + bold, thin sections red).
const courseFormats: FormatRule[] = [
  ...statusPills(courses, 'department'),
  { field: 'rating', op: 'gte', value: 5, color: '#16a34a', bold: true },
  { field: 'capacity', op: 'lt', value: 40, color: '#dc2626' },
]

const seed = {
  courses: [
    { id: 'cr1', name: 'Intro to Algorithms', department: 'cs', credits: 4, capacity: 120, fee: 1200, topics: ['Beginner', 'Hands-on'], rating: 5, color: '#6366f1', active: true },
    { id: 'cr2', name: 'Linear Algebra', department: 'math', credits: 3, capacity: 90, fee: 950, topics: ['Advanced'], rating: 4, color: '#0ea5e9', active: true },
    { id: 'cr3', name: 'Molecular Biology', department: 'biology', credits: 4, capacity: 60, fee: 1400, topics: ['Workshop', 'Live'], rating: 4, color: '#10b981', active: true },
    { id: 'cr4', name: 'Renaissance Painting', department: 'arts', credits: 2, capacity: 40, fee: 700, topics: ['Beginner'], rating: 3, color: '#ec4899', active: true },
    { id: 'cr5', name: 'Data Structures', department: 'cs', credits: 4, capacity: 110, fee: 1250, topics: ['Advanced', 'Hands-on'], rating: 5, color: '#6366f1', active: true },
    { id: 'cr6', name: 'Calculus III', department: 'math', credits: 3, capacity: 85, fee: 980, topics: ['Advanced'], rating: 4, color: '#0ea5e9', active: true },
    { id: 'cr7', name: 'Genetics', department: 'biology', credits: 3, capacity: 70, fee: 1100, topics: ['Workshop'], rating: 4, color: '#10b981', active: true },
    { id: 'cr8', name: 'Sculpture Studio', department: 'arts', credits: 2, capacity: 30, fee: 650, topics: ['Hands-on', 'Beginner'], rating: 3, color: '#ec4899', active: false },
  ],
  students: [
    { id: 'st1', name: 'Liam Carter', email: 'liam.carter@campus.edu', phone: '+1 (415) 555-0101', country: 'United States', sisId: 'SIS-100234', gpa: 3.6, year: 'freshman', enrolledAt: '2025-09-01T09:00:00Z', active: true },
    { id: 'st2', name: 'Emma Nguyen', email: 'emma.nguyen@campus.edu', phone: '+1 (416) 555-0102', country: 'Canada', sisId: 'SIS-100235', gpa: 3.9, year: 'sophomore', enrolledAt: '2024-09-02T09:00:00Z', active: true },
    { id: 'st3', name: 'Noah Silva', email: 'noah.silva@campus.edu', phone: '+44 20 7946 0103', country: 'United Kingdom', sisId: 'SIS-100236', gpa: 3.4, year: 'junior', enrolledAt: '2023-09-01T09:00:00Z', active: true },
    { id: 'st4', name: 'Ava Johansson', email: 'ava.johansson@campus.edu', phone: '+46 8 555 0104', country: 'Sweden', sisId: 'SIS-100237', gpa: 3.8, year: 'senior', enrolledAt: '2022-09-05T09:00:00Z', active: true },
    { id: 'st5', name: 'Mateo Rossi', email: 'mateo.rossi@campus.edu', phone: '+39 06 5550105', country: 'Italy', sisId: 'SIS-100238', gpa: 3.1, year: 'sophomore', enrolledAt: '2024-09-03T09:00:00Z', active: true },
    { id: 'st6', name: 'Isla Murphy', email: 'isla.murphy@campus.edu', phone: '+353 1 555 0106', country: 'Ireland', sisId: 'SIS-100239', gpa: 3.7, year: 'freshman', enrolledAt: '2025-09-02T09:00:00Z', active: true },
    { id: 'st7', name: 'Kenji Watanabe', email: 'kenji.watanabe@campus.edu', phone: '+81 3 5550107', country: 'Japan', sisId: 'SIS-100240', gpa: 3.5, year: 'junior', enrolledAt: '2023-09-04T09:00:00Z', active: true },
    { id: 'st8', name: 'Sofia Garcia', email: 'sofia.garcia@campus.edu', phone: '+34 91 555 0108', country: 'Spain', sisId: 'SIS-100241', gpa: 2.9, year: 'senior', enrolledAt: '2022-09-06T09:00:00Z', active: false },
  ],
  enrollments: [
    { id: 'en1', studentId: 'st1', courseId: 'cr1', term: 'fall2025', status: 'enrolled', grade: 0, attendance: 92, enrolledOn: '2025-09-01' },
    { id: 'en2', studentId: 'st2', courseId: 'cr2', term: 'spring2026', status: 'completed', grade: 88, attendance: 96, enrolledOn: '2026-01-15' },
    { id: 'en3', studentId: 'st3', courseId: 'cr3', term: 'fall2025', status: 'completed', grade: 92, attendance: 90, enrolledOn: '2025-09-03' },
    { id: 'en4', studentId: 'st4', courseId: 'cr4', term: 'fall2025', status: 'dropped', grade: 0, attendance: 40, enrolledOn: '2025-09-04' },
    { id: 'en5', studentId: 'st5', courseId: 'cr1', term: 'spring2026', status: 'enrolled', grade: 0, attendance: 85, enrolledOn: '2026-01-16' },
    { id: 'en6', studentId: 'st6', courseId: 'cr5', term: 'fall2025', status: 'completed', grade: 79, attendance: 88, enrolledOn: '2025-09-02' },
    { id: 'en7', studentId: 'st3', courseId: 'cr6', term: 'spring2026', status: 'completed', grade: 84, attendance: 91, enrolledOn: '2026-01-14' },
    { id: 'en8', studentId: 'st2', courseId: 'cr5', term: 'summer2026', status: 'enrolled', grade: 0, attendance: 78, enrolledOn: '2026-05-20' },
    { id: 'en9', studentId: 'st7', courseId: 'cr7', term: 'fall2025', status: 'completed', grade: 81, attendance: 87, enrolledOn: '2025-09-05' },
    { id: 'en10', studentId: 'st8', courseId: 'cr8', term: 'spring2026', status: 'dropped', grade: 0, attendance: 35, enrolledOn: '2026-01-18' },
  ],
}

export const school: SampleApp = {
  id: 'school',
  name: 'School',
  description: 'Students, courses and enrollments - enrollment + catalog dashboards (attendance sparkline + gauge, term/status breakdowns, a term x status pivot, tabbed views, faceted filters), status-pill enrollment grids with attendance/grade thresholds and row actions, courses master/detail, and rich edit forms (topic chips, course rating, catalog color, phone, country, SIS mask, GPA, enrollment datetime, attendance slider).',
  emoji: '\u{1F393}',
  accent: '#6366f1',
  build: () => {
    const courseRows = pad(courses, seed.courses, 12)
    const studentRows = pad(students, seed.students, 22)
    const enrollmentRows = pad(enrollments, seed.enrollments, 34, { studentId: ids(studentRows), courseId: ids(courseRows) })
    return project({
      title: 'Campus',
      brand: 'Campus',
      accent: '#6366f1',
      preset: 'github',
      navStyle: 'top-nav',
      footer: '',
      entities: [courses, students, enrollments],
      seed: { courses: courseRows, students: studentRows, enrollments: enrollmentRows },
      screens: [
        // Enrollment dashboard: volume + quality KPIs (an attendance card that trends
        // over enrollment dates), an attendance gauge, term/status breakdowns, a grade
        // trend area, a tabbed breakdown, a term x status pivot, a filter, and an
        // enrollment grid with term + status pills and attendance/grade thresholds.
        dashScreen(enrollments, { id: 'enrollment', title: 'Enrollment', order: 0 }, [
          { kpi: 'Enrollments', reduce: 'count', span: 1 },
          { kpi: 'Avg grade', measure: 'grade', reduce: 'avg', span: 1 },
          { kpi: 'Avg attendance', measure: 'attendance', reduce: 'avg', format: 'percent', trendField: 'enrolledOn', trendReduce: 'avg', span: 1 },
          { gauge: 'Avg attendance', measure: 'attendance', reduce: 'avg', min: 0, max: 100, unit: '%', span: 1 },
          { chart: 'term', reduce: 'count', type: 'bar', span: 2 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'enrolledOn', measure: 'grade', reduce: 'avg', type: 'area', span: 3 },
          { tabs: [
            { label: 'By term', tiles: [{ chart: 'term', reduce: 'count', type: 'bar' }] },
            { label: 'By status', tiles: [{ chart: 'status', reduce: 'count', type: 'bar' }] },
          ], span: 3 },
          { pivot: { rows: ['term'], cols: ['status'], measure: 'grade', aggregate: 'avg' }, span: 3 },
          { filter: ['term', 'status'], span: 3 },
          { grid: true, format: enrollmentFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Catalog dashboard: course counts + capacity KPIs (a capacity card with a
        // 1,000-seat target), an average-rating gauge, department breakdowns, a
        // filter, and a course grid with department pills + rating/capacity thresholds.
        dashScreen(courses, { id: 'catalog', title: 'Catalog', order: 1 }, [
          { kpi: 'Courses', reduce: 'count', span: 1 },
          { kpi: 'Total capacity', measure: 'capacity', reduce: 'sum', target: 1000, span: 1 },
          { kpi: 'Avg credits', measure: 'credits', reduce: 'avg', span: 1 },
          { gauge: 'Avg rating', measure: 'rating', reduce: 'avg', min: 0, max: 5, span: 1 },
          { chart: 'department', measure: 'capacity', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'department', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'department', measure: 'fee', reduce: 'avg', type: 'bar', span: 2 },
          { filter: ['department', 'active'], span: 1 },
          { grid: true, format: courseFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        detailScreen(students, { id: 'student-360', title: 'Student 360', order: 2 }, {
          titleField: 'name', subtitleField: 'email', statusField: 'year', metricFields: ['gpa'],
          related: [{ entity: 'enrollments', foreignKey: 'studentId', label: 'Enrollments', titleField: 'courseId', subtitleField: 'grade', dateField: 'enrolledOn', statusField: 'status' }],
        }),
        screen(courses, 'master-detail', { id: 'courses', title: 'Courses', order: 3, child: enrollments, foreignKey: 'courseId' }),
        formScreen(students, { id: 'students', title: 'Students', order: 4 }, undefined, { rowLink: { screen: 'student-360', sourceField: 'id', targetField: 'id' } }, ['year', 'country', 'active']),
        formScreen(enrollments, { id: 'enrollments', title: 'Enrollments', order: 5 }, undefined, { format: enrollmentFormats, summaries: true, rowActions: [{ kind: 'edit' }] }, ['term', 'status', 'studentId', 'courseId']),
      ],
    })
  },
}
