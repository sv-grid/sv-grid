import { describe, expect, it } from 'vitest'
import { imageCall, isDrawableImageSource } from './cell-images'

describe('imageCall', () => {
  it('reads the source and the alt text as written', () => {
    expect(imageCall('=IMAGE("https://example.com/a.png")')).toEqual({ source: '"https://example.com/a.png"' })
    expect(imageCall('=IMAGE(B2, "The logo")')).toEqual({ source: 'B2', alt: '"The logo"' })
    expect(imageCall('= image( B2 , C2 )')).toEqual({ source: 'B2', alt: 'C2' })
  })

  it('keeps a comma inside a string or a nested call out of the split', () => {
    expect(imageCall('=IMAGE(CONCAT("a,b", C1), "x, y")')).toEqual({ source: 'CONCAT("a,b", C1)', alt: '"x, y"' })
    expect(imageCall('=IMAGE("a""quoted"",url")')).toEqual({ source: '"a""quoted"",url"' })
  })

  it('is not a call when the formula only contains one', () => {
    expect(imageCall('=IF(A1, IMAGE(B1), "")')).toBeNull()
    expect(imageCall('=IMAGE(B1) & "x"')).toBeNull()
    expect(imageCall('=IMAGES(B1)')).toBeNull()
    expect(imageCall('IMAGE(B1)')).toBeNull()
    expect(imageCall('=IMAGE()')).toBeNull()
    expect(imageCall('=IMAGE(B1')).toBeNull()
  })
})

describe('isDrawableImageSource', () => {
  it('takes a data URL and a web address, and nothing else', () => {
    expect(isDrawableImageSource('data:image/png;base64,AAA')).toBe(true)
    expect(isDrawableImageSource('https://example.com/a.png')).toBe(true)
    expect(isDrawableImageSource('http://example.com/a.png')).toBe(true)
    expect(isDrawableImageSource('javascript:alert(1)')).toBe(false)
    expect(isDrawableImageSource('data:text/html;base64,AAA')).toBe(false)
    expect(isDrawableImageSource('/images/a.png')).toBe(false)
    expect(isDrawableImageSource('')).toBe(false)
  })
})
