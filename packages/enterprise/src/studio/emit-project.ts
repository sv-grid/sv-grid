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
import type { Block, EntityDataSource, FilterPanelConfig, GridConfig, PivotConfig, RecordConfig, RowAction, Screen, StudioProject } from './project.js'
import { blockColumns, entityDataSource, flattenBlocks, serializeProject } from './project.js'
import { resolveThemeTokens, isDarkTheme } from './themes.js'
import type { EntityField, EntitySchema } from '../schema.js'
import { emitEntityModules, homeFile, layoutFile, lookupVar, namesFor, type NavItem } from './emit-schema.js'

const has = (blocks: Block[], kind: Block['config']['kind']) => blocks.some((b) => b.config.kind === kind)

/** Per-Tabs-block active-tab state var + a stable tab id. */
const tabsStateVar = (blockId: string) => `activeTab_${blockId.replace(/[^a-zA-Z0-9_$]/g, '_')}`
const tabId = (blockId: string, i: number) => `${blockId}-${i}`

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

/** Markup for one block inside the screen grid. `ctx.hasRecord` tells a grid to
 *  publish its clicked row into `selectedRecord` for a sibling record panel. */
function blockMarkup(entity: EntitySchema, schemaVar: string, typeName: string, block: Block, resolve: (name: string) => EntitySchema | undefined, ctx: { hasRecord: boolean; accessEnabled?: boolean; routeById?: Map<string, string>; i18n?: boolean } = { hasRecord: false }): string {
  // A block's display label: localized via $t('block.<id>', 'literal') when i18n is on.
  const tLabel = (label: string, key: string) => (ctx.i18n ? `{$t('block.${key}', ${JSON.stringify(label)})}` : label)
  const span = `style="grid-column: span ${blockColumns(block)}; min-width: 0"`
  const cfg = block.config
  switch (cfg.kind) {
    case 'grid': {
      const colVar = `columns_${block.id.replace(/-/g, '_')}`
      const lines = [`data={view.rows}`, `columns={${colVar}}`, `loading={view.loading}`, `loadingOverlay`, `fitColumns`]
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
      lines.push(`containerHeight={${block.height ?? 360}}`)
      return `    <div ${span}>
      <SvGrid
        ${lines.join('\n        ')}
      />
    </div>`
    }
    case 'chart': {
      const drillRoute = cfg.drillScreen && ctx.routeById?.get(cfg.drillScreen)
      const onDrill = drillRoute ? ` onDrill={(cat) => goto('/${drillRoute}?${cfg.dimension}=' + encodeURIComponent(String(cat)))}` : ''
      return `    <div ${span}>
      <SvSchemaChart schema={${schemaVar}} rows={allRows} dimension="${cfg.dimension}"${cfg.measure ? ` measure="${cfg.measure}"` : ''} reduce="${cfg.reduce}" type="${cfg.type}"${block.height ? ` height={${block.height}}` : ''} controls={false} accent="var(--sg-accent)"${onDrill} />
    </div>`
    }
    case 'dashboard':
      return `    <div ${span}>
      <SvSchemaDashboard schema={${schemaVar}} rows={allRows} />
    </div>`
    case 'kpi': {
      // Format the value: thousands separators, "$" for money measures ("... ($)").
      const money = cfg.measure ? /\$/.test(entity.fields.find((f) => f.field === cfg.measure)?.label ?? '') : false
      const expr = `${money ? "'$' + " : ''}reduceValue(allRows, { ${cfg.measure ? `measure: '${cfg.measure}', ` : ''}reduce: '${cfg.reduce}' }).toLocaleString(undefined, { maximumFractionDigits: 1 })`
      return `    <div ${span} class="kpi">
      <span class="kpi__label">${tLabel(cfg.label, block.id)}</span>
      <strong class="kpi__value">{${expr}}</strong>
    </div>`
    }
    case 'gauge': {
      const gexpr = `reduceValue(allRows, { ${cfg.measure ? `measure: '${cfg.measure}', ` : ''}reduce: '${cfg.reduce}' })`
      const unit = cfg.unit ? ` unit=${JSON.stringify(cfg.unit)}` : ''
      return `    <div ${span} class="gaugecard">
      <span class="kpi__label">${tLabel(cfg.label, block.id)}</span>
      <SvGauge value={${gexpr}} min={${cfg.min}} max={${cfg.max}}${unit} size={172} />
    </div>`
    }
    case 'tree': {
      if (!cfg.labelField || !cfg.parentField) {
        return `    <div ${span}><!-- tree: set a label field + a self-referential parent field in the inspector --></div>`
      }
      const idExpr = `${schemaVar}.idField ?? 'id'`
      return `    <div ${span} class="treecard">
      <SvTree nodes={toTreeNodes(allRows as Record<string, unknown>[], ${idExpr}, ${JSON.stringify(cfg.labelField)}, ${JSON.stringify(cfg.parentField)})} />
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
      return `    <div ${span}>
      <SvTabs tabs={${items}} value={${tabsVar}} onChange={(id) => (${tabsVar} = id)}>
        {#snippet panel(id)}
${panels}
        {/snippet}
      </SvTabs>
    </div>`
    }
    case 'master-detail': {
      const child = cfg.childEntity ? resolve(cfg.childEntity) : undefined
      if (!child || !cfg.foreignKey) {
        return `    <div ${span}><!-- master-detail: set a child entity + foreign key in the inspector --></div>`
      }
      const cn = namesFor(child)
      const childRows = mdChildVar(child.name)
      return `    <div ${span}>
      <SvGridMasterDetail schema={${schemaVar}} data={allRows} detailSchema={${cn.schemaVar}} getChildren={(p) => ${childRows}.filter((c) => String((c as Record<string, unknown>)['${cfg.foreignKey}']) === String((p as Record<string, unknown>)[${schemaVar}.idField ?? 'id']))}${block.height ? ` containerHeight={${block.height}}` : ''} />
    </div>`
    }
    case 'pivot': {
      const h = block.height ?? 460
      return `    <div style="grid-column: span ${blockColumns(block)}; min-width: 0; height: ${h}px">
      <SvPivotDesigner data={allRows} fields={${pivotFieldsExpr(entity)}} layout={${pivotLayoutExpr(cfg)}} />
    </div>`
    }
    case 'filter':
      return filterPanelMarkup(entity, block, cfg)
    case 'record':
      return recordPanelMarkup(entity, schemaVar, block, cfg)
    case 'lookup':
      return `    <div ${span}><!-- lookup (${cfg.field}): shown in the edit form --></div>`
    case 'form':
    default:
      return '' // the form is the edit modal, rendered after the screen grid
  }
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
  return `    <aside style="grid-column: span ${blockColumns(block)}; min-width: 0" class="st-filter">
      <div class="st-filter__title">${cfg.title ?? 'Filters'}</div>
${controls}
    </aside>`
}
/** A `{#snippet}` rendering a grid row's action buttons (edit / delete / navigate).
 *  Buttons are unrolled statically; RBAC gates edit/delete when `gate` is set. */
function rowActionsSnippet(idSafe: string, typeName: string, entity: EntitySchema, actions: RowAction[], routeById: Map<string, string>, gate: boolean): string {
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

/** The record detail panel markup: an inline edit form (editable) or a read-only
 *  field list, bound to `selectedRecord`. */
function recordPanelMarkup(entity: EntitySchema, schemaVar: string, block: Block, cfg: RecordConfig): string {
  const span = `style="grid-column: span ${blockColumns(block)}; min-width: 0"`
  let inner: string
  if (cfg.editable) {
    inner = `      {#if selectedRecord}
        <SvGridEditPanel schema={${schemaVar}} row={selectedRecord} presentation="inline" onSubmit={saveRecord} onCancel={() => (selectedRecord = null)} />
      {:else}
        <p class="st-hint">Select a row to see its details.</p>
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
  return `    <div ${span} class="st-record-card">
${inner}
    </div>`
}

/** A self-contained screen page composing the screen's blocks. When `accessEnabled`
 *  the page gates create / update affordances by the current role (server still
 *  enforces via the route's `authorize`). */
function screenPage(schema: EntitySchema, screen: Screen, resolve: (name: string) => EntitySchema | undefined, accessEnabled = false, i18nEnabled = false, routeById: Map<string, string> = new Map(), drillEnabled = false): GeneratedFile {
  const n = namesFor(schema)
  const label = schema.label ?? n.label
  const blocks = screen.blocks
  // Display blocks (chart/kpi/gauge/pivot/tree/dashboard) can be nested inside Tabs;
  // flatten so their imports + data loading are detected. Controller-bound kinds
  // (grid/form/filter/record) only live at the top level.
  const allBlocks = flattenBlocks(blocks)
  const hasGrid = has(blocks, 'grid')
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

  // Distinct, resolvable child entities referenced by master-detail blocks.
  const mdChildren = new Map<string, EntitySchema>()
  for (const b of blocks) {
    if (b.config.kind === 'master-detail' && b.config.childEntity && b.config.foreignKey) {
      const c = resolve(b.config.childEntity)
      if (c) mdChildren.set(c.name, c)
    }
  }
  const childList = [...mdChildren.values()]
  const hasMD = childList.length > 0
  // The pivot reads the whole table (like charts / dashboards).
  const needsAllRows = hasAgg || hasMD || hasPivot

  // --- imports ---
  const gridSpecs: string[] = []
  if (needsController) gridSpecs.push('SvGrid', 'createServerDataSource', ...(hasRowActions ? ['renderSnippet'] : []), 'type ServerState')
  if (has(allBlocks, 'gauge')) gridSpecs.push('SvGauge')
  if (has(allBlocks, 'tree')) gridSpecs.push('SvTree')
  if (has(blocks, 'tabs')) gridSpecs.push('SvTabs')
  const gridImports = gridSpecs.length ? `import { ${gridSpecs.join(', ')} } from '@svgrid/grid'\n  ` : ''
  const entImports: string[] = []
  if (hasGrid) entImports.push('schemaToColumns')
  if (wantsForm || (hasRecord && recordEditable)) entImports.push('SvGridEditPanel')
  if (has(allBlocks, 'chart')) entImports.push('SvSchemaChart')
  if (has(allBlocks, 'dashboard')) entImports.push('SvSchemaDashboard')
  if (has(allBlocks, 'kpi') || has(allBlocks, 'gauge')) entImports.push('reduceValue')
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
    (b.config.kind === 'chart' && b.config.drillScreen && routeById.has(b.config.drillScreen)))
  const applyUrlFilters = drillEnabled && needsController
  const filterableFieldNames = schema.fields.filter((f) => !f.primaryKey).map((f) => f.field)
  // RBAC gates the UI only where there's a create/update affordance to gate.
  const gatesUi = accessEnabled && (wantsForm || gridConfigs.some((c) => c.editing === 'inline') || hasRowActions)

  // --- script body ---
  const parts: string[] = []
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
        colValue = `[...(${colValue}), { id: '__actions', header: 'Actions', sortable: false, cell: (ctx) => renderSnippet(rowActions_${idSafe}, { row: ctx.row.original }) }]`
        actionSnippets.push(rowActionsSnippet(idSafe, n.type, schema, actions, routeById, gatesUi))
      }
      const reactive = i18nEnabled || actions.length > 0
      parts.push(`const columns_${idSafe} = ${reactive ? `$derived(${colValue})` : colValue}`)
    }
  }
  if (needsAllRows) {
    parts.push(`let allRows = $state<${n.type}[]>([])
  async function loadAll() { allRows = [...(await ${n.sourceVar}.getRows({ startRow: 0, endRow: 1000, pageIndex: 0, pageSize: 1000, sortModel: [], filterModel: {} })).rows] }
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

  // --- markup ---
  const newLabel = i18nEnabled ? `{$t('new.${schema.name}', ${JSON.stringify('+ New ' + label)})}` : `+ New ${label}`
  const newBtn = `<button class="st-btn st-btn--primary" onclick={() => (editing = null)}>${newLabel}</button>`
  const toolbar = wantsForm
    ? `<div class="st__toolbar">\n  ${gatesUi ? `{#if can($currentRole, 'create')}${newBtn}{/if}` : newBtn}\n</div>\n\n`
    : ''
  const body = blocks.map((b) => blockMarkup(schema, n.schemaVar, n.type, b, resolve, { hasRecord, accessEnabled: gatesUi, routeById, i18n: i18nEnabled })).filter(Boolean).join('\n')
  const modal = wantsForm
    ? `\n\n{#if editing !== undefined}\n  <SvGridEditPanel schema={${n.schemaVar}} row={editing}${relationFields.length ? ' {lookups}' : ''} presentation="${formPres}" persistKey="${screen.route}" onSubmit={save} onCancel={() => (editing = undefined)} />\n{/if}`
    : ''
  const accessImport = gatesUi ? `import { currentRole, can } from '$lib/access'\n  ` : ''
  const i18nImport = i18nEnabled ? `import { t, localizeCols } from '$lib/i18n'\n  ` : ''
  const gotoImport = usesGoto ? `import { goto } from '$app/navigation'\n  ` : ''
  const pageImport = applyUrlFilters ? `import { page } from '$app/stores'\n  ` : ''
  const title = i18nEnabled ? `{$t('screen.${screen.id}', ${JSON.stringify(screen.title)})}` : screen.title

  return {
    path: `src/routes/${screen.route}/+page.svelte`,
    description: `${screen.title} screen (${blocks.map((b) => b.config.kind).join(', ') || 'empty'}).`,
    contents: `<script lang="ts">
  ${gridImports}${entImport}${accessImport}${i18nImport}${gotoImport}${pageImport}import { ${schemaVarImports.join(', ')}, ${typeImports.map((t) => `type ${t}`).join(', ')} } from '$lib/schemas'
  import { ${dataImports.join(', ')} } from '$lib/data'

  ${parts.join('\n\n  ')}
</script>

<h1 class="st__title">${title}</h1>

${toolbar}<div class="st-screen">
${body}
</div>${modal}${actionSnippets.length ? '\n\n' + actionSnippets.join('\n\n') : ''}
${has(blocks, 'kpi') || has(blocks, 'gauge') || has(blocks, 'tree') ? `
<style>
  .kpi { display: flex; flex-direction: column; gap: 4px; padding: 16px; border: 1px solid var(--sg-border, #e6e8ec); border-radius: 12px; }
  .kpi__label { font-size: 13px; color: var(--sg-muted, #64748b); }
  .kpi__value { font-size: 26px; font-weight: 700; }
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
  // Audit only fires on server routes, so it needs at least one SQL-bound entity.
  const auditEnabled = project.audit === true && Object.values(sources).some((s) => s.kind === 'sql')
  const i18nEnabled = project.i18n?.enabled === true && (project.i18n?.locales.length ?? 0) > 0
  const { files, prepared } = emitEntityModules(project.entities, { sources, accessEnabled, auditEnabled })
  const byName = new Map(prepared.map((s) => [s.name, s]))
  const resolve = (name: string) => byName.get(name)

  // Drill-through wiring: map screen id -> route, and detect whether any block
  // navigates (so target screens read URL params into an initial filter).
  const routeById = new Map(project.screens.map((s) => [s.id, s.route]))
  const drillEnabled = project.screens.some((s) => s.blocks.some((b) =>
    (b.config.kind === 'grid' && !!b.config.rowLink) || (b.config.kind === 'chart' && !!b.config.drillScreen)))

  const pages: GeneratedFile[] = []
  const seenRoute = new Set<string>()
  for (const screen of project.screens) {
    const schema = byName.get(screen.entity)
    if (!schema) throw new Error(`emitStudioProject: screen "${screen.title}" references missing entity "${screen.entity}"`)
    if (seenRoute.has(screen.route)) throw new Error(`emitStudioProject: duplicate route "/${screen.route}"`)
    seenRoute.add(screen.route)
    pages.push(screenPage(schema, screen, resolve, accessEnabled, i18nEnabled, routeById, drillEnabled))
  }

  // Nav: only screens flagged into the menu, ordered, with an optional custom label.
  // Carry the screen id so RBAC can hide links the current role can't open.
  const nav: NavItem[] = [...project.screens]
    .filter((s) => s.nav?.show !== false)
    .sort((a, b) => (a.nav?.order ?? 0) - (b.nav?.order ?? 0))
    .map((s) => ({ href: `/${s.route}`, label: s.nav?.label ?? s.title, id: s.id }))
  const accessFiles = accessEnabled ? [accessModule(project)] : []
  const auditFiles = auditEnabled ? [auditModule(), auditRouteFile(), auditViewerPage()] : []
  const navWithAudit = auditEnabled ? [...nav, { href: '/audit', label: 'Audit log', id: '__audit__' }] : nav
  const i18nFiles = i18nEnabled ? [i18nModule(project)] : []
  return [...files, ...accessFiles, ...auditFiles, ...i18nFiles, ...pages, layoutFile(navWithAudit, { accent: project.theme?.accent, shell: project.theme?.shell, title: project.title, themeVars: resolveThemeTokens(project.theme), dark: isDarkTheme(project.theme), access: accessEnabled, i18n: i18nEnabled }), homeFile(navWithAudit)]
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
/** Authorize a CRUD action for a role - used by the API routes' \`authorize\` hook. */
export function authorizeAction(role: AppRole, action: 'read' | WriteAction): boolean {
  return action === 'read' ? true : can(role, action)
}
`,
  }
}

// --- Full runnable app (download / npm-install-and-run) ---------------------

const appSlug = (title: string): string =>
  (title || 'studio-app').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'studio-app'

/** The static SvelteKit + Vite scaffolding around the generated screens. */
const SCAFFOLD_STATIC: ReadonlyArray<GeneratedFile> = [
  { path: 'vite.config.ts', description: 'Vite config.', contents: `import { sveltekit } from '@sveltejs/vite-plugin-svelte'\nimport { defineConfig } from 'vite'\n\nexport default defineConfig({ plugins: [sveltekit()] })\n` },
  { path: 'tsconfig.json', description: 'TypeScript config.', contents: `{\n  "extends": "./.svelte-kit/tsconfig.json",\n  "compilerOptions": {\n    "allowJs": true,\n    "checkJs": true,\n    "esModuleInterop": true,\n    "forceConsistentCasingInFileNames": true,\n    "resolveJsonModule": true,\n    "skipLibCheck": true,\n    "sourceMap": true,\n    "strict": true,\n    "moduleResolution": "bundler"\n  }\n}\n` },
  { path: 'src/app.html', description: 'HTML shell.', contents: `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    %sveltekit.head%\n  </head>\n  <body data-sveltekit-preload-data="hover">\n    <div style="display: contents">%sveltekit.body%</div>\n  </body>\n</html>\n` },
  { path: 'src/app.d.ts', description: 'SvelteKit app types.', contents: `declare global {\n  namespace App {}\n}\n\nexport {}\n` },
  { path: 'src/routes/+layout.ts', description: 'Client SPA (in-memory sources persist across navigation).', contents: `// In-memory sources are module singletons, so render as a client SPA. Move an\n// entity to SQL / Supabase and its /api route still runs server-side.\nexport const ssr = false\nexport const prerender = false\n` },
  { path: '.npmrc', description: 'npm config.', contents: `engine-strict=true\n` },
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
  const pkg = {
    name: appSlug(project.title),
    version: '0.0.1',
    private: true,
    type: 'module',
    scripts: { dev: 'vite dev', build: 'vite build', preview: 'vite preview', check: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json' },
    dependencies,
    devDependencies: {
      [deployPlan(project).adapterDep[0]]: deployPlan(project).adapterDep[1],
      '@sveltejs/kit': '^2.15.0',
      '@sveltejs/vite-plugin-svelte': '^7.0.0',
      svelte: '^5.55.5',
      'svelte-check': '^4.4.6',
      typescript: '^5.7.0',
      vite: '^8.0.10',
    },
  }
  return JSON.stringify(pkg, null, 2) + '\n'
}

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
    ...plan.files,
    ...SCAFFOLD_STATIC,
    ...(envExample(allSource) ? [{ path: '.env.example', description: 'Environment variables the app reads (copy to .env and fill in).', contents: envExample(allSource)! }] : []),
    { path: 'src/app.css', description: 'App theme + page styles.', contents: APP_CSS },
    // The design model, shipped with the app so it can be re-imported (Load) into
    // the designer for further visual editing - the export/import round-trip.
    { path: 'studio.config.json', description: 'The Studio project model - Load it back into the designer to keep editing visually.', contents: serializeProject(project) + '\n' },
    { path: 'README.md', description: 'How to run the app.', contents: readme },
  ]
  return [...scaffold, ...generated]
}
