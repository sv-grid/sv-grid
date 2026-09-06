/**
 * The element's contract with @svgrid/enterprise, as promised to non-Svelte
 * hosts in docs/help/web-components/enterprise.md.
 *
 * That page tells a React / Vue / Angular reader that export, import, print,
 * pivot and the license key are reachable with no Svelte in their build. Each
 * of those claims is a subpath export plus a function that has to accept the
 * api the element hands out through `apiready`. Nothing else in the repo would
 * notice if one of them moved: `tools/docs-snippets.test.ts` only compiles
 * ts / tsx / svelte fences, and that page is deliberately written in plain JS
 * because its readers have no TypeScript-Svelte toolchain.
 *
 * The main entry (installEnterprise / board / scheduler) is deliberately NOT
 * covered here: it imports .svelte components, so it needs a Svelte-aware
 * bundler, which is exactly what the page says. Testing it would need this
 * suite to compile Svelte, which the published-artifact setup does not.
 *
 * Enterprise is a sibling package that grid-wc does not depend on - the same
 * position a host app is in - so its build output is read by path, and the
 * suite skips when it has not been built.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const entRoot = join(here, '..', '..', 'enterprise')
const entDist = join(entRoot, 'dist')
const built = existsSync(join(entDist, 'export.js'))

class ResizeObserverShim {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(async () => {
  // @ts-expect-error - test shim, as in element.test.ts
  globalThis.ResizeObserver ??= ResizeObserverShim
  await import('../dist/sv-grid-element.js')
})

/** Mount the element and hand back its api, the way a host gets one. */
async function mountAndGetApi() {
  const el = document.createElement('sv-grid') as HTMLElement & {
    data?: unknown
    columns?: unknown
    api?: Record<string, any>
  }
  el.columns = [
    { field: 'region', header: 'Region' },
    { field: 'status', header: 'Status' },
    { field: 'total', header: 'Total' },
  ]
  el.data = [
    { region: 'AMER', status: 'paid', total: 100 },
    { region: 'EMEA', status: 'open', total: 200 },
    { region: 'AMER', status: 'open', total: 300 },
  ]
  document.body.appendChild(el)
  await new Promise((r) => setTimeout(r, 80))
  return el.api!
}

describe.skipIf(!built)('enterprise interop from a non-Svelte host', () => {
  it('publishes the subpaths the docs send hosts to', () => {
    const pkg = JSON.parse(readFileSync(join(entRoot, 'package.json'), 'utf8'))
    // Each of these is named in docs/help/web-components/enterprise.md. A
    // subpath that stops being exported breaks that page silently.
    for (const sub of ['./export', './import', './print', './pivot', './license']) {
      expect(pkg.exports[sub], `@svgrid/enterprise exports ${sub}`).toBeTruthy()
    }
  })

  it('hands the api out through the element', async () => {
    const api = await mountAndGetApi()
    expect(api).toBeTruthy()
    expect(api.getData()).toHaveLength(3)
  })

  it('exports xlsx from the element api with no Svelte compiler present', async () => {
    const api = await mountAndGetApi()
    const { exportGrid } = (await import('../../enterprise/dist/export.js')) as any

    const res = await exportGrid(api, { format: 'xlsx', download: false })
    expect(res.filename).toBe('grid.xlsx')
    expect(res.mime).toContain('spreadsheetml')
    // A real workbook, not an empty shell.
    expect(res.blob.size).toBeGreaterThan(1000)
  })

  it('imports delimited text through the element api', async () => {
    const api = await mountAndGetApi()
    const { importData } = (await import('../../enterprise/dist/import.js')) as any

    const res = await importData(api, {
      file: 'region,status,total\nAPAC,paid,400',
      format: 'csv',
    })
    expect(res.rows).toHaveLength(1)
  })

  it('builds a pivot model from the element rows', async () => {
    const api = await mountAndGetApi()
    const { createPivotModel } = (await import('../../enterprise/dist/pivot.js')) as any

    const model = createPivotModel(api.getData(), {
      rows: ['region'],
      cols: ['status'],
      values: [{ field: 'total', agg: 'sum' }],
    })
    expect(model.rows.length).toBeGreaterThan(0)
    expect(model.columns.length).toBeGreaterThan(0)
  })

  it('exposes print without pulling a Svelte component', async () => {
    const { printGrid } = (await import('../../enterprise/dist/print.js')) as any
    expect(typeof printGrid).toBe('function')
  })

  it('lets a host set a license key', async () => {
    const lic = (await import('../../enterprise/dist/license.js')) as any
    lic.setLicenseKey('SVENTERPRISE-DEV-TEST')
    expect(lic.isLicenseKeySet()).toBe(true)
    lic.clearLicenseKey()
  })
})
