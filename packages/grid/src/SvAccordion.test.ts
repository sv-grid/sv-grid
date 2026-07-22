/**
 * Component tests for SvAccordion: single vs multiple expand, ARIA wiring
 * (aria-expanded / aria-controls / region), and toggle behavior.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import { createRawSnippet } from 'svelte'
import SvAccordion from './SvAccordion.svelte'

const items = [
  { id: 'a', label: 'First' },
  { id: 'b', label: 'Second' },
  { id: 'c', label: 'Third' },
]

// A trivial panel snippet so the body renders.
const panel = createRawSnippet((item: () => { id: string; label: string }) => ({
  render: () => `<p>body-${item().id}</p>`,
}))

function mountAcc(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvAccordion, { target, props: { panel, ...props } as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

describe('SvAccordion', () => {
  it('renders headers with aria-expanded + aria-controls and shows only the open panel', () => {
    const { target, destroy } = mountAcc({ items, expanded: ['a'] })
    try {
      const headers = [...target.querySelectorAll<HTMLButtonElement>('.sv-acc__header')]
      expect(headers).toHaveLength(3)
      expect(headers[0].getAttribute('aria-expanded')).toBe('true')
      expect(headers[1].getAttribute('aria-expanded')).toBe('false')
      const region = target.querySelector<HTMLElement>('.sv-acc__panel')!
      expect(region.getAttribute('role')).toBe('region')
      expect(region.getAttribute('aria-labelledby')).toBe(headers[0].id)
      // Only one panel region is rendered (the open one).
      expect(target.querySelectorAll('.sv-acc__panel')).toHaveLength(1)
    } finally { destroy() }
  })

  it('single mode: opening one closes the previous', () => {
    let got: string[] | undefined
    const { target, destroy } = mountAcc({ items, expanded: ['a'], expandMode: 'single', onChange: (ids: string[]) => (got = ids) })
    try {
      const headers = target.querySelectorAll<HTMLButtonElement>('.sv-acc__header')
      headers[1].click()
      flushSync()
      expect(got).toEqual(['b'])
    } finally { destroy() }
  })

  it('multiple mode: toggling accumulates open panels', () => {
    let got: string[] | undefined
    const { target, destroy } = mountAcc({ items, expanded: ['a'], expandMode: 'multiple', onChange: (ids: string[]) => (got = ids) })
    try {
      const headers = target.querySelectorAll<HTMLButtonElement>('.sv-acc__header')
      headers[2].click()
      flushSync()
      expect(got).toEqual(['a', 'c'])
    } finally { destroy() }
  })
})
