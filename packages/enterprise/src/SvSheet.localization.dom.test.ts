/**
 * DOM test: `localization` reaches every part of the shell through one
 * prop. A string overridden in `text` shows in the ribbon, the status bar
 * and a dialog; the rest stay English; a part mounted on its own reads the
 * English defaults.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvSheet from './SvSheet.svelte'
import SvSheetListPicker from './SvSheetListPicker.svelte'

for (const name of ['ResizeObserver', 'IntersectionObserver'] as const) {
  if (typeof (globalThis as Record<string, unknown>)[name] === 'undefined') {
    ;(globalThis as Record<string, unknown>)[name] = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return [] }
    }
  }
}
if (typeof HTMLElement.prototype.scrollIntoView !== 'function') HTMLElement.prototype.scrollIntoView = () => {}

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => {
  if (comp) { unmount(comp); comp = null }
  if (host) { host.remove(); host = null }
})

function mountSheet(props: Record<string, unknown> = {}): Promise<HTMLElement> {
  return new Promise((resolve) => {
    host = document.createElement('div')
    document.body.appendChild(host)
    comp = mount(SvSheet, {
      target: host,
      props: {
        data: [{ name: 'Sheet1', cells: [['1', '2'], ['=A1+B1']] }],
        rows: 5,
        columns: 3,
        onReady: () => resolve(host!),
        ...props,
      },
    })
    flushSync()
  })
}

const tabNames = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('.sv-ribbon .tabs [role="tab"]')].map((b) => b.textContent?.trim())

describe('SvSheet localization (DOM)', () => {
  it('English by default: the ribbon tabs, the status bar and the formula bar', async () => {
    const el = await mountSheet()
    expect(tabNames(el)).toContain('Home')
    expect(el.querySelector('.status .mode')?.textContent).toBe('Ready')
    expect(el.querySelector('[aria-label="Name box"]')).not.toBeNull()
  })

  it('text overrides reach the ribbon, the status bar, the formula bar and the tab strip; the rest stay English', async () => {
    const el = await mountSheet({
      localization: {
        locale: 'de-DE',
        text: { 'ribbon.tab.home': 'Start', statusReady: 'Bereit', nameBox: 'Namenfeld', newSheet: 'Neues Blatt' },
      },
    })
    const tabs = tabNames(el)
    expect(tabs).toContain('Start')
    expect(tabs).not.toContain('Home')
    expect(tabs).toContain('Insert')
    expect(el.querySelector('.status .mode')?.textContent).toBe('Bereit')
    expect(el.querySelector('[aria-label="Namenfeld"]')).not.toBeNull()
    expect(el.querySelector('[aria-label="Neues Blatt"]')).not.toBeNull()
    expect(el.querySelector('[aria-label="Formula bar"]')).not.toBeNull()
  })

  it('a part mounted on its own reads the English defaults', () => {
    host = document.createElement('div')
    document.body.appendChild(host)
    comp = mount(SvSheetListPicker, { target: host, props: { choices: [], value: '', onPick: () => {}, onCancel: () => {} } })
    flushSync()
    expect(host.querySelector('[aria-label="Choices"]')).not.toBeNull()
    expect(host.textContent).toContain('The list is empty.')
  })
})
