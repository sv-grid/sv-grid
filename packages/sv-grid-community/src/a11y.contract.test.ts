import { describe, expect, it } from 'vitest'
import {
  getGridCellA11yProps,
  getGridHeaderA11yProps,
  getGridRootA11yProps,
  getGridRowA11yProps,
} from './a11y'

function attrsToHtml(attrs: Record<string, string | number | boolean>) {
  return Object.entries(attrs)
    .map(([key, value]) => `${key}="${String(value)}"`)
    .join(' ')
}

describe('a11y contract rendering', () => {
  it('builds expected headless markup attributes', () => {
    const root = getGridRootA11yProps()
    const header = getGridHeaderA11yProps({
      sortable: true,
      sortDirection: 'descending',
    })
    const row = getGridRowA11yProps(1)
    const cell = getGridCellA11yProps({
      rowIndex: 1,
      colIndex: 2,
      selected: true,
    })

    const html = [
      `<table ${attrsToHtml(root)}><thead>`,
      `<tr ${attrsToHtml(row)}>`,
      `<th ${attrsToHtml(header)}>Age</th>`,
      `</tr></thead><tbody>`,
      `<tr ${attrsToHtml(row)}><td ${attrsToHtml(cell)}>42</td></tr>`,
      `</tbody></table>`,
    ].join('')

    expect(html).toContain('role="grid"')
    expect(html).toContain('role="columnheader"')
    expect(html).toContain('aria-sort="descending"')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('aria-colindex="2"')
  })

  it('creates stable active descendant ids', async () => {
    const { getGridCellDomId } = await import('./a11y')
    expect(getGridCellDomId('svgrid', 3, 4)).toBe('svgrid_cell_3_4')
  })
})
