/**
 * Dependency graph, so a recalc costs what the edit actually affects.
 *
 * The demo engines call `computeSheet`, which resolves every cell on every
 * keystroke. On a small budget sheet nobody notices; on demo 211's 360-row
 * amortisation schedule, typing one digit in an input cell walks every cell in
 * the sheet and re-parses every formula among them.
 *
 * This tracks which cells each formula reads, inverts that into "who reads
 * me", and walks forward from an edit in topological order.
 *
 * Cycles are reported rather than thrown. A cycle is a normal thing to type on
 * the way to something correct, and every cell in one shows #CYCLE! while the
 * rest of the sheet keeps working.
 */
import { visit, type Node } from './ast'

export type CellKey = string

/**
 * Cells are keyed "row col sheet", in that order deliberately.
 *
 * Row and column are numbers and contain no separator, so the first two fields
 * are unambiguous and EVERYTHING after the second space is the sheet name.
 * Putting the sheet first would let a name like `Price list` collide with a
 * different cell, and a ':' or '!' separator has the same problem the moment
 * someone names a sheet after a range.
 */
export function cellKey(sheet: string | null, row: number, col: number): CellKey {
  return `${row} ${col} ${sheet ?? ''}`
}

export function parseCellKey(key: CellKey): { sheet: string | null; row: number; col: number } {
  const firstGap = key.indexOf(' ')
  const secondGap = key.indexOf(' ', firstGap + 1)
  const sheet = key.slice(secondGap + 1)
  return {
    sheet: sheet === '' ? null : sheet,
    row: Number(key.slice(0, firstGap)),
    col: Number(key.slice(firstGap + 1, secondGap)),
  }
}

/**
 * Every cell a formula reads. A range contributes each cell inside it, which
 * is why `lastRow` is needed: a whole-column reference has no upper bound of
 * its own.
 */
export function precedentsOf(
  ast: Node,
  self: { sheet: string | null },
  lastRow: (sheet: string | null) => number,
  /**
   * The reference behind a defined name. Without it a formula that reads
   * `=Subtotal*Tax` records no precedents at all, so editing the cell behind
   * `Tax` leaves the formula showing its old value until something else
   * forces a recalculation.
   */
  resolveName?: (name: string) => Node | null,
  /**
   * The rectangle behind a structured reference (`Orders[Amount]`,
   * `[@Qty]`). Without it a formula over a table records no precedents, so
   * editing a cell in the table leaves every total reading it stale until
   * something forces a full recalculation.
   */
  resolveTable?: (node: Extract<Node, { k: 'table' }>) => { sheet: string; firstRow: number; lastRow: number; firstCol: number; lastCol: number } | null,
  /**
   * The rectangle a spilled-range operator (`A1#`) currently covers. The
   * anchor cell is always recorded regardless, so a formula reading `A1#`
   * recalculates whenever the array is re-typed and picks up the new extent;
   * the covered cells are added on top so a change anywhere in the spill
   * reaches it too.
   */
  resolveSpill?: (node: Extract<Node, { k: 'spill' }>) => { sheet: string | null; r1: number; c1: number; r2: number; c2: number } | null,
  /** The sheets a 3D reference spans, so it recalculates when the cell on any
   *  of them changes. */
  resolveSheets?: (from: string, to: string) => string[] | null,
  depth = 0,
): CellKey[] {
  const out: CellKey[] = []
  visit(ast, (n) => {
    if (n.k === 'name') {
      // A name defined as another name is followed; a circular chain is cut
      // after a few hops rather than recursing forever.
      const target = depth < 8 ? resolveName?.(n.name) : null
      if (target) out.push(...precedentsOf(target, self, lastRow, resolveName, resolveTable, resolveSpill, resolveSheets, depth + 1))
      return
    }
    if (n.k === 'ref3d') {
      const sheets = resolveSheets?.(n.sheetFrom, n.sheetTo)
      if (!sheets) return
      const r1 = Math.min(n.from.row ?? 0, n.to.row ?? 0)
      const r2 = Math.max(n.from.row ?? 0, n.to.row ?? 0)
      const c1 = Math.min(n.from.col, n.to.col)
      const c2 = Math.max(n.from.col, n.to.col)
      for (const s of sheets) {
        for (let r = r1; r <= r2; r += 1) {
          for (let c = c1; c <= c2; c += 1) out.push(cellKey(s, r, c))
        }
      }
      return
    }
    if (n.k === 'spill') {
      // The anchor always: retyping the array changes the anchor cell, so
      // this makes the reader recalculate and re-derive the extent below.
      out.push(cellKey(n.ref.sheet ?? self.sheet, n.ref.row ?? 0, n.ref.col))
      const rect = resolveSpill?.(n)
      if (rect) {
        for (let r = rect.r1; r <= rect.r2; r += 1) {
          for (let c = rect.c1; c <= rect.c2; c += 1) out.push(cellKey(rect.sheet ?? self.sheet, r, c))
        }
      }
      return
    }
    if (n.k === 'table') {
      const rect = resolveTable?.(n)
      if (!rect) return
      for (let r = rect.firstRow; r <= rect.lastRow; r += 1) {
        for (let c = rect.firstCol; c <= rect.lastCol; c += 1) out.push(cellKey(rect.sheet, r, c))
      }
      return
    }
    if (n.k === 'ref' && n.ref.row !== null) {
      out.push(cellKey(n.ref.sheet ?? self.sheet, n.ref.row, n.ref.col))
      return
    }
    if (n.k === 'range') {
      const sheet = n.from.sheet ?? n.to.sheet ?? self.sheet
      const r1 = Math.min(n.from.row ?? 0, n.to.row ?? n.from.row ?? 0)
      const r2 = n.to.row === null || n.from.row === null
        ? lastRow(sheet)
        : Math.max(n.from.row, n.to.row)
      const c1 = Math.min(n.from.col, n.to.col)
      const c2 = Math.max(n.from.col, n.to.col)
      for (let r = r1; r <= r2; r += 1) {
        for (let c = c1; c <= c2; c += 1) out.push(cellKey(sheet, r, c))
      }
    }
  })
  return out
}

/**
 * Functions whose result can change without any precedent changing: a
 * reference built from text, a range built from arithmetic, the clock, a
 * random number. A cell holding one is recomputed on every edit, as Excel
 * recomputes its volatile cells, rather than trusting the graph.
 */
export const VOLATILE_FUNCTIONS: ReadonlySet<string> = new Set(['INDIRECT', 'OFFSET', 'RAND', 'RANDBETWEEN', 'NOW', 'TODAY'])

export function isVolatile(ast: Node): boolean {
  let found = false
  visit(ast, (n) => {
    if (n.k === 'fn' && VOLATILE_FUNCTIONS.has(n.name)) found = true
  })
  return found
}

export type DependencyGraph = {
  /** Record (or clear, with null) what one cell reads. */
  setPrecedents(cell: CellKey, precedents: ReadonlyArray<CellKey> | null): void
  /** Cells that must recompute after `changed`, ordered so every cell comes
   *  after everything it reads. Excludes the changed cells themselves. */
  dirtyFrom(changed: ReadonlyArray<CellKey>): CellKey[]
  /** Every cell taking part in a dependency cycle. */
  cycles(): CellKey[]
  /** Direct readers of a cell. */
  dependentsOf(cell: CellKey): CellKey[]
  /** What a cell reads directly, as last recorded. */
  precedentsOf(cell: CellKey): CellKey[]
  clear(): void
}

export function createDependencyGraph(): DependencyGraph {
  /** cell -> what it reads. */
  const precedents = new Map<CellKey, Set<CellKey>>()
  /** cell -> who reads it. The index that makes dirtyFrom cheap. */
  const dependents = new Map<CellKey, Set<CellKey>>()

  function unlink(cell: CellKey): void {
    const old = precedents.get(cell)
    if (!old) return
    for (const p of old) {
      const set = dependents.get(p)
      if (!set) continue
      set.delete(cell)
      if (set.size === 0) dependents.delete(p)
    }
    precedents.delete(cell)
  }

  return {
    setPrecedents(cell, next) {
      unlink(cell)
      if (!next || next.length === 0) return
      // A self-reference is a cycle of one; it is kept so `cycles()` sees it.
      const set = new Set(next)
      precedents.set(cell, set)
      for (const p of set) {
        let back = dependents.get(p)
        if (!back) {
          back = new Set()
          dependents.set(p, back)
        }
        back.add(cell)
      }
    },

    dirtyFrom(changed) {
      // Collect everything reachable downstream, then order it so a cell only
      // recomputes once its own inputs have. Kahn's algorithm over that
      // subgraph, not over the whole sheet.
      const affected = new Set<CellKey>()
      const stack = [...changed]
      while (stack.length) {
        const cur = stack.pop()!
        for (const d of dependents.get(cur) ?? []) {
          if (affected.has(d)) continue
          affected.add(d)
          stack.push(d)
        }
      }
      if (affected.size === 0) return []

      const indegree = new Map<CellKey, number>()
      for (const cell of affected) {
        let n = 0
        for (const p of precedents.get(cell) ?? []) if (affected.has(p)) n += 1
        indegree.set(cell, n)
      }
      const ready = [...affected].filter((c) => (indegree.get(c) ?? 0) === 0)
      const order: CellKey[] = []
      const placed = new Set<CellKey>()
      while (ready.length) {
        const cur = ready.shift()!
        order.push(cur)
        placed.add(cur)
        for (const d of dependents.get(cur) ?? []) {
          if (!affected.has(d)) continue
          const n = (indegree.get(d) ?? 0) - 1
          indegree.set(d, n)
          if (n === 0) ready.push(d)
        }
      }
      // Anything left never reached indegree zero, so it sits in a cycle.
      // Append it rather than dropping it: those cells still need evaluating
      // so they can report #CYCLE! instead of keeping a stale value.
      for (const cell of affected) if (!placed.has(cell)) order.push(cell)
      return order
    },

    cycles() {
      // A cell is in a cycle when it can reach itself through its precedents.
      const out: CellKey[] = []
      for (const start of precedents.keys()) {
        const seen = new Set<CellKey>()
        const stack = [...(precedents.get(start) ?? [])]
        let found = false
        while (stack.length) {
          const cur = stack.pop()!
          if (cur === start) { found = true; break }
          if (seen.has(cur)) continue
          seen.add(cur)
          for (const p of precedents.get(cur) ?? []) stack.push(p)
        }
        if (found) out.push(start)
      }
      return out
    },

    precedentsOf(cell) {
      return [...(precedents.get(cell) ?? [])]
    },

    dependentsOf(cell) {
      return [...(dependents.get(cell) ?? [])]
    },

    clear() {
      precedents.clear()
      dependents.clear()
    },
  }
}
