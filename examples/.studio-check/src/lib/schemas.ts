/**
 * Generated from your schema by `npm create @svgrid/studio --from`. Each
 * EntitySchema drives the grid columns, the edit form, and validation. Add a
 * field here (and to its type) and it shows up in the grid and the form.
 */
import type { EntitySchema } from '@svgrid/enterprise'

export type Customers = {
  id: string
  name: string
  mrr: number
}

export const customersSchema: EntitySchema<Customers> = {
  "name": "customers",
  "label": "Customer",
  "idField": "id",
  "fields": [
    {
      "field": "id",
      "type": "text",
      "primaryKey": true
    },
    {
      "field": "name",
      "type": "text"
    },
    {
      "field": "mrr",
      "type": "number"
    }
  ]
}
