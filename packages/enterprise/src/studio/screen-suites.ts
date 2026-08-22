/**
 * Screen factories + the CRUD-suite generator.
 *
 * Two layers live here:
 *
 * 1. The composable screen factories (`listScreen` / `formScreen` / `detailScreen`
 *    / `dashScreen`) the curated sample apps are built from. They take explicit,
 *    hand-picked options - a sample app knows its own domain.
 * 2. The CRUD suite (`crudSuiteScreens` / `addCrudSuite` / `crudAppFromSchemas`),
 *    which derives those options from a schema and produces a linked multi-screen
 *    app: a list, an edit form, a record detail page, and an optional overview
 *    dashboard, with drill-through and related-child tabs wired from the entity's
 *    relations. This is what the guided onboarding (designer wizard + `svgrid-studio
 *    init`) calls, so both hosts scaffold identical apps.
 *
 * Pure + node-safe (studio subtree): plain data built from the same immutable ops
 * the designer uses, so results round-trip through parse/serialize and generate a
 * runnable app with no special-casing.
 */
import type { EntityField, EntitySchema } from '../schema.js'
import type { ChartType } from '@svgrid/grid'
import {
  defaultBlockConfig,
  defaultEntitySource,
  entityOf,
  pickFacetFields,
  sanitizeProject,
  withSsrDefaults,
  type Block,
  type BlockConfig,
  type DataSourceKind,
  type DetailConfig,
  type DetailRelated,
  type EntityDataSource,
  type FormatRule,
  type GridConfig,
  type GridDensity,
  type GridEditing,
  type KpiFormat,
  type Presentation,
  type ProjectTheme,
  type Reduce,
  type RowAction,
  type RowLink,
  type Screen,
  type StudioProject,
} from './project.js'

// --- shared screen factories (also used by the curated sample apps) ----------

/** Rich-grid options an enterprise screen layers onto the default grid: status
 *  pills / thresholds (formatRules), a totals row, row actions, row-click drill,
 *  and density. */
export type GridOpts = {
  format?: FormatRule[]
  rowActions?: RowAction[]
  rowLink?: RowLink
  summaries?: boolean
  density?: GridDensity
  pageSize?: number
  /** How rows are edited: in-cell, via a popup form, or not at all (read-only
   *  lists that drill into a detail page). Defaults to the grid default (`'form'`). */
  editing?: GridEditing
  /** Where the edit form opens when `editing` is `'form'`. */
  formPresentation?: Presentation
}

/** A dashboard tile: KPI card (with trend/target/format), chart, gauge, pivot,
 *  tree, a rich grid, or a tabbed group of display tiles. */
export type Tile =
  | { kpi: string; measure?: string; reduce: Reduce; format?: KpiFormat; trendField?: string; trendReduce?: Reduce; target?: number; span?: 1 | 2 | 3 }
  | { chart: string; measure?: string; reduce?: Reduce; type?: ChartType; span?: 1 | 2 | 3 }
  | { gauge: string; measure?: string; reduce: Reduce; min?: number; max?: number; unit?: string; span?: 1 | 2 | 3 }
  | { pivot: { rows: string[]; cols: string[]; measure?: string; aggregate?: Reduce }; span?: 1 | 2 | 3 }
  | { tree: { labelField: string; parentField: string }; span?: 1 | 2 | 3 }
  | ({ grid: true; span?: 1 | 2 | 3 } & GridOpts)
  | { filter: string[]; span?: 1 | 2 | 3 }
  | { tabs: { label: string; tiles: Tile[] }[]; span?: 1 | 2 | 3 }

/** The default grid config with enterprise options merged on. */
export function gridConfig(entity: EntitySchema, opts: GridOpts): BlockConfig {
  const base = defaultBlockConfig('grid', entity) as GridConfig
  return {
    ...base,
    ...(opts.format ? { formatRules: opts.format } : {}),
    ...(opts.rowActions ? { rowActions: opts.rowActions } : {}),
    ...(opts.rowLink ? { rowLink: opts.rowLink } : {}),
    ...(opts.summaries ? { rowSummaries: true } : {}),
    ...(opts.density ? { density: opts.density } : {}),
    ...(opts.pageSize ? { pageSize: opts.pageSize } : {}),
    ...(opts.editing ? { editing: opts.editing } : {}),
    ...(opts.formPresentation ? { formPresentation: opts.formPresentation } : {}),
  }
}

/** One dashboard tile -> a Block. Recurses for `tabs` (whose children must be
 *  display blocks: chart / kpi / gauge / pivot / tree). `nextId` yields ids unique
 *  across the WHOLE screen (top-level tiles AND every nested tab child) - a per-level
 *  index would collide (top-level `blk-1` vs each tab's first child `blk-1`), which
 *  makes a keyed each throw `each_key_duplicate`. */
function tileBlock(entity: EntitySchema, t: Tile, nextId: () => string): Block {
  const id = nextId()
  if ('kpi' in t) {
    const config: BlockConfig = {
      kind: 'kpi', label: t.kpi, ...(t.measure ? { measure: t.measure } : {}), reduce: t.reduce,
      ...(t.format ? { format: t.format } : {}), ...(t.trendField ? { trendField: t.trendField } : {}),
      ...(t.trendReduce ? { trendReduce: t.trendReduce } : {}), ...(t.target != null ? { target: t.target } : {}),
    }
    return { id, span: t.span ?? 1, config }
  }
  if ('chart' in t) {
    return { id, span: t.span ?? 2, config: { kind: 'chart', dimension: t.chart, ...(t.measure ? { measure: t.measure } : {}), reduce: t.reduce ?? 'sum', type: t.type ?? 'bar' } }
  }
  if ('gauge' in t) {
    return { id, span: t.span ?? 1, config: { kind: 'gauge', label: t.gauge, ...(t.measure ? { measure: t.measure } : {}), reduce: t.reduce, min: t.min ?? 0, max: t.max ?? 100, ...(t.unit ? { unit: t.unit } : {}) } }
  }
  if ('pivot' in t) {
    return { id, span: t.span ?? 3, config: { kind: 'pivot', rows: t.pivot.rows, cols: t.pivot.cols, ...(t.pivot.measure ? { measure: t.pivot.measure } : {}), aggregate: t.pivot.aggregate ?? 'sum' } }
  }
  if ('tree' in t) {
    return { id, span: t.span ?? 1, config: { kind: 'tree', labelField: t.tree.labelField, parentField: t.tree.parentField } }
  }
  if ('filter' in t) {
    return { id, span: t.span ?? 3, config: { kind: 'filter', fields: t.filter } }
  }
  if ('tabs' in t) {
    return { id, span: t.span ?? 3, config: { kind: 'tabs', tabs: t.tabs.map((tab) => ({ label: tab.label, blocks: tab.tiles.map((tt) => tileBlock(entity, tt, nextId)) })) } }
  }
  return { id, span: t.span ?? 3, config: gridConfig(entity, t) }
}

/** Compose a dashboard screen from explicit tiles (KPI cards + gauges + charts +
 *  pivots + trees + a rich grid). */
export function dashScreen(
  entity: EntitySchema,
  meta: { id: string; title: string; order: number },
  tiles: Tile[],
): Screen {
  let n = 0
  const nextId = () => `blk-${++n}`
  const blocks = tiles.map((t) => tileBlock(entity, t, nextId))
  return { id: meta.id, entity: entity.name, title: meta.title, route: meta.id, blocks, nav: { show: true, label: meta.title, order: meta.order } }
}

/** FormatRule[] that color-code an enum field's cells by its option colors -
 *  turns a plain status column into enterprise status pills. */
export function statusPills(entity: EntitySchema, field: string): FormatRule[] {
  const f = entity.fields.find((x) => x.field === field)
  if (!f?.options) return []
  return f.options
    .filter((o) => o.color)
    .map((o) => ({ field, op: 'eq' as const, value: o.value as string | number, background: `color-mix(in srgb, ${o.color} 18%, transparent)`, color: o.color, bold: true }))
}

/** A list screen: an optional faceted filter panel + a rich grid (status pills,
 *  totals, row actions, drill-through). */
export function listScreen(
  entity: EntitySchema,
  meta: { id: string; title: string; order: number },
  opts: { filter?: string[]; grid?: GridOpts } = {},
): Screen {
  const blocks: Block[] = []
  if (opts.filter?.length) blocks.push({ id: 'filter-1', span: 3, config: { kind: 'filter', fields: opts.filter } })
  blocks.push({ id: 'grid-1', span: 3, config: gridConfig(entity, opts.grid ?? {}) })
  return { id: meta.id, entity: entity.name, title: meta.title, route: meta.id, blocks, nav: { show: true, label: meta.title, order: meta.order } }
}

/**
 * A form-showcase screen: a grid to pick a row + an editable record panel that
 * renders the full field form (phone / rating / tags / mask / slider editors)
 * inline. Lets a user see and try the rich editors on load, not just on edit.
 */
export function formScreen(
  entity: EntitySchema,
  meta: { id: string; title: string; order: number },
  fields?: string[],
  grid?: GridOpts,
  filter?: string[],
): Screen {
  const blocks: Block[] = []
  if (filter?.length) blocks.push({ id: 'filter-1', span: 3, config: { kind: 'filter', fields: filter } })
  blocks.push({ id: 'grid-1', span: 3, config: gridConfig(entity, grid ?? {}) })
  blocks.push({ id: 'record-1', span: 3, config: { kind: 'record', editable: true, ...(fields ? { fields } : {}) } })
  return { id: meta.id, entity: entity.name, title: meta.title, route: meta.id, blocks, nav: { show: true, label: meta.title, order: meta.order } }
}

/** A record detail-page screen: a full record view (header + status pill + metric
 *  tiles + tabbed Overview / related timelines) - the signature view for
 *  relation-heavy records (a customer / deal / patient / trip page). */
export function detailScreen(
  entity: EntitySchema,
  meta: { id: string; title: string; order: number },
  opts: { titleField: string; subtitleField?: string; statusField?: string; metricFields?: string[]; sections?: { label: string; fields: string[] }[]; related?: DetailRelated[] },
): Screen {
  const blocks: Block[] = [{ id: 'detail-1', span: 3, config: {
    kind: 'detail', titleField: opts.titleField,
    ...(opts.subtitleField ? { subtitleField: opts.subtitleField } : {}),
    ...(opts.statusField ? { statusField: opts.statusField } : {}),
    ...(opts.metricFields?.length ? { metricFields: opts.metricFields } : {}),
    ...(opts.sections?.length ? { sections: opts.sections } : {}),
    ...(opts.related?.length ? { related: opts.related } : {}),
  } }]
  return { id: meta.id, entity: entity.name, title: meta.title, route: meta.id, blocks, nav: { show: true, label: meta.title, order: meta.order } }
}

// --- the CRUD suite ---------------------------------------------------------

/** The screens a CRUD suite can contain. */
export type CrudScreenKind = 'list' | 'form' | 'detail' | 'dashboard'
/** How the suite's rows are edited. `'inline'` edits in the grid, `'form'` opens
 *  a popup form (the grid default), `'detail'` makes a row click navigate to the
 *  generated detail page (and leaves the list read-only). */
export type CrudEditingMode = 'inline' | 'form' | 'detail'

export type CrudSuiteOptions = {
  /** Which screens to generate. Default: `['list', 'form']`, plus `'detail'` when
   *  another entity relates to this one (there are children worth showing). */
  screens?: CrudScreenKind[]
  /** Row editing mode. Default `'form'`. */
  editing?: CrudEditingMode
  /** Nav order of the suite's first screen; later screens follow it. Default 0. */
  navOrder?: number
  /** Show a faceted filter panel on the list screen. Defaults to on when the
   *  entity has filter-friendly (enum / boolean / text) fields. */
  filter?: boolean
  /** Ids and routes already in use. The suite picks non-colliding ones BEFORE it
   *  wires drill-through, so a rename can never orphan a `rowLink`. */
  taken?: { ids?: ReadonlySet<string>; routes?: ReadonlySet<string> }
}

/** `base`, or the first free `${base}-${n}`. Records the result in `taken`. */
function claim(base: string, taken: Set<string>): string {
  if (!taken.has(base)) { taken.add(base); return base }
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  const out = `${base}-${n}`
  taken.add(out)
  return out
}

const primaryKeyOf = (entity: EntitySchema): string =>
  entity.idField ?? entity.fields.find((f) => f.primaryKey)?.field ?? entity.fields[0]?.field ?? 'id'

const isNumeric = (f: EntityField): boolean => f.type === 'number' && !f.primaryKey

/** Every relation pointing AT `entity` - each becomes a related-children tab on
 *  the detail page (including a self-referential FK, which reads as a hierarchy). */
function relatedChildren(entity: EntitySchema, entities: readonly EntitySchema[]): DetailRelated[] {
  const out: DetailRelated[] = []
  for (const other of entities) {
    for (const f of other.fields) {
      if (f.type !== 'relation' || f.relation?.entity !== entity.name) continue
      const title = other.fields.find((x) => x.type === 'text' && !x.primaryKey)?.field
      const status = other.fields.find((x) => x.type === 'enum' && !x.primaryKey)?.field
      const date = other.fields.find((x) => (x.type === 'date' || x.type === 'datetime' || x.type === 'dateString') && !x.primaryKey)?.field
      out.push({
        entity: other.name,
        foreignKey: f.field,
        label: other.label ?? other.name,
        ...(title ? { titleField: title } : {}),
        ...(status ? { statusField: status } : {}),
        ...(date ? { dateField: date } : {}),
      })
    }
  }
  return out
}

/**
 * The screens for one entity: a list, an edit form, a record detail page, and/or
 * an overview dashboard - already linked to each other. `entities` is the full
 * schema set so relations resolve (drill-through targets + child collections).
 */
export function crudSuiteScreens(
  entity: EntitySchema,
  entities: readonly EntitySchema[],
  opts: CrudSuiteOptions = {},
): Screen[] {
  const label = entity.label ?? entity.name
  const pk = primaryKeyOf(entity)
  const children = relatedChildren(entity, entities)
  const kinds = opts.screens ?? (children.length ? ['list', 'form', 'detail'] : ['list', 'form'])
  const wants = (k: CrudScreenKind) => kinds.includes(k)
  const editing = opts.editing ?? 'form'
  const order = opts.navOrder ?? 0

  // Claim ids + routes up front so `rowLink` can point at the detail screen's
  // FINAL id (deduping afterwards would leave the link dangling).
  const ids = new Set(opts.taken?.ids ?? [])
  const routes = new Set(opts.taken?.routes ?? [])
  const idFor = (base: string) => claim(base, ids)
  const routeFor = (base: string) => claim(base, routes)

  const listId = wants('list') ? idFor(entity.name) : ''
  const listRoute = wants('list') ? routeFor(entity.name) : ''
  const formId = wants('form') ? idFor(`${entity.name}-manage`) : ''
  const formRoute = wants('form') ? routeFor(`${entity.name}-manage`) : ''
  const detailId = wants('detail') ? idFor(`${entity.name}-detail`) : ''
  const detailRoute = wants('detail') ? routeFor(`${entity.name}-detail`) : ''
  const dashId = wants('dashboard') ? idFor(`${entity.name}-overview`) : ''
  const dashRoute = wants('dashboard') ? routeFor(`${entity.name}-overview`) : ''

  const detailCfg = defaultBlockConfig('detail', entity) as DetailConfig
  const facets = opts.filter === false ? [] : pickFacetFields(entity)
  const pills = detailCfg.statusField ? statusPills(entity, detailCfg.statusField) : []
  const hasNumeric = entity.fields.some(isNumeric)
  // 'detail' editing = a read-only list whose rows drill into the detail page.
  const drills = editing === 'detail' && !!detailId
  const grid: GridOpts = {
    ...(pills.length ? { format: pills } : {}),
    ...(hasNumeric ? { summaries: true } : {}),
    editing: drills ? 'none' : editing === 'inline' ? 'inline' : 'form',
    ...(drills ? { rowLink: { screen: detailId, targetField: pk } satisfies RowLink } : {}),
  }

  // Nav order is assigned once at the end, from the order the screens were
  // built, so no branch has to know how many ran before it.
  const screens: Screen[] = []
  if (wants('dashboard')) {
    const measure = entity.fields.find(isNumeric)?.field
    const dimension = detailCfg.statusField ?? entity.fields.find((f) => f.type === 'enum' && !f.primaryKey)?.field
    const tiles: Tile[] = [{ kpi: `Total ${label}`, reduce: 'count' }]
    if (measure) tiles.push({ kpi: `Total ${measure}`, measure, reduce: 'sum' })
    if (dimension) tiles.push({ chart: dimension, ...(measure ? { measure } : {}), reduce: measure ? 'sum' : 'count', type: 'bar' })
    tiles.push({ grid: true, ...(pills.length ? { format: pills } : {}) })
    screens.push({ ...dashScreen(entity, { id: dashId, title: `${label} overview`, order: 0 }, tiles), route: dashRoute })
  }
  if (wants('list')) {
    screens.push({
      ...listScreen(entity, { id: listId, title: label, order: 0 }, { ...(facets.length ? { filter: facets } : {}), grid }),
      route: listRoute,
    })
  }
  if (wants('form')) {
    screens.push({
      ...formScreen(entity, { id: formId, title: `Manage ${label}`, order: 0 }, undefined, { editing: editing === 'inline' ? 'inline' : 'form' }),
      route: formRoute,
    })
  }
  if (wants('detail')) {
    const base = detailScreen(entity, { id: detailId, title: `${label} detail`, order: 0 }, {
      titleField: detailCfg.titleField,
      ...(detailCfg.subtitleField ? { subtitleField: detailCfg.subtitleField } : {}),
      ...(detailCfg.statusField ? { statusField: detailCfg.statusField } : {}),
      ...(detailCfg.metricFields?.length ? { metricFields: detailCfg.metricFields } : {}),
      ...(children.length ? { related: children } : {}),
    })
    // A drill-through target is reached by clicking a row, so it stays out of the
    // nav; a detail page nobody links to keeps its nav entry.
    screens.push({ ...base, route: detailRoute, nav: { ...base.nav, show: !drills } })
  }
  return screens.map((s, i) => ({ ...s, nav: { ...s.nav, order: order + i } }))
}

/** Append a full CRUD suite for an existing entity (immutable, like `addScreenFromTemplate`). */
export function addCrudSuite(project: StudioProject, entityName: string, opts: CrudSuiteOptions = {}): StudioProject {
  const entity = entityOf(project, entityName)
  if (!entity) return project
  const taken = {
    ids: new Set(project.screens.map((s) => s.id)),
    routes: new Set(project.screens.map((s) => s.route)),
  }
  const navOrder = opts.navOrder ?? project.screens.length
  const screens = crudSuiteScreens(entity, project.entities, { ...opts, navOrder, taken })
  return { ...project, screens: [...project.screens, ...screens] }
}

export type CrudAppOptions = {
  title?: string
  /** Default source kind for entities with no explicit binding in `sources`. */
  dataSource?: DataSourceKind
  /** Per-entity source binding (a live SQL table, a REST endpoint, PGlite, ...). */
  sources?: Record<string, EntityDataSource>
  /** Per-entity seed rows, merged into memory / PGlite bindings. */
  seed?: Record<string, Record<string, unknown>[]>
  /** Per-entity suite overrides, keyed by entity name. */
  perEntity?: Record<string, CrudSuiteOptions>
  /** Lead with an overview dashboard over the most-referenced entity. Default true. */
  overviewDashboard?: boolean
  theme?: ProjectTheme
}

/** The entity the most relations point at (an app's hub - customers, projects,
 *  patients); falls back to the first schema. */
function hubEntity(schemas: readonly EntitySchema[]): EntitySchema | undefined {
  let best: EntitySchema | undefined
  let bestScore = -1
  for (const e of schemas) {
    const score = schemas.reduce(
      (n, other) => n + other.fields.filter((f) => f.type === 'relation' && f.relation?.entity === e.name).length,
      0,
    )
    if (score > bestScore) { best = e; bestScore = score }
  }
  return best
}

/**
 * A complete app from a set of schemas: an overview dashboard plus a CRUD suite
 * per entity, bound to the given data sources. This is the guided-onboarding
 * output - the designer wizard and `svgrid-studio init` both land here, so a
 * database connected from either host scaffolds the same app.
 */
export function crudAppFromSchemas(schemas: EntitySchema[], opts: CrudAppOptions = {}): StudioProject {
  const kind = opts.dataSource ?? 'memory'
  const hub = hubEntity(schemas)
  const ids = new Set<string>()
  const routes = new Set<string>()
  const screens: Screen[] = []

  if (opts.overviewDashboard !== false && hub) {
    const [overview] = crudSuiteScreens(hub, schemas, {
      screens: ['dashboard'],
      navOrder: 0,
      taken: { ids, routes },
    })
    // The app's front page: a plain "Overview" at the top of the nav.
    if (overview) screens.push({ ...overview, title: 'Overview', nav: { ...overview.nav, label: 'Overview', order: 0 } })
  }

  for (const schema of schemas) {
    screens.push(...crudSuiteScreens(schema, schemas, {
      ...opts.perEntity?.[schema.name],
      navOrder: screens.length,
      taken: { ids, routes },
    }))
  }

  const dataSources: Record<string, EntityDataSource> = {}
  for (const schema of schemas) {
    const source = opts.sources?.[schema.name] ?? defaultEntitySource(kind, schema.name)
    const seed = opts.seed?.[schema.name]
    dataSources[schema.name] = seed?.length && (source.kind === 'memory' || source.kind === 'pglite')
      ? { ...source, seed }
      : source
  }

  // Database-backed screens render on the server by default, so a generated app
  // ships real SvelteKit (load + form actions) rather than a client SPA.
  return withSsrDefaults(sanitizeProject({
    title: opts.title ?? 'My Studio App',
    entities: [...schemas],
    screens,
    dataSource: kind,
    dataSources,
    ...(opts.theme ? { theme: opts.theme } : {}),
  }))
}
