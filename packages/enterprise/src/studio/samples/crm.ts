import type { EntitySchema } from '../../schema.js'
import { screen, project, dashScreen, pad, ids, type SampleApp } from './shared.js'

const companies: EntitySchema = {
  name: 'companies',
  label: 'Company',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'industry', type: 'enum', options: [
      { value: 'saas', label: 'SaaS', color: '#6366f1' },
      { value: 'fintech', label: 'Fintech', color: '#10b981' },
      { value: 'retail', label: 'Retail', color: '#f59e0b' },
      { value: 'health', label: 'Health', color: '#ef4444' },
    ] },
    { field: 'country', type: 'text' },
    { field: 'employees', type: 'number', label: 'Employees' },
    { field: 'website', type: 'text' },
    { field: 'active', type: 'boolean', label: 'Active' },
  ],
}

const contacts: EntitySchema = {
  name: 'contacts',
  label: 'Contact',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'email', type: 'text', format: 'email' },
    { field: 'phone', type: 'text' },
    { field: 'title', type: 'text', label: 'Job title' },
    { field: 'companyId', type: 'relation', label: 'Company', relation: { entity: 'companies', foreignKey: 'companyId', labelField: 'name' } },
    { field: 'active', type: 'boolean' },
  ],
}

const deals: EntitySchema = {
  name: 'deals',
  label: 'Deal',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'title', type: 'text', required: true },
    { field: 'companyId', type: 'relation', label: 'Company', relation: { entity: 'companies', foreignKey: 'companyId', labelField: 'name' } },
    { field: 'stage', type: 'enum', options: [
      { value: 'lead', label: 'Lead', color: '#94a3b8' },
      { value: 'qualified', label: 'Qualified', color: '#6366f1' },
      { value: 'proposal', label: 'Proposal', color: '#f59e0b' },
      { value: 'won', label: 'Won', color: '#10b981' },
      { value: 'lost', label: 'Lost', color: '#ef4444' },
    ] },
    { field: 'value', type: 'number', label: 'Value ($)' },
    { field: 'owner', type: 'text', label: 'Owner' },
    { field: 'closeDate', type: 'date', label: 'Close date' },
  ],
}

const seed = {
  companies: [
    { id: 'co1', name: 'Globex', industry: 'saas', country: 'United States', employees: 320, website: 'https://globex.com', active: true },
    { id: 'co2', name: 'Initech', industry: 'fintech', country: 'United Kingdom', employees: 140, website: 'https://initech.co', active: true },
    { id: 'co3', name: 'Umbrella', industry: 'health', country: 'Germany', employees: 900, website: 'https://umbrella.de', active: true },
    { id: 'co4', name: 'Hooli', industry: 'saas', country: 'United States', employees: 2100, website: 'https://hooli.com', active: false },
    { id: 'co5', name: 'Soylent', industry: 'retail', country: 'Canada', employees: 75, website: 'https://soylent.ca', active: true },
    { id: 'co6', name: 'Stark Industries', industry: 'fintech', country: 'United States', employees: 5400, website: 'https://stark.com', active: true },
  ],
  contacts: [
    { id: 'ct1', name: 'Ada Lovelace', email: 'ada@globex.com', phone: '+1 (415) 555-0101', title: 'CTO', companyId: 'co1', active: true },
    { id: 'ct2', name: 'Alan Turing', email: 'alan@initech.co', phone: '+44 20 7946 0102', title: 'Head of Data', companyId: 'co2', active: true },
    { id: 'ct3', name: 'Grace Hopper', email: 'grace@umbrella.de', phone: '+49 30 5550103', title: 'VP Engineering', companyId: 'co3', active: true },
    { id: 'ct4', name: 'Linus Torvalds', email: 'linus@hooli.com', phone: '+1 (650) 555-0104', title: 'Architect', companyId: 'co4', active: false },
    { id: 'ct5', name: 'Barbara Liskov', email: 'barbara@soylent.ca', phone: '+1 (416) 555-0105', title: 'Founder', companyId: 'co5', active: true },
    { id: 'ct6', name: 'Katherine Johnson', email: 'kj@stark.com', phone: '+1 (212) 555-0106', title: 'Analyst', companyId: 'co6', active: true },
    { id: 'ct7', name: 'Donald Knuth', email: 'don@globex.com', phone: '+1 (415) 555-0107', title: 'Advisor', companyId: 'co1', active: true },
    { id: 'ct8', name: 'Margaret Hamilton', email: 'mh@stark.com', phone: '+1 (212) 555-0108', title: 'Director', companyId: 'co6', active: true },
  ],
  deals: [
    { id: 'dl1', title: 'Globex platform rollout', companyId: 'co1', stage: 'proposal', value: 48000, owner: 'Sam Rivera', closeDate: '2026-08-15' },
    { id: 'dl2', title: 'Initech data pipeline', companyId: 'co2', stage: 'won', value: 26000, owner: 'Jamie Chen', closeDate: '2026-06-30' },
    { id: 'dl3', title: 'Umbrella compliance suite', companyId: 'co3', stage: 'qualified', value: 91000, owner: 'Sam Rivera', closeDate: '2026-09-20' },
    { id: 'dl4', title: 'Hooli migration', companyId: 'co4', stage: 'lost', value: 15000, owner: 'Priya Patel', closeDate: '2026-05-10' },
    { id: 'dl5', title: 'Soylent storefront', companyId: 'co5', stage: 'lead', value: 8000, owner: 'Jamie Chen', closeDate: '2026-10-01' },
    { id: 'dl6', title: 'Stark analytics', companyId: 'co6', stage: 'proposal', value: 132000, owner: 'Priya Patel', closeDate: '2026-08-28' },
    { id: 'dl7', title: 'Globex add-on seats', companyId: 'co1', stage: 'won', value: 12000, owner: 'Sam Rivera', closeDate: '2026-07-05' },
    { id: 'dl8', title: 'Stark expansion', companyId: 'co6', stage: 'qualified', value: 54000, owner: 'Jamie Chen', closeDate: '2026-09-12' },
  ],
}

export const crm: SampleApp = {
  id: 'crm',
  name: 'CRM',
  description: 'Companies, contacts and a deal pipeline - dashboard, master/detail and grids.',
  emoji: '\u{1F91D}',
  accent: '#6366f1',
  build: () => {
    const companyRows = pad(companies, seed.companies, 12)
    const pool = ids(companyRows)
    const contactRows = pad(contacts, seed.contacts, 22, { companyId: pool })
    const dealRows = pad(deals, seed.deals, 30, { companyId: pool })
    return project({
      title: 'Acme CRM',
      brand: 'Acme CRM',
      accent: '#6366f1',
      footer: '© Acme Inc.',
      entities: [companies, contacts, deals],
      seed: { companies: companyRows, contacts: contactRows, deals: dealRows },
      screens: [
        dashScreen(deals, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Open deals', reduce: 'count' },
          { kpi: 'Pipeline value', measure: 'value', reduce: 'sum' },
          { kpi: 'Avg deal size', measure: 'value', reduce: 'avg' },
          { chart: 'stage', measure: 'value', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Largest deal', measure: 'value', reduce: 'max', span: 1 },
          { chart: 'stage', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'owner', reduce: 'count', type: 'bar', span: 2 },
          { grid: true, span: 3 },
        ]),
        dashScreen(companies, { id: 'accounts', title: 'Accounts', order: 1 }, [
          { kpi: 'Companies', reduce: 'count' },
          { kpi: 'Total headcount', measure: 'employees', reduce: 'sum' },
          { kpi: 'Avg headcount', measure: 'employees', reduce: 'avg' },
          { chart: 'industry', measure: 'employees', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Largest account', measure: 'employees', reduce: 'max', span: 1 },
          { chart: 'industry', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, span: 3 },
        ]),
        screen(companies, 'master-detail', { id: 'companies', title: 'Companies', order: 2, child: contacts, foreignKey: 'companyId' }),
        screen(contacts, 'crud', { id: 'contacts', title: 'Contacts', order: 3 }),
        screen(deals, 'crud', { id: 'deals', title: 'Deals', order: 4 }),
      ],
    })
  },
}
