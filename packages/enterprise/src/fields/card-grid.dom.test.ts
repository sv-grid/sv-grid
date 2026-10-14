import { describe, expect, it } from 'vitest'
import { cardGrid } from './view-model'

// A grid controller keeps its state in private fields, read through getters.
class Ctrl {
  #rows = ['r1', 'r2']
  props = { fieldButtons: () => 'run' }
  editingEnabled = true
  get allRows() {
    return this.#rows
  }
  getColumnWidth() {
    return 90
  }
  buildApi() {
    return { rows: this.#rows.length }
  }
}

describe('cardGrid: the grid a field cell on a card reads', () => {
  it('is the grid, with the card width and editing off', () => {
    const g = cardGrid(new Ctrl())(196) as Ctrl
    expect(g.getColumnWidth()).toBe(196)
    expect(g.editingEnabled).toBe(false)
    expect(g.allRows).toEqual(['r1', 'r2'])
    expect(g.props.fieldButtons()).toBe('run')
    // A method taken off it still runs on the grid.
    const { buildApi } = g
    expect(buildApi()).toEqual({ rows: 2 })
  })
})
