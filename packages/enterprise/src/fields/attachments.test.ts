import { describe, expect, it } from 'vitest'
import {
  accepts,
  attachmentsFromText,
  attachmentsText,
  formatBytes,
  guessType,
  limitAttachments,
  parseAttachments,
  rejectReason,
  safeUrl,
  toAttachments,
} from './attachments'

const file = (name: string, size: number, type = '') => ({ name, size, type }) as File

describe('attachments: helpers', () => {
  it('accept rules follow <input accept>', () => {
    expect(accepts('image/*', { name: 'a.png', type: 'image/png' })).toBe(true)
    expect(accepts('image/*,.pdf', { name: 'r.pdf', type: '' })).toBe(true)
    expect(accepts('.pdf', { name: 'r.PDF', type: '' })).toBe(true)
    expect(accepts('image/*', { name: 'x.zip', type: 'application/zip' })).toBe(false)
  })

  it('refuses a file over the size, the count, or the accepted types', () => {
    expect(rejectReason(file('a.png', 10), {}, 0)).toBeNull()
    expect(rejectReason(file('a.png', 10), { maxFiles: 2 }, 2)).toMatch(/At most 2/)
    expect(rejectReason(file('a.png', 30 * 1024 * 1024), {}, 0)).toMatch(/Larger than 25/)
    expect(rejectReason(file('a.exe', 10), { accept: 'image/*' }, 0)).toMatch(/Not an accepted type/)
  })

  it('says file or files as the count needs, and a size without a pointless .0', () => {
    expect(rejectReason(file('a.png', 10), { maxFiles: 1 }, 1)).toBe('At most 1 file')
    expect(rejectReason(file('a.png', 10), { maxFiles: 3 }, 3)).toBe('At most 3 files')
    expect(rejectReason(file('a.png', 11 * 1024 * 1024), { maxSize: 10 * 1024 * 1024 }, 0)).toBe('Larger than 10 MB')
  })

  it('checks attachments added by URL against accept and maxFiles, by the name\'s extension', () => {
    const found = attachmentsFromText('https://x.io/a.png https://x.io/r.pdf https://x.io/b.jpg https://x.io/c.webp')
    const images = limitAttachments(found, { accept: 'image/*', maxFiles: 2 })
    expect(images.kept.map((a) => a.name)).toEqual(['a.png', 'b.jpg'])
    expect(images.rejected).toEqual(['r.pdf: Not an accepted type', 'c.webp: At most 2 files'])
    expect(limitAttachments(found, { accept: '.pdf' }).kept.map((a) => a.name)).toEqual(['r.pdf'])
    // The files the cell holds count toward maxFiles.
    expect(limitAttachments(found, { maxFiles: 3 }, 2).kept).toHaveLength(1)
    // A size is checked when the attachment knows it.
    const sized = [{ id: '1', url: 'https://x.io/big.png', name: 'big.png', type: 'image/png', size: 5_000_000 }]
    expect(limitAttachments(sized, { maxSize: 1_000_000 }).rejected).toEqual(['big.png: Larger than 977 KB'])
  })

  it('keeps a paste or a copied cell to the field\'s limits (the valueParser)', () => {
    expect(parseAttachments('https://x.io/a.png https://x.io/r.pdf https://x.io/b.png', { accept: 'image/*', maxFiles: 1 }).map((a) => a.name)).toEqual(['a.png'])
    const copied = [
      { id: '1', url: 'https://x.io/a.png', name: 'a.png', type: 'image/png' },
      { id: '2', url: 'https://x.io/r.pdf', name: 'r.pdf', type: 'application/pdf' },
    ]
    expect(parseAttachments(copied, { accept: '.pdf' }).map((a) => a.name)).toEqual(['r.pdf'])
    expect(parseAttachments('', {})).toEqual([])
  })

  it('turns pasted http(s) URLs into attachments and ignores the rest', () => {
    const got = attachmentsFromText('https://x.io/a/report.pdf, javascript:alert(1) ftp://h/f.txt https://x.io/p.png')
    expect(got.map((a) => [a.name, a.type])).toEqual([['report.pdf', 'application/pdf'], ['p.png', 'image/png']])
  })

  it('writes the file names for copy and export, and drops non-attachments', () => {
    const v = [{ id: '1', url: 'https://x.io/a.png', name: 'a.png', type: 'image/png' }, 'junk', null]
    expect(toAttachments(v)).toHaveLength(1)
    expect(attachmentsText(v)).toBe('a.png')
    expect(attachmentsText(undefined)).toBe('')
  })

  it('uses only http(s) and blob URLs; data: images only for thumbnails', () => {
    expect(safeUrl('https://x.io/a.png')).toBe('https://x.io/a.png')
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,<b>x</b>')).toBeNull()
    expect(safeUrl('data:image/png;base64,AAAA')).toBeNull()
    expect(safeUrl('data:image/png;base64,AAAA', true)).toBe('data:image/png;base64,AAAA')
    // An SVG drawn by <img> runs no script: allowed as a thumbnail, never as a link.
    expect(safeUrl('data:image/svg+xml;base64,AAAA', true)).toBe('data:image/svg+xml;base64,AAAA')
    expect(safeUrl('data:image/svg+xml;utf8,%3Csvg%3E', true)).toBe('data:image/svg+xml;utf8,%3Csvg%3E')
    expect(safeUrl('data:image/svg+xml;base64,AAAA')).toBeNull()
  })

  it('formats sizes and guesses types from names', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3 MB')
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB')
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2 GB')
    expect(guessType('photo.JPG')).toBe('image/jpeg')
    expect(guessType('noext')).toBe('application/octet-stream')
  })
})
