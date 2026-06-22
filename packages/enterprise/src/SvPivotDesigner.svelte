<script lang="ts" module>
  type PivotInputRow = Record<string, unknown>
</script>
<script lang="ts" generics="T extends PivotInputRow">
  /**
   * SvPivotDesigner - Excel-style pivot table designer.
   *
   * Self-contained, controlled component. The consumer holds the data
   * + the field list + the layout state; everything else (drag-and-drop,
   * chip menus, search, presets, the inline pivot grid) is built in.
   *
   * Minimal wire-up (in a .svelte file):
   *   const fields = [
   *     { field: 'region',   label: 'Region',   kind: 'dimension' },
   *     { field: 'quarter',  label: 'Quarter',  kind: 'dimension' },
   *     { field: 'amount',   label: 'Revenue',  kind: 'measure', defaultAgg: 'sum' },
   *   ]
   *   let layout = $state(defaultLayoutFor(fields))
   *
   *   SvPivotDesigner {data} {fields} bind:layout
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'
  import { createPivotModel, filterCollapsedPivotRows, type PivotRow, type PivotAggregatorId } from './pivot'
  import {
    ALL_AGGREGATORS, AGG_LABEL, EMPTY_LAYOUT, defaultLayoutFor,
    type PivotField, type PivotLayout, type PivotPreset, type Well,
  } from './pivot-designer'

  type Props = {
    /** Flat input rows. */
    data: T[]
    /** All fields the user can pick from the rail. */
    fields: PivotField<T>[]
    /** The current pivot layout. Bindable so the consumer can persist it. */
    layout?: PivotLayout
    /** Fired when the user changes the layout (drag, drop, chip menu, …). */
    onLayoutChange?: (layout: PivotLayout) => void

    // ---- Optional features --------------------------------------------
    /** Saved layouts surfaced in the toolbar's Presets menu. */
    presets?: PivotPreset[]
    /** Aggregators offered in the Values chip menu. Default: all. */
    aggregators?: PivotAggregatorId[]
    /** Show the toolbar above the wells. Default true. */
    showToolbar?: boolean
    /** Show the left-rail field picker. Default true. */
    showFieldList?: boolean
    /** Show the Filters well. Default true. */
    showFiltersWell?: boolean
    /** Custom Export handler. When set, an Export button appears. */
    onExport?: (layout: PivotLayout, rows: PivotRow[]) => void
    /** Height of the inner pivot grid. Default '100%'. */
    gridHeight?: string | number
    /** Render the embedded grid? Set false to host it separately and
     *  read `pivot` from the on:pivot event. Default true. */
    embedGrid?: boolean
    /** Fires whenever the underlying pivot model rebuilds. */
    onPivot?: (rows: PivotRow[], columns: ColumnDef<typeof features, PivotRow>[]) => void
    /** Allow row-level expand / collapse. When true, an expand chevron
     *  appears in the label cell on every `group` row and clicking it
     *  toggles which descendant rows are visible. The designer manages
     *  the collapsed set internally. Default false. */
    expandable?: boolean
    /** Transform the generated column tree right before the grid renders.
     *  The consumer can attach custom `cell:` / `header:` / `cellClass:`
     *  properties, change widths, etc. Receives the full tree + the
     *  current layout (so it can branch on which measures are present). */
    decorateColumns?: (
      cols: ColumnDef<typeof features, PivotRow>[],
      layout: PivotLayout,
    ) => ColumnDef<typeof features, PivotRow>[]
    /** Click handler forwarded to the embedded SvGrid - typically used
     *  to drive a drill-through side panel. */
    onCellClick?: (ctx: { columnId: string; row: PivotRow; value: unknown }) => void
  }
  let {
    data,
    fields,
    layout = $bindable<PivotLayout>(defaultLayoutFor([])),
    onLayoutChange,
    presets,
    aggregators = ALL_AGGREGATORS,
    showToolbar = true,
    showFieldList = true,
    showFiltersWell = true,
    onExport,
    gridHeight = '100%',
    embedGrid = true,
    onPivot,
    expandable = false,
    decorateColumns,
    onCellClick,
  }: Props = $props()

  // Default the layout once on mount if the consumer passed nothing
  // meaningful. We seed inside $effect.pre so $bindable picks up the
  // mutation BEFORE the first render reads it.
  $effect.pre(() => {
    if (!layout || (!layout.rows.length && !layout.cols.length && !layout.values.length && !layout.filters.length)) {
      layout = defaultLayoutFor(fields)
    }
  })

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const uid = `pvd-${Math.random().toString(36).slice(2, 8)}`

  // Lookup helpers -----------------------------------------------------
  const fieldsByName = $derived(new Map(fields.map((f) => [f.field, f])))
  /** Field is currently "in use" - on any well - so the picker can grey it out. */
  function isFieldInLayout(field: string): boolean {
    return layout.rows.includes(field) ||
           layout.cols.includes(field) ||
           layout.values.some((v) => v.field === field) ||
           layout.filters.some((f) => f.field === field)
  }

  // ---- Search + grouped picker --------------------------------------
  let search = $state('')
  const filteredFields = $derived(
    fields.filter((f) => !search.trim() || f.label.toLowerCase().includes(search.trim().toLowerCase())),
  )
  const groupedFields = $derived.by(() => {
    const groups = new Map<string, PivotField<T>[]>()
    for (const f of filteredFields) {
      const key = f.group ?? (f.kind === 'dimension' ? 'Dimensions' : 'Measures')
      const arr = groups.get(key) ?? []
      arr.push(f); groups.set(key, arr)
    }
    return [...groups.entries()]
  })

  // ---- Mutation helpers ---------------------------------------------
  function emit(next: PivotLayout) {
    layout = next
    onLayoutChange?.(next)
  }
  function defaultWellFor(field: PivotField<T>): Well {
    return field.kind === 'measure' ? 'values' : 'rows'
  }
  /** Add a field to a well at `index` (or end). For rows / cols / filters a
   *  field can appear at most ONCE - dragging it in moves it. For values
   *  the same field with the SAME aggregator can only appear once, but
   *  the same field with DIFFERENT aggregators is valid (e.g. spend/sum
   *  + spend/avg in a scorecard). `sourceIndex` is the chip's position
   *  in `values` when dragging within that well, used to dedup the move. */
  function addToWell(field: string, well: Well, index = Infinity, sourceIndex?: number) {
    const f = fieldsByName.get(field)
    if (!f) return
    const next: PivotLayout = {
      ...layout,
      rows:    layout.rows.filter((x) => x !== field),
      cols:    layout.cols.filter((x) => x !== field),
      // For values: only strip if we're MOVING a specific chip out of the
      // well. Don't strip every chip with the same field (that broke
      // "spend/sum + spend/avg" presets with a duplicate-key error).
      values: sourceIndex !== undefined
        ? layout.values.filter((_, i) => i !== sourceIndex)
        : layout.values.slice(),
      filters: layout.filters.filter((v) => v.field !== field),
    }
    if (well === 'rows' || well === 'cols') {
      const arr = next[well]
      arr.splice(Math.min(arr.length, index), 0, field)
    } else if (well === 'values') {
      const agg = f.defaultAgg ?? 'sum' as PivotAggregatorId
      // Skip if (field, agg) pair already present after the strip.
      if (next.values.some((v) => v.field === field && v.agg === agg)) {
        emit(next); return
      }
      const chip = { field, agg, label: f.label, format: f.format }
      next.values.splice(Math.min(next.values.length, index), 0, chip)
    } else if (well === 'filters') {
      next.filters.splice(Math.min(next.filters.length, index), 0, { field, allowed: null })
    }
    emit(next)
  }
  function removeFromWell(field: string, well: Well, valueIndex?: number) {
    const next: PivotLayout = { ...layout }
    if (well === 'rows')        next.rows    = layout.rows.filter((x) => x !== field)
    else if (well === 'cols')   next.cols    = layout.cols.filter((x) => x !== field)
    else if (well === 'values') {
      // Remove a SPECIFIC chip by its index, since the same field can
      // appear multiple times with different aggregators.
      next.values = valueIndex !== undefined
        ? layout.values.filter((_, i) => i !== valueIndex)
        : layout.values.filter((v) => v.field !== field)
    }
    else if (well === 'filters') next.filters = layout.filters.filter((v) => v.field !== field)
    emit(next)
  }
  function toggleFieldDefault(field: string) {
    const f = fieldsByName.get(field); if (!f) return
    if (isFieldInLayout(field)) {
      // Remove from every well (all chips for this field, even multiple
      // value chips with different aggregators).
      emit({
        ...layout,
        rows:    layout.rows.filter((x) => x !== field),
        cols:    layout.cols.filter((x) => x !== field),
        values:  layout.values.filter((v) => v.field !== field),
        filters: layout.filters.filter((v) => v.field !== field),
      })
    } else {
      addToWell(field, defaultWellFor(f))
    }
  }
  /** Update the aggregator of the chip at the given index. If the change
   *  would produce a duplicate (field, agg) pair, the chip is removed
   *  instead of creating a key collision. */
  function setAggregatorAt(index: number, agg: PivotAggregatorId) {
    const chip = layout.values[index]
    if (!chip) return
    const field = chip.field
    const dup = layout.values.some((v, i) => i !== index && v.field === field && v.agg === agg)
    const label = AGG_LABEL[agg] + ' of ' + (fieldsByName.get(field)?.label ?? field)
    emit({
      ...layout,
      values: dup
        ? layout.values.filter((_, i) => i !== index)
        : layout.values.map((v, i) => (i === index ? { ...v, agg, label } : v)),
    })
  }
  function setFilterAllowed(field: string, allowed: string[] | null) {
    emit({
      ...layout,
      filters: layout.filters.map((f) => (f.field === field ? { ...f, allowed } : f)),
    })
  }
  function toggleHideSubtotals() {
    emit({ ...layout, hideSubtotals: !layout.hideSubtotals })
  }
  function toggleHideGrandTotals() {
    emit({ ...layout, hideGrandTotals: !layout.hideGrandTotals })
  }
  function reset() {
    emit(defaultLayoutFor(fields))
  }
  function loadPreset(p: PivotPreset) {
    emit(structuredClone(p.layout) as PivotLayout)
  }

  // ---- Drag-and-drop ------------------------------------------------
  /** What's being dragged: field id + the well it came from. `dragIndex`
   *  is the source position in the values well (only set when dragging a
   *  value chip; other wells have at most one chip per field so they
   *  don't need an index). */
  let dragField = $state<string | null>(null)
  let dragFrom = $state<Well | 'rail' | null>(null)
  let dragIndex = $state<number | undefined>(undefined)
  let dragOver = $state<Well | null>(null)
  function onDragStart(e: DragEvent, field: string, from: Well | 'rail', index?: number) {
    dragField = field
    dragFrom = from
    dragIndex = index
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', field)
    }
  }
  function onDragOver(e: DragEvent, well: Well) {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    dragOver = well
  }
  function onDragLeave() { dragOver = null }
  function onDrop(e: DragEvent, well: Well) {
    e.preventDefault()
    dragOver = null
    const field = dragField || e.dataTransfer?.getData('text/plain') || ''
    if (!field) return
    // Pass the source index only when dragging FROM the values well, so
    // a same-field move (e.g. reorder spend/avg) removes the right chip.
    const srcIdx = dragFrom === 'values' ? dragIndex : undefined
    addToWell(field, well, Infinity, srcIdx)
    dragField = null
    dragFrom = null
    dragIndex = undefined
  }

  // ---- Apply filters BEFORE pivot ------------------------------------
  // The pivot model itself has no filtering, but the well clearly should:
  // a Filters chip with `allowed` restricts which rows reach the model.
  const filteredData = $derived.by(() => {
    if (!layout.filters.length) return data
    return data.filter((row) => {
      for (const f of layout.filters) {
        if (f.allowed == null) continue
        const v = row[f.field]
        if (!f.allowed.includes(String(v))) return false
      }
      return true
    })
  })

  // ---- Build the pivot model ----------------------------------------
  // Whenever the layout or data changes, re-run the pivot. Empty layouts
  // are tolerated: the grid will show a friendly empty state.
  const pivot = $derived.by(() => {
    if (!layout.values.length && !layout.rows.length && !layout.cols.length) return null
    if (!layout.values.length) return null
    return createPivotModel(filteredData, {
      rows: layout.rows as Array<keyof T & string>,
      cols: layout.cols as Array<keyof T & string>,
      values: layout.values.map((v) => ({
        field: v.field as keyof T & string,
        agg: v.agg,
        label: v.label,
        format: v.format,
      })),
      grandTotalRow: !layout.hideGrandTotals,
      grandTotalCol: !layout.hideGrandTotals,
      rowSubtotals: !layout.hideSubtotals,
    })
  })
  $effect(() => {
    if (pivot) onPivot?.(pivot.rows, pivot.columns)
  })

  // ---- Expand / collapse (when `expandable` is on) ------------------
  // We hold a `collapsed` set of pivot row ids; descendants of a
  // collapsed group are filtered out via the model helper. Reset to
  // fully-expanded whenever the source pivot rebuilds with different
  // group ids - otherwise stale ids would linger across layout changes.
  let collapsed = $state<Set<string>>(new Set())
  let lastPivotKey = $state('')
  $effect(() => {
    if (!pivot) return
    const key = pivot.rows.map((r) => r.__pivotId).join('|')
    if (key !== lastPivotKey) {
      lastPivotKey = key
      // Keep ids still present, drop the rest.
      const present = new Set(pivot.rows.map((r) => r.__pivotId))
      const next = new Set<string>()
      for (const id of collapsed) if (present.has(id)) next.add(id)
      if (next.size !== collapsed.size) collapsed = next
    }
  })
  function toggleRow(id: string) {
    const next = new Set(collapsed)
    if (next.has(id)) next.delete(id); else next.add(id)
    collapsed = next
  }
  function expandAll()   { collapsed = new Set() }
  function collapseAll() {
    if (!pivot) return
    const next = new Set<string>()
    for (const r of pivot.rows) if (r.__pivotExpandable) next.add(r.__pivotId)
    collapsed = next
  }
  /** Rows the grid should actually render, honouring the collapsed set. */
  const visibleRows = $derived.by(() => {
    if (!pivot) return [] as PivotRow[]
    if (!expandable || collapsed.size === 0) return pivot.rows
    const expanded = new Set<string>()
    for (const r of pivot.rows) {
      if (r.__pivotExpandable && !collapsed.has(r.__pivotId)) expanded.add(r.__pivotId)
    }
    return filterCollapsedPivotRows(pivot.rows, expanded)
  })

  // ---- Column tree with optional decoration -------------------------
  // When `expandable`, the first (label) column gets a built-in chevron
  // renderer. The consumer's `decorateColumns` runs LAST so it can
  // override even the chevron behaviour if it wants something custom.
  const finalColumns = $derived.by(() => {
    if (!pivot) return [] as ColumnDef<typeof features, PivotRow>[]
    let cols = pivot.columns
    // The engine builds the row-header column header from raw field names
    // (e.g. "region / country") which renders lowercase. Replace it with
    // the chained `field.label` from the picker so the rendered header
    // matches the chip text in the wells (e.g. "Region / Country").
    if (cols.length && layout.rows.length) {
      const rowLabel = layout.rows
        .map((f) => fieldsByName.get(f)?.label ?? f)
        .join(' / ')
      cols = [{ ...cols[0]!, header: rowLabel }, ...cols.slice(1)]
    }
    if (expandable) {
      cols = cols.map((c, i) => {
        if (i !== 0) return c
        return {
          ...c,
          cell: (ctx) => renderSnippet(ChevronLabelCell, {
            row: ctx.row.original,
            collapsed: collapsed.has(ctx.row.original.__pivotId),
            onToggle: () => toggleRow(ctx.row.original.__pivotId),
          }),
        }
      })
    }
    return decorateColumns ? decorateColumns(cols, layout) : cols
  })

  // ---- Filter chip menu (which values pass) --------------------------
  /** Distinct values for a field, computed from the FULL data (so the
   *  menu shows every option, not just those the current filters
   *  already pass). */
  function distinctValuesFor(field: string): string[] {
    const set = new Set<string>()
    for (const row of data) set.add(String(row[field]))
    return [...set].sort((a, b) => a.localeCompare(b))
  }

  // ---- Active menus (open one chip at a time) ----------------------
  // Filter menus key by `field` (one filter chip per field).
  // Agg menus key by `index` (a field can have multiple value chips at
  // different aggregators; index is the only stable identity).
  let openMenu = $state<
    | { kind: 'filter'; field: string }
    | { kind: 'agg'; index: number }
    | null
  >(null)
  function toggleFilterMenu(field: string) {
    if (openMenu?.kind === 'filter' && openMenu.field === field) openMenu = null
    else openMenu = { kind: 'filter', field }
  }
  function toggleAggMenu(index: number) {
    if (openMenu?.kind === 'agg' && openMenu.index === index) openMenu = null
    else openMenu = { kind: 'agg', index }
  }
  function closeMenu() { openMenu = null }
  // Close on outside click.
  $effect(() => {
    if (!openMenu) return
    function on(e: MouseEvent) {
      const t = e.target as HTMLElement | null
      if (t && t.closest(`[data-pvd-menu="${uid}"]`)) return
      openMenu = null
    }
    window.addEventListener('mousedown', on)
    return () => window.removeEventListener('mousedown', on)
  })

  // ---- Presets menu ------------------------------------------------
  let presetsOpen = $state(false)
  function togglePresets() { presetsOpen = !presetsOpen }
  $effect(() => {
    if (!presetsOpen) return
    function on(e: MouseEvent) {
      const t = e.target as HTMLElement | null
      if (t && t.closest(`[data-pvd-presets="${uid}"]`)) return
      presetsOpen = false
    }
    window.addEventListener('mousedown', on)
    return () => window.removeEventListener('mousedown', on)
  })
</script>

<section class="pvd" data-uid={uid}>
  {#if showToolbar}
    <header class="pvd-toolbar">
      <strong class="pvd-title">Pivot designer</strong>
      <button type="button" class="pvd-btn" onclick={reset} title="Restore the default layout">↺ Reset</button>
      {#if presets?.length}
        <div class="pvd-presets" data-pvd-presets={uid}>
          <button type="button" class="pvd-btn" onclick={togglePresets}>Presets ▾</button>
          {#if presetsOpen}
            <div class="pvd-popover">
              {#each presets as p (p.name)}
                <button type="button" class="pvd-popover-item" onclick={() => { loadPreset(p); presetsOpen = false }}>{p.name}</button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
      <label class="pvd-toggle">
        <input type="checkbox" checked={!layout.hideSubtotals} onchange={toggleHideSubtotals} /> Subtotals
      </label>
      <label class="pvd-toggle">
        <input type="checkbox" checked={!layout.hideGrandTotals} onchange={toggleHideGrandTotals} /> Grand totals
      </label>
      <div class="pvd-spacer"></div>
      {#if onExport && pivot}
        <button type="button" class="pvd-btn pvd-btn-primary" onclick={() => onExport!(layout, pivot!.rows)}>Export…</button>
      {/if}
    </header>
  {/if}

  <div class="pvd-body" class:no-rail={!showFieldList}>
    {#if showFieldList}
      <aside class="pvd-rail" aria-label="Available fields">
        <input
          type="search"
          class="pvd-search"
          placeholder="Search fields…"
          bind:value={search}
        />
        <div class="pvd-fieldlist">
          {#each groupedFields as [groupName, items] (groupName)}
            <div class="pvd-group-head">{groupName}</div>
            {#each items as f (f.field)}
              {@const inUse = isFieldInLayout(f.field)}
              <div
                class="pvd-field"
                class:in-use={inUse}
                draggable="true"
                ondragstart={(e) => onDragStart(e, f.field, 'rail')}
                role="button"
                tabindex="0"
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFieldDefault(f.field) } }}
              >
                <input type="checkbox" checked={inUse} onchange={() => toggleFieldDefault(f.field)} aria-label={`Toggle ${f.label}`} />
                <span class="pvd-field-label">{f.label}</span>
                <span class="pvd-field-kind">{f.kind === 'dimension' ? 'D' : 'Σ'}</span>
              </div>
            {/each}
          {/each}
          {#if !filteredFields.length}
            <div class="pvd-empty">No fields match "{search}"</div>
          {/if}
        </div>
      </aside>
    {/if}

    <div class="pvd-main">
      <div class="pvd-wells" class:two={!showFiltersWell}>
        <!-- Filters -->
        {#if showFiltersWell}
          <div class="pvd-well"
            class:drag-over={dragOver === 'filters'}
            ondragover={(e) => onDragOver(e, 'filters')}
            ondragleave={onDragLeave}
            ondrop={(e) => onDrop(e, 'filters')}>
            <div class="pvd-well-head">Filters</div>
            <div class="pvd-well-body">
              {#each layout.filters as f (f.field)}
                {@const fd = fieldsByName.get(f.field)}
                <div class="pvd-chip" draggable="true" ondragstart={(e) => onDragStart(e, f.field, 'filters')}>
                  <button type="button" class="pvd-chip-label" onclick={() => toggleFilterMenu(f.field)}>
                    {fd?.label ?? f.field}{f.allowed ? ` (${f.allowed.length})` : ''}
                  </button>
                  <button type="button" class="pvd-chip-x" onclick={() => removeFromWell(f.field, 'filters')} aria-label="Remove">×</button>
                  {#if openMenu?.kind === 'filter' && openMenu?.field === f.field}
                    {@const all = distinctValuesFor(f.field)}
                    <div class="pvd-popover pvd-popover-filter" data-pvd-menu={uid}>
                      <div class="pvd-popover-head">
                        <button type="button" class="pvd-popover-mini" onclick={() => setFilterAllowed(f.field, null)}>All</button>
                        <button type="button" class="pvd-popover-mini" onclick={() => setFilterAllowed(f.field, [])}>None</button>
                      </div>
                      <div class="pvd-popover-list">
                        {#each all as v (v)}
                          {@const checked = f.allowed == null || f.allowed.includes(v)}
                          <label class="pvd-popover-item pvd-popover-check">
                            <input type="checkbox" checked={checked}
                              onchange={() => {
                                const cur = f.allowed ?? all.slice()
                                const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
                                setFilterAllowed(f.field, next.length === all.length ? null : next)
                              }} />
                            <span>{v}</span>
                          </label>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/each}
              {#if !layout.filters.length}<span class="pvd-well-hint">drop fields here to filter the source rows</span>{/if}
            </div>
          </div>
        {/if}

        <!-- Columns -->
        <div class="pvd-well"
          class:drag-over={dragOver === 'cols'}
          ondragover={(e) => onDragOver(e, 'cols')}
          ondragleave={onDragLeave}
          ondrop={(e) => onDrop(e, 'cols')}>
          <div class="pvd-well-head">Columns</div>
          <div class="pvd-well-body">
            {#each layout.cols as field (field)}
              {@const fd = fieldsByName.get(field)}
              <div class="pvd-chip" draggable="true" ondragstart={(e) => onDragStart(e, field, 'cols')}>
                <span class="pvd-chip-label">{fd?.label ?? field}</span>
                <button type="button" class="pvd-chip-x" onclick={() => removeFromWell(field, 'cols')} aria-label="Remove">×</button>
              </div>
            {/each}
            {#if !layout.cols.length}<span class="pvd-well-hint">drop dimensions to pivot along the column axis</span>{/if}
          </div>
        </div>

        <!-- Rows -->
        <div class="pvd-well"
          class:drag-over={dragOver === 'rows'}
          ondragover={(e) => onDragOver(e, 'rows')}
          ondragleave={onDragLeave}
          ondrop={(e) => onDrop(e, 'rows')}>
          <div class="pvd-well-head">Rows</div>
          <div class="pvd-well-body">
            {#each layout.rows as field (field)}
              {@const fd = fieldsByName.get(field)}
              <div class="pvd-chip" draggable="true" ondragstart={(e) => onDragStart(e, field, 'rows')}>
                <span class="pvd-chip-label">{fd?.label ?? field}</span>
                <button type="button" class="pvd-chip-x" onclick={() => removeFromWell(field, 'rows')} aria-label="Remove">×</button>
              </div>
            {/each}
            {#if !layout.rows.length}<span class="pvd-well-hint">drop dimensions to group rows</span>{/if}
          </div>
        </div>

        <!-- Values -->
        <div class="pvd-well"
          class:drag-over={dragOver === 'values'}
          ondragover={(e) => onDragOver(e, 'values')}
          ondragleave={onDragLeave}
          ondrop={(e) => onDrop(e, 'values')}>
          <div class="pvd-well-head">Values</div>
          <div class="pvd-well-body">
            {#each layout.values as v, vi (v.field + '|' + v.agg + '|' + vi)}
              {@const fd = fieldsByName.get(v.field)}
              <div class="pvd-chip pvd-chip-value" draggable="true" ondragstart={(e) => onDragStart(e, v.field, 'values', vi)}>
                <button type="button" class="pvd-chip-label" onclick={() => toggleAggMenu(vi)}>
                  <span class="pvd-chip-agg">{AGG_LABEL[v.agg]}</span>
                  <span class="pvd-chip-sep">·</span>
                  <span>{fd?.label ?? v.field}</span>
                </button>
                <button type="button" class="pvd-chip-x" onclick={() => removeFromWell(v.field, 'values', vi)} aria-label="Remove">×</button>
                {#if openMenu?.kind === 'agg' && openMenu.index === vi}
                  <div class="pvd-popover" data-pvd-menu={uid}>
                    {#each aggregators as agg (agg)}
                      <button
                        type="button"
                        class="pvd-popover-item"
                        class:is-active={v.agg === agg}
                        onclick={() => { setAggregatorAt(vi, agg); closeMenu() }}
                      >
                        {AGG_LABEL[agg]}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
            {#if !layout.values.length}<span class="pvd-well-hint">drop measures to aggregate</span>{/if}
          </div>
        </div>
      </div>

      {#if embedGrid}
        <div class="pvd-grid" style={`height:${typeof gridHeight === 'number' ? gridHeight + 'px' : gridHeight}`}>
          {#if pivot}
            <SvGrid
              data={visibleRows}
              columns={finalColumns}
              features={features}
              sortable
              filterable
              selectionMode="none"
              rowHeight={32}
              containerHeight="100%"
              fitColumns={true}
              enableRowSummaries={false}
              {onCellClick}
            />
          {:else}
            <div class="pvd-empty pvd-grid-empty">
              {#if !layout.values.length}
                Drop at least one <strong>measure</strong> into Values to render the pivot.
              {:else}
                No data.
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</section>

<!-- Label cell renderer used when `expandable` is on. Indents by
     pivot depth and shows a clickable chevron for expandable rows
     (group rows that have descendants). -->
{#snippet ChevronLabelCell({ row, collapsed: isCollapsed, onToggle }: { row: PivotRow; collapsed: boolean; onToggle: () => void })}
  <span class="pvd-label-cell" style={`padding-left:${row.__pivotDepth * 14}px`}>
    {#if row.__pivotExpandable}
      <button
        type="button"
        class="pvd-chev"
        class:is-collapsed={isCollapsed}
        onclick={(e) => { e.stopPropagation(); onToggle() }}
        aria-label={isCollapsed ? 'Expand' : 'Collapse'}
      >▾</button>
    {:else}
      <span class="pvd-chev pvd-chev-placeholder"></span>
    {/if}
    <span class="pvd-label-text" class:is-subtotal={row.__pivotKind === 'subtotal'} class:is-grand={row.__pivotKind === 'grandTotal'}>
      {row.__pivotLabel}
    </span>
  </span>
{/snippet}

<style>
  /* SvPivotDesigner styles -------------------------------------------
     All variables use the SvGrid token system (--sg-*) with safe
     fallbacks so the component theme-matches whatever grid skin the
     host page is using. */
  .pvd {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    color: var(--sg-fg, #0f172a);
    background: var(--sg-bg, #ffffff);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    overflow: hidden;
    font-family: inherit;
  }
  .pvd-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--sg-header-bg, #f8fafc);
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    flex-shrink: 0;
  }
  .pvd-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--sg-fg);
    margin-right: 8px;
  }
  .pvd-spacer { flex: 1; }
  .pvd-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    padding: 4px 10px;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 100ms ease, border-color 100ms ease;
  }
  .pvd-btn:hover { background: var(--sg-row-hover-bg, #f1f5f9); border-color: var(--sg-accent, #2563eb); }
  .pvd-btn-primary {
    background: var(--sg-accent, #2563eb);
    color: #fff;
    border-color: var(--sg-accent, #2563eb);
  }
  .pvd-btn-primary:hover { opacity: 0.9; }
  .pvd-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--sg-fg);
    cursor: pointer;
    user-select: none;
  }
  .pvd-toggle input { accent-color: var(--sg-accent, #2563eb); }

  .pvd-body {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 0;
    flex: 1;
    min-height: 0;
  }
  .pvd-body.no-rail { grid-template-columns: 1fr; }

  /* Left rail */
  .pvd-rail {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    min-height: 0;
  }
  .pvd-search {
    border: 0;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    padding: 8px 12px;
    font-size: 12px;
    background: transparent;
    color: var(--sg-fg);
    outline: none;
  }
  .pvd-search:focus { background: var(--sg-row-hover-bg, #f1f5f9); }
  .pvd-fieldlist {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 4px 0;
  }
  .pvd-group-head {
    padding: 8px 12px 4px;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
  }
  .pvd-field {
    display: grid;
    grid-template-columns: 16px 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 5px 12px;
    font-size: 12px;
    cursor: grab;
    transition: background 80ms ease;
  }
  .pvd-field:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .pvd-field:active { cursor: grabbing; }
  .pvd-field.in-use .pvd-field-label { font-weight: 600; color: var(--sg-accent, #2563eb); }
  .pvd-field-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pvd-field-kind {
    font-family: ui-monospace, monospace;
    font-size: 10px;
    color: var(--sg-muted, #94a3b8);
    background: var(--sg-header-bg, #f1f5f9);
    padding: 1px 5px;
    border-radius: 3px;
  }

  /* Main area */
  .pvd-main {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }
  .pvd-wells {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    padding: 8px;
    background: var(--sg-bg, #ffffff);
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .pvd-wells.two { grid-template-columns: repeat(3, 1fr); }

  .pvd-well {
    display: flex;
    flex-direction: column;
    border: 1px dashed var(--sg-border, #cbd5e1);
    border-radius: 6px;
    background: var(--sg-bg, #ffffff);
    min-height: 64px;
    transition: border-color 100ms ease, background 100ms ease;
  }
  .pvd-well.drag-over {
    border-color: var(--sg-accent, #2563eb);
    border-style: solid;
    background: color-mix(in srgb, var(--sg-accent, #2563eb) 8%, var(--sg-bg, #ffffff));
  }
  .pvd-well-head {
    padding: 4px 8px 2px;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
  }
  .pvd-well-body {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 8px 8px;
    min-height: 36px;
    align-content: flex-start;
  }
  .pvd-well-hint {
    color: var(--sg-muted, #94a3b8);
    font-size: 11px;
    font-style: italic;
    padding: 4px 0;
  }

  .pvd-chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: var(--sg-header-bg, #f1f5f9);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 5px;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
    cursor: grab;
    user-select: none;
  }
  .pvd-chip:active { cursor: grabbing; }
  .pvd-chip-value {
    background: color-mix(in srgb, var(--sg-accent, #2563eb) 14%, var(--sg-bg, #ffffff));
    border-color: var(--sg-accent, #2563eb);
  }
  .pvd-chip-label {
    border: 0;
    background: transparent;
    padding: 4px 8px;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .pvd-chip-agg {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--sg-accent, #2563eb);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-right: 4px;
  }
  .pvd-chip-sep { color: var(--sg-muted, #94a3b8); margin-right: 4px; }
  .pvd-chip-x {
    border: 0;
    background: transparent;
    color: var(--sg-muted, #64748b);
    cursor: pointer;
    padding: 2px 6px 3px;
    font-size: 14px;
    line-height: 1;
    border-radius: 3px;
  }
  .pvd-chip-x:hover { color: #ef4444; background: rgba(239, 68, 68, 0.08); }

  /* Popovers (agg menu, filter menu, presets) */
  .pvd-popover, .pvd-presets {
    position: relative;
  }
  .pvd-popover {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 50;
    min-width: 160px;
    background: var(--sg-bg, #ffffff);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 6px;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
    padding: 4px;
  }
  .pvd-popover-filter { min-width: 200px; max-height: 280px; display: flex; flex-direction: column; }
  .pvd-popover-head {
    display: flex; gap: 4px;
    padding: 4px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .pvd-popover-mini {
    flex: 1;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }
  .pvd-popover-mini:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .pvd-popover-list { flex: 1; min-height: 0; overflow: auto; padding: 4px 0; }
  .pvd-popover-item {
    display: block;
    width: 100%;
    text-align: left;
    border: 0;
    background: transparent;
    padding: 5px 10px;
    font-size: 12px;
    color: var(--sg-fg);
    cursor: pointer;
    border-radius: 4px;
  }
  .pvd-popover-item:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .pvd-popover-item.is-active { background: color-mix(in srgb, var(--sg-accent, #2563eb) 14%, transparent); color: var(--sg-accent, #2563eb); font-weight: 600; }
  .pvd-popover-check {
    display: flex; align-items: center; gap: 8px;
    cursor: pointer;
  }
  .pvd-popover-check input { accent-color: var(--sg-accent, #2563eb); }

  /* Embedded grid */
  .pvd-grid {
    flex: 1;
    min-height: 0;
    padding: 0;
  }
  .pvd-grid-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--sg-muted, #94a3b8);
    font-size: 13px;
    padding: 24px;
    text-align: center;
  }

  .pvd-empty {
    padding: 20px;
    color: var(--sg-muted, #94a3b8);
    font-size: 12px;
    text-align: center;
  }

  /* Built-in label cell renderer (when expandable is on) */
  :global(.pvd-label-cell) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    line-height: 1;
  }
  :global(.pvd-chev) {
    width: 14px;
    height: 14px;
    border: 0;
    background: transparent;
    color: var(--sg-muted, #64748b);
    font-size: 10px;
    line-height: 14px;
    cursor: pointer;
    border-radius: 3px;
    padding: 0;
    transition: transform 100ms ease, background 100ms ease;
  }
  :global(.pvd-chev:hover) { background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-fg, #0f172a); }
  :global(.pvd-chev.is-collapsed) { transform: rotate(-90deg); }
  :global(.pvd-chev-placeholder) { cursor: default; visibility: hidden; }
  :global(.pvd-label-text.is-subtotal) { font-weight: 700; }
  :global(.pvd-label-text.is-grand) { font-weight: 800; color: var(--sg-accent, #2563eb); }

  /* Mobile: stack rail above main, wells in two columns. */
  @media (max-width: 900px) {
    .pvd-body { grid-template-columns: 1fr; }
    .pvd-rail {
      border-right: 0;
      border-bottom: 1px solid var(--sg-border, #e2e8f0);
      max-height: 200px;
    }
    .pvd-wells, .pvd-wells.two { grid-template-columns: repeat(2, 1fr); }
  }
</style>
