/**
 * DOM test: the designer in server mode drives a `createServerRowModel`
 * instead of pivoting in the browser. Rows -> `groupBy`, Columns ->
 * `pivotBy`, Values -> `aggregations`, one reload per applied layout; the
 * embedded grid mounts the model and shows the columns built from the
 * backend's `pivotResultFields`. In deferred mode the wells edit locally and
 * nothing reaches the model until Apply.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import type { ServerRequest } from '@svgrid/grid'
import SvPivotDesigner from './SvPivotDesigner.svelte'
import { setLicenseKey } from './license'
import type { PivotField, PivotLayout } from './pivot-designer'
import type { EntitySchema } from './schema'
import { createInMemoryDataSource } from './sveltekit/in-memory'
import { createServerRowModel } from './server/server-row-model'

type Sale = { id: string; region: string; country: string; year: string; amount: number }

const schema: EntitySchema<Sale> = {
  name: 'sale',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true },
    { field: 'region', type: 'text' },
    { field: 'country', type: 'text' },
    { field: 'year', type: 'text' },
    { field: 'amount', type: 'number' },
  ],
} as EntitySchema<Sale>

const rows: Sale[] = [
  { id: '1', region: 'EMEA', country: 'DE', year: '2024', amount: 100 },
  { id: '2', region: 'EMEA', country: 'DE', year: '2025', amount: 200 },
  { id: '3', region: 'EMEA', country: 'FR', year: '2024', amount: 300 },
  { id: '4', region: 'APAC', country: 'JP', year: '2024', amount: 400 },
  { id: '5', region: 'APAC', country: 'JP', year: '2025', amount: 500 },
]

const fields: PivotField<Sale>[] = [
  { field: 'region', label: 'Region', kind: 'dimension' },
  { field: 'country', label: 'Country', kind: 'dimension' },
  { field: 'year', label: 'Year', kind: 'dimension' },
  { field: 'amount', label: 'Amount', kind: 'measure', defaultAgg: 'sum' },
]

const tick = () => new Promise<void>((r) => setTimeout(r, 0))
const settle = async () => {
  for (let i = 0; i < 4; i += 1) {
    await tick()
    flushSync()
  }
}

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => {
  if (comp) unmount(comp)
  host?.remove()
  comp = null
  host = null
})

function setup(layout: PivotLayout, extra: Record<string, unknown> = {}) {
  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  const source = createInMemoryDataSource(rows, schema)
  const requests: ServerRequest[] = []
  const getRows = source.getRows.bind(source)
  source.getRows = (req) => {
    requests.push(req)
    return getRows(req)
  }
  const server = createServerRowModel<Sale>(source, {})
  host = document.createElement('div')
  document.body.appendChild(host)
  comp = mount(SvPivotDesigner, {
    target: host,
    props: {
      server,
      fields,
      layout,
      flatColumns: [
        { field: 'region', header: 'Region' },
        { field: 'amount', header: 'Amount' },
      ],
      groupColumn: { header: 'Group', leafField: 'country' },
      chartable: false,
      ...extra,
    } as never,
  })
  flushSync()
  return { server, requests, host }
}

const headerTexts = (el: HTMLElement) =>
  [...el.querySelectorAll('thead th')].map((th) => th.textContent!.replace(/\s+/g, ' ').trim()).filter(Boolean)
const rowTexts = (el: HTMLElement) =>
  [...el.querySelectorAll('tbody .sv-grid-row')].map((r) => r.textContent!.replace(/\s+/g, ' ').trim())
const wellChips = (el: HTMLElement, well: string) =>
  [...el.querySelectorAll(`.pvd-well[data-well="${well}"] .pvd-chip`)].map((c) => c.textContent!.replace(/\s+/g, ' ').trim())

describe('SvPivotDesigner server mode (DOM)', () => {
  it('sends the layout to the model as one pivoted request and shows the result columns', async () => {
    const { requests, host } = setup({
      rows: ['region'],
      cols: ['year'],
      values: [{ field: 'amount', agg: 'sum', label: 'Amount' }],
      filters: [],
    })
    await settle()

    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      groupBy: ['region'],
      groupKeys: [],
      pivotBy: ['year'],
      pivotMode: true,
      aggregations: [{ col: 'amount', fn: 'sum' }],
    })
    // The group column, then a header group per year over its value column,
    // then the Total group (row totals are on by default, like the client
    // pivot's grand totals) reading the plain aggregate.
    const headers = headerTexts(host!)
    expect(headers).toContain('Group')
    expect(headers).toContain('2024')
    expect(headers).toContain('2025')
    expect(headers).toContain('Total')
    expect(headers.filter((h) => h === 'sum(amount)')).toHaveLength(3)
    expect(rowTexts(host!)).toEqual(['APAC 400 500 900', 'EMEA 400 200 600'])
  })

  it('shows the plain grouped view with the app columns when pivot mode is off', async () => {
    const { requests, host } = setup(
      { rows: ['region'], cols: ['year'], values: [{ field: 'amount', agg: 'sum', label: 'Amount' }], filters: [] },
      { pivotMode: false },
    )
    await settle()
    expect(requests[0]!.pivotMode).toBeUndefined()
    expect(headerTexts(host!)).toEqual(['Group', 'Region', 'Amount'])
    expect(rowTexts(host!)).toEqual(['APAC APAC 900', 'EMEA EMEA 600'])
  })

  it('reloads once when a well changes, with the new group-by', async () => {
    const { requests, host } = setup({
      rows: ['region'],
      cols: ['year'],
      values: [{ field: 'amount', agg: 'sum', label: 'Amount' }],
      filters: [],
    })
    await settle()
    expect(requests).toHaveLength(1)

    // Remove the Year chip from Columns: the same rows, no pivot.
    host!.querySelector<HTMLButtonElement>('.pvd-well[data-well="cols"] .pvd-chip-x')!.click()
    await settle()
    expect(requests).toHaveLength(2)
    expect(requests[1]!.pivotMode).toBeUndefined()
    expect(rowTexts(host!)).toEqual(['APAC APAC 900', 'EMEA EMEA 600'])
  })

  it('in deferred mode holds edits until Apply and drops them on Cancel', async () => {
    const { requests, host } = setup(
      { rows: ['region'], cols: ['year'], values: [{ field: 'amount', agg: 'sum', label: 'Amount' }], filters: [] },
      { applyMode: 'deferred' },
    )
    await settle()
    expect(requests).toHaveLength(1)
    const apply = () => [...host!.querySelectorAll<HTMLButtonElement>('.pvd-apply button')].find((b) => b.textContent === 'Apply')!
    const cancel = () => [...host!.querySelectorAll<HTMLButtonElement>('.pvd-apply button')].find((b) => b.textContent === 'Cancel')!
    expect(apply().disabled).toBe(true)

    host!.querySelector<HTMLButtonElement>('.pvd-well[data-well="cols"] .pvd-chip-x')!.click()
    await settle()
    // The well shows the edit, the model has not heard of it.
    expect(wellChips(host!, 'cols')).toEqual([])
    expect(requests).toHaveLength(1)
    expect(apply().disabled).toBe(false)

    cancel().click()
    await settle()
    expect(wellChips(host!, 'cols')).toEqual(['Year ×'])
    expect(requests).toHaveLength(1)

    host!.querySelector<HTMLButtonElement>('.pvd-well[data-well="cols"] .pvd-chip-x')!.click()
    await settle()
    apply().click()
    await settle()
    expect(requests).toHaveLength(2)
    expect(requests[1]!.pivotMode).toBeUndefined()
    expect(apply().disabled).toBe(true)
  })
})
