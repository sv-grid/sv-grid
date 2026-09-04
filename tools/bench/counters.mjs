/**
 * Work counters: the half of this suite that CI can gate.
 *
 * Wall-clock on a shared runner is too noisy to fail a build on, and a flaky
 * perf gate gets disabled within a month. So the numbers CI enforces are counts
 * of work done, which are identical on every machine.
 *
 * These count exactly the things that regressed unnoticed:
 *
 *   - `getAllColumns` inside the sort comparator. core.ts resolves the clause's
 *     column with an Array.find PER COMPARISON, so a 100k single-clause sort
 *     runs it ~1.7M times instead of once.
 *   - `getAllCells` during filtering. Rows memoize their Cell[] lazily so a
 *     100k-row grid never materialises 900k cell objects; the filter path calls
 *     getAllCells().find(...) per row and undoes exactly that.
 *   - Row-model pipeline runs while only the selection changes. `rowSelection`
 *     sits in the row-model cache key, so ticking one checkbox re-runs filter
 *     and sort over the whole dataset.
 *
 * A count is a claim about the algorithm, not about the hardware.
 */

/** Method names worth counting, per receiver kind. */
const TABLE_METHODS = ['getAllColumns', 'getRowModel']
const ROW_METHODS = ['getAllCells', 'getCellValueByColumnId', 'getValue']

export function newCounters() {
  return Object.create(null)
}

function bump(counters, key) {
  counters[key] = (counters[key] ?? 0) + 1
}

/**
 * Wrap a receiver so calls to `methods` are tallied under `prefix.name`.
 *
 * A `get` trap that returns a bound wrapper only for the named methods, and
 * forwards everything else untouched - the proxy has to stay invisible to the
 * code under test or we would be measuring the instrument.
 */
function countingProxy(target, methods, counters, prefix) {
  const cache = new Map()
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver)
      if (typeof value !== 'function' || !methods.includes(prop)) return value
      let wrapped = cache.get(prop)
      if (!wrapped) {
        wrapped = (...args) => {
          bump(counters, prefix + '.' + prop)
          return value.apply(obj, args)
        }
        cache.set(prop, wrapped)
      }
      return wrapped
    },
  })
}

/**
 * Instrument ONE row-model stage.
 *
 * Stages receive `{ table, rows }` from the core, so there is no way to observe
 * them from outside - but there is from in front. This swaps in a counting
 * `table` and counting `rows` for the duration of that stage only, which means
 * a count is attributable to the stage that caused it rather than to the
 * pipeline as a whole.
 *
 * Returns a RowModelFactory with the same contract as the one it wraps.
 */
export function instrumentStage(factory, counters, label) {
  return (args) =>
    factory({
      table: countingProxy(args.table, TABLE_METHODS, counters, label),
      rows: args.rows.map((r) => countingProxy(r, ROW_METHODS, counters, label)),
    })
}

/**
 * Count how many times each stage of a pipeline actually runs.
 *
 * Separate from `instrumentStage` because "did this stage run at all" is the
 * question for the cache-key bug, and it must not be confused with "how much
 * work did it do once it ran".
 */
export function countStageRuns(factory, counters, label) {
  return (args) => {
    bump(counters, label + '.runs')
    return factory(args)
  }
}
