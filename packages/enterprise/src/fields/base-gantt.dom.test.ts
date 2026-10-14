/**
 * A Gantt view of a base: what its bars write back to the records. The
 * Gantt hands over exclusive end dates and 0-100 progress; the records keep
 * the last day and their percent field's own scale.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { enableFields, SvBase, type FieldView } from './index'
import { enableGanttView } from '../gantt/gantt'

enableFields()
enableGanttView()

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

type Task = { id: string; task: string; status: string; start: string; due: string; done: number; after: string[] }
const columns = [
  { field: 'task', header: 'Task', fieldType: 'text' },
  { field: 'status', header: 'Status', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Todo', color: '#94a3b8' }, { value: 'Done', color: '#20c933' }] } },
  { field: 'start', header: 'Start', fieldType: 'date' },
  { field: 'due', header: 'Due', fieldType: 'date' },
  { field: 'done', header: 'Done', fieldType: 'number', fieldProps: { format: 'percent' } },
  { field: 'after', header: 'After', fieldType: 'link', fieldProps: { table: 'gantt-tasks', multiple: true } },
]
const views: FieldView[] = [
  { id: 'all', name: 'All', type: 'grid' },
  { id: 'plan', name: 'Plan', type: 'gantt', dateField: 'start', endField: 'due', progressField: 'done', dependencyField: 'after', color: { mode: 'field', field: 'status' } },
]

const mounted: Array<() => void> = []
afterEach(() => {
  while (mounted.length) mounted.pop()!()
})

describe('SvBase calendar view', () => {
  it('lets events be dragged, writes the last day back, and opens a record on click', async () => {
    const data: Task[] = [{ id: 'a', task: 'Design', status: 'Done', start: '2026-10-12', due: '2026-10-14', done: 1, after: [] }]
    const target = document.createElement('div')
    document.body.appendChild(target)
    let api: any = null
    const app = mount(SvBase as any, {
      target,
      props: {
        data,
        columns,
        views: [{ id: 'cal', name: 'Calendar', type: 'calendar', dateField: 'start', endField: 'due' }],
        getRowId: (r: Task) => r.id,
        primaryField: 'task',
        editable: true,
        containerHeight: 500,
        onApiReady: (a: unknown) => (api = a),
      },
    })
    flushSync()
    mounted.push(() => {
      unmount(app)
      target.remove()
    })
    await until(() => !!api?.getOption?.('scheduler'), 'the calendar config')
    const cfg = api.getOption('scheduler')
    // Without editable the calendar is read-only: no drag, no resize.
    expect(cfg).toMatchObject({ editable: true, allDay: true, startField: 'start', endField: 'due' })
    expect(typeof cfg.onEventOpen).toBe('function')
    // An all-day move reports the exclusive end; the record keeps its last day.
    cfg.onEventMove({ row: { ...data[0] }, start: new Date(2026, 9, 19), end: new Date(2026, 9, 22), allDay: true })
    await until(() => api.getData()[0].start === '2026-10-19', 'the moved start')
    expect(api.getData()[0]).toMatchObject({ start: '2026-10-19', due: '2026-10-21' })
    // The first calendar loads the scheduler's lazy chunk: seconds on a cold transform cache.
  }, 30_000)
})

describe('SvBase Gantt view', () => {
  it('writes moves, progress and links back to the records', async () => {
    const data: Task[] = [
      { id: 'a', task: 'Design', status: 'Done', start: '2026-10-12', due: '2026-10-14', done: 1, after: [] },
      { id: 'b', task: 'Build', status: 'Todo', start: '2026-10-15', due: '2026-10-20', done: 0.25, after: ['a'] },
    ]
    const target = document.createElement('div')
    document.body.appendChild(target)
    let api: any = null
    const app = mount(SvBase as any, {
      target,
      props: { data, columns, views, activeView: 'plan', getRowId: (r: Task) => r.id, primaryField: 'task', editable: true, containerHeight: 500, onApiReady: (a: unknown) => (api = a) },
    })
    flushSync()
    mounted.push(() => {
      unmount(app)
      target.remove()
    })
    await until(() => !!api?.getOption?.('gantt'), 'the gantt config')
    const cfg = api.getOption('gantt')
    expect(cfg).toMatchObject({ startField: 'start', endField: 'due', progressField: 'done', tableColumns: ['task', 'start', 'due', '__duration'] })
    // Progress: a fraction field reads as 0-100.
    expect(cfg.progressValue(data[1])).toBe(25)
    // Colored by Status, as the rows are.
    expect(cfg.colorOf(data[0])).toBe('#20c933')

    // A move: the end the Gantt reports is exclusive; the record keeps the last day.
    // The row handed over is a copy, as the Gantt's is.
    cfg.onTaskMove({ row: { ...data[0] }, start: new Date(2026, 9, 19), end: new Date(2026, 9, 22) })
    await until(() => api.getData()[0].start === '2026-10-19', 'the moved start')
    expect(api.getData()[0]).toMatchObject({ start: '2026-10-19', due: '2026-10-21' })

    // Progress back in the field's own scale.
    cfg.onProgressChange({ row: data[1], progress: 60 })
    await until(() => api.getData()[1].done === 0.6, 'the progress')

    // A link drawn from Design to Build is already there; one removed goes.
    cfg.onDependencyAdd({ from: 'a', to: 'b' })
    expect(api.getData()[1].after).toEqual(['a'])
    cfg.onDependencyRemove('a->b')
    await until(() => api.getData()[1].after.length === 0, 'the removed link')

    // Delete from the bar's menu removes the record.
    cfg.onTaskDelete({ ...data[0] })
    await until(() => api.getData().length === 1, 'the deleted record')
    expect(api.getData()[0].id).toBe('b')
  })
})
