import { describe, expect, it } from 'vitest'
import { commentAt, withComment, listComments, nextComment, threadOf, threadAt, withThread, isThreaded, notesOf } from './comments'
import { remapNotes } from './rects'

describe('withComment / commentAt', () => {
  it('writes and reads a comment by position, in the grid\'s notes shape', () => {
    const notes = withComment({}, 4, 1, 'Check this')
    expect(notes).toEqual({ r4: { B: 'Check this' } })
    expect(commentAt(notes, 4, 1)).toBe('Check this')
    expect(commentAt(notes, 4, 2)).toBeUndefined()
  })

  it('hands back a new map and leaves the old one alone', () => {
    const before = withComment({}, 0, 0, 'a')
    const after = withComment(before, 0, 1, 'b')
    expect(after).not.toBe(before)
    expect(before).toEqual({ r0: { A: 'a' } })
    expect(after).toEqual({ r0: { A: 'a', B: 'b' } })
    expect(after.r0).not.toBe(before.r0)
  })

  it('blank text removes the comment, and an emptied row goes with it', () => {
    const notes = withComment(withComment({}, 2, 2, 'x'), 2, 3, 'y')
    const one = withComment(notes, 2, 2, '   ')
    expect(one).toEqual({ r2: { D: 'y' } })
    expect(withComment(one, 2, 3, '')).toEqual({})
  })

  it('a whitespace-only note reads as none', () => {
    expect(commentAt({ r0: { A: '  ' } }, 0, 0)).toBeUndefined()
  })
})

describe('listComments', () => {
  it('lists top to bottom, left to right', () => {
    const notes = { r5: { C: 'c5', A: 'a5' }, r1: { B: 'b1' }, r0: { Z: 'z0' } }
    expect(listComments(notes).map((e) => [e.row, e.col, e.text])).toEqual([
      [0, 25, 'z0'], [1, 1, 'b1'], [5, 0, 'a5'], [5, 2, 'c5'],
    ])
  })

  it('skips blanks and keys that are not positions', () => {
    expect(listComments({ r0: { A: '' }, abc: { A: 'x' }, r1: { '#': 'y' } })).toEqual([])
  })
})

describe('nextComment', () => {
  const notes = { r1: { B: 'one' }, r3: { A: 'two', D: 'three' } }

  it('walks forward row by row and wraps', () => {
    expect(nextComment(notes, { row: 0, col: 0 }, 1)).toEqual({ row: 1, col: 1 })
    expect(nextComment(notes, { row: 1, col: 1 }, 1)).toEqual({ row: 3, col: 0 })
    expect(nextComment(notes, { row: 3, col: 0 }, 1)).toEqual({ row: 3, col: 3 })
    expect(nextComment(notes, { row: 3, col: 3 }, 1)).toEqual({ row: 1, col: 1 })
  })

  it('walks backward and wraps', () => {
    expect(nextComment(notes, { row: 3, col: 3 }, -1)).toEqual({ row: 3, col: 0 })
    expect(nextComment(notes, { row: 1, col: 1 }, -1)).toEqual({ row: 3, col: 3 })
    expect(nextComment(notes, { row: 0, col: 0 }, -1)).toEqual({ row: 3, col: 3 })
  })

  it('is null with no comments', () => {
    expect(nextComment({}, { row: 0, col: 0 }, 1)).toBeNull()
  })

  it('on a cell that is the only comment, lands on it again', () => {
    expect(nextComment({ r2: { A: 'x' } }, { row: 2, col: 0 }, 1)).toEqual({ row: 2, col: 0 })
  })
})

describe('threads', () => {
  const thread = { text: 'Is this right?', author: 'Ana', at: '2026-03-04T10:00:00.000Z', replies: [{ text: 'Yes', author: 'Ben', at: '2026-03-04T11:00:00.000Z' }] }

  it('threadOf reads a note and a thread alike, and blank as none', () => {
    expect(threadOf('note')).toEqual({ text: 'note' })
    expect(threadOf('  ')).toBeUndefined()
    expect(threadOf({ text: '' })).toBeUndefined()
    expect(threadOf({ text: '', replies: [{ text: 'r' }] })).toEqual({ text: '', replies: [{ text: 'r' }] })
    expect(threadOf(thread)).toBe(thread)
  })

  it('withThread stores a bare text as a note and anything more as a thread', () => {
    const notes = withThread({}, 1, 1, { text: 'plain' })
    expect(notes).toEqual({ r1: { B: 'plain' } })
    const threads = withThread(notes, 1, 2, thread)
    expect(threads.r1!.C).toBe(thread)
    expect(threadAt(threads, 1, 2)).toBe(thread)
    expect(commentAt(threads, 1, 2)).toBe('Is this right?')
    expect(isThreaded({ text: 'x' })).toBe(false)
    expect(isThreaded({ text: 'x', resolved: true })).toBe(true)
    expect(withThread(threads, 1, 2, null)).toEqual({ r1: { B: 'plain' } })
    expect(withThread(threads, 1, 2, { text: '  ' })).toEqual({ r1: { B: 'plain' } })
  })

  it('withComment on a thread changes its first text and keeps the rest', () => {
    const threads = withThread({}, 0, 0, thread)
    const edited = withComment(threads, 0, 0, 'Corrected')
    expect(threadAt(edited, 0, 0)).toEqual({ ...thread, text: 'Corrected' })
    expect(withComment(threads, 0, 0, '')).toEqual({})
  })

  it('notesOf projects each thread as the text a tooltip shows', () => {
    const map = withThread(withThread({}, 0, 0, thread), 2, 0, { text: 'note' })
    expect(notesOf(map)).toEqual({ r0: { A: 'Ana:\nIs this right?\n\nBen:\nYes' }, r2: { A: 'note' } })
  })

  it('listComments carries the thread, and a structural edit moves it whole', () => {
    const map = withThread({}, 3, 1, thread)
    expect(listComments(map)).toEqual([{ row: 3, col: 1, text: 'Is this right?', thread }])
    const moved = remapNotes(map, 'rows', (i) => (i >= 1 ? i + 2 : i))
    expect(moved).toEqual({ r5: { B: thread } })
  })
})
