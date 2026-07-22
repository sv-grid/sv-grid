<script lang="ts">
  /**
   * Data-app Studio · chart - a grid + a live chart panel side by side.
   *
   * `SvSchemaChart` is bound to the same `EntitySchema` + data source as the
   * grid. It picks chart-able fields from the schema, renders its own controls,
   * and aggregates via the source's `getAggregate` (a GROUP BY - server-side, so
   * it scales past a page). Click a bar / slice to filter the grid; create / edit
   * / delete and bump `refreshKey` and the chart re-aggregates.
   */
  import { SvGrid, createServerDataSource, type ServerState } from '@svgrid/grid'
  import { SvSchemaChart, SvGridEditPanel, createInMemoryDataSource, schemaToColumns, type EntitySchema } from '@svgrid/enterprise'
  import SvGridStudio from '../shared/SvGridStudio.svelte'

  type Customer = { id: string; name: string; email: string; tier: string; mrr: number; active: boolean }

  const schema: EntitySchema<Customer> = {
    name: 'customers', label: 'Customer', idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, readonly: true, hidden: { form: true } },
      { field: 'name', type: 'text', required: true, minLength: 2 },
      { field: 'email', type: 'text', label: 'Email', required: true, format: 'email' },
      { field: 'tier', type: 'enum', options: [
        { value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }, { value: 'enterprise', label: 'Enterprise' },
      ] },
      { field: 'mrr', type: 'number', label: 'MRR ($)', min: 0 },
      { field: 'active', type: 'boolean' },
    ],
  }

  const seed: Customer[] = [
    { id: 'c1', name: 'Ada Lovelace', email: 'ada@analytic.io', tier: 'enterprise', mrr: 1200, active: true },
    { id: 'c2', name: 'Alan Turing', email: 'alan@bletchley.uk', tier: 'pro', mrr: 240, active: true },
    { id: 'c3', name: 'Grace Hopper', email: 'grace@navy.mil', tier: 'enterprise', mrr: 980, active: true },
    { id: 'c4', name: 'Edsger Dijkstra', email: 'edsger@shortest.path', tier: 'free', mrr: 0, active: false },
    { id: 'c5', name: 'Barbara Liskov', email: 'barbara@substitution.dev', tier: 'pro', mrr: 300, active: true },
    { id: 'c6', name: 'Donald Knuth', email: 'don@taocp.org', tier: 'enterprise', mrr: 1500, active: true },
    { id: 'c7', name: 'Margaret Hamilton', email: 'margaret@apollo.space', tier: 'pro', mrr: 420, active: true },
    { id: 'c8', name: 'Tim Berners-Lee', email: 'tim@w3.org', tier: 'enterprise', mrr: 1100, active: true },
    { id: 'c9', name: 'Linus Torvalds', email: 'linus@kernel.org', tier: 'pro', mrr: 360, active: true },
    { id: 'c10', name: 'Katherine Johnson', email: 'katherine@nasa.gov', tier: 'enterprise', mrr: 890, active: true },
    { id: 'c11', name: 'Dennis Ritchie', email: 'dmr@bell-labs.com', tier: 'pro', mrr: 275, active: false },
    { id: 'c12', name: 'Frances Allen', email: 'fran@optimizing.dev', tier: 'free', mrr: 0, active: false },
  ]

  const columns = schemaToColumns(schema)
  const source = createInMemoryDataSource(seed, schema)

  let view = $state<ServerState<Customer>>({
    rows: [], total: 0, loading: false, saving: false, error: null,
    pageIndex: 0, pageSize: 8, pageCount: 1, sortModel: [], filterModel: {},
  })
  const controller = createServerDataSource(source, {
    pageSize: 8, optimistic: true, getRowId: (r) => r.id, onChange: (s) => (view = s),
  })
  controller.refresh()

  let chartRev = $state(0) // bump to re-aggregate after a mutation
  const fmt = (v: number) => (v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : String(Math.round(v)))

  // Click a chart category -> filter the grid to it (the chart stays an overview).
  let activeFilter = $state<{ dim: string; value: string } | null>(null)
  function drill(category: string, dimension: string) {
    activeFilter = { dim: dimension, value: category }
    controller.setFilter({ columns: { [dimension]: { operator: 'equals', value: category } } })
  }
  function clearFilter() {
    activeFilter = null
    controller.setFilter({})
  }

  let editing = $state<Customer | null | undefined>(undefined)
  let genId = 13
  async function save({ mode, id, values }: { mode: 'create' | 'edit'; id: string | null; values: Partial<Customer> }) {
    if (mode === 'create') { await controller.createRow({ id: `c${genId++}`, ...values }); controller.setPage(view.pageCount - 1) }
    else if (id) { await controller.updateRow(id, values) }
    editing = undefined
    chartRev++
  }
</script>

<SvGridStudio
  title="Chart"
  subtitle="A live <code>SvSchemaChart</code> beside the grid, aggregating the same source server-side (<code>getAggregate</code>). Click a bar / slice to filter the grid."
>
  {#snippet toolbar()}
    <button class="st-btn st-btn--primary" onclick={() => (editing = null)}>+ New customer</button>
    {#if activeFilter}
      <button class="st-chip" onclick={clearFilter}>{activeFilter.dim} = {activeFilter.value} ✕</button>
    {/if}
    <span class="st-hint" style="margin-left:auto">Double-click a row to edit</span>
  {/snippet}

  <div class="chart-demo__split">
    <div class="chart-demo__grid">
      <SvGrid responsive={true}
        data={view.rows}
        {columns}
        loading={view.loading}
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
        containerHeight={340}
      />
    </div>

    <aside class="chart-demo__panel">
      <SvSchemaChart
        {schema}
        getAggregate={(req) => source.getAggregate(req)}
        refreshKey={chartRev}
        formatValue={fmt}
        onDrill={drill}
      />
    </aside>
  </div>

  {#if editing !== undefined}
    <SvGridEditPanel {schema} row={editing} presentation="modal" persistKey="studio" onSubmit={save} onCancel={() => (editing = undefined)} />
  {/if}
</SvGridStudio>

<style>
  .chart-demo__split { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; }
  .chart-demo__grid { flex: 1 1 420px; min-width: 0; }
  .chart-demo__panel { flex: 0 0 500px; max-width: 100%; border: 1px solid var(--sg-border, #e6e8ec); border-radius: 16px; padding: 16px; background: var(--sg-bg, #fff); box-shadow: 0 1px 2px rgba(15,23,42,.05), 0 12px 28px -14px rgba(15,23,42,.22); }
</style>
