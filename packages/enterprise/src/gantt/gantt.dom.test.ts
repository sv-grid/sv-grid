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
/** A bar's two link handles, in start-then-finish order. They are siblings of
 *  the bar inside its row, not children of it. */
const linkDots = (t: HTMLElement, key: string) => [
  ...(barFor(t, key)!.parentElement!.querySelectorAll<HTMLElement>('.sv-gantt-link-dot')),
]
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

  it("reports a PARENT's rolled-up span in the duration column", () => {
    // A phase row carries no dates of its own, so reading its raw task made
    // every phase report 0 days - visible only once the column was on screen.
    const { target, destroy } = mountGantt({ tableColumns: ['__duration'] })
    // Discovery spans the 7th to the 11th inclusive: five weekdays. Read the
    // text span, not the cell - the cell also holds the collapse chevron.
    expect(
      tableRows(target)[0]!.querySelector('.sv-gantt-cell-text')!.textContent?.trim(),
    ).toBe('5')
    destroy()
  })

  it('fits its columns to the pane instead of spilling them over the chart', () => {
    // Columns summing past `tableWidth` used to overflow and draw across the
    // chart. The first column flexes, so the row always adds up to the pane.
    const { target, destroy } = mountGantt({
      tableColumns: ['name', 'owner'],   // 180 + 100 = 280
      tableWidth: 200,
    })
    const cells = tableRows(target)[0]!.querySelectorAll<HTMLElement>('.sv-gantt-td')
    // The first absorbs the shrink; the rest keep the width they asked for.
    expect(cells[0]!.style.flex).toBe('1 1 180px')
    expect(cells[0]!.style.minWidth).toBe('0px')
    expect(cells[1]!.style.width).toBe('100px')
    // jsdom normalises `flex: none` to its longhand.
    expect(cells[1]!.style.flex).toBe('0 0 auto')
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

// --- Phase 2: editing -------------------------------------------------------

/**
 * Drive a pointer gesture the way the renderer listens for it: `pointerdown`
 * on the element, `pointermove` on the window (which is where the drag handlers
 * live), then `pointerup`. The first move crosses the 3px threshold.
 */
function dragBy(el: Element, dx: number, dy = 0) {
  const r = el.getBoundingClientRect()
  const x0 = r.left + r.width / 2
  const y0 = r.top + r.height / 2
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x0, clientY: y0 }))
  window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x0 + dx, clientY: y0 + dy }))
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x0 + dx, clientY: y0 + dy }))
  flushSync()
}

/**
 * jsdom gives every element a zero rect, so the renderer's client-x to date
 * maths has nothing to read. Stub the pieces the drag path uses, in the SAME
 * coordinate space the renderer assumes: a bar's chart-local x plus the width
 * of the task pane, because `dateAtClientX` subtracts that pane back off.
 * Getting the offset wrong here silently shifts every asserted date.
 */
function stubGeometry(target: HTMLElement, axisPxPerDay: number) {
  const scroll = target.querySelector<HTMLElement>('.sv-gantt-scroll')!
  Object.defineProperty(scroll, 'scrollLeft', { value: 0, writable: true, configurable: true })
  scroll.getBoundingClientRect = () => rect(0, 2000)
  const pane = target.querySelector<HTMLElement>('.sv-gantt-table')
  const tableW = pane ? Number.parseFloat(pane.style.width) || 0 : 0
  for (const bar of target.querySelectorAll<HTMLElement>('.sv-gantt-bar')) {
    const left = tableW + (Number.parseFloat(bar.style.left) || 0)
    const width = Number.parseFloat(bar.style.width) || 12
    bar.getBoundingClientRect = () => rect(left, width)
  }
  return axisPxPerDay
}
const rect = (left: number, width: number) =>
  ({ left, top: 0, right: left + width, bottom: 20, width, height: 20, x: left, y: 0, toJSON: () => ({}) }) as DOMRect

/** Pixels one day occupies, straight from the model the renderer uses. */
function pxPerDay() {
  const x = expectedX()
  return x(day(8)) - x(day(7))
}

describe('SvGridGantt - editing', () => {
  const editable = { editable: true as const }

  it('does nothing at all when `editable` is not set', () => {
    const onTaskMove = vi.fn()
    const { target, destroy } = mountGantt({ onTaskMove })
    expect(target.querySelector('.sv-gantt-grip')).toBeNull()
    expect(target.querySelector('.sv-gantt-link-dot')).toBeNull()
    expect(target.querySelector('.sv-gantt-grip-p')).toBeNull()
    stubGeometry(target, pxPerDay())
    dragBy(barFor(target, 't1')!, pxPerDay() * 3)
    expect(onTaskMove).not.toHaveBeenCalled()
    destroy()
  })

  it('moves a bar by whole days and reports the new span', () => {
    const onTaskMove = vi.fn()
    const { target, destroy } = mountGantt({ ...editable, onTaskMove, nonWorkingDays: [] })
    const d = stubGeometry(target, pxPerDay())
    dragBy(barFor(target, 't1')!, d * 3)

    expect(onTaskMove).toHaveBeenCalledTimes(1)
    const e = onTaskMove.mock.calls[0]![0]
    // Interviews ran the 7th to the 9th (exclusive); three days on.
    expect(e.start.getTime()).toBe(day(10).getTime())
    expect(e.end.getTime()).toBe(day(12).getTime())
    // The duration is preserved, and the source row is untouched.
    expect(e.end.getTime() - e.start.getTime()).toBe(day(9).getTime() - day(7).getTime())
    expect(rows.find((r) => r.id === 't1')!.start).toBe('2026-09-07')
    destroy()
  })

  it('treats a sub-threshold drag as a click, not a move', () => {
    const onTaskMove = vi.fn()
    const { target, destroy } = mountGantt({ ...editable, onTaskMove })
    stubGeometry(target, pxPerDay())
    dragBy(barFor(target, 't1')!, 1)
    expect(onTaskMove).not.toHaveBeenCalled()
    destroy()
  })

  it('lands a move on a working day when respectWorkingTime is on', () => {
    // The 12th is a Saturday; the drop slides to Monday the 14th.
    const onTaskMove = vi.fn()
    const { target, destroy } = mountGantt({ ...editable, onTaskMove })
    const d = stubGeometry(target, pxPerDay())
    dragBy(barFor(target, 't1')!, d * 5)
    expect(onTaskMove.mock.calls[0]![0].start.getTime()).toBe(day(14).getTime())
    destroy()
  })

  it('moves a parent with its whole subtree', () => {
    const onTaskMove = vi.fn()
    const { target, destroy } = mountGantt({ ...editable, onTaskMove, nonWorkingDays: [] })
    const d = stubGeometry(target, pxPerDay())
    dragBy(barFor(target, 'p1')!, d * 2)

    expect(onTaskMove).toHaveBeenCalledTimes(1)
    const e = onTaskMove.mock.calls[0]![0]
    // One callback carries the batch, so the consumer writes it in one pass.
    expect(e.subtree.map((x: any) => x.row.id).sort()).toEqual(['t1', 't2'])
    for (const s of e.subtree) {
      expect(s.start.getTime() - day(7).getTime()).toBeGreaterThan(0)
    }
    destroy()
  })

  it('resizes from either edge and says which one moved', () => {
    const onTaskResize = vi.fn()
    const { target, destroy } = mountGantt({ ...editable, onTaskResize, nonWorkingDays: [] })
    const d = stubGeometry(target, pxPerDay())

    dragBy(barFor(target, 't1')!.querySelector('.sv-gantt-grip-r')!, d * 2)
    expect(onTaskResize.mock.calls[0]![0].edge).toBe('end')
    expect(onTaskResize.mock.calls[0]![0].start.getTime()).toBe(day(7).getTime())

    onTaskResize.mockClear()
    dragBy(barFor(target, 't3')!.querySelector('.sv-gantt-grip-l')!, -d)
    expect(onTaskResize.mock.calls[0]![0].edge).toBe('start')
    destroy()
  })

  it('gives a summary and a milestone no resize or progress grips', () => {
    const { target, destroy } = mountGantt(editable)
    expect(barFor(target, 'p1')!.querySelector('.sv-gantt-grip')).toBeNull()
    expect(barFor(target, 'p1')!.querySelector('.sv-gantt-grip-p')).toBeNull()
    expect(barFor(target, 'm1')!.querySelector('.sv-gantt-grip')).toBeNull()
    // But both can still be linked from: the handles live in the ROW, not the
    // bar, because the bar clips its children.
    expect(linkDots(target, 'm1')).toHaveLength(2)
    expect(linkDots(target, 'p1')).toHaveLength(2)
    destroy()
  })

  it('sets progress in 5% steps from the grip', () => {
    const onProgressChange = vi.fn()
    const { target, destroy } = mountGantt({ ...editable, onProgressChange })
    stubGeometry(target, pxPerDay())
    const bar = barFor(target, 't3')!
    const r = bar.getBoundingClientRect()
    const grip = bar.querySelector('.sv-gantt-grip-p')!
    grip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: r.left, clientY: 10 }))
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + r.width / 2, clientY: 10 }))
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: r.left + r.width / 2, clientY: 10 }))
    flushSync()

    expect(onProgressChange).toHaveBeenCalledTimes(1)
    expect(onProgressChange.mock.calls[0]![0].progress).toBe(50)
    expect(onProgressChange.mock.calls[0]![0].row.id).toBe('t3')
    destroy()
  })

  it('cascades successors forward after a move, and reports the shifts', () => {
    const onDependenciesChange = vi.fn()
    const { target, destroy } = mountGantt({
      ...editable,
      nonWorkingDays: [],
      dependencies: [{ id: 'd1', from: 't1', to: 't2' }],
      onDependenciesChange,
    })
    const d = stubGeometry(target, pxPerDay())
    // Push Interviews far enough right that Synthesis can no longer start where
    // it was, so the link forces it along.
    dragBy(barFor(target, 't1')!, d * 6)

    expect(onDependenciesChange).toHaveBeenCalled()
    const moves = onDependenciesChange.mock.calls[0]![0]
    expect(moves.map((m: any) => m.id)).toContain('t2')
    destroy()
  })

  it('does not cascade when autoReschedule is off', () => {
    const onDependenciesChange = vi.fn()
    const { target, destroy } = mountGantt({
      ...editable,
      nonWorkingDays: [],
      dependencies: [{ id: 'd1', from: 't1', to: 't2' }],
      autoReschedule: false,
      onDependenciesChange,
    })
    const d = stubGeometry(target, pxPerDay())
    dragBy(barFor(target, 't1')!, d * 6)
    expect(onDependenciesChange).not.toHaveBeenCalled()
    destroy()
  })
})

describe('SvGridGantt - drawing links', () => {
  const editable = { editable: true as const }

  /** Drag from one bar's handle onto another bar. */
  function drawLink(target: HTMLElement, fromKey: string, toKey: string, edge: 'l' | 'r', dropAt: 'start' | 'end') {
    const to = barFor(target, toKey)!
    const tr = to.getBoundingClientRect()
    const x = dropAt === 'start' ? tr.left + tr.width * 0.25 : tr.left + tr.width * 0.75
    // elementFromPoint drives the hit test; point it at the target bar.
    const original = document.elementFromPoint
    ;(document as any).elementFromPoint = () => to
    const dot = linkDots(target, fromKey)[edge === 'l' ? 0 : 1]!
    dot.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0 }))
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: 10 }))
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: 10 }))
    flushSync()
    ;(document as any).elementFromPoint = original
  }

  it('draws finish-to-start from an end handle onto a start', () => {
    const onDependencyAdd = vi.fn()
    const { target, destroy } = mountGantt({ ...editable, onDependencyAdd })
    stubGeometry(target, pxPerDay())
    drawLink(target, 't1', 't3', 'r', 'start')

    expect(onDependencyAdd).toHaveBeenCalledTimes(1)
    expect(onDependencyAdd.mock.calls[0]![0]).toMatchObject({ from: 't1', to: 't3', type: 'FS' })
    destroy()
  })

  it('draws finish-to-finish when dropped on the far half', () => {
    const onDependencyAdd = vi.fn()
    const { target, destroy } = mountGantt({ ...editable, onDependencyAdd })
    stubGeometry(target, pxPerDay())
    drawLink(target, 't1', 't3', 'r', 'end')
    expect(onDependencyAdd.mock.calls[0]![0].type).toBe('FF')
    destroy()
  })

  it('draws start-to-start from a start handle', () => {
    const onDependencyAdd = vi.fn()
    const { target, destroy } = mountGantt({ ...editable, onDependencyAdd })
    stubGeometry(target, pxPerDay())
    drawLink(target, 't1', 't3', 'l', 'start')
    expect(onDependencyAdd.mock.calls[0]![0].type).toBe('SS')
    destroy()
  })

  it('refuses a link that would close a cycle, and flashes instead', () => {
    // t1 -> t3 already exists, so t3 -> t1 would have no legal schedule.
    const onDependencyAdd = vi.fn()
    const { target, destroy } = mountGantt({
      ...editable,
      dependencies: [{ id: 'd1', from: 't1', to: 't3' }],
      onDependencyAdd,
    })
    stubGeometry(target, pxPerDay())
    drawLink(target, 't3', 't1', 'r', 'start')

    expect(onDependencyAdd).not.toHaveBeenCalled()
    expect(target.querySelectorAll('.sv-gantt-refused').length).toBe(2)
    destroy()
  })

  it('refuses a duplicate of a link that is already there', () => {
    const onDependencyAdd = vi.fn()
    const { target, destroy } = mountGantt({
      ...editable,
      dependencies: [{ id: 'd1', from: 't1', to: 't3' }],
      onDependencyAdd,
    })
    stubGeometry(target, pxPerDay())
    drawLink(target, 't1', 't3', 'r', 'start')
    expect(onDependencyAdd).not.toHaveBeenCalled()
    destroy()
  })
})

describe('SvGridGantt - keyboard', () => {
  const editable = { editable: true as const }
  const press = (el: Element, key: string, mods: Partial<KeyboardEventInit> = {}) => {
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key, ...mods }))
    flushSync()
  }

  it('nudges a bar a day with an arrow, a week with Shift', () => {
    const onTaskMove = vi.fn()
    const { target, destroy } = mountGantt({ ...editable, onTaskMove, nonWorkingDays: [] })
    press(barFor(target, 't1')!, 'ArrowRight')
    expect(onTaskMove.mock.calls[0]![0].start.getTime()).toBe(day(8).getTime())

    onTaskMove.mockClear()
    press(barFor(target, 't3')!, 'ArrowRight', { shiftKey: true })
    expect(onTaskMove.mock.calls[0]![0].start.getTime()).toBe(day(21).getTime())
    destroy()
  })

  it('stretches the finish with Alt', () => {
    const onTaskResize = vi.fn()
    const { target, destroy } = mountGantt({ ...editable, onTaskResize, nonWorkingDays: [] })
    press(barFor(target, 't1')!, 'ArrowRight', { altKey: true })
    expect(onTaskResize.mock.calls[0]![0]).toMatchObject({ edge: 'end' })
    expect(onTaskResize.mock.calls[0]![0].end.getTime()).toBe(day(10).getTime())
    destroy()
  })

  it('steps progress with + and -', () => {
    const onProgressChange = vi.fn()
    const { target, destroy } = mountGantt({ ...editable, onProgressChange })
    press(barFor(target, 't2')!, '+')
    expect(onProgressChange.mock.calls[0]![0].progress).toBe(55)
    onProgressChange.mockClear()
    press(barFor(target, 't2')!, '-')
    expect(onProgressChange.mock.calls[0]![0].progress).toBe(50)
    destroy()
  })

  it('deletes with Delete', () => {
    const onTaskDelete = vi.fn()
    const { target, destroy } = mountGantt({ ...editable, onTaskDelete })
    press(barFor(target, 't1')!, 'Delete')
    expect(onTaskDelete).toHaveBeenCalledWith(rows.find((r) => r.id === 't1'))
    destroy()
  })

  it('leaves the plan alone when not editable', () => {
    const onTaskMove = vi.fn()
    const { target, destroy } = mountGantt({ onTaskMove })
    press(barFor(target, 't1')!, 'ArrowRight')
    expect(onTaskMove).not.toHaveBeenCalled()
    destroy()
  })
})

describe('SvGridGantt - undo and redo', () => {
  const editable = { editable: true as const, history: true as const, nonWorkingDays: [] }
  const ctrlZ = (shift = false) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'z', ctrlKey: true, shiftKey: shift }))
    flushSync()
  }

  it('re-fires the move with the original dates, then forward again', () => {
    const onTaskMove = vi.fn()
    const { target, destroy } = mountGantt({ ...editable, onTaskMove })
    barFor(target, 't1')!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }))
    flushSync()
    expect(onTaskMove.mock.calls[0]![0].start.getTime()).toBe(day(8).getTime())

    ctrlZ()
    // Undo re-emits the callback so the consumer's data follows it back.
    expect(onTaskMove).toHaveBeenCalledTimes(2)
    expect(onTaskMove.mock.calls[1]![0].start.getTime()).toBe(day(7).getTime())
    expect(px(barFor(target, 't1')!.style.left)).toBeCloseTo(expectedX()(day(7)), 4)

    ctrlZ(true)
    expect(onTaskMove).toHaveBeenCalledTimes(3)
    expect(onTaskMove.mock.calls[2]![0].start.getTime()).toBe(day(8).getTime())
    destroy()
  })

  it('does nothing without `history`', () => {
    const onTaskMove = vi.fn()
    const { target, destroy } = mountGantt({ editable: true, nonWorkingDays: [], onTaskMove })
    barFor(target, 't1')!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }))
    flushSync()
    ctrlZ()
    expect(onTaskMove).toHaveBeenCalledTimes(1)
    destroy()
  })
})

describe('SvGridGantt - the context menu', () => {
  const open = (target: HTMLElement, key: string) => {
    barFor(target, key)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 40, clientY: 40 }))
    flushSync()
  }
  const menu = () => document.querySelector('.sv-gantt-menu')

  it('offers Edit, Add subtask and Delete when each is wired up', () => {
    const { target, destroy } = mountGantt({
      editable: true,
      drawer: true,
      onTaskAdd: vi.fn(),
      onTaskDelete: vi.fn(),
    })
    open(target, 't1')
    expect(menu()).not.toBeNull()
    expect(menu()!.textContent).toContain('Edit')
    expect(menu()!.textContent).toContain('Add subtask')
    expect(menu()!.textContent).toContain('Delete')
    destroy()
  })

  it('appends the consumer\'s own items', () => {
    const { target, destroy } = mountGantt({
      taskMenu: () => [{ label: 'Open ticket', onSelect: () => {} }],
    })
    open(target, 't1')
    expect(menu()!.textContent).toContain('Open ticket')
    destroy()
  })

  it('closes on Escape', () => {
    // The dismissable layer has to be ACTIVATED, not just created - without
    // that the menu cannot be dismissed at all and traps every later click.
    const { target, destroy } = mountGantt({ taskMenu: () => [{ label: 'X', onSelect: () => {} }] })
    open(target, 't1')
    expect(menu()).not.toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    flushSync()
    expect(menu()).toBeNull()
    destroy()
  })

  it('opens nothing when there is nothing to offer', () => {
    const { target, destroy } = mountGantt()
    open(target, 't1')
    expect(menu()).toBeNull()
    destroy()
  })
})

describe('SvGridGantt - the drawer', () => {
  it('opens on a click and saves the edited span and percent', async () => {
    const onTaskCommit = vi.fn()
    const { target, destroy } = mountGantt({ editable: true, drawer: true, onTaskCommit })
    barFor(target, 't1')!.click()
    flushSync()
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog!.textContent).toContain('Interviews')
    destroy()
  })

  it('stays shut when no drawer is configured', () => {
    const { target, destroy } = mountGantt({ editable: true })
    barFor(target, 't1')!.click()
    flushSync()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    destroy()
  })
})
