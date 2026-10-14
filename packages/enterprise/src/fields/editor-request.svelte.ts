/**
 * Which grid's field editor is open, and for what. The column-menu actions
 * (run outside any component) set it; FieldsHeaderEnd, mounted in each grid's
 * header row, shows the editor when the request names its own grid.
 */
import { gridOf } from './grid-access'

export type FieldEditorRequest = {
  ctrl: unknown
  mode: 'add' | 'edit'
  /** The field being edited (mode 'edit'). */
  columnId?: string
  /** Where a new field goes (mode 'add'). */
  index?: number | 'end'
}

let request = $state.raw<FieldEditorRequest | null>(null)

export const getFieldEditorRequest = () => request
export function openFieldEditor(r: FieldEditorRequest): void {
  request = r
}
export function closeFieldEditor(): void {
  request = null
}

/**
 * Which grid's record view is open, and on which row. The row header's expand
 * button sets it; FieldsHeaderEnd shows the view when it names its own grid.
 */
/**
 * `editPrimary`: a record just made, so its name is the first thing to type.
 * `focus: 'comment'`: the record opens with its comment box focused.
 */
export type RecordRequest = { ctrl: unknown; rowId: string; editPrimary?: boolean; focus?: 'comment' }

/**
 * What `openRecord` takes: the grid as `ctrl`, or as `api`, the object
 * `onApiReady` hands the app (an api passed as `ctrl` works too).
 */
export type OpenRecordRequest = { ctrl?: unknown; api?: unknown; rowId: string; editPrimary?: boolean; focus?: 'comment' }

let record = $state.raw<RecordRequest | null>(null)

/** The grid behind a controller or an api. */
const ctrlOf = (grid: unknown): unknown => gridOf(grid) ?? grid

export const getRecordRequest = () => record
export function openRecord(r: OpenRecordRequest): void {
  const { api, ...rest } = r
  record = { ...rest, ctrl: ctrlOf(r.ctrl ?? api) }
}
/** Close the open record; given a grid (controller or api), only when it is open on that grid. */
export function closeRecord(grid?: unknown): void {
  if (grid !== undefined && record && record.ctrl !== ctrlOf(grid)) return
  record = null
}

/**
 * Records of a linked table opened from a link chip, newest last (a linked
 * record can open another over it), and the chip the pointer rests on. The
 * grid the chip is in shows them (FieldsHeaderEnd).
 */
export type LinkedRecordRequest = { ctrl: unknown; table: string; rowId: string }

let linked = $state.raw<LinkedRecordRequest[]>([])
export const getLinkedRecords = () => linked
export function openLinkedRecord(r: LinkedRecordRequest): void {
  linked = [...linked, r]
  linkPreview = null
}
export function closeLinkedRecord(): void {
  linked = linked.slice(0, -1)
}
/**
 * A field to delete once the user confirms: a link with a field that links
 * back or fields that read it, or any field that formulas read.
 */
export type DeleteFieldRequest = { ctrl: unknown; columnId: string }
let deleting = $state.raw<DeleteFieldRequest | null>(null)
export const getDeleteFieldRequest = () => deleting
export function askDeleteField(r: DeleteFieldRequest | null): void {
  deleting = r
}

/** Close every linked record (one was opened where it lives). */
export function closeAllLinkedRecords(): void {
  linked = []
  linkPreview = null
}

export type LinkPreviewRequest = LinkedRecordRequest & { x: number; y: number }
let linkPreview = $state.raw<LinkPreviewRequest | null>(null)
export const getLinkPreview = () => linkPreview
export function showLinkPreview(r: LinkPreviewRequest | null): void {
  linkPreview = r
}
