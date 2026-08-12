import type { EntitySchema } from '../../schema.js'
import type { FormatRule } from '../project.js'
import { screen, formScreen, boardScreen, schedulerScreen, detailScreen, project, dashScreen, statusPills, pad, ids, type SampleApp } from './shared.js'

// Jira-style chrome: a dark navy issue-tracker sidebar with muted labels and a
// blue active row (accent bar + tinted fill), the board front and centre.
const JIRA_CSS = `.sv-app.theme-jira .sv-app__side { background: #1d2125; border-right: 1px solid #2c333a; }
.sv-app.theme-jira .sv-app__brandtext { color: #fff; font-weight: 700; }
.sv-app.theme-jira .sv-app__link { color: #c7d1db; border-radius: 4px; padding: 7px 12px; }
.sv-app.theme-jira .sv-app__link:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
.sv-app.theme-jira .sv-app__link.is-active { background: color-mix(in srgb, #0c66e4 30%, #1d2125); color: #fff; box-shadow: inset 3px 0 0 #4c9aff; }
.sv-app.theme-jira .sv-app__collapse, .sv-app.theme-jira .sv-app__foot { color: #8c9bab; }`

const projectsEntity: EntitySchema = {
  name: 'projects',
  label: 'Project',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'status', type: 'enum', required: true, defaultValue: 'planning', options: [
      { value: 'planning', label: 'Planning', color: '#94a3b8' },
      { value: 'active', label: 'Active', color: '#6366f1' },
      { value: 'on_hold', label: 'On hold', color: '#f59e0b' },
      { value: 'done', label: 'Done', color: '#10b981' },
    ] },
    { field: 'owner', type: 'text', label: 'Owner' },
    { field: 'budget', type: 'number', label: 'Budget ($)', min: 0, input: { prefix: '$', help: 'Approved budget' } },
    { field: 'progress', type: 'number', label: 'Progress (%)', min: 0, max: 100, defaultValue: 0, input: { editorType: 'slider', help: 'Overall completion' } },
    { field: 'color', type: 'text', label: 'Label color', defaultValue: '#6366f1', input: { editorType: 'color', help: 'Board / calendar color' } },
    { field: 'tags', type: 'text', label: 'Tags', input: { editorType: 'chips', help: 'Themes / labels' } },
    { field: 'dueDate', type: 'date', label: 'Due date', required: true },
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
    { field: 'phone', type: 'text', label: 'Phone', input: { editorType: 'phone', help: 'Direct line' } },
    { field: 'role', type: 'enum', required: true, defaultValue: 'dev', options: [
      { value: 'dev', label: 'Engineer', color: '#6366f1' },
      { value: 'design', label: 'Designer', color: '#ec4899' },
      { value: 'pm', label: 'PM', color: '#f59e0b' },
      { value: 'qa', label: 'QA', color: '#10b981' },
    ] },
    { field: 'skills', type: 'text', label: 'Skills', input: { editorType: 'chips', help: 'Tech / expertise' } },
    { field: 'rating', type: 'number', label: 'Performance', min: 1, max: 5, defaultValue: 3, input: { editorType: 'rating', help: '1-5 review score' } },
  ],
}

const tasks: EntitySchema = {
  name: 'tasks',
  label: 'Task',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'title', type: 'text', required: true, minLength: 2 },
    { field: 'projectId', type: 'relation', label: 'Project', relation: { entity: 'projects', foreignKey: 'projectId', labelField: 'name' } },
    { field: 'assigneeId', type: 'relation', label: 'Assignee', relation: { entity: 'members', foreignKey: 'assigneeId', labelField: 'name' } },
    { field: 'priority', type: 'enum', required: true, defaultValue: 'medium', options: [
      { value: 'low', label: 'Low', color: '#94a3b8' },
      { value: 'medium', label: 'Medium', color: '#6366f1' },
      { value: 'high', label: 'High', color: '#f59e0b' },
      { value: 'urgent', label: 'Urgent', color: '#ef4444' },
    ] },
    { field: 'status', type: 'enum', required: true, defaultValue: 'todo', options: [
      { value: 'todo', label: 'To do', color: '#94a3b8' },
      { value: 'doing', label: 'In progress', color: '#6366f1' },
      { value: 'review', label: 'In review', color: '#f59e0b' },
      { value: 'done', label: 'Done', color: '#10b981' },
    ] },
    { field: 'estimate', type: 'number', label: 'Estimate (h)', min: 0, defaultValue: 0, input: { suffix: 'h', help: 'Estimated hours' } },
    { field: 'spent', type: 'number', label: 'Spent (h)', min: 0, defaultValue: 0, input: { suffix: 'h', help: 'Hours logged so far' } },
    // Derived: hours left on the task (display-only, never stored).
    { field: 'remaining', type: 'number', label: 'Remaining (h)', readonly: true, formula: 'estimate - spent' },
    { field: 'progress', type: 'number', label: 'Progress (%)', min: 0, max: 100, defaultValue: 0, input: { editorType: 'slider', help: 'Task completion' } },
    { field: 'startedAt', type: 'datetime', label: 'Started', input: { editorType: 'datetime', help: 'When work began' } },
    { field: 'dueDate', type: 'date', label: 'Due' },
  ],
}

// Task grid formatting: status + priority pills, plus numeric thresholds -
// over-budget tasks (spent past estimate) red + bold, nearly-done tasks green,
// barely-started tasks red - data-driven color, not just status pills.
const taskFormats: FormatRule[] = [
  ...statusPills(tasks, 'status'),
  ...statusPills(tasks, 'priority'),
  { field: 'spent', op: 'gt', value: 16, color: '#dc2626', bold: true },
  { field: 'progress', op: 'gte', value: 80, color: '#16a34a', bold: true },
  { field: 'progress', op: 'lt', value: 25, color: '#dc2626' },
]

const seed = {
  projects: [
    { id: 'pr1', name: 'Website redesign', status: 'active', owner: 'Sam Rivera', budget: 48000, progress: 65, color: '#6366f1', tags: ['Marketing', 'Design'], dueDate: '2026-09-01' },
    { id: 'pr2', name: 'Mobile app v2', status: 'planning', owner: 'Jamie Chen', budget: 120000, progress: 15, color: '#10b981', tags: ['Mobile', 'Growth'], dueDate: '2026-11-15' },
    { id: 'pr3', name: 'Billing migration', status: 'on_hold', owner: 'Priya Patel', budget: 32000, progress: 40, color: '#f59e0b', tags: ['Infra', 'Finance'], dueDate: '2026-08-20' },
    { id: 'pr4', name: 'Onboarding revamp', status: 'done', owner: 'Sam Rivera', budget: 18000, progress: 100, color: '#ef4444', tags: ['Product'], dueDate: '2026-06-10' },
  ],
  members: [
    { id: 'm1', name: 'Ada Lovelace', email: 'ada@team.dev', phone: '+1 (415) 555-0101', role: 'dev', skills: ['TypeScript', 'Svelte'], rating: 5 },
    { id: 'm2', name: 'Grace Hopper', email: 'grace@team.dev', phone: '+1 (415) 555-0102', role: 'dev', skills: ['Go', 'SQL', 'Docker'], rating: 4 },
    { id: 'm3', name: 'Margaret Hamilton', email: 'mh@team.dev', phone: '+1 (415) 555-0103', role: 'pm', skills: ['Product', 'Leadership'], rating: 5 },
    { id: 'm4', name: 'Radia Perlman', email: 'radia@team.dev', phone: '+1 (415) 555-0104', role: 'design', skills: ['Figma', 'UX'], rating: 4 },
    { id: 'm5', name: 'Katherine Johnson', email: 'kj@team.dev', phone: '+1 (415) 555-0105', role: 'qa', skills: ['Python', 'GraphQL'], rating: 3 },
  ],
  tasks: [
    { id: 't1', title: 'Design new homepage', projectId: 'pr1', assigneeId: 'm4', priority: 'high', status: 'doing', estimate: 16, spent: 6, progress: 40, startedAt: '2026-07-02T09:15:00Z', dueDate: '2026-07-20' },
    { id: 't2', title: 'Set up CI pipeline', projectId: 'pr1', assigneeId: 'm1', priority: 'medium', status: 'done', estimate: 8, spent: 8, progress: 100, startedAt: '2026-06-24T10:00:00Z', dueDate: '2026-07-05' },
    { id: 't3', title: 'API rate limiting', projectId: 'pr2', assigneeId: 'm2', priority: 'urgent', status: 'todo', estimate: 12, spent: 0, progress: 0, startedAt: '2026-07-18T08:30:00Z', dueDate: '2026-07-25' },
    { id: 't4', title: 'Migrate invoices', projectId: 'pr3', assigneeId: 'm1', priority: 'high', status: 'review', estimate: 24, spent: 18, progress: 80, startedAt: '2026-07-06T13:45:00Z', dueDate: '2026-08-01' },
    { id: 't5', title: 'QA onboarding flow', projectId: 'pr4', assigneeId: 'm5', priority: 'medium', status: 'done', estimate: 6, spent: 6, progress: 100, startedAt: '2026-06-02T11:20:00Z', dueDate: '2026-06-08' },
    { id: 't6', title: 'Push notifications', projectId: 'pr2', assigneeId: 'm2', priority: 'low', status: 'todo', estimate: 10, spent: 0, progress: 0, startedAt: '2026-07-15T09:00:00Z', dueDate: '2026-08-15' },
    { id: 't7', title: 'Accessibility audit', projectId: 'pr1', assigneeId: 'm5', priority: 'high', status: 'doing', estimate: 14, spent: 5, progress: 35, startedAt: '2026-07-10T14:00:00Z', dueDate: '2026-07-30' },
    { id: 't8', title: 'Pricing page copy', projectId: 'pr1', assigneeId: 'm3', priority: 'low', status: 'review', estimate: 4, spent: 3, progress: 75, startedAt: '2026-07-11T15:30:00Z', dueDate: '2026-07-18' },
  ],
}

export const projectTracker: SampleApp = {
  id: 'projects',
  name: 'Project tracker',
  description: 'Projects, tasks and a team roster - a Jira-style issue tracker behind a sign-in, with portfolio + task-board dashboards (budget KPI sparkline + target, progress gauge, status/priority breakdowns with pie + area trend, status x priority pivot, tabbed views), filtered status-pill grids with row actions, master/detail, and rich edit forms (progress slider, color labels, tag chips, phone, rating, datetime).',
  emoji: '\u{1F4CB}',
  accent: '#0c66e4',
  build: () => {
    const projectRows = pad(projectsEntity, seed.projects, 10)
    const projectPool = ids(projectRows)
    const memberRows = pad(members, seed.members, 12)
    const memberPool = ids(memberRows)
    const taskRows = pad(tasks, seed.tasks, 60, { projectId: projectPool, assigneeId: memberPool })
    return project({
      title: 'Project Tracker',
      brand: 'Tracker',
      accent: '#0c66e4',
      preset: 'linear',
      footer: '',
      // Jira-style issue tracker: dark navy rail, board-forward.
      appClass: 'theme-jira',
      customCss: JIRA_CSS,
      // Sign-in with two roles: developers move issues but cannot delete them.
      auth: { enabled: true, protect: true },
      access: {
        enabled: true,
        defaultRole: 'developer',
        roles: [
          { role: 'admin', screens: '*', actions: '*' },
          { role: 'developer', screens: '*', actions: ['create', 'update'] },
        ],
      },
      entities: [projectsEntity, members, tasks],
      seed: { projects: projectRows, members: memberRows, tasks: taskRows },
      screens: [
        // Portfolio dashboard: budget KPIs (a total-budget card with a sparkline over
        // due dates + a $400k target), an average-progress gauge (0-100), status
        // breakdowns (bar + pie), a budget-by-owner x status pivot, a tabbed view, and
        // a status-pill project grid with inline edit actions.
        dashScreen(projectsEntity, { id: 'portfolio', title: 'Portfolio', order: 0 }, [
          { kpi: 'Total budget', measure: 'budget', reduce: 'sum', format: 'currency', trendField: 'dueDate', trendReduce: 'sum', target: 400000, span: 1 },
          { kpi: 'Projects', reduce: 'count', span: 1 },
          { kpi: 'Largest budget', measure: 'budget', reduce: 'max', format: 'currency', span: 1 },
          { gauge: 'Avg progress', measure: 'progress', reduce: 'avg', min: 0, max: 100, unit: '%', span: 1 },
          { chart: 'status', measure: 'budget', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { pivot: { rows: ['owner'], cols: ['status'], measure: 'budget', aggregate: 'sum' }, span: 3 },
          { tabs: [
            { label: 'Budget by status', tiles: [{ chart: 'status', measure: 'budget', reduce: 'sum', type: 'bar' }] },
            { label: 'Projects by status', tiles: [{ chart: 'status', reduce: 'count', type: 'pie' }] },
          ], span: 3 },
          { grid: true, format: [...statusPills(projectsEntity, 'status'), { field: 'progress', op: 'gte', value: 100, color: '#16a34a', bold: true }], summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Task board: task KPIs (an estimate card trending over due dates), a completion
        // gauge, status + priority breakdowns (bar + pie), a spent-over-time area trend,
        // an estimate pivot by status (rows) x priority (columns), a tabbed view, a
        // filter, and a task grid with status + priority pills and inline edit actions.
        // Kanban board: tasks as cards in status columns (drag to change status).
        boardScreen(tasks, { id: 'board', title: 'Kanban', order: 1 }, { groupBy: 'status', titleField: 'title', badgeField: 'estimate', subtitleField: 'priority', filter: ['priority', 'assigneeId'] }),
        // Project detail: header (status pill) + budget / progress tiles with a
        // timeline of the project's tasks (by due date, colored by status).
        detailScreen(projectsEntity, { id: 'project-detail', title: 'Project detail', order: 2 }, {
          titleField: 'name', subtitleField: 'owner', statusField: 'status', metricFields: ['budget', 'progress'],
          related: [{ entity: 'tasks', foreignKey: 'projectId', label: 'Tasks', titleField: 'title', subtitleField: 'priority', dateField: 'dueDate', statusField: 'status' }],
        }),
        dashScreen(tasks, { id: 'tasks-board', title: 'Task board', order: 3 }, [
          { kpi: 'Tasks', reduce: 'count', span: 1 },
          { kpi: 'Logged hours', measure: 'spent', reduce: 'sum', format: 'compact', span: 1 },
          { kpi: 'Estimated hours', measure: 'estimate', reduce: 'sum', format: 'compact', trendField: 'dueDate', trendReduce: 'sum', span: 1 },
          { gauge: 'Avg completion', measure: 'progress', reduce: 'avg', min: 0, max: 100, unit: '%', span: 1 },
          { chart: 'status', reduce: 'count', type: 'bar', span: 2 },
          { chart: 'priority', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'dueDate', measure: 'spent', reduce: 'sum', type: 'area', span: 3 },
          { pivot: { rows: ['status'], cols: ['priority'], measure: 'estimate', aggregate: 'sum' }, span: 3 },
          { tabs: [
            { label: 'Hours by status', tiles: [{ chart: 'status', measure: 'spent', reduce: 'sum', type: 'bar' }] },
            { label: 'Tasks by priority', tiles: [{ chart: 'priority', reduce: 'count', type: 'bar' }] },
          ], span: 3 },
          { filter: ['status', 'priority', 'assigneeId'], span: 3 },
          { grid: true, format: taskFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        screen(projectsEntity, 'master-detail', { id: 'projects', title: 'Projects', order: 4, child: tasks, foreignKey: 'projectId', linkScreen: 'project-detail' }),
        formScreen(tasks, { id: 'tasks', title: 'Tasks', order: 5 }, undefined, { format: taskFormats, summaries: true, rowActions: [{ kind: 'edit' }] }, ['status', 'priority', 'assigneeId']),
        formScreen(members, { id: 'members', title: 'Members', order: 6 }, undefined, { format: statusPills(members, 'role'), summaries: true }, ['role']),
        // Schedule: tasks placed on a month calendar by due date.
        schedulerScreen(tasks, { id: 'calendar', title: 'Schedule', order: 7 }, { startField: 'startedAt', endField: 'dueDate', titleField: 'title', colorField: 'priority', resourceField: 'assigneeId', initialView: 'timelineWeek' }),
      ],
    })
  },
}
