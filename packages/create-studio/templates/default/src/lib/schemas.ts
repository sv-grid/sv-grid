/**
 * One EntitySchema per entity drives everything: the grid columns, the edit
 * form (with validation), and - when you scaffold from a real database - the
 * generated code. Add a field here and it shows up in the grid and the form.
 */
import type { EntitySchema } from '@svgrid/enterprise'

export type Customer = {
  id: string
  name: string
  email: string
  tier: string
  mrr: number
  active: boolean
}

export type Order = {
  id: string
  ref: string
  customerId: string
  customer?: string // resolved customer name, for the grid (see data.ts)
  amount: number
  status: string
}

export const customerSchema: EntitySchema<Customer> = {
  name: 'customers',
  label: 'Customer',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true, hidden: { form: true } },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', label: 'Email', required: true, format: 'email' },
    { field: 'tier', type: 'enum', options: [
      { value: 'free', label: 'Free' },
      { value: 'pro', label: 'Pro' },
      { value: 'enterprise', label: 'Enterprise' },
    ] },
    { field: 'mrr', type: 'number', label: 'MRR ($)', min: 0 },
    { field: 'active', type: 'boolean' },
  ],
}

export const orderSchema: EntitySchema<Order> = {
  name: 'orders',
  label: 'Order',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true, hidden: { form: true } },
    { field: 'ref', type: 'text', label: 'Reference', required: true },
    // A foreign key: a searchable Customer picker in the form, the name in the grid.
    { field: 'customerId', type: 'relation', label: 'Customer', relation: { entity: 'customers', labelField: 'name' }, hidden: { grid: true } },
    { field: 'customer', type: 'text', label: 'Customer', readonly: true, hidden: { form: true } },
    { field: 'amount', type: 'number', label: 'Amount ($)', min: 0 },
    { field: 'status', type: 'enum', options: [
      { value: 'draft', label: 'Draft' },
      { value: 'paid', label: 'Paid' },
      { value: 'refunded', label: 'Refunded' },
    ] },
  ],
}
