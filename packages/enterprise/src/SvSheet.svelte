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
    SvPopover,
    SvModal,
    tableFeatures,
    renderSnippet,
    buildFillPattern,
    type GridColumns,
    type SvGridApi,
    type TableFeatures,
    type ContextMenuItem,
    type ContextMenuIcon,
  } from '@svgrid/grid'
  import { tick, untrack } from 'svelte'
  import type { GridCommandContext } from '@svgrid/grid/shortcuts'
  import SvSheetRibbon from './SvSheetRibbon.svelte'
  import SvFormulaBar from './SvFormulaBar.svelte'
  import SvSheetTabs from './SvSheetTabs.svelte'
  import SvSheetFindReplace from './SvSheetFindReplace.svelte'
  import SvSheetPasteSpecial from './SvSheetPasteSpecial.svelte'
  import SvSheetFormatCells from './SvSheetFormatCells.svelte'
  import SvSheetInsertFunction from './SvSheetInsertFunction.svelte'
  import SvSheetSizeDialog from './SvSheetSizeDialog.svelte'
  import SvSheetNameManager from './SvSheetNameManager.svelte'
  import SvSheetGoalSeek from './SvSheetGoalSeek.svelte'
  import SvSheetTextToColumns from './SvSheetTextToColumns.svelte'
  import SvSheetRemoveDuplicates from './SvSheetRemoveDuplicates.svelte'
  import SvSheetSort from './SvSheetSort.svelte'
  import { downloadBlobFile } from '@svgrid/grid'
  import { documentToXlsx, documentFromXlsx } from './sheet/xlsx-document'
  import { csvText } from './sheet/csv'
  import { sortOrder, guessHeaderRow, type SortKey } from './sheet/sort'
  import { currentRegion, isBlankValue } from './sheet/navigate'
  import { freezeAtActiveCell, freezeTopRow, freezeFirstColumn, applyFreeze, type FreezeState } from './sheet/freeze'
  import { gridOf } from './sheet/shortcuts'
  import { enableSheet } from './sheet-enable'
  import type { Workbook, SheetData } from './sheet/workbook'
  import { createSheetDocument, type SheetDocument, type SheetState, type SheetChangeReason } from './sheet/document'
  import {
    setWorkbook, setFormatTarget, setFindReplaceHandler, setFormatDialogHandler, setPasteSpecialHandler,
    setRibbonActionHandler,
    getFormatTarget, withFormatUndo, applyFormat, clearFormats,
  } from './sheet/shortcuts'
  import { applyBorders, type BorderPreset } from './sheet/ribbon'
  import { RIBBON_ICONS, type RibbonIconName } from './sheet/ribbon-icons'
  import {
    planPaste, resolvePasteCell, buildClipboardPayload, parseClipboardHtml, readClipboardOrigin, anchorForeignFormulas,
    type ClipboardGrid, type PasteSpecialOptions, type PasteWhat,
  } from './sheet/paste-special'
  import { setStructureTarget, insertRows, insertColumns, deleteRows, deleteColumns, axisForSelection } from './sheet/structure'
  import { setFindTarget } from './sheet/find-replace'
  import { setFillTranslator, setSheetValueProbe } from './sheet/commands'
  import { translateFormula } from './sheet/refs'
  import { entryToStyle, type SheetFormatStore, type CellFormatEntry } from './sheet/format-store'
  import { compileNumberFormat } from './sheet/number-format'
  import { colToLetters, lettersToCol, parseA1 } from './sheet/address'
  import { referenceSpans, type ReferenceSpan } from './sheet/refs'
  import { balanceParens } from './sheet/autocomplete'
  import { parseEntry, completeEntry } from './sheet/entry'
  import { isError, type CellValue } from './sheet/ast'
  import { isLocked, rectsHaveLocked, rectsMixLocked, PROTECTED_MESSAGE } from './sheet/protection'
  import { commentAt, withComment, nextComment, listComments, type NotesMap } from './sheet/comments'
  import SvSheetComment from './SvSheetComment.svelte'
  import SvSheetListPicker from './SvSheetListPicker.svelte'
  import SvSheetDataValidation from './SvSheetDataValidation.svelte'
  import SvSheetValidationAlert from './SvSheetValidationAlert.svelte'
  import SvSheetConditionalFormat from './SvSheetConditionalFormat.svelte'
  import SvSheetManageRules from './SvSheetManageRules.svelte'
  import {
    ruleStats, evaluateCf, removeCf, cfId, COLOR_SCALES, DATA_BAR_COLOR,
    type CfRule, type CfRuleBody, type CfStats, type CfResult, type CfContext, type CfPreset, type CfBody, type CfStyledRule,
  } from './sheet/conditional-formats'
  import type { Rect } from './sheet/rects'
  import {
    mergePlan, unmergePlan, toGridMerges, isCoveredCell, selectionMerged, mergesIn, sortBlockedByMerges, reorderMerges,
    mergeAt as sheetMergeAt, normalRect, expandToMerges, type MergeKind, type MergePlan,
  } from './sheet/merges'
  import {
    distinctValues, hiddenRowsFor, withColumnFilter, isFiltering, type AutoFilterState, type ColumnFilter,
  } from './sheet/auto-filter'
  import SvSheetFilterMenu from './SvSheetFilterMenu.svelte'
  import {
    ruleAt, checkEntry, listChoices, removeValidation, validationId, invalidCells,
    type ValidationRule, type ValidationContext, type ValidationVerdict, type ValidationSpec,
  } from './sheet/validation'
  import type { RibbonActionId } from './sheet/ribbon'

  type Props = {
    /**
     * The document to edit: the workbook plus everything a sheet keeps beside
     * its cells (formats, sizes, hidden lines, frozen panes, comments). Build
     * one with `createSheetDocument` to save it, restore it or listen to it
     * outside the component; without it the shell makes its own from
     * `workbook` or `data` and hands it back through `onReady`.
     */
    document?: SheetDocument
    /** The workbook to edit. One is created from `data` when absent. */
    workbook?: Workbook
    /** Seed sheets, when not supplying a workbook. */
    data?: ReadonlyArray<SheetData>
    /** Minimum grid size, so a sparse sheet still looks like a sheet. */
    rows?: number
    columns?: number
    /**
     * Grid viewport height in pixels, or `'100%'` to fill the parent.
     *
     * The chrome around the grid - ribbon, formula bar, tabs, status bar -
     * is about 290px tall, so a fixed grid height is a fixed component
     * height with that added on. In a flex column that is too tall for the
     * space, the tab strip is what gets pushed under whatever comes next.
     * With `'100%'` the component is a flex item that fills its column and
     * the grid takes whatever the chrome leaves.
     */
    height?: number | '100%'
    /** Default column width. */
    columnWidth?: number
    /** Row height in pixels. Excel's is 20 at 100%; 22 fits the grid's 13px font. */
    rowHeight?: number
    /**
     * `theme` (the default) paints the shell with the host's `--sg-*`
     * tokens, so it follows whatever theme the app around it runs, as the
     * grid does. `excel` pins Excel's own palette and geometry, light or
     * dark with the page, for an app that wants it to read as Excel
     * whatever the theme.
     */
    look?: 'excel' | 'theme'
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
     * A bare address formats the sheet that is active when the shell mounts.
     * Qualify it to reach another sheet, the way a formula would:
     * `{ 'Orders!F2': { numFmt: '$#,##0.00' }, "'Price list'!C2": ... }`.
     * Formats are per sheet, as they are in Excel; a fill on Summary!C5 says
     * nothing about Orders!C5.
     *
     * Without this the sheet can only be formatted by hand after it loads,
     * which makes it impossible to ship a document that opens looking the way
     * it was saved. Applied once at mount; after that the stores own it.
     */
    formats?: Readonly<Record<string, CellFormatEntry>>
    /**
     * Ribbon buttons the shell has nothing behind: Insert > Table and
     * Insert > Chart. Left off unless listed here, which says the
     * application answers them in `onAction`.
     */
    extras?: ReadonlyArray<'insert-table' | 'insert-chart'>
    /** Hide any part of the chrome. */
    showRibbon?: boolean
    showFormulaBar?: boolean
    showTabs?: boolean
    showStatusBar?: boolean
    /**
     * Every action the ribbon, the cell menu, the formula bar and the
     * shortcuts raise. The shell has a dialog of its own for Find and
     * Replace, Paste Special, Format Cells and Insert Function; a handler
     * that returns `true` has taken the action over and the shell's dialog
     * stays closed, so an application can put its own in their place.
     */
    onAction?: (action: RibbonActionId, cmd: GridCommandContext) => void | boolean
    onReady?: (api: SheetApi, document: SheetDocument) => void
    /**
     * Something the user did landed in the document: a cell, a format, a
     * size, a hidden line, a frozen pane, a sheet, a comment, or a structural
     * edit. Called once per tick with every reason since the last call, so a
     * paste of forty cells is one call; the natural place for an autosave
     * (`getState()`, debounced). Undo and redo report too.
     */
    onChange?: (reasons: ReadonlyArray<SheetChangeReason>) => void
  }

  /**
   * A grid row carries the RAW text of every cell on it, keyed by column
   * letter, as well as its position.
   *
   * It would be tempting to keep the values only in the workbook and let the
   * cell snippet read them, since the snippet is what paints. That does not
   * work, and not only for rendering: the grid's own machinery reads
   * `row[field]`, so an empty row object means `cmd.getCellValue` returns
   * undefined for every cell, and then Ctrl+Arrow thinks the sheet is blank,
   * AutoSum finds no run to total, and the inline editor has nothing to open
   * on. The workbook stays authoritative; this is its projection.
   */
  type SheetRow = { id: string; index: number } & Record<string, string | number>
  type SheetApi = SvGridApi<TableFeatures, SheetRow>

  let {
    document: sheetDocument,
    workbook,
    data,
    rows: minRows = 50,
    columns: minCols = 12,
    height = 420,
    columnWidth = 96,
    rowHeight = 22,
    look = 'theme',
    columnWidths,
    formats,
    extras = [],
    showRibbon = true,
    showFormulaBar = true,
    showTabs = true,
    showStatusBar = true,
    onAction,
    onReady,
    onChange,
  }: Props = $props()

  enableSheet()

  // Read once, on purpose: the document IS what is being edited. Rebuilding
  // it when the prop identity changed would throw away every edit, so a
  // consumer that wants a different document mounts a different <SvSheet>.
  // svelte-ignore state_referenced_locally
  const doc: SheetDocument =
    sheetDocument ?? createSheetDocument(workbook ? { workbook } : { sheets: data ? [...data] : [{ name: 'Sheet1', cells: [] }] })
  const wb: Workbook = doc.workbook

  /** Report a change to the document; the `onChange` prop hears it once per tick. */
  const changed = (reason: SheetChangeReason) => doc.changed(reason)
  $effect(() => {
    if (!onChange) return
    return doc.subscribe((reasons) => onChange(reasons))
  })

  /**
   * The document as it stands, for saving: every sheet's cells and names
   * plus the formats, sizes, hidden lines, frozen panes and comments. The
   * active sheet's sizes and hidden lines live on the grid while it shows,
   * so they are read back into the document first.
   */
  export function getState(): SheetState {
    stashLive(wb.active)
    return doc.getState()
  }

  /**
   * Put a saved document back, in place: the workbook the consumer holds
   * stays the same object. The grid's history is cleared, since none of it
   * describes the sheet any more.
   */
  export function setState(state: SheetState): void {
    doc.setState(state)
    // The active sheet may have changed with the state; the targets rebind
    // to it without a swap (the document already holds every sheet's parts).
    targetsBoundTo = wb.active
    registerSheetTargets()
    applyLive(wb.active)
    const cmd = cmdOf()
    if (cmd) applyFreeze(cmd, doc.get(wb.active).freeze)
    api?.clearHistory()
    active = { rowIndex: 0, colIndex: 0 }
    bump()
  }

  // --- files ------------------------------------------------------------------
  /** The name the last Open or Save used, for the next Save. */
  let fileName = $state('Workbook')

  /**
   * Replace the document with the workbook in an .xlsx file: what File >
   * Open does once a file is picked. Resolves when the sheet shows it;
   * rejects with the reader's message when the file is not one.
   */
  export async function open(file: Blob & { name?: string }): Promise<void> {
    const state = await documentFromXlsx(file)
    setState(state)
    if (file.name) fileName = file.name.replace(/\.xlsx$/i, '')
  }

  /** The document as an .xlsx Blob: what File > Save As downloads. */
  export function toXlsx(): Promise<Blob> {
    stashLive(wb.active)
    return documentToXlsx(doc)
  }

  /** The active sheet as CSV text, cells as they show. */
  export function toCsv(): string {
    const rows: string[][] = []
    const lastRow = wb.rowCount(wb.active)
    const lastCol = wb.colCount(wb.active)
    for (let r = 0; r < lastRow; r += 1) {
      const line: string[] = []
      for (let c = 0; c < lastCol; c += 1) line.push(wb.getRaw(wb.active, r, c) === '' ? '' : display(r, c).text)
      rows.push(line)
    }
    return csvText(rows)
  }

  /** Start over with one empty sheet, as File > New does after its question. */
  export function newWorkbook(): void {
    setState({ version: 1, workbook: { sheets: [{ name: 'Sheet1', cells: [] }], active: 'Sheet1', names: {} }, sheets: {} })
    fileName = 'Workbook'
  }

  let newConfirm = $state(false)
  let fileInput = $state<HTMLInputElement | null>(null)

  /** Whether any sheet holds anything, so New can ask before it throws it away. */
  function documentHasContent(): boolean {
    for (const name of wb.sheets) {
      for (let r = 0; r < wb.rowCount(name); r += 1) {
        for (let c = 0; c < wb.colCount(name); c += 1) if (wb.getRaw(name, r, c).trim() !== '') return true
      }
    }
    return false
  }

  async function openPicked(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      await open(file)
      say(`Opened ${file.name}.`)
    } catch (e) {
      say(e instanceof Error ? e.message : `Could not open ${file.name}.`)
    }
  }

  async function saveXlsx() {
    try {
      downloadBlobFile(await toXlsx(), `${fileName}.xlsx`)
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not save the workbook.')
    }
  }

  /**
   * One counter drives every read of the workbook and the format store.
   *
   * Neither is `$state` - they are plain objects shared with the keyboard
   * layer, which has no Svelte in it - so nothing else would tell Svelte that
   * a cell changed. Everything reactive below reads `version` first.
   */
  let version = $state(0)
  // The sheet list and the active sheet as last seen, so a tab click, Insert
  // > New Sheet or Shift+F11 (none of which come through this component)
  // still report as a change.
  let sheetsSeen = ''
  const bump = () => {
    // A tab click switches sheets through the workbook alone, with no call
    // into this component, so the switch is noticed here: the first repaint
    // after it rebinds the per-sheet targets before anything reads them.
    if (wb.active !== targetsBoundTo) registerSheetTargets()
    const signature = wb.sheets.join('\u0000') + '\u0000' + wb.active
    if (sheetsSeen && signature !== sheetsSeen) changed({ kind: 'sheets' })
    sheetsSeen = signature
    cfStatsCache.clear()
    refreshAutoFilter()
    version += 1
  }

  // --- hidden and copied sheets -------------------------------------------
  /** The sheets whose tabs are not drawn; the document keeps the flag. */
  const hiddenSheets = $derived.by(() => {
    void version
    return wb.sheets.filter((name) => doc.get(name).sheetHidden)
  })
  /** Excel's Hide Sheet: the tab goes, and the cursor moves to the nearest
   *  sheet that shows when it was the active one. Refused on the last one. */
  function hideSheet(name: string) {
    const visible = wb.sheets.filter((n) => !doc.get(n).sheetHidden)
    if (visible.length < 2 || !wb.sheets.some((n) => n.toLowerCase() === name.toLowerCase())) return
    doc.get(name).sheetHidden = true
    if (wb.active.toLowerCase() === name.toLowerCase()) {
      const at = visible.findIndex((n) => n.toLowerCase() === name.toLowerCase())
      const next = visible[at + 1] ?? visible[at - 1]
      if (next) { wb.setActive(next); active = { rowIndex: 0, colIndex: 0 } }
    }
    changed({ kind: 'sheets' })
    bump()
  }
  function unhideSheet(name: string) {
    if (!wb.sheets.some((n) => n.toLowerCase() === name.toLowerCase())) return
    doc.get(name).sheetHidden = false
    wb.setActive(name)
    active = { rowIndex: 0, colIndex: 0 }
    changed({ kind: 'sheets' })
    bump()
  }
  /** The tab menu's Duplicate: cells, formats, sizes, rules and the rest. */
  function duplicateSheet(name: string) {
    const made = doc.duplicate(name)
    if (made === null) { say(`Could not copy ${name}.`); return }
    active = { rowIndex: 0, colIndex: 0 }
    bump()
  }

  /**
   * Tell the shell the workbook changed underneath it.
   *
   * Every edit made THROUGH the shell - typing, the ribbon, a shortcut, the
   * fill handle, `cmd.setCellValue` from an `onAction` handler - already
   * repaints. A write the shell cannot see does not: a Name Manager that
   * redefines a name, an import that replaces a sheet, a solver that has just
   * applied its answer with `wb.setRaw`. Those land in the workbook while the
   * cells keep showing the values from before, so call this afterwards.
   *
   *   let sheet: SvSheet
   *   <SvSheet bind:this={sheet} workbook={wb} onAction={...} />
   *   wb.names.define('TaxRate', 'Inputs!B3'); wb.recalculate(); sheet.refresh()
   */
  export function refresh() { bump() }

  /**
   * Run a ribbon action as if its button had been clicked: `act('sort-asc')`,
   * `act('circle-invalid')`. What the ribbon would raise for `onAction` is
   * raised here too, so a handler that takes an action over still does.
   * For a host with chrome of its own, and for tests.
   */
  export function act(action: RibbonActionId): void {
    const context = cmdOf()
    if (!context) return
    handleAction(action, context)
  }

  // The Name Box lists the defined names. Read under `version` like every
  // other view of the workbook: names are defined at runtime too, and a list
  // read once at mount would leave the box a name short of the sheet.
  const definedNames = $derived.by(() => {
    void version
    return wb.names.list()
  })

  let active = $state({ rowIndex: 0, colIndex: 0 })
  let selection = $state<ReadonlyArray<readonly [number, number, number, number]>>([])
  let api = $state<SheetApi | null>(null)
  /** Excel's Ctrl+` - show the formulas instead of their results. */
  let showFormulas = $state(false)
  /*
   * View > Show. View settings of this instance, not of the document: a
   * saved sheet comes back with them as the host set them, which is what
   * `showFormulaBar` already meant.
   */
  let gridlinesOn = $state(true)
  let formulaBarOn = $state(true)
  let headingsOn = $state(true)
  /** Excel's collapsed ribbon (Ctrl+F1, a double-click on a tab, the chevron). */
  let ribbonCollapsed = $state(false)

  /*
   * One format store per sheet, keyed by the sheet's name the way the
   * workbook keys its cells. A single store for the workbook was the first
   * version, and it made C5 bold on every sheet: a format is an address plus
   * a sheet, and the store only knew the address.
   */
  function storeFor(sheet: string = wb.active): SheetFormatStore {
    return doc.get(sheet).formats
  }

  /** Split `Orders!F2` or `'Price list'!F2` into its sheet and address. */
  function splitSheet(address: string): { sheet: string | null; cell: string } {
    const bang = address.lastIndexOf('!')
    if (bang < 0) return { sheet: null, cell: address }
    const sheet = address.slice(0, bang).replace(/^'(.*)'$/, '$1')
    return { sheet, cell: address.slice(bang + 1) }
  }

  // Seeded once. `parseA1` is the same address parser the formula engine
  // uses, so 'E13' here and =E13 in a cell cannot disagree about what E13 is.
  // svelte-ignore state_referenced_locally
  for (const [address, entry] of Object.entries(formats ?? {})) {
    const { sheet, cell } = splitSheet(address)
    const ref = parseA1(cell)
    if (!ref || ref.row === null) continue
    storeFor(sheet ?? wb.active).set([[ref.row, ref.col, ref.row, ref.col]], entry, {
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
    return Array.from({ length: rowCount }, (_, index) => {
      const row = { id: `r${index}`, index } as SheetRow
      for (let c = 0; c < colCount; c += 1) {
        row[colToLetters(c)] = wb.getRaw(wb.active, index, c)
      }
      return row
    })
  })

  const lookup = {
    rowIdAt: (i: number) => (i >= 0 && i < rowCount ? `r${i}` : null),
    columnIdAt: (i: number) => (i >= 0 && i < colCount ? colToLetters(i) : null),
  }

  // --- protection -------------------------------------------------------------
  /**
   * Excel's sheet protection: every cell is locked unless Format Cells >
   * Protection unlocked it, and the flags mean nothing until Protect Sheet
   * is on. A protected sheet refuses to change a locked cell wherever the
   * change comes from (typing, the formula bar, paste, fill, the ribbon's
   * formats, a sort, an insert), keeps its row and column sizes, and says
   * why in the status bar. There is no password: the sheet is protected
   * against mistakes, not against its user.
   */
  const protectedNow = () => doc.get(wb.active).protected
  const isProtected = $derived.by(() => { void version; return protectedNow() })
  /** Whether (r, c) may not change right now. */
  function locked(r: number, c: number): boolean {
    return protectedNow() && isLocked(storeFor().get(`r${r}`, colToLetters(c)))
  }
  function refuse() { say(PROTECTED_MESSAGE) }
  /** The selection, or the active cell, as rectangles. */
  function selectedRects(cmd?: GridCommandContext | null): ReadonlyArray<readonly [number, number, number, number]> {
    if (cmd?.ranges.length) return cmd.ranges
    if (selection.length) return selection
    return [[active.rowIndex, active.colIndex, active.rowIndex, active.colIndex] as const]
  }
  // --- comments ---------------------------------------------------------------
  /**
   * Excel's notes: a text on a cell, marked by a corner and read on hover.
   * The document keeps them per sheet in the grid's own `notes` shape and
   * moves them with an insert or delete; the grid draws the mark and the
   * tooltip from `notes`, which is handed a fresh object after every change
   * because the grid re-reads it only when the object is a different one.
   * The editor is Excel's note box: it opens beside the cell, and whatever
   * closes it keeps the text (Escape and a click elsewhere included).
   */
  const notesNow = (): NotesMap => doc.get(wb.active).notes
  // The document keys a row `r4` as the format store does; the grid keys it
  // by its index under the default getRowId, so the map it is handed is
  // re-keyed, and fresh, on every repaint.
  const activeNotes = $derived.by<NotesMap>(() => {
    void version
    const out: NotesMap = {}
    for (const [rowId, line] of Object.entries(notesNow())) out[rowId.slice(1)] = line
    return out
  })
  /**
   * The one thing anchored to a cell at a time: the comment editor, with
   * the text as typed so far, or a validated cell's list.
   */
  type CellPopover =
    | { kind: 'comment'; r: number; c: number; draft: string; initial: string }
    | { kind: 'list'; r: number; c: number; choices: string[] }
    | { kind: 'filter'; r: number; c: number; values: ReturnType<typeof distinctValues>; numeric: boolean; header: string; filter: ColumnFilter | null }
  let cellPopover = $state<CellPopover | null>(null)
  /** Where the editor points: the cell's box relative to the grid host. */
  let anchorRect = $state<{ left: number; top: number; width: number; height: number } | null>(null)
  let gridHost = $state<HTMLDivElement | null>(null)
  let showComments = $state(false)
  const allComments = $derived.by(() => { void version; return listComments(notesNow()) })

  /** Write, replace or (with blank text) remove the comment on (r, c), one undo. */
  function setComment(r: number, c: number, text: string) {
    const sheet = wb.active
    const before = doc.get(sheet).notes
    const after = withComment(before, r, c, text)
    const put = (notes: NotesMap) => {
      doc.get(sheet).notes = notes
      bump()
      changed({ kind: 'comments' })
    }
    put(after)
    cmdOf()?.recordUndo(() => put(before), () => put(after))
  }

  /** Open the note box on (r, c), moving the cursor there first. */
  function openCommentEditor(r: number, c: number) {
    const cmd = cmdOf()
    if (!cmd) return
    if (cellPopover) closeCellPopover()
    cmd.setActiveCell(r, c)
    cmd.setSelection(r, c)
    cmd.scrollIntoView(r, c)
    active = { rowIndex: r, colIndex: c }
    const initial = commentAt(notesNow(), r, c) ?? ''
    cellPopover = { kind: 'comment', r, c, draft: initial, initial }
    // The cell may have just been scrolled into the window: measure once
    // the grid has painted it.
    void tick().then(() => requestAnimationFrame(measureAnchor))
  }

  /** The box the popover points at, re-read on every scroll. */
  function measureAnchor() {
    const pop = cellPopover
    const host = gridHost
    if (!pop || !host) { anchorRect = null; return }
    const td = host.querySelector<HTMLElement>(`td[data-svgrid-row="${pop.r}"][data-svgrid-col="${pop.c}"]`)
    if (!td) {
      // Scrolled out of the window: the note closes and keeps its text, as
      // a note in Excel does when its cell leaves the screen; a list closes.
      closeCellPopover()
      return
    }
    const a = td.getBoundingClientRect()
    const b = host.getBoundingClientRect()
    anchorRect = { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height }
  }

  /** Close whatever is anchored; a note keeps what was typed unless told otherwise. */
  function closeCellPopover(keep = true) {
    const pop = cellPopover
    if (!pop) return
    cellPopover = null
    anchorRect = null
    if (pop.kind === 'comment' && keep && pop.draft !== pop.initial) setComment(pop.r, pop.c, pop.draft)
    const cmd = cmdOf()
    if (cmd) focusSheet(cmd)
  }

  /** Review > Previous / Next Comment: walk to it and open it. */
  function walkComments(dir: 1 | -1) {
    const to = nextComment(notesNow(), { row: active.rowIndex, col: active.colIndex }, dir)
    if (!to) { say('No comments on this sheet.'); return }
    openCommentEditor(to.row, to.col)
  }

  // --- data validation --------------------------------------------------------
  /**
   * Excel's Data Validation: a rule over some cells says what may be typed
   * into them. Only typed entries are checked (the in-cell editor and the
   * formula bar), as in Excel: paste, fill and the commands write what they
   * are given. A rejected entry never reaches the workbook; the alert box
   * offers Retry, which reopens the editor with the entry, and a Warning
   * rule lets the entry through on Yes.
   */
  const rulesNow = (): ReadonlyArray<ValidationRule> => doc.get(wb.active).validation
  const validationCtx: ValidationContext = {
    evaluate: (text, entry) => wb.evaluateText(wb.active, text, entry),
    range: (text) => wb.evaluateRange(wb.active, text),
  }
  /** The alert waiting to be shown, with the entry that caused it. */
  let pendingAlert = $state<{ r: number; c: number; text: string; verdict: Extract<ValidationVerdict, { ok: false }> } | null>(null)
  let dataValidationOpen = $state(false)
  /**
   * Excel's Circle Invalid Data: the sheet the circles were asked for, or
   * null while they are off. They are worked out again on every repaint
   * while on, so a cell corrected under its rule loses its circle at once
   * and one broken gains it, as in Excel; Clear Validation Circles, or a
   * switch to another sheet, turns them off.
   */
  let circlesOn = $state<string | null>(null)
  const circled = $derived.by<Set<string>>(() => {
    void version
    const out = new Set<string>()
    if (circlesOn === null || circlesOn.toLowerCase() !== wb.active.toLowerCase()) return out
    const hits = invalidCells(rulesNow(), validationCtx, (r, c) => wb.getRaw(wb.active, r, c), wb.rowCount(wb.active), wb.colCount(wb.active))
    for (const hit of hits) out.add(`${hit.row},${hit.col}`)
    return out
  })
  /**
   * The rule's Input Message under the active cell, as Excel shows it while
   * the cell is selected. Measured like the popovers and hidden while one of
   * them is up, so a list never opens on top of it.
   */
  const inputMessage = $derived.by<{ r: number; c: number; title?: string; message?: string } | null>(() => {
    void version
    if (cellPopover) return null
    const rule = ruleAt(rulesNow(), active.rowIndex, active.colIndex)
    if (!rule?.input) return null
    return { r: active.rowIndex, c: active.colIndex, title: rule.input.title, message: rule.input.message }
  })
  let messageRect = $state<{ left: number; top: number; height: number } | null>(null)
  function measureMessage() {
    const at = inputMessage
    const host = gridHost
    if (!at || !host) { messageRect = null; return }
    const td = host.querySelector<HTMLElement>(`td[data-svgrid-row="${at.r}"][data-svgrid-col="${at.c}"]`)
    if (!td) { messageRect = null; return }
    const a = td.getBoundingClientRect()
    const b = host.getBoundingClientRect()
    messageRect = { left: a.left - b.left, top: a.top - b.top, height: a.height }
  }
  $effect(() => {
    void inputMessage
    void version
    void tick().then(() => requestAnimationFrame(measureMessage))
  })

  // --- conditional formatting -------------------------------------------------
  /**
   * Excel's rules over cells that colour them by what they hold, evaluated
   * over the COMPUTED values (a formula's result, not its text). Each rule's
   * statistics over its range (min, max, mean, rank, counts) are worked out
   * once per repaint and cached, so a thousand cells cost one pass; the
   * cache empties in `bump()`. The rule's style paints after the cell's own,
   * so the rule wins where both speak, as in Excel.
   */
  const cfNow = (): ReadonlyArray<CfRule> => doc.get(wb.active).conditionalFormats
  const cfCtx: CfContext = { evaluate: (text) => wb.evaluateText(wb.active, text) }
  const cfStatsCache = new Map<string, CfStats>()
  function cfStatsFor(rule: CfRule): CfStats {
    let stats = cfStatsCache.get(rule.id)
    if (!stats) {
      stats = ruleStats(rule, (r, c) => wb.getValue(wb.active, r, c), (r, c) => display(r, c).text)
      cfStatsCache.set(rule.id, stats)
    }
    return stats
  }
  /** What the rules say about a cell, or null when none reaches it. */
  function cfAt(r: number, c: number, value: CellValue): CfResult | null {
    const rules = cfNow()
    if (!rules.length) return null
    return evaluateCf(rules, r, c, value, display(r, c).text, cfStatsFor, cfCtx)
  }
  let cfDialog = $state<{ preset: CfPreset; rule: CfStyledRule | null; replace?: (next: CfStyledRule) => void } | null>(null)
  let manageRulesOpen = $state(false)
  /** The rules and the selection as the Rules Manager sees them, live. */
  const cfRules = $derived.by(() => { void version; return cfNow() })
  const cfSelection = $derived.by(() => { void version; void selection; void active; return cfRects() })

  // --- merged cells -----------------------------------------------------------
  /**
   * Excel's Merge & Center, Merge Across, Merge Cells and Unmerge Cells.
   * The document keeps the merges per sheet as rectangles and moves them
   * with an insert or delete; the grid draws them through `mergedCells`
   * (one td with its spans, the covered cells not drawn, a selection that
   * grows to whole merges, arrows that step over them). A merge keeps the
   * top-left value and drops the rest, so a merge over values asks first,
   * as Excel does; the clears, the centring and the merge are one undo.
   */
  const mergesNow = (): ReadonlyArray<Rect> => doc.get(wb.active).merges
  const activeMerges = $derived.by(() => { void version; return toGridMerges(mergesNow()) })
  /** A merge that would drop values, waiting for the user's OK. */
  let mergeConfirm = $state<{ plan: MergePlan; rects: Rect[] } | null>(null)

  /** Replace the sheet's merges, one undo. */
  function setMerges(next: Rect[]) {
    const sheet = wb.active
    const before = doc.get(sheet).merges
    const put = (merges: Rect[]) => {
      doc.get(sheet).merges = merges
      bump()
      changed({ kind: 'merges' })
    }
    put(next)
    cmdOf()?.recordUndo(() => put(before), () => put(next))
  }

  /** Whether (r, c) is inside a merge without being its top-left cell. */
  function covered(r: number, c: number): boolean {
    return isCoveredCell(mergesNow(), r, c)
  }

  /*
   * The columns' live widths, one state property per letter. A cell reads
   * only the letters it needs (its own, and the empty neighbours its text
   * spills over), so a column being resized repaints its own cells and
   * not the whole sheet; a single shared map would invalidate every cell
   * on every frame of the drag. Filled from the grid once per change:
   * `getColumnWidths()` builds a fresh map on every call, and the cells
   * used to ask for it three times each.
   */
  const liveWidths = $state<Record<string, number>>({})
  $effect(() => {
    const next = api?.getColumnWidths() ?? {}
    for (const [letter, px] of Object.entries(next)) {
      if (untrack(() => liveWidths[letter]) !== px) liveWidths[letter] = px
    }
  })
  const widthOf = (col: number): number => {
    const letter = colToLetters(col)
    return liveWidths[letter] ?? columnWidths?.[letter] ?? columnWidth
  }

  /** The width a merged origin draws across, or the column's own. */
  function cellWidth(r: number, c: number): number {
    const one = widthOf
    const m = sheetMergeAt(mergesNow(), r, c)
    if (!m || m[0] !== r || m[1] !== c) return one(c)
    let total = 0
    for (let col = m[1]; col <= m[3]; col += 1) total += one(col)
    return total
  }

  /** Merge & Center / Merge Across / Merge Cells over the selection. */
  function runMerge(kind: MergeKind, cmd: GridCommandContext) {
    const rects = selectedRects(cmd).map(normalRect)
    if (protectedNow() && rectsHaveLocked(storeFor(), lookup, rects)) { refuse(); return }
    // Excel's Merge & Center on a merged selection unmerges it.
    if (kind === 'center' && rects.length === 1 && mergesIn(mergesNow(), rects).some((m) => m.join() === rects[0]!.join())) {
      runUnmerge(cmd)
      return
    }
    const plan = mergePlan(mergesNow(), rects, kind, (r, c) => wb.getRaw(wb.active, r, c) === '')
    if (plan.merges.length === mergesNow().length && plan.merges.every((m, i) => m === mergesNow()[i])) return
    if (plan.clear.length) { mergeConfirm = { plan, rects }; return }
    applyMerge(plan, cmd)
  }

  function applyMerge(plan: MergePlan, cmd: GridCommandContext) {
    const target = getFormatTarget()
    cmd.batch(() => {
      for (const [r, c] of plan.clear) cmd.setCellValue(r, c, '')
      if (plan.center && target && plan.origins.length) {
        const rects = plan.origins.map(([r, c]) => [r, c, r, c] as const)
        withFormatUndo(cmd, target, rects, () => target.store.set(rects, { align: 'center' }, target.lookup))
      }
      setMerges(plan.merges)
    })
    if (plan.origins[0]) {
      cmd.setActiveCell(plan.origins[0][0], plan.origins[0][1])
      cmd.setSelection(plan.origins[0][0], plan.origins[0][1])
    }
    focusSheet(cmd)
  }

  function runUnmerge(cmd: GridCommandContext) {
    const rects = selectedRects(cmd).map(normalRect)
    const next = unmergePlan(mergesNow(), rects)
    if (next.length === mergesNow().length) return
    cmd.batch(() => setMerges(next))
    focusSheet(cmd)
  }

  /** Whether the selection holds a merge, for the menu's items. */
  const selectionHasMerge = () => selectionMerged(mergesNow(), selectedRects(cmdOf()).map(normalRect))

  // --- AutoFilter ---------------------------------------------------------------
  /**
   * Excel's AutoFilter: Ctrl+Shift+L (or Data > Filter) puts arrows on the
   * header row of the current region; an arrow drops the column's values
   * to tick and the conditions to set; the rows that fail fold away as
   * collapsed rows. Those rows are the filter's, kept apart from the rows
   * the user hid by hand (`filterHidden` vs `hidden`), so Unhide and the
   * saved document see only the user's. The set is worked out again after
   * every change, so a formula that drops out of a Number Filter folds
   * away and one that comes back returns, as Excel's Reapply would.
   */
  const autoFilterNow = (): AutoFilterState | null => doc.get(wb.active).autoFilter
  const activeFilter = $derived.by(() => { void version; return autoFilterNow() })
  const displayOnActive = (r: number, c: number) => display(r, c).text
  const valueOnActive = (r: number, c: number) => wb.getValue(wb.active, r, c)

  /** What a cell of any sheet shows, for the filter over a sheet not on screen. */
  function displayOn(name: string, r: number, c: number): string {
    const value = wb.getValue(name, r, c)
    if (isError(value)) return value.error
    const entry = doc.get(name).formats.get(`r${r}`, colToLetters(c))
    if (entry?.numFmt) return compileNumberFormat(entry.numFmt).format(value).text
    if (value === '' || value == null) return ''
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
    return String(value)
  }

  /** Put the filter's rows on the grid: the delta against what it folds now. */
  function settleFilterRows(next: ReadonlySet<number>) {
    const state = doc.get(wb.active)
    const before = state.filterHidden
    if (api) {
      for (const r of before) if (!next.has(r) && !state.hidden.rows.has(r)) api.setRowCollapsed(r, false)
      for (const r of next) if (!before.has(r)) api.setRowCollapsed(r, true)
    }
    state.filterHidden = new Set(next)
  }

  /** Replace the sheet's AutoFilter, one undo, the rows following. */
  function applyAutoFilter(next: AutoFilterState | null, cmd: GridCommandContext | null) {
    const sheet = wb.active
    const before = doc.get(sheet).autoFilter
    const put = (state: AutoFilterState | null) => {
      doc.get(sheet).autoFilter = state
      settleFilterRows(hiddenRowsFor(state, valueOnActive, displayOnActive))
      bump()
      changed({ kind: 'filter' })
    }
    put(next)
    cmd?.recordUndo(() => put(before), () => put(next))
  }

  /** Data > Filter / Ctrl+Shift+L: arrows on the current region, or off again. */
  function toggleAutoFilter(cmd: GridCommandContext) {
    if (autoFilterNow()) { applyAutoFilter(null, cmd); return }
    const region = currentRegion(gridOf(cmd), { row: active.rowIndex, col: active.colIndex })
    const last = selection[selection.length - 1]
    const isRange = last && (last[0] !== last[2] || last[1] !== last[3])
    const range: Rect = isRange ? normalRect(last) : region
    applyAutoFilter({ range, filters: {} }, cmd)
  }

  /** Whether a column of the filtered region should show its arrow. */
  function filterArrowAt(r: number, c: number): 'plain' | 'filtered' | null {
    const af = activeFilter
    if (!af || r !== af.range[0] || c < af.range[1] || c > af.range[3]) return null
    return af.filters[c] ? 'filtered' : 'plain'
  }

  /** The menu for a column: its values, its filter, its kind. */
  function filterMenuFor(col: number) {
    const af = autoFilterNow()!
    const others = hiddenRowsFor(withColumnFilter(af, col, null), valueOnActive, displayOnActive)
    const values = distinctValues(af, col, valueOnActive, displayOnActive, (r) => !others.has(r))
    const numeric = values.some((v) => v.numeric !== null) && values.every((v) => v.numeric !== null || v.text === '')
    const header = display(af.range[0], col).text || colToLetters(col)
    return { values, numeric, header, filter: af.filters[col] ?? null }
  }

  function openFilterMenu(col: number) {
    const af = autoFilterNow()
    const cmd = cmdOf()
    if (!af || !cmd) return
    if (cellPopover) closeCellPopover()
    cellPopover = { kind: 'filter', r: af.range[0], c: col, ...filterMenuFor(col) }
    void tick().then(() => requestAnimationFrame(measureAnchor))
  }

  /** Every repaint: the rows the filter folds may have changed with the values. */
  function refreshAutoFilter() {
    const state = doc.get(wb.active)
    if (!state.autoFilter || !api) return
    const next = hiddenRowsFor(state.autoFilter, valueOnActive, displayOnActive)
    if (next.size === state.filterHidden.size && [...next].every((r) => state.filterHidden.has(r))) return
    settleFilterRows(next)
  }

  /** "N of M records found", for the status bar while a filter is on. */
  const filterSummary = $derived.by(() => {
    void version
    const af = autoFilterNow()
    if (!isFiltering(af)) return null
    const total = af!.range[2] - af!.range[0]
    return `${total - doc.get(wb.active).filterHidden.size} of ${total} records found`
  })

  /** Replace the rules of the active sheet, one undo. */
  function setCf(next: CfRule[]) {
    const sheet = wb.active
    const before = doc.get(sheet).conditionalFormats
    const put = (rules: CfRule[]) => {
      doc.get(sheet).conditionalFormats = rules
      bump()
      changed({ kind: 'conditional-formats' })
    }
    put(next)
    cmdOf()?.recordUndo(() => put(before), () => put(next))
  }

  /** The selection as normalised rectangles, where a new rule applies. */
  function cfRects(): Rect[] {
    return selectedRects(cmdOf()).map(([r1, c1, r2, c2]) => [Math.min(r1, r2), Math.min(c1, c2), Math.max(r1, r2), Math.max(c1, c2)] as const)
  }

  /** A new rule over the selection, first in priority as Excel adds them. */
  function addCf(body: CfRuleBody) {
    const rule = { id: cfId(), rects: cfRects(), ...body } as CfRule
    setCf([rule, ...cfNow()])
  }

  /** The small dialog came back: a new rule, or the edited one put back. */
  function applyCfBody(body: CfBody) {
    const dialog = cfDialog
    cfDialog = null
    if (dialog?.rule && dialog.replace) {
      dialog.replace({ ...body, id: dialog.rule.id, rects: dialog.rule.rects, stopIfTrue: dialog.rule.stopIfTrue } as CfStyledRule)
      return
    }
    addCf(body)
  }

  const CF_PRESETS: Partial<Record<RibbonActionId, CfPreset>> = {
    'cf-greater': 'greater', 'cf-less': 'less', 'cf-between': 'between', 'cf-equal': 'equal',
    'cf-text': 'text', 'cf-duplicates': 'duplicates', 'cf-top10': 'top10', 'cf-bottom10': 'bottom10',
    'cf-above-average': 'aboveAverage', 'cf-below-average': 'belowAverage',
  }

  /** The Conditional Formatting menu's entries. */
  function cfAction(action: RibbonActionId, context: GridCommandContext): boolean {
    const preset = CF_PRESETS[action]
    if (preset) { cfDialog = { preset, rule: null }; return true }
    switch (action) {
      case 'cf-data-bar': addCf({ kind: 'dataBar', color: DATA_BAR_COLOR }); break
      case 'cf-color-scale-3': addCf({ kind: 'colorScale', colors: COLOR_SCALES['green-yellow-red'] }); break
      case 'cf-color-scale-2': addCf({ kind: 'colorScale', colors: COLOR_SCALES['green-white'] }); break
      case 'cf-icon-set': addCf({ kind: 'iconSet', set: 'arrows' }); break
      case 'cf-clear-selection': {
        const next = removeCf(cfNow(), cfRects())
        if (next.length !== cfNow().length || next.some((rule, i) => rule !== cfNow()[i])) setCf(next)
        break
      }
      case 'cf-clear-sheet': if (cfNow().length) setCf([]); break
      case 'cf-manage': manageRulesOpen = true; return true
      default: return false
    }
    focusSheet(context)
    return true
  }

  /** Whether `text` may land in (r, c); sets the alert when it may not. */
  function admits(r: number, c: number, text: string): boolean {
    const rule = ruleAt(rulesNow(), r, c)
    if (!rule) return true
    const verdict = checkEntry(rule, text, { row: r, col: c }, validationCtx)
    if (verdict.ok) return true
    pendingAlert = { r, c, text, verdict }
    // The grid's Enter has already moved the cursor on by the time the
    // alert opens; Excel keeps it on the cell that refused, and so does
    // Retry, which reopens that cell.
    const cmd = cmdOf()
    if (cmd) void tick().then(() => { cmd.setActiveCell(r, c); cmd.setSelection(r, c) })
    return false
  }

  /** Replace the rules of the active sheet, one undo. */
  function setValidation(next: ValidationRule[]) {
    const sheet = wb.active
    const before = doc.get(sheet).validation
    const put = (rules: ValidationRule[]) => {
      doc.get(sheet).validation = rules
      bump()
      changed({ kind: 'validation' })
    }
    put(next)
    cmdOf()?.recordUndo(() => put(before), () => put(next))
  }

  /** OK in the dialog: one rule over the selection, replacing what was there. */
  function applyValidation(spec: ValidationSpec) {
    const rects = selectedRects(cmdOf()).map(([r1, c1, r2, c2]) => [Math.min(r1, r2), Math.min(c1, c2), Math.max(r1, r2), Math.max(c1, c2)] as const)
    const kept = removeValidation(rulesNow(), rects)
    setValidation([...kept, { id: validationId(), rects, ...spec }])
  }

  /** Clear All in the dialog: the selection loses its validation. */
  function clearValidation() {
    const rects = selectedRects(cmdOf()).map(([r1, c1, r2, c2]) => [Math.min(r1, r2), Math.min(c1, c2), Math.max(r1, r2), Math.max(c1, c2)] as const)
    const next = removeValidation(rulesNow(), rects)
    if (next.length !== rulesNow().length || next.some((rule, i) => rule !== rulesNow()[i])) setValidation(next)
  }

  /** The list rule a cell offers a dropdown for, if any. */
  function listRuleAt(r: number, c: number): ValidationRule | undefined {
    const rule = ruleAt(rulesNow(), r, c)
    return rule && rule.allow === 'list' && rule.inCellDropdown ? rule : undefined
  }

  /** Drop the list down under (r, c). */
  function openListPicker(r: number, c: number) {
    const rule = listRuleAt(r, c)
    const cmd = cmdOf()
    if (!rule || !cmd) return
    if (cellPopover) closeCellPopover()
    cellPopover = { kind: 'list', r, c, choices: listChoices(rule, validationCtx) }
    void tick().then(() => requestAnimationFrame(measureAnchor))
  }

  /** A choice picked from the list: written as typed, one undo. */
  function pickChoice(choice: string) {
    const pop = cellPopover
    closeCellPopover()
    const cmd = cmdOf()
    if (!pop || !cmd) return
    if (locked(pop.r, pop.c)) { refuse(); return }
    cmd.batch(() => cmd.setCellValue(pop.r, pop.c, choice))
  }

  /** The alert's Retry: the cell reopens with the entry, as in Excel. */
  function retryEntry() {
    const alert = pendingAlert
    pendingAlert = null
    const cmd = cmdOf()
    if (!alert || !cmd) return
    void tick().then(() => { cmd.startEditing(alert.r, alert.c, alert.text) })
  }

  /** A Warning's Yes: the entry lands after all. */
  function acceptEntry() {
    const alert = pendingAlert
    pendingAlert = null
    const cmd = cmdOf()
    if (!alert || !cmd) return
    cmd.batch(() => cmd.setCellValue(alert.r, alert.c, balanceParens(alert.text)))
    focusSheet(cmd)
  }

  /** Protect or unprotect the active sheet, as one undo step. */
  function setProtected(on: boolean, cmd: GridCommandContext) {
    const sheet = wb.active
    const before = doc.get(sheet).protected
    if (before === on) return
    const put = (value: boolean) => {
      doc.get(sheet).protected = value
      bump()
      changed({ kind: 'protection' })
    }
    put(on)
    cmd.recordUndo(() => put(before), () => put(on))
    say(on ? 'Sheet protected. Locked cells can no longer be changed.' : 'Sheet unprotected.')
  }

  // --- the seams the keyboard layer and the ribbon both act through --------
  /**
   * The format and structure targets are bound to ONE sheet's store, so they
   * are registered again whenever the active sheet changes. Everything else
   * reads `wb.active` at call time and is registered once.
   */
  /**
   * Column widths are per sheet in Excel and per grid here, so the shell
   * keeps a set for each sheet and swaps them on a switch: the widths the
   * user dragged on Orders are put away when Summary comes up and come back
   * with Orders. A sheet never resized reads the `columnWidths` prop.
   */
  function stashWidths(name: string = wb.active) {
    if (!api) return
    doc.get(name).widths = { ...api.getColumnWidths() }
  }
  function applyWidths(name: string = wb.active) {
    if (!api) return
    const saved = doc.get(name).widths
    for (let c = 0; c < colCount; c += 1) {
      const letter = colToLetters(c)
      api.setColumnWidth(letter, saved[letter] ?? columnWidths?.[letter] ?? columnWidth)
    }
  }

  /**
   * Row heights, the same way: the grid keys a dragged height by row id,
   * and a sheet's row ids are positions (`r4`), so a height dragged on
   * Orders would show on Summary's fourth row. They are put away and
   * brought back with the sheet, and an insert or delete moves them with
   * their rows.
   */
  function ownRowHeights(keep: ReadonlyMap<number, number> = new Map()): Map<number, number> {
    const out = new Map<number, number>()
    if (!api) return out
    for (let r = 0; r < rowCount; r += 1) {
      // A hidden row reports 0, which is its hiding and not its height: the
      // hidden set keeps that, and a 0 saved here would outlive an Unhide.
      // The height it had before it was hidden is what comes back with it.
      if (api.isRowCollapsed(r)) {
        const before = keep.get(r)
        if (before !== undefined) out.set(r, before)
        continue
      }
      const h = api.getRowHeight(r)
      if (h !== rowHeight) out.set(r, h)
    }
    return out
  }
  function stashHeights(name: string = wb.active) {
    if (!api) return
    doc.get(name).heights = ownRowHeights(doc.get(name).heights)
  }
  function applyHeights(name: string = wb.active) {
    if (!api) return
    const saved = doc.get(name).heights
    for (let r = 0; r < rowCount; r += 1) api.setRowHeight(r, saved.get(r) ?? null)
  }

  /**
   * Hidden rows and columns, per sheet like the sizes. Excel hides a line
   * by folding it to nothing and the grid does the same (`setRowCollapsed`,
   * `setColumnCollapsed`): the line keeps its number or letter, every
   * reference to it holds, and it takes no room. What is hidden on Orders
   * is put away with Orders and moves with an insert or delete.
   */
  type Hidden = { rows: Set<number>; cols: Set<number> }
  function ownHidden(): Hidden {
    const out: Hidden = { rows: new Set(), cols: new Set() }
    if (!api) return out
    // The rows the AutoFilter folded are its own, not hidden lines.
    const filtered = doc.get(wb.active).filterHidden
    for (let r = 0; r < rowCount; r += 1) if (api.isRowCollapsed(r) && !filtered.has(r)) out.rows.add(r)
    for (let c = 0; c < colCount; c += 1) if (api.isColumnCollapsed(colToLetters(c))) out.cols.add(c)
    return out
  }
  function applyHidden(hidden: Hidden, filtered: ReadonlySet<number> = new Set()) {
    if (!api) return
    for (let r = 0; r < rowCount; r += 1) api.setRowCollapsed(r, hidden.rows.has(r) || filtered.has(r))
    for (let c = 0; c < colCount; c += 1) api.setColumnCollapsed(colToLetters(c), hidden.cols.has(c))
  }
  function stashHidden(name: string = wb.active) {
    if (!api) return
    doc.get(name).hidden = ownHidden()
  }
  /** The active sheet's sizes and hidden lines, read back from the grid into the document. */
  function stashLive(name: string = wb.active) {
    stashWidths(name)
    stashHeights(name)
    stashHidden(name)
  }
  /** The document's sizes and hidden lines for a sheet, put on the grid. */
  function applyLive(name: string = wb.active) {
    applyWidths(name)
    applyHeights(name)
    // The AutoFilter's rows are worked out afresh: a restore, a structural
    // edit or a sheet switch may have moved or changed them.
    const state = doc.get(name)
    state.filterHidden = hiddenRowsFor(state.autoFilter, (r, c) => wb.getValue(name, r, c), (r, c) => displayOn(name, r, c))
    applyHidden(state.hidden, state.filterHidden)
  }

  /**
   * Hide or unhide the rows or columns the selection covers, as one undo
   * step. Unhide reveals what the selection spans, and, when it spans
   * nothing hidden, the hidden lines right next to it: a right-click on C
   * with B hidden is the natural way to ask for B back. The active cell on
   * a line just hidden steps to the next one that shows, as Excel's does.
   */
  function hideLines(axis: 'rows' | 'cols', hide: boolean, cmd: GridCommandContext) {
    if (!api) return
    if (protectedNow()) { refuse(); return }
    const count = axis === 'rows' ? rowCount : colCount
    const isHidden = (i: number) => axis === 'rows' ? api!.isRowCollapsed(i) : api!.isColumnCollapsed(colToLetters(i))
    const setHidden = (i: number, on: boolean) =>
      axis === 'rows' ? api!.setRowCollapsed(i, on) : api!.setColumnCollapsed(colToLetters(i), on)
    const rects = cmd.ranges.length
      ? cmd.ranges
      : cmd.activeCell ? [[cmd.activeCell.rowIndex, cmd.activeCell.colIndex, cmd.activeCell.rowIndex, cmd.activeCell.colIndex] as const] : []
    const targets = new Set<number>()
    let lo = count, hi = -1
    for (const [r1, c1, r2, c2] of rects) {
      const from = axis === 'rows' ? r1 : c1
      const to = Math.min(axis === 'rows' ? r2 : c2, count - 1)
      lo = Math.min(lo, from); hi = Math.max(hi, to)
      for (let i = from; i <= to; i += 1) if (isHidden(i) !== hide) targets.add(i)
    }
    if (!hide && targets.size === 0 && hi >= 0) {
      for (let i = lo - 1; i >= 0 && isHidden(i); i -= 1) targets.add(i)
      for (let i = hi + 1; i < count && isHidden(i); i += 1) targets.add(i)
    }
    // A row the AutoFilter folded is not a hidden row: Unhide leaves it to the filter.
    if (axis === 'rows' && !hide) for (const r of doc.get(wb.active).filterHidden) targets.delete(r)
    if (targets.size === 0) {
      say(hide ? `Nothing to hide` : `Nothing hidden in the selection`)
      return
    }
    const apply = (on: boolean) => { for (const i of targets) setHidden(i, on); stashHidden(); bump(); changed({ kind: 'hidden' }) }
    apply(hide)
    cmd.recordUndo(() => apply(!hide), () => apply(hide))
    if (hide && cmd.activeCell) {
      const at = axis === 'rows' ? cmd.activeCell.rowIndex : cmd.activeCell.colIndex
      if (isHidden(at)) {
        let next = hi + 1
        while (next < count && isHidden(next)) next += 1
        if (next >= count) { next = lo - 1; while (next >= 0 && isHidden(next)) next -= 1 }
        if (next >= 0) {
          const r = axis === 'rows' ? next : cmd.activeCell.rowIndex
          const c = axis === 'rows' ? cmd.activeCell.colIndex : next
          cmd.setActiveCell(r, c)
          cmd.setSelection(r, c)
        }
      }
    }
    say(`${targets.size} ${axis === 'rows' ? 'row' : 'column'}${targets.size === 1 ? '' : 's'} ${hide ? 'hidden' : 'shown'}`)
  }

  let targetsBoundTo = ''
  function registerSheetTargets() {
    // Only a real switch swaps the per-sheet state. The mount effect calls
    // this too, and re-applying the freeze from there re-rendered the grid,
    // which repainted the shell, which ran the effect again: a loop. The
    // sheet going away has its live sizes and hidden lines read back into
    // the document first; the one coming up gets its own put on the grid.
    if (targetsBoundTo && targetsBoundTo !== wb.active) {
      if (doc.has(targetsBoundTo)) stashLive(targetsBoundTo)
      applyLive(wb.active)
      const cmd = cmdOf()
      if (cmd) applyFreeze(cmd, doc.get(wb.active).freeze)
    }
    targetsBoundTo = wb.active
    const store = storeFor()
    setFormatTarget({
      store, lookup,
      onChange: () => { bump(); fitWrappedRows(); changed({ kind: 'formats' }) },
      // Formats hold on a protected sheet where the selection has a locked
      // cell: Excel's Format Cells greys out there.
      guard: (rects) => !protectedNow() || !rectsHaveLocked(store, lookup, rects),
      refused: refuse,
    })
    setStructureTarget({
      // No insert or delete on a protected sheet, as in Excel.
      canApply: () => !protectedNow(),
      refused: refuse,
      getRaw: (r, c) => wb.getRaw(wb.active, r, c),
      setRaw: (r, c, text) => wb.setRaw(wb.active, r, c, text),
      // The workbook rewrites references across EVERY sheet, not just this
      // one, which is the whole reason the edit goes through it rather than
      // through the local formula rewriter.
      apply: (edit) => {
        // A sheet keys its formats, sizes, hidden lines and comments by
        // position, so they have to move with the cells: a band on row 5
        // belongs to the cells that were on row 5, which an insert above
        // has just made row 6. The document moves all of them in one place;
        // the grid then shows the active sheet's sizes from the document.
        const sheet = wb.active
        stashLive(sheet)
        doc.shift(sheet, edit)
        wb.applyStructuralEdit(sheet, edit)
        applyLive(sheet)
        marquee = null
        changed({ kind: 'structure', sheet, edit })
      },
      // The workbook rewrites every sheet's references (and the defined
      // names) in applyStructuralEdit; the command must not do it as well.
      rewritesReferences: true,
      names: wb.names,
      format: { store, lookup },
      onChange: bump,
      // The whole workbook and every sheet's formats: a structural edit
      // rewrites references on other sheets too, so nothing smaller is a
      // faithful "before".
      // Sizes and hidden lines are the sheet's too: an insert moves them
      // along with their rows and columns, so the undo has to move them back.
      // The whole document: a structural edit rewrites references on other
      // sheets too, so nothing smaller is a faithful "before".
      snapshot: () => getState(),
      restore: (state) => {
        doc.setState(state as SheetState)
        targetsBoundTo = wb.active
        registerSheetTargets()
        applyLive(wb.active)
      },
    })
  }

  $effect(() => {
    setWorkbook(wb, () => {
      // A sheet switch moves the whole viewport, so the active cell goes home
      // rather than pointing at a cell that may not exist on the new sheet.
      active = { rowIndex: 0, colIndex: 0 }
      bump()
    }, (name) => doc.get(name).sheetHidden)
    registerSheetTargets()
    setFindTarget({
      getRaw: (r, c) => wb.getRaw(wb.active, r, c),
      getDisplay: (r, c) => display(r, c).text,
      // Through the grid, so a replacement is in the history: Replace All
      // runs in one batch and comes back as one Ctrl+Z.
      setRaw: (r, c, text) => {
        const cmd = cmdOf()
        if (cmd) cmd.setCellValue(r, c, text)
        else wb.setRaw(wb.active, r, c, text)
      },
      // Replace skips a locked cell on a protected sheet; Find still finds it.
      isEditable: (r, c) => !locked(r, c),
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
    setFindReplaceHandler((context) => delegate('find-replace', context))
    setFormatDialogHandler((context) => delegate('format-cells', context))
    setPasteSpecialHandler((context) => delegate('paste-special', context))
    // The keys the ribbon's tooltips promise. Ctrl+T falls through unless
    // the application answers Insert > Table.
    setRibbonActionHandler((action, context) => {
      if (action === 'insert-table' && !extras.includes('insert-table')) return false
      handleAction(action, context)
      return true
    })
    // So AutoSum measures its run against evaluated values: a column of
    // subtotals is a column of numbers, not a column of "=SUM(...)" strings.
    setSheetValueProbe((r, c) => wb.getValue(wb.active, r, c))
    return () => {
      setWorkbook(null)
      setFormatTarget(null)
      setStructureTarget(null)
      setFindTarget(null)
      setFillTranslator(null)
      setSheetValueProbe(null)
      setFindReplaceHandler(null)
      setFormatDialogHandler(null)
      setPasteSpecialHandler(null)
      setRibbonActionHandler(null)
    }
  })

  // --- reading a cell -------------------------------------------------------
  function raw(r: number, c: number): string {
    void version
    return wb.getRaw(wb.active, r, c)
  }

  function display(r: number, c: number, numFmt?: string): { text: string; color?: string } {
    void version
    const text = raw(r, c)
    if (showFormulas) return { text }
    const value: CellValue = wb.getValue(wb.active, r, c)
    if (isError(value)) return { text: value.error, color: 'var(--sg-danger, #dc2626)' }
    const entry = storeFor().get(`r${r}`, colToLetters(c))
    const fmt = numFmt ?? entry?.numFmt
    if (fmt) return compileNumberFormat(fmt).format(value)
    if (value === '' || value == null) return { text: '' }
    if (typeof value === 'boolean') return { text: value ? 'TRUE' : 'FALSE' }
    return { text: String(value) }
  }

  /**
   * Excel never shows part of a number: a figure wider than its column
   * reads as a run of # signs, so a truncated 1,234,567 can never be taken
   * for 1,234. Text is clipped or spills, as it is in Excel. Measured with
   * the cell's own font, since a bold or larger figure takes more room.
   *
   * A General cell (no number format) shrinks first, as Excel's does: the
   * decimals go one at a time (5.333333 reads 5.3333, then 5.33), and a
   * whole part too wide for the column turns scientific (1.76E+04) before
   * the hashes come. A formatted number never rounds itself: its format
   * said what to show, so it hashes as soon as that does not fit.
   */
  let hashMeasure: CanvasRenderingContext2D | null = null
  function hashesFor(text: string, c: number, entry: CellFormatEntry | undefined, r = -1, general?: number): string | null {
    if (!text) return null
    hashMeasure ??= document.createElement('canvas').getContext('2d')
    if (!hashMeasure) return null
    const size = entry?.fontSize ?? 13
    const family = entry?.fontFamily || (root ? getComputedStyle(root).fontFamily : 'sans-serif')
    hashMeasure.font = `${entry?.bold ? 'bold ' : ''}${size}px ${family}`
    const width = (r >= 0 ? cellWidth(r, c) : widthOf(c)) - 9
    const fits = (s: string) => hashMeasure!.measureText(s).width <= width
    if (fits(text)) return null
    if (general !== undefined && Number.isFinite(general)) {
      const decimals = (text.split('.')[1] ?? '').length
      for (let d = decimals - 1; d >= 0; d -= 1) {
        const s = String(Number(general.toFixed(d)))
        if (fits(s)) return s
      }
      for (let m = 5; m >= 0; m -= 1) {
        const [mantissa, exp] = general.toExponential(m).split('e')
        const e = Number(exp)
        const s = `${mantissa}E${e < 0 ? '-' : '+'}${String(Math.abs(e)).padStart(2, '0')}`
        if (fits(s)) return s
      }
    }
    const hash = hashMeasure.measureText('#').width || 8
    return '#'.repeat(Math.max(1, Math.floor(width / hash)))
  }

  const activeRaw = $derived.by(() => {
    void version
    return raw(active.rowIndex, active.colIndex)
  })

  /**
   * How far a cell's text may run past its right edge, in px; 0 for none.
   *
   * Excel lets text spill over EMPTY neighbours and clips it at the first
   * cell that holds something, so a title in A1 reads in full and a label
   * next to a number does not. Numbers never spill. The neighbours' widths
   * come from the grid, so a column the user dragged wider counts at its
   * real size; before the grid has mounted the configured widths stand in.
   */
  function spillWidth(r: number, c: number, value: CellValue, entry: CellFormatEntry | undefined): number {
    if (typeof value !== 'string' || value === '' || entry?.wrap) return 0
    // A merged cell is as wide as its merge already; the text stays in it.
    if (sheetMergeAt(mergesNow(), r, c)) return 0
    if (entry?.align === 'right' || entry?.align === 'center') return 0
    // A fill stays inside its cell in Excel; letting the span grow would
    // drag the colour over the neighbours along with the text.
    if (entry?.fill) return 0
    let extra = 0
    for (let next = c + 1; next < colCount; next += 1) {
      if (wb.getRaw(wb.active, r, next) !== '') break
      extra += widthOf(next)
    }
    return extra
  }

  /**
   * An entry from the formula bar goes through the grid, not straight into
   * the workbook: `setCellValue` records the write, so Ctrl+Z walks it back
   * like an in-cell edit, and reports it to `onCellWritten`, where the
   * workbook takes it. The bar names the cell the edit started in, which is
   * not the active cell once the user has clicked elsewhere to finish.
   */
  function commit(text: string, cell: { rowIndex: number; colIndex: number }, via: 'enter' | 'blur' = 'enter') {
    if (locked(cell.rowIndex, cell.colIndex)) { refuse(); return }
    if (!admits(cell.rowIndex, cell.colIndex, text)) return
    const cmd = cmdOf()
    if (cmd) {
      cmd.batch(() => cmd.setCellValue(cell.rowIndex, cell.colIndex, balanceParens(text)))
      // Enter in the bar hands the sheet back, the cursor one row down, as
      // Excel does; a blur was a click that has placed the cursor already.
      if (via === 'enter') {
        const next = Math.min(cell.rowIndex + 1, rowCount - 1)
        cmd.setActiveCell(next, cell.colIndex)
        cmd.setSelection(next, cell.colIndex)
        cmd.scrollIntoView(next, cell.colIndex)
        focusSheet(cmd)
      }
      return
    }
    wb.setRaw(wb.active, cell.rowIndex, cell.colIndex, balanceParens(text))
    bump()
  }

  /**
   * The Name Box's address: B9 and Enter put the cursor on B9 and hand focus
   * back to the sheet, so the next keystroke edits it, as in Excel. The grid
   * is told, not the shell's own `active`, which only ever follows the grid;
   * setting it alone moved the Name Box's label and nothing else.
   */
  function goTo(cell: { rowIndex: number; colIndex: number }) {
    const cmd = cmdOf()
    if (!cmd) return
    cmd.setActiveCell(cell.rowIndex, cell.colIndex)
    cmd.setSelection(cell.rowIndex, cell.colIndex)
    cmd.scrollIntoView(cell.rowIndex, cell.colIndex)
    active = cell
    cmd.focus()
  }

  /**
   * The Name Box picked a defined name: select what it refers to, switching
   * sheets first when it lives on another one. Excel does the same, and a
   * name that only worked on the sheet it was defined on would not be worth
   * listing.
   */
  async function jumpToName(name: string) {
    const node = wb.names.resolve(name)
    if (!node) return
    const from = node.k === 'ref' ? node.ref : node.k === 'range' ? node.from : null
    const to = node.k === 'range' ? node.to : from
    if (!from || from.row === null) return
    const target = from.sheet ?? wb.active
    if (target.toLowerCase() !== wb.active.toLowerCase()) {
      if (!wb.sheets.some((s) => s.toLowerCase() === target.toLowerCase())) return
      wb.setActive(target)
      bump()
      // The grid rebuilds its rows from the new sheet on the next render;
      // a selection set before that would land on the old ones.
      await tick()
    }
    const cmd = api?.getCommandContext()
    if (!cmd) return
    // Both: the selection is the highlighted range, the active cell is the
    // one the next keystroke edits and the formula bar shows. A jump that
    // set only the range left the grid's active cell where it was, so the
    // Name Box read B9 while typing went into A1.
    cmd.setActiveCell(from.row, from.col)
    cmd.setSelection(from.row, from.col)
    if (to && to.row !== null && (to.row !== from.row || to.col !== from.col)) {
      cmd.extendSelection(to.row, to.col)
    }
    cmd.scrollIntoView(from.row, from.col)
    active = { rowIndex: from.row, colIndex: from.col }
    // Focus was in the Name Box; typing now goes into the cell just reached.
    cmd.focus()
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

  /** Excel's status bar prints with thousands separators and two decimals at most. */
  const money = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })

  /**
   * Excel shades the header of every column and row the selection touches.
   * The row side is CSS (the row number cell can see its own row's cells);
   * the column headers cannot see the cells beneath them, so the letters
   * touched by the selection are marked here, after the grid has painted.
   */
  let root = $state<HTMLDivElement | null>(null)
  $effect(() => {
    void version
    const rects = selection.length
      ? selection
      : [[active.rowIndex, active.colIndex, active.rowIndex, active.colIndex] as const]
    const cols = new Set<string>()
    // The grid selects a merge whole, so the shading covers its columns too.
    for (const rect of rects) {
      const [, minCol, , maxCol] = expandToMerges(mergesNow(), [rect[0], rect[1], rect[2], rect[3]])
      for (let c = minCol; c <= maxCol; c += 1) cols.add(colToLetters(c))
    }
    const host = root
    if (!host) return
    // Excel paints the letter of a column selected whole (and the number of
    // a row selected whole) in the accent, white on green, and only tints
    // one the selection merely touches.
    const wholeCols = new Set<string>()
    const wholeRows = new Set<number>()
    for (const rect of rects) {
      const [r1, c1, r2, c2] = expandToMerges(mergesNow(), [rect[0], rect[1], rect[2], rect[3]])
      if (r1 === 0 && r2 >= rowCount - 1) for (let c = c1; c <= c2; c += 1) wholeCols.add(colToLetters(c))
      if (c1 === 0 && c2 >= colCount - 1) for (let r = r1; r <= r2; r += 1) wholeRows.add(r)
    }
    const paint = () => {
      for (const th of host.querySelectorAll<HTMLElement>('th[data-svgrid-header-col]')) {
        const letter = th.dataset.svgridHeaderCol ?? ''
        th.classList.toggle('sheet-col-selected', cols.has(letter))
        th.classList.toggle('sheet-col-whole', wholeCols.has(letter))
      }
      for (const td of host.querySelectorAll<HTMLElement>('td.sv-grid-row-number-cell')) {
        const row = td.parentElement?.querySelector<HTMLElement>('td[data-svgrid-row]')?.dataset.svgridRow
        td.classList.toggle('sheet-row-whole', row !== undefined && wholeRows.has(Number(row)))
      }
    }
    const frame = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(frame)
  })

  // --- the grid -------------------------------------------------------------
  const features = tableFeatures({})

  const columns = $derived.by<GridColumns<SheetRow>>(() =>
    Array.from({ length: colCount }, (_, c) => ({
      id: colToLetters(c),
      // `field` is what makes the cell writable and readable by everything
      // else: the inline editor, the fill handle, the clipboard, and the
      // command context the shortcuts and the ribbon run against.
      field: colToLetters(c),
      header: colToLetters(c),
      width: columnWidths?.[colToLetters(c)] ?? columnWidth,
      headerAlign: 'center' as const,
      // A locked cell on a protected sheet is read-only to the grid's own
      // editor, fill handle, Delete and paste, and to every command that
      // asks `cmd.canEdit`.
      // A covered cell of a merge is not a cell to write into either.
      editable: (ctx: { row: { original: SheetRow } }) => !locked(ctx.row.original.index, c) && !covered(ctx.row.original.index, c),
      // Hovering a commented cell shows the comment, as Excel does.
      tooltip: (ctx: { row: { original: SheetRow } }) => commentAt(notesNow(), ctx.row.original.index, c) ?? null,
      // A typed entry is checked against the cell's validation rule before
      // it lands; handing the old value back is how the grid writes nothing.
      valueParser: (params: { newValue: unknown; oldValue: unknown; rawInput: string; data: SheetRow }) =>
        admits(params.data.index, c, params.rawInput) ? params.newValue : params.oldValue,
      // Editing a cell edits its FORMULA, the way F2 does in Excel, which is
      // why the editor is plain text over the raw value rather than a typed
      // editor over the computed one.
      editorType: 'text' as const,
      // Alt+Enter puts a line break in the cell, as in Excel; Enter still
      // commits.
      editorMultiline: true,
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
      case 'toggle-gridlines':
        if (onAction?.(action, context) === true) return
        gridlinesOn = !gridlinesOn
        focusSheet(context)
        return
      case 'toggle-formula-bar':
        if (onAction?.(action, context) === true) return
        formulaBarOn = !formulaBarOn
        focusSheet(context)
        return
      case 'toggle-headings':
        if (onAction?.(action, context) === true) return
        headingsOn = !headingsOn
        focusSheet(context)
        return
      case 'toggle-ribbon':
        if (onAction?.(action, context) === true) return
        ribbonCollapsed = !ribbonCollapsed
        focusSheet(context)
        return
      case 'toggle-filter':
        if (onAction?.(action, context) === true) return
        toggleAutoFilter(context)
        focusSheet(context)
        return
      case 'sort-asc':
      case 'sort-desc':
        if (onAction?.(action, context) === true) return
        sortRegion(action === 'sort-asc' ? 'asc' : 'desc')
        return
      case 'paste-values':
      case 'paste-formulas':
      case 'paste-formats':
      case 'paste-transpose':
        if (onAction?.(action, context) === true) return
        pasteSpecial(
          action === 'paste-transpose' ? { transpose: true } : { what: action.slice('paste-'.length) as PasteWhat },
        )
        return
      case 'format-painter':
        if (onAction?.(action, context) === true) return
        if (painter) painter = null
        else armPainter()
        focusSheet(context)
        return
      case 'row-height':
      case 'column-width':
        if (onAction?.(action, context) === true) return
        openSizeDialog(action === 'row-height' ? 'rows' : 'cols')
        return
      case 'protect-sheet':
      case 'unprotect-sheet':
        if (onAction?.(action, context) === true) return
        setProtected(action === 'protect-sheet', context)
        focusSheet(context)
        return
      case 'new-comment':
      case 'edit-comment':
        if (onAction?.(action, context) === true) return
        openCommentEditor(active.rowIndex, active.colIndex)
        return
      case 'delete-comment':
        if (onAction?.(action, context) === true) return
        if (cellPopover) closeCellPopover(false)
        if (commentAt(notesNow(), active.rowIndex, active.colIndex) !== undefined) setComment(active.rowIndex, active.colIndex, '')
        focusSheet(context)
        return
      case 'prev-comment':
      case 'next-comment':
        if (onAction?.(action, context) === true) return
        walkComments(action === 'next-comment' ? 1 : -1)
        return
      case 'toggle-comments':
        if (onAction?.(action, context) === true) return
        showComments = !showComments
        focusSheet(context)
        return
      case 'open-list':
        if (onAction?.(action, context) === true) return
        // Alt+Down on an AutoFilter header cell drops the filter menu, as in
        // Excel; anywhere else it drops the cell's validation list.
        if (filterArrowAt(active.rowIndex, active.colIndex)) { openFilterMenu(active.colIndex); return }
        openListPicker(active.rowIndex, active.colIndex)
        return
      case 'cf-greater': case 'cf-less': case 'cf-between': case 'cf-equal': case 'cf-text': case 'cf-duplicates':
      case 'cf-top10': case 'cf-bottom10': case 'cf-above-average': case 'cf-below-average':
      case 'cf-data-bar': case 'cf-color-scale-3': case 'cf-color-scale-2': case 'cf-icon-set':
      case 'cf-clear-selection': case 'cf-clear-sheet': case 'cf-manage':
        if (onAction?.(action, context) === true) return
        cfAction(action, context)
        return
      case 'merge-center':
      case 'merge-across':
      case 'merge-cells':
        if (onAction?.(action, context) === true) return
        runMerge(action === 'merge-center' ? 'center' : action === 'merge-across' ? 'across' : 'cells', context)
        return
      case 'unmerge-cells':
        if (onAction?.(action, context) === true) return
        runUnmerge(context)
        return
      case 'toggle-lock': {
        if (onAction?.(action, context) === true) return
        // Excel's Lock Cell: every cell of the selection takes the state
        // the active cell does not have. Refused on a protected sheet, as
        // any format is.
        const wasLocked = isLocked(storeFor().get(`r${active.rowIndex}`, colToLetters(active.colIndex)))
        applyFormat(context, { locked: wasLocked ? false : undefined })
        focusSheet(context)
        return
      }
      case 'autofit-rows':
      case 'autofit-columns':
        if (onAction?.(action, context) === true) return
        autofitLines(action === 'autofit-rows' ? 'rows' : 'cols', context)
        focusSheet(context)
        return
      case 'hide-rows':
      case 'hide-columns':
      case 'unhide-rows':
      case 'unhide-columns': {
        if (onAction?.(action, context) === true) return
        hideLines(action.endsWith('rows') ? 'rows' : 'cols', action.startsWith('hide'), context)
        focusSheet(context)
        return
      }
      case 'freeze-panes':
      case 'freeze-top-row':
      case 'freeze-first-column':
      case 'unfreeze-panes': {
        if (onAction?.(action, context) === true) return
        // Excel keeps the panes per sheet: what is frozen on Orders says
        // nothing about Summary, and comes back with Orders.
        const before = doc.get(wb.active).freeze
        const put = (state: FreezeState) => {
          applyFreeze(context, state)
          doc.get(wb.active).freeze = state
          changed({ kind: 'freeze' })
        }
        const state = action === 'freeze-panes'
          ? freezeAtActiveCell(context)
          : action === 'freeze-top-row' ? freezeTopRow(context)
          : action === 'freeze-first-column' ? freezeFirstColumn(context)
          : applyFreeze(context, { rows: 0, cols: 0 })
        doc.get(wb.active).freeze = state
        changed({ kind: 'freeze' })
        context.recordUndo(() => put(before), () => put(state))
        focusSheet(context)
        return
      }
      default:
        delegate(action, context)
    }
  }

  /** The ribbon leaves off what nobody answers. */
  const without = $derived.by<RibbonActionId[]>(() => {
    const all: Array<'insert-table' | 'insert-chart'> = ['insert-table', 'insert-chart']
    const out: RibbonActionId[] = all.filter((a) => !extras.includes(a))
    // Protect Sheet and Unprotect Sheet share one slot on the Review tab.
    out.push(isProtected ? 'protect-sheet' : 'unprotect-sheet')
    return out
  })

  // --- Sort A to Z / Z to A ---------------------------------------------------
  /**
   * Excel's Data > Sort A to Z: the rows of the current region, or of the
   * selection when it is a range, ordered by the active cell's column.
   * Numbers come before text and blanks stay last either way; a header row
   * (text over numbers) stays where it is. Values, formulas and formats
   * move together, as one undo. Formulas are moved as they are, which is
   * what Excel does too.
   */
  /**
   * The block a sort works on: the selection when it is a range, else the
   * current region around the active cell, clipped to the used sheet.
   */
  function sortBlock(over?: { rect: Rect }): { top: number; left: number; bottom: number; right: number } | null {
    const cmd = cmdOf()
    if (!cmd || !cmd.activeCell) return null
    const last = selection[selection.length - 1]
    const isRange = last && (last[0] !== last[2] || last[1] !== last[3])
    const rect = over ? over.rect : isRange ? last : currentRegion(gridOf(cmd), { row: active.rowIndex, col: active.colIndex })
    const top = rect[0]
    const left = rect[1]
    const bottom = Math.min(rect[2], Math.max(wb.rowCount(wb.active) - 1, top))
    const right = Math.min(rect[3], Math.max(wb.colCount(wb.active) - 1, left))
    return { top, left, bottom, right }
  }

  /** Sort A to Z / Z to A on the active cell's column, or a filter's. */
  function sortRegion(direction: 'asc' | 'desc', over?: { rect: Rect; keyCol: number }) {
    const block = sortBlock(over)
    if (!block) return
    const keyCol = Math.min(Math.max(over?.keyCol ?? active.colIndex, block.left), block.right)
    // An AutoFilter's region has its header in row 1 by definition.
    const headerRow = over ? true : guessHeaderRow((r, c) => wb.getValue(wb.active, r, c), block.top, keyCol)
    sortBy(block, [{ col: keyCol, direction }], headerRow)
  }

  /** Sort the block by the keys in order, one undo; the Sort dialog's OK. */
  function sortBy(block: { top: number; left: number; bottom: number; right: number }, keys: ReadonlyArray<SortKey>, headerRow: boolean) {
    const cmd = cmdOf()
    const target = getFormatTarget()
    if (!cmd || !cmd.activeCell || !target || !keys.length) return
    const r1 = block.top
    const c1 = block.left
    const r2 = block.bottom
    const c2 = block.right
    if (r2 <= r1) return
    if (protectedNow()) { refuse(); return }
    if (sortBlockedByMerges(mergesNow(), [r1, c1, r2, c2])) {
      say('To do this, all the merged cells need to be the same size.')
      return
    }
    const valueAt = (r: number, c: number) => wb.getValue(wb.active, r, c)
    const start = headerRow ? r1 + 1 : r1
    if (r2 <= start) return
    const rows = Array.from({ length: r2 - start + 1 }, (_, i) => start + i)
    const order = sortOrder(rows, keys, valueAt)
    if (order.every((r, i) => r === rows[i])) return
    const store = target.store
    const before = rows.map((r) => ({
      raw: Array.from({ length: c2 - c1 + 1 }, (_, i) => wb.getRaw(wb.active, r, c1 + i)),
      formats: Array.from({ length: c2 - c1 + 1 }, (_, i) => store.get(`r${r}`, colToLetters(c1 + i))),
    }))
    cmd.batch(() => {
      withFormatUndo(cmd, target, [[start, c1, r2, c2]], () => {
        order.forEach((source, i) => {
          const row = start + i
          const from = before[source - start]!
          for (let k = 0; k <= c2 - c1; k += 1) {
            const c = c1 + k
            cmd.setCellValue(row, c, from.raw[k])
            const one = [[row, c, row, c] as const]
            store.clear(one, target.lookup)
            if (from.formats[k]) store.set(one, from.formats[k]!, target.lookup)
          }
        })
      })
      // A one-row merge in the region rides with its row.
      if (mergesIn(mergesNow(), [[start, c1, r2, c2]]).length) {
        const rowFor = (oldRow: number) => { const i = order.indexOf(oldRow); return i < 0 ? oldRow : start + i }
        setMerges(reorderMerges(mergesNow(), [start, c1, r2, c2], rowFor))
      }
    })
    cmd.setSelection(r1, c1)
    cmd.extendSelection(r2, c2)
    bump()
    fitWrappedRows()
  }

  // --- what the Data tab's dialogs report -------------------------------------
  /** A sentence in the status bar's Ready slot for a few seconds, the way
   *  Excel's dialogs end on one ("3 duplicate values found and removed"). */
  let statusMessage = $state<string | null>(null)
  let statusTimer: ReturnType<typeof setTimeout> | null = null
  function say(message: string) {
    statusMessage = message
    if (statusTimer) clearTimeout(statusTimer)
    statusTimer = setTimeout(() => (statusMessage = null), 8000)
  }

  // --- the dialogs ----------------------------------------------------------
  /**
   * Find and Replace, Paste Special, Format Cells and Insert Function are the
   * shell's own. The consumer hears about every action first and can take
   * one over by returning true; otherwise the dialog opens here, so Ctrl+1
   * and the launcher in the corner of the Font group do what Excel's do
   * without the application writing a dialog.
   */
  let findOpen = $state(false)
  let pasteSpecialOpen = $state(false)
  let formatCellsOpen = $state(false)
  let insertFunctionOpen = $state(false)
  let nameManagerOpen = $state(false)
  let goalSeekOpen = $state(false)
  let textToColumnsOpen = $state(false)
  let removeDuplicatesOpen = $state(false)
  /** The Sort dialog, with the block it opens over. */
  let sortDialog = $state<{ block: { top: number; left: number; bottom: number; right: number }; headerGuess: boolean } | null>(null)

  function delegate(action: RibbonActionId, context: GridCommandContext) {
    if (onAction?.(action, context) === true) return
    switch (action) {
      case 'find-replace': findOpen = true; return
      case 'paste-special': pasteSpecialOpen = true; return
      case 'format-cells': formatCellsOpen = true; return
      case 'insert-function': insertFunctionOpen = true; return
      case 'name-manager': nameManagerOpen = true; return
      case 'goal-seek': goalSeekOpen = true; return
      case 'text-to-columns': textToColumnsOpen = true; return
      case 'remove-duplicates': removeDuplicatesOpen = true; return
      case 'sort-custom': {
        const block = sortBlock()
        if (!block || block.bottom <= block.top) { say('Select a block with more than one row to sort.'); return }
        const keyCol = Math.min(Math.max(active.colIndex, block.left), block.right)
        sortDialog = { block, headerGuess: guessHeaderRow((r, c) => wb.getValue(wb.active, r, c), block.top, keyCol) }
        return
      }
      case 'data-validation': dataValidationOpen = true; return
      case 'file-new':
        if (documentHasContent()) newConfirm = true
        else newWorkbook()
        return
      case 'file-open': fileInput?.click(); return
      case 'file-save-xlsx': void saveXlsx(); return
      case 'file-export-csv': {
        try {
          downloadBlobFile(new Blob([toCsv()], { type: 'text/csv;charset=utf-8' }), `${wb.active}.csv`)
        } catch (e) {
          say(e instanceof Error ? e.message : 'Could not export the sheet.')
        }
        return
      }
      case 'circle-invalid': {
        circlesOn = wb.active
        bump()
        const count = circled.size
        say(count === 0 ? 'No invalid data was found.' : `${count} ${count === 1 ? 'cell breaks' : 'cells break'} a validation rule.`)
        return
      }
      case 'clear-circles': circlesOn = null; bump(); return
    }
  }

  /** A dialog wrote and closed: repaint, say what it did, take focus back. */
  function afterDialog(message?: string) {
    bump()
    if (message) say(message)
    const c = cmdOf()
    if (c) focusSheet(c)
  }

  /** The active cell's format, what Format Cells opens on. */
  const activeEntry = $derived.by(() => {
    void version
    return storeFor().get(`r${active.rowIndex}`, colToLetters(active.colIndex))
  })
  const activeValue = $derived.by(() => {
    void version
    return wb.getValue(wb.active, active.rowIndex, active.colIndex)
  })
  /** The rule at the active cell, what Data Validation opens on. */
  const activeRule = $derived.by(() => { void version; return ruleAt(rulesNow(), active.rowIndex, active.colIndex) })
  /** The selection as A1, for the dialog's heading. */
  const selectionAddress = $derived.by(() => {
    void version
    void selection
    void active
    const rects = selectedRects()
    return rects.map(([r1, c1, r2, c2]) => {
      const a = `${colToLetters(Math.min(c1, c2))}${Math.min(r1, r2) + 1}`
      const b = `${colToLetters(Math.max(c1, c2))}${Math.max(r1, r2) + 1}`
      return a === b ? a : `${a}:${b}`
    }).join(', ')
  })
  /** Whether the selection mixes locked and unlocked cells, for the Protection tab. */
  const mixedLocked = $derived.by(() => {
    void version
    void selection
    void active
    return rectsMixLocked(storeFor(), lookup, selectedRects())
  })

  function applyFormatCells(patch: CellFormatEntry, border: BorderPreset | null) {
    const cmd = cmdOf()
    if (!cmd) return
    cmd.batch(() => {
      if (Object.keys(patch).length) applyFormat(cmd, patch)
      if (border) applyBorders(cmd, border)
    })
    bump()
    focusSheet(cmd)
  }

  /** Excel's Insert Function: the cell starts on =NAME( and the caret waits inside. */
  function insertFunction(name: string) {
    const cmd = cmdOf()
    if (!cmd) return
    const { rowIndex, colIndex } = active
    // After the dialog has closed and given focus back: an editor opened
    // before that would lose the focus to the dialog's restore.
    void tick().then(() => cmd.startEditing(rowIndex, colIndex, `=${name}(`))
  }

  /**
   * Land a block of cells on the selection. Ctrl+V, Paste Special and a
   * paste from another application all come through here, so they agree:
   * a block that fits the selection a whole number of times is repeated
   * over it (one copied cell fills the range, as in Excel), otherwise it
   * lands at the selection's top-left corner and keeps its shape. `origin`
   * is where a copy came from, so its formulas move with the paste; a cut
   * block is moved rather than translated and a foreign one has nowhere to
   * have moved from, so both pass null. Values and formats are one undo.
   */
  function pasteBlock(grid: ClipboardGrid, origin: { row: number; col: number } | null, opts: PasteSpecialOptions): boolean {
    const cmd = cmdOf()
    const target = getFormatTarget()
    if (!cmd || !target) return false
    const last = selection[selection.length - 1]
    const dest = {
      row: last ? Math.min(last[0], last[2]) : active.rowIndex,
      col: last ? Math.min(last[1], last[3]) : active.colIndex,
    }
    const fill = last
      ? { rows: Math.abs(last[2] - last[0]) + 1, cols: Math.abs(last[3] - last[1]) + 1 }
      : undefined
    const plan = planPaste(grid, dest, opts, origin, fill)
      .filter((entry) => entry.row < rowCount && entry.col < colCount)
    if (!plan.length) return false
    // A protected sheet refuses the whole paste when it reaches a locked
    // cell, as Excel does; handled, so the grid does not paste the text.
    if (protectedNow() && plan.some((entry) => locked(entry.row, entry.col))) { refuse(); return true }
    const landing = plan.filter((entry) => !covered(entry.row, entry.col))
    const rects: Array<readonly [number, number, number, number]> = []
    for (const entry of landing) rects.push([entry.row, entry.col, entry.row, entry.col])
    pasting = true
    try {
      cmd.batch(() => {
        withFormatUndo(cmd, target, rects, () => {
          for (const entry of landing) {
            const at = { row: entry.row, col: entry.col }
            const decision = resolvePasteCell(entry.source, wb.getValue(wb.active, entry.row, entry.col), opts, entry.offset, at)
            if (decision.kind === 'skip') continue
            const one = [[entry.row, entry.col, entry.row, entry.col] as const]
            if (decision.kind === 'value' || decision.kind === 'both') cmd.setCellValue(entry.row, entry.col, decision.value)
            if (decision.kind === 'format' || decision.kind === 'both') {
              if (decision.format) target.store.set(one, decision.format, target.lookup)
              else target.store.clear(one, target.lookup)
            }
          }
        })
      })
    } finally {
      pasting = false
    }
    // A cut is moved once; Excel's ants go with it.
    if (origin === null) marquee = null
    bump()
    return true
  }

  function pasteSpecial(opts: PasteSpecialOptions) {
    const cmd = cmdOf()
    const block = copied
    if (!cmd || !block) return
    if (pasteBlock(copiedGrid(block, 'plain'), block.cut ? null : block.origin, opts)) focusSheet(cmd)
  }

  /** A dialog took focus; the sheet gets it back once the dialog has gone. */
  function focusSheet(cmd: GridCommandContext) {
    void tick().then(() => cmd.focus())
  }

  const activeActions = $derived.by<ReadonlyArray<RibbonActionId>>(() => {
    // Under `version`: the filter and the lock live in the document, which
    // is not state of its own, and a derived that only reads another derived
    // (activeEntry) is not re-run while that one's value stays the same.
    // Under `selection` too: the ribbon re-reads every toggle (Bold on a
    // range that is all bold) when this array changes, and a Shift+Arrow
    // moves the range without moving the active cell.
    void version
    void selection
    const on: RibbonActionId[] = []
    if (showFormulas) on.push('toggle-formulas')
    if (autoFilterNow()) on.push('toggle-filter')
    if (painter) on.push('format-painter')
    // Lock Cell lights while the active cell is locked, which every cell is
    // until unlocked: Excel's menu reads the same way.
    if (isLocked(activeEntry)) on.push('toggle-lock')
    if (showComments) on.push('toggle-comments')
    if (gridlinesOn) on.push('toggle-gridlines')
    if (formulaBarOn) on.push('toggle-formula-bar')
    if (headingsOn) on.push('toggle-headings')
    // Merge & Center lights while the active cell is merged, as in Excel.
    if (sheetMergeAt(mergesNow(), active.rowIndex, active.colIndex)) on.push('merge-center')
    return on
  })

  // --- Format Painter ---------------------------------------------------------
  /**
   * Excel's brush: the formats of the selection are picked up, the cursor
   * becomes a brush, and the next selection takes them: a single cell takes
   * the whole block from that corner, a range has the block tiled over it,
   * and a destination cell whose source had no format loses its own. One
   * undo. Escape, or the button again, puts the brush down.
   */
  type Painter = { rows: number; cols: number; entries: Array<Array<CellFormatEntry | undefined>> }
  let painter = $state<Painter | null>(null)
  function armPainter() {
    const target = getFormatTarget()
    if (!target) return
    const last = selection[selection.length - 1]
    const [r1, c1, r2, c2] = last ?? [active.rowIndex, active.colIndex, active.rowIndex, active.colIndex]
    const entries: Painter['entries'] = []
    for (let r = r1; r <= r2; r += 1) {
      const line: Array<CellFormatEntry | undefined> = []
      for (let c = c1; c <= c2; c += 1) {
        const rowId = target.lookup.rowIdAt(r)
        const columnId = target.lookup.columnIdAt(c)
        line.push(rowId != null && columnId != null ? target.store.get(rowId, columnId) : undefined)
      }
      entries.push(line)
    }
    painter = { rows: r2 - r1 + 1, cols: c2 - c1 + 1, entries }
    say('Select where to paste the format, or press Esc')
  }
  function paintFormats() {
    const src = painter
    const cmd = cmdOf()
    const target = getFormatTarget()
    painter = null
    if (!src || !cmd || !target) return
    const last = selection[selection.length - 1]
    let [r1, c1, r2, c2] = last ?? [active.rowIndex, active.colIndex, active.rowIndex, active.colIndex]
    if (r1 === r2 && c1 === c2) {
      r2 = Math.min(r1 + src.rows - 1, rowCount - 1)
      c2 = Math.min(c1 + src.cols - 1, colCount - 1)
    }
    const rect = [r1, c1, r2, c2] as const
    withFormatUndo(cmd, target, [rect], () => {
      target.store.clear([rect], target.lookup)
      for (let r = r1; r <= r2; r += 1) {
        for (let c = c1; c <= c2; c += 1) {
          const entry = src.entries[(r - r1) % src.rows]?.[(c - c1) % src.cols]
          if (entry) target.store.set([[r, c, r, c]], entry, target.lookup)
        }
      }
    })
    bump()
    fitWrappedRows()
    statusMessage = null
  }
  /** The brush lands on the release of the selecting click or drag. */
  function onSheetPointerUp(event: PointerEvent) {
    if (!painter) return
    const el = event.target as HTMLElement | null
    if (!el?.closest('td.sv-grid-cell')) return
    // After the grid has taken the click: the selection it sets is what
    // the brush paints.
    setTimeout(paintFormats, 0)
  }
  function onSheetKeyDownCapture(event: KeyboardEvent) {
    acceptSuggestion(event)
    if (protectedNow() && !editorOf(event.target) && wouldEdit(event) && locked(active.rowIndex, active.colIndex)) refuse()
    if (event.key === 'Escape' && marquee && !editorOf(event.target)) marquee = null
    // Excel's Enter while the ants are up: paste the block once, here, and
    // leave copy mode. Ctrl+V pastes and keeps the ants for the next paste;
    // Enter is the key that pastes and drops them.
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
      && marquee && marquee.sheet === wb.active && copied && !editorOf(event.target) && !painter) {
      event.preventDefault()
      event.stopPropagation()
      const block = copied
      pasteBlock(copiedGrid(block, 'plain'), block.cut ? null : block.origin, { what: 'all' })
      marquee = null
      return
    }
    if (!painter) return
    if (event.key === 'Escape') { painter = null; statusMessage = null; event.preventDefault(); return }
    if (event.key === 'Enter' && !editorOf(event.target)) { event.preventDefault(); paintFormats() }
  }

  /**
   * One funnel for every write into the grid, whoever made it.
   *
   * Inline edits, the fill handle, paste and each sheet command all land in
   * the grid's own `writeCellRaw`, which reports here. Catching them in one
   * place is what keeps the workbook authoritative: without it a fill would
   * update the projection and leave the engine holding the old values, so
   * the totals would silently stop matching the cells they add up.
   */
  function onCellWritten(change: { rowIndex: number; columnId: string; oldValue?: unknown; newValue: unknown }) {
    // An entry the validation refused comes through with the old value as
    // the new one; nothing changed and nothing follows from it.
    if (change.oldValue !== undefined && change.oldValue === change.newValue) return
    const ref = parseA1(`${change.columnId}1`)
    if (!ref) return
    const text = balanceParens(change.newValue == null ? '' : String(change.newValue))
    if (copied?.fresh && text === '' && !copied.cut) {
      const dr = change.rowIndex - copied.origin.row
      const dc = ref.col - copied.origin.col
      if (copied.cells[dr]?.[dc]) copied.cut = true
    } else if (!pasting) {
      marquee = null
    }
    formulaDraft = null
    const r = change.rowIndex
    const c = ref.col
    // A typed 12% is the number 0.12 shown as a percentage, as it is in
    // Excel: the value lands as a number and the cell takes the format the
    // entry implied, unless it already has one of its own. A line break
    // typed with Alt+Enter turns on Wrap Text, as Excel's does.
    let stored = text
    const target = getFormatTarget()
    const cmd = cmdOf()
    const entry = storeFor().get(`r${r}`, colToLetters(c))
    const patch: CellFormatEntry = {}
    const parsed = parseEntry(text)
    if (parsed) {
      stored = parsed.value
      if (!entry?.numFmt) patch.numFmt = parsed.numFmt
    }
    if (text.includes('\n') && !entry?.wrap) patch.wrap = true
    if (Object.keys(patch).length && target && cmd) {
      // Inside the grid's own history group for this write, so the value and
      // the format it implied come back together on one Ctrl+Z.
      withFormatUndo(cmd, target, [[r, c, r, c]], () => target.store.set([[r, c, r, c]], patch, target.lookup))
    }
    if (wb.getRaw(wb.active, r, c) === stored) {
      if (patch.wrap) { bump(); fitWrappedRows() }
      return
    }
    wb.setRaw(wb.active, r, c, stored)
    bump()
    changed({ kind: 'cells' })
    if (patch.wrap || entry?.wrap) fitWrappedRows()
  }

  /**
   * Rows holding wrapped text grow to show it, as Excel's do. The wrapped
   * cells on screen are measured after the repaint; a row whose tallest
   * wrapped cell no longer needs the extra height gives it back, and a row
   * the user dragged is left alone.
   */
  function fitWrappedRows() {
    void tick().then(() => {
      if (!api || !root) return
      const tallest = new Map<number, number>()
      for (const span of root.querySelectorAll<HTMLElement>('.sheet-cell.wrap')) {
        const td = span.closest<HTMLElement>('td')
        const r = Number(td?.dataset.svgridRow)
        if (!Number.isInteger(r)) continue
        const needed = span.scrollHeight + 2
        if (needed > (tallest.get(r) ?? 0)) tallest.set(r, needed)
      }
      for (const [r, needed] of tallest) {
        const current = api.getRowHeight(r)
        if (needed > current) api.setRowHeight(r, needed)
      }
    })
  }

  // --- the clipboard --------------------------------------------------------
  /**
   * What Ctrl+C took, kept here as well as on the system clipboard. The
   * system clipboard gets the text each cell SHOWS, which is what another
   * application expects to receive; a paste back into the sheet wants the
   * formula, moved by the distance it travelled, and the cell's format,
   * which is what Excel pastes. The two are matched on paste: a clipboard
   * whose text is not what the copy showed came from somewhere else, and
   * is pasted for what it carries (see `pasteFromSystem`).
   *
   * A cut is a copy the grid clears straight after, in the same keystroke.
   * Excel moves a cut formula without translating it, so the clear that
   * lands while the copy is still fresh marks it as one.
   */
  type CopiedCell = { shown: string; raw: string; value: string; format: CellFormatEntry | undefined }
  type Copied = {
    origin: { row: number; col: number }
    cells: CopiedCell[][]
    fresh: boolean
    cut: boolean
  }
  // State, so Paste Special knows there is something to paste as soon as
  // Ctrl+C has run.
  let copied = $state<Copied | null>(null)
  /**
   * Excel's marching ants: the block Ctrl+C or Ctrl+X took, outlined by a
   * walking dashed line until Escape, a write into a cell, a structural
   * edit, the paste of a cut, or the next copy. A paste of a copy keeps it,
   * as Excel does, so the block can be pasted again. The block belongs to
   * the sheet it was copied on: another sheet shows nothing, and coming
   * back shows it again, as Excel's does.
   */
  let marquee = $state<{ sheet: string; rect: readonly [number, number, number, number] } | null>(null)
  /** The edges of the marquee a cell sits on, as class names; null off it. */
  function marqueeEdges(r: number, c: number): string | null {
    // The active sheet is not state; the switch bumps the version.
    void version
    const m = marquee
    if (!m || m.sheet !== wb.active) return null
    const [r1, c1, r2, c2] = m.rect
    if (r < r1 || r > r2 || c < c1 || c > c2) return null
    const edges: string[] = []
    if (r === r1) edges.push('top')
    if (r === r2) edges.push('bottom')
    if (c === c1) edges.push('left')
    if (c === c2) edges.push('right')
    return edges.length ? edges.join(' ') : null
  }
  /** Writes made by a paste keep the marquee; every other write clears it. */
  let pasting = false

  function toClipboard(params: { rowIndex: number; columnId: string }): unknown {
    const col = lettersToCol(params.columnId)
    const r = params.rowIndex
    if (col < 0) return ''
    const shown = display(r, col).text
    const rects = selection.length ? selection : [[r, col, r, col] as const]
    // The grid walks each rectangle top-left to bottom-right; the first
    // cell of the first one starts a new copy. Only the first rectangle is
    // kept, as Excel keeps only one.
    const [minRow, minCol, maxRow, maxCol] = rects[0]!
    if (r === minRow && col === minCol) {
      copied = { origin: { row: r, col }, cells: [], fresh: true, cut: false }
      queueMicrotask(() => { if (copied) copied.fresh = false })
      // A whole column or row is selected to Infinity; the ants stop at
      // the sheet's last line.
      marquee = { sheet: wb.active, rect: [minRow, minCol, Math.min(maxRow, rowCount - 1), Math.min(maxCol, colCount - 1)] }
    }
    if (copied && !copied.cut) {
      const dr = r - copied.origin.row
      const dc = col - copied.origin.col
      if (dr >= 0 && dc >= 0) {
        // Read back after the write: $state hands out a proxy of what was
        // assigned, and writing into the raw array would fill nothing.
        if (!copied.cells[dr]) copied.cells[dr] = []
        const line = copied.cells[dr]!
        line[dc] = { shown, raw: raw(r, col), value: plainValue(r, col), format: storeFor().get(`r${r}`, params.columnId) }
      }
    }
    return shown
  }

  /** The value behind a cell as text, unformatted: what Paste Values writes. */
  function plainValue(r: number, c: number): string {
    const value = wb.getValue(wb.active, r, c)
    if (isError(value)) return value.error
    if (value === '' || value == null) return ''
    return String(value)
  }

  const EMPTY_COPIED: CopiedCell = { shown: '', raw: '', value: '', format: undefined }

  /**
   * The copied block as clipboard cells. `plain` is what a paste writes:
   * the raw text of a constant, the value of a formula (Paste Values), the
   * formula itself beside it. `shown` is what another application gets:
   * the display text, with the number behind it for a spreadsheet.
   */
  function copiedGrid(block: Copied, text: 'plain' | 'shown'): ClipboardGrid {
    const width = block.cells.reduce((max, line) => Math.max(max, line.length), 0)
    return block.cells.map((line) =>
      Array.from({ length: width }, (_, i) => {
        const cell = line[i] ?? EMPTY_COPIED
        const formula = cell.raw.startsWith('=')
        const numeric = cell.value !== '' && Number.isFinite(Number(cell.value))
        return {
          text: text === 'shown' ? cell.shown : formula ? cell.value : cell.raw,
          ...(text === 'shown' && numeric ? { value: cell.value } : {}),
          ...(formula ? { formula: cell.raw } : {}),
          ...(cell.format ? { format: cell.format } : {}),
        }
      }),
    )
  }

  /** The text the grid put on the clipboard for this block. */
  function copiedText(block: Copied): string {
    return copiedGrid(block, 'shown').map((line) => line.map((cell) => cell.text).join('\t')).join('\n')
  }

  /**
   * The HTML half of a copy, built once the grid has walked the block and
   * `toClipboard` has filled it: what Excel and Sheets read our formats
   * and numbers from, and what a sheet in another tab reads the formulas
   * from.
   */
  function copiedHtml(): string | null {
    const block = copied
    if (!block || !block.cells.length) return null
    return buildClipboardPayload(copiedGrid(block, 'shown'), block.origin).html
  }

  /**
   * Ctrl+V. A clipboard still holding our last copy pastes the copied
   * block itself: formulas translated (or moved, after a cut), formats
   * with them. Anything else is read for what it carries: a table from
   * Excel, Sheets or another sheet brings its values, formulas and formats;
   * plain text is left to the grid, which lands it as typed.
   */
  function pasteFromSystem(payload: { text: string; html: string | null }): boolean | void {
    const block = copied
    const text = payload.text.replace(/\r\n/g, '\n').replace(/\n$/, '')
    if (block && block.cells.length && copiedText(block) === text) {
      return pasteBlock(copiedGrid(block, 'plain'), block.cut ? null : block.origin, { what: 'all' })
    }
    const grid = payload.html ? parseClipboardHtml(payload.html) : null
    if (!grid) return undefined
    const origin = readClipboardOrigin(payload.html!)
    // Our own marker says where the block came from; a foreign block's
    // formulas are kept only where they can be placed (see the helper).
    if (origin) return pasteBlock(grid, origin, { what: 'all' })
    const foreign = anchorForeignFormulas(grid)
    return pasteBlock(foreign.grid, foreign.origin, { what: 'all' })
  }

  // --- Excel's cell menu ----------------------------------------------------
  function withCmd(fn: (cmd: GridCommandContext) => void) {
    const c = cmdOf()
    if (!c) return
    fn(c)
    // The menu took focus; the sheet gets it back so Ctrl+Z is the next
    // keystroke that works, as after a ribbon click.
    queueMicrotask(() => c.focus())
  }

  /**
   * Right-click on a cell. The grid's own row items would splice its data
   * behind the workbook's back, so structure goes through the sheet's
   * insert / delete, which rewrite every formula the change reaches; Clear
   * Contents writes blanks as one undo step, as the keyboard's Delete does.
   */
  /** Whether the active cell carries a comment, for the menu's items. */
  const hasComment = () => commentAt(notesNow(), active.rowIndex, active.colIndex) !== undefined
  /** Whole rows, whole columns, or a block: what the menu's items are for. */
  const axis = (): 'rows' | 'cols' | 'ambiguous' => {
    const c = cmdOf()
    if (!c || !c.ranges.length) return 'ambiguous'
    return axisForSelection(c)
  }
  /** The menu's glyphs are the ribbon's, so the two read as one set. */
  const glyph = (name: RibbonIconName): ContextMenuIcon => ({ paths: RIBBON_ICONS[name] })
  const contextMenu: ContextMenuItem<SheetRow>[] = [
    // The grid's own Cut / Copy / Paste, with the ribbon's icons on them.
    { key: 'cut', icon: glyph('cut') },
    { key: 'copy', icon: glyph('copy') },
    { key: 'paste', icon: glyph('paste') },
    { key: 'paste-special', label: 'Paste Special...', icon: glyph('paste-special'), action: () => withCmd((c) => delegate('paste-special', c)) },
    'separator',
    // A column letter's menu says Insert and Delete, as Excel's does; a
    // cell's spells both axes out.
    { key: 'insert-rows', label: 'Insert Rows', icon: glyph('insert-cells'), hidden: () => axis() === 'cols', action: () => withCmd((c) => insertRows(c)) },
    { key: 'insert-columns', label: 'Insert Columns', icon: glyph('insert-cells'), hidden: () => axis() === 'rows', action: () => withCmd((c) => insertColumns(c)) },
    { key: 'delete-rows', label: 'Delete Rows', icon: glyph('delete-cells'), hidden: () => axis() === 'cols', action: () => withCmd((c) => deleteRows(c)) },
    { key: 'delete-columns', label: 'Delete Columns', icon: glyph('delete-cells'), hidden: () => axis() === 'rows', action: () => withCmd((c) => deleteColumns(c)) },
    'separator',
    {
      key: 'clear-contents', label: 'Clear Contents', icon: glyph('clear'),
      action: () => withCmd((c) => {
        const rects = c.ranges.length
          ? c.ranges
          : c.activeCell ? [[c.activeCell.rowIndex, c.activeCell.colIndex, c.activeCell.rowIndex, c.activeCell.colIndex] as const] : []
        if (protectedNow() && rectsHaveLocked(storeFor(), lookup, rects)) { refuse(); return }
        c.batch(() => {
          for (const [r1, c1, r2, c2] of rects) {
            for (let r = r1; r <= r2; r += 1) for (let col = c1; col <= c2; col += 1) c.setCellValue(r, col, '')
          }
        })
      }),
    },
    { key: 'clear-formats', label: 'Clear Formats', icon: glyph('clear-formats'), action: () => withCmd((c) => clearFormats(c)) },
    'separator',
    { key: 'merge-center', label: 'Merge & Center', icon: glyph('merge'), hidden: () => axis() !== 'ambiguous' || selectionHasMerge(), action: () => withCmd((c) => handleAction('merge-center', c)) },
    { key: 'unmerge-cells', label: 'Unmerge Cells', icon: glyph('unmerge'), hidden: () => axis() !== 'ambiguous' || !selectionHasMerge(), action: () => withCmd((c) => handleAction('unmerge-cells', c)) },
    'separator',
    // Excel's New Comment / Edit Comment / Delete Comment, one pair shown.
    { key: 'new-comment', label: 'New Comment', icon: glyph('comment'), hidden: () => axis() !== 'ambiguous' || hasComment(), action: () => withCmd((c) => handleAction('new-comment', c)) },
    { key: 'edit-comment', label: 'Edit Comment', icon: glyph('comment'), hidden: () => axis() !== 'ambiguous' || !hasComment(), action: () => withCmd((c) => handleAction('edit-comment', c)) },
    { key: 'delete-comment', label: 'Delete Comment', icon: glyph('comment-delete'), hidden: () => axis() !== 'ambiguous' || !hasComment(), action: () => withCmd((c) => handleAction('delete-comment', c)) },
    'separator',
    { key: 'format-cells', label: 'Format Cells...', icon: glyph('format-cells'), action: () => withCmd((c) => delegate('format-cells', c)) },
    { key: 'column-width', label: 'Column Width...', icon: glyph('column-width'), hidden: () => axis() !== 'cols', action: () => openSizeDialog('cols') },
    { key: 'row-height', label: 'Row Height...', icon: glyph('row-height'), hidden: () => axis() !== 'rows', action: () => openSizeDialog('rows') },
    { key: 'hide-columns', label: 'Hide', icon: glyph('hide'), hidden: () => axis() !== 'cols', action: () => withCmd((c) => handleAction('hide-columns', c)) },
    { key: 'unhide-columns', label: 'Unhide', icon: glyph('unhide'), hidden: () => axis() !== 'cols', action: () => withCmd((c) => handleAction('unhide-columns', c)) },
    { key: 'hide-rows', label: 'Hide', icon: glyph('hide'), hidden: () => axis() !== 'rows', action: () => withCmd((c) => handleAction('hide-rows', c)) },
    { key: 'unhide-rows', label: 'Unhide', icon: glyph('unhide'), hidden: () => axis() !== 'rows', action: () => withCmd((c) => handleAction('unhide-rows', c)) },
  ]

  // --- Column Width... and Row Height... --------------------------------------
  let sizeDialog = $state<'cols' | 'rows' | null>(null)
  const sizeDialogOpen = $derived(sizeDialog !== null)
  /** The columns or rows the size applies to: what the selection spans. */
  function sizeTargets(): number[] {
    return lineTargets(sizeDialog === 'cols' ? 'cols' : 'rows')
  }
  function lineTargets(axis: 'rows' | 'cols'): number[] {
    const last = selection[selection.length - 1]
    if (!last) return [axis === 'cols' ? active.colIndex : active.rowIndex]
    const [r1, c1, r2, c2] = last
    const from = axis === 'cols' ? c1 : r1
    const to = Math.min(axis === 'cols' ? c2 : r2, (axis === 'cols' ? colCount : rowCount) - 1)
    return Array.from({ length: to - from + 1 }, (_, i) => from + i)
  }

  /**
   * AutoFit from the Format menu: the selected columns snap to their widest
   * text, the selected rows to their wrapped text, as one undo, the same
   * fit a double-click on a header edge gives one line.
   */
  function autofitLines(axis: 'rows' | 'cols', cmd: GridCommandContext) {
    if (!api) return
    if (protectedNow()) { refuse(); return }
    const targets = lineTargets(axis)
    if (axis === 'cols') {
      const widths = () => targets.map((c) => [c, api!.getColumnWidths()[colToLetters(c)] ?? columnWidth] as const)
      const before = widths()
      for (const c of targets) api.autosizeColumn(colToLetters(c))
      const after = widths()
      const put = (list: ReadonlyArray<readonly [number, number]>) => {
        for (const [c, w] of list) api!.setColumnWidth(colToLetters(c), w)
        stashWidths()
        changed({ kind: 'sizes' })
      }
      cmd.recordUndo(() => put(before), () => put(after))
    } else {
      const before = targets.map((r) => [r, api!.getRowHeight(r)] as const)
      const fit = () => { for (const r of targets) api!.setRowHeight(r, null); fitWrappedRows(); changed({ kind: 'sizes' }) }
      fit()
      cmd.recordUndo(() => { for (const [r, h] of before) api!.setRowHeight(r, h === rowHeight ? null : h); stashHeights(); changed({ kind: 'sizes' }) }, fit)
    }
    stashLive()
    bump()
  }
  const sizeCurrent = $derived.by(() => {
    void version
    void selection
    void active
    if (!api || !sizeDialog) return 0
    const first = sizeTargets()[0] ?? 0
    return sizeDialog === 'cols'
      ? (api.getColumnWidths()[colToLetters(first)] ?? columnWidths?.[colToLetters(first)] ?? columnWidth)
      : api.getRowHeight(first)
  })
  /** Column Width... / Row Height...: not on a protected sheet. */
  function openSizeDialog(kind: 'cols' | 'rows') {
    if (protectedNow()) { refuse(); return }
    sizeDialog = kind
  }
  function applySize(px: number) {
    if (!api) return
    if (protectedNow()) { refuse(); return }
    const kind = sizeDialog
    const targets = sizeTargets()
    const read = () => targets.map((i) => [i, kind === 'cols' ? api!.getColumnWidths()[colToLetters(i)] ?? columnWidth : api!.getRowHeight(i)] as const)
    const put = (list: ReadonlyArray<readonly [number, number]>) => {
      for (const [i, size] of list) {
        if (kind === 'cols') api!.setColumnWidth(colToLetters(i), size)
        else api!.setRowHeight(i, size === rowHeight ? null : size)
      }
      stashLive()
      bump()
      changed({ kind: 'sizes' })
    }
    const before = read()
    put(targets.map((i) => [i, px] as const))
    const after = read()
    const c = cmdOf()
    c?.recordUndo(() => put(before), () => put(after))
    if (c) focusSheet(c)
  }

  /**
   * Excel moves the selection to the right-clicked cell unless that cell is
   * already inside it, so "Insert Rows" from the menu acts where the pointer
   * was, not where the last click was. Capture phase, so the selection has
   * moved before the grid opens its menu.
   */
  function onSheetContextMenu(event: MouseEvent) {
    const el = event.target as HTMLElement
    const th = el.closest<HTMLElement>('th[data-svgrid-header-col]')
    const gutter = el.closest<HTMLElement>('td.sv-grid-row-number-cell')
    if (th || gutter) {
      // A column letter or a row number: Excel selects the whole column or
      // row unless it is already inside the selection, then opens the cell
      // menu for it. The grid has no menu on its headers of its own.
      event.preventDefault()
      if (!api) return
      const rects = selection
      if (th) {
        const col = lettersToCol(th.dataset.svgridHeaderCol ?? '')
        if (col < 0) return
        const inside = rects.some(([, c1, r2, c2]) => c1 <= col && col <= c2 && r2 >= rowCount - 1)
        if (!inside) selectColumns(col, col, { active: 'place' })
        api.openContextMenu(event, 0, col)
        return
      }
      const row = rowOfGutter(gutter!)
      if (row === null) return
      const inside = rects.some(([r1, , r2, c2]) => r1 <= row && row <= r2 && c2 >= colCount - 1)
      if (!inside) selectRows(row, row, { active: 'place' })
      api.openContextMenu(event, row, 0)
      return
    }
    const td = el.closest<HTMLElement>('td[data-svgrid-row][data-svgrid-col]')
    if (!td) return
    const r = Number(td.dataset.svgridRow)
    const c = Number(td.dataset.svgridCol)
    const rects = selection.length
      ? selection
      : [[active.rowIndex, active.colIndex, active.rowIndex, active.colIndex] as const]
    const inside = rects.some(([r1, c1, r2, c2]) => r >= r1 && r <= r2 && c >= c1 && c <= c2)
    if (inside) return
    const cmd = cmdOf()
    if (!cmd) return
    cmd.setActiveCell(r, c)
    cmd.setSelection(r, c)
  }

  // --- the letters, the numbers and the corner ------------------------------
  /*
   * Excel's rules for a click on a column letter or a row number:
   *
   *   click          the whole line; the active cell goes to the first
   *                  VISIBLE row of the column (or column of the row), so
   *                  a click on C with row 40 at the top lands on C40
   *   drag           a run of lines from the pressed one to the one under
   *                  the pointer, the cells below the band counting too
   *   Shift+click    the run from the active cell's line to the clicked one;
   *                  the active cell stays
   *   Ctrl+click     another whole line beside the selection
   *   the corner     everything; the active cell stays put
   *
   * and, after any of them, the keyboard is still on the sheet: an arrow
   * collapses to the active cell, Shift+Arrow grows the run, typing lands
   * in the active cell. The grid's own headers sort on click, so the sheet
   * takes these gestures on the pointer, before the grid sees them.
   */
  type HeaderHit = { axis: 'col' | 'row'; index: number } | { axis: 'all' }
  let headerDrag: { axis: 'col' | 'row'; from: number; keep: ReadonlyArray<readonly [number, number, number, number]> } | null = null

  function rowOfGutter(gutter: HTMLElement): number | null {
    const rowAttr = gutter.parentElement?.querySelector<HTMLElement>('td[data-svgrid-row]')?.dataset.svgridRow
    const row = rowAttr === undefined ? Number(gutter.textContent) - 1 : Number(rowAttr)
    return Number.isInteger(row) && row >= 0 ? row : null
  }
  function headerHit(el: HTMLElement | null, dragging: 'col' | 'row' | null = null): HeaderHit | null {
    if (!el) return null
    if (el.closest('.sv-grid-resize-handle, .sv-grid-row-resize-handle')) return null
    if (el.closest('th.sv-grid-row-number-column')) return { axis: 'all' }
    const th = el.closest<HTMLElement>('th[data-svgrid-header-col]')
    if (th) {
      const col = lettersToCol(th.dataset.svgridHeaderCol ?? '')
      return col < 0 ? null : { axis: 'col', index: col }
    }
    const gutter = el.closest<HTMLElement>('td.sv-grid-row-number-cell')
    if (gutter) {
      const row = rowOfGutter(gutter)
      return row === null ? null : { axis: 'row', index: row }
    }
    // A drag that has left the band: the cell under the pointer says which
    // line the run reaches, as it does in Excel.
    if (dragging) {
      const td = el.closest<HTMLElement>('td[data-svgrid-row][data-svgrid-col]')
      if (td) return { axis: dragging, index: Number(dragging === 'col' ? td.dataset.svgridCol : td.dataset.svgridRow) }
    }
    return null
  }

  /** The first row (or column) in view, where Excel puts the active cell of a clicked line. */
  function firstVisible(axis: 'row' | 'col'): number {
    const host = gridHost?.querySelector<HTMLElement>('.sv-grid-container')
    if (!host) return 0
    const box = host.getBoundingClientRect()
    const headH = host.querySelector('thead')?.getBoundingClientRect().height ?? 0
    const gutterW = host.querySelector('td.sv-grid-row-number-cell')?.getBoundingClientRect().width ?? 0
    let best: number | null = null
    for (const td of host.querySelectorAll<HTMLElement>('td[data-svgrid-row][data-svgrid-col]')) {
      if (td.closest('tr')?.classList.contains('sv-grid-row-collapsed')) continue
      const r = td.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const index = Number(axis === 'row' ? td.dataset.svgridRow : td.dataset.svgridCol)
      const edge = axis === 'row' ? r.top - (box.top + headH) : r.left - (box.left + gutterW)
      if (edge < -1) continue
      if (best === null || index < best) best = index
    }
    return best ?? 0
  }

  type LinePlacement = { active: 'place' | 'keep'; keep?: ReadonlyArray<readonly [number, number, number, number]> }
  /** Whole columns a..b (plus `keep`, the ranges a Ctrl+click adds to). */
  function selectColumns(a: number, b: number, how: LinePlacement) {
    const cmd = cmdOf()
    if (!api || !cmd) return
    const was = cmd.activeCell
    api.selectCells([...(how.keep ?? []), [0, Math.min(a, b), Number.POSITIVE_INFINITY, Math.max(a, b)]])
    if (how.active === 'place') cmd.setActiveCell(firstVisible('row'), a)
    else if (was) cmd.setActiveCell(was.rowIndex, was.colIndex)
  }
  /** Whole rows a..b, the same way. */
  function selectRows(a: number, b: number, how: LinePlacement) {
    const cmd = cmdOf()
    if (!api || !cmd) return
    const was = cmd.activeCell
    api.selectCells([...(how.keep ?? []), [Math.min(a, b), 0, Math.max(a, b), Number.POSITIVE_INFINITY]])
    if (how.active === 'place') cmd.setActiveCell(a, firstVisible('col'))
    else if (was) cmd.setActiveCell(was.rowIndex, was.colIndex)
  }
  function selectLine(hit: { axis: 'col' | 'row'; index: number }, from: number, how: LinePlacement) {
    if (hit.axis === 'col') selectColumns(from, hit.index, how)
    else selectRows(from, hit.index, how)
  }

  /*
   * Excel's resize tip: while a column or row border is dragged, a small
   * box beside the pointer reads "Width: 8.43 (64 pixels)" or "Height:
   * 15.00 (20 pixels)". The grid moves the border and commits the size on
   * every frame; the tip reads the live size back from the header (or the
   * row) under it. Excel's width unit is characters of the default font,
   * (pixels - 5) / 7 for its 11pt default, which a 13px sheet font matches
   * closely; its height unit is points, three quarters of a pixel.
   */
  let resizeTip = $state<{ x: number; y: number; text: string } | null>(null)
  /** Excel's dotted guide across the sheet at the border being dragged. */
  let resizeGuide = $state<{ axis: 'col' | 'row'; at: number } | null>(null)
  /*
   * The drag as it began: where the pointer was, how big the line was and
   * where its edge sat in the sheet. Each move adds the pointer's travel to
   * those, the same arithmetic the grid's own resize uses, so the tip and
   * the guide land on the frame of the move; reading the size back from
   * the DOM waited for the grid's commit and trailed the pointer.
   */
  let resizing: { axis: 'col' | 'row'; key: string; startX: number; startY: number; startSize: number; startEdge: number; min: number } | null = null

  /*
   * Two more of Excel's drag readouts. While a range is dragged out the
   * Name Box reads "3R x 2C" instead of the address; while the fill handle
   * is dragged the same tip box says what the cell under the pointer will
   * get (Feb, 7, 2026-09-18), worked out with the grid's own series.
   */
  let cellDrag = $state(false)
  let fillDrag: { rect: readonly [number, number, number, number] } | null = null
  const dragLabel = $derived.by(() => {
    if (!cellDrag) return null
    const rect = selection[selection.length - 1]
    if (!rect) return null
    const rows = Math.abs(rect[2] - rect[0]) + 1
    const cols = Math.abs(rect[3] - rect[1]) + 1
    return rows * cols > 1 ? `${rows}R x ${cols}C` : null
  })
  function fillTipText(under: { r: number; c: number }): string | null {
    const src = fillDrag?.rect
    if (!src) return null
    const [r1, c1, r2, c2] = src
    const { r, c } = under
    const inside = r >= r1 && r <= r2 && c >= c1 && c <= c2
    if (inside) return null
    // Down or up when the pointer left the block vertically, else sideways;
    // the series runs along that axis from the block's edge.
    const vertical = r < r1 || r > r2
    if (vertical) {
      if (c < c1 || c > c2) return null
      const down = r > r2
      const sources = Array.from({ length: r2 - r1 + 1 }, (_, i) => raw(down ? r1 + i : r2 - i, c))
      const count = down ? r - r2 : r1 - r
      return fillTipValue(buildFillPattern(sources, count)[count - 1], down ? r2 : r1, c)
    }
    if (r < r1 || r > r2) return null
    const right = c > c2
    const sources = Array.from({ length: c2 - c1 + 1 }, (_, i) => raw(r, right ? c1 + i : c2 - i))
    const count = right ? c - c2 : c1 - c
    return fillTipValue(buildFillPattern(sources, count)[count - 1], r, right ? c2 : c1)
  }
  /** The tip's text: a number the way the source cell formats it, as Excel shows it. */
  function fillTipValue(value: unknown, sr: number, sc: number): string | null {
    if (value === undefined || value === null || value === '') return null
    const n = typeof value === 'number' ? value : Number(value)
    if (typeof value !== 'boolean' && Number.isFinite(n) && String(value).trim() !== '') {
      const fmt = storeFor().get(`r${sr}`, colToLetters(sc))?.numFmt
      return fmt ? compileNumberFormat(fmt).format(n).text : String(Number(n.toPrecision(10)))
    }
    return String(value)
  }
  function placeFillTip(event: PointerEvent) {
    const host = gridHost
    if (!host || !fillDrag) return
    const td = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLElement>('td[data-svgrid-row][data-svgrid-col]')
    const text = td ? fillTipText({ r: Number(td.dataset.svgridRow), c: Number(td.dataset.svgridCol) }) : null
    if (text === null || text === '') { resizeTip = null; return }
    const box = host.getBoundingClientRect()
    resizeTip = { x: event.clientX - box.left + 14, y: event.clientY - box.top + 18, text }
  }
  function resizeTipText(px: number): string {
    if (!resizing) return ''
    return resizing.axis === 'col'
      ? `Width: ${Math.max(0, (px - 5) / 7).toFixed(2)} (${px} pixels)`
      : `Height: ${(px * 0.75).toFixed(2)} (${px} pixels)`
  }
  function placeResizeTip(event: PointerEvent) {
    const host = gridHost
    const drag = resizing
    if (!host || !drag) return
    const box = host.getBoundingClientRect()
    const travel = drag.axis === 'col' ? event.clientX - drag.startX : event.clientY - drag.startY
    const px = Math.round(Math.max(drag.min, drag.startSize + travel))
    // Beside the pointer, kept inside the sheet at its right edge.
    const x = Math.min(event.clientX - box.left + 14, box.width - 160)
    resizeTip = { x: Math.max(0, x), y: event.clientY - box.top - 30, text: resizeTipText(px) }
    resizeGuide = { axis: drag.axis, at: drag.startEdge + (px - drag.startSize) }
  }
  function startResizeTip(handle: HTMLElement, event: PointerEvent) {
    const host = gridHost
    if (!host) return
    const box = host.getBoundingClientRect()
    if (handle.classList.contains('sv-grid-row-resize-handle')) {
      const tr = handle.closest('tr')
      const td = tr?.querySelector<HTMLElement>('td[data-svgrid-row]')
      const row = td?.dataset.svgridRow
      if (!tr || !td || row === undefined) return
      const r = td.getBoundingClientRect()
      // The grid's own minimum row height, so the tip stops where the row does.
      resizing = { axis: 'row', key: row, startX: event.clientX, startY: event.clientY, startSize: Math.round(r.height), startEdge: r.bottom - box.top, min: 20 }
    } else {
      const th = handle.closest<HTMLElement>('[data-svgrid-header-col]')
      const col = th?.dataset.svgridHeaderCol
      if (!th || !col) return
      const r = th.getBoundingClientRect()
      resizing = { axis: 'col', key: col, startX: event.clientX, startY: event.clientY, startSize: Math.round(r.width), startEdge: r.right - box.left, min: 40 }
    }
    placeResizeTip(event)
  }
  function endResizeTip() {
    resizing = null
    resizeTip = null
    resizeGuide = null
  }

  function onSheetPointerDown(event: PointerEvent) {
    if (event.button !== 0) return
    const target = event.target as HTMLElement | null
    const handle = target?.closest<HTMLElement>('.sv-grid-resize-handle, .sv-grid-row-resize-handle')
    if (handle) { startResizeTip(handle, event); return }
    if (target?.closest('.sv-grid-fill-handle')) {
      const rect = selection[selection.length - 1] ?? [active.rowIndex, active.colIndex, active.rowIndex, active.colIndex]
      fillDrag = { rect: [Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]), Math.max(rect[0], rect[2]), Math.max(rect[1], rect[3])] }
      return
    }
    const hit = headerHit(target)
    if (!hit) {
      // A press on a cell may become a range drag: the Name Box counts it.
      if (target?.closest('td[data-svgrid-row][data-svgrid-col]')) cellDrag = true
      return
    }
    const cmd = cmdOf()
    if (!api || !cmd) return
    // The grid's header would sort, and the pointer would start a resize
    // or a cell drag; this gesture is the sheet's.
    event.preventDefault()
    event.stopPropagation()
    if (hit.axis === 'all') {
      const was = cmd.activeCell
      api.selectCells([[0, 0, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]])
      if (was) cmd.setActiveCell(was.rowIndex, was.colIndex)
      headerDrag = null
    } else if (event.shiftKey) {
      const anchor = cmd.activeCell
      const from = anchor ? (hit.axis === 'col' ? anchor.colIndex : anchor.rowIndex) : hit.index
      selectLine(hit, from, { active: 'keep' })
      headerDrag = null
    } else {
      const keep = event.ctrlKey || event.metaKey ? cmd.ranges : []
      selectLine(hit, hit.index, { active: 'place', keep })
      headerDrag = { axis: hit.axis, from: hit.index, keep }
    }
    // Excel leaves the keyboard on the sheet after a header click.
    cmd.focus()
  }
  function onSheetPointerMove(event: PointerEvent) {
    if (fillDrag) { placeFillTip(event); return }
    if (resizing) { placeResizeTip(event); return }
    const drag = headerDrag
    if (!drag) return
    const hit = headerHit(document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null, drag.axis)
    if (!hit || hit.axis !== drag.axis) return
    const cmd = cmdOf()
    if (!cmd) return
    // The run grows from the pressed line; the active cell stays on it.
    const was = cmd.activeCell
    if (drag.axis === 'col') api?.selectCells([...drag.keep, [0, Math.min(drag.from, hit.index), Number.POSITIVE_INFINITY, Math.max(drag.from, hit.index)]])
    else api?.selectCells([...drag.keep, [Math.min(drag.from, hit.index), 0, Math.max(drag.from, hit.index), Number.POSITIVE_INFINITY]])
    if (was) cmd.setActiveCell(was.rowIndex, was.colIndex)
  }
  function endHeaderDrag() {
    headerDrag = null
    cellDrag = false
    fillDrag = null
    endResizeTip()
  }
  $effect(() => {
    // The resize handle captures the pointer, so its moves come through
    // the window rather than the sheet.
    window.addEventListener('pointerup', endHeaderDrag)
    window.addEventListener('pointercancel', endHeaderDrag)
    window.addEventListener('pointermove', onSheetPointerMove)
    return () => {
      window.removeEventListener('pointerup', endHeaderDrag)
      window.removeEventListener('pointercancel', endHeaderDrag)
      window.removeEventListener('pointermove', onSheetPointerMove)
    }
  })

  // --- the in-cell editor: caret at the end, and room to grow ---------------
  /**
   * Excel's in-cell editor opens with the caret after the text rather than
   * with the text selected, and it widens over the cells to its right as a
   * long formula is typed instead of scrolling inside the cell. The grid's
   * editor does neither on its own, so both are done here, from the events
   * that bubble out of it.
   */
  type Editor = HTMLInputElement | HTMLTextAreaElement
  /** A key that would start or make an edit on the active cell. */
  function wouldEdit(event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.metaKey || event.altKey) return false
    const el = event.target as HTMLElement | null
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return false
    if (event.key === 'F2' || event.key === 'Delete' || event.key === 'Backspace') return true
    return event.key.length === 1
  }

  function editorOf(target: EventTarget | null): Editor | null {
    const el = target as HTMLElement | null
    return (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
      el.classList.contains('sv-grid-cell-editor') ? el : null
  }

  let measure: CanvasRenderingContext2D | null = null
  function growEditor(input: Editor) {
    const td = input.closest<HTMLElement>('td')
    if (!td) return
    measure ??= document.createElement('canvas').getContext('2d')
    if (!measure) return
    measure.font = getComputedStyle(input).font
    // The widest line decides the width; the number of lines the height.
    const lines = input.value.split('\n')
    const widest = Math.max(...lines.map((line) => measure!.measureText(line).width))
    const needed = Math.ceil(widest) + 18
    input.style.width = needed > td.clientWidth ? `${needed}px` : ''
    if (input instanceof HTMLTextAreaElement) {
      const lineHeight = parseFloat(getComputedStyle(input).lineHeight) || 17
      const tall = Math.ceil(lines.length * lineHeight) + 4
      input.style.height = tall > td.clientHeight ? `${tall}px` : ''
    }
  }

  /**
   * What is being typed in the cell, mirrored in the formula bar as it is
   * typed, the way Excel's bar follows an in-cell edit; null between edits,
   * when the bar shows the cell's stored text.
   */
  let editingText = $state<string | null>(null)
  /** What is being typed in the formula bar, shown in the active cell as it
   *  is typed, the way Excel's cell follows the bar; null between edits. */
  let barDraft = $state<string | null>(null)

  function onEditorFocusIn(event: FocusEvent) {
    const input = editorOf(event.target)
    if (!input) return
    editingText = input.value
    // The grid selects the text as the editor mounts, synchronously after
    // this event; the caret goes to the end once that has happened.
    queueMicrotask(() => {
      const end = input.value.length
      try { input.setSelectionRange(end, end) } catch { /* not a text input */ }
    })
    growEditor(input)
    if (input.value.startsWith('=')) formulaDraft = input.value
  }

  function onEditorInput(event: Event) {
    const input = editorOf(event.target)
    if (!input) return
    // Typed characters complete; a deletion, a paste or the completion's
    // own input event leave the text as it is, so Backspace takes the
    // suggestion away rather than bringing it straight back.
    if (event instanceof InputEvent && event.inputType === 'insertText') autoComplete(input)
    growEditor(input)
    editingText = input.value
    formulaDraft = input.value.startsWith('=') ? input.value : null
  }

  /**
   * Excel's AutoComplete: the text entries in the column's run around the
   * cell are offered as the cell is typed into, and when what was typed
   * fits exactly one of them the cell shows the rest of it, selected, so
   * that the next keystroke overwrites it and Backspace takes it away. What
   * was typed stays as typed until Enter or Tab accepts the suggestion,
   * when the cell takes the entry's own case ("jo" becomes "John Smith").
   */
  let suggested: string | null = null
  function autoComplete(input: HTMLInputElement | HTMLTextAreaElement) {
    suggested = null
    const typed = input.value
    if (input.selectionStart !== typed.length || input.selectionEnd !== typed.length) return
    const { rowIndex, colIndex } = active
    const entry = completeEntry(typed, columnRunEntries(rowIndex, colIndex))
    if (entry === null || entry === typed) return
    suggested = entry
    input.value = typed + entry.slice(typed.length)
    input.setSelectionRange(typed.length, entry.length)
    // The grid keeps its own copy of the draft and reads it from input events.
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
  /** Enter or Tab on a standing suggestion: the entry, in its own case. */
  function acceptSuggestion(event: KeyboardEvent) {
    if (suggested === null || (event.key !== 'Enter' && event.key !== 'Tab') || event.altKey) return
    const input = editorOf(event.target)
    if (!input) return
    const entry = suggested
    suggested = null
    const tail = input.selectionStart ?? input.value.length
    if (input.selectionEnd !== input.value.length || tail >= input.value.length) return
    if (input.value.toLowerCase() !== entry.toLowerCase()) return
    input.value = entry
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }

  /** The distinct text entries in the column, contiguous with the cell. */
  function columnRunEntries(rowIndex: number, colIndex: number): Set<string> {
    const out = new Set<string>()
    // null ends the run (a blank); '' keeps it going without offering
    // anything (a number, a formula, a boolean).
    const textAt = (r: number): string | null => {
      const raw = wb.getRaw(wb.active, r, colIndex)
      if (raw === '') return null
      if (raw.startsWith('=')) return ''
      return typeof wb.getValue(wb.active, r, colIndex) === 'string' ? raw : ''
    }
    for (let r = rowIndex - 1; r >= 0; r -= 1) {
      const t = textAt(r)
      if (t === null) break
      if (t) out.add(t)
    }
    for (let r = rowIndex + 1; r < rowCount; r += 1) {
      const t = textAt(r)
      if (t === null) break
      if (t) out.add(t)
    }
    return out
  }

  function onEditorFocusOut(event: FocusEvent) {
    if (!editorOf(event.target)) return
    formulaDraft = null
    editingText = null
  }

  // --- Excel's reference colours -------------------------------------------
  /**
   * While a formula is being typed, every cell it refers to is outlined in
   * its own colour and the reference in the text shares it, which is how a
   * spreadsheet user checks a formula without reading it. Only the active
   * sheet's cells can be painted, so references into other sheets are left
   * to the text.
   */
  let formulaDraft = $state<string | null>(null)

  /** The distinct ranges a formula names, first occurrence first. */
  function referencesIn(text: string): Array<{ key: string; colour: string; rect: readonly [number, number, number, number] }> {
    const seen = new Set<string>()
    return referenceSpans(text).filter((span) => !seen.has(span.key) && (seen.add(span.key), true))
  }

  let painted: HTMLElement[] = []
  function paintReferences() {
    for (const el of painted) {
      delete el.dataset.sheetRef
      el.style.removeProperty('--sheet-ref')
      el.style.removeProperty('--sheet-ref-edges')
    }
    painted = []
    const host = root
    if (!host || formulaDraft === null) { clearEditorMirror(); return }
    for (const { rect, colour } of referencesIn(formulaDraft)) {
      const [r1, c1, r2, c2] = rect
      // Only what is rendered: the rows are virtualised, and a reference to
      // row 5000 has nothing on screen to paint. A range is one rectangle,
      // as Excel draws it: each cell carries only the edges it sits on.
      for (const td of host.querySelectorAll<HTMLElement>('td[data-svgrid-row][data-col-id]')) {
        const r = Number(td.dataset.svgridRow)
        const c = lettersToCol(td.dataset.colId ?? '')
        if (r < r1 || r > r2 || c < c1 || c > c2) continue
        const edges: string[] = []
        if (r === r1) edges.push('inset 0 1.5px 0 var(--sheet-ref)')
        if (r === r2) edges.push('inset 0 -1.5px 0 var(--sheet-ref)')
        if (c === c1) edges.push('inset 1.5px 0 0 var(--sheet-ref)')
        if (c === c2) edges.push('inset -1.5px 0 0 var(--sheet-ref)')
        td.dataset.sheetRef = ''
        td.style.setProperty('--sheet-ref', colour)
        td.style.setProperty('--sheet-ref-edges', edges.length ? edges.join(', ') : 'none')
        painted.push(td)
      }
    }
    paintEditorText()
  }
  $effect(() => {
    void formulaDraft
    void version
    const frame = requestAnimationFrame(paintReferences)
    return () => cancelAnimationFrame(frame)
  })

  /**
   * The formula's own text, each reference in its range's colour. An input
   * cannot colour a run of its text, so a mirror of the text is laid over
   * the editor with the references in colour, and the editor's text goes
   * transparent under it; the caret keeps its colour. The mirror copies the
   * editor's box and type so the glyphs land on their own. Gone with the
   * edit, or the moment the draft stops being a formula.
   */
  let mirror: HTMLElement | null = null
  function clearEditorMirror() {
    const input = mirror?.parentElement?.querySelector<HTMLElement>('.sv-grid-cell-editor')
    input?.classList.remove('sheet-ref-text')
    mirror?.remove()
    mirror = null
  }
  function paintEditorText() {
    const input = root?.querySelector<HTMLInputElement | HTMLTextAreaElement>('td.sv-grid-cell-editing .sv-grid-cell-editor') ?? null
    const spans = formulaDraft !== null && input ? referenceSpans(input.value) : []
    if (!input || spans.length === 0) { clearEditorMirror(); return }
    const td = input.closest<HTMLElement>('td')
    if (!td) { clearEditorMirror(); return }
    if (!mirror || mirror.parentElement !== td) {
      clearEditorMirror()
      mirror = document.createElement('div')
      mirror.className = 'sheet-ref-mirror'
      mirror.setAttribute('aria-hidden', 'true')
      td.appendChild(mirror)
    }
    const cs = getComputedStyle(input)
    Object.assign(mirror.style, {
      left: `${input.offsetLeft}px`, top: `${input.offsetTop}px`,
      width: `${input.offsetWidth}px`, height: `${input.offsetHeight}px`,
      font: cs.font, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing,
      padding: cs.padding, textAlign: cs.textAlign, boxSizing: cs.boxSizing,
      borderWidth: cs.borderWidth, borderStyle: 'solid', borderColor: 'transparent',
    })
    fillMirror(mirror, input.value, spans)
    mirror.scrollLeft = input.scrollLeft
    mirror.scrollTop = input.scrollTop
    input.classList.add('sheet-ref-text')
  }
  /** The text as runs: plain, then a reference in its colour, and so on. */
  function fillMirror(host: HTMLElement, text: string, spans: ReferenceSpan[]) {
    host.replaceChildren()
    let at = 0
    for (const span of spans) {
      if (span.start > at) host.appendChild(document.createTextNode(text.slice(at, span.start)))
      const run = document.createElement('span')
      run.style.color = span.colour
      run.textContent = text.slice(span.start, span.end)
      host.appendChild(run)
      at = span.end
    }
    if (at < text.length) host.appendChild(document.createTextNode(text.slice(at)))
  }
</script>

<!--
  A plain span, deliberately not a button.

  An interactive element here competes with the grid for the pointer: it
  takes focus on mousedown, so the first double-click on a cell that was not
  already active never reached the grid's own dblclick handler and the edit
  was silently dropped. The grid owns click-to-activate, double-click-to-edit
  and drag-to-select; this only paints.
-->
<!--
  Excel's General alignment: numbers to the right, text to the left, errors
  and booleans centred, unless the cell says otherwise. That single rule is
  most of what makes a column of figures read as a spreadsheet.
-->
{#snippet Cell(props: { r: number; c: number })}
  {@const typing = barDraft !== null && props.r === active.rowIndex && props.c === active.colIndex}
  {@const entry = storeFor().get(`r${props.r}`, colToLetters(props.c))}
  {@const value = wb.getValue(wb.active, props.r, props.c)}
  {@const cf = showFormulas || typing ? null : cfAt(props.r, props.c, value)}
  {@const shown = typing ? { text: barDraft! } : display(props.r, props.c, cf?.style?.numFmt)}
  {@const spill = showFormulas ? 0 : spillWidth(props.r, props.c, value, entry)}
  {@const align = typing ? 'left' : entry?.align ?? (showFormulas ? 'left' : typeof value === 'number' ? 'right' : typeof value === 'boolean' || isError(value) ? 'center' : 'left')}
  {@const hashes = typeof value === 'number' && !showFormulas && !typing ? hashesFor(shown.text, props.c, entry, props.r, entry?.numFmt || cf?.style?.numFmt ? undefined : value) : null}
  {#if cf?.dataBar}
    <!-- Excel's data bar: behind the text, the value's share of the cell. -->
    <span class="sheet-databar" style:width="{Math.round(cf.dataBar.ratio * 100)}%" style:background={cf.dataBar.color}></span>
  {/if}
  {@const ants = marqueeEdges(props.r, props.c)}
  {#if ants}
    <!-- Excel's marching ants around the copied block: each cell on the
         outline draws the edges it sits on, so a block half scrolled out
         of view still shows the part of the outline that is in it. -->
    <span class="sheet-ants {ants}" aria-hidden="true"></span>
  {/if}
  <span
    class="sheet-cell"
    class:formula={showFormulas && shown.text.startsWith('=')}
    class:spill={spill > 0}
    class:wrap={!!entry?.wrap}
    class:has-icon={!!cf?.icon}
    style={`text-align:${align};${entryToStyle(entry)}${cf?.style ? `;${entryToStyle(cf.style)}` : ''}${shown.color ? `;color:${shown.color}` : ''}${spill > 0 ? `;max-width:calc(100% + ${spill}px)` : ''}`}
    title={hashes ? shown.text : raw(props.r, props.c)}
  >{#if cf?.icon}{@render cfIcon(cf.icon.set, cf.icon.index)}{/if}{hashes ?? shown.text}</span>
  {@const arrow = filterArrowAt(props.r, props.c)}
  {#if arrow}
    <!-- Excel's AutoFilter arrow on the region's header row: a funnel once
         the column is filtered. The pointer stops here so the click opens
         the menu rather than starting a selection drag. -->
    <button
      type="button"
      class="sheet-filter-arrow"
      class:filtered={arrow === 'filtered'}
      aria-label={arrow === 'filtered' ? 'Filter (filtered)' : 'Filter'}
      onpointerdown={(event) => event.stopPropagation()}
      onclick={(event) => { event.stopPropagation(); openFilterMenu(props.c) }}
    >{#if arrow === 'filtered'}<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M1 1.5h8L6 5.5v3L4 9.5v-4z" fill="currentColor" /></svg>{:else}<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>{/if}</button>
  {/if}
  {#if circled.has(`${props.r},${props.c}`)}
    <!-- Circle Invalid Data: Excel's red oval around a cell that breaks its rule. -->
    <span class="sheet-invalid-circle" aria-label="Breaks its validation rule" role="img"></span>
  {/if}
  {#if props.r === active.rowIndex && props.c === active.colIndex && listRuleAt(props.r, props.c)}
    <!-- Excel's in-cell dropdown arrow, on the active cell of a list rule.
         The pointer stops here so the click opens the list rather than
         starting a selection drag. -->
    <button
      type="button"
      class="sheet-dropdown-arrow"
      aria-label="Open the list"
      onpointerdown={(event) => event.stopPropagation()}
      onclick={(event) => { event.stopPropagation(); openListPicker(props.r, props.c) }}
    ><svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg></button>
  {/if}
{/snippet}

<!-- Excel's icon sets, three glyphs each: the top, the middle, the bottom third. -->
{#snippet cfIcon(set: 'arrows' | 'traffic' | 'flags' | 'symbols', index: 0 | 1 | 2)}
  {@const colour = ['#3c9b3a', '#e0b000', '#d03a2c'][index]}
  <svg class="sheet-cf-icon" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
    {#if set === 'arrows'}
      {#if index === 0}<path d="M6 10.5V2M2.5 5.5L6 2l3.5 3.5" fill="none" stroke={colour} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      {:else if index === 1}<path d="M1.5 6h9M7 2.5L10.5 6 7 9.5" fill="none" stroke={colour} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      {:else}<path d="M6 1.5V10M2.5 6.5L6 10l3.5-3.5" fill="none" stroke={colour} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />{/if}
    {:else if set === 'traffic'}
      <circle cx="6" cy="6" r="4.5" fill={colour} />
    {:else if set === 'flags'}
      <path d="M2.5 11V1.5h6.5L7.5 4l1.5 2.5H2.5" fill={colour} stroke={colour} stroke-width="1" stroke-linejoin="round" />
    {:else}
      {#if index === 0}<circle cx="6" cy="6" r="5" fill={colour} /><path d="M3.5 6.2l1.8 1.8L8.6 4.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      {:else if index === 1}<path d="M6 1l5.2 9.5H.8z" fill={colour} /><path d="M6 4.5v3M6 9.2v.1" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" />
      {:else}<circle cx="6" cy="6" r="5" fill={colour} /><path d="M4 4l4 4M8 4l-4 4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" />{/if}
    {/if}
  </svg>
{/snippet}

<!-- Excel's Select All corner: an empty cell with a small triangle. -->
{#snippet corner()}
  <span class="corner" aria-hidden="true"></span>
{/snippet}

<div class="sv-sheet" class:fill={height === '100%'} class:look-excel={look === 'excel'} class:no-gridlines={!gridlinesOn} class:no-headings={!headingsOn} bind:this={root}>
  {#if showRibbon}
    <SvSheetRibbon
      cmd={cmdOf}
      onChange={bump}
      onAction={handleAction}
      {activeActions}
      {without}
      bind:collapsed={ribbonCollapsed}
    />
  {/if}

  {#if showFormulaBar && formulaBarOn}
    <SvFormulaBar
      active={active}
      value={editingText ?? activeRaw}
      onCommit={commit}
      onNavigate={goTo}
      onSelectName={jumpToName}
      onInsertFunction={() => { const c = cmdOf(); if (c) delegate('insert-function', c) }}
      onDraft={(text) => { formulaDraft = text; barDraft = text }}
      label={dragLabel}
      highlight={formulaDraft !== null ? referenceSpans : undefined}
      names={definedNames}
    />
  {/if}

  {#if showComments}
    <!-- Show All Comments: the honest form over a virtualised sheet is a
         list, each entry a jump to its cell. -->
    <div class="sheet-comments" aria-label="Comments on this sheet">
      {#if allComments.length === 0}
        <span class="none">No comments on this sheet.</span>
      {:else}
        {#each allComments as entry (`${entry.row}:${entry.col}`)}
          <button type="button" class="entry" onclick={() => openCommentEditor(entry.row, entry.col)}>
            <span class="addr">{colToLetters(entry.col)}{entry.row + 1}</span>
            <span class="text">{entry.text}</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}

  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div
    class="sheet-grid"
    class:fill={height === '100%'}
    bind:this={gridHost}
    onpointerdowncapture={onSheetPointerDown}
    oncontextmenucapture={onSheetContextMenu}
    onfocusin={onEditorFocusIn}
    onfocusout={onEditorFocusOut}
    oninput={onEditorInput}
    onkeydowncapture={onSheetKeyDownCapture}
    onpointerupcapture={onSheetPointerUp}
    class:painting={painter !== null}
    onscrollcapture={() => { if (formulaDraft !== null) paintReferences(); if (cellPopover) measureAnchor(); if (inputMessage) measureMessage() }}
  >
  {#if resizeGuide}
    <div class="sheet-resize-guide" class:col={resizeGuide.axis === 'col'} class:row={resizeGuide.axis === 'row'} aria-hidden="true" style:left={resizeGuide.axis === 'col' ? `${resizeGuide.at}px` : '0'} style:top={resizeGuide.axis === 'row' ? `${resizeGuide.at}px` : '0'}></div>
  {/if}
  {#if resizeTip}
    <div class="sheet-resize-tip" role="status" style:left={`${resizeTip.x}px`} style:top={`${resizeTip.y}px`}>{resizeTip.text}</div>
  {/if}
  {#if inputMessage && messageRect}
    <!-- Excel's Input Message: a small box under the selected cell, the
         title in bold over the text. Nothing to click, so the pointer goes
         through it to the cells beneath. -->
    <div class="sheet-input-message" role="note" style:left="{messageRect.left}px" style:top="{messageRect.top + messageRect.height + 2}px">
      {#if inputMessage.title}<div class="title">{inputMessage.title}</div>{/if}
      {#if inputMessage.message}<div class="text">{inputMessage.message}</div>{/if}
    </div>
  {/if}
  {#if cellPopover && anchorRect}
    <!-- An invisible box over the cell for the note to point at. -->
    <div class="sheet-cell-anchor" style:left="{anchorRect.left}px" style:top="{anchorRect.top}px">
      <SvPopover
        trigger="manual"
        open={true}
        onOpenChange={(open) => { if (!open) closeCellPopover() }}
        placement={cellPopover.kind === 'comment' ? 'right-start' : 'bottom-start'}
        offset={cellPopover.kind === 'comment' ? 6 : 2}
        arrow={cellPopover.kind === 'comment'}
        ariaLabel={cellPopover.kind === 'list' ? 'Choices' : cellPopover.kind === 'filter' ? 'Filter' : 'Comment'}
      >
        {#snippet anchor()}<span class="box" style:width="{anchorRect!.width}px" style:height="{anchorRect!.height}px"></span>{/snippet}
        {#if cellPopover.kind === 'comment'}
          <SvSheetComment
            text={cellPopover.initial}
            address={`${colToLetters(cellPopover.c)}${cellPopover.r + 1}`}
            onDraft={(text) => { if (cellPopover?.kind === 'comment') cellPopover.draft = text }}
            onSave={(text) => { if (cellPopover?.kind === 'comment') cellPopover.draft = text; closeCellPopover() }}
            onDelete={() => { const pop = cellPopover; closeCellPopover(false); if (pop) setComment(pop.r, pop.c, '') }}
          />
        {:else if cellPopover.kind === 'list'}
          <SvSheetListPicker
            choices={cellPopover.choices}
            value={raw(cellPopover.r, cellPopover.c)}
            onPick={pickChoice}
            onCancel={() => closeCellPopover()}
          />
        {:else}
          <SvSheetFilterMenu
            header={cellPopover.header}
            values={cellPopover.values}
            filter={cellPopover.filter}
            numeric={cellPopover.numeric}
            onSort={(direction) => { const pop = cellPopover; closeCellPopover(); if (pop) { const af = autoFilterNow(); if (af) sortRegion(direction, { rect: af.range, keyCol: pop.c }) } }}
            onApply={(filter) => { const pop = cellPopover; closeCellPopover(); const af = autoFilterNow(); if (pop && af) applyAutoFilter(withColumnFilter(af, pop.c, filter), cmdOf()) }}
            onCancel={() => closeCellPopover()}
          />
        {/if}
      </SvPopover>
    </div>
  {/if}
  <SvGrid
    data={gridRows}
    {columns}
    {features}
    selectionMode="cell"
    enableCellSelection={true}
    showRowNumbers={headingsOn}
    rowNumberWidth={40}
    {rowHeight}
    icons={{ 'row-number': corner }}
    columnResize={!isProtected}
    rowResize={!isProtected}
    {contextMenu}
    notes={activeNotes}
    mergedCells={activeMerges}
    rowClass={({ rowIndex }: { rowIndex: number }) =>
      activeFilter && isFiltering(activeFilter) && rowIndex > activeFilter.range[0] && rowIndex <= activeFilter.range[2] ? 'sheet-filtered' : undefined}
    containerHeight={height}
    enableInlineEditing={true}
    editOnSecondClick={false}
    onApiReady={(next: SheetApi) => {
      api = next
      // A document the consumer built (createSheetDocument({ state }), or
      // one seeded with widths, hidden lines, a filter, frozen panes) shows
      // its state from the first paint: the grid has just come up, so its
      // live parts are put on it the way a sheet switch would.
      applyLive(wb.active)
      const cmd = cmdOf()
      if (cmd) applyFreeze(cmd, doc.get(wb.active).freeze)
      // The filter's rows were just worked out: the status bar and the
      // rest of what reads them repaint once.
      bump()
      onReady?.(next, doc)
    }}
    onActiveCellChange={(cell: { rowIndex: number; colIndex: number }) => {
      // The grid is the single source of truth for where the cursor is, so
      // the formula bar and the status bar follow it rather than keeping a
      // second copy that can disagree after a keyboard move.
      active = { rowIndex: cell.rowIndex, colIndex: cell.colIndex }
    }}
    onCellValueChange={onCellWritten}
    onColumnResize={() => { stashWidths(); changed({ kind: 'sizes' }) }}
    onRowResize={(e) => { if (e.height === null) fitWrappedRows(); stashHeights(); changed({ kind: 'sizes' }) }}
    processCellForFill={({ value, delta }) =>
      typeof value === 'string' && value.startsWith('=') ? translateFormula(value, delta.rows, delta.cols) : undefined}
    processCellForClipboard={toClipboard}
    clipboardHtml={copiedHtml}
    onPasteClipboard={pasteFromSystem}
    onCellSelectionChange={(ranges: Array<[number, number, number, number]>) => {
      // Only the selection: the cells did not change, so nothing that
      // reads `version` (every cell's display, its rules, its width) needs
      // to run again. What follows the selection reads `selection` and
      // `active` instead; bumping here repainted the whole sheet on every
      // arrow key.
      selection = ranges
    }}
  />
  </div>

  {#if showTabs}
    <SvSheetTabs
      workbook={wb}
      {version}
      onChange={bump}
      onRename={(from, to) => {
        // The document's entry follows the sheet, or renaming a sheet would
        // strip its formats.
        doc.rename(from, to)
        targetsBoundTo = to
        registerSheetTargets()
      }}
      onRemove={(name) => doc.remove(name)}
      hidden={hiddenSheets}
      onHide={hideSheet}
      onUnhide={unhideSheet}
      onDuplicate={duplicateSheet}
    />
  {/if}

  {#if showStatusBar}
    <!-- Excel's status bar: Ready on the left, the selection's Average / Count / Sum on the right. -->
    <div class="status" role="status" aria-live="off">
      <span class="mode">{statusMessage ?? filterSummary ?? 'Ready'}</span>
      <span class="grow"></span>
      {#if aggregate.count > 1}
        {#if aggregate.numeric > 0}
          <span>Average: <b>{money(aggregate.average ?? 0)}</b></span>
        {/if}
        <span>Count: <b>{aggregate.count}</b></span>
        {#if aggregate.numeric > 0}
          <span>Sum: <b>{money(aggregate.sum)}</b></span>
        {/if}
      {/if}
    </div>
  {/if}

  <SvSheetFindReplace bind:open={findOpen} cmd={cmdOf} onClose={() => { const c = cmdOf(); if (c) focusSheet(c) }} />
  <SvSheetPasteSpecial bind:open={pasteSpecialOpen} hasClipboard={copied !== null} onPaste={pasteSpecial} onClose={() => { const c = cmdOf(); if (c) focusSheet(c) }} />
  <SvSheetFormatCells bind:open={formatCellsOpen} entry={activeEntry} sample={activeValue} mixedLocked={mixedLocked} onApply={applyFormatCells} onClose={() => { const c = cmdOf(); if (c) focusSheet(c) }} />
  <SvSheetInsertFunction bind:open={insertFunctionOpen} onPick={insertFunction} />
  <SvSheetNameManager bind:open={nameManagerOpen} workbook={wb} onChange={() => { wb.recalculate(); bump() }} onClose={() => afterDialog()} />
  <SvSheetGoalSeek bind:open={goalSeekOpen} workbook={wb} cmd={cmdOf} onClose={() => afterDialog()} />
  <SvSheetTextToColumns bind:open={textToColumnsOpen} workbook={wb} cmd={cmdOf} onDone={say} onClose={() => afterDialog()} />
  <SvSheetRemoveDuplicates bind:open={removeDuplicatesOpen} workbook={wb} cmd={cmdOf} onDone={say} onClose={() => afterDialog()} />
  {#if sortDialog}
    <SvSheetSort
      open={true}
      workbook={wb}
      block={sortDialog.block}
      headerGuess={sortDialog.headerGuess}
      activeCol={active.colIndex}
      onApply={(keys, hasHeaders) => { const d = sortDialog; if (d) sortBy(d.block, keys, hasHeaders) }}
      onClose={() => { sortDialog = null; afterDialog() }}
    />
  {/if}
  {#if cfDialog}
    <SvSheetConditionalFormat
      open={true}
      preset={cfDialog.preset}
      rule={cfDialog.rule}
      address={selectionAddress}
      onApply={applyCfBody}
      onClose={() => { cfDialog = null; afterDialog() }}
    />
  {/if}
  <SvSheetManageRules
    bind:open={manageRulesOpen}
    rules={cfRules}
    selection={cfSelection}
    onApply={(rules) => setCf(rules)}
    onEdit={(rule, replace) => {
      const preset: CfPreset =
        rule.kind === 'cellIs' ? (rule.operator === 'between' ? 'between' : rule.operator === 'less' ? 'less' : rule.operator === 'equal' ? 'equal' : 'greater')
        : rule.kind === 'text' ? 'text'
        : rule.kind === 'duplicates' ? 'duplicates'
        : rule.kind === 'topBottom' ? (rule.top ? 'top10' : 'bottom10')
        : rule.above ? 'aboveAverage' : 'belowAverage'
      cfDialog = { preset, rule, replace }
    }}
    onClose={() => afterDialog()}
  />
  <SvSheetDataValidation
    bind:open={dataValidationOpen}
    rule={activeRule}
    address={selectionAddress}
    onApply={applyValidation}
    onClear={clearValidation}
    onClose={() => afterDialog()}
  />
  <SvSheetValidationAlert
    open={pendingAlert !== null}
    alert={pendingAlert?.verdict ?? null}
    onRetry={retryEntry}
    onAccept={acceptEntry}
    onCancel={() => { pendingAlert = null; const c = cmdOf(); if (c) focusSheet(c) }}
  />
  <input class="sheet-file-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" bind:this={fileInput} onchange={openPicked} aria-hidden="true" tabindex="-1" />
  <SvModal open={newConfirm} title="New workbook" size="sm" onClose={() => { newConfirm = false; const c = cmdOf(); if (c) focusSheet(c) }}>
    <div class="sv-sheet-dialog">
      <p class="note">Start a new workbook? What is on these sheets goes away unless it was saved.</p>
    </div>
    {#snippet footer()}
      <div class="sv-sheet-dialog-buttons">
        <button type="button" class="btn primary" onclick={() => { newConfirm = false; newWorkbook(); const c = cmdOf(); if (c) focusSheet(c) }}>New workbook</button>
        <button type="button" class="btn" onclick={() => { newConfirm = false; const c = cmdOf(); if (c) focusSheet(c) }}>Cancel</button>
      </div>
    {/snippet}
  </SvModal>
  <SvModal open={mergeConfirm !== null} title="Merge cells" size="sm" onClose={() => { mergeConfirm = null; const c = cmdOf(); if (c) focusSheet(c) }}>
    <div class="sv-sheet-dialog">
      <p class="note">Merging cells only keeps the upper-left cell value and discards the other values.</p>
    </div>
    {#snippet footer()}
      <div class="sv-sheet-dialog-buttons">
        <button type="button" class="btn primary" onclick={() => { const pending = mergeConfirm; mergeConfirm = null; const c = cmdOf(); if (pending && c) applyMerge(pending.plan, c) }}>OK</button>
        <button type="button" class="btn" onclick={() => { mergeConfirm = null; const c = cmdOf(); if (c) focusSheet(c) }}>Cancel</button>
      </div>
    {/snippet}
  </SvModal>
  <SvSheetSizeDialog
    open={sizeDialogOpen}
    title={sizeDialog === 'rows' ? 'Row Height' : 'Column Width'}
    label={sizeDialog === 'rows' ? 'Row height (px):' : 'Column width (px):'}
    value={sizeCurrent}
    onApply={applySize}
    onClose={() => (sizeDialog = null)}
  />
</div>

<style>
  /* ---- the dialogs --------------------------------------------------- */
  /* Portalled to <body>, so these rules are global: one look for Find and
     Replace, Paste Special, Format Cells and Insert Function. */
  :global(.sv-sheet-dialog) {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-family: var(--sg-font, "Segoe UI", system-ui, sans-serif);
    font-size: 13px;
    color: var(--sg-fg, #242424);
  }
  :global(.sv-sheet-dialog .field) {
    display: grid;
    grid-template-columns: 110px 1fr;
    align-items: center;
    gap: 8px;
  }
  :global(.sv-sheet-dialog .field.auto) { grid-template-columns: auto 1fr; }
  :global(.sv-sheet-dialog input[type="text"]),
  :global(.sv-sheet-dialog input[type="number"]),
  :global(.sv-sheet-dialog select) {
    height: 26px;
    padding: 0 6px;
    font: inherit;
    color: inherit;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: var(--sg-radius, 3px);
  }
  :global(.sv-sheet-dialog input[type="number"]) { width: 72px; }
  :global(.sv-sheet-dialog input[type="text"]:focus),
  :global(.sv-sheet-dialog input[type="number"]:focus),
  :global(.sv-sheet-dialog select:focus) {
    outline: none;
    border-color: var(--sg-accent, #217346);
    box-shadow: 0 0 0 1px var(--sg-accent, #217346);
  }
  :global(.sv-sheet-dialog .checks) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 16px;
  }
  :global(.sv-sheet-dialog .check) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: default;
  }
  :global(.sv-sheet-dialog .status) {
    min-height: 18px;
    margin: 0;
    color: var(--sg-muted, #616161);
  }
  :global(.sv-sheet-dialog .note) {
    margin: 0;
    line-height: 1.5;
  }
  :global(.sv-sheet-dialog-buttons) {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
  }
  :global(.sv-sheet-dialog-buttons .btn) {
    height: 26px;
    padding: 0 14px;
    font-family: var(--sg-font, "Segoe UI", system-ui, sans-serif);
    font-size: 13px;
    color: var(--sg-fg, #242424);
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: var(--sg-radius, 3px);
    cursor: pointer;
  }
  :global(.sv-sheet-dialog-buttons .btn:hover:not(:disabled)) { background: var(--sg-row-hover-bg, #f5f5f5); }
  :global(.sv-sheet-dialog-buttons .btn:disabled) { opacity: 0.5; cursor: default; }
  :global(.sv-sheet-dialog-buttons .btn.primary) {
    color: var(--sg-on-accent, #fff);
    background: var(--sg-accent, #217346);
    border-color: var(--sg-accent, #217346);
  }
  :global(.sv-sheet-dialog-buttons .btn.primary:hover:not(:disabled)) {
    background: var(--sg-accent, #217346);
    filter: brightness(1.08);
  }

  .sv-sheet {
    display: flex;
    flex-direction: column;
    gap: 0;
    /* A comment's mark is red on a spreadsheet whatever the theme, as the
       fill handle is the accent: the theme's danger colour, Excel's red
       where a theme has none. The grid's own amber is a data-grid
       convention, not a sheet's. */
    --sg-note-corner: var(--sg-danger, #c42b1c);
    font-family: var(--sg-font, "Segoe UI", system-ui, sans-serif);
    color: var(--sg-fg, #242424);
    background: var(--sg-bg-subtle, var(--sg-header-bg, #f3f3f3));
    /* A sheet's headers are 22px whatever a preset asks of a data grid's
       (Ember's are 48px), and its text is set solid: a host page's prose
       line-height must not stretch the rows. */
    --sg-header-min-height: 0px;
    line-height: 1.3;
  }
  /* height="100%": the shell is a flex item and the grid takes what the
     chrome leaves. min-height: 0 on both, or the flex item refuses to shrink
     below the grid's content and overflows exactly as a fixed height did. */
  .sv-sheet.fill {
    flex: 1 1 0;
    min-height: 0;
    height: 100%;
  }
  .sheet-grid {
    display: flex;
    flex-direction: column;
    position: relative;
    border-top: 1px solid var(--sg-border, #d9d9d9);
  }
  /* The comment editor's anchor: an invisible box laid over the cell,
     inert to the pointer so the cell under it still takes clicks. */
  /* Excel's dotted guide at the border being dragged, across the sheet. */
  /* Above the grid's sticky header (z-index 30), as Excel draws it through
     the header band too; the tip above everything the sheet draws. */
  .sheet-resize-guide {
    position: absolute;
    z-index: 40;
    pointer-events: none;
  }
  .sheet-resize-guide.col { top: 0; bottom: 0; width: 0; border-left: 1px dotted var(--sg-fg, #242424); }
  .sheet-resize-guide.row { left: 0; right: 0; height: 0; border-top: 1px dotted var(--sg-fg, #242424); }
  /* Excel's resize tip, beside the pointer while a border is dragged. */
  .sheet-resize-tip {
    position: absolute;
    z-index: 1000;
    padding: 2px 6px;
    font-size: 12px;
    line-height: 1.4;
    white-space: nowrap;
    pointer-events: none;
    color: var(--sg-fg, #242424);
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: 3px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }
  .sheet-cell-anchor {
    position: absolute;
    z-index: 7;
    pointer-events: none;
  }
  .sheet-cell-anchor .box { display: inline-block; }
  .sheet-file-input { display: none; }
  /* Circle Invalid Data: a red oval on the cell's box, over its content. */
  .sheet-invalid-circle {
    position: absolute;
    inset: 0;
    border: 1.5px solid #d03a2c;
    border-radius: 50%;
    pointer-events: none;
    z-index: 3;
  }
  /* The Input Message: Excel's small pale box under the selected cell. */
  .sheet-input-message {
    position: absolute;
    z-index: 7;
    max-width: 240px;
    padding: 4px 8px;
    font-size: 12px;
    line-height: 1.4;
    pointer-events: none;
    color: var(--sg-fg, #242424);
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: 3px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    white-space: pre-wrap;
  }
  .sheet-input-message .title { font-weight: 700; }
  /* The in-cell dropdown arrow: a small button at the cell's right edge,
     above the cell text like the note corner. */
  .sheet-dropdown-arrow {
    position: absolute;
    top: 50%;
    right: 1px;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    display: grid;
    place-items: center;
    padding: 0;
    color: var(--sg-fg, #242424);
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: 2px;
    cursor: pointer;
    z-index: 6;
  }
  .sheet-dropdown-arrow:hover { background: var(--sg-row-hover-bg, #f0f0f0); }
  /* The AutoFilter arrow on a header cell, a funnel once filtered. */
  .sheet-filter-arrow {
    position: absolute;
    top: 50%;
    right: 1px;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    display: grid;
    place-items: center;
    padding: 0;
    color: var(--sg-muted, #616161);
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: 2px;
    cursor: pointer;
    z-index: 6;
  }
  .sheet-filter-arrow:hover { background: var(--sg-row-hover-bg, #f0f0f0); }
  .sheet-filter-arrow.filtered { color: var(--sg-info, #0f6cbd); }
  /* Excel turns the row numbers of a filtered region blue. */
  .sv-sheet :global(tr.sheet-filtered > td.sv-grid-row-number-cell) { color: var(--sg-info, #0f6cbd); }
  /* A data bar behind the cell text, a third of the height off the edges
     as Excel draws it. */
  .sheet-databar {
    position: absolute;
    left: 1px;
    top: 2px;
    bottom: 2px;
    border-radius: 1px;
    opacity: 0.85;
    pointer-events: none;
  }
  /* Excel's marching ants: a dashed line on the cell's outline edges, the
     dashes walking clockwise. Drawn as background layers, one per edge, so
     it costs the compositor and nothing else; above the cell text and the
     data bar, under the editor and the note corner (z-index 6). Each layer
     is one 8px tile of the dash repeated along its edge, so sliding it a
     tile per cycle is seamless: a single full-width stretch slid the same
     way opened a gap at one end and closed it at the other, which read as
     a flicker rather than a walk. The walk is the signal that the sheet is
     in copy mode, as it is in Excel, so it is not switched off for
     prefers-reduced-motion: two pixels of dash, nothing else moves. */
  .sheet-ants {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
    --ants-on: var(--sg-fg, #242424);
    --ants-off: var(--sg-bg, #fff);
    --ants-top: none;
    --ants-bottom: none;
    --ants-left: none;
    --ants-right: none;
    background-image: var(--ants-top), var(--ants-bottom), var(--ants-left), var(--ants-right);
    background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
    background-size: 8px 2px, 8px 2px, 2px 8px, 2px 8px;
    background-position: 0 0, 0 100%, 0 0, 100% 0;
    animation: sheet-ants 0.35s linear infinite;
  }
  .sheet-ants.top { --ants-top: linear-gradient(to right, var(--ants-on) 0 4px, var(--ants-off) 4px 8px); }
  .sheet-ants.bottom { --ants-bottom: linear-gradient(to right, var(--ants-on) 0 4px, var(--ants-off) 4px 8px); }
  .sheet-ants.left { --ants-left: linear-gradient(to bottom, var(--ants-on) 0 4px, var(--ants-off) 4px 8px); }
  .sheet-ants.right { --ants-right: linear-gradient(to bottom, var(--ants-on) 0 4px, var(--ants-off) 4px 8px); }
  @keyframes sheet-ants {
    to { background-position: 8px 0, -8px 100%, 0 -8px, 100% 8px; }
  }
  /* An icon at the left of the cell; the text keeps its own alignment. */
  .sheet-cell.has-icon { padding-left: 20px; }
  .sheet-cf-icon {
    position: absolute;
    left: 4px;
    top: 50%;
    transform: translateY(-50%);
  }
  /* Show All Comments: a strip under the formula bar. */
  .sheet-comments {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    max-height: 96px;
    overflow-y: auto;
    padding: 4px 8px;
    font-size: 12px;
    border-top: 1px solid var(--sg-border, #d9d9d9);
    background: var(--sg-bg-subtle, #f3f3f3);
  }
  .sheet-comments .none { color: var(--sg-muted, #616161); }
  .sheet-comments .entry {
    display: inline-flex;
    gap: 6px;
    max-width: 320px;
    padding: 2px 8px;
    font: inherit;
    color: inherit;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d9d9d9);
    border-radius: 3px;
    cursor: pointer;
  }
  .sheet-comments .entry:hover { background: var(--sg-row-hover-bg, #f0f0f0); }
  .sheet-comments .addr { font-weight: 600; color: var(--sg-muted, #616161); }
  .sheet-comments .text {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .sheet-grid.fill {
    flex: 1 1 0;
    min-height: 0;
  }
  /* The formula bar sits on the ribbon's grey ground, as it does in Excel. */
  .sv-sheet > :global(.sv-formula-bar) {
    margin: 4px 6px;
  }
  .sv-sheet > :global(.sv-ribbon) {
    border-left: 0;
    border-right: 0;
    border-top: 0;
    border-radius: 0;
  }

  /*
   * Excel's own palette, light and dark with the page, for `look="excel"`.
   * Tokens, so every part underneath - the grid included - picks them up.
   * The default look leaves every token to the host's theme.
   */
  .sv-sheet.look-excel {
    /* Excel's note mark is a red triangle. */
    --sg-note-corner: #c42b1c;
    --sg-bg: #ffffff;
    --sg-fg: #242424;
    --sg-muted: #616161;
    --sg-border: #d9d9d9;
    --sg-header-bg: #f3f3f3;
    --sg-header-fg: #444444;
    --sg-bg-subtle: #f3f3f3;
    --sg-row-alt-bg: #ffffff;
    --sg-row-hover-bg: #f0f0f0;
    --sg-muted-bg: #e6e6e6;
    --sg-selection-bg: rgba(16, 124, 65, 0.12);
    --sg-input-bg: #ffffff;
    --sg-input-border: #c8c6c4;
    --sg-accent: #107c41;
    --sg-on-accent: #ffffff;
    --sg-focus-ring: #107c41;
    --sg-success: #107c41;
    --sg-info: #0f6cbd;
    --sg-warning: #f2c811;
    --sg-danger: #c42b1c;
    --sg-radius: 0px;
    --sg-radius-lg: 6px;
    --sg-font: "Aptos", "Aptos Narrow", "Segoe UI", Calibri, Arial, sans-serif;
  }
  :global([data-theme="dark"]) .sv-sheet.look-excel {
    --sg-bg: #1f1f1f;
    --sg-fg: #e6e6e6;
    --sg-muted: #a6a6a6;
    --sg-border: #3d3d3d;
    --sg-header-bg: #2b2b2b;
    --sg-header-fg: #d0d0d0;
    --sg-bg-subtle: #292929;
    --sg-row-alt-bg: #1f1f1f;
    --sg-row-hover-bg: #363636;
    --sg-muted-bg: #404040;
    --sg-selection-bg: rgba(63, 166, 110, 0.2);
    --sg-input-bg: #262626;
    --sg-input-border: #4a4a4a;
    --sg-accent: #3fa66e;
    --sg-on-accent: #ffffff;
    --sg-focus-ring: #3fa66e;
    --sg-success: #3fa66e;
    --sg-info: #4cc2ff;
    --sg-warning: #f2c811;
    --sg-danger: #f1707b;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme="light"])) .sv-sheet.look-excel {
      --sg-bg: #1f1f1f;
      --sg-fg: #e6e6e6;
      --sg-muted: #a6a6a6;
      --sg-border: #3d3d3d;
      --sg-header-bg: #2b2b2b;
      --sg-header-fg: #d0d0d0;
      --sg-bg-subtle: #292929;
      --sg-row-alt-bg: #1f1f1f;
      --sg-row-hover-bg: #363636;
      --sg-muted-bg: #404040;
      --sg-selection-bg: rgba(63, 166, 110, 0.2);
      --sg-input-bg: #262626;
      --sg-input-border: #4a4a4a;
      --sg-accent: #3fa66e;
      --sg-on-accent: #ffffff;
      --sg-focus-ring: #3fa66e;
      --sg-success: #3fa66e;
      --sg-info: #4cc2ff;
      --sg-warning: #f2c811;
      --sg-danger: #f1707b;
    }
  }

  /* ---- the sheet's geometry ------------------------------------------ */
  /* Column letters: 22px, centred, plain weight; the gutter to match. */
  .sv-sheet :global(.sv-grid-head .sv-grid-column) {
    height: 22px;
    padding: 0;
    font-size: 12px;
    font-weight: 400;
    color: var(--sg-header-fg, var(--sg-muted, #444));
  }
  .sv-sheet :global(.sv-grid-head .sv-grid-column .sv-grid-header-cell) {
    justify-content: center;
  }
  .sv-sheet :global(.sv-grid-head .sv-grid-column .sv-grid-header-sort) {
    justify-content: center;
  }
  /* Row numbers are centred in the gutter, as Excel's are. */
  .sv-sheet :global(.sv-grid-row-number-cell) {
    font-size: 12px;
    padding: 0 4px;
    line-height: 1.3;
    text-align: center;
  }
  .sv-sheet :global(.sv-grid-head .sv-grid-column),
  .sv-sheet :global(td.sv-grid-cell) {
    line-height: 1.3;
  }
  /*
   * Header borders, as Excel draws them: a hairline between every column
   * letter and under the header row, a hairline between every row number
   * and to the right of the gutter, and the Select All corner framed by
   * both. The grid fuses the gutter into the header band by painting its
   * right edge in the header colour; a sheet wants the line.
   */
  .sv-sheet :global(.sv-grid-head .sv-grid-column) {
    border-right: 1px solid var(--sg-border, #d9d9d9);
    border-bottom: 1px solid var(--sg-border, #d9d9d9);
  }
  /* A hidden column's letter takes no room at all: the hairline above
     would keep it a pixel wide. Its neighbours' lines meet at the seam,
     which is the doubled line Excel draws where a column is hidden. */
  .sv-sheet :global(.sv-grid-head .sv-grid-column.sv-grid-column-collapsed) {
    border-right-width: 0;
  }
  /*
   * Where a column or a row is hidden, Excel thickens the header line at
   * the seam so the gap in the letters or numbers has a mark. The letter
   * after the fold carries a 2px left edge (a border, since the header's
   * selection shading uses its box-shadow); the number after hidden rows
   * a 2px top edge painted on a pseudo-element, since a border there would
   * push the row a pixel taller than the virtualizer laid it out.
   */
  .sv-sheet :global(.sv-grid-head .sv-grid-column.sv-grid-column-collapsed + .sv-grid-column:not(.sv-grid-column-collapsed)) {
    border-left: 2px solid var(--sg-muted, #8a8a8a);
  }
  .sv-sheet :global(tr.sv-grid-row-collapsed + tr:not(.sv-grid-row-collapsed) > td.sv-grid-row-number-cell::before) {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 2px;
    background: var(--sg-muted, #8a8a8a);
    pointer-events: none;
  }
  .sv-sheet :global(.sv-grid-row-number-column),
  .sv-sheet :global(.sv-grid-row-number-cell) {
    border-right: 1px solid var(--sg-border, #d9d9d9);
  }
  /*
   * Excel shades the headers the selection touches - a step darker than the
   * header band, mixed from the text colour so it lands right on a dark
   * theme too - and marks them with a 2px line in the accent along the edge
   * that faces the cells. The line sits over the hairline, as Excel's does.
   */
  /* A column or row selected whole: the accent, white on green, as Excel's. */
  .sv-sheet :global(th.sheet-col-whole),
  .sv-sheet :global(th.sheet-col-whole .sv-grid-header-cell),
  .sv-sheet :global(td.sv-grid-row-number-cell.sheet-row-whole) {
    background: var(--sg-accent, #217346) !important;
    color: var(--sg-on-accent, #fff) !important;
  }
  .sv-sheet :global(th.sheet-col-selected) {
    background: color-mix(in srgb, var(--sg-fg, #242424) 13%, var(--sg-header-bg, #f3f3f3) 87%);
    color: var(--sg-fg, #242424);
    box-shadow: inset 0 -2px 0 0 var(--sg-accent, #107c41);
  }
  .sv-sheet :global(tr:has(> td.sv-grid-cell-active) > td.sv-grid-row-number-cell),
  .sv-sheet :global(tr:has(> td[data-selected-range="true"]) > td.sv-grid-row-number-cell) {
    background: color-mix(in srgb, var(--sg-fg, #242424) 13%, var(--sg-header-bg, #f3f3f3) 87%);
    color: var(--sg-fg, #242424);
    box-shadow: inset -2px 0 0 0 var(--sg-accent, #107c41);
  }
  /* No hover wash on cells: a sheet does not light rows up under the mouse. */
  .sv-sheet :global(tbody tr:hover > .sv-grid-cell:not([data-selected-range="true"]):not(.sv-grid-row-number-cell)) {
    background-color: var(--sg-bg, #fff);
  }
  .sv-sheet :global(.sv-grid-cell) {
    font-size: 13px;
  }

  /*
   * The selection rectangle, as Excel draws it: the range tinted and framed
   * by a 2px line in the accent, the active cell inside it left unshaded
   * with no ring of its own (the frame is the ring), and the fill handle a
   * small square on the bottom-right corner, ringed in the sheet colour so
   * it reads against the frame. A lone active cell is a one-cell range and
   * gets the same frame, white inside.
   *
   * Painted on a pseudo-element ABOVE the cell's content rather than on the
   * td itself. The grid draws the tint as the td's background and the frame
   * as inset shadows, both of which sit under the td's children - and the
   * sheet's cell span now covers the whole td, so on a filled cell the
   * selection vanished under the fill. The overlay is translucent, so a
   * fill inside a selection reads a shade darker, which is what Excel shows.
   *
   * The tint is the theme's accent at a low alpha, not `--sg-selection-bg`:
   * that token is an opaque surface in most themes (Ember's is #ffece3),
   * and an opaque overlay above the content hid the text of every selected
   * cell but the active one. Excel's own tint is its green at 12%.
   */
  .sv-sheet :global(td.sv-grid-cell[data-selected-range="true"]),
  .sv-sheet :global(td.sv-grid-cell-active) {
    background: var(--sg-bg, #fff);
    box-shadow: none;
  }
  .sv-sheet :global(td.sv-grid-cell[data-selected-range="true"]::after),
  .sv-sheet :global(td.sv-grid-cell-active::after) {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background: color-mix(in srgb, var(--sg-accent, #107c41) 14%, transparent);
    box-shadow: var(--sv-range-top), var(--sv-range-bottom), var(--sv-range-left), var(--sv-range-right);
  }
  /* The active cell: no tint, and a frame of its own only when it is not
     inside a range, whose frame it otherwise shares. Written out with the
     range attribute so it outranks the tint rule above; with a shorter
     selector the active cell inside a range was tinted like the rest, and
     Excel leaves it white. */
  .sv-sheet :global(td.sv-grid-cell-active::after),
  .sv-sheet :global(td.sv-grid-cell.sv-grid-cell-active[data-selected-range="true"]::after) {
    background: transparent;
  }
  .sv-sheet :global(td.sv-grid-cell-active:not([data-selected-range="true"])::after) {
    box-shadow: inset 0 0 0 2px var(--sg-accent, #107c41);
  }
  /* Nothing over the editor while a cell is being typed into. */
  .sv-sheet :global(td.sv-grid-cell-editing::after) {
    display: none;
  }
  .sv-sheet :global(.sv-grid-fill-handle) {
    width: 8px;
    height: 8px;
    right: -1px;
    bottom: -1px;
    border: 1px solid var(--sg-bg, #fff);
    border-radius: 0;
  }
  .sv-sheet :global(.sv-grid-fill-handle:hover) {
    transform: none;
  }

  /* Headers respond to the pointer the way Excel's do: a shade darker under
     it, and the cursor says what a click will select. */
  .sv-sheet :global(.sv-grid-head .sv-grid-column:hover),
  .sv-sheet :global(td.sv-grid-row-number-cell:hover) {
    background: color-mix(in srgb, var(--sg-fg, #242424) 7%, var(--sg-header-bg, #f3f3f3) 93%);
  }
  /*
   * Excel's cursors: the white cross over the cells, a black arrow pointing
   * down the column over a letter and along the row over a number (drawn,
   * since no CSS cursor is one; the hotspot is the tip), the plain arrow
   * over the corner, and the double-headed arrows on the borders. The
   * fill handle's crosshair and the selection border's move cursor are
   * the grid's own.
   */
  .sv-sheet :global(td.sv-grid-cell:not(.sv-grid-row-number-cell):not(.sv-grid-cell-editing)) { cursor: cell; }
  .sv-sheet :global(.sv-grid-head .sv-grid-column[data-svgrid-header-col]),
  .sv-sheet :global(.sv-grid-head .sv-grid-column[data-svgrid-header-col] .sv-grid-header-sort),
  .sv-sheet :global(.sv-grid-head .sv-grid-column[data-svgrid-header-col] .sv-grid-header-cell) { cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'><path d='M8 14.5L2.2 8.2h3.6V1.5h4.4v6.7h3.6z' fill='%23000' stroke='%23fff' stroke-width='1.2' stroke-linejoin='round'/></svg>") 8 15, pointer; }
  .sv-sheet :global(td.sv-grid-row-number-cell) { cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'><path d='M14.5 8L8.2 13.8v-3.6H1.5V5.8h6.7V2.2z' fill='%23000' stroke='%23fff' stroke-width='1.2' stroke-linejoin='round'/></svg>") 15 8, pointer; }
  .sv-sheet :global(th.sv-grid-row-number-column) { cursor: default; }
  .sv-sheet :global(.sv-grid-resize-handle) { cursor: col-resize; }
  .sv-sheet :global(.sv-grid-row-resize-handle) { cursor: row-resize; }

  /* The in-cell editor, widened over the neighbours while a long formula
     is typed: the cell it sits in is already lifted above the row. */
  .sv-sheet :global(td.sv-grid-cell-editing) { overflow: visible; }
  .sv-sheet :global(td.sv-grid-cell-editing .sv-grid-cell-editor) {
    position: relative;
    z-index: 2;
    max-width: none;
    background: var(--sg-bg, #fff);
  }

  /* A cell a formula in progress refers to, in that reference's colour.
     An overlay too, for the same reason as the selection's: a filled cell
     would otherwise hide it. Translucent, so the fill shows through. */
  .sv-sheet :global(td[data-sheet-ref]::before) {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    box-shadow: var(--sheet-ref-edges, none);
    background: color-mix(in srgb, var(--sheet-ref) 12%, transparent);
  }
  /* The editor's text under the coloured mirror: only the caret shows. */
  .sv-sheet :global(.sv-grid-cell-editor.sheet-ref-text) {
    color: transparent;
    caret-color: var(--sg-fg, #242424);
  }
  /* Format Painter armed: a brush for a pointer, as Excel shows. */
  .sheet-grid.painting :global(td.sv-grid-cell) {
    cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 18 18'><path d='M10.2 2.4l5.4 5.4-3.6 3.6-5.4-5.4z' fill='%23fff' stroke='%23222' stroke-width='1.4' stroke-linejoin='round'/><path d='M6.6 6L3.2 9.4a1.8 1.8 0 0 0 0 2.6l2.8 2.8a1.8 1.8 0 0 0 2.6 0L12 11.4' fill='none' stroke='%23222' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/></svg>") 3 15, cell;
  }
  .sv-sheet :global(.sheet-ref-mirror) {
    position: absolute;
    z-index: 21;
    overflow: hidden;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    color: var(--sg-fg, #242424);
    pointer-events: none;
    background: transparent;
  }

  /* The Select All corner: a triangle pointing into the sheet. */
  .corner {
    display: block;
    width: 100%;
    height: 100%;
    position: relative;
  }
  .corner::after {
    content: "";
    position: absolute;
    right: 3px;
    bottom: 3px;
    border-style: solid;
    border-width: 0 0 9px 9px;
    border-color: transparent transparent var(--sg-muted, #b0b0b0) transparent;
  }

  /*
   * A sheet cell fills its td edge to edge, so a fill colour reaches the
   * gridlines the way it does in Excel rather than leaving a halo of cell
   * background around it.
   *
   * The grid pads a left-aligned td by 12px and a block child only rises to
   * its own line height, so a fill used to stop short on the left and leave
   * a hairline top and bottom. The td gives up its padding and the span is
   * laid over the td's whole box instead, and does its own padding. A grid
   * container rather than a block so the text centres vertically at any row
   * height, including one the user has dragged taller. Text that does not
   * fit is cut at the edge, as Excel cuts it, not ellipsised.
   */
  .sv-sheet :global(td.sv-grid-cell:not(.sv-grid-row-number-cell)) {
    padding: 0;
    position: relative;
  }
  .sheet-cell {
    position: absolute;
    inset: 0;
    display: grid;
    align-items: center;
    padding: 0 4px;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
  }
  .sheet-cell.formula {
    font-family: ui-monospace, Menlo, monospace;
    color: var(--sg-accent, #107c41);
  }

  /*
   * Text spilling over empty neighbours, as in Excel. The grid's td clips
   * its content; for a spilling cell it is opened up, and the span grows to
   * its text (capped at the run of empty cells) and paints its own
   * background over the neighbours, which also hides the gridlines under
   * the text the way Excel does. z-index lifts it above the later tds in
   * the row, which would otherwise paint over it in DOM order.
   */
  .sv-sheet :global(td.sv-grid-cell:has(> .sheet-cell.spill)) {
    overflow: visible;
  }
  .sheet-cell.spill {
    right: auto;
    z-index: 1;
    width: max-content;
    min-width: 100%;
    background: var(--sg-bg, #fff);
  }

  /* ---- View > Show --------------------------------------------------- */
  /* Gridlines off keeps the cell geometry (the borders go transparent, so
     nothing shifts) and leaves the borders a cell has of its own. */
  .sv-sheet.no-gridlines :global(td.sv-grid-cell) { border-color: transparent; }
  .sv-sheet.no-headings :global(.sv-grid-head) { display: none; }

  /* ---- status bar ---------------------------------------------------- */
  .status {
    display: flex;
    align-items: center;
    gap: 18px;
    height: 22px;
    padding: 0 10px;
    font-size: 12px;
    /* Explicit: a host page that uppercases small text turns "Count" into
       "COUNT", which reads as shouting rather than as a status bar. */
    text-transform: none;
    letter-spacing: normal;
    color: var(--sg-fg, #242424);
    border-top: 1px solid var(--sg-border, #d9d9d9);
    background: var(--sg-header-bg, #f3f3f3);
  }
  .status .grow { flex: 1 1 auto; }
  .status .mode { color: var(--sg-muted, #616161); }
  .status b {
    font-weight: 400;
    font-variant-numeric: tabular-nums;
  }
</style>
