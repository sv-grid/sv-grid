import { describe, expect, it } from 'vitest'
import { commentAt, withComment, listComments, nextComment } from './comments'

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
