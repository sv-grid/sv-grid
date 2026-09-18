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
import { evaluate, rangeValues, type EvalContext, tableRectOf } from './evaluate'
import { withCustomFunctions, type SheetFunction } from './functions'
import { isError, type CellValue, type Node } from './ast'
import { createDependencyGraph, precedentsOf, isVolatile, cellKey, parseCellKey, type CellKey } from './deps'
import { createTableRegistry, isValidTableName, shiftTables, type TableRegion, type TableRegistry } from './tables'
import { createNames, type SheetNames } from './names'
import { fixupReferences, renameSheetReferences, type StructuralEdit } from './refs'
import { builtinEngine, type SheetEngine } from './engine'

export type SheetData = {
  name: string
  /** Row-major raw text. Ragged is fine; a missing cell reads as empty. */
  cells: string[][]
}

/**
 * Excel's Enable iterative calculation, under File > Options > Formulas.
 *
 * A circular reference is normally an error: every cell in the loop shows
 * #CYCLE!. Some models are written as one on purpose, though, because the
 * answer is a fixed point rather than a mistake: a bonus that is a share of
 * the profit the bonus is subtracted from, an interest charge on a balance
 * the charge is added to. Excel solves those by running the loop over and
 * over from the values it last had, and stopping when either the answer
 * stops moving or the passes run out.
 */
export type IterationSettings = {
  /** Off by default, which is Excel's default and keeps a cycle an error. */
  enabled: boolean
  /** Passes before the answer is taken as it stands. Excel's default is 100. */
  maxIterations: number
  /** The largest move that still counts as settled. Excel's default is 0.001. */
  maxChange: number
}

export const DEFAULT_ITERATION: IterationSettings = { enabled: false, maxIterations: 100, maxChange: 0.001 }

export type WorkbookOptions = {
  /** Extra functions merged over the built-ins. */
  functions?: Record<string, SheetFunction>
  /** Fires after a recalculation, with the cells whose value changed. */
  onRecalc?(changed: ReadonlyArray<{ sheet: string; row: number; col: number; value: CellValue }>): void
  /**
   * Fires for every RAW WRITE, with the text as typed rather than the value
   * it computes: one call per `setRaw` that changed something, and one per
   * cell a structural edit rewrote. This is the seam a delta stream reads
   * (`sheet/delta.ts`), since a collaborator has to receive `=SUM(A1:A9)`
   * rather than 42.
   */
  onWrite?(change: { sheet: string; row: number; col: number; text: string }): void
  /**
   * What works a formula out. The built-in parser and evaluator by
   * default; `createHyperFormulaEngine` puts Excel's full library there
   * instead. The workbook keeps the dependency graph, the cache, the
   * cycles and the spills whichever engine answers.
   */
  engine?: SheetEngine
  /** Tables the workbook starts with, for a document being restored. */
  tables?: ReadonlyArray<TableRegion>
  /** Iterative calculation, off unless a model needs it. */
  iteration?: Partial<IterationSettings>
}

/** One cell read as text that has not been written: what a validation rule checks. */
export type CellOverride = { row: number; col: number; text: string }

export type Workbook = {
  readonly sheets: ReadonlyArray<string>
  readonly active: string
  readonly names: SheetNames
  /**
   * Excel's tables, which is what a structured reference resolves through.
   * Defining one here is what makes `=SUM(Orders[Amount])` mean anything;
   * the shell's Insert > Table does it, and a document restores it.
   */
  readonly tables: TableRegistry

  setActive(name: string): void
  addSheet(name?: string, at?: number): string
  removeSheet(name: string): boolean
  renameSheet(from: string, to: string): boolean
  moveSheet(name: string, to: number): boolean
  /**
   * Copy a sheet's cells into a new sheet placed right after it, named
   * `to` or Excel's "Name (2)", and make it active. The new sheet's
   * formulas read their own sheet where the old ones read theirs, because
   * an unqualified reference is relative to the sheet it sits on. Returns
   * the new name, or null when `from` is unknown or `to` is taken.
   */
  copySheet(from: string, to?: string): string | null

  /** The raw text of a cell: the formula as typed, or the literal. */
  getRaw(sheet: string, row: number, col: number): string
  /** Write raw text and recalculate whatever depends on it. */
  setRaw(sheet: string, row: number, col: number, text: string): void
  /** The computed value. */
  getValue(sheet: string, row: number, col: number): CellValue
  /** Every cell of a sheet, computed. */
  snapshot(sheet: string): CellValue[][]
  /**
   * What `text` would be worth in a cell of `sheet`, without putting it in
   * one: a formula is evaluated there (names and other sheets included), a
   * literal is coerced the way a typed one is. Data validation checks its
   * bounds and custom rules through this, and conditional formatting its
   * formula rules, with `at` naming the cell the text is read for.
   */
  evaluateText(sheet: string, text: string, override?: CellOverride, at?: { row: number; col: number }): CellValue
  /**
   * The values of a range reference, or of a name that refers to one, as a
   * grid; null when `text` is not a reference. A list source.
   */
  evaluateRange(sheet: string, text: string): CellValue[][] | null

  /** Apply a structural edit to one sheet, rewriting every formula in the
   *  WORKBOOK that pointed into it. */
  applyStructuralEdit(sheet: string, edit: StructuralEdit): void

  /**
   * Excel's Trace Precedents: the cells a formula reads directly, on any
   * sheet. Empty for a literal. A whole-column reference contributes its
   * used rows.
   */
  precedents(sheet: string, row: number, col: number): Array<{ sheet: string; row: number; col: number }>
  /**
   * Excel's Trace Dependents: the formulas that read a cell directly. Every
   * formula in the workbook is evaluated first, so a dependent that was
   * never on screen is found too.
   */
  dependents(sheet: string, row: number, col: number): Array<{ sheet: string; row: number; col: number }>

  /**
   * Hear about every raw write, with the text as typed. Returns the
   * unsubscribe. The delta stream reads this; a mirror of the cells in
   * another store can too.
   */
  subscribeWrites(listener: (change: { sheet: string; row: number; col: number; text: string }) => void): () => void
  /** Recompute everything. Rarely needed; `setRaw` keeps itself current. */
  recalculate(): void
  /** How circular references are treated, as the Formulas tab sets it. */
  readonly iteration: IterationSettings
  /**
   * Turn iterative calculation on or off, or change its limits, and
   * recalculate: the cells in a cycle go from #CYCLE! to their fixed point,
   * or back.
   */
  setIteration(next: Partial<IterationSettings>): void
  /**
   * The spill a cell belongs to: the anchor holding the array formula and
   * the rectangle its answer covers, for the anchor itself and every cell
   * it spills into; null for a cell that is neither.
   */
  spillOf(sheet: string, row: number, col: number): { anchor: { row: number; col: number }; rect: readonly [number, number, number, number] } | null
  /** Every spill on a sheet, anchors computed, for a writer that saves the ranges. */
  spills(sheet: string): Array<{ row: number; col: number; rect: readonly [number, number, number, number] }>
  rowCount(sheet: string): number
  colCount(sheet: string): number
  serialize(): { sheets: SheetData[]; active: string; names: Record<string, string>; tables?: TableRegion[]; iteration?: IterationSettings }
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

/** Iteration settings with the defaults filled in and the numbers sane. */
export function cleanIteration(next?: Partial<IterationSettings> | null): IterationSettings {
  const passes = Math.round(Number(next?.maxIterations ?? DEFAULT_ITERATION.maxIterations))
  const change = Number(next?.maxChange ?? DEFAULT_ITERATION.maxChange)
  return {
    enabled: next?.enabled === true,
    maxIterations: Number.isFinite(passes) ? Math.min(Math.max(passes, 1), 32767) : DEFAULT_ITERATION.maxIterations,
    maxChange: Number.isFinite(change) && change >= 0 ? change : DEFAULT_ITERATION.maxChange,
  }
}

/**
 * How far a cell moved between two passes. Two numbers are their distance;
 * anything else has moved either not at all or immeasurably, and an
 * immeasurable move keeps the loop going until the passes run out.
 */
function moved(before: CellValue | undefined, after: CellValue): number {
  if (typeof before === 'number' && typeof after === 'number') return Math.abs(after - before)
  if (before === undefined) return Infinity
  if (isError(before) || isError(after)) {
    return isError(before) && isError(after) && before.error === after.error ? 0 : Infinity
  }
  return before === after ? 0 : Infinity
}

export function createWorkbook(
  initial: ReadonlyArray<SheetData> = [{ name: 'Sheet1', cells: [] }],
  options: WorkbookOptions = {},
): Workbook {
  const order: string[] = []
  const byName = new Map<string, string[][]>()
  const graph = createDependencyGraph()
  /**
   * The workbook's tables. The parser has always read a structured
   * reference (`Orders[Amount]`, `[@Qty]`); this is what makes one resolve,
   * because a reference like that means nothing until something says where
   * the table is.
   */
  const rawTables = createTableRegistry(options.tables)
  /**
   * The registry as the workbook hands it out: every change drops the
   * cached values and settles again.
   *
   * A table decides what `Orders[Amount]` means, so defining one, removing
   * one or growing one changes the answer of every formula that mentions
   * it. Without this, a table defined after the cells were read leaves each
   * of those formulas showing the `#REF!` it worked out when there was no
   * table, which is the first thing anyone hits.
   */
  const tables: TableRegistry = {
    get: (name) => rawTables.get(name),
    list: () => rawTables.list(),
    at: (sheet, row, col) => rawTables.at(sheet, row, col),
    define(table) { rawTables.define(table); afterTables() },
    remove(name) { const gone = rawTables.remove(name); if (gone) afterTables(); return gone },
    growToInclude(sheet, row, col) { const grew = rawTables.growToInclude(sheet, row, col); if (grew) afterTables(); return grew },
    clear() { rawTables.clear(); afterTables() },
  }

  /**
   * `Orders2`, `Orders3`, ...: a table name nothing has taken yet.
   *
   * A short name plus a number can read as a cell reference (`T2`), which
   * Excel refuses as a table name and so does the registry, so those fall
   * back to Excel's own `Table2`.
   */
  function freeTableName(base: string): string {
    const taken = new Set(rawTables.list().map((t) => t.name.toLowerCase()))
    const root = base.replace(/\d+$/, '') || 'Table'
    for (let i = 2; ; i += 1) {
      for (const candidate of [`${root}${i}`, `Table${i}`]) {
        if (!taken.has(candidate.toLowerCase()) && isValidTableName(candidate)) return candidate
      }
    }
  }

  function afterTables(): void {
    dropAll()
    loadEngine()
    settleAll()
  }
  const functions = withCustomFunctions(options.functions)
  const engine = options.engine ?? builtinEngine()

  /** Computed values, keyed the same way the graph is. Rebuilt lazily and
   *  invalidated by every write, so it can never hold a value whose formula
   *  has since changed. */
  const values = new Map<CellKey, CellValue>()
  /** Cells currently being resolved, for cycle detection. */
  const visiting = new Set<CellKey>()
  /** Iterative calculation, and the value each cell had on the pass before:
   *  what a cell in a cycle reads for itself while iteration is on, and what
   *  the convergence test measures against. */
  let iteration: IterationSettings = cleanIteration(options.iteration)
  const previous = new Map<CellKey, CellValue>()
  /** Cells whose formula is volatile (INDIRECT, OFFSET, RAND, NOW ...):
   *  recomputed on every write, since the graph cannot see what they read. */
  const volatile = new Set<CellKey>()
  /** Parsed formulas, keyed by their TEXT rather than their position: a
   *  column of =A1*2 filled down is one parse, not one per row. */
  const astCache = new Map<string, Node | null>()
  // Changing what a name refers to changes every formula that uses it, and
  // the dependency graph only knows the CELLS a name pointed at when the
  // formula was last evaluated. Dropping the cache is the honest answer:
  // names change rarely, and a full recompute costs less than one stale total.
  /**
   * Dynamic arrays. A formula whose answer is a grid spills it over the
   * cells below and to the right: `spills` keeps each anchor's rectangle,
   * `spilledBy` points every covered cell back at its anchor, and a covered
   * cell reads its value from the anchor's grid while its own text stays
   * blank, as in Excel. An anchor whose rectangle runs into a cell that
   * holds text, or into another spill, shows #SPILL! and sits in `blocked`
   * until a write frees the way.
   */
  const spills = new Map<CellKey, { r1: number; c1: number; r2: number; c2: number }>()
  const spilledBy = new Map<CellKey, CellKey>()
  const blocked = new Set<CellKey>()
  /** Cells whose value a spill just changed under them, to compute once the write settles. */
  const pending = new Set<CellKey>()

  const names = ((): SheetNames => {
    const inner = createNames()
    const drop = () => { dropAll(); settleAll() }
    return {
      ...inner,
      define: (name, refersTo) => { inner.define(name, refersTo); drop() },
      remove: (name) => { inner.remove(name); drop() },
      hydrate: (entries) => { inner.hydrate(entries); drop() },
      clear: () => { inner.clear(); drop() },
    }
  })()

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

  function contextFor(self: string, override?: CellOverride, at?: { row: number; col: number }): EvalContext {
    return {
      currentCell: at ? { sheet: self, row: at.row, col: at.col } : undefined,
      resolve: (sheet, row, col) => {
        const name = resolveSheetName(sheet, self)
        // A validation rule reads the cell it is checking as the text being
        // entered, which is not in the sheet yet; nothing else is overridden.
        if (override && name === self && row === override.row && col === override.col) return literal(override.text)
        return compute(name, row, col)
      },
      lastRow: (sheet) => Math.max(rowCount(resolveSheetName(sheet, self)) - 1, 0),
      resolveNameNode: (name) => names.resolve(name),
      findTable: (name) => rawTables.get(name),
      tableAt: (sheet, row, col) => rawTables.at(resolveSheetName(sheet, self), row, col),
      functions,
    }
  }

  /** The engine's copy of the cells, for an engine that keeps one. */
  function loadEngine() {
    engine.load?.(order.map((name) => ({ name, cells: sheetCells(name)!.map((r) => [...r]) })))
  }

  /** Forget every derived thing: values, edges, volatility, spills. */
  function dropAll() {
    values.clear()
    previous.clear()
    graph.clear()
    volatile.clear()
    spills.clear()
    spilledBy.clear()
    blocked.clear()
    pending.clear()
  }

  /** Whether a key holds a formula, for the settling passes. */
  function isFormulaKey(key: CellKey): boolean {
    const at = parseCellKey(key)
    return (sheetCells(at.sheet ?? '')?.[at.row]?.[at.col] ?? '').trim().startsWith('=')
  }

  /**
   * Compute every formula in the workbook, so every spill is on record
   * before any cell it covers is read. Lazy evaluation alone would leave a
   * covered cell blank when it is read before its anchor, which a repaint
   * from the top of a scrolled sheet does.
   */
  function settleAll() {
    for (const other of order) {
      const cells = sheetCells(other) ?? []
      for (let r = 0; r < cells.length; r += 1) {
        const line = cells[r]!
        for (let c = 0; c < line.length; c += 1) if (line[c]!.trim().startsWith('=')) compute(other, r, c)
      }
    }
    settlePending()
    runIterations()
  }

  /**
   * Run the cycles until they stop moving.
   *
   * Everything in a cycle, and everything downstream of one, is recomputed
   * from the values it last had; a pass that moves no cell by more than
   * `maxChange` is the last one, and so is pass number `maxIterations`. This
   * is Excel's model exactly: it does not promise convergence, it promises a
   * bounded number of tries and whatever they reached.
   */
  function runIterations(): CellKey[] {
    if (!iteration.enabled) return []
    const seeds = graph.cycles()
    if (seeds.length === 0) return []
    // Cycle members are downstream of each other, so `dirtyFrom` already
    // includes them; the union is for a seed whose readers were never
    // evaluated.
    const affected = [...new Set([...seeds, ...graph.dirtyFrom(seeds)])]
    for (let pass = 0; pass < Math.max(1, iteration.maxIterations); pass += 1) {
      const before = new Map<CellKey, CellValue | undefined>()
      for (const key of affected) {
        before.set(key, values.get(key) ?? previous.get(key))
        values.delete(key)
      }
      let worst = 0
      for (const key of affected) {
        const at = parseCellKey(key)
        const after = compute(at.sheet ?? '', at.row, at.col)
        worst = Math.max(worst, moved(before.get(key), after))
      }
      if (worst <= iteration.maxChange) break
    }
    return affected
  }

  /** Compute what a spill changed under other formulas, until nothing is left. */
  function settlePending(): CellKey[] {
    const done: CellKey[] = []
    while (pending.size) {
      const batch = [...pending]
      pending.clear()
      for (const key of batch) {
        const at = parseCellKey(key)
        compute(at.sheet ?? '', at.row, at.col)
        done.push(key)
      }
    }
    return done
  }

  /** Drop an anchor's spill; the covered cells' values and edges go with it. */
  function clearSpill(anchor: CellKey): CellKey[] {
    const rect = spills.get(anchor)
    if (!rect) return []
    spills.delete(anchor)
    const at = parseCellKey(anchor)
    const covered: CellKey[] = []
    for (let r = rect.r1; r <= rect.r2; r += 1) {
      for (let c = rect.c1; c <= rect.c2; c += 1) {
        if (r === at.row && c === at.col) continue
        const key = cellKey(at.sheet, r, c)
        if (spilledBy.get(key) !== anchor) continue
        spilledBy.delete(key)
        values.delete(key)
        graph.setPrecedents(key, null)
        covered.push(key)
      }
    }
    return covered
  }

  /**
   * Record an anchor's grid over its rectangle, or refuse it. Returns the
   * anchor's own value: the grid's top-left cell, or #SPILL! when a cell
   * in the way holds text or belongs to another spill.
   */
  function recordSpill(anchor: CellKey, sheet: string, row: number, col: number, grid: CellValue[][]): CellValue {
    const cells = sheetCells(sheet)!
    const rect = { r1: row, c1: col, r2: row + grid.length - 1, c2: col + (grid[0]?.length ?? 1) - 1 }
    for (let r = rect.r1; r <= rect.r2; r += 1) {
      for (let c = rect.c1; c <= rect.c2; c += 1) {
        if (r === row && c === col) continue
        const key = cellKey(sheet, r, c)
        const owner = spilledBy.get(key)
        if ((cells[r]?.[c] ?? '').trim() !== '' || (owner !== undefined && owner !== anchor)) {
          for (const k of clearSpill(anchor)) pending.add(k)
          blocked.add(anchor)
          return { error: '#SPILL!' }
        }
      }
    }
    blocked.delete(anchor)
    const before = spills.get(anchor)
    const stillCovered = new Set<CellKey>()
    for (let r = rect.r1; r <= rect.r2; r += 1) {
      for (let c = rect.c1; c <= rect.c2; c += 1) {
        if (r === row && c === col) continue
        const key = cellKey(sheet, r, c)
        stillCovered.add(key)
        const fresh = spilledBy.get(key) !== anchor
        spilledBy.set(key, anchor)
        values.set(key, grid[r - row]?.[c - col] ?? '')
        graph.setPrecedents(key, [anchor])
        // Reported as changed, and a formula that read this cell while it
        // was blank has a stale value.
        pending.add(key)
        if (fresh) for (const k of graph.dirtyFrom([key])) if (k !== key) { values.delete(k); pending.add(k) }
      }
    }
    // The cells the old rectangle covered and the new one does not read blank again.
    if (before) {
      for (let r = before.r1; r <= before.r2; r += 1) {
        for (let c = before.c1; c <= before.c2; c += 1) {
          const key = cellKey(sheet, r, c)
          if (stillCovered.has(key) || spilledBy.get(key) !== anchor) continue
          spilledBy.delete(key)
          values.delete(key)
          graph.setPrecedents(key, null)
          pending.add(key)
          for (const k of graph.dirtyFrom([key])) if (k !== key) { values.delete(k); pending.add(k) }
        }
      }
    }
    spills.set(anchor, rect)
    return grid[0]?.[0] ?? ''
  }

  /**
   * How deep a cell's value may be resolved by recursion before the chain is
   * primed from the far end instead. A running-balance column is a chain as
   * long as the sheet, and evaluating the last cell of one by recursion
   * overflows the JavaScript stack somewhere past a thousand rows, which the
   * evaluator turns into a `#NUM!`. Priming keeps the depth flat, so the
   * only limit left is the sheet's own size.
   */
  const DEEP = 150
  let depth = 0

  /**
   * Compute what a cell reads, furthest first, so the cell itself resolves
   * against cached values rather than by recursing through the chain. The
   * precedents are the ones the graph recorded at the last evaluation, which
   * is exactly the chain a re-evaluation is about to walk again.
   */
  function primeChain(from: CellKey): void {
    const seen = new Set<CellKey>([from])
    const chain: CellKey[] = [from]
    const stack: CellKey[] = [from]
    while (stack.length) {
      const cur = stack.pop()!
      for (const p of graph.precedentsOf(cur)) {
        if (seen.has(p) || values.get(p) !== undefined) continue
        seen.add(p)
        chain.push(p)
        stack.push(p)
      }
    }
    for (let i = chain.length - 1; i >= 1; i -= 1) {
      const key = chain[i]!
      if (values.get(key) !== undefined) continue
      const at = parseCellKey(key)
      compute(at.sheet ?? '', at.row, at.col)
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
    const key = cellKey(sheet, row, col)
    const cached = values.get(key)
    if (cached !== undefined) return cached
    if (row >= cells.length || col >= (cells[row]?.length ?? 0)) {
      // Past the written area, unless a spill reaches here.
      const anchor = spilledBy.get(key)
      if (anchor === undefined) return ''
      const at = parseCellKey(anchor)
      compute(at.sheet ?? sheet, at.row, at.col)
      return values.get(key) ?? ''
    }
    if (visiting.has(key)) {
      // The cell is being asked for itself. Without iteration that is the
      // error; with it, the loop is meant, and the answer is what this cell
      // was worth on the last pass, starting from 0 as Excel does.
      if (!iteration.enabled) return { error: '#CYCLE!' }
      return previous.get(key) ?? 0
    }

    // Deep enough that recursion is a risk: resolve what this cell reads from
    // the far end first, and come back to it with everything cached.
    if (depth >= DEEP) primeChain(key)

    visiting.add(key)
    depth += 1
    const text = (cells[row]?.[col] ?? '').trim()
    let value: CellValue
    if (text === '') {
      // A blank cell shows what an array formula spills into it.
      const anchor = spilledBy.get(key)
      if (anchor !== undefined) {
        const at = parseCellKey(anchor)
        compute(at.sheet ?? sheet, at.row, at.col)
        const spilled = values.get(key)
        if (spilled !== undefined) { visiting.delete(key); depth -= 1; return spilled }
      }
      value = ''
    } else if (text.startsWith('=')) {
      const ast = parseCached(text)
      // The graph, the volatile set and the spill ranges are read off the
      // reference grammar, which is Excel's whatever evaluates it, so they
      // stay right for any engine. Only the value and the grid are asked for.
      const result = engine.evaluate(text, { sheet, row, col }, {
        context: contextFor(sheet, undefined, { row, col }),
        parse: parseCached,
      })
      value = result.value
      const grid = isError(value) ? null : result.spill ?? null
      if (grid) value = recordSpill(key, sheet, row, col, grid)
      else if (spills.has(key)) for (const k of clearSpill(key)) pending.add(k)
      if (ast) {
        if (isVolatile(ast)) volatile.add(key)
        else volatile.delete(key)
        graph.setPrecedents(key, precedentsOf(
          ast,
          { sheet },
          (s) => Math.max(rowCount(s ?? sheet) - 1, 0),
          (name) => names.resolve(name),
          // A structured reference's cells, so a total over a table is
          // recalculated when a cell inside the table is typed. Best effort:
          // a reference that cannot be resolved records no precedents rather
          // than taking the cell's value down with it, since the value has
          // already been worked out by the time this runs.
          (node) => {
            try {
              return tableRectOf(node, contextFor(sheet, undefined, { row, col }))
            } catch {
              return null
            }
          },
        ))
      } else {
        graph.setPrecedents(key, null)
        volatile.delete(key)
      }
    } else {
      const n = Number(text)
      const upper = text.toUpperCase()
      value = text !== '' && Number.isFinite(n) ? n
        : upper === 'TRUE' ? true
        : upper === 'FALSE' ? false
        : text
    }
    visiting.delete(key)
    depth -= 1
    values.set(key, value)
    if (iteration.enabled) previous.set(key, value)
    return value
  }

  /** What typed text is worth when it is not a formula: a number, a boolean or itself. */
  function literal(text: string): CellValue {
    const t = text.trim()
    if (t === '') return ''
    if (t.startsWith('=')) return t
    const n = Number(t)
    const upper = t.toUpperCase()
    return Number.isFinite(n) ? n : upper === 'TRUE' ? true : upper === 'FALSE' ? false : t
  }

  function rowCount(sheet: string): number {
    return sheetCells(sheet)?.length ?? 0
  }

  function colCount(sheet: string): number {
    const cells = sheetCells(sheet)
    if (!cells) return 0
    return cells.reduce((max, row) => Math.max(max, row.length), 0)
  }

  /** Drop cached values for a cell and everything downstream of it, and
   *  for every volatile cell and its readers, which any write may affect. */
  function invalidate(keys: ReadonlyArray<CellKey>): CellKey[] {
    const touched = [...keys]
    for (const key of keys) values.delete(key)
    for (const key of volatile) {
      if (values.delete(key)) touched.push(key)
    }
    for (const key of graph.dirtyFrom([...keys, ...volatile])) {
      values.delete(key)
      touched.push(key)
    }
    return touched
  }

  /** Every listener on raw writes, plus the option that is one of them. */
  const writeListeners = new Set<(change: { sheet: string; row: number; col: number; text: string }) => void>()
  function emitWrite(change: { sheet: string; row: number; col: number; text: string }): void {
    options.onWrite?.(change)
    for (const listener of writeListeners) listener(change)
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
    get tables() { return tables },

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
      loadEngine()
      return chosen
    },

    removeSheet(name) {
      const index = order.findIndex((n) => n.toLowerCase() === name.toLowerCase())
      // A workbook with no sheets has nowhere to put the cursor, and Excel
      // refuses the same way.
      if (index < 0 || order.length <= 1) return false
      const [removed] = order.splice(index, 1)
      byName.delete(removed!.toLowerCase())
      // The tables that lived on it go with it: a table on a sheet that is
      // gone resolves to cells that are gone.
      for (const table of rawTables.list()) {
        if (table.sheet.toLowerCase() === removed!.toLowerCase()) rawTables.remove(table.name)
      }
      // Every cached value may have read the sheet that just went.
      dropAll()
      loadEngine()
      if (active.toLowerCase() === removed!.toLowerCase()) {
        active = order[Math.min(index, order.length - 1)] ?? order[0]!
      }
      settleAll()
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
      // Every formula and name that pointed at the old name points at the
      // new one, as in Excel; otherwise =Orders!B2 on Summary read #REF!
      // the moment Orders became Sales. The rewrite goes through the parser,
      // so a string literal holding the old name is not touched.
      for (const [, sheet] of byName) {
        for (const line of sheet) {
          for (let c = 0; c < line.length; c += 1) {
            const next = renameSheetReferences(line[c], from, to)
            if (typeof next === 'string') line[c] = next
          }
        }
      }
      for (const entry of names.list()) {
        const next = renameSheetReferences(entry.refersTo, from, to)
        if (typeof next === 'string' && next !== entry.refersTo) names.define(entry.name, next)
      }
      // A table names the sheet it sits on, and a structured reference
      // resolves through that name. Leaving it behind turned every
      // `=SUM(Orders[Amount])` into #REF! the moment the sheet was renamed.
      for (const table of rawTables.list()) {
        if (table.sheet.toLowerCase() === from.toLowerCase()) rawTables.define({ ...table, sheet: to })
      }
      dropAll()
      loadEngine()
      settleAll()
      return true
    },

    moveSheet(name, to) {
      const index = order.findIndex((n) => n.toLowerCase() === name.toLowerCase())
      if (index < 0) return false
      const [moved] = order.splice(index, 1)
      order.splice(Math.max(0, Math.min(to, order.length)), 0, moved!)
      return true
    },

    copySheet(from, to) {
      const index = order.findIndex((n) => n.toLowerCase() === from.toLowerCase())
      const source = sheetCells(from)
      if (index < 0 || !source) return null
      let name = to
      if (name === undefined) {
        const base = order[index]!
        for (let i = 2; ; i += 1) {
          const candidate = `${base} (${i})`
          if (!sheetCells(candidate) && isValidSheetName(candidate)) { name = candidate; break }
          if (i > 1000) return null
        }
      }
      if (!isValidSheetName(name!) || sheetCells(name!)) return null
      byName.set(name!.toLowerCase(), source.map((line) => [...line]))
      order.splice(index + 1, 0, name!)
      active = name!
      // A table belongs to its sheet, so the copy gets one of its own, as
      // Excel's Move or Copy does. Without it the copied cells keep their
      // `[@Qty]` formulas with no table to resolve them, and every one of
      // them reads #REF!.
      for (const table of rawTables.list()) {
        if (table.sheet.toLowerCase() !== from.toLowerCase()) continue
        rawTables.define({ ...table, sheet: name!, name: freeTableName(table.name) })
      }
      // Nothing cached read the new sheet yet, but a formula elsewhere
      // that reads a whole column of it by name cannot exist either, so
      // only the graph needs the new cells' precedents, which compute
      // records on first read. An engine with a copy of the cells does
      // need the new sheet.
      loadEngine()
      return name!
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
      engine.write?.(sheet, row, col, text)
      emitWrite({ sheet: order.find((n) => n.toLowerCase() === sheet.toLowerCase()) ?? sheet, row, col, text })

      const key = cellKey(sheet, row, col)
      const keys: CellKey[] = [key]
      // A cell that is no longer a formula reads nothing, and spills nothing.
      if (!text.trim().startsWith('=')) { graph.setPrecedents(key, null); volatile.delete(key) }
      if (spills.has(key)) keys.push(...clearSpill(key))
      // Text landing in a spilled cell blocks its anchor; a cell going
      // blank may free one that was blocked.
      const anchor = spilledBy.get(key)
      if (anchor !== undefined) keys.push(anchor)
      keys.push(...blocked)
      const touched = invalidate(keys)
      // The written cell and the anchors it touched compute now, so a new
      // or changed spill is on record before anything reads under it;
      // plain dependents wait for their next read, as before.
      for (const k of keys) if (isFormulaKey(k)) { const at = parseCellKey(k); compute(at.sheet ?? sheet, at.row, at.col) }
      reportRecalc([...new Set([...touched, ...settlePending(), ...runIterations()])])
    },

    getValue(sheet, row, col) {
      return compute(sheet, row, col)
    },

    evaluateText(sheet, text, override, at) {
      const t = text.trim()
      if (t === '') return ''
      if (t.startsWith('=')) {
        if (!sheetCells(sheet)) return { error: '#REF!' }
        const ast = parseCached(t)
        // The cell the text is read for, so ROW() and COLUMN() and a
        // [@Column] reference mean something in a rule's formula.
        return ast ? evaluate(ast, contextFor(sheet, override, at ?? (override ? { row: override.row, col: override.col } : undefined))) : { error: '#PARSE!' }
      }
      return literal(t)
    },

    evaluateRange(sheet, text) {
      const t = text.trim()
      if (!t.startsWith('=') || !sheetCells(sheet)) return null
      const ast = parseCached(t)
      return ast ? rangeValues(ast, contextFor(sheet)) : null
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

      // The tables move with their cells, so a structured reference keeps
      // meaning the same column after a row is inserted above the table.
      const moved = shiftTables(rawTables.list(), sheet, edit)
      rawTables.clear()
      for (const table of moved) rawTables.define(table)

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
            // Only references INTO this sheet move: an unqualified one on
            // another sheet belongs to that sheet's geometry, which did not
            // change, and a reference on THIS sheet that names another sheet
            // belongs to that one. The scope tells the rewriter both.
            if (other !== sheet && !text.includes(`${sheet}!`) && !text.includes(`'${sheet}'!`)) continue
            const next = fixupReferences(text, edit, { sheet, self: other })
            if (typeof next === 'string') line[c] = next
          }
        }
      }
      // A name has no home sheet, so only one that names this sheet moves.
      // NetSales = Orders!$I$2:$I$25 must not shift because a column went
      // into Summary.
      for (const entry of names.list()) {
        const next = fixupReferences(entry.refersTo, edit, { sheet, self: null })
        if (typeof next === 'string' && next !== entry.refersTo) names.define(entry.name, next)
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

      dropAll()
      astCache.clear()
      loadEngine()
      settleAll()
    },

    precedents(sheet, row, col) {
      const name = order.find((n) => n.toLowerCase() === sheet.toLowerCase())
      if (!name) return []
      // Computing the cell records what it reads.
      compute(name, row, col)
      return graph.precedentsOf(cellKey(name, row, col)).map((key) => {
        const at = parseCellKey(key)
        return { sheet: at.sheet ?? name, row: at.row, col: at.col }
      })
    },

    dependents(sheet, row, col) {
      const name = order.find((n) => n.toLowerCase() === sheet.toLowerCase())
      if (!name) return []
      // A formula that was never evaluated has no edge yet: evaluate every
      // formula once so the graph is whole.
      for (const other of order) {
        const cells = sheetCells(other) ?? []
        for (let r = 0; r < cells.length; r += 1) {
          const line = cells[r]!
          for (let c = 0; c < line.length; c += 1) if (line[c]!.trim().startsWith('=')) compute(other, r, c)
        }
      }
      return graph.dependentsOf(cellKey(name, row, col)).map((key) => {
        const at = parseCellKey(key)
        return { sheet: at.sheet ?? name, row: at.row, col: at.col }
      })
    },

    subscribeWrites(listener) {
      writeListeners.add(listener)
      return () => { writeListeners.delete(listener) }
    },

    recalculate() {
      dropAll()
      loadEngine()
      settleAll()
    },

    get iteration() { return { ...iteration } },

    setIteration(next) {
      const wanted = cleanIteration({ ...iteration, ...next })
      if (wanted.enabled === iteration.enabled && wanted.maxIterations === iteration.maxIterations && wanted.maxChange === iteration.maxChange) return
      iteration = wanted
      // Turning it on turns #CYCLE! into a number, and turning it off turns
      // the number back into #CYCLE!, so every cached value is suspect.
      dropAll()
      settleAll()
    },

    spillOf(sheet, row, col) {
      const name = order.find((n) => n.toLowerCase() === sheet.toLowerCase())
      if (!name) return null
      compute(name, row, col)
      const key = cellKey(name, row, col)
      const anchor = spills.has(key) ? key : spilledBy.get(key)
      if (anchor === undefined) return null
      const rect = spills.get(anchor)
      if (!rect) return null
      const at = parseCellKey(anchor)
      return { anchor: { row: at.row, col: at.col }, rect: [rect.r1, rect.c1, rect.r2, rect.c2] as const }
    },

    spills(sheet) {
      const name = order.find((n) => n.toLowerCase() === sheet.toLowerCase())
      if (!name) return []
      settleAll()
      const out: Array<{ row: number; col: number; rect: readonly [number, number, number, number] }> = []
      for (const [anchor, rect] of spills) {
        const at = parseCellKey(anchor)
        if ((at.sheet ?? '').toLowerCase() !== name.toLowerCase()) continue
        out.push({ row: at.row, col: at.col, rect: [rect.r1, rect.c1, rect.r2, rect.c2] as const })
      }
      return out.sort((a, b) => a.row - b.row || a.col - b.col)
    },

    rowCount,
    colCount,

    serialize() {
      const list = rawTables.list()
      return {
        sheets: order.map((name) => ({ name, cells: sheetCells(name)!.map((r) => [...r]) })),
        active,
        names: names.serialize(),
        // Absent rather than empty in a workbook with no tables, so a saved
        // document from before they existed reads the same either way.
        ...(list.length ? { tables: list.map((t) => ({ ...t })) } : {}),
        // Written only when it is on, so a document saved by a workbook that
        // never heard of iteration reads back identically.
        ...(iteration.enabled ? { iteration: { ...iteration } } : {}),
      }
    },
  }

  for (const sheet of initial.length > 0 ? initial : [{ name: 'Sheet1', cells: [] }]) {
    byName.set(sheet.name.toLowerCase(), sheet.cells.map((r) => [...r]))
    order.push(sheet.name)
  }
  active = order[0] ?? ''
  loadEngine()
  settleAll()

  return workbook
}

export { isError }
