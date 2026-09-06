/**
 * The FREE half of the selection bar: the prop, the normalisation of its three
 * shapes, and what shows when no Enterprise renderer is registered.
 *
 * The bar itself is Pro and lives behind `registerSelectionBarView`, so this
 * suite deliberately never registers one - it asserts the upsell path and the
 * config the renderer would receive. The rendered bar is covered by
 * `selection-bar.dom.test.ts` in @svgrid/enterprise.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  createCoreRowModel,
  hasSelectionBarView,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: number; name: string }
const features = tableFeatures({ rowSortingFeature, rowSelectionFeature })
const rows: Row[] = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Grace' },
]
const cols: ColumnDef<typeof features, Row>[] = [{ field: 'name', header: 'Name', width: 160 }]

const tick = () => new Promise<void>((r) => setTimeout(r))
const UPSELL = '.sv-grid-selection-bar-upsell'

function mountGrid(selectionBar: unknown) {
  return new Promise<{ api: SvGridApi<typeof features, Row>; target: HTMLElement; destroy: () => void }>(
    (res, rej) => {
      const target = document.createElement('div')
      document.body.appendChild(target)
      const app = mount(SvGrid, {
        target,
        props: {
          data: rows,
          columns: cols,
          features,
          _rowModels: { coreRowModel: createCoreRowModel() },
          getRowId: (r: Row) => String(r.id),
          containerHeight: 200,
          virtualization: false,
          showRowSelection: true,
          selectionBar,
          onApiReady(api: SvGridApi<typeof features, Row>) {
            res({ api, target, destroy: () => { unmount(app); target.remove() } })
          },
        } as any,
      })
      queueMicrotask(() => { if (!target.querySelector('[role="grid"]')) rej(new Error('no grid')) })
    },
  )
}

describe('selectionBar - without the Enterprise renderer', () => {
  it('reports that no renderer is registered', () => {
    // If this is ever true here, the suite is testing the Pro path by accident
    // and every assertion below is meaningless.
    expect(hasSelectionBarView()).toBe(false)
  })

  it('shows nothing at all until a row is selected', async () => {
    const { target, destroy } = await mountGrid(true)
    await tick()
    expect(target.querySelector(UPSELL)).toBeNull()
    destroy()
  })

  it('shows the upsell in the bar position once rows are selected', async () => {
    const { api, target, destroy } = await mountGrid(true)
    await tick()
    api.selectRows(['1'])
    await vi.waitFor(() => expect(target.querySelector(UPSELL)).not.toBeNull())

    const note = target.querySelector(UPSELL)!
    expect(note.getAttribute('role')).toBe('note')
    expect(note.textContent).toContain('@svgrid/enterprise')
    expect(note.textContent).toContain('enableSelectionBar()')
    destroy()
  })

  it('says a license is needed, and links to it', async () => {
    // Naming the package is what unblocks a developer trying it; saying a key
    // is needed is what they have to know before shipping. Enterprise is
    // SOFT-gated, so the wording must not imply the feature is inert without
    // one - it says "watermark", which is what actually happens.
    const { api, target, destroy } = await mountGrid(true)
    await tick()
    api.selectRows(['1'])
    await vi.waitFor(() => expect(target.querySelector(UPSELL)).not.toBeNull())

    const license = target.querySelector('.sv-grid-upsell-license')!
    expect(license).not.toBeNull()
    expect(license.textContent).toContain('license key')
    expect(license.textContent).toContain('watermark')

    const link = license.querySelector('a')!
    expect(link.getAttribute('href')).toBe('https://svgrid.com/pricing/')
    // Opening a pricing page must not navigate the host app away.
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')

    destroy()
  })

  it('is localizable, like the rest of the grid chrome', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    let api: SvGridApi<typeof features, Row>
    const app = mount(SvGrid, {
      target,
      props: {
        data: rows,
        columns: cols,
        features,
        _rowModels: { coreRowModel: createCoreRowModel() },
        getRowId: (r: Row) => String(r.id),
        containerHeight: 200,
        virtualization: false,
        showRowSelection: true,
        selectionBar: true,
        localization: { text: { upsellLicense: 'Lizenz erforderlich.' } },
        onApiReady: (a: SvGridApi<typeof features, Row>) => (api = a),
      } as any,
    })
    await tick()
    api!.selectRows(['1'])
    await vi.waitFor(() => {
      expect(target.querySelector('.sv-grid-upsell-license')?.textContent).toContain(
        'Lizenz erforderlich.',
      )
    })
    unmount(app)
    target.remove()
  })

  it('places the upsell on the edge the real bar would use', async () => {
    // So installing enterprise does not move the thing the user was looking at.
    const { api, target, destroy } = await mountGrid({ position: 'top', actions: [] })
    await tick()
    api.selectRows(['1'])
    await vi.waitFor(() => expect(target.querySelector(UPSELL)).not.toBeNull())
    expect(target.querySelector(UPSELL)!.getAttribute('data-position')).toBe('top')
    destroy()
  })

  it('stays out of the way entirely when the prop is unset or false', async () => {
    for (const prop of [undefined, false]) {
      const { api, target, destroy } = await mountGrid(prop)
      await tick()
      api.selectRows(['1'])
      await tick()
      await tick()
      expect(target.querySelector(UPSELL), `selectionBar={${String(prop)}}`).toBeNull()
      destroy()
    }
  })
})

describe('selectionBar - the three prop shapes all reach the renderer', () => {
  // Each shape has to produce a bar. What lands ON it is asserted against the
  // real renderer in the enterprise suite; here the question is only whether
  // the prop was understood at all.
  const shapes: Array<[string, unknown]> = [
    ['true', true],
    ['an action array', [{ key: 'k', label: 'K', action: () => {} }]],
    ['a config object', { position: 'bottom', actions: [], maxVisible: 2 }],
    ['a config object with no actions', { position: 'top' }],
  ]

  for (const [name, prop] of shapes) {
    it(`understands ${name}`, async () => {
      const { api, target, destroy } = await mountGrid(prop)
      await tick()
      api.selectRows(['1'])
      await vi.waitFor(() => expect(target.querySelector(UPSELL)).not.toBeNull())
      destroy()
    })
  }
})
