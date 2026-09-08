<script lang="ts">
  /**
   * 431. Your icon set instead of ours
   * ----------------------------------
   * Every glyph the grid draws for its own chrome has a name, and `icons`
   * replaces any of them with a snippet of your markup.
   *
   *   icons={{ filter: myFunnel }}    one icon
   *   icons={{ ...wholeSet }}         as many as you like
   *
   * It is a MAP, not one catch-all snippet, and that is the point: names you
   * leave out keep their built-in glyph. So a partial set is a complete answer,
   * and you can never blank an icon by forgetting it exists. Toggle "Ours" /
   * "Mixed" below to see that - Mixed overrides four names and the rest of the
   * chrome carries on unchanged.
   *
   * The overrides here are hand-drawn SVG, but a snippet is a snippet: an
   * <Icon> from your design system, an <img>, or a plain character all work.
   * Colour follows `currentColor` and the grid sizes the box for you, so an
   * override lands the same size as the glyph it replaced and rotates with the
   * expander when a group opens.
   *
   * Free, in @svgrid/grid.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
    type GridColumns,
  } from '@svgrid/grid'

  type Release = {
    id: number
    service: string
    version: string
    env: 'prod' | 'staging' | 'canary'
    owner: string
    status: 'shipped' | 'rolling' | 'held'
    errorRate: number
    shippedAt: string
  }

  const SERVICES = ['checkout', 'billing', 'search', 'identity', 'notifications', 'ledger']
  const OWNERS = ['A. Osei', 'R. Vance', 'M. Iqbal', 'J. Lindqvist', 'D. Okonkwo']
  const ENVS: Release['env'][] = ['prod', 'staging', 'canary']
  const STATUSES: Release['status'][] = ['shipped', 'rolling', 'held']

  const iso = (days: number) => {
    const d = new Date(2026, 8, 1)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  const rows: Release[] = Array.from({ length: 40 }, (_, i) => ({
    id: i + 1,
    service: SERVICES[i % SERVICES.length],
    version: `2.${(i % 7) + 1}.${i % 4}`,
    env: ENVS[i % ENVS.length],
    owner: OWNERS[i % OWNERS.length],
    status: STATUSES[(i * 2) % STATUSES.length],
    // Deterministic, so the demo reads the same on every load.
    errorRate: Number((((i * 37) % 90) / 100).toFixed(2)),
    shippedAt: iso(i % 28),
  }))

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
  })

  const columns: GridColumns<Release> = [
    { field: 'service', header: 'Service', width: 140 },
    { field: 'version', header: 'Version', width: 100 },
    { field: 'env', header: 'Env', width: 110 },
    { field: 'owner', header: 'Owner', width: 150 },
    { field: 'status', header: 'Status', width: 120 },
    { field: 'errorRate', header: 'Error %', width: 110, align: 'right' },
    { field: 'shippedAt', header: 'Shipped', width: 130 },
  ]

  let set = $state<'builtin' | 'mixed' | 'full'>('mixed')

  // The map itself is assembled in the markup, not here: snippets are a
  // template construct, so `<script>` cannot see them.
</script>

<!-- The override snippets. Each is plain markup; the grid wraps them in its own
     icon box, so they inherit the size and colour of the glyph they replace. -->
{#snippet arrowUp()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 19V5" /><path d="M6 11l6-6 6 6" />
  </svg>
{/snippet}
{#snippet arrowDown()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 5v14" /><path d="M6 13l6 6 6-6" />
  </svg>
{/snippet}
{#snippet funnel()}
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M4 4h16a1 1 0 0 1 .8 1.6L15 13v6.2a1 1 0 0 1-1.4.9l-3-1.4a1 1 0 0 1-.6-.9V13L3.2 5.6A1 1 0 0 1 4 4z" />
  </svg>
{/snippet}
{#snippet dots()}
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" />
  </svg>
{/snippet}
{#snippet lens()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
    <circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.6-4.6" />
  </svg>
{/snippet}
{#snippet caret()}
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M9 5l8 7-8 7z" /></svg>
{/snippet}
{#snippet caretDown()}
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M5 9l7 8 7-8z" /></svg>
{/snippet}
{#snippet pageFirst()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 6l-6 6 6 6" /><path d="M11 6l-6 6 6 6" />
  </svg>
{/snippet}
{#snippet pagePrev()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M15 6l-6 6 6 6" />
  </svg>
{/snippet}
{#snippet pageNext()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
{/snippet}
{#snippet pageLast()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 6l6 6-6 6" /><path d="M13 6l6 6-6 6" />
  </svg>
{/snippet}
{#snippet cross()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
    <path d="M6 6l12 12" /><path d="M18 6L6 18" />
  </svg>
{/snippet}
{#snippet panel()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" />
  </svg>
{/snippet}

<section class="wrap">
  <header class="chrome">
    <p class="hint">
      Sort a column, open a header menu, page through the rows. <strong>Mixed</strong> replaces four
      icons and leaves everything else ours - that is the fallback doing its job.
    </p>
    <div class="seg" role="group" aria-label="Icon set">
      <button class:on={set === 'builtin'} onclick={() => (set = 'builtin')}>Ours</button>
      <button class:on={set === 'mixed'} onclick={() => (set = 'mixed')}>Mixed</button>
      <button class:on={set === 'full'} onclick={() => (set = 'full')}>Yours</button>
    </div>
  </header>

  <div class="grid-host">
    <!-- A snippet per name. Nothing special about them: ordinary markup, and
         `currentColor` is what lets them pick up the hover / muted / accent
         state of whatever chrome they land in. `builtin` passes an empty map,
         which is the same as passing nothing. -->
    <SvGrid
      responsive={true}
      data={rows}
      {columns}
      {features}
      icons={set === 'builtin'
        ? {}
        : set === 'mixed'
          ? { 'sort-asc': arrowUp, 'sort-desc': arrowDown, filter: funnel, menu: dots }
          : {
              'sort-asc': arrowUp,
              'sort-desc': arrowDown,
              filter: funnel,
              menu: dots,
              search: lens,
              'chevron-right': caret,
              'chevron-down': caretDown,
              'page-first': pageFirst,
              'page-prev': pagePrev,
              'page-next': pageNext,
              'page-last': pageLast,
              close: cross,
              clear: cross,
              'tool-panel': panel,
            }}
      getRowId={(r) => String(r.id)}
      showPagination
      pageSize={12}
      filterMode="row"
      toolPanel
      rowHeight={36}
      containerHeight="100%"
      fitColumns
    />
  </div>
</section>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 12px;
  }
  .chrome {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    flex: none;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--sg-muted, #64748b);
    max-width: 62ch;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    overflow: hidden;
  }
  .seg button {
    font: inherit;
    font-size: 13px;
    padding: 5px 12px;
    border: 0;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    cursor: pointer;
  }
  .seg button + button {
    border-left: 1px solid var(--sg-border, #e2e8f0);
  }
  .seg button.on {
    background: var(--sg-accent, #2563eb);
    color: var(--sg-on-accent, #fff);
  }
  .grid-host {
    flex: 1;
    min-height: 0;
  }
</style>
