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

export type PhaseWork = { taskMs: number; scriptMs: number; styleLayoutMs: number }

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
      const per = (key: string) => (((b[key] ?? 0) - (a[key] ?? 0)) * 1000) / count
      return {
        taskMs: per('TaskDuration'),
        scriptMs: per('ScriptDuration'),
        styleLayoutMs: per('RecalcStyleDuration') + per('LayoutDuration'),
      }
    },
  }
}
