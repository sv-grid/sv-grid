import type { EntitySchema } from '../../schema.js'
import { screen, project, dashScreen, type SampleApp } from './shared.js'

const agents: EntitySchema = {
  name: 'agents',
  label: 'Agent',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'email', type: 'text', format: 'email' },
    { field: 'phone', type: 'text' },
  ],
}

const properties: EntitySchema = {
  name: 'properties',
  label: 'Property',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'title', type: 'text', required: true },
    { field: 'type', type: 'enum', options: [
      { value: 'house', label: 'House', color: '#6366f1' },
      { value: 'condo', label: 'Condo', color: '#0ea5e9' },
      { value: 'land', label: 'Land', color: '#f59e0b' },
      { value: 'commercial', label: 'Commercial', color: '#ec4899' },
    ] },
    { field: 'status', type: 'enum', options: [
      { value: 'available', label: 'Available', color: '#10b981' },
      { value: 'pending', label: 'Pending', color: '#f59e0b' },
      { value: 'sold', label: 'Sold', color: '#94a3b8' },
    ] },
    { field: 'price', type: 'number', label: 'Price ($)' },
    { field: 'beds', type: 'number', label: 'Beds' },
    { field: 'city', type: 'text', label: 'City' },
  ],
}

const leads: EntitySchema = {
  name: 'leads',
  label: 'Lead',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'propertyId', type: 'relation', label: 'Property', relation: { entity: 'properties', foreignKey: 'propertyId', labelField: 'title' } },
    { field: 'agentId', type: 'relation', label: 'Agent', relation: { entity: 'agents', foreignKey: 'agentId', labelField: 'name' } },
    { field: 'stage', type: 'enum', options: [
      { value: 'new', label: 'New', color: '#94a3b8' },
      { value: 'touring', label: 'Touring', color: '#0ea5e9' },
      { value: 'offer', label: 'Offer', color: '#f59e0b' },
      { value: 'closed', label: 'Closed', color: '#10b981' },
      { value: 'lost', label: 'Lost', color: '#ef4444' },
    ] },
    { field: 'budget', type: 'number', label: 'Budget ($)' },
  ],
}

const seed = {
  agents: [
    { id: 'ag1', name: 'Sam Rivera', email: 'sam@realty.com', phone: '+1 (415) 555-0201' },
    { id: 'ag2', name: 'Jamie Chen', email: 'jamie@realty.com', phone: '+1 (650) 555-0202' },
    { id: 'ag3', name: 'Priya Patel', email: 'priya@realty.com', phone: '+1 (212) 555-0203' },
    { id: 'ag4', name: 'Diego Morales', email: 'diego@realty.com', phone: '+1 (305) 555-0204' },
    { id: 'ag5', name: 'Nina Kovac', email: 'nina@realty.com', phone: '+1 (312) 555-0205' },
  ],
  properties: [
    { id: 'pt1', title: 'Sunny Hill Villa', type: 'house', status: 'available', price: 875000, beds: 4, city: 'Austin' },
    { id: 'pt2', title: 'Downtown Loft', type: 'condo', status: 'pending', price: 420000, beds: 2, city: 'Chicago' },
    { id: 'pt3', title: 'Riverside Acreage', type: 'land', status: 'available', price: 260000, beds: 0, city: 'Boise' },
    { id: 'pt4', title: 'Market Street Office', type: 'commercial', status: 'sold', price: 1950000, beds: 0, city: 'San Francisco' },
    { id: 'pt5', title: 'Maple Court House', type: 'house', status: 'sold', price: 640000, beds: 3, city: 'Denver' },
    { id: 'pt6', title: 'Harbor View Condo', type: 'condo', status: 'available', price: 510000, beds: 2, city: 'Seattle' },
    { id: 'pt7', title: 'Old Town Retail', type: 'commercial', status: 'pending', price: 1180000, beds: 0, city: 'Portland' },
  ],
  leads: [
    { id: 'ld1', propertyId: 'pt1', agentId: 'ag1', stage: 'touring', budget: 900000 },
    { id: 'ld2', propertyId: 'pt2', agentId: 'ag2', stage: 'offer', budget: 430000 },
    { id: 'ld3', propertyId: 'pt3', agentId: 'ag3', stage: 'new', budget: 250000 },
    { id: 'ld4', propertyId: 'pt4', agentId: 'ag1', stage: 'closed', budget: 1950000 },
    { id: 'ld5', propertyId: 'pt5', agentId: 'ag4', stage: 'lost', budget: 600000 },
    { id: 'ld6', propertyId: 'pt6', agentId: 'ag5', stage: 'touring', budget: 520000 },
    { id: 'ld7', propertyId: 'pt7', agentId: 'ag2', stage: 'offer', budget: 1150000 },
  ],
}

export const realEstate: SampleApp = {
  id: 'realestate',
  name: 'Real estate',
  description: 'Properties, agents and leads - listings and sales pipeline dashboards.',
  emoji: '\u{1F3E0}',
  accent: '#10b981',
  build: () =>
    project({
      title: 'Realty',
      brand: 'Realty',
      accent: '#10b981',
      footer: '',
      entities: [agents, properties, leads],
      seed,
      screens: [
        dashScreen(properties, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Listings', reduce: 'count' },
          { kpi: 'Total value', measure: 'price', reduce: 'sum' },
          { kpi: 'Avg price', measure: 'price', reduce: 'avg' },
          { chart: 'type', measure: 'price', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Top price', measure: 'price', reduce: 'max', span: 1 },
          { chart: 'type', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, span: 3 },
        ]),
        screen(agents, 'master-detail', { id: 'agents', title: 'Agents', order: 1, child: leads, foreignKey: 'agentId' }),
        screen(properties, 'crud', { id: 'properties', title: 'Properties', order: 2 }),
        screen(leads, 'crud', { id: 'leads', title: 'Leads', order: 3 }),
      ],
    }),
}
