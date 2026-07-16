import { describe, expect, it } from 'vitest'
import { buildPrintDocument } from './export-print'

const columns = [
  { header: 'Company', align: 'left' as const },
  { header: 'Price', align: 'right' as const },
]
const rows = [
  ['ACME', '$19.95'],
  ['Globex', '$1,000.00'],
]

describe('buildPrintDocument', () => {
  it('repeats the header, aligns columns, sets page size, and zebra-stripes', () => {
    const html = buildPrintDocument({
      columns,
      rows,
      opts: { title: 'Orders', orientation: 'landscape', pageSize: 'A4' },
    })
    expect(html).toContain('display: table-header-group') // repeated header
    expect(html).toContain('@page { size: A4 landscape;')
    expect(html).toContain('<th style="text-align:right">Price</th>')
    expect(html).toContain('<td style="text-align:right">$19.95</td>')
    expect(html).toContain('<h1>Orders</h1>')
    expect(html).toContain('nth-child(even)')
  })

  it('escapes HTML and supports subtitle / logo / no-zebra', () => {
    const html = buildPrintDocument({
      columns,
      rows: [['<b>x</b>', '1']],
      opts: { zebra: false, subtitle: 'Q3', logo: 'data:image/png;base64,AA' },
    })
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(html).not.toContain('nth-child(even)')
    expect(html).toContain('<p class="subtitle">Q3</p>')
    expect(html).toContain('src="data:image/png;base64,AA"')
  })

  it('defaults to portrait with a 14mm margin', () => {
    const html = buildPrintDocument({ columns, rows })
    expect(html).toContain('@page { size: portrait; margin: 14mm;')
  })

  it('renders hyperlinks from a cellLink hook', () => {
    const html = buildPrintDocument({
      columns,
      rows,
      cellLink: (r, c) => (r === 0 && c === 0 ? 'https://x.test' : undefined),
    })
    expect(html).toContain('<a href="https://x.test">ACME</a>')
  })

  it('applies conditional-format cell styles + icon prefix', () => {
    const html = buildPrintDocument({
      columns,
      rows,
      cellStyle: (r, c) =>
        r === 0 && c === 1 ? { fill: '#dcfce7', color: '#166534', bold: true, icon: '↑' } : undefined,
    })
    expect(html).toContain('background:#dcfce7')
    expect(html).toContain('color:#166534')
    expect(html).toContain('font-weight:700')
    expect(html).toContain('↑ $19.95')
  })
})
