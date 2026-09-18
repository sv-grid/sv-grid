import { describe, expect, it, vi } from 'vitest'
import { createWorkbook, isValidSheetName } from './workbook'

const budget = () => [
  { name: 'Budget', cells: [['10'], ['20'], ['=SUM(A1:A2)']] },
  { name: 'Summary', cells: [['=Budget!A3'], ['=Budget!A3*2']] },
]

describe('isValidSheetName', () => {
  it('accepts an ordinary name', () => {
    expect(isValidSheetName('Sheet1')).toBe(true)
    expect(isValidSheetName('Price list')).toBe(true)
  })

  it('rejects the characters Excel reserves for the reference grammar', () => {
    for (const bad of ['a:b', 'a/b', 'a?b', 'a*b', 'a[b]']) {
      expect(isValidSheetName(bad), bad).toBe(false)
    }
  })

  it('rejects empty and over-long names', () => {
    expect(isValidSheetName('')).toBe(false)
    expect(isValidSheetName('   ')).toBe(false)
    expect(isValidSheetName('x'.repeat(32))).toBe(false)
    expect(isValidSheetName('x'.repeat(31))).toBe(true)
  })
})

describe('the sheet list', () => {
  it('starts with one sheet when given nothing', () => {
    const wb = createWorkbook()
    expect(wb.sheets).toEqual(['Sheet1'])
    expect(wb.active).toBe('Sheet1')
  })

  it('adds a sheet with the next free default name', () => {
    const wb = createWorkbook()
    expect(wb.addSheet()).toBe('Sheet2')
    expect(wb.addSheet()).toBe('Sheet3')
  })

  it('skips a default name that is taken', () => {
    const wb = createWorkbook([{ name: 'Sheet2', cells: [] }])
    expect(wb.addSheet()).toBe('Sheet1')
    expect(wb.addSheet()).toBe('Sheet3')
  })

  it('inserts at a position', () => {
    const wb = createWorkbook()
    wb.addSheet('B')
    wb.addSheet('A', 0)
    expect(wb.sheets).toEqual(['A', 'Sheet1', 'B'])
  })

  it('makes a new sheet active', () => {
    const wb = createWorkbook()
    wb.addSheet('Data')
    expect(wb.active).toBe('Data')
  })

  it('refuses a duplicate name, case-insensitively', () => {
    const wb = createWorkbook()
    expect(() => wb.addSheet('sheet1')).toThrow(/already exists/)
  })

  it('refuses an invalid name with a message that says why', () => {
    expect(() => createWorkbook().addSheet('a/b')).toThrow(/not a valid sheet name/)
  })

  it('removes a sheet and moves the cursor off it', () => {
    const wb = createWorkbook(budget())
    wb.setActive('Budget')
    expect(wb.removeSheet('Budget')).toBe(true)
    expect(wb.sheets).toEqual(['Summary'])
    expect(wb.active).toBe('Summary')
  })

  it('refuses to remove the last sheet', () => {
    // A workbook with no sheets has nowhere to put the cursor, and Excel
    // refuses the same way.
    const wb = createWorkbook()
    expect(wb.removeSheet('Sheet1')).toBe(false)
    expect(wb.sheets).toHaveLength(1)
  })

  it('reads TRUE and FALSE typed into a cell as booleans, whatever their case', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['true', 'FALSE', '=IF(A1,1,2)', '=A1+1', 'truer']] }])
    expect(wb.getValue('S', 0, 0)).toBe(true)
    expect(wb.getValue('S', 0, 1)).toBe(false)
    expect(wb.getValue('S', 0, 2)).toBe(1)
    expect(wb.getValue('S', 0, 3)).toBe(2)
    expect(wb.getValue('S', 0, 4)).toBe('truer')
  })

  it('renames, following the active sheet', () => {
    const wb = createWorkbook()
    expect(wb.renameSheet('Sheet1', 'Data')).toBe(true)
    expect(wb.sheets).toEqual(['Data'])
    expect(wb.active).toBe('Data')
  })

  it('keeps the cells across a rename', () => {
    const wb = createWorkbook([{ name: 'A', cells: [['7']] }])
    wb.renameSheet('A', 'B')
    expect(wb.getValue('B', 0, 0)).toBe(7)
  })

  it('rewrites the formulas and names that point at the renamed sheet', () => {
    const wb = createWorkbook([
      { name: 'Orders', cells: [['1', '2'], ['3', '4']] },
      { name: 'Summary', cells: [['=Orders!B2', '=SUM(orders!A1:B2)', '="Orders!A1"', '=SUM(Sales)']] },
    ])
    wb.names.define('Sales', '=Orders!$A$1:$A$2')
    expect(wb.renameSheet('Orders', 'Q3 Sales')).toBe(true)
    expect(wb.getRaw('Summary', 0, 0)).toBe("='Q3 Sales'!B2")
    expect(wb.getRaw('Summary', 0, 1)).toBe("=SUM('Q3 Sales'!A1:B2)")
    // A string literal is not a reference, whatever it says.
    expect(wb.getRaw('Summary', 0, 2)).toBe('="Orders!A1"')
    expect(wb.names.list().find((n) => n.name === 'Sales')?.refersTo).toBe("='Q3 Sales'!$A$1:$A$2")
    expect(wb.getValue('Summary', 0, 0)).toBe(4)
    expect(wb.getValue('Summary', 0, 1)).toBe(10)
    expect(wb.getValue('Summary', 0, 3)).toBe(4)
  })

  it('refuses a rename onto another sheet', () => {
    const wb = createWorkbook(budget())
    expect(wb.renameSheet('Budget', 'Summary')).toBe(false)
  })

  it('allows a case-only rename', () => {
    const wb = createWorkbook([{ name: 'data', cells: [] }])
    expect(wb.renameSheet('data', 'Data')).toBe(true)
    expect(wb.sheets).toEqual(['Data'])
  })

  it('reorders', () => {
    const wb = createWorkbook([
      { name: 'A', cells: [] }, { name: 'B', cells: [] }, { name: 'C', cells: [] },
    ])
    expect(wb.moveSheet('C', 0)).toBe(true)
    expect(wb.sheets).toEqual(['C', 'A', 'B'])
    wb.moveSheet('C', 99)
    expect(wb.sheets).toEqual(['A', 'B', 'C'])
  })

  it('reports failure for an unknown sheet', () => {
    const wb = createWorkbook()
    expect(wb.removeSheet('Nope')).toBe(false)
    expect(wb.renameSheet('Nope', 'X')).toBe(false)
    expect(wb.moveSheet('Nope', 0)).toBe(false)
  })
})

describe('evaluation across sheets', () => {
  it('computes a local formula', () => {
    const wb = createWorkbook(budget())
    expect(wb.getValue('Budget', 2, 0)).toBe(30)
  })

  it('reads another sheet', () => {
    const wb = createWorkbook(budget())
    expect(wb.getValue('Summary', 0, 0)).toBe(30)
    expect(wb.getValue('Summary', 1, 0)).toBe(60)
  })

  it('recalculates across sheets when a source cell changes', () => {
    // The point of the graph spanning sheets: editing Budget!A1 has to reach
    // Summary!A1, which never mentions A1 directly.
    const wb = createWorkbook(budget())
    expect(wb.getValue('Summary', 1, 0)).toBe(60)
    wb.setRaw('Budget', 0, 0, '100')
    expect(wb.getValue('Budget', 2, 0)).toBe(120)
    expect(wb.getValue('Summary', 1, 0)).toBe(240)
  })

  it('reads a quoted sheet name', () => {
    const wb = createWorkbook([
      { name: 'Price list', cells: [['5']] },
      { name: 'Main', cells: [["='Price list'!A1*3"]] },
    ])
    expect(wb.getValue('Main', 0, 0)).toBe(15)
  })

  it('sums a whole column of another sheet', () => {
    const wb = createWorkbook([
      { name: 'Data', cells: [['1'], ['2'], ['3']] },
      { name: 'Main', cells: [['=SUM(Data!A)']] },
    ])
    expect(wb.getValue('Main', 0, 0)).toBe(6)
  })

  it('returns #REF! for a sheet that is not there', () => {
    const wb = createWorkbook([{ name: 'Main', cells: [['=Nope!A1']] }])
    expect(wb.getValue('Main', 0, 0)).toEqual({ error: '#REF!' })
  })

  it('treats a cell past the written area as BLANK, not an error', () => {
    const wb = createWorkbook([{ name: 'M', cells: [['1'], ['2']] }])
    expect(wb.getValue('M', 0, 1)).toBe('')
    expect(wb.getValue('M', 9, 9)).toBe('')
  })

  it('sums a range that runs past the written rows', () => {
    // The case that actually bites: =SUM(A1:A100) over a short sheet is an
    // ordinary thing to write, and #REF! for the empty rows would poison
    // every total on the sheet.
    // The total goes in column B: a =SUM(A1:A100) sitting INSIDE column A
    // is a genuine self-reference and Excel calls that circular too.
    const wb = createWorkbook([{ name: 'M', cells: [['1', '=SUM(A1:A100)'], ['2']] }])
    expect(wb.getValue('M', 0, 1)).toBe(3)
  })

  it('calls a range that contains its own formula circular, as Excel does', () => {
    const wb = createWorkbook([{ name: 'M', cells: [['1'], ['2'], ['=SUM(A1:A100)']] }])
    expect(wb.getValue('M', 2, 0)).toEqual({ error: '#CYCLE!' })
  })

  it('still returns #REF! for a negative index', () => {
    // Which is what a reference shifted off the top by a delete becomes.
    const wb = createWorkbook([{ name: 'M', cells: [['1']] }])
    expect(wb.getValue('M', -1, 0)).toEqual({ error: '#REF!' })
  })

  it('detects a cycle within a sheet', () => {
    const wb = createWorkbook([{ name: 'M', cells: [['=B1', '=A1']] }])
    expect(wb.getValue('M', 0, 0)).toEqual({ error: '#CYCLE!' })
  })

  it('detects a cycle ACROSS sheets', () => {
    const wb = createWorkbook([
      { name: 'A', cells: [['=B!A1']] },
      { name: 'B', cells: [['=A!A1']] },
    ])
    expect(wb.getValue('A', 0, 0)).toEqual({ error: '#CYCLE!' })
  })

  it('resolves a defined name', () => {
    const wb = createWorkbook([{ name: 'M', cells: [['5'], ['=Rate*2']] }])
    wb.names.define('Rate', '=M!A1')
    expect(wb.getValue('M', 1, 0)).toBe(10)
  })

  it('recomputes a formula when the cell behind its name changes', () => {
    // The formula never mentions A1, so the dependency has to come from the
    // name. It used to be missing, and the formula kept its first value
    // until something unrelated forced a recalculation.
    const wb = createWorkbook([{ name: 'M', cells: [['5'], ['=Rate*2']] }])
    wb.names.define('Rate', '=M!A1')
    expect(wb.getValue('M', 1, 0)).toBe(10)
    wb.setRaw('M', 0, 0, '50')
    expect(wb.getValue('M', 1, 0)).toBe(100)
  })

  it('treats a name defined as a range as that range', () => {
    // =SUM(Sales) over a named column is the whole point of naming it. A
    // scalar read collapsed it to its top-left cell.
    const wb = createWorkbook([{
      name: 'M',
      cells: [['10'], ['20'], ['30'], ['=SUM(Sales)'], ['=COUNTIF(Sales,">15")'], ['=Sales']],
    }])
    wb.names.define('Sales', '=M!A1:A3')
    expect(wb.getValue('M', 3, 0)).toBe(60)
    expect(wb.getValue('M', 4, 0)).toBe(2)
    // In scalar position a range still collapses, as it does in Excel.
    expect(wb.getValue('M', 5, 0)).toBe(10)
  })

  it('recomputes when a name is redefined or removed', () => {
    const wb = createWorkbook([{ name: 'M', cells: [['5', '7'], ['=Rate*2']] }])
    wb.names.define('Rate', '=M!A1')
    expect(wb.getValue('M', 1, 0)).toBe(10)
    wb.names.define('Rate', '=M!B1')
    expect(wb.getValue('M', 1, 0)).toBe(14)
    wb.names.remove('Rate')
    expect(wb.getValue('M', 1, 0)).toEqual({ error: '#NAME?' })
  })

  it('follows a name defined as another name, and cuts a circular chain', () => {
    const wb = createWorkbook([{ name: 'M', cells: [['5'], ['=Outer*2'], ['=Loop']] }])
    wb.names.define('Inner', '=M!A1')
    wb.names.define('Outer', '=Inner')
    expect(wb.getValue('M', 1, 0)).toBe(10)
    wb.names.define('Loop', '=Loop')
    expect(wb.getValue('M', 2, 0)).toEqual({ error: '#NAME?' })
  })
})

describe('writing', () => {
  it('grows a sheet to reach a cell past the end', () => {
    const wb = createWorkbook()
    wb.setRaw('Sheet1', 3, 2, 'x')
    expect(wb.getRaw('Sheet1', 3, 2)).toBe('x')
    expect(wb.rowCount('Sheet1')).toBe(4)
  })

  it('ignores a write to a sheet that is not there', () => {
    const wb = createWorkbook()
    expect(() => wb.setRaw('Nope', 0, 0, 'x')).not.toThrow()
  })

  it('reports which cells changed', () => {
    const onRecalc = vi.fn()
    const wb = createWorkbook(budget(), { onRecalc })
    wb.getValue('Summary', 1, 0)
    onRecalc.mockClear()
    wb.setRaw('Budget', 0, 0, '5')
    const touched = onRecalc.mock.calls[0]![0] as Array<{ sheet: string }>
    expect(touched.some((c) => c.sheet === 'Summary')).toBe(true)
  })

  it('does not report when the text is unchanged', () => {
    const onRecalc = vi.fn()
    const wb = createWorkbook(budget(), { onRecalc })
    wb.setRaw('Budget', 0, 0, '10')
    expect(onRecalc).not.toHaveBeenCalled()
  })

  it('forgets the edges when a formula becomes a literal', () => {
    const wb = createWorkbook([{ name: 'M', cells: [['1'], ['=A1*2']] }])
    expect(wb.getValue('M', 1, 0)).toBe(2)
    wb.setRaw('M', 1, 0, '99')
    wb.setRaw('M', 0, 0, '50')
    expect(wb.getValue('M', 1, 0)).toBe(99)
  })
})

describe('structural edits reach other sheets', () => {
  it('shifts a cross-sheet reference into the edited sheet', () => {
    // Another sheet holding =Orders!A5 has to move exactly as a local
    // reference would when a row is inserted in Orders.
    const wb = createWorkbook([
      { name: 'Orders', cells: [['1'], ['2'], ['3']] },
      { name: 'Main', cells: [['=Orders!A3']] },
    ])
    expect(wb.getValue('Main', 0, 0)).toBe(3)
    wb.applyStructuralEdit('Orders', { kind: 'insertRows', at: 0, count: 1 })
    expect(wb.getRaw('Main', 0, 0)).toBe('=Orders!A4')
    expect(wb.getValue('Main', 0, 0)).toBe(3)
  })

  it('leaves an unrelated sheet alone', () => {
    // Rewriting an unqualified reference on another sheet would move it
    // against its OWN geometry, which never changed.
    const wb = createWorkbook([
      { name: 'Orders', cells: [['1']] },
      { name: 'Other', cells: [['=A1'], ['5']] },
    ])
    wb.applyStructuralEdit('Orders', { kind: 'insertRows', at: 0, count: 1 })
    expect(wb.getRaw('Other', 0, 0)).toBe('=A1')
  })

  it('leaves a qualified reference to ANOTHER sheet alone on the edited sheet', () => {
    // Summary holds =Orders!B2. Inserting a column in Summary must not move
    // it: it points into Orders, whose geometry did not change.
    const wb = createWorkbook([
      { name: 'Orders', cells: [['1', '2']] },
      { name: 'Summary', cells: [['=Orders!B1', '=A1*2']] },
    ])
    wb.applyStructuralEdit('Summary', { kind: 'insertCols', at: 0, count: 1 })
    expect(wb.getRaw('Summary', 0, 1)).toBe('=Orders!B1')
    expect(wb.getRaw('Summary', 0, 2)).toBe('=B1*2')
    expect(wb.getValue('Summary', 0, 1)).toBe(2)
  })

  it('moves only the names that refer to the edited sheet', () => {
    const wb = createWorkbook([
      { name: 'Orders', cells: [['1'], ['2']] },
      { name: 'Summary', cells: [['=SUM(Sales)'], ['x']] },
    ])
    wb.names.define('Sales', '=Orders!$A$1:$A$2')
    wb.names.define('Note', '=Summary!$A$2')
    wb.applyStructuralEdit('Summary', { kind: 'insertRows', at: 0, count: 1 })
    expect(wb.names.list().find((n) => n.name === 'Sales')?.refersTo).toBe('=Orders!$A$1:$A$2')
    expect(wb.names.list().find((n) => n.name === 'Note')?.refersTo).toBe('=Summary!$A$3')
    expect(wb.getValue('Summary', 1, 0)).toBe(3)
  })

  it('widens a local range that straddles an insertion', () => {
    const wb = createWorkbook([{ name: 'M', cells: [['=SUM(A2:A4)'], ['1'], ['2'], ['3']] }])
    wb.applyStructuralEdit('M', { kind: 'insertRows', at: 2, count: 1 })
    expect(wb.getRaw('M', 0, 0)).toBe('=SUM(A2:A5)')
  })

  it('deletes rows and breaks what pointed into them', () => {
    const wb = createWorkbook([{ name: 'M', cells: [['=A3'], ['1'], ['2']] }])
    wb.applyStructuralEdit('M', { kind: 'deleteRows', at: 2, count: 1 })
    expect(wb.getRaw('M', 0, 0)).toBe('=#REF!')
  })

  it('inserts and deletes columns', () => {
    const wb = createWorkbook([{ name: 'M', cells: [['a', 'b', 'c']] }])
    wb.applyStructuralEdit('M', { kind: 'insertCols', at: 1, count: 1 })
    expect(wb.getRaw('M', 0, 1)).toBe('')
    expect(wb.getRaw('M', 0, 2)).toBe('b')
    wb.applyStructuralEdit('M', { kind: 'deleteCols', at: 1, count: 1 })
    expect(wb.getRaw('M', 0, 1)).toBe('b')
  })

  it('rewrites defined names', () => {
    const wb = createWorkbook([{ name: 'M', cells: [['1'], ['2']] }])
    wb.names.define('Total', '=M!$A$2')
    wb.applyStructuralEdit('M', { kind: 'insertRows', at: 0, count: 1 })
    expect(wb.names.list()[0]!.refersTo).toBe('=M!$A$3')
  })
})

describe('evaluateText / evaluateRange', () => {
  it('evaluates a formula in a sheet without storing it, names and other sheets included', () => {
    const wb = createWorkbook(budget())
    wb.names.define('Total', 'Budget!A3')
    expect(wb.evaluateText('Summary', '=A1*10')).toBe(300)
    expect(wb.evaluateText('Summary', '=Budget!A1+1')).toBe(11)
    expect(wb.evaluateText('Budget', '=Total')).toBe(30)
    expect(wb.getRaw('Summary', 0, 0)).toBe('=Budget!A3')
    expect(wb.rowCount('Summary')).toBe(2)
  })

  it('coerces a literal the way a typed cell is', () => {
    const wb = createWorkbook(budget())
    expect(wb.evaluateText('Budget', '12')).toBe(12)
    expect(wb.evaluateText('Budget', 'true')).toBe(true)
    expect(wb.evaluateText('Budget', 'abc')).toBe('abc')
    expect(wb.evaluateText('Budget', '')).toBe('')
    expect(wb.evaluateText('Budget', '=1/0')).toEqual({ error: '#DIV/0!' })
    expect(wb.evaluateText('Nowhere', '=1')).toEqual({ error: '#REF!' })
  })

  it('hands back a range or a named range as a grid, and null for a formula', () => {
    const wb = createWorkbook(budget())
    wb.names.define('Both', 'Budget!A1:A2')
    expect(wb.evaluateRange('Budget', '=A1:A3')).toEqual([[10], [20], [30]])
    expect(wb.evaluateRange('Summary', '=Budget!A1:A2')).toEqual([[10], [20]])
    expect(wb.evaluateRange('Budget', '=Both')).toEqual([[10], [20]])
    expect(wb.evaluateRange('Budget', '=A1')).toEqual([[10]])
    expect(wb.evaluateRange('Budget', '=A1+A2')).toBeNull()
    expect(wb.evaluateRange('Budget', '1,2,3')).toBeNull()
  })
})

describe('serialize', () => {
  it('round-trips the sheets, the active one and the names', () => {
    const wb = createWorkbook(budget())
    wb.names.define('Tax', '=Budget!A1')
    wb.setActive('Summary')

    const snapshot = wb.serialize()
    expect(snapshot.active).toBe('Summary')
    expect(snapshot.names).toEqual({ Tax: '=Budget!A1' })

    const restored = createWorkbook(snapshot.sheets)
    expect(restored.sheets).toEqual(['Budget', 'Summary'])
    expect(restored.getValue('Summary', 0, 0)).toBe(30)
  })

  it('copies the cells rather than aliasing them', () => {
    const wb = createWorkbook(budget())
    const snapshot = wb.serialize()
    snapshot.sheets[0]!.cells[0]![0] = 'tampered'
    expect(wb.getRaw('Budget', 0, 0)).toBe('10')
  })
})

describe('snapshot', () => {
  it('computes the whole sheet as a rectangle', () => {
    const wb = createWorkbook([{ name: 'M', cells: [['1', '2'], ['=A1+B1']] }])
    expect(wb.snapshot('M')).toEqual([[1, 2], [3, '']])
  })
})

describe('copySheet', () => {
  it('copies the cells after the source, named the way Excel names a copy, and makes it active', () => {
    const wb = createWorkbook(budget())
    expect(wb.copySheet('Budget')).toBe('Budget (2)')
    expect(wb.sheets).toEqual(['Budget', 'Budget (2)', 'Summary'])
    expect(wb.active).toBe('Budget (2)')
    expect(wb.getValue('Budget (2)', 2, 0)).toBe(30)
    // The copy's formula reads its own sheet, so a change there stays there.
    wb.setRaw('Budget (2)', 0, 0, '100')
    expect(wb.getValue('Budget (2)', 2, 0)).toBe(120)
    expect(wb.getValue('Budget', 2, 0)).toBe(30)
    expect(wb.getValue('Summary', 0, 0)).toBe(30)
    expect(wb.copySheet('Budget')).toBe('Budget (3)')
  })

  it('takes a name, and declines an unknown source or a taken name', () => {
    const wb = createWorkbook(budget())
    expect(wb.copySheet('Budget', 'Plan')).toBe('Plan')
    expect(wb.copySheet('Nope')).toBeNull()
    expect(wb.copySheet('Budget', 'summary')).toBeNull()
    expect(wb.copySheet('Budget', 'a:b')).toBeNull()
  })
})
