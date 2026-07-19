/**
 * The repo's first runtime (DOM) test: mount SvGridEditPanel in jsdom and assert
 * it renders the *rich* editor suite (not bare native inputs) and round-trips a
 * row's values - the path that was previously only compile-checked. Enabled by
 * the svelte plugin in vite.config.ts.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvGridEditPanel from './SvGridEditPanel.svelte'
import type { EntitySchema } from './schema'

type Customer = { id: string; name: string; mrr: number; active: boolean; tier: string }

const schema: EntitySchema<Customer> = {
  name: 'customers',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'mrr', type: 'number' },
    { field: 'active', type: 'boolean' },
    { field: 'tier', type: 'enum', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] },
  ],
}

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null

afterEach(() => {
  if (comp) { unmount(comp); comp = null }
  if (host) { host.remove(); host = null }
})

function render(props: Record<string, unknown>): HTMLElement {
  host = document.createElement('div')
  document.body.appendChild(host)
  comp = mount(SvGridEditPanel, { target: host, props })
  flushSync()
  return host
}

describe('SvGridEditPanel (DOM)', () => {
  it('mounts and renders each field with its rich editor, seeded from the row', () => {
    const el = render({
      schema,
      row: { id: '1', name: 'Ada', mrr: 1200, active: true, tier: 'pro' },
      presentation: 'inline',
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    })

    // Field labels are present.
    expect(el.textContent).toContain('Name')
    expect(el.textContent).toContain('Mrr')

    // number -> SvNumberInput (its .sv-num__input), not a bare <input type="number">.
    const numInput = el.querySelector<HTMLInputElement>('.sv-num__input')
    expect(numInput).toBeTruthy()
    expect(numInput!.value).toBe('1200') // seeded from the row

    // boolean -> SvSwitchButton, on because active === true.
    const sw = el.querySelector('.sv-switch')
    expect(sw).toBeTruthy()
    expect(sw!.classList.contains('is-on')).toBe(true)

    // The primary action reads "Save" in edit mode.
    const submit = el.querySelector<HTMLButtonElement>('button[type="submit"]')
    expect(submit?.textContent?.trim()).toBe('Save')
  })

  it('is in create mode with no row (empty number, switch off, "Create" button)', () => {
    const el = render({ schema, presentation: 'inline', onSubmit: vi.fn(), onCancel: vi.fn() })
    expect(el.querySelector<HTMLInputElement>('.sv-num__input')!.value).toBe('') // empty, not "0"
    expect(el.querySelector('.sv-switch')!.classList.contains('is-on')).toBe(false)
    expect(el.querySelector('button[type="submit"]')?.textContent?.trim()).toBe('Create')
  })
})
