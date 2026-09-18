/**
 * DOM tests for the sheet shell's four dialogs: Find and Replace searches
 * and replaces through the find target and lands on hits; Paste Special
 * reports the options chosen; Format Cells opens on the cell's format and
 * hands back only what changed; Insert Function filters and picks.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import type { GridCommandContext } from '@svgrid/grid/shortcuts'
import SvSheetFindReplace from './SvSheetFindReplace.svelte'
import SvSheetPasteSpecial from './SvSheetPasteSpecial.svelte'
import SvSheetFormatCells from './SvSheetFormatCells.svelte'
import SvSheetSort from './SvSheetSort.svelte'
import SvSheetInsertFunction from './SvSheetInsertFunction.svelte'
import SvSheetNameManager from './SvSheetNameManager.svelte'
import SvSheetGoalSeek from './SvSheetGoalSeek.svelte'
import SvSheetTextToColumns from './SvSheetTextToColumns.svelte'
import SvSheetRemoveDuplicates from './SvSheetRemoveDuplicates.svelte'
import SvSheetComment from './SvSheetComment.svelte'
import SvSheetDataValidation from './SvSheetDataValidation.svelte'
import SvSheetValidationAlert from './SvSheetValidationAlert.svelte'
import SvSheetConditionalFormat from './SvSheetConditionalFormat.svelte'
import { createWorkbook } from './sheet/workbook'
import { setFindTarget } from './sheet/find-replace'
import { functionCatalog } from './sheet/function-catalog'
import { FUNCTIONS } from './sheet/functions'

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => {
  if (comp) { unmount(comp); comp = null }
  if (host) { host.remove(); host = null }
  setFindTarget(null)
})
beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
})

// The modal portals to <body>, so queries go through the document.
const q = <T extends Element>(sel: string) => document.querySelector<T>(sel)
const qa = (sel: string) => [...document.querySelectorAll(sel)]
const button = (label: string) =>
  qa('.sv-modal button').find((b) => b.textContent?.trim() === label) as HTMLButtonElement
const click = (el: Element | undefined | null) => {
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  flushSync()
}
const typeInto = (input: HTMLInputElement, text: string) => {
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
  flushSync()
}

function fakeCmd(raw: string[][], active = { row: 0, col: 0 }) {
  const cmd = {
    api: {} as never,
    editing: false,
    activeCell: { rowIndex: active.row, colIndex: active.col, columnId: `c${active.col}` },
    rowCount: raw.length,
    colCount: raw[0]?.length ?? 0,
    ranges: [],
    columnIdAt: (c: number) => `c${c}`,
    getCellValue: (r: number, c: number) => raw[r]?.[c],
    setCellValue: (r: number, c: number, v: unknown) => { raw[r]![c] = String(v) },
    setActiveCell: vi.fn((r: number, c: number) => { cmd.activeCell = { rowIndex: r, colIndex: c, columnId: `c${c}` } }),
    setSelection: vi.fn(),
    extendSelection: vi.fn(),
    scrollIntoView: vi.fn(),
    startEditing: vi.fn(() => true),
    batch: <T,>(fn: () => T) => fn(),
    focus: vi.fn(),
    paste: vi.fn(async () => {}),
    recordUndo: vi.fn(),
  }
  setFindTarget({
    getRaw: (r, c) => raw[r]?.[c] ?? '',
    setRaw: (r, c, text) => { raw[r]![c] = text },
  })
  return cmd as unknown as GridCommandContext & typeof cmd
}

describe('SvSheetFindReplace (DOM)', () => {
  it('Find Next lands on the next hit and Replace All rewrites every match', () => {
    const raw = [['apple', 'pear'], ['apple pie', 'x']]
    const cmd = fakeCmd(raw)
    comp = mount(SvSheetFindReplace, { target: host!, props: { open: true, cmd: () => cmd } })
    flushSync()
    const inputs = qa('.sv-modal input[type="text"]') as HTMLInputElement[]
    typeInto(inputs[0]!, 'apple')
    click(button('Find Next'))
    // From A1, the next hit after the active cell is A2.
    expect(cmd.setActiveCell).toHaveBeenCalledWith(1, 0)
    expect(cmd.scrollIntoView).toHaveBeenCalledWith(1, 0)
    typeInto(inputs[1]!, 'plum')
    click(button('Replace All'))
    expect(raw).toEqual([['plum', 'pear'], ['plum pie', 'x']])
    expect(q('.sv-modal .status')?.textContent).toContain('2 replacements')
  })

  it('says so when nothing matches', () => {
    const cmd = fakeCmd([['a']])
    comp = mount(SvSheetFindReplace, { target: host!, props: { open: true, cmd: () => cmd } })
    flushSync()
    typeInto(q<HTMLInputElement>('.sv-modal input[type="text"]')!, 'zzz')
    click(button('Find All'))
    expect(q('.sv-modal .status')?.textContent).toMatch(/couldn't find/)
  })
})

describe('SvSheetPasteSpecial (DOM)', () => {
  it('reports the chosen options on OK and nothing on Cancel', () => {
    const onPaste = vi.fn()
    comp = mount(SvSheetPasteSpecial, { target: host!, props: { open: true, hasClipboard: true, onPaste } })
    flushSync()
    const radio = (label: string) =>
      qa('.sv-modal label').find((l) => l.textContent?.trim() === label)?.querySelector('input') as HTMLInputElement
    radio('Values').click()
    radio('Add').click()
    const transpose = qa('.sv-modal label').find((l) => l.textContent?.includes('Transpose'))?.querySelector('input') as HTMLInputElement
    transpose.click()
    flushSync()
    click(button('OK'))
    expect(onPaste).toHaveBeenCalledWith({ what: 'values', operation: 'add', skipBlanks: false, transpose: true })
  })

  it('disables OK without a copy to paste', () => {
    comp = mount(SvSheetPasteSpecial, { target: host!, props: { open: true, hasClipboard: false, onPaste: vi.fn() } })
    flushSync()
    expect(button('OK').disabled).toBe(true)
    expect(q('.sv-modal .status')?.textContent).toMatch(/Copy a range first/)
  })
})

describe('SvSheetFormatCells (DOM)', () => {
  it('opens on the cell format and hands back only the fields that changed', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetFormatCells, {
      target: host!,
      props: { open: true, entry: { numFmt: '0.00%', bold: true, fill: '#FFFF00' }, sample: 0.25, onApply },
    })
    flushSync()
    // Number tab: Percentage is selected and the sample reads as one.
    expect(q('.sv-modal [role="option"][aria-selected="true"]')?.textContent).toBe('Percentage')
    expect(q('.sv-modal .sample-text')?.textContent).toBe('25.00%')
    click(qa('.sv-modal [role="option"]').find((o) => o.textContent === 'Currency'))
    expect(q('.sv-modal .sample-text')?.textContent).toBe('$0.25')
    // Font tab: bold is on; turn on italic too.
    click(qa('.sv-modal [role="tab"]').find((t) => t.textContent === 'Font'))
    const box = (label: string) =>
      qa('.sv-modal label').find((l) => l.textContent?.trim() === label)?.querySelector('input') as HTMLInputElement
    expect(box('Bold').checked).toBe(true)
    box('Italic').click()
    flushSync()
    click(button('OK'))
    expect(onApply).toHaveBeenCalledTimes(1)
    const [patch, border] = onApply.mock.calls[0]!
    expect(patch).toEqual({ numFmt: '$#,##0.00;($#,##0.00)', italic: true })
    expect(border).toBeNull()
  })

  it('Accounting takes a symbol and decimals, Special a type, and each opens on its own pattern', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetFormatCells, {
      target: host!,
      props: { open: true, entry: { numFmt: '_("\u20ac"* #,##0.0_);_("\u20ac"* (#,##0.0);_("\u20ac"* "-"?_);_(@_)' }, sample: 1234.5, onApply },
    })
    flushSync()
    expect(q('.sv-modal [role="option"][aria-selected="true"]')?.textContent).toBe('Accounting')
    const symbol = qa('.sv-modal label').find((l) => l.textContent?.trim().startsWith('Symbol'))?.querySelector('select') as HTMLSelectElement
    expect(symbol.value).toBe('\u20ac')
    expect(q('.sv-modal .sample-text')?.textContent).toBe(' \u20ac 1,234.5 ')
    click(qa('.sv-modal [role="option"]').find((o) => o.textContent === 'Special'))
    const type = qa('.sv-modal label').find((l) => l.textContent?.trim().startsWith('Type'))?.querySelector('select') as HTMLSelectElement
    type.value = 'ssn'
    type.dispatchEvent(new Event('change', { bubbles: true }))
    flushSync()
    expect(q('.sv-modal .sample-text')?.textContent).toBe('000-00-1235')
    click(button('OK'))
    expect(onApply.mock.calls[0]![0]).toEqual({ numFmt: '000-00-0000' })
  })

  it('the Protection tab unlocks a cell, and sends nothing when the box is left as it was', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetFormatCells, {
      target: host!,
      props: { open: true, entry: { bold: true }, sample: 1, onApply },
    })
    flushSync()
    click(qa('.sv-modal [role="tab"]').find((t) => t.textContent === 'Protection'))
    const box = qa('.sv-modal label').find((l) => l.textContent?.trim() === 'Locked')?.querySelector('input') as HTMLInputElement
    // Locked is the default, so an untouched cell opens checked.
    expect(box.checked).toBe(true)
    expect(box.indeterminate).toBe(false)
    box.click()
    flushSync()
    click(button('OK'))
    expect(onApply.mock.calls[0]![0]).toEqual({ locked: false })
  })

  it('the Protection tab opens indeterminate on a mixed selection and leaves it alone unless clicked', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetFormatCells, {
      target: host!,
      props: { open: true, entry: {}, sample: 1, mixedLocked: true, onApply },
    })
    flushSync()
    click(qa('.sv-modal [role="tab"]').find((t) => t.textContent === 'Protection'))
    const box = qa('.sv-modal label').find((l) => l.textContent?.trim() === 'Locked')?.querySelector('input') as HTMLInputElement
    expect(box.indeterminate).toBe(true)
    click(button('OK'))
    expect(onApply.mock.calls[0]![0]).toEqual({})
    expect('locked' in onApply.mock.calls[0]![0]).toBe(false)
  })

  it('relocking a cell removes the flag rather than storing true', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetFormatCells, {
      target: host!,
      props: { open: true, entry: { locked: false }, sample: 1, onApply },
    })
    flushSync()
    click(qa('.sv-modal [role="tab"]').find((t) => t.textContent === 'Protection'))
    const box = qa('.sv-modal label').find((l) => l.textContent?.trim() === 'Locked')?.querySelector('input') as HTMLInputElement
    expect(box.checked).toBe(false)
    box.click()
    flushSync()
    click(button('OK'))
    const patch = onApply.mock.calls[0]![0]
    expect('locked' in patch).toBe(true)
    expect(patch.locked).toBeUndefined()
  })

  it('clears a format by sending undefined, and passes a border preset through', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetFormatCells, {
      target: host!,
      props: { open: true, entry: { numFmt: '#,##0.00', fill: '#FFFF00' }, sample: 1234.5, onApply },
    })
    flushSync()
    click(qa('.sv-modal [role="option"]').find((o) => o.textContent === 'General'))
    click(qa('.sv-modal [role="tab"]').find((t) => t.textContent === 'Fill'))
    click(q('.sv-modal .swatch.none'))
    click(qa('.sv-modal [role="tab"]').find((t) => t.textContent === 'Border'))
    const outline = qa('.sv-modal label').find((l) => l.textContent?.trim() === 'Outline')?.querySelector('input') as HTMLInputElement
    outline.click()
    flushSync()
    click(button('OK'))
    const [patch, border] = onApply.mock.calls[0]!
    expect(patch).toEqual({ numFmt: undefined, fill: undefined })
    expect('numFmt' in patch && 'fill' in patch).toBe(true)
    expect(border).toBe('outside')
  })
})

describe('SvSheetNameManager (DOM)', () => {
  it('lists the names with their values, adds one on the active sheet, and deletes', () => {
    const wb = createWorkbook([{ name: 'Data', cells: [['5', '=A1*2']] }])
    wb.names.define('Base', '=Data!$A$1')
    const onChange = vi.fn()
    comp = mount(SvSheetNameManager, { target: host!, props: { open: true, workbook: wb, onChange } })
    flushSync()
    const rowsText = () => qa('.sv-modal tbody tr').map((r) => r.textContent?.replace(/\s+/g, ' ').trim())
    expect(rowsText()[0]).toContain('Base')
    expect(rowsText()[0]).toContain('=Data!$A$1')
    expect(rowsText()[0]).toContain('5')
    typeInto(q<HTMLInputElement>('.sv-modal input[placeholder="TaxRate"]')!, 'Double')
    typeInto(q<HTMLInputElement>('.sv-modal input[placeholder*="Inputs"]')!, 'B1')
    q<HTMLFormElement>('.sv-modal form')!.requestSubmit()
    flushSync()
    expect(wb.names.list().map((n) => [n.name, n.refersTo])).toEqual([['Base', '=Data!$A$1'], ['Double', '=Data!B1']])
    expect(onChange).toHaveBeenCalledTimes(1)
    click(qa('.sv-modal button').find((b) => b.textContent === 'Delete'))
    expect(wb.names.has('Base')).toBe(false)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('refuses a name that is not valid and says why', () => {
    const wb = createWorkbook([{ name: 'Data', cells: [['1']] }])
    comp = mount(SvSheetNameManager, { target: host!, props: { open: true, workbook: wb, onChange: vi.fn() } })
    flushSync()
    typeInto(q<HTMLInputElement>('.sv-modal input[placeholder="TaxRate"]')!, 'A1')
    typeInto(q<HTMLInputElement>('.sv-modal input[placeholder*="Inputs"]')!, 'B1')
    q<HTMLFormElement>('.sv-modal form')!.requestSubmit()
    flushSync()
    expect(q('.sv-modal [role="alert"]')?.textContent).toMatch(/not a valid name/)
    expect(wb.names.list()).toEqual([])
  })
})

describe('SvSheetGoalSeek (DOM)', () => {
  it('opens on the active cell, solves, and OK writes the answer through the command context', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['5', '=A1*3']] }])
    const raw = [['5', '=A1*3']]
    const cmd = fakeCmd(raw, { row: 0, col: 1 })
    ;(cmd as { setCellValue: (r: number, c: number, v: unknown) => void }).setCellValue = vi.fn((r, c, v) => { wb.setRaw('S', r, c, String(v)) })
    comp = mount(SvSheetGoalSeek, { target: host!, props: { open: true, workbook: wb, cmd: () => cmd } })
    flushSync()
    const inputs = qa('.sv-modal input') as HTMLInputElement[]
    expect(inputs[0]!.value).toBe('B1')
    typeInto(inputs[1]!, '30')
    typeInto(inputs[2]!, 'A1')
    click(button('OK'))
    expect(q('.sv-modal__title')?.textContent).toBe('Goal Seek Status')
    expect(q('.sv-modal')?.textContent).toMatch(/A1 becomes:\s*10/)
    // The input was restored while the solver searched.
    expect(wb.getRaw('S', 0, 0)).toBe('5')
    click(button('OK'))
    expect(cmd.setCellValue).toHaveBeenCalledWith(0, 0, '10')
    expect(cmd.setActiveCell).toHaveBeenCalledWith(0, 0)
  })
})

describe('SvSheetTextToColumns (DOM)', () => {
  it('guesses the delimiter, previews, and writes the split in one batch', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['a;b'], ['c;d']] }])
    const raw = [['a;b'], ['c;d']]
    const cmd = fakeCmd(raw)
    const writes: Array<[number, number, unknown]> = []
    ;(cmd as { setCellValue: (r: number, c: number, v: unknown) => void }).setCellValue = (r, c, v) => { writes.push([r, c, v]) }
    const onDone = vi.fn()
    comp = mount(SvSheetTextToColumns, { target: host!, props: { open: true, workbook: wb, cmd: () => cmd, onDone } })
    flushSync()
    expect(q<HTMLInputElement>('.sv-modal input[value="semicolon"]')!.checked).toBe(true)
    expect(qa('.sv-modal .preview td').map((td) => td.textContent)).toEqual(['a', 'b', 'c', 'd'])
    click(button('Finish'))
    expect(writes).toEqual([[0, 0, 'a'], [0, 1, 'b'], [1, 0, 'c'], [1, 1, 'd']])
    expect(onDone).toHaveBeenCalledWith('Split 2 rows into 2 columns.')
    expect(cmd.extendSelection).toHaveBeenCalledWith(1, 1)
  })
})

describe('SvSheetRemoveDuplicates (DOM)', () => {
  it('lists the block columns and closes duplicates up, reporting the count', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['Name', 'City'], ['Ana', 'Lisbon'], ['ana', 'Lisbon'], ['Ben', 'Lagos']] }])
    const raw = [['Name', 'City'], ['Ana', 'Lisbon'], ['ana', 'Lisbon'], ['Ben', 'Lagos']]
    const cmd = fakeCmd(raw)
    const writes: Array<[number, number, unknown]> = []
    ;(cmd as { setCellValue: (r: number, c: number, v: unknown) => void }).setCellValue = (r, c, v) => { writes.push([r, c, v]) }
    const onDone = vi.fn()
    comp = mount(SvSheetRemoveDuplicates, { target: host!, props: { open: true, workbook: wb, cmd: () => cmd, onDone } })
    flushSync()
    expect(qa('.sv-modal .group label').map((l) => l.textContent?.trim())).toEqual(['Name', 'City'])
    click(button('OK'))
    // Case-insensitive, as Excel's is: the second Ana goes, Ben moves up, the last row blanks.
    expect(writes).toEqual([
      [1, 0, 'Ana'], [1, 1, 'Lisbon'],
      [2, 0, 'Ben'], [2, 1, 'Lagos'],
      [3, 0, ''], [3, 1, ''],
    ])
    expect(onDone).toHaveBeenCalledWith('1 duplicate value found and removed; 2 unique values remain.')
  })
})

describe('SvSheetInsertFunction (DOM)', () => {
  it('lists every engine function with a signature', () => {
    const names = functionCatalog().map((f) => f.name)
    for (const name of Object.keys(FUNCTIONS)) expect(names).toContain(name)
    expect(names).toContain('IF')
    for (const f of functionCatalog()) expect(f.signature).toMatch(new RegExp(`^${f.name}\\(`))
  })

  it('filters on the search text and picks with Enter', () => {
    const onPick = vi.fn()
    comp = mount(SvSheetInsertFunction, { target: host!, props: { open: true, onPick } })
    flushSync()
    const search = q<HTMLInputElement>('.sv-modal input[type="text"]')!
    typeInto(search, 'xlook')
    expect(qa('.sv-modal [role="option"]').map((o) => o.textContent)).toEqual(['XLOOKUP'])
    expect(q('.sv-modal .signature')?.textContent).toContain('XLOOKUP(')
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    flushSync()
    expect(onPick).toHaveBeenCalledWith('XLOOKUP')
  })

  it('narrows by category', () => {
    comp = mount(SvSheetInsertFunction, { target: host!, props: { open: true, onPick: vi.fn() } })
    flushSync()
    const select = q<HTMLSelectElement>('.sv-modal select')!
    select.value = 'Date & Time'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    flushSync()
    const shown = qa('.sv-modal [role="option"]').map((o) => o.textContent)
    expect(shown).toEqual(functionCatalog().filter((f) => f.group === 'Date & Time').map((f) => f.name))
    expect(shown).toContain('EOMONTH')
    expect(shown).toContain('NETWORKDAYS')
    expect(shown).not.toContain('SUM')
  })
})

describe('SvSheetSort (DOM)', () => {
  it('opens on the active column with the headers guessed, adds a level, hands the keys back', () => {
    const onApply = vi.fn()
    const workbook = createWorkbook([{ name: 'S', cells: [['Region', 'Amount'], ['East', '10'], ['West', '5']] }])
    comp = mount(SvSheetSort, {
      target: host!,
      props: { open: true, workbook, block: { top: 0, left: 0, bottom: 2, right: 1 }, headerGuess: true, activeCol: 1, onApply },
    })
    flushSync()
    const selects = () => qa('.sv-modal select') as HTMLSelectElement[]
    expect(selects()[0]!.value).toBe('1')
    expect([...selects()[0]!.options].map((o) => o.textContent)).toEqual(['Region', 'Amount'])
    click(button('Add Level'))
    expect(selects()).toHaveLength(4)
    expect(selects()[2]!.value).toBe('0')
    selects()[1]!.value = 'desc'
    selects()[1]!.dispatchEvent(new Event('change', { bubbles: true }))
    flushSync()
    // Without headers the columns are named by letter.
    const headers = qa('.sv-modal label').find((l) => l.textContent?.includes('My data has headers'))?.querySelector('input') as HTMLInputElement
    headers.click()
    flushSync()
    expect([...selects()[0]!.options].map((o) => o.textContent)).toEqual(['Column A', 'Column B'])
    click(button('OK'))
    expect(onApply).toHaveBeenCalledWith([{ col: 1, direction: 'desc' }, { col: 0, direction: 'asc' }], false)
  })
})

describe('SvSheetDataValidation (DOM)', () => {
  const select = (label: string) =>
    qa('.sv-modal label').find((l) => l.textContent?.trim().startsWith(label))?.querySelector('select') as HTMLSelectElement
  const input = (label: string) =>
    qa('.sv-modal label').find((l) => l.textContent?.trim().startsWith(label))?.querySelector('input, textarea') as HTMLInputElement
  const pick = (el: HTMLSelectElement, value: string) => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); flushSync() }

  it('builds a whole-number rule with two bounds and hands it back on OK', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetDataValidation, { target: host!, props: { open: true, rule: undefined, address: 'A1:A5', onApply, onClear: vi.fn() } })
    flushSync()
    expect(q('.sv-modal .where')?.textContent).toBe('A1:A5')
    expect(button('OK').disabled).toBe(false)
    pick(select('Allow'), 'whole')
    expect(button('OK').disabled).toBe(true)
    typeInto(input('Minimum'), '1')
    typeInto(input('Maximum'), '10')
    click(qa('.sv-modal [role="tab"]').find((t) => t.textContent === 'Error Alert'))
    pick(select('Style'), 'warning')
    typeInto(input('Title'), 'Score')
    typeInto(input('Error message'), '1 to 10 only')
    click(button('OK'))
    expect(onApply).toHaveBeenCalledWith({
      allow: 'whole', operator: 'between', value1: '1', value2: '10', ignoreBlank: true, inCellDropdown: false,
      alert: { style: 'warning', title: 'Score', message: '1 to 10 only' },
    })
  })

  it('the Input Message tab rides on the rule, and an unticked box drops it', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetDataValidation, { target: host!, props: { open: true, rule: undefined, address: 'C2', onApply, onClear: vi.fn() } })
    flushSync()
    click(qa('.sv-modal [role="tab"]').find((t) => t.textContent === 'Input Message'))
    expect(input('Show input message').checked).toBe(true)
    typeInto(input('Title'), 'Quantity')
    typeInto(input('Input message'), 'Whole units, 1 to 500')
    click(button('OK'))
    expect(onApply.mock.calls[0]![0]).toMatchObject({ allow: 'any', input: { title: 'Quantity', message: 'Whole units, 1 to 500' } })

    unmount(comp!); comp = null
    const again = vi.fn()
    comp = mount(SvSheetDataValidation, {
      target: host!,
      props: { open: true, address: 'C2', onApply: again, onClear: vi.fn(), rule: { id: 'x', rects: [[1, 2, 1, 2]], allow: 'any', ignoreBlank: true, inCellDropdown: false, alert: { style: 'stop' }, input: { message: 'Hi' } } },
    })
    flushSync()
    click(qa('.sv-modal [role="tab"]').find((t) => t.textContent === 'Input Message'))
    expect(input('Input message').value).toBe('Hi')
    input('Show input message').click()
    flushSync()
    click(button('OK'))
    expect('input' in again.mock.calls[0]![0]).toBe(false)
  })

  it('opens on the rule it is given, a list keeps its dropdown, Clear All reports', () => {
    const onApply = vi.fn(); const onClear = vi.fn()
    comp = mount(SvSheetDataValidation, {
      target: host!,
      props: { open: true, address: 'B1', onApply, onClear, rule: { id: 'x', rects: [[0, 1, 0, 1]], allow: 'list', value1: 'Red,Green', ignoreBlank: false, inCellDropdown: true, alert: { style: 'stop' } } },
    })
    flushSync()
    expect(select('Allow').value).toBe('list')
    expect(input('Source').value).toBe('Red,Green')
    expect(input('Ignore blank').checked).toBe(false)
    expect(input('In-cell dropdown').checked).toBe(true)
    click(button('Clear All'))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('a single-bound operator drops the second bound; a formula is a fine bound', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetDataValidation, { target: host!, props: { open: true, rule: undefined, address: 'A1', onApply, onClear: vi.fn() } })
    flushSync()
    pick(select('Allow'), 'decimal')
    pick(select('Data'), 'greater')
    expect(input('Maximum')).toBeUndefined()
    typeInto(input('Value'), '=B1')
    click(button('OK'))
    expect(onApply.mock.calls[0]![0]).toMatchObject({ allow: 'decimal', operator: 'greater', value1: '=B1' })
    expect('value2' in onApply.mock.calls[0]![0]).toBe(false)
  })
})

describe('SvSheetConditionalFormat (DOM)', () => {
  it('Greater Than: the value and the style, the first of the Excel styles by default', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetConditionalFormat, { target: host!, props: { open: true, preset: 'greater', address: 'E2:E4', onApply } })
    flushSync()
    expect(q('.sv-modal__title')?.textContent).toBe('Greater Than')
    expect(button('OK').disabled).toBe(true)
    typeInto(q('.sv-modal input[aria-label="Value"]') as HTMLInputElement, '50000')
    click(button('OK'))
    expect(onApply).toHaveBeenCalledWith({ kind: 'cellIs', operator: 'greater', value1: '50000', style: { fill: '#FFC7CE', color: '#9C0006' } })
  })

  it('Between takes two values; Top 10 a count and the percent box; Duplicates the choice', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetConditionalFormat, { target: host!, props: { open: true, preset: 'between', address: 'A1', onApply } })
    flushSync()
    typeInto(q('.sv-modal input[aria-label="Lower value"]') as HTMLInputElement, '1')
    expect(button('OK').disabled).toBe(true)
    typeInto(q('.sv-modal input[aria-label="Upper value"]') as HTMLInputElement, '=B1')
    const style = q<HTMLSelectElement>('.sv-modal select[aria-label="Format style"]')!
    style.value = 'red-text'; style.dispatchEvent(new Event('change', { bubbles: true })); flushSync()
    click(button('OK'))
    expect(onApply).toHaveBeenCalledWith({ kind: 'cellIs', operator: 'between', value1: '1', value2: '=B1', style: { color: '#9C0006' } })
    unmount(comp!); comp = null
    const onApply2 = vi.fn()
    comp = mount(SvSheetConditionalFormat, { target: host!, props: { open: true, preset: 'top10', address: 'A1', onApply: onApply2 } })
    flushSync()
    typeInto(q('.sv-modal input[aria-label="How many"]') as HTMLInputElement, '3')
    ;(qa('.sv-modal label').find((l) => l.textContent?.includes('% of selected range'))?.querySelector('input') as HTMLInputElement).click()
    flushSync()
    click(button('OK'))
    expect(onApply2.mock.calls[0]![0]).toMatchObject({ kind: 'topBottom', top: true, rank: 3, percent: true })
  })

  it('opens on a rule for Edit Rule, with its values and its style picked', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetConditionalFormat, { target: host!, props: { open: true, preset: 'text', address: 'A1', onApply, rule: { id: 'x', rects: [], kind: 'text', match: 'contains', value: 'north', style: { fill: '#C6EFCE', color: '#006100' } } } })
    flushSync()
    expect((q('.sv-modal input[aria-label="Value"]') as HTMLInputElement).value).toBe('north')
    expect(q<HTMLSelectElement>('.sv-modal select[aria-label="Format style"]')!.value).toBe('green')
    click(button('OK'))
    expect(onApply).toHaveBeenCalledWith({ kind: 'text', match: 'contains', value: 'north', style: { fill: '#C6EFCE', color: '#006100' } })
  })
})

describe('SvSheetValidationAlert (DOM)', () => {
  it('Stop offers Retry and Cancel, with the rule\'s words', () => {
    const onRetry = vi.fn(); const onCancel = vi.fn(); const onAccept = vi.fn()
    comp = mount(SvSheetValidationAlert, { target: host!, props: { open: true, alert: { style: 'stop', title: 'Score', message: '1 to 10 only' }, onRetry, onAccept, onCancel } })
    flushSync()
    expect(q('.sv-modal__title')?.textContent).toBe('Score')
    expect(q('.sv-modal .message')?.textContent).toBe('1 to 10 only')
    expect(button('Yes')).toBeUndefined()
    click(button('Retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onAccept).not.toHaveBeenCalled()
  })

  it('Warning offers Yes, No and Cancel', () => {
    const onRetry = vi.fn(); const onCancel = vi.fn(); const onAccept = vi.fn()
    comp = mount(SvSheetValidationAlert, { target: host!, props: { open: true, alert: { style: 'warning', title: 'Check', message: 'Odd value' }, onRetry, onAccept, onCancel } })
    flushSync()
    expect(qa('.sv-modal .message').map((m) => m.textContent)).toEqual(['Odd value', 'Continue?'])
    click(button('No'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('Yes keeps the entry', () => {
    const onAccept = vi.fn()
    comp = mount(SvSheetValidationAlert, { target: host!, props: { open: true, alert: { style: 'warning', title: 't', message: 'm' }, onRetry: vi.fn(), onAccept, onCancel: vi.fn() } })
    flushSync()
    click(button('Yes'))
    expect(onAccept).toHaveBeenCalledTimes(1)
  })
})

describe('SvSheetComment (DOM)', () => {
  const box = () => host!.querySelector('textarea') as HTMLTextAreaElement
  const btn = (label: string) => [...host!.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)

  it('opens on the comment, reports every keystroke, and saves on Save', () => {
    const onDraft = vi.fn(); const onSave = vi.fn(); const onDelete = vi.fn()
    comp = mount(SvSheetComment, { target: host!, props: { text: 'Check this', address: 'B2', onDraft, onSave, onDelete } })
    flushSync()
    expect(box().value).toBe('Check this')
    expect(host!.querySelector('.head')?.textContent).toBe('B2')
    typeInto(box() as unknown as HTMLInputElement, 'Check this again')
    expect(onDraft).toHaveBeenLastCalledWith('Check this again')
    click(btn('Save'))
    expect(onSave).toHaveBeenCalledWith('Check this again')
  })

  it('Ctrl+Enter saves; Delete shows only when there is a comment', () => {
    const onSave = vi.fn(); const onDelete = vi.fn()
    comp = mount(SvSheetComment, { target: host!, props: { text: '', address: 'A1', onDraft: () => {}, onSave, onDelete } })
    flushSync()
    expect(btn('Delete')).toBeUndefined()
    typeInto(box() as unknown as HTMLInputElement, 'new')
    box().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))
    flushSync()
    expect(onSave).toHaveBeenCalledWith('new')
  })

  it('Delete reports a delete', () => {
    const onDelete = vi.fn()
    comp = mount(SvSheetComment, { target: host!, props: { text: 'x', address: 'A1', onDraft: () => {}, onSave: () => {}, onDelete } })
    flushSync()
    click(btn('Delete'))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
