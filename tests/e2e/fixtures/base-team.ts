/**
 * Bases on one database in the page, for the specs that need a teammate or a server that
 * says no (base-team.spec.ts). Not a demo: the spec loads it into a page itself.
 *
 * `show(way)` mounts them:
 *  - `steps`, `tx`, `endpoint`: Ana and Ben side by side on one Postgres (PGlite), with
 *    customers and orders that link to them, both tables marking deleted records. `steps`
 *    is `baseFromDatabase` with no transaction, so the page runs a purge's steps; `tx` gives
 *    it a `transaction`; `endpoint` reads through `createBaseEndpoint` with a transaction.
 *  - `hard`: one base on a Kit route whose table deletes for real, every request logged.
 *  - `rls`: one base on Supabase (the in-page project of demo 517) whose row level policy
 *    lets Ana update only her own tasks, answered as PostgREST answers it.
 *
 * `window.__team` holds `sql` (a statement on the database), `faults` (stall or fail the
 * next statement that matches), `ops` (the Kit route's requests) and `requests` (Supabase's).
 */
import { mount } from 'svelte'
import { PGlite } from '@electric-sql/pglite'
import '../../../examples/src/gallery-license'
import { SvBase, baseFromDatabase, baseFromEndpoint, baseSource, createBaseEndpoint, enableBase, type BaseTable } from '@svgrid/enterprise/base'
import { createKitDataSource, createKitHandlers, createSqlDataSource, createSupabaseDataSource } from '@svgrid/enterprise'
import { createMockProject, createMockSupabase } from '../../../examples/src/shared/mock-supabase'

type Row = Record<string, unknown>
type Way = 'steps' | 'tx' | 'endpoint' | 'hard' | 'rls'

enableBase()

const faults = {
  /** The next statement this matches waits for `release()`; `stalled` says it is waiting. */
  stallOn: null as string | null,
  stalled: false,
  release: null as null | (() => void),
  /** The next statement this matches fails, as a server going away would. */
  failOn: null as string | null,
}
async function hit(text: string) {
  if (faults.failOn && new RegExp(faults.failOn, 'i').test(text)) {
    faults.failOn = null
    throw new Error('server restarting')
  }
  if (faults.stallOn && new RegExp(faults.stallOn, 'i').test(text)) {
    faults.stallOn = null
    faults.stalled = true
    await new Promise<void>((go) => (faults.release = go))
  }
}

const SCHEMA = `
  create table p_cust (id text primary key, name text not null default '', deleted_at timestamptz);
  create table p_ord (id text primary key, name text not null default '', cust_id text references p_cust(id), deleted_at timestamptz);
  insert into p_cust (id, name) values ('c1', 'Acme'), ('c2', 'Bolt');
  insert into p_ord (id, name, cust_id) values ('o1', 'Order 1', 'c1'), ('o2', 'Order 2', 'c1'), ('o3', 'Order 3', 'c2');
  create table h_task (id text primary key, name text not null default '', note text);
  insert into h_task (id, name, note) values ('t1', 'Write the brief', 'draft'), ('t2', 'Book the room', 'none');
`

function place(name: string, tables: BaseTable[]): void {
  const box = document.createElement('section')
  box.className = `team-${name}`
  box.setAttribute('aria-label', name)
  box.style.cssText = 'display:inline-block;vertical-align:top;width:49%;margin-right:1%'
  document.body.append(box)
  const state = { tables }
  const w = window as unknown as { __team: { api: Record<string, unknown> } }
  mount(SvBase as never, {
    target: box,
    props: {
      get tables() { return state.tables },
      set tables(v: BaseTable[]) { state.tables = v },
      editable: true,
      containerHeight: 360,
      onApiReady: (api: unknown) => (w.__team.api[name] = api),
    },
  })
}

export async function show(way: Way): Promise<void> {
  document.body.replaceChildren()
  faults.stallOn = faults.failOn = null
  faults.stalled = false
  const ops: string[] = []
  const requests: string[] = []
  const db = new PGlite()
  await db.exec(SCHEMA)
  const sql = async (text: string, params: unknown[] = []) => (await db.query(text, params as never[])).rows as Row[]
  const execute = async (text: string, params: unknown[] = []) => {
    await hit(text)
    return sql(text, params)
  }
  const transaction = (<T>(run: (e: typeof execute) => Promise<T>) => db.transaction((tx) => run(async (text, params = []) => {
    await hit(text)
    return (await tx.query(text, params as never[])).rows as Row[]
  }))) as never
  ;(window as unknown as { __team: unknown }).__team = { sql, faults, ops, requests, api: {} }
  const tables = ['p_cust', 'p_ord']

  if (way === 'steps' || way === 'tx') {
    const options = { dialect: 'postgres', execute, tables, softDelete: 'deleted_at', ...(way === 'tx' ? { transaction } : {}) } as never
    place('ana', await baseFromDatabase(options))
    place('ben', await baseFromDatabase(options))
    return
  }
  if (way === 'endpoint') {
    const ep = createBaseEndpoint({ dialect: 'postgres', execute, tables, softDelete: 'deleted_at', transaction, authorize: () => () => true } as never)
    const fetcher = ((url: string, init?: RequestInit) => {
      const request = new Request(new URL(String(url), 'http://app.local/api'), init)
      return request.method === 'GET' ? ep.GET({ request } as never) : ep.POST({ request } as never)
    }) as never
    place('ana', await baseFromEndpoint('/api', { fetch: fetcher }))
    place('ben', await baseFromEndpoint('/api', { fetch: fetcher }))
    return
  }
  if (way === 'hard') {
    const schema = { name: 'h_task', idField: 'id', fields: [{ field: 'id', type: 'text', primaryKey: true }, { field: 'name', type: 'text' }, { field: 'note', type: 'text' }] } as never
    const handlers = createKitHandlers({ schema, source: createSqlDataSource({ schema, table: 'h_task', dialect: { placeholders: '$', ilike: true } as never, execute: execute as never }) })
    const ds = createKitDataSource({
      endpoint: 'http://app.local/h_task',
      fetch: (async (url: string, init?: RequestInit) => {
        const body = init?.body ? (JSON.parse(String(init.body)) as Row) : {}
        const res = await handlers.handle(new Request(String(url), init))
        ops.push(`${init?.method ?? 'GET'} ${String(body.op ?? body.kind ?? '')} ${res.status}`)
        return res
      }) as never,
    })
    place('ana', [{ id: 'h_task', name: 'Tasks', primaryField: 'name', data: [], columns: [{ id: 'name', field: 'name', header: 'Name', fieldType: 'text' }, { id: 'note', field: 'note', header: 'Note', fieldType: 'text' }], source: baseSource(ds as never) } as never])
    return
  }
  // A row level policy: Ana may update her own tasks. PostgREST skips any other row,
  // and `.single()` then answers PGRST116, no row to hand back.
  const project = createMockProject({
    r_task: [
      { id: 'r1', name: 'Ana task', note: 'hers', owner: 'ana' },
      { id: 'r2', name: 'Ben task', note: 'his', owner: 'ben' },
    ],
  }, 20)
  const client = withPolicy(createMockSupabase(project, { onRequest: (line) => requests.push(line) }), project, (row) => row.owner === 'ana')
  ;(window as unknown as { __team: { project: unknown } }).__team.project = project
  const schema = { name: 'r_task', idField: 'id', fields: [{ field: 'id', type: 'text', primaryKey: true }, { field: 'name', type: 'text' }, { field: 'note', type: 'text' }, { field: 'owner', type: 'text' }] } as never
  place('ana', [{ id: 'r_task', name: 'Tasks', primaryField: 'name', data: [], columns: [{ id: 'name', field: 'name', header: 'Name', fieldType: 'text' }, { id: 'note', field: 'note', header: 'Note', fieldType: 'text' }], source: baseSource(createSupabaseDataSource({ client: client as never, table: 'r_task', schema, serverIds: false }) as never) } as never])
}

/** The client with a row level policy on updates, as PostgREST applies one. */
function withPolicy(client: ReturnType<typeof createMockSupabase>, project: ReturnType<typeof createMockProject>, mayUpdate: (row: Row) => boolean) {
  return {
    ...client,
    from(table: string) {
      const q = client.from(table) as unknown as Record<string | symbol, unknown>
      let updating = false
      let single = false
      const ids: string[] = []
      const proxy: unknown = new Proxy(q, {
        get(target, prop) {
          if (prop === 'then') {
            return (ok: (r: unknown) => unknown, bad: (e: unknown) => unknown) => {
              const rows = (project.tables[table] ?? []).filter((r) => ids.includes(String(r.id)))
              if (updating && rows.some((r) => !mayUpdate(r))) {
                const refused = single ? { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows' } } : { data: [], error: null }
                return new Promise((r) => setTimeout(r, project.latency)).then(() => refused).then(ok, bad)
              }
              return (target.then as (a: unknown, b: unknown) => unknown)(ok, bad)
            }
          }
          const v = target[prop]
          if (typeof v !== 'function') return v
          return (...args: unknown[]) => {
            if (prop === 'update') updating = true
            if (prop === 'single') single = true
            if (prop === 'eq' && args[0] === 'id') ids.push(String(args[1]))
            if (prop === 'in' && args[0] === 'id') ids.push(...(args[1] as unknown[]).map(String))
            const out = (v as (...a: unknown[]) => unknown).apply(target, args)
            return out === target ? proxy : out
          }
        },
      })
      return proxy
    },
  }
}
