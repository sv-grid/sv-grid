import type { EntitySchema } from '../../schema.js'
import type { FormatRule } from '../project.js'
import { screen, formScreen, boardScreen, calendarScreen, detailScreen, project, dashScreen, statusPills, pad, ids, type SampleApp } from './shared.js'

// SAP Fiori-style chrome: a dark shell bar across the top (the toolbar), a white
// launchpad-style rail, and a blue left-bar on the active item (square corners).
const FIORI_CSS = `.sv-app.theme-fiori .sv-app__toolbar { background: #354a5f; border-bottom: 0; }
.sv-app.theme-fiori .sv-app__search { background: rgba(255, 255, 255, 0.12); border-color: rgba(255, 255, 255, 0.24); }
.sv-app.theme-fiori .sv-app__search-in { color: #fff; }
.sv-app.theme-fiori .sv-app__search-in::placeholder { color: rgba(255, 255, 255, 0.72); }
.sv-app.theme-fiori .sv-app__search-ic, .sv-app.theme-fiori .sv-app__kbd { color: #fff; }
.sv-app.theme-fiori .sv-app__side { background: #fff; border-right: 1px solid #e5e5e5; }
.sv-app.theme-fiori .sv-app__brandtext { color: #0a6ed1; font-weight: 700; }
.sv-app.theme-fiori .sv-app__link { border-radius: 0; padding: 9px 12px; border-left: 3px solid transparent; color: #32363a; }
.sv-app.theme-fiori .sv-app__link:hover { background: #f5f6f7; }
.sv-app.theme-fiori .sv-app__link.is-active { background: #ebf5ff; color: #0a6ed1; border-left-color: #0a6ed1; font-weight: 600; }`

const policies: EntitySchema = {
  name: 'policies',
  label: 'Policy',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'policyNumber', type: 'text', label: 'Policy #', required: true, input: { editorType: 'mask', mask: 'POL-######', help: 'Policy identifier' } },
    { field: 'holder', type: 'text', label: 'Policy holder', required: true, minLength: 2 },
    { field: 'email', type: 'text', label: 'Email', format: 'email', required: true, input: { placeholder: 'holder@example.com' } },
    { field: 'type', type: 'enum', label: 'Line', required: true, options: [
      { value: 'auto', label: 'Auto', color: '#6366f1' },
      { value: 'home', label: 'Home', color: '#10b981' },
      { value: 'life', label: 'Life', color: '#f59e0b' },
      { value: 'health', label: 'Health', color: '#ef4444' },
    ] },
    { field: 'region', type: 'text', label: 'Region', input: { editorType: 'country', help: 'Underwriting region' } },
    { field: 'premium', type: 'number', label: 'Premium ($)', min: 0, required: true },
    { field: 'coverage', type: 'number', label: 'Coverage ($)', min: 0, required: true },
    { field: 'riskScore', type: 'number', label: 'Risk', min: 1, max: 5, defaultValue: 3, input: { editorType: 'rating', help: '1 (low) - 5 (high) underwriting risk' } },
    { field: 'status', type: 'enum', label: 'Status', defaultValue: 'active', options: [
      { value: 'active', label: 'Active', color: '#10b981' },
      { value: 'lapsed', label: 'Lapsed', color: '#f59e0b' },
      { value: 'cancelled', label: 'Cancelled', color: '#ef4444' },
    ] },
    { field: 'startDate', type: 'date', label: 'Start date' },
  ],
}

const adjusters: EntitySchema = {
  name: 'adjusters',
  label: 'Adjuster',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', format: 'email', required: true },
    { field: 'phone', type: 'text', input: { editorType: 'phone' } },
    { field: 'region', type: 'text', label: 'Region', input: { editorType: 'country' } },
    { field: 'specialty', type: 'enum', label: 'Specialty', options: [
      { value: 'auto', label: 'Auto', color: '#6366f1' },
      { value: 'property', label: 'Property', color: '#10b981' },
      { value: 'medical', label: 'Medical', color: '#ef4444' },
      { value: 'liability', label: 'Liability', color: '#f59e0b' },
    ] },
    { field: 'rating', type: 'number', label: 'Rating', min: 1, max: 5, defaultValue: 4, input: { editorType: 'rating', help: 'Resolution quality' } },
    { field: 'color', type: 'text', label: 'Accent', defaultValue: '#0ea5e9', input: { editorType: 'color', help: 'Chart accent color' } },
    { field: 'active', type: 'boolean', label: 'Active', defaultValue: true },
  ],
}

const claims: EntitySchema = {
  name: 'claims',
  label: 'Claim',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'claimNumber', type: 'text', label: 'Claim #', required: true, input: { editorType: 'mask', mask: 'CLM-######', help: 'Claim reference' } },
    { field: 'policyId', type: 'relation', label: 'Policy', required: true, relation: { entity: 'policies', foreignKey: 'policyId', labelField: 'policyNumber' } },
    { field: 'adjusterId', type: 'relation', label: 'Adjuster', relation: { entity: 'adjusters', foreignKey: 'adjusterId', labelField: 'name' } },
    { field: 'type', type: 'enum', label: 'Type', required: true, options: [
      { value: 'collision', label: 'Collision', color: '#6366f1' },
      { value: 'theft', label: 'Theft', color: '#8b5cf6' },
      { value: 'fire', label: 'Fire', color: '#ef4444' },
      { value: 'water', label: 'Water', color: '#0ea5e9' },
      { value: 'medical', label: 'Medical', color: '#10b981' },
    ] },
    { field: 'status', type: 'enum', label: 'Status', required: true, defaultValue: 'filed', options: [
      { value: 'filed', label: 'Filed', color: '#94a3b8' },
      { value: 'review', label: 'In review', color: '#0ea5e9' },
      { value: 'approved', label: 'Approved', color: '#6366f1' },
      { value: 'paid', label: 'Paid', color: '#10b981' },
      { value: 'denied', label: 'Denied', color: '#ef4444' },
    ] },
    { field: 'amount', type: 'number', label: 'Amount ($)', min: 0, required: true },
    { field: 'deductible', type: 'number', label: 'Deductible ($)', min: 0, defaultValue: 500 },
    // Derived: net payout after the deductible (display-only, never stored).
    { field: 'net', type: 'number', label: 'Net payout ($)', readonly: true, formula: 'amount - deductible' },
    { field: 'severity', type: 'number', label: 'Severity', min: 0, max: 100, defaultValue: 40, input: { editorType: 'slider', suffix: '%', help: 'Loss severity 0-100' } },
    { field: 'fraudRisk', type: 'number', label: 'Fraud risk', min: 1, max: 5, defaultValue: 1, input: { editorType: 'rating', help: 'Fraud indicators 1-5' } },
    { field: 'tags', type: 'text', label: 'Tags', input: { editorType: 'chips', help: 'Triage keywords' } },
    { field: 'incidentDate', type: 'date', label: 'Incident date' },
    { field: 'filedAt', type: 'datetime', label: 'Filed at', input: { editorType: 'datetime', help: 'When the claim was filed' } },
  ],
}

const seed = {
  policies: [
    { id: 'pl1', policyNumber: 'POL-100001', holder: 'Oliver Grant', email: 'oliver.grant@example.com', type: 'auto', region: 'United States', premium: 1200, coverage: 45000, riskScore: 2, status: 'active', startDate: '2024-03-01' },
    { id: 'pl2', policyNumber: 'POL-100002', holder: 'Maya Fernandez', email: 'maya.fernandez@example.com', type: 'home', region: 'Spain', premium: 980, coverage: 320000, riskScore: 3, status: 'active', startDate: '2023-11-15' },
    { id: 'pl3', policyNumber: 'POL-100003', holder: 'Noah Kim', email: 'noah.kim@example.com', type: 'health', region: 'South Korea', premium: 2100, coverage: 150000, riskScore: 4, status: 'active', startDate: '2025-01-08' },
    { id: 'pl4', policyNumber: 'POL-100004', holder: 'Sophia Rossi', email: 'sophia.rossi@example.com', type: 'life', region: 'Italy', premium: 1650, coverage: 500000, riskScore: 2, status: 'lapsed', startDate: '2022-06-20' },
    { id: 'pl5', policyNumber: 'POL-100005', holder: 'Ethan Walsh', email: 'ethan.walsh@example.com', type: 'auto', region: 'United States', premium: 1420, coverage: 52000, riskScore: 5, status: 'active', startDate: '2024-09-12' },
    { id: 'pl6', policyNumber: 'POL-100006', holder: 'Amara Okafor', email: 'amara.okafor@example.com', type: 'home', region: 'Nigeria', premium: 760, coverage: 210000, riskScore: 3, status: 'cancelled', startDate: '2023-02-28' },
    { id: 'pl7', policyNumber: 'POL-100007', holder: 'Liam Murphy', email: 'liam.murphy@example.com', type: 'health', region: 'Ireland', premium: 1890, coverage: 180000, riskScore: 4, status: 'active', startDate: '2024-12-01' },
    { id: 'pl8', policyNumber: 'POL-100008', holder: 'Hana Sato', email: 'hana.sato@example.com', type: 'auto', region: 'Japan', premium: 1310, coverage: 48000, riskScore: 2, status: 'active', startDate: '2025-02-19' },
  ],
  adjusters: [
    { id: 'ad1', name: 'Grace Okonkwo', email: 'grace.okonkwo@insureco.com', phone: '+1 (415) 555-0301', region: 'United States', specialty: 'auto', rating: 5, color: '#6366f1', active: true },
    { id: 'ad2', name: 'Marcus Bauer', email: 'marcus.bauer@insureco.com', phone: '+49 30 5550302', region: 'Germany', specialty: 'property', rating: 4, color: '#10b981', active: true },
    { id: 'ad3', name: 'Priya Nair', email: 'priya.nair@insureco.com', phone: '+91 22 5550 303', region: 'India', specialty: 'medical', rating: 5, color: '#ef4444', active: true },
    { id: 'ad4', name: 'Diego Santos', email: 'diego.santos@insureco.com', phone: '+55 11 95555-0304', region: 'Brazil', specialty: 'liability', rating: 3, color: '#f59e0b', active: true },
    { id: 'ad5', name: 'Elena Popova', email: 'elena.popova@insureco.com', phone: '+7 495 555 0305', region: 'Russia', specialty: 'property', rating: 4, color: '#8b5cf6', active: false },
    { id: 'ad6', name: 'Thomas Becker', email: 'thomas.becker@insureco.com', phone: '+1 (206) 555-0306', region: 'United States', specialty: 'auto', rating: 4, color: '#0ea5e9', active: true },
  ],
  claims: [
    { id: 'cl1', claimNumber: 'CLM-500001', policyId: 'pl1', adjusterId: 'ad1', type: 'collision', status: 'paid', amount: 8400, deductible: 500, severity: 55, fraudRisk: 1, tags: ['rear-end', 'no-injury'], incidentDate: '2026-01-04', filedAt: '2026-01-06T09:30:00.000Z' },
    { id: 'cl2', claimNumber: 'CLM-500002', policyId: 'pl2', adjusterId: 'ad2', type: 'water', status: 'review', amount: 15200, deductible: 1000, severity: 70, fraudRisk: 2, tags: ['burst-pipe'], incidentDate: '2026-02-01', filedAt: '2026-02-03T14:15:00.000Z' },
    { id: 'cl3', claimNumber: 'CLM-500003', policyId: 'pl3', adjusterId: 'ad3', type: 'medical', status: 'approved', amount: 6200, deductible: 750, severity: 40, fraudRisk: 1, tags: ['surgery'], incidentDate: '2026-02-10', filedAt: '2026-02-12T11:00:00.000Z' },
    { id: 'cl4', claimNumber: 'CLM-500004', policyId: 'pl5', adjusterId: 'ad1', type: 'theft', status: 'denied', amount: 22000, deductible: 500, severity: 90, fraudRisk: 5, tags: ['suspicious', 'late-report'], incidentDate: '2026-01-20', filedAt: '2026-01-28T16:45:00.000Z' },
    { id: 'cl5', claimNumber: 'CLM-500005', policyId: 'pl6', adjusterId: 'ad4', type: 'fire', status: 'paid', amount: 41000, deductible: 2000, severity: 95, fraudRisk: 2, tags: ['kitchen', 'total-loss'], incidentDate: '2026-03-01', filedAt: '2026-03-02T08:20:00.000Z' },
    { id: 'cl6', claimNumber: 'CLM-500006', policyId: 'pl7', adjusterId: 'ad3', type: 'medical', status: 'filed', amount: 3100, deductible: 750, severity: 25, fraudRisk: 1, tags: ['ER-visit'], incidentDate: '2026-03-11', filedAt: '2026-03-12T13:10:00.000Z' },
    { id: 'cl7', claimNumber: 'CLM-500007', policyId: 'pl8', adjusterId: 'ad6', type: 'collision', status: 'review', amount: 9700, deductible: 500, severity: 60, fraudRisk: 3, tags: ['intersection'], incidentDate: '2026-03-15', filedAt: '2026-03-17T10:05:00.000Z' },
    { id: 'cl8', claimNumber: 'CLM-500008', policyId: 'pl1', adjusterId: 'ad6', type: 'theft', status: 'approved', amount: 5400, deductible: 500, severity: 50, fraudRisk: 2, tags: ['catalytic-converter'], incidentDate: '2026-02-22', filedAt: '2026-02-24T15:30:00.000Z' },
  ],
}

// Claim grid formatting: status pills + a red-bold high-fraud threshold and a
// green highlight on large approved payouts - data-driven, not just pills.
const claimFormats: FormatRule[] = [
  ...statusPills(claims, 'status'),
  { field: 'fraudRisk', op: 'gte', value: 4, color: '#dc2626', bold: true },
  { field: 'amount', op: 'gte', value: 20000, color: '#b45309', bold: true },
]

export const insurance: SampleApp = {
  id: 'insurance',
  name: 'Insurance Claims',
  description: 'Policies, adjusters and claims - a SAP Fiori-style claims desk behind a sign-in (adjuster and admin roles), with a claims pipeline board (Filed -> Paid), payout + approval dashboards (target KPIs, a filings sparkline, a severity gauge, type/status breakdowns, an adjuster x status pivot, tabbed views), a fraud-risk red grid, policy master/detail with a claims timeline, and rich edit forms (policy/claim number masks, region, adjuster phone, risk + fraud ratings, severity slider, triage chips, filing datetime).',
  emoji: '\u{1F6E1}\u{FE0F}',
  accent: '#0070f2',
  build: () => {
    const policyRows = pad(policies, seed.policies, 40)
    const adjusterRows = pad(adjusters, seed.adjusters, 16)
    const claimRows = pad(claims, seed.claims, 90, { policyId: ids(policyRows), adjusterId: ids(adjusterRows) })
    return project({
      title: 'Claims',
      brand: 'Assurance',
      accent: '#0070f2',
      preset: 'sap',
      footer: '',
      // SAP Fiori-style enterprise shell: a dark shell bar + a launchpad rail.
      appClass: 'theme-fiori',
      customCss: FIORI_CSS,
      // Sign-in with two roles. Adjusters work the claims queue but cannot delete;
      // the policy portfolio and the adjuster roster are admin-only, so they drop
      // out of an adjuster's nav.
      auth: { enabled: true, protect: true },
      access: {
        enabled: true,
        defaultRole: 'adjuster',
        roles: [
          { role: 'admin', screens: '*', actions: '*' },
          { role: 'adjuster', screens: ['overview', 'pipeline', 'claim-detail', 'claims', 'calendar'], actions: ['create', 'update'] },
        ],
      },
      entities: [policies, adjusters, claims],
      seed: { policies: policyRows, adjusters: adjusterRows, claims: claimRows },
      screens: [
        // Claims dashboard: payout + approval KPIs (total payout carries a target,
        // filings trend as a sparkline), a severity gauge, type/status breakdowns,
        // an adjuster x status pivot, tabs, and a fraud-risk status-pill grid that
        // drills into the claim detail.
        dashScreen(claims, { id: 'overview', title: 'Claims', order: 0 }, [
          { kpi: 'Claims', reduce: 'count', span: 1 },
          { kpi: 'Total payout', measure: 'net', reduce: 'sum', format: 'currency', target: 200000, span: 1 },
          { kpi: 'Filings', measure: 'amount', reduce: 'count', trendField: 'filedAt', trendReduce: 'count', span: 1 },
          { gauge: 'Avg severity', measure: 'severity', reduce: 'avg', min: 0, max: 100, unit: '%', span: 1 },
          { chart: 'status', measure: 'amount', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'type', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'filedAt', measure: 'amount', reduce: 'sum', type: 'area', span: 3 },
          { pivot: { rows: ['adjusterId'], cols: ['status'], measure: 'amount', aggregate: 'sum' }, span: 3 },
          { tabs: [
            { label: 'Payout by status', tiles: [{ chart: 'status', measure: 'net', reduce: 'sum', type: 'bar' }] },
            { label: 'Claims by type', tiles: [{ chart: 'type', reduce: 'count', type: 'bar' }] },
          ], span: 3 },
          { grid: true, format: claimFormats, summaries: true, rowActions: [{ kind: 'edit' }], rowLink: { screen: 'claim-detail', sourceField: 'id', targetField: 'id' }, span: 3 },
        ]),
        // The signature view: the claims pipeline as draggable Kanban columns by
        // status, each card the claim number + policy + payout; opens the detail.
        boardScreen(claims, { id: 'pipeline', title: 'Pipeline', order: 1 }, { groupBy: 'status', titleField: 'claimNumber', subtitleField: 'policyId', badgeField: 'amount', filter: ['status', 'type', 'adjusterId'], openScreen: 'claim-detail' }),
        // Claim detail: header (claim # + policy + status pill), payout metric
        // tiles, and Overview sections.
        detailScreen(claims, { id: 'claim-detail', title: 'Claim detail', order: 2 }, {
          titleField: 'claimNumber', subtitleField: 'policyId', statusField: 'status',
          metricFields: ['amount', 'net'],
          sections: [
            { label: 'Assessment', fields: ['type', 'severity', 'fraudRisk', 'tags'] },
            { label: 'Handling', fields: ['adjusterId', 'deductible', 'incidentDate', 'filedAt'] },
          ],
        }),
        // Policy 360: a full policy record with a timeline of its claims.
        detailScreen(policies, { id: 'policy-360', title: 'Policy 360', order: 3 }, {
          titleField: 'policyNumber', subtitleField: 'holder', statusField: 'status',
          metricFields: ['premium', 'coverage'],
          sections: [{ label: 'Underwriting', fields: ['type', 'region', 'riskScore', 'startDate'] }],
          related: [{ entity: 'claims', foreignKey: 'policyId', label: 'Claims', titleField: 'claimNumber', subtitleField: 'amount', dateField: 'filedAt', statusField: 'status' }],
        }),
        screen(policies, 'master-detail', { id: 'policies', title: 'Policies', order: 4, child: claims, foreignKey: 'policyId', linkScreen: 'policy-360' }),
        formScreen(claims, { id: 'claims', title: 'Claims list', order: 5 }, undefined, { format: claimFormats, summaries: true, rowActions: [{ kind: 'edit' }], rowLink: { screen: 'claim-detail', sourceField: 'id', targetField: 'id' } }, ['status', 'type', 'policyId']),
        formScreen(adjusters, { id: 'adjusters', title: 'Adjusters', order: 6 }, undefined, {}, ['specialty', 'region', 'active']),
        // Incident calendar: claims placed on a month calendar by incident date.
        calendarScreen(claims, { id: 'calendar', title: 'Incidents', order: 7 }, { dateField: 'incidentDate', titleField: 'claimNumber', filter: ['status', 'type', 'adjusterId'] }),
      ],
    })
  },
}
