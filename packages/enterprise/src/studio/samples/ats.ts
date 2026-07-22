import type { EntitySchema } from '../../schema.js'
import type { FormatRule } from '../project.js'
import { screen, formScreen, boardScreen, calendarScreen, project, dashScreen, detailScreen, statusPills, pad, ids, type SampleApp } from './shared.js'

const jobs: EntitySchema = {
  name: 'jobs',
  label: 'Job',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'title', type: 'text', required: true, minLength: 3 },
    { field: 'department', type: 'enum', required: true, options: [
      { value: 'engineering', label: 'Engineering', color: '#6366f1' },
      { value: 'design', label: 'Design', color: '#ec4899' },
      { value: 'sales', label: 'Sales', color: '#f59e0b' },
      { value: 'ops', label: 'Ops', color: '#0ea5e9' },
    ] },
    { field: 'location', type: 'text', label: 'Location', input: { editorType: 'country', help: 'Where the role is based' } },
    { field: 'status', type: 'enum', required: true, defaultValue: 'open', options: [
      { value: 'open', label: 'Open', color: '#10b981' },
      { value: 'on_hold', label: 'On hold', color: '#f59e0b' },
      { value: 'closed', label: 'Closed', color: '#94a3b8' },
    ] },
    { field: 'openings', type: 'number', label: 'Openings', min: 0, max: 25, defaultValue: 1, input: { help: 'Headcount to fill' } },
    { field: 'salaryMin', type: 'number', label: 'Salary min ($)', min: 0 },
    { field: 'salaryMax', type: 'number', label: 'Salary max ($)', min: 0 },
    // Derived: midpoint of the posted salary band (display-only).
    { field: 'salaryMid', type: 'number', label: 'Salary mid ($)', readonly: true, formula: '(salaryMin + salaryMax) / 2' },
    { field: 'hiringManager', type: 'text', label: 'Hiring manager' },
    { field: 'postedDate', type: 'date', label: 'Posted date' },
  ],
}

const candidates: EntitySchema = {
  name: 'candidates',
  label: 'Candidate',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', format: 'email', required: true },
    { field: 'phone', type: 'text', input: { editorType: 'phone' } },
    { field: 'country', type: 'text', label: 'Country', input: { editorType: 'country' } },
    { field: 'source', type: 'enum', options: [
      { value: 'referral', label: 'Referral', color: '#10b981' },
      { value: 'linkedin', label: 'LinkedIn', color: '#0ea5e9' },
      { value: 'website', label: 'Website', color: '#6366f1' },
      { value: 'agency', label: 'Agency', color: '#f59e0b' },
    ] },
    { field: 'skills', type: 'text', label: 'Skills', input: { editorType: 'chips', help: 'Key skills / stack' } },
    { field: 'rating', type: 'number', label: 'Rating', min: 1, max: 5, defaultValue: 3, input: { editorType: 'rating', help: '1-5 recruiter score' } },
    { field: 'linkedin', type: 'text', label: 'LinkedIn', format: 'url', input: { placeholder: 'https://linkedin.com/in/…' } },
    { field: 'portfolio', type: 'text', label: 'Portfolio', format: 'url', input: { placeholder: 'https://…' } },
  ],
}

const applications: EntitySchema = {
  name: 'applications',
  label: 'Application',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'candidateId', type: 'relation', label: 'Candidate', relation: { entity: 'candidates', foreignKey: 'candidateId', labelField: 'name' } },
    { field: 'jobId', type: 'relation', label: 'Job', relation: { entity: 'jobs', foreignKey: 'jobId', labelField: 'title' } },
    { field: 'stage', type: 'enum', required: true, options: [
      { value: 'applied', label: 'Applied', color: '#94a3b8' },
      { value: 'screen', label: 'Screen', color: '#0ea5e9' },
      { value: 'interview', label: 'Interview', color: '#6366f1' },
      { value: 'offer', label: 'Offer', color: '#f59e0b' },
      { value: 'hired', label: 'Hired', color: '#10b981' },
      { value: 'rejected', label: 'Rejected', color: '#ef4444' },
    ] },
    { field: 'score', type: 'number', label: 'Score', min: 0, max: 100, defaultValue: 50, input: { editorType: 'slider', help: 'Overall fit 0-100' } },
    { field: 'fit', type: 'number', label: 'Culture fit', min: 1, max: 5, input: { editorType: 'rating' } },
    { field: 'appliedDate', type: 'date', label: 'Applied date' },
    { field: 'interviewAt', type: 'datetime', label: 'Interview at', input: { editorType: 'datetime', help: 'Scheduled interview slot' } },
  ],
}

// Application grid formatting: stage pills + score thresholds (strong green/bold,
// weak red) - data-driven color beyond the pipeline status.
const appFormats: FormatRule[] = [
  ...statusPills(applications, 'stage'),
  { field: 'score', op: 'gte', value: 80, color: '#16a34a', bold: true },
  { field: 'score', op: 'lt', value: 50, color: '#dc2626' },
]
// Job grid formatting: status + department pills + urgent-openings bold.
const jobFormats: FormatRule[] = [
  ...statusPills(jobs, 'status'),
  ...statusPills(jobs, 'department'),
  { field: 'openings', op: 'gte', value: 3, bold: true },
]
// Candidate grid formatting: source pills + rating thresholds.
const candidateFormats: FormatRule[] = [
  ...statusPills(candidates, 'source'),
  { field: 'rating', op: 'gte', value: 4, color: '#16a34a', bold: true },
  { field: 'rating', op: 'lte', value: 2, color: '#dc2626' },
]

const seed = {
  jobs: [
    { id: 'jb1', title: 'Senior Frontend Engineer', department: 'engineering', location: 'United States', status: 'open', openings: 2, salaryMin: 140000, salaryMax: 180000, hiringManager: 'Sam Rivera', postedDate: '2026-06-02' },
    { id: 'jb2', title: 'Product Designer', department: 'design', location: 'United Kingdom', status: 'open', openings: 1, salaryMin: 90000, salaryMax: 120000, hiringManager: 'Jamie Chen', postedDate: '2026-06-10' },
    { id: 'jb3', title: 'Account Executive', department: 'sales', location: 'Germany', status: 'on_hold', openings: 3, salaryMin: 80000, salaryMax: 110000, hiringManager: 'Priya Patel', postedDate: '2026-05-18' },
    { id: 'jb4', title: 'DevOps Engineer', department: 'engineering', location: 'Canada', status: 'open', openings: 1, salaryMin: 130000, salaryMax: 165000, hiringManager: 'Sam Rivera', postedDate: '2026-06-21' },
    { id: 'jb5', title: 'Operations Manager', department: 'ops', location: 'Netherlands', status: 'closed', openings: 1, salaryMin: 85000, salaryMax: 115000, hiringManager: 'Jamie Chen', postedDate: '2026-04-30' },
    { id: 'jb6', title: 'UX Researcher', department: 'design', location: 'Australia', status: 'open', openings: 1, salaryMin: 95000, salaryMax: 125000, hiringManager: 'Priya Patel', postedDate: '2026-06-27' },
  ],
  candidates: [
    { id: 'cd1', name: 'Maya Fernandez', email: 'maya.fernandez@example.com', phone: '+1 (415) 555-0110', country: 'United States', source: 'referral', skills: ['React', 'TypeScript', 'GraphQL'], rating: 4, linkedin: 'https://linkedin.com/in/mayafernandez', portfolio: 'https://mayafernandez.dev' },
    { id: 'cd2', name: 'Liam Chen', email: 'liam.chen@example.com', phone: '+44 20 7946 0111', country: 'United Kingdom', source: 'linkedin', skills: ['Svelte', 'Node.js'], rating: 5, linkedin: 'https://linkedin.com/in/liamchen', portfolio: 'https://liamchen.io' },
    { id: 'cd3', name: 'Priya Nair', email: 'priya.nair@example.com', phone: '+91 22 5550 0112', country: 'India', source: 'website', skills: ['Figma', 'UX', 'Product'], rating: 4, linkedin: 'https://linkedin.com/in/priyanair', portfolio: 'https://priyanair.design' },
    { id: 'cd4', name: 'Noah Williams', email: 'noah.williams@example.com', phone: '+1 (312) 555-0113', country: 'United States', source: 'agency', skills: ['Go', 'Docker', 'Kubernetes'], rating: 3, linkedin: 'https://linkedin.com/in/noahwilliams', portfolio: 'https://noahwilliams.dev' },
    { id: 'cd5', name: 'Sofia Rossi', email: 'sofia.rossi@example.com', phone: '+39 06 5550 0114', country: 'Italy', source: 'linkedin', skills: ['Python', 'SQL', 'AWS'], rating: 5, linkedin: 'https://linkedin.com/in/sofiarossi', portfolio: 'https://sofiarossi.tech' },
    { id: 'cd6', name: 'Ethan Brooks', email: 'ethan.brooks@example.com', phone: '+1 (206) 555-0115', country: 'Canada', source: 'referral', skills: ['Leadership', 'Product'], rating: 3, linkedin: 'https://linkedin.com/in/ethanbrooks', portfolio: 'https://ethanbrooks.co' },
    { id: 'cd7', name: 'Amara Okafor', email: 'amara.okafor@example.com', phone: '+234 1 555 0116', country: 'Nigeria', source: 'website', skills: ['Rust', 'Go', 'AWS'], rating: 4, linkedin: 'https://linkedin.com/in/amaraokafor', portfolio: 'https://amaraokafor.dev' },
  ],
  applications: [
    { id: 'ap1', candidateId: 'cd1', jobId: 'jb1', stage: 'interview', score: 82, fit: 4, appliedDate: '2026-06-05', interviewAt: '2026-07-08T09:30:00Z' },
    { id: 'ap2', candidateId: 'cd2', jobId: 'jb1', stage: 'offer', score: 91, fit: 5, appliedDate: '2026-06-12', interviewAt: '2026-07-02T14:00:00Z' },
    { id: 'ap3', candidateId: 'cd3', jobId: 'jb2', stage: 'screen', score: 74, fit: 4, appliedDate: '2026-06-15', interviewAt: '2026-07-11T10:00:00Z' },
    { id: 'ap4', candidateId: 'cd4', jobId: 'jb3', stage: 'applied', score: 60, fit: 3, appliedDate: '2026-06-20', interviewAt: '2026-07-15T15:30:00Z' },
    { id: 'ap5', candidateId: 'cd5', jobId: 'jb4', stage: 'hired', score: 95, fit: 5, appliedDate: '2026-05-28', interviewAt: '2026-06-18T11:00:00Z' },
    { id: 'ap6', candidateId: 'cd6', jobId: 'jb1', stage: 'rejected', score: 48, fit: 2, appliedDate: '2026-06-08', interviewAt: '2026-06-25T13:00:00Z' },
    { id: 'ap7', candidateId: 'cd7', jobId: 'jb6', stage: 'interview', score: 79, fit: 4, appliedDate: '2026-06-22', interviewAt: '2026-07-14T09:00:00Z' },
    { id: 'ap8', candidateId: 'cd3', jobId: 'jb4', stage: 'screen', score: 68, fit: 3, appliedDate: '2026-06-25', interviewAt: '2026-07-16T16:00:00Z' },
  ],
}

export const ats: SampleApp = {
  id: 'ats',
  name: 'Recruiting',
  description: 'Jobs, candidates and an application pipeline - hiring + openings + candidate dashboards (score KPI sparkline + gauge, applications-over-time trend, department x status pivot, tabbed breakdown), status-pill grids with score/rating conditional formatting, filters, row actions, master/detail, and rich edit forms.',
  emoji: '\u{1F4DD}',
  accent: '#7c3aed',
  build: () => {
    const jobRows = pad(jobs, seed.jobs, 12)
    const candidateRows = pad(candidates, seed.candidates, 20)
    const jobPool = ids(jobRows)
    const candidatePool = ids(candidateRows)
    const applicationRows = pad(applications, seed.applications, 30, { jobId: jobPool, candidateId: candidatePool })
    return project({
      title: 'HireDesk',
      brand: 'HireDesk',
      accent: '#7c3aed',
      preset: 'ag-alpine',
      footer: '',
      entities: [jobs, candidates, applications],
      seed: { jobs: jobRows, candidates: candidateRows, applications: applicationRows },
      screens: [
        // Hiring pipeline: score KPI (sparkline over applied date) + a score gauge,
        // stage breakdowns, an applications-over-time trend, a tabbed view, a filter,
        // and a stage-pill grid with score conditional formatting.
        dashScreen(applications, { id: 'overview', title: 'Pipeline', order: 0 }, [
          { kpi: 'Applications', reduce: 'count', span: 1 },
          { kpi: 'Avg score', measure: 'score', reduce: 'avg', trendField: 'appliedDate', trendReduce: 'avg', span: 1 },
          { kpi: 'Top score', measure: 'score', reduce: 'max', span: 1 },
          { gauge: 'Avg fit score', measure: 'score', reduce: 'avg', min: 0, max: 100, span: 1 },
          { chart: 'stage', reduce: 'count', type: 'bar', span: 2 },
          { chart: 'stage', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'appliedDate', reduce: 'count', type: 'area', span: 3 },
          { tabs: [
            { label: 'By stage', tiles: [{ chart: 'stage', reduce: 'count', type: 'bar' }] },
            { label: 'Score by stage', tiles: [{ chart: 'stage', measure: 'score', reduce: 'avg', type: 'bar' }] },
          ], span: 3 },
          { filter: ['stage'], span: 3 },
          { grid: true, format: appFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // The signature ATS view: a candidate pipeline as draggable Kanban columns
        // by stage (Applied -> Hired), each card the candidate name + job + score.
        boardScreen(applications, { id: 'pipeline-board', title: 'Board', order: 1 }, { groupBy: 'stage', titleField: 'candidateId', subtitleField: 'jobId', badgeField: 'score', filter: ['stage', 'jobId'] }),
        // Openings: headcount KPIs, an openings gauge, department breakdowns, a
        // department x status pivot, tabs, and a status-pill job grid.
        dashScreen(jobs, { id: 'openings', title: 'Openings', order: 2 }, [
          { kpi: 'Open roles', reduce: 'count', span: 1 },
          { kpi: 'Total openings', measure: 'openings', reduce: 'sum', span: 1 },
          { kpi: 'Avg salary', measure: 'salaryMax', reduce: 'avg', format: 'compact', span: 1 },
          { gauge: 'Total openings', measure: 'openings', reduce: 'sum', min: 0, max: 30, span: 1 },
          { chart: 'department', measure: 'openings', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { pivot: { rows: ['department'], cols: ['status'], measure: 'openings', aggregate: 'sum' }, span: 3 },
          { tabs: [
            { label: 'Openings by dept', tiles: [{ chart: 'department', measure: 'openings', reduce: 'sum', type: 'bar' }] },
            { label: 'Roles by status', tiles: [{ chart: 'status', reduce: 'count', type: 'bar' }] },
          ], span: 3 },
          { grid: true, format: jobFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        detailScreen(jobs, { id: 'job-detail', title: 'Job detail', order: 3 }, {
          titleField: 'title', subtitleField: 'department', statusField: 'status',
          metricFields: ['openings', 'salaryMax'],
          related: [{ entity: 'applications', foreignKey: 'jobId', label: 'Applications', titleField: 'candidateId', subtitleField: 'stage', dateField: 'appliedDate', statusField: 'stage' }],
        }),
        screen(jobs, 'master-detail', { id: 'jobs', title: 'Jobs', order: 4, child: applications, foreignKey: 'jobId', linkScreen: 'job-detail' }),
        formScreen(applications, { id: 'applications', title: 'Applications', order: 5 }, undefined, { format: appFormats, summaries: true, rowActions: [{ kind: 'edit' }] }, ['stage']),
        formScreen(candidates, { id: 'candidates', title: 'Candidates', order: 6 }, undefined, { format: candidateFormats, summaries: true, rowActions: [{ kind: 'edit' }] }, ['source']),
        // Interview schedule: applications placed on a month calendar by their
        // scheduled interview slot (card title resolves to the candidate name).
        calendarScreen(applications, { id: 'interviews', title: 'Interviews', order: 7 }, { dateField: 'interviewAt', titleField: 'candidateId', filter: ['stage', 'jobId'] }),
      ],
    })
  },
}
