<script lang="ts">
  /**
   * 174. Zebra rows
   * ----------------
   * Set the `zebraRows` prop on <SvGrid responsive={true}> and every other DATA row gets
   * the `--sg-row-alt-bg` background. Only data rows stripe - pinned,
   * group, detail, and summary rows keep their single background, so a
   * pinned total row reads as one solid band even when zebra is on.
   *
   * The stripe color is the theme's `--sg-row-alt-bg` token, so it
   * follows whatever preset/dark-mode the page is using.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    type GridColumns,
  } from '@svgrid/grid'

  let zebraRows = $state(true)

  type Row = { region: string; rep: string; deals: number; revenue: number }
  const REGIONS = ['North', 'South', 'East', 'West', 'Central']
  const REPS = ['A. Lovelace', 'G. Hopper', 'A. Turing', 'M. Hamilton', 'L. Torvalds', 'D. Knuth']
  const rows: Row[] = Array.from({ length: 24 }, (_, i) => ({
    region: REGIONS[i % REGIONS.length]!,
    rep: REPS[i % REPS.length]!,
    deals: 3 + ((i * 7) % 19),
    revenue: 12_000 + ((i * 4310) % 90_000),
  }))

  // A pinned total row to show it stays a single background under zebra.
  const totals: Row[] = [{
    region: 'Total',
    rep: '',
    deals: rows.reduce((s, r) => s + r.deals, 0),
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
  }]

  const features = tableFeatures({ rowSortingFeature })
  const columns: GridColumns<Row> = [
    { field: 'region',  header: 'Region' },
    { field: 'rep',     header: 'Sales rep' },
    { field: 'deals',   header: 'Deals',   align: 'right', format: { type: 'number' } },
    { field: 'revenue', header: 'Revenue', align: 'right',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <header>
    <h2 class="text-base font-semibold">Zebra rows</h2>
    <p class="text-xs mt-1" style="color: var(--sg-muted);">
      Toggle the <code>zebraRows</code> prop. Alternating <em>data</em> rows take the theme's
      <code>--sg-row-alt-bg</code> color. The pinned <strong>Total</strong> row stays a single
      band - pinned, group, detail, and summary rows are never striped.
    </p>
    <label class="zr-toggle mt-2">
      <input type="checkbox" bind:checked={zebraRows} />
      <code>zebraRows={'{'}{zebraRows}{'}'}</code>
    </label>
  </header>

  <div class="zr-wrap">
    <SvGrid responsive={true}
      columnResize
      data={rows}
      columns={columns}
      features={features}
      pinnedTopRows={totals}
      zebraRows={zebraRows}
      sortable
      showRowSelection={false}
      showColumnFilters={false}
      rowHeight={32}
      containerHeight="100%"
    />
  </div>
</section>

<style>
  .zr-wrap {
    flex: 1; min-height: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    overflow: hidden;
  }
  .zr-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
  }
  .zr-toggle code {
    background: var(--sg-header-bg, #f1f5f9);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 4px;
    padding: 1px 6px;
  }
</style>
