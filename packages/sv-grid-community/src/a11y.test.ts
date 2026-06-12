import { describe, expect, it } from 'vitest'
import {
  getGridCellA11yProps,
  getGridHeaderA11yProps,
  getGridRootA11yProps,
  getGridRowA11yProps,
} from './a11y'

describe('a11y helpers', () => {
  it('returns grid role props', () => {
    expect(
      getGridRootA11yProps({
        activeDescendantId: 'svgrid_cell_0_0',
        rowCount: 10,
        colCount: 5,
      }),
    ).toEqual({
      role: 'grid',
      tabindex: 0,
      'aria-activedescendant': 'svgrid_cell_0_0',
      'aria-rowcount': 10,
      'aria-colcount': 5,
    })
  })

  it('returns header sort semantics', () => {
    expect(
      getGridHeaderA11yProps({
        sortable: true,
        sortDirection: 'ascending',
      }),
    ).toEqual({
      role: 'columnheader',
      'aria-sort': 'ascending',
    })
  })

  it('returns row and cell indices for accessibility metadata', () => {
    expect(getGridRowA11yProps(2)).toEqual({
      role: 'row',
      'aria-rowindex': 2,
    })

    expect(
      getGridCellA11yProps({
        id: 'svgrid_cell_2_3',
        rowIndex: 2,
        colIndex: 3,
        selected: true,
      }),
    ).toEqual({
      role: 'gridcell',
      id: 'svgrid_cell_2_3',
      'aria-colindex': 3,
      'aria-rowindex': 2,
      'aria-selected': true,
    })
  })
})
