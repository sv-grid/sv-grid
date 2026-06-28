/**
 * Spreadsheet-style layout helpers — cell merging + per-cell borders.
 *
 * These are *layout-only* augmentations on top of `<SvGrid>`. They don't
 * change the grid's data model, sorting, or filtering — they just decorate
 * the rendered body cells. Bind the action to the wrapper around your
 * SvGrid and pass merge / border specs; the helper observes DOM mutations
 * and re-applies the layout whenever the grid re-renders.
 *
 * Limitations (worth knowing up front):
 *   - Merges + borders index into the CURRENTLY-DISPLAYED rows (after
 *     sort / filter), via the `data-svgrid-row` index the grid sets on
 *     every body cell. If your data sorts or filters, recompute the
 *     specs against the new display order.
 *   - Merges use real `colspan` / `rowspan` plus `display:none` on
 *     covered TDs. Column widths come from the inline styles SvGrid
 *     emits on each TD; we don't fight those.
 *   - For long row-merges across a virtualised window, only rows that
 *     are actually rendered get the rowspan applied. Disable
 *     virtualisation on grids that need a continuous merge.
 */

/** A single edge of a cell border. */
export type BorderSpec = {
  /** Thickness in pixels. Default 2. */
  width?: number
  /** CSS border-style. Default 'solid'. */
  style?: 'solid' | 'dashed' | 'dotted' | 'double'
  /** CSS color. Falls back to currentColor (i.e. text color). */
  color?: string
}

/** A merge declaration. The cell at (rowIndex, columnId) is the ORIGIN;
 *  it spans `colspan` columns to the right + `rowspan` rows downward.
 *  Covered cells are hidden so the origin visually fills the region. */
export type MergeSpec = {
  /** Display-row index — the same value the grid puts on
   *  `data-svgrid-row`. After sorting/filtering, recompute the spec
   *  against the new display order. */
  rowIndex: number
  columnId: string
  /** Default 1. */
  rowspan?: number
  /** Default 1. */
  colspan?: number
}

/** Borders for one cell. Edges left unset render as the default
 *  cell border (i.e. no override). */
export type CellBorderSpec = {
  rowIndex: number
  columnId: string
  top?: BorderSpec
  right?: BorderSpec
  bottom?: BorderSpec
  left?: BorderSpec
}

/** What the Svelte action receives. Pass new values to update; pass
 *  `null` / empty arrays to clear. */
export type SpreadsheetActionOptions = {
  merges?: ReadonlyArray<MergeSpec> | null
  borders?: ReadonlyArray<CellBorderSpec> | null
  /** Column id order the grid uses, in left-to-right order. Required
   *  to translate `colspan` into the right set of covered column ids.
   *  Pass `columns.map((c) => c.id)` from the consumer. */
  columnOrder: ReadonlyArray<string>
}

const BORDER_KEYS = ['top', 'right', 'bottom', 'left'] as const
type EdgeKey = (typeof BORDER_KEYS)[number]
const MARK = 'data-svgrid-sheet'

function borderCss(spec: BorderSpec | undefined): string | null {
  if (!spec) return null
  const w = spec.width ?? 2
  const s = spec.style ?? 'solid'
  const c = spec.color ?? 'currentColor'
  return `${w}px ${s} ${c}`
}

/** Look up a body cell by its display-row + column id. Falls back to
 *  null if the cell isn't in the current render window (virtualisation,
 *  scrolled out, or filtered away). */
function findCell(
  root: HTMLElement,
  rowIndex: number,
  columnId: string,
): HTMLTableCellElement | null {
  return root.querySelector<HTMLTableCellElement>(
    `td[data-svgrid-row="${rowIndex}"][data-col-id="${CSS.escape(columnId)}"]`,
  )
}

const OVERLAY_CLASS = 'sv-cell-border-overlay'

/** Apply / re-apply layout decorations. Called once on mount, again on
 *  every relevant DOM mutation inside the grid, and whenever the action
 *  options update. */
function apply(root: HTMLElement, opts: SpreadsheetActionOptions): void {
  // ---- 1. Clean up anything the LAST run added -----------------------
  for (const td of root.querySelectorAll<HTMLTableCellElement>(`td[${MARK}]`)) {
    td.removeAttribute('colspan')
    td.removeAttribute('rowspan')
    if (td.style.display === 'none') td.style.display = ''
    // Remove the overlay child we previously injected for borders.
    const overlay = td.querySelector(`:scope > .${OVERLAY_CLASS}`)
    if (overlay) overlay.remove()
    td.classList.remove('sv-merge-edge-right', 'sv-merge-edge-bottom', 'sv-merge-in-range')
    td.removeAttribute(MARK)
  }

  const colOrder = opts.columnOrder
  const colIndexOf = new Map<string, number>()
  for (let i = 0; i < colOrder.length; i += 1) colIndexOf.set(colOrder[i]!, i)

  // ---- 2. Merges -----------------------------------------------------
  for (const m of opts.merges ?? []) {
    const startCol = colIndexOf.get(m.columnId)
    if (startCol === undefined) continue
    const rs = Math.max(1, m.rowspan ?? 1)
    const cs = Math.max(1, m.colspan ?? 1)
    const origin = findCell(root, m.rowIndex, m.columnId)
    if (!origin) continue
    if (cs > 1) origin.setAttribute('colspan', String(cs))
    if (rs > 1) origin.setAttribute('rowspan', String(rs))
    origin.setAttribute(MARK, '')
    for (let dr = 0; dr < rs; dr += 1) {
      for (let dc = 0; dc < cs; dc += 1) {
        if (dr === 0 && dc === 0) continue
        const colId = colOrder[startCol + dc]
        if (!colId) continue
        const td = findCell(root, m.rowIndex + dr, colId)
        if (!td) continue
        td.style.display = 'none'
        td.setAttribute(MARK, '')
      }
    }

    // Selection-edge inheritance:
    // The grid sets `data-range-*` per cell. The merge's RIGHTMOST /
    // BOTTOMMOST covered cells are `display:none`, so the borders
    // they would draw never render. Mirror those edge flags onto the
    // origin via dedicated CSS classes (so we can toggle them
    // independently of Svelte's own data-range-* updates without a
    // ping-pong loop).
    const lastColId  = colOrder[startCol + cs - 1]
    const rightCell  = lastColId ? findCell(root, m.rowIndex, lastColId) : null
    const bottomCell = findCell(root, m.rowIndex + rs - 1, m.columnId)
    const farCell    = lastColId ? findCell(root, m.rowIndex + rs - 1, lastColId) : null

    const wantRight  =
      rightCell?.getAttribute('data-range-right') === 'true' ||
      farCell  ?.getAttribute('data-range-right') === 'true'
    const wantBottom =
      bottomCell?.getAttribute('data-range-bottom') === 'true' ||
      farCell   ?.getAttribute('data-range-bottom') === 'true'
    const inRange =
      rightCell ?.getAttribute('data-selected-range') === 'true' ||
      bottomCell?.getAttribute('data-selected-range') === 'true' ||
      farCell   ?.getAttribute('data-selected-range') === 'true' ||
      origin.getAttribute('data-selected-range')      === 'true'

    origin.classList.toggle('sv-merge-edge-right',   wantRight)
    origin.classList.toggle('sv-merge-edge-bottom',  wantBottom)
    origin.classList.toggle('sv-merge-in-range',     inRange)
  }

  // ---- 3. Borders ---------------------------------------------------
  // Use an absolute-positioned overlay div so each edge renders
  // independently of the grid's own border-collapse rules. Adjacent
  // TDs no longer "eat" the right / bottom edges of a bordered cell.
  for (const b of opts.borders ?? []) {
    const td = findCell(root, b.rowIndex, b.columnId)
    if (!td) continue
    let any = false
    const overlay = document.createElement('div')
    overlay.className = OVERLAY_CLASS
    overlay.style.cssText =
      'position:absolute;inset:0;pointer-events:none;box-sizing:border-box;z-index:1;'
    for (const e of BORDER_KEYS) {
      const css = borderCss(b[e as EdgeKey])
      if (!css) continue
      overlay.style.setProperty(`border-${e}`, css)
      any = true
    }
    if (!any) continue
    // Ensure the TD is a positioning context for the overlay.
    if (getComputedStyle(td).position === 'static') td.style.position = 'relative'
    td.appendChild(overlay)
    td.setAttribute(MARK, '')
  }
}

/** Svelte action. Attach to the element that hosts your `<SvGrid>` so
 *  the action can watch its DOM for re-renders.
 *
 * ```svelte
 * <div use:spreadsheetLayout={{ merges, borders, columnOrder }}>
 *   <SvGrid {data} {columns} ... />
 * </div>
 * ```
 *
 * The action re-applies the layout whenever the grid's body mutates
 * (new rows, column reorder, virtualization scroll) and whenever the
 * options change. */
export function spreadsheetLayout(node: HTMLElement, opts: SpreadsheetActionOptions) {
  let current = opts
  let frame = 0
  // The MutationObserver fires for EVERY DOM change inside the grid -
  // batch them into one rAF so a big virtualization scroll doesn't run
  // apply() dozens of times in a tick.
  function schedule() {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      apply(node, current)
    })
  }
  const observer = new MutationObserver(schedule)
  observer.observe(node, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'data-svgrid-row', 'data-col-id', 'style',
      // Watch selection-range attrs so we can transfer them from
      // hidden covered cells to merge origins.
      'data-range-top', 'data-range-bottom', 'data-range-left',
      'data-range-right', 'data-selected-range',
    ],
  })
  // First-paint pass: schedule the same way so we don't run before the
  // grid's initial render landed.
  schedule()
  return {
    update(next: SpreadsheetActionOptions) {
      current = next
      schedule()
    },
    destroy() {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    },
  }
}
