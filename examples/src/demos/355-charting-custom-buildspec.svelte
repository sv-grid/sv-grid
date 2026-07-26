<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 355. Built-in charting: custom chart via `buildSpec`
   * ---------------------------------------------------
   * Shapes that aren't a group-by aggregation - here a sankey flow diagram -
   * still live in the built-in docked panel. Return any `ChartSpec` from the
   * current rows via `charting.buildSpec`; the panel scopes it to the selection
   * and re-runs it on every grid change, so the custom chart stays live. Filter
   * the flow table and the ribbons re-draw.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type ChartSpec,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Flow = { id: number; from: string; to: string; users: number }
  // A small acyclic user-journey funnel.
  const rows: Flow[] = [
    { id: 1, from: 'Landing', to: 'Browse', users: 5200 },
    { id: 2, from: 'Landing', to: 'Sign up', users: 1800 },
    { id: 3, from: 'Browse', to: 'Sign up', users: 2400 },
    { id: 4, from: 'Browse', to: 'Exit', users: 2800 },
    { id: 5, from: 'Sign up', to: 'Activated', users: 3100 },
    { id: 6, from: 'Sign up', to: 'Exit', users: 1100 },
    { id: 7, from: 'Activated', to: 'Subscribed', users: 1500 },
    { id: 8, from: 'Activated', to: 'Exit', users: 1600 },
  ]

  const columns: ColumnDef<typeof features, Flow>[] = [
    { field: 'from', header: 'From', width: 150 },
    { field: 'to', header: 'To', width: 150 },
    { field: 'users', header: 'Users', width: 130, align: 'right', cellDataType: 'number', format: { type: 'number' } },
  ]

  // Build a sankey spec from whatever rows the grid currently shows.
  function buildFlow(data: Flow[]): ChartSpec {
    const ids = new Set<string>()
    for (const r of data) { ids.add(r.from); ids.add(r.to) }
    return {
      type: 'sankey',
      categories: [],
      series: [],
      sankeyNodes: [...ids].map((id) => ({ id, label: id })),
      sankeyLinks: data.map((r) => ({ source: r.from, target: r.to, value: r.users })),
    }
  }
</script>

<div class="demo-page" style="height: 620px; display: flex; flex-direction: column;">
  <p class="demo-hint" style="margin: 0 0 8px;">
    A custom <strong>sankey</strong> - impossible via group-by - rendered in the built-in chart panel through
    <code>charting.buildSpec</code>. Filter the flow table and the ribbons re-draw live.
  </p>
  <div style="flex: 1; min-height: 0;">
    <SvGrid
      data={rows}
      {columns}
      {features}
      sortable
      filterable
      filterMode="row"
      containerHeight="100%"
      charting={{ defaultOpen: true, position: 'right', width: 460, buildSpec: buildFlow }}
    />
  </div>
</div>
