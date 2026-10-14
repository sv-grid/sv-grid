/**
 * The `rowColor` prop: a color per row from a select field's option colors,
 * or from the first matching rule. The grid asks for rendered rows only
 * (registerGridExtension's rowMarkColor / rowMarkLabel), so this never walks
 * the data. Where the color is painted is CSS keyed on the root class.
 */

import { chosenRowColor } from './row-color-choice.svelte'
import { recordHeightOf } from './row-height'

type Rule = { when: (row: unknown) => boolean; color: string; label?: string }
type Config = { field?: string; rules?: ReadonlyArray<Rule>; target?: 'header' | 'bar' | 'row' }
type Ctrl = { props: { rowColor?: Config | null }; allColumns?: ReadonlyArray<{ columnDef: Record<string, unknown> }> }

// value -> color for each field, per column set (a new columns array rebuilds it).
const optionColors = new WeakMap<object, Map<string, Map<string, string>>>()

function colorsFor(ctrl: Ctrl, field: string): Map<string, string> {
  const cols = ctrl.allColumns ?? []
  let byField = optionColors.get(cols)
  if (!byField) {
    byField = new Map()
    optionColors.set(cols, byField)
  }
  let map = byField.get(field)
  if (!map) {
    map = new Map()
    const def = cols.find((c) => c.columnDef.field === field)?.columnDef
    const fromProps = (def?.fieldProps as { options?: unknown } | undefined)?.options
    const options = Array.isArray(fromProps) ? fromProps : Array.isArray(def?.editorOptions) ? (def!.editorOptions as unknown[]) : []
    for (const o of options as Array<{ value?: unknown; color?: string } | string>) {
      if (o && typeof o === 'object' && o.color) map.set(String(o.value), o.color)
    }
    byField.set(field, map)
  }
  return map
}

function fieldValue(row: unknown, field: string): unknown {
  const v = (row as Record<string, unknown> | null)?.[field]
  // A multiple select colors the row by its first value.
  return Array.isArray(v) ? v[0] : v
}

function matchRule(config: Config, row: unknown): Rule | undefined {
  return config.rules?.find((r) => {
    try {
      return r.when(row)
    } catch {
      return false
    }
  })
}

/** The colors in force: one picked from the column menu, else the `rowColor` prop. */
export function rowColorOf(ctrl: Ctrl): Config | null | undefined {
  const chosen = chosenRowColor(ctrl)
  return chosen !== undefined ? (chosen as Config | null) : ctrl.props.rowColor
}

export function rowMarkColor(ctrl: Ctrl, row: unknown): string | null {
  const config = rowColorOf(ctrl)
  if (!config || row == null) return null
  if (config.field) {
    const v = fieldValue(row, config.field)
    return v == null ? null : (colorsFor(ctrl, config.field).get(String(v)) ?? null)
  }
  return matchRule(config, row)?.color ?? null
}

export function rowMarkLabel(ctrl: Ctrl, row: unknown): string | null {
  const config = rowColorOf(ctrl)
  if (!config || row == null) return null
  if (config.field) {
    const v = fieldValue(row, config.field)
    return v == null || v === '' ? null : String(v)
  }
  return matchRule(config, row)?.label ?? null
}

export function rowColorRootClass(ctrl: Ctrl): string | null {
  const config = rowColorOf(ctrl)
  if (!config) return null
  const target = config.target === 'bar' || config.target === 'row' ? config.target : 'header'
  return `sv-fields-rowcolor sv-fields-rowcolor-${target}`
}

/**
 * Taller rows show more, as a table database does: from a 48px row height
 * the root class names how many lines of text fit (2 to 6), and the fields
 * styles wrap text and select pills to that and grow attachment thumbnails.
 */
export function tallRowClass(ctrl: Ctrl): string | null {
  const h = recordHeightOf((ctrl.props as { rowHeight?: unknown }).rowHeight) || 0
  if (h < 48) return null
  const lines = Math.max(2, Math.min(6, Math.floor((h - 12) / 20)))
  return `sv-fields-tall sv-fields-lines-${lines}`
}
