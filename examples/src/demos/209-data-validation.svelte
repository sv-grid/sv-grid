<script lang="ts">
  /**
   * 209. Data validation (dropdowns + rules)
   * -----------------------------------------
   * Excel "Data Validation" on a plain <SvGrid responsive={true}>. Some letter columns are
   * list-constrained via editorType:'list' + editorOptions (double-click for a
   * dropdown); Estimate enforces a numeric rule. The red flag is the grid's own
   * declarative per-column validate() hook - it fires for bad data already in
   * the sheet on load and re-checks live as you edit.
   */
  import {
    SvGrid,
    tableFeatures,
    renderSnippet,
    rowResize,
    type ColumnDef,
  } from '@svgrid/grid'

  function colLetters(n: number): string[] {
    return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i))
  }
  const letters = colLetters(12) // A=Task, B=Status, C=Priority, D=Owner, E=Estimate, F=Sprint, G..L empty
  const MIN_ROWS = 60
  type Row = Record<string, unknown>

  const STATUS = ['Backlog', 'In progress', 'Blocked', 'In review', 'Done']
  const PRIORITY = ['Low', 'Medium', 'High', 'Critical']
  const OWNERS = ['Ava', 'Marco', 'Priya', 'Sam', 'Lena', 'Diego']
  const SPRINTS = ['S-41', 'S-42', 'S-43', 'S-44']
  const HEADERS = ['Task', 'Status', 'Priority', 'Owner', 'Estimate (pts)', 'Sprint']

  type Task = [string, string, string, string, number | string, string]
  const DATA: Task[] = [
    ['Auth: refresh tokens',     'In progress', 'High',     'Ava',   5,  'S-42'],
    ['Billing webhook retries',  'Blocked',     'Critical', 'Marco', 8,  'S-42'],
    ['Grid: freeze panes',       'In review',   'Medium',   'Priya', 13, 'S-43'],
    ['Onboarding empty states',  'Backlog',     'Low',      'Sam',   3,  'S-44'],
    ['CSV import mapping',       'Todo',        'High',     'Lena',  5,  'S-43'], // * bad Status
    ['Dark theme polish',        'Done',        'Low',      'Diego', 2,  'S-41'],
    ['Perf: virtualize 1M rows', 'In progress', 'Urgent',   'Ava',   21, 'S-44'], // * bad Priority
    ['Docs: MCP quickstart',     'Backlog',     'Medium',   'Nadia', 8,  'S-43'], // * bad Owner
    ['A11y audit (WCAG 2.2)',    'In review',   'High',     'Marco', 90, 'S-42'], // * Estimate > 40
    ['Search relevance tuning',  'Backlog',     'Medium',   'Priya', 13, 'S-44'],
  ]

  const empty = (): Row => Object.fromEntries(letters.map((c) => [c, ''])) as Row
  const rows: Row[] = [Object.fromEntries(letters.map((c, i) => [c, HEADERS[i] ?? ''])) as Row]
  DATA.forEach((t) => { const r = empty(); t.forEach((v, ci) => (r[letters[ci]!] = v)); rows.push(r) })
  while (rows.length < MIN_ROWS) rows.push(empty()) // empty grid below the data, Excel-style

  let raw = $state<Row[]>(rows)
  const features = tableFeatures({})

  function commitCell(rowIndex: number, columnId: string, value: unknown) {
    const next = raw.slice()
    next[rowIndex] = { ...next[rowIndex]!, [columnId]: value }
    raw = next
  }

  const inList = (list: string[]) => ({ value, rowIndex }: { value: unknown; rowIndex: number }) =>
    rowIndex === 0 || value === '' || list.includes(String(value)) ? (true as const) : `Must be one of: ${list.join(', ')}`

  type Col = ColumnDef<typeof features, Row>
  const listCol = (letter: string, list: string[]): Partial<Col> => ({ editorType: 'list', editorOptions: list, validate: inList(list) })

  const perCol: Record<string, Partial<Col>> = {
    B: listCol('B', STATUS),
    C: listCol('C', PRIORITY),
    D: listCol('D', OWNERS),
    E: {
      editorType: 'number',
      align: 'right',
      validate: ({ value, rowIndex }: { value: unknown; rowIndex: number }) => {
        if (rowIndex === 0 || value === '') return true as const
        const n = Number(value)
        if (!Number.isFinite(n) || !Number.isInteger(n)) return 'Estimate must be a whole number'
        if (n < 0 || n > 40) return 'Estimate must be between 0 and 40 points'
        return true as const
      },
    },
    F: listCol('F', SPRINTS),
  }

  function pillClass(rowIndex: number, letter: string): string {
    if (rowIndex === 0) return 'sheet-head'
    const v = String(raw[rowIndex]?.[letter] ?? '')
    if (letter === 'B') return 'st-' + v.toLowerCase().replace(/[^a-z]+/g, '-')
    if (letter === 'C') return 'pr-' + v.toLowerCase()
    return ''
  }

  const columns: Col[] = letters.map((letter) => ({
    field: letter,
    header: letter,
    width: letter === 'A' ? 220 : letter === 'E' ? 120 : ['B', 'C', 'D', 'F'].includes(letter) ? 124 : 92,
    editorType: 'text',
    cellClass: (ctx: { row: { index: number } }) => pillClass(ctx.row.index, letter),
    ...perCol[letter],
  }))

  let heights = $state<Record<number, number>>({})
  const rowHeight = (i: number) => heights[i] ?? 26
  const onRowResize = (i: number, h: number) => (heights = { ...heights, [i]: h })
</script>

<section class="sheet-demo">
  <header class="bs-head">
    <h1 class="bs-title">Data validation</h1>
    <p class="bs-sub">
      <strong>Status</strong>, <strong>Priority</strong>, <strong>Owner</strong> and
      <strong>Sprint</strong> are list-constrained - double-click for a dropdown.
      <strong>Estimate</strong> must be a whole number 0-40. Four cells arrived
      <span class="bs-red">invalid</span>; fix one and the flag clears live.
    </p>
  </header>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="sheet" use:rowResize={{ onResize: onRowResize, min: 20, max: 320 }}>
    <SvGrid responsive={true}
      columnResize
      data={raw}
      columns={columns}
      features={features}
      sortable={false}
      filterable={false}
      selectionMode="cell"
      showRowNumbers={true}
      rowNumberWidth={46}
      showColumnFilters={false}
      showRowSelection={false}
      enableInlineEditing={true}
      enableRowHover={false}
      enableCellSelection={true}
      contextMenu={['copy', 'cut', 'paste', 'clear']}
      rowHeight={rowHeight}
      containerHeight="100%"
      fitColumns={false}
      onCellValueChange={(e) => { if (e.columnId !== '__rownum__') commitCell(e.rowIndex, e.columnId, e.newValue) }}
    />
  </div>
</section>

<!-- Shared Excel chrome is `.sheet-demo` in src/index.css; only the
     status/priority pill colors live here. -->
<style>
  /* Status / priority hues chosen to read on both light and dark themes;
     neutral tones use the theme's muted token. */
  .bs-red { color: var(--sg-danger, #ef4444); font-weight: 700; }
  .sheet :global(.sv-grid-cell.st-backlog)     { color: var(--sg-muted, #64748b); font-weight: 600; }
  .sheet :global(.sv-grid-cell.st-in-progress) { color: #3b82f6; font-weight: 600; }
  .sheet :global(.sv-grid-cell.st-blocked)     { color: #ef4444; font-weight: 600; }
  .sheet :global(.sv-grid-cell.st-in-review)   { color: #f59e0b; font-weight: 600; }
  .sheet :global(.sv-grid-cell.st-done)        { color: #22c55e; font-weight: 600; }
  .sheet :global(.sv-grid-cell.pr-critical) { color: #ef4444; font-weight: 600; }
  .sheet :global(.sv-grid-cell.pr-high)     { color: #f97316; font-weight: 600; }
  .sheet :global(.sv-grid-cell.pr-medium)   { color: #eab308; font-weight: 600; }
  .sheet :global(.sv-grid-cell.pr-low)      { color: var(--sg-muted, #64748b); font-weight: 600; }
</style>
