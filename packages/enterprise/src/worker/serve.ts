/**
 * The worker half of `createWorkerDataSource`: holds the rows, answers the
 * grid's requests with the columnar engine (`createColumnarDataSource`, which
 * answers exactly as the in-memory reference source does), and sends back only
 * the rows each request asks for. While no request is waiting, it builds the
 * next column's index, so the first sort on any column finds it ready.
 *
 * ```ts
 * // grid.worker.ts
 * import { serveWorkerDataSource } from '@svgrid/enterprise/worker'
 * serveWorkerDataSource()
 * ```
 *
 * Calls run one at a time, each in its own task, so a `cancel` that arrives
 * while earlier calls are running still reaches the queue before the call it
 * names: a fast scroll skips the blocks it scrolled past instead of computing
 * every one of them.
 */
import type { RowData } from '@svgrid/grid'
import type { EntitySchema } from '../schema'
import { createColumnarDataSource, type ColumnarDataSource } from './columnar'
import { inferSchemaFromRows } from './infer-schema'
import {
  CHANNEL,
  isChannelMessage,
  toWorkerError,
  type FromWorker,
  type ToWorker,
  type WorkerMethod,
} from './protocol'

/** The part of a worker's global scope (or a `MessagePort`) this needs. */
export type WorkerScopeLike = {
  postMessage(message: unknown): void
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void
}

export type ServeWorkerDataSourceOptions<TData extends RowData> = {
  /**
   * The rows, loaded inside the worker: an array, or a function that fetches
   * or builds one. Loading here means a large dataset never passes through
   * the main thread. Omit it to wait for the rows the main thread sends
   * (`createWorkerDataSource(worker, { rows })`).
   */
  rows?: ReadonlyArray<TData> | (() => ReadonlyArray<TData> | Promise<ReadonlyArray<TData>>)
  /** Which fields can be filtered, sorted and grouped, and their types. Default: read off the rows. */
  schema?: EntitySchema<TData>
  /** The row id field, when the schema is inferred. See `inferSchemaFromRows`. */
  idField?: string
  /** Where to listen. Default: the worker's global scope. */
  scope?: WorkerScopeLike
}

type Source = ColumnarDataSource<RowData>
type Call = { id: number; method: WorkerMethod; args: unknown[] }

export function serveWorkerDataSource<TData extends RowData>(
  options: ServeWorkerDataSourceOptions<TData> = {},
): { dispose(): void } {
  const scope = options.scope ?? (globalThis as unknown as WorkerScopeLike)
  let source: Source | null = null
  let disposed = false
  const queue: Call[] = []
  let scheduled = false
  // Whether a column is still waiting to be indexed in idle time.
  let warming = false

  const post = (message: FromWorker): void => {
    if (!disposed) scope.postMessage(message)
  }

  function install(rows: ReadonlyArray<RowData>, schema?: EntitySchema, idField?: string): void {
    const resolved =
      schema ??
      (options.schema as EntitySchema | undefined) ??
      inferSchemaFromRows(rows, { idField: idField ?? options.idField })
    source = createColumnarDataSource(rows, resolved)
    warming = true
    post({ channel: CHANNEL, kind: 'ready', rowCount: rows.length })
    schedule()
  }

  function schedule(): void {
    if (scheduled || disposed || !source || (queue.length === 0 && !warming)) return
    scheduled = true
    setTimeout(drain, 0)
  }

  async function drain(): Promise<void> {
    scheduled = false
    if (!source || disposed) return
    const call = queue.shift()
    if (!call) {
      // Idle: index one more column, then look at the queue again.
      warming = source.warm()
      schedule()
      return
    }
    try {
      const method = source[call.method] as (...args: unknown[]) => Promise<unknown>
      const value = await method(...call.args)
      post({ channel: CHANNEL, kind: 'result', id: call.id, ok: true, value })
    } catch (error) {
      post({ channel: CHANNEL, kind: 'result', id: call.id, ok: false, error: toWorkerError(error) })
    }
    // A write drops the columns; index them again once the queue is empty.
    if (call.method !== 'getRows' && call.method !== 'getAggregate') warming = true
    schedule()
  }

  function onMessage(event: MessageEvent): void {
    const message = event.data as ToWorker
    if (disposed || !isChannelMessage(message)) return
    switch (message.kind) {
      case 'load':
        try {
          install(message.rows as ReadonlyArray<RowData>, message.schema, message.idField)
          post({ channel: CHANNEL, kind: 'result', id: message.id, ok: true, value: message.rows.length })
        } catch (error) {
          post({ channel: CHANNEL, kind: 'result', id: message.id, ok: false, error: toWorkerError(error) })
        }
        break
      case 'call':
        queue.push({ id: message.id, method: message.method, args: message.args })
        schedule()
        break
      case 'cancel': {
        // No reply: the client rejected the call when it sent this.
        const at = queue.findIndex((c) => c.id === message.id)
        if (at >= 0) queue.splice(at, 1)
        break
      }
    }
  }

  scope.addEventListener('message', onMessage)
  // A `MessagePort` delivers nothing until started; a worker scope has no `start`.
  ;(scope as { start?: () => void }).start?.()

  if (options.rows !== undefined) {
    const rows = options.rows
    Promise.resolve()
      .then(() => (typeof rows === 'function' ? rows() : rows))
      .then(
        (loaded) => {
          if (!disposed) install(loaded as ReadonlyArray<RowData>)
        },
        (error: unknown) => post({ channel: CHANNEL, kind: 'failed', error: toWorkerError(error) }),
      )
  }

  return {
    dispose(): void {
      disposed = true
      queue.length = 0
      scope.removeEventListener('message', onMessage)
    },
  }
}
