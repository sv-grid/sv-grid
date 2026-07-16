/**
 * Data sources. This starter runs on seeded in-memory sources, so it works with
 * no backend. To point an entity at a real database, swap `createInMemoryDataSource`
 * for `createSqlDataSource` / `createSupabaseDataSource` (or scaffold a connected
 * one with `npx @svgrid/studio add <table> --db postgres --url ...`) - the grid,
 * form, sorting, filtering, and paging keep working unchanged.
 */
import {
  createInMemoryDataSource,
  createRelationLookup,
  type ServerDataSource,
} from '@svgrid/enterprise'
import { customerSchema, orderSchema, type Customer, type Order } from './schemas'

const customerSeed: Customer[] = [
  { id: 'c1', name: 'Ada Lovelace', email: 'ada@analytic.io', tier: 'enterprise', mrr: 1200, active: true },
  { id: 'c2', name: 'Alan Turing', email: 'alan@bletchley.uk', tier: 'pro', mrr: 240, active: true },
  { id: 'c3', name: 'Grace Hopper', email: 'grace@navy.mil', tier: 'enterprise', mrr: 980, active: true },
  { id: 'c4', name: 'Linus Torvalds', email: 'linus@kernel.org', tier: 'pro', mrr: 360, active: true },
  { id: 'c5', name: 'Barbara Liskov', email: 'barbara@substitution.dev', tier: 'free', mrr: 0, active: false },
]

const orderSeed: Order[] = [
  { id: 'o1', ref: 'INV-1001', customerId: 'c1', amount: 1200, status: 'paid' },
  { id: 'o2', ref: 'INV-1002', customerId: 'c2', amount: 240, status: 'paid' },
  { id: 'o3', ref: 'INV-1003', customerId: 'c1', amount: 300, status: 'draft' },
  { id: 'o4', ref: 'INV-1004', customerId: 'c3', amount: 980, status: 'refunded' },
]

export const customersSource = createInMemoryDataSource(customerSeed, customerSchema)

// Orders reference a customer. Enrich every method's rows with the customer
// NAME so the grid shows it (the form stores the id via the lookup below).
const nameById = () => new Map((customersSource.rows() as Customer[]).map((c) => [c.id, c.name]))
const withCustomer = (r: Order): Order => ({ ...r, customer: nameById().get(r.customerId) ?? '' })
const rawOrders = createInMemoryDataSource(orderSeed, orderSchema)
export const ordersSource: ServerDataSource<Order> = {
  ...rawOrders,
  async getRows(req) {
    const res = await rawOrders.getRows(req)
    return { ...res, rows: res.rows.map(withCustomer) }
  },
  createRow: (input) => rawOrders.createRow(input).then(withCustomer),
  updateRow: (id, patch) => rawOrders.updateRow(id, patch).then(withCustomer),
}

// A searchable Customer picker for the order form.
export const customerLookup = createRelationLookup<Customer>({
  source: customersSource,
  schema: customerSchema,
  labelField: 'name',
})

let seq = customerSeed.length + orderSeed.length
export const nextId = (prefix: string) => `${prefix}${++seq}`
