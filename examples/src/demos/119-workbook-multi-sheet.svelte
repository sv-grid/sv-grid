<script lang="ts">
  /**
   * 119. Workbook - multiple sheets, cross-sheet formulas, export (Pro)
   * ------------------------------------------------------------------
   * A small spreadsheet *workbook* in the browser. Five tabs, a real
   * formula engine that resolves references ACROSS sheets, live recalc as
   * you type, cell formatting + conditional formatting, a calendar/
   * scheduler sheet, and one-click export of every sheet to a single
   * multi-tab .xlsx (or the active sheet to .csv). You can also open an
   * Excel/CSV file and load it into the active sheet.
   *
   *   Sheets
   *     Budget      - line items with =B*C subtotals, tax, totals, IF status
   *     Price list  - the lookup table VLOOKUP reads from
   *     Orders      - =VLOOKUP('Price list'!…) + nested IF tiers, cross-sheet
   *     Summary     - =SUM(Orders!…) / =SUM(Budget!…) / COUNTIF, over-budget IF
   *     Planner     - a month calendar (scheduler) backed by a data sheet
   *
   *   Formula engine
   *     refs A1 / $A$1, ranges A1:B9, whole columns A:C, cross-sheet
   *     'Sheet name'!A1, arithmetic, comparisons, & concat, and functions:
   *     SUM AVERAGE MIN MAX COUNT COUNTA COUNTIF IF AND OR NOT ROUND ABS
   *     LEN LEFT RIGHT UPPER LOWER CONCAT TODAY VLOOKUP - with #REF! /
   *     #CYCLE! / #DIV/0! / #VALUE! / #NAME? error codes.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import {
    installEnterprise,
    setLicenseKey,
    type EnterpriseGridApi,
  } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-DEMO')

  // ───────────────────────── Column address helpers ─────────────────────
  function colToLetters(n: number): string {
    let s = ''
    n += 1
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) }
    return s
  }
  function lettersToCol(s: string): number {
    let n = 0
    for (const ch of s.toUpperCase()) { if (ch < 'A' || ch > 'Z') return -1; n = n * 26 + (ch.charCodeAt(0) - 64) }
    return n - 1
  }

  // ───────────────────────── Formula engine (multi-sheet) ───────────────
  type CellVal = string | number | boolean | { error: string }
  function isError(v: CellVal): v is { error: string } {
    return typeof v === 'object' && v !== null && 'error' in v
  }

  type Ref = { sheet: string | null; row: number | null; col: number }
  type Node =
    | { k: 'num'; v: number } | { k: 'str'; v: string } | { k: 'bool'; v: boolean }
    | { k: 'ref'; sheet: string | null; row: number; col: number }
    | { k: 'range'; sheet: string | null; r1: number | null; c1: number; r2: number | null; c2: number }
    | { k: 'unary'; op: string; arg: Node }
    | { k: 'binary'; op: string; left: Node; right: Node }
    | { k: 'fn'; name: string; args: Node[] }

  type Token =
    | { t: 'num'; v: number } | { t: 'str'; v: string } | { t: 'bool'; v: boolean }
    | { t: 'ref'; sheet: string | null; row: number; col: number }
    | { t: 'range'; sheet: string | null; r1: number | null; c1: number; r2: number | null; c2: number }
    | { t: 'fn'; v: string } | { t: 'op'; v: string }
    | { t: 'lparen' } | { t: 'rparen' } | { t: 'comma' }

  /** Parse a bare A1 / A (whole-col) part. Returns col + row (null = whole col). */
  function parseRefPart(part: string): { col: number; row: number | null } | null {
    const m = part.replace(/\$/g, '').match(/^([A-Za-z]+)(\d+)?$/)
    if (!m) return null
    const col = lettersToCol(m[1]!)
    if (col < 0) return null
    return { col, row: m[2] ? parseInt(m[2], 10) - 1 : null }
  }

  function tokenize(src: string): Token[] {
    const out: Token[] = []
    let i = 0
    const readWord = () => { let j = i; while (j < src.length && /[A-Za-z0-9$.]/.test(src[j]!)) j++; const w = src.slice(i, j); i = j; return w }
    while (i < src.length) {
      const ch = src[i]!
      if (/\s/.test(ch)) { i++; continue }
      if (ch === '(') { out.push({ t: 'lparen' }); i++; continue }
      if (ch === ')') { out.push({ t: 'rparen' }); i++; continue }
      if (ch === ',') { out.push({ t: 'comma' }); i++; continue }
      if (ch === '"') { const end = src.indexOf('"', i + 1); if (end === -1) throw new Error('#PARSE!'); out.push({ t: 'str', v: src.slice(i + 1, end) }); i = end + 1; continue }
      // Quoted sheet name: 'Price list'!A1
      if (ch === "'") {
        const end = src.indexOf("'", i + 1); if (end === -1 || src[end + 1] !== '!') throw new Error('#PARSE!')
        const sheet = src.slice(i + 1, end); i = end + 2
        pushRefOrRange(out, sheet, readWord, () => src[i], () => i++, src)
        continue
      }
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
        let j = i; while (j < src.length && /[0-9.]/.test(src[j]!)) j++
        out.push({ t: 'num', v: Number(src.slice(i, j)) }); i = j; continue
      }
      if (/[A-Za-z$]/.test(ch)) {
        const word = readWord(); const upper = word.toUpperCase()
        // Unquoted sheet name: Orders!A1
        if (src[i] === '!') { i++; const sheet = word; pushRefOrRange(out, sheet, readWord, () => src[i], () => i++, src); continue }
        // Function call?
        let look = i; while (look < src.length && /\s/.test(src[look]!)) look++
        if (src[look] === '(') {
          if (upper === 'TRUE') { out.push({ t: 'bool', v: true }); continue }
          if (upper === 'FALSE') { out.push({ t: 'bool', v: false }); continue }
          out.push({ t: 'fn', v: upper }); continue
        }
        if (upper === 'TRUE') { out.push({ t: 'bool', v: true }); continue }
        if (upper === 'FALSE') { out.push({ t: 'bool', v: false }); continue }
        // Same-sheet ref / range
        pushRefFromWord(out, null, word, () => src[i], () => i++, readWord, src)
        continue
      }
      const two = src.slice(i, i + 2)
      if (two === '<=' || two === '>=' || two === '<>') { out.push({ t: 'op', v: two }); i += 2; continue }
      if ('+-*/^%&=<>'.includes(ch)) { out.push({ t: 'op', v: ch }); i++; continue }
      throw new Error('#PARSE!')
    }
    return out
  }

  function pushRefOrRange(out: Token[], sheet: string | null, readWord: () => string, peek: () => string | undefined, adv: () => void, _src: string) {
    const left = parseRefPart(readWord())
    if (!left) throw new Error('#PARSE!')
    if (peek() === ':') { adv(); const right = parseRefPart(readWord()); if (!right) throw new Error('#PARSE!'); out.push({ t: 'range', sheet, r1: left.row, c1: left.col, r2: right.row, c2: right.col }); return }
    if (left.row === null) { out.push({ t: 'range', sheet, r1: 0, c1: left.col, r2: null, c2: left.col }); return }
    out.push({ t: 'ref', sheet, row: left.row, col: left.col })
  }
  function pushRefFromWord(out: Token[], sheet: string | null, word: string, peek: () => string | undefined, adv: () => void, readWord: () => string, _src: string) {
    const left = parseRefPart(word)
    if (!left) throw new Error('#PARSE!')
    if (peek() === ':') { adv(); const right = parseRefPart(readWord()); if (!right) throw new Error('#PARSE!'); out.push({ t: 'range', sheet, r1: left.row, c1: left.col, r2: right.row, c2: right.col }); return }
    if (left.row === null) { out.push({ t: 'range', sheet, r1: 0, c1: left.col, r2: null, c2: left.col }); return }
    out.push({ t: 'ref', sheet, row: left.row, col: left.col })
  }

  const PREC: Record<string, number> = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5, '%': 5 }
  function parse(tokens: Token[]): Node {
    let pos = 0
    const peek = () => tokens[pos]; const next = () => tokens[pos++]
    function expr(minPrec: number): Node {
      let left = primary()
      while (true) { const t = peek(); if (!t || t.t !== 'op') break; const prec = PREC[t.v]; if (prec === undefined || prec < minPrec) break; next(); left = { k: 'binary', op: t.v, left, right: expr(prec + 1) } }
      return left
    }
    function primary(): Node {
      const t = next(); if (!t) throw new Error('#PARSE!')
      if (t.t === 'num') return { k: 'num', v: t.v }
      if (t.t === 'str') return { k: 'str', v: t.v }
      if (t.t === 'bool') return { k: 'bool', v: t.v }
      if (t.t === 'ref') return { k: 'ref', sheet: t.sheet, row: t.row, col: t.col }
      if (t.t === 'range') return { k: 'range', sheet: t.sheet, r1: t.r1, c1: t.c1, r2: t.r2, c2: t.c2 }
      if (t.t === 'op' && t.v === '-') return { k: 'unary', op: '-', arg: expr(6) }
      if (t.t === 'op' && t.v === '+') return expr(6)
      if (t.t === 'lparen') { const inner = expr(1); const close = next(); if (!close || close.t !== 'rparen') throw new Error('#PARSE!'); return inner }
      if (t.t === 'fn') {
        const open = next(); if (!open || open.t !== 'lparen') throw new Error('#PARSE!')
        const args: Node[] = []
        if (peek()?.t !== 'rparen') { args.push(expr(1)); while (peek()?.t === 'comma') { next(); args.push(expr(1)) } }
        const close = next(); if (!close || close.t !== 'rparen') throw new Error('#PARSE!')
        return { k: 'fn', name: t.v, args }
      }
      throw new Error('#PARSE!')
    }
    const r = expr(1); if (pos < tokens.length) throw new Error('#PARSE!'); return r
  }

  function toNumber(v: CellVal): number {
    if (typeof v === 'number') return v
    if (typeof v === 'boolean') return v ? 1 : 0
    if (typeof v === 'string') { if (v === '') return 0; const n = Number(v); if (Number.isFinite(n)) return n; throw new Error('#VALUE!') }
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
  function looseEquals(a: CellVal, b: CellVal): boolean {
    if (typeof a === 'number' && typeof b === 'number') return a === b
    if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase()
    if (typeof a === 'boolean' && typeof b === 'boolean') return a === b
    return toStr(a) === toStr(b)
  }
  function nums(vals: CellVal[]): number[] { return vals.filter((v) => v !== '' && !isError(v) && typeof v !== 'boolean').map((v) => toNumber(v)) }

  type Resolve = (sheet: string | null, r: number, c: number) => CellVal
  function rangeRows(sheet: string | null, n: { r1: number | null; c1: number; r2: number | null; c2: number }, resolve: Resolve, lastRowOf: (s: string | null) => number): CellVal[][] {
    const r1 = n.r1 ?? 0
    const r2 = n.r2 ?? lastRowOf(sheet)
    const out: CellVal[][] = []
    for (let r = r1; r <= r2; r++) { const row: CellVal[] = []; for (let c = n.c1; c <= n.c2; c++) row.push(resolve(sheet, r, c)); out.push(row) }
    return out
  }

  function evalNode(node: Node, resolve: Resolve, lastRowOf: (s: string | null) => number): CellVal {
    switch (node.k) {
      case 'num': return node.v
      case 'str': return node.v
      case 'bool': return node.v
      case 'ref': return resolve(node.sheet, node.row, node.col)
      case 'range': { const rows = rangeRows(node.sheet, node, resolve, lastRowOf); return rows[0]?.[0] ?? '' }
      case 'unary': { const v = evalNode(node.arg, resolve, lastRowOf); if (isError(v)) return v; return node.op === '-' ? -toNumber(v) : v }
      case 'binary': {
        const l = evalNode(node.left, resolve, lastRowOf); const r = evalNode(node.right, resolve, lastRowOf)
        if (isError(l)) return l; if (isError(r)) return r
        switch (node.op) {
          case '+': return toNumber(l) + toNumber(r)
          case '-': return toNumber(l) - toNumber(r)
          case '*': return toNumber(l) * toNumber(r)
          case '/': { const rv = toNumber(r); return rv === 0 ? { error: '#DIV/0!' } : toNumber(l) / rv }
          case '^': return Math.pow(toNumber(l), toNumber(r))
          case '%': return toNumber(l) % toNumber(r)
          case '&': return toStr(l) + toStr(r)
          case '=': return looseEquals(l, r)
          case '<>': return !looseEquals(l, r)
          case '<': return toNumber(l) < toNumber(r)
          case '>': return toNumber(l) > toNumber(r)
          case '<=': return toNumber(l) <= toNumber(r)
          case '>=': return toNumber(l) >= toNumber(r)
        }
        return { error: '#VALUE!' }
      }
      case 'fn': {
        // VLOOKUP keeps its range 2-D, so handle before flattening.
        if (node.name === 'VLOOKUP') {
          const lookup = evalNode(node.args[0]!, resolve, lastRowOf)
          if (isError(lookup)) return lookup
          const rngNode = node.args[1]
          if (!rngNode || rngNode.k !== 'range') return { error: '#REF!' }
          const colIx = Math.round(toNumber(evalNode(node.args[2]!, resolve, lastRowOf)))
          const grid = rangeRows(rngNode.sheet, rngNode, resolve, lastRowOf)
          for (const row of grid) {
            if (row[0] !== undefined && looseEquals(row[0], lookup)) {
              const cell = row[colIx - 1]
              return cell === undefined ? { error: '#REF!' } : cell
            }
          }
          return { error: '#N/A' }
        }
        const expanded: CellVal[][] = node.args.map((a) => a.k === 'range' ? rangeRows(a.sheet, a, resolve, lastRowOf).flat() : [evalNode(a, resolve, lastRowOf)])
        const flat = expanded.flat()
        for (const v of flat) if (isError(v)) return v
        switch (node.name) {
          case 'SUM': return nums(flat).reduce((a, b) => a + b, 0)
          case 'AVG': case 'AVERAGE': { const ns = nums(flat); return ns.length === 0 ? { error: '#DIV/0!' } : ns.reduce((a, b) => a + b, 0) / ns.length }
          case 'MIN': { const ns = nums(flat); return ns.length ? Math.min(...ns) : 0 }
          case 'MAX': { const ns = nums(flat); return ns.length ? Math.max(...ns) : 0 }
          case 'COUNT': return flat.filter((v) => typeof v === 'number').length
          case 'COUNTA': return flat.filter((v) => v !== '' && !isError(v)).length
          case 'COUNTIF': { const target = expanded[1]?.[0]; if (target === undefined) return 0; return (expanded[0] ?? []).filter((v) => looseEquals(v, target)).length }
          case 'IF': { const cond = expanded[0]?.[0] ?? false; return toBool(cond) ? (expanded[1]?.[0] ?? true) : (expanded[2]?.[0] ?? false) }
          case 'AND': return flat.every((v) => toBool(v))
          case 'OR': return flat.some((v) => toBool(v))
          case 'NOT': return !toBool(flat[0] ?? false)
          case 'ROUND': { const v = toNumber(flat[0] ?? 0); const d = Math.round(toNumber(flat[1] ?? 0)); const f = Math.pow(10, d); return Math.round(v * f) / f }
          case 'ABS': return Math.abs(toNumber(flat[0] ?? 0))
          case 'LEN': return toStr(flat[0] ?? '').length
          case 'LEFT': return toStr(flat[0] ?? '').slice(0, Math.max(0, Math.round(toNumber(flat[1] ?? 1))))
          case 'RIGHT': { const s = toStr(flat[0] ?? ''); const n = Math.max(0, Math.round(toNumber(flat[1] ?? 1))); return s.slice(Math.max(0, s.length - n)) }
          case 'UPPER': return toStr(flat[0] ?? '').toUpperCase()
          case 'LOWER': return toStr(flat[0] ?? '').toLowerCase()
          case 'CONCAT': return flat.map((v) => toStr(v)).join('')
          case 'TODAY': return new Date().toISOString().slice(0, 10)
        }
        return { error: '#NAME?' }
      }
    }
  }

  // ───────────────────────── Workbook model ─────────────────────────────
  type NumFmt = 'plain' | 'currency' | 'percent' | 'int' | 'date'
  type Fmt = { bold?: boolean; italic?: boolean; align?: 'left' | 'center' | 'right'; color?: string; bg?: string; num?: NumFmt }
  type Sheet = {
    name: string; cols: number; widths: number[]; raw: string[][]; fmt: (Fmt | undefined)[][]
    kind: 'grid' | 'calendar'
    /** Banner title rendered as a "merged" cell across the top of the sheet. */
    title?: string
    /** Data-validation dropdowns: column index → allowed values. */
    validation?: Record<number, ReadonlyArray<string>>
  }

  // Real-spreadsheet feel: pad every grid sheet out to a generous A..N x many
  // rows canvas so there's empty space to work in, like Excel.
  const GRID_MIN_COLS = 14
  const GRID_MIN_ROWS = 40
  const DEFAULT_COL_W = 92
  const SKU_LIST = ['SKU-100', 'SKU-110', 'SKU-120', 'SKU-130', 'SKU-140', 'SKU-150', 'SKU-160', 'SKU-170'] as const
  const REGION_LIST = ['NA', 'EMEA', 'APAC', 'LATAM'] as const
  const REGION_COLOR: Record<string, string> = { NA: '#3b82f6', EMEA: '#22c55e', APAC: '#f59e0b', LATAM: '#ec4899' }

  function emptyGrid(rows: number, cols: number): { raw: string[][]; fmt: (Fmt | undefined)[][] } {
    return {
      raw: Array.from({ length: rows }, () => new Array(cols).fill('')),
      fmt: Array.from({ length: rows }, () => new Array(cols).fill(undefined)),
    }
  }

  /** Grow a grid sheet to at least GRID_MIN_COLS x GRID_MIN_ROWS. */
  function padSheet(s: Sheet): Sheet {
    if (s.kind === 'calendar') return s
    const cols = Math.max(s.cols, GRID_MIN_COLS)
    const rowsN = Math.max(s.raw.length, GRID_MIN_ROWS)
    const raw = Array.from({ length: rowsN }, (_, r) => { const row = (s.raw[r] ?? []).slice(); while (row.length < cols) row.push(''); return row })
    const fmt = Array.from({ length: rowsN }, (_, r) => { const row = (s.fmt[r] ?? []).slice(); while (row.length < cols) row.push(undefined); return row })
    const widths = s.widths.slice(); while (widths.length < cols) widths.push(DEFAULT_COL_W)
    return { ...s, cols, raw, fmt, widths }
  }

  function makeWorkbook(): Sheet[] {
    // --- Budget -----------------------------------------------------------
    const bg = emptyGrid(15, 7)
    bg.raw[0] = ['Category', 'Units', 'Unit cost', 'Subtotal', 'Tax', 'Total', 'Status']
    const budget: [string, string, string][] = [
      ['Cloud hosting', '12', '49'], ['CDN bandwidth', '5000', '0.085'], ['SSL certificate', '1', '85'],
      ['Email service', '12', '20'], ['Analytics seats', '5', '79'], ['Design license', '3', '52'],
      ['Storage (TB)', '4', '23'], ['Monitoring agent', '24', '8'],
    ]
    budget.forEach((b, i) => {
      const r = i + 1
      bg.raw[r] = [b[0], b[1], b[2], `=B${r + 1}*C${r + 1}`, `=D${r + 1}*0.08`, `=D${r + 1}+E${r + 1}`, `=IF(F${r + 1}>400,"REVIEW","OK")`]
      bg.fmt[r]![2] = { num: 'currency' }; bg.fmt[r]![3] = { num: 'currency' }; bg.fmt[r]![4] = { num: 'currency' }; bg.fmt[r]![5] = { num: 'currency', bold: true }
    })
    bg.raw[10] = ['TOTAL', '', '', '=SUM(D2:D9)', '=SUM(E2:E9)', '=SUM(F2:F9)', '=COUNTIF(G2:G9,"REVIEW")&" flagged"']
    bg.fmt[0] = bg.raw[0]!.map(() => ({ bold: true, bg: '#1e293b', color: '#ffffff', align: 'center' as const }))
    bg.fmt[10] = [{ bold: true }, undefined, undefined, { num: 'currency', bold: true }, { num: 'currency', bold: true }, { num: 'currency', bold: true, bg: '#dbeafe' }, { bold: true }]

    // --- Price list -------------------------------------------------------
    const pl = emptyGrid(10, 4)
    pl.raw[0] = ['SKU', 'Product', 'Unit price', 'Category']
    const prices: [string, string, string, string][] = [
      ['SKU-100', 'Widget Pro', '129', 'Hardware'], ['SKU-110', 'Gadget Max', '249', 'Hardware'],
      ['SKU-120', 'Cable Kit', '19', 'Accessory'], ['SKU-130', 'Adapter X', '34', 'Accessory'],
      ['SKU-140', 'Support Plan', '499', 'Service'], ['SKU-150', 'Setup Fee', '150', 'Service'],
      ['SKU-160', 'Sensor Pack', '89', 'Hardware'], ['SKU-170', 'Carry Case', '45', 'Accessory'],
    ]
    prices.forEach((p, i) => { pl.raw[i + 1] = [...p]; pl.fmt[i + 1]![2] = { num: 'currency' } })
    pl.fmt[0] = pl.raw[0]!.map(() => ({ bold: true, bg: '#0f766e', color: '#ffffff', align: 'center' as const }))

    // --- Orders (cross-sheet VLOOKUP + nested IF) -------------------------
    const od = emptyGrid(12, 7)
    od.raw[0] = ['Order', 'SKU', 'Qty', 'Unit price', 'Line total', 'Tier', 'Region']
    const orders: [string, string, string, string][] = [
      ['ORD-001', 'SKU-110', '4', 'EMEA'], ['ORD-002', 'SKU-100', '9', 'NA'], ['ORD-003', 'SKU-140', '2', 'APAC'],
      ['ORD-004', 'SKU-120', '40', 'NA'], ['ORD-005', 'SKU-160', '12', 'EMEA'], ['ORD-006', 'SKU-130', '25', 'LATAM'],
      ['ORD-007', 'SKU-150', '3', 'NA'], ['ORD-008', 'SKU-170', '15', 'APAC'], ['ORD-009', 'SKU-110', '6', 'EMEA'],
    ]
    orders.forEach((o, i) => {
      const r = i + 1
      od.raw[r] = [o[0], o[1], o[2], `=VLOOKUP(B${r + 1},'Price list'!A2:C9,3)`, `=C${r + 1}*D${r + 1}`, `=IF(E${r + 1}>800,"A",IF(E${r + 1}>400,"B","C"))`, o[3]]
      od.fmt[r]![3] = { num: 'currency' }; od.fmt[r]![4] = { num: 'currency', bold: true }; od.fmt[r]![5] = { align: 'center' }
    })
    od.raw[10] = ['', '', '', 'TOTAL', '=SUM(E2:E10)', '', '']
    od.fmt[0] = od.raw[0]!.map(() => ({ bold: true, bg: '#5b21b6', color: '#ffffff', align: 'center' as const }))
    od.fmt[10] = [undefined, undefined, undefined, { bold: true, align: 'right' }, { num: 'currency', bold: true, bg: '#ede9fe' }, undefined, undefined]

    // --- Summary (cross-sheet aggregates) ---------------------------------
    const sm = emptyGrid(11, 2)
    sm.raw[0] = ['Metric', 'Value']
    const summary: [string, string][] = [
      ['Order revenue', "=SUM(Orders!E2:E10)"],
      ['Budget spend', "=SUM(Budget!F2:F9)"],
      ['Avg order value', "=ROUND(AVERAGE(Orders!E2:E10),2)"],
      ['Largest order', "=MAX(Orders!E2:E10)"],
      ['Tier-A orders', '=COUNTIF(Orders!F2:F10,"A")'],
      ['Flagged budget lines', '=COUNTIF(Budget!G2:G9,"REVIEW")'],
      ['Net (rev − spend)', '=B2-B3'],
      ['Health', '=IF(B2>B3,"Profitable","Underwater")'],
      ['Report date', '=TODAY()'],
    ]
    summary.forEach((s, i) => {
      const r = i + 1; sm.raw[r] = [s[0], s[1]]
      if (i < 4 || i === 6) sm.fmt[r]![1] = { num: 'currency', bold: true }
    })
    sm.fmt[0] = sm.raw[0]!.map(() => ({ bold: true, bg: '#b45309', color: '#ffffff', align: 'center' as const }))

    // --- Planner (calendar) backed by a data sheet ------------------------
    const cal = emptyGrid(EVENTS.length + 1, 5)
    cal.raw[0] = ['Date', 'Day', 'Time', 'Event', 'Owner']
    EVENTS.forEach((e, i) => { cal.raw[i + 1] = [e.date, weekday(e.date), e.time, e.title, e.owner] })
    cal.fmt[0] = cal.raw[0]!.map(() => ({ bold: true, bg: '#be185d', color: '#ffffff', align: 'center' as const }))

    const sheets: Sheet[] = [
      { name: 'Budget', cols: 7, widths: [150, 70, 90, 100, 90, 100, 110], ...bg, kind: 'grid', title: 'Q3 Operating Budget' },
      { name: 'Price list', cols: 4, widths: [100, 150, 100, 110], ...pl, kind: 'grid', title: 'Product Price List' },
      { name: 'Orders', cols: 7, widths: [100, 100, 60, 100, 110, 70, 90], ...od, kind: 'grid', title: 'Sales Orders', validation: { 1: SKU_LIST, 6: REGION_LIST } },
      { name: 'Summary', cols: 2, widths: [200, 160], ...sm, kind: 'grid', title: 'Workbook Summary' },
      { name: 'Planner', cols: 5, widths: [110, 90, 80, 220, 120], ...cal, kind: 'calendar', title: 'Team Planner' },
    ]
    return sheets.map(padSheet)
  }

  // Calendar source (also exported as the Planner sheet)
  type Evt = { date: string; time: string; title: string; owner: string; color: string }
  const EVENTS: Evt[] = [
    { date: '2026-06-02', time: '09:30', title: 'Sprint planning', owner: 'Ava', color: '#6366f1' },
    { date: '2026-06-04', time: '14:00', title: 'Vendor call - SKU-140', owner: 'Liam', color: '#0ea5e9' },
    { date: '2026-06-09', time: '11:00', title: 'Budget review', owner: 'Noah', color: '#f59e0b' },
    { date: '2026-06-11', time: '16:30', title: 'Design sync', owner: 'Emma', color: '#ec4899' },
    { date: '2026-06-15', time: '10:00', title: 'Board update', owner: 'Ava', color: '#22c55e' },
    { date: '2026-06-18', time: '13:00', title: 'Ship review', owner: 'Olivia', color: '#6366f1' },
    { date: '2026-06-23', time: '15:00', title: 'Q3 forecast', owner: 'Noah', color: '#f59e0b' },
    { date: '2026-06-25', time: '09:00', title: 'All-hands', owner: 'Liam', color: '#ef4444' },
    { date: '2026-06-30', time: '12:00', title: 'Month close', owner: 'Emma', color: '#0ea5e9' },
  ]
  function weekday(iso: string): string {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  }

  // ───────────────────────── Reactive state ─────────────────────────────
  let workbook = $state<Sheet[]>(makeWorkbook())
  let activeName = $state('Budget')
  const activeSheet = $derived(workbook.find((s) => s.name === activeName)!)

  /** Compute every sheet's values, resolving references across sheets with
   *  one shared cycle-detection visiting set. */
  const computedAll = $derived.by<Record<string, CellVal[][]>>(() => {
    const byName = new Map(workbook.map((s) => [s.name, s]))
    const memo = new Map<string, CellVal>()
    const visiting = new Set<string>()
    const lastRowOf = (sn: string | null): number => { const s = byName.get(sn ?? activeName); return s ? s.raw.length - 1 : 0 }
    const resolve: Resolve = (sn, r, c) => {
      const s = byName.get(sn ?? activeName)
      if (!s) return { error: '#REF!' }
      if (r < 0 || r >= s.raw.length || c < 0 || c >= s.cols) return { error: '#REF!' }
      const key = `${s.name}:${r}:${c}`
      if (memo.has(key)) return memo.get(key)!
      if (visiting.has(key)) return { error: '#CYCLE!' }
      visiting.add(key)
      const raw = (s.raw[r]?.[c] ?? '').trim()
      let value: CellVal
      if (raw === '') value = ''
      else if (raw.startsWith('=')) {
        try { value = evalNode(parse(tokenize(raw.slice(1))), resolve, lastRowOf) }
        catch (e) { const m = e instanceof Error ? e.message : '#ERR!'; value = { error: m.startsWith('#') ? m : '#PARSE!' } }
      } else { const n = Number(raw); value = raw !== '' && Number.isFinite(n) ? n : raw }
      visiting.delete(key); memo.set(key, value)
      return value
    }
    const out: Record<string, CellVal[][]> = {}
    for (const s of workbook) {
      const m: CellVal[][] = []
      for (let r = 0; r < s.raw.length; r++) { const row: CellVal[] = []; for (let c = 0; c < s.cols; c++) row.push(resolve(s.name, r, c)); m.push(row) }
      out[s.name] = m
    }
    return out
  })
  const computedActive = $derived(computedAll[activeName] ?? [])

  // Active cell (sheet coords) + formula bar
  let activeRow = $state<number>(1)
  let activeCol = $state<number>(0)
  let formulaInput = $state('')
  const activeRaw = $derived(activeSheet.raw[activeRow]?.[activeCol] ?? '')
  $effect(() => { formulaInput = activeRaw })
  const isFormula = $derived(formulaInput.trim().startsWith('='))

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let gridApi = $state<EnterpriseGridApi<typeof features, GridRow> | null>(null)

  // ── Cell writes ────────────────────────────────────────────────────────
  function setRaw(sheetName: string, r: number, c: number, value: string) {
    workbook = workbook.map((s) => {
      if (s.name !== sheetName) return s
      const raw = s.raw.map((row) => row.slice())
      while (raw.length <= r) raw.push(new Array(s.cols).fill(''))
      raw[r]![c] = value
      return { ...s, raw }
    })
  }
  function applyFmt(patch: Fmt) {
    const ranges = gridApi?.getSelected?.() ?? []
    const cells: Array<[number, number]> = []
    if (ranges.length) {
      // Grid row index == sheet row index (row 1 of the sheet is grid row 1).
      for (const [r1, c1, r2, c2] of ranges) for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) cells.push([r, c])
    } else cells.push([activeRow, activeCol])
    workbook = workbook.map((s) => {
      if (s.name !== activeName) return s
      const fmt = s.fmt.map((row) => row.slice())
      for (const [r, c] of cells) { while (fmt.length <= r) fmt.push(new Array(s.cols).fill(undefined)); fmt[r]![c] = { ...(fmt[r]![c] ?? {}), ...patch } }
      return { ...s, fmt }
    })
  }
  function toggle(key: 'bold' | 'italic') { const f = activeSheet.fmt[activeRow]?.[activeCol]; applyFmt({ [key]: !f?.[key] }) }

  // ── Display formatting ───────────────────────────────────────────────
  function formatValue(v: CellVal, f?: Fmt): string {
    if (isError(v)) return v.error
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return '#NUM!'
      switch (f?.num) {
        case 'currency': return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
        case 'percent': return (v * 100).toFixed(1) + '%'
        case 'int': return Math.round(v).toLocaleString('en-US')
        case 'date': return v.toString()
        default: return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { maximumFractionDigits: 2 })
      }
    }
    if (f?.num === 'date' && /^\d{4}-\d\d-\d\d/.test(v)) return new Date(v + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' })
    return v
  }
  /** Pick a readable text color (dark or light) for a solid fill via the WCAG
   *  relative-luminance formula. Keeps manual fills legible in BOTH themes -
   *  a light fill always gets dark text, a dark fill always gets light text -
   *  instead of inheriting the theme's foreground (which produced
   *  white-on-light fills in dark mode). */
  function readableOn(bg: string): string {
    const m = bg.replace('#', '')
    const hex = m.length === 3 ? m.split('').map((x) => x + x).join('') : m
    if (hex.length < 6) return '#0f172a'
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16)
    const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    return L > 0.55 ? '#0f172a' : '#ffffff'
  }
  function cellStyle(f?: Fmt): string {
    if (!f) return ''
    let s = ''
    if (f.bold) s += 'font-weight:700;'
    if (f.italic) s += 'font-style:italic;'
    if (f.align) s += `text-align:${f.align};justify-content:${f.align === 'right' ? 'flex-end' : f.align === 'center' ? 'center' : 'flex-start'};`
    if (f.bg) s += `background:${f.bg};`
    // Explicit color wins; otherwise derive a legible color from any fill so
    // light fills never end up with light (theme) text in dark mode.
    if (f.color) s += `color:${f.color};`
    else if (f.bg) s += `color:${readableOn(f.bg)};`
    return s
  }
  /** Conditional formatting per sheet (in addition to manual fmt). */
  function condStyle(sheet: string, r: number, c: number, v: CellVal): string {
    if (sheet === 'Budget' && c === 6 && v === 'REVIEW') return 'color:#b91c1c;font-weight:700;'
    if (sheet === 'Orders' && c === 5) { const t = String(v); if (t === 'A') return 'color:#15803d;font-weight:700;'; if (t === 'C') return 'color:#b45309;' }
    if ((sheet === 'Summary') && r === 8 && c === 1) return v === 'Profitable' ? 'color:#15803d;font-weight:700;' : 'color:#b91c1c;font-weight:700;'
    if (typeof v === 'number' && v < 0) return 'color:#dc2626;'
    return ''
  }

  // ── Grid wiring ──────────────────────────────────────────────────────
  type GridRow = { _r: number; [letter: string]: string | number }
  const gridRows = $derived.by<GridRow[]>(() => {
    const s = activeSheet
    if (s.kind === 'calendar') return []
    const out: GridRow[] = []
    // Include EVERY row (row 1 of the sheet IS grid row 1) - a real
    // spreadsheet, with the header text living in row 1 like Excel.
    for (let r = 0; r < s.raw.length; r++) {
      const obj: GridRow = { _r: r }
      for (let c = 0; c < s.cols; c++) obj[colToLetters(c)] = s.raw[r]?.[c] ?? ''
      out.push(obj)
    }
    return out
  })
  const columns = $derived.by<ColumnDef<typeof features, GridRow>[]>(() => {
    const s = activeSheet
    return Array.from({ length: s.cols }, (_, c) => {
      const allowed = s.validation?.[c]
      return {
        id: colToLetters(c),
        field: colToLetters(c),
        header: colToLetters(c),          // pure A / B / C column headers
        width: s.widths[c] ?? DEFAULT_COL_W,
        align: 'center' as const,
        editorType: (allowed ? 'list' : 'text') as 'list' | 'text',
        editorOptions: allowed
          ? allowed.map((v) => (REGION_COLOR[v] ? { value: v, color: REGION_COLOR[v] } : v))
          : undefined,
        cell: (ctx) => renderSnippet(Cell, { r: ctx.row.original._r, c }),
      }
    })
  })

  function onActive(cell: { rowIndex: number; columnId: string }) {
    const colIx = lettersToCol(cell.columnId)
    if (colIx >= 0) { activeRow = cell.rowIndex; activeCol = colIx }
  }
  function onCellEdit(e: { columnId: string; newValue: unknown; row: GridRow }) {
    const c = lettersToCol(e.columnId)
    if (c >= 0) setRaw(activeName, e.row._r, c, String(e.newValue ?? ''))
  }
  function commitFormula() { setRaw(activeName, activeRow, activeCol, formulaInput) }

  // ── Dynamic grow (add rows / columns) ────────────────────────────────
  function addRows(n = 1) {
    workbook = workbook.map((s) => {
      if (s.name !== activeName || s.kind === 'calendar') return s
      const raw = s.raw.map((r) => r.slice()); const fmt = s.fmt.map((r) => r.slice())
      for (let i = 0; i < n; i++) { raw.push(new Array(s.cols).fill('')); fmt.push(new Array(s.cols).fill(undefined)) }
      return { ...s, raw, fmt }
    })
    flash(`Added ${n} row${n > 1 ? 's' : ''}`)
  }
  function addColumn() {
    const newLetter = colToLetters(activeSheet.cols) // new column's letter (before growth)
    workbook = workbook.map((s) => {
      if (s.name !== activeName || s.kind === 'calendar') return s
      const cols = s.cols + 1
      const raw = s.raw.map((r) => { const x = r.slice(); x.push(''); return x })
      const fmt = s.fmt.map((r) => { const x = r.slice(); x.push(undefined); return x })
      const widths = s.widths.slice(); widths.push(DEFAULT_COL_W)
      return { ...s, cols, raw, fmt, widths }
    })
    flash(`Added column ${newLetter}`)
  }

  // ── Inline chart of the active column ────────────────────────────────
  let showChart = $state(false)
  const chartData = $derived.by<Array<{ label: string; value: number }>>(() => {
    const m = computedActive
    const pts: Array<{ label: string; value: number }> = []
    for (let r = 1; r < m.length; r++) {
      const v = m[r]?.[activeCol]
      if (typeof v === 'number' && Number.isFinite(v)) {
        const raw = m[r]?.[0]
        const lbl = (raw !== undefined && raw !== '' && !isError(raw)) ? String(raw) : `Row ${r + 1}`
        pts.push({ label: lbl.slice(0, 18), value: v })
      }
    }
    return pts.slice(0, 16)
  })
  const chartMax = $derived(Math.max(1, ...chartData.map((p) => Math.abs(p.value))))

  // ── Export / import (Pro) ─────────────────────────────────────────────
  let busy = $state(false)
  let toast = $state<string | null>(null)
  function flash(msg: string) { toast = msg; setTimeout(() => { if (toast === msg) toast = null }, 3500) }

  function sheetExport(s: Sheet) {
    const comp = computedAll[s.name] ?? []
    // Trim the padded empty canvas down to the actually-used range.
    const nonEmpty = (v: CellVal) => v !== '' && v !== undefined
    let lastCol = 0, lastRow = 0
    comp.forEach((row, r) => row.forEach((v, c) => { if (nonEmpty(v)) { if (c > lastCol) lastCol = c; if (r > lastRow) lastRow = r } }))
    const header = Array.from({ length: lastCol + 1 }, (_, c) => (s.raw[0]?.[c] || colToLetters(c)))
    // De-dupe header keys so two empty columns don't collide.
    const seen = new Set<string>()
    const keys = header.map((h) => { let k = h; let n = 2; while (seen.has(k)) k = `${h} (${n++})`; seen.add(k); return k })
    const rows = comp.slice(1, lastRow + 1).map((row) => {
      const o: Record<string, unknown> = {}
      for (let c = 0; c <= lastCol; c++) { const v = row[c] ?? ''; o[keys[c]!] = isError(v) ? v.error : v }
      return o
    })
    return {
      label: s.name,
      columns: keys.map((k) => ({ field: k, header: k })),
      rows,
      styles: { headerRow: { fontWeight: 'bold' as const, backgroundColor: '#1e293b', color: '#ffffff' }, rowAlternate: { backgroundColor: '#f3f4f6' } },
    }
  }
  async function exportXlsx() {
    if (!gridApi || busy) return
    busy = true; flash('Building workbook…')
    try { await gridApi.exportData({ format: 'xlsx', filename: 'workbook', sheets: workbook.map(sheetExport) as never }); flash(`Exported ${workbook.length} sheets to workbook.xlsx`) }
    catch (e) { flash('Export failed: ' + (e as Error).message) } finally { busy = false }
  }
  async function exportCsv() {
    if (!gridApi || busy) return
    busy = true
    try { const s = sheetExport(activeSheet); await gridApi.exportData({ format: 'csv', filename: activeName.replace(/\s+/g, '-').toLowerCase(), columns: s.columns, rows: s.rows as never }); flash(`Exported "${activeName}" to .csv`) }
    catch (e) { flash('Export failed: ' + (e as Error).message) } finally { busy = false }
  }
  async function importFile(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement
    const file = input.files?.[0]; if (!file || !gridApi) return
    busy = true; flash('Reading file…')
    try {
      const res = await gridApi.importData({ file, format: 'auto' })
      // Load the parsed rows into the active sheet: header row + data, mapped
      // to columns A.., then pad back out to a full spreadsheet canvas.
      const headers = res.headers
      const cols = headers.length
      const raw: string[][] = [headers.slice()]
      for (const row of res.rows as Array<Record<string, unknown>>) raw.push(headers.map((h) => String(row[h] ?? '')))
      const headerFmt: (Fmt | undefined)[] = headers.map(() => ({ bold: true, bg: '#1e293b', color: '#ffffff', align: 'center' as const }))
      const loaded: Sheet = { name: activeName, title: activeSheet.title, cols, widths: headers.map(() => 130), raw, fmt: [headerFmt, ...raw.slice(1).map(() => new Array(cols).fill(undefined))], kind: 'grid' }
      const padded = padSheet(loaded)
      workbook = workbook.map((s) => s.name === activeName ? padded : s)
      flash(`Loaded ${res.rows.length} rows from ${file.name} into "${activeName}"`)
    } catch (e) { flash('Import failed: ' + (e as Error).message) } finally { busy = false; input.value = '' }
  }

  // ── Calendar helpers ─────────────────────────────────────────────────
  const CAL_YEAR = 2026, CAL_MONTH = 5 // June 2026 (0-based)
  const calWeeks = $derived.by(() => {
    const first = new Date(Date.UTC(CAL_YEAR, CAL_MONTH, 1))
    const startDow = first.getUTCDay() // 0 Sun
    const daysInMonth = new Date(Date.UTC(CAL_YEAR, CAL_MONTH + 1, 0)).getUTCDate()
    const cells: Array<{ day: number | null; iso: string; events: Evt[] }> = []
    for (let i = 0; i < startDow; i++) cells.push({ day: null, iso: '', events: [] })
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${CAL_YEAR}-${String(CAL_MONTH + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({ day: d, iso, events: EVENTS.filter((e) => e.date === iso) })
    }
    while (cells.length % 7 !== 0) cells.push({ day: null, iso: '', events: [] })
    const weeks: typeof cells[] = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
    return weeks
  })

  const NUM_FORMATS: Array<{ id: NumFmt; label: string }> = [
    { id: 'plain', label: '123' }, { id: 'currency', label: '$' }, { id: 'percent', label: '%' }, { id: 'int', label: '1,000' }, { id: 'date', label: 'Date' },
  ]
  const SWATCHES = ['#ef4444', '#f59e0b', '#22c55e', '#0ea5e9', '#6366f1', '#ec4899', '#0f172a', '#ffffff']
</script>

{#snippet Cell(props: { r: number; c: number })}
  {@const v = computedActive[props.r]?.[props.c] ?? ''}
  {@const f = activeSheet.fmt[props.r]?.[props.c]}
  {@const active = activeRow === props.r && activeCol === props.c}
  <span
    class="wb-cell"
    class:wb-active={active}
    class:wb-err={isError(v)}
    style={cellStyle(f) + condStyle(activeName, props.r, props.c, v)}
  >{formatValue(v, f)}</span>
{/snippet}

<section class="wb flex flex-col flex-1 min-h-0 gap-2">
  <!-- Toolbar -->
  <div class="wb-toolbar">
    <div class="wb-group">
      <button class="wb-btn" title="Bold" class:on={activeSheet.fmt[activeRow]?.[activeCol]?.bold} onclick={() => toggle('bold')}><b>B</b></button>
      <button class="wb-btn" title="Italic" class:on={activeSheet.fmt[activeRow]?.[activeCol]?.italic} onclick={() => toggle('italic')}><i>I</i></button>
    </div>
    <div class="wb-group">
      <button class="wb-btn" title="Align left" onclick={() => applyFmt({ align: 'left' })}>⯇</button>
      <button class="wb-btn" title="Align center" onclick={() => applyFmt({ align: 'center' })}>≡</button>
      <button class="wb-btn" title="Align right" onclick={() => applyFmt({ align: 'right' })}>⯈</button>
    </div>
    <div class="wb-group">
      <span class="wb-mini">Text</span>
      {#each SWATCHES as sw (sw)}<button class="wb-sw" style={`background:${sw}`} title={`Text ${sw}`} onclick={() => applyFmt({ color: sw })} aria-label={`Text ${sw}`}></button>{/each}
    </div>
    <div class="wb-group">
      <span class="wb-mini">Fill</span>
      {#each SWATCHES as sw (sw)}<button class="wb-sw" style={`background:${sw}`} title={`Fill ${sw}`} onclick={() => applyFmt({ bg: sw })} aria-label={`Fill ${sw}`}></button>{/each}
      <button class="wb-btn wb-btn-sm" title="Clear fill" onclick={() => applyFmt({ bg: undefined })}>⌫</button>
    </div>
    <div class="wb-group">
      <span class="wb-mini">Number</span>
      {#each NUM_FORMATS as nf (nf.id)}<button class="wb-btn wb-btn-sm" title={nf.id} onclick={() => applyFmt({ num: nf.id })}>{nf.label}</button>{/each}
    </div>
    <div class="wb-group">
      <span class="wb-mini">Insert</span>
      <button class="wb-btn wb-btn-sm" title="Add a row" disabled={activeSheet.kind === 'calendar'} onclick={() => addRows(1)}>+ Row</button>
      <button class="wb-btn wb-btn-sm" title="Add 10 rows" disabled={activeSheet.kind === 'calendar'} onclick={() => addRows(10)}>+10</button>
      <button class="wb-btn wb-btn-sm" title="Add a column" disabled={activeSheet.kind === 'calendar'} onclick={addColumn}>+ Col</button>
      <button class="wb-btn wb-btn-sm" class:on={showChart} title="Toggle chart" disabled={activeSheet.kind === 'calendar'} onclick={() => (showChart = !showChart)}>📊 Chart</button>
    </div>
    <div class="wb-spacer"></div>
    <div class="wb-group">
      <label class="wb-btn wb-import" title="Open an Excel / CSV file">
        Open…<input type="file" accept=".xlsx,.csv,.tsv,.json" onchange={importFile} hidden />
      </label>
      <button class="wb-btn" disabled={busy} onclick={exportCsv}>Export .csv</button>
      <button class="wb-btn wb-primary" disabled={busy} onclick={exportXlsx}>Export .xlsx ({workbook.length} sheets)</button>
    </div>
  </div>

  <!-- Formula bar -->
  <div class="wb-formula">
    <span class="wb-ref">{colToLetters(activeCol)}{activeRow + 1}</span>
    <span class="wb-fx" class:on={isFormula}>ƒx</span>
    <input
      class="wb-input"
      value={formulaInput}
      placeholder="Type a value or a formula:  =VLOOKUP(B2,'Price list'!A2:C9,3)   ·   =SUM(Orders!E2:E10)"
      oninput={(e) => { formulaInput = (e.currentTarget as HTMLInputElement).value; commitFormula() }}
      onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitFormula() } }}
    />
  </div>

  <!-- Merged title row: one banner spanning the whole sheet (a "merged cell"). -->
  {#if activeSheet.title}
    <div class="wb-title">
      <span class="wb-title-text">{activeSheet.title}</span>
      <span class="wb-title-meta">
        {#if activeSheet.kind === 'calendar'}{EVENTS.length} events{:else}{activeSheet.raw.length} rows × {colToLetters(activeSheet.cols - 1)} cols{/if}
      </span>
    </div>
  {/if}

  <!-- Sheet content -->
  <div class="flex-1 min-h-0 wb-stage">
    {#if activeSheet.kind === 'calendar'}
      <!-- Scheduler / calendar view (its data lives in the Planner sheet too). -->
      <div class="cal">
        <div class="cal-head">
          <span class="cal-title">June 2026</span>
          <span class="cal-sub">{EVENTS.length} scheduled events · this view is the “Planner” sheet, and exports as a tab</span>
        </div>
        <div class="cal-grid cal-dow">
          {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as d (d)}<div class="cal-dow-cell">{d}</div>{/each}
        </div>
        {#each calWeeks as week, wi (wi)}
          <div class="cal-grid">
            {#each week as cell, ci (ci)}
              <div class="cal-cell" class:cal-empty={cell.day === null}>
                {#if cell.day !== null}
                  <div class="cal-day">{cell.day}</div>
                  {#each cell.events as e (e.title)}
                    <div class="cal-evt" style={`background:color-mix(in srgb, ${e.color} 16%, transparent); border-left:3px solid ${e.color};`}>
                      <span class="cal-evt-time">{e.time}</span>
                      <span class="cal-evt-title">{e.title}</span>
                      <span class="cal-evt-owner">{e.owner}</span>
                    </div>
                  {/each}
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {:else}
      <div class="wb-grid-row">
        <div class="wb-grid-host">
          <SvGrid responsive={true}
            data={gridRows}
            columns={columns}
            features={features}
            filterMode="menu"
            selectionMode="cell"
            showPagination={false}
            showRowNumbers={true}
            enableInlineEditing={true}
            enableCellSelection={true}
            enableRowSummaries={false}
            rowHeight={30}
            rowNumberWidth={44}
            containerHeight="100%"
            fitColumns={false}
            getRowId={(r) => String(r._r)}
            onApiReady={(next) => (gridApi = installEnterprise(next))}
            onActiveCellChange={onActive}
            onCellValueChange={onCellEdit}
          />
        </div>

        {#if showChart}
          <!-- Live chart of the active column, sitting right next to its data. -->
          <aside class="wb-chart">
            <div class="wb-chart-head">
              <span class="wb-chart-title">Column {colToLetters(activeCol)}</span>
              <button class="wb-chart-x" title="Hide chart" onclick={() => (showChart = false)}>×</button>
            </div>
            {#if chartData.length === 0}
              <div class="wb-chart-empty">Select a numeric column to chart it.</div>
            {:else}
              <div class="wb-chart-bars">
                {#each chartData as p (p.label)}
                  <div class="wb-bar-row">
                    <span class="wb-bar-label" title={p.label}>{p.label}</span>
                    <span class="wb-bar-track">
                      <span class="wb-bar-fill" style={`width:${Math.max(2, (Math.abs(p.value) / chartMax) * 100)}%; background:${p.value < 0 ? '#ef4444' : 'linear-gradient(90deg,#6366f1,#8b5cf6)'};`}></span>
                    </span>
                    <span class="wb-bar-val tabular-nums">{formatValue(p.value, activeSheet.fmt[1]?.[activeCol])}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </aside>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Sheet tabs -->
  <div class="wb-tabs">
    {#each workbook as s (s.name)}
      <button class="wb-tab" class:on={s.name === activeName} onclick={() => { activeName = s.name; activeRow = 1; activeCol = 0 }}>
        {#if s.kind === 'calendar'}<span class="wb-tab-ico">📅</span>{/if}{s.name}
      </button>
    {/each}
  </div>

  {#if toast}<div class="wb-toast">{toast}</div>{/if}
</section>

<style>
  .wb { position: relative; }

  /* Toolbar */
  .wb-toolbar {
    display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px;
    border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-header-bg, #f1f5f9);
    border-radius: 10px; padding: 7px 10px; flex-shrink: 0;
  }
  .wb-group { display: inline-flex; align-items: center; gap: 4px; padding-right: 10px; border-right: 1px solid var(--sg-border, #e2e8f0); }
  .wb-group:last-child, .wb-spacer + .wb-group { border-right: 0; }
  .wb-spacer { flex: 1 1 auto; }
  .wb-mini { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--sg-muted, #64748b); margin-right: 2px; }
  .wb-btn {
    border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border-radius: 6px; min-width: 28px; height: 28px; padding: 0 8px; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .wb-btn-sm { font-size: 11px; padding: 0 6px; min-width: 24px; }
  .wb-btn:hover:not(:disabled) { background: var(--sg-row-hover-bg, #eef2ff); }
  .wb-btn:disabled { opacity: 0.5; cursor: default; }
  .wb-btn.on { background: var(--sg-accent, #2563eb); color: var(--sg-on-accent, #fff); border-color: transparent; }
  .wb-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; border: 0; font-weight: 600; padding: 0 12px; }
  .wb-import { cursor: pointer; }
  .wb-sw { width: 16px; height: 16px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.18); cursor: pointer; padding: 0; }

  /* Formula bar */
  .wb-formula {
    display: flex; align-items: center; gap: 8px; flex-shrink: 0;
    border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-bg, #fff); border-radius: 8px; padding-right: 8px;
  }
  .wb-ref {
    background: var(--sg-header-bg, #f1f5f9); color: var(--sg-fg, #0f172a);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; font-weight: 700;
    padding: 8px 12px; min-width: 56px; text-align: center; border-right: 1px solid var(--sg-border, #e2e8f0); border-radius: 8px 0 0 8px;
  }
  .wb-fx { font-style: italic; font-family: ui-serif, Georgia, serif; color: var(--sg-muted, #94a3b8); font-size: 14px; }
  .wb-fx.on { color: var(--sg-accent, #2563eb); font-weight: 700; }
  .wb-input { flex: 1; border: 0; background: transparent; color: var(--sg-fg, #0f172a); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; padding: 8px 4px; outline: none; }
  .wb-input::placeholder { color: var(--sg-muted, #94a3b8); }

  /* Merged title banner */
  .wb-title {
    display: flex; align-items: baseline; gap: 10px; flex-shrink: 0;
    background: linear-gradient(90deg, color-mix(in srgb, #6366f1 12%, var(--sg-bg, #fff)), var(--sg-bg, #fff));
    border: 1px solid var(--sg-border, #e2e8f0); border-bottom: 0;
    border-radius: 10px 10px 0 0; padding: 8px 14px;
  }
  .wb-title-text { font-size: 14px; font-weight: 800; letter-spacing: -0.01em; color: var(--sg-fg, #0f172a); }
  .wb-title-meta { font-size: 11px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .wb-title + .wb-stage { border-radius: 0 0 10px 10px; }

  .wb-stage { border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; overflow: hidden; }

  /* Grid + chart row */
  .wb-grid-row { display: flex; height: 100%; min-height: 0; }
  .wb-grid-host { flex: 1 1 auto; min-width: 0; height: 100%; }
  .wb-chart {
    flex: 0 0 300px; width: 300px; height: 100%; display: flex; flex-direction: column;
    border-left: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-bg, #fff);
  }
  .wb-chart-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .wb-chart-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--sg-muted, #64748b); }
  .wb-chart-x { border: 0; background: transparent; color: var(--sg-muted, #64748b); font-size: 18px; line-height: 1; cursor: pointer; padding: 0 4px; }
  .wb-chart-x:hover { color: var(--sg-fg, #0f172a); }
  .wb-chart-empty { padding: 16px; font-size: 12px; color: var(--sg-muted, #94a3b8); font-style: italic; }
  .wb-chart-bars { flex: 1 1 auto; overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 7px; }
  .wb-bar-row { display: grid; grid-template-columns: 84px 1fr auto; align-items: center; gap: 8px; }
  .wb-bar-label { font-size: 11px; color: var(--sg-fg, #334155); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wb-bar-track { height: 14px; border-radius: 999px; background: var(--sg-header-bg, #f1f5f9); overflow: hidden; }
  .wb-bar-fill { display: block; height: 100%; border-radius: 999px; transition: width 0.35s ease; }
  .wb-bar-val { font-size: 11px; font-weight: 600; color: var(--sg-fg, #0f172a); text-align: right; }

  /* Sheet tabs */
  .wb-tabs { display: flex; gap: 4px; flex-shrink: 0; flex-wrap: wrap; }
  .wb-tab {
    border: 1px solid var(--sg-border, #cbd5e1); border-bottom: 0; background: var(--sg-header-bg, #f1f5f9); color: var(--sg-muted, #64748b);
    border-radius: 8px 8px 0 0; padding: 6px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer;
  }
  .wb-tab:hover { color: var(--sg-fg, #0f172a); }
  .wb-tab.on { background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); box-shadow: inset 0 2px 0 var(--sg-accent, #2563eb); }
  .wb-tab-ico { margin-right: 4px; }

  /* Spreadsheet cells */
  :global(.wb-cell) {
    display: flex; align-items: center; width: 100%; height: 100%; line-height: 1.1;
    cursor: cell; font-variant-numeric: tabular-nums; padding: 0 2px; box-sizing: border-box;
  }
  :global(.wb-active) { box-shadow: inset 0 0 0 2px var(--sg-accent, #2563eb); }
  :global(.wb-err) { color: #dc2626; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; font-weight: 600; }

  /* Calendar */
  .cal { height: 100%; display: flex; flex-direction: column; background: var(--sg-bg, #fff); padding: 12px; overflow: auto; }
  .cal-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 10px; }
  .cal-title { font-size: 18px; font-weight: 800; letter-spacing: -0.01em; color: var(--sg-fg, #0f172a); }
  .cal-sub { font-size: 12px; color: var(--sg-muted, #64748b); }
  .cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
  .cal-dow { margin-bottom: 6px; }
  .cal-dow-cell { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--sg-muted, #64748b); padding: 2px 6px; }
  .cal-grid + .cal-grid { margin-top: 6px; }
  .cal-cell { min-height: 84px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 8px; padding: 5px 6px; background: var(--sg-bg, #fff); display: flex; flex-direction: column; gap: 4px; }
  .cal-empty { background: var(--sg-header-bg, #f8fafc); border-style: dashed; opacity: 0.6; }
  .cal-day { font-size: 12px; font-weight: 700; color: var(--sg-fg, #334155); }
  .cal-evt { display: flex; flex-direction: column; padding: 3px 6px; border-radius: 5px; font-size: 11px; line-height: 1.25; }
  .cal-evt-time { font-weight: 700; color: var(--sg-fg, #0f172a); font-variant-numeric: tabular-nums; }
  .cal-evt-title { color: var(--sg-fg, #334155); }
  .cal-evt-owner { font-size: 10px; color: var(--sg-muted, #64748b); }

  /* Toast */
  .wb-toast {
    position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
    background: #0f172a; color: #fff; font-size: 12.5px; font-weight: 500;
    padding: 8px 16px; border-radius: 999px; box-shadow: 0 8px 24px rgba(0,0,0,0.25); z-index: 40;
  }
</style>
