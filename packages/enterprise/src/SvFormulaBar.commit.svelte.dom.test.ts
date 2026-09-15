/**
 * DOM test: a formula-bar entry lands in the cell the edit STARTED in.
 *
 * Clicking another cell to finish typing moves the shell's `active` first
 * and blurs the input second, so a bar that committed into the active cell
 * put "hello" typed for A3 into the A6 the user clicked. A `.svelte.` test
 * so the props can be a `$state` object the component reacts to.
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

describe('SvFormulaBar commit target', () => {
  it('commits into the cell the edit started in, not the one active at blur', () => {
    const onCommit = vi.fn()
    const props = $state({
      active: { rowIndex: 2, colIndex: 0 } as { rowIndex: number; colIndex: number } | null,
      value: '',
      onCommit,
    })
    host = document.createElement('div')
    document.body.appendChild(host)
    comp = mount(SvFormulaBar, { target: host, props })
    flushSync()
    const input = host.querySelector<HTMLTextAreaElement>('textarea.formula')!

    input.dispatchEvent(new FocusEvent('focus'))
    input.value = 'hello'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()

    // The user clicks A6: the grid moves the active cell, then the input blurs.
    props.active = { rowIndex: 5, colIndex: 0 }
    flushSync()
    input.dispatchEvent(new FocusEvent('blur'))
    flushSync()

    expect(onCommit).toHaveBeenCalledTimes(1)
    // A blur says so, so the shell leaves the cursor where the click put it.
    expect(onCommit).toHaveBeenCalledWith('hello', { rowIndex: 2, colIndex: 0 }, 'blur')
  })

  it('pins the cell again for the next edit', () => {
    const onCommit = vi.fn()
    const props = $state({ active: { rowIndex: 0, colIndex: 0 }, value: '', onCommit })
    host = document.createElement('div')
    document.body.appendChild(host)
    comp = mount(SvFormulaBar, { target: host, props })
    flushSync()
    const input = host.querySelector<HTMLTextAreaElement>('textarea.formula')!

    input.dispatchEvent(new FocusEvent('focus'))
    input.value = 'one'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    flushSync()

    props.active = { rowIndex: 1, colIndex: 1 }
    flushSync()
    input.dispatchEvent(new FocusEvent('focus'))
    input.value = 'two'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    flushSync()

    expect(onCommit.mock.calls).toEqual([
      ['one', { rowIndex: 0, colIndex: 0 }, 'enter'],
      ['two', { rowIndex: 1, colIndex: 1 }, 'enter'],
    ])
  })
})
