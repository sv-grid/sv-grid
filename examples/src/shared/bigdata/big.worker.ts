/**
 * The big-data demo's worker: runs the query engine (engine.ts) off the main
 * thread. Requests run one at a time in arrival order; long passes report
 * progress so the page can show it.
 */
import { createEngine, type EngineRequest } from './engine'

type Call =
  | { id: number; method: 'configure'; args: [rows: number, cols: number] }
  | { id: number; method: 'getRows'; args: [EngineRequest] }
  | { id: number; method: 'updateRow'; args: [row: number, patch: Record<string, unknown>] }

const scope = self as unknown as {
  postMessage(message: unknown): void
  onmessage: ((event: MessageEvent<Call>) => void) | null
}

let current = 0
const engine = createEngine((phase, done, total) => {
  scope.postMessage({ kind: 'progress', id: current, phase, done, total })
})

scope.onmessage = (event) => {
  const call = event.data
  current = call.id
  try {
    let value: unknown
    if (call.method === 'configure') {
      engine.configure(call.args[0], call.args[1])
      value = engine.size()
    } else if (call.method === 'getRows') {
      value = engine.getRows(call.args[0])
    } else {
      value = engine.updateRow(call.args[0], call.args[1])
    }
    scope.postMessage({ kind: 'result', id: call.id, ok: true, value })
  } catch (error) {
    const e = error as Error
    scope.postMessage({ kind: 'result', id: call.id, ok: false, error: `${e.name}: ${e.message}` })
  }
}
