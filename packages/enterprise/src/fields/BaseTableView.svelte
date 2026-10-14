<script lang="ts">
  /**
   * One table of a base: the view bar over a `<SvGrid>`, and the form view
   * beside it. Grid, Kanban, calendar, Gantt and gallery views are the grid
   * itself in another mode (`board`, `scheduler`, `gantt`, `gallery`); a form
   * view asks for the same fields. Every prop it does not name goes to the
   * grid. `<SvBase>` draws one, under its table tabs when it has several.
   *
   * With a `runner`, the view bar has the table's Automations; an
   * automation's "Color the record" action paints the grid while a record
   * matches its condition.
   */
  import { SvGrid, hasGanttView } from '@svgrid/grid'
  import SvBaseViewBar from './SvBaseViewBar.svelte'
  import SvBaseForm from './SvBaseForm.svelte'
  import BaseChartView from './BaseChartView.svelte'
  import BaseAutomations from './BaseAutomations.svelte'
  import { gridOf } from './grid-access'
  import { fieldCopyText } from './copy-text'
  import { recordMenu } from './record-menu'
  import { matches, type AutomationRun, type AutomationRunner, type BaseAutomation } from './automations.svelte'
  import type { BaseTable } from './base-tables'
  import type { FieldView, FieldViewType } from './view-model'

  let {
    data,
    columns,
    views = $bindable<FieldView[]>([{ id: 'grid', name: 'Grid view', type: 'grid' }]),
    activeView = $bindable<string>(''),
    onViewsChange,
    viewTypes,
    rowHeights,
    containerHeight = 560,
    onApiReady,
    bare = false,
    table,
    tables,
    runner,
    serverRuns,
    onAutomationsChange,
    onFormSubmit,
    newRecord,
    ...grid
  }: {
    /** The grid's rows and columns. */
    data: any[]
    columns: any[]
    views?: FieldView[]
    activeView?: string
    onViewsChange?: (views: FieldView[]) => void
    viewTypes?: ReadonlyArray<FieldViewType>
    /** The row heights the view bar's row height menu offers. */
    rowHeights?: ReadonlyArray<{ label: string; height: number }>
    containerHeight?: number | string
    onApiReady?: (api: any) => void
    /** No border of its own: it sits under the table tabs, inside their frame. */
    bare?: boolean
    /** The table shown, with its automations (from `<SvBase tables>`). */
    table?: BaseTable
    /** Every table of the base, for the automations that create records. */
    tables?: () => BaseTable[]
    /** Runs the base's automations; without it there is no Automations button. */
    runner?: AutomationRunner
    serverRuns?: () => Promise<ReadonlyArray<AutomationRun>>
    onAutomationsChange?: (automations: BaseAutomation[]) => void
    /** A form view sent a record. A Promise keeps the form busy until it settles; a rejection shows its message. */
    onFormSubmit?: (row: Record<string, unknown>, viewId: string) => void | Promise<unknown>
    /** Values a record from a form view starts with (`<SvBase tables>` gives an id). */
    newRecord?: () => Record<string, unknown>
    [prop: string]: any
  } = $props()

  // Raw: a proxied api is another object, and the view bar finds the grid by the api itself.
  let api = $state.raw<any>(null)
  // Right-click on a record: expand, insert, duplicate, copy, paste, delete. The app's own `contextMenu` wins.
  const menu = recordMenu(() => api, () => (api ? gridOf(api) : undefined))
  const view = $derived(views.find((v) => v.id === activeView) ?? views[0])
  const type = $derived(view?.type ?? 'grid')
  // A form or a chart draws over the grid, which stays mounted: it holds the
  // records, the filter and the api they read.
  const besideGrid = $derived(type === 'form' || type === 'chart')
  // Gantt only once the app has turned it on.
  const types = $derived(viewTypes ?? (['grid', 'kanban', 'calendar', ...(hasGanttView() ? ['gantt'] : []), 'gallery', 'chart', 'form'] as FieldViewType[]))
  const height = $derived(typeof containerHeight === 'number' ? `${containerHeight}px` : containerHeight)

  // ---- Automations ----------------------------------------------------------
  let automationsOpen = $state(false)
  const automationList = $derived(table?.automations ?? [])
  // "Color the record": a format per action, drawn while the record matches.
  const highlightFormats = $derived.by(() => {
    const t = table
    if (!t) return []
    const out: any[] = []
    for (const a of automationList) {
      if (!a.enabled || !a.condition) continue
      for (const action of a.actions) {
        if (action.type !== 'highlight') continue
        out.push({
          type: 'rule',
          ...(action.fields?.length ? { columns: action.fields } : {}),
          when: ({ row }: { row: Record<string, unknown> }) => matches(t, a.condition, row),
          background: action.background,
          ...(action.color ? { color: action.color } : {}),
        })
      }
    }
    return out
  })
  const conditionalFormats = $derived(highlightFormats.length ? [...((grid.conditionalFormats as any[]) ?? []), ...highlightFormats] : grid.conditionalFormats)
</script>

<div class="sv-fbase" class:is-bare={bare} style:height>
  {#if api}
    <SvBaseViewBar
      {api}
      bind:views
      bind:activeView
      {onViewsChange}
      viewTypes={types}
      {rowHeights}
      automations={runner && table ? { count: automationList.length, onManage: () => (automationsOpen = true) } : null}
    />
  {/if}
  <div class="sv-fbase-body">
    <!-- The grid stays mounted under a form: it holds the api the form adds rows through. -->
    <div class="sv-fbase-grid" class:is-hidden={besideGrid}>
      <SvGrid
        {...grid}
        {data}
        {columns}
        {conditionalFormats}
        contextMenu={grid.contextMenu ?? menu}
        processCellForClipboard={grid.processCellForClipboard ?? fieldCopyText}
        containerHeight="100%"
        onApiReady={(a: any) => {
          api = a
          onApiReady?.(a)
        }}
      />
    </div>
    {#if api && type === 'chart'}
      <BaseChartView {api} setting={view?.chart} />
    {/if}
    {#if api && type === 'form'}
      <!-- One form per view: another form view starts with its own empty fields. -->
      {#key view?.id}
        <SvBaseForm
          {api}
          fields={view?.formFields}
          required={view?.formRequired}
          title={view?.formTitle ?? view?.name}
          description={view?.formDescription}
          submitLabel={view?.formSubmitLabel}
          defaults={newRecord}
          onSubmit={(row) => (view ? onFormSubmit?.(row, view.id) : undefined)}
        />
      {/key}
    {/if}
  </div>
  {#if runner && table && api && automationsOpen}
    <BaseAutomations
      bind:open={automationsOpen}
      {table}
      tables={tables?.() ?? [table]}
      ctrl={gridOf(api)}
      {views}
      {runner}
      {serverRuns}
      onChange={(list) => onAutomationsChange?.(list)}
    />
  {/if}
</div>

<style>
  .sv-fbase {
    display: flex; flex-direction: column; min-height: 0; box-sizing: border-box;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px); overflow: hidden;
    background: var(--sg-bg, #fff);
  }
  .sv-fbase.is-bare { border: 0; border-radius: 0; }
  .sv-fbase-body { position: relative; flex: 1 1 auto; min-height: 0; }
  .sv-fbase-grid { height: 100%; }
  .sv-fbase-grid.is-hidden { visibility: hidden; position: absolute; inset: 0; pointer-events: none; }
  .sv-fbase-body > :global(.sv-fform-wrap) { position: absolute; inset: 0; }
</style>
