/**
 * SvNumberInput as an in-cell editor: the stepper buttons keep focus in the
 * field, and a keystroke that can never be part of a number is rejected as it
 * is typed (both seen in the svgrid.com hero grid, 2026-10-17).
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvNumberInput from './SvNumberInput.svelte'

function mountNum(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvNumberInput, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

describe('SvNumberInput', () => {
  it('rejects a letter typed into the field and keeps the number', () => {
    const { target, destroy } = mountNum({ value: 45 })
    try {
      const input = target.querySelector<HTMLInputElement>('input.sv-num__input')!
      input.focus()
      flushSync()
      input.value = '45a'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      expect(input.value).toBe('45')
      input.value = '45.5'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      expect(input.value).toBe('45.5')
    } finally {
      destroy()
    }
  })

  it('keeps focus in the field when a stepper button is pressed', () => {
    const { target, destroy } = mountNum({ value: 1 })
    try {
      const up = target.querySelector<HTMLButtonElement>('button[aria-label="Increment"]')!
      // No Tab stop, and pressing it does not move focus off the input.
      expect(up.getAttribute('tabindex')).toBe('-1')
      const down = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 })
      up.dispatchEvent(down)
      expect(down.defaultPrevented).toBe(true)
    } finally {
      destroy()
    }
  })
})
