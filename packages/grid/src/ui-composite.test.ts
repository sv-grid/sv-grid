/** Group F (tabs / tree / form) component tests. */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvTabs from './SvTabs.svelte'
import SvTree from './SvTree.svelte'
import SvForm from './SvForm.svelte'

function mnt(Comp: any, props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Comp, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

describe('SvTabs', () => {
  const tabs = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C', disabled: true }]
  it('selects on click and arrow-navigates skipping disabled', () => {
    let got = ''
    const { target, destroy } = mnt(SvTabs, { tabs, value: 'a', onChange: (id: string) => (got = id) })
    try {
      const els = target.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      expect(els[0]!.getAttribute('aria-selected')).toBe('true')
      els[1]!.click(); flushSync()
      expect(got).toBe('b')
      // ArrowRight from b wraps past disabled c back to a
      els[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      flushSync()
      expect(got).toBe('a')
    } finally { destroy() }
  })
})

describe('SvTree', () => {
  const nodes = [
    { id: '1', label: 'Root', children: [
      { id: '1a', label: 'Child A' },
      { id: '1b', label: 'Child B', children: [{ id: '1b1', label: 'Leaf' }] },
    ] },
    { id: '2', label: 'Sibling' },
  ]
  it('expands to reveal children and selects', () => {
    let sel = ''
    const { target, destroy } = mnt(SvTree, { nodes, expandedIds: ['1'], onSelect: (id: string) => (sel = id) })
    try {
      // Root expanded -> shows 1, 1a, 1b, 2 (1b collapsed)
      expect(target.querySelectorAll('[role="treeitem"]').length).toBe(4)
      const childA = Array.from(target.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((r) => r.textContent?.includes('Child A'))!
      childA.click(); flushSync()
      expect(sel).toBe('1a')
    } finally { destroy() }
  })
  it('cascading checkbox checks all descendants', () => {
    let checked: string[] = []
    const { target, destroy } = mnt(SvTree, { nodes, expandedIds: ['1', '1b'], checkable: true, checked, onCheck: (ids: string[]) => (checked = ids) })
    try {
      const rootCheck = target.querySelector<HTMLButtonElement>('.sv-tree__check')!
      rootCheck.click(); flushSync()
      // Root + all descendants: 1,1a,1b,1b1
      expect(new Set(checked)).toEqual(new Set(['1', '1a', '1b', '1b1']))
    } finally { destroy() }
  })
})

describe('SvForm', () => {
  const fields = [
    { name: 'name', label: 'Name', required: true },
    { name: 'age', label: 'Age', type: 'number' as const },
  ]
  it('blocks submit and shows errors when required is empty', () => {
    let submitted: any = null
    const { target, destroy } = mnt(SvForm, { fields, onSubmit: (v: any) => (submitted = v) })
    try {
      target.querySelector<HTMLFormElement>('.sv-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      flushSync()
      expect(submitted).toBeNull()
      expect(target.querySelector('.sv-form__error')!.textContent).toContain('required')
    } finally { destroy() }
  })
  it('submits values when valid', () => {
    let submitted: any = null
    const { target, destroy } = mnt(SvForm, { fields, initial: { name: 'Ada' }, onSubmit: (v: any) => (submitted = v) })
    try {
      target.querySelector<HTMLFormElement>('.sv-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      flushSync()
      expect(submitted).toEqual({ name: 'Ada' })
    } finally { destroy() }
  })
})
