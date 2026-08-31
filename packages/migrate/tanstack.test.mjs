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
