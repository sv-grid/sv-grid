/**
 * Shared helpers for the curated sample apps. A `SampleApp` is a ready-made
 * `StudioProject` (entities + screens + curated seed + theme) that a user loads
 * to see a beautiful, working multi-entity app in a couple of clicks.
 *
 * Pure + node-safe (studio subtree): each sample is plain data built from the
 * same immutable ops the designer uses, so it round-trips through
 * parse/serialize and generates a runnable app with no special-casing.
 */
import type { EntitySchema } from '../../schema.js'
import type { ChartType } from '@svgrid/grid'
import { generateValue } from '../sample-data.js'
import { defaultBlockConfig, sanitizeProject, screenFromTemplate, buildDockLayout, type Block, type BlockConfig, type DetailRelated, type FormatRule, type GridConfig, type GridDensity, type KpiFormat, type Reduce, type RowAction, type RowLink, type Screen, type ScreenTemplate, type StudioProject, type EntityDataSource, type ShellStyle, type SchedulerViewConfig, type SchedulerViewMode } from '../project.js'

type Row = Record<string, unknown>

/**
 * Extend a curated seed to `target` rows so grids scroll and charts / KPIs look
 * substantial (real dashboards have data). The hand-authored rows stay first;
 * extra rows get realistic generated values, valid ids, and foreign keys drawn
 * from `fkPools` (relation field -> list of parent ids).
 */
export function pad(schema: EntitySchema, rows: Row[], target: number, fkPools: Record<string, string[]> = {}): Row[] {
  if (rows.length >= target) return rows
  const pk = schema.idField ?? schema.fields.find((f) => f.primaryKey)?.field ?? 'id'
  const prefix = String(rows[0]?.[pk] ?? 'r').replace(/\d+$/, '') || 'r'
  // Title-like text fields (a record's display name) must stay ON-DOMAIN - the
  // generic generator would put "Premium Backpack" on a property board. So cycle
  // the entity's own curated seed values (with a numeric suffix on wrap) instead.
  // Exclude identifier-shaped fields (ref / number / sku / code) which have formats.
  const firstText = schema.fields.find((f) => f.type === 'text' && f.field !== pk && !/id$|ref|no$|number|code|sku/i.test(f.field))?.field
  const titleLike = new Set(schema.fields.filter((f) => f.type === 'text' && (/^(name|title|subject|headline|label)$/i.test(f.field) || f.field === firstText)).map((f) => f.field))
  const seedVals = (field: string) => rows.map((r) => r[field]).filter((v) => v != null && v !== '')
  const out = [...rows]
  for (let i = rows.length; i < target; i++) {
    const row: Row = {}
    for (const f of schema.fields) {
      if (f.field === pk) { row[f.field] = `${prefix}${i + 1}`; continue }
      if (f.computed || f.formula) continue // derived at runtime - never seeded
      if (f.type === 'relation') {
        const pool = fkPools[f.field] ?? []
        row[f.field] = pool.length ? pool[i % pool.length] : (rows[i % rows.length]?.[f.field] ?? '')
        continue
      }
      if (titleLike.has(f.field)) {
        const vals = seedVals(f.field)
        if (vals.length) { const round = Math.floor(i / vals.length); row[f.field] = round === 0 ? vals[i] : `${vals[i % vals.length]} ${round + 1}`; continue }
      }
      row[f.field] = generateValue(f, i)
    }
    out.push(row)
  }
  return out
}

/** The `id` values of a seed array (for building foreign-key pools). */
export const ids = (rows: Row[]): string[] => rows.map((r) => String(r.id))

/** A ready-made app shown in the gallery. */
export type SampleApp = {
  /** Stable id (also the `--template` value). */
  id: string
  /** Display name, e.g. "CRM". */
  name: string
  /** One-line description for the gallery card. */
  description: string
  /** A single emoji used as the card icon. */
  emoji: string
  /** Accent color (themes the built app). */
  accent: string
  /** Build the full project (fresh each call). */
  build: () => StudioProject
}

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
function gridConfig(entity: EntitySchema, opts: GridOpts): BlockConfig {
  const base = defaultBlockConfig('grid', entity) as GridConfig
  return {
    ...base,
    ...(opts.format ? { formatRules: opts.format } : {}),
    ...(opts.rowActions ? { rowActions: opts.rowActions } : {}),
    ...(opts.rowLink ? { rowLink: opts.rowLink } : {}),
    ...(opts.summaries ? { rowSummaries: true } : {}),
    ...(opts.density ? { density: opts.density } : {}),
    ...(opts.pageSize ? { pageSize: opts.pageSize } : {}),
  }
}

/** One dashboard tile -> a Block. Recurses for `tabs` (whose children must be
 *  display blocks: chart / kpi / gauge / pivot / tree). */
function tileBlock(entity: EntitySchema, t: Tile, i: number): Block {
  const id = `blk-${i + 1}`
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
    return { id, span: t.span ?? 3, config: { kind: 'tabs', tabs: t.tabs.map((tab) => ({ label: tab.label, blocks: tab.tiles.map((tt, j) => tileBlock(entity, tt, j)) })) } }
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
  const blocks = tiles.map((t, i) => tileBlock(entity, t, i))
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

/** A Kanban board screen: an optional filter panel + a board grouping rows by an
 *  enum field into draggable columns (the signature "pipeline" view). */
export function boardScreen(
  entity: EntitySchema,
  meta: { id: string; title: string; order: number },
  opts: { groupBy: string; titleField: string; badgeField?: string; subtitleField?: string; filter?: string[]; openScreen?: string },
): Screen {
  const blocks: Block[] = []
  if (opts.filter?.length) blocks.push({ id: 'filter-1', span: 3, config: { kind: 'filter', fields: opts.filter } })
  blocks.push({ id: 'board-1', span: 3, config: {
    kind: 'board', groupBy: opts.groupBy, titleField: opts.titleField,
    ...(opts.badgeField ? { badgeField: opts.badgeField } : {}),
    ...(opts.subtitleField ? { subtitleField: opts.subtitleField } : {}),
    ...(opts.openScreen ? { openScreen: opts.openScreen } : {}),
  } })
  return { id: meta.id, entity: entity.name, title: meta.title, route: meta.id, blocks, nav: { show: true, label: meta.title, order: meta.order } }
}

/** A calendar screen: an optional filter + a month event-calendar placing rows by
 *  a date field (the signature "schedule" view). */
export function calendarScreen(
  entity: EntitySchema,
  meta: { id: string; title: string; order: number },
  opts: { dateField: string; titleField: string; colorField?: string; filter?: string[]; openScreen?: string },
): Screen {
  const blocks: Block[] = []
  if (opts.filter?.length) blocks.push({ id: 'filter-1', span: 3, config: { kind: 'filter', fields: opts.filter } })
  blocks.push({ id: 'calendar-1', span: 3, config: {
    kind: 'calendar', dateField: opts.dateField, titleField: opts.titleField,
    ...(opts.colorField ? { colorField: opts.colorField } : {}),
    ...(opts.openScreen ? { openScreen: opts.openScreen } : {}),
  } })
  return { id: meta.id, entity: entity.name, title: meta.title, route: meta.id, blocks, nav: { show: true, label: meta.title, order: meta.order } }
}

/** A scheduler screen: the grid rendered as a Week / Day / Timeline calendar with optional
 *  per-resource columns and drag-to-reschedule. Richer than calendarScreen (start + end,
 *  resources, editable write-back) - showcases the grid's scheduler view. */
export function schedulerScreen(
  entity: EntitySchema,
  meta: { id: string; title: string; order: number },
  opts: { startField: string; endField?: string; titleField?: string; colorField?: string; resourceField?: string; initialView?: SchedulerViewMode; editable?: boolean },
): Screen {
  const grid = gridConfig(entity, {}) as GridConfig
  const scheduler: SchedulerViewConfig = {
    startField: opts.startField,
    ...(opts.endField ? { endField: opts.endField } : {}),
    ...(opts.titleField ? { titleField: opts.titleField } : {}),
    ...(opts.colorField ? { colorField: opts.colorField } : {}),
    ...(opts.resourceField ? { resourceField: opts.resourceField } : {}),
    initialView: opts.initialView ?? 'week',
    editable: opts.editable ?? true,
    drawer: true,
  }
  const block: Block = { id: 'grid-1', span: 3, config: { ...grid, scheduler } }
  return { id: meta.id, entity: entity.name, title: meta.title, route: meta.id, blocks: [block], nav: { show: true, label: meta.title, order: meta.order } }
}

/** A docking-workspace screen: a filter + grid + record panel arranged as a dockable
 *  console (SvDockManager). The smart auto-layout puts filters left, the grid centre, the
 *  record panel right; the user can float / pin / rearrange. Showcases screen `layout: 'dock'`. */
export function workspaceScreen(
  entity: EntitySchema,
  meta: { id: string; title: string; order: number },
  opts: { filter?: string[]; record?: boolean; grid?: GridOpts } = {},
): Screen {
  const blocks: Block[] = []
  if (opts.filter?.length) blocks.push({ id: 'filter-1', span: 3, config: { kind: 'filter', fields: opts.filter } })
  blocks.push({ id: 'grid-1', span: 3, config: gridConfig(entity, opts.grid ?? {}) })
  if (opts.record !== false) blocks.push({ id: 'record-1', span: 3, config: { kind: 'record', editable: true } })
  const base: Screen = { id: meta.id, entity: entity.name, title: meta.title, route: meta.id, blocks, nav: { show: true, label: meta.title, order: meta.order }, layout: 'dock' }
  return { ...base, dock: buildDockLayout(base) }
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

/** Build a screen from a template, then override its id / route / title / nav.
 *  `linkScreen` wires a master-detail parent row to drill into a detail screen. */
export function screen(
  entity: EntitySchema,
  template: ScreenTemplate,
  over: { id: string; title: string; route?: string; order: number; child?: EntitySchema; foreignKey?: string; linkScreen?: string },
): Screen {
  const base = screenFromTemplate(entity, template, { child: over.child, foreignKey: over.foreignKey })
  const blocks = over.linkScreen
    ? base.blocks.map((b) => (b.config.kind === 'master-detail' ? { ...b, config: { ...b.config, linkScreen: over.linkScreen } } : b))
    : base.blocks
  return {
    ...base,
    blocks,
    id: over.id,
    title: over.title,
    route: over.route ?? over.id,
    nav: { show: true, label: over.title, order: over.order },
  }
}

/** Assemble a sample project: entities + screens + per-entity curated seed + theme/shell. */
export function project(opts: {
  title: string
  brand: string
  accent: string
  footer?: string
  navStyle?: ShellStyle
  navPosition?: 'left' | 'right'
  /** A design-system preset id (font + radius + palette) from `studioThemes` -
   *  what makes each app read as a distinct product (Salesforce vs Excel vs Linear). */
  preset?: string
  mode?: 'light' | 'dark'
  entities: EntitySchema[]
  screens: Screen[]
  seed: Record<string, Record<string, unknown>[]>
}): StudioProject {
  const dataSources: Record<string, EntityDataSource> = {}
  for (const e of opts.entities) dataSources[e.name] = { kind: 'memory', seed: opts.seed[e.name] ?? [] }
  return sanitizeProject({
    title: opts.title,
    entities: opts.entities,
    screens: opts.screens,
    dataSource: 'memory',
    dataSources,
    theme: {
      accent: opts.accent,
      ...(opts.preset ? { preset: opts.preset } : {}),
      ...(opts.mode ? { mode: opts.mode } : {}),
      shell: { style: opts.navStyle ?? 'sidebar', brand: opts.brand, footer: opts.footer ?? '', navPosition: opts.navPosition ?? 'left' },
    },
  })
}
