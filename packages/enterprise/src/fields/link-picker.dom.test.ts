/**
 * The link picker: its search box names the table, search reads the table's
 * text fields as well as its primary field, and a list cut short says so.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import LinkPickerEditor from './LinkPickerEditor.svelte'
import { registerLinkedTable } from './sources.svelte'

const accounts = Array.from({ length: 1240 }, (_, i) => ({
  id: `a${i + 1}`,
  name: `Account ${i + 1}`,
  email: i === 6 ? 'maya@northwind.example.com' : `team${i + 1}@example.com`,
  revenue: 1000 * i,
}))
registerLinkedTable({
  id: 'picker-accounts',
  name: 'Accounts',
  primaryField: 'name',
  rows: () => accounts,
  fields: [
    { field: 'name', header: 'Name' },
    { field: 'email', header: 'Email', fieldType: 'email' },
    { field: 'revenue', header: 'Revenue', fieldType: 'number' },
  ],
})

const mounted: Array<() => void> = []
afterEach(() => {
  while (mounted.length) mounted.pop()!()
})

function openPicker() {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(LinkPickerEditor as any, {
    target,
    props: { value: [], columnDef: { fieldType: 'link', fieldProps: { table: 'picker-accounts' } }, onCommit: () => {}, onCancel: () => {} },
  })
  flushSync()
  mounted.push(() => {
    unmount(app)
    target.remove()
  })
  const search = document.querySelector('.sv-flp-search') as HTMLInputElement
  const type = (text: string) => {
    search.value = text
    search.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()
  }
  const rows = () => [...document.querySelectorAll('.sv-flp-row')].map((r) => r.textContent?.replace(/\s+/g, ' ').trim())
  const more = () => document.querySelector('.sv-flp-more')?.textContent?.trim() ?? null
  return { search, type, rows, more }
}

describe('link picker', () => {
  it('names the table in its search box', () => {
    const p = openPicker()
    expect(p.search.placeholder).toBe('Search Accounts')
    expect(p.search.getAttribute('aria-label')).toBe('Search Accounts')
  })

  it('says how many records match when it shows only the first 200', () => {
    const p = openPicker()
    expect(p.rows()).toHaveLength(200)
    expect(p.more()).toBe(`Showing 200 of ${(1240).toLocaleString()}. Type to narrow.`)
    // "Account 12" matches 12, 120 to 129 and 1200 to 1240.
    p.type('Account 12')
    expect(p.rows()).toHaveLength(1 + 10 + 41)
    expect(p.more()).toBeNull()
  })

  it('matches the text fields of the linked table too, and says where', () => {
    const p = openPicker()
    p.type('northwind')
    expect(p.rows()).toEqual(['Account 7 Email: maya@northwind.example.com'])
    // A number field is not searched.
    p.type('6000')
    expect(p.rows()).toEqual([])
  })
})
