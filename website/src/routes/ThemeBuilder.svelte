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
  } from 'sv-grid-community'
  import { onMount } from 'svelte'

  // ---- Preview dataset -----------------------------------------------
  type Subscription = {
    id: string
    customer: string
    plan: 'Free' | 'Pro' | 'Team' | 'Enterprise'
    mrr: number
    seats: number
    renewal: string
    status: 'Active' | 'Trialing' | 'Past due' | 'Churned'
  }
  const rows: Subscription[] = [
    { id: 'SUB-001', customer: 'Acme',     plan: 'Enterprise', mrr: 12400, seats: 240, renewal: '2026-08-14', status: 'Active' },
    { id: 'SUB-002', customer: 'Globex',   plan: 'Team',       mrr:  4200, seats: 48,  renewal: '2026-07-02', status: 'Active' },
    { id: 'SUB-003', customer: 'Initech',  plan: 'Pro',        mrr:   190, seats: 5,   renewal: '2026-06-21', status: 'Trialing' },
    { id: 'SUB-004', customer: 'Umbrella', plan: 'Enterprise', mrr: 19800, seats: 412, renewal: '2026-09-30', status: 'Active' },
    { id: 'SUB-005', customer: 'Vandelay', plan: 'Team',       mrr:  3650, seats: 36,  renewal: '2026-08-08', status: 'Past due' },
    { id: 'SUB-006', customer: 'Pied P.',  plan: 'Pro',        mrr:   260, seats: 8,   renewal: '2026-07-19', status: 'Active' },
    { id: 'SUB-007', customer: 'Hooli',    plan: 'Enterprise', mrr: 28100, seats: 720, renewal: '2026-12-01', status: 'Active' },
    { id: 'SUB-008', customer: 'Wonka',    plan: 'Team',       mrr:  2900, seats: 28,  renewal: '2026-06-30', status: 'Active' },
    { id: 'SUB-009', customer: 'Tyrell',   plan: 'Pro',        mrr:   120, seats: 3,   renewal: '2026-06-15', status: 'Churned' },
    { id: 'SUB-010', customer: 'Stark',    plan: 'Enterprise', mrr: 17600, seats: 320, renewal: '2026-11-22', status: 'Active' },
  ]
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const columns: ColumnDef<typeof features, Subscription>[] = [
    { field: 'id',       header: 'ID',       width: 90  },
    { field: 'customer', header: 'Customer', width: 140 },
    { field: 'plan',     header: 'Plan',     width: 110 },
    { field: 'mrr',      header: 'MRR',      width: 110, align: 'right',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'seats',    header: 'Seats',    width: 80, align: 'right' },
    { field: 'renewal',  header: 'Renewal',  width: 110, format: { type: 'date', pattern: 'y-m-d' } },
    { field: 'status',   header: 'Status',   width: 110 },
  ]

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
    rightAlignNumeric: true,
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
  let headerBottomBorderWidth = $state<number>(DEFAULTS.headerBottomBorderWidth)
  let headerShadow = $state<boolean>(DEFAULTS.headerShadow)
  let colDividerStyle = $state<'none' | 'solid' | 'dashed' | 'dotted'>(DEFAULTS.colDividerStyle)
  let colDividerWidth = $state<number>(DEFAULTS.colDividerWidth)
  let firstColEmphasis = $state<boolean>(DEFAULTS.firstColEmphasis)
  let firstColBg = $state<string>(DEFAULTS.firstColBg)
  let firstColWeight = $state<number>(DEFAULTS.firstColWeight)
  let altColumns = $state<boolean>(DEFAULTS.altColumns)
  let altColumnBg = $state<string>(DEFAULTS.altColumnBg)
  let rightAlignNumeric = $state<boolean>(DEFAULTS.rightAlignNumeric)
  let zebra    = $state<boolean>(DEFAULTS.zebra)
  let tokenMode = $state<'auto' | 'manual'>(DEFAULTS.tokenMode)
  let activePreset = $state<string | null>(null)

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
    headerBottomBorderWidth = DEFAULTS.headerBottomBorderWidth
    headerShadow = DEFAULTS.headerShadow
    colDividerStyle = DEFAULTS.colDividerStyle
    colDividerWidth = DEFAULTS.colDividerWidth
    firstColEmphasis = DEFAULTS.firstColEmphasis
    firstColBg = DEFAULTS.firstColBg
    firstColWeight = DEFAULTS.firstColWeight
    altColumns = DEFAULTS.altColumns
    altColumnBg = DEFAULTS.altColumnBg
    rightAlignNumeric = DEFAULTS.rightAlignNumeric
    zebra = DEFAULTS.zebra
    tokenMode = DEFAULTS.tokenMode
    overrides = {}
    activePreset = null
  }

  // ---- WCAG report ---------------------------------------------------
  type Score = { name: string; fg: string; bg: string; ratio: number; level: 'AAA' | 'AA' | 'Fail'; large?: boolean }
  function scoresFor(t: Tokens): Score[] {
    const pairs: Array<{ name: string; fg: string; bg: string; large?: boolean }> = [
      { name: 'Body text',         fg: t.fg,        bg: t.bg },
      { name: 'Muted text',        fg: t.muted,     bg: t.bg },
      { name: 'Header text',       fg: t.headerFg,  bg: t.headerBg },
      { name: 'Accent on bg',      fg: t.accent,    bg: t.bg,        large: true },
      { name: 'Text on alt row',   fg: t.fg,        bg: t.rowAlt },
      { name: 'Text on pinned',    fg: t.fg,        bg: t.pinnedBg },
      { name: 'Header on pinned',  fg: t.headerFg,  bg: t.pinnedHeaderBg },
    ]
    return pairs.map((p) => {
      const r = contrastRatio(p.fg, p.bg)
      return { ...p, ratio: Math.round(r * 100) / 100, level: wcagLevel(r, p.large ?? false) }
    })
  }
  const activeScores = $derived(scoresFor(activeTokens))

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
  const cssOut = $derived(
`/* SvGrid theme - paste into your global stylesheet */
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
  const jsonOut = $derived(JSON.stringify(
    {
      mode, brand, tokenMode, zebra,
      geometry: { radius, rowHeight, headerHeight, cellPaddingX, cellPaddingY, borderStyle, borderWidth },
      typography: { font, bodyFontSize, bodyFontWeight, headerFontWeight, headerTransform, headerLetterSpacing },
      tokens: { light: lightTokens, dark: darkTokens },
      overrides: tokenMode === 'manual' ? overrides : undefined,
    }, null, 2,
  ))
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
    headerBottomBorderWidth: number;
    headerShadow: boolean;
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
      headerDividerStyle, headerDividerWidth, headerBottomBorderWidth, headerShadow,
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
    headerBottomBorderWidth = s.headerBottomBorderWidth ?? DEFAULTS.headerBottomBorderWidth
    headerShadow     = s.headerShadow ?? DEFAULTS.headerShadow
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
    const headerDivider = headerDividerStyle === 'none'
      ? 'none'
      : headerDividerWidth + 'px ' + headerDividerStyle + ' ' + activeTokens.border
    const headerBottom = headerBottomBorderWidth === 0
      ? 'none'
      : headerBottomBorderWidth + 'px solid ' + activeTokens.border
    const headerShadowCss = headerShadow ? '0 2px 6px rgba(0,0,0,0.10)' : 'none'
    // String-concat builds CSS - template literals with literal {}
    // confuse the svelte preprocessor.
    const parts: string[] = []
    parts.push('.tb-live-instance .sv-grid-cell ')
    parts.push('{ padding: ' + cellPaddingY + 'px ' + cellPaddingX + 'px !important; ')
    parts.push('font-size: ' + bodyFontSize + 'px; ')
    parts.push('font-weight: ' + bodyFontWeight + '; }')
    parts.push(' .tb-live-instance .sv-grid-header-cell ')
    parts.push('{ font-weight: ' + headerFontWeight + ' !important; ')
    parts.push('text-transform: ' + headerTransform + ' !important; ')
    parts.push('letter-spacing: ' + ls + 'em !important; ')
    parts.push('min-height: ' + headerHeight + 'px; ')
    parts.push('height: ' + headerHeight + 'px; ')
    parts.push('padding: 0 ' + headerPaddingX + 'px !important; ')
    parts.push('font-size: ' + headerFontSize + 'px !important; ')
    parts.push('justify-content: ' + (headerAlign === 'left' ? 'flex-start' : headerAlign === 'right' ? 'flex-end' : 'center') + ' !important; ')
    parts.push('text-align: ' + headerAlign + ' !important; ')
    parts.push('border-right: ' + headerDivider + ' !important; }')
    parts.push(' .tb-live-instance .sv-grid-header-cell:last-child { border-right: none !important; }')
    parts.push(' .tb-live-instance .sv-grid-thead ')
    parts.push('{ min-height: ' + headerHeight + 'px; ')
    parts.push('border-bottom: ' + headerBottom + ' !important; ')
    parts.push('box-shadow: ' + headerShadowCss + '; }')
    parts.push(' .tb-live-instance .sv-grid-header-label { text-align: ' + headerAlign + ' !important; width: 100%; }')
    styleEl.textContent = parts.join('')
  })

  // ---- Tabbed controls ----------------------------------------------
  type Tab = 'brand' | 'header' | 'body' | 'rows' | 'cells' | 'pinned' | 'type'
  const TABS: Array<{ id: Tab; label: string; desc: string }> = [
    { id: 'brand',  label: 'Brand',   desc: 'Color & mode' },
    { id: 'header', label: 'Header',  desc: 'Column-header styling' },
    { id: 'body',   label: 'Body',    desc: 'Rows, cells, padding' },
    { id: 'rows',   label: 'States',  desc: 'Hover, selected, focus' },
    { id: 'cells',  label: 'Borders', desc: 'Border style + radius' },
    { id: 'pinned', label: 'Pinned',  desc: 'Pinned-column tokens' },
    { id: 'type',   label: 'Type',    desc: 'Font family' },
  ]
  let activeTab = $state<Tab>('brand')

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

<svelte:head>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" />
</svelte:head>

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
      <button type="button" class="tb-btn" onclick={() => (comparison = !comparison)} title="Show light + dark side by side">
        {comparison ? 'Single view' : 'Compare L/D'}
      </button>
      <button type="button" class="tb-btn" onclick={() => (importOpen = !importOpen)}>Import…</button>
      <button type="button" class="tb-btn" onclick={share}>
        {shareCopied ? '✓ URL copied' : 'Share'}
      </button>
      <button type="button" class="tb-btn" onclick={reset}>Reset</button>
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
          >
            <span class="tb-sidenav-label">{t.label}</span>
            <span class="tb-sidenav-desc">{t.desc}</span>
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
            <div class="tb-token">
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
        <div class="tb-panel">
          <div class="tb-field-row">
            <label class="tb-field-label">Header colors</label>
          </div>
          {#each ['headerBg', 'headerFg', 'accent'] as k (k)}
            <div class="tb-token">
              <input type="color" value={activeTokens[k as keyof Tokens].slice(0, 7)}
                aria-label={`${k} color`}
                oninput={(e) => smartOverride(k as keyof Tokens, (e.target as HTMLInputElement).value)} />
              <span class="tb-token-name">{TOKEN_LABEL[k as keyof Tokens]}</span>
              <code class="tb-token-key">{k}</code>
              <code class="tb-token-val">{activeTokens[k as keyof Tokens]}</code>
            </div>
          {/each}

          <div class="tb-grid-2">
            <label class="tb-slider">
              <span>Height · <strong>{headerHeight}px</strong></span>
              <input type="range" min="28" max="64" step="1" bind:value={headerHeight} oninput={onUserEdit} />
            </label>
            <label class="tb-slider">
              <span>Padding · <strong>{headerPaddingX}px</strong></span>
              <input type="range" min="2" max="32" step="1" bind:value={headerPaddingX} oninput={onUserEdit} />
            </label>
            <label class="tb-slider">
              <span>Font size · <strong>{headerFontSize}px</strong></span>
              <input type="range" min="10" max="18" step="1" bind:value={headerFontSize} oninput={onUserEdit} />
            </label>
            <label class="tb-slider">
              <span>Letter-spacing · <strong>{(headerLetterSpacing / 100).toFixed(2)}em</strong></span>
              <input type="range" min="0" max="20" step="1" bind:value={headerLetterSpacing} oninput={onUserEdit} />
            </label>
          </div>

          <div class="tb-field-row">
            <label class="tb-field-label">Alignment</label>
          </div>
          <div class="tb-seg">
            <button type="button" class:active={headerAlign === 'left'}   onclick={() => { headerAlign = 'left'; onUserEdit() }}>Left</button>
            <button type="button" class:active={headerAlign === 'center'} onclick={() => { headerAlign = 'center'; onUserEdit() }}>Center</button>
            <button type="button" class:active={headerAlign === 'right'}  onclick={() => { headerAlign = 'right'; onUserEdit() }}>Right</button>
          </div>

          <div class="tb-grid-2">
            <label class="tb-slider">
              <span>Weight</span>
              <select bind:value={headerFontWeight} onchange={onUserEdit}>
                <option value={500}>500 medium</option>
                <option value={600}>600 semibold</option>
                <option value={700}>700 bold</option>
                <option value={800}>800 extra-bold</option>
              </select>
            </label>
            <label class="tb-slider">
              <span>Text transform</span>
              <select bind:value={headerTransform} onchange={onUserEdit}>
                <option value="none">none</option>
                <option value="uppercase">UPPERCASE</option>
                <option value="capitalize">Capitalize</option>
              </select>
            </label>
          </div>

          <div class="tb-field-row">
            <label class="tb-field-label">Column divider</label>
            <span class="tb-field-hint">vertical line between header cells</span>
          </div>
          <div class="tb-grid-2">
            <label class="tb-slider">
              <span>Style</span>
              <select bind:value={headerDividerStyle} onchange={onUserEdit}>
                <option value="none">none</option>
                <option value="solid">solid</option>
                <option value="dashed">dashed</option>
                <option value="dotted">dotted</option>
              </select>
            </label>
            <label class="tb-slider">
              <span>Width · <strong>{headerDividerWidth}px</strong></span>
              <input type="range" min="0" max="3" step="1" bind:value={headerDividerWidth} oninput={onUserEdit} />
            </label>
          </div>

          <div class="tb-grid-2">
            <label class="tb-slider">
              <span>Bottom border · <strong>{headerBottomBorderWidth}px</strong></span>
              <input type="range" min="0" max="4" step="1" bind:value={headerBottomBorderWidth} oninput={onUserEdit} />
            </label>
            <label class="tb-toggle">
              <input type="checkbox" bind:checked={headerShadow} onchange={onUserEdit} />
              <span>Sticky shadow</span>
            </label>
          </div>
        </div>
      {/if}

      {#if activeTab === 'body'}
        <div class="tb-panel">
          <div class="tb-grid-2">
            <label class="tb-slider">
              <span>Row height · <strong>{rowHeight}px</strong></span>
              <input type="range" min="24" max="56" step="2" bind:value={rowHeight} oninput={onUserEdit} />
            </label>
            <label class="tb-slider">
              <span>Body font size · <strong>{bodyFontSize}px</strong></span>
              <input type="range" min="11" max="18" step="1" bind:value={bodyFontSize} oninput={onUserEdit} />
            </label>
            <label class="tb-slider">
              <span>Body weight</span>
              <select bind:value={bodyFontWeight} onchange={onUserEdit}>
                <option value={400}>400 regular</option>
                <option value={500}>500 medium</option>
                <option value={600}>600 semibold</option>
              </select>
            </label>
            <label class="tb-slider">
              <span>Cell padding-X · <strong>{cellPaddingX}px</strong></span>
              <input type="range" min="2" max="24" step="1" bind:value={cellPaddingX} oninput={onUserEdit} />
            </label>
            <label class="tb-slider">
              <span>Cell padding-Y · <strong>{cellPaddingY}px</strong></span>
              <input type="range" min="0" max="12" step="1" bind:value={cellPaddingY} oninput={onUserEdit} />
            </label>
          </div>
          <label class="tb-toggle"><input type="checkbox" bind:checked={zebra} onchange={onUserEdit} /><span>Zebra alternating rows</span></label>
          <div class="tb-token">
            <input type="color" value={activeTokens.rowAlt.slice(0, 7)}
              aria-label="rowAlt color"
              oninput={(e) => smartOverride('rowAlt', (e.target as HTMLInputElement).value)} />
            <span class="tb-token-name">Alt-row background</span>
            <code class="tb-token-key">rowAlt</code>
            <code class="tb-token-val">{activeTokens.rowAlt}</code>
          </div>
        </div>
      {/if}

      {#if activeTab === 'rows'}
        <div class="tb-panel">
          <div class="tb-field-row">
            <label class="tb-field-label">Hover, selection, focus</label>
          </div>
          {#each ['rowHover', 'rowHoverFg', 'selectionBg', 'selectionFg', 'focusRing'] as k (k)}
            <div class="tb-token">
              <input type="color"
                value={activeTokens[k as keyof Tokens].startsWith('#')
                  ? activeTokens[k as keyof Tokens].slice(0, 7)
                  : '#888888'}
                aria-label={`${k} color`}
                oninput={(e) => smartOverride(k as keyof Tokens, (e.target as HTMLInputElement).value)} />
              <span class="tb-token-name">{TOKEN_LABEL[k as keyof Tokens]}</span>
              <code class="tb-token-key">{k}</code>
              <code class="tb-token-val">{activeTokens[k as keyof Tokens]}</code>
            </div>
          {/each}
        </div>
      {/if}

      {#if activeTab === 'cells'}
        <div class="tb-panel">
          <div class="tb-grid-2">
            <label class="tb-slider">
              <span>Border style</span>
              <select bind:value={borderStyle} onchange={onUserEdit}>
                <option value="solid">solid</option>
                <option value="dashed">dashed</option>
                <option value="dotted">dotted</option>
                <option value="none">none</option>
              </select>
            </label>
            <label class="tb-slider">
              <span>Border width · <strong>{borderWidth}px</strong></span>
              <input type="range" min="0" max="3" step="1" bind:value={borderWidth} oninput={onUserEdit} />
            </label>
            <label class="tb-slider">
              <span>Corner radius · <strong>{radius}px</strong></span>
              <input type="range" min="0" max="20" step="1" bind:value={radius} oninput={onUserEdit} />
            </label>
          </div>
        </div>
      {/if}

      {#if activeTab === 'pinned'}
        <div class="tb-panel">
          <div class="tb-field-row">
            <label class="tb-field-label">Pinned column tokens</label>
            <span class="tb-field-hint">sticky left / right columns</span>
          </div>
          {#each ['pinnedBg', 'pinnedBorder', 'pinnedHeaderBg'] as k (k)}
            <div class="tb-token">
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
          {@const t = m === 'light' ? lightTokens : darkTokens}
          {@const s = m === 'light' ? lightStyle  : darkStyle}
          <article class="tb-preview-card" data-theme={m}>
            <header class="tb-preview-head" style={`background:${t.headerBg}; color:${t.headerFg}; border-bottom:1px solid ${t.border}`}>
              <span class="tb-preview-eyebrow">{m}</span>
              <span class="tb-preview-meta">{rowHeight}px · radius {radius}px</span>
            </header>
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
          <header class="tb-preview-head" style={`background:${activeTokens.headerBg}; color:${activeTokens.headerFg}; border-bottom:1px solid ${activeTokens.border}`}>
            <span class="tb-preview-eyebrow">Live preview</span>
            <span class="tb-preview-meta">{mode} · {rowHeight}px · radius {radius}px · {borderStyle} {borderWidth}px</span>
          </header>
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
            <button type="button" class="tb-btn-copy" onclick={copyToClipboard}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre class="tb-code"><code>{currentOut}</code></pre>
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
</section>

<style>
  .tb-page { font-family: Inter, ui-sans-serif, system-ui; }

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
  .tb-page-actions { display: flex; gap: 6px; flex-wrap: wrap; }

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
    height: calc(100vh - 220px);
    min-height: 560px;
  }
  @media (max-width: 1280px) { .tb-grid { grid-template-columns: 180px 1fr 1fr; height: auto; } }
  @media (max-width: 900px)  { .tb-grid { grid-template-columns: 1fr; } }

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
    display: flex; flex-direction: column; gap: 1px;
    border-left: 2px solid transparent;
  }
  .tb-sidenav-link:hover { background: var(--sg-header-bg, #f1f5f9); }
  .tb-sidenav-link.active {
    background: rgba(99, 102, 241, 0.10);
    border-left-color: var(--site-accent, #2563eb);
    color: var(--site-accent, #2563eb);
  }
  .tb-sidenav-label { font-size: 13px; font-weight: 700; }
  .tb-sidenav-desc  { font-size: 10.5px; color: var(--site-muted, #94a3b8); font-weight: 400; }
  .tb-sidenav-link.active .tb-sidenav-desc { color: rgba(99, 102, 241, 0.7); }

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
  .tb-field-row { display: flex; align-items: baseline; justify-content: space-between; }
  .tb-field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--site-muted, #64748b); }
  .tb-field-hint { font-size: 10.5px; color: var(--site-muted, #94a3b8); }
  .tb-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .tb-fullwidth { width: 100%; }

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

  .tb-token { display: grid; grid-template-columns: 26px 1fr auto auto; align-items: center; gap: 8px; font-size: 12px; }
  .tb-token input[type='color'] { width: 24px; height: 24px; padding: 0; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 4px; cursor: pointer; }
  .tb-token input[type='color']:hover { box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.18); }
  .tb-token-name { font-weight: 500; color: var(--site-fg, #0f172a); }
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
    display: grid; grid-template-columns: 1fr auto auto;
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
    display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 8px;
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

  .tb-export { display: flex; flex-direction: column; background: #0f172a; border-color: #1e293b; max-height: calc(100vh - 230px); }
  .tb-export-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid rgba(148,163,184,0.20); }
  .tb-seg-export { width: auto; border-color: rgba(148,163,184,0.30); }
  .tb-seg-export button { color: #cbd5e1; font-size: 11px; }
  .tb-seg-export button:not(.active):hover { background: rgba(148,163,184,0.12); }
  .tb-btn-copy { border: 1px solid rgba(148,163,184,0.30); background: rgba(148,163,184,0.08); color: #e2e8f0; padding: 4px 12px; border-radius: 5px; font-size: 11.5px; font-weight: 700; cursor: pointer; }
  .tb-btn-copy:hover { background: rgba(148,163,184,0.18); }
  .tb-code { flex: 1; margin: 0; color: #e2e8f0; padding: 12px 14px; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11.5px; line-height: 1.55; overflow: auto; }
  .tb-export-foot { padding: 8px 12px; border-top: 1px solid rgba(148,163,184,0.20); color: #94a3b8; font-size: 11px; }
</style>
