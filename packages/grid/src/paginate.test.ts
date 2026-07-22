import { describe, expect, it } from 'vitest'
import { paginationRange } from './paginate'

describe('paginationRange', () => {
  it('returns an empty list for zero pages', () => {
    expect(paginationRange({ page: 1, pageCount: 0 })).toEqual([])
  })

  it('shows every page when the count is small', () => {
    expect(paginationRange({ page: 3, pageCount: 5 })).toEqual([1, 2, 3, 4, 5])
  })

  it('adds a trailing ellipsis near the start', () => {
    expect(paginationRange({ page: 1, pageCount: 10 })).toEqual([1, 2, 'ellipsis-right', 10])
  })

  it('adds ellipses on both sides in the middle', () => {
    expect(paginationRange({ page: 5, pageCount: 10 })).toEqual([
      1, 'ellipsis-left', 4, 5, 6, 'ellipsis-right', 10,
    ])
  })

  it('adds a leading ellipsis near the end', () => {
    expect(paginationRange({ page: 10, pageCount: 10 })).toEqual([1, 'ellipsis-left', 9, 10])
  })

  it('collapses a single-page gap to that page number, not an ellipsis', () => {
    // Between boundary 1 and sibling-start 3 there is exactly one page (2): show it.
    expect(paginationRange({ page: 4, pageCount: 8 })).toEqual([1, 2, 3, 4, 5, 'ellipsis-right', 8])
  })

  it('clamps an out-of-range page', () => {
    expect(paginationRange({ page: 99, pageCount: 5 })).toEqual([1, 2, 3, 4, 5])
  })

  it('honours a larger siblingCount', () => {
    expect(paginationRange({ page: 6, pageCount: 12, siblingCount: 2 })).toEqual([
      1, 'ellipsis-left', 4, 5, 6, 7, 8, 'ellipsis-right', 12,
    ])
  })
})
