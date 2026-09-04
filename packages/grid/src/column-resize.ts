/**
 * Column-resize Svelte action - drag a header's right edge to widen / narrow
 * the column. Counterpart of `rowResize`, and built the same way for the same
 * reason: `<SvGrid columnResize>` is opt-in, so the code behind it must not sit
 * in the base bundle of every grid that leaves it off. The grid pulls this
 * module through `import()` the first time a consumer turns the prop on.
 *
 * Handles are injected rather than rendered, so nothing about them compiles
 * into `SvGrid.svelte`. A header cell is keyed by `data-svgrid-header-col` -
 * body cells use `data-col-id`, which is a different attribute on purpose, and
 * matching the wrong one finds nothing. One handle goes into every such `th`
 * under `node`, and a MutationObserver keeps up with virtualized columns
 * scrolling in and out.
 *
 *   <div use:columnResize={{ getWidth, onResize }}>
 *     <SvGrid ... />
 *   </div>
 *
 * Visual: a 5px strip on the header's right edge with an accent centre pill,
 * from SvGrid.css. Cursor is `col-resize`.
 */

const HANDLE_CLASS = 'sv-grid-resize-handle'

export type ColumnResizeOptions = {
  /** Current width of a column, in px. Read when a drag starts. */
  getWidth: (columnId: string) => number
  /** Called on every animation frame of the drag, and once at the end. */
  onResize: (columnId: string, width: number) => void
  /** Accessible name for the handle. Defaults to the column id. */
  label?: (columnId: string) => string
  /**
   * Per-column opt-out, backing `ColumnDef.resizable`. Returning false means no
   * handle is created for that column at all - which is what makes the drag,
   * the arrow keys and the double-click autosize go away together, rather than
   * each needing its own guard.
   */
  canResize?: (columnId: string) => boolean
  /** Size the column to its content. Bound to a double-click on the handle. */
  onAutosize?: (columnId: string) => void
  /** Minimum width in px. Default 40. */
  min?: number
  /** When true, the action removes its handles and ignores events. */
  disabled?: boolean
}

type ActiveDrag = {
  columnId: string
  startX: number
  startWidth: number
  handle: HTMLElement
}

export function columnResize(node: HTMLElement, opts: ColumnResizeOptions) {
  let current = opts
  let drag: ActiveDrag | null = null
  // Coalesce onto the animation frame: pointermove fires many times per frame
  // and each width write triggers a full recompute of the column-layout
  // pipeline. Without this the grid stutters for the whole drag.
  let raf: number | null = null
  let pendingWidth = 0

  const minWidth = () => current.min ?? 40

  function columnIdOf(el: HTMLElement): string | null {
    return el.closest<HTMLElement>('[data-svgrid-header-col]')?.dataset.svgridHeaderCol ?? null
  }

  function commit() {
    if (!drag) return
    current.onResize(drag.columnId, pendingWidth)
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag) return
    pendingWidth = Math.max(minWidth(), drag.startWidth + (e.clientX - drag.startX))
    if (raf !== null) return
    raf = requestAnimationFrame(() => {
      raf = null
      commit()
    })
  }

  function onPointerUp(e: PointerEvent) {
    if (!drag) return
    if (raf !== null) {
      cancelAnimationFrame(raf)
      raf = null
    }
    // Commit the final width even if the last frame was cancelled mid-flight.
    pendingWidth = Math.max(minWidth(), drag.startWidth + (e.clientX - drag.startX))
    commit()
    drag.handle.classList.remove('is-resizing')
    syncAria(drag.handle, drag.columnId)
    try {
      drag.handle.releasePointerCapture(e.pointerId)
    } catch {
      /* release is best-effort */
    }
    drag = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    document.body.style.cursor = ''
  }

  function onPointerDown(e: PointerEvent) {
    if (current.disabled) return
    const t = e.target as HTMLElement | null
    if (!t?.classList.contains(HANDLE_CLASS)) return
    const columnId = columnIdOf(t)
    if (!columnId || current.canResize?.(columnId) === false) return
    e.preventDefault()
    e.stopPropagation()
    t.classList.add('is-resizing')
    pendingWidth = current.getWidth(columnId)
    drag = { columnId, startX: e.clientX, startWidth: pendingWidth, handle: t }
    try {
      t.setPointerCapture(e.pointerId)
    } catch {
      /* capture is best-effort */
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }

  /**
   * Keyboard resize (#79). The handle is a focusable `role="separator"` acting
   * as a splitter, so it has to answer the arrow keys. Left/Right shrink/grow,
   * Shift gives a 1px step - the same contract `rowResize` uses vertically.
   */
  function onKeyDown(e: KeyboardEvent) {
    if (current.disabled) return
    const t = e.target as HTMLElement | null
    if (!t?.classList.contains(HANDLE_CLASS)) return
    const step = e.shiftKey ? 1 : 10
    let delta = 0
    if (e.key === 'ArrowLeft') delta = -step
    else if (e.key === 'ArrowRight') delta = step
    else return
    const columnId = columnIdOf(t)
    if (!columnId || current.canResize?.(columnId) === false) return
    e.preventDefault()
    e.stopPropagation()
    const next = Math.max(minWidth(), Math.round(current.getWidth(columnId) + delta))
    current.onResize(columnId, next)
    syncAria(t, columnId)
  }

  /** A focusable separator is a widget, so ARIA wants a current value. */
  function syncAria(handle: HTMLElement, columnId: string) {
    const w = Math.round(current.getWidth(columnId))
    handle.setAttribute('aria-valuenow', String(w))
    handle.setAttribute('aria-valuemin', String(minWidth()))
    handle.setAttribute('aria-valuetext', `${w} pixels`)
  }

  /** One handle per header cell. Skips group headers and spacer columns,
   *  which have no id to resize. */
  function decorate() {
    if (current.disabled) {
      removeAll()
      return
    }
    const heads = node.querySelectorAll<HTMLElement>('th.sv-grid-column[data-svgrid-header-col]')
    for (const th of heads) {
      if (th.classList.contains('sv-grid-column-spacer')) continue
      const columnId = th.dataset.svgridHeaderCol
      if (!columnId) continue
      if (current.canResize?.(columnId) === false) {
        // The column may have been resizable a moment ago - a re-decorate has
        // to take the handle away, not just stop adding one.
        th.querySelector(`:scope > .${HANDLE_CLASS}`)?.remove()
        continue
      }
      if (th.querySelector(`:scope > .${HANDLE_CLASS}`)) continue
      const handle = document.createElement('div')
      handle.className = HANDLE_CLASS
      handle.setAttribute('role', 'separator')
      handle.setAttribute('aria-orientation', 'vertical')
      handle.setAttribute('aria-label', `Resize ${current.label?.(columnId) ?? columnId}`)
      handle.tabIndex = 0
      syncAria(handle, columnId)
      // Double-click the handle to size the column to its content - the
      // spreadsheet gesture. Stop it there so it does not also reach the
      // header, where a double-click would toggle the sort twice.
      handle.addEventListener('dblclick', (ev) => {
        ev.stopPropagation()
        ev.preventDefault()
        if (current.disabled) return
        current.onAutosize?.(columnId)
        syncAria(handle, columnId)
      })
      th.appendChild(handle)
    }
  }

  function removeAll() {
    node.querySelectorAll(`.${HANDLE_CLASS}`).forEach((el) => el.remove())
  }

  node.addEventListener('pointerdown', onPointerDown, { capture: true })
  node.addEventListener('keydown', onKeyDown, { capture: true })
  const observer = new MutationObserver(() => decorate())
  observer.observe(node, { childList: true, subtree: true })
  decorate()

  return {
    update(next: ColumnResizeOptions) {
      const wasDisabled = current.disabled
      current = next
      if (wasDisabled !== current.disabled) decorate()
    },
    destroy() {
      node.removeEventListener('pointerdown', onPointerDown, { capture: true })
      node.removeEventListener('keydown', onKeyDown, { capture: true })
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      if (raf !== null) cancelAnimationFrame(raf)
      observer.disconnect()
      removeAll()
    },
  }
}
