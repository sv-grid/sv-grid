<script lang="ts">
  /**
   * Area B: SQL backend load. A real Postgres (PGlite, in-browser, throwaway)
   * sits behind createSqlDataSource and every statement is logged. Two things
   * show up:
   *   1. a COUNT(*) runs with every page fetch, as its own statement;
   *   2. the page size the client asks for is passed through with no cap.
   */
  import { onDestroy } from 'svelte'
  import { SvGrid, createServerDataSource, type ColumnDef, type ServerState } from '@svgrid/grid'
  import { createSqlDataSource, type EntitySchema } from '@svgrid/enterprise'
  import { fmtInt } from './measure'

  type Row = { id: number; name: string; city: string; amount: number }
  const schema: EntitySchema<Row> = {
    name: 'accounts',
    idField: 'id',
    fields: [
      { field: 'id', type: 'number', primaryKey: true, readonly: true },
      { field: 'name', type: 'text' },
      { field: 'city', type: 'text' },
      { field: 'amount', type: 'number' },
    ],
  }
  const columns: ColumnDef<any, Row>[] = [
    { field: 'id', header: 'ID', width: 90 },
    { field: 'name', header: 'Name', width: 200 },
    { field: 'city', header: 'City', width: 140 },
    { field: 'amount', header: 'Amount', width: 140 },
  ]

  let ready = $state(false)
  let statements = $state<{ sql: string; ms: number; kind: 'count' | 'rows' | 'other' }[]>([])
  let countStatements = $state(0)
  let pageFetches = $state(0)
  let db: any = null
  let ctl: ReturnType<typeof createServerDataSource<Row>> | null = null
  let view = $state<ServerState<Row>>({
    rows: [], total: 0, loading: false, saving: false, error: null,
    pageIndex: 0, pageSize: 25, pageCount: 1, sortModel: [], filterModel: {},
  })

  const kindOf = (sql: string): 'count' | 'rows' | 'other' =>
    /select\s+count\(/i.test(sql) ? 'count' : /limit/i.test(sql) ? 'rows' : 'other'

  async function run(sql: string, params: unknown[]) {
    const t0 = performance.now()
    const res = await db.query(sql, params)
    const ms = performance.now() - t0
    const kind = kindOf(sql)
    if (kind === 'count') countStatements += 1
    if (kind === 'rows') pageFetches += 1
    statements = [{ sql, ms, kind }, ...statements].slice(0, 60)
    return res.rows
  }

  async function init() {
    const { PGlite } = await import('@electric-sql/pglite')
    db = new PGlite()
    await db.exec(`
      CREATE TABLE accounts (id int primary key, name text, city text, amount numeric);
      INSERT INTO accounts (id, name, city, amount)
      SELECT g, 'Account ' || g,
             (ARRAY['Sofia','Berlin','Austin','Osaka','Lima'])[1 + (g % 5)],
             1000 + (g * 7919) % 90000
      FROM generate_series(1, 20000) g;
    `)
    const source = createSqlDataSource<Row>({
      schema,
      table: 'accounts',
      dialect: { placeholders: '$', ilike: true },
      execute: (text: string, params: unknown[]) => run(text, params) as Promise<Row[]>,
    })
    ctl = createServerDataSource<Row>(source, {
      mode: 'page',
      pageSize: 25,
      getRowId: (r) => String(r.id),
      onChange: (s) => (view = s),
    })
    ready = true
  }
  init()
  onDestroy(() => ctl?.dispose())

  function clearLog() { statements = []; countStatements = 0; pageFetches = 0 }

  /** Page through five pages: each fetch brings its own COUNT(*). */
  async function pageThrough() {
    clearLog()
    for (let p = 0; p < 5; p += 1) {
      ctl?.setPage(p)
      await new Promise((r) => setTimeout(r, 150))
    }
  }

  /** Ask for an absurd page size through the public API. */
  function hugePage() {
    clearLog()
    ctl?.setPageSize(1_000_000)
    ctl?.setPage(0)
  }
</script>

<section class="panel">
  <p class="why">
    <b>Claim:</b> a COUNT(*) runs with every page fetch, and the page size the client asks for is not capped.
    This runs a real Postgres (PGlite) in your browser on a throwaway 20,000-row table and logs every statement.
  </p>

  {#if !ready}
    <p class="status">Starting an in-browser Postgres and seeding 20,000 rows...</p>
  {:else}
    <div class="controls">
      <button class="btn" onclick={pageThrough}>Page through 5 pages</button>
      <button class="btn" onclick={hugePage}>Request a 1,000,000-row page</button>
      <button class="btn" onclick={clearLog}>Clear log</button>
    </div>

    <div class="stats">
      <div class="stat"><div class="k">Page fetches</div><div class="v">{fmtInt(pageFetches)}</div></div>
      <div class="stat {countStatements > 1 ? 'bad' : ''}"><div class="k">COUNT(*) statements</div><div class="v">{fmtInt(countStatements)}</div></div>
      <div class="stat {view.rows.length > 1000 ? 'bad' : ''}"><div class="k">Rows this page</div><div class="v">{fmtInt(view.rows.length)}</div></div>
      <div class="stat"><div class="k">Table total</div><div class="v">{fmtInt(view.total)}</div></div>
    </div>

    <div class="gridbox">
      {#if ctl}<SvGrid rowModel={ctl} {columns} sortable filterable containerHeight={300} />{/if}
    </div>

    <pre class="log">{statements.map((s) => `${s.kind === 'count' ? '  COUNT ' : s.kind === 'rows' ? '  ROWS  ' : '        '}${s.ms.toFixed(1).padStart(6)} ms  ${s.sql}`).join('\n')}</pre>
  {/if}
</section>
