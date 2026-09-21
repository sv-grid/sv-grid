/**
 * Undo / redo over the grid's history array, group-aware.
 *
 * The history is one ordered array of per-cell steps plus a pointer to the
 * last applied step (the model lives in SvGrid.controller.svelte.ts). A step
 * describes ONE cell, which is right for a single edit and wrong for anything
 * that writes many cells at once: `applyMoveRange` in clipboard.ts pushes one
 * step per moved cell, so undoing a 15x20 range move takes 300 presses of
 * Ctrl+Z, and with UNDO_LIMIT at 200 the same move evicts the entire history
 * behind it.
 *
 * `groupId` fixes that without changing the storage model. Steps written
 * inside one logical action share an id; undo and redo walk the whole run of
 * steps carrying that id and apply them together, so a paste, a fill-down or
 * a range move is one press, the way it is in a spreadsheet. Steps with no
 * groupId behave exactly as before, one step per press.
 *
 * Undo applies a group in REVERSE order. Two steps that touched the same cell
 * inside one action have to be unwound newest-first or the older `before`
 * value is overwritten by the newer one and the cell lands on the wrong value.
 */

export type HistoryStep = {
  rowId: string
  columnId: string
  field: string
  before: unknown
  after: unknown
  /** Set when this step is part of a multi-cell action. Steps sharing an id
   *  are contiguous in the array and undo / redo as one. */
  groupId?: string
  /**
   * A step that is not a cell write: something outside the grid's data that
   * still belongs in the same Ctrl+Z stream, such as a cell format kept in a
   * consumer's store. The cell fields are empty on such a step and the two
   * functions do the work. Never serialised, since a closure cannot be.
   */
  custom?: { undo: () => void; redo: () => void }
  /**
   * The consumer's own mark on the step, copied from `api.setHistoryTag` at
   * the moment it is recorded. The grid never reads it: it is there for a
   * consumer that shows one of several data sets through the grid and has
   * to know which one a step belongs to before it lets Ctrl+Z apply it (a
   * workbook with several sheets, say). Kept as given, so an object tag
   * compares by identity. Not serialised.
   */
  tag?: unknown
}

/** Ctx surface these helpers touch. The controller satisfies it structurally. */
type HistoryCtx = {
  history: HistoryStep[]
  historyPtr: number
  historyVersion: number
  UNDO_LIMIT: number
  /** Set while a `runHistoryGroup` call is on the stack. Every step pushed
   *  inside it joins that group, so a command does not have to thread a group
   *  id down through the writers it calls. */
  historyGroupId: string | undefined
  /** Stamped on every step recorded while it is set; see `HistoryStep.tag`. */
  historyTag?: unknown
  applyHistoryStep(step: HistoryStep, direction: 'undo' | 'redo'): void
}

/** Index of the first step in the group that ends at `end`, or `end` itself
 *  when that step is ungrouped. */
function groupStart(history: ReadonlyArray<HistoryStep>, end: number): number {
  const id = history[end]?.groupId
  if (!id) return end
  let i = end
  while (i > 0 && history[i - 1]?.groupId === id) i -= 1
  return i
}

/** Index of the last step in the group that begins at `start`, or `start`
 *  itself when that step is ungrouped. */
function groupEnd(history: ReadonlyArray<HistoryStep>, start: number): number {
  const id = history[start]?.groupId
  if (!id) return start
  let i = start
  while (i < history.length - 1 && history[i + 1]?.groupId === id) i += 1
  return i
}

/**
 * The last `limit` ACTIONS of a history, whole groups kept. The cap used
 * to count steps, and a sort of 5,000 rows is 20,000 steps in one group:
 * it cut the group to its last 200 cells, so Ctrl+Z put a fifth of a
 * column back and left the rest sorted. An action is one press of Ctrl+Z,
 * so that is what the buffer counts; the steps inside are the cost of it.
 */
function lastActions(history: HistoryStep[], limit: number): HistoryStep[] {
  let i = history.length
  let actions = 0
  while (i > 0 && actions < limit) {
    i = groupStart(history, i - 1)
    actions += 1
  }
  return i === 0 ? history : history.slice(i)
}

/** What the next undo would apply: the tag of the step Ctrl+Z takes next
 *  (a group carries one tag, so its last step's is the group's). Null when
 *  there is nothing to undo. */
export function peekUndoHistory(ctx: HistoryCtx): { tag: unknown } | null {
  const step = ctx.historyPtr >= 0 ? ctx.history[ctx.historyPtr] : undefined
  return step ? { tag: step.tag } : null
}

/** The redo counterpart of `peekUndoHistory`. */
export function peekRedoHistory(ctx: HistoryCtx): { tag: unknown } | null {
  const step = ctx.historyPtr < ctx.history.length - 1 ? ctx.history[ctx.historyPtr + 1] : undefined
  return step ? { tag: step.tag } : null
}

/** Undo one action. Returns false when there is nothing left to undo. */
export function undoHistory(ctx: HistoryCtx): boolean {
  if (ctx.historyPtr < 0) return false
  const end = ctx.historyPtr
  if (!ctx.history[end]) return false
  const start = groupStart(ctx.history, end)
  // Reverse order: see the note at the top of the file.
  for (let i = end; i >= start; i -= 1) {
    const step = ctx.history[i]
    if (step) ctx.applyHistoryStep(step, 'undo')
  }
  ctx.historyPtr = start - 1
  ctx.historyVersion += 1
  return true
}

/** Redo one action. Returns false when there is nothing left to redo. */
export function redoHistory(ctx: HistoryCtx): boolean {
  if (ctx.historyPtr >= ctx.history.length - 1) return false
  const start = ctx.historyPtr + 1
  if (!ctx.history[start]) return false
  const end = groupEnd(ctx.history, start)
  for (let i = start; i <= end; i += 1) {
    const step = ctx.history[i]
    if (step) ctx.applyHistoryStep(step, 'redo')
  }
  ctx.historyPtr = end
  ctx.historyVersion += 1
  return true
}

/**
 * Append steps at the pointer, truncating any forward history (the standard
 * "an edit invalidates redo" rule) and capping the buffer at UNDO_LIMIT by
 * dropping the OLDEST entries.
 *
 * Every writer goes through here rather than open-coding the slice / push /
 * cap dance, which editing.ts and clipboard.ts previously did three times
 * with three slightly different shapes.
 */
export function pushHistory(
  ctx: HistoryCtx,
  steps: ReadonlyArray<HistoryStep>,
  groupId?: string,
): void {
  if (!steps.length) return
  // An ambient group wins: inside runHistoryGroup even a single step has to be
  // tagged, because a later push in the same action must join it.
  //
  // Outside one, a group of one is just a step. Tagging it would make undo do
  // the same work through a slower path and would show up in serialized state.
  const id = ctx.historyGroupId ?? (groupId && steps.length > 1 ? groupId : undefined)
  const tag = ctx.historyTag
  let next = ctx.history.slice(0, ctx.historyPtr + 1)
  for (const step of steps) {
    const stamped = tag === undefined ? step : { ...step, tag }
    next.push(id ? { ...stamped, groupId: id } : stamped)
  }
  next = lastActions(next, ctx.UNDO_LIMIT)
  ctx.history = next
  ctx.historyPtr = ctx.history.length - 1
  ctx.historyVersion += 1
}

let groupCounter = 0

/** A fresh group id. Monotonic, not random: ids never leave the session and a
 *  counter is comparable in a test snapshot. */
export function nextGroupId(): string {
  groupCounter += 1
  return `g${groupCounter}`
}

/**
 * Run `fn` with every history step it writes tagged as one undoable action.
 *
 * This is ambient rather than a wrapper that re-tags afterwards, because
 * `pushHistory` can drop the oldest entries when the buffer hits UNDO_LIMIT.
 * A re-tagging implementation would compute its slice bounds from a length
 * that had shifted underneath it and stamp the wrong steps.
 *
 * Nested calls join the outer group: one user action is one undo, however many
 * layers of helper it goes through.
 */
export function runHistoryGroup<T>(ctx: HistoryCtx, fn: () => T): T {
  const outer = ctx.historyGroupId
  ctx.historyGroupId = outer ?? nextGroupId()
  try {
    return fn()
  } finally {
    ctx.historyGroupId = outer
  }
}
