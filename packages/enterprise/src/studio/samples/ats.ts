import type { EntitySchema } from '../../schema.js'
import { screen, project, dashScreen, type SampleApp } from './shared.js'

const jobs: EntitySchema = {
  name: 'jobs',
  label: 'Job',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'title', type: 'text', required: true },
    { field: 'department', type: 'enum', options: [
      { value: 'engineering', label: 'Engineering', color: '#6366f1' },
      { value: 'design', label: 'Design', color: '#ec4899' },
      { value: 'sales', label: 'Sales', color: '#f59e0b' },
      { value: 'ops', label: 'Ops', color: '#0ea5e9' },
    ] },
    { field: 'status', type: 'enum', options: [
      { value: 'open', label: 'Open', color: '#10b981' },
      { value: 'on_hold', label: 'On hold', color: '#f59e0b' },
      { value: 'closed', label: 'Closed', color: '#94a3b8' },
    ] },
    { field: 'openings', type: 'number', label: 'Openings' },
  ],
}

const candidates: EntitySchema = {
  name: 'candidates',
  label: 'Candidate',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'email', type: 'text', format: 'email' },
    { field: 'source', type: 'enum', options: [
      { value: 'referral', label: 'Referral', color: '#10b981' },
      { value: 'linkedin', label: 'LinkedIn', color: '#0ea5e9' },
      { value: 'website', label: 'Website', color: '#6366f1' },
      { value: 'agency', label: 'Agency', color: '#f59e0b' },
    ] },
  ],
}

const applications: EntitySchema = {
  name: 'applications',
  label: 'Application',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'candidateId', type: 'relation', label: 'Candidate', relation: { entity: 'candidates', foreignKey: 'candidateId', labelField: 'name' } },
    { field: 'jobId', type: 'relation', label: 'Job', relation: { entity: 'jobs', foreignKey: 'jobId', labelField: 'name' } },
    { field: 'stage', type: 'enum', options: [
      { value: 'applied', label: 'Applied', color: '#94a3b8' },
      { value: 'screen', label: 'Screen', color: '#0ea5e9' },
      { value: 'interview', label: 'Interview', color: '#6366f1' },
      { value: 'offer', label: 'Offer', color: '#f59e0b' },
      { value: 'hired', label: 'Hired', color: '#10b981' },
      { value: 'rejected', label: 'Rejected', color: '#ef4444' },
    ] },
    { field: 'score', type: 'number', label: 'Score' },
  ],
}

const seed = {
  jobs: [
    { id: 'jb1', title: 'Senior Frontend Engineer', department: 'engineering', status: 'open', openings: 2 },
    { id: 'jb2', title: 'Product Designer', department: 'design', status: 'open', openings: 1 },
    { id: 'jb3', title: 'Account Executive', department: 'sales', status: 'on_hold', openings: 3 },
    { id: 'jb4', title: 'DevOps Engineer', department: 'engineering', status: 'open', openings: 1 },
    { id: 'jb5', title: 'Operations Manager', department: 'ops', status: 'closed', openings: 1 },
    { id: 'jb6', title: 'UX Researcher', department: 'design', status: 'open', openings: 1 },
  ],
  candidates: [
    { id: 'cd1', name: 'Maya Fernandez', email: 'maya.fernandez@example.com', source: 'referral' },
    { id: 'cd2', name: 'Liam Chen', email: 'liam.chen@example.com', source: 'linkedin' },
    { id: 'cd3', name: 'Priya Nair', email: 'priya.nair@example.com', source: 'website' },
    { id: 'cd4', name: 'Noah Williams', email: 'noah.williams@example.com', source: 'agency' },
    { id: 'cd5', name: 'Sofia Rossi', email: 'sofia.rossi@example.com', source: 'linkedin' },
    { id: 'cd6', name: 'Ethan Brooks', email: 'ethan.brooks@example.com', source: 'referral' },
    { id: 'cd7', name: 'Amara Okafor', email: 'amara.okafor@example.com', source: 'website' },
  ],
  applications: [
    { id: 'ap1', candidateId: 'cd1', jobId: 'jb1', stage: 'interview', score: 82 },
    { id: 'ap2', candidateId: 'cd2', jobId: 'jb1', stage: 'offer', score: 91 },
    { id: 'ap3', candidateId: 'cd3', jobId: 'jb2', stage: 'screen', score: 74 },
    { id: 'ap4', candidateId: 'cd4', jobId: 'jb3', stage: 'applied', score: 60 },
    { id: 'ap5', candidateId: 'cd5', jobId: 'jb4', stage: 'hired', score: 95 },
    { id: 'ap6', candidateId: 'cd6', jobId: 'jb1', stage: 'rejected', score: 48 },
    { id: 'ap7', candidateId: 'cd7', jobId: 'jb6', stage: 'interview', score: 79 },
    { id: 'ap8', candidateId: 'cd3', jobId: 'jb4', stage: 'screen', score: 68 },
  ],
}

export const ats: SampleApp = {
  id: 'ats',
  name: 'Recruiting',
  description: 'Jobs, candidates and applications - hiring pipeline dashboards.',
  emoji: '📝',
  accent: '#7c3aed',
  build: () =>
    project({
      title: 'HireDesk',
      brand: 'HireDesk',
      accent: '#7c3aed',
      footer: '',
      entities: [jobs, candidates, applications],
      seed,
      screens: [
        dashScreen(applications, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Applications', reduce: 'count' },
          { kpi: 'Total score', measure: 'score', reduce: 'sum' },
          { kpi: 'Avg score', measure: 'score', reduce: 'avg' },
          { chart: 'stage', measure: 'score', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Top score', measure: 'score', reduce: 'max', span: 1 },
          { chart: 'stage', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, span: 3 },
        ]),
        screen(jobs, 'master-detail', { id: 'jobs', title: 'Jobs', order: 1, child: applications, foreignKey: 'jobId' }),
        screen(applications, 'crud', { id: 'applications', title: 'Applications', order: 2 }),
        screen(candidates, 'crud', { id: 'candidates', title: 'Candidates', order: 3 }),
      ],
    }),
}
