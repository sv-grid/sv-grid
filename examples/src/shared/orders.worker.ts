/**
 * The worker behind demo 500. It builds the orders table itself, so the rows
 * never pass through the main thread, and serves them to
 * `createWorkerDataSource` on the page.
 *
 * The page says how many rows to build on a message of its own. That message
 * sits beside the data source's channel: `serveWorkerDataSource` ignores
 * anything that is not addressed to it, and holds the grid's requests until
 * the rows exist.
 */
import { serveWorkerDataSource } from '@svgrid/enterprise/worker'
import { makeOrders, ORDER_SCHEMA } from './orders-dataset'

let resolveCount: (count: number) => void = () => {}
const count = new Promise<number>((resolve) => (resolveCount = resolve))

self.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as { type?: string; rows?: number } | null
  if (data?.type === 'orders:init' && typeof data.rows === 'number') resolveCount(data.rows)
})

serveWorkerDataSource({ rows: async () => makeOrders(await count), schema: ORDER_SCHEMA })
