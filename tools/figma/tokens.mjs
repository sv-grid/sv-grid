/**
 * Which `--sg-*` tokens become Figma variables, how they are named and grouped,
 * and the fallbacks the grid's CSS uses for tokens a preset leaves unset.
 *
 * Values are never typed here. deriveTokens() starts from resolveThemeTokens()
 * and only adds what the CSS itself computes:
 *  - fallbacks written as `var(--sg-x, <fallback>)` in SvGrid.css and the UI kit
 *  - opaque `color-mix()` results the components paint (hover fills, alert
 *    borders), so a Figma fill can bind to them. Mixes with `transparent` are
 *    not here: the plugin draws those as the token at a paint opacity.
 * Every entry cites the rule it reproduces.
 */

// ------------------------------------------------------------- color math

function parse(c) {
  const s = c.trim().toLowerCase()
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s)
  if (m) {
    const n = parseInt(m[1], 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: m[2] ? parseInt(m[2], 16) / 255 : 1 }
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/.exec(s)
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] }
  throw new Error(`tokens.mjs cannot parse color "${c}"`)
}

const hex2 = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
function format({ r, g, b, a }) {
  return a >= 0.999 ? `#${hex2(r)}${hex2(g)}${hex2(b)}` : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${+a.toFixed(3)})`
}

/** `color-mix(in srgb, a p%, b)` for two opaque colors: per-channel lerp of the encoded values. */
function mixSrgb(a, p, b) {
  const x = parse(a)
  const y = parse(b)
  const t = p / 100
  return format({ r: x.r * t + y.r * (1 - t), g: x.g * t + y.g * (1 - t), b: x.b * t + y.b * (1 - t), a: 1 })
}

const toLinear = (c) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const fromLinear = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

function toOklab({ r, g, b }) {
  const [R, G, B] = [toLinear(r), toLinear(g), toLinear(b)]
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
function fromOklab([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return {
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: 1,
  }
}

/** `color-mix(in oklab, a p%, b)` for two opaque colors. */
function mixOklab(a, p, b) {
  const x = toOklab(parse(a))
  const y = toOklab(parse(b))
  const t = p / 100
  return format(fromOklab(x.map((v, i) => v * t + y[i] * (1 - t))))
}

/** `color-mix(in <space>, c p%, transparent)`: the color at alpha p (premultiplied mixing keeps the hue). */
function withAlpha(c, p) {
  const x = parse(c)
  return format({ ...x, a: x.a * (p / 100) })
}

// --------------------------------------------------------------- derive

/**
 * The full token set for one preset + mode: resolveThemeTokens() output plus
 * the grid's CSS fallbacks and the opaque mixes the plugin binds to.
 */
export function deriveTokens(t) {
  const out = { ...t }
  const fb = (k, v) => {
    if (out[k] === undefined) out[k] = v
  }
  // SvGrid.css:741 border-bottom: var(--sg-header-border, var(--sg-border))
  fb('--sg-header-border', t['--sg-border'])
  // SvGrid.css:733 color: var(--sg-header-label-color, var(--sg-header-fg, ...))
  fb('--sg-header-label-color', t['--sg-header-fg'])
  // SvGrid.css:734 font-weight: var(--sg-header-weight, 600)
  fb('--sg-header-weight', '600')
  // SvGrid.css:554-556 color-mix(in oklab, header-bg 92%, accent 8%)
  fb('--sg-pinned-bg', mixOklab(t['--sg-header-bg'], 92, t['--sg-accent']))
  // SvGrid.css:570-574 color-mix(in oklab, header-bg 86%, accent 14%)
  fb('--sg-pinned-header-bg', mixOklab(t['--sg-header-bg'], 86, t['--sg-accent']))
  // SvGrid.css:557-559 var(--sg-pinned-divider, var(--sg-border))
  fb('--sg-pinned-divider', t['--sg-border'])
  // SvGrid.css:832-849 color-mix(in oklab, accent 24%, transparent)
  fb('--sg-pinned-border', withAlpha(t['--sg-accent'], 24))
  // SvGrid.css:557-559 rgba(15, 23, 42, 0.22)
  fb('--sg-pinned-shadow-color', 'rgba(15, 23, 42, 0.22)')
  // SvGrid.css:2048-2049
  fb('--sg-invalid-bg', 'rgba(239, 68, 68, 0.14)')
  fb('--sg-invalid-border', 'rgba(239, 68, 68, 0.45)')

  // Opaque mixes (srgb unless the rule says otherwise).
  // SvButton.svelte:77-78 primary hover: color-mix(in srgb, accent 88%, #000)
  out['--sg-x-accent-hover'] = mixSrgb(t['--sg-accent'], 88, '#000000')
  // SvButton.svelte:85-86 danger hover: color-mix(in srgb, danger 88%, #000)
  out['--sg-x-danger-hover'] = mixSrgb(t['--sg-danger'], 88, '#000000')
  // SvAlert.svelte:68-75 border: color-mix(in srgb, var(--_c) 30%, var(--sg-border))
  for (const [k, c] of Object.entries(ALERT_COLORS)) out[`--sg-x-alert-${k}-border`] = mixSrgb(t[c], 30, t['--sg-border'])
  // SvPagination.svelte:95 hover border: color-mix(in srgb, accent 40%, border)
  out['--sg-x-page-hover-border'] = mixSrgb(t['--sg-accent'], 40, t['--sg-border'])
  // SvCalendar.svelte:431 selected hover: color-mix(in srgb, accent 86%, fg)
  out['--sg-x-day-selected-hover'] = mixSrgb(t['--sg-accent'], 86, t['--sg-fg'])
  for (const [token, pct] of ALPHA) out[alphaKey(token, pct)] = withAlpha(out[token], pct)
  // SvStepper.svelte:85 done connector, SvCard.svelte:56-60 hover border:
  // color-mix(in srgb, accent 45%, border)
  out['--sg-x-accent-border-45'] = mixSrgb(t['--sg-accent'], 45, t['--sg-border'])
  return out
}

/**
 * Translucent colors the components paint: `color-mix(in srgb, var(token) N%,
 * transparent)`. Figma does not keep a paint's own opacity once a variable is
 * bound to it, so each one is a variable with the alpha in its value. The
 * plugin throws if it asks for a pair that is not listed here.
 */
const TONE_TOKENS = ['--sg-muted', '--sg-accent', '--sg-success', '--sg-warning', '--sg-danger', '--sg-info']
export const ALPHA = [
  ...TONE_TOKENS.flatMap((t) => [12, 13, 14, 22, 26].map((p) => [t, p])),
  ...[10, 16, 18, 25, 28, 35, 42, 45].map((p) => ['--sg-accent', p]),
  ...[18, 32].map((p) => ['--sg-muted', p]),
  ...[5, 8, 30, 70].map((p) => ['--sg-fg', p]),
  ['--sg-danger', 6],
  ['--sg-bg', 35],
  ['--sg-row-hover-bg', 55],
  ['--sg-selection-bg', 65],
]
export const alphaKey = (token, pct) => `${token}@${pct}`

const ALERT_COLORS = {
  info: '--sg-info',
  success: '--sg-success',
  warning: '--sg-warning',
  danger: '--sg-danger',
  neutral: '--sg-muted',
}

// --------------------------------------------------------------- naming

const c = (token, name, description, code) => ({ token, name, description, ...(code ? { code } : {}) })

/** Color variables, in the order they appear in Figma's variable panel. */
export const TOKEN_GROUPS = [
  c('--sg-bg', 'surface/bg', 'Grid and component background. Body cells, popups, dialogs.'),
  c('--sg-bg-subtle', 'surface/bg-subtle', 'Inset surfaces: master-detail region, generated auth pages.'),
  c('--sg-muted-bg', 'surface/muted-bg', 'Read-only inputs and other quiet fills.'),
  c('--sg-skeleton-bg', 'surface/skeleton-bg', 'Skeleton placeholders.'),
  c('--sg-fg', 'text/fg', 'Primary text.'),
  c('--sg-muted', 'text/muted', 'Secondary text, icons, placeholders.'),
  c('--sg-border', 'border/border', 'Cell grid lines and component borders.'),
  c('--sg-accent', 'accent/accent', 'Selection, focus, active cell ring, primary actions.'),
  c('--sg-on-accent', 'accent/on-accent', 'Text on an accent fill. Picked by WCAG contrast against the accent.'),
  c('--sg-focus-ring', 'accent/focus-ring', 'Focus outline color.'),
  c('--sg-x-accent-hover', 'accent/accent-hover', 'Primary button hover. Derived, not a CSS token.', 'color-mix(in srgb, var(--sg-accent) 88%, #000)'),
  c('--sg-header-bg', 'header/bg', 'Header row, group rows, pager bar.'),
  c('--sg-header-fg', 'header/fg', 'Header text.'),
  c('--sg-header-label-color', 'header/label', 'Header label color. Falls back to header/fg.'),
  c('--sg-header-border', 'header/border', 'Line under the header row. Falls back to border/border.'),
  c('--sg-row-alt-bg', 'row/alt-bg', 'Zebra rows (zebraRows).'),
  c('--sg-row-hover-bg', 'row/hover-bg', 'Row hover, menu item hover.'),
  c('--sg-selection-bg', 'row/selection-bg', 'Selected rows and range selection fill.'),
  c('--sg-pinned-bg', 'pinned/bg', 'Frozen-column body cells.'),
  c('--sg-pinned-header-bg', 'pinned/header-bg', 'Frozen-column header cells.'),
  c('--sg-pinned-divider', 'pinned/divider', 'Line on the inside edge of a frozen column.'),
  c('--sg-pinned-border', 'pinned/border', 'Top/bottom line of pinned rows.'),
  c('--sg-pinned-shadow-color', 'pinned/shadow', 'Shadow a frozen column casts into the scroll area.'),
  c('--sg-input-bg', 'input/bg', 'Input, select and checkbox background.'),
  c('--sg-input-border', 'input/border', 'Input, select and checkbox border.'),
  c('--sg-danger', 'status/danger', 'Errors, destructive actions, invalid cells.'),
  c('--sg-success', 'status/success', 'Confirmations, positive deltas.'),
  c('--sg-warning', 'status/warning', 'Cautions, pending states.'),
  c('--sg-info', 'status/info', 'Neutral informational callouts.'),
  c('--sg-x-danger-hover', 'status/danger-hover', 'Danger button hover. Derived, not a CSS token.', 'color-mix(in srgb, var(--sg-danger) 88%, #000)'),
  c('--sg-invalid-fg', 'validation/invalid-fg', 'Invalid cell text.'),
  c('--sg-invalid-bg', 'validation/invalid-bg', 'Invalid cell fill.'),
  c('--sg-invalid-border', 'validation/invalid-border', 'Invalid cell ring.'),
  c('--sg-rating-on', 'rating/on', 'Filled rating star.'),
  c('--sg-rating-empty', 'rating/empty', 'Empty rating star.'),
  c('--sg-scrollbar-bg', 'scrollbar/bg', 'Scrollbar track.'),
  c('--sg-scrollbar-border', 'scrollbar/border', 'Scrollbar inner edge.'),
  c('--sg-scrollbar-thumb', 'scrollbar/thumb', 'Scrollbar thumb.'),
  c('--sg-scrollbar-thumb-hover', 'scrollbar/thumb-hover', 'Scrollbar thumb, hovered.'),
  c('--sg-scrollbar-arrow', 'scrollbar/arrow', 'Scrollbar arrow glyph.'),
  c('--sg-scrollbar-arrow-hover-bg', 'scrollbar/arrow-hover-bg', 'Scrollbar arrow, hovered.'),
  ...Object.keys(ALERT_COLORS).map((k) =>
    c(`--sg-x-alert-${k}-border`, `derived/alert-${k}-border`, `SvAlert ${k} border. Derived.`, `color-mix(in srgb, var(${ALERT_COLORS[k]}) 30%, var(--sg-border))`),
  ),
  c('--sg-x-page-hover-border', 'derived/pagination-hover-border', 'SvPagination hover border. Derived.', 'color-mix(in srgb, var(--sg-accent) 40%, var(--sg-border))'),
  c('--sg-x-accent-border-45', 'derived/accent-border-45', 'Completed stepper connector, hoverable card border. Derived.', 'color-mix(in srgb, var(--sg-accent) 45%, var(--sg-border))'),
  c('--sg-x-day-selected-hover', 'derived/day-selected-hover', 'SvCalendar selected day hover. Derived.', 'color-mix(in srgb, var(--sg-accent) 86%, var(--sg-fg))'),
]

TOKEN_GROUPS.push(
  ...ALPHA.map(([token, pct]) =>
    c(alphaKey(token, pct), `alpha/${token.slice(5)}-${pct}`, `${token} at ${pct}%.`, `color-mix(in srgb, var(${token}) ${pct}%, transparent)`),
  ),
)

export const NUMBER_TOKENS = [
  { token: '--sg-radius', name: 'radius/radius', description: 'Control corner rounding.' },
  { token: '--sg-radius-lg', name: 'radius/radius-lg', description: 'Large rounding (2x radius).' },
  { token: '--sg-header-weight', name: 'header/weight', description: 'Header label font weight. Falls back to 600 (SvGrid.css:734).' },
]

/**
 * Density is not part of a theme preset: the grid reads row height from the
 * `rowHeight` prop and the rest from tokens the presets leave unset. Two modes:
 * Default is what a project gets with only a theme stylesheet (TYPES:1792
 * rowHeight 30, SvGrid.css:619 --sg-cell-px 7px, header sized to its 22px
 * content, measured). Comfortable is the demo gallery's setting
 * (examples/src/themes/ember.css: --sg-cell-px 12px, --sg-header-min-height
 * 48px; rowHeight={36} in most demos).
 */
export const DENSITY = {
  name: 'SvGrid density',
  modes: [
    { id: 'default', name: 'Default' },
    { id: 'comfortable', name: 'Comfortable' },
  ],
  variables: [
    { token: 'density/row-height', name: 'grid/row-height', code: 'rowHeight={30}', description: 'Body row height (rowHeight prop).', values: { default: 30, comfortable: 36 } },
    { token: 'density/header-height', name: 'grid/header-height', code: 'var(--sg-header-min-height)', description: 'Header cell height without its 1px bottom border. Content-sized by default.', values: { default: 22, comfortable: 48 } },
    { token: 'density/cell-px', name: 'grid/cell-px', code: 'var(--sg-cell-px)', description: 'Horizontal cell padding.', values: { default: 7, comfortable: 12 } },
  ],
}
