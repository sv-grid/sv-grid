/**
 * The number field: one type in four formats (integer, decimal, currency,
 * percent), the text it reads, and its one editor.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { enableFields } from './index'
import { fillFieldColumn, getFieldType } from './registry.svelte'
import { formatCurrency, numberEditText, numberFromText, parseNumberText } from './format'
import NumberEditor from './NumberEditor.svelte'

enableFields()

describe('reading typed numbers', () => {
  it('the field\'s own separators, a symbol, a percent sign, K / M / B, accounting negatives', () => {
    expect(parseNumberText('$1,200.50', { separators: 'comma-period', symbol: '$' })).toBe(1200.5)
    expect(parseNumberText('1.200,50 €', { separators: 'period-comma', symbol: '€' })).toBe(1200.5)
    expect(parseNumberText('1 200,5', { separators: 'space-comma' })).toBe(1200.5)
    expect(parseNumberText('-15%', { separators: 'comma-period' })).toBe(-15)
    expect(parseNumberText('2.5k', { separators: 'comma-period' })).toBe(2500)
    expect(parseNumberText('3M', { separators: 'comma-period' })).toBe(3e6)
    expect(parseNumberText('(120)', { separators: 'comma-period' })).toBe(-120)
    expect(parseNumberText('1..2', { separators: 'comma-period' })).toBeNull()
    expect(parseNumberText('abc', { separators: 'comma-period' })).toBeNull()
  })

  it('rounds to the format\'s places and stores percent as a fraction unless values are 0 to 100', () => {
    expect(numberFromText('2,450.6', 'currency', { precision: 0, separators: 'comma-period' })).toBe(2451)
    expect(numberFromText('2.456', 'number', { format: 'integer', separators: 'comma-period' })).toBe(2)
    expect(numberFromText('42.4', 'percent', { precision: 0, separators: 'comma-period' })).toBe(0.42)
    expect(numberFromText('42.4', 'percent', { precision: 1, points: true, separators: 'comma-period' })).toBe(42.4)
  })

  it('the edit box text: no grouping, the field\'s decimal character, no float noise', () => {
    expect(numberEditText(1234.5, { separators: 'period-comma' })).toBe('1234,5')
    expect(numberEditText(0.1 + 0.2, { separators: 'comma-period' })).toBe('0.3')
  })

  it('the currency symbol before or after', () => {
    expect(formatCurrency(-5, { precision: 2, separators: 'comma-period', symbol: '$' })).toBe('-$5.00')
    expect(formatCurrency(1200.5, { precision: 2, separators: 'period-comma', symbol: 'kr', symbolPosition: 'after' })).toBe('1.200,50 kr')
  })
})

describe('one number type', () => {
  const fill = (fieldType: string, fieldProps: Record<string, unknown>) => fillFieldColumn({ field: 'n', fieldType, fieldProps })
  const show = (col: Record<string, unknown>, value: unknown) => (col.formatter as (c: { value: unknown }) => string)({ value })

  it('each format is a number column edited in the number editor', () => {
    for (const format of ['integer', 'decimal', 'currency', 'percent']) {
      const col = fill('number', { format })
      // The data type sorts, filters and aligns; the editor only edits.
      expect(col.cellDataType).toBe('number')
      expect(col.editorType).toBe('fieldNumber')
    }
    // A column can edit a number in another editor and stay a number column.
    const plain = fillFieldColumn({ field: 'n', fieldType: 'number', editorType: 'text' })
    expect(plain.editorType).toBe('text')
    expect(plain.cellDataType).toBe('number')
    expect(show(fill('number', { format: 'currency', symbol: '€', precision: 2, separators: 'comma-period' }), 3.5)).toBe('€3.50')
    expect(show(fill('number', { format: 'percent', precision: 1, separators: 'comma-period' }), 0.125)).toBe('12.5%')
    expect(show(fill('number', { format: 'integer', separators: 'comma-period' }), 1234.6)).toBe('1,235')
  })

  it('currency and percent columns from before still work, and edit as a number in that format', () => {
    expect(show(fill('currency', { precision: 2, separators: 'comma-period' }), 7)).toBe('$7.00')
    expect(fill('percent', {}).editorType).toBe('fieldNumber')
    expect(getFieldType('currency')?.editAs).toEqual({ type: 'number', props: { format: 'currency' } })
    // Picking a format sets its usual precision.
    const format = getFieldType('number')!.properties!.find((p) => p.key === 'format')!
    expect(format.alsoSets?.('currency', {})).toEqual({ precision: 2 })
  })

  it('a paste is read as the field writes it; text that is not a number keeps the old value', () => {
    const col = fill('number', { format: 'currency', symbol: '$', precision: 2, separators: 'comma-period' })
    const parse = col.valueParser as (x: Record<string, unknown>) => unknown
    expect(parse({ newValue: null, rawInput: '$3,210.40', oldValue: 1 })).toBe(3210.4)
    expect(parse({ newValue: null, rawInput: 'n/a', oldValue: 1 })).toBe(1)
    // The editor's own commit is already a number and passes as is.
    expect(parse({ newValue: 12.5, rawInput: 12.5, oldValue: 1 })).toBe(12.5)
  })
})

describe('the number editor', () => {
  let cleanup: (() => void) | null = null
  afterEach(() => {
    cleanup?.()
    cleanup = null
  })

  function open(fieldProps: Record<string, unknown>, value: unknown, typed = false) {
    const calls = { commit: [] as unknown[], cancel: 0 }
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(NumberEditor, {
      target,
      props: {
        value,
        typed,
        columnDef: fillFieldColumn({ field: 'n', fieldType: 'number', fieldProps: { separators: 'comma-period', ...fieldProps } }),
        onCommit: (v?: unknown) => calls.commit.push(v),
        onCancel: () => (calls.cancel += 1),
      },
    })
    flushSync()
    cleanup = () => {
      unmount(app)
      target.remove()
    }
    const input = target.querySelector<HTMLInputElement>('.sv-fne-input')!
    const type = (text: string) => {
      input.value = text
      input.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
    }
    const key = (k: string) => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
      flushSync()
    }
    // The box and what sits beside it, in order (the spinner left out).
    const affixes = () =>
      [...target.querySelectorAll('.sv-fne > :not(.sv-fne-spin)')].map((e) => (e.classList.contains('sv-fne-sizer') ? '[box]' : e.textContent))
    const hint = () => document.querySelector('.sv-fne-error')?.textContent?.trim() ?? ''
    const spin = (label: 'Increase' | 'Decrease', shiftKey = false) => {
      const b = [...target.querySelectorAll<HTMLButtonElement>('.sv-fne-spin button')].find((x) => x.getAttribute('aria-label')!.startsWith(label))!
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, shiftKey }))
      b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
      flushSync()
    }
    const keyShift = (k: string) => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey: true, bubbles: true, cancelable: true }))
      flushSync()
    }
    return { calls, input, type, key, keyShift, spin, affixes, hint }
  }

  it('shows the symbol beside the number and rounds to the precision on commit', () => {
    const ed = open({ format: 'currency', symbol: '$', precision: 2 }, 1800)
    expect(ed.affixes()).toEqual(['$', '[box]'])
    expect(ed.input.value).toBe('1800')
    ed.type('2,450.555')
    // Nothing under the cell while the value is fine.
    expect(ed.hint()).toBe('')
    ed.key('Enter')
    expect(ed.calls.commit).toEqual([2450.56])
  })

  it('a symbol after the number, and a percent shown in points', () => {
    expect(open({ format: 'currency', symbol: 'kr', symbolPosition: 'after' }, 5).affixes()).toEqual(['[box]', 'kr'])
    cleanup?.()
    const ed = open({ format: 'percent', precision: 0 }, 0.42)
    expect(ed.affixes()).toEqual(['[box]', '%'])
    expect(ed.input.value).toBe('42')
    ed.type('55')
    ed.key('Enter')
    expect(ed.calls.commit).toEqual([0.55])
  })

  it('refuses what is not a number, and negatives where the field allows none', () => {
    const ed = open({ format: 'decimal', allowNegative: false }, 3)
    ed.type('1..2')
    ed.key('Enter')
    expect(ed.calls.commit).toEqual([])
    expect(ed.hint()).toBe('Not a number')
    ed.type('-4')
    ed.key('Enter')
    expect(ed.calls.commit).toEqual([])
    expect(ed.hint()).toBe('Negative numbers are not allowed')
    ed.key('Escape')
    expect(ed.calls.cancel).toBe(1)
  })

  it('the spinner and Up / Down step by the field\'s step, ten with Shift, rounded, never below 0 when negatives are off', () => {
    const ed = open({ format: 'decimal', precision: 1, step: 0.5, allowNegative: false }, 1)
    ed.spin('Increase')
    expect(ed.input.value).toBe('1.5')
    ed.key('ArrowUp')
    expect(ed.input.value).toBe('2')
    ed.keyShift('ArrowDown')
    expect(ed.input.value).toBe('0')
    ed.spin('Decrease')
    expect(ed.input.value).toBe('0')
    ed.key('Enter')
    expect(ed.calls.commit).toEqual([0])
  })

  it('a duration shows as h:mm, reads "1h 45m", and steps a minute', () => {
    cleanup?.()
    const calls = { commit: [] as unknown[] }
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(NumberEditor, {
      target,
      props: {
        value: 7200,
        columnDef: fillFieldColumn({ field: 'd', fieldType: 'duration', fieldProps: { durationFormat: 'h:mm' } }),
        onCommit: (v?: unknown) => calls.commit.push(v),
        onCancel: () => {},
      },
    })
    flushSync()
    cleanup = () => {
      unmount(app)
      target.remove()
    }
    const input = target.querySelector<HTMLInputElement>('.sv-fne-input')!
    expect(input.value).toBe('2:00')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }))
    flushSync()
    expect(input.value).toBe('2:01')
    input.value = '1h 45m'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    flushSync()
    expect(calls.commit).toEqual([6300])
  })

  it('a character typed on the cell starts the box; an empty box clears the cell', () => {
    const ed = open({ format: 'integer' }, '7', true)
    expect(ed.input.value).toBe('7')
    ed.type('')
    ed.key('Enter')
    expect(ed.calls.commit).toEqual([null])
  })
})
