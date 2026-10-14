/**
 * A base from a real Postgres (PGlite): tables, fields, choices, links and a
 * junction read from the database as it is; the endpoint and the page that
 * reads it; and an edit written back.
 */
import { describe, expect, it, vi } from 'vitest'

// Each test boots a Postgres (PGlite): seconds on a busy machine.
vi.setConfig({ testTimeout: 60_000 })
import { PGlite } from '@electric-sql/pglite'
import { enableFields } from './index'
import { baseFromDatabase, baseFromEndpoint, createBaseEndpoint, describeDatabase } from './base-connect'
import { createBaseSync } from './base-sync'
import type { BaseTable } from './base-tables'

enableFields()

const SQL = `
create table people (id serial primary key, name text not null, email text);
create table projects (id text primary key default gen_random_uuid()::text, name text not null, budget numeric);
create table tasks (
  id serial primary key, title text not null, status text, due_on date, notes text,
  project_id text references projects(id), owner_id int references people(id)
);
create table tags (id serial primary key, name text not null);
create table task_tags (id serial primary key, task_id int references tasks(id), tag_id int references tags(id));
insert into people (name, email) values ('Ana', 'ana@example.com'), ('Ben', 'ben@example.com');
insert into projects (id, name, budget) values ('p1', 'Launch', 24000);
insert into tasks (title, status, due_on, project_id, owner_id) values
  ('Brief', 'Todo', '2026-10-01', 'p1', 1), ('Site', 'Done', '2026-10-05', 'p1', 2), ('Email', 'Todo', null, null, 1), ('Docs', 'Done', null, null, 2);
insert into tags (name) values ('Design'), ('Risk');
insert into task_tags (task_id, tag_id) values (1, 1), (1, 2), (2, 1);
`

async function database() {
  const db = new PGlite()
  await db.exec(SQL)
  const execute = async (sql: string, params: unknown[]) => (await db.query(sql, params)).rows as Record<string, unknown>[]
  return { db, execute }
}

describe('a base from a database', () => {
  it('reads every table as it is: fields, links, a junction, choices, keys and views', async () => {
    const { execute } = await database()
    const specs = await describeDatabase({ execute })
    // Tasks link to the most others, so they lead; the junction table is not a tab.
    expect(specs.map((s) => s.id)).toEqual(['tasks', 'people', 'projects', 'tags'])
    const tasks = specs[0]!
    expect(tasks.columns.map((d) => [d.field, d.fieldType])).toEqual([
      ['title', 'text'],
      ['status', 'singleSelect'],
      ['due_on', 'date'],
      ['notes', 'longText'],
      ['project', 'link'],
      ['owner', 'link'],
      ['tags', 'link'],
    ])
    expect(tasks.links).toMatchObject({ project: { column: 'project_id' }, owner: { column: 'owner_id' }, tags: { through: 'task_tags', from: 'task_id', to: 'tag_id' } })
    // A serial key and a uuid default: the database makes both.
    expect(tasks.serverIds).toBe(true)
    expect(specs.find((s) => s.id === 'projects')!.serverIds).toBe(true)
    expect(specs.find((s) => s.id === 'projects')!.columns.find((d) => d.field === 'budget')!.fieldProps.format).toBe('currency')
    expect(tasks.views!.map((v) => v.type)).toEqual(['grid', 'kanban', 'calendar'])
  })

  it('loads the records, writes an edit back, and reads the junction', async () => {
    const { db, execute } = await database()
    let tables: BaseTable[] = await baseFromDatabase({ execute })
    const sync = createBaseSync({ getTables: () => tables, apply: (n) => (tables = n) })
    await sync.load()
    const tasks = () => tables.find((t) => t.id === 'tasks')!
    const brief = tasks().data.find((r) => r.title === 'Brief')!
    expect(brief).toMatchObject({ status: 'Todo', due_on: '2026-10-01', project: ['p1'] })
    expect((brief.tags as string[]).length).toBe(2)
    // People list the tasks they own: the field that links back.
    expect(tables.find((t) => t.id === 'people')!.data.find((r) => r.name === 'Ana')!.tasks).toHaveLength(2)
    tables = tables.map((t) => (t.id === 'tasks' ? { ...t, data: t.data.map((r) => (r === brief ? { ...r, status: 'Done' } : r)) } : t))
    sync.push(tables)
    await sync.settled()
    expect((await db.query(`select status from tasks where title = 'Brief'`)).rows[0]).toEqual({ status: 'Done' })
  })

  it('serves the base from an endpoint and reads it in the page', async () => {
    const { db, execute } = await database()
    const endpoint = createBaseEndpoint({ execute })
    // The page's fetch reaches the endpoint's GET and POST.
    const fetch = (async (input: string | URL, init?: RequestInit) => {
      const request = new Request(new URL(String(input), 'http://app.local'), init)
      return request.method === 'GET' ? endpoint.GET() : endpoint.POST({ request })
    }) as typeof globalThis.fetch
    let tables = await baseFromEndpoint('/api/base', { fetch })
    expect(tables.map((t) => t.name)).toEqual(['Tasks', 'People', 'Projects', 'Tags'])
    const sync = createBaseSync({ getTables: () => tables, apply: (n) => (tables = n) })
    await sync.load()
    const email = tables[0]!.data.find((r) => r.title === 'Email')!
    tables = tables.map((t, i) => (i === 0 ? { ...t, data: t.data.map((r) => (r === email ? { ...r, notes: 'Send Friday' } : r)) } : t))
    sync.push(tables)
    await sync.settled()
    expect((await db.query(`select notes from tasks where title = 'Email'`)).rows[0]).toEqual({ notes: 'Send Friday' })
    // A table it did not describe is not reachable.
    const res = await endpoint.POST({ request: new Request('http://app.local/api/base?table=pg_user', { method: 'POST', body: '{}' }) })
    expect(res.status).toBe(404)
  })
})
