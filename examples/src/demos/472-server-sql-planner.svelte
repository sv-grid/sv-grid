<!-- Documented in: docs/help/server/server-grouping.md -->
<script lang="ts">
  /**
   * 472. Server row model to SQL
   * ----------------------------
   * What the backend runs for each request the row model sends. `planQuery`
   * turns a `ServerRequest` into a `QueryPlan` against an entity schema (only
   * declared fields get through), `planToSql` renders the plan in a dialect,
   * and the panel shows the statements `createSqlDataSource` would hand your
   * executor for the request that just went out: the rows, the count, the
   * grand total, and the two-step pivot. The rows themselves come from the
   * in-memory reference source over the same plan, so what you see is what
   * the SQL would return.
   *
   * The row model and the SQL planner are Enterprise; the datasource
   * contract is free.
   */
  import { SvGrid, renderComponent, tableFeatures, rowSortingFeature, columnFilteringFeature, type GridColumns, type ServerRequest, type ServerDataSource } from '@svgrid/grid'
  import {
    setLicenseKey,
    createInMemoryDataSource,
    createServerRowModel,
    planQuery,
    planToSql,
    serverGroupText,
    SvGroupCell,
    SvRowGroupPanel,
    type EntitySchema,
    type SqlDialect,
    type ServerRowModel,
    type ServerRowModelState,
    type ServerRowModelGridRow,
  } from '@svgrid/enterprise'
  import { createPrng } from '../shared/mock-api'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // ---- The table -------------------------------------------------------------
  type Sale = { id: number; region: string; country: string; rep: string; product: string; year: number; qty: number; amount: number }
  const WORLD: Record<string, string[]> = { Americas: ['US', 'BR', 'CA'], EMEA: ['DE', 'UK', 'FR'], APAC: ['JP', 'AU', 'IN'] }
  const REPS = ['Ada', 'Grace', 'Linus', 'Margaret', 'Ken', 'Barbara', 'Dennis', 'Donald']
  const PRODUCTS = ['Desk', 'Chair', 'Lamp', 'Monitor', 'Cabinet', 'Whiteboard']
  const rng = createPrng(0x5a1e5)
  const DB: Sale[] = Array.from({ length: 50_000 }, (_, i) => {
    const region = rng.pick(Object.keys(WORLD))
    const qty = rng.int(1, 12)
    return {
      id: i + 1,
      region,
      country: rng.pick(WORLD[region]!),
      rep: rng.pick(REPS),
      product: rng.pick(PRODUCTS),
      year: rng.int(2023, 2026),
      qty,
      amount: qty * rng.int(90, 900),
    }
  })
  const schema: EntitySchema<Sale> = {
    name: 'sales',
    fields: [
      { field: 'id', type: 'number', primaryKey: true, readonly: true },
      { field: 'region', type: 'text' },
      { field: 'country', type: 'text' },
      { field: 'rep', type: 'text' },
      { field: 'product', type: 'text' },
      { field: 'year', type: 'number' },
      { field: 'qty', type: 'number' },
      { field: 'amount', type: 'number' },
    ],
  }
  const memory = createInMemoryDataSource(DB, schema)

  // ---- Dialects --------------------------------------------------------------
  type DialectName = 'postgres' | 'mysql' | 'sqlite'
  const DIALECT_LABEL: Record<DialectName, string> = { postgres: 'PostgreSQL', mysql: 'MySQL', sqlite: 'SQLite' }
  const DIALECTS: Record<DialectName, SqlDialect> = {
    postgres: { quote: '"', placeholders: '$', ilike: true },
    mysql: { quote: '`', placeholders: '?' },
    sqlite: { quote: '"', placeholders: '?' },
  }
  let dialect = $state<DialectName>('postgres')

  // ---- The statements for one request ----------------------------------------
  // The same assembly `createSqlDataSource` does, kept as text: the plan is
  // the seam, so this is exactly what an executor receives.
  type Statement = { label: string; sql: string; params: unknown[] }
  type Entry = { seq: number; request: ServerRequest; ms: number }
  function statementsFor(request: ServerRequest, name: DialectName): Statement[] {
    const plan = planQuery(schema, request)
    const sql = planToSql(plan, DIALECTS[name])
    const q = DIALECTS[name].quote ?? '"'
    const t = `${q}sales${q}`
    const out: Statement[] = []
    let select = sql.select
    let grandTotalSelect = sql.grandTotalSelect
    if (plan.groupBy && plan.pivotBy?.length) {
      out.push({ label: 'pivot keys', sql: `SELECT ${sql.pivotKeysSelect}\nFROM ${t}\n${sql.whereText}`.trim(), params: sql.params })
      // The key paths the first statement returns; the in-memory table has
      // them, so the second statement can be shown in full.
      const keyRows = [...new Set(DB.map((r) => r.year))].sort().map((year) => ({ year }))
      const pivot = sql.pivotSelect(keyRows)
      select = pivot.select
      if (plan.grandTotal) grandTotalSelect = pivot.grandTotalSelect
    }
    out.push({
      label: plan.groupBy ? 'group rows' : 'rows',
      sql: plan.groupBy
        ? `SELECT ${select}\nFROM ${t}\n${sql.whereText}\n${sql.groupByText}\n${sql.orderByText}\nLIMIT ${sql.limit} OFFSET ${sql.offset}`
        : `SELECT *\nFROM ${t}\n${sql.whereText}\n${sql.orderByText}\nLIMIT ${sql.limit} OFFSET ${sql.offset}`,
      params: sql.params,
    })
    out.push({ label: 'count', sql: `SELECT ${sql.countText} AS count\nFROM ${t}\n${sql.whereText}`, params: sql.params })
    if (plan.grandTotal && grandTotalSelect) {
      out.push({ label: 'grand total', sql: `SELECT ${grandTotalSelect}\nFROM ${t}\n${sql.grandTotalWhereText}`, params: sql.grandTotalParams })
    }
    return out.map((s) => ({ ...s, sql: s.sql.replace(/\n{2,}/g, '\n').replace(/\n$/, '') }))
  }

  let log = $state<Entry[]>([])
  let seq = 0
  const source: ServerDataSource<Sale> = {
    async getRows(req) {
      const t0 = performance.now()
      await new Promise((r) => setTimeout(r, 100))
      const result = await memory.getRows(req)
      log = [{ seq: seq++, request: req, ms: Math.round(performance.now() - t0) }, ...log].slice(0, 12)
      return result
    },
  }

  // ---- The model ---------------------------------------------------------------
  type Row = ServerRowModelGridRow<Sale>
  let view = $state<ServerRowModelState<Sale>>()
  let pivot = $state(false)
  let groupBy = $state<string[]>(['region', 'country'])
  const usd = { type: 'number' as const, options: { style: 'currency' as const, currency: 'USD', maximumFractionDigits: 0 } }
  const groupColumn: GridColumns<Row>[number] = {
    id: 'group',
    header: 'Group',
    width: 220,
    sortable: false,
    filterable: false,
    fieldFn: (row) => serverGroupText(row, 'rep'),
    cell: (ctx) =>
      renderComponent(SvGroupCell, {
        row: ctx.row.original,
        onToggle: () => ctl.group.onToggle(ctx.row.original),
        leafField: 'rep',
      }),
  }
  const ctl: ServerRowModel<Sale> = createServerRowModel<Sale>(source, {
    groupBy: [...groupBy],
    aggregations: [
      { col: 'amount', fn: 'sum' },
      { col: 'qty', fn: 'sum' },
    ],
    grandTotalRow: 'pinnedBottom',
    childCount: (r) => (r as { childCount?: number }).childCount,
    pivotBy: ['year'],
    pivotMode: false,
    // One value column per (year x measure): the field name says which measure.
    pivotResultColumn: (field, def) =>
      field.endsWith('_qty') ? { ...def, header: 'Qty', width: 90, format: { type: 'number' } } : { ...def, header: 'Amount', width: 120, format: usd },
    // Pivot columns replace the grid's columns; the group column leads them.
    pivotLeadingColumns: [groupColumn],
    blockSize: 50,
    skeletonRows: 4,
    filterValues: async (columnId) => [...new Set(DB.map((r) => String(r[columnId as keyof Sale])))].sort(),
    onChange: (s) => (view = s),
  })
  ctl.refresh()
  $effect(() => () => ctl.dispose())
  function setGroupBy(next: string[]) {
    groupBy = next
    ctl.setGroupBy(next)
  }
  function setPivot(next: boolean) {
    pivot = next
    ctl.setPivot({ pivotMode: next })
  }
  const groupCols = [
    { id: 'region', label: 'Region' },
    { id: 'country', label: 'Country' },
    { id: 'rep', label: 'Rep' },
    { id: 'product', label: 'Product' },
    { id: 'year', label: 'Year' },
  ]

  // ---- Columns -----------------------------------------------------------------
  const columns = $derived<GridColumns<Row>>([
    ...(groupBy.length
      ? [{ ...groupColumn, header: groupBy.map((g) => g[0]!.toUpperCase() + g.slice(1)).join(' / ') }]
      : [{ field: 'rep', header: 'Rep', width: 120 } as GridColumns<Row>[number]]),
    { field: 'product', header: 'Product', width: 120 },
    { field: 'year', header: 'Year', width: 80, align: 'right' },
    { field: 'qty', header: 'Qty', width: 90, align: 'right', format: { type: 'number' } },
    { field: 'amount', header: 'Amount', width: 130, align: 'right', format: usd },
  ])

  const latest = $derived(log[0] ?? null)
  const statements = $derived(latest ? statementsFor(latest.request, dialect) : [])
  const describe = (r: ServerRequest) => {
    const parts = [`rows ${r.startRow}-${r.endRow}`]
    if (r.groupKeys?.length) parts.push(`under ${r.groupKeys.join(' > ')}`)
    else if (r.groupBy?.length) parts.push('top level')
    if (r.sortModel.length) parts.push(`sort ${r.sortModel.map((s) => `${s.id}${s.desc ? ' desc' : ''}`).join(', ')}`)
    const cols = Object.keys(r.filterModel.columns ?? {})
    if (cols.length) parts.push(`filter ${cols.join(', ')}`)
    if (r.filterModel.global) parts.push(`search "${r.filterModel.global}"`)
    if (r.pivotMode) parts.push(`pivot ${r.pivotBy?.join(', ')}`)
    if (r.needsGrandTotal) parts.push('+ grand total')
    return parts.join(' · ')
  }
</script>

<section class="wrap">
  <header class="chrome">
    <div class="seg dialect-seg" role="group" aria-label="SQL dialect">
      {#each Object.keys(DIALECTS) as d (d)}
        <button type="button" class:is-on={dialect === d} aria-pressed={dialect === d} onclick={() => (dialect = d as DialectName)}>{DIALECT_LABEL[d as DialectName]}</button>
      {/each}
    </div>
    <label class="chk"><input type="checkbox" checked={pivot} onchange={(e) => setPivot(e.currentTarget.checked)} /> Pivot by year</label>
    <span class="note">
      Expand a region, sort a column, open a column filter, type a search, turn the pivot on: each is one
      request, and the panel shows the statements <code>planToSql</code> renders for it in the dialect you
      picked. <code>planQuery</code> admits only fields the schema declares, so a request cannot name a
      column that is not there.
    </span>
  </header>
  <SvRowGroupPanel columns={groupCols} {groupBy} onChange={setGroupBy} />
  <div class="body">
    <div class="gridpane">
      <SvGrid
        responsive={true}
        columnResize
        rowModel={ctl}
        {columns}
        {features}
        sortable
        filterable
        filterMode="menu"
        selectionMode="none"
        rowHeight={32}
        containerHeight="100%"
      />
    </div>
    <aside class="sql" aria-label="SQL for the last request">
      <div class="sql-head">
        <span>Last request</span>
        {#if latest}<span class="muted">{describe(latest.request)} · {latest.ms} ms</span>{/if}
      </div>
      {#if latest}
        {#each statements as st, i (i)}
          <div class="sql-block">
            <div class="sql-label">{st.label}</div>
            <pre class="sql-text">{st.sql}</pre>
            {#if st.params.length}<div class="sql-params">params: {JSON.stringify(st.params)}</div>{/if}
          </div>
        {/each}
      {:else}
        <div class="muted sql-empty">No request yet.</div>
      {/if}
    </aside>
  </div>
</section>

<style>
  .wrap { display: flex; flex-direction: column; flex: 1; gap: 10px; height: 100%; min-height: 0; }
  .chrome { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: none; }
  .note { font-size: 12px; color: var(--sg-muted, #64748b); flex: 1 1 320px; }
  .chk {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
    white-space: nowrap;
  }
  .chk input { accent-color: var(--sg-accent, #2563eb); }
  .seg {
    display: inline-flex;
    flex: none;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
    overflow: hidden;
    background: var(--sg-bg, #fff);
  }
  .seg > button {
    font: inherit;
    font-size: 12px;
    padding: 3px 10px;
    border: 0;
    background: transparent;
    color: var(--sg-fg, #0f172a);
    cursor: pointer;
    white-space: nowrap;
  }
  .seg > button + button { border-left: 1px solid var(--sg-border, #e2e8f0); }
  .seg > button.is-on { background: var(--sg-accent, #2563eb); color: var(--sg-on-accent, #fff); }
  .seg > button:focus-visible { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: -2px; }
  .body { display: flex; gap: 10px; flex: 1; min-height: 0; }
  .gridpane { flex: 1; min-width: 0; min-height: 0; }
  .sql {
    width: 400px;
    flex: none;
    overflow: auto;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    font-size: 12px;
  }
  .sql-head {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    font-weight: 600;
    color: var(--sg-fg, #0f172a);
    background: var(--sg-header-bg, #f8fafc);
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sql-block { padding: 8px 10px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sql-label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--sg-muted, #64748b); margin-bottom: 4px; }
  .sql-text {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--sg-fg, #0f172a);
  }
  .sql-params { margin-top: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; color: var(--sg-muted, #64748b); word-break: break-all; }
  .sql-empty { padding: 10px; }
  .muted { color: var(--sg-muted, #64748b); font-weight: 400; }
  @media (max-width: 900px) {
    .body { flex-direction: column; }
    .sql { width: auto; max-height: 220px; }
  }
</style>
