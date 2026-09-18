/**
 * The spreadsheet engine's benchmark cases.
 *
 * The question these answer is the one every spreadsheet is asked and few
 * answer honestly: how big a sheet can it hold, and what does one keystroke
 * cost in it. So each case fills a sheet with a formula per row at a growing
 * size and measures two different things:
 *
 *   opening   - the first full calculation of a workbook that arrives with
 *               formulas in it, which is what a user waits through once;
 *   one edit   - typing in one cell and recalculating what depends on it,
 *               which is what a user waits through all day.
 *
 * The wall-clock numbers are reported and never gated, as everywhere else in
 * this harness. What IS gated is the count of CELL EVALUATIONS, taken by
 * putting a counting engine in front of the built-in one through the same
 * `engine` seam an application uses. That number is identical on every
 * machine, and it is the one that regresses: an edit that recalculates the
 * whole sheet instead of its dependents costs 10,000 evaluations rather than
 * two, and no wall-clock gate on a shared runner would catch it reliably.
 *
 * `docs/help/cells/spreadsheet-shell.md` quotes what these produce, so the
 * published ceiling and this file describe the same work.
 */

/** A sheet of `rows` rows: three numbers and a formula over them per row. */
function rowFormulas(rows) {
  const cells = [['A', 'B', 'C', 'Total']]
  for (let r = 1; r <= rows; r += 1) {
    cells.push([String(r), String(r * 2), String(r % 7), `=SUM(A${r + 1}:C${r + 1})`])
  }
  return cells
}

/**
 * A sheet whose every row reads the row above it: the longest dependency
 * chain a sheet of this height can have, and the case where a naive
 * recalculation walks the whole sheet for one edit.
 */
function chain(rows) {
  const cells = [['Seed', 'Running']]
  cells.push(['1', '=A2'])
  for (let r = 2; r <= rows; r += 1) {
    cells.push([String(r), `=B${r}+A${r + 1}`])
  }
  return cells
}

/** One formula over a whole column of numbers. */
function columnSum(rows) {
  const cells = [['Amount', `=SUM(A2:A${rows + 1})`]]
  for (let r = 1; r <= rows; r += 1) cells.push([String(r % 97), ''])
  return cells
}

export function buildSheetCases({ createWorkbook, builtinEngine }) {
  /**
   * The built-in engine with a tally in front of it. `evaluate` is called
   * once per cell whose value the workbook (re)computes, so the tally is
   * exactly the work a change caused.
   */
  function counting() {
    const inner = builtinEngine()
    const counters = { evaluations: 0 }
    return {
      counters,
      engine: {
        name: 'counting',
        evaluate(text, at, host) {
          counters.evaluations += 1
          return inner.evaluate(text, at, host)
        },
      },
    }
  }

  /**
   * A workbook of `cells`. Construction settles every formula in it, which
   * is what opening a file costs; calling `recalculate()` here as well would
   * measure that work twice.
   */
  const opened = (cells, engine) => createWorkbook([{ name: 'S', cells }], engine ? { engine } : {})

  const sizes = [1_000, 10_000, 50_000]
  const cases = []

  for (const rows of sizes) {
    const cells = rowFormulas(rows)
    cases.push({
      id: `sheet-open-${rows / 1000}k`,
      label: `Open a sheet of ${rows.toLocaleString()} rows, one SUM per row`,
      time() {
        return () => {
          const wb = opened(cells)
          return wb.getValue('S', rows, 3)
        }
      },
      counts() {
        const { counters, engine } = counting()
        opened(cells, engine)
        return counters
      },
      heap() {
        // The workbook itself is what is kept: its cells, its cached values
        // and its dependency graph are the memory a sheet of this size costs.
        return () => opened(cells)
      },
      // One evaluation per formula, and not one more: a second pass over the
      // sheet would double this.
      requires: ['evaluations'],
      gate: { evaluations: { max: rows + 4 } },
    })
  }

  const editRows = 10_000
  const editCells = rowFormulas(editRows)
  cases.push({
    id: 'sheet-edit-10k',
    label: `Type in one cell of a ${editRows.toLocaleString()}-row sheet`,
    time() {
      const wb = opened(editCells)
      let n = 0
      return () => {
        wb.setRaw('S', 5_000, 0, String((n += 1)))
        return wb.getValue('S', 5_000, 3)
      }
    },
    counts() {
      const { counters, engine } = counting()
      const wb = opened(editCells, engine)
      counters.evaluations = 0
      wb.setRaw('S', 5_000, 0, '123')
      wb.getValue('S', 5_000, 3)
      return counters
    },
    // The edited cell's one dependent, and nothing else on the sheet.
    requires: ['evaluations'],
    gate: { evaluations: { max: 4 } },
  })

  const chainCells = chain(editRows)
  cases.push({
    id: 'sheet-edit-chain-10k',
    label: `Type at the top of a ${editRows.toLocaleString()}-row dependency chain`,
    time() {
      const wb = opened(chainCells)
      let n = 0
      return () => {
        wb.setRaw('S', 1, 0, String((n += 1)))
        return wb.getValue('S', editRows, 1)
      }
    },
    counts() {
      const { counters, engine } = counting()
      const wb = opened(chainCells, engine)
      counters.evaluations = 0
      wb.setRaw('S', 1, 0, '5')
      wb.getValue('S', editRows, 1)
      return counters
    },
    // Every row downstream, once each: the chain is the worst case, and the
    // budget says the walk does not repeat itself. It is also the case that
    // used to overflow the stack and land a #NUM! in the cell.
    requires: ['evaluations'],
    gate: { evaluations: { max: editRows + 4 } },
  })

  const sumCells = columnSum(editRows)
  cases.push({
    id: 'sheet-edit-column-sum-10k',
    label: `Type in a column a single SUM of ${editRows.toLocaleString()} cells reads`,
    time() {
      const wb = opened(sumCells)
      let n = 0
      return () => {
        wb.setRaw('S', 4_000, 0, String((n += 1)))
        return wb.getValue('S', 0, 1)
      }
    },
    counts() {
      const { counters, engine } = counting()
      const wb = opened(sumCells, engine)
      counters.evaluations = 0
      wb.setRaw('S', 4_000, 0, '7')
      wb.getValue('S', 0, 1)
      return counters
    },
    // The one SUM, recomputed once. A range dependency that fanned out per
    // cell would show up here first.
    requires: ['evaluations'],
    gate: { evaluations: { max: 3 } },
  })

  return cases
}
