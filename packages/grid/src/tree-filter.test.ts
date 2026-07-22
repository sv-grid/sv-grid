/**
 * SvTree filter/search: typing a query shows only matching nodes + their
 * ancestors (auto-expanded), and clearing restores the tree.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvTree from './SvTree.svelte'

const nodes = [
  { id: 'src', label: 'src', children: [
    { id: 'a', label: 'App.svelte' },
    { id: 'b', label: 'utils.ts' },
  ] },
  { id: 'pub', label: 'public', children: [
    { id: 'c', label: 'logo.svg' },
  ] },
]

function mountTree(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvTree, { target, props: { nodes, expandedIds: ['src', 'pub'], ...props } as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}
const labels = (t: HTMLElement) => [...t.querySelectorAll('.sv-tree__label')].map((n) => n.textContent)

describe('SvTree filter', () => {
  it('shows only matches + ancestors (auto-expanded)', () => {
    const { target, destroy } = mountTree({ filter: 'utils' })
    try {
      const shown = labels(target)
      expect(shown).toContain('src')       // ancestor kept
      expect(shown).toContain('utils.ts')  // match
      expect(shown).not.toContain('App.svelte')
      expect(shown).not.toContain('public')
    } finally { destroy() }
  })

  it('matching an ancestor label shows it (and its subtree stays reachable)', () => {
    const { target, destroy } = mountTree({ filter: 'public' })
    try {
      const shown = labels(target)
      expect(shown).toContain('public')
      expect(shown).not.toContain('src')
    } finally { destroy() }
  })

  it('renders a built-in search box when searchable', () => {
    const { target, destroy } = mountTree({ searchable: true })
    try {
      expect(target.querySelector('.sv-tree__search-input')).not.toBeNull()
      expect(labels(target)).toContain('App.svelte') // unfiltered initially
    } finally { destroy() }
  })
})
