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
import type { ActionConfig, Block, ComponentConfig, EntityDataSource, FilterPanelConfig, GridConfig, KpiConfig, PivotConfig, RecordConfig, RowAction, Screen, StudioProject } from './project.js'
import { blockColumns, blockStyleCss, blockClassName, sanitizeClassName, componentHandleName, entityDataSource, flattenBlocks, serializeProject, seedUsers, ON_LOAD, ON_DESTROY } from './project.js'
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

/** The visible grid columns: configured order, per-column header/width/align overrides, editability per mode. */
function gridColumnsExpr(schemaVar: string, block: Block): string {
  if (block.config.kind !== 'grid') return `schemaToColumns(${schemaVar})`
  const cfg = block.config
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

/** Markup for one block inside the screen grid. `ctx.hasRecord` tells a grid to
 *  publish its clicked row into `selectedRecord` for a sibling record panel. */
function blockMarkup(entity: EntitySchema, schemaVar: string, typeName: string, block: Block, resolve: (name: string) => EntitySchema | undefined, ctx: { hasRecord: boolean; accessEnabled?: boolean; routeById?: Map<string, string>; i18n?: boolean; rawEntity?: EntitySchema; rawResolve?: (name: string) => EntitySchema | undefined; captureApi?: string; handleNames?: Map<string, string> } = { hasRecord: false }): string {
  // A block's display label: localized via $t('block.<id>', 'literal') when i18n is on.
  const tLabel = (label: string, key: string) => (ctx.i18n ? `{$t('block.${key}', ${JSON.stringify(label)})}` : label)
  const span = wrapperStyle(block)
  const cls = wrapperClass(block)
  const cfg = block.config
  // Code-behind: a data-viz block bound to a DataHandle reads that handle's rows
  // (which code can override via setData), else it reads the shared screen dataset.
  const rowsVar = ctx.handleNames?.get(block.id)
  const rowsExpr = rowsVar ? `${rowsVar}.rows` : 'allRows'
  switch (cfg.kind) {
    case 'grid': {
      const colVar = `columns_${block.id.replace(/-/g, '_')}`
      const emptyMsg = `No ${(entity.label ?? entity.name).toLowerCase()} yet.`
      const lines = [`data={view.rows}`, `columns={${colVar}}`, `loading={view.loading}`, `loadingOverlay`, `emptyMessage=${JSON.stringify(emptyMsg)}`, `fitColumns`]
      lines.push(`enableRowSummaries={${cfg.rowSummaries ? 'true' : 'false'}}`)
      if (cfg.striped) lines.push(`zebraRows`)
      if (cfg.cellSelection) lines.push(`enableCellSelection`)
      if (cfg.density !== 'normal') lines.push(`rowHeight={${cfg.density === 'compact' ? 28 : 46}}`)
      const leftPins = cfg.columns.filter((c) => c.show && c.pin === 'left').map((c) => `'${c.field}'`)
      const rightPins = cfg.columns.filter((c) => c.show && c.pin === 'right').map((c) => `'${c.field}'`)
      if (leftPins.length || rightPins.length) {
        const pins = [leftPins.length ? `left: [${leftPins.join(', ')}]` : '', rightPins.length ? `right: [${rightPins.join(', ')}]` : ''].filter(Boolean).join(', ')
        lines.push(`initialColumnPinning={{ ${pins} }}`, `columnVirtualization={false}`)
      }
      if (cfg.selectable) lines.push(`showRowSelection`)
      if (cfg.sortable) lines.push(`sortable`, `externalSort`, `onSortingChange={(s) => controller.setSort(s)}`)
      if (cfg.filterable) lines.push(`filterable`, `showGlobalFilter`, `externalFilter`, `onFiltersChange={(f) => controller.setFilter({ global: f.global || undefined, columns: Object.fromEntries(f.columns.map((c) => [c.id, { operator: c.operator, value: c.value, valueTo: c.valueTo, selectedValues: c.selectedValues }])) })}`)
      // RBAC: gate the edit affordances on the update permission (server also enforces).
      const canUpdate = ctx.accessEnabled ? `can($currentRole, 'update')` : 'true'
      if (cfg.editing === 'form') lines.push(ctx.accessEnabled ? `onRowDoubleClick={(e) => { if (${canUpdate}) editing = e.row }}` : `onRowDoubleClick={(e) => (editing = e.row)}`)
      if (cfg.editing === 'inline') lines.push(`onCellValueChange={(e) => { ${ctx.accessEnabled ? `if (!${canUpdate}) return; ` : ''}const row = view.rows[e.rowIndex]; if (row) controller.updateRow(String((row as Record<string, unknown>)[idField]), { [e.columnId]: e.newValue } as Partial<${typeName}>) }}`)
      // Drill-through: a row click navigates to another screen, filtered by the
      // clicked value. Takes precedence over a record-panel selection.
      const linkRoute = cfg.rowLink && ctx.routeById?.get(cfg.rowLink.screen)
      if (cfg.rowLink && linkRoute) {
        const src = cfg.rowLink.sourceField ?? entity.idField ?? entity.fields.find((f) => f.primaryKey)?.field ?? 'id'
        lines.push(`onRowClick={(e) => goto('/${linkRoute}?${cfg.rowLink.targetField}=' + encodeURIComponent(String((e.row as Record<string, unknown>)[${jsStr(src)}] ?? '')))}`)
      } else if (ctx.hasRecord) {
        lines.push(`onRowClick={(e) => (selectedRecord = e.row)}`)
      }
      if (cfg.paginated !== false) {
        lines.push(`showPagination`, `externalPagination`, `rowCount={view.total}`, `pageIndex={view.pageIndex}`, `pageSize={view.pageSize}`, `onPaginationChange={({ pageIndex, pageSize }) => (pageSize !== view.pageSize ? controller.setPageSize(pageSize) : controller.setPage(pageIndex))}`)
        if (cfg.paginationPosition && cfg.paginationPosition !== 'bottom') lines.push(`paginationPosition="${cfg.paginationPosition}"`)
        const opts = cfg.pageSizeOptions
        if (opts && opts.length && (opts.length !== 4 || opts.join(',') !== '10,25,50,100')) lines.push(`pageSizeOptions={[${opts.join(', ')}]}`)
      }
      // No-code conditional formatting -> the grid's rule engine.
      const cf = conditionalFormatsExpr(cfg)
      if (cf) lines.push(`conditionalFormats={${cf}}`)
      // Code-behind: bind the grid's api so onLoad can reach ctx.grid (SvGridApi).
      if (ctx.captureApi) lines.push(`onApiReady={(a) => (${ctx.captureApi} = a)}`)
      lines.push(`containerHeight={${block.height ?? 360}}`)
      return `    <div ${span}${cls}>
      <SvGrid
        ${lines.join('\n        ')}
      />
    </div>`
    }
    case 'chart': {
      const drillRoute = cfg.drillScreen && ctx.routeById?.get(cfg.drillScreen)
      const onDrill = drillRoute ? ` onDrill={(cat) => goto('/${drillRoute}?${cfg.dimension}=' + encodeURIComponent(String(cat)))}` : ''
      return `    <div ${span}${cls}>
      <SvSchemaChart schema={${schemaVar}} rows={${rowsExpr}} dimension="${cfg.dimension}"${cfg.measure ? ` measure="${cfg.measure}"` : ''} reduce="${cfg.reduce}" type="${cfg.type}"${block.height ? ` height={${block.height}}` : ''} controls={false} accent="var(--sg-accent)"${onDrill} />
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
      <SvGridMasterDetail schema={${schemaVar}} data={allRows} detailSchema={${cn.schemaVar}} getChildren={(p) => ${childRows}.filter((c) => String((c as Record<string, unknown>)['${cfg.foreignKey}']) === String((p as Record<string, unknown>)[${schemaVar}.idField ?? 'id']))}${onParent}${block.height ? ` containerHeight={${block.height}}` : ''} />
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
      const color = cfg.colorField ? ` colorField=${JSON.stringify(cfg.colorField)}` : ''
      // An event click drills into a detail screen (openScreen), filtered by ?id.
      const calRoute = cfg.openScreen ? ctx.routeById?.get(cfg.openScreen) : undefined
      const onSelect = calRoute ? ` onSelect={(id) => goto('/${calRoute}?id=' + encodeURIComponent(id))}` : ''
      return `    <div ${wrapperStyle(block)}${cls}>
      <SvSchedule schema={${schemaVar}} rows={allRows} loading={!allRowsReady} dateField=${JSON.stringify(cfg.dateField)} titleField=${JSON.stringify(asText(cfg.titleField))}${color}${onSelect} height={${h}} />
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
      return componentBlockMarkup(block, cfg, ctx.handleNames?.get(block.id))
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
function componentBlockMarkup(block: Block, cfg: ComponentConfig, handleName?: string): string {
  const span = wrapperStyle(block)
  const cls = wrapperClass(block)
  const spec = uiComponentSpec(cfg.component)
  if (!spec) return `    <div ${span}${cls}><!-- unknown component "${cfg.component}" --></div>`
  if (handleName) {
    // Handle mode (code page): props + content come from the reactive handle, and
    // clicks fire on it - so button1.setVariant(...) / button1.onclick = fn work.
    const inner = spec.hasContent ? `>{${handleName}.text}</${spec.importName}>` : ' />'
    return `    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div id="${block.id}" onclick={(e) => ${handleName}.fire('click', e)} ${span}${cls}>
      <${spec.importName} {...${handleName}.props}${inner}
    </div>`
  }
  const attrs: string[] = []
  for (const p of spec.props) {
    const v = cfg.props[p.key] ?? p.default
    if (v == null || v === '') continue
    if (p.type === 'boolean') { if (v) attrs.push(p.key) }
    else if (p.type === 'number') attrs.push(`${p.key}={${Number(v)}}`)
    else attrs.push(`${p.key}={${jsStr(String(v))}}`)
  }
  // Baked-in array/object props (Timeline items, Sparkline data): emitted verbatim.
  for (const f of spec.fixed ?? []) attrs.push(`${f.key}={${f.expr}}`)
  const openTag = `<${spec.importName}${attrs.length ? ' ' + attrs.join(' ') : ''}`
  const inner = spec.hasContent ? `>{${jsStr(String(cfg.props._content ?? spec.contentDefault ?? ''))}}</${spec.importName}>` : ' />'
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
  return screen.code === true || screen.renderGrid === true || Object.keys(screen.handlerBodies ?? {}).length > 0
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
  const dataset = screenDataset(screen)
  if (dataset === 'settable' && datasetRowsVar) ctxParts.push(`data: { get rows() { return ${datasetRowsVar} }, setRows: (r) => (${datasetRowsVar} = r) }`)
  else if (dataset === 'reload') ctxParts.push('data: { get rows() { return view.rows }, reload: () => controller.refresh() }')
  ctxParts.push('goto')
  ctxParts.push('params: Object.fromEntries($page.url.searchParams)')
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
  if (dataset === 'settable') members.push(`  /** This page owns its dataset - replace it with data.setRows(rows). */\n  data: { rows: ${rowType}[]; setRows: (rows: ${rowType}[]) => void }`)
  else if (dataset === 'reload') members.push(`  /** The grid's current page of rows + a refresh(). */\n  data: { rows: ${rowType}[]; reload: () => void }`)
  members.push('  /** Navigate to another route. */\n  goto: (path: string) => void')
  members.push("  /** The page's URL query params. */\n  params: Record<string, string>")

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
    const loadRaw = screen.handlerBodies?.[ON_LOAD]?.trim()
    const loadInner = loadRaw ? indentBody(loadRaw) : '  // Runs when the page mounts. Reach blocks via ctx.<name>, feed data via ctx.data / ctx.<chart>.setData(rows).'
    const destroyRaw = screen.handlerBodies?.[ON_DESTROY]?.trim()
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

  const codeImport = hasCode ? `import { onMount } from 'svelte'\n  import * as handlers from './handlers'\n  ` : ''
  const gotoImport = hasCode ? `import { goto } from '$app/navigation'\n  ` : ''
  const pageStoreImport = hasCode ? `import { page } from '$app/stores'\n  ` : ''
  const handleDecls = (wiring?.decls ?? []).join('\n  ')
  // The Grid exposes its real SvGridApi (onApiReady) so code gets the full, typed
  // grid API - ctx.grid.exportCsv(), selectCells(), startEditing(), ... - not a stub.
  const gridScript = grid
    ? `\n  let rows = $state<RowData[]>([])\n  let gridApi = $state<SvGridApi<any, any> | null>(null)\n  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature, rowSelectionFeature })\n  const columns = $derived(rows.length ? Object.keys(rows[0]).map((field) => ({ field, header: field })) : [])`
    : ''
  const codeScript = hasCode
    ? `\n  ${handleDecls ? handleDecls + '\n  ' : ''}${gridScript ? gridScript.trimStart() + '\n  ' : ''}onMount(() => { handlers.${ON_LOAD}(${wiring!.ctxLiteral}); return () => handlers.${ON_DESTROY}(${wiring!.ctxLiteral}) })`
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
  // The pivot reads the whole table (like charts / dashboards).
  const needsAllRows = hasAgg || hasMD || hasPivot || has(allBlocks, 'board') || has(allBlocks, 'calendar') || has(allBlocks, 'detail')

  // --- imports ---
  const gridSpecs: string[] = []
  if (needsController) gridSpecs.push('SvGrid', 'createServerDataSource', ...(hasRowActions ? ['renderSnippet', 'type CellContext'] : []), 'type ServerState')
  if (has(allBlocks, 'gauge')) gridSpecs.push('SvGauge')
  if (has(allBlocks, 'tree')) gridSpecs.push('SvTree')
  if (has(blocks, 'tabs')) gridSpecs.push('SvTabs')
  if (has(blocks, 'accordion')) gridSpecs.push('SvAccordion')
  for (const b of allBlocks) {
    if (b.config.kind !== 'component') continue
    const importName = uiComponentSpec(b.config.component)?.importName
    if (importName) gridSpecs.push(importName)
  }
  if (codeGrid) gridSpecs.push('type SvGridApi')
  const gridImports = gridSpecs.length ? `import { ${[...new Set(gridSpecs)].join(', ')} } from '@svgrid/grid'\n  ` : ''
  const entImports: string[] = []
  if (hasGrid) entImports.push('schemaToColumns')
  if (wantsForm || (hasRecord && recordEditable)) entImports.push('SvGridEditPanel')
  if (has(allBlocks, 'chart')) entImports.push('SvSchemaChart')
  if (has(allBlocks, 'dashboard')) entImports.push('SvSchemaDashboard')
  if (has(allBlocks, 'board')) entImports.push('SvBoard')
  if (has(allBlocks, 'calendar')) entImports.push('SvSchedule')
  if (has(allBlocks, 'detail')) entImports.push('SvRecordDetail')
  if (has(allBlocks, 'kpi') || has(allBlocks, 'gauge')) entImports.push('reduceValue')
  const kpiCfgs = allBlocks.filter((b) => b.config.kind === 'kpi').map((b) => b.config as KpiConfig)
  if (kpiCfgs.some((c) => c.format && c.format !== 'auto')) entImports.push('formatKpiValue')
  if (kpiCfgs.some((c) => c.trendField)) entImports.push('kpiSeries', 'sparklinePoints', 'seriesDelta')
  if (hasMD) entImports.push('SvGridMasterDetail')
  if (hasPivot) entImports.push('SvPivotDesigner')
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
  if (codeGrid) parts.push('let gridApi = $state<SvGridApi<any, any> | null>(null)')
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
  for (const b of blocks) {
    if (b.config.kind === 'grid') {
      const idSafe = b.id.replace(/-/g, '_')
      const colExpr = gridColumnsExpr(n.schemaVar, b)
      let colValue = i18nEnabled ? `localizeCols(${colExpr}, ${JSON.stringify(schema.name)}, $t)` : colExpr
      // An "edit" action needs the form; drop it if this grid has no edit modal.
      const actions = (b.config.rowActions ?? []).filter((a) => a.kind !== 'edit' || wantsForm)
      if (actions.length) {
        // A synthetic action column (id, no field, cell renderer) - type-clean.
        colValue = `[...(${colValue}), { id: '__actions', header: 'Actions', sortable: false, cell: (ctx: CellContext<${n.type}>) => renderSnippet(rowActions_${idSafe}, { row: ctx.row.original }) }]`
        actionSnippets.push(rowActionsSnippet(idSafe, n.type, schema, actions, routeById, gatesUi, screen.id))
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
  for (const c of childList) {
    const cn = namesFor(c)
    const v = mdChildVar(c.name)
    parts.push(`let ${v} = $state<${cn.type}[]>([])
  async function load_${v}() { ${v} = [...(await ${cn.sourceVar}.getRows({ startRow: 0, endRow: 1000, pageIndex: 0, pageSize: 1000, sortModel: [], filterModel: {} })).rows] }
  load_${v}()`)
  }
  if (wantsForm) {
    const lookupsProp = relationFields.length
      ? `\n  const lookups = { ${relationFields.map((f, i) => `${f.field}: ${lookupVars[i]}`).join(', ')} }`
      : ''
    parts.push(`let editing = $state<${n.type} | null | undefined>(undefined)${lookupsProp}
  async function save({ mode, id, values }: { mode: 'create' | 'edit'; id: string | null; values: Partial<${n.type}> }) {
    if (mode === 'create') { await controller.createRow({ [idField]: nextId('${n.idPrefix}'), ...values } as Partial<${n.type}>); controller.setPage(view.pageCount - 1) }
    else if (id) { await controller.updateRow(id, values) }
    editing = undefined${needsAllRows ? '\n    await loadAll()' : ''}
  }`)
  }
  // Record panel: the row selected in the grid, plus (when editable) a save hook.
  if (hasRecord) {
    parts.push(`let selectedRecord = $state<${n.type} | null>(null)${recordEditable ? `
  async function saveRecord({ id, values }: { mode: 'create' | 'edit'; id: string | null; values: Partial<${n.type}> }) {
    if (id) { await controller.updateRow(id, values) }
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
    parts.push(`onMount(() => { handlers.${ON_LOAD}(${codeWire.ctxLiteral}); return () => handlers.${ON_DESTROY}(${codeWire.ctxLiteral}) })`)
  }

  // --- markup ---
  const newLabel = i18nEnabled ? `{$t('new.${schema.name}', ${JSON.stringify('+ New ' + label)})}` : `+ New ${label}`
  const newBtn = `<button class="st-btn st-btn--primary" onclick={() => (editing = null)}>${newLabel}</button>`
  const actionButtons = screenActions.map((a) => actionToolbarButton(a, screen.id, gatesActions)).join('\n  ')
  const toolbar = (wantsForm || screenActions.length > 0)
    ? `<div class="st__toolbar">\n  ${wantsForm ? (gatesUi ? `{#if can($currentRole, 'create')}${newBtn}{/if}` : newBtn) : ''}${actionButtons ? `\n  ${actionButtons}` : ''}\n</div>\n\n`
    : ''
  const body = blocks.map((b) => blockMarkup(schema, n.schemaVar, n.type, b, resolve, { hasRecord, accessEnabled: gatesUi, routeById, i18n: i18nEnabled, rawEntity: rawSchema, rawResolve, captureApi: codeGrid && b.id === codeGridBlockId ? 'gridApi' : undefined, handleNames: codeEnabled ? handleNames : undefined })).filter(Boolean).join('\n')
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
  const codeImport = codeEnabled ? `import { onMount } from 'svelte'\n  import * as handlers from './handlers'\n  ` : ''
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
${toolbar}<div class="st-screen${screenClassSuffix(screen)}">
${body}
</div>${modal}${actionSnippets.length ? '\n\n' + actionSnippets.join('\n\n') : ''}
${has(blocks, 'kpi') || has(blocks, 'gauge') || has(blocks, 'tree') ? `
<style>
  .kpi { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e6e8ec); border-radius: 12px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); overflow: hidden; }
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
</style>
` : ''}`,
  }
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
  const { files, prepared } = emitEntityModules(project.entities, { sources, accessEnabled, auditEnabled, screensByEntity })
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
    pages.push(screenPage(schema, rawByName.get(screen.entity) ?? schema, screen, resolve, (name) => rawByName.get(name), accessEnabled, i18nEnabled, routeById, drillEnabled))
  }
  const actionRouteFiles = [...actionsById.values()].map(({ action, screenId }) => actionRouteFile(action, screenId, accessEnabled))

  // Nav: only screens flagged into the menu, ordered, with an optional custom label.
  // Carry the screen id so RBAC can hide links the current role can't open.
  const nav: NavItem[] = [...project.screens]
    .filter((s) => s.nav?.show !== false)
    .sort((a, b) => (a.nav?.order ?? 0) - (b.nav?.order ?? 0))
    .map((s) => ({ href: `/${s.route}`, label: s.nav?.label ?? s.title, id: s.id }))
  const accessFiles = accessEnabled ? [accessModule(project)] : []
  const authFileList = authEnabled ? authFiles(project) : []
  const sqlEntities = project.entities.filter((e) => sources[e.name]?.kind === 'sql')
  const dataLayerList = project.dataLayer === 'drizzle' && sqlEntities.length > 0 ? dataLayerFiles(project, sqlEntities, sources) : []
  const auditFiles = auditEnabled ? [auditModule(), auditRouteFile(), auditViewerPage()] : []
  const navWithAudit = auditEnabled ? [...nav, { href: '/audit', label: 'Audit log', id: '__audit__' }] : nav
  const i18nFiles = i18nEnabled ? [i18nModule(project)] : []
  const handleFiles = project.screens.some(screenHasCode) ? [handlesModuleFile()] : []
  return [...files, ...accessFiles, ...authFileList, ...dataLayerList, ...auditFiles, ...i18nFiles, ...actionRouteFiles, ...pages, ...companions, ...handleFiles, layoutFile(navWithAudit, { accent: project.theme?.accent, shell: project.theme?.shell, title: project.title, themeVars: resolveThemeTokens(project.theme), lightVars: resolveThemeTokensFor(project.theme, 'light'), darkVars: resolveThemeTokensFor(project.theme, 'dark'), dark: isDarkTheme(project.theme), access: accessEnabled, auth: authEnabled, i18n: i18nEnabled, appClass: project.theme?.appClass }), homeFile(navWithAudit)]
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
export function getServerRole(event: { locals?: Record<string, unknown> }): AppRole {
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
function authFiles(project: StudioProject): GeneratedFile[] {
  const users = seedUsers(project)
  const demo = users[0]!
  const protect = project.auth?.protect !== false
  const usersLiteral = users
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
`

  const usersTs = `// Regenerated by SvGrid Studio. DEMO user store - replace with your own (a DB table,
// an external identity provider, ...). Passwords here are demo seeds, like sample rows:
// change them and store hashes for production (see hashPassword / verifyPassword in ./auth).
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

  const layoutServerTs = `import type { LayoutServerLoad } from './$types'
${protect ? "import { redirect } from '@sveltejs/kit'\n" : ''}
// Expose the signed-in user + role to every page (read as \`data.user\` / \`data.role\`,
// or \`$page.data\`).${protect ? ' Unauthenticated visitors are sent to /login.' : ''}
export const load: LayoutServerLoad = async ({ locals${protect ? ', url' : ''} }) => {
${protect ? "  if (!locals.user && url.pathname !== '/login') throw redirect(302, '/login?redirectTo=' + encodeURIComponent(url.pathname))\n" : ''}  return { user: locals.user ?? null, role: locals.role ?? null }
}
`

  const loginServerTs = `import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from '$lib/server/auth'
import { findUser } from '$lib/server/users'

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) throw redirect(302, '/')
  return {}
}

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const form = await request.formData()
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    const user = findUser(email)
    // DEMO: plain comparison against the seed. For a real store keep a passwordHash and
    // use \`await verifyPassword(password, user.passwordHash)\` from '$lib/server/auth'.
    if (!user || user.password !== password) return fail(401, { email, error: 'Invalid email or password.' })
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
    <button class="auth__btn" type="submit">Sign in</button>
    <p class="auth__hint">Demo account: <code>${demo.email}</code> / <code>${demo.password}</code></p>
  </form>
</div>

<style>
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
  .auth__hint { margin: 6px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); text-align: center; }
  .auth__hint code { background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, transparent); padding: 1px 5px; border-radius: 5px; }
</style>
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

  const envExample = `# Session signing secret - set a long random value in production.
SESSION_SECRET=change-me-to-a-long-random-string
`

  return [
    { path: 'src/lib/server/auth.ts', description: 'Session + password crypto (Web Crypto, dependency-free).', contents: authTs },
    { path: 'src/lib/server/users.ts', description: 'Demo user store (replace with your own).', contents: usersTs },
    { path: 'src/hooks.server.ts', description: 'Resolves the session into event.locals on every request.', contents: hooksTs },
    { path: 'src/auth.d.ts', description: 'App.Locals augmentation (user + role).', contents: localsDts },
    { path: 'src/routes/+layout.server.ts', description: 'Exposes user/role to pages; guards routes.', contents: layoutServerTs },
    { path: 'src/routes/login/+page.svelte', description: 'Sign-in page.', contents: loginPage },
    { path: 'src/routes/login/+page.server.ts', description: 'Sign-in form action.', contents: loginServerTs },
    { path: 'src/routes/logout/+page.server.ts', description: 'Sign-out action.', contents: logoutServerTs },
    { path: '.env.example', description: 'Environment template.', contents: envExample },
  ]
}

/** Escape a string for safe use as literal text inside emitted Svelte markup. */
function jsStrHtml(s: string): string {
  return s.replace(/[&<>{}]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '{': '&#123;', '}': '&#125;' }[c]!))
}

// --- Typed data layer (Drizzle ORM + drizzle-kit migrations) ----------------
type DzDialect = 'postgres' | 'sqlite' | 'turso'
/** Per-dialect Drizzle wiring. Only the `.returning()`-capable dialects ship here
 *  (postgres covers Supabase + most; sqlite / turso cover embedded + edge). MySQL /
 *  MSSQL keep the raw connected route until their repo variants are added. */
const DZ: Record<DzDialect, { kit: string; table: string; core: string; client: string; setup: string; creds: string }> = {
  postgres: {
    kit: 'postgresql', table: 'pgTable', core: 'drizzle-orm/pg-core',
    client: "import { drizzle } from 'drizzle-orm/node-postgres'\nimport pg from 'pg'",
    setup: 'const pool = new pg.Pool({ connectionString: env.DATABASE_URL })\nexport const db = drizzle(pool, { schema })',
    creds: 'dbCredentials: { url: process.env.DATABASE_URL! }',
  },
  sqlite: {
    kit: 'sqlite', table: 'sqliteTable', core: 'drizzle-orm/sqlite-core',
    client: "import { drizzle } from 'drizzle-orm/better-sqlite3'\nimport Database from 'better-sqlite3'",
    setup: "const sqlite = new Database(env.DATABASE_URL ?? 'data.db')\nexport const db = drizzle(sqlite, { schema })",
    creds: "dbCredentials: { url: process.env.DATABASE_URL ?? 'data.db' }",
  },
  turso: {
    kit: 'turso', table: 'sqliteTable', core: 'drizzle-orm/sqlite-core',
    client: "import { drizzle } from 'drizzle-orm/libsql'\nimport { createClient } from '@libsql/client'",
    setup: "const client = createClient({ url: env.DATABASE_URL ?? '', authToken: env.DATABASE_AUTH_TOKEN })\nexport const db = drizzle(client, { schema })",
    creds: 'dbCredentials: { url: process.env.DATABASE_URL!, authToken: process.env.DATABASE_AUTH_TOKEN }',
  },
}

/** Normalize a Studio SQL dialect to a Drizzle-supported one, or null if unsupported. */
function dzDialect(dialect: string | undefined): DzDialect | null {
  if (dialect === 'supabase' || dialect === 'postgres' || dialect == null) return 'postgres'
  if (dialect === 'sqlite') return 'sqlite'
  if (dialect === 'turso') return 'turso'
  return null // mysql / mssql: not yet in the Drizzle layer
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
  // sqlite / turso
  switch (field.type) {
    case 'number': return { expr: `real(${q})`, imports: ['real'] }
    case 'boolean': return { expr: `integer(${q}, { mode: 'boolean' })`, imports: ['integer'] }
    case 'json': return { expr: `text(${q}, { mode: 'json' })`, imports: ['text'] }
    default: return { expr: `text(${q})`, imports: ['text'] }
  }
}

/** The typed Drizzle data layer (emitted when `project.dataLayer === 'drizzle'` and
 *  there's a SQL-bound entity on a supported dialect): a schema (the source of truth
 *  for drizzle-kit migrations), a client, a typed repository per entity, and the
 *  drizzle.config.ts. The connected `+server.ts` routes read the same tables. */
function dataLayerFiles(project: StudioProject, sqlEntities: EntitySchema[], sources: Record<string, EntityDataSource>): GeneratedFile[] {
  const firstSql = sources[sqlEntities[0]!.name]
  const dialect = dzDialect(firstSql?.kind === 'sql' ? firstSql.dialect : undefined)
  if (!dialect) return [] // MySQL / MSSQL: raw route only, for now
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
    return {
      path: `src/lib/server/db/${namesFor(e).route}.ts`,
      description: `Typed repository for ${namesFor(e).label} (Drizzle).`,
      contents: `// Regenerated by SvGrid Studio. Typed CRUD over the ${tableVar} table - call from
// server code, form actions, or your own API routes.
import { eq } from 'drizzle-orm'
import { db } from './index'
import { ${tableVar}, type ${type}Row, type ${type}New } from './schema'

export const ${tableVar}Repo = {
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
}
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
@media (max-width: 640px) { .st__title { font-size: 19px; } }
.st-rowactions { display: inline-flex; gap: 6px; }
.st-rowaction { padding: 3px 9px; font: inherit; font-size: 12px; font-weight: 550; line-height: 1.4; border: 1px solid var(--sg-border, #e6e8ec); border-radius: 7px; background: var(--sg-bg, #fff); color: var(--sg-fg, inherit); cursor: pointer; }
.st-rowaction:hover { background: color-mix(in srgb, var(--sg-fg, #0f172a) 5%, var(--sg-bg, #fff)); }
.st-rowaction--danger { color: #dc2626; border-color: color-mix(in srgb, #dc2626 40%, var(--sg-border, #e6e8ec)); }
.st-rowaction--danger:hover { background: color-mix(in srgb, #dc2626 8%, var(--sg-bg, #fff)); }
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
  /** Provider "new project" dashboard link (for the import-from-Git path). */
  dashboard?: string
  label: string
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
        dashboard: 'https://vercel.com/new',
        label: 'Vercel',
      }
    case 'netlify':
      return {
        adapterModule: '@sveltejs/adapter-netlify',
        adapterDep: ['@sveltejs/adapter-netlify', '^5.0.0'],
        files: [{ path: 'netlify.toml', description: 'Netlify build config.', contents: `[build]\n  command = "npm run build"\n` }],
        cli: 'npx netlify deploy --build --prod',
        dashboard: 'https://app.netlify.com/start',
        label: 'Netlify',
      }
    case 'cloudflare':
      return {
        adapterModule: '@sveltejs/adapter-cloudflare',
        adapterDep: ['@sveltejs/adapter-cloudflare', '^7.0.0'],
        files: [{ path: 'wrangler.toml', description: 'Cloudflare Pages config.', contents: `name = "${slug}"\npages_build_output_dir = ".svelte-kit/cloudflare"\ncompatibility_date = "2024-11-01"\n` }],
        cli: 'npm run build && npx wrangler pages deploy .svelte-kit/cloudflare',
        dashboard: 'https://dash.cloudflare.com/?to=/:account/pages/new',
        label: 'Cloudflare Pages',
      }
    case 'node':
      return {
        adapterModule: '@sveltejs/adapter-node',
        adapterDep: ['@sveltejs/adapter-node', '^5.2.0'],
        files: [],
        cli: 'npm run build && node build',
        label: 'Node server',
      }
    default:
      return {
        adapterModule: '@sveltejs/adapter-auto',
        adapterDep: ['@sveltejs/adapter-auto', '^6.0.0'],
        files: [],
        cli: 'npx vercel --prod',
        dashboard: 'https://vercel.com/new',
        label: 'Auto (Vercel / Netlify / Cloudflare)',
      }
  }
}

/** The deploy facts the designer's Deploy panel shows (label, CLI one-liner, dashboard link). */
export function studioDeployInfo(project: StudioProject): { label: string; cli: string; dashboard?: string; adapter: string } {
  const p = deployPlan(project)
  return { label: p.label, cli: p.cli, dashboard: p.dashboard, adapter: p.adapterModule }
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
  // Typed data layer: drizzle-orm at runtime, drizzle-kit (dev) for migrations + scripts.
  const drizzle = project.dataLayer === 'drizzle' && /from ['"]drizzle-orm(?:\/[^'"]*)?['"]/.test(allSource)
  if (drizzle) dependencies['drizzle-orm'] = '^0.44.0'
  const scripts: Record<string, string> = { dev: 'vite dev', build: 'vite build', preview: 'vite preview', check: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json', test: 'vitest run' }
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
  ]
  return [...scaffold, ...generated]
}
