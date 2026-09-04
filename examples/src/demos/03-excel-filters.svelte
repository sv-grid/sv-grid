<script lang="ts">
  /**
   * 03. Excel-style filters
   * -----------------------
   * The grid's built-in column menu exposes a per-column operator + value
   * filter - clicking the filter icon on a header opens it. This demo turns
   * that surface on and adds an "active filter chips" strip on top, driven
   * by the imperative API.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
    type SvGridFilterOperator,
  } from '@svgrid/grid'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
  })

  const rows = makePeople(2_500)

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName',  header: 'First name', editorType: 'text' },
    { field: 'lastName',   header: 'Last name',  editorType: 'text' },
    { field: 'department', header: 'Department', editorType: 'text' },
    { field: 'country',    header: 'Country',    editorType: 'text' },
    { field: 'status',     header: 'Status',     editorType: 'text' },
    { field: 'age',        header: 'Age',        editorType: 'number' },
    {
      field: 'salary',
      header: 'Salary',
      editorType: 'number',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
  ]

  type ActiveChip = { columnId: string; operator: SvGridFilterOperator; value?: string }

  let api = $state<SvGridApi<typeof features, Person> | null>(null)
  let chips = $state<ActiveChip[]>([])

  function applyChip(chip: ActiveChip) {
    chips = [...chips.filter((c) => c.columnId !== chip.columnId), chip]
    api?.setFilter(chip.columnId, { operator: chip.operator, value: chip.value })
  }

  function removeChip(columnId: string) {
    chips = chips.filter((c) => c.columnId !== columnId)
    api?.clearFilter(columnId)
  }

  function clearAll() {
    for (const chip of chips) api?.clearFilter(chip.columnId)
    chips = []
  }

  // Quick presets to demonstrate the API surface.
  function preset(name: 'engineers' | 'senior' | 'active') {
    clearAll()
    if (name === 'engineers') applyChip({ columnId: 'department', operator: 'equals', value: 'Engineering' })
    if (name === 'senior')    applyChip({ columnId: 'age', operator: 'greaterThan', value: '50' })
    if (name === 'active')    applyChip({ columnId: 'status', operator: 'equals', value: 'active' })
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-2 text-sm shrink-0">
    <span class="font-medium">Quick presets:</span>
    <button onclick={() => preset('engineers')} class="xf-btn rounded px-3 py-1">Engineering only</button>
    <button onclick={() => preset('senior')} class="xf-btn rounded px-3 py-1">Age &gt; 50</button>
    <button onclick={() => preset('active')} class="xf-btn rounded px-3 py-1">Active only</button>
    <span class="xf-hint ml-3">Or click the filter icon on any column header.</span>
  </div>

  {#if chips.length}
    <div class="flex flex-wrap items-center gap-2 text-xs shrink-0">
      <span class="xf-hint">Active:</span>
      {#each chips as chip (chip.columnId)}
        <span class="xf-chip inline-flex items-center gap-1 rounded-full px-2 py-0.5">
          {chip.columnId} {chip.operator} {chip.value ?? ''}
          <button onclick={() => removeChip(chip.columnId)} aria-label="Remove filter" class="xf-chip-x rounded-full px-1">×</button>
        </span>
      {/each}
      <button onclick={clearAll} class="xf-clear ml-2 underline">Clear all</button>
    </div>
  {/if}

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      columnResize
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      enableInlineEditing={false}
      enableCellSelection={true}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
    />
  </div>
</section>

<style>
  .xf-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #0f172a);
  }
  .xf-btn:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .xf-hint { color: var(--sg-muted, #64748b); }
  .xf-clear { color: var(--sg-muted, #475569); }
  .xf-chip {
    background: color-mix(in srgb, var(--sg-accent, #2563eb) 14%, transparent);
    color: var(--sg-accent, #1d4ed8);
  }
  .xf-chip-x:hover { background: color-mix(in srgb, var(--sg-accent, #2563eb) 26%, transparent); }
</style>
