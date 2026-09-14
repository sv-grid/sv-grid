<script lang="ts">
  /**
   * The grid behind a chart: `chartSpecToTable` lays the spec out as rows and
   * columns and `SvGrid` draws them. The chart demos flip to this from their
   * Chart | Grid switch, so a reader can see the numbers a chart was drawn from
   * and sort them.
   */
  import { SvGrid, chartSpecToTable, type ChartSpec, type GridColumns } from '@svgrid/grid'

  let { spec, height }: { spec: ChartSpec; height?: number } = $props()

  const table = $derived(chartSpecToTable(spec))
  const columns = $derived(table.columns as GridColumns<Record<string, unknown>>)
</script>

{#if table.rows.length}
  <SvGrid data={table.rows} {columns} sortable fitColumns showRowSelection={false} rowHeight={28} containerHeight={height ?? spec.height ?? 320} responsive />
{:else}
  <p class="empty">Nothing to tabulate for this chart.</p>
{/if}

<style>
  .empty {
    margin: 0;
    padding: 16px;
    font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
</style>
