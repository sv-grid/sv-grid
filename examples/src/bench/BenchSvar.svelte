<script lang="ts">
  /**
   * The SVAR Svelte DataGrid (wx-svelte-grid) side of the comparison harness.
   *
   * Same rules as BenchSvGrid.svelte: default theme, the harness's row height
   * and column width, sorting and filtering through the public API
   * (`api.exec('sort-rows')`, `api.exec('filter-rows')`), nothing else turned
   * on. SVAR virtualizes rows and columns by default, so no flag is needed.
   */
  import { Grid, Willow } from 'wx-svelte-grid'

  type Row = Record<string, unknown>
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

  const cols = columns.map((c) => ({ id: c.field, header: c.header, width: 140, sort: true }))

  type SvarApi = { exec: (action: string, params: Record<string, unknown>) => void }
  let api: SvarApi | null = null
  let rootEl = $state<HTMLElement | null>(null)

  function init(a: SvarApi) {
    api = a
  }

  handle.setSort = (field, desc) => api?.exec('sort-rows', { key: field, order: desc ? 'desc' : 'asc' })
  handle.setFilter = (field, value) => {
    const needle = value.toLowerCase()
    api?.exec('filter-rows', {
      filter: needle ? (row: Row) => String(row[field] ?? '').toLowerCase().includes(needle) : null,
    })
  }
  handle.scroller = () => rootEl?.querySelector<HTMLElement>('.wx-scroll') ?? null
</script>

<div bind:this={rootEl} style="height:100%">
  <Willow>
    <Grid data={rows} columns={cols} sizes={{ rowHeight, columnWidth: 140 }} {init} />
  </Willow>
</div>
