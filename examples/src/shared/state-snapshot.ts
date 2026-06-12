/**
 * Grid state snapshot utility
 * ----------------------------
 * Captures everything the user can change about a `<SvGrid>` into a
 * JSON-serialisable bag, and rehydrates the grid from one.
 *
 * Why it lives in `examples/shared/` and not in `sv-grid-community`:
 * the engine already exposes everything we need via `SvGridApi`, so a
 * thin consumer-side wrapper avoids growing the public API surface.
 * If you want the same behaviour in your app, copy this file or the
 * pattern - it's <200 lines.
 *
 * The state shape is versioned (`v: 1`) so future field additions can
 * migrate gracefully; see the `migrateStateSnapshot` helper at the
 * bottom for the pattern.
 */

import type { SvGridApi, TableFeatures, RowData, SvGridFilterOperator } from 'sv-grid-community'

// ---------------------------------------------------------------------------
// Snapshot shape
// ---------------------------------------------------------------------------

export type GridStateSnapshot = {
  /** Bumped whenever the snapshot shape changes. */
  v: 1
  /** Wall-clock time the snapshot was captured. */
  capturedAt: number
  /** Optional human label for history UIs. */
  label?: string

  /** Sort clauses, in priority order. */
  sorting: Array<{ columnId: string; desc: boolean }>

  /** Column-menu filters keyed by column id. Captures the
   *  operator+value style. For facet (set-list) filters, see
   *  `facetSelections` below. */
  filters: Record<string, { operator: SvGridFilterOperator; value: string }>

  /** Facet (set-list, Excel-style) selections per column id. Stored
   *  separately from `filters` because they're a different filter
   *  surface (multi-select rather than operator+value). */
  facetSelections: Record<string, string[]>

  /** Global search term (the single search box above the grid, when
   *  `filterMode='global'` or `showGlobalFilter={true}`). */
  globalFilter: string

  /** Column visibility, keyed by column id; missing keys = visible. */
  columnVisibility: Record<string, boolean>

  /** Per-column widths in px. Missing keys keep the default. */
  columnWidths: Record<string, number>

  /** Row selection keyed by row id (whatever id field the consumer
   *  uses). Missing keys = unselected. */
  rowSelection: Record<string, boolean>

  /** Active (focused) cell at the moment of capture. Restoring focus
   *  on apply is left to the demo's discretion - many UIs prefer to
   *  start at the top after a snapshot load. */
  activeCell: { rowIndex: number; colIndex: number; columnId: string } | null

  /** Free-form extras (page, expansion, group-by, custom slices). The
   *  grid doesn't read all of these by default - the demo passes them
   *  in + reads them out via the `extras` parameter. Keeps the shape
   *  future-proof without bloating the core capture path. */
  extras: Record<string, unknown>
}

export type CaptureOptions = {
  label?: string
  /** Extra slices the demo wants to track (e.g. its `groupBy` array,
   *  active page, row selection, expansion). Stored as-is. */
  extras?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

/**
 * Read the current grid state into a serialisable bag. Everything that
 * lives on `SvGridApi` lands in the typed slots; anything the demo
 * tracks separately rides in `extras`.
 */
export function captureGridState<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  api: SvGridApi<TFeatures, TData>,
  opts: CaptureOptions = {},
): GridStateSnapshot {
  // The headless engine emits its rich state through `onFiltersChange`
  // / `onSortingChange` / etc. - api.getFilters() gives us the
  // operator+value menu filters but NOT facet selections or the
  // global search box. So we let the consumer pre-populate every slot
  // via `extras`; whatever's missing we fall back to api.getFilters()
  // for the operator+value subset.
  const extras = { ...(opts.extras ?? {}) }
  function take<T>(key: string): T | undefined {
    const v = extras[key] as T | undefined
    delete extras[key]
    return v
  }
  return {
    v: 1,
    capturedAt: Date.now(),
    label: opts.label,
    sorting: take<GridStateSnapshot['sorting']>('sorting') ?? [],
    filters: take<GridStateSnapshot['filters']>('filters') ?? api.getFilters(),
    facetSelections: take<GridStateSnapshot['facetSelections']>('facetSelections') ?? {},
    globalFilter: take<string>('globalFilter') ?? '',
    columnVisibility: take<Record<string, boolean>>('columnVisibility') ?? {},
    columnWidths: take<Record<string, number>>('columnWidths') ?? {},
    rowSelection: take<Record<string, boolean>>('rowSelection') ?? {},
    activeCell: take<GridStateSnapshot['activeCell']>('activeCell') ?? null,
    extras,
  }
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export type ApplyOptions = {
  /** Called BEFORE the grid is touched. Useful for resetting consumer-
   *  owned state (sort prop, visibility prop) so the new snapshot
   *  lands clean. */
  onReset?: () => void
  /** Receives every typed-slot value so the demo can push them into
   *  the consumer-owned reactive props (sort, visibility, widths,
   *  selection, ...). The grid itself receives `setSort` + `setFilter`
   *  + `setColumnVisible` calls in addition. */
  onSlots?: (slots: {
    sorting: GridStateSnapshot['sorting']
    filters: GridStateSnapshot['filters']
    facetSelections: GridStateSnapshot['facetSelections']
    globalFilter: string
    columnVisibility: Record<string, boolean>
    columnWidths: Record<string, number>
    rowSelection: Record<string, boolean>
    activeCell: GridStateSnapshot['activeCell']
  }) => void
  /** Called once with the snapshot's `extras` so the demo can apply
   *  its own slices (group-by, page, expansion, ...). */
  onExtras?: (extras: Record<string, unknown>) => void
}

/**
 * Push a previously captured snapshot back into the grid. The pattern
 * pairs nicely with reactive `$state`: callbacks fire so the consumer
 * can update component-owned slices, then the grid's setters get
 * called for everything it owns directly.
 */
export function applyGridState<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  api: SvGridApi<TFeatures, TData>,
  snapshot: GridStateSnapshot,
  opts: ApplyOptions = {},
): void {
  opts.onReset?.()
  // Clear engine-owned state first to avoid mixing old filters with new.
  api.clearAllFilters()
  api.clearSort()

  // Push every typed slot back into the consumer. Facet selections,
  // global filter, row selection, and active cell are usually
  // wrapper-owned reactive props - the demo handles them via this
  // callback because the SvGridApi has no setters for them.
  opts.onSlots?.({
    sorting: snapshot.sorting,
    filters: snapshot.filters,
    facetSelections: snapshot.facetSelections,
    globalFilter: snapshot.globalFilter,
    columnVisibility: snapshot.columnVisibility,
    columnWidths: snapshot.columnWidths,
    rowSelection: snapshot.rowSelection,
    activeCell: snapshot.activeCell,
  })

  // Engine-owned state goes through the api.
  for (const [columnId, f] of Object.entries(snapshot.filters)) {
    api.setFilter(columnId, f)
  }
  for (const [columnId, values] of Object.entries(snapshot.facetSelections)) {
    api.setFacetFilter(columnId, values)
  }
  const lastSort = snapshot.sorting[snapshot.sorting.length - 1]
  if (lastSort) api.setSort(lastSort.columnId, lastSort.desc ? 'desc' : 'asc')

  for (const [columnId, visible] of Object.entries(snapshot.columnVisibility)) {
    api.setColumnVisible(columnId, visible)
  }

  opts.onExtras?.(snapshot.extras)
}

// ---------------------------------------------------------------------------
// JSON IO + migrations
// ---------------------------------------------------------------------------

export function snapshotToJson(snapshot: GridStateSnapshot, pretty = true): string {
  return JSON.stringify(snapshot, null, pretty ? 2 : 0)
}

export function snapshotFromJson(text: string): GridStateSnapshot {
  const parsed = JSON.parse(text) as Partial<GridStateSnapshot>
  return migrateStateSnapshot(parsed)
}

/**
 * Forward-compatible migration. Always returns a v: 1 snapshot. When
 * we ship v: 2 in a future release, add a case and translate.
 */
export function migrateStateSnapshot(input: Partial<GridStateSnapshot>): GridStateSnapshot {
  if (!input || typeof input !== 'object') return emptySnapshot()
  if (input.v === 1) return { ...emptySnapshot(), ...input } as GridStateSnapshot
  // Unknown / missing version - start fresh rather than crash.
  return emptySnapshot()
}

export function emptySnapshot(): GridStateSnapshot {
  return {
    v: 1,
    capturedAt: Date.now(),
    sorting: [],
    filters: {},
    facetSelections: {},
    globalFilter: '',
    columnVisibility: {},
    columnWidths: {},
    rowSelection: {},
    activeCell: null,
    extras: {},
  }
}

// ---------------------------------------------------------------------------
// localStorage helper (debounced auto-save)
// ---------------------------------------------------------------------------

/**
 * Persist a snapshot under a stable key, debounced so a flurry of UI
 * changes (drag-resize, multi-sort clicks) coalesces into one write.
 * Pass `null` to clear.
 */
export function autoSaveSnapshot(
  storageKey: string,
  snapshot: GridStateSnapshot | null,
  options: { debounceMs?: number } = {},
): void {
  const wait = options.debounceMs ?? 250
  if (typeof window === 'undefined') return
  // Per-key timer so two snapshots to different keys don't clobber each
  // other.
  const timers = (autoSaveSnapshot as unknown as { _t?: Map<string, ReturnType<typeof setTimeout>> })._t
    ?? new Map<string, ReturnType<typeof setTimeout>>()
  ;(autoSaveSnapshot as unknown as { _t: Map<string, ReturnType<typeof setTimeout>> })._t = timers
  const existing = timers.get(storageKey)
  if (existing) clearTimeout(existing)
  timers.set(
    storageKey,
    setTimeout(() => {
      try {
        if (snapshot === null) window.localStorage.removeItem(storageKey)
        else window.localStorage.setItem(storageKey, snapshotToJson(snapshot, false))
      } catch {
        // Quota / private mode - swallow.
      }
    }, wait),
  )
}

export function loadAutoSavedSnapshot(storageKey: string): GridStateSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    return snapshotFromJson(raw)
  } catch {
    return null
  }
}
