/**
 * `expandRows`: the row header's checkbox selects the row, its expand button
 * opens the row as a record, and a value edited there is written through the
 * grid's own edit path.
 */
import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { SvGrid } from '@svgrid/grid'
import { enableFields, SvBase, setRecordComments, openRecord, closeRecord, type BaseAutomation, type BaseTable } from './index'
import { getRecordRequest } from './editor-request.svelte'
import { changesOf } from './activity.svelte'
import { gridOf, writeCell } from './grid-access'

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
  for (let i = 0; i < 100; i++) {
    if (check()) return
    await settle()
  }
  throw new Error(`timed out waiting for ${label}`)
}

function mountGrid(extra: Record<string, unknown> = {}) {
  const changes: any[] = []
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid as any, {
    target,
    props: {
      data: [
        { id: 1, name: 'Alpha', qty: 3 },
        { id: 2, name: 'Beta', qty: 5 },
      ],
      columns: [
        { field: 'name', header: 'Name', fieldType: 'text' },
        { field: 'qty', header: 'Qty', fieldType: 'number', fieldProps: { format: 'integer' } },
      ],
      getRowId: (r: { id: number }) => String(r.id),
      showRowNumbers: true,
      showRowSelection: false,
      editable: true,
      containerHeight: 300,
      virtualization: false,
      columnVirtualization: false,
      onCellValueChange: (e: unknown) => changes.push(e),
      ...extra,
    },
  })
  return { target, changes, destroy: () => (unmount(app), target.remove()) }
}

describe('expandRows', () => {
  it('without it, the row-number cell is the number', async () => {
    const g = mountGrid()
    try {
      await settle()
      expect(g.target.querySelector('.sv-frh')).toBeNull()
      expect(g.target.querySelector('tbody .sv-grid-row-number-cell')?.textContent?.trim()).toBe('1')
    } finally {
      g.destroy()
    }
  })

  it('the row header selects the row and opens it as a record that edits through the grid', async () => {
    const g = mountGrid({ expandRows: true })
    try {
      await until(() => !!g.target.querySelector('.sv-frh'), 'the row header')
      const first = g.target.querySelectorAll<HTMLElement>('tbody .sv-frh')[0]!
      const check = first.querySelector<HTMLButtonElement>('.sv-frh-check')!
      expect(check.getAttribute('aria-checked')).toBe('false')
      check.click()
      flushSync()
      expect(check.getAttribute('aria-checked')).toBe('true')

      first.querySelector<HTMLButtonElement>('.sv-frh-expand')!.click()
      await until(() => !!document.querySelector('.sv-frv-fields'), 'the record view')
      const labels = [...document.querySelectorAll('.sv-frv-label')].map((l) => l.textContent?.trim())
      expect(labels).toEqual(['Name', 'Qty'])
      // The record is titled by its primary (first text) field.
      expect(document.querySelector('.sv-modal h2')?.textContent?.trim()).toBe('Alpha')

      // Edit Name in the record: the grid's edit path writes it.
      const nameBox = document.querySelectorAll<HTMLButtonElement>('.sv-frv-box')[0]!
      nameBox.click()
      await until(() => !!document.querySelector('.sv-frv-input'), 'the text box')
      const input = document.querySelector<HTMLInputElement>('.sv-frv-input')!
      input.value = 'Alpha 2'
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      await until(() => g.changes.length > 0, 'the value change')
      expect(g.changes[0]).toMatchObject({ columnId: 'name', oldValue: 'Alpha', newValue: 'Alpha 2' })
      await until(() => document.querySelector('.sv-modal h2')?.textContent?.trim() === 'Alpha 2', 'the new title')

      // Next steps to the second row.
      ;[...document.querySelectorAll<HTMLButtonElement>('.sv-frv-btn')].find((b) => b.getAttribute('aria-label') === 'Next record')!.click()
      await until(() => document.querySelector('.sv-modal h2')?.textContent?.trim() === 'Beta', 'the next record')
    } finally {
      g.destroy()
      document.querySelectorAll('.sv-modal').forEach((m) => m.closest('[role="dialog"]')?.remove())
    }
  })
})

// ---- Collaboration: opening a record from app code, comments, activity ----

const modalTitle = () => document.querySelector('.sv-modal h2')?.textContent?.trim()
const footerButton = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('.sv-frv-btn')].find((b) => b.getAttribute('aria-label') === label)!
const clearModals = () => document.querySelectorAll('.sv-modal').forEach((m) => m.closest('[role="dialog"]')?.remove())

function mountWithApi(extra: Record<string, unknown> = {}) {
  let api: any = null
  const g = mountGrid({ onApiReady: (a: unknown) => (api = a), ...extra })
  return { ...g, api: () => api }
}

describe('opening a record from app code', () => {
  it('openRecord takes the grid api; closeRecord(api) closes it; focus: comment focuses the comment box', async () => {
    const g = mountWithApi()
    try {
      await until(() => !!g.api() && !!gridOf(g.api()), 'the grid')
      openRecord({ api: g.api(), rowId: '2', focus: 'comment' })
      await until(() => modalTitle() === 'Beta', 'the record')
      await until(() => document.activeElement === document.querySelector('.sv-frv-comment textarea'), 'the comment box focused')
      expect(getRecordRequest()?.ctrl).toBe(gridOf(g.api()))
      closeRecord(g.api())
      expect(getRecordRequest()).toBeNull()
      // The old form, with the controller, still works.
      openRecord({ ctrl: gridOf(g.api()), rowId: '1' })
      expect(getRecordRequest()).toMatchObject({ rowId: '1' })
      // Another grid's api leaves it open.
      closeRecord({})
      expect(getRecordRequest()).not.toBeNull()
    } finally {
      closeRecord()
      g.destroy()
      clearModals()
    }
  })

  it('a button field onClick gets the api and the row id, enough to open the record', async () => {
    const seen: any[] = []
    const onClick = (ctx: any) => {
      seen.push(ctx)
      openRecord({ api: ctx.api, rowId: ctx.rowId })
    }
    const g = mountWithApi({
      columns: [
        { field: 'name', header: 'Name', fieldType: 'text' },
        { field: 'open', header: 'Open', fieldType: 'button', fieldProps: { label: 'Open', onClick } },
      ],
    })
    try {
      await until(() => !!g.target.querySelector('.sv-fbt'), 'the buttons')
      g.target.querySelectorAll<HTMLButtonElement>('.sv-fbt')[1]!.click()
      expect(seen[0]).toMatchObject({ rowId: '2', columnId: 'open' })
      expect(seen[0].api).toBe(g.api())
      await until(() => modalTitle() === 'Beta', 'the record')
    } finally {
      closeRecord()
      g.destroy()
      clearModals()
    }
  })
})

describe('a record that leaves the view', () => {
  it('Previous and Next go on from where it was', async () => {
    const g = mountWithApi({
      data: [
        { id: 1, name: 'Alpha', qty: 3 },
        { id: 2, name: 'Beta', qty: 5 },
        { id: 3, name: 'Gamma', qty: 7 },
      ],
    })
    try {
      await until(() => !!g.api() && !!gridOf(g.api()), 'the grid')
      openRecord({ api: g.api(), rowId: '2' })
      await until(() => modalTitle() === 'Beta', 'the record')
      g.api().setAdvancedFilter({ kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'name', kind: 'text', op: 'isNot', value: 'Beta' }] })
      await until(() => !!document.querySelector('.sv-frv-gone'), 'the record out of view')
      expect(footerButton('Previous record').disabled).toBe(false)
      expect(footerButton('Next record').disabled).toBe(false)
      footerButton('Next record').click()
      await until(() => modalTitle() === 'Gamma', 'the record after it')
      footerButton('Previous record').click()
      await until(() => modalTitle() === 'Alpha', 'the record before it')
    } finally {
      closeRecord()
      g.destroy()
      clearModals()
    }
  })
})

const twoTables = (automations: BaseAutomation[] = []): BaseTable[] => [
  {
    id: 'tasks',
    name: 'Tasks',
    primaryField: 'name',
    columns: [
      { id: 'name', field: 'name', header: 'Task', fieldType: 'text' },
      { id: 'status', field: 'status', header: 'Status', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Todo' }, { value: 'Done' }] } },
      { id: 'done', field: 'done', header: 'Done', fieldType: 'checkbox' },
      { id: 'touched', field: 'touched', header: 'Touched', fieldType: 'lastModifiedTime' },
      { id: 'editor', field: 'editor', header: 'Editor', fieldType: 'lastModifiedBy' },
    ],
    data: [
      { id: 'r1', name: 'Brief', status: 'Todo', done: false },
      { id: 'r2', name: 'Site', status: 'Todo', done: false },
    ],
    automations,
  },
  {
    id: 'notes',
    name: 'Notes',
    primaryField: 'title',
    columns: [{ id: 'title', field: 'title', header: 'Title', fieldType: 'text' }],
    data: [{ id: 'r1', title: 'Kickoff' }],
  },
]

function mountBase(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const state: { api: any; tables?: BaseTable[] } = { api: null, tables: props.tables as BaseTable[] | undefined }
  const app = mount(SvBase as any, {
    target,
    props: {
      onTablesChange: (t: BaseTable[]) => (state.tables = t),
      editable: true,
      containerHeight: 400,
      virtualization: false,
      columnVirtualization: false,
      onApiReady: (a: unknown) => (state.api = a),
      ...props,
    },
  })
  flushSync()
  const tab = (name: string) => ([...target.querySelectorAll('.sv-btabs [role="tab"]')].find((t) => t.textContent?.includes(name)) as HTMLElement).click()
  const shown = () => (state.api ? gridOf(state.api) : undefined)
  return { target, state, tab, shown, destroy: () => (unmount(app), target.remove(), clearModals()) }
}

describe('SvBase: comments and activity by table', () => {
  it('activity outlives switching tables, and two tables with the same row ids keep apart', async () => {
    const b = mountBase({ tables: twoTables() })
    try {
      await until(() => !!b.shown(), 'the tasks grid')
      expect(writeCell(b.shown(), 'r1', 'name', 'Brief v2')).toBe(true)
      expect(changesOf(b.shown(), 'r1').map((c) => c.columnId)).toEqual(['name'])
      b.tab('Notes')
      await until(() => b.shown()?.props.baseTableId === 'notes', 'the notes grid')
      expect(changesOf(b.shown(), 'r1')).toEqual([])
      b.tab('Tasks')
      await until(() => b.shown()?.props.baseTableId === 'tasks', 'the tasks grid again')
      expect(changesOf(b.shown(), 'r1').map((c) => c.columnId)).toEqual(['name'])
    } finally {
      b.destroy()
    }
  })

  it('two bases on one page with the same table ids keep their own activity', async () => {
    const a = mountBase({ tables: twoTables() })
    const b = mountBase({ tables: twoTables() })
    try {
      await until(() => !!a.shown() && !!b.shown(), 'both tasks grids')
      expect(writeCell(a.shown(), 'r1', 'name', 'Brief v2')).toBe(true)
      expect(changesOf(a.shown(), 'r1').map((c) => c.columnId)).toEqual(['name'])
      expect(changesOf(b.shown(), 'r1')).toEqual([])
    } finally {
      a.destroy()
      b.destroy()
    }
  })

  it('a comment store hears the table id', async () => {
    const added: any[] = []
    const asked: any[] = []
    setRecordComments({
      list: (rowId, _api, ctx) => {
        asked.push({ rowId, ...ctx })
        return []
      },
      add: (rowId, comment, _api, ctx) => added.push({ rowId, comment, ctx }),
    })
    const b = mountBase({ tables: twoTables() })
    try {
      await until(() => !!b.shown(), 'the tasks grid')
      openRecord({ api: b.state.api, rowId: 'r1' })
      await until(() => !!document.querySelector('.sv-frv-comment textarea'), 'the record')
      expect(asked.some((a) => a.rowId === 'r1' && a.tableId === 'tasks')).toBe(true)
      const box = document.querySelector<HTMLTextAreaElement>('.sv-frv-comment textarea')!
      box.value = 'Looks good'
      box.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      document.querySelector<HTMLButtonElement>('.sv-frv-comment button[type="submit"]')!.click()
      expect(added).toHaveLength(1)
      expect(added[0]).toMatchObject({ rowId: 'r1', comment: { tableId: 'tasks', text: 'Looks good' }, ctx: { tableId: 'tasks' } })
    } finally {
      closeRecord()
      setRecordComments(null)
      b.destroy()
    }
  })

  it('an automation change is in the activity under its name and stamps last modified time, not by', async () => {
    const doneTicks: BaseAutomation = {
      id: 'done',
      name: 'Done ticks the box',
      enabled: true,
      trigger: { type: 'recordUpdated', fields: ['status'] },
      condition: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'status', kind: 'select', op: 'is', value: 'Done' }] },
      actions: [{ type: 'updateRecord', values: { done: 'true' } }],
    }
    const b = mountBase({ tables: twoTables([doneTicks]) })
    try {
      await until(() => !!b.shown(), 'the tasks grid')
      expect(writeCell(b.shown(), 'r2', 'status', 'Done')).toBe(true)
      const rec = () => b.state.tables!.find((t) => t.id === 'tasks')!.data.find((r) => r.id === 'r2')!
      await until(() => rec().done === true, 'the automation ran')
      // Read as the record view reads it: through the base's grid.
      expect(changesOf(b.shown(), 'r2').filter((c) => c.automation)).toMatchObject([{ columnId: 'done', value: true, automation: 'Done ticks the box' }])
      expect(typeof rec().touched).toBe('string')
      // Nobody is signed in, and the automation is not a person: "by" stays empty.
      expect(rec().editor).toBeUndefined()
    } finally {
      b.destroy()
    }
  })

  it('single-table mode keys rows by their id field; a getRowId prop wins', async () => {
    const columns = [{ field: 'name', header: 'Name', fieldType: 'text' }]
    const ids = async (props: Record<string, unknown>) => {
      const b = mountBase({ columns, ...props })
      try {
        await until(() => !!b.shown(), 'the grid')
        return b.shown().allRows.map((r: { id: string }) => r.id)
      } finally {
        b.destroy()
      }
    }
    const data = [{ id: 'a', name: 'One' }, { id: 'b', name: 'Two' }]
    expect(await ids({ data })).toEqual(['a', 'b'])
    expect(await ids({ data: [{ name: 'No id' }] })).toEqual(['0'])
    expect(await ids({ data, getRowId: (r: { name: string }) => `k-${r.name}` })).toEqual(['k-One', 'k-Two'])
  })
})
