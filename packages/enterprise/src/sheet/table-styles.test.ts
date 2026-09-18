import { describe, expect, it } from 'vitest'
import {
  TABLE_STYLES, DEFAULT_TABLE_STYLE, NO_TABLE_STYLE,
  findTableStyle, tableStyleColours, tableStyleLabel, readableOn,
} from './table-styles'

/** The colour `color-mix(in srgb, X n%, #000)` paints. */
function mixWithBlack(hex: string, percent: number): string {
  const v = hex.replace('#', '')
  const n = Number.parseInt(v, 16)
  const parts = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round((c * percent) / 100))
  return `#${parts.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/** WCAG's ratio, for the assertion below. */
function contrastOf(a: string, b: string): number {
  const lum = (hex: string) => {
    const v = hex.replace('#', '')
    const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v
    const n = Number.parseInt(full.slice(0, 6), 16)
    const parts = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * parts[0]! + 0.7152 * parts[1]! + 0.0722 * parts[2]!
  }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

describe('table styles', () => {
  it('is six accents in three tones, under Excel\'s own names', () => {
    expect(TABLE_STYLES).toHaveLength(18)
    expect(TABLE_STYLES.map((s) => s.id)).toContain('TableStyleMedium2')
    expect(TABLE_STYLES.map((s) => s.id)).toContain('TableStyleLight7')
    expect(TABLE_STYLES.map((s) => s.id)).toContain('TableStyleDark4')
    expect(new Set(TABLE_STYLES.map((s) => s.id)).size).toBe(18)
    // Every id is one Excel would recognise: a family and a number.
    for (const style of TABLE_STYLES) expect(style.id).toMatch(/^TableStyle(Light|Medium|Dark)[2-7]$/)
  })

  it('finds one by name, whatever the case, and nothing for None', () => {
    expect(findTableStyle(DEFAULT_TABLE_STYLE)?.colour).toBe('Blue')
    expect(findTableStyle('tablestylemedium2')?.tone).toBe('medium')
    expect(findTableStyle(NO_TABLE_STYLE)).toBeUndefined()
    expect(findTableStyle(undefined)).toBeUndefined()
    expect(findTableStyle('TableStyleMedium99')).toBeUndefined()
  })

  it('gives a medium style a filled header and a light one a tinted one', () => {
    const medium = tableStyleColours('TableStyleMedium6')!
    expect(medium.header).toBe('#5b9bd5')
    // Sky is a pale accent: white on it is about 2:1, so the header takes
    // the dark text instead.
    expect(medium.headerText).toBe('#0f172a')
    expect(tableStyleColours('TableStyleMedium2')!.headerText).toBe('#ffffff')
    expect(medium.band).toContain('color-mix')

    const light = tableStyleColours('TableStyleLight6')!
    expect(light.header).toContain('color-mix')
    expect(light.headerText).toBe('inherit')

    const dark = tableStyleColours('TableStyleDark6')!
    expect(dark.header).toContain('#000')
    expect(dark.headerText).toBe('#ffffff')
  })

  it('picks the text colour that can actually be read', () => {
    // Every preset's header clears WCAG AA for normal text.
    for (const style of TABLE_STYLES) {
      const colours = tableStyleColours(style)!
      if (colours.headerText === 'inherit') continue
      // A dark header is the accent mixed with black; measure the mix
      // rather than the string it is written as.
      const mix = /color-mix\(in srgb, (#[0-9a-f]{6}) (\d+)%, #000\)/i.exec(colours.header)
      const fill = mix ? mixWithBlack(mix[1]!, Number(mix[2])) : colours.header
      expect([style.id, contrastOf(fill, colours.headerText) >= 4.5]).toEqual([style.id, true])
    }
  })

  it('has no colours for no style', () => {
    expect(tableStyleColours(NO_TABLE_STYLE)).toBeNull()
    expect(tableStyleColours(undefined)).toBeNull()
  })

  it('names a style the way the gallery does', () => {
    expect(tableStyleLabel(findTableStyle('TableStyleMedium2')!)).toBe('Blue, Medium')
    expect(tableStyleLabel(findTableStyle('TableStyleDark7')!)).toBe('Green, Dark')
  })
})

describe('readableOn', () => {
  it('picks white over a dark fill and near-black over a light one', () => {
    expect(readableOn('#1f2937')).toBe('#ffffff')
    expect(readableOn('#ffc000')).toBe('#0f172a')
    expect(readableOn('#4472c4')).toBe('#ffffff')
  })
})
