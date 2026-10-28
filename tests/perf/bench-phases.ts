/**
 * Main-thread work per operation, for the comparison harness specs.
 *
 * The harness marks the start and end of its scroll and jump phases through
 * `window.__benchPhase` (examples/src/bench/run.ts). This exposes that hook
 * and reads Chrome's own counters at each mark: TaskDuration (everything the
 * renderer's main thread ran), ScriptDuration, and style + layout. Divided by
 * the number of frames or jumps in the phase, that is the work one costs.
 *
 * Why not frame intervals: rAF fires at the display rate (60 Hz headless, and
 * the vsync flags do not lift it on this rig), so a frame that costs 4 ms and
 * one that costs 15 ms both read as one refresh interval.
 */
import type { Page } from '@playwright/test'

export type PhaseWork = {
  taskMs: number
  scriptMs: number
  styleLayoutMs: number
  /**
   * Layout passes and style recalcs per operation. A frame that writes the
   * DOM, reads a geometry and writes again lays out twice; a count above one
   * per frame is that interleaving, whatever the milliseconds say.
   */
  layouts: number
  styleRecalcs: number
}

export async function trackPhases(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  const marks: Record<string, Record<string, number>> = {}
  await page.exposeFunction('__benchPhase', async (label: string) => {
    const { metrics } = (await cdp.send('Performance.getMetrics')) as { metrics: Array<{ name: string; value: number }> }
    marks[label] = Object.fromEntries(metrics.map((m) => [m.name, m.value]))
  })
  return {
    /** Work per operation in phase `name`, or null when the phase did not run. */
    work(name: string, count: number): PhaseWork | null {
      const a = marks[`${name}:start`]
      const b = marks[`${name}:end`]
      if (!a || !b) return null
      const diff = (key: string) => ((b[key] ?? 0) - (a[key] ?? 0)) / count
      return {
        taskMs: diff('TaskDuration') * 1000,
        scriptMs: diff('ScriptDuration') * 1000,
        styleLayoutMs: (diff('RecalcStyleDuration') + diff('LayoutDuration')) * 1000,
        layouts: diff('LayoutCount'),
        styleRecalcs: diff('RecalcStyleCount'),
      }
    },
  }
}

export type HeapMark = {
  /** JS heap in use after a forced full GC, MB. */
  heapMB: number
  /** DOM nodes the renderer holds after that GC, in the document or not. */
  nodes: number
  /** Of those, nodes not in the document: detached, and still referenced. */
  detachedNodes: number
}

/**
 * The harness's `window.__benchHeap(label)`: a full GC, then the JS heap and
 * the node count. Chrome's `Nodes` metric counts every node the renderer
 * still holds; after a GC, the ones not reachable from the document are
 * detached nodes something kept a reference to.
 */
export async function trackHeap(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  const marks: Record<string, HeapMark> = {}
  await page.exposeFunction('__benchHeap', async (label: string) => {
    // Twice: the first pass can leave objects a finalizer or a weak callback
    // frees only for the second.
    await cdp.send('HeapProfiler.collectGarbage')
    await cdp.send('HeapProfiler.collectGarbage')
    const { usedSize } = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number }
    const { metrics } = (await cdp.send('Performance.getMetrics')) as { metrics: Array<{ name: string; value: number }> }
    const nodes = metrics.find((m) => m.name === 'Nodes')?.value ?? NaN
    const { result } = (await cdp.send('Runtime.evaluate', {
      expression: `(() => { let n = 0; const it = document.createNodeIterator(document, NodeFilter.SHOW_ALL); while (it.nextNode()) n++; return n })()`,
      returnByValue: true,
    })) as { result: { value: number } }
    marks[label] = { heapMB: usedSize / 1048576, nodes, detachedNodes: nodes - result.value }
  })
  return { marks }
}
