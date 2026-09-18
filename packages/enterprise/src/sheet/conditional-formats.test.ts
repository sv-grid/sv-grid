import { describe, expect, it } from 'vitest'
import {
  ruleStats, evaluateCf, shiftCf, removeCf, cfIn, describeCf, scaleColor, iconIndex, hasStyle,
  CF_PRESET_STYLES, COLOR_SCALES, DATA_BAR_COLOR, DATA_BAR_NEGATIVE_COLOR,
  type CfRule, type CfContext, type CfStats,
} from './conditional-formats'
import { createWorkbook } from './workbook'
import type { CellValue } from './ast'

/** A sheet, its context, and the stats the shell would cache per rule. */
function sheet(cells: string[][]) {
  const wb = createWorkbook([{ name: 'S', cells }])
  const valueAt = (r: number, c: number) => wb.getValue('S', r, c)
  const displayAt = (r: number, c: number) => {
    const v = valueAt(r, c)
    return typeof v === 'object' && v !== null ? v.error : String(v)
  }
  const ctx: CfContext = { evaluate: (t, at) => wb.evaluateText('S', t, undefined, at) }
  const cache = new Map<string, CfStats>()
  const statsFor = (rule: CfRule) => {
    let s = cache.get(rule.id)
    if (!s) { s = ruleStats(rule, valueAt, displayAt); cache.set(rule.id, s) }
    return s
  }
  const at = (rules: ReadonlyArray<CfRule>, r: number, c: number) =>
    evaluateCf(rules, r, c, valueAt(r, c), displayAt(r, c), statsFor, ctx)
  return { wb, valueAt, displayAt, ctx, statsFor, at }
}

const red = CF_PRESET_STYLES[0]!.style
const green = CF_PRESET_STYLES[2]!.style
const column: CfRule['rects'] = [[0, 0, 4, 0]]

describe('ruleStats', () => {
  it('gathers the numbers, sorted, with min, max and mean, and counts display texts for duplicates', () => {
    const { valueAt, displayAt } = sheet([['3'], ['1'], ['x'], ['=A1*2'], ['1']])
    const stats = ruleStats({ id: 'd', kind: 'duplicates', rects: column, style: red }, valueAt, displayAt)
    expect(stats.sorted).toEqual([1, 1, 3, 6])
    expect(stats.min).toBe(1)
    expect(stats.max).toBe(6)
    expect(stats.mean).toBe(2.75)
    expect([...stats.counts]).toEqual([['3', 1], ['1', 2], ['x', 1], ['6', 1]])
  })

  it('is empty-safe', () => {
    const { valueAt, displayAt } = sheet([['']])
    const stats = ruleStats({ id: 'd', kind: 'dataBar', rects: column, color: DATA_BAR_COLOR }, valueAt, displayAt)
    expect(stats).toMatchObject({ sorted: [], min: 0, max: 0, mean: 0 })
  })
})

describe('Highlight Cells Rules', () => {
  it('greater than a literal or a formula, over computed values', () => {
    const s = sheet([['10'], ['=A1*5'], ['30'], ['x'], ['']])
    const rule: CfRule = { id: 'g', kind: 'cellIs', operator: 'greater', value1: '25', rects: column, style: red }
    expect(s.at([rule], 0, 0)).toBeNull()
    expect(s.at([rule], 1, 0)).toEqual({ style: red })
    expect(s.at([rule], 2, 0)).toEqual({ style: red })
    expect(s.at([rule], 3, 0)).toBeNull()
    const bound: CfRule = { ...rule, value1: '=A3' }
    expect(s.at([bound], 1, 0)).toEqual({ style: red })
    expect(s.at([bound], 2, 0)).toBeNull()
  })

  it('between, equal to (text as well), and the rest', () => {
    const s = sheet([['5'], ['Paid'], ['15'], ['paid'], ['']])
    const between: CfRule = { id: 'b', kind: 'cellIs', operator: 'between', value1: '10', value2: '20', rects: column, style: red }
    expect(s.at([between], 0, 0)).toBeNull()
    expect(s.at([between], 2, 0)).toEqual({ style: red })
    const equal: CfRule = { id: 'e', kind: 'cellIs', operator: 'equal', value1: 'Paid', rects: column, style: green }
    expect(s.at([equal], 1, 0)).toEqual({ style: green })
    expect(s.at([equal], 3, 0)).toEqual({ style: green })
    expect(s.at([equal], 0, 0)).toBeNull()
    const notEqual: CfRule = { ...equal, operator: 'notEqual' }
    expect(s.at([notEqual], 0, 0)).toEqual({ style: green })
    expect(s.at([notEqual], 4, 0)).toBeNull()
  })

  it('text that contains, begins with, ends with', () => {
    const s = sheet([['Northwind'], ['south'], ['']])
    const contains: CfRule = { id: 't', kind: 'text', match: 'contains', value: 'north', rects: column, style: red }
    expect(s.at([contains], 0, 0)).toEqual({ style: red })
    expect(s.at([contains], 1, 0)).toBeNull()
    expect(s.at([{ ...contains, match: 'notContains' }], 1, 0)).toEqual({ style: red })
    expect(s.at([{ ...contains, match: 'notContains' }], 2, 0)).toBeNull()
    expect(s.at([{ ...contains, match: 'beginsWith', value: 'so' }], 1, 0)).toEqual({ style: red })
    expect(s.at([{ ...contains, match: 'endsWith', value: 'wind' }], 0, 0)).toEqual({ style: red })
  })

  it('duplicate and unique values', () => {
    const s = sheet([['a'], ['b'], ['a'], [''], ['']])
    const dup: CfRule = { id: 'd', kind: 'duplicates', rects: column, style: red }
    expect(s.at([dup], 0, 0)).toEqual({ style: red })
    expect(s.at([dup], 1, 0)).toBeNull()
    expect(s.at([dup], 3, 0)).toBeNull()
    const uniq: CfRule = { ...dup, unique: true }
    expect(s.at([uniq], 1, 0)).toEqual({ style: red })
    expect(s.at([uniq], 0, 0)).toBeNull()
  })
})

describe('Top/Bottom Rules', () => {
  const s = sheet([['10'], ['40'], ['20'], ['40'], ['x']])

  it('top N keeps ties, bottom N too', () => {
    const top1: CfRule = { id: 'top', kind: 'topBottom', top: true, rank: 1, rects: column, style: red }
    expect(s.at([top1], 1, 0)).toEqual({ style: red })
    expect(s.at([top1], 3, 0)).toEqual({ style: red })
    expect(s.at([top1], 2, 0)).toBeNull()
    const bottom2: CfRule = { ...top1, top: false, rank: 2 }
    expect(s.at([bottom2], 0, 0)).toEqual({ style: red })
    expect(s.at([bottom2], 2, 0)).toEqual({ style: red })
    expect(s.at([bottom2], 1, 0)).toBeNull()
  })

  it('top percent', () => {
    const top50: CfRule = { id: 'p', kind: 'topBottom', top: true, rank: 50, percent: true, rects: column, style: red }
    // Four numbers, 50% = two: the two 40s.
    expect(s.at([top50], 1, 0)).toEqual({ style: red })
    expect(s.at([top50], 2, 0)).toBeNull()
  })

  it('above and below average', () => {
    const above: CfRule = { id: 'a', kind: 'average', above: true, rects: column, style: red }
    // Mean 27.5.
    expect(s.at([above], 1, 0)).toEqual({ style: red })
    expect(s.at([above], 2, 0)).toBeNull()
    expect(s.at([{ ...above, above: false }], 0, 0)).toEqual({ style: red })
    expect(s.at([above], 4, 0)).toBeNull()
  })
})

describe('Data Bars, Color Scales, Icon Sets', () => {
  const s = sheet([['0'], ['50'], ['100'], ['x']])

  it('a data bar is the value\'s share of the range', () => {
    const bar: CfRule = { id: 'bar', kind: 'dataBar', color: DATA_BAR_COLOR, rects: column }
    expect(s.at([bar], 0, 0)).toEqual({ dataBar: { ratio: 0, axis: 0, negative: false, color: DATA_BAR_COLOR } })
    expect(s.at([bar], 1, 0)).toEqual({ dataBar: { ratio: 0.5, axis: 0, negative: false, color: DATA_BAR_COLOR } })
    expect(s.at([bar], 2, 0)).toEqual({ dataBar: { ratio: 1, axis: 0, negative: false, color: DATA_BAR_COLOR } })
    expect(s.at([bar], 3, 0)).toBeNull()
  })

  it('a data bar measures from zero, so the smallest positive value keeps a bar', () => {
    const positive = sheet([['10'], ['20'], ['40']])
    const bar: CfRule = { id: 'bar', kind: 'dataBar', color: DATA_BAR_COLOR, rects: [[0, 0, 2, 0]] }
    expect(positive.at([bar], 0, 0)?.dataBar?.ratio).toBe(0.25)
    expect(positive.at([bar], 1, 0)?.dataBar?.ratio).toBe(0.5)
    expect(positive.at([bar], 2, 0)?.dataBar?.ratio).toBe(1)
  })

  it('a range with negatives puts the axis at zero, and the bars grow away from it', () => {
    const bar: CfRule = { id: 'bar', kind: 'dataBar', color: DATA_BAR_COLOR, rects: [[0, 0, 3, 0]] }
    // -10 to 30: the axis a quarter of the way across; -10 is a quarter
    // wide to the left of it in red, 30 three quarters to the right.
    const mixed = sheet([['-10'], ['0'], ['30'], ['15']])
    expect(mixed.at([bar], 0, 0)?.dataBar).toEqual({ ratio: 0.25, axis: 0.25, negative: true, color: DATA_BAR_NEGATIVE_COLOR })
    expect(mixed.at([bar], 1, 0)?.dataBar).toEqual({ ratio: 0, axis: 0.25, negative: false, color: DATA_BAR_COLOR })
    expect(mixed.at([bar], 2, 0)?.dataBar).toEqual({ ratio: 0.75, axis: 0.25, negative: false, color: DATA_BAR_COLOR })
    expect(mixed.at([bar], 3, 0)?.dataBar).toEqual({ ratio: 0.375, axis: 0.25, negative: false, color: DATA_BAR_COLOR })
    // A second colour of the rule's own, and an all-negative range with the axis at the right edge.
    const own: CfRule = { ...bar, negativeColor: '#00AA00' }
    expect(mixed.at([own], 0, 0)?.dataBar?.color).toBe('#00AA00')
    const allNeg = sheet([['-5'], ['-20']])
    const two: CfRule = { ...bar, rects: [[0, 0, 1, 0]] }
    expect(allNeg.at([two], 0, 0)?.dataBar).toEqual({ ratio: 0.25, axis: 1, negative: true, color: DATA_BAR_NEGATIVE_COLOR })
    expect(allNeg.at([two], 1, 0)?.dataBar).toEqual({ ratio: 1, axis: 1, negative: true, color: DATA_BAR_NEGATIVE_COLOR })
  })

  it('a formula rule is written for the top-left cell and moves with each cell', () => {
    const s = sheet([
      ['Item', 'Qty'],
      ['a', '5'],
      ['b', '15'],
      ['c', 'x'],
      ['d', '=B2*3'],
    ])
    const rule: CfRule = { id: 'f', kind: 'formula', formula: '=$B2>10', style: red, rects: [[1, 0, 4, 0]] }
    expect(s.at([rule], 1, 0)).toBeNull()
    expect(s.at([rule], 2, 0)).toEqual({ style: red })
    expect(s.at([rule], 3, 0)).toBeNull()
    expect(s.at([rule], 4, 0)).toEqual({ style: red })
    // Without the leading = it still reads as a formula; an error is no match.
    const bare: CfRule = { ...rule, formula: 'MOD(ROW(),2)=0' }
    expect(s.at([bare], 1, 0)).toEqual({ style: red })
    expect(s.at([bare], 2, 0)).toBeNull()
    const broken: CfRule = { ...rule, formula: '=1/0' }
    expect(s.at([broken], 1, 0)).toBeNull()
    expect(describeCf(rule)).toBe('Formula: =$B2>10')
  })

  it('a three-colour scale runs low to mid to high; a two-colour one straight through', () => {
    const scale: CfRule = { id: 'sc', kind: 'colorScale', colors: COLOR_SCALES['green-yellow-red'], rects: column }
    expect(s.at([scale], 0, 0)).toEqual({ style: { fill: '#63be7b' } })
    expect(s.at([scale], 1, 0)).toEqual({ style: { fill: '#ffeb84' } })
    expect(s.at([scale], 2, 0)).toEqual({ style: { fill: '#f8696b' } })
    expect(scaleColor(['#000000', '#ffffff'], 0.5)).toBe('#808080')
    expect(scaleColor(['#000000', '#ffffff'], 0)).toBe('#000000')
  })

  it('an icon set splits the range in thirds', () => {
    const icons: CfRule = { id: 'ic', kind: 'iconSet', set: 'arrows', rects: column }
    expect(s.at([icons], 0, 0)).toEqual({ icon: { set: 'arrows', index: 2 } })
    expect(s.at([icons], 1, 0)).toEqual({ icon: { set: 'arrows', index: 1 } })
    expect(s.at([icons], 2, 0)).toEqual({ icon: { set: 'arrows', index: 0 } })
    expect(iconIndex(0.34)).toBe(1)
    expect(iconIndex(0.67)).toBe(0)
  })

  it('a flat positive range draws full bars, a flat zero range none', () => {
    const flat = sheet([['5'], ['5']])
    const bar: CfRule = { id: 'bar', kind: 'dataBar', color: DATA_BAR_COLOR, rects: [[0, 0, 1, 0]] }
    expect(flat.at([bar], 0, 0)?.dataBar?.ratio).toBe(1)
    const zeros = sheet([['0'], ['0']])
    expect(zeros.at([bar], 0, 0)?.dataBar?.ratio).toBe(0)
  })
})

describe('priority and Stop If True', () => {
  const s = sheet([['100']])
  const rects: CfRule['rects'] = [[0, 0, 0, 0]]

  it('the first rule to decide a property keeps it; other properties merge', () => {
    const first: CfRule = { id: '1', kind: 'cellIs', operator: 'greater', value1: '0', rects, style: { fill: '#111111' } }
    const second: CfRule = { id: '2', kind: 'cellIs', operator: 'greater', value1: '0', rects, style: { fill: '#222222', bold: true } }
    expect(s.at([first, second], 0, 0)).toEqual({ style: { fill: '#111111', bold: true } })
    expect(s.at([second, first], 0, 0)).toEqual({ style: { fill: '#222222', bold: true } })
  })

  it('Stop If True ends the walk for a matching cell', () => {
    const first: CfRule = { id: '1', kind: 'cellIs', operator: 'greater', value1: '0', rects, style: { fill: '#111111' }, stopIfTrue: true }
    const second: CfRule = { id: '2', kind: 'cellIs', operator: 'greater', value1: '0', rects, style: { bold: true } }
    expect(s.at([first, second], 0, 0)).toEqual({ style: { fill: '#111111' } })
    const miss: CfRule = { ...first, value1: '1000' }
    expect(s.at([miss, second], 0, 0)).toEqual({ style: { bold: true } })
  })

  it('a bar, a scale and a style can share a cell', () => {
    const bar: CfRule = { id: 'b', kind: 'dataBar', color: DATA_BAR_COLOR, rects }
    const bold: CfRule = { id: 's', kind: 'cellIs', operator: 'greater', value1: '0', rects, style: { bold: true } }
    const ratio = s.at([bar], 0, 0)!.dataBar!.ratio
    expect(s.at([bar, bold], 0, 0)).toEqual({ dataBar: { ratio, axis: 0, negative: false, color: DATA_BAR_COLOR }, style: { bold: true } })
  })

  it('a rule elsewhere says nothing about the cell', () => {
    const far: CfRule = { id: 'f', kind: 'cellIs', operator: 'greater', value1: '0', rects: [[5, 5, 5, 5]], style: red }
    expect(s.at([far], 0, 0)).toBeNull()
  })
})

describe('bookkeeping', () => {
  const rule: CfRule = { id: 'r', kind: 'cellIs', operator: 'greater', value1: '0', rects: [[2, 0, 4, 0]], style: red }

  it('rules move with an insert and drop when their rows go', () => {
    expect(shiftCf([rule], { kind: 'insertRows', at: 0, count: 2 })[0]!.rects).toEqual([[4, 0, 6, 0]])
    expect(shiftCf([rule], { kind: 'deleteRows', at: 2, count: 3 })).toEqual([])
  })

  it('Clear Rules from Selected Cells cuts the selection out', () => {
    expect(removeCf([rule], [[3, 0, 3, 0]])[0]!.rects).toEqual([[2, 0, 2, 0], [4, 0, 4, 0]])
    expect(removeCf([rule], [[0, 0, 9, 9]])).toEqual([])
    expect(cfIn([rule], [[4, 0, 4, 0]])).toHaveLength(1)
    expect(cfIn([rule], [[9, 9, 9, 9]])).toHaveLength(0)
  })

  it('describes rules the way Manage Rules lists them', () => {
    expect(describeCf(rule)).toBe('Cell Value greater than 0')
    expect(describeCf({ ...rule, operator: 'between', value2: '9' })).toBe('Cell Value between 0 and 9')
    expect(describeCf({ id: 't', kind: 'text', match: 'contains', value: 'x', rects: [], style: red })).toBe("Cell Value contains 'x'")
    expect(describeCf({ id: 'd', kind: 'duplicates', rects: [], style: red })).toBe('Duplicate Values')
    expect(describeCf({ id: 'p', kind: 'topBottom', top: true, rank: 10, rects: [], style: red })).toBe('Top 10')
    expect(describeCf({ id: 'p', kind: 'topBottom', top: false, rank: 5, percent: true, rects: [], style: red })).toBe('Bottom 5%')
    expect(describeCf({ id: 'a', kind: 'average', above: false, rects: [], style: red })).toBe('Below Average')
    expect(describeCf({ id: 'b', kind: 'dataBar', color: '#000', rects: [] })).toBe('Data Bar')
    expect(describeCf({ id: 'c', kind: 'colorScale', colors: COLOR_SCALES['green-white'], rects: [] })).toBe('Two-Color Scale')
    expect(describeCf({ id: 'i', kind: 'iconSet', set: 'flags', rects: [] })).toBe('Icon Set')
    expect(hasStyle(rule)).toBe(true)
    expect(hasStyle({ id: 'b', kind: 'dataBar', color: '#000', rects: [] })).toBe(false)
  })
})

describe('operands', () => {
  it('a formula operand that errors matches nothing', () => {
    const s = sheet([['5']])
    const rule: CfRule = { id: 'r', kind: 'cellIs', operator: 'greater', value1: '=1/0', rects: [[0, 0, 0, 0]], style: red }
    expect(s.at([rule], 0, 0)).toBeNull()
  })

  it('values are what the sheet shows, not the formula text', () => {
    const s = sheet([['=2*3']])
    const rule: CfRule = { id: 'r', kind: 'cellIs', operator: 'equal', value1: '6', rects: [[0, 0, 0, 0]], style: red }
    expect(s.at([rule], 0, 0)).toEqual({ style: red })
    const v: CellValue = s.valueAt(0, 0)
    expect(v).toBe(6)
  })
})
