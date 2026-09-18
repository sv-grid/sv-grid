<script lang="ts">
  /**
   * A stand-in for @svgrid/enterprise's SvGridGantt, for `svgrid.gantt-seam.test.ts`.
   *
   * The seam's contract is which props the grid hands the renderer, so this
   * writes each of them into the DOM where a test can read them back. It is
   * named `.test.svelte` so `tools/strip-dist-tests.mjs` keeps it out of the
   * published tarball, and the grid's vitest only collects `*.test.ts`, so it
   * is never mistaken for a suite of its own.
   */
  import type { ColumnDef, GanttConfig, RowData, TableFeatures } from './index'

  let {
    data = [],
    columns = [],
    gantt,
    getRowId,
  }: {
    data: ReadonlyArray<RowData>
    columns: Array<ColumnDef<TableFeatures, any>>
    gantt: GanttConfig<TableFeatures, any>
    getRowId?: (row: any, index: number) => string
  } = $props()

  const ids = $derived(
    data.map((r, i) => (getRowId ? getRowId(r, i) : String(i))).join(','),
  )
</script>

<div
  class="gantt-stub"
  data-ids={ids}
  data-rows={data.length}
  data-cols={columns.length}
  data-start={gantt?.startField ?? ''}
  data-parent={gantt?.parentField ?? ''}
  data-has-get-row-id={typeof getRowId === 'function'}
></div>
