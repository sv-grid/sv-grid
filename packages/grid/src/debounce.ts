/**
 * debounce - coalesce rapid calls into one trailing call after `ms` of quiet.
 * Used for remote search in the async dropdowns (SvMultiSelect/GridSelect/...),
 * but general-purpose. Returns the debounced function with `cancel()` (drop the
 * pending call) and `flush()` (run it now). Framework-free + pure.
 */
export type Debounced<A extends unknown[]> = ((...args: A) => void) & {
  cancel: () => void
  flush: () => void
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: A | null = null

  const run = () => {
    timer = null
    const args = pending
    pending = null
    if (args) fn(...args)
  }

  const debounced = ((...args: A) => {
    pending = args
    if (timer) clearTimeout(timer)
    timer = setTimeout(run, ms)
  }) as Debounced<A>

  debounced.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    pending = null
  }
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer)
      run()
    }
  }
  return debounced
}
