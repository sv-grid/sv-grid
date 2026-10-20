<script lang="ts">
  import {
    createSvelteTable,
    createColumnHelper,
    FlexRender,
    tableFeatures,
    rowSortingFeature,
    rowPaginationFeature,
    rowSelectionFeature,
  } from '@tanstack/svelte-table'
  import type { SortingState, RowSelectionState } from '@tanstack/svelte-table'
  import type { Payment } from './payments'

  let { data }: { data: Payment[] } = $props()

  const features = tableFeatures({ rowSortingFeature, rowPaginationFeature, rowSelectionFeature })
  const columnHelper = createColumnHelper<typeof features, Payment>()

  const columns = columnHelper.columns([
    columnHelper.accessor('id', { header: 'ID', size: 90 }),
    columnHelper.accessor('email', { header: 'Email', size: 240 }),
    columnHelper.accessor('status', { header: 'Status', enableSorting: false }),
    columnHelper.accessor((row) => (row.amount / 100).toFixed(2), { id: 'amount', header: 'Amount' }),
  ])

  let sorting = $state<SortingState>([])
  let rowSelection = $state<RowSelectionState>({})

  const table = createSvelteTable({
    features,
    columns,
    get data() {
      return data
    },
    state: {
      get sorting() {
        return sorting
      },
      get rowSelection() {
        return rowSelection
      },
    },
    onSortingChange: (updater) => {
      sorting = typeof updater === 'function' ? updater(sorting) : updater
    },
    onRowSelectionChange: (updater) => {
      rowSelection = typeof updater === 'function' ? updater(rowSelection) : updater
    },
  })
</script>

<table>
  <thead>
    {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
      <tr>
        {#each headerGroup.headers as header (header.id)}
          <th>
            {#if !header.isPlaceholder}
              <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
            {/if}
          </th>
        {/each}
      </tr>
    {/each}
  </thead>
  <tbody>
    {#each table.getRowModel().rows as row (row.id)}
      <tr>
        {#each row.getAllCells() as cell (cell.id)}
          <td>
            <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>
