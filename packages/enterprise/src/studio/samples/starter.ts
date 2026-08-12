/**
 * The project a fresh `svgrid-studio designer` session opens with: not a bare stub,
 * but a complete, enterprise-ready multi-page CRM that shows off the grid's range on
 * first paint - a KPI/chart **Overview**, the rich **Customers** CRUD grid (status
 * pills, health bars, export, popup form), a drag-and-drop **Pipeline** board, a
 * **Deals** grid, a **Calendar** of close dates, and a **Forecast** analytics page.
 * Every generated Studio app already wires `@svgrid/enterprise` (data layer, columns,
 * validation); the rich grids + export make that enterprise surface visible.
 */
import { project, dashScreen, boardScreen, calendarScreen } from './shared.js'
import { gridColumns, defaultBlockConfig, buildDockLayout, type StudioProject, type Screen, type Block, type GridConfig, type GridColumnConfig } from '../project.js'
import type { EntitySchema } from '../../schema.js'

/** A realistic B2B customer/account: company + contact, region, industry, plan,
 *  seats, MRR, a health score, and lifecycle dates. */
const customers: EntitySchema = {
  name: 'customers',
  label: 'Customer',
  idField: 'id',
  fields: [
    { field: 'id', label: 'ID', type: 'number', primaryKey: true, readonly: true },
    { field: 'company', label: 'Company', type: 'text', required: true },
    { field: 'contact', label: 'Contact', type: 'text', required: true },
    { field: 'email', label: 'Email', type: 'text', format: 'email' },
    { field: 'country', label: 'Country', type: 'text' },
    { field: 'industry', label: 'Industry', type: 'enum', input: { editorType: 'list' }, options: [
      { value: 'saas', label: 'SaaS', color: '#6366f1' },
      { value: 'fintech', label: 'Fintech', color: '#0ea5e9' },
      { value: 'healthcare', label: 'Healthcare', color: '#10b981' },
      { value: 'retail', label: 'Retail', color: '#f59e0b' },
      { value: 'manufacturing', label: 'Manufacturing', color: '#64748b' },
      { value: 'media', label: 'Media', color: '#ec4899' },
      { value: 'education', label: 'Education', color: '#14b8a6' },
      { value: 'logistics', label: 'Logistics', color: '#a855f7' },
    ] },
    { field: 'status', label: 'Status', type: 'enum', required: true, input: { editorType: 'list' }, options: [
      { value: 'active', label: 'Active', color: '#10b981' },
      { value: 'trial', label: 'Trial', color: '#f59e0b' },
      { value: 'paused', label: 'Paused', color: '#64748b' },
      { value: 'churned', label: 'Churned', color: '#ef4444' },
    ] },
    { field: 'plan', label: 'Plan', type: 'enum', input: { editorType: 'list' }, options: [
      { value: 'starter', label: 'Starter', color: '#94a3b8' },
      { value: 'growth', label: 'Growth', color: '#6366f1' },
      { value: 'scale', label: 'Scale', color: '#0ea5e9' },
      { value: 'enterprise', label: 'Enterprise', color: '#8b5cf6' },
    ] },
    { field: 'seats', label: 'Seats', type: 'number' },
    { field: 'mrr', label: 'MRR', type: 'number' },
    { field: 'health', label: 'Health', type: 'number', min: 0, max: 100 },
    { field: 'signupDate', label: 'Signed up', type: 'date' },
    { field: 'lastContact', label: 'Last contact', type: 'date' },
  ],
}

/** Sales opportunities against accounts - the Pipeline board / Calendar / Forecast. */
const deals: EntitySchema = {
  name: 'deals',
  label: 'Deal',
  idField: 'id',
  fields: [
    { field: 'id', label: 'ID', type: 'number', primaryKey: true, readonly: true },
    { field: 'name', label: 'Deal', type: 'text', required: true },
    { field: 'customerId', label: 'Account', type: 'relation', relation: { entity: 'customers', labelField: 'company' } },
    { field: 'stage', label: 'Stage', type: 'enum', required: true, input: { editorType: 'list' }, options: [
      { value: 'lead', label: 'Lead', color: '#94a3b8' },
      { value: 'qualified', label: 'Qualified', color: '#38bdf8' },
      { value: 'proposal', label: 'Proposal', color: '#6366f1' },
      { value: 'negotiation', label: 'Negotiation', color: '#f59e0b' },
      { value: 'won', label: 'Won', color: '#10b981' },
      { value: 'lost', label: 'Lost', color: '#ef4444' },
    ] },
    { field: 'owner', label: 'Owner', type: 'enum', input: { editorType: 'list' }, options: [
      { value: 'Sarah Chen', label: 'Sarah Chen', color: '#6366f1' },
      { value: 'Marcus Lee', label: 'Marcus Lee', color: '#10b981' },
      { value: 'Elena Vidal', label: 'Elena Vidal', color: '#f59e0b' },
      { value: 'Tom Baker', label: 'Tom Baker', color: '#ec4899' },
    ] },
    { field: 'amount', label: 'Amount', type: 'number' },
    { field: 'probability', label: 'Probability', type: 'number', min: 0, max: 100 },
    { field: 'closeDate', label: 'Close date', type: 'date' },
  ],
}

/** ~20 seeded accounts with a realistic spread of industries, regions, plans and
 *  lifecycle states (active/paused carry MRR; trials + churned sit at 0). */
const customerSeed: Record<string, unknown>[] = [
  { id: 1, company: 'Meridian Software', contact: 'Sarah Chen', email: 'sarah.chen@meridiansoft.com', country: 'United States', industry: 'saas', status: 'active', plan: 'scale', seats: 42, mrr: 1490, health: 88, signupDate: '2024-03-12', lastContact: '2026-07-28' },
  { id: 2, company: 'Cedar Analytics', contact: 'Michael Rodriguez', email: 'm.rodriguez@cedaranalytics.io', country: 'United States', industry: 'fintech', status: 'active', plan: 'enterprise', seats: 180, mrr: 4200, health: 94, signupDate: '2023-11-05', lastContact: '2026-08-04' },
  { id: 3, company: 'BlueSky Labs', contact: 'Emma Thompson', email: 'emma@blueskylabs.co.uk', country: 'United Kingdom', industry: 'saas', status: 'trial', plan: 'starter', seats: 3, mrr: 0, health: 65, signupDate: '2026-06-20', lastContact: '2026-08-06' },
  { id: 4, company: 'Northgate Systems', contact: 'David Kim', email: 'dkim@northgate.com', country: 'Canada', industry: 'manufacturing', status: 'active', plan: 'growth', seats: 15, mrr: 499, health: 79, signupDate: '2025-01-18', lastContact: '2026-07-15' },
  { id: 5, company: 'Vantage Digital', contact: 'Olivia Martins', email: 'olivia.martins@vantage.digital', country: 'Australia', industry: 'media', status: 'active', plan: 'growth', seats: 12, mrr: 399, health: 82, signupDate: '2024-09-30', lastContact: '2026-07-22' },
  { id: 6, company: 'Harbor Health', contact: "James O'Brien", email: 'j.obrien@harborhealth.org', country: 'United States', industry: 'healthcare', status: 'active', plan: 'enterprise', seats: 240, mrr: 5400, health: 91, signupDate: '2023-06-14', lastContact: '2026-08-01' },
  { id: 7, company: 'Riverstone Media', contact: 'Priya Sharma', email: 'priya@riverstone.media', country: 'India', industry: 'media', status: 'churned', plan: 'scale', seats: 0, mrr: 0, health: 22, signupDate: '2024-02-08', lastContact: '2026-03-19' },
  { id: 8, company: 'Lumen Retail', contact: 'Lucas Müller', email: 'lucas.mueller@lumenretail.de', country: 'Germany', industry: 'retail', status: 'active', plan: 'scale', seats: 55, mrr: 1890, health: 85, signupDate: '2024-12-02', lastContact: '2026-07-30' },
  { id: 9, company: 'Pinewood Financial', contact: 'Aisha Bello', email: 'aisha.bello@pinewoodfin.com', country: 'United States', industry: 'fintech', status: 'paused', plan: 'growth', seats: 8, mrr: 0, health: 48, signupDate: '2025-04-27', lastContact: '2026-05-11' },
  { id: 10, company: 'Orchard Foods', contact: 'Carlos Mendez', email: 'carlos@orchardfoods.mx', country: 'Brazil', industry: 'retail', status: 'active', plan: 'starter', seats: 4, mrr: 99, health: 73, signupDate: '2025-08-09', lastContact: '2026-07-19' },
  { id: 11, company: 'Ironclad Security', contact: 'Nina Petrova', email: 'nina.petrova@ironcladsec.com', country: 'Netherlands', industry: 'saas', status: 'active', plan: 'enterprise', seats: 130, mrr: 3600, health: 96, signupDate: '2023-09-21', lastContact: '2026-08-05' },
  { id: 12, company: 'Brightpath Education', contact: 'Tomás Silva', email: 'tomas.silva@brightpath.edu', country: 'Portugal', industry: 'education', status: 'trial', plan: 'starter', seats: 2, mrr: 0, health: 61, signupDate: '2026-07-01', lastContact: '2026-08-07' },
  { id: 13, company: 'Quantum Ledger', contact: 'Grace Okafor', email: 'grace@quantumledger.io', country: 'United Kingdom', industry: 'fintech', status: 'active', plan: 'scale', seats: 38, mrr: 1290, health: 87, signupDate: '2024-05-16', lastContact: '2026-07-26' },
  { id: 14, company: 'Evergreen Energy', contact: 'Hiroshi Tanaka', email: 'h.tanaka@evergreen-energy.jp', country: 'Japan', industry: 'manufacturing', status: 'active', plan: 'growth', seats: 20, mrr: 549, health: 80, signupDate: '2025-02-11', lastContact: '2026-06-28' },
  { id: 15, company: 'Summit Logistics', contact: 'Fatima Al-Farsi', email: 'fatima@summitlogistics.com', country: 'United States', industry: 'logistics', status: 'active', plan: 'scale', seats: 47, mrr: 1590, health: 89, signupDate: '2024-07-03', lastContact: '2026-08-02' },
  { id: 16, company: 'Fabrikam Retail', contact: 'Erik Larsson', email: 'erik.larsson@fabrikam.se', country: 'Sweden', industry: 'retail', status: 'churned', plan: 'starter', seats: 0, mrr: 0, health: 18, signupDate: '2025-03-22', lastContact: '2026-01-30' },
  { id: 17, company: 'Beacon Analytics', contact: 'Sofia Rossi', email: 'sofia.rossi@beaconanalytics.com', country: 'Italy', industry: 'saas', status: 'active', plan: 'growth', seats: 11, mrr: 449, health: 76, signupDate: '2025-05-19', lastContact: '2026-07-24' },
  { id: 18, company: 'Cobalt Cloud', contact: 'Daniel Okoye', email: 'daniel@cobaltcloud.com', country: 'United States', industry: 'saas', status: 'trial', plan: 'growth', seats: 6, mrr: 0, health: 68, signupDate: '2026-06-28', lastContact: '2026-08-08' },
  { id: 19, company: 'Willow Health', contact: 'Mei Lin', email: 'mei.lin@willowhealth.sg', country: 'Singapore', industry: 'healthcare', status: 'active', plan: 'enterprise', seats: 95, mrr: 2800, health: 92, signupDate: '2023-12-08', lastContact: '2026-07-31' },
  { id: 20, company: 'Atlas Manufacturing', contact: 'Pierre Dubois', email: 'p.dubois@atlasmfg.fr', country: 'France', industry: 'manufacturing', status: 'paused', plan: 'scale', seats: 30, mrr: 0, health: 44, signupDate: '2024-10-15', lastContact: '2026-04-22' },
]

/** ~24 open + closed opportunities across the accounts, spread over stages, owners
 *  and close dates - so the board, calendar, and forecast are all alive. */
const dealSeed: Record<string, unknown>[] = [
  { id: 1, name: 'Enterprise rollout', customerId: 2, stage: 'negotiation', owner: 'Sarah Chen', amount: 84000, probability: 70, closeDate: '2026-09-15' },
  { id: 2, name: 'Platform upgrade', customerId: 6, stage: 'proposal', owner: 'Marcus Lee', amount: 62000, probability: 55, closeDate: '2026-10-02' },
  { id: 3, name: 'Seat expansion', customerId: 1, stage: 'won', owner: 'Elena Vidal', amount: 24000, probability: 100, closeDate: '2026-07-20' },
  { id: 4, name: 'Pilot program', customerId: 3, stage: 'qualified', owner: 'Tom Baker', amount: 12000, probability: 35, closeDate: '2026-11-10' },
  { id: 5, name: 'Annual renewal', customerId: 11, stage: 'negotiation', owner: 'Sarah Chen', amount: 58000, probability: 65, closeDate: '2026-09-30' },
  { id: 6, name: 'Security add-on', customerId: 19, stage: 'proposal', owner: 'Marcus Lee', amount: 33000, probability: 45, closeDate: '2026-10-18' },
  { id: 7, name: 'Data migration', customerId: 8, stage: 'lead', owner: 'Elena Vidal', amount: 21000, probability: 20, closeDate: '2026-12-05' },
  { id: 8, name: 'Multi-region', customerId: 13, stage: 'won', owner: 'Tom Baker', amount: 47000, probability: 100, closeDate: '2026-06-28' },
  { id: 9, name: 'Onboarding package', customerId: 5, stage: 'qualified', owner: 'Sarah Chen', amount: 9000, probability: 40, closeDate: '2026-11-22' },
  { id: 10, name: 'Analytics tier', customerId: 15, stage: 'proposal', owner: 'Marcus Lee', amount: 38000, probability: 50, closeDate: '2026-10-08' },
  { id: 11, name: 'Compliance module', customerId: 6, stage: 'negotiation', owner: 'Elena Vidal', amount: 72000, probability: 75, closeDate: '2026-09-12' },
  { id: 12, name: 'Trial conversion', customerId: 3, stage: 'lead', owner: 'Tom Baker', amount: 6000, probability: 15, closeDate: '2026-12-20' },
  { id: 13, name: 'Enterprise SSO', customerId: 2, stage: 'won', owner: 'Sarah Chen', amount: 30000, probability: 100, closeDate: '2026-07-05' },
  { id: 14, name: 'Capacity boost', customerId: 14, stage: 'qualified', owner: 'Marcus Lee', amount: 15000, probability: 30, closeDate: '2026-11-15' },
  { id: 15, name: 'Premium support', customerId: 17, stage: 'proposal', owner: 'Elena Vidal', amount: 18000, probability: 45, closeDate: '2026-10-25' },
  { id: 16, name: 'Global expansion', customerId: 11, stage: 'lost', owner: 'Tom Baker', amount: 90000, probability: 0, closeDate: '2026-05-30' },
  { id: 17, name: 'API integration', customerId: 10, stage: 'qualified', owner: 'Sarah Chen', amount: 8000, probability: 35, closeDate: '2026-11-28' },
  { id: 18, name: 'Renewal + upsell', customerId: 19, stage: 'negotiation', owner: 'Marcus Lee', amount: 66000, probability: 70, closeDate: '2026-09-22' },
  { id: 19, name: 'Sandbox pilot', customerId: 18, stage: 'lead', owner: 'Elena Vidal', amount: 7000, probability: 20, closeDate: '2026-12-12' },
  { id: 20, name: 'Custom reporting', customerId: 15, stage: 'won', owner: 'Tom Baker', amount: 26000, probability: 100, closeDate: '2026-06-18' },
  { id: 21, name: 'Migration service', customerId: 4, stage: 'proposal', owner: 'Sarah Chen', amount: 22000, probability: 50, closeDate: '2026-10-14' },
  { id: 22, name: 'Team plan', customerId: 5, stage: 'lost', owner: 'Marcus Lee', amount: 11000, probability: 0, closeDate: '2026-04-16' },
  { id: 23, name: 'Platform renewal', customerId: 1, stage: 'negotiation', owner: 'Elena Vidal', amount: 44000, probability: 60, closeDate: '2026-09-08' },
  { id: 24, name: 'Advanced tier', customerId: 13, stage: 'qualified', owner: 'Tom Baker', amount: 19000, probability: 40, closeDate: '2026-11-05' },
]

/** The hero grid: the no-code default plus the enterprise surface (filtering, export
 *  toolbar, totals, status pills, row actions) and custom cells - MRR as currency,
 *  health as a progress bar, email as a link, dates formatted, larger comfortable rows. */
function crudGrid(): Block {
  const base = defaultBlockConfig('grid', customers) as GridConfig
  const columns: GridColumnConfig[] = gridColumns(customers).map((c) =>
    c.field === 'mrr' ? { ...c, header: 'MRR', format: { type: 'currency', currency: 'USD' }, align: 'right', aggregate: 'sum' }
    : c.field === 'seats' ? { ...c, align: 'right', aggregate: 'sum' }
    : c.field === 'health' ? { ...c, header: 'Health', width: 140, cellType: { kind: 'progress', max: 100 } }
    : c.field === 'signupDate' || c.field === 'lastContact' ? { ...c, format: { type: 'date' } }
    : c.field === 'email' ? { ...c, cellType: { kind: 'link', as: 'email' } }
    : c,
  )
  const config: GridConfig = {
    ...base,
    columns,
    filterable: true,
    filterUi: { global: true, row: false, menu: true },
    export: { csv: true, json: true, copy: true },
    rowSummaries: true,
    pageSize: 10,
    density: 'comfortable',
    rowActions: [{ kind: 'edit' }, { kind: 'delete' }],
    props: { headerHeight: 48 },
  }
  return { id: 'grid-1', span: 3, height: 440, config }
}

/** The Deals grid: stage/owner chips, currency amount (summed), a probability bar. */
function dealsGrid(): Block {
  const base = defaultBlockConfig('grid', deals) as GridConfig
  const columns: GridColumnConfig[] = gridColumns(deals).map((c) =>
    c.field === 'amount' ? { ...c, format: { type: 'currency', currency: 'USD' }, align: 'right', aggregate: 'sum' }
    : c.field === 'probability' ? { ...c, header: 'Win %', width: 130, cellType: { kind: 'progress', max: 100 } }
    : c.field === 'closeDate' ? { ...c, format: { type: 'date' } }
    : c,
  )
  const config: GridConfig = {
    ...base,
    columns,
    filterable: true,
    filterUi: { global: true, row: false, menu: true },
    export: { csv: true, json: true, copy: true },
    rowSummaries: true,
    pageSize: 10,
    density: 'comfortable',
    rowActions: [{ kind: 'edit' }, { kind: 'delete' }],
    props: { headerHeight: 48 },
  }
  return { id: 'grid-1', span: 3, height: 440, config }
}

/** A docking-workspace console: a facet filter, the rich grid, and a record panel laid
 *  out in a live SvDockManager (drag to float / pin / re-dock) - the signature "wow"
 *  layout. `buildDockLayout` seeds filter-left, grid-centre, record-right. */
function dockConsole(entity: EntitySchema, id: string, title: string, order: number, gridBlock: Block, filterFields: string[]): Screen {
  const blocks: Block[] = [
    { id: 'filter-1', span: 3, config: { kind: 'filter', fields: filterFields } },
    gridBlock,
    { id: 'record-1', span: 3, config: { kind: 'record', editable: true } },
  ]
  const base: Screen = { id, entity: entity.name, title, route: id, blocks, nav: { show: true, label: title, order }, layout: 'dock' }
  return { ...base, dock: buildDockLayout(base) }
}

/** The Overview: the hero Customers grid FIRST (so opening the app lands on a real
 *  data grid, not a chart), with KPI cards + charts below it as supporting context. */
function overviewScreen(): Screen {
  const dash = dashScreen(customers, { id: 'overview', title: 'Overview', order: 0 }, [
    { kpi: 'Recurring revenue', measure: 'mrr', reduce: 'sum', format: 'currency', span: 1 },
    { kpi: 'Accounts', reduce: 'count', span: 1 },
    { kpi: 'Seats', measure: 'seats', reduce: 'sum', format: 'compact', span: 1 },
    { gauge: 'Avg health', measure: 'health', reduce: 'avg', min: 0, max: 100, span: 1 },
    { chart: 'industry', measure: 'mrr', reduce: 'sum', type: 'bar', span: 2 },
    { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
  ])
  return { ...dash, blocks: [crudGrid(), ...dash.blocks] }
}

/** The default first-run project: a complete, enterprise-ready multi-page CRM whose
 *  hero is the CRUD grid (Overview + two SvDockManager consoles). */
export function starterProject(): StudioProject {
  return project({
    title: 'Acme CRM',
    brand: 'Acme CRM',
    accent: '#6366f1',
    footer: 'Built with SvGrid Studio',
    entities: [customers, deals],
    screens: [
      // Overview: KPIs + charts ABOVE the hero Customers grid.
      overviewScreen(),
      // Customers: a dockable console - filter + hero grid + record panel (drag to float / pin).
      dockConsole(customers, 'customers', 'Customers', 1, crudGrid(), ['status', 'industry', 'plan']),
      // Pipeline: deals as draggable cards in stage columns (drag to change stage).
      boardScreen(deals, { id: 'pipeline', title: 'Pipeline', order: 2 }, { groupBy: 'stage', titleField: 'name', badgeField: 'amount', subtitleField: 'owner', filter: ['owner', 'stage'] }),
      // Deals: a second docking console over the opportunity grid.
      dockConsole(deals, 'deals', 'Deals', 3, dealsGrid(), ['stage', 'owner']),
      // Calendar: deals placed on a month calendar by their close date, tinted by stage.
      calendarScreen(deals, { id: 'calendar', title: 'Calendar', order: 4 }, { dateField: 'closeDate', titleField: 'name', colorField: 'stage', filter: ['owner'] }),
      // Forecast: pipeline KPIs, value by stage/owner, and a pivot of amount by owner x stage.
      dashScreen(deals, { id: 'forecast', title: 'Forecast', order: 5 }, [
        { kpi: 'Pipeline value', measure: 'amount', reduce: 'sum', format: 'currency', span: 1 },
        { kpi: 'Open deals', reduce: 'count', span: 1 },
        { kpi: 'Avg deal size', measure: 'amount', reduce: 'avg', format: 'currency', span: 1 },
        { kpi: 'Largest deal', measure: 'amount', reduce: 'max', format: 'currency', span: 1 },
        { chart: 'stage', measure: 'amount', reduce: 'sum', type: 'bar', span: 2 },
        { chart: 'owner', measure: 'amount', reduce: 'sum', type: 'bar', span: 1 },
        { pivot: { rows: ['owner'], cols: ['stage'], measure: 'amount', aggregate: 'sum' }, span: 3 },
      ]),
    ],
    seed: { customers: customerSeed, deals: dealSeed },
  })
}
