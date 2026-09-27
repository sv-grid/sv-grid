/**
 * Excel's row and column outline: Data > Group, Ungroup and the little
 * numbered bar down the side that collapses a section away.
 *
 * Modelled the way the FILE models it, a level per line rather than a list
 * of ranges, because that is what `<row outlineLevel="2">` carries and
 * because ranges have to be split, merged and renumbered on every
 * structural edit while levels only have to be shifted. A group is then
 * not a stored object at all: it is a maximal run of lines whose level is
 * higher than the summary line beside it.
 *
 * `summaryBelow` is Excel's own default and says which side the summary
 * line sits on. With it on, grouping rows 2 to 5 puts the collapse button
 * on row 6, because that is where the total goes; with it off the button
 * is on row 1. Columns have the same idea under `summaryRight`.
 *
 * Nothing here touches the cells. Hiding a line is the shell's business,
 * and `hiddenByOutline` is what tells it which.
 */

/** Excel allows eight levels, 1 to 7 plus the ungrouped 0. */
export const MAX_OUTLINE_LEVEL = 7

export type OutlineState = {
  /** Level per line index, 1 to 7. A line with no entry is at level 0. */
  levels: Record<number, number>
  /** Summary lines whose group is collapsed. */
  collapsed: number[]
}

export type OutlineSide = {
  /** The summary sits after the detail (Excel's default for rows). */
  summaryBelow: boolean
}

export const emptyOutline = (): OutlineState => ({ levels: {}, collapsed: [] })

export const outlineLevel = (state: OutlineState, line: number): number => state.levels[line] ?? 0

/** True where nothing is grouped, so the shell can skip the whole gutter. */
export const isOutlined = (state: OutlineState): boolean =>
  Object.values(state.levels).some((l) => l > 0)

/** The deepest level in use, which is how many buttons the level bar shows. */
export function deepestLevel(state: OutlineState): number {
  let max = 0
  for (const l of Object.values(state.levels)) if (l > max) max = l
  return max
}

const clone = (state: OutlineState): OutlineState => ({
  levels: { ...state.levels },
  collapsed: [...state.collapsed],
})

/** Drop levels that fell to zero, so the record stays sparse. */
function tidy(state: OutlineState): OutlineState {
  for (const [key, value] of Object.entries(state.levels)) {
    if (value <= 0) delete state.levels[Number(key)]
  }
  // A summary line whose group has gone is no longer collapsed.
  state.collapsed = [...new Set(state.collapsed)].sort((a, b) => a - b)
  return state
}

/**
 * Group `from`..`to`, deepening each line by one.
 *
 * Grouping an already grouped run is how a nested group is made, which is
 * why this adds a level rather than setting one.
 */
export function groupLines(state: OutlineState, from: number, to: number): OutlineState {
  const next = clone(state)
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  for (let line = lo; line <= hi; line += 1) {
    next.levels[line] = Math.min(outlineLevel(next, line) + 1, MAX_OUTLINE_LEVEL)
  }
  return tidy(next)
}

/** Ungroup `from`..`to`, taking one level off each line. */
export function ungroupLines(state: OutlineState, from: number, to: number): OutlineState {
  const next = clone(state)
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  for (let line = lo; line <= hi; line += 1) {
    const level = outlineLevel(next, line) - 1
    if (level > 0) next.levels[line] = level
    else delete next.levels[line]
  }
  // A line that is no longer in a group cannot be a collapsed summary of
  // one either, or its detail would stay hidden with nothing to show it.
  next.collapsed = next.collapsed.filter((line) => {
    if (line < lo || line > hi) return true
    return hasDetail({ ...next }, line, { summaryBelow: true })
      || hasDetail({ ...next }, line, { summaryBelow: false })
  })
  return tidy(next)
}

/** Remove every group on this axis. */
export const clearOutline = (): OutlineState => emptyOutline()

/** The lines a summary line owns, or an empty range when it owns none. */
export function detailRange(
  state: OutlineState,
  summary: number,
  side: OutlineSide,
): { from: number; to: number } | null {
  const own = outlineLevel(state, summary)
  const step = side.summaryBelow ? -1 : 1
  let line = summary + step
  if (outlineLevel(state, line) <= own) return null
  while (outlineLevel(state, line + step) > own) line += step
  return side.summaryBelow ? { from: line, to: summary - 1 } : { from: summary + 1, to: line }
}

const hasDetail = (state: OutlineState, summary: number, side: OutlineSide): boolean =>
  detailRange(state, summary, side) !== null

/** Collapse or expand the group `summary` owns. */
export function toggleCollapsed(state: OutlineState, summary: number): OutlineState {
  const next = clone(state)
  const at = next.collapsed.indexOf(summary)
  if (at >= 0) next.collapsed.splice(at, 1)
  else next.collapsed.push(summary)
  return tidy(next)
}

/** Which lines an outline hides, detail of every collapsed group included. */
export function hiddenByOutline(state: OutlineState, side: OutlineSide): Set<number> {
  const hidden = new Set<number>()
  for (const summary of state.collapsed) {
    const range = detailRange(state, summary, side)
    if (!range) continue
    for (let line = range.from; line <= range.to; line += 1) hidden.add(line)
  }
  return hidden
}

/**
 * Show levels up to `level` and collapse everything deeper: the numbered
 * buttons at the corner of the outline bar.
 *
 * Level 1 is the most collapsed view, showing only the outermost
 * summaries; the deepest level shows everything.
 */
export function showLevel(state: OutlineState, level: number, side: OutlineSide): OutlineState {
  const next = clone(state)
  next.collapsed = []
  const lines = Object.keys(next.levels).map(Number)
  if (lines.length === 0) return tidy(next)
  const lo = Math.min(...lines)
  const hi = Math.max(...lines)
  // A summary sits just outside its detail, so the sweep runs one line
  // wider than the outlined block on both sides.
  for (let line = lo - 1; line <= hi + 1; line += 1) {
    const range = detailRange(next, line, side)
    if (!range) continue
    // A line at level L is visible under button N when L < N, so the group
    // whose detail starts at the summary's level plus one has to close as
    // soon as that depth reaches N rather than only once it passes it.
    if (outlineLevel(next, line) + 1 >= level) next.collapsed.push(line)
  }
  return tidy(next)
}

/**
 * The outline after lines were inserted or deleted, so a group follows the
 * rows it was put around.
 *
 * An inserted line takes the level of the line it pushed down, which is
 * what Excel does and what makes a row added inside a group part of it.
 */
export function shiftOutline(
  state: OutlineState,
  at: number,
  count: number,
): OutlineState {
  const next = emptyOutline()
  const move = (line: number): number | null => {
    if (count > 0) return line >= at ? line + count : line
    // A deleted line takes its level with it.
    if (line >= at && line < at - count) return null
    return line >= at ? line + count : line
  }
  for (const [key, level] of Object.entries(state.levels)) {
    const to = move(Number(key))
    if (to !== null) next.levels[to] = level
  }
  if (count > 0) {
    // An insertion inside a group inherits the level of what it displaced.
    const inherited = state.levels[at]
    if (inherited !== undefined) {
      for (let i = 0; i < count; i += 1) next.levels[at + i] = inherited
    }
  }
  for (const summary of state.collapsed) {
    const to = move(summary)
    if (to !== null) next.collapsed.push(to)
  }
  return tidy(next)
}

/**
 * An outline read off a block's shape: Excel's Auto Outline.
 *
 * A line is detail when the line on the summary side holds a formula that
 * reads back over it, which is what a SUBTOTAL or SUM column looks like.
 * `isSummary` answers that for one line, so this module stays free of the
 * workbook.
 */
export function autoOutline(
  from: number,
  to: number,
  isSummary: (line: number) => boolean,
  side: OutlineSide,
): OutlineState {
  const next = emptyOutline()
  let runStart: number | null = null
  const close = (summary: number, start: number, end: number) => {
    if (end < start) return
    for (let line = start; line <= end; line += 1) next.levels[line] = 1
    void summary
  }
  if (side.summaryBelow) {
    for (let line = from; line <= to; line += 1) {
      if (isSummary(line)) {
        if (runStart !== null) close(line, runStart, line - 1)
        runStart = null
      } else if (runStart === null) runStart = line
    }
  } else {
    for (let line = to; line >= from; line -= 1) {
      if (isSummary(line)) {
        if (runStart !== null) close(line, line + 1, runStart)
        runStart = null
      } else if (runStart === null) runStart = line
    }
  }
  return tidy(next)
}
