import { describe, expect, it } from 'vitest'
import { createGridState } from './index'

describe('createGrid', () => {
  it('createGridState updates controlled values', () => {
    const [sorting, setSorting] = createGridState([{ id: 'age', desc: false }])
    setSorting((prev) => prev.map((entry) => ({ ...entry, desc: true })))
    expect(sorting()[0]?.desc).toBe(true)
  })
})
