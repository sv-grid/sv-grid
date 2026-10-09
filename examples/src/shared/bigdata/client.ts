/**
 * The big-data demo's main-thread side: a `ServerDataSource` that asks the
 * worker (big.worker.ts) for row ids and turns each id into a small row
 * object with the named columns. Metric columns are read through `cell()` by
 * their column definitions, so a block of 100 rows x 10,000 columns is 100
 * small objects, not a million values copied across threads.
 */
import type { ServerDataSource, ServerRequest, ServerResult } from '@svgrid/grid'
import { cellValue, columnByField, columnsFor, type BigColumn } from './data'
import type { EngineRequest, EngineResult } from './engine'

export type BigRow = Record<string, unknown> & { id: number }
export type QueryStat = EngineResult['op']
export type Activity = {
  /** The last request the worker answered, and what it cost there. */
  last?: { op: QueryStat; ms: number; rowCount: number; scanned: number; at: number }
  /** The last request that computed something (not served from a cached view). */
  compute?: { op: QueryStat; ms: number; rowCount: number; scanned: number; seq: number }
  /** A long pass in progress (filter / sort / group over many rows). */
  progress?: { phase: string; done: number; total: number }
  /** The last edit: worker time, and how many cached views it patched. */
  edit?: { ms: number; patchedViews: number }
}

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void }

export function createBigDataClient(onActivity: (a: Activity) => void) {
  const worker = new Worker(new URL('./big.worker.ts', import.meta.url), { type: 'module' })
  const pending = new Map<number, Pending>()
  let nextId = 1
  let activity: Activity = {}
  const set = (patch: Partial<Activity>) => {
    activity = { ...activity, ...patch }
    onActivity(activity)
  }

  worker.onmessage = (event: MessageEvent) => {
    const msg = event.data
    if (msg.kind === 'progress') {
      set({ progress: { phase: msg.phase, done: msg.done, total: msg.total } })
      return
    }
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.ok) p.resolve(msg.value)
    else p.reject(new Error(msg.error))
  }

  function call<T>(method: string, args: unknown[]): Promise<T> {
    const id = nextId++
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      worker.postMessage({ id, method, args })
    })
  }

  /** The named columns in this size (id, name, ... total), set on the row object. */
  let named: BigColumn[] = []
  let byField = new Map<string, BigColumn>()
  const edits = new Map<number, Record<string, unknown>>()
  /** Row objects by id, so a row read twice is the same object. Bounded. */
  const rows = new Map<number, BigRow>()

  function rowOf(id: number): BigRow {
    let row = rows.get(id)
    if (row) return row
    // A plain object with the named columns (at most 25 values). The metric
    // columns (up to 10,000) are not on the row: their column definitions read
    // them through `cell()`, so a row never carries thousands of properties.
    row = { id: id + 1, __rowIndex: id } as BigRow
    for (const col of named) row[col.field] = cellValue(col, id, edits)
    rows.set(id, row)
    if (rows.size > 20_000) {
      let drop = 5_000
      for (const key of rows.keys()) {
        if (drop-- <= 0) break
        rows.delete(key)
      }
    }
    return row
  }

  function toEngineRequest(req: ServerRequest): EngineRequest {
    return {
      startRow: req.startRow,
      endRow: req.endRow,
      sortModel: (req.sortModel ?? []).map((s: any) => ({ id: s.id ?? s.colId, desc: !!s.desc })),
      filterModel: req.filterModel as EngineRequest['filterModel'],
      groupBy: req.groupBy,
      groupKeys: req.groupKeys,
    }
  }

  const source: ServerDataSource<BigRow> = {
    async getRows(req: ServerRequest): Promise<ServerResult<BigRow>> {
      const t0 = performance.now()
      const result = await call<EngineResult>('getRows', [toEngineRequest(req)])
      const last = { op: result.op, ms: result.ms, rowCount: result.rowCount, scanned: result.scanned, at: performance.now() - t0 }
      const computed = result.op !== 'cached' && result.op !== 'identity'
      set({
        last,
        progress: undefined,
        ...(computed ? { compute: { ...last, seq: (activity.compute?.seq ?? 0) + 1 } } : {}),
      })
      if (result.groups) return { rows: result.groups as BigRow[], rowCount: result.rowCount }
      return { rows: result.ids!.map(rowOf), rowCount: result.rowCount }
    },
    async updateRow(id: string, patch: Partial<BigRow>): Promise<BigRow> {
      const row = Number(id) - 1
      edits.set(row, { ...(edits.get(row) ?? {}), ...patch })
      const r = await call<{ ms: number; patchedViews: number }>('updateRow', [row, patch])
      set({ edit: r })
      rows.delete(row) // a new object, so the row model sees the change
      return rowOf(row)
    },
  }

  return {
    source,
    /** Size the dataset. Clears edits; the caller re-creates its row model. */
    async configure(rowCount: number, columnCount: number): Promise<void> {
      const cols = columnsFor(columnCount)
      named = cols.filter((c) => c.field !== 'id' && !/^m\d+$/.test(c.field))
      byField = new Map(cols.map((c) => [c.field, c]))
      edits.clear()
      rows.clear()
      activity = {}
      await call('configure', [rowCount, columnCount])
    },
    columnByField,
    /** Requests sent to the worker and not answered yet. */
    pending: () => pending.size,
    /** A cell of a leaf row by field, edits applied; undefined on group rows. */
    cell(row: Record<string, unknown>, field: string): unknown {
      const index = row.__rowIndex
      if (typeof index !== 'number') return undefined
      const col = byField.get(field)
      return col ? cellValue(col, index, edits) : undefined
    },
    dispose(): void {
      worker.terminate()
      for (const p of pending.values()) p.reject(new Error('disposed'))
      pending.clear()
    },
  }
}

export type BigDataClient = ReturnType<typeof createBigDataClient>
