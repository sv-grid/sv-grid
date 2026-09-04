/**
 * The `columnResize` action. This coverage moved here from columns.test.ts when
 * the drag logic left the controller: the same behaviours (min clamp, rAF
 * coalescing, final commit, teardown) are asserted, but against real DOM rather
 * than a synthetic ctx, because the action now owns the handles as well as the
 * drag.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { columnResize } from './column-resize'

const HANDLE = 'sv-grid-resize-handle'

/** A header row shaped like SvGrid's: `th.sv-grid-column[data-svgrid-header-col]`. */
function buildHeaders(
  specs: Array<{ id?: string; classes?: string[] }>,
): { host: HTMLElement; ths: HTMLElement[] } {
  const host = document.createElement('div')
  const table = document.createElement('table')
  const thead = document.createElement('thead')
  const tr = document.createElement('tr')
  const ths: HTMLElement[] = []
  specs.forEach((spec, i) => {
    const th = document.createElement('th')
    th.className = ['sv-grid-column', ...(spec.classes ?? [])].join(' ')
    if (spec.id !== undefined) th.dataset.svgridHeaderCol = spec.id
    else if (!spec.classes) th.dataset.svgridHeaderCol = `c${i}`
    tr.appendChild(th)
    ths.push(th)
  })
  thead.appendChild(tr)
  table.appendChild(thead)
  host.appendChild(table)
  document.body.appendChild(host)
  return { host, ths }
}

const handleOf = (th: HTMLElement) => th.querySelector<HTMLElement>(`.${HANDLE}`)

function pointer(type: string, init: Partial<PointerEvent> = {}): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    ...init,
  } as PointerEventInit)
}

const hosts: HTMLElement[] = []
const track = (h: HTMLElement) => (hosts.push(h), h)

let rafCb: FrameRequestCallback | null = null
beforeEach(() => {
  rafCb = null
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCb = cb
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
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
  vi.unstubAllGlobals()
})

/** Widths a test can read back, standing in for the controller. */
function widthStore(initial: Record<string, number> = {}) {
  const widths = { ...initial }
  return {
    widths,
    getWidth: (id: string) => widths[id] ?? 100,
    onResize: (id: string, w: number) => {
      widths[id] = w
    },
  }
}

describe('columnResize - handle injection', () => {
  it('injects one handle per identified header', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }, { id: 'b' }])
    track(host)
    const a = columnResize(host, widthStore())
    expect(handleOf(ths[0]!)).not.toBeNull()
    expect(handleOf(ths[1]!)).not.toBeNull()
    a.destroy()
  })

  it('skips spacer columns and headers with no column id', () => {
    // Group headers and the virtualization spacers have nothing to resize.
    const { host, ths } = buildHeaders([
      { id: 'a' },
      { classes: ['sv-grid-column-spacer'] },
      { classes: ['sv-grid-group-header'] },
    ])
    track(host)
    const a = columnResize(host, widthStore())
    expect(handleOf(ths[0]!)).not.toBeNull()
    expect(handleOf(ths[1]!)).toBeNull()
    expect(handleOf(ths[2]!)).toBeNull()
    a.destroy()
  })

  it('does not double-inject on re-decorate', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const a = columnResize(host, widthStore())
    a.update({ ...widthStore(), disabled: false })
    expect(ths[0]!.querySelectorAll(`.${HANDLE}`).length).toBe(1)
    a.destroy()
  })

  it('injects nothing when created disabled', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const a = columnResize(host, { ...widthStore(), disabled: true })
    expect(handleOf(ths[0]!)).toBeNull()
    a.destroy()
  })

  it('removes handles when toggled off and restores them when back on', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const store = widthStore()
    const a = columnResize(host, store)
    expect(handleOf(ths[0]!)).not.toBeNull()
    a.update({ ...store, disabled: true })
    expect(handleOf(ths[0]!)).toBeNull()
    a.update({ ...store, disabled: false })
    expect(handleOf(ths[0]!)).not.toBeNull()
    a.destroy()
  })

  it('gives the handle an accessible separator role and a name', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const a = columnResize(host, { ...widthStore({ a: 150 }), label: () => 'Name' })
    const h = handleOf(ths[0]!)!
    expect(h.getAttribute('role')).toBe('separator')
    expect(h.getAttribute('aria-orientation')).toBe('vertical')
    expect(h.getAttribute('aria-label')).toBe('Resize Name')
    expect(h.tabIndex).toBe(0)
    expect(h.getAttribute('aria-valuenow')).toBe('150')
    a.destroy()
  })
})

describe('columnResize - drag', () => {
  it('clamps to the minimum width and commits on the frame', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const store = widthStore({ a: 120 })
    const a = columnResize(host, store)
    const h = handleOf(ths[0]!)!
    h.dispatchEvent(pointer('pointerdown', { clientX: 100 }))
    window.dispatchEvent(pointer('pointermove', { clientX: -1000 }))
    expect(rafCb).not.toBeNull()
    rafCb!(0)
    expect(store.widths.a).toBe(40)
    a.destroy()
  })

  it('coalesces multiple moves into a single frame', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const store = widthStore({ a: 120 })
    const a = columnResize(host, store)
    const h = handleOf(ths[0]!)!
    h.dispatchEvent(pointer('pointerdown', { clientX: 100 }))
    window.dispatchEvent(pointer('pointermove', { clientX: 150 })) // +50 -> 170
    const first = rafCb
    window.dispatchEvent(pointer('pointermove', { clientX: 200 })) // +100 -> 220
    expect(rafCb).toBe(first) // not rescheduled
    rafCb!(0)
    expect(store.widths.a).toBe(220)
    a.destroy()
  })

  it('commits the final width on pointerup even if the frame never ran', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const store = widthStore({ a: 120 })
    const a = columnResize(host, store)
    const h = handleOf(ths[0]!)!
    h.dispatchEvent(pointer('pointerdown', { clientX: 100 }))
    window.dispatchEvent(pointer('pointermove', { clientX: 190 }))
    window.dispatchEvent(pointer('pointerup', { clientX: 190 })) // rAF cancelled
    expect(store.widths.a).toBe(210)
    a.destroy()
  })

  it('marks the handle while dragging and clears it afterwards', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const a = columnResize(host, widthStore({ a: 120 }))
    const h = handleOf(ths[0]!)!
    h.dispatchEvent(pointer('pointerdown', { clientX: 100 }))
    expect(h.classList.contains('is-resizing')).toBe(true)
    window.dispatchEvent(pointer('pointerup', { clientX: 100 }))
    expect(h.classList.contains('is-resizing')).toBe(false)
    a.destroy()
  })

  it('ignores pointerdown when disabled, and on a non-handle target', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const store = widthStore({ a: 120 })
    const a = columnResize(host, store)
    const h = handleOf(ths[0]!)!
    a.update({ ...store, disabled: true })
    h.dispatchEvent(pointer('pointerdown', { clientX: 100 }))
    window.dispatchEvent(pointer('pointermove', { clientX: 300 }))
    expect(rafCb).toBeNull()
    // A click on the header itself must not start a drag either.
    ths[0]!.dispatchEvent(pointer('pointerdown', { clientX: 100 }))
    expect(rafCb).toBeNull()
    a.destroy()
  })
})

describe('columnResize - keyboard', () => {
  it('ArrowRight grows by 10 and ArrowLeft shrinks by 10', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const store = widthStore({ a: 120 })
    const a = columnResize(host, store)
    const h = handleOf(ths[0]!)!
    h.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(store.widths.a).toBe(130)
    h.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(store.widths.a).toBe(120)
    a.destroy()
  })

  it('Shift gives a 1px step and the minimum still holds', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const store = widthStore({ a: 41 })
    const a = columnResize(host, store)
    const h = handleOf(ths[0]!)!
    h.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }),
    )
    expect(store.widths.a).toBe(40)
    h.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(store.widths.a).toBe(40) // clamped, not 30
    a.destroy()
  })

  it('ignores other keys and does nothing while disabled', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const store = widthStore({ a: 120 })
    const a = columnResize(host, store)
    const h = handleOf(ths[0]!)!
    h.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(store.widths.a).toBe(120)
    a.update({ ...store, disabled: true })
    h.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(store.widths.a).toBe(120)
    a.destroy()
  })
})

describe('columnResize - teardown', () => {
  it('destroy removes every handle and detaches the drag listeners', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }, { id: 'b' }])
    track(host)
    const store = widthStore({ a: 120 })
    const a = columnResize(host, store)
    const h = handleOf(ths[0]!)!
    h.dispatchEvent(pointer('pointerdown', { clientX: 100 }))
    a.destroy()
    expect(host.querySelectorAll(`.${HANDLE}`).length).toBe(0)
    // An in-flight drag must not keep writing after unmount (#58).
    window.dispatchEvent(pointer('pointermove', { clientX: 400 }))
    expect(rafCb).toBeNull()
    expect(store.widths.a).toBe(120)
  })
})

describe('columnResize - per-column resizable', () => {
  it('creates no handle for a column that opts out', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }, { id: 'b' }])
    track(host)
    const a = columnResize(host, { ...widthStore(), canResize: (id) => id !== 'b' })
    expect(handleOf(ths[0]!)).not.toBeNull()
    expect(handleOf(ths[1]!)).toBeNull()
    a.destroy()
  })

  it('takes the handle away when a column stops being resizable', () => {
    // A re-decorate has to remove, not merely stop adding: the handle is
    // already in the DOM by then.
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const store = widthStore()
    let allow = true
    const a = columnResize(host, { ...store, canResize: () => allow })
    expect(handleOf(ths[0]!)).not.toBeNull()
    allow = false
    a.update({ ...store, canResize: () => allow, disabled: true })
    a.update({ ...store, canResize: () => allow, disabled: false })
    expect(handleOf(ths[0]!)).toBeNull()
    a.destroy()
  })

  it('refuses the drag and the arrow keys even if a handle is reached', () => {
    // Defence in depth: no handle is created, so this can only happen if one
    // survives a stale render. It must still not resize.
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const store = widthStore({ a: 120 })
    let allow = true
    const a = columnResize(host, { ...store, canResize: () => allow })
    const h = handleOf(ths[0]!)!
    allow = false
    a.update({ ...store, canResize: () => allow })

    h.dispatchEvent(pointer('pointerdown', { clientX: 100 }))
    window.dispatchEvent(pointer('pointermove', { clientX: 300 }))
    expect(rafCb).toBeNull()
    h.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(store.widths.a).toBe(120)
    a.destroy()
  })
})

describe('columnResize - double-click autosize', () => {
  it('double-clicking the handle autosizes that column', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const onAutosize = vi.fn()
    const a = columnResize(host, { ...widthStore(), onAutosize })
    handleOf(ths[0]!)!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(onAutosize).toHaveBeenCalledWith('a')
    a.destroy()
  })

  it('does not autosize a column that opted out - it has no handle to hit', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const onAutosize = vi.fn()
    const a = columnResize(host, { ...widthStore(), onAutosize, canResize: () => false })
    expect(handleOf(ths[0]!)).toBeNull()
    // The header itself is all that is left, and it carries no autosize.
    ths[0]!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(onAutosize).not.toHaveBeenCalled()
    a.destroy()
  })

  it('does not let the double-click reach the header underneath', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const onHeader = vi.fn()
    ths[0]!.addEventListener('dblclick', onHeader)
    const a = columnResize(host, { ...widthStore(), onAutosize: vi.fn() })
    handleOf(ths[0]!)!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(onHeader).not.toHaveBeenCalled()
    a.destroy()
  })

  it('does nothing on double-click while disabled', () => {
    const { host, ths } = buildHeaders([{ id: 'a' }])
    track(host)
    const onAutosize = vi.fn()
    const store = widthStore()
    const a = columnResize(host, { ...store, onAutosize })
    const h = handleOf(ths[0]!)!
    a.update({ ...store, onAutosize, disabled: true })
    h.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(onAutosize).not.toHaveBeenCalled()
    a.destroy()
  })
})
