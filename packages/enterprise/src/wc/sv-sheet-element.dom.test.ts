/**
 * DOM test: <sv-sheet> as a page uses it. Registered on import, mounts the
 * shell on a data property, fires `ready` with the api parked on the host,
 * mirrors the component's methods, and lets an `action` listener take an
 * action over with preventDefault().
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import { tick } from 'svelte'

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

type Sheet = HTMLElement & {
  data?: unknown; rows?: number; api?: unknown; document?: unknown
  getState(): { workbook: { sheets: Array<{ name: string; cells: string[][] }> } }
  act(action: string): void
  toCsv(): string
}

// Importing the element compiles the whole shell, the grid and the chart
// on demand, which is well past the default hook timeout when the rest of
// the suite is transforming at the same time.
beforeAll(async () => {
  await import('./sv-sheet-element.svelte')
}, 120_000)

let el: Sheet | null = null
afterEach(() => { el?.remove(); el = null })

const settle = async () => { await tick(); await new Promise((r) => setTimeout(r, 30)); await tick() }

describe('<sv-sheet>', () => {
  it('registers on import and mounts the shell on a data property', async () => {
    expect(customElements.get('sv-sheet')).toBeTruthy()
    el = document.createElement('sv-sheet') as Sheet
    el.setAttribute('rows', '6')
    el.setAttribute('show-ribbon', '')
    el.data = [{ name: 'Budget', cells: [['Item', 'Amount'], ['Rent', '1200'], ['Total', '=SUM(B2:B2)']] }]
    document.body.appendChild(el)
    await settle()
    expect(el).toBeInstanceOf(customElements.get('sv-sheet')!)
    expect(el.querySelector('.sv-sheet')).not.toBeNull()
    expect(el.querySelector('.sv-ribbon')).not.toBeNull()
    expect(el.api).toBeTruthy()
    expect(el.document).toBeTruthy()
    expect(el.getState().workbook.sheets[0]!.name).toBe('Budget')
    expect(el.toCsv()).toContain('Total,1200')
  })

  it('fires ready and change, and a cancelled action is taken over', async () => {
    el = document.createElement('sv-sheet') as Sheet
    el.data = [{ name: 'S', cells: [['1']] }]
    const seen: string[] = []
    el.addEventListener('ready', (e) => seen.push(`ready:${typeof (e as CustomEvent).detail.api}`))
    el.addEventListener('change', (e) => seen.push(`change:${(e as CustomEvent).detail.map((r: { kind: string }) => r.kind).join(',')}`))
    el.addEventListener('action', (e) => {
      const ev = e as CustomEvent<{ action: string }>
      seen.push(`action:${ev.detail.action}`)
      if (ev.detail.action === 'toggle-gridlines') ev.preventDefault()
    })
    document.body.appendChild(el)
    await settle()
    expect(seen).toContain('ready:object')
    // Taken over: the shell's own gridlines toggle does not run, so the class does not change.
    const had = el.querySelector('.sv-sheet')!.classList.contains('no-gridlines')
    el.act('toggle-gridlines')
    await settle()
    expect(seen).toContain('action:toggle-gridlines')
    expect(el.querySelector('.sv-sheet')!.classList.contains('no-gridlines')).toBe(had)
    // Not taken over: the headings toggle goes through.
    const hadHeadings = el.querySelector('.sv-sheet')!.classList.contains('no-headings')
    el.act('toggle-headings')
    await settle()
    expect(seen).toContain('action:toggle-headings')
    expect(el.querySelector('.sv-sheet')!.classList.contains('no-headings')).toBe(!hadHeadings)
    ;(el.api as { getCommandContext(): { setCellValue(r: number, c: number, v: string): void } }).getCommandContext().setCellValue(1, 0, '2')
    await settle()
    expect(seen.some((s) => s.startsWith('change:cells'))).toBe(true)
  })
})
