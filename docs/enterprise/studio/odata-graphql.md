# OData & GraphQL

Studio binds to OData and GraphQL the same way it binds to any API: implement the
[`ServerDataSource`](./data-binding.md) contract and translate the grid's request
(paging + `sortModel` + `filterModel`) into the query the service expects. The
grid, edit form, sorting, filtering, and pagination then work unchanged.

## OData

OData exposes a database as a REST API with `$top` / `$skip` / `$orderby` /
`$filter` / `$count`. Map the grid request to those parameters:

```ts
import type { ServerDataSource, ServerRequest } from '@svgrid/grid'

type Customer = { id: string; name: string; email: string }

export const customersSource: ServerDataSource<Customer> = {
  async getRows(req: ServerRequest) {
    const params = new URLSearchParams({
      $top: String(req.pageSize),
      $skip: String(req.startRow),
      $count: 'true',
    })
    const sort = req.sortModel[0]
    if (sort) params.set('$orderby', `${sort.id} ${sort.desc ? 'desc' : 'asc'}`)

    const clauses: string[] = []
    if (req.filterModel.global) clauses.push(`contains(name,'${req.filterModel.global}')`)
    for (const [field, f] of Object.entries(req.filterModel.columns ?? {})) {
      if (f.value) clauses.push(`contains(${field},'${f.value}')`)
    }
    if (clauses.length) params.set('$filter', clauses.join(' and '))

    const res = await fetch(`/odata/Customers?${params}`)
    const body = await res.json()
    return { rows: body.value, rowCount: body['@odata.count'] }
  },

  createRow: (input) =>
    fetch('/odata/Customers', { method: 'POST', body: JSON.stringify(input) }).then((r) => r.json()),
  updateRow: (id, patch) =>
    fetch(`/odata/Customers(${id})`, { method: 'PATCH', body: JSON.stringify(patch) }).then((r) => r.json()),
  deleteRow: (id) =>
    fetch(`/odata/Customers(${id})`, { method: 'DELETE' }).then(() => undefined),
}
```

`@odata.count` gives the total for the pager. Build `$filter` from the operator
in each column filter (`contains`, `eq`, `gt`, `lt`, `ge`, `le`) to support the
grid's full filter UI.

## GraphQL

Run a paged query and map `sortModel` / `filterModel` to its variables:

```ts
export const customersSource: ServerDataSource<Customer> = {
  async getRows(req) {
    const query = `
      query Customers($limit: Int!, $offset: Int!, $orderBy: [CustomerOrderBy!], $where: CustomerFilter) {
        customers(limit: $limit, offset: $offset, orderBy: $orderBy, where: $where) { id name email }
        customersAggregate(where: $where) { count }
      }`
    const variables = {
      limit: req.pageSize,
      offset: req.startRow,
      orderBy: req.sortModel.map((s) => ({ [s.id]: s.desc ? 'DESC' : 'ASC' })),
      where: req.filterModel.global ? { name: { contains: req.filterModel.global } } : undefined,
    }
    const res = await fetch('/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
    const { data } = await res.json()
    return { rows: data.customers, rowCount: data.customersAggregate.count }
  },

  createRow: (input) => runMutation('createCustomer', input),
  updateRow: (id, patch) => runMutation('updateCustomer', { id, ...patch }),
  deleteRow: (id) => runMutation('deleteCustomer', { id }).then(() => undefined),
}
```

Always return the **total count** (an aggregate query) alongside the page so the
native pagination footer is accurate.

## Wire it up

Both return a `ServerDataSource`, so the rest is identical to every other
binding - hand it to `createServerDataSource` and render the grid in server mode
(see [Data binding](./data-binding.md)).

## See also

- [REST & custom APIs](./rest-api.md) - the general pattern
- [Data binding](./data-binding.md) - the `ServerDataSource` contract
