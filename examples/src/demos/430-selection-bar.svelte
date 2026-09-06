<script lang="ts">
  /**
   * 430. Bulk-action bar over the selection
   * ---------------------------------------
   * Tick some rows and a bar floats over the grid with the count, the actions
   * that apply to the whole selection, and a way to clear it.
   *
   *   selectionBar={true}       count + Clear, nothing else
   *   selectionBar={[...]}      built-in keys and/or your own buttons
   *   selectionBar={{ ... }}    also position / maxVisible / hideClear
   *
   * Built-in keys need no wiring: 'selectAll' selects the view, 'editFields'
   * opens the bulk-edit DRAWER, and 'separator' draws a divider.
   *
   * The drawer is the same SvDrawer + SvForm used for single-row editing, and
   * it edits ONE OR MORE fields across ONE OR MORE rows at once. Only fields
   * you actually change are written: a field the selection already agrees on
   * opens showing that value, one they disagree on opens blank and labelled
   * "Multiple values", and leaving either alone keeps every row's own value.
   *
   * The bar reserves its own strip: the grid shrinks by the bar height while
   * a selection is live, so it never covers the rows you are acting on.
   *
   * Your own actions get `{ rows, ids }` for the selection in DISPLAY order,
   * and `hidden` / `disabled` are re-checked every render - which is what lets
   * Merge appear only at 2+ rows and Mark done grey out once everything picked
   * is already closed.
   *
   * Compare with demo 23, which hand-rolls the same idea from
   * `onRowSelectionChange` and a toolbar of your own. This is that pattern
   * built in.
   *
   * The PROP is free; the bar is Pro. Without @svgrid/enterprise the grid shows
   * an upsell note in its place.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    rowSelectionFeature,
    columnFilteringFeature,
    type GridColumns,
    type SelectionBarAction,
    type SvGridApi,
  } from '@svgrid/grid'
  import { installEnterprise, setLicenseKey } from '@svgrid/enterprise'

  // The bar is a Pro renderer. installEnterprise() registers it (along with the
  // rest of the Pro surface) the moment the grid hands us its api.
  setLicenseKey('SVENTERPRISE-DEV-DEMO')

  type Task = {
    id: number
    key: string
    title: string
    assignee: string
    status: Status
    priority: Priority
    labels: string[]
    points: number
    due: string
  }

  type Status = 'Open' | 'In progress' | 'In review' | 'Done'
  type Priority = 'Low' | 'Medium' | 'High' | 'Urgent'

  const PEOPLE = ['A. Osei', 'R. Vance', 'M. Iqbal', 'J. Lindqvist', 'D. Okonkwo']
  const STATUSES: Status[] = ['Open', 'In progress', 'In review', 'Done']
  const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Urgent']
  const LABELS = ['perf', 'infra', 'billing', 'a11y', 'tech-debt', 'security', 'ui']
  const TITLES = [
    'Virtualize the audit log',
    'Retry webhook delivery',
    'Cache the tenant lookup',
    'Fix timezone drift on export',
    'Batch the settings writes',
    'Debounce the search input',
    'Backfill missing invoice ids',
    'Split the migration runner',
    'Trim the bundle preamble',
    'Harden the CSV importer',
  ]

  /** Deterministic so the demo reads the same on every load and in snapshots. */
  const dayOffset = (i: number, span: number) => ((i * 7) % span) - Math.floor(span / 3)
  const iso = (days: number) => {
    const d = new Date(2026, 8, 15)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  const start = (): Task[] =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i + 1,
      key: `PLAT-${412 + i}`,
      title: TITLES[i % TITLES.length],
      assignee: PEOPLE[i % PEOPLE.length],
      status: STATUSES[i % STATUSES.length],
      priority: PRIORITIES[(i * 3) % PRIORITIES.length],
      // One or two labels, so the chips column has some variety of width.
      labels: i % 3 === 0
        ? [LABELS[i % LABELS.length], LABELS[(i + 3) % LABELS.length]]
        : [LABELS[i % LABELS.length]],
      points: [1, 2, 3, 5, 8][i % 5],
      due: iso(dayOffset(i, 30)),
    }))

  let tasks = $state<Task[]>(start())
  let api = $state<SvGridApi<typeof features, Task> | null>(null)
  let position = $state<'bottom' | 'top'>('bottom')
  let lastAction = $state('')

  const note = (line: string) => (lastAction = line)

  function patch(ids: string[], change: Partial<Task>) {
    const set = new Set(ids)
    tasks = tasks.map((t) => (set.has(String(t.id)) ? { ...t, ...change } : t))
  }

  const features = tableFeatures({ rowSortingFeature, rowSelectionFeature, columnFilteringFeature })

  // Strings are built-ins, objects are this app's own. An issue tracker's bar
  // is mostly the former.
  // Strings are built-ins, objects are this app own.
  //
  // Order matters: the overflow menu takes the TAIL, so the actions that
  // belong on the bar go first. Select all / Edit fields / Delete are the ones
  // a user reaches for on any list; Mark done, Merge and Export are this
  // tracker specific extras, so they sit behind the "..." menu rather than
  // pushing the essentials off the bar.
  const actions: Array<SelectionBarAction<Task> | 'selectAll' | 'editFields' | 'separator'> = [
    'selectAll',
    'editFields',
    'separator',
    {
      key: 'delete',
      label: 'Delete',
      icon: 'M3 6h18M8 6V4h8v2m-1 0v14H9V6',
      danger: true,
      action: ({ ids }) => {
        const set = new Set(ids)
        tasks = tasks.filter((t) => !set.has(String(t.id)))
        api?.selectRows([])
        note(`Deleted ${ids.length} task${ids.length === 1 ? '' : 's'}`)
      },
    },
    {
      key: 'done',
      label: 'Mark done',
      icon: 'M20 6 9 17l-5-5',
      disabled: ({ rows }) => rows.every((t) => t.status === 'Done'),
      action: ({ rows, ids }) => {
        patch(ids, { status: 'Done' })
        note(`Marked ${rows.length} done`)
      },
    },
    {
      key: 'merge',
      label: 'Merge',
      icon: 'M7 3v12a4 4 0 0 0 4 4h6M17 15l3 4-3 4',
      hidden: ({ ids }) => ids.length < 2,
      action: ({ ids }) => note(`Merged ${ids.length} tasks into ${ids[0]}`),
    },
    {
      key: 'export',
      label: 'Export',
      icon: 'M12 3v12m0 0 4-4m-4 4-4-4M4 21h16',
      action: ({ ids }) => note(`Exported ${ids.length} to CSV`),
    },
  ]

  // Widths total ~975px so the set FITS a normal demo pane; `fitColumns` then
  // scales them up to fill it exactly. It only grows - size them past the pane
  // and you get a horizontal scrollbar and a clipped last column instead.
  const columns: GridColumns<Task> = [
    // Read-only: an issue key is not something anyone bulk-edits, and an
    // editable column shows up in the drawer.
    { field: 'key', header: 'Key', width: 80, editable: false },
    { field: 'title', header: 'Summary', width: 220 },
    {
      field: 'status',
      header: 'Status',
      width: 118,
      editorType: 'list',
      editorOptions: STATUSES.map((v) => ({ value: v, label: v })),
      // A value-driven class is all a status pill needs - no cell renderer.
      cellClass: ({ row }) => `cell-status cell-status-${String(row.original.status).toLowerCase().replace(/ /g, '-')}`,
    },
    {
      field: 'priority',
      header: 'Priority',
      width: 100,
      editorType: 'list',
      editorOptions: PRIORITIES.map((v) => ({ value: v, label: v })),
      cellClass: ({ row }) => `cell-prio cell-prio-${String(row.original.priority).toLowerCase()}`,
    },
    {
      field: 'assignee',
      header: 'Assignee',
      width: 125,
      editorType: 'list',
      editorOptions: PEOPLE.map((v) => ({ value: v, label: v })),
    },
    {
      // Chips render as tokens outside editing, and the drawer offers the same
      // picker - so labels are bulk-editable like anything else.
      field: 'labels',
      header: 'Labels',
      width: 165,
      editorType: 'chips',
      editorMultiple: true,
      editorOptions: LABELS.map((v) => ({ value: v, label: v })),
    },
    {
      field: 'due',
      header: 'Due',
      width: 105,
      cellDataType: 'dateString',
      // Overdue and still open is the one thing worth colouring in a backlog.
      cellClass: ({ row }) =>
        row.original.status !== 'Done' && row.original.due < iso(0) ? 'overdue' : '',
    },
    { field: 'points', header: 'Points', width: 90, align: 'right', editorType: 'number' },
  ]
</script>

<section class="wrap">
  <header class="chrome">
    <p class="hint">
      Tick a row, then use the bar. <strong>Edit fields</strong> opens the drawer - change several
      fields at once and they apply to every selected row. This tracker&rsquo;s own extras (Mark done,
      Merge, Export) sit behind the <em>&middot;&middot;&middot;</em> menu.
    </p>
    <div class="controls">
      {#if lastAction}
        <span class="pill">{lastAction}</span>
      {/if}
      <div class="seg" role="group" aria-label="Bar position">
        <button class:on={position === 'bottom'} onclick={() => (position = 'bottom')}>Bottom</button>
        <button class:on={position === 'top'} onclick={() => (position = 'top')}>Top</button>
      </div>
      <button
        class="ghost"
        onclick={() => { tasks = start(); lastAction = ''; api?.selectRows([]) }}
      >Reset</button>
    </div>
  </header>

  <div class="grid-host">
    <SvGrid responsive={true}
      data={tasks}
      columns={columns}
      features={features}
      getRowId={(t) => String(t.id)}
      showRowSelection
      editable
      selectionBar={{ actions, position, maxVisible: 3 }}
      filterMode="row"
      rowHeight={38}
      containerHeight="100%"
      fitColumns
      onApiReady={(next) => (api = installEnterprise(next))}
    />
  </div>
</section>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 12px;
  }

  /* One row of chrome instead of a wall of KPI cards and a side rail - this
     demo is about the bar, so the grid gets the space. */
  .chrome {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    flex: none;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--sg-muted, #64748b);
    max-width: 62ch;
  }
  .hint strong { color: var(--sg-fg, #0f172a); font-weight: 600; }

  .controls { display: flex; align-items: center; gap: 8px; }

  .pill {
    padding: 4px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sg-accent, #6366f1) 12%, transparent 88%);
    color: var(--sg-accent, #6366f1);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  .seg {
    display: inline-flex;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 7px;
    overflow: hidden;
  }
  .seg button {
    border: 0;
    background: var(--sg-bg, #fff);
    color: var(--sg-muted, #64748b);
    padding: 5px 12px;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .seg button.on { background: var(--sg-accent, #6366f1); color: var(--sg-on-accent, #fff); }

  .ghost {
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 7px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    padding: 5px 12px;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .ghost:hover { background: var(--sg-row-hover-bg, rgb(148 163 184 / 12%)); }

  .grid-host { flex: 1; min-height: 0; }

  /*
   * Status / priority / due styling.
   *
   * `cellClass` puts the class on the cell, so these have to be :global - the
   * grid renders the cell, not this component, and Svelte would otherwise
   * scope the selector away.
   *
   * Backgrounds are color-mix over the theme tokens rather than fixed hexes,
   * so a status pill still reads on every one of the 20 preset themes instead
   * of only the one it was designed against.
   */
  .grid-host :global(.cell-status) { font-weight: 600; }
  .grid-host :global(.cell-status-open) { color: var(--sg-muted, #64748b); }
  .grid-host :global(.cell-status-in-progress) { color: var(--sg-accent, #6366f1); }
  .grid-host :global(.cell-status-in-review) { color: #d97706; }
  .grid-host :global(.cell-status-done) { color: #16a34a; }

  .grid-host :global(.cell-prio) { font-weight: 600; }
  .grid-host :global(.cell-prio-low) { color: var(--sg-muted, #64748b); }
  .grid-host :global(.cell-prio-medium) { color: var(--sg-fg, #0f172a); }
  .grid-host :global(.cell-prio-high) { color: #d97706; }
  .grid-host :global(.cell-prio-urgent) { color: var(--sg-danger, #dc2626); }

  /* Overdue AND unfinished. A past due date on a closed item is not a problem,
     so colouring it would be noise. */
  .grid-host :global(.overdue) {
    color: var(--sg-danger, #dc2626);
    font-weight: 600;
  }

  @media (max-width: 720px) {
    .chrome { align-items: flex-start; }
    .controls { width: 100%; justify-content: space-between; }
  }
</style>
