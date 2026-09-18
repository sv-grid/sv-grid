import { describe, expect, it } from 'vitest'
import { copyLinks, hyperlinkArgument, linkAt, linkTitle, listLinks, parseLinkTarget, removeLink, setLink, shiftLinks, type LinksMap } from './links'

const links: LinksMap = {
  r1: { B: { target: 'https://svgrid.com' } },
  r3: { A: { target: 'Sheet2!B4', tip: 'The detail' }, C: { target: 'mailto:sales@svgrid.com' } },
}

describe('a link on a cell', () => {
  it('is read, set and removed by position', () => {
    expect(linkAt(links, 1, 1)).toEqual({ target: 'https://svgrid.com' })
    expect(linkAt(links, 1, 0)).toBeUndefined()
    const set = setLink(links, 0, 0, { target: 'https://example.com', tip: 'Home' })
    expect(linkAt(set, 0, 0)).toEqual({ target: 'https://example.com', tip: 'Home' })
    // The original is untouched: these are copies, not edits in place.
    expect(linkAt(links, 0, 0)).toBeUndefined()
    const gone = removeLink(set, 0, 0)
    expect(linkAt(gone, 0, 0)).toBeUndefined()
    expect('r0' in gone).toBe(false)
    // Removing one of two leaves the other.
    expect(Object.keys(removeLink(links, 3, 0).r3!)).toEqual(['C'])
    expect(removeLink(links, 9, 9)).toBe(links)
  })

  it('lists in reading order', () => {
    expect(listLinks(links)).toEqual([
      { row: 1, col: 1, link: { target: 'https://svgrid.com' } },
      { row: 3, col: 0, link: { target: 'Sheet2!B4', tip: 'The detail' } },
      { row: 3, col: 2, link: { target: 'mailto:sales@svgrid.com' } },
    ])
  })

  it('moves with an insert and goes with a delete', () => {
    const down = shiftLinks(links, { kind: 'insertRows', at: 0, count: 2 })
    expect(linkAt(down, 3, 1)).toEqual({ target: 'https://svgrid.com' })
    const right = shiftLinks(links, { kind: 'insertCols', at: 0, count: 1 })
    expect(linkAt(right, 1, 2)).toEqual({ target: 'https://svgrid.com' })
    expect(shiftLinks(links, { kind: 'deleteRows', at: 1, count: 1 }).r1).toBeUndefined()
    expect(linkAt(shiftLinks(links, { kind: 'deleteRows', at: 1, count: 1 }), 2, 0)).toEqual({ target: 'Sheet2!B4', tip: 'The detail' })
  })

  it('a copy is its own', () => {
    const two = copyLinks(links)
    expect(two).toEqual(links)
    expect(two.r1!.B).not.toBe(links.r1!.B)
  })
})

describe('parseLinkTarget', () => {
  it('tells a link out of the page from an address and a name', () => {
    expect(parseLinkTarget('https://svgrid.com/pricing')).toEqual({ kind: 'external', href: 'https://svgrid.com/pricing' })
    expect(parseLinkTarget('mailto:a@b.c')).toEqual({ kind: 'external', href: 'mailto:a@b.c' })
    // A bare www. is what a user types, and it is not a scheme.
    expect(parseLinkTarget('www.svgrid.com')).toEqual({ kind: 'external', href: 'https://www.svgrid.com' })
    expect(parseLinkTarget('Sheet2!B4')).toEqual({ kind: 'internal', sheet: 'Sheet2', row: 3, col: 1 })
    expect(parseLinkTarget('B4')).toEqual({ kind: 'internal', sheet: null, row: 3, col: 1 })
    expect(parseLinkTarget('Revenue')).toEqual({ kind: 'name', name: 'Revenue' })
    expect(parseLinkTarget('   ')).toBeNull()
  })

  it('a title is the tip when there is one, and the target otherwise', () => {
    expect(linkTitle({ target: 'https://svgrid.com' })).toBe('https://svgrid.com')
    expect(linkTitle({ target: 'https://svgrid.com', tip: 'Our site' })).toBe('Our site')
    expect(linkTitle({ target: 'https://svgrid.com', tip: '  ' })).toBe('https://svgrid.com')
  })
})

describe('hyperlinkArgument', () => {
  it('is the first argument of a top-level HYPERLINK, as written', () => {
    expect(hyperlinkArgument('=HYPERLINK("https://svgrid.com")')).toBe('"https://svgrid.com"')
    expect(hyperlinkArgument('=HYPERLINK("https://svgrid.com", "Our site")')).toBe('"https://svgrid.com"')
    expect(hyperlinkArgument('= hyperlink( "https://x" & A2 , "Open" )')).toBe('"https://x" & A2')
    // A comma inside a string or a nested call is not the argument's end.
    expect(hyperlinkArgument('=HYPERLINK(CONCAT("a,b", A1), "n")')).toBe('CONCAT("a,b", A1)')
    expect(hyperlinkArgument('=HYPERLINK("a"",b")')).toBe('"a"",b"')
  })

  it('is null for anything else', () => {
    expect(hyperlinkArgument('=SUM(A1:A2)')).toBeNull()
    expect(hyperlinkArgument('Our site')).toBeNull()
    expect(hyperlinkArgument('=IF(A1, HYPERLINK("x"), "")')).toBeNull()
    expect(hyperlinkArgument('=HYPERLINK()')).toBeNull()
  })
})
