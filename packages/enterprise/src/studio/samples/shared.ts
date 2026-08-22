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
import type { PredicateExpr } from '../../expressions/expression-types.js'
import { generateValue } from '../sample-data.js'
import { gridConfig, type GridOpts } from '../screen-suites.js'
import { sanitizeProject, screenFromTemplate, buildDockLayout, type Block, type GridConfig, type Screen, type ScreenTemplate, type StudioProject, type EntityDataSource, type ShellStyle, type SchedulerViewConfig, type SchedulerViewMode, type AuthConfig, type AccessControl } from '../project.js'

// The generic screen factories live in `../screen-suites.js` (they are public API
// now - the guided CRUD suite builds on them). Re-exported here so every sample
// app keeps importing its whole toolkit from one place.
export { dashScreen, detailScreen, formScreen, gridConfig, listScreen, statusPills, type GridOpts, type Tile } from '../screen-suites.js'

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

/**
 * `field = value` as a form condition (see `EntityField.when`). Helpers rather
 * than hand-written literals because an operator the filter engine does not know
 * silently matches everything, which would leave a conditional field permanently
 * on-screen.
 */
export const whenIs = (field: string, value: string | number): PredicateExpr =>
  ({ kind: 'cmp', column: field, op: 'equals', value })

/** `field` is any one of `values`. */
export const whenIsAny = (field: string, values: ReadonlyArray<string | number>): PredicateExpr =>
  ({ kind: 'or', parts: values.map((value) => ({ kind: 'cmp', column: field, op: 'equals', value })) })

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
  opts: { filter?: string[]; record?: boolean; grid?: GridOpts; mode?: 'dock' | 'split' } = {},
): Screen {
  const blocks: Block[] = []
  if (opts.filter?.length) blocks.push({ id: 'filter-1', span: 3, config: { kind: 'filter', fields: opts.filter } })
  blocks.push({ id: 'grid-1', span: 3, config: gridConfig(entity, opts.grid ?? {}) })
  if (opts.record !== false) blocks.push({ id: 'record-1', span: 3, config: { kind: 'record', editable: true } })
  // `split` = fixed resizable panes (a console); `dock` = the full floatable manager.
  const layout = opts.mode ?? 'dock'
  const base: Screen = { id: meta.id, entity: entity.name, title: meta.title, route: meta.id, blocks, nav: { show: true, label: meta.title, order: meta.order }, layout }
  return { ...base, dock: buildDockLayout(base) }
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
  /** Bespoke app chrome: raw CSS written to the generated app's `custom.css` (imported
   *  after `app.css`, so it overrides). Scope rules under `.sv-app.<appClass>` so an
   *  app can look like its real-world archetype, not a recolored sibling. */
  customCss?: string
  /** Extra class on the shell root (the hook `customCss` targets). */
  appClass?: string
  /** A sign-in starter: `{ enabled: true }` gives the generated app a `/login` page,
   *  a signed-cookie session, and route guards (dependency-free, no DB). */
  auth?: AuthConfig
  /** Role-based access. With `auth`, seeds one demo login per role. */
  access?: AccessControl
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
      ...(opts.customCss ? { customCss: opts.customCss } : {}),
      ...(opts.appClass ? { appClass: opts.appClass } : {}),
      shell: { style: opts.navStyle ?? 'sidebar', brand: opts.brand, footer: opts.footer ?? '', navPosition: opts.navPosition ?? 'left' },
    },
    ...(opts.auth?.enabled ? { auth: opts.auth } : {}),
    ...(opts.access?.enabled ? { access: opts.access } : {}),
  })
}
