<script lang="ts">
  /**
   * Data-app Studio · computed fields + hooks - business logic on the schema.
   *
   * `total` is a COMPUTED field (`qty * price`): read-only in the grid + form,
   * recomputed live as you type, never stored or submitted. `withEntityRules`
   * materializes it onto every row and runs the schema's `hooks`: `beforeCreate`
   * stamps `createdAt`, and `validate` (cross-field) rejects a non-positive qty.
   */
  import { SvGrid, createServerDataSource, type ServerState } from '@svgrid/grid'
  import {
    SvGridEditPanel,
    createInMemoryDataSource,
    withEntityRules,
    schemaToColumns,
    type EntitySchema,
  } from '@svgrid/enterprise'
  import SvGridStudio from '../shared/SvGridStudio.svelte'

  type Order = {
    id: string
    product: string
    qty: number
    price: number
    total: number
    createdAt: string
  }

  const schema: EntitySchema<Order> = {
    name: 'orders',
    label: 'Order',
    idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, readonly: true, hidden: { form: true } },
      { field: 'product', type: 'text', required: true, minLength: 2 },
      { field: 'qty', type: 'number', label: 'Qty', required: true, min: 1 },
      { field: 'price', type: 'number', label: 'Unit price ($)', required: true, min: 0 },
      // Computed: derived from qty * price. Read-only, live, never stored.
      { field: 'total', type: 'number', label: 'Total ($)', computed: (r) => Number(r.qty) * Number(r.price) },
      { field: 'createdAt', type: 'text', label: 'Created', readonly: true },
    ],
    hooks: {
      // Cross-field validation (also enforced live in the form).
      validate: (v) => (Number(v.qty) <= 0 ? { qty: 'Quantity must be at least 1' } : null),
      // Stamp a created date on new rows.
      beforeCreate: (v) => ({ ...v, createdAt: new Date().toISOString().slice(0, 10) }),
    },
  }

  const seed: Order[] = [
    { id: 'o1', product: 'Widget', qty: 3, price: 20, total: 0, createdAt: '2026-06-01' },
    { id: 'o2', product: 'Gadget', qty: 1, price: 150, total: 0, createdAt: '2026-06-03' },
    { id: 'o3', product: 'Sprocket', qty: 8, price: 12.5, total: 0, createdAt: '2026-06-05' },
    { id: 'o4', product: 'Cog', qty: 25, price: 3, total: 0, createdAt: '2026-06-09' },
    { id: 'o5', product: 'Flange', qty: 4, price: 45, total: 0, createdAt: '2026-06-11' },
  ]

  const columns = schemaToColumns(schema)
  // withEntityRules materializes `total` on read + runs hooks on writes.
  const source = withEntityRules(createInMemoryDataSource(seed, schema), schema)

  let view = $state<ServerState<Order>>({
    rows: [], total: 0, loading: false, saving: false, error: null,
    pageIndex: 0, pageSize: 8, pageCount: 1, sortModel: [], filterModel: {},
  })
  const controller = createServerDataSource(source, {
    pageSize: 8, optimistic: true, getRowId: (r) => r.id, onChange: (s) => (view = s),
  })
  controller.refresh()

  let editing = $state<Order | null | undefined>(undefined)
  let genId = 6
  async function save({ mode, id, values }: { mode: 'create' | 'edit'; id: string | null; values: Partial<Order> }) {
    if (mode === 'create') {
      await controller.createRow({ id: `o${genId++}`, ...values })
      controller.setPage(view.pageCount - 1)
    } else if (id) {
      await controller.updateRow(id, values)
    }
    editing = undefined
  }
</script>

<SvGridStudio
  title="Computed fields &amp; hooks"
  subtitle="<code>total</code> is a computed field (<code>qty * price</code>) - read-only, live, never stored. <code>withEntityRules</code> materializes it and runs the schema's hooks: <code>beforeCreate</code> stamps the date, <code>validate</code> rejects qty &lt; 1."
>
  {#snippet toolbar()}
    <button class="st-btn st-btn--primary" onclick={() => (editing = null)}>+ New order</button>
    <span class="st-hint" style="margin-left:auto">Double-click a row to edit - watch Total update as you type</span>
  {/snippet}

  <SvGrid
    data={view.rows}
    {columns}
    loading={view.loading}
    fitColumns
    enableRowSummaries={false}
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
    containerHeight={360}
  />

  {#if editing !== undefined}
    <SvGridEditPanel {schema} row={editing} presentation="modal" persistKey="studio" onSubmit={save} onCancel={() => (editing = undefined)} />
  {/if}
</SvGridStudio>
