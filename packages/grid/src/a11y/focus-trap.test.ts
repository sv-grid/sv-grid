import { afterEach, describe, expect, it } from 'vitest'
import { createFocusTrap, getFocusable } from './focus-trap'

function build(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('getFocusable', () => {
  it('collects Tab-focusable elements in DOM order', () => {
    const host = build(`
      <a href="#">a</a>
      <button>b</button>
      <input />
      <div tabindex="0">d</div>
    `)
    const f = getFocusable(host)
    expect(f.map((el) => el.tagName.toLowerCase())).toEqual(['a', 'button', 'input', 'div'])
  })

  it('excludes disabled, tabindex=-1, hidden and aria-hidden elements', () => {
    const host = build(`
      <button disabled>disabled</button>
      <button tabindex="-1">programmatic</button>
      <button hidden>hidden</button>
      <button aria-hidden="true">aria</button>
      <button style="display:none">display-none</button>
      <button>real</button>
    `)
    const f = getFocusable(host)
    expect(f).toHaveLength(1)
    expect(f[0]!.textContent).toBe('real')
  })
})

describe('createFocusTrap', () => {
  it('moves focus to the first focusable on activate', async () => {
    const host = build(`<button>first</button><button>second</button>`)
    const trap = createFocusTrap(host)
    trap.activate()
    await Promise.resolve()
    expect(document.activeElement?.textContent).toBe('first')
    trap.release()
  })

  it('honours an explicit initialFocus element', async () => {
    const host = build(`<button>first</button><button id="target">second</button>`)
    const target = host.querySelector<HTMLElement>('#target')!
    const trap = createFocusTrap(host, { initialFocus: target })
    trap.activate()
    await Promise.resolve()
    expect(document.activeElement).toBe(target)
    trap.release()
  })

  it('wraps Tab from the last element back to the first', async () => {
    const host = build(`<button>first</button><button>last</button>`)
    const first = host.children[0] as HTMLElement
    const last = host.children[1] as HTMLElement
    const trap = createFocusTrap(host)
    trap.activate()
    await Promise.resolve()
    last.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(first)
    trap.release()
  })

  it('wraps Shift+Tab from the first element to the last', async () => {
    const host = build(`<button>first</button><button>last</button>`)
    const first = host.children[0] as HTMLElement
    const last = host.children[1] as HTMLElement
    const trap = createFocusTrap(host)
    trap.activate()
    await Promise.resolve()
    first.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(document.activeElement).toBe(last)
    trap.release()
  })

  it('restores focus to the previously-focused element on release', async () => {
    const outside = build(`<button id="opener">opener</button>`).querySelector<HTMLElement>('#opener')!
    outside.focus()
    const host = build(`<button>inner</button>`)
    const trap = createFocusTrap(host)
    trap.activate()
    await Promise.resolve()
    expect(document.activeElement?.textContent).toBe('inner')
    trap.release()
    expect(document.activeElement).toBe(outside)
  })

  it('calls onEscape when Escape is pressed while active', async () => {
    const host = build(`<button>x</button>`)
    let escaped = false
    const trap = createFocusTrap(host, { onEscape: () => (escaped = true) })
    trap.activate()
    await Promise.resolve()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(escaped).toBe(true)
    trap.release()
  })
})
