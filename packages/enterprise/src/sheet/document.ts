/**
 * The sheet document: the workbook plus everything a sheet keeps beside its
 * cells, per sheet, in one model.
 *
 * The shell used to keep five Maps (format stores, column widths, row
 * heights, hidden lines, frozen panes), each keyed by sheet name, each
 * swapped on a sheet switch and each moved by hand on an insert or delete.
 * Comments, validation rules, conditional formats, protection and merges
 * would have made it ten. The document holds all of it, moves all of it in
 * one `shift()` when rows or columns are inserted or deleted, saves and
 * restores all of it through one `getState()` / `setState()` pair, and tells
 * a listener once per tick what changed. `SvSheet` is a view over it: it
 * puts the active sheet's sizes and hidden lines on the grid and writes
 * them back here whenever they change, so the document is always the
 * truth and the grid a rendering of it.
 *
 * Nothing in here touches the DOM, so a document can be built, edited,
 * saved and restored in Node, in a test, or on a server.
 */
import { createWorkbook, type Workbook, type SheetData } from './workbook'
import { createFormatStore, type SheetFormatStore, type CellFormatEntry } from './format-store'
import type { FreezeState } from './freeze'
import type { StructuralEdit } from './refs'
import { lineShift, remapNotes, shiftRect, type Rect } from './rects'
import type { CommentsMap, CommentValue } from './comments'
import { copyProtection, defaultProtection, type SheetProtection } from './protection'
import { copyPageSetup, defaultPageSetup, shiftPageSetup, type PageSetup } from './page-setup'
import { copyObject, objectId, shiftObjects, type SheetObject } from './objects'
import { copySparkline, shiftSparklines, sparklineId, type SparklineGroup } from './sparklines'
import { copyPivot, pivotId, shiftPivots, type SheetPivot } from './pivot-range'
import { copyLinks, shiftLinks, type LinksMap } from './links'
import { colToLetters, lettersToCol } from './address'
import { shiftValidation, type ValidationRule } from './validation'
import { shiftCf, type CfRule } from './conditional-formats'
import { shiftAutoFilter, type AutoFilterState } from './auto-filter'

/** Why the document changed. A listener gets every reason since its last call. */
export type SheetChangeReason =
  | { kind: 'cells' }
  | { kind: 'formats' }
  | { kind: 'sizes' }
  | { kind: 'hidden' }
  | { kind: 'freeze' }
  | { kind: 'sheets' }
  | { kind: 'comments' }
  | { kind: 'validation' }
  | { kind: 'conditional-formats' }
  | { kind: 'protection' }
  | { kind: 'page-setup' }
  | { kind: 'objects' }
  | { kind: 'sparklines' }
  | { kind: 'pivots' }
  | { kind: 'links' }
  | { kind: 'tables' }
  /**
   * The workbook's own parts rather than a sheet's: its defined names and
   * its calculation settings. They belong to no sheet, so nothing keyed by
   * sheet can carry them, and a listener that mirrors a document elsewhere
   * has to hear about them separately.
   */
  | { kind: 'workbook' }
  | { kind: 'merges' }
  | { kind: 'filter' }
  | { kind: 'structure'; sheet: string; edit: StructuralEdit }
  | { kind: 'restore' }

/** What one sheet keeps beside its cells. Live objects, not a snapshot. */
export type PerSheetState = {
  formats: SheetFormatStore
  /** Column widths in px by letter; a letter absent here reads the default. */
  widths: Record<string, number>
  /** Row heights in px by row index; a row absent here reads the default. */
  heights: Map<number, number>
  hidden: { rows: Set<number>; cols: Set<number> }
  freeze: FreezeState
  /** Cell comments keyed like the grid's `notes`: `r4` -> `B` -> a note's text or a thread. */
  notes: CommentsMap
  protected: boolean
  /** What stays allowed while protected, and the ranges that take an edit anyway. */
  protection: SheetProtection
  /** Page Layout: orientation, paper, margins, print area, title rows, gridlines, headings, scale. */
  pageSetup: PageSetup
  /** Charts and pictures anchored over the cells, back to front. */
  objects: SheetObject[]
  sparklines: SparklineGroup[]
  pivots: SheetPivot[]
  /** Hyperlinks by cell, keyed like the comments: `r4` -> `B` -> the link. */
  links: LinksMap
  /** Excel's Hide Sheet: the tab is not shown and the shortcuts skip it. */
  sheetHidden: boolean
  merges: Rect[]
  /** Data validation rules, in order; the last one covering a cell applies. */
  validation: ValidationRule[]
  /** Conditional formatting rules, in priority order: the first one decides. */
  conditionalFormats: CfRule[]
  /** Excel's AutoFilter over a region, or null when the arrows are off. */
  autoFilter: AutoFilterState | null
  /** The rows the AutoFilter hides right now; worked out, never saved. */
  filterHidden: Set<number>
}

/** One sheet's part of a saved document. JSON-safe. */
export type SheetStateEntry = {
  formats: Record<string, CellFormatEntry>
  columnWidths: Record<string, number>
  rowHeights: Array<[row: number, px: number]>
  hidden: { rows: number[]; cols: number[] }
  freeze: FreezeState
  /** `r4` -> `B` -> a note's text, or a thread with its author, replies and state. */
  comments: CommentsMap
  protected: boolean
  /** Absent in documents saved before the allow list and edit ranges existed. */
  protection?: SheetProtection
  /** Absent in documents saved before Page Layout existed. */
  pageSetup?: PageSetup
  /** Absent in documents saved before objects existed. */
  objects?: SheetObject[]
  /** Absent in documents saved before sparklines existed. */
  sparklines?: SparklineGroup[]
  /** Absent in documents saved before pivots existed. */
  pivots?: SheetPivot[]
  /** Absent in documents saved before hyperlinks existed. */
  links?: LinksMap
  /** Absent in documents saved before hidden sheets existed. */
  sheetHidden?: boolean
  merges: Array<[number, number, number, number]>
  validation: ValidationRule[]
  conditionalFormats: CfRule[]
  autoFilter: AutoFilterState | null
}

/**
 * A saved document. `workbook` is the raw text of every cell (formulas as
 * typed), the sheet order, the active sheet and the defined names; `sheets`
 * is keyed by the sheet's spelled name.
 */
export type SheetState = {
  version: 1
  workbook: ReturnType<Workbook['serialize']>
  sheets: Record<string, SheetStateEntry>
}

export type SheetDocument = {
  readonly workbook: Workbook
  /** The sheet's state, created on first use. Names compare case-insensitively. */
  get(name: string): PerSheetState
  has(name: string): boolean
  rename(from: string, to: string): void
  remove(name: string): void
  /**
   * Excel's Move or Copy > Create a copy: a new sheet after `from` with
   * its cells and everything this document keeps beside them, named `to`
   * or "Name (2)". Returns the new name, or null when it could not.
   */
  duplicate(from: string, to?: string): string | null
  /** The sheets that have state, in no particular order. */
  names(): string[]
  /**
   * Move every position-keyed part of a sheet for an insert or delete:
   * formats, heights, hidden lines, comments, merges. The workbook's own
   * cells and formulas move through `workbook.applyStructuralEdit`; the
   * shell calls both.
   */
  shift(name: string, edit: StructuralEdit): void
  getState(): SheetState
  /**
   * Put a saved document back. The workbook is edited in place (sheets
   * added, removed and reordered to match, cells written where they differ,
   * names and the active sheet set), so the workbook a consumer holds stays
   * the same object.
   */
  setState(state: SheetState): void
  /** Hear about changes, once per tick with every reason since the last call. */
  subscribe(listener: (reasons: ReadonlyArray<SheetChangeReason>) => void): () => void
  /**
   * Put back only the parts `entry` names, leaving the rest of the sheet as
   * it is: what a delta from another user applies, and what a host that
   * wants to set one feature calls. Reports the change, so the shell
   * repaints; wrap it in `mute` where it should not.
   */
  patch(name: string, entry: Partial<SheetStateEntry>): void
  /** Record a change. Coalesced per microtask; silent while muted. */
  changed(reason: SheetChangeReason): void
  /** Run `fn` without reporting changes: restores and mount-time seeding. */
  mute<T>(fn: () => T): T
}

export type SheetDocumentInit = {
  /** An existing workbook to wrap. Created from `sheets` or `state` when absent. */
  workbook?: Workbook
  sheets?: ReadonlyArray<SheetData>
  /** A saved document to start from; wins over `sheets`. */
  state?: SheetState
}

/** Which change a patched part of a sheet counts as, so listeners hear it. */
function reasonsForEntry(entry: Partial<SheetStateEntry>): SheetChangeReason[] {
  const out: SheetChangeReason[] = []
  if (entry.formats !== undefined) out.push({ kind: 'formats' })
  if (entry.columnWidths !== undefined || entry.rowHeights !== undefined) out.push({ kind: 'sizes' })
  if (entry.hidden !== undefined || entry.sheetHidden !== undefined) out.push({ kind: 'hidden' })
  if (entry.freeze !== undefined) out.push({ kind: 'freeze' })
  if (entry.comments !== undefined) out.push({ kind: 'comments' })
  if (entry.protected !== undefined || entry.protection !== undefined) out.push({ kind: 'protection' })
  if (entry.pageSetup !== undefined) out.push({ kind: 'page-setup' })
  if (entry.objects !== undefined) out.push({ kind: 'objects' })
  if (entry.sparklines !== undefined) out.push({ kind: 'sparklines' })
  if (entry.pivots !== undefined) out.push({ kind: 'pivots' })
  if (entry.links !== undefined) out.push({ kind: 'links' })
  if (entry.merges !== undefined) out.push({ kind: 'merges' })
  if (entry.validation !== undefined) out.push({ kind: 'validation' })
  if (entry.conditionalFormats !== undefined) out.push({ kind: 'conditional-formats' })
  if (entry.autoFilter !== undefined) out.push({ kind: 'filter' })
  return out
}


function emptySheetState(): PerSheetState {
  return {
    formats: createFormatStore(),
    widths: {},
    heights: new Map(),
    hidden: { rows: new Set(), cols: new Set() },
    freeze: { rows: 0, cols: 0 },
    notes: {},
    protected: false,
    protection: defaultProtection(),
    pageSetup: defaultPageSetup(),
    objects: [],
    sparklines: [],
    pivots: [],
    links: {},
    sheetHidden: false,
    merges: [],
    validation: [],
    conditionalFormats: [],
    autoFilter: null,
    filterHidden: new Set(),
  }
}

export function createSheetDocument(init: SheetDocumentInit = {}): SheetDocument {
  const workbook: Workbook =
    init.workbook ??
    createWorkbook(
      init.state ? init.state.workbook.sheets.map((s) => ({ name: s.name, cells: s.cells })) : (init.sheets ? [...init.sheets] : [{ name: 'Sheet1', cells: [] }]),
      {
        ...(init.state?.workbook.tables?.length ? { tables: init.state.workbook.tables } : {}),
        ...(init.state?.workbook.iteration ? { iteration: init.state.workbook.iteration } : {}),
      },
    )
  const entries = new Map<string, PerSheetState>()
  const listeners = new Set<(reasons: ReadonlyArray<SheetChangeReason>) => void>()
  let pending: SheetChangeReason[] = []
  let scheduled = false
  let muted = 0

  const key = (name: string) => name.toLowerCase()

  function get(name: string): PerSheetState {
    let found = entries.get(key(name))
    if (!found) {
      found = emptySheetState()
      entries.set(key(name), found)
    }
    return found
  }

  function flush() {
    scheduled = false
    const batch = pending
    pending = []
    for (const listener of listeners) listener(batch)
  }

  function changed(reason: SheetChangeReason) {
    if (muted > 0) return
    // The same plain reason twice in a tick says nothing new; a structural
    // edit is worth hearing about each time.
    if (reason.kind !== 'structure' && pending.some((r) => r.kind === reason.kind)) return
    pending.push(reason)
    if (scheduled) return
    scheduled = true
    queueMicrotask(flush)
  }

  /** A row of comments copied deep enough that a saved thread is not the live one. */
  function copyLine(line: Record<string, CommentValue>): Record<string, CommentValue> {
    const out: Record<string, CommentValue> = {}
    for (const [c, v] of Object.entries(line)) out[c] = typeof v === 'string' ? v : { ...v, ...(v.replies ? { replies: v.replies.map((r) => ({ ...r })) } : {}) }
    return out
  }

  function serializeEntry(state: PerSheetState): SheetStateEntry {
    return {
      formats: state.formats.serialize(),
      columnWidths: { ...state.widths },
      rowHeights: [...state.heights].map(([r, h]) => [r, h] as [number, number]),
      hidden: { rows: [...state.hidden.rows], cols: [...state.hidden.cols] },
      freeze: { ...state.freeze },
      comments: Object.fromEntries(Object.entries(state.notes).map(([r, line]) => [r, copyLine(line)])),
      protected: state.protected,
      protection: copyProtection(state.protection),
      pageSetup: copyPageSetup(state.pageSetup),
      objects: state.objects.map(copyObject),
      sparklines: state.sparklines.map(copySparkline),
      pivots: state.pivots.map(copyPivot),
      links: copyLinks(state.links),
      sheetHidden: state.sheetHidden,
      merges: state.merges.map(([r1, c1, r2, c2]) => [r1, c1, r2, c2] as [number, number, number, number]),
      validation: state.validation.map((rule) => ({ ...rule, rects: rule.rects.map((r) => [...r] as unknown as Rect), alert: { ...rule.alert } })),
      conditionalFormats: state.conditionalFormats.map((rule) => ({ ...rule, rects: rule.rects.map((r) => [...r] as unknown as Rect) })),
      autoFilter: state.autoFilter ? { range: [...state.autoFilter.range] as unknown as Rect, filters: { ...state.autoFilter.filters } } : null,
    }
  }

  /**
   * Put back only the parts an entry names, leaving the rest as they are.
   * `hydrateEntry` below is the whole-sheet version, which resets what is
   * absent to its default; this one is what a delta applies, since a delta
   * carries the one feature that changed.
   */
  function patchEntry(state: PerSheetState, entry: Partial<SheetStateEntry>) {
    if (entry.formats !== undefined) state.formats.hydrate(entry.formats)
    if (entry.columnWidths !== undefined) state.widths = { ...entry.columnWidths }
    if (entry.rowHeights !== undefined) state.heights = new Map(entry.rowHeights)
    if (entry.hidden !== undefined) state.hidden = { rows: new Set(entry.hidden.rows ?? []), cols: new Set(entry.hidden.cols ?? []) }
    if (entry.freeze !== undefined) state.freeze = { rows: entry.freeze.rows ?? 0, cols: entry.freeze.cols ?? 0 }
    if (entry.comments !== undefined) state.notes = Object.fromEntries(Object.entries(entry.comments).map(([r, line]) => [r, copyLine(line)]))
    if (entry.protected !== undefined) state.protected = entry.protected
    if (entry.protection !== undefined) state.protection = copyProtection({ allow: entry.protection.allow ?? {}, ranges: entry.protection.ranges ?? [] })
    if (entry.pageSetup !== undefined) state.pageSetup = copyPageSetup({ ...defaultPageSetup(), ...entry.pageSetup })
    if (entry.objects !== undefined) state.objects = entry.objects.map(copyObject)
    if (entry.sparklines !== undefined) state.sparklines = entry.sparklines.map(copySparkline)
    if (entry.pivots !== undefined) state.pivots = entry.pivots.map(copyPivot)
    if (entry.links !== undefined) state.links = copyLinks(entry.links)
    if (entry.sheetHidden !== undefined) state.sheetHidden = entry.sheetHidden
    if (entry.merges !== undefined) state.merges = entry.merges.map(([r1, c1, r2, c2]) => [r1, c1, r2, c2] as const)
    if (entry.validation !== undefined) {
      state.validation = entry.validation.map((rule) => ({
        ...rule,
        rects: rule.rects.map(([r1, c1, r2, c2]) => [r1, c1, r2, c2] as const),
        alert: { ...rule.alert },
      }))
    }
    if (entry.conditionalFormats !== undefined) {
      state.conditionalFormats = entry.conditionalFormats.map((rule) => ({
        ...rule,
        rects: rule.rects.map(([r1, c1, r2, c2]) => [r1, c1, r2, c2] as const),
      }))
    }
    if (entry.autoFilter !== undefined) {
      const af = entry.autoFilter
      state.autoFilter = af ? { range: [af.range[0], af.range[1], af.range[2], af.range[3]] as const, filters: { ...af.filters } } : null
      state.filterHidden = new Set()
    }
  }

  function hydrateEntry(state: PerSheetState, entry: Partial<SheetStateEntry>) {
    state.formats.hydrate(entry.formats ?? {})
    state.widths = { ...(entry.columnWidths ?? {}) }
    state.heights = new Map(entry.rowHeights ?? [])
    state.hidden = { rows: new Set(entry.hidden?.rows ?? []), cols: new Set(entry.hidden?.cols ?? []) }
    state.freeze = { rows: entry.freeze?.rows ?? 0, cols: entry.freeze?.cols ?? 0 }
    state.notes = Object.fromEntries(Object.entries(entry.comments ?? {}).map(([r, line]) => [r, copyLine(line)]))
    state.protected = entry.protected ?? false
    state.protection = entry.protection ? copyProtection({ allow: entry.protection.allow ?? {}, ranges: entry.protection.ranges ?? [] }) : defaultProtection()
    state.pageSetup = entry.pageSetup ? copyPageSetup({ ...defaultPageSetup(), ...entry.pageSetup }) : defaultPageSetup()
    state.objects = (entry.objects ?? []).map(copyObject)
    state.sparklines = (entry.sparklines ?? []).map(copySparkline)
    state.pivots = (entry.pivots ?? []).map(copyPivot)
    state.links = copyLinks(entry.links ?? {})
    state.sheetHidden = entry.sheetHidden ?? false
    state.merges = (entry.merges ?? []).map(([r1, c1, r2, c2]) => [r1, c1, r2, c2] as const)
    state.validation = (entry.validation ?? []).map((rule) => ({
      ...rule,
      rects: rule.rects.map(([r1, c1, r2, c2]) => [r1, c1, r2, c2] as const),
      alert: { ...rule.alert },
    }))
    state.conditionalFormats = (entry.conditionalFormats ?? []).map((rule) => ({
      ...rule,
      rects: rule.rects.map(([r1, c1, r2, c2]) => [r1, c1, r2, c2] as const),
    }))
    const af = entry.autoFilter
    state.autoFilter = af ? { range: [af.range[0], af.range[1], af.range[2], af.range[3]] as const, filters: { ...af.filters } } : null
    state.filterHidden = new Set()
  }

  const document: SheetDocument = {
    workbook,
    get,
    patch(name, entry) {
      patchEntry(get(name), entry)
      for (const reason of reasonsForEntry(entry)) changed(reason)
    },
    has: (name) => entries.has(key(name)),
    rename(from, to) {
      const moved = entries.get(key(from))
      entries.delete(key(from))
      if (moved) entries.set(key(to), moved)
    },
    remove(name) {
      entries.delete(key(name))
    },
    duplicate(from, to) {
      const made = workbook.copySheet(from, to)
      if (made === null) return null
      // Through the JSON shape, so nothing is shared between the two.
      const copy = JSON.parse(JSON.stringify(serializeEntry(get(from)))) as SheetStateEntry
      copy.sheetHidden = false
      // The copy's chart, picture, sparkline and pivot are its own, so they
      // get their own ids the way Excel's Move or Copy does. Sharing them
      // would mean a shell that tracks the selected object by id following
      // the copy's one across a sheet switch, and deleting it there.
      copy.objects = copy.objects?.map((object) => ({ ...object, id: objectId() }))
      copy.sparklines = copy.sparklines?.map((group) => ({ ...group, id: sparklineId() }))
      copy.pivots = copy.pivots?.map((pivot) => ({ ...pivot, id: pivotId() }))
      hydrateEntry(get(made), copy)
      changed({ kind: 'sheets' })
      return made
    },
    names: () => [...entries.keys()],

    shift(name, edit) {
      const state = get(name)
      const shift = lineShift(edit)
      const rows = edit.kind === 'insertRows' || edit.kind === 'deleteRows'
      if (rows) {
        state.formats.remapRows((id) => {
          const i = Number(id.slice(1))
          const next = Number.isInteger(i) ? shift(i) : i
          return next === null ? null : `r${next}`
        })
        const heights = new Map<number, number>()
        for (const [r, h] of state.heights) {
          const next = shift(r)
          if (next !== null) heights.set(next, h)
        }
        state.heights = heights
        const hiddenRows = new Set<number>()
        for (const r of state.hidden.rows) {
          const next = shift(r)
          if (next !== null) hiddenRows.add(next)
        }
        state.hidden = { rows: hiddenRows, cols: state.hidden.cols }
        state.notes = remapNotes(state.notes, 'rows', shift)
      } else {
        state.formats.remapColumns((id) => {
          const i = lettersToCol(id)
          const next = i < 0 ? i : shift(i)
          return next === null ? null : colToLetters(next)
        })
        const widths: Record<string, number> = {}
        for (const [letter, w] of Object.entries(state.widths)) {
          const i = lettersToCol(letter)
          const next = i < 0 ? i : shift(i)
          if (next !== null) widths[i < 0 ? letter : colToLetters(next)] = w
        }
        state.widths = widths
        const hiddenCols = new Set<number>()
        for (const c of state.hidden.cols) {
          const next = shift(c)
          if (next !== null) hiddenCols.add(next)
        }
        state.hidden = { rows: state.hidden.rows, cols: hiddenCols }
        state.notes = remapNotes(state.notes, 'cols', shift)
      }
      state.merges = state.merges.map((m) => shiftRect(m, edit)).filter((m): m is Rect => m !== null)
      state.validation = shiftValidation(state.validation, edit)
      state.conditionalFormats = shiftCf(state.conditionalFormats, edit)
      state.autoFilter = shiftAutoFilter(state.autoFilter, edit)
      state.pageSetup = shiftPageSetup(state.pageSetup, edit)
      state.objects = shiftObjects(state.objects, edit)
      state.sparklines = shiftSparklines(state.sparklines, edit)
      state.pivots = shiftPivots(state.pivots, edit)
      state.links = shiftLinks(state.links, edit)
      state.protection = {
        allow: state.protection.allow,
        ranges: state.protection.ranges
          .map((range) => ({ ...range, rects: range.rects.map((r) => shiftRect(r, edit)).filter((r): r is Rect => r !== null) }))
          .filter((range) => range.rects.length > 0),
      }
    },

    getState() {
      const sheets: Record<string, SheetStateEntry> = {}
      for (const name of workbook.sheets) sheets[name] = serializeEntry(get(name))
      return { version: 1, workbook: workbook.serialize(), sheets }
    },

    setState(state) {
      document.mute(() => {
        const wanted = state.workbook.sheets.map((s) => s.name)
        const wantedKeys = new Set(wanted.map(key))
        // Sheets to add, then the ones to drop (never the last one standing),
        // then the order, then the cells.
        for (const name of wanted) {
          if (!workbook.sheets.some((s) => key(s) === key(name))) workbook.addSheet(name)
        }
        for (const name of [...workbook.sheets]) {
          if (!wantedKeys.has(key(name)) && workbook.sheets.length > 1) {
            workbook.removeSheet(name)
            entries.delete(key(name))
          }
        }
        wanted.forEach((name, index) => {
          if (workbook.sheets[index]?.toLowerCase() !== key(name)) workbook.moveSheet(name, index)
        })
        for (const sheet of state.workbook.sheets) {
          const rows = Math.max(workbook.rowCount(sheet.name), sheet.cells.length)
          for (let r = 0; r < rows; r += 1) {
            const cols = Math.max(workbook.colCount(sheet.name), sheet.cells[r]?.length ?? 0)
            for (let c = 0; c < cols; c += 1) {
              const text = sheet.cells[r]?.[c] ?? ''
              if (workbook.getRaw(sheet.name, r, c) !== text) workbook.setRaw(sheet.name, r, c, text)
            }
          }
        }
        workbook.names.hydrate(state.workbook.names ?? {})
        // Tables are workbook-wide, and the registry is what a structured
        // reference resolves through: put back exactly the saved set.
        workbook.tables.clear()
        for (const table of state.workbook.tables ?? []) workbook.tables.define({ ...table })
        // Iterative calculation is workbook-wide too, and absent in a saved
        // document that never turned it on, which means off.
        workbook.setIteration(state.workbook.iteration ?? { enabled: false })
        if (workbook.sheets.some((s) => key(s) === key(state.workbook.active))) workbook.setActive(state.workbook.active)
        // Entries are hydrated in place, never replaced: a format store the
        // shell has registered as its target must stay the store in use, or
        // every format written after a restore would land in an orphan.
        const kept = new Set(Object.keys(state.sheets ?? {}).map(key))
        for (const name of [...entries.keys()]) if (!kept.has(name) && !wantedKeys.has(name)) entries.delete(name)
        for (const name of workbook.sheets) hydrateEntry(get(name), state.sheets?.[name] ?? {})
      })
      changed({ kind: 'restore' })
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    changed,
    mute(fn) {
      muted += 1
      try {
        return fn()
      } finally {
        muted -= 1
      }
    },
  }

  if (init.state) {
    document.mute(() => {
      workbook.names.hydrate(init.state!.workbook.names ?? {})
      if (workbook.sheets.some((s) => key(s) === key(init.state!.workbook.active))) workbook.setActive(init.state!.workbook.active)
      for (const [name, entry] of Object.entries(init.state!.sheets ?? {})) hydrateEntry(get(name), entry)
    })
  }

  return document
}
