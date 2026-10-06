/**
 * A `ServerDataSource` whose rows live in a Web Worker.
 *
 * Sorting, filtering, grouping and aggregating a few hundred thousand rows
 * takes long enough on the main thread that scrolling and typing stop while
 * it runs. This moves that work into a worker and lets the grid treat the
 * worker as a server: `createServerRowModel` (or the free
 * `createServerDataSource`) asks for one block of rows at a time, the worker
 * answers with just that block, and the full array never crosses back.
 *
 * Inside the worker the requests run through `createInMemoryDataSource`, the
 * reference implementation of the datasource contract, so the answers are the
 * ones every other backend is tested against.
 *
 * ```ts
 * // grid.worker.ts
 * import { serveWorkerDataSource } from '@svgrid/enterprise/worker'
 * serveWorkerDataSource({ rows: () => fetch('/orders.json').then((r) => r.json()) })
 *
 * // App.svelte
 * const worker = new Worker(new URL('./grid.worker.ts', import.meta.url), { type: 'module' })
 * const ctl = createServerRowModel(createWorkerDataSource(worker), { groupBy: ['region'] })
 * ```
 *
 * What it cannot do: run your functions. A worker receives data, not code,
 * so a column's `valueGetter`, `comparator` or custom filter function never
 * reaches it. Sorting and filtering go by field value, as with any server.
 */
import type { RowData } from '@svgrid/grid'
import type { ServerDataSource, ServerRequest, ServerResult } from '@svgrid/grid/server'
import type { EntitySchema } from '../schema'
import type { AggregateBucket, AggregateRequest } from '../sources/aggregate'
import {
  CHANNEL,
  fromWorkerError,
  isChannelMessage,
  type FromWorker,
  type ToWorker,
  type WorkerMethod,
} from '../worker/protocol'
import { nudgeServerRowModel } from './enable'

/** What `createWorkerDataSource` needs from a `Worker`. A `MessagePort` fits too. */
export type WorkerLike = {
  postMessage(message: unknown): void
  addEventListener(type: string, listener: (event: MessageEvent) => void): void
  removeEventListener(type: string, listener: (event: MessageEvent) => void): void
  terminate?(): void
}

export type WorkerDataSourceOptions<TData extends RowData> = {
  /**
   * Rows to copy into the worker. Copying is structured cloning on the main
   * thread, so for a large dataset prefer loading it inside the worker
   * (`serveWorkerDataSource({ rows })`) and leave this out.
   */
  rows?: ReadonlyArray<TData>
  /** Sent with `rows`. Default: the worker's own, or one read off the rows. */
  schema?: EntitySchema<TData>
  /** The row id field, when the schema is inferred. */
  idField?: string
}

export type WorkerDataSource<TData extends RowData> = Required<
  Pick<ServerDataSource<TData>, 'getRows' | 'createRow' | 'updateRow' | 'deleteRow' | 'updateWhere'>
> & {
  /** Group and reduce in the worker, for `SvSchemaChart` and dashboards. */
  getAggregate(request: AggregateRequest): Promise<AggregateBucket[]>
  /** Settles once the worker holds rows: with the row count, or the loader's error. */
  readonly ready: Promise<number>
  /** Replace the worker's rows. Resolves with the new count. */
  setRows(rows: ReadonlyArray<TData>, schema?: EntitySchema<TData>): Promise<number>
  /** Reject what is pending and terminate the worker. The row model's `dispose()` calls it. */
  destroy(): void
}

type Pending = { resolve: (value: unknown) => void; reject: (error: unknown) => void }

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The request was aborted.', 'AbortError')
}

export function createWorkerDataSource<TData extends RowData>(
  worker: WorkerLike,
  options: WorkerDataSourceOptions<TData> = {},
): WorkerDataSource<TData> {
  nudgeServerRowModel()

  let nextId = 1
  let destroyed = false
  // Set once the worker cannot answer any more: it failed to start, its
  // loader threw, or `destroy()` ran. Every later call rejects with it.
  let failure: unknown = null
  const pending = new Map<number, Pending>()

  let resolveReady!: (count: number) => void
  let rejectReady!: (error: unknown) => void
  const ready = new Promise<number>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  // A source nobody awaited `ready` on must not raise an unhandled rejection.
  ready.catch(() => {})

  function failAll(error: unknown): void {
    failure ??= error
    rejectReady(error)
    for (const p of pending.values()) p.reject(error)
    pending.clear()
  }

  function onMessage(event: MessageEvent): void {
    const message = event.data as FromWorker
    if (!isChannelMessage(message)) return
    switch (message.kind) {
      case 'ready':
        resolveReady(message.rowCount)
        break
      case 'failed':
        failAll(fromWorkerError(message.error))
        break
      case 'result': {
        const p = pending.get(message.id)
        if (!p) return // cancelled, or answered after destroy
        pending.delete(message.id)
        if (message.ok) p.resolve(message.value)
        else p.reject(fromWorkerError(message.error))
        break
      }
    }
  }

  // The worker script failed to load or threw at the top level. Without this
  // every request would wait forever on a worker that is not there.
  function onError(event: Event): void {
    const message = (event as ErrorEvent).message || 'The data source worker failed to start.'
    failAll(new Error(message))
  }

  worker.addEventListener('message', onMessage)
  worker.addEventListener('error', onError)
  ;(worker as { start?: () => void }).start?.()

  function send(message: ToWorker): void {
    worker.postMessage(message)
  }

  function request<T>(
    message: (id: number) => ToWorker,
    signal?: AbortSignal,
  ): Promise<T> {
    if (failure) return Promise.reject(failure)
    if (signal?.aborted) return Promise.reject(abortReason(signal))
    const id = nextId++
    return new Promise<T>((resolve, reject) => {
      const onAbort = (): void => {
        if (!pending.delete(id)) return
        send({ channel: CHANNEL, kind: 'cancel', id })
        reject(abortReason(signal!))
      }
      pending.set(id, {
        resolve: (value) => {
          signal?.removeEventListener('abort', onAbort)
          resolve(value as T)
        },
        reject: (error) => {
          signal?.removeEventListener('abort', onAbort)
          reject(error)
        },
      })
      signal?.addEventListener('abort', onAbort, { once: true })
      send(message(id))
    })
  }

  function call<T>(method: WorkerMethod, args: unknown[], signal?: AbortSignal): Promise<T> {
    return request<T>((id) => ({ channel: CHANNEL, kind: 'call', id, method, args }), signal)
  }

  function load(rows: ReadonlyArray<TData>, schema?: EntitySchema<TData>): Promise<number> {
    return request<number>((id) => ({
      channel: CHANNEL,
      kind: 'load',
      id,
      rows,
      ...(schema ? { schema: schema as unknown as EntitySchema } : {}),
      ...(options.idField ? { idField: options.idField } : {}),
    }))
  }

  if (options.rows) void load(options.rows, options.schema).catch(failAll)

  return {
    getRows(req: ServerRequest): Promise<ServerResult<TData>> {
      // The signal cannot be cloned, and `parentRow` / `context` are app
      // objects the in-memory source never reads; sending them would only
      // risk a DataCloneError.
      const { signal, parentRow: _parentRow, context: _context, ...plain } = req
      return call<ServerResult<TData>>('getRows', [plain], signal)
    },
    createRow: (input) => call('createRow', [input]),
    updateRow: (id, patch) => call('updateRow', [id, patch]),
    deleteRow: (id) => call('deleteRow', [id]),
    updateWhere: (filterModel, patch, selection) => call('updateWhere', [filterModel, patch, selection]),
    getAggregate: (req) => call('getAggregate', [req]),
    ready,
    setRows: (rows, schema) => load(rows, schema ?? options.schema),
    destroy(): void {
      if (destroyed) return
      destroyed = true
      failure = new Error('createWorkerDataSource: the source was destroyed')
      failAll(failure)
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      worker.terminate?.()
    },
  }
}
