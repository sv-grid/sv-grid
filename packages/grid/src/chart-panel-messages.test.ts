import { describe, expect, it } from 'vitest'
import { chartPanelMessage, defaultChartPanelMessages, resolveChartPanelMessages } from './chart-panel-messages'
import { defaultGridMessages } from './grid-messages'

describe('chart panel messages', () => {
  it('every key has a non-empty English default with no em-dash', () => {
    for (const [k, v] of Object.entries(defaultChartPanelMessages)) {
      expect(typeof v, k).toBe('string')
      expect(v.trim().length, k).toBeGreaterThan(0)
      expect(v, k).not.toMatch(/\u2014/)
    }
    expect(Object.keys(defaultChartPanelMessages).length).toBeGreaterThan(150)
  })

  it('does not share a key with the grid chrome, so one localization.text map serves both', () => {
    const chrome = new Set(Object.keys(defaultGridMessages))
    for (const k of Object.keys(defaultChartPanelMessages)) expect(chrome.has(k), k).toBe(false)
  })

  it('resolves overrides over the defaults and fills placeholders', () => {
    const m = resolveChartPanelMessages({ chartPanelTitle: 'Diagramm', chartAdd: '' })
    expect(m.chartPanelTitle).toBe('Diagramm')
    expect(m.chartAdd).toBe('Add chart')
    expect(m.chartGroupBy).toBe('Group by')
    expect(resolveChartPanelMessages(null)).toBe(defaultChartPanelMessages)
    expect(chartPanelMessage(m.chartRemoveTab, { title: 'Chart 2' })).toBe('Remove Chart 2')
    expect(chartPanelMessage('{a} and {b}', { a: 1 })).toBe('1 and {b}')
  })
})
