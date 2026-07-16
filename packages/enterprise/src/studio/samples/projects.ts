import type { EntitySchema } from '../../schema.js'
import { screen, project, dashScreen, type SampleApp } from './shared.js'

const projectsEntity: EntitySchema = {
  name: 'projects',
  label: 'Project',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'status', type: 'enum', options: [
      { value: 'planning', label: 'Planning', color: '#94a3b8' },
      { value: 'active', label: 'Active', color: '#6366f1' },
      { value: 'on_hold', label: 'On hold', color: '#f59e0b' },
      { value: 'done', label: 'Done', color: '#10b981' },
    ] },
    { field: 'owner', type: 'text' },
    { field: 'dueDate', type: 'date', label: 'Due date' },
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
    { field: 'role', type: 'enum', options: [
      { value: 'dev', label: 'Engineer', color: '#6366f1' },
      { value: 'design', label: 'Designer', color: '#ec4899' },
      { value: 'pm', label: 'PM', color: '#f59e0b' },
      { value: 'qa', label: 'QA', color: '#10b981' },
    ] },
  ],
}

const tasks: EntitySchema = {
  name: 'tasks',
  label: 'Task',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'title', type: 'text', required: true },
    { field: 'projectId', type: 'relation', label: 'Project', relation: { entity: 'projects', foreignKey: 'projectId', labelField: 'name' } },
    { field: 'assigneeId', type: 'relation', label: 'Assignee', relation: { entity: 'members', foreignKey: 'assigneeId', labelField: 'name' } },
    { field: 'priority', type: 'enum', options: [
      { value: 'low', label: 'Low', color: '#94a3b8' },
      { value: 'medium', label: 'Medium', color: '#6366f1' },
      { value: 'high', label: 'High', color: '#f59e0b' },
      { value: 'urgent', label: 'Urgent', color: '#ef4444' },
    ] },
    { field: 'status', type: 'enum', options: [
      { value: 'todo', label: 'To do', color: '#94a3b8' },
      { value: 'doing', label: 'In progress', color: '#6366f1' },
      { value: 'review', label: 'In review', color: '#f59e0b' },
      { value: 'done', label: 'Done', color: '#10b981' },
    ] },
    { field: 'estimate', type: 'number', label: 'Estimate (h)' },
    { field: 'dueDate', type: 'date', label: 'Due' },
  ],
}

const seed = {
  projects: [
    { id: 'pr1', name: 'Website redesign', status: 'active', owner: 'Sam Rivera', dueDate: '2026-09-01' },
    { id: 'pr2', name: 'Mobile app v2', status: 'planning', owner: 'Jamie Chen', dueDate: '2026-11-15' },
    { id: 'pr3', name: 'Billing migration', status: 'on_hold', owner: 'Priya Patel', dueDate: '2026-08-20' },
    { id: 'pr4', name: 'Onboarding revamp', status: 'done', owner: 'Sam Rivera', dueDate: '2026-06-10' },
  ],
  members: [
    { id: 'm1', name: 'Ada Lovelace', email: 'ada@team.dev', role: 'dev' },
    { id: 'm2', name: 'Grace Hopper', email: 'grace@team.dev', role: 'dev' },
    { id: 'm3', name: 'Margaret Hamilton', email: 'mh@team.dev', role: 'pm' },
    { id: 'm4', name: 'Radia Perlman', email: 'radia@team.dev', role: 'design' },
    { id: 'm5', name: 'Katherine Johnson', email: 'kj@team.dev', role: 'qa' },
  ],
  tasks: [
    { id: 't1', title: 'Design new homepage', projectId: 'pr1', assigneeId: 'm4', priority: 'high', status: 'doing', estimate: 16, dueDate: '2026-07-20' },
    { id: 't2', title: 'Set up CI pipeline', projectId: 'pr1', assigneeId: 'm1', priority: 'medium', status: 'done', estimate: 8, dueDate: '2026-07-05' },
    { id: 't3', title: 'API rate limiting', projectId: 'pr2', assigneeId: 'm2', priority: 'urgent', status: 'todo', estimate: 12, dueDate: '2026-07-25' },
    { id: 't4', title: 'Migrate invoices', projectId: 'pr3', assigneeId: 'm1', priority: 'high', status: 'review', estimate: 24, dueDate: '2026-08-01' },
    { id: 't5', title: 'QA onboarding flow', projectId: 'pr4', assigneeId: 'm5', priority: 'medium', status: 'done', estimate: 6, dueDate: '2026-06-08' },
    { id: 't6', title: 'Push notifications', projectId: 'pr2', assigneeId: 'm2', priority: 'low', status: 'todo', estimate: 10, dueDate: '2026-08-15' },
    { id: 't7', title: 'Accessibility audit', projectId: 'pr1', assigneeId: 'm5', priority: 'high', status: 'doing', estimate: 14, dueDate: '2026-07-30' },
    { id: 't8', title: 'Pricing page copy', projectId: 'pr1', assigneeId: 'm3', priority: 'low', status: 'review', estimate: 4, dueDate: '2026-07-18' },
  ],
}

export const projectTracker: SampleApp = {
  id: 'projects',
  name: 'Project tracker',
  description: 'Projects, tasks and team members - a task dashboard with per-project breakdowns.',
  emoji: '\u{1F4CB}',
  accent: '#8b5cf6',
  build: () =>
    project({
      title: 'Project Tracker',
      brand: 'Tracker',
      accent: '#8b5cf6',
      footer: '',
      entities: [projectsEntity, members, tasks],
      seed,
      screens: [
        dashScreen(tasks, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Tasks', reduce: 'count' },
          { kpi: 'Total effort (h)', measure: 'estimate', reduce: 'sum' },
          { kpi: 'Avg estimate (h)', measure: 'estimate', reduce: 'avg' },
          { chart: 'status', measure: 'estimate', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Largest task (h)', measure: 'estimate', reduce: 'max', span: 1 },
          { chart: 'priority', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'status', reduce: 'count', type: 'bar', span: 2 },
          { grid: true, span: 3 },
        ]),
        screen(projectsEntity, 'master-detail', { id: 'projects', title: 'Projects', order: 1, child: tasks, foreignKey: 'projectId' }),
        screen(tasks, 'crud', { id: 'tasks', title: 'Tasks', order: 2 }),
        screen(members, 'crud', { id: 'members', title: 'Members', order: 3 }),
      ],
    }),
}
