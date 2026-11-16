/**
 * Popovers as bottom sheets (`sheet`, `setPopoverSheets('phone')`): on a
 * phone-wide window a click-opened popover opens as a sheet, with a dimmed
 * page that closes it and keeps the tap; a wider window, a hover popover
 * and the 'off' mode keep the anchored panel. Dragging the handle down
 * past a fifth closes it.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createRawSnippet, flushSync, mount, unmount } from 'svelte'
import SvPopover from './SvPopover.svelte'
import { setPopoverSheets } from './popover-sheets.svelte'

const body = createRawSnippet(() => ({ render: () => `<div role="menu"><button role="menuitem" class="item">One</button></div>` }))
const anchorBtn = createRawSnippet(() => ({ render: () => `<button class="anchor">open</button>` }))

function width(px: number) {
  ;(window as any).innerWidth = px
  window.dispatchEvent(new Event('resize'))
  flushSync()
}
function mountPop(props: Record<string, unknown> = {}) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvPopover as any, { target, props: { anchor: anchorBtn, children: body, ...props } as any })
  flushSync()
  return {
    open: () => {
      target.querySelector<HTMLElement>('.anchor')!.click()
      flushSync()
    },
    destroy: () => {
      unmount(app)
      target.remove()
    },
  }
}

afterEach(() => {
  setPopoverSheets('off')
  width(1024)
  document.querySelectorAll('.sv-pop__panel, .sv-pop__backdrop').forEach((n) => n.remove())
})

describe('popovers as bottom sheets', () => {
  it("opens as a sheet on a phone when the page asks for sheets, and as a popover on a wide window", () => {
    setPopoverSheets('phone')
    width(390)
    let p = mountPop()
    p.open()
    let panel = document.querySelector<HTMLElement>('.sv-pop__panel')!
    expect(panel.classList.contains('sv-pop__panel--sheet')).toBe(true)
    expect(panel.querySelector('.sv-pop__grip')).toBeTruthy()
    expect(panel.querySelector('.sv-pop__arrow')).toBeNull()
    expect(document.querySelector('.sv-pop__backdrop')).toBeTruthy()
    p.destroy()
    width(1200)
    p = mountPop()
    p.open()
    panel = document.querySelector<HTMLElement>('.sv-pop__panel')!
    expect(panel.classList.contains('sv-pop__panel--sheet')).toBe(false)
    expect(document.querySelector('.sv-pop__backdrop')).toBeNull()
    p.destroy()
  })

  it('keeps popovers anchored when the page did not ask, and a hover popover always', () => {
    width(390)
    let p = mountPop()
    p.open()
    expect(document.querySelector('.sv-pop__panel--sheet')).toBeNull()
    p.destroy()
    setPopoverSheets('phone')
    p = mountPop({ trigger: 'hover', open: true })
    expect(document.querySelector('.sv-pop__panel')).toBeTruthy()
    expect(document.querySelector('.sv-pop__panel--sheet')).toBeNull()
    p.destroy()
  })

  it('a popover asked for as a sheet is one at any width', () => {
    width(1400)
    const p = mountPop({ sheet: true })
    p.open()
    expect(document.querySelector('.sv-pop__panel--sheet')).toBeTruthy()
    p.destroy()
  })

  it('closes on a tap on the dimmed page, and a pointerdown there is not an outside click', () => {
    setPopoverSheets('phone')
    width(390)
    const p = mountPop()
    p.open()
    const backdrop = document.querySelector<HTMLElement>('.sv-pop__backdrop')!
    backdrop.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    flushSync()
    // Still open after the press: the tap that ends it closes it, so it never reaches what is under it.
    expect(document.querySelector('.sv-pop__panel')).toBeTruthy()
    backdrop.click()
    flushSync()
    expect(document.querySelector('.sv-pop__panel')).toBeNull()
    expect(document.querySelector('.sv-pop__backdrop')).toBeNull()
    p.destroy()
  })

  it('closes when its handle is dragged down far enough, and not for a nudge', () => {
    const p = mountPop({ sheet: true })
    p.open()
    const grip = () => document.querySelector<HTMLElement>('.sv-pop__grip')!
    const drag = (dy: number) => {
      grip().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientY: 100 }))
      grip().dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientY: 100 + dy }))
      grip().dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientY: 100 + dy }))
      flushSync()
    }
    drag(10)
    expect(document.querySelector('.sv-pop__panel')).toBeTruthy()
    drag(200)
    expect(document.querySelector('.sv-pop__panel')).toBeNull()
    p.destroy()
  })
})
