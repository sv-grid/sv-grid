/**
 * Automations on the server: changes heard from a webhook, from the kit
 * endpoint's audit hook and from reading a table again; the echo of its own
 * write ignored; webhooks with secrets, emails, schedules; and each side
 * running only its own automations.
 */
import { describe, expect, it } from 'vitest'
import type { ServerDataSource } from '@svgrid/grid'
import { enableFields } from './index'
import { baseSource } from './base-sync'
import { createAutomationServer } from './automation-server'
import { automationsFor, createAutomationRunner, type BaseAutomation } from './automations.svelte'
import { callWebhook } from './automation-outbound'
import type { BaseTable } from './base-tables'

enableFields()

type Row = Record<string, unknown>

function fakeTable(rows: Row[]) {
  const store = new Map(rows.map((r) => [String(r.id), { ...r }]))
  const log: string[] = []
  const ds: ServerDataSource<Row> = {
    async getRows() {
      return { rows: [...store.values()].map((r) => ({ ...r })), rowCount: store.size }
    },
    async createRow(input) {
      store.set(String(input.id), { ...input })
      log.push(`insert ${JSON.stringify(input)}`)
      return { ...input }
    },
    async updateRow(id, patch) {
      store.set(id, { ...store.get(id), ...patch })
      log.push(`update ${id} ${JSON.stringify(patch)}`)
      return { ...store.get(id)! }
    },
    async deleteRow(id) {
      store.delete(id)
      log.push(`delete ${id}`)
    },
  }
  return { ds, store, log }
}

const statusIs = (value: string) => ({ kind: 'fieldFilter' as const, conjunction: 'and' as const, conditions: [{ column: 'status', kind: 'select' as const, op: 'is' as const, value }] })

function setup(automations: BaseAutomation[], extra: { fetch?: typeof fetch; sendEmail?: (e: unknown) => void } = {}) {
  const tasks = fakeTable([
    { id: 't1', name: 'Brief', status: 'Todo', done: false, owner_email: 'ana@example.com', project_id: 'p1' },
    { id: 't2', name: 'Site', status: 'Todo', done: false, owner_email: 'ben@example.com', project_id: null },
  ])
  const projects = fakeTable([{ id: 'p1', name: 'Launch' }])
  const tables: BaseTable[] = [
    {
      id: 'tasks',
      name: 'Tasks',
      primaryField: 'name',
      data: [],
      columns: [
        { field: 'name', header: 'Task', fieldType: 'text' },
        { field: 'status', header: 'Status', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Todo' }, { value: 'Done' }] } },
        { field: 'done', header: 'Done', fieldType: 'checkbox' },
        { field: 'owner_email', header: 'Owner email', fieldType: 'email' },
        { field: 'project', header: 'Project', fieldType: 'link', fieldProps: { table: 'projects', multiple: false, inverse: 'tasks' } },
      ],
      automations,
      source: baseSource(tasks.ds, { links: { project: { column: 'project_id' } } }),
    },
    {
      id: 'projects',
      name: 'Projects',
      primaryField: 'name',
      data: [],
      columns: [
        { field: 'name', header: 'Project', fieldType: 'text' },
        { field: 'tasks', header: 'Tasks', fieldType: 'link', fieldProps: { table: 'tasks', multiple: true, inverse: 'project' } },
      ],
      source: baseSource(projects.ds),
    },
  ]
  const notices: string[] = []
  const server = createAutomationServer({
    tables,
    secrets: { CHAT_TOKEN: 's3cret' },
    notify: (n) => notices.push(n.message),
    fetch: extra.fetch,
    sendEmail: extra.sendEmail,
    now: () => new Date(2026, 9, 14, 9, 0),
  })
  const settle = async () => {
    for (let i = 0; i < 6; i++) await server.settled()
  }
  return { tasks, projects, server, notices, settle }
}

const onServer = (a: Omit<BaseAutomation, 'runOn' | 'enabled'>): BaseAutomation => ({ ...a, enabled: true, runOn: 'server' })

describe('automations on the server', () => {
  it('runs on a change a webhook sends, writes through the source, and ignores the echo of its own write', async () => {
    const b = setup([onServer({ id: 'done', name: 'Done ticks', trigger: { type: 'recordUpdated', fields: ['status'] }, condition: statusIs('Done'), actions: [{ type: 'updateRecord', values: { done: 'true' } }, { type: 'notify', message: '{Task} done ({Project})' }] })])
    const before = { id: 't1', name: 'Brief', status: 'Todo', done: false, owner_email: 'ana@example.com', project_id: 'p1' }
    const runs = await b.server.recordChanged('tasks', { before, after: { ...before, status: 'Done' } })
    expect(runs.map((r) => r.status)).toEqual(['ok'])
    expect(b.tasks.log).toEqual(['update t1 {"done":true}'])
    expect(b.notices).toEqual(['Brief done (Launch)'])
    // The database's webhook for that write comes back: nothing new, nothing runs.
    const echo = await b.server.recordChanged('tasks', { before: { ...before, status: 'Done' }, after: { ...before, status: 'Done', done: true } })
    await b.settle()
    expect(echo).toEqual([])
    expect(b.server.runs).toHaveLength(1)
  })

  it('hears the kit endpoint through its audit hook, and new records from reading a table again', async () => {
    const b = setup([onServer({ id: 'new', name: 'Welcome', trigger: { type: 'recordCreated' }, actions: [{ type: 'updateRecord', values: { status: 'Todo' } }] })])
    await b.server.prime()
    // A write through createKitHandlers: its audit hook passes the stored row.
    b.tasks.store.set('t3', { id: 't3', name: 'Launch email', status: null, done: false, owner_email: '', project_id: null })
    await b.server.audit('tasks')({ action: 'create', id: 't3', result: b.tasks.store.get('t3') })
    expect(b.tasks.log).toEqual(['update t3 {"status":"Todo"}'])
    // A row another app inserted: read the table again.
    b.tasks.store.set('t4', { id: 't4', name: 'Press kit', status: null, done: false, owner_email: '', project_id: null })
    await b.server.tableChanged('tasks')
    expect(b.tasks.log.at(-1)).toBe('update t4 {"status":"Todo"}')
  })

  it('calls a webhook with a secret and the record, and sends an email', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response('{}', { status: 200 })
    }) as unknown as typeof globalThis.fetch
    const emails: unknown[] = []
    const b = setup(
      [
        onServer({
          id: 'hook',
          name: 'Tell the team',
          trigger: { type: 'recordMatches' },
          condition: statusIs('Done'),
          actions: [
            { type: 'webhook', url: 'https://chat.example.com/hooks/{secret:CHAT_TOKEN}', headers: { Authorization: 'Bearer {secret:CHAT_TOKEN}' }, body: '{"text":"{Task} is \\"done\\""}' },
            { type: 'email', to: '{Owner email}', subject: '{Task} is done', body: 'Nice work on {Task}.' },
          ],
        }),
      ],
      { fetch, sendEmail: (e) => emails.push(e) },
    )
    const before = { id: 't2', name: 'Site', status: 'Todo', done: false, owner_email: 'ben@example.com', project_id: null }
    const [run] = await b.server.recordChanged('tasks', { before, after: { ...before, status: 'Done' } })
    expect(run!.steps.map((s) => s.detail)).toEqual(['POST chat.example.com: 200', 'To ben@example.com: Site is done'])
    expect(calls[0]!.url).toBe('https://chat.example.com/hooks/s3cret')
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer s3cret')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ text: 'Site is "done"' })
    expect(emails).toEqual([{ to: ['ben@example.com'], subject: 'Site is done', text: 'Nice work on Site.' }])
  })

  it('runs a scheduled automation once in its minute, for each record that matches', async () => {
    const b = setup([onServer({ id: 'nine', name: 'Morning', trigger: { type: 'scheduled', cron: '0 9 * * *' }, condition: statusIs('Todo'), actions: [{ type: 'notify', message: 'Still to do: {Task}' }] })])
    const at = new Date(2026, 9, 14, 9, 0)
    expect(await b.server.tick(at)).toHaveLength(2)
    expect(await b.server.tick(at)).toHaveLength(0)
    expect(await b.server.tick(new Date(2026, 9, 14, 9, 1))).toHaveLength(0)
    expect(b.notices).toEqual(['Still to do: Brief', 'Still to do: Site'])
  })

  it('each side runs only its own automations', () => {
    const inBrowser: BaseAutomation = { id: 'b', name: 'B', enabled: true, trigger: { type: 'recordCreated' }, actions: [] }
    const inServer: BaseAutomation = { ...inBrowser, id: 's', runOn: 'server' }
    const t = { id: 'x', name: 'X', columns: [{ field: 'name', fieldType: 'text' }], data: [], automations: [inBrowser, inServer] } as BaseTable
    const e = { type: 'created' as const, table: 'x', record: { id: '1' } }
    expect(automationsFor(t, e, 'browser').map((a) => a.id)).toEqual(['b'])
    expect(automationsFor(t, e, 'server').map((a) => a.id)).toEqual(['s'])
  })

  it('in the browser, a webhook that names a secret or an email says to run it on the server', async () => {
    const t = { id: 'x', name: 'X', columns: [{ field: 'name', header: 'Name', fieldType: 'text' }], data: [{ id: '1', name: 'A' }], automations: [] } as BaseTable
    await expect(
      callWebhook({ type: 'webhook', url: 'https://x.example.com/{secret:KEY}' }, { automation: 'a', table: 'X', record: null, fill: (s) => s, fields: () => ({}), fetch: (async () => new Response('')) as never }),
    ).rejects.toThrow('run this automation on the server')
    let tables = [{ ...t, automations: [{ id: 'm', name: 'Mail', enabled: true, trigger: { type: 'recordCreated' as const }, actions: [{ type: 'email' as const, to: 'a@b.c', subject: 's', body: 'b' }] }] }]
    const runner = createAutomationRunner({ getTables: () => tables, apply: (n) => (tables = n as typeof tables) })
    await runner.handle({ type: 'created', table: 'x', record: tables[0]!.data[0]! })
    expect(runner.runs[0]!.steps[0]!.error).toContain('server runner')
  })
})
