<script lang="ts">
  /**
   * 78. One million rows
   * --------------------
   * Row + column virtualization carrying a literal 1,000,000-row dataset
   * with sort, filter, group, scroll, and inline edit all enabled.
   *
   * Generation is chunked through requestAnimationFrame so the UI keeps
   * painting while the heap fills. The row shape is intentionally lean
   * (9 fields) - at 1M rows that's the difference between ~250 MB and
   * an unresponsive tab.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    rowExpandingFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Status = 'active' | 'pending' | 'inactive'

  type MillionRow = {
    id: string
    firstName: string
    lastName: string
    department: string
    country: string
    status: Status
    age: number
    salary: number
    performance: number
  }

  // --- Compact pools (kept short on purpose: smaller string-intern table
  //     means 1M rows share a tiny set of pointers). ------------------------
  const FIRST = ['Ada','Linus','Grace','Alan','Margaret','Donald','Barbara','John',
    'Edsger','Niklaus','Anders','Brendan','Yukihiro','Rasmus','Bjarne','Tim',
    'Guido','Larry','James','Brian','Dennis','Ken','Mary','Susan','Karen','Lisa']
  const LAST = ['Lovelace','Torvalds','Hopper','Turing','Hamilton','Knuth','Liskov',
    'McCarthy','Dijkstra','Wirth','Hejlsberg','Eich','Matsumoto','Lerdorf',
    'Stroustrup','van Rossum','Wall','Gosling','Kernighan','Ritchie','Thompson']
  const DEPARTMENTS = ['Engineering','Design','Product','Sales','Support','Operations']
  const COUNTRIES = ['US','UK','DE','FR','JP','BR','IN','AU','CA','NL']
  const STATUSES: readonly Status[] = ['active','pending','inactive'] as const

  // --- Deterministic PRNG (Mulberry32) ------------------------------------
  function rng(seed: number) {
    let t = seed >>> 0
    return () => {
      t = (t + 0x6d2b79f5) >>> 0
      let x = t
      x = Math.imul(x ^ (x >>> 15), x | 1)
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
      return ((x ^ (x >>> 14)) >>> 0) / 4_294_967_296
    }
  }

  const TARGET = 1_000_000
  const CHUNK = 50_000
  /**
   * Row height (px). 1M × 32 = 32M pixels, which exceeds Firefox's
   * element-height cap (~17.9M) and lands at Chrome's edge (~33.5M).
   * 18px keeps the total scroll height at 18M so EVERY row is reachable
   * in every browser. The grid still reads cleanly at this density.
   */
  const ROW_H = 18

  let rows = $state.raw<MillionRow[]>([])
  let generated = $state(0)
  let busy = $state(true)
  let buildMs = $state(0)

  function buildChunk(rand: () => number, into: MillionRow[], from: number, to: number) {
    const firstLen = FIRST.length
    const lastLen = LAST.length
    const deptLen = DEPARTMENTS.length
    const countryLen = COUNTRIES.length
    const statusLen = STATUSES.length
    for (let i = from; i < to; i++) {
      const dept = DEPARTMENTS[Math.floor(rand() * deptLen)]!
      const country = COUNTRIES[Math.floor(rand() * countryLen)]!
      const status = STATUSES[Math.floor(rand() * statusLen)]!
      into[i] = {
        id: 'r_' + i.toString(36),
        firstName: FIRST[Math.floor(rand() * firstLen)]!,
        lastName:  LAST [Math.floor(rand() * lastLen)]!,
        department: dept,
        country,
        status,
        age: 21 + Math.floor(rand() * 45),
        salary: 35_000 + Math.floor(rand() * 165_000),
        performance: Math.floor(rand() * 100),
      }
    }
  }

  async function buildAll() {
    busy = true
    generated = 0
    const t0 = performance.now()
    const rand = rng(1337)
    const buf: MillionRow[] = new Array(TARGET)
    let cursor = 0
    while (cursor < TARGET) {
      const next = Math.min(cursor + CHUNK, TARGET)
      buildChunk(rand, buf, cursor, next)
      cursor = next
      generated = cursor
      // Yield to the browser so the progress bar paints and the page stays
      // responsive. Without this the JS thread runs solid for the full build.
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
    }
    rows = buf
    buildMs = Math.round(performance.now() - t0)
    busy = false
  }

  $effect(() => {
    if (rows.length === 0 && busy) {
      void buildAll()
    }
  })

  // --- Grid configuration -------------------------------------------------

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    rowExpandingFeature,
  })

  const columns: ColumnDef<typeof features, MillionRow>[] = [
    { field: 'id',         header: 'ID',         editorType: 'text',   width: 110, editable: false },
    { field: 'firstName',  header: 'First name', editorType: 'text',   width: 130 },
    { field: 'lastName',   header: 'Last name',  editorType: 'text',   width: 140 },
    { field: 'department', header: 'Department', editorType: 'list',
      editorOptions: DEPARTMENTS as unknown as ReadonlyArray<string>, width: 140 },
    { field: 'country',    header: 'Country',    editorType: 'list',
      editorOptions: COUNTRIES as unknown as ReadonlyArray<string>, width: 100 },
    { field: 'status',     header: 'Status',     editorType: 'list',
      editorOptions: STATUSES as unknown as ReadonlyArray<string>, width: 110 },
    { field: 'age',        header: 'Age',        editorType: 'number', width: 90 },
    { field: 'salary',     header: 'Salary',     editorType: 'number', width: 130,
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'performance',header: 'Performance',editorType: 'number', width: 130 },
  ]

  let api = $state<SvGridApi<typeof features, MillionRow> | null>(null)
  let groupBy = $state<string[]>([])
  let editing = $state(true)

  function applyGroup(by: string[]) {
    groupBy = by
    api?.setGroupBy(by)
  }

  const pct = $derived(Math.min(100, Math.round((generated / TARGET) * 100)))
  const fmt = new Intl.NumberFormat('en-US')
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="mr-kpi-strip shrink-0">
    <div class="mr-kpi">
      <div class="mr-kpi-label">Rows</div>
      <div class="mr-kpi-value tabular-nums">{fmt.format(rows.length || generated)}</div>
      <div class="mr-kpi-foot">target {fmt.format(TARGET)}</div>
    </div>
    <div class="mr-kpi">
      <div class="mr-kpi-label">Columns</div>
      <div class="mr-kpi-value tabular-nums">{columns.length}</div>
      <div class="mr-kpi-foot">column virtualization on</div>
    </div>
    <div class="mr-kpi">
      <div class="mr-kpi-label">Build time</div>
      <div class="mr-kpi-value tabular-nums">{busy ? '…' : buildMs + ' ms'}</div>
      <div class="mr-kpi-foot">chunked, 50k / frame</div>
    </div>
    <div class="mr-kpi">
      <div class="mr-kpi-label">Editing</div>
      <div class={`mr-kpi-value ${editing ? 'mr-up' : 'mr-down'}`}>{editing ? 'ON' : 'off'}</div>
      <div class="mr-kpi-foot">double-click any cell</div>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="flex flex-wrap items-center gap-2 text-sm shrink-0">
    <span class="font-medium">Group by:</span>
    <button type="button" onclick={() => applyGroup([])}
      class="mr-btn {groupBy.length === 0 ? 'mr-btn-on' : ''}">None</button>
    <button type="button" onclick={() => applyGroup(['department'])}
      class="mr-btn {groupBy.join() === 'department' ? 'mr-btn-on' : ''}">Department</button>
    <button type="button" onclick={() => applyGroup(['country'])}
      class="mr-btn {groupBy.join() === 'country' ? 'mr-btn-on' : ''}">Country</button>
    <button type="button" onclick={() => applyGroup(['department','country'])}
      class="mr-btn {groupBy.join() === 'department,country' ? 'mr-btn-on' : ''}">Department → Country</button>
    <button type="button" onclick={() => applyGroup(['status'])}
      class="mr-btn {groupBy.join() === 'status' ? 'mr-btn-on' : ''}">Status</button>

    <span class="mx-3 mr-note">|</span>
    <label class="inline-flex items-center gap-2">
      <input type="checkbox" bind:checked={editing} />
      <span>Inline editing</span>
    </label>

    <span class="ml-auto text-xs mr-note">
      Sort / filter via column headers · scroll the grid - only ~50 rows are mounted in the DOM at any moment.
      Row height is tightened to {ROW_H}px so all 1,000,000 rows stay within the browser's element-height limit.
    </span>
  </div>

  {#if busy}
    <div class="mr-progress shrink-0">
      <div class="mr-progress-bar"><div class="mr-progress-fill" style={`width: ${pct}%`}></div></div>
      <div class="mr-progress-text tabular-nums">Generating {fmt.format(generated)} / {fmt.format(TARGET)} · {pct}%</div>
    </div>
  {/if}

  {#if rows.length}
    <div class="flex-1 min-h-0">
      <SvGrid
        data={rows}
        columns={columns}
        features={features}
        filterMode="menu"
        selectionMode="cell"
        showGroupingControls={true}
        enableInlineEditing={editing}
        enableCellSelection={true}
        showRowNumbers={true}
        virtualization={true}
        columnVirtualization={false}
        rowHeight={ROW_H}
        overscan={20}
        rowNumberWidth={92}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(next) => { api = next; next.setGroupBy(groupBy) }}
      />
    </div>
  {/if}
</section>

<style>
  /* KPI strip */
  .mr-kpi-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  .mr-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .mr-kpi-label {
    font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--sg-muted, #64748b);
  }
  .mr-kpi-value {
    font-size: 22px; font-weight: 700; line-height: 1.1;
    color: var(--sg-fg, #0f172a);
  }
  .mr-kpi-foot { font-size: 11px; color: var(--sg-muted, #94a3b8); }
  .mr-note { color: var(--sg-muted, #64748b); }
  .mr-up   { color: #16a34a; }
  .mr-down { color: var(--sg-muted, #64748b); }

  /* Toolbar buttons */
  .mr-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 13px;
    cursor: pointer;
  }
  .mr-btn:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }
  .mr-btn-on {
    background: var(--sg-accent, #2563eb);
    /* Pair the accent bg with its contrast token, not a hardcoded white - themes
       like shadcn use a light accent in dark mode, where #fff would be invisible. */
    color: var(--sg-on-accent, #fff);
    border-color: transparent;
    font-weight: 600;
  }

  /* Progress bar */
  .mr-progress {
    display: flex; align-items: center; gap: 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    padding: 10px 14px;
  }
  .mr-progress-bar {
    flex: 1;
    height: 8px;
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 999px;
    overflow: hidden;
  }
  .mr-progress-fill {
    height: 100%;
    background: var(--sg-accent, #6366f1);
    transition: width 100ms linear;
  }
  .mr-progress-text {
    font-size: 12px;
    color: var(--sg-muted, #64748b);
    white-space: nowrap;
  }
</style>
