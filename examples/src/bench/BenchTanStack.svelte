<script lang="ts">
  /**
   * The TanStack Table (@tanstack/svelte-table, v9) side of the comparison
   * harness.
   *
   * TanStack Table is headless: it computes the row model and renders
   * nothing. To measure it in the same container as the rendered grids this
   * component draws the row model through the least markup a real app could
   * ship - a fixed-row-height windowed `<table>` that renders only the rows in
   * view plus a small overscan, with sticky header cells. There is no
   * virtualizer library, no cell components and no styling beyond the sizes
   * the harness fixes for every grid.
   *
   * Read the numbers as "the engine plus a minimal DOM", not as a grid: the
   * filter menus, editors and accessibility the other grids ship are absent
   * here by design, which is also why its mount is expected to be fast.
   *
   * Sorting and filtering go through the public table API
   * (`table.setSorting`, `table.setColumnFilters`) and the row model is
   * re-read after each call, which is what an application does.
   */
  import {
    createTable,
    tableFeatures,
    rowSortingFeature,
    createSortedRowModel,
    sortFn_alphanumeric,
    sortFn_basic,
    columnFilteringFeature,
    createFilteredRowModel,
    filterFn_includesString,
  } from '@tanstack/svelte-table'

  type Row = Record<string, unknown>
  type Props = {
    rows: Row[]
    columns: Array<{ field: string; header: string; type: 'text' | 'number' }>
    rowHeight: number
    handle: {
      setSort?: (field: string, desc: boolean) => void
      setFilter?: (field: string, value: string) => void
      scroller?: () => HTMLElement | null
      setRows?: (rows: Array<Record<string, unknown>>) => void
    }
  }
  const { rows, columns, rowHeight, handle }: Props = $props()

  // The tick path: the table reads `data` through its getter, and the
  // version bump re-reads the row model, as an app would.
  let data = $state.raw<Array<Record<string, unknown>>>(rows)
  handle.setRows = (next) => {
    data = next
    version += 1
  }

  const features = tableFeatures({
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
    columnFilteringFeature,
    filteredRowModel: createFilteredRowModel(),
    filterFns: { includesString: filterFn_includesString },
  })
  const cols = columns.map((c) => ({
    accessorKey: c.field,
    header: c.header,
    size: 140,
    sortingFn: c.type === 'number' ? 'basic' : 'alphanumeric',
    filterFn: 'includesString',
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = createTable<any, any>({
    features,
    columns: cols as never,
    get data() {
      return data
    },
  })

  // The row model is re-read after every state change the harness makes;
  // the counter is the signal Svelte needs to re-run the derived below.
  let version = $state(0)
  let scrollTop = $state(0)
  let viewport = $state(520)
  let scrollEl = $state<HTMLElement | null>(null)

  const OVERSCAN = 5
  const model = $derived.by(() => {
    void version
    return table.getRowModel().rows
  })
  const start = $derived(Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN))
  const end = $derived(Math.min(model.length, Math.ceil((scrollTop + viewport) / rowHeight) + OVERSCAN))
  const visible = $derived(model.slice(start, end))
  const fields = columns.map((c) => c.field)

  handle.setSort = (field, desc) => {
    table.setSorting([{ id: field, desc }])
    version += 1
  }
  handle.setFilter = (field, value) => {
    table.setColumnFilters(value ? [{ id: field, value }] : [])
    version += 1
  }
  handle.scroller = () => scrollEl
</script>

<div
  class="tt-scroll"
  bind:this={scrollEl}
  bind:clientHeight={viewport}
  onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
  style="height:100%;overflow:auto;position:relative"
>
  <div style="height:{(model.length + 1) * rowHeight}px;position:relative">
    <table style="position:absolute;top:{start * rowHeight}px;left:0;table-layout:fixed;border-collapse:collapse;width:{fields.length * 140}px">
      <thead>
        <tr style="height:{rowHeight}px;position:sticky;top:0;background:#fff">
          {#each columns as c (c.field)}
            <th style="width:140px;text-align:left;padding:0 8px;overflow:hidden;white-space:nowrap">{c.header}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each visible as row (row.id)}
          <tr class="tt-row" style="height:{rowHeight}px">
            {#each fields as f (f)}
              <td style="width:140px;padding:0 8px;overflow:hidden;white-space:nowrap">{row.original[f]}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
