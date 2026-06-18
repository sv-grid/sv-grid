<script lang="ts">
  // FlexRender in its real habitat: a hand-built layout on top of the headless
  // createSvGrid engine. There is no <SvGrid> here - we own the markup and use
  // FlexRender to turn each column's `header` / `cell` definition into DOM. The
  // Status column is a snippet renderer; the rest are plain values. Click a
  // header to sort: the headless engine recomputes and the custom table reacts.
  import {
    createSvGrid,
    createCoreRowModel,
    createSortedRowModel,
    tableFeatures,
    rowSortingFeature,
    sortFns,
    FlexRender,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'
  import { makeOrders, type Order } from './seed'

  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'customer', header: 'Customer' },
    { field: 'region', header: 'Region' },
    { field: 'qty', header: 'Qty' },
    // Custom renderer -> FlexRender dispatches the snippet below.
    { field: 'status', header: 'Status',
      cell: (ctx) => renderSnippet(StatusPill, { value: ctx.getValue() as string }) },
  ]

  const grid = createSvGrid({
    _features: features,
    _rowModels: {
      coreRowModel: createCoreRowModel(),
      sortedRowModel: createSortedRowModel(sortFns),
    },
    columns,
    data: makeOrders(10),
  })

  const headerGroups = $derived(grid.getHeaderGroups())
  const rows = $derived(grid.getRowModel().rows)
</script>

{#snippet StatusPill(p: { value: string })}
  <span
    class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
    style:background={
      p.value === 'delivered' ? 'rgba(34,197,94,0.15)'
      : p.value === 'shipped' ? 'rgba(59,130,246,0.15)'
      : p.value === 'cancelled' ? 'rgba(239,68,68,0.15)'
      : 'rgba(234,179,8,0.15)'}
    style:color={
      p.value === 'delivered' ? '#16a34a'
      : p.value === 'shipped' ? '#3b82f6'
      : p.value === 'cancelled' ? '#ef4444'
      : '#ca8a04'}
  >{p.value}</span>
{/snippet}

<div class="fr-wrap">
  <table class="fr-table">
    <thead>
      {#each headerGroups as hg (hg.id)}
        <tr>
          {#each hg.headers as header (header.id)}
            {@const sorted = header.column.getIsSorted()}
            <th
              class="fr-th"
              class:fr-sortable={header.column.getCanSort()}
              onclick={header.column.getToggleSortingHandler()}
            >
              <!-- header is a HeaderContext template; FlexRender's prop is the
                   header|cell union, so the narrowed type needs a cast. -->
              <FlexRender content={header.column.columnDef.header as never} context={header.getContext()} />
              {#if sorted === 'asc'}<span class="fr-arrow">▲</span>
              {:else if sorted === 'desc'}<span class="fr-arrow">▼</span>{/if}
            </th>
          {/each}
        </tr>
      {/each}
    </thead>
    <tbody>
      {#each rows as row (row.id)}
        <tr class="fr-tr">
          {#each row.getAllCells() as cell (cell.id)}
            <td class="fr-td">
              {#if cell.column.columnDef.cell}
                <FlexRender content={cell.column.columnDef.cell as never} context={cell.getContext()} />
              {:else}
                {cell.getValue()}
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<p class="mt-2 text-xs" style="color: var(--sg-muted);">
  No <code>&lt;SvGrid&gt;</code> here - this table is hand-built on
  <code>createSvGrid</code>. <code>FlexRender</code> renders each header from
  <code>columnDef.header</code> and each Status cell from its
  <code>renderSnippet</code> config; plain columns fall back to
  <code>cell.getValue()</code>. Click a header to sort.
</p>

<style>
  .fr-wrap { overflow-x: auto; border: 1px solid var(--sg-border); border-radius: 10px; }
  .fr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .fr-th {
    text-align: left;
    padding: 8px 12px;
    background: var(--sg-header-bg);
    color: var(--sg-fg);
    font-weight: 600;
    border-bottom: 1px solid var(--sg-border);
    white-space: nowrap;
    user-select: none;
  }
  .fr-sortable { cursor: pointer; }
  .fr-sortable:hover { background: var(--sg-row-hover-bg); }
  .fr-arrow { font-size: 9px; opacity: 0.7; margin-left: 2px; }
  .fr-td { padding: 7px 12px; color: var(--sg-fg); border-bottom: 1px solid var(--sg-border); }
  .fr-tr:hover { background: var(--sg-row-hover-bg); }
</style>
