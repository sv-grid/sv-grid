/**
 * The automatic and computed field types, and the parsers behind the safe
 * ones (rich text, button URLs, formulas).
 */
import { describe, expect, it } from 'vitest'
import { enableFields, registerLinkedTable, setCurrentUser } from './index'
import { addField, newRowValues } from './field-ops'
import { fillFieldColumn, registerFieldType } from './registry.svelte'
import { ME, compileCondition, filterKindOf, newCondition } from './filter-model'
import { compileFormula, formulaError } from './formula'
import { parseRichText } from './rich-text'
import { buttonUrl } from './button'
import { dateEditTokens, formatDuration, parseDuration } from './format'
import { summaryChoices } from './summaries'
import { getGridExtension } from '@svgrid/grid'

enableFields()

function fakeCtrl(rows: Record<string, unknown>[] = [{ name: 'a' }, { name: 'b' }]) {
  const events: unknown[] = []
  return {
    events,
    ctrl: {
      props: { onColumnAdd: (e: unknown) => events.push(e) },
      internalColumns: [{ id: 'name', field: 'name', header: 'Name' }] as Record<string, any>[],
      internalData: rows,
    } as any,
  }
}

describe('automatic fields', () => {
  it('autonumber numbers the existing rows and gives a new row the next number', () => {
    const { ctrl, events } = fakeCtrl()
    addField(ctrl, { name: 'No', fieldType: 'autoNumber', fieldProps: {} })
    expect(ctrl.internalData.map((r: any) => r.no)).toEqual([1, 2])
    expect((events[0] as { data?: unknown[] }).data).toHaveLength(2)
    expect(newRowValues(ctrl).no).toBe(3)
  })

  it('created time stamps existing rows; created by takes the current user for new rows', () => {
    const { ctrl } = fakeCtrl()
    addField(ctrl, { name: 'Created', fieldType: 'createdTime', fieldProps: {} })
    expect(typeof ctrl.internalData[0].created).toBe('string')
    setCurrentUser({ id: 'u1', name: 'Ana' })
    addField(ctrl, { name: 'Author', fieldType: 'createdBy', fieldProps: {} })
    expect(newRowValues(ctrl).author).toBe('u1')
    setCurrentUser(null)
  })

  it('defaults: a field default, today for a date, and the row adder\'s own values win', () => {
    const { ctrl } = fakeCtrl()
    addField(ctrl, { name: 'Status', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Todo' }], default: 'Todo' } })
    addField(ctrl, { name: 'Due', fieldType: 'date', fieldProps: { defaultToday: true } })
    const row = newRowValues(ctrl, { status: 'Done' })
    expect(row.status).toBe('Done')
    expect(row.due).toBe(new Date().toISOString().slice(0, 10))
  })

  it('last modified time stamps a row when a watched field changes, and only then', () => {
    const { ctrl } = fakeCtrl()
    ctrl.internalColumns.push({ id: 'qty', field: 'qty', header: 'Qty' })
    addField(ctrl, { name: 'Touched', fieldType: 'lastModifiedTime', fieldProps: { watch: 'specific', watchFields: ['qty'] } })
    const row: Record<string, unknown> = { name: 'a', qty: 1 }
    const edited = getGridExtension()!.cellEdited!
    edited(ctrl, { row, columnId: 'name' })
    expect(row.touched).toBeUndefined()
    edited(ctrl, { row, columnId: 'qty' })
    expect(typeof row.touched).toBe('string')
  })

  it('last modified by keeps the last author when nobody is signed in; the time still moves', () => {
    const { ctrl } = fakeCtrl()
    addField(ctrl, { name: 'Editor', fieldType: 'lastModifiedBy', fieldProps: {} })
    addField(ctrl, { name: 'Touched', fieldType: 'lastModifiedTime', fieldProps: {} })
    const row: Record<string, unknown> = { name: 'a' }
    const edited = getGridExtension()!.cellEdited!
    setCurrentUser({ id: 'u1', name: 'Ana' })
    edited(ctrl, { row, columnId: 'name' })
    expect(row.editor).toBe('u1')
    setCurrentUser(null)
    row.touched = 'before'
    edited(ctrl, { row, columnId: 'name' })
    expect(row.editor).toBe('u1')
    expect(row.touched).not.toBe('before')
  })
})

describe('linked records', () => {
  registerLinkedTable({
    id: 'people',
    name: 'People',
    primaryField: 'name',
    rows: [
      { id: 'p1', name: 'Ana', hours: 5 },
      { id: 'p2', name: 'Ben', hours: 7 },
    ],
    fields: [{ field: 'name', header: 'Name' }, { field: 'hours', header: 'Hours' }],
  })
  const columns = [{ id: 'team', field: 'team', header: 'Team', fieldType: 'link', fieldProps: { table: 'people' } }]
  const row = { team: ['p1', 'p2', 'missing'] }

  it('a link shows the linked rows\' primary field', () => {
    const col = fillFieldColumn(columns[0]!, columns)
    expect((col.formatter as (c: { value: unknown }) => string)({ value: row.team })).toBe('Ana, Ben')
    expect(col.editorType).toBe('fieldLink')
  })

  it('lookup, rollup and count read the linked rows', () => {
    const fn = (fieldType: string, fieldProps: Record<string, unknown>) =>
      fillFieldColumn({ field: 'x', fieldType, fieldProps }, columns).fieldFn as (r: unknown) => unknown
    expect(fn('lookup', { linkField: 'team', field: 'name' })(row)).toEqual(['Ana', 'Ben'])
    expect(fn('rollup', { linkField: 'team', field: 'hours', aggregation: 'SUM' })(row)).toBe(12)
    expect(fn('rollup', { linkField: 'team', field: 'hours', aggregation: 'MAX' })(row)).toBe(7)
    expect(fn('rollup', { linkField: 'team', field: 'name', aggregation: 'ARRAYJOIN' })(row)).toBe('Ana, Ben')
    expect(fn('count', { linkField: 'team' })(row)).toBe(2)
  })

  it('a numeric rollup is a number column, so the footer offers Sum and Average', () => {
    const col = (aggregation: string) => fillFieldColumn({ field: 'x', fieldType: 'rollup', fieldProps: { linkField: 'team', field: 'hours', aggregation } }, columns)
    for (const agg of ['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'COUNTA', 'COUNTALL']) {
      expect(col(agg).cellDataType).toBe('number')
      expect(summaryChoices(col(agg)).map((c) => c.value)).toContain('sum')
    }
    expect(col('ARRAYJOIN').cellDataType).toBeUndefined()
    expect(summaryChoices(col('ARRAYJOIN')).map((c) => c.value)).not.toContain('sum')
  })

  it('a lookup shows each value as its source field would, when the linked table says its type', () => {
    registerLinkedTable({
      id: 'events',
      name: 'Events',
      primaryField: 'name',
      rows: [{ id: 'e1', name: 'Launch', on: '2026-10-31', cost: 1200 }],
      fields: [
        { field: 'on', header: 'On', fieldType: 'date', fieldProps: { dateFormat: 'iso' } },
        { field: 'cost', header: 'Cost', fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', precision: 0, separators: 'comma-period' } },
      ],
    })
    const cols = [{ id: 'ev', field: 'ev', fieldType: 'link', fieldProps: { table: 'events' } }]
    const show = (field: string) => {
      const col = fillFieldColumn({ field: 'x', fieldType: 'lookup', fieldProps: { linkField: 'ev', field } }, cols)
      return (col.formatter as (c: { value: unknown }) => string)({ value: (col.fieldFn as (r: unknown) => unknown)({ ev: ['e1'] }) })
    }
    expect(show('cost')).toBe('$1,200')
    expect(show('on')).toBe('2026-10-31')
  })
})

describe('formula language', () => {
  const names: Record<string, string> = { qty: 'qty', 'unit price': 'price', name: 'name', due: 'due' }
  const run = (src: string, row: Record<string, unknown>) => compileFormula(src, (n) => names[n.trim().toLowerCase()] ?? null).fn(row)

  it('arithmetic, joins, comparisons and IF', () => {
    expect(run('{Qty} * {Unit price} + 1', { qty: 2, price: 3 })).toBe(7)
    expect(run('{Name} & " (" & {Qty} & ")"', { name: 'Bolt', qty: 4 })).toBe('Bolt (4)')
    expect(run('IF({Qty} > 3, "many", "few")', { qty: 4 })).toBe('many')
    // IF is lazy: the division by zero in the branch not taken never runs.
    expect(run('IF({Qty} = 0, 0, 10 / {Qty})', { qty: 0 })).toBe(0)
    expect(run('10 / {Qty}', { qty: 0 })).toBeNull()
  })

  it('text, number and date functions', () => {
    expect(run('UPPER(LEFT({Name}, 3))', { name: 'bolts' })).toBe('BOL')
    expect(run('ROUND({Unit price}, 1)', { price: 2.46 })).toBe(2.5)
    expect(run('DATETIME_DIFF({Due}, "2026-10-01", "days")', { due: '2026-10-14' })).toBe(13)
    expect(run('SWITCH({Name}, "a", 1, "b", 2, 0)', { name: 'b' })).toBe(2)
  })

  it('a formula field shows its result with the number field\'s default places, and empty cells before it is written', () => {
    const cols = [{ field: 'qty', header: 'Qty' }, { field: 'cost', header: 'Cost' }]
    const shown = (fieldProps: Record<string, unknown>, row: Record<string, unknown>) => {
      const col = fillFieldColumn({ field: 'f', fieldType: 'formula', fieldProps: { separators: 'comma-period', ...fieldProps } }, cols)
      return (col.formatter as (c: { value: unknown }) => string)({ value: (col.fieldFn as (r: unknown) => unknown)(row) })
    }
    const row = { qty: 4, cost: 410.065 }
    expect(shown({ formula: '{Qty} * {Cost}', result: 'currency' }, row)).toBe('$1,640.26')
    expect(shown({ formula: '{Qty} * {Cost}', result: 'number' }, row)).toBe('1,640.3')
    expect(shown({ formula: '0.4', result: 'percent' }, row)).toBe('40%')
    expect(shown({ formula: '{Qty} * {Cost}', result: 'currency', precision: 0 }, row)).toBe('$1,640')
    expect(shown({ formula: '{Qty} * {Cost}', result: 'currency', precision: '3' }, row)).toBe('$1,640.260')
    // Not written yet: empty cells. Not compiling: #ERROR.
    expect(shown({ formula: '' }, row)).toBe('')
    expect(shown({ formula: '   ' }, row)).toBe('')
    expect(shown({ formula: '{Nope} + 1' }, row)).toBe('#ERROR')
  })

  it('explains what is wrong', () => {
    const resolve = (n: string) => names[n.trim().toLowerCase()] ?? null
    expect(formulaError('{Nope} + 1', resolve)).toBe('No field named "Nope"')
    expect(formulaError('SUM(1, 2', resolve)).toMatch(/Expected "\)"/)
    expect(formulaError('FOO(1)', resolve)).toBe('Unknown function FOO')
    expect(formulaError('{Qty} * 2', resolve)).toBeNull()
  })
})

describe('safe parsing', () => {
  it('rich text: formatting becomes parts, script links stay text', () => {
    const [line] = parseRichText('**Bold** and [ok](https://svgrid.com) and [bad](javascript:alert(1))')
    expect(line!.parts.slice(0, 3).map((p) => p.kind)).toEqual(['b', 'text', 'a'])
    // The only link is the http(s) one; the script link is drawn as its text.
    const links = line!.parts.filter((p) => p.kind === 'a') as Array<{ href: string }>
    expect(links.map((l) => l.href)).toEqual(['https://svgrid.com/'])
    expect(line!.parts.some((p) => p.kind === 'text' && p.text === 'bad')).toBe(true)
    expect(parseRichText('- one\n- two').every((l) => l.bullet)).toBe(true)
  })

  it('button URLs: values are encoded, only http(s) opens', () => {
    expect(buttonUrl('https://x.io/o/{Id}?q={Name}', { id: 'A 1', name: 'a&b' }, { id: 'id', name: 'name' })).toBe('https://x.io/o/A%201?q=a%26b')
    expect(buttonUrl('javascript:alert({Id})', { id: 1 })).toBeNull()
    expect(buttonUrl('{Url}', { Url: 'javascript:alert(1)' })).toBeNull()
  })

  it('the date editor shows a date in the field format', () => {
    expect(dateEditTokens({ dateFormat: 'us' })).toBe('M/d/yyyy')
    expect(dateEditTokens({ dateFormat: 'european', time: true, timeFormat: '24hour' })).toBe('d/M/yyyy HH:mm')
    expect(dateEditTokens({ dateFormat: 'iso', time: true })).toBe('yyyy-MM-dd h:mm tt')
    // Friendly follows Intl: the month by name, whatever the order.
    expect(dateEditTokens({ dateFormat: 'friendly' })).toMatch(/MMMM/)
  })

  it('durations round-trip', () => {
    expect(formatDuration(5415.25, 'h:mm:ss.SS')).toBe('1:30:15.25')
    expect(formatDuration(89, 'h:mm')).toBe('0:01')
    expect(parseDuration('0:45')).toBe(2700)
    expect(parseDuration('abc')).toBeNull()
  })
})

describe('filtering a registered type', () => {
  it('a custom type whose fill sets cellDataType filters as a number or a date, not as text', () => {
    registerFieldType({ id: 'testScore', label: 'Score', fill: (d) => ({ ...d, cellDataType: d.cellDataType ?? 'number' }) })
    registerFieldType({ id: 'testDue', label: 'Due', fill: (d) => ({ ...d, cellDataType: 'dateString' }) })
    registerFieldType({ id: 'testNote', label: 'Note' })
    const score = fillFieldColumn({ field: 'score', fieldType: 'testScore' }, [])
    expect(filterKindOf(score)).toBe('number')
    expect(newCondition('score', score)).toMatchObject({ kind: 'number', op: 'eq' })
    expect(filterKindOf(fillFieldColumn({ field: 'due', fieldType: 'testDue' }, []))).toBe('date')
    expect(filterKindOf(fillFieldColumn({ field: 'note', fieldType: 'testNote' }, []))).toBe('text')
  })

  it('"Me" in a person condition is the user setCurrentUser names', () => {
    const owner = { column: 'owner', kind: 'select', op: 'is', value: ME } as const
    setCurrentUser({ id: 'u1', name: 'Ana' })
    expect(compileCondition(owner)('u1')).toBe(true)
    setCurrentUser(null)
    expect(compileCondition(owner)('u1')).toBe(false)
  })
})
