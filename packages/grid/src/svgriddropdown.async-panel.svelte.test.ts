/**
 * The dropdown panel's geometry is derived from the option COUNT, and it used
 * to be measured only when the panel opened.
 *
 * With an async `editorOptions` the list is empty at that moment, so the panel
 * was anchored and sized for ZERO options - about 8px tall. The options then
 * arrived and rendered outside that box, unstyled, with the grid rows visible
 * behind them. Reported from demo 428 as a broken editor.
 *
 * jsdom has no layout, so these assert the contract that produces the right
 * geometry: the panel re-measures the trigger whenever the visible option list
 * changes while it is open.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGridDropdown from './SvGridDropdown.svelte'

const tick = () => new Promise<void>((r) => setTimeout(r, 0))
const settle = async () => { for (let i = 0; i < 4; i += 1) await tick() }

let cleanup: (() => void) | null = null
afterEach(() => { cleanup?.(); cleanup = null })

type Opt = { value: string; label: string }
const opts = (...labels: string[]): Opt[] => labels.map((l) => ({ value: l, label: l }))

/** Count trigger measurements, which is how the panel is anchored + sized. */
function trackRectReads(rect?: Partial<DOMRect>) {
  const reads: number[] = []
  const orig = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function () {
    reads.push(1)
    return {
      top: 100, left: 0, width: 160, height: 30,
      bottom: 130, right: 160, x: 0, y: 100, toJSON() {},
      ...rect,
    } as DOMRect
  }
  return { reads, restore: () => { HTMLElement.prototype.getBoundingClientRect = orig } }
}

const panelEl = () => document.querySelector('.sv-grid-dropdown-panel') as HTMLElement

const optionEls = () => document.querySelectorAll('.sv-grid-dropdown-option')
const emptyEl = () => document.querySelector('.sv-grid-dropdown-empty')

describe('dropdown panel with a late-arriving option list', () => {
  it('re-measures the trigger when options land after opening', async () => {
    const t = trackRectReads()
    try {
      const target = document.createElement('div')
      document.body.appendChild(target)
      // Opens with an empty list, exactly like an async source.
      const props = $state({ options: [] as Opt[], value: null, onChange: () => {} })
      const app = mount(SvGridDropdown, { target, props: props as never })
      cleanup = () => { unmount(app); target.remove() }
      await settle()

      expect(optionEls()).toHaveLength(0)
      const afterOpen = t.reads.length
      expect(afterOpen).toBeGreaterThan(0)

      // The request resolves.
      props.options = opts('Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux')
      await settle()

      expect(optionEls()).toHaveLength(5)
      // Sized for an empty list and never re-measured is the bug; the panel has
      // to consult the trigger again once it has real content.
      expect(t.reads.length).toBeGreaterThan(afterOpen)
    } finally {
      t.restore()
    }
  })

  it('re-measures when a search filter shrinks the list', async () => {
    const t = trackRectReads()
    try {
      const target = document.createElement('div')
      document.body.appendChild(target)
      const props = $state({
        options: opts('Paris', 'Lyon', 'Marseille'),
        value: null, searchable: true, onChange: () => {},
      })
      const app = mount(SvGridDropdown, { target, props: props as never })
      cleanup = () => { unmount(app); target.remove() }
      await settle()
      const before = t.reads.length

      const search = document.querySelector('.sv-grid-dropdown-search') as HTMLInputElement
      search.value = 'lyo'
      search.dispatchEvent(new Event('input', { bubbles: true }))
      await settle()

      expect(optionEls()).toHaveLength(1)
      expect(t.reads.length).toBeGreaterThan(before)
    } finally {
      t.restore()
    }
  })

  it('shows Loading rather than "No options" while a list is in flight', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvGridDropdown, {
      target,
      props: { options: [], value: null, loading: true, onChange: () => {} } as never,
    })
    cleanup = () => { unmount(app); target.remove() }
    await settle()
    expect(emptyEl()?.textContent).toContain('Loading')
    // Announced, so a screen reader hears the list arrive.
    expect(emptyEl()?.getAttribute('role')).toBe('status')
  })

  it('still says "No options" when the list is genuinely empty', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvGridDropdown, {
      target,
      props: { options: [], value: null, loading: false, onChange: () => {} } as never,
    })
    cleanup = () => { unmount(app); target.remove() }
    await settle()
    expect(emptyEl()?.textContent).toContain('No options')
  })

  it('is not capped by the row-height estimate when the list fits', async () => {
    // `anchoredRect` clamps its `maxHeight` to our estimate, which assumes a
    // 32px row. Themes with a bigger font render taller rows, so capping the
    // panel at that estimate cut off the last option. A short list must be
    // limited only by the real room available.
    const t = trackRectReads({ top: 100, bottom: 130 })
    try {
      const target = document.createElement('div')
      document.body.appendChild(target)
      const app = mount(SvGridDropdown, {
        target,
        props: { options: opts('FR', 'JP', 'US'), value: null, onChange: () => {} } as never,
      })
      cleanup = () => { unmount(app); target.remove() }
      await settle()

      const max = parseFloat(panelEl().style.maxHeight)
      // The 3-row estimate is 3*32 + 8 = 104. Anything at or under that would
      // clip; the real space below the trigger is far larger.
      expect(max).toBeGreaterThan(104)
    } finally {
      t.restore()
    }
  })

  it('anchors an upward panel by its bottom edge', async () => {
    // Upward panels used to be positioned by `top`, derived from the same
    // estimate. Now that the panel may exceed the estimate, a top-anchored one
    // would grow DOWN over the trigger; bottom-anchoring makes it grow up.
    const t = trackRectReads({ top: 4000, bottom: 4030 })
    try {
      const target = document.createElement('div')
      document.body.appendChild(target)
      const app = mount(SvGridDropdown, {
        target,
        props: {
          options: opts(...Array.from({ length: 12 }, (_, i) => `Opt ${i}`)),
          value: null, onChange: () => {},
        } as never,
      })
      cleanup = () => { unmount(app); target.remove() }
      await settle()

      const el = panelEl()
      expect(el.style.bottom).not.toBe('')
      expect(el.style.top).toBe('')
    } finally {
      t.restore()
    }
  })

  it('swaps Loading for the options once they resolve', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const props = $state({ options: [] as Opt[], value: null, loading: true, onChange: () => {} })
    const app = mount(SvGridDropdown, { target, props: props as never })
    cleanup = () => { unmount(app); target.remove() }
    await settle()
    expect(emptyEl()?.textContent).toContain('Loading')

    props.options = opts('Paris', 'Lyon')
    props.loading = false
    await settle()

    expect(emptyEl()).toBeNull()
    expect(optionEls()).toHaveLength(2)
  })
})
