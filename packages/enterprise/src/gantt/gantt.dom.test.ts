/**
 * Component tests for the Gantt view (SvGridGantt): tree order and indent, bar
 * geometry, summary rollups, milestones, dependency arrows, collapse, the task
 * table's columns, and the view mounted through `<SvGrid gantt={...}>`.
 *
 * Geometry is asserted against the model rather than against hard-coded pixels:
 * the model is unit-tested next door, so re-deriving the expected x here proves
 * the RENDERER maps dates the same way, without pinning the test to a tick
 * width someone may tune later.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvGridGantt from './SvGridGantt.svelte'
import { SvGrid, type ColumnDef, type GanttConfig } from '@svgrid/grid'
import { enableGanttView } from './gantt'
import { ganttAxis, ganttTickWidth, makeCalendar, projectRange, resolveTasks } from './gantt-model'

// The renderer is Pro: register it so `<SvGrid gantt={...}>` mounts it rather
// than the enterprise upsell placeholder.
enableGanttView()

// jsdom lacks ResizeObserver, which the grid touches on mount. The grid's own
// suite polyfills this in test-setup.ts; keep a guarded stub here too.
if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

type Task = {
  id: string
  name: string
  owner?: string
  start?: string
  end?: string
  pct?: number
  parentId?: string | null
  milestone?: boolean
}

// September 2026: the 1st is a Tuesday. Two phases, three leaves, a milestone.
const rows: Task[] = [
  { id: 'p1', name: 'Discovery', parentId: null, start: '2026-09-07' },
  { id: 't1', name: 'Interviews', parentId: 'p1', start: '2026-09-07', end: '2026-09-08', pct: 100, owner: 'Ada' },
  { id: 't2', name: 'Synthesis', parentId: 'p1', start: '2026-09-09', end: '2026-09-11', pct: 50, owner: 'Lin' },
  { id: 'p2', name: 'Build', parentId: null, start: '2026-09-14' },
  { id: 't3', name: 'Implementation', parentId: 'p2', start: '2026-09-14', end: '2026-09-18', pct: 0, owner: 'Ada' },
  { id: 'm1', name: 'Launch', parentId: null, start: '2026-09-21', milestone: true },
]

const columns: ColumnDef<any, Task>[] = [
  { field: 'name', header: 'Task', width: 180 },
  { field: 'owner', header: 'Owner', width: 100 },
]

const baseConfig: GanttConfig<any, Task> = {
  startField: 'start',
  endField: 'end',
  titleField: 'name',
  progressField: 'pct',
  parentField: 'parentId',
  milestoneField: 'milestone',
}

function mountGantt(config: Partial<GanttConfig<any, Task>> = {}, data: Task[] = rows) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGridGantt as any, {
    target,
    props: {
      data,
      columns,
      gantt: { ...baseConfig, ...config },
      getRowId: (r: Task) => r.id,
    } as any,
  })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

afterEach(() => {
  document.body.innerHTML = ''
})

const bars = (t: HTMLElement) => [...t.querySelectorAll<HTMLElement>('.sv-gantt-bar')]
const barFor = (t: HTMLElement, key: string) =>
  t.querySelector<HTMLElement>(`.sv-gantt-bar[data-key="${key}"]`)
const tableRows = (t: HTMLElement) => [...t.querySelectorAll<HTMLElement>('.sv-gantt-tr')]
const px = (v: string) => Number.parseFloat(v)

/** Re-derive the renderer's date -> x map from the model, for geometry checks. */
function expectedX(config: Partial<GanttConfig<any, Task>> = {}, data: Task[] = rows) {
  const cfg = { ...baseConfig, ...config }
  const cal = makeCalendar()
  const tasks = resolveTasks(
    data,
    {
      getKey: (r) => r.id,
      getStart: (r) => r.start,
      getEnd: (r) => r.end,
      getProgress: (r) => r.pct,
      getParent: (r) => r.parentId,
      getMilestone: (r) => r.milestone === true,
      getTitle: (r) => r.name,
    },
    cal,
  )
  const today = new Date()
  const range = projectRange(tasks, { paddingDays: cfg.rangePaddingDays ?? 7, today })
  const zoom = (cfg.zoom ?? 'week') as 'week'
  const axis = ganttAxis(range.start, range.end, zoom, { weekStartsOn: cfg.weekStartsOn ?? 0, today })
  const axisPx = Math.max(240, Math.round(axis.ticks.length * ganttTickWidth[zoom]))
  return (d: Date) => ((d.getTime() - axis.start.getTime()) / axis.totalMs) * axisPx
}
const day = (n: number) => new Date(2026, 8, n)

describe('SvGridGantt - rows and the tree', () => {
  it('renders one chart row and one table row per task, in tree order', () => {
    const { target, destroy } = mountGantt()
    expect(bars(target).map((b) => b.dataset.key)).toEqual(['p1', 't1', 't2', 'p2', 't3', 'm1'])
    expect(tableRows(target)).toHaveLength(6)
    destroy()
  })

  it('indents each level in the first table column', () => {
    const { target, destroy } = mountGantt()
    const firstCells = tableRows(target).map(
      (r) => r.querySelector<HTMLElement>('.sv-gantt-td')!.style.paddingLeft,
    )
    // Roots at 8px, children one 14px level in.
    expect(firstCells).toEqual(['8px', '22px', '22px', '8px', '22px', '8px'])
    destroy()
  })

  it('stacks the rows by index at the configured row height', () => {
    const { target, destroy } = mountGantt({ rowHeight: 40 })
    const tops = [...target.querySelectorAll<HTMLElement>('.sv-gantt-row')].map((r) => r.style.top)
    expect(tops).toEqual(['0px', '40px', '80px', '120px', '160px', '200px'])
    destroy()
  })
})

describe('SvGridGantt - bars', () => {
  it('positions a leaf bar where the model says', () => {
    const { target, destroy } = mountGantt()
    const x = expectedX()
    const bar = barFor(target, 't1')!
    // Interviews: the 7th to the 8th, and a date-only end is inclusive.
    expect(px(bar.style.left)).toBeCloseTo(x(day(7)), 4)
    expect(px(bar.style.width)).toBeCloseTo(x(day(9)) - x(day(7)), 4)
    destroy()
  })

  it('fills the bar to the task\'s percent complete', () => {
    const { target, destroy } = mountGantt()
    const fill = (k: string) =>
      barFor(target, k)!.querySelector<HTMLElement>('.sv-gantt-progress')!.style.width
    expect(fill('t1')).toBe('100%')
    expect(fill('t2')).toBe('50%')
    expect(fill('t3')).toBe('0%')
    destroy()
  })

  it('draws a parent as a summary spanning its children', () => {
    const { target, destroy } = mountGantt()
    const x = expectedX()
    const p1 = barFor(target, 'p1')!
    expect(p1.classList.contains('sv-gantt-bar-summary')).toBe(true)
    // Children run the 7th through the 11th, so the exclusive end is the 12th.
    expect(px(p1.style.left)).toBeCloseTo(x(day(7)), 4)
    expect(px(p1.style.width)).toBeCloseTo(x(day(12)) - x(day(7)), 4)
    destroy()
  })

  it('shows the parent\'s duration-weighted rollup, not a task percent', () => {
    // Interviews is 2 days at 100%, Synthesis 3 days at 50%: 7 of 5 days done
    // over 5 days is 70%, which no single child reports.
    const { target, destroy } = mountGantt()
    const fill = barFor(target, 'p1')!.querySelector<HTMLElement>('.sv-gantt-progress')!
    expect(px(fill.style.width)).toBeCloseTo(70, 6)
    destroy()
  })

  it('draws a milestone as a diamond with no width', () => {
    const { target, destroy } = mountGantt()
    const m = barFor(target, 'm1')!
    expect(m.classList.contains('sv-gantt-bar-milestone')).toBe(true)
    expect(m.style.width).toBe('')
    expect(m.querySelector('.sv-gantt-progress')).toBeNull()
    destroy()
  })

  it('turns summary bars off on request', () => {
    const { target, destroy } = mountGantt({ summaryBars: false })
    const p1 = barFor(target, 'p1')!
    expect(p1.classList.contains('sv-gantt-bar-summary')).toBe(false)
    destroy()
  })

  it('describes each bar for a screen reader', () => {
    const { target, destroy } = mountGantt()
    expect(barFor(target, 't1')!.getAttribute('aria-label')).toBe(
      'Interviews, Sep 7 - Sep 8, 2 days, 100%',
    )
    expect(barFor(target, 'm1')!.getAttribute('aria-label')).toBe('Launch, Sep 21')
    destroy()
  })

  it('takes a per-task colour from colorField', () => {
    const { target, destroy } = mountGantt(
      { colorField: 'name' as never },
      [{ id: 'a', name: '#ff0000', start: '2026-09-07', end: '2026-09-08' }],
    )
    expect(barFor(target, 'a')!.style.getPropertyValue('--sv-gantt-accent')).toBe('#ff0000')
    destroy()
  })
})

describe('SvGridGantt - the axis', () => {
  it('draws a tick per axis column and groups them into majors', () => {
    const { target, destroy } = mountGantt()
    expect(target.querySelectorAll('.sv-gantt-tick').length).toBeGreaterThan(0)
    expect(target.querySelectorAll('.sv-gantt-major').length).toBeGreaterThan(0)
    expect(target.querySelectorAll('.sv-gantt-major').length).toBeLessThanOrEqual(
      target.querySelectorAll('.sv-gantt-tick').length,
    )
    destroy()
  })

  it('shades non-working days, and stops when asked', () => {
    const { target, destroy } = mountGantt()
    expect(target.querySelectorAll('.sv-gantt-shade').length).toBeGreaterThan(0)
    destroy()

    const off = mountGantt({ showNonWorking: false })
    expect(off.target.querySelectorAll('.sv-gantt-shade')).toHaveLength(0)
    off.destroy()
  })

  it('draws the today line, and hides it on request', () => {
    // The fixture is anchored in 2026, so "today" only falls inside the window
    // when the range is padded out to reach it - assert the opt-out instead,
    // which is unconditional.
    const { target, destroy } = mountGantt({ todayLine: false })
    expect(target.querySelector('.sv-gantt-today')).toBeNull()
    destroy()
  })

  it('steps the zoom preset and reports it', () => {
    const onZoomChange = vi.fn()
    const { target, destroy } = mountGantt({ zoom: 'week', onZoomChange })
    const label = () => target.querySelector('.sv-gantt-zoom-label')!.textContent
    expect(label()).toBe('week')

    target.querySelector<HTMLButtonElement>('[aria-label="Zoom out"]')!.click()
    flushSync()
    expect(label()).toBe('month')
    expect(onZoomChange).toHaveBeenCalledWith('month')
    destroy()
  })

  it('offers only the presets it was given', () => {
    const { target, destroy } = mountGantt({ zoomLevels: ['week', 'month'], zoom: 'week' })
    const zoomIn = target.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!
    // Already at the finest of the two.
    expect(zoomIn.disabled).toBe(true)
    target.querySelector<HTMLButtonElement>('[aria-label="Zoom out"]')!.click()
    flushSync()
    expect(target.querySelector<HTMLButtonElement>('[aria-label="Zoom out"]')!.disabled).toBe(true)
    destroy()
  })

  it('hides the stepper when only one preset is offered', () => {
    const { target, destroy } = mountGantt({ zoomLevels: ['week'] })
    expect(target.querySelector('.sv-gantt-zoom')).toBeNull()
    destroy()
  })
})

describe('SvGridGantt - dependencies', () => {
  const deps = [
    { id: 'd1', from: 't1', to: 't2' },
    { id: 'd2', from: 't2', to: 't3' },
    // Backwards: t1 (the 7th) cannot wait on m1 (the 21st), so this is violated.
    { id: 'bad', from: 'm1', to: 't1' },
  ]

  it('draws one arrow per link', () => {
    const { target, destroy } = mountGantt({ dependencies: deps })
    expect(target.querySelectorAll('.sv-gantt-dep-line')).toHaveLength(3)
    expect(target.querySelectorAll('.sv-gantt-dep-arrow')).toHaveLength(3)
    destroy()
  })

  it('flags a violated link and leaves the satisfied ones alone', () => {
    const { target, destroy } = mountGantt({ dependencies: deps })
    expect(target.querySelectorAll('.sv-gantt-dep-line.sv-gantt-dep-bad')).toHaveLength(1)
    expect(target.querySelectorAll('.sv-gantt-dep-line')).toHaveLength(3)
    destroy()
  })

  it('draws a cyclic link set without flagging any of it', () => {
    // Closing the loop (t3 -> m1 on top of the three above) makes every link
    // part of a cycle, and the shared cascade helpers ignore those so a
    // reschedule can never loop. The arrows still draw; nothing is "late",
    // because with a cycle there is no answer to what late would mean.
    const { target, destroy } = mountGantt({
      dependencies: [...deps, { id: 'd3', from: 't3', to: 'm1' }],
    })
    expect(target.querySelectorAll('.sv-gantt-dep-line')).toHaveLength(4)
    expect(target.querySelectorAll('.sv-gantt-dep-line.sv-gantt-dep-bad')).toHaveLength(0)
    destroy()
  })

  it('draws nothing when there are no links', () => {
    const { target, destroy } = mountGantt()
    expect(target.querySelector('.sv-gantt-deps')).toBeNull()
    destroy()
  })

  it('reads links from a per-row field too', () => {
    const withField: Task[] = [
      { id: 'a', name: 'A', start: '2026-09-07', end: '2026-09-08' },
      { id: 'b', name: 'B', start: '2026-09-09', end: '2026-09-10' },
    ]
    ;(withField[0] as any).next = ['b']
    const { target, destroy } = mountGantt({ dependencyField: 'next' as never }, withField)
    expect(target.querySelectorAll('.sv-gantt-dep-line')).toHaveLength(1)
    destroy()
  })

  it('skips a link pointing at a row that is not there', () => {
    const { target, destroy } = mountGantt({
      dependencies: [
        { id: 'ok', from: 't1', to: 't2' },
        { id: 'gone', from: 't1', to: 'nope' },
      ],
    })
    expect(target.querySelectorAll('.sv-gantt-dep-line')).toHaveLength(1)
    destroy()
  })
})

describe('SvGridGantt - collapse', () => {
  it('hides a phase\'s children and keeps its summary span', () => {
    const { target, destroy } = mountGantt()
    const x = expectedX()
    const before = px(barFor(target, 'p1')!.style.width)

    const chevron = tableRows(target)[0]!.querySelector<HTMLButtonElement>('.sv-gantt-chevron')!
    chevron.click()
    flushSync()

    expect(bars(target).map((b) => b.dataset.key)).toEqual(['p1', 'p2', 't3', 'm1'])
    // The whole point of rolling up from every task rather than the visible
    // rows: the summary still spans the children it just hid.
    expect(px(barFor(target, 'p1')!.style.width)).toBeCloseTo(before, 4)
    expect(px(barFor(target, 'p1')!.style.width)).toBeCloseTo(x(day(12)) - x(day(7)), 4)
    destroy()
  })

  it('re-anchors an arrow into a collapsed phase onto its summary bar', () => {
    const { target, destroy } = mountGantt({
      dependencies: [{ id: 'd', from: 't2', to: 't3' }],
    })
    expect(target.querySelectorAll('.sv-gantt-dep-line')).toHaveLength(1)

    tableRows(target)[0]!.querySelector<HTMLButtonElement>('.sv-gantt-chevron')!.click()
    flushSync()

    // t2 is hidden inside p1, but the link still draws - from p1's bar.
    expect(target.querySelectorAll('.sv-gantt-dep-line')).toHaveLength(1)
    destroy()
  })

  it('reports the collapsed set, and honours a controlled one', () => {
    const onCollapseChange = vi.fn()
    const { target, destroy } = mountGantt({ onCollapseChange })
    tableRows(target)[0]!.querySelector<HTMLButtonElement>('.sv-gantt-chevron')!.click()
    flushSync()
    expect(onCollapseChange).toHaveBeenCalledWith(['p1'])
    destroy()

    const controlled = mountGantt({ collapsed: ['p2'] })
    expect(bars(controlled.target).map((b) => b.dataset.key)).toEqual(['p1', 't1', 't2', 'p2', 'm1'])
    controlled.destroy()
  })

  it('collapses and expands everything from the toolbar', () => {
    const { target, destroy } = mountGantt()
    const button = () => target.querySelector<HTMLButtonElement>('.sv-gantt-tools .sv-gantt-btn')!
    expect(button().textContent).toContain('Collapse all')

    button().click()
    flushSync()
    expect(bars(target).map((b) => b.dataset.key)).toEqual(['p1', 'p2', 'm1'])
    expect(button().textContent).toContain('Expand all')

    button().click()
    flushSync()
    expect(bars(target)).toHaveLength(6)
    destroy()
  })

  it('gives a leaf no chevron to click', () => {
    const { target, destroy } = mountGantt()
    expect(tableRows(target)[1]!.querySelector('.sv-gantt-chevron')).toBeNull()
    destroy()
  })
})

describe('SvGridGantt - the task table', () => {
  it('uses every field column by default', () => {
    const { target, destroy } = mountGantt()
    expect([...target.querySelectorAll('.sv-gantt-th')].map((h) => h.textContent)).toEqual([
      'Task',
      'Owner',
    ])
    destroy()
  })

  it('selects and orders columns, including the built-ins', () => {
    const { target, destroy } = mountGantt({ tableColumns: ['__duration', 'name'] })
    expect([...target.querySelectorAll('.sv-gantt-th')].map((h) => h.textContent)).toEqual([
      'Days',
      'Task',
    ])
    // Interviews spans the 7th and 8th: two working days.
    const cells = tableRows(target)[1]!.querySelectorAll('.sv-gantt-td')
    expect(cells[0]!.textContent?.trim()).toBe('2')
    destroy()
  })

  it('counts WORKING days in the duration column', () => {
    const { target, destroy } = mountGantt({ tableColumns: ['__duration'] })
    // Implementation runs the 14th to the 18th inclusive: five weekdays.
    expect(tableRows(target)[4]!.querySelector('.sv-gantt-td')!.textContent?.trim()).toBe('5')
    destroy()
  })

  it('renders the progress column as a meter plus a percent', () => {
    const { target, destroy } = mountGantt({ tableColumns: ['__progress'] })
    const cell = tableRows(target)[2]!.querySelector('.sv-gantt-td')!
    expect(cell.querySelector<HTMLElement>('.sv-gantt-meter-fill')!.style.width).toBe('50%')
    expect(cell.textContent).toContain('50%')
    destroy()
  })

  it('shows the row values through the column fields', () => {
    const { target, destroy } = mountGantt()
    const cells = tableRows(target)[1]!.querySelectorAll('.sv-gantt-td')
    expect(cells[0]!.textContent).toContain('Interviews')
    expect(cells[1]!.textContent).toContain('Ada')
    destroy()
  })

  it('ignores a column id that matches nothing', () => {
    const { target, destroy } = mountGantt({ tableColumns: ['name', 'nope'] })
    expect(target.querySelectorAll('.sv-gantt-th')).toHaveLength(1)
    destroy()
  })
})

describe('SvGridGantt - through <SvGrid>', () => {
  function mountGrid(extra: Record<string, unknown> = {}) {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvGrid as any, {
      target,
      props: {
        data: rows,
        columns,
        getRowId: (r: Task) => r.id,
        containerHeight: 400,
        virtualization: false,
        gantt: baseConfig,
        ...extra,
      } as any,
    })
    flushSync()
    return { target, destroy: () => { unmount(app); target.remove() } }
  }

  it('mounts the renderer rather than the upsell', () => {
    const { target, destroy } = mountGrid()
    expect(target.querySelector('.sv-grid-gantt-upsell')).toBeNull()
    expect(target.querySelector('.sv-gantt')).not.toBeNull()
    expect(bars(target)).toHaveLength(6)
    destroy()
  })

  it('draws only the rows the grid\'s search box leaves', async () => {
    // The view never filters; it draws what the grid hands it. This is what
    // makes search, column filters and sort flow through for free.
    const { target, destroy } = mountGrid()
    const search = target.querySelector<HTMLInputElement>('.sv-grid-board-search input')!
    search.value = 'Interviews'
    search.dispatchEvent(new Event('input', { bubbles: true }))

    await vi.waitFor(() => {
      expect(bars(target).map((b) => b.dataset.key)).toEqual(['t1'])
    })
    destroy()
  })
})
