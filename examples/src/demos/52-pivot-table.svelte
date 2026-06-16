<script lang="ts">
  /**
   * 52. Pivot table + Pivot Designer
   * ---------------------------------
   * A real Pivot Table built on top of plain SvGrid. We don't extend the
   * grid's core; we build a small pivot engine that takes a source row
   * set + a config (rows, columns, values, filters) and emits:
   *
   *   - a nested ColumnDef tree (multi-level headers like
   *     "2025 / Q1 / Revenue") that maps straight onto SvGrid's
   *     `columns?: ColumnDef[]` recursive type, and
   *
   *   - a flat array of pivoted rows with subtotal + grand-total rows
   *     marked for styling.
   *
   * The **Pivot Designer** on the left is a drag-and-drop field
   * arranger - four zones (Filters / Columns / Rows / Values) plus an
   * "Available fields" pool. Drag a chip between zones and the pivot
   * recomputes live. Click a chip in Values to change its aggregator
   * (sum / avg / count / min / max); click in Filters to pick allowed
   * values; click in Rows / Columns to remove.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'
  import { createPivotModel, type PivotRow, type PivotValueConfig } from '@svgrid/enterprise'

  // ---- Domain ---------------------------------------------------------

  type Region = 'NA' | 'EMEA' | 'APAC' | 'LATAM'
  type Channel = 'online' | 'retail' | 'partner' | 'direct'
  type Category = 'electronics' | 'home' | 'fashion' | 'kitchen' | 'sports' | 'books'

  type Fact = {
    year: number
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
    region: Region
    country: string
    channel: Channel
    category: Category
    revenue: number
    units: number
    cost: number
  }

  const REGIONS_COUNTRIES: Record<Region, string[]> = {
    NA: ['USA', 'Canada', 'Mexico'],
    EMEA: ['Germany', 'UK', 'France', 'Italy'],
    APAC: ['Japan', 'Australia', 'India', 'Singapore'],
    LATAM: ['Brazil', 'Chile', 'Argentina'],
  }
  const CHANNELS: readonly Channel[] = ['online', 'retail', 'partner', 'direct']
  const CATEGORIES: readonly Category[] = ['electronics', 'home', 'fashion', 'kitchen', 'sports', 'books']
  const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const
  const YEARS = [2024, 2025, 2026] as const

  // ---- Seed -----------------------------------------------------------

  let prng = 0xFA170DA7 >>> 0
  function rnd(): number {
    prng = (prng * 1664525 + 1013904223) >>> 0
    return prng / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }

  function seedFacts(): Fact[] {
    const out: Fact[] = []
    // ~2400 facts: enough to make sums non-trivial, small enough to pivot
    // instantly without touching virtualisation.
    for (let i = 0; i < 2400; i += 1) {
      const region = pick(['NA', 'EMEA', 'APAC', 'LATAM'] as const)
      const country = pick(REGIONS_COUNTRIES[region])
      const category = pick(CATEGORIES)
      const channel = pick(CHANNELS)
      const year = pick(YEARS)
      const quarter = pick(QUARTERS)
      const baseUnit = 8 + Math.floor(rnd() * 240)
      const unitPrice = 12 + Math.floor(rnd() * 240)
      const revenue = baseUnit * unitPrice
      out.push({
        year,
        quarter,
        region,
        country,
        channel,
        category,
        revenue,
        units: baseUnit,
        cost: Math.round(revenue * (0.35 + rnd() * 0.25)),
      })
    }
    return out
  }

  // ---- Pivot engine ---------------------------------------------------

  type Aggregator = 'sum' | 'avg' | 'count' | 'min' | 'max'
  type ValueSpec = { field: string; aggregator: Aggregator }

  type FieldType = 'dimension' | 'measure'
  type FieldDef = { field: string; label: string; type: FieldType }

  const FIELDS: FieldDef[] = [
    { field: 'year',     label: 'Year',     type: 'dimension' },
    { field: 'quarter',  label: 'Quarter',  type: 'dimension' },
    { field: 'region',   label: 'Region',   type: 'dimension' },
    { field: 'country',  label: 'Country',  type: 'dimension' },
    { field: 'channel',  label: 'Channel',  type: 'dimension' },
    { field: 'category', label: 'Category', type: 'dimension' },
    { field: 'revenue',  label: 'Revenue',  type: 'measure'   },
    { field: 'units',    label: 'Units',    type: 'measure'   },
    { field: 'cost',     label: 'Cost',     type: 'measure'   },
  ]
  const FIELD_LABEL = Object.fromEntries(FIELDS.map((f) => [f.field, f.label])) as Record<string, string>

  type FilterState = { field: string; allowed: Set<unknown> }

  type PivotedRow = {
    id: string
    depth: number
    /** Labels for each row axis up to depth. */
    labels: string[]
    /** Sentinel for the grand total + subtotal rows so we can style them. */
    kind: 'leaf' | 'subtotal' | 'grand'
    /** Numeric values keyed by `${colPath.join('|')}::${valueField}`. */
    cells: Record<string, number>
    /** Engine row id of the immediate parent group, for expand/collapse. */
    parentId: string | null
    /** True when this row has at least one descendant - draws a chevron. */
    expandable: boolean
  }

  type PivotResult = {
    rows: PivotedRow[]
    /** Multi-level column header tree, ready to drop into SvGrid. */
    columnTree: ColumnDef<typeof features, PivotedRow>[]
    /** Flat list of leaf column keys, in display order. */
    leafColKeys: string[]
  }

  // -- helpers --

  function getDistinct<T>(rows: Fact[], field: keyof Fact): T[] {
    const set = new Set<T>()
    for (const r of rows) set.add(r[field] as T)
    return Array.from(set).sort(compareForKey)
  }
  function compareForKey(a: unknown, b: unknown): number {
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a).localeCompare(String(b))
  }
  /** Suffix used to detect a column's measure field from its engine id.
   *  The engine emits ids like `pv__<axis-segments>__m<measureIndex>`. */
  function measureFieldFromColId(colId: string, values: ValueSpec[]): string | null {
    const m = colId.match(/__m(\d+)$/)
    if (!m) return null
    const idx = Number(m[1])
    return values[idx]?.field ?? null
  }

  // -- core pivot (powered by @svgrid/enterprise's createPivotModel) --

  type SortSpec = { columnId: string; desc: boolean } | null

  type AnyColDef = ColumnDef<typeof features, PivotedRow>

  /**
   * Apply the designer's filters, hand the filtered facts + the
   * config to `createPivotModel`, then translate its output into the
   * demo's existing `PivotedRow` / `PivotResult` shape (so the KPI
   * strip, ValueCell renderer, and click-sort code below stay
   * unchanged).
   *
   * Trade-off vs the previous hand-rolled engine: the shipped engine
   * sorts each axis lexically. Pivot-aware *value* sort (sort group
   * rows by their subtotal in a clicked value column) is still done
   * here by re-emitting `legacyRows` in sorted order, walking the
   * parent-id chain to keep subtotals next to their children.
   */
  function buildPivot(
    source: Fact[],
    rowFields: string[],
    colFields: string[],
    values: ValueSpec[],
    filters: FilterState[],
    sortSpec: SortSpec,
  ): PivotResult {
    // 1) Apply designer filters BEFORE handing to the engine. The
    //    engine itself doesn't take filters as a config field.
    const filtered = source.filter((row) => {
      for (const f of filters) {
        if (f.allowed.size === 0) continue
        const v = (row as unknown as Record<string, unknown>)[f.field]
        if (!f.allowed.has(v)) return false
      }
      return true
    })

    // 2) Map the designer's ValueSpec[] to the engine's value config.
    const engineValues: PivotValueConfig<Fact>[] = values.map((v) => ({
      field: v.field as keyof Fact & string,
      agg: v.aggregator,
      label: `${FIELD_LABEL[v.field]} (${v.aggregator})`,
    }))

    // 3) Run the shipped engine.
    const result = createPivotModel<typeof features, Fact>(filtered, {
      rows: rowFields as ReadonlyArray<keyof Fact & string>,
      cols: colFields as ReadonlyArray<keyof Fact & string>,
      values: engineValues,
      grandTotalRow: true,
      grandTotalCol: false,
      rowSubtotals: true,
    })

    // 4) Translate engine rows -> demo's PivotedRow. The demo's KPI
    //    strip + ValueCell read `row.cells[colId]`, but the engine
    //    attaches values directly onto the row object. Promote those
    //    onto a `cells` sub-object so existing readers don't change.
    const labelStack: string[] = []
    let lastDepth = -1
    const legacyRows: PivotedRow[] = result.rows.map((r) => {
      // Adjust the ancestor-label stack to the current row depth so the
      // `labels: string[]` array matches what the old engine produced.
      while (labelStack.length > r.__pivotDepth) labelStack.pop()
      if (r.__pivotDepth > lastDepth) labelStack.push(r.__pivotLabel)
      else labelStack[labelStack.length - 1] = r.__pivotLabel
      lastDepth = r.__pivotDepth

      const cells: Record<string, number> = {}
      for (const [k, v] of Object.entries(r)) {
        if (!k.startsWith('pv__')) continue
        cells[k] = typeof v === 'number' ? v : Number(v ?? 0)
      }
      return {
        id: r.__pivotId,
        depth: r.__pivotDepth,
        labels: labelStack.slice(),
        kind:
          r.__pivotKind === 'grandTotal' ? 'grand' :
          r.__pivotKind === 'group'      ? 'subtotal' :
                                           'leaf',
        cells,
        parentId: r.__pivotParentId,
        expandable: r.__pivotExpandable,
      }
    })

    // 5) Pivot-aware sort. The shipped engine emits axis values lexically;
    //    when the user clicks a value column we re-emit rows in pivot-
    //    correct order (grand stays at top, group rows ordered by their
    //    own value in the clicked column, leaves stay grouped under
    //    their parent).
    const finalRows = sortSpec
      ? pivotSort(legacyRows, sortSpec, result.rows)
      : legacyRows

    // 6) Decorate the engine's column tree:
    //    - Replace the engine's first column with the demo's custom
    //      LabelCell renderer (chip layout, badges, etc).
    //    - Add the demo's ValueCell renderer to every leaf so cells get
    //      formatted as currency / count.
    const labelHeaderText =
      rowFields.map((f) => FIELD_LABEL[f] ?? f).join(' / ') ||
      '(no row dimension)'
    const labelCol: AnyColDef = {
      id: '__label',
      header: () => renderSnippet(LabelHeader, { text: labelHeaderText }),
      width: 240,
      editable: false,
      cell: (ctx) => renderSnippet(LabelCell, { row: ctx.row.original }),
    }
    const valueCols = (result.columns.slice(1) as unknown as AnyColDef[]).map(decorate)
    function decorate(col: AnyColDef): AnyColDef {
      if (col.columns?.length) {
        return { ...col, columns: col.columns.map(decorate) }
      }
      // Leaf value column. Resolve the measure field from the engine's
      // `pv__<axis>__m<i>` id so ValueCell can pick the right format.
      const field = measureFieldFromColId(col.id ?? '', values) ?? 'revenue'
      return {
        ...col,
        editable: false,
        width: col.width ?? 130,
        cell: (ctx) =>
          renderSnippet(ValueCell, {
            row: ctx.row.original,
            colKey: col.id ?? '',
            field,
          }),
      }
    }

    // 7) Leaf column keys, in display order, for the KPI strip's
    //    grand-total reader.
    const leafColKeys: string[] = []
    const collect = (col: AnyColDef) => {
      if (col.columns?.length) col.columns.forEach(collect)
      else if (col.id) leafColKeys.push(col.id)
    }
    valueCols.forEach(collect)

    return {
      rows: finalRows,
      columnTree: [labelCol, ...valueCols],
      leafColKeys,
    }
  }

  /**
   * Re-emit `legacyRows` in pivot-aware order for the active sort spec.
   * The grand-total row stays at index 0; group rows are ordered by
   * their value in `sortSpec.columnId`; leaves stay attached to their
   * parent group.
   *
   * We walk the engine's original `PivotRow[]` in parallel because it
   * carries the `__pivotParentId` chain we need to group children
   * under their parent.
   */
  function pivotSort(
    legacyRows: PivotedRow[],
    sortSpec: NonNullable<SortSpec>,
    engineRows: ReadonlyArray<PivotRow>,
  ): PivotedRow[] {
    // Index by engine id so we can find every row's parent + value.
    const engineById = new Map<string, PivotRow>()
    for (const r of engineRows) engineById.set(r.__pivotId, r)
    const legacyById = new Map<string, PivotedRow>()
    for (const r of legacyRows) legacyById.set(r.id, r)

    // Group children by parent.
    const childrenOf = new Map<string | null, PivotRow[]>()
    for (const r of engineRows) {
      const list = childrenOf.get(r.__pivotParentId) ?? []
      list.push(r)
      childrenOf.set(r.__pivotParentId, list)
    }

    function sortKey(r: PivotRow): number {
      if (sortSpec.columnId === '__label') return 0
      const v = r[sortSpec.columnId]
      return typeof v === 'number' ? v : Number.NEGATIVE_INFINITY
    }
    function compare(a: PivotRow, b: PivotRow): number {
      if (sortSpec.columnId === '__label') {
        const cmp = compareForKey(a.__pivotLabel, b.__pivotLabel)
        return sortSpec.desc ? -cmp : cmp
      }
      const cmp = sortKey(a) - sortKey(b)
      return sortSpec.desc ? -cmp : cmp
    }

    const out: PivotedRow[] = []
    function emit(parentId: string | null): void {
      const children = (childrenOf.get(parentId) ?? []).slice()
      children.sort(compare)
      for (const child of children) {
        const legacy = legacyById.get(child.__pivotId)
        if (legacy) out.push(legacy)
        emit(child.__pivotId)
      }
    }
    // Grand total (parentId === null and kind === 'grandTotal') stays
    // pinned at the bottom by the engine; we keep it there by emitting
    // null-parent children but pushing grandTotal LAST.
    const topLevel = (childrenOf.get(null) ?? []).slice()
    const topGroups = topLevel.filter((r) => r.__pivotKind !== 'grandTotal')
    const grand = topLevel.find((r) => r.__pivotKind === 'grandTotal')
    topGroups.sort(compare)
    for (const g of topGroups) {
      const legacy = legacyById.get(g.__pivotId)
      if (legacy) out.push(legacy)
      emit(g.__pivotId)
    }
    if (grand) {
      const legacy = legacyById.get(grand.__pivotId)
      if (legacy) out.push(legacy)
    }
    return out
  }

  // ---- Reactive state -------------------------------------------------

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const facts: Fact[] = seedFacts()

  // Designer state.
  let rowFields = $state<string[]>(['region', 'country'])
  let colFields = $state<string[]>(['year', 'quarter'])
  let valueSpecs = $state<ValueSpec[]>([
    { field: 'revenue', aggregator: 'sum' },
    { field: 'units', aggregator: 'sum' },
  ])
  let filters = $state<FilterState[]>([])

  // Drag state.
  type DragSource = { from: ZoneId; field: string }
  type ZoneId = 'available' | 'rows' | 'cols' | 'values' | 'filters'
  let dragging = $state<DragSource | null>(null)
  let dropHover = $state<ZoneId | null>(null)

  // Filter popover state.
  let openFilter = $state<string | null>(null)

  // Click-to-sort state. SvGrid raises onSortingChange when the user
  // clicks a column header; we mirror the latest clause into our own
  // spec and re-emit pivot rows from buildPivot in pivot-aware order
  // (grand total stays at top; groups sort by their subtotal; leaves
  // sort by the same value within their group).
  let sortSpec = $state<SortSpec>(null)

  // Pivot result is recomputed whenever any input changes.
  const pivot = $derived.by(() => buildPivot(facts, rowFields, colFields, valueSpecs, filters, sortSpec))

  // Track which groups the user has *collapsed* rather than which ones
  // are expanded. Default = empty set = everything expanded - which is
  // exactly the "expanded by default" UX. New pivot rows (after dragging
  // a different dimension) automatically appear expanded because they
  // are not in `collapsedIds`. This pattern avoids the $effect that
  // reads-and-writes the same state and so cannot loop.
  let collapsedIds = $state<Set<string>>(new Set())

  /** Public expansion state derived from the collapse set. */
  const expandedIds = $derived.by(() => {
    const set = new Set<string>()
    for (const r of pivot.rows) if (r.expandable && !collapsedIds.has(r.id)) set.add(r.id)
    return set
  })

  function toggleExpand(id: string) {
    const next = new Set(collapsedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    collapsedIds = next
  }

  /** Filter pivot rows by the current expansion set. Walk the parent
   *  chain - a row is visible only when every ancestor is expanded.
   *  Top-level rows (parentId === null) are always visible. */
  const visibleRows = $derived.by(() => {
    const parentOf = new Map<string, string | null>()
    for (const r of pivot.rows) parentOf.set(r.id, r.parentId)
    const out: PivotedRow[] = []
    for (const row of pivot.rows) {
      if (row.parentId === null) { out.push(row); continue }
      let pid: string | null = row.parentId
      let visible = true
      while (pid !== null) {
        if (!expandedIds.has(pid)) { visible = false; break }
        pid = parentOf.get(pid) ?? null
      }
      if (visible) out.push(row)
    }
    return out
  })

  // KPI strip context. The engine's column ids look like
  // `pv__<axis>__m<measureIndex>` (NOT `<axis>::<field>`), so we map
  // each leaf key back to its measure field via valueSpecs ordering
  // before bucketing into revenue / units / cost.
  const kpis = $derived.by(() => {
    const grand = pivot.rows[0]
    if (!grand) return { revenue: 0, units: 0, cost: 0, margin: 0 }
    let revenue = 0
    let units = 0
    let cost = 0
    for (const k of pivot.leafColKeys) {
      const field = measureFieldFromColId(k, valueSpecs)
      if (!field) continue
      const v = grand.cells[k] ?? 0
      if (field === 'revenue') revenue += v
      else if (field === 'units') units += v
      else if (field === 'cost') cost += v
    }
    return { revenue, units, cost, margin: revenue > 0 ? (revenue - cost) / revenue : 0 }
  })

  // ---- Drag-and-drop helpers ------------------------------------------

  function fieldsInZone(zone: ZoneId): string[] {
    if (zone === 'rows') return rowFields
    if (zone === 'cols') return colFields
    if (zone === 'values') return valueSpecs.map((v) => v.field)
    if (zone === 'filters') return filters.map((f) => f.field)
    // Available pool: everything not used elsewhere
    const used = new Set([
      ...rowFields, ...colFields, ...valueSpecs.map((v) => v.field), ...filters.map((f) => f.field),
    ])
    return FIELDS.filter((f) => !used.has(f.field)).map((f) => f.field)
  }

  function removeFromZone(zone: ZoneId, field: string): void {
    if (zone === 'rows') rowFields = rowFields.filter((x) => x !== field)
    else if (zone === 'cols') colFields = colFields.filter((x) => x !== field)
    else if (zone === 'values') valueSpecs = valueSpecs.filter((v) => v.field !== field)
    else if (zone === 'filters') filters = filters.filter((f) => f.field !== field)
  }

  function defaultAggFor(field: string): Aggregator {
    // Sum is the right default for revenue/units/cost; count for dimensions.
    return FIELDS.find((f) => f.field === field)?.type === 'measure' ? 'sum' : 'count'
  }

  function addToZone(zone: ZoneId, field: string): void {
    // Already there? no-op.
    if (fieldsInZone(zone).includes(field)) return
    // Measures only make sense in values + filters; dimensions in rows/cols + filters.
    const def = FIELDS.find((f) => f.field === field)
    if (!def) return
    if (zone === 'rows' && def.type === 'measure') return
    if (zone === 'cols' && def.type === 'measure') return
    if (zone === 'rows') rowFields = [...rowFields, field]
    else if (zone === 'cols') colFields = [...colFields, field]
    else if (zone === 'values') valueSpecs = [...valueSpecs, { field, aggregator: defaultAggFor(field) }]
    else if (zone === 'filters') {
      // Seed with every distinct value (i.e. no restriction).
      filters = [...filters, { field, allowed: new Set() }]
    }
  }

  function moveField(from: ZoneId, to: ZoneId, field: string): void {
    if (from === to) return
    removeFromZone(from, field)
    addToZone(to, field)
  }

  function onDragStart(e: DragEvent, from: ZoneId, field: string): void {
    dragging = { from, field }
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', field)
    }
  }
  function onDragOver(e: DragEvent, zone: ZoneId): void {
    if (!dragging) return
    e.preventDefault()
    dropHover = zone
  }
  function onDrop(e: DragEvent, zone: ZoneId): void {
    e.preventDefault()
    if (!dragging) return
    moveField(dragging.from, zone, dragging.field)
    dragging = null
    dropHover = null
  }
  function onDragEnd(): void { dragging = null; dropHover = null }

  // ---- Value chip / filter chip actions -------------------------------

  const AGGS: Aggregator[] = ['sum', 'avg', 'count', 'min', 'max']
  function cycleAggregator(field: string): void {
    valueSpecs = valueSpecs.map((v) => {
      if (v.field !== field) return v
      const i = AGGS.indexOf(v.aggregator)
      return { ...v, aggregator: AGGS[(i + 1) % AGGS.length]! }
    })
  }

  function distinctValuesFor(field: string): unknown[] {
    const set = new Set<unknown>()
    for (const r of facts) set.add((r as unknown as Record<string, unknown>)[field])
    return Array.from(set).sort(compareForKey)
  }
  function toggleFilterValue(field: string, value: unknown): void {
    filters = filters.map((f) => {
      if (f.field !== field) return f
      const next = new Set(f.allowed)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...f, allowed: next }
    })
  }
  function clearFilterValues(field: string): void {
    filters = filters.map((f) => f.field === field ? { ...f, allowed: new Set() } : f)
  }

  // ---- Row-header sort menu (OLAP style) ------------------------------

  let labelMenuOpen = $state(false)
  let labelMenuPos = $state<{ x: number; y: number }>({ x: 0, y: 0 })

  function openLabelMenu(e: MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    labelMenuPos = { x: rect.left, y: rect.bottom + 4 }
    labelMenuOpen = true
  }
  function closeLabelMenu(): void { labelMenuOpen = false }
  function sortLabelsAsc():  void { sortSpec = { columnId: '__label', desc: false }; labelMenuOpen = false }
  function sortLabelsDesc(): void { sortSpec = { columnId: '__label', desc: true  }; labelMenuOpen = false }
  function clearLabelSort(): void { sortSpec = null; labelMenuOpen = false }

  function expandAll(): void { collapsedIds = new Set() }
  function collapseAll(): void {
    const next = new Set<string>()
    for (const r of pivot.rows) if (r.expandable) next.add(r.id)
    collapsedIds = next
  }

  const labelSortDirection = $derived(
    sortSpec?.columnId === '__label' ? (sortSpec.desc ? 'desc' : 'asc') : null,
  )

  // ---- Formatters -----------------------------------------------------

  function fmtNum(n: number): string {
    if (!isFinite(n)) return '-'
    if (Math.abs(n) >= 1_000_000) return n.toLocaleString('en-US', { maximumFractionDigits: 1, notation: 'compact' })
    return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }
  function fmtMoneyK(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`
    return `$${n.toFixed(0)}`
  }
  function fmtPct(n: number): string { return `${Math.round(n * 100)}%` }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet LabelHeader(props: { text: string })}
  <span class="pv-lhdr">
    <span class="pv-lhdr-text">{props.text}</span>
    {#if labelSortDirection === 'asc'}
      <span class="pv-lhdr-sort" title="Row labels sorted A→Z" aria-hidden="true">↑</span>
    {:else if labelSortDirection === 'desc'}
      <span class="pv-lhdr-sort" title="Row labels sorted Z→A" aria-hidden="true">↓</span>
    {/if}
    <button
      type="button"
      class="pv-lhdr-menu-btn"
      class:is-open={labelMenuOpen}
      aria-label="Row label menu"
      aria-haspopup="menu"
      aria-expanded={labelMenuOpen}
      onclick={openLabelMenu}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
        <circle cx="3"  cy="8" r="1.4" />
        <circle cx="8"  cy="8" r="1.4" />
        <circle cx="13" cy="8" r="1.4" />
      </svg>
    </button>
  </span>
{/snippet}

{#snippet LabelCell(props: { row: PivotedRow })}
  {@const isExpanded = expandedIds.has(props.row.id)}
  <span
    class={`pv-label pv-kind-${props.row.kind}`}
    style={`padding-left: ${props.row.depth * 14}px`}
  >
    {#if props.row.expandable}
      <button
        type="button"
        class={`pv-chev ${isExpanded ? 'pv-chev-open' : ''}`}
        aria-label={isExpanded ? 'Collapse' : 'Expand'}
        aria-expanded={isExpanded}
        onclick={(e) => { if (e.button !== 0) return; toggleExpand(props.row.id) }}
        oncontextmenu={(e) => e.preventDefault()}
      >
        <svg viewBox="0 0 16 16" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="5 3 11 8 5 13" />
        </svg>
      </button>
    {:else}
      <span class="pv-chev-spacer" aria-hidden="true"></span>
    {/if}
    <span class="pv-label-text">{props.row.labels[props.row.labels.length - 1] ?? ''}</span>
  </span>
{/snippet}

{#snippet ValueCell(props: { row: PivotedRow; colKey: string; field: string })}
  {@const v = props.row.cells[props.colKey] ?? 0}
  <span class={`pv-val pv-kind-${props.row.kind} ${props.field === 'revenue' || props.field === 'cost' ? 'pv-val-money' : ''}`}>
    {props.field === 'revenue' || props.field === 'cost' ? fmtMoneyK(v) : fmtNum(v)}
  </span>
{/snippet}

<!-- ───────────────────── ZONE COMPONENT ───────────────────── -->

{#snippet Zone(props: {
  id: ZoneId
  label: string
  hint: string
  acceptsLabel?: string
  empty?: string
})}
  <div
    class={`pv-zone pv-zone-${props.id} ${dropHover === props.id ? 'pv-zone-hot' : ''}`}
    ondragover={(e) => onDragOver(e, props.id)}
    ondragleave={() => { if (dropHover === props.id) dropHover = null }}
    ondrop={(e) => onDrop(e, props.id)}
    role="region"
    aria-label={props.label}
  >
    <div class="pv-zone-head">
      <span class="pv-zone-title">{props.label}</span>
      <span class="pv-zone-hint">{props.hint}</span>
    </div>
    <div class="pv-chips">
      {#each fieldsInZone(props.id) as field (field)}
        {@const def = FIELDS.find((f) => f.field === field)}
        {@const valSpec = valueSpecs.find((v) => v.field === field)}
        {@const filt = filters.find((f) => f.field === field)}
        <div
          class={`pv-chip pv-chip-${def?.type ?? 'dimension'} ${props.id === 'values' ? 'pv-chip-value' : ''}`}
          draggable="true"
          ondragstart={(e) => onDragStart(e, props.id, field)}
          ondragend={onDragEnd}
        >
          <span class="pv-chip-label">{FIELD_LABEL[field] ?? field}</span>
          {#if props.id === 'values' && valSpec}
            <button type="button" class="pv-chip-agg" onclick={() => cycleAggregator(field)} title="Click to cycle aggregator">
              {valSpec.aggregator}
            </button>
          {/if}
          {#if props.id === 'filters' && filt}
            <button type="button" class="pv-chip-filter" onclick={() => (openFilter = openFilter === field ? null : field)} title="Edit filter values">
              {filt.allowed.size === 0 ? 'all' : `${filt.allowed.size} sel`}
            </button>
          {/if}
          {#if props.id !== 'available'}
            <button type="button" class="pv-chip-x" aria-label="Remove" onclick={() => removeFromZone(props.id, field)}>×</button>
          {/if}
        </div>
        {#if props.id === 'filters' && openFilter === field && filt}
          <div class="pv-filter-pop">
            <div class="pv-filter-pop-head">
              <span>Allow values for {FIELD_LABEL[field]}</span>
              <button type="button" class="pv-mini-btn" onclick={() => clearFilterValues(field)}>All</button>
            </div>
            <div class="pv-filter-pop-list">
              {#each distinctValuesFor(field) as v, i (i)}
                <label class="pv-filter-opt">
                  <input
                    type="checkbox"
                    checked={filt.allowed.has(v)}
                    onchange={() => toggleFilterValue(field, v)}
                  />
                  <span>{String(v)}</span>
                </label>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
      {#if fieldsInZone(props.id).length === 0}
        <div class="pv-zone-empty">{props.empty ?? 'Drop fields here'}</div>
      {/if}
    </div>
  </div>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="pv-shell flex flex-1 min-h-0 gap-3">
  <!-- Pivot Designer (left) -->
  <aside class="pv-designer">
    <header class="pv-designer-head">
      <span class="pv-designer-title">Pivot Designer</span>
      <span class="pv-designer-sub">Drag fields between zones; the table recomputes live.</span>
    </header>

    {@render Zone({ id: 'available', label: 'Available fields', hint: 'drag to a zone below', empty: 'All fields in use' })}
    {@render Zone({ id: 'filters',  label: 'Filters',  hint: 'restrict source rows',           empty: 'No filters' })}
    {@render Zone({ id: 'cols',     label: 'Columns',  hint: 'pivot horizontally',             empty: 'No column axis' })}
    {@render Zone({ id: 'rows',     label: 'Rows',     hint: 'pivot vertically',               empty: 'No row axis' })}
    {@render Zone({ id: 'values',   label: 'Values',   hint: 'click chip to pick aggregator',  empty: 'No measures' })}
  </aside>

  <!-- Pivot output (right) -->
  <div class="pv-output flex-1 min-w-0 flex flex-col">
    <div class="pv-kpi-strip">
      <div class="pv-kpi">
        <div class="pv-kpi-label">Revenue</div>
        <div class="pv-kpi-value tabular-nums">{fmtMoneyK(kpis.revenue)}</div>
      </div>
      <div class="pv-kpi">
        <div class="pv-kpi-label">Units</div>
        <div class="pv-kpi-value tabular-nums">{fmtNum(kpis.units)}</div>
      </div>
      <div class="pv-kpi">
        <div class="pv-kpi-label">Cost</div>
        <div class="pv-kpi-value tabular-nums">{fmtMoneyK(kpis.cost)}</div>
      </div>
      <div class="pv-kpi">
        <div class="pv-kpi-label">Margin</div>
        <div class={`pv-kpi-value tabular-nums ${kpis.margin >= 0.4 ? 'pv-up' : kpis.margin < 0.25 ? 'pv-down' : ''}`}>{fmtPct(kpis.margin)}</div>
      </div>
      <div class="pv-kpi pv-kpi-meta">
        <div class="pv-kpi-label">Pivot</div>
        <div class="pv-kpi-meta-row">
          <span class="pv-meta-pill">{rowFields.length} row dims</span>
          <span class="pv-meta-pill">{colFields.length} col dims</span>
          <span class="pv-meta-pill">{valueSpecs.length} measures</span>
        </div>
      </div>
    </div>

    <div class="pv-olap-bar">
      <div class="pv-olap-bar-left">
        <span class="pv-olap-bar-title">OLAP rows</span>
        <span class="pv-olap-bar-hint">{rowFields.length} dimension{rowFields.length === 1 ? '' : 's'}</span>
      </div>
      <div class="pv-olap-bar-right">
        <button type="button" class="pv-olap-btn" onclick={expandAll}   title="Expand every group">Expand all</button>
        <button type="button" class="pv-olap-btn" onclick={collapseAll} title="Collapse every group">Collapse all</button>
        <span class="pv-olap-divider" aria-hidden="true"></span>
        <span class="pv-olap-sort-status">
          {#if labelSortDirection === 'asc'}Sorted A→Z
          {:else if labelSortDirection === 'desc'}Sorted Z→A
          {:else}Natural order{/if}
        </span>
      </div>
    </div>

    <div class="flex-1 min-h-0 pv-grid-wrap">
      <SvGrid
        data={visibleRows}
        columns={pivot.columnTree}
        features={features}
        filterMode="menu"
        selectionMode="row"
        showRowSelection={false}
        showPagination={false}
        enableInlineEditing={false}
        enableCellSelection={true}
        enableRowSummaries={false}
        rowHeight={32}
        containerHeight="100%"
        fitColumns={false}
        onSortingChange={(sorting) => {
          // Mirror the latest sort clause into our own spec. Without
          // accessorFn/field on our columns, SvGrid's own sort is a
          // no-op (compares undefined values), so we own the ordering.
          const last = sorting[sorting.length - 1] ?? null
          sortSpec = last ? { columnId: last.id, desc: last.desc } : null
        }}
      />
    </div>
  </div>
</section>

{#if labelMenuOpen}
  <button
    type="button"
    class="pv-menu-backdrop"
    aria-label="Close menu"
    onclick={closeLabelMenu}
    onkeydown={(e) => { if (e.key === 'Escape') closeLabelMenu() }}
  ></button>
  <div
    class="pv-menu"
    role="menu"
    aria-label="Row label sort"
    style={`left: ${labelMenuPos.x}px; top: ${labelMenuPos.y}px;`}
  >
    <button type="button" class="pv-menu-item" class:is-active={labelSortDirection === 'asc'}  role="menuitem" onclick={sortLabelsAsc}>
      <span class="pv-menu-icon" aria-hidden="true">↑</span>
      <span>Sort A→Z</span>
    </button>
    <button type="button" class="pv-menu-item" class:is-active={labelSortDirection === 'desc'} role="menuitem" onclick={sortLabelsDesc}>
      <span class="pv-menu-icon" aria-hidden="true">↓</span>
      <span>Sort Z→A</span>
    </button>
    <div class="pv-menu-sep" aria-hidden="true"></div>
    <button type="button" class="pv-menu-item" role="menuitem" disabled={labelSortDirection === null} onclick={clearLabelSort}>
      <span class="pv-menu-icon" aria-hidden="true">×</span>
      <span>Clear sort</span>
    </button>
  </div>
{/if}

<style>
  .pv-shell { min-height: 0; }

  /* Designer */
  .pv-designer {
    width: 300px;
    flex-shrink: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    display: flex;
    flex-direction: column;
    overflow: auto;
  }
  .pv-designer-head {
    padding: 12px 14px 10px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.06), rgba(236, 72, 153, 0.04));
  }
  :global([data-theme='dark']) .pv-designer-head {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(236, 72, 153, 0.08));
  }
  .pv-designer-title { font-size: 14px; font-weight: 700; }
  .pv-designer-sub { display: block; font-size: 11px; color: var(--sg-muted, #64748b); margin-top: 3px; }

  .pv-zone {
    border-top: 1px solid var(--sg-border, #e2e8f0);
    padding: 10px 12px;
    transition: background 100ms ease;
  }
  .pv-zone-hot { background: rgba(99, 102, 241, 0.08); }
  :global([data-theme='dark']) .pv-zone-hot { background: rgba(99, 102, 241, 0.18); }
  .pv-zone-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
  .pv-zone-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-fg, #1e293b);
  }
  .pv-zone-hint { font-size: 10.5px; color: var(--sg-muted, #64748b); }
  .pv-chips { display: flex; flex-direction: column; gap: 4px; }
  .pv-zone-available .pv-chips { flex-direction: row; flex-wrap: wrap; }

  .pv-zone-empty {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    font-style: italic;
    padding: 6px 8px;
    border: 1px dashed var(--sg-border, #cbd5e1);
    border-radius: 6px;
  }

  .pv-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--sg-header-bg, #f1f5f9);
    cursor: grab;
    font-size: 12px;
    user-select: none;
  }
  .pv-chip:active { cursor: grabbing; }
  .pv-chip-dimension { background: #e0e7ff; color: #4338ca; }
  .pv-chip-measure   { background: #dcfce7; color: #166534; }
  :global([data-theme='dark']) .pv-chip-dimension { background: rgba(99,102,241,.22); color: #c7d2fe; }
  :global([data-theme='dark']) .pv-chip-measure   { background: rgba(34,197,94,.18); color: #86efac; }

  .pv-chip-label { font-weight: 600; }
  .pv-chip-agg {
    border: 0;
    background: rgba(15, 23, 42, 0.1);
    color: inherit;
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 700;
    cursor: pointer;
  }
  .pv-chip-filter {
    border: 0;
    background: rgba(15, 23, 42, 0.1);
    color: inherit;
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 10.5px;
    cursor: pointer;
  }
  .pv-chip-x {
    margin-left: auto;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    opacity: 0.5;
  }
  .pv-chip-x:hover { opacity: 1; }

  .pv-filter-pop {
    margin: 4px 0 0 6px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
    background: var(--sg-bg, #ffffff);
    padding: 8px;
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
  }
  .pv-filter-pop-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    margin-bottom: 4px;
  }
  .pv-mini-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 4px;
    padding: 1px 6px;
    font-size: 10.5px;
    cursor: pointer;
  }
  .pv-filter-pop-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 220px;
    overflow: auto;
  }
  .pv-filter-opt {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    cursor: pointer;
    padding: 1px 0;
  }

  /* Output */
  .pv-output { min-height: 0; }
  .pv-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    flex-shrink: 0;
    margin-bottom: 10px;
  }
  .pv-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 10px 12px;
  }
  .pv-kpi-label {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 4px;
  }
  .pv-kpi-value { font-size: 20px; font-weight: 700; line-height: 1.1; }
  .pv-up { color: #16a34a; }
  .pv-down { color: #dc2626; }
  :global([data-theme='dark']) .pv-up { color: #4ade80; }
  :global([data-theme='dark']) .pv-down { color: #f87171; }
  .pv-kpi-meta-row { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px; }
  .pv-meta-pill {
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
  }

  .pv-grid-wrap {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }

  /* Pivot cells */
  :global(.pv-label) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
  }
  :global(.pv-label-text) { line-height: 1.2; }
  :global(.pv-chev) {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px;
    border: 0; background: transparent;
    color: var(--sg-muted, #64748b);
    cursor: pointer; border-radius: 3px;
    padding: 0;
    flex-shrink: 0;
    transition: transform 120ms ease, background 120ms ease, color 120ms ease;
  }
  :global(.pv-chev:hover)   { background: var(--sg-row-hover-bg, rgba(148,163,184,0.18)); color: var(--sg-fg, #0f172a); }
  :global(.pv-chev-open)    { transform: rotate(90deg); }
  :global(.pv-chev-spacer)  { display: inline-block; width: 16px; height: 16px; flex-shrink: 0; }
  :global(.pv-val) {
    font-variant-numeric: tabular-nums;
    font-size: 12.5px;
  }
  :global(.pv-kind-subtotal),
  :global(.pv-kind-grand) {
    font-weight: 700;
  }
  :global(.pv-kind-grand) {
    color: var(--sg-accent, #2563eb);
  }
  :global([data-theme='dark']) :global(.pv-kind-grand) { color: #93c5fd; }

  /* OLAP toolbar */
  .pv-olap-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 10px;
    margin-bottom: 8px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    background: var(--sg-bg, #ffffff);
    flex-shrink: 0;
  }
  .pv-olap-bar-left  { display: flex; align-items: baseline; gap: 8px; }
  .pv-olap-bar-right { display: flex; align-items: center; gap: 6px; }
  .pv-olap-bar-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .pv-olap-bar-hint { font-size: 11px; color: var(--sg-muted, #64748b); }
  .pv-olap-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    padding: 4px 10px;
    border-radius: 5px;
    font-size: 11.5px;
    cursor: pointer;
  }
  .pv-olap-btn:hover { background: var(--sg-header-bg, #f1f5f9); }
  .pv-olap-divider { width: 1px; height: 18px; background: var(--sg-border, #e2e8f0); margin: 0 4px; }
  .pv-olap-sort-status {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    font-variant-numeric: tabular-nums;
  }

  /* Row-label custom header */
  :global(.pv-lhdr) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    width: 100%;
  }
  :global(.pv-lhdr-text) { font-weight: 600; }
  :global(.pv-lhdr-sort) {
    color: var(--sg-accent, #2563eb);
    font-weight: 700;
    font-size: 12px;
  }
  :global(.pv-lhdr-menu-btn) {
    margin-left: auto;
    border: 0;
    background: transparent;
    color: var(--sg-muted, #64748b);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    line-height: 0;
  }
  :global(.pv-lhdr-menu-btn:hover),
  :global(.pv-lhdr-menu-btn.is-open) {
    background: rgba(99, 102, 241, 0.15);
    color: var(--sg-fg, #1e293b);
  }

  /* Sort menu popover */
  .pv-menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 999;
    background: transparent;
    border: 0;
    padding: 0;
    cursor: default;
  }
  .pv-menu {
    position: fixed;
    z-index: 1000;
    min-width: 180px;
    background: var(--sg-bg, #ffffff);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.16);
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .pv-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    border: 0;
    background: transparent;
    color: var(--sg-fg, #1e293b);
    padding: 7px 10px;
    border-radius: 5px;
    font-size: 12.5px;
    cursor: pointer;
    text-align: left;
  }
  .pv-menu-item:hover:not(:disabled) {
    background: var(--sg-header-bg, #f1f5f9);
  }
  .pv-menu-item:disabled { opacity: 0.45; cursor: default; }
  .pv-menu-item.is-active {
    color: var(--sg-accent, #2563eb);
    font-weight: 700;
  }
  .pv-menu-icon {
    display: inline-block;
    width: 14px;
    text-align: center;
    font-weight: 700;
    color: var(--sg-muted, #64748b);
  }
  .pv-menu-item.is-active .pv-menu-icon { color: var(--sg-accent, #2563eb); }
  .pv-menu-sep {
    height: 1px;
    background: var(--sg-border, #e2e8f0);
    margin: 4px 2px;
  }
</style>
