import { describe, expect, it } from 'vitest'
import {
  emptyOutline, groupLines, ungroupLines, clearOutline, toggleCollapsed,
  hiddenByOutline, detailRange, showLevel, shiftOutline, deepestLevel,
  isOutlined, outlineLevel, autoOutline, MAX_OUTLINE_LEVEL,
} from './outline'

/** Rows, where Excel puts the summary below the detail. */
const BELOW = { summaryBelow: true }
/** Columns before the summary, and rows in a sheet built upwards. */
const ABOVE = { summaryBelow: false }

const hidden = (state: Parameters<typeof hiddenByOutline>[0], side = BELOW) =>
  [...hiddenByOutline(state, side)].sort((a, b) => a - b)

describe('grouping', () => {
  it('deepens every line in the range', () => {
    const state = groupLines(emptyOutline(), 1, 4)
    expect(outlineLevel(state, 1)).toBe(1)
    expect(outlineLevel(state, 4)).toBe(1)
    expect(outlineLevel(state, 5)).toBe(0)
    expect(isOutlined(state)).toBe(true)
  })

  it('nests when the range is grouped again', () => {
    let state = groupLines(emptyOutline(), 1, 6)
    state = groupLines(state, 2, 4)
    expect(outlineLevel(state, 1)).toBe(1)
    expect(outlineLevel(state, 2)).toBe(2)
    expect(outlineLevel(state, 4)).toBe(2)
    expect(outlineLevel(state, 5)).toBe(1)
    expect(deepestLevel(state)).toBe(2)
  })

  it('takes the range in either order', () => {
    expect(groupLines(emptyOutline(), 4, 1)).toEqual(groupLines(emptyOutline(), 1, 4))
  })

  it('stops at the level Excel stops at', () => {
    let state = emptyOutline()
    for (let i = 0; i < 12; i += 1) state = groupLines(state, 1, 2)
    expect(outlineLevel(state, 1)).toBe(MAX_OUTLINE_LEVEL)
  })

  it('ungroups back to nothing', () => {
    let state = groupLines(emptyOutline(), 1, 4)
    state = ungroupLines(state, 1, 4)
    expect(isOutlined(state)).toBe(false)
    expect(state.levels).toEqual({})
  })

  it('ungroups one level of a nest at a time', () => {
    let state = groupLines(groupLines(emptyOutline(), 1, 6), 2, 4)
    state = ungroupLines(state, 2, 4)
    expect(outlineLevel(state, 3)).toBe(1)
    expect(isOutlined(state)).toBe(true)
  })

  it('clears the lot', () => {
    expect(isOutlined(clearOutline())).toBe(false)
  })
})

describe('what a summary line owns', () => {
  it('finds the run of deeper lines before it', () => {
    // Rows 1-4 grouped, row 5 the total under them.
    const state = groupLines(emptyOutline(), 1, 4)
    expect(detailRange(state, 5, BELOW)).toEqual({ from: 1, to: 4 })
  })

  it('finds the run after it when the summary is above', () => {
    const state = groupLines(emptyOutline(), 2, 5)
    expect(detailRange(state, 1, ABOVE)).toEqual({ from: 2, to: 5 })
  })

  it('owns nothing when the neighbour is no deeper', () => {
    const state = groupLines(emptyOutline(), 1, 4)
    expect(detailRange(state, 6, BELOW)).toBeNull()
    expect(detailRange(state, 1, ABOVE)).toBeNull()
  })

  it('stops at the edge of its own level in a nest', () => {
    // 1-6 at level 1, 2-4 at level 2: row 5 owns 2-4, row 7 owns 1-6.
    const state = groupLines(groupLines(emptyOutline(), 1, 6), 2, 4)
    expect(detailRange(state, 5, BELOW)).toEqual({ from: 2, to: 4 })
    expect(detailRange(state, 7, BELOW)).toEqual({ from: 1, to: 6 })
  })
})

describe('collapsing', () => {
  it('hides the detail a collapsed summary owns', () => {
    let state = groupLines(emptyOutline(), 1, 4)
    expect(hidden(state)).toEqual([])
    state = toggleCollapsed(state, 5)
    expect(hidden(state)).toEqual([1, 2, 3, 4])
  })

  it('shows it again', () => {
    let state = toggleCollapsed(groupLines(emptyOutline(), 1, 4), 5)
    state = toggleCollapsed(state, 5)
    expect(hidden(state)).toEqual([])
  })

  it('hides the inner group only, when the inner one is collapsed', () => {
    let state = groupLines(groupLines(emptyOutline(), 1, 6), 2, 4)
    state = toggleCollapsed(state, 5)
    expect(hidden(state)).toEqual([2, 3, 4])
  })

  it('hides everything under an outer collapse, nested groups included', () => {
    let state = groupLines(groupLines(emptyOutline(), 1, 6), 2, 4)
    state = toggleCollapsed(state, 7)
    expect(hidden(state)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('ignores a collapsed line that owns nothing', () => {
    const state = toggleCollapsed(emptyOutline(), 3)
    expect(hidden(state)).toEqual([])
  })

  it('forgets a collapse when the group is ungrouped', () => {
    let state = toggleCollapsed(groupLines(emptyOutline(), 1, 4), 5)
    expect(hidden(state)).toEqual([1, 2, 3, 4])
    state = ungroupLines(state, 1, 5)
    // The detail must not be left hidden with no button to bring it back.
    expect(hidden(state)).toEqual([])
  })
})

describe('the level buttons', () => {
  it('level 1 collapses everything but the outermost summaries', () => {
    const base = groupLines(groupLines(emptyOutline(), 1, 6), 2, 4)
    const state = showLevel(base, 1, BELOW)
    expect(hidden(state)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('level 2 opens the outer group and keeps the inner one shut', () => {
    const base = groupLines(groupLines(emptyOutline(), 1, 6), 2, 4)
    const state = showLevel(base, 2, BELOW)
    expect(hidden(state)).toEqual([2, 3, 4])
  })

  it('the deepest level shows everything', () => {
    const base = groupLines(groupLines(emptyOutline(), 1, 6), 2, 4)
    const state = showLevel(base, 3, BELOW)
    expect(hidden(state)).toEqual([])
  })

  it('does nothing on a sheet with no outline', () => {
    expect(hidden(showLevel(emptyOutline(), 1, BELOW))).toEqual([])
  })
})

describe('following a structural edit', () => {
  it('moves a group down when rows are inserted above it', () => {
    const state = shiftOutline(groupLines(emptyOutline(), 5, 8), 2, 3)
    expect(outlineLevel(state, 8)).toBe(1)
    expect(outlineLevel(state, 11)).toBe(1)
    expect(outlineLevel(state, 5)).toBe(0)
  })

  it('moves a collapsed summary with its group', () => {
    let state = toggleCollapsed(groupLines(emptyOutline(), 5, 8), 9)
    state = shiftOutline(state, 0, 2)
    expect(hidden(state)).toEqual([7, 8, 9, 10])
  })

  it('a row inserted inside a group joins it', () => {
    const state = shiftOutline(groupLines(emptyOutline(), 2, 5), 3, 1)
    // 2..6 are now all in the group, the new row 3 included.
    for (const line of [2, 3, 4, 5, 6]) expect(outlineLevel(state, line)).toBe(1)
  })

  it('a deleted row takes its level away', () => {
    const state = shiftOutline(groupLines(emptyOutline(), 2, 5), 2, -2)
    expect(outlineLevel(state, 2)).toBe(1)
    expect(outlineLevel(state, 3)).toBe(1)
    expect(outlineLevel(state, 4)).toBe(0)
  })

  it('leaves a group above the edit alone', () => {
    const state = shiftOutline(groupLines(emptyOutline(), 1, 3), 8, 4)
    expect(outlineLevel(state, 1)).toBe(1)
    expect(outlineLevel(state, 3)).toBe(1)
  })
})

describe('auto outline', () => {
  it('groups each run between the summary lines', () => {
    // Rows 3 and 7 hold totals; the runs before each become groups.
    const state = autoOutline(0, 7, (line) => line === 3 || line === 7, BELOW)
    for (const line of [0, 1, 2, 4, 5, 6]) expect(outlineLevel(state, line)).toBe(1)
    expect(outlineLevel(state, 3)).toBe(0)
    expect(outlineLevel(state, 7)).toBe(0)
  })

  it('groups the run after each summary when the summary is above', () => {
    const state = autoOutline(0, 7, (line) => line === 0 || line === 4, ABOVE)
    for (const line of [1, 2, 3, 5, 6, 7]) expect(outlineLevel(state, line)).toBe(1)
    expect(outlineLevel(state, 0)).toBe(0)
    expect(outlineLevel(state, 4)).toBe(0)
  })

  it('finds nothing where there are no summaries', () => {
    expect(isOutlined(autoOutline(0, 5, () => false, BELOW))).toBe(false)
  })
})
