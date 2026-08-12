<script lang="ts">
  /**
   * Data-app Studio · Supabase - the same Studio stack, backed by a REAL,
   * hosted Postgres on Supabase. This is a browser app: it talks to Supabase
   * through `supabase-js` (PostgREST) with your project's *public* anon key,
   * exactly the way a production SvelteKit/SPA screen would. Row-Level Security
   * on the table is what keeps that key safe.
   *
   * It adapts to *your* table: `introspectSupabaseTable` reads the columns from
   * PostgREST (OpenAPI doc, a sample row, or the CSV header) and builds an
   * `EntitySchema`; `createSupabaseDataSource` maps the grid's sort / filter /
   * page / CRUD onto the Supabase query builder. Both are first-class
   * `@svgrid/enterprise` exports - so this demo is mostly connection UI.
   */
  import { SvGrid, SvGridDropdown, createServerDataSource, type ServerState } from '@svgrid/grid'
  import {
    SvGridEditPanel,
    schemaToColumns,
    createSupabaseDataSource,
    createSupabaseRealtime,
    createRelationLookup,
    introspectSupabaseTable,
    type EntitySchema,
    type EntityField,
    type SupabaseRealtimeHandle,
    type RealtimeChange,
    type RelationLookup,
  } from '@svgrid/enterprise'
  import SvGridStudio from '../shared/SvGridStudio.svelte'

  type Row = Record<string, unknown>

  // ---- Connection ---------------------------------------------------------
  // A ready-to-run PUBLIC sample: Northwind hosted on Supabase, read-only for
  // the publishable (anon) key via RLS - so embedding the key here is safe. The
  // setup SQL lives in docs/enterprise/studio/supabase-sample.md. `order_lines`
  // is the five-table JOIN view; switch to `products` / `customers` to browse
  // the base tables (still read-only in the public sample).
  const HOSTED_SAMPLE = {
    url: 'https://rbnnlzgtfzsylllniozo.supabase.co',
    anonKey: 'sb_publishable_SiT7CxGl4Z_Du1opTYbxVA_VQWumPUN',
    table: 'order_lines',
  }

  const LS_KEY = 'svgrid.studio.supabase'
  const saved =
    typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null
  const initial = saved ? JSON.parse(saved) : { url: '', anonKey: '', table: 'customers' }

  let url = $state<string>(initial.url)
  let anonKey = $state<string>(initial.anonKey)
  let table = $state<string>(initial.table || 'customers')

  let connected = $state(false)
  let connecting = $state(false)
  let connectError = $state<string | null>(null)
  let showSql = $state(false)

  // Introspected from the connected table.
  let schema = $state<EntitySchema<Row> | null>(null)
  let columns = $state<ReturnType<typeof schemaToColumns<Row>>>([])
  // Auto-built for detected foreign keys: a searchable picker over the related table.
  let lookups = $state<Record<string, RelationLookup>>({})

  // Live client + table, kept so the manual fallback can activate later.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: any = null
  let tableName = $state('')

  // Manual column entry - shown only when auto-detection can't determine the
  // schema (e.g. an empty table that isn't visible in the OpenAPI doc).
  type ManualCol = { name: string; type: EntityField<Row>['type'] }
  let needManual = $state(false)
  let manualCols = $state<ManualCol[]>([{ name: 'id', type: 'number' }, { name: '', type: 'text' }])
  let manualPk = $state(0)

  let editing = $state<Row | null | undefined>(undefined)
  let selected = $state<Row[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let controller: any

  let view = $state<ServerState<Row>>({
    rows: [], total: 0, loading: false, saving: false, error: null,
    pageIndex: 0, pageSize: 10, pageCount: 1, sortModel: [], filterModel: {},
  })

  const base = $derived(url.trim().replace(/\/+$/, ''))

  // ---- Realtime (Supabase Postgres change streams) ------------------------
  let liveOn = $state(true)
  let live: SupabaseRealtimeHandle | undefined
  let liveUpdates = $state(0)
  let flashIds = $state<Set<string>>(new Set())
  let refreshTimer: ReturnType<typeof setTimeout> | undefined

  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => controller?.refresh(), 250) // coalesce bursts
  }
  function markFlash(id: string) {
    flashIds = new Set(flashIds).add(id)
    setTimeout(() => {
      const next = new Set(flashIds)
      next.delete(id)
      flashIds = next
    }, 1600)
  }
  function subscribeLive() {
    unsubscribeLive()
    if (!client || !tableName) return
    // Refetch the current page on any change (respects sort / filter / page),
    // and flash the row that changed. debounceMs: 0 so we see every event for
    // the flash; scheduleRefresh() coalesces the refetches.
    live = createSupabaseRealtime<Row>({
      client,
      table: tableName,
      onChange: (change: RealtimeChange<Row>) => {
        const idField = schema?.idField ?? 'id'
        const id = change.new?.[idField] ?? change.old?.[idField]
        if (id != null) markFlash(String(id))
        liveUpdates += 1
        scheduleRefresh()
      },
    })
  }
  function unsubscribeLive() {
    live?.unsubscribe()
    live = undefined
    if (refreshTimer) clearTimeout(refreshTimer)
  }
  function toggleLive() {
    liveOn = !liveOn
    if (!connected) return
    if (liveOn) subscribeLive()
    else unsubscribeLive()
  }

  // For each detected foreign-key (relation) field, introspect the related
  // table and build a lookup, so the edit form gets a searchable picker with no
  // manual wiring. Best-effort: a relation whose table isn't reachable is
  // skipped (the field falls back to a plain input).
  async function buildLookups(sch: EntitySchema<Row>) {
    const next: Record<string, RelationLookup> = {}
    for (const f of sch.fields) {
      const rel = f.relation
      if (f.type !== 'relation' || !rel) continue
      try {
        const relSchema = await introspectSupabaseTable<Row>({ url: base, key: anonKey.trim(), table: rel.entity })
        if (!relSchema) continue
        const relSource = createSupabaseDataSource<Row>({ client, table: rel.entity, schema: relSchema })
        next[f.field] = createRelationLookup<Row>({ source: relSource, schema: relSchema, labelField: rel.labelField })
      } catch {
        /* related table not reachable - skip */
      }
    }
    lookups = next
  }

  // Wire an introspected schema up to the grid + controller. The whole data
  // layer is one call to createSupabaseDataSource.
  function activate(sch: EntitySchema<Row>) {
    schema = sch
    columns = schemaToColumns(sch)
    lookups = {}
    buildLookups(sch) // async, populates the form's FK pickers
    const source = createSupabaseDataSource<Row>({ client, table: tableName, schema: sch })
    controller = createServerDataSource<Row>(source, {
      pageSize: 10,
      optimistic: true,
      getRowId: (r) => String(r[sch.idField!]),
      onChange: (s) => (view = s),
    })
    controller.refresh()
    localStorage.setItem(LS_KEY, JSON.stringify({ url: base, anonKey: anonKey.trim(), table: tableName }))
    needManual = false
    connected = true
    liveUpdates = 0
    if (liveOn) subscribeLive()
  }

  function useHostedSample() {
    url = HOSTED_SAMPLE.url
    anonKey = HOSTED_SAMPLE.anonKey
    table = HOSTED_SAMPLE.table
    connect()
  }

  async function connect() {
    connectError = null
    needManual = false
    if (!url.trim() || !anonKey.trim()) {
      connectError = 'Enter your Supabase URL and anon key.'
      return
    }
    connecting = true
    try {
      // Variable specifier so tsc doesn't try to resolve the CDN URL as a module.
      const cdn = 'https://esm.sh/@supabase/supabase-js@2'
      const { createClient } = await import(/* @vite-ignore */ cdn)
      client = createClient(base, anonKey.trim())
      tableName = table.trim()

      // Detect the table's columns straight from PostgREST. Returns null only
      // when the table is empty AND its schema isn't exposed - then we ask the
      // user to list the columns.
      const sch = await introspectSupabaseTable<Row>({ url: base, key: anonKey.trim(), table: tableName })
      if (sch) { activate(sch); return }
      // introspect couldn't map the columns (e.g. a stale / CORS-blocked OpenAPI
      // doc short-circuiting before the sample-row path). If the table is
      // readable, build the schema straight from one row here, so a readable
      // table always renders instead of dropping to manual entry.
      const fromRow = await schemaFromSampleRow(base, anonKey.trim(), tableName)
      if (fromRow) { activate(fromRow); return }
      // Truly unreadable - say WHY instead of silently offering manual entry.
      connectError = await diagnoseNoColumns(base, anonKey.trim(), tableName)
      needManual = true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      connectError = /failed to fetch|networkerror|load failed/i.test(msg)
        ? 'Could not reach Supabase. Check the Project URL (https://xxxx.supabase.co) and your network.'
        : msg
    } finally {
      connecting = false
    }
  }

  // Build a schema directly from one sample row - the most reliable fallback,
  // since it only needs the table to be readable (a `select` policy for anon).
  async function schemaFromSampleRow(baseUrl: string, key: string, tbl: string): Promise<EntitySchema<Row> | null> {
    try {
      const res = await fetch(`${baseUrl}/rest/v1/${encodeURIComponent(tbl)}?select=*&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      if (!res.ok) return null
      const rows = (await res.json().catch(() => null)) as unknown
      const sample = Array.isArray(rows) ? rows[0] : undefined
      if (!sample || typeof sample !== 'object') return null
      const keys = Object.keys(sample as Row)
      if (!keys.length) return null
      const idKey = keys.find((k) => /^id$/i.test(k)) ?? keys[0]!
      const fields: EntityField<Row>[] = keys.map((k) => {
        const v = (sample as Row)[k]
        const type: EntityField<Row>['type'] =
          typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'text'
        const f: EntityField<Row> = { field: k, type }
        if (k === idKey) { f.primaryKey = true; f.readonly = true }
        return f
      })
      return { name: tbl, label: tbl, idField: idKey, fields }
    } catch {
      return null
    }
  }

  // When auto-detection finds no columns, hit the REST endpoint directly and
  // turn the HTTP status into a specific, actionable message.
  async function diagnoseNoColumns(baseUrl: string, key: string, tbl: string): Promise<string> {
    try {
      const res = await fetch(`${baseUrl}/rest/v1/${encodeURIComponent(tbl)}?select=*&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      if (res.status === 404) {
        return `Table "${tbl}" isn't visible to Supabase's REST API. Check the table name above, or refresh PostgREST's cache: run  notify pgrst, 'reload schema';  in the SQL Editor.`
      }
      if (res.status === 401 || res.status === 403) {
        return `The anon key can't read "${tbl}". Add an RLS select policy for the anon role (see the setup SQL), or double-check the key.`
      }
      const body = (await res.json().catch(() => null)) as unknown
      if (Array.isArray(body) && body.length === 0) {
        return `"${tbl}" is reachable but returned 0 rows - an RLS policy is filtering them out for anon. Add:  create policy "anon read" on ${tbl} for select to anon using (true);`
      }
      return `Reached "${tbl}" but couldn't read its columns automatically - list them below.`
    } catch {
      return `Couldn't reach ${baseUrl}. Check the Project URL and your network.`
    }
  }

  // Manual fallback: build the schema from the user-listed columns.
  function addManualCol() { manualCols = [...manualCols, { name: '', type: 'text' }] }
  function removeManualCol(i: number) {
    manualCols = manualCols.filter((_, idx) => idx !== i)
    if (manualPk >= manualCols.length) manualPk = 0
  }
  function applyManual() {
    connectError = null
    const cols = manualCols.map((c) => ({ ...c, name: c.name.trim() })).filter((c) => c.name)
    if (!cols.length) { connectError = 'Add at least one column.'; return }
    const pkName = (manualCols[manualPk]?.name ?? cols[0].name).trim() || cols[0].name
    const fields: EntityField<Row>[] = cols.map((c) => {
      const f: EntityField<Row> = { field: c.name, type: c.type }
      if (c.name === pkName) { f.primaryKey = true; f.readonly = true }
      return f
    })
    activate({ name: tableName, label: tableName, idField: pkName, fields })
  }

  function disconnect() {
    unsubscribeLive()
    controller?.dispose?.()
    controller = undefined
    connected = false
    needManual = false
    schema = null
    columns = []
    lookups = {}
    selected = []
    editing = undefined
    view = { ...view, rows: [], total: 0 }
  }

  async function save({ mode, id, values }: { mode: 'create' | 'edit'; id: string | null; values: Partial<Row> }) {
    if (mode === 'create') {
      await controller.createRow(values)
      controller.setPage(view.pageCount - 1) // jump to the new row (appended at the end)
    } else if (id) {
      await controller.updateRow(id, values)
    }
    editing = undefined
  }
  async function removeSelected() {
    const idField = schema?.idField ?? 'id'
    for (const row of selected) await controller.deleteRow(String(row[idField]))
    selected = []
  }

  const host = $derived.by(() => {
    try { return new URL(url).host } catch { return url }
  })

  const setupSql = `-- Optional: a ready-made table to try. Run once in the Supabase SQL editor.
-- (Or just connect to any existing table - the grid adapts to its columns.)
create table if not exists customers (
  id     bigint generated always as identity primary key,
  name   text not null,
  email  text not null,
  tier   text,
  mrr    integer,
  active boolean default true
);

insert into customers (name, email, tier, mrr, active) values
  ('Ada Lovelace',      'ada@analytic.io',        'enterprise', 1200, true),
  ('Alan Turing',       'alan@bletchley.uk',      'pro',         240, true),
  ('Grace Hopper',      'grace@navy.mil',         'enterprise',  980, true),
  ('Edsger Dijkstra',   'edsger@shortest.path',   'free',          0, false),
  ('Barbara Liskov',    'barbara@substitution.dev','pro',         300, true),
  ('Donald Knuth',      'don@taocp.org',          'enterprise', 1500, true),
  ('Margaret Hamilton', 'margaret@apollo.space',  'pro',         420, true),
  ('Tim Berners-Lee',   'tim@w3.org',             'enterprise', 1100, true),
  ('Linus Torvalds',    'linus@kernel.org',       'pro',         360, true),
  ('Katherine Johnson', 'katherine@nasa.gov',     'enterprise',  890, true),
  ('Dennis Ritchie',    'dmr@bell-labs.com',      'pro',         275, false),
  ('Radia Perlman',     'radia@spanning.tree',    'enterprise',  760, true);

-- Enable RLS and let the public anon key read + write, so this demo works.
-- In a real app, scope these policies to authenticated users instead.
alter table customers enable row level security;
create policy "svgrid demo access" on customers
  for all to anon using (true) with check (true);`

  async function copySql() {
    try { await navigator.clipboard.writeText(setupSql) } catch { /* ignore */ }
  }
</script>

<SvGridStudio
  title="Supabase"
  subtitle="A live CRUD screen over <strong>hosted Postgres on Supabase</strong>, straight from the browser via <code>supabase-js</code>."
>
  {#snippet actions()}
    {#if connected}
      <span class="st-badge st-badge--live">● {host} · {table} · live</span>
    {:else}
      <span class="st-badge">Bring your own Supabase project</span>
    {/if}
  {/snippet}

  {#if !connected}
    <div class="sb__connect">
      <div class="sb__sample">
        <div>
          <strong>In a hurry?</strong> Load a read-only public sample - the
          <em>Northwind</em> database hosted on Supabase.
        </div>
        <button class="st-btn st-btn--primary" onclick={useHostedSample} disabled={connecting}>
          {connecting ? 'Connecting…' : 'Try the hosted sample'}
        </button>
      </div>

      <div class="sb__or"><span>or connect your own project</span></div>

      <ol class="sb__steps">
        <li>
          <strong>Point it at a table.</strong> The grid <em>adapts to your table's
          columns</em> automatically. Don't have one handy? Open the Supabase
          <em>SQL Editor</em> and run our sample script (a <code>customers</code>
          table with 12 rows and an open RLS policy for the demo).
          <button class="sb__link" onclick={() => (showSql = !showSql)}>
            {showSql ? 'Hide' : 'Show'} sample SQL
          </button>
          <button class="sb__link" onclick={copySql}>Copy</button>
          {#if showSql}
            <pre class="sb__sql">{setupSql}</pre>
          {/if}
        </li>
        <li>
          <strong>Get your keys.</strong> <em>Project Settings → API</em>: copy the
          <em>Project URL</em> and the <em>anon public</em> key. The anon key is safe
          in the browser - RLS is what protects your data.
        </li>
        <li><strong>Connect.</strong> Paste them below and name the table.</li>
      </ol>

      <div class="sb__form">
        <label>
          <span>Project URL</span>
          <input type="url" placeholder="https://xxxxxxxx.supabase.co" bind:value={url} />
        </label>
        <label>
          <span>Anon public key</span>
          <input type="password" placeholder="eyJhbGciOiJI..." bind:value={anonKey} />
        </label>
        <label class="sb__form-table">
          <span>Table</span>
          <input type="text" placeholder="customers" bind:value={table} />
        </label>
        <button class="st-btn st-btn--primary" onclick={connect} disabled={connecting}>
          {connecting ? 'Connecting…' : 'Connect'}
        </button>
      </div>

      {#if connectError}
        <p class="sb__error">⚠ {connectError}</p>
      {/if}

      {#if needManual}
        <div class="sb__manual">
          <p class="sb__manual-head">
            Connected to <strong>{tableName}</strong>, but its columns couldn't be
            detected automatically - the table is empty and its schema isn't exposed
            to the anon key. List its columns and pick the primary key:
          </p>
          {#each manualCols as col, i (i)}
            <div class="sb__manual-row">
              <input type="radio" name="pk" title="Primary key" checked={manualPk === i} onchange={() => (manualPk = i)} />
              <input type="text" placeholder="column name" bind:value={col.name} />
              <div class="sb__manual-type">
                <SvGridDropdown
                  options={[{ value: 'text', label: 'text' }, { value: 'number', label: 'number' }, { value: 'boolean', label: 'boolean' }]}
                  value={col.type}
                  autoOpen={false}
                  onChange={(v) => (col.type = v as EntityField<Row>['type'])}
                />
              </div>
              <button class="sb__icon" title="Remove" onclick={() => removeManualCol(i)} disabled={manualCols.length <= 1}>×</button>
            </div>
          {/each}
          <div class="sb__manual-actions">
            <button class="st-btn" onclick={addManualCol}>+ Add column</button>
            <button class="st-btn st-btn--primary" onclick={applyManual}>Use these columns</button>
          </div>
          <p class="sb__note">Tip: to skip this next time, add a select policy so the schema is visible, or insert one row.</p>
        </div>
      {/if}

      <p class="sb__note">
        Keys are stored only in this browser's <code>localStorage</code> and used
        solely to reach your project. Nothing is sent to svgrid.com.
      </p>
    </div>
  {:else}
    <div class="sb__toolbar">
      <button class="st-btn st-btn--primary" onclick={() => (editing = null)}>+ New row</button>
      <button disabled={selected.length === 0} onclick={removeSelected}>
        Delete{selected.length ? ` (${selected.length})` : ''}
      </button>
      <span class="sb__spacer"></span>
      <button class="st-btn sb__live" class:is-on={liveOn} onclick={toggleLive}
        title="Realtime: refetch + flash rows on any database change">
        <span class="sb__dot"></span>{liveOn ? 'Live' : 'Paused'}{liveUpdates ? ` · ${liveUpdates}` : ''}
      </button>
      <button class="st-btn st-btn--ghost" onclick={disconnect}>Disconnect</button>
    </div>

    {#if view.error}
      <p class="sb__error">⚠ {String((view.error as Error)?.message ?? view.error)}</p>
    {/if}

    <SvGrid responsive={true}
      data={view.rows}
      {columns}
      loading={view.loading}
      fitColumns
      enableRowSummaries={false}
      rowClass={(ctx) => (schema && flashIds.has(String(ctx.row[schema.idField!])) ? 'sb-flash' : '')}
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
      onPaginationChange={({ pageIndex, pageSize }) => {
        if (pageSize !== view.pageSize) controller.setPageSize(pageSize)
        else controller.setPage(pageIndex)
      }}
      containerHeight={340}
    />

    {#if editing !== undefined && schema}
      <SvGridEditPanel {schema} row={editing} presentation="modal" persistKey="studio" {lookups} onSubmit={save} onCancel={() => (editing = undefined)} />
    {/if}
  {/if}
</SvGridStudio>

<style>
  .sb__connect { border: 1px solid var(--sg-border, #e2e2e2); border-radius: 10px; padding: 16px 18px; background: var(--sg-bg, #fff); display: flex; flex-direction: column; gap: 14px; }
  .sb__sample { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 12px 14px; border: 1px solid color-mix(in srgb, var(--sg-accent, #2563eb) 35%, var(--sg-border, #e2e2e2)); border-radius: 10px; background: color-mix(in srgb, var(--sg-accent, #2563eb) 6%, transparent); font-size: 13px; line-height: 1.5; }
  .sb__sample > div { flex: 1 1 260px; }
  .sb__sample .st-btn { flex: 0 0 auto; }
  .sb__or { display: flex; align-items: center; gap: 10px; color: var(--sg-muted, #999); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; }
  .sb__or::before, .sb__or::after { content: ''; flex: 1 1 auto; height: 1px; background: var(--sg-border, #e2e2e2); }
  .sb__steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 13px; line-height: 1.5; }
  .sb__steps code { background: var(--sg-header-bg, #f2f2f2); padding: 1px 5px; border-radius: 3px; }
  .sb__link { border: none; background: none; color: var(--sg-accent, #2563eb); cursor: pointer; font: inherit; padding: 0 4px; text-decoration: underline; }
  .sb__sql { margin: 8px 0 0; padding: 12px; background: var(--sg-header-bg, #0f172a0a); border: 1px solid var(--sg-border, #e2e2e2); border-radius: 8px; font-size: 11.5px; line-height: 1.45; overflow: auto; max-height: 240px; white-space: pre; }

  .sb__form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; }
  .sb__form label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #555); flex: 1 1 220px; }
  .sb__form-table { flex: 0 0 130px; }
  .sb__form input { padding: 8px 11px; border: 1px solid var(--sg-border, #ccc); border-radius: 10px; background: var(--sg-input-bg, #fff); color: var(--sg-fg, inherit); font: inherit; }
  .sb__form .st-btn { flex: 0 0 auto; }

  .sb__note { margin: 0; font-size: 11.5px; color: var(--sg-muted, #999); }
  .sb__error { margin: 0; font-size: 13px; color: #dc2626; white-space: pre-line; }

  .sb__manual { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border: 1px solid var(--sg-border, #e2e2e2); border-radius: 8px; background: var(--sg-header-bg, #f8fafc); }
  .sb__manual-head { margin: 0 0 4px; font-size: 12.5px; line-height: 1.5; color: var(--sg-muted, #555); }
  .sb__manual-row { display: flex; align-items: center; gap: 8px; }
  .sb__manual-row input[type='text'] { flex: 1 1 auto; padding: 6px 9px; border: 1px solid var(--sg-border, #ccc); border-radius: 6px; background: var(--sg-input-bg, #fff); color: var(--sg-fg, inherit); font: inherit; }
  .sb__manual-type { flex: 0 0 120px; position: relative; height: 34px; border: 1px solid var(--sg-border, #ccc); border-radius: 10px; background: var(--sg-input-bg, #fff); }
  .sb__manual-type :global(.sv-grid-dropdown), .sb__manual-type :global(.sv-grid-dropdown-trigger) { background: transparent; border-radius: 10px; }
  .sb__icon { flex: 0 0 auto; width: 28px; padding: 4px 0; border: 1px solid var(--sg-border, #ccc); border-radius: 6px; background: var(--sg-bg, #fff); color: var(--sg-muted, #666); cursor: pointer; font-size: 16px; line-height: 1; }
  .sb__icon:disabled { opacity: 0.4; cursor: default; }
  .sb__manual-actions { display: flex; gap: 8px; margin-top: 2px; }

  .sb__toolbar { display: flex; align-items: center; gap: 8px; }
  .sb__spacer { flex: 1 1 auto; }

  .sb__live { display: inline-flex; align-items: center; gap: 6px; }
  .sb__live .sb__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--sg-muted, #94a3b8); flex: 0 0 auto; }
  .sb__live.is-on { color: #16a34a !important; border-color: color-mix(in srgb, #16a34a 40%, transparent) !important; }
  .sb__live.is-on .sb__dot { background: #16a34a; animation: sb-pulse 1.6s ease-out infinite; }
  @keyframes sb-pulse {
    0% { box-shadow: 0 0 0 0 color-mix(in srgb, #16a34a 55%, transparent); }
    70% { box-shadow: 0 0 0 6px transparent; }
    100% { box-shadow: 0 0 0 0 transparent; }
  }

  /* Grid rows render outside this component's style scope - target globally. */
  :global(.sv-grid-row.sb-flash td) { animation: sb-flash 1.6s ease-out; }
  @keyframes sb-flash {
    from { background: color-mix(in srgb, #16a34a 32%, transparent); }
    to { background: transparent; }
  }
</style>
