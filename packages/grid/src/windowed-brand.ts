/**
 * What marks an array as windowed data, and how to tell (windowed-data.ts has
 * the full story). Kept apart from createWindowedData so code that only asks
 * "is this windowed?" - the controller, the core's per-update paths - does not
 * pull in the windowed row model that createWindowedData installs.
 */

const WINDOWED = Symbol.for('svgrid.windowedData')

export type WindowedSource<T> = {
  /** The number of rows, loaded or not. */
  readonly length: number
  /** The entry at `index`: a loaded row, a placeholder, or undefined. */
  at(index: number): T | undefined
}

const isIndexKey = (key: string | symbol): key is string =>
  typeof key === 'string' && key.length > 0 && key.length < 16 && /^(0|[1-9]\d*)$/.test(key)

/**
 * An array of `length` entries read through `at(i)`: a real `Array` (a Proxy
 * over an empty one) carrying the windowed mark. Each call returns a new
 * array identity, which is how a source tells the grid its rows changed.
 */
export function makeWindowedArray<T>(length: number, at: (index: number) => T | undefined): T[] {
  const source: WindowedSource<T> = { length, at }
  const target: T[] = []
  return new Proxy(target, {
    get(t, key, receiver) {
      if (key === WINDOWED) return source
      if (key === 'length') return length
      if (isIndexKey(key)) {
        const i = Number(key)
        return i < length ? at(i) : undefined
      }
      return Reflect.get(t, key, receiver)
    },
    has(t, key) {
      if (key === WINDOWED) return true
      if (isIndexKey(key)) return Number(key) < length
      return Reflect.has(t, key)
    },
    set() {
      // Read-only: a write would land in the empty target and never be seen.
      return false
    },
    getOwnPropertyDescriptor(t, key) {
      if (isIndexKey(key) && Number(key) < length) {
        return { value: at(Number(key)), writable: false, enumerable: true, configurable: true }
      }
      if (key === 'length') return { value: length, writable: true, enumerable: false, configurable: false }
      return Reflect.getOwnPropertyDescriptor(t, key)
    },
  })
}

/** The source behind windowed data, or null for an ordinary array. */
export function windowedSourceOf<T>(data: unknown): WindowedSource<T> | null {
  if (data === null || typeof data !== 'object') return null
  const source = (data as Record<symbol, unknown>)[WINDOWED]
  return (source as WindowedSource<T> | undefined) ?? null
}

/** True for windowed data. */
export function isWindowedData(data: unknown): boolean {
  return windowedSourceOf(data) !== null
}
