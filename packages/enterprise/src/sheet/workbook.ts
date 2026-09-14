/**
 * The workbook: several named sheets that can read each other.
 *
 * The engine already parsed `Orders!A1` and `'Price list'!A1:C9` from the day
 * it was promoted, because demo 119 had them. What was missing is the thing
 * those references point AT. This is that model, plus the recalculation that
 * has to span sheets once they can.
 *
 * Cells hold raw text and nothing else. Everything derived - the computed
 * value, the dependency edges, the display string - is recomputed from it, so
 * there is exactly one copy of the truth and no way for a cached value to
 * disagree with the formula above it.
 */
import { parseFormula } from './parse'
import { evaluate, type EvalContext } from './evaluate'
import { withCustomFunctions, type SheetFunction } from './functions'
import { isError, type CellValue, type Node } from './ast'
import { createDependencyGraph, precedentsOf, cellKey, type CellKey } from './deps'
import { createNames, type SheetNames } from './names'
import { fixupReferences, type StructuralEdit } from './refs'

export type SheetData = {
  name: string
  /** Row-major raw text. Ragged is fine; a missing cell reads as empty. */
  cells: string[][]
}

export type WorkbookOptions = {
  /** Extra functions merged over the built-ins. */
  functions?: Record<string, SheetFunction>
  /** Fires after a recalculation, with the cells whose value changed. */
  onRecalc?(changed: ReadonlyArray<{ sheet: string; row: number; col: number; value: CellValue }>): void
}

export type Workbook = {
  readonly sheets: ReadonlyArray<string>
  readonly active: string
  readonly names: SheetNames

  setActive(name: string): void
  addSheet(name?: string, at?: number): string
  removeSheet(name: string): boolean
  renameSheet(from: string, to: string): boolean
  moveSheet(name: string, to: number): boolean

  /** The raw text of a cell: the formula as typed, or the literal. */
  getRaw(sheet: string, row: number, col: number): string
  /** Write raw text and recalculate whatever depends on it. */
  setRaw(sheet: string, row: number, col: number, text: string): void
  /** The computed value. */
  getValue(sheet: string, row: number, col: number): CellValue
  /** Every cell of a sheet, computed. */
  snapshot(sheet: string): CellValue[][]

  /** Apply a structural edit to one sheet, rewriting every formula in the
   *  WORKBOOK that pointed into it. */
  applyStructuralEdit(sheet: string, edit: StructuralEdit): void

  /** Recompute everything. Rarely needed; `setRaw` keeps itself current. */
  recalculate(): void
  rowCount(sheet: string): number
  colCount(sheet: string): number
  serialize(): { sheets: SheetData[]; active: string; names: Record<string, string> }
}

/** A name Excel would accept for a sheet. */
export function isValidSheetName(name: string): boolean {
  if (name.trim() === '' || name.length > 31) return false
  // Excel forbids these because they are the reference grammar.
  return !/[:\\/?*[\]]/.test(name)
}

/** `Sheet1`, `Sheet2`, ... skipping any that already exist. */
function nextSheetName(taken: ReadonlyArray<string>): string {
  const used = new Set(taken.map((n) => n.toLowerCase()))
  for (let i = 1; ; i += 1) {
    const candidate = `Sheet${i}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
}

export function createWorkbook(
  initial: ReadonlyArray<SheetData> = [{ name: 'Sheet1', cells: [] }],
  options: WorkbookOptions = {},
): Workbook {
  const order: string[] = []
  const byName = new Map<string, string[][]>()
  const names = createNames()
  const graph = createDependencyGraph()
  const functions = withCustomFunctions(options.functions)

  /** Computed values, keyed the same way the graph is. Rebuilt lazily and
   *  invalidated by every write, so it can never hold a value whose formula
   *  has since changed. */
  const values = new Map<CellKey, CellValue>()
  /** Cells currently being resolved, for cycle detection. */
  const visiting = new Set<CellKey>()
  /** Parsed formulas, keyed by their TEXT rather than their position: a
   *  column of =A1*2 filled down is one parse, not one per row. */
  const astCache = new Map<string, Node | null>()

  let active = ''

  function sheetCells(name: string): string[][] | undefined {
    return byName.get(name.toLowerCase())
  }

  /** Resolve a sheet reference. A null sheet means the one being evaluated,
   *  which the resolver tracks as it descends. */
  function resolveSheetName(sheet: string | null, self: string): string {
    return sheet ?? self
  }

  function parseCached(text: string): Node | null {
    if (astCache.has(text)) return astCache.get(text) ?? null
    let ast: Node | null
    try {
      ast = parseFormula(text)
    } catch {
      ast = null
    }
    astCache.set(text, ast)
    return ast
  }

  function contextFor(self: string): EvalContext {
    return {
      resolve: (sheet, row, col) => compute(resolveSheetName(sheet, self), row, col),
      lastRow: (sheet) => Math.max(rowCount(resolveSheetName(sheet, self)) - 1, 0),
      resolveName: (name) => {
        const node = names.resolve(name)
        return node ? evaluate(node, contextFor(self)) : undefined
      },
      functions,
    }
  }

  function compute(sheet: string, row: number, col: number): CellValue {
    const cells = sheetCells(sheet)
    if (!cells) return { error: '#REF!' }
    if (row < 0 || col < 0) return { error: '#REF!' }
    // Anything past the written area is BLANK. A sheet has no size in this
    // model beyond what has been typed into it, so there is no edge to fall
    // off: =SUM(A1:A100) over a twelve-row sheet is an ordinary thing to
    // write, and returning #REF! for the empty rows would poison the total.
    //
    // #REF! is reserved for the two cases that really are broken: a sheet
    // that does not exist, and a negative index, which is what a reference
    // shifted off the top by a delete becomes.
    if (row >= cells.length || col >= (cells[row]?.length ?? 0)) return ''

    const key = cellKey(sheet, row, col)
    const cached = values.get(key)
    if (cached !== undefined) return cached
    if (visiting.has(key)) return { error: '#CYCLE!' }

    visiting.add(key)
    const text = (cells[row]?.[col] ?? '').trim()
    let value: CellValue
    if (text === '') {
      value = ''
    } else if (text.startsWith('=')) {
      const ast = parseCached(text)
      if (!ast) value = { error: '#PARSE!' }
      else {
        value = evaluate(ast, contextFor(sheet))
        graph.setPrecedents(key, precedentsOf(ast, { sheet }, (s) =>
          Math.max(rowCount(s ?? sheet) - 1, 0)))
      }
    } else {
      const n = Number(text)
      value = text !== '' && Number.isFinite(n) ? n : text
    }
    visiting.delete(key)
    values.set(key, value)
    return value
  }

  function rowCount(sheet: string): number {
    return sheetCells(sheet)?.length ?? 0
  }

  function colCount(sheet: string): number {
    const cells = sheetCells(sheet)
    if (!cells) return 0
    return cells.reduce((max, row) => Math.max(max, row.length), 0)
  }

  /** Drop cached values for a cell and everything downstream of it. */
  function invalidate(keys: ReadonlyArray<CellKey>): CellKey[] {
    const touched = [...keys]
    for (const key of keys) values.delete(key)
    for (const key of graph.dirtyFrom(keys)) {
      values.delete(key)
      touched.push(key)
    }
    return touched
  }

  function reportRecalc(keys: ReadonlyArray<CellKey>): void {
    const cb = options.onRecalc
    if (!cb || keys.length === 0) return
    cb(keys.map((key) => {
      const gap = key.indexOf(' ')
      const gap2 = key.indexOf(' ', gap + 1)
      const row = Number(key.slice(0, gap))
      const col = Number(key.slice(gap + 1, gap2))
      const sheet = key.slice(gap2 + 1)
      return { sheet, row, col, value: compute(sheet, row, col) }
    }))
  }

  const workbook: Workbook = {
    get sheets() { return [...order] },
    get active() { return active },
    get names() { return names },

    setActive(name) {
      if (sheetCells(name)) active = order.find((n) => n.toLowerCase() === name.toLowerCase()) ?? active
    },

    addSheet(name, at) {
      const chosen = name ?? nextSheetName(order)
      if (!isValidSheetName(chosen)) {
        throw new Error(`"${chosen}" is not a valid sheet name: it must be 1 to 31 characters and must not contain : \\ / ? * [ ]`)
      }
      if (sheetCells(chosen)) throw new Error(`a sheet named "${chosen}" already exists`)
      byName.set(chosen.toLowerCase(), [])
      const index = at === undefined ? order.length : Math.max(0, Math.min(at, order.length))
      order.splice(index, 0, chosen)
      active = chosen
      return chosen
    },

    removeSheet(name) {
      const index = order.findIndex((n) => n.toLowerCase() === name.toLowerCase())
      // A workbook with no sheets has nowhere to put the cursor, and Excel
      // refuses the same way.
      if (index < 0 || order.length <= 1) return false
      const [removed] = order.splice(index, 1)
      byName.delete(removed!.toLowerCase())
      // Every cached value may have read the sheet that just went.
      values.clear()
      graph.clear()
      if (active.toLowerCase() === removed!.toLowerCase()) {
        active = order[Math.min(index, order.length - 1)] ?? order[0]!
      }
      return true
    },

    renameSheet(from, to) {
      const index = order.findIndex((n) => n.toLowerCase() === from.toLowerCase())
      if (index < 0 || !isValidSheetName(to)) return false
      if (from.toLowerCase() !== to.toLowerCase() && sheetCells(to)) return false
      const cells = sheetCells(from)!
      byName.delete(from.toLowerCase())
      byName.set(to.toLowerCase(), cells)
      order[index] = to
      if (active.toLowerCase() === from.toLowerCase()) active = to
      // Formulas naming the old sheet are NOT rewritten. Excel does rewrite
      // them; doing it here means a text substitution over every formula in
      // the workbook, which would also hit a string literal that happens to
      // contain the name. Left out deliberately rather than done badly.
      values.clear()
      graph.clear()
      return true
    },

    moveSheet(name, to) {
      const index = order.findIndex((n) => n.toLowerCase() === name.toLowerCase())
      if (index < 0) return false
      const [moved] = order.splice(index, 1)
      order.splice(Math.max(0, Math.min(to, order.length)), 0, moved!)
      return true
    },

    getRaw(sheet, row, col) {
      return sheetCells(sheet)?.[row]?.[col] ?? ''
    },

    setRaw(sheet, row, col, text) {
      const cells = sheetCells(sheet)
      if (!cells || row < 0 || col < 0) return
      while (cells.length <= row) cells.push([])
      const line = cells[row]!
      while (line.length <= col) line.push('')
      if (line[col] === text) return
      line[col] = text

      const key = cellKey(sheet, row, col)
      // A cell that is no longer a formula reads nothing.
      if (!text.trim().startsWith('=')) graph.setPrecedents(key, null)
      reportRecalc(invalidate([key]))
    },

    getValue(sheet, row, col) {
      return compute(sheet, row, col)
    },

    snapshot(sheet) {
      const rows = rowCount(sheet)
      const cols = colCount(sheet)
      const out: CellValue[][] = []
      for (let r = 0; r < rows; r += 1) {
        const line: CellValue[] = []
        for (let c = 0; c < cols; c += 1) line.push(compute(sheet, r, c))
        out.push(line)
      }
      return out
    },

    applyStructuralEdit(sheet, edit) {
      const target = sheetCells(sheet)
      if (!target || edit.count <= 0) return

      // Rewrite every formula in the WORKBOOK, not just this sheet: another
      // sheet may hold =Orders!A5, and inserting a row in Orders has to move
      // it exactly as if it were local.
      for (const other of order) {
        const cells = sheetCells(other)!
        for (let r = 0; r < cells.length; r += 1) {
          const line = cells[r]!
          for (let c = 0; c < line.length; c += 1) {
            const text = line[c] ?? ''
            if (!text.startsWith('=')) continue
            // A formula on ANOTHER sheet only shifts if it names this one.
            // Rewriting unqualified references there would move them against
            // their own sheet's geometry.
            if (other !== sheet && !text.includes(`${sheet}!`) && !text.includes(`'${sheet}'!`)) continue
            const next = fixupReferences(text, edit)
            if (typeof next === 'string') line[c] = next
          }
        }
      }
      for (const entry of names.list()) {
        const next = fixupReferences(entry.refersTo, edit)
        if (typeof next === 'string') names.define(entry.name, next)
      }

      const blankRow = (): string[] => []
      if (edit.kind === 'insertRows') {
        target.splice(edit.at, 0, ...Array.from({ length: edit.count }, blankRow))
      } else if (edit.kind === 'deleteRows') {
        target.splice(edit.at, edit.count)
      } else if (edit.kind === 'insertCols') {
        for (const line of target) {
          if (line.length >= edit.at) line.splice(edit.at, 0, ...Array<string>(edit.count).fill(''))
        }
      } else {
        for (const line of target) {
          if (line.length > edit.at) line.splice(edit.at, edit.count)
        }
      }

      values.clear()
      graph.clear()
      astCache.clear()
    },

    recalculate() {
      values.clear()
      graph.clear()
    },

    rowCount,
    colCount,

    serialize() {
      return {
        sheets: order.map((name) => ({ name, cells: sheetCells(name)!.map((r) => [...r]) })),
        active,
        names: names.serialize(),
      }
    },
  }

  for (const sheet of initial.length > 0 ? initial : [{ name: 'Sheet1', cells: [] }]) {
    byName.set(sheet.name.toLowerCase(), sheet.cells.map((r) => [...r]))
    order.push(sheet.name)
  }
  active = order[0] ?? ''

  return workbook
}

export { isError }
