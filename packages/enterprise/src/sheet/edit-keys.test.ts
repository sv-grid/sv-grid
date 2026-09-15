import { describe, expect, it } from 'vitest'
import { cycleReference } from './edit-keys'

describe('cycleReference (F4)', () => {
  it('turns the reference at the caret through the four anchorings', () => {
    let edit = { text: '=A1+B1', caret: 6 }
    const seen: string[] = []
    for (let i = 0; i < 4; i += 1) {
      edit = cycleReference(edit.text, edit.caret)!
      seen.push(edit.text)
    }
    expect(seen).toEqual(['=A1+$B$1', '=A1+B$1', '=A1+$B1', '=A1+B1'])
    // The caret stays after the reference it turned.
    expect(edit.caret).toBe(6)
  })

  it('turns both ends of a range together', () => {
    expect(cycleReference('=SUM(A1:B2)', 10)?.text).toBe('=SUM($A$1:$B$2)')
    expect(cycleReference('=SUM($A$1:$B$2)', 14)?.text).toBe('=SUM(A$1:B$2)')
  })

  it('finds the reference the caret is inside, not the first one', () => {
    expect(cycleReference('=A1+B1', 2)?.text).toBe('=$A$1+B1')
    expect(cycleReference('=A1+B1', 4)?.text).toBe('=A1+$B$1')
  })

  it('leaves the sheet prefix and everything that is not a reference alone', () => {
    expect(cycleReference('=Orders!B2', 10)?.text).toBe('=Orders!$B$2')
    expect(cycleReference('=SUM1(2)', 5)).toBeNull()
    expect(cycleReference('hello', 3)).toBeNull()
    expect(cycleReference('=1+2', 4)).toBeNull()
  })
})
