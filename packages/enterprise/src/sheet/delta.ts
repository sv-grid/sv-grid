/**
 * Collaboration: the document's changes as a stream of deltas, and the other
 * half, applying one that arrived from somewhere else.
 *
 * `onChange` already says WHAT changed; a collaborator needs to know WHAT IT
 * BECAME, and small enough to send on every keystroke. So each reason is
 * turned into a delta carrying just that:
 *
 *   cells      the raw text of the cells that were written, not their values:
 *              a collaborator has to receive `=SUM(A1:A9)` and work out 42 in
 *              their own workbook, or a formula would arrive as a number;
 *   structure  the insert or delete itself, which both sides apply the same
 *              way, so every formula is rewritten identically on each;
 *   state      the one part of one sheet that changed, serialized the way
 *              `getState` serializes it (the formats, the merges, the rules,
 *              the objects, ...);
 *   document   the whole state, for the two changes that are not worth
 *              describing piecemeal: adding, removing or reordering sheets,
 *              and a restore.
 *
 * **Conflicts are last-writer-wins, per cell.** A delta carries no version
 * and no transform: two people typing in the same cell end on whichever
 * message arrived last, and everyone converges on that. Two people typing in
 * DIFFERENT cells never conflict, which is the case that actually happens.
 * Anything stronger (operational transform, CRDTs) is a different piece of
 * work and does not belong behind an API this small.
 */
import type { SheetChangeReason, SheetDocument, SheetState, SheetStateEntry } from './document'
import type { StructuralEdit } from './refs'

/** One cell's raw text, as typed. */
export type SheetCellWrite = { row: number; col: number; text: string }

export type SheetDelta =
  | { kind: 'cells'; sheet: string; cells: SheetCellWrite[] }
  | { kind: 'structure'; sheet: string; edit: StructuralEdit }
  | { kind: 'state'; sheet: string; entry: Partial<SheetStateEntry> }
  | { kind: 'document'; state: SheetState }

/** Which parts of a sheet's saved entry a change reason can have touched. */
const PARTS: Partial<Record<SheetChangeReason['kind'], Array<keyof SheetStateEntry>>> = {
  formats: ['formats'],
  sizes: ['columnWidths', 'rowHeights'],
  hidden: ['hidden', 'sheetHidden'],
  freeze: ['freeze'],
  comments: ['comments'],
  validation: ['validation'],
  'conditional-formats': ['conditionalFormats'],
  protection: ['protected', 'protection'],
  'page-setup': ['pageSetup'],
  objects: ['objects'],
  sparklines: ['sparklines'],
  pivots: ['pivots'],
  merges: ['merges'],
  filter: ['autoFilter'],
}

/** The entry parts a batch of reasons could have changed, deduplicated. */
export function partsOfReasons(reasons: ReadonlyArray<SheetChangeReason>): Array<keyof SheetStateEntry> {
  const out = new Set<keyof SheetStateEntry>()
  for (const reason of reasons) for (const part of PARTS[reason.kind] ?? []) out.add(part)
  return [...out]
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * Apply a delta to a document. The change is reported, so a shell over it
 * repaints; wrap the call in `doc.mute` where it should not be.
 *
 * Applying is idempotent for `cells` and `state`, and NOT for `structure`:
 * an insert applied twice inserts twice. A transport that can deliver twice
 * has to deduplicate, which is its job rather than this function's.
 */
export function applySheetDelta(doc: SheetDocument, delta: SheetDelta): void {
  if (delta.kind === 'cells') {
    for (const cell of delta.cells) doc.workbook.setRaw(delta.sheet, cell.row, cell.col, cell.text)
    doc.changed({ kind: 'cells' })
    return
  }
  if (delta.kind === 'structure') {
    doc.workbook.applyStructuralEdit(delta.sheet, delta.edit)
    doc.shift(delta.sheet, delta.edit)
    doc.changed({ kind: 'structure', sheet: delta.sheet, edit: delta.edit })
    return
  }
  if (delta.kind === 'state') {
    doc.patch(delta.sheet, delta.entry)
    return
  }
  doc.setState(delta.state)
}

export type SheetDeltaStream = {
  /** Apply a delta from elsewhere without sending it straight back out. */
  apply(delta: SheetDelta): void
  /** Send everything as one `document` delta: a new participant's first read. */
  resync(): void
  /** Stop listening. */
  stop(): void
}

export type SheetDeltaOptions = {
  /** Called with each delta, in the order they happened. */
  onDelta(delta: SheetDelta): void
}

/**
 * Watch a document and report its changes as deltas.
 *
 * Cells come from the workbook's raw writes, so what goes out is the text a
 * user typed rather than the value it computed. Everything else is worked
 * out by comparing the sheet's serialized parts against the last ones sent,
 * which is why a change that touches nothing sends nothing.
 */
export function createDeltaStream(doc: SheetDocument, options: SheetDeltaOptions): SheetDeltaStream {
  /** The last entry we know the other side has, per sheet. */
  let sent = new Map<string, SheetStateEntry>()
  /** Raw writes waiting to go out, per sheet, keyed by cell so a cell typed
   *  twice in one tick is sent once. */
  const pending = new Map<string, Map<string, SheetCellWrite>>()
  /**
   * What arrived from elsewhere and must not go straight back out.
   *
   * A time-based "we are applying right now" flag cannot do this: the
   * document reports its changes on a LATER microtask, by which time the
   * flag is down, and two streams wired to each other would echo forever.
   * So each applied change is marked instead, and the mark is what the
   * listener drops - which also means a local change made in the same tick
   * is still sent rather than being swallowed by the window.
   */
  const appliedStructures: string[] = []
  let appliedDocument = false
  let stopped = false

  const snapshot = () => {
    const state = doc.getState()
    sent = new Map(Object.entries(state.sheets))
    return state
  }
  snapshot()

  function flushCells() {
    if (pending.size === 0) return
    for (const [sheet, cells] of pending) {
      if (cells.size) options.onDelta({ kind: 'cells', sheet, cells: [...cells.values()] })
    }
    pending.clear()
  }

  const offWrites = doc.workbook.subscribeWrites((change) => {
    if (stopped) return
    const key = `${change.row},${change.col}`
    const cells = pending.get(change.sheet) ?? new Map<string, SheetCellWrite>()
    cells.set(key, { row: change.row, col: change.col, text: change.text })
    pending.set(change.sheet, cells)
  })

  const offChanges = doc.subscribe((reasons) => {
    if (stopped) return
    // The cells first: a structural edit or a rule that arrived in the same
    // tick reads them, and the other side has to see them in that order too.
    flushCells()

    for (const reason of reasons) {
      if (reason.kind !== 'structure') continue
      const mark = JSON.stringify({ sheet: reason.sheet, edit: reason.edit })
      const at = appliedStructures.indexOf(mark)
      // One that came from elsewhere: the other side already has it.
      if (at >= 0) { appliedStructures.splice(at, 1); continue }
      options.onDelta({ kind: 'structure', sheet: reason.sheet, edit: reason.edit })
    }

    // Sheets added, removed or reordered, and a restore, are the two changes
    // a part-by-part delta cannot describe: send the document.
    if (reasons.some((r) => r.kind === 'sheets' || r.kind === 'restore')) {
      if (appliedDocument) { appliedDocument = false; snapshot(); return }
      options.onDelta({ kind: 'document', state: snapshot() })
      return
    }

    const parts = partsOfReasons(reasons)
    if (parts.length === 0) { snapshot(); return }
    const state = doc.getState()
    for (const [sheet, entry] of Object.entries(state.sheets)) {
      const before = sent.get(sheet)
      const patch: Partial<SheetStateEntry> = {}
      let any = false
      for (const part of parts) {
        if (same(entry[part], before?.[part])) continue
        // The entry is JSON already; the cast keeps the key's own type.
        ;(patch as Record<string, unknown>)[part] = entry[part]
        any = true
      }
      if (any) options.onDelta({ kind: 'state', sheet, entry: patch })
    }
    sent = new Map(Object.entries(state.sheets))
  })

  return {
    apply(delta) {
      if (stopped) return
      if (delta.kind === 'structure') appliedStructures.push(JSON.stringify({ sheet: delta.sheet, edit: delta.edit }))
      if (delta.kind === 'document') appliedDocument = true
      applySheetDelta(doc, delta)
      if (delta.kind === 'cells') {
        // Written here, so there is nothing to write back.
        const cells = pending.get(delta.sheet)
        if (cells) {
          for (const cell of delta.cells) cells.delete(`${cell.row},${cell.col}`)
          if (cells.size === 0) pending.delete(delta.sheet)
        }
      }
      // What arrived is what the other side already has: fold it into the
      // baseline so the next comparison does not report it as ours.
      snapshot()
    },
    resync() {
      options.onDelta({ kind: 'document', state: snapshot() })
    },
    stop() {
      stopped = true
      offWrites()
      offChanges()
    },
  }
}
