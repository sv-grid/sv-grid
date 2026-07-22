import type { EntitySchema } from '../../schema.js'
import type { FormatRule } from '../project.js'
import { screen, formScreen, boardScreen, project, dashScreen, detailScreen, statusPills, pad, ids, type SampleApp } from './shared.js'

const agents: EntitySchema = {
  name: 'agents',
  label: 'Agent',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', format: 'email', required: true },
    { field: 'phone', type: 'text', input: { editorType: 'phone' } },
    { field: 'license', type: 'text', label: 'License #', input: { editorType: 'mask', mask: 'AA-######', help: 'State license number' } },
    { field: 'rating', type: 'number', label: 'Rating', min: 1, max: 5, defaultValue: 4, input: { editorType: 'rating', help: '1-5 client satisfaction' } },
    { field: 'active', type: 'boolean', label: 'Active', defaultValue: true },
  ],
}

const properties: EntitySchema = {
  name: 'properties',
  label: 'Property',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'title', type: 'text', required: true, minLength: 3 },
    { field: 'type', type: 'enum', required: true, options: [
      { value: 'house', label: 'House', color: '#6366f1' },
      { value: 'condo', label: 'Condo', color: '#0ea5e9' },
      { value: 'land', label: 'Land', color: '#f59e0b' },
      { value: 'commercial', label: 'Commercial', color: '#ec4899' },
    ] },
    { field: 'status', type: 'enum', required: true, options: [
      { value: 'available', label: 'Available', color: '#10b981' },
      { value: 'pending', label: 'Pending', color: '#f59e0b' },
      { value: 'sold', label: 'Sold', color: '#94a3b8' },
    ] },
    { field: 'price', type: 'number', label: 'Price ($)', min: 0 },
    { field: 'beds', type: 'number', label: 'Beds', min: 0 },
    { field: 'baths', type: 'number', label: 'Baths', min: 0 },
    { field: 'area', type: 'number', label: 'Area (sqft)', min: 0 },
    // Derived: list price per square foot (display-only).
    { field: 'pricePerSqft', type: 'number', label: 'Price / sqft ($)', readonly: true, formula: 'price / area' },
    { field: 'yearBuilt', type: 'number', label: 'Year built', min: 1800, max: 2100 },
    { field: 'zip', type: 'text', label: 'ZIP', input: { editorType: 'mask', mask: '#####' } },
    { field: 'city', type: 'text', label: 'City' },
    { field: 'amenities', type: 'text', label: 'Amenities', input: { editorType: 'chips', help: 'Pool, Garage, ...' } },
    { field: 'listingUrl', type: 'text', label: 'Listing', format: 'url', input: { placeholder: 'https://…' } },
  ],
}

const leads: EntitySchema = {
  name: 'leads',
  label: 'Lead',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', label: 'Lead name', required: true, minLength: 2 },
    { field: 'phone', type: 'text', input: { editorType: 'phone' } },
    { field: 'propertyId', type: 'relation', label: 'Property', relation: { entity: 'properties', foreignKey: 'propertyId', labelField: 'title' } },
    { field: 'agentId', type: 'relation', label: 'Agent', relation: { entity: 'agents', foreignKey: 'agentId', labelField: 'name' } },
    { field: 'stage', type: 'enum', required: true, options: [
      { value: 'new', label: 'New', color: '#94a3b8' },
      { value: 'touring', label: 'Touring', color: '#0ea5e9' },
      { value: 'offer', label: 'Offer', color: '#f59e0b' },
      { value: 'closed', label: 'Closed', color: '#10b981' },
      { value: 'lost', label: 'Lost', color: '#ef4444' },
    ] },
    { field: 'budget', type: 'number', label: 'Budget ($)', min: 0 },
    { field: 'score', type: 'number', label: 'Lead score', min: 0, max: 100, defaultValue: 50, input: { editorType: 'slider', help: 'Fit / intent score' } },
    { field: 'interests', type: 'text', label: 'Interests', input: { editorType: 'chips', help: 'Neighborhoods / features' } },
  ],
}

// Property grid formatting: type + status pills, plus price thresholds (entry-level
// listings red, luxury listings green + bold) - data-driven color, not just pills.
const propertyFormats: FormatRule[] = [
  ...statusPills(properties, 'type'),
  ...statusPills(properties, 'status'),
  { field: 'price', op: 'lt', value: 300000, color: '#dc2626' },
  { field: 'price', op: 'gte', value: 1000000, color: '#16a34a', bold: true },
]

// Lead grid formatting: stage pills, plus score thresholds (cold leads red, hot
// leads green + bold) and big-budget rows in bold.
const leadFormats: FormatRule[] = [
  ...statusPills(leads, 'stage'),
  { field: 'score', op: 'lt', value: 40, color: '#dc2626' },
  { field: 'score', op: 'gte', value: 80, color: '#16a34a', bold: true },
  { field: 'budget', op: 'gte', value: 1000000, bold: true },
]

const seed = {
  agents: [
    { id: 'ag1', name: 'Sam Rivera', email: 'sam@realty.com', phone: '+1 (415) 555-0201', license: 'CA-104822', rating: 5, active: true },
    { id: 'ag2', name: 'Jamie Chen', email: 'jamie@realty.com', phone: '+1 (650) 555-0202', license: 'CA-118934', rating: 4, active: true },
    { id: 'ag3', name: 'Priya Patel', email: 'priya@realty.com', phone: '+1 (212) 555-0203', license: 'NY-207651', rating: 4, active: true },
    { id: 'ag4', name: 'Diego Morales', email: 'diego@realty.com', phone: '+1 (305) 555-0204', license: 'FL-330487', rating: 3, active: true },
    { id: 'ag5', name: 'Nina Kovac', email: 'nina@realty.com', phone: '+1 (312) 555-0205', license: 'IL-415229', rating: 5, active: true },
  ],
  properties: [
    { id: 'pt1', title: 'Sunny Hill Villa', type: 'house', status: 'available', price: 875000, beds: 4, baths: 3, area: 3200, yearBuilt: 2015, zip: '78701', city: 'Austin', amenities: ['Pool', 'Garage', 'Garden'], listingUrl: 'https://realty.com/listings/pt1' },
    { id: 'pt2', title: 'Downtown Loft', type: 'condo', status: 'pending', price: 420000, beds: 2, baths: 2, area: 1150, yearBuilt: 2019, zip: '60601', city: 'Chicago', amenities: ['Gym', 'Doorman'], listingUrl: 'https://realty.com/listings/pt2' },
    { id: 'pt3', title: 'Riverside Acreage', type: 'land', status: 'available', price: 260000, beds: 0, baths: 0, area: 87120, yearBuilt: 2000, zip: '83702', city: 'Boise', amenities: ['Waterfront'], listingUrl: 'https://realty.com/listings/pt3' },
    { id: 'pt4', title: 'Market Street Office', type: 'commercial', status: 'sold', price: 1950000, beds: 0, baths: 4, area: 12000, yearBuilt: 1998, zip: '94103', city: 'San Francisco', amenities: ['Parking', 'Elevator'], listingUrl: 'https://realty.com/listings/pt4' },
    { id: 'pt5', title: 'Maple Court House', type: 'house', status: 'sold', price: 640000, beds: 3, baths: 2, area: 2100, yearBuilt: 2008, zip: '80203', city: 'Denver', amenities: ['Garage', 'Fireplace'], listingUrl: 'https://realty.com/listings/pt5' },
    { id: 'pt6', title: 'Harbor View Condo', type: 'condo', status: 'available', price: 510000, beds: 2, baths: 2, area: 1340, yearBuilt: 2021, zip: '98101', city: 'Seattle', amenities: ['Balcony', 'Gym', 'View'], listingUrl: 'https://realty.com/listings/pt6' },
    { id: 'pt7', title: 'Old Town Retail', type: 'commercial', status: 'pending', price: 1180000, beds: 0, baths: 2, area: 6800, yearBuilt: 1985, zip: '97205', city: 'Portland', amenities: ['Storefront', 'Parking'], listingUrl: 'https://realty.com/listings/pt7' },
  ],
  leads: [
    { id: 'ld1', name: 'Olivia Brooks', phone: '+1 (415) 555-0301', propertyId: 'pt1', agentId: 'ag1', stage: 'touring', budget: 900000, score: 78, interests: ['Downtown', 'Pool'] },
    { id: 'ld2', name: 'Marcus Reed', phone: '+1 (650) 555-0302', propertyId: 'pt2', agentId: 'ag2', stage: 'offer', budget: 430000, score: 88, interests: ['Loft', 'Gym'] },
    { id: 'ld3', name: 'Hannah Lee', phone: '+1 (208) 555-0303', propertyId: 'pt3', agentId: 'ag3', stage: 'new', budget: 250000, score: 42, interests: ['Land', 'Waterfront'] },
    { id: 'ld4', name: 'Trevor Nash', phone: '+1 (415) 555-0304', propertyId: 'pt4', agentId: 'ag1', stage: 'closed', budget: 1950000, score: 95, interests: ['Commercial'] },
    { id: 'ld5', name: 'Sofia Marin', phone: '+1 (305) 555-0305', propertyId: 'pt5', agentId: 'ag4', stage: 'lost', budget: 600000, score: 30, interests: ['Suburbs', 'Garage'] },
    { id: 'ld6', name: 'Ethan Walsh', phone: '+1 (206) 555-0306', propertyId: 'pt6', agentId: 'ag5', stage: 'touring', budget: 520000, score: 66, interests: ['View', 'Balcony'] },
    { id: 'ld7', name: 'Grace Kim', phone: '+1 (503) 555-0307', propertyId: 'pt7', agentId: 'ag2', stage: 'offer', budget: 1150000, score: 81, interests: ['Retail', 'Parking'] },
  ],
}

export const realEstate: SampleApp = {
  id: 'realestate',
  name: 'Real estate',
  description: 'Properties, agents and leads - sales + pipeline + agent dashboards (price KPI target, rating and lead-score gauges, type x status pivot, tabbed breakdown), filtered status-pill grids with row actions, master/detail, and rich edit forms (phone, license mask, rating, amenity chips, lead-score slider).',
  emoji: '\u{1F3E0}',
  accent: '#10b981',
  build: () => {
    const agentRows = pad(agents, seed.agents, 10)
    const agentPool = ids(agentRows)
    const propertyRows = pad(properties, seed.properties, 18)
    const propertyPool = ids(propertyRows)
    const leadRows = pad(leads, seed.leads, 60, { propertyId: propertyPool, agentId: agentPool })
    return project({
      title: 'Realty',
      brand: 'Realty',
      accent: '#10b981',
      preset: 'nord',
      footer: '© Realty Group',
      entities: [agents, properties, leads],
      seed: { agents: agentRows, properties: propertyRows, leads: leadRows },
      screens: [
        // Sales dashboard: listing KPIs (a total-value card with a $10M target), an
        // average-price gauge, a value-by-type bar, a status pie, a tabbed breakdown,
        // a type x status pivot, and a status-pill property grid with edit actions.
        dashScreen(properties, { id: 'overview', title: 'Sales', order: 0 }, [
          { kpi: 'Listings', reduce: 'count', span: 1 },
          { kpi: 'Total value', measure: 'price', reduce: 'sum', format: 'currency', target: 10000000, span: 1 },
          { kpi: 'Avg price', measure: 'price', reduce: 'avg', format: 'currency', span: 1 },
          { gauge: 'Avg price vs $1M', measure: 'price', reduce: 'avg', min: 0, max: 1000000, unit: '$', span: 1 },
          { chart: 'type', measure: 'price', reduce: 'sum', type: 'bar', span: 2 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { chart: 'type', reduce: 'count', type: 'bar', span: 2 },
          { tabs: [
            { label: 'Value by type', tiles: [{ chart: 'type', measure: 'price', reduce: 'sum', type: 'bar' }] },
            { label: 'Listings by status', tiles: [{ chart: 'status', reduce: 'count', type: 'bar' }] },
          ], span: 3 },
          { pivot: { rows: ['type'], cols: ['status'], measure: 'price', aggregate: 'sum' }, span: 3 },
          { grid: true, format: propertyFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Pipeline dashboard: budget + score KPIs, a lead-score gauge, stage
        // breakdowns, a stage filter, and a score-formatted status-pill lead grid.
        // Listings board: properties as cards in status columns (available/pending/sold).
        boardScreen(properties, { id: 'board', title: 'Listings', order: 1 }, { groupBy: 'status', titleField: 'title', badgeField: 'price', subtitleField: 'city', filter: ['type', 'status'], openScreen: 'property-detail' }),
        dashScreen(leads, { id: 'pipeline', title: 'Pipeline', order: 2 }, [
          { kpi: 'Leads', reduce: 'count', span: 1 },
          { kpi: 'Pipeline budget', measure: 'budget', reduce: 'sum', format: 'currency', span: 1 },
          { kpi: 'Avg score', measure: 'score', reduce: 'avg', span: 1 },
          { gauge: 'Avg lead score', measure: 'score', reduce: 'avg', min: 0, max: 100, span: 1 },
          { chart: 'stage', reduce: 'count', type: 'bar', span: 2 },
          { chart: 'stage', measure: 'budget', reduce: 'sum', type: 'pie', span: 1 },
          { filter: ['stage'], span: 3 },
          { grid: true, format: leadFormats, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Agents dashboard: roster KPIs, an average client-rating gauge (0-5), and a
        // per-agent rating leaderboard.
        dashScreen(agents, { id: 'ratings', title: 'Agents', order: 3 }, [
          { kpi: 'Agents', reduce: 'count', span: 1 },
          { kpi: 'Avg rating', measure: 'rating', reduce: 'avg', span: 1 },
          { gauge: 'Avg client rating', measure: 'rating', reduce: 'avg', min: 0, max: 5, span: 1 },
          { chart: 'name', measure: 'rating', reduce: 'avg', type: 'bar', span: 3 },
          { grid: true, summaries: true, rowActions: [{ kind: 'edit' }], span: 3 },
        ]),
        // Property detail: header (title + city + status pill + price/area tiles),
        // tabbed overview, and an Inquiries timeline of related leads.
        detailScreen(properties, { id: 'property-detail', title: 'Property detail', order: 4 }, {
          titleField: 'title', subtitleField: 'city', statusField: 'status',
          metricFields: ['price', 'area'],
          related: [{ entity: 'leads', foreignKey: 'propertyId', label: 'Inquiries', titleField: 'name', subtitleField: 'budget', statusField: 'stage' }],
        }),
        screen(agents, 'master-detail', { id: 'agent-book', title: 'Agent book', order: 5, child: leads, foreignKey: 'agentId' }),
        formScreen(properties, { id: 'properties', title: 'Properties', order: 6 }, undefined, { format: propertyFormats, summaries: true, rowActions: [{ kind: 'edit' }], rowLink: { screen: 'property-detail', sourceField: 'id', targetField: 'id' } }, ['type', 'status', 'city']),
        formScreen(leads, { id: 'leads', title: 'Leads', order: 7 }, undefined, { format: leadFormats, summaries: true, rowActions: [{ kind: 'edit' }] }, ['stage']),
      ],
    })
  },
}
