<script lang="ts">
  /**
   * 06. Large dataset, virtualized
   * ------------------------------
   * Row + column virtualization make a wide grid scroll smoothly.
   *
   * The user can scale the dataset up at runtime. The default is 10,000 rows
   * × 50 columns - a realistic enterprise size that mounts in well under a
   * second. The 100,000-row option pushes the grid hard; expect a brief
   * pause on mount, then smooth scrolling once the virtualizer is live.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from 'sv-grid-core'
  import { makeWidePeople, type WidePerson } from '../shared/seed'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
  })

  type Size = { rows: number; cols: number; label: string }
  const sizes: Size[] = [
    { rows: 1_000,   cols: 25, label: '1k × 25' },
    { rows: 10_000,  cols: 50, label: '10k × 50' },
    { rows: 50_000,  cols: 75, label: '50k × 75' },
    { rows: 100_000, cols: 95, label: '100k × 100' },
  ]

  let size = $state<Size>(sizes[1]!)
  let busy = $state(false)
  let rows = $state.raw<WidePerson[]>([])
  let columns = $state.raw<ColumnDef<typeof features, WidePerson>[]>([])
  let mountedAt = $state(0)

  function buildColumns(metrics: number): ColumnDef<typeof features, WidePerson>[] {
    const W = 180
    const base: ColumnDef<typeof features, WidePerson>[] = [
      { field: 'firstName',  header: 'First name', editorType: 'text', width: W },
      { field: 'lastName',   header: 'Last name',  editorType: 'text', width: W },
      { field: 'department', header: 'Department', editorType: 'text', width: W },
      { field: 'country',    header: 'Country',    editorType: 'text', width: W },
      { field: 'status',     header: 'Status',     editorType: 'text', width: W },
    ]
    const metric: ColumnDef<typeof features, WidePerson>[] = []
    for (let i = 0; i < metrics; i++) {
      metric.push({
        field: `metric_${i}` as `metric_${number}`,
        header: `Metric ${i}`,
        editorType: 'number',
        format: { type: 'number', options: { maximumFractionDigits: 2 } },
        width: W,
      })
    }
    return [...base, ...metric]
  }

  async function load(next: Size) {
    busy = true
    // Unmount the grid first so the heavy old rows are GC'd before the new ones
    // are generated. Without this, peak memory is ~2× the larger size.
    rows = []
    columns = []
    await new Promise((r) => requestAnimationFrame(r))
    const t0 = performance.now()
    const generated = makeWidePeople(next.rows, next.cols, 1337)
    columns = buildColumns(next.cols)
    rows = generated
    size = next
    mountedAt = Math.round(performance.now() - t0)
    busy = false
  }

  // Initial load
  $effect(() => {
    if (rows.length === 0 && !busy) load(size)
  })
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-2 text-sm shrink-0">
    <span class="font-medium">Dataset:</span>
    {#each sizes as option (option.label)}
      {@const active = option.rows === size.rows && option.cols === size.cols}
      <button
        type="button"
        onclick={() => load(option)}
        disabled={busy || active}
        class="rounded border px-3 py-1 {active ? 'bg-slate-200 dark:bg-slate-700 font-semibold' : 'border-slate-300 dark:border-slate-600'} disabled:opacity-50"
      >{option.label}</button>
    {/each}
    <span class="ml-auto text-slate-500 dark:text-slate-400">
      {#if busy}
        Generating…
      {:else if rows.length}
        {size.rows.toLocaleString()} rows · {size.cols + 5} columns · generated in {mountedAt} ms
      {/if}
    </span>
  </div>

  {#if rows.length}
    <div class="flex-1 min-h-0">
      <SvGrid
        data={rows}
        columns={columns}
        features={features}
        filterMode="menu"
        selectionMode="cell"
        showPagination={false}
        enableInlineEditing={false}
        enableCellSelection={true}
        enableRowSummaries={false}
        showRowNumbers={true}
        virtualization={true}
        columnVirtualization={true}
        rowHeight={32}
        overscan={8}
        columnOverscan={3}
        columnWidth={180}
        containerHeight="100%"
      />
    </div>
  {/if}
</section>
