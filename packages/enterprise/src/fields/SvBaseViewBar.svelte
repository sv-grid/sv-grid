<script lang="ts">
  /**
   * SvBaseViewBar - the bar over a fields table: the view switcher (saved
   * views of any type), then Hide fields, Filter, Group, Sort, Color and Row
   * height, the record count and search. Mounted above the grid with the
   * grid's api; every setting goes through the grid's own state, so a view
   * is what `api.getState()` says plus its row height and colors.
   *
   * ```svelte
   * <SvBaseViewBar {api} bind:views bind:activeView />
   * <SvGrid {data} {columns} onApiReady={(a) => (api = a)} />
   * ```
   */
  import { panelFocus } from './viewbar/panel-focus'
  import { tick, untrack } from 'svelte'
  import { SvPopover, hasGanttView } from '@svgrid/grid'
  import { conditionCount, isGroup, isComplete, type FieldFilter, type LinkNames } from './filter-model'
  import { fieldColumns, gridOf, groupLeaves, leafFilter, primaryIdOf } from './grid-access'
  import { getLinkedTable, linkedRows } from './sources.svelte'
  import { PLAIN_STATE, applyColor, applyGanttSettings, applyView, boardConfig, captureView, galleryConfig, colorSettingOf, newViewId, viewTypeInfo, type ColorSetting, type FieldView, type FieldViewType } from './view-model'
  import { groupRules, userSorts } from './viewbar/sort-state'
  import { recordHeightOf, syncGroupRowHeight } from './row-height'
  import HideFieldsPanel from './viewbar/HideFieldsPanel.svelte'
  import FilterPanel from './viewbar/FilterPanel.svelte'
  import SortPanel from './viewbar/SortPanel.svelte'
  import ColorPanel from './viewbar/ColorPanel.svelte'
  import ChartPanel from './viewbar/ChartPanel.svelte'
  import GanttPanel from './viewbar/GanttPanel.svelte'
  import type { ChartSetting } from './chart-view'
  import ViewsMenu from './viewbar/ViewsMenu.svelte'
  import RecordView from './RecordView.svelte'
  import { closeRecord, getRecordRequest } from './editor-request.svelte'
  import DeleteRecordConfirm from './DeleteRecordConfirm.svelte'
  import { askDeleteRecord, getDeleteRecordRequest } from './record-delete.svelte'
  import { clearBarRequest, getBarRequest, registerBar, type BarPanel } from './bar-request.svelte'

  type Props = {
    /** The grid's api (`onApiReady`). */
    api: any
    /** The saved views (bindable). Default: one grid view. */
    views?: FieldView[]
    /** The id of the view shown (bindable). */
    activeView?: string
    /** The views changed: one was created, renamed, deleted, or the shown one's settings changed. */
    onViewsChange?: (views: FieldView[]) => void
    /** The view types "Create" offers. Default: grid, Kanban, calendar, and Gantt when it is enabled. */
    viewTypes?: ReadonlyArray<FieldViewType>
    /** The row heights the row height menu offers. */
    rowHeights?: ReadonlyArray<{ label: string; height: number }>
    /** The Automations button: how many rules, and what its buttons open. */
    automations?: { count: number; onManage: () => void } | null
  }

  let {
    api,
    views = $bindable<FieldView[]>([{ id: 'grid', name: 'Grid view', type: 'grid' }]),
    activeView = $bindable<string>(''),
    onViewsChange,
    viewTypes,
    automations = null,
    rowHeights = [
      { label: 'Short', height: 34 },
      { label: 'Medium', height: 56 },
      { label: 'Tall', height: 88 },
      { label: 'Extra tall', height: 128 },
    ],
  }: Props = $props()

  const ctrl = $derived(api ? gridOf(api) : undefined)
  const active = $derived(views.find((v) => v.id === activeView) ?? views[0])
  const types = $derived(viewTypes ?? (['grid', 'kanban', 'calendar', ...(hasGanttView() ? ['gantt'] : [])] as FieldViewType[]))

  const linkNames: LinkNames = (table, value) => {
    const t = getLinkedTable(table)
    return t ? linkedRows(t, value).map((r) => String(r[t.primaryField] ?? '')) : []
  }
  const primaryField = $derived.by(() => {
    if (!ctrl) return undefined
    const id = primaryIdOf(ctrl)
    return fieldColumns(ctrl).find((c) => c.id === id)?.field
  })

  // ---- Views ----------------------------------------------------------------

  // The view the grid shows, as it was when applied or last written here. A
  // list or an active id set from outside that differs from it is applied;
  // the autosave never writes into a view that has not been applied yet.
  let appliedId: string | null = null
  let appliedKey = ''
  let applying = false
  let showSeq = 0
  const keyOf = (v: FieldView) => JSON.stringify(v)

  function setViews(next: FieldView[]) {
    views = next
    const shown = next.find((v) => v.id === appliedId)
    if (shown) appliedKey = keyOf(shown)
    onViewsChange?.(next)
  }
  /** The renderers a view type needs, loaded when a view of that type is first shown. */
  async function ready(t: FieldViewType) {
    if (t === 'kanban') (await import('../board')).enableBoardView()
    else if (t === 'calendar') (await import('../scheduler')).enableSchedulerView()
    else if (t === 'gallery') (await import('../gallery')).enableGalleryView()
  }
  async function show(view: FieldView) {
    const seq = (showSeq += 1)
    appliedId = view.id
    appliedKey = keyOf(view)
    applying = true
    await ready(view.type)
    // A later show won while this one loaded its renderer.
    if (seq !== showSeq) return
    applying = false
    if (!ctrl) return
    applyView(ctrl, api, view, { primaryField, linkNames })
    colorSetting = view.color ?? colorSettingOf(ctrl)
  }
  /** The shown view as the grid now has it (its condition colors are the bar's). */
  // Plain data, not the bar's state proxy: the app stores views and a copy is cloned.
  const capture = (v: FieldView) => captureView(ctrl, api, { ...v, color: $state.snapshot(colorSetting) as ColorSetting })
  function switchTo(id: string) {
    if (!ctrl || !active || id === active.id) return
    const next = views.map((v) => (v.id === active.id ? capture(v) : v))
    const target = next.find((v) => v.id === id)
    if (!target) return
    setViews(next)
    activeView = id
    void show(target)
    viewsOpen = false
  }
  function create(partial: Omit<FieldView, 'id'>) {
    if (!ctrl || !active) return
    // A new view starts plain: no filter, sort or groups, every field shown.
    // A calendar or Gantt is colored by the first single select (a status), so
    // its events and bars say something; any other view starts uncolored.
    const select = columns.find((c) => c.fieldType === 'singleSelect')
    const timed = partial.type === 'calendar' || partial.type === 'gantt'
    const view: FieldView = {
      ...partial,
      id: newViewId(),
      state: { ...PLAIN_STATE },
      color: timed && select ? { mode: 'field', field: select.field } : { mode: 'none' },
    }
    const next = [...views.map((v) => (v.id === active.id ? capture(v) : v)), view]
    setViews(next)
    activeView = view.id
    void show(view)
    viewsOpen = false
  }
  function duplicate(id: string) {
    if (!ctrl) return
    const src = id === active?.id ? capture(active) : views.find((v) => v.id === id)
    if (!src) return
    const copy: FieldView = { ...(JSON.parse(JSON.stringify(src)) as FieldView), id: newViewId(), name: `${src.name} copy` }
    const at = views.findIndex((v) => v.id === id)
    const next = [...views]
    next.splice(at + 1, 0, copy)
    setViews(next)
  }
  function remove(id: string) {
    if (views.length < 2) return
    const next = views.filter((v) => v.id !== id)
    setViews(next)
    if (id === active?.id) {
      activeView = next[0]!.id
      void show(next[0]!)
    }
  }
  const rename = (id: string, name: string) => setViews(views.map((v) => (v.id === id ? { ...v, name } : v)))
  /** The shown Gantt's fields changed: kept in the view, and drawn at once. */
  function setGantt(next: Pick<FieldView, 'dateField' | 'endField' | 'progressField' | 'dependencyField'>) {
    if (!ctrl || !active) return
    const updated: FieldView = { ...active, ...next }
    setViews(views.map((v) => (v.id === active.id ? updated : v)))
    applyGanttSettings(ctrl, api, updated, primaryField)
  }
  // A chart view declared without a setting: the panel opens with no field picked.
  const NO_CHART: ChartSetting = { kind: 'bar', x: '' }
  /** The shown chart's setting changed: kept in the view at once. */
  const setChart = (chart: ChartSetting) => setViews(views.map((v) => (v.id === active?.id ? { ...v, chart } : v)))

  // The shown view: apply what it saved (a view stored by the app), first when
  // the grid starts, then whenever the app swaps the list or the active id and
  // the shown view is not the one applied.
  $effect(() => {
    if (!ctrl || !active) return
    const view = active
    const key = keyOf(view)
    untrack(() => {
      if (!activeView) activeView = view.id
      if (view.id === appliedId && key === appliedKey) return
      // A plain grid view first: the grid keeps the state its own props gave it.
      if (appliedId === null && !(view.state || view.type !== 'grid' || view.color || view.rowHeight != null)) {
        appliedId = view.id
        appliedKey = key
        return
      }
      void show(view)
    })
  })

  // Keep the shown view up to date as it changes (as a table app saves a
  // view's settings), a moment after the last change.
  $effect(() => {
    if (!ctrl || !active) return
    // Sorting and grouping live in the grid's store; its version says they changed.
    const snapshot = JSON.stringify([ctrl.gridStateVersion, api.getState(), recordHeightOf(api.getOption('rowHeight')), effectiveColor])
    const view = active
    const timer = setTimeout(() => {
      untrack(() => {
        if (applying || view.id !== appliedId || keyOf(view) !== appliedKey) return
        const kept = capture(view)
        const before = JSON.stringify([view.state, view.rowHeight, view.color])
        const after = JSON.stringify([kept.state, kept.rowHeight, kept.color])
        if (before !== after) setViews(views.map((v) => (v.id === view.id ? kept : v)))
      })
    }, 400)
    void snapshot
    return () => clearTimeout(timer)
  })

  // ---- The buttons' state -----------------------------------------------------

  let viewsOpen = $state(false)
  // The panel open, one at a time; the column menu can ask for one ("Filter by this field").
  let panel = $state<BarPanel | null>(null)
  function setPanel(p: BarPanel, open: boolean) {
    if (open) panel = p
    else if (panel === p) panel = null
  }
  $effect(() => {
    if (ctrl) return registerBar(ctrl)
  })
  $effect(() => {
    const r = getBarRequest()
    if (!r || r.ctrl !== ctrl) return
    untrack(() => {
      panel = r.panel
      clearBarRequest()
    })
  })
  let colorSetting = $state<ColorSetting>({ mode: 'none' })
  $effect(() => {
    if (ctrl) untrack(() => (colorSetting = active?.color ?? colorSettingOf(ctrl)))
  })
  function setColor(s: ColorSetting) {
    colorSetting = s
    if (ctrl) applyColor(ctrl, s, linkNames)
    // A calendar's events and a Gantt's bars take the view's colors.
    if (ctrl && active && (active.type === 'calendar' || active.type === 'gantt')) {
      const updated: FieldView = { ...active, color: $state.snapshot(s) as ColorSetting }
      setViews(views.map((v) => (v.id === active.id ? updated : v)))
      applyGanttSettings(ctrl, api, updated, primaryField)
    }
  }

  const columns = $derived(ctrl ? fieldColumns(ctrl) : [])
  const hiddenCount = $derived(columns.filter((c) => !c.visible).length)
  const filter = $derived.by<FieldFilter | null>(() => {
    const f = ctrl?.advancedFilter as FieldFilter | null | undefined
    return f?.kind === 'fieldFilter' ? f : null
  })
  const filterCount = $derived(conditionCount(filter))
  const filterLabel = $derived.by(() => {
    if (!filter || !filterCount) return 'Filter'
    const ids = new Set<string>()
    for (const c of filter.conditions) for (const x of isGroup(c) ? c.conditions : [c]) if (isComplete(x)) ids.add(x.column)
    if (ids.size === 1) return `Filtered by ${columns.find((c) => ids.has(c.id))?.header ?? '1 field'}`
    return `Filtered by ${ids.size} fields`
  })
  const groupCount = $derived(ctrl ? groupRules(ctrl).length : 0)
  const sortCount = $derived(ctrl ? userSorts(ctrl).length : 0)
  // What the rows show now: a column menu can color them by a field too.
  const effectiveColor = $derived(ctrl ? colorSettingOf(ctrl, colorSetting) : colorSetting)
  const colorLabel = $derived(
    effectiveColor.mode === 'field'
      ? `Colored by ${columns.find((c) => c.field === (effectiveColor as { field: string }).field)?.header ?? 'field'}`
      : effectiveColor.mode === 'conditions' && effectiveColor.rules.length
        ? 'Colored by conditions'
        : 'Color',
  )
  const rowHeight = $derived(recordHeightOf(api?.getOption?.('rowHeight')) ?? 0)
  // Grouped, the group rows are drawn taller than the records: room for the field's name over its value.
  $effect(() => {
    const grouped = groupCount > 0
    void rowHeight
    untrack(() => syncGroupRowHeight(ctrl, api, grouped))
  })
  // Grouped, a collapsed group hides its rows but they are still records: count the top groups' sizes.
  const records = $derived.by(() => {
    if (!ctrl) return 0
    const tops = ((ctrl.allRows ?? []) as Array<{ depth?: number; leafCount?: number; getCanExpand?: () => boolean; __treeRow?: boolean }>).filter(
      (r) => (r.depth ?? 0) === 0 && !r.__treeRow && typeof r.getCanExpand === 'function' && r.getCanExpand() && r.leafCount != null,
    )
    if (!groupCount || !tops.length) return api.getDisplayedRows().length
    // The grid groups before it filters: a group's size still holds the filtered-out records.
    const keep = leafFilter(ctrl)
    return keep ? tops.reduce((n, r) => n + groupLeaves(r, keep).length, 0) : tops.reduce((n, r) => n + (r.leafCount ?? 0), 0)
  })
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  // Search: in a grid view the grid's find bar, which marks every match; a
  // board, calendar or gallery has no cells to mark, so there the bar shows a
  // box that narrows the records (the grid's quick filter).
  let searching = $state(false)
  const quickSearch = $derived(active?.type !== 'grid')
  /** The find bar or the search box, with its box focused (the find bar only autofocuses on page load). */
  async function openSearch() {
    if (quickSearch) {
      searching = true
      return
    }
    ctrl.findOpen = true
    await tick()
    const root = (ctrl.scrollContainer as HTMLElement | null)?.closest('.sv-grid-root')
    root?.querySelector<HTMLInputElement>('.sv-grid-find-input')?.focus()
  }
  function focusBox(node: HTMLInputElement) {
    node.focus()
  }

  // A gallery's cards show the fields the grid shows, in its order: build its
  // config again when a field is hidden or moved (only when that changed, as
  // setting it changes the grid's options, which this reads).
  let galleryKey = ''
  $effect(() => {
    if (!ctrl || active?.type !== 'gallery') {
      galleryKey = ''
      return
    }
    const view = active
    const cfg = galleryConfig(ctrl, api, view)
    const key = JSON.stringify([cfg.coverField, cfg.titleField, cfg.cardFields])
    if (key === galleryKey) return
    galleryKey = key
    untrack(() => api.setOption('gallery', cfg))
  })
  // The same for a board's cards.
  let boardKey = ''
  $effect(() => {
    if (!ctrl || active?.type !== 'kanban') {
      boardKey = ''
      return
    }
    const cfg = boardConfig(ctrl, api, active)
    if (!cfg) return
    const key = JSON.stringify([cfg.groupBy, cfg.titleField, cfg.cardFields])
    if (key === boardKey) return
    boardKey = key
    untrack(() => api.setOption('board', cfg))
  })

  // A record opened while the grid is a board, a calendar or a gallery: the table's header,
  // which shows records otherwise, is not drawn then, so the bar shows it.
  const record = $derived.by(() => {
    const r = getRecordRequest()
    const t = active?.type
    return r && ctrl && r.ctrl === ctrl && (t === 'kanban' || t === 'calendar' || t === 'gantt' || t === 'gallery') ? r : null
  })

  // "Delete record?" from a card's menu, for the same reason.
  const deleting = $derived.by(() => {
    const r = getDeleteRecordRequest()
    const t = active?.type
    return r && ctrl && r.ctrl === ctrl && (t === 'kanban' || t === 'calendar' || t === 'gantt' || t === 'gallery') ? r : null
  })

  // Which buttons a view type has.
  const has = $derived.by(() => {
    const t = active?.type ?? 'grid'
    if (t === 'form') return new Set<string>()
    if (t === 'grid') return new Set(['hide', 'filter', 'group', 'sort', 'color', 'height'])
    // A chart reads the filtered records; how it groups them is its own setting.
    if (t === 'chart') return new Set(['filter', 'chart'])
    if (t === 'gantt') return new Set(['hide', 'filter', 'sort', 'color', 'gantt'])
    if (t === 'calendar') return new Set(['hide', 'filter', 'sort', 'color'])
    return new Set(['hide', 'filter', 'sort'])
  })

  const ICON = {
    hide: 'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 5 10 7a13.4 13.4 0 0 1-3 3.9M6.6 6.6A13.5 13.5 0 0 0 2 12c1 2 5 7 10 7a9.6 9.6 0 0 0 4.4-1.1',
    filter: 'M4 5h16l-6 7v6l-4 2v-8z',
    group: 'M4 5h16M4 10h10M4 15h16M4 20h10',
    sort: 'M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4',
    color: 'M12 3l6 7a6.5 6.5 0 1 1-12 0l6-7z',
    chart: 'M4 20h16M6 20V11M11 20V5M16 20v-7',
    gantt: 'M4 5h9M7 10h11M10 15h8M4 20h16',
    height: 'M4 6h16M4 12h16M4 18h16M20 3v18',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
    chevron: 'M6 9l6 6 6-6',
    bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  }
</script>

{#snippet glyph(path: string, size = 15)}
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path d={path} fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" /></svg>
{/snippet}

{#if ctrl && active}
  <div class="sv-fvb" role="toolbar" aria-label="View settings">
    <SvPopover bind:open={viewsOpen} arrow={false} placement="bottom-start" ariaLabel="Views">
      {#snippet anchor()}
        <button type="button" class="sv-fvb-btn sv-fvb-view" aria-haspopup="dialog" aria-expanded={viewsOpen}>
          {@render glyph(viewTypeInfo(active.type).icon)}
          <span class="sv-fvb-view-name">{active.name}</span>
          {@render glyph(ICON.chevron, 13)}
        </button>
      {/snippet}
      <ViewsMenu
        {ctrl}
        {views}
        activeId={active.id}
        {types}
        onSwitch={switchTo}
        onCreate={create}
        onRename={rename}
        onDuplicate={duplicate}
        onDelete={remove}
      />
    </SvPopover>
    <span class="sv-fvb-sep" aria-hidden="true"></span>

    {#if has.has('hide')}
      <SvPopover open={panel === 'hide'} onOpenChange={(o) => setPanel('hide', o)} arrow={false} placement="bottom-start" ariaLabel="Hide fields">
        {#snippet anchor()}
          <button type="button" class="sv-fvb-btn" class:is-set={hiddenCount > 0}>
            {@render glyph(ICON.hide)}<span>{hiddenCount ? plural(hiddenCount, 'hidden field', 'hidden fields') : 'Hide fields'}</span>
          </button>
        {/snippet}
        <HideFieldsPanel {ctrl} {api} />
      </SvPopover>
    {/if}
    {#if has.has('filter')}
      <SvPopover open={panel === 'filter'} onOpenChange={(o) => setPanel('filter', o)} arrow={false} placement="bottom-start" ariaLabel="Filter">
        {#snippet anchor()}
          <button type="button" class="sv-fvb-btn" class:is-set={filterCount > 0}>{@render glyph(ICON.filter)}<span>{filterLabel}</span></button>
        {/snippet}
        <FilterPanel {ctrl} {api} />
      </SvPopover>
    {/if}
    {#if has.has('group')}
      <SvPopover open={panel === 'group'} onOpenChange={(o) => setPanel('group', o)} arrow={false} placement="bottom-start" ariaLabel="Group">
        {#snippet anchor()}
          <button type="button" class="sv-fvb-btn" class:is-set={groupCount > 0}>
            {@render glyph(ICON.group)}<span>{groupCount ? `Grouped by ${plural(groupCount, 'field', 'fields')}` : 'Group'}</span>
          </button>
        {/snippet}
        <SortPanel {ctrl} {api} group />
      </SvPopover>
    {/if}
    {#if has.has('sort')}
      <SvPopover open={panel === 'sort'} onOpenChange={(o) => setPanel('sort', o)} arrow={false} placement="bottom-start" ariaLabel="Sort">
        {#snippet anchor()}
          <button type="button" class="sv-fvb-btn" class:is-set={sortCount > 0}>
            {@render glyph(ICON.sort)}<span>{sortCount ? `Sorted by ${plural(sortCount, 'field', 'fields')}` : 'Sort'}</span>
          </button>
        {/snippet}
        <SortPanel {ctrl} {api} />
      </SvPopover>
    {/if}
    {#if has.has('color')}
      <SvPopover open={panel === 'color'} onOpenChange={(o) => setPanel('color', o)} arrow={false} placement="bottom-start" ariaLabel="Color">
        {#snippet anchor()}
          <button type="button" class="sv-fvb-btn" class:is-set={effectiveColor.mode !== 'none'}>{@render glyph(ICON.color)}<span>{colorLabel}</span></button>
        {/snippet}
        <ColorPanel {ctrl} setting={effectiveColor} onChange={setColor} />
      </SvPopover>
    {/if}
    {#if has.has('chart')}
      {@const chart = active.chart ?? NO_CHART}
      <SvPopover open={panel === 'chart'} onOpenChange={(o) => setPanel('chart', o)} arrow={false} placement="bottom-start" ariaLabel="Customize chart">
        {#snippet anchor()}
          <button type="button" class="sv-fvb-btn">{@render glyph(ICON.chart)}<span>Customize chart</span></button>
        {/snippet}
        <ChartPanel {ctrl} setting={chart} onChange={setChart} />
      </SvPopover>
    {/if}
    {#if has.has('gantt') && active}
      {@const settings = active}
      <SvPopover open={panel === 'gantt'} onOpenChange={(o) => setPanel('gantt', o)} arrow={false} placement="bottom-start" ariaLabel="Customize timeline">
        {#snippet anchor()}
          <button type="button" class="sv-fvb-btn">{@render glyph(ICON.gantt)}<span>Customize timeline</span></button>
        {/snippet}
        <GanttPanel {ctrl} view={settings} onChange={setGantt} />
      </SvPopover>
    {/if}
    {#if has.has('height')}
      <SvPopover arrow={false} placement="bottom-start" ariaLabel="Row height">
        {#snippet anchor()}
          <button type="button" class="sv-fvb-btn sv-fvb-icon-only" aria-label="Row height" title="Row height">{@render glyph(ICON.height)}</button>
        {/snippet}
        <div class="sv-fvb-panel sv-fvb-heights" role="menu" aria-label="Row height" use:panelFocus>
          {#each rowHeights as h (h.height)}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={rowHeight === h.height}
              class="sv-fvb-height"
              class:is-on={rowHeight === h.height}
              onclick={() => api.setOption('rowHeight', h.height)}
            >
              <span class="sv-fvb-height-mark" style:--lines={Math.min(4, Math.max(1, Math.round(h.height / 30)))} aria-hidden="true"></span>
              {h.label}
            </button>
          {/each}
        </div>
      </SvPopover>
    {/if}

    <span class="sv-fvb-spacer"></span>
    {#if automations}
      <button type="button" class="sv-fvb-btn" class:is-set={automations.count > 0} onclick={automations.onManage}>
        {@render glyph(ICON.bolt)}<span>{automations.count ? plural(automations.count, 'automation', 'automations') : 'Automations'}</span>
      </button>
    {/if}
    {#if active.type !== 'form'}
      <span class="sv-fvb-count" aria-live="polite">{plural(records, 'record', 'records')}</span>
      {#if quickSearch && (searching || ctrl.globalFilter)}
        <label class="sv-fvb-search">
          {@render glyph(ICON.search, 14)}
          <input
            type="search"
            placeholder="Find a record"
            aria-label="Find a record"
            bind:value={ctrl.globalFilter}
            use:focusBox
            onblur={() => (searching = false)}
            onkeydown={(e) => {
              if (e.key === 'Escape') {
                ctrl.globalFilter = ''
                searching = false
              }
            }}
          />
        </label>
      {:else}
        <button type="button" class="sv-fvb-btn sv-fvb-icon-only" aria-label="Search" title={quickSearch ? 'Search' : 'Search (Ctrl+F)'} onclick={openSearch}>
          {@render glyph(ICON.search)}
        </button>
      {/if}
    {/if}
  </div>
{/if}
{#if record}
  {#key record}
    <RecordView {ctrl} rowId={record.rowId} editPrimary={record.editPrimary} onClose={closeRecord} />
  {/key}
{/if}
{#if deleting}
  {#key deleting}
    <DeleteRecordConfirm {ctrl} api={deleting.api} row={deleting.row} onClose={() => askDeleteRecord(null)} />
  {/key}
{/if}

<style>
  .sv-fvb {
    container-type: inline-size;
    display: flex; align-items: center; gap: 2px; flex-wrap: wrap; min-height: 40px; padding: 4px 6px;
    font-family: var(--sg-font, inherit); font-size: 13px; color: var(--sg-fg, #0f172a);
    border-bottom: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-bg, #fff);
  }
  .sv-fvb-btn {
    position: relative; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 8px; border: 0; border-radius: 6px;
    background: none; color: inherit; font: inherit; cursor: pointer; white-space: nowrap;
  }
  .sv-fvb-btn:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-fvb-btn:focus-visible { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: -2px; }
  .sv-fvb-btn.is-set { background: color-mix(in srgb, var(--sg-accent, #2563eb) 13%, transparent); }
  .sv-fvb-view { font-weight: 600; max-width: 240px; }
  .sv-fvb-view-name { overflow: hidden; text-overflow: ellipsis; }
  .sv-fvb-icon-only { padding: 0 6px; }
  .sv-fvb-sep { width: 1px; height: 18px; margin: 0 6px; background: var(--sg-border, #e2e8f0); }
  .sv-fvb-spacer { flex: 1; }
  /* A narrow bar keeps the icons and the counts; the labels stay for screen readers. */
  @container (max-width: 640px) {
    .sv-fvb-btn:not(.sv-fvb-view) > span {
      position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
    }
    .sv-fvb-btn { padding: 0 6px; }
    .sv-fvb-view { max-width: 150px; }
  }
  /* A phone: the count gives way, so the bar stays one line. */
  @container (max-width: 420px) {
    .sv-fvb-count { display: none; }
  }
  .sv-fvb-search {
    display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 8px; border-radius: 6px;
    border: 1px solid var(--sg-border, #cbd5e1); color: var(--sg-muted, #64748b);
  }
  .sv-fvb-search input { width: 160px; border: 0; outline: none; background: none; color: var(--sg-fg, #0f172a); font: inherit; }
  .sv-fvb-search:focus-within { border-color: var(--sg-accent, #2563eb); }
  .sv-fvb-count { color: var(--sg-muted, #64748b); font-size: 12px; margin-inline-end: 4px; font-variant-numeric: tabular-nums; }

  /* Shared by the panels (portalled to <body>). */
  :global(.sv-pop__panel:has(.sv-fvb-panel-wide)) { max-width: min(94vw, 760px); }
  :global(.sv-fvb-panel) { font-size: 13px; max-width: 100%; }
  :global(.sv-fvb-title) { margin: 0 0 6px; color: var(--sg-muted, #64748b); font-size: 12px; }
  :global(.sv-fvb-empty) { margin: 2px 0 8px; color: var(--sg-muted, #64748b); }
  :global(.sv-fvb-foot) { display: flex; gap: 12px; margin-top: 8px; align-items: center; }
  :global(.sv-fvb-select), :global(.sv-fvb-input) {
    width: 100%; min-width: 0; height: 28px; box-sizing: border-box; padding: 0 6px; font: inherit; font-size: 13px;
    color: inherit; background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #cbd5e1); border-radius: 6px;
  }
  :global(.sv-fvb-select:focus-visible), :global(.sv-fvb-input:focus-visible) { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: -1px; }
  :global(.sv-fvb-text-btn) {
    border: 0; padding: 2px 0; background: none; font: inherit; color: var(--sg-accent, #2563eb); cursor: pointer;
  }
  :global(.sv-fvb-text-btn:hover) { text-decoration: underline; }
  :global(.sv-fvb-solid-btn) {
    border: 0; border-radius: 6px; padding: 5px 12px; font: inherit; cursor: pointer;
    background: var(--sg-accent, #2563eb); color: var(--sg-accent-fg, #fff);
  }
  :global(.sv-fvb-icon-btn) {
    display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; padding: 0;
    border: 0; border-radius: 6px; background: none; color: var(--sg-muted, #64748b); cursor: pointer;
  }
  :global(.sv-fvb-icon-btn:hover) { background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-fg, #0f172a); }
  /* A switch, not a checkbox: on is the accent with the knob at the end. */
  :global(.sv-fvb-switch) {
    appearance: none; flex: none; position: relative; width: 26px; height: 15px; margin: 0; border-radius: 999px; cursor: pointer;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 22%, transparent); transition: background-color 0.12s;
  }
  :global(.sv-fvb-switch::before) {
    content: ''; position: absolute; top: 2px; left: 2px; width: 11px; height: 11px; border-radius: 50%;
    background: var(--sg-bg, #fff); transition: transform 0.12s;
  }
  :global(.sv-fvb-switch:checked) { background: var(--sg-accent, #2563eb); }
  :global(.sv-fvb-switch:checked::before) { transform: translateX(11px); }
  :global(.sv-fvb-switch:disabled) { opacity: 0.5; cursor: default; }
  :global(.sv-fvb-switch:focus-visible) { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: 2px; }
  .sv-fvb-heights { display: grid; min-width: 150px; }
  .sv-fvb-height {
    display: flex; align-items: center; gap: 10px; padding: 6px 8px; border: 0; border-radius: 6px;
    background: none; color: inherit; font: inherit; text-align: start; cursor: pointer;
  }
  .sv-fvb-height:hover, .sv-fvb-height.is-on { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-fvb-height.is-on { font-weight: 600; }
  /* As many lines as the height holds text. */
  .sv-fvb-height-mark {
    width: 14px; height: 14px; border: 1.5px solid currentColor; border-radius: 3px; box-sizing: border-box;
    background: repeating-linear-gradient(to bottom, transparent 0 2px, currentColor 2px 3px) center / 8px calc(var(--lines) * 3px) no-repeat;
  }
</style>
