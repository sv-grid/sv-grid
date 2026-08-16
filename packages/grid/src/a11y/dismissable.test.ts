import { afterEach, describe, expect, it } from 'vitest'
import { createDismissableLayer, dismissableDepth, onScrollOutside } from './dismissable'

function panel(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('createDismissableLayer', () => {
  it('dismisses on Escape when topmost', () => {
    const el = panel()
    let reason: string | null = null
    const layer = createDismissableLayer({ element: () => el, onDismiss: (r) => (reason = r) })
    layer.activate()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(reason).toBe('escape')
    layer.release()
  })

  it('dismisses on outside pointerdown but not inside', () => {
    const el = panel()
    const inside = document.createElement('button')
    el.appendChild(inside)
    let reason: string | null = null
    const layer = createDismissableLayer({ element: () => el, onDismiss: (r) => (reason = r) })
    layer.activate()

    inside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    expect(reason).toBeNull()

    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    expect(reason).toBe('outside')
    layer.release()
  })

  it('treats a pointerdown in ANY of multiple elements as inside', () => {
    const panelEl = panel()
    const trigger = panel()
    let reason: string | null = null
    const layer = createDismissableLayer({
      element: () => [panelEl, trigger],
      onDismiss: (r) => (reason = r),
    })
    layer.activate()

    trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    expect(reason).toBeNull() // trigger counts as inside

    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    expect(reason).toBe('outside')
    layer.release()
  })

  it('only the top layer responds to Escape', () => {
    const a = panel()
    const b = panel()
    const hits: string[] = []
    const layerA = createDismissableLayer({ element: () => a, onDismiss: () => hits.push('a') })
    const layerB = createDismissableLayer({ element: () => b, onDismiss: () => hits.push('b') })
    layerA.activate()
    layerB.activate()
    expect(dismissableDepth()).toBe(2)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(hits).toEqual(['b']) // only the topmost

    layerB.release()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(hits).toEqual(['b', 'a']) // now a is on top

    layerA.release()
    expect(dismissableDepth()).toBe(0)
  })

  it('close-on-scroll ignores scrolling inside the panel', () => {
    const el = panel()
    const list = document.createElement('div') // e.g. the filter menu's facet list
    el.appendChild(list)
    let closed = 0
    const off = onScrollOutside(() => el, () => closed++)

    // Inner scroll containers don't bubble, so this only reaches the capture
    // listener - it must NOT close the menu the user is scrolling.
    list.dispatchEvent(new Event('scroll'))
    el.dispatchEvent(new Event('scroll'))
    expect(closed).toBe(0)

    // A scroll anywhere else moves the anchor, so the panel closes.
    document.body.dispatchEvent(new Event('scroll'))
    expect(closed).toBe(1)
    document.dispatchEvent(new Event('scroll'))
    expect(closed).toBe(2)

    off()
    document.body.dispatchEvent(new Event('scroll'))
    expect(closed).toBe(2)
  })

  it('respects closeOnEscape / closeOnOutside flags', () => {
    const el = panel()
    let count = 0
    const layer = createDismissableLayer({
      element: () => el,
      onDismiss: () => count++,
      closeOnEscape: false,
      closeOnOutside: false,
    })
    layer.activate()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    expect(count).toBe(0)
    layer.release()
  })
})
