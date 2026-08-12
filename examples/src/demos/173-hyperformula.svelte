<script lang="ts">
  /**
   * 173. HyperFormula - real spreadsheet integration
   * -------------------------------------------------
   * Opens like Excel: row gutter 1..1000, column letters A..Z, every
   * cell editable. The grid holds RAW values (formula text such as
   * `=SUM(B2:B10)`) so the inline editor lets the user edit the
   * formula itself. A custom cell renderer displays the COMPUTED
   * value from a parallel HF-driven snapshot.
   *
   * Features wired up here:
   *
   *   - Formula bar above the grid with cell address + editable
   *     formula text. Syntax-highlighted (functions / cell refs /
   *     numbers / strings).
   *   - Excel-style "marching ants" outline on cells copied with
   *     Ctrl+C, cleared by Escape or by another copy.
   *   - Per-row variable heights with an opt-in `rowResize` action -
   *     drag the bottom edge of any row to grow / shrink it.
   *   - Coloured section backgrounds + merged section headers via
   *     `spreadsheetLayout`.
   *   - Zebra striping disabled.
   *
   * The first ~44 rows showcase formula families:
   *
   *   math, logical, lookup, text, date/time, financial
   */
  import { onDestroy, onMount, tick } from 'svelte'
  import { HyperFormula } from 'hyperformula'
  import {
    SvGrid,
    tableFeatures,
    renderSnippet,
    createHyperFormulaSheet,
    spreadsheetLayout,
    rowResize,
    type ColumnDef,
    type HyperFormulaInstance,
    type HyperFormulaSheet,
    type MergeSpec,
    type SvGridApi,
  } from '@svgrid/grid'

  const COL_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'] as const
  type ColKey = typeof COL_LETTERS[number]
  type Row = { rn: number } & Record<ColKey, string | number>

  const TOTAL_ROWS = 1000

  type SectionKey = 'math' | 'logical' | 'lookup' | 'text' | 'date' | 'finance'
  type Section = {
    key: SectionKey
    label: string
    titleRow: number  // 1-based
    rowSpan: number   // how many rows to colour
    color: string     // accent / border
    bg: string        // soft cell background
  }
  const SECTIONS: Section[] = [
    { key: 'math',    label: 'MATH',      titleRow: 3,  rowSpan: 8,  color: '#3b82f6', bg: 'rgba(59,130,246,0.06)' },
    { key: 'logical', label: 'LOGICAL',   titleRow: 12, rowSpan: 6,  color: '#8b5cf6', bg: 'rgba(139,92,246,0.06)' },
    { key: 'lookup',  label: 'LOOKUP',    titleRow: 19, rowSpan: 10, color: '#10b981', bg: 'rgba(16,185,129,0.06)' },
    { key: 'text',    label: 'TEXT',      titleRow: 30, rowSpan: 4,  color: '#f59e0b', bg: 'rgba(245,158,11,0.07)' },
    { key: 'date',    label: 'DATES',     titleRow: 35, rowSpan: 4,  color: '#ec4899', bg: 'rgba(236,72,153,0.06)' },
    { key: 'finance', label: 'FINANCIAL', titleRow: 40, rowSpan: 5,  color: '#06b6d4', bg: 'rgba(6,182,212,0.07)' },
  ]

  function emptyRow(rn: number): Row {
    const r: Record<string, unknown> = { rn }
    for (const c of COL_LETTERS) r[c] = ''
    return r as Row
  }
  const seedRows: Row[] = Array.from({ length: TOTAL_ROWS }, (_, i) => emptyRow(i + 1))
  function set(rowOneBased: number, colLetter: ColKey, value: string | number) {
    seedRows[rowOneBased - 1]![colLetter] = value
  }

  // Title row
  set(1, 'A', 'HYPERFORMULA  -  formula examples')

  // MATH
  set(3, 'A', 'MATH')
  set(4, 'A', 'Values:');      set(4, 'B', 12); set(4, 'C', 48); set(4, 'D', 7);  set(4, 'E', 25); set(4, 'F', 90); set(4, 'G', 33)
  set(5, 'A', 'SUM B4:G4');    set(5, 'B', '=SUM(B4:G4)')
  set(6, 'A', 'AVERAGE');      set(6, 'B', '=AVERAGE(B4:G4)')
  set(7, 'A', 'MIN / MAX');    set(7, 'B', '=MIN(B4:G4)'); set(7, 'C', '=MAX(B4:G4)')
  set(8, 'A', 'ROUND(PI,3)');  set(8, 'B', '=ROUND(PI(),3)')
  set(9, 'A', 'SUMIF >20');    set(9, 'B', '=SUMIF(B4:G4,">20")')
  set(10,'A', 'COUNTIF >20');  set(10,'B', '=COUNTIF(B4:G4,">20")')

  // LOGICAL
  set(12,'A', 'LOGICAL')
  set(13,'A', 'Hours');        set(13,'B', 'Status')
  set(14,'A', 42);             set(14,'B', '=IF(A14>40,"Overtime",IF(A14>=30,"Full","Part-time"))')
  set(15,'A', 36);             set(15,'B', '=IF(A15>40,"Overtime",IF(A15>=30,"Full","Part-time"))')
  set(16,'A', 22);             set(16,'B', '=IF(A16>40,"Overtime",IF(A16>=30,"Full","Part-time"))')
  set(17,'A', 'AND/OR');       set(17,'B', '=AND(A14>0,A15>0)'); set(17,'C', '=OR(A16>40,A14>40)')

  // LOOKUP
  set(19,'A', 'LOOKUP')
  set(20,'A', 'SKU');  set(20,'B','Name');         set(20,'C','Category'); set(20,'D','Price'); set(20,'E','Stock')
  set(21,'A','W-100'); set(21,'B','Widget Pro');   set(21,'C','Hardware');  set(21,'D', 49.95);  set(21,'E', 320)
  set(22,'A','S-205'); set(22,'B','Sprocket Plus');set(22,'C','Hardware');  set(22,'D', 18.50);  set(22,'E', 760)
  set(23,'A','L-330'); set(23,'B','Lumen Light');  set(23,'C','Accessory'); set(23,'D', 24.00);  set(23,'E', 120)
  set(24,'A','B-410'); set(24,'B','Bracket Set');  set(24,'C','Hardware');  set(24,'D', 12.75);  set(24,'E', 540)
  set(25,'A','C-500'); set(25,'B','Cable Kit');    set(25,'C','Accessory'); set(25,'D',  9.40);  set(25,'E', 220)
  set(26,'A','Look up:'); set(26,'B','L-330'); set(26,'C','=VLOOKUP(B26,A21:E25,2,FALSE)'); set(26,'D','=VLOOKUP(B26,A21:E25,4,FALSE)')
  set(27,'A','By name:'); set(27,'B','Bracket Set'); set(27,'C','=INDEX(D21:D25,MATCH(B27,B21:B25,0))')
  set(28,'A','#Hardware:'); set(28,'B','=COUNTIF(C21:C25,"Hardware")')

  // TEXT
  set(30,'A', 'TEXT')
  set(31,'A','First'); set(31,'B','Last');   set(31,'C','Full name'); set(31,'D','Initials'); set(31,'E','Length')
  set(32,'A','jane');  set(32,'B','doe');    set(32,'C','=CONCATENATE(UPPER(LEFT(A32,1)),MID(A32,2,LEN(A32))," ",UPPER(LEFT(B32,1)),MID(B32,2,LEN(B32)))'); set(32,'D','=UPPER(LEFT(A32,1))&UPPER(LEFT(B32,1))'); set(32,'E','=LEN(C32)')
  set(33,'A','MIKE');  set(33,'B','OWENS');  set(33,'C','=CONCATENATE(UPPER(LEFT(A33,1)),MID(A33,2,LEN(A33))," ",UPPER(LEFT(B33,1)),MID(B33,2,LEN(B33)))'); set(33,'D','=UPPER(LEFT(A33,1))&UPPER(LEFT(B33,1))'); set(33,'E','=LEN(C33)')

  // DATES
  set(35,'A', 'DATES')
  set(36,'A','Issued'); set(36,'B','Net'); set(36,'C','Due');                                  set(36,'D','Today');       set(36,'E','Status')
  set(37,'A','2026-06-01'); set(37,'B', 30); set(37,'C','=DATEVALUE(A37)+B37');                set(37,'D','=TODAY()');   set(37,'E','=IF(TODAY()>C37,"OVERDUE","On time")')
  set(38,'A','2026-07-10'); set(38,'B', 45); set(38,'C','=DATEVALUE(A38)+B38');                set(38,'D','=TODAY()');   set(38,'E','=IF(TODAY()>C38,"OVERDUE","On time")')

  // FINANCIAL
  set(40,'A', 'FINANCIAL')
  set(41,'A','Principal'); set(41,'B','APR'); set(41,'C','Years'); set(41,'D','Monthly'); set(41,'E','Total'); set(41,'F','Interest')
  set(42,'A', 350_000);    set(42,'B', 0.0625); set(42,'C', 30);   set(42,'D','=ROUND(-PMT(B42/12,C42*12,A42),2)'); set(42,'E','=ROUND(D42*C42*12,2)'); set(42,'F','=ROUND(E42-A42,2)')
  set(43,'A', 420_000);    set(43,'B', 0.0575); set(43,'C', 25);   set(43,'D','=ROUND(-PMT(B43/12,C43*12,A43),2)'); set(43,'E','=ROUND(D43*C43*12,2)'); set(43,'F','=ROUND(E43-A43,2)')
  set(44,'A','Cashflows'); set(44,'B', -100_000); set(44,'C', 32_000); set(44,'D', 41_500); set(44,'E', 58_900); set(44,'F','=ROUND(IRR(B44:E44),4)')

  // -------- Build HF + adapter --------------------------------------
  const hf = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' })
  hf.addSheet('Sheet1')
  const sheet: HyperFormulaSheet<Row> = createHyperFormulaSheet({
    hyperformula: hf as unknown as HyperFormulaInstance,
    rows: seedRows.map((r) => ({ ...r })),
    fields: COL_LETTERS as unknown as ReadonlyArray<keyof Row & string>,
  })
  let raw      = $state<Row[]>(sheet.raw)
  let computed = $state<Row[]>(sheet.computed)

  function commitCell(rowIndex: number, columnId: ColKey, value: unknown) {
    let next: unknown = value
    if (typeof next === 'string') {
      const trimmed = next.trim()
      if (trimmed === '') next = ''
      else if (!trimmed.startsWith('=')) {
        const n = Number(trimmed)
        if (Number.isFinite(n)) next = n
      }
    }
    const snap = sheet.update(rowIndex, columnId, next)
    computed = snap.computed
    raw      = snap.raw
  }
  function onCellValueChange(e: { rowIndex: number; columnId: string; newValue: unknown }) {
    commitCell(e.rowIndex, e.columnId as ColKey, e.newValue)
  }

  onDestroy(() => sheet.destroy())

  const features = tableFeatures({})

  // -------- Row heights (opt-in resize) -----------------------------
  let resizeEnabled = $state(false)
  let heights = $state<Record<number, number>>({})
  const DEFAULT_ROW_HEIGHT = 28
  function getRowHeight(rowIndex: number): number {
    return heights[rowIndex] ?? DEFAULT_ROW_HEIGHT
  }
  function onRowResize(rowIndex: number, height: number) {
    heights = { ...heights, [rowIndex]: height }
  }

  // -------- Active cell tracking ------------------------------------
  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let activeRow = $state(0)
  let activeCol = $state<ColKey>('A')
  let activeRowFormulaBar = $state('')

  function refreshActive() {
    if (!api) return
    const selected = api.getSelected()
    let r = 0, c = 1
    if (selected.length > 0) {
      const [rs, cs] = selected[0]!
      r = rs
      c = cs
    }
    // Column index 0 = rn gutter; columns 1..26 = A..Z
    activeRow = r
    activeCol = (COL_LETTERS[Math.max(0, c - 1)] ?? 'A') as ColKey
    const v = raw[r]?.[activeCol] ?? ''
    activeRowFormulaBar = v === '' ? '' : String(v)
  }

  /** Re-shape the cell-selection range so it covers every merged cell
   *  it intersects. Without this, clicking a merged cell or extending
   *  a selection across one produces a stair-step visual: the row that
   *  hosts the merge is visually 6 columns wide, but the cells above /
   *  below it are only one column wide. Excel solves this by expanding
   *  the rectangular selection to the merge's full bounds. */
  let normalising = false
  function normalizeSelection() {
    if (!api || normalising) return
    const sel = api.getSelected()
    if (sel.length === 0) return
    const [r0, c0, r1, c1] = sel[0]!
    let rMin = Math.min(r0, r1), rMax = Math.max(r0, r1)
    let cMin = Math.min(c0, c1), cMax = Math.max(c0, c1)
    // Merge specs use 0-based row index and column LETTER. Demo's
    // column ids start at 1 for 'A' (because index 0 is the rn gutter).
    function colOf(letter: string): number {
      const idx = (COL_LETTERS as readonly string[]).indexOf(letter)
      return idx < 0 ? -1 : idx + 1
    }
    let changed = true
    let iterations = 0
    while (changed && iterations < 8) {
      changed = false
      iterations += 1
      for (const m of merges) {
        const startCol = colOf(m.columnId)
        if (startCol < 0) continue
        const endCol = startCol + (m.colspan ?? 1) - 1
        const startRow = m.rowIndex
        const endRow = m.rowIndex + (m.rowspan ?? 1) - 1
        const intersects =
          rMin <= endRow && rMax >= startRow &&
          cMin <= endCol && cMax >= startCol
        if (!intersects) continue
        if (startRow < rMin) { rMin = startRow; changed = true }
        if (endRow   > rMax) { rMax = endRow;   changed = true }
        if (startCol < cMin) { cMin = startCol; changed = true }
        if (endCol   > cMax) { cMax = endCol;   changed = true }
      }
    }
    if (rMin !== Math.min(r0, r1) || rMax !== Math.max(r0, r1)
     || cMin !== Math.min(c0, c1) || cMax !== Math.max(c0, c1)) {
      normalising = true
      try { api.selectCells([[rMin, cMin, rMax, cMax]]) }
      finally { normalising = false }
    }
  }

  // -------- Formula bar ---------------------------------------------
  let formulaInputEl: HTMLInputElement | null = null
  let formulaBarEditing = $state(false)
  let formulaBarDraft   = $state('')

  function openFormulaBar() {
    formulaBarDraft = activeRowFormulaBar
    formulaBarEditing = true
    tick().then(() => formulaInputEl?.focus())
  }
  function focusGrid() {
    // Hand focus to the grid's <table> so keyboard shortcuts (arrows,
    // Ctrl+C / Ctrl+V, F2) reach its keydown handler. The grid's
    // onkeydown only fires when target === currentTarget, i.e. focus
    // must be on the table itself - if focus is on <body> (e.g. after
    // the formula bar input unmounts, or just on page load) arrows do
    // nothing.
    const tableEl = gridWrapper?.querySelector<HTMLElement>('table.sv-grid-table')
    tableEl?.focus({ preventScroll: true })
  }
  /** Refocus the grid if the user clicked somewhere in the wrapper
   *  that isn't itself focusable (a cell content, the empty space
   *  between cells, the marching-ants overlay, ...). */
  function maybeRefocusGrid(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    if (!target) return
    if (target.closest('input, button, select, textarea, [tabindex]')) return
    // Hand focus to the table on the next microtask so the grid's
    // own click handlers run first.
    tick().then(focusGrid)
  }
  function commitFormulaBar() {
    if (!formulaBarEditing) return
    commitCell(activeRow, activeCol, formulaBarDraft)
    formulaBarEditing = false
    tick().then(focusGrid)
  }
  function cancelFormulaBar() {
    formulaBarEditing = false
    tick().then(focusGrid)
  }

  // -------- Marching ants on Ctrl+C ---------------------------------
  let antRange = $state<readonly [number, number, number, number] | null>(null)
  function onCopy() {
    if (!api) return
    const sel = api.getSelected()
    if (sel.length === 0) return
    antRange = sel[0]!
  }
  function clearAnts() {
    antRange = null
  }
  onMount(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        // Wait a tick - the grid's own copy handler still runs.
        setTimeout(onCopy, 0)
      } else if (e.key === 'Escape') {
        clearAnts()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  $effect(() => {
    // Re-derive the formula bar value whenever raw/active changes.
    raw; activeRow; activeCol
    if (!formulaBarEditing) {
      activeRowFormulaBar = String(raw[activeRow]?.[activeCol] ?? '')
    }
  })

  // -------- Cell renderer + section coloring -------------------------
  function sectionForRow(r: number): Section | null {
    for (const s of SECTIONS) {
      if (r >= s.titleRow - 1 && r < s.titleRow - 1 + s.rowSpan) return s
    }
    return null
  }
  function cellClassFor(rowIndex: number, _columnId: string): string {
    const s = sectionForRow(rowIndex)
    return s ? `sec-${s.key}` : ''
  }

  function fmtCell(v: unknown): string {
    if (v == null || v === '') return ''
    if (typeof v === 'object' && v !== null && 'value' in (v as any)) return String((v as any).value)
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return ''
      if (Number.isInteger(v) && Math.abs(v) < 100_000) return String(v)
      return v.toLocaleString('en-US', { maximumFractionDigits: 4 })
    }
    if (v instanceof Date) return v.toISOString().slice(0, 10)
    return String(v)
  }
  function isFormula(v: unknown): boolean {
    return typeof v === 'string' && v.startsWith('=')
  }

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'rn', header: '', width: 56, align: 'center', editable: false,
      cellClass: 'sv-row-gutter',
      cell: (ctx) => renderSnippet(RowNumCell, { row: ctx.row.original }) },
    ...COL_LETTERS.map((letter) => ({
      field: letter,
      header: letter,
      width: 110,
      align: 'left' as const,
      editorType: 'text' as const,
      cellClass: (ctx: { row: { original: Row; index: number } }) => cellClassFor(ctx.row.index, letter),
      cell: (ctx: { row: { original: Row; index: number } }) =>
        renderSnippet(SheetCell, {
          rawValue:      ctx.row.original[letter],
          computedValue: computed[ctx.row.index]?.[letter],
        }),
    }) as ColumnDef<typeof features, Row>),
  ]
  const columnOrder = columns.map((c) => c.field as string)

  // -------- Merges: section title rows span A..F --------------------
  const merges = $derived.by<MergeSpec[]>(() => {
    return SECTIONS.map((s) => ({ rowIndex: s.titleRow - 1, columnId: 'A', colspan: 6 }) as MergeSpec)
  })

  // -------- Formula syntax highlight --------------------------------
  function highlightFormula(text: string): string {
    if (!text.startsWith('=')) return escape(text)
    // Tokenise: function names, cell refs, ranges, numbers, strings, operators
    const FN = /([A-Z_][A-Z0-9_]+)(?=\s*\()/g
    const REF = /\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/g
    // Runs AFTER escape(), so match the escaped quote entity, not a literal " (#60).
    const STR = /&quot;.*?&quot;/g
    const NUM = /\b\d+(?:\.\d+)?\b/g
    let out = escape(text)
    out = out.replace(STR, (m) => `<span class="fx-str">${m}</span>`)
    out = out.replace(FN, (m) => `<span class="fx-fn">${m}</span>`)
    out = out.replace(REF, (m) => `<span class="fx-ref">${m}</span>`)
    out = out.replace(NUM, (m) => `<span class="fx-num">${m}</span>`)
    return out.replace(/^=/, '<span class="fx-eq">=</span>')
  }
  function escape(s: string): string {
    return s.replace(/[&<>"']/g, (c) => (
      c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
    ))
  }

  // -------- Marching-ants overlay styling ---------------------------
  function antBox(): { left: number; top: number; width: number; height: number } | null {
    if (!antRange || !gridWrapper) return null
    const [r0, c0, r1, c1] = antRange
    const rMin = Math.min(r0, r1), rMax = Math.max(r0, r1)
    const cMin = Math.min(c0, c1), cMax = Math.max(c0, c1)
    const escId = (s: string) => (window.CSS?.escape?.(s) ?? s.replace(/"/g, '\\"'))
    const startCol = COL_LETTERS[Math.max(0, cMin - 1)]
    const endCol   = COL_LETTERS[Math.max(0, cMax - 1)]
    if (!startCol || !endCol) return null
    const start = gridWrapper.querySelector<HTMLElement>(
      `td[data-svgrid-row="${rMin}"][data-col-id="${escId(startCol)}"]`,
    )
    const end   = gridWrapper.querySelector<HTMLElement>(
      `td[data-svgrid-row="${rMax}"][data-col-id="${escId(endCol)}"]`,
    )
    if (!start || !end) return null
    const wrapBox = gridWrapper.getBoundingClientRect()
    const sBox = start.getBoundingClientRect()
    const eBox = end.getBoundingClientRect()
    return {
      left: sBox.left - wrapBox.left,
      top:  sBox.top  - wrapBox.top,
      width:  Math.max(0, eBox.right  - sBox.left),
      height: Math.max(0, eBox.bottom - sBox.top),
    }
  }
  let gridWrapper: HTMLDivElement | null = null
  let antTick = $state(0)
  $effect(() => {
    if (!antRange) return
    const id = setInterval(() => (antTick += 1), 250)
    return () => clearInterval(id)
  })
  const ants = $derived.by(() => {
    antTick; antRange
    return antBox()
  })
</script>

{#snippet RowNumCell({ row }: { row: Row })}
  <span class="row-num">{row.rn}</span>
{/snippet}

{#snippet SheetCell({ rawValue, computedValue }: { rawValue: unknown; computedValue: unknown })}
  <span
    class="sheet-cell"
    class:is-formula={isFormula(rawValue)}
    title={isFormula(rawValue) ? String(rawValue) : ''}
  >{fmtCell(computedValue)}</span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3 no-zebra">
  <header>
    <h2 class="text-base font-semibold">HyperFormula - real spreadsheet integration</h2>
    <p class="text-xs mt-1" style="color: var(--sg-muted);">
      Excel-style sheet (A..Z, 1000 rows). Sections are colour-coded; section titles use
      <code>spreadsheetLayout</code> merges to span the data columns. The
      <strong>formula bar</strong> above the grid shows the active cell address +
      colour-highlighted formula text - edit there or inline. Copy a range with
      <kbd>Ctrl+C</kbd> to see <strong>marching ants</strong>; press <kbd>Esc</kbd> to clear.
      Toggle <em>Row resize</em> to drag any row's bottom edge.
    </p>
  </header>

  <div class="formula-bar">
    <span class="addr">{activeCol}{activeRow + 1}</span>
    <span class="fx-glyph">f<i>x</i></span>
    {#if formulaBarEditing}
      <input
        bind:this={formulaInputEl}
        bind:value={formulaBarDraft}
        class="formula-input"
        onkeydown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commitFormulaBar() }
          else if (e.key === 'Escape') { e.preventDefault(); cancelFormulaBar() }
        }}
        onblur={commitFormulaBar}
      />
    {:else}
      <button
        type="button"
        class="formula-display"
        onclick={openFormulaBar}
        title="Click to edit"
      >{@html highlightFormula(activeRowFormulaBar)}</button>
    {/if}
    <label class="resize-toggle">
      <input type="checkbox" bind:checked={resizeEnabled} />
      Row resize
    </label>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="hf-wrap"
    class:resizing={resizeEnabled}
    bind:this={gridWrapper}
    onclick={maybeRefocusGrid}
    use:spreadsheetLayout={{ merges, columnOrder }}
    use:rowResize={{ onResize: onRowResize, min: 22, max: 240, disabled: !resizeEnabled }}
  >
    <SvGrid responsive={true}
      data={raw}
      columns={columns}
      features={features}
      sortable={false}
      filterable={false}
      selectionMode="cell"
      showColumnFilters={false}
      showPagination={false}
      showRowSelection={false}
      enableInlineEditing={true}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={getRowHeight}
      containerHeight="100%"
      fitColumns={false}
      virtualization={true}
      columnVirtualization={true}
      onApiReady={(next) => { api = next; refreshActive(); tick().then(focusGrid) }}
      onActiveCellChange={() => refreshActive()}
      onCellSelectionChange={() => normalizeSelection()}
      onCellValueChange={onCellValueChange}
    />
    {#if ants}
      <div
        class="ants"
        style="left: {ants.left}px; top: {ants.top}px; width: {ants.width}px; height: {ants.height}px;"
      ></div>
    {/if}
  </div>
</section>

<style>
  .hf-wrap {
    flex: 1; min-height: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    overflow: hidden;
    background: var(--sg-bg, #ffffff);
    position: relative;
  }
  .hf-wrap.resizing :global(tr.sv-grid-row:hover) {
    background: var(--sg-row-hover-bg, rgba(59, 130, 246, 0.04));
  }

  /* Kill zebra striping AND row hover - spreadsheet UX wants
     header-only hover (row + column header), not full-row hover. */
  :global(.no-zebra .sv-grid-table tbody tr:nth-child(even) .sv-grid-cell),
  :global(.no-zebra .sv-grid-table tbody tr:nth-child(odd)  .sv-grid-cell),
  :global(.no-zebra .sv-grid-table tbody tr:hover .sv-grid-cell) {
    background: transparent !important;
  }
  /* Row header (rn gutter) keeps its base header colour even when the
     row-hover rule sets it transparent. */
  :global(.no-zebra .sv-grid-table tbody tr .sv-grid-cell.sv-row-gutter) {
    background: var(--sg-header-bg, #f1f5f9) !important;
  }
  /* Row header hover: tint the gutter cell on hover. */
  :global(.no-zebra .sv-grid-table tbody tr .sv-grid-cell.sv-row-gutter:hover) {
    background: var(--sg-row-hover-bg, #e2e8f0) !important;
  }
  /* Column header hover. */
  :global(.no-zebra .sv-grid-column:hover) {
    background: var(--sg-row-hover-bg, #e2e8f0) !important;
  }

  /* ---- Row-number gutter --------------------------------------------
     Cell stays interactive so :hover fires + the row-resize strip
     works, but every visual side-effect of selecting it is suppressed. */
  :global(.sv-grid-cell.sv-row-gutter) {
    cursor: default;
    background: var(--sg-header-bg, #f1f5f9) !important;
  }
  :global(.sv-grid-cell.sv-row-gutter.sv-grid-cell-active),
  :global(.sv-grid-cell.sv-row-gutter[data-selected-range="true"]) {
    box-shadow: none !important;
  }
  :global(.sv-grid-cell.sv-row-gutter .sv-grid-fill-handle) { display: none !important; }

  /* The row-header column's THEADER has no functional UI - hide its
     column menu (hamburger), sort + filter triggers. */
  :global([data-svgrid-header-col="rn"] .sv-grid-col-menu-btn),
  :global([data-svgrid-header-col="rn"] .sv-grid-col-filter-btn),
  :global([data-svgrid-header-col="rn"] .sv-grid-header-sort) {
    display: none !important;
  }


  /* ---- Section coloring ---------------------------------------------
     Specificity (0,5,2) beats both zebra (0,3,2) and the gallery's
     row-hover rule (0,4,2) - we don't want row hover in this demo. */
  :global(.no-zebra .sv-grid-table tbody tr .sv-grid-cell.sec-math)    { background: rgba(59, 130, 246, 0.08) !important; }
  :global(.no-zebra .sv-grid-table tbody tr .sv-grid-cell.sec-logical) { background: rgba(139, 92,  246, 0.09) !important; }
  :global(.no-zebra .sv-grid-table tbody tr .sv-grid-cell.sec-lookup)  { background: rgba(16,  185, 129, 0.09) !important; }
  :global(.no-zebra .sv-grid-table tbody tr .sv-grid-cell.sec-text)    { background: rgba(245, 158, 11,  0.10) !important; }
  :global(.no-zebra .sv-grid-table tbody tr .sv-grid-cell.sec-date)    { background: rgba(236, 72,  153, 0.09) !important; }
  :global(.no-zebra .sv-grid-table tbody tr .sv-grid-cell.sec-finance) { background: rgba(6,   182, 212, 0.10) !important; }

  /* Section title rows (the merged labels) get a saturated band. */
  :global(.no-zebra .sv-grid-table tbody tr .sv-grid-cell.sec-math[data-svgrid-row="2"])    { background: rgba(59, 130, 246, 0.22) !important; font-weight: 700; }
  :global(.no-zebra .sv-grid-table tbody tr .sv-grid-cell.sec-logical[data-svgrid-row="11"]){ background: rgba(139, 92,  246, 0.22) !important; font-weight: 700; }
  :global(.no-zebra .sv-grid-table tbody tr .sv-grid-cell.sec-lookup[data-svgrid-row="18"]) { background: rgba(16,  185, 129, 0.22) !important; font-weight: 700; }
  :global(.no-zebra .sv-grid-table tbody tr .sv-grid-cell.sec-text[data-svgrid-row="29"])   { background: rgba(245, 158, 11,  0.25) !important; font-weight: 700; }
  :global(.no-zebra .sv-grid-table tbody tr .sv-grid-cell.sec-date[data-svgrid-row="34"])   { background: rgba(236, 72,  153, 0.22) !important; font-weight: 700; }
  :global(.no-zebra .sv-grid-table tbody tr .sv-grid-cell.sec-finance[data-svgrid-row="39"]){ background: rgba(6,   182, 212, 0.25) !important; font-weight: 700; }

  /* ---- Sheet cell + formula indicator ------------------------------- */
  :global(.row-num) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 11px;
    font-weight: 600;
    color: var(--sg-muted, #64748b);
  }
  :global(.sheet-cell) {
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
    color: var(--sg-fg, inherit);
    position: relative;
    padding-right: 10px;
  }
  :global(.sheet-cell.is-formula) {
    color: var(--sg-fg, inherit);
  }
  :global(.sv-grid-cell:has(.sheet-cell.is-formula))::after {
    content: '';
    position: absolute;
    top: 3px; right: 3px;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--sg-bg, #ffffff) 60%, transparent);
    pointer-events: none;
  }
  :global(.sv-grid-cell:has(.sheet-cell.is-formula) .sv-grid-fill-handle) {
    display: none !important;
  }

  /* ---- Formula bar -------------------------------------------------- */
  .formula-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
    background: var(--sg-header-bg, #f8fafc);
    font-size: 13px;
  }
  .formula-bar .addr {
    min-width: 56px;
    padding: 3px 8px;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 4px;
    background: var(--sg-bg, #ffffff);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    font-weight: 700;
    color: var(--sg-fg, #0f172a);
    text-align: center;
  }
  .formula-bar .fx-glyph {
    color: var(--sg-muted, #64748b);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-style: italic;
  }
  .formula-input, .formula-display {
    flex: 1; min-width: 0;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 4px;
    background: var(--sg-bg, #ffffff);
    padding: 4px 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    color: var(--sg-fg, #0f172a);
    text-align: left;
    cursor: text;
    min-height: 26px;
  }
  .formula-input:focus {
    outline: 2px solid var(--sg-accent, #2563eb);
    outline-offset: -1px;
  }
  .formula-display { cursor: text; line-height: 18px; }
  .formula-display:empty::before {
    content: '(empty)';
    color: var(--sg-muted, #94a3b8);
    font-style: italic;
  }
  :global(.formula-display .fx-eq)  { color: #64748b; font-weight: 700; }
  :global(.formula-display .fx-fn)  { color: #2563eb; font-weight: 600; }
  :global(.formula-display .fx-ref) { color: #c026d3; font-weight: 600; }
  :global(.formula-display .fx-num) { color: #0ea5e9; }
  :global(.formula-display .fx-str) { color: #16a34a; }

  .resize-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--sg-muted, #64748b);
    cursor: pointer;
    user-select: none;
  }
  .resize-toggle input { accent-color: var(--sg-accent, #2563eb); }

  /* ---- Marching ants overlay --------------------------------------- */
  /* SVG dashed border that animates via stroke-dashoffset, so it can't
     be confused with the grid's solid blue selection rectangle. */
  .ants {
    position: absolute;
    pointer-events: none;
    z-index: 22;
    box-sizing: border-box;
    outline: 1.5px dashed #111827;
    outline-offset: -2px;
    animation: ants-march 700ms linear infinite;
  }
  @keyframes ants-march {
    from { outline-color: #111827; }
    50%  { outline-color: #ffffff; }
    to   { outline-color: #111827; }
  }
</style>
