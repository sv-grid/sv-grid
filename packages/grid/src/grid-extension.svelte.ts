/**
 * grid-extension registry - the seam an opt-in Enterprise module uses to add
 * whole field families to `<SvGrid>` without growing the free grid: cells
 * drawn by field type, a component after the last header cell and after the
 * last body row, and a mark on each row's header. Same shape as
 * `board-view` and `selection-bar-view`: a reactive holder the module fills
 * at load, read by the grid. Unset, each slot is one null check.
 *
 * ```ts
 * // in @svgrid/enterprise/fields, from enableFields():
 * import { registerGridExtension } from '@svgrid/grid'
 * registerGridExtension({ cell: FieldCell, headerEnd: ColumnAdder })
 * ```
 */
import type { Component } from 'svelte'

export type GridExtension = {
  /**
   * Fills in a column that sets `fieldType` (editor, alignment, width...) before
   * the grid reads it. `columns` is every leaf column, for types that refer to
   * other fields by name (a formula).
   */
  column?: (def: any, columns: ReadonlyArray<any>) => any
  /** Draws the body cell of a column that sets `fieldType` (and no `cell`). Props: `{ ctrl, row, column, value }`. */
  cell?: Component<any>
  /** Whether `cell` draws this column (its type has a cell of its own); the grid draws it otherwise. */
  hasCell?: (def: any) => boolean
  /** Rendered as the last child of the header row; it draws its own `<th>`. Props: `{ ctrl }`. */
  headerEnd?: Component<any>
  /** An icon before a column's header label (24x24 SVG path data), e.g. a field's type; null for none. */
  headerIcon?: (def: any) => string | null | undefined
  /** A note after a column's header label (a field's description): its text, shown on hover, and its icon (SVG path data). */
  headerNote?: (def: any) => { text: string; icon: string } | null | undefined
  /**
   * Draws the row-number cell's content in place of the number, for this
   * grid (null: the number). Props: `{ ctrl, row, rowIndex }`.
   */
  rowHeader?: (ctrl: any) => Component<any> | null | undefined
  /**
   * Draws a footer summary cell's content (the `summary` row) in place of
   * the computed text, for this grid (null: the text). Props:
   * `{ ctrl, column, text }`, `text` being what the grid computed.
   */
  summaryCell?: (ctrl: any) => Component<any> | null | undefined
  /**
   * Draws a group header's content after its toggle (the value, the count,
   * what else it shows), for this grid (null: the grid's label and count).
   * Props: `{ ctrl, row, column, value, count }`, `column` being the grouped one.
   */
  groupRow?: (ctrl: any) => Component<any> | null | undefined
  /** Rendered after the last body row; it draws its own `<tr>`. Props: `{ ctrl }`. */
  bodyEnd?: Component<any>
  /** Rendered in the footer under the summary row (`rowSummaries` on); it draws its own `<tr>`. Props: `{ ctrl }`. */
  footEnd?: Component<any>
  /**
   * Drawn over the table, inside the box that holds it (it does not scroll
   * with the rows), for this grid (null: nothing). Props: `{ ctrl }`.
   */
  overlay?: (ctrl: any) => Component<any> | null | undefined
  /** A color for a row's mark, set as `--sv-row-mark` on the row; null for none. */
  rowMarkColor?: (ctrl: any, row: unknown, rowIndex: number) => string | null | undefined
  /** Text for the row-number cell's `title`, so a mark is never color alone. */
  rowMarkLabel?: (ctrl: any, row: unknown, rowIndex: number) => string | null | undefined
  /**
   * Called after a cell's value was written by an edit, a checkbox toggle, a
   * paste, a fill or a clear, with the row object as it now is (e.g. to stamp
   * a "last modified" field).
   */
  cellEdited?: (ctrl: any, info: { row: unknown; columnId: string }) => void
  /** The column menu's sort labels for a column, e.g. ['1 → 9', '9 → 1'] (null: "ascending" / "descending"). */
  sortLabels?: (def: any) => readonly [string, string] | null | undefined
  /** A column the menu may not pin, unpin or move to the other edge (a table's primary field). */
  lockColumn?: (ctrl: any, columnId: string) => boolean
  /** Items added to a column's menu (the menu loads on demand, so this costs the base nothing). */
  columnMenuItems?: (ctrl: any, columnId: string) => ReadonlyArray<GridExtensionMenuItem>
  /** Extra classes for the grid root, e.g. where marks are painted. */
  rootClass?: (ctrl: any) => string | null | undefined
}

/** One column-menu item from an extension. `icon` is SVG path data (24x24, stroked). */
export type GridExtensionMenuItem = {
  key: string
  label: string
  icon?: string
  disabled?: boolean
  /** Draw a separator above this item. */
  separatorBefore?: boolean
  run: () => void
}

let extension = $state.raw<GridExtension | null>(null)

/** Register (or extend) the grid extension. Enterprise modules call this. */
export function registerGridExtension(ext: GridExtension): void {
  extension = { ...extension, ...ext }
}

/**
 * Columns as the grid should see them: every column with a `fieldType` passed
 * through the extension's `column`, header groups included. Returns the same
 * array when there is nothing to do.
 */
export function applyFieldColumns<A extends readonly unknown[]>(cols: A, leaves?: ReadonlyArray<any>): A {
  const fill = extension?.column
  if (!fill) return cols
  const all = leaves ?? leafColumns(cols)
  return cols.map((c: any) =>
    c?.columns?.length ? { ...c, columns: applyFieldColumns(c.columns, all) } : c?.fieldType ? fill(c, all) : c,
  ) as unknown as A
}

function leafColumns(cols: ReadonlyArray<any>): any[] {
  return cols.flatMap((c) => (c?.columns?.length ? leafColumns(c.columns) : [c]))
}

/** The registered extension, or null when no module has registered one. */
export function getGridExtension(): GridExtension | null {
  return extension
}
