/**
 * Named views. A thin, packaged manager on top of `api.getState()` /
 * `api.setState()` so the "save / restore named layouts" feature every
 * enterprise grid ships is one import instead of hand-rolled glue.
 *
 * Storage is pluggable: `localStorageViews(key)` persists per browser, or
 * pass your own adapter to sync views to a server / per-user account. The
 * manager itself is pure and synchronous, so it is trivially testable.
 */
import type { SvGridViewState } from './svgrid-wrapper.types'

export type SavedView = {
  name: string
  state: Partial<SvGridViewState>
  createdAt: number
}

export type ViewStorage = {
  read(): SavedView[]
  write(views: SavedView[]): void
}

/** Minimal grid handle the manager needs - `SvGridApi` satisfies it. */
export type ViewStateHost = {
  getState(): SvGridViewState
  setState(state: Partial<SvGridViewState>): void
}

export type NamedViews = {
  list(): SavedView[]
  /** Capture the grid's current state under `name` (overwrites a duplicate). */
  save(name: string): SavedView
  /** Apply a saved view to the grid. Returns false if the name is unknown. */
  load(name: string): boolean
  /** Delete a saved view. Returns false if the name is unknown. */
  remove(name: string): boolean
  rename(from: string, to: string): boolean
  has(name: string): boolean
}

/** In-memory storage (default). State lives only as long as the manager. */
export function memoryViews(initial: SavedView[] = []): ViewStorage {
  let views = [...initial]
  return {
    read: () => views,
    write: (next) => {
      views = next
    },
  }
}

/** localStorage-backed storage. Safe to construct in SSR (no-ops there). */
export function localStorageViews(key: string): ViewStorage {
  const available = typeof localStorage !== 'undefined'
  return {
    read() {
      if (!available) return []
      try {
        const raw = localStorage.getItem(key)
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? (parsed as SavedView[]) : []
      } catch {
        return []
      }
    },
    write(views) {
      if (!available) return
      try {
        localStorage.setItem(key, JSON.stringify(views))
      } catch {
        /* quota / private mode - ignore */
      }
    },
  }
}

export function createNamedViews(
  host: ViewStateHost,
  options: { storage?: ViewStorage } = {},
): NamedViews {
  const storage = options.storage ?? memoryViews()

  const all = () => storage.read()
  const find = (name: string) => all().find((v) => v.name === name)

  return {
    list: () => all().slice().sort((a, b) => a.createdAt - b.createdAt),
    has: (name) => Boolean(find(name)),
    save(name) {
      const view: SavedView = {
        name,
        state: host.getState(),
        createdAt: find(name)?.createdAt ?? Date.now(),
      }
      storage.write([...all().filter((v) => v.name !== name), view])
      return view
    },
    load(name) {
      const view = find(name)
      if (!view) return false
      host.setState(view.state)
      return true
    },
    remove(name) {
      const next = all().filter((v) => v.name !== name)
      if (next.length === all().length) return false
      storage.write(next)
      return true
    },
    rename(from, to) {
      const view = find(from)
      if (!view || find(to)) return false
      storage.write([
        ...all().filter((v) => v.name !== from),
        { ...view, name: to },
      ])
      return true
    },
  }
}

export type AutoSavedViewOptions = {
  /** Slot name inside the NamedViews store. Default `'__autosave'`. */
  name?: string
  /** Sample interval in ms. Default 800. */
  intervalMs?: number
  /** Skip restore-on-mount (e.g. you already loaded a URL view first). */
  skipRestore?: boolean
}

/**
 * Attach an "always-save-current-layout" slot to a `NamedViews` manager.
 * Restores once on attach (if a saved view exists under `name`) and
 * polls `host.getState()` thereafter, saving when the JSON snapshot
 * changes.
 *
 * Returns a `detach()` that stops polling - call it from `onDestroy`.
 *
 * ```ts
 * const views = createNamedViews(api, { storage: localStorageViews('myapp:views') })
 * const off = attachAutoSavedView(api, views)
 * onDestroy(off)
 * ```
 *
 * Distinct from a user-saved named view: the slot is a single, fixed
 * name reserved for "what the user left the page looking at." The user
 * can still call `views.save('Q3 review')` etc. through the same store.
 */
export function attachAutoSavedView(
  host: ViewStateHost,
  views: NamedViews,
  opts: AutoSavedViewOptions = {},
): () => void {
  const name = opts.name ?? '__autosave'
  if (!opts.skipRestore && views.has(name)) views.load(name)

  const interval = Math.max(100, opts.intervalMs ?? 800)
  let last = JSON.stringify(host.getState())
  const handle = setInterval(() => {
    let next: string
    try { next = JSON.stringify(host.getState()) } catch { return }
    if (next === last) return
    last = next
    views.save(name)
  }, interval)

  return () => clearInterval(handle)
}
