<!-- Documented in: docs/help/server/server-selection.md -->
<script lang="ts">
  /**
   * 471. Server selection: select all, minus these
   * ----------------------------------------------
   * The header checkbox selects every row the filter matches, loaded or not,
   * and the selection becomes a rule rather than a list: "all, except these
   * ids", or per group under grouping. The panel shows that rule live, as
   * `getSelectionState()` reports it; Save and Restore round-trip it; a bulk
   * action sends the rule to the server as one `updateWhere` and the
   * affected count comes back. The count chip on the selection bar is the
   * server's number, not the number of ticks on screen.
   *
   * The row model and the selection rules are Enterprise; the datasource
   * contract the in-memory reference source implements is free.
   */
  import { SvGrid, renderComponent, tableFeatures, rowSortingFeature, columnFilteringFeature, rowSelectionFeature, type GridColumns, type SvGridApi } from '@svgrid/grid'
  import {
    setLicenseKey,
    installEnterprise,
    createInMemoryDataSource,
    createServerRowModel,
    serverGroupText,
    SvGroupCell,
    type EntitySchema,
    type ServerRowModel,
    type ServerRowModelState,
    type ServerRowModelGridRow,
    type ServerSelectionState,
    type ServerGroupSelectionNode,
  } from '@svgrid/enterprise'
  import { createPrng } from '../shared/mock-api'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature, rowSelectionFeature })

  // ---- The server ----------------------------------------------------------
  type Subscriber = { id: number; email: string; plan: string; status: string; country: string; mrr: number; signedUp: string }
  const PLANS = ['Free', 'Pro', 'Team']
  const STATUS = ['active', 'active', 'active', 'paused', 'churned']
  const COUNTRIES = ['US', 'DE', 'UK', 'FR', 'JP', 'BR', 'IN', 'AU', 'CA', 'NL']
  const NAMES = ['ada', 'grace', 'linus', 'margaret', 'ken', 'barbara', 'dennis', 'donald', 'brian', 'tim']
  const ROWS = 100_000
  const rng = createPrng(0x5e1ec7)
  const DB: Subscriber[] = Array.from({ length: ROWS }, (_, i) => {
    const plan = rng.pick(PLANS)
    return {
      id: i + 1,
      email: `${rng.pick(NAMES)}.${(i + 1).toString(36)}@example.com`,
      plan,
      status: rng.pick(STATUS),
      country: rng.pick(COUNTRIES),
      mrr: plan === 'Free' ? 0 : plan === 'Pro' ? rng.int(9, 29) : rng.int(49, 199),
      signedUp: new Date(Date.UTC(2026, 8, 17) - rng.int(0, 900) * 86_400_000).toISOString().slice(0, 10),
    }
  })
  const schema: EntitySchema<Subscriber> = {
    name: 'subscribers',
    fields: [
      { field: 'id', type: 'number', primaryKey: true, readonly: true },
      { field: 'email', type: 'text' },
      { field: 'plan', type: 'text' },
      { field: 'status', type: 'text' },
      { field: 'country', type: 'text' },
      { field: 'mrr', type: 'number' },
      { field: 'signedUp', type: 'date' },
    ],
  }
  // The reference backend: sort, filter, group, count and `updateWhere` (the
  // bulk edit by rule) over the array, behind a little latency.
  const memory = createInMemoryDataSource(DB, schema)
  let requests = $state(0)
  let lastBulk = $state('')
  const source: typeof memory = {
    ...memory,
    async getRows(req) {
      requests += 1
      await new Promise((r) => setTimeout(r, 120))
      return memory.getRows(req)
    },
    async updateWhere(filterModel, patch, rule) {
      await new Promise((r) => setTimeout(r, 200))
      const n = await memory.updateWhere(filterModel, patch, rule)
      lastBulk = `updateWhere: ${n.toLocaleString()} rows set to ${JSON.stringify(patch)}`
      return n
    },
  }

  // ---- The model ---------------------------------------------------------
  type Mode = 'flat' | 'grouped'
  type Row = ServerRowModelGridRow<Subscriber>
  let mode = $state<Mode>('flat')
  let view = $state<ServerRowModelState<Subscriber>>()
  let ctl = $state.raw<ServerRowModel<Subscriber>>(makeModel('flat'))
  function makeModel(m: Mode) {
    const model = createServerRowModel<Subscriber>(source, {
      groupBy: m === 'grouped' ? ['plan'] : [],
      // The count on the grand total is what makes "100,000 selected" a
      // number the model can stand behind under grouping.
      aggregations: [
        { col: 'mrr', fn: 'sum' },
        { col: 'id', fn: 'count' },
      ],
      grandTotalRow: 'pinnedBottom',
      getRowId: (r) => String(r.id),
      childCount: (r) => (r as { childCount?: number }).childCount,
      isGroupOpenByDefault: () => true,
      // Flat: one rule, "all except these". Grouped: a ticked plan ticks
      // its subscribers, loaded or not, and a leaf unticked under it is an
      // exception on that plan.
      selection: { groupSelects: m === 'grouped' ? 'descendants' : 'self' },
      blockSize: 100,
      skeletonRows: 5,
      filterValues: async (columnId) => [...new Set(DB.map((r) => String(r[columnId as keyof Subscriber])))].sort(),
      onChange: (s) => (view = s),
    })
    model.refresh()
    return model
  }
  function setMode(next: Mode) {
    if (next === mode) return
    ctl.dispose()
    mode = next
    saved = null
    ctl = makeModel(next)
  }
  $effect(() => () => ctl.dispose())

  // ---- The rule ------------------------------------------------------------
  type Rule = ServerSelectionState | ServerGroupSelectionNode
  const rule = $derived.by((): Rule | null => {
    void view
    return ctl.getSelectionState()
  })
  const selectedCount = $derived.by(() => {
    void view
    return ctl.selection?.selectedCount?.() ?? 0
  })
  // The rule as JSON, with long exception lists folded so it stays readable.
  const ruleText = $derived.by(() => {
    if (!rule) return 'null'
    const fold = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.length > 12 ? [...v.slice(0, 12), `... ${v.length - 12} more`] : v
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fold(x)]))
      return v
    }
    return JSON.stringify(fold(rule), null, 2)
  })
  let saved = $state<Rule | null>(null)
  function save() {
    saved = ctl.getSelectionState()
  }
  function restore() {
    if (saved) ctl.setSelectionState(saved)
  }
  async function bulk(patch: Partial<Subscriber>) {
    if (!selectedCount) return
    await ctl.bulkUpdate(patch)
  }
  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  // The leaf total: the count aggregate on the grand total, which is what
  // the selection model divides by too.
  const total = $derived(Number(view?.grandTotal?.id ?? view?.rowCount ?? ROWS))

  // ---- Columns --------------------------------------------------------------
  const usd = { type: 'number' as const, options: { style: 'currency' as const, currency: 'USD', maximumFractionDigits: 0 } }
  const groupColumn: GridColumns<Row>[number] = {
    id: 'group',
    header: 'Plan',
    width: 200,
    sortable: false,
    filterable: false,
    fieldFn: (row) => serverGroupText(row, 'email'),
    cell: (ctx) =>
      renderComponent(SvGroupCell, {
        row: ctx.row.original,
        onToggle: () => ctl.group.onToggle(ctx.row.original),
        leafField: 'email',
      }),
  }
  const idColumn: GridColumns<Row>[number] = {
    field: 'id',
    header: 'Id',
    width: 70,
    align: 'right',
    editable: false,
    formatter: ({ value, row }) => (row?.original.__group?.kind === 'leaf' ? String(value) : ''),
  }
  const rest: GridColumns<Row> = [
    { field: 'status', header: 'Status', width: 90, editorType: 'select', editorOptions: ['active', 'paused', 'churned'] },
    { field: 'country', header: 'Country', width: 80 },
    { field: 'mrr', header: 'MRR', width: 90, align: 'right', format: usd },
    { field: 'signedUp', header: 'Signed up', width: 110 },
  ]
  const flatColumns: GridColumns<Row> = [
    idColumn,
    // The pinned grand total is formatted from the accessor with no row.
    { field: 'email', header: 'Email', width: 200, formatter: ({ value, row }) => (row ? String(value ?? '') : 'Grand total') },
    { field: 'plan', header: 'Plan', width: 80 },
    ...rest,
  ]
  const groupedColumns: GridColumns<Row> = [groupColumn, idColumn, ...rest]
  const columns = $derived(mode === 'grouped' ? groupedColumns : flatColumns)
</script>

<section class="wrap">
  <header class="chrome">
    <div class="seg mode-seg" role="group" aria-label="Layout">
      <button type="button" class:is-on={mode === 'flat'} aria-pressed={mode === 'flat'} onclick={() => setMode('flat')}>Flat</button>
      <button type="button" class:is-on={mode === 'grouped'} aria-pressed={mode === 'grouped'} onclick={() => setMode('grouped')}>Grouped by plan</button>
    </div>
    <div class="actions">
      <button type="button" class="btn" disabled={!selectedCount} onclick={() => bulk({ status: 'paused' })} title="One updateWhere with the rule; the server answers with the count it changed">Pause selected</button>
      <button type="button" class="btn" disabled={!selectedCount} onclick={() => bulk({ status: 'active' })}>Activate selected</button>
      <button type="button" class="btn" disabled={!rule} onclick={save}>Save rule</button>
      <button type="button" class="btn" disabled={!saved} onclick={restore}>Restore rule</button>
    </div>
    <span class="note">
      Tick the header checkbox: 100,000 rows are selected and the grid has loaded a hundred. Untick a few
      and the rule reads "all except these"; open a column filter first and the rule applies to the
      filtered set. Under grouping a plan ticks its subscribers, loaded or not.
    </span>
  </header>
  <div class="body">
    <div class="gridpane">
      {#key mode}
        <SvGrid
          responsive={true}
          columnResize
          rowModel={ctl}
          {columns}
          {features}
          sortable
          filterable
          filterMode="menu"
          showRowSelection
          selectionBar={['selectAll', 'editFields']}
          rowHeight={32}
          containerHeight="100%"
          onApiReady={(next) => (api = installEnterprise(next))}
        />
      {/key}
    </div>
    <aside class="rule" aria-label="Selection rule">
      <div class="rule-head">getSelectionState() <span class="muted">live</span></div>
      <pre class="rule-body">{ruleText}</pre>
      {#if saved}<div class="rule-saved">Saved: {'selectAll' in saved ? `${saved.selectAll ? 'all' : 'none'}, ${saved.toggled.length} exception${saved.toggled.length === 1 ? '' : 's'}` : 'a per-plan rule'}</div>{/if}
    </aside>
  </div>
  <footer class="foot">
    <span class="stat" data-stat="selected"><span class="stat-label">Selected</span><strong>{selectedCount.toLocaleString()}</strong> of {total.toLocaleString()}</span>
    <span class="stat"><span class="stat-label">Loaded</span><strong>{(view?.gridRows.filter((r) => r.__group?.kind === 'leaf').length ?? 0).toLocaleString()}</strong> rows</span>
    <span class="stat"><span class="stat-label">Requests</span><strong>{requests}</strong></span>
    {#if lastBulk}<span class="stat last">{lastBulk}</span>{/if}
  </footer>
</section>

<style>
  .wrap { display: flex; flex-direction: column; flex: 1; gap: 10px; height: 100%; min-height: 0; }
  .chrome { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: none; }
  .note { font-size: 12px; color: var(--sg-muted, #64748b); flex: 1 1 320px; }
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
  .actions { display: inline-flex; gap: 4px; flex-wrap: wrap; }
  .btn {
    font: inherit;
    font-size: 13px;
    padding: 5px 12px;
    border-radius: 6px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    cursor: pointer;
    white-space: nowrap;
  }
  .btn:hover:not(:disabled) { background: var(--sg-row-hover-bg, #f8fafc); }
  .btn:disabled { opacity: 0.45; cursor: default; }
  .body { display: flex; gap: 10px; flex: 1; min-height: 0; }
  .gridpane { flex: 1; min-width: 0; min-height: 0; }
  .rule {
    width: 280px;
    flex: none;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    font-size: 12px;
  }
  .rule-head {
    padding: 8px 10px;
    font-weight: 600;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: var(--sg-fg, #0f172a);
    background: var(--sg-header-bg, #f8fafc);
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px 10px 0 0;
  }
  .rule-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    margin: 0;
    padding: 10px;
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--sg-fg, #0f172a);
  }
  .rule-saved { padding: 8px 10px; border-top: 1px solid var(--sg-border, #e2e8f0); color: var(--sg-muted, #64748b); }
  .muted { color: var(--sg-muted, #64748b); font-weight: 400; font-family: inherit; }
  .foot {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    flex: none;
    align-items: center;
    padding: 6px 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    background: var(--sg-header-bg, #f8fafc);
    font-size: 12px;
    color: var(--sg-muted, #64748b);
    font-variant-numeric: tabular-nums;
  }
  .stat { display: inline-flex; align-items: baseline; gap: 5px; white-space: nowrap; }
  .stat.last { white-space: normal; color: var(--sg-fg, #0f172a); }
  .stat-label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
  .foot strong { color: var(--sg-fg, #0f172a); font-weight: 600; }
  @media (max-width: 900px) {
    .body { flex-direction: column; }
    .rule { width: auto; max-height: 180px; }
  }
</style>
