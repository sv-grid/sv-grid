import { test, expect, describe } from 'vitest'
import { migrateTanstack } from './tanstack.mjs'

/** A columns.ts of the shape the shadcn-svelte data-table docs generate. */
const COLUMNS_TS = `import type { ColumnDef } from '@tanstack/table-core'
import { renderComponent } from '$lib/components/ui/data-table'
import DataTableEmailButton from './data-table-email-button.svelte'

export type Payment = { id: string; amount: number; status: string; email: string }

export const columns: ColumnDef<Payment>[] = [
  { accessorKey: 'status', header: 'Status', size: 130 },
  {
    accessorKey: 'email',
    header: ({ column }) => renderComponent(DataTableEmailButton, { onclick: column.getToggleSortingHandler() }),
  },
  { accessorKey: 'amount', header: 'Amount', enableSorting: false, meta: { align: 'right' } },
  { accessorFn: (row) => row.id, id: 'payment', header: 'Payment ID' },
]
`

const PAGE_SVELTE = `<script lang="ts">
  import { createSvelteTable, FlexRender } from '@tanstack/svelte-table'
  import { tableFeatures, rowSortingFeature, columnFilteringFeature, rowPaginationFeature, rowSelectionFeature } from '@tanstack/table-core'
  import * as Table from '$lib/components/ui/table'
  import { columns } from './columns'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
    rowSelectionFeature,
  })

  let { data } = $props()
  let sorting = $state([])
  let columnFilters = $state([])
  let rowSelection = $state({})

  const table = createSvelteTable({
    get data() { return data },
    columns,
    features,
    state: { pageSize: 10 },
    onSortingChange: (u) => (sorting = u),
  })
</script>

<Table.Root>
  <Table.Header>
    {#each table.getHeaderGroups() as hg}
      <Table.Row>{#each hg.headers as h}<Table.Head>x</Table.Head>{/each}</Table.Row>
    {/each}
  </Table.Header>
  <Table.Body>
    {#each table.getRowModel().rows as row}
      <Table.Row>y</Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
`

describe('migrateTanstack - columns module', () => {
  const out = migrateTanstack(COLUMNS_TS, { svelte: false })

  test('applies', () => {
    expect(out.applicable).toBe(true)
  })

  test('accessorKey becomes field', () => {
    expect(out.code).toContain("field: 'status'")
    expect(out.code).toContain("field: 'email'")
    expect(out.code).not.toContain('accessorKey')
  })

  test('accessorFn becomes fieldFn and keeps the explicit id', () => {
    expect(out.code).toContain('fieldFn: (row) => row.id')
    expect(out.code).toContain("id: 'payment'")
  })

  test('size becomes width', () => {
    expect(out.code).toContain('width: 130')
    expect(out.code).not.toContain('size: 130')
  })

  test('enableSorting becomes sortable', () => {
    expect(out.code).toContain('sortable: false')
  })

  test('meta is dropped, and said so', () => {
    expect(out.code).not.toContain('meta:')
    expect(out.warnings.join(' ')).toMatch(/`meta` has no SvGrid equivalent/)
  })

  test('the TanStack import is re-pointed at @svgrid/grid', () => {
    expect(out.code).toContain("from '@svgrid/grid'")
    expect(out.code).not.toContain('@tanstack/table-core')
  })

  test('a header render function is kept, with a warning', () => {
    expect(out.code).toContain('renderComponent(DataTableEmailButton')
    expect(out.warnings.join(' ')).toMatch(/header. render function was kept/)
  })
})

describe('migrateTanstack - component', () => {
  const out = migrateTanstack(PAGE_SVELTE)

  test('applies', () => {
    expect(out.applicable).toBe(true)
  })

  test('emits an SvGrid element carrying the feature-implied props', () => {
    expect(out.code).toContain('<SvGrid')
    expect(out.code).toContain('{data}')
    expect(out.code).toContain('{columns}')
    expect(out.code).toContain('{features}')
    expect(out.code).toContain('sortable')
    expect(out.code).toContain('showRowSelection')
    expect(out.code).toContain('pageable')
  })

  test('carries the page size over', () => {
    expect(out.code).toContain('pageSize={10}')
  })

  test('deletes the Table.Root markup and its each-blocks', () => {
    expect(out.code).not.toContain('Table.Root')
    expect(out.code).not.toContain('getHeaderGroups')
    expect(out.code).not.toContain('getRowModel')
  })

  test('drops the state that SvGrid owns', () => {
    expect(out.code).not.toContain('let sorting')
    expect(out.code).not.toContain('let columnFilters')
    expect(out.code).not.toContain('let rowSelection')
  })

  test('drops the createSvelteTable call', () => {
    expect(out.code).not.toContain('createSvelteTable')
  })

  test('keeps the features object, because SvGrid exports the same names', () => {
    expect(out.code).toContain('tableFeatures({')
    expect(out.code).toContain('rowSortingFeature')
  })

  test('re-points both TanStack imports', () => {
    expect(out.code).not.toContain('@tanstack/')
  })
})

describe('migrateTanstack - guards', () => {
  test('ignores a file that never mentions TanStack', () => {
    const out = migrateTanstack('<script>\n  let x = 1\n</script>\n<p>{x}</p>\n')
    expect(out.applicable).toBe(false)
  })

  test('warns about a feature it does not know', () => {
    const src = `import { tableFeatures, rowPinningFeature } from '@tanstack/table-core'
const features = tableFeatures({ rowPinningFeature })
`
    const out = migrateTanstack(src, { svelte: false })
    expect(out.warnings.join(' ')).toMatch(/Unrecognised feature .rowPinningFeature./)
  })
})

/**
 * The `createColumnHelper()` style, which the TanStack docs lead with.
 *
 * This went unrecognised for two releases. `rewriteColumn` took the first `{`
 * in the entry - the OPTIONS object - so `helper.accessor('id', { header: 'ID' })`
 * came out as `{ header: 'ID' }`: the right headers over entirely blank columns,
 * no warning, and a `createColumnHelper` import re-pointed at `@svgrid/grid`,
 * which has no such export, so the file did not even compile.
 */
const HELPER_TS = `import { createColumnHelper } from '@tanstack/table-core'

export type Person = { id: number; first: string; last: string; team: string }

const columnHelper = createColumnHelper<Person>()

export const columns = [
  columnHelper.accessor('id', { header: 'ID', size: 70 }),
  columnHelper.accessor('team', { header: 'Team', enableSorting: false }),
  columnHelper.accessor((row) => row.first + ' ' + row.last, { id: 'full', header: 'Full name' }),
  columnHelper.display({ id: 'actions', header: '' }),
  columnHelper.group({ header: 'Name', columns: [columnHelper.accessor('first', { header: 'First' })] }),
]
`

describe('migrateTanstack - createColumnHelper columns', () => {
  const out = migrateTanstack(HELPER_TS, { svelte: false })

  test('applies', () => {
    expect(out.applicable).toBe(true)
  })

  test('accessor(key) keeps the field, not just the header', () => {
    // The exact regression: the field must survive, or the column renders blank.
    expect(out.code).toContain("field: 'id'")
    expect(out.code).toContain("header: 'ID'")
    expect(out.code).toContain("field: 'team'")
  })

  test('accessor options are mapped like any other column', () => {
    expect(out.code).toContain('width: 70')
    expect(out.code).toContain('sortable: false')
    expect(out.code).not.toContain('enableSorting')
    expect(out.code).not.toContain('size: 70')
  })

  test('accessor(fn) becomes fieldFn and keeps its id', () => {
    expect(out.code).toContain('fieldFn: (row) => row.first')
    expect(out.code).toContain("id: 'full'")
  })

  test('display() carries its options through', () => {
    expect(out.code).toContain("id: 'actions'")
  })

  test('group() recurses into its children', () => {
    expect(out.code).toContain("header: 'Name'")
    expect(out.code).toContain("field: 'first'")
  })

  test('no helper call survives in the output', () => {
    expect(out.code).not.toContain('.accessor(')
    expect(out.code).not.toContain('.display(')
    expect(out.code).not.toContain('.group(')
  })

  test('the helper import and its declaration are removed', () => {
    // `@svgrid/grid` has no `createColumnHelper`, so leaving either behind
    // produces a file that cannot resolve its own import.
    expect(out.code).not.toContain('createColumnHelper')
    expect(out.code).not.toContain('columnHelper')
    expect(out.code).not.toContain('@tanstack/')
  })

  test('warns when a computed accessor has no id to identify it', () => {
    const src = `import { createColumnHelper } from '@tanstack/table-core'
const h = createColumnHelper()
export const columns = [h.accessor((row) => row.last, { header: 'Last' })]
`
    const out = migrateTanstack(src, { svelte: false })
    expect(out.warnings.join(' ')).toMatch(/has no .id./)
  })
})

/**
 * What the emitted `<SvGrid ... />` is allowed to name.
 *
 * It used to name `{data} {columns} {features}` unconditionally. A component
 * with no `tableFeatures(...)` - the plain TanStack setup, as opposed to the
 * shadcn one - therefore got `{features}` referring to nothing, and the file the
 * codemod handed back did not compile. A codemod producing broken code is the
 * one outcome it cannot have.
 */
describe('migrateTanstack - the emitted SvGrid tag only names what exists', () => {
  const tagOf = (src) => (migrateTanstack(src).code.match(/<SvGrid[^>]*\/>/) || [''])[0]

  const NO_FEATURES = `<script lang="ts">
  import { createTable, getCoreRowModel } from '@tanstack/svelte-table'
  let { data } = $props()
  const columns = [{ accessorKey: 'id', header: 'ID' }]
  const table = createTable({ data, columns, getCoreRowModel: getCoreRowModel() })
</script>`

  const WITH_FEATURES = `<script lang="ts">
  import { createSvelteTable } from '@tanstack/svelte-table'
  import { tableFeatures, rowSortingFeature } from '@tanstack/table-core'
  const features = tableFeatures({ rowSortingFeature })
  let { data } = $props()
  const columns = [{ accessorKey: 'id', header: 'ID' }]
  const table = createSvelteTable({ data, columns, features })
</script>`

  const IMPORTED = `<script lang="ts">
  import { createSvelteTable } from '@tanstack/svelte-table'
  import { features } from './data-table-features'
  import { columns } from './columns'
  let { data } = $props()
  const table = createSvelteTable({ data, columns, features })
</script>`

  test('omits {features} when the component has none', () => {
    const tag = tagOf(NO_FEATURES)
    expect(tag).toContain('{data}')
    expect(tag).toContain('{columns}')
    expect(tag).not.toContain('{features}')
  })

  test('keeps {features} when it is declared in the body', () => {
    expect(tagOf(WITH_FEATURES)).toContain('{features}')
  })

  test('keeps {features} when it is imported, as the shadcn layout does', () => {
    expect(tagOf(IMPORTED)).toContain('{features}')
  })

  test('recognises a $props() destructure as a binding', () => {
    // `let { data } = $props()` is how a Svelte 5 component receives rows, and
    // reading it as "data is undeclared" would warn on almost every real file.
    const out = migrateTanstack(NO_FEATURES)
    expect(out.warnings.join(' ')).not.toMatch(/`data` is not declared/)
  })

  test('warns when nothing binds a required prop', () => {
    const orphan = `<script lang="ts">
  import { createTable, getCoreRowModel } from '@tanstack/svelte-table'
  const table = createTable({ data: [], columns: [], getCoreRowModel: getCoreRowModel() })
</script>`
    const out = migrateTanstack(orphan)
    expect(out.warnings.join(' ')).toMatch(/`data` is not declared/)
    expect(out.warnings.join(' ')).toMatch(/`columns` is not declared/)
  })
})
