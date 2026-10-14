/**
 * The smaller table behaviors: a link chip opens its record and the picker
 * creates one, files dropped on an attachment cell are added, Space expands
 * the row, rows drag only while nothing sorts them, and the pin splitter
 * keeps the primary field pinned.
 */
import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { SvGrid } from '@svgrid/grid'
import { enableFields, registerLinkedTable } from './index'
import { getLinkedRecords, getRecordRequest, closeRecord } from './editor-request.svelte'
import { gridOf } from './grid-access'
import { applyView } from './view-model'

enableFields()

if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const settle = () => new Promise<void>((r) => setTimeout(r))
async function until(check: () => boolean, label: string) {
  for (let i = 0; i < 200; i++) {
    if (check()) return
    await settle()
  }
  throw new Error(`timed out waiting for ${label}`)
}

let milestones = [{ id: 'm1', name: 'Beta', date: '2026-10-31' }]
registerLinkedTable({
  id: 'ms-extras',
  name: 'Milestones',
  primaryField: 'name',
  rows: () => milestones,
  fields: [{ field: 'name', header: 'Name' }, { field: 'date', header: 'Date', fieldType: 'date', fieldProps: { dateFormat: 'iso' } }],
  create: (name) => {
    const row = { id: `m${milestones.length + 1}`, name, date: '' }
    milestones = [...milestones, row]
    return row
  },
})

function mountGrid(extra: Record<string, unknown> = {}) {
  const changes: any[] = []
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api: any = null
  const app = mount(SvGrid as any, {
    target,
    props: {
      data: [
        { id: 1, task: 'Alpha', ms: ['m1'], files: [] },
        { id: 2, task: 'Beta', ms: [], files: [] },
      ],
      columns: [
        { field: 'task', header: 'Task', fieldType: 'text' },
        { field: 'ms', header: 'Milestone', fieldType: 'link', fieldProps: { table: 'ms-extras' } },
        { field: 'files', header: 'Files', fieldType: 'attachment' },
      ],
      getRowId: (r: { id: number }) => String(r.id),
      showRowNumbers: true,
      expandRows: true,
      editable: true,
      primaryField: 'task',
      containerHeight: 300,
      virtualization: false,
      columnVirtualization: false,
      onCellValueChange: (e: unknown) => changes.push(e),
      onApiReady: (a: unknown) => (api = a),
      ...extra,
    },
  })
  flushSync()
  return {
    target,
    changes,
    get api() {
      return api
    },
    destroy: () => {
      unmount(app)
      target.remove()
      document.querySelectorAll('.sv-modal').forEach((m) => m.closest('[role="dialog"]')?.remove())
    },
  }
}

describe('fields extras', () => {
  it('a link chip opens its record; the picker creates a record and links it', async () => {
    const g = mountGrid()
    try {
      await until(() => !!g.target.querySelector('.sv-flr-chip'), 'the chip')
      ;(g.target.querySelector('.sv-flr-chip') as HTMLElement).click()
      await until(() => !!document.querySelector('.sv-flrv-fields'), 'the linked record')
      expect(getLinkedRecords().at(-1)).toMatchObject({ table: 'ms-extras', rowId: 'm1' })
      expect(document.querySelector('.sv-flrv-fields')?.textContent?.replace(/\s+/g, ' ')).toContain('Date 2026-10-31')
      ;([...document.querySelectorAll('.sv-flrv-btn')].at(-1) as HTMLElement).click()
      await until(() => getLinkedRecords().length === 0, 'closed')

      // The picker on row 2: search a name no milestone has, create it.
      expect(g.api.startEditing(1, 'ms')).toBe(true)
      await until(() => !!document.querySelector('.sv-flp-search'), 'the picker')
      const search = document.querySelector('.sv-flp-search') as HTMLInputElement
      search.value = 'Launch'
      search.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      await until(() => !!document.querySelector('.sv-flp-create'), 'create')
      ;(document.querySelector('.sv-flp-create') as HTMLElement).click()
      await until(() => milestones.length === 2, 'the new milestone')
      ;([...document.querySelectorAll('.sv-flp-btn')].find((b) => b.textContent === 'Done') as HTMLElement).click()
      await until(() => g.changes.length > 0, 'the link written')
      expect(g.changes.at(-1)).toMatchObject({ columnId: 'ms', newValue: ['m2'] })
    } finally {
      g.destroy()
    }
  })

  it('adds files dropped on an attachment cell', async () => {
    const g = mountGrid()
    try {
      await until(() => !!g.target.querySelector('tbody td[data-col-id="files"] .sv-att'), 'the cell')
      const cell = g.target.querySelector('tbody td[data-col-id="files"] .sv-att') as HTMLElement
      const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })
      if (!URL.createObjectURL) (URL as any).createObjectURL = () => 'blob:test'
      const drop = new Event('drop', { bubbles: true, cancelable: true })
      Object.defineProperty(drop, 'dataTransfer', { value: { types: ['Files'], files: [file] } })
      cell.dispatchEvent(drop)
      await until(() => g.changes.length > 0, 'the drop written')
      expect(g.changes[0].columnId).toBe('files')
      expect(g.changes[0].newValue).toEqual([expect.objectContaining({ name: 'notes.txt', type: 'text/plain' })])
    } finally {
      g.destroy()
    }
  })

  it('Space on a cell expands its row', async () => {
    const g = mountGrid()
    try {
      await until(() => !!g.api, 'the api')
      g.api.setActiveCell(0, 0)
      flushSync()
      const table = g.target.querySelector('table.sv-grid-table') as HTMLElement
      table.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
      await until(() => !!getRecordRequest(), 'the record request')
      expect(getRecordRequest()?.rowId).toBe('1')
      closeRecord()
    } finally {
      g.destroy()
    }
  })

  it('rows drag only while nothing sorts or groups them', async () => {
    const g = mountGrid({ rowDragManaged: true, sortable: true })
    try {
      await until(() => !!g.target.querySelector('tbody tr.sv-grid-row-draggable'), 'draggable rows')
      g.api.setSort('task', 'asc')
      await until(() => !g.target.querySelector('tbody tr.sv-grid-row-draggable'), 'not draggable when sorted')
      g.api.clearSort()
      await until(() => !!g.target.querySelector('tbody tr.sv-grid-row-draggable'), 'draggable again')
    } finally {
      g.destroy()
    }
  })

  it('a Kanban card moved to another lane, and a calendar record moved to another day, change the field', async () => {
    const g = mountGrid({
      columns: [
        { field: 'task', header: 'Task', fieldType: 'text' },
        { field: 'status', header: 'Status', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Todo' }, { value: 'Done' }] } },
        { field: 'due', header: 'Due', fieldType: 'date' },
      ],
      data: [{ id: 1, task: 'Alpha', status: 'Todo', due: '2026-10-14' }],
    })
    try {
      await until(() => !!g.api && !!gridOf(g.api), 'the grid')
      const ctrl = gridOf(g.api)
      applyView(ctrl, g.api, { id: 'k', name: 'Board', type: 'kanban', stackBy: 'status' })
      const board = g.api.getOption('board')
      expect(board.groupBy).toBe('status')
      expect(board.lanes.map((l: { id: string }) => l.id)).toEqual(['', 'Todo', 'Done'])
      // Back to the table so the row is in the grid's rows, then move the card.
      applyView(ctrl, g.api, { id: 'g', name: 'Grid', type: 'grid' })
      board.onCardMove({ row: g.api.getData()[0], fromLane: 'Todo', toLane: 'Done', toIndex: 0 })
      await until(() => g.changes.length === 1, 'the lane written')
      expect(g.changes[0]).toMatchObject({ columnId: 'status', newValue: 'Done' })
      // "+ Add a card" in a lane: a record in that lane, named by the primary field.
      expect(board.composer).toBe(true)
      board.onCardAdd('Todo', 'From the board')
      await until(() => g.api.getData().length === 2, 'the added card')
      expect(g.api.getData()[1]).toMatchObject({ status: 'Todo', task: 'From the board' })

      applyView(ctrl, g.api, { id: 'c', name: 'Calendar', type: 'calendar', dateField: 'due' })
      const cal = g.api.getOption('scheduler')
      expect(cal).toMatchObject({ startField: 'due', titleField: 'task', allDay: true })
      applyView(ctrl, g.api, { id: 'g', name: 'Grid', type: 'grid' })
      cal.onEventMove({ row: g.api.getData()[0], start: new Date(2026, 9, 20), end: new Date(2026, 9, 21), allDay: true })
      await until(() => g.changes.length === 2, 'the day written')
      expect(g.changes[1]).toMatchObject({ columnId: 'due', newValue: '2026-10-20' })

      // Double-click (or F2) on a card opens its record.
      board.onCardEdit(g.api.getData()[0])
      expect(getRecordRequest()).toMatchObject({ rowId: '1' })
      closeRecord()
      // A day picked on the calendar: a record on it, opened with its name to type.
      const count = g.api.getData().length
      cal.onEventAdd(new Date(2026, 9, 22), new Date(2026, 9, 23), undefined, true)
      await until(() => !!getRecordRequest(), 'the new record opened')
      expect(g.api.getData().length).toBe(count + 1)
      expect(g.api.getData().at(-1)).toMatchObject({ due: '2026-10-22' })
      expect(getRecordRequest()).toMatchObject({ editPrimary: true })
      closeRecord()
    } finally {
      g.destroy()
    }
  })

  it('a Kanban card draws its fields as their cells do', async () => {
    const { enableBoardView } = await import('../board')
    enableBoardView()
    const g = mountGrid({
      columns: [
        { field: 'task', header: 'Task', fieldType: 'text' },
        { field: 'status', header: 'Status', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Todo' }, { value: 'Done' }] } },
        { field: 'tags', header: 'Tags', fieldType: 'multiSelect', fieldProps: { options: [{ value: 'Docs', color: '#65a30d' }] } },
        { field: 'budget', header: 'Budget', fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', precision: 0 } },
      ],
      data: [{ id: 1, task: 'Alpha', status: 'Todo', tags: ['Docs'], budget: 1200 }],
      board: { groupBy: 'status', cardFields: ['tags', 'budget'] },
    })
    try {
      await until(() => !!g.target.querySelector('.sv-board-card-metarow'), 'the card')
      const rows = [...g.target.querySelectorAll('.sv-board-card-metarow')]
      expect(rows[0]!.querySelector('.sv-fsl-pill')?.textContent).toBe('Docs')
      expect(rows[1]!.textContent?.replace(/\s+/g, ' ')).toContain('$1,200')
    } finally {
      g.destroy()
    }
  })

  it('the pin splitter keeps the primary field pinned', async () => {
    const g = mountGrid({ pinSplitter: true })
    try {
      await until(() => !!g.target.querySelector('.sv-pin-split-hit'), 'the splitter')
      const hit = g.target.querySelector('.sv-pin-split-hit') as HTMLElement
      expect(hit.getAttribute('aria-valuemin')).toBe('1')
      expect(hit.getAttribute('aria-valuenow')).toBe('1')
      hit.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
      hit.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
      flushSync()
      const pinned = [...g.target.querySelectorAll('thead th[data-pinned="left"]')].map((th) => th.getAttribute('data-svgrid-header-col'))
      expect(pinned).toEqual(['task'])
    } finally {
      g.destroy()
    }
  })
})
