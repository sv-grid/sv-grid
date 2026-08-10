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
import type { ChartType, DockManagerState, DockNode, DockPane, DockTabs } from '@svgrid/grid'
import { uiComponentSpec } from './ui-components.js'

export type Reduce = 'sum' | 'avg' | 'count' | 'min' | 'max'
export type DataSourceKind = 'memory' | 'sql' | 'supabase' | 'rest' | 'pglite'
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
export type SqlDialectKind = 'postgres' | 'mysql' | 'sqlite' | 'mssql' | 'supabase' | 'turso'

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
/** Embedded Postgres (PGlite) - a real, persistent database with ZERO backend
 *  setup. Runs in the browser, persisting to IndexedDB. Swap for a `sql` source
 *  pointed at hosted Postgres to go to production (same schema + SQL). */
export type PgliteSource = { kind: 'pglite'; table: string; seed?: Record<string, unknown>[] }
/** Where one entity's rows come from. */
export type EntityDataSource = MemorySource | RestSource | SqlSource | SupabaseSource | PgliteSource

/** The kinds of block a screen can hold: data-bound (entity-derived) or the
 *  entity-agnostic `'component'` (a UI-kit component from `UI_COMPONENT_REGISTRY`,
 *  usable on any screen, including a freestanding one with no entity). */
export type BlockKind = 'grid' | 'form' | 'chart' | 'dashboard' | 'kpi' | 'gauge' | 'tree' | 'tabs' | 'accordion' | 'master-detail' | 'lookup' | 'pivot' | 'filter' | 'record' | 'board' | 'calendar' | 'detail' | 'component'

export type GridAlign = 'left' | 'center' | 'right'
/** No-code per-column value formatting. Compiles to the grid's `format` (CellFormatConfig):
 *  a raw `1234.5` becomes `$1,234.50` / `42%` / `Jun 27, 2026` without a code renderer. */
export type ColumnFormat =
  | { type: 'number'; decimals?: number }
  | { type: 'currency'; currency?: string }
  | { type: 'percent'; decimals?: number; /** cell values are 0-100 (42 -> 42%) not 0-1. */ valueIsPercentPoints?: boolean }
  | { type: 'date'; pattern?: string }
  | { type: 'datetime'; pattern?: string }
/** No-code rich cell renderer for a column. Unlike `ColumnFormat` (value formatting),
 *  these render a component/link: an auto-colored status pill, a progress bar, or a
 *  clickable link. Compiles to a `cell` snippet on the column. Mutually exclusive with
 *  `format` (a cell is either formatted text or a rich renderer). */
export type ColumnCellType =
  | { kind: 'badge' }
  | { kind: 'progress'; max?: number }
  | { kind: 'link'; as?: 'url' | 'email' | 'tel' }
export type GridColumnConfig = { field: string; show: boolean; header?: string; width?: number; align?: GridAlign; pin?: 'left' | 'right'; /** Aggregate this column into the group summary row when the grid is grouped. */ aggregate?: Reduce; /** No-code display formatting (currency / percent / date / ...). */ format?: ColumnFormat; /** No-code rich cell renderer (badge / progress / link). */ cellType?: ColumnCellType }
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
  /** Which filtering surfaces show when `filterable` is on. Undefined = the global search
   *  box only (back-compat). Combine a global search, a per-column filter row, and/or the
   *  column header filter menu. */
  filterUi?: GridFilterUi
  editing: GridEditing
  /** Presentation of the edit form when `editing === 'form'`. */
  formPresentation: Presentation
  /** Form layout depth (all optional; default = the auto 2-column form of all fields). */
  formColumns?: 1 | 2 | 3
  /** Restrict + order the form's fields (field names). */
  formFields?: string[]
  /** Group fields into titled fieldsets. */
  formSections?: Array<{ title?: string; fields: string[] }>
  /** Dialog title override + width for the modal/drawer form. */
  formTitle?: string
  formSize?: 'sm' | 'md' | 'lg'
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
  /** No-code row grouping: fields to group rows by (outermost first). When set, the
   *  grid loads the full dataset and groups/sorts/paginates client-side (so groups
   *  span every row, not just a server page) and shows the grouping controls. Per-column
   *  `aggregate` values roll up into each group's summary row. */
  grouping?: string[]
  /** No-code export toolbar: a button bar above the grid wired to the grid's own
   *  export API (CSV / JSON / copy-to-clipboard - no extra dependencies). */
  export?: GridExportConfig
  /** No-code tree data: render the grid's own rows as an expand/collapse hierarchy
   *  built from a self-referential parent field. Mutually exclusive with `grouping`. */
  treeData?: TreeDataConfig
  /** Render the grid's rows as a calendar / scheduler (a view of the grid, like the
   *  Kanban board). Mutually exclusive with grouping / tree. Uses the enterprise
   *  scheduler renderer (`enableSchedulerView`). */
  scheduler?: SchedulerViewConfig
  /** Raw SvGrid prop overrides from the block's "All properties" panel - every grid
   *  prop the curated controls don't manage. Passed straight through to `<SvGrid>`
   *  (deduped against the curated props at codegen time). */
  props?: Record<string, unknown>
}
/** Which calendar view the scheduler opens on / offers. */
export type SchedulerViewMode = 'month' | 'week' | 'day' | 'agenda' | 'timelineDay' | 'timelineWeek' | 'timelineMonth' | 'timelineYear'
/** No-code scheduler-view config: map the entity's fields onto calendar events. Only
 *  `startField` is required; the rest are optional refinements. Compiles to SvGrid's
 *  `scheduler` prop + write-back handlers. */
export type SchedulerViewConfig = {
  /** Field holding the event start (Date / epoch / ISO string). Required. */
  startField: string
  /** Field holding the event end. Omit to use a default duration from the start. */
  endField?: string
  /** Field for the event title. Defaults to the first column. */
  titleField?: string
  /** Field holding a per-event accent color. */
  colorField?: string
  /** Field that groups events into per-resource columns (people / rooms / machines). */
  resourceField?: string
  /** Field holding a recurrence rule (one event per matching day). */
  recurrenceField?: string
  /** Boolean field marking an all-day event. */
  allDayField?: string
  /** The view shown first. Default 'month'. */
  initialView?: SchedulerViewMode
  /** Enable drag-to-move + edge-resize (writes back through the data source). */
  editable?: boolean
  /** Show the built-in event detail drawer. */
  drawer?: boolean
}
/** Tree-data grid config: `parentField` is a self-referential FK (a row whose parent is
 *  empty / not in the set is a root); `labelField` is the column that shows the indented,
 *  expandable tree cell. */
export type TreeDataConfig = { parentField: string; labelField: string }
/** Which export affordances the grid toolbar shows. All go through the grid's built-in
 *  export API (dependency-free). Empty / all-false = no toolbar. */
export type GridExportConfig = { csv?: boolean; json?: boolean; copy?: boolean }
/** Which filtering surfaces the grid shows (when `filterable`). `global` = the search-all
 *  box, `row` = a filter input under each header, `menu` = the column header filter menu. */
export type GridFilterUi = { global?: boolean; row?: boolean; menu?: boolean }
/** A conditional-formatting comparison. */
export type FormatOp = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'contains' | 'empty' | 'notEmpty'
/** One no-code format rule: style a `field`'s cell when the comparison holds. */
export type FormatRule = { field: string; op: FormatOp; value?: string | number; color?: string; background?: string; bold?: boolean }
/** A row-click drill-through to another screen. */
export type RowLink = { screen: string; sourceField?: string; targetField: string }
/** One per-row action button. */
export type RowActionKind = 'edit' | 'delete' | 'navigate' | 'custom'
export type RowAction = {
  kind: RowActionKind
  label?: string
  /** navigate: target screen id. */
  screen?: string
  /** navigate: field on this row whose value is passed (defaults to the id). */
  sourceField?: string
  /** navigate: field on the target entity to filter by. */
  targetField?: string
  /** custom: stable id - becomes the generated `/api/actions/<id>` route + handler
   *  name. Required when `kind` is `'custom'`. */
  id?: string
  /** custom: icon glyph (rendered next to the label). */
  icon?: string
  /** custom: confirm before running, e.g. "Approve this order?". */
  confirm?: string
}

/** A custom action: a button wired to a generated stub API route + client
 *  handler - the plumbing (fetch, loading state, error handling, RBAC gate) is
 *  generated; the developer fills in the actual logic in the stub route.
 *  Screen-level actions render in the screen's toolbar and work on ANY screen,
 *  including one with no bound entity. Row-level actions (via `RowAction`'s
 *  `'custom'` kind) render per-row in a grid, alongside edit/delete/navigate. */
export type ActionConfig = { id: string; label: string; icon?: string; confirm?: string }
/** Legacy standalone edit-form block. Editing is now a Grid property; kept so old
 *  `studio.config.json` files still parse. Not offered in the palette. */
export type FormConfig = { kind: 'form'; presentation: Presentation }
/** A chart, optionally drilling into `drillScreen` (filtered by the clicked category). */
export type ChartConfig = { kind: 'chart'; dimension: string; measure?: string; reduce: Reduce; type: ChartType; drillScreen?: string; dataLabels?: boolean; color?: string }
/** Number format for a KPI value. `auto` keeps the legacy behavior ($ when the
 *  measure's label carries `$`, else grouped number). */
export type KpiFormat = 'auto' | 'number' | 'currency' | 'percent' | 'compact'
export type KpiConfig = {
  kind: 'kpi'
  label: string
  measure?: string
  reduce: Reduce
  /** Value formatting. Defaults to `auto`. */
  format?: KpiFormat
  /** Field to bucket the measure by for an inline sparkline (e.g. a date or stage). */
  trendField?: string
  /** Aggregate per sparkline bucket. Defaults to `reduce`. */
  trendReduce?: Reduce
  /** Target value: shows a "% of target" delta chip. */
  target?: number
}
/** A radial gauge (SvGauge) of one aggregated measure within [min, max]. Like a
 *  KPI but rendered as an arc - good for utilization, progress, scores. */
export type GaugeConfig = { kind: 'gauge'; label: string; measure?: string; reduce: Reduce; min: number; max: number; unit?: string }
/** A hierarchical tree (SvTree) built from the entity's own rows: `labelField` is
 *  the node text, `parentField` is a self-referential FK (a row whose parent is
 *  empty / unknown is a root). Good for categories, folders, org charts. */
export type TreeConfig = { kind: 'tree'; labelField: string; parentField: string }
/** One tab of a Tabs container: a label + its own ordered child blocks. */
export type StudioTab = { label: string; blocks: Block[] }
/** A tabbed container (SvTabs) grouping display blocks into tabs. Children are the
 *  controller-free, `allRows`-driven blocks (see `TAB_CHILD_KINDS`). */
export type TabsConfig = { kind: 'tabs'; tabs: StudioTab[] }
/** One section of an Accordion container: a label + its own ordered child blocks. */
export type AccordionSection = { label: string; blocks: Block[] }
/** An accordion container (SvAccordion): collapsible sections, each hosting its own
 *  child blocks (same container-child set as Tabs). `multiple` lets several sections
 *  stay open at once (default: single-open). */
export type AccordionConfig = { kind: 'accordion'; sections: AccordionSection[]; multiple?: boolean }
export type DashboardConfig = { kind: 'dashboard' }
export type MasterDetailConfig = { kind: 'master-detail'; childEntity: string; foreignKey: string; linkScreen?: string }
export type LookupConfig = { kind: 'lookup'; field: string }
/** A pivot table (SvPivotDesigner): row/column dimensions + one aggregated measure.
 *  `aggregate` reuses the Reduce set (all valid pivot aggregators). */
export type PivotConfig = { kind: 'pivot'; rows: string[]; cols: string[]; measure?: string; aggregate: Reduce }
/** A faceted filter panel that drives the screen's grid. `fields` are the columns
 *  exposed as facets (enum/boolean -> select, text -> contains search). */
export type FilterPanelConfig = { kind: 'filter'; fields: string[]; title?: string }
/** A record detail panel: shows the row selected in the screen's grid via
 *  SvGridEditPanel. `fields` optionally narrows which fields show (empty = all). */
export type RecordConfig = { kind: 'record'; fields?: string[]; editable: boolean; presentation?: Presentation }
/** A Kanban board (SvBoard): columns are an `enum` field's options (`groupBy`),
 *  rows become draggable cards titled by `titleField`. Dragging a card changes its
 *  `groupBy` value. Optional `badgeField` (a chip) + `subtitleField` (secondary line). */
export type BoardConfig = { kind: 'board'; groupBy: string; titleField: string; badgeField?: string; subtitleField?: string; openScreen?: string }
/** A month event-calendar (SvSchedule): each row with a `dateField` value is an
 *  event on that day, labelled by `titleField` and (optionally) tinted by an enum
 *  `colorField`. Good for appointments / events / bookings / shifts. */
export type CalendarConfig = { kind: 'calendar'; dateField: string; titleField: string; colorField?: string; openScreen?: string }
/** A related child collection shown as a tab on a record detail page. */
export type DetailRelated = { entity: string; foreignKey: string; label?: string; titleField?: string; subtitleField?: string; dateField?: string; statusField?: string; parentField?: string }
/** A full record "detail page" (SvRecordDetail): a header (title + subtitle +
 *  colored `statusField` pill + `metricFields` tiles), a tabbed Overview of
 *  `sections` (field groups), and one tab per `related` child collection (a
 *  timeline of the children pointing back at the record). The universal signature
 *  view for relation-heavy entities where a board / calendar does not fit. */
export type DetailConfig = { kind: 'detail'; titleField: string; subtitleField?: string; statusField?: string; metricFields?: string[]; sections?: { label: string; fields: string[] }[]; related?: DetailRelated[] }
/** A UI-kit component (from `UI_COMPONENT_REGISTRY`, keyed by `component`) dropped
 *  onto a screen. Entity-agnostic - works on a freestanding page or mixed onto an
 *  entity-bound screen alike. `props` holds its configured "chrome" values, keyed
 *  by the registry entry's prop `key`; a component with `hasContent` also stores
 *  its literal text content under the reserved `_content` key. */
/** A data binding for one component prop (or `_content`): its value is computed
 *  from the screen's rows instead of a static literal. `aggregate` reduces a field
 *  over all rows (a KPI-style number), `field` reads the first row's field, `expr`
 *  is a raw JS expression over `rows`. Needs an entity screen (rows to bind to). */
export type ComponentBinding =
  | { kind: 'aggregate'; field?: string; reduce: Reduce }
  | { kind: 'field'; field: string }
  | { kind: 'expr'; code: string }
export type ComponentConfig = { kind: 'component'; component: string; props: Record<string, unknown>; name?: string; bindings?: Record<string, ComponentBinding> }
export type BlockConfig =
  | GridConfig | FormConfig | ChartConfig | KpiConfig | GaugeConfig | TreeConfig | TabsConfig | AccordionConfig | DashboardConfig | MasterDetailConfig | LookupConfig
  | PivotConfig | FilterPanelConfig | RecordConfig | BoardConfig | CalendarConfig | DetailConfig | ComponentConfig

/** Block kinds allowed inside a Tabs / Accordion container: the controller-free,
 *  `allRows`-driven display blocks (no grid / form / master-detail, which need the
 *  screen controller). `component` covers any UI-kit component added by key. */
export const TAB_CHILD_KINDS: ReadonlyArray<BlockKind> = ['chart', 'kpi', 'gauge', 'dashboard', 'pivot', 'tree', 'component']
/** Alias: the same set applies to Accordion sections. */
export const CONTAINER_CHILD_KINDS = TAB_CHILD_KINDS
/** Display-block child kinds (no `component`) - what the container "add block" menu offers;
 *  components are added separately, by registry key, via `addContainerComponent`. */
export const CONTAINER_DISPLAY_KINDS: ReadonlyArray<BlockKind> = ['chart', 'kpi', 'gauge', 'dashboard', 'pivot', 'tree']

/** All blocks on a screen, flattened to include the children nested in Tabs
 *  containers - used to detect kinds for imports / data loading. */
export function flattenBlocks(blocks: ReadonlyArray<Block>): Block[] {
  const out: Block[] = []
  for (const b of blocks) {
    out.push(b)
    if (b.config.kind === 'tabs') for (const t of b.config.tabs) out.push(...flattenBlocks(t.blocks))
    if (b.config.kind === 'accordion') for (const s of b.config.sections) out.push(...flattenBlocks(s.blocks))
  }
  return out
}

/** User style overrides for a block's wrapper element (the card around the block).
 *  Each field is an OVERRIDE - `undefined` keeps the block kind's default look. Applied
 *  identically in the designer preview and the generated app (see `blockStyleCss`). */
export type BlockStyle = {
  /** Force a border on (true) or off (false); undefined = the kind's default. */
  border?: boolean
  /** Force a drop shadow on (true) or off (false); undefined = default. */
  shadow?: boolean
  /** Inner padding, px. */
  padding?: number
  /** Outer margin, px. */
  margin?: number
  /** Background color (any CSS color). */
  background?: string
  /** Corner radius, px. */
  radius?: number
}

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
  /** Per-block appearance overrides (border / shadow / padding / margin / bg / radius). */
  style?: BlockStyle
  /** Extra CSS class(es) put on the block's wrapper, so custom.css can target it. */
  className?: string
  config: BlockConfig
}

/** Sanitize a user-typed class list to a safe value (letters/digits/_/- and spaces) so
 *  it can never break out of a `class="..."` attribute. Shared by block/screen/app. */
export function sanitizeClassName(raw: string | undefined): string {
  return (raw ?? '').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, ' ').slice(0, 120)
}
/** The sanitized extra class(es) for a block's wrapper. */
export function blockClassName(block: Pick<Block, 'className'>): string {
  return sanitizeClassName(block.className)
}
/** The number of columns (1-12) a block occupies in the 12-col layout. */
export const blockColumns = (b: Pick<Block, 'span' | 'colSpan'>): number =>
  // Default to full width when a block sets neither colSpan nor span (Copilot /
  // hand-authored configs may omit both) - never emit `span NaN` into the HTML.
  Math.max(1, Math.min(12, Math.round(b.colSpan ?? (b.span != null ? b.span * 4 : 12))))

/** Restrict a user-typed color to a safe subset so it can't break out of an inline
 *  `style="..."` attribute (hex, rgb()/hsl(), named colors, css vars). */
const safeColor = (c: string): string => c.replace(/[^#a-zA-Z0-9(),.%\s_-]/g, '').slice(0, 64)

/** The CSS declarations for a block's style overrides, for its wrapper element - shared
 *  by codegen and the designer so the preview matches the generated app. Empty when no
 *  overrides. Numeric fields are safe; the background color is sanitized. */
export function blockStyleCss(style: BlockStyle | undefined): string {
  if (!style) return ''
  const d: string[] = []
  if (style.border === true) d.push('border: 1px solid var(--sg-border, #e6e8ec)')
  else if (style.border === false) d.push('border: none')
  if (style.shadow === true) d.push('box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06)')
  else if (style.shadow === false) d.push('box-shadow: none')
  if (typeof style.padding === 'number') d.push(`padding: ${style.padding}px`)
  if (typeof style.margin === 'number') d.push(`margin: ${style.margin}px`)
  if (style.background) d.push(`background: ${safeColor(style.background)}`)
  if (typeof style.radius === 'number') d.push(`border-radius: ${style.radius}px`)
  return d.join('; ')
}

/** Merge a partial style patch over a block's style, dropping keys set to undefined;
 *  returns undefined when nothing is left (keeps the model + serialized config clean). */
export function mergeBlockStyle(base: BlockStyle | undefined, patch: Partial<BlockStyle>): BlockStyle | undefined {
  const merged: Record<string, unknown> = { ...base, ...patch }
  for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k]
  return Object.keys(merged).length ? (merged as BlockStyle) : undefined
}
/** Navigation placement for a screen (Manage Pages: show/hide + label + order). */
export type ScreenNav = { show?: boolean; label?: string; order?: number }

/** The always-present page lifecycle handlers the Code view edits. Kept as named
 *  constants so codegen, the designer, and the manifest agree on the slot names.
 *  `onLoad` runs on mount (with the page context); `onDestroy` runs on unmount
 *  (cleanup: timers, subscriptions, aborts). */
export const ON_LOAD = 'onLoad'
export const ON_DESTROY = 'onDestroy'
/** Every lifecycle slot the Code view can edit, in display order. */
export const HANDLER_SLOTS: ReadonlyArray<string> = [ON_LOAD, ON_DESTROY]
/** The handler-steps key for a component block's click event. */
export const clickSlot = (blockId: string) => `click:${blockId}`
/** The handler-steps key for a grid block's row-select (row click) event. The
 *  compiled steps get the clicked `row` in scope (use row-field values). */
export const rowSelectSlot = (blockId: string) => `rowSelect:${blockId}`
/** The handler-steps key for a component block's change (value change) event. */
export const changeSlot = (blockId: string) => `change:${blockId}`
/** Generic event slot - `click`/`change` produce the same keys as clickSlot/changeSlot,
 *  so existing projects keep their wiring; any other declared component event
 *  (focus, select, toggle, ...) gets its own `<event>:<blockId>` slot. */
export const eventSlot = (event: string, blockId: string) => `${event}:${blockId}`
/** The handler-steps key for the screen's form-submit (record saved) event. The
 *  compiled steps get the submitted `row` (values) in scope. */
export const FORM_SUBMIT = 'formSubmit'

/** One event on the Grid, exposed to code-behind as `ctx.grid.<method> = (e) => {}`.
 *  `prop` is the SvGrid callback it wires to (empty for `dataEvent`s, which fire from
 *  Studio's data controller on create/update/delete rather than from the grid markup). */
export type GridEventDef = { key: string; method: string; prop: string; params: string; builtin: boolean; desc: string; dataEvent?: boolean }
/** The Grid's real event surface (mirrors SvGrid's `on*` callbacks). Studio wires
 *  every one into `ctx.grid` so page code can subscribe with `ctx.grid.onCellClick =
 *  (e) => {}`. `params` is the handler's parameter list, with `Row` as the row-type
 *  placeholder (substituted per screen). `builtin` marks events a Studio feature may
 *  already use (sort/filter/paginate/edit/row-click) - codegen COMPOSES the user's
 *  handler onto the built-in rather than emitting a duplicate prop. Signatures are
 *  transcribed from packages/grid/src/SvGrid.types.ts. */
export const GRID_EVENTS: readonly GridEventDef[] = [
  { key: 'rowClick', method: 'onRowClick', prop: 'onRowClick', builtin: true, desc: 'A data row is single-clicked.', params: 'e: { rowIndex: number; columnId: string; row: Row }' },
  { key: 'rowDoubleClick', method: 'onRowDoubleClick', prop: 'onRowDoubleClick', builtin: true, desc: 'A data row is double-clicked.', params: 'e: { rowIndex: number; columnId: string; row: Row }' },
  { key: 'cellClick', method: 'onCellClick', prop: 'onCellClick', builtin: false, desc: 'A data cell is single-clicked.', params: 'e: { rowIndex: number; colIndex: number; columnId: string; value: unknown; row: Row }' },
  { key: 'cellDoubleClick', method: 'onCellDoubleClick', prop: 'onCellDoubleClick', builtin: false, desc: 'A data cell is double-clicked.', params: 'e: { rowIndex: number; colIndex: number; columnId: string; value: unknown; row: Row }' },
  { key: 'rowSelectionChange', method: 'onRowSelectionChange', prop: 'onRowSelectionChange', builtin: false, desc: 'The row selection changes.', params: 'selection: Record<string, boolean>, rows: Row[]' },
  { key: 'cellSelectionChange', method: 'onCellSelectionChange', prop: 'onCellSelectionChange', builtin: false, desc: 'The cell-selection rectangle changes.', params: 'ranges: Array<[number, number, number, number]>' },
  { key: 'activeCellChange', method: 'onActiveCellChange', prop: 'onActiveCellChange', builtin: false, desc: 'The active cell changes.', params: 'cell: { rowIndex: number; colIndex: number; columnId: string }' },
  { key: 'cellValueChange', method: 'onCellValueChange', prop: 'onCellValueChange', builtin: true, desc: 'An inline cell edit is committed.', params: 'e: { rowIndex: number; columnId: string; oldValue: unknown; newValue: unknown; row: Row }' },
  { key: 'sortingChange', method: 'onSortingChange', prop: 'onSortingChange', builtin: true, desc: 'The sort clauses change.', params: 'sorting: Array<{ id: string; desc: boolean }>' },
  { key: 'filtersChange', method: 'onFiltersChange', prop: 'onFiltersChange', builtin: true, desc: 'Any in-grid filter changes.', params: 'filters: { global: string; columns: Array<{ id: string; operator: string; value: string; valueTo?: string; selectedValues?: string[] }> }' },
  { key: 'paginationChange', method: 'onPaginationChange', prop: 'onPaginationChange', builtin: true, desc: 'The page or page size changes.', params: 'pagination: { pageIndex: number; pageSize: number }' },
  { key: 'columnOrderChange', method: 'onColumnOrderChange', prop: 'onColumnOrderChange', builtin: false, desc: 'The column order changes.', params: 'order: ReadonlyArray<string>' },
  { key: 'scrollBottomReached', method: 'onScrollBottomReached', prop: 'onScrollBottomReached', builtin: false, desc: 'The body scrolls near the bottom (lazy-load hook).', params: 'e: { scrollTop: number; scrollHeight: number; clientHeight: number }' },
  { key: 'noteChange', method: 'onNoteChange', prop: 'onNoteChange', builtin: false, desc: 'A cell note/comment is saved or removed (needs editable comments).', params: 'e: { rowId: string; columnId: string; note: string }' },
  { key: 'rowDragEnd', method: 'onRowDragEnd', prop: 'onRowDragEnd', builtin: false, desc: 'A managed row drag settles (needs row dragging enabled).', params: 'e: { row: Row; toIndex: number; sameGrid: boolean; fromGridId: number; toGridId: number }' },
  // Data-layer events - fired by the screen's data controller after a write settles
  // (form save, inline edit, delete action, or ctx.data.create/update/delete), not by
  // the grid markup. Only fire on entity screens (which have a data source).
  { key: 'rowAdded', method: 'onRowAdded', prop: '', builtin: false, dataEvent: true, desc: 'A row was created (form / ctx.data.create).', params: 'row: Row' },
  { key: 'rowUpdated', method: 'onRowUpdated', prop: '', builtin: false, dataEvent: true, desc: 'A row was updated (form / inline edit / ctx.data.update).', params: 'row: Row' },
  { key: 'rowDeleted', method: 'onRowDeleted', prop: '', builtin: false, dataEvent: true, desc: 'A row was deleted (delete action / ctx.data.delete).', params: 'id: string' },
]

// --- logic core: screen state + a small expression engine --------------------

/** A screen-scoped reactive variable (`ctx.state.<name>`). Emitted as `$state`. */
export type StateVarType = 'string' | 'number' | 'boolean' | 'json'
export type StateVar = { name: string; type: StateVarType; initial?: string }

const identSafe = (s: string): string => (s || '').replace(/[^a-zA-Z0-9_$]/g, '_').replace(/^([0-9])/, '_$1') || 'v'

/** The `$state(...)` initializer for a variable's declared type. */
export function stateInitExpr(v: StateVar): string {
  const raw = (v.initial ?? '').trim()
  switch (v.type) {
    case 'number': return raw === '' || Number.isNaN(Number(raw)) ? '0' : raw
    case 'boolean': return raw === 'true' ? 'true' : 'false'
    case 'json': return raw || 'null'
    case 'string': return q(v.initial ?? '')
  }
}
/** The TS type annotation for a variable. */
export function stateTsType(v: StateVar): string {
  return v.type === 'number' ? 'number' : v.type === 'boolean' ? 'boolean' : v.type === 'json' ? 'unknown' : 'string'
}

/** A value expression usable in steps / conditions: a literal, a state var, a URL
 *  param, or the current row (for row-scoped handlers). Compiles to a `ctx` expr. */
export type LogicValue =
  | { kind: 'literal'; value: string }
  | { kind: 'state'; name: string }
  | { kind: 'param'; name: string }
  | { kind: 'field'; name: string } // the current row's field (row-scoped slots)
export function compileValue(v: LogicValue, rowExpr = 'row'): string {
  switch (v.kind) {
    case 'state': return `ctx.state.${identSafe(v.name)}`
    case 'param': return `ctx.params[${q(v.name)}]`
    case 'field': return `${rowExpr}?.[${q(v.name)}]`
    case 'literal': return litValue(v.value)
  }
}

export type LogicOp = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'truthy' | 'falsy'
export type Condition = { left: LogicValue; op: LogicOp; right?: LogicValue }
export function compileCondition(c: Condition, rowExpr = 'row'): string {
  const L = compileValue(c.left, rowExpr)
  const R = c.right ? compileValue(c.right, rowExpr) : "''"
  switch (c.op) {
    case 'eq': return `${L} === ${R}`
    case 'neq': return `${L} !== ${R}`
    case 'gt': return `Number(${L}) > Number(${R})`
    case 'lt': return `Number(${L}) < Number(${R})`
    case 'gte': return `Number(${L}) >= Number(${R})`
    case 'lte': return `Number(${L}) <= Number(${R})`
    case 'contains': return `String(${L}).includes(String(${R}))`
    case 'truthy': return `Boolean(${L})`
    case 'falsy': return `!(${L})`
  }
}

/** A field assignment used by create / update record steps. */
export type FieldValue = { field: string; value: LogicValue }
const compileFields = (fs: ReadonlyArray<FieldValue>): string => `{ ${fs.map((f) => `${identSafe(f.field)}: ${compileValue(f.value)}`).join(', ')} }`

/** One step in a visual "method" (the Methods panel, Radzen-style). Each compiles
 *  to a line of typed `ctx` code-behind - so the visual builder and the code editor
 *  produce identical output. `code` is the raw-TS escape hatch. */
export type ActionStep =
  | { type: 'navigate'; to: string }                                       // ctx.goto(to)
  | { type: 'gridExport'; format?: 'csv' | 'tsv' | 'json' }                 // download the grid
  | { type: 'gridCopy' }                                                    // ctx.grid.copyToClipboard()
  | { type: 'gridClear'; what: 'filters' | 'sort' | 'selection' }
  | { type: 'gridSort'; field: string; dir?: 'asc' | 'desc' }
  | { type: 'gridFilter'; field: string; value: string }
  | { type: 'reloadData' }                                                  // ctx.data.reload()
  | { type: 'setProp'; target: string; prop: string; value: string }       // ctx.<target>.<prop> = <value>
  | { type: 'setText'; target: string; value: string }                     // ctx.<target>.text = <value>
  | { type: 'alert'; message: string }
  | { type: 'apiAction'; actionId: string }                                // POST /api/actions/<id>
  | { type: 'setVar'; name: string; value: LogicValue }                    // ctx.state.<name> = <value>
  | { type: 'createRecord'; values: FieldValue[] }                         // await ctx.data.create({...})
  | { type: 'updateRecord'; id: LogicValue; values: FieldValue[] }         // await ctx.data.update(id, {...})
  | { type: 'deleteRecord'; id: LogicValue }                               // await ctx.data.delete(id)
  | { type: 'branch'; condition: Condition; then: ActionStep[]; else?: ActionStep[] } // if / else
  | { type: 'code'; code: string }
export type ActionStepType = ActionStep['type']

const q = (s: string) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
/** Emit a value literal: true/false/number bare, else a quoted string. */
const litValue = (v: string): string => {
  const t = v.trim()
  if (t === 'true' || t === 'false') return t
  if (t !== '' && !Number.isNaN(Number(t))) return t
  return q(v)
}

/** Compile one step to a `ctx` statement (a single line, no trailing newline). */
export function compileStep(step: ActionStep): string {
  switch (step.type) {
    case 'navigate': return `ctx.goto(${q(step.to)})`
    case 'gridExport': {
      const fmt = step.format ?? 'csv'
      const fn = fmt === 'tsv' ? 'exportTsv' : fmt === 'json' ? 'exportJson' : 'exportCsv'
      const mime = fmt === 'json' ? 'application/json' : fmt === 'tsv' ? 'text/tab-separated-values' : 'text/csv'
      // A scoped block so the locals don't collide when there are two export steps.
      return [
        '{',
        `  const data = await ctx.grid.${fn}()`,
        "  const link = document.createElement('a')",
        `  link.href = URL.createObjectURL(new Blob([data], { type: ${q(mime)} }))`,
        `  link.download = ${q('export.' + fmt)}`,
        '  link.click()',
        '  URL.revokeObjectURL(link.href)',
        '}',
      ].join('\n')
    }
    case 'gridCopy': return `ctx.grid.copyToClipboard()`
    case 'gridClear': return step.what === 'sort' ? `ctx.grid.clearSort()` : step.what === 'selection' ? `ctx.grid.clearRowSelection()` : `ctx.grid.clearAllFilters()`
    case 'gridSort': return `ctx.grid.setSort(${q(step.field)}, ${q(step.dir ?? 'asc')})`
    case 'gridFilter': return `ctx.grid.setFilter(${q(step.field)}, { operator: 'contains', value: ${q(step.value)} })`
    case 'reloadData': return `await ctx.data.reload()`
    case 'setProp': return `ctx.${step.target}.${step.prop} = ${litValue(step.value)}`
    case 'setText': return `ctx.${step.target}.text = ${litValue(step.value)}`
    case 'alert': return `alert(${q(step.message)})`
    case 'apiAction': return `await fetch(${q('/api/actions/' + step.actionId)}, { method: 'POST' })`
    case 'setVar': return `ctx.state.${identSafe(step.name)} = ${compileValue(step.value)}`
    case 'createRecord': return `await ctx.data.create(${compileFields(step.values)})`
    case 'updateRecord': return `await ctx.data.update(${compileValue(step.id)}, ${compileFields(step.values)})`
    case 'deleteRecord': return `await ctx.data.delete(${compileValue(step.id)})`
    case 'branch': {
      const body = indentLines(compileHandlerSteps(step.then))
      const elseB = step.else?.length ? ` else {\n${indentLines(compileHandlerSteps(step.else))}\n}` : ''
      return `if (${compileCondition(step.condition)}) {\n${body}\n}${elseB}`
    }
    case 'code': return step.code
  }
}
/** Indent every line by 2 spaces (nested branch bodies). */
const indentLines = (s: string): string => s.split('\n').map((l) => (l ? '  ' + l : l)).join('\n')
/** Compile a list of steps to a handler body (indented lines). */
export function compileHandlerSteps(steps: ReadonlyArray<ActionStep>): string {
  return steps.map((s) => compileStep(s)).join('\n')
}

// --- entity triggers: server-side business rules -----------------------------
// Compiled into the SQL route's createKitHandlers `hooks`, so they run + are
// ENFORCED on the server (a client that skips its checks still can't write bad
// data). The payload is a mutable record `v`; `field`-kind values read `v[...]`.

/** One step in an entity trigger (a server-side rule). */
export type TriggerStep =
  | { type: 'setField'; field: string; value: LogicValue }                       // v[field] = value (transform)
  | { type: 'requireField'; field: string; message?: string }                    // reject if empty
  | { type: 'reject'; condition: Condition; message: string }                    // reject when the condition holds
  | { type: 'branch'; condition: Condition; then: TriggerStep[]; else?: TriggerStep[] }
  | { type: 'code'; code: string }
export type TriggerEvent = 'beforeCreate' | 'afterCreate' | 'beforeUpdate' | 'afterUpdate' | 'beforeDelete' | 'afterDelete'
/** All trigger events, in display order; before-hooks transform/validate, after-hooks are side effects. */
export const TRIGGER_EVENTS: ReadonlyArray<TriggerEvent> = ['beforeCreate', 'afterCreate', 'beforeUpdate', 'afterUpdate', 'beforeDelete', 'afterDelete']
export type EntityTriggers = Partial<Record<TriggerEvent, TriggerStep[]>>

/** Compile one trigger step against the payload variable `rowExpr` (default `v`). */
export function compileTriggerStep(step: TriggerStep, rowExpr = 'v'): string {
  switch (step.type) {
    case 'setField': return `${rowExpr}[${q(step.field)}] = ${compileValue(step.value, rowExpr)}`
    case 'requireField': return `if (${rowExpr}[${q(step.field)}] == null || ${rowExpr}[${q(step.field)}] === '') throw new Error(${q(step.message || step.field + ' is required')})`
    case 'reject': return `if (${compileCondition(step.condition, rowExpr)}) throw new Error(${q(step.message)})`
    case 'branch': {
      const body = indentLines(compileTriggerSteps(step.then, rowExpr))
      const elseB = step.else?.length ? ` else {\n${indentLines(compileTriggerSteps(step.else, rowExpr))}\n}` : ''
      return `if (${compileCondition(step.condition, rowExpr)}) {\n${body}\n}${elseB}`
    }
    case 'code': return step.code
  }
}
export function compileTriggerSteps(steps: ReadonlyArray<TriggerStep>, rowExpr = 'v'): string {
  return steps.map((s) => compileTriggerStep(s, rowExpr)).join('\n')
}

/** `entity` is optional: a screen with none is a freestanding page (no data
 *  binding, no blocks - every `BlockKind` is entity-bound) - just a title, an
 *  empty content area, and optionally a toolbar of custom `actions`. Wire up a
 *  "Run report" / "Sync now" button on a blank page without a table behind it.
 *
 *  `code` opts the screen into a create-once `handlers.ts` companion (user-owned,
 *  never regenerated) whose `onLoad(ctx)` runs on mount; `renderGrid` adds a Grid
 *  fed via `ctx.setRows`. `handlerBodies` holds each handler's body (keyed by name). */
/** How a screen arranges its blocks: the default 12-column responsive grid, or a
 *  docking workspace (SvDockManager - drag-to-dock splits/tabs + floating / pinned panes,
 *  serialized as `dock`). */
export type ScreenLayout = 'grid' | 'stack' | 'split' | 'dock' | 'canvas'

/** Layouts that arrange blocks as dockable / split panes (both back onto a
 *  serialized `DockManagerState`; `split` renders it locked = resize-only). */
export const PANE_LAYOUTS: ReadonlyArray<ScreenLayout> = ['split', 'dock']
export function isPaneLayout(layout: ScreenLayout): boolean { return PANE_LAYOUTS.includes(layout) }

/** Free-form canvas: a block is placed on a 12-column grid by explicit cell
 *  coordinates (col/row) + spans, instead of flowing. `row`/`rowSpan` count
 *  fixed-height rows (see CANVAS_ROW_PX). All values are grid cells, 0-indexed. */
export type CanvasRect = { col: number; row: number; colSpan: number; rowSpan: number }
export const CANVAS_COLS = 12
/** Height of one canvas row in px (grid-auto-rows), shared by designer + codegen. */
export const CANVAS_ROW_PX = 40
/** Gap between canvas cells in px. */
export const CANVAS_GAP_PX = 8
// --- per-layout settings ----------------------------------------------------
// Each mode has its own knobs; stored per-mode so switching layouts keeps each
// mode's settings. All fields optional - absent means the default (below), so
// existing projects are unchanged.
export type GridLayoutOpts = { colGap?: number; rowGap?: number; maxWidth?: number; align?: 'start' | 'stretch'; mobileBreakpoint?: number }
export type StackLayoutOpts = { gap?: number; maxWidth?: number; align?: 'left' | 'center'; dividers?: boolean; minHeight?: number }
export type SplitLayoutOpts = { orientation?: 'auto' | 'row' | 'column'; minPaneSize?: number; persist?: boolean }
export type DockLayoutOpts = { allowPopout?: boolean; hideSingleTab?: boolean; headerPosition?: 'top' | 'bottom' | 'left' | 'right'; persist?: boolean }
export type CanvasLayoutOpts = { cols?: number; rowHeight?: number; gap?: number; showGrid?: boolean }
export type LayoutOpts = { grid?: GridLayoutOpts; stack?: StackLayoutOpts; split?: SplitLayoutOpts; dock?: DockLayoutOpts; canvas?: CanvasLayoutOpts }

/** `maxWidth: 0` (or absent) means full-bleed. */
export const GRID_OPT_DEFAULTS: Required<GridLayoutOpts> = { colGap: 16, rowGap: 16, maxWidth: 0, align: 'start', mobileBreakpoint: 720 }
export const STACK_OPT_DEFAULTS: Required<StackLayoutOpts> = { gap: 16, maxWidth: 0, align: 'left', dividers: false, minHeight: 160 }
export const SPLIT_OPT_DEFAULTS: Required<SplitLayoutOpts> = { orientation: 'auto', minPaneSize: 80, persist: true }
export const DOCK_OPT_DEFAULTS: Required<DockLayoutOpts> = { allowPopout: false, hideSingleTab: false, headerPosition: 'top', persist: true }
export const CANVAS_OPT_DEFAULTS: Required<CanvasLayoutOpts> = { cols: CANVAS_COLS, rowHeight: CANVAS_ROW_PX, gap: CANVAS_GAP_PX, showGrid: false }

export const gridOpts = (s: Screen): Required<GridLayoutOpts> => ({ ...GRID_OPT_DEFAULTS, ...s.layoutOpts?.grid })
export const stackOpts = (s: Screen): Required<StackLayoutOpts> => ({ ...STACK_OPT_DEFAULTS, ...s.layoutOpts?.stack })
export const splitOpts = (s: Screen): Required<SplitLayoutOpts> => ({ ...SPLIT_OPT_DEFAULTS, ...s.layoutOpts?.split })
export const dockOpts = (s: Screen): Required<DockLayoutOpts> => ({ ...DOCK_OPT_DEFAULTS, ...s.layoutOpts?.dock })
export const canvasOpts = (s: Screen): Required<CanvasLayoutOpts> => ({ ...CANVAS_OPT_DEFAULTS, ...s.layoutOpts?.canvas })

/** Patch one mode's settings (merged over any existing values). */
export function setLayoutOpts<K extends keyof LayoutOpts>(project: StudioProject, screenId: string, mode: K, patch: Partial<NonNullable<LayoutOpts[K]>>): StudioProject {
  return mapScreen(project, screenId, (s) => ({ ...s, layoutOpts: { ...s.layoutOpts, [mode]: { ...s.layoutOpts?.[mode], ...patch } } }))
}

export type Screen = { id: string; entity?: string; title: string; route: string; blocks: Block[]; nav?: ScreenNav; actions?: ActionConfig[]; code?: boolean; renderGrid?: boolean; handlerBodies?: Record<string, string>; handlerSteps?: Record<string, ActionStep[]>; handlersSource?: string; className?: string; layout?: ScreenLayout; dock?: DockManagerState; canvas?: Record<string, CanvasRect>; layoutOpts?: LayoutOpts; state?: StateVar[]; renderMode?: 'ssr' | 'spa' }

/** The generated app's shell (master layout): sidebar, top-nav, or bottom-nav; brand, footer. */
export type ShellStyle = 'sidebar' | 'top-nav' | 'bottom-nav'
export type ShellConfig = { style?: ShellStyle; brand?: string; footer?: string; navPosition?: 'left' | 'right'; logo?: string; toolbar?: boolean }
export type ProjectTheme = { accent?: string; preset?: string; mode?: 'light' | 'dark'; shell?: ShellConfig; customCss?: string; appClass?: string }

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
/** Authentication starter. When `enabled`, the generator scaffolds a real sign-in:
 *  a session cookie + `hooks.server.ts` that populates `event.locals.role`/`user`
 *  (closing the loop the RBAC layer expects), a `/login` page, sign-out, and demo
 *  seed users (one per RBAC role, or a single admin). Dependency-free: Web Crypto +
 *  stateless signed cookies. `protect` gates the whole app behind login (default). */
/** Social / enterprise sign-in providers. `oidc` is a generic OpenID Connect issuer
 *  (covers Azure AD / Entra ID, Okta, Auth0, Keycloak, ... via discovery). */
export type OAuthProvider = 'github' | 'google' | 'oidc'
export type AuthConfig = {
  enabled: boolean
  /** Redirect unauthenticated visitors to /login for every route. Default true. */
  protect?: boolean
  /** Self-service sign-up + password recovery (/register, /forgot-password,
   *  /reset-password). Needs the DB-backed user store (turn on the data layer). */
  register?: boolean
  /** An admin user-management screen (/users: list, invite, change role, remove).
   *  Needs the DB-backed store + RBAC (only a full-access role can open it). */
  userAdmin?: boolean
  /** OAuth / OpenID Connect sign-in buttons. Needs the DB-backed store. */
  oauth?: OAuthProvider[]
  /** Email one-time-code two-factor auth. Needs the DB-backed store + real email. */
  twoFactor?: boolean
  /** Real email delivery (Resend HTTP API or SMTP via nodemailer); dev console otherwise.
   *  Implied when `twoFactor` is on. */
  email?: boolean
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
  /** Authentication starter (optional; off unless `auth.enabled`). Provides the
   *  session/login that populates the role RBAC consumes. */
  auth?: AuthConfig
  /** Typed data layer: when `'drizzle'` and there's a SQL-bound entity, emit a
   *  Drizzle schema + typed repositories + drizzle-kit migrations. */
  dataLayer?: 'drizzle'
  /** Emit an audit trail: connected routes log create/update/delete + an /audit viewer. */
  audit?: boolean
  /** Localization: when enabled, emit a message catalog + locale switcher and route
   *  nav / titles / column headers through `t()`. */
  i18n?: I18nConfig
  /** Deploy target: picks the SvelteKit adapter + provider config the bundle emits.
   *  Defaults to `auto` (@sveltejs/adapter-auto, which detects Vercel/Netlify/Cloudflare). */
  deploy?: DeployTarget
  /** Server-side business-rule triggers, keyed by entity name. Enforced on the
   *  SQL route (compiled into createKitHandlers `hooks`). */
  triggers?: Record<string, EntityTriggers>
}

/** The render mode for a screen. `'ssr'` emits idiomatic SvelteKit (`+page.server.ts`
 *  with a `load` + form `actions`, SSR + progressive enhancement); `'spa'` (the
 *  default) emits the client data-source-controller page. Opt-in for now. */
export function screenRenderMode(_project: StudioProject, screen: Screen): 'ssr' | 'spa' {
  return screen.renderMode === 'ssr' ? 'ssr' : 'spa'
}

/** Block kinds a read-only SSR screen can host: pure renders over server-loaded
 *  rows. Board/calendar/scheduler (client interaction runtimes), components
 *  (client bindings), grids-with-extras, and containers stay SPA. */
const SSR_READ_KINDS = new Set<BlockKind>(['chart', 'pivot', 'dashboard', 'kpi', 'gauge', 'tree', 'detail', 'master-detail'])

/** How a screen would emit under SSR: 'grid' (single grid -> load + form actions,
 *  URL-driven sort/filter/page), 'read' (data-viz/detail blocks -> load only), or
 *  null when it must stay SPA. */
export function ssrScreenShape(project: StudioProject, screen: Screen): 'grid' | 'read' | null {
  if (!screen.entity || screen.code) return null
  const kind = project.dataSources?.[screen.entity]?.kind ?? project.dataSource
  // memory runs the source in-process; sql reuses the connected /api route via
  // event.fetch. (rest/supabase/pglite stay SPA for now.)
  if (kind !== 'memory' && kind !== 'sql') return null
  const blocks = screen.blocks ?? []
  if (blocks.length === 1 && blocks[0]!.config.kind === 'grid') {
    const g = blocks[0]!.config as GridConfig
    if (g.treeData || g.scheduler) return null
    return 'grid'
  }
  if (blocks.length >= 1 && blocks.every((b) => SSR_READ_KINDS.has(b.config.kind))) return 'read'
  return null
}

/** Whether a screen can be emitted as SSR-native (any supported shape). */
export function ssrEligible(project: StudioProject, screen: Screen): boolean {
  return ssrScreenShape(project, screen) !== null
}

/** Set a screen's render mode ('spa' clears back to the default). */
export function setScreenRenderMode(project: StudioProject, screenId: string, mode: 'ssr' | 'spa'): StudioProject {
  return {
    ...project,
    screens: project.screens.map((s) => (s.id === screenId ? { ...s, renderMode: mode === 'ssr' ? 'ssr' : undefined } : s)),
  }
}

/** True when the screen should actually emit as SSR (mode is 'ssr' AND eligible). */
export function isSsrScreen(project: StudioProject, screen: Screen): boolean {
  return screenRenderMode(project, screen) === 'ssr' && ssrEligible(project, screen)
}

/** The triggers configured for an entity (or an empty object). */
export function triggersOf(project: StudioProject, entity: string): EntityTriggers {
  return project.triggers?.[entity] ?? {}
}
/** Set (or clear, with `null`) an entity's steps for one trigger event. */
export function setTrigger(project: StudioProject, entity: string, event: TriggerEvent, steps: TriggerStep[] | null): StudioProject {
  const cur = project.triggers?.[entity] ?? {}
  const nextEnt: EntityTriggers = { ...cur }
  if (steps && steps.length) nextEnt[event] = steps
  else delete nextEnt[event]
  const triggers = { ...project.triggers }
  if (Object.keys(nextEnt).length) triggers[entity] = nextEnt
  else delete triggers[entity]
  return { ...project, triggers: Object.keys(triggers).length ? triggers : undefined }
}

/** Where the generated app deploys. Drives the emitted SvelteKit adapter + config. */
export type DeployTarget = 'auto' | 'vercel' | 'netlify' | 'cloudflare' | 'node'

/** Localization config: the locales the app ships and which is the default. */
export type I18nConfig = { enabled: boolean; locales: string[]; defaultLocale?: string }

export type ProjectIssueLevel = 'error' | 'warning'
export type ProjectIssue = { level: ProjectIssueLevel; message: string; screen?: string; block?: string }

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
  { kind: 'gauge', label: 'Gauge', needs: 'measure' },
  { kind: 'tree', label: 'Tree' },
  { kind: 'tabs', label: 'Tabs' },
  { kind: 'accordion', label: 'Accordion' },
  { kind: 'master-detail', label: 'Master / detail', needs: 'child' },
  { kind: 'board', label: 'Board' },
  { kind: 'calendar', label: 'Calendar' },
  { kind: 'detail', label: 'Detail page' },
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

export function entityOf(project: StudioProject, name: string | undefined): EntitySchema | undefined {
  if (name == null) return undefined
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
    case 'gauge': {
      const measure = pickMeasure(entity)
      return { kind, label: measure ? `Avg ${measure}` : `${entity.label ?? entity.name} count`, measure, reduce: measure ? 'avg' : 'count', min: 0, max: 100 }
    }
    case 'tree': {
      const label = entity.fields.find((f) => !f.primaryKey && f.type === 'text')?.field ?? entity.fields.find((f) => !f.primaryKey)?.field ?? entity.fields[0]?.field ?? ''
      // A self-referential FK (relation back to this entity) is the natural parent link; else guess by name.
      const parent = entity.fields.find((f) => f.type === 'relation' && f.relation?.entity === entity.name)?.field
        ?? entity.fields.find((f) => /parent/i.test(f.field))?.field ?? ''
      return { kind, labelField: label, parentField: parent }
    }
    case 'tabs':
      return { kind, tabs: [{ label: 'Overview', blocks: [] }, { label: 'Details', blocks: [] }] }
    case 'accordion':
      return { kind, sections: [{ label: 'Section 1', blocks: [] }, { label: 'Section 2', blocks: [] }], multiple: false }
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
    case 'board': {
      const enumField = entity.fields.find((f) => f.type === 'enum' && !f.primaryKey)?.field ?? ''
      const titleF = entity.fields.find((f) => f.type === 'text' && !f.primaryKey)?.field ?? entity.fields.find((f) => !f.primaryKey)?.field ?? ''
      const badge = pickMeasure(entity)
      return { kind, groupBy: enumField, titleField: titleF, ...(badge ? { badgeField: badge } : {}) }
    }
    case 'calendar': {
      const dateF = entity.fields.find((f) => (f.type === 'datetime' || f.type === 'date' || f.type === 'dateString') && !f.primaryKey)?.field ?? ''
      const titleF = entity.fields.find((f) => f.type === 'text' && !f.primaryKey)?.field ?? entity.fields.find((f) => !f.primaryKey)?.field ?? ''
      const colorF = entity.fields.find((f) => f.type === 'enum' && !f.primaryKey)?.field
      return { kind, dateField: dateF, titleField: titleF, ...(colorF ? { colorField: colorF } : {}) }
    }
    case 'detail': {
      const nonKey = entity.fields.filter((f) => !f.primaryKey)
      const titleF = nonKey.find((f) => f.type === 'text')?.field ?? nonKey[0]?.field ?? entity.fields[0]?.field ?? ''
      const statusF = nonKey.find((f) => f.type === 'enum')?.field
      const subF = nonKey.find((f) => (f.type === 'text' || f.type === 'relation') && f.field !== titleF)?.field
      const metrics = nonKey.filter((f) => f.type === 'number').slice(0, 3).map((f) => f.field)
      return { kind, titleField: titleF, ...(subF ? { subtitleField: subF } : {}), ...(statusF ? { statusField: statusF } : {}), ...(metrics.length ? { metricFields: metrics } : {}) }
    }
    case 'component':
      // Entity-agnostic - built directly by `addComponentBlock`, never through here.
      return { kind, component: '', props: {} }
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
  grid: 3, form: 1, chart: 2, dashboard: 3, kpi: 1, gauge: 1, tree: 2, tabs: 3, accordion: 3, 'master-detail': 3, lookup: 1, pivot: 3, filter: 1, record: 1, board: 3, calendar: 3, detail: 3, component: 1,
}

function makeBlock(kind: BlockKind, entity: EntitySchema, taken: ReadonlySet<string>): Block {
  return { id: uid(`${kind}-`, taken), span: DEFAULT_SPAN[kind], config: defaultBlockConfig(kind, entity) }
}

// --- Tabs container ops (pure; the designer builds a new config + updateBlock) ---

/** Append a tab to a Tabs container. */
export function addTab(cfg: TabsConfig, label?: string): TabsConfig {
  return { ...cfg, tabs: [...cfg.tabs, { label: label ?? `Tab ${cfg.tabs.length + 1}`, blocks: [] }] }
}
/** Remove a tab by index (keeps at least one). */
export function removeTab(cfg: TabsConfig, index: number): TabsConfig {
  if (cfg.tabs.length <= 1) return cfg
  return { ...cfg, tabs: cfg.tabs.filter((_, i) => i !== index) }
}
/** Rename a tab by index. */
export function renameTab(cfg: TabsConfig, index: number, label: string): TabsConfig {
  return { ...cfg, tabs: cfg.tabs.map((t, i) => (i === index ? { ...t, label } : t)) }
}
/** Add a child block (default config for `kind`) to a tab. Only `TAB_CHILD_KINDS` are allowed. */
export function addTabBlock(cfg: TabsConfig, index: number, kind: BlockKind, entity: EntitySchema): TabsConfig {
  if (!TAB_CHILD_KINDS.includes(kind)) return cfg
  const taken = new Set<string>()
  cfg.tabs.forEach((t) => flattenBlocks(t.blocks).forEach((b) => taken.add(b.id)))
  const block: Block = { id: uid(`${kind}-`, taken), span: DEFAULT_SPAN[kind], config: defaultBlockConfig(kind, entity) }
  return { ...cfg, tabs: cfg.tabs.map((t, i) => (i === index ? { ...t, blocks: [...t.blocks, block] } : t)) }
}
/** Remove a child block from a tab by id. */
export function removeTabBlock(cfg: TabsConfig, index: number, blockId: string): TabsConfig {
  return { ...cfg, tabs: cfg.tabs.map((t, i) => (i === index ? { ...t, blocks: t.blocks.filter((b) => b.id !== blockId) } : t)) }
}

/** Build a UI-kit component child block for a container section (Tabs / Accordion),
 *  seeded with the registry's default props + content. Returns null for an unknown
 *  component key. Entity-agnostic - components need no entity. */
function makeComponentChild(componentKey: string, taken: ReadonlySet<string>): Block | null {
  const spec = uiComponentSpec(componentKey)
  if (!spec) return null
  const props: Record<string, unknown> = {}
  for (const p of spec.props) if (p.default != null) props[p.key] = p.default
  if (spec.hasContent) props._content = spec.contentDefault ?? spec.label
  const set = new Set(taken)
  return { id: uid('component-', set), span: DEFAULT_SPAN.component, config: { kind: 'component', component: componentKey, props } }
}
/** Add a specific UI-kit component (by registry key) to a tab. */
export function addTabComponent(cfg: TabsConfig, index: number, componentKey: string): TabsConfig {
  const taken = new Set<string>()
  cfg.tabs.forEach((t) => flattenBlocks(t.blocks).forEach((b) => taken.add(b.id)))
  const block = makeComponentChild(componentKey, taken)
  if (!block) return cfg
  return { ...cfg, tabs: cfg.tabs.map((t, i) => (i === index ? { ...t, blocks: [...t.blocks, block] } : t)) }
}

// --- Accordion container (mirrors the Tabs helpers) ------------------------
/** Append a section (collapsible panel) to an accordion. */
export function addAccordionSection(cfg: AccordionConfig, label?: string): AccordionConfig {
  return { ...cfg, sections: [...cfg.sections, { label: label ?? `Section ${cfg.sections.length + 1}`, blocks: [] }] }
}
/** Remove a section by index (keeps at least one). */
export function removeAccordionSection(cfg: AccordionConfig, index: number): AccordionConfig {
  if (cfg.sections.length <= 1) return cfg
  return { ...cfg, sections: cfg.sections.filter((_, i) => i !== index) }
}
/** Rename a section by index. */
export function renameAccordionSection(cfg: AccordionConfig, index: number, label: string): AccordionConfig {
  return { ...cfg, sections: cfg.sections.map((s, i) => (i === index ? { ...s, label } : s)) }
}
/** Toggle single- vs multiple-open behaviour. */
export function setAccordionMultiple(cfg: AccordionConfig, multiple: boolean): AccordionConfig {
  return { ...cfg, multiple }
}
/** Add a display-block child (default config for `kind`) to a section. Only CONTAINER_CHILD_KINDS. */
export function addAccordionBlock(cfg: AccordionConfig, index: number, kind: BlockKind, entity: EntitySchema): AccordionConfig {
  if (!CONTAINER_CHILD_KINDS.includes(kind)) return cfg
  const taken = new Set<string>()
  cfg.sections.forEach((s) => flattenBlocks(s.blocks).forEach((b) => taken.add(b.id)))
  const block: Block = { id: uid(`${kind}-`, taken), span: DEFAULT_SPAN[kind], config: defaultBlockConfig(kind, entity) }
  return { ...cfg, sections: cfg.sections.map((s, i) => (i === index ? { ...s, blocks: [...s.blocks, block] } : s)) }
}
/** Add a specific UI-kit component (by registry key) to a section. */
export function addAccordionComponent(cfg: AccordionConfig, index: number, componentKey: string): AccordionConfig {
  const taken = new Set<string>()
  cfg.sections.forEach((s) => flattenBlocks(s.blocks).forEach((b) => taken.add(b.id)))
  const block = makeComponentChild(componentKey, taken)
  if (!block) return cfg
  return { ...cfg, sections: cfg.sections.map((s, i) => (i === index ? { ...s, blocks: [...s.blocks, block] } : s)) }
}
/** Remove a child block from a section by id. */
export function removeAccordionBlock(cfg: AccordionConfig, index: number, blockId: string): AccordionConfig {
  return { ...cfg, sections: cfg.sections.map((s, i) => (i === index ? { ...s, blocks: s.blocks.filter((b) => b.id !== blockId) } : s)) }
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

/** Add a UI-kit component block (see `ui-components.ts`'s `UI_COMPONENT_REGISTRY`)
 *  to a screen. Unlike `addBlock`/`addBlockAt`, this needs no entity - it works on
 *  any screen, including a freestanding one, or mixed onto an entity-bound one. */
export function addComponentBlock(project: StudioProject, screenId: string, componentKey: string, defaultProps: Record<string, unknown> = {}, index?: number): StudioProject {
  return mapScreen(project, screenId, (s) => {
    const taken = new Set(flattenBlocks(s.blocks).map((b) => b.id))
    const name = uniqueComponentName(componentKey, s)
    const block: Block = { id: uid('component-', taken), span: DEFAULT_SPAN.component, config: { kind: 'component', component: componentKey, props: { ...defaultProps }, name } }
    const blocks = [...s.blocks]
    blocks.splice(index != null ? Math.max(0, Math.min(index, blocks.length)) : blocks.length, 0, block)
    return { ...s, blocks }
  })
}

/** A valid, unique JS identifier for a component handle on a screen, e.g. `button1`.
 *  Handles are the named objects code reaches (btn.setLabel(...), btn.onclick = ...). */
export function componentHandleName(cfg: ComponentConfig): string {
  const raw = (cfg.name ?? cfg.component).trim()
  const id = raw.replace(/[^A-Za-z0-9_$]/g, '_').replace(/^([0-9])/, '_$1')
  return id || 'el'
}
function uniqueComponentName(componentKey: string, screen: Screen): string {
  const taken = new Set(
    flattenBlocks(screen.blocks)
      .filter((b) => b.config.kind === 'component')
      .map((b) => componentHandleName(b.config as ComponentConfig)),
  )
  let n = 1
  while (taken.has(`${componentKey}${n}`)) n++
  return `${componentKey}${n}`
}

/** Rename a component's handle (the variable code uses to reach it). */
export function setComponentName(project: StudioProject, screenId: string, blockId: string, name: string): StudioProject {
  return mapScreen(project, screenId, (s) => ({
    ...s,
    blocks: mapBlockTree(s.blocks, blockId, (b) => (b.config.kind === 'component' ? { ...b, config: { ...b.config, name: name.trim() || undefined } } : b)),
  }))
}

/** True when a component has at least one data-bound prop. */
export function componentHasBindings(cfg: ComponentConfig): boolean {
  return !!cfg.bindings && Object.keys(cfg.bindings).length > 0
}
/** Bind (or, with `binding: null`, unbind) one component prop to the screen's data. */
export function setComponentBinding(project: StudioProject, screenId: string, blockId: string, propKey: string, binding: ComponentBinding | null): StudioProject {
  return mapScreen(project, screenId, (s) => ({
    ...s,
    blocks: mapBlockTree(s.blocks, blockId, (b) => {
      if (b.config.kind !== 'component') return b
      const bindings = { ...(b.config.bindings ?? {}) }
      if (binding) bindings[propKey] = binding
      else delete bindings[propKey]
      return { ...b, config: { ...b.config, bindings: Object.keys(bindings).length ? bindings : undefined } }
    }),
  }))
}

/** Apply `fn` to the block with `id` anywhere in the tree (top level or nested in a Tabs / Accordion container). */
function mapBlockTree(blocks: Block[], id: string, fn: (b: Block) => Block): Block[] {
  return blocks.map((b) => {
    if (b.id === id) return fn(b)
    if (b.config.kind === 'tabs') {
      return { ...b, config: { ...b.config, tabs: b.config.tabs.map((t) => ({ ...t, blocks: mapBlockTree(t.blocks, id, fn) })) } }
    }
    if (b.config.kind === 'accordion') {
      return { ...b, config: { ...b.config, sections: b.config.sections.map((s) => ({ ...s, blocks: mapBlockTree(s.blocks, id, fn) })) } }
    }
    return b
  })
}
/** Remove the block with `id` anywhere in the tree (top level or nested in a Tabs / Accordion container). */
function removeBlockTree(blocks: Block[], id: string): Block[] {
  return blocks
    .filter((b) => b.id !== id)
    .map((b) =>
      b.config.kind === 'tabs' ? { ...b, config: { ...b.config, tabs: b.config.tabs.map((t) => ({ ...t, blocks: removeBlockTree(t.blocks, id) })) } }
      : b.config.kind === 'accordion' ? { ...b, config: { ...b.config, sections: b.config.sections.map((s) => ({ ...s, blocks: removeBlockTree(s.blocks, id) })) } }
      : b,
    )
}

export function removeBlock(project: StudioProject, screenId: string, blockId: string): StudioProject {
  return mapScreen(project, screenId, (s) => ({ ...s, blocks: removeBlockTree(s.blocks, blockId) }))
}

/** Clone a block (config + width/height) with a fresh id, inserted right after it. */
export function duplicateBlock(project: StudioProject, screenId: string, blockId: string): StudioProject {
  return mapScreen(project, screenId, (s) => {
    const idx = s.blocks.findIndex((b) => b.id === blockId)
    if (idx < 0) return s
    const src = s.blocks[idx]!
    // JSON clone (not structuredClone): the config is always JSON-safe, and this
    // also unwraps any Svelte reactive $state proxy, which structuredClone rejects.
    const clone: Block = { ...src, id: uid(`${src.config.kind}-`, new Set(s.blocks.map((b) => b.id))), config: JSON.parse(JSON.stringify(src.config)) as BlockConfig }
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

/** Patch a block's config (merged), span/height, and/or appearance `style` (merged;
 *  keys set to undefined are cleared). */
export function updateBlock(
  project: StudioProject,
  screenId: string,
  blockId: string,
  patch: { span?: 1 | 2 | 3; colSpan?: number; height?: number; config?: Partial<BlockConfig>; style?: Partial<BlockStyle>; className?: string },
): StudioProject {
  return mapScreen(project, screenId, (s) => ({
    ...s,
    blocks: mapBlockTree(s.blocks, blockId, (b) => ({
      ...b,
      span: patch.span ?? b.span,
      colSpan: patch.colSpan ?? b.colSpan,
      height: patch.height ?? b.height,
      style: patch.style ? mergeBlockStyle(b.style, patch.style) : b.style,
      className: patch.className !== undefined ? (patch.className.trim() || undefined) : b.className,
      config: patch.config ? ({ ...b.config, ...patch.config } as BlockConfig) : b.config,
    })),
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

export function updateScreen(project: StudioProject, screenId: string, patch: Partial<Pick<Screen, 'title' | 'route' | 'entity' | 'nav' | 'actions' | 'className'>>): StudioProject {
  return mapScreen(project, screenId, (s) => ({ ...s, ...patch }))
}

// ---- Screen layout: 12-column grid (default) or a docking workspace ----------

/** The screen's layout engine. Defaults to `'grid'` (the 12-column responsive grid). */
export function screenLayoutOf(screen: Screen): ScreenLayout {
  return screen.layout ?? 'grid'
}

/** A short title for a block's dock pane. */
function dockPaneTitle(block: Block): string {
  const c = block.config as { kind: string; label?: string; title?: string; name?: string; component?: string }
  const byKind: Record<string, string> = {
    grid: 'Grid', form: 'Form', chart: 'Chart', dashboard: 'Dashboard', tree: 'Tree', pivot: 'Pivot',
    filter: 'Filters', record: 'Record', detail: 'Detail', board: 'Board', calendar: 'Calendar',
    'master-detail': 'Master / detail', lookup: 'Lookup', tabs: 'Tabs', accordion: 'Accordion',
    kpi: 'KPI', gauge: 'Gauge', component: 'Component',
  }
  return c.label || c.title || c.name || c.component || byKind[c.kind] || 'Panel'
}

/** Every pane id present anywhere in a dock workspace (main tree + floating + auto-hidden). */
export function dockPaneIds(state: DockManagerState): Set<string> {
  const ids = new Set<string>()
  const walk = (n: DockNode) => { if (n.type === 'tabs') for (const p of n.panes) ids.add(p.id); else for (const c of n.children) walk(c) }
  if (state.main) walk(state.main)
  for (const w of state.floating) for (const p of w.leaf.panes) ids.add(p.id)
  for (const e of state.autoHide) for (const p of e.leaf.panes) ids.add(p.id)
  return ids
}

/**
 * Smart auto-layout: seed a docking workspace from a screen's blocks by role -
 * filters dock left, record / detail panels dock right, KPIs / gauges strip across
 * the top, and the main content (grid / board / calendar / chart / ...) fills the
 * centre. Pane ids equal block ids. Runtime float / pin / pop-out is layered on later.
 */
export function buildDockLayout(screen: Screen): DockManagerState {
  const taken = new Set<string>(screen.blocks.map((b) => b.id))
  const genId = (p: string) => { const id = uid(p, taken); taken.add(id); return id }
  const paneFor = (b: Block): DockPane => ({ id: b.id, title: dockPaneTitle(b), closable: true })
  const roleOf = (b: Block): 'left' | 'center' | 'right' | 'top' => {
    switch (b.config.kind) {
      case 'filter': return 'left'
      case 'record': case 'detail': return 'right'
      case 'kpi': case 'gauge': return 'top'
      default: return 'center'
    }
  }
  const groupOf = (direction: 'row' | 'column', children: DockNode[], sizes: number[]): DockNode => ({ type: 'group', id: genId('dg-'), direction, children, sizes })
  const norm = (ws: number[]): number[] => { const s = ws.reduce((a, b) => a + b, 0) || 1; return ws.map((w) => w / s) }
  // Each block gets its OWN leaf, so split view can size every block independently
  // (grouping them into one tabs leaf would trap them as tabs - unresizable when
  // the manager is locked). Multiple blocks in a bucket stack along the given axis.
  const oneLeaf = (b: Block): DockTabs => ({ type: 'tabs', id: genId('dt-'), panes: [paneFor(b)], active: 0 })
  const stackOf = (bs: Block[], direction: 'row' | 'column'): DockNode =>
    bs.length === 1 ? oneLeaf(bs[0]!) : groupOf(direction, bs.map(oneLeaf), norm(bs.map(() => 1)))
  // A forced split orientation (split-view setting) ignores roles and lays ALL
  // blocks out as equal panes in one row / column.
  const forced = splitOpts(screen).orientation
  if (forced !== 'auto' && screen.blocks.length) {
    return { main: stackOf(screen.blocks, forced), floating: [], autoHide: [] }
  }
  const buckets: Record<'left' | 'center' | 'right' | 'top', Block[]> = { left: [], center: [], right: [], top: [] }
  for (const b of screen.blocks) buckets[roleOf(b)].push(b)
  const rowChildren: DockNode[] = []
  const rowWeights: number[] = []
  if (buckets.left.length) { rowChildren.push(stackOf(buckets.left, 'column')); rowWeights.push(1) }
  if (buckets.center.length) { rowChildren.push(stackOf(buckets.center, 'column')); rowWeights.push(3) }
  if (buckets.right.length) { rowChildren.push(stackOf(buckets.right, 'column')); rowWeights.push(1) }
  const row: DockNode | null = rowChildren.length === 0 ? null : rowChildren.length === 1 ? rowChildren[0]! : groupOf('row', rowChildren, norm(rowWeights))
  let main: DockNode
  if (buckets.top.length && row) main = groupOf('column', [stackOf(buckets.top, 'row'), row], [0.28, 0.72])
  else if (buckets.top.length) main = stackOf(buckets.top, 'row')
  else if (row) main = row
  else main = { type: 'tabs', id: genId('dt-'), panes: [], active: 0 }
  return { main, floating: [], autoHide: [] }
}

/** Every group / tabs node id in a workspace (to keep freshly generated ids unique). */
function collectDockNodeIds(state: DockManagerState): string[] {
  const ids: string[] = []
  const walk = (n: DockNode) => { ids.push(n.id); if (n.type === 'group') for (const c of n.children) walk(c) }
  if (state.main) walk(state.main)
  for (const w of state.floating) { ids.push(w.id); walk(w.leaf) }
  for (const e of state.autoHide) { ids.push(e.id); walk(e.leaf) }
  return ids
}

/** Append a pane to the main area's first tabs leaf (creating one if the area is empty). */
function addDockPaneToMain(state: DockManagerState, p: DockPane, genId: () => string): DockManagerState {
  const main = state.main
  if (!main) return { ...state, main: { type: 'tabs', id: genId(), panes: [p], active: 0 } }
  let added = false
  const add = (n: DockNode): DockNode => {
    if (added) return n
    if (n.type === 'tabs') { added = true; return { ...n, panes: [...n.panes, p], active: n.panes.length } }
    return { ...n, children: n.children.map(add) }
  }
  const nextMain = add(main)
  if (added) return { ...state, main: nextMain }
  // No tabs leaf anywhere: put main + a new tabs side by side.
  return { ...state, main: { type: 'group', id: genId(), direction: 'row', children: [main, { type: 'tabs', id: genId(), panes: [p], active: 0 }], sizes: [0.7, 0.3] } }
}

/** Remove a pane anywhere in a workspace; collapse emptied tabs + single-child groups. */
function stripDockPane(state: DockManagerState, paneId: string): DockManagerState {
  const strip = (n: DockNode): DockNode | null => {
    if (n.type === 'tabs') { const panes = n.panes.filter((p: DockPane) => p.id !== paneId); return panes.length ? { ...n, panes, active: Math.min(n.active, panes.length - 1) } : null }
    const children = n.children.map(strip).filter((c: DockNode | null): c is DockNode => c !== null)
    if (children.length === 0) return null
    if (children.length === 1) return children[0]!
    return { ...n, children, sizes: children.map(() => 1 / children.length) }
  }
  const main = state.main ? strip(state.main) : null
  const floating = state.floating.map((w: DockManagerState['floating'][number]) => ({ ...w, leaf: { ...w.leaf, panes: w.leaf.panes.filter((p: DockPane) => p.id !== paneId) } })).filter((w: DockManagerState['floating'][number]) => w.leaf.panes.length > 0)
  const autoHide = state.autoHide.map((e: DockManagerState['autoHide'][number]) => ({ ...e, leaf: { ...e.leaf, panes: e.leaf.panes.filter((p: DockPane) => p.id !== paneId) } })).filter((e: DockManagerState['autoHide'][number]) => e.leaf.panes.length > 0)
  return { ...state, main, floating, autoHide }
}

/** Incrementally reconcile a dock workspace to the screen's blocks - add a pane for each new
 *  block, strip panes for removed blocks - WITHOUT rebuilding, so the user's arrangement
 *  (splits / floats / pins) is preserved. Seeds a fresh workspace if none exists. */
export function syncDockPanes(screen: Screen): Screen {
  if (!isPaneLayout(screenLayoutOf(screen))) return screen
  if (!screen.dock) return { ...screen, dock: buildDockLayout(screen) }
  const blockIds = new Set(screen.blocks.map((b) => b.id))
  const present = dockPaneIds(screen.dock)
  const missing = screen.blocks.filter((b) => !present.has(b.id))
  const extra = [...present].filter((id) => !blockIds.has(id))
  if (missing.length === 0 && extra.length === 0) return screen
  let dock = screen.dock
  for (const id of extra) dock = stripDockPane(dock, id)
  const taken = new Set<string>([...blockIds, ...collectDockNodeIds(dock)])
  const genId = () => { const id = uid('dt-', taken); taken.add(id); return id }
  for (const b of missing) dock = addDockPaneToMain(dock, { id: b.id, title: dockPaneTitle(b), closable: true }, genId)
  return { ...screen, dock }
}

/** Rebuild the dock workspace if its panes no longer match the screen's blocks (a safety
 *  net after block add / delete while the visual editor hasn't reconciled incrementally). */
export function reconcileDock(screen: Screen): Screen {
  if (!isPaneLayout(screenLayoutOf(screen))) return screen
  const blockIds = new Set(screen.blocks.map((b) => b.id))
  const paneIds = screen.dock ? dockPaneIds(screen.dock) : new Set<string>()
  const same = !!screen.dock && blockIds.size === paneIds.size && [...blockIds].every((id) => paneIds.has(id))
  return same ? screen : { ...screen, dock: buildDockLayout(screen) }
}

/** Switch a screen between the 12-column grid and a docking workspace. Switching to
 *  `'dock'` seeds a workspace (smart auto-layout) if none exists yet. */
export function setScreenLayout(project: StudioProject, screenId: string, layout: ScreenLayout): StudioProject {
  // Both pane layouts (split / dock) back onto a DockManagerState; canvas seeds
  // explicit cell coordinates. Switching split<->dock preserves the existing
  // arrangement, but coming FROM a non-pane layout (grid / stack / canvas) seeds a
  // fresh one - so a stale arrangement never carries over into a new workspace.
  return mapScreen(project, screenId, (s) => {
    if (isPaneLayout(layout)) {
      const dock = isPaneLayout(screenLayoutOf(s)) && s.dock ? s.dock : buildDockLayout(s)
      return { ...s, layout, dock }
    }
    if (layout === 'canvas') return { ...s, layout, canvas: s.canvas ?? buildCanvasLayout(s) }
    return { ...s, layout }
  })
}

// --- free-form canvas geometry ----------------------------------------------

const clampInt = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(n)))

/** A sensible default row height (in canvas rows) for a block kind - tall for
 *  data views, short for a single stat. */
function defaultCanvasRows(block: Block): number {
  const kind = block.config.kind
  if (kind === 'kpi' || kind === 'gauge') return 3
  if (kind === 'filter') return 4
  if (kind === 'chart' || kind === 'record' || kind === 'detail') return 6
  return 8 // grid / board / pivot / tree / dashboard / master-detail / form / etc.
}

/** Seed canvas rects for every block: flow them two-up (half-width each) down the
 *  page, so switching to canvas gives a reasonable starting arrangement. */
export function buildCanvasLayout(screen: Screen): Record<string, CanvasRect> {
  const cols = canvasOpts(screen).cols
  const out: Record<string, CanvasRect> = {}
  let row = 0
  let col = 0
  let rowMax = 0
  for (const b of screen.blocks) {
    const colSpan = Math.max(1, Math.round(cols / 2))
    const rowSpan = defaultCanvasRows(b)
    if (col + colSpan > cols) { col = 0; row += rowMax; rowMax = 0 }
    out[b.id] = { col, row, colSpan, rowSpan }
    col += colSpan
    rowMax = Math.max(rowMax, rowSpan)
  }
  return out
}

/** The stored rect for a block, or a computed default (so a block added after the
 *  layout was seeded still lands somewhere sane). */
export function canvasRectOf(screen: Screen, blockId: string): CanvasRect {
  const stored = screen.canvas?.[blockId]
  const cols = canvasOpts(screen).cols
  if (stored) {
    // Clamp a stored rect to the current column count (it may have been placed
    // when the canvas had more columns).
    const colSpan = Math.max(1, Math.min(stored.colSpan, cols))
    return { ...stored, colSpan, col: Math.max(0, Math.min(stored.col, cols - colSpan)) }
  }
  return buildCanvasLayout(screen)[blockId] ?? { col: 0, row: 0, colSpan: Math.max(1, Math.round(cols / 2)), rowSpan: 8 }
}

/** Move / resize a block on the canvas. Values are clamped to the screen's column
 *  count (col in-grid, colSpan 1..cols; row >= 0, rowSpan >= 1). */
export function setCanvasRect(project: StudioProject, screenId: string, blockId: string, rect: Partial<CanvasRect>): StudioProject {
  return mapScreen(project, screenId, (s) => {
    const cols = canvasOpts(s).cols
    const cur = canvasRectOf(s, blockId)
    const colSpan = clampInt(rect.colSpan ?? cur.colSpan, 1, cols)
    const col = clampInt(rect.col ?? cur.col, 0, cols - colSpan)
    const rowSpan = Math.max(1, clampInt(rect.rowSpan ?? cur.rowSpan, 1, 999))
    const row = Math.max(0, clampInt(rect.row ?? cur.row, 0, 999))
    return { ...s, canvas: { ...s.canvas, [blockId]: { col, row, colSpan, rowSpan } } }
  })
}

/** Named starting arrangements for the 12-column grid - a one-click way to set
 *  every block's column span to a common pattern instead of picking each by hand. */
export type GridPreset = 'full' | 'two-col' | 'three-col' | 'sidebar' | 'kpi-row'

const GRID_PRESET_LABELS: Record<GridPreset, string> = {
  full: 'Full width',
  'two-col': 'Two columns',
  'three-col': 'Three columns',
  sidebar: 'Sidebar + main',
  'kpi-row': 'KPI row + full',
}
export function gridPresetLabel(preset: GridPreset): string { return GRID_PRESET_LABELS[preset] }
export const GRID_PRESETS: ReadonlyArray<GridPreset> = ['full', 'two-col', 'three-col', 'sidebar', 'kpi-row']

/** Small, wide KPI-like blocks that a "KPI row" preset lays out as a strip. */
const KPI_ROW_KINDS: ReadonlyArray<BlockKind> = ['kpi', 'gauge']

/** Apply a grid preset: rewrite the top-level blocks' `colSpan` to the pattern.
 *  Only touches the current screen's own blocks (nested container children keep
 *  their spans). A no-op for a screen with no blocks. */
export function applyGridPreset(project: StudioProject, screenId: string, preset: GridPreset): StudioProject {
  return mapScreen(project, screenId, (s) => {
    if (s.blocks.length === 0) return s
    const span = (i: number, b: Block): number => {
      switch (preset) {
        case 'full': return 12
        case 'two-col': return 6
        case 'three-col': return 4
        // Narrow first block (filters / nav) beside a wide content column.
        case 'sidebar': return i === 0 ? 4 : 8
        // KPI-ish blocks form a 4-across strip; everything else spans full.
        case 'kpi-row': return KPI_ROW_KINDS.includes(b.config.kind) ? 3 : 12
      }
    }
    return { ...s, blocks: s.blocks.map((b, i) => ({ ...b, colSpan: span(i, b) })) }
  })
}

/** Persist a new dock workspace (user rearranged panes in the designer). */
export function setScreenDock(project: StudioProject, screenId: string, dock: DockManagerState): StudioProject {
  return mapScreen(project, screenId, (s) => ({ ...s, dock }))
}

// --- screen state variables --------------------------------------------------

/** Add a state variable (unique name; `state_N` if the name is taken / empty). */
export function addStateVar(project: StudioProject, screenId: string, v: Partial<StateVar> = {}): StudioProject {
  return mapScreen(project, screenId, (s) => {
    const taken = new Set((s.state ?? []).map((x) => x.name))
    let name = identSafe(v.name || 'value')
    if (taken.has(name)) { let i = 2; while (taken.has(`${name}${i}`)) i++; name = `${name}${i}` }
    const next: StateVar = { name, type: v.type ?? 'string', initial: v.initial }
    return { ...s, state: [...(s.state ?? []), next] }
  })
}
/** Patch a state variable by (old) name. Renames keep the identifier valid + unique. */
export function updateStateVar(project: StudioProject, screenId: string, name: string, patch: Partial<StateVar>): StudioProject {
  return mapScreen(project, screenId, (s) => {
    const cur = s.state ?? []
    const taken = new Set(cur.filter((x) => x.name !== name).map((x) => x.name))
    return {
      ...s,
      state: cur.map((x) => {
        if (x.name !== name) return x
        let nm = patch.name !== undefined ? identSafe(patch.name) : x.name
        if (nm !== x.name && taken.has(nm)) { let i = 2; while (taken.has(`${nm}${i}`)) i++; nm = `${nm}${i}` }
        return { ...x, ...patch, name: nm }
      }),
    }
  })
}
/** Remove a state variable by name. */
export function removeStateVar(project: StudioProject, screenId: string, name: string): StudioProject {
  return mapScreen(project, screenId, (s) => ({ ...s, state: (s.state ?? []).filter((x) => x.name !== name) }))
}

/** Rebuild the pane arrangement from scratch (smart auto-layout, honoring the
 *  current split orientation). Used when a setting invalidates the layout - e.g.
 *  the user flips split orientation - or as a "reset arrangement" action. */
export function reseedScreenDock(project: StudioProject, screenId: string): StudioProject {
  return mapScreen(project, screenId, (s) => ({ ...s, dock: buildDockLayout(s) }))
}

/** The current title (tab text) of a block's dock pane, if the screen is docked. */
export function dockPaneTitleOf(screen: Screen, paneId: string): string | undefined {
  if (!screen.dock) return undefined
  let found: string | undefined
  const walk = (n: DockNode) => { if (n.type === 'tabs') { const p = n.panes.find((x: DockPane) => x.id === paneId); if (p) found = p.title } else for (const c of n.children) walk(c) }
  if (screen.dock.main) walk(screen.dock.main)
  for (const w of screen.dock.floating) { const p = w.leaf.panes.find((x: DockPane) => x.id === paneId); if (p) found = p.title }
  for (const e of screen.dock.autoHide) { const p = e.leaf.panes.find((x: DockPane) => x.id === paneId); if (p) found = p.title }
  return found
}

/** Rename a block's dock pane (the tab text) anywhere in the workspace. */
export function setDockPaneTitle(project: StudioProject, screenId: string, paneId: string, title: string): StudioProject {
  return mapScreen(project, screenId, (s) => {
    if (!s.dock) return s
    const relabelPanes = (panes: DockPane[]): DockPane[] => panes.map((p) => (p.id === paneId ? { ...p, title } : p))
    const relabel = (n: DockNode): DockNode => (n.type === 'tabs' ? { ...n, panes: relabelPanes(n.panes) } : { ...n, children: n.children.map(relabel) })
    const main = s.dock.main ? relabel(s.dock.main) : null
    const floating = s.dock.floating.map((w: DockManagerState['floating'][number]) => ({ ...w, leaf: { ...w.leaf, panes: relabelPanes(w.leaf.panes) } }))
    const autoHide = s.dock.autoHide.map((e: DockManagerState['autoHide'][number]) => ({ ...e, leaf: { ...e.leaf, panes: relabelPanes(e.leaf.panes) } }))
    return { ...s, dock: { ...s.dock, main, floating, autoHide } }
  })
}

/** A freestanding screen: no bound entity, so no blocks/data binding - just a
 *  title and (once actions are added) a toolbar. For a blank page the developer
 *  builds on, or one that's purely a home for custom actions ("Run report"). */
export function addFreestandingScreen(project: StudioProject, opts: { title: string; route?: string }): StudioProject {
  const id = 'screen'
  const route = opts.route ?? id
  return appendScreen(project, { id, title: opts.title, route, blocks: [] }, 'screen')
}

/** Every custom action id already used project-wide (screen toolbars + row
 *  actions) - action ids become `/api/actions/<id>` routes, so they must be
 *  unique across the whole project, not just within one screen. */
function takenActionIds(project: StudioProject): Set<string> {
  const taken = new Set<string>()
  for (const s of project.screens) {
    for (const a of s.actions ?? []) taken.add(a.id)
    for (const b of flattenBlocks(s.blocks)) {
      if (b.config.kind !== 'grid') continue
      for (const a of b.config.rowActions ?? []) if (a.kind === 'custom' && a.id) taken.add(a.id)
    }
  }
  return taken
}

/** Add a toolbar-level custom action to a screen (works on a freestanding screen
 *  too). Generates a stable id from `taken` project-wide ids; the generated app
 *  gets a wired-up button + a stub `/api/actions/<id>` route to fill in. */
export function addScreenAction(project: StudioProject, screenId: string, action: { label: string; icon?: string; confirm?: string }): StudioProject {
  const id = uid('action-', takenActionIds(project))
  return mapScreen(project, screenId, (s) => ({ ...s, actions: [...(s.actions ?? []), { id, ...action }] }))
}

export function removeScreenAction(project: StudioProject, screenId: string, actionId: string): StudioProject {
  return mapScreen(project, screenId, (s) => ({ ...s, actions: (s.actions ?? []).filter((a) => a.id !== actionId) }))
}

/** Opt a screen into a user-owned `handlers.ts` companion (design + your own code).
 *  The generator scaffolds the stub once and never rewrites it. */
export function enableScreenCode(project: StudioProject, screenId: string): StudioProject {
  return mapScreen(project, screenId, (s) => ({ ...s, code: true }))
}

/** Drop the code companion binding (leaves any file the user already wrote on disk;
 *  the generator simply stops emitting/importing it). */
export function disableScreenCode(project: StudioProject, screenId: string): StudioProject {
  return mapScreen(project, screenId, (s) => ({ ...s, code: false, renderGrid: undefined }))
}

/** Toggle whether the page renders a Grid fed by `ctx.setRows` from `onLoad`.
 *  Implies `code: true` (a Grid needs the handler to fill it). */
export function setScreenRenderGrid(project: StudioProject, screenId: string, on: boolean): StudioProject {
  return mapScreen(project, screenId, (s) => ({ ...s, code: on ? true : s.code, renderGrid: on || undefined }))
}

/** Set the body of one event handler (e.g. `load`) - the code inside the generated
 *  function. This is what the designer's Code view edits per slot (the "single
 *  onLoad block"). Empty clears it back to the stub default. Implies `code: true`. */
export function setHandlerBody(project: StudioProject, screenId: string, handler: string, body: string): StudioProject {
  return mapScreen(project, screenId, (s) => {
    const bodies = { ...(s.handlerBodies ?? {}) }
    if (body.trim()) bodies[handler] = body
    else delete bodies[handler]
    return { ...s, code: true, handlerBodies: Object.keys(bodies).length ? bodies : undefined }
  })
}

/** Set the full source the designer writes into the screen's `handlers.ts` companion.
 *  An advanced escape hatch that overrides the structured per-event bodies: when
 *  present it is emitted verbatim. Empty string clears it. Implies `code: true`. */
export function setScreenHandlersSource(project: StudioProject, screenId: string, source: string): StudioProject {
  const trimmed = source.trim()
  return mapScreen(project, screenId, (s) => ({ ...s, code: true, handlersSource: trimmed || undefined }))
}

// --- visual methods (the Methods panel) ------------------------------------
/** Replace the steps of one method slot (`onLoad`, `onDestroy`, or `click:<blockId>`).
 *  An empty list clears the slot. Implies `code: true`. */
export function setHandlerSteps(project: StudioProject, screenId: string, slot: string, steps: ActionStep[]): StudioProject {
  return mapScreen(project, screenId, (s) => {
    const all = { ...(s.handlerSteps ?? {}) }
    if (steps.length) all[slot] = steps
    else delete all[slot]
    return { ...s, code: true, handlerSteps: Object.keys(all).length ? all : undefined }
  })
}
/** Append a step to a method slot. */
export function addHandlerStep(project: StudioProject, screenId: string, slot: string, step: ActionStep): StudioProject {
  const s = project.screens.find((x) => x.id === screenId)
  return setHandlerSteps(project, screenId, slot, [...(s?.handlerSteps?.[slot] ?? []), step])
}
/** Replace / remove a step at `index` (null removes it). */
export function updateHandlerStep(project: StudioProject, screenId: string, slot: string, index: number, step: ActionStep | null): StudioProject {
  const s = project.screens.find((x) => x.id === screenId)
  const steps = [...(s?.handlerSteps?.[slot] ?? [])]
  if (index < 0 || index >= steps.length) return project
  if (step === null) steps.splice(index, 1)
  else steps[index] = step
  return setHandlerSteps(project, screenId, slot, steps)
}
/** Move a step within its slot (dir -1 up, +1 down). */
export function moveHandlerStep(project: StudioProject, screenId: string, slot: string, index: number, dir: -1 | 1): StudioProject {
  const s = project.screens.find((x) => x.id === screenId)
  const steps = [...(s?.handlerSteps?.[slot] ?? [])]
  const j = index + dir
  if (index < 0 || index >= steps.length || j < 0 || j >= steps.length) return project
  ;[steps[index], steps[j]] = [steps[j]!, steps[index]!]
  return setHandlerSteps(project, screenId, slot, steps)
}
/** Drop the visual steps for a slot into the raw code editor (compile once), so a
 *  user can hand-edit from there. Moves `handlerSteps[slot]` -> `handlerBodies[slot]`. */
export function stepsToCode(project: StudioProject, screenId: string, slot: string): StudioProject {
  const s = project.screens.find((x) => x.id === screenId)
  const steps = s?.handlerSteps?.[slot]
  if (!steps?.length) return project
  const withBody = setHandlerBody(project, screenId, slot, compileHandlerSteps(steps))
  return setHandlerSteps(withBody, screenId, slot, [])
}

/** Deep-clone `block` with fresh ids (recursing into Tabs children). */
function freshBlockIds(blocks: ReadonlyArray<Block>, taken: Set<string>): Block[] {
  return blocks.map((b) => {
    const config = JSON.parse(JSON.stringify(b.config)) as BlockConfig
    const id = uid(`${config.kind}-`, taken)
    taken.add(id)
    if (config.kind === 'tabs') config.tabs = config.tabs.map((t) => ({ ...t, blocks: freshBlockIds(t.blocks, taken) }))
    if (config.kind === 'accordion') config.sections = config.sections.map((s) => ({ ...s, blocks: freshBlockIds(s.blocks, taken) }))
    return { ...b, id, config }
  })
}

/** Insert a block (deep-cloned, fresh id) into a screen - the paste target. Appends by default. */
export function insertBlock(project: StudioProject, screenId: string, block: Block, index?: number): StudioProject {
  return mapScreen(project, screenId, (s) => {
    const taken = new Set(flattenBlocks(s.blocks).map((b) => b.id))
    const [clone] = freshBlockIds([block], taken)
    const blocks = [...s.blocks]
    blocks.splice(index ?? blocks.length, 0, clone!)
    return { ...s, blocks }
  })
}

/** Duplicate a whole screen (fresh id / route / title + fresh block ids), inserted after it. */
export function duplicateScreen(project: StudioProject, screenId: string): StudioProject {
  const idx = project.screens.findIndex((s) => s.id === screenId)
  if (idx < 0) return project
  const src = project.screens[idx]!
  const ids = new Set(project.screens.map((s) => s.id))
  const routes = new Set(project.screens.map((s) => s.route))
  const id = uid(`${src.entity}-`, ids)
  const route = uid(`${src.route}-`, routes)
  // Seed the taken-ids set with the source's block ids so the clone's ids don't collide.
  const clone: Screen = { ...src, id, route, title: `${src.title} copy`, blocks: freshBlockIds(src.blocks, new Set(flattenBlocks(src.blocks).map((b) => b.id))) }
  const screens = [...project.screens]
  screens.splice(idx + 1, 0, clone)
  return { ...project, screens }
}

/** Move a screen to an explicit index (drag-reorder the tab strip). Clamps to range. */
export function reorderScreen(project: StudioProject, screenId: string, toIndex: number): StudioProject {
  const from = project.screens.findIndex((s) => s.id === screenId)
  if (from < 0) return project
  const screens = [...project.screens]
  const [moved] = screens.splice(from, 1)
  screens.splice(Math.max(0, Math.min(toIndex, screens.length)), 0, moved!)
  return { ...project, screens }
}

export function setDataSource(project: StudioProject, dataSource: DataSourceKind): StudioProject {
  return { ...project, dataSource }
}

/** Set the deploy target (SvelteKit adapter + provider config the bundle emits). */
export function setDeployTarget(project: StudioProject, deploy: DeployTarget): StudioProject {
  if (deploy === 'auto') { const { deploy: _drop, ...rest } = project; return rest }
  return { ...project, deploy }
}

/** Enable / disable the authentication starter (login + session + hooks). */
export function setAuth(project: StudioProject, patch: Partial<AuthConfig> & { enabled: boolean }): StudioProject {
  if (!patch.enabled) { const { auth: _drop, ...rest } = project; return rest }
  const prev = project.auth
  const oauth = patch.oauth ?? prev?.oauth
  return {
    ...project,
    auth: {
      enabled: true,
      protect: patch.protect ?? prev?.protect ?? true,
      register: patch.register ?? prev?.register ?? false,
      userAdmin: patch.userAdmin ?? prev?.userAdmin ?? false,
      ...(oauth && oauth.length ? { oauth } : {}),
      ...((patch.twoFactor ?? prev?.twoFactor) ? { twoFactor: true } : {}),
      ...((patch.email ?? prev?.email) ? { email: true } : {}),
    },
  }
}

/** Enable / disable the typed Drizzle data layer (schema + repos + migrations). */
export function setDataLayer(project: StudioProject, enabled: boolean): StudioProject {
  if (!enabled) { const { dataLayer: _drop, ...rest } = project; return rest }
  return { ...project, dataLayer: 'drizzle' }
}

/** A demo user seed for the auth starter: one user per RBAC role (so you can sign in
 *  and see each role's access), or a single admin when RBAC is off. Passwords are
 *  demo seeds (like sample rows) - the generated code flags them for replacement. */
export type SeedUser = { email: string; name: string; role: string; password: string }
export function seedUsers(project: StudioProject): SeedUser[] {
  const roles = project.access?.enabled ? project.access.roles.map((r) => r.role) : []
  if (!roles.length) return [{ email: 'admin@example.com', name: 'Admin', password: 'admin1234', role: 'admin' }]
  return roles.map((role) => ({
    email: `${role.replace(/[^a-z0-9]+/gi, '')}@example.com`.toLowerCase(),
    name: role.charAt(0).toUpperCase() + role.slice(1),
    role,
    password: `${role.replace(/[^a-z0-9]+/gi, '').toLowerCase()}1234`,
  }))
}

/** A skeleton binding for a kind, seeded with the entity's name as its table/path. */
export function defaultEntitySource(kind: DataSourceKind, entityName: string): EntityDataSource {
  switch (kind) {
    case 'rest': return { kind: 'rest', baseUrl: '', path: entityName, method: 'GET', params: [] }
    case 'sql': return { kind: 'sql', table: entityName }
    case 'supabase': return { kind: 'supabase', table: entityName }
    case 'pglite': return { kind: 'pglite', table: entityName }
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
    ...(p.auth && typeof p.auth === 'object' && (p.auth as AuthConfig).enabled ? { auth: p.auth as AuthConfig } : {}),
    ...(p.dataLayer === 'drizzle' ? { dataLayer: 'drizzle' as const } : {}),
    ...(typeof p.audit === 'boolean' ? { audit: p.audit } : {}),
    ...(p.i18n && typeof p.i18n === 'object' ? { i18n: p.i18n as I18nConfig } : {}),
    ...(typeof p.deploy === 'string' && p.deploy !== 'auto' ? { deploy: p.deploy as DeployTarget } : {}),
    ...(p.triggers && typeof p.triggers === 'object' ? { triggers: p.triggers as Record<string, EntityTriggers> } : {}),
  })
}

/** Validate a project. Errors block codegen; warnings are advisory. */
export function validateProject(project: StudioProject): ProjectIssue[] {
  const issues: ProjectIssue[] = []
  if (project.entities.length === 0) issues.push({ level: 'error', message: 'Add at least one entity.' })
  if (project.screens.length === 0) issues.push({ level: 'warning', message: 'No screens yet.' })

  const routes = new Set<string>()
  for (const s of project.screens) {
    // `entity` is optional (a freestanding screen has none, by design) - only a
    // *dangling* reference (set but unresolvable) is an error.
    if (s.entity !== undefined && !entityOf(project, s.entity)) {
      issues.push({ level: 'error', message: `Screen "${s.title}" points at a missing entity "${s.entity}".`, screen: s.id })
    }
    if (routes.has(s.route)) issues.push({ level: 'error', message: `Duplicate route "/${s.route}".`, screen: s.id })
    routes.add(s.route)
    if (s.entity !== undefined && s.blocks.length === 0) {
      issues.push({ level: 'warning', message: `Screen "${s.title}" has no blocks.`, screen: s.id })
    } else if (s.entity === undefined && !s.actions?.length && s.blocks.length === 0) {
      issues.push({ level: 'warning', message: `Screen "${s.title}" is empty - add an action or some content.`, screen: s.id })
    }
    for (const b of flattenBlocks(s.blocks)) {
      const at = (message: string, level: ProjectIssueLevel = 'warning'): ProjectIssue => ({ level, message, screen: s.id, block: b.id })
      const c = b.config
      if (c.kind === 'master-detail') {
        if (!c.childEntity || !c.foreignKey) issues.push(at('Master/detail needs a child entity + foreign key.'))
        else if (!entityOf(project, c.childEntity)) issues.push(at(`Master/detail points at a missing child entity "${c.childEntity}".`))
      } else if (c.kind === 'tree') {
        if (!c.labelField || !c.parentField) issues.push(at('Tree needs a label field and a self-referential parent field.'))
      } else if (c.kind === 'lookup') {
        if (!c.field) issues.push(at('Lookup needs a relation field.'))
      } else if (c.kind === 'filter') {
        if (!c.fields.length) issues.push(at('Filter panel has no facets - pick fields to filter on.'))
      } else if (c.kind === 'chart') {
        if (!c.dimension) issues.push(at('Chart has no group-by dimension.'))
      } else if (c.kind === 'pivot') {
        if (!c.rows.length && !c.cols.length) issues.push(at('Pivot has no row or column dimensions.'))
      } else if (c.kind === 'tabs') {
        if (c.tabs.every((t) => t.blocks.length === 0)) issues.push(at('Tabs container has no blocks in any tab.'))
      } else if (c.kind === 'accordion') {
        if (c.sections.every((s) => s.blocks.length === 0)) issues.push(at('Accordion container has no blocks in any section.'))
      } else if (c.kind === 'component') {
        if (!c.component) issues.push(at('Component block has no component selected.'))
      }
    }
  }

  // Project-level deployment footguns (all advisory - the app still generates).
  const sources = Object.values(project.dataSources ?? {})
  const sqlSources = sources.filter((s): s is Extract<EntityDataSource, { kind: 'sql' }> => s.kind === 'sql')
  if (sqlSources.length > 0 && project.dataLayer !== 'drizzle') {
    issues.push({
      level: 'warning',
      message:
        'SQL entities have no migrations - their tables must already exist in the database. ' +
        'Enable the Drizzle data layer for typed migrations, or run the generated db/schema.sql against your database first.',
    })
  }
  if (project.deploy === 'cloudflare' && sqlSources.some((s) => s.dialect === 'postgres' || s.dialect === 'supabase')) {
    issues.push({
      level: 'warning',
      message:
        'Cloudflare Workers cannot run the socket "pg" Postgres driver. Swap the generated route to an HTTP driver ' +
        '(e.g. Neon serverless) or choose another deploy target.',
    })
  }
  for (const [name, src] of Object.entries(project.dataSources ?? {})) {
    if (src.kind === 'supabase' && (!src.url || !src.key)) {
      issues.push({
        level: 'warning',
        message: `Supabase entity "${name}" has no URL/key - the generated client is a stub that throws until you fill in src/lib/connections.ts.`,
      })
    }
  }
  return issues
}

export function isProjectValid(project: StudioProject): boolean {
  return !validateProject(project).some((i) => i.level === 'error')
}
