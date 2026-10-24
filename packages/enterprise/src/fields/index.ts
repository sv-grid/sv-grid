/**
 * @svgrid/enterprise/fields - field types for `<SvGrid>`, the engine of SvGrid
 * Base (a Suite product; `@svgrid/enterprise/base` is the product entry).
 *
 * ```ts
 * import { enableFields } from '@svgrid/enterprise/fields'
 * enableFields()
 *
 * const columns = [
 *   { field: 'site', header: 'Site', fieldType: 'url' },
 *   { field: 'score', header: 'Score', fieldType: 'rating' },
 *   { field: 'status', header: 'Status', fieldType: 'singleSelect',
 *     fieldProps: { options: [{ value: 'Done', color: '#16a34a' }] } },
 * ]
 * ```
 *
 * Also draws the grid's `rowAdder` line ("+ Add row" under the last row) and
 * its `rowColor` marks (a status color on each row's header), the `columnAdder`
 * "+" with its field editor, and the `fieldMenu` actions in the column menu.
 *
 * A separate module, not part of `installEnterprise()`: an app that does not
 * call `enableFields()` does not ship it, and `@svgrid/grid` carries only the
 * `registerGridExtension` seam it plugs into.
 */
import { registerCellEditor, registerGridExtension, registerGridShortcuts } from '@svgrid/grid'
import { nudgeEnterpriseFor } from '../license'
import FieldCell from './FieldCell.svelte'
import RowAdder from './RowAdder.svelte'
import FootRowAdder from './FootRowAdder.svelte'
import AttachmentEditor from './AttachmentEditor.svelte'
import FieldsHeaderEnd from './FieldsHeaderEnd.svelte'
import { askDeleteField, openFieldEditor, openRecord } from './editor-request.svelte'
import { enableAdvancedFilter, registerFilterKind } from '../advanced-filter-enable'
import { compileFieldFilter, newCondition, resolveMeWith, type FieldFilter } from './filter-model'
import { hasBar, openBarPanel } from './bar-request.svelte'
import { groupRules, userSorts, writeSortState } from './viewbar/sort-state'
import { sortLabels } from './view-model'
import { noteChange } from './activity.svelte'
import { getLinkedTable } from './sources.svelte'
import { linkNames, registerBaseCondition } from './base-alerts'
import { duplicateField, hideField, indexBeside, removeField } from './field-ops'
import { linkReaders } from './base-tables'
import { formulaReaders } from './formula'
import { BUILTIN_FIELD_TYPES } from './builtin-types'
import { rowColorOf, rowColorRootClass, tallRowClass, rowMarkColor, rowMarkLabel } from './row-colors'
import { chooseRowColor } from './row-color-choice.svelte'
import { fieldPropsOf, fillFieldColumn, getFieldType, originalColumn, registerFieldType, typeDrawsCell } from './registry.svelte'
import RatingEditor from './RatingEditor.svelte'
import LinkPickerEditor from './LinkPickerEditor.svelte'
import SelectEditor from './SelectEditor.svelte'
import NumberEditor from './NumberEditor.svelte'
import LongTextEditor from './LongTextEditor.svelte'
import RowHeader from './RowHeader.svelte'
import GroupHeader from './GroupHeader.svelte'
import SummaryCell from './SummaryCell.svelte'
import { getCurrentUser } from './sources.svelte'
import { fieldColumns, gridOf, primaryIdOf, rememberGrid } from './grid-access'

export {
  registerFieldType,
  getFieldType,
  listFieldTypes,
  fieldPropsOf,
  fillFieldColumn,
  type FieldTypeDef,
  type FieldCellProps,
} from './registry.svelte'
export { linkHref, linkText, type LinkKind } from './links'
export {
  setFieldUsers,
  getFieldUsers,
  setCurrentUser,
  getCurrentUser,
  registerLinkedTable,
  unregisterLinkedTable,
  getLinkedTable,
  listLinkedTables,
  type FieldUser,
  type LinkedTable,
} from './sources.svelte'
export { compileFormula, formulaError, FORMULA_FUNCTIONS, FormulaError } from './formula'
export { formatNumber, formatCurrency, formatPercent, formatDuration, parseDuration, formatDate } from './format'
export { BRIGHT, OPTION_COLORS } from './palette'
export { convertValue, countCleared } from './convert'
export { openFieldEditor, closeFieldEditor, openRecord, closeRecord, type OpenRecordRequest } from './editor-request.svelte'
export { default as SvBaseViewBar } from './SvBaseViewBar.svelte'
export { default as SvBaseForm } from './SvBaseForm.svelte'
export { default as SvBase } from './SvBase.svelte'
export { blankTable, newRecordId, type BaseTable } from './base-tables'
export {
  baseSource,
  createBaseSync,
  type BaseSource,
  type BaseSourceOptions,
  type BaseSyncStatus,
  type BaseRemoteChange,
  type ForeignKeyLink,
  type JunctionLink,
} from './base-sync'
export { baseFieldsFromSchema, baseTablesFromSchemas, baseSpecFromSchemas, baseTablesFromSpec, type BaseTableSpec, type BaseLinkSpec } from './base-schema'
export { baseToSql, sqlName, type BaseToSqlOptions, type BaseTableComment, type BaseJunctionComment } from './base-sql'
export { applyBaseComments, withInverses, type BaseComments } from './base-schema'
export { baseFromDatabase, describeDatabase, createBaseEndpoint, baseFromEndpoint, baseFromSupabase, type DatabaseOptions, type BaseEndpointOptions, type SupabaseBaseOptions } from './base-connect'
export {
  registerAutomationAction,
  listAutomationActions,
  MAX_DEPTH as AUTOMATION_MAX_DEPTH,
  type BaseAutomation,
  type AutomationTrigger,
  type AutomationAction,
  type AutomationRun,
  type AutomationStep,
  type AutomationActionContext,
  type RegisteredAutomationAction,
} from './automations.svelte'
export { createAutomationServer, type AutomationServer, type AutomationServerOptions, type AutomationNotice } from './automation-server'
export type { WebhookAction, EmailAction, OutgoingEmail } from './automation-outbound'
export { setRecordComments, type RecordComment, type RecordCommentContext, type RecordCommentStore } from './activity.svelte'
export { baseCondition, baseFilterOf } from './base-alerts'
export {
  compileFieldFilter,
  describeFieldFilter,
  filterKindOf,
  operatorsFor,
  ME,
  type FieldFilter,
  type FieldCondition,
  type FieldConditionGroup,
  type FilterKind,
  type FilterOp,
} from './filter-model'
export type { FieldView, FieldViewType, ColorSetting } from './view-model'
export type { FieldPropertyDef, FieldEditorContext, FieldFillContext, FieldRowContext } from './registry.svelte'
export { BUILTIN_FIELD_TYPES } from './builtin-types'
export {
  setAttachmentUploader,
  attachmentsFromText,
  attachmentsText,
  toAttachments,
  type Attachment,
  type AttachmentFieldProps,
  type AttachmentUploader,
  type AttachmentUploadContext,
} from './attachments'

const MENU_ICON = {
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  left: 'M10 6l-6 6 6 6M4 12h11M20 5v14',
  right: 'M14 6l6 6-6 6M20 12H9M4 5v14',
  duplicate: 'M8 8h12v12H8zM16 8V4H4v12h4',
  hide: 'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 5 10 7a13.4 13.4 0 0 1-3 3.9M6.6 6.6A13.5 13.5 0 0 0 2 12c1 2 5 7 10 7a9.6 9.6 0 0 0 4.4-1.1',
  remove: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  color: 'M12 3l6 7a6.5 6.5 0 1 1-12 0l6-7z',
  filter: 'M4 5h16l-6 7v6l-4 2v-8z',
  group: 'M4 5h16M4 10h10M4 15h16M4 20h10',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
}

function fieldMenuItems(ctrl: any, columnId: string) {
  // A single select can color the rows (their header) by its option colors.
  const def = ((ctrl?.internalColumns ?? []) as Array<Record<string, any>>).find((c) => String(c.id ?? c.field) === columnId)
  const colorItem =
    def?.fieldType === 'singleSelect' && def.field
      ? rowColorOf(ctrl)?.field === def.field
        ? { key: 'field-rowcolor', label: 'Stop coloring rows', icon: MENU_ICON.color, run: () => chooseRowColor(ctrl, null) }
        : {
            key: 'field-rowcolor',
            label: 'Color rows by this field',
            icon: MENU_ICON.color,
            run: () => chooseRowColor(ctrl, { field: String(def.field), ...(ctrl.props.rowColor?.target ? { target: ctrl.props.rowColor.target } : {}) }),
          }
      : null
  // The primary field is always first and always there.
  const primary = primaryIdOf(ctrl) === columnId
  // With a view bar over the grid: filter or group by this field, in the bar's panel.
  const barItems =
    def && hasBar(ctrl)
      ? [
          ...(newCondition(columnId, def)
            ? [{ key: 'field-filter', label: 'Filter by this field', icon: MENU_ICON.filter, separatorBefore: true, run: () => filterByField(ctrl, columnId, def) }]
            : []),
          ...(ctrl.groupingControlsEnabled
            ? []
            : [{ key: 'field-group', label: 'Group by this field', icon: MENU_ICON.group, run: () => groupByField(ctrl, columnId) }]),
        ]
      : []
  return [
    ...(colorItem ? [colorItem] : []),
    { key: 'field-edit', label: 'Edit field', icon: MENU_ICON.edit, run: () => openFieldEditor({ ctrl, mode: 'edit', columnId }) },
    ...(primary ? [] : [{ key: 'field-left', label: 'Insert left', icon: MENU_ICON.left, run: () => openFieldEditor({ ctrl, mode: 'add', index: indexBeside(ctrl, columnId, 'left') }) }]),
    { key: 'field-right', label: 'Insert right', icon: MENU_ICON.right, run: () => openFieldEditor({ ctrl, mode: 'add', index: indexBeside(ctrl, columnId, 'right') }) },
    { key: 'field-duplicate', label: 'Duplicate field', icon: MENU_ICON.duplicate, run: () => duplicateField(ctrl, columnId) },
    ...barItems,
    ...(primary
      ? []
      : [
          { key: 'field-hide', label: 'Hide field', icon: MENU_ICON.hide, run: () => hideField(ctrl, columnId) },
          {
            key: 'field-delete', label: 'Delete field', icon: MENU_ICON.remove, separatorBefore: true,
            // A link with a field back in another table, or with lookups that read it: they all go, so ask first.
            // So does a field that formulas read: they would turn to #ERROR without a word.
            run: () =>
              (def?.fieldType === 'link' && ((def.fieldProps?.inverse && getLinkedTable(def.fieldProps.table)) || linkReaders({ columns: ctrl.internalColumns }, def).length)) ||
              (def && formulaReaders(ctrl.internalColumns ?? [], def).length)
                ? askDeleteField({ ctrl, columnId })
                : removeField(ctrl, columnId),
          },
        ]),
  ]
}

/** "Filter by this field": a new condition on it, in the bar's open Filter panel. */
function filterByField(ctrl: any, columnId: string, def: Record<string, any>): void {
  const cond = newCondition(columnId, def)
  if (!cond) return
  const now = ctrl.advancedFilter as FieldFilter | null
  const base: FieldFilter = now?.kind === 'fieldFilter' ? now : { kind: 'fieldFilter', conjunction: 'and', conditions: [] }
  ctrl.buildApi().setAdvancedFilter({ ...base, conditions: [...base.conditions, cond] })
  openBarPanel(ctrl, 'filter')
}

/** "Group by this field": one more group level, in the bar's open Group panel. */
function groupByField(ctrl: any, columnId: string): void {
  const groups = groupRules(ctrl)
  if (!groups.some((g) => g.id === columnId)) writeSortState(ctrl.buildApi(), [...groups, { id: columnId, desc: false }], userSorts(ctrl))
  openBarPanel(ctrl, 'group')
}

/** Last modified time / by after an edit. With nobody signed in, "by" keeps the last author. */
function stampModified(ctrl: any, row: Record<string, unknown> | null, columnId: string): void {
  if (!row) return
  const author = getCurrentUser()?.id
  // Into the edit overlay too, as an edit goes: what reads through it (an
  // open record) shows the stamp at once, not after the grid draws again.
  const rowId = ctrl.buildApi?.().getRowId?.(row)
  const overlay = (id: string, value: unknown) => {
    if (rowId != null && ctrl.editedCellValues) ctrl.editedCellValues = { ...ctrl.editedCellValues, [`${rowId}:${id}`]: value }
  }
  for (const c of (ctrl?.internalColumns ?? []) as Array<Record<string, any>>) {
    if (c.fieldType !== 'lastModifiedTime' && c.fieldType !== 'lastModifiedBy') continue
    const id = String(c.id ?? c.field)
    if (id === columnId || !c.field) continue
    const p = fieldPropsOf(originalColumn(c)) as { watch?: string; watchFields?: string[] }
    if (p.watch === 'specific' && !(p.watchFields ?? []).includes(columnId)) continue
    if (c.fieldType === 'lastModifiedTime') overlay(id, (row[c.field] = new Date().toISOString()))
    else if (author !== undefined) overlay(id, (row[c.field] = author))
  }
}

/**
 * Change review (`@svgrid/enterprise/review`) in SvGrid Base: what an edit
 * does, done for each accepted proposal. Last modified time / by fields are
 * stamped, and the record's activity notes the change, credited to the
 * signed-in user who accepted it and to what proposed it ("CRM agent
 * (accepted by Dana)"). An undo is noted as the user's own change.
 *
 * ```ts
 * const review = createReview({ api: () => api, setRows, onApply: baseReviewApplied(() => api) })
 * ```
 */
export function baseReviewApplied(
  api: unknown,
): (
  applied: ReadonlyArray<{ rowId: string; field: string; source: { label: string } }>,
  how: 'accept' | 'undo' | 'redo',
  rows?: ReadonlyArray<unknown>,
) => void {
  return (applied, how, next) => {
    const ctrl = gridOf(typeof api === 'function' ? (api as () => unknown)() : api)
    if (!ctrl) return
    const gridApi = ctrl.buildApi?.()
    const idOf = gridApi?.getOption?.('getRowId') as ((row: unknown, index: number) => string) | undefined
    const rows = new Map<string, Record<string, unknown>>()
    // The rows about to be written: a stamp goes into the same write.
    ;((next ?? gridApi?.getData?.() ?? []) as Array<Record<string, unknown>>).forEach((r, i) => rows.set(String(idOf ? idOf(r, i) : i), r))
    const columnOf = new Map(
      ((ctrl.allColumns ?? []) as Array<{ id: string; columnDef?: { field?: string } }>).map((c) => [c.columnDef?.field, c.id]),
    )
    for (const p of applied) {
      const row = rows.get(p.rowId)
      const columnId = columnOf.get(p.field)
      if (!row || !columnId) continue
      stampModified(ctrl, row, columnId)
      noteChange(ctrl, p.rowId, columnId, row[p.field], undefined, how === 'undo' ? undefined : p.source.label)
    }
  }
}

/** The record's activity: what a cell now holds after an edit. */
function noteEdit(ctrl: any, row: Record<string, unknown> | null, columnId: string): void {
  if (!row) return
  const def = ((ctrl?.allColumns ?? []) as Array<{ id: string; columnDef: Record<string, any> }>).find((c) => c.id === columnId)?.columnDef
  if (!def?.field) return
  const rowId = ctrl.buildApi?.().getRowId?.(row)
  if (rowId != null) noteChange(ctrl, String(rowId), columnId, row[def.field])
}

/** Space on a cell (not a checkbox, not while editing) expands its row, with `expandRows`. */
function spaceOpensRecord(e: KeyboardEvent, cmd: { api: unknown; editing: boolean; activeCell: { rowIndex: number; columnId: string | null } | null }): boolean {
  if (e.key !== ' ' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || cmd.editing || !cmd.activeCell) return false
  const ctrl = gridOf(cmd.api)
  if (!ctrl?.props?.expandRows) return false
  const col = ((ctrl.allColumns ?? []) as Array<{ id: string; columnDef: Record<string, any> }>).find((c) => c.id === cmd.activeCell!.columnId)
  if (col?.columnDef.editorType === 'checkbox') return false
  const row = (ctrl.allRows ?? [])[cmd.activeCell.rowIndex] as { id: string } | undefined
  if (!row) return false
  e.preventDefault()
  openRecord({ ctrl, rowId: row.id })
  return true
}

let enabled = false

/**
 * Turn field types on for every `<SvGrid>` on the page: registers the
 * built-in types and plugs the cell drawing into the grid. Safe to call more
 * than once. Part of SvGrid Base, a Suite product: without a Suite key the
 * grid shows the Enterprise watermark and the feature still runs.
 */
export function enableFields(): void {
  if (enabled) return
  enabled = true
  for (const type of BUILTIN_FIELD_TYPES) {
    // A type the app registered first (same id) wins over the built-in.
    if (!getFieldType(type.id)) registerFieldType(type)
  }
  registerGridExtension({
    column: (def, columns) => fillFieldColumn(def, columns),
    cell: FieldCell as never,
    hasCell: (def) => typeDrawsCell(def ?? {}),
    // Last modified time / by: stamp the row when one of the fields they watch changes.
    cellEdited: (ctrl, info) => {
      stampModified(ctrl, info.row as Record<string, unknown>, info.columnId)
      noteEdit(ctrl, info.row as Record<string, unknown> | null, info.columnId)
    },
    // The `rowAdder` prop's line; it draws nothing when the prop is off. Under
    // the summary row when there is one, after the last record otherwise.
    bodyEnd: RowAdder as never,
    footEnd: FootRowAdder as never,
    // The `rowColor` prop: a color per rendered row, its label, and where it shows.
    rowMarkColor: (ctrl, row) => rowMarkColor(ctrl as never, row),
    rowMarkLabel: (ctrl, row) => rowMarkLabel(ctrl as never, row),
    // The type's icon before the header label, as the field editor shows it.
    headerIcon: (def) => (def?.fieldType ? getFieldType(def.fieldType)?.icon : null),
    // A field's description, on hover over an info mark after its name.
    headerNote: (def) => (def?.fieldType && typeof def.description === 'string' && def.description ? { text: def.description, icon: MENU_ICON.info } : null),
    // The column menu sorts "1 → 9" or "A → Z" as the field reads.
    sortLabels: (def) => (def?.fieldType ? sortLabels(def) : null),
    // The primary field stays pinned first.
    lockColumn: (ctrl, columnId) => primaryIdOf(ctrl) === columnId,
    // `expandRows`: the row number turns into a checkbox and an expand button.
    rowHeader: (ctrl) => (ctrl?.props?.expandRows ? (RowHeader as never) : null),
    // A group's header: the value as its cell draws it, the count, the group's summaries, "+".
    groupRow: (ctrl) => (fieldColumns(ctrl).some((c) => c.fieldType) ? (GroupHeader as never) : null),
    // The footer summary row: each field picks its own summary.
    summaryCell: () => SummaryCell as never,
    rootClass: (ctrl) => {
      // Lets the view bar, given an api, find its grid.
      rememberGrid(ctrl)
      // The view bar's filter shows on its Filter button, not as the grid's chip.
      const ownFilter = (ctrl?.advancedFilter as { kind?: string } | null)?.kind === 'fieldFilter' ? 'sv-fields-own-filter' : ''
      return [rowColorRootClass(ctrl as never), tallRowClass(ctrl as never), ownFilter].filter(Boolean).join(' ') || null
    },
    // The "+" column (`columnAdder`) and the host of the field editor.
    headerEnd: FieldsHeaderEnd as never,
    // `fieldMenu`: field actions in each column's menu.
    columnMenuItems: (ctrl, columnId) => (ctrl?.props?.fieldMenu ? fieldMenuItems(ctrl, columnId) : []),
  })
  // The attachment field edits in a dialog; the editor needs the column's
  // fieldProps (accept, maxFiles, upload) and the row, so map them through.
  // The rating editor follows the field's maximum, icon and color; the link
  // editor picks rows of the linked table. `typeToEdit` is which keys typed
  // on a selected cell open the editor (`typed` tells it the value is that
  // text): a digit sets a rating, a number starts the number box, any text
  // searches a select's options.
  const editorProps = (ctx: any) => ({ value: ctx.value, typed: ctx.typed, columnDef: ctx.columnDef, columnId: ctx.columnId, row: ctx.row, onCommit: ctx.onCommit, onCancel: ctx.onCancel })
  registerCellEditor('fieldRating', { component: RatingEditor as never, props: editorProps, typeToEdit: (c) => /^[0-9]$/.test(c) })
  registerCellEditor('fieldLink', { component: LinkPickerEditor as never, props: editorProps, typeToEdit: false })
  registerCellEditor('fieldNumber', {
    component: NumberEditor as never,
    props: (ctx) => ({ ...editorProps(ctx), onCommitAndMove: ctx.onCommitAndMove, onCommitAndMoveDown: ctx.onCommitAndMoveDown }),
    typeToEdit: (c) => /[0-9.,:+\-(]/.test(c),
  })
  registerCellEditor('fieldLongText', {
    component: LongTextEditor as never,
    props: (ctx) => ({ ...editorProps(ctx), onCommitAndMove: ctx.onCommitAndMove }),
  })
  registerCellEditor('fieldSelect', {
    component: SelectEditor as never,
    props: (ctx) => ({ ...editorProps(ctx), grid: ctx.grid, onChange: ctx.onChange, onCommitAndMove: ctx.onCommitAndMove }),
  })
  registerCellEditor('attachment', {
    component: AttachmentEditor as never,
    props: (ctx) => ({
      value: ctx.value,
      columnDef: ctx.columnDef,
      columnId: ctx.columnId,
      row: ctx.row,
      onCommit: ctx.onCommit,
      onCancel: ctx.onCancel,
    }),
    typeToEdit: false,
  })
  // The view bar's filter: conditions per field type, as an advanced filter kind.
  registerFilterKind('fieldFilter', (expr, ctx) => compileFieldFilter(expr as FieldFilter, ctx.getValue, linkNames))
  // A person condition's "Me" is whoever is signed in when the filter runs.
  resolveMeWith(() => getCurrentUser()?.id)
  // The same filter as an alert rule's condition (`baseCondition`).
  registerBaseCondition()
  enableAdvancedFilter()
  registerGridShortcuts(spaceOpensRecord as never, { id: 'svgrid-fields-space' })
  // SvGrid Base is a Suite product: without a key, or with a Grid-edition key,
  // the grid shows the watermark and a notice. It never blocks.
  nudgeEnterpriseFor('base', 'SvGrid Base')
}
