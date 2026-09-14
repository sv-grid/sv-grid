import { describe, expect, it } from 'vitest'
import { translateFormula, fixupReferences, formatFormula } from './refs'
import { parseFormula } from './parse'

const t = (src: string, dRow: number, dCol: number) => translateFormula(src, dRow, dCol)

describe('the $ matrix', () => {
  // The bug this whole module exists for: every demo engine does
  // part.replace(/\$/g, '') and then treats what is left as relative, so
  // =$A$1 filled down silently starts reading the wrong cell.
  it('leaves a fully pinned reference alone in every direction', () => {
    expect(t('=$A$1', 5, 0)).toBe('=$A$1')
    expect(t('=$A$1', 0, 5)).toBe('=$A$1')
    expect(t('=$A$1', 5, 5)).toBe('=$A$1')
    expect(t('=$A$1', -1, -1)).toBe('=$A$1')
  })

  it('moves a fully relative reference in every direction', () => {
    expect(t('=A1', 1, 0)).toBe('=A2')
    expect(t('=A1', 0, 1)).toBe('=B1')
    expect(t('=B2', 2, 2)).toBe('=D4')
  })

  it('pins only the column when the $ is on the column', () => {
    expect(t('=$A1', 1, 1)).toBe('=$A2')
  })

  it('pins only the row when the $ is on the row', () => {
    expect(t('=A$1', 1, 1)).toBe('=B$1')
  })

  it('handles the classic multiplication-table anchor', () => {
    // =$A2*B$1 is the shape of every times-table sheet ever built. It must
    // keep the column anchor on A and the row anchor on 1.
    expect(t('=$A2*B$1', 3, 4)).toBe('=$A5*F$1')
  })

  it('translates both ends of a range independently', () => {
    expect(t('=SUM($A$1:B2)', 1, 1)).toBe('=SUM($A$1:C3)')
  })

  it('is a no-op for a zero delta', () => {
    expect(t('=A1', 0, 0)).toBe('=A1')
  })
})

describe('translateFormula', () => {
  it('leaves a literal alone', () => {
    expect(t('42', 1, 0)).toBe('42')
    expect(t('hello', 1, 0)).toBe('hello')
    expect(t('', 1, 0)).toBe('')
  })

  it('passes non-strings straight through', () => {
    expect(translateFormula(42, 1, 0)).toBe(42)
    expect(translateFormula(null, 1, 0)).toBeNull()
    expect(translateFormula(undefined, 1, 0)).toBeUndefined()
  })

  it('leaves an unparseable formula exactly as typed', () => {
    // Rewriting a half-understood formula is worse than leaving it alone.
    expect(t('=SUM(', 1, 0)).toBe('=SUM(')
    expect(t('=1 +', 1, 0)).toBe('=1 +')
  })

  it('keeps a cross-sheet reference on its sheet', () => {
    expect(t('=Orders!A1', 1, 0)).toBe('=Orders!A2')
    expect(t("='Price list'!A1", 1, 0)).toBe("='Price list'!A2")
  })

  it('translates inside a function call', () => {
    expect(t('=IF(A1>0,B1,C1)', 1, 0)).toBe('=IF(A2>0,B2,C2)')
  })

  it('leaves literals and names inside a formula alone', () => {
    expect(t('=A1*2+Tax', 1, 0)).toBe('=A2*2+Tax')
  })

  it('preserves a doubled quote through a round trip', () => {
    expect(t('=A1&"say ""hi"""', 1, 0)).toBe('=A2&"say ""hi"""')
  })

  it('normalises spacing, because it re-serialises from the AST', () => {
    expect(t('=SUM( A1 : B2 )', 1, 0)).toBe('=SUM(A2:B3)')
  })

  it('renders #REF! once a reference is pushed off the sheet', () => {
    expect(t('=A1', -1, 0)).toBe('=#REF!')
    expect(t('=A1', 0, -1)).toBe('=#REF!')
  })
})

describe('fixupReferences on rows', () => {
  const insert = (at: number, count = 1) => ({ kind: 'insertRows' as const, at, count })
  const remove = (at: number, count = 1) => ({ kind: 'deleteRows' as const, at, count })

  it('shifts a reference below an insertion down', () => {
    expect(fixupReferences('=A5', insert(2))).toBe('=A6')
  })

  it('leaves a reference above an insertion alone', () => {
    expect(fixupReferences('=A1', insert(2))).toBe('=A1')
  })

  it('grows a range that straddles an insertion', () => {
    // =SUM(A1:A10) with a row inserted at 5 must become A1:A11, or the new row
    // silently drops out of the total.
    expect(fixupReferences('=SUM(A1:A10)', insert(4))).toBe('=SUM(A1:A11)')
  })

  it('shifts a reference above a deletion up', () => {
    expect(fixupReferences('=A5', remove(1))).toBe('=A4')
  })

  it('breaks a reference into a deleted row', () => {
    expect(fixupReferences('=A3', remove(2))).toBe('=#REF!')
  })

  it('shrinks a range when rows inside it are deleted', () => {
    expect(fixupReferences('=SUM(A1:A10)', remove(4))).toBe('=SUM(A1:A9)')
  })

  it('breaks a range only when all of it is deleted', () => {
    // Excel keeps the call and puts the error inside it, rather than throwing
    // the whole formula away.
    expect(fixupReferences('=SUM(A2:A3)', remove(1, 3))).toBe('=SUM(#REF!)')
  })

  it('shifts by the full count for a multi-row edit', () => {
    expect(fixupReferences('=A5', insert(0, 3))).toBe('=A8')
    expect(fixupReferences('=A5', remove(0, 3))).toBe('=A2')
  })

  it('moves a pinned reference too, because pinning is about FILL', () => {
    // $ stops a reference moving when the formula moves. It does not stop it
    // tracking a row that genuinely moved.
    expect(fixupReferences('=$A$5', insert(0))).toBe('=$A$6')
  })
})

describe('fixupReferences on columns', () => {
  const insert = (at: number, count = 1) => ({ kind: 'insertCols' as const, at, count })
  const remove = (at: number, count = 1) => ({ kind: 'deleteCols' as const, at, count })

  it('shifts a reference right of an insertion', () => {
    expect(fixupReferences('=C1', insert(1))).toBe('=D1')
  })

  it('shifts a reference right of a deletion left', () => {
    expect(fixupReferences('=C1', remove(0))).toBe('=B1')
  })

  it('breaks a reference into a deleted column', () => {
    expect(fixupReferences('=B1', remove(1))).toBe('=#REF!')
  })

  it('grows a range that straddles a column insertion', () => {
    expect(fixupReferences('=SUM(A1:C1)', insert(1))).toBe('=SUM(A1:D1)')
  })
})

describe('fixupReferences guards', () => {
  it('leaves literals and non-strings alone', () => {
    const edit = { kind: 'insertRows' as const, at: 0, count: 1 }
    expect(fixupReferences('42', edit)).toBe('42')
    expect(fixupReferences(7, edit)).toBe(7)
  })

  it('is a no-op for a zero-count edit', () => {
    expect(fixupReferences('=A5', { kind: 'insertRows', at: 0, count: 0 })).toBe('=A5')
  })

  it('leaves an unparseable formula alone', () => {
    expect(fixupReferences('=SUM(', { kind: 'insertRows', at: 0, count: 1 })).toBe('=SUM(')
  })
})

describe('formatFormula round trips', () => {
  it('re-renders every construct the parser accepts', () => {
    for (const src of [
      '=1+2*3', '="a"&"b"', '=TRUE', '=-1', '=2^3',
      '=SUM(A1:B2)', '=IF(A1>0,1,0)', '=Orders!A1',
      "='Price list'!A1:C9", '=Tax', '=A1<>B1', '=A:C',
    ]) {
      const once = formatFormula(parseFormula(src))
      // Stable: parsing the output and re-rendering gives the same text.
      expect(formatFormula(parseFormula(once))).toBe(once)
    }
  })
})
