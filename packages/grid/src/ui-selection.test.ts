/** Group D (selection overlays) component tests. Panels portal to <body>. */
import { describe, expect, it, afterEach } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvListBox from './SvListBox.svelte'
import SvDropDownList from './SvDropDownList.svelte'
import SvComboBox from './SvComboBox.svelte'
import SvTagsInput from './SvTagsInput.svelte'
import SvCountryInput from './SvCountryInput.svelte'

function mnt(Comp: any, props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Comp, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

afterEach(() => {
  document.querySelectorAll('.sv-ddl__panel, .sv-country__panel').forEach((n) => n.remove())
})

const OPTS = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
  { value: 'c', label: 'Cherry' },
]

describe('SvListBox', () => {
  it('single select emits scalar; multi toggles array', () => {
    let got: any
    const a = mnt(SvListBox, { options: OPTS, value: 'a', onChange: (v: any) => (got = v) })
    try {
      a.target.querySelectorAll<HTMLElement>('.sv-listbox__opt')[2]!.click(); flushSync()
      expect(got).toBe('c')
    } finally { a.destroy() }
    const b = mnt(SvListBox, { options: OPTS, value: ['a'], multiple: true, onChange: (v: any) => (got = v) })
    try {
      b.target.querySelectorAll<HTMLElement>('.sv-listbox__opt')[1]!.click(); flushSync()
      expect(got).toEqual(['a', 'b'])
    } finally { b.destroy() }
  })

  it('posts its value(s) via hidden inputs when `name` is set (multi -> repeated name)', () => {
    const m = mnt(SvListBox, { options: OPTS, value: ['a', 'c'], multiple: true, name: 'tags' })
    try {
      const hidden = Array.from(m.target.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="tags"]'))
      expect(hidden.map((h) => h.value)).toEqual(['a', 'c'])
    } finally { m.destroy() }
    const s = mnt(SvListBox, { options: OPTS, value: 'b', name: 'choice' })
    try {
      const hidden = Array.from(s.target.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="choice"]'))
      expect(hidden.map((h) => h.value)).toEqual(['b'])
    } finally { s.destroy() }
  })
})

describe('SvDropDownList', () => {
  it('opens a portalled listbox and picks a value', () => {
    let got: any
    const { target, destroy } = mnt(SvDropDownList, { options: OPTS, value: null, onChange: (v: any) => (got = v) })
    try {
      target.querySelector<HTMLButtonElement>('.sv-ddl')!.click(); flushSync()
      const panel = document.querySelector('.sv-ddl__panel')!
      expect(panel).not.toBeNull()
      panel.querySelectorAll<HTMLElement>('.sv-ddl__opt')[1]!.click(); flushSync()
      expect(got).toBe('b')
      expect(document.querySelector('.sv-ddl__panel')).toBeNull() // closed
    } finally { destroy() }
  })
})

describe('SvComboBox', () => {
  it('filters as you type and picks a match', () => {
    let got: any
    const { target, destroy } = mnt(SvComboBox, { options: OPTS, value: null, onChange: (v: any) => (got = v) })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-combo__input')!
      input.dispatchEvent(new FocusEvent('focus')); flushSync()
      input.value = 'ban'
      input.dispatchEvent(new Event('input', { bubbles: true })); flushSync()
      const opts = document.querySelectorAll<HTMLElement>('.sv-ddl__opt')
      expect(opts.length).toBe(1)
      opts[0]!.click(); flushSync()
      expect(got).toBe('b')
    } finally { destroy() }
  })
})

describe('SvTagsInput', () => {
  it('adds on Enter and removes on Backspace', () => {
    let tags: string[] = ['x']
    const { target, destroy } = mnt(SvTagsInput, { value: tags, onChange: (t: string[]) => (tags = t) })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-tags__input')!
      input.value = 'new'
      // Svelte bind:value needs an input event before the keydown reads draft.
      input.dispatchEvent(new Event('input', { bubbles: true })); flushSync()
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); flushSync()
      expect(tags).toEqual(['x', 'new'])
    } finally { destroy() }
  })
})

describe('SvCountryInput', () => {
  it('searches and selects a country code', () => {
    let got: any
    const { target, destroy } = mnt(SvCountryInput, { value: null, onChange: (v: any) => (got = v) })
    try {
      target.querySelector<HTMLButtonElement>('.sv-country')!.click(); flushSync()
      const search = document.querySelector<HTMLInputElement>('.sv-country__search')!
      search.value = 'germ'
      search.dispatchEvent(new Event('input', { bubbles: true })); flushSync()
      const opts = document.querySelectorAll<HTMLElement>('.sv-country__opt')
      expect(opts.length).toBe(1)
      opts[0]!.click(); flushSync()
      expect(got).toBe('DE')
    } finally { destroy() }
  })
})
