/**
 * Studio project model - the declarative spine the visual designer edits and the
 * codegen emits. A project is a multi-entity app: `entities` (the data model) +
 * `screens` (one per entity by default), where a screen is an ordered list of
 * data-bound `blocks` (grid, form, chart, dashboard, KPI, master-detail, lookup).
 *
 * Pure + node-safe (lives in the `./studio` subtree - `.js` imports, no Svelte,
 * no `sources/`), mirroring the immutable-ops style of `schema-designer.ts`:
 * every mutation returns a NEW project so Svelte reactivity + undo stay simple.
 * Block-config unions are defined here (not imported from `sources/`) to keep the
 * module resolvable under node16.
 */
import type { EntityField, EntityFieldType, EntitySchema } from '../schema.js'
import type { ChartType } from '@svgrid/grid'

export type Reduce = 'sum' | 'avg' | 'count' | 'min' | 'max'
export type DataSourceKind = 'memory' | 'sql' | 'supabase' | 'rest'
export type Presentation = 'modal' | 'drawer' | 'inline'

// --- per-entity data-source binding ----------------------------------------
// Each entity can bind to its own backend (a REST endpoint, a SQL table, a
// Supabase table, or the seeded in-memory store). Connection config is a
// design-time concern, so it lives on the project (keyed by entity name), NOT on
// the pure EntitySchema. The codegen branches on the resolved source per entity.

export type RestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type ParamLocation = 'path' | 'query' | 'header'
export type ParamType = 'string' | 'number' | 'boolean'
/** One request parameter in the REST builder (path `{id}`, query, or header). */
export type RequestParam = { name: string; location: ParamLocation; type: ParamType; value?: string }
export type SqlDialectKind = 'postgres' | 'mysql' | 'sqlite' | 'mssql' | 'supabase'

/** In-memory (seeded) source. `seed` carries curated rows (e.g. a sample app);
 *  when absent the codegen + preview synthesize realistic rows. */
export type MemorySource = { kind: 'memory'; seed?: Record<string, unknown>[] }
export type RestSource = {
  kind: 'rest'
  /** Origin + version prefix, e.g. `https://api.example.com/v1`. */
  baseUrl: string
  /** Collection path, e.g. `customers` or `albums/{id}/tracks`. */
  path: string
  method: RestMethod
  params: RequestParam[]
  idField?: string
  /** Dotted path in the response body holding the rows, e.g. `data.items`. */
  rowsPath?: string
  /** Dotted path holding the total row count, e.g. `data.total`. */
  totalPath?: string
}
export type SqlSource = { kind: 'sql'; table: string; dialect?: SqlDialectKind }
export type SupabaseSource = { kind: 'supabase'; table: string; url?: string; key?: string }
/** Where one entity's rows come from. */
export type EntityDataSource = MemorySource | RestSource | SqlSource | SupabaseSource

/** The kinds of data-bound block a screen can hold. */
export type BlockKind = 'grid' | 'form' | 'chart' | 'dashboard' | 'kpi' | 'master-detail' | 'lookup' | 'pivot' | 'filter' | 'record'

export type GridAlign = 'left' | 'center' | 'right'
export type GridColumnConfig = { field: string; show: boolean; header?: string; width?: number; align?: GridAlign; pin?: 'left' | 'right' }
/** How a grid edits its rows: read-only, inline (Excel-style cells), or a popup form. */
export type GridEditing = 'none' | 'inline' | 'form'
/** Row height preset. */
export type GridDensity = 'compact' | 'normal' | 'comfortable'
/** Where the pagination footer sits. */
export type PagerPosition = 'top' | 'bottom' | 'both'
export type GridConfig = {
  kind: 'grid'
  columns: GridColumnConfig[]
  pageSize: number
  selectable: boolean
  sortable: boolean
  filterable: boolean
  editing: GridEditing
  /** Presentation of the edit form when `editing === 'form'`. */
  formPresentation: Presentation
  density: GridDensity
  striped: boolean
  /** Excel-style cell/range selection. */
  cellSelection: boolean
  /** Show a totals/summary footer row. */
  rowSummaries: boolean
  /** Paginate (false shows all rows, no pager). */
  paginated: boolean
  /** Where the pager sits when paginated. */
  paginationPosition: PagerPosition
  /** Page-size choices in the pager's selector. */
  pageSizeOptions: number[]
  /** Drill-through: clicking a row navigates to `screen`, filtered by the clicked
   *  row's `sourceField` value on the target's `targetField`. */
  rowLink?: RowLink
  /** Per-row action buttons (edit / delete / navigate) shown in an actions column. */
  rowActions?: RowAction[]
  /** No-code conditional formatting: color / bold a cell by its value. Compiled to
   *  the grid's `conditionalFormats` rule engine. */
  formatRules?: FormatRule[]
}
/** A conditional-formatting comparison. */
export type FormatOp = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'contains' | 'empty' | 'notEmpty'
/** One no-code format rule: style a `field`'s cell when the comparison holds. */
export type FormatRule = { field: string; op: FormatOp; value?: string | number; color?: string; background?: string; bold?: boolean }
/** A row-click drill-through to another screen. */
export type RowLink = { screen: string; sourceField?: string; targetField: string }
/** One per-row action button. */
export type RowActionKind = 'edit' | 'delete' | 'navigate'
export type RowAction = {
  kind: RowActionKind
  label?: string
  /** navigate: target screen id. */
  screen?: string
  /** navigate: field on this row whose value is passed (defaults to the id). */
  sourceField?: string
  /** navigate: field on the target entity to filter by. */
  targetField?: string
}
/** Legacy standalone edit-form block. Editing is now a Grid property; kept so old
 *  `studio.config.json` files still parse. Not offered in the palette. */
export type FormConfig = { kind: 'form'; presentation: Presentation }
/** A chart, optionally drilling into `drillScreen` (filtered by the clicked category). */
export type ChartConfig = { kind: 'chart'; dimension: string; measure?: string; reduce: Reduce; type: ChartType; drillScreen?: string }
export type KpiConfig = { kind: 'kpi'; label: string; measure?: string; reduce: Reduce }
export type DashboardConfig = { kind: 'dashboard' }
export type MasterDetailConfig = { kind: 'master-detail'; childEntity: string; foreignKey: string }
export type LookupConfig = { kind: 'lookup'; field: string }
/** A pivot table (SvPivotDesigner): row/column dimensions + one aggregated measure.
 *  `aggregate` reuses the Reduce set (all valid pivot aggregators). */
export type PivotConfig = { kind: 'pivot'; rows: string[]; cols: string[]; measure?: string; aggregate: Reduce }
/** A faceted filter panel that drives the screen's grid. `fields` are the columns
 *  exposed as facets (enum/boolean -> select, text -> contains search). */
export type FilterPanelConfig = { kind: 'filter'; fields: string[]; title?: string }
/** A record detail panel: shows the row selected in the screen's grid via
 *  SvGridEditPanel. `fields` optionally narrows which fields show (empty = all). */
export type RecordConfig = { kind: 'record'; fields?: string[]; editable: boolean }
export type BlockConfig =
  | GridConfig | FormConfig | ChartConfig | KpiConfig | DashboardConfig | MasterDetailConfig | LookupConfig
  | PivotConfig | FilterPanelConfig | RecordConfig

export type Block = {
  id: string
  /** Coarse width in a 3-col grid (legacy + quick buttons). `colSpan` overrides it. */
  span: 1 | 2 | 3
  /** Fine width in a 12-col grid (1-12), set by the horizontal drag / slider.
   *  Falls back to `span * 4` (so 1/2/3 -> 4/8/12) when unset. */
  colSpan?: number
  /** Canvas/preview region height in px. Undefined = the kind's natural default.
   *  Applies to height-driven blocks (grid, chart, master-detail). */
  height?: number
  config: BlockConfig
}
/** The number of columns (1-12) a block occupies in the 12-col layout. */
export const blockColumns = (b: Pick<Block, 'span' | 'colSpan'>): number =>
  Math.max(1, Math.min(12, Math.round(b.colSpan ?? b.span * 4)))
/** Navigation placement for a screen (Manage Pages: show/hide + label + order). */
export type ScreenNav = { show?: boolean; label?: string; order?: number }
export type Screen = { id: string; entity: string; title: string; route: string; blocks: Block[]; nav?: ScreenNav }

/** The generated app's shell (master layout): sidebar vs top-nav, brand, footer. */
export type ShellStyle = 'sidebar' | 'top-nav'
export type ShellConfig = { style?: ShellStyle; brand?: string; footer?: string; navPosition?: 'left' | 'right' }
export type ProjectTheme = { accent?: string; preset?: string; mode?: 'light' | 'dark'; shell?: ShellConfig }

/** A mutating CRUD action, gated by RBAC (reads are implied by screen access). */
export type CrudAction = 'create' | 'update' | 'delete'
export const CRUD_ACTIONS: readonly CrudAction[] = ['create', 'update', 'delete']
/** Access rules for one role. */
export type RoleAccess = {
  role: string
  /** Screen ids the role can open. `'*'` = every screen. */
  screens: '*' | string[]
  /** Write actions the role may perform. `'*'` = all; read is implied by screen access. */
  actions: '*' | CrudAction[]
}
/** Role-based access control for the app. When `enabled`, the generator emits a
 *  `src/lib/access.ts` and gates nav / actions in the UI AND the server route. */
export type AccessControl = {
  enabled: boolean
  roles: RoleAccess[]
  /** Fallback role when the app can't resolve one from the session. Default-denies. */
  defaultRole?: string
}
/** Does a role's rules permit opening a screen? */
export const roleCanScreen = (r: RoleAccess, screenId: string): boolean =>
  r.screens === '*' || r.screens.includes(screenId)
/** Does a role's rules permit a write action? */
export const roleCanAction = (r: RoleAccess, action: CrudAction): boolean =>
  r.actions === '*' || r.actions.includes(action)

export type StudioProject = {
  title: string
  entities: EntitySchema[]
  screens: Screen[]
  /** Default source kind for new entities; per-entity overrides live in `dataSources`. */
  dataSource: DataSourceKind
  /** Per-entity data-source binding, keyed by entity name. */
  dataSources?: Record<string, EntityDataSource>
  theme?: ProjectTheme
  /** Role-based access control (optional; off unless `access.enabled`). */
  access?: AccessControl
  /** Emit an audit trail: connected routes log create/update/delete + an /audit viewer. */
  audit?: boolean
  /** Localization: when enabled, emit a message catalog + locale switcher and route
   *  nav / titles / column headers through `t()`. */
  i18n?: I18nConfig
}

/** Localization config: the locales the app ships and which is the default. */
export type I18nConfig = { enabled: boolean; locales: string[]; defaultLocale?: string }

export type ProjectIssueLevel = 'error' | 'warning'
export type ProjectIssue = { level: ProjectIssueLevel; message: string; screen?: string }

/** One palette entry: a draggable block kind + what it needs to be useful. */
export type PaletteItem = { kind: BlockKind; label: string; needs?: 'measure' | 'child' }

/** The designer's block palette, in menu order. (Editing is a Grid property, so
 *  there's no standalone form block.) */
export const blockPalette: ReadonlyArray<PaletteItem> = [
  { kind: 'grid', label: 'Grid' },
  { kind: 'chart', label: 'Chart', needs: 'measure' },
  { kind: 'pivot', label: 'Pivot', needs: 'measure' },
  { kind: 'dashboard', label: 'Dashboard' },
  { kind: 'kpi', label: 'KPI tile', needs: 'measure' },
  { kind: 'master-detail', label: 'Master / detail', needs: 'child' },
  { kind: 'filter', label: 'Filter panel' },
  { kind: 'record', label: 'Record panel' },
  { kind: 'lookup', label: 'Lookup' },
]

// --- helpers ---------------------------------------------------------------

/** A free `${prefix}${n}` id not already in `taken`. */
function uid(prefix: string, taken: ReadonlySet<string>): string {
  let n = 1
  while (taken.has(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}

export function entityOf(project: StudioProject, name: string): EntitySchema | undefined {
  return project.entities.find((e) => e.name === name)
}

const gridHidden = (f: EntityField): boolean =>
  f.hidden === true || (typeof f.hidden === 'object' && f.hidden.grid === true)

function pickDimension(entity: EntitySchema): string {
  const nonKey = entity.fields.filter((f) => !f.primaryKey)
  // Prefer a low-cardinality dimension: enum, then boolean, then text.
  return (
    nonKey.find((f) => f.type === 'enum')?.field ??
    nonKey.find((f) => f.type === 'boolean')?.field ??
    nonKey.find((f) => f.type === 'text')?.field ??
    nonKey[0]?.field ??
    entity.fields[0]?.field ??
    ''
  )
}

function pickMeasure(entity: EntitySchema): string | undefined {
  return entity.fields.find((f) => f.type === 'number' && !f.primaryKey)?.field
}

/** Sensible grid columns for an entity: every non-grid-hidden field, shown. */
export function gridColumns(entity: EntitySchema): GridColumnConfig[] {
  const pk = entity.idField ?? entity.fields.find((f) => f.primaryKey)?.field
  return entity.fields
    .filter((f) => !gridHidden(f))
    // Hide the raw primary-key column by default (a "co1 / dl2" id column reads
    // as unfinished); everything else is visible. Users can re-enable it.
    .map((f) => ({ field: f.field, show: f.field !== pk, header: f.label }))
}

/** A default config for a freshly-added block of `kind`, sized for the entity. */
export function defaultBlockConfig(kind: BlockKind, entity: EntitySchema): BlockConfig {
  switch (kind) {
    case 'grid':
      return { kind, columns: gridColumns(entity), pageSize: 10, selectable: true, sortable: true, filterable: false, editing: 'form', formPresentation: 'modal', density: 'normal', striped: false, cellSelection: false, rowSummaries: false, paginated: true, paginationPosition: 'bottom', pageSizeOptions: [10, 25, 50, 100] }
    case 'form':
      return { kind, presentation: 'modal' }
    case 'chart': {
      const measure = pickMeasure(entity)
      return { kind, dimension: pickDimension(entity), measure, reduce: measure ? 'sum' : 'count', type: 'bar' }
    }
    case 'kpi': {
      const measure = pickMeasure(entity)
      return { kind, label: measure ? `Total ${measure}` : `Total ${entity.label ?? entity.name}`, measure, reduce: measure ? 'sum' : 'count' }
    }
    case 'dashboard':
      return { kind }
    case 'master-detail':
      return { kind, childEntity: '', foreignKey: '' }
    case 'lookup':
      return { kind, field: entity.fields.find((f) => f.type === 'relation')?.field ?? entity.fields[0]?.field ?? '' }
    case 'pivot': {
      const measure = pickMeasure(entity)
      const dim = pickDimension(entity)
      return { kind, rows: dim ? [dim] : [], cols: [], measure, aggregate: measure ? 'sum' : 'count' }
    }
    case 'filter':
      return { kind, fields: pickFacetFields(entity) }
    case 'record':
      return { kind, editable: false }
  }
}

/** Low-cardinality, filter-friendly fields (enum, boolean, then text), non-key.
 *  Used to seed the faceted Filter panel. Caps at 4 so the panel stays compact. */
export function pickFacetFields(entity: EntitySchema): string[] {
  return entity.fields
    .filter((f) => !f.primaryKey && (f.type === 'enum' || f.type === 'boolean' || f.type === 'text'))
    .sort((a, b) => facetRank(a.type) - facetRank(b.type))
    .slice(0, 4)
    .map((f) => f.field)
}
const facetRank = (t: EntityFieldType): number => (t === 'enum' ? 0 : t === 'boolean' ? 1 : 2)

const DEFAULT_SPAN: Record<BlockKind, 1 | 2 | 3> = {
  grid: 3, form: 1, chart: 2, dashboard: 3, kpi: 1, 'master-detail': 3, lookup: 1, pivot: 3, filter: 1, record: 1,
}

function makeBlock(kind: BlockKind, entity: EntitySchema, taken: ReadonlySet<string>): Block {
  return { id: uid(`${kind}-`, taken), span: DEFAULT_SPAN[kind], config: defaultBlockConfig(kind, entity) }
}

/** A default screen for an entity: a grid (editing via a popup form by default). */
export function defaultScreenFor(entity: EntitySchema): Screen {
  const grid = makeBlock('grid', entity, new Set<string>())
  return { id: entity.name, entity: entity.name, title: entity.label ?? entity.name, route: entity.name, blocks: [grid] }
}

/** A new project from a set of entities: one default screen each, in-memory. */
export function createProject(entities: EntitySchema[], opts: { title?: string; dataSource?: DataSourceKind } = {}): StudioProject {
  return {
    title: opts.title ?? 'My Studio App',
    entities: [...entities],
    screens: entities.map(defaultScreenFor),
    dataSource: opts.dataSource ?? 'memory',
  }
}

// --- immutable ops ---------------------------------------------------------

function mapScreen(project: StudioProject, screenId: string, fn: (s: Screen) => Screen): StudioProject {
  return { ...project, screens: project.screens.map((s) => (s.id === screenId ? fn(s) : s)) }
}

export function addBlock(project: StudioProject, screenId: string, kind: BlockKind): StudioProject {
  return mapScreen(project, screenId, (s) => {
    const entity = entityOf(project, s.entity)
    if (!entity) return s
    const taken = new Set(s.blocks.map((b) => b.id))
    return { ...s, blocks: [...s.blocks, makeBlock(kind, entity, taken)] }
  })
}

/** Insert a new block at `index` (drag-drop from the palette). Clamps to range. */
export function addBlockAt(project: StudioProject, screenId: string, kind: BlockKind, index: number): StudioProject {
  return mapScreen(project, screenId, (s) => {
    const entity = entityOf(project, s.entity)
    if (!entity) return s
    const taken = new Set(s.blocks.map((b) => b.id))
    const block = makeBlock(kind, entity, taken)
    const blocks = [...s.blocks]
    blocks.splice(Math.max(0, Math.min(index, blocks.length)), 0, block)
    return { ...s, blocks }
  })
}

export function removeBlock(project: StudioProject, screenId: string, blockId: string): StudioProject {
  return mapScreen(project, screenId, (s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== blockId) }))
}

/** Clone a block (config + width/height) with a fresh id, inserted right after it. */
export function duplicateBlock(project: StudioProject, screenId: string, blockId: string): StudioProject {
  return mapScreen(project, screenId, (s) => {
    const idx = s.blocks.findIndex((b) => b.id === blockId)
    if (idx < 0) return s
    const src = s.blocks[idx]!
    const clone: Block = { ...src, id: uid(`${src.config.kind}-`, new Set(s.blocks.map((b) => b.id))), config: structuredClone(src.config) }
    return { ...s, blocks: [...s.blocks.slice(0, idx + 1), clone, ...s.blocks.slice(idx + 1)] }
  })
}

/** Move a block one slot up (`-1`) or down (`+1`). No-op at the ends. */
export function moveBlock(project: StudioProject, screenId: string, blockId: string, dir: -1 | 1): StudioProject {
  return mapScreen(project, screenId, (s) => {
    const i = s.blocks.findIndex((b) => b.id === blockId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= s.blocks.length) return s
    const blocks = [...s.blocks]
    ;[blocks[i], blocks[j]] = [blocks[j]!, blocks[i]!]
    return { ...s, blocks }
  })
}

/** Reorder a block to an explicit index (drag-drop). Clamps to range. */
export function reorderBlock(project: StudioProject, screenId: string, blockId: string, toIndex: number): StudioProject {
  return mapScreen(project, screenId, (s) => {
    const from = s.blocks.findIndex((b) => b.id === blockId)
    if (from < 0) return s
    const blocks = [...s.blocks]
    const [moved] = blocks.splice(from, 1)
    blocks.splice(Math.max(0, Math.min(toIndex, blocks.length)), 0, moved!)
    return { ...s, blocks }
  })
}

/** Patch a block's config (merged) and/or span. */
export function updateBlock(
  project: StudioProject,
  screenId: string,
  blockId: string,
  patch: { span?: 1 | 2 | 3; colSpan?: number; height?: number; config?: Partial<BlockConfig> },
): StudioProject {
  return mapScreen(project, screenId, (s) => ({
    ...s,
    blocks: s.blocks.map((b) =>
      b.id === blockId
        ? { ...b, span: patch.span ?? b.span, colSpan: patch.colSpan ?? b.colSpan, height: patch.height ?? b.height, config: patch.config ? ({ ...b.config, ...patch.config } as BlockConfig) : b.config }
        : b,
    ),
  }))
}

/** Replace an entity's schema (e.g. after field edits), keeping its screens. */
export function updateEntity(project: StudioProject, name: string, schema: EntitySchema): StudioProject {
  const entities = project.entities.map((e) => (e.name === name ? schema : e))
  if (name === schema.name) return { ...project, entities }
  // Renamed: retarget its screens AND any master-detail block pointing at it.
  const screens = project.screens.map((s) => {
    const blocks = s.blocks.map((b) =>
      b.config.kind === 'master-detail' && b.config.childEntity === name
        ? { ...b, config: { ...b.config, childEntity: schema.name } }
        : b,
    )
    return { ...s, entity: s.entity === name ? schema.name : s.entity, blocks }
  })
  return { ...project, entities, screens }
}

/** Add an entity + its default screen. */
export function addEntity(project: StudioProject, schema: EntitySchema): StudioProject {
  if (entityOf(project, schema.name)) return project
  return { ...project, entities: [...project.entities, schema], screens: [...project.screens, defaultScreenFor(schema)] }
}

/** Remove an entity and every screen bound to it. */
export function removeEntity(project: StudioProject, name: string): StudioProject {
  return {
    ...project,
    entities: project.entities.filter((e) => e.name !== name),
    screens: project.screens.filter((s) => s.entity !== name),
  }
}

/** Append a screen, making its id AND route unique against the existing set. */
function appendScreen(project: StudioProject, base: Screen, keyBase: string): StudioProject {
  const ids = new Set(project.screens.map((s) => s.id))
  const routes = new Set(project.screens.map((s) => s.route))
  const id = ids.has(base.id) ? uid(`${keyBase}-`, ids) : base.id
  const route = routes.has(base.route) ? uid(`${base.route}-`, routes) : base.route
  return { ...project, screens: [...project.screens, { ...base, id, route }] }
}

export function addScreen(project: StudioProject, entity: string): StudioProject {
  const schema = entityOf(project, entity)
  if (!schema) return project
  return appendScreen(project, defaultScreenFor(schema), entity)
}

export function removeScreen(project: StudioProject, screenId: string): StudioProject {
  return { ...project, screens: project.screens.filter((s) => s.id !== screenId) }
}

export function updateScreen(project: StudioProject, screenId: string, patch: Partial<Pick<Screen, 'title' | 'route' | 'entity' | 'nav'>>): StudioProject {
  return mapScreen(project, screenId, (s) => ({ ...s, ...patch }))
}

export function setDataSource(project: StudioProject, dataSource: DataSourceKind): StudioProject {
  return { ...project, dataSource }
}

/** A skeleton binding for a kind, seeded with the entity's name as its table/path. */
export function defaultEntitySource(kind: DataSourceKind, entityName: string): EntityDataSource {
  switch (kind) {
    case 'rest': return { kind: 'rest', baseUrl: '', path: entityName, method: 'GET', params: [] }
    case 'sql': return { kind: 'sql', table: entityName }
    case 'supabase': return { kind: 'supabase', table: entityName }
    default: return { kind: 'memory' }
  }
}

/** Bind one entity to a data source (REST / SQL / Supabase / in-memory). */
export function setEntityDataSource(project: StudioProject, entityName: string, source: EntityDataSource): StudioProject {
  return { ...project, dataSources: { ...project.dataSources, [entityName]: source } }
}

/** The resolved source for an entity (its explicit binding, else in-memory). */
export function entityDataSource(project: StudioProject, entityName: string): EntityDataSource {
  return project.dataSources?.[entityName] ?? { kind: 'memory' }
}

export function setTheme(project: StudioProject, theme: ProjectTheme): StudioProject {
  return { ...project, theme: { ...project.theme, ...theme } }
}

/** Apply a Studio theme preset: sets the preset id and clears any manual accent
 *  override so the preset's own accent takes effect (the user can re-tune it
 *  afterwards with the color picker). Pass `accent` to pin one explicitly. */
export function setThemePreset(project: StudioProject, preset: string, accent?: string): StudioProject {
  const theme = { ...project.theme, preset }
  if (accent) theme.accent = accent
  else delete theme.accent
  return { ...project, theme }
}

/** Configure the generated app shell (layout style, brand, footer, nav position). */
export function setShell(project: StudioProject, shell: ShellConfig): StudioProject {
  return { ...project, theme: { ...project.theme, shell: { ...project.theme?.shell, ...shell } } }
}

// --- screen templates ------------------------------------------------------

export type ScreenTemplate = 'crud' | 'dashboard' | 'master-detail' | 'empty'

/** Build a screen for an entity from a template (a preset arrangement of blocks). */
export function screenFromTemplate(
  entity: EntitySchema,
  template: ScreenTemplate,
  opts: { child?: EntitySchema; foreignKey?: string } = {},
): Screen {
  const taken = new Set<string>()
  const make = (kind: BlockKind, span?: 1 | 2 | 3, config?: BlockConfig): Block => {
    const b = makeBlock(kind, entity, taken)
    taken.add(b.id)
    if (span) b.span = span
    if (config) b.config = config
    return b
  }
  const measure = pickMeasure(entity)
  const label = entity.label ?? entity.name

  let blocks: Block[]
  if (template === 'empty') {
    blocks = []
  } else if (template === 'dashboard') {
    const kpis: Block[] = [make('kpi', 1, { kind: 'kpi', label: `Total ${label}`, reduce: 'count' })]
    if (measure) kpis.push(make('kpi', 1, { kind: 'kpi', label: `Total ${measure}`, measure, reduce: 'sum' }))
    blocks = [...kpis, make('chart', 2), make('grid', 3)]
  } else if (template === 'master-detail') {
    const md = make('master-detail', 3, {
      kind: 'master-detail',
      childEntity: opts.child?.name ?? '',
      foreignKey: opts.foreignKey ?? opts.child?.fields.find((f) => f.type === 'relation' && f.relation?.entity === entity.name)?.field ?? '',
    })
    blocks = [make('grid', 3), md]
  } else {
    blocks = [make('grid', 3)] // crud (the grid edits via a popup form)
  }
  return { id: entity.name, entity: entity.name, title: label, route: entity.name, blocks }
}

/** Add a screen built from a template. `child` (for master-detail) is an entity name. */
export function addScreenFromTemplate(
  project: StudioProject,
  entityName: string,
  template: ScreenTemplate,
  opts: { child?: string; foreignKey?: string } = {},
): StudioProject {
  const entity = entityOf(project, entityName)
  if (!entity) return project
  const base = screenFromTemplate(entity, template, {
    child: opts.child ? entityOf(project, opts.child) : undefined,
    foreignKey: opts.foreignKey,
  })
  return appendScreen(project, base, entityName)
}

// --- persistence: round-trippable studio.config -----------------------------

/** `name`, or the first free `${name}_${n}` if taken. Records the result. */
function makeUnique(name: string, taken: Set<string>): string {
  if (!taken.has(name)) { taken.add(name); return name }
  let i = 2
  while (taken.has(`${name}_${i}`)) i++
  const u = `${name}_${i}`
  taken.add(u)
  return u
}

/**
 * Enforce the structural invariants the designer + codegen rely on: unique
 * entity names, unique field names within an entity, unique screen ids + routes,
 * and unique block ids within a screen. In-app ops already keep these, but a
 * hand-edited / externally-produced `studio.config.json` may not - and a
 * duplicate key would crash a keyed `{#each}` list at render time. Idempotent:
 * a project that already satisfies the invariants is returned value-equal.
 */
export function sanitizeProject(project: StudioProject): StudioProject {
  const entityNames = new Set<string>()
  const entities: EntitySchema[] = []
  for (const e of project.entities) {
    if (entityNames.has(e.name)) continue // drop a duplicate-named entity; screens still resolve to the survivor
    entityNames.add(e.name)
    const fieldNames = new Set<string>()
    entities.push({ ...e, fields: e.fields.map((f) => ({ ...f, field: makeUnique(f.field, fieldNames) })) })
  }
  const ids = new Set<string>()
  const routes = new Set<string>()
  const screens = project.screens.map((s) => {
    const blockIds = new Set<string>()
    return {
      ...s,
      id: makeUnique(s.id, ids),
      route: makeUnique(s.route, routes),
      blocks: s.blocks.map((b) => ({ ...b, id: makeUnique(b.id, blockIds) })),
    }
  })
  const result: StudioProject = { ...project, entities, screens }
  // Drop per-entity source bindings for entities that no longer exist.
  if (project.dataSources) {
    const pruned = Object.fromEntries(Object.entries(project.dataSources).filter(([n]) => entityNames.has(n)))
    if (Object.keys(pruned).length) result.dataSources = pruned
    else delete result.dataSources
  }
  return result
}

/** Serialize a project to a `studio.config.json` string (the persisted design). */
export function serializeProject(project: StudioProject): string {
  return JSON.stringify(project, null, 2)
}

/**
 * Parse a `studio.config.json` string back into a `StudioProject`, validating
 * the shape. Note: only the data model round-trips - any runtime functions on an
 * entity (`computed` / `validate` / `hooks`) are not part of the config.
 */
export function parseProject(json: string): StudioProject {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('parseProject: not valid JSON')
  }
  if (!raw || typeof raw !== 'object') throw new Error('parseProject: expected a project object')
  const p = raw as Partial<StudioProject>
  // An empty `entities` array is a valid work-in-progress (a "start from zero"
  // project). Codegen is gated separately by validateProject / isProjectValid.
  if (!Array.isArray(p.entities)) throw new Error('parseProject: missing "entities"')
  if (!Array.isArray(p.screens)) throw new Error('parseProject: missing "screens"')
  return sanitizeProject({
    title: typeof p.title === 'string' ? p.title : 'My Studio App',
    entities: p.entities as EntitySchema[],
    screens: p.screens as Screen[],
    dataSource: (p.dataSource ?? 'memory') as DataSourceKind,
    ...(p.dataSources && typeof p.dataSources === 'object' ? { dataSources: p.dataSources as Record<string, EntityDataSource> } : {}),
    ...(p.theme && typeof p.theme === 'object' ? { theme: p.theme as ProjectTheme } : {}),
    ...(p.access && typeof p.access === 'object' ? { access: p.access as AccessControl } : {}),
    ...(typeof p.audit === 'boolean' ? { audit: p.audit } : {}),
    ...(p.i18n && typeof p.i18n === 'object' ? { i18n: p.i18n as I18nConfig } : {}),
  })
}

/** Validate a project. Errors block codegen; warnings are advisory. */
export function validateProject(project: StudioProject): ProjectIssue[] {
  const issues: ProjectIssue[] = []
  if (project.entities.length === 0) issues.push({ level: 'error', message: 'Add at least one entity.' })
  if (project.screens.length === 0) issues.push({ level: 'warning', message: 'No screens yet.' })

  const routes = new Set<string>()
  for (const s of project.screens) {
    if (!entityOf(project, s.entity)) {
      issues.push({ level: 'error', message: `Screen "${s.title}" points at a missing entity "${s.entity}".`, screen: s.id })
    }
    if (routes.has(s.route)) issues.push({ level: 'error', message: `Duplicate route "/${s.route}".`, screen: s.id })
    routes.add(s.route)
    if (s.blocks.length === 0) issues.push({ level: 'warning', message: `Screen "${s.title}" has no blocks.`, screen: s.id })
    for (const b of s.blocks) {
      if (b.config.kind === 'master-detail') {
        if (!b.config.childEntity || !b.config.foreignKey) {
          issues.push({ level: 'warning', message: `Master/detail on "${s.title}" needs a child entity + foreign key.`, screen: s.id })
        } else if (!entityOf(project, b.config.childEntity)) {
          issues.push({ level: 'warning', message: `Master/detail on "${s.title}" points at a missing child entity "${b.config.childEntity}".`, screen: s.id })
        }
      }
    }
  }
  return issues
}

export function isProjectValid(project: StudioProject): boolean {
  return !validateProject(project).some((i) => i.level === 'error')
}
