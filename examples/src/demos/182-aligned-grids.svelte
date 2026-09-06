<!-- Documented in: docs/help/columns/aligned-grids.md -->
<script lang="ts">
  /**
   * 182. Aligned grids
   * ------------------
   * Two independent grids that share the same `alignedGridGroup`: scroll one
   * horizontally and the other follows; resize a column in either and the
   * matching column resizes in both. Classic use - a "budget vs actuals"
   * comparison, or a totals grid pinned under a body grid - where the columns
   * must stay lined up. There are enough month columns here to force a
   * horizontal scrollbar so the sync is obvious.
   */
  import { SvGrid, tableFeatures, rowSortingFeature, type ColumnDef,
    type GridColumns } from '@svgrid/grid'

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  type Row = { category: string } & Record<string, number | string>

  function makeRows(base: number, spread: number): Row[] {
    const cats = ['Salaries', 'Marketing', 'Cloud', 'Travel', 'Office']
    return cats.map((category, ci) => {
      const r: Row = { category }
      for (let m = 0; m < MONTHS.length; m += 1) {
        r[MONTHS[m]!] = base + ((ci * 7 + m * 13) % spread) * 1000
      }
      return r
    })
  }
  const budget = makeRows(20_000, 40)
  const actuals = makeRows(18_000, 55)

  const features = tableFeatures({ rowSortingFeature })
  const money = { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } as const

  function cols(): GridColumns<Row> {
    return [
      { field: 'category', header: 'Category', width: 150 },
      ...MONTHS.map(
        (m): ColumnDef<typeof features, Row> => ({
          field: m,
          header: m,
          width: 110,
          align: 'right',
          cellDataType: 'number',
          format: money,
        }),
      ),
    ]
  }
  // Each grid needs its own column array instance.
  const budgetCols = cols()
  const actualCols = cols()
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <p class="text-sm shrink-0" style="color: var(--sg-fg);">
    <strong>Scroll horizontally</strong> in either grid - the other follows.
    <strong>Resize any month column</strong> - the matching column resizes in
    both. Both grids share <code>alignedGridGroup="finance"</code>.
  </p>

  <div class="flex flex-col gap-3 flex-1 min-h-0">
    <div class="ag-block">
      <div class="ag-title">Budget</div>
      <div class="ag-grid">
        <SvGrid responsive={true}
      columnResize
          data={budget}
          columns={budgetCols}
          features={features}
          alignedGridGroup="finance"
          selectionMode="none"
          rowHeight={36}
          containerHeight="100%"
        />
      </div>
    </div>

    <div class="ag-block">
      <div class="ag-title">Actuals</div>
      <div class="ag-grid">
        <SvGrid responsive={true}
      columnResize
          data={actuals}
          columns={actualCols}
          features={features}
          alignedGridGroup="finance"
          selectionMode="none"
          rowHeight={36}
          containerHeight="100%"
        />
      </div>
    </div>
  </div>
</section>

<style>
  .ag-block { display: flex; flex-direction: column; min-height: 0; flex: 1; }
  .ag-title {
    font-size: 12px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.05em; color: var(--sg-muted, #64748b);
    padding: 2px 2px 6px;
  }
  .ag-grid { flex: 1; min-height: 0; }
</style>
