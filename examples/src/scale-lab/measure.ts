/** Timing helpers shared by the scale lab panels. */

/** Resolve after the next frame has painted (two rAFs: the one that renders, then one after it). */
export function afterPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

/**
 * Watch the main thread while something runs: the longest gap between two
 * animation frames is how long the page stopped responding. Call the returned
 * function to stop and read it.
 */
export function watchFreeze(): () => number {
  let last = performance.now()
  let max = 0
  let on = true
  const tick = (t: number) => {
    max = Math.max(max, t - last)
    last = t
    if (on) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  return () => {
    on = false
    return Math.max(max, performance.now() - last)
  }
}

export type Timing = { ms: number; freezeMs: number; error?: string }

/** Time an action up to the frame after it painted, and the longest freeze while it ran. */
export async function timeAction(fn: () => unknown | Promise<unknown>): Promise<Timing> {
  await afterPaint()
  const stop = watchFreeze()
  const t0 = performance.now()
  try {
    await fn()
    await afterPaint()
    return { ms: performance.now() - t0, freezeMs: stop() }
  } catch (e) {
    return { ms: performance.now() - t0, freezeMs: stop(), error: `${(e as Error).name}: ${(e as Error).message}` }
  }
}

export const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`)
export const fmtInt = (n: number) => n.toLocaleString('en-US')
export const fmtBytes = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${(n / 1e3).toFixed(0)} KB`

/** Let the browser breathe between heavy steps so a status line can render. */
export const tick = () => new Promise((r) => setTimeout(r, 0))
