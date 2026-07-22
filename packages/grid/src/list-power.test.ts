/**
 * Tests for the list "power" features: option grouping (preserving flat index),
 * type-ahead matching, and their wiring into SvListBox (group headings render;
 * typing a prefix moves the active option).
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvListBox from './SvListBox.svelte'
import { groupOptions, hasGroups, nextTypeaheadIndex } from './list-option'

const opts = [
  { value: 'us', label: 'United States', group: 'Americas' },
  { value: 'ca', label: 'Canada', group: 'Americas' },
  { value: 'fr', label: 'France', group: 'Europe' },
  { value: 'de', label: 'Germany', group: 'Europe' },
]

describe('groupOptions', () => {
  it('buckets by group in first-seen order and preserves the flat index', () => {
    const groups = groupOptions(opts)
    expect(groups.map((g) => g.group)).toEqual(['Americas', 'Europe'])
    expect(groups[0].options.map((o) => o.index)).toEqual([0, 1])
    expect(groups[1].options.map((o) => o.index)).toEqual([2, 3])
    expect(hasGroups(opts)).toBe(true)
  })
  it('returns a single null group when nothing is grouped', () => {
    const flat = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]
    expect(groupOptions(flat)).toEqual([{ group: null, options: [{ value: 'a', label: 'A', index: 0 }, { value: 'b', label: 'B', index: 1 }] }])
    expect(hasGroups(flat)).toBe(false)
  })
})

describe('nextTypeaheadIndex', () => {
  it('finds the next enabled label-prefix match, wrapping from `from`', () => {
    expect(nextTypeaheadIndex(opts, 'f', -1)).toBe(2)   // France
    expect(nextTypeaheadIndex(opts, 'g', 2)).toBe(3)    // Germany
    expect(nextTypeaheadIndex(opts, 'can', 0)).toBe(1)  // Canada
    expect(nextTypeaheadIndex(opts, 'z', 0)).toBe(-1)   // no match
    expect(nextTypeaheadIndex(opts, '', 0)).toBe(-1)
  })
})

function mountLb(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvListBox, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

describe('SvListBox grouping + type-ahead', () => {
  it('renders group headings above their options', () => {
    const { target, destroy } = mountLb({ options: opts, value: 'us' })
    try {
      const headings = [...target.querySelectorAll('.sv-listbox__group')].map((n) => n.textContent)
      expect(headings).toEqual(['Americas', 'Europe'])
      expect(target.querySelectorAll('.sv-listbox__opt')).toHaveLength(4)
    } finally { destroy() }
  })

  it('type-ahead moves the active option to a label prefix', () => {
    const { target, destroy } = mountLb({ options: opts, value: 'us' })
    try {
      const list = target.querySelector<HTMLElement>('.sv-listbox')!
      list.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }))
      flushSync()
      const active = target.querySelector('.sv-listbox__opt.is-active .sv-listbox__label')!
      expect(active.textContent).toBe('Germany')
    } finally { destroy() }
  })
})
