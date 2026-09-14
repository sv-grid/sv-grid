/**
 * Find and Replace.
 *
 * The grid already has find: a Ctrl+F overlay over displayed values, with
 * next/prev. What it has no notion of is replacing, and the two differ in more
 * than direction.
 *
 * Finding looks at what the user SEES. Replacing has to write what the user
 * TYPED, which for a formula cell is the formula, not its result. Replacing
 * "100" inside a cell showing `100` that actually holds `=B2*C2` would either
 * do nothing or destroy the formula, depending on which text you reached for.
 * Hence `lookIn`, and hence replace always writing through the raw text.
 */
import type { GridCommandContext } from '@svgrid/grid/shortcuts'

export type FindOptions = {
  matchCase?: boolean
  /** The cell must equal the search text, not merely contain it. */
  matchEntireCell?: boolean
  /** Search the formula source, or the value a cell displays. Default 'values'. */
  lookIn?: 'values' | 'formulas'
  /** Restrict to the current selection. Default the whole sheet. */
  scope?: 'sheet' | 'selection'
}

export type FindHit = { rowIndex: number; colIndex: number }

/** How a cell's text is obtained for each `lookIn` mode. */
export type FindTarget = {
  /** The raw text the user typed, formula included. */
  getRaw(rowIndex: number, colIndex: number): string
  /** What the cell displays. Defaults to the raw text when not supplied. */
  getDisplay?(rowIndex: number, colIndex: number): string
  setRaw(rowIndex: number, colIndex: number, text: string): void
  /** Whether a cell may be written. Read-only cells are skipped by replace
   *  but still reported by find. */
  isEditable?(rowIndex: number, colIndex: number): boolean
  onChange?(): void
}

let target: FindTarget | null = null

export function setFindTarget(next: FindTarget | null): void {
  target = next
}

export function getFindTarget(): FindTarget | null {
  return target
}

function textOf(t: FindTarget, r: number, c: number, lookIn: 'values' | 'formulas'): string {
  if (lookIn === 'formulas') return t.getRaw(r, c)
  return t.getDisplay ? t.getDisplay(r, c) : t.getRaw(r, c)
}

/** Does `haystack` match `needle` under these options? */
export function cellMatches(
  haystack: string,
  needle: string,
  opts: FindOptions = {},
): boolean {
  if (needle === '') return false
  const a = opts.matchCase ? haystack : haystack.toLowerCase()
  const b = opts.matchCase ? needle : needle.toLowerCase()
  return opts.matchEntireCell ? a === b : a.includes(b)
}

/** Every cell matching, in reading order. */
export function findAll(
  cmd: GridCommandContext,
  needle: string,
  opts: FindOptions = {},
): FindHit[] {
  const t = target
  if (!t || needle === '') return []
  const lookIn = opts.lookIn ?? 'values'
  const bounds = opts.scope === 'selection' ? cmd.ranges : null
  const hits: FindHit[] = []

  const inScope = (r: number, c: number): boolean => {
    if (!bounds) return true
    return bounds.some(([minRow, minCol, maxRow, maxCol]) =>
      r >= minRow && r <= maxRow && c >= minCol && c <= maxCol)
  }

  for (let r = 0; r < cmd.rowCount; r += 1) {
    for (let c = 0; c < cmd.colCount; c += 1) {
      if (!inScope(r, c)) continue
      if (cellMatches(textOf(t, r, c, lookIn), needle, opts)) hits.push({ rowIndex: r, colIndex: c })
    }
  }
  return hits
}

/** The next hit after the active cell, wrapping. Null when there are none. */
export function findNext(
  cmd: GridCommandContext,
  needle: string,
  opts: FindOptions = {},
  direction: 1 | -1 = 1,
): FindHit | null {
  const hits = findAll(cmd, needle, opts)
  if (hits.length === 0) return null
  const active = cmd.activeCell
  if (!active) return hits[0]!

  const key = (h: FindHit) => h.rowIndex * cmd.colCount + h.colIndex
  const here = active.rowIndex * cmd.colCount + active.colIndex

  if (direction === 1) {
    return hits.find((h) => key(h) > here) ?? hits[0]!
  }
  // Reverse: the last hit strictly before the active cell, else wrap to the end.
  for (let i = hits.length - 1; i >= 0; i -= 1) {
    if (key(hits[i]!) < here) return hits[i]!
  }
  return hits[hits.length - 1]!
}

/** Replace inside one string, honouring case sensitivity and whole-cell. */
export function replaceInText(
  haystack: string,
  needle: string,
  replacement: string,
  opts: FindOptions = {},
): string {
  if (needle === '') return haystack
  if (opts.matchEntireCell) {
    return cellMatches(haystack, needle, opts) ? replacement : haystack
  }
  if (opts.matchCase) return haystack.split(needle).join(replacement)

  // Case-insensitive substring replace, without a regex: the needle is user
  // input and escaping it correctly is more code than scanning for it.
  const lowerHay = haystack.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  let out = ''
  let i = 0
  for (;;) {
    const at = lowerHay.indexOf(lowerNeedle, i)
    if (at < 0) { out += haystack.slice(i); break }
    out += haystack.slice(i, at) + replacement
    i = at + needle.length
  }
  return out
}

/**
 * Replace the active cell if it matches, then move to the next hit. Returns
 * whether anything was written.
 */
export function replaceOne(
  cmd: GridCommandContext,
  needle: string,
  replacement: string,
  opts: FindOptions = {},
): boolean {
  const t = target
  const active = cmd.activeCell
  if (!t || !active || needle === '') return false

  const { rowIndex: r, colIndex: c } = active
  const lookIn = opts.lookIn ?? 'values'
  const editable = t.isEditable?.(r, c) ?? true
  let wrote = false

  if (editable && cellMatches(textOf(t, r, c, lookIn), needle, opts)) {
    // Always write through the RAW text: replacing inside a displayed value
    // would overwrite a formula with its own result.
    const raw = t.getRaw(r, c)
    const next = replaceInText(raw, needle, replacement, opts)
    if (next !== raw) {
      t.setRaw(r, c, next)
      t.onChange?.()
      wrote = true
    }
  }

  const following = findNext(cmd, needle, opts)
  if (following) {
    cmd.setActiveCell(following.rowIndex, following.colIndex)
    cmd.setSelection(following.rowIndex, following.colIndex)
    cmd.scrollIntoView(following.rowIndex, following.colIndex)
  }
  return wrote
}

/**
 * Replace every match. Returns how many cells changed.
 *
 * Runs inside `cmd.batch`, so a hundred replacements are ONE Ctrl+Z. Without
 * that this would be the single worst thing in the feature set for undo: it is
 * the one command that routinely writes more cells than the history can hold.
 */
export function replaceAll(
  cmd: GridCommandContext,
  needle: string,
  replacement: string,
  opts: FindOptions = {},
): number {
  const t = target
  if (!t || needle === '') return 0
  const hits = findAll(cmd, needle, opts)
  if (hits.length === 0) return 0

  return cmd.batch(() => {
    let changed = 0
    for (const { rowIndex: r, colIndex: c } of hits) {
      if (!(t.isEditable?.(r, c) ?? true)) continue
      const raw = t.getRaw(r, c)
      const next = replaceInText(raw, needle, replacement, opts)
      if (next === raw) continue
      t.setRaw(r, c, next)
      changed += 1
    }
    if (changed > 0) t.onChange?.()
    return changed
  })
}
