<script lang="ts">
  /**
   * The sv-grid side of the comparison harness.
   *
   * Deliberately minimal: no toolbar, no theming, no features beyond sorting
   * and column filtering, so what is measured is the grid and not a demo built
   * around it.
   *
   * Sorting and filtering go through the public imperative API (`api.setSort`,
   * `api.setFilter`) rather than props, because there are no controlled
   * `sorting` / `columnFilters` props - only `initialSorting`, which applies
   * once at mount. Every adapter has to be drivable the same way from plain
   * TypeScript, so the harness holds a handle and calls into it.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Row = Record<string, unknown>
  type Features = ReturnType<typeof tableFeatures>

  type Props = {
    rows: Row[]
    columns: Array<{ field: string; header: string; type: 'text' | 'number' }>
    rowHeight: number
    handle: {
      setSort?: (field: string, desc: boolean) => void
      setFilter?: (field: string, value: string) => void
      scroller?: () => HTMLElement | null
    }
  }
  const { rows, columns, rowHeight, handle }: Props = $props()

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const cols: ColumnDef<Features, Row>[] = columns.map((c) => ({
    field: c.field,
    header: c.header,
    width: 140,
    editorType: c.type === 'number' ? 'number' : undefined,
  }))

  let rootEl = $state<HTMLElement | null>(null)
  let api: SvGridApi<Features, Row> | null = null

  handle.setSort = (field, desc) => api?.setSort(field, desc ? 'desc' : 'asc')
  handle.setFilter = (field, value) =>
    api?.setFilter(field, value ? { operator: 'contains', value } : null)
  handle.scroller = () =>
    rootEl?.querySelector<HTMLElement>('.sv-grid-scroll') ??
    rootEl?.querySelector<HTMLElement>('.sv-grid-body-wrap') ??
    null
</script>

<div bind:this={rootEl} style="height:100%">
  <SvGrid
    data={rows}
    columns={cols}
    {features}
    rowHeight={rowHeight}
    showPagination={false}
    virtualization={true}
    columnVirtualization={true}
    containerHeight="100%"
    onApiReady={(a: SvGridApi<Features, Row>) => (api = a)}
  />
</div>
