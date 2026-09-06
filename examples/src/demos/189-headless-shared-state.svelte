<!-- Documented in: docs/help/headless/controlled-state.md -->
<script lang="ts">
  /**
   * 189. Two headless grids, one shared state
   * -----------------------------------------
   * `createGridState` returns a [get, set] tuple - a reactive store you own.
   * Feed the SAME store to two independent createSvGrid engines and they stay in
   * lockstep: sort a column in Grid A and Grid B re-sorts too, because both read
   * the same reactive `sorting`. Each renders its own markup.
   */
  import {
    createSvGrid,
    createCoreRowModel,
    createSortedRowModel,
    createGridState,
    tableFeatures,
    rowSortingFeature,
    type GridColumns,
  } from '@svgrid/grid'

  type Row = { name: string; region: string; deals: number }
  const features = tableFeatures({ rowSortingFeature })
  const columns: GridColumns<Row> = [
    { field: 'name', header: 'Rep' },
    { field: 'region', header: 'Region' },
    { field: 'deals', header: 'Deals' },
  ]
  const data: Row[] = [
    { name: 'Ava', region: 'EMEA', deals: 42 },
    { name: 'Liam', region: 'APAC', deals: 51 },
    { name: 'Noah', region: 'AMER', deals: 33 },
    { name: 'Mia', region: 'EMEA', deals: 60 },
    { name: 'Zoe', region: 'APAC', deals: 28 },
  ]

  // One shared, reactive store - owned here, not by either grid.
  type Sort = { id: string; desc: boolean }
  const [getSorting, setSorting] = createGridState<Sort[]>([{ id: 'deals', desc: true }])

  // Plain builder - reads the shared store on each call.
  const buildGrid = () =>
    createSvGrid({
      _features: features,
      _rowModels: { coreRowModel: createCoreRowModel<Row>(), sortedRowModel: createSortedRowModel<Row>() },
      data,
      columns,
      state: { sorting: getSorting() }, // read the shared store
      onSortingChange: setSorting, // write it - the setter already applies updaters
    })
  // Two independent engines, both derived from the same shared store.
  const gridA = $derived.by(buildGrid)
  const gridB = $derived.by(buildGrid)

  function toggleSort(id: string) {
    const cur = getSorting()[0]
    setSorting(cur?.id !== id ? [{ id, desc: false }] : cur.desc ? [] : [{ id, desc: true }])
  }
  const ind = (id: string) => {
    const s = getSorting()[0]
    return s?.id === id ? (s.desc ? '▼' : '▲') : ''
  }
</script>

<section class="ss-wrap">
  <p class="ss-note">
    Both grids share one <code>createGridState</code> store. Click any header in
    <strong>either</strong> grid - the other re-sorts in lockstep. Two engines,
    one source of truth.
  </p>

  <div class="ss-grids">
    {#each [{ label: 'Grid A', g: gridA }, { label: 'Grid B', g: gridB }] as panel (panel.label)}
      <div class="ss-panel">
        <div class="ss-title">{panel.label}</div>
        <table>
          <thead>
            {#each panel.g.getHeaderGroups() as hg (hg.id)}
              <tr>
                {#each hg.headers as h (h.id)}
                  <th class:num={h.column.id === 'deals'} onclick={() => toggleSort(h.column.id)}>
                    {h.column.columnDef.header}<span class="ss-ind">{ind(h.column.id)}</span>
                  </th>
                {/each}
              </tr>
            {/each}
          </thead>
          <tbody>
            {#each panel.g.getRowModel().rows as r (r.id)}
              {@const row = r.original as Row}
              <tr>
                <td>{row.name}</td>
                <td>{row.region}</td>
                <td class="num">{row.deals}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/each}
  </div>
</section>

<style>
  .ss-wrap { display: flex; flex-direction: column; gap: 14px; padding: 4px; }
  .ss-note { font-size: 13px; color: var(--sg-fg, #0f172a); margin: 0; }
  .ss-note strong { color: var(--sg-accent, #6366f1); }
  .ss-grids { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 640px) { .ss-grids { grid-template-columns: 1fr; } }
  .ss-panel { border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; overflow: hidden; }
  .ss-title {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--sg-muted, #64748b); padding: 8px 12px; background: var(--sg-header-bg, #f8fafc);
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .ss-panel table { border-collapse: collapse; width: 100%; font-size: 13px; color: var(--sg-fg, #0f172a); }
  .ss-panel th {
    text-align: left; padding: 8px 12px; cursor: pointer; user-select: none; font-weight: 700;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .ss-panel th:hover { color: var(--sg-accent, #6366f1); }
  .ss-ind { color: var(--sg-accent, #6366f1); margin-left: 5px; font-size: 10px; }
  .ss-panel td { padding: 8px 12px; border-bottom: 1px solid var(--sg-border, #eef2f7); }
  .ss-panel td.num, .ss-panel th.num { text-align: right; font-variant-numeric: tabular-nums; }
</style>
