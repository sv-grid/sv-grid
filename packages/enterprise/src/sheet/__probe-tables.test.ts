import { describe, expect, it } from 'vitest'
import { createWorkbook } from './workbook'

function book() {
  const wb = createWorkbook([{ name: 'S', cells: [
    ['Region', 'Qty', 'Price', 'Amount'],
    ['North', '2', '10', '=[@Qty]*[@Price]'],
    ['South', '3', '20', '=[@Qty]*[@Price]'],
    ['EMEA', '4', '30', '=[@Qty]*[@Price]'],
    ['', '', '', ''],
    ['Total', '', '', '=SUM(Orders[Amount])'],
  ] }])
  wb.tables.define({ name: 'Orders', sheet: 'S', headerRow: 0, firstCol: 0, lastCol: 3, lastRow: 3, hasTotals: false })
  wb.recalculate()
  return wb
}

const at = (wb: ReturnType<typeof createWorkbook>, r: number, c: number) => wb.getValue('S', r, c)

describe('probe: structured references', () => {
  it('prints what each one answers', () => {
    const wb = book()
    const cases = [
      '=SUM(Orders[Amount])',
      '=SUM(Orders[[Qty]:[Amount]])',
      '=COUNTA(Orders[#Headers])',
      '=COUNTA(Orders[#All])',
      '=SUM(Orders[#Data])',
      '=SUM(Orders[#Totals])',
      '=SUM(Orders[Nope])',
      '=SUM(orders[amount])',
      '=SUM(Nothing[Amount])',
      '=[@Amount]',
      '=SUM(Orders[[#Headers],[Amount]])',
      '=ROWS(Orders[Amount])',
      '=INDEX(Orders[Amount], 2)',
    ]
    for (const f of cases) {
      wb.setRaw('S', 8, 0, f)
      wb.recalculate()
      console.log(`${f.padEnd(40)} -> ${JSON.stringify(at(wb, 8, 0))}`)
    }
    expect(true).toBe(true)
  })

  it('prints what happens as the table changes under them', () => {
    const wb = book()
    console.log('total at rest               ->', JSON.stringify(at(wb, 5, 3)))

    // A row typed under the last one: Excel grows the table and the total follows.
    wb.setRaw('S', 4, 0, 'APAC')
    wb.setRaw('S', 4, 1, '5')
    wb.setRaw('S', 4, 2, '40')
    wb.setRaw('S', 4, 3, '=[@Qty]*[@Price]')
    wb.recalculate()
    console.log('after a row under the last  ->', JSON.stringify(at(wb, 5, 3)), '| table lastRow', wb.tables.list()[0]?.lastRow)

    // The column renamed: the reference names a column that is not there.
    wb.setRaw('S', 0, 3, 'Total amount')
    wb.recalculate()
    console.log('after renaming the column   ->', JSON.stringify(at(wb, 5, 3)))
    wb.setRaw('S', 0, 3, 'Amount')
    wb.recalculate()

    // The table removed: every structured reference to it.
    wb.tables.remove('Orders')
    wb.recalculate()
    console.log('after removing the table    ->', JSON.stringify(at(wb, 5, 3)))
  })
})

describe('probe: spilling in a workbook', () => {
  it('prints what a spill does when something is in the way', () => {
    const wb = createWorkbook([{ name: 'S', cells: [
      ['1', '', ''],
      ['2', '', ''],
      ['3', '', ''],
      ['', '', ''],
    ] }])
    wb.setRaw('S', 0, 1, '=A1:A3')
    wb.recalculate()
    console.log('spill into empty cells      ->', [0, 1, 2].map((r) => JSON.stringify(at(wb, r, 1))).join(', '))

    wb.setRaw('S', 2, 1, 'in the way')
    wb.recalculate()
    console.log('with a cell in the way      ->', JSON.stringify(at(wb, 0, 1)), '| the blocker', JSON.stringify(at(wb, 2, 1)))

    wb.setRaw('S', 2, 1, '')
    wb.recalculate()
    console.log('after clearing the blocker  ->', [0, 1, 2].map((r) => JSON.stringify(at(wb, r, 1))).join(', '))

    // Excel's spill operator, which names the whole spilled block.
    wb.setRaw('S', 0, 2, '=SUM(B1#)')
    wb.recalculate()
    console.log('the spill operator B1#      ->', JSON.stringify(at(wb, 0, 2)))
    expect(true).toBe(true)
  })
})
