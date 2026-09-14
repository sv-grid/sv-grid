/**
 * DOM test: the formula bar shows a cell's RAW text rather than its computed
 * value, commits on Enter, reverts on Escape, and autocompletes function names.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvFormulaBar from './SvFormulaBar.svelte'

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => {
  if (comp) { unmount(comp); comp = null }
  if (host) { host.remove(); host = null }
})

const active = { rowIndex: 1, colIndex: 1 }

function render(props: Record<string, unknown>): HTMLElement {
  host = document.createElement('div')
  document.body.appendChild(host)
  comp = mount(SvFormulaBar, {
    target: host,
    props: { active, value: '', onCommit: () => {}, ...props },
  })
  flushSync()
  return host
}

const formulaInput = (el: HTMLElement) =>
  el.querySelector<HTMLInputElement>('input.formula')!
const nameBox = (el: HTMLElement) =>
  el.querySelector<HTMLInputElement>('.name-box input')!

/** Type into an input the way a user does, so Svelte sees the event. */
function type(input: HTMLInputElement, text: string): void {
  input.value = text
  input.selectionStart = text.length
  input.dispatchEvent(new Event('input', { bubbles: true }))
  flushSync()
}

function press(input: HTMLElement, key: string): void {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  flushSync()
}

describe('SvFormulaBar (DOM)', () => {
  it('shows the active cell address in the name box', () => {
    expect(nameBox(render({})).placeholder).toBe('B2')
  })

  it('shows the RAW text, not a computed value', () => {
    // The point of the bar: the grid shows 1,234.50, this shows =B2*C2.
    expect(formulaInput(render({ value: '=B2*C2' })).value).toBe('=B2*C2')
  })

  it('commits on Enter', () => {
    const onCommit = vi.fn()
    const el = render({ onCommit })
    const input = formulaInput(el)
    type(input, '=1+1')
    press(input, 'Enter')
    expect(onCommit).toHaveBeenCalledWith('=1+1')
  })

  it('reverts on Escape rather than committing', () => {
    const onCommit = vi.fn()
    const el = render({ value: '=A1', onCommit })
    const input = formulaInput(el)
    type(input, '=WRONG')
    press(input, 'Escape')
    expect(onCommit).not.toHaveBeenCalled()
    expect(input.value).toBe('=A1')
  })

  it('is disabled when no cell is active', () => {
    expect(formulaInput(render({ active: null })).disabled).toBe(true)
  })

  it('offers function suggestions while typing a formula', () => {
    const el = render({})
    type(formulaInput(el), '=SU')
    const list = el.querySelector('.suggestions')
    expect(list).not.toBeNull()
    expect(list!.textContent).toContain('SUM')
  })

  it('offers nothing for a plain literal', () => {
    const el = render({})
    type(formulaInput(el), 'hello')
    expect(el.querySelector('.suggestions')).toBeNull()
  })

  it('ranks the closest match first', () => {
    const el = render({})
    type(formulaInput(el), '=SU')
    expect(el.querySelector('.suggestions button')!.textContent).toBe('SUM')
  })

  it('accepts a suggestion on mousedown', () => {
    const el = render({})
    const input = formulaInput(el)
    type(input, '=SU')
    const first = el.querySelector<HTMLButtonElement>('.suggestions button')!
    first.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    flushSync()
    expect(input.value).toBe('=SUM()')
  })

  it('moves the highlight with the arrow keys', () => {
    const el = render({})
    const input = formulaInput(el)
    type(input, '=SU')
    press(input, 'ArrowDown')
    const active2 = el.querySelector('.suggestions button.active')
    expect(active2!.textContent).not.toBe('SUM')
  })

  it('shows a signature hint inside a call', () => {
    const el = render({})
    type(formulaInput(el), '=VLOOKUP(')
    expect(el.querySelector('.hint')!.textContent)
      .toBe('VLOOKUP(lookup, table, colIndex)')
  })

  it('navigates when an address is typed into the name box', () => {
    const onNavigate = vi.fn()
    const el = render({ onNavigate })
    const box = nameBox(el)
    type(box, 'C5')
    press(box, 'Enter')
    expect(onNavigate).toHaveBeenCalledWith({ rowIndex: 4, colIndex: 2 })
  })

  it('ignores junk typed into the name box', () => {
    const onNavigate = vi.fn()
    const el = render({ onNavigate })
    const box = nameBox(el)
    type(box, 'not a cell')
    press(box, 'Enter')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('lists defined names', () => {
    const el = render({ names: [{ name: 'Tax', refersTo: '=$B$1' }] })
    const select = el.querySelector<HTMLSelectElement>('select')!
    expect([...select.options].map((o) => o.value)).toEqual(['', 'Tax'])
  })

  it('hides the name box when asked', () => {
    expect(render({ showNameBox: false }).querySelector('.name-box')).toBeNull()
  })

  it('turns autocomplete off when asked', () => {
    const el = render({ autocomplete: false })
    type(formulaInput(el), '=SU')
    expect(el.querySelector('.suggestions')).toBeNull()
  })
})
