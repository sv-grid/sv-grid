<script lang="ts" module>
  type Row = Record<string, unknown>
</script>

<script lang="ts" generics="T extends Row">
  /**
   * A full CRUD screen for one entity: grid + create/edit modal + multi-select
   * delete, over a ServerDataSource. Driven entirely by the EntitySchema.
   */
  import { SvGrid, createServerDataSource, type ServerState, type ServerDataSource } from '@svgrid/grid'
  import { SvGridEditPanel, schemaToColumns, type EntitySchema, type RelationLookup } from '@svgrid/enterprise'

  let { schema, source, lookups, newId }: {
    schema: EntitySchema<T>
    source: ServerDataSource<T>
    lookups?: Record<string, RelationLookup>
    newId: () => string
  } = $props()

  const idField = schema.idField ?? 'id'
  const columns = schemaToColumns(schema)

  let view = $state<ServerState<T>>({
    rows: [], total: 0, loading: false, saving: false, error: null,
    pageIndex: 0, pageSize: 10, pageCount: 1, sortModel: [], filterModel: {},
  })
  const controller = createServerDataSource<T>(source, {
    pageSize: 10, optimistic: true, getRowId: (r) => String(r[idField]), onChange: (s) => (view = s),
  })
  $effect(() => {
    controller.refresh()
    return () => controller.dispose()
  })

  let editing = $state<T | null | undefined>(undefined)
  let selected = $state<T[]>([])

  async function save({ mode, id, values }: { mode: 'create' | 'edit'; id: string | null; values: Partial<T> }) {
    if (mode === 'create') {
      await controller.createRow({ [idField]: newId(), ...values } as Partial<T>)
      controller.setPage(view.pageCount - 1)
    } else if (id) {
      await controller.updateRow(id, values)
    }
    editing = undefined
  }
  async function removeSelected() {
    for (const row of selected) await controller.deleteRow(String(row[idField]))
    selected = []
  }
</script>

<div class="st__toolbar">
  <button class="st-btn st-btn--primary" onclick={() => (editing = null)}>+ New {schema.label ?? schema.name}</button>
  <button class="st-btn" disabled={selected.length === 0} onclick={removeSelected}>
    Delete{selected.length ? ` (${selected.length})` : ''}
  </button>
  <span class="st-hint">Double-click a row to edit</span>
</div>

<SvGrid
  data={view.rows}
  {columns}
  loading={view.loading}
  fitColumns
  enableRowSummaries={false}
  showRowSelection
  sortable
  externalSort
  onSortingChange={(s) => controller.setSort(s)}
  filterable
  filterMode="row"
  showGlobalFilter
  externalFilter
  onFiltersChange={(f) =>
    controller.setFilter({
      global: f.global || undefined,
      columns: Object.fromEntries(
        f.columns.map((c) => [c.id, { operator: c.operator, value: c.value, valueTo: c.valueTo, selectedValues: c.selectedValues }]),
      ),
    })}
  onRowDoubleClick={(e) => (editing = e.row)}
  onRowSelectionChange={(_sel, rows) => (selected = rows)}
  showPagination
  externalPagination
  rowCount={view.total}
  pageIndex={view.pageIndex}
  pageSize={view.pageSize}
  onPaginationChange={({ pageIndex, pageSize }) => (pageSize !== view.pageSize ? controller.setPageSize(pageSize) : controller.setPage(pageIndex))}
  containerHeight={460}
/>

{#if editing !== undefined}
  <SvGridEditPanel {schema} row={editing} presentation="modal" persistKey={schema.name} {lookups} onSubmit={save} onCancel={() => (editing = undefined)} />
{/if}
