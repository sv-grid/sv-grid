/**
 * Cell comments: Excel's notes and its threaded comments in one map. A
 * note is a text on a cell, shown as a corner mark and read on hover; a
 * thread is that text with an author and a time, replies under it, and a
 * resolved flag. They live in the sheet document keyed the way the grid's
 * `notes` are (`r4` -> `B` -> value), so the document moves them with an
 * insert or delete (`remapNotes`) and the grid draws the mark and the
 * tooltip from the text projection `notesOf` makes.
 *
 * A value is a plain string for a note (the shape every document saved so
 * far carries) or a `CommentThread`; `threadOf` reads either. This module
 * is the pure part: reading, writing, and walking them the way Review >
 * Previous / Next do.
 */
import { colToLetters, lettersToCol } from './address'
import type { NotesMap } from './rects'

export type { NotesMap } from './rects'

/** One entry of a thread: its text, who wrote it and when (ISO 8601). */
export type CommentEntry = { text: string; author?: string; at?: string }

/** A cell's comment: the first entry, its replies, and whether it is done. */
export type CommentThread = CommentEntry & { replies?: CommentEntry[]; resolved?: boolean }

/** A note as saved before threads existed, or a thread. */
export type CommentValue = string | CommentThread

/** `r4` -> `B` -> the comment; the document's own shape. */
export type CommentsMap = Record<string, Record<string, CommentValue>>

/** Either shape as a thread; undefined for a blank note. */
export function threadOf(value: CommentValue | undefined): CommentThread | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'string') return value.trim() ? { text: value } : undefined
  return value.text.trim() || value.replies?.length ? value : undefined
}

/** The thread on (r, c), or undefined when there is none. */
export function threadAt(comments: CommentsMap, r: number, c: number): CommentThread | undefined {
  return threadOf(comments[`r${r}`]?.[colToLetters(c)])
}

/** The comment's first text on (r, c), or undefined when there is none. */
export function commentAt(comments: CommentsMap, r: number, c: number): string | undefined {
  return threadAt(comments, r, c)?.text
}

/** True when the thread carries more than a note's text: it is written as an object. */
export function isThreaded(thread: CommentThread): boolean {
  return Boolean(thread.author || thread.at || thread.replies?.length || thread.resolved)
}

/** The thread as the text a tooltip shows: each entry under its author. */
export function threadText(thread: CommentThread): string {
  const line = (entry: CommentEntry) => (entry.author ? `${entry.author}:\n${entry.text}` : entry.text)
  return [line(thread), ...(thread.replies ?? []).map(line)].join('\n\n')
}

function copy(comments: CommentsMap): CommentsMap {
  const out: CommentsMap = {}
  for (const [id, line] of Object.entries(comments)) out[id] = { ...line }
  return out
}

/**
 * The map with (r, c) set to `thread`, or cleared when it is null or blank.
 * A thread with nothing but a text is written as that text, so a document
 * that never used threads reads as it always did. A new map, never the
 * old one changed: the grid re-reads `notes` only when the object it is
 * handed is a different one.
 */
export function withThread(comments: CommentsMap, r: number, c: number, thread: CommentThread | null): CommentsMap {
  const rowId = `r${r}`
  const columnId = colToLetters(c)
  const out = copy(comments)
  const kept = thread ? threadOf(thread) : undefined
  if (kept) {
    out[rowId] = { ...(out[rowId] ?? {}), [columnId]: isThreaded(kept) ? kept : kept.text }
  } else if (out[rowId]) {
    delete out[rowId][columnId]
    if (Object.keys(out[rowId]).length === 0) delete out[rowId]
  }
  return out
}

/**
 * The map with the first text of (r, c) set to `text`, or the comment
 * removed when the text is blank. A thread keeps its author, replies and
 * state; a note stays a note.
 */
export function withComment(comments: CommentsMap, r: number, c: number, text: string): CommentsMap {
  if (!text.trim()) return withThread(comments, r, c, null)
  const before = threadAt(comments, r, c)
  return withThread(comments, r, c, before ? { ...before, text } : { text })
}

/** The grid's `notes`: the text of every comment, for the mark and the tooltip. */
export function notesOf(comments: CommentsMap): NotesMap {
  const out: NotesMap = {}
  for (const [rowId, line] of Object.entries(comments)) {
    for (const [columnId, value] of Object.entries(line)) {
      const thread = threadOf(value)
      if (!thread) continue
      out[rowId] = { ...(out[rowId] ?? {}), [columnId]: threadText(thread) }
    }
  }
  return out
}

/** Every comment, top to bottom then left to right, with its first text. */
export function listComments(comments: CommentsMap): Array<{ row: number; col: number; text: string; thread: CommentThread }> {
  const out: Array<{ row: number; col: number; text: string; thread: CommentThread }> = []
  for (const [rowId, line] of Object.entries(comments)) {
    const row = Number(rowId.slice(1))
    if (!Number.isInteger(row) || row < 0) continue
    for (const [columnId, value] of Object.entries(line)) {
      const col = lettersToCol(columnId)
      const thread = threadOf(value)
      if (col < 0 || !thread) continue
      out.push({ row, col, text: thread.text, thread })
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
  comments: CommentsMap,
  from: { row: number; col: number },
  dir: 1 | -1,
): { row: number; col: number } | null {
  const all = listComments(comments)
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
