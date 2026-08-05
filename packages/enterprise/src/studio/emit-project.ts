/**
 * emitStudioProject - turn a `StudioProject` (the visual designer's model) into
 * the source files of a runnable app: `schemas.ts` + `data.ts` from the
 * entities, and one self-contained `+page.svelte` per SCREEN that composes the
 * screen's BLOCKS (grid, edit form, chart, dashboard, KPI) with their config,
 * plus the nav shell + home.
 *
 * Pure + node-safe (studio subtree), reusing the create-studio emit pipeline for
 * schemas/data and building each screen page directly from `@svgrid/grid` +
 * `@svgrid/enterprise` (no EntityScreen dependency, so the output is
 * self-contained).
 */
import type { GeneratedFile } from './scaffold.js'
import type { ActionConfig, Block, ComponentBinding, ComponentConfig, EntityDataSource, FilterPanelConfig, GridColumnConfig, GridConfig, KpiConfig, OAuthProvider, PivotConfig, RecordConfig, RowAction, SchedulerViewConfig, Screen, StudioProject } from './project.js'
import { blockColumns, blockStyleCss, blockClassName, sanitizeClassName, componentHandleName, componentHasBindings, entityDataSource, flattenBlocks, serializeProject, seedUsers, compileHandlerSteps, clickSlot, rowSelectSlot, changeSlot, FORM_SUBMIT, screenLayoutOf, isPaneLayout, canvasRectOf, CANVAS_ROW_PX, CANVAS_GAP_PX, gridOpts, stackOpts, splitOpts, dockOpts, canvasOpts, stateInitExpr, stateTsType, reconcileDock, ON_LOAD, ON_DESTROY, isSsrScreen } from './project.js'
import { uiComponentSpec } from './ui-components.js'
import { resolveThemeTokens, resolveThemeTokensFor, isDarkTheme } from './themes.js'
import type { EntityField, EntitySchema } from '../schema.js'
import { emitEntityModules, homeFile, layoutFile, lookupVar, namesFor, relationDisplayFields, type NavItem } from './emit-schema.js'

const has = (blocks: Block[], kind: Block['config']['kind']) => blocks.some((b) => b.config.kind === kind)

/** Per-Tabs-block active-tab state var + a stable tab id. */
const tabsStateVar = (blockId: string) => `activeTab_${blockId.replace(/[^a-zA-Z0-9_$]/g, '_')}`
const tabId = (blockId: string, i: number) => `${blockId}-${i}`

/** Per-Accordion-block expanded-ids state var + a stable section id. */
const accStateVar = (blockId: string) => `accOpen_${blockId.replace(/[^a-zA-Z0-9_$]/g, '_')}`
const accSectionId = (blockId: string, i: number) => `${blockId}-s${i}`

/** A state var holding a master-detail block's child rows (loaded in full). */
const mdChildVar = (childName: string) => `md_${childName.replace(/[^a-zA-Z0-9]/g, '_')}_rows`

/** Compile a no-code `ColumnFormat` into the grid's `format` (CellFormatConfig) literal. */
function columnFormatExpr(fmt: NonNullable<GridColumnConfig['format']>): string {
  switch (fmt.type) {
    case 'number': {
      const d = fmt.decimals
      return d != null ? `{ type: 'number', options: { minimumFractionDigits: ${d}, maximumFractionDigits: ${d} } }` : `{ type: 'number' }`
    }
    case 'currency':
      return `{ type: 'currency', currency: ${jsStr(fmt.currency || 'USD')} }`
    case 'percent': {
      const parts = [`type: 'percent'`]
      if (fmt.valueIsPercentPoints) parts.push('valueIsPercentPoints: true')
      if (fmt.decimals != null) parts.push(`options: { minimumFractionDigits: ${fmt.decimals}, maximumFractionDigits: ${fmt.decimals} }`)
      return `{ ${parts.join(', ')} }`
    }
    case 'date':
    case 'datetime':
      return fmt.pattern ? `{ type: '${fmt.type}', pattern: ${jsStr(fmt.pattern)} }` : `{ type: '${fmt.type}' }`
  }
}

/** The visible grid columns: configured order, per-column header/width/align overrides, editability per mode. */
function gridColumnsExpr(schemaVar: string, block: Block, typeName?: string): string {
  if (block.config.kind !== 'grid') return `schemaToColumns(${schemaVar})`
  const cfg = block.config
  const idSafe = block.id.replace(/-/g, '_')
  const visible = cfg.columns.filter((c) => c.show)
  // Only inline editing keeps cells editable; form / read-only grids are not editable in place.
  const editablePart = cfg.editing === 'inline' ? '' : ', editable: false'
  if (visible.length === 0) {
    return editablePart ? `schemaToColumns(${schemaVar}).map((c) => ({ ...c${editablePart} }))` : `schemaToColumns(${schemaVar})`
  }
  const order = visible.map((c) => `'${c.field}'`)
  const ovEntries = visible
    .map((c) => {
      const parts: string[] = []
      if (c.header) parts.push(`header: ${JSON.stringify(c.header)}`)
      if (c.width != null) parts.push(`width: ${c.width}`)
      if (c.align) parts.push(`align: '${c.align}'`)
      // Roll this column up into the group summary row (only meaningful when grouped).
      if (c.aggregate) parts.push(`aggregate: '${c.aggregate}'`)
      // The tree-data label column renders the indented, expandable tree cell.
      if (cfg.treeData && c.field === cfg.treeData.labelField && typeName) parts.push(`cell: (ctx: CellContext<${typeName}>) => renderSnippet(treeCell_${idSafe}, { value: ctx.getValue(), row: ctx.row.original })`)
      // A rich cell renderer (badge / progress / link) wins over plain value formatting.
      else if (c.cellType && typeName) parts.push(`cell: (ctx: CellContext<${typeName}>) => renderSnippet(${cellSnippetName(idSafe, c.field)}, { value: ctx.getValue() })`)
      else if (c.format) parts.push(`format: ${columnFormatExpr(c.format)}`)
      return parts.length ? `'${c.field}': { ${parts.join(', ')} }` : null
    })
    .filter((x): x is string => !!x)
  const ovDecl = ovEntries.length ? ` const ov: Record<string, Partial<(typeof all)[number]>> = { ${ovEntries.join(', ')} };` : ''
  const ovPart = ovEntries.length ? ', ...(ov[String(c.field)] ?? {})' : ''
  const inner = `[${order.join(', ')}].map((f) => all.find((c) => c.field === f)).filter((c): c is (typeof all)[number] => !!c)`
  const mapped = editablePart || ovPart ? `${inner}.map((c) => ({ ...c${editablePart}${ovPart} }))` : inner
  return `(() => { const all = schemaToColumns(${schemaVar});${ovDecl} return ${mapped} })()`
}

/** The wrapper `style="..."` for a block: its 12-col span, min-width guard, an optional
 *  extra (e.g. height), and the user's per-block appearance overrides (border/padding/…). */
function wrapperStyle(block: Block, extra?: string): string {
  const parts = [`grid-column: span ${blockColumns(block)}`, 'min-width: 0']
  if (extra) parts.push(extra)
  const bs = blockStyleCss(block.style)
  if (bs) parts.push(bs)
  return `style="${parts.join('; ')}"`
}

/** A chart's accent color as a safe attribute value (hex / rgb / css var), or the
 *  theme accent when unset. Sanitized so it can't break out of the attribute. */
const chartColorExpr = (c?: string): string => {
  if (!c) return 'var(--sg-accent)'
  const safe = c.replace(/[^#a-zA-Z0-9(),.%\s_-]/g, '').slice(0, 40)
  return safe || 'var(--sg-accent)'
}

/** The wrapper `class="..."` attribute for a block: any built-in base class(es) plus
 *  the user's custom className. Returns '' (no attribute) when there are none. */
function wrapperClass(block: Block, base?: string): string {
  const classes = [base, blockClassName(block)].filter(Boolean).join(' ')
  return classes ? ` class="${classes}"` : ''
}

/** The extra ` <class>` suffix for a screen's `.st-screen` wrapper (per-screen styling hook). */
function screenClassSuffix(screen: Screen): string {
  const c = sanitizeClassName(screen.className)
  return c ? ` ${c}` : ''
}

/** Page-scoped CSS for the active layout's settings (gap / max-width / align /
 *  breakpoint / dividers / canvas grid). Emitted inside the page's own `<style>`,
 *  so Svelte scopes it to THIS screen - each screen keeps its own layout tuning.
 *  Returns '' when the mode has no CSS-driven settings (split / dock are props). */
function screenLayoutStyle(screen: Screen): string {
  const layout = screenLayoutOf(screen)
  if (layout === 'grid') {
    const o = gridOpts(screen)
    const mw = o.maxWidth ? ` max-width: ${o.maxWidth}px; margin-inline: auto;` : ''
    return `  .st-screen { grid-template-columns: repeat(12, 1fr); gap: ${o.rowGap}px ${o.colGap}px; align-items: ${o.align};${mw} }\n  @media (max-width: ${o.mobileBreakpoint}px) { .st-screen { grid-template-columns: 1fr; gap: 12px; } }\n`
  }
  if (layout === 'stack') {
    const o = stackOpts(screen)
    const mw = o.maxWidth ? ` max-width: ${o.maxWidth}px;${o.align === 'center' ? ' margin-inline: auto;' : ''}` : ''
    const mh = o.minHeight ? `\n  .st-stack > * { min-height: ${o.minHeight}px; }` : ''
    const div = o.dividers ? `\n  .st-stack > * + * { border-top: 1px solid var(--sg-border, #e2e8f0); padding-top: ${o.gap}px; }` : ''
    return `  .st-stack { gap: ${o.gap}px;${mw} }${mh}${div}\n`
  }
  if (layout === 'canvas') {
    const o = canvasOpts(screen)
    const grid = o.showGrid
      ? `\n  .st-canvas { background-image: linear-gradient(var(--sg-border, #e6e8ec) 1px, transparent 1px), linear-gradient(90deg, var(--sg-border, #e6e8ec) 1px, transparent 1px); background-size: calc((100% - ${o.cols - 1} * ${o.gap}px) / ${o.cols} + ${o.gap}px) calc(${o.rowHeight}px + ${o.gap}px); }`
      : ''
    return `  .st-canvas { grid-template-columns: repeat(${o.cols}, 1fr); grid-auto-rows: ${o.rowHeight}px; gap: ${o.gap}px; }${grid}\n`
  }
  return ''
}

/** Markup for one block inside the screen grid. `ctx.hasRecord` tells a grid to
 *  publish its clicked row into `selectedRecord` for a sibling record panel. */
function blockMarkup(entity: EntitySchema, schemaVar: string, typeName: string, block: Block, resolve: (name: string) => EntitySchema | undefined, ctx: { hasRecord: boolean; accessEnabled?: boolean; routeById?: Map<string, string>; i18n?: boolean; rawEntity?: EntitySchema; rawResolve?: (name: string) => EntitySchema | undefined; captureApi?: string; handleNames?: Map<string, string>; pane?: boolean; rowSelectSteps?: string; ctxLiteral?: string } = { hasRecord: false }): string {
  // A block's display label: localized via $t('block.<id>', 'literal') when i18n is on.
  const tLabel = (label: string, key: string) => (ctx.i18n ? `{$t('block.${key}', ${JSON.stringify(label)})}` : label)
  // In a dock pane the block fills its pane (the pane owns the size); in the 12-col grid it
  // spans columns. Grid-height blocks read `paneH` so they fill the pane instead of a fixed px.
  const span = ctx.pane ? 'style="height: 100%; min-width: 0; min-height: 0; display: flex; flex-direction: column;"' : wrapperStyle(block)
  const cls = wrapperClass(block)
  const cfg = block.config
  // Code-behind: a data-viz block bound to a DataHandle reads that handle's rows
  // (which code can override via setData), else it reads the shared screen dataset.
  const rowsVar = ctx.handleNames?.get(block.id)
  const rowsExpr = rowsVar ? `${rowsVar}.rows` : 'allRows'
  switch (cfg.kind) {
    case 'grid': {
      const idSafe = block.id.replace(/-/g, '_')
      const colVar = `columns_${idSafe}`
      const emptyMsg = `No ${(entity.label ?? entity.name).toLowerCase()} yet.`
      // Scheduler view: render the grid's rows as a calendar (a view of the grid, like the
      // board). Full-client over `allRows`; the enterprise renderer is enabled app-wide.
      if (cfg.scheduler) {
        const schDisp = relationDisplayFields(ctx.rawEntity ?? entity, resolve)
        const schAsText = (f: string) => schDisp.get(f) ?? f
        return `    <div ${span}${cls}>
      <SvGrid
        data={allRows}
        columns={${colVar}}
        getRowId={(r) => String((r as Record<string, unknown>)[idField])}
        loading={!allRowsReady}
        scheduler={${schedulerConfigExpr(cfg.scheduler, typeName, schAsText)}}
        containerHeight=${ctx.pane ? '"100%"' : `{${block.height ?? 640}}`}
      />
    </div>`
      }
      // Grouped + tree grids both load the full dataset and render client-side (a grouped
      // grid groups/sorts/paginates every row; a tree grid walks a self-referential parent
      // field into an expand/collapse hierarchy). Ungrouped/flat grids stay server-driven.
      const tree = gridHasTree(cfg)
      const grouped = !!cfg.grouping?.length && !tree
      const dataExpr = tree ? `tree_${idSafe}.visible` : grouped ? 'allRows' : 'view.rows'
      const lines = [`data={${dataExpr}}`, `columns={${colVar}}`, `loading={${tree || grouped ? '!allRowsReady' : 'view.loading'}}`, `loadingOverlay`, `emptyMessage=${JSON.stringify(emptyMsg)}`, `fitColumns`]
      lines.push(`enableRowSummaries={${cfg.rowSummaries ? 'true' : 'false'}}`)
      if (cfg.striped) lines.push(`zebraRows`)
      if (cfg.cellSelection) lines.push(`enableCellSelection`)
      // Always set a row height (normal = 30) so every grid - incl. master-detail - is
      // consistent, and the generated app matches the designer preview.
      lines.push(`rowHeight={${cfg.density === 'compact' ? 28 : cfg.density === 'comfortable' ? 46 : 30}}`)
      const leftPins = cfg.columns.filter((c) => c.show && c.pin === 'left').map((c) => `'${c.field}'`)
      const rightPins = cfg.columns.filter((c) => c.show && c.pin === 'right').map((c) => `'${c.field}'`)
      if (leftPins.length || rightPins.length) {
        const pins = [leftPins.length ? `left: [${leftPins.join(', ')}]` : '', rightPins.length ? `right: [${rightPins.join(', ')}]` : ''].filter(Boolean).join(', ')
        lines.push(`initialColumnPinning={{ ${pins} }}`, `columnVirtualization={false}`)
      }
      if (cfg.selectable) lines.push(`showRowSelection`)
      if (grouped) lines.push(`groupable`)
      // A tree grid keeps parent-child adjacency: no flat sort/filter/paginate.
      if (tree) {
        // Sorting/filtering/paging would break the hierarchy; the tree renders every visible node.
      } else if (grouped) {
        // Client-side sort / filter / paginate over the full row set (no controller).
        if (cfg.sortable) lines.push(`sortable`)
        if (cfg.filterable) lines.push(`filterable`, ...filterSurfaceProps(cfg))
      } else {
        if (cfg.sortable) lines.push(`sortable`, `externalSort`, `onSortingChange={(s) => controller.setSort(s)}`)
        if (cfg.filterable) lines.push(`filterable`, ...filterSurfaceProps(cfg), `externalFilter`, `onFiltersChange={(f) => controller.setFilter({ global: f.global || undefined, columns: Object.fromEntries(f.columns.map((c) => [c.id, { operator: c.operator, value: c.value, valueTo: c.valueTo, selectedValues: c.selectedValues }])) })}`)
      }
      // RBAC: gate the edit affordances on the update permission (server also enforces).
      const canUpdate = ctx.accessEnabled ? `can($currentRole, 'update')` : 'true'
      if (cfg.editing === 'form') lines.push(ctx.accessEnabled ? `onRowDoubleClick={(e) => { if (${canUpdate}) editing = e.row }}` : `onRowDoubleClick={(e) => (editing = e.row)}`)
      // Inline editing writes through the controller by row id (not offered for tree grids).
      if (cfg.editing === 'inline' && !tree) lines.push(`onCellValueChange={(e) => { ${ctx.accessEnabled ? `if (!${canUpdate}) return; ` : ''}const row = ${grouped ? 'allRows' : 'view.rows'}[e.rowIndex]; if (row) controller.updateRow(String((row as Record<string, unknown>)[idField]), { [e.columnId]: e.newValue } as Partial<${typeName}>) }}`)
      // Row click: drill-through (highest precedence), a record-panel selection,
      // and/or the user's "On row select" method steps (row-scoped ctx). When steps
      // are present they merge with the built-in action into one async handler.
      const linkRoute = cfg.rowLink && ctx.routeById?.get(cfg.rowLink.screen)
      const rowLinkStmt = cfg.rowLink && linkRoute
        ? `goto('/${linkRoute}?${cfg.rowLink.targetField}=' + encodeURIComponent(String((e.row as Record<string, unknown>)[${jsStr(cfg.rowLink.sourceField ?? entity.idField ?? entity.fields.find((f) => f.primaryKey)?.field ?? 'id')}] ?? '')))`
        : ''
      const primaryStmt = rowLinkStmt || (ctx.hasRecord ? 'selectedRecord = e.row' : '')
      if (ctx.rowSelectSteps) {
        const pre = primaryStmt ? `\n        ${primaryStmt}` : ''
        const stepBody = ctx.rowSelectSteps.split('\n').map((l) => (l ? '        ' + l : l)).join('\n')
        lines.push(`onRowClick={async (e) => {${pre}\n        const row = e.row\n        const ctx = ${ctx.ctxLiteral} as unknown as PageContext\n${stepBody}\n      }}`)
      } else if (rowLinkStmt) {
        lines.push(`onRowClick={(e) => ${rowLinkStmt}}`)
      } else if (ctx.hasRecord) {
        lines.push(`onRowClick={(e) => (selectedRecord = e.row)}`)
      }
      if (cfg.paginated !== false && !tree) {
        if (grouped) {
          // Client pagination: the grid slices `data` itself.
          lines.push(`showPagination`, `pageSize={${cfg.pageSize}}`)
        } else {
          lines.push(`showPagination`, `externalPagination`, `rowCount={view.total}`, `pageIndex={view.pageIndex}`, `pageSize={view.pageSize}`, `onPaginationChange={({ pageIndex, pageSize }) => (pageSize !== view.pageSize ? controller.setPageSize(pageSize) : controller.setPage(pageIndex))}`)
        }
        if (cfg.paginationPosition && cfg.paginationPosition !== 'bottom') lines.push(`paginationPosition="${cfg.paginationPosition}"`)
        const opts = cfg.pageSizeOptions
        if (opts && opts.length && (opts.length !== 4 || opts.join(',') !== '10,25,50,100')) lines.push(`pageSizeOptions={[${opts.join(', ')}]}`)
      }
      // No-code conditional formatting -> the grid's rule engine.
      const cf = conditionalFormatsExpr(cfg)
      if (cf) lines.push(`conditionalFormats={${cf}}`)
      // Code-behind captures the api; grouped grids also seed the initial grouping.
      const apiBody: string[] = []
      if (ctx.captureApi) apiBody.push(`${ctx.captureApi} = a`)
      if (grouped) apiBody.push(`a.setGroupBy([${cfg.grouping!.map((f) => jsStr(f)).join(', ')}])`)
      if (apiBody.length === 1 && ctx.captureApi && !grouped) lines.push(`onApiReady={(a) => (${ctx.captureApi} = a)}`)
      else if (apiBody.length) lines.push(`onApiReady={(a) => { ${apiBody.join('; ')} }}`)
      lines.push(`containerHeight=${ctx.pane ? '"100%"' : `{${block.height ?? 360}}`}`)
      // No-code export toolbar - buttons wired to the grid's own export API.
      const exportBar = gridHasExport(cfg) && ctx.captureApi ? exportToolbarMarkup(cfg.export!, ctx.captureApi, entity.name) : ''
      return `    <div ${span}${cls}>
${exportBar}      <SvGrid
        ${lines.join('\n        ')}
      />
    </div>`
    }
    case 'chart': {
      const drillRoute = cfg.drillScreen && ctx.routeById?.get(cfg.drillScreen)
      const onDrill = drillRoute ? ` onDrill={(cat) => goto('/${drillRoute}?${cfg.dimension}=' + encodeURIComponent(String(cat)))}` : ''
      return `    <div ${span}${cls}>
      <SvSchemaChart schema={${schemaVar}} rows={${rowsExpr}} dimension="${cfg.dimension}"${cfg.measure ? ` measure="${cfg.measure}"` : ''} reduce="${cfg.reduce}" type="${cfg.type}"${block.height ? ` height={${block.height}}` : ''} controls={false} accent="${chartColorExpr(cfg.color)}"${cfg.dataLabels === false ? ' dataLabels={false}' : ''}${onDrill} />
    </div>`
    }
    case 'dashboard':
      return `    <div ${span}${cls}>
      <SvSchemaDashboard schema={${schemaVar}} rows={${rowsExpr}} />
    </div>`
    case 'kpi': {
      const measurePart = cfg.measure ? `measure: '${cfg.measure}', ` : ''
      const valueNum = `reduceValue(${rowsExpr}, { ${measurePart}reduce: '${cfg.reduce}' })`
      // Value formatting: explicit format wins, else auto ("$" for money measures).
      const money = cfg.measure ? /\$/.test(entity.fields.find((f) => f.field === cfg.measure)?.label ?? '') : false
      const fmt = cfg.format ?? 'auto'
      const valueExpr = fmt === 'auto'
        ? `${money ? "'$' + " : ''}(${valueNum}).toLocaleString(undefined, { maximumFractionDigits: 1 })`
        : `formatKpiValue(${valueNum}, '${fmt}')`
      const rows: string[] = [
        `      <div class="kpi__head"><span class="kpi__label">${tLabel(cfg.label, block.id)}</span></div>`,
        `      <strong class="kpi__value">{${valueExpr}}</strong>`,
      ]
      // Target: a "% of target" chip (green at/over target).
      if (cfg.target != null && cfg.target !== 0) {
        rows.push(`      <span class="kpi__delta" class:is-up={${valueNum} >= ${cfg.target}}>{Math.round(${valueNum} / ${cfg.target} * 100)}% of target</span>`)
      }
      // Trend: an inline sparkline over `trendField`, with a first-to-last delta chip.
      if (cfg.trendField) {
        const tReduce = cfg.trendReduce ?? cfg.reduce
        const seriesExpr = `kpiSeries(${rowsExpr}, { trendField: '${cfg.trendField}', ${measurePart}reduce: '${tReduce}' })`
        rows.push(`      {#if ${seriesExpr}.length > 1}
        {@const _s = ${seriesExpr}}
        {@const _d = seriesDelta(_s)}
        {#if _d != null && ${cfg.target == null}}<span class="kpi__delta" class:is-up={_d >= 0} class:is-down={_d < 0}>{_d >= 0 ? '▲' : '▼'} {Math.abs(_d).toFixed(0)}%</span>{/if}
        <svg class="kpi__spark" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true"><polyline points={sparklinePoints(_s)} fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" /></svg>
      {/if}`)
      }
      return `    <div ${span}${wrapperClass(block, 'kpi')}>\n${rows.join('\n')}\n    </div>`
    }
    case 'gauge': {
      const gexpr = `reduceValue(${rowsExpr}, { ${cfg.measure ? `measure: '${cfg.measure}', ` : ''}reduce: '${cfg.reduce}' })`
      const unit = cfg.unit ? ` unit=${JSON.stringify(cfg.unit)}` : ''
      return `    <div ${span}${wrapperClass(block, 'gaugecard')}>
      <span class="kpi__label">${tLabel(cfg.label, block.id)}</span>
      <SvGauge value={${gexpr}} min={${cfg.min}} max={${cfg.max}}${unit} size={172} />
    </div>`
    }
    case 'tree': {
      if (!cfg.labelField || !cfg.parentField) {
        return `    <div ${span}${cls}><!-- tree: set a label field + a self-referential parent field in the inspector --></div>`
      }
      const idExpr = `${schemaVar}.idField ?? 'id'`
      return `    <div ${span}${wrapperClass(block, 'treecard')}>
      <SvTree nodes={toTreeNodes(${rowsExpr} as Record<string, unknown>[], ${idExpr}, ${JSON.stringify(cfg.labelField)}, ${JSON.stringify(cfg.parentField)})} />
    </div>`
    }
    case 'tabs': {
      const tabsVar = tabsStateVar(block.id)
      // Localize tab labels via $t('tab.<id>', 'literal') when i18n is on (build the
      // array as an expression so the labels can be function calls).
      const items = ctx.i18n
        ? `[${cfg.tabs.map((t, i) => `{ id: ${JSON.stringify(tabId(block.id, i))}, label: $t('tab.${tabId(block.id, i)}', ${JSON.stringify(t.label)}) }`).join(', ')}]`
        : JSON.stringify(cfg.tabs.map((t, i) => ({ id: tabId(block.id, i), label: t.label })))
      const panels = cfg.tabs
        .map((t, i) => {
          const children = t.blocks.map((cb) => blockMarkup(entity, schemaVar, typeName, cb, resolve, ctx)).filter(Boolean).join('\n')
          return `          {#if id === '${tabId(block.id, i)}'}
            <div class="st-screen">
${children || '            <p style="color: var(--sg-muted, #94a3b8); font-size: 13px; padding: 10px;">This tab is empty.</p>'}
            </div>
          {/if}`
        })
        .join('\n')
      return `    <div ${span}${cls}>
      <SvTabs tabs={${items}} value={${tabsVar}} onChange={(id) => (${tabsVar} = id)}>
        {#snippet panel(id)}
${panels}
        {/snippet}
      </SvTabs>
    </div>`
    }
    case 'accordion': {
      const accVar = accStateVar(block.id)
      const items = ctx.i18n
        ? `[${cfg.sections.map((s, i) => `{ id: ${JSON.stringify(accSectionId(block.id, i))}, label: $t('section.${accSectionId(block.id, i)}', ${JSON.stringify(s.label)}) }`).join(', ')}]`
        : JSON.stringify(cfg.sections.map((s, i) => ({ id: accSectionId(block.id, i), label: s.label })))
      const panels = cfg.sections
        .map((s, i) => {
          const children = s.blocks.map((cb) => blockMarkup(entity, schemaVar, typeName, cb, resolve, ctx)).filter(Boolean).join('\n')
          return `          {#if item.id === '${accSectionId(block.id, i)}'}
            <div class="st-screen">
${children || '            <p style="color: var(--sg-muted, #94a3b8); font-size: 13px; padding: 10px;">This section is empty.</p>'}
            </div>
          {/if}`
        })
        .join('\n')
      return `    <div ${span}${cls}>
      <SvAccordion items={${items}} expandMode="${cfg.multiple ? 'multiple' : 'single'}" expanded={${accVar}} onChange={(ids) => (${accVar} = ids)}>
        {#snippet panel(item)}
${panels}
        {/snippet}
      </SvAccordion>
    </div>`
    }
    case 'master-detail': {
      const child = cfg.childEntity ? resolve(cfg.childEntity) : undefined
      if (!child || !cfg.foreignKey) {
        return `    <div ${span}${cls}><!-- master-detail: set a child entity + foreign key in the inspector --></div>`
      }
      const cn = namesFor(child)
      const childRows = mdChildVar(child.name)
      // Optionally, a parent row drills into a detail screen (linkScreen) instead
      // of expanding inline - the detail page shows the same children as a timeline.
      const mdRoute = cfg.linkScreen ? ctx.routeById?.get(cfg.linkScreen) : undefined
      const onParent = mdRoute ? ` onParentClick={(id) => goto('/${mdRoute}?id=' + encodeURIComponent(id))}` : ''
      return `    <div ${span}${cls}>
      <SvGridMasterDetail schema={${schemaVar}} data={allRows} detailSchema={${cn.schemaVar}} getChildren={(p) => ${childRows}.filter((c) => String((c as Record<string, unknown>)['${cfg.foreignKey}']) === String((p as Record<string, unknown>)[${schemaVar}.idField ?? 'id']))} rowHeight={30}${onParent}${block.height ? ` containerHeight={${block.height}}` : ''} />
    </div>`
    }
    case 'pivot': {
      const h = block.height ?? 460
      return `    <div ${wrapperStyle(block, `height: ${h}px`)}${cls}>
      <SvPivotDesigner data={${rowsExpr}} fields={${pivotFieldsExpr(entity)}} layout={${pivotLayoutExpr(cfg)}} />
    </div>`
    }
    case 'filter':
      return filterPanelMarkup(entity, block, cfg)
    case 'record':
      return recordPanelMarkup(entity, schemaVar, block, cfg)
    case 'board': {
      const h = block.height ?? 480
      // A relation title/subtitle renders as the raw FK id unless pointed at the
      // denormalized display field that withRelationLabels fills in (e.g. company).
      // Compute against the RAW entity (ctx.rawEntity): the prepared `entity` already
      // has the display columns appended, which would false-collide the naming and
      // diverge from what withRelationLabels actually put on the rows.
      const disp = relationDisplayFields(ctx.rawEntity ?? entity, resolve)
      const asText = (field: string) => disp.get(field) ?? field
      const badge = cfg.badgeField ? ` badgeField=${JSON.stringify(cfg.badgeField)}` : ''
      const sub = cfg.subtitleField ? ` subtitleField=${JSON.stringify(asText(cfg.subtitleField))}` : ''
      // A card click drills into a detail screen (openScreen), filtered by ?id.
      const openRoute = cfg.openScreen ? ctx.routeById?.get(cfg.openScreen) : undefined
      const onOpen = openRoute ? ` onOpen={(id) => goto('/${openRoute}?id=' + encodeURIComponent(id))}` : ''
      // Dragging a card updates its groupBy value in the local row state (optimistic).
      return `    <div ${wrapperStyle(block)}${cls}>
      <SvBoard schema={${schemaVar}} rows={allRows} loading={!allRowsReady} groupBy=${JSON.stringify(cfg.groupBy)} titleField=${JSON.stringify(asText(cfg.titleField))}${badge}${sub}${onOpen} height={${h}} onMove={(id, value) => { allRows = allRows.map((r) => String((r as Record<string, unknown>)[idField]) === String(id) ? ({ ...r, ['${cfg.groupBy}']: value }) : r) }} />
    </div>`
    }
    case 'calendar': {
      const h = block.height ?? 560
      // Compute against the RAW entity (ctx.rawEntity): the prepared `entity` already
      // has the display columns appended, which would false-collide the naming and
      // diverge from what withRelationLabels actually put on the rows.
      const disp = relationDisplayFields(ctx.rawEntity ?? entity, resolve)
      const asText = (field: string) => disp.get(field) ?? field
      // Upgraded to the enterprise scheduler renderer (Month / Week / Day / Agenda + resources
      // + recurrence): a richer view of the grid's rows with a detail drawer. `openScreen`
      // navigation is superseded by the in-place drawer.
      const sc: SchedulerViewConfig = { startField: cfg.dateField, titleField: cfg.titleField, colorField: cfg.colorField, drawer: true }
      return `    <div ${wrapperStyle(block)}${cls}>
      <SvGrid data={allRows} columns={schemaToColumns(${schemaVar})} getRowId={(r) => String((r as Record<string, unknown>)[${schemaVar}.idField ?? 'id'])} loading={!allRowsReady} scheduler={${schedulerConfigExpr(sc, typeName, asText)}} containerHeight={${h}} />
    </div>`
    }
    case 'detail': {
      const h = block.height
      // Parent relation fields (title/subtitle/section) -> their display columns.
      const disp = relationDisplayFields(ctx.rawEntity ?? entity, resolve)
      const asText = (field: string) => disp.get(field) ?? field
      const props: string[] = [`schema={${schemaVar}}`, `rows={allRows}`, `loading={!allRowsReady}`, `titleField=${JSON.stringify(asText(cfg.titleField))}`]
      if (cfg.subtitleField) props.push(`subtitleField=${JSON.stringify(asText(cfg.subtitleField))}`)
      if (cfg.statusField) props.push(`statusField=${JSON.stringify(cfg.statusField)}`)
      if (cfg.metricFields?.length) props.push(`metricFields={${JSON.stringify(cfg.metricFields)}}`)
      if (cfg.sections?.length) {
        const secs = cfg.sections.map((s) => `{ label: ${JSON.stringify(s.label)}, fields: ${JSON.stringify(s.fields.map(asText))} }`).join(', ')
        props.push(`sections={[${secs}]}`)
      }
      // Related child collections load into `md_<name>_rows` and filter by the FK.
      const rels = (cfg.related ?? []).map((rel) => {
        const child = rel.entity ? resolve(rel.entity) : undefined
        if (!child || !rel.foreignKey) return null
        const cn = namesFor(child)
        const rawChild = ctx.rawResolve?.(rel.entity) ?? child
        const cdisp = relationDisplayFields(rawChild, resolve)
        const cAs = (f: string) => cdisp.get(f) ?? f
        const label = rel.label ?? child.label ?? child.name
        const titleF = cAs(rel.titleField ?? child.fields.find((f) => f.type === 'text' && !f.primaryKey)?.field ?? child.fields[0]?.field ?? 'id')
        const parts = [`label: ${JSON.stringify(label)}`, `schema: ${cn.schemaVar}`, `rows: ${mdChildVar(child.name)}`, `foreignKey: ${JSON.stringify(rel.foreignKey)}`, `titleField: ${JSON.stringify(titleF)}`]
        if (rel.parentField) parts.push(`parentField: ${JSON.stringify(rel.parentField)}`)
        if (rel.subtitleField) parts.push(`subtitleField: ${JSON.stringify(cAs(rel.subtitleField))}`)
        if (rel.dateField) parts.push(`dateField: ${JSON.stringify(rel.dateField)}`)
        if (rel.statusField) parts.push(`statusField: ${JSON.stringify(rel.statusField)}`)
        return `{ ${parts.join(', ')} }`
      }).filter(Boolean)
      if (rels.length) props.push(`related={[${rels.join(', ')}]}`)
      // Open the record named by the URL `?id=` (set by a grid / board / calendar
      // drill-through); stays switchable via the header dropdown.
      props.push(`selectedId={$page.url.searchParams.get('id') ?? undefined}`)
      if (h) props.push(`height={${h}}`)
      return `    <div ${wrapperStyle(block)}${cls}>
      <SvRecordDetail ${props.join(' ')} />
    </div>`
    }
    case 'lookup':
      return `    <div ${span}${cls}><!-- lookup (${cfg.field}): shown in the edit form --></div>`
    case 'component':
      return componentBlockMarkup(block, cfg, ctx.handleNames?.get(block.id), rowsExpr)
    case 'form':
    default:
      return '' // the form is the edit modal, rendered after the screen grid
  }
}

/** Emits a UI-kit component block (see `UI_COMPONENT_REGISTRY`): a literal
 *  `<SvXxx .../>` tag carrying its configured "chrome" props + optional text
 *  content. Entity-agnostic - used both from `blockMarkup` (mixed onto an
 *  entity-bound screen) and directly from `freestandingScreenPage`. String/select/
 *  color values go through `jsStr` so free-typed text (quotes, braces, HTML) can
 *  never break out of the attribute or the surrounding markup. */
/** The expression for a bound component prop, computed from the screen's rows.
 *  `rowsExpr` is the rows variable (e.g. `allRows`); `numeric` picks number vs string. */
function bindingExpr(binding: ComponentBinding, rowsExpr: string, numeric: boolean): string {
  if (binding.kind === 'aggregate') {
    const agg = `reduceValue(${rowsExpr}, { ${binding.field ? `measure: ${jsStr(binding.field)}, ` : ''}reduce: '${binding.reduce}' })`
    return numeric ? agg : `(${agg}).toLocaleString()`
  }
  if (binding.kind === 'field') {
    const raw = `${rowsExpr}[0]?.[${jsStr(binding.field)}]`
    return numeric ? `Number(${raw} ?? 0)` : `String(${raw} ?? '')`
  }
  return `((rows) => (${binding.code}))(${rowsExpr})` // expr: `rows` is the alias
}

function componentBlockMarkup(block: Block, cfg: ComponentConfig, handleName?: string, rowsExpr?: string): string {
  const span = wrapperStyle(block)
  const cls = wrapperClass(block)
  const spec = uiComponentSpec(cfg.component)
  if (!spec) return `    <div ${span}${cls}><!-- unknown component "${cfg.component}" --></div>`
  if (handleName) {
    // Handle mode (code page): props + content come from the reactive handle, and
    // clicks fire on it - so button1.setVariant(...) / button1.onclick = fn work.
    const inner = spec.hasContent ? `>{${handleName}.text}</${spec.importName}>` : ' />'
    // `change` bubbles up from any inner input, so the wrapper catches it too - that
    // powers the "On change" method slot without knowing the component's shape.
    return `    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div id="${block.id}" onclick={(e) => ${handleName}.fire('click', e)} onchange={(e) => ${handleName}.fire('change', e)} ${span}${cls}>
      <${spec.importName} {...${handleName}.props}${inner}
    </div>`
  }
  // Data bindings: a bound prop's value is a reactive expression over the screen's
  // rows (rowsExpr) instead of a literal. Only usable where rows exist (entity screen).
  const bindings = cfg.bindings ?? {}
  const bound = (key: string): ComponentBinding | undefined => (rowsExpr ? bindings[key] : undefined)
  const attrs: string[] = []
  for (const p of spec.props) {
    const b = bound(p.key)
    if (b) { attrs.push(`${p.key}={${bindingExpr(b, rowsExpr!, p.type === 'number')}}`); continue }
    const v = cfg.props[p.key] ?? p.default
    if (v == null || v === '') continue
    if (p.type === 'boolean') { if (v) attrs.push(p.key) }
    else if (p.type === 'number') attrs.push(`${p.key}={${Number(v)}}`)
    else attrs.push(`${p.key}={${jsStr(String(v))}}`)
  }
  // Baked-in array/object props (Timeline items, Sparkline data): emitted verbatim.
  for (const f of spec.fixed ?? []) attrs.push(`${f.key}={${f.expr}}`)
  const openTag = `<${spec.importName}${attrs.length ? ' ' + attrs.join(' ') : ''}`
  const contentB = bound('_content')
  const inner = !spec.hasContent
    ? ' />'
    : contentB
      ? `>{${bindingExpr(contentB, rowsExpr!, false)}}</${spec.importName}>`
      : `>{${jsStr(String(cfg.props._content ?? spec.contentDefault ?? ''))}}</${spec.importName}>`
  return `    <div id="${block.id}" ${span}${cls}>
      ${openTag}${inner}
    </div>`
}

/** The `{ props, text }` init literal for a component's reactive handle. */
function handleInit(cfg: ComponentConfig): string {
  const spec = uiComponentSpec(cfg.component)
  const props: string[] = []
  for (const p of spec?.props ?? []) {
    const v = cfg.props[p.key] ?? p.default
    if (v == null || v === '') continue
    props.push(`${p.key}: ${p.type === 'number' ? Number(v) : p.type === 'boolean' ? !!v : jsStr(String(v))}`)
  }
  for (const f of spec?.fixed ?? []) props.push(`${f.key}: ${f.expr}`)
  const parts = [`props: { ${props.join(', ')} }`]
  if (spec?.hasContent) parts.push(`text: ${jsStr(String(cfg.props._content ?? spec.contentDefault ?? ''))}`)
  return `{ ${parts.join(', ')} }`
}

// --- new-block helpers ------------------------------------------------------

const jsStr = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/** A JS predicate expression (over `value`) for a conditional-format rule. */
function formatPredicate(op: string, value?: string | number): string | null {
  const num = Number(value)
  switch (op) {
    case 'eq': return `String(value) === ${JSON.stringify(String(value ?? ''))}`
    case 'ne': return `String(value) !== ${JSON.stringify(String(value ?? ''))}`
    case 'lt': return `Number(value) < ${num}`
    case 'lte': return `Number(value) <= ${num}`
    case 'gt': return `Number(value) > ${num}`
    case 'gte': return `Number(value) >= ${num}`
    case 'contains': return `String(value).toLowerCase().includes(${JSON.stringify(String(value ?? '').toLowerCase())})`
    case 'empty': return `value == null || value === ''`
    case 'notEmpty': return `value != null && value !== ''`
    default: return null
  }
}
/** Compile a grid's no-code format rules into a `conditionalFormats` array literal. */
function conditionalFormatsExpr(cfg: GridConfig): string | null {
  const entries: string[] = []
  for (const r of cfg.formatRules ?? []) {
    if ((r.op === 'lt' || r.op === 'lte' || r.op === 'gt' || r.op === 'gte') && !Number.isFinite(Number(r.value))) continue
    const pred = formatPredicate(r.op, r.value)
    if (!pred) continue
    const style = [
      r.background ? `background: ${jsStr(r.background)}` : '',
      r.color ? `color: ${jsStr(r.color)}` : '',
      r.bold ? `fontWeight: 700` : '',
    ].filter(Boolean)
    if (!style.length) continue
    entries.push(`{ type: 'rule' as const, columns: [${jsStr(r.field)}], when: ({ value }: { value: unknown }) => ${pred}, ${style.join(', ')} }`)
  }
  return entries.length ? `[${entries.join(', ')}]` : null
}
const fieldLabel = (f: EntityField) => f.label ?? f.field
/** Stable per-block identifiers for a filter panel's state + apply function. */
const facetNames = (block: Block) => {
  const s = block.id.replace(/-/g, '_')
  return { state: `facet_${s}`, apply: `applyFacet_${s}` }
}
const filterFieldsOf = (entity: EntitySchema, cfg: FilterPanelConfig): EntityField[] =>
  cfg.fields.map((name) => entity.fields.find((f) => f.field === name)).filter((f): f is EntityField => !!f)
/** Normalise a field's enum options to `{ value, label }`. */
function enumOpts(f: EntityField): { value: string; label: string }[] {
  return (f.options ?? []).map((o) =>
    o && typeof o === 'object'
      ? { value: String((o as { value: unknown }).value), label: String((o as { label?: unknown; value: unknown }).label ?? (o as { value: unknown }).value) }
      : { value: String(o), label: String(o) },
  )
}

/** Every non-key, aggregatable field as a PivotField literal (number -> measure). */
function pivotFieldsExpr(entity: EntitySchema): string {
  const pk = entity.idField ?? entity.fields.find((f) => f.primaryKey)?.field
  const items = entity.fields
    .filter((f) => f.field !== pk && f.type !== 'json' && f.type !== 'relation')
    .map((f) => {
      const kind = f.type === 'number' ? 'measure' : 'dimension'
      const agg = f.type === 'number' ? `, defaultAgg: 'sum'` : ''
      return `{ field: ${jsStr(f.field)}, label: ${jsStr(fieldLabel(f))}, kind: '${kind}'${agg} }`
    })
  return `[${items.join(', ')}]`
}
/** The initial pivot layout literal from the block config. */
function pivotLayoutExpr(cfg: PivotConfig): string {
  const rows = cfg.rows.map(jsStr).join(', ')
  const cols = cfg.cols.map(jsStr).join(', ')
  const values = cfg.measure ? `[{ field: ${jsStr(cfg.measure)}, agg: '${cfg.aggregate}' }]` : '[]'
  return `{ rows: [${rows}], cols: [${cols}], values: ${values}, filters: [] }`
}

/** The `<script>` state + apply() for one filter panel. */
function filterPanelState(entity: EntitySchema, block: Block, cfg: FilterPanelConfig): string {
  const { state, apply } = facetNames(block)
  const assigns = filterFieldsOf(entity, cfg).map((f) => {
    const key = jsStr(f.field)
    if (f.type === 'boolean') return `    if (v[${key}] === 'true' || v[${key}] === 'false') c[${key}] = { operator: 'equals', value: v[${key}] === 'true' }`
    if (f.type === 'enum') return `    if (v[${key}]) c[${key}] = { operator: 'equals', value: v[${key}] }`
    return `    if (v[${key}]) c[${key}] = { operator: 'contains', value: v[${key}] }`
  }).join('\n')
  return `let ${state} = $state<Record<string, string>>({})
  function ${apply}() {
    const v = ${state}
    const c: Record<string, { operator: 'equals' | 'contains'; value: unknown }> = {}
${assigns}
    controller.setFilter({ columns: c })
  }`
}
/** The faceted filter sidebar markup, wired to its facet state. */
function filterPanelMarkup(entity: EntitySchema, block: Block, cfg: FilterPanelConfig): string {
  const { state, apply } = facetNames(block)
  const controls = filterFieldsOf(entity, cfg).map((f) => {
    const set = `${state}[${jsStr(f.field)}] = e.currentTarget.value; ${apply}()`
    if (f.type === 'enum') {
      const opts = enumOpts(f).map((o) => `<option value="${o.value}">${o.label}</option>`).join('')
      return `      <label class="st-filter__row"><span>${fieldLabel(f)}</span>
        <select onchange={(e) => { ${set} }}><option value="">Any</option>${opts}</select>
      </label>`
    }
    if (f.type === 'boolean') {
      return `      <label class="st-filter__row"><span>${fieldLabel(f)}</span>
        <select onchange={(e) => { ${set} }}><option value="">Any</option><option value="true">Yes</option><option value="false">No</option></select>
      </label>`
    }
    return `      <label class="st-filter__row"><span>${fieldLabel(f)}</span>
        <input type="search" placeholder="Search…" oninput={(e) => { ${set} }} />
      </label>`
  }).join('\n')
  return `    <aside ${wrapperStyle(block)}${wrapperClass(block, 'st-filter')}>
      <div class="st-filter__title">${cfg.title ?? 'Filters'}</div>
${controls}
    </aside>`
}
/** A `{#snippet}` rendering a grid row's action buttons (edit / delete / navigate).
 *  Buttons are unrolled statically; RBAC gates edit/delete when `gate` is set. */
function rowActionsSnippet(idSafe: string, typeName: string, entity: EntitySchema, actions: RowAction[], routeById: Map<string, string>, gate: boolean, screenId: string): string {
  const idField = entity.idField ?? entity.fields.find((f) => f.primaryKey)?.field ?? 'id'
  const rowId = `String((row as Record<string, unknown>)[${jsStr(idField)}] ?? '')`
  const buttons = actions.map((a) => {
    if (a.kind === 'edit') {
      const btn = `<button type="button" class="st-rowaction" onclick={(e) => { e.stopPropagation(); editing = row }}>${a.label ?? 'Edit'}</button>`
      return gate ? `{#if can($currentRole, 'update')}${btn}{/if}` : btn
    }
    if (a.kind === 'delete') {
      const btn = `<button type="button" class="st-rowaction st-rowaction--danger" onclick={(e) => { e.stopPropagation(); controller.deleteRow(${rowId}) }}>${a.label ?? 'Delete'}</button>`
      return gate ? `{#if can($currentRole, 'delete')}${btn}{/if}` : btn
    }
    if (a.kind === 'custom') {
      if (!a.id) return ''
      const safe = actionIdSafe(a.id)
      const call = `runAction_${safe}({ id: ${rowId} })`
      const onclick = a.confirm ? `(e) => { e.stopPropagation(); if (confirm(${jsStr(a.confirm)})) ${call} }` : `(e) => { e.stopPropagation(); ${call} }`
      const btn = `<button type="button" class="st-rowaction" disabled={actionBusy_${safe}} onclick={${onclick}}>${a.icon ? `${a.icon} ` : ''}${a.label ?? 'Run'}</button>`
      return gate ? `{#if canScreen($currentRole, ${jsStr(screenId)})}${btn}{/if}` : btn
    }
    const route = a.screen && routeById.get(a.screen)
    if (!route) return ''
    const src = a.sourceField ?? idField
    const target = a.targetField ?? idField
    return `<button type="button" class="st-rowaction" onclick={(e) => { e.stopPropagation(); goto('/${route}?${target}=' + encodeURIComponent(String((row as Record<string, unknown>)[${jsStr(src)}] ?? ''))) }}>${a.label ?? 'Open'}</button>`
  }).filter(Boolean).join('\n    ')
  return `{#snippet rowActions_${idSafe}({ row }: { row: ${typeName} })}
  <div class="st-rowactions">
    ${buttons}
  </div>
{/snippet}`
}

/** Sanitize a user action id into a valid JS identifier suffix. */
const actionIdSafe = (id: string): string => id.replace(/[^a-zA-Z0-9_]/g, '_')

/** A stable identifier suffix for a `<grid>_<field>` cell-renderer snippet. */
const cellSnippetName = (idSafe: string, field: string): string => `cellRender_${idSafe}_${field.replace(/[^a-zA-Z0-9_]/g, '_')}`

/** Does this grid want an export toolbar (any export affordance enabled)? */
function gridHasExport(cfg: GridConfig): boolean {
  const e = cfg.export
  return !!e && (!!e.csv || !!e.json || !!e.copy)
}

/** Is this a tree-data grid (self-referential hierarchy)? */
const gridHasTree = (cfg: GridConfig): boolean => !!cfg.treeData

/** The `scheduler={{ ... }}` config object for a grid rendered as a calendar/scheduler,
 *  including optimistic write-back handlers (drag-move / resize / drawer-edit) that update
 *  `allRows` and persist via the `controller`. Shared by the grid scheduler-view + the
 *  calendar block. `startField` is required; the rest refine the mapping. */
function schedulerConfigExpr(sc: SchedulerViewConfig, typeName: string, asText: (f: string) => string = (f) => f): string {
  const entries: string[] = [`startField: ${jsStr(sc.startField)}`]
  if (sc.endField) entries.push(`endField: ${jsStr(sc.endField)}`)
  // Title / color / resource can be relation FKs - point them at the denormalized display column.
  if (sc.titleField) entries.push(`titleField: ${jsStr(asText(sc.titleField))}`)
  if (sc.colorField) entries.push(`colorField: ${jsStr(asText(sc.colorField))}`)
  if (sc.resourceField) entries.push(`resourceField: ${jsStr(asText(sc.resourceField))}`)
  if (sc.recurrenceField) entries.push(`recurrenceField: ${jsStr(sc.recurrenceField)}`)
  if (sc.allDayField) entries.push(`allDayField: ${jsStr(sc.allDayField)}`)
  if (sc.initialView) entries.push(`initialView: ${jsStr(sc.initialView)}`)
  if (sc.drawer) entries.push(`drawer: true`)
  if (sc.editable) {
    entries.push(`editable: true`)
    // start / (optional) end write-back: optimistic on allRows, then persist.
    const patch = sc.endField
      ? `{ [${jsStr(sc.startField)}]: e.start.toISOString(), [${jsStr(sc.endField)}]: e.end.toISOString() }`
      : `{ [${jsStr(sc.startField)}]: e.start.toISOString() }`
    const move = `(e) => { const id = String((e.row as Record<string, unknown>)[idField]); const patch = ${patch}; allRows = allRows.map((r) => String((r as Record<string, unknown>)[idField]) === id ? { ...r, ...patch } : r); controller.updateRow(id, patch as Partial<${typeName}>) }`
    entries.push(`onEventMove: ${move}`)
    entries.push(`onEventResize: ${move}`)
    entries.push(`onEventCommit: (e) => { const id = String((e.row as Record<string, unknown>)[idField]); allRows = allRows.map((r) => String((r as Record<string, unknown>)[idField]) === id ? { ...r, ...(e.changes as Partial<${typeName}>) } : r); controller.updateRow(id, e.changes as Partial<${typeName}>) }`)
  }
  return `{ ${entries.join(', ')} }`
}

/** The filter-surface props for a grid: a global search, a per-column filter row, and/or
 *  the column header filter menu. Undefined `filterUi` = the global search only (back-compat). */
function filterSurfaceProps(cfg: GridConfig): string[] {
  const ui = cfg.filterUi
  const out: string[] = []
  if (!ui || ui.global) out.push('showGlobalFilter')
  if (ui?.row) out.push('showFilterRow')
  if (ui?.menu) out.push('showFilterMenu')
  // A filterable grid with every surface turned off still needs one; fall back to global.
  return out.length ? out : ['showGlobalFilter']
}

/** Script for a tree-data grid: expand state + a derived visible-row walk over `allRows`.
 *  Builds the hierarchy from the self-referential parent field; a row whose parent is
 *  empty / not in the set is a root. Nodes are expanded by default (toggle to collapse). */
function treeGridScript(idSafe: string, typeName: string, cfg: GridConfig): string {
  const parent = jsStr(cfg.treeData!.parentField)
  const rec = `(r as Record<string, unknown>)`
  return `let treeExpanded_${idSafe} = $state<Record<string, boolean>>({})
  function toggleTree_${idSafe}(id: string) { treeExpanded_${idSafe} = { ...treeExpanded_${idSafe}, [id]: !(treeExpanded_${idSafe}[id] ?? true) } }
  function treeBuild_${idSafe}() {
    const rows = allRows
    const idOf = (r: ${typeName}) => String(${rec}[idField] ?? '')
    const parentOf = (r: ${typeName}) => { const v = ${rec}[${parent}]; return v == null || v === '' ? null : String(v) }
    const present = new Set(rows.map(idOf))
    const children = new Map<string | null, ${typeName}[]>()
    for (const r of rows) { const p = parentOf(r); const key = p != null && present.has(p) ? p : null; const list = children.get(key) ?? []; list.push(r); children.set(key, list) }
    const info = new Map<string, { depth: number; hasChildren: boolean; expanded: boolean }>()
    const visible: ${typeName}[] = []
    const walk = (parentId: string | null, depth: number) => {
      for (const r of children.get(parentId) ?? []) {
        const id = idOf(r); const hasChildren = (children.get(id)?.length ?? 0) > 0; const expanded = treeExpanded_${idSafe}[id] ?? true
        info.set(id, { depth, hasChildren, expanded }); visible.push(r)
        if (hasChildren && expanded) walk(id, depth + 1)
      }
    }
    walk(null, 0)
    return { info, visible }
  }
  const tree_${idSafe} = $derived(treeBuild_${idSafe}())`
}

/** The `{#snippet}` for a tree grid's label column: indent by depth + an expand toggle. */
function treeCellSnippet(idSafe: string, typeName: string): string {
  const idExpr = `String((row as Record<string, unknown>)[idField] ?? '')`
  return `{#snippet treeCell_${idSafe}({ value, row }: { value: unknown; row: ${typeName} })}
  {@const info = tree_${idSafe}.info.get(${idExpr})}
  <span class="st-treecell" style="padding-left: {(info?.depth ?? 0) * 18}px;">
    {#if info?.hasChildren}<button type="button" class="st-tree-toggle" aria-label="Toggle" aria-expanded={info.expanded} onclick={() => toggleTree_${idSafe}(${idExpr})}>{info.expanded ? '▾' : '▸'}</button>{:else}<span class="st-tree-spacer"></span>{/if}
    <span>{String(value ?? '')}</span>
  </span>
{/snippet}`
}

/** The export toolbar markup for a grid: buttons wired to the captured grid API var. */
function exportToolbarMarkup(e: NonNullable<GridConfig['export']>, apiVar: string, entityName: string): string {
  const fn = jsStr(entityName)
  const btns: string[] = []
  if (e.csv) btns.push(`<button type="button" class="st-rowaction" onclick={() => void ${apiVar}?.exportCsv({ filename: ${fn} })}>Export CSV</button>`)
  if (e.json) btns.push(`<button type="button" class="st-rowaction" onclick={() => void ${apiVar}?.exportJson({ filename: ${fn} })}>Export JSON</button>`)
  if (e.copy) btns.push(`<button type="button" class="st-rowaction" onclick={() => void ${apiVar}?.copyToClipboard()}>Copy</button>`)
  return `      <div class="st-grid-toolbar">\n        ${btns.join('\n        ')}\n      </div>\n`
}

/** Shared helper: map a status-ish value to a badge intent by common vocabulary.
 *  Emitted once per page when any column uses the `badge` cell renderer. */
const BADGE_VARIANT_HELPER = `  function stBadgeVariant(value: unknown): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
    const v = String(value ?? '').toLowerCase().trim()
    if (['active', 'open', 'success', 'done', 'paid', 'approved', 'complete', 'completed', 'won', 'shipped', 'yes', 'true'].includes(v)) return 'success'
    if (['pending', 'warning', 'in progress', 'processing', 'trial', 'review', 'on hold', 'medium'].includes(v)) return 'warning'
    if (['closed', 'error', 'failed', 'cancelled', 'canceled', 'overdue', 'rejected', 'lost', 'blocked', 'inactive', 'no', 'false', 'high', 'urgent'].includes(v)) return 'danger'
    if (['new', 'info', 'draft', 'low'].includes(v)) return 'info'
    return 'neutral'
  }`

/** The `{#snippet}` body for one rich cell renderer (badge / progress / link). */
function cellRendererSnippet(idSafe: string, field: string, cellType: NonNullable<GridColumnConfig['cellType']>): string {
  const name = cellSnippetName(idSafe, field)
  const head = `{#snippet ${name}({ value }: { value: unknown })}`
  if (cellType.kind === 'badge') {
    return `${head}\n  <SvBadge variant={stBadgeVariant(value)} size="sm" pill>{String(value ?? '')}</SvBadge>\n{/snippet}`
  }
  if (cellType.kind === 'progress') {
    return `${head}\n  <div class="st-cell-progress"><SvProgress value={Number(value ?? 0)} max={${cellType.max ?? 100}} size="sm" color="accent" /></div>\n{/snippet}`
  }
  // link: mailto / tel / plain url (new tab)
  const prefix = cellType.as === 'email' ? "'mailto:' + " : cellType.as === 'tel' ? "'tel:' + " : ''
  const extra = cellType.as === 'url' || !cellType.as ? ' target="_blank" rel="noreferrer"' : ''
  return `${head}\n  <a class="st-cell-link" href={${prefix}String(value ?? '')}${extra}>{String(value ?? '')}</a>\n{/snippet}`
}

/** `let <busy> = $state(false)` + `async function runAction_<id>(payload?)` for one
 *  custom action - POSTs to its generated stub route, tracks a busy flag the button
 *  binds to, surfaces a failure via `alert` (no toast/notification dependency
 *  assumed - swap for the app's own if it has one). */
function actionHandlerScript(a: ActionConfig): string {
  const safe = actionIdSafe(a.id)
  return `let actionBusy_${safe} = $state(false)
  async function runAction_${safe}(payload?: Record<string, unknown>) {
    actionBusy_${safe} = true
    try {
      const res = await fetch('/api/actions/${a.id}', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload ?? {}) })
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Action failed')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed')
    } finally {
      actionBusy_${safe} = false
    }
  }`
}

/** A toolbar action button - RBAC-gated by screen access (not a CRUD `can()`
 *  check, since a custom action isn't inherently create/update/delete). */
function actionToolbarButton(a: ActionConfig, screenId: string, gate: boolean): string {
  const safe = actionIdSafe(a.id)
  const onclick = a.confirm ? `() => { if (confirm(${jsStr(a.confirm)})) runAction_${safe}() }` : `() => runAction_${safe}()`
  const btn = `<button type="button" class="st-btn" disabled={actionBusy_${safe}} onclick={${onclick}}>${a.icon ? `${a.icon} ` : ''}${a.label}</button>`
  return gate ? `{#if canScreen($currentRole, ${jsStr(screenId)})}${btn}{/if}` : btn
}

/** The stub API route for one custom action: RBAC-gated by screen access (when
 *  enabled), everything else left as a `// TODO` for the developer. This is the
 *  file they actually edit - the button + client wiring around it is generated. */
function actionRouteFile(a: ActionConfig, screenId: string, accessEnabled: boolean): GeneratedFile {
  const accessImport = accessEnabled ? `\nimport { getServerRole, canScreen } from '$lib/access'` : ''
  const guard = accessEnabled
    ? `\n  if (!canScreen(getServerRole(event), ${jsStr(screenId)})) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })\n`
    : ''
  return {
    path: `src/routes/api/actions/${a.id}/+server.ts`,
    description: `Stub route for the "${a.label}" action - fill in the actual logic.`,
    contents: `${accessImport}
export async function POST(event: { request: Request; locals?: Record<string, unknown> }) {${guard}
  const body = await event.request.json().catch(() => ({})) as Record<string, unknown>
  void body // the row id (row actions) or {} (toolbar actions) - use it to look up what to act on

  // TODO: your business logic here.

  return new Response(JSON.stringify({ ok: true }))
}
`,
  }
}

/** All custom actions used by a screen - its own toolbar actions, plus any
 *  `'custom'` row actions inside its grid blocks - deduped by id. Used both to
 *  emit the client-side handler scripts on the page itself, and (once per
 *  project, not per screen) to generate each action's stub API route. */
function screenActionsOf(screen: Screen): ActionConfig[] {
  const byId = new Map<string, ActionConfig>()
  for (const a of screen.actions ?? []) byId.set(a.id, a)
  for (const b of flattenBlocks(screen.blocks)) {
    if (b.config.kind !== 'grid') continue
    for (const a of b.config.rowActions ?? []) {
      if (a.kind === 'custom' && a.id && !byId.has(a.id)) {
        byId.set(a.id, { id: a.id, label: a.label ?? 'Run', icon: a.icon, confirm: a.confirm })
      }
    }
  }
  return [...byId.values()]
}

/** The record detail panel markup: an inline edit form (editable) or a read-only
 *  field list, bound to `selectedRecord`. */
function recordPanelMarkup(entity: EntitySchema, schemaVar: string, block: Block, cfg: RecordConfig): string {
  const span = wrapperStyle(block)
  let inner: string
  if (cfg.editable) {
    const pres = cfg.presentation ?? 'inline'
    // Modal / drawer float over the page (shown only while a row is selected);
    // inline lives in the block, with a prompt when nothing is selected.
    inner = pres === 'inline'
      ? `      {#if selectedRecord}
        <SvGridEditPanel schema={${schemaVar}} row={selectedRecord} presentation="inline" onSubmit={saveRecord} onCancel={() => (selectedRecord = null)} />
      {:else}
        <p class="st-hint">Select a row to see its details.</p>
      {/if}`
      : `      <p class="st-hint">Select a row to open its ${pres === 'drawer' ? 'editor drawer' : 'edit dialog'}.</p>
      {#if selectedRecord}
        <SvGridEditPanel schema={${schemaVar}} row={selectedRecord} presentation="${pres}" onSubmit={saveRecord} onCancel={() => (selectedRecord = null)} />
      {/if}`
  } else {
    const pk = entity.idField ?? entity.fields.find((f) => f.primaryKey)?.field
    const chosen = cfg.fields && cfg.fields.length
      ? entity.fields.filter((f) => cfg.fields!.includes(f.field))
      : entity.fields.filter((f) => f.field !== pk)
    const rows = chosen.map((f) => `          <div class="st-record__row"><dt>${fieldLabel(f)}</dt><dd>{String((selectedRecord as Record<string, unknown>)[${jsStr(f.field)}] ?? '')}</dd></div>`).join('\n')
    inner = `      {#if selectedRecord}
        <dl class="st-record">
${rows}
        </dl>
      {:else}
        <p class="st-hint">Select a row to see its details.</p>
      {/if}`
  }
  return `    <div ${span}${wrapperClass(block, 'st-record-card')}>
${inner}
    </div>`
}

/** A freestanding page - no bound entity, so no entity-bound `Block`; it can
 *  still hold `'component'` blocks (UI-kit widgets, not data-bound). Renders a
 *  title, an optional toolbar of custom actions, and those component blocks (or
 *  a placeholder comment if it has none yet). */
/** Does this screen carry a user-owned code companion (design + your own code)?
 *  Any of: the code flag, a Grid to fill, or an already-written handler body. */
function screenHasCode(screen: Screen): boolean {
  return screen.code === true || screen.renderGrid === true || (screen.state?.length ?? 0) > 0 || Object.keys(screen.handlerBodies ?? {}).length > 0 || Object.keys(screen.handlerSteps ?? {}).length > 0
}

/** The first grid block's id (the one whose api we bind), if any. */
function firstGridBlockId(screen: Screen): string | undefined {
  return flattenBlocks(screen.blocks).find((b) => b.config.kind === 'grid')?.id
}

// --- code-behind handle model ----------------------------------------------
// Every code-reachable block on a code-enabled screen becomes a named member of
// the page `ctx`, tiered by how much API it has: the Grid's real SvGridApi
// (ctx.grid), a data-viz block's DataHandle (ctx.chart1.setData(rows)), or a UI
// component's typed Handle (ctx.button1.setLabel(...)). screenHandles() is the
// single source of truth these three consumers agree on: the page's ctx
// construction, the PageContext type, and the handlers.ts manifest.

export type HandleTier = 'grid' | 'data' | 'component'
export type BlockHandle = { blockId: string; kind: Block['config']['kind']; name: string; tier: HandleTier; component?: string }

/** Data-bound block kinds that read the screen dataset and get a DataHandle. Kept
 *  to the pure `allRows`-driven viz blocks; board/calendar/detail have their own
 *  interaction model and stay declarative. */
const DATA_HANDLE_KINDS: ReadonlySet<Block['config']['kind']> = new Set(['chart', 'kpi', 'gauge', 'pivot', 'tree', 'dashboard'])

/** All code-reachable handles on a screen, in ctx order: the primary Grid, then
 *  top-level data-viz blocks (setData), then UI-component blocks (setProp/onclick).
 *  Names are unique JS identifiers used verbatim as `ctx.<name>` and the page's
 *  local var: component names come from componentHandleName (unchanged, stable),
 *  data-viz names are sequential per kind and dodge any grid/component collision.
 *  Exported so the designer's Code view lists the exact same ctx members. */
export function screenHandles(screen: Screen): BlockHandle[] {
  const grid: BlockHandle[] = []
  const taken = new Set<string>()
  // The primary Grid: an entity screen's grid block, or the freestanding page's
  // synthesized renderGrid (which has no block - blockId is a synthetic marker).
  const gid = firstGridBlockId(screen)
  if (gid || screen.renderGrid) { grid.push({ blockId: gid ?? '__grid__', kind: 'grid', name: 'grid', tier: 'grid' }); taken.add('grid') }
  // Component handles claim their (user-facing, stable) names first.
  const components: BlockHandle[] = []
  for (const b of flattenBlocks(screen.blocks)) {
    if (b.config.kind !== 'component') continue
    // Data-bound components render reactively from the rows (static markup), so they
    // don't get a code handle - their value comes from the binding, not ctx.<name>.
    if (componentHasBindings(b.config)) continue
    const name = componentHandleName(b.config)
    taken.add(name)
    components.push({ blockId: b.id, kind: 'component', name, tier: 'component', component: b.config.component })
  }
  // Top-level data-viz blocks get a DataHandle (nested-in-tabs viz keeps reading allRows).
  const data: BlockHandle[] = []
  for (const b of screen.blocks) {
    if (!DATA_HANDLE_KINDS.has(b.config.kind)) continue
    let n = 1
    let name = `${b.config.kind}${n}`
    while (taken.has(name)) name = `${b.config.kind}${++n}`
    taken.add(name)
    data.push({ blockId: b.id, kind: b.config.kind, name, tier: 'data' })
  }
  return [...grid, ...data, ...components]
}

/** blockId -> handle var name, for wiring markup (grid api capture / data rows / component props). */
function handleNameMap(screen: Screen): Map<string, string> {
  return new Map(screenHandles(screen).map((h) => [h.blockId, h.name]))
}

/** Does this code-enabled screen expose a `ctx.data` dataset battery, and can code
 *  replace its rows? Freestanding data-grid pages own their rows (settable via
 *  setRows); an entity screen with a Grid exposes its current page + reload(). */
export function screenDataset(screen: Screen): 'none' | 'settable' | 'reload' {
  if (screen.entity === undefined) return screen.renderGrid ? 'settable' : 'none'
  return has(screen.blocks, 'grid') ? 'reload' : 'none'
}

/** The full `SvGridApi` method surface (canonical - mirrors `svgrid-wrapper.types.ts`),
 *  grouped by area so the Code view's autocomplete offers every grid operation a
 *  developer can call as `ctx.grid.<method>()`, not just a curated handful. */
export const GRID_API_MEMBERS: ReadonlyArray<string> = [
  // cells
  'getCellValue', 'setCellValue', 'startEditing', 'stopEditing',
  // cell selection
  'selectCells', 'getSelected',
  // integrated charting
  'openChart', 'closeChart', 'getChartSpec', 'chartRange', 'configureChart', 'setChartAiHandler',
  // rows
  'addRow', 'addRows', 'removeRow', 'removeRows', 'applyTransaction',
  // columns
  'addColumn', 'addColumns', 'removeColumn', 'setColumnVisible', 'isColumnVisible',
  // sort / group / filter
  'setSort', 'clearSort', 'setGroupBy', 'setFilter', 'setFacetFilter', 'clearFilter', 'clearAllFilters', 'getFilters',
  // data
  'getDisplayedRows', 'getData', 'getColumns',
  // export / clipboard
  'exportCsv', 'exportTsv', 'exportJson', 'copyToClipboard',
  // selection / width / pinning / order
  'clearRowSelection', 'setColumnWidth', 'getColumnWidths', 'autosizeColumn', 'autosizeAllColumns',
  'setColumnPinning', 'getColumnPinning', 'setColumnOrder', 'getColumnOrder',
  // grouping expansion / history
  'setRowExpanded', 'expandAllGroups', 'collapseAllGroups', 'undo', 'redo',
]

/** A DataHandle's members (setData feeds it rows, .rows reads them, clear() follows the dataset). */
const DATA_HANDLE_MEMBERS: ReadonlyArray<string> = ['setData()', 'rows', 'clear()']

/** Every member a component handle exposes (registry-derived): its typed setters,
 *  plus setText/setLabel (content components), onclick assignment, and the generic
 *  set/get/onClick helpers. Display strings for the editor's autocomplete. */
export function componentHandleMembers(componentKey: string): string[] {
  const spec = uiComponentSpec(componentKey)
  const out: string[] = []
  if (spec?.hasContent) out.push('text', 'setText()', 'setLabel()')
  // Each prop shows up as a settable property (checked) AND a setter method (setChecked()).
  for (const p of spec?.props ?? []) {
    out.push(p.key)
    out.push(`set${p.key[0]!.toUpperCase()}${p.key.slice(1)}()`)
  }
  out.push('onclick', 'onClick()', 'set()', 'get()')
  return out
}

/** The COMPLETE `ctx.<...>` completion surface for a screen's Code view: the full
 *  grid api, every data-handle + component-handle member, and the data/goto/params
 *  batteries. Shared with the designer so autocomplete matches the real generated
 *  ctx member-for-member (not a hand-picked subset). */
export function ctxCompletions(screen: Screen): string[] {
  const out = ['ctx']
  for (const h of screenHandles(screen)) {
    const base = `ctx.${h.name}`
    out.push(base)
    if (h.tier === 'grid') out.push(...GRID_API_MEMBERS.map((m) => `${base}.${m}()`))
    else if (h.tier === 'data') out.push(...DATA_HANDLE_MEMBERS.map((m) => `${base}.${m}`))
    else if (h.component) out.push(...componentHandleMembers(h.component).map((m) => `${base}.${m}`))
  }
  const dataset = screenDataset(screen)
  if (dataset === 'settable') out.push('ctx.data', 'ctx.data.setRows()', 'ctx.data.rows')
  else if (dataset === 'reload') out.push('ctx.data', 'ctx.data.rows', 'ctx.data.reload()')
  out.push('ctx.goto()', 'ctx.params')
  return out
}

/** The `SvGridApi<Row>` interface body - accurate signatures transcribed from
 *  `svgrid-wrapper.types.ts`, with complex param/return types loosened to `any`
 *  (so calls never false-error) while keeping useful returns (Promise<string>,
 *  boolean, ...). Self-contained: the only external reference is the `Row` param.
 *  Powers the in-editor TypeScript service's hover / signature / diagnostics. */
const GRID_API_SIGNATURES = `  getCellValue(rowIndex: number, columnId: string): unknown
  setCellValue(rowIndex: number, columnId: string, value: unknown): void
  startEditing(rowIndex: number, columnId: string): boolean
  stopEditing(cancel?: boolean): boolean
  selectCells(ranges: ReadonlyArray<readonly [number, number, number, number]>): void
  getSelected(): Array<[number, number, number, number]>
  openChart(): void
  closeChart(): void
  getChartSpec(): unknown
  chartRange(ranges?: ReadonlyArray<readonly [number, number, number, number]>): void
  configureChart(config: { open?: boolean; type?: string; dimension?: string | null; series?: string | null; measure?: string | null; reduce?: 'sum' | 'avg' | 'count'; stacked?: boolean; dataLabels?: boolean; logScale?: boolean; timeAxis?: boolean; valueFormat?: 'number' | 'currency' | 'percent' | 'compact' }): void
  setChartAiHandler(handler: ((prompt: string) => Promise<Record<string, unknown> | null>) | null): void
  addRow(row: Row, position?: 'top' | 'bottom' | number): void
  addRows(rows: ReadonlyArray<Row>, position?: 'top' | 'bottom' | number): void
  removeRow(rowIndex: number): void
  removeRows(rowIndices: ReadonlyArray<number>): void
  applyTransaction(tx: { add?: Row[]; update?: Row[]; remove?: Array<string | Row> }): { added: number; updated: number; removed: number }
  addColumn(column: any, position?: 'left' | 'right' | number): void
  addColumns(columns: ReadonlyArray<any>, position?: 'left' | 'right' | number): void
  removeColumn(columnId: string): void
  setColumnVisible(columnId: string, visible: boolean): void
  isColumnVisible(columnId: string): boolean
  setSort(columnId: string, direction: 'asc' | 'desc' | null): void
  clearSort(): void
  setGroupBy(columnIds: ReadonlyArray<string>): void
  setFilter(columnId: string, filter: any | null): void
  setFacetFilter(columnId: string, values: ReadonlyArray<string> | null): void
  clearFilter(columnId: string): void
  clearAllFilters(): void
  getFilters(): Record<string, { operator: string; value: string; valueTo?: string }>
  getDisplayedRows(): ReadonlyArray<Row>
  getData(): ReadonlyArray<Row>
  getColumns(): ReadonlyArray<{ id: string; header: string; visible: boolean }>
  exportCsv(options?: any): Promise<string>
  exportTsv(options?: any): Promise<string>
  exportJson(options?: any): Promise<string>
  copyToClipboard(options?: any): Promise<string>
  clearRowSelection(): void
  setColumnWidth(columnId: string, width: number): void
  getColumnWidths(): Record<string, number>
  autosizeColumn(columnId: string): void
  autosizeAllColumns(): void
  setColumnPinning(pinning: { left?: string[]; right?: string[] }): void
  getColumnPinning(): { left: string[]; right: string[] }
  setColumnOrder(order: ReadonlyArray<string>): void
  getColumnOrder(): string[]
  setRowExpanded(id: string, expanded: boolean): void
  expandAllGroups(): void
  collapseAllGroups(): void
  undo(): boolean
  redo(): boolean`

/** Map an entity field to a TS type for the generated Row interface (mirrors scaffold.ts). */
function fieldTsType(f: EntityField): string {
  return f.type === 'number' ? 'number' : f.type === 'boolean' ? 'boolean' : 'string'
}

/**
 * A SELF-CONTAINED ambient `.d.ts` describing this screen's `ctx` (PageContext) -
 * the grid api, data handles, typed component handles, and the data/goto/params
 * batteries, all inlined with no external imports. Fed to the Code view's in-browser
 * TypeScript language service so `ctx.` gets real hover, signature help, and
 * red-squiggle diagnostics without dragging in the whole `@svgrid/grid` type graph.
 */
export function ctxAmbientDts(screen: Screen, entity?: EntitySchema): string {
  const handles = screenHandles(screen)
  const rowName = entity ? namesFor(entity).type : 'RowData'
  const rowDecl = entity
    ? `interface ${rowName} {\n${entity.fields.map((f) => `  ${f.field}: ${fieldTsType(f)}`).join('\n')}\n}`
    : `type ${rowName} = Record<string, unknown>`

  const componentKeys = [...new Set(handles.filter((h) => h.tier === 'component').map((h) => h.component!))]
  const componentTypeDecls = componentKeys.map(componentHandleTypeDecl).filter(Boolean).join('\n\n')

  const members: string[] = []
  for (const h of handles) {
    if (h.tier === 'grid') members.push(`  /** The Grid on this page - its full, real SvGridApi. */\n  grid: SvGridApi<${rowName}>`)
    else if (h.tier === 'data') members.push(`  /** The ${h.kind} - feed it rows with ${h.name}.setData(rows). */\n  ${h.name}: DataHandle<${rowName}>`)
    else members.push(`  ${h.name}: ${componentHandleTypeName(h.component!)}`)
  }
  const dataset = screenDataset(screen)
  if (dataset === 'settable') members.push(`  data: { rows: ${rowName}[]; setRows(rows: ${rowName}[]): void }`)
  else if (dataset === 'reload') members.push(`  data: { rows: ${rowName}[]; reload(): void }`)
  members.push('  goto(path: string): void')
  members.push('  params: Record<string, string>')

  return `// Ambient types for the "${screen.title}" screen's code-behind. Regenerated - editor use only.
${rowDecl}

interface SvGridApi<Row> {
${GRID_API_SIGNATURES}
}

interface DataHandle<T> {
  /** Feed this block its own rows (overrides the screen dataset until cleared). */
  setData(rows: T[]): void
  /** The rows the block renders: the override if set, else the screen dataset. */
  readonly rows: T[]
  /** Drop the override; the block follows the screen dataset again. */
  clear(): void
}

interface Handle {
  setText(value: string): void
  setLabel(value: string): void
  set(name: string, value: unknown): void
  get(name: string): unknown
  onClick(fn: (e: Event) => void): void
  onclick: (e: Event) => void
  [key: string]: any
}
${componentTypeDecls ? '\n' + componentTypeDecls + '\n' : ''}
interface PageContext {
${members.join('\n')}
}
`
}

/** A comment manifest of what `ctx` gives onLoad/onDestroy - each handle plus the
 *  data/goto/params batteries - embedded atop the user-owned handlers.ts. */
function screenElementsManifest(screen: Screen): string {
  const lines: string[] = []
  const describe: Record<HandleTier, (h: BlockHandle) => string> = {
    grid: () => "the Grid's full SvGridApi - exportCsv(), selectCells(), startEditing(), addRow(), setFilter(), ...",
    data: (h) => `the ${h.kind} - setData(rows) to feed it your own rows, .rows to read them, clear() to follow the screen data again.`,
    component: (h) => `the ${h.component} - setText/set<Prop>(...), onclick = fn, onClick(fn).`,
  }
  for (const h of screenHandles(screen)) lines.push(`//   - ctx.${h.name}: ${describe[h.tier](h)}`)
  const dataset = screenDataset(screen)
  if (dataset === 'settable') lines.push('//   - ctx.data.setRows(rows) / ctx.data.rows: the page owns its dataset.')
  else if (dataset === 'reload') lines.push('//   - ctx.data.rows / ctx.data.reload(): the current grid page + a refresh.')
  lines.push("//   - ctx.goto(path): navigate to another route.")
  lines.push("//   - ctx.params: the page's URL query params (Record<string, string>).")
  return lines.length ? `//\n// In onLoad / onDestroy, ctx gives you:\n${lines.join('\n')}\n` : ''
}

/** Indent a user-written handler body two spaces so it sits inside the function. */
function indentBody(body: string): string {
  return body.split('\n').map((l) => (l.trim() ? `  ${l}` : l)).join('\n')
}

/** Shared runtime: the reactive, imperative handle behind each component. Lets page
 *  code do button1.setLabel('Save'), button1.setVariant('danger'), button1.onclick = fn. */
function handlesModuleFile(): GeneratedFile {
  return {
    path: 'src/lib/handles.svelte.ts',
    description: 'Reactive imperative handles for UI components (btn.setLabel, btn.onclick = ...).',
    contents: `// Regenerated by SvGrid Studio.
/** An imperative, reactive handle over a UI component. In page code you get one
 *  per component (e.g. \`button1\`); mutate it and the component updates. */
export class ComponentHandle {
  props = $state<Record<string, unknown>>({})
  text = $state('')
  on = $state<Record<string, (e: Event) => void>>({})
  constructor(init: { props?: Record<string, unknown>; text?: string }) {
    this.props = { ...(init.props ?? {}) }
    this.text = init.text ?? ''
  }
  set(name: string, value: unknown): this { this.props = { ...this.props, [name]: value }; return this }
  get(name: string): unknown { return this.props[name] }
  setText(value: string): this { this.text = value; return this }
  setLabel(value: string): this { this.text = value; return this }
  onEvent(name: string, fn: (e: Event) => void): this { this.on = { ...this.on, [name]: fn }; return this }
  onClick(fn: (e: Event) => void): this { return this.onEvent('click', fn) }
  fire(name: string, e: Event): void { this.on[name]?.(e) }
}

/** An imperative, reactive handle over a data-bound block (chart, KPI, gauge,
 *  pivot, ...). By default it mirrors the screen's dataset; \`setData(rows)\` pins
 *  an override so page code can feed the block its own rows (a filtered slice, a
 *  fetch result), and \`clear()\` returns it to the screen dataset. */
export class DataHandle<T = Record<string, unknown>> {
  #override = $state<T[] | null>(null)
  #fallback: () => T[]
  constructor(fallback: () => T[]) { this.#fallback = fallback }
  /** The rows the block renders: the override if set, else the screen dataset. */
  get rows(): T[] { return this.#override ?? this.#fallback() }
  /** Feed this block its own rows (overrides the screen dataset until cleared). */
  setData(rows: T[]): void { this.#override = rows }
  /** Drop the override; the block follows the screen dataset again. */
  clear(): void { this.#override = null }
}

/** A DataHandle whose fallback is the screen dataset getter. */
export function dataHandle<T>(fallback: () => T[]): DataHandle<T> { return new DataHandle<T>(fallback) }

/** A handle plus dynamic setX / onX helpers and \`el.onclick = fn\` assignment. */
export type Handle = ComponentHandle & Record<string, any>

export function handle(init: { props?: Record<string, unknown>; text?: string }): Handle {
  const h = new ComponentHandle(init)
  return new Proxy(h, {
    get(t, k) {
      if (Reflect.has(t, k)) { const v = (t as unknown as Record<string, unknown>)[k as string]; return typeof v === 'function' ? v.bind(t) : v }
      if (typeof k === 'string' && /^set[A-Z]/.test(k)) { const p = k[3]!.toLowerCase() + k.slice(4); return (v: unknown) => t.set(p, v) }
      if (typeof k === 'string' && /^on[A-Z]/.test(k)) { const e = k[2]!.toLowerCase() + k.slice(3); return (fn: (ev: Event) => void) => t.onEvent(e, fn) }
      return typeof k === 'string' ? t.props[k] : undefined
    },
    set(t, k, v) {
      if (typeof k === 'string' && /^on[a-z]/.test(k)) { t.onEvent(k.slice(2), v as (e: Event) => void); return true }
      if (k === 'text') { t.text = v as string; return true }              // content, not a prop
      if (typeof k === 'string') t.set(k, v)                                 // checkbox1.checked = true
      return true
    },
  }) as Handle
}
`,
  }
}

/** Pascal-case a component key for its generated handle type name (button -> Button). */
function pascalKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]+/g, ' ').split(' ').filter(Boolean).map((w) => w[0]!.toUpperCase() + w.slice(1)).join('') || 'Ui'
}
/** The TS type name for a component's typed handle (e.g. `ButtonHandle`). */
function componentHandleTypeName(componentKey: string): string {
  return `${pascalKey(componentKey)}Handle`
}
/** A typed handle alias for one UI component: `Handle` intersected with its real
 *  setters (setVariant('primary' | ...), setDisabled(boolean), ...) plus setText /
 *  onclick, so `ctx.button1.setVariant(...)` autocompletes and type-checks instead
 *  of falling through to the untyped proxy. */
/** The TS type of a component prop (for its handle property + setter signature). */
function uiPropTsType(p: { type: string; options?: string[] }): string {
  return p.type === 'boolean' ? 'boolean'
    : p.type === 'number' ? 'number'
    : p.type === 'select' && p.options?.length ? p.options.map((o) => JSON.stringify(o)).join(' | ')
    : 'string'
}
function componentHandleTypeDecl(componentKey: string): string | null {
  const spec = uiComponentSpec(componentKey)
  if (!spec) return null
  const members: string[] = []
  for (const p of spec.props) {
    const t = uiPropTsType(p)
    const setter = `set${p.key[0]!.toUpperCase()}${p.key.slice(1)}`
    // Each prop is exposed BOTH as a read/write property (checkbox1.checked = true)
    // and as a fluent setter method (checkbox1.setChecked(true)).
    members.push(`  ${p.key}: ${t}`)
    members.push(`  ${setter}(value: ${t}): void`)
  }
  if (spec.hasContent) {
    members.push('  text: string')
    members.push('  setText(value: string): void')
    members.push('  setLabel(value: string): void')
  }
  members.push('  onclick: (e: Event) => void')
  members.push('  onClick(fn: (e: Event) => void): void')
  return `type ${componentHandleTypeName(componentKey)} = Handle & {\n${members.join('\n')}\n}`
}

/** The shared code-behind wiring for a screen: the handle declarations for the
 *  page `<script>`, and the `ctx` literal passed to onLoad/onDestroy. Both page
 *  emitters (entity + freestanding) build their ctx here so the runtime object and
 *  the PageContext type never drift. `rowType` is the entity's row type (entity
 *  screens) or `RowData` (freestanding); `datasetRowsVar` is the state var backing
 *  a settable `ctx.data`. */
function codeWiring(screen: Screen, rowType: string, datasetRowsVar: string | undefined): { decls: string[]; ctxLiteral: string; usesHandle: boolean; usesDataHandle: boolean } {
  const blockById = new Map(flattenBlocks(screen.blocks).map((b) => [b.id, b]))
  const decls: string[] = []
  const ctxParts: string[] = []
  let usesHandle = false
  let usesDataHandle = false
  for (const h of screenHandles(screen)) {
    if (h.tier === 'grid') { ctxParts.push('grid: gridApi!'); continue }
    if (h.tier === 'data') {
      usesDataHandle = true
      decls.push(`const ${h.name} = dataHandle<${rowType}>(() => allRows)`)
      ctxParts.push(h.name)
      continue
    }
    usesHandle = true
    const b = blockById.get(h.blockId)
    if (b && b.config.kind === 'component') decls.push(`const ${h.name} = handle(${handleInit(b.config)})`)
    ctxParts.push(h.name)
  }
  // Screen state variables -> reactive `$state` + a get/set proxy on ctx.state.
  for (const v of screen.state ?? []) decls.push(`let ${v.name} = $state<${stateTsType(v)}>(${stateInitExpr(v)})`)
  const dataset = screenDataset(screen)
  if (dataset === 'settable' && datasetRowsVar) ctxParts.push(`data: { get rows() { return ${datasetRowsVar} }, setRows: (r) => (${datasetRowsVar} = r) }`)
  else if (dataset === 'reload') ctxParts.push('data: { get rows() { return view.rows }, reload: () => controller.refresh(), create: (v) => controller.createRow(v), update: (id, v) => controller.updateRow(id, v), delete: (id) => controller.deleteRow(id) }')
  ctxParts.push('goto')
  ctxParts.push('params: Object.fromEntries($page.url.searchParams)')
  if (screen.state?.length) ctxParts.push(`state: { ${screen.state.map((v) => `get ${v.name}() { return ${v.name} }, set ${v.name}(x) { ${v.name} = x }`).join(', ')} }`)
  return { decls, ctxLiteral: `{ ${ctxParts.join(', ')} }`, usesHandle, usesDataHandle }
}

/** Per-screen, regenerated PageContext type: the tiered handles (grid api / data
 *  handles / typed component handles) + the data/goto/params batteries. Kept OUT
 *  of the user-owned handlers.ts so its types stay fresh as the screen changes. */
function screenContextFile(screen: Screen, rowType: string): GeneratedFile {
  const handles = screenHandles(screen)
  const hasGrid = handles.some((h) => h.tier === 'grid')
  const hasData = handles.some((h) => h.tier === 'data')
  const componentKeys = [...new Set(handles.filter((h) => h.tier === 'component').map((h) => h.component!))]
  const dataset = screenDataset(screen)
  const isEntity = screen.entity !== undefined

  const members: string[] = []
  for (const h of handles) {
    if (h.tier === 'grid') members.push(`  /** The Grid on this page - its full, real SvGridApi. */\n  grid: SvGridApi<any, ${rowType}>`)
    else if (h.tier === 'data') members.push(`  /** The ${h.kind} - feed it rows with ${h.name}.setData(rows); ${h.name}.rows reads them. */\n  ${h.name}: DataHandle<${rowType}>`)
    else members.push(`  ${h.name}: ${componentHandleTypeName(h.component!)}`)
  }
  if (dataset === 'settable') members.push(`  /** This page owns its dataset - replace it with data.setRows(rows). */\n  data: { rows: readonly ${rowType}[]; setRows: (rows: ${rowType}[]) => void }`)
  else if (dataset === 'reload') members.push(`  /** The grid's current page of rows + refresh / create / update / delete. */\n  data: { rows: readonly ${rowType}[]; reload: () => void; create: (values: Partial<${rowType}>) => Promise<${rowType}>; update: (id: string, values: Partial<${rowType}>) => Promise<${rowType}>; delete: (id: string) => Promise<void> }`)
  members.push('  /** Navigate to another route. */\n  goto: (path: string) => void')
  members.push("  /** The page's URL query params. */\n  params: Record<string, string>")
  if (screen.state?.length) members.push(`  /** This screen's reactive state variables. */\n  state: { ${screen.state.map((v) => `${v.name}: ${stateTsType(v)}`).join('; ')} }`)

  const usesRowType = hasGrid || hasData || dataset !== 'none'
  const handleTypes = [hasData ? 'DataHandle' : '', componentKeys.length ? 'Handle' : ''].filter(Boolean)
  const imports = [
    handleTypes.length ? `import type { ${handleTypes.join(', ')} } from '$lib/handles.svelte'` : '',
    hasGrid ? `import type { SvGridApi } from '@svgrid/grid'` : '',
    usesRowType && isEntity ? `import type { ${rowType} } from '$lib/schemas'` : '',
    usesRowType && !isEntity ? `import type { RowData } from '@svgrid/grid'` : '',
  ].filter(Boolean).join('\n')
  const typeDecls = componentKeys.map(componentHandleTypeDecl).filter(Boolean).join('\n\n')

  return {
    path: `src/routes/${screen.route}/page-context.ts`,
    description: `Typed page context for "${screen.title}" (regenerated).`,
    contents: `// Regenerated by SvGrid Studio. Edits here are overwritten - write code in handlers.ts.
${imports}${imports ? '\n\n' : ''}${typeDecls ? typeDecls + '\n\n' : ''}/** What onLoad(ctx) / onDestroy(ctx) give you: the Grid's real API, each block as a
 *  handle, the screen dataset, and goto / params. */
export type PageContext = {
${members.join('\n')}
}
`,
  }
}

/** Compile a screen's visual methods (handlerSteps) into onLoad / onDestroy bodies.
 *  A component's click steps become `ctx.<name>.onclick = async () => { ... }` inside
 *  onLoad. Returns undefined per slot when there are no steps for it. */
function compiledMethodBodies(screen: Screen): { onLoadSteps?: string; clicks?: string; onDestroy?: string } {
  const steps = screen.handlerSteps
  if (!steps || !Object.keys(steps).length) return {}
  const names = handleNameMap(screen)
  const clicks: string[] = []
  for (const b of flattenBlocks(screen.blocks)) {
    if (b.config.kind !== 'component') continue
    const clickSteps = steps[clickSlot(b.id)]
    if (!clickSteps?.length) continue
    const name = names.get(b.id)
    if (!name) continue
    clicks.push(`ctx.${name}.onclick = async () => {\n${indentBody(compileHandlerSteps(clickSteps))}\n}`)
  }
  // Component value-change wiring (`ctx.<name>.onchange = ...`), same shape as clicks.
  for (const b of flattenBlocks(screen.blocks)) {
    if (b.config.kind !== 'component') continue
    const changeSteps = steps[changeSlot(b.id)]
    if (!changeSteps?.length) continue
    const name = names.get(b.id)
    if (!name) continue
    clicks.push(`ctx.${name}.onchange = async () => {\n${indentBody(compileHandlerSteps(changeSteps))}\n}`)
  }
  return {
    // Legacy visual onLoad steps (the code view now edits onLoad directly).
    onLoadSteps: steps[ON_LOAD]?.length ? compileHandlerSteps(steps[ON_LOAD]) : undefined,
    // Component on-click wiring - MERGED with any hand-written onLoad body, never replacing it.
    clicks: clicks.length ? clicks.join('\n\n') : undefined,
    onDestroy: steps[ON_DESTROY]?.length ? compileHandlerSteps(steps[ON_DESTROY]) : undefined,
  }
}

/** The user-owned `handlers.ts` companion for a screen: design in Studio, write
 *  behavior here. Scaffolded once (userOwned) and never regenerated - the page
 *  imports it, never rewrites it. See HANDLERS-DESIGN.md. */
function screenHandlersFile(screen: Screen): GeneratedFile {
  const header = `// Your code for the "${screen.title}" screen.
// SvGrid Studio scaffolds this file once and never overwrites it - it's yours.
// Design the screen visually in Studio; write its behavior here.
${screenElementsManifest(screen)}`

  let body: string
  if (screen.handlersSource) {
    // Advanced escape hatch: the whole file, verbatim from the designer.
    body = `${screen.handlersSource}\n`
  } else {
    // The two lifecycle slots: onLoad on mount, onDestroy on unmount. Each function
    // shell is generated; its body is the block the developer edits (per slot).
    // Visual "methods" (handlerSteps) COMPILE to the same body and win when present:
    // onLoad = its own steps + `ctx.<name>.onclick = ...` for each component's click steps.
    const compiled = compiledMethodBodies(screen)
    // onLoad = the hand-written body (or legacy visual steps) THEN the component onclick wiring.
    const loadPieces = [compiled.onLoadSteps ?? screen.handlerBodies?.[ON_LOAD]?.trim(), compiled.clicks].filter(Boolean)
    const loadRaw = loadPieces.length ? loadPieces.join('\n\n') : undefined
    const loadInner = loadRaw ? indentBody(loadRaw) : '  // Runs when the page mounts. Reach blocks via ctx.<name>, feed data via ctx.data / ctx.<chart>.setData(rows).'
    const destroyRaw = compiled.onDestroy ?? screen.handlerBodies?.[ON_DESTROY]?.trim()
    const destroyInner = destroyRaw ? indentBody(destroyRaw) : '  // Runs when the page unmounts. Clean up timers, subscriptions, aborts.'
    body = `import type { PageContext } from './page-context'

/** Runs when the page mounts. Reach blocks (ctx.grid.exportCsv(), ctx.chart1.setData(rows),
 *  ctx.button1.onclick = () => {}), fetch data, navigate with ctx.goto. */
export async function ${ON_LOAD}(ctx: PageContext): Promise<void> {
${loadInner}
}

/** Runs when the page unmounts. Clean up anything onLoad started. */
export function ${ON_DESTROY}(ctx: PageContext): void {
${destroyInner}
}
`
  }
  return {
    path: `src/routes/${screen.route}/handlers.ts`,
    description: `Your code for the "${screen.title}" screen - scaffolded once, never regenerated.`,
    userOwned: true,
    contents: header + body,
  }
}

function freestandingScreenPage(screen: Screen, accessEnabled: boolean, i18nEnabled: boolean): GeneratedFile {
  const screenActions = screenActionsOf(screen)
  const gatesActions = accessEnabled && screenActions.length > 0
  const parts = screenActions.map((a) => actionHandlerScript(a))
  const accessImport = gatesActions ? `import { currentRole, canScreen } from '$lib/access'\n  ` : ''
  const i18nImport = i18nEnabled ? `import { t } from '$lib/i18n'\n  ` : ''
  const title = i18nEnabled ? `{$t('screen.${screen.id}', ${JSON.stringify(screen.title)})}` : screen.title
  const actionButtons = screenActions.map((a) => actionToolbarButton(a, screen.id, gatesActions)).join('\n  ')
  const toolbar = screenActions.length > 0 ? `<div class="st__toolbar">\n  ${actionButtons}\n</div>\n\n` : ''

  const componentImports = [...new Set(
    screen.blocks
      .filter((b): b is Block & { config: ComponentConfig } => b.config.kind === 'component')
      .map((b) => uiComponentSpec(b.config.component)?.importName)
      .filter((n): n is string => !!n),
  )].sort()
  // Code companion: onLoad(ctx)/onDestroy(ctx) run on mount/unmount with a page
  // context. Each component becomes a named typed handle (button1.setVariant(...),
  // button1.onclick = fn); the Grid renders only when renderGrid is on, filled via
  // ctx.data.setRows. All ctx wiring is built by codeWiring (shared with entity screens).
  const hasCode = screenHasCode(screen)
  const grid = screen.renderGrid === true
  const handleNames = handleNameMap(screen)
  const wiring = hasCode ? codeWiring(screen, 'RowData', grid ? 'rows' : undefined) : null
  const gridNames = [...new Set([...componentImports, ...(grid ? ['SvGrid', 'tableFeatures', 'rowSortingFeature', 'columnFilteringFeature', 'rowSelectionFeature'] : [])])].sort()
  const gridImport = gridNames.length ? `import { ${gridNames.join(', ')} } from '@svgrid/grid'\n  ` : ''
  const gridTypes = [grid ? 'RowData' : '', grid ? 'SvGridApi' : ''].filter(Boolean)
  const typeImport = hasCode && gridTypes.length ? `import type { ${gridTypes.join(', ')} } from '@svgrid/grid'\n  ` : ''
  const handleSpecs = [wiring?.usesHandle ? 'handle' : '', wiring?.usesDataHandle ? 'dataHandle' : ''].filter(Boolean)
  const handleImport = handleSpecs.length ? `import { ${handleSpecs.join(', ')} } from '$lib/handles.svelte'\n  ` : ''

  const codeImport = hasCode ? `import { onMount } from 'svelte'\n  import * as handlers from './handlers'\n  import type { PageContext } from './page-context'\n  ` : ''
  const gotoImport = hasCode ? `import { goto } from '$app/navigation'\n  ` : ''
  const pageStoreImport = hasCode ? `import { page } from '$app/stores'\n  ` : ''
  const handleDecls = (wiring?.decls ?? []).join('\n  ')
  // The Grid exposes its real SvGridApi (onApiReady) so code gets the full, typed
  // grid API - ctx.grid.exportCsv(), selectCells(), startEditing(), ... - not a stub.
  const gridScript = grid
    ? `\n  let rows = $state<RowData[]>([])\n  let gridApi = $state<SvGridApi<any, any> | null>(null)\n  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature, rowSelectionFeature })\n  const columns = $derived(rows.length ? Object.keys(rows[0]).map((field) => ({ field, header: field })) : [])`
    : ''
  const codeScript = hasCode
    ? `\n  ${handleDecls ? handleDecls + '\n  ' : ''}${gridScript ? gridScript.trimStart() + '\n  ' : ''}onMount(() => {
    // ctx is internal plumbing wired from this screen's blocks; the typed surface your
    // code uses lives in handlers.ts (PageContext). Component handles are runtime proxies,
    // so the cast bridges their dynamic shape to the typed context.
    const ctx = ${wiring!.ctxLiteral} as unknown as PageContext
    handlers.${ON_LOAD}(ctx)
    return () => handlers.${ON_DESTROY}(ctx)
  })`
    : ''
  const gridMarkup = grid ? `  <SvGrid data={rows} columns={columns} features={features} onApiReady={(a) => (gridApi = a)} showRowNumbers />` : ''

  const blockContent = screen.blocks.length
    ? screen.blocks.map((b) => (b.config.kind === 'component' ? componentBlockMarkup(b, b.config, hasCode ? handleNames.get(b.id) : undefined) : '')).filter(Boolean).join('\n')
    : ''
  const content = [blockContent, gridMarkup].filter(Boolean).join('\n')
    || '  <!-- Freestanding page - no entity bound. Add your own content here. -->'

  return {
    path: `src/routes/${screen.route}/+page.svelte`,
    description: `${screen.title} screen (freestanding, no bound entity).`,
    contents: `<script lang="ts">
  ${gridImport}${typeImport}${handleImport}${codeImport}${gotoImport}${pageStoreImport}${accessImport}${i18nImport}${parts.join('\n\n  ')}${codeScript}
</script>

<h1 class="st__title">${title}</h1>
${toolbar}<div class="st-screen${screenClassSuffix(screen)}">
${content}
</div>
`,
  }
}

/** A self-contained screen page composing the screen's blocks. When `accessEnabled`
 *  the page gates create / update affordances by the current role (server still
 *  enforces via the route's `authorize`). */
function screenPage(schema: EntitySchema, rawSchema: EntitySchema, screen: Screen, resolve: (name: string) => EntitySchema | undefined, rawResolve: (name: string) => EntitySchema | undefined, accessEnabled = false, i18nEnabled = false, routeById: Map<string, string> = new Map(), drillEnabled = false): GeneratedFile {
  const n = namesFor(schema)
  const label = schema.label ?? n.label
  const blocks = screen.blocks
  // Display blocks (chart/kpi/gauge/pivot/tree/dashboard) can be nested inside Tabs;
  // flatten so their imports + data loading are detected. Controller-bound kinds
  // (grid/form/filter/record) only live at the top level.
  const allBlocks = flattenBlocks(blocks)
  // Screen layout: the 12-col grid (default), a single-column stack, or a pane
  // workspace (SvDockManager) - `split` renders it locked (resize-only), `dock`
  // gives the full floatable/pinnable manager.
  const isSplit = screenLayoutOf(screen) === 'split'
  const isDock = isPaneLayout(screenLayoutOf(screen))
  const isCanvas = screenLayoutOf(screen) === 'canvas'
  const dockState = isDock ? (reconcileDock(screen).dock ?? null) : null
  // Pane-layout settings -> SvDockManager props + whether to persist the arrangement.
  const splitO = isSplit ? splitOpts(screen) : null
  const dockO = isDock && !isSplit ? dockOpts(screen) : null
  const panePersist = isSplit ? splitO!.persist : dockO ? dockO.persist : true
  const paneAttrs: string[] = []
  if (isSplit) { paneAttrs.push('locked'); if (splitO!.minPaneSize !== 80) paneAttrs.push(`minSize={${splitO!.minPaneSize}}`) }
  else if (dockO) {
    if (dockO.allowPopout) paneAttrs.push('allowPopout')
    if (dockO.hideSingleTab) paneAttrs.push('hideSingleTab')
    if (dockO.headerPosition !== 'top') paneAttrs.push(`headerPosition="${dockO.headerPosition}"`)
  }
  const paneAttrStr = paneAttrs.length ? ' ' + paneAttrs.join(' ') : ''
  const hasGrid = has(blocks, 'grid')
  // Code-behind: wire onLoad(ctx) and expose the grid's real api as ctx.grid.
  const codeEnabled = screenHasCode(screen)
  const codeGrid = codeEnabled && hasGrid
  const codeGridBlockId = firstGridBlockId(screen)
  // Every block becomes a named ctx handle; codeWiring builds the decls + the ctx
  // literal shared with the PageContext type. Data handles read the entity row type.
  const handleNames = handleNameMap(screen)
  const codeWire = codeEnabled ? codeWiring(screen, n.type, undefined) : null
  const hasForm = has(blocks, 'form') // legacy standalone form block
  // Editing is a Grid property: a grid with editing 'form' opens the edit panel.
  const gridConfigs = blocks.map((b) => b.config).filter((c): c is GridConfig => c.kind === 'grid')
  const formGrid = gridConfigs.find((c) => c.editing === 'form')
  // An "Edit" row-action needs the edit modal + state even on a non-form grid.
  const hasEditAction = gridConfigs.some((c) => c.rowActions?.some((a) => a.kind === 'edit'))
  const hasRowActions = gridConfigs.some((c) => (c.rowActions?.length ?? 0) > 0)
  // Rich cell renderers (badge / progress / link) each emit a `cell` snippet.
  const cellRenderKinds = new Set(gridConfigs.flatMap((c) => c.columns.filter((col) => col.show && col.cellType).map((col) => col.cellType!.kind)))
  const hasCellRenderers = cellRenderKinds.size > 0
  const wantsForm = !!formGrid || hasForm || hasEditAction
  // An unpaginated grid loads everything (one big page); else its configured size.
  const gridPageSize = gridConfigs[0] ? (gridConfigs[0].paginated !== false ? gridConfigs[0].pageSize : 1000) : 10
  const formPres = formGrid?.formPresentation ?? 'modal'
  const hasPivot = has(allBlocks, 'pivot')
  const hasFilter = has(blocks, 'filter')
  const hasRecord = has(blocks, 'record')
  const recordEditable = blocks.some((b) => b.config.kind === 'record' && b.config.editable)
  // Filter panels drive the grid's controller; record panels read the grid's
  // selection - both need the controller even if the grid isn't editable.
  const needsController = hasGrid || wantsForm || hasFilter || hasRecord
  const hasAgg = has(allBlocks, 'chart') || has(allBlocks, 'dashboard') || has(allBlocks, 'kpi') || has(allBlocks, 'gauge') || has(allBlocks, 'tree')
  const relationFields = schema.fields.filter((f) => f.type === 'relation' && f.relation)

  // Distinct, resolvable child entities referenced by master-detail blocks, and by
  // a detail page's related child collections (both load the child table into a
  // `md_<name>_rows` state var + filter it by the foreign key at render time).
  const mdChildren = new Map<string, EntitySchema>()
  for (const b of blocks) {
    if (b.config.kind === 'master-detail' && b.config.childEntity && b.config.foreignKey) {
      const c = resolve(b.config.childEntity)
      if (c) mdChildren.set(c.name, c)
    }
    if (b.config.kind === 'detail') {
      for (const rel of b.config.related ?? []) {
        if (!rel.entity || !rel.foreignKey) continue
        const c = resolve(rel.entity)
        if (c) mdChildren.set(c.name, c)
      }
    }
  }
  const childList = [...mdChildren.values()]
  const hasMD = childList.length > 0
  // Components with a data binding (aggregate / field) read the whole table too.
  const boundComponents = allBlocks.filter((b): b is Block & { config: ComponentConfig } => b.config.kind === 'component' && componentHasBindings(b.config))
  const hasBoundComponent = boundComponents.length > 0
  const hasAggregateBinding = boundComponents.some((b) => Object.values(b.config.bindings ?? {}).some((bd) => bd.kind === 'aggregate'))
  // A grouped grid loads every row so groups/aggregates span the whole dataset.
  const hasGroupedGrid = allBlocks.some((b) => b.config.kind === 'grid' && (b.config.grouping?.length ?? 0) > 0)
  // A tree grid loads every row to build the hierarchy, and renders a tree cell (renderSnippet).
  const hasTreeGrid = allBlocks.some((b) => b.config.kind === 'grid' && gridHasTree(b.config))
  // A scheduler-view grid renders its rows as a calendar (full dataset, enterprise renderer).
  const hasSchedulerGrid = allBlocks.some((b) => b.config.kind === 'grid' && !!b.config.scheduler)
  // The scheduler renderer is also what the (upgraded) calendar block uses.
  const usesScheduler = hasSchedulerGrid || has(allBlocks, 'calendar')
  // An export toolbar needs the grid's captured API. The code-behind grid already
  // captures into `gridApi`; other export grids capture into `gridApi_<blockId>`.
  const apiVarFor = (b: Block): string | undefined =>
    codeGrid && b.id === codeGridBlockId ? 'gridApi'
    : b.config.kind === 'grid' && gridHasExport(b.config) ? `gridApi_${b.id.replace(/-/g, '_')}`
    : undefined
  const exportApiVars = blocks.filter((b) => b.config.kind === 'grid' && gridHasExport(b.config) && !(codeGrid && b.id === codeGridBlockId)).map((b) => `gridApi_${b.id.replace(/-/g, '_')}`)
  const needsGridApiType = codeGrid || exportApiVars.length > 0
  // The pivot reads the whole table (like charts / dashboards).
  const needsAllRows = hasAgg || hasMD || hasPivot || hasBoundComponent || hasGroupedGrid || hasTreeGrid || hasSchedulerGrid || has(allBlocks, 'board') || has(allBlocks, 'calendar') || has(allBlocks, 'detail')

  // --- imports ---
  const gridSpecs: string[] = []
  if (needsController) gridSpecs.push('SvGrid', 'createServerDataSource', ...(hasRowActions || hasCellRenderers || hasTreeGrid ? ['renderSnippet', 'type CellContext'] : []), 'type ServerState')
  // A calendar-only screen has no controller but still renders <SvGrid scheduler={...}>.
  if (usesScheduler) gridSpecs.push('SvGrid')
  // Dock layout: the workspace shell + its serializable state type.
  if (isDock) gridSpecs.push('SvDockManager', 'type DockManagerState')
  if (cellRenderKinds.has('badge')) gridSpecs.push('SvBadge')
  if (cellRenderKinds.has('progress')) gridSpecs.push('SvProgress')
  if (has(allBlocks, 'gauge')) gridSpecs.push('SvGauge')
  if (has(allBlocks, 'tree')) gridSpecs.push('SvTree')
  if (has(blocks, 'tabs')) gridSpecs.push('SvTabs')
  if (has(blocks, 'accordion')) gridSpecs.push('SvAccordion')
  for (const b of allBlocks) {
    if (b.config.kind !== 'component') continue
    const importName = uiComponentSpec(b.config.component)?.importName
    if (importName) gridSpecs.push(importName)
  }
  if (needsGridApiType) gridSpecs.push('type SvGridApi')
  const gridImports = gridSpecs.length ? `import { ${[...new Set(gridSpecs)].join(', ')} } from '@svgrid/grid'\n  ` : ''
  const entImports: string[] = []
  if (hasGrid) entImports.push('schemaToColumns')
  if (wantsForm || (hasRecord && recordEditable)) entImports.push('SvGridEditPanel')
  if (has(allBlocks, 'chart')) entImports.push('SvSchemaChart')
  if (has(allBlocks, 'dashboard')) entImports.push('SvSchemaDashboard')
  if (has(allBlocks, 'board')) entImports.push('SvBoard')
  // The calendar block now renders via the scheduler grid view (needs schemaToColumns for its columns).
  if (has(allBlocks, 'calendar')) entImports.push('schemaToColumns')
  if (has(allBlocks, 'detail')) entImports.push('SvRecordDetail')
  if (has(allBlocks, 'kpi') || has(allBlocks, 'gauge') || hasAggregateBinding) entImports.push('reduceValue')
  const kpiCfgs = allBlocks.filter((b) => b.config.kind === 'kpi').map((b) => b.config as KpiConfig)
  if (kpiCfgs.some((c) => c.format && c.format !== 'auto')) entImports.push('formatKpiValue')
  if (kpiCfgs.some((c) => c.trendField)) entImports.push('kpiSeries', 'sparklinePoints', 'seriesDelta')
  if (hasMD) entImports.push('SvGridMasterDetail')
  if (hasPivot) entImports.push('SvPivotDesigner')
  // The scheduler renderer (grid scheduler-view + calendar block) is registered app-wide (idempotent).
  if (usesScheduler) entImports.push('enableSchedulerView')
  // Dedupe: record + form both want SvGridEditPanel.
  const entImport = entImports.length ? `import { ${[...new Set(entImports)].join(', ')} } from '@svgrid/enterprise'\n  ` : ''
  const lookupVars = relationFields.map((f) => lookupVar(schema, f.field))
  const childSchemaVars = childList.map((c) => namesFor(c).schemaVar)
  const childTypes = childList.map((c) => namesFor(c).type)
  const childSourceVars = childList.map((c) => namesFor(c).sourceVar)
  // Dedupe against the parent's own names so a self-referential master-detail
  // (childEntity === this entity) doesn't emit a duplicate import specifier.
  const schemaVarImports = [...new Set([n.schemaVar, ...childSchemaVars])]
  const typeImports = [...new Set([n.type, ...childTypes])]
  const dataImports = [...new Set([n.sourceVar, ...childSourceVars, ...(wantsForm ? [...lookupVars, 'nextId'] : [])])].filter(Boolean)

  // Drill-through: this screen navigates out (goto) and/or is a drill target that
  // reads URL query params matching its fields into an initial filter.
  const usesGoto = blocks.some((b) =>
    (b.config.kind === 'grid' && b.config.rowLink && routeById.has(b.config.rowLink.screen)) ||
    (b.config.kind === 'grid' && b.config.rowActions?.some((a) => a.kind === 'navigate' && a.screen && routeById.has(a.screen))) ||
    (b.config.kind === 'chart' && b.config.drillScreen && routeById.has(b.config.drillScreen)) ||
    ((b.config.kind === 'board' || b.config.kind === 'calendar') && b.config.openScreen != null && routeById.has(b.config.openScreen)) ||
    (b.config.kind === 'master-detail' && b.config.linkScreen != null && routeById.has(b.config.linkScreen)))
  const applyUrlFilters = drillEnabled && needsController
  const filterableFieldNames = schema.fields.filter((f) => !f.primaryKey).map((f) => f.field)
  // RBAC gates the UI only where there's a create/update affordance to gate.
  const gatesUi = accessEnabled && (wantsForm || gridConfigs.some((c) => c.editing === 'inline') || hasRowActions)
  const screenActions = screenActionsOf(screen)
  const gatesActions = accessEnabled && screenActions.length > 0

  // --- script body ---
  const parts: string[] = []
  // Register the enterprise scheduler renderer once (idempotent) before any grid renders.
  if (usesScheduler) parts.push('enableSchedulerView()')
  if (codeGrid) parts.push('let gridApi = $state<SvGridApi<any, any> | null>(null)')
  for (const v of exportApiVars) parts.push(`let ${v} = $state<SvGridApi<any, any> | null>(null)`)
  for (const a of screenActions) parts.push(actionHandlerScript(a))
  if (needsController) {
    const urlFilter = applyUrlFilters
      ? `\n    const sp = $page.url.searchParams
    const _cols: Record<string, { operator: 'equals'; value: string }> = {}
    for (const _f of [${filterableFieldNames.map(jsStr).join(', ')}]) { const _v = sp.get(_f); if (_v != null) _cols[_f] = { operator: 'equals', value: _v } }
    if (Object.keys(_cols).length) controller.setFilter({ columns: _cols })`
      : ''
    parts.push(`const idField = ${n.schemaVar}.idField ?? 'id'
  let view = $state<ServerState<${n.type}>>({ rows: [], total: 0, loading: false, saving: false, error: null, pageIndex: 0, pageSize: ${gridPageSize}, pageCount: 1, sortModel: [], filterModel: {} })
  const controller = createServerDataSource<${n.type}>(${n.sourceVar}, { pageSize: ${gridPageSize}, optimistic: true, getRowId: (r) => String((r as Record<string, unknown>)[idField]), onChange: (s) => (view = s) })
  $effect(() => {${urlFilter}
    controller.refresh(); return () => controller.dispose() })`)
  }
  const actionSnippets: string[] = []
  // Tree-grid scripts reference `allRows`; collected here, appended AFTER its declaration.
  const treeScripts: string[] = []
  // A shared badge-intent helper is emitted once if any column uses the badge renderer.
  if (blocks.some((b) => b.config.kind === 'grid' && b.config.columns.some((c) => c.show && c.cellType?.kind === 'badge'))) {
    parts.push(BADGE_VARIANT_HELPER)
  }
  for (const b of blocks) {
    if (b.config.kind === 'grid') {
      const idSafe = b.id.replace(/-/g, '_')
      const colExpr = gridColumnsExpr(n.schemaVar, b, n.type)
      let colValue = i18nEnabled ? `localizeCols(${colExpr}, ${JSON.stringify(schema.name)}, $t)` : colExpr
      // An "edit" action needs the form; drop it if this grid has no edit modal.
      const actions = (b.config.rowActions ?? []).filter((a) => a.kind !== 'edit' || wantsForm)
      if (actions.length) {
        // A synthetic action column (id, no field, cell renderer) - type-clean.
        colValue = `[...(${colValue}), { id: '__actions', header: 'Actions', sortable: false, cell: (ctx: CellContext<${n.type}>) => renderSnippet(rowActions_${idSafe}, { row: ctx.row.original }) }]`
        actionSnippets.push(rowActionsSnippet(idSafe, n.type, schema, actions, routeById, gatesUi, screen.id))
      }
      // Rich cell renderers: one `{#snippet}` per configured column.
      for (const c of b.config.columns) {
        if (c.show && c.cellType) actionSnippets.push(cellRendererSnippet(idSafe, c.field, c.cellType))
      }
      // Tree-data grid: an indented expand/collapse cell on the label column.
      if (gridHasTree(b.config)) {
        treeScripts.push(treeGridScript(idSafe, n.type, b.config))
        actionSnippets.push(treeCellSnippet(idSafe, n.type))
      }
      const reactive = i18nEnabled || actions.length > 0
      parts.push(`const columns_${idSafe} = ${reactive ? `$derived(${colValue})` : colValue}`)
    }
  }
  if (needsAllRows) {
    parts.push(`let allRows = $state<${n.type}[]>([])
  let allRowsReady = $state(false)
  async function loadAll() { allRows = [...(await ${n.sourceVar}.getRows({ startRow: 0, endRow: 1000, pageIndex: 0, pageSize: 1000, sortModel: [], filterModel: {} })).rows]; allRowsReady = true }
  loadAll()`)
  }
  // Tree-grid state/derivations - emitted after `allRows` so it's in scope.
  for (const s of treeScripts) parts.push(s)
  // Docking workspace: the serializable layout state, restored from localStorage on the
  // client (after mount, so SSR stays stable) and re-persisted whenever the user rearranges.
  // Below a breakpoint the screen falls back to a single stacked column.
  if (isDock) {
    const dockKey = jsStr('dock:' + screen.route)
    // Persist the arrangement to localStorage (restored after mount so SSR stays
    // stable), unless the screen opts out - then the seeded layout is fixed.
    const persistParts = panePersist
      ? `
  function loadDock(): DockManagerState | null { try { const r = localStorage.getItem(${dockKey}); return r ? (JSON.parse(r) as DockManagerState) : null } catch { return null } }
  function saveDock(ws: DockManagerState) { try { localStorage.setItem(${dockKey}, JSON.stringify(ws)) } catch { /* storage unavailable */ } }
  $effect(() => { const saved = loadDock(); if (saved) dockWorkspace = saved })`
      : ''
    parts.push(`let dockWorkspace = $state<DockManagerState>(${JSON.stringify(dockState ?? { main: null, floating: [], autoHide: [] })})
  let dockNarrow = $state(false)${persistParts}
  $effect(() => { const mq = window.matchMedia('(max-width: 720px)'); const sync = () => (dockNarrow = mq.matches); sync(); mq.addEventListener('change', sync); return () => mq.removeEventListener('change', sync) })`)
  }
  for (const c of childList) {
    const cn = namesFor(c)
    const v = mdChildVar(c.name)
    parts.push(`let ${v} = $state<${cn.type}[]>([])
  async function load_${v}() { ${v} = [...(await ${cn.sourceVar}.getRows({ startRow: 0, endRow: 1000, pageIndex: 0, pageSize: 1000, sortModel: [], filterModel: {} })).rows] }
  load_${v}()`)
  }
  // "On record saved" (formSubmit) steps run at the end of a save, with the
  // submitted `values` as `row` and a local ctx (state / data / goto).
  const submitSteps = screen.handlerSteps?.[FORM_SUBMIT]
  const submitBody = submitSteps?.length && codeWire
    ? `\n    const row = values\n    const ctx = ${codeWire.ctxLiteral} as unknown as PageContext\n${compileHandlerSteps(submitSteps).split('\n').map((l) => (l ? '    ' + l : l)).join('\n')}`
    : ''
  if (wantsForm) {
    const lookupsProp = relationFields.length
      ? `\n  const lookups = { ${relationFields.map((f, i) => `${f.field}: ${lookupVars[i]}`).join(', ')} }`
      : ''
    parts.push(`let editing = $state<${n.type} | null | undefined>(undefined)${lookupsProp}
  async function save({ mode, id, values }: { mode: 'create' | 'edit'; id: string | null; values: Partial<${n.type}> }) {
    if (mode === 'create') { await controller.createRow({ [idField]: nextId('${n.idPrefix}'), ...values } as Partial<${n.type}>); controller.setPage(view.pageCount - 1) }
    else if (id) { await controller.updateRow(id, values) }${submitBody}
    editing = undefined${needsAllRows ? '\n    await loadAll()' : ''}
  }`)
  }
  // Record panel: the row selected in the grid, plus (when editable) a save hook.
  if (hasRecord) {
    parts.push(`let selectedRecord = $state<${n.type} | null>(null)${recordEditable ? `
  async function saveRecord({ id, values }: { mode: 'create' | 'edit'; id: string | null; values: Partial<${n.type}> }) {
    if (id) { await controller.updateRow(id, values) }${submitBody}
    selectedRecord = null${needsAllRows ? '\n    await loadAll()' : ''}
  }` : ''}`)
  }
  // Filter panel(s): one facet-state object + an apply() that rebuilds the whole
  // filterModel (setFilter replaces it) and pushes it to the controller.
  for (const b of blocks) {
    if (b.config.kind !== 'filter') continue
    parts.push(filterPanelState(schema, b, b.config))
  }
  // Tabs container(s): one active-tab state var per block (first tab active).
  for (const b of blocks) {
    if (b.config.kind !== 'tabs') continue
    parts.push(`let ${tabsStateVar(b.id)} = $state('${tabId(b.id, 0)}')`)
  }
  // Accordion container(s): one expanded-ids state var per block (first section open).
  for (const b of blocks) {
    if (b.config.kind !== 'accordion') continue
    parts.push(`let ${accStateVar(b.id)} = $state<string[]>(['${accSectionId(b.id, 0)}'])`)
  }
  // Tree block: fold the flat rows into SvTree nodes by a self-referential parent.
  if (has(allBlocks, 'tree')) {
    parts.push(`type TreeNode = { id: string; label: string; children: TreeNode[] }
  function toTreeNodes(rows: Record<string, unknown>[], idField: string, labelField: string, parentField: string): TreeNode[] {
    const byId = new Map<string, TreeNode>(rows.map((r) => [String(r[idField]), { id: String(r[idField]), label: String(r[labelField] ?? r[idField]), children: [] }]))
    const roots: TreeNode[] = []
    for (const r of rows) {
      const node = byId.get(String(r[idField]))!
      const pid = r[parentField] != null && r[parentField] !== '' ? String(r[parentField]) : null
      if (pid && pid !== node.id && byId.has(pid)) byId.get(pid)!.children.push(node)
      else roots.push(node)
    }
    return roots
  }`)
  }
  // Code-behind: declare the block handles, then run onLoad on mount + onDestroy on
  // unmount with the full page context (grid api, data handles, component handles,
  // data/goto/params). Handle decls come last so they can close over allRows/view.
  if (codeWire) {
    if (codeWire.decls.length) parts.push(codeWire.decls.join('\n  '))
    parts.push(`onMount(() => {
    const ctx = ${codeWire.ctxLiteral} as unknown as PageContext
    handlers.${ON_LOAD}(ctx)
    return () => handlers.${ON_DESTROY}(ctx)
  })`)
  }

  // --- markup ---
  const newLabel = i18nEnabled ? `{$t('new.${schema.name}', ${JSON.stringify('+ New ' + label)})}` : `+ New ${label}`
  const newBtn = `<button class="st-btn st-btn--primary" onclick={() => (editing = null)}>${newLabel}</button>`
  const actionButtons = screenActions.map((a) => actionToolbarButton(a, screen.id, gatesActions)).join('\n  ')
  const toolbar = (wantsForm || screenActions.length > 0)
    ? `<div class="st__toolbar">\n  ${wantsForm ? (gatesUi ? `{#if can($currentRole, 'create')}${newBtn}{/if}` : newBtn) : ''}${actionButtons ? `\n  ${actionButtons}` : ''}\n</div>\n\n`
    : ''
  // A grid block's "On row select" method steps -> a row-scoped handler merged
  // into onRowClick (a local ctx is built inside the handler so ctx.state/data work).
  const rowSelectFor = (b: Block): string | undefined => {
    const steps = b.config.kind === 'grid' ? screen.handlerSteps?.[rowSelectSlot(b.id)] : undefined
    return steps?.length ? compileHandlerSteps(steps) : undefined
  }
  const blockCtx = (b: Block, pane: boolean) => ({ hasRecord, accessEnabled: gatesUi, routeById, i18n: i18nEnabled, rawEntity: rawSchema, rawResolve, captureApi: apiVarFor(b), handleNames: codeEnabled ? handleNames : undefined, pane, rowSelectSteps: rowSelectFor(b), ctxLiteral: codeWire?.ctxLiteral })
  const body = blocks.map((b) => blockMarkup(schema, n.schemaVar, n.type, b, resolve, blockCtx(b, false))).filter(Boolean).join('\n')
  // Dock mode: each block becomes a pane rendered by id; a narrow viewport stacks the grid body.
  const dockPanes = isDock
    ? blocks.map((b) => { const m = blockMarkup(schema, n.schemaVar, n.type, b, resolve, blockCtx(b, true)); return m ? `        {#if p.id === ${jsStr(b.id)}}\n${m}\n        {/if}` : '' }).filter(Boolean).join('\n')
    : ''
  // Canvas mode: each block is a placed cell on a 12-col grid (pane render = fill the cell).
  const canvasBody = isCanvas
    ? blocks.map((b) => {
        const r = canvasRectOf(screen, b.id)
        const m = blockMarkup(schema, n.schemaVar, n.type, b, resolve, blockCtx(b, true))
        return m ? `  <div class="st-canvas__cell" style="grid-column: ${r.col + 1} / span ${r.colSpan}; grid-row: ${r.row + 1} / span ${r.rowSpan};">\n${m}\n  </div>` : ''
      }).filter(Boolean).join('\n')
    : ''
  const screenBody = isDock
    ? `{#if dockNarrow}
<div class="st-screen${screenClassSuffix(screen)}">
${body}
</div>
{:else}
<div class="st-dock">
  <SvDockManager bind:workspace={dockWorkspace}${panePersist ? ' onChange={(w) => saveDock(w)}' : ''}${paneAttrStr}>
    {#snippet pane(p)}
${dockPanes}
    {/snippet}
  </SvDockManager>
</div>
{/if}`
    : isCanvas
    ? `<div class="st-canvas${screenClassSuffix(screen)}">
${canvasBody}
</div>`
    : `<div class="${screenLayoutOf(screen) === 'stack' ? 'st-stack' : 'st-screen'}${screenClassSuffix(screen)}">
${body}
</div>`
  const modal = wantsForm
    ? `\n\n{#if editing !== undefined}\n  <SvGridEditPanel schema={${n.schemaVar}} row={editing}${relationFields.length ? ' {lookups}' : ''} presentation="${formPres}" persistKey="${screen.route}" onSubmit={save} onCancel={() => (editing = undefined)} />\n{/if}`
    : ''
  // currentRole is needed for either a create/update UI gate or an action's
  // screen-access gate; `can`/`canScreen` are pulled in only where actually used.
  const needsCurrentRole = gatesUi || gatesActions
  const accessSpecs = [...(needsCurrentRole ? ['currentRole'] : []), ...(gatesUi ? ['can'] : []), ...(gatesActions ? ['canScreen'] : [])]
  const accessImport = accessSpecs.length ? `import { ${accessSpecs.join(', ')} } from '$lib/access'\n  ` : ''
  const i18nImport = i18nEnabled ? `import { t, localizeCols } from '$lib/i18n'\n  ` : ''
  // Code-behind needs goto (ctx.goto) + the page store (ctx.params) even when no
  // block otherwise navigates; and the handle runtime for its data/component handles.
  const gotoImport = usesGoto || codeEnabled ? `import { goto } from '$app/navigation'\n  ` : ''
  const codeImport = codeEnabled ? `import { onMount } from 'svelte'\n  import * as handlers from './handlers'\n  import type { PageContext } from './page-context'\n  ` : ''
  const handleSpecs = [codeWire?.usesHandle ? 'handle' : '', codeWire?.usesDataHandle ? 'dataHandle' : ''].filter(Boolean)
  const handleImport = handleSpecs.length ? `import { ${handleSpecs.join(', ')} } from '$lib/handles.svelte'\n  ` : ''
  const pageImport = applyUrlFilters || has(allBlocks, 'detail') || codeEnabled ? `import { page } from '$app/stores'\n  ` : ''
  const title = i18nEnabled ? `{$t('screen.${screen.id}', ${JSON.stringify(screen.title)})}` : screen.title
  // Surface a failed data load (silent empty grid otherwise) with a retry.
  const errorBanner = needsController
    ? `\n{#if view.error}
  <div class="st-error" role="alert">
    <span>Couldn't load data. {view.error instanceof Error ? view.error.message : String(view.error)}</span>
    <button type="button" class="st-btn" onclick={() => controller.refresh()}>Retry</button>
  </div>
{/if}\n`
    : ''

  return {
    path: `src/routes/${screen.route}/+page.svelte`,
    description: `${screen.title} screen (${blocks.map((b) => b.config.kind).join(', ') || 'empty'}).`,
    contents: `<script lang="ts">
  ${gridImports}${entImport}${handleImport}${accessImport}${i18nImport}${gotoImport}${codeImport}${pageImport}import { ${schemaVarImports.join(', ')}, ${typeImports.map((t) => `type ${t}`).join(', ')} } from '$lib/schemas'
  import { ${dataImports.join(', ')} } from '$lib/data'

  ${parts.join('\n\n  ')}
</script>

<h1 class="st__title">${title}</h1>
${errorBanner}
${toolbar}${screenBody}${modal}${actionSnippets.length ? '\n\n' + actionSnippets.join('\n\n') : ''}
${(() => {
  const kpiCss = has(blocks, 'kpi') || has(blocks, 'gauge') || has(blocks, 'tree') ? `  .kpi { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e6e8ec); border-radius: 12px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); overflow: hidden; }
  .kpi__head { display: flex; align-items: center; justify-content: space-between; }
  .kpi__label { font-size: 12.5px; font-weight: 600; color: var(--sg-muted, #64748b); text-transform: uppercase; letter-spacing: 0.03em; }
  .kpi__value { font-size: 28px; font-weight: 750; line-height: 1.1; color: var(--sg-fg, #0f172a); }
  .kpi__delta { align-self: flex-start; display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 700; background: color-mix(in srgb, var(--sg-muted, #64748b) 14%, transparent); color: var(--sg-muted, #64748b); }
  .kpi__delta.is-up { background: color-mix(in srgb, #16a34a 15%, transparent); color: #16a34a; }
  .kpi__delta.is-down { background: color-mix(in srgb, #dc2626 15%, transparent); color: #dc2626; }
  .kpi__spark { width: 100%; height: 30px; margin-top: 2px; color: var(--sg-accent, #4f46e5); opacity: 0.85; }
  .gaugecard { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px; border: 1px solid var(--sg-border, #e6e8ec); border-radius: 12px; }
  .gaugecard .kpi__label { align-self: flex-start; }
  .treecard { padding: 12px; border: 1px solid var(--sg-border, #e6e8ec); border-radius: 12px; }
` : ''
  const css = kpiCss + screenLayoutStyle(screen)
  return css ? `\n<style>\n${css}</style>\n` : ''
})()}`,
  }
}

// ---------------------------------------------------------------------------
// SSR-native output (opt-in per screen via `renderMode: 'ssr'`).
//
// Instead of the client data-source-controller page, an SSR screen emits idiomatic
// SvelteKit: a `+page.server.ts` with a `load` (SSR first paint, sort/filter/page
// read from the URL so it's shareable and works with no JS) and form `actions` for
// create / update / delete (progressive enhancement via `use:enhance`), plus an
// SSR `+page.svelte` that renders the server rows and drives the grid's external
// sort/pagination back into the URL. Server-side validation runs in the actions.
// ---------------------------------------------------------------------------

/** URL search params -> a data-source request. Shared by every SSR route's load. */
const SSR_QUERY_HELPER = `// Turn a page URL's search params into a data-source request (sort / filter /
// page / size). The grid drives these params via goto(), so the server re-runs
// load() - which makes every list view bookmarkable and functional with no JS.
import type { ServerRequest } from '@svgrid/grid'

export function planFromSearchParams(url: URL, defaultPageSize = 25): ServerRequest {
  const sp = url.searchParams
  const pageIndex = Math.max(0, Number.parseInt(sp.get('page') ?? '', 10) || 0)
  const pageSize = Math.min(200, Math.max(1, Number.parseInt(sp.get('size') ?? '', 10) || defaultPageSize))
  const sortModel = (sp.get('sort') ?? '')
    .split(',')
    .filter(Boolean)
    .map((token) => {
      const [id, dir] = token.split(':')
      return { id: id!, desc: dir === 'desc' }
    })
  const columns: Record<string, { operator: 'contains'; value: string }> = {}
  for (const [k, v] of sp) if (k.startsWith('f_') && v) columns[k.slice(2)] = { operator: 'contains', value: v }
  const global = sp.get('q') ?? ''
  return {
    startRow: pageIndex * pageSize,
    endRow: pageIndex * pageSize + pageSize,
    pageIndex,
    pageSize,
    sortModel,
    filterModel: { ...(global ? { global } : {}), columns },
  }
}
`

function ssrQueryHelperFile(): GeneratedFile {
  return { path: 'src/lib/server/query.ts', description: 'SSR: URL search params -> data-source request (sort/filter/page).', contents: SSR_QUERY_HELPER }
}

const htmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The `+page.server.ts` + SSR `+page.svelte` for a single-grid CRUD screen. */
function emitSsrGridScreen(schema: EntitySchema, screen: Screen, sourceKind: 'memory' | 'sql'): GeneratedFile[] {
  const n = namesFor(schema)
  const isSql = sourceKind === 'sql'
  const grid = screen.blocks[0]!.config as GridConfig
  const pageSize = grid.pageSize && grid.pageSize > 0 ? grid.pageSize : 25
  const idField = schema.idField ?? schema.fields.find((f) => f.primaryKey)?.field ?? 'id'
  const isFormHidden = (f: EntityField) => f.hidden === true || (typeof f.hidden === 'object' && !!f.hidden.form)
  const formFields = schema.fields.filter(
    (f) => f.field !== idField && !f.primaryKey && !f.readonly && !f.computed && !f.formula && !isFormHidden(f),
  )
  const normType = (t: string): 'text' | 'number' | 'boolean' => (t === 'number' ? 'number' : t === 'boolean' ? 'boolean' : 'text')
  const fieldTypesLit = `{ ${formFields.map((f) => `${jsStr(f.field)}: ${jsStr(normType(f.type))}`).join(', ')} }`

  // Source acquisition differs by kind:
  //  - memory: import the in-process source from $lib/data and call it directly.
  //  - sql: build a same-origin client over the connected /api/<entity> route with
  //    SvelteKit's event.fetch, so validation / RBAC / triggers / audit stay enforced
  //    once, in that route's createKitHandlers - not duplicated here.
  const src = isSql ? 'source(fetch)' : n.sourceVar
  const fetchArg = isSql ? ', fetch' : ''
  const enterpriseImports = isSql ? 'validateAll, createKitDataSource' : 'validateAll'
  const sourceImport = isSql ? '' : `import { ${n.sourceVar}, nextId } from '$lib/data'\n`
  const schemaImport = `import { ${n.schemaVar}${isSql ? `, type ${n.type}` : ''} } from '$lib/schemas'`
  const idConst = isSql ? '' : `\nconst ID_FIELD = ${jsStr(idField)}`
  const srcHelper = isSql
    ? `\n// Same-origin client over the connected /api/${n.route} route (that route runs\n// validation, RBAC, triggers + audit via createKitHandlers).\nconst source = (fetch: typeof globalThis.fetch) => createKitDataSource<${n.type}>({ endpoint: ${jsStr('/api/' + n.route)}, fetch })\n`
    : ''
  const createCall = isSql
    ? `await ${src}.createRow(values)`
    : `await ${n.sourceVar}.createRow({ [ID_FIELD]: nextId(${jsStr(n.idPrefix)}), ...values })`

  const server = `import type { Actions, PageServerLoad } from './$types'
import { fail } from '@sveltejs/kit'
import { ${enterpriseImports} } from '@svgrid/enterprise'
${sourceImport}${schemaImport}
import { planFromSearchParams } from '$lib/server/query'
${idConst}
const FIELD_TYPES: Record<string, 'text' | 'number' | 'boolean'> = ${fieldTypesLit}
${srcHelper}
/** Read a submitted form into a typed partial row. Booleans come from checkbox
 *  presence; numbers are coerced; empty values are dropped so they don't clobber. */
function formToValues(fd: FormData): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const [field, type] of Object.entries(FIELD_TYPES)) {
    if (type === 'boolean') { values[field] = fd.get(field) != null; continue }
    const raw = fd.get(field)
    if (raw == null || raw === '') continue
    values[field] = type === 'number' ? Number(raw) : String(raw)
  }
  return values
}

export const load: PageServerLoad = async ({ url${fetchArg} }) => {
  const plan = planFromSearchParams(url, ${pageSize})
  const { rows, rowCount } = await ${src}.getRows(plan)
  return { rows, total: rowCount, page: plan.pageIndex, size: plan.pageSize }
}

export const actions: Actions = {
  create: async ({ request${fetchArg} }) => {
    const values = formToValues(await request.formData())
    const errors = await validateAll(${n.schemaVar}, values)
    if (Object.keys(errors).length) return fail(422, { errors, values })
    ${createCall}
    return { ok: true }
  },
  update: async ({ request${fetchArg} }) => {
    const fd = await request.formData()
    const id = String(fd.get('__id') ?? '')
    const values = formToValues(fd)
    const errors = await validateAll(${n.schemaVar}, values)
    if (Object.keys(errors).length) return fail(422, { errors, values })
    await ${src}.updateRow(id, values)
    return { ok: true }
  },
  delete: async ({ request${fetchArg} }) => {
    const fd = await request.formData()
    await ${src}.deleteRow(String(fd.get('__id') ?? ''))
    return { ok: true }
  },
}
`

  const row = `(editing as Record<string, unknown>)`
  const fieldBlocks = formFields
    .map((f) => {
      const key = jsStr(f.field)
      const req = f.required ? ' required' : ''
      let input: string
      if (normType(f.type) === 'boolean') {
        input = `<input type="checkbox" name=${key} checked={!isCreate && !!${row}[${key}]} />`
      } else if (f.options && f.options.length) {
        const opts = f.options
          .map((o) => `<option value=${jsStr(String(o.value))} selected={!isCreate && ${row}[${key}] === ${jsStr(String(o.value))}}>${htmlEsc(o.label ?? String(o.value))}</option>`)
          .join('')
        input = `<select name=${key}${req}>${opts}</select>`
      } else {
        const t = normType(f.type) === 'number' ? 'number' : f.type === 'date' || f.type === 'dateString' ? 'date' : 'text'
        input = `<input type="${t}" name=${key} value={isCreate ? '' : (${row}[${key}] ?? '')}${req} />`
      }
      return `        <label class="sk-field">
          <span>${htmlEsc(f.label ?? f.field)}${f.required ? ' *' : ''}</span>
          ${input}
          {#if form?.errors?.[${key}]}<em class="sk-err">{form.errors[${key}]}</em>{/if}
        </label>`
    })
    .join('\n')

  const page = `<script lang="ts">
  import { SvGrid, renderSnippet, type ColumnDef, type CellContext } from '@svgrid/grid'
  import { schemaToColumns } from '@svgrid/enterprise'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { enhance } from '$app/forms'
  import type { SubmitFunction } from '@sveltejs/kit'
  import { ${n.schemaVar}, type ${n.type} } from '$lib/schemas'
  import type { PageProps } from './$types'

  let { data, form }: PageProps = $props()

  const ID_FIELD = ${jsStr(idField)}
  const TITLE = ${jsStr(screen.title)}
  const NEW_LABEL = ${jsStr('New ' + n.label)}

  // Grid columns from the schema + a row-actions column (Edit / Delete).
  const columns: ColumnDef<Record<string, never>, ${n.type}>[] = [
    ...(schemaToColumns(${n.schemaVar}) as ColumnDef<Record<string, never>, ${n.type}>[]),
    { id: '__actions', header: '', sortable: false, cell: (ctx: CellContext<${n.type}>) => renderSnippet(rowActions, { row: ctx.row.original }) },
  ]

  // null = no editor; 'create' = new row; a row = editing that row.
  let editing = $state<'create' | ${n.type} | null>(null)
  const isCreate = $derived(editing === 'create')

  // Sort / paginate by writing to the URL - load() re-runs on the server.
  function setParams(patch: Record<string, string | null>) {
    const sp = new URLSearchParams(page.url.searchParams)
    for (const [k, v] of Object.entries(patch)) { if (v == null) sp.delete(k); else sp.set(k, v) }
    const q = sp.toString()
    void goto(q ? \`?\${q}\` : page.url.pathname, { keepFocus: true, noScroll: true })
  }

  // Progressive enhancement: post to the action, keep typed values on error,
  // close the editor on success (load re-runs automatically, refreshing the grid).
  const onSubmit: SubmitFunction = () => async ({ result, update }) => {
    await update({ reset: false })
    if (result.type === 'success') editing = null
  }
</script>

{#snippet rowActions({ row }: { row: ${n.type} })}
  <div class="sk-rowact">
    <button type="button" class="sk-link" onclick={() => (editing = row)}>Edit</button>
    <form method="POST" action="?/delete" use:enhance={onSubmit} style="display:contents">
      <input type="hidden" name="__id" value={(row as Record<string, unknown>)[ID_FIELD] as string} />
      <button type="submit" class="sk-link sk-danger">Delete</button>
    </form>
  </div>
{/snippet}

<header class="sk-head">
  <h1>{TITLE}</h1>
  <button type="button" class="sk-btn sk-btn--primary" onclick={() => (editing = 'create')}>{NEW_LABEL}</button>
</header>

<SvGrid
  data={data.rows}
  {columns}
  externalSort
  externalPagination
  rowCount={data.total}
  pageIndex={data.page}
  pageSize={data.size}
  onSortingChange={(s) => setParams({ sort: s.map((x) => \`\${x.id}:\${x.desc ? 'desc' : 'asc'}\`).join(',') || null, page: null })}
  onPaginationChange={(p) => setParams({ page: String(p.pageIndex), size: String(p.pageSize) })}
/>

{#if editing}
  <div class="sk-overlay">
    <form method="POST" action={isCreate ? '?/create' : '?/update'} class="sk-form" use:enhance={onSubmit}>
      <h2>{isCreate ? NEW_LABEL : 'Edit ${htmlEsc(n.label)}'}</h2>
      {#if !isCreate}<input type="hidden" name="__id" value={${row}[ID_FIELD] as string} />{/if}
${fieldBlocks}
      <div class="sk-form__actions">
        <button type="button" class="sk-btn" onclick={() => (editing = null)}>Cancel</button>
        <button type="submit" class="sk-btn sk-btn--primary">Save</button>
      </div>
    </form>
  </div>
{/if}

<style>
  .sk-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .sk-head h1 { margin: 0; font-size: 20px; }
  .sk-btn { font: inherit; padding: 7px 14px; border-radius: 8px; border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); cursor: pointer; }
  .sk-btn--primary { background: var(--sg-accent, #4f46e5); border-color: var(--sg-accent, #4f46e5); color: #fff; }
  .sk-rowact { display: flex; gap: 10px; }
  .sk-link { background: none; border: none; padding: 0; font: inherit; color: var(--sg-accent, #4f46e5); cursor: pointer; }
  .sk-danger { color: #dc2626; }
  .sk-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); display: grid; place-items: center; z-index: 50; }
  .sk-form { width: min(480px, 92vw); max-height: 90vh; overflow: auto; background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); border-radius: 12px; padding: 22px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 24px 60px -20px rgba(15, 23, 42, 0.5); }
  .sk-form h2 { margin: 0 0 4px; font-size: 16px; }
  .sk-field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
  .sk-field span { color: var(--sg-muted, #64748b); }
  .sk-field input, .sk-field select { font: inherit; padding: 7px 9px; border-radius: 8px; border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); }
  .sk-field input[type='checkbox'] { align-self: flex-start; width: auto; }
  .sk-err { color: #dc2626; font-size: 12px; font-style: normal; }
  .sk-form__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
</style>
`

  return [
    { path: `src/routes/${screen.route}/+page.server.ts`, description: `SSR load + CRUD form actions for ${n.label}.`, contents: server },
    { path: `src/routes/${screen.route}/+page.svelte`, description: `${n.label} screen (SSR + progressive enhancement).`, contents: page },
  ]
}

export function emitStudioProject(project: StudioProject): GeneratedFile[] {
  if (project.entities.length === 0) throw new Error('emitStudioProject: no entities to emit')
  if (project.screens.length === 0) throw new Error('emitStudioProject: no screens to emit')

  const sources: Record<string, EntityDataSource> = Object.fromEntries(
    project.entities.map((e) => [e.name, entityDataSource(project, e.name)]),
  )
  const accessEnabled = project.access?.enabled === true && (project.access?.roles.length ?? 0) > 0
  const authEnabled = project.auth?.enabled === true
  // Audit only fires on server routes, so it needs at least one SQL-bound entity.
  const auditEnabled = project.audit === true && Object.values(sources).some((s) => s.kind === 'sql')
  const i18nEnabled = project.i18n?.enabled === true && (project.i18n?.locales.length ?? 0) > 0
  // Which screen(s) read-gate each entity's SQL route: a role may read the entity's
  // data only if it can open at least one screen bound to it (an entity with no
  // screen - e.g. a relation lookup target - has nothing to gate by, so it stays open).
  const screensByEntity = new Map<string, string[]>()
  for (const s of project.screens) {
    if (s.entity === undefined) continue // freestanding screen - gates no entity route
    screensByEntity.set(s.entity, [...(screensByEntity.get(s.entity) ?? []), s.id])
  }
  const { files, prepared } = emitEntityModules(project.entities, { sources, accessEnabled, auditEnabled, screensByEntity, triggers: project.triggers })
  const byName = new Map(prepared.map((s) => [s.name, s]))
  // Raw (unprepared) entities keep their original field set - needed to derive
  // relation display-field names that match withRelationLabels (the prepared
  // schemas already carry the appended display columns, which would false-collide).
  const rawByName = new Map(project.entities.map((e) => [e.name, e]))
  const resolve = (name: string) => byName.get(name)

  // Drill-through wiring: map screen id -> route, and detect whether any block
  // navigates (so target screens read URL params into an initial filter).
  const routeById = new Map(project.screens.map((s) => [s.id, s.route]))
  const drillEnabled = project.screens.some((s) => s.blocks.some((b) =>
    (b.config.kind === 'grid' && !!b.config.rowLink) || (b.config.kind === 'chart' && !!b.config.drillScreen)))

  const pages: GeneratedFile[] = []
  const seenRoute = new Set<string>()
  // Custom actions' stub API routes: one file per unique id, generated once
  // project-wide (a row action + a toolbar action, or two screens, could in
  // principle reuse the same id - last screen to declare it wins the route's
  // RBAC gate, matching how duplicate ids are the developer's responsibility
  // the same way duplicate block/screen ids already are).
  const actionsById = new Map<string, { action: ActionConfig; screenId: string }>()
  // Per-screen user-owned code companions (design + your own code). Emitted once
  // as a stub; in-place writers must skip if present. See HANDLERS-DESIGN.md.
  const companions: GeneratedFile[] = []
  for (const screen of project.screens) {
    if (seenRoute.has(screen.route)) throw new Error(`emitStudioProject: duplicate route "/${screen.route}"`)
    seenRoute.add(screen.route)
    for (const a of screenActionsOf(screen)) actionsById.set(a.id, { action: a, screenId: screen.id })

    if (screenHasCode(screen)) {
      // Data handles are typed to the entity's row (entity screens) or RowData
      // (freestanding). A dangling entity ref falls back and throws just below.
      const ent = screen.entity !== undefined ? byName.get(screen.entity) : undefined
      const rowType = ent ? namesFor(ent).type : 'RowData'
      companions.push(screenHandlersFile(screen), screenContextFile(screen, rowType))
    }

    if (screen.entity === undefined) {
      pages.push(freestandingScreenPage(screen, accessEnabled, i18nEnabled))
      continue
    }
    const schema = byName.get(screen.entity)
    if (!schema) throw new Error(`emitStudioProject: screen "${screen.title}" references missing entity "${screen.entity}"`)
    // SSR-native path (opt-in): idiomatic +page.server.ts load + form actions.
    if (isSsrScreen(project, screen)) {
      const srcKind = sources[screen.entity]?.kind === 'sql' ? 'sql' : 'memory'
      pages.push(...emitSsrGridScreen(schema, screen, srcKind))
      continue
    }
    pages.push(screenPage(schema, rawByName.get(screen.entity) ?? schema, screen, resolve, (name) => rawByName.get(name), accessEnabled, i18nEnabled, routeById, drillEnabled))
  }
  // Any SSR screen needs the shared URL-params -> query helper (server-only).
  const ssrHelpers = project.screens.some((s) => isSsrScreen(project, s)) ? [ssrQueryHelperFile()] : []
  const actionRouteFiles = [...actionsById.values()].map(({ action, screenId }) => actionRouteFile(action, screenId, accessEnabled))

  // Nav: only screens flagged into the menu, ordered, with an optional custom label.
  // Carry the screen id so RBAC can hide links the current role can't open.
  const nav: NavItem[] = [...project.screens]
    .filter((s) => s.nav?.show !== false)
    .sort((a, b) => (a.nav?.order ?? 0) - (b.nav?.order ?? 0))
    .map((s) => ({ href: `/${s.route}`, label: s.nav?.label ?? s.title, id: s.id }))
  const accessFiles = accessEnabled ? [accessModule(project)] : []
  const sqlEntities = project.entities.filter((e) => sources[e.name]?.kind === 'sql')
  // The Drizzle layer is only "active" on a supported dialect (not MSSQL). DB-backed
  // auth requires that active layer, so its user store can live in the same schema.
  const firstSqlSrc = sqlEntities.length ? sources[sqlEntities[0]!.name] : undefined
  const dataLayerActive = project.dataLayer === 'drizzle' && sqlEntities.length > 0 && dzDialect(firstSqlSrc?.kind === 'sql' ? firstSqlSrc.dialect : undefined) !== null
  const dbBackedAuth = authEnabled && dataLayerActive
  const authRegister = dbBackedAuth && project.auth?.register === true
  const authUserAdmin = dbBackedAuth && accessEnabled && project.auth?.userAdmin === true
  const authTwoFactor = dbBackedAuth && project.auth?.twoFactor === true
  const dataLayerList = project.dataLayer === 'drizzle' && sqlEntities.length > 0 ? dataLayerFiles(project, sqlEntities, sources, dbBackedAuth, authTwoFactor) : []
  const authFileList = authEnabled ? authFiles(project, dbBackedAuth, accessEnabled) : []
  const auditFiles = auditEnabled ? [auditModule(), auditRouteFile(), auditViewerPage()] : []
  // Routes that render bare (no shell) + skip the login guard.
  const publicAuthRoutes = authEnabled ? ['/login', ...(authTwoFactor ? ['/login/verify'] : []), ...(authRegister ? ['/register', '/forgot-password', '/reset-password'] : [])] : []
  let navExtras = auditEnabled ? [...nav, { href: '/audit', label: 'Audit log', id: '__audit__' }] : nav
  // The admin Users screen is nav-gated by canScreen('__users__') - only full-access ('*') roles see it.
  if (authUserAdmin) navExtras = [...navExtras, { href: '/users', label: 'Users', id: '__users__' }]
  const i18nFiles = i18nEnabled ? [i18nModule(project)] : []
  const handleFiles = project.screens.some(screenHasCode) ? [handlesModuleFile()] : []
  return [...files, ...accessFiles, ...authFileList, ...dataLayerList, ...auditFiles, ...i18nFiles, ...actionRouteFiles, ...ssrHelpers, ...pages, ...companions, ...handleFiles, layoutFile(navExtras, { accent: project.theme?.accent, shell: project.theme?.shell, title: project.title, themeVars: resolveThemeTokens(project.theme), lightVars: resolveThemeTokensFor(project.theme, 'light'), darkVars: resolveThemeTokensFor(project.theme, 'dark'), dark: isDarkTheme(project.theme), access: accessEnabled, auth: authEnabled, authRoutes: publicAuthRoutes, authAccount: dbBackedAuth, i18n: i18nEnabled, appClass: project.theme?.appClass }), homeFile(navExtras)]
}

/** The default-locale (`en`) message catalog, keyed for nav, screen titles, the
 *  New button, and grid column headers - the strings the app renders. */
function buildMessages(project: StudioProject): Record<string, string> {
  const m: Record<string, string> = {}
  for (const s of project.screens) {
    m[`screen.${s.id}`] = s.title
    if (s.nav?.show !== false) m[`nav.${s.id}`] = s.nav?.label ?? s.title
  }
  for (const e of project.entities) {
    m[`new.${e.name}`] = `+ New ${e.label ?? e.name}`
    for (const f of e.fields) m[`col.${e.name}.${f.field}`] = f.label ?? f.field
  }
  if (project.audit === true) m['nav.__audit__'] = 'Audit log'
  return m
}

/** The localization module: locales, the current-locale store, the message
 *  catalog (default locale seeded, others left for translators), a reactive
 *  `t()` translator, and a `localizeCols` helper for grid headers. */
function i18nModule(project: StudioProject): GeneratedFile {
  const cfg = project.i18n!
  const locales = cfg.locales
  const def = cfg.defaultLocale && locales.includes(cfg.defaultLocale) ? cfg.defaultLocale : locales[0]!
  const en = buildMessages(project)
  const localeUnion = locales.map((l) => JSON.stringify(l)).join(' | ')
  const seeded = JSON.stringify(en, null, 2).replace(/\n/g, '\n  ')
  const messagesEntries = locales.map((l) => `  ${JSON.stringify(l)}: ${l === def ? seeded : '{}'},`).join('\n')
  return {
    path: 'src/lib/i18n.ts',
    description: 'Localization: locales, the current-locale store, the message catalog, and t() / localizeCols helpers.',
    contents: `import { writable, derived } from 'svelte/store'

export type Locale = ${localeUnion}
export const locales: Locale[] = ${JSON.stringify(locales)} as Locale[]
export const currentLocale = writable<Locale>(${JSON.stringify(def)})

// The default locale is seeded from your schema + screen labels. Fill the other
// locales in with the same keys; missing keys fall back to the default.
const messages: Record<Locale, Record<string, string>> = {
${messagesEntries}
}

/** Reactive translator: \`$t('key', 'fallback')\`. Falls back to the default locale, then the fallback, then the key. */
export const t = derived(currentLocale, ($l) => (key: string, fallback?: string): string =>
  messages[$l]?.[key] ?? messages[${JSON.stringify(def)}]?.[key] ?? fallback ?? key)

/** Localize a column list's headers via \`col.<entity>.<field>\` keys. */
export function localizeCols<T extends { field?: string | number; header?: string }>(
  cols: T[], entity: string, translate: (k: string, fb?: string) => string,
): T[] {
  return cols.map((c) => ({ ...c, header: translate('col.' + entity + '.' + String(c.field), c.header ?? String(c.field ?? '')) }))
}
`,
  }
}

/** The audit store: an in-memory `ServerDataSource` of change records + a
 *  `recordAudit` writer. Swap the source for SQL/Supabase to persist the trail. */
function auditModule(): GeneratedFile {
  return {
    path: 'src/lib/audit.ts',
    description: 'Audit trail store: the AuditEntry schema, an in-memory source, and recordAudit(). Swap the source for a DB table to persist it.',
    contents: `import { createInMemoryDataSource } from '@svgrid/enterprise'
import type { EntitySchema } from '@svgrid/enterprise'

export type AuditEntry = {
  id: string
  at: string
  actor: string
  entity: string
  action: 'create' | 'update' | 'delete'
  recordId: string
  summary: string
}

export const auditSchema: EntitySchema<AuditEntry> = {
  name: 'audit',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'at', type: 'datetime', label: 'When' },
    { field: 'actor', type: 'text', label: 'Actor' },
    { field: 'entity', type: 'text', label: 'Entity' },
    { field: 'action', type: 'enum', label: 'Action', options: [{ value: 'create', label: 'Create' }, { value: 'update', label: 'Update' }, { value: 'delete', label: 'Delete' }] },
    { field: 'recordId', type: 'text', label: 'Record' },
    { field: 'summary', type: 'text', label: 'Summary' },
  ],
}

// In-memory, server-side singleton. Replace with a SQL / Supabase source to
// persist the trail across restarts (recordAudit + the /audit viewer keep working).
export const auditSource = createInMemoryDataSource<AuditEntry>([], auditSchema)
let seq = 0

/** Append one change record. Called by the API routes' \`audit\` hook. */
export async function recordAudit(input: {
  entity: string
  action: 'create' | 'update' | 'delete'
  recordId: string | null
  values?: Record<string, unknown>
  actor?: string
}): Promise<void> {
  const summary =
    input.action === 'delete'
      ? \`Deleted \${input.entity} \${input.recordId ?? ''}\`.trim()
      : \`\${input.action === 'create' ? 'Created' : 'Updated'} \${input.entity}\${input.values ? ' (' + Object.keys(input.values).join(', ') + ')' : ''}\`
  await auditSource.createRow?.({
    id: String(++seq),
    at: new Date().toISOString(),
    actor: input.actor ?? 'system',
    entity: input.entity,
    action: input.action,
    recordId: input.recordId ?? '',
    summary,
  })
}
`,
  }
}

/** The read API for the audit trail (the /audit viewer reads it via the transport). */
function auditRouteFile(): GeneratedFile {
  return {
    path: 'src/routes/api/audit/+server.ts',
    description: 'API route for the audit trail (read-only viewer feed).',
    contents: `import { createKitHandlers } from '@svgrid/enterprise'
import { auditSchema, auditSource } from '$lib/audit'

export const { POST } = createKitHandlers({ schema: auditSchema, source: auditSource })
`,
  }
}

/** The audit-log viewer screen: a read-only grid over the audit source. */
function auditViewerPage(): GeneratedFile {
  return {
    path: 'src/routes/audit/+page.svelte',
    description: 'Audit log viewer (read-only grid of change records).',
    contents: `<script lang="ts">
  import { SvGrid, createServerDataSource, type ServerState } from '@svgrid/grid'
  import { schemaToColumns, createKitDataSource } from '@svgrid/enterprise'
  import { auditSchema, type AuditEntry } from '$lib/audit'

  const source = createKitDataSource<AuditEntry>({ endpoint: '/api/audit' })
  let view = $state<ServerState<AuditEntry>>({ rows: [], total: 0, loading: false, saving: false, error: null, pageIndex: 0, pageSize: 25, pageCount: 1, sortModel: [], filterModel: {} })
  const controller = createServerDataSource<AuditEntry>(source, { pageSize: 25, onChange: (s) => (view = s) })
  $effect(() => { controller.refresh(); return () => controller.dispose() })
  const columns = schemaToColumns(auditSchema)
</script>

<h1 class="st__title">Audit log</h1>
<p class="st__sub">Every create, update, and delete recorded server-side.</p>

<div class="screen" style="margin-top: 16px">
  <SvGrid
    data={view.rows}
    columns={columns}
    loading={view.loading}
    loadingOverlay
    fitColumns
    sortable
    externalSort
    onSortingChange={(s) => controller.setSort(s)}
    showPagination
    externalPagination
    rowCount={view.total}
    pageIndex={view.pageIndex}
    pageSize={view.pageSize}
    onPaginationChange={({ pageIndex, pageSize }) => (pageSize !== view.pageSize ? controller.setPageSize(pageSize) : controller.setPage(pageIndex))}
    containerHeight={520}
  />
</div>
`,
  }
}

/** The shared RBAC policy module: roles, screen + action maps, the current-role
 *  store, and the server-side role/authorize helpers. */
function accessModule(project: StudioProject): GeneratedFile {
  const access = project.access!
  const roleNames = access.roles.map((r) => r.role)
  const defaultRole = access.defaultRole && roleNames.includes(access.defaultRole) ? access.defaultRole : (roleNames[0] ?? 'viewer')
  const roleUnion = roleNames.length ? roleNames.map((r) => JSON.stringify(r)).join(' | ') : "'viewer'"
  const screensEntries = access.roles.map((r) => `  ${JSON.stringify(r.role)}: ${r.screens === '*' ? "'*'" : JSON.stringify(r.screens)},`).join('\n')
  const actionsEntries = access.roles.map((r) => `  ${JSON.stringify(r.role)}: ${r.actions === '*' ? "'*'" : JSON.stringify(r.actions)},`).join('\n')
  return {
    path: 'src/lib/access.ts',
    description: 'RBAC policy: roles, screen + action permissions, the current-role store, and server helpers. Shared by the UI and the API routes.',
    contents: `import { writable } from 'svelte/store'

export type AppRole = ${roleUnion}
export type WriteAction = 'create' | 'update' | 'delete'
export const ROLES: AppRole[] = ${JSON.stringify(roleNames)} as AppRole[]

const SCREENS: Record<AppRole, '*' | string[]> = {
${screensEntries}
}
const ACTIONS: Record<AppRole, '*' | WriteAction[]> = {
${actionsEntries}
}

/** The signed-in user's role. Set it after login (e.g. from the session);
 *  defaults to the project's default role. Read it in components as \`$currentRole\`. */
export const currentRole = writable<AppRole>(${JSON.stringify(defaultRole)})

/** May this role open the given screen id? */
export function canScreen(role: AppRole, screenId: string): boolean {
  const s = SCREENS[role]
  return s === '*' || (Array.isArray(s) && s.includes(screenId))
}
/** May this role perform a write action? (Reads are implied by screen access.) */
export function can(role: AppRole, action: WriteAction): boolean {
  const a = ACTIONS[role]
  return a === '*' || (Array.isArray(a) && a.includes(action))
}

// ---- server side ----------------------------------------------------------
/** Resolve the caller's role on the server. Wire this to YOUR auth: by default it
 *  reads \`event.locals.role\` - set it in \`hooks.server.ts\` from the session. */
export function getServerRole(event: { locals?: { role?: unknown } }): AppRole {
  const r = event?.locals?.role
  return (typeof r === 'string' && (ROLES as string[]).includes(r) ? r : ${JSON.stringify(defaultRole)}) as AppRole
}
/** Authorize a CRUD action for a role - used by the API routes' \`authorize\` hook.
 *  \`screenIds\` are the screen(s) bound to this route's entity: a read is allowed
 *  only if the role can open at least one of them (an entity with no screen of its
 *  own - e.g. a relation lookup target - has nothing to gate reads by, so it stays
 *  open). Writes are still governed purely by \`can()\`. */
export function authorizeAction(role: AppRole, action: 'read' | WriteAction, screenIds: string[] = []): boolean {
  if (action !== 'read') return can(role, action)
  if (screenIds.length === 0) return true
  return screenIds.some((id) => canScreen(role, id))
}
`,
  }
}

/** The authentication starter (emitted when `project.auth.enabled`): a dependency-free
 *  session (Web Crypto: PBKDF2 hashing + HMAC-signed stateless cookies), a users seed,
 *  `hooks.server.ts` that resolves the caller into `event.locals.role`/`user` (the loop
 *  the RBAC layer already expects), a `/login` page + sign-out, and the `App.Locals`
 *  type augmentation. Works across every data source (no DB required for the demo). */
function authFiles(project: StudioProject, dbBacked = false, accessEnabled = false): GeneratedFile[] {
  const users = seedUsers(project)
  const demo = users[0]!
  const protect = project.auth?.protect !== false
  // Self-service + admin flows need the DB-backed store (persistence); user admin also needs RBAC.
  const register = project.auth?.register === true && dbBacked
  const userAdmin = project.auth?.userAdmin === true && dbBacked && accessEnabled
  const twoFactor = project.auth?.twoFactor === true && dbBacked
  const emailReal = dbBacked && (project.auth?.email === true || twoFactor)
  const oauthProviders: OAuthProvider[] = dbBacked ? (project.auth?.oauth ?? []) : []
  const registerRole = project.access?.defaultRole && project.access.roles.some((r) => r.role === project.access!.defaultRole)
    ? project.access.defaultRole
    : project.access?.roles[0]?.role ?? 'user'
  const usersLiteral = users
    .map((u) => `  { email: ${JSON.stringify(u.email)}, name: ${JSON.stringify(u.name)}, role: ${JSON.stringify(u.role)}, password: ${JSON.stringify(u.password)} }`)
    .join(',\n')
  // When the Drizzle data layer is on, the user store is DB-backed (an `auth_users`
  // table) with hashed passwords, seeded once on first login. Otherwise it's the
  // in-code demo array below.
  const seedLiteral = users
    .map((u) => `  { email: ${JSON.stringify(u.email)}, name: ${JSON.stringify(u.name)}, role: ${JSON.stringify(u.role)}, password: ${JSON.stringify(u.password)} }`)
    .join(',\n')

  const authTs = `// Regenerated by SvGrid Studio. Dependency-free auth: PBKDF2 password hashing +
// stateless HMAC-signed session cookies (Web Crypto - runs on Node and edge runtimes).
import { env } from '$env/dynamic/private'

export const SESSION_COOKIE = 'sv_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days (seconds)

export type SessionUser = { email: string; name: string; role: string }

const enc = new TextEncoder()
// Signing secret. Set SESSION_SECRET in the environment for production (see .env.example).
const secret = () => env.SESSION_SECRET || 'dev-insecure-secret-change-me'

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const byte of b) s += String.fromCharCode(byte)
  return btoa(s).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '')
}
function fromB64url(s: string): Uint8Array {
  const p = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(p + '==='.slice((p.length + 3) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}
async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}

/** Sign a stateless session token: base64url(payload).hmac(payload). */
export async function signSession(user: SessionUser): Promise<string> {
  const payload = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE }
  const body = b64url(enc.encode(JSON.stringify(payload)))
  return body + '.' + (await hmac(body))
}
/** Verify a token; returns the user, or null if missing / tampered / expired. */
export async function readSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot < 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!timingSafeEqual(sig, await hmac(body))) return null
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionUser & { exp: number }
    if (typeof p.exp !== 'number' || p.exp * 1000 < Date.now()) return null
    return { email: p.email, name: p.name, role: p.role }
  } catch {
    return null
  }
}

// ---- password hashing (PBKDF2) --------------------------------------------
// Use these to store hashed passwords in a real user store: keep hashPassword()'s
// output as \`passwordHash\`, then check with verifyPassword(input, passwordHash).
export async function hashPassword(password: string, salt?: string): Promise<string> {
  const s = salt ?? b64url(crypto.getRandomValues(new Uint8Array(16)))
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(s), iterations: 100000, hash: 'SHA-256' }, key, 256)
  return s + ':' + b64url(bits)
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const salt = stored.split(':')[0]
  if (!salt) return false
  return timingSafeEqual(await hashPassword(password, salt), stored)
}

// ---- password reset (stateless, signed link) ------------------------------
const RESET_MAX_AGE = 60 * 30 // 30 minutes
/** A short-lived, signed password-reset token for an email (no DB row needed). */
export async function signReset(email: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + RESET_MAX_AGE, k: 'reset' })))
  return body + '.' + (await hmac(body))
}
/** Verify a reset token; returns the email, or null if invalid / expired. */
export async function readReset(token: string | undefined): Promise<string | null> {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot < 0) return null
  const body = token.slice(0, dot)
  if (!timingSafeEqual(token.slice(dot + 1), await hmac(body))) return null
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as { email: string; exp: number; k: string }
    if (p.k !== 'reset' || typeof p.exp !== 'number' || p.exp * 1000 < Date.now()) return null
    return p.email
  } catch {
    return null
  }
}

/** Deliver a password-reset link. STUB: logs it in dev - wire your email provider
 *  (Resend / SendGrid / Postmark / SMTP) here for production. */
export async function sendResetEmail(email: string, link: string): Promise<void> {
  console.log('[auth] password reset for ' + email + ' -> ' + link)
}
${twoFactor ? `
// ---- email two-factor challenge (stateless, signed) -----------------------
export const TFA_COOKIE = 'sv_2fa'
const TFA_MAX_AGE = 60 * 10 // 10 minutes
/** A random 6-digit one-time code. */
export function otpCode(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1000000).padStart(6, '0')
}
async function codeHash(email: string, code: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(email + ':' + code))
  return b64url(d)
}
/** A signed pending-2FA token binding an email to a hashed code (the code itself is emailed). */
export async function signChallenge(email: string, code: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ email, ch: await codeHash(email, code), exp: Math.floor(Date.now() / 1000) + TFA_MAX_AGE, k: '2fa' })))
  return body + '.' + (await hmac(body))
}
/** Verify a submitted code against the pending token; returns the email or null. */
export async function readChallenge(token: string | undefined, code: string): Promise<string | null> {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot < 0) return null
  const body = token.slice(0, dot)
  if (!timingSafeEqual(token.slice(dot + 1), await hmac(body))) return null
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as { email: string; ch: string; exp: number; k: string }
    if (p.k !== '2fa' || typeof p.exp !== 'number' || p.exp * 1000 < Date.now()) return null
    if (!timingSafeEqual(p.ch, await codeHash(p.email, code))) return null
    return p.email
  } catch {
    return null
  }
}
` : ''}`

  const usersTs = dbBacked
    ? `// Regenerated by SvGrid Studio. DB-backed user store: reads the \`auth_users\` table
// (Drizzle) with hashed passwords. The demo users below are seeded ONCE, on the first
// login, if the table is empty - delete the seed for production, or manage users in the DB.
import { eq } from 'drizzle-orm'
import { db } from './db/index'
import { authUsers, type AuthUserRow } from './db/schema'
import { hashPassword } from './auth'

export type AppUser = AuthUserRow

const SEED: Array<{ email: string; name: string; role: string; password: string }> = [
${seedLiteral},
]

// Seed the demo users once (idempotent + concurrency-safe: the unique email index
// rejects a racing duplicate, which we swallow). Cached per process after the first run.
let seeding: Promise<void> | null = null
function ensureSeeded(): Promise<void> {
  if (!seeding) seeding = (async () => {
    const existing = await db.select({ email: authUsers.email }).from(authUsers).limit(1)
    if (existing.length) return
    for (const u of SEED) {
      try {
        await db.insert(authUsers).values({ email: u.email, name: u.name, role: u.role, passwordHash: await hashPassword(u.password) })
      } catch { /* unique-email race: another request seeded it first */ }
    }
  })()
  return seeding
}

export async function findUser(email: string): Promise<AppUser | undefined> {
  await ensureSeeded()
  const e = email.trim().toLowerCase()
  return (await db.select().from(authUsers).where(eq(authUsers.email, e))).at(0)
}

/** Public view of a user (no password hash) - for the admin list. */
export type PublicUser = { email: string; name: string; role: string }
export async function listUsers(): Promise<PublicUser[]> {
  await ensureSeeded()
  return db.select({ email: authUsers.email, name: authUsers.name, role: authUsers.role }).from(authUsers)
}

/** Create a user (hashed password). Returns undefined if the email already exists. */
export async function createUser(input: { email: string; name: string; password: string; role: string }): Promise<AppUser | undefined> {
  const email = input.email.trim().toLowerCase()
  if (await findUser(email)) return undefined
  const passwordHash = await hashPassword(input.password)
  try {
    await db.insert(authUsers).values({ email, name: input.name, role: input.role, passwordHash })
  } catch {
    return undefined // unique-email race
  }
  return findUser(email)
}

export async function updatePassword(email: string, newPassword: string): Promise<void> {
  await db.update(authUsers).set({ passwordHash: await hashPassword(newPassword) }).where(eq(authUsers.email, email.trim().toLowerCase()))
}
export async function setUserRole(email: string, role: string): Promise<void> {
  await db.update(authUsers).set({ role }).where(eq(authUsers.email, email.trim().toLowerCase()))
}
export async function deleteUser(email: string): Promise<void> {
  await db.delete(authUsers).where(eq(authUsers.email, email.trim().toLowerCase()))
}${twoFactor ? `
export async function setTwoFactor(email: string, on: boolean): Promise<void> {
  await db.update(authUsers).set({ twoFactor: on }).where(eq(authUsers.email, email.trim().toLowerCase()))
}` : ''}
`
    : `// Regenerated by SvGrid Studio. DEMO user store - replace with your own (a DB table,
// an external identity provider, ...). Passwords here are demo seeds, like sample rows:
// change them and store hashes for production (see hashPassword / verifyPassword in ./auth).
// Tip: turn on the Drizzle data layer and this becomes a real \`auth_users\` DB table.
export type AppUser = { email: string; name: string; role: string; password: string }

export const USERS: AppUser[] = [
${usersLiteral},
]

export function findUser(email: string): AppUser | undefined {
  const e = email.trim().toLowerCase()
  return USERS.find((u) => u.email.toLowerCase() === e)
}
`

  const hooksTs = `import type { Handle } from '@sveltejs/kit'
import { SESSION_COOKIE, readSession } from '$lib/server/auth'

// Resolve the signed session on every request into event.locals - the RBAC layer
// (getServerRole / authorize) and the app shell read event.locals.role from here.
export const handle: Handle = async ({ event, resolve }) => {
  const user = await readSession(event.cookies.get(SESSION_COOKIE))
  event.locals.user = user ?? undefined
  event.locals.role = user?.role
  return resolve(event)
}
`

  const localsDts = `import type { SessionUser } from '$lib/server/auth'

declare global {
  namespace App {
    interface Locals {
      user?: SessionUser
      role?: string
    }
  }
}

export {}
`

  // Routes that render bare (no app shell) and don't require a session.
  const publicRoutes = ['/login', ...(twoFactor ? ['/login/verify'] : []), ...(register ? ['/register', '/forgot-password', '/reset-password'] : [])]
  const layoutServerTs = `import type { LayoutServerLoad } from './$types'
${protect ? `import { redirect } from '@sveltejs/kit'\n\nconst PUBLIC = new Set(${JSON.stringify(publicRoutes)})\n` : ''}
// Expose the signed-in user + role to every page (read as \`data.user\` / \`data.role\`,
// or \`$page.data\`).${protect ? ' Unauthenticated visitors are sent to /login.' : ''}
export const load: LayoutServerLoad = async ({ locals${protect ? ', url' : ''} }) => {
${protect ? "  if (!locals.user && !PUBLIC.has(url.pathname)) throw redirect(302, '/login?redirectTo=' + encodeURIComponent(url.pathname))\n" : ''}  return { user: locals.user ?? null, role: locals.role ?? null }
}
`

  const loginCheck = dbBacked
    ? `const user = await findUser(email)
    // DB-backed store: verify against the stored PBKDF2 hash.
    if (!user || !(await verifyPassword(password, user.passwordHash))) return fail(401, { email, error: 'Invalid email or password.' })`
    : `const user = findUser(email)
    // DEMO: plain comparison against the seed. For a real store keep a passwordHash and
    // use \`await verifyPassword(password, user.passwordHash)\` from '$lib/server/auth'.
    if (!user || user.password !== password) return fail(401, { email, error: 'Invalid email or password.' })`
  // 2FA (email code): after the password check, email a code + park a pending token,
  // then send the user to /login/verify instead of issuing the session immediately.
  const twoFactorBranch = twoFactor ? `
    if (user.twoFactor) {
      const code = otpCode()
      await sendEmail(user.email, 'Your verification code', '<p>Your sign-in code is <strong>' + code + '</strong>. It expires in 10 minutes.</p>')
      cookies.set(TFA_COOKIE, await signChallenge(user.email, code), { path: '/', httpOnly: true, sameSite: 'lax', secure: url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', maxAge: 600 })
      const rt = url.searchParams.get('redirectTo')
      throw redirect(302, '/login/verify' + (rt ? '?redirectTo=' + encodeURIComponent(rt) : ''))
    }` : ''
  const loginImports = twoFactor
    ? "import { SESSION_COOKIE, SESSION_MAX_AGE, TFA_COOKIE, signSession, verifyPassword, otpCode, signChallenge } from '$lib/server/auth'\nimport { findUser } from '$lib/server/users'\nimport { sendEmail } from '$lib/server/email'"
    : `import { SESSION_COOKIE, SESSION_MAX_AGE, signSession${dbBacked ? ', verifyPassword' : ''} } from '$lib/server/auth'\nimport { findUser } from '$lib/server/users'`
  const loginServerTs = `import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
${loginImports}

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) throw redirect(302, '/')
  return {}
}

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const form = await request.formData()
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    ${loginCheck}${twoFactorBranch}
    const token = await signSession({ email: user.email, name: user.name, role: user.role })
    cookies.set(SESSION_COOKIE, token, {
      path: '/', httpOnly: true, sameSite: 'lax',
      secure: url.hostname !== 'localhost' && url.hostname !== '127.0.0.1',
      maxAge: SESSION_MAX_AGE,
    })
    throw redirect(302, url.searchParams.get('redirectTo') || '/')
  },
}
`

  // Shared full-screen auth-page styles (login / register / forgot / reset).
  const authStyle = `<style>
  .auth { display: grid; place-items: center; min-height: 100vh; padding: 24px; background: var(--sg-bg-subtle, #f8fafc); }
  .auth__card { width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 12px; padding: 28px; background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e6e8ec); border-radius: 16px; box-shadow: 0 12px 40px -12px rgba(15, 23, 42, 0.18); }
  .auth__title { margin: 0; font-size: 22px; font-weight: 720; letter-spacing: -0.02em; }
  .auth__sub { margin: -6px 0 6px; font-size: 13.5px; color: var(--sg-muted, #64748b); }
  .auth__field { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .auth__field input { padding: 9px 11px; font: inherit; font-size: 14px; font-weight: 400; color: var(--sg-fg, #0f172a); background: var(--sg-input-bg, #fff); border: 1px solid var(--sg-input-border, #e6e8ec); border-radius: 9px; }
  .auth__field input:focus { outline: none; border-color: var(--sg-accent, #6366f1); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sg-accent, #6366f1) 18%, transparent); }
  .auth__btn { margin-top: 4px; padding: 10px; font: inherit; font-size: 14px; font-weight: 640; color: var(--sg-on-accent, #fff); background: var(--sg-accent, #6366f1); border: none; border-radius: 9px; cursor: pointer; }
  .auth__btn:hover { filter: brightness(1.06); }
  .auth__err { margin: 0; padding: 8px 11px; font-size: 13px; color: var(--sg-danger, #b3261e); background: color-mix(in srgb, var(--sg-danger, #dc2626) 9%, var(--sg-bg, #fff)); border: 1px solid color-mix(in srgb, var(--sg-danger, #dc2626) 35%, var(--sg-border, #e6e8ec)); border-radius: 9px; }
  .auth__ok { margin: 0; padding: 8px 11px; font-size: 13px; color: #166534; background: color-mix(in srgb, #16a34a 9%, var(--sg-bg, #fff)); border: 1px solid color-mix(in srgb, #16a34a 35%, var(--sg-border, #e6e8ec)); border-radius: 9px; }
  .auth__hint { margin: 6px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); text-align: center; }
  .auth__hint code { background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, transparent); padding: 1px 5px; border-radius: 5px; }
  .auth__links { margin: 2px 0 0; display: flex; justify-content: space-between; font-size: 12.5px; }
  .auth__links a { color: var(--sg-accent, #6366f1); text-decoration: none; font-weight: 600; }
  .auth__or { display: flex; align-items: center; gap: 10px; margin: 2px 0; color: var(--sg-muted, #94a3b8); font-size: 12px; }
  .auth__or::before, .auth__or::after { content: ''; flex: 1; height: 1px; background: var(--sg-border, #e6e8ec); }
  .auth__oauth { display: flex; flex-direction: column; gap: 8px; }
  .auth__oauth-btn { display: block; text-align: center; padding: 9px; font-size: 13.5px; font-weight: 600; color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e6e8ec); border-radius: 9px; text-decoration: none; }
  .auth__oauth-btn:hover { background: color-mix(in srgb, var(--sg-fg, #0f172a) 4%, var(--sg-bg, #fff)); }
</style>`

  const loginPage = `<script lang="ts">
  import { enhance } from '$app/forms'
  let { form } = $props()
</script>

<div class="auth">
  <form method="POST" use:enhance class="auth__card">
    <h1 class="auth__title">Sign in</h1>
    <p class="auth__sub">${jsStrHtml(project.title || 'Welcome back')}</p>
    {#if form?.error}<p class="auth__err" role="alert">{form.error}</p>{/if}
    <label class="auth__field"><span>Email</span>
      <input name="email" type="email" autocomplete="username" value={form?.email ?? ''} required />
    </label>
    <label class="auth__field"><span>Password</span>
      <input name="password" type="password" autocomplete="current-password" required />
    </label>
    <button class="auth__btn" type="submit">Sign in</button>${oauthProviders.length ? `
    <div class="auth__or"><span>or</span></div>
    <div class="auth__oauth">
      ${oauthProviders.map((p) => `<a class="auth__oauth-btn" href="/auth/${p}">Continue with ${({ github: 'GitHub', google: 'Google', oidc: 'SSO' } as Record<string, string>)[p]}</a>`).join('\n      ')}
    </div>` : ''}
    <p class="auth__hint">Demo account: <code>${demo.email}</code> / <code>${demo.password}</code></p>${register ? `
    <p class="auth__links"><a href="/forgot-password">Forgot password?</a><a href="/register">Create account</a></p>` : ''}
  </form>
</div>

${authStyle}
`

  const logoutServerTs = `import { redirect } from '@sveltejs/kit'
import type { Actions } from './$types'
import { SESSION_COOKIE } from '$lib/server/auth'

export const actions: Actions = {
  default: async ({ cookies }) => {
    cookies.delete(SESSION_COOKIE, { path: '/' })
    throw redirect(302, '/login')
  },
}
`

  // --- change password (any signed-in user; DB-backed only) ---
  const accountServerTs = `import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { findUser, updatePassword${twoFactor ? ', setTwoFactor' : ''} } from '$lib/server/users'
import { verifyPassword } from '$lib/server/auth'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, '/login')
${twoFactor ? `  const me = await findUser(locals.user.email)
  return { user: locals.user, twoFactor: me?.twoFactor ?? false }` : '  return { user: locals.user }'}
}

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) throw redirect(302, '/login')
    const form = await request.formData()
    const current = String(form.get('current') ?? '')
    const next = String(form.get('next') ?? '')
    if (next.length < 8) return fail(400, { error: 'New password must be at least 8 characters.' })
    const user = await findUser(locals.user.email)
    if (!user || !(await verifyPassword(current, user.passwordHash))) return fail(401, { error: 'Current password is incorrect.' })
    await updatePassword(user.email, next)
    return { ok: true }
  },${twoFactor ? `
  tfa: async ({ request, locals }) => {
    if (!locals.user) throw redirect(302, '/login')
    const on = String((await request.formData()).get('on') ?? '') === 'true'
    await setTwoFactor(locals.user.email, on)
    return { tfa: on }
  },` : ''}
}
`
  const accountPage = `<script lang="ts">
  import { enhance } from '$app/forms'
  let { data, form } = $props()
</script>

<h1 class="st__title">Account</h1>
<div class="acct">
  <p class="st__sub">Signed in as <strong>{data.user.name}</strong> ({data.user.email}).</p>
  <form method="POST" use:enhance class="acct__form">
    <h2 class="acct__h">Change password</h2>
    {#if form?.ok}<p class="acct__ok">Password updated.</p>{/if}
    {#if form?.error}<p class="acct__err" role="alert">{form.error}</p>{/if}
    <label class="acct__field"><span>Current password</span><input name="current" type="password" autocomplete="current-password" required /></label>
    <label class="acct__field"><span>New password</span><input name="next" type="password" autocomplete="new-password" minlength="8" required /></label>
    <button class="acct__btn" type="submit">Update password</button>
  </form>${twoFactor ? `
  <form method="POST" action="?/tfa" use:enhance class="acct__form">
    <h2 class="acct__h">Two-factor authentication</h2>
    <p class="st-hint">{data.twoFactor ? 'Enabled - a code is emailed to you at sign-in.' : 'Add an emailed one-time code at sign-in.'}</p>
    <input type="hidden" name="on" value={data.twoFactor ? 'false' : 'true'} />
    <button class="acct__btn" type="submit">{data.twoFactor ? 'Disable' : 'Enable'} two-factor</button>
  </form>` : ''}
</div>

<style>
  .acct { max-width: 420px; margin-top: 12px; }
  .acct__form { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; padding: 18px; border: 1px solid var(--sg-border, #e6e8ec); border-radius: 12px; background: var(--sg-bg, #fff); }
  .acct__h { margin: 0; font-size: 15px; }
  .acct__field { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .acct__field input { padding: 8px 10px; font: inherit; font-size: 14px; font-weight: 400; border: 1px solid var(--sg-input-border, #e6e8ec); border-radius: 8px; background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); }
  .acct__btn { align-self: start; margin-top: 4px; padding: 8px 16px; font: inherit; font-size: 13.5px; font-weight: 620; color: var(--sg-on-accent, #fff); background: var(--sg-accent, #6366f1); border: none; border-radius: 8px; cursor: pointer; }
  .acct__ok { margin: 0; color: #166534; font-size: 13px; }
  .acct__err { margin: 0; color: var(--sg-danger, #b3261e); font-size: 13px; }
</style>
`

  // --- self-service register + password recovery (register flag) ---
  const registerServerTs = `import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { createUser } from '$lib/server/users'
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from '$lib/server/auth'

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) throw redirect(302, '/')
  return {}
}

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const form = await request.formData()
    const email = String(form.get('email') ?? '')
    const name = String(form.get('name') ?? '')
    const password = String(form.get('password') ?? '')
    if (!email.trim() || !name.trim() || password.length < 8) return fail(400, { email, name, error: 'Enter a name, email, and a password of at least 8 characters.' })
    const user = await createUser({ email, name, password, role: ${JSON.stringify(registerRole)} })
    if (!user) return fail(409, { email, name, error: 'That email is already registered.' })
    const token = await signSession({ email: user.email, name: user.name, role: user.role })
    cookies.set(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', maxAge: SESSION_MAX_AGE })
    throw redirect(302, '/')
  },
}
`
  const registerPage = `<script lang="ts">
  import { enhance } from '$app/forms'
  let { form } = $props()
</script>

<div class="auth">
  <form method="POST" use:enhance class="auth__card">
    <h1 class="auth__title">Create account</h1>
    <p class="auth__sub">${jsStrHtml(project.title || '')}</p>
    {#if form?.error}<p class="auth__err" role="alert">{form.error}</p>{/if}
    <label class="auth__field"><span>Name</span><input name="name" autocomplete="name" value={form?.name ?? ''} required /></label>
    <label class="auth__field"><span>Email</span><input name="email" type="email" autocomplete="username" value={form?.email ?? ''} required /></label>
    <label class="auth__field"><span>Password</span><input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>
    <button class="auth__btn" type="submit">Create account</button>
    <p class="auth__links"><a href="/login">Have an account? Sign in</a></p>
  </form>
</div>

${authStyle}
`
  const forgotSend = emailReal
    ? `if (user) {
      const link = url.origin + '/reset-password?token=' + encodeURIComponent(await signReset(user.email))
      await sendEmail(user.email, 'Reset your password', '<p>Reset your password with the link below (expires in 30 minutes):</p><p><a href="' + link + '">' + link + '</a></p>')
    }`
    : `if (user) await sendResetEmail(user.email, url.origin + '/reset-password?token=' + encodeURIComponent(await signReset(user.email)))`
  const forgotServerTs = `import type { Actions } from './$types'
import { findUser } from '$lib/server/users'
import { signReset${emailReal ? '' : ', sendResetEmail'} } from '$lib/server/auth'${emailReal ? "\nimport { sendEmail } from '$lib/server/email'" : ''}

export const actions: Actions = {
  default: async ({ request, url }) => {
    const email = String((await request.formData()).get('email') ?? '').trim().toLowerCase()
    const user = await findUser(email)
    // Respond identically whether or not the account exists (no account enumeration).
    ${forgotSend}
    return { sent: true }
  },
}
`
  const forgotPage = `<script lang="ts">
  import { enhance } from '$app/forms'
  let { form } = $props()
</script>

<div class="auth">
  <form method="POST" use:enhance class="auth__card">
    <h1 class="auth__title">Reset password</h1>
    <p class="auth__sub">We'll email you a reset link.</p>
    {#if form?.sent}<p class="auth__ok">If that account exists, a reset link is on its way. (Dev: the link is logged to the server console.)</p>{/if}
    <label class="auth__field"><span>Email</span><input name="email" type="email" autocomplete="username" required /></label>
    <button class="auth__btn" type="submit">Send reset link</button>
    <p class="auth__links"><a href="/login">Back to sign in</a></p>
  </form>
</div>

${authStyle}
`
  const resetServerTs = `import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { readReset } from '$lib/server/auth'
import { updatePassword } from '$lib/server/users'

export const load: PageServerLoad = async ({ url }) => {
  return { valid: !!(await readReset(url.searchParams.get('token') ?? undefined)) }
}

export const actions: Actions = {
  default: async ({ request, url }) => {
    const email = await readReset(url.searchParams.get('token') ?? undefined)
    if (!email) return fail(400, { error: 'This reset link is invalid or has expired.' })
    const next = String((await request.formData()).get('password') ?? '')
    if (next.length < 8) return fail(400, { error: 'Password must be at least 8 characters.' })
    await updatePassword(email, next)
    throw redirect(302, '/login')
  },
}
`
  const resetPage = `<script lang="ts">
  import { enhance } from '$app/forms'
  let { data, form } = $props()
</script>

<div class="auth">
  <form method="POST" use:enhance class="auth__card">
    <h1 class="auth__title">Set a new password</h1>
    {#if !data.valid}
      <p class="auth__err">This reset link is invalid or has expired. <a href="/forgot-password">Request a new one</a>.</p>
    {:else}
      {#if form?.error}<p class="auth__err" role="alert">{form.error}</p>{/if}
      <label class="auth__field"><span>New password</span><input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>
      <button class="auth__btn" type="submit">Update password</button>
    {/if}
    <p class="auth__links"><a href="/login">Back to sign in</a></p>
  </form>
</div>

${authStyle}
`

  // --- admin user management (userAdmin flag: DB-backed + RBAC) ---
  const usersServerTs = `import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad, RequestEvent } from './$types'
import { getServerRole, canScreen, ROLES } from '$lib/access'
import { listUsers, createUser, setUserRole, deleteUser } from '$lib/server/users'

// Only a full-access role (screens: '*') may manage users.
function guard(event: RequestEvent): void {
  if (!canScreen(getServerRole(event), '__users__')) throw redirect(302, '/')
}

export const load: PageServerLoad = async (event) => {
  guard(event)
  return { users: await listUsers(), roles: ROLES }
}

export const actions: Actions = {
  create: async (event) => {
    guard(event)
    const form = await event.request.formData()
    const email = String(form.get('email') ?? '')
    const name = String(form.get('name') ?? '')
    const password = String(form.get('password') ?? '')
    const role = String(form.get('role') ?? ROLES[0])
    if (!email.trim() || !name.trim() || password.length < 8) return fail(400, { error: 'Name, email, and an 8+ character password are required.' })
    if (!(await createUser({ email, name, password, role }))) return fail(409, { error: 'That email already exists.' })
    return { ok: 'created' }
  },
  role: async (event) => {
    guard(event)
    const form = await event.request.formData()
    await setUserRole(String(form.get('email') ?? ''), String(form.get('role') ?? ''))
    return { ok: 'updated' }
  },
  remove: async (event) => {
    guard(event)
    await deleteUser(String((await event.request.formData()).get('email') ?? ''))
    return { ok: 'removed' }
  },
}
`
  const usersPage = `<script lang="ts">
  import { enhance } from '$app/forms'
  let { data, form } = $props()
</script>

<h1 class="st__title">Users</h1>
{#if form?.error}<p class="usr__msg usr__msg--err" role="alert">{form.error}</p>{/if}
<div class="usr">
  <table class="usr__table">
    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
    <tbody>
      {#each data.users as u (u.email)}
        <tr>
          <td>{u.name}</td>
          <td>{u.email}</td>
          <td>
            <form method="POST" action="?/role" use:enhance>
              <input type="hidden" name="email" value={u.email} />
              <select name="role" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
                {#each data.roles as r (r)}<option value={r} selected={r === u.role}>{r}</option>{/each}
              </select>
            </form>
          </td>
          <td>
            <form method="POST" action="?/remove" use:enhance>
              <input type="hidden" name="email" value={u.email} />
              <button class="usr__del" type="submit">Remove</button>
            </form>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <form method="POST" action="?/create" use:enhance class="usr__add">
    <h2 class="usr__h">Add user</h2>
    <input name="name" placeholder="Name" required />
    <input name="email" type="email" placeholder="Email" required />
    <input name="password" type="password" placeholder="Password (8+)" minlength="8" required />
    <select name="role">{#each data.roles as r (r)}<option value={r}>{r}</option>{/each}</select>
    <button class="usr__btn" type="submit">Add user</button>
  </form>
</div>

<style>
  .usr { display: flex; flex-direction: column; gap: 18px; margin-top: 14px; }
  .usr__table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .usr__table th { text-align: left; padding: 8px 10px; color: var(--sg-muted, #64748b); font-weight: 600; border-bottom: 1px solid var(--sg-border, #e6e8ec); }
  .usr__table td { padding: 7px 10px; border-bottom: 1px solid var(--sg-border, #f1f5f9); }
  .usr__table select { padding: 5px 8px; font: inherit; font-size: 13px; border: 1px solid var(--sg-input-border, #e6e8ec); border-radius: 7px; background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); }
  .usr__del { padding: 4px 10px; font: inherit; font-size: 12.5px; color: #dc2626; background: none; border: 1px solid color-mix(in srgb, #dc2626 40%, var(--sg-border, #e6e8ec)); border-radius: 7px; cursor: pointer; }
  .usr__add { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 16px; border: 1px solid var(--sg-border, #e6e8ec); border-radius: 12px; background: var(--sg-bg, #fff); }
  .usr__h { width: 100%; margin: 0 0 4px; font-size: 15px; }
  .usr__add input, .usr__add select { padding: 8px 10px; font: inherit; font-size: 13.5px; border: 1px solid var(--sg-input-border, #e6e8ec); border-radius: 8px; background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); }
  .usr__btn { padding: 8px 16px; font: inherit; font-size: 13.5px; font-weight: 620; color: var(--sg-on-accent, #fff); background: var(--sg-accent, #6366f1); border: none; border-radius: 8px; cursor: pointer; }
  .usr__msg { margin: 0 0 10px; padding: 8px 11px; border-radius: 9px; font-size: 13px; }
  .usr__msg--err { color: var(--sg-danger, #b3261e); background: color-mix(in srgb, var(--sg-danger, #dc2626) 9%, var(--sg-bg, #fff)); border: 1px solid color-mix(in srgb, var(--sg-danger, #dc2626) 35%, var(--sg-border, #e6e8ec)); }
</style>
`

  // --- real email (Resend HTTP / SMTP nodemailer / dev console) ---
  const emailTs = `// Regenerated by SvGrid Studio. Email delivery: Resend (HTTP API, works on edge) or
// SMTP (nodemailer, Node runtimes). Logs to the console in dev when neither is set.
import { env } from '$env/dynamic/private'

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const from = env.EMAIL_FROM || 'onboarding@resend.dev'
  if (env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) throw new Error('Resend send failed: ' + res.status + ' ' + (await res.text()))
    return
  }
  if (env.SMTP_HOST) {
    // Dynamic import so edge builds (Resend, or no email) never bundle nodemailer.
    const nodemailer = (await import('nodemailer')).default
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT ?? 587),
      secure: env.SMTP_SECURE === 'true',
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
    await transport.sendMail({ from, to, subject, html })
    return
  }
  console.log('[email] (dev - set RESEND_API_KEY or SMTP_* to send) To: ' + to + ' | ' + subject + '\\n' + html)
}
`

  // --- email 2FA verify step ---
  const verifyServerTs = `import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { SESSION_COOKIE, SESSION_MAX_AGE, TFA_COOKIE, readChallenge, signSession } from '$lib/server/auth'
import { findUser } from '$lib/server/users'

export const load: PageServerLoad = async ({ cookies }) => {
  if (!cookies.get(TFA_COOKIE)) throw redirect(302, '/login')
  return {}
}

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const code = String((await request.formData()).get('code') ?? '')
    const email = await readChallenge(cookies.get(TFA_COOKIE), code)
    if (!email) return fail(401, { error: 'That code is invalid or has expired.' })
    const user = await findUser(email)
    if (!user) return fail(401, { error: 'Account not found.' })
    cookies.delete(TFA_COOKIE, { path: '/' })
    cookies.set(SESSION_COOKIE, await signSession({ email: user.email, name: user.name, role: user.role }), {
      path: '/', httpOnly: true, sameSite: 'lax', secure: url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', maxAge: SESSION_MAX_AGE,
    })
    throw redirect(302, url.searchParams.get('redirectTo') || '/')
  },
}
`
  const verifyPage = `<script lang="ts">
  import { enhance } from '$app/forms'
  let { form } = $props()
</script>

<div class="auth">
  <form method="POST" use:enhance class="auth__card">
    <h1 class="auth__title">Enter your code</h1>
    <p class="auth__sub">We emailed you a 6-digit verification code.</p>
    {#if form?.error}<p class="auth__err" role="alert">{form.error}</p>{/if}
    <label class="auth__field"><span>Code</span><input name="code" inputmode="numeric" autocomplete="one-time-code" required /></label>
    <button class="auth__btn" type="submit">Verify</button>
    <p class="auth__links"><a href="/login">Back to sign in</a></p>
  </form>
</div>

${authStyle}
`

  // --- OAuth / OIDC (dependency-free authorization-code + PKCE) ---
  const providerSet = `new Set<Provider>([${oauthProviders.map((p) => JSON.stringify(p)).join(', ')}])`
  const oauthTs = `// Regenerated by SvGrid Studio. Dependency-free OAuth 2.0 / OpenID Connect sign-in
// (authorization-code + PKCE). Set each provider's client id/secret in the environment;
// register the redirect URI <origin>/auth/<provider>/callback with the provider.
import { env } from '$env/dynamic/private'

export type Provider = 'github' | 'google' | 'oidc'
type Endpoints = { authorize: string; token: string; userinfo: string }
export type ProviderConfig = { clientId: string; clientSecret: string; scope: string; pkce: boolean; endpoints: Endpoints }

function b64url(bytes: ArrayBuffer): string {
  const b = new Uint8Array(bytes)
  let s = ''
  for (const byte of b) s += String.fromCharCode(byte)
  return btoa(s).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '')
}
export function randomToken(): string { return b64url(crypto.getRandomValues(new Uint8Array(32)).buffer) }
export async function pkceChallenge(verifier: string): Promise<string> {
  return b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
}

async function endpointsFor(provider: Provider): Promise<Endpoints> {
  if (provider === 'github') return { authorize: 'https://github.com/login/oauth/authorize', token: 'https://github.com/login/oauth/access_token', userinfo: 'https://api.github.com/user' }
  if (provider === 'google') return { authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', userinfo: 'https://openidconnect.googleapis.com/v1/userinfo' }
  // Generic OIDC (Azure AD / Entra, Okta, Auth0, Keycloak): discover from OIDC_ISSUER.
  const issuer = (env.OIDC_ISSUER ?? '').replace(/\\/$/, '')
  const disc = (await (await fetch(issuer + '/.well-known/openid-configuration')).json()) as { authorization_endpoint: string; token_endpoint: string; userinfo_endpoint: string }
  return { authorize: disc.authorization_endpoint, token: disc.token_endpoint, userinfo: disc.userinfo_endpoint }
}

export async function providerConfig(provider: Provider): Promise<ProviderConfig> {
  const prefix = provider.toUpperCase()
  return {
    clientId: env[prefix + '_CLIENT_ID'] ?? '',
    clientSecret: env[prefix + '_CLIENT_SECRET'] ?? '',
    scope: provider === 'github' ? 'read:user user:email' : 'openid email profile',
    pkce: provider !== 'github',
    endpoints: await endpointsFor(provider),
  }
}

export type OAuthProfile = { email: string; name: string }
export async function fetchProfile(provider: Provider, accessToken: string, userinfo: string): Promise<OAuthProfile | null> {
  const headers = { authorization: 'Bearer ' + accessToken, accept: 'application/json', 'user-agent': 'svgrid-app' }
  const data = (await (await fetch(userinfo, { headers })).json()) as Record<string, unknown>
  let email = typeof data.email === 'string' ? data.email : ''
  const name = typeof data.name === 'string' ? data.name : (typeof data.login === 'string' ? data.login : email)
  if (provider === 'github' && !email) {
    const emails = (await (await fetch('https://api.github.com/user/emails', { headers })).json()) as Array<{ email: string; primary: boolean; verified: boolean }>
    email = (emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified))?.email ?? ''
  }
  return email ? { email: email.toLowerCase(), name: name || email } : null
}
`
  const oauthLoginServerTs = `import { error, redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { providerConfig, randomToken, pkceChallenge, type Provider } from '$lib/server/oauth'

const PROVIDERS = ${providerSet}

export const GET: RequestHandler = async ({ params, url, cookies }) => {
  const provider = params.provider as Provider
  if (!PROVIDERS.has(provider)) throw error(404)
  const cfg = await providerConfig(provider)
  if (!cfg.clientId) throw error(500, provider + ' sign-in is not configured (set ' + provider.toUpperCase() + '_CLIENT_ID).')
  const secure = url.protocol === 'https:'
  const state = randomToken()
  cookies.set('oauth_state', state, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 600, secure })
  const q = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: url.origin + '/auth/' + provider + '/callback', response_type: 'code', scope: cfg.scope, state })
  if (cfg.pkce) {
    const verifier = randomToken()
    cookies.set('oauth_verifier', verifier, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 600, secure })
    q.set('code_challenge', await pkceChallenge(verifier))
    q.set('code_challenge_method', 'S256')
  }
  throw redirect(302, cfg.endpoints.authorize + '?' + q.toString())
}
`
  const oauthCallbackServerTs = `import { error, redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { providerConfig, fetchProfile, type Provider } from '$lib/server/oauth'
import { findUser, createUser } from '$lib/server/users'
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from '$lib/server/auth'

const PROVIDERS = ${providerSet}

export const GET: RequestHandler = async ({ params, url, cookies }) => {
  const provider = params.provider as Provider
  if (!PROVIDERS.has(provider)) throw error(404)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state || state !== cookies.get('oauth_state')) throw error(400, 'Invalid OAuth state.')
  const cfg = await providerConfig(provider)
  const body = new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, code, redirect_uri: url.origin + '/auth/' + provider + '/callback', grant_type: 'authorization_code' })
  const verifier = cookies.get('oauth_verifier')
  if (cfg.pkce && verifier) body.set('code_verifier', verifier)
  const tokenRes = await fetch(cfg.endpoints.token, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body })
  if (!tokenRes.ok) throw error(502, 'OAuth token exchange failed.')
  const token = (await tokenRes.json()) as { access_token?: string }
  if (!token.access_token) throw error(502, 'No access token returned.')
  const profile = await fetchProfile(provider, token.access_token, cfg.endpoints.userinfo)
  if (!profile) throw error(502, 'Could not read a verified email from the provider.')
  cookies.delete('oauth_state', { path: '/' })
  cookies.delete('oauth_verifier', { path: '/' })
  let user = await findUser(profile.email)
  if (!user) user = await createUser({ email: profile.email, name: profile.name, password: crypto.randomUUID() + crypto.randomUUID(), role: ${JSON.stringify(registerRole)} })
  if (!user) throw error(500, 'Could not create your account.')
  cookies.set(SESSION_COOKIE, await signSession({ email: user.email, name: user.name, role: user.role }), {
    path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: SESSION_MAX_AGE,
  })
  throw redirect(302, '/')
}
`

  // NOTE: SESSION_SECRET is added to the shared .env.example by envExample() (which
  // scans the generated source), so it merges with DATABASE_URL etc. - no duplicate file.
  return [
    { path: 'src/lib/server/auth.ts', description: 'Session + password crypto (Web Crypto, dependency-free).', contents: authTs },
    { path: 'src/lib/server/users.ts', description: 'Demo user store (replace with your own).', contents: usersTs },
    { path: 'src/hooks.server.ts', description: 'Resolves the session into event.locals on every request.', contents: hooksTs },
    { path: 'src/auth.d.ts', description: 'App.Locals augmentation (user + role).', contents: localsDts },
    { path: 'src/routes/+layout.server.ts', description: 'Exposes user/role to pages; guards routes.', contents: layoutServerTs },
    { path: 'src/routes/login/+page.svelte', description: 'Sign-in page.', contents: loginPage },
    { path: 'src/routes/login/+page.server.ts', description: 'Sign-in form action.', contents: loginServerTs },
    { path: 'src/routes/logout/+page.server.ts', description: 'Sign-out action.', contents: logoutServerTs },
    ...(emailReal ? [{ path: 'src/lib/server/email.ts', description: 'Email delivery (Resend / SMTP / dev console).', contents: emailTs }] : []),
    ...(twoFactor ? [
      { path: 'src/routes/login/verify/+page.svelte', description: 'Two-factor code entry.', contents: verifyPage },
      { path: 'src/routes/login/verify/+page.server.ts', description: 'Two-factor verify action.', contents: verifyServerTs },
    ] : []),
    ...(oauthProviders.length ? [
      { path: 'src/lib/server/oauth.ts', description: 'OAuth / OIDC providers + PKCE helpers.', contents: oauthTs },
      { path: 'src/routes/auth/[provider]/+server.ts', description: 'OAuth: start the sign-in redirect.', contents: oauthLoginServerTs },
      { path: 'src/routes/auth/[provider]/callback/+server.ts', description: 'OAuth: handle the provider callback.', contents: oauthCallbackServerTs },
    ] : []),
    ...(dbBacked ? [
      { path: 'src/routes/account/+page.svelte', description: 'Account: change password.', contents: accountPage },
      { path: 'src/routes/account/+page.server.ts', description: 'Change-password action.', contents: accountServerTs },
    ] : []),
    ...(register ? [
      { path: 'src/routes/register/+page.svelte', description: 'Sign-up page.', contents: registerPage },
      { path: 'src/routes/register/+page.server.ts', description: 'Sign-up action.', contents: registerServerTs },
      { path: 'src/routes/forgot-password/+page.svelte', description: 'Request a password reset.', contents: forgotPage },
      { path: 'src/routes/forgot-password/+page.server.ts', description: 'Send a reset link.', contents: forgotServerTs },
      { path: 'src/routes/reset-password/+page.svelte', description: 'Set a new password from a reset link.', contents: resetPage },
      { path: 'src/routes/reset-password/+page.server.ts', description: 'Apply a password reset.', contents: resetServerTs },
    ] : []),
    ...(userAdmin ? [
      { path: 'src/routes/users/+page.svelte', description: 'Admin: user management.', contents: usersPage },
      { path: 'src/routes/users/+page.server.ts', description: 'User-management actions (role-gated).', contents: usersServerTs },
    ] : []),
  ]
}

/** Escape a string for safe use as literal text inside emitted Svelte markup. */
function jsStrHtml(s: string): string {
  return s.replace(/[&<>{}]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '{': '&#123;', '}': '&#125;' }[c]!))
}

// --- Typed data layer (Drizzle ORM + drizzle-kit migrations) ----------------
type DzDialect = 'postgres' | 'mysql' | 'sqlite' | 'turso'
/** Per-dialect Drizzle wiring. `returning` marks dialects that support INSERT/UPDATE
 *  ... RETURNING (postgres / sqlite / turso); MySQL doesn't, so its repos re-select.
 *  MSSQL is absent because Drizzle ORM has no SQL Server driver - it keeps the raw route. */
const DZ: Record<DzDialect, { kit: string; table: string; core: string; client: string; setup: string; creds: string; returning: boolean }> = {
  postgres: {
    kit: 'postgresql', table: 'pgTable', core: 'drizzle-orm/pg-core', returning: true,
    client: "import { drizzle } from 'drizzle-orm/node-postgres'\nimport pg from 'pg'",
    setup: 'const pool = new pg.Pool({ connectionString: env.DATABASE_URL })\nexport const db = drizzle(pool, { schema })',
    creds: 'dbCredentials: { url: process.env.DATABASE_URL! }',
  },
  mysql: {
    kit: 'mysql', table: 'mysqlTable', core: 'drizzle-orm/mysql-core', returning: false,
    client: "import { drizzle } from 'drizzle-orm/mysql2'\nimport mysql from 'mysql2/promise'",
    setup: "const pool = mysql.createPool(env.DATABASE_URL ?? '')\nexport const db = drizzle(pool, { schema, mode: 'default' })",
    creds: 'dbCredentials: { url: process.env.DATABASE_URL! }',
  },
  sqlite: {
    kit: 'sqlite', table: 'sqliteTable', core: 'drizzle-orm/sqlite-core', returning: true,
    client: "import { drizzle } from 'drizzle-orm/better-sqlite3'\nimport Database from 'better-sqlite3'",
    setup: "const sqlite = new Database(env.DATABASE_URL ?? 'data.db')\nexport const db = drizzle(sqlite, { schema })",
    creds: "dbCredentials: { url: process.env.DATABASE_URL ?? 'data.db' }",
  },
  turso: {
    kit: 'turso', table: 'sqliteTable', core: 'drizzle-orm/sqlite-core', returning: true,
    client: "import { drizzle } from 'drizzle-orm/libsql'\nimport { createClient } from '@libsql/client'",
    setup: "const client = createClient({ url: env.DATABASE_URL ?? '', authToken: env.DATABASE_AUTH_TOKEN })\nexport const db = drizzle(client, { schema })",
    creds: 'dbCredentials: { url: process.env.DATABASE_URL!, authToken: process.env.DATABASE_AUTH_TOKEN }',
  },
}

/** Normalize a Studio SQL dialect to a Drizzle-supported one, or null if unsupported. */
function dzDialect(dialect: string | undefined): DzDialect | null {
  if (dialect === 'supabase' || dialect === 'postgres' || dialect == null) return 'postgres'
  if (dialect === 'mysql') return 'mysql'
  if (dialect === 'sqlite') return 'sqlite'
  if (dialect === 'turso') return 'turso'
  return null // mssql: Drizzle ORM has no SQL Server driver - stays on the raw route
}

/** A safe JS identifier for a Drizzle table export (e.g. `orderItems`). */
function dzTableVar(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
  const id = (parts[0] ?? 'table').toLowerCase() + parts.slice(1).map((w) => w[0]!.toUpperCase() + w.slice(1)).join('')
  return /^[0-9]/.test(id) ? 't' + id : id || 'table'
}

/** The Drizzle column expression for a field + the core import(s) it needs. */
function dzColumn(dialect: DzDialect, field: EntityField, colName: string, isPk: boolean, pkIsNumber: boolean): { expr: string; imports: string[] } {
  const q = JSON.stringify(colName)
  if (isPk) {
    if (dialect === 'postgres') return pkIsNumber ? { expr: `serial(${q}).primaryKey()`, imports: ['serial'] } : { expr: `text(${q}).primaryKey()`, imports: ['text'] }
    if (dialect === 'mysql') return pkIsNumber ? { expr: `int(${q}).autoincrement().primaryKey()`, imports: ['int'] } : { expr: `varchar(${q}, { length: 255 }).primaryKey()`, imports: ['varchar'] }
    // sqlite / turso
    return pkIsNumber ? { expr: `integer(${q}).primaryKey({ autoIncrement: true })`, imports: ['integer'] } : { expr: `text(${q}).primaryKey()`, imports: ['text'] }
  }
  if (dialect === 'postgres') {
    switch (field.type) {
      case 'number': return { expr: `doublePrecision(${q})`, imports: ['doublePrecision'] }
      case 'boolean': return { expr: `boolean(${q})`, imports: ['boolean'] }
      case 'date': return { expr: `date(${q})`, imports: ['date'] }
      case 'datetime': return { expr: `timestamp(${q}, { withTimezone: true })`, imports: ['timestamp'] }
      case 'json': return { expr: `jsonb(${q})`, imports: ['jsonb'] }
      default: return { expr: `text(${q})`, imports: ['text'] }
    }
  }
  if (dialect === 'mysql') {
    switch (field.type) {
      case 'number': return { expr: `double(${q})`, imports: ['double'] }
      case 'boolean': return { expr: `boolean(${q})`, imports: ['boolean'] }
      case 'date': return { expr: `date(${q})`, imports: ['date'] }
      case 'datetime': return { expr: `datetime(${q})`, imports: ['datetime'] }
      case 'json': return { expr: `json(${q})`, imports: ['json'] }
      default: return { expr: `varchar(${q}, { length: 255 })`, imports: ['varchar'] }
    }
  }
  // sqlite / turso
  switch (field.type) {
    case 'number': return { expr: `real(${q})`, imports: ['real'] }
    case 'boolean': return { expr: `integer(${q}, { mode: 'boolean' })`, imports: ['integer'] }
    case 'json': return { expr: `text(${q}, { mode: 'json' })`, imports: ['text'] }
    default: return { expr: `text(${q})`, imports: ['text'] }
  }
}

/** The Drizzle `auth_users` table (added when auth + data layer are both on): the
 *  DB-backed user store the login flow reads. Fixed shape: id, unique email, name,
 *  role, passwordHash. Returns the table block + the core imports it needs. */
function dzUsersTable(dialect: DzDialect, tableFn: string, with2fa = false): { block: string; imports: string[] } {
  const tail = '\n})\nexport type AuthUserRow = typeof authUsers.$inferSelect\nexport type AuthUserNew = typeof authUsers.$inferInsert'
  if (dialect === 'postgres') {
    const tfa = with2fa ? '\n  "twoFactor": boolean("two_factor").notNull().default(false),' : ''
    return {
      imports: [tableFn, 'serial', 'text', ...(with2fa ? ['boolean'] : [])],
      block: `export const authUsers = ${tableFn}("auth_users", {\n  "id": serial("id").primaryKey(),\n  "email": text("email").notNull().unique(),\n  "name": text("name").notNull(),\n  "role": text("role").notNull(),\n  "passwordHash": text("password_hash").notNull(),${tfa}${tail}`,
    }
  }
  if (dialect === 'mysql') {
    const tfa = with2fa ? '\n  "twoFactor": boolean("two_factor").notNull().default(false),' : ''
    return {
      imports: [tableFn, 'int', 'varchar', ...(with2fa ? ['boolean'] : [])],
      block: `export const authUsers = ${tableFn}("auth_users", {\n  "id": int("id").autoincrement().primaryKey(),\n  "email": varchar("email", { length: 320 }).notNull().unique(),\n  "name": varchar("name", { length: 255 }).notNull(),\n  "role": varchar("role", { length: 64 }).notNull(),\n  "passwordHash": varchar("password_hash", { length: 255 }).notNull(),${tfa}${tail}`,
    }
  }
  // sqlite / turso
  const tfa = with2fa ? "\n  \"twoFactor\": integer(\"two_factor\", { mode: 'boolean' }).notNull().default(false)," : ''
  return {
    imports: [tableFn, 'integer', 'text'],
    block: `export const authUsers = ${tableFn}("auth_users", {\n  "id": integer("id").primaryKey({ autoIncrement: true }),\n  "email": text("email").notNull().unique(),\n  "name": text("name").notNull(),\n  "role": text("role").notNull(),\n  "passwordHash": text("password_hash").notNull(),${tfa}${tail}`,
  }
}

/** The typed Drizzle data layer (emitted when `project.dataLayer === 'drizzle'` and
 *  there's a SQL-bound entity on a supported dialect): a schema (the source of truth
 *  for drizzle-kit migrations), a client, a typed repository per entity, and the
 *  drizzle.config.ts. The connected `+server.ts` routes read the same tables. */
function dataLayerFiles(project: StudioProject, sqlEntities: EntitySchema[], sources: Record<string, EntityDataSource>, includeUsers = false, usersTwoFactor = false): GeneratedFile[] {
  const firstSql = sources[sqlEntities[0]!.name]
  const dialect = dzDialect(firstSql?.kind === 'sql' ? firstSql.dialect : undefined)
  if (!dialect) return [] // MSSQL: raw route only (Drizzle has no SQL Server driver)
  const cfg = DZ[dialect]

  // schema.ts - one table per SQL entity + inferred row / insert types.
  const colImports = new Set<string>([cfg.table])
  const tableBlocks: string[] = []
  const meta: Array<{ e: EntitySchema; tableVar: string; pkKey: string; pkNumber: boolean }> = []
  for (const e of sqlEntities) {
    const src = sources[e.name]
    const table = (src?.kind === 'sql' ? src.table : undefined) ?? e.name
    const pk = e.idField ?? e.fields.find((f) => f.primaryKey)?.field ?? 'id'
    const pkField = e.fields.find((f) => f.field === pk)
    const pkNumber = pkField?.type === 'number'
    const tableVar = dzTableVar(e.name)
    const type = namesFor(e).type
    const cols = e.fields.map((f) => {
      const c = dzColumn(dialect, f, f.dbColumn ?? f.field, f.field === pk, pkNumber)
      c.imports.forEach((i) => colImports.add(i))
      return `  ${JSON.stringify(f.field)}: ${c.expr},`
    })
    tableBlocks.push(`export const ${tableVar} = ${cfg.table}(${JSON.stringify(table)}, {\n${cols.join('\n')}\n})\nexport type ${type}Row = typeof ${tableVar}.$inferSelect\nexport type ${type}New = typeof ${tableVar}.$inferInsert`)
    meta.push({ e, tableVar, pkKey: pk, pkNumber })
  }
  // Auth: the DB-backed user store lives in the same schema (so one migration covers it).
  if (includeUsers) {
    const u = dzUsersTable(dialect, cfg.table, usersTwoFactor)
    u.imports.forEach((i) => colImports.add(i))
    tableBlocks.push(u.block)
  }
  const schemaTs = `// Regenerated by SvGrid Studio. Typed database schema (Drizzle ORM) - the source of
// truth for migrations: edit here, then run \`npm run db:generate\` && \`npm run db:migrate\`.
import { ${[...colImports].sort().join(', ')} } from '${cfg.core}'

${tableBlocks.join('\n\n')}
`

  const indexTs = `// Regenerated by SvGrid Studio. The Drizzle client (reads DATABASE_URL).
${cfg.client}
import { env } from '$env/dynamic/private'
import * as schema from './schema'

${cfg.setup}
export { schema }
`

  const repoFiles = meta.map(({ e, tableVar, pkKey, pkNumber }) => {
    const type = namesFor(e).type
    const idT = pkNumber ? 'number' : 'string'
    // MySQL has no RETURNING, so create/update re-select the row after writing.
    const crud = cfg.returning
      ? `export const ${tableVar}Repo = {
  list: (): Promise<${type}Row[]> => db.select().from(${tableVar}),
  get: async (id: ${idT}): Promise<${type}Row | undefined> =>
    (await db.select().from(${tableVar}).where(eq(${tableVar}.${pkKey}, id))).at(0),
  create: async (values: ${type}New): Promise<${type}Row> =>
    (await db.insert(${tableVar}).values(values).returning()).at(0)!,
  update: async (id: ${idT}, values: Partial<${type}New>): Promise<${type}Row | undefined> =>
    (await db.update(${tableVar}).set(values).where(eq(${tableVar}.${pkKey}, id)).returning()).at(0),
  remove: async (id: ${idT}): Promise<void> => {
    await db.delete(${tableVar}).where(eq(${tableVar}.${pkKey}, id))
  },
}`
      : `async function getById(id: ${idT}): Promise<${type}Row | undefined> {
  return (await db.select().from(${tableVar}).where(eq(${tableVar}.${pkKey}, id))).at(0)
}

export const ${tableVar}Repo = {
  list: (): Promise<${type}Row[]> => db.select().from(${tableVar}),
  get: getById,
  // MySQL: no RETURNING - re-select by the new/insertId after the write.
  create: async (values: ${type}New): Promise<${type}Row> => {
    const res = await db.insert(${tableVar}).values(values)
    const id = ((values as Record<string, unknown>).${pkKey} ?? (res as unknown as Array<{ insertId: number }>)[0]?.insertId) as ${idT}
    return (await getById(id))!
  },
  update: async (id: ${idT}, values: Partial<${type}New>): Promise<${type}Row | undefined> => {
    await db.update(${tableVar}).set(values).where(eq(${tableVar}.${pkKey}, id))
    return getById(id)
  },
  remove: async (id: ${idT}): Promise<void> => {
    await db.delete(${tableVar}).where(eq(${tableVar}.${pkKey}, id))
  },
}`
    return {
      path: `src/lib/server/db/${namesFor(e).route}.ts`,
      description: `Typed repository for ${namesFor(e).label} (Drizzle).`,
      contents: `// Regenerated by SvGrid Studio. Typed CRUD over the ${tableVar} table - call from
// server code, form actions, or your own API routes.
import { eq } from 'drizzle-orm'
import { db } from './index'
import { ${tableVar}, type ${type}Row, type ${type}New } from './schema'

${crud}
`,
    }
  })

  const configTs = `import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
  dialect: '${cfg.kit}',
  ${cfg.creds},
})
`

  return [
    { path: 'src/lib/server/db/schema.ts', description: 'Drizzle schema (migration source of truth).', contents: schemaTs },
    { path: 'src/lib/server/db/index.ts', description: 'Drizzle client.', contents: indexTs },
    ...repoFiles,
    { path: 'drizzle.config.ts', description: 'drizzle-kit config (migrations).', contents: configTs },
  ]
}

// --- Full runnable app (download / npm-install-and-run) ---------------------

const appSlug = (title: string): string =>
  (title || 'studio-app').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'studio-app'

/** The static SvelteKit + Vite scaffolding around the generated screens. */
const SCAFFOLD_STATIC: ReadonlyArray<GeneratedFile> = [
  { path: 'vite.config.ts', description: 'Vite config.', contents: `import { sveltekit } from '@sveltejs/kit/vite'\nimport { defineConfig } from 'vite'\n\nexport default defineConfig({ plugins: [sveltekit()] })\n` },
  { path: 'tsconfig.json', description: 'TypeScript config.', contents: `{\n  "extends": "./.svelte-kit/tsconfig.json",\n  "compilerOptions": {\n    "allowJs": true,\n    "checkJs": true,\n    "esModuleInterop": true,\n    "forceConsistentCasingInFileNames": true,\n    "resolveJsonModule": true,\n    "skipLibCheck": true,\n    "sourceMap": true,\n    "strict": true,\n    "moduleResolution": "bundler"\n  }\n}\n` },
  { path: 'src/app.html', description: 'HTML shell.', contents: `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    %sveltekit.head%\n  </head>\n  <body data-sveltekit-preload-data="hover">\n    <div style="display: contents">%sveltekit.body%</div>\n  </body>\n</html>\n` },
  { path: 'src/app.d.ts', description: 'SvelteKit app types.', contents: `declare global {\n  namespace App {}\n}\n\nexport {}\n` },
  { path: 'src/routes/+layout.ts', description: 'Client SPA (in-memory sources persist across navigation).', contents: `// In-memory sources are module singletons, so render as a client SPA. Move an\n// entity to SQL / Supabase and its /api route still runs server-side.\nexport const ssr = false\nexport const prerender = false\n` },
  // engine-strict=false: a mismatched Node `engines` range only warns, never hard-fails
  // `npm install` - important for sandboxes (StackBlitz WebContainer) whose Node version
  // may not satisfy every transitive dep. (npm 7+ installs peers by default, so no
  // auto-install-peers line - it's a pnpm-only key that makes npm log an "Unknown config" warn.)
  { path: '.npmrc', description: 'npm config.', contents: `engine-strict=false\n` },
  { path: '.gitignore', description: 'git ignore.', contents: `node_modules\n.svelte-kit\n/build\n.env\n.env.*\n!.env.example\n.DS_Store\n` },
]

const APP_CSS = `:root { --sg-accent: #4f46e5; color-scheme: light dark; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body { font-family: var(--sg-font, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif); color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff); }
.st__title { margin: 0; font-size: 22px; font-weight: 720; letter-spacing: -0.015em; }
.st__sub { margin: 0; font-size: 14px; line-height: 1.6; color: var(--sg-muted, #64748b); max-width: 74ch; }
.st__sub code { background: var(--sg-header-bg, #f1f5f9); padding: 1px 6px; border-radius: 5px; font-size: 0.9em; }
.st__toolbar { display: flex; align-items: center; gap: 10px; }
.st-hint { font-size: 12.5px; color: var(--sg-muted, #94a3b8); }
.st-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 0 0 16px; padding: 11px 14px; border: 1px solid color-mix(in srgb, var(--sg-danger, #dc2626) 40%, var(--sg-border, #e6e8ec)); border-radius: 10px; background: color-mix(in srgb, var(--sg-danger, #dc2626) 8%, var(--sg-bg, #fff)); color: var(--sg-danger, #b3261e); font-size: 13.5px; }
.st-btn { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; font: inherit; font-size: 13.5px; font-weight: 560; line-height: 1; border: 1px solid var(--sg-border, #e6e8ec); border-radius: 10px; background: var(--sg-bg, #fff); color: var(--sg-fg, inherit); cursor: pointer; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05); }
.st-btn:hover { background: color-mix(in srgb, var(--sg-fg, #0f172a) 5%, var(--sg-bg, #fff)); }
.st-btn:disabled { opacity: 0.5; cursor: default; box-shadow: none; }
.st-btn--primary { border-color: transparent; color: #fff; background: linear-gradient(180deg, color-mix(in srgb, var(--sg-accent) 88%, #fff), var(--sg-accent)); box-shadow: 0 1px 2px rgba(15, 23, 42, 0.14), 0 8px 18px -9px color-mix(in srgb, var(--sg-accent) 65%, transparent); }
.st-btn--primary:hover { filter: brightness(1.06); }
.home { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; margin-top: 6px; }
.home__card { display: flex; flex-direction: column; gap: 6px; padding: 18px; border: 1px solid var(--sg-border, #e6e8ec); border-radius: 14px; text-decoration: none; color: inherit; background: var(--sg-bg, #fff); box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05); }
.home__card:hover { border-color: color-mix(in srgb, var(--sg-accent) 45%, var(--sg-border, #e6e8ec)); }
.home__card strong { font-size: 15px; }
.home__card span { font-size: 13px; color: var(--sg-muted, #64748b); line-height: 1.5; }
.st-filter { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid var(--sg-border, #e6e8ec); border-radius: 12px; background: var(--sg-bg, #fff); align-self: start; }
.st-filter__title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--sg-muted, #64748b); }
.st-filter__row { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; font-weight: 600; color: var(--sg-muted, #64748b); }
.st-filter__row select, .st-filter__row input { padding: 7px 9px; font: inherit; font-size: 13px; font-weight: 400; color: var(--sg-fg, inherit); background: var(--sg-input-bg, var(--sg-bg, #fff)); border: 1px solid var(--sg-input-border, var(--sg-border, #e6e8ec)); border-radius: 8px; }
.st-record-card { border: 1px solid var(--sg-border, #e6e8ec); border-radius: 12px; background: var(--sg-bg, #fff); padding: 14px; align-self: start; }
.st-record { margin: 0; display: flex; flex-direction: column; gap: 8px; }
.st-record__row { display: grid; grid-template-columns: 40% 1fr; gap: 10px; align-items: baseline; border-bottom: 1px solid var(--sg-border, #f1f5f9); padding-bottom: 6px; }
.st-record__row dt { margin: 0; font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); }
.st-record__row dd { margin: 0; font-size: 13.5px; color: var(--sg-fg, inherit); overflow-wrap: anywhere; }
.st-screen { display: grid; grid-template-columns: repeat(12, 1fr); gap: 16px; align-items: start; }
/* Mobile: blocks stack full-width (a span-N block clamps to the single column). */
@media (max-width: 720px) { .st-screen { grid-template-columns: 1fr; gap: 12px; } }
/* Stack layout: every block full-width in a single flowing column (mobile-first). */
.st-stack { display: flex; flex-direction: column; gap: 16px; align-items: stretch; }
.st-stack > * { min-width: 0; width: 100%; }
@media (max-width: 720px) { .st-stack { gap: 12px; } }
/* Free-form canvas: blocks placed on a 12-column x fixed-row grid by cell coords. */
.st-canvas { display: grid; grid-template-columns: repeat(12, 1fr); grid-auto-rows: ${CANVAS_ROW_PX}px; gap: ${CANVAS_GAP_PX}px; align-items: stretch; }
.st-canvas__cell { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.st-canvas__cell > * { flex: 1; min-height: 0; }
/* Narrow: an absolute canvas can't reflow, so fall back to a single stacked column. */
@media (max-width: 720px) {
  .st-canvas { display: flex; flex-direction: column; gap: 12px; }
  .st-canvas__cell { grid-column: auto !important; grid-row: auto !important; min-height: ${CANVAS_ROW_PX * 4}px; }
}
/* Docking workspace: the SvDockManager fills a sized region (it owns its own scrolling). */
.st-dock { height: min(74vh, 900px); min-height: 420px; }
@media (max-width: 640px) { .st__title { font-size: 19px; } }
.st-rowactions { display: inline-flex; gap: 6px; }
.st-rowaction { padding: 3px 9px; font: inherit; font-size: 12px; font-weight: 550; line-height: 1.4; border: 1px solid var(--sg-border, #e6e8ec); border-radius: 7px; background: var(--sg-bg, #fff); color: var(--sg-fg, inherit); cursor: pointer; }
.st-rowaction:hover { background: color-mix(in srgb, var(--sg-fg, #0f172a) 5%, var(--sg-bg, #fff)); }
.st-rowaction--danger { color: #dc2626; border-color: color-mix(in srgb, #dc2626 40%, var(--sg-border, #e6e8ec)); }
.st-rowaction--danger:hover { background: color-mix(in srgb, #dc2626 8%, var(--sg-bg, #fff)); }
.st-cell-link { color: var(--sg-accent, #4f46e5); text-decoration: none; }
.st-cell-link:hover { text-decoration: underline; }
.st-cell-progress { display: flex; align-items: center; min-width: 80px; width: 100%; }
.st-grid-toolbar { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; margin-bottom: 8px; }
.st-treecell { display: inline-flex; align-items: center; gap: 4px; }
.st-tree-toggle { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; padding: 0; border: none; background: none; color: var(--sg-muted, #94a3b8); font-size: 11px; cursor: pointer; border-radius: 4px; }
.st-tree-toggle:hover { background: color-mix(in srgb, var(--sg-fg, #0f172a) 8%, transparent); color: var(--sg-fg, inherit); }
.st-tree-spacer { display: inline-block; width: 18px; }
`

/**
 * Deploy target -> the SvelteKit adapter + provider config the bundle ships, plus
 * the one-liner and dashboard link the designer's Deploy panel shows. `auto`
 * (the default) uses adapter-auto, which detects Vercel / Netlify / Cloudflare at
 * build time; picking a specific target pins the adapter and adds its config so a
 * `git push` (or the CLI one-liner) deploys with no further setup.
 */
type DeployPlan = {
  adapterModule: string
  adapterDep: [name: string, version: string]
  files: GeneratedFile[]
  /** Copy-paste command that deploys the app. */
  cli: string
  /** The npm `deploy` script command. */
  deployScript: string
  /** Provider "new project" dashboard link (for the import-from-Git path). */
  dashboard?: string
  /** GitHub repo secrets the deploy workflow needs (documented in DEPLOY.md). */
  secrets: string[]
  /** `.github/workflows/deploy.yml` body - a push-to-main deploy pipeline (steps
   *  gate on their secret so an unconfigured repo never fails CI). */
  deployWorkflow?: string
  label: string
}

// NOTE: the generated app ships without a package-lock.json, so the workflows use
// `npm install` (not `npm ci`) and omit setup-node's lockfile-dependent `cache: npm`
// - both hard-fail when no lockfile is present. Commit a lockfile later to speed CI up.
/** Universal CI: install + build + smoke tests on every push / PR. */
const CI_WORKFLOW = `name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - run: npm test
`

/** Wrap deploy steps in the standard checkout + node + install prelude. */
function deployWorkflow(steps: string): string {
  return `name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
${steps}`
}

function deployPlan(project: StudioProject): DeployPlan {
  const slug = appSlug(project.title)
  const target = project.deploy ?? 'auto'
  switch (target) {
    case 'vercel':
      return {
        adapterModule: '@sveltejs/adapter-vercel',
        adapterDep: ['@sveltejs/adapter-vercel', '^5.5.0'],
        files: [],
        cli: 'npx vercel --prod',
        deployScript: 'vercel deploy --prod',
        dashboard: 'https://vercel.com/new',
        label: 'Vercel',
        secrets: ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'],
        deployWorkflow: deployWorkflow(`      - name: Deploy to Vercel
        if: \${{ secrets.VERCEL_TOKEN != '' }}
        env:
          VERCEL_TOKEN: \${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: \${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: \${{ secrets.VERCEL_PROJECT_ID }}
        run: |
          npm i -g vercel
          vercel pull --yes --environment=production --token="$VERCEL_TOKEN"
          vercel build --prod --token="$VERCEL_TOKEN"
          vercel deploy --prebuilt --prod --token="$VERCEL_TOKEN"
`),
      }
    case 'netlify':
      return {
        adapterModule: '@sveltejs/adapter-netlify',
        adapterDep: ['@sveltejs/adapter-netlify', '^5.0.0'],
        files: [{ path: 'netlify.toml', description: 'Netlify build config.', contents: `[build]\n  command = "npm run build"\n` }],
        cli: 'npx netlify deploy --build --prod',
        deployScript: 'netlify deploy --build --prod',
        dashboard: 'https://app.netlify.com/start',
        label: 'Netlify',
        secrets: ['NETLIFY_AUTH_TOKEN', 'NETLIFY_SITE_ID'],
        deployWorkflow: deployWorkflow(`      - name: Deploy to Netlify
        if: \${{ secrets.NETLIFY_AUTH_TOKEN != '' }}
        env:
          NETLIFY_AUTH_TOKEN: \${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: \${{ secrets.NETLIFY_SITE_ID }}
        run: npx netlify deploy --build --prod
`),
      }
    case 'cloudflare':
      return {
        adapterModule: '@sveltejs/adapter-cloudflare',
        adapterDep: ['@sveltejs/adapter-cloudflare', '^7.0.0'],
        files: [{ path: 'wrangler.toml', description: 'Cloudflare Pages config.', contents: `name = "${slug}"\npages_build_output_dir = ".svelte-kit/cloudflare"\ncompatibility_date = "2024-11-01"\n` }],
        cli: 'npm run build && npx wrangler pages deploy .svelte-kit/cloudflare',
        deployScript: `npm run build && wrangler pages deploy .svelte-kit/cloudflare --project-name=${slug}`,
        dashboard: 'https://dash.cloudflare.com/?to=/:account/pages/new',
        label: 'Cloudflare Pages',
        secrets: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
        deployWorkflow: deployWorkflow(`      - run: npm run build
      - name: Deploy to Cloudflare Pages
        if: \${{ secrets.CLOUDFLARE_API_TOKEN != '' }}
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: npx wrangler pages deploy .svelte-kit/cloudflare --project-name=${slug}
`),
      }
    case 'node':
      return {
        adapterModule: '@sveltejs/adapter-node',
        adapterDep: ['@sveltejs/adapter-node', '^5.2.0'],
        files: [
          { path: 'Dockerfile', description: 'Container image (multi-stage: build then run `node build`).', contents: `# Build stage\nFROM node:20-alpine AS build\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nRUN npm run build\nRUN npm prune --omit=dev\n\n# Run stage\nFROM node:20-alpine\nWORKDIR /app\nENV NODE_ENV=production\nCOPY --from=build /app/build ./build\nCOPY --from=build /app/node_modules ./node_modules\nCOPY --from=build /app/package.json ./package.json\nEXPOSE 3000\nCMD ["node", "build"]\n` },
          { path: '.dockerignore', description: 'Files kept out of the image.', contents: `node_modules\n.svelte-kit\nbuild\n.env\n.env.*\n.git\n.github\n` },
        ],
        cli: 'npm run build && node build',
        deployScript: 'npm run build && node build',
        label: 'Node server',
        secrets: [],
      }
    default:
      return {
        adapterModule: '@sveltejs/adapter-auto',
        adapterDep: ['@sveltejs/adapter-auto', '^6.0.0'],
        files: [],
        cli: 'npx vercel --prod',
        deployScript: 'vercel deploy --prod',
        dashboard: 'https://vercel.com/new',
        label: 'Auto (Vercel / Netlify / Cloudflare)',
        secrets: [],
      }
  }
}

/** The deploy facts the designer's Deploy panel shows (label, CLI one-liner, dashboard link). */
export function studioDeployInfo(project: StudioProject): { label: string; cli: string; dashboard?: string; adapter: string; secrets: string[] } {
  const p = deployPlan(project)
  return { label: p.label, cli: p.cli, dashboard: p.dashboard, adapter: p.adapterModule, secrets: p.secrets }
}

/** DEPLOY.md - the runbook: required env vars, then Git-integration / CI / CLI paths. */
function deployDocs(project: StudioProject, plan: DeployPlan, envKeys: string[], hasMigrations: boolean): string {
  const envBlock = envKeys.length
    ? `## Environment variables\n\nSet these on your host (and locally in \`.env\` - copy \`.env.example\`):\n\n${envKeys.map((k) => `- \`${k}\``).join('\n')}\n\n`
    : ''
  const migrations = hasMigrations
    ? `## Database migrations\n\nThis app has a typed Drizzle schema (\`src/lib/server/db/schema.ts\`). Create + apply the tables:\n\n\`\`\`bash\nnpm run db:generate   # SQL migrations from the schema\nnpm run db:migrate    # apply them to DATABASE_URL\n\`\`\`\n\n(Run these against your production database as part of your release step.)\n\n`
    : ''
  const gitIntegration = plan.dashboard
    ? `## Option A - Git integration (simplest, no secrets)\n\n1. Push this repo to GitHub.\n2. Import it at <${plan.dashboard}> - the SvelteKit build is auto-detected.\n3. Add the environment variables above in the host's dashboard.\n\nEvery push to \`main\` then redeploys automatically.\n\n`
    : ''
  const ci = plan.deployWorkflow
    ? `## Option B - GitHub Actions (included)\n\n\`.github/workflows/deploy.yml\` deploys on every push to \`main\`. Add these repository secrets to enable it (Settings -> Secrets and variables -> Actions):\n\n${plan.secrets.map((s) => `- \`${s}\``).join('\n')}\n\nUntil the secrets are set the deploy step is skipped, so CI stays green. Prefer Option A? Delete \`deploy.yml\`.\n\n`
    : ''
  const dockerNote = project.deploy === 'node'
    ? `## Container\n\nA \`Dockerfile\` is included:\n\n\`\`\`bash\ndocker build -t ${appSlug(project.title)} .\ndocker run -p 3000:3000 --env-file .env ${appSlug(project.title)}\n\`\`\`\n\nThe server listens on \`PORT\` (default 3000).\n\n`
    : ''
  const cli = `## Option C - Deploy from your machine\n\n\`\`\`bash\nnpm run deploy\n\`\`\`\n\n(runs \`${plan.deployScript}\`)\n`
  return `# Deploying ${project.title}\n\nConfigured for **${plan.label}** (SvelteKit \`${plan.adapterModule}\`). A CI workflow (\`.github/workflows/ci.yml\`) builds + tests every push.\n\n${envBlock}${migrations}${gitIntegration}${ci}${dockerNote}${cli}`
}

/** The env-var keys the generated app reads (for DEPLOY.md). */
function envKeysUsed(allSource: string): string[] {
  const keys: string[] = []
  if (allSource.includes('env.DATABASE_URL')) keys.push('DATABASE_URL')
  if (allSource.includes('env.DATABASE_AUTH_TOKEN')) keys.push('DATABASE_AUTH_TOKEN')
  if (allSource.includes('SESSION_SECRET')) keys.push('SESSION_SECRET')
  return keys
}

/** A `.env.example` listing the env vars the generated code reads, when any. */
function envExample(allSource: string): string | null {
  const lines: string[] = []
  if (allSource.includes('env.DATABASE_URL')) {
    lines.push('# Your database connection string (Neon / Supabase / Postgres / MySQL / SQLite path).')
    lines.push('DATABASE_URL=')
  }
  if (allSource.includes('env.DATABASE_AUTH_TOKEN')) {
    lines.push('# Turso / libSQL database auth token.')
    lines.push('DATABASE_AUTH_TOKEN=')
  }
  if (allSource.includes('SESSION_SECRET')) {
    if (lines.length) lines.push('')
    lines.push('# Session signing secret - set a long random value in production.')
    lines.push('SESSION_SECRET=change-me-to-a-long-random-string')
  }
  if (allSource.includes("from '$lib/server/email'")) {
    lines.push('')
    lines.push('# Email delivery (for password reset / two-factor). Use EITHER Resend OR SMTP;')
    lines.push('# without either, emails are logged to the server console (dev).')
    lines.push('EMAIL_FROM=')
    lines.push('# RESEND_API_KEY=')
    lines.push('# SMTP_HOST=')
    lines.push('# SMTP_PORT=587')
    lines.push('# SMTP_USER=')
    lines.push('# SMTP_PASS=')
    lines.push('# SMTP_SECURE=false')
  }
  if (allSource.includes("from '$lib/server/oauth'")) {
    lines.push('')
    lines.push('# OAuth / OIDC sign-in. Fill in the providers you enabled; register the redirect')
    lines.push('# URI <origin>/auth/<provider>/callback with each provider.')
    if (allSource.includes("'github'") || allSource.includes('"github"')) { lines.push('# GITHUB_CLIENT_ID='); lines.push('# GITHUB_CLIENT_SECRET=') }
    if (allSource.includes("'google'") || allSource.includes('"google"')) { lines.push('# GOOGLE_CLIENT_ID='); lines.push('# GOOGLE_CLIENT_SECRET=') }
    if (allSource.includes("'oidc'") || allSource.includes('"oidc"')) { lines.push('# OIDC_ISSUER=  # e.g. https://login.microsoftonline.com/<tenant>/v2.0'); lines.push('# OIDC_CLIENT_ID='); lines.push('# OIDC_CLIENT_SECRET=') }
  }
  if (lines.length === 0) return null
  lines.push('')
  lines.push('# Optional: your SvGrid license key removes the unlicensed watermark.')
  lines.push('# VITE_SVPRO_KEY=')
  return lines.join('\n') + '\n'
}

function svelteConfig(plan: DeployPlan): string {
  return `import adapter from '${plan.adapterModule}'\nimport { vitePreprocess } from '@sveltejs/vite-plugin-svelte'\n\n/** @type {import('@sveltejs/kit').Config} */\nconst config = {\n  preprocess: vitePreprocess(),\n  kit: { adapter: adapter() },\n}\n\nexport default config\n`
}

function packageJson(project: StudioProject, allSource: string): string {
  const dependencies: Record<string, string> = { '@svgrid/grid': 'latest', '@svgrid/enterprise': 'latest' }
  if (allSource.includes("from '@supabase/supabase-js'")) dependencies['@supabase/supabase-js'] = '^2.45.0'
  if (allSource.includes("import pg from 'pg'")) dependencies['pg'] = '^8.11.0'
  if (allSource.includes("from 'mysql2/promise'")) dependencies['mysql2'] = '^3.9.0'
  if (allSource.includes("import mssql from 'mssql'")) dependencies['mssql'] = '^10.0.0'
  if (allSource.includes("import Database from 'better-sqlite3'")) dependencies['better-sqlite3'] = '^11.0.0'
  if (allSource.includes("from '@libsql/client'")) dependencies['@libsql/client'] = '^0.14.0'
  if (allSource.includes("from '@electric-sql/pglite'")) dependencies['@electric-sql/pglite'] = '^0.5.0'
  // Optional feature deps: only added when a generated file actually imports them, so a
  // basic app doesn't drag them in. Matches website/src/lib/stackblitz.ts OPTIONAL_DEPS.
  if (/from ['"]hyperformula['"]/.test(allSource)) dependencies['hyperformula'] = '^3.3.0'
  if (/from ['"]jszip['"]/.test(allSource)) dependencies['jszip'] = '^3.10.1'
  if (/from ['"]pdfmake(?:\/[^'"]*)?['"]/.test(allSource)) dependencies['pdfmake'] = '^0.2.10'
  // nodemailer is dynamically imported by the email layer only on the SMTP branch.
  const usesNodemailer = /import\(['"]nodemailer['"]\)/.test(allSource)
  if (usesNodemailer) dependencies['nodemailer'] = '^6.9.0'
  // Typed data layer: drizzle-orm at runtime, drizzle-kit (dev) for migrations + scripts.
  const drizzle = project.dataLayer === 'drizzle' && /from ['"]drizzle-orm(?:\/[^'"]*)?['"]/.test(allSource)
  if (drizzle) dependencies['drizzle-orm'] = '^0.44.0'
  const scripts: Record<string, string> = { dev: 'vite dev', build: 'vite build', preview: 'vite preview', check: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json', test: 'vitest run', deploy: deployPlan(project).deployScript }
  if (drizzle) {
    scripts['db:generate'] = 'drizzle-kit generate'
    scripts['db:migrate'] = 'drizzle-kit migrate'
    scripts['db:push'] = 'drizzle-kit push'
    scripts['db:studio'] = 'drizzle-kit studio'
  }
  const pkg = {
    name: appSlug(project.title),
    version: '0.0.1',
    private: true,
    type: 'module',
    scripts,
    dependencies,
    // Pinned to Vite 7 (Rollup) + vite-plugin-svelte 6, NOT Vite 8. Vite 8's native
    // Rolldown bundler crashes in StackBlitz's WebContainer ("Invalid atomic access
    // index"); Vite 7 + plugin 6 + SvelteKit 2.22 is the combo that boots there and
    // runs identically everywhere else. See website/src/lib/stackblitz.ts.
    devDependencies: {
      [deployPlan(project).adapterDep[0]]: deployPlan(project).adapterDep[1],
      '@sveltejs/kit': '^2.22.0',
      '@sveltejs/vite-plugin-svelte': '^6.0.0',
      svelte: '^5.55.5',
      'svelte-check': '^4.4.6',
      typescript: '^5.7.0',
      vite: '^7.0.0',
      vitest: '^4.1.5',
      // Driver typings so the connected route + data layer type-check cleanly.
      ...(dependencies['pg'] ? { '@types/pg': '^8.11.0' } : {}),
      ...(dependencies['better-sqlite3'] ? { '@types/better-sqlite3': '^7.6.0' } : {}),
      ...(usesNodemailer ? { '@types/nodemailer': '^6.4.0' } : {}),
      ...(drizzle ? { 'drizzle-kit': '^0.31.0' } : {}),
    },
  }
  return JSON.stringify(pkg, null, 2) + '\n'
}

/**
 * A per-entity smoke test shipped with the generated app. It proves the two
 * things a screen depends on still hold: every schema yields grid columns +
 * form fields (so the page renders), and the schema round-trips through the
 * data-source layer (create -> read -> delete). It builds a fresh in-memory
 * source from the schema, so it runs offline regardless of the real backend
 * (SQL / Supabase / PGlite) - a fast regression guard on schema edits.
 */
function smokeTestFile(project: StudioProject): string {
  const imports = project.entities.map((e) => {
    const n = namesFor(e)
    return `${n.schemaVar}, type ${n.type}`
  })
  const blocks = project.entities.map((e) => {
    const n = namesFor(e)
    return `describe(${JSON.stringify(n.label)}, () => {
  it('exposes grid columns and form fields', () => {
    expect(schemaToColumns(${n.schemaVar}).length).toBeGreaterThan(0)
    expect(schemaToFormFields(${n.schemaVar}).length).toBeGreaterThan(0)
  })

  it('round-trips create -> read -> delete through an in-memory source', async () => {
    const idField = ${n.schemaVar}.idField ?? ${n.schemaVar}.fields.find((f) => f.primaryKey)?.field ?? 'id'
    const source = createInMemoryDataSource<${n.type}>([], ${n.schemaVar})
    await source.createRow({ [idField]: 'smoke-1' } as unknown as Partial<${n.type}>)
    expect((await source.getRows({ startRow: 0, endRow: 100, pageIndex: 0, pageSize: 100, sortModel: [], filterModel: {} })).rowCount).toBe(1)
    await source.deleteRow('smoke-1')
    expect((await source.getRows({ startRow: 0, endRow: 100, pageIndex: 0, pageSize: 100, sortModel: [], filterModel: {} })).rowCount).toBe(0)
  })
})`
  })
  return `// Smoke tests generated by SvGrid Studio. Run with \`npm test\`.
// They prove every entity's schema still renders (grid columns + form fields)
// and round-trips through the data-source layer, so a schema edit that would
// break a screen fails here first. Regenerating the app refreshes this file.
import { describe, it, expect } from 'vitest'
import { schemaToColumns, schemaToFormFields, createInMemoryDataSource } from '@svgrid/enterprise'
import { ${imports.join(', ')} } from './schemas'

${blocks.join('\n\n')}
`
}

const VITEST_CONFIG = `import { defineConfig } from 'vitest/config'

// Node-only test runner for the generated smoke tests (no Svelte/DOM needed).
// Kept separate from vite.config so the SvelteKit plugin doesn't load here.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
`

/**
 * Emit the COMPLETE runnable SvelteKit + Vite app: the generated screens/data
 * plus all scaffolding (package.json, vite/svelte/ts config, app shell, css).
 * Download it, `npm install`, `npm run dev`. This is what the designer's
 * "Download .zip" produces.
 */
export function emitStudioAppBundle(project: StudioProject): GeneratedFile[] {
  const generated = emitStudioProject(project)
  const allSource = generated.map((f) => f.contents).join('\n')
  const plan = deployPlan(project)
  const deploySteps = plan.dashboard
    ? `1. Push this folder to a Git repo (GitHub / GitLab / Bitbucket).\n2. Import it at <${plan.dashboard}> - build settings are detected automatically.\n\nOr deploy straight from your machine with the CLI:\n\n\`\`\`bash\n${plan.cli}\n\`\`\``
    : `Build and run the server:\n\n\`\`\`bash\n${plan.cli}\n\`\`\``
  const readme = `# ${project.title}\n\nGenerated with SvGrid Studio.\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nSQL / Supabase entities read their connection from \`.env\` (\`DATABASE_URL\`) or\n\`src/lib/connections.ts\`. Everything else runs on seeded in-memory data.\n\n## Deploy (${plan.label})\n\nThis app is configured for **${plan.label}** (SvelteKit \`${plan.adapterModule}\`).\n\n${deploySteps}\n\nTo target a different host, pick another **Deploy target** in the designer and\nre-generate, or swap the adapter in \`svelte.config.js\`. Entities on **Local\ndatabase** (PGlite) or **In-memory** need no server env; SQL / Supabase entities\nneed their connection set in the host's environment variables.\n\n## Round-tripping back into the designer\n\nThis app ships its own design model in \`studio.config.json\`. To keep editing\nvisually, open the SvGrid Studio designer and **Load** that file - your entities,\nscreens, blocks, theme, RBAC, i18n, etc. come back exactly as generated, and you\ncan re-generate from there.\n\nThe designer regenerates the files under \`src/routes\` and \`src/lib\` from the\nmodel, so **keep your own custom code in new files/modules and import it**, rather\nthan editing the generated screens in place - that way a re-generate never\nclobbers your work. (The CLI workflow, \`npx @svgrid/studio add\`, is the\nalternative: it wraps generated code in \`svgrid:managed\` markers and preserves\nanything you write outside them.)\n`
  const scaffold: GeneratedFile[] = [
    { path: 'package.json', description: 'Dependencies + scripts (npm install, npm run dev).', contents: packageJson(project, allSource) },
    { path: 'svelte.config.js', description: `SvelteKit config (${plan.adapterModule}).`, contents: svelteConfig(plan) },
    { path: 'vitest.config.ts', description: 'Test runner config for the generated smoke tests (npm test).', contents: VITEST_CONFIG },
    { path: 'src/lib/schemas.test.ts', description: 'Smoke tests: every entity renders + round-trips through its data source.', contents: smokeTestFile(project) },
    ...plan.files,
    ...SCAFFOLD_STATIC,
    ...(envExample(allSource) ? [{ path: '.env.example', description: 'Environment variables the app reads (copy to .env and fill in).', contents: envExample(allSource)! }] : []),
    { path: 'src/app.css', description: 'App theme + page styles.', contents: APP_CSS },
    // Your styles: a dedicated CSS file the layout imports AFTER app.css, so its rules
    // win. Edited in the designer's Styles panel; regenerated from the model.
    { path: 'src/custom.css', description: 'Your custom styles (edited in the designer; imported after app.css so it overrides).', contents: `/* Your custom styles. Edit in the designer's Styles panel, or here after ejecting.\n   Imported after app.css, so these rules override the defaults. */\n${project.theme?.customCss ? `\n${project.theme.customCss}\n` : ''}` },
    // The design model, shipped with the app so it can be re-imported (Load) into
    // the designer for further visual editing - the export/import round-trip.
    { path: 'studio.config.json', description: 'The Studio project model - Load it back into the designer to keep editing visually.', contents: serializeProject(project) + '\n' },
    { path: 'README.md', description: 'How to run the app.', contents: readme },
    // CI/CD: a build+test pipeline always, a push-to-deploy pipeline when the target
    // has one, and a DEPLOY.md runbook.
    { path: '.github/workflows/ci.yml', description: 'CI: build + test on push / PR.', contents: CI_WORKFLOW },
    ...(plan.deployWorkflow ? [{ path: '.github/workflows/deploy.yml', description: `Deploy to ${plan.label} on push to main.`, contents: plan.deployWorkflow }] : []),
    { path: 'DEPLOY.md', description: 'Deploy runbook (env vars, Git integration, CI, CLI).', contents: deployDocs(project, plan, envKeysUsed(allSource), generated.some((f) => f.path === 'drizzle.config.ts')) },
  ]
  return [...scaffold, ...generated]
}
