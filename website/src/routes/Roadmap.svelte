<script lang="ts">
  /**
   * Public roadmap. The content is derived from the honest "Missing features"
   * accounting in docs/help/missing-features.md - the items the help topics
   * flag as not-yet-built in the community package. Keep the two in sync: when
   * an item ships, move it to "Recently shipped" here and strike it through in
   * the doc.
   *
   * Effort: S (small) / M (medium) / L (large) - same scale as the doc.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  type Effort = 'S' | 'M' | 'L'
  type Lane = 'planned' | 'in_progress' | 'shipped'
  // status defaults to planned; tag the few in-flight items with 'in_progress'.
  type Item = { title: string; effort: Effort; note?: string; discussion?: number; status?: 'in_progress' }
  type Group = { area: string; items: Item[] }

  const planned: Group[] = [
    {
      area: 'Columns',
      items: [
        { discussion: 3, title: 'Column spanning (colSpan on cell context)', effort: 'L' },
      ],
    },
    {
      area: 'Rows',
      items: [
        { status: 'in_progress', discussion: 4, title: 'Engine-level full-width detail row API', effort: 'M', note: 'Demo 106 ships the sentinel-row pattern today.' },
        { status: 'in_progress', discussion: 5, title: 'Built-in row dragging - managed, unmanaged, drop zones, grid-to-grid', effort: 'L', note: 'Demo 105 covers the basic single-grid case in user-land.' },
        { discussion: 6, title: 'Variable row height on the <SvGrid> component', effort: 'M', note: 'Available via the headless virtualizer today.' },
        { discussion: 7, title: 'Row spanning (merged cells across rows)', effort: 'L' },
        { title: 'Built-in tree data - native expand/collapse for hierarchical rows, with lazy children', effort: 'L', note: 'Works today via your own derived state (demo 28 + the tree-rows guide); this brings a real tree row model into the engine.', discussion: 26 },
      ],
    },
    {
      area: 'Cells',
      items: [
        { discussion: 8, title: 'Built-in cell flash / animated change highlight on ColumnDef', effort: 'S', note: 'Demos roll their own today via renderSnippet.' },
        { discussion: 9, title: 'Formula language / formula editor (enterprise parity)', effort: 'L', note: 'Demo 83 ships an in-grid formula engine (refs, ranges, SUM/AVG/IF/COUNTIF, cycle detection); this moves it into the engine.' },
        { discussion: 10, title: 'Built-in rich-text / Markdown cell renderer with safe sanitization', effort: 'M' },
      ],
    },
    {
      area: 'Filtering',
      items: [
        { status: 'in_progress', discussion: 11, title: 'Floating filters with per-operator parity', effort: 'M', note: 'Inline filter row exists; this adds the per-operator UI under the funnel.' },
        { discussion: 12, title: 'Multi-filter on a single column (AND / OR within a column)', effort: 'M' },
      ],
    },
    {
      area: 'Editing',
      items: [
        { discussion: 13, title: 'Per-column valueParser', effort: 'S' },
        { discussion: 14, title: 'Per-column validate() returning string | true', effort: 'S', note: 'Async validation is demonstrated end-to-end in demo 103; this folds the per-column validate hook into the engine.' },
        { discussion: 15, title: 'Programmatic api.startEditing() / stopEditing()', effort: 'S' },
        { discussion: 16, title: 'Full-row editing mode', effort: 'M' },
        { discussion: 17, title: 'Custom calendar systems for the date editor (Hijri, Buddhist, fiscal-year, custom holidays)', effort: 'M', note: 'Gregorian date / datetime / time editors already ship as editorType.' },
        { discussion: 18, title: 'Async option loading + virtualized dropdown for the rich-select editor', effort: 'M', note: 'The combobox itself ships as editorType: rich-select; this adds async sources and a virtualized list for 10k+ options.' },
      ],
    },
    {
      area: 'Menus',
      items: [
        { discussion: 19, title: 'Custom column menu items / actions API to extend the built-in menu with your own commands', effort: 'S' },
        { discussion: 20, title: 'Built-in row + cell context menu API driven by Svelte snippets', effort: 'M', note: 'Demo 67 ships the user-land pattern today; this moves it into the engine.' },
        { discussion: 21, title: 'Cascading multi-level menus with keyboard navigation', effort: 'M' },
        { discussion: 22, title: 'Programmatic api.openColumnMenu(colId) / api.openContextMenu(rowId, colId)', effort: 'S' },
        { discussion: 31, title: 'Menu theming hooks (per-item icon, separator, danger style, disabled state)', effort: 'S' },
      ],
    },
    {
      area: 'Pivot (@svgrid/enterprise)',
      items: [
        { discussion: 32, title: 'Custom aggregation functions registered on the Pivot Designer', effort: 'S' },
        { discussion: 33, title: 'Per-measure value formatters (currency, percent, accounting, custom)', effort: 'S' },
        { discussion: 34, title: 'Saved pivot layouts with per-user persistence + shareable URL', effort: 'M', note: 'Named views (demo 143) save grid state today; this is the pivot-specific layout snapshot.' },
      ],
    },
    {
      area: 'Export (@svgrid/enterprise)',
      items: [
        { discussion: 35, title: 'PDF export layout extensions: portrait / landscape toggle, cover page, repeating section headers, multi-section reports', effort: 'M', note: 'Branded headers, footers, and logo (demo 57) already ship; this is the page-layout pass.' },
        { discussion: 36, title: 'PDF export with charts and KPI strip alongside the table', effort: 'L' },
        { discussion: 37, title: 'Server-side export pipeline that streams large datasets without the browser-memory ceiling', effort: 'L' },
        { discussion: 38, title: 'Saveable export templates / presets the user can reuse across reports', effort: 'S' },
      ],
    },
    {
      area: 'Data adapters and integrations',
      items: [
        { discussion: 39, title: 'Packaged first-class adapters for OData, Supabase, Firestore', effort: 'M', note: 'GraphQL and REST adapters ship as demos 72 and 79; this formalises the contract and adds three new sources.' },
        { discussion: 40, title: 'Streaming adapter for Kafka / Pulsar / Redpanda over a thin server proxy', effort: 'L' },
        { discussion: 41, title: 'Auth helpers for data adapters: Bearer, OAuth flow, signed-URL refresh', effort: 'S' },
      ],
    },
    {
      area: 'Templates and starters',
      items: [
        { discussion: 42, title: 'Additional industry templates: ticketing, field-service intake, multi-site retail ops, telco service-assurance', effort: 'M', note: 'CRM (48), EMR (41), logistics (42), industrial (14, 20), test-systems (120), realtime orders (34), and admin dashboards (22, 49) already ship.' },
        { discussion: 43, title: 'SvelteKit + REST starter with auth scaffold (cookies, role gating, server load)', effort: 'M' },
        { discussion: 44, title: 'Pivot + drill-through dashboard template combining demo 122 + demo 125 into one ready-to-deploy starter', effort: 'M' },
      ],
    },
    {
      area: 'AI (@svgrid/enterprise)',
      items: [
        { title: 'Generate columns - and whole grids - from a prompt', effort: 'L', note: 'Builds on the AI pack (natural-language filter, smart fill, summarise); this points AI at authoring, not just querying.', discussion: 27 },
      ],
    },
    {
      area: 'SvelteKit',
      items: [
        { title: 'Official SvelteKit integration - load helpers, form actions, streaming SSR', effort: 'M', note: 'The create-svgrid scaffold and admin template exist today; this is a first-party module that makes the grid feel native to SvelteKit.', discussion: 28 },
      ],
    },
    {
      area: 'Mobile',
      items: [
        { title: 'Built-in responsive mode - auto card view under a breakpoint, with touch-friendly editing', effort: 'M', note: 'The mobile card view is a userland pattern today (demo 81); this makes it a first-class mode.', discussion: 29 },
      ],
    },
    {
      area: 'Charts',
      items: [
        { title: 'Range-charting and cross-filter dashboards', effort: 'M', note: 'Charts already ship (SvGridChart); this adds select-a-range-to-chart and click-to-filter across grids.', discussion: 30 },
      ],
    },
  ]

  // Things that were on this list and have since landed - kept visible so the
  // roadmap reads as a track record, not just a wish list.
  type Shipped = { title: string; demo?: string }
  const shipped: Shipped[] = [
    // Library API
    { title: 'Column pinning (left / right) - menu + api.setColumnPinning()' },
    { title: 'getRowId() stable row identity on <SvGrid>' },
    { title: 'cellClass / rowClass conditional class callbacks' },
    { title: 'api.getColumnWidths() / setColumnWidth()' },
    { title: 'between operator in the column menu (Number + Date)' },
    { title: 'clearAllFilters() / getFilters() on SvGridApi' },
    { title: 'api.getDisplayedRows() (post-pipeline)' },

    // Cells - new since the last roadmap pass
    { title: 'Built-in tooltip API on ColumnDef (string or value-driven)', demo: '85-tooltips-and-notes' },
    { title: 'Built-in notes prop + corner indicator', demo: '85-tooltips-and-notes' },
    { title: 'Find-in-grid (Ctrl+F) + api.openFind / setFindQuery / getFindHits', demo: '87-find-in-grid' },

    // Editing - new since the last roadmap pass
    { title: 'cellEditor slot for custom inline editors (Snippet on ColumnDef)', demo: '84-editor-types' },
    { title: "Built-in select & rich-select editors (editorType: 'select' | 'rich-select')", demo: '84-editor-types' },
    { title: "Built-in textarea editor (editorType: 'textarea')", demo: '84-editor-types' },
    { title: 'Built-in undo / redo stack + Ctrl+Z / Ctrl+Y / api.undo() / canUndo()', demo: '86-undo-redo' },

    // Selection / events
    { title: 'api.selectCells() / getSelected() + onCellSelectionChange event', demo: '90-selection-api' },

    // Columns / rows - engine-level
    { title: 'Engine-level row pinning prop (pinnedTopRows / pinnedBottomRows)', demo: '108-pinned-rows-engine' },
    { title: 'Built-in header drag-to-reorder (enableColumnReorder + onColumnOrderChange)', demo: '109-column-reorder-engine' },

    // Filtering
    { title: 'Locale-aware text filtering (accent-insensitive, ICU lowercase via filterLocale)', demo: '110-locale-aware-filter' },
    { title: 'Set filter - tree, async, Excel-mode patterns via api.setFacetFilter', demo: '111-set-filter-advanced' },

    // Cells
    { title: 'Sparkline cell renderer (line / area / bar / win-loss) as a first-class column type', demo: '140-sparkline-cells' },

    // Columns - per-column flags
    { title: 'Per-column sortable / filterable flags on ColumnDef', demo: '02-sort-filter-paginate' },

    // Editing - more built-in editor types
    { title: "Built-in time + date-time editors (editorType: 'time' | 'datetime')", demo: '84-editor-types' },
    { title: "Built-in color picker editor (editorType: 'color')", demo: '66-custom-cell-editors' },
    { title: "Built-in password + rating editors (editorType: 'password' | 'rating')", demo: '84-editor-types' },
    { title: "Built-in list + chips editors (editorType: 'list' | 'chips')", demo: '26-list-chips-editors' },

    // Enterprise - Pivot
    { title: 'Pivot drill-through (click any pivot value to see contributing source rows)', demo: '122-pivot-drill-through' },
    { title: 'Pivot subtotal + grand-total rows + style controls', demo: '123-pivot-totals' },
    { title: 'Conditional formatting in pivot cells (heatmap, data bars)', demo: '121-pivot-conditional-cells' },
    { title: 'Pivot OLAP-style hierarchical row / column axes', demo: '124-pivot-olap' },
    { title: 'Pivot value charts (charts driven by the pivot model)', demo: '125-pivot-charts' },
    { title: 'Export pivot grid to Excel', demo: '127-export-pivot-grid' },

    // Enterprise - Export polish
    { title: 'Theme-matched export styling (palette, fonts, alternating rows)', demo: '56-export-theme-matched' },
    { title: 'Branded export with custom header, footer, and embedded logo', demo: '57-export-header-footer-logo' },
    { title: 'Image cells round-tripped into Excel exports', demo: '58-export-with-images' },
    { title: 'Multi-sheet workbook exports', demo: '59-export-multi-sheet' },
    { title: 'Grouped grid export with collapsed group rows preserved', demo: '126-export-grouped-grid' },
    { title: 'Password-protected (encrypted) Excel export', demo: '93-password-protected-export' },

    // Data adapters / integrations
    { title: 'Server-side row model contract with sort / filter / page pushdown', demo: '148-server-row-model' },
    { title: 'Server-side grouping + aggregation pushdown', demo: '114-server-grouping' },
    { title: 'GraphQL adapter (server-side sort + filter + page)', demo: '72-graphql-adapter' },
    { title: 'REST data loading with loading / error / empty / ready states', demo: '79-loading-from-rest' },
    { title: 'WebSocket live-update pattern with insert / update / delete deltas', demo: '116-websocket-live-updates' },
    { title: 'Real-time collaboration (multi-user cursors + edits)', demo: '149-realtime-collaboration' },
    { title: 'Transaction API for row-level applyTransaction with optimistic updates', demo: '145-transaction-api' },
    { title: 'Chart.js sync (grid edits flow live into a chart and back)', demo: '73-chartjs-sync' },
    { title: 'Integrated charts (charts rendered against the grid model)', demo: '147-integrated-charts' },
    { title: 'Excel / CSV import with column mapping and per-row validation', demo: '53-excel-import' },

    // Templates and starters
    { title: 'Industry template - CRM sales pipeline', demo: '48-crm-sales-pipeline' },
    { title: 'Industry template - Healthcare EMR', demo: '41-healthcare-emr' },
    { title: 'Industry template - Logistics fleet dispatch', demo: '42-logistics-fleet' },
    { title: 'Industry template - Industrial / HMI dashboard', demo: '20-industrial-dashboard' },
    { title: 'Industry template - Test & measurement systems monitor', demo: '120-test-systems-monitor' },
    { title: 'Industry template - Real-time order operations', demo: '34-realtime-orders' },
    { title: 'Industry template - Manufacturing ops console', demo: '32-manufacturing-ops' },
    { title: 'Industry template - Compliance review queue', demo: '43-compliance-queue' },
    { title: 'Industry template - Field-service work orders', demo: '44-field-service' },
    { title: 'Industry template - Kanban board', demo: '76-kanban-board' },
    { title: 'Starter - Admin dashboard (KPI cards + grid + chart)', demo: '49-admin-dashboard' },
    { title: 'Starter - Admin template shell', demo: '22-admin-template' },
    { title: 'Starter - Reporting workspace', demo: '36-reporting-workspace' },
    { title: 'Starter - Seller / marketplace operator panel', demo: '50-seller-panel' },
    { title: 'Starter - Side-drawer record editor', demo: '97-side-drawer-edit' },
    { title: 'Starter - Mobile card view layout', demo: '81-mobile-card-view' },

    // Enterprise - misc
    { title: 'Excel / PDF / CSV / TSV / HTML export + Print (@svgrid/enterprise)' },
    { title: 'Staged / batch editing mode via createStagedEditing (@svgrid/enterprise)', demo: '88-staged-editing' },
  ]

  const effortLabel: Record<Effort, string> = { S: 'Small', M: 'Medium', L: 'Large' }
  const effortColor: Record<Effort, string> = {
    S: '#22c55e',
    M: '#f59e0b',
    L: '#ef4444',
  }

  // ---- Kanban model: one dataset, two views (board + grid) ----------------
  type Card = {
    lane: Lane
    area: string
    title: string
    effort: Effort | ''
    note?: string
    discussion?: number
    demo?: string
  }
  const LANES: { id: Lane; label: string; tint: string; blurb: string }[] = [
    { id: 'planned',     label: 'Planned',     tint: '#64748b', blurb: 'Accounted for, not started.' },
    { id: 'in_progress', label: 'In progress', tint: '#f59e0b', blurb: 'A demo exists; moving it into the engine.' },
    { id: 'shipped',     label: 'Shipped',     tint: '#22c55e', blurb: 'Landed in v1.' },
  ]
  const STATUS_LABEL: Record<Lane, string> = { planned: 'Planned', in_progress: 'In progress', shipped: 'Shipped' }
  const STATUS_TINT: Record<Lane, string> = { planned: '#64748b', in_progress: '#f59e0b', shipped: '#22c55e' }

  const cards: Card[] = [
    ...planned.flatMap((g) =>
      g.items.map((i): Card => ({
        lane: i.status === 'in_progress' ? 'in_progress' : 'planned',
        area: g.area,
        title: i.title,
        effort: i.effort,
        note: i.note,
        discussion: i.discussion,
      })),
    ),
    ...shipped.map((s): Card => ({ lane: 'shipped', area: 'Shipped', title: s.title, effort: '', demo: s.demo })),
  ]
  const byLane = (id: Lane) => cards.filter((c) => c.lane === id)

  let view = $state<'board' | 'table'>('board')

  // Table view dogfoods the grid itself: the same `cards` rendered through SvGrid.
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const tableColumns: ColumnDef<typeof features, Card>[] = [
    { field: 'lane', header: 'Status', width: 140, cell: (c) => renderSnippet(StatusCell, { s: c.row.original.lane }) },
    { field: 'area', header: 'Area', width: 160 },
    { field: 'title', header: 'Item', width: 460 },
    { field: 'effort', header: 'Effort', width: 110, cell: (c) => renderSnippet(EffortCell, { e: c.row.original.effort }) },
  ]
</script>

{#snippet EffortCell(props: { e: Effort | '' })}
  {#if props.e}
    <span class="inline-flex items-center gap-1.5 text-xs" style="color: var(--site-muted);">
      <span class="inline-block h-2.5 w-2.5 rounded-full" style:background={effortColor[props.e]}></span>
      {effortLabel[props.e]}
    </span>
  {:else}
    <span class="text-xs" style="color: var(--site-muted);">&ndash;</span>
  {/if}
{/snippet}
{#snippet StatusCell(props: { s: Lane })}
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
    style:color={STATUS_TINT[props.s]}
    style:background={`color-mix(in oklab, ${STATUS_TINT[props.s]} 15%, transparent)`}
  >
    <span class="inline-block h-1.5 w-1.5 rounded-full" style:background={STATUS_TINT[props.s]}></span>
    {STATUS_LABEL[props.s]}
  </span>
{/snippet}

<section class="mx-auto max-w-7xl px-6 py-16">
  <header class="mb-10">
    <p class="text-xs font-semibold uppercase tracking-[0.18em]" style="color: var(--site-accent-2);">
      Public roadmap
    </p>
    <h1 class="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight" style="color: var(--sg-fg);">
      What we're building next.
    </h1>
    <p class="mt-3 max-w-3xl text-base md:text-lg" style="color: var(--site-muted);">
      An honest, living list of what the community package does not do yet, grouped by
      area and tagged with a rough effort. It is the same accounting the docs link to -
      no vaporware. Want one of these sooner? Upvote or open an issue on GitHub, or send
      a PR; merged PRs are the fastest way to move an item.
    </p>
    <div class="mt-5 flex flex-wrap gap-3">
      <a
        href="https://github.com/sv-grid/sv-grid/issues"
        target="_blank"
        rel="noopener noreferrer"
        class="btn btn-primary"
      >
        Request a feature on GitHub
      </a>
      <a href="#/docs/help/missing-features" class="btn btn-ghost">
        Read the full accounting
      </a>
    </div>
  </header>

  <!-- Toolbar: effort legend + board/table toggle. This page dogfoods the
       grid's "Kanban board + grid, one dataset, two views" pattern (demo 76). -->
  <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
    <div class="flex flex-wrap items-center gap-4 text-xs" style="color: var(--site-muted);">
      <span class="font-semibold uppercase tracking-wider">Effort</span>
      {#each ['S', 'M', 'L'] as const as e}
        <span class="inline-flex items-center gap-1.5">
          <span class="inline-block h-2.5 w-2.5 rounded-full" style:background={effortColor[e]}></span>
          {effortLabel[e]}
        </span>
      {/each}
    </div>
    <div class="rm-seg" role="tablist" aria-label="Roadmap view">
      <button type="button" role="tab" aria-selected={view === 'board'} class:active={view === 'board'} onclick={() => (view = 'board')}>Board</button>
      <button type="button" role="tab" aria-selected={view === 'table'} class:active={view === 'table'} onclick={() => (view = 'table')}>Table</button>
    </div>
  </div>

  {#if view === 'board'}
    <div class="rm-board">
      {#each LANES as lane}
        <section class="rm-lane" aria-label={lane.label}>
          <header class="rm-lane-head">
            <span class="rm-lane-dot" style:background={lane.tint}></span>
            <span class="rm-lane-label">{lane.label}</span>
            <span class="rm-lane-count">{byLane(lane.id).length}</span>
          </header>
          <p class="rm-lane-blurb">{lane.blurb}</p>
          <div class="rm-lane-body">
            {#each byLane(lane.id) as c (c.title)}
              <article class="rm-card">
                <div class="rm-card-top">
                  <span class="rm-area">{c.area}</span>
                  {#if c.effort}
                    <span class="rm-effort" style:background={effortColor[c.effort]} title={`${effortLabel[c.effort]} effort`}></span>
                  {/if}
                </div>
                <div class="rm-card-title">{c.title}</div>
                {#if c.note}<p class="rm-card-note">{c.note}</p>{/if}
                {#if c.discussion || c.demo}
                  <div class="rm-card-links">
                    {#if c.discussion}
                      <a href={`https://github.com/orgs/sv-grid/discussions/${c.discussion}`} target="_blank" rel="noopener external">Discuss &rarr;</a>
                    {/if}
                    {#if c.demo}
                      <a href={`#/demos/${c.demo}`}>Demo</a>
                    {/if}
                  </div>
                {/if}
              </article>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {:else}
    <div class="rm-table">
      <SvGrid
        data={cards}
        columns={tableColumns}
        features={features}
        filterMode="menu"
        showPagination={false}
        virtualization={true}
        rowHeight={40}
        containerHeight="640px"
        fitColumns={true}
      />
    </div>
  {/if}

  <!-- Test coverage / quality -->
  <section class="mt-14">
    <h2 class="mb-1 text-2xl font-bold tracking-tight" style="color: var(--sg-fg);">
      Quality + test coverage
    </h2>
    <p class="mb-5 text-sm" style="color: var(--site-muted);">
      Procurement-grade evidence the engine behaves the way the docs say it does. Two suites
      run on every PR; neither is allowed to regress.
    </p>

    <div class="grid gap-4 sm:grid-cols-2 mb-4">
      <div class="rounded-xl border p-5" style="border-color: var(--site-border); background: var(--site-bg-elev);">
        <div class="flex items-baseline gap-3 mb-2">
          <span class="text-3xl font-extrabold" style="color: var(--site-accent-2);">1,191</span>
          <span class="text-sm font-semibold uppercase tracking-wider" style="color: var(--site-muted);">
            unit + jsdom tests
          </span>
        </div>
        <p class="text-sm" style="color: var(--sg-fg);">
          61 vitest files. Pure helpers, mounted-grid component tests, API exercises, DOM-attribute invariants.
          Runs in <span class="font-semibold">~20s</span>. Command: <code class="text-xs">pnpm test</code>.
        </p>
      </div>

      <div class="rounded-xl border p-5" style="border-color: var(--site-border); background: var(--site-bg-elev);">
        <div class="flex items-baseline gap-3 mb-2">
          <span class="text-3xl font-extrabold" style="color: var(--site-accent-2);">4</span>
          <span class="text-sm font-semibold uppercase tracking-wider" style="color: var(--site-muted);">
            Playwright E2E specs
          </span>
        </div>
        <p class="text-sm" style="color: var(--sg-fg);">
          Real-browser coverage for what jsdom can't: drag-and-drop, sticky-after-scroll, async loaders, keystroke
          debounce. Command: <code class="text-xs">pnpm test:e2e</code>.
        </p>
      </div>
    </div>

    <details class="rounded-xl border p-5" style="border-color: var(--site-border); background: var(--site-bg-elev);">
      <summary class="cursor-pointer text-sm font-semibold" style="color: var(--sg-fg);">
        What's covered, file by file
      </summary>
      <div class="mt-4 text-sm" style="color: var(--site-fg);">
        <p class="mb-2 font-semibold" style="color: var(--site-muted);">Unit / component (vitest + jsdom)</p>
        <ul class="mb-4 space-y-1 list-disc list-inside" style="color: var(--site-fg);">
          <li><code class="text-xs">filtering/locale-filter.test.ts</code> - normalizeForFilter + applyExcelFilter (27 tests)</li>
          <li><code class="text-xs">svgrid.row-pinning.test.ts</code> - pinned tbodies, attributes, read-only invariants (10 tests)</li>
          <li><code class="text-xs">svgrid.column-reorder.test.ts</code> - api.setColumnOrder, onColumnOrderChange, draggable wiring (9 tests)</li>
          <li><code class="text-xs">svgrid.locale-filtering.test.ts</code> - api.setFilter end-to-end with filterLocale (15 tests)</li>
          <li><code class="text-xs">svgrid.set-filter.test.ts</code> - api.setFacetFilter, tree + async patterns (13 tests)</li>
          <li>+ 22 pre-existing files (cell formatting, keyboard, fill patterns, a11y contract, …)</li>
        </ul>
        <p class="mb-2 font-semibold" style="color: var(--site-muted);">E2E (Playwright)</p>
        <ul class="space-y-1 list-disc list-inside" style="color: var(--site-fg);">
          <li><code class="text-xs">tests/e2e/column-reorder.spec.ts</code> - real DragEvent + localStorage round-trip</li>
          <li><code class="text-xs">tests/e2e/pinned-rows.spec.ts</code> - position:sticky still visible after a 1000px scroll</li>
          <li><code class="text-xs">tests/e2e/locale-filter.spec.ts</code> - real keystrokes through the global filter</li>
          <li><code class="text-xs">tests/e2e/set-filter.spec.ts</code> - async loader timing, tree cascade UX</li>
        </ul>
      </div>
    </details>
  </section>

  <p class="mt-12 text-xs" style="color: var(--site-muted);">
    This roadmap is indicative, not a commitment, and ordering can change with
    community demand. Nothing here blocks production use of the current release -
    see the <a href="#/docs/help/missing-features" style="color: var(--site-accent-2);">missing
    features</a> page for workarounds available today.
  </p>
</section>

<style>
  /* Board/table toggle */
  .rm-seg {
    display: inline-flex;
    border: 1px solid var(--site-border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--site-bg-elev);
  }
  .rm-seg button {
    padding: 6px 16px;
    font-size: 13px;
    font-weight: 600;
    color: var(--site-muted);
    background: transparent;
    cursor: pointer;
  }
  .rm-seg button.active {
    color: #fff;
    background: var(--site-accent, #2563eb);
  }

  /* Kanban board */
  .rm-board {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    align-items: start;
  }
  @media (min-width: 860px) {
    .rm-board { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  .rm-lane {
    border: 1px solid var(--site-border);
    border-radius: 14px;
    background: var(--site-bg-elev);
    padding: 14px;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .rm-lane-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    color: var(--sg-fg);
  }
  .rm-lane-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .rm-lane-label { font-size: 15px; }
  .rm-lane-count {
    margin-left: auto;
    font-size: 12px;
    font-weight: 700;
    color: var(--site-muted);
    background: color-mix(in oklab, var(--site-muted) 16%, transparent);
    border-radius: 999px;
    padding: 1px 9px;
  }
  .rm-lane-blurb { margin-top: 3px; font-size: 12px; color: var(--site-muted); }
  .rm-lane-body {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 68vh;
    overflow-y: auto;
    padding-right: 2px;
  }

  /* Cards */
  .rm-card {
    border: 1px solid var(--site-border);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 11px 12px;
  }
  .rm-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .rm-area {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--site-accent-2);
  }
  .rm-effort { width: 9px; height: 9px; border-radius: 50%; flex: none; }
  .rm-card-title { margin-top: 5px; font-size: 13.5px; font-weight: 600; line-height: 1.35; color: var(--sg-fg); }
  .rm-card-note { margin-top: 5px; font-size: 12px; line-height: 1.4; color: var(--site-muted); }
  .rm-card-links { margin-top: 8px; display: flex; gap: 14px; }
  .rm-card-links a { font-size: 12px; font-weight: 600; color: var(--site-accent-2); }
  .rm-card-links a:hover { text-decoration: underline; }

  /* Table view */
  .rm-table {
    border: 1px solid var(--site-border);
    border-radius: 14px;
    overflow: hidden;
  }
</style>
