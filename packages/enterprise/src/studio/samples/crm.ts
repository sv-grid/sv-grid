import type { EntitySchema } from '../../schema.js'
import type { FormatRule } from '../project.js'
import { screen, formScreen, boardScreen, schedulerScreen, workspaceScreen, detailScreen, project, dashScreen, statusPills, pad, ids, whenIs, type SampleApp } from './shared.js'

// Salesforce Lightning-style chrome: a gradient blue brand rail, white rounded-pill
// nav with a solid-white active state, and a Lightning-blue rule under the toolbar.
const LIGHTNING_CSS = `.sv-app.theme-lightning .sv-app__side { background: linear-gradient(180deg, #032d60, #0176d3); border-right: 0; }
.sv-app.theme-lightning .sv-app__brandtext { color: #fff; font-weight: 800; letter-spacing: -0.01em; }
.sv-app.theme-lightning .sv-app__link { color: #d9edff; font-weight: 600; border-radius: 9999px; padding: 8px 14px; }
.sv-app.theme-lightning .sv-app__link:hover { background: rgba(255, 255, 255, 0.14); color: #fff; }
.sv-app.theme-lightning .sv-app__link.is-active { background: #fff; color: #032d60; }
.sv-app.theme-lightning .sv-app__collapse, .sv-app.theme-lightning .sv-app__foot { color: rgba(255, 255, 255, 0.72); }
.sv-app.theme-lightning .sv-app__toolbar { border-bottom: 2px solid #0176d3; }`

// A fixed sales-rep pool, shared by deals + activities so leaderboards, pivots
// and owner pills stay clean (padded rows cycle these instead of random names).
const OWNERS = [
  { value: 'Sam Rivera', label: 'Sam Rivera', color: '#6366f1' },
  { value: 'Jamie Chen', label: 'Jamie Chen', color: '#10b981' },
  { value: 'Priya Patel', label: 'Priya Patel', color: '#f59e0b' },
  { value: 'Dana Lee', label: 'Dana Lee', color: '#ec4899' },
]

const companies: EntitySchema = {
  name: 'companies',
  label: 'Company',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'industry', type: 'enum', required: true, options: [
      { value: 'saas', label: 'SaaS', color: '#6366f1' },
      { value: 'fintech', label: 'Fintech', color: '#10b981' },
      { value: 'retail', label: 'Retail', color: '#f59e0b' },
      { value: 'health', label: 'Health', color: '#ef4444' },
    ] },
    { field: 'country', type: 'text', label: 'Country', input: { editorType: 'country', help: 'Headquarters country' } },
    { field: 'website', type: 'text', format: 'url', input: { placeholder: 'https://…' } },
    { field: 'employees', type: 'number', label: 'Employees', min: 0 },
    { field: 'health', type: 'number', label: 'Account health', min: 1, max: 5, defaultValue: 3, input: { editorType: 'rating', help: '1-5 relationship score' } },
    { field: 'active', type: 'boolean', label: 'Active', defaultValue: true },
  ],
}

const contacts: EntitySchema = {
  name: 'contacts',
  label: 'Contact',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', format: 'email', required: true },
    { field: 'phone', type: 'text', input: { editorType: 'phone' } },
    { field: 'title', type: 'text', label: 'Job title' },
    { field: 'companyId', type: 'relation', label: 'Company', relation: { entity: 'companies', foreignKey: 'companyId', labelField: 'name' } },
    { field: 'tags', type: 'text', label: 'Segments', input: { editorType: 'chips', help: 'Interests / segments' } },
    { field: 'active', type: 'boolean', defaultValue: true },
  ],
}

const deals: EntitySchema = {
  name: 'deals',
  label: 'Deal',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'title', type: 'text', required: true, minLength: 2 },
    { field: 'companyId', type: 'relation', label: 'Company', relation: { entity: 'companies', foreignKey: 'companyId', labelField: 'name' } },
    { field: 'stage', type: 'enum', required: true, options: [
      { value: 'lead', label: 'Lead', color: '#94a3b8' },
      { value: 'qualified', label: 'Qualified', color: '#6366f1' },
      { value: 'proposal', label: 'Proposal', color: '#f59e0b' },
      { value: 'won', label: 'Won', color: '#10b981' },
      { value: 'lost', label: 'Lost', color: '#ef4444' },
    ] },
    { field: 'value', type: 'number', label: 'Value ($)', min: 0 },
    { field: 'probability', type: 'number', label: 'Probability (%)', min: 0, max: 100, defaultValue: 50, input: { editorType: 'slider', help: 'Win likelihood' } },
    // Derived: expected value weighted by win probability (display-only).
    { field: 'weighted', type: 'number', label: 'Weighted ($)', readonly: true, formula: 'value * probability / 100' },
    { field: 'owner', type: 'enum', label: 'Owner', options: OWNERS },
    { field: 'closeDate', type: 'date', label: 'Close date' },
    // Only asked for once a deal is actually lost, and then it is mandatory - the
    // form never shows a question it does not need an answer to.
    { field: 'lostReason', type: 'enum', label: 'Lost to', hidden: { grid: true }, options: [
      { value: 'price', label: 'Price' },
      { value: 'competitor', label: 'Competitor' },
      { value: 'timing', label: 'Timing' },
      { value: 'no-budget', label: 'No budget' },
      { value: 'other', label: 'Other' },
    ], when: { visible: whenIs('stage', 'lost'), required: whenIs('stage', 'lost') } },
  ],
}

const activities: EntitySchema = {
  name: 'activities',
  label: 'Activity',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'subject', type: 'text', required: true, minLength: 3 },
    { field: 'type', type: 'enum', required: true, options: [
      { value: 'call', label: 'Call', color: '#6366f1' },
      { value: 'email', label: 'Email', color: '#10b981' },
      { value: 'meeting', label: 'Meeting', color: '#f59e0b' },
      { value: 'task', label: 'Task', color: '#8b5cf6' },
    ] },
    { field: 'dealId', type: 'relation', label: 'Deal', relation: { entity: 'deals', foreignKey: 'dealId', labelField: 'title' } },
    { field: 'owner', type: 'enum', label: 'Owner', options: OWNERS },
    { field: 'priority', type: 'enum', defaultValue: 'medium', options: [
      { value: 'low', label: 'Low', color: '#94a3b8' },
      { value: 'medium', label: 'Medium', color: '#6366f1' },
      { value: 'high', label: 'High', color: '#ef4444' },
    ] },
    { field: 'dueDate', type: 'date', label: 'Due date' },
    { field: 'durationMins', type: 'number', label: 'Duration (min)', min: 0 },
    { field: 'completed', type: 'boolean', label: 'Done', defaultValue: false },
    { field: 'notes', type: 'text', label: 'Notes' },
  ],
}

// Deal grid formatting: stage + owner pills, plus numeric thresholds (weak deals
// red, strong deals green + bold, big-ticket values bold) - data-driven color, not
// just status pills.
const dealFormats: FormatRule[] = [
  ...statusPills(deals, 'stage'),
  ...statusPills(deals, 'owner'),
  { field: 'probability', op: 'lt', value: 30, color: '#dc2626' },
  { field: 'probability', op: 'gte', value: 70, color: '#16a34a', bold: true },
  { field: 'value', op: 'gte', value: 100000, bold: true },
]

const seed = {
  companies: [
    { id: 'co1', name: 'Globex', industry: 'saas', country: 'United States', website: 'https://globex.com', employees: 320, health: 4, active: true },
    { id: 'co2', name: 'Initech', industry: 'fintech', country: 'United Kingdom', website: 'https://initech.co', employees: 140, health: 3, active: true },
    { id: 'co3', name: 'Umbrella', industry: 'health', country: 'Germany', website: 'https://umbrella.de', employees: 900, health: 5, active: true },
    { id: 'co4', name: 'Hooli', industry: 'saas', country: 'United States', website: 'https://hooli.com', employees: 2100, health: 2, active: false },
    { id: 'co5', name: 'Soylent', industry: 'retail', country: 'Canada', website: 'https://soylent.ca', employees: 75, health: 3, active: true },
    { id: 'co6', name: 'Stark Industries', industry: 'fintech', country: 'United States', website: 'https://stark.com', employees: 5400, health: 5, active: true },
  ],
  contacts: [
    { id: 'ct1', name: 'Ada Lovelace', email: 'ada@globex.com', phone: '+1 (415) 555-0101', title: 'CTO', companyId: 'co1', tags: ['Champion', 'Technical'], active: true },
    { id: 'ct2', name: 'Alan Turing', email: 'alan@initech.co', phone: '+44 20 7946 0102', title: 'Head of Data', companyId: 'co2', tags: ['Economic buyer'], active: true },
    { id: 'ct3', name: 'Grace Hopper', email: 'grace@umbrella.de', phone: '+49 30 5550103', title: 'VP Engineering', companyId: 'co3', tags: ['Champion'], active: true },
    { id: 'ct4', name: 'Linus Torvalds', email: 'linus@hooli.com', phone: '+1 (650) 555-0104', title: 'Architect', companyId: 'co4', tags: ['Technical', 'Blocker'], active: false },
    { id: 'ct5', name: 'Barbara Liskov', email: 'barbara@soylent.ca', phone: '+1 (416) 555-0105', title: 'Founder', companyId: 'co5', tags: ['Decision maker'], active: true },
    { id: 'ct6', name: 'Katherine Johnson', email: 'kj@stark.com', phone: '+1 (212) 555-0106', title: 'Analyst', companyId: 'co6', tags: ['Influencer'], active: true },
    { id: 'ct7', name: 'Donald Knuth', email: 'don@globex.com', phone: '+1 (415) 555-0107', title: 'Advisor', companyId: 'co1', tags: ['Influencer', 'Technical'], active: true },
    { id: 'ct8', name: 'Margaret Hamilton', email: 'mh@stark.com', phone: '+1 (212) 555-0108', title: 'Director', companyId: 'co6', tags: ['Decision maker'], active: true },
  ],
  deals: [
    { id: 'dl1', title: 'Globex platform rollout', companyId: 'co1', stage: 'proposal', value: 48000, probability: 60, owner: 'Sam Rivera', closeDate: '2026-08-15' },
    { id: 'dl2', title: 'Initech data pipeline', companyId: 'co2', stage: 'won', value: 26000, probability: 100, owner: 'Jamie Chen', closeDate: '2026-06-30' },
    { id: 'dl3', title: 'Umbrella compliance suite', companyId: 'co3', stage: 'qualified', value: 91000, probability: 40, owner: 'Sam Rivera', closeDate: '2026-09-20' },
    { id: 'dl4', title: 'Hooli migration', companyId: 'co4', stage: 'lost', value: 15000, probability: 0, owner: 'Priya Patel', closeDate: '2026-05-10', lostReason: 'competitor' },
    { id: 'dl5', title: 'Soylent storefront', companyId: 'co5', stage: 'lead', value: 8000, probability: 20, owner: 'Jamie Chen', closeDate: '2026-10-01' },
    { id: 'dl6', title: 'Stark analytics', companyId: 'co6', stage: 'proposal', value: 132000, probability: 65, owner: 'Priya Patel', closeDate: '2026-08-28' },
    { id: 'dl7', title: 'Globex add-on seats', companyId: 'co1', stage: 'won', value: 12000, probability: 100, owner: 'Sam Rivera', closeDate: '2026-07-05' },
    { id: 'dl8', title: 'Stark expansion', companyId: 'co6', stage: 'qualified', value: 54000, probability: 45, owner: 'Jamie Chen', closeDate: '2026-09-12' },
  ],
  activities: [
    { id: 'ac1', subject: 'Discovery call with Ada', type: 'call', dealId: 'dl1', owner: 'Sam Rivera', priority: 'high', dueDate: '2026-07-16', durationMins: 30, completed: true, notes: 'Mapped the rollout scope.' },
    { id: 'ac2', subject: 'Send pricing proposal', type: 'email', dealId: 'dl1', owner: 'Sam Rivera', priority: 'high', dueDate: '2026-07-18', durationMins: 15, completed: false, notes: 'Awaiting legal sign-off.' },
    { id: 'ac3', subject: 'Data pipeline demo', type: 'meeting', dealId: 'dl2', owner: 'Jamie Chen', priority: 'medium', dueDate: '2026-07-12', durationMins: 45, completed: true, notes: 'Great fit, moving to close.' },
    { id: 'ac4', subject: 'Compliance review follow-up', type: 'task', dealId: 'dl3', owner: 'Sam Rivera', priority: 'medium', dueDate: '2026-07-20', durationMins: 20, completed: false, notes: 'Collect SOC2 docs.' },
    { id: 'ac5', subject: 'Re-engage Hooli champion', type: 'call', dealId: 'dl4', owner: 'Priya Patel', priority: 'low', dueDate: '2026-07-22', durationMins: 25, completed: false, notes: 'Deal went cold - revisit Q4.' },
    { id: 'ac6', subject: 'Storefront scoping', type: 'meeting', dealId: 'dl5', owner: 'Jamie Chen', priority: 'medium', dueDate: '2026-07-19', durationMins: 60, completed: false, notes: 'Needs design mockups.' },
    { id: 'ac7', subject: 'Analytics exec briefing', type: 'meeting', dealId: 'dl6', owner: 'Priya Patel', priority: 'high', dueDate: '2026-07-24', durationMins: 40, completed: false, notes: 'CFO joining the call.' },
    { id: 'ac8', subject: 'Renewal paperwork', type: 'task', dealId: 'dl7', owner: 'Sam Rivera', priority: 'low', dueDate: '2026-07-14', durationMins: 10, completed: true, notes: 'Signed and filed.' },
    { id: 'ac9', subject: 'Expansion seats quote', type: 'email', dealId: 'dl8', owner: 'Jamie Chen', priority: 'medium', dueDate: '2026-07-21', durationMins: 15, completed: false, notes: 'Quote 40 extra seats.' },
    { id: 'ac10', subject: 'Quarterly business review', type: 'meeting', dealId: 'dl6', owner: 'Priya Patel', priority: 'high', dueDate: '2026-07-28', durationMins: 90, completed: false, notes: 'Prep the QBR deck.' },
  ],
}

export const crm: SampleApp = {
  id: 'crm',
  name: 'CRM',
  description: 'Companies, contacts, deals and activities - a Salesforce Lightning-style CRM behind a sign-in, with sales + forecast + activity dashboards (KPI sparklines, target gauge, value-over-time trend, pivot, tabs), filtered status-pill grids with drill-through and row actions, master/detail, and rich edit forms.',
  emoji: '\u{1F91D}',
  accent: '#0176d3',
  build: () => {
    const companyRows = pad(companies, seed.companies, 12)
    const pool = ids(companyRows)
    const contactRows = pad(contacts, seed.contacts, 22, { companyId: pool })
    const dealRows = pad(deals, seed.deals, 30, { companyId: pool })
    const dealPool = ids(dealRows)
    const activityRows = pad(activities, seed.activities, 24, { dealId: dealPool })
    return project({
      title: 'Acme CRM',
      brand: 'Acme CRM',
      accent: '#0176d3',
      preset: 'salesforce',
      footer: '© Acme Inc.',
      // Salesforce Lightning look: a deep-blue brand rail with white pill nav, and a
      // Lightning-blue accent bar under the app toolbar.
      appClass: 'theme-lightning',
      customCss: LIGHTNING_CSS,
      // A sign-in wall with two sales roles (reps can create + edit, not delete).
      auth: { enabled: true, protect: true },
      access: {
        enabled: true,
        defaultRole: 'rep',
        roles: [
          { role: 'admin', screens: '*', actions: '*' },
          { role: 'rep', screens: '*', actions: ['create', 'update'] },
        ],
      },
      entities: [companies, contacts, deals, activities],
      seed: { companies: companyRows, contacts: contactRows, deals: dealRows, activities: activityRows },
      screens: [
        // Sales dashboard: KPI cards (a pipeline-value card with a sparkline over
        // close dates + a $400k target), a target gauge, a stage funnel, a pie, an
        // owner-leaderboard, a tabbed breakdown, and a status-pill deal grid.
        dashScreen(deals, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Pipeline value', measure: 'value', reduce: 'sum', format: 'currency', trendField: 'closeDate', trendReduce: 'sum', target: 400000, span: 1 },
          { kpi: 'Open deals', reduce: 'count', span: 1 },
          { kpi: 'Avg deal size', measure: 'value', reduce: 'avg', format: 'currency', span: 1 },
          { gauge: 'Pipeline vs $500k target', measure: 'value', reduce: 'sum', min: 0, max: 500000, unit: '$', span: 1 },
          { chart: 'stage', measure: 'value', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'stage', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'owner', measure: 'value', reduce: 'sum', type: 'bar', span: 2 },
          { tabs: [
            { label: 'Value by stage', tiles: [{ chart: 'stage', measure: 'value', reduce: 'sum', type: 'bar' }] },
            { label: 'Deals by owner', tiles: [{ chart: 'owner', reduce: 'count', type: 'bar' }] },
          ], span: 3 },
          { grid: true, format: dealFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Pipeline board: deals as draggable cards in stage columns (drag a card to
        // change its stage). The signature "real app" view.
        boardScreen(deals, { id: 'pipeline', title: 'Pipeline', order: 1 }, { groupBy: 'stage', titleField: 'title', badgeField: 'value', subtitleField: 'owner', filter: ['owner', 'companyId'], openScreen: 'deal-360' }),
        // Deal desk: a docking-manager console (split panes) - filter deals on the
        // left, the pipeline grid centre, and the selected deal's record on the right.
        // Resize the panes; click a row to load it. Showcases screen layout: 'split'.
        workspaceScreen(deals, { id: 'deal-desk', title: 'Deal desk', order: 2 }, { filter: ['stage', 'owner'], mode: 'split' }),
        // Deal 360: a full record page - header (title + company + stage pill), value /
        // probability metric tiles, an Overview of deal + account fields, and an
        // Activities timeline of the tasks logged against the deal.
        detailScreen(deals, { id: 'deal-360', title: 'Deal 360', order: 3 }, {
          titleField: 'title', subtitleField: 'companyId', statusField: 'stage',
          metricFields: ['value', 'probability'],
          sections: [
            { label: 'Deal', fields: ['owner', 'closeDate'] },
            { label: 'Account', fields: ['companyId'] },
          ],
          related: [{ entity: 'activities', foreignKey: 'dealId', label: 'Activities', titleField: 'subject', subtitleField: 'owner', dateField: 'dueDate', statusField: 'priority' }],
        }),
        // Forecast: value KPIs, a value-over-time area trend, and a pivot of value by
        // owner (rows) x stage (columns).
        dashScreen(deals, { id: 'forecast', title: 'Forecast', order: 4 }, [
          { kpi: 'Pipeline value', measure: 'value', reduce: 'sum', format: 'currency', span: 1 },
          { kpi: 'Avg deal size', measure: 'value', reduce: 'avg', format: 'currency', span: 1 },
          { kpi: 'Largest deal', measure: 'value', reduce: 'max', format: 'currency', span: 1 },
          { chart: 'closeDate', measure: 'value', reduce: 'sum', type: 'area', span: 3 },
          { pivot: { rows: ['owner'], cols: ['stage'], measure: 'value', aggregate: 'sum' }, span: 3 },
        ]),
        // Accounts dashboard: headcount KPIs (compact-formatted), an account-health
        // gauge (avg rating 0-5), industry breakdowns, and a company grid that drills
        // into the account's deals.
        dashScreen(companies, { id: 'accounts', title: 'Accounts', order: 5 }, [
          { kpi: 'Companies', reduce: 'count', span: 1 },
          { kpi: 'Total headcount', measure: 'employees', reduce: 'sum', format: 'compact', span: 1 },
          { kpi: 'Avg headcount', measure: 'employees', reduce: 'avg', span: 1 },
          { gauge: 'Avg account health', measure: 'health', reduce: 'avg', min: 0, max: 5, span: 1 },
          { chart: 'industry', measure: 'employees', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'industry', reduce: 'count', type: 'pie', span: 1 },
          { filter: ['industry', 'country', 'active'], span: 3 },
          { grid: true, format: statusPills(companies, 'industry'), summaries: true, rowLink: { screen: 'deals', sourceField: 'id', targetField: 'companyId' }, span: 3 },
        ]),
        // Activity board: task KPIs, a duration gauge, type/owner breakdowns, a filter,
        // and a grid with type + priority pills and inline edit actions.
        dashScreen(activities, { id: 'activities', title: 'Activities', order: 6 }, [
          { kpi: 'Activities', reduce: 'count', span: 1 },
          { kpi: 'Logged minutes', measure: 'durationMins', reduce: 'sum', format: 'compact', span: 1 },
          { kpi: 'Avg duration', measure: 'durationMins', reduce: 'avg', span: 1 },
          { gauge: 'Avg duration (min)', measure: 'durationMins', reduce: 'avg', min: 0, max: 120, unit: 'm', span: 1 },
          { chart: 'type', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'owner', reduce: 'count', type: 'bar', span: 2 },
          { filter: ['type', 'priority', 'owner', 'completed'], span: 3 },
          { grid: true, format: [...statusPills(activities, 'type'), ...statusPills(activities, 'priority'), ...statusPills(activities, 'owner')], summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Activity schedule: the activities grid rendered as a resource scheduler -
        // a column per owner (rep), tasks placed by due date and tinted by type, with
        // drag-to-reschedule + a detail drawer. Showcases the grid's scheduler view.
        schedulerScreen(activities, { id: 'activity-cal', title: 'Schedule', order: 7 }, { startField: 'dueDate', titleField: 'subject', colorField: 'type', resourceField: 'owner', initialView: 'week' }),
        screen(companies, 'master-detail', { id: 'companies', title: 'Companies', order: 8, child: contacts, foreignKey: 'companyId' }),
        formScreen(contacts, { id: 'contacts', title: 'Contacts', order: 9 }, undefined, {}, ['companyId', 'tags', 'active']),
        formScreen(deals, { id: 'deals', title: 'Deals', order: 10 }, undefined, { format: dealFormats, summaries: true, rowActions: [{ kind: 'edit' }], rowLink: { screen: 'deal-360', sourceField: 'id', targetField: 'id' } }, ['stage', 'owner', 'companyId']),
      ],
    })
  },
}
