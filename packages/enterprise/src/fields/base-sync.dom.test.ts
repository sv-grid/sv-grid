/**
 * A base on a database: loading tables and the fields that link back,
 * writing only what changed, foreign keys and junction tables, ids the
 * database makes, undoing a failed write, and changes made elsewhere.
 */
import { describe, expect, it } from 'vitest'
import type { ServerDataSource } from '@svgrid/grid'
import { baseSource, createBaseSync, type BaseRemoteChange, type BaseSyncStatus } from './base-sync'
import { syncInverse, type BaseTable } from './base-tables'

type Row = Record<string, unknown>

/** A table in memory with the grid's data source contract, logging every write. */
function fakeTable(rows: Row[], opts: { serial?: boolean; fail?: (op: string, arg: unknown) => boolean } = {}) {
  const store = new Map(rows.map((r) => [String(r.id), { ...r }]))
  const log: string[] = []
  let next = 100
  const ds: ServerDataSource<Row> = {
    async getRows() {
      return { rows: [...store.values()].map((r) => ({ ...r })), rowCount: store.size }
    },
    async createRow(input) {
      if (opts.fail?.('create', input)) throw new Error('insert refused')
      const id = opts.serial ? String(next++) : String(input.id)
      const row = { ...input, id }
      store.set(id, row)
      log.push(`insert ${JSON.stringify(input)}`)
      return { ...row }
    },
    async updateRow(id, patch) {
      if (opts.fail?.('update', patch)) throw new Error('update refused')
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

const columnsOf = {
  tasks: [
    { field: 'name', header: 'Name', fieldType: 'text' },
    { field: 'status', header: 'Status', fieldType: 'singleSelect' },
    { field: 'project', header: 'Project', fieldType: 'link', fieldProps: { table: 'projects', multiple: false, inverse: 'tasks' } },
    { field: 'label', header: 'Label', fieldType: 'formula', fieldProps: { formula: 'name' } },
  ],
  projects: [
    { field: 'name', header: 'Name', fieldType: 'text' },
    { field: 'tasks', header: 'Tasks', fieldType: 'link', fieldProps: { table: 'tasks', multiple: true, inverse: 'project' } },
  ],
}

function setup(opts: { serial?: boolean; fail?: (op: string, arg: unknown) => boolean } = {}) {
  const tasks = fakeTable(
    [
      { id: 't1', name: 'Brief', status: 'Todo', project_id: 'p1' },
      { id: 't2', name: 'Site', status: 'Done', project_id: null },
    ],
    opts,
  )
  const projects = fakeTable([{ id: 'p1', name: 'Launch' }])
  let tables: BaseTable[] = [
    { id: 'tasks', name: 'Tasks', primaryField: 'name', columns: columnsOf.tasks, data: [], source: baseSource(tasks.ds, { links: { project: { column: 'project_id' } }, serverIds: opts.serial }) },
    { id: 'projects', name: 'Projects', primaryField: 'name', columns: columnsOf.projects, data: [], source: baseSource(projects.ds) },
  ]
  const statuses: BaseSyncStatus[] = []
  const errors: string[] = []
  const remote: BaseRemoteChange[] = []
  const sync = createBaseSync({
    getTables: () => tables,
    apply: (next) => (tables = next),
    onStatus: (s) => statuses.push(s),
    onError: (e) => errors.push(`${e.action} ${e.table}: ${e.message}`),
    onRemoteChange: (list) => remote.push(...list),
  })
  const edit = (change: (t: BaseTable[]) => BaseTable[]) => {
    tables = change(tables)
    sync.push(tables)
    return sync.settled()
  }
  const table = (id: string) => tables.find((t) => t.id === id)!
  return { tasks, projects, sync, edit, table, get tables() { return tables }, statuses, errors, remote }
}

const setRow = (t: BaseTable[], table: string, id: string, patch: Row) =>
  t.map((x) => (x.id === table ? { ...x, data: x.data.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : x))

describe('a base on a database', () => {
  it('loads each table, a foreign key as a link, and fills in the field that links back', async () => {
    const b = setup()
    await b.sync.load()
    expect(b.table('tasks').data).toEqual([
      { id: 't1', name: 'Brief', status: 'Todo', project: ['p1'] },
      { id: 't2', name: 'Site', status: 'Done', project: [] },
    ])
    expect(b.table('projects').data[0]).toMatchObject({ id: 'p1', tasks: ['t1'] })
    expect(b.statuses.at(-1)).toEqual({ state: 'idle' })
  })

  it('writes only the fields that changed, a link as its column, and never the field that links back or a formula', async () => {
    const b = setup()
    await b.sync.load()
    await b.edit((t) => setRow(t, 'tasks', 't2', { status: 'Todo', label: 'computed' }))
    expect(b.tasks.log).toEqual(['update t2 {"status":"Todo"}'])
    // Linking a task to the project from the project's side: the task's foreign key is written.
    await b.edit((t) => syncInverse(setRow(t, 'projects', 'p1', { tasks: ['t1', 't2'] }), 'projects', 'tasks'))
    expect(b.tasks.log.at(-1)).toBe('update t2 {"project_id":"p1"}')
    expect(b.projects.log).toEqual([])
  })

  it('inserts and deletes records', async () => {
    const b = setup()
    await b.sync.load()
    await b.edit((t) => t.map((x) => (x.id === 'tasks' ? { ...x, data: [...x.data, { id: 'recA', name: 'New', project: ['p1'] }] } : x)))
    expect(b.tasks.log).toEqual(['insert {"name":"New","project_id":"p1","id":"recA"}'])
    await b.edit((t) => t.map((x) => (x.id === 'tasks' ? { ...x, data: x.data.filter((r) => r.id !== 't1') } : x)))
    expect(b.tasks.log.at(-1)).toBe('delete t1')
  })

  it('keeps the page id of a record the database gave its own id, and writes to the database id', async () => {
    const b = setup({ serial: true })
    await b.sync.load()
    await b.edit((t) => t.map((x) => (x.id === 'tasks' ? { ...x, data: [...x.data, { id: 'recB', name: 'Draft' }] } : x)))
    expect(b.tasks.log[0]).toBe('insert {"name":"Draft"}')
    await b.edit((t) => setRow(t, 'tasks', 'recB', { status: 'Done' }))
    expect(b.tasks.log.at(-1)).toBe('update 100 {"status":"Done"}')
    expect(b.table('tasks').data.some((r) => r.id === 'recB')).toBe(true)
  })

  it('undoes a write the database refused and says why', async () => {
    const b = setup({ fail: (op) => op === 'update' })
    await b.sync.load()
    await b.edit((t) => setRow(t, 'tasks', 't1', { status: 'Blocked' }))
    expect(b.table('tasks').data.find((r) => r.id === 't1')!.status).toBe('Todo')
    expect(b.errors).toEqual(['update Tasks: update refused'])
    expect(b.statuses.some((s) => s.state === 'error')).toBe(true)
  })

  it('writes a link to many records as junction rows', async () => {
    const tags = fakeTable([{ id: 'g1', name: 'Bug' }, { id: 'g2', name: 'Risk' }])
    const pairs = fakeTable([{ id: 'j1', task_id: 't1', tag_id: 'g1' }], { serial: true })
    const tasks = fakeTable([{ id: 't1', name: 'Brief' }])
    let tables: BaseTable[] = [
      {
        id: 'tasks', name: 'Tasks', columns: [{ field: 'name', fieldType: 'text' }, { field: 'tags', fieldType: 'link', fieldProps: { table: 'tags', multiple: true } }], data: [],
        source: baseSource(tasks.ds, { links: { tags: { through: pairs.ds, from: 'task_id', to: 'tag_id' } } }),
      },
      { id: 'tags', name: 'Tags', columns: [{ field: 'name', fieldType: 'text' }], data: [], source: baseSource(tags.ds) },
    ]
    const sync = createBaseSync({ getTables: () => tables, apply: (n) => (tables = n) })
    await sync.load()
    expect(tables[0]!.data[0]).toMatchObject({ id: 't1', tags: ['g1'] })
    tables = setRow(tables, 'tasks', 't1', { tags: ['g2'] })
    sync.push(tables)
    await sync.settled()
    expect(pairs.log).toEqual(['insert {"task_id":"t1","tag_id":"g2"}', 'delete j1'])
    expect(tasks.log).toEqual([])
  })

  it('takes changes made elsewhere and leaves the page alone when nothing moved', async () => {
    const b = setup()
    let ping: () => void = () => {}
    b.table('tasks').source!.subscribe = (on) => {
      ping = on
      return () => {}
    }
    await b.sync.load()
    b.tasks.store.set('t1', { ...b.tasks.store.get('t1')!, status: 'Done', project_id: null })
    b.tasks.store.set('t9', { id: 't9', name: 'Remote', status: 'Todo', project_id: 'p1' })
    ping()
    await new Promise((r) => setTimeout(r, 200))
    expect(b.table('tasks').data.map((r) => [r.id, r.status])).toEqual([['t1', 'Done'], ['t2', 'Done'], ['t9', 'Todo']])
    expect(b.table('projects').data[0]!.tasks).toEqual(['t9'])
    // Nothing is written back.
    expect(b.tasks.log).toEqual([])
  })

  it('says what changed elsewhere: each moved field from what to what, records added and removed', async () => {
    const b = setup()
    let ping: () => void = () => {}
    b.table('tasks').source!.subscribe = (on) => {
      ping = on
      return () => {}
    }
    await b.sync.load()
    b.tasks.store.set('t1', { ...b.tasks.store.get('t1')!, status: 'Done' })
    b.tasks.store.set('t9', { id: 't9', name: 'Remote', status: 'Todo', project_id: null })
    b.tasks.store.delete('t2')
    ping()
    await new Promise((r) => setTimeout(r, 200))
    const byType = Object.fromEntries(b.remote.map((c) => [c.type, c]))
    expect(byType.update).toMatchObject({ table: 'tasks', id: 't1', fields: [{ field: 'status', from: 'Todo', to: 'Done' }] })
    expect(byType.update!.record.status).toBe('Done')
    expect(byType.insert).toMatchObject({ table: 'tasks', id: 't9', record: { name: 'Remote' } })
    expect(byType.delete).toMatchObject({ table: 'tasks', id: 't2', record: { name: 'Site' } })
    expect(b.remote).toHaveLength(3)
  })

  it('does not report the writes of the page itself as changes made elsewhere', async () => {
    const b = setup()
    let ping: () => void = () => {}
    b.table('tasks').source!.subscribe = (on) => {
      ping = on
      return () => {}
    }
    await b.sync.load()
    await b.edit((t) => setRow(t, 'tasks', 't1', { status: 'Done' }))
    // The database tells every listener of the write, this page included.
    ping()
    await new Promise((r) => setTimeout(r, 200))
    expect(b.tasks.log).toEqual(['update t1 {"status":"Done"}'])
    expect(b.remote).toEqual([])
  })
})

describe('base tables from a database description', () => {
  it('names who changed or added a row from updated_by and created_by columns', async () => {
    const { baseFieldsFromSchema } = await import('./base-schema')
    const { columns } = baseFieldsFromSchema({
      name: 'tickets',
      fields: [
        { field: 'id', type: 'text', primaryKey: true },
        { field: 'subject', type: 'text' },
        { field: 'created_by', type: 'text' },
        { field: 'updated_by', type: 'text' },
        { field: 'modified_by', type: 'text' },
        { field: 'bypass', type: 'text' },
      ],
    })
    expect(columns.map((x) => [x.field, x.fieldType])).toEqual([
      ['subject', 'text'],
      ['created_by', 'createdBy'],
      ['updated_by', 'lastModifiedBy'],
      ['modified_by', 'lastModifiedBy'],
      ['bypass', 'text'],
    ])
  })

  it('makes fields by column type, a link for a foreign key, and the field that links back', async () => {
    const { baseTablesFromSchemas } = await import('./base-schema')
    const deals = fakeTable([{ id: 'd1', title: 'Renewal', stage: 'Won', amount: 10, company_id: 'c1', region_id: 'r9' }])
    const companies = fakeTable([{ id: 'c1', name: 'Contoso' }])
    const tables = baseTablesFromSchemas(
      [
        {
          name: 'deals',
          fields: [
            { field: 'id', type: 'text', primaryKey: true },
            { field: 'stage', type: 'enum', options: [{ value: 'Won', label: 'Won', color: '#16a34a' }] },
            { field: 'title', type: 'text' },
            { field: 'amount', type: 'number' },
            { field: 'company_id', type: 'relation', relation: { entity: 'companies', labelField: 'name' } },
            // A table outside the set: the key stays a plain value.
            { field: 'region_id', type: 'relation', relation: { entity: 'regions', labelField: 'name' } },
          ],
        },
        { name: 'companies', label: 'Customer', fields: [{ field: 'id', type: 'text', primaryKey: true }, { field: 'name', type: 'text' }] },
      ],
      (s) => (s.name === 'deals' ? deals.ds : companies.ds),
    )
    const [d, c] = tables
    expect(d!.primaryField).toBe('title')
    expect(d!.columns.map((x) => [x.field, x.fieldType])).toEqual([
      ['title', 'text'],
      ['stage', 'singleSelect'],
      ['amount', 'number'],
      ['company', 'link'],
      ['region_id', 'text'],
    ])
    expect(d!.columns[1]!.fieldProps.options).toEqual([{ value: 'Won', color: '#16a34a' }])
    expect(c!.name).toBe('Customer')
    const back = c!.columns.find((x) => x.fieldType === 'link')!
    expect(back.fieldProps).toMatchObject({ table: 'deals', inverse: 'company' })
    let list = tables
    const sync = createBaseSync({ getTables: () => list, apply: (n) => (list = n) })
    await sync.load()
    expect(list[0]!.data[0]).toMatchObject({ id: 'd1', company: ['c1'], region_id: 'r9' })
    expect(list[1]!.data[0]![String(back.field)]).toEqual(['d1'])
  })
})

describe('a base described from a database', () => {
  it('turns repeated values into selects, a junction table into a link to many, and adds views', async () => {
    const { baseSpecFromSchemas } = await import('./base-schema')
    const specs = baseSpecFromSchemas(
      [
        {
          name: 'tasks',
          fields: [
            { field: 'id', type: 'text', primaryKey: true },
            { field: 'status', type: 'text' },
            { field: 'title', type: 'text' },
            { field: 'notes', type: 'text' },
            { field: 'budget', type: 'number' },
            { field: 'due_on', type: 'dateString' },
            { field: 'owner_email', type: 'text', format: 'email' },
          ],
        },
        { name: 'tags', fields: [{ field: 'id', type: 'text', primaryKey: true }, { field: 'name', type: 'text' }] },
        {
          name: 'task_tags',
          fields: [
            { field: 'id', type: 'number', primaryKey: true },
            { field: 'task_id', type: 'relation', relation: { entity: 'tasks', labelField: 'title' } },
            { field: 'tag_id', type: 'relation', relation: { entity: 'tags', labelField: 'name' } },
          ],
        },
      ],
      {
        values: { tasks: { status: [{ value: 'Todo', count: 5 }, { value: 'Done', count: 3 }], title: [{ value: 'A', count: 1 }] } },
        serverIds: (s) => s.name === 'tags',
      },
    )
    expect(specs.map((s) => s.id)).toEqual(['tasks', 'tags'])
    const tasks = specs[0]!
    expect(tasks.primaryField).toBe('title')
    expect(tasks.columns.map((d) => [d.field, d.fieldType])).toEqual([
      ['title', 'text'],
      ['status', 'singleSelect'],
      ['notes', 'longText'],
      ['budget', 'number'],
      ['due_on', 'date'],
      ['owner_email', 'email'],
      ['tags', 'link'],
    ])
    expect(tasks.columns[1]!.fieldProps.options.map((o: { value: string }) => o.value)).toEqual(['Todo', 'Done'])
    expect(tasks.columns[3]!.fieldProps.format).toBe('currency')
    expect(tasks.links).toEqual({ tags: { through: 'task_tags', from: 'task_id', to: 'tag_id' } })
    expect(tasks.views!.map((v) => v.type)).toEqual(['grid', 'kanban', 'calendar'])
    // The tags table links back to its tasks; the database makes its keys.
    expect(specs[1]!.columns.find((d) => d.fieldType === 'link')).toMatchObject({ fieldProps: { table: 'tasks', inverse: 'tags' } })
    expect(specs[1]!.serverIds).toBe(true)
    expect(JSON.parse(JSON.stringify(specs))).toEqual(specs)
  })
})
