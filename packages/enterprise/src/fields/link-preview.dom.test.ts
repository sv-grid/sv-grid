/**
 * The card a linked record shows on hover: its first four fields that have a
 * value, so empty early fields do not leave it short.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import LinkPreview from './LinkPreview.svelte'
import { registerLinkedTable } from './sources.svelte'

let forget = () => {}
const mounted: Array<() => void> = []
afterEach(() => {
  while (mounted.length) mounted.pop()!()
  forget()
})

describe('link preview', () => {
  it('shows the first four fields with a value, past empty ones', () => {
    forget = registerLinkedTable({
      id: 'preview-people',
      name: 'People',
      primaryField: 'name',
      rows: [{ id: 'p1', name: 'Maya', phone: '', email: '', city: 'Oslo', role: 'Lead', team: 'Core', level: 'Senior', notes: 'Hidden' }],
      fields: ['name', 'phone', 'email', 'city', 'role', 'team', 'level', 'notes'].map((field) => ({ field, header: field })),
    })
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(LinkPreview as any, { target, props: { request: { ctrl: null, table: 'preview-people', rowId: 'p1', x: 10, y: 10 } } })
    mounted.push(() => {
      unmount(app)
      target.remove()
    })
    flushSync()
    const labels = [...document.querySelectorAll('.sv-flpv-label')].map((el) => el.textContent)
    expect(labels).toEqual(['city', 'role', 'team', 'level'])
    expect(document.querySelector('.sv-flpv-title')?.textContent).toBe('Maya')
  })
})
