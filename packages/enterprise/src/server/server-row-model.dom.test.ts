/**
 * `<SvGrid rowModel={createServerRowModel(...)} />` end to end: the grid
 * reports its viewport, the model fetches, group rows render through
 * `SvGroupCell`, a click on the expander drills in, the children show as
 * skeletons and then as rows, and the treegrid keyboard works - with nothing
 * wired by hand beyond the one prop.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { SvGrid, renderComponent, type ColumnDef, type ServerDataSource, type SvGridApi } from '@svgrid/grid'
import { setLicenseKey } from '../license'
import { enableSelectionBar } from '../selection-bar'
import { createServerRowModel, type ServerRowModelGridRow } from './server-row-model'
import SvGroupCell from './SvGroupCell.svelte'

type Sale = { region: string; country: string; rep: string; amount: number }

const SALES: Sale[] = []
for (const [region, countries] of Object.entries({ EMEA: ['DE', 'FR'], APAC: ['JP'] })) {
  for (const country of countries) {
    for (let i = 0; i < 12; i += 1) SALES.push({ region, country, rep: `rep${i}`, amount: 10 + i })
  }
}

/** The documented grouping contract, answered after a tick so loading shows. */
function source(delayMs = 0): ServerDataSource<Sale> & { calls: number } {
  const src = {
    calls: 0,
    async getRows(req: Parameters<ServerDataSource<Sale>['getRows']>[0]) {
      src.calls += 1
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
      const groupBy = req.groupBy ?? []
      const keys = req.groupKeys ?? []
      const scoped = SALES.filter((r) =>
        keys.every((k, i) => String((r as Record<string, unknown>)[groupBy[i]!]) === k),
      )
      if (keys.length < groupBy.length) {
        const field = groupBy[keys.length]!
        const buckets = new Map<string, number>()
        for (const r of scoped) {
          const k = String((r as Record<string, unknown>)[field])
          buckets.set(k, (buckets.get(k) ?? 0) + r.amount)
        }
        const rows = [...buckets].map(([k, amount]) => ({ [field]: k, amount }) as unknown as Sale)
        return { rows: rows.slice(req.startRow, req.endRow), rowCount: rows.length }
      }
      return { rows: scoped.slice(req.startRow, req.endRow), rowCount: scoped.length }
    },
  }
  return src
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0))
const settle = async () => {
  for (let i = 0; i < 3; i += 1) await tick()
  flushSync()
}

let host: HTMLElement | null = null
let app: ReturnType<typeof mount> | null = null
afterEach(() => {
  if (app) unmount(app)
  host?.remove()
  app = null
  host = null
})

function mountGrid(delayMs = 0) {
  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  const src = source(delayMs)
  const ctl = createServerRowModel<Sale>(src, {
    groupBy: ['region', 'country'],
    aggregations: [{ col: 'amount', fn: 'sum' }],
    onChange: () => {},
  })
  type Row = ServerRowModelGridRow<Sale>
  const columns: ColumnDef<any, Row>[] = [
    {
      field: 'region',
      header: 'Group',
      width: 220,
      cell: (ctx) =>
        renderComponent(SvGroupCell, {
          row: ctx.row.original as never,
          onToggle: () => ctl.group!.onToggle(ctx.row.original),
          leafField: 'rep',
        }),
    },
    { field: 'amount', header: 'Amount', width: 100 },
  ]
  host = document.createElement('div')
  document.body.appendChild(host)
  let api: SvGridApi<any, Row> | null = null
  app = mount(SvGrid, {
    target: host,
    props: {
      rowModel: ctl,
      columns,
      containerHeight: 400,
      virtualization: false,
      onApiReady: (a: SvGridApi<any, Row>) => (api = a),
    } as never,
  })
  ctl.refresh()
  return { ctl, src, host, api: () => api! }
}

const rowTexts = (el: HTMLElement) =>
  [...el.querySelectorAll('tbody .sv-grid-row')].map((r) => r.textContent!.replace(/\s+/g, ' ').trim())

describe('SvGrid + createServerRowModel', () => {
  it('renders the top level and drills in on the expander click', async () => {
    const { ctl, host } = mountGrid()
    await settle()

    expect(rowTexts(host!)).toEqual(['EMEA 372', 'APAC 186'])

    host!.querySelector<HTMLButtonElement>('button.sv-group-cell')!.click()
    await settle()

    expect(rowTexts(host!)).toEqual(['EMEA 372', 'DE 186', 'FR 186', 'APAC 186'])
    expect(ctl.isExpanded(['EMEA'])).toBe(true)
  })

  it('shows skeleton rows for a level while its first block is in flight', async () => {
    const { host } = mountGrid(30)
    await settle()
    await new Promise((r) => setTimeout(r, 60))
    flushSync()
    expect(rowTexts(host!)).toEqual(['EMEA 372', 'APAC 186'])

    host!.querySelector<HTMLButtonElement>('button.sv-group-cell')!.click()
    flushSync()
    await tick()
    flushSync()
    // Three placeholder rows under EMEA, drawn by the grid as skeletons.
    const placeholders = host!.querySelectorAll('.sv-grid-placeholder-row')
    expect(placeholders.length).toBe(3)
    expect(host!.querySelectorAll('.sv-grid-placeholder-skeleton').length).toBeGreaterThan(0)

    await new Promise((r) => setTimeout(r, 60))
    flushSync()
    expect(host!.querySelectorAll('.sv-grid-placeholder-row').length).toBe(0)
    expect(rowTexts(host!)).toEqual(['EMEA 372', 'DE 186', 'FR 186', 'APAC 186'])
  })

  it('drills to the leaves and shows the leaf field', async () => {
    const { ctl, host } = mountGrid()
    await settle()
    ctl.expandGroup(['EMEA'])
    await settle()
    ctl.expandGroup(['EMEA', 'DE'])
    await settle()

    const texts = rowTexts(host!)
    expect(texts.slice(0, 4)).toEqual(['EMEA 372', 'DE 186', 'rep0 10', 'rep1 11'])
    expect(texts).toHaveLength(2 + 2 + 12)
  })

  it('takes the treegrid role and expands with ArrowRight', async () => {
    const { ctl, host, api } = mountGrid()
    await settle()
    const root = host!.querySelector<HTMLElement>('[role="treegrid"]')!
    expect(root).not.toBeNull()

    api().setActiveCell(0, 0)
    flushSync()
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await settle()
    expect(ctl.isExpanded(['EMEA'])).toBe(true)

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    await settle()
    expect(ctl.isExpanded(['EMEA'])).toBe(false)
  })

  it('reports the grid rows through GridRowModel, with stable ids', async () => {
    const { ctl } = mountGrid()
    await settle()
    const rows = ctl.getRows()
    expect(rows.map((r, i) => ctl.getRowId!(r, i))).toEqual(['["EMEA"]', '["APAC"]'])
    vi.restoreAllMocks()
  })
})

describe('SvGrid + createServerRowModel selection', () => {
  function mountSelectable() {
    setLicenseKey('SVENTERPRISE-DEV-LOCAL')
    enableSelectionBar()
    const src = source()
    const ctl = createServerRowModel<Sale>(src, {
      groupBy: ['region'],
      getRowId: (r) => `${r.country}-${r.rep}`,
      selection: {},
      onChange: () => {},
    })
    const columns: ColumnDef<any, ServerRowModelGridRow<Sale>>[] = [
      { field: 'region', header: 'Region', width: 160 },
      { field: 'amount', header: 'Amount', width: 100 },
    ]
    host = document.createElement('div')
    document.body.appendChild(host)
    app = mount(SvGrid, {
      target: host,
      props: {
        rowModel: ctl,
        columns,
        containerHeight: 400,
        virtualization: false,
        showRowSelection: true,
        selectionBar: true,
      } as never,
    })
    ctl.refresh()
    return { ctl, host }
  }

  const headerBox = (el: HTMLElement) =>
    el.querySelector<HTMLElement>('thead [role="checkbox"], thead input[type="checkbox"]')!

  it('the header checkbox and the bar count follow the rule, not the loaded rows', async () => {
    const { ctl, host } = mountSelectable()
    await settle()
    expect(headerBox(host!).getAttribute('aria-checked')).toBe('false')

    // Tick the header: every row, loaded or not, is selected.
    headerBox(host!).click()
    await settle()
    expect(headerBox(host!).getAttribute('aria-checked')).toBe('true')
    expect(ctl.getSelectionState()).toEqual({ selectAll: true, toggled: [] })
    // Two region rows loaded; the rule says "all 2" - and would say a million
    // for a million-row table without loading one of them.
    expect(host!.querySelector('.sv-selbar-chip')!.textContent).toBe('2')

    // Untick one row: an exception under select-all.
    const rowBox = host!.querySelector<HTMLElement>('tbody [role="checkbox"], tbody input[type="checkbox"]')!
    rowBox.click()
    await settle()
    expect(headerBox(host!).getAttribute('aria-checked')).toBe('mixed')
    expect(ctl.getSelectionState()).toEqual({ selectAll: true, toggled: ['EMEA'] })
    expect(host!.querySelector('.sv-selbar-chip')!.textContent).toBe('1')
  })
})
