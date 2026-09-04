<script lang="ts">
  /**
   * Data-app Studio · dashboard - a schema-driven dashboard above the grid.
   *
   * `SvSchemaDashboard` renders a declarative `DashboardSpec` (KPI tiles + charts)
   * over the same `EntitySchema` + rows as the grid. It's a data VIEW, not a page
   * builder: KPIs reduce a measure to one number, charts reuse `SvSchemaChart`.
   * Click a chart category to drill the grid; create / edit / delete updates both.
   */
  import { SvGrid, createServerDataSource, type ServerState } from '@svgrid/grid'
  import {
    SvSchemaDashboard,
    SvGridEditPanel,
    createInMemoryDataSource,
    schemaToColumns,
    type EntitySchema,
    type DashboardSpec,
  } from '@svgrid/enterprise'
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

  // KPIs + charts are computed SERVER-SIDE via getAggregate, so they're correct
  // over the whole table (not just the grid's current page). Bump `rev` to
  // re-aggregate after a mutation.
  let rev = $state(0)

  const dashboard: DashboardSpec = {
    widgets: [
      { kind: 'kpi', label: 'Customers', reduce: 'count' },
      { kind: 'kpi', label: 'Total MRR', measure: 'mrr', reduce: 'sum', format: (v) => '$' + v.toLocaleString() },
      { kind: 'kpi', label: 'Avg MRR', measure: 'mrr', reduce: 'avg', format: (v) => '$' + Math.round(v) },
      { kind: 'chart', label: 'MRR by tier', dimension: 'tier', measure: 'mrr', reduce: 'sum', type: 'bar', span: 2 },
      { kind: 'chart', label: 'Customers by status', dimension: 'active', reduce: 'count', type: 'pie', span: 1 },
    ],
  }

  let view = $state<ServerState<Customer>>({
    rows: [], total: 0, loading: false, saving: false, error: null,
    pageIndex: 0, pageSize: 8, pageCount: 1, sortModel: [], filterModel: {},
  })
  const controller = createServerDataSource(source, {
    pageSize: 8, optimistic: true, getRowId: (r) => r.id, onChange: (s) => (view = s),
  })
  controller.refresh()

  // Click a chart category -> filter the grid to it.
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
    rev++ // re-aggregate the dashboard (server-side)
  }
</script>

<SvGridStudio
  title="Dashboard"
  subtitle="<code>SvSchemaDashboard</code> renders a declarative spec of KPI tiles + charts over the same schema. Click a chart category to drill the grid; create / edit updates the numbers."
>
  {#snippet toolbar()}
    <button class="st-btn st-btn--primary" onclick={() => (editing = null)}>+ New customer</button>
    {#if activeFilter}
      <button class="st-chip" onclick={clearFilter}>{activeFilter.dim} = {activeFilter.value} ✕</button>
    {/if}
    <span class="st-hint" style="margin-left:auto">Double-click a row to edit</span>
  {/snippet}

  <div class="dash-demo">
    <SvSchemaDashboard {schema} getAggregate={(req) => source.getAggregate(req)} refreshKey={rev} spec={dashboard} onDrill={drill} />

    <SvGrid responsive={true}
      columnResize
      data={view.rows}
      {columns}
      loading={view.loading}
      fitColumns
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
      containerHeight={320}
    />
  </div>

  {#if editing !== undefined}
    <SvGridEditPanel {schema} row={editing} presentation="modal" persistKey="studio" onSubmit={save} onCancel={() => (editing = undefined)} />
  {/if}
</SvGridStudio>

<style>
  .dash-demo { display: flex; flex-direction: column; gap: 16px; }
</style>
