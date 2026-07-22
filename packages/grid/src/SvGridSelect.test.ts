/**
 * Component tests for SvGridSelect: trigger label, portalled multi-column panel
 * (header + rows), search filter, and row-click select (emits id + row, closes).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvGridSelect from './SvGridSelect.svelte'

const columns = [
  { field: 'name', header: 'Name' },
  { field: 'email', header: 'Email' },
  { field: 'role', header: 'Role' },
]
const people = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@x.io', role: 'Eng' },
  { id: 2, name: 'Alan Turing', email: 'alan@x.io', role: 'Research' },
  { id: 3, name: 'Grace Hopper', email: 'grace@x.io', role: 'Compilers' },
]

function mountGs(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGridSelect, { target, props: { columns, options: people, ...props } as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

const bodyRows = () => document.body.querySelectorAll<HTMLElement>('.sv-gs__row')

afterEach(() => { document.body.innerHTML = '' })

describe('SvGridSelect', () => {
  it('shows the placeholder when nothing is selected', () => {
    const { target, destroy } = mountGs({ value: null, placeholder: 'Pick a person' })
    try {
      expect(target.querySelector('.sv-gs__value')!.textContent).toBe('Pick a person')
    } finally { destroy() }
  })

  it('shows the selected row label (default = first column)', () => {
    const { target, destroy } = mountGs({ value: 2 })
    try {
      expect(target.querySelector('.sv-gs__value')!.textContent).toBe('Alan Turing')
    } finally { destroy() }
  })

  it('opens a portalled multi-column panel with a header and rows', () => {
    const { target, destroy } = mountGs({ value: null })
    try {
      target.querySelector<HTMLButtonElement>('.sv-gs__trigger')!.click()
      flushSync()
      const heads = [...document.body.querySelectorAll('.sv-gs__hcell')].map((h) => h.textContent)
      expect(heads).toEqual(['Name', 'Email', 'Role'])
      expect(bodyRows()).toHaveLength(3)
    } finally { destroy() }
  })

  it('filters rows via the search box', () => {
    const { target, destroy } = mountGs({ value: null })
    try {
      target.querySelector<HTMLButtonElement>('.sv-gs__trigger')!.click()
      flushSync()
      const search = document.body.querySelector<HTMLInputElement>('.sv-gs__search')!
      search.value = 'turing'
      search.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      expect(bodyRows()).toHaveLength(1)
      expect(bodyRows()[0]!.textContent).toContain('Alan Turing')
    } finally { destroy() }
  })

  it('clicking a row emits (id, row) and closes', () => {
    const onChange = vi.fn()
    const { target, destroy } = mountGs({ value: null, onChange })
    try {
      target.querySelector<HTMLButtonElement>('.sv-gs__trigger')!.click()
      flushSync()
      bodyRows()[2]!.click() // Grace
      flushSync()
      expect(onChange).toHaveBeenCalledWith(3, people[2])
      expect(document.body.querySelector('.sv-gs__panel')).toBeNull()
    } finally { destroy() }
  })

  it('loads remote rows via loadOptions when opened', async () => {
    const loadOptions = vi.fn(async () => [
      { id: 9, name: 'Remote Person', email: 'r@x.io', role: 'Remote' },
    ])
    const { target, destroy } = mountGs({ value: null, loadOptions })
    try {
      target.querySelector<HTMLButtonElement>('.sv-gs__trigger')!.click()
      flushSync()
      expect(loadOptions).toHaveBeenCalledWith('')
      await vi.waitFor(() => {
        flushSync()
        expect([...bodyRows()].map((r) => r.textContent).join()).toContain('Remote Person')
      })
    } finally { destroy() }
  })
})
