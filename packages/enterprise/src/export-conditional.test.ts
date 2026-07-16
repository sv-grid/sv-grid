import { describe, expect, it } from 'vitest'
import { buildConditionalResolver } from './export-conditional'
import type { ConditionalFormat } from '@svgrid/grid/format'

type Row = { name: string; score: number }
const cols = [{ field: 'name' }, { field: 'score' }]
const rows: Row[] = [
  { name: 'A', score: 10 },
  { name: 'B', score: 90 },
  { name: 'C', score: 50 },
]

describe('buildConditionalResolver', () => {
  it('is a no-op with no formats', () => {
    const r = buildConditionalResolver(cols, rows, undefined)
    expect(r(0, 1)).toBeUndefined()
  })

  it('resolves a color scale (with per-column stats) only on its columns', () => {
    const formats: ConditionalFormat<Row>[] = [
      { type: 'colorScale', columns: ['score'], min: '#ff0000', max: '#00ff00' },
    ]
    const r = buildConditionalResolver(cols, rows, formats)
    expect(r(1, 1)?.fill).toBeTruthy() // high score -> greenish
    expect(r(1, 1)?.color).toBeTruthy() // contrast text auto-picked
    expect(r(0, 0)).toBeUndefined() // name column untouched
  })

  it('applies a predicate rule with background + bold', () => {
    const formats: ConditionalFormat<Row>[] = [
      {
        type: 'rule',
        columns: ['score'],
        when: ({ value }) => Number(value) >= 90,
        background: '#dcfce7',
        fontWeight: 'bold',
      },
    ]
    const r = buildConditionalResolver(cols, rows, formats)
    expect(r(1, 1)).toMatchObject({ fill: '#dcfce7', bold: true })
    expect(r(0, 1)).toBeUndefined() // score 10 doesn't match
  })

  it('emits an icon-set glyph', () => {
    const formats: ConditionalFormat<Row>[] = [
      { type: 'iconSet', columns: ['score'], thresholds: [33, 66] },
    ]
    const r = buildConditionalResolver(cols, rows, formats)
    expect(r(1, 1)?.icon).toBeTruthy() // high bucket
    expect(r(0, 1)?.icon).toBeTruthy() // low bucket
  })

  it('degrades a data bar to a light fill', () => {
    const formats: ConditionalFormat<Row>[] = [
      { type: 'dataBar', columns: ['score'], color: '#3b82f6' },
    ]
    const r = buildConditionalResolver(cols, rows, formats)
    expect(r(1, 1)?.fill).toMatch(/^#/) // a lightened fill
  })
})
