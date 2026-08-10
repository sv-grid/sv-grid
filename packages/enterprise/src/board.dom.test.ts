/**
 * Component tests for Kanban board mode (SvGridBoard): lane derivation,
 * card rendering, WIP counts, empty lanes, and drag-to-move (onCardMove).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, unmount, flushSync, createRawSnippet } from 'svelte'
import SvGridBoard from './SvGridBoard.svelte'
import { SvGrid, SvDropDownList, createDismissableLayer } from '@svgrid/grid'
import { enableBoardView } from './board'

// The board renderer is Pro: register it with the grid so `<SvGrid board={...}>`
// mounts SvGridBoard (rather than the enterprise upsell placeholder).
enableBoardView()

// jsdom lacks ResizeObserver, which the card editor's dropdown touches on mount.
// The grid's own suite polyfills this in test-setup.ts; the enterprise dom
// project has no shared setup, so stub it here.
if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

function mountOn(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGridBoard as any, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

afterEach(() => { document.body.innerHTML = '' })

const data = [
  { id: 1, title: 'Design spec', status: 'todo', owner: 'Sam' },
  { id: 2, title: 'Write tests', status: 'todo', owner: 'Lee' },
  { id: 3, title: 'Ship it', status: 'done', owner: 'Sam' },
]
const columns = [
  { field: 'title', header: 'Title' },
  { field: 'owner', header: 'Owner' },
  { field: 'status', header: 'Status' },
]

function fire(el: Element, type: string) {
  el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }))
  flushSync()
}

describe('SvGridBoard lanes', () => {
  it('derives lanes from the distinct groupBy values (first-seen order)', () => {
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status' } })
    try {
      const lanes = target.querySelectorAll('.sv-board-lane')
      expect(lanes).toHaveLength(2)
      const titles = [...target.querySelectorAll('.sv-board-lane-title')].map((n) => n.textContent)
      expect(titles).toEqual(['todo', 'done'])
    } finally { destroy() }
  })

  it('buckets cards into their lane and shows a count', () => {
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status' } })
    try {
      const counts = [...target.querySelectorAll('.sv-board-lane-count')].map((n) => n.textContent?.trim())
      expect(counts).toEqual(['2', '1'])
      const firstLaneCards = target.querySelector('.sv-board-lane')!.querySelectorAll('.sv-board-card')
      expect(firstLaneCards).toHaveLength(2)
    } finally { destroy() }
  })

  it('honours explicit ordered lanes with titles, incl. an empty one', () => {
    const board = {
      groupBy: 'status',
      lanes: [
        { id: 'todo', title: 'To do' },
        { id: 'doing', title: 'In progress' },
        { id: 'done', title: 'Done' },
      ],
    }
    const { target, destroy } = mountOn({ data, columns, board })
    try {
      const titles = [...target.querySelectorAll('.sv-board-lane-title')].map((n) => n.textContent)
      expect(titles).toEqual(['To do', 'In progress', 'Done'])
      // The empty 'doing' lane shows a placeholder.
      expect(target.querySelectorAll('.sv-board-lane-empty')).toHaveLength(1)
    } finally { destroy() }
  })

  it('flags a lane that exceeds its WIP limit', () => {
    const board = { groupBy: 'status', lanes: [{ id: 'todo', title: 'To do', wipLimit: 1 }] }
    const { target, destroy } = mountOn({ data, columns, board })
    try {
      const count = target.querySelector('.sv-board-lane-count')!
      expect(count.textContent?.trim()).toBe('2/1')
      expect(count.classList.contains('is-over')).toBe(true)
    } finally { destroy() }
  })
})

describe('SvGridBoard default card', () => {
  it('renders the title field and meta rows', () => {
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status' } })
    try {
      const first = target.querySelector('.sv-board-card')!
      expect(first.querySelector('.sv-board-card-title')?.textContent).toBe('Design spec')
      // Owner is a meta row; status (the groupBy) and title are excluded.
      const labels = [...first.querySelectorAll('.sv-board-card-metarow dt')].map((n) => n.textContent)
      expect(labels).toContain('Owner')
      expect(labels).not.toContain('Status')
      expect(labels).not.toContain('Title')
    } finally { destroy() }
  })

  it('shows an add-card button only when onCardAdd is set', () => {
    const onCardAdd = vi.fn()
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status', onCardAdd } })
    try {
      const add = target.querySelector<HTMLButtonElement>('.sv-board-lane-add')!
      expect(add).not.toBeNull()
      add.click()
      expect(onCardAdd).toHaveBeenCalledWith('todo')
    } finally { destroy() }
  })
})

describe('SvGridBoard drag to move (built-in)', () => {
  it('fires onCardMove with row + from/to lane when a card is dropped on another lane', () => {
    const onCardMove = vi.fn()
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status', onCardMove } })
    try {
      const lanes = target.querySelectorAll('.sv-board-lane')
      const card = lanes[0]!.querySelector('.sv-board-card')! // "Design spec" in todo
      const targetBody = lanes[1]!.querySelector('.sv-board-lane-body')! // done lane

      fire(card, 'dragstart')
      fire(targetBody, 'dragover')
      fire(targetBody, 'drop')

      expect(onCardMove).toHaveBeenCalledTimes(1)
      const e = onCardMove.mock.calls[0]![0]
      expect(e.row.id).toBe(1)
      expect(e.fromLane).toBe('todo')
      expect(e.toLane).toBe('done')
      expect(typeof e.toIndex).toBe('number')
    } finally { destroy() }
  })

  it('actually moves the card into the target lane itself (no consumer code)', () => {
    // No onCardMove: the board applies the move via its own overlay.
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status' } })
    try {
      const lanes = target.querySelectorAll('.sv-board-lane')
      const card = lanes[0]!.querySelector('.sv-board-card')!
      const targetBody = lanes[1]!.querySelector('.sv-board-lane-body')!

      fire(card, 'dragstart')
      fire(targetBody, 'dragover')
      fire(targetBody, 'drop')

      const counts = [...target.querySelectorAll('.sv-board-lane-count')].map((n) => n.textContent?.trim())
      expect(counts).toEqual(['1', '2']) // todo 2->1, done 1->2
      // The moved card now lives in the done lane.
      const doneTitles = [...lanes[1]!.querySelectorAll('.sv-board-card-title')].map((n) => n.textContent)
      expect(doneTitles).toContain('Design spec')
    } finally { destroy() }
  })

  it('does not fire onCardMove for a no-op drop onto its own single-card lane', () => {
    const onCardMove = vi.fn()
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status', onCardMove } })
    try {
      const lanes = target.querySelectorAll('.sv-board-lane')
      const doneBody = lanes[1]!.querySelector('.sv-board-lane-body')! // done: single card
      const card = doneBody.querySelector('.sv-board-card')!
      fire(card, 'dragstart')
      fire(doneBody, 'drop')
      expect(onCardMove).not.toHaveBeenCalled()
    } finally { destroy() }
  })
})

describe('SvGridBoard card editing (built-in)', () => {
  function dblclick(el: Element) {
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    flushSync()
  }

  it('double-click opens the inline editor with a field per editable column', () => {
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status', editable: true } })
    try {
      dblclick(target.querySelector('.sv-board-card')!)
      const form = target.querySelector('.sv-board-card-edit')
      expect(form).not.toBeNull()
      // title + owner (status is the groupBy field, excluded)
      expect(form!.querySelectorAll('input')).toHaveLength(2)
    } finally { destroy() }
  })

  it('saving commits the changed fields and updates the card', () => {
    const onCardCommit = vi.fn()
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status', editable: true, onCardCommit } })
    try {
      dblclick(target.querySelector('.sv-board-card')!)
      const input = target.querySelector<HTMLInputElement>('.sv-board-card-edit input')!
      input.value = 'Renamed'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      const save = [...target.querySelectorAll('.sv-board-btn')].find((b) => b.textContent === 'Save')! as HTMLButtonElement
      save.click()
      flushSync()
      expect(onCardCommit).toHaveBeenCalledTimes(1)
      expect(onCardCommit.mock.calls[0]![0].changes.title).toBe('Renamed')
      expect(target.querySelector('.sv-board-card-edit')).toBeNull()
      expect(target.querySelector('.sv-board-card-title')?.textContent).toBe('Renamed')
    } finally { destroy() }
  })

  it('cancel closes the editor without committing', () => {
    const onCardCommit = vi.fn()
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status', editable: true, onCardCommit } })
    try {
      dblclick(target.querySelector('.sv-board-card')!)
      const cancel = [...target.querySelectorAll('.sv-board-btn')].find((b) => b.textContent === 'Cancel')! as HTMLButtonElement
      cancel.click()
      flushSync()
      expect(onCardCommit).not.toHaveBeenCalled()
      expect(target.querySelector('.sv-board-card-edit')).toBeNull()
    } finally { destroy() }
  })

  it('onCardEdit is used instead of the built-in editor when provided', () => {
    const onCardEdit = vi.fn()
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status', editable: true, onCardEdit } })
    try {
      dblclick(target.querySelector('.sv-board-card')!)
      expect(onCardEdit).toHaveBeenCalledTimes(1)
      expect(onCardEdit.mock.calls[0]![0].id).toBe(1)
      expect(target.querySelector('.sv-board-card-edit')).toBeNull()
    } finally { destroy() }
  })
})

describe('SvGridBoard keyboard navigation', () => {
  function keydown(el: Element, key: string) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    flushSync()
  }
  const activeTitle = () =>
    (document.activeElement as HTMLElement | null)?.querySelector('.sv-board-card-title')?.textContent

  it('Arrow Down/Up moves focus between cards in a lane (not grabbed)', () => {
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status' } })
    try {
      const first = target.querySelector<HTMLElement>('.sv-board-card')! // Design spec (todo)
      first.focus()
      keydown(first, 'ArrowDown')
      expect(activeTitle()).toBe('Write tests')
      keydown(document.activeElement!, 'ArrowUp')
      expect(activeTitle()).toBe('Design spec')
    } finally { destroy() }
  })

  it('Arrow Right moves focus to the adjacent lane (not grabbed)', () => {
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status' } })
    try {
      const first = target.querySelector<HTMLElement>('.sv-board-card')! // todo
      first.focus()
      keydown(first, 'ArrowRight')
      expect(activeTitle()).toBe('Ship it') // the done lane's card
    } finally { destroy() }
  })
})

describe('SvGridBoard keyboard drag (built-in)', () => {
  function keydown(el: Element, key: string) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    flushSync()
  }

  it('Space grabs a card and ArrowRight moves it to the next lane', () => {
    const onCardMove = vi.fn()
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status', onCardMove } })
    try {
      const lanes = target.querySelectorAll('.sv-board-lane')
      const card = lanes[0]!.querySelector('.sv-board-card')! // todo
      keydown(card, ' ')
      expect(card.getAttribute('aria-grabbed')).toBe('true')
      keydown(card, 'ArrowRight')
      expect(onCardMove).toHaveBeenCalledTimes(1)
      expect(onCardMove.mock.calls[0]![0].toLane).toBe('done')
      const doneTitles = [...lanes[1]!.querySelectorAll('.sv-board-card-title')].map((n) => n.textContent)
      expect(doneTitles).toContain('Design spec')
    } finally { destroy() }
  })

  it('Escape cancels a grab and restores the card', () => {
    const onCardMove = vi.fn()
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status', onCardMove } })
    try {
      const lanes = target.querySelectorAll('.sv-board-lane')
      const card = lanes[0]!.querySelector('.sv-board-card')!
      keydown(card, ' ')
      keydown(card, 'ArrowRight') // move to done -> the node is recreated in the new lane
      const moved = [...target.querySelectorAll('.sv-board-card')].find(
        (c) => c.querySelector('.sv-board-card-title')?.textContent === 'Design spec',
      )!
      keydown(moved, 'Escape') // cancel -> back to todo
      const todoTitles = [...target.querySelectorAll('.sv-board-lane')[0]!.querySelectorAll('.sv-board-card-title')].map((n) => n.textContent)
      expect(todoTitles).toContain('Design spec')
    } finally { destroy() }
  })
})

describe('SvGridBoard extensions', () => {
  it('swimlaneBy renders a band per value, each with the full lane set', () => {
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status', swimlaneBy: 'owner' } })
    try {
      const bands = target.querySelectorAll('.sv-board-swim')
      expect(bands).toHaveLength(2) // Sam, Lee
      expect(bands[0]!.querySelectorAll('.sv-board-lane')).toHaveLength(2) // todo, done
      // Sam's todo lane holds "Design spec"; Lee's done lane is empty.
      const samTodo = bands[0]!.querySelectorAll('.sv-board-lane')[0]!
      expect(samTodo.querySelector('.sv-board-card-title')?.textContent).toBe('Design spec')
    } finally { destroy() }
  })

  it('dragging across bands reassigns both lane and swimlane', () => {
    const onCardMove = vi.fn()
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status', swimlaneBy: 'owner', onCardMove } })
    try {
      const bands = target.querySelectorAll('.sv-board-swim')
      const samTodoCard = bands[0]!.querySelectorAll('.sv-board-lane')[0]!.querySelector('.sv-board-card')!
      const leeDoneBody = bands[1]!.querySelectorAll('.sv-board-lane')[1]!.querySelector('.sv-board-lane-body')!
      fire(samTodoCard, 'dragstart')
      fire(leeDoneBody, 'dragover')
      fire(leeDoneBody, 'drop')
      expect(onCardMove).toHaveBeenCalledTimes(1)
      const e = onCardMove.mock.calls[0]![0]
      expect(e.toLane).toBe('done')
      expect(e.fromSwimlane).toBe('Sam')
      expect(e.toSwimlane).toBe('Lee')
    } finally { destroy() }
  })

  it('enforceWip rejects a drop that would exceed a lane WIP limit', () => {
    const onCardMove = vi.fn()
    const board = {
      groupBy: 'status',
      enforceWip: true,
      lanes: [{ id: 'todo', title: 'To do' }, { id: 'done', title: 'Done', wipLimit: 1 }],
      onCardMove,
    }
    const { target, destroy } = mountOn({ data, columns, board })
    try {
      const lanes = target.querySelectorAll('.sv-board-lane')
      const card = lanes[0]!.querySelector('.sv-board-card')! // a todo card
      const doneBody = lanes[1]!.querySelector('.sv-board-lane-body')! // done: 1/1 already
      fire(card, 'dragstart')
      fire(doneBody, 'dragover')
      fire(doneBody, 'drop')
      expect(onCardMove).not.toHaveBeenCalled()
      const counts = [...target.querySelectorAll('.sv-board-lane-count')].map((n) => n.textContent?.trim())
      expect(counts).toEqual(['2', '1/1']) // nothing moved
    } finally { destroy() }
  })

  it('collapsibleLanes: clicking the toggle collapses the lane body', () => {
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status', collapsibleLanes: true } })
    try {
      const lane = target.querySelector('.sv-board-lane')!
      expect(lane.querySelector('.sv-board-lane-body')).not.toBeNull()
      const toggle = lane.querySelector<HTMLButtonElement>('.sv-board-lane-toggle')!
      toggle.click()
      flushSync()
      expect(lane.classList.contains('is-collapsed')).toBe(true)
      expect(lane.querySelector('.sv-board-lane-body')).toBeNull()
    } finally { destroy() }
  })
})

describe('SvGrid board filter passthrough', () => {
  it('renders the grid filtered rows; the search box filters cards', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvGrid as any, { target, props: { data, columns, board: { groupBy: 'status' } } as any })
    flushSync()
    try {
      expect(target.querySelectorAll('.sv-board-card')).toHaveLength(3)
      const input = target.querySelector<HTMLInputElement>('.sv-grid-board-search input')!
      input.value = 'Ship'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      expect(target.querySelectorAll('.sv-board-card')).toHaveLength(1)
      expect(target.querySelector('.sv-board-card-title')?.textContent).toBe('Ship it')
    } finally { unmount(app); target.remove() }
  })
})

describe('SvGridBoard virtualization', () => {
  it('renders only a window of cards per lane when virtualized', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1, title: `Card ${i + 1}`, status: 'todo', owner: 'Sam',
    }))
    const { target, destroy } = mountOn({
      data: many, columns, board: { groupBy: 'status', virtualized: true, cardHeight: 60 },
    })
    try {
      const rendered = target.querySelectorAll('.sv-board-card')
      expect(rendered.length).toBeGreaterThan(0)
      expect(rendered.length).toBeLessThan(30) // a small window, not all 100
      const body = target.querySelector('.sv-board-lane-body.is-virtual')!
      const spacer = body.querySelector('div[aria-hidden="true"][style*="height"]')
      expect(spacer).not.toBeNull()
    } finally { destroy() }
  })

  it('is off by default (all cards rendered)', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: i + 1, title: `Card ${i + 1}`, status: 'todo', owner: 'Sam',
    }))
    const { target, destroy } = mountOn({ data: many, columns, board: { groupBy: 'status' } })
    try {
      expect(target.querySelectorAll('.sv-board-card')).toHaveLength(40)
    } finally { destroy() }
  })
})

describe('SvGridBoard laneSummary', () => {
  it('renders a per-lane summary in the header', () => {
    const { target, destroy } = mountOn({
      data, columns, board: { groupBy: 'status', laneSummary: (rows: any[]) => `${rows.length} items` },
    })
    try {
      const summaries = [...target.querySelectorAll('.sv-board-lane-summary')].map((n) => n.textContent)
      expect(summaries).toEqual(['2 items', '1 items'])
    } finally { destroy() }
  })
})

describe('SvGridBoard layout persistence', () => {
  const KEY = 'test-board-layout'
  const rowId = (r: any) => String(r.id)
  beforeEach(() => { try { localStorage.removeItem(KEY) } catch { /* ignore */ } })

  it('persists a move to localStorage and restores it on a fresh mount', () => {
    const a = mountOn({ data, columns, getRowId: rowId, board: { groupBy: 'status', persistKey: KEY } })
    const lanes = a.target.querySelectorAll('.sv-board-lane')
    fire(lanes[0]!.querySelector('.sv-board-card')!, 'dragstart')
    fire(lanes[1]!.querySelector('.sv-board-lane-body')!, 'dragover')
    fire(lanes[1]!.querySelector('.sv-board-lane-body')!, 'drop')
    const saved = JSON.parse(localStorage.getItem(KEY)!)
    expect(saved.laneOf['1']).toBe('done')
    a.destroy()

    // Remount from the same key: the moved card should reappear in done.
    const b = mountOn({ data, columns, getRowId: rowId, board: { groupBy: 'status', persistKey: KEY } })
    const bDone = b.target.querySelectorAll('.sv-board-lane')[1]!
    const titles = [...bDone.querySelectorAll('.sv-board-card-title')].map((n) => n.textContent)
    expect(titles).toContain('Design spec')
    b.destroy()
  })

  it('fires onLayoutChange with the serialized layout on change', () => {
    const onLayoutChange = vi.fn()
    const { target, destroy } = mountOn({ data, columns, getRowId: rowId, board: { groupBy: 'status', onLayoutChange } })
    const lanes = target.querySelectorAll('.sv-board-lane')
    fire(lanes[0]!.querySelector('.sv-board-card')!, 'dragstart')
    fire(lanes[1]!.querySelector('.sv-board-lane-body')!, 'dragover')
    fire(lanes[1]!.querySelector('.sv-board-lane-body')!, 'drop')
    expect(onLayoutChange).toHaveBeenCalled()
    const last = onLayoutChange.mock.calls.at(-1)![0]
    expect(last.laneOf['1']).toBe('done')
    destroy()
  })
})

describe('SvGridBoard sub-tasks', () => {
  const rowId = (r: any) => String(r.id)
  const subData = [
    { id: 1, title: 'Parent A', status: 'todo', items: [{ id: 'x', title: 'one', done: true }, { id: 'y', title: 'two', done: false }] },
    { id: 2, title: 'Parent B', status: 'done', items: [] },
  ]
  const subCols = [{ field: 'title', header: 'Title' }, { field: 'status', header: 'Status' }]

  it('shows a progress count from the subtasks field', () => {
    const { target, destroy } = mountOn({ data: subData, columns: subCols, getRowId: rowId, board: { groupBy: 'status', subtasks: 'items' } })
    try {
      expect(target.querySelector('.sv-board-subs-count')?.textContent).toBe('1/2')
    } finally { destroy() }
  })

  it('expands to a checklist and toggling fires onSubtaskToggle + updates progress', () => {
    const onSubtaskToggle = vi.fn()
    const { target, destroy } = mountOn({ data: subData, columns: subCols, getRowId: rowId, board: { groupBy: 'status', subtasks: 'items', onSubtaskToggle } })
    try {
      target.querySelector<HTMLButtonElement>('.sv-board-subs-head')!.click()
      flushSync()
      const boxes = target.querySelectorAll<HTMLInputElement>('.sv-board-subs-list input')
      expect(boxes).toHaveLength(2)
      boxes[1]!.click() // check "two"
      flushSync()
      expect(onSubtaskToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'y', true)
      expect(target.querySelector('.sv-board-subs-count')?.textContent).toBe('2/2')
    } finally { destroy() }
  })

  it('adds a subtask via the inline input (onSubtaskAdd + progress grows)', () => {
    const onSubtaskAdd = vi.fn()
    const { target, destroy } = mountOn({ data: subData, columns: subCols, getRowId: rowId, board: { groupBy: 'status', subtasks: 'items', onSubtaskAdd } })
    try {
      target.querySelector<HTMLButtonElement>('.sv-board-subs-head')!.click()
      flushSync()
      const input = target.querySelector<HTMLInputElement>('.sv-board-subs-add')!
      input.value = 'three'
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      flushSync()
      expect(onSubtaskAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'three')
      expect(target.querySelector('.sv-board-subs-count')?.textContent).toBe('1/3')
    } finally { destroy() }
  })
})

describe('SvGridBoard card badges', () => {
  const badgeData = [{ id: 1, title: 'A', status: 'todo', labels: ['bug', 'urgent'], due: '2020-01-01', people: ['Sam Rivera', 'Lee Park'] }]
  const badgeCols = [{ field: 'title', header: 'Title' }, { field: 'status', header: 'Status' }]

  it('renders label, due (overdue), and assignee badges', () => {
    const { target, destroy } = mountOn({ data: badgeData, columns: badgeCols, board: { groupBy: 'status', labelsField: 'labels', dueField: 'due', assigneesField: 'people' } })
    try {
      expect(target.querySelectorAll('.sv-board-badge.is-label')).toHaveLength(2)
      const due = target.querySelector('.sv-board-badge.is-due')!
      expect(due.classList.contains('is-overdue')).toBe(true)
      expect(target.querySelectorAll('.sv-board-avatar')).toHaveLength(2)
    } finally { destroy() }
  })
})

describe('SvGridBoard quick-add composer', () => {
  it('opens an input and Enter calls onCardAdd(lane, title)', () => {
    const onCardAdd = vi.fn()
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status', composer: true, onCardAdd } })
    try {
      const btn = target.querySelector<HTMLButtonElement>('.sv-board-composer-btn')!
      expect(btn).not.toBeNull()
      btn.click()
      flushSync()
      const input = target.querySelector<HTMLInputElement>('.sv-board-composer-input')!
      input.value = 'New card'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      flushSync()
      expect(onCardAdd).toHaveBeenCalledWith('todo', 'New card')
    } finally { destroy() }
  })
})

describe('SvGridBoard lane reorder', () => {
  it('drag a lane header to reorder lanes + fire onLaneReorder', () => {
    const onLaneReorder = vi.fn()
    const board = {
      groupBy: 'status',
      lanes: [{ id: 'todo', title: 'To do' }, { id: 'done', title: 'Done' }],
      reorderableLanes: true,
      onLaneReorder,
    }
    const { target, destroy } = mountOn({ data, columns, board })
    try {
      const heads = target.querySelectorAll('.sv-board-lane-head')
      fire(heads[1]!, 'dragstart') // grab "Done"
      fire(heads[0]!, 'dragover') // over "To do"
      fire(heads[0]!, 'drop')
      const titles = [...target.querySelectorAll('.sv-board-lane-title')].map((n) => n.textContent)
      expect(titles).toEqual(['Done', 'To do'])
      expect(onLaneReorder).toHaveBeenCalledWith(['done', 'todo'])
    } finally { destroy() }
  })
})

describe('SvGridBoard card context menu', () => {
  it('right-click opens a menu; an item runs its action (board-native moveTo)', () => {
    const onCardMove = vi.fn()
    const board = {
      groupBy: 'status',
      lanes: [{ id: 'todo', title: 'To do' }, { id: 'done', title: 'Done' }],
      onCardMove,
      cardMenu: (_row: any, ctx: any) => [
        { label: 'Move to Done', onSelect: () => ctx.moveTo('done') },
        { separator: true },
        { label: 'Edit', onSelect: () => ctx.edit() },
      ],
    }
    const { target, destroy } = mountOn({ data, columns, getRowId: (r: any) => String(r.id), board })
    try {
      const card = target.querySelector('.sv-board-card')! // "Design spec" (todo)
      card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }))
      flushSync()
      const menu = document.body.querySelector('.sv-board-ctx')
      expect(menu).not.toBeNull()
      const items = [...document.body.querySelectorAll('.sv-board-ctx [role="menuitem"]')]
      const move = items.find((i) => i.textContent?.includes('Move to Done'))! as HTMLElement
      move.click()
      flushSync()
      expect(onCardMove).toHaveBeenCalled()
      expect(onCardMove.mock.calls.at(-1)![0].toLane).toBe('done')
      expect(document.body.querySelector('.sv-board-ctx')).toBeNull() // closed
    } finally { destroy() }
  })
})

describe('SvGridBoard collapsible swimlanes + meta badges', () => {
  it('collapsibleSwimlanes: a toggle hides the band lanes', () => {
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status', swimlaneBy: 'owner', collapsibleSwimlanes: true } })
    try {
      const band = target.querySelector('.sv-board-swim')!
      expect(band.querySelector('.sv-board-lanes')).not.toBeNull()
      band.querySelector<HTMLButtonElement>('.sv-board-swim-toggle')!.click()
      flushSync()
      expect(band.querySelector('.sv-board-lanes')).toBeNull()
    } finally { destroy() }
  })

  it('renders comment + attachment count badges and a cover strip', () => {
    const richData = [{ id: 1, title: 'A', status: 'todo', comments: ['a', 'b', 'c'], files: 2, cover: '#ff0000' }]
    const richCols = [{ field: 'title', header: 'Title' }, { field: 'status', header: 'Status' }]
    const { target, destroy } = mountOn({ data: richData, columns: richCols, board: { groupBy: 'status', commentsField: 'comments', attachmentsField: 'files', coverField: 'cover' } })
    try {
      const metas = [...target.querySelectorAll('.sv-board-badge.is-meta')].map((n) => n.textContent?.trim())
      expect(metas).toEqual(['3', '2'])
      const cover = target.querySelector<HTMLElement>('.sv-board-card-cover')!
      expect(cover).not.toBeNull()
      expect(cover.style.background).toContain('rgb(255, 0, 0)')
    } finally { destroy() }
  })
})

describe('SvGridBoard power features', () => {
  const rowId = (r: any) => String(r.id)
  const pData = [
    { id: 1, title: 'A', status: 'todo', tag: 'bug', assignee: 'Sam', blocked: true, created: '2020-01-01' },
    { id: 2, title: 'B', status: 'todo', tag: 'feat', assignee: 'Lee', blocked: false, created: '2026-07-20' },
    { id: 3, title: 'C', status: 'done', tag: 'bug', assignee: 'Sam', blocked: false, created: '2026-07-01' },
  ]
  const pCols = [{ field: 'title', header: 'Title' }, { field: 'status', header: 'Status' }]

  it('flagField renders a blocked ribbon', () => {
    const { target, destroy } = mountOn({ data: pData, columns: pCols, board: { groupBy: 'status', flagField: 'blocked' } })
    try {
      const first = target.querySelector('.sv-board-card')!
      expect(first.classList.contains('is-flagged')).toBe(true)
      expect(first.querySelector('.sv-board-card-flag')).not.toBeNull()
    } finally { destroy() }
  })

  it('ageField renders an age badge', () => {
    const { target, destroy } = mountOn({ data: pData, columns: pCols, board: { groupBy: 'status', ageField: 'created' } })
    try {
      const age = target.querySelector('.sv-board-badge.is-meta[title="Age"]')
      expect(age?.textContent?.trim()).toBeTruthy()
    } finally { destroy() }
  })

  it('facets: a chip filters the visible cards', () => {
    const { target, destroy } = mountOn({ data: pData, columns: pCols, board: { groupBy: 'status', facets: ['tag'] } })
    try {
      const chips = [...target.querySelectorAll<HTMLButtonElement>('.sv-board-facet')]
      expect(chips).toHaveLength(2) // bug, feat
      const bug = chips.find((c) => c.textContent?.startsWith('bug'))!
      bug.click()
      flushSync()
      expect(target.querySelectorAll('.sv-board-card')).toHaveLength(2) // the two "bug" cards
    } finally { destroy() }
  })

  it('multi-select: ctrl-click selects, and dragging the selection moves all', () => {
    const onCardMove = vi.fn()
    const { target, destroy } = mountOn({ data: pData, columns: pCols, getRowId: rowId, board: { groupBy: 'status', selectable: true, onCardMove } })
    try {
      const todo = target.querySelectorAll('.sv-board-lane')[0]!
      const cards = todo.querySelectorAll('.sv-board-card')
      cards[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      cards[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
      flushSync()
      expect(cards[0]!.classList.contains('is-selected')).toBe(true)
      expect(cards[1]!.classList.contains('is-selected')).toBe(true)
      // drag one selected card to the done lane -> both move
      const doneBody = target.querySelectorAll('.sv-board-lane')[1]!.querySelector('.sv-board-lane-body')!
      fire(cards[0]!, 'dragstart')
      fire(doneBody, 'dragover')
      fire(doneBody, 'drop')
      expect(onCardMove).toHaveBeenCalledTimes(2)
      expect(onCardMove.mock.calls.every((c) => c[0].toLane === 'done')).toBe(true)
    } finally { destroy() }
  })

  it('laneMenu: right-click a lane header opens a menu', () => {
    const { target, destroy } = mountOn({ data: pData, columns: pCols, board: { groupBy: 'status', laneMenu: () => [{ label: 'Clear' }] } })
    try {
      const head = target.querySelector('.sv-board-lane-head')!
      head.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }))
      flushSync()
      expect(document.body.querySelector('.sv-board-ctx')).not.toBeNull()
    } finally { destroy() }
  })

  it('childrenField: shows a count and expands to child cards', () => {
    const epicData = [{ id: 1, title: 'Epic', status: 'todo', children: [{ id: 11, title: 'Story A', status: 'todo' }, { id: 12, title: 'Story B', status: 'done' }] }]
    const { target, destroy } = mountOn({ data: epicData, columns: pCols, board: { groupBy: 'status', childrenField: 'children' } })
    try {
      const head = target.querySelector('.sv-board-kids-head')!
      expect(head.textContent).toContain('2')
      head.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      flushSync()
      expect(target.querySelectorAll('.sv-board-kid')).toHaveLength(2)
    } finally { destroy() }
  })
})

describe('SvGridBoard lane rename + swimlane summary', () => {
  it('double-click a lane title to rename -> onLaneRename', () => {
    const onLaneRename = vi.fn()
    const board = { groupBy: 'status', lanes: [{ id: 'todo', title: 'To do' }, { id: 'done', title: 'Done' }], onLaneRename }
    const { target, destroy } = mountOn({ data, columns, board })
    try {
      target.querySelector('.sv-board-lane-title')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      flushSync()
      const input = target.querySelector<HTMLInputElement>('.sv-board-lane-rename')!
      input.value = 'Backlog'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      flushSync()
      expect(onLaneRename).toHaveBeenCalledWith('todo', 'Backlog')
    } finally { destroy() }
  })

  it('swimlaneSummary renders in each band header', () => {
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status', swimlaneBy: 'owner', swimlaneSummary: (rows: any[]) => `${rows.length} items` } })
    try {
      const summaries = [...target.querySelectorAll('.sv-board-swim-summary')].map((n) => n.textContent)
      expect(summaries).toEqual(['2 items', '1 items']) // Sam: 2, Lee: 1
    } finally { destroy() }
  })
})

describe('SvGridBoard badges with a custom card snippet', () => {
  it('renders built-in comment/attachment badges below a custom card', () => {
    const cardSnippet = createRawSnippet((row: any) => ({
      render: () => `<div class="mycard">${row().title}</div>`,
    }))
    const richData = [{ id: 1, title: 'A', status: 'todo', comments: ['x', 'y'], files: 3 }]
    const richCols = [{ field: 'title', header: 'T' }, { field: 'status', header: 'S' }]
    const { target, destroy } = mountOn({ data: richData, columns: richCols, board: { groupBy: 'status', card: cardSnippet as any, commentsField: 'comments', attachmentsField: 'files' } })
    try {
      expect(target.querySelector('.mycard')).not.toBeNull() // custom card rendered
      const metas = [...target.querySelectorAll('.sv-board-badge.is-meta')].map((n) => n.textContent?.trim())
      expect(metas).toEqual(['2', '3']) // comments + attachments badges appended
    } finally { destroy() }
  })
})

describe('SvGridBoard built-in detail drawer', () => {
  const rowId = (r: any) => String(r.id)

  it('board.drawer opens an SvForm drawer with all fields; Save commits + closes', () => {
    const onCardCommit = vi.fn()
    const { target, destroy } = mountOn({ data, columns, getRowId: rowId, board: { groupBy: 'status', drawer: true, onCardCommit } })
    try {
      target.querySelector('.sv-board-card')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      flushSync()
      const drawer = document.body.querySelector('.sv-drawer')
      expect(drawer).not.toBeNull()
      const form = document.body.querySelector('.sv-form')!
      expect(form.querySelectorAll('input').length).toBeGreaterThanOrEqual(3) // title, owner, status
      const save = [...form.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Save')!
      save.click()
      flushSync()
      expect(onCardCommit).toHaveBeenCalled()
      expect(onCardCommit.mock.calls.at(-1)![0].values.title).toBe('Design spec')
      expect(document.body.querySelector('.sv-drawer')).toBeNull() // closed
    } finally { destroy() }
  })

  it('board.drawer.fields limits the drawer to a subset', () => {
    const { target, destroy } = mountOn({ data, columns, board: { groupBy: 'status', drawer: { fields: ['title'] } } })
    try {
      target.querySelector('.sv-board-card')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      flushSync()
      expect(document.body.querySelectorAll('.sv-form input')).toHaveLength(1) // only title
    } finally { destroy() }
  })
})

describe('SvGridBoard blocked badge + comments thread', () => {
  const rowId = (r: any) => String(r.id)

  it('flagField shows a "Blocked" badge, using a string value as the reason', () => {
    const d = [{ id: 1, title: 'A', status: 'todo', blocked: 'Waiting on API' }]
    const c = [{ field: 'title', header: 'T' }, { field: 'status', header: 'S' }]
    const { target, destroy } = mountOn({ data: d, columns: c, board: { groupBy: 'status', flagField: 'blocked' } })
    try {
      const badge = target.querySelector('.sv-board-badge.is-blocked')!
      expect(badge.textContent?.trim()).toBe('Blocked')
      expect(badge.getAttribute('title')).toBe('Waiting on API')
    } finally { destroy() }
  })

  it('comment badge expands a thread; add + delete fire the callbacks', () => {
    const onCommentAdd = vi.fn()
    const onCommentDelete = vi.fn()
    const d = [{ id: 1, title: 'A', status: 'todo', comments: [{ id: 'c1', text: 'Hi', author: 'Sam' }] }]
    const c = [{ field: 'title', header: 'T' }, { field: 'status', header: 'S' }]
    const { target, destroy } = mountOn({ data: d, columns: c, getRowId: rowId, board: { groupBy: 'status', commentsField: 'comments', onCommentAdd, onCommentDelete } })
    try {
      target.querySelector<HTMLButtonElement>('.sv-board-badge.is-btn')!.click()
      flushSync()
      expect(target.querySelector('.sv-board-comments')).not.toBeNull()
      expect(target.querySelectorAll('.sv-board-comment')).toHaveLength(1)
      // delete
      target.querySelector<HTMLButtonElement>('.sv-board-comment-del')!.click()
      flushSync()
      expect(onCommentDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'c1')
      // write
      const input = target.querySelector<HTMLInputElement>('.sv-board-comment-add')!
      input.value = 'New comment'
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      flushSync()
      expect(onCommentAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'New comment')
    } finally { destroy() }
  })
})

describe('SvGridBoard blocked cards are locked from moving', () => {
  const rowId = (r: any) => String(r.id)
  const d = [
    { id: 1, title: 'A', status: 'todo', blocked: true },
    { id: 2, title: 'B', status: 'todo', blocked: false },
  ]
  const c = [{ field: 'title', header: 'T' }, { field: 'status', header: 'S' }]
  const lanes = [{ id: 'todo', title: 'To do' }, { id: 'done', title: 'Done' }]

  it('a blocked card is not draggable and a drag is rejected', () => {
    const onCardMove = vi.fn()
    const { target, destroy } = mountOn({ data: d, columns: c, getRowId: rowId, board: { groupBy: 'status', flagField: 'blocked', lanes, onCardMove } })
    try {
      const blocked = target.querySelector('.sv-board-card')! // "A" (blocked)
      expect(blocked.getAttribute('draggable')).toBe('false')
      expect(blocked.classList.contains('is-locked')).toBe(true)
      const doneBody = target.querySelectorAll('.sv-board-lane')[1]!.querySelector('.sv-board-lane-body')!
      fire(blocked, 'dragstart')
      fire(doneBody, 'dragover')
      fire(doneBody, 'drop')
      expect(onCardMove).not.toHaveBeenCalled()
    } finally { destroy() }
  })

  it('Space does not grab a blocked card', () => {
    const { target, destroy } = mountOn({ data: d, columns: c, getRowId: rowId, board: { groupBy: 'status', flagField: 'blocked', lanes } })
    try {
      const blocked = target.querySelector('.sv-board-card')!
      blocked.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
      flushSync()
      expect(blocked.getAttribute('aria-grabbed')).toBe('false')
    } finally { destroy() }
  })

  it('flagBlocksMoves:false keeps a flagged card draggable', () => {
    const { target, destroy } = mountOn({ data: d, columns: c, getRowId: rowId, board: { groupBy: 'status', flagField: 'blocked', flagBlocksMoves: false, lanes } })
    try {
      const blocked = target.querySelector('.sv-board-card')!
      expect(blocked.getAttribute('draggable')).toBe('true')
      expect(blocked.classList.contains('is-locked')).toBe(false)
    } finally { destroy() }
  })
})

describe('SvGridBoard drawer: comments + no outside-close', () => {
  const rowId = (r: any) => String(r.id)
  const c = [{ field: 'title', header: 'T' }, { field: 'status', header: 'S' }]

  it('the detail drawer includes the comments thread; adding works there', () => {
    const onCommentAdd = vi.fn()
    const d = [{ id: 1, title: 'A', status: 'todo', comments: [{ id: 'c1', text: 'Hi', author: 'Sam' }] }]
    const { target, destroy } = mountOn({ data: d, columns: c, getRowId: rowId, board: { groupBy: 'status', drawer: true, commentsField: 'comments', onCommentAdd } })
    try {
      target.querySelector('.sv-board-card')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      flushSync()
      const box = document.body.querySelector('.sv-board-drawer-comments')!
      expect(box).not.toBeNull()
      expect(box.querySelectorAll('.sv-board-comment')).toHaveLength(1)
      const input = box.querySelector<HTMLInputElement>('.sv-board-comment-add')!
      input.value = 'From drawer'
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      flushSync()
      expect(onCommentAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'From drawer')
    } finally { destroy() }
  })

  it('the drawer stays open on an outside pointerdown (so opening a select does not close it)', () => {
    const d = [{ id: 1, title: 'A', status: 'todo' }]
    const { target, destroy } = mountOn({ data: d, columns: c, getRowId: rowId, board: { groupBy: 'status', drawer: true } })
    try {
      target.querySelector('.sv-board-card')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      flushSync()
      expect(document.body.querySelector('.sv-drawer')).not.toBeNull()
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      flushSync()
      expect(document.body.querySelector('.sv-drawer')).not.toBeNull() // still open
    } finally { destroy() }
  })
})

describe('popover editors nest in the dismissable stack', () => {
  it('a dropdown opened inside a dialog does not dismiss the dialog when you click an option', () => {
    const dialogEl = document.createElement('div')
    document.body.appendChild(dialogEl)
    const onDialogDismiss = vi.fn()
    const dialog = createDismissableLayer({ element: () => dialogEl, onDismiss: onDialogDismiss })
    dialog.activate()
    const app = mount(SvDropDownList as any, {
      target: dialogEl,
      props: { options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], value: 'a' } as any,
    })
    flushSync()
    try {
      dialogEl.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      flushSync()
      const panel = document.body.querySelector('.sv-ddl__panel')
      expect(panel).not.toBeNull() // dropdown open (portalled)
      panel!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      flushSync()
      expect(onDialogDismiss).not.toHaveBeenCalled() // dialog survives the option click
    } finally {
      dialog.release()
      unmount(app)
      dialogEl.remove()
    }
  })
})
