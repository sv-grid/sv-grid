import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rowResize } from './row-resize'
import type { RowResizeOptions } from './row-resize'

const STRIP_CLASS = 'sv-grid-row-resize-handle'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a host `<table>` with `rows` body rows. Each row carries the
 *  `tr.sv-grid-row` class + a `.sv-row-gutter` cell holding a
 *  `data-svgrid-row` marker, matching what SvGrid renders. Extra classes
 *  let individual tests opt rows out (header / spacer / no-gutter). */
function buildGrid(
  specs: Array<{ rowClasses?: string[]; gutter?: boolean; rowIndex?: number }>,
): { host: HTMLElement; rows: HTMLTableRowElement[] } {
  const host = document.createElement('div')
  const table = document.createElement('table')
  const tbody = document.createElement('tbody')
  const rows: HTMLTableRowElement[] = []
  specs.forEach((spec, i) => {
    const tr = document.createElement('tr')
    tr.className = ['sv-grid-row', ...(spec.rowClasses ?? [])].join(' ')
    const cell = document.createElement('td')
    cell.className = 'sv-grid-cell'
    if (spec.gutter !== false) cell.classList.add('sv-row-gutter')
    const marker = document.createElement('span')
    marker.setAttribute('data-svgrid-row', String(spec.rowIndex ?? i))
    cell.appendChild(marker)
    tr.appendChild(cell)
    tbody.appendChild(tr)
    rows.push(tr)
  })
  table.appendChild(tbody)
  host.appendChild(table)
  document.body.appendChild(host)
  return { host, rows }
}

function gutterOf(tr: HTMLTableRowElement): HTMLTableCellElement {
  return tr.querySelector<HTMLTableCellElement>('.sv-row-gutter')!
}
function stripOf(tr: HTMLTableRowElement): HTMLElement | null {
  return tr.querySelector<HTMLElement>(`.${STRIP_CLASS}`)
}

/** Mock getBoundingClientRect so a TR reports a real height in jsdom
 *  (which otherwise returns all-zero rects). */
function mockRowHeight(tr: HTMLTableRowElement, height: number): void {
  tr.getBoundingClientRect = () =>
    ({ height, width: 100, top: 0, left: 0, right: 100, bottom: height, x: 0, y: 0, toJSON() {} }) as DOMRect
}

function pointer(type: string, init: Partial<PointerEvent> = {}): PointerEvent {
  return new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, ...init } as PointerEventInit)
}

const hosts: HTMLElement[] = []
function track(host: HTMLElement): HTMLElement {
  hosts.push(host)
  return host
}

beforeEach(() => {
  // jsdom lacks pointer-capture methods on elements; stub them so the action's
  // try/catch wrapped calls have something to invoke.
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = function () {}
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = function () {}
  }
})

afterEach(() => {
  while (hosts.length) hosts.pop()!.remove()
  document.body.innerHTML = ''
  document.body.style.cursor = ''
})

// ---------------------------------------------------------------------------
// decorate()
// ---------------------------------------------------------------------------

describe('rowResize - strip injection', () => {
  it('injects a resize strip into every gutter cell', () => {
    const { host, rows } = buildGrid([{}, {}, {}])
    track(host)
    const action = rowResize(host, { onResize: vi.fn() })
    for (const tr of rows) {
      const strip = stripOf(tr)
      expect(strip).not.toBeNull()
      expect(strip!.getAttribute('role')).toBe('separator')
      expect(strip!.getAttribute('aria-orientation')).toBe('horizontal')
      expect(strip!.getAttribute('aria-label')).toBe('Resize row')
      expect(strip!.style.cursor).toBe('row-resize')
    }
    // Gutter cells become a positioning context with visible overflow.
    expect(gutterOf(rows[0]!).style.position).toBe('relative')
    expect(gutterOf(rows[0]!).style.overflow).toBe('visible')
    action.destroy()
  })

  it('does not double-inject a strip on re-decorate', async () => {
    const { host, rows } = buildGrid([{}])
    track(host)
    const action = rowResize(host, { onResize: vi.fn() })
    expect(rows[0]!.querySelectorAll(`.${STRIP_CLASS}`).length).toBe(1)
    // Trigger the MutationObserver by appending an unrelated node.
    gutterOf(rows[0]!).appendChild(document.createElement('span'))
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    expect(rows[0]!.querySelectorAll(`.${STRIP_CLASS}`).length).toBe(1)
    action.destroy()
  })

  it('skips header rows, spacer rows, and rows without a gutter cell', () => {
    const { host, rows } = buildGrid([
      { rowClasses: ['sv-grid-header-row'] },
      { rowClasses: ['sv-grid-row-spacer'] },
      { gutter: false },
      {}, // normal row gets a strip
    ])
    track(host)
    const action = rowResize(host, { onResize: vi.fn() })
    expect(stripOf(rows[0]!)).toBeNull()
    expect(stripOf(rows[1]!)).toBeNull()
    expect(stripOf(rows[2]!)).toBeNull()
    expect(stripOf(rows[3]!)).not.toBeNull()
    action.destroy()
  })

  it('also injects a strip into the built-in row-number gutter (showRowNumbers)', () => {
    // The native gutter cell is `.sv-grid-cell.sv-grid-row-number-cell`, NOT
    // `.sv-row-gutter`; the action must recognise it so `showRowNumbers` grids
    // are row-resizable without a custom gutter column.
    const host = document.createElement('div')
    const table = document.createElement('table')
    const tbody = document.createElement('tbody')
    const tr = document.createElement('tr')
    tr.className = 'sv-grid-row'
    const gutter = document.createElement('td')
    gutter.className = 'sv-grid-cell sv-grid-row-number-cell'
    const marker = document.createElement('span')
    marker.setAttribute('data-svgrid-row', '0')
    gutter.appendChild(marker)
    tr.appendChild(gutter)
    tbody.appendChild(tr)
    table.appendChild(tbody)
    host.appendChild(table)
    document.body.appendChild(host)
    track(host)
    const action = rowResize(host, { onResize: vi.fn() })
    expect(tr.querySelector(`.${STRIP_CLASS}`)).not.toBeNull()
    action.destroy()
  })

  it('does not override an already-positioned gutter cell', () => {
    const { host, rows } = buildGrid([{}])
    track(host)
    gutterOf(rows[0]!).style.position = 'sticky'
    const action = rowResize(host, { onResize: vi.fn() })
    expect(gutterOf(rows[0]!).style.position).toBe('sticky')
    action.destroy()
  })

  it('injects no strips when created disabled', () => {
    const { host, rows } = buildGrid([{}, {}])
    track(host)
    const action = rowResize(host, { onResize: vi.fn(), disabled: true })
    expect(stripOf(rows[0]!)).toBeNull()
    expect(stripOf(rows[1]!)).toBeNull()
    action.destroy()
  })
})

// ---------------------------------------------------------------------------
// Drag lifecycle
// ---------------------------------------------------------------------------

describe('rowResize - drag', () => {
  it('reports the new height on pointerup and fires move callbacks', () => {
    const { host, rows } = buildGrid([{ rowIndex: 0 }])
    track(host)
    mockRowHeight(rows[0]!, 32)
    const onResize = vi.fn()
    const onResizeMove = vi.fn()
    const action = rowResize(host, { onResize, onResizeMove })
    const strip = stripOf(rows[0]!)!

    strip.dispatchEvent(pointer('pointerdown', { clientY: 100 }))
    expect(strip.classList.contains('is-resizing')).toBe(true)
    expect(document.body.style.cursor).toBe('row-resize')

    // Drag down 20px -> 52.
    window.dispatchEvent(pointer('pointermove', { clientY: 120 }))
    expect(onResizeMove).toHaveBeenLastCalledWith(0, 52)
    expect(rows[0]!.style.height).toBe('52px')

    window.dispatchEvent(pointer('pointerup', { clientY: 120 }))
    expect(onResize).toHaveBeenCalledWith(0, 52)
    expect(strip.classList.contains('is-resizing')).toBe(false)
    expect(document.body.style.cursor).toBe('')
    action.destroy()
  })

  it('clamps the height to the min bound', () => {
    const { host, rows } = buildGrid([{ rowIndex: 0 }])
    track(host)
    mockRowHeight(rows[0]!, 32)
    const onResize = vi.fn()
    const action = rowResize(host, { onResize, min: 24 })
    const strip = stripOf(rows[0]!)!
    strip.dispatchEvent(pointer('pointerdown', { clientY: 100 }))
    // Drag far up -> would be negative, clamps to 24.
    window.dispatchEvent(pointer('pointerup', { clientY: 0 }))
    expect(onResize).toHaveBeenCalledWith(0, 24)
    action.destroy()
  })

  it('clamps the height to the max bound', () => {
    const { host, rows } = buildGrid([{ rowIndex: 0 }])
    track(host)
    mockRowHeight(rows[0]!, 32)
    const onResize = vi.fn()
    const action = rowResize(host, { onResize, max: 50 })
    const strip = stripOf(rows[0]!)!
    strip.dispatchEvent(pointer('pointerdown', { clientY: 100 }))
    window.dispatchEvent(pointer('pointerup', { clientY: 1000 }))
    expect(onResize).toHaveBeenCalledWith(0, 50)
    action.destroy()
  })

  it('works without an onResizeMove callback (optional)', () => {
    const { host, rows } = buildGrid([{ rowIndex: 0 }])
    track(host)
    mockRowHeight(rows[0]!, 30)
    const onResize = vi.fn()
    const action = rowResize(host, { onResize })
    const strip = stripOf(rows[0]!)!
    strip.dispatchEvent(pointer('pointerdown', { clientY: 50 }))
    expect(() => window.dispatchEvent(pointer('pointermove', { clientY: 60 }))).not.toThrow()
    window.dispatchEvent(pointer('pointerup', { clientY: 60 }))
    expect(onResize).toHaveBeenCalledWith(0, 40)
    action.destroy()
  })

  it('ignores pointermove / pointerup when no drag is active', () => {
    const { host, rows } = buildGrid([{ rowIndex: 0 }])
    track(host)
    const onResize = vi.fn()
    const onResizeMove = vi.fn()
    const action = rowResize(host, { onResize, onResizeMove })
    // No pointerdown first - listeners were only attached on down, so these
    // shouldn't do anything even if dispatched.
    window.dispatchEvent(pointer('pointermove', { clientY: 10 }))
    window.dispatchEvent(pointer('pointerup', { clientY: 10 }))
    expect(onResize).not.toHaveBeenCalled()
    expect(onResizeMove).not.toHaveBeenCalled()
    action.destroy()
  })
})

// ---------------------------------------------------------------------------
// pointerdown guards
// ---------------------------------------------------------------------------

describe('rowResize - pointerdown guards', () => {
  it('ignores pointerdown when disabled', () => {
    const { host, rows } = buildGrid([{ rowIndex: 0 }])
    track(host)
    mockRowHeight(rows[0]!, 32)
    const onResize = vi.fn()
    // Start enabled so a strip exists, then disable via update.
    const action = rowResize(host, { onResize })
    const strip = stripOf(rows[0]!)!
    action.update({ onResize, disabled: true })
    // update removes strips, but dispatch on the (now-detached) strip anyway:
    // even if it were still in the DOM, current.disabled short-circuits.
    strip.dispatchEvent(pointer('pointerdown', { clientY: 10 }))
    window.dispatchEvent(pointer('pointerup', { clientY: 50 }))
    expect(onResize).not.toHaveBeenCalled()
    action.destroy()
  })

  it('ignores pointerdown on a non-strip target', () => {
    const { host, rows } = buildGrid([{ rowIndex: 0 }])
    track(host)
    const onResize = vi.fn()
    const action = rowResize(host, { onResize })
    gutterOf(rows[0]!).dispatchEvent(pointer('pointerdown', { clientY: 10 }))
    expect(document.body.style.cursor).toBe('')
    action.destroy()
  })

  it('ignores a strip whose row has a non-finite row index', () => {
    const { host, rows } = buildGrid([{}])
    track(host)
    // Remove the data-svgrid-row marker so rowIndexOf returns NaN.
    rows[0]!.querySelector('[data-svgrid-row]')!.removeAttribute('data-svgrid-row')
    const onResize = vi.fn()
    const action = rowResize(host, { onResize })
    const strip = stripOf(rows[0]!)!
    strip.dispatchEvent(pointer('pointerdown', { clientY: 10 }))
    expect(document.body.style.cursor).toBe('')
    expect(strip.classList.contains('is-resizing')).toBe(false)
    action.destroy()
  })

  it('ignores a strip not inside a tr.sv-grid-row', () => {
    const host = track(document.createElement('div'))
    document.body.appendChild(host)
    // A loose strip with no matching ancestor row.
    const strip = document.createElement('div')
    strip.className = STRIP_CLASS
    host.appendChild(strip)
    const onResize = vi.fn()
    const action = rowResize(host, { onResize })
    strip.dispatchEvent(pointer('pointerdown', { clientY: 10 }))
    expect(document.body.style.cursor).toBe('')
    action.destroy()
  })
})

// ---------------------------------------------------------------------------
// update() + destroy()
// ---------------------------------------------------------------------------

describe('rowResize - update + destroy', () => {
  it('removes strips when toggled to disabled and restores when re-enabled', () => {
    const { host, rows } = buildGrid([{}, {}])
    track(host)
    const onResize = vi.fn()
    const action = rowResize(host, { onResize, disabled: false })
    expect(stripOf(rows[0]!)).not.toBeNull()

    action.update({ onResize, disabled: true })
    expect(stripOf(rows[0]!)).toBeNull()
    expect(stripOf(rows[1]!)).toBeNull()

    action.update({ onResize, disabled: false })
    expect(stripOf(rows[0]!)).not.toBeNull()
    action.destroy()
  })

  it('does not repaint when disabled flag is unchanged on update', () => {
    const { host, rows } = buildGrid([{}])
    track(host)
    const action = rowResize(host, { onResize: vi.fn() })
    const firstStrip = stripOf(rows[0]!)
    // Same disabled value -> decorate is NOT called, strip stays the same node.
    action.update({ onResize: vi.fn() })
    expect(stripOf(rows[0]!)).toBe(firstStrip)
    action.destroy()
  })

  it('destroy removes all strips and detaches listeners', () => {
    const { host, rows } = buildGrid([{ rowIndex: 0 }])
    track(host)
    mockRowHeight(rows[0]!, 32)
    const onResize = vi.fn()
    const action = rowResize(host, { onResize })
    expect(stripOf(rows[0]!)).not.toBeNull()

    action.destroy()
    expect(stripOf(rows[0]!)).toBeNull()

    // After destroy the pointerdown listener is gone; re-create a strip
    // manually and confirm no drag starts.
    const strip = document.createElement('div')
    strip.className = STRIP_CLASS
    gutterOf(rows[0]!).appendChild(strip)
    strip.dispatchEvent(pointer('pointerdown', { clientY: 10 }))
    expect(document.body.style.cursor).toBe('')
  })

  it('uses default min=20 / max=320 when bounds are omitted', () => {
    const { host, rows } = buildGrid([{ rowIndex: 0 }])
    track(host)
    mockRowHeight(rows[0]!, 100)
    const onResize = vi.fn()
    const action = rowResize(host, { onResize })
    const strip = stripOf(rows[0]!)!
    strip.dispatchEvent(pointer('pointerdown', { clientY: 0 }))
    // Drag way past max -> clamps to 320.
    window.dispatchEvent(pointer('pointermove', { clientY: 10000 }))
    expect(rows[0]!.style.height).toBe('320px')
    // Drag way below min -> clamps to 20.
    window.dispatchEvent(pointer('pointerup', { clientY: -10000 }))
    expect(onResize).toHaveBeenCalledWith(0, 20)
    action.destroy()
  })
})

// ---------------------------------------------------------------------------
// Keyboard resize (#79)
// ---------------------------------------------------------------------------

describe('rowResize - keyboard', () => {
  function key(k: string, init: Partial<KeyboardEvent> = {}): KeyboardEvent {
    return new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })
  }

  it('makes the strip focusable', () => {
    const { host, rows } = buildGrid([{}])
    track(host)
    const action = rowResize(host, { onResize: vi.fn() })
    expect(stripOf(rows[0]!)!.tabIndex).toBe(0)
    action.destroy()
  })

  it('ArrowDown grows the row by 10px and reports the new height', () => {
    const { host, rows } = buildGrid([{ rowIndex: 0 }])
    track(host)
    mockRowHeight(rows[0]!, 32)
    const onResize = vi.fn()
    const action = rowResize(host, { onResize })
    stripOf(rows[0]!)!.dispatchEvent(key('ArrowDown'))
    expect(rows[0]!.style.height).toBe('42px')
    expect(onResize).toHaveBeenCalledWith(0, 42)
    action.destroy()
  })

  it('ArrowUp shrinks the row and Shift gives a 1px step', () => {
    const { host, rows } = buildGrid([{ rowIndex: 0 }])
    track(host)
    mockRowHeight(rows[0]!, 60)
    const onResize = vi.fn()
    const action = rowResize(host, { onResize })
    const strip = stripOf(rows[0]!)!
    strip.dispatchEvent(key('ArrowUp'))
    expect(onResize).toHaveBeenLastCalledWith(0, 50)
    strip.dispatchEvent(key('ArrowUp', { shiftKey: true }))
    expect(onResize).toHaveBeenLastCalledWith(0, 59)
    action.destroy()
  })

  it('clamps to the configured min and max', () => {
    const { host, rows } = buildGrid([{ rowIndex: 0 }])
    track(host)
    mockRowHeight(rows[0]!, 42)
    const onResize = vi.fn()
    const action = rowResize(host, { onResize, min: 40, max: 44 })
    const strip = stripOf(rows[0]!)!
    strip.dispatchEvent(key('ArrowUp'))
    expect(onResize).toHaveBeenLastCalledWith(0, 40)
    strip.dispatchEvent(key('ArrowDown'))
    expect(onResize).toHaveBeenLastCalledWith(0, 44)
    action.destroy()
  })

  it('ignores keys other than the arrows and consumes the ones it handles', () => {
    const { host, rows } = buildGrid([{ rowIndex: 0 }])
    track(host)
    mockRowHeight(rows[0]!, 32)
    const onResize = vi.fn()
    const action = rowResize(host, { onResize })
    const strip = stripOf(rows[0]!)!
    const other = key('Enter')
    strip.dispatchEvent(other)
    expect(onResize).not.toHaveBeenCalled()
    expect(other.defaultPrevented).toBe(false)
    const handled = key('ArrowDown')
    strip.dispatchEvent(handled)
    expect(handled.defaultPrevented).toBe(true)
    action.destroy()
  })

  it('does nothing while disabled, and stops after destroy', () => {
    const { host, rows } = buildGrid([{ rowIndex: 0 }])
    track(host)
    mockRowHeight(rows[0]!, 32)
    const onResize = vi.fn()
    const action = rowResize(host, { onResize, disabled: true })
    // Disabled removes the strips entirely, so drive a hand-made one.
    const strip = document.createElement('div')
    strip.className = STRIP_CLASS
    gutterOf(rows[0]!).appendChild(strip)
    strip.dispatchEvent(key('ArrowDown'))
    expect(onResize).not.toHaveBeenCalled()

    action.update({ onResize })
    stripOf(rows[0]!)!.dispatchEvent(key('ArrowDown'))
    expect(onResize).toHaveBeenCalledTimes(1)

    action.destroy()
    const orphan = document.createElement('div')
    orphan.className = STRIP_CLASS
    gutterOf(rows[0]!).appendChild(orphan)
    orphan.dispatchEvent(key('ArrowDown'))
    expect(onResize).toHaveBeenCalledTimes(1)
  })
})
