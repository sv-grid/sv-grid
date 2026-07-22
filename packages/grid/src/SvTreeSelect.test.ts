/**
 * Component tests for SvTreeSelect: trigger label/path, portalled tree panel,
 * expand-on-parent-click, select-on-leaf-click (emits + closes).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvTreeSelect from './SvTreeSelect.svelte'
import type { TreeSelectNode } from './ui-app.types'

const tree: TreeSelectNode[] = [
  { value: 'asia', label: 'Asia', children: [
    { value: 'jp', label: 'Japan' },
    { value: 'cn', label: 'China' },
  ] },
  { value: 'eu', label: 'Europe', children: [{ value: 'fr', label: 'France' }] },
]

function mountTs(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvTreeSelect, { target, props: { nodes: tree, ...props } as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

const panelRows = () => document.body.querySelectorAll<HTMLElement>('.sv-ts__row')
const rowLabels = () =>
  [...panelRows()].map((r) => r.querySelector('.sv-ts__label')!.textContent!.trim())

afterEach(() => { document.body.innerHTML = '' })

describe('SvTreeSelect', () => {
  it('shows the placeholder when nothing is selected', () => {
    const { target, destroy } = mountTs({ value: null, placeholder: 'Pick a place' })
    try {
      expect(target.querySelector('.sv-ts__value')!.textContent).toBe('Pick a place')
    } finally { destroy() }
  })

  it('shows the selected node label (or path)', () => {
    const path = mountTs({ value: 'jp', expandedIds: ['asia'], showPath: true })
    try {
      expect(path.target.querySelector('.sv-ts__value')!.textContent).toBe('Asia / Japan')
    } finally { path.destroy() }

    const leaf = mountTs({ value: 'jp' })
    try {
      expect(leaf.target.querySelector('.sv-ts__value')!.textContent).toBe('Japan')
    } finally { leaf.destroy() }
  })

  it('opens a portalled tree showing only roots initially', () => {
    const { target, destroy } = mountTs({ value: null })
    try {
      target.querySelector<HTMLButtonElement>('.sv-ts__trigger')!.click()
      flushSync()
      expect(rowLabels()).toEqual(['Asia', 'Europe'])
    } finally { destroy() }
  })

  it('clicking a parent expands it without selecting', () => {
    const onChange = vi.fn()
    const { target, destroy } = mountTs({ value: null, onChange })
    try {
      target.querySelector<HTMLButtonElement>('.sv-ts__trigger')!.click()
      flushSync()
      panelRows()[0]!.click() // Asia
      flushSync()
      expect(rowLabels()).toEqual(['Asia', 'Japan', 'China', 'Europe'])
      expect(onChange).not.toHaveBeenCalled()
    } finally { destroy() }
  })

  it('clicking a leaf emits its value and closes', () => {
    const onChange = vi.fn()
    const { target, destroy } = mountTs({ value: null, expandedIds: ['asia'], onChange })
    try {
      target.querySelector<HTMLButtonElement>('.sv-ts__trigger')!.click()
      flushSync()
      const china = [...panelRows()].find((r) => r.textContent!.includes('China'))!
      china.click()
      flushSync()
      expect(onChange).toHaveBeenCalledWith('cn')
      expect(document.body.querySelector('.sv-ts__panel')).toBeNull()
    } finally { destroy() }
  })
})
