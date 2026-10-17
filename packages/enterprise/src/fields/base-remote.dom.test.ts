/**
 * `<SvBase tables>` with a change made in the database by someone else (an
 * AI agent here): the cells that moved are tinted and the row marked until
 * the record is opened, the view bar counts them, and the record's activity
 * says who changed what, from what to what.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import type { ServerDataSource } from '@svgrid/grid'
import { enableFields, SvBase, baseSource, openRecord, setFieldUsers, type BaseRemoteChange, type BaseTable } from './index'
import { gridOf } from './grid-access'

enableFields()
setFieldUsers([
  { id: 'u1', name: 'Ana Ruiz' },
  { id: 'agent', name: 'Triage agent' },
])

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

type Row = Record<string, unknown>

/** A table in a "database" the test can change behind the page's back, and tell it so. */
function database(rows: Row[]) {
  const store = new Map(rows.map((r) => [String(r.id), { ...r }]))
  let ping: () => void = () => {}
  const ds: ServerDataSource<Row> = {
    async getRows() {
      return { rows: [...store.values()].map((r) => ({ ...r })), rowCount: store.size }
    },
    async createRow(input) {
      store.set(String(input.id), { ...input })
      return { ...input }
    },
    async updateRow(id, patch) {
      store.set(id, { ...store.get(id), ...patch })
      return { ...store.get(id)! }
    },
    async deleteRow(id) {
      store.delete(id)
    },
  }
  const source = baseSource(ds, {
    realtime: (on) => {
      ping = on
      return () => {}
    },
  })
  /** Someone else writes to the database, and the realtime feed says so. */
  const elsewhere = (id: string, patch: Row) => {
    store.set(id, { ...store.get(id), id, ...patch })
    ping()
  }
  return { source, elsewhere }
}

const PRIORITY = [
  { value: 'Low', color: '#64748b' },
  { value: 'Urgent', color: '#dc2626' },
]

const mounted: Array<() => void> = []
afterEach(() => {
  while (mounted.length) mounted.pop()!()
})

function mountBase() {
  const db = database([
    { id: 't1', subject: 'Cannot log in', priority: 'Low', modified_by: 'u1' },
    { id: 't2', subject: 'Invoice is wrong', priority: 'Low', modified_by: 'u1' },
  ])
  const tables: BaseTable[] = [
    {
      id: 'tickets',
      name: 'Tickets',
      primaryField: 'subject',
      columns: [
        { id: 'subject', field: 'subject', header: 'Subject', fieldType: 'text' },
        { id: 'priority', field: 'priority', header: 'Priority', fieldType: 'singleSelect', fieldProps: { options: PRIORITY } },
        { id: 'modified_by', field: 'modified_by', header: 'Last changed by', fieldType: 'lastModifiedBy' },
      ],
      data: [],
      source: db.source,
    },
  ]
  const target = document.createElement('div')
  document.body.appendChild(target)
  const state: { api: any; heard: BaseRemoteChange[] } = { api: null, heard: [] }
  const app = mount(SvBase as any, {
    target,
    props: {
      tables,
      editable: true,
      expandRows: true,
      showRowNumbers: true,
      containerHeight: 400,
      virtualization: false,
      columnVirtualization: false,
      onApiReady: (a: unknown) => (state.api = a),
      onRemoteChange: (list: BaseRemoteChange[]) => state.heard.push(...list),
    },
  })
  flushSync()
  mounted.push(() => {
    unmount(app)
    target.remove()
    document.querySelectorAll('.sv-pop__panel, .sv-modal').forEach((n) => n.remove())
  })
  const rowOf = (id: string) => {
    const index = state.api.getRowIndex?.(id)
    return [...target.querySelectorAll<HTMLElement>('.sv-grid-row')].find((r) => r.querySelector(`[data-svgrid-row="${index}"]`) || r.textContent?.includes(id === 't1' ? 'Cannot log in' : id === 't2' ? 'Invoice is wrong' : 'Refund'))
  }
  const chip = () => target.querySelector('.sv-fvb-changed')?.textContent?.trim() ?? ''
  return { db, target, state, rowOf, chip }
}

describe('a change made elsewhere', () => {
  it('tints what moved, marks the row, counts it, and the record says who changed it from what', async () => {
    const b = mountBase()
    await until(() => !!b.state.api && !!b.rowOf('t1'), 'the tickets')
    expect(b.chip()).toBe('')

    b.db.elsewhere('t1', { priority: 'Urgent', modified_by: 'agent' })
    await until(() => b.chip() !== '', 'the changed chip')
    expect(b.chip()).toBe('1 changed by Triage agent')
    expect(b.state.heard).toMatchObject([{ type: 'update', id: 't1', fields: expect.arrayContaining([{ field: 'priority', from: 'Low', to: 'Urgent' }]) }])

    // The row is marked, and its Priority cell (only that one) is tinted.
    const dot = b.rowOf('t1')!.querySelector('.sv-frh-unseen')
    expect(dot?.getAttribute('aria-label')).toMatch(/^Triage agent changed this record/)
    const cell = (row: HTMLElement, col: string) => row.querySelector(`[data-col-id="${col}"]`)
    await until(() => !!cell(b.rowOf('t1')!, 'priority')?.querySelector('.sv-grid-cf-bg'), 'the tint')
    expect(cell(b.rowOf('t1')!, 'subject')?.querySelector('.sv-grid-cf-bg')).toBeNull()
    expect(b.rowOf('t2')!.querySelector('.sv-frh-unseen')).toBeNull()

    // Opened: the activity names the agent and the old value; the marks go.
    openRecord({ ctrl: gridOf(b.state.api), rowId: 't1' })
    await until(() => !!document.querySelector('.sv-frv-feed .sv-frv-item'), 'the activity')
    const item = document.querySelector('.sv-frv-feed .sv-frv-item')!
    expect(item.querySelector('.sv-frv-item-head')?.textContent).toMatch(/^Triage agent changed Priority/)
    expect(item.querySelector('.sv-frv-from')?.textContent).toBe('Low')
    expect(item.querySelector('.sv-frv-item-body')?.textContent).toMatch(/Urgent/)
    await until(() => b.chip() === '', 'the chip to clear')
    expect(b.rowOf('t1')!.querySelector('.sv-frh-unseen')).toBeNull()
  }, 20_000)

  it('marks a record added elsewhere, and the chip marks them all seen', async () => {
    const b = mountBase()
    await until(() => !!b.state.api && !!b.rowOf('t1'), 'the tickets')

    b.db.elsewhere('t3', { subject: 'Refund', priority: 'Urgent', modified_by: 'agent' })
    b.db.elsewhere('t2', { priority: 'Urgent', modified_by: 'u1' })
    await until(() => b.chip() === '2 changed by others', 'the changed chip')
    expect(b.rowOf('t3')!.querySelector('.sv-frh-unseen')?.getAttribute('aria-label')).toMatch(/^Triage agent added this record/)

    ;(b.target.querySelector('.sv-fvb-changed') as HTMLButtonElement).click()
    await until(() => b.chip() === '', 'the chip to clear')
    expect(b.target.querySelectorAll('.sv-frh-unseen')).toHaveLength(0)
  }, 20_000)
})
