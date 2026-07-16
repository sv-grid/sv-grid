<script lang="ts">
  import { SvGrid, createServerDataSource, type ServerState } from '@svgrid/grid'
  import { schemaToColumns, SvGridEditPanel } from '@svgrid/enterprise'
  import { customersSchema, type Customers } from '$lib/schemas'
  import { customersSource, nextId } from '$lib/data'

  const idField = customersSchema.idField ?? 'id'
  let view = $state<ServerState<Customers>>({ rows: [], total: 0, loading: false, saving: false, error: null, pageIndex: 0, pageSize: 10, pageCount: 1, sortModel: [], filterModel: {} })
  const controller = createServerDataSource<Customers>(customersSource, { pageSize: 10, optimistic: true, getRowId: (r) => String((r as Record<string, unknown>)[idField]), onChange: (s) => (view = s) })
  $effect(() => { controller.refresh(); return () => controller.dispose() })

  const columns_grid_1 = (() => { const all = schemaToColumns(customersSchema); return ['id', 'name', 'mrr'].map((f) => all.find((c) => c.field === f)).filter((c): c is (typeof all)[number] => !!c).map((c) => ({ ...c, editable: false })) })()

  let editing = $state<Customers | null | undefined>(undefined)
  async function save({ mode, id, values }: { mode: 'create' | 'edit'; id: string | null; values: Partial<Customers> }) {
    if (mode === 'create') { await controller.createRow({ [idField]: nextId('c'), ...values } as Partial<Customers>); controller.setPage(view.pageCount - 1) }
    else if (id) { await controller.updateRow(id, values) }
    editing = undefined
  }
</script>

<h1 class="st__title">Customer</h1>

<div class="st__toolbar">
  <button class="st-btn st-btn--primary" onclick={() => (editing = null)}>+ New Customer</button>
</div>

<div class="screen" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; align-items: start;">
    <div style="grid-column: span 3; min-width: 0">
      <SvGrid
        data={view.rows}
        columns={columns_grid_1}
        loading={view.loading}
        loadingOverlay
        fitColumns
        enableRowSummaries={false}
        showRowSelection
        sortable
        externalSort
        onSortingChange={(s) => controller.setSort(s)}
        onRowDoubleClick={(e) => (editing = e.row)}
        showPagination
        externalPagination
        rowCount={view.total}
        pageIndex={view.pageIndex}
        pageSize={view.pageSize}
        onPaginationChange={({ pageIndex, pageSize }) => (pageSize !== view.pageSize ? controller.setPageSize(pageSize) : controller.setPage(pageIndex))}
        paginationPosition="both"
        pageSizeOptions={[20, 40, 80]}
        containerHeight={360}
      />
    </div>
</div>

{#if editing !== undefined}
  <SvGridEditPanel schema={customersSchema} row={editing} presentation="modal" persistKey="customers" onSubmit={save} onCancel={() => (editing = undefined)} />
{/if}
