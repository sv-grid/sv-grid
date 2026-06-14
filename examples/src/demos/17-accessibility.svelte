<script lang="ts">
  /**
   * 17. Accessibility
   * -----------------
   * SvGrid ships with the WAI-ARIA grid pattern built in:
   *
   *   - role="grid" / role="row" / role="columnheader" / role="gridcell"
   *     are applied through the helpers in `src/a11y.ts`.
   *   - `aria-rowcount` / `aria-colcount` reflect the visible model.
   *   - Each row + cell gets an `aria-rowindex` / `aria-colindex`.
   *   - The active cell carries the focus and DOM `id`. Headers expose
   *     `aria-sort="ascending|descending|none"`.
   *   - Arrow keys move between cells. Home/End jump to row edges.
   *     Page Up/Down move by a page. F2 / Enter starts editing.
   *     Ctrl+Home / Ctrl+End jump to the grid edges.
   *
   * This demo adds:
   *
   *   - A live `role="status"` region that announces sort / filter /
   *     selection changes to screen readers.
   *   - A "Show ARIA state" panel that surfaces the values a screen
   *     reader would read for the active cell.
   *   - A high-contrast focus outline you can toggle.
   *   - A keyboard-shortcut cheat sheet pinned to the side.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-community'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  const rows = makePeople(120)
  let api = $state<SvGridApi<typeof features, Person> | null>(null)

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName',  header: 'First name', editorType: 'text', width: 130 },
    { field: 'lastName',   header: 'Last name',  editorType: 'text', width: 130 },
    { field: 'department', header: 'Department', editorType: 'text', width: 140 },
    { field: 'country',    header: 'Country',    editorType: 'text', width: 110 },
    { field: 'age',        header: 'Age',        editorType: 'number', width: 80 },
    {
      field: 'salary',
      header: 'Salary',
      editorType: 'number',
      width: 130,
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
    {
      field: 'performance',
      header: 'Performance',
      editorType: 'number',
      width: 110,
    },
  ]

  let highContrast = $state(false)
  let announcement = $state('')
  let selectedCount = $state(0)
  let sortLabel = $state('none')
  let filterCount = $state(0)
  let activeCellInfo = $state('row 1, column "First name"')

  // Announce changes to screen readers. `role="status"` (aria-live="polite")
  // queues announcements without interrupting the user.
  function announce(message: string) {
    // Briefly clear then set so consecutive identical messages still get
    // re-announced. Some assistive tech dedupes on string equality.
    announcement = ''
    setTimeout(() => (announcement = message), 30)
  }

  // Read the live ARIA state of the focused cell. We piggyback on the DOM
  // attributes the grid writes - that's what a screen reader actually sees.
  function readActiveCellAria() {
    const active = document.querySelector<HTMLElement>('.sv-grid-cell-active')
    if (!active) return
    const row = active.getAttribute('aria-rowindex') ?? '?'
    const colId = active.getAttribute('data-col-id') ?? '?'
    const colDef = columns.find((c) => c.field === colId)
    const colName = (colDef?.header as string) ?? colId
    activeCellInfo = `row ${row}, column "${colName}"`
  }

  $effect(() => {
    // Update the live active-cell readout on every focus + keydown so the
    // sidebar stays in sync with the cursor.
    const update = () => readActiveCellAria()
    document.addEventListener('focusin', update)
    document.addEventListener('keyup', update)
    return () => {
      document.removeEventListener('focusin', update)
      document.removeEventListener('keyup', update)
    }
  })

  const SHORTCUTS: Array<{ keys: string; what: string }> = [
    { keys: '↑ ↓ ← →',        what: 'Move active cell by one' },
    { keys: 'Home / End',     what: 'First / last cell in row' },
    { keys: 'Ctrl + Home/End', what: 'First / last cell in grid' },
    { keys: 'Page Up / Down', what: 'Move by viewport-page' },
    { keys: 'Shift + arrows', what: 'Extend cell-range selection' },
    { keys: 'Enter / F2',     what: 'Start editing the active cell' },
    { keys: 'Esc',            what: 'Cancel edit, close menu' },
    { keys: 'Tab',            what: 'Commit edit, move right' },
    { keys: 'Space',          what: 'Toggle row selection' },
    { keys: 'Ctrl + C / V',   what: 'Copy / paste cell range (TSV)' },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3" class:hc-focus={highContrast}>
  <div class="flex flex-wrap items-center gap-3 text-sm shrink-0">
    <label class="flex items-center gap-2">
      <input type="checkbox" bind:checked={highContrast} class="rounded" />
      High-contrast focus outline
    </label>
    <span class="ml-auto text-slate-500 dark:text-slate-400">
      Try the grid with your keyboard - the sidebar shows what a screen reader hears.
    </span>
  </div>

  <div class="grid gap-3 flex-1 min-h-0 lg:grid-cols-[minmax(0,1fr)_280px]">
    <div class="min-h-0 min-w-0">
      <SvGrid
        data={rows}
        columns={columns}
        features={features}
        filterMode="menu"
        selectionMode="both"
        showRowSelection={true}
        showRowNumbers={true}
        showPagination={true}
        pageSize={20}
        enableInlineEditing={true}
        enableCellSelection={true}
        enableRowSummaries={false}
        rowHeight={36}
        containerHeight="100%"
        fitColumns={true}
        onRowSelectionChange={(sel, selRows) => {
          selectedCount = selRows.length
          announce(`${selRows.length} row${selRows.length === 1 ? '' : 's'} selected`)
        }}
        onSortingChange={(s) => {
          if (!s.length) {
            sortLabel = 'none'
            announce('Sort cleared')
          } else {
            const c = s[0]!
            const col = columns.find((col) => col.field === c.id)
            const name = (col?.header as string) ?? c.id
            sortLabel = `${name} (${c.desc ? 'descending' : 'ascending'})`
            announce(`Sorted by ${name}, ${c.desc ? 'descending' : 'ascending'}`)
          }
        }}
        onFiltersChange={(f) => {
          filterCount = f.columns.length + (f.global ? 1 : 0)
          if (filterCount === 0) announce('Filters cleared')
          else announce(`${filterCount} filter${filterCount === 1 ? '' : 's'} active`)
        }}
        onApiReady={(next) => (api = next)}
      />
    </div>

    <aside class="rounded border border-slate-200 dark:border-slate-700 p-3 overflow-y-auto text-sm">
      <h3 class="font-semibold mb-2">ARIA state</h3>
      <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 mb-3">
        <dt class="text-slate-500 dark:text-slate-400">Active cell</dt>
        <dd class="tabular-nums">{activeCellInfo}</dd>
        <dt class="text-slate-500 dark:text-slate-400">Selected rows</dt>
        <dd class="tabular-nums">{selectedCount}</dd>
        <dt class="text-slate-500 dark:text-slate-400">Sort</dt>
        <dd>{sortLabel}</dd>
        <dt class="text-slate-500 dark:text-slate-400">Filters</dt>
        <dd class="tabular-nums">{filterCount}</dd>
      </dl>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="mb-3 rounded bg-slate-50 dark:bg-slate-900 px-2 py-1 text-xs italic text-slate-600 dark:text-slate-300 min-h-[1.8em]"
      >
        {announcement || '(announcements will appear here)'}
      </div>

      <h3 class="font-semibold mb-2">Keyboard shortcuts</h3>
      <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {#each SHORTCUTS as s, i (i)}
          <dt class="font-mono text-slate-700 dark:text-slate-200 whitespace-nowrap">{s.keys}</dt>
          <dd class="text-slate-500 dark:text-slate-400">{s.what}</dd>
        {/each}
      </dl>
    </aside>
  </div>
</section>

<style>
  /* Toggleable high-contrast focus ring for users who need a stronger cue
   * than the default browser outline. The 3-px outline + 1-px ring stays
   * inside the cell so it doesn't overlap neighbours. */
  :global(.hc-focus .sv-grid-cell-active),
  :global(.hc-focus .sv-grid-column:focus),
  :global(.hc-focus .sv-grid-cell:focus) {
    outline: 3px solid #fbbf24 !important;
    outline-offset: -2px;
    box-shadow: inset 0 0 0 1px #000 !important;
  }
</style>
