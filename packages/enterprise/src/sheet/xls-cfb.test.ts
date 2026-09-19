import { describe, expect, it } from 'vitest'
import { isCompoundFile, readCompoundFile, writeCompoundFile } from './xls-cfb'

const bytes = (size: number, seed: number): Uint8Array =>
  Uint8Array.from({ length: size }, (_, i) => (i * 31 + seed) & 0xff)

describe('the compound file an .xls is', () => {
  it('knows one by its signature', () => {
    expect(isCompoundFile(writeCompoundFile([{ name: 'Workbook', data: bytes(64, 1) }]))).toBe(true)
    expect(isCompoundFile(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]))).toBe(false)
    expect(isCompoundFile(new Uint8Array(4))).toBe(false)
  })

  it('reads back a stream small enough to live in the mini stream', () => {
    // Anything under 4096 bytes is allocated a second way, and a writer that
    // skips it produces a file no other program can open.
    const data = bytes(900, 7)
    const streams = readCompoundFile(writeCompoundFile([{ name: 'Workbook', data }]))
    expect(streams.get('Workbook')).toEqual(data)
  })

  it('reads back a stream that takes whole sectors', () => {
    const data = bytes(20000, 3)
    const streams = readCompoundFile(writeCompoundFile([{ name: 'Workbook', data }]))
    expect(streams.get('Workbook')).toEqual(data)
  })

  it('keeps several streams of both sizes apart', () => {
    const big = bytes(9000, 11)
    const small = bytes(100, 5)
    const other = bytes(3000, 9)
    const streams = readCompoundFile(writeCompoundFile([
      { name: 'Workbook', data: big }, { name: 'Ole', data: small }, { name: 'Notes', data: other },
    ]))
    expect(streams.get('Workbook')).toEqual(big)
    expect(streams.get('Ole')).toEqual(small)
    expect(streams.get('Notes')).toEqual(other)
  })

  it('says what is wrong rather than reading rubbish', () => {
    expect(() => readCompoundFile(Uint8Array.from([1, 2, 3, 4]))).toThrow(/not an \.xls file/)
  })
})
