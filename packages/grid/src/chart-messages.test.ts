import { describe, expect, it } from 'vitest'
import { chartMessage, defaultChartMessages, resolveChartMessages } from './chart-messages'

describe('chart messages', () => {
  it('resolves a partial map over the English defaults and ignores empty values', () => {
    const m = resolveChartMessages({ png: 'Bild', noData: '' })
    expect(m.png).toBe('Bild')
    expect(m.noData).toBe(defaultChartMessages.noData)
    expect(resolveChartMessages()).toBe(defaultChartMessages)
  })

  it('fills placeholders and leaves unknown ones alone', () => {
    expect(chartMessage('{type} chart', { type: 'bar' })).toBe('bar chart')
    expect(chartMessage('{series}: {value} at {category}', { series: 'S', value: 3, category: 'Q1' })).toBe('S: 3 at Q1')
    expect(chartMessage('+{n} more {x}', { n: 4 })).toBe('+4 more {x}')
  })

  it('every default has a value', () => {
    for (const [k, v] of Object.entries(defaultChartMessages)) expect(v, k).not.toBe('')
  })
})
