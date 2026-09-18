import { describe, expect, it } from 'vitest'
import { csvText } from './csv'

describe('csvText', () => {
  it('quotes what needs it and doubles a quote', () => {
    expect(csvText([['a', 'b,c', 'say "hi"'], ['1', '', 'x\ny']])).toBe('a,"b,c","say ""hi"""\r\n1,,"x\ny"')
  })

  it('pads every row to the sheet\'s width', () => {
    expect(csvText([['a'], ['b', 'c', 'd']])).toBe('a,,\r\nb,c,d')
  })

  it('takes another separator, and quotes fields that hold it', () => {
    expect(csvText([['a;b', 'c']], ';')).toBe('"a;b";c')
  })

  it('is empty for no rows', () => {
    expect(csvText([])).toBe('')
  })
})
