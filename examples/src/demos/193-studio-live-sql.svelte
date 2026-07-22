<script lang="ts">
  /**
   * Data-app Studio (live SQL) - the same Studio stack, but backed by a REAL
   * Postgres running entirely in your browser via PGlite (WASM). No server.
   *
   * `createSqlDataSource` turns the grid's sort / filter / page requests into
   * parameterized SQL and runs them through PGlite's `query(text, params)`.
   * Every action below executes actual Postgres - watch the SQL under the
   * toolbar update as you sort, filter, and page.
   */
  import { PGlite } from '@electric-sql/pglite'
  import { SvGrid, createServerDataSource, type ServerState } from '@svgrid/grid'
  import {
    SvGridEditPanel,
    createSqlDataSource,
    schemaToColumns,
    type EntitySchema,
  } from '@svgrid/enterprise'
  import SvGridStudio from '../shared/SvGridStudio.svelte'

  type Customer = {
    id: number
    name: string
    email: string
    tier: string
    mrr: number
    active: boolean
  }

  const schema: EntitySchema<Customer> = {
    name: 'customers',
    label: 'Customer',
    idField: 'id',
    fields: [
      { field: 'id', type: 'number', primaryKey: true, readonly: true },
      { field: 'name', type: 'text', required: true, minLength: 2 },
      { field: 'email', type: 'text', label: 'Email', required: true, format: 'email' },
      {
        field: 'tier',
        type: 'enum',
        options: [
          { value: 'free', label: 'Free' },
          { value: 'pro', label: 'Pro' },
          { value: 'enterprise', label: 'Enterprise' },
        ],
      },
      { field: 'mrr', type: 'number', label: 'MRR ($)', min: 0 },
      { field: 'active', type: 'boolean' },
    ],
  }

  const columns = schemaToColumns(schema)

  let ready = $state(false)
  let lastSql = $state('')
  let editing = $state<Customer | null | undefined>(undefined)
  let selected = $state<Customer[]>([])

  let view = $state<ServerState<Customer>>({
    rows: [], total: 0, loading: false, saving: false, error: null,
    pageIndex: 0, pageSize: 10, pageCount: 1, sortModel: [], filterModel: {},
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let controller: any

  const SEED = [
    ['Ada Lovelace', 'ada@analytic.io', 'enterprise', 1200, true],
    ['Alan Turing', 'alan@bletchley.uk', 'pro', 240, true],
    ['Grace Hopper', 'grace@navy.mil', 'enterprise', 980, true],
    ['Edsger Dijkstra', 'edsger@shortest.path', 'free', 0, false],
    ['Barbara Liskov', 'barbara@substitution.dev', 'pro', 300, true],
    ['Donald Knuth', 'don@taocp.org', 'enterprise', 1500, true],
    ['Margaret Hamilton', 'margaret@apollo.space', 'pro', 420, true],
    ['Tim Berners-Lee', 'tim@w3.org', 'enterprise', 1100, true],
    ['Linus Torvalds', 'linus@kernel.org', 'pro', 360, true],
    ['Katherine Johnson', 'katherine@nasa.gov', 'enterprise', 890, true],
    ['Dennis Ritchie', 'dmr@bell-labs.com', 'pro', 275, false],
    ['Radia Perlman', 'radia@spanning.tree', 'enterprise', 760, true],
    ['Ken Thompson', 'ken@unix.org', 'pro', 310, true],
    ['Frances Allen', 'fran@optimizing.dev', 'free', 0, false],
    ['Vint Cerf', 'vint@internet.org', 'enterprise', 1320, true],
    ['Guido van Rossum', 'guido@python.org', 'pro', 340, true],
    ['Bjarne Stroustrup', 'bjarne@cpp.dev', 'enterprise', 720, true],
    ['Anita Borg', 'anita@systers.org', 'pro', 410, true],
    ['John McCarthy', 'john@lisp.ai', 'free', 0, false],
    ['Shafi Goldwasser', 'shafi@crypto.mit', 'enterprise', 1180, true],
  ] as const

  async function init() {
    const db = new PGlite() // in-memory Postgres (WASM)
    await db.exec(`
      CREATE TABLE customers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        tier TEXT,
        mrr INTEGER,
        active BOOLEAN
      );
    `)
    for (const [name, email, tier, mrr, active] of SEED) {
      await db.query('INSERT INTO customers (name, email, tier, mrr, active) VALUES ($1, $2, $3, $4, $5)', [
        name, email, tier, mrr, active,
      ])
    }

    const source = createSqlDataSource<Customer>({
      schema,
      table: 'customers',
      dialect: { placeholders: '$', ilike: true },
      execute: async (text, params) => {
        // Show the interesting query (the SELECT / INSERT / UPDATE / DELETE),
        // not the COUNT(*) that follows each read.
        if (!text.startsWith('SELECT COUNT(')) lastSql = text
        const res = await db.query(text, params)
        return res.rows as Record<string, unknown>[]
      },
    })

    controller = createServerDataSource<Customer>(source, {
      pageSize: 10,
      optimistic: true,
      getRowId: (r) => String(r.id),
      onChange: (s) => (view = s),
    })
    controller.refresh()
    ready = true
  }
  init()

  async function save({ mode, id, values }: { mode: 'create' | 'edit'; id: string | null; values: Partial<Customer> }) {
    if (mode === 'create') {
      await controller.createRow(values)
      controller.setPage(view.pageCount - 1) // jump to the new row (appended at the end)
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
  title="Live SQL"
  subtitle="A real Postgres running in your browser (<code>PGlite</code>, WASM). Every action is actual SQL."
>
  {#snippet actions()}
    <span class="st-badge st-badge--live">● Postgres · WASM · no server</span>
  {/snippet}

  {#if !ready}
    <div class="live__loading">Booting Postgres in the browser…</div>
  {:else}
    <div class="st__toolbar">
      <button class="st-btn st-btn--primary" onclick={() => (editing = null)}>+ New customer</button>
      <button class="st-btn" disabled={selected.length === 0} onclick={removeSelected}>
        Delete{selected.length ? ` (${selected.length})` : ''}
      </button>
    </div>

    <div class="live__sql"><span>SQL</span> <code>{lastSql}</code></div>

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
      onRowDoubleClick={(e) => (editing = e.row)}
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

    {#if editing !== undefined}
      <SvGridEditPanel {schema} row={editing} presentation="modal" persistKey="studio" onSubmit={save} onCancel={() => (editing = undefined)} />
    {/if}
  {/if}
</SvGridStudio>

<style>
  .live__loading { padding: 40px; text-align: center; color: var(--sg-muted, #888); }
  .live__sql { display: flex; align-items: center; gap: 8px; font-size: 12px; overflow: auto; }
  .live__sql span { flex: 0 0 auto; font-weight: 700; color: var(--sg-muted, #888); }
  .live__sql code { white-space: nowrap; color: var(--sg-fg, inherit); background: var(--sg-header-bg, #f6f6f6); padding: 4px 8px; border-radius: 6px; }
</style>
