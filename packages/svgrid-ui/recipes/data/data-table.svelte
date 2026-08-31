<script lang="ts">
  // SvGrid - a sortable, filterable, paginated data table with row selection.
  // Your copy, edit freely. Docs: https://svgrid.com/docs/getting-started/
  //
  // Everything below is declared, not wired. There is no sort handler, no
  // filter state, no page-index variable and no {#each} - the grid owns them.
  // Column visibility lives in the header column menu ("Choose columns").
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'
  // Match your design system. Swap for tailwind / material / fluent, or drop
  // the import and set the --sg-* custom properties yourself.
  import '@svgrid/grid/themes/shadcn.css'

  type Payment = {
    id: string
    status: 'pending' | 'processing' | 'success' | 'failed'
    email: string
    amount: number
  }

  // Register only the features this table uses - the rest is tree-shaken out.
  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
    rowSelectionFeature,
  })

  const data: Payment[] = [
    { id: 'm5gr84i9', status: 'success', email: 'ken99@example.com', amount: 316 },
    { id: '3u1reuv4', status: 'success', email: 'abe45@example.com', amount: 242 },
    { id: 'derv1ws0', status: 'processing', email: 'monserrat44@example.com', amount: 837 },
    { id: '5kma53ae', status: 'success', email: 'silas22@example.com', amount: 874 },
    { id: 'bhqecj4p', status: 'failed', email: 'carmella@example.com', amount: 721 },
    { id: 'p9x2llqz', status: 'pending', email: 'noor@example.com', amount: 158 },
  ]

  const columns: ColumnDef<typeof features, Payment>[] = [
    { field: 'status', header: 'Status', width: 130, cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }) },
    { field: 'email', header: 'Email' },
    { field: 'amount', header: 'Amount', width: 140, format: { type: 'currency', currency: 'USD' } },
    // Starts hidden but stays listed in "Choose columns" for the user to re-enable.
    { field: 'id', header: 'Payment ID', width: 140, visible: false },
    { id: 'actions', header: '', width: 60, sortable: false, filterable: false, cell: (ctx) => renderSnippet(RowActions, { row: ctx.row.original }) },
  ]

  const copyId = (id: string) => navigator.clipboard?.writeText(id)
</script>

{#snippet StatusCell(props: { row: Payment })}
  <span class="dt-status" data-status={props.row.status}>{props.row.status}</span>
{/snippet}

{#snippet RowActions(props: { row: Payment })}
  <button class="dt-actions" title="Copy payment ID" onclick={() => copyId(props.row.id)}>
    &#8942;
  </button>
{/snippet}

<SvGrid
  {data}
  {columns}
  {features}
  sortable
  filterable
  showGlobalFilter
  showRowSelection
  pageable
  showPagination
  pageSize={5}
  fitColumns
  enableRowSummaries={false}
/>

<style>
  .dt-status {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--sg-border, #e4e4e7);
    border-radius: 9999px;
    padding: 0 0.5rem;
    font-size: 0.75rem;
    line-height: 1.25rem;
    text-transform: capitalize;
  }
  .dt-status[data-status='success'] { color: #15803d; border-color: #86efac; }
  .dt-status[data-status='failed'] { color: #b91c1c; border-color: #fca5a5; }
  .dt-status[data-status='processing'] { color: #a16207; border-color: #fde047; }

  .dt-actions {
    background: none;
    border: 0;
    cursor: pointer;
    color: inherit;
    font-size: 1rem;
    line-height: 1;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
  }
  .dt-actions:hover { background: var(--sg-row-hover-bg, rgba(0, 0, 0, 0.05)); }
</style>
