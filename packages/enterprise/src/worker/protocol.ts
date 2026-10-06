/**
 * The messages between `createWorkerDataSource` (main thread) and
 * `serveWorkerDataSource` (inside the worker). Internal: both ends ship in
 * the same package version, so the shape can change without a migration.
 *
 * Every message carries `channel`, so a worker that also answers messages of
 * its own can host the data source beside them; each end ignores anything
 * without it.
 */
import type { EntitySchema } from '../schema'

export const CHANNEL = 'svgrid-worker-data-source' as const

/** The data source methods the client may call across the boundary. */
export type WorkerMethod =
  | 'getRows'
  | 'createRow'
  | 'updateRow'
  | 'deleteRow'
  | 'updateWhere'
  | 'getAggregate'

/** Main thread to worker. */
export type ToWorker =
  /** Replace the dataset. Answered with a `result` carrying the row count. */
  | {
      channel: typeof CHANNEL
      kind: 'load'
      id: number
      rows: ReadonlyArray<unknown>
      schema?: EntitySchema
      idField?: string
    }
  | { channel: typeof CHANNEL; kind: 'call'; id: number; method: WorkerMethod; args: unknown[] }
  /** Drop a queued call: its block was evicted, or the sort or filter moved on. */
  | { channel: typeof CHANNEL; kind: 'cancel'; id: number }

/** An error as it crosses the boundary: an `Error` does not survive cloning intact everywhere. */
export type WorkerError = { name: string; message: string }

/** Worker to main thread. */
export type FromWorker =
  /** The worker holds data and answers calls. Sent after every load. */
  | { channel: typeof CHANNEL; kind: 'ready'; rowCount: number }
  /** The worker's own `rows` loader threw: nothing will ever be answered. */
  | { channel: typeof CHANNEL; kind: 'failed'; error: WorkerError }
  | { channel: typeof CHANNEL; kind: 'result'; id: number; ok: true; value: unknown }
  | { channel: typeof CHANNEL; kind: 'result'; id: number; ok: false; error: WorkerError }

export function toWorkerError(error: unknown): WorkerError {
  if (error instanceof Error) return { name: error.name, message: error.message }
  return { name: 'Error', message: String(error) }
}

export function fromWorkerError(error: WorkerError): Error {
  const out = new Error(error.message)
  out.name = error.name
  return out
}

export function isChannelMessage(data: unknown): data is { channel: typeof CHANNEL; kind: string } {
  return typeof data === 'object' && data !== null && (data as { channel?: unknown }).channel === CHANNEL
}
