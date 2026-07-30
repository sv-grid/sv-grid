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
    SvGridChart,
    SvMenuList,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    portalToBody,
    popIn,
    createDismissableLayer,
    createFocusTrap,
    type ColumnDef,
    type ChartType,
    type MenuItem,
  } from '@svgrid/grid'
  import { createPivotModel, filterCollapsedPivotRows, type PivotRow, type PivotAggregatorId } from './pivot'
  import { pivotToChartSpec } from './pivot-chart'
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
    /** Offer a Table <-> Chart view toggle (same layout as a live chart). Default true. */
    chartable?: boolean
    /** Which view to show first when `chartable`. Default 'table'. */
    defaultView?: 'table' | 'chart'

    // ---- Presentation -------------------------------------------------
    /**
     * Where the authoring UI (field picker + wells) lives relative to the
     * grid. `'top'` (default) keeps the classic Excel layout: left rail +
     * a horizontal row of wells above the grid. `'right'` docks everything
     * as a single vertical tool panel on the right of the grid - the
     * "enterprise data grid" / AG-Grid pivot-panel arrangement.
     */
    panelPosition?: 'top' | 'right'
    /** Width of the docked panel when `panelPosition='right'`. Default 280. */
    panelWidth?: number | string
    /**
     * Enables a "Pivot Mode" toggle. When OFF the embedded grid renders the
     * flat source rows with `flatColumns`; when ON it renders the pivot.
     * Requires `flatColumns` to be provided. Bindable.
     */
    pivotMode?: boolean
    /** Columns for the flat (pivot-off) grid. Enables the Pivot Mode toggle. */
    flatColumns?: ColumnDef<typeof features, T>[]
    /** Fired when the Pivot Mode toggle changes. */
    onPivotModeChange?: (on: boolean) => void
    /** Fit the embedded grid's columns to width. Default true. Set false to
     *  let a wide pivot scroll horizontally (recommended with many columns). */
    gridFitColumns?: boolean
    /** Enable the right-click context menu on field-list rows, well chips, and
     *  the pivot grid (add/move/remove fields, change aggregator, expand /
     *  collapse). Default true. */
    contextMenu?: boolean
    /**
     * Column virtualization on the embedded grid. Default true. Set FALSE for
     * wide pivots with grouped column headers: the grouped header band isn't
     * virtualized, so a virtualized body leaves off-window group columns
     * looking empty until scrolled. Disabling it renders every column, so
     * header and body always stay in sync (fine up to a few hundred columns).
     */
    columnVirtualization?: boolean
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
    chartable = true,
    defaultView = 'table',
    panelPosition = 'top',
    panelWidth = 280,
    pivotMode = $bindable(true),
    flatColumns,
    onPivotModeChange,
    gridFitColumns = true,
    columnVirtualization = true,
    contextMenu = true,
  }: Props = $props()

  const showPivotToggle = $derived(!!flatColumns)
  function setPivotMode(on: boolean) {
    pivotMode = on
    onPivotModeChange?.(on)
  }

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
    // A filter added with `allowed: null` passes every row, so dropping a field
    // into Filters changes nothing until you pick values - auto-open the picker
    // so the drop has an immediate, obvious effect.
    if (well === 'filters') openMenu = { kind: 'filter', field }
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

  // ---- Table <-> Chart view (the same layout as a live pivot chart) ----
  let view = $state<'table' | 'chart'>(defaultView === 'chart' && chartable ? 'chart' : 'table')
  let chartType = $state<ChartType>('bar')
  let chartStacked = $state(false)
  const CHART_TYPES: Array<{ value: ChartType; label: string }> = [
    { value: 'bar', label: 'Bar' },
    { value: 'line', label: 'Line' },
    { value: 'area', label: 'Area' },
    { value: 'pie', label: 'Pie' },
  ]
  const chartSpec = $derived.by(() =>
    pivot && chartable && view === 'chart'
      ? pivotToChartSpec(pivot, { type: chartType, stacked: chartStacked })
      : null,
  )

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

  // ---- Right-click context menu ------------------------------------
  // A single portalled SvMenuList whose items are computed from whatever
  // was right-clicked: a field-list row, a well chip, or the pivot grid.
  const WELL_LABEL: Record<Well, string> = { rows: 'Rows', cols: 'Columns', values: 'Values', filters: 'Filters' }
  const KIND_WELLS: Record<'dimension' | 'measure', Well[]> = {
    dimension: ['rows', 'cols', 'filters'],
    measure: ['values', 'filters'],
  }
  let ctx = $state<{ x: number; y: number; items: MenuItem[] } | null>(null)
  let ctxPanelEl = $state<HTMLDivElement | null>(null)
  function openCtx(e: MouseEvent, items: MenuItem[]) {
    if (!contextMenu || items.length === 0) return
    e.preventDefault()
    e.stopPropagation()
    const W = 210
    const estH = Math.min(items.length, 12) * 32 + 10
    const x = Math.min(e.clientX, window.innerWidth - W - 6)
    const y = Math.min(e.clientY, window.innerHeight - estH - 6)
    ctx = { x: Math.max(6, x), y: Math.max(6, y), items }
  }
  function closeCtx() { ctx = null }
  $effect(() => {
    if (!ctx || !ctxPanelEl) return
    const trap = createFocusTrap(ctxPanelEl, {
      initialFocus: () => ctxPanelEl?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])') ?? null,
    })
    trap.activate()
    const layer = createDismissableLayer({ element: () => ctxPanelEl, onDismiss: closeCtx })
    layer.activate()
    const onScroll = () => closeCtx()
    window.addEventListener('scroll', onScroll, true)
    return () => { layer.release(); trap.release(); window.removeEventListener('scroll', onScroll, true) }
  })

  function clearWell(well: Well) {
    if (well === 'rows') emit({ ...layout, rows: [] })
    else if (well === 'cols') emit({ ...layout, cols: [] })
    else if (well === 'values') emit({ ...layout, values: [] })
    else emit({ ...layout, filters: [] })
  }

  /** Menu for a field-list (rail) row. */
  function fieldMenu(field: string): MenuItem[] {
    const f = fieldsByName.get(field)
    if (!f) return []
    const items: MenuItem[] = KIND_WELLS[f.kind].map((w) => ({
      label: `Add to ${WELL_LABEL[w]}`,
      onSelect: () => addToWell(field, w),
    }))
    if (isFieldInLayout(field)) {
      items.push({ separator: true }, { label: 'Remove from pivot', onSelect: () => toggleFieldDefault(field) })
    }
    return items
  }

  /** Menu for a chip already sitting in a well. */
  function chipMenu(well: Well, field: string, valueIndex?: number): MenuItem[] {
    const f = fieldsByName.get(field)
    const items: MenuItem[] = []
    if (well === 'values' && valueIndex !== undefined) {
      const current = layout.values[valueIndex]?.agg
      items.push({
        label: 'Aggregate',
        children: aggregators.map((agg) => ({
          label: AGG_LABEL[agg],
          shortcut: agg === current ? '✓' : undefined,
          onSelect: () => setAggregatorAt(valueIndex, agg),
        })),
      })
    }
    if (f) {
      const targets = KIND_WELLS[f.kind].filter((w) => w !== well)
      if (targets.length) {
        items.push({
          label: 'Move to',
          children: targets.map((w) => ({
            label: WELL_LABEL[w],
            onSelect: () => addToWell(field, w, Infinity, well === 'values' ? valueIndex : undefined),
          })),
        })
      }
    }
    if (well === 'filters') items.push({ label: 'Edit filter…', onSelect: () => toggleFilterMenu(field) })
    items.push(
      { separator: true },
      { label: 'Remove', onSelect: () => removeFromWell(field, well, valueIndex) },
      { label: `Clear ${WELL_LABEL[well]}`, onSelect: () => clearWell(well) },
    )
    return items
  }

  /** Menu for an empty area of a well. */
  function wellMenu(well: Well): MenuItem[] {
    const count = well === 'values' ? layout.values.length : layout[well].length
    return [{ label: `Clear ${WELL_LABEL[well]}`, disabled: count === 0, onSelect: () => clearWell(well) }]
  }

  /** Menu for the pivot grid area (expand / collapse when expandable). */
  function gridMenu(): MenuItem[] {
    const items: MenuItem[] = []
    if (expandable && pivot) {
      items.push(
        { label: 'Expand all', onSelect: expandAll },
        { label: 'Collapse all', onSelect: collapseAll },
      )
    }
    if (onExport && pivot) {
      if (items.length) items.push({ separator: true })
      items.push({ label: 'Export…', onSelect: () => onExport!(layout, pivot!.rows) })
    }
    return items
  }
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
      {#if chartable}
        <div class="pvd-viewswitch" role="group" aria-label="View">
          <button type="button" class="pvd-view-btn" class:is-active={view === 'table'} onclick={() => (view = 'table')}>Table</button>
          <button type="button" class="pvd-view-btn" class:is-active={view === 'chart'} onclick={() => (view = 'chart')}>Chart</button>
        </div>
        {#if view === 'chart'}
          <label class="pvd-toggle">
            <select class="pvd-select" value={chartType} onchange={(e) => (chartType = e.currentTarget.value as ChartType)}>
              {#each CHART_TYPES as t (t.value)}<option value={t.value}>{t.label}</option>{/each}
            </select>
          </label>
          {#if chartType !== 'pie'}
            <label class="pvd-toggle">
              <input type="checkbox" checked={chartStacked} onchange={(e) => (chartStacked = e.currentTarget.checked)} /> Stacked
            </label>
          {/if}
        {/if}
      {/if}
      <div class="pvd-spacer"></div>
      {#if onExport && pivot}
        <button type="button" class="pvd-btn pvd-btn-primary" onclick={() => onExport!(layout, pivot!.rows)}>Export…</button>
      {/if}
    </header>
  {/if}

  <div class="pvd-body" data-panel={panelPosition} class:no-rail={!showFieldList && panelPosition === 'top'}>
    {#if panelPosition === 'right'}
      <div class="pvd-gridwrap">{@render gridBlock()}</div>
      <aside class="pvd-panel" style={`width:${typeof panelWidth === 'number' ? panelWidth + 'px' : panelWidth}`} aria-label="Pivot panel">
        {#if showPivotToggle}{@render pivotToggle()}{/if}
        {#if showFieldList}<div class="pvd-panel-rail">{@render railBlock()}</div>{/if}
        <div class="pvd-wells pvd-wells--vertical" class:two={!showFiltersWell}>{@render wellsBlock()}</div>
      </aside>
    {:else}
      {#if showFieldList}
        <aside class="pvd-rail" aria-label="Available fields">{@render railBlock()}</aside>
      {/if}
      <div class="pvd-main">
        {#if showPivotToggle}<div class="pvd-topbar">{@render pivotToggle()}</div>{/if}
        <div class="pvd-wells" class:two={!showFiltersWell}>{@render wellsBlock()}</div>
        {@render gridBlock()}
      </div>
    {/if}
  </div>
</section>

{#if ctx}
  <div
    bind:this={ctxPanelEl}
    class="pvd-ctx"
    use:portalToBody
    use:popIn={{}}
    style:position="fixed"
    style:top={`${ctx.y}px`}
    style:left={`${ctx.x}px`}
    role="presentation"
  >
    <SvMenuList items={ctx.items} onclose={closeCtx} onselect={() => {}} />
  </div>
{/if}

<!-- ============================ Sub-blocks ============================ -->
{#snippet pivotToggle()}
  <label class="pvd-pivot-toggle">
    <input type="checkbox" checked={pivotMode} onchange={(e) => setPivotMode(e.currentTarget.checked)} />
    <span class="pvd-switch" class:on={pivotMode}><span class="pvd-switch-knob"></span></span>
    <span class="pvd-pivot-label">Pivot Mode</span>
  </label>
{/snippet}

{#snippet railBlock()}
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
          oncontextmenu={(e) => openCtx(e, fieldMenu(f.field))}
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
{/snippet}

{#snippet wellsBlock()}
  <!-- Filters -->
  {#if showFiltersWell}
    <div class="pvd-well"
      class:drag-over={dragOver === 'filters'}
      ondragover={(e) => onDragOver(e, 'filters')}
      ondragleave={onDragLeave}
      ondrop={(e) => onDrop(e, 'filters')}
      oncontextmenu={(e) => openCtx(e, wellMenu('filters'))}>
      <div class="pvd-well-head">Filters</div>
      <div class="pvd-well-body">
        {#each layout.filters as f (f.field)}
          {@const fd = fieldsByName.get(f.field)}
          <div class="pvd-chip" draggable="true" ondragstart={(e) => onDragStart(e, f.field, 'filters')} oncontextmenu={(e) => openCtx(e, chipMenu('filters', f.field))}>
            <button type="button" class="pvd-chip-label" title="Choose which values pass" onclick={() => toggleFilterMenu(f.field)}>
              {fd?.label ?? f.field}{f.allowed ? `: ${f.allowed.length}` : ''} <span class="pvd-chip-caret">▾</span>
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
    ondrop={(e) => onDrop(e, 'cols')}
    oncontextmenu={(e) => openCtx(e, wellMenu('cols'))}>
    <div class="pvd-well-head">Columns</div>
    <div class="pvd-well-body">
      {#each layout.cols as field (field)}
        {@const fd = fieldsByName.get(field)}
        <div class="pvd-chip" draggable="true" ondragstart={(e) => onDragStart(e, field, 'cols')} oncontextmenu={(e) => openCtx(e, chipMenu('cols', field))}>
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
    ondrop={(e) => onDrop(e, 'rows')}
    oncontextmenu={(e) => openCtx(e, wellMenu('rows'))}>
    <div class="pvd-well-head">Rows</div>
    <div class="pvd-well-body">
      {#each layout.rows as field (field)}
        {@const fd = fieldsByName.get(field)}
        <div class="pvd-chip" draggable="true" ondragstart={(e) => onDragStart(e, field, 'rows')} oncontextmenu={(e) => openCtx(e, chipMenu('rows', field))}>
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
    ondrop={(e) => onDrop(e, 'values')}
    oncontextmenu={(e) => openCtx(e, wellMenu('values'))}>
    <div class="pvd-well-head">Values</div>
    <div class="pvd-well-body">
      {#each layout.values as v, vi (v.field + '|' + v.agg + '|' + vi)}
        {@const fd = fieldsByName.get(v.field)}
        <div class="pvd-chip pvd-chip-value" draggable="true" ondragstart={(e) => onDragStart(e, v.field, 'values', vi)} oncontextmenu={(e) => openCtx(e, chipMenu('values', v.field, vi))}>
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
{/snippet}

{#snippet gridBlock()}
  {#if embedGrid}
    <div class="pvd-grid" style={`height:${typeof gridHeight === 'number' ? gridHeight + 'px' : gridHeight}`} oncontextmenu={(e) => openCtx(e, gridMenu())}>
      {#if showPivotToggle && !pivotMode}
        <SvGrid
          data={data}
          columns={flatColumns!}
          features={features}
          filterMode="row"
          sortable
          selectionMode="none"
          rowHeight={32}
          containerHeight="100%"
          fitColumns={gridFitColumns}
          columnVirtualization={columnVirtualization}
          enableRowSummaries={false}
        />
      {:else if pivot && chartable && view === 'chart'}
        {#if chartSpec && chartSpec.series.length}
          <div class="pvd-chart"><SvGridChart spec={chartSpec} interactive legend /></div>
        {:else}
          <div class="pvd-empty pvd-grid-empty">Add a measure and a row / column field to chart the pivot.</div>
        {/if}
      {:else if pivot}
        <SvGrid
          data={visibleRows}
          columns={finalColumns}
          features={features}
          sortable
          filterable
          selectionMode="none"
          rowHeight={32}
          containerHeight="100%"
          fitColumns={gridFitColumns}
          columnVirtualization={columnVirtualization}
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
{/snippet}

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
  .pvd-chip-caret { font-size: 9px; color: var(--sg-muted, #94a3b8); }
  .pvd-select {
    font: inherit; font-size: 12px; color: var(--sg-fg);
    background: var(--sg-input-bg, var(--sg-bg, #fff));
    border: 1px solid var(--sg-input-border, var(--sg-border, #e2e8f0));
    border-radius: var(--sg-radius, 6px); padding: 3px 6px;
  }
  .pvd-viewswitch { display: inline-flex; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 6px); overflow: hidden; }
  .pvd-view-btn { font: inherit; font-size: 12px; padding: 3px 12px; border: 0; background: var(--sg-bg, #fff); color: var(--sg-muted, #64748b); cursor: pointer; }
  .pvd-view-btn.is-active { background: var(--sg-accent, #2563eb); color: #fff; }
  .pvd-chart { width: 100%; height: 100%; padding: 8px 10px; box-sizing: border-box; overflow: hidden; display: flex; }
  .pvd-chart > :global(.sv-grid-chart) { width: 100%; }

  /* ---- Right-docked tool panel (panelPosition="right") -------------- */
  .pvd-body[data-panel='right'] {
    display: flex;
    flex-direction: row;
  }
  .pvd-gridwrap {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .pvd-gridwrap .pvd-grid { flex: 1; min-height: 0; }
  .pvd-panel {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-left: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc);
    overflow-y: auto;
  }
  .pvd-panel-rail {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 120px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .pvd-panel-rail .pvd-search {
    background: var(--sg-input-bg, var(--sg-bg, #fff));
    border: 1px solid var(--sg-input-border, var(--sg-border, #e2e8f0));
    border-radius: var(--sg-radius, 6px);
    margin: 10px 10px 6px;
    padding: 6px 9px;
  }
  .pvd-panel-rail .pvd-fieldlist { padding-bottom: 8px; }
  .pvd-wells--vertical {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-bottom: 0;
    flex: 0 0 auto;
  }
  .pvd-wells--vertical .pvd-well { min-height: 56px; background: var(--sg-bg, #fff); }

  /* ---- Pivot Mode toggle ------------------------------------------- */
  .pvd-topbar {
    padding: 8px 10px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc);
  }
  .pvd-panel > .pvd-pivot-toggle {
    padding: 12px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .pvd-pivot-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }
  .pvd-pivot-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
  .pvd-switch {
    width: 34px; height: 18px; border-radius: 999px; flex-shrink: 0;
    background: var(--sg-border, #cbd5e1);
    position: relative; transition: background 120ms ease;
  }
  .pvd-switch.on { background: var(--sg-accent, #2563eb); }
  .pvd-switch-knob {
    position: absolute; top: 2px; left: 2px;
    width: 14px; height: 14px; border-radius: 999px; background: #fff;
    transition: transform 120ms ease;
  }
  .pvd-switch.on .pvd-switch-knob { transform: translateX(16px); }
  .pvd-pivot-label { font-size: 13px; font-weight: 600; color: var(--sg-fg, #0f172a); }

  /* ---- Right-click context menu panel ------------------------------ */
  :global(.pvd-ctx) {
    z-index: 2147483646;
    min-width: 200px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    box-shadow: 0 16px 48px -12px rgba(15, 23, 42, 0.35);
    font-size: 13px;
  }

  @media (max-width: 900px) {
    .pvd-body[data-panel='right'] { flex-direction: column; }
    .pvd-panel { width: auto !important; border-left: 0; border-top: 1px solid var(--sg-border, #e2e8f0); }
    .pvd-wells--vertical { flex-direction: row; flex-wrap: wrap; }
    .pvd-wells--vertical .pvd-well { flex: 1 1 40%; }
  }
</style>
