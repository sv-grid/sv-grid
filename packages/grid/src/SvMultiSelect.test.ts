/**
 * Component tests for SvMultiSelect: trigger/placeholder, portalled panel open,
 * option toggling, chip display + "+N" collapse, search filter, and clear-all.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvMultiSelect from './SvMultiSelect.svelte'

const options = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
  { value: 'c', label: 'Cherry' },
  { value: 'd', label: 'Date' },
]

function mountMs(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvMultiSelect, { target, props: { options, ...props } as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

const panel = () => document.body.querySelector('.sv-ms__panel')

afterEach(() => { document.body.innerHTML = '' })

describe('SvMultiSelect', () => {
  it('shows the placeholder when nothing is selected', () => {
    const { target, destroy } = mountMs({ value: [], placeholder: 'Pick fruit' })
    try {
      expect(target.querySelector('.sv-ms__placeholder')!.textContent).toBe('Pick fruit')
    } finally { destroy() }
  })

  it('opens a portalled panel on trigger click', () => {
    const { target, destroy } = mountMs({ value: [] })
    try {
      expect(panel()).toBeNull()
      target.querySelector<HTMLButtonElement>('.sv-ms__trigger')!.click()
      flushSync()
      expect(panel()).not.toBeNull()
      expect(document.body.querySelectorAll('.sv-ms__opt')).toHaveLength(4)
    } finally { destroy() }
  })

  it('toggling an option emits the updated value array', () => {
    const onChange = vi.fn()
    const { target, destroy } = mountMs({ value: ['a'], onChange })
    try {
      target.querySelector<HTMLButtonElement>('.sv-ms__trigger')!.click()
      flushSync()
      const opts = document.body.querySelectorAll<HTMLElement>('.sv-ms__opt')
      opts[1]!.click() // add 'b'
      expect(onChange).toHaveBeenCalledWith(['a', 'b'])
    } finally { destroy() }
  })

  it('deselects an already-selected option', () => {
    const onChange = vi.fn()
    const { target, destroy } = mountMs({ value: ['a', 'b'], onChange })
    try {
      target.querySelector<HTMLButtonElement>('.sv-ms__trigger')!.click()
      flushSync()
      const opts = document.body.querySelectorAll<HTMLElement>('.sv-ms__opt')
      opts[0]!.click() // remove 'a'
      expect(onChange).toHaveBeenCalledWith(['b'])
    } finally { destroy() }
  })

  it('renders chips and collapses beyond maxTagCount', () => {
    const { target, destroy } = mountMs({ value: ['a', 'b', 'c', 'd'], maxTagCount: 2 })
    try {
      const chips = target.querySelectorAll('.sv-ms__chip')
      // 2 chips + 1 "+2" pill
      expect(chips).toHaveLength(3)
      expect(target.querySelector('.sv-ms__chip--more')!.textContent).toBe('+2')
    } finally { destroy() }
  })

  it('filters options by the search box', () => {
    const { target, destroy } = mountMs({ value: [], searchable: true })
    try {
      target.querySelector<HTMLButtonElement>('.sv-ms__trigger')!.click()
      flushSync()
      const search = document.body.querySelector<HTMLInputElement>('.sv-ms__search')!
      search.value = 'an'
      search.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      const labels = [...document.body.querySelectorAll('.sv-ms__label')].map((el) => el.textContent)
      expect(labels).toEqual(['Banana']) // only "Banana" contains "an"
    } finally { destroy() }
  })

  it('clear-all empties the selection', () => {
    const onChange = vi.fn()
    const { target, destroy } = mountMs({ value: ['a', 'b'], onChange })
    try {
      target.querySelector<HTMLButtonElement>('.sv-ms__clear')!.click()
      expect(onChange).toHaveBeenCalledWith([])
    } finally { destroy() }
  })

  // ---- WAI-ARIA combobox wiring (Track B) --------------------------------
  it('wires the trigger + search as an APG combobox with aria-activedescendant', () => {
    const { target, destroy } = mountMs({ value: [] })
    try {
      const trigger = target.querySelector<HTMLButtonElement>('.sv-ms__trigger')!
      expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
      expect(trigger.getAttribute('aria-expanded')).toBe('false')

      trigger.click()
      flushSync()
      expect(trigger.getAttribute('aria-expanded')).toBe('true')

      const list = document.body.querySelector('.sv-ms__list')!
      const search = document.body.querySelector<HTMLInputElement>('.sv-ms__search')!
      expect(list.getAttribute('role')).toBe('listbox')
      expect(search.getAttribute('role')).toBe('combobox')
      expect(search.getAttribute('aria-controls')).toBe(list.id)

      // activedescendant points at the first option, and follows ArrowDown.
      const opts = document.body.querySelectorAll<HTMLElement>('.sv-ms__opt')
      expect(search.getAttribute('aria-activedescendant')).toBe(opts[0]!.id)
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      flushSync()
      expect(search.getAttribute('aria-activedescendant')).toBe(opts[1]!.id)
    } finally { destroy() }
  })

  it('Enter on the active option toggles it (keyboard select)', () => {
    const onChange = vi.fn()
    const { target, destroy } = mountMs({ value: [], onChange })
    try {
      target.querySelector<HTMLButtonElement>('.sv-ms__trigger')!.click()
      flushSync()
      const search = document.body.querySelector<HTMLInputElement>('.sv-ms__search')!
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      expect(onChange).toHaveBeenCalledWith(['a']) // first option
    } finally { destroy() }
  })

  it('carries dir onto the portalled panel (RTL escapes the field scope otherwise)', () => {
    const { target, destroy } = mountMs({ value: [], dir: 'rtl' })
    try {
      target.querySelector<HTMLButtonElement>('.sv-ms__trigger')!.click()
      flushSync()
      expect(document.body.querySelector('.sv-ms__panel')!.getAttribute('dir')).toBe('rtl')
    } finally { destroy() }
  })

  // ---- Async / remote options (Track C) ----------------------------------
  it('loads remote options via loadOptions when opened', async () => {
    const loadOptions = vi.fn(async () => [{ value: 'z', label: 'Remote Zed' }])
    const { target, destroy } = mountMs({ value: [], loadOptions })
    try {
      target.querySelector<HTMLButtonElement>('.sv-ms__trigger')!.click()
      flushSync()
      expect(loadOptions).toHaveBeenCalledWith('') // initial load on open
      await vi.waitFor(() => {
        flushSync()
        const opts = [...document.body.querySelectorAll('.sv-ms__opt')].map((o) => o.textContent)
        expect(opts.join()).toContain('Remote Zed')
      })
    } finally { destroy() }
  })
})
