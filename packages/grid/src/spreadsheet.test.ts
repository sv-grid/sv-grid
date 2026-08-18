import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { spreadsheetLayout, spansToMerges } from './spreadsheet'
import type { SpreadsheetActionOptions, SpanColumn } from './spreadsheet'

// jsdom does not implement the global `CSS` object, which `findCell` uses via
// `CSS.escape`. Provide a minimal polyfill so the action's selector queries
// run. (A real browser ships CSS.escape; this is purely an env gap.)
if (typeof globalThis.CSS === 'undefined') {
  // @ts-expect-error - minimal shim for the test environment
  globalThis.CSS = { escape: (s: string) => s.replace(/["\\]/g, '\\$&') }
} else if (typeof globalThis.CSS.escape !== 'function') {
  globalThis.CSS.escape = (s: string) => s.replace(/["\\]/g, '\\$&')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flush a queued requestAnimationFrame callback. The action batches its
 *  work into one rAF, so tests must advance a frame to observe the effect. */
function flushFrame(): Promise<void> {
  return new Promise((resolve) => {
    // Two rAFs: the first lets any already-queued callback run, the second
    // guarantees we resolve AFTER that callback has executed.
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

/** Build a `<table>` with a header-less body of `rows` x `cols`. Each TD is
 *  tagged with `data-svgrid-row` (display index) + `data-col-id` exactly the
 *  way SvGrid emits them, which is what the layout helper queries on. */
function buildGrid(
  rows: number,
  columnOrder: readonly string[],
): { host: HTMLElement; cellAt: (r: number, colId: string) => HTMLTableCellElement } {
  const host = document.createElement('div')
  const table = document.createElement('table')
  const tbody = document.createElement('tbody')
  for (let r = 0; r < rows; r += 1) {
    const tr = document.createElement('tr')
    for (const colId of columnOrder) {
      const td = document.createElement('td')
      td.setAttribute('data-svgrid-row', String(r))
      td.setAttribute('data-col-id', colId)
      td.textContent = `${colId}-${r}`
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  host.appendChild(table)
  document.body.appendChild(host)

  const cellAt = (r: number, colId: string): HTMLTableCellElement => {
    const el = host.querySelector<HTMLTableCellElement>(
      `td[data-svgrid-row="${r}"][data-col-id="${colId}"]`,
    )
    if (!el) throw new Error(`no cell at row=${r} col=${colId}`)
    return el
  }
  return { host, cellAt }
}

let hosts: HTMLElement[] = []
function track(host: HTMLElement): HTMLElement {
  hosts.push(host)
  return host
}

beforeEach(() => {
  hosts = []
})
afterEach(() => {
  for (const h of hosts) h.remove()
  document.body.innerHTML = ''
})

// ---------------------------------------------------------------------------
// Merges
// ---------------------------------------------------------------------------

describe('spreadsheetLayout - merges', () => {
  it('applies colspan + hides covered cells horizontally', async () => {
    const cols = ['a', 'b', 'c']
    const { host, cellAt } = buildGrid(2, cols)
    track(host)
    const action = spreadsheetLayout(host, {
      columnOrder: cols,
      merges: [{ rowIndex: 0, columnId: 'a', colspan: 2 }],
    })
    await flushFrame()

    const origin = cellAt(0, 'a')
    expect(origin.getAttribute('colspan')).toBe('2')
    expect(origin.hasAttribute('rowspan')).toBe(false)
    expect(origin.getAttribute('data-svgrid-sheet')).toBe('')
    // Covered neighbour to the right is hidden + marked.
    expect(cellAt(0, 'b').style.display).toBe('none')
    expect(cellAt(0, 'b').getAttribute('data-svgrid-sheet')).toBe('')
    // Untouched cells stay visible.
    expect(cellAt(0, 'c').style.display).toBe('')
    expect(cellAt(1, 'a').style.display).toBe('')

    action.destroy()
  })

  it('applies rowspan + hides covered cells vertically', async () => {
    const cols = ['a', 'b']
    const { host, cellAt } = buildGrid(3, cols)
    track(host)
    const action = spreadsheetLayout(host, {
      columnOrder: cols,
      merges: [{ rowIndex: 0, columnId: 'a', rowspan: 2 }],
    })
    await flushFrame()

    const origin = cellAt(0, 'a')
    expect(origin.getAttribute('rowspan')).toBe('2')
    expect(origin.hasAttribute('colspan')).toBe(false)
    expect(cellAt(1, 'a').style.display).toBe('none')
    expect(cellAt(2, 'a').style.display).toBe('') // outside the span
    action.destroy()
  })

  it('handles a rectangular colspan + rowspan block', async () => {
    const cols = ['a', 'b', 'c']
    const { host, cellAt } = buildGrid(3, cols)
    track(host)
    const action = spreadsheetLayout(host, {
      columnOrder: cols,
      merges: [{ rowIndex: 0, columnId: 'a', colspan: 2, rowspan: 2 }],
    })
    await flushFrame()

    expect(cellAt(0, 'a').getAttribute('colspan')).toBe('2')
    expect(cellAt(0, 'a').getAttribute('rowspan')).toBe('2')
    // All covered cells except the origin are hidden.
    expect(cellAt(0, 'b').style.display).toBe('none')
    expect(cellAt(1, 'a').style.display).toBe('none')
    expect(cellAt(1, 'b').style.display).toBe('none')
    // c column + row 2 untouched.
    expect(cellAt(0, 'c').style.display).toBe('')
    expect(cellAt(2, 'a').style.display).toBe('')
    action.destroy()
  })

  it('clamps zero/negative span to a minimum of 1 (no colspan/rowspan attr)', async () => {
    const cols = ['a', 'b']
    const { host, cellAt } = buildGrid(2, cols)
    track(host)
    const action = spreadsheetLayout(host, {
      columnOrder: cols,
      merges: [{ rowIndex: 0, columnId: 'a', colspan: 0, rowspan: -5 }],
    })
    await flushFrame()
    const origin = cellAt(0, 'a')
    // Clamped to 1, so no span attributes are written, but it is still marked.
    expect(origin.hasAttribute('colspan')).toBe(false)
    expect(origin.hasAttribute('rowspan')).toBe(false)
    expect(origin.getAttribute('data-svgrid-sheet')).toBe('')
    expect(cellAt(0, 'b').style.display).toBe('') // nothing covered
    action.destroy()
  })

  it('skips a merge whose columnId is not in columnOrder', async () => {
    const cols = ['a', 'b']
    const { host, cellAt } = buildGrid(1, cols)
    track(host)
    const action = spreadsheetLayout(host, {
      columnOrder: cols,
      merges: [{ rowIndex: 0, columnId: 'ghost', colspan: 2 }],
    })
    await flushFrame()
    expect(cellAt(0, 'a').hasAttribute('data-svgrid-sheet')).toBe(false)
    expect(cellAt(0, 'b').style.display).toBe('')
    action.destroy()
  })

  it('skips a merge whose origin cell is not rendered', async () => {
    const cols = ['a', 'b']
    const { host, cellAt } = buildGrid(1, cols)
    track(host)
    const action = spreadsheetLayout(host, {
      columnOrder: cols,
      merges: [{ rowIndex: 99, columnId: 'a', colspan: 2 }],
    })
    await flushFrame()
    // Nothing marked anywhere.
    expect(host.querySelectorAll('[data-svgrid-sheet]').length).toBe(0)
    expect(cellAt(0, 'a').style.display).toBe('')
    action.destroy()
  })

  it('ignores covered cells that fall outside the columnOrder or render window', async () => {
    const cols = ['a', 'b']
    // Only 1 row rendered, but ask for a colspan that runs off the column
    // list AND a rowspan that runs off the rendered rows.
    const { host, cellAt } = buildGrid(1, cols)
    track(host)
    const action = spreadsheetLayout(host, {
      columnOrder: cols,
      merges: [{ rowIndex: 0, columnId: 'b', colspan: 3, rowspan: 3 }],
    })
    await flushFrame()
    const origin = cellAt(0, 'b')
    expect(origin.getAttribute('colspan')).toBe('3')
    expect(origin.getAttribute('rowspan')).toBe('3')
    // No sibling to the right of b, and rows 1/2 don't exist - so the only
    // marked cell is the origin itself.
    expect(host.querySelectorAll('[data-svgrid-sheet]').length).toBe(1)
    action.destroy()
  })
})

// ---------------------------------------------------------------------------
// Selection-edge inheritance
// ---------------------------------------------------------------------------

describe('spreadsheetLayout - selection edge inheritance', () => {
  it('mirrors range-right / range-bottom / selected-range flags onto the origin', async () => {
    const cols = ['a', 'b']
    const { host, cellAt } = buildGrid(2, cols)
    track(host)
    // Mark the far covered cell with range edge flags BEFORE applying.
    cellAt(1, 'b').setAttribute('data-range-right', 'true')
    cellAt(1, 'b').setAttribute('data-range-bottom', 'true')
    cellAt(0, 'b').setAttribute('data-selected-range', 'true')

    const action = spreadsheetLayout(host, {
      columnOrder: cols,
      merges: [{ rowIndex: 0, columnId: 'a', colspan: 2, rowspan: 2 }],
    })
    await flushFrame()
    const origin = cellAt(0, 'a')
    expect(origin.classList.contains('sv-merge-edge-right')).toBe(true)
    expect(origin.classList.contains('sv-merge-edge-bottom')).toBe(true)
    expect(origin.classList.contains('sv-merge-in-range')).toBe(true)
    action.destroy()
  })

  it('leaves edge classes off when no range flags are present', async () => {
    const cols = ['a', 'b']
    const { host, cellAt } = buildGrid(2, cols)
    track(host)
    const action = spreadsheetLayout(host, {
      columnOrder: cols,
      merges: [{ rowIndex: 0, columnId: 'a', colspan: 2, rowspan: 2 }],
    })
    await flushFrame()
    const origin = cellAt(0, 'a')
    expect(origin.classList.contains('sv-merge-edge-right')).toBe(false)
    expect(origin.classList.contains('sv-merge-edge-bottom')).toBe(false)
    expect(origin.classList.contains('sv-merge-in-range')).toBe(false)
    action.destroy()
  })

  it('treats the origin own selected-range flag as in-range', async () => {
    const cols = ['a']
    const { host, cellAt } = buildGrid(1, cols)
    track(host)
    cellAt(0, 'a').setAttribute('data-selected-range', 'true')
    const action = spreadsheetLayout(host, {
      columnOrder: cols,
      merges: [{ rowIndex: 0, columnId: 'a' }],
    })
    await flushFrame()
    expect(cellAt(0, 'a').classList.contains('sv-merge-in-range')).toBe(true)
    action.destroy()
  })
})

// ---------------------------------------------------------------------------
// Borders
// ---------------------------------------------------------------------------

describe('spreadsheetLayout - borders', () => {
  it('injects an overlay with the requested edge styles', async () => {
    const cols = ['a']
    const { host, cellAt } = buildGrid(1, cols)
    track(host)
    const action = spreadsheetLayout(host, {
      columnOrder: cols,
      borders: [
        {
          rowIndex: 0,
          columnId: 'a',
          top: { width: 3, style: 'dashed', color: 'red' },
          bottom: {}, // defaults: 2px solid currentColor
        },
      ],
    })
    await flushFrame()
    const td = cellAt(0, 'a')
    const overlay = td.querySelector<HTMLElement>('.sv-cell-border-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay!.style.borderTop).toBe('3px dashed red')
    // jsdom's CSSOM drops the `currentColor` keyword from the border
    // shorthand, but the width + style survive, confirming the default
    // (2px solid) edge was emitted.
    expect(overlay!.style.borderBottom).toContain('2px solid')
    // No left/right set.
    expect(overlay!.style.borderLeft).toBe('')
    expect(td.getAttribute('data-svgrid-sheet')).toBe('')
    // The TD becomes a positioning context.
    expect(td.style.position).toBe('relative')
    action.destroy()
  })

  it('skips a border spec with no edges set (no overlay injected)', async () => {
    const cols = ['a']
    const { host, cellAt } = buildGrid(1, cols)
    track(host)
    const action = spreadsheetLayout(host, {
      columnOrder: cols,
      borders: [{ rowIndex: 0, columnId: 'a' }],
    })
    await flushFrame()
    expect(cellAt(0, 'a').querySelector('.sv-cell-border-overlay')).toBeNull()
    expect(cellAt(0, 'a').hasAttribute('data-svgrid-sheet')).toBe(false)
    action.destroy()
  })

  it('skips a border spec whose target cell is absent', async () => {
    const cols = ['a']
    const { host } = buildGrid(1, cols)
    track(host)
    const action = spreadsheetLayout(host, {
      columnOrder: cols,
      borders: [{ rowIndex: 5, columnId: 'a', top: { width: 1 } }],
    })
    await flushFrame()
    expect(host.querySelectorAll('.sv-cell-border-overlay').length).toBe(0)
    action.destroy()
  })

  it('does not override an already-positioned TD', async () => {
    const cols = ['a']
    const { host, cellAt } = buildGrid(1, cols)
    track(host)
    cellAt(0, 'a').style.position = 'absolute'
    const action = spreadsheetLayout(host, {
      columnOrder: cols,
      borders: [{ rowIndex: 0, columnId: 'a', left: { color: 'blue' } }],
    })
    await flushFrame()
    expect(cellAt(0, 'a').style.position).toBe('absolute')
    action.destroy()
  })
})

// ---------------------------------------------------------------------------
// Cleanup + update + destroy
// ---------------------------------------------------------------------------

describe('spreadsheetLayout - update + cleanup', () => {
  it('clears prior decorations on the next apply (update path)', async () => {
    const cols = ['a', 'b']
    const { host, cellAt } = buildGrid(2, cols)
    track(host)
    const action = spreadsheetLayout(host, {
      columnOrder: cols,
      merges: [{ rowIndex: 0, columnId: 'a', colspan: 2 }],
      borders: [{ rowIndex: 1, columnId: 'a', top: { width: 1 } }],
    })
    await flushFrame()
    expect(cellAt(0, 'a').getAttribute('colspan')).toBe('2')
    expect(cellAt(1, 'a').querySelector('.sv-cell-border-overlay')).not.toBeNull()

    // Update to an empty spec - everything from the previous run is removed.
    action.update({ columnOrder: cols, merges: [], borders: [] })
    await flushFrame()
    expect(cellAt(0, 'a').hasAttribute('colspan')).toBe(false)
    expect(cellAt(0, 'b').style.display).toBe('')
    expect(cellAt(0, 'a').hasAttribute('data-svgrid-sheet')).toBe(false)
    expect(cellAt(1, 'a').querySelector('.sv-cell-border-overlay')).toBeNull()
    action.destroy()
  })

  it('re-applies decorations when the grid body mutates (MutationObserver)', async () => {
    const cols = ['a', 'b']
    const { host, cellAt } = buildGrid(1, cols)
    track(host)
    const action = spreadsheetLayout(host, {
      columnOrder: cols,
      merges: [{ rowIndex: 1, columnId: 'a', colspan: 2 }],
    })
    await flushFrame()
    // Row 1 does not exist yet - nothing applied.
    expect(host.querySelectorAll('[data-svgrid-sheet]').length).toBe(0)

    // Simulate the grid rendering a new row -> observer schedules apply.
    const tbody = host.querySelector('tbody')!
    const tr = document.createElement('tr')
    for (const colId of cols) {
      const td = document.createElement('td')
      td.setAttribute('data-svgrid-row', '1')
      td.setAttribute('data-col-id', colId)
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
    await flushFrame()
    await flushFrame()
    expect(cellAt(1, 'a').getAttribute('colspan')).toBe('2')
    action.destroy()
  })

  it('destroy disconnects the observer and cancels a pending frame', async () => {
    const cols = ['a', 'b']
    const { host, cellAt } = buildGrid(1, cols)
    track(host)
    // Destroy immediately - the first scheduled frame is pending.
    const action = spreadsheetLayout(host, {
      columnOrder: cols,
      merges: [{ rowIndex: 0, columnId: 'a', colspan: 2 }],
    })
    action.destroy()
    await flushFrame()
    await flushFrame()
    // Frame was cancelled before apply ran.
    expect(cellAt(0, 'a').hasAttribute('colspan')).toBe(false)

    // After destroy, mutations no longer trigger apply.
    const tbody = host.querySelector('tbody')!
    tbody.appendChild(document.createElement('tr'))
    await flushFrame()
    await flushFrame()
    expect(cellAt(0, 'a').hasAttribute('colspan')).toBe(false)
  })

  it('treats null merges / borders as empty (no throw)', async () => {
    const cols = ['a']
    const { host } = buildGrid(1, cols)
    track(host)
    const opts: SpreadsheetActionOptions = {
      columnOrder: cols,
      merges: null,
      borders: null,
    }
    const action = spreadsheetLayout(host, opts)
    await flushFrame()
    expect(host.querySelectorAll('[data-svgrid-sheet]').length).toBe(0)
    action.destroy()
  })
})

describe('spansToMerges - declarative colSpan/rowSpan -> MergeSpec[]', () => {
  type Row = { region: string; q: string; amt: number }
  const rows: Row[] = [
    { region: 'AMER', q: 'Q1', amt: 1 },
    { region: 'AMER', q: 'Q2', amt: 2 },
    { region: 'AMER', q: 'Q3', amt: 3 },
    { region: 'EMEA', q: 'Q1', amt: 4 },
    { region: 'EMEA', q: 'Q2', amt: 5 },
  ]
  // Merge each run of equal `region` values downward.
  function regionRowSpan(): SpanColumn<Row>['rowSpan'] {
    return ({ data, rowIndex }) => {
      if (rowIndex > 0 && rows[rowIndex - 1]!.region === data.region) return 1 // covered
      let n = 1
      while (rows[rowIndex + n]?.region === data.region) n += 1
      return n
    }
  }

  it('emits a rowspan merge at each run origin and skips covered rows', () => {
    const columns: SpanColumn<Row>[] = [{ id: 'region', field: 'region', rowSpan: regionRowSpan() }]
    const merges = spansToMerges(rows, columns)
    // AMER spans rows 0..2 (rowspan 3), EMEA spans rows 3..4 (rowspan 2).
    expect(merges).toEqual([
      { rowIndex: 0, columnId: 'region', colspan: undefined, rowspan: 3 },
      { rowIndex: 3, columnId: 'region', colspan: undefined, rowspan: 2 },
    ])
  })

  it('supports colSpan and marks covered columns', () => {
    const columns: SpanColumn<Row>[] = [
      { id: 'a', field: 'region', colSpan: ({ rowIndex }) => (rowIndex === 0 ? 2 : 1) },
      { id: 'b', field: 'q' },
      { id: 'c', field: 'amt' },
    ]
    const merges = spansToMerges(rows.slice(0, 1), columns)
    expect(merges).toEqual([{ rowIndex: 0, columnId: 'a', colspan: 2, rowspan: undefined }])
  })

  it('returns no merges when no column defines spans', () => {
    expect(spansToMerges(rows, [{ id: 'region', field: 'region' }])).toEqual([])
  })
})
