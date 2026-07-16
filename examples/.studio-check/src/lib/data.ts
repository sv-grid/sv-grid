/**
 * Data sources. Each entity binds to its own backend - in-memory (seeded), a
 * REST endpoint, a SQL table, or Supabase. In-memory entities run with no setup;
 * SQL / Supabase entities read their connection from `./connections`.
 */
import { createInMemoryDataSource } from '@svgrid/enterprise'
import { customersSchema, type Customers } from './schemas'

const customersStore = createInMemoryDataSource<Customers>([{"id":"c1","name":"Ada","mrr":25},{"id":"c2","name":"Alan","mrr":50},{"id":"c3","name":"Grace","mrr":75},{"id":"c4","name":"Linus","mrr":100},{"id":"c5","name":"Barbara","mrr":125},{"id":"c6","name":"Katherine","mrr":150}], customersSchema)

// Grids show the related label (not the raw id) via withRelationLabels.
export const customersSource = customersStore

// New-row ids continue after the seeded rows.
let seq = 6
export const nextId = (prefix: string) => `${prefix}${++seq}`
