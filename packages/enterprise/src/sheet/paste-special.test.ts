import { describe, expect, it } from 'vitest'
import {
  buildClipboardPayload, parseClipboardText, parseClipboardHtml, parseClipboard,
  readClipboardOrigin, resolvePasteCell, planPaste, numFmtFromMso, msoNumberFormat,
  isR1C1, r1c1ToA1, anchorForeignFormulas,
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

  it('writes the number format the way Excel reads it, beside our own attribute', () => {
    const { html } = buildClipboardPayload([[cell('1,234.50', { value: '1234.5', format: { numFmt: '#,##0.00' } })]])
    expect(html).toContain('mso-number-format:&quot;\\#\\,\\#\\#0\\.00&quot;')
    expect(html).toContain('data-numfmt="#,##0.00"')
    expect(html).toContain('x:num="1234.5"')
    expect(html).toContain('xmlns:x="urn:schemas-microsoft-com:office:excel"')
  })

  it('writes no x:num for text', () => {
    const { html } = buildClipboardPayload([[cell('Total', { value: 'Total' })]])
    expect(html).not.toContain('x:num')
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

  it('round-trips the number behind a formatted display', () => {
    const source: ClipboardGrid = [[
      cell('1,234.50', { value: '1234.5', formula: '=A1*2', format: { numFmt: '#,##0.00', bold: true } }),
      cell('25%', { value: '0.25', format: { numFmt: '0%' } }),
    ]]
    const back = parseClipboardHtml(buildClipboardPayload(source).html)!
    expect(back[0]![0]).toEqual({ text: '1234.5', formula: '=A1*2', format: { numFmt: '#,##0.00', bold: true } })
    expect(back[0]![1]).toEqual({ text: '0.25', format: { numFmt: '0%' } })
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

  // What Excel for Windows puts on the clipboard, trimmed to the parts that
  // matter: formats live in a <style> block keyed by class, the formula in
  // x:fmla, the raw number in x:num, and the cell text is the DISPLAY.
  const excelHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:x="urn:schemas-microsoft-com:office:excel"><head>
<style>
<!--table
\t{mso-displayed-decimal-separator:"\\.";}
.xl65
\t{color:windowtext;
\tfont-size:11.0pt;
\tfont-weight:700;
\tfont-family:"Aptos Narrow", sans-serif;
\tmso-number-format:"0\\.00";
\ttext-align:general;
\twhite-space:nowrap;}
.xl66
\t{color:#C00000;
\tfont-size:14.0pt;
\tfont-style:italic;
\tmso-number-format:Percent;
\ttext-align:center;
\tbackground:#FFFF00;
\twhite-space:normal;}
-->
</style></head><body>
<table border=0 cellpadding=0 cellspacing=0 width=128>
<tr height=20>
  <td height=20 class=xl65 align=right x:num="1234.5" x:fmla="=A1*2">1,234.50</td>
  <td class=xl66 align=center x:num="0.25">25%</td>
</tr>
<tr height=20>
  <td class=xl65 x:num="7">7.00</td>
  <td class=xl66 style="font-style:normal;color:#00B050">Total&nbsp;here</td>
</tr>
</table></body></html>`

  it('keeps a self-contained block\'s formulas anchored at A1 and drops the ones that reach outside', () => {
    const grid: ClipboardGrid = [
      [{ text: 'Item' }, { text: 'Price' }, { text: 'Qty' }, { text: 'Total' }],
      [{ text: 'Lamp' }, { text: '10' }, { text: '3' }, { text: '30', formula: '=B2*C2' }],
      [{ text: 'Tray' }, { text: '5' }, { text: '4' }, { text: '20', formula: '=B3*C3' }],
      [{ text: '' }, { text: '' }, { text: '' }, { text: '50', formula: '=SUM(D2:D3)' }],
    ]
    const anchored = anchorForeignFormulas(grid)
    expect(anchored.origin).toEqual({ row: 0, col: 0 })
    expect(anchored.grid[1]![3]!.formula).toBe('=B2*C2')
    expect(anchored.grid[3]![3]!.formula).toBe('=SUM(D2:D3)')
    // A tax rate outside the block, a reference to another sheet: values.
    const reaching: ClipboardGrid = [
      [{ text: '10' }, { text: '2', formula: '=A1*$H$1' }, { text: '7', formula: '=Rates!B2' }],
    ]
    const dropped = anchorForeignFormulas(reaching)
    expect(dropped.origin).toBeNull()
    expect(dropped.grid[0]!.map((c) => c.formula)).toEqual([undefined, undefined, undefined])
    expect(dropped.grid[0]![1]!.text).toBe('2')
    // R1C1 (Google Sheets) is resolved where it lands, so it is left alone.
    const sheets: ClipboardGrid = [[{ text: '1' }, { text: '2', formula: '=R[0]C[-1]*2' }]]
    expect(anchorForeignFormulas(sheets).grid[0]![1]!.formula).toBe('=R[0]C[-1]*2')
    expect(anchorForeignFormulas(sheets).origin).toBeNull()
  })

  it('reads an Excel document: class styles, x:fmla, x:num and mso-number-format', () => {
    const grid = parseClipboardHtml(excelHtml)!
    expect(grid).toHaveLength(2)
    expect(grid[0]![0]).toEqual({
      text: '1234.5',
      formula: '=A1*2',
      format: { bold: true, fontFamily: 'Aptos Narrow', fontSize: 15, numFmt: '0.00' },
    })
    expect(grid[0]![1]).toEqual({
      text: '0.25',
      format: { italic: true, color: '#C00000', fill: '#FFFF00', align: 'center', fontSize: 19, numFmt: '0.00%', wrap: true },
    })
    expect(grid[1]![0]).toMatchObject({ text: '7', format: { numFmt: '0.00' } })
    expect(grid[1]![0]!.formula).toBeUndefined()
  })

  it('lets a cell\'s inline style override its class, and pastes NBSP as a space', () => {
    const grid = parseClipboardHtml(excelHtml)!
    const td = grid[1]![1]!
    expect(td.text).toBe('Total here')
    expect(td.format).toMatchObject({ color: '#00B050', fill: '#FFFF00', align: 'center' })
    expect(td.format?.italic).toBeUndefined()
  })

  it('treats windowtext and black as the automatic colour', () => {
    const html = '<table><tr><td style="color:black">a</td><td style="color:windowtext">b</td><td style="color:#000000">c</td><td style="color:#333">d</td></tr></table>'
    const [row] = parseClipboardHtml(html)!
    expect(row![0]!.format).toBeUndefined()
    expect(row![1]!.format).toBeUndefined()
    expect(row![2]!.format).toBeUndefined()
    expect(row![3]!.format).toEqual({ color: '#333' })
  })

  it('reads a Google Sheets document: data-sheets-formula, -value and -numberformat', () => {
    const html = `<meta charset="utf-8"><google-sheets-html-origin><style type="text/css"><!--td {border: 1px solid #cccccc;}br {mso-data-placement:same-cell;}--></style>
<table xmlns="http://www.w3.org/1999/xhtml" cellspacing="0" cellpadding="0" dir="ltr" border="1" style="table-layout:fixed;font-size:10pt;font-family:Arial;width:0px;border-collapse:collapse;border:none">
<colgroup><col width="100"/><col width="100"/></colgroup>
<tbody>
<tr style="height:21px;">
  <td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;font-weight:bold;" data-sheets-value="{&quot;1&quot;:2,&quot;2&quot;:&quot;Price&quot;}">Price</td>
  <td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;text-align:right;" data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:1234.5}" data-sheets-numberformat="{&quot;1&quot;:2,&quot;2&quot;:&quot;#,##0.00&quot;,&quot;3&quot;:1}">1,234.50</td>
</tr>
<tr style="height:21px;">
  <td data-sheets-value="{&quot;1&quot;:4,&quot;4&quot;:true}">TRUE</td>
  <td style="text-align:right;" data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:2469}" data-sheets-formula="=R[-1]C*2">2,469.00</td>
</tr>
</tbody></table>`
    const grid = parseClipboardHtml(html)!
    expect(grid[0]![0]).toEqual({ text: 'Price', format: { bold: true } })
    expect(grid[0]![1]).toEqual({ text: '1234.5', format: { align: 'right', numFmt: '#,##0.00' } })
    expect(grid[1]![0]).toEqual({ text: 'TRUE' })
    expect(grid[1]![1]).toMatchObject({ text: '2469', formula: '=R[-1]C*2' })
  })

  it('keeps our own attributes ahead of the foreign ones', () => {
    const html = '<table><tr><td data-formula="=B1" x:fmla="=A1" data-numfmt="0.0" style="mso-number-format:\'0\\.00\'">1</td></tr></table>'
    expect(parseClipboardHtml(html)![0]![0]).toEqual({ text: '1', formula: '=B1', format: { numFmt: '0.0' } })
  })

  it('keeps a number format whole when its sections are separated by ; inside the quotes', () => {
    const html = '<table><tr><td style="mso-number-format:&quot;0\\.00\\;\\[Red\\]0\\.00&quot;;font-weight:700">1</td></tr></table>'
    expect(parseClipboardHtml(html)![0]![0]!.format).toEqual({ numFmt: '0.00;[Red]0.00', bold: true })
  })

  it('font sizes come through in px, from pt or px', () => {
    const html = '<table><tr><td style="font-size:12pt">a</td><td style="font-size:16px">b</td><td style="font-size:0pt">c</td></tr></table>'
    const [row] = parseClipboardHtml(html)!
    expect(row![0]!.format).toEqual({ fontSize: 16 })
    expect(row![1]!.format).toEqual({ fontSize: 16 })
    expect(row![2]!.format).toBeUndefined()
  })

  it('reads the origin back', () => {
    const { html } = buildClipboardPayload([[cell('a')]], { row: 2, col: 5 })
    expect(readClipboardOrigin(html)).toEqual({ row: 2, col: 5 })
    expect(readClipboardOrigin('<table></table>')).toBeNull()
  })
})

describe('msoNumberFormat', () => {
  it('escapes every literal and quotes the code', () => {
    expect(msoNumberFormat('0.00')).toBe('"0\\.00"')
    expect(msoNumberFormat('#,##0.00')).toBe('"\\#\\,\\#\\#0\\.00"')
    expect(msoNumberFormat('"$"#,##0')).toBe('"\\0022\\$\\0022\\#\\,\\#\\#0"')
    expect(msoNumberFormat('m/d/yyyy')).toBe('"m\\/d\\/yyyy"')
  })

  it('is what numFmtFromMso reads back', () => {
    for (const code of ['0.00', '#,##0.00', '"$"#,##0.00;[Red]("$"#,##0.00)', 'm/d/yyyy h:mm', '0.00E+00', '@']) {
      expect(numFmtFromMso(msoNumberFormat(code))).toBe(code)
    }
  })
})

describe('R1C1', () => {
  it('recognises R1C1 references and leaves A1 alone', () => {
    expect(isR1C1('=R[-1]C*2')).toBe(true)
    expect(isR1C1('=SUM(R[-3]C:R[-1]C)')).toBe(true)
    expect(isR1C1('=R2C3')).toBe(true)
    expect(isR1C1('=RC[1]')).toBe(true)
    expect(isR1C1('=A1*2')).toBe(false)
    expect(isR1C1('=ROUND(C1, 2)')).toBe(false)
    expect(isR1C1('="R[-1]C"')).toBe(false)
    expect(isR1C1('=RC1')).toBe(true)
  })

  it('converts for the cell the formula lands in', () => {
    // At B2 (row 1, col 1).
    expect(r1c1ToA1('=R[-1]C*2', 1, 1)).toBe('=B1*2')
    expect(r1c1ToA1('=SUM(R[-1]C[-1]:R[-1]C[1])', 1, 1)).toBe('=SUM(A1:C1)')
    expect(r1c1ToA1('=RC[1]+R[1]C', 1, 1)).toBe('=C2+B3')
    expect(r1c1ToA1('=R2C3', 0, 0)).toBe('=$C$2')
    expect(r1c1ToA1('=R[1]C3', 0, 0)).toBe('=$C2')
    expect(r1c1ToA1('=R2C[1]', 0, 0)).toBe('=B$2')
    expect(r1c1ToA1('=RC', 4, 27)).toBe('=AB5')
  })

  it('leaves quoted text and an off-sheet reference as they are', () => {
    expect(r1c1ToA1('=IF(R[-1]C>0,"R[-1]C","no")', 1, 1)).toBe('=IF(B1>0,"R[-1]C","no")')
    expect(r1c1ToA1('=R[-1]C', 0, 0)).toBe('=R[-1]C')
  })
})

describe('numFmtFromMso', () => {
  it('unescapes the literals Excel escapes', () => {
    expect(numFmtFromMso('"0\\.00"')).toBe('0.00')
    expect(numFmtFromMso('"\\#\\,\\#\\#0\\.00"')).toBe('#,##0.00')
    expect(numFmtFromMso('"\\0022\\$\\0022\\#\\,\\#\\#0"')).toBe('"$"#,##0')
    expect(numFmtFromMso('"m\\/d\\/yyyy"')).toBe('m/d/yyyy')
    expect(numFmtFromMso('"\\@"')).toBe('@')
  })

  it('maps the named formats and drops General', () => {
    expect(numFmtFromMso('General')).toBeUndefined()
    expect(numFmtFromMso('Percent')).toBe('0.00%')
    expect(numFmtFromMso('"Short Date"')).toBe('m/d/yyyy')
    expect(numFmtFromMso('Standard')).toBe('#,##0.00')
    expect(numFmtFromMso('')).toBeUndefined()
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

  it('turns an R1C1 formula into A1 for the destination, ignoring the offset', () => {
    const got = resolvePasteCell(cell('4', { formula: '=R[-1]C*2' }), '', { what: 'all' }, { rows: 5, cols: 5 }, { row: 3, col: 2 })
    expect(got).toEqual({ kind: 'both', value: '=C3*2', format: undefined })
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

  it('turns the formulas of a transposed paste rather than shifting them', () => {
    // A price column with a total beside it, copied from A1 and laid on
    // its side at F6: every cell (r, c) lands at (6 + c, 5 + r), and a
    // total that read the price beside it reads the price above it now.
    const block: ClipboardGrid = [
      [cell('Price'), cell('Total')],
      [cell('10'), cell('20', { formula: '=A2*2' })],
      [cell('30'), cell('60', { formula: '=A3*2' })],
    ]
    const plan = planPaste(block, { row: 5, col: 5 }, { transpose: true }, { row: 0, col: 0 })
    expect(plan[0]!.offset).toEqual({ rows: 0, cols: 0 })
    const at = (row: number, col: number) => plan.find((p) => p.row === row && p.col === col)!
    // B2 (row 1, col 1) lands at G7 (row 6, col 6); A2, the price beside it,
    // lands at G6, the cell above, and that is what the total reads now.
    expect(at(6, 6).turn).toEqual({ source: { row: 1, col: 1 }, dest: { row: 6, col: 6 } })
    expect(resolvePasteCell(at(6, 6).source, '', {}, at(6, 6).offset, undefined, at(6, 6).turn)).toEqual({ kind: 'both', value: '=G6*2', format: undefined })
    expect(resolvePasteCell(at(6, 7).source, '', {}, at(6, 7).offset, undefined, at(6, 7).turn)).toEqual({ kind: 'both', value: '=H6*2', format: undefined })
    // Without a transpose the same block is shifted, not turned.
    const plain = planPaste(block, { row: 5, col: 5 }, {}, { row: 0, col: 0 })
    expect(plain.find((p) => p.row === 6 && p.col === 6)!.turn).toBeUndefined()
  })

  it('repeats one copied cell over the selection, each copy with its own offset', () => {
    const plan = planPaste([[cell('x', { formula: '=A1' })]], { row: 2, col: 2 }, {}, { row: 0, col: 0 }, { rows: 2, cols: 3 })
    expect(plan.map((p) => [p.row, p.col, p.offset.rows, p.offset.cols])).toEqual([
      [2, 2, 2, 2], [2, 3, 2, 3], [2, 4, 2, 4],
      [3, 2, 3, 2], [3, 3, 3, 3], [3, 4, 3, 4],
    ])
  })

  it('repeats a block over a selection that holds it a whole number of times', () => {
    const grid: ClipboardGrid = [[cell('a'), cell('b')], [cell('c'), cell('d')]]
    const plan = planPaste(grid, { row: 0, col: 0 }, {}, null, { rows: 4, cols: 2 })
    expect(plan).toHaveLength(8)
    expect(plan.map((p) => `${p.row},${p.col}:${p.source.text}`)).toEqual([
      '0,0:a', '0,1:b', '1,0:c', '1,1:d', '2,0:a', '2,1:b', '3,0:c', '3,1:d',
    ])
  })

  it('lands the block at the corner when the selection is no multiple of it', () => {
    const grid: ClipboardGrid = [[cell('a'), cell('b')], [cell('c'), cell('d')]]
    expect(planPaste(grid, { row: 0, col: 0 }, {}, null, { rows: 3, cols: 2 })).toHaveLength(4)
    expect(planPaste(grid, { row: 0, col: 0 }, {}, null, { rows: 1, cols: 1 })).toHaveLength(4)
    expect(planPaste(grid, { row: 0, col: 0 }, {}, null, { rows: 2, cols: 2 })).toHaveLength(4)
  })

  it('handles a ragged grid without emitting holes', () => {
    const ragged: ClipboardGrid = [[cell('a'), cell('b')], [cell('c')]]
    expect(planPaste(ragged, { row: 0, col: 0 })).toHaveLength(3)
  })
})
