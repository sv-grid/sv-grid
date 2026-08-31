<script lang="ts">
  /**
   * 83. Spreadsheet formulas
   * ------------------------
   * SvGrid driving a real spreadsheet: cells can hold either a literal
   * value (number, string, boolean) or a formula starting with `=`. The
   * embedded engine supports:
   *
   *   - Cell refs:       A1, B2, AA10, $C$3 (absolute - same evaluation here)
   *   - Ranges:          A1:A10, B2:D5
   *   - Arithmetic:      + - * / ^ % (unary -)
   *   - Comparison:      = <> < > <= >=
   *   - String concat:   &
   *   - Functions:       SUM, AVG / AVERAGE, MIN, MAX, COUNT, COUNTA, COUNTIF,
   *                      IF, AND, OR, NOT, ROUND, ABS, LEN, LEFT, RIGHT,
   *                      UPPER, LOWER, CONCAT, TODAY
   *   - Literals:        numbers (1.5, -3), strings ("hello"), booleans (TRUE/FALSE)
   *
   * The sheet auto-recomputes on every cell change. Circular dependencies
   * are detected and reported as `#CYCLE!`; unknown references show
   * `#REF!`; type mismatches show `#VALUE!`.
   *
   * Bridges the gap with Excel-like products without bundling HyperFormula -
   * good enough for budgets, scorecards, conditional reports, lightweight
   * planning, and any use case that needs in-cell calc.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  // =================================================================
  // ENGINE
  // =================================================================

  type CellVal = string | number | boolean | { error: string }
  function isError(v: CellVal): v is { error: string } {
    return typeof v === 'object' && v !== null && 'error' in v
  }

  // ---- Addressing -------------------------------------------------------
  function colToLetters(col: number): string {
    let n = col, out = ''
    while (n >= 0) { out = String.fromCharCode(65 + (n % 26)) + out; n = Math.floor(n / 26) - 1 }
    return out
  }
  function lettersToCol(letters: string): number {
    let col = 0
    for (const ch of letters.toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64)
    return col - 1
  }
  function parseRef(ref: string): { row: number; col: number } | null {
    const m = ref.replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/i)
    if (!m) return null
    return { row: parseInt(m[2]!, 10) - 1, col: lettersToCol(m[1]!) }
  }

  // ---- Tokenizer --------------------------------------------------------
  type Token =
    | { t: 'num'; v: number }
    | { t: 'str'; v: string }
    | { t: 'bool'; v: boolean }
    | { t: 'ref'; row: number; col: number }
    | { t: 'range'; r1: number; c1: number; r2: number; c2: number }
    | { t: 'fn'; v: string }
    | { t: 'op'; v: string }
    | { t: 'lparen' } | { t: 'rparen' } | { t: 'comma' }

  function tokenize(formula: string): Token[] {
    const src = formula.trim()
    const out: Token[] = []
    let i = 0
    while (i < src.length) {
      const ch = src[i]!
      if (/\s/.test(ch)) { i++; continue }
      if (ch === '(') { out.push({ t: 'lparen' }); i++; continue }
      if (ch === ')') { out.push({ t: 'rparen' }); i++; continue }
      if (ch === ',') { out.push({ t: 'comma' }); i++; continue }
      if (ch === '"') {
        const end = src.indexOf('"', i + 1)
        if (end === -1) throw new Error('Unterminated string')
        out.push({ t: 'str', v: src.slice(i + 1, end) })
        i = end + 1
        continue
      }
      // Numbers (literal numeric, allow leading dot)
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
        let j = i
        while (j < src.length && /[0-9.]/.test(src[j]!)) j++
        out.push({ t: 'num', v: Number(src.slice(i, j)) })
        i = j
        continue
      }
      // Refs / ranges / functions / booleans
      if (/[A-Za-z$]/.test(ch)) {
        let j = i
        while (j < src.length && /[A-Za-z0-9$.]/.test(src[j]!)) j++
        const word = src.slice(i, j)
        const upper = word.toUpperCase()
        i = j
        // Range A1:A10
        const refLeft = parseRef(word)
        if (refLeft && src[i] === ':') {
          let k = i + 1
          while (k < src.length && /[A-Za-z0-9$]/.test(src[k]!)) k++
          const right = src.slice(i + 1, k)
          const refRight = parseRef(right)
          if (refRight) {
            out.push({
              t: 'range',
              r1: Math.min(refLeft.row, refRight.row), c1: Math.min(refLeft.col, refRight.col),
              r2: Math.max(refLeft.row, refRight.row), c2: Math.max(refLeft.col, refRight.col),
            })
            i = k
            continue
          }
        }
        if (refLeft) { out.push({ t: 'ref', ...refLeft }); continue }
        if (upper === 'TRUE')  { out.push({ t: 'bool', v: true }); continue }
        if (upper === 'FALSE') { out.push({ t: 'bool', v: false }); continue }
        // Function call - must be followed by `(`
        // Skip whitespace before `(`.
        let look = i
        while (look < src.length && /\s/.test(src[look]!)) look++
        if (src[look] === '(') { out.push({ t: 'fn', v: upper }); continue }
        throw new Error(`Unexpected token: ${word}`)
      }
      // Operators (greedy)
      const two = src.slice(i, i + 2)
      if (two === '<=' || two === '>=' || two === '<>') {
        out.push({ t: 'op', v: two }); i += 2; continue
      }
      if ('+-*/^%&=<>'.includes(ch)) { out.push({ t: 'op', v: ch }); i++; continue }
      throw new Error(`Unexpected character: ${ch}`)
    }
    return out
  }

  // ---- Parser (Pratt-ish precedence climbing) ---------------------------
  type Node =
    | { k: 'num'; v: number }
    | { k: 'str'; v: string }
    | { k: 'bool'; v: boolean }
    | { k: 'ref'; row: number; col: number }
    | { k: 'range'; r1: number; c1: number; r2: number; c2: number }
    | { k: 'unary'; op: string; arg: Node }
    | { k: 'binary'; op: string; left: Node; right: Node }
    | { k: 'fn'; name: string; args: Node[] }

  const PREC: Record<string, number> = {
    '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1,
    '&': 2,
    '+': 3, '-': 3,
    '*': 4, '/': 4,
    '^': 5, '%': 5,
  }

  function parse(tokens: Token[]): Node {
    let pos = 0
    function peek() { return tokens[pos] }
    function next() { return tokens[pos++] }
    function parseExpr(minPrec: number): Node {
      let left = parsePrimary()
      while (true) {
        const t = peek()
        if (!t || t.t !== 'op') break
        const prec = PREC[t.v]
        if (prec === undefined || prec < minPrec) break
        next()
        const right = parseExpr(prec + 1)
        left = { k: 'binary', op: t.v, left, right }
      }
      return left
    }
    function parsePrimary(): Node {
      const t = next()
      if (!t) throw new Error('Unexpected end of formula')
      if (t.t === 'num')   return { k: 'num', v: t.v }
      if (t.t === 'str')   return { k: 'str', v: t.v }
      if (t.t === 'bool')  return { k: 'bool', v: t.v }
      if (t.t === 'ref')   return { k: 'ref', row: t.row, col: t.col }
      if (t.t === 'range') return { k: 'range', r1: t.r1, c1: t.c1, r2: t.r2, c2: t.c2 }
      if (t.t === 'op' && t.v === '-') return { k: 'unary', op: '-', arg: parseExpr(6) }
      if (t.t === 'op' && t.v === '+') return parseExpr(6)
      if (t.t === 'lparen') {
        const inner = parseExpr(1)
        const close = next()
        if (!close || close.t !== 'rparen') throw new Error('Missing )')
        return inner
      }
      if (t.t === 'fn') {
        const open = next()
        if (!open || open.t !== 'lparen') throw new Error(`Expected ( after ${t.v}`)
        const args: Node[] = []
        if (peek()?.t !== 'rparen') {
          args.push(parseExpr(1))
          while (peek()?.t === 'comma') { next(); args.push(parseExpr(1)) }
        }
        const close = next()
        if (!close || close.t !== 'rparen') throw new Error('Missing )')
        return { k: 'fn', name: t.v, args }
      }
      throw new Error(`Unexpected token: ${JSON.stringify(t)}`)
    }
    const result = parseExpr(1)
    if (pos < tokens.length) throw new Error('Unexpected trailing tokens')
    return result
  }

  // ---- Evaluator --------------------------------------------------------
  type Sheet = string[][] // raw text per cell
  type CellResolver = (row: number, col: number) => CellVal

  function toNumber(v: CellVal): number {
    if (typeof v === 'number') return v
    if (typeof v === 'boolean') return v ? 1 : 0
    if (typeof v === 'string') {
      if (v === '') return 0
      const n = Number(v)
      if (Number.isFinite(n)) return n
      throw new Error('#VALUE!')
    }
    if (isError(v)) throw new Error(v.error)
    return 0
  }
  function toBool(v: CellVal): boolean {
    if (typeof v === 'boolean') return v
    if (typeof v === 'number') return v !== 0
    if (typeof v === 'string') return v.length > 0 && v.toUpperCase() !== 'FALSE'
    if (isError(v)) throw new Error(v.error)
    return false
  }
  function toStr(v: CellVal): string {
    if (typeof v === 'string') return v
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
    if (typeof v === 'number') return String(v)
    if (isError(v)) throw new Error(v.error)
    return ''
  }
  function flattenRange(r1: number, c1: number, r2: number, c2: number, resolve: CellResolver): CellVal[] {
    const out: CellVal[] = []
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push(resolve(r, c))
    return out
  }
  function nums(vals: CellVal[]): number[] {
    return vals.filter((v) => v !== '' && !isError(v)).map((v) => toNumber(v))
  }

  function evaluate(node: Node, resolve: CellResolver): CellVal {
    if (node.k === 'num')  return node.v
    if (node.k === 'str')  return node.v
    if (node.k === 'bool') return node.v
    if (node.k === 'ref')  return resolve(node.row, node.col)
    if (node.k === 'range') {
      // A bare range outside a function call: take the first cell.
      return resolve(node.r1, node.c1)
    }
    if (node.k === 'unary') {
      const v = evaluate(node.arg, resolve)
      if (isError(v)) return v
      if (node.op === '-') return -toNumber(v)
      return v
    }
    if (node.k === 'binary') {
      const l = evaluate(node.left, resolve)
      const r = evaluate(node.right, resolve)
      if (isError(l)) return l
      if (isError(r)) return r
      switch (node.op) {
        case '+': return toNumber(l) + toNumber(r)
        case '-': return toNumber(l) - toNumber(r)
        case '*': return toNumber(l) * toNumber(r)
        case '/': {
          const rv = toNumber(r)
          if (rv === 0) return { error: '#DIV/0!' }
          return toNumber(l) / rv
        }
        case '^': return Math.pow(toNumber(l), toNumber(r))
        case '%': return toNumber(l) % toNumber(r)
        case '&': return toStr(l) + toStr(r)
        case '=':  return looseEquals(l, r)
        case '<>': return !looseEquals(l, r)
        case '<':  return toNumber(l) <  toNumber(r)
        case '>':  return toNumber(l) >  toNumber(r)
        case '<=': return toNumber(l) <= toNumber(r)
        case '>=': return toNumber(l) >= toNumber(r)
      }
    }
    if (node.k === 'fn') {
      // Materialize args - ranges expand into arrays of CellVal.
      const expanded: CellVal[][] = node.args.map((a) => {
        if (a.k === 'range') return flattenRange(a.r1, a.c1, a.r2, a.c2, resolve)
        return [evaluate(a, resolve)]
      })
      const flat = expanded.flat()
      for (const v of flat) if (isError(v)) return v
      switch (node.name) {
        case 'SUM':     return nums(flat).reduce((a, b) => a + b, 0)
        case 'AVG':
        case 'AVERAGE': {
          const ns = nums(flat)
          if (ns.length === 0) return { error: '#DIV/0!' }
          return ns.reduce((a, b) => a + b, 0) / ns.length
        }
        case 'MIN':     { const ns = nums(flat); return ns.length ? Math.min(...ns) : 0 }
        case 'MAX':     { const ns = nums(flat); return ns.length ? Math.max(...ns) : 0 }
        case 'COUNT':   return flat.filter((v) => typeof v === 'number').length
        case 'COUNTA':  return flat.filter((v) => v !== '' && !isError(v)).length
        case 'COUNTIF': {
          const target = expanded[1]?.[0]
          if (target === undefined) return 0
          const pool = expanded[0] ?? []
          return pool.filter((v) => looseEquals(v, target)).length
        }
        case 'IF': {
          const cond = expanded[0]?.[0] ?? false
          return toBool(cond as CellVal)
            ? (expanded[1]?.[0] ?? true)
            : (expanded[2]?.[0] ?? false)
        }
        case 'AND': return flat.every((v) => toBool(v))
        case 'OR':  return flat.some((v) => toBool(v))
        case 'NOT': return !toBool(flat[0] ?? false)
        case 'ROUND': {
          const v = toNumber(flat[0] ?? 0)
          const d = Math.round(toNumber(flat[1] ?? 0))
          const f = Math.pow(10, d)
          return Math.round(v * f) / f
        }
        case 'ABS':   return Math.abs(toNumber(flat[0] ?? 0))
        case 'LEN':   return toStr(flat[0] ?? '').length
        case 'LEFT':  return toStr(flat[0] ?? '').slice(0, Math.max(0, Math.round(toNumber(flat[1] ?? 1))))
        case 'RIGHT': {
          const s = toStr(flat[0] ?? ''); const n = Math.max(0, Math.round(toNumber(flat[1] ?? 1)))
          return s.slice(Math.max(0, s.length - n))
        }
        case 'UPPER': return toStr(flat[0] ?? '').toUpperCase()
        case 'LOWER': return toStr(flat[0] ?? '').toLowerCase()
        case 'CONCAT': return flat.map((v) => toStr(v)).join('')
        case 'TODAY': return new Date().toISOString().slice(0, 10)
      }
      return { error: '#NAME?' }
    }
    return { error: '#VALUE!' }
  }

  function looseEquals(a: CellVal, b: CellVal): boolean {
    if (typeof a === 'number' && typeof b === 'number') return a === b
    if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase()
    if (typeof a === 'boolean' && typeof b === 'boolean') return a === b
    return toStr(a) === toStr(b)
  }

  // ---- Sheet recompute with cycle detection -----------------------------
  function computeSheet(sheet: Sheet): CellVal[][] {
    const rowsN = sheet.length
    const colsN = sheet[0]?.length ?? 0
    const computed: (CellVal | undefined)[][] = Array.from({ length: rowsN }, () => new Array(colsN))
    const visiting: boolean[][] = Array.from({ length: rowsN }, () => new Array(colsN).fill(false))
    function resolve(r: number, c: number): CellVal {
      if (r < 0 || r >= rowsN || c < 0 || c >= colsN) return { error: '#REF!' }
      if (computed[r]![c] !== undefined) return computed[r]![c]!
      if (visiting[r]![c]) return { error: '#CYCLE!' }
      visiting[r]![c] = true
      const raw = (sheet[r]![c] ?? '').trim()
      let value: CellVal
      if (raw === '') value = ''
      else if (raw.startsWith('=')) {
        try {
          const tokens = tokenize(raw.slice(1))
          const ast = parse(tokens)
          value = evaluate(ast, resolve)
        } catch (e) {
          const msg = e instanceof Error ? e.message : '#ERR!'
          value = { error: msg.startsWith('#') ? msg : '#PARSE!' }
        }
      } else {
        // Auto-coerce: try number, else string.
        const n = Number(raw)
        value = (raw !== '' && Number.isFinite(n)) ? n : raw
      }
      visiting[r]![c] = false
      computed[r]![c] = value
      return value
    }
    for (let r = 0; r < rowsN; r++) for (let c = 0; c < colsN; c++) resolve(r, c)
    return computed.map((row) => row.map((v) => v ?? '')) as CellVal[][]
  }

  // =================================================================
  // DEMO
  // =================================================================

  // Seed a budget tracker with formulas demonstrating each feature.
  const ROW_COUNT = 16
  const COL_COUNT = 8  // A-H

  // raw[row][col] = raw text the user typed (formula or literal).
  function makeSeed(): Sheet {
    const s: Sheet = Array.from({ length: ROW_COUNT }, () => new Array(COL_COUNT).fill(''))
    // Header row
    s[0] = ['Category', 'Unit cost', 'Qty', 'Subtotal', 'Tax %', 'Tax', 'Total', 'Status']
    // Data
    const data: [string, string, string, string][] = [
      ['Domain registration', '12.99',  '3',  '0.08'],
      ['Hosting (monthly)',   '49.00',  '12', '0.08'],
      ['SSL cert',            '85.00',  '1',  '0.08'],
      ['Email service',       '20.00',  '12', '0.08'],
      ['CDN bandwidth',       '0.085',  '5000','0.08'],
      ['Analytics seat',      '79.00',  '5',  '0.08'],
      ['Design license',      '52.00',  '3',  '0.08'],
      ['Storage (TB)',        '23.00',  '4',  '0.08'],
      ['Backup retention',    '15.00',  '12', '0.08'],
      ['Monitoring agent',    '8.00',   '24', '0.08'],
    ]
    data.forEach(([cat, cost, qty, tax], i) => {
      const r = i + 1
      s[r]![0] = cat
      s[r]![1] = cost
      s[r]![2] = qty
      s[r]![3] = `=B${r + 1}*C${r + 1}`            // Subtotal = unit cost * qty
      s[r]![4] = tax
      s[r]![5] = `=D${r + 1}*E${r + 1}`            // Tax = Subtotal * Tax %
      s[r]![6] = `=D${r + 1}+F${r + 1}`            // Total = Subtotal + Tax
      s[r]![7] = `=IF(G${r + 1}>500,"REVIEW","OK")` // Status
    })
    // Totals row
    s[11]![0] = 'TOTALS'
    s[11]![3] = '=SUM(D2:D11)'
    s[11]![5] = '=SUM(F2:F11)'
    s[11]![6] = '=SUM(G2:G11)'
    s[11]![7] = `=COUNTIF(H2:H11,"REVIEW")&" flagged"`
    // Stats below
    s[13]![0] = 'AVG line'
    s[13]![6] = '=AVG(G2:G11)'
    s[14]![0] = 'MAX line'
    s[14]![6] = '=MAX(G2:G11)'
    s[15]![0] = 'Generated'
    s[15]![6] = '=TODAY()'
    return s
  }

  let raw = $state<Sheet>(makeSeed())
  const computed = $derived(computeSheet(raw))

  // Track which cell is selected so the formula bar can show its formula.
  let activeRow = $state<number | null>(null)
  let activeCol = $state<number | null>(null)
  const activeRawCell = $derived(
    activeRow != null && activeCol != null ? raw[activeRow]?.[activeCol] ?? '' : '',
  )
  const isFormula = $derived(activeRawCell.trim().startsWith('='))

  function setCellRaw(r: number, c: number, value: string) {
    const next = raw.map((row) => row.slice())
    next[r]![c] = value
    raw = next
  }

  function formatValue(v: CellVal): string {
    if (isError(v)) return v.error
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return '#NUM!'
      if (Number.isInteger(v)) return String(v)
      return v.toFixed(2)
    }
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
    return String(v)
  }

  // ---- SvGrid columns (one per spreadsheet column) ----------------------
  type SheetRow = { rowIndex: number; cells: CellVal[] }

  const gridRows = $derived<SheetRow[]>(
    computed.slice(1).map((cells, i) => ({ rowIndex: i + 1, cells })),
  )
  // Headers row separately (computed[0]).
  const headerCells = $derived(computed[0] ?? [])

  let api = $state<SvGridApi<typeof features, SheetRow> | null>(null)
  const features = tableFeatures({ rowSortingFeature })

  function cellEditor(c: number): ColumnDef<typeof features, SheetRow> {
    return {
      id: colToLetters(c),
      header: `${colToLetters(c)}  ·  ${formatValue(headerCells[c] ?? '')}`,
      width: c === 0 ? 170 : 110,
      editable: false,            // we drive edits via the formula bar
      cell: (ctx) => renderSnippet(SheetCell, { row: ctx.row.original, colIndex: c }),
    }
  }
  const columns = $derived<ColumnDef<typeof features, SheetRow>[]>(
    Array.from({ length: COL_COUNT }, (_, c) => cellEditor(c)),
  )

  // ---- Formula bar UX ---------------------------------------------------
  let formulaInput = $state('')
  $effect(() => { formulaInput = activeRawCell })  // sync when selection changes

  function commitFormulaBar() {
    if (activeRow == null || activeCol == null) return
    setCellRaw(activeRow, activeCol, formulaInput)
  }
  function selectCell(r: number, c: number) {
    activeRow = r
    activeCol = c
  }

  // ---- KPIs (read from the computed cells, of course) ------------------
  const total       = $derived(formatValue(computed[11]?.[6] ?? 0))
  const tax         = $derived(formatValue(computed[11]?.[5] ?? 0))
  const flagged     = $derived(formatValue(computed[11]?.[7] ?? ''))
  const generated   = $derived(formatValue(computed[15]?.[6] ?? ''))
</script>

{#snippet SheetCell(props: { row: SheetRow; colIndex: number })}
  {@const r = props.row.rowIndex}
  {@const c = props.colIndex}
  {@const v = props.row.cells[c] ?? ''}
  {@const isErr = isError(v)}
  <!-- The active-cell ring is drawn by the grid itself (.sv-grid-cell-active),
       so this span must NOT redraw one - doing so painted a second, inset
       rectangle inside the selected cell. -->
  <span
    class={`ss-cell ${isErr ? 'ss-cell-error' : ''}`}
    onclick={() => selectCell(r, c)}
    title={raw[r]?.[c] ?? ''}
  >{formatValue(v)}</span>
{/snippet}

<section class="ss-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip reads computed cells directly -->
  <div class="ss-kpi-strip shrink-0">
    <div class="ss-kpi"><div class="ss-kpi-label">Grand total (G12)</div><div class="ss-kpi-value">${total}</div></div>
    <div class="ss-kpi"><div class="ss-kpi-label">Total tax (F12)</div><div class="ss-kpi-value">${tax}</div></div>
    <div class="ss-kpi ss-kpi-warn"><div class="ss-kpi-label">Flagged lines</div><div class="ss-kpi-value">{flagged}</div></div>
    <div class="ss-kpi"><div class="ss-kpi-label">Sheet generated</div><div class="ss-kpi-value">{generated}</div></div>
  </div>

  <!-- Formula bar -->
  <div class="ss-formula-bar shrink-0">
    <span class="ss-cell-ref">
      {activeRow != null && activeCol != null ? `${colToLetters(activeCol)}${activeRow + 1}` : '-'}
    </span>
    <span class="ss-fx" class:ss-fx-on={isFormula}>ƒx</span>
    <input
      type="text"
      class="ss-formula-input"
      value={formulaInput}
      placeholder="Click a cell, then type a value or =SUM(D2:D11) here…"
      oninput={(e) => (formulaInput = (e.currentTarget as HTMLInputElement).value)}
      onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitFormulaBar() } }}
      onblur={commitFormulaBar}
    />
    <button type="button" class="ss-commit" onclick={commitFormulaBar} disabled={activeRow == null}>Apply</button>
  </div>

  <!-- Formula cheat-sheet -->
  <div class="ss-cheat shrink-0">
    <strong>Try it:</strong>
    <code>=SUM(D2:D11)</code>·
    <code>=AVG(G2:G11)</code>·
    <code>=IF(G2>500,"REVIEW","OK")</code>·
    <code>=COUNTIF(H2:H11,"REVIEW")</code>·
    <code>=B2*C2&" units"</code>·
    <code>=ROUND(G2/G$12*100,1)</code>·
    <code>=TODAY()</code>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={gridRows}
      columns={columns}
      features={features}
      filterMode="none"
      selectionMode="cell"
      showRowNumbers={true}
      enableInlineEditing={false}
      enableCellSelection={true}
      rowHeight={32}
      rowNumberWidth={48}
      containerHeight="100%"
      fitColumns={false}
      onApiReady={(next) => (api = next)}
      onActiveCellChange={(cell) => {
        // Map the grid's row/column ids back to the sheet's (row, col).
        // gridRows skips the header row, so gridRows[N] = sheet row N+1.
        // Column ids are A/B/C... letters - convert with our helper.
        const sheetRow = gridRows[cell.rowIndex]?.rowIndex
        const colIx = lettersToCol(cell.columnId)
        if (sheetRow != null && colIx >= 0) {
          activeRow = sheetRow
          activeCol = colIx
        }
      }}
    />
  </div>
</section>

<style>
  .ss-shell { height: 100%; }

  /* KPI strip */
  .ss-kpi-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  .ss-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .ss-kpi-warn { border-left: 3px solid #f59e0b; }
  .ss-kpi-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sg-muted, #64748b); }
  .ss-kpi-value { font-size: 20px; font-weight: 700; line-height: 1.1; color: var(--sg-fg, #0f172a); font-variant-numeric: tabular-nums; }

  /* Formula bar */
  .ss-formula-bar {
    display: flex; align-items: center; gap: 8px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    padding: 4px 6px 4px 0;
  }
  .ss-cell-ref {
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--sg-fg, #0f172a);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px; font-weight: 700;
    padding: 8px 12px;
    min-width: 64px;
    border-right: 1px solid var(--sg-border, #e2e8f0);
    text-align: center;
  }
  .ss-fx {
    font-style: italic;
    color: var(--sg-muted, #94a3b8);
    font-family: ui-serif, Georgia, serif;
    font-size: 14px;
    padding: 0 4px;
  }
  .ss-fx-on { color: var(--sg-accent, #2563eb); font-weight: 700; }
  .ss-formula-input {
    flex: 1;
    border: 0; background: transparent;
    color: var(--sg-fg, #0f172a);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    padding: 7px 8px;
    outline: none;
  }
  .ss-formula-input::placeholder { color: var(--sg-muted, #94a3b8); font-family: inherit; }
  .ss-commit {
    border: 0; background: var(--sg-accent, #2563eb); color: var(--sg-on-accent, #fff);
    border-radius: 6px; padding: 6px 14px;
    font-size: 12.5px; font-weight: 600;
    cursor: pointer;
  }
  .ss-commit:disabled { opacity: 0.5; cursor: default; }

  /* Cheat sheet */
  .ss-cheat {
    font-size: 12px;
    color: var(--sg-muted, #64748b);
    padding: 0 2px;
  }
  .ss-cheat code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 3px;
    padding: 1px 5px;
    margin: 0 4px;
    font-size: 11.5px;
    color: var(--sg-fg, #0f172a);
  }

  /* Sheet cells */
  :global(.ss-cell) {
    display: inline-block;
    width: 100%; height: 100%;
    line-height: 1.1;
    cursor: pointer;
    font-variant-numeric: tabular-nums;
  }
  :global(.ss-cell-error) {
    color: #dc2626;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11.5px;
    font-weight: 600;
  }
</style>
