/**
 * Component tests for SvNavPane: sections + items render with selection, and the
 * bottom module strip splits into full rows + an icon rail that the resize
 * splitter (keyboard) adjusts.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvNavPane, { type NavSection, type NavModule } from './SvNavPane.svelte'

const sections: NavSection[] = [
  { id: 's1', label: 'Favorites', items: [
    { id: 'inbox', label: 'Inbox', badge: 3 },
    { id: 'sent', label: 'Sent' },
  ] },
]
const modules: NavModule[] = [
  { id: 'mail', label: 'Mail' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'people', label: 'People' },
  { id: 'tasks', label: 'Tasks' },
]

function mountNav(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvNavPane, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

describe('SvNavPane', () => {
  it('renders sections + items, highlights the selected, shows badges', () => {
    const { target, destroy } = mountNav({ sections, value: 'inbox' })
    try {
      expect(target.querySelector('nav')!.getAttribute('aria-label')).toBe('Navigation')
      const active = target.querySelector<HTMLElement>('.sv-nav__item.is-active')!
      expect(active.textContent).toContain('Inbox')
      expect(active.getAttribute('aria-current')).toBe('page')
      expect(target.querySelector('.sv-nav__badge')!.textContent).toBe('3')
    } finally { destroy() }
  })

  it('splits modules into full rows + an icon rail per moduleRows', () => {
    const { target, destroy } = mountNav({ sections, modules, moduleRows: 2, height: 400 })
    try {
      expect(target.querySelectorAll('.sv-nav__mod').length).toBe(2) // full rows
      const rail = target.querySelector('.sv-nav__mrail')!
      expect(rail.querySelectorAll('.sv-nav__modicon').length).toBe(2) // remaining as icons
    } finally { destroy() }
  })

  // Outlook direction: the strip grows upward, so ArrowUp adds a full row and
  // ArrowDown collapses one back into the icon rail (see onSplitMove).
  it('the resize splitter (ArrowDown) collapses one module row into the rail', () => {
    const { target, destroy } = mountNav({
      sections, modules, moduleRows: 3, height: 400,
      // bindable moduleRows reported via a spy is awkward; assert DOM instead.
    })
    try {
      expect(target.querySelectorAll('.sv-nav__mod').length).toBe(3)
      const split = target.querySelector<HTMLElement>('.sv-nav__msplit')!
      expect(split.getAttribute('role')).toBe('separator')
      expect(split.getAttribute('aria-valuenow')).toBe('3')
      split.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      flushSync()
      expect(target.querySelectorAll('.sv-nav__mod').length).toBe(2)
      expect(target.querySelector('.sv-nav__msplit')!.getAttribute('aria-valuenow')).toBe('2')
    } finally { destroy() }
  })

  it('the resize splitter (ArrowUp) promotes a rail icon back to a full row', () => {
    const { target, destroy } = mountNav({ sections, modules, moduleRows: 3, height: 400 })
    try {
      const split = target.querySelector<HTMLElement>('.sv-nav__msplit')!
      split.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
      flushSync()
      expect(target.querySelectorAll('.sv-nav__mod').length).toBe(4)
      expect(target.querySelector('.sv-nav__mrail')).toBeNull() // rail drops out when empty
    } finally { destroy() }
  })
})
