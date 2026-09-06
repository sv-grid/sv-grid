/**
 * The bulk-action bar (`selectionBar`) - Pro renderer.
 *
 * Mounts a real `<SvGrid>` and drives the selection through the public api,
 * because the whole feature is "what appears when rows are selected". A unit
 * test of the component alone would assert the part that was never in doubt.
 *
 * The upsell path - what the FREE grid shows when nothing is registered -
 * cannot be covered here: `enableSelectionBar()` is module-global and this
 * file needs it on. It is covered in the grid package's own suite.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import { SvGrid } from '@svgrid/grid'
import type { SelectionBarAction } from '@svgrid/grid'
import { enableSelectionBar } from './selection-bar'

enableSelectionBar()

// jsdom lacks ResizeObserver, which the grid's own size-observer effect uses on
// mount. The grid's suite polyfills it in test-setup.ts; the enterprise dom
// project has no shared setup, so stub it here - same as board.dom.test.ts.
if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

type Row = { id: number; name: string; status: string }
const rows: Row[] = [
  { id: 1, name: 'Ada', status: 'open' },
  { id: 2, name: 'Grace', status: 'done' },
  { id: 3, name: 'Linus', status: 'open' },
]
const cols = [
  { field: 'name', header: 'Name', width: 160 },
  { field: 'status', header: 'Status', width: 120 },
]

const tick = () => new Promise<void>((r) => setTimeout(r))
const BAR = '.sv-selbar'

function mountGrid(selectionBar: unknown) {
  return new Promise<{ api: any; target: HTMLElement; destroy: () => void }>((res, rej) => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvGrid as any, {
      target,
      props: {
        data: rows,
        columns: cols,
        getRowId: (r: Row) => String(r.id),
        rowHeight: 32,
        containerHeight: 240,
        virtualization: false,
        showRowSelection: true,
        selectionBar,
        onApiReady(api: any) {
          res({ api, target, destroy: () => { unmount(app); target.remove() } })
        },
      } as any,
    })
    queueMicrotask(() => { if (!target.querySelector('[role="grid"]')) rej(new Error('no grid')) })
  })
}

async function select(target: HTMLElement, api: any, ids: string[]) {
  api.selectRows(ids)
  await vi.waitFor(() => expect(target.querySelector(BAR)).not.toBeNull())
  return target.querySelector(BAR) as HTMLElement
}

const labels = (bar: HTMLElement) =>
  [...bar.querySelectorAll('.sv-selbar-btn:not(.sv-selbar-more-btn)')].map((b) =>
    (b.textContent ?? '').trim(),
  )

describe('selectionBar - when it exists', () => {
  it('stays absent while nothing is selected', async () => {
    const { target, destroy } = await mountGrid(true)
    await tick()
    expect(target.querySelector(BAR)).toBeNull()
    destroy()
  })

  it('appears on the first selected row and leaves when cleared', async () => {
    const { api, target, destroy } = await mountGrid(true)
    await tick()
    await select(target, api, ['1'])
    api.selectRows([])
    await vi.waitFor(() => expect(target.querySelector(BAR)).toBeNull())
    destroy()
  })

  it('never appears when the prop is unset or false', async () => {
    for (const prop of [undefined, false]) {
      const { api, target, destroy } = await mountGrid(prop)
      await tick()
      api.selectRows(['1', '2'])
      await tick()
      await tick()
      expect(target.querySelector(BAR), `selectionBar={${String(prop)}}`).toBeNull()
      destroy()
    }
  })

  it('renders inside the grid root, so it is positioned against the grid', async () => {
    const { api, target, destroy } = await mountGrid(true)
    await tick()
    const bar = await select(target, api, ['1'])
    expect(bar.closest('.sv-grid-root')).not.toBeNull()
    destroy()
  })
})

describe('selectionBar - position', () => {
  it('floats at the bottom by default', async () => {
    const { api, target, destroy } = await mountGrid(true)
    await tick()
    const bar = await select(target, api, ['1'])
    expect(bar.getAttribute('data-position')).toBe('bottom')
    destroy()
  })

  it('moves to the top when asked', async () => {
    const { api, target, destroy } = await mountGrid({ position: 'top', actions: [] })
    await tick()
    const bar = await select(target, api, ['1'])
    expect(bar.getAttribute('data-position')).toBe('top')
    destroy()
  })

  it('opens its overflow menu away from the edge it is pinned to', async () => {
    // A bottom bar must open upward or the menu falls off the grid.
    const many: SelectionBarAction<Row>[] = Array.from({ length: 6 }, (_, i) => ({
      key: `a${i}`,
      label: `A${i}`,
      action: vi.fn(),
    }))
    for (const position of ['bottom', 'top'] as const) {
      const { api, target, destroy } = await mountGrid({ position, actions: many, maxVisible: 2 })
      await tick()
      const bar = await select(target, api, ['1'])
      ;(bar.querySelector('.sv-selbar-more-btn') as HTMLButtonElement).click()
      await vi.waitFor(() => expect(bar.querySelector('.sv-selbar-menu')).not.toBeNull())
      expect(bar.querySelector('.sv-selbar-menu')!.getAttribute('data-position')).toBe(position)
      destroy()
    }
  })
})

describe('selectionBar - the count', () => {
  it('reports the selection size and follows it', async () => {
    const { api, target, destroy } = await mountGrid(true)
    await tick()
    const bar = await select(target, api, ['1'])
    const chip = () => bar.querySelector('.sv-selbar-chip')!.textContent!.trim()
    const label = () => bar.querySelector('.sv-selbar-count-label')!.textContent!.trim()

    // The number lives in its own chip: it is what a user checks before
    // pressing something destructive, so it does not blend into a sentence.
    expect(chip()).toBe('1')
    expect(label()).toBe('selected')
    api.selectRows(['1', '2', '3'])
    await vi.waitFor(() => expect(chip()).toBe('3'))

    destroy()
  })

  it('is localizable like every other string', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    let api: any
    const app = mount(SvGrid as any, {
      target,
      props: {
        data: rows,
        columns: cols,
        getRowId: (r: Row) => String(r.id),
        virtualization: false,
        containerHeight: 240,
        showRowSelection: true,
        selectionBar: true,
        localization: { text: { selectionBarCount: 'ausgewahlt' } },
        onApiReady: (a: any) => (api = a),
      } as any,
    })
    await tick()
    api.selectRows(['1', '2'])
    await vi.waitFor(() => {
      expect(target.querySelector('.sv-selbar-chip')?.textContent?.trim()).toBe('2')
      expect(target.querySelector('.sv-selbar-count-label')?.textContent?.trim()).toBe('ausgewahlt')
    })
    unmount(app)
    target.remove()
  })
})

describe('selectionBar - actions', () => {
  const actions: SelectionBarAction<Row>[] = [
    { key: 'archive', label: 'Archive', action: vi.fn() },
    { key: 'delete', label: 'Delete', danger: true, action: vi.fn() },
  ]

  it('accepts the array shorthand and renders one button each, plus Clear', async () => {
    const { api, target, destroy } = await mountGrid(actions)
    await tick()
    const bar = await select(target, api, ['1'])
    expect(labels(bar)).toEqual(['Archive', 'Delete'])
    expect(bar.querySelector('.sv-selbar-clear')).not.toBeNull()
    destroy()
  })

  it('hands the action the selected rows and ids, in display order', async () => {
    const seen: Array<{ rows: Row[]; ids: string[] }> = []
    const { api, target, destroy } = await mountGrid([
      { key: 'go', label: 'Go', action: (t: any) => seen.push(t) },
    ])
    await tick()
    // Selected out of order on purpose - the bar reports display order.
    const bar = await select(target, api, ['3', '1'])
    ;(bar.querySelector('.sv-selbar-btn') as HTMLButtonElement).click()

    expect(seen).toHaveLength(1)
    expect(seen[0]!.ids).toEqual(['1', '3'])
    expect(seen[0]!.rows.map((r) => r.name)).toEqual(['Ada', 'Linus'])
    destroy()
  })

  it('marks danger actions so they can be styled apart', async () => {
    const { api, target, destroy } = await mountGrid(actions)
    await tick()
    const bar = await select(target, api, ['1'])
    const danger = bar.querySelectorAll('.sv-selbar-btn.is-danger')
    expect(danger).toHaveLength(1)
    expect(danger[0]!.textContent!.trim()).toBe('Delete')
    destroy()
  })

  it('draws an icon when the action carries one', async () => {
    const { api, target, destroy } = await mountGrid([
      { key: 'i', label: 'With icon', icon: 'M5 12h14', action: vi.fn() },
    ])
    await tick()
    const bar = await select(target, api, ['1'])
    expect(bar.querySelector('.sv-selbar-btn svg path')?.getAttribute('d')).toBe('M5 12h14')
    destroy()
  })

  it('disables a button whose predicate rejects the current selection', async () => {
    const { api, target, destroy } = await mountGrid([
      {
        key: 'close',
        label: 'Close',
        disabled: (t: any) => t.rows.some((r: Row) => r.status !== 'done'),
        action: vi.fn(),
      },
    ])
    await tick()
    const bar = await select(target, api, ['1'])
    const btn = () => bar.querySelector('.sv-selbar-btn') as HTMLButtonElement

    expect(btn().disabled).toBe(true)
    api.selectRows(['2'])
    await vi.waitFor(() => expect(btn().disabled).toBe(false))
    destroy()
  })

  it('re-evaluates hidden against the live selection, not just first paint', async () => {
    const { api, target, destroy } = await mountGrid([
      { key: 'single', label: 'Open', hidden: (t: any) => t.ids.length !== 1, action: vi.fn() },
    ])
    await tick()
    const bar = await select(target, api, ['1'])
    expect(labels(bar)).toEqual(['Open'])

    api.selectRows(['1', '2'])
    await vi.waitFor(() => expect(labels(bar)).toEqual([]))
    destroy()
  })
})

describe('selectionBar - overflow', () => {
  const six: SelectionBarAction<Row>[] = Array.from({ length: 6 }, (_, i) => ({
    key: `a${i}`,
    label: `Action ${i}`,
    action: vi.fn(),
  }))

  it('keeps six on the bar and folds the rest into a menu', async () => {
    const eight: SelectionBarAction<Row>[] = Array.from({ length: 8 }, (_, i) => ({
      key: `b${i}`,
      label: `Action ${i}`,
      action: vi.fn(),
    }))
    const { api, target, destroy } = await mountGrid(eight)
    await tick()
    const bar = await select(target, api, ['1'])

    expect(labels(bar)).toEqual([
      'Action 0', 'Action 1', 'Action 2', 'Action 3', 'Action 4', 'Action 5',
    ])
    expect(bar.querySelector('.sv-selbar-more-btn')).not.toBeNull()
    // Closed until asked for.
    expect(bar.querySelector('.sv-selbar-menu')).toBeNull()

    ;(bar.querySelector('.sv-selbar-more-btn') as HTMLButtonElement).click()
    await vi.waitFor(() => expect(bar.querySelector('.sv-selbar-menu')).not.toBeNull())
    const items = [...bar.querySelectorAll('.sv-selbar-menu-item')].map((b) =>
      (b.textContent ?? '').trim(),
    )
    expect(items).toEqual(['Action 6', 'Action 7'])
    destroy()
  })

  it('honours maxVisible', async () => {
    const { api, target, destroy } = await mountGrid({ actions: six, maxVisible: 2 })
    await tick()
    const bar = await select(target, api, ['1'])
    expect(labels(bar)).toEqual(['Action 0', 'Action 1'])
    destroy()
  })

  it('shows no overflow button when everything fits', async () => {
    const { api, target, destroy } = await mountGrid(six)
    await tick()
    const bar = await select(target, api, ['1'])
    expect(bar.querySelector('.sv-selbar-more-btn')).toBeNull()
    destroy()
  })

  it('runs an overflow action and closes the menu', async () => {
    const ran = vi.fn()
    const { api, target, destroy } = await mountGrid({
      maxVisible: 2,
      actions: [...six.slice(0, 2), { key: 'deep', label: 'Deep', action: ran }],
    })
    await tick()
    const bar = await select(target, api, ['1'])
    ;(bar.querySelector('.sv-selbar-more-btn') as HTMLButtonElement).click()
    await vi.waitFor(() => expect(bar.querySelector('.sv-selbar-menu')).not.toBeNull())
    ;(bar.querySelector('.sv-selbar-menu-item') as HTMLButtonElement).click()

    expect(ran).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(bar.querySelector('.sv-selbar-menu')).toBeNull())
    destroy()
  })
})

describe('selectionBar - clearing', () => {
  it('the clear button empties the selection and dismisses the bar', async () => {
    const { api, target, destroy } = await mountGrid(true)
    await tick()
    const bar = await select(target, api, ['1', '2'])
    ;(bar.querySelector('.sv-selbar-clear') as HTMLButtonElement).click()

    await vi.waitFor(() => expect(target.querySelector(BAR)).toBeNull())
    expect(api.getSelectedRowIds()).toEqual([])
    destroy()
  })

  it('hideClear drops the button for flows that own dismissal themselves', async () => {
    const { api, target, destroy } = await mountGrid({ hideClear: true, actions: [] })
    await tick()
    const bar = await select(target, api, ['1'])
    expect(bar.querySelector('.sv-selbar-clear')).toBeNull()
    destroy()
  })

  it('Escape clears the selection', async () => {
    const { api, target, destroy } = await mountGrid(true)
    await tick()
    const bar = await select(target, api, ['1'])
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(target.querySelector(BAR)).toBeNull())
    destroy()
  })

  it('Escape closes an open overflow menu FIRST, keeping the selection', async () => {
    const six: SelectionBarAction<Row>[] = Array.from({ length: 6 }, (_, i) => ({
      key: `a${i}`,
      label: `Action ${i}`,
      action: vi.fn(),
    }))
    const { api, target, destroy } = await mountGrid({ actions: six, maxVisible: 2 })
    await tick()
    const bar = await select(target, api, ['1'])
    ;(bar.querySelector('.sv-selbar-more-btn') as HTMLButtonElement).click()
    await vi.waitFor(() => expect(bar.querySelector('.sv-selbar-menu')).not.toBeNull())

    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(bar.querySelector('.sv-selbar-menu')).toBeNull())
    expect(target.querySelector(BAR)).not.toBeNull()
    expect(api.getSelectedRowIds()).toEqual(['1'])
    destroy()
  })
})

describe('selectionBar - accessibility', () => {
  it('is a labelled toolbar with a live count', async () => {
    const { api, target, destroy } = await mountGrid(true)
    await tick()
    const bar = await select(target, api, ['1'])

    expect(bar.getAttribute('role')).toBe('toolbar')
    expect(bar.getAttribute('aria-label')).toBe('Selection actions')
    expect(bar.querySelector('.sv-selbar-count')!.getAttribute('aria-live')).toBe('polite')
    expect(bar.querySelector('.sv-selbar-clear')!.getAttribute('aria-label')).toBe('Clear selection')
    destroy()
  })

  it('arrow keys rove between the buttons, which is what role=toolbar promises', async () => {
    const { api, target, destroy } = await mountGrid([
      { key: 'a', label: 'A', action: vi.fn() },
      { key: 'b', label: 'B', action: vi.fn() },
    ])
    await tick()
    const bar = await select(target, api, ['1'])
    const buttons = [...bar.querySelectorAll('button')] as HTMLButtonElement[]
    buttons[0]!.focus()

    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(buttons[1])

    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(document.activeElement).toBe(buttons[0])

    // Wraps, so the last button is one press from the first.
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(document.activeElement).toBe(buttons[buttons.length - 1])
    destroy()
  })

  it('marks the overflow trigger as a menu button', async () => {
    const six: SelectionBarAction<Row>[] = Array.from({ length: 6 }, (_, i) => ({
      key: `a${i}`,
      label: `Action ${i}`,
      action: vi.fn(),
    }))
    const { api, target, destroy } = await mountGrid({ actions: six, maxVisible: 2 })
    await tick()
    const bar = await select(target, api, ['1'])
    const more = bar.querySelector('.sv-selbar-more-btn')!
    expect(more.getAttribute('aria-haspopup')).toBe('menu')
    expect(more.getAttribute('aria-expanded')).toBe('false')
    ;(more as HTMLButtonElement).click()
    await vi.waitFor(() => expect(more.getAttribute('aria-expanded')).toBe('true'))
    destroy()
  })
})
