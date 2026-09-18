import { describe, expect, it } from 'vitest'
import {
  addWorkingDays,
  ganttAxis,
  ganttTickWidth,
  ganttTree,
  isWorkingDay,
  makeCalendar,
  nodeIndex,
  parseDay,
  projectRange,
  resolveTasks,
  snapToWorkingDay,
  visibleAnchor,
  workingDays,
  type GanttTaskSpec,
  type ResolvedTask,
} from './gantt-model'

// September 2026: the 1st is a Tuesday, so the 5th/6th and 12th/13th are
// weekends. Every fixture below is anchored there.
const cal = makeCalendar()
const day = (n: number) => new Date(2026, 8, n)
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

type Row = {
  id: string
  name?: string
  start?: unknown
  end?: unknown
  days?: unknown
  pct?: unknown
  parent?: string | null
  flag?: boolean
}
const spec: GanttTaskSpec<Row> = {
  getKey: (r) => r.id,
  getStart: (r) => r.start as never,
  getEnd: (r) => r.end as never,
  getDuration: (r) => r.days as never,
  getTitle: (r) => r.name ?? '',
  getProgress: (r) => r.pct as never,
  getParent: (r) => r.parent,
  getMilestone: (r) => r.flag === true,
}
const resolve = (rows: Row[]) => resolveTasks(rows, spec, cal)

describe('parseDay', () => {
  it('reads a date-only string as LOCAL midnight, not UTC', () => {
    // `new Date('2026-09-14')` is UTC midnight, which west of Greenwich is the
    // 13th locally - a bar a day early on every task, for half the world.
    const d = parseDay('2026-09-14')!
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(8)
    expect(d.getDate()).toBe(14)
    expect(d.getHours()).toBe(0)
  })

  it('passes a Date, epoch-ms and a timestamped string straight through', () => {
    expect(parseDay(day(14))!.getTime()).toBe(day(14).getTime())
    expect(parseDay(day(14).getTime())!.getTime()).toBe(day(14).getTime())
    expect(parseDay('2026-09-14T09:30')!.getHours()).toBe(9)
  })

  it('returns null for nothing and for junk', () => {
    expect(parseDay(null)).toBeNull()
    expect(parseDay(undefined)).toBeNull()
    expect(parseDay('not a date')).toBeNull()
  })
})

describe('working days', () => {
  it('counts a plain week as five', () => {
    // Mon 7th through the following Mon 14th, end exclusive.
    expect(workingDays(day(7), day(14), cal)).toBe(5)
  })

  it('drops a holiday from the count', () => {
    const withHoliday = makeCalendar([0, 6], ['2026-09-09'])
    expect(workingDays(day(7), day(14), withHoliday)).toBe(4)
  })

  it('counts nothing for an empty or inverted range', () => {
    expect(workingDays(day(7), day(7), cal)).toBe(0)
    expect(workingDays(day(14), day(7), cal)).toBe(0)
  })

  it('ends a one-day Friday task at Saturday midnight, not Monday', () => {
    // The exclusive end is the midnight AFTER the last working day, so the bar
    // covers Friday and stops. Rounding it up to Monday would draw two days of
    // weekend as if they were work.
    expect(addWorkingDays(day(11), 1, cal).getTime()).toBe(day(12).getTime())
  })

  it('carries a task that genuinely spans a weekend across it', () => {
    // Thu 10th, 3 working days: Thu, Fri, Mon -> ends Tue the 15th, so the bar
    // does cover the weekend it runs through. The opposite of the case above.
    expect(addWorkingDays(day(10), 3, cal).getTime()).toBe(day(15).getTime())
  })

  it('treats a zero or negative duration as a milestone', () => {
    expect(addWorkingDays(day(10), 0, cal).getTime()).toBe(day(10).getTime())
    expect(addWorkingDays(day(10), -2, cal).getTime()).toBe(day(10).getTime())
  })

  it('snaps to a working day in both directions', () => {
    // Sat the 12th.
    expect(snapToWorkingDay(day(12), 1, cal).getTime()).toBe(day(14).getTime())
    expect(snapToWorkingDay(day(12), -1, cal).getTime()).toBe(day(11).getTime())
    // A working day is already its own answer.
    expect(snapToWorkingDay(day(10), 1, cal).getTime()).toBe(day(10).getTime())
  })

  it('does not spin when every day is off', () => {
    // Nonsense config, but a hang is a worse answer than a wrong date.
    const never = makeCalendar([0, 1, 2, 3, 4, 5, 6])
    expect(isWorkingDay(day(10), never)).toBe(false)
    expect(snapToWorkingDay(day(10), 1, never).getTime()).toBe(day(10).getTime())
    expect(addWorkingDays(day(10), 5, never).getTime()).toBe(day(10).getTime())
  })
})

describe('resolveTasks', () => {
  it('prefers an explicit end over a duration', () => {
    const [t] = resolve([{ id: 'a', start: '2026-09-07', end: '2026-09-08', days: 99 }])
    expect(t!.end.getTime()).toBe(day(9).getTime())
  })

  it('reads a date-only end as INCLUSIVE of its day', () => {
    // The 14th to the 16th is three days to a person, so the exclusive end is
    // the 17th.
    const [t] = resolve([{ id: 'a', start: '2026-09-14', end: '2026-09-16' }])
    expect(t!.start.getTime()).toBe(day(14).getTime())
    expect(t!.end.getTime()).toBe(day(17).getTime())
    expect(workingDays(t!.start, t!.end, cal)).toBe(3)
  })

  it('takes a timestamped end literally', () => {
    const [t] = resolve([{ id: 'a', start: '2026-09-14', end: '2026-09-16T17:00' }])
    expect(t!.end.getDate()).toBe(16)
    expect(t!.end.getHours()).toBe(17)
  })

  it('derives an end from a WORKING-day duration', () => {
    const [t] = resolve([{ id: 'a', start: '2026-09-10', days: 3 }])
    expect(t!.end.getTime()).toBe(day(15).getTime())
  })

  it('makes a task with neither end nor duration a milestone', () => {
    const [t] = resolve([{ id: 'a', start: '2026-09-14' }])
    expect(t!.milestone).toBe(true)
    expect(t!.end.getTime()).toBe(t!.start.getTime())
  })

  it('honours milestoneField even on a task with a span', () => {
    const [t] = resolve([{ id: 'a', start: '2026-09-14', end: '2026-09-16', flag: true }])
    expect(t!.milestone).toBe(true)
    // The span is kept; only the rendering changes.
    expect(t!.end.getTime()).toBe(day(17).getTime())
  })

  it('never produces a backwards bar', () => {
    const [t] = resolve([{ id: 'a', start: '2026-09-14', end: '2026-09-01T00:00' }])
    expect(t!.end.getTime()).toBe(t!.start.getTime())
  })

  it('SKIPS a row with no readable start', () => {
    // A backlog item with no date is not a bar. Inventing one would silently
    // schedule work nobody scheduled.
    const out = resolve([
      { id: 'a', start: '2026-09-14' },
      { id: 'b' },
      { id: 'c', start: 'nonsense' },
    ])
    expect(out.map((t) => t.key)).toEqual(['a'])
  })

  it('clamps progress and reads junk as zero', () => {
    const out = resolve([
      { id: 'a', start: '2026-09-14', pct: 140 },
      { id: 'b', start: '2026-09-14', pct: -5 },
      { id: 'c', start: '2026-09-14', pct: 'x' },
      { id: 'd', start: '2026-09-14', pct: undefined },
      { id: 'e', start: '2026-09-14', pct: 42 },
    ])
    expect(out.map((t) => t.progress)).toEqual([100, 0, 0, 0, 42])
  })

  it('treats an empty parent id as a root', () => {
    const out = resolve([
      { id: 'a', start: '2026-09-14', parent: null },
      { id: 'b', start: '2026-09-14', parent: '' },
    ])
    expect(out.map((t) => t.parentKey)).toEqual([null, null])
  })
})

describe('ganttTree', () => {
  const tasks = resolve([
    { id: 'p1', name: 'Phase 1', start: '2026-09-07', end: '2026-09-07', parent: null },
    { id: 't1', name: 'Task 1', start: '2026-09-07', end: '2026-09-08', parent: 'p1' },
    { id: 't2', name: 'Task 2', start: '2026-09-09', end: '2026-09-11', parent: 'p1' },
    { id: 'p2', name: 'Phase 2', start: '2026-09-14', end: '2026-09-14', parent: null },
    { id: 't3', name: 'Task 3', start: '2026-09-14', end: '2026-09-18', parent: 'p2' },
  ])

  it('orders roots and their children, depth-first', () => {
    const nodes = ganttTree(tasks)
    expect(nodes.map((n) => n.task.key)).toEqual(['p1', 't1', 't2', 'p2', 't3'])
    expect(nodes.map((n) => n.depth)).toEqual([0, 1, 1, 0, 1])
    expect(nodes.map((n) => n.hasChildren)).toEqual([true, false, false, true, false])
  })

  it('nests three levels deep', () => {
    const deep = resolve([
      { id: 'a', start: '2026-09-07', parent: null },
      { id: 'b', start: '2026-09-07', parent: 'a' },
      { id: 'c', start: '2026-09-07', parent: 'b' },
    ])
    expect(ganttTree(deep).map((n) => n.depth)).toEqual([0, 1, 2])
  })

  it('promotes an orphan to a root rather than dropping it', () => {
    // Its phase was filtered out of the view; losing the task too would hide
    // work from the plan.
    const orphan = resolve([
      { id: 'a', start: '2026-09-07', parent: null },
      { id: 'x', start: '2026-09-07', parent: 'gone' },
    ])
    const nodes = ganttTree(orphan)
    expect(nodes.map((n) => n.task.key)).toEqual(['a', 'x'])
    expect(nodes.map((n) => n.depth)).toEqual([0, 0])
  })

  it('breaks a parent cycle instead of hanging', () => {
    const cyclic = resolve([
      { id: 'a', start: '2026-09-07', parent: 'b' },
      { id: 'b', start: '2026-09-07', parent: 'a' },
    ])
    const nodes = ganttTree(cyclic)
    expect(nodes).toHaveLength(2)
    expect(nodes.every((n) => n.depth === 0)).toBe(true)
  })

  it('treats a self-parent as a root', () => {
    const self = resolve([{ id: 'a', start: '2026-09-07', parent: 'a' }])
    expect(ganttTree(self).map((n) => n.depth)).toEqual([0])
  })

  it('spans a parent summary over its children', () => {
    const [p1] = ganttTree(tasks)
    // Children run the 7th to the 12th (the 11th, end-inclusive).
    expect(p1!.summary!.start.getTime()).toBe(day(7).getTime())
    expect(p1!.summary!.end.getTime()).toBe(day(12).getTime())
  })

  it('weights summary progress by duration, not by task count', () => {
    // 2 days at 100% beside 6 days at 0% is a quarter of the work done.
    const weighted = resolve([
      { id: 'p', start: '2026-09-07', parent: null },
      { id: 'short', start: '2026-09-07', end: '2026-09-08', pct: 100, parent: 'p' },
      { id: 'long', start: '2026-09-09', end: '2026-09-14', pct: 0, parent: 'p' },
    ])
    expect(ganttTree(weighted)[0]!.summary!.progress).toBeCloseTo(25, 6)
  })

  it('averages plainly when every descendant is a milestone', () => {
    // Zero-duration descendants give nothing to weight by; the count is the
    // only honest answer left.
    const flags = resolve([
      { id: 'p', start: '2026-09-07', parent: null },
      { id: 'm1', start: '2026-09-07', pct: 100, parent: 'p' },
      { id: 'm2', start: '2026-09-09', pct: 0, parent: 'p' },
    ])
    expect(ganttTree(flags)[0]!.summary!.progress).toBeCloseTo(50, 6)
  })

  it('rolls up through a middle layer', () => {
    const deep = resolve([
      { id: 'top', start: '2026-09-07', parent: null },
      { id: 'mid', start: '2026-09-07', parent: 'top' },
      { id: 'leaf', start: '2026-09-07', end: '2026-09-10', pct: 50, parent: 'mid' },
    ])
    const [top] = ganttTree(deep)
    expect(top!.summary!.end.getTime()).toBe(day(11).getTime())
    expect(top!.summary!.progress).toBeCloseTo(50, 6)
  })

  it('leaves no summary on a leaf', () => {
    expect(ganttTree(tasks)[1]!.summary).toBeUndefined()
  })

  it('hides a collapsed phase\'s children but still rolls them up', () => {
    const nodes = ganttTree(tasks, new Set(['p1']))
    expect(nodes.map((n) => n.task.key)).toEqual(['p1', 'p2', 't3'])
    expect(nodes[0]!.collapsed).toBe(true)
    // The whole point: the summary still spans the hidden children.
    expect(nodes[0]!.summary!.end.getTime()).toBe(day(12).getTime())
  })

  it('ignores a collapse of a row that has no children', () => {
    const nodes = ganttTree(tasks, new Set(['t1']))
    expect(nodes).toHaveLength(5)
    expect(nodes[1]!.collapsed).toBe(false)
  })

  it('indexes the visible rows by position', () => {
    const nodes = ganttTree(tasks)
    expect(nodeIndex(nodes).get('p2')).toBe(3)
    expect(nodeIndex(nodes).get('missing')).toBeUndefined()
  })
})

describe('visibleAnchor', () => {
  const tasks = resolve([
    { id: 'p', start: '2026-09-07', parent: null },
    { id: 'c', start: '2026-09-07', parent: 'p' },
    { id: 'g', start: '2026-09-07', parent: 'c' },
    { id: 'other', start: '2026-09-14', parent: null },
  ])

  it('maps a visible row to itself', () => {
    const anchor = visibleAnchor(ganttTree(tasks), tasks)
    expect(anchor.get('g')).toBe('g')
    expect(anchor.get('other')).toBe('other')
  })

  it('maps a hidden grandchild to its nearest VISIBLE ancestor', () => {
    // Collapsing the phase must re-point its arrows at the summary bar, not
    // drop them.
    const nodes = ganttTree(tasks, new Set(['p']))
    const anchor = visibleAnchor(nodes, tasks)
    expect(anchor.get('g')).toBe('p')
    expect(anchor.get('c')).toBe('p')
  })

  it('maps to the nearest ancestor, not the root, when a middle row shows', () => {
    const nodes = ganttTree(tasks, new Set(['c']))
    expect(visibleAnchor(nodes, tasks).get('g')).toBe('c')
  })
})

describe('projectRange', () => {
  const tasks = resolve([
    { id: 'a', start: '2026-09-07', end: '2026-09-11' },
    { id: 'b', start: '2026-09-14', end: '2026-09-18' },
  ])
  const today = day(15)

  it('pads both sides of the plan', () => {
    const r = projectRange(tasks, { paddingDays: 2, today })
    expect(r.start.getTime()).toBe(day(5).getTime())
    // Last end is the 19th (inclusive 18th), + 2.
    expect(r.end.getTime()).toBe(day(21).getTime())
  })

  it('takes no padding at zero', () => {
    const r = projectRange(tasks, { paddingDays: 0, today })
    expect(r.start.getTime()).toBe(day(7).getTime())
    expect(r.end.getTime()).toBe(day(19).getTime())
  })

  it('clamps to minDate and maxDate', () => {
    const r = projectRange(tasks, {
      paddingDays: 30,
      today,
      minDate: '2026-09-01',
      maxDate: '2026-09-30',
    })
    expect(r.start.getTime()).toBe(day(1).getTime())
    expect(r.end.getTime()).toBe(day(30).getTime())
  })

  it('centres on today when there is nothing to plan', () => {
    const r = projectRange([], { paddingDays: 7, today })
    expect(r.start.getTime()).toBe(day(8).getTime())
    expect(r.end.getTime()).toBe(day(22).getTime())
  })

  it('never returns an empty window', () => {
    // A single milestone with no padding would otherwise divide by zero.
    const one = resolve([{ id: 'm', start: '2026-09-14' }])
    const r = projectRange(one, { paddingDays: 0, today })
    expect(r.end.getTime()).toBeGreaterThan(r.start.getTime())
  })
})

describe('ganttAxis', () => {
  const zooms = ['day', 'week', 'month', 'quarter', 'year'] as const

  it.each(zooms)('tiles the window exactly at %s zoom', (zoom) => {
    // Any gap or overlap here is a header that drifts away from its bars.
    const axis = ganttAxis(day(3), new Date(2026, 11, 20), zoom, { weekStartsOn: 1 })
    expect(axis.ticks.length).toBeGreaterThan(0)
    const sum = axis.ticks.reduce((n, t) => n + t.widthPct, 0)
    expect(sum).toBeCloseTo(100, 6)
    for (let i = 1; i < axis.ticks.length; i++) {
      const prev = axis.ticks[i - 1]!
      const cur = axis.ticks[i]!
      expect(cur.start.getTime()).toBe(prev.end.getTime())
      expect(cur.leftPct).toBeCloseTo(prev.leftPct + prev.widthPct, 6)
    }
    expect(axis.ticks[0]!.leftPct).toBeCloseTo(0, 6)
    expect(axis.ticks[0]!.start.getTime()).toBe(axis.start.getTime())
    expect(axis.ticks[axis.ticks.length - 1]!.end.getTime()).toBe(axis.end.getTime())
  })

  it.each(zooms)('covers the requested window at %s zoom', (zoom) => {
    // Snapping goes OUT, never in - a task on the last day must have somewhere
    // to draw.
    const from = day(3)
    const to = new Date(2026, 10, 7)
    const axis = ganttAxis(from, to, zoom, { weekStartsOn: 1 })
    expect(axis.start.getTime()).toBeLessThanOrEqual(from.getTime())
    expect(axis.end.getTime()).toBeGreaterThanOrEqual(to.getTime())
  })

  it.each(zooms)('groups every tick into exactly one major at %s zoom', (zoom) => {
    const axis = ganttAxis(day(3), new Date(2026, 11, 20), zoom, { weekStartsOn: 1 })
    const sum = axis.majors.reduce((n, m) => n + m.widthPct, 0)
    expect(sum).toBeCloseTo(100, 6)
    expect(axis.majors.length).toBeGreaterThan(0)
    expect(axis.majors.length).toBeLessThanOrEqual(axis.ticks.length)
  })

  it('uses day ticks under month majors at the default week zoom', () => {
    const axis = ganttAxis(day(1), day(30), 'week')
    expect(axis.ticks).toHaveLength(29)
    expect(axis.ticks[0]!.label).toBe('1')
    expect(axis.majors[0]!.label).toBe('September 2026')
  })

  it('names the weekday at day zoom, where there is room', () => {
    const axis = ganttAxis(day(7), day(12), 'day', { weekStartsOn: 1 })
    expect(axis.ticks[0]!.label).toBe('Mon 7')
    expect(axis.majors[0]!.label).toBe('7 - 13 Sep')
  })

  it('spans a month boundary in a week major', () => {
    const axis = ganttAxis(new Date(2026, 8, 28), new Date(2026, 9, 4), 'day', {
      weekStartsOn: 1,
    })
    expect(axis.majors[0]!.label).toBe('28 Sep - 4 Oct')
  })

  it('uses week ticks at month zoom, starting on weekStartsOn', () => {
    const axis = ganttAxis(day(9), day(30), 'month', { weekStartsOn: 1 })
    // The 9th is a Wednesday; the first tick backs up to Monday the 7th.
    expect(axis.start.getDay()).toBe(1)
    expect(axis.start.getTime()).toBe(day(7).getTime())
    for (const t of axis.ticks) expect(t.end.getTime() - t.start.getTime()).toBe(7 * 86_400_000)
  })

  it('uses month ticks and quarter majors at quarter zoom', () => {
    const axis = ganttAxis(new Date(2026, 6, 1), new Date(2026, 9, 1), 'quarter')
    expect(axis.ticks.map((t) => t.label)).toEqual(['Jul', 'Aug', 'Sep'])
    expect(axis.majors[0]!.label).toBe('Q3 2026')
  })

  it('uses year majors at year zoom', () => {
    const axis = ganttAxis(new Date(2026, 0, 1), new Date(2027, 0, 1), 'year')
    expect(axis.ticks).toHaveLength(12)
    expect(axis.majors).toHaveLength(1)
    expect(axis.majors[0]!.label).toBe('2026')
  })

  it('flags exactly one tick as today, and none when today is outside', () => {
    const axis = ganttAxis(day(1), day(30), 'week', { today: day(15) })
    expect(axis.ticks.filter((t) => t.today)).toHaveLength(1)
    expect(axis.ticks.find((t) => t.today)!.start.getTime()).toBe(day(15).getTime())

    const away = ganttAxis(day(1), day(30), 'week', { today: new Date(2025, 0, 1) })
    expect(away.ticks.some((t) => t.today)).toBe(false)
    expect(ganttAxis(day(1), day(30), 'week').ticks.some((t) => t.today)).toBe(false)
  })

  it('flags the whole week containing today at month zoom', () => {
    const axis = ganttAxis(day(1), day(30), 'month', { weekStartsOn: 1, today: day(16) })
    const hit = axis.ticks.filter((t) => t.today)
    expect(hit).toHaveLength(1)
    expect(hit[0]!.start.getTime()).toBe(day(14).getTime())
  })

  it('leaves a boundary-aligned window alone', () => {
    const axis = ganttAxis(new Date(2026, 8, 1), new Date(2026, 9, 1), 'quarter')
    expect(axis.start.getTime()).toBe(new Date(2026, 8, 1).getTime())
    expect(axis.end.getTime()).toBe(new Date(2026, 9, 1).getTime())
    expect(axis.ticks).toHaveLength(1)
  })

  it('still renders one tick for a zero-length window', () => {
    const axis = ganttAxis(day(14), day(14), 'week')
    expect(axis.ticks).toHaveLength(1)
    expect(axis.totalMs).toBeGreaterThan(0)
  })

  it('offers a pixel width for every preset', () => {
    for (const z of zooms) expect(ganttTickWidth[z]).toBeGreaterThan(0)
  })
})

describe('the model together', () => {
  it('lays a small plan out end to end', () => {
    // The shape a demo uses: a phase, two tasks, a milestone.
    const rows: Row[] = [
      { id: 'p', name: 'Discovery', start: '2026-09-07', parent: null },
      { id: 't1', name: 'Interviews', start: '2026-09-07', days: 3, pct: 100, parent: 'p' },
      { id: 't2', name: 'Synthesis', start: '2026-09-10', end: '2026-09-11', pct: 50, parent: 'p' },
      { id: 'm', name: 'Kickoff', start: '2026-09-14', parent: null },
    ]
    const tasks = resolve(rows)
    const nodes = ganttTree(tasks)
    const range = projectRange(tasks, { paddingDays: 1, today: day(9) })
    const axis = ganttAxis(range.start, range.end, 'week', { today: day(9) })

    expect(nodes.map((n) => n.task.key)).toEqual(['p', 't1', 't2', 'm'])
    expect(ymd(nodes[1]!.task.end)).toBe('2026-09-10')
    expect(nodes[3]!.task.milestone).toBe(true)
    // The phase spans both children and is part done.
    expect(ymd(nodes[0]!.summary!.start)).toBe('2026-09-07')
    expect(ymd(nodes[0]!.summary!.end)).toBe('2026-09-12')
    expect(nodes[0]!.summary!.progress).toBeGreaterThan(0)
    expect(nodes[0]!.summary!.progress).toBeLessThan(100)
    // Every bar fits inside the axis the range produced.
    for (const n of nodes) {
      expect(n.task.start.getTime()).toBeGreaterThanOrEqual(axis.start.getTime())
      expect(n.task.end.getTime()).toBeLessThanOrEqual(axis.end.getTime())
    }
  })

  it('keeps summaries intact when the tree is built from ALL tasks', () => {
    // The renderer resolves every row and only then hides the collapsed ones,
    // which is what lets this hold.
    const tasks: ResolvedTask<Row>[] = resolve([
      { id: 'p', start: '2026-09-07', parent: null },
      { id: 'a', start: '2026-09-07', end: '2026-09-08', parent: 'p' },
      { id: 'b', start: '2026-09-21', end: '2026-09-25', parent: 'p' },
    ])
    const open = ganttTree(tasks)
    const shut = ganttTree(tasks, new Set(['p']))
    expect(open[0]!.summary).toEqual(shut[0]!.summary)
    expect(shut).toHaveLength(1)
  })
})
