<script lang="ts">
  /**
   * 338. Northwind on PGlite - a real relational Postgres in the browser
   * --------------------------------------------------------------------
   * The classic Northwind sample DB (categories, customers, products, orders,
   * order_details) seeded into PGlite (WASM Postgres). No server, no keys.
   *
   * Switch between three entities, each backed by `createSqlDataSource` over
   * the same in-browser database:
   *   - Order lines - a five-table JOIN exposed as a VIEW (read-only). The rich
   *     denormalized grid a single flat table can't give you.
   *   - Products / Customers - base tables with full CRUD; new rows get an
   *     auto-generated id from a Postgres IDENTITY sequence.
   *
   * Sort / filter / page all round-trip as real parameterized SQL - watch the
   * statement under the toolbar change as you interact.
   */
  import { PGlite } from '@electric-sql/pglite'
  import { SvGrid, createServerDataSource, type ServerState } from '@svgrid/grid'
  import { SvGridEditPanel, createSqlDataSource, schemaToColumns, type EntitySchema } from '@svgrid/enterprise'
  import SvGridStudio from '../shared/SvGridStudio.svelte'
  import { NORTHWIND_SQL, productsSchema, customersSchema, orderLinesSchema } from '../shared/northwind'

  type Row = Record<string, unknown>
  type EntityKey = 'order_lines' | 'products' | 'customers'
  type Entity = { key: EntityKey; label: string; schema: EntitySchema<Row>; editable: boolean; hint: string }

  const ENTITIES: Entity[] = [
    { key: 'order_lines', label: 'Order lines', schema: orderLinesSchema as unknown as EntitySchema<Row>, editable: false, hint: 'A five-table JOIN, read-only' },
    { key: 'products', label: 'Products', schema: productsSchema as unknown as EntitySchema<Row>, editable: true, hint: 'Base table, full CRUD' },
    { key: 'customers', label: 'Customers', schema: customersSchema as unknown as EntitySchema<Row>, editable: true, hint: 'Base table, full CRUD' },
  ]

  let db: PGlite
  let ready = $state(false)
  let activeKey = $state<EntityKey>('order_lines')
  let lastSql = $state('')
  let editing = $state<Row | null | undefined>(undefined)
  let selected = $state<Row[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let controller: any

  let view = $state<ServerState<Row>>({
    rows: [], total: 0, loading: false, saving: false, error: null,
    pageIndex: 0, pageSize: 10, pageCount: 1, sortModel: [], filterModel: {},
  })

  const active = $derived(ENTITIES.find((e) => e.key === activeKey)!)
  const columns = $derived(schemaToColumns(active.schema))

  function bind(entity: Entity) {
    controller?.dispose()
    editing = undefined
    selected = []
    lastSql = ''
    const source = createSqlDataSource<Row>({
      schema: entity.schema,
      table: entity.key,
      dialect: { placeholders: '$', ilike: true },
      execute: async (text, params) => {
        if (!text.startsWith('SELECT COUNT(')) lastSql = text
        const res = await db.query(text, params)
        return res.rows as Row[]
      },
    })
    controller = createServerDataSource<Row>(source, {
      pageSize: 10,
      optimistic: true,
      getRowId: (r) => String(r.id),
      onChange: (s) => (view = s),
    })
    controller.refresh()
  }

  function switchTo(key: EntityKey) {
    if (key === activeKey && ready) return
    activeKey = key
    if (ready) bind(ENTITIES.find((e) => e.key === key)!)
  }

  async function init() {
    db = new PGlite() // in-memory Postgres (WASM)
    await db.exec(NORTHWIND_SQL)
    ready = true
    bind(active)
  }
  init()

  async function save({ mode, id, values }: { mode: 'create' | 'edit'; id: string | null; values: Partial<Row> }) {
    if (mode === 'create') {
      await controller.createRow(values)
      controller.setPage(view.pageCount - 1)
    } else if (id) {
      await controller.updateRow(id, values)
    }
    editing = undefined
  }
  async function removeSelected() {
    for (const row of selected) await controller.deleteRow(String(row.id))
    selected = []
  }
</script>

<SvGridStudio
  title="Northwind on PGlite"
  subtitle="The classic Northwind database as a real Postgres in your browser (<code>PGlite</code>, WASM). Every sort, filter, page, and edit is actual SQL."
>
  {#snippet actions()}
    <span class="st-badge st-badge--live">● Postgres · WASM · no server</span>
  {/snippet}

  {#if !ready}
    <div class="live__loading">Booting Postgres in the browser…</div>
  {:else}
    <div class="nw__tabs">
      {#each ENTITIES as e (e.key)}
        <button class="nw__tab" class:nw__tab--active={e.key === activeKey} onclick={() => switchTo(e.key)}>
          {e.label}
          <span class="nw__hint">{e.hint}</span>
        </button>
      {/each}
    </div>

    <div class="st__toolbar">
      {#if active.editable}
        <button class="st-btn st-btn--primary" onclick={() => (editing = null)}>+ New {active.schema.label?.toLowerCase()}</button>
        <button class="st-btn" disabled={selected.length === 0} onclick={removeSelected}>
          Delete{selected.length ? ` (${selected.length})` : ''}
        </button>
      {:else}
        <span class="nw__readonly">Read-only view — switch to Products or Customers to edit.</span>
      {/if}
    </div>

    <div class="live__sql"><span>SQL</span> <code>{lastSql}</code></div>

    <SvGrid responsive={true}
      data={view.rows}
      {columns}
      loading={view.loading}
      fitColumns
      enableRowSummaries={false}
      showRowSelection={active.editable}
      sortable
      externalSort
      onSortingChange={(s) => controller.setSort(s)}
      filterable
      filterMode="row"
      externalFilter
      onFiltersChange={(f) =>
        controller.setFilter({
          global: f.global || undefined,
          columns: Object.fromEntries(
            f.columns.map((c) => [c.id, { operator: c.operator, value: c.value, valueTo: c.valueTo, selectedValues: c.selectedValues }]),
          ),
        })}
      onRowDoubleClick={(e) => active.editable && (editing = e.row)}
      onRowSelectionChange={(_sel, rows) => (selected = rows)}
      showPagination
      externalPagination
      rowCount={view.total}
      pageIndex={view.pageIndex}
      pageSize={view.pageSize}
      onPaginationChange={({ pageIndex, pageSize }) => {
        if (pageSize !== view.pageSize) controller.setPageSize(pageSize)
        else controller.setPage(pageIndex)
      }}
      containerHeight={340}
    />

    {#if editing !== undefined && active.editable}
      <SvGridEditPanel schema={active.schema} row={editing} presentation="modal" persistKey="northwind" onSubmit={save} onCancel={() => (editing = undefined)} />
    {/if}
  {/if}
</SvGridStudio>

<style>
  .live__loading { padding: 40px; text-align: center; color: var(--sg-muted, #888); }
  .live__sql { display: flex; align-items: center; gap: 8px; font-size: 12px; overflow: auto; }
  .live__sql span { flex: 0 0 auto; font-weight: 700; color: var(--sg-muted, #888); }
  .live__sql code { white-space: nowrap; color: var(--sg-fg, inherit); background: var(--sg-header-bg, #f6f6f6); padding: 4px 8px; border-radius: 6px; }
  .nw__tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
  .nw__tab {
    display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
    padding: 8px 14px; border: 1px solid var(--sg-border, #e2e2e2); border-radius: 8px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, inherit); cursor: pointer;
    font-size: 13px; font-weight: 600; line-height: 1.2;
  }
  .nw__tab--active { border-color: var(--site-accent, #2563eb); box-shadow: inset 0 0 0 1px var(--site-accent, #2563eb); }
  .nw__hint { font-size: 11px; font-weight: 400; color: var(--sg-muted, #888); }
  .nw__readonly { font-size: 12px; color: var(--sg-muted, #888); }
</style>
