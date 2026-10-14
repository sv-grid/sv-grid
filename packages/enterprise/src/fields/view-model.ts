/**
 * Saved views: a name, a type (grid, Kanban, calendar, Gantt, gallery,
 * form) and what the grid looked like the last time the view was left -
 * sorts, groups, the filter, hidden fields and their order, widths, pinned
 * columns, row height and row colors. Switching views saves the one being
 * left and applies the other through the grid's own state and options.
 */
import type { RowColorConfig } from '@svgrid/grid'
import { compileFieldFilter, type FieldCondition, type LinkNames } from './filter-model'
import { fieldColumns, primaryIdOf, writeCell, type FieldColumn } from './grid-access'
import { fieldPropsOf, originalColumn } from './registry.svelte'
import { getFieldUsers, getLinkedTable } from './sources.svelte'
import { chooseRowColor, chosenRowColor, clearRowColorChoice } from './row-color-choice.svelte'
import { newRowValues, recordCopyValues } from './field-ops'
import { openRecord } from './editor-request.svelte'
import { rowColorOf, rowMarkColor } from './row-colors'
import { recordHeightOf } from './row-height'
import { askDeleteRecord } from './record-delete.svelte'
import { commentsOf } from './activity.svelte'
import type { ChartSetting } from './chart-view'

export type FieldViewType = 'grid' | 'kanban' | 'calendar' | 'gantt' | 'gallery' | 'chart' | 'form'

/** How rows are colored: not, by a single select's option colors, or by conditions in order. */
export type ColorSetting =
  | { mode: 'none' }
  | { mode: 'field'; field: string }
  | { mode: 'conditions'; rules: Array<{ color: string; condition: FieldCondition }> }

export type FieldView = {
  id: string
  name: string
  type: FieldViewType
  /** The grid's state when the view was last left (`api.getState()`). */
  state?: Record<string, unknown>
  rowHeight?: number
  color?: ColorSetting
  /** Kanban: the single select or user field the cards stack by. */
  stackBy?: string
  /** Calendar and Gantt: the date field a record starts on, and the one it ends on. */
  dateField?: string
  endField?: string
  /** Gantt: a percent field drawn as each bar's fill, and dragged with its grip. */
  progressField?: string
  /** Gantt: a link field to the same table naming the records each one depends on. */
  dependencyField?: string
  /** Gantt: the zoom it was left at. */
  zoom?: string
  /** Gallery: the attachment field whose first image is the card's cover. */
  coverField?: string
  /** Chart: its kind, the field it groups by and what it counts or adds up. */
  chart?: ChartSetting
  /** Form: the fields it asks for, in order (default: every editable field). */
  formFields?: string[]
  /** Form: its title and the line under it. */
  formTitle?: string
  formDescription?: string
  /** Form: the fields that must be filled in before it sends. */
  formRequired?: string[]
  /** Form: the submit button's text (default 'Submit'). */
  formSubmitLabel?: string
}

export const VIEW_TYPES: ReadonlyArray<{ type: FieldViewType; label: string; icon: string }> = [
  { type: 'grid', label: 'Grid', icon: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14' },
  { type: 'kanban', label: 'Kanban', icon: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z' },
  { type: 'calendar', label: 'Calendar', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  { type: 'gantt', label: 'Gantt', icon: 'M4 5h9M7 10h11M10 15h8M4 20h16' },
  { type: 'gallery', label: 'Gallery', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  { type: 'chart', label: 'Chart', icon: 'M4 20h16M6 20V11M11 20V5M16 20v-7' },
  { type: 'form', label: 'Form', icon: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h3' },
]
export const viewTypeInfo = (t: FieldViewType) => VIEW_TYPES.find((v) => v.type === t) ?? VIEW_TYPES[0]!

let seq = 0
export const newViewId = (): string => `view-${Date.now().toString(36)}-${(seq += 1)}`

/** Sort direction labels that fit the field ("1 → 9" for a number, "A → Z" for text). */
export function sortLabels(def: Record<string, any> | undefined): [string, string] {
  const t = def?.fieldType as string | undefined
  const dt = def?.cellDataType as string | undefined
  if (t === 'checkbox' || dt === 'boolean') return ['☐ → ☑', '☑ → ☐']
  // A select sorts in its options' order.
  if (t === 'singleSelect') return ['first → last', 'last → first']
  if (
    dt === 'number' ||
    dt === 'date' ||
    dt === 'dateString' ||
    ['number', 'currency', 'percent', 'rating', 'duration', 'autoNumber', 'count', 'date', 'createdTime', 'lastModifiedTime'].includes(t ?? '')
  )
    return ['1 → 9', '9 → 1']
  return ['A → Z', 'Z → A']
}

// ---- Row colors ------------------------------------------------------------

/** The rows-colored setting as the grid now has it. */
export function colorSettingOf(ctrl: any, saved?: ColorSetting): ColorSetting {
  const cfg = rowColorOf(ctrl) as RowColorConfig | null | undefined
  // Conditions still being written color nothing yet, and are still the setting.
  if (!cfg) return saved?.mode === 'conditions' ? saved : { mode: 'none' }
  if ('field' in cfg) return { mode: 'field', field: cfg.field }
  return saved?.mode === 'conditions' ? saved : { mode: 'none' }
}

/**
 * The grid's `rowColor` for a setting, painted where the `rowColor` prop says
 * (`target`). Conditions are tested as the filter tests them: on the value the
 * cell shows (computed for a formula, lookup, rollup or count), and one still
 * missing its value is left out.
 */
export function rowColorFor(ctrl: any, setting: ColorSetting, linkNames?: LinkNames): RowColorConfig | null {
  if (setting.mode === 'none') return null
  const target = ctrl?.props?.rowColor?.target as RowColorConfig['target'] | undefined
  const where = target ? { target } : {}
  if (setting.mode === 'field') return { field: setting.field, ...where }
  const cols = new Map(fieldColumns(ctrl).map((c) => [c.id, c]))
  const valueOf = (row: Record<string, unknown>, id: string) => {
    const col = cols.get(id)!
    const fn = col.def.fieldFn as ((r: Record<string, unknown>) => unknown) | undefined
    return fn ? fn(row) : row?.[col.field]
  }
  const rules = setting.rules
    .map((r) => {
      if (!cols.has(r.condition.column)) return null
      const test = compileFieldFilter({ kind: 'fieldFilter', conjunction: 'and', conditions: [r.condition] }, valueOf, linkNames)
      return test ? { color: r.color, when: (row: unknown) => test(row as Record<string, unknown>) } : null
    })
    .filter((r): r is NonNullable<typeof r> => !!r)
  return rules.length ? { rules, ...where } : null
}

export function applyColor(ctrl: any, setting: ColorSetting, linkNames?: LinkNames): void {
  chooseRowColor(ctrl, rowColorFor(ctrl, setting, linkNames))
}

// ---- Kanban, calendar, Gantt -----------------------------------------------

/**
 * A row's record id. A view may hand back a copy of the row (a Gantt merges
 * its pending edits into one), which the api cannot find by identity: the
 * grid's own getRowId reads the id from the row's values.
 */
function recordId(ctrl: any, api: any, row: unknown): string {
  const own = ctrl?.props?.getRowId as ((r: unknown, i: number) => unknown) | undefined
  if (own) return String(own(row, -1))
  const id = api.getRowId(row)
  return id == null ? String((row as { id?: unknown })?.id ?? '') : String(id)
}

/** Lanes for a Kanban stacked by a field: an "Uncategorized" lane, then one per option or person. */
export function lanesFor(column: FieldColumn): Array<{ id: string; title: string; color?: string; hideWhenEmpty?: boolean }> {
  const lanes: Array<{ id: string; title: string; color?: string; hideWhenEmpty?: boolean }> = [{ id: '', title: 'Uncategorized', hideWhenEmpty: true }]
  if (column.fieldType === 'user') {
    for (const u of getFieldUsers()) lanes.push({ id: u.id, title: u.name })
    return lanes
  }
  const p = fieldPropsOf(originalColumn(column.def)) as { options?: Array<{ value: string; color?: string }> }
  for (const o of p.options ?? []) lanes.push({ id: o.value, title: o.value, ...(o.color ? { color: o.color } : {}) })
  return lanes
}

/** Fields a Kanban can stack by. */
export const stackableColumns = (ctrl: any) => fieldColumns(ctrl).filter((c) => c.fieldType === 'singleSelect' || (c.fieldType === 'user' && !c.def.fieldProps?.multiple))
/** Fields a calendar or Gantt can place records by. */
export const dateColumns = (ctrl: any) =>
  fieldColumns(ctrl).filter((c) => c.fieldType === 'date' || c.def.cellDataType === 'date' || c.def.cellDataType === 'dateString')
/** Fields a Gantt can draw as progress: a number shown as a percent. */
export const progressColumns = (ctrl: any) =>
  fieldColumns(ctrl).filter((c) => c.fieldType === 'percent' || (c.fieldType === 'number' && fieldPropsOf(originalColumn(c.def)).format === 'percent'))
/** Link fields to the same table: what a record depends on, for a Gantt's arrows. */
export const dependencyColumns = (ctrl: any) =>
  fieldColumns(ctrl).filter((c) => {
    if (c.fieldType !== 'link') return false
    const t = getLinkedTable(fieldPropsOf(originalColumn(c.def)).table)
    if (!t) return false
    const rows = typeof t.rows === 'function' ? t.rows() : t.rows
    return rows === ctrl.internalData || (rows.length > 0 && rows[0] === ctrl.internalData?.[0])
  })

/**
 * Re-apply a calendar or Gantt view after its settings changed (its fields,
 * progress, links or colors), keeping the grid's state.
 */
export function applyGanttSettings(ctrl: any, api: any, view: FieldView, primaryField?: string): void {
  const id = primaryIdOf(ctrl)
  const primary = primaryField ?? fieldColumns(ctrl).find((c) => c.id === id)?.field
  if (view.type === 'gantt') api.setOption('gantt', ganttConfig(ctrl, api, view, primary))
  else if (view.type === 'calendar') api.setOption('scheduler', dateConfig(ctrl, api, view, primary))
}

/** Fields a gallery can take a cover from. */
export const coverColumns = (ctrl: any) => fieldColumns(ctrl).filter((c) => c.fieldType === 'attachment')

export function boardConfig(ctrl: any, api: any, view: FieldView): Record<string, unknown> | undefined {
  const cols = fieldColumns(ctrl)
  const col = cols.find((c) => c.id === view.stackBy)
  if (!col) return undefined
  const primary = cols.find((c) => c.id === primaryIdOf(ctrl))
  return {
    groupBy: col.field,
    lanes: lanesFor(col),
    // The card: the primary field as its title, then the next three fields
    // the view shows (Hide fields takes one off the cards too).
    ...(primary ? { titleField: primary.field } : {}),
    cardFields: cols.filter((c) => c.visible && c !== primary && c !== col).slice(0, 3).map((c) => c.field),
    // The view bar has the search.
    searchable: false,
    // A card dropped in another lane changes the field, through the grid's
    // edit path (undo, validation, onCellValueChange).
    onCardMove: (e: { row: unknown; toLane: string; fromLane: string }) => {
      if (e.toLane === e.fromLane) return
      writeCell(ctrl, recordId(ctrl, api, e.row), col.id, e.toLane === '' ? null : e.toLane)
    },
    // "+ Add a card" in a lane: a record already in that lane, named by the
    // primary field, made the way "+ Add row" makes one.
    // Double-click or F2 on a card opens the record, as a row's expand button does.
    onCardEdit: (row: unknown) => openRecord({ ctrl, rowId: recordId(ctrl, api, row) }),
    // The record's discussion: its comment count on the card, the badge opens it.
    commentCount: (row: unknown) => commentsOf(ctrl, recordId(ctrl, api, row)).length,
    onCommentsOpen: (row: unknown) => openRecord({ ctrl, rowId: recordId(ctrl, api, row), focus: 'comment' }),
    cellGrid: cardGrid(ctrl),
    // Right-click on a card: the record's menu, as in the grid.
    cardMenu: (row: unknown, menu: { lanes: Array<{ id: string; title?: string }>; moveTo: (lane: string) => void }) => {
      const editable = !!ctrl.editingEnabled
      return [
        { label: 'Expand record', onSelect: () => openRecord({ ctrl, rowId: recordId(ctrl, api, row) }) },
        { label: 'Comment', onSelect: () => openRecord({ ctrl, rowId: recordId(ctrl, api, row), focus: 'comment' }) },
        ...(editable
          ? [
              { label: 'Move to', children: menu.lanes.map((l) => ({ label: l.title ?? (l.id || 'Empty'), onSelect: () => menu.moveTo(l.id) })) },
              { label: 'Duplicate record', onSelect: () => duplicateRecord(ctrl, api, row) },
              { separator: true },
              { label: 'Delete record', onSelect: () => askDeleteRecord({ ctrl, api, row }) },
            ]
          : []),
      ]
    },
    composer: true,
    onCardAdd: (laneId: string, title?: string) => {
      const primary = fieldColumns(ctrl).find((c) => c.id === primaryIdOf(ctrl))
      const cfg = ctrl.props.rowAdder
      const defaults = cfg && typeof cfg === 'object' && typeof cfg.defaults === 'function' ? cfg.defaults() : {}
      const row: Record<string, unknown> = newRowValues(ctrl, {
        ...defaults,
        [col.field]: laneId === '' ? null : laneId,
        ...(primary && title ? { [primary.field]: title } : {}),
      })
      api.addRow(row, 'bottom')
      ctrl.props.onRowAdd?.({ row })
    },
  }
}

/**
 * The grid's `gallery` for a gallery view: the cover field, the primary field
 * as the title, then the fields the grid shows, in its order. A card opens
 * its record. Built again when fields are hidden or moved.
 */
export function galleryConfig(ctrl: any, api: any, view: FieldView): Record<string, unknown> {
  const cols = fieldColumns(ctrl)
  const primary = cols.find((c) => c.id === primaryIdOf(ctrl)) ?? cols.find((c) => c.visible)
  const cover = cols.find((c) => c.id === view.coverField)
  return {
    ...(cover ? { coverField: cover.field } : {}),
    ...(primary ? { titleField: primary.field } : {}),
    cardFields: cols.filter((c) => c.visible && c !== primary && c !== cover).map((c) => c.field),
    // The bar has its own search; the grid's would be a second box.
    searchable: false,
    onCardClick: (row: unknown) => openRecord({ ctrl, rowId: recordId(ctrl, api, row) }),
    cellGrid: cardGrid(ctrl),
  }
}

/**
 * The grid as a field cell on a card sees it: every method and prop of the
 * grid, with the card's width as the column's. A custom field type's cell
 * can open its record or read the grid's props from a card as from a row,
 * and a button runs its automation. A card is read, not edited (the record
 * it opens is), so the grid says editing is off: no stars to click, no drop.
 */
export function cardGrid(ctrl: any): (width: number) => unknown {
  return (width) =>
    new Proxy(ctrl, {
      get: (t, key) => {
        if (key === 'getColumnWidth') return () => width
        if (key === 'editingEnabled') return false
        // Read with the grid itself as `this`: its state lives in private fields.
        const v = Reflect.get(t, key, t)
        return typeof v === 'function' ? v.bind(t) : v
      },
    })
}

/** A date field without a time holds days. */
const holdsDays = (c: FieldColumn) => (c.fieldType === 'date' && !c.def.fieldProps?.time) || c.def.cellDataType === 'dateString'

/** A moved date, written the way the field keeps it: 'YYYY-MM-DD' for days, else an ISO time. */
function dateValue(c: FieldColumn, d: Date): string {
  if (!holdsDays(c)) return d.toISOString()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * A view colored by a select field colors its events the same way: the options
 * become the calendar's color legend, which also hides and shows them.
 */
function eventColors(cols: FieldColumn[], color: ColorSetting | undefined): Record<string, unknown> {
  if (color?.mode !== 'field') return {}
  const col = cols.find((c) => c.field === color.field)
  if (!col || col.fieldType !== 'singleSelect') return {}
  const calendars = lanesFor(col).filter((l) => l.id !== '' && l.color).map(({ id, title, color }) => ({ id, title, color }))
  return calendars.length ? { calendars, calendarField: col.field } : {}
}

function dateConfig(ctrl: any, api: any, view: FieldView, primaryField: string | undefined): Record<string, unknown> | undefined {
  const cols = fieldColumns(ctrl)
  const start = cols.find((c) => c.id === view.dateField)
  if (!start) return undefined
  const end = cols.find((c) => c.id === view.endField)
  // A record dragged to another day changes its dates, through the grid's edit
  // path. The calendar's ends are exclusive; a date-only field keeps the last day.
  const move = (e: { row: unknown; start: Date; end: Date }) => {
    const id = recordId(ctrl, api, e.row)
    writeCell(ctrl, id, start.id, dateValue(start, e.start))
    if (end) writeCell(ctrl, id, end.id, e.end.getTime() > e.start.getTime() ? lastDayValue(end, e.end) : dateValue(end, e.start))
  }
  const editable = gridEditable(ctrl)
  return {
    searchable: false,
    editable,
    history: editable,
    tooltip: true,
    // An event opens its record, as a card or a bar does.
    onEventOpen: (row: unknown) => openRecord({ ctrl, rowId: recordId(ctrl, api, row) }),
    onEventDelete: (row: unknown) => deleteRecord(ctrl, api, row),
    startField: start.field,
    ...(end ? { endField: end.field } : {}),
    ...(primaryField ? { titleField: primaryField } : {}),
    ...(holdsDays(start) ? { allDay: true } : {}),
    ...eventColors(cols, view.color),
    onEventMove: move,
    // One date field: a record has no end to change, so its events only move.
    ...(end ? { onEventResize: move } : { resizable: false }),
    // A day (or range) picked on the calendar: a record on it, opened to fill in.
    onEventAdd: (from: Date, to: Date) => {
      const cfg = ctrl.props.rowAdder
      const defaults = cfg && typeof cfg === 'object' && typeof cfg.defaults === 'function' ? cfg.defaults() : {}
      const row: Record<string, unknown> = newRowValues(ctrl, {
        ...defaults,
        [start.field]: dateValue(start, from),
        ...(end ? { [end.field]: to.getTime() > from.getTime() ? lastDayValue(end, to) : dateValue(end, from) } : {}),
      })
      api.addRow(row, 'bottom')
      ctrl.props.onRowAdd?.({ row })
      queueMicrotask(() => openRecord({ ctrl, rowId: recordId(ctrl, api, row), editPrimary: true }))
    },
  }
}

/** Whether the grid lets people edit (the base's `editable`). */
const gridEditable = (ctrl: any): boolean => ctrl.props.editable !== false && !!(ctrl.props.editable ?? ctrl.props.enableInlineEditing)

/** An exclusive end written back: a date-only field keeps the last day (the day before). */
function lastDayValue(c: FieldColumn, d: Date): string {
  return holdsDays(c) ? dateValue(c, new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)) : dateValue(c, d)
}

/** A copy of a record a view handed over, right after it, made as "+ Add row" makes one. */
function duplicateRecord(ctrl: any, api: any, row: unknown): void {
  const id = recordId(ctrl, api, row)
  const data = ctrl.internalData as unknown[]
  const at = data.findIndex((r) => recordId(ctrl, api, r) === id)
  if (at < 0) return
  const next = newRowValues(ctrl, recordCopyValues(ctrl, data[at] as Record<string, unknown>))
  api.addRow(next, at + 1)
  ctrl.props.onRowAdd?.({ row: next })
}

/** Remove a record a view handed over (a copy, perhaps), and report it as the grid's delete does. */
export function deleteRecord(ctrl: any, api: any, row: unknown): void {
  const id = recordId(ctrl, api, row)
  const data = ctrl.internalData as unknown[]
  const at = data.findIndex((r) => recordId(ctrl, api, r) === id)
  if (at < 0) return
  const gone = data[at]
  api.removeRows([at])
  ctrl.props.onRowsDelete?.({ rows: [gone], ids: [id], data: ctrl.internalData })
}

/**
 * A Gantt: the calendar's dates and moves, and a task table beside the bars
 * that holds the record's name, its dates and its length in working days.
 * Every field would fill the table and push the chart out of view.
 */
// The zoom a grid's Gantt was last set to, per grid.
const ganttZoom = new WeakMap<object, string>()

function ganttConfig(ctrl: any, api: any, view: FieldView, primaryField: string | undefined): Record<string, unknown> | undefined {
  ganttZoom.delete(ctrl)
  const cols = fieldColumns(ctrl)
  const start = cols.find((c) => c.id === view.dateField)
  if (!start) return undefined
  const end = cols.find((c) => c.id === view.endField)
  const progress = cols.find((c) => c.id === view.progressField)
  const deps = cols.find((c) => c.id === view.dependencyField && c.fieldType === 'link')
  const idOfField = (field: unknown) => cols.find((c) => c.field === field)?.id
  const table = [idOfField(primaryField), start.id, end?.id].filter((id): id is string => !!id)
  const idOf = (row: unknown) => recordId(ctrl, api, row)

  // Bars take the view's row colors, by a field or by conditions, as the rows
  // do: the color the grid gives a row is its bar's.
  const colorOf = view.color && view.color.mode !== 'none' ? (row: unknown) => rowMarkColor(ctrl, row) ?? undefined : undefined

  // The Gantt's ends are exclusive; a date-only field keeps the last day.
  const endValue = (d: Date) => lastDayValue(end!, d)
  const writeDates = (id: string, from: Date, to: Date) => {
    writeCell(ctrl, id, start.id, dateValue(start, from))
    if (end) writeCell(ctrl, id, end.id, to.getTime() > from.getTime() ? endValue(to) : dateValue(end, from))
  }
  // A percent field holds 0 to 1 unless it says 0 to 100; the Gantt draws 0 to 100.
  const points = !!(progress && fieldPropsOf(originalColumn(progress.def)).points)
  const depsOf = (id: string): string[] => {
    const row = (ctrl.internalData as Record<string, unknown>[]).find((r) => idOf(r) === id)
    const v = row?.[deps!.field]
    return Array.isArray(v) ? v.map(String) : v == null || v === '' ? [] : [String(v)]
  }
  const editable = gridEditable(ctrl)

  return {
    searchable: false,
    startField: start.field,
    ...(end ? { endField: end.field } : {}),
    ...(primaryField ? { titleField: primaryField } : {}),
    tableColumns: [...new Set(table), '__duration'],
    // The dates sit compact beside the bars; the record's name takes the rest.
    tableColumnWidths: Object.fromEntries([start, end].filter((c): c is FieldColumn => !!c).map((c) => [c.id, holdsDays(c) ? 144 : 176])),
    ...(colorOf ? { colorOf } : {}),
    ...(view.zoom ? { zoom: view.zoom } : {}),
    tooltip: true,
    editable,
    history: editable,
    // A bar opens its record, as a card or a calendar event does.
    onTaskOpen: (row: unknown) => openRecord({ ctrl, rowId: idOf(row) }),
    onTaskMove: (e: { row: unknown; start: Date; end: Date; subtree?: Array<{ row: unknown; start: Date; end: Date }> }) => {
      writeDates(idOf(e.row), e.start, e.end)
      for (const s of e.subtree ?? []) writeDates(idOf(s.row), s.start, s.end)
    },
    onTaskResize: (e: { row: unknown; start: Date; end: Date }) => writeDates(idOf(e.row), e.start, e.end),
    // Records a moved task pushed later to keep its links legal.
    onDependenciesChange: (moves: Array<{ id: string; start: Date; end: Date }>) => {
      for (const m of moves) writeDates(m.id, m.start, m.end)
    },
    ...(progress
      ? {
          progressField: progress.field,
          // The Gantt reads 0 to 100: a fraction field is scaled on the way in.
          ...(points ? {} : { progressValue: (row: Record<string, unknown>) => Number(row?.[progress.field] ?? 0) * 100 }),
          onProgressChange: (e: { row: unknown; progress: number }) => writeCell(ctrl, idOf(e.row), progress.id, points ? e.progress : e.progress / 100),
        }
      : {}),
    ...(deps
      ? {
          predecessorField: deps.field,
          onDependencyAdd: (d: { from: string; to: string }) => {
            const now = depsOf(d.to)
            if (!now.includes(d.from)) writeCell(ctrl, d.to, deps.id, [...now, d.from])
          },
          onDependencyRemove: (depId: string) => {
            const [from, to] = depId.split('->')
            if (from && to) writeCell(ctrl, to, deps.id, depsOf(to).filter((x) => x !== from))
          },
        }
      : {}),
    // Kept with the view when it is left (captureView).
    onZoomChange: (zoom: string) => {
      ganttZoom.set(ctrl, zoom)
    },
    // A day picked on the chart: a record on it, opened to fill in.
    onTaskAdd: (from: Date, to: Date) => {
      const cfg = ctrl.props.rowAdder
      const defaults = cfg && typeof cfg === 'object' && typeof cfg.defaults === 'function' ? cfg.defaults() : {}
      const row: Record<string, unknown> = newRowValues(ctrl, {
        ...defaults,
        [start.field]: dateValue(start, from),
        ...(end ? { [end.field]: to.getTime() > from.getTime() ? endValue(to) : dateValue(end, from) } : {}),
      })
      api.addRow(row, 'bottom')
      ctrl.props.onRowAdd?.({ row })
      queueMicrotask(() => openRecord({ ctrl, rowId: idOf(row), editPrimary: true }))
    },
    // By id: the Gantt hands over a copy of the row.
    onTaskDelete: (row: unknown) => deleteRecord(ctrl, api, row),
  }
}

// ---- Capture and apply ------------------------------------------------------

/** A new view: no filter, sorts, groups or hidden fields. */
export const PLAIN_STATE: Record<string, unknown> = { sorting: [], grouping: [], hiddenColumns: [], advancedFilter: null }

/** The view as the grid now shows it, to keep when the view is left. */
export function captureView(ctrl: any, api: any, view: FieldView): FieldView {
  const state = { ...(api.getState() as Record<string, unknown>) }
  // Paging, charts and the search box's text are not part of a view.
  delete state.pagination
  delete state.chart
  delete state.charts
  delete state.chartActive
  delete state.globalFilter
  const rowHeight = recordHeightOf(api.getOption('rowHeight'))
  const zoom = view.type === 'gantt' ? ganttZoom.get(ctrl) : undefined
  // No colors chosen (by a view or the column menu): the `rowColor` prop is in
  // force, and the view keeps no color setting of its own.
  const { color: _color, ...rest } = view
  const color = chosenRowColor(ctrl) === undefined ? undefined : colorSettingOf(ctrl, view.color)
  return {
    ...rest,
    state,
    ...(typeof rowHeight === 'number' ? { rowHeight } : {}),
    ...(zoom ? { zoom } : {}),
    ...(color ? { color } : {}),
  }
}

/** Show a view: its grid state, row height, colors, and the grid's mode for its type. */
export function applyView(ctrl: any, api: any, view: FieldView, opts: { primaryField?: string; linkNames?: LinkNames } = {}): void {
  // A view not shown before starts plain; one saved before a filter existed
  // clears the filter now on. The search box starts empty in every view.
  api.setState({ advancedFilter: null, ...(view.state ?? PLAIN_STATE), globalFilter: '' })
  // A grouped view opens with its groups open, unless it kept which were.
  const grouping = (view.state as { grouping?: unknown[]; expanded?: unknown } | undefined)
  // The grouped rows exist once the grid has taken the new state: open them then.
  if (grouping?.grouping?.length && grouping.expanded === undefined) setTimeout(() => api.expandAllGroups?.(), 0)
  if (view.rowHeight != null) api.setOption('rowHeight', view.rowHeight)
  // A view with no color setting shows the `rowColor` prop's colors.
  if (view.color) applyColor(ctrl, view.color, opts.linkNames)
  else clearRowColorChoice(ctrl)
  api.setOption('board', view.type === 'kanban' ? boardConfig(ctrl, api, view) : undefined)
  api.setOption('gallery', view.type === 'gallery' ? galleryConfig(ctrl, api, view) : undefined)
  // A record's title on a calendar or Gantt: the primary field.
  const id = primaryIdOf(ctrl)
  const primary = opts.primaryField ?? fieldColumns(ctrl).find((c) => c.id === id)?.field
  api.setOption('scheduler', view.type === 'calendar' ? dateConfig(ctrl, api, view, primary) : undefined)
  api.setOption('gantt', view.type === 'gantt' ? ganttConfig(ctrl, api, view, primary) : undefined)
}
