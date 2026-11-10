import { afterEach, describe, expect, it } from 'vitest'
import { createFocusTrap, getFocusable, keepFocus } from './focus-trap'

function build(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('keepFocus', () => {
  /** Past the observer and the timer that decide where focus goes. */
  const settled = () => new Promise((r) => setTimeout(r, 5))

  it('moves to the control now in the place of one that left the page', async () => {
    const host = build('<button id="a">a</button><button id="b">b</button><button id="c">c</button>')
    const kept = keepFocus(host)
    const b = host.querySelector<HTMLElement>('#b')!
    b.focus()
    b.remove()
    await settled()
    expect(document.activeElement?.id).toBe('c')
    kept.destroy()
  })

  it('takes the last control when the one that left was last', async () => {
    const host = build('<button id="a">a</button><button id="b">b</button>')
    const kept = keepFocus(host)
    const b = host.querySelector<HTMLElement>('#b')!
    b.focus()
    b.remove()
    await settled()
    expect(document.activeElement?.id).toBe('a')
    kept.destroy()
  })

  it('moves on from a control that turned disabled', async () => {
    const host = build('<button id="a">a</button><button id="b">b</button>')
    const kept = keepFocus(host)
    const a = host.querySelector<HTMLButtonElement>('#a')!
    a.focus()
    a.disabled = true
    await settled()
    expect(document.activeElement?.id).toBe('b')
    kept.destroy()
  })

  it('gives focus back to a control that was only moved', async () => {
    const host = build('<button id="a">a</button><button id="b">b</button>')
    const kept = keepFocus(host)
    const a = host.querySelector<HTMLElement>('#a')!
    a.focus()
    // Svelte's keyed each moves the node: that drops focus without removing it.
    host.append(a)
    await settled()
    expect(document.activeElement?.id).toBe('a')
    kept.destroy()
  })

  it('falls back to the region when nothing is left', async () => {
    const host = build('<button id="a">a</button>')
    const kept = keepFocus(host)
    const a = host.querySelector<HTMLElement>('#a')!
    a.focus()
    a.remove()
    await settled()
    expect(document.activeElement).toBe(host)
    kept.destroy()
  })

  it('leaves focus that someone took elsewhere', async () => {
    const host = build('<button id="a">a</button><button id="b">b</button>')
    const other = build('<button id="other">x</button>').firstElementChild as HTMLElement
    const kept = keepFocus(host)
    const a = host.querySelector<HTMLElement>('#a')!
    a.focus()
    a.remove()
    other.focus()
    await settled()
    expect(document.activeElement).toBe(other)
    kept.destroy()
  })

  it('a click on the page takes focus with it: a later removal moves nothing', async () => {
    const host = build('<button id="a">a</button><button id="b">b</button>')
    const kept = keepFocus(host)
    const a = host.querySelector<HTMLElement>('#a')!
    a.focus()
    a.blur()
    await settled()
    a.remove()
    await settled()
    expect(document.activeElement).toBe(document.body)
    kept.destroy()
  })

  it('on touch it does not open the keyboard: a text box is skipped for the region', async () => {
    const host = build('<button id="a">a</button><textarea id="t"></textarea>')
    const kept = keepFocus(host)
    const a = host.querySelector<HTMLElement>('#a')!
    a.focus()
    a.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { pointerType: 'touch' }))
    a.remove()
    await settled()
    expect(document.activeElement).toBe(host)
    kept.destroy()
  })

  it('a dialog keeps the keyboard when the focused control goes', async () => {
    const host = build('<button id="a">a</button><button id="b">b</button>')
    const trap = createFocusTrap(host)
    trap.activate()
    await settled()
    const a = host.querySelector<HTMLElement>('#a')!
    a.focus()
    a.remove()
    await settled()
    expect(document.activeElement?.id).toBe('b')
    trap.release()
  })
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

  it('opened as a menu closes: goes back to what the menu gave focus to, not to the body', async () => {
    const host = build('<table id="grid" tabindex="0"></table><div id="d"><button>in</button></div>')
    const trap = createFocusTrap(host.querySelector<HTMLElement>('#d')!)
    expect(document.activeElement).toBe(document.body)
    trap.activate()
    // The menu's item left the page, and its own clean-up runs before the dialog takes focus.
    host.querySelector<HTMLElement>('#grid')!.focus()
    await Promise.resolve()
    expect(document.activeElement?.textContent).toBe('in')
    trap.release()
    expect(document.activeElement?.id).toBe('grid')
  })

  it('an opener that left the page: what held it takes focus', async () => {
    const host = build('<div id="grid" tabindex="0"><span id="cell"><button id="open">o</button></span></div><div id="d"><button>in</button></div>')
    host.querySelector<HTMLElement>('#open')!.focus()
    const trap = createFocusTrap(host.querySelector<HTMLElement>('#d')!)
    trap.activate()
    await Promise.resolve()
    host.querySelector('#cell')!.remove()
    trap.release()
    expect(document.activeElement?.id).toBe('grid')
  })

  it('an opener that cannot take focus any more (disabled, hidden): what held it does', async () => {
    const host = build('<div id="grid" tabindex="0"><button id="open">o</button></div><div id="d"><button>in</button></div>')
    const open = host.querySelector<HTMLButtonElement>('#open')!
    open.focus()
    const trap = createFocusTrap(host.querySelector<HTMLElement>('#d')!)
    trap.activate()
    await Promise.resolve()
    open.disabled = true
    trap.release()
    expect(document.activeElement?.id).toBe('grid')
  })

  it('a card gone from a wall nothing focusable holds: the next card takes focus', async () => {
    const host = build('<ul id="wall"><li><button>1</button></li><li id="two"><button id="open">2</button></li><li><button id="next">3</button></li></ul><div id="d"><button>in</button></div>')
    host.querySelector<HTMLElement>('#open')!.focus()
    const trap = createFocusTrap(host.querySelector<HTMLElement>('#d')!)
    trap.activate()
    await Promise.resolve()
    host.querySelector('#two')!.remove()
    trap.release()
    expect(document.activeElement?.id).toBe('next')
  })

  it('the last card gone: the first control left in the wall', async () => {
    const host = build('<ul id="wall"><li><button id="first">1</button></li><li id="two"><button id="open">2</button></li></ul><div id="d"><button>in</button></div>')
    host.querySelector<HTMLElement>('#open')!.focus()
    const trap = createFocusTrap(host.querySelector<HTMLElement>('#d')!)
    trap.activate()
    await Promise.resolve()
    host.querySelector('#two')!.remove()
    trap.release()
    expect(document.activeElement?.id).toBe('first')
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
