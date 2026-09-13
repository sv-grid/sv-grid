/**
 * QA sweep: what `enableAdvancedFilter()` (run by `installEnterprise`) turns on.
 *
 * The community grid stores an advanced-filter expression but cannot evaluate
 * one - `isAdvancedFilterActive()` stays false and no rows drop. Registering the
 * enterprise compiler is what makes the expression bite, so these cases check
 * the seam between the two packages rather than the expression language itself.
 */
import { describe, expect, it } from 'vitest'
import type { GridPredicateExpr } from '@svgrid/grid'
import { flush, mountProGrid, qaRows } from './harness.svelte'

const equalsEmea: GridPredicateExpr = {
  kind: 'cmp',
  column: 'region',
  op: 'equals',
  value: 'EMEA',
}

describe('QA enterprise: the advanced filter', () => {
  it('is active once enterprise is installed', async () => {
    const { pro } = await mountProGrid()
    pro.setAdvancedFilter(equalsEmea)
    await flush()
    expect(pro.isAdvancedFilterActive()).toBe(true)
  })

  it('drops the rows the expression excludes', async () => {
    const { pro } = await mountProGrid()
    pro.setAdvancedFilter(equalsEmea)
    await flush()
    expect(pro.getDisplayedRows().map((row) => row.region)).toEqual(['EMEA', 'EMEA'])
  })

  it('composes with and / or / not', async () => {
    const { pro } = await mountProGrid()
    pro.setAdvancedFilter({
      kind: 'and',
      parts: [
        { kind: 'cmp', column: 'product', op: 'equals', value: 'Widget' },
        { kind: 'not', expr: { kind: 'cmp', column: 'region', op: 'equals', value: 'APAC' } },
      ],
    })
    await flush()
    expect(pro.getDisplayedRows().map((row) => row.region)).toEqual(['EMEA', 'NA'])

    pro.setAdvancedFilter({
      kind: 'or',
      parts: [
        { kind: 'cmp', column: 'region', op: 'equals', value: 'APAC' },
        { kind: 'cmp', column: 'region', op: 'equals', value: 'NA' },
      ],
    })
    await flush()
    expect(pro.getDisplayedRows()).toHaveLength(3)
  })

  it('composes with the ordinary column filters, not instead of them', async () => {
    const { pro } = await mountProGrid()
    pro.setAdvancedFilter({ kind: 'cmp', column: 'product', op: 'equals', value: 'Widget' })
    pro.setFilter('region', { operator: 'equals', value: 'NA' })
    await flush()
    expect(pro.getDisplayedRows().map((row) => row.id)).toEqual([3])
  })

  it('clears back to every row, and clearAllFilters takes it with the rest', async () => {
    const { pro } = await mountProGrid()
    pro.setAdvancedFilter(equalsEmea)
    await flush()
    pro.clearAdvancedFilter()
    await flush()
    expect(pro.getAdvancedFilter()).toBeNull()
    expect(pro.getDisplayedRows()).toHaveLength(qaRows.length)

    pro.setAdvancedFilter(equalsEmea)
    pro.setFilter('product', { operator: 'equals', value: 'Widget' })
    await flush()
    pro.clearAllFilters()
    await flush()
    expect(pro.getAdvancedFilter()).toBeNull()
    expect(pro.getFilters()).toEqual({})
    expect(pro.getDisplayedRows()).toHaveLength(qaRows.length)
  })

  it('round-trips through getState / setState with the rest of the view', async () => {
    const first = await mountProGrid()
    first.pro.setAdvancedFilter(equalsEmea)
    await flush()
    const saved = JSON.parse(JSON.stringify(first.pro.getState()))
    expect(saved.advancedFilter).toEqual(equalsEmea)

    const second = await mountProGrid()
    second.pro.setState(saved)
    await flush()
    expect(second.pro.getAdvancedFilter()).toEqual(equalsEmea)
    expect(second.pro.getDisplayedRows()).toHaveLength(2)
  })
})
