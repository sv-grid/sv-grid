<script lang="ts">
  /**
   * 701. Review queue: overdue, labels and a row count
   * ---------------------------------------------------
   * Four @svgrid/enterprise additions to the grid's filtering and sorting,
   * each switched on once and then used through ordinary column options:
   *
   *   enableRelativeDateFilters()   Due's filter menu gains Today, Before
   *                                 today, After today, Next 7 days and Last
   *                                 7 days. No value to type: pick one and it
   *                                 filters. A server data source receives
   *                                 the dates they mean, not the operator.
   *   enableFilterLabels()          Status is stored as APPROVED /
   *                                 MARKED_AS_FAILED; its filter checklist
   *                                 lists "Approved" and "Failed", as the
   *                                 cells show them.
   *   enableRowCount()              statusBar={{ rows: true }} shows "24
   *                                 rows", or "6 of 24 rows" under a filter.
   *   sortComparator: blanksLast()  Reviews with no due date stay at the
   *                                 bottom whichever way Due sorts.
   *
   * The accessor of every column stays the raw value, so Reviews sorts
   * 0, 1, 2, 10 and Due sorts by date, while the cells and the checklist read
   * as words.
   */
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'
  import {
    blanksLast,
    enableFilterLabels,
    enableRelativeDateFilters,
    enableRowCount,
  } from '@svgrid/enterprise'

  enableRelativeDateFilters()
  enableFilterLabels()
  enableRowCount()

  type Status = 'APPROVED' | 'MARKED_AS_FAILED' | 'UNDECIDED'
  type Review = {
    id: number
    name: string
    version: string
    status: Status
    reviews: number
    reviewer: string
    due: string | null
  }

  const STATUS_TEXT: Record<Status, string> = {
    APPROVED: 'Approved',
    MARKED_AS_FAILED: 'Failed',
    UNDECIDED: 'Undecided',
  }
  const STATUSES: Status[] = ['UNDECIDED', 'APPROVED', 'UNDECIDED', 'MARKED_AS_FAILED']
  const NAMES = [
    'kernel-image', 'web-gateway', 'postgres-operator', 'metrics-agent', 'auth-service',
    'snap-store-proxy', 'log-shipper', 'dns-resolver', 'object-store', 'build-runner',
    'queue-broker', 'edge-cache',
  ]
  const REVIEWERS = ['A. Osei', 'R. Vance', 'M. Iqbal', 'J. Lindqvist', '']

  // Due dates are relative to today so Overdue and Next 7 days always have
  // something to show. Every fifth review has no due date.
  const OFFSETS = [-9, -2, 0, 3, 6, 12, -1, 5, 21, 1, -15, 8]
  const isoFromToday = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const reviews: Review[] = Array.from({ length: 24 }, (_, i) => ({
    id: i + 1,
    name: NAMES[i % NAMES.length],
    version: `${1 + (i % 3)}.${(i * 7) % 12}.${i % 5}`,
    status: STATUSES[(i * 5) % STATUSES.length],
    // 0 through 12, so a text sort would put 10 before 2.
    reviews: (i * 7) % 13,
    reviewer: REVIEWERS[i % REVIEWERS.length],
    due: i % 5 === 4 ? null : isoFromToday(OFFSETS[i % OFFSETS.length]),
  }))

  const columns: GridColumns<Review> = [
    { field: 'name', header: 'Artifact', width: 190 },
    { field: 'version', header: 'Version', width: 100 },
    {
      field: 'status',
      header: 'Status',
      width: 130,
      cell: ({ getValue }) => STATUS_TEXT[getValue() as Status] ?? '',
    },
    { field: 'reviews', header: 'Reviews', width: 100, cellDataType: 'number' },
    { field: 'reviewer', header: 'Reviewer', width: 140 },
    {
      field: 'due',
      header: 'Due',
      width: 150,
      cellDataType: 'dateString',
      format: { type: 'date', options: { dateStyle: 'medium' } },
      sortComparator: blanksLast('date'),
    },
  ]

  let api = $state<SvGridApi<{}, Review> | null>(null)
  let preset = $state<'all' | 'beforeToday' | 'today' | 'next7Days'>('all')

  const PRESETS = [
    { id: 'all', label: 'All' },
    { id: 'beforeToday', label: 'Overdue' },
    { id: 'today', label: 'Due today' },
    { id: 'next7Days', label: 'Next 7 days' },
  ] as const

  // The same operators the Due column's filter menu offers.
  function pick(id: (typeof PRESETS)[number]['id']) {
    preset = id
    api?.setFilter('due', id === 'all' ? null : { operator: id })
  }
</script>

<section class="wrap">
  <header class="chrome">
    <p class="hint">
      Open the filter on <strong>Due</strong> for the days-from-today operators, or on
      <strong>Status</strong> for a checklist that reads as the cells do. Sort Due either way:
      reviews with no date stay last.
    </p>
    <div class="seg" role="group" aria-label="Due date">
      {#each PRESETS as p (p.id)}
        <button class:on={preset === p.id} aria-pressed={preset === p.id} onclick={() => pick(p.id)}>
          {p.label}
        </button>
      {/each}
    </div>
  </header>

  <div class="grid-host">
    <SvGrid
      responsive={true}
      data={reviews}
      {columns}
      getRowId={(r) => String(r.id)}
      sortable
      filterable
      filterMode="menu"
      initialSorting={[{ id: 'due', desc: false }]}
      statusBar={{ rows: true, aggregates: [] }}
      rowHeight={36}
      containerHeight="100%"
      fitColumns
      onApiReady={(next) => (api = next)}
      onFiltersChange={(f) => {
        // Due set from its menu to something the buttons do not name: no button is on.
        const op = f.columns.find((c) => c.id === 'due')?.operator
        if (!PRESETS.some((p) => p.id === op)) preset = 'all'
      }}
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

  .seg {
    display: inline-flex;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 8px;
    overflow: hidden;
  }
  .seg button {
    border: 0;
    padding: 6px 12px;
    font: inherit;
    font-size: 13px;
    background: var(--sg-bg, #fff);
    color: var(--sg-muted, #64748b);
    cursor: pointer;
  }
  .seg button + button { border-left: 1px solid var(--sg-border, #cbd5e1); }
  .seg button.on { background: var(--sg-accent, #6366f1); color: var(--sg-on-accent, #fff); }
  .seg button:focus-visible { outline: 2px solid var(--sg-focus-ring, #6366f1); outline-offset: -2px; }

  .grid-host {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
</style>
