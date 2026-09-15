/**
 * Cell comments, Excel's notes: a text on a cell, shown as a corner mark
 * and read on hover. They live in the sheet document in the grid's own
 * `notes` shape (`r4` -> `B` -> text), so the grid draws the mark and the
 * tooltip and the document moves them with an insert or delete
 * (`remapNotes`). This module is the pure part: reading, writing, and
 * walking them the way Review > Previous / Next do.
 */
import { colToLetters, lettersToCol } from './address'
import type { NotesMap } from './rects'

export type { NotesMap } from './rects'

/** The comment on (r, c), or undefined when there is none. */
export function commentAt(notes: NotesMap, r: number, c: number): string | undefined {
  const text = notes[`r${r}`]?.[colToLetters(c)]
  return text && text.trim() ? text : undefined
}

/**
 * The map with (r, c) set to `text`, or cleared when the text is blank.
 * A new map, never the old one changed: the grid re-reads `notes` only
 * when the object it is handed is a different one.
 */
export function withComment(notes: NotesMap, r: number, c: number, text: string): NotesMap {
  const rowId = `r${r}`
  const columnId = colToLetters(c)
  const out: NotesMap = {}
  for (const [id, line] of Object.entries(notes)) out[id] = { ...line }
  if (text.trim()) {
    out[rowId] = { ...(out[rowId] ?? {}), [columnId]: text }
  } else if (out[rowId]) {
    delete out[rowId][columnId]
    if (Object.keys(out[rowId]).length === 0) delete out[rowId]
  }
  return out
}

/** Every comment, top to bottom then left to right. */
export function listComments(notes: NotesMap): Array<{ row: number; col: number; text: string }> {
  const out: Array<{ row: number; col: number; text: string }> = []
  for (const [rowId, line] of Object.entries(notes)) {
    const row = Number(rowId.slice(1))
    if (!Number.isInteger(row) || row < 0) continue
    for (const [columnId, text] of Object.entries(line)) {
      const col = lettersToCol(columnId)
      if (col < 0 || !text || !text.trim()) continue
      out.push({ row, col, text })
    }
  }
  return out.sort((a, b) => a.row - b.row || a.col - b.col)
}

/**
 * The comment after (or before) `from`, reading the sheet row by row and
 * wrapping at the end, as Excel's Next Comment and Previous Comment do. The
 * cell itself is skipped, so pressing Next on a commented cell moves on;
 * null when the sheet has no comments at all.
 */
export function nextComment(
  notes: NotesMap,
  from: { row: number; col: number },
  dir: 1 | -1,
): { row: number; col: number } | null {
  const all = listComments(notes)
  if (!all.length) return null
  const after = (a: { row: number; col: number }, b: { row: number; col: number }) =>
    a.row > b.row || (a.row === b.row && a.col > b.col)
  const at = (entry: { row: number; col: number }) => ({ row: entry.row, col: entry.col })
  if (dir === 1) {
    const hit = all.find((entry) => after(entry, from))
    return at(hit ?? all[0]!)
  }
  for (let i = all.length - 1; i >= 0; i -= 1) {
    if (after(from, all[i]!)) return at(all[i]!)
  }
  return at(all[all.length - 1]!)
}
