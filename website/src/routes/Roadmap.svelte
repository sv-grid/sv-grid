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
  type Effort = 'S' | 'M' | 'L'
  type Item = { title: string; effort: Effort; note?: string }
  type Group = { area: string; items: Item[] }

  const planned: Group[] = [
    {
      area: 'Columns',
      items: [
        { title: 'Per-column enableSorting / enableFilter flags', effort: 'S' },
        { title: 'Column spanning (colSpan on cell context)', effort: 'L' },
      ],
    },
    {
      area: 'Rows',
      items: [
        { title: 'Engine-level full-width detail row API', effort: 'M', note: 'Demo 106 ships the sentinel-row pattern today.' },
        { title: 'Built-in row dragging - managed, unmanaged, drop zones, grid-to-grid', effort: 'L', note: 'Demo 105 covers the basic single-grid case in user-land.' },
        { title: 'Variable row height on the <SvGrid> component', effort: 'M', note: 'Available via the headless virtualizer today.' },
        { title: 'Row spanning (merged cells across rows)', effort: 'L' },
      ],
    },
    {
      area: 'Cells',
      items: [
        { title: 'Built-in cell flash / animated change highlight on ColumnDef', effort: 'S', note: 'Demos roll their own today via renderSnippet.' },
        { title: 'Formula language / formula editor (enterprise parity)', effort: 'L', note: 'Demo 83 ships an in-grid formula engine (refs, ranges, SUM/AVG/IF/COUNTIF, cycle detection); this moves it into the engine.' },
      ],
    },
    {
      area: 'Filtering',
      items: [
        { title: 'Floating filters with per-operator parity', effort: 'M', note: 'Inline filter row exists; this adds the per-operator UI under the funnel.' },
        { title: 'Multi-filter on a single column (AND / OR within a column)', effort: 'M' },
      ],
    },
    {
      area: 'Editing',
      items: [
        { title: 'Per-column valueParser', effort: 'S' },
        { title: 'Per-column validate() returning string | true', effort: 'S', note: 'Async validation is demonstrated end-to-end in demo 103; this folds the per-column validate hook into the engine.' },
        { title: 'Programmatic api.startEditing() / stopEditing()', effort: 'S' },
        { title: 'Full-row editing mode', effort: 'M' },
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

    // Pro
    { title: 'Excel / PDF / CSV / TSV / HTML export + Print (sv-grid-pro)' },
    { title: 'Staged / batch editing mode via createStagedEditing (sv-grid-pro)', demo: '88-staged-editing' },
  ]

  const effortLabel: Record<Effort, string> = { S: 'Small', M: 'Medium', L: 'Large' }
  const effortColor: Record<Effort, string> = {
    S: '#22c55e',
    M: '#f59e0b',
    L: '#ef4444',
  }
</script>

<section class="mx-auto max-w-5xl px-6 py-16">
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

  <!-- Effort legend -->
  <div class="mb-8 flex flex-wrap items-center gap-4 text-xs" style="color: var(--site-muted);">
    <span class="font-semibold uppercase tracking-wider">Effort</span>
    {#each ['S', 'M', 'L'] as const as e}
      <span class="inline-flex items-center gap-1.5">
        <span class="inline-block h-2.5 w-2.5 rounded-full" style:background={effortColor[e]}></span>
        {effortLabel[e]}
      </span>
    {/each}
  </div>

  <div class="grid gap-6 md:grid-cols-2">
    {#each planned as group}
      <div
        class="rounded-xl border p-5"
        style="border-color: var(--site-border); background: var(--site-bg-elev);"
      >
        <h2 class="mb-3 text-lg font-bold" style="color: var(--sg-fg);">{group.area}</h2>
        <ul class="space-y-3">
          {#each group.items as item}
            <li class="flex items-start gap-3">
              <span
                class="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style:background={effortColor[item.effort]}
                title={effortLabel[item.effort] + ' effort'}
              ></span>
              <span>
                <span class="text-sm font-medium" style="color: var(--sg-fg);">{item.title}</span>
                {#if item.note}
                  <span class="mt-0.5 block text-xs" style="color: var(--site-muted);">{item.note}</span>
                {/if}
              </span>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </div>

  <!-- Recently shipped -->
  <section class="mt-14">
    <h2 class="mb-1 text-2xl font-bold tracking-tight" style="color: var(--sg-fg);">
      Recently shipped
    </h2>
    <p class="mb-5 text-sm" style="color: var(--site-muted);">
      Items that were on this roadmap and have since landed in v1.0.
    </p>
    <ul class="grid gap-2 sm:grid-cols-2">
      {#each shipped as item (item.title)}
        <li class="flex items-start gap-2 text-sm" style="color: var(--site-fg);">
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e"
            stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true" class="mt-0.5 shrink-0"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span>
            <span>{item.title}</span>
            {#if item.demo}
              <a class="ml-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style="color: var(--site-accent-2); background: color-mix(in oklab, var(--site-accent-2) 12%, transparent);"
                href={`#/demos/${item.demo}`}>
                demo
              </a>
            {/if}
          </span>
        </li>
      {/each}
    </ul>
  </section>

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
          <span class="text-3xl font-extrabold" style="color: var(--site-accent-2);">314</span>
          <span class="text-sm font-semibold uppercase tracking-wider" style="color: var(--site-muted);">
            unit + jsdom tests
          </span>
        </div>
        <p class="text-sm" style="color: var(--sg-fg);">
          27 vitest files. Pure helpers, mounted-grid component tests, API exercises, DOM-attribute invariants.
          Runs in <span class="font-semibold">~10s</span>. Command: <code class="text-xs">pnpm test</code>.
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
