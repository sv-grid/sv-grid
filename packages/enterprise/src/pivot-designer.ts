/**
 * Types + helpers for the SvPivotDesigner component.
 *
 * Why a separate module: the component file (.svelte) imports these,
 * and so do consumers wiring up custom presets, formatters, or wells.
 * Keeping the pure-TS surface here also lets us unit-test the layout
 * normalisation + serialisation without instantiating the component.
 */

import type { CellFormatConfig } from '@svgrid/grid'
import type { PivotAggregatorId } from './pivot'

/** One field the designer offers in its left-rail picker.
 *  Dimensions land in Rows by default; measures land in Values. */
export type PivotField<T extends Record<string, unknown> = Record<string, unknown>> = {
  field: keyof T & string
  /** Display name shown in the picker + on chips. */
  label: string
  /** Default well: 'dimension' -> Rows, 'measure' -> Values. */
  kind: 'dimension' | 'measure'
  /** Optional group name for the field picker (e.g. 'Demographics'). */
  group?: string
  /** Optional formatter applied to value-well chips by default. */
  format?: CellFormatConfig
  /** Optional default aggregator when added to Values (default 'sum'). */
  defaultAgg?: PivotAggregatorId
}

/** A single chip in the Values well. */
export type PivotValueChip = {
  field: string
  agg: PivotAggregatorId
  label?: string
  format?: CellFormatConfig
}

/** A single chip in the Filters well. `allowed === null` => all values pass. */
export type PivotFilterChip = {
  field: string
  /** Distinct values that pass the filter. `null` means no restriction. */
  allowed: string[] | null
}

/** The full pivot layout. The designer is a controlled component that
 *  reads + writes this single shape via `bind:layout`. */
export type PivotLayout = {
  rows: string[]
  cols: string[]
  values: PivotValueChip[]
  filters: PivotFilterChip[]
  /** Hide subtotal rows between groups. Default false. */
  hideSubtotals?: boolean
  /** Hide grand-total row + column. Default false. */
  hideGrandTotals?: boolean
}

/** A saved layout the user can pick from the toolbar's preset menu. */
export type PivotPreset = {
  name: string
  layout: PivotLayout
}

/** A built-in aggregator option. Consumers can pass a subset to
 *  `aggregators` to restrict the chip menu (e.g. 'count' only). */
export const ALL_AGGREGATORS: PivotAggregatorId[] = [
  'sum', 'avg', 'min', 'max', 'count', 'countDistinct', 'first', 'last',
]

/** Empty layout used by Reset + the initial state. */
export const EMPTY_LAYOUT: PivotLayout = {
  rows: [], cols: [], values: [], filters: [],
}

/** Build an initial layout from a field list - useful when the
 *  consumer just wants "throw the first dimension in Rows + first
 *  measure in Values" defaults. */
export function defaultLayoutFor<T extends Record<string, unknown>>(
  fields: ReadonlyArray<PivotField<T>>,
): PivotLayout {
  const dim = fields.find((f) => f.kind === 'dimension')
  const meas = fields.find((f) => f.kind === 'measure')
  return {
    rows: dim ? [dim.field] : [],
    cols: [],
    values: meas
      ? [{ field: meas.field, agg: meas.defaultAgg ?? 'sum', label: meas.label, format: meas.format }]
      : [],
    filters: [],
  }
}

/** Move / add / remove a chip across the four wells. The well names
 *  match the layout shape. */
export type Well = 'rows' | 'cols' | 'values' | 'filters'

/** Pretty label for an aggregator id. */
export const AGG_LABEL: Record<PivotAggregatorId, string> = {
  sum: 'Sum', avg: 'Average', min: 'Min', max: 'Max',
  count: 'Count', countDistinct: 'Distinct count',
  first: 'First', last: 'Last',
}
