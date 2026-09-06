<script lang="ts">
  /**
   * 139. AG Grid ←→ sv-grid side-by-side
   * ------------------------------------
   * Two real grids over the SAME data: AG Grid Community on the left,
   * sv-grid on the right. Same column definitions, same rows, both
   * mounted live. Click headers to sort; type in the global filter to
   * narrow.
   *
   * Below each grid: the actual code that mounted it. Copy either side
   * to lift the recipe into your app.
   */
  import { onMount } from 'svelte'
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type GridColumns,
    type SvGridApi,
  } from '@svgrid/grid'

  // ---- Shared data ---------------------------------------------------
  type Deal = { id: number; company: string; region: string; rep: string; arr: number; stage: string }
  const deals: Deal[] = [
    { id: 1,  company: 'Acme',     region: 'AMER', rep: 'Ada Lovelace',    arr: 482000, stage: 'Won' },
    { id: 2,  company: 'Globex',   region: 'EMEA', rep: 'Linus Torvalds',  arr: 218000, stage: 'Negotiation' },
    { id: 3,  company: 'Initech',  region: 'APAC', rep: 'Grace Hopper',    arr: 94000,  stage: 'Proposal' },
    { id: 4,  company: 'Umbrella', region: 'AMER', rep: 'Donald Knuth',    arr: 615000, stage: 'Won' },
    { id: 5,  company: 'Vandelay', region: 'EMEA', rep: 'Tim Berners-Lee', arr: 162000, stage: 'Discovery' },
    { id: 6,  company: 'Pied P.',  region: 'APAC', rep: 'Linda Petersen',  arr: 47000,  stage: 'Won' },
    { id: 7,  company: 'Hooli',    region: 'AMER', rep: 'Sven Andersson',  arr: 1102000,stage: 'Negotiation' },
    { id: 8,  company: 'Wonka',    region: 'EMEA', rep: 'Yuki Tanaka',     arr: 305000, stage: 'Won' },
    { id: 9,  company: 'Tyrell',   region: 'APAC', rep: 'Mei Chen',        arr: 72000,  stage: 'Proposal' },
    { id: 10, company: 'Stark',    region: 'AMER', rep: 'Raj Patel',       arr: 858000, stage: 'Won' },
    { id: 11, company: 'Wayne',    region: 'EMEA', rep: 'Anders Hejlsberg',arr: 411000, stage: 'Negotiation' },
    { id: 12, company: 'Cyberdyne',region: 'APAC', rep: 'Jin Park',        arr: 188000, stage: 'Discovery' },
  ]

  let globalFilter = $state('')

  // ---- sv-grid (right) -----------------------------------------------
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const svColumns: GridColumns<Deal> = [
    { field: 'id',      header: 'ID',      width: 60  },
    { field: 'company', header: 'Company', width: 140 },
    { field: 'region',  header: 'Region',  width: 90  },
    { field: 'rep',     header: 'Sales rep', width: 160 },
    { field: 'arr',     header: 'ARR',     width: 130, align: 'right',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'stage',   header: 'Stage',   width: 130 },
  ]
  let svApi = $state<SvGridApi<typeof features, Deal> | null>(null)
  const svRows = $derived(
    !globalFilter
      ? deals
      : deals.filter((d) =>
          Object.values(d).some((v) => String(v).toLowerCase().includes(globalFilter.toLowerCase())),
        ),
  )

  // ---- AG Grid (left) ------------------------------------------------
  /**
   * AG Grid Community v35+ uses the new modular runtime - you must
   * register at least the client-side row model module before mounting
   * any grid. We register the bundle of community features so the
   * usual sort + filter + selection paths all work out of the box.
   */
  let agRoot: HTMLDivElement
  let agApi: unknown = null
  onMount(async () => {
    // Lazy-load AG Grid only when this demo opens, to keep its 1.2MB
    // bundle out of the gallery's main chunk.
    const mod = await import('ag-grid-community')
    type AnyMod = Record<string, unknown> & {
      createGrid?: (el: HTMLElement, opts: Record<string, unknown>) => { setGridOption?: (k: string, v: unknown) => void; api?: unknown }
      ModuleRegistry?: { registerModules: (m: unknown[]) => void }
      AllCommunityModule?: unknown
      ClientSideRowModelModule?: unknown
    }
    const m = mod as AnyMod
    if (m.ModuleRegistry && m.AllCommunityModule) {
      m.ModuleRegistry.registerModules([m.AllCommunityModule])
    } else if (m.ModuleRegistry && m.ClientSideRowModelModule) {
      m.ModuleRegistry.registerModules([m.ClientSideRowModelModule])
    }
    const grid = m.createGrid?.(agRoot, {
      rowData: deals,
      columnDefs: [
        { field: 'id',      headerName: 'ID',      width: 70  },
        { field: 'company', headerName: 'Company', width: 140 },
        { field: 'region',  headerName: 'Region',  width: 90  },
        { field: 'rep',     headerName: 'Sales rep', width: 160 },
        { field: 'arr',     headerName: 'ARR',     width: 130,
          valueFormatter: (p: { value: number }) => '$' + p.value.toLocaleString() },
        { field: 'stage',   headerName: 'Stage',   width: 130 },
      ],
      defaultColDef: { sortable: true, filter: true, resizable: true },
      animateRows: true,
      rowSelection: 'multiple',
      pagination: false,
    })
    agApi = grid
  })

  // Push the global filter into AG Grid when it changes.
  $effect(() => {
    const ag = agApi as { setGridOption?: (k: string, v: unknown) => void } | null
    ag?.setGridOption?.('quickFilterText', globalFilter)
  })

  // ---- Toggle code panes --------------------------------------------
  let showCode = $state<'both' | 'ag' | 'sv' | 'hide'>('both')

  const agSource = `import { createGrid, AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'

ModuleRegistry.registerModules([AllCommunityModule])

const grid = createGrid(host, {
  rowData: deals,
  columnDefs: [
    { field: 'id',      headerName: 'ID',      width: 70  },
    { field: 'company', headerName: 'Company', width: 140 },
    { field: 'region',  headerName: 'Region',  width: 90  },
    { field: 'rep',     headerName: 'Sales rep', width: 160 },
    { field: 'arr',     headerName: 'ARR',     width: 130,
      valueFormatter: p => '$' + p.value.toLocaleString() },
    { field: 'stage',   headerName: 'Stage',   width: 130 },
  ],
  defaultColDef: { sortable: true, filter: true, resizable: true },
  animateRows: true,
  rowSelection: 'multiple',
})

// Global filter:
grid.setGridOption('quickFilterText', globalFilter)`

  const svSource = `import {
  SvGrid, tableFeatures,
  rowSortingFeature, columnFilteringFeature,
  type GridColumns,
} from '@svgrid/grid'

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
})

const columns: GridColumns<Deal> = [
  { field: 'id',      header: 'ID',      width: 60  },
  { field: 'company', header: 'Company', width: 140 },
  { field: 'region',  header: 'Region',  width: 90  },
  { field: 'rep',     header: 'Sales rep', width: 160 },
  { field: 'arr',     header: 'ARR',     width: 130, align: 'right',
    format: { type: 'currency', currency: 'USD' } },
  { field: 'stage',   header: 'Stage',   width: 130 },
]

// Global filter: pre-filter the data array.
$: filtered = deals.filter(d =>
  Object.values(d).some(v =>
    String(v).toLowerCase().includes(query.toLowerCase())))

<SvGrid responsive={true} data={filtered} {columns} {features}
  fitColumns containerHeight="100%" />`
</script>

<svelte:head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ag-grid-community@35.3.1/styles/ag-grid.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ag-grid-community@35.3.1/styles/ag-theme-quartz.css" />
</svelte:head>

<section class="mg-shell flex flex-col flex-1 min-h-0 gap-3">
  <header>
    <h2>AG Grid ↔ sv-grid - side by side</h2>
    <p>
      Same dataset, same column defs (translated), both running live. Click
      column headers to sort either side. The search box filters both grids
      at once.
    </p>
  </header>

  <div class="mg-toolbar">
    <input
      type="search"
      class="mg-search"
      placeholder="Quick filter (both grids)…"
      bind:value={globalFilter}
    />
    <div class="mg-seg">
      <button class:active={showCode === 'both'} onclick={() => (showCode = 'both')}>Both</button>
      <button class:active={showCode === 'ag'}   onclick={() => (showCode = 'ag')}>AG only</button>
      <button class:active={showCode === 'sv'}   onclick={() => (showCode = 'sv')}>sv-grid only</button>
      <button class:active={showCode === 'hide'} onclick={() => (showCode = 'hide')}>Hide code</button>
    </div>
    <span class="mg-meta">{svRows.length} of {deals.length} rows</span>
  </div>

  <div class="mg-split">
    <article class="mg-side mg-ag">
      <header class="mg-side-head">
        <span class="mg-side-eyebrow">AG Grid Community v35</span>
        <span class="mg-side-tag">~1.2 MB gzipped</span>
      </header>
      <div bind:this={agRoot} class="ag-theme-quartz mg-grid"></div>
    </article>

    <article class="mg-side mg-sv">
      <header class="mg-side-head">
        <span class="mg-side-eyebrow">@svgrid/grid</span>
        <span class="mg-side-tag">~22 KB gzipped</span>
      </header>
      <div class="mg-grid">
        <SvGrid responsive={true}
      columnResize
          data={svRows}
          columns={svColumns}
          {features}
          showRowSelection={false}
          enableInlineEditing={false}
          enableCellSelection={false}
          rowHeight={32}
          containerHeight="100%"
          fitColumns={true}
          onApiReady={(a) => (svApi = a)}
        />
      </div>
    </article>
  </div>

  {#if showCode !== 'hide'}
    <div class="mg-code-row">
      {#if showCode === 'both' || showCode === 'ag'}
        <div class="mg-code-card">
          <div class="mg-code-head">AG Grid source</div>
          <pre class="mg-code"><code>{agSource}</code></pre>
        </div>
      {/if}
      {#if showCode === 'both' || showCode === 'sv'}
        <div class="mg-code-card">
          <div class="mg-code-head">sv-grid source</div>
          <pre class="mg-code"><code>{svSource}</code></pre>
        </div>
      {/if}
    </div>
  {/if}
</section>

<style>
  .mg-shell { min-height: 0; }
  header h2 { font-size: 16px; font-weight: 700; margin: 0; }
  header p  { margin: 4px 0 0; font-size: 12.5px; color: var(--sg-muted, #64748b); max-width: 80ch; }

  .mg-toolbar {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    padding: 8px 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    background: var(--sg-bg, #ffffff);
    flex-shrink: 0;
  }
  .mg-search {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    border-radius: 5px;
    padding: 5px 10px; font-size: 12.5px;
    width: 260px;
  }
  .mg-seg {
    display: inline-flex; border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 5px; overflow: hidden;
  }
  .mg-seg button {
    border: 0; background: transparent;
    padding: 5px 10px; font-size: 11.5px;
    cursor: pointer; color: var(--sg-fg, #1e293b);
  }
  .mg-seg button.active { background: var(--sg-accent, #2563eb); color: var(--sg-on-accent, #fff); font-weight: 700; }
  .mg-meta { margin-left: auto; font-size: 11.5px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }

  .mg-split {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 12px;
    flex: 1; min-height: 0;
  }
  .mg-side {
    display: flex; flex-direction: column;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
    min-height: 280px;
  }
  .mg-side-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg-subtle, var(--sg-header-bg, #f8fafc));
  }
  .mg-side-eyebrow {
    font-size: 11.5px; font-weight: 700;
    color: var(--sg-fg, #1e293b);
  }
  .mg-side-tag {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--sg-muted, #64748b);
    background: var(--sg-bg-subtle, var(--sg-header-bg, #f1f5f9));
    padding: 1px 7px; border-radius: 999px;
  }
  .mg-grid { flex: 1; min-height: 0; }

  .mg-code-row {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
    gap: 12px;
    flex-shrink: 0;
    max-height: 380px;
  }
  .mg-code-card {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #0f172a);
    overflow: hidden;
    display: flex; flex-direction: column;
  }
  .mg-code-head {
    padding: 6px 12px;
    color: var(--sg-muted, #cbd5e1);
    font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em;
    font-weight: 700;
    border-bottom: 1px solid var(--sg-border, rgba(148,163,184,0.18));
    background: var(--sg-bg-subtle, var(--sg-header-bg, #0c1729));
  }
  .mg-code {
    margin: 0; flex: 1;
    color: var(--sg-fg, #e2e8f0);
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 11px; line-height: 1.55;
    padding: 12px 14px;
    overflow: auto;
  }

  /* Mobile: the code row is `repeat(auto-fit, minmax(380px, 1fr))`. `auto-fit`
     collapses to a single column on a phone, but the 380px floor is still
     wider than the ~366px available, so the cards hung over the edge. Drop the
     floor - the `<pre>` inside already scrolls its own long lines. */
  @media (max-width: 767px) {
    .mg-code-row {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  /* Phone: once the two panes stack, the split hands its rows only the leftover space,
     so each 280px card clipped its floored grid. Size rows to content instead. */
  @media (max-width: 639px), (max-height: 500px) and (pointer: coarse) {
    .mg-split { grid-auto-rows: max-content; }
  }
</style>
