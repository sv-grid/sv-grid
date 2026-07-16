/**
 * Row-resize Svelte action - drag the bottom edge of a row to grow /
 * shrink it. Pair with a function-valued `rowHeight` prop so the grid
 * reads per-row heights from a reactive store.
 *
 * The action is OFF until a consumer attaches it AND a row-header
 * gutter cell exists in each row. A row-header cell is either the
 * grid's built-in row-number gutter (enable `showRowNumbers`) or any
 * TD tagged with the `sv-row-gutter` class (set
 * `cellClass: 'sv-row-gutter'` on a custom gutter column).
 *
 *   <script>
 *     let heights = $state<Record<number, number>>({})
 *     let resizeOn = $state(false)
 *     const rowHeight = (i: number) => heights[i] ?? 32
 *     function onResize(i: number, h: number) { heights = { ...heights, [i]: h } }
 *   </script>
 *
 *   <div use:rowResize={{ onResize, disabled: !resizeOn }}>
 *     <SvGrid columns={[{ field:'rn', cellClass:'sv-row-gutter', ... }, ...]}
 *             rowHeight={rowHeight} ... />
 *   </div>
 *
 * Visual: the strip sits along the bottom edge of the row-header
 * cell, 5px tall, transparent by default, accent-tinted on hover -
 * matching the column resize handle's look. Cursor is `row-resize`.
 */

const STRIP_CLASS = 'sv-grid-row-resize-handle'

export type RowResizeOptions = {
  /** Called when the user releases the drag with the final height. */
  onResize: (rowIndex: number, height: number) => void
  /** Optional callback fired during the drag (every pointermove). */
  onResizeMove?: (rowIndex: number, height: number) => void
  /** Min row height in px. Default 20. */
  min?: number
  /** Max row height in px. Default 320. */
  max?: number
  /** When true, the action removes its strips and ignores events. */
  disabled?: boolean
}

type ActiveDrag = {
  rowIndex: number
  startY: number
  startHeight: number
  trEl: HTMLTableRowElement
  strip: HTMLElement
}

export function rowResize(node: HTMLElement, opts: RowResizeOptions) {
  let current = opts
  let drag: ActiveDrag | null = null

  function rowIndexOf(tr: HTMLTableRowElement): number {
    const dataRow = tr.querySelector<HTMLElement>('[data-svgrid-row]')
    const val = dataRow?.dataset.svgridRow
    return val != null ? Number(val) : NaN
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag) return
    const min = current.min ?? 20
    const max = current.max ?? 320
    const next = Math.max(min, Math.min(max, drag.startHeight + (e.clientY - drag.startY)))
    drag.trEl.style.height = `${Math.round(next)}px`
    current.onResizeMove?.(drag.rowIndex, Math.round(next))
  }
  function onPointerUp(e: PointerEvent) {
    if (!drag) return
    const min = current.min ?? 20
    const max = current.max ?? 320
    const next = Math.max(min, Math.min(max, drag.startHeight + (e.clientY - drag.startY)))
    current.onResize(drag.rowIndex, Math.round(next))
    drag.strip.classList.remove('is-resizing')
    try { drag.trEl.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
    drag = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    document.body.style.cursor = ''
  }

  function onPointerDown(e: PointerEvent) {
    if (current.disabled) return
    const t = e.target as HTMLElement | null
    if (!t?.classList.contains(STRIP_CLASS)) return
    const tr = t.closest<HTMLTableRowElement>('tr.sv-grid-row')
    if (!tr) return
    const rowIndex = rowIndexOf(tr)
    if (!Number.isFinite(rowIndex)) return
    e.preventDefault()
    e.stopPropagation()
    t.classList.add('is-resizing')
    drag = {
      rowIndex,
      startY: e.clientY,
      startHeight: tr.getBoundingClientRect().height,
      trEl: tr,
      strip: t,
    }
    try { tr.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    document.body.style.cursor = 'row-resize'
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  /** Inject one strip into every row's gutter cell. When disabled or
   *  when a row lacks a `.sv-row-gutter` cell, no strip is added. */
  function decorate() {
    if (current.disabled) {
      removeAllStrips()
      return
    }
    const rows = node.querySelectorAll<HTMLTableRowElement>('tr.sv-grid-row')
    for (const tr of rows) {
      if (tr.classList.contains('sv-grid-header-row')) continue
      if (tr.classList.contains('sv-grid-row-spacer')) continue
      // A row-header gutter cell: either a user column tagged
      // `sv-row-gutter`, or the grid's built-in row-number gutter
      // (`showRowNumbers`), whose cell is `.sv-grid-row-number-cell`.
      const gutter = tr.querySelector<HTMLTableCellElement>(
        '.sv-grid-cell.sv-row-gutter, .sv-grid-cell.sv-grid-row-number-cell',
      )
      if (!gutter) continue
      if (gutter.querySelector(`:scope > .${STRIP_CLASS}`)) continue
      // Anchor the strip to the gutter cell + allow it to overflow
      // downward into the row gap so the hit-area straddles the
      // row boundary the way Excel does.
      if (getComputedStyle(gutter).position === 'static') gutter.style.position = 'relative'
      gutter.style.overflow = 'visible'
      const strip = document.createElement('div')
      strip.className = STRIP_CLASS
      strip.setAttribute('role', 'separator')
      strip.setAttribute('aria-orientation', 'horizontal')
      strip.setAttribute('aria-label', 'Resize row')
      // Inline the geometry + pointer-events so the strip works even
      // before SvGrid.css is parsed; the hover tint still comes from
      // the stylesheet. We keep the strip fully inside the gutter
      // cell (no negative offset) to avoid stacking-context surprises
      // with pinned / virtualised neighbour cells.
      // 5px tall + sitting flush with the row bottom matches the
      // column resize handle's 5px width.
      strip.style.cssText =
        'position:absolute;left:0;right:0;bottom:0;height:5px;' +
        'cursor:row-resize;user-select:none;z-index:60;pointer-events:auto;'
      gutter.appendChild(strip)
    }
  }
  function removeAllStrips() {
    node.querySelectorAll(`.${STRIP_CLASS}`).forEach((el) => el.remove())
  }

  node.addEventListener('pointerdown', onPointerDown, { capture: true })
  const observer = new MutationObserver(() => decorate())
  observer.observe(node, { childList: true, subtree: true })
  decorate()

  return {
    update(next: RowResizeOptions) {
      const wasDisabled = current.disabled
      current = next
      // Toggle: when going from enabled <-> disabled, repaint immediately.
      if (wasDisabled !== current.disabled) decorate()
    },
    destroy() {
      node.removeEventListener('pointerdown', onPointerDown, { capture: true })
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      observer.disconnect()
      removeAllStrips()
    },
  }
}
