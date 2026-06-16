<script lang="ts">
  /**
   * /theme-builder
   * --------------
   * Enterprise-ready theme builder for SvGrid:
   *   - One brand color drives a full derived palette (auto), OR
   *     override any individual token
   *   - Light + dark, side-by-side preview
   *   - 9 brand presets (Linear / Notion / Stripe / Vercel / GitHub /
   *     Material / Mono / Sunset / Nimber)
   *   - Accordion-grouped controls per grid PART:
   *       Surface · Header · Body & rows · Interaction · Cells &
   *       borders · Pinned columns · Typography
   *   - Full WCAG contrast report across every text/background pair
   *   - Export to CSS / SCSS / JSON / Tailwind, with light AND dark
   *     blocks emitted together
   *   - Import: paste any CSS containing --sg-* vars
   *   - Saved themes (named) in localStorage; sharable URL; per-session
   *     autosave
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from 'sv-grid-core'
  import { onMount } from 'svelte'

  // ---- Preview dataset (data-agnostic placeholder) -------------------
  /** Generic preview row. Users can paste their own CSV / JSON via the
   *  Data drawer to see the theme against their real column layout. */
  type PreviewRow = Record<string, string | number | boolean | null>

  // Procedural NATO-phonetic dataset. Enough rows to overflow the viewport
  // so the vertical scrollbar is always visible in the preview.
  const PHONETIC = [
    'alpha','bravo','charlie','delta','echo','foxtrot','golf','hotel',
    'india','juliet','kilo','lima','mike','november','oscar','papa',
    'quebec','romeo','sierra','tango','uniform','victor','whiskey','xray',
    'yankee','zulu',
  ]
  const CATEGORIES = ['Type A','Type B','Type C','Type D']
  const STATUSES   = ['Active','Pending','Review','Closed']
  function defaultRows(): PreviewRow[] {
    return Array.from({ length: 80 }, (_, i) => {
      const word = PHONETIC[i % PHONETIC.length]!
      const seed = (i + 1) * 9301 + 49297
      const r1 = (seed % 233280) / 233280
      const r2 = ((seed * 1664525 + 1013904223) % 4096) / 4096
      const day = ((i * 7) % 28) + 1
      const month = ((i * 3) % 12) + 1
      return {
        id:       'R-' + String(i + 1).padStart(3, '0'),
        label:    'Item ' + word + (i >= PHONETIC.length ? ' ' + (Math.floor(i / PHONETIC.length) + 1) : ''),
        category: CATEGORIES[i % CATEGORIES.length]!,
        count:    Math.round(r1 * 950 + 5),
        amount:   Math.round(r2 * 48000 + 200),
        date:     '2026-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
        status:   STATUSES[i % STATUSES.length]!,
      }
    })
  }
  function defaultColumns(): ColumnDef<typeof features, PreviewRow>[] {
    return [
      { field: 'id',       header: 'ID',       width: 80  },
      { field: 'label',    header: 'Label',    width: 150 },
      { field: 'category', header: 'Category', width: 110 },
      { field: 'count',    header: 'Count',    width: 90, align: 'right' },
      { field: 'amount',   header: 'Amount',   width: 110, align: 'right',
        format: { type: 'number', options: { maximumFractionDigits: 0 } } },
      { field: 'date',     header: 'Date',     width: 110, format: { type: 'date', pattern: 'y-m-d' } },
      { field: 'status',   header: 'Status',   width: 110 },
    ]
  }
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let rows    = $state<PreviewRow[]>(defaultRows())
  let columns = $state<ColumnDef<typeof features, PreviewRow>[]>(defaultColumns())
  let dataMode = $state<'default' | 'custom'>('default')

  // ---- Data import (paste CSV or JSON) -----------------------------
  // The point of this is so the user sees their REAL column names, text
  // lengths, and number formats while choosing colors - not a generic
  // NATO sample that might hide layout issues their actual data exposes.
  let dataOpen = $state<boolean>(false)
  let dataText = $state<string>('')
  let dataMsg  = $state<string>('')

  /** Best-effort CSV parser (RFC 4180 quoting). Good enough for the
   *  paste-from-spreadsheet flow we're supporting. */
  function parseCSV(text: string): Array<Array<string>> {
    const out: Array<Array<string>> = []
    let row: Array<string> = []
    let cell = ''
    let inQuotes = false
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i]
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1 }
        else if (ch === '"') inQuotes = false
        else cell += ch
      } else {
        if (ch === '"') inQuotes = true
        else if (ch === ',' || ch === '\t') { row.push(cell); cell = '' }
        else if (ch === '\n' || ch === '\r') {
          if (cell !== '' || row.length) { row.push(cell); out.push(row); row = []; cell = '' }
          // Skip the \n after a \r so CRLF lands as one row.
          if (ch === '\r' && text[i + 1] === '\n') i += 1
        }
        else cell += ch
      }
    }
    if (cell !== '' || row.length) { row.push(cell); out.push(row) }
    return out
  }

  /** Coerce a CSV string cell into number/boolean/string for richer
   *  preview rendering (right-aligned numbers, etc.). */
  function coerce(value: string): string | number | boolean {
    const t = value.trim()
    if (t === '') return ''
    if (t === 'true') return true
    if (t === 'false') return false
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
    return value
  }

  function applyParsedData(parsedRows: Array<Record<string, unknown>>) {
    if (!parsedRows.length) { dataMsg = 'No rows found.'; return }
    const fields = Array.from(new Set(parsedRows.flatMap(r => Object.keys(r))))
    if (!fields.length) { dataMsg = 'No columns found.'; return }
    // Detect column types from the FIRST 50 rows so width / alignment make sense.
    const sample = parsedRows.slice(0, 50)
    const nextCols: ColumnDef<typeof features, PreviewRow>[] = fields.map((field) => {
      let numCount = 0
      let total = 0
      for (const r of sample) {
        const v = r[field]
        if (v === '' || v == null) continue
        total += 1
        if (typeof v === 'number') numCount += 1
      }
      const isNumeric = total > 0 && numCount / total >= 0.8
      return {
        field,
        header: field.charAt(0).toUpperCase() + field.slice(1).replace(/[_-]/g, ' '),
        width: isNumeric ? 110 : 140,
        align: isNumeric ? 'right' : undefined,
        format: isNumeric ? { type: 'number', options: { maximumFractionDigits: 2 } } : undefined,
      }
    })
    rows = parsedRows as PreviewRow[]
    columns = nextCols
    dataMode = 'custom'
    dataMsg = `Loaded ${parsedRows.length} rows · ${nextCols.length} columns.`
    dataOpen = false
  }

  function loadCustomData() {
    const text = dataText.trim()
    if (!text) { dataMsg = 'Paste some CSV or JSON first.'; return }
    // JSON path - array of objects only.
    if (text.startsWith('[') || text.startsWith('{')) {
      try {
        const parsed = JSON.parse(text)
        const arr = Array.isArray(parsed) ? parsed : [parsed]
        applyParsedData(arr as Array<Record<string, unknown>>)
        return
      } catch (e) { dataMsg = 'Invalid JSON: ' + (e as Error).message; return }
    }
    // CSV path - first row is headers.
    const matrix = parseCSV(text)
    if (matrix.length < 2) { dataMsg = 'CSV needs a header row + at least one data row.'; return }
    const headers = matrix[0]!.map((h) => h.trim() || `col_${matrix[0]!.indexOf(h) + 1}`)
    const dataRows = matrix.slice(1).map((rowCells) => {
      const obj: Record<string, unknown> = {}
      headers.forEach((h, i) => { obj[h] = coerce(rowCells[i] ?? '') })
      return obj
    })
    applyParsedData(dataRows)
  }
  function resetToSampleData() {
    rows = defaultRows()
    columns = defaultColumns()
    dataMode = 'default'
    dataMsg = 'Restored sample dataset.'
  }

  // ---- Color math ----------------------------------------------------
  type HSL = { h: number; s: number; l: number }
  function hexToHsl(hex: string): HSL {
    const h = hex.replace('#', '')
    if (h.length !== 6) return { h: 240, s: 70, l: 50 }
    const r = parseInt(h.slice(0, 2), 16) / 255
    const g = parseInt(h.slice(2, 4), 16) / 255
    const b = parseInt(h.slice(4, 6), 16) / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const l = (max + min) / 2
    if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) }
    const d = max - min
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    let hue = 0
    if      (max === r) hue = ((g - b) / d + (g < b ? 6 : 0))
    else if (max === g) hue = (b - r) / d + 2
    else                hue = (r - g) / d + 4
    return { h: Math.round(hue * 60), s: Math.round(s * 100), l: Math.round(l * 100) }
  }
  function hslToHex({ h, s, l }: HSL): string {
    const sN = s / 100, lN = l / 100
    const c = (1 - Math.abs(2 * lN - 1)) * sN
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = lN - c / 2
    let r = 0, g = 0, b = 0
    if      (h < 60)  [r, g, b] = [c, x, 0]
    else if (h < 120) [r, g, b] = [x, c, 0]
    else if (h < 180) [r, g, b] = [0, c, x]
    else if (h < 240) [r, g, b] = [0, x, c]
    else if (h < 300) [r, g, b] = [x, 0, c]
    else              [r, g, b] = [c, 0, x]
    const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
    return `#${to(r)}${to(g)}${to(b)}`
  }
  function withL(base: HSL, l: number): string { return hslToHex({ ...base, l }) }
  function withSL(base: HSL, s: number, l: number): string { return hslToHex({ ...base, s, l }) }
  function withA(hex: string, alpha: number): string {
    const h = hex.replace('#', '')
    if (h.length !== 6) return hex
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  // ---- WCAG ----------------------------------------------------------
  function srgbToLinear(c: number): number {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } | null {
    const m = /^rgba?\(([^)]+)\)$/.exec(hex)
    if (m) {
      const parts = m[1]!.split(',').map((s) => parseFloat(s))
      return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] ?? 1 }
    }
    const h = hex.replace('#', '')
    if (h.length !== 6) return null
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    }
  }
  function relLum(color: string): number {
    const rgb = hexToRgb(color)
    if (!rgb) return 0
    return 0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b)
  }
  function contrastRatio(a: string, b: string): number {
    const la = relLum(a), lb = relLum(b)
    const [hi, lo] = la > lb ? [la, lb] : [lb, la]
    return (hi + 0.05) / (lo + 0.05)
  }
  function wcagLevel(ratio: number, large: boolean): 'AAA' | 'AA' | 'Fail' {
    if (large) {
      if (ratio >= 4.5) return 'AAA'
      if (ratio >= 3)   return 'AA'
      return 'Fail'
    }
    if (ratio >= 7)   return 'AAA'
    if (ratio >= 4.5) return 'AA'
    return 'Fail'
  }

  // ---- Presets -------------------------------------------------------
  type Preset = {
    id: string; name: string; brand: string;
    mode: 'light' | 'dark'; radius: number; font: string;
  }
  const PRESETS: Preset[] = [
    { id: 'linear',   name: 'Linear',   brand: '#5e6ad2', mode: 'dark',  radius: 6,  font: 'Inter, ui-sans-serif, system-ui' },
    { id: 'notion',   name: 'Notion',   brand: '#2eaadc', mode: 'light', radius: 4,  font: 'ui-sans-serif, system-ui' },
    { id: 'stripe',   name: 'Stripe',   brand: '#635bff', mode: 'light', radius: 8,  font: 'ui-sans-serif, system-ui' },
    { id: 'vercel',   name: 'Vercel',   brand: '#0070f3', mode: 'dark',  radius: 6,  font: 'Geist, Inter, ui-sans-serif' },
    { id: 'github',   name: 'GitHub',   brand: '#2da44e', mode: 'dark',  radius: 6,  font: 'ui-sans-serif, system-ui' },
    { id: 'material', name: 'Material', brand: '#1976d2', mode: 'light', radius: 4,  font: 'Roboto, ui-sans-serif, system-ui' },
    { id: 'mono',     name: 'Mono',     brand: '#1f2937', mode: 'dark',  radius: 2,  font: 'ui-monospace, SFMono-Regular' },
    { id: 'sunset',   name: 'Sunset',   brand: '#f97316', mode: 'light', radius: 10, font: 'ui-sans-serif, system-ui' },
    // ni.com-inspired green; named "Nimber" per request.
    { id: 'nimber',   name: 'Nimber',   brand: '#03b585', mode: 'dark',  radius: 4,  font: 'ui-sans-serif, system-ui' },
  ]
  const DEFAULTS = {
    brand: '#6366f1',
    mode: 'dark' as 'light' | 'dark',         // ← dark mode by default
    radius: 6,
    rowHeight: 34,
    headerHeight: 38,
    cellPaddingX: 12,
    cellPaddingY: 0,
    borderStyle: 'solid' as 'solid' | 'dashed' | 'dotted' | 'none',
    borderWidth: 1,
    font: 'Inter, ui-sans-serif, system-ui',
    bodyFontSize: 13,
    bodyFontWeight: 400,
    headerFontWeight: 700,
    headerTransform: 'none' as 'none' | 'uppercase' | 'capitalize',
    headerLetterSpacing: 0,    // em × 100
    // Column-header specifics
    headerAlign: 'left' as 'left' | 'center' | 'right',
    headerPaddingX: 12,
    headerFontSize: 12,
    headerDividerStyle: 'none' as 'none' | 'solid' | 'dashed' | 'dotted',
    headerDividerWidth: 1,
    headerBorderColor: '',       // bottom-border tint (blank = global border token)
    headerDividerColor: '',      // vertical divider between header cells (blank = matches bottom border)
    headerBottomBorderWidth: 1,
    headerShadow: false,
    // Column-level styling
    colDividerStyle: 'none' as 'none' | 'solid' | 'dashed' | 'dotted',
    colDividerWidth: 1,
    firstColEmphasis: false,
    firstColBg: '#ffffff',
    firstColWeight: 600,
    altColumns: false,
    altColumnBg: '#f8fafc',
    // Body-cell (column) color overrides - empty = inherit surface tokens
    colBg: '',
    colFg: '',
    colBorder: '',
    // ---- Header state tokens (Handsontable-style) ------------------
    // Base inherits headerBg/headerFg from token system.
    // Empty value = inherit / no override applied.
    headerHoverFg: '',
    headerHoverBg: '',
    headerHoverShadowSize: 4,    // px - drop shadow under hovered cell
    headerActiveFg: '',          // sorted column header
    headerActiveBg: '',
    headerActiveBorderColor: '',
    headerFilterBg: '',          // column with active filter
    // ---- Cell border state tokens ----------------------------------
    horizontalBorderColor: '',   // body row border-bottom (horizontal)
    verticalBorderColor: '',     // body cell border-right (vertical)
    selectionBorderColor: '',    // selected cell ring
    // ---- Cell state colors -----------------------------------------
    successBg: '',               // .success cell class
    errorBg: '',                 // .error cell class
    readOnlyBg: '',              // .readonly cell class
    // ---- Editor styling --------------------------------------------
    editorBorderWidth: 1,
    editorBorderColor: '',
    editorFg: '',
    editorBg: '',
    editorShadowBlur: 12,
    editorShadowColor: '',
    // ---- Scrollbar styling -----------------------------------------
    scrollRadius: 8,
    scrollTrack: '',
    scrollThumb: '',
    scrollArrow: '',             // arrow glyph color on scrollbar buttons
    zebra: true,
    tokenMode: 'auto' as 'auto' | 'manual',
  }

  // ---- State ---------------------------------------------------------
  let brand    = $state<string>(DEFAULTS.brand)
  let mode     = $state<'light' | 'dark'>(DEFAULTS.mode)
  let radius   = $state<number>(DEFAULTS.radius)
  let rowHeight       = $state<number>(DEFAULTS.rowHeight)
  let headerHeight    = $state<number>(DEFAULTS.headerHeight)
  let cellPaddingX    = $state<number>(DEFAULTS.cellPaddingX)
  let cellPaddingY    = $state<number>(DEFAULTS.cellPaddingY)
  let borderStyle     = $state<'solid' | 'dashed' | 'dotted' | 'none'>(DEFAULTS.borderStyle)
  let borderWidth     = $state<number>(DEFAULTS.borderWidth)
  let font     = $state<string>(DEFAULTS.font)
  let bodyFontSize    = $state<number>(DEFAULTS.bodyFontSize)
  let bodyFontWeight  = $state<number>(DEFAULTS.bodyFontWeight)
  let headerFontWeight = $state<number>(DEFAULTS.headerFontWeight)
  let headerTransform = $state<'none' | 'uppercase' | 'capitalize'>(DEFAULTS.headerTransform)
  let headerLetterSpacing = $state<number>(DEFAULTS.headerLetterSpacing)
  let headerAlign = $state<'left' | 'center' | 'right'>(DEFAULTS.headerAlign)
  let headerPaddingX = $state<number>(DEFAULTS.headerPaddingX)
  let headerFontSize = $state<number>(DEFAULTS.headerFontSize)
  let headerDividerStyle = $state<'none' | 'solid' | 'dashed' | 'dotted'>(DEFAULTS.headerDividerStyle)
  let headerDividerWidth = $state<number>(DEFAULTS.headerDividerWidth)
  let headerBorderColor  = $state<string>(DEFAULTS.headerBorderColor)
  let headerDividerColor = $state<string>(DEFAULTS.headerDividerColor)
  let headerBottomBorderWidth = $state<number>(DEFAULTS.headerBottomBorderWidth)
  let headerShadow = $state<boolean>(DEFAULTS.headerShadow)
  let colDividerStyle = $state<'none' | 'solid' | 'dashed' | 'dotted'>(DEFAULTS.colDividerStyle)
  let colDividerWidth = $state<number>(DEFAULTS.colDividerWidth)
  let firstColEmphasis = $state<boolean>(DEFAULTS.firstColEmphasis)
  let firstColBg = $state<string>(DEFAULTS.firstColBg)
  let firstColWeight = $state<number>(DEFAULTS.firstColWeight)
  let altColumns = $state<boolean>(DEFAULTS.altColumns)
  let altColumnBg = $state<string>(DEFAULTS.altColumnBg)
  let colBg = $state<string>(DEFAULTS.colBg)
  let colFg = $state<string>(DEFAULTS.colFg)
  let colBorder = $state<string>(DEFAULTS.colBorder)
  // Header state tokens
  let headerHoverFg = $state<string>(DEFAULTS.headerHoverFg)
  let headerHoverBg = $state<string>(DEFAULTS.headerHoverBg)
  let headerHoverShadowSize = $state<number>(DEFAULTS.headerHoverShadowSize)
  let headerActiveFg = $state<string>(DEFAULTS.headerActiveFg)
  let headerActiveBg = $state<string>(DEFAULTS.headerActiveBg)
  let headerActiveBorderColor = $state<string>(DEFAULTS.headerActiveBorderColor)
  let headerFilterBg = $state<string>(DEFAULTS.headerFilterBg)
  // Cell border state
  let horizontalBorderColor = $state<string>(DEFAULTS.horizontalBorderColor)
  let verticalBorderColor = $state<string>(DEFAULTS.verticalBorderColor)
  let selectionBorderColor = $state<string>(DEFAULTS.selectionBorderColor)
  // Cell state colors
  let successBg = $state<string>(DEFAULTS.successBg)
  let errorBg = $state<string>(DEFAULTS.errorBg)
  let readOnlyBg = $state<string>(DEFAULTS.readOnlyBg)
  // Editor
  let editorBorderWidth = $state<number>(DEFAULTS.editorBorderWidth)
  let editorBorderColor = $state<string>(DEFAULTS.editorBorderColor)
  let editorFg = $state<string>(DEFAULTS.editorFg)
  let editorBg = $state<string>(DEFAULTS.editorBg)
  let editorShadowBlur = $state<number>(DEFAULTS.editorShadowBlur)
  let editorShadowColor = $state<string>(DEFAULTS.editorShadowColor)
  // Scrollbar
  let scrollRadius = $state<number>(DEFAULTS.scrollRadius)
  let scrollTrack = $state<string>(DEFAULTS.scrollTrack)
  let scrollThumb = $state<string>(DEFAULTS.scrollThumb)
  let scrollArrow = $state<string>(DEFAULTS.scrollArrow)
  let zebra    = $state<boolean>(DEFAULTS.zebra)
  let tokenMode = $state<'auto' | 'manual'>(DEFAULTS.tokenMode)
  let activePreset = $state<string | null>(null)

  // ---- Hover-to-highlight -------------------------------------------
  // Hovering a control flags the matching preview element with a brief
  // outline so first-time users can see what each token paints. A single
  // CSS rule (rewritten via $effect on highlightSelector change) handles
  // the outline so we don't churn the live styles textContent.
  let highlightSelector = $state<string | null>(null)
  function highlight(selector: string) {
    return {
      onmouseenter: () => (highlightSelector = selector),
      onmouseleave: () => (highlightSelector = null),
      onfocus:      () => (highlightSelector = selector),
      onblur:       () => (highlightSelector = null),
    }
  }
  /** What preview element each token paints. Hovering a control with one
   *  of these keys outlines the corresponding element so the user can see
   *  where the change will land. */
  const TOKEN_PREVIEW_SELECTOR: Partial<Record<string, string>> = {
    bg:             '.sv-grid-cell',
    fg:             '.sv-grid-cell',
    muted:          '.sv-grid-status-bar',
    border:         '.sv-grid-row > .sv-grid-cell',
    headerBg:       '.sv-grid-head',
    headerFg:       '.sv-grid-header-cell',
    accent:         '.sv-grid-cell-active',
    rowAlt:         '.sv-grid-row:nth-child(even) > .sv-grid-cell',
    rowHover:       '.sv-grid-row:hover > .sv-grid-cell',
    rowHoverFg:     '.sv-grid-row:hover > .sv-grid-cell',
    selectionBg:    '.sv-grid-row-selected > .sv-grid-cell',
    selectionFg:    '.sv-grid-row-selected > .sv-grid-cell',
    focusRing:      '.sv-grid-cell-active',
    pinnedBg:       '.sv-grid-cell[data-pinned]',
    pinnedBorder:   '.sv-grid-cell[data-pinned]',
    pinnedHeaderBg: '.sv-grid-head .sv-grid-column[data-pinned]',
  }
  function tokenSelector(k: string): string {
    return TOKEN_PREVIEW_SELECTOR[k] ?? '.sv-grid-cell'
  }

  type Overrides = Partial<{
    bg: string; fg: string; muted: string; border: string
    headerBg: string; headerFg: string; accent: string
    rowAlt: string; rowHover: string; rowHoverFg: string
    selectionBg: string; selectionFg: string; focusRing: string
    pinnedBg: string; pinnedBorder: string; pinnedHeaderBg: string
  }>
  let overrides = $state<Overrides>({})

  let comparison = $state<boolean>(false)

  // ---- Tokens --------------------------------------------------------
  type Tokens = {
    bg: string; fg: string; muted: string; border: string
    headerBg: string; headerFg: string; accent: string
    rowAlt: string; rowHover: string; rowHoverFg: string
    selectionBg: string; selectionFg: string; focusRing: string
    pinnedBg: string; pinnedBorder: string; pinnedHeaderBg: string
  }
  function autoPalette(brandHex: string, m: 'light' | 'dark'): Tokens {
    const base = hexToHsl(brandHex)
    if (m === 'light') {
      const fg = withL({ h: base.h, s: Math.min(base.s, 20), l: 0 }, 12)
      return {
        bg:          '#ffffff',
        fg,
        muted:       withL({ h: base.h, s: 12, l: 0 }, 45),
        border:      withL({ h: base.h, s: 10, l: 0 }, 90),
        headerBg:    withSL(base, 60, 97),
        headerFg:    withL({ h: base.h, s: Math.min(base.s, 20), l: 0 }, 18),
        accent:      brandHex,
        rowAlt:      withSL(base, 35, 98.5),
        rowHover:    withA(brandHex, 0.07),
        rowHoverFg:  fg,
        selectionBg: withA(brandHex, 0.14),
        selectionFg: fg,
        focusRing:   brandHex,
        pinnedBg:    withSL(base, 30, 99),
        pinnedBorder:withSL(base, 60, 80),
        pinnedHeaderBg: withSL(base, 60, 95),
      }
    }
    const fg = withL({ h: base.h, s: 12, l: 100 }, 92)
    return {
      bg:          withL(base, 8),
      fg,
      muted:       withL(base, 60),
      border:      withL(base, 18),
      headerBg:    withL(base, 12),
      headerFg:    withL(base, 95),
      accent:      withL(base, Math.min(70, base.l + 12)),
      rowAlt:      withL(base, 11),
      rowHover:    withA(brandHex, 0.20),
      rowHoverFg:  fg,
      selectionBg: withA(brandHex, 0.30),
      selectionFg: fg,
      focusRing:   withL(base, 72),
      pinnedBg:    withL(base, 10),
      pinnedBorder:withL(base, 24),
      pinnedHeaderBg: withL(base, 14),
    }
  }
  function tokens(m: 'light' | 'dark'): Tokens {
    const base = autoPalette(brand, m)
    if (tokenMode === 'manual') return { ...base, ...overrides }
    return base
  }
  const lightTokens = $derived(tokens('light'))
  const darkTokens  = $derived(tokens('dark'))
  const activeTokens = $derived(mode === 'light' ? lightTokens : darkTokens)

  function applyPreset(p: Preset) {
    brand = p.brand
    mode = p.mode
    radius = p.radius
    font = p.font
    tokenMode = 'auto'
    overrides = {}
    activePreset = p.id
  }
  function onUserEdit() { activePreset = null }
  function setOverride<K extends keyof Tokens>(key: K, value: string) {
    overrides = { ...overrides, [key]: value }
    onUserEdit()
  }
  function reset() {
    brand = DEFAULTS.brand
    mode = DEFAULTS.mode
    radius = DEFAULTS.radius
    rowHeight = DEFAULTS.rowHeight
    headerHeight = DEFAULTS.headerHeight
    cellPaddingX = DEFAULTS.cellPaddingX
    cellPaddingY = DEFAULTS.cellPaddingY
    borderStyle = DEFAULTS.borderStyle
    borderWidth = DEFAULTS.borderWidth
    font = DEFAULTS.font
    bodyFontSize = DEFAULTS.bodyFontSize
    bodyFontWeight = DEFAULTS.bodyFontWeight
    headerFontWeight = DEFAULTS.headerFontWeight
    headerTransform = DEFAULTS.headerTransform
    headerLetterSpacing = DEFAULTS.headerLetterSpacing
    headerAlign = DEFAULTS.headerAlign
    headerPaddingX = DEFAULTS.headerPaddingX
    headerFontSize = DEFAULTS.headerFontSize
    headerDividerStyle = DEFAULTS.headerDividerStyle
    headerDividerWidth = DEFAULTS.headerDividerWidth
    headerBorderColor  = DEFAULTS.headerBorderColor
    headerDividerColor = DEFAULTS.headerDividerColor
    headerBottomBorderWidth = DEFAULTS.headerBottomBorderWidth
    headerShadow = DEFAULTS.headerShadow
    colDividerStyle = DEFAULTS.colDividerStyle
    colDividerWidth = DEFAULTS.colDividerWidth
    firstColEmphasis = DEFAULTS.firstColEmphasis
    firstColBg = DEFAULTS.firstColBg
    firstColWeight = DEFAULTS.firstColWeight
    altColumns = DEFAULTS.altColumns
    altColumnBg = DEFAULTS.altColumnBg
    colBg = DEFAULTS.colBg
    colFg = DEFAULTS.colFg
    colBorder = DEFAULTS.colBorder
    headerHoverFg = DEFAULTS.headerHoverFg
    headerHoverBg = DEFAULTS.headerHoverBg
    headerHoverShadowSize = DEFAULTS.headerHoverShadowSize
    headerActiveFg = DEFAULTS.headerActiveFg
    headerActiveBg = DEFAULTS.headerActiveBg
    headerActiveBorderColor = DEFAULTS.headerActiveBorderColor
    headerFilterBg = DEFAULTS.headerFilterBg
    horizontalBorderColor = DEFAULTS.horizontalBorderColor
    verticalBorderColor = DEFAULTS.verticalBorderColor
    selectionBorderColor = DEFAULTS.selectionBorderColor
    successBg = DEFAULTS.successBg
    errorBg = DEFAULTS.errorBg
    readOnlyBg = DEFAULTS.readOnlyBg
    editorBorderWidth = DEFAULTS.editorBorderWidth
    editorBorderColor = DEFAULTS.editorBorderColor
    editorFg = DEFAULTS.editorFg
    editorBg = DEFAULTS.editorBg
    editorShadowBlur = DEFAULTS.editorShadowBlur
    editorShadowColor = DEFAULTS.editorShadowColor
    scrollRadius = DEFAULTS.scrollRadius
    scrollTrack = DEFAULTS.scrollTrack
    scrollThumb = DEFAULTS.scrollThumb
    scrollArrow = DEFAULTS.scrollArrow
    zebra = DEFAULTS.zebra
    tokenMode = DEFAULTS.tokenMode
    overrides = {}
    activePreset = null
  }

  // ---- Reset confirmation ------------------------------------------
  // Wrap reset() in a confirm so a misclick can't wipe a long session.
  let resetConfirmOpen = $state<boolean>(false)
  function requestReset() { resetConfirmOpen = true }
  function confirmReset() { reset(); resetConfirmOpen = false }

  // ---- Per-tab reset ---------------------------------------------
  // The Reset Section link on each tab restores just that tab's fields
  // to defaults - users can drop one experiment without losing the rest.
  function clearTokenOverrides(keys: Array<keyof Tokens>) {
    const next: typeof overrides = { ...overrides }
    for (const k of keys) delete next[k]
    overrides = next
  }
  function resetTab(tab: typeof activeTab) {
    if (tab === 'brand') {
      brand = DEFAULTS.brand
      tokenMode = DEFAULTS.tokenMode
      clearTokenOverrides(['bg','fg','muted','border'])
      activePreset = null
    } else if (tab === 'header') {
      headerHeight = DEFAULTS.headerHeight
      headerPaddingX = DEFAULTS.headerPaddingX
      headerFontSize = DEFAULTS.headerFontSize
      headerFontWeight = DEFAULTS.headerFontWeight
      headerTransform = DEFAULTS.headerTransform
      headerLetterSpacing = DEFAULTS.headerLetterSpacing
      headerAlign = DEFAULTS.headerAlign
      headerDividerStyle = DEFAULTS.headerDividerStyle
      headerDividerWidth = DEFAULTS.headerDividerWidth
      headerBorderColor = DEFAULTS.headerBorderColor
      headerBottomBorderWidth = DEFAULTS.headerBottomBorderWidth
      headerShadow = DEFAULTS.headerShadow
      headerHoverFg = DEFAULTS.headerHoverFg
      headerHoverBg = DEFAULTS.headerHoverBg
      headerHoverShadowSize = DEFAULTS.headerHoverShadowSize
      headerActiveFg = DEFAULTS.headerActiveFg
      headerActiveBg = DEFAULTS.headerActiveBg
      headerActiveBorderColor = DEFAULTS.headerActiveBorderColor
      headerFilterBg = DEFAULTS.headerFilterBg
      clearTokenOverrides(['headerBg','headerFg','accent'])
    } else if (tab === 'body') {
      rowHeight = DEFAULTS.rowHeight
      cellPaddingX = DEFAULTS.cellPaddingX
      cellPaddingY = DEFAULTS.cellPaddingY
      bodyFontSize = DEFAULTS.bodyFontSize
      bodyFontWeight = DEFAULTS.bodyFontWeight
      zebra = DEFAULTS.zebra
    } else if (tab === 'rows') {
      clearTokenOverrides(['rowAlt','rowHover','rowHoverFg','selectionBg','selectionFg','focusRing'])
    } else if (tab === 'cells') {
      cellPaddingX = DEFAULTS.cellPaddingX
      cellPaddingY = DEFAULTS.cellPaddingY
      borderStyle = DEFAULTS.borderStyle
      borderWidth = DEFAULTS.borderWidth
      radius = DEFAULTS.radius
      horizontalBorderColor = DEFAULTS.horizontalBorderColor
      verticalBorderColor = DEFAULTS.verticalBorderColor
      selectionBorderColor = DEFAULTS.selectionBorderColor
      successBg = DEFAULTS.successBg
      errorBg = DEFAULTS.errorBg
      readOnlyBg = DEFAULTS.readOnlyBg
      editorBorderWidth = DEFAULTS.editorBorderWidth
      editorBorderColor = DEFAULTS.editorBorderColor
      editorFg = DEFAULTS.editorFg
      editorBg = DEFAULTS.editorBg
      editorShadowBlur = DEFAULTS.editorShadowBlur
      editorShadowColor = DEFAULTS.editorShadowColor
    } else if (tab === 'pinned') {
      clearTokenOverrides(['pinnedBg','pinnedBorder','pinnedHeaderBg'])
    } else if (tab === 'scrollbar') {
      scrollRadius = DEFAULTS.scrollRadius
      scrollTrack = DEFAULTS.scrollTrack
      scrollThumb = DEFAULTS.scrollThumb
      scrollArrow = DEFAULTS.scrollArrow
    } else if (tab === 'type') {
      font = DEFAULTS.font
    }
  }

  // ---- WCAG report ---------------------------------------------------
  type Score = {
    name: string; fg: string; bg: string;
    fgKey: keyof Tokens; bgKey: keyof Tokens;
    ratio: number; level: 'AAA' | 'AA' | 'Fail'; large?: boolean
  }
  function scoresFor(t: Tokens): Score[] {
    const pairs: Array<{ name: string; fgKey: keyof Tokens; bgKey: keyof Tokens; large?: boolean }> = [
      { name: 'Body text',        fgKey: 'fg',       bgKey: 'bg' },
      { name: 'Muted text',       fgKey: 'muted',    bgKey: 'bg' },
      { name: 'Header text',      fgKey: 'headerFg', bgKey: 'headerBg' },
      { name: 'Accent on bg',     fgKey: 'accent',   bgKey: 'bg', large: true },
      { name: 'Text on alt row',  fgKey: 'fg',       bgKey: 'rowAlt' },
      { name: 'Text on pinned',   fgKey: 'fg',       bgKey: 'pinnedBg' },
      { name: 'Header on pinned', fgKey: 'headerFg', bgKey: 'pinnedHeaderBg' },
    ]
    return pairs.map((p) => {
      const fg = t[p.fgKey] as string
      const bg = t[p.bgKey] as string
      const r = contrastRatio(fg, bg)
      return { name: p.name, fg, bg, fgKey: p.fgKey, bgKey: p.bgKey, large: p.large,
               ratio: Math.round(r * 100) / 100, level: wcagLevel(r, p.large ?? false) }
    })
  }
  const activeScores = $derived(scoresFor(activeTokens))

  // ---- WCAG auto-fix --------------------------------------------------
  // Walk the fg color's HSL lightness toward black or white (whichever is
  // already further from bg) one step at a time until the pair clears AA.
  // Returns the new fg hex, or null if even pure black/white doesn't pass.
  function findFixedFg(fg: string, bg: string, large: boolean): string | null {
    const target = large ? 3 : 4.5
    if (contrastRatio(fg, bg) >= target) return fg
    const fgHsl = hexToHsl(fg)
    const bgHsl = hexToHsl(bg)
    // If bg is dark, push fg toward lighter; if bg is light, push toward darker.
    const direction = bgHsl.l < 50 ? +1 : -1
    let bestColor = fg
    let bestRatio = contrastRatio(fg, bg)
    for (let step = 1; step <= 100; step += 1) {
      const newL = Math.max(0, Math.min(100, fgHsl.l + direction * step))
      const candidate = hslToHex({ h: fgHsl.h, s: fgHsl.s, l: newL })
      const ratio = contrastRatio(candidate, bg)
      if (ratio > bestRatio) { bestRatio = ratio; bestColor = candidate }
      if (ratio >= target) return candidate
      if (newL === 0 || newL === 100) break
    }
    return bestRatio >= target ? bestColor : null
  }
  function autoFixScore(score: Score) {
    const fixed = findFixedFg(score.fg, score.bg, score.large ?? false)
    if (!fixed) return
    // Write through smartOverride so we land in manual mode + record undo.
    smartOverride(score.fgKey, fixed)
  }

  // ---- Preview inline style ------------------------------------------
  function styleFor(t: Tokens): string {
    const visibleBorder = borderStyle === 'none' ? 'transparent' : t.border
    return `
      --sg-bg:              ${t.bg};
      --sg-fg:              ${t.fg};
      --sg-muted:           ${t.muted};
      --sg-border:          ${visibleBorder};
      --sg-header-bg:       ${t.headerBg};
      --sg-header-fg:       ${t.headerFg};
      --sg-accent:          ${t.accent};
      --sg-row-hover-bg:    ${t.rowHover};
      --sg-selection-bg:    ${t.selectionBg};
      --sg-focus-ring:      ${t.focusRing};
      --sg-row-alt-bg:      ${zebra ? t.rowAlt : t.bg};
      --sg-pinned-bg:       ${t.pinnedBg};
      --sg-pinned-border:   ${t.pinnedBorder};
      --sg-pinned-header-bg:${t.pinnedHeaderBg};
      --sg-thead-h:         ${headerHeight}px;
      --sg-radius:          ${radius}px;
      font-family:          ${font};
      font-size:            ${bodyFontSize}px;
      font-weight:          ${bodyFontWeight};
      background:           ${t.bg};
      color:                ${t.fg};
      border-radius:        ${radius + 2}px;
      border:               ${borderWidth}px ${borderStyle === 'none' ? 'solid' : borderStyle} ${visibleBorder};
      overflow:             hidden;
    `.replace(/\s+/g, ' ')
  }
  const activeStyle = $derived(styleFor(activeTokens))
  const lightStyle  = $derived(styleFor(lightTokens))
  const darkStyle   = $derived(styleFor(darkTokens))

  // ---- Export -------------------------------------------------------
  type Format = 'css' | 'scss' | 'json' | 'tailwind'
  let format = $state<Format>('css')
  // Diff-mode emits only the tokens the user actually changed from
  // defaults, which is dramatically smaller for a small palette tweak.
  let diffOnly = $state<boolean>(false)

  /** Pull the default palette for the current mode (no overrides). */
  function defaultPalette(): Tokens {
    return autoPalette(DEFAULTS.brand, mode)
  }
  /** Return only the tokens whose value differs from the no-overrides
   *  baseline (default brand color + current mode + no manual overrides).
   *  Geometry / typography defaults come from DEFAULTS directly. */
  type Diff = {
    tokens: Partial<Tokens>
    brand?: string
    mode?: 'light' | 'dark'
    geometry: Partial<typeof DEFAULTS>
  }
  function buildDiff(): Diff {
    const baseTokens = defaultPalette()
    const tokenDiff: Partial<Tokens> = {}
    for (const k of Object.keys(activeTokens) as Array<keyof Tokens>) {
      if (activeTokens[k] !== baseTokens[k]) tokenDiff[k] = activeTokens[k]
    }
    const geometry: Record<string, unknown> = {}
    const geoFields = ['radius','rowHeight','headerHeight','cellPaddingX','cellPaddingY',
      'borderStyle','borderWidth','font','bodyFontSize','bodyFontWeight',
      'headerFontWeight','headerTransform','headerLetterSpacing','headerAlign',
      'headerPaddingX','headerFontSize'] as const
    const current: Record<string, unknown> = {
      radius, rowHeight, headerHeight, cellPaddingX, cellPaddingY,
      borderStyle, borderWidth, font, bodyFontSize, bodyFontWeight,
      headerFontWeight, headerTransform, headerLetterSpacing, headerAlign,
      headerPaddingX, headerFontSize,
    }
    for (const f of geoFields) {
      if (current[f] !== (DEFAULTS as Record<string, unknown>)[f]) geometry[f] = current[f]
    }
    return {
      tokens: tokenDiff,
      brand: brand !== DEFAULTS.brand ? brand : undefined,
      mode:  mode !== DEFAULTS.mode  ? mode  : undefined,
      geometry: geometry as Partial<typeof DEFAULTS>,
    }
  }

  function cssBlock(t: Tokens, m: 'light' | 'dark'): string {
    return (
`[data-theme='${m}'] .my-grid-themed {
  --sg-bg:               ${t.bg};
  --sg-fg:               ${t.fg};
  --sg-muted:            ${t.muted};
  --sg-border:           ${t.border};
  --sg-header-bg:        ${t.headerBg};
  --sg-header-fg:        ${t.headerFg};
  --sg-accent:           ${t.accent};
  --sg-row-alt-bg:       ${zebra ? t.rowAlt : t.bg};
  --sg-row-hover-bg:     ${t.rowHover};
  --sg-selection-bg:     ${t.selectionBg};
  --sg-focus-ring:       ${t.focusRing};
  --sg-pinned-bg:        ${t.pinnedBg};
  --sg-pinned-border:    ${t.pinnedBorder};
  --sg-pinned-header-bg: ${t.pinnedHeaderBg};
  --sg-thead-h:          ${headerHeight}px;
  --sg-radius:           ${radius}px;
  font-family:           ${font};
  font-size:             ${bodyFontSize}px;
  font-weight:           ${bodyFontWeight};
}`)
  }
  /** Compact CSS output: only the tokens that differ from defaults. */
  function cssDiffBlock(): string {
    const d = buildDiff()
    const tokenKeys = Object.keys(d.tokens) as Array<keyof Tokens>
    if (!tokenKeys.length && !Object.keys(d.geometry).length) {
      return '/* No overrides yet - the auto-derived palette matches the default. */'
    }
    const CSS_VAR: Record<string, string> = {
      bg: '--sg-bg', fg: '--sg-fg', muted: '--sg-muted', border: '--sg-border',
      headerBg: '--sg-header-bg', headerFg: '--sg-header-fg', accent: '--sg-accent',
      rowAlt: '--sg-row-alt-bg', rowHover: '--sg-row-hover-bg', rowHoverFg: '--sg-row-hover-fg',
      selectionBg: '--sg-selection-bg', selectionFg: '--sg-selection-fg',
      focusRing: '--sg-focus-ring',
      pinnedBg: '--sg-pinned-bg', pinnedBorder: '--sg-pinned-border', pinnedHeaderBg: '--sg-pinned-header-bg',
    }
    const lines: string[] = ['.my-grid-themed {']
    for (const k of tokenKeys) {
      const css = CSS_VAR[k] ?? '--sg-' + k.toLowerCase()
      lines.push('  ' + css + ': ' + d.tokens[k] + ';')
    }
    if ('radius' in d.geometry)        lines.push('  --sg-radius: ' + d.geometry.radius + 'px;')
    if ('headerHeight' in d.geometry)  lines.push('  --sg-thead-h: ' + d.geometry.headerHeight + 'px;')
    if ('font' in d.geometry)          lines.push('  font-family: ' + d.geometry.font + ';')
    if ('bodyFontSize' in d.geometry)  lines.push('  font-size: ' + d.geometry.bodyFontSize + 'px;')
    if ('bodyFontWeight' in d.geometry) lines.push('  font-weight: ' + d.geometry.bodyFontWeight + ';')
    lines.push('}')
    return lines.join('\n')
  }
  const cssOut = $derived(
    diffOnly
      ? `/* SvGrid theme - only the values you changed (apply on top of defaults) */
${cssDiffBlock()}`
      : `/* SvGrid theme - paste into your global stylesheet */
${cssBlock(lightTokens, 'light')}

${cssBlock(darkTokens, 'dark')}

.my-grid-themed .sv-grid-header-cell {
  font-weight:     ${headerFontWeight};
  text-transform:  ${headerTransform};
  letter-spacing:  ${(headerLetterSpacing / 100).toFixed(2)}em;
}
.my-grid-themed .sv-grid-cell {
  padding:         ${cellPaddingY}px ${cellPaddingX}px;
}`
  )
  function scssBlock(t: Tokens, m: 'light' | 'dark'): string {
    return (
`// ${m}
$sg-bg-${m}:                ${t.bg};
$sg-fg-${m}:                ${t.fg};
$sg-muted-${m}:             ${t.muted};
$sg-border-${m}:            ${t.border};
$sg-header-bg-${m}:         ${t.headerBg};
$sg-header-fg-${m}:         ${t.headerFg};
$sg-accent-${m}:            ${t.accent};
$sg-row-alt-${m}:           ${zebra ? t.rowAlt : t.bg};
$sg-row-hover-${m}:         ${t.rowHover};
$sg-selection-bg-${m}:      ${t.selectionBg};
$sg-focus-ring-${m}:        ${t.focusRing};
$sg-pinned-bg-${m}:         ${t.pinnedBg};
$sg-pinned-border-${m}:     ${t.pinnedBorder};
$sg-pinned-header-bg-${m}:  ${t.pinnedHeaderBg};`)
  }
  const scssOut = $derived(
`${scssBlock(lightTokens, 'light')}

${scssBlock(darkTokens, 'dark')}

$sg-radius:          ${radius}px;
$sg-thead-h:         ${headerHeight}px;
$sg-cell-padding-x:  ${cellPaddingX}px;
$sg-cell-padding-y:  ${cellPaddingY}px;
$sg-border-width:    ${borderWidth}px;
$sg-border-style:    ${borderStyle};
$sg-font:            ${JSON.stringify(font)};
$sg-font-size:       ${bodyFontSize}px;
$sg-body-weight:     ${bodyFontWeight};
$sg-header-weight:   ${headerFontWeight};
$sg-header-tt:       ${headerTransform};
$sg-header-tracking: ${(headerLetterSpacing / 100).toFixed(2)}em;`
  )
  const jsonOut = $derived(
    diffOnly
      ? JSON.stringify(buildDiff(), null, 2)
      : JSON.stringify(
          {
            mode, brand, tokenMode, zebra,
            geometry: { radius, rowHeight, headerHeight, cellPaddingX, cellPaddingY, borderStyle, borderWidth },
            typography: { font, bodyFontSize, bodyFontWeight, headerFontWeight, headerTransform, headerLetterSpacing },
            tokens: { light: lightTokens, dark: darkTokens },
            overrides: tokenMode === 'manual' ? overrides : undefined,
          }, null, 2,
        )
  )
  const tailwindOut = $derived(
`// tailwind.config.{js,ts}
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '${brand}',
          fg:      '${activeTokens.fg}',
          muted:   '${activeTokens.muted}',
          border:  '${activeTokens.border}',
          surface: '${activeTokens.bg}',
          headerBg:'${activeTokens.headerBg}',
          accent:  '${activeTokens.accent}',
          hover:   '${activeTokens.rowHover}',
          select:  '${activeTokens.selectionBg}',
          pinned:  '${activeTokens.pinnedBg}',
        },
      },
      borderRadius: { brand: '${radius}px' },
      fontFamily:   { brand: ['${font.split(',')[0]?.trim() ?? 'Inter'}'] },
      fontSize:     { brand: '${bodyFontSize}px' },
    },
  },
}`)
  const currentOut = $derived(
      format === 'json'     ? jsonOut
    : format === 'tailwind' ? tailwindOut
    : format === 'scss'     ? scssOut
    :                         cssOut,
  )

  // ---- Copy ---------------------------------------------------------
  let copied = $state(false)
  async function copyToClipboard() {
    try { await navigator.clipboard.writeText(currentOut); copied = true; setTimeout(() => (copied = false), 1500) }
    catch (e) { console.warn('[theme-builder] clipboard write failed', e) }
  }

  // ---- Persistence + sharing -----------------------------------------
  const LS_KEY     = 'svgrid-theme-builder-v2'
  const LS_SAVED   = 'svgrid-theme-builder-saved-v1'

  type Snapshot = {
    brand: string; mode: 'light' | 'dark'; radius: number;
    rowHeight: number; headerHeight: number;
    cellPaddingX: number; cellPaddingY: number;
    borderStyle: 'solid' | 'dashed' | 'dotted' | 'none'; borderWidth: number;
    font: string; bodyFontSize: number;
    bodyFontWeight: number;
    headerFontWeight: number;
    headerTransform: 'none' | 'uppercase' | 'capitalize';
    headerLetterSpacing: number;
    headerAlign: 'left' | 'center' | 'right';
    headerPaddingX: number;
    headerFontSize: number;
    headerDividerStyle: 'none' | 'solid' | 'dashed' | 'dotted';
    headerDividerWidth: number;
    headerBorderColor: string;
    headerDividerColor: string;
    headerBottomBorderWidth: number;
    headerShadow: boolean;
    colDividerStyle: 'none' | 'solid' | 'dashed' | 'dotted';
    colDividerWidth: number;
    firstColEmphasis: boolean;
    firstColBg: string;
    firstColWeight: number;
    altColumns: boolean;
    altColumnBg: string;
    colBg: string;
    colFg: string;
    colBorder: string;
    headerHoverFg: string;
    headerHoverBg: string;
    headerHoverShadowSize: number;
    headerActiveFg: string;
    headerActiveBg: string;
    headerActiveBorderColor: string;
    headerFilterBg: string;
    horizontalBorderColor: string;
    verticalBorderColor: string;
    selectionBorderColor: string;
    successBg: string;
    errorBg: string;
    readOnlyBg: string;
    editorBorderWidth: number;
    editorBorderColor: string;
    editorFg: string;
    editorBg: string;
    editorShadowBlur: number;
    editorShadowColor: string;
    scrollRadius: number;
    scrollTrack: string;
    scrollThumb: string;
    scrollArrow: string;
    zebra: boolean; tokenMode: 'auto' | 'manual';
    overrides: Overrides;
  }
  function snapshot(): Snapshot {
    return {
      brand, mode, radius,
      rowHeight, headerHeight,
      cellPaddingX, cellPaddingY,
      borderStyle, borderWidth,
      font, bodyFontSize, bodyFontWeight, headerFontWeight, headerTransform, headerLetterSpacing,
      headerAlign, headerPaddingX, headerFontSize,
      headerDividerStyle, headerDividerWidth, headerBorderColor, headerDividerColor, headerBottomBorderWidth, headerShadow,
      colDividerStyle, colDividerWidth,
      firstColEmphasis, firstColBg, firstColWeight,
      altColumns, altColumnBg,
      colBg, colFg, colBorder,
      headerHoverFg, headerHoverBg, headerHoverShadowSize,
      headerActiveFg, headerActiveBg, headerActiveBorderColor, headerFilterBg,
      horizontalBorderColor, verticalBorderColor, selectionBorderColor,
      successBg, errorBg, readOnlyBg,
      editorBorderWidth, editorBorderColor, editorFg, editorBg, editorShadowBlur, editorShadowColor,
      scrollRadius, scrollTrack, scrollThumb, scrollArrow,
      zebra, tokenMode, overrides,
    }
  }
  function restore(s: Partial<Snapshot>) {
    brand            = s.brand ?? DEFAULTS.brand
    mode             = s.mode ?? DEFAULTS.mode
    radius           = s.radius ?? DEFAULTS.radius
    rowHeight        = s.rowHeight ?? DEFAULTS.rowHeight
    headerHeight     = s.headerHeight ?? DEFAULTS.headerHeight
    cellPaddingX     = s.cellPaddingX ?? DEFAULTS.cellPaddingX
    cellPaddingY     = s.cellPaddingY ?? DEFAULTS.cellPaddingY
    borderStyle      = s.borderStyle ?? DEFAULTS.borderStyle
    borderWidth      = s.borderWidth ?? DEFAULTS.borderWidth
    font             = s.font ?? DEFAULTS.font
    bodyFontSize     = s.bodyFontSize ?? DEFAULTS.bodyFontSize
    bodyFontWeight   = s.bodyFontWeight ?? DEFAULTS.bodyFontWeight
    headerFontWeight = s.headerFontWeight ?? DEFAULTS.headerFontWeight
    headerTransform  = s.headerTransform ?? DEFAULTS.headerTransform
    headerLetterSpacing = s.headerLetterSpacing ?? DEFAULTS.headerLetterSpacing
    headerAlign      = s.headerAlign ?? DEFAULTS.headerAlign
    headerPaddingX   = s.headerPaddingX ?? DEFAULTS.headerPaddingX
    headerFontSize   = s.headerFontSize ?? DEFAULTS.headerFontSize
    headerDividerStyle = s.headerDividerStyle ?? DEFAULTS.headerDividerStyle
    headerDividerWidth = s.headerDividerWidth ?? DEFAULTS.headerDividerWidth
    headerBorderColor  = s.headerBorderColor  ?? DEFAULTS.headerBorderColor
    headerDividerColor = s.headerDividerColor ?? DEFAULTS.headerDividerColor
    headerBottomBorderWidth = s.headerBottomBorderWidth ?? DEFAULTS.headerBottomBorderWidth
    headerShadow     = s.headerShadow ?? DEFAULTS.headerShadow
    colDividerStyle  = s.colDividerStyle ?? DEFAULTS.colDividerStyle
    colDividerWidth  = s.colDividerWidth ?? DEFAULTS.colDividerWidth
    firstColEmphasis = s.firstColEmphasis ?? DEFAULTS.firstColEmphasis
    firstColBg       = s.firstColBg ?? DEFAULTS.firstColBg
    firstColWeight   = s.firstColWeight ?? DEFAULTS.firstColWeight
    altColumns       = s.altColumns ?? DEFAULTS.altColumns
    altColumnBg      = s.altColumnBg ?? DEFAULTS.altColumnBg
    colBg            = s.colBg ?? DEFAULTS.colBg
    colFg            = s.colFg ?? DEFAULTS.colFg
    colBorder        = s.colBorder ?? DEFAULTS.colBorder
    headerHoverFg    = s.headerHoverFg ?? DEFAULTS.headerHoverFg
    headerHoverBg    = s.headerHoverBg ?? DEFAULTS.headerHoverBg
    headerHoverShadowSize = s.headerHoverShadowSize ?? DEFAULTS.headerHoverShadowSize
    headerActiveFg   = s.headerActiveFg ?? DEFAULTS.headerActiveFg
    headerActiveBg   = s.headerActiveBg ?? DEFAULTS.headerActiveBg
    headerActiveBorderColor = s.headerActiveBorderColor ?? DEFAULTS.headerActiveBorderColor
    headerFilterBg   = s.headerFilterBg ?? DEFAULTS.headerFilterBg
    horizontalBorderColor = s.horizontalBorderColor ?? DEFAULTS.horizontalBorderColor
    verticalBorderColor   = s.verticalBorderColor ?? DEFAULTS.verticalBorderColor
    selectionBorderColor  = s.selectionBorderColor ?? DEFAULTS.selectionBorderColor
    successBg        = s.successBg ?? DEFAULTS.successBg
    errorBg          = s.errorBg ?? DEFAULTS.errorBg
    readOnlyBg       = s.readOnlyBg ?? DEFAULTS.readOnlyBg
    editorBorderWidth = s.editorBorderWidth ?? DEFAULTS.editorBorderWidth
    editorBorderColor = s.editorBorderColor ?? DEFAULTS.editorBorderColor
    editorFg         = s.editorFg ?? DEFAULTS.editorFg
    editorBg         = s.editorBg ?? DEFAULTS.editorBg
    editorShadowBlur = s.editorShadowBlur ?? DEFAULTS.editorShadowBlur
    editorShadowColor = s.editorShadowColor ?? DEFAULTS.editorShadowColor
    scrollRadius     = s.scrollRadius ?? DEFAULTS.scrollRadius
    scrollTrack      = s.scrollTrack ?? DEFAULTS.scrollTrack
    scrollThumb      = s.scrollThumb ?? DEFAULTS.scrollThumb
    scrollArrow      = s.scrollArrow ?? DEFAULTS.scrollArrow
    zebra            = s.zebra ?? DEFAULTS.zebra
    tokenMode        = s.tokenMode ?? DEFAULTS.tokenMode
    overrides        = s.overrides ?? {}
    activePreset     = null
  }
  function loadFromUrl(): Partial<Snapshot> | null {
    try {
      const u = new URL(window.location.href)
      const t = u.searchParams.get('t') || u.hash.match(/[?&]t=([^&]+)/)?.[1]
      if (!t) return null
      return JSON.parse(atob(decodeURIComponent(t))) as Partial<Snapshot>
    } catch { return null }
  }
  function loadFromStorage(): Partial<Snapshot> | null {
    try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null }
    catch { return null }
  }
  $effect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(snapshot())) } catch {}
  })

  // ---- Undo / Redo history ------------------------------------------
  // Keep the last 30 snapshots so Ctrl-Z restores. We snapshot AFTER each
  // state change so the current state is always at history[historyIndex].
  // A short debounce coalesces slider-drag bursts into one history entry.
  const HISTORY_LIMIT = 30
  let history    = $state<Snapshot[]>([])
  let historyIndex = $state<number>(-1)
  let suppressHistory = $state<boolean>(false)   // true while applying undo/redo
  let historyTimer: ReturnType<typeof setTimeout> | null = null

  function pushHistory() {
    if (suppressHistory) return
    if (historyTimer) clearTimeout(historyTimer)
    historyTimer = setTimeout(() => {
      const snap = snapshot()
      const last = history[historyIndex]
      if (last && JSON.stringify(last) === JSON.stringify(snap)) return
      // Drop any redo branch above the cursor when a new change lands.
      const trimmed = history.slice(0, historyIndex + 1)
      trimmed.push(snap)
      if (trimmed.length > HISTORY_LIMIT) trimmed.shift()
      history = trimmed
      historyIndex = trimmed.length - 1
    }, 200)
  }
  function undo() {
    if (historyIndex <= 0) return
    suppressHistory = true
    historyIndex -= 1
    restore(history[historyIndex]!)
    queueMicrotask(() => (suppressHistory = false))
  }
  function redo() {
    if (historyIndex >= history.length - 1) return
    suppressHistory = true
    historyIndex += 1
    restore(history[historyIndex]!)
    queueMicrotask(() => (suppressHistory = false))
  }
  const canUndo = $derived(historyIndex > 0)
  const canRedo = $derived(historyIndex < history.length - 1)

  // Auto-record every state change.
  $effect(() => {
    // Touch a representative slice of state so this effect re-runs on edits.
    // Reading snapshot() pulls every reactive token in one place.
    void snapshot()
    pushHistory()
  })

  // Keyboard shortcuts. Mod = Ctrl on Windows/Linux, Cmd on macOS.
  let shortcutsOpen = $state<boolean>(false)
  $effect(() => {
    if (typeof window === 'undefined') return
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      // Don't intercept inside text inputs the user is actively editing.
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      // Esc closes the shortcuts overlay regardless of focus.
      if (key === 'escape' && shortcutsOpen) { e.preventDefault(); shortcutsOpen = false; return }

      // Mod-keyed bindings (undo/redo/save) work even from inside fields.
      if (mod) {
        if (key === 'z' && !e.shiftKey)         { e.preventDefault(); undo() }
        else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo() }
        return
      }

      // Single-key bindings only when not typing in a field.
      if (inField) return
      // 1-8 jump to a tab. TABS is declared below in module scope so look
      // it up via the active list directly to stay in sync.
      if (/^[1-8]$/.test(e.key)) {
        const idx = Number(e.key) - 1
        const tab = TABS[idx]
        if (tab) { e.preventDefault(); activeTab = tab.id }
        return
      }
      if (e.key === '?' || (e.shiftKey && key === '/')) {
        e.preventDefault(); shortcutsOpen = !shortcutsOpen
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Saved themes (named, in localStorage)
  type SavedTheme = { name: string; createdAt: number; snapshot: Snapshot }
  let savedThemes = $state<SavedTheme[]>([])
  let saveName    = $state<string>('')
  function loadSavedFromStorage(): SavedTheme[] {
    try { const raw = localStorage.getItem(LS_SAVED); return raw ? JSON.parse(raw) : [] }
    catch { return [] }
  }
  function persistSaved() {
    try { localStorage.setItem(LS_SAVED, JSON.stringify(savedThemes)) } catch {}
  }
  function saveCurrent() {
    const n = saveName.trim()
    if (!n) return
    const next: SavedTheme = { name: n, createdAt: Date.now(), snapshot: snapshot() }
    const existing = savedThemes.findIndex((s) => s.name === n)
    if (existing >= 0) savedThemes[existing] = next
    else savedThemes = [...savedThemes, next]
    persistSaved()
    saveName = ''
  }
  function loadSaved(t: SavedTheme) { restore(t.snapshot) }
  function deleteSaved(name: string) {
    savedThemes = savedThemes.filter((s) => s.name !== name)
    persistSaved()
  }

  let shareCopied = $state<boolean>(false)
  async function share() {
    const t = btoa(JSON.stringify(snapshot()))
    const u = new URL(window.location.href)
    u.searchParams.set('t', t)
    try {
      await navigator.clipboard.writeText(u.toString())
      shareCopied = true; setTimeout(() => (shareCopied = false), 1500)
    } catch {}
  }

  // ---- Import: paste CSS, parse known tokens -------------------------
  let importOpen = $state<boolean>(false)
  let importText = $state<string>('')
  let importMsg  = $state<string>('')
  function importFromCss() {
    if (!importText.trim()) return
    const grab = (key: string): string | null => {
      const m = importText.match(new RegExp(`--sg-${key}\\s*:\\s*([^;]+);`))
      return m ? m[1]!.trim() : null
    }
    const map: Array<[keyof Tokens, string]> = [
      ['bg', 'bg'], ['fg', 'fg'], ['muted', 'muted'], ['border', 'border'],
      ['headerBg', 'header-bg'], ['headerFg', 'header-fg'], ['accent', 'accent'],
      ['rowAlt', 'row-alt-bg'], ['rowHover', 'row-hover-bg'], ['selectionBg', 'selection-bg'],
      ['focusRing', 'focus-ring'],
      ['pinnedBg', 'pinned-bg'], ['pinnedBorder', 'pinned-border'], ['pinnedHeaderBg', 'pinned-header-bg'],
    ]
    let found = 0
    const next: Overrides = {}
    for (const [k, css] of map) {
      const v = grab(css)
      if (v && /^#[0-9a-f]{6}/i.test(v)) { next[k] = v.slice(0, 7); found += 1 }
    }
    const rad = importText.match(/--sg-radius\s*:\s*(\d+)px/)
    if (rad) radius = parseInt(rad[1]!, 10)
    if (found > 0) {
      overrides = { ...overrides, ...next }
      tokenMode = 'manual'
      activePreset = null
      importMsg = `Imported ${found} token${found === 1 ? '' : 's'}.`
    } else {
      importMsg = 'No --sg-* tokens found in pasted CSS.'
    }
    setTimeout(() => (importMsg = ''), 3500)
  }

  // ---- Hydrate ------------------------------------------------------
  onMount(() => {
    savedThemes = loadSavedFromStorage()
    const fromUrl = loadFromUrl()
    if (fromUrl) { restore(fromUrl); return }
    const fromLs = loadFromStorage()
    if (fromLs) restore(fromLs)
  })

  // ---- Dynamic CSS injection -----------------------------------------
  /** Cell padding, header font weight / text-transform / letter-spacing
   *  and header height need actual CSS rules targeting `.sv-grid-cell` /
   *  `.sv-grid-header-cell` - inline style on the wrap doesn't reach
   *  those selectors. We keep a single style element (id=tb-live-styles)
   *  in the document head, scoped to `.tb-live-instance`, and re-write
   *  its textContent every time any of these inputs change. */
  let styleEl: HTMLStyleElement | null = null
  onMount(() => {
    styleEl = document.createElement('style')
    styleEl.id = 'tb-live-styles'
    document.head.appendChild(styleEl)
    return () => { if (styleEl) styleEl.remove(); styleEl = null }
  })
  $effect(() => {
    if (!styleEl) return
    const ls = (headerLetterSpacing / 100).toFixed(2)
    // Bottom-border tint (single horizontal line under the header row).
    const borderTint  = headerBorderColor || activeTokens.border
    // Divider tint (vertical line between header cells). Defaults to the
    // bottom-border color so picking just one looks consistent; users
    // override here for an independent divider color.
    const dividerTint = headerDividerColor || borderTint
    // If the user picked a divider color, auto-promote the style to solid
    // 1px so the color is visible even though the Divider style dropdown
    // defaults to 'none'. Without this, picking only a color emits
    // `border-right: none` and the color silently does nothing.
    const dividerStyle = headerDividerStyle === 'none' && headerDividerColor
      ? 'solid'
      : headerDividerStyle
    const dividerWidth = dividerStyle === 'none' ? 0 : Math.max(headerDividerWidth, 1)
    const headerDivider = dividerStyle === 'none'
      ? 'none'
      : dividerWidth + 'px ' + dividerStyle + ' ' + dividerTint
    const headerBottom = headerBottomBorderWidth === 0
      ? 'none'
      : headerBottomBorderWidth + 'px solid ' + borderTint
    const headerShadowCss = headerShadow ? '0 2px 6px rgba(0,0,0,0.10)' : 'none'
    // String-concat builds CSS - template literals with literal {}
    // confuse the svelte preprocessor.
    const parts: string[] = []
    // ---- Body cells: paint background + text directly ---------------
    // SvGrid hardcodes `.sv-grid-cell { background: #fff }` so the
    // --sg-bg variable never reaches a body cell. We override here so the
    // user's bg/fg picks actually take effect on every non-special cell.
    parts.push('.tb-live-instance .sv-grid-cell ')
    parts.push('{ padding: ' + cellPaddingY + 'px ' + cellPaddingX + 'px !important; ')
    parts.push('font-size: ' + bodyFontSize + 'px; ')
    parts.push('font-weight: ' + bodyFontWeight + '; ')
    parts.push('background: ' + activeTokens.bg + ' !important; ')
    parts.push('color: ' + activeTokens.fg + ' !important; }')

    // ---- Row state cascade -----------------------------------------
    // Every rule below uses `.sv-grid-table` in the chain to land at
    // specificity (0,5,0) - higher than the website's global zebra rule
    // `.sv-grid-table tbody tr:nth-child(even) .sv-grid-cell` (0,4,2),
    // and all equal to each other so source order decides between them:
    // alt -> hover -> selected.
    parts.push(' .tb-live-instance .sv-grid-table .sv-grid-row:nth-child(even) > .sv-grid-cell ')
    parts.push('{ background: ' + activeTokens.rowAlt + ' !important; }')

    parts.push(' .tb-live-instance .sv-grid-table .sv-grid-row:hover > .sv-grid-cell ')
    parts.push('{ background: ' + activeTokens.rowHover + ' !important; ')
    parts.push('color: ' + activeTokens.rowHoverFg + ' !important; }')

    // Selection MUST come after alt + hover so it wins at equal
    // specificity. The grid library hardcodes selected-row bg to
    // #eaf2ff; this override paints the brand selection color.
    // Three flavours of selection live here:
    //   1. .sv-grid-row-selected  - whole row selection (checkbox / row mode)
    //   2. [data-selected-range]  - cell range (shift-click / drag)
    //   3. .sv-grid-cell-active   - the keyboard-focused single cell
    parts.push(' .tb-live-instance .sv-grid-table .sv-grid-row.sv-grid-row-selected > .sv-grid-cell, ')
    parts.push(' .tb-live-instance .sv-grid-table .sv-grid-row > .sv-grid-cell[data-selected-range="true"], ')
    parts.push(' .tb-live-instance .sv-grid-table .sv-grid-row > .sv-grid-cell.sv-grid-cell-active ')
    parts.push('{ background: ' + activeTokens.selectionBg + ' !important; ')
    parts.push('color: ' + activeTokens.selectionFg + ' !important; }')

    // ---- Status bar (footer) -------------------------------------
    // The status bar uses --sg-header-bg as background which we already
    // override above, but the text color falls through to --sg-fg and
    // the border defaults to --sg-border, so re-bind here for clarity.
    parts.push(' .tb-live-instance .sv-grid-status-bar ')
    parts.push('{ background: ' + activeTokens.headerBg + ' !important; ')
    parts.push('color: ' + activeTokens.fg + ' !important; ')
    parts.push('border-color: ' + activeTokens.border + ' !important; }')

    // ---- Resize handle accent ------------------------------------
    // Hardcoded `rgba(11, 99, 243, 0.3)` in the library - rebind to the
    // brand accent so the column-resize affordance matches.
    parts.push(' .tb-live-instance .sv-grid-resize-handle:hover, ')
    parts.push(' .tb-live-instance .sv-grid-resize-handle.is-resizing ')
    parts.push('{ background: ' + activeTokens.accent + ' !important; }')
    parts.push(' .tb-live-instance .sv-grid-header-cell ')
    parts.push('{ font-weight: ' + headerFontWeight + ' !important; ')
    parts.push('text-transform: ' + headerTransform + ' !important; ')
    parts.push('letter-spacing: ' + ls + 'em !important; ')
    parts.push('min-height: ' + headerHeight + 'px; ')
    parts.push('height: ' + headerHeight + 'px; ')
    parts.push('padding: 0 ' + headerPaddingX + 'px !important; ')
    parts.push('font-size: ' + headerFontSize + 'px !important; ')
    parts.push('justify-content: ' + (headerAlign === 'left' ? 'flex-start' : headerAlign === 'right' ? 'flex-end' : 'center') + ' !important; ')
    parts.push('text-align: ' + headerAlign + ' !important; }')
    // Vertical divider lives on the <th> itself (.sv-grid-column) so it
    // spans the full column height and aligns flush with the cell edges.
    parts.push(' .tb-live-instance .sv-grid-header-row > .sv-grid-column ')
    parts.push('{ border-right: ' + headerDivider + ' !important; }')
    parts.push(' .tb-live-instance .sv-grid-header-row > .sv-grid-column:last-child { border-right: none !important; }')
    parts.push(' .tb-live-instance .sv-grid-head ')
    parts.push('{ min-height: ' + headerHeight + 'px; ')
    // SvGrid hardcodes the head background to #f5f7fb and ignores
    // --sg-header-bg there - so we paint it explicitly. Same for the
    // text color: there is no --sg-header-fg consumer in SvGrid at all.
    parts.push('background: ' + activeTokens.headerBg + ' !important; ')
    parts.push('color: ' + activeTokens.headerFg + ' !important; ')
    parts.push('box-shadow: ' + headerShadowCss + '; }')
    // Each <th> needs the same background or sticky/hover states from the
    // grid library can paint over the thead. Inner div carries the color
    // so text inheritance reaches .sv-grid-header-label.
    parts.push(' .tb-live-instance .sv-grid-header-row > .sv-grid-column ')
    parts.push('{ background: ' + activeTokens.headerBg + ' !important; ')
    parts.push('color: ' + activeTokens.headerFg + ' !important; }')
    parts.push(' .tb-live-instance .sv-grid-header-row .sv-grid-header-cell ')
    parts.push('{ color: ' + activeTokens.headerFg + ' !important; }')
    // Paint the bottom border on the <th> itself (.sv-grid-column inside
    // .sv-grid-header-row). The inner .sv-grid-header-cell div sits within
    // the cell's padding so its border stops short of the column edges
    // and looks fragmented.
    parts.push(' .tb-live-instance .sv-grid-header-row > .sv-grid-column ')
    parts.push('{ border-bottom: ' + headerBottom + ' !important; }')
    parts.push(' .tb-live-instance .sv-grid-header-label ')
    parts.push('{ text-align: ' + headerAlign + ' !important; ')
    parts.push('text-transform: ' + headerTransform + ' !important; ')
    parts.push('letter-spacing: ' + ls + 'em !important; ')
    parts.push('font-weight: ' + headerFontWeight + ' !important; ')
    parts.push('width: 100%; }')

    // ---- Column-level rules ----------------------------------------
    // Body cell background + text overrides (apply per-column body colors).
    if (colBg || colFg) {
      parts.push(' .tb-live-instance .sv-grid-row > .sv-grid-cell ')
      parts.push('{ ')
      if (colBg) parts.push('background: ' + colBg + ' !important; ')
      if (colFg) parts.push('color: ' + colFg + ' !important; ')
      parts.push('}')
    }
    // Vertical body divider between cells (parallel to header divider).
    if (colDividerStyle !== 'none' && colDividerWidth > 0) {
      const dividerColor = colBorder || activeTokens.border
      parts.push(' .tb-live-instance .sv-grid-row > .sv-grid-cell ')
      parts.push('{ border-right: ' + colDividerWidth + 'px ' + colDividerStyle + ' ' + dividerColor + ' !important; }')
      parts.push(' .tb-live-instance .sv-grid-row > .sv-grid-cell:last-child { border-right: none !important; }')
    }
    // First-column emphasis - bold text + tinted bg.
    if (firstColEmphasis) {
      parts.push(' .tb-live-instance .sv-grid-row > .sv-grid-cell:first-child ')
      parts.push('{ background: ' + firstColBg + ' !important; ')
      parts.push('font-weight: ' + firstColWeight + ' !important; }')
    }
    // Alternating columns (zebra by column index, every 2nd cell).
    if (altColumns) {
      parts.push(' .tb-live-instance .sv-grid-row > .sv-grid-cell:nth-child(even) ')
      parts.push('{ background: ' + altColumnBg + ' !important; }')
    }


    // ---- Header state: highlighted (hover) -------------------------
    if (headerHoverBg || headerHoverFg || headerHoverShadowSize > 0) {
      parts.push(' .tb-live-instance .sv-grid-header-cell:hover ')
      parts.push('{ ')
      if (headerHoverBg) parts.push('background: ' + headerHoverBg + ' !important; ')
      if (headerHoverFg) parts.push('color: ' + headerHoverFg + ' !important; ')
      if (headerHoverShadowSize > 0) parts.push('box-shadow: 0 0 0 ' + headerHoverShadowSize + 'px ' + (headerHoverBg || activeTokens.accent) + ' inset; ')
      parts.push('}')
    }
    // ---- Header state: active --------------------------------------
    // "Active" means a column header that's currently sorted (aria-sort
    // ascending/descending on the <th>) OR has keyboard / mouse focus on
    // its sort button. We catch both so the user gets immediate visual
    // feedback when clicking a header, even before sorting changes the
    // aria-sort attribute. aria-sort is set on the <th> (.sv-grid-column)
    // via getGridHeaderA11yProps, NOT the inner .sv-grid-header-cell div.
    if (headerActiveBg || headerActiveFg || headerActiveBorderColor) {
      const activeSel =
        ' .tb-live-instance .sv-grid-header-row > .sv-grid-column[aria-sort="ascending"], ' +
        ' .tb-live-instance .sv-grid-header-row > .sv-grid-column[aria-sort="descending"], ' +
        ' .tb-live-instance .sv-grid-header-row > .sv-grid-column:has(.sv-grid-header-sort:focus), ' +
        ' .tb-live-instance .sv-grid-header-row > .sv-grid-column:has(.sv-grid-header-sort:active) '
      parts.push(activeSel + '{ ')
      if (headerActiveBg) parts.push('background: ' + headerActiveBg + ' !important; ')
      if (headerActiveFg) parts.push('color: ' + headerActiveFg + ' !important; ')
      if (headerActiveBorderColor) parts.push('border-bottom-color: ' + headerActiveBorderColor + ' !important; ')
      parts.push('}')
      // The inner content div carries the text - paint its color too so
      // the foreground change propagates to the header label.
      if (headerActiveFg) {
        parts.push(' .tb-live-instance .sv-grid-column[aria-sort="ascending"] .sv-grid-header-cell, ')
        parts.push(' .tb-live-instance .sv-grid-column[aria-sort="descending"] .sv-grid-header-cell, ')
        parts.push(' .tb-live-instance .sv-grid-column[aria-sort="ascending"] .sv-grid-header-label, ')
        parts.push(' .tb-live-instance .sv-grid-column[aria-sort="descending"] .sv-grid-header-label ')
        parts.push('{ color: ' + headerActiveFg + ' !important; }')
      }
    }
    // ---- Header state: filtered column ----------------------------
    if (headerFilterBg) {
      parts.push(' .tb-live-instance .sv-grid-header-cell.is-filtered, ')
      parts.push(' .tb-live-instance .sv-grid-header-cell:has(.sv-grid-col-filter-btn.is-active) ')
      parts.push('{ background: ' + headerFilterBg + ' !important; }')
    }

    // ---- Cell borders (state-organized) ----------------------------
    if (horizontalBorderColor) {
      parts.push(' .tb-live-instance .sv-grid-row > .sv-grid-cell ')
      parts.push('{ border-bottom-color: ' + horizontalBorderColor + ' !important; }')
    }
    if (verticalBorderColor) {
      parts.push(' .tb-live-instance .sv-grid-row > .sv-grid-cell ')
      parts.push('{ border-right-color: ' + verticalBorderColor + ' !important; }')
    }
    // The library hardcodes `.sv-grid-cell-active { box-shadow: inset 0 0 0
    // 2px #0b63f3 }` so the ring stays blue regardless of brand. Always
    // emit the override - default to the brand accent when the user hasn't
    // picked a specific color so the ring at least matches the theme.
    {
      const ringColor = selectionBorderColor || activeTokens.accent
      parts.push(' .tb-live-instance .sv-grid-cell-active, ')
      parts.push(' .tb-live-instance .sv-grid-cell-editing ')
      parts.push('{ box-shadow: inset 0 0 0 2px ' + ringColor + ' !important; }')
      // Range selection (shift-click / drag) draws its border from four
      // hardcoded inset box-shadows on [data-range-top/bottom/left/right]
      // cells (also #0b63f3). Re-define each per-edge custom property with
      // the chosen ring color so the range outline follows the theme.
      parts.push(' .tb-live-instance .sv-grid-cell[data-range-top="true"] ')
      parts.push('{ --sv-range-top: inset 0 2px 0 ' + ringColor + ' !important; }')
      parts.push(' .tb-live-instance .sv-grid-cell[data-range-bottom="true"] ')
      parts.push('{ --sv-range-bottom: inset 0 -2px 0 ' + ringColor + ' !important; }')
      parts.push(' .tb-live-instance .sv-grid-cell[data-range-left="true"] ')
      parts.push('{ --sv-range-left: inset 2px 0 0 ' + ringColor + ' !important; }')
      parts.push(' .tb-live-instance .sv-grid-cell[data-range-right="true"] ')
      parts.push('{ --sv-range-right: inset -2px 0 0 ' + ringColor + ' !important; }')
    }

    // ---- Cell semantic states --------------------------------------
    if (successBg) {
      parts.push(' .tb-live-instance .sv-grid-cell.success ')
      parts.push('{ background: ' + successBg + ' !important; }')
    }
    if (errorBg) {
      parts.push(' .tb-live-instance .sv-grid-cell.error ')
      parts.push('{ background: ' + errorBg + ' !important; }')
    }
    if (readOnlyBg) {
      parts.push(' .tb-live-instance .sv-grid-cell.readonly, ')
      parts.push(' .tb-live-instance .sv-grid-cell[aria-readonly="true"] ')
      parts.push('{ background: ' + readOnlyBg + ' !important; }')
    }

    // ---- Editor (in-cell edit state) -------------------------------
    if (editorBg || editorFg || editorBorderColor || editorShadowColor) {
      const editorShadow = editorShadowColor
        ? '0 0 ' + editorShadowBlur + 'px ' + editorShadowColor
        : 'none'
      parts.push(' .tb-live-instance .sv-grid-cell-editor ')
      parts.push('{ ')
      if (editorBg) parts.push('background: ' + editorBg + ' !important; ')
      if (editorFg) parts.push('color: ' + editorFg + ' !important; ')
      if (editorBorderColor) parts.push('border: ' + editorBorderWidth + 'px solid ' + editorBorderColor + ' !important; ')
      if (editorShadowColor) parts.push('box-shadow: ' + editorShadow + ' !important; ')
      parts.push('}')
    }

    // ---- Scrollbar -------------------------------------------------
    // SvGrid replaces native scrollbars with a custom <sv-grid-scrollbar>
    // web component (shadow DOM). It exposes --sg-scrollbar-bg /
    // --sg-scrollbar-thumb / --sg-scrollbar-thumb-radius as CSS variables
    // we can set on the wrapping element to recolor. We always emit
    // palette-derived defaults so light/dark mode flips reach the
    // scrollbar - if we only emitted when the user explicitly picked a
    // color, the custom element's hardcoded #eef2f8 light defaults
    // stayed across the mode switch.
    {
      const track = scrollTrack || activeTokens.headerBg
      const thumb = scrollThumb || activeTokens.muted
      const arrow = scrollArrow || activeTokens.muted
      parts.push(' .tb-live-instance { ')
      parts.push('--sg-scrollbar-bg: ' + track + '; ')
      parts.push('--sg-scrollbar-border: ' + activeTokens.border + '; ')
      parts.push('--sg-scrollbar-thumb: ' + thumb + '; ')
      parts.push('--sg-scrollbar-thumb-hover: ' + thumb + '; ')
      parts.push('--sg-scrollbar-thumb-active: ' + thumb + '; ')
      parts.push('--sg-scrollbar-arrow: ' + arrow + '; ')
      parts.push('--sg-scrollbar-arrow-hover: ' + arrow + '; ')
      parts.push('--sg-scrollbar-arrow-active: ' + arrow + '; ')
      parts.push('--sg-scrollbar-arrow-disabled: ' + arrow + '; ')
      parts.push('--sg-scrollbar-arrow-hover-bg: ' + activeTokens.rowHover + '; ')
      parts.push('--sg-scrollbar-arrow-active-bg: ' + activeTokens.selectionBg + '; ')
      parts.push('--sg-scrollbar-thumb-radius: ' + scrollRadius + 'px; ')
      parts.push('}')
    }

    // ---- Popovers + group + note ----------------------------------
    // These elements portal to document.body so they live OUTSIDE
    // .tb-live-instance and miss our scoped rules. The styleEl mounts
    // only on the theme-builder route, so emitting unscoped overrides
    // here is safe: when the user leaves /theme-builder the styleEl
    // unmounts and these rules disappear with it.

    // Column menu + filter menu popover
    parts.push(' .sv-grid-menu ')
    parts.push('{ background: ' + activeTokens.bg + ' !important; ')
    parts.push('color: ' + activeTokens.fg + ' !important; ')
    parts.push('border-color: ' + activeTokens.border + ' !important; }')
    parts.push(' .sv-grid-menu-item:hover ')
    parts.push('{ background: ' + activeTokens.rowHover + ' !important; ')
    parts.push('color: ' + activeTokens.rowHoverFg + ' !important; }')
    parts.push(' .sv-grid-menu-item[aria-checked="true"] ')
    parts.push('{ background: ' + activeTokens.selectionBg + ' !important; ')
    parts.push('color: ' + activeTokens.accent + ' !important; }')
    parts.push(' .sv-grid-menu-sep { background: ' + activeTokens.border + ' !important; }')
    parts.push(' .sv-grid-menu-search, .sv-grid-menu-condition-value, .sv-grid-menu-operator ')
    parts.push('{ background: ' + activeTokens.bg + ' !important; ')
    parts.push('color: ' + activeTokens.fg + ' !important; ')
    parts.push('border-color: ' + activeTokens.border + ' !important; }')
    parts.push(' .sv-grid-menu-operator-btn ')
    parts.push('{ background: ' + activeTokens.bg + ' !important; ')
    parts.push('color: ' + activeTokens.fg + ' !important; ')
    parts.push('border-color: ' + activeTokens.border + ' !important; }')
    parts.push(' .sv-grid-menu-operator-btn:hover { background: ' + activeTokens.rowHover + ' !important; }')
    parts.push(' .sv-grid-menu-operator-btn.is-active ')
    parts.push('{ background: ' + activeTokens.accent + ' !important; ')
    parts.push('color: ' + activeTokens.bg + ' !important; ')
    parts.push('border-color: ' + activeTokens.accent + ' !important; }')

    // Group row (when data is grouped)
    parts.push(' .tb-live-instance .sv-grid-group-row > .sv-grid-cell ')
    parts.push('{ background: ' + activeTokens.headerBg + ' !important; ')
    parts.push('color: ' + activeTokens.headerFg + ' !important; }')

    // Cell-note corner triangle: tint to brand so it reads as the
    // grid's own annotation marker, not a stock blue dot.
    parts.push(' .tb-live-instance .sv-grid-cell-note-corner::before, ')
    parts.push(' .tb-live-instance .sv-grid-cell-note-corner ')
    parts.push('{ border-top-color: ' + activeTokens.accent + ' !important; }')

    // Pagination toolbar (the website CSS already reads --sg-* vars so
    // pagination follows automatically - no extra rules needed here).

    // ---- Hover-to-highlight outline -------------------------------
    // Outline the preview element matching the currently hovered control.
    // We use outline (not box-shadow) so it sits outside the element's
    // own box without affecting layout, and offset -2px to stay flush.
    if (highlightSelector) {
      parts.push(' .tb-live-instance ' + highlightSelector + ' ')
      parts.push('{ outline: 2px dashed ' + activeTokens.accent + ' !important; ')
      parts.push('outline-offset: -2px; ')
      parts.push('transition: outline-color 120ms ease; }')
    }

    styleEl.textContent = parts.join('')
  })

  // ---- Tabbed controls ----------------------------------------------
  type Tab = 'brand' | 'header' | 'body' | 'rows' | 'cells' | 'pinned' | 'scrollbar' | 'type'
  /** Each tab carries an inline SVG path for the sidebar icon (24×24 viewBox). */
  const TABS: Array<{ id: Tab; label: string; desc: string; icon: string }> = [
    { id: 'brand',     label: 'Brand',     desc: 'Color & mode',            icon: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 6"/>' },
    { id: 'header',    label: 'Header',    desc: 'Column-header styling',   icon: '<rect x="3" y="4" width="18" height="6" rx="1"/><line x1="3" y1="13" x2="21" y2="13"/><line x1="3" y1="17" x2="21" y2="17"/><line x1="3" y1="21" x2="21" y2="21"/>' },
    { id: 'body',      label: 'Body',      desc: 'Rows, cells, padding',    icon: '<rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>' },
    { id: 'rows',      label: 'States',    desc: 'Hover, selected, focus',  icon: '<path d="M12 21l-9-9 4-4 5 5 9-9"/>' },
    { id: 'cells',     label: 'Cells',     desc: 'Padding, border, editor', icon: '<rect x="3" y="3" width="18" height="18" rx="4"/>' },
    { id: 'pinned',    label: 'Pinned',    desc: 'Pinned-column tokens',    icon: '<path d="M16 4l4 4-6 6 2 6-3-1-7 7-1-1 7-7-1-3z"/>' },
    { id: 'scrollbar', label: 'Scrollbar', desc: 'Track, thumb, radius',    icon: '<rect x="9" y="3" width="6" height="18" rx="3"/><line x1="12" y1="8" x2="12" y2="16"/>' },
    { id: 'type',      label: 'Type',      desc: 'Font family',             icon: '<path d="M5 4h14v3h-5v13h-4V7H5z"/>' },
  ]
  let activeTab = $state<Tab>('brand')

  // ---- Sub-section groups (Handsontable-style collapsibles) ----------
  /** Each tab panel breaks down into named GROUPS (Colors, Padding,
   *  Border, State, ...). We track open/closed per group-key so the
   *  user can drill into the specific concern they want to tweak. */
  let openGroups = $state<Set<string>>(new Set([
    // Default-open: the first 1-2 groups of each tab.
    // Header leads with the full Base/Highlighted/Active/Filter taxonomy so
    // the column-header sub-states are visible without hunting.
    'header.base', 'header.highlighted', 'header.active', 'header.filter',
    'body.density', 'body.cell',
    'rows.alt', 'rows.hover', 'rows.selection', 'rows.focus',
    'cells.padding', 'cells.border',
    'pinned.colors',
  ]))
  /** Sync openGroups to the native <details> open state.
   *  We pass the post-toggle open value from the event target rather than
   *  blindly flipping — this guards against any re-entrant toggle that
   *  could otherwise oscillate the group state. */
  function syncGroup(key: string, isOpen: boolean) {
    const has = openGroups.has(key)
    if (isOpen === has) return
    const next = new Set(openGroups)
    if (isOpen) next.add(key); else next.delete(key)
    openGroups = next
  }

  // ---- Right-rail sub-tabs (Export vs WCAG) -------------------------
  type RailTab = 'export' | 'wcag'
  let railTab = $state<RailTab>('export')

  // ---- A small helper for the WCAG chip class -----------------------
  function levelClass(l: 'AAA' | 'AA' | 'Fail'): string {
    return l === 'AAA' ? 'level-aaa' : l === 'AA' ? 'level-aa' : 'level-fail'
  }

  // ---- Plain-English labels for tokens ------------------------------
  const TOKEN_LABEL: Record<keyof Tokens, string> = {
    bg:             'Background',
    fg:             'Text',
    muted:          'Secondary text',
    border:         'Border',
    headerBg:       'Header background',
    headerFg:       'Header text',
    accent:         'Brand accent',
    rowAlt:         'Alt-row background',
    rowHover:       'Hover background',
    rowHoverFg:     'Hover text',
    selectionBg:    'Selected background',
    selectionFg:    'Selected text',
    focusRing:      'Focus ring',
    pinnedBg:       'Pinned background',
    pinnedBorder:   'Pinned border',
    pinnedHeaderBg: 'Pinned header bg',
  }

  /** Smart color edit: clicking a color picker while in Auto mode
   *  flips us to Manual AND records the user's pick. Reduces the
   *  number of clicks needed to start customising. */
  function smartOverride<K extends keyof Tokens>(key: K, value: string) {
    if (tokenMode === 'auto') tokenMode = 'manual'
    setOverride(key, value)
  }

  /** WCAG report sorted: failures first so the user sees them. */
  const sortedScores = $derived(
    [...activeScores].sort((a, b) =>
      a.level === b.level ? 0 : a.level === 'Fail' ? -1 : b.level === 'Fail' ? 1 : a.level === 'AA' ? -1 : 1,
    ),
  )
  const failingCount = $derived(activeScores.filter((s) => s.level === 'Fail').length)
</script>

<section class="tb-page px-4 py-4">
  <header class="tb-page-head">
    <div class="tb-page-head-titles">
      <div class="tb-eyebrow">Theme Builder</div>
      <h1 class="tb-title">Make SvGrid look like your product</h1>
      <p class="tb-lede">
        Pick a preset or a brand color. Each tab styles one part of the grid.
        Copy the production-ready theme.
      </p>
    </div>
    <div class="tb-page-actions">
      <div class="tb-mode-pill" role="group" aria-label="Color mode">
        <button type="button" class:active={mode === 'light'} onclick={() => (mode = 'light')} aria-label="Light mode">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
          Light
        </button>
        <button type="button" class:active={mode === 'dark'} onclick={() => (mode = 'dark')} aria-label="Dark mode">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          Dark
        </button>
      </div>
      <div class="tb-undo-group">
        <button type="button" class="tb-btn tb-btn-icon" onclick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>
        </button>
        <button type="button" class="tb-btn tb-btn-icon" onclick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" aria-label="Redo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/></svg>
        </button>
      </div>
      <button type="button" class="tb-btn" onclick={() => (comparison = !comparison)} title="Show light + dark side by side">
        {comparison ? 'Single view' : 'Compare L/D'}
      </button>
      <button type="button" class="tb-btn" onclick={() => (dataOpen = !dataOpen)} title="Paste your own CSV / JSON into the preview">
        {dataMode === 'custom' ? '✓ Your data' : 'Data…'}
      </button>
      <button type="button" class="tb-btn" onclick={() => (importOpen = !importOpen)}>Import…</button>
      <button type="button" class="tb-btn" onclick={share}>
        {shareCopied ? '✓ URL copied' : 'Share'}
      </button>
      <button type="button" class="tb-btn" onclick={requestReset}>Reset</button>
      <button type="button" class="tb-btn tb-btn-icon" onclick={() => (shortcutsOpen = true)} title="Keyboard shortcuts (?)" aria-label="Show keyboard shortcuts">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12" y2="17"/></svg>
      </button>
    </div>
  </header>

  {#if importOpen}
    <div class="tb-import">
      <label for="tb-import-text" class="tb-import-head">
        Paste a CSS block containing <code>--sg-*</code> variables
      </label>
      <textarea id="tb-import-text" bind:value={importText} rows="5"
        placeholder="--sg-bg: #ffffff; --sg-fg: #1e293b; --sg-accent: #2563eb; ..."></textarea>
      <div class="tb-import-foot">
        {#if importMsg}<span class="tb-import-msg">{importMsg}</span>{/if}
        <button type="button" class="tb-btn" onclick={importFromCss}>Apply</button>
        <button type="button" class="tb-btn tb-btn-ghost" onclick={() => (importOpen = false)}>Close</button>
      </div>
    </div>
  {/if}

  {#if dataOpen}
    <div class="tb-import">
      <label for="tb-data-text" class="tb-import-head">
        Paste your own CSV or JSON to see the theme against your real columns
      </label>
      <textarea id="tb-data-text" bind:value={dataText} rows="6"
        placeholder={"CSV (first row = headers):\nname,price,stock\nWidget,49.99,120\nGadget,12.50,8\n\n— or —\n\nJSON:\n[{\"name\":\"Widget\",\"price\":49.99,\"stock\":120}]"}></textarea>
      <div class="tb-import-foot">
        {#if dataMsg}<span class="tb-import-msg">{dataMsg}</span>{/if}
        <button type="button" class="tb-btn" onclick={loadCustomData}>Load into preview</button>
        {#if dataMode === 'custom'}
          <button type="button" class="tb-btn tb-btn-ghost" onclick={resetToSampleData}>Restore sample</button>
        {/if}
        <button type="button" class="tb-btn tb-btn-ghost" onclick={() => (dataOpen = false)}>Close</button>
      </div>
    </div>
  {/if}

  <!-- Preset row - small previews so users see the actual palette before clicking -->
  <div class="tb-presets" role="group" aria-label="Brand presets">
    <span class="tb-presets-label">Presets:</span>
    {#each PRESETS as p (p.id)}
      {@const t = autoPalette(p.brand, p.mode)}
      <button
        type="button"
        class="tb-preset"
        class:active={activePreset === p.id}
        onclick={() => applyPreset(p)}
        title={`${p.name} · ${p.mode}`}
      >
        <span class="tb-preset-mini" style={`background:${t.bg}`}>
          <span class="tb-preset-mini-hdr" style={`background:${t.headerBg}`}></span>
          <span class="tb-preset-mini-dot" style={`background:${p.brand}`}></span>
        </span>
        <span class="tb-preset-name">{p.name}</span>
      </button>
    {/each}
  </div>

  <!-- Workspace -->
  <div class="tb-grid">

    <!-- LEFT: sidebar nav (docs-style) -->
    <aside class="tb-card tb-sidenav">
      <div class="tb-sidenav-head">Theme parts</div>
      <nav aria-label="Theme sections">
        {#each TABS as t (t.id)}
          <button
            type="button"
            class="tb-sidenav-link"
            class:active={activeTab === t.id}
            onclick={() => (activeTab = t.id)}
            title={t.desc}
          >
            <span class="tb-sidenav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                {@html t.icon}
              </svg>
            </span>
            <span class="tb-sidenav-textbox">
              <span class="tb-sidenav-label">{t.label}</span>
              <span class="tb-sidenav-desc">{t.desc}</span>
            </span>
            <span class="tb-sidenav-arrow" aria-hidden="true">›</span>
          </button>
        {/each}
      </nav>
    </aside>

    <!-- CONTROLS: per-section panel -->
    <aside class="tb-card tb-controls">
      <div class="tb-tab-panel">

      {#if activeTab === 'brand'}
        <div class="tb-panel">
          <div class="tb-field-row">
            <label class="tb-field-label">Brand color</label>
            <span class="tb-field-hint">drives every other token</span>
          </div>
          <div class="tb-row">
            <input type="color" bind:value={brand} oninput={onUserEdit} aria-label="Brand color" />
            <input type="text" class="tb-hex" bind:value={brand} oninput={onUserEdit} spellcheck="false" />
          </div>

          <div class="tb-field-row">
            <label class="tb-field-label">Auto / manual tokens</label>
            <span class="tb-field-hint">click a token color to switch to manual</span>
          </div>
          <span class="tb-mode-toggle">
            <button type="button" class:active={tokenMode === 'auto'}   onclick={() => (tokenMode = 'auto')}>Auto</button>
            <button type="button" class:active={tokenMode === 'manual'} onclick={() => (tokenMode = 'manual')}>Manual</button>
          </span>

          <div class="tb-field-row">
            <label class="tb-field-label">Surface tokens</label>
          </div>
          {#each ['bg', 'fg', 'muted', 'border'] as k (k)}
            <div class="tb-token" class:overridden={overrides[k as keyof Tokens] !== undefined} {...highlight(tokenSelector(k))}>
              <input type="color" value={activeTokens[k as keyof Tokens].slice(0, 7)}
                aria-label={`${k} color`}
                oninput={(e) => smartOverride(k as keyof Tokens, (e.target as HTMLInputElement).value)} />
              <span class="tb-token-name">{TOKEN_LABEL[k as keyof Tokens]}</span>
              <code class="tb-token-key">{k}</code>
              <code class="tb-token-val">{activeTokens[k as keyof Tokens]}</code>
            </div>
          {/each}
        </div>
      {/if}

      {#if activeTab === 'header'}
        <div class="tb-panel tb-panel-grouped">

          <!-- BASE -->
          <details class="tb-group" open={openGroups.has('header.base')} ontoggle={(e) => syncGroup('header.base', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Base</span><span class="tb-group-hint">font weight · foreground · background</span></summary>
            <div class="tb-group-body">
              <label class="tb-slider"><span>Font weight</span>
                <select bind:value={headerFontWeight} onchange={onUserEdit}>
                  <option value={400}>400 regular</option>
                  <option value={500}>500 medium</option>
                  <option value={600}>600 semibold</option>
                  <option value={700}>700 bold</option>
                  <option value={800}>800 extra-bold</option>
                </select>
              </label>
              <div class="tb-token" class:overridden={overrides.headerFg !== undefined} {...highlight(tokenSelector('headerFg'))}>
                <input type="color" value={activeTokens.headerFg.slice(0, 7)} aria-label="Header text"
                  oninput={(e) => smartOverride('headerFg', (e.target as HTMLInputElement).value)} />
                <span class="tb-token-name">Foreground</span>
                <code class="tb-token-key">headerFg</code>
                <code class="tb-token-val">{activeTokens.headerFg}</code>
              </div>
              <div class="tb-token" class:overridden={overrides.headerBg !== undefined} {...highlight(tokenSelector('headerBg'))}>
                <input type="color" value={activeTokens.headerBg.slice(0, 7)} aria-label="Header background"
                  oninput={(e) => smartOverride('headerBg', (e.target as HTMLInputElement).value)} />
                <span class="tb-token-name">Background</span>
                <code class="tb-token-key">headerBg</code>
                <code class="tb-token-val">{activeTokens.headerBg}</code>
              </div>
            </div>
          </details>

          <!-- HIGHLIGHTED (hover) -->
          <details class="tb-group" open={openGroups.has('header.highlighted')} ontoggle={(e) => syncGroup('header.highlighted', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Highlighted</span><span class="tb-group-hint">shadow size · foreground · background</span></summary>
            <div class="tb-group-body">
              <label class="tb-slider"><span>Shadow size · <strong>{headerHoverShadowSize}px</strong></span><input type="range" min="0" max="12" step="1" bind:value={headerHoverShadowSize} oninput={onUserEdit} /></label>
              <div class="tb-col-color">
                <input type="color" value={headerHoverFg || activeTokens.headerFg.slice(0, 7)}
                  oninput={(e) => { headerHoverFg = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Hover header text" />
                <span class="tb-col-color-label">Foreground</span>
                <button type="button" class="tb-col-reset" title="Match base" disabled={!headerHoverFg} onclick={() => (headerHoverFg = '')}>↺</button>
              </div>
              <div class="tb-col-color">
                <input type="color" value={headerHoverBg || activeTokens.headerBg.slice(0, 7)}
                  oninput={(e) => { headerHoverBg = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Hover header background" />
                <span class="tb-col-color-label">Background</span>
                <button type="button" class="tb-col-reset" title="Match base" disabled={!headerHoverBg} onclick={() => (headerHoverBg = '')}>↺</button>
              </div>
            </div>
          </details>

          <!-- ACTIVE (sorted) -->
          <details class="tb-group" open={openGroups.has('header.active')} ontoggle={(e) => syncGroup('header.active', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Active</span><span class="tb-group-hint">sorted column · click a header to test</span></summary>
            <div class="tb-group-body">
              <div class="tb-col-color">
                <input type="color" value={headerActiveBorderColor || activeTokens.accent.slice(0, 7)}
                  oninput={(e) => { headerActiveBorderColor = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Active header border" />
                <span class="tb-col-color-label">Border color</span>
                <button type="button" class="tb-col-reset" title="Match accent" disabled={!headerActiveBorderColor} onclick={() => (headerActiveBorderColor = '')}>↺</button>
              </div>
              <div class="tb-col-color">
                <input type="color" value={headerActiveFg || activeTokens.headerFg.slice(0, 7)}
                  oninput={(e) => { headerActiveFg = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Active header text" />
                <span class="tb-col-color-label">Foreground</span>
                <button type="button" class="tb-col-reset" title="Match base" disabled={!headerActiveFg} onclick={() => (headerActiveFg = '')}>↺</button>
              </div>
              <div class="tb-col-color">
                <input type="color" value={headerActiveBg || activeTokens.headerBg.slice(0, 7)}
                  oninput={(e) => { headerActiveBg = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Active header background" />
                <span class="tb-col-color-label">Background</span>
                <button type="button" class="tb-col-reset" title="Match base" disabled={!headerActiveBg} onclick={() => (headerActiveBg = '')}>↺</button>
              </div>
            </div>
          </details>

          <!-- FILTER -->
          <details class="tb-group" open={openGroups.has('header.filter')} ontoggle={(e) => syncGroup('header.filter', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Filter</span><span class="tb-group-hint">column with active filter</span></summary>
            <div class="tb-group-body">
              <div class="tb-col-color">
                <input type="color" value={headerFilterBg || activeTokens.headerBg.slice(0, 7)}
                  oninput={(e) => { headerFilterBg = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Filter header background" />
                <span class="tb-col-color-label">Background</span>
                <button type="button" class="tb-col-reset" title="Match base" disabled={!headerFilterBg} onclick={() => (headerFilterBg = '')}>↺</button>
              </div>
            </div>
          </details>

          <!-- Secondary: Layout / Typography / Border / Scroll (collapsed by default) -->
          <details class="tb-group" open={openGroups.has('header.layout')} ontoggle={(e) => syncGroup('header.layout', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Layout</span><span class="tb-group-hint">height · padding · alignment</span></summary>
            <div class="tb-group-body">
              <div class="tb-grid-2">
                <label class="tb-slider"><span>Height · <strong>{headerHeight}px</strong></span><input type="range" min="28" max="64" step="1" bind:value={headerHeight} oninput={onUserEdit} /></label>
                <label class="tb-slider"><span>Padding-X · <strong>{headerPaddingX}px</strong></span><input type="range" min="2" max="32" step="1" bind:value={headerPaddingX} oninput={onUserEdit} /></label>
              </div>
              <div class="tb-row-label"><span>Text alignment</span></div>
              <div class="tb-seg">
                <button type="button" class:active={headerAlign === 'left'}   onclick={() => { headerAlign = 'left'; onUserEdit() }}>Left</button>
                <button type="button" class:active={headerAlign === 'center'} onclick={() => { headerAlign = 'center'; onUserEdit() }}>Center</button>
                <button type="button" class:active={headerAlign === 'right'}  onclick={() => { headerAlign = 'right'; onUserEdit() }}>Right</button>
              </div>
            </div>
          </details>

          <details class="tb-group" open={openGroups.has('header.typography')} ontoggle={(e) => syncGroup('header.typography', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Typography</span><span class="tb-group-hint">size · letter-spacing · transform</span></summary>
            <div class="tb-group-body">
              <div class="tb-grid-2">
                <label class="tb-slider"><span>Font size · <strong>{headerFontSize}px</strong></span><input type="range" min="10" max="18" step="1" bind:value={headerFontSize} oninput={onUserEdit} /></label>
                <label class="tb-slider"><span>Letter-spacing · <strong>{(headerLetterSpacing / 100).toFixed(2)}em</strong></span><input type="range" min="0" max="20" step="1" bind:value={headerLetterSpacing} oninput={onUserEdit} /></label>
                <label class="tb-slider"><span>Text transform</span>
                  <select bind:value={headerTransform} onchange={onUserEdit}>
                    <option value="none">none</option>
                    <option value="uppercase">UPPERCASE</option>
                    <option value="capitalize">Capitalize</option>
                  </select>
                </label>
              </div>
            </div>
          </details>

          <details class="tb-group" open={openGroups.has('header.border')} ontoggle={(e) => syncGroup('header.border', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Border &amp; divider</span><span class="tb-group-hint">between cells · bottom border · color</span></summary>
            <div class="tb-group-body">
              <div class="tb-grid-2">
                <label class="tb-slider"><span>Divider style</span>
                  <select bind:value={headerDividerStyle} onchange={onUserEdit}>
                    <option value="none">none</option>
                    <option value="solid">solid</option>
                    <option value="dashed">dashed</option>
                    <option value="dotted">dotted</option>
                  </select>
                </label>
                <label class="tb-slider"><span>Divider width · <strong>{headerDividerWidth}px</strong></span><input type="range" min="1" max="3" step="1" bind:value={headerDividerWidth} oninput={onUserEdit} /></label>
                <label class="tb-slider"><span>Bottom border · <strong>{headerBottomBorderWidth}px</strong></span><input type="range" min="0" max="4" step="1" bind:value={headerBottomBorderWidth} oninput={onUserEdit} /></label>
              </div>
              <div class="tb-col-color">
                <input type="color" value={headerBorderColor || activeTokens.border.slice(0, 7)}
                  oninput={(e) => { headerBorderColor = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Header bottom border color" />
                <span class="tb-col-color-label">Bottom border color</span>
                <button type="button" class="tb-col-reset" title="Match global border" disabled={!headerBorderColor} onclick={() => (headerBorderColor = '')}>↺</button>
              </div>
              <div class="tb-col-color">
                <input type="color" value={headerDividerColor || headerBorderColor || activeTokens.border.slice(0, 7)}
                  oninput={(e) => { headerDividerColor = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Header divider color" />
                <span class="tb-col-color-label">Divider color</span>
                <button type="button" class="tb-col-reset" title="Match bottom border" disabled={!headerDividerColor} onclick={() => (headerDividerColor = '')}>↺</button>
              </div>
            </div>
          </details>

          <details class="tb-group" open={openGroups.has('header.scroll')} ontoggle={(e) => syncGroup('header.scroll', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>On scroll</span><span class="tb-group-hint">sticky drop-shadow</span></summary>
            <div class="tb-group-body">
              <label class="tb-toggle"><input type="checkbox" bind:checked={headerShadow} onchange={onUserEdit} /><span>Drop shadow under header when scrolling</span></label>
            </div>
          </details>

        </div>
      {/if}

      {#if activeTab === 'body'}
        <div class="tb-panel tb-panel-grouped">

          <!-- DENSITY -->
          <details class="tb-group" open={openGroups.has('body.density')} ontoggle={(e) => syncGroup('body.density', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Density</span><span class="tb-group-hint">one-click presets</span></summary>
            <div class="tb-group-body">
              <div class="tb-seg">
                <button type="button" class:active={rowHeight <= 28}
                  onclick={() => { rowHeight = 28; cellPaddingX = 8;  cellPaddingY = 0; bodyFontSize = 12; onUserEdit() }}>Compact</button>
                <button type="button" class:active={rowHeight > 28 && rowHeight <= 36}
                  onclick={() => { rowHeight = 34; cellPaddingX = 12; cellPaddingY = 0; bodyFontSize = 13; onUserEdit() }}>Default</button>
                <button type="button" class:active={rowHeight > 36}
                  onclick={() => { rowHeight = 44; cellPaddingX = 16; cellPaddingY = 4; bodyFontSize = 14; onUserEdit() }}>Comfy</button>
              </div>
            </div>
          </details>

          <!-- CELL -->
          <details class="tb-group" open={openGroups.has('body.cell')} ontoggle={(e) => syncGroup('body.cell', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Cell</span><span class="tb-group-hint">row height · padding</span></summary>
            <div class="tb-group-body">
              <div class="tb-grid-2">
                <label class="tb-slider"><span>Row height · <strong>{rowHeight}px</strong></span><input type="range" min="24" max="56" step="2" bind:value={rowHeight} oninput={onUserEdit} /></label>
                <label class="tb-slider"><span>Padding-X · <strong>{cellPaddingX}px</strong></span><input type="range" min="2" max="24" step="1" bind:value={cellPaddingX} oninput={onUserEdit} /></label>
                <label class="tb-slider"><span>Padding-Y · <strong>{cellPaddingY}px</strong></span><input type="range" min="0" max="12" step="1" bind:value={cellPaddingY} oninput={onUserEdit} /></label>
              </div>
            </div>
          </details>

          <!-- TYPOGRAPHY -->
          <details class="tb-group" open={openGroups.has('body.type')} ontoggle={(e) => syncGroup('body.type', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Typography</span><span class="tb-group-hint">size · weight</span></summary>
            <div class="tb-group-body">
              <div class="tb-grid-2">
                <label class="tb-slider"><span>Font size · <strong>{bodyFontSize}px</strong></span><input type="range" min="11" max="18" step="1" bind:value={bodyFontSize} oninput={onUserEdit} /></label>
                <label class="tb-slider"><span>Weight</span>
                  <select bind:value={bodyFontWeight} onchange={onUserEdit}>
                    <option value={400}>400 regular</option>
                    <option value={500}>500 medium</option>
                    <option value={600}>600 semibold</option>
                  </select>
                </label>
              </div>
            </div>
          </details>

          <!-- ROW ZEBRA -->
          <details class="tb-group" open={openGroups.has('body.zebra')} ontoggle={(e) => syncGroup('body.zebra', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Alternating rows</span><span class="tb-group-hint">zebra striping</span></summary>
            <div class="tb-group-body">
              <label class="tb-toggle"><input type="checkbox" bind:checked={zebra} onchange={onUserEdit} /><span>Alternate every other row</span></label>
              <div class="tb-token">
                <input type="color" value={activeTokens.rowAlt.slice(0, 7)} aria-label="rowAlt color"
                  oninput={(e) => smartOverride('rowAlt', (e.target as HTMLInputElement).value)} />
                <span class="tb-token-name">Alt-row background</span>
                <code class="tb-token-key">rowAlt</code>
                <code class="tb-token-val">{activeTokens.rowAlt}</code>
              </div>
            </div>
          </details>

        </div>
      {/if}

      {#if activeTab === 'rows'}
        <div class="tb-panel tb-panel-grouped">

          <!-- ALTERNATE (ZEBRA) -->
          <details class="tb-group" open={openGroups.has('rows.alt')} ontoggle={(e) => syncGroup('rows.alt', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Alternate row</span><span class="tb-group-hint">zebra striping</span></summary>
            <div class="tb-group-body">
              <div class="tb-token" class:overridden={overrides.rowAlt !== undefined} {...highlight(tokenSelector('rowAlt'))}>
                <input type="color" value={activeTokens.rowAlt.startsWith('#') ? activeTokens.rowAlt.slice(0, 7) : '#888888'}
                  aria-label="Alt-row background"
                  oninput={(e) => smartOverride('rowAlt', (e.target as HTMLInputElement).value)} />
                <span class="tb-token-name">Background</span>
                <code class="tb-token-key">rowAlt</code>
                <code class="tb-token-val">{activeTokens.rowAlt}</code>
              </div>
            </div>
          </details>

          <!-- HOVER -->
          <details class="tb-group" open={openGroups.has('rows.hover')} ontoggle={(e) => syncGroup('rows.hover', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Hover</span><span class="tb-group-hint">row under pointer</span></summary>
            <div class="tb-group-body">
              <div class="tb-token" class:overridden={overrides.rowHover !== undefined} {...highlight(tokenSelector('rowHover'))}>
                <input type="color" value={activeTokens.rowHover.startsWith('#') ? activeTokens.rowHover.slice(0, 7) : '#888888'}
                  aria-label="Hover background"
                  oninput={(e) => smartOverride('rowHover', (e.target as HTMLInputElement).value)} />
                <span class="tb-token-name">Background</span>
                <code class="tb-token-key">rowHover</code>
                <code class="tb-token-val">{activeTokens.rowHover}</code>
              </div>
              <div class="tb-token" class:overridden={overrides.rowHoverFg !== undefined} {...highlight(tokenSelector('rowHoverFg'))}>
                <input type="color" value={activeTokens.rowHoverFg.startsWith('#') ? activeTokens.rowHoverFg.slice(0, 7) : '#888888'}
                  aria-label="Hover text"
                  oninput={(e) => smartOverride('rowHoverFg', (e.target as HTMLInputElement).value)} />
                <span class="tb-token-name">Foreground</span>
                <code class="tb-token-key">rowHoverFg</code>
                <code class="tb-token-val">{activeTokens.rowHoverFg}</code>
              </div>
            </div>
          </details>

          <!-- SELECTION -->
          <details class="tb-group" open={openGroups.has('rows.selection')} ontoggle={(e) => syncGroup('rows.selection', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Selection</span><span class="tb-group-hint">row clicked / range</span></summary>
            <div class="tb-group-body">
              <div class="tb-token" class:overridden={overrides.selectionBg !== undefined} {...highlight(tokenSelector('selectionBg'))}>
                <input type="color" value={activeTokens.selectionBg.startsWith('#') ? activeTokens.selectionBg.slice(0, 7) : '#888888'}
                  aria-label="Selection background"
                  oninput={(e) => smartOverride('selectionBg', (e.target as HTMLInputElement).value)} />
                <span class="tb-token-name">Background</span>
                <code class="tb-token-key">selectionBg</code>
                <code class="tb-token-val">{activeTokens.selectionBg}</code>
              </div>
              <div class="tb-token" class:overridden={overrides.selectionFg !== undefined} {...highlight(tokenSelector('selectionFg'))}>
                <input type="color" value={activeTokens.selectionFg.startsWith('#') ? activeTokens.selectionFg.slice(0, 7) : '#888888'}
                  aria-label="Selection text"
                  oninput={(e) => smartOverride('selectionFg', (e.target as HTMLInputElement).value)} />
                <span class="tb-token-name">Foreground</span>
                <code class="tb-token-key">selectionFg</code>
                <code class="tb-token-val">{activeTokens.selectionFg}</code>
              </div>
            </div>
          </details>

          <!-- FOCUS -->
          <details class="tb-group" open={openGroups.has('rows.focus')} ontoggle={(e) => syncGroup('rows.focus', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Focus ring</span><span class="tb-group-hint">keyboard navigation</span></summary>
            <div class="tb-group-body">
              <div class="tb-token" class:overridden={overrides.focusRing !== undefined} {...highlight(tokenSelector('focusRing'))}>
                <input type="color" value={activeTokens.focusRing.startsWith('#') ? activeTokens.focusRing.slice(0, 7) : '#888888'}
                  aria-label="Focus ring color"
                  oninput={(e) => smartOverride('focusRing', (e.target as HTMLInputElement).value)} />
                <span class="tb-token-name">Ring color</span>
                <code class="tb-token-key">focusRing</code>
                <code class="tb-token-val">{activeTokens.focusRing}</code>
              </div>
            </div>
          </details>

        </div>
      {/if}

      {#if activeTab === 'cells'}
        <div class="tb-panel tb-panel-grouped">

          <!-- PADDING -->
          <details class="tb-group" open={openGroups.has('cells.padding')} ontoggle={(e) => syncGroup('cells.padding', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Padding</span><span class="tb-group-hint">horizontal · vertical</span></summary>
            <div class="tb-group-body">
              <div class="tb-grid-2">
                <label class="tb-slider"><span>Horizontal · <strong>{cellPaddingX}px</strong></span><input type="range" min="2" max="24" step="1" bind:value={cellPaddingX} oninput={onUserEdit} /></label>
                <label class="tb-slider"><span>Vertical · <strong>{cellPaddingY}px</strong></span><input type="range" min="0" max="12" step="1" bind:value={cellPaddingY} oninput={onUserEdit} /></label>
              </div>
            </div>
          </details>

          <!-- BORDER -->
          <details class="tb-group" open={openGroups.has('cells.border')} ontoggle={(e) => syncGroup('cells.border', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Border</span><span class="tb-group-hint">style · width · radius · colors</span></summary>
            <div class="tb-group-body">
              <div class="tb-grid-2">
                <label class="tb-slider"><span>Style</span>
                  <select bind:value={borderStyle} onchange={onUserEdit}>
                    <option value="solid">solid</option>
                    <option value="dashed">dashed</option>
                    <option value="dotted">dotted</option>
                    <option value="none">none</option>
                  </select>
                </label>
                <label class="tb-slider"><span>Width · <strong>{borderWidth}px</strong></span><input type="range" min="0" max="3" step="1" bind:value={borderWidth} oninput={onUserEdit} /></label>
                <label class="tb-slider"><span>Corner radius · <strong>{radius}px</strong></span><input type="range" min="0" max="20" step="1" bind:value={radius} oninput={onUserEdit} /></label>
              </div>
              <div class="tb-col-color">
                <input type="color" value={horizontalBorderColor || activeTokens.border.slice(0, 7)}
                  oninput={(e) => { horizontalBorderColor = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Horizontal border color" />
                <span class="tb-col-color-label">Horizontal border</span>
                <button type="button" class="tb-col-reset" title="Match border" disabled={!horizontalBorderColor} onclick={() => (horizontalBorderColor = '')}>↺</button>
              </div>
              <div class="tb-col-color">
                <input type="color" value={verticalBorderColor || activeTokens.border.slice(0, 7)}
                  oninput={(e) => { verticalBorderColor = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Vertical border color" />
                <span class="tb-col-color-label">Vertical border</span>
                <button type="button" class="tb-col-reset" title="Match border" disabled={!verticalBorderColor} onclick={() => (verticalBorderColor = '')}>↺</button>
              </div>
            </div>
          </details>

          <!-- SELECTION -->
          <details class="tb-group" open={openGroups.has('cells.selection')} ontoggle={(e) => syncGroup('cells.selection', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Selection</span><span class="tb-group-hint">active cell ring</span></summary>
            <div class="tb-group-body">
              <div class="tb-col-color">
                <input type="color" value={selectionBorderColor || activeTokens.accent.slice(0, 7)}
                  oninput={(e) => { selectionBorderColor = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Selection border color" />
                <span class="tb-col-color-label">Selection border</span>
                <button type="button" class="tb-col-reset" title="Match accent" disabled={!selectionBorderColor} onclick={() => (selectionBorderColor = '')}>↺</button>
              </div>
              <div class="tb-token" class:overridden={overrides.selectionBg !== undefined} {...highlight(tokenSelector('selectionBg'))}>
                <input type="color" value={activeTokens.selectionBg.slice(0, 7)} aria-label="Selection background"
                  oninput={(e) => smartOverride('selectionBg', (e.target as HTMLInputElement).value)} />
                <span class="tb-token-name">Selection background</span>
                <code class="tb-token-key">selectionBg</code>
                <code class="tb-token-val">{activeTokens.selectionBg}</code>
              </div>
            </div>
          </details>

          <!-- STATE: semantic cell colors -->
          <details class="tb-group" open={openGroups.has('cells.state')} ontoggle={(e) => syncGroup('cells.state', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>State</span><span class="tb-group-hint">success · error · read-only</span></summary>
            <div class="tb-group-body">
              <div class="tb-col-color">
                <input type="color" value={successBg || '#dcfce7'}
                  oninput={(e) => { successBg = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Success background" />
                <span class="tb-col-color-label">Success background</span>
                <button type="button" class="tb-col-reset" title="Clear" disabled={!successBg} onclick={() => (successBg = '')}>↺</button>
              </div>
              <div class="tb-col-color">
                <input type="color" value={errorBg || '#fee2e2'}
                  oninput={(e) => { errorBg = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Error background" />
                <span class="tb-col-color-label">Error background</span>
                <button type="button" class="tb-col-reset" title="Clear" disabled={!errorBg} onclick={() => (errorBg = '')}>↺</button>
              </div>
              <div class="tb-col-color">
                <input type="color" value={readOnlyBg || '#f1f5f9'}
                  oninput={(e) => { readOnlyBg = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Read-only background" />
                <span class="tb-col-color-label">Read-only background</span>
                <button type="button" class="tb-col-reset" title="Clear" disabled={!readOnlyBg} onclick={() => (readOnlyBg = '')}>↺</button>
              </div>
              <p class="tb-field-hint">Applied to cells with the matching CSS class: <code>.success</code> / <code>.error</code> / <code>.readonly</code> (or <code>aria-readonly</code>).</p>
            </div>
          </details>

          <!-- EDITOR -->
          <details class="tb-group" open={openGroups.has('cells.editor')} ontoggle={(e) => syncGroup('cells.editor', (e.currentTarget as HTMLDetailsElement).open)}>
            <summary class="tb-group-head"><span class="tb-group-chev"></span><span>Editor</span><span class="tb-group-hint">in-cell edit mode</span></summary>
            <div class="tb-group-body">
              <div class="tb-grid-2">
                <label class="tb-slider"><span>Border width · <strong>{editorBorderWidth}px</strong></span><input type="range" min="0" max="4" step="1" bind:value={editorBorderWidth} oninput={onUserEdit} /></label>
                <label class="tb-slider"><span>Shadow blur · <strong>{editorShadowBlur}px</strong></span><input type="range" min="0" max="32" step="1" bind:value={editorShadowBlur} oninput={onUserEdit} /></label>
              </div>
              <div class="tb-col-color">
                <input type="color" value={editorBorderColor || activeTokens.accent.slice(0, 7)}
                  oninput={(e) => { editorBorderColor = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Editor border color" />
                <span class="tb-col-color-label">Border color</span>
                <button type="button" class="tb-col-reset" title="Match accent" disabled={!editorBorderColor} onclick={() => (editorBorderColor = '')}>↺</button>
              </div>
              <div class="tb-col-color">
                <input type="color" value={editorFg || activeTokens.fg.slice(0, 7)}
                  oninput={(e) => { editorFg = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Editor text" />
                <span class="tb-col-color-label">Text</span>
                <button type="button" class="tb-col-reset" title="Match surface" disabled={!editorFg} onclick={() => (editorFg = '')}>↺</button>
              </div>
              <div class="tb-col-color">
                <input type="color" value={editorBg || activeTokens.bg.slice(0, 7)}
                  oninput={(e) => { editorBg = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Editor background" />
                <span class="tb-col-color-label">Background</span>
                <button type="button" class="tb-col-reset" title="Match surface" disabled={!editorBg} onclick={() => (editorBg = '')}>↺</button>
              </div>
              <div class="tb-col-color">
                <input type="color" value={editorShadowColor || '#000000'}
                  oninput={(e) => { editorShadowColor = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Editor shadow color" />
                <span class="tb-col-color-label">Shadow color</span>
                <button type="button" class="tb-col-reset" title="Clear" disabled={!editorShadowColor} onclick={() => (editorShadowColor = '')}>↺</button>
              </div>
            </div>
          </details>

        </div>
      {/if}

      {#if activeTab === 'pinned'}
        <div class="tb-panel">
          <div class="tb-field-row">
            <label class="tb-field-label">Pinned column tokens</label>
            <span class="tb-field-hint">sticky left / right columns</span>
          </div>
          {#each ['pinnedBg', 'pinnedBorder', 'pinnedHeaderBg'] as k (k)}
            <div class="tb-token" class:overridden={overrides[k as keyof Tokens] !== undefined} {...highlight(tokenSelector(k))}>
              <input type="color" value={activeTokens[k as keyof Tokens].slice(0, 7)}
                aria-label={`${k} color`}
                oninput={(e) => smartOverride(k as keyof Tokens, (e.target as HTMLInputElement).value)} />
              <span class="tb-token-name">{TOKEN_LABEL[k as keyof Tokens]}</span>
              <code class="tb-token-key">{k}</code>
              <code class="tb-token-val">{activeTokens[k as keyof Tokens]}</code>
            </div>
          {/each}
        </div>
      {/if}

      {#if activeTab === 'scrollbar'}
        <div class="tb-panel">
          <div class="tb-field-row">
            <label class="tb-field-label">Scrollbar tokens</label>
            <span class="tb-field-hint">webkit (Chrome / Safari / Edge)</span>
          </div>
          <div class="tb-grid-2">
            <label class="tb-slider">
              <span>Border radius · <strong>{scrollRadius}px</strong></span>
              <input type="range" min="0" max="12" step="1" bind:value={scrollRadius} oninput={onUserEdit} />
            </label>
          </div>
          <div class="tb-col-color">
            <input type="color" value={scrollTrack || 'transparent'}
              oninput={(e) => { scrollTrack = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Track color" />
            <span class="tb-col-color-label">Track color</span>
            <button type="button" class="tb-col-reset" title="Clear" disabled={!scrollTrack} onclick={() => (scrollTrack = '')}>↺</button>
          </div>
          <div class="tb-col-color">
            <input type="color" value={scrollThumb || activeTokens.muted.slice(0, 7)}
              oninput={(e) => { scrollThumb = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Thumb color" />
            <span class="tb-col-color-label">Thumb color</span>
            <button type="button" class="tb-col-reset" title="Match muted" disabled={!scrollThumb} onclick={() => (scrollThumb = '')}>↺</button>
          </div>
          <div class="tb-col-color">
            <input type="color" value={scrollArrow || activeTokens.muted.slice(0, 7)}
              oninput={(e) => { scrollArrow = (e.target as HTMLInputElement).value; onUserEdit() }} aria-label="Arrow color" />
            <span class="tb-col-color-label">Arrow color</span>
            <button type="button" class="tb-col-reset" title="Match muted" disabled={!scrollArrow} onclick={() => (scrollArrow = '')}>↺</button>
          </div>
          <p class="tb-field-hint">Styles SvGrid's custom scrollbar. Arrow color applies to the chevron glyphs on the scroll buttons.</p>
        </div>
      {/if}

      {#if activeTab === 'type'}
        <div class="tb-panel">
          <div class="tb-field-row">
            <label class="tb-field-label">Font family</label>
          </div>
          <select bind:value={font} onchange={onUserEdit} class="tb-fullwidth">
            <option value="ui-sans-serif, system-ui">System sans</option>
            <option value="Inter, ui-sans-serif, system-ui">Inter</option>
            <option value="Roboto, ui-sans-serif, system-ui">Roboto</option>
            <option value="'Helvetica Neue', Helvetica, Arial, sans-serif">Helvetica</option>
            <option value="Geist, Inter, ui-sans-serif">Geist</option>
            <option value="ui-serif, Georgia, serif">Serif</option>
            <option value="ui-monospace, SFMono-Regular, monospace">Monospace</option>
          </select>
        </div>
      {/if}

      <!-- Reset section: scoped to the currently visible tab so a single
           bad experiment can be undone without nuking everything. -->
      <div class="tb-panel-reset">
        <button type="button" class="tb-reset-link" onclick={() => resetTab(activeTab)}
          title="Restore defaults for the {activeTab} tab only">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>
          Reset this section
        </button>
      </div>

      </div>

      <!-- Saved themes - compact strip at the bottom of the controls -->
      <footer class="tb-controls-foot">
        <input type="text" placeholder="Save as…" bind:value={saveName}
          onkeydown={(e) => { if (e.key === 'Enter') saveCurrent() }} />
        <button type="button" class="tb-btn tb-btn-sm" onclick={saveCurrent} disabled={!saveName.trim()}>Save</button>
        {#if savedThemes.length > 0}
          <div class="tb-saved-chips">
            {#each savedThemes as t (t.name)}
              <span class="tb-saved-chip">
                <button type="button" onclick={() => loadSaved(t)} title="Load {t.name}">{t.name}</button>
                <button type="button" class="x" onclick={() => deleteSaved(t.name)} aria-label="Delete {t.name}">×</button>
              </span>
            {/each}
          </div>
        {/if}
      </footer>

    </aside>

    <!-- CENTER: live preview -->
    <main class="tb-preview">
      {#if comparison}
        {#each (['light', 'dark'] as const) as m (m)}
          {@const s = m === 'light' ? lightStyle : darkStyle}
          <article class="tb-preview-card" data-theme={m}>
            <div class="tb-grid-wrap tb-live-instance" style={s}>
              <SvGrid
                data={rows}
                {columns}
                {features}
                showRowSelection={false}
                showPagination={false}
                enableInlineEditing={false}
                enableCellSelection={true}
                rowHeight={rowHeight}
                containerHeight="100%"
                fitColumns={true}
              />
            </div>
          </article>
        {/each}
      {:else}
        <article class="tb-preview-card" data-theme={mode}>
          <div class="tb-grid-wrap tb-live-instance" style={activeStyle}>
            <SvGrid
              data={rows}
              {columns}
              {features}
              showRowSelection={false}
              showPagination={false}
              enableInlineEditing={false}
              enableCellSelection={true}
              rowHeight={rowHeight}
              containerHeight="100%"
              fitColumns={true}
            />
          </div>
        </article>
      {/if}

    </main>

    <!-- RIGHT: export + WCAG (sub-tabs) -->
    <aside class="tb-card tb-rightrail">
      <header class="tb-rail-tabs">
        <button type="button" class:active={railTab === 'export'} onclick={() => (railTab = 'export')}>Export</button>
        <button type="button" class:active={railTab === 'wcag'}   onclick={() => (railTab = 'wcag')}>
          A11y {failingCount > 0 ? `(${failingCount})` : '✓'}
        </button>
      </header>

      {#if railTab === 'export'}
        <div class="tb-export-inner">
          <div class="tb-export-head">
            <div class="tb-seg tb-seg-export">
              <button type="button" class:active={format === 'css'}      onclick={() => (format = 'css')}>CSS</button>
              <button type="button" class:active={format === 'scss'}     onclick={() => (format = 'scss')}>SCSS</button>
              <button type="button" class:active={format === 'json'}     onclick={() => (format = 'json')}>JSON</button>
              <button type="button" class:active={format === 'tailwind'} onclick={() => (format = 'tailwind')}>Tailwind</button>
            </div>
            <div class="tb-export-actions">
              {#if format === 'css' || format === 'json'}
                <label class="tb-export-diff" title="Emit only the tokens you changed - useful when you want a small patch over the default theme">
                  <input type="checkbox" bind:checked={diffOnly} />
                  <span>Only changes</span>
                </label>
              {/if}
              <button type="button" class="tb-btn-copy" onclick={copyToClipboard}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <pre class="tb-code"><code>{currentOut}</code></pre>
          <details class="tb-install">
            <summary>How to use this</summary>
            <div class="tb-install-body">
              {#if format === 'css'}
                <p>Add the snippet above to a global stylesheet (e.g. <code>src/app.css</code>) and mount your grid inside a wrapper:</p>
                <pre><code>&lt;div class="my-grid-themed"&gt;
  &lt;SvGrid {`{...}`} /&gt;
&lt;/div&gt;</code></pre>
                <p>Drop the wrapper class to use the host page's theme instead.</p>
              {:else if format === 'scss'}
                <p>Save as <code>_theme.scss</code> and import where you build the grid styles. The variables follow the <code>$sg-*</code> naming used by the SvGrid SCSS docs.</p>
              {:else if format === 'json'}
                <p>Useful when you want to feed the palette into a design-tokens pipeline (Style Dictionary, Tokens Studio, etc.) or apply at runtime:</p>
                <pre><code>import theme from './theme.json'
for (const [k, v] of Object.entries(theme.tokens)) {`{`}
  document.documentElement.style.setProperty(`--sg-${`{`}k{`}`}`, v as string)
{`}`}</code></pre>
              {:else}
                <p>Drop into <code>tailwind.config.{`{js,ts}`}</code>. Now you can use utilities like <code>bg-brand</code>, <code>text-brand-fg</code>, and <code>rounded-brand</code> on any element.</p>
              {/if}
            </div>
          </details>
        </div>
      {:else}
        <div class="tb-wcag-inner">
          <header class="tb-wcag-head">
            <span class="tb-wcag-head-mode">{mode}</span>
            {#if failingCount > 0}
              <span class="tb-wcag-badge fail">{failingCount} fail{failingCount === 1 ? '' : 's'}</span>
            {:else}
              <span class="tb-wcag-badge pass">All pass</span>
            {/if}
          </header>
          <div class="tb-wcag-grid">
            {#each sortedScores as s (s.name)}
              <div class="tb-wcag-row" class:fail={s.level === 'Fail'}>
                <div class="tb-wcag-name">
                  <span class="tb-wcag-swatch" style={`background:${s.bg}; color:${s.fg}`}>Aa</span>
                  {s.name}
                </div>
                <div class="tb-wcag-ratio">{s.ratio}:1</div>
                <div class="tb-wcag-level {levelClass(s.level)}">{s.level}</div>
                {#if s.level === 'Fail'}
                  <button type="button" class="tb-wcag-fix" onclick={() => autoFixScore(s)}
                    title="Shift the text color toward black or white until this pair reaches AA contrast">
                    Fix
                  </button>
                {/if}
              </div>
            {/each}
          </div>
          <p class="tb-wcag-foot">
            <strong>AA</strong> = 4.5:1 (body), <strong>AAA</strong> = 7:1. Large text uses 3:1 / 4.5:1.
          </p>
        </div>
      {/if}
    </aside>
  </div>

  {#if resetConfirmOpen}
    <div class="tb-modal-backdrop" onclick={() => (resetConfirmOpen = false)} role="presentation">
      <div class="tb-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Confirm reset">
        <header class="tb-modal-head">
          <h2>Reset to defaults?</h2>
          <button type="button" class="tb-modal-close" onclick={() => (resetConfirmOpen = false)} aria-label="Close">×</button>
        </header>
        <div class="tb-modal-body">
          <p>This restores the brand color, palette, layout, typography, and every tab back to their defaults. Saved themes and current undo history are kept.</p>
        </div>
        <footer class="tb-modal-foot">
          <button type="button" class="tb-btn tb-btn-ghost" onclick={() => (resetConfirmOpen = false)}>Cancel</button>
          <button type="button" class="tb-btn tb-btn-danger" onclick={confirmReset}>Reset everything</button>
        </footer>
      </div>
    </div>
  {/if}

  {#if shortcutsOpen}
    <div class="tb-modal-backdrop" onclick={() => (shortcutsOpen = false)} role="presentation">
      <div class="tb-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts">
        <header class="tb-modal-head">
          <h2>Keyboard shortcuts</h2>
          <button type="button" class="tb-modal-close" onclick={() => (shortcutsOpen = false)} aria-label="Close">×</button>
        </header>
        <div class="tb-modal-body">
          <dl class="tb-shortcut-list">
            <dt><kbd>1</kbd>–<kbd>8</kbd></dt><dd>Switch tab (Brand → Type)</dd>
            <dt><kbd>Ctrl</kbd>+<kbd>Z</kbd></dt><dd>Undo</dd>
            <dt><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> · <kbd>Ctrl</kbd>+<kbd>Y</kbd></dt><dd>Redo</dd>
            <dt><kbd>?</kbd></dt><dd>Toggle this overlay</dd>
            <dt><kbd>Esc</kbd></dt><dd>Close this overlay</dd>
          </dl>
        </div>
      </div>
    </div>
  {/if}
</section>

<style>
  /* Pin the page to the viewport so nothing can trigger a body scrollbar
     toggle. Without this, any width/height oscillation (Windows-classic
     scrollbars appearing/disappearing) caused the whole workspace to
     shimmy on every interaction. */
  .tb-page {
    font-family: Inter, ui-sans-serif, system-ui;
    position: fixed;
    inset: 64px 0 0 0;
    display: flex; flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
  }

  .tb-page-head {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 16px; margin-bottom: 12px;
  }
  .tb-eyebrow {
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
    font-weight: 700; color: var(--site-accent, #2563eb);
    margin-bottom: 4px;
  }
  .tb-title { font-size: 22px; font-weight: 800; line-height: 1.15; color: var(--site-fg, #0f172a); margin: 0 0 4px; letter-spacing: -0.01em; }
  .tb-lede { margin: 0; color: var(--site-muted, #475569); font-size: 13px; max-width: 78ch; }
  .tb-page-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .tb-undo-group { display: inline-flex; gap: 2px; padding: 2px; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 6px; background: var(--site-bg, #ffffff); }
  .tb-btn-icon { padding: 4px 6px; min-width: 26px; min-height: 26px; display: inline-flex; align-items: center; justify-content: center; }
  .tb-btn-icon:disabled { opacity: 0.35; cursor: default; }

  .tb-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--site-bg, #ffffff);
    color: var(--site-fg, #0f172a);
    padding: 6px 12px; border-radius: 6px;
    font-size: 12.5px; cursor: pointer;
  }
  .tb-btn:hover { background: var(--sg-header-bg, #f1f5f9); }
  .tb-btn:disabled { opacity: 0.5; cursor: default; }
  .tb-btn-ghost { color: var(--site-muted, #64748b); }
  .tb-btn-danger {
    border-color: rgba(239, 68, 68, 0.55);
    background: rgba(239, 68, 68, 0.10);
    color: rgb(220, 38, 38);
  }
  .tb-btn-danger:hover { background: rgba(239, 68, 68, 0.18); }

  /* Modal (reset confirm + shortcuts overlay) */
  .tb-modal-backdrop {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(15, 23, 42, 0.55);
    display: flex; align-items: center; justify-content: center;
    animation: tb-fade 120ms ease;
  }
  @keyframes tb-fade { from { opacity: 0 } to { opacity: 1 } }
  .tb-modal {
    background: var(--site-bg, #ffffff);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 10px;
    min-width: 360px; max-width: 520px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.30);
    color: var(--site-fg, #0f172a);
  }
  .tb-modal-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .tb-modal-head h2 { margin: 0; font-size: 15px; font-weight: 700; }
  .tb-modal-close { border: 0; background: transparent; color: var(--site-muted, #64748b); font-size: 22px; cursor: pointer; line-height: 1; padding: 0 6px; }
  .tb-modal-close:hover { color: var(--site-fg, #0f172a); }
  .tb-modal-body { padding: 16px 18px; font-size: 13px; line-height: 1.55; }
  .tb-modal-body p { margin: 0; color: var(--site-muted, #475569); }
  .tb-modal-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--sg-border, #e2e8f0); }

  .tb-shortcut-list { display: grid; grid-template-columns: max-content 1fr; gap: 6px 18px; margin: 0; align-items: baseline; }
  .tb-shortcut-list dt { margin: 0; font-size: 12px; }
  .tb-shortcut-list dd { margin: 0; color: var(--site-muted, #475569); font-size: 13px; }
  .tb-shortcut-list kbd {
    font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11px;
    background: var(--sg-header-bg, #f1f5f9);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-bottom-width: 2px;
    border-radius: 4px;
    padding: 1px 5px;
    color: var(--site-fg, #0f172a);
  }

  /* Per-tab reset link */
  .tb-panel-reset { padding: 8px 14px 12px; border-top: 1px dashed rgba(148, 163, 184, 0.30); margin-top: 4px; }
  .tb-reset-link {
    display: inline-flex; align-items: center; gap: 5px;
    border: 0; background: transparent;
    color: var(--site-muted, #64748b);
    font-size: 11px; font-weight: 500;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
  }
  .tb-reset-link:hover { background: rgba(148, 163, 184, 0.12); color: var(--site-fg, #0f172a); }

  /* Mode pill in the page header */
  .tb-mode-pill {
    display: inline-flex;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 999px;
    overflow: hidden;
    background: var(--site-bg, #ffffff);
  }
  .tb-mode-pill button {
    display: inline-flex; align-items: center; gap: 6px;
    border: 0; background: transparent;
    color: var(--site-muted, #64748b);
    padding: 5px 11px;
    font-size: 12px;
    cursor: pointer;
  }
  .tb-mode-pill button.active {
    background: var(--site-fg, #0f172a);
    color: var(--site-bg, #ffffff);
    font-weight: 700;
  }
  .tb-mode-pill button:hover { background: var(--sg-header-bg, #f1f5f9); }
  .tb-mode-pill button.active:hover { background: var(--site-fg, #0f172a); }

  /* Preset row labels + mini swatches */
  .tb-presets-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--site-muted, #64748b);
    padding-right: 4px;
    align-self: center;
  }
  .tb-preset-name { font-weight: 500; }
  .tb-preset-mini {
    position: relative;
    width: 24px; height: 16px;
    border-radius: 3px;
    box-shadow: 0 0 0 1px rgba(15,23,42,0.10);
    overflow: hidden;
  }
  .tb-preset-mini-hdr {
    position: absolute; top: 0; left: 0; right: 0;
    height: 5px;
  }
  .tb-preset-mini-dot {
    position: absolute; right: 2px; bottom: 2px;
    width: 6px; height: 6px; border-radius: 999px;
    box-shadow: 0 0 0 1px rgba(15,23,42,0.20);
  }

  /* Brand section headline */
  .tb-sect-headline { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
  .tb-sect-headline h3 { margin: 0; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; color: var(--site-muted, #64748b); }
  .tb-sect-headline-aside { font-size: 10.5px; color: var(--site-muted, #94a3b8); }

  .tb-row-expand-toggle { margin-top: 10px; gap: 6px; font-size: 11px; }
  .tb-text-link { border: 0; background: transparent; padding: 0; color: var(--site-accent, #2563eb); cursor: pointer; font-size: 11px; }
  .tb-text-link:hover { text-decoration: underline; }
  .tb-link-sep { color: var(--site-muted, #cbd5e1); }

  .tb-import { margin-bottom: 12px; border: 1px dashed var(--sg-border, #cbd5e1); border-radius: 8px; padding: 10px 12px; background: var(--site-bg, #ffffff); }
  .tb-import-head { display: block; font-weight: 700; font-size: 12px; margin-bottom: 6px; }
  .tb-import-head code { background: var(--sg-header-bg, #f1f5f9); padding: 1px 5px; border-radius: 3px; font-family: ui-monospace, monospace; }
  .tb-import textarea { width: 100%; min-height: 100px; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 5px; padding: 8px 10px; font-family: ui-monospace, monospace; font-size: 12px; background: var(--site-bg, #ffffff); color: var(--site-fg, #0f172a); }
  .tb-import-foot { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  .tb-import-msg { font-size: 12px; color: #15803d; font-weight: 600; }

  .tb-presets {
    display: flex; flex-wrap: wrap; gap: 6px;
    align-items: center;
    padding: 10px 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    background: var(--site-bg, #ffffff);
    margin-bottom: 14px;
  }
  .tb-preset {
    display: inline-flex; align-items: center; gap: 8px;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--site-bg, #ffffff);
    padding: 5px 12px; border-radius: 6px;
    font-size: 12px; cursor: pointer; color: var(--site-fg, #0f172a);
    transition: transform 100ms ease, border-color 100ms ease, box-shadow 100ms ease;
  }
  .tb-preset.active {
    border-color: var(--site-accent, #2563eb);
    box-shadow: 0 0 0 2px rgba(99,102,241,0.18);
    font-weight: 700;
  }
  .tb-preset:hover { background: var(--sg-header-bg, #f1f5f9); transform: translateY(-1px); }

  .tb-grid {
    display: grid;
    grid-template-columns: 200px 320px minmax(0, 1fr) 360px;
    gap: 12px;
    /* Flex into the locked .tb-page viewport instead of computing vh math. */
    flex: 1;
    min-height: 0;
  }
  @media (max-width: 1280px) {
    .tb-grid { grid-template-columns: 180px 300px minmax(0, 1fr); }
    /* Right rail drops below the preview on narrow desktops so the rail
       doesn't compete with the grid for horizontal space. */
    .tb-rightrail {
      grid-column: 1 / -1;
      max-height: 320px;
    }
  }
  @media (max-width: 900px) {
    /* Stack everything vertically. Page becomes scrollable since
       content no longer fits the viewport. */
    .tb-page {
      position: static;
      inset: auto;
      height: auto;
      min-height: calc(100vh - 64px);
      overflow: visible;
    }
    .tb-grid {
      display: flex;
      flex-direction: column;
      flex: none;
      gap: 10px;
    }
    .tb-page-head { flex-direction: column; align-items: flex-start; }
    .tb-page-actions { width: 100%; }
    /* Sidebar nav -> horizontal scrollable tab strip */
    .tb-sidenav { padding: 6px 6px; overflow-x: auto; overflow-y: hidden; }
    .tb-sidenav-head { display: none; }
    .tb-sidenav nav { flex-direction: row; gap: 4px; }
    .tb-sidenav-link {
      flex: none;
      grid-template-columns: 16px auto;
      padding: 6px 10px;
      border-left: 0;
      border-bottom: 2px solid transparent;
    }
    .tb-sidenav-link.active {
      border-left-color: transparent;
      border-bottom-color: var(--site-accent, #2563eb);
    }
    .tb-sidenav-textbox { flex-direction: row; }
    .tb-sidenav-desc, .tb-sidenav-arrow { display: none; }
    /* Controls + rail caps (preview-card sized in the late @media at the
       bottom of this stylesheet so it wins over the desktop base rule). */
    .tb-controls { height: auto; max-height: 60vh; }
    .tb-export-inner, .tb-wcag-inner { max-height: 320px; overflow: auto; }
    /* Page-header presets row wraps cleanly */
    .tb-presets { overflow-x: auto; flex-wrap: nowrap; }
  }
  @media (max-width: 600px) {
    .tb-title { font-size: 18px; }
    .tb-lede { display: none; }
    .tb-page-actions .tb-btn { font-size: 11px; padding: 4px 8px; }
  }

  /* LEFT sidebar nav - docs-style */
  .tb-sidenav { padding: 12px 8px; overflow: auto; }
  .tb-sidenav-head {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.07em;
    color: var(--site-muted, #64748b); font-weight: 700;
    padding: 4px 10px 8px;
  }
  .tb-sidenav nav { display: flex; flex-direction: column; gap: 2px; }
  .tb-sidenav-link {
    border: 0; background: transparent;
    text-align: left;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    color: var(--site-fg, #0f172a);
    display: grid;
    grid-template-columns: 18px 1fr 12px;
    align-items: center;
    gap: 8px;
    border-left: 2px solid transparent;
  }
  .tb-sidenav-link:hover { background: var(--sg-header-bg, #f1f5f9); }
  .tb-sidenav-link.active {
    background: rgba(99, 102, 241, 0.10);
    border-left-color: var(--site-accent, #2563eb);
    color: var(--site-accent, #2563eb);
  }
  .tb-sidenav-icon { color: var(--site-muted, #64748b); display: inline-flex; }
  .tb-sidenav-link.active .tb-sidenav-icon { color: var(--site-accent, #2563eb); }
  .tb-sidenav-textbox { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .tb-sidenav-label { font-size: 13px; font-weight: 600; }
  .tb-sidenav-link.active .tb-sidenav-label { font-weight: 700; }
  .tb-sidenav-desc  { font-size: 10.5px; color: var(--site-muted, #94a3b8); font-weight: 400; }
  .tb-sidenav-link.active .tb-sidenav-desc { color: rgba(99, 102, 241, 0.75); }
  .tb-sidenav-arrow {
    color: var(--site-muted, #94a3b8);
    font-size: 14px; line-height: 1;
    opacity: 0; transition: opacity 100ms ease, transform 100ms ease;
  }
  .tb-sidenav-link:hover .tb-sidenav-arrow,
  .tb-sidenav-link.active .tb-sidenav-arrow { opacity: 1; }
  .tb-sidenav-link.active .tb-sidenav-arrow { color: var(--site-accent, #2563eb); transform: translateX(2px); }

  .tb-card {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--site-bg, #ffffff);
    overflow: hidden;
  }
  .tb-controls {
    padding: 0;
    display: flex; flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  /* Tab strip */
  .tb-tab-strip {
    display: flex;
    overflow-x: auto;
    padding: 4px 6px 0;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    gap: 2px;
    flex-shrink: 0;
  }
  .tb-tab {
    border: 0; background: transparent;
    padding: 8px 12px;
    font-size: 12px;
    color: var(--site-muted, #64748b);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    border-radius: 4px 4px 0 0;
    white-space: nowrap;
  }
  .tb-tab:hover { background: var(--sg-header-bg, #f1f5f9); color: var(--site-fg, #0f172a); }
  .tb-tab.active {
    color: var(--site-fg, #0f172a);
    font-weight: 700;
    border-bottom-color: var(--site-accent, #2563eb);
  }
  .tb-tab-panel { flex: 1; min-height: 0; overflow: auto; }
  .tb-panel { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
  .tb-panel-grouped { padding: 6px 0; gap: 0; }
  .tb-field-row { display: flex; align-items: baseline; justify-content: space-between; }
  .tb-field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--site-muted, #64748b); }
  .tb-field-hint { font-size: 10.5px; color: var(--site-muted, #94a3b8); }
  .tb-row-label { font-size: 11px; color: var(--site-muted, #64748b); margin-top: 4px; }
  .tb-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .tb-fullwidth { width: 100%; }

  /* Handsontable-style collapsible sub-section groups */
  .tb-group { border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .tb-group:last-child { border-bottom: 0; }
  .tb-group[open] { background: color-mix(in srgb, var(--site-accent, #2563eb) 3%, transparent); }
  .tb-group-head {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 14px;
    list-style: none;
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--site-fg, #0f172a);
    user-select: none;
  }
  .tb-group-head::-webkit-details-marker { display: none; }
  .tb-group-head:hover { background: var(--sg-header-bg, #f1f5f9); }
  .tb-group-chev {
    width: 0; height: 0;
    border-left: 4px solid currentColor;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    color: var(--site-muted, #94a3b8);
    transition: transform 140ms ease;
    transform: rotate(0deg);
    flex-shrink: 0;
  }
  .tb-group[open] > .tb-group-head .tb-group-chev { transform: rotate(90deg); color: var(--site-accent, #2563eb); }
  .tb-group-hint { margin-left: auto; font-size: 10.5px; color: var(--site-muted, #94a3b8); font-weight: 400; }
  .tb-group-body { padding: 4px 14px 12px; display: flex; flex-direction: column; gap: 8px; }

  /* Saved themes footer */
  .tb-controls-foot {
    flex-shrink: 0;
    padding: 8px 12px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    background: var(--site-bg-elev, #f8fafc);
    display: flex; align-items: center; gap: 6px;
    flex-wrap: wrap;
  }
  .tb-controls-foot input {
    flex: 1; min-width: 100px;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--site-bg, #ffffff);
    border-radius: 5px;
    padding: 4px 8px; font-size: 12px;
  }
  .tb-btn-sm { padding: 4px 10px; font-size: 11.5px; }
  .tb-saved-chips { display: flex; gap: 4px; flex-wrap: wrap; width: 100%; }
  .tb-saved-chip {
    display: inline-flex; align-items: center;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 999px;
    background: var(--site-bg, #ffffff);
    overflow: hidden;
  }
  .tb-saved-chip button {
    border: 0; background: transparent;
    padding: 2px 8px; font-size: 11px;
    cursor: pointer;
    color: var(--site-fg, #1e293b);
  }
  .tb-saved-chip button:hover { color: var(--site-accent, #2563eb); }
  .tb-saved-chip button.x { color: var(--site-muted, #94a3b8); padding: 2px 6px; }
  .tb-saved-chip button.x:hover { color: #dc2626; }
  .tb-sect {
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .tb-sect:last-child { border-bottom: 0; }
  .tb-sect-fixed { padding: 12px 16px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .tb-sect-fixed h3 { margin: 0 0 8px; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; color: var(--site-muted, #64748b); }
  .tb-sect-head {
    width: 100%; display: flex; align-items: center; gap: 8px;
    padding: 10px 16px;
    border: 0; background: transparent;
    cursor: pointer;
    text-align: left;
    font-size: 12.5px; font-weight: 700;
    color: var(--site-fg, #0f172a);
  }
  .tb-sect-head:hover { background: var(--sg-header-bg, #f8fafc); }
  .tb-sect-chev { display: inline-block; width: 12px; transition: transform 140ms ease; color: var(--site-muted, #64748b); }
  .tb-sect-chev.open { transform: rotate(90deg); }
  .tb-sect-hint { margin-left: auto; font-size: 10.5px; color: var(--site-muted, #94a3b8); font-weight: 400; }
  .tb-sect-body { padding: 4px 16px 12px; display: flex; flex-direction: column; gap: 8px; }

  .tb-row { display: flex; align-items: center; gap: 8px; }
  .tb-row input[type='color'] { width: 44px; height: 32px; padding: 0; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 6px; cursor: pointer; }
  .tb-hex { flex: 1; border: 1px solid var(--sg-border, #cbd5e1); background: var(--site-bg, #ffffff); border-radius: 5px; padding: 5px 8px; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; }

  .tb-seg {
    display: inline-flex; width: 100%;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 5px; overflow: hidden;
  }
  .tb-seg button { flex: 1; border: 0; background: transparent; padding: 5px 10px; font-size: 11.5px; cursor: pointer; color: var(--site-fg, #1e293b); }
  .tb-seg button.active { background: var(--site-accent, #2563eb); color: #fff; font-weight: 700; }

  .tb-mode-toggle { display: inline-flex; width: 100%; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 4px; overflow: hidden; }
  .tb-mode-toggle button { flex: 1; border: 0; background: transparent; padding: 3px 8px; font-size: 11px; cursor: pointer; color: var(--site-fg, #1e293b); text-transform: none; letter-spacing: 0; font-weight: 500; }
  .tb-mode-toggle button.active { background: var(--site-accent, #2563eb); color: #fff; font-weight: 700; }

  .tb-slider { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; color: var(--site-muted, #64748b); }
  .tb-slider strong { color: var(--site-fg, #1e293b); font-variant-numeric: tabular-nums; }
  .tb-slider select {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--site-bg, #ffffff);
    border-radius: 5px; padding: 4px 8px; font-size: 12px;
  }
  input[type='range'] { width: 100%; accent-color: var(--site-accent, #2563eb); }
  .tb-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; }

  .tb-col-color {
    display: grid;
    grid-template-columns: 26px 1fr 22px;
    align-items: center; gap: 8px;
    font-size: 12px;
  }
  .tb-col-color input[type='color'] {
    width: 24px; height: 24px; padding: 0;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 4px; cursor: pointer;
  }
  .tb-col-color input[type='color']:hover { box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.18); }
  .tb-col-color-label { font-weight: 500; color: var(--site-fg, #0f172a); }
  .tb-col-reset {
    border: 0; background: transparent;
    color: var(--site-muted, #94a3b8);
    cursor: pointer;
    border-radius: 3px;
    font-size: 13px;
    width: 22px; height: 22px;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .tb-col-reset:hover:not(:disabled) {
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--site-fg, #1e293b);
  }
  .tb-col-reset:disabled { opacity: 0.35; cursor: default; }

  .tb-token { display: grid; grid-template-columns: 26px 1fr auto auto; align-items: center; gap: 8px; font-size: 12px; position: relative; padding: 2px 4px; border-radius: 4px; transition: background 100ms ease; cursor: default; }
  .tb-token:hover { background: rgba(99,102,241,0.06); }
  .tb-token input[type='color'] { width: 24px; height: 24px; padding: 0; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 4px; cursor: pointer; }
  .tb-token input[type='color']:hover { box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.18); }
  .tb-token-name { font-weight: 500; color: var(--site-fg, #0f172a); display: inline-flex; align-items: center; gap: 6px; }
  /* Override indicator: a small accent dot next to the name when the token
     was manually changed away from its auto-derived value. Helps the user
     see at a glance what they've customised. */
  .tb-token.overridden .tb-token-name::before {
    content: '';
    width: 6px; height: 6px;
    border-radius: 999px;
    background: var(--site-accent, #6366f1);
    box-shadow: 0 0 0 2px rgba(99,102,241,0.18);
    flex: none;
  }
  .tb-token-key {
    font-family: ui-monospace, monospace;
    font-size: 10px;
    color: var(--site-muted, #94a3b8);
    background: var(--sg-header-bg, #f1f5f9);
    padding: 1px 6px;
    border-radius: 3px;
  }
  .tb-token-val { color: var(--site-muted, #64748b); font-family: ui-monospace, monospace; font-size: 10.5px; }
  .tb-hint { margin: 5px 0 0; font-size: 11px; color: var(--site-muted, #94a3b8); }

  .tb-saved-sect { padding: 12px 16px; }
  .tb-saved-sect h3 { margin: 0 0 8px; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; color: var(--site-muted, #64748b); }
  .tb-saved-form { display: flex; gap: 6px; margin-bottom: 6px; }
  .tb-saved-form input { flex: 1; border: 1px solid var(--sg-border, #cbd5e1); background: var(--site-bg, #ffffff); border-radius: 5px; padding: 5px 8px; font-size: 12px; }
  .tb-saved-list { list-style: none; padding: 0; margin: 6px 0 0; display: flex; flex-direction: column; gap: 4px; }
  .tb-saved-list li { display: flex; align-items: center; gap: 4px; padding: 2px 4px; border-radius: 4px; background: var(--sg-header-bg, #f8fafc); font-size: 11.5px; }
  .tb-saved-load { flex: 1; border: 0; background: transparent; padding: 4px 8px; text-align: left; cursor: pointer; color: var(--site-fg, #0f172a); font-size: 11.5px; }
  .tb-saved-load:hover { color: var(--site-accent, #2563eb); }
  .tb-saved-del { border: 0; background: transparent; cursor: pointer; color: var(--site-muted, #94a3b8); font-size: 14px; padding: 0 6px; }
  .tb-saved-del:hover { color: #dc2626; }

  /* CENTER */
  .tb-preview { display: flex; flex-direction: column; gap: 12px; min-width: 0; height: 100%; }
  .tb-preview-card { border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; background: var(--site-bg, #ffffff); display: flex; flex-direction: column; overflow: hidden; flex: 1; min-height: 0; }
  .tb-preview-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; transition: background 200ms ease, color 200ms ease, border-color 200ms ease; }
  .tb-preview-eyebrow { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
  .tb-preview-meta { font-size: 11px; opacity: 0.7; font-variant-numeric: tabular-nums; }
  .tb-grid-wrap { flex: 1; min-height: 0; margin: 14px; transition: background 200ms ease, color 200ms ease, border-color 200ms ease, border-radius 200ms ease; }

  /* WCAG */
  .tb-wcag {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--site-bg, #ffffff);
    color: var(--site-fg, #0f172a);
    padding: 14px 16px;
  }
  .tb-wcag-head { display: flex; align-items: center; justify-content: space-between; margin: 0 0 10px; }
  .tb-wcag h3 { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; color: var(--site-muted, #64748b); margin: 0; }
  .tb-wcag-badge {
    font-size: 10.5px; font-weight: 800;
    padding: 2px 9px; border-radius: 999px;
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .tb-wcag-badge.pass { background: rgba(34,197,94,0.18); color: #15803d; }
  .tb-wcag-badge.fail { background: rgba(239,68,68,0.18); color: #b91c1c; }
  .tb-wcag-row.fail { background: rgba(239,68,68,0.06); border-left: 3px solid rgba(239,68,68,0.6); padding-left: 7px; }
  .tb-wcag-grid { display: flex; flex-direction: column; gap: 6px; }
  .tb-wcag-row {
    display: grid; grid-template-columns: 1fr auto auto auto;
    align-items: center; gap: 12px;
    padding: 6px 10px; border-radius: 6px;
    background: rgba(148, 163, 184, 0.12);
    color: var(--site-fg, #0f172a);
  }
  .tb-wcag-name {
    display: flex; align-items: center; gap: 8px;
    font-size: 12.5px;
    color: var(--site-fg, #0f172a);
  }
  .tb-wcag-swatch { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 24px; border-radius: 4px; font-size: 11px; font-weight: 700; border: 1px solid rgba(15,23,42,0.10); }
  .tb-wcag-ratio { font-variant-numeric: tabular-nums; font-size: 12px; color: var(--site-muted, #64748b); }
  .tb-wcag-fix {
    border: 1px solid rgba(239, 68, 68, 0.5);
    background: rgba(239, 68, 68, 0.10);
    color: rgb(220, 38, 38);
    border-radius: 5px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 100ms ease;
  }
  .tb-wcag-fix:hover { background: rgba(239, 68, 68, 0.18); }
  .tb-wcag-inner .tb-wcag-fix { color: #fda4af; }
  .tb-wcag-level { font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.06em; }
  .level-aaa { background: rgba(34,197,94,0.18); color: #15803d; }
  .level-aa { background: rgba(245,158,11,0.18); color: #b45309; }
  .level-fail { background: rgba(239,68,68,0.18); color: #b91c1c; }
  .tb-wcag-foot { margin: 10px 0 0; font-size: 11px; color: var(--site-muted, #64748b); }

  /* EXPORT */
  /* Right rail */
  .tb-rightrail { display: flex; flex-direction: column; background: #0f172a; border-color: #1e293b; height: 100%; overflow: hidden; }
  .tb-rail-tabs {
    display: flex;
    background: #0c1729;
    border-bottom: 1px solid rgba(148,163,184,0.20);
    flex-shrink: 0;
  }
  .tb-rail-tabs button {
    flex: 1; border: 0; background: transparent;
    padding: 10px 12px;
    font-size: 12px; font-weight: 600;
    color: #94a3b8;
    cursor: pointer;
    border-bottom: 2px solid transparent;
  }
  .tb-rail-tabs button.active { color: #e2e8f0; border-bottom-color: var(--site-accent, #2563eb); background: #0f172a; }
  .tb-rail-tabs button:hover:not(.active) { background: rgba(148,163,184,0.06); }
  .tb-export-inner { display: flex; flex-direction: column; flex: 1; min-height: 0; }
  .tb-wcag-inner { display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 12px 14px; overflow: auto; color: #e2e8f0; }
  .tb-wcag-inner .tb-wcag-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .tb-wcag-inner .tb-wcag-row {
    display: grid; grid-template-columns: 1fr auto auto auto; align-items: center; gap: 8px;
    padding: 6px 8px; border-radius: 5px;
    background: rgba(148, 163, 184, 0.10);
    color: #e2e8f0;
    margin-bottom: 4px;
    font-size: 11.5px;
  }
  .tb-wcag-inner .tb-wcag-row.fail { background: rgba(239,68,68,0.16); border-left: 3px solid rgba(239,68,68,0.7); padding-left: 6px; }
  .tb-wcag-inner .tb-wcag-name { font-size: 11.5px; color: #e2e8f0; }
  .tb-wcag-inner .tb-wcag-ratio { color: #94a3b8; }
  .tb-wcag-inner .tb-wcag-foot { color: #94a3b8; font-size: 10.5px; margin-top: 8px; }
  .tb-wcag-head-mode { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }

  .tb-export { display: flex; flex-direction: column; background: #0f172a; border-color: #1e293b; min-height: 0; flex: 1; }
  .tb-export-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid rgba(148,163,184,0.20); }
  .tb-seg-export { width: auto; border-color: rgba(148,163,184,0.30); }
  .tb-seg-export button { color: #cbd5e1; font-size: 11px; }
  .tb-seg-export button:not(.active):hover { background: rgba(148,163,184,0.12); }
  .tb-btn-copy { border: 1px solid rgba(148,163,184,0.30); background: rgba(148,163,184,0.08); color: #e2e8f0; padding: 4px 12px; border-radius: 5px; font-size: 11.5px; font-weight: 700; cursor: pointer; }
  .tb-btn-copy:hover { background: rgba(148,163,184,0.18); }
  .tb-export-actions { display: inline-flex; align-items: center; gap: 10px; }
  .tb-export-diff { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #cbd5e1; cursor: pointer; user-select: none; }
  .tb-export-diff input { accent-color: #6366f1; }
  .tb-install { border-top: 1px solid rgba(148,163,184,0.20); }
  .tb-install summary { padding: 8px 12px; cursor: pointer; font-size: 11px; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.06em; list-style: none; }
  .tb-install summary::-webkit-details-marker { display: none; }
  .tb-install summary::before { content: '▸'; display: inline-block; margin-right: 6px; transition: transform 120ms ease; color: #94a3b8; }
  .tb-install[open] summary::before { transform: rotate(90deg); }
  .tb-install-body { padding: 0 14px 12px; font-size: 11.5px; color: #cbd5e1; line-height: 1.5; }
  .tb-install-body p { margin: 6px 0 8px; }
  .tb-install-body code { background: rgba(148,163,184,0.14); color: #e2e8f0; padding: 1px 5px; border-radius: 3px; font-family: ui-monospace, monospace; font-size: 11px; }
  .tb-install-body pre { background: rgba(0,0,0,0.30); padding: 8px 10px; border-radius: 5px; color: #cbd5e1; font-size: 11px; line-height: 1.45; overflow: auto; margin: 6px 0; }
  .tb-install-body pre code { background: transparent; padding: 0; }
  .tb-code { flex: 1; margin: 0; color: #e2e8f0; padding: 12px 14px; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11.5px; line-height: 1.55; overflow: auto; }
  .tb-export-foot { padding: 8px 12px; border-top: 1px solid rgba(148,163,184,0.20); color: #94a3b8; font-size: 11px; }

  /* ---- Mobile preview sizing -----------------------------------
     Must sit after the desktop .tb-preview / .tb-preview-card / .tb-grid-wrap
     rules so it wins by source order at equal specificity. The earlier
     @media block above runs before those base rules and was being
     overridden, collapsing the SvGrid to 0px height. */
  @media (max-width: 900px) {
    .tb-preview { display: block; height: auto; flex: none; }
    .tb-preview-card { display: flex; flex-direction: column; flex: none; height: 460px; min-height: 460px; }
    .tb-grid-wrap { flex: 1; min-height: 0; }
    .tb-rightrail { height: 360px; max-height: 360px; }
  }
</style>
