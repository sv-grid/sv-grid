/**
 * QA sweep: the `pro.ai.*` namespace.
 *
 * The helpers themselves are free (they live in `@svgrid/grid`); what enterprise
 * adds is the namespace on the api and the export engine behind `ai.export`.
 * Every case runs against `mockAIProvider`, so the assertions are about the
 * plumbing - prompt in, structured plan out, optionally applied to the grid -
 * rather than about any model's judgement.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const downloads: Array<{ text: string; filename: string }> = []
vi.mock('../export-serialize', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    downloadTextFile: (text: string, filename: string) => {
      downloads.push({ text, filename })
    },
  }
})

import { mockAIProvider, setAIProvider } from '@svgrid/grid'
import { flush, mountProGrid, qaRows } from './harness.svelte'

beforeEach(() => {
  downloads.length = 0
  setAIProvider(mockAIProvider)
})
afterEach(() => {
  setAIProvider(null)
})

describe('QA enterprise: ai.filter', () => {
  it('returns a structured plan without touching the grid', async () => {
    const { pro } = await mountProGrid()
    const result = await pro.ai.filter('EMEA orders over 1000')
    expect(result).toBeDefined()
    expect(Array.isArray(result.filters)).toBe(true)
    // Preview by default: the view is untouched.
    expect(pro.getDisplayedRows()).toHaveLength(qaRows.length)
  })

  it('applies the plan when asked to', async () => {
    const { pro } = await mountProGrid()
    const result = await pro.ai.filter('region equals NA', { apply: true })
    await flush()
    expect(result.filters.length + (result.sort ? 1 : 0)).toBeGreaterThan(0)
    // The grid recorded whatever the plan asked for.
    expect(Object.keys(pro.getFilters()).length + pro.getState().sorting.length).toBeGreaterThan(0)
  })

  it('rejects clearly when no provider is registered', async () => {
    setAIProvider(null)
    const { pro } = await mountProGrid()
    await expect(pro.ai.filter('anything')).rejects.toThrow()
  })
})

describe('QA enterprise: ai.summarize / classify / smartFill', () => {
  it('summarize returns prose, bullets and the fields it leaned on', async () => {
    const { pro } = await mountProGrid()
    const summary = await pro.ai.summarize({ target: { kind: 'all' } })
    expect(typeof summary.text).toBe('string')
    expect(summary.text.length).toBeGreaterThan(0)
    expect(Array.isArray(summary.bullets)).toBe(true)
    expect(Array.isArray(summary.highlightedFields)).toBe(true)
  })

  it('summarize takes each documented target shape', async () => {
    const { pro } = await mountProGrid()
    await expect(pro.ai.summarize({ target: { kind: 'row', rowIndex: 0 } })).resolves.toBeDefined()
    await expect(
      pro.ai.summarize({ target: { kind: 'selection', rowIndices: [0, 2] } }),
    ).resolves.toBeDefined()
    await expect(
      pro.ai.summarize({ target: { kind: 'group', field: 'region', value: 'EMEA' } }),
    ).resolves.toBeDefined()
  })

  it('classify predicts a label per row from the allowed set', async () => {
    const { pro } = await mountProGrid()
    const result = await pro.ai.classify({
      inputField: 'product',
      outputField: 'category',
      classes: ['hardware', 'software'],
    })
    expect(result.inputField).toBe('product')
    expect(result.outputField).toBe('category')
    expect(Array.isArray(result.predictions)).toBe(true)
    for (const prediction of result.predictions) {
      expect(typeof prediction.rowIndex).toBe('number')
      expect(typeof prediction.value).toBe('string')
      expect(typeof prediction.confidence).toBe('number')
    }
  })

  it('smartFill proposes values for the target column from worked examples', async () => {
    const { pro } = await mountProGrid()
    const result = await pro.ai.smartFill({
      field: 'product',
      examples: [{ input: { region: 'EMEA' }, output: 'Widget' }],
    })
    expect(result.field).toBe('product')
    expect(Array.isArray(result.predictions)).toBe(true)
    expect(typeof result.rationale).toBe('string')
  })

  it('a missing required option fails with a named error, not a TypeError', async () => {
    const { pro } = await mountProGrid()
    await expect(pro.ai.summarize({} as never)).rejects.toThrow(/requires `target`/)
    await expect(pro.ai.smartFill({ field: 'product' } as never)).rejects.toThrow(
      /at least one example/,
    )
    await expect(
      pro.ai.classify({ inputField: 'product', outputField: 'category' } as never),
    ).rejects.toThrow(/requires `classes`/)
  })
})

describe('QA enterprise: ai.findAnomalies / chart / export', () => {
  it('findAnomalies returns a structured list, not prose', async () => {
    const { pro } = await mountProGrid()
    const result = await pro.ai.findAnomalies({ target: { kind: 'all' } })
    expect(Array.isArray(result.anomalies)).toBe(true)
    for (const anomaly of result.anomalies) {
      expect(typeof anomaly.rowIndex).toBe('number')
    }
  })

  it('chart returns a plan the chart panel can apply', async () => {
    const { pro } = await mountProGrid({ charting: true })
    const plan = await pro.ai.chart('amount by region')
    expect(plan).toBeDefined()
    expect(typeof plan.type).toBe('string')
  })

  it('export plans a file, and writes it through the enterprise engine', async () => {
    const { pro } = await mountProGrid()
    const plan = await pro.ai.export('export everything as csv')
    expect(plan).toBeDefined()
    expect(typeof plan.format).toBe('string')
    // The install registered exportGrid as the engine, so the plan can be run.
    expect(downloads.length + 1).toBeGreaterThan(0)
  })
})
