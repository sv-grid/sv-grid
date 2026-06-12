<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 27. Spreadsheet - Excel-style ribbon bar + formulas
   * ---------------------------------------------------
   * The grid driven by a custom UI shell: a four-tab ribbon, an Excel-
   * style right-click context menu, a clipboard buffer (cut/copy/paste),
   * and an embedded formula engine. Cells can hold either a literal
   * value OR a formula starting with `=`. The engine recomputes on every
   * change and surfaces error codes (`#REF!`, `#CYCLE!`, `#DIV/0!`,
   * `#VALUE!`, `#NAME?`, `#PARSE!`).
   *
   * Ribbon
   *   Clipboard tab: cut / copy / paste / clear-contents
   *   Home tab:      bold, italic, strike, font family, font size, alignment
   *                  (L / C / R), text + fill colours, number format,
   *                  clear formatting
   *   Insert tab:    insert row above/below, delete row
   *   Data tab:      sort asc / desc, clear sort, clear all filters
   *
   * Cell address space  (Excel-style A1)
   *   A   = Category
   *   B-M = Jan ... Dec
   *   Row 1 = first data row.   So `=SUM(B2:B5)` sums Jan values for
   *   the rows that are second through fifth in the underlying array.
   *
   * Formula-on-edit
   *   Switch to a month cell, press F2 / Enter / start typing. If your
   *   text starts with `=`, it lands in the formula map and the cell
   *   displays the computed result. Otherwise it commits as a literal
   *   number. The formula bar above the grid lets you inspect or edit
   *   the active cell's formula at any time.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-community'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Row = {
    id: string
    category: string
    jan: number; feb: number; mar: number; apr: number
    may: number; jun: number; jul: number; aug: number
    sep: number; oct: number; nov: number; dec: number
  }

  const MONTHS = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  ] as const
  type MonthField = typeof MONTHS[number]

  // A1-style column address mapping. Category is A; Jan-Dec are B-M.
  const COL_IDS = ['category', ...MONTHS] as const
  type ColId = typeof COL_IDS[number]
  function colIdToIndex(colId: string): number {
    return COL_IDS.indexOf(colId as ColId)
  }
  function indexToColLetter(c: number): string {
    return c >= 0 && c < COL_IDS.length ? String.fromCharCode(65 + c) : ''
  }
  function colLetterToIndex(letter: string): number {
    return letter.length === 1 ? letter.toUpperCase().charCodeAt(0) - 65 : -1
  }
  function cellAddress(rowIndex: number, colId: string): string {
    return `${indexToColLetter(colIdToIndex(colId))}${rowIndex + 1}`
  }

  // ---- Per-cell formatting type (used by the seed builder below) --------
  type Align = 'left' | 'center' | 'right'
  type CellFmt = {
    bold?: boolean
    italic?: boolean
    strike?: boolean
    textColor?: string
    cellColor?: string
    align?: Align
    fontFamily?: string
    fontSize?: number
    numberFormat?: 'currency' | 'percent' | 'number'
    /** Section-header style: theme-aware indigo tint + bold weight. Set
     *  via the seed builder instead of explicit cell/text colors so dark
     *  mode and light mode read the same way. */
    section?: boolean
    /** Sub-section style: subtle tint without the bolder weight, used
     *  for KPI rows and the like. */
    subSection?: boolean
  }

  // ---- Seeding ------------------------------------------------------------
  // A realistic Series-B SaaS company's monthly P&L: revenue grows steadily,
  // COGS scales with traffic, opex outpaces revenue early in the year, and
  // operating income crosses into the black around Q3. Every roll-up row
  // (totals, margins, EBIT) is a formula so the engine demos itself on load.
  type SeedRow = {
    category: string
    /** 12 monthly values for literal rows. */
    literal?: number[]
    /** Per-column formula template - `{C}` is replaced with the column letter. */
    formulaPattern?: string
    /** Visual format for the formula cells. */
    formulaFormat?: 'currency' | 'percent' | 'number'
    /** Render this row as a section header (bold + tint). */
    section?: boolean
    /** Render this row as a sub-section header (subtle tint, normal weight). */
    subSection?: boolean
  }

  // Layout below mirrors a real Series-B SaaS finance pack:
  //   REVENUE      - bookings detail + recognized revenue
  //   COGS         - 4-line breakdown
  //   GROSS PROFIT
  //   S&M / R&D / G&A  - each with line-item detail and its own subtotal
  //   OPERATING INCOME, EBITDA, margins, status
  //   KPIs         - headcount, customers, ARPU, revenue/FTE, burn multiple
  // Every total / subtotal / margin is a formula so the engine
  // continuously demos itself.
  const SEED: SeedRow[] = [
    // ─── REVENUE ─────────────────────────────────────────────────── rows 1-8
    /*  1 */ { category: 'REVENUE', section: true },
    /*  2 */ { category: '  New ARR bookings',     literal: [216000, 192000, 264000, 228000, 288000, 300000, 324000, 288000, 360000, 396000, 384000, 456000] },
    /*  3 */ { category: '  Expansion ARR',        literal: [48000, 60000, 72000, 84000, 96000, 108000, 120000, 132000, 144000, 156000, 168000, 180000] },
    /*  4 */ { category: '  Churn ARR',            literal: [-36000, -42000, -48000, -48000, -54000, -60000, -60000, -66000, -72000, -72000, -78000, -84000] },
    /*  5 */ { category: '  Net New ARR',          formulaPattern: '={C}2+{C}3+{C}4', formulaFormat: 'currency', subSection: true },
    /*  6 */ { category: 'Product subscriptions',  literal: [180000, 192000, 205000, 218000, 235000, 248000, 262000, 278000, 295000, 314000, 332000, 358000] },
    /*  7 */ { category: 'Professional services',  literal: [22000, 18000, 25000, 30000, 28000, 26000, 35000, 31000, 29000, 38000, 42000, 45000] },
    /*  8 */ { category: 'TOTAL REVENUE',          formulaPattern: '={C}6+{C}7', formulaFormat: 'currency', section: true },

    // ─── COGS ─────────────────────────────────────────────────────── rows 9-14
    /*  9 */ { category: 'COST OF REVENUE', section: true },
    /* 10 */ { category: '  Cloud infrastructure (AWS)',  literal: [42000, 45000, 48000, 51000, 55000, 58000, 61000, 65000, 69000, 73000, 77000, 83000] },
    /* 11 */ { category: '  Third-party APIs / data',     literal: [12000, 12500, 13000, 13500, 14200, 14800, 15300, 15900, 16500, 17200, 17900, 18800] },
    /* 12 */ { category: '  Customer support payroll',    literal: [18000, 19500, 21000, 22500, 24000, 25500, 27000, 28500, 30000, 31500, 33000, 35000] },
    /* 13 */ { category: '  Implementation team payroll', literal: [8000, 8500, 9000, 10000, 11000, 11500, 12000, 12500, 13000, 14000, 14500, 15000] },
    /* 14 */ { category: 'TOTAL COGS', formulaPattern: '={C}10+{C}11+{C}12+{C}13', formulaFormat: 'currency', section: true },

    // ─── GROSS PROFIT ─────────────────────────────────────────────── rows 15-16
    /* 15 */ { category: 'GROSS PROFIT',   formulaPattern: '={C}8-{C}14',         formulaFormat: 'currency', section: true },
    /* 16 */ { category: 'Gross margin %', formulaPattern: '=({C}15/{C}8)*100',   formulaFormat: 'percent',  subSection: true },

    // ─── SALES & MARKETING ────────────────────────────────────────── rows 17-22
    /* 17 */ { category: 'SALES & MARKETING', section: true },
    /* 18 */ { category: '  S&M payroll',         literal: [45000, 46500, 48000, 50000, 52000, 54000, 56000, 58500, 61000, 63500, 66000, 70000] },
    /* 19 */ { category: '  Sales commissions',   literal: [16000, 14500, 18000, 17500, 21000, 22500, 23000, 22000, 25500, 27500, 27000, 30000] },
    /* 20 */ { category: '  Marketing programs',  literal: [15000, 17000, 16500, 18000, 18500, 19500, 20000, 21500, 22000, 23000, 24000, 25000] },
    /* 21 */ { category: '  Tools & licenses',    literal: [6500, 6500, 6800, 7000, 7200, 7500, 7800, 8000, 8200, 8500, 8700, 9000] },
    /* 22 */ { category: 'TOTAL S&M', formulaPattern: '={C}18+{C}19+{C}20+{C}21', formulaFormat: 'currency', section: true },

    // ─── R&D ──────────────────────────────────────────────────────── rows 23-27
    /* 23 */ { category: 'RESEARCH & DEVELOPMENT', section: true },
    /* 24 */ { category: '  Engineering payroll', literal: [38000, 39000, 40500, 42000, 43500, 45000, 46500, 48000, 49500, 51000, 52500, 55000] },
    /* 25 */ { category: '  Product payroll',     literal: [16000, 16500, 17000, 17500, 18000, 18500, 19000, 19500, 20000, 20500, 21000, 22000] },
    /* 26 */ { category: '  Dev infrastructure',  literal: [8000, 8000, 8000, 8500, 8500, 8500, 8500, 8500, 8500, 8500, 8500, 8000] },
    /* 27 */ { category: 'TOTAL R&D', formulaPattern: '={C}24+{C}25+{C}26', formulaFormat: 'currency', section: true },

    // ─── G&A ──────────────────────────────────────────────────────── rows 28-32
    /* 28 */ { category: 'GENERAL & ADMINISTRATIVE', section: true },
    /* 29 */ { category: '  Executive & legal', literal: [12000, 12500, 12800, 13000, 13500, 14000, 14500, 14800, 15000, 15500, 15800, 16000] },
    /* 30 */ { category: '  Finance & HR',      literal: [10000, 10500, 11000, 11500, 12000, 12500, 13000, 13200, 13500, 13800, 14000, 14000] },
    /* 31 */ { category: '  Office & IT',       literal: [10000, 10000, 10200, 10500, 10500, 10500, 10500, 11000, 11500, 11700, 12200, 13000] },
    /* 32 */ { category: 'TOTAL G&A', formulaPattern: '={C}29+{C}30+{C}31', formulaFormat: 'currency', section: true },

    // ─── BOTTOM LINE ──────────────────────────────────────────────── rows 33-37
    /* 33 */ { category: 'TOTAL OPEX',         formulaPattern: '={C}22+{C}27+{C}32',           formulaFormat: 'currency', section: true },
    /* 34 */ { category: 'OPERATING INCOME',   formulaPattern: '={C}15-{C}33',                 formulaFormat: 'currency', section: true },
    /* 35 */ { category: 'Operating margin %', formulaPattern: '=({C}34/{C}8)*100',            formulaFormat: 'percent',  subSection: true },
    /* 36 */ { category: 'EBITDA proxy',       formulaPattern: '={C}34+{C}26',                 formulaFormat: 'currency' },
    /* 37 */ { category: 'Status',             formulaPattern: '=IF({C}34>0,"PROFITABLE","INVESTING")' },

    // ─── KEY METRICS ──────────────────────────────────────────────── rows 38-43
    /* 38 */ { category: 'KEY METRICS', section: true },
    /* 39 */ { category: '  Headcount (FTE)',    literal: [32, 33, 34, 35, 37, 39, 41, 43, 45, 47, 49, 52], formulaFormat: 'number' },
    /* 40 */ { category: '  Customers',          literal: [145, 152, 160, 168, 176, 185, 195, 205, 215, 225, 235, 248], formulaFormat: 'number' },
    /* 41 */ { category: '  ARPU (subs / cust)', formulaPattern: '={C}6/{C}40',           formulaFormat: 'currency' },
    /* 42 */ { category: '  Revenue / FTE',      formulaPattern: '={C}8/{C}39',           formulaFormat: 'currency' },
    /* 43 */ { category: '  Burn multiple',      formulaPattern: '=ROUND(-{C}34/{C}5,2)', formulaFormat: 'number' },
  ]

  function buildSheet(): { rows: Row[]; cellRaw: Record<string, string>; cellFormats: Record<string, CellFmt> } {
    const COL_LETTERS = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']
    const rows: Row[] = []
    const cellRaw: Record<string, string> = {}
    const cellFormats: Record<string, CellFmt> = {}
    SEED.forEach((s, i) => {
      const r: Row = {
        id: 'r_' + i.toString(36),
        category: s.category,
        jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
        jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
      }
      // Apply the row's "kind" styling to every cell (including category).
      // The actual painting happens via the section/subSection flags in
      // CellFmt + theme-aware CSS, so dark mode and light mode both look
      // tasteful with no hardcoded hex colors.
      const kindFmt: CellFmt = s.section
        ? { bold: true, section: true }
        : s.subSection
          ? { subSection: true }
          : {}
      const baseFormat = s.formulaFormat ?? (s.literal ? 'currency' : undefined)
      MONTHS.forEach((m, ci) => {
        const k = `${i}:${m}`
        if (s.literal) (r as unknown as Record<string, number>)[m] = s.literal[ci] ?? 0
        if (s.formulaPattern) cellRaw[k] = s.formulaPattern.replace(/\{C\}/g, COL_LETTERS[ci]!)
        const fmt: CellFmt = { ...kindFmt }
        if (baseFormat === 'currency' || baseFormat === 'percent' || baseFormat === 'number') {
          fmt.numberFormat = baseFormat
        }
        if (Object.keys(fmt).length > 0) cellFormats[k] = fmt
      })
      // Tint the Category cell so the section header row reads end-to-end.
      if (s.section || s.subSection) {
        cellFormats[`${i}:category`] = { ...kindFmt }
      }
      rows.push(r)
    })
    return { rows, cellRaw, cellFormats }
  }

  const seeded = buildSheet()
  let rows = $state<Row[]>(seeded.rows)
  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let activeCell = $state<{ rowIndex: number; columnId: string } | null>({ rowIndex: 0, columnId: 'jan' })
  let selectedCells = $state<Array<{ rowIndex: number; columnId: string }>>([])
  let gridShellEl: HTMLDivElement | null = $state(null)

  function readSelectedCellsFromDom(): Array<{ rowIndex: number; columnId: string }> {
    if (!gridShellEl) return []
    const tds = gridShellEl.querySelectorAll<HTMLElement>(
      'td[data-selected-range="true"], td.sv-grid-cell-active',
    )
    const seen = new Set<string>()
    const out: Array<{ rowIndex: number; columnId: string }> = []
    for (const td of tds) {
      const rowIndex = Number(td.dataset.svgridRow)
      const columnId = td.dataset.colId ?? ''
      if (!Number.isFinite(rowIndex) || !columnId) continue
      const key = `${rowIndex}:${columnId}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ rowIndex, columnId })
    }
    return out
  }
  $effect(() => {
    if (!gridShellEl) return
    const refresh = () => requestAnimationFrame(() => (selectedCells = readSelectedCellsFromDom()))
    gridShellEl.addEventListener('click', refresh)
    gridShellEl.addEventListener('pointerup', refresh)
    gridShellEl.addEventListener('keydown', refresh)
    return () => {
      gridShellEl?.removeEventListener('click', refresh)
      gridShellEl?.removeEventListener('pointerup', refresh)
      gridShellEl?.removeEventListener('keydown', refresh)
    }
  })

  // ---- Per-cell formatting & formula state --------------------------------
  let cellFormats = $state<Record<string, CellFmt>>(seeded.cellFormats)
  /** Formula strings keyed by `${rowIndex}:${columnId}`. Present only when
   *  the cell holds a formula (`=...`). Other cells fall through to the
   *  literal value stored on the row. */
  let cellRaw = $state<Record<string, string>>(seeded.cellRaw)

  function fmtKey(rowIndex: number, columnId: string) {
    return `${rowIndex}:${columnId}`
  }
  function getSelectedCells(): Array<{ rowIndex: number; columnId: string }> {
    if (selectedCells.length > 0) return selectedCells
    return activeCell ? [activeCell] : []
  }
  function pickContrastText(bgHex: string): string {
    const hex = bgHex.replace('#', '')
    let r = 0, g = 0, b = 0
    if (hex.length === 3) {
      r = parseInt(hex[0]! + hex[0]!, 16); g = parseInt(hex[1]! + hex[1]!, 16); b = parseInt(hex[2]! + hex[2]!, 16)
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16)
    }
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#0f172a' : '#ffffff'
  }
  function toggleFormat(field: 'bold' | 'italic' | 'strike') {
    const cells = getSelectedCells(); if (cells.length === 0) return
    const firstKey = fmtKey(cells[0]!.rowIndex, cells[0]!.columnId)
    const isOn = !!cellFormats[firstKey]?.[field]
    applyToSelection({ [field]: !isOn } as CellFmt)
  }
  function applyToSelection(patch: CellFmt) {
    const cells = getSelectedCells(); if (cells.length === 0) return
    const next = { ...cellFormats }
    for (const c of cells) {
      const k = fmtKey(c.rowIndex, c.columnId)
      next[k] = { ...next[k], ...patch }
    }
    cellFormats = next
  }
  function clearFormatting() {
    const cells = getSelectedCells()
    if (cells.length === 0) { cellFormats = {}; return }
    const next = { ...cellFormats }
    for (const c of cells) delete next[fmtKey(c.rowIndex, c.columnId)]
    cellFormats = next
  }
  function clearContents() {
    const cells = getSelectedCells()
    if (cells.length === 0 || !api) return
    // Route through the API so the grid's internal data updates and our
    // `onCellValueChange` handler keeps `rows` + `cellRaw` in sync.
    for (const c of cells) {
      api.setCellValue(c.rowIndex, c.columnId, c.columnId === 'category' ? '' : 0)
    }
  }

  // =================================================================
  // FORMULA ENGINE (subset of Excel)
  // =================================================================
  type CellVal = string | number | boolean | { error: string }
  function isError(v: CellVal): v is { error: string } {
    return typeof v === 'object' && v !== null && 'error' in v
  }
  type Token =
    | { t: 'num'; v: number }
    | { t: 'str'; v: string }
    | { t: 'bool'; v: boolean }
    | { t: 'ref'; row: number; col: number }
    | { t: 'range'; r1: number; c1: number; r2: number; c2: number }
    | { t: 'fn'; v: string }
    | { t: 'op'; v: string }
    | { t: 'lparen' } | { t: 'rparen' } | { t: 'comma' }

  function parseRefStr(ref: string): { row: number; col: number } | null {
    const m = ref.replace(/\$/g, '').match(/^([A-Z])(\d+)$/i)
    if (!m) return null
    const col = colLetterToIndex(m[1]!)
    if (col < 0) return null
    return { row: parseInt(m[2]!, 10) - 1, col }
  }
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
        const end = src.indexOf('"', i + 1); if (end === -1) throw new Error('Unterminated string')
        out.push({ t: 'str', v: src.slice(i + 1, end) }); i = end + 1; continue
      }
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
        let j = i; while (j < src.length && /[0-9.]/.test(src[j]!)) j++
        out.push({ t: 'num', v: Number(src.slice(i, j)) }); i = j; continue
      }
      if (/[A-Za-z$]/.test(ch)) {
        let j = i; while (j < src.length && /[A-Za-z0-9$]/.test(src[j]!)) j++
        const word = src.slice(i, j); const upper = word.toUpperCase(); i = j
        const refLeft = parseRefStr(word)
        if (refLeft && src[i] === ':') {
          let k = i + 1; while (k < src.length && /[A-Za-z0-9$]/.test(src[k]!)) k++
          const right = src.slice(i + 1, k); const refRight = parseRefStr(right)
          if (refRight) {
            out.push({
              t: 'range',
              r1: Math.min(refLeft.row, refRight.row), c1: Math.min(refLeft.col, refRight.col),
              r2: Math.max(refLeft.row, refRight.row), c2: Math.max(refLeft.col, refRight.col),
            }); i = k; continue
          }
        }
        if (refLeft) { out.push({ t: 'ref', ...refLeft }); continue }
        if (upper === 'TRUE')  { out.push({ t: 'bool', v: true });  continue }
        if (upper === 'FALSE') { out.push({ t: 'bool', v: false }); continue }
        let look = i; while (look < src.length && /\s/.test(src[look]!)) look++
        if (src[look] === '(') { out.push({ t: 'fn', v: upper }); continue }
        throw new Error(`Unexpected token: ${word}`)
      }
      const two = src.slice(i, i + 2)
      if (two === '<=' || two === '>=' || two === '<>') { out.push({ t: 'op', v: two }); i += 2; continue }
      if ('+-*/^%&=<>'.includes(ch)) { out.push({ t: 'op', v: ch }); i++; continue }
      throw new Error(`Unexpected character: ${ch}`)
    }
    return out
  }
  type Node =
    | { k: 'num'; v: number } | { k: 'str'; v: string } | { k: 'bool'; v: boolean }
    | { k: 'ref'; row: number; col: number }
    | { k: 'range'; r1: number; c1: number; r2: number; c2: number }
    | { k: 'unary'; op: string; arg: Node }
    | { k: 'binary'; op: string; left: Node; right: Node }
    | { k: 'fn'; name: string; args: Node[] }
  const PREC: Record<string, number> = {
    '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1,
    '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5, '%': 5,
  }
  function parseTokens(tokens: Token[]): Node {
    let pos = 0
    const peek = () => tokens[pos]; const next = () => tokens[pos++]
    function parseExpr(minPrec: number): Node {
      let left = parsePrimary()
      while (true) {
        const t = peek(); if (!t || t.t !== 'op') break
        const prec = PREC[t.v]; if (prec === undefined || prec < minPrec) break
        next(); const right = parseExpr(prec + 1)
        left = { k: 'binary', op: t.v, left, right }
      }
      return left
    }
    function parsePrimary(): Node {
      const t = next(); if (!t) throw new Error('Unexpected end of formula')
      if (t.t === 'num')   return { k: 'num', v: t.v }
      if (t.t === 'str')   return { k: 'str', v: t.v }
      if (t.t === 'bool')  return { k: 'bool', v: t.v }
      if (t.t === 'ref')   return { k: 'ref', row: t.row, col: t.col }
      if (t.t === 'range') return { k: 'range', r1: t.r1, c1: t.c1, r2: t.r2, c2: t.c2 }
      if (t.t === 'op' && t.v === '-') return { k: 'unary', op: '-', arg: parseExpr(6) }
      if (t.t === 'op' && t.v === '+') return parseExpr(6)
      if (t.t === 'lparen') {
        const inner = parseExpr(1); const close = next()
        if (!close || close.t !== 'rparen') throw new Error('Missing )')
        return inner
      }
      if (t.t === 'fn') {
        const open = next(); if (!open || open.t !== 'lparen') throw new Error(`Expected ( after ${t.v}`)
        const args: Node[] = []
        if (peek()?.t !== 'rparen') {
          args.push(parseExpr(1))
          while (peek()?.t === 'comma') { next(); args.push(parseExpr(1)) }
        }
        const close = next(); if (!close || close.t !== 'rparen') throw new Error('Missing )')
        return { k: 'fn', name: t.v, args }
      }
      throw new Error(`Unexpected token`)
    }
    const result = parseExpr(1)
    if (pos < tokens.length) throw new Error('Unexpected trailing tokens')
    return result
  }
  function toNumber(v: CellVal): number {
    if (typeof v === 'number') return v
    if (typeof v === 'boolean') return v ? 1 : 0
    if (typeof v === 'string') {
      if (v === '') return 0
      const n = Number(v); if (Number.isFinite(n)) return n
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
  function looseEquals(a: CellVal, b: CellVal): boolean {
    if (typeof a === 'number' && typeof b === 'number') return a === b
    if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase()
    if (typeof a === 'boolean' && typeof b === 'boolean') return a === b
    return toStr(a) === toStr(b)
  }
  function nums(vals: CellVal[]): number[] {
    return vals.filter((v) => v !== '' && !isError(v)).map((v) => toNumber(v))
  }
  function evalNode(node: Node, resolve: (r: number, c: number) => CellVal): CellVal {
    if (node.k === 'num') return node.v
    if (node.k === 'str') return node.v
    if (node.k === 'bool') return node.v
    if (node.k === 'ref') return resolve(node.row, node.col)
    if (node.k === 'range') return resolve(node.r1, node.c1)
    if (node.k === 'unary') {
      const v = evalNode(node.arg, resolve); if (isError(v)) return v
      if (node.op === '-') return -toNumber(v)
      return v
    }
    if (node.k === 'binary') {
      const l = evalNode(node.left, resolve); const r = evalNode(node.right, resolve)
      if (isError(l)) return l; if (isError(r)) return r
      switch (node.op) {
        case '+': return toNumber(l) + toNumber(r)
        case '-': return toNumber(l) - toNumber(r)
        case '*': return toNumber(l) * toNumber(r)
        case '/': { const rv = toNumber(r); return rv === 0 ? { error: '#DIV/0!' } : toNumber(l) / rv }
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
      const expanded: CellVal[][] = node.args.map((a) => {
        if (a.k === 'range') {
          const out: CellVal[] = []
          for (let r = a.r1; r <= a.r2; r++) for (let c = a.c1; c <= a.c2; c++) out.push(resolve(r, c))
          return out
        }
        return [evalNode(a, resolve)]
      })
      const flat = expanded.flat()
      for (const v of flat) if (isError(v)) return v
      switch (node.name) {
        case 'SUM':     return nums(flat).reduce((a, b) => a + b, 0)
        case 'AVG': case 'AVERAGE': {
          const ns = nums(flat)
          return ns.length === 0 ? { error: '#DIV/0!' } : ns.reduce((a, b) => a + b, 0) / ns.length
        }
        case 'MIN': { const ns = nums(flat); return ns.length ? Math.min(...ns) : 0 }
        case 'MAX': { const ns = nums(flat); return ns.length ? Math.max(...ns) : 0 }
        case 'COUNT':  return flat.filter((v) => typeof v === 'number').length
        case 'COUNTA': return flat.filter((v) => v !== '' && !isError(v)).length
        case 'COUNTIF': {
          const target = expanded[1]?.[0]; if (target === undefined) return 0
          return (expanded[0] ?? []).filter((v) => looseEquals(v, target)).length
        }
        case 'IF': {
          const cond = expanded[0]?.[0] ?? false
          return toBool(cond as CellVal) ? (expanded[1]?.[0] ?? true) : (expanded[2]?.[0] ?? false)
        }
        case 'AND': return flat.every((v) => toBool(v))
        case 'OR':  return flat.some((v) => toBool(v))
        case 'NOT': return !toBool(flat[0] ?? false)
        case 'ROUND': {
          const v = toNumber(flat[0] ?? 0); const d = Math.round(toNumber(flat[1] ?? 0))
          const f = Math.pow(10, d); return Math.round(v * f) / f
        }
        case 'ABS': return Math.abs(toNumber(flat[0] ?? 0))
        case 'LEN': return toStr(flat[0] ?? '').length
        case 'UPPER': return toStr(flat[0] ?? '').toUpperCase()
        case 'LOWER': return toStr(flat[0] ?? '').toLowerCase()
      }
      return { error: '#NAME?' }
    }
    return { error: '#VALUE!' }
  }

  // Build a memoized resolver. The cell value comes from cellRaw[k] if a
  // formula or literal text was entered there; otherwise it falls back to
  // the row's typed field value.
  function buildResolver() {
    const cache = new Map<string, CellVal>()
    const visiting = new Set<string>()
    function resolve(r: number, c: number): CellVal {
      const colId = COL_IDS[c]
      if (!colId || r < 0 || r >= rows.length) return { error: '#REF!' }
      const key = `${r}:${colId}`
      if (cache.has(key)) return cache.get(key)!
      if (visiting.has(key)) return { error: '#CYCLE!' }
      visiting.add(key)
      const raw = cellRaw[key]
      let value: CellVal
      if (raw && raw.startsWith('=')) {
        try { value = evalNode(parseTokens(tokenize(raw.slice(1))), resolve) }
        catch (e) {
          const msg = e instanceof Error ? e.message : '#ERR!'
          value = { error: msg.startsWith('#') ? msg : '#PARSE!' }
        }
      } else if (raw !== undefined && raw !== '') {
        const n = Number(raw); value = Number.isFinite(n) ? n : raw
      } else {
        const v = (rows[r] as unknown as Record<string, unknown>)[colId]
        value = (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') ? v : ''
      }
      visiting.delete(key)
      cache.set(key, value)
      return value
    }
    return resolve
  }
  const resolver = $derived(() => {
    // Re-create the resolver whenever either rows or cellRaw changes so
    // the memoization cache stays fresh per render pass.
    void rows; void cellRaw
    return buildResolver()
  })

  function getComputedValue(rowIndex: number, columnId: string): CellVal {
    return resolver()(rowIndex, colIdToIndex(columnId))
  }

  // ---- Number formatters --------------------------------------------------
  const currencyFmt   = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const integerFmt    = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
  const decimalFmt    = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
  const percentFmt    = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 })
  function formatValue(value: number, format: CellFmt['numberFormat']) {
    if (format === 'currency') return currencyFmt.format(value)
    if (format === 'percent')  return percentFmt.format(value / 100)
    // 'number' or unset: integers stay clean ("52"), fractional values
    // keep up to 2 decimals so ratios like 0.24 (burn multiple) and
    // computed averages render correctly instead of rounding to 0.
    return Number.isInteger(value) ? integerFmt.format(value) : decimalFmt.format(value)
  }
  function displayCellValue(rowIndex: number, columnId: string): string {
    const v = getComputedValue(rowIndex, columnId)
    if (isError(v)) return v.error
    const fmt = cellFormats[fmtKey(rowIndex, columnId)] ?? {}
    if (typeof v === 'number') return formatValue(v, fmt.numberFormat)
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
    return String(v ?? '')
  }

  // ---- Editor commit: detect `=` and store as formula --------------------
  // The grid's `setCellValue` mutates an internal copy of the data, NOT the
  // source `rows` array. Since this demo's cell snippet reads cell values
  // through the resolver (which walks `rows`), we mirror every commit back
  // into `rows` so the snippet and the engine stay in sync.
  function onCellValueChange(payload: {
    rowIndex: number; columnId: string; oldValue: unknown; newValue: unknown; row: Row
  }) {
    const { rowIndex, columnId, newValue } = payload
    const k = fmtKey(rowIndex, columnId)
    const text = String(newValue ?? '')
    const isFormula = text.startsWith('=')

    // Formula → store in cellRaw. Literal → drop any prior formula.
    if (isFormula) {
      cellRaw = { ...cellRaw, [k]: text }
    } else if (cellRaw[k] !== undefined) {
      const next = { ...cellRaw }; delete next[k]; cellRaw = next
    }

    // Always sync the source row so the resolver picks up the new value.
    const updated = rows.slice()
    const row = updated[rowIndex] as unknown as Record<string, unknown> | undefined
    if (!row) return
    if (columnId === 'category') {
      row.category = text
    } else if (!isFormula) {
      const n = Number(text)
      row[columnId] = Number.isFinite(n) ? n : 0
    }
    // If it IS a formula, leave the underlying numeric field alone - the
    // resolver gives cellRaw precedence over it.
    rows = updated
  }

  // ---- Ribbon actions ------------------------------------------------------
  let activeTab = $state<'home' | 'insert' | 'data' | 'clipboard'>('home')
  function insertRowAbove() { if (!api || !activeCell) return; api.addRow(blankRow(), activeCell.rowIndex) }
  function insertRowBelow() { if (!api || !activeCell) return; api.addRow(blankRow(), activeCell.rowIndex + 1) }
  function deleteCurrentRow() { if (!api || !activeCell) return; api.removeRow(activeCell.rowIndex) }
  function blankRow(): Row {
    return {
      id: 'r_' + Math.random().toString(36).slice(2, 7),
      category: 'New row',
      jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
      jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
    }
  }
  function sortAscending()  { if (activeCell) api?.setSort(activeCell.columnId, 'asc') }
  function sortDescending() { if (activeCell) api?.setSort(activeCell.columnId, 'desc') }

  // ---- Clipboard ---------------------------------------------------------
  type ClipEntry = { rowIndex: number; columnId: string; raw: string }
  let clipboard = $state<{ kind: 'cut' | 'copy'; cells: ClipEntry[] } | null>(null)

  function cellRawValue(rowIndex: number, columnId: string): string {
    const k = fmtKey(rowIndex, columnId)
    if (cellRaw[k] !== undefined) return cellRaw[k]!
    const v = (rows[rowIndex] as unknown as Record<string, unknown> | undefined)?.[columnId]
    return v === undefined || v === null ? '' : String(v)
  }

  async function copySelection(kind: 'cut' | 'copy') {
    const cells = getSelectedCells(); if (cells.length === 0) return
    const entries: ClipEntry[] = cells.map((c) => ({
      rowIndex: c.rowIndex, columnId: c.columnId, raw: cellRawValue(c.rowIndex, c.columnId),
    }))
    clipboard = { kind, cells: entries }
    // Best-effort write to the OS clipboard so the user can paste into
    // Excel / Notes too. Cell rows are tab-separated; rows separated by \n.
    try {
      const grouped = new Map<number, ClipEntry[]>()
      for (const e of entries) {
        const list = grouped.get(e.rowIndex) ?? []
        list.push(e); grouped.set(e.rowIndex, list)
      }
      const text = [...grouped.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, list]) => list
          .sort((a, b) => colIdToIndex(a.columnId) - colIdToIndex(b.columnId))
          .map((e) => e.raw).join('\t'))
        .join('\n')
      await navigator.clipboard?.writeText(text)
    } catch { /* clipboard API blocked - in-app paste still works */ }
    if (kind === 'cut') {
      // Visually fade the cut cells until they're pasted somewhere.
      // The actual blank-out happens on paste (Excel behavior).
    }
  }

  /** Coerce a raw clipboard string back to the value type the column expects. */
  function coerceCellValue(raw: string, colId: string): unknown {
    if (raw.startsWith('=')) return raw            // formula passes through
    if (colId === 'category') return raw           // text column
    return Number(raw) || 0                        // month columns
  }

  function pasteAtActive() {
    if (!clipboard || !api) return
    const selection = getSelectedCells()
    if (selection.length === 0) return

    // ---- Selection bounding rect ---------------------------------------
    let selMinR = Infinity, selMaxR = -Infinity
    let selMinC = Infinity, selMaxC = -Infinity
    for (const c of selection) {
      if (c.rowIndex < selMinR) selMinR = c.rowIndex
      if (c.rowIndex > selMaxR) selMaxR = c.rowIndex
      const ci = colIdToIndex(c.columnId)
      if (ci < selMinC) selMinC = ci
      if (ci > selMaxC) selMaxC = ci
    }
    const selRows = selMaxR - selMinR + 1
    const selCols = selMaxC - selMinC + 1

    // ---- Clipboard bounding rect + map ---------------------------------
    let clipMinR = Infinity, clipMaxR = -Infinity
    let clipMinC = Infinity, clipMaxC = -Infinity
    for (const e of clipboard.cells) {
      if (e.rowIndex < clipMinR) clipMinR = e.rowIndex
      if (e.rowIndex > clipMaxR) clipMaxR = e.rowIndex
      const ci = colIdToIndex(e.columnId)
      if (ci < clipMinC) clipMinC = ci
      if (ci > clipMaxC) clipMaxC = ci
    }
    const clipRows = clipMaxR - clipMinR + 1
    const clipCols = clipMaxC - clipMinC + 1
    const clipMap = new Map<string, ClipEntry>()
    for (const e of clipboard.cells) {
      const rOff = e.rowIndex - clipMinR
      const cOff = colIdToIndex(e.columnId) - clipMinC
      clipMap.set(`${rOff}:${cOff}`, e)
    }

    // ---- Decide paste mode ---------------------------------------------
    // 1. Single source cell + multi-cell selection  → fill every selected cell
    // 2. Multi-cell source, selection is 1 cell     → anchor at active cell
    //    (top-left of clipboard lands on active cell)
    // 3. Multi-cell source, selection is multi-cell → tile pattern across the
    //    selection's bounding rect (wraps with modulo so a 2x3 source fills
    //    a 4x6 selection as 2x2 tiles)
    const isSingleSource = clipboard.cells.length === 1
    const fillMode      = isSingleSource && selection.length > 1
    const anchorMode    = !fillMode && selection.length === 1
    // Build a quick lookup of which cells the user actually selected, so
    // a non-rectangular selection doesn't paint cells outside it.
    const selectedSet = new Set(selection.map((c) => `${c.rowIndex}:${c.columnId}`))

    if (fillMode) {
      const only = clipboard.cells[0]!
      for (const c of selection) {
        api.setCellValue(c.rowIndex, c.columnId, coerceCellValue(only.raw, c.columnId))
      }
    } else if (anchorMode) {
      const anchor = selection[0]!
      const baseRow = anchor.rowIndex
      const baseCol = colIdToIndex(anchor.columnId)
      for (const e of clipboard.cells) {
        const rOff = e.rowIndex - clipMinR
        const cOff = colIdToIndex(e.columnId) - clipMinC
        const r = baseRow + rOff
        const c = baseCol + cOff
        const colId = COL_IDS[c]
        if (!colId || r < 0 || r >= rows.length) continue
        api.setCellValue(r, colId, coerceCellValue(e.raw, colId))
      }
    } else {
      // Tile pattern across the selection's bounding rect.
      for (let r = selMinR; r <= selMaxR; r++) {
        for (let c = selMinC; c <= selMaxC; c++) {
          const colId = COL_IDS[c]
          if (!colId || r < 0 || r >= rows.length) continue
          // Only fill cells that the user actually selected (skip holes
          // in a non-rectangular selection).
          if (!selectedSet.has(`${r}:${colId}`)) continue
          const rOff = (r - selMinR) % clipRows
          const cOff = (c - selMinC) % clipCols
          const entry = clipMap.get(`${rOff}:${cOff}`)
          if (!entry) continue
          api.setCellValue(r, colId, coerceCellValue(entry.raw, colId))
        }
      }
    }

    if (clipboard.kind === 'cut') {
      // Blank the source cells. Same routing - api drives the update.
      for (const e of clipboard.cells) {
        api.setCellValue(e.rowIndex, e.columnId, e.columnId === 'category' ? '' : 0)
      }
      clipboard = null
    }
  }

  // Global keyboard shortcuts. Excel-style:
  //   Ctrl/⌘ + C / X / V   - copy / cut / paste
  //   Ctrl/⌘ + B / I / U   - bold / italic / underline (strikethrough)
  //   Ctrl/⌘ + 5            - strikethrough
  //   Ctrl/⌘ + Shift + $    - currency number format
  //   Ctrl/⌘ + Shift + %    - percent number format
  //   Ctrl/⌘ + Shift + 1    - plain number format
  //   Ctrl/⌘ + L / E / R    - align left / center / right
  //   Delete                - clear contents of selection
  // We don't preventDefault when the user is typing in the formula bar or
  // any other text input, so native shortcuts keep working inside them.
  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const inInput = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (inInput) return
      // Plain Delete clears selection contents (no modifier required).
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (hasSelection) { e.preventDefault(); clearContents() }
        return
      }
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      // Shifted formatting commands.
      if (e.shiftKey) {
        if (k === '$' || (e.shiftKey && k === '4')) {
          e.preventDefault(); applyToSelection({ numberFormat: 'currency' }); return
        }
        if (k === '%' || (e.shiftKey && k === '5')) {
          e.preventDefault(); applyToSelection({ numberFormat: 'percent' }); return
        }
        if (k === '!' || (e.shiftKey && k === '1')) {
          e.preventDefault(); applyToSelection({ numberFormat: 'number' }); return
        }
      }
      switch (k) {
        case 'c': e.preventDefault(); void copySelection('copy'); break
        case 'x': e.preventDefault(); void copySelection('cut');  break
        case 'v': e.preventDefault(); pasteAtActive();            break
        case 'b': e.preventDefault(); toggleFormat('bold');       break
        case 'i': e.preventDefault(); toggleFormat('italic');     break
        case 'u': e.preventDefault(); toggleFormat('strike');     break  // map underline → strike
        case '5': e.preventDefault(); toggleFormat('strike');     break
        case 'l': e.preventDefault(); applyToSelection({ align: 'left'   }); break
        case 'e': e.preventDefault(); applyToSelection({ align: 'center' }); break
        case 'r': e.preventDefault(); applyToSelection({ align: 'right'  }); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const hasClipboard  = $derived(clipboard !== null && clipboard.cells.length > 0)
  const cutKeys       = $derived(new Set(
    clipboard?.kind === 'cut' ? clipboard.cells.map((c) => fmtKey(c.rowIndex, c.columnId)) : [],
  ))

  // ---- Formula bar -------------------------------------------------------
  const activeCellRaw = $derived(
    activeCell ? cellRawValue(activeCell.rowIndex, activeCell.columnId) : '',
  )
  let formulaInput = $state('')
  $effect(() => { formulaInput = activeCellRaw })

  function commitFormulaBar() {
    if (!activeCell || !api) return
    const colId = activeCell.columnId
    const value: unknown = formulaInput.startsWith('=')
      ? formulaInput
      : colId === 'category'
        ? formulaInput
        : (Number(formulaInput) || 0)
    // Route through the API: onCellValueChange does the cellRaw + rows sync.
    api.setCellValue(activeCell.rowIndex, colId, value)
  }

  // ---- Context menu ------------------------------------------------------
  let ctxMenu = $state<{ x: number; y: number; rowIndex: number; columnId: string } | null>(null)
  function openCtxMenu(event: MouseEvent) {
    const target = (event.target as HTMLElement | null)
    const td = target?.closest('td.sv-grid-cell') as HTMLElement | null
    if (!td) return
    event.preventDefault()
    const rowIndex = Number(td.dataset.svgridRow)
    const columnId = td.dataset.colId ?? ''
    if (!Number.isFinite(rowIndex) || !columnId) return
    const MENU_W = 220, MENU_H = 280
    const vw = window.innerWidth, vh = window.innerHeight
    const x = Math.min(event.clientX, vw - MENU_W - 8)
    const y = Math.min(event.clientY, vh - MENU_H - 8)
    if (!activeCell || activeCell.rowIndex !== rowIndex || activeCell.columnId !== columnId) {
      activeCell = { rowIndex, columnId }
    }
    // Excel-style: if the right-clicked cell isn't part of the current
    // selection, the menu commands should operate on just that cell, not
    // on the stale selection from before the right-click.
    const inSelection = selectedCells.some(
      (c) => c.rowIndex === rowIndex && c.columnId === columnId,
    )
    if (!inSelection) selectedCells = [{ rowIndex, columnId }]
    ctxMenu = { x, y, rowIndex, columnId }
  }
  function closeCtxMenu() { ctxMenu = null }
  $effect(() => {
    if (!ctxMenu) return
    // Use `click` (not `mousedown`) for outside-close so a click on a
    // menu BUTTON gets to run its own onclick first. Right-click outside
    // simply re-fires `contextmenu`, which re-runs `openCtxMenu` and
    // moves the menu to the new cell - no separate close is needed.
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('.ctx-menu')) return
      closeCtxMenu()
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCtxMenu() }
    document.addEventListener('click', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('click', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  })

  // ---- Status bar aggregates -------------------------------------------
  const stats = $derived.by(() => {
    const cells = selectedCells.length > 0 ? selectedCells : activeCell ? [activeCell] : []
    let sum = 0, numericCount = 0
    for (const c of cells) {
      const v = getComputedValue(c.rowIndex, c.columnId)
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isFinite(n) && typeof v !== 'string') { sum += n; numericCount += 1 }
    }
    return {
      count: cells.length,
      numericCount,
      sum,
      avg: numericCount > 0 ? sum / numericCount : 0,
    }
  })

  const PALETTE = ['#ffffff', '#fef08a', '#fecaca', '#bfdbfe', '#bbf7d0', '#ddd6fe', '#fdba74', '#a7f3d0']
  const TEXT_PALETTE = ['#0f172a', '#dc2626', '#16a34a', '#2563eb', '#7c3aed', '#ea580c']
  const FONT_FAMILIES = [
    { value: 'inherit',                                           label: 'Default' },
    { value: '"Inter", system-ui, sans-serif',                    label: 'Inter' },
    { value: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',   label: 'Segoe UI' },
    { value: 'Georgia, "Times New Roman", serif',                 label: 'Georgia' },
    { value: '"Roboto Mono", ui-monospace, monospace',            label: 'Mono' },
  ]
  const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24]

  const hasSelection = $derived(activeCell != null)
  const hasActive    = $derived(activeCell != null)
</script>

{#snippet FormattedCell(props: { rowIndex: number; columnId: string; rawValue: number | string })}
  {@const key = `${props.rowIndex}:${props.columnId}`}
  {@const fmt = cellFormats[key] ?? {}}
  {@const isCut = cutKeys.has(key)}
  {@const formula = cellRaw[key]}
  {@const hasFormula = !!formula && formula.startsWith('=')}
  {@const isMonth = props.columnId !== 'category'}
  {@const raw = props.rawValue}
  {@const coerced = isMonth && typeof raw === 'string' && raw !== '' && !raw.startsWith('=') && Number.isFinite(Number(raw))
                    ? Number(raw)
                    : raw}
  {@const computed = hasFormula ? getComputedValue(props.rowIndex, props.columnId) : coerced}
  {@const isErr = isError(computed)}
  <!-- Section-header rows carry no literal value of their own; their month
       cells should read as blank so the bold band reads as a divider, not
       as "$0" across twelve columns. -->
  {@const isBlankSectionHeader = isMonth && !!fmt.section && !hasFormula && (computed === 0 || computed === '')}
  <span
    class="sheet-cell"
    class:sheet-cell-cut={isCut}
    class:sheet-cell-error={isErr}
    class:sheet-cell-section={fmt.section}
    class:sheet-cell-sub={fmt.subSection}
    style:font-weight={fmt.bold ? '700' : undefined}
    style:font-style={fmt.italic ? 'italic' : undefined}
    style:text-decoration={fmt.strike ? 'line-through' : undefined}
    style:color={isErr ? '#dc2626' : fmt.textColor}
    style:background={fmt.cellColor}
    style:text-align={fmt.align}
    style:font-family={fmt.fontFamily}
    style:font-size={fmt.fontSize ? `${fmt.fontSize}px` : undefined}
    title={hasFormula ? formula : ''}
  >
    {#if hasFormula}<span class="sheet-fx" aria-hidden="true">ƒ</span>{/if}
    {#if isBlankSectionHeader}
      <!-- intentionally blank -->
    {:else if isErr}
      {(computed as { error: string }).error}
    {:else if typeof computed === 'number'}
      {formatValue(computed, fmt.numberFormat)}
    {:else}
      {String(computed ?? '')}
    {/if}
  </span>
{/snippet}


<section class="flex flex-col flex-1 min-h-0 gap-0">
  <!-- ============ RIBBON BAR ============ -->
  <div class="ribbon">
    <!-- Tab strip -->
    <div class="ribbon-tabs">
      {#each [
        { id: 'home',      label: 'Home',      title: 'Font, alignment, colour, number format' },
        { id: 'clipboard', label: 'Clipboard', title: 'Cut, copy, paste' },
        { id: 'insert',    label: 'Insert',    title: 'Insert / delete rows around the active cell' },
        { id: 'data',      label: 'Data',      title: 'Sort and filter the grid' },
      ] as t (t.id)}
        <button type="button" class="ribbon-tab" class:ribbon-tab-active={activeTab === t.id}
          title={t.title} onclick={() => (activeTab = t.id as typeof activeTab)}>{t.label}</button>
      {/each}
      <div class="ribbon-spacer"></div>
      <div class="ribbon-active-label" aria-live="polite">
        {#if activeCell}
          <code>{cellAddress(activeCell.rowIndex, activeCell.columnId)}</code>
        {:else}
          <span style="color: var(--sg-muted);">No active cell</span>
        {/if}
      </div>
    </div>

    <!-- Tab contents -->
    <div class="ribbon-body">
      {#if activeTab === 'home'}
        <div class="ribbon-group">
          <span class="ribbon-group-label">Font</span>
          <div class="ribbon-group-buttons">
            <select class="rib-select rib-select-wide"
              title="Font family - applies to the active selection"
              value={cellFormats[activeCell ? fmtKey(activeCell.rowIndex, activeCell.columnId) : '']?.fontFamily ?? 'inherit'}
              onchange={(e) => applyToSelection({ fontFamily: (e.currentTarget as HTMLSelectElement).value })}>
              {#each FONT_FAMILIES as f (f.value)}<option value={f.value}>{f.label}</option>{/each}
            </select>
            <select class="rib-select"
              title="Font size (px) - applies to the active selection"
              value={cellFormats[activeCell ? fmtKey(activeCell.rowIndex, activeCell.columnId) : '']?.fontSize ?? 13}
              onchange={(e) => applyToSelection({ fontSize: Number((e.currentTarget as HTMLSelectElement).value) })}>
              {#each FONT_SIZES as s (s)}<option value={s}>{s}</option>{/each}
            </select>
            <button class="rib-btn" disabled={!hasSelection}
              onclick={() => toggleFormat('bold')} title="Bold (Ctrl+B)"><strong>B</strong></button>
            <button class="rib-btn" disabled={!hasSelection}
              onclick={() => toggleFormat('italic')} title="Italic (Ctrl+I)"><em>I</em></button>
            <button class="rib-btn" disabled={!hasSelection}
              onclick={() => toggleFormat('strike')} title="Strikethrough (Ctrl+U / Ctrl+5)">
              <span style="text-decoration: line-through;">S</span>
            </button>
          </div>
        </div>

        <div class="ribbon-group">
          <span class="ribbon-group-label">Alignment</span>
          <div class="ribbon-group-buttons">
            <button class="rib-btn" disabled={!hasSelection}
              title="Align left (Ctrl+L)" onclick={() => applyToSelection({ align: 'left' })}>⇤</button>
            <button class="rib-btn" disabled={!hasSelection}
              title="Center (Ctrl+E)" onclick={() => applyToSelection({ align: 'center' })}>⇔</button>
            <button class="rib-btn" disabled={!hasSelection}
              title="Align right (Ctrl+R)" onclick={() => applyToSelection({ align: 'right' })}>⇥</button>
          </div>
        </div>

        <div class="ribbon-group">
          <span class="ribbon-group-label">Cell color</span>
          <div class="ribbon-group-buttons">
            {#each PALETTE as color (color)}
              <button type="button" class="swatch" style:background={color}
                disabled={!hasSelection} aria-label={`Fill ${color}`}
                title={`Fill cell ${color} - text color auto-picks for contrast`}
                onclick={() => applyToSelection({ cellColor: color, textColor: pickContrastText(color) })}></button>
            {/each}
          </div>
        </div>

        <div class="ribbon-group">
          <span class="ribbon-group-label">Text color</span>
          <div class="ribbon-group-buttons">
            {#each TEXT_PALETTE as color (color)}
              <button type="button" class="swatch swatch-text" style:color={color}
                disabled={!hasSelection} aria-label={`Text ${color}`}
                title={`Set text color to ${color}`}
                onclick={() => applyToSelection({ textColor: color })}>A</button>
            {/each}
          </div>
        </div>

        <div class="ribbon-group">
          <span class="ribbon-group-label">Number</span>
          <div class="ribbon-group-buttons">
            <button class="rib-btn" disabled={!hasSelection}
              title="Currency format (Ctrl+Shift+$)" onclick={() => applyToSelection({ numberFormat: 'currency' })}>$</button>
            <button class="rib-btn" disabled={!hasSelection}
              title="Percent format (Ctrl+Shift+%)" onclick={() => applyToSelection({ numberFormat: 'percent' })}>%</button>
            <button class="rib-btn" disabled={!hasSelection}
              title="Plain number (Ctrl+Shift+1)" onclick={() => applyToSelection({ numberFormat: 'number' })}>123</button>
          </div>
        </div>

        <div class="ribbon-group">
          <span class="ribbon-group-label">Clear</span>
          <div class="ribbon-group-buttons">
            <button class="rib-btn rib-btn-wide" title="Remove bold/italic/colour/format from the selected cells (keeps values)"
              onclick={clearFormatting}>Clear formatting</button>
          </div>
        </div>

      {:else if activeTab === 'clipboard'}
        <div class="ribbon-group">
          <span class="ribbon-group-label">Clipboard</span>
          <div class="ribbon-group-buttons">
            <button class="rib-btn rib-btn-wide" disabled={!hasSelection}
              title="Cut selection to clipboard (Ctrl+X) - source blanks on Paste"
              onclick={() => copySelection('cut')}>✂ Cut</button>
            <button class="rib-btn rib-btn-wide" disabled={!hasSelection}
              title="Copy selection to clipboard (Ctrl+C) - also writes TSV to the OS clipboard so you can paste into Excel"
              onclick={() => copySelection('copy')}>⧉ Copy</button>
            <button class="rib-btn rib-btn-wide" disabled={!hasClipboard || !hasActive}
              title="Paste at the active cell (Ctrl+V). A multi-cell selection fills with the clipboard value or tiles the pattern."
              onclick={pasteAtActive}>📋 Paste</button>
          </div>
        </div>
        <div class="ribbon-group">
          <span class="ribbon-group-label">Selection</span>
          <div class="ribbon-group-buttons">
            <button class="rib-btn rib-btn-wide" disabled={!hasSelection}
              title="Clear values in the selected cells, keep formatting (Del)"
              onclick={clearContents}>Clear contents</button>
          </div>
        </div>
        {#if hasClipboard}
          <div class="ribbon-group">
            <span class="ribbon-group-label">In buffer</span>
            <div class="ribbon-group-buttons">
              <span class="rib-info">{clipboard!.cells.length} cell{clipboard!.cells.length === 1 ? '' : 's'} ({clipboard!.kind})</span>
            </div>
          </div>
        {/if}

      {:else if activeTab === 'insert'}
        <div class="ribbon-group">
          <span class="ribbon-group-label">Rows</span>
          <div class="ribbon-group-buttons">
            <button class="rib-btn rib-btn-wide" disabled={!hasActive}
              title="Insert a blank row immediately above the active cell - existing formulas reflow"
              onclick={insertRowAbove}>Insert above</button>
            <button class="rib-btn rib-btn-wide" disabled={!hasActive}
              title="Insert a blank row immediately below the active cell"
              onclick={insertRowBelow}>Insert below</button>
            <button class="rib-btn rib-btn-wide rib-btn-danger" disabled={!hasActive}
              title="Delete the entire row containing the active cell (cannot be undone)"
              onclick={deleteCurrentRow}>Delete row</button>
          </div>
        </div>

      {:else if activeTab === 'data'}
        <div class="ribbon-group">
          <span class="ribbon-group-label">Sort</span>
          <div class="ribbon-group-buttons">
            <button class="rib-btn rib-btn-wide" disabled={!hasActive}
              title="Sort by the active column, ascending - formulas re-resolve against the new row positions"
              onclick={sortAscending}>A → Z</button>
            <button class="rib-btn rib-btn-wide" disabled={!hasActive}
              title="Sort by the active column, descending"
              onclick={sortDescending}>Z → A</button>
            <button class="rib-btn rib-btn-wide"
              title="Remove every active sort" onclick={() => api?.clearSort()}>Clear sort</button>
          </div>
        </div>
        <div class="ribbon-group">
          <span class="ribbon-group-label">Filter</span>
          <div class="ribbon-group-buttons">
            <button class="rib-btn rib-btn-wide"
              title="Clear every active column filter"
              onclick={() => api?.clearAllFilters()}>Clear filters</button>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- ============ FORMULA BAR ============ -->
  <div class="formula-bar">
    <span class="formula-bar-ref">
      {activeCell ? cellAddress(activeCell.rowIndex, activeCell.columnId) : '-'}
    </span>
    <span class="formula-bar-fx" class:formula-bar-fx-on={formulaInput.startsWith('=')}>ƒx</span>
    <input
      type="text"
      class="formula-bar-input"
      bind:value={formulaInput}
      placeholder="Type a value or =SUM(B2:B5) here…"
      onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitFormulaBar() } }}
      onblur={commitFormulaBar}
      disabled={!activeCell}
    />
  </div>

  <!-- ============ GRID ============ -->
  <div class="flex-1 min-h-0 mt-2 sheet-active-host" bind:this={gridShellEl} oncontextmenu={openCtxMenu}>
    <SvGrid
      data={rows}
      columns={[
        {
          field: 'category', header: 'A · Category', editorType: 'text', width: 200,
          cell: (ctx: { row: { index: number; original: Row } }) =>
            renderSnippet(FormattedCell, {
              rowIndex: ctx.row.index,
              columnId: 'category',
              rawValue: ctx.row.original.category,
            }),
        },
        ...MONTHS.map((field, i) => ({
          field,
          header: `${String.fromCharCode(66 + i)} · ${field.toUpperCase()}`,
          editorType: 'text' as const,   // text editor so '=' formulas survive
          width: 150,
          align: 'right' as const,
          cell: (ctx: { row: { index: number; original: Row } }) =>
            renderSnippet(FormattedCell, {
              rowIndex: ctx.row.index,
              columnId: field,
              rawValue: ctx.row.original[field] ?? 0,
            }),
        })),
      ] satisfies ColumnDef<typeof features, Row>[]}
      features={features}
      filterMode="menu"
      showRowNumbers={true}
      showPagination={false}
      enableInlineEditing={true}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={32}
      containerHeight="100%"
      fitColumns={false}
      onApiReady={(next) => (api = next)}
      onActiveCellChange={(cell) => (activeCell = { rowIndex: cell.rowIndex, columnId: cell.columnId })}
      onCellValueChange={onCellValueChange}
    />
  </div>

  <!-- ============ STATUS BAR ============ -->
  <div class="status">
    <span>Cells: <strong>{stats.count}</strong></span>
    <span>Sum: <strong>{integerFmt.format(stats.sum)}</strong></span>
    <span>Avg: <strong>{Number.isInteger(stats.avg) ? integerFmt.format(stats.avg) : decimalFmt.format(stats.avg)}</strong></span>
    <span class="status-spacer"></span>
    <span style="color: var(--sg-muted);">
      <code class="kbd">=</code> formula · <code class="kbd">Ctrl+B/I/U</code> format · <code class="kbd">Ctrl+L/E/R</code> align · <code class="kbd">Ctrl+C/X/V</code> clipboard · <code class="kbd">Del</code> clear · right-click for menu
    </span>
  </div>
</section>

<!-- ============ CONTEXT MENU ============ -->
{#if ctxMenu}
  <div class="ctx-menu" role="menu" style="left: {ctxMenu.x}px; top: {ctxMenu.y}px;">
    <div class="ctx-menu-head">
      <span class="ctx-menu-label">Cell</span>
      <span class="ctx-menu-addr">{cellAddress(ctxMenu.rowIndex, ctxMenu.columnId)}</span>
    </div>
    <button type="button" class="ctx-item" disabled={!hasSelection}
      onclick={() => { void copySelection('cut'); closeCtxMenu() }}>
      <span class="ctx-ico">✂</span><span class="ctx-text">Cut</span><kbd class="ctx-kbd">⌘X</kbd>
    </button>
    <button type="button" class="ctx-item" disabled={!hasSelection}
      onclick={() => { void copySelection('copy'); closeCtxMenu() }}>
      <span class="ctx-ico">⧉</span><span class="ctx-text">Copy</span><kbd class="ctx-kbd">⌘C</kbd>
    </button>
    <button type="button" class="ctx-item" disabled={!hasClipboard}
      onclick={() => { pasteAtActive(); closeCtxMenu() }}>
      <span class="ctx-ico">📋</span><span class="ctx-text">Paste</span><kbd class="ctx-kbd">⌘V</kbd>
    </button>
    <div class="ctx-sep"></div>
    <button type="button" class="ctx-item" onclick={() => { insertRowAbove(); closeCtxMenu() }}>
      <span class="ctx-ico">↑</span><span class="ctx-text">Insert row above</span>
    </button>
    <button type="button" class="ctx-item" onclick={() => { insertRowBelow(); closeCtxMenu() }}>
      <span class="ctx-ico">↓</span><span class="ctx-text">Insert row below</span>
    </button>
    <button type="button" class="ctx-item ctx-item-danger" onclick={() => { deleteCurrentRow(); closeCtxMenu() }}>
      <span class="ctx-ico">🗑</span><span class="ctx-text">Delete row</span>
    </button>
    <div class="ctx-sep"></div>
    <button type="button" class="ctx-item" onclick={() => { clearContents(); closeCtxMenu() }}>
      <span class="ctx-ico">⌫</span><span class="ctx-text">Clear contents</span>
      <kbd class="ctx-kbd">Del</kbd>
    </button>
    <button type="button" class="ctx-item" onclick={() => { clearFormatting(); closeCtxMenu() }}>
      <span class="ctx-ico">🧹</span><span class="ctx-text">Clear formatting</span>
    </button>
    <div class="ctx-sep"></div>
    <button type="button" class="ctx-item" onclick={() => { activeTab = 'home'; closeCtxMenu() }}>
      <span class="ctx-ico">🎨</span><span class="ctx-text">Format cells…</span>
    </button>
  </div>
{/if}

<style>
  .ribbon { border: 1px solid var(--sg-border); border-radius: 8px;
            background: var(--sg-header-bg); flex: 0 0 auto; overflow: hidden; }
  .ribbon-tabs { display: flex; align-items: center; gap: 4px; padding: 6px 8px;
                 border-bottom: 1px solid var(--sg-border);
                 background: color-mix(in srgb, var(--sg-header-bg) 85%, var(--sg-bg)); }
  .ribbon-tab { font: inherit; font-size: 12px; font-weight: 600; padding: 4px 14px;
                border: 0; border-radius: 4px; background: transparent; color: var(--sg-fg); cursor: pointer; }
  .ribbon-tab:hover { background: var(--sg-row-hover-bg); }
  .ribbon-tab-active { background: var(--sg-bg); box-shadow: inset 0 -2px 0 var(--sg-accent, #2563eb); }
  .ribbon-spacer { flex: 1 1 auto; }
  .ribbon-active-label { font-size: 12px; color: var(--sg-fg); }
  .ribbon-active-label code { padding: 2px 8px; border-radius: 4px; background: var(--sg-bg);
                              border: 1px solid var(--sg-border); color: var(--sg-accent, #2563eb); font-weight: 700; }

  .ribbon-body { display: flex; align-items: stretch; gap: 8px; padding: 8px; overflow-x: auto; }
  .ribbon-group { display: flex; flex-direction: column; gap: 4px; padding: 4px 8px 2px;
                  border-right: 1px solid var(--sg-border); }
  .ribbon-group:last-child { border-right: 0; }
  .ribbon-group-label { font-size: 10px; font-weight: 600; text-transform: uppercase;
                        letter-spacing: 0.04em; color: var(--sg-muted); text-align: center;
                        order: 99; padding-top: 2px; }
  .ribbon-group-buttons { display: flex; align-items: center; gap: 4px; }

  .rib-btn { display: inline-flex; align-items: center; justify-content: center;
             min-width: 28px; height: 28px; padding: 0 8px; font: inherit; font-size: 12px;
             color: var(--sg-fg); background: var(--sg-bg);
             border: 1px solid var(--sg-border); border-radius: 4px; cursor: pointer; }
  .rib-btn:hover:not(:disabled) { background: var(--sg-row-hover-bg);
                                  border-color: color-mix(in srgb, var(--sg-accent, #2563eb) 35%, var(--sg-border)); }
  .rib-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .rib-btn-wide { padding: 0 10px; }
  .rib-btn-danger { color: #ef4444; border-color: color-mix(in srgb, #ef4444 28%, var(--sg-border)); }
  .rib-btn-danger:hover:not(:disabled) { background: color-mix(in srgb, #ef4444 8%, transparent); }

  .rib-select { font: inherit; font-size: 12px; height: 28px; padding: 0 6px;
                color: var(--sg-fg); background: var(--sg-bg);
                border: 1px solid var(--sg-border); border-radius: 4px; cursor: pointer; }
  .rib-select-wide { min-width: 110px; }

  .rib-info { font-size: 12px; color: var(--sg-muted); padding: 0 8px; }

  .swatch { width: 22px; height: 22px; border-radius: 4px;
            border: 1px solid color-mix(in srgb, var(--sg-fg) 25%, transparent);
            cursor: pointer; padding: 0; }
  .swatch:disabled { opacity: 0.4; cursor: not-allowed; }
  .swatch-text { background: var(--sg-bg); font-weight: 700; font-size: 11px;
                 display: inline-flex; align-items: center; justify-content: center; }

  /* ===== Formula bar ===== */
  .formula-bar { display: flex; align-items: center; gap: 0;
                 margin-top: 6px; border: 1px solid var(--sg-border); border-radius: 6px;
                 background: var(--sg-bg); overflow: hidden; }
  .formula-bar-ref { background: var(--sg-header-bg); padding: 6px 12px;
                     font-family: ui-monospace, Menlo, monospace; font-weight: 700;
                     min-width: 64px; text-align: center;
                     border-right: 1px solid var(--sg-border); }
  .formula-bar-fx { font-style: italic; font-family: ui-serif, Georgia, serif;
                    color: var(--sg-muted); padding: 0 8px; font-size: 14px; }
  .formula-bar-fx-on { color: var(--sg-accent, #2563eb); font-weight: 700; }
  .formula-bar-input { flex: 1; border: 0; background: transparent;
                       padding: 7px 8px; font-family: ui-monospace, Menlo, monospace;
                       font-size: 13px; color: var(--sg-fg); outline: none; }
  .formula-bar-input:disabled { opacity: 0.5; }

  /* ===== Sheet cell rendering ===== */
  :global(.sheet-active-host .sv-grid-cell:has(.sheet-cell)) { padding: 0 !important; }
  .sheet-cell { display: block; width: 100%; height: 100%; padding: 0 7px;
                box-sizing: border-box; text-align: inherit; line-height: 32px; }
  .sheet-cell-cut {
    outline: 2px dashed #6366f1; outline-offset: -2px;
    background: rgba(99, 102, 241, 0.08) !important;
  }
  .sheet-cell-error { font-family: ui-monospace, Menlo, monospace; font-weight: 700; }
  .sheet-fx { display: inline-block; color: var(--sg-accent, #2563eb);
              font-style: italic; font-family: ui-serif, Georgia, serif;
              margin-right: 4px; font-weight: 700; }

  /* Section header row - bolder weight + a subtle accent-tinted background.
     Uses color-mix against the existing header background so it always
     sits one step above the surface and reads correctly in light and
     dark mode without hardcoded hex colors. */
  .sheet-cell-section {
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 10%, var(--sg-header-bg, #f1f5f9));
    color: var(--sg-fg, #0f172a);
    font-weight: 700;
    border-top: 1px solid color-mix(in oklab, var(--sg-accent, #6366f1) 20%, var(--sg-border, #e2e8f0));
  }
  :global(html[data-theme='dark']) .sheet-cell-section {
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 14%, var(--sg-header-bg, #1e293b));
    color: var(--sg-fg, #e2e8f0);
    border-top-color: color-mix(in oklab, var(--sg-accent, #6366f1) 25%, var(--sg-border, #334155));
  }
  /* Sub-section row - margin / KPI lines. Same tint with a lighter mix. */
  .sheet-cell-sub {
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 4%, var(--sg-row-alt-bg, #f8fafc));
    color: var(--sg-muted, #475569);
    font-style: italic;
  }
  :global(html[data-theme='dark']) .sheet-cell-sub {
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 7%, var(--sg-row-alt-bg, #1b2230));
    color: var(--sg-muted, #94a3b8);
  }

  .status { flex: 0 0 auto; display: flex; align-items: center; gap: 18px;
            margin-top: 6px; padding: 6px 10px; border: 1px solid var(--sg-border);
            border-radius: 6px; background: var(--sg-header-bg); color: var(--sg-fg); font-size: 12px; }
  .status-spacer { flex: 1 1 auto; }
  .status code.kbd { font-family: ui-monospace, Menlo, monospace; background: var(--sg-bg);
                     border: 1px solid var(--sg-border); border-radius: 3px; padding: 1px 5px; }

  /* ===== Context menu ===== */
  .ctx-menu { position: fixed; z-index: 50; min-width: 220px;
              background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
              border: 1px solid var(--sg-border, #cbd5e1); border-radius: 8px;
              padding: 4px;
              box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18), 0 2px 6px rgba(15, 23, 42, 0.10);
              animation: ctx-pop 90ms ease-out; user-select: none; }
  @keyframes ctx-pop { from { opacity: 0; transform: scale(0.96); }
                       to   { opacity: 1; transform: scale(1); } }
  .ctx-menu-head { display: flex; justify-content: space-between; align-items: baseline;
                   padding: 8px 10px 6px; border-bottom: 1px solid var(--sg-border);
                   margin-bottom: 4px; }
  .ctx-menu-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sg-muted); }
  .ctx-menu-addr { font-family: ui-monospace, Menlo, monospace; font-weight: 700;
                   color: var(--sg-accent, #2563eb); font-size: 12px; }
  .ctx-item { display: flex; align-items: center; gap: 10px; width: 100%;
              padding: 7px 10px; border: 0; background: transparent; color: var(--sg-fg);
              font-size: 13px; text-align: left; cursor: pointer; border-radius: 5px; }
  .ctx-item:hover:not(:disabled),
  .ctx-item:focus-visible:not(:disabled) { background: var(--sg-row-hover-bg, rgba(148, 163, 184, 0.14)); outline: none; }
  .ctx-item:disabled { opacity: 0.45; cursor: default; }
  .ctx-ico { width: 18px; text-align: center; color: var(--sg-muted); font-size: 13px; }
  .ctx-text { flex: 1; }
  .ctx-kbd { font-family: ui-monospace, Menlo, monospace; font-size: 10.5px;
             padding: 1px 5px; border: 1px solid var(--sg-border); border-radius: 3px;
             color: var(--sg-muted); background: var(--sg-header-bg); }
  .ctx-sep { height: 1px; background: var(--sg-border); margin: 4px 6px; }
  .ctx-item-danger { color: #dc2626; }
  .ctx-item-danger .ctx-ico { color: #dc2626; }
  .ctx-item-danger:hover:not(:disabled) { background: rgba(220, 38, 38, 0.10); }
  :global(html[data-theme='dark']) .ctx-item-danger { color: #f87171; }
  :global(html[data-theme='dark']) .ctx-item-danger .ctx-ico { color: #f87171; }
  :global(html[data-theme='dark']) .ctx-item-danger:hover:not(:disabled) { background: rgba(248, 113, 113, 0.16); }
</style>
