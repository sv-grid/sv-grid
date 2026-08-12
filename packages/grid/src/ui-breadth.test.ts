/**
 * Tests for the Pillar C breadth components: SvCollapsible (accessible toggle),
 * SvResult (status), SvLoadingOverlay (scrim), and the layout primitives.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvCollapsible from './SvCollapsible.svelte'
import SvResult from './SvResult.svelte'
import SvLoadingOverlay from './SvLoadingOverlay.svelte'
import SvSimpleGrid from './SvSimpleGrid.svelte'
import SvTitle from './SvTitle.svelte'
import SvText from './SvText.svelte'
import SvAnchor from './SvAnchor.svelte'
import SvKbd from './SvKbd.svelte'
import SvCode from './SvCode.svelte'
import SvVisuallyHidden from './SvVisuallyHidden.svelte'

function mnt(Comp: any, props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Comp, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

describe('SvCollapsible', () => {
  it('toggles aria-expanded and wires the region', () => {
    let open: boolean | undefined
    const { target, destroy } = mnt(SvCollapsible, { title: 'More', onOpenChange: (o: boolean) => (open = o) })
    try {
      const trigger = target.querySelector<HTMLButtonElement>('.sv-collapse__trigger')!
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      const region = target.querySelector('.sv-collapse__region')!
      expect(trigger.getAttribute('aria-controls')).toBe(region.id)
      trigger.click(); flushSync()
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      expect(open).toBe(true)
    } finally { destroy() }
  })
  it('disabled does not toggle', () => {
    const { target, destroy } = mnt(SvCollapsible, { title: 'X', disabled: true })
    try {
      const trigger = target.querySelector<HTMLButtonElement>('.sv-collapse__trigger')!
      trigger.click(); flushSync()
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
    } finally { destroy() }
  })
})

describe('SvResult', () => {
  it('renders the status class, title and description', () => {
    const { target, destroy } = mnt(SvResult, { status: 'success', title: 'Done', description: 'All good' })
    try {
      expect(target.querySelector('.sv-result--success')).not.toBeNull()
      expect(target.querySelector('.sv-result__title')?.textContent).toBe('Done')
      expect(target.querySelector('.sv-result__desc')?.textContent).toBe('All good')
    } finally { destroy() }
  })
})

describe('SvLoadingOverlay', () => {
  it('renders only when visible, with a polite status role', () => {
    const hidden = mnt(SvLoadingOverlay, { visible: false })
    try { expect(hidden.target.querySelector('.sv-loading')).toBeNull() } finally { hidden.destroy() }
    const shown = mnt(SvLoadingOverlay, { visible: true, label: 'Saving' })
    try {
      const el = shown.target.querySelector('.sv-loading')!
      expect(el).not.toBeNull()
      expect(el.getAttribute('role')).toBe('status')
      expect(el.getAttribute('aria-label')).toBe('Saving')
    } finally { shown.destroy() }
  })
})

describe('SvSimpleGrid', () => {
  it('uses a fixed column template when cols is set', () => {
    const { target, destroy } = mnt(SvSimpleGrid, { cols: 3 })
    try {
      const el = target.querySelector<HTMLElement>('.sv-simplegrid')!
      expect(el.style.gridTemplateColumns).toContain('repeat(3')
    } finally { destroy() }
  })
})

describe('SvTitle', () => {
  it('renders the heading tag for its order', () => {
    const { target, destroy } = mnt(SvTitle, { order: 3, children: undefined })
    try { expect(target.querySelector('h3')).not.toBeNull() } finally { destroy() }
  })
})

describe('SvText', () => {
  it('applies the line clamp when clamp is set', () => {
    const { target, destroy } = mnt(SvText, { clamp: 2 })
    try {
      const el = target.querySelector<HTMLElement>('.sv-text')!
      expect(el.classList.contains('is-clamp')).toBe(true)
      expect(el.style.getPropertyValue('--sv-text-clamp')).toBe('2')
    } finally { destroy() }
  })
})

describe('SvAnchor', () => {
  it('adds safe rel and target for external links', () => {
    const { target, destroy } = mnt(SvAnchor, { href: 'https://svelte.dev', external: true })
    try {
      const a = target.querySelector('a')!
      expect(a.getAttribute('target')).toBe('_blank')
      expect(a.getAttribute('rel')).toBe('noopener noreferrer')
    } finally { destroy() }
  })
})

describe('SvKbd', () => {
  it('renders one <kbd> per key in a combo', () => {
    const { target, destroy } = mnt(SvKbd, { keys: ['Ctrl', 'K'] })
    try { expect(target.querySelectorAll('kbd').length).toBe(2) } finally { destroy() }
  })
})

describe('SvCode', () => {
  it('renders a <pre> in block mode and inline <code> otherwise', () => {
    const block = mnt(SvCode, { block: true, code: 'a' })
    try { expect(block.target.querySelector('pre.sv-code--block')).not.toBeNull() } finally { block.destroy() }
    const inline = mnt(SvCode, { code: 'a' })
    try {
      expect(inline.target.querySelector('pre')).toBeNull()
      expect(inline.target.querySelector('code.sv-code--inline')).not.toBeNull()
    } finally { inline.destroy() }
  })
})

describe('SvVisuallyHidden', () => {
  it('renders content in an off-screen element', () => {
    const { target, destroy } = mnt(SvVisuallyHidden, { children: undefined })
    try { expect(target.querySelector('.sv-vh')).not.toBeNull() } finally { destroy() }
  })
})
