/**
 * Automations on a base table, in the component: the view bar's button, an
 * edit in the grid setting one off, a button field running one, and the
 * dialog adding one that reaches `onTablesChange`.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { enableFields, SvBase, type BaseAutomation, type BaseTable } from './index'
import { gridOf, writeCell } from './grid-access'

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

const doneStamps: BaseAutomation = {
  id: 'done',
  name: 'Done ticks the box',
  enabled: true,
  trigger: { type: 'recordUpdated', fields: ['status'] },
  condition: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'status', kind: 'select', op: 'is', value: 'Done' }] },
  actions: [{ type: 'updateRecord', values: { done: 'true' } }],
}
const pressed: BaseAutomation = {
  id: 'press',
  name: 'Start button',
  enabled: true,
  trigger: { type: 'button', field: 'start' },
  actions: [{ type: 'updateRecord', values: { status: 'Doing' } }],
}

const make = (automations: BaseAutomation[]): BaseTable[] => [
  {
    id: 'tasks',
    name: 'Tasks',
    primaryField: 'name',
    columns: [
      { id: 'name', field: 'name', header: 'Task', fieldType: 'text' },
      { id: 'status', field: 'status', header: 'Status', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Todo' }, { value: 'Doing' }, { value: 'Done' }] } },
      { id: 'done', field: 'done', header: 'Done', fieldType: 'checkbox' },
      { id: 'start', field: 'start', header: 'Start', fieldType: 'button', fieldProps: { label: 'Start' } },
    ],
    data: [
      { id: 't1', name: 'Brief', status: 'Todo', done: false },
      { id: 't2', name: 'Site', status: 'Todo', done: false },
    ],
    automations,
  },
]

const mounted: Array<() => void> = []
afterEach(() => {
  while (mounted.length) mounted.pop()!()
})

function mountBase(automations: BaseAutomation[]) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const state: { api: any; tables: BaseTable[] } = { api: null, tables: make(automations) }
  const app = mount(SvBase as any, {
    target,
    props: {
      tables: state.tables,
      onTablesChange: (t: BaseTable[]) => (state.tables = t),
      editable: true,
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
    document.querySelectorAll('.sv-pop__panel, .sv-modal, [role="dialog"]').forEach((n) => n.remove())
  })
  const button = (text: RegExp) => [...target.querySelectorAll<HTMLButtonElement>('.sv-fvb button')].find((b) => text.test(b.textContent ?? ''))
  const rec = (id: string) => state.tables[0]!.data.find((r) => r.id === id)!
  return { target, state, button, rec }
}

describe('automations on a base table', () => {
  it('runs when an edit in the grid sets one off', async () => {
    const b = mountBase([doneStamps])
    await until(() => !!b.state.api && !!b.button(/automation/), 'the view bar')
    expect(b.button(/automation/)!.textContent?.trim()).toBe('1 automation')
    expect(writeCell(gridOf(b.state.api), 't1', 'status', 'Done')).toBe(true)
    await until(() => b.rec('t1').done === true, 'the box ticked')
    expect(b.rec('t2').done).toBe(false)
  })

  it('a button field runs the automation on its record', async () => {
    const b = mountBase([pressed])
    await until(() => b.target.querySelectorAll('.sv-fbt').length === 2, 'the buttons')
    const buttons = [...b.target.querySelectorAll<HTMLButtonElement>('.sv-fbt')]
    expect(buttons[1]!.disabled).toBe(false)
    buttons[1]!.click()
    await until(() => b.rec('t2').status === 'Doing', 'the record started')
    expect(b.rec('t1').status).toBe('Todo')
  })

  it('adds an automation in the dialog, kept with the table', async () => {
    const b = mountBase([])
    await until(() => !!b.button(/Automations/), 'the view bar')
    b.button(/Automations/)!.click()
    flushSync()
    await until(() => !!document.querySelector('.sv-bauto'), 'the dialog')
    expect(document.querySelector('.sv-bauto-empty')?.textContent).toContain('No automations yet')
    ;[...document.querySelectorAll<HTMLButtonElement>('.sv-bauto button')].find((x) => x.textContent?.includes('New automation'))!.click()
    flushSync()
    await until(() => (b.state.tables[0]!.automations ?? []).length === 1, 'the automation saved')
    expect(b.state.tables[0]!.automations![0]).toMatchObject({ trigger: { type: 'recordCreated' }, actions: [{ type: 'notify', message: 'New record: {Task}' }] })
    // Pick the trigger: a record matches a condition.
    const trigger = document.querySelector<HTMLSelectElement>('.sv-bauto select[aria-label="Trigger"]')!
    trigger.value = 'recordMatches'
    trigger.dispatchEvent(new Event('change', { bubbles: true }))
    flushSync()
    await until(() => b.state.tables[0]!.automations![0]!.trigger.type === 'recordMatches', 'the trigger kept')
    expect(document.querySelector('.sv-bauto .sv-ff')?.textContent).toContain('Add the condition a record has to start matching')
    // Runs in: the server.
    const where = [...document.querySelectorAll<HTMLSelectElement>('.sv-bauto select')].find((x) => [...x.options].some((o) => o.value === 'server'))!
    where.value = 'server'
    where.dispatchEvent(new Event('change', { bubbles: true }))
    flushSync()
    await until(() => b.state.tables[0]!.automations![0]!.runOn === 'server', 'runs on the server')
    expect(document.querySelector('.sv-bauto-foot')?.textContent).toContain('Runs on your server')
    await until(() => b.button(/automation/)?.textContent?.trim() === '1 automation', 'the count')
  })
})

describe('automations and links', () => {
  it('a change that reaches another table through a link runs that table\'s automations', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    let tables: BaseTable[] = [
      {
        id: 'guests',
        name: 'Guests',
        primaryField: 'name',
        columns: [
          { id: 'name', field: 'name', header: 'Name', fieldType: 'text' },
          { id: 'event', field: 'event', header: 'Event', fieldType: 'link', fieldProps: { table: 'events', multiple: false, inverse: 'guests' } },
        ],
        data: [
          { id: 'g1', name: 'Ana', event: ['e1'] },
          { id: 'g2', name: 'Ben', event: [] },
        ],
      },
      {
        id: 'events',
        name: 'Events',
        primaryField: 'title',
        columns: [
          { id: 'title', field: 'title', header: 'Title', fieldType: 'text' },
          { id: 'capacity', field: 'capacity', header: 'Capacity', fieldType: 'number' },
          { id: 'guests', field: 'guests', header: 'Guests', fieldType: 'link', fieldProps: { table: 'guests', multiple: true, inverse: 'event' } },
          { id: 'count', field: 'count', header: 'Count', fieldType: 'count', fieldProps: { linkField: 'guests' } },
          { id: 'status', field: 'status', header: 'Status', fieldType: 'text' },
        ],
        data: [{ id: 'e1', title: 'Dinner', capacity: 2, guests: ['g1'], status: 'Open' }],
        automations: [
          {
            id: 'full',
            name: 'Full',
            enabled: true,
            trigger: { type: 'recordMatches' },
            condition: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'count', kind: 'number', op: 'gte', value: 2 }] },
            actions: [{ type: 'updateRecord', values: { status: 'Full' } }],
          },
        ],
      },
    ]
    let api: any = null
    const app = mount(SvBase as any, {
      target,
      props: { tables, onTablesChange: (t: BaseTable[]) => (tables = t), editable: true, containerHeight: 300, virtualization: false, columnVirtualization: false, onApiReady: (a: unknown) => (api = a) },
    })
    flushSync()
    try {
      await until(() => !!api && !!gridOf(api), 'the guests grid')
      // Ben joins the dinner from the Guests table: the event fills up.
      expect(writeCell(gridOf(api), 'g2', 'event', ['e1'])).toBe(true)
      await until(() => tables.find((t) => t.id === 'events')!.data[0]!.status === 'Full', 'the event marked full')
    } finally {
      unmount(app)
      target.remove()
    }
  })
})

describe('lookups and rollups of computed fields', () => {
  it('a rollup averages a formula of the linked records', async () => {
    const { registerLinkedTable, unregisterLinkedTable } = await import('./sources.svelte')
    const { tableFields } = await import('./automations.svelte')
    const krs = [
      { id: 'k1', name: 'A', start: 0, current: 5, target: 10 },
      { id: 'k2', name: 'B', start: 0, current: 10, target: 10 },
    ]
    registerLinkedTable({
      id: 'krs-test',
      name: 'Key results',
      rows: () => krs,
      getRowId: (r) => String(r.id),
      primaryField: 'name',
      fields: [
        { field: 'name', header: 'Name', fieldType: 'text' },
        { field: 'start', header: 'Start', fieldType: 'number' },
        { field: 'current', header: 'Current', fieldType: 'number' },
        { field: 'target', header: 'Target', fieldType: 'number' },
        { field: 'progress', header: 'Progress', fieldType: 'formula', fieldProps: { formula: '({Current} - {Start}) / ({Target} - {Start})' } },
      ],
    })
    try {
      const objectives = {
        id: 'obj', name: 'Objectives', data: [], columns: [
          { field: 'name', header: 'Name', fieldType: 'text' },
          { field: 'krs', header: 'Key results', fieldType: 'link', fieldProps: { table: 'krs-test', multiple: true } },
          { field: 'avg', header: 'Avg', fieldType: 'rollup', fieldProps: { linkField: 'krs', field: 'progress', aggregation: 'AVERAGE' } },
          { field: 'all', header: 'All', fieldType: 'lookup', fieldProps: { linkField: 'krs', field: 'progress' } },
        ],
      } as BaseTable
      const f = tableFields(objectives)
      const row = { id: 'o1', name: 'Ship', krs: ['k1', 'k2'] }
      expect((f.get('avg')!.def.fieldFn as (r: unknown) => unknown)(row)).toBe(0.75)
      expect((f.get('all')!.def.fieldFn as (r: unknown) => unknown)(row)).toEqual([0.5, 1])
    } finally {
      unregisterLinkedTable('krs-test')
    }
  })
})

describe('formulas over computed fields', () => {
  it('a formula reads a rollup and a count of the same record', async () => {
    const { registerLinkedTable, unregisterLinkedTable } = await import('./sources.svelte')
    const { tableFields } = await import('./automations.svelte')
    registerLinkedTable({
      id: 'spend-test',
      name: 'Expenses',
      rows: () => [{ id: 'x1', amount: 100 }, { id: 'x2', amount: 250 }],
      getRowId: (r) => String(r.id),
      primaryField: 'id',
      fields: [{ field: 'amount', header: 'Amount', fieldType: 'number' }],
    })
    try {
      const budgets = {
        id: 'budgets', name: 'Budgets', data: [], columns: [
          { field: 'name', header: 'Name', fieldType: 'text' },
          { field: 'monthly', header: 'Monthly', fieldType: 'number' },
          { field: 'expenses', header: 'Expenses', fieldType: 'link', fieldProps: { table: 'spend-test', multiple: true } },
          { field: 'spent', header: 'Spent', fieldType: 'rollup', fieldProps: { linkField: 'expenses', field: 'amount', aggregation: 'SUM' } },
          { field: 'n', header: 'N', fieldType: 'count', fieldProps: { linkField: 'expenses' } },
          { field: 'left', header: 'Left', fieldType: 'formula', fieldProps: { formula: '{Monthly} - {Spent}' } },
          { field: 'avg', header: 'Avg', fieldType: 'formula', fieldProps: { formula: '{Spent} / {N}' } },
        ],
      } as BaseTable
      const f = tableFields(budgets)
      const row = { id: 'b1', name: 'Travel', monthly: 1000, expenses: ['x1', 'x2'] }
      expect((f.get('left')!.def.fieldFn as (r: unknown) => unknown)(row)).toBe(650)
      expect((f.get('avg')!.def.fieldFn as (r: unknown) => unknown)(row)).toBe(175)
    } finally {
      unregisterLinkedTable('spend-test')
    }
  })
})
