/**
 * Saved-views helper used by the reporting and compliance demos.
 *
 * What it gives a buyer:
 *
 *   1. **Named view library.** A user assembles a set of group-bys,
 *      filters, sort clauses, and whatever else into a "view" and
 *      names it ("My quarter close", "EMEA pipeline", "Stuck deals").
 *      One click restores everything later.
 *
 *   2. **Cross-session persistence.** Views live in `localStorage`,
 *      so they survive a refresh / re-login / browser restart. The
 *      shape is JSON, so a real product can also POST these to a
 *      `/views` endpoint to share across users - same code path,
 *      different transport.
 *
 *   3. **Built-in defaults.** Each instance can ship a seed list of
 *      starter views so first-time users see useful options out of
 *      the box rather than a blank "no views saved yet" wall.
 *
 * This file is intentionally framework-agnostic - it exposes plain
 * getters and setters, and the Svelte demo wraps them in `$state`
 * accessors. Drop it into a React or Vue demo and the surface stays
 * the same.
 */

export type SavedView<TState> = {
  id: string
  name: string
  state: TState
  /** epoch ms - used to sort the menu */
  updatedAt: number
  /** True when the user can't delete or rename (shipped-as-defaults). */
  builtIn?: boolean
}

export type SavedViewsOptions<TState> = {
  /** localStorage key. Pass a per-demo prefix so views don't collide. */
  storageKey: string
  /** Seed list when nothing is in storage yet. */
  defaults?: Array<Omit<SavedView<TState>, 'id' | 'updatedAt'>>
}

export type SavedViewsApi<TState> = {
  list(): Array<SavedView<TState>>
  get(id: string): SavedView<TState> | undefined
  save(name: string, state: TState): SavedView<TState>
  update(id: string, state: TState): SavedView<TState> | undefined
  rename(id: string, name: string): SavedView<TState> | undefined
  remove(id: string): boolean
  /** Wipe everything (incl. defaults) and re-seed. */
  reset(): void
}

function readStorage<TState>(key: string): Array<SavedView<TState>> | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Array<SavedView<TState>>
    if (!Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

function writeStorage<TState>(key: string, views: Array<SavedView<TState>>): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(views))
  } catch {
    // Quota exceeded / private mode / etc. Silently drop - the
    // in-memory list still works for the rest of the session.
  }
}

function nextId(): string {
  return `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function createSavedViews<TState>(
  options: SavedViewsOptions<TState>,
): SavedViewsApi<TState> {
  const seeded: Array<SavedView<TState>> = (options.defaults ?? []).map((def) => ({
    id: nextId(),
    updatedAt: Date.now(),
    builtIn: true,
    ...def,
  }))

  let views: Array<SavedView<TState>> = readStorage<TState>(options.storageKey) ?? seeded

  // Merge in any builtIn defaults that aren't present (e.g. shipped
  // additions in a later release should appear even for returning
  // users).
  if (options.defaults) {
    const existingBuiltInNames = new Set(views.filter((v) => v.builtIn).map((v) => v.name))
    for (const def of options.defaults) {
      if (!existingBuiltInNames.has(def.name)) {
        views = [
          ...views,
          { id: nextId(), updatedAt: Date.now(), builtIn: true, ...def },
        ]
      }
    }
    writeStorage(options.storageKey, views)
  }

  function commit(next: Array<SavedView<TState>>): void {
    views = next
    writeStorage(options.storageKey, views)
  }

  return {
    list() {
      // Sort: built-in defaults first (alpha), then user views by
      // recency. Matches the typical IDE-style "Recent / Saved" split.
      return views.slice().sort((a, b) => {
        if (!!a.builtIn !== !!b.builtIn) return a.builtIn ? -1 : 1
        if (a.builtIn) return a.name.localeCompare(b.name)
        return b.updatedAt - a.updatedAt
      })
    },
    get(id) {
      return views.find((v) => v.id === id)
    },
    save(name, state) {
      // If a view with this name already exists (and isn't built-in),
      // overwrite - matches "Save" as save-or-update semantics.
      const trimmed = name.trim() || 'Untitled view'
      const existing = views.find((v) => !v.builtIn && v.name === trimmed)
      if (existing) {
        const updated: SavedView<TState> = { ...existing, state, updatedAt: Date.now() }
        commit(views.map((v) => (v.id === existing.id ? updated : v)))
        return updated
      }
      const fresh: SavedView<TState> = {
        id: nextId(),
        name: trimmed,
        state,
        updatedAt: Date.now(),
      }
      commit([...views, fresh])
      return fresh
    },
    update(id, state) {
      const existing = views.find((v) => v.id === id)
      if (!existing || existing.builtIn) return undefined
      const updated: SavedView<TState> = { ...existing, state, updatedAt: Date.now() }
      commit(views.map((v) => (v.id === id ? updated : v)))
      return updated
    },
    rename(id, name) {
      const existing = views.find((v) => v.id === id)
      if (!existing || existing.builtIn) return undefined
      const updated: SavedView<TState> = { ...existing, name: name.trim() || existing.name, updatedAt: Date.now() }
      commit(views.map((v) => (v.id === id ? updated : v)))
      return updated
    },
    remove(id) {
      const existing = views.find((v) => v.id === id)
      if (!existing || existing.builtIn) return false
      commit(views.filter((v) => v.id !== id))
      return true
    },
    reset() {
      views = (options.defaults ?? []).map((def) => ({
        id: nextId(),
        updatedAt: Date.now(),
        builtIn: true,
        ...def,
      }))
      writeStorage(options.storageKey, views)
    },
  }
}
