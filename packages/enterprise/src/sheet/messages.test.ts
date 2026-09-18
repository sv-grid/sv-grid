import { describe, expect, it } from 'vitest'
import {
  defaultSheetMessages, defaultSheetTextMessages, defaultDialogMessages,
  ribbonMessageDefaults, resolveSheetMessages, formatMessage,
} from './messages'
import { RIBBON_TABS } from './ribbon'

describe('sheet messages', () => {
  it('the ribbon map names every tab, group and item of the model', () => {
    const ribbon = ribbonMessageDefaults()
    for (const tab of RIBBON_TABS) {
      expect(ribbon[`ribbon.tab.${tab.id}`]).toBe(tab.label)
      for (const group of tab.groups) {
        expect(ribbon[`ribbon.group.${group.id}`]).toBe(group.label)
        for (const item of group.items) {
          expect(ribbon[`ribbon.${item.id}.label`]).toBe(item.label)
          expect(ribbon[`ribbon.${item.id}.title`]).toBe(item.title)
          const seen = new Set<string>()
          for (const option of item.options ?? []) {
            if (seen.has(option.value)) continue
            seen.add(option.value)
            expect(ribbon[`ribbon.${item.id}.option.${option.value}`]).toBe(option.label)
          }
        }
      }
    }
  })

  it('the three maps share no key, and every default is a non-empty string', () => {
    const ribbon = Object.keys(ribbonMessageDefaults())
    const dialogs = Object.keys(defaultDialogMessages)
    const text = Object.keys(defaultSheetTextMessages)
    const all = [...ribbon, ...dialogs, ...text]
    expect(new Set(all).size).toBe(all.length)
    expect(Object.keys(defaultSheetMessages).length).toBe(all.length)
    for (const value of Object.values(defaultSheetMessages)) {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })

  it('resolve lays overrides over the defaults and ignores what is not a string', () => {
    expect(resolveSheetMessages(undefined)).toBe(defaultSheetMessages)
    expect(resolveSheetMessages(null)).toBe(defaultSheetMessages)
    const map = resolveSheetMessages({ statusReady: 'Bereit', 'ribbon.tab.home': 'Start', ok: undefined })
    expect(map.statusReady).toBe('Bereit')
    expect(map['ribbon.tab.home']).toBe('Start')
    expect(map.ok).toBe('OK')
    expect(map['formatCells.title']).toBe('Format Cells')
    expect(defaultSheetMessages.statusReady).toBe('Ready')
  })

  it('formatMessage fills placeholders and leaves an unknown one alone', () => {
    expect(formatMessage('{shown} of {total} records found', { shown: 3, total: 10 })).toBe('3 of 10 records found')
    expect(formatMessage('Opened {name}.', { name: 'a.xlsx' })).toBe('Opened a.xlsx.')
    expect(formatMessage('{count} {unit}', { count: 1 })).toBe('1 {unit}')
    expect(formatMessage('plain')).toBe('plain')
  })
})
