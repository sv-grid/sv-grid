/**
 * The Server-Side Row Model is soft-gated like the rest of Enterprise: it
 * works without a license key, and says so with the watermark + a one-time
 * console notice.
 *
 * The gate has to fire from the MODEL, not only from `enableServerRowModel()`,
 * because this feature has no renderer to register - an app can import
 * `createServerGroupModel` and never call an `enable*` function, which is
 * exactly the path the scheduler and board cannot take. Without this test the
 * feature would ship ungated for anyone who skips `installEnterprise`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServerDataSource } from '@svgrid/grid'

const WATERMARK_ATTR = 'data-svgrid-enterprise-watermark'

const emptySource: ServerDataSource<{ region: string }> = {
  async getRows() {
    return { rows: [], rowCount: 0 }
  },
}

function makeGridRoot(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'sv-grid-root'
  document.body.appendChild(el)
  return el
}

const watermarks = () => document.querySelectorAll(`[${WATERMARK_ATTR}]`).length

/**
 * `enable.ts` latches after the first call so an app with many models gets one
 * nudge, so each test needs a fresh module graph to observe that first call.
 * The license key and the watermark's own state live in that same graph - a
 * key set on the outer instance is invisible to the reloaded one - so every
 * handle a test touches has to come back from this one import.
 */
let cleanup: (() => void) | null = null
async function freshGraph() {
  vi.resetModules()
  const [{ createServerGroupModel }, license, watermark] = await Promise.all([
    import('./server-group-model'),
    import('../license'),
    import('../watermark'),
  ])
  cleanup = watermark.dismissUnlicensedNudge
  return { create: createServerGroupModel, ...license }
}

describe('server row model soft gate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    // Disconnects the fresh graph's MutationObserver, which would otherwise
    // keep re-attaching a watermark to the next test's grid root.
    cleanup?.()
    cleanup = null
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('watermarks the grid when a model is built with no license key', async () => {
    const { create } = await freshGraph()
    makeGridRoot()

    create(emptySource, { groupBy: ['region'], onChange: () => {} })
    await Promise.resolve() // the watermark attaches on a microtask

    expect(watermarks()).toBe(1)
  })

  it('stays quiet when a license key is set', async () => {
    const { create, setLicenseKey } = await freshGraph()
    setLicenseKey('SVENTERPRISE-DEV-LOCAL')
    makeGridRoot()

    create(emptySource, { groupBy: ['region'], onChange: () => {} })
    await Promise.resolve()

    expect(watermarks()).toBe(0)
  })

  it('nudges once however many models an app builds', async () => {
    const { create } = await freshGraph()
    makeGridRoot()

    create(emptySource, { groupBy: ['region'], onChange: () => {} })
    create(emptySource, { groupBy: ['region'], onChange: () => {} })
    create(emptySource, { groupBy: ['region'], onChange: () => {} })
    await Promise.resolve()

    expect(watermarks()).toBe(1)
  })

  it('still builds a working model when unlicensed - nothing is withheld', async () => {
    // Real timers here: with no grid root in the DOM the watermark falls back
    // to a fixed-position one, and its fade-out timer re-triggers the observer
    // that placed it, which `runAllTimers` treats as an infinite loop.
    vi.useRealTimers()
    const { create } = await freshGraph()
    const rows = [{ region: 'EMEA' }, { region: 'APAC' }]
    const seen: string[][] = []
    const ctl = create(
      {
        async getRows() {
          return { rows, rowCount: rows.length }
        },
      },
      {
        groupBy: ['region'],
        onChange: (s) => seen.push(s.displayRows.map((r) => r.id)),
      },
    )
    ctl.refresh()
    for (let i = 0; i < 20; i += 1) await Promise.resolve()

    expect(seen.at(-1)).toEqual(['["EMEA"]', '["APAC"]'])
    ctl.dispose()
  })
})
