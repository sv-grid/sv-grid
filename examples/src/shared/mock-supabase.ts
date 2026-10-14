/**
 * A stand-in for a Supabase project, in the page: the slice of `supabase-js`
 * the SvGrid sources call (`from().select/insert/update/delete` with filters,
 * order and range, and realtime channels), over tables in memory.
 *
 * `createMockSupabase(project)` hands out a client; several clients on one
 * project are several browsers on one database. A write from any of them
 * reaches every realtime channel, the way Postgres changes reach Supabase
 * Realtime subscribers. A new row gets a uuid, as a `default
 * gen_random_uuid()` key would. In an app, `createClient(url, anonKey)` from
 * `@supabase/supabase-js` takes its place.
 */
type Row = Record<string, unknown>
type Listener = { table: string; cb: (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: Row | null; old: Row | null }) => void }

export type MockProject = {
  tables: Record<string, Row[]>
  listeners: Set<Listener>
  /** Milliseconds each request takes. */
  latency: number
}

export function createMockProject(seed: Record<string, Row[]>, latency = 180): MockProject {
  return { tables: Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))])), listeners: new Set(), latency }
}

type Result = { data: unknown; count?: number | null; error: { message: string } | null }

export function createMockSupabase(project: MockProject, options: { offline?: () => boolean; onRequest?: (line: string) => void } = {}) {
  const wait = () => new Promise((r) => setTimeout(r, project.latency))
  const notify = (table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', next: Row | null, old: Row | null) => {
    for (const l of project.listeners) if (l.table === table) setTimeout(() => l.cb({ eventType, new: next, old }), 30)
  }
  const fail = (): Result | null => (options.offline?.() ? { data: null, error: { message: 'Failed to fetch (offline)' } } : null)

  function from(table: string) {
    const rows = () => (project.tables[table] ??= [])
    const tests: Array<(r: Row) => boolean> = []
    const orders: Array<{ col: string; asc: boolean }> = []
    let range: [number, number] | null = null
    let action: { kind: 'select' } | { kind: 'insert'; values: Row } | { kind: 'update'; patch: Row } | { kind: 'delete' } = { kind: 'select' }
    let single = false

    async function run(): Promise<Result> {
      await wait()
      const down = fail()
      if (down) return down
      const hit = rows().filter((r) => tests.every((t) => t(r)))
      switch (action.kind) {
        case 'select': {
          const sorted = [...hit].sort((a, b) => {
            for (const o of orders) {
              const x = a[o.col] as never
              const y = b[o.col] as never
              if (x !== y) return (x < y ? -1 : 1) * (o.asc ? 1 : -1)
            }
            return 0
          })
          const page = range ? sorted.slice(range[0], range[1] + 1) : sorted
          options.onRequest?.(`GET /rest/v1/${table}?select=*${range ? `&offset=${range[0]}&limit=${range[1] - range[0] + 1}` : ''}`)
          return { data: page.map((r) => ({ ...r })), count: hit.length, error: null }
        }
        case 'insert': {
          const row = { id: crypto.randomUUID(), ...action.values }
          rows().push(row)
          options.onRequest?.(`POST /rest/v1/${table} ${JSON.stringify(action.values)}`)
          notify(table, 'INSERT', { ...row }, null)
          return { data: single ? { ...row } : [{ ...row }], error: null }
        }
        case 'update': {
          const patch = action.patch
          for (const r of hit) {
            const old = { ...r }
            Object.assign(r, patch)
            notify(table, 'UPDATE', { ...r }, old)
          }
          options.onRequest?.(`PATCH /rest/v1/${table}?id=eq.${String(hit[0]?.id ?? '')} ${JSON.stringify(patch)}`)
          return { data: single ? (hit[0] ? { ...hit[0] } : null) : hit.map((r) => ({ ...r })), error: null }
        }
        case 'delete': {
          project.tables[table] = rows().filter((r) => !hit.includes(r))
          for (const r of hit) notify(table, 'DELETE', null, { id: r.id })
          options.onRequest?.(`DELETE /rest/v1/${table}?id=eq.${String(hit[0]?.id ?? '')}`)
          return { data: null, error: null }
        }
      }
    }

    const q = {
      select(_columns?: string, _opts?: unknown) {
        return q
      },
      insert(values: Row) {
        action = { kind: 'insert', values }
        return q
      },
      update(patch: Row) {
        action = { kind: 'update', patch }
        return q
      },
      delete() {
        action = { kind: 'delete' }
        return q
      },
      eq(col: string, v: unknown) {
        tests.push((r) => String(r[col]) === String(v))
        return q
      },
      in(col: string, vs: unknown[]) {
        tests.push((r) => vs.map(String).includes(String(r[col])))
        return q
      },
      ilike(col: string, pattern: string) {
        const needle = pattern.replace(/%/g, '').toLowerCase()
        tests.push((r) => String(r[col] ?? '').toLowerCase().includes(needle))
        return q
      },
      gt(col: string, v: unknown) {
        tests.push((r) => (r[col] as never) > (v as never))
        return q
      },
      lt(col: string, v: unknown) {
        tests.push((r) => (r[col] as never) < (v as never))
        return q
      },
      gte(col: string, v: unknown) {
        tests.push((r) => (r[col] as never) >= (v as never))
        return q
      },
      lte(col: string, v: unknown) {
        tests.push((r) => (r[col] as never) <= (v as never))
        return q
      },
      is(col: string, v: unknown) {
        tests.push((r) => (r[col] ?? null) === v)
        return q
      },
      or() {
        return q
      },
      order(col: string, opts?: { ascending?: boolean }) {
        orders.push({ col, asc: opts?.ascending !== false })
        return q
      },
      range(a: number, b: number) {
        range = [a, b]
        return q
      },
      single() {
        single = true
        return q
      },
      then<T>(resolve: (r: Result) => T, reject?: (e: unknown) => T) {
        return run().then(resolve, reject)
      },
    }
    return q
  }

  return {
    from,
    channel(_name: string) {
      const mine: Listener[] = []
      const ch = {
        on(_type: 'postgres_changes', filter: Record<string, unknown>, cb: Listener['cb']) {
          mine.push({ table: String(filter.table), cb: (p) => { if (!options.offline?.()) cb(p) } })
          return ch
        },
        subscribe(status?: (s: string) => void) {
          for (const l of mine) project.listeners.add(l)
          status?.('SUBSCRIBED')
          return ch
        },
        _listeners: mine,
      }
      return ch
    },
    removeChannel(ch: { _listeners?: Listener[] }) {
      for (const l of ch._listeners ?? []) project.listeners.delete(l)
    },
  }
}
