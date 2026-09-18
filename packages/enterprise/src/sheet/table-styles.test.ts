import { describe, expect, it } from 'vitest'
import {
  TABLE_STYLES, DEFAULT_TABLE_STYLE, NO_TABLE_STYLE,
  findTableStyle, tableStyleColours, tableStyleLabel,
} from './table-styles'

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
    expect(medium.headerText).toBe('#ffffff')
    expect(medium.band).toContain('color-mix')

    const light = tableStyleColours('TableStyleLight6')!
    expect(light.header).toContain('color-mix')
    expect(light.headerText).toBe('inherit')

    const dark = tableStyleColours('TableStyleDark6')!
    expect(dark.header).toContain('#000')
    expect(dark.headerText).toBe('#ffffff')
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
