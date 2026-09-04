<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 25. Column pinning + freezing
   * -----------------------------
   * Wide grid (8 generous columns ~2050px total) so horizontal scrolling
   * kicks in on any reasonable viewport. Company is pre-pinned to the
   * LEFT and Unit price to the RIGHT - they stay sticky while the middle
   * columns slide under them when you scroll.
   *
   * Try it:
   *   - Scroll the grid horizontally - Company stays anchored on the left,
   *     Unit price on the right, the rest scroll between them.
   *   - Hover any middle-column header → click the ⋮ that appears →
   *     "Pin to left" / "Pin to right" / "Unpin column".
   *
   * Note: column pinning requires `columnVirtualization={false}` because
   * the virtualizer recycles DOM nodes (which breaks sticky positioning).
   * The pin menu items are hidden when virtualization is on, so the
   * gating is automatic.
   *
   * A programmatic `api.setColumnPinning(id, side)` is on the v1.x
   * roadmap; today the `initialColumnPinning` prop covers the on-mount
   * case and the column menu covers user-driven re-pinning.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from '@svgrid/grid'
  import { makeOrders, type Order } from '../shared/seed'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
  })

  let rows = $state<Order[]>(makeOrders(500))

  // 8 generous columns - total ~2050px so the grid overflows horizontally
  // on any normal monitor. Pinning is only meaningful when the grid
  // actually scrolls; the demo has to force that condition to demonstrate
  // the feature.
  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'company',    header: 'Company',        width: 240 },
    { field: 'product',    header: 'Product',        width: 320 },
    { field: 'orderId',    header: 'Order ID',       width: 180 },
    { field: 'country',    header: 'Country',        width: 200 },
    { field: 'sellDate',   header: 'Sell date',      width: 220,
      format: { type: 'date', pattern: 'y-m-d' } },
    { field: 'quantity',   header: 'Quantity',       width: 170,
      format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'inStock',    header: 'In stock',       width: 160 },
    { field: 'price',      header: 'Unit price',     width: 200,
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div
    class="shrink-0 rounded-lg border px-4 py-3"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Company is pinned LEFT · Unit price is pinned RIGHT
    </p>
    <ol class="mt-1 text-xs list-decimal pl-5 space-y-0.5" style="color: var(--sg-fg);">
      <li>
        <strong>Scroll horizontally</strong> - Company and Unit price stay anchored at the edges
        while everything else slides between them.
      </li>
      <li>
        <strong>Pin another column</strong> - hover any middle header → click the
        <code style="color: var(--site-accent-2, #22d3ee);">⋮</code> → pick
        <em>Pin to left</em>, <em>Pin to right</em>, or <em>Unpin column</em>.
      </li>
    </ol>
  </div>

  <div class="flex-1 min-h-0 pinning-host">
    <SvGrid responsive={true}
      columnResize
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      showRowNumbers={true}
      showPagination={true}
      pageSize={50}
      enableCellSelection={true}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={false}
      columnVirtualization={false}
      initialColumnPinning={{ left: ['company'], right: ['price'] }}
    />
  </div>

  <footer class="pin-foot text-xs shrink-0">
    {rows.length} rows · {columns.length} columns ·
    <code>fitColumns=&lbrace;false&rbrace;</code> +
    <code>columnVirtualization=&lbrace;false&rbrace;</code>
    so the grid keeps its declared widths and the sticky pinned columns work.
  </footer>
</section>

<style>
  .pin-foot { color: var(--sg-muted, #64748b); }

  /* Punch up the visual contrast for pinned columns so the user can
     immediately see which columns are frozen. The grid already supports
     these tokens; this demo just turns the dial higher to demo the
     feature. */
  .pinning-host {
    /* Body cells: a stronger accent-tinted background than the default
       8% mix - the pinned strip should read as a clearly different surface.
       The two color-mix percentages MUST sum to 100% - otherwise CSS scales
       the result's alpha down (e.g. 55% + 18% = 73% -> 0.73 alpha), which
       makes the pinned column semi-transparent and lets the scrolling
       middle columns bleed through. */
    --sg-pinned-bg: color-mix(in oklab, var(--sg-bg, #ffffff) 82%, var(--sg-accent, #2563eb) 18%);
    /* Header cells: even bolder so the frozen header is unmistakable. */
    --sg-pinned-header-bg: color-mix(in oklab, var(--sg-header-bg, #f1f5f9) 70%, var(--sg-accent, #2563eb) 30%);
    /* Divider line on the inside edge - solid accent so it reads as
       intentional, not as a normal cell border. */
    --sg-pinned-divider: var(--sg-accent, #2563eb);
  }
  :global(html[data-theme='dark']) .pinning-host {
    --sg-pinned-bg: color-mix(in oklab, var(--sg-bg, #181d27) 76%, var(--sg-accent, #3b82f6) 24%);
    --sg-pinned-header-bg: color-mix(in oklab, var(--sg-header-bg, #1e2433) 64%, var(--sg-accent, #3b82f6) 36%);
    --sg-pinned-divider: var(--sg-accent, #3b82f6);
  }

  /* No icon - the accent-tinted background tokens above (--sg-pinned-bg
     / --sg-pinned-header-bg) carry the "this column is frozen" signal
     on their own. Punch the header tint further to make it unmistakable
     even at a glance. */
  .pinning-host {
    --sg-pinned-header-bg: color-mix(in oklab, var(--sg-header-bg, #f1f5f9) 58%, var(--sg-accent, #2563eb) 42%);
  }
  :global(html[data-theme='dark']) .pinning-host {
    --sg-pinned-header-bg: color-mix(in oklab, var(--sg-header-bg, #1e2433) 52%, var(--sg-accent, #3b82f6) 48%);
  }
  /* Make the pinned header text white on the now-strong accent fill so
     contrast stays readable in both modes. */
  .pinning-host :global(.sv-grid-head .sv-grid-column[data-pinned]) {
    color: #fff;
  }
  .pinning-host :global(.sv-grid-head .sv-grid-column[data-pinned] *) {
    color: inherit;
  }
</style>
