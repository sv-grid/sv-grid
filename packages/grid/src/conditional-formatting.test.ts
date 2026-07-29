import { describe, expect, it } from 'vitest'
import {
  computeColumnStat,
  lerpColor,
  contrastText,
  resolveCellFormat,
  formatsNeedingStats,
  type ConditionalFormat,
} from './conditional-formatting'

describe('contrastText', () => {
  it('returns dark text on light backgrounds, white on dark', () => {
    expect(contrastText('#fde68a')).toBe('#1e293b') // light yellow
    expect(contrastText('#86efac')).toBe('#1e293b') // light green
    expect(contrastText('#1d4ed8')).toBe('#ffffff') // deep blue
  })
  it('returns null for non-hex backgrounds', () => {
    expect(contrastText('var(--x)')).toBeNull()
  })
})

describe('computeColumnStat', () => {
  it('returns min/max of finite numbers', () => {
    expect(computeColumnStat([3, 1, 'x', 9, null])).toEqual({ min: 1, max: 9 })
  })
  it('returns null when nothing is numeric', () => {
    expect(computeColumnStat(['a', null, undefined])).toBeNull()
  })
})

describe('lerpColor', () => {
  it('interpolates midpoint', () => {
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
  it('clamps and falls back on bad input', () => {
    expect(lerpColor('#ff0000', '#00ff00', 0)).toBe('#ff0000')
    expect(lerpColor('nope', '#00ff00', 0.5)).toBe('nope')
  })
})

describe('resolveCellFormat', () => {
  const stat = { min: 0, max: 100 }

  it('color scale maps value position to a gradient color', () => {
    const fmts: ConditionalFormat[] = [
      { type: 'colorScale', min: '#ff0000', max: '#00ff00' },
    ]
    expect(resolveCellFormat(0, {}, 'c', fmts, stat).background).toBe('#ff0000')
    expect(resolveCellFormat(100, {}, 'c', fmts, stat).background).toBe('#00ff00')
    expect(resolveCellFormat(50, {}, 'c', fmts, stat).background).toBe('#808000')
  })

  it('data bar computes a percent and picks negative color', () => {
    const fmts: ConditionalFormat[] = [
      { type: 'dataBar', color: '#16a34a', negativeColor: '#ef4444' },
    ]
    const pos = resolveCellFormat(50, {}, 'c', fmts, { min: -100, max: 100 })
    expect(pos.dataBar?.percent).toBeCloseTo(75)
    expect(pos.dataBar?.color).toBe('#16a34a')
    const neg = resolveCellFormat(-50, {}, 'c', fmts, { min: -100, max: 100 })
    expect(neg.dataBar?.color).toBe('#ef4444')
  })

  it('icon set buckets by ascending thresholds', () => {
    const fmts: ConditionalFormat[] = [
      { type: 'iconSet', set: 'arrows', thresholds: [0, 50] },
    ]
    expect(resolveCellFormat(-5, {}, 'c', fmts, null).icon).toBe('↓')
    expect(resolveCellFormat(10, {}, 'c', fmts, null).icon).toBe('→')
    expect(resolveCellFormat(80, {}, 'c', fmts, null).icon).toBe('↑')
  })

  it('rule applies styles only when the predicate matches', () => {
    const fmts: ConditionalFormat[] = [
      {
        type: 'rule',
        when: ({ value }) => Number(value) < 0,
        background: '#fee2e2',
        color: '#991b1b',
      },
    ]
    expect(resolveCellFormat(-1, {}, 'c', fmts, null).background).toBe('#fee2e2')
    expect(resolveCellFormat(1, {}, 'c', fmts, null).background).toBeUndefined()
  })

  it('respects the columns scope', () => {
    const fmts: ConditionalFormat[] = [
      { type: 'colorScale', min: '#000000', max: '#ffffff', columns: ['other'] },
    ]
    expect(resolveCellFormat(50, {}, 'c', fmts, stat).background).toBeUndefined()
  })

  it('later formats override earlier ones', () => {
    const fmts: ConditionalFormat[] = [
      { type: 'rule', when: () => true, background: '#aaa' },
      { type: 'rule', when: () => true, background: '#bbb' },
    ]
    expect(resolveCellFormat(1, {}, 'c', fmts, null).background).toBe('#bbb')
  })

  it('formatsNeedingStats flags colorScale/dataBar only', () => {
    expect(formatsNeedingStats([{ type: 'iconSet', thresholds: [0] }])).toBe(false)
    expect(
      formatsNeedingStats([{ type: 'dataBar', color: '#000' }]),
    ).toBe(true)
  })

  it('compareColumn formats do not need column stats', () => {
    expect(
      formatsNeedingStats([
        { type: 'colorScale', min: '#000', max: '#fff', compareColumn: 'target' },
      ]),
    ).toBe(false)
  })
})

describe('resolveCellFormat - gradient extensions', () => {
  const stat = { min: 0, max: 100 }

  it('alpha mode interpolates opacity over a single base color', () => {
    const fmts: ConditionalFormat[] = [
      { type: 'colorScale', mode: 'alpha', base: '#2563eb', alphaBounds: [0, 1] },
    ]
    expect(resolveCellFormat(0, {}, 'c', fmts, stat).background).toBe('rgba(37, 99, 235, 0.000)')
    expect(resolveCellFormat(100, {}, 'c', fmts, stat).background).toBe('rgba(37, 99, 235, 1.000)')
    expect(resolveCellFormat(50, {}, 'c', fmts, stat).background).toBe('rgba(37, 99, 235, 0.500)')
  })

  it('alpha mode leaves the text color untouched (translucent tint)', () => {
    const fmts: ConditionalFormat[] = [{ type: 'colorScale', mode: 'alpha' }]
    expect(resolveCellFormat(80, {}, 'c', fmts, stat).color).toBeUndefined()
  })

  it('reverse flips the ramp position', () => {
    const fmts: ConditionalFormat[] = [
      { type: 'colorScale', min: '#ff0000', max: '#00ff00', reverse: true },
    ]
    expect(resolveCellFormat(0, {}, 'c', fmts, stat).background).toBe('#00ff00')
    expect(resolveCellFormat(100, {}, 'c', fmts, stat).background).toBe('#ff0000')
  })

  it('zeroCentred maps 0 to the midpoint symmetrically', () => {
    const fmts: ConditionalFormat[] = [
      { type: 'colorScale', min: '#ff0000', mid: '#ffffff', max: '#00ff00', zeroCentred: true },
    ]
    const s = { min: -80, max: 100 } // bound = max(|-80|,|100|) = 100
    expect(resolveCellFormat(0, {}, 'c', fmts, s).background).toBe('#ffffff')
    expect(resolveCellFormat(100, {}, 'c', fmts, s).background).toBe('#00ff00')
    expect(resolveCellFormat(-100, {}, 'c', fmts, s).background).toBe('#ff0000')
  })

  it('percent bounds map 0..100 onto the column span', () => {
    const fmts: ConditionalFormat[] = [
      { type: 'colorScale', min: '#000000', max: '#ffffff', bounds: 'percent', minValue: 50, maxValue: 100 },
    ]
    // span 0..100, so minValue 50 -> data 50, below it clamps to min color
    expect(resolveCellFormat(50, {}, 'c', fmts, stat).background).toBe('#000000')
    expect(resolveCellFormat(100, {}, 'c', fmts, stat).background).toBe('#ffffff')
    expect(resolveCellFormat(25, {}, 'c', fmts, stat).background).toBe('#000000')
  })

  it('N-stop scale interpolates within a band', () => {
    const fmts: ConditionalFormat[] = [
      {
        type: 'colorScale',
        stops: [
          { offset: 0, color: '#ff0000' },
          { offset: 0.5, color: '#ffffff' },
          { offset: 1, color: '#00ff00' },
        ],
      },
    ]
    expect(resolveCellFormat(50, {}, 'c', fmts, stat).background).toBe('#ffffff')
    expect(resolveCellFormat(0, {}, 'c', fmts, stat).background).toBe('#ff0000')
  })

  it('compareColumn tints by proportion of another field, no column stats', () => {
    const fmts: ConditionalFormat[] = [
      { type: 'colorScale', min: '#000000', max: '#ffffff', compareColumn: 'target' },
    ]
    expect(resolveCellFormat(50, { target: 100 }, 'c', fmts, null).background).toBe('#808080')
    expect(resolveCellFormat(100, { target: 100 }, 'c', fmts, null).background).toBe('#ffffff')
    // zero / missing target -> skip
    expect(resolveCellFormat(50, { target: 0 }, 'c', fmts, null).background).toBeUndefined()
  })

  it('dataBar compareColumn sizes the bar against another field', () => {
    const fmts: ConditionalFormat[] = [
      { type: 'dataBar', color: '#2563eb', compareColumn: 'target' },
    ]
    expect(resolveCellFormat(30, { target: 120 }, 'c', fmts, null).dataBar?.percent).toBeCloseTo(25)
  })

  it('tooltip surfaces value or percent position', () => {
    const valFmt: ConditionalFormat[] = [
      { type: 'colorScale', min: '#000', max: '#fff', tooltip: 'value' },
    ]
    expect(resolveCellFormat(42, {}, 'c', valFmt, stat).title).toBe('42')
    const pctFmt: ConditionalFormat[] = [
      { type: 'colorScale', min: '#000', max: '#fff', tooltip: 'percent' },
    ]
    expect(resolveCellFormat(25, {}, 'c', pctFmt, stat).title).toBe('25%')
  })

  it('data bar gradient flag flows through to the resolved bar', () => {
    const fmts: ConditionalFormat[] = [
      { type: 'dataBar', color: '#2563eb', gradient: true },
    ]
    expect(resolveCellFormat(50, {}, 'c', fmts, stat).dataBar?.gradient).toBe(true)
  })
})
