import { describe, expect, it } from 'vitest'
import { translateFormula, transposeFormula, fixupReferences, formatFormula, renameSheetReferences, referenceSpans, repointReferences, REFERENCE_COLOURS } from './refs'
import { parseFormula } from './parse'

const t = (src: string, dRow: number, dCol: number) => translateFormula(src, dRow, dCol)

describe('a transposed formula', () => {
  it('turns a relative offset: rows become columns and columns rows', () => {
    // D2 reads B2 and C2, two and one columns to its left. Laid on its side
    // at C6, it reads two and one rows ABOVE: C4 and C5.
    expect(transposeFormula('=B2*C2', { row: 1, col: 3 }, { row: 5, col: 2 })).toBe('=C4*C5')
  })
  it('leaves absolute parts where they point, and turns a range corner by corner', () => {
    // A1 is one column left of B1; from D4 that is one row up: D3.
    expect(transposeFormula('=$A$1+A1', { row: 0, col: 1 }, { row: 3, col: 3 })).toBe('=$A$1+D3')
    expect(transposeFormula('=SUM(A1:A3)', { row: 3, col: 0 }, { row: 0, col: 3 })).toBe('=SUM(A1:C1)')
  })
  it('leaves anything that is not a formula alone', () => {
    expect(transposeFormula('12', { row: 0, col: 0 }, { row: 1, col: 1 })).toBe('12')
  })
})

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

describe('parentheses survive a round trip', () => {
  // The AST does not record parentheses, so re-serialising has to rebuild
  // them from precedence. Emitting operands bare turned =(A1+B1)*2 into
  // =A2+B2*2 - a silent wrong answer on every fill, paste and insert-row.
  it('keeps a parenthesised sum inside a product', () => {
    expect(t('=(A1+B1)*2', 1, 0)).toBe('=(A2+B2)*2')
  })

  it('keeps them on the right operand too', () => {
    // a-(b-c) is not a-b-c, so equal precedence on the right still wraps.
    expect(t('=A1-(B1-C1)', 1, 0)).toBe('=A2-(B2-C2)')
    expect(t('=A1/(B1*C1)', 1, 0)).toBe('=A2/(B2*C2)')
  })

  it('does not add parentheses that change nothing', () => {
    expect(t('=A1+B1*2', 1, 0)).toBe('=A2+B2*2')
    expect(t('=A1*B1+2', 1, 0)).toBe('=A2*B2+2')
  })

  it('keeps a negated sum negated', () => {
    expect(t('=-(A1+B1)', 1, 0)).toBe('=-(A2+B2)')
  })

  it('keeps nested power grouping, which needs the right parenthesis', () => {
    // ^ binds left like every other operator, so a^b^c means (a^b)^c and the
    // parenthesis that has to survive is the one on the right.
    expect(t('=(A1^B1)^C1', 1, 0)).toBe('=A2^B2^C2')
    expect(t('=A1^(B1^C1)', 1, 0)).toBe('=A2^(B2^C2)')
  })

  it('drops parentheses that were never doing anything', () => {
    // + already binds tighter than >, so these change nothing and Excel
    // drops them too. What matters is that the meaning survives, which the
    // round-trip test below pins.
    expect(t('=IF((A1+B1)>2,1,0)', 1, 0)).toBe('=IF(A2+B2>2,1,0)')
  })

  it('round-trips a postfix percent', () => {
    expect(t('=A1*5%', 1, 0)).toBe('=A2*5%')
  })
})

describe('renameSheetReferences', () => {
  it('renames a qualified reference, a range, and quotes a name that needs it', () => {
    expect(renameSheetReferences('=Data!A1+1', 'Data', 'Q3 Data')).toBe("='Q3 Data'!A1+1")
    expect(renameSheetReferences("=SUM('Q3 Data'!A1:B2)", 'q3 data', 'Data')).toBe('=SUM(Data!A1:B2)')
  })

  it('leaves unqualified references, other sheets, strings and non-formulas alone', () => {
    expect(renameSheetReferences('=A1+Other!A1', 'Data', 'X')).toBe('=A1+Other!A1')
    expect(renameSheetReferences('="Data!A1"', 'Data', 'X')).toBe('="Data!A1"')
    expect(renameSheetReferences('Data!A1', 'Data', 'X')).toBe('Data!A1')
    expect(renameSheetReferences(7, 'Data', 'X')).toBe(7)
  })
})

describe('translateFormula', () => {
  it('leaves a literal alone', () => {
    expect(t('42', 1, 0)).toBe('42')
    expect(t('hello', 1, 0)).toBe('hello')
    expect(t('', 1, 0)).toBe('')
  })

  it('keeps a lambda called where it stands callable', () => {
    // The call node is printed as callee-then-arguments; rendering it like
    // an ordinary function turned =LAMBDA(x,x*2)(21) into a formula that
    // no longer parses.
    expect(t('=LAMBDA(x,x*2)(A1)', 1, 0)).toBe('=LAMBDA(x,x*2)(A2)')
    expect(t('=LAMBDA(x,LAMBDA(y,x+y))(A1)(B1)', 1, 0)).toBe('=LAMBDA(x,LAMBDA(y,x+y))(A2)(B2)')
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

describe('referenceSpans', () => {
  const [blue, red, purple] = REFERENCE_COLOURS

  it('colours each range in order of first appearance, every occurrence alike', () => {
    const spans = referenceSpans('=SUM(B5:B8)+C2*b5:B8-$C$2')
    expect(spans.map((s) => [s.key, s.colour, s.start, s.end])).toEqual([
      ['B5:B8', blue, 5, 10],
      ['C2', red, 12, 14],
      ['B5:B8', blue, 15, 20],
      ['C2', red, 21, 25],
    ])
    expect(spans[0]!.rect).toEqual([4, 1, 7, 1])
    expect(spans[1]!.rect).toEqual([1, 2, 1, 2])
  })

  it('normalises a range typed backwards and skips strings, other sheets and function names', () => {
    const spans = referenceSpans('=IF(A1="B2", Orders!C3, D4:A1)')
    expect(spans.map((s) => s.key)).toEqual(['A1', 'D4:A1'])
    expect(spans[1]!.rect).toEqual([0, 0, 3, 3])
    expect(spans[1]!.colour).toBe(red)
    expect(referenceSpans('=LOG10(5)+ATAN2(1,2)')).toEqual([])
  })

  it('has nothing for text that is not a formula', () => {
    expect(referenceSpans('A1 and B2')).toEqual([])
    expect(referenceSpans('')).toEqual([])
  })

  it('cycles the palette past six ranges', () => {
    const spans = referenceSpans('=A1+B1+C1+D1+E1+F1+G1')
    expect(spans[6]!.colour).toBe(blue)
    expect(spans[2]!.colour).toBe(purple)
  })
})

// A QA pass read this against Excel: moving a cell repoints the formulas
// that read it, which is what keeps a move from quietly zeroing a total.
describe('repointReferences', () => {
  const move = {
    sheet: 'S', toSheet: 'S', top: 0, left: 0, bottom: 1, right: 0, dRow: 0, dCol: 3,
  }

  it('points a reference at where the cell went', () => {
    expect(repointReferences('=A1*2', move, 'S')).toBe('=D1*2')
    expect(repointReferences('=$A$1*2', move, 'S')).toBe('=$D$1*2')
    expect(repointReferences('=A1+B1', move, 'S')).toBe('=D1+B1')
  })

  it('moves a range only when the whole of it moved', () => {
    expect(repointReferences('=SUM(A1:A2)', move, 'S')).toBe('=SUM(D1:D2)')
    // A2:A3 hangs out of the moved block, so Excel leaves it alone.
    expect(repointReferences('=SUM(A2:A3)', move, 'S')).toBe('=SUM(A2:A3)')
  })

  it('leaves another sheet alone unless the formula names this one', () => {
    expect(repointReferences('=A1*2', move, 'Other')).toBe('=A1*2')
    expect(repointReferences('=S!A1*2', move, 'Other')).toBe('=S!D1*2')
  })

  it('qualifies a reference that lands on another sheet', () => {
    const across = { ...move, toSheet: 'Two', dCol: 0 }
    expect(repointReferences('=A1*2', across, 'S')).toBe('=Two!A1*2')
    // The formula already lives there, so it needs no name.
    expect(repointReferences('=S!A1*2', across, 'Two')).toBe('=A1*2')
  })

  it('leaves literals, whole columns and unparseable text as they are', () => {
    expect(repointReferences('42', move, 'S')).toBe('42')
    expect(repointReferences('=SUM(A:A)', move, 'S')).toBe('=SUM(A:A)')
    expect(repointReferences('=SUM(', move, 'S')).toBe('=SUM(')
  })
})
