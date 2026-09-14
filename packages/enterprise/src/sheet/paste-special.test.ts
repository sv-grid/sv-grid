import { describe, expect, it } from 'vitest'
import {
  buildClipboardPayload, parseClipboardText, parseClipboardHtml, parseClipboard,
  readClipboardOrigin, resolvePasteCell, planPaste,
  type ClipboardGrid,
} from './paste-special'

const cell = (text: string, extra = {}) => ({ text, ...extra })

describe('buildClipboardPayload', () => {
  const grid: ClipboardGrid = [
    [cell('1'), cell('2')],
    [cell('3', { formula: '=A1+B1' }), cell('4')],
  ]

  it('writes TSV for the plain-text flavour', () => {
    expect(buildClipboardPayload(grid).text).toBe('1\t2\n3\t4')
  })

  it('writes a table for the HTML flavour', () => {
    const { html } = buildClipboardPayload(grid)
    expect(html).toContain('<table')
    expect(html).toContain('<td>1</td>')
  })

  it('carries the formula in an attribute Excel ignores', () => {
    // Excel reads the text and the styles and drops the attribute; the grid
    // reads the attribute and gets its formula back.
    expect(buildClipboardPayload(grid).html).toContain('data-formula="=A1+B1"')
  })

  it('carries formats as inline styles every app understands', () => {
    const styled: ClipboardGrid = [[cell('x', { format: { bold: true, fill: '#eee' } })]]
    const { html } = buildClipboardPayload(styled)
    expect(html).toContain('font-weight:700')
    expect(html).toContain('background:#eee')
  })

  it('escapes markup in cell text', () => {
    const nasty: ClipboardGrid = [[cell('<script>&"')]]
    const { html } = buildClipboardPayload(nasty)
    expect(html).toContain('&lt;script&gt;&amp;&quot;')
    expect(html).not.toContain('<script>')
  })

  it('records the origin when given one', () => {
    expect(buildClipboardPayload(grid, { row: 3, col: 4 }).html)
      .toContain('data-origin="3 4"')
  })
})

describe('parseClipboardText', () => {
  it('splits TSV', () => {
    expect(parseClipboardText('1\t2\n3\t4')).toEqual([
      [cell('1'), cell('2')],
      [cell('3'), cell('4')],
    ])
  })

  it('drops a trailing newline rather than emitting a blank row', () => {
    expect(parseClipboardText('1\n2\n')).toHaveLength(2)
  })

  it('normalises CRLF', () => {
    expect(parseClipboardText('1\r\n2')).toHaveLength(2)
  })
})

describe('parseClipboardHtml', () => {
  it('reads a table back', () => {
    const { html } = buildClipboardPayload([[cell('a'), cell('b')]])
    expect(parseClipboardHtml(html)).toEqual([[cell('a'), cell('b')]])
  })

  it('round-trips a formula', () => {
    const { html } = buildClipboardPayload([[cell('7', { formula: '=1+6' })]])
    expect(parseClipboardHtml(html)![0]![0]).toMatchObject({ text: '7', formula: '=1+6' })
  })

  it('round-trips formats', () => {
    const source: ClipboardGrid = [[cell('x', {
      format: { bold: true, italic: true, color: 'red', align: 'right' },
    })]]
    const back = parseClipboardHtml(buildClipboardPayload(source).html)!
    expect(back[0]![0]!.format).toMatchObject({
      bold: true, italic: true, color: 'red', align: 'right',
    })
  })

  it('round-trips a number format', () => {
    const source: ClipboardGrid = [[cell('$5.00', { format: { numFmt: '$#,##0.00' } })]]
    const back = parseClipboardHtml(buildClipboardPayload(source).html)!
    expect(back[0]![0]!.format?.numFmt).toBe('$#,##0.00')
  })

  it('reads a foreign table for text and styles', () => {
    // No data-formula, no marker class: still useful.
    const html = '<table><tr><td style="font-weight:bold">A</td><td>B</td></tr></table>'
    const grid = parseClipboardHtml(html)!
    expect(grid[0]![0]).toMatchObject({ text: 'A', format: { bold: true } })
    expect(grid[0]![1]!.format).toBeUndefined()
  })

  it('returns null when there is no table', () => {
    expect(parseClipboardHtml('<p>hello</p>')).toBeNull()
  })

  it('reads the origin back', () => {
    const { html } = buildClipboardPayload([[cell('a')]], { row: 2, col: 5 })
    expect(readClipboardOrigin(html)).toEqual({ row: 2, col: 5 })
    expect(readClipboardOrigin('<table></table>')).toBeNull()
  })
})

describe('parseClipboard', () => {
  it('prefers HTML when it is there', () => {
    const { text, html } = buildClipboardPayload([[cell('7', { formula: '=1+6' })]])
    expect(parseClipboard({ text, html })[0]![0]!.formula).toBe('=1+6')
  })

  it('falls back to TSV when the HTML holds no table', () => {
    expect(parseClipboard({ text: 'a\tb', html: '<p>x</p>' })[0]).toHaveLength(2)
  })

  it('handles a text-only clipboard', () => {
    expect(parseClipboard({ text: 'a' })[0]![0]!.text).toBe('a')
  })
})

describe('resolvePasteCell', () => {
  const source = cell('7', { formula: '=A1+1', format: { bold: true } })

  it('pastes value and format for "all"', () => {
    expect(resolvePasteCell(source, 0, { what: 'all' }))
      .toEqual({ kind: 'both', value: '=A1+1', format: { bold: true } })
  })

  it('pastes the displayed value for "values", dropping the formula', () => {
    expect(resolvePasteCell(source, 0, { what: 'values' }))
      .toEqual({ kind: 'value', value: '7' })
  })

  it('pastes the formula for "formulas", dropping the format', () => {
    expect(resolvePasteCell(source, 0, { what: 'formulas' }))
      .toEqual({ kind: 'value', value: '=A1+1' })
  })

  it('pastes only the format for "formats"', () => {
    expect(resolvePasteCell(source, 0, { what: 'formats' }))
      .toEqual({ kind: 'format', format: { bold: true } })
  })

  it('translates a pasted formula by the offset', () => {
    expect(resolvePasteCell(source, 0, { what: 'formulas' }, { rows: 2, cols: 0 }))
      .toEqual({ kind: 'value', value: '=A3+1' })
  })

  it('keeps an anchored reference anchored', () => {
    const anchored = cell('7', { formula: '=$A$1+B1' })
    expect(resolvePasteCell(anchored, 0, { what: 'formulas' }, { rows: 1, cols: 0 }))
      .toEqual({ kind: 'value', value: '=$A$1+B2' })
  })

  it('does the arithmetic operations against what is already there', () => {
    const five = cell('5')
    expect(resolvePasteCell(five, 10, { operation: 'add' })).toEqual({ kind: 'value', value: '15' })
    expect(resolvePasteCell(five, 10, { operation: 'subtract' })).toEqual({ kind: 'value', value: '5' })
    expect(resolvePasteCell(five, 10, { operation: 'multiply' })).toEqual({ kind: 'value', value: '50' })
    expect(resolvePasteCell(five, 10, { operation: 'divide' })).toEqual({ kind: 'value', value: '2' })
  })

  it('skips arithmetic on non-numbers rather than writing NaN', () => {
    expect(resolvePasteCell(cell('abc'), 10, { operation: 'add' })).toEqual({ kind: 'skip' })
    expect(resolvePasteCell(cell('5'), 'text', { operation: 'add' })).toEqual({ kind: 'skip' })
  })

  it('skips a divide by zero rather than inventing a value', () => {
    expect(resolvePasteCell(cell('0'), 10, { operation: 'divide' })).toEqual({ kind: 'skip' })
  })

  it('skips blanks when asked', () => {
    expect(resolvePasteCell(cell(''), 1, { skipBlanks: true })).toEqual({ kind: 'skip' })
    expect(resolvePasteCell(cell(''), 1, {})).toMatchObject({ kind: 'both', value: '' })
  })

  it('skips a missing source cell', () => {
    expect(resolvePasteCell(undefined, 1, {})).toEqual({ kind: 'skip' })
  })
})

describe('planPaste', () => {
  const grid: ClipboardGrid = [
    [cell('a'), cell('b')],
    [cell('c'), cell('d')],
  ]

  it('lands the block at the destination corner', () => {
    const plan = planPaste(grid, { row: 5, col: 3 })
    expect(plan.map((p) => [p.row, p.col])).toEqual([
      [5, 3], [5, 4], [6, 3], [6, 4],
    ])
  })

  it('transposes when asked', () => {
    const plan = planPaste(grid, { row: 0, col: 0 }, { transpose: true })
    expect(plan.find((p) => p.row === 0 && p.col === 1)!.source.text).toBe('c')
    expect(plan.find((p) => p.row === 1 && p.col === 0)!.source.text).toBe('b')
  })

  it('gives every cell the SAME offset', () => {
    // The offset is destination minus origin, not a per-cell computation:
    // source and destination advance together as the grid is walked.
    const plan = planPaste(grid, { row: 5, col: 3 }, {}, { row: 1, col: 1 })
    for (const entry of plan) expect(entry.offset).toEqual({ rows: 4, cols: 2 })
  })

  it('uses a zero offset with no origin', () => {
    // A formula pasted from another application has no position here to have
    // moved from.
    const plan = planPaste(grid, { row: 9, col: 9 })
    expect(plan[0]!.offset).toEqual({ rows: 0, cols: 0 })
  })

  it('does not translate a transposed paste', () => {
    const plan = planPaste(grid, { row: 5, col: 5 }, { transpose: true }, { row: 0, col: 0 })
    expect(plan[0]!.offset).toEqual({ rows: 0, cols: 0 })
  })

  it('handles a ragged grid without emitting holes', () => {
    const ragged: ClipboardGrid = [[cell('a'), cell('b')], [cell('c')]]
    expect(planPaste(ragged, { row: 0, col: 0 })).toHaveLength(3)
  })
})
