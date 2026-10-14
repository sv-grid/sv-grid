/**
 * The right-click menu on a record in a base's grid: expand it, add a record
 * above or below it (in its group), duplicate it, copy and paste cells, and
 * delete it. A record made here is a record as "+ Add row" makes one: its
 * own id, the next autonumber, the created time, and `onRowAdd` fired, so a
 * base with a database writes it.
 */
import type { ContextMenuIcon, ContextMenuItem, ContextMenuTarget } from '@svgrid/grid'
import { openRecord } from './editor-request.svelte'
import { newRowValues, recordCopyValues } from './field-ops'
import { askDeleteRecord } from './record-delete.svelte'

type Row = Record<string, unknown>
type Def = Record<string, any>

// Glyphs on the menu's 16 x 16 grid.
const ICONS: Record<string, ContextMenuIcon> = {
  expand: { paths: [{ d: 'M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9' }] },
  above: { paths: [{ d: 'M2.5 9.5h11v4h-11zM8 2.5v5M5.5 5 8 2.5 10.5 5' }] },
  below: { paths: [{ d: 'M2.5 2.5h11v4h-11zM8 8.5v5M5.5 11 8 13.5 10.5 11' }] },
  duplicate: { paths: [{ d: 'M5.5 5.5h8v8h-8zM10.5 5.5v-3h-8v8h3M9.5 8v3M8 9.5h3' }] },
  copy: { paths: [{ d: 'M5.5 5.5h8v8h-8zM10.5 5.5v-3h-8v8h3' }] },
  paste: { paths: [{ d: 'M5.5 3h-2v10.5h9V3h-2M6 2h4v2.5H6zM6 8h4M6 10.5h4' }] },
  comment: { paths: [{ d: 'M2.5 3.5h11v7.5H8l-3 2.5V11H2.5z' }] },
  delete: { paths: [{ d: 'M2.5 4.5h11M6 4.5v-2h4v2M4 4.5l.7 9h6.6l.7-9M6.8 7v4.5M9.2 7v4.5' }] },
}

/** A list value (tags, links) is copied, not shared with the record it came from. */
const copy = (v: unknown): unknown => (Array.isArray(v) ? [...v] : v)

export function recordMenu(getApi: () => any, getCtrl: () => any): ContextMenuItem[] {
  const ctrl = () => getCtrl()
  const editable = () => !!ctrl()?.editingEnabled
  const noRecord = (t: ContextMenuTarget) => !t.row
  const readOnly = (t: ContextMenuTarget) => !t.row || !editable()

  /** Add `values` as a new record next to `t`'s record; `edit` starts on its first field (an empty record, not a copy). */
  function add(t: ContextMenuTarget, values: Row, offset: 0 | 1, edit: boolean) {
    const c = ctrl()
    const api = getApi()
    if (!c || !api || !t.row) return
    const cfg = c.props.rowAdder
    const defaults = cfg && typeof cfg === 'object' && typeof cfg.defaults === 'function' ? cfg.defaults() : {}
    const row = newRowValues(c, { ...defaults, ...values })
    // The menu's row may be another object than the one the data holds: match by id too.
    const id = (t.row as Row).id
    const at = (c.internalData as Row[]).findIndex((r) => r === t.row || (id != null && r?.id === id))
    api.addRow(row, at < 0 ? 'bottom' : at + offset)
    c.props.onRowAdd?.({ row })
    // Sorting can put it anywhere: find it, show it, and start on its first field.
    queueMicrotask(() => {
      const index = (c.allRows as Array<{ original: unknown }>).findIndex((r) => r.original === row)
      if (index < 0) return
      api.scrollToRow(index)
      if (edit) for (const col of c.allColumns as Array<{ id: string }>) if (api.startEditing(index, col.id)) break
    })
  }

  /** The values that keep a new record in `t`'s groups. */
  function groupValues(t: ContextMenuTarget): Row {
    const c = ctrl()
    const out: Row = {}
    const grouped: string[] = c?.grid?.getState?.().grouping ?? []
    for (const id of grouped) {
      const def = (c.internalColumns as Def[]).find((d) => String(d.id ?? d.field) === id)
      if (def?.field && !def.fieldFn) out[def.field] = copy((t.row as Row)[def.field])
    }
    return out
  }

  function duplicate(t: ContextMenuTarget) {
    const c = ctrl()
    if (c && t.row) add(t, recordCopyValues(c, t.row as Row), 1, false)
  }

  return [
    { key: 'expand', label: 'Expand record', icon: ICONS.expand, hidden: noRecord, action: (t) => openRecord({ ctrl: ctrl(), rowId: t.rowId }) },
    { key: 'comment', label: 'Comment', icon: ICONS.comment, hidden: noRecord, action: (t) => openRecord({ ctrl: ctrl(), rowId: t.rowId, focus: 'comment' }) },
    'separator',
    { key: 'record_above', label: 'Insert record above', icon: ICONS.above, hidden: readOnly, action: (t) => add(t, groupValues(t), 0, true) },
    { key: 'record_below', label: 'Insert record below', icon: ICONS.below, hidden: readOnly, action: (t) => add(t, groupValues(t), 1, true) },
    { key: 'duplicate', label: 'Duplicate record', icon: ICONS.duplicate, hidden: readOnly, action: duplicate },
    'separator',
    { key: 'copy', icon: ICONS.copy },
    { key: 'paste', icon: ICONS.paste, hidden: () => !editable() },
    'separator',
    { key: 'delete_record', label: 'Delete record', icon: ICONS.delete, hidden: readOnly, action: (t) => askDeleteRecord({ ctrl: ctrl(), api: getApi(), row: t.row }) },
  ]
}
