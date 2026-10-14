/**
 * A base's grid: the right-click menu on a record (expand, insert, duplicate,
 * delete, kept with the table), "+ Add row" under the summary row, and group
 * rows drawn taller than records.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { enableFields, SvBase, type BaseTable } from './index'
import { closeRecord, getRecordRequest } from './editor-request.svelte'
import { addComment } from './activity.svelte'
import { gridOf } from './grid-access'
import { GROUP_ROW_HEIGHT } from './row-height'

enableFields()

if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const settle = () => new Promise<void>((r) => setTimeout(r, 5))
async function until(check: () => boolean, label: string) {
  const end = Date.now() + 5000
  while (Date.now() < end) {
    if (check()) return
    await settle()
  }
  throw new Error(`timed out waiting for ${label}`)
}

const make = (): BaseTable[] => [
  {
    id: 'tasks',
    name: 'Tasks',
    primaryField: 'name',
    columns: [
      { id: 'n', field: 'n', header: 'No.', fieldType: 'autoNumber' },
      { id: 'name', field: 'name', header: 'Task', fieldType: 'text' },
      { id: 'status', field: 'status', header: 'Status', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Todo' }, { value: 'Done' }] } },
      { id: 'tags', field: 'tags', header: 'Tags', fieldType: 'multiSelect', fieldProps: { options: [{ value: 'a' }, { value: 'b' }] } },
      { id: 'hours', field: 'hours', header: 'Hours', fieldType: 'number', fieldProps: { summary: 'sum' } },
    ],
    data: [
      { id: 't1', n: 1, name: 'Brief', status: 'Todo', tags: ['a'], hours: 2 },
      { id: 't2', n: 2, name: 'Site', status: 'Done', tags: [], hours: 3 },
    ],
    props: { rowAdder: { label: 'Add task' } },
  },
]

const mounted: Array<() => void> = []
let mounts = 0
afterEach(() => {
  while (mounted.length) mounted.pop()!()
})

function mountBase(views?: BaseTable['views']) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  // A table id of its own: comments are kept by table id, across mounts.
  const state: { api: any; tables: BaseTable[] } = { api: null, tables: make().map((t) => ({ ...t, id: `tasks-${++mounts}` })) }
  if (views) state.tables[0] = { ...state.tables[0]!, views }
  const app = mount(SvBase as any, {
    target,
    props: {
      tables: state.tables,
      onTablesChange: (t: BaseTable[]) => (state.tables = t),
      editable: true,
      showRowNumbers: true,
      expandRows: true,
      // The footer row of the fields' summaries.
      summary: true,
      containerHeight: 400,
      virtualization: false,
      columnVirtualization: false,
      onApiReady: (a: unknown) => (state.api = a),
    },
  })
  flushSync()
  mounted.push(() => {
    unmount(app)
    target.remove()
  })
  const data = () => state.tables[0]!.data
  const cellOf = (text: string) => [...target.querySelectorAll<HTMLElement>('.sv-grid-cell[data-svgrid-row]')].find((c) => c.textContent?.trim() === text)
  const labels = () => [...target.querySelectorAll('.sv-grid-context-menu .sv-grid-menu-item')].map((b) => b.textContent?.trim())
  /** Right-click the cell showing `text`; the menu is a lazy chunk, so wait for its items. */
  async function open(text: string) {
    await until(() => !!cellOf(text), `the cell ${text}`)
    cellOf(text)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
    await until(() => labels().length > 0, 'the menu')
  }
  /** Right-click the cell showing `text`, then pick `label`. */
  async function pick(text: string, label: string) {
    await open(text)
    const item = [...target.querySelectorAll<HTMLElement>('.sv-grid-context-menu .sv-grid-menu-item')].find((b) => b.textContent?.trim() === label)
    expect(item, label).toBeTruthy()
    item!.click()
    flushSync()
  }
  return { target, state, data, cellOf, open, pick, labels }
}

describe('the record menu', () => {
  it('lists what a record offers', async () => {
    const b = mountBase()
    await b.open('Brief')
    expect(b.labels()).toEqual(['Expand record', 'Comment', 'Insert record above', 'Insert record below', 'Duplicate record', 'Copy', 'Paste', 'Delete record'])
  })

  it('duplicates a record with a new id and number, its lists copied', async () => {
    const b = mountBase()
    await b.pick('Brief', 'Duplicate record')
    await until(() => b.data().length === 3, 'the copy kept')
    const copy = b.data()[1]!
    expect(copy).toMatchObject({ name: 'Brief', status: 'Todo', tags: ['a'], hours: 2, n: 3 })
    expect(copy.id).not.toBe('t1')
    expect(copy.tags).not.toBe(b.data()[0]!.tags)
  })

  it('inserts a record above, and deletes one', async () => {
    const b = mountBase()
    await b.pick('Site', 'Insert record above')
    await until(() => b.data().length === 3, 'the new record kept')
    expect(b.data()[1]!.id).toBeTruthy()
    expect(b.data()[1]!.name).toBeUndefined()
    // It asks first: Cancel keeps the record, Delete record removes it.
    await b.pick('Brief', 'Delete record')
    await until(() => !!document.querySelector('.sv-frdel-btn'), 'the confirm')
    expect(document.body.textContent).toContain('Brief is deleted')
    ;(document.querySelector('.sv-frdel-btn:not(.is-danger)') as HTMLElement).click()
    flushSync()
    await settle()
    expect(b.data().some((r) => r.id === 't1')).toBe(true)
    await b.pick('Brief', 'Delete record')
    await until(() => !!document.querySelector('.sv-frdel-btn.is-danger'), 'the confirm again')
    ;(document.querySelector('.sv-frdel-btn.is-danger') as HTMLElement).click()
    flushSync()
    await until(() => b.data().length === 2, 'the record gone')
    expect(b.data().some((r) => r.id === 't1')).toBe(false)
  })

  it('expands a record', async () => {
    const b = mountBase()
    await b.pick('Site', 'Expand record')
    expect(getRecordRequest()?.rowId).toBeTruthy()
  })
})

describe('comments', () => {
  const rowIdOf = (api: any, name: string) => (gridOf(api).allRows as Array<{ id: string; original: { name?: string } }>).find((r) => r.original.name === name)!.id

  it('opens a record at its comments, and counts them on its row', async () => {
    const b = mountBase()
    await b.pick('Brief', 'Comment')
    expect(getRecordRequest()).toMatchObject({ focus: 'comment' })
    closeRecord()
    flushSync()
    expect(b.target.querySelector('.sv-frh-comments')).toBeNull()
    const id = rowIdOf(b.state.api, 'Brief')
    addComment(gridOf(b.state.api), id, 'Can we ship Friday?')
    addComment(gridOf(b.state.api), id, 'After the review.')
    await until(() => b.target.querySelector('.sv-frh-comments')?.textContent?.trim() === '2', 'the count on the row')
    ;(b.target.querySelector('.sv-frh-comments') as HTMLElement).click()
    expect(getRecordRequest()).toMatchObject({ rowId: id, focus: 'comment' })
    closeRecord()
  })

  it('counts them on a card, whose badge opens the discussion', async () => {
    const b = mountBase([{ id: 'board', name: 'Board', type: 'kanban', stackBy: 'status' }])
    await until(() => typeof b.state.api?.getOption('board')?.commentCount === 'function', 'the board')
    const board = b.state.api.getOption('board')
    const row = b.data()[0]
    expect(board.commentCount(row)).toBe(0)
    addComment(gridOf(b.state.api), rowIdOf(b.state.api, 'Brief'), 'Looks good')
    expect(board.commentCount(row)).toBe(1)
    board.onCommentsOpen(row)
    expect(getRecordRequest()).toMatchObject({ focus: 'comment' })
    closeRecord()
  })
})

describe('the card menu on a board', () => {
  it('expands, duplicates and deletes a card', async () => {
    const b = mountBase([{ id: 'board', name: 'Board', type: 'kanban', stackBy: 'status' }])
    await until(() => typeof b.state.api?.getOption('board')?.cardMenu === 'function', 'the board')
    const menu = (row: unknown) => b.state.api.getOption('board').cardMenu(row, { lanes: [{ id: 'Todo' }, { id: 'Done' }], moveTo: () => {} }) as Array<{ label?: string; onSelect?: () => void; children?: unknown[] }>
    const items = menu(b.data()[0])
    expect(items.map((i) => i.label)).toEqual(['Expand record', 'Comment', 'Move to', 'Duplicate record', undefined, 'Delete record'])
    expect(items[2]!.children).toHaveLength(2)
    items.find((i) => i.label === 'Duplicate record')!.onSelect!()
    await until(() => b.data().length === 3, 'the copy kept')
    expect(b.data()[1]).toMatchObject({ name: 'Brief', n: 3 })
    menu(b.data()[0]).find((i) => i.label === 'Delete record')!.onSelect!()
    flushSync()
    await until(() => !!document.querySelector('.sv-frdel-btn.is-danger'), 'the confirm')
    ;(document.querySelector('.sv-frdel-btn.is-danger') as HTMLElement).click()
    flushSync()
    await until(() => b.data().length === 2, 'the card gone')
    expect(b.data().some((r) => r.id === 't1')).toBe(false)
  })
})

describe('the grid around the records', () => {
  it('puts "+ Add row" under the summary row', async () => {
    const b = mountBase()
    await until(() => !!b.cellOf('Brief'), 'the grid')
    await until(() => !!b.target.querySelector('.sv-grid-foot .sv-field-row-adder'), 'the adder in the footer')
    const foot = b.target.querySelector('.sv-grid-foot')!
    const rows = [...foot.querySelectorAll('tr')]
    expect(rows[0]!.classList.contains('sv-grid-summary-row')).toBe(true)
    expect(rows[1]!.classList.contains('sv-field-row-adder')).toBe(true)
    expect(b.target.querySelector('tbody .sv-field-row-adder')).toBeNull()
  })

  it('counts the records in the summary row, under the primary field', async () => {
    const b = mountBase()
    const summary = () => b.target.querySelector('.sv-grid-summary-row')?.textContent?.replace(/\s+/g, ' ') ?? ''
    await until(() => summary().includes('2 records'), 'the count')
    await b.pick('Brief', 'Duplicate record')
    await until(() => summary().includes('3 records'), 'the count after a duplicate')
  })

  it('draws group rows taller than records', async () => {
    const b = mountBase()
    await until(() => !!b.state.api, 'the api')
    b.state.api.setGroupBy(['status'])
    await until(() => !!b.target.querySelector('.sv-grid-group-row'), 'a group row')
    await until(() => typeof b.state.api.getOption('rowHeight') === 'function', 'the grouped height')
    b.state.api.expandAllGroups()
    flushSync()
    const fn = b.state.api.getOption('rowHeight') as (i: number) => number
    expect(fn(0)).toBe(GROUP_ROW_HEIGHT)
    expect(fn(1)).toBeLessThan(GROUP_ROW_HEIGHT)
    b.state.api.setGroupBy([])
    // Unset before, unset again.
    await until(() => b.state.api.getOption('rowHeight') === undefined, 'the plain height again')
  })
})
