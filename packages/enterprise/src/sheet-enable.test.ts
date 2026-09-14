import { describe, expect, it, vi } from 'vitest'
import type { GridCommandContext } from '@svgrid/grid/shortcuts'

function fakeCmd(cells: unknown[][]) {
  const calls = {
    setActiveCell: vi.fn(), setSelection: vi.fn(),
    extendSelection: vi.fn(), scrollIntoView: vi.fn(),
  }
  return {
    cmd: {
      api: {} as never,
      editing: false,
      activeCell: { rowIndex: 0, colIndex: 0, columnId: 'c' },
      rowCount: cells.length,
      colCount: cells[0]?.length ?? 0,
      ranges: [],
      columnIdAt: (c: number) => `c${c}`,
      getCellValue: (r: number, c: number) => cells[r]?.[c],
      setCellValue: (r: number, c: number, v: unknown) => { cells[r]![c] = v },
      startEditing: vi.fn(() => true),
      batch: <T,>(fn: () => T) => fn(),
      ...calls,
    } as unknown as GridCommandContext,
    calls,
  }
}

/**
 * `enableSheet` latches at module scope so calling it twice registers once.
 * Each test that cares about the before/after transition gets its own module
 * instance rather than reaching into that private flag.
 *
 * The REGISTRY has to come from the same fresh graph. `vi.resetModules()` gives
 * the reloaded `sheet-enable` a new copy of `@svgrid/grid/shortcuts` with its
 * own handler array, so a statically imported `hasGridShortcuts` would be
 * looking at a different module and always report nothing registered.
 */
async function freshSheet() {
  vi.resetModules()
  const registry = await import('@svgrid/grid/shortcuts')
  const { enableSheet } = await import('./sheet-enable')
  registry.clearGridShortcuts()
  return { enableSheet, ...registry }
}

describe('enableSheet', () => {
  it('registers nothing until it is called', async () => {
    const { hasGridShortcuts } = await freshSheet()
    expect(hasGridShortcuts()).toBe(false)
  })

  it('registers the keymap with the grid', async () => {
    const { enableSheet, hasGridShortcuts } = await freshSheet()
    enableSheet()
    expect(hasGridShortcuts()).toBe(true)
  })

  it('routes a key through the grid registry into the sheet command', async () => {
    const { enableSheet, runGridShortcuts } = await freshSheet()
    enableSheet()
    const { cmd, calls } = fakeCmd([['a'], ['b'], ['']])
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true, cancelable: true })
    expect(runGridShortcuts(event, cmd)).toBe(true)
    // 'a','b' then blank: Ctrl+Down runs to the last filled cell of the block.
    expect(calls.setActiveCell).toHaveBeenCalledWith(1, 0)
  })

  it('leaves a key it does not bind for the grid to interpret', async () => {
    const { enableSheet, runGridShortcuts } = await freshSheet()
    enableSheet()
    const { cmd } = fakeCmd([['a']])
    const event = new KeyboardEvent('keydown', { key: 'q', cancelable: true })
    expect(runGridShortcuts(event, cmd)).toBe(false)
  })

  it('is idempotent, so a second call does not stack a handler', async () => {
    const { enableSheet, runGridShortcuts } = await freshSheet()
    enableSheet()
    enableSheet()
    const { cmd, calls } = fakeCmd([['a'], ['b'], ['']])
    runGridShortcuts(
      new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true, cancelable: true }),
      cmd,
    )
    expect(calls.setActiveCell).toHaveBeenCalledTimes(1)
  })
})
