import { hasCellEditor } from '../editor-registry'

export type CellEditorType =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'time'
  // Opt-out of the rich date/time pickers: render the plain native inputs.
  | 'date-native'
  | 'datetime-native'
  | 'time-native'
  | 'password'
  | 'checkbox'
  | 'list'
  | 'chips'
  | 'select'
  | 'rich-select'
  | 'autocomplete'
  | 'textarea'
  | 'color'
  | 'rating'
  // Any other string names a CUSTOM editor registered via `registerCellEditor`.
  // `(string & {})` keeps the literals above autocompleting while allowing
  // arbitrary custom type names.
  | (string & {})

/** Normalized option used by list/chips editors. The optional `color`
 *  paints the chip - both in the in-cell readonly chips render and in
 *  the dropdown trigger when `renderChipsInTrigger` is on. Any CSS
 *  color works (hex, rgb, hsl, oklch, named); the chip uses a soft
 *  tint built via `color-mix` so it sits well on both themes. */
export type CellEditorOption = { value: string | number; label: string; color?: string }

export type ParseEditorValueOptions = {
  /** When true, list/chips return an array; otherwise a scalar. */
  multiple?: boolean
  /**
   * Keep a date as the plain `YYYY-MM-DD` string the user picked, instead of a
   * full ISO timestamp. Set for `cellDataType: 'dateString'` columns, which
   * exist precisely to hold ISO date strings.
   *
   * It is not only about shape. `new Date('2026-12-25').toISOString()` sends
   * the value through UTC, so a local midnight becomes the previous or next
   * day either side of the meridian - the stored DATE changes depending on
   * where the user is sitting. Slicing the picked date avoids that entirely.
   */
  dateOnly?: boolean
}

/** Normalize the loose `editorOptions` ColumnDef prop into a uniform shape.
 *  Dynamic (function) editorOptions are resolved before reaching here. */
export function normalizeEditorOptions(
  options:
    | ReadonlyArray<
        string | number | { value: string | number; label?: string; color?: string }
      >
    | undefined,
): CellEditorOption[] {
  if (!options || typeof options === 'function') return []
  return options.map((opt) => {
    if (typeof opt === 'string' || typeof opt === 'number') {
      return { value: opt, label: String(opt) }
    }
    return {
      value: opt.value,
      label: opt.label ?? String(opt.value),
      color: opt.color,
    }
  })
}

export function parseEditorValue(
  rawType: CellEditorType,
  value: unknown,
  opts?: ParseEditorValueOptions,
) {
  // `date-native` etc. parse identically to their rich counterparts.
  const type = rawType.replace(/-native$/, '') as CellEditorType
  if (type === 'number') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (type === 'rating') {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return 0
    return Math.max(0, Math.min(5, Math.round(parsed)))
  }
  if (type === 'color') {
    const s = String(value ?? '').trim()
    // Native <input type="color"> always returns "#rrggbb"; if anything
    // else comes in (CSS name, rgb()), pass it through unchanged so the
    // caller can keep whatever color string they had.
    return s || '#000000'
  }
  if (type === 'date') {
    const raw = String(value ?? '')
    if (opts?.dateOnly) {
      // Take the calendar date the editor produced as-is. It already arrives
      // as `YYYY-MM-DD` (or that prefix on a datetime), so there is nothing to
      // convert - and converting is exactly what shifts the day across a
      // timezone boundary.
      const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim())
      if (match) return match[1]
      const parsed = new Date(raw)
      if (Number.isNaN(parsed.getTime())) return null
      // A non-ISO input (a locale string) still has to become a date string.
      // Use the LOCAL parts, so the day is the one the user saw.
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`
    }
    const date = new Date(raw)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  if (type === 'datetime') {
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  if (type === 'time') {
    // Native `<input type="time">` returns "HH:MM" (or "HH:MM:SS"). Accept
    // anything that parses to that shape; reject malformed strings as
    // `null` so consumers can distinguish "cleared" from "never set".
    const s = String(value ?? '').trim()
    if (!s) return null
    const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
    if (!m) return null
    const h  = Math.max(0, Math.min(23, parseInt(m[1]!, 10)))
    const mm = Math.max(0, Math.min(59, parseInt(m[2]!, 10)))
    const ss = m[3] ? Math.max(0, Math.min(59, parseInt(m[3]!, 10))) : null
    const HH = String(h).padStart(2, '0')
    const MM = String(mm).padStart(2, '0')
    return ss === null ? `${HH}:${MM}` : `${HH}:${MM}:${String(ss).padStart(2, '0')}`
  }
  if (type === 'password') {
    // Password is just a string with masked rendering. Empty string is a
    // legitimate value (user cleared the field); keep it instead of nulling.
    return String(value ?? '')
  }
  if (type === 'checkbox') {
    if (typeof value === 'boolean') return value
    return String(value).toLowerCase() === 'true'
  }
  if (type === 'select' || type === 'rich-select') {
    // Single-select: trust the editor's reported value; coerce nullish
    // to `null` so consumers can disambiguate "user cleared" from "user
    // never picked".
    if (Array.isArray(value)) return value[0] ?? null
    return value ?? null
  }
  if (type === 'textarea') {
    return String(value ?? '')
  }
  // Custom registered editors own their value shape (like list/chips), so pass
  // whatever the editor committed through unchanged instead of stringifying it.
  if (hasCellEditor(type)) return value
  if (type === 'list' || type === 'chips') {
    // The editor manages the value shape: a scalar for single-select, an
    // array for multi-select. Trust what the editor handed us, just coerce
    // the shape so consumers can rely on the contract.
    if (opts?.multiple) {
      if (Array.isArray(value)) return value.slice()
      if (value == null || value === '') return []
      return [value]
    }
    if (Array.isArray(value)) return value[0] ?? null
    return value ?? null
  }
  return String(value ?? '')
}
