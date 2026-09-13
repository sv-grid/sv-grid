/**
 * QA sweep: `installEnterprise` - what it adds, what it returns, and what it
 * registers as a side effect.
 */
import { describe, expect, it } from 'vitest'
import { installEnterprise } from '../install'
import { flush, mountProGrid, qaRows } from './harness.svelte'

const INSTANCE_MEMBERS = ['exportData', 'copyExport', 'print', 'importData', 'ai', 'pivot']
const AI_MEMBERS = [
  'filter',
  'smartFill',
  'summarize',
  'classify',
  'export',
  'findAnomalies',
  'chart',
]
const PIVOT_MEMBERS = ['build', 'buildFrom']

describe('QA enterprise: installEnterprise', () => {
  it('adds every documented member to the api', async () => {
    const { pro } = await mountProGrid()
    for (const member of INSTANCE_MEMBERS) {
      expect(pro[member as keyof typeof pro], member).toBeDefined()
    }
    for (const member of AI_MEMBERS) {
      expect(typeof pro.ai[member as keyof typeof pro.ai], `ai.${member}`).toBe('function')
    }
    for (const member of PIVOT_MEMBERS) {
      expect(typeof pro.pivot[member as keyof typeof pro.pivot], `pivot.${member}`).toBe(
        'function',
      )
    }
  })

  it('mutates and returns the SAME object, so existing references keep working', async () => {
    const { pro, api } = await mountProGrid()
    expect(pro).toBe(api)
    // A reference captured before the install sees the new methods too.
    expect(typeof (api as unknown as Record<string, unknown>).exportData).toBe('function')
  })

  it('leaves the community surface intact', async () => {
    const { pro } = await mountProGrid()
    expect(pro.getData()).toHaveLength(qaRows.length)
    pro.setSort('amount', 'desc')
    await flush()
    expect(pro.getDisplayedRows()[0]!.amount).toBe(2400)
    expect(typeof pro.exportCsv).toBe('function')
  })

  it('is idempotent - installing twice is harmless', async () => {
    const { pro } = await mountProGrid()
    const first = pro.exportData
    const again = installEnterprise(pro)
    expect(again).toBe(pro)
    expect(typeof again.exportData).toBe('function')
    // A fresh closure over the same api is fine; what matters is it still works.
    expect(typeof first).toBe('function')
    expect(await again.exportData({ format: 'csv', filename: 'twice' })).toBeDefined()
  })

  it('registers the enterprise view renderers, so the props stop rendering upsells', async () => {
    // `board` / `scheduler` / `pivot` are community props whose renderers ship
    // in this package; the install is what registers them.
    const { target } = await mountProGrid({ board: { groupBy: 'region' } })
    await flush()
    expect(target.querySelector('.sv-grid-board-root')).not.toBeNull()
    expect(target.querySelector('.sv-grid-scheduler-upsell')).toBeNull()
  })
})
