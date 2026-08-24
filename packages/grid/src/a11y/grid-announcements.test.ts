import { describe, it, expect } from 'vitest'
import {
  formatMessage,
  filterAnnouncement,
  selectionAnnouncement,
} from './grid-announcements'
import { defaultGridMessages } from '../grid-messages'

const m = defaultGridMessages

describe('formatMessage', () => {
  it('substitutes placeholders', () => {
    expect(formatMessage('{a} of {b}', { a: 1, b: 2 })).toBe('1 of 2')
  })

  it('leaves an unknown placeholder alone rather than blanking it', () => {
    // A typo in a consumer override should be visible, not silently swallow
    // the number it was meant to carry.
    expect(formatMessage('{visible} of {totl}', { visible: 3 })).toBe('3 of {totl}')
  })

  it('substitutes a placeholder used more than once', () => {
    expect(formatMessage('{n}/{n}', { n: 7 })).toBe('7/7')
  })
})

describe('filterAnnouncement', () => {
  it('reports the match count while a filter is active', () => {
    expect(filterAnnouncement(12, 250, true, false, m)).toBe(
      '12 of 250 rows match the current filters',
    )
  })

  it('has a distinct message for zero matches', () => {
    // "0 of 250 rows match" is technically true but reads as a broken counter.
    expect(filterAnnouncement(0, 250, true, false, m)).toBe(
      'No rows match the current filters',
    )
  })

  it('confirms that clearing the filters took effect', () => {
    expect(filterAnnouncement(250, 250, false, true, m)).toBe(
      'Filters cleared, showing all 250 rows',
    )
  })

  it('stays silent when no filter is or was active', () => {
    // Replacing the data array must not make the grid announce a count nobody
    // asked for.
    expect(filterAnnouncement(250, 250, false, false, m)).toBeNull()
  })
})

describe('selectionAnnouncement', () => {
  it('announces select-all', () => {
    expect(selectionAnnouncement(0, 250, m)).toBe('250 rows selected')
  })

  it('announces clearing a multi-row selection', () => {
    expect(selectionAnnouncement(250, 0, m)).toBe('Selection cleared')
  })

  it('stays silent for a single-row change', () => {
    // Focus moves to the row and the reader announces it from aria-selected;
    // a second announcement would talk over that.
    expect(selectionAnnouncement(0, 1, m)).toBeNull()
    expect(selectionAnnouncement(3, 4, m)).toBeNull()
    expect(selectionAnnouncement(1, 0, m)).toBeNull()
  })

  it('stays silent when the count did not change', () => {
    expect(selectionAnnouncement(5, 5, m)).toBeNull()
  })

  it('announces a shrinking range selection', () => {
    expect(selectionAnnouncement(10, 4, m)).toBe('4 rows selected')
  })
})
