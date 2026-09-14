<script lang="ts">
  /**
   * The spreadsheet shell: everything between the ribbon and the sheet tabs.
   *
   *   SvSheetRibbon      Home / Insert / Formulas / Data
   *   SvFormulaBar       Name Box + fx, showing the RAW text of the active cell
   *   SvGrid             A..Z column headers over the built-in 1..N gutter
   *   SvSheetTabs        sheet tabs
   *   status bar         Sum / Average / Count of the selection, as Excel has
   *
   * Composition, not a second grid. Every part here already existed and was
   * being re-assembled by hand in four separate demos; the value of the
   * component is that the wiring BETWEEN them is done once and correctly -
   * the formula bar shows the raw text rather than the computed value, the
   * format store is keyed by row id so sorting cannot strand formatting, the
   * ribbon and the keyboard run the same actions, and the tab strip is told
   * when a shortcut moved the active sheet.
   *
   *   <SvSheet workbook={wb} />
   *
   * That is the whole required API. Everything else is opt-out.
   */
  import {
    SvGrid,
    tableFeatures,
    renderSnippet,
    type GridColumns,
    type SvGridApi,
    type TableFeatures,
  } from '@svgrid/grid'
  import type { GridCommandContext } from '@svgrid/grid/shortcuts'
  import SvSheetRibbon from './SvSheetRibbon.svelte'
  import SvFormulaBar from './SvFormulaBar.svelte'
  import SvSheetTabs from './SvSheetTabs.svelte'
  import { enableSheet } from './sheet-enable'
  import {
    createWorkbook, type Workbook, type SheetData,
  } from './sheet/workbook'
  import { setWorkbook, setFormatTarget, setFindReplaceHandler } from './sheet/shortcuts'
  import { setStructureTarget } from './sheet/structure'
  import { setFindTarget } from './sheet/find-replace'
  import { setFillTranslator } from './sheet/commands'
  import { translateFormula } from './sheet/refs'
  import {
    createFormatStore, entryToStyle,
    type SheetFormatStore, type CellFormatEntry,
  } from './sheet/format-store'
  import { compileNumberFormat } from './sheet/number-format'
  import { colToLetters, parseA1 } from './sheet/address'
  import { isError, type CellValue } from './sheet/ast'
  import type { RibbonActionId } from './sheet/ribbon'

  type Props = {
    /** The workbook to edit. One is created from `data` when absent. */
    workbook?: Workbook
    /** Seed sheets, when not supplying a workbook. */
    data?: ReadonlyArray<SheetData>
    /** Minimum grid size, so a sparse sheet still looks like a sheet. */
    rows?: number
    columns?: number
    height?: number
    /** Default column width. */
    columnWidth?: number
    /**
     * Per-column overrides, keyed by column letter: `{ A: 150 }`.
     *
     * A sheet's first column usually holds labels and the rest hold numbers,
     * so one width for all of them truncates the only column that needs the
     * room. Columns stay drag-resizable either way.
     */
    columnWidths?: Readonly<Record<string, number>>
    /**
     * Cell formats to start with, keyed by A1 address: `{ B2: { bold: true },
     * 'E13': { numFmt: '0.0%' } }`.
     *
     * Without this the sheet can only be formatted by hand after it loads,
     * which makes it impossible to ship a document that opens looking the way
     * it was saved. Applied once at mount; after that the store owns it.
     */
    formats?: Readonly<Record<string, CellFormatEntry>>
    /** Hide any part of the chrome. */
    showRibbon?: boolean
    showFormulaBar?: boolean
    showTabs?: boolean
    showStatusBar?: boolean
    /** Actions the ribbon raises that this component does not handle itself. */
    onAction?: (action: RibbonActionId, cmd: GridCommandContext) => void
    onReady?: (api: SheetApi) => void
  }

  /** Row ids are positional, so the api is typed against that row shape. */
  type SheetRow = { id: string; index: number }
  type SheetApi = SvGridApi<TableFeatures, SheetRow>

  let {
    workbook,
    data,
    rows: minRows = 50,
    columns: minCols = 12,
    height = 420,
    columnWidth = 104,
    columnWidths,
    formats,
    showRibbon = true,
    showFormulaBar = true,
    showTabs = true,
    showStatusBar = true,
    onAction,
    onReady,
  }: Props = $props()

  enableSheet()

  // Read once, on purpose: the workbook IS the document. Rebuilding it when
  // the prop identity changed would throw away every edit, so a consumer that
  // wants a different document mounts a different <SvSheet>.
  // svelte-ignore state_referenced_locally
  const wb: Workbook =
    workbook ?? createWorkbook(data ? [...data] : [{ name: 'Sheet1', cells: [] }])

  /**
   * One counter drives every read of the workbook and the format store.
   *
   * Neither is `$state` - they are plain objects shared with the keyboard
   * layer, which has no Svelte in it - so nothing else would tell Svelte that
   * a cell changed. Everything reactive below reads `version` first.
   */
  let version = $state(0)
  const bump = () => { version += 1 }

  let active = $state({ rowIndex: 0, colIndex: 0 })
  let selection = $state<ReadonlyArray<readonly [number, number, number, number]>>([])
  let api = $state<SheetApi | null>(null)
  /** Excel's Ctrl+` - show the formulas instead of their results. */
  let showFormulas = $state(false)
  let filterOn = $state(false)

  const store: SheetFormatStore = createFormatStore()

  // Seeded once. `parseA1` is the same address parser the formula engine
  // uses, so 'E13' here and =E13 in a cell cannot disagree about what E13 is.
  // svelte-ignore state_referenced_locally
  for (const [address, entry] of Object.entries(formats ?? {})) {
    const ref = parseA1(address)
    if (!ref || ref.row === null) continue
    store.set([[ref.row, ref.col, ref.row, ref.col]], entry, {
      rowIdAt: (i: number) => `r${i}`,
      columnIdAt: (i: number) => colToLetters(i),
    })
  }

  const rowCount = $derived.by(() => {
    void version
    return Math.max(minRows, wb.rowCount(wb.active) + 1)
  })
  const colCount = $derived.by(() => {
    void version
    return Math.max(minCols, wb.colCount(wb.active) + 1)
  })

  /*
   * Row ids are positional (`r0`, `r1`) because a sheet cell IS its position:
   * A1 means "first row, first column" and nothing else. That is the one
   * place this differs from a data grid, where the row id follows the record.
   */
  const gridRows = $derived.by<SheetRow[]>(() => {
    void version
    return Array.from({ length: rowCount }, (_, index) => ({ id: `r${index}`, index }))
  })

  const lookup = {
    rowIdAt: (i: number) => (i >= 0 && i < rowCount ? `r${i}` : null),
    columnIdAt: (i: number) => (i >= 0 && i < colCount ? colToLetters(i) : null),
  }

  // --- the seams the keyboard layer and the ribbon both act through --------
  $effect(() => {
    setWorkbook(wb, () => {
      // A sheet switch moves the whole viewport, so the active cell goes home
      // rather than pointing at a cell that may not exist on the new sheet.
      active = { rowIndex: 0, colIndex: 0 }
      bump()
    })
    setFormatTarget({ store, lookup, onChange: bump })
    setStructureTarget({
      getRaw: (r, c) => wb.getRaw(wb.active, r, c),
      setRaw: (r, c, text) => wb.setRaw(wb.active, r, c, text),
      // The workbook rewrites references across EVERY sheet, not just this
      // one, which is the whole reason the edit goes through it rather than
      // through the local formula rewriter.
      apply: (edit) => {
        // Drop the format entries of rows and columns that are about to stop
        // existing, or the store leaks one per deleted line for the session.
        if (edit.kind === 'deleteRows') {
          for (let i = 0; i < edit.count; i += 1) store.forgetRow(`r${edit.at + i}`)
        } else if (edit.kind === 'deleteCols') {
          for (let i = 0; i < edit.count; i += 1) store.forgetColumn(colToLetters(edit.at + i))
        }
        wb.applyStructuralEdit(wb.active, edit)
      },
      names: wb.names,
      format: { store, lookup },
      onChange: bump,
    })
    setFindTarget({
      getRaw: (r, c) => wb.getRaw(wb.active, r, c),
      getDisplay: (r, c) => display(r, c).text,
      setRaw: (r, c, text) => wb.setRaw(wb.active, r, c, text),
      onChange: bump,
    })
    // Fill translates references the way dragging the handle does in Excel:
    // =B2 filled one row down becomes =B3. Only formulas move; a literal is
    // copied through untouched.
    setFillTranslator((value, delta) =>
      typeof value === 'string' && value.startsWith('=')
        ? translateFormula(value, delta.rows, delta.cols)
        : value,
    )
    setFindReplaceHandler((context) => onAction?.('find-replace', context))
    return () => {
      setWorkbook(null)
      setFormatTarget(null)
      setStructureTarget(null)
      setFindTarget(null)
      setFillTranslator(null)
      setFindReplaceHandler(null)
    }
  })

  // --- reading a cell -------------------------------------------------------
  function raw(r: number, c: number): string {
    void version
    return wb.getRaw(wb.active, r, c)
  }

  function display(r: number, c: number): { text: string; color?: string } {
    void version
    const text = raw(r, c)
    if (showFormulas) return { text }
    const value: CellValue = wb.getValue(wb.active, r, c)
    if (isError(value)) return { text: value.error, color: 'var(--sg-danger, #dc2626)' }
    const entry = store.get(`r${r}`, colToLetters(c))
    if (entry?.numFmt) return compileNumberFormat(entry.numFmt).format(value)
    if (value === '' || value == null) return { text: '' }
    return { text: String(value) }
  }

  const activeRaw = $derived.by(() => {
    void version
    return raw(active.rowIndex, active.colIndex)
  })

  function commit(text: string) {
    wb.setRaw(wb.active, active.rowIndex, active.colIndex, text)
    bump()
  }

  // --- the status bar -------------------------------------------------------
  /**
   * Excel's selection aggregates. Only numbers count toward Sum and Average,
   * while Count counts every non-empty cell including text, which is exactly
   * how Excel's own status bar splits them.
   */
  const aggregate = $derived.by(() => {
    void version
    const rects = selection.length
      ? selection
      : [[active.rowIndex, active.colIndex, active.rowIndex, active.colIndex] as const]
    let count = 0
    let numeric = 0
    let sum = 0
    for (const [minRow, minCol, maxRow, maxCol] of rects) {
      for (let r = minRow; r <= maxRow; r += 1) {
        for (let c = minCol; c <= maxCol; c += 1) {
          const value = wb.getValue(wb.active, r, c)
          if (value === '' || value == null || isError(value)) continue
          count += 1
          if (typeof value === 'number') { numeric += 1; sum += value }
        }
      }
    }
    return { count, numeric, sum, average: numeric ? sum / numeric : null }
  })

  const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

  // --- the grid -------------------------------------------------------------
  const features = tableFeatures({})

  const columns = $derived.by<GridColumns<SheetRow>>(() =>
    Array.from({ length: colCount }, (_, c) => ({
      id: colToLetters(c),
      header: colToLetters(c),
      width: columnWidths?.[colToLetters(c)] ?? columnWidth,
      headerAlign: 'center' as const,
      editable: false,
      cell: (ctx: { row: { original: SheetRow } }) =>
        renderSnippet(Cell, { r: ctx.row.original.index, c }),
    })),
  )

  function cmdOf(): GridCommandContext | null {
    return api ? api.getCommandContext() : null
  }

  /** Ribbon actions this shell can answer without a dialog. */
  function handleAction(action: RibbonActionId, context: GridCommandContext) {
    switch (action) {
      case 'recalculate':
        wb.recalculate()
        bump()
        return
      case 'toggle-formulas':
        showFormulas = !showFormulas
        bump()
        return
      case 'toggle-filter':
        filterOn = !filterOn
        return
      default:
        // Everything else needs chrome this component does not own.
        onAction?.(action, context)
    }
  }

  const activeActions = $derived.by<ReadonlyArray<RibbonActionId>>(() => {
    const on: RibbonActionId[] = []
    if (showFormulas) on.push('toggle-formulas')
    if (filterOn) on.push('toggle-filter')
    return on
  })

  function onCellClick(r: number, c: number) {
    active = { rowIndex: r, colIndex: c }
  }
</script>

{#snippet Cell(props: { r: number; c: number })}
  {@const shown = display(props.r, props.c)}
  {@const entry = store.get(`r${props.r}`, colToLetters(props.c))}
  {@const isActive = active.rowIndex === props.r && active.colIndex === props.c}
  <button
    type="button"
    class="sheet-cell"
    class:active={isActive}
    class:formula={showFormulas && shown.text.startsWith('=')}
    style={`${entryToStyle(entry)}${shown.color ? `;color:${shown.color}` : ''}`}
    title={raw(props.r, props.c)}
    onclick={() => onCellClick(props.r, props.c)}
    ondblclick={() => onCellClick(props.r, props.c)}
  >{shown.text}</button>
{/snippet}

<div class="sv-sheet">
  {#if showRibbon}
    <SvSheetRibbon
      cmd={cmdOf}
      onChange={bump}
      onAction={handleAction}
      {activeActions}
    />
  {/if}

  {#if showFormulaBar}
    <SvFormulaBar
      active={active}
      value={activeRaw}
      onCommit={commit}
      onNavigate={(cell) => (active = cell)}
      names={wb.names.list()}
    />
  {/if}

  <SvGrid
    data={gridRows}
    {columns}
    {features}
    selectionMode="cell"
    enableCellSelection={true}
    showRowNumbers={true}
    rowNumberWidth={46}
    columnResize={true}
    filterMode={filterOn ? 'row' : 'none'}
    containerHeight={height}
    onApiReady={(next: SheetApi) => { api = next; onReady?.(next) }}
    onCellSelectionChange={(ranges: Array<[number, number, number, number]>) => {
      selection = ranges
      bump()
    }}
  />

  {#if showTabs}
    <SvSheetTabs workbook={wb} {version} onChange={bump} />
  {/if}

  {#if showStatusBar}
    <div class="status" role="status" aria-live="off">
      <span class="cell-ref">{colToLetters(active.colIndex)}{active.rowIndex + 1}</span>
      {#if aggregate.count > 0}
        <span>Count <b>{aggregate.count}</b></span>
        {#if aggregate.numeric > 0}
          <span>Sum <b>{round(aggregate.sum)}</b></span>
          <span>Average <b>{round(aggregate.average ?? 0)}</b></span>
        {/if}
      {:else}
        <span class="quiet">Ready</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .sv-sheet {
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: var(--sg-fg, #0f172a);
  }

  /*
   * A sheet cell fills its td edge to edge, so a fill colour reaches the
   * gridlines the way it does in Excel rather than leaving a halo of cell
   * background around it.
   */
  .sheet-cell {
    display: block;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0 4px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: inherit;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: cell;
  }
  .sheet-cell.active {
    box-shadow: inset 0 0 0 2px var(--sg-accent, #2563eb);
  }
  .sheet-cell.formula {
    font-family: ui-monospace, Menlo, monospace;
    color: var(--sg-accent, #2563eb);
  }

  .status {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 4px 10px;
    font-size: 12px;
    /* Explicit: a host page that uppercases small text turns "Count" into
       "COUNT", which reads as shouting rather than as a status bar. */
    text-transform: none;
    letter-spacing: normal;
    color: var(--sg-muted, #64748b);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: var(--sg-radius, 6px);
    background: var(--sg-header-bg, #f8fafc);
  }
  .status b {
    font-weight: 600;
    color: var(--sg-fg, #0f172a);
    font-variant-numeric: tabular-nums;
  }
  .cell-ref {
    font-family: ui-monospace, Menlo, monospace;
    color: var(--sg-fg, #0f172a);
  }
  .quiet { opacity: 0.8; }
</style>
