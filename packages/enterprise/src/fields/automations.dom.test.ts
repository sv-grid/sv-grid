/**
 * Automations: which events set an automation off, what each action writes,
 * values written as the field shows them, records created and linked back,
 * the stop on automations that set each other off, app actions and schedules.
 */
import { describe, expect, it } from 'vitest'
import { enableFields } from './index'
import { createAutomationRunner, fieldValueFrom, registerAutomationAction, tableFields, type BaseAutomation } from './automations.svelte'
import { setFieldUsers } from './sources.svelte'
import type { BaseTable } from './base-tables'

enableFields()
setFieldUsers([{ id: 'u1', name: 'Ana Ruiz' }, { id: 'u2', name: 'Ben Okafor' }])

type Row = Record<string, unknown>
const NOW = new Date(2026, 9, 14, 9, 30)

function setup(automations: BaseAutomation[], extra: Partial<BaseTable> = {}) {
  let tables: BaseTable[] = [
    {
      id: 'tasks',
      name: 'Tasks',
      primaryField: 'name',
      columns: [
        { field: 'name', header: 'Task', fieldType: 'text' },
        { field: 'status', header: 'Status', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Todo' }, { value: 'Blocked' }, { value: 'Done' }] } },
        { field: 'owner', header: 'Owner', fieldType: 'user' },
        { field: 'due', header: 'Due', fieldType: 'date' },
        { field: 'done', header: 'Done', fieldType: 'checkbox' },
        { field: 'note', header: 'Note', fieldType: 'text' },
        { field: 'issues', header: 'Issues', fieldType: 'link', fieldProps: { table: 'issues', multiple: true, inverse: 'task' } },
      ],
      data: [
        { id: 't1', name: 'Brief', status: 'Todo', owner: 'u1', due: '2026-10-01', done: false, note: '', issues: [] },
        { id: 't2', name: 'Site', status: 'Done', owner: 'u2', due: '2026-11-01', done: true, note: '', issues: [] },
      ],
      automations,
      ...extra,
    },
    {
      id: 'issues',
      name: 'Issues',
      primaryField: 'title',
      columns: [
        { field: 'title', header: 'Title', fieldType: 'text' },
        { field: 'task', header: 'Task', fieldType: 'link', fieldProps: { table: 'tasks', multiple: false, inverse: 'issues' } },
      ],
      data: [],
    },
  ]
  const runner = createAutomationRunner({ getTables: () => tables, apply: (next) => (tables = next), now: () => NOW })
  const row = (table: string, id: string) => tables.find((t) => t.id === table)!.data.find((r) => r.id === id)!
  /** Change a record as the grid would, then tell the runner. */
  const edit = (id: string, patch: Row) => {
    const t = tables[0]!
    const before = { ...row('tasks', id) }
    const after = { ...before, ...patch }
    tables = tables.map((x) => (x.id === 'tasks' ? { ...x, data: x.data.map((r) => (r.id === id ? after : r)) } : x))
    return runner.handle({ type: 'updated', table: t.id, record: after, before, fields: Object.keys(patch) })
  }
  const add = (record: Row) => {
    tables = tables.map((x) => (x.id === 'tasks' ? { ...x, data: [...x.data, record] } : x))
    return runner.handle({ type: 'created', table: 'tasks', record })
  }
  const settle = async () => {
    // A run that changes a record queues the runs it sets off.
    for (let i = 0; i < 8; i++) await runner.settled()
  }
  return { runner, row, edit, add, settle, get tables() { return tables } }
}

const auto = (a: Partial<BaseAutomation> & Pick<BaseAutomation, 'trigger' | 'actions'>): BaseAutomation => ({ id: a.name ?? 'a', name: 'Rule', enabled: true, ...a })
const statusIs = (value: string) => ({ kind: 'fieldFilter' as const, conjunction: 'and' as const, conditions: [{ column: 'status', kind: 'select' as const, op: 'is' as const, value }] })

describe('automations', () => {
  it('a new record gets values and a notice', async () => {
    const b = setup([auto({ trigger: { type: 'recordCreated' }, actions: [{ type: 'updateRecord', values: { status: 'Todo', due: 'today+7', owner: 'Ben Okafor' } }, { type: 'notify', message: 'New task {Task}' }] })])
    await b.add({ id: 't9', name: 'Launch email' })
    await b.settle()
    expect(b.row('tasks', 't9')).toMatchObject({ status: 'Todo', due: '2026-10-21', owner: 'u2' })
    const run = b.runner.runs[0]!
    expect(run).toMatchObject({ status: 'ok', record: 'Launch email' })
    expect(run.steps.map((s) => s.action)).toEqual(['Update record', 'Notice'])
    expect(run.steps[1]!.detail).toBe('New task Launch email')
  })

  it('a change runs only the automations watching that field, for records that match', async () => {
    const b = setup([
      auto({ id: 'watch', name: 'Status watch', trigger: { type: 'recordUpdated', fields: ['status'] }, condition: statusIs('Done'), actions: [{ type: 'updateRecord', values: { done: 'true' } }] }),
    ])
    await b.edit('t1', { note: 'typing' })
    await b.settle()
    expect(b.runner.runs).toHaveLength(0)
    await b.edit('t1', { status: 'Blocked' })
    await b.settle()
    expect(b.runner.runs).toHaveLength(0)
    await b.edit('t1', { status: 'Done' })
    await b.settle()
    expect(b.row('tasks', 't1').done).toBe(true)
    expect(b.runner.runs).toHaveLength(1)
  })

  it('"matches a condition" runs when a record starts to match, not while it keeps matching', async () => {
    const b = setup([auto({ trigger: { type: 'recordMatches' }, condition: statusIs('Blocked'), actions: [{ type: 'notify', message: '{Task} is blocked' }] })])
    await b.edit('t1', { status: 'Blocked' })
    await b.edit('t1', { note: 'still blocked' })
    await b.settle()
    expect(b.runner.runs).toHaveLength(1)
    expect(b.runner.runs[0]!.steps[0]!.detail).toBe('Brief is blocked')
  })

  it('creates a record in another table, linked back to the record', async () => {
    const b = setup([
      auto({ trigger: { type: 'recordMatches' }, condition: statusIs('Blocked'), actions: [{ type: 'createRecord', table: 'issues', values: { title: 'Unblock {Task}' }, linkField: 'task' }] }),
    ])
    await b.edit('t1', { status: 'Blocked' })
    await b.settle()
    const issue = b.tables[1]!.data[0]!
    expect(issue).toMatchObject({ title: 'Unblock Brief', task: ['t1'] })
    // The field that links back lists the new issue.
    expect(b.row('tasks', 't1').issues).toEqual([issue.id])
    expect(b.runner.runs[0]!.steps[0]!.detail).toBe('Unblock Brief in Issues')
  })

  it('stops automations that set each other off', async () => {
    const b = setup([auto({ trigger: { type: 'recordUpdated', fields: ['note'] }, actions: [{ type: 'updateRecord', values: { note: '{Note}+' } }] })])
    await b.edit('t1', { note: 'go' })
    await b.settle()
    expect(b.row('tasks', 't1').note).toBe('go++++')
    expect(b.runner.runs[0]).toMatchObject({ status: 'stopped' })
  })

  it('runs an action the app registered, and reports one that failed', async () => {
    const sent: string[] = []
    registerAutomationAction('test-post', { label: 'Post to chat', run: (ctx) => { sent.push(ctx.text('Task')); return 'posted' } })
    registerAutomationAction('test-fail', { label: 'Broken', run: () => { throw new Error('No connection') } })
    const b = setup([
      auto({ id: 'p', trigger: { type: 'button', field: 'name' }, actions: [{ type: 'run', action: 'test-post' }] }),
      auto({ id: 'f', trigger: { type: 'formSubmitted' }, actions: [{ type: 'run', action: 'test-fail' }, { type: 'notify', message: 'never' }] }),
    ])
    await b.runner.handle({ type: 'button', table: 'tasks', record: b.row('tasks', 't2'), field: 'name' })
    await b.runner.handle({ type: 'form', table: 'tasks', record: b.row('tasks', 't1'), view: 'request' })
    await b.settle()
    expect(sent).toEqual(['Site'])
    expect(b.runner.runs[1]!.steps[0]).toMatchObject({ action: 'Post to chat', detail: 'posted' })
    expect(b.runner.runs[0]).toMatchObject({ status: 'error', steps: [{ action: 'Broken', error: 'No connection' }] })
  })

  it('a scheduled automation runs once for each record that matches', async () => {
    const b = setup([auto({ id: 'nightly', trigger: { type: 'scheduled', cron: '0 9 * * *' }, condition: statusIs('Done'), actions: [{ type: 'updateRecord', values: { note: 'archived' } }] })])
    await b.runner.runScheduled('tasks:nightly')
    await b.settle()
    expect(b.row('tasks', 't2').note).toBe('archived')
    expect(b.row('tasks', 't1').note).toBe('')
  })

  it('reads values as the field shows them', () => {
    const b = setup([])
    const t = b.tables[0]!
    const f = tableFields(t)
    const ctx = { tables: b.tables, from: t, record: b.row('tasks', 't1'), now: NOW }
    expect(fieldValueFrom(t, f.get('done')!.def, 'yes', ctx)).toBe(true)
    expect(fieldValueFrom(t, f.get('due')!.def, 'today-1', ctx)).toBe('2026-10-13')
    expect(fieldValueFrom(t, f.get('owner')!.def, 'ana ruiz', ctx)).toBe('u1')
    expect(fieldValueFrom(t, f.get('note')!.def, '{Task} ({Status})', ctx)).toBe('Brief (Todo)')
    expect(fieldValueFrom(t, f.get('status')!.def, '', ctx)).toBeNull()
    const issues = b.tables[1]!
    expect(fieldValueFrom(issues, tableFields(issues).get('task')!.def, '{record}', ctx)).toEqual(['t1'])
    expect(fieldValueFrom(issues, tableFields(issues).get('task')!.def, 'Site', ctx)).toEqual(['t2'])
  })
})
