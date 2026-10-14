/**
 * Colors and icons the field editor offers: a bright set for checkbox,
 * rating and button fields, the 40-color set for select options (ten hues in
 * four strengths), and the icon set a checkbox or rating can use.
 */

const HUES = ['blue', 'cyan', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'gray'] as const

/** Bright colors, one per hue. */
export const BRIGHT: ReadonlyArray<{ value: string; label: string }> = [
  { value: '#2d7ff9', label: 'Blue' },
  { value: '#18bfff', label: 'Cyan' },
  { value: '#20d9d2', label: 'Teal' },
  { value: '#20c933', label: 'Green' },
  { value: '#fcb400', label: 'Yellow' },
  { value: '#ff6f2c', label: 'Orange' },
  { value: '#f82b60', label: 'Red' },
  { value: '#ff08c2', label: 'Pink' },
  { value: '#8b46ff', label: 'Purple' },
  { value: '#666666', label: 'Gray' },
]

// Per hue: lightest, light, bright, dark.
const SHADES: Record<(typeof HUES)[number], [string, string, string, string]> = {
  blue: ['#cfdfff', '#9cc7ff', '#2d7ff9', '#2750ae'],
  cyan: ['#d0f0fd', '#77d1f3', '#18bfff', '#0b76b7'],
  teal: ['#c2f5e9', '#72ddc3', '#20d9d2', '#06a09b'],
  green: ['#d1f7c4', '#93e088', '#20c933', '#338a17'],
  yellow: ['#ffeab6', '#ffd66e', '#fcb400', '#b87503'],
  orange: ['#fee2d5', '#ffa981', '#ff6f2c', '#d74d26'],
  red: ['#ffdce5', '#ff9eb7', '#f82b60', '#ba1e45'],
  pink: ['#ffdaf6', '#f99de2', '#ff08c2', '#b2158b'],
  purple: ['#ede2fe', '#cdb0ff', '#8b46ff', '#6b1cb0'],
  gray: ['#eeeeee', '#cccccc', '#666666', '#444444'],
}
const STRENGTH = ['lightest', 'light', 'bright', 'dark'] as const

/** The 40 select-option colors, row by strength, column by hue. */
export const OPTION_COLORS: ReadonlyArray<{ value: string; label: string }> = STRENGTH.flatMap((s, i) =>
  HUES.map((h) => ({ value: SHADES[h][i]!, label: `${h[0]!.toUpperCase()}${h.slice(1)}, ${s}` })),
)

/** The colors new options cycle through. */
export const OPTION_CYCLE = HUES.map((h) => SHADES[h][1]!)

// 24x24 path data. Filled icons (rating, checked checkbox) use them as fills.
export const ICONS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  star: 'M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  heart: 'M12 20.3s-7.8-4.7-7.8-10.2A4.5 4.5 0 0 1 12 7.4a4.5 4.5 0 0 1 7.8 2.7c0 5.5-7.8 10.2-7.8 10.2z',
  thumbsUp: 'M7 10v10H4V10zM7 10l4-7c1.4 0 2.3 1 2 2.4L12.4 9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  dot: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
} as const

export type IconName = keyof typeof ICONS

const ICON_LABEL: Record<IconName, string> = { check: 'Check', x: 'Cross', star: 'Star', heart: 'Heart', thumbsUp: 'Thumbs up', flag: 'Flag', dot: 'Dot' }

/** Icons a checkbox can use. */
export const CHECKBOX_ICONS = (['check', 'x', 'star', 'heart', 'thumbsUp', 'flag', 'dot'] as IconName[]).map((v) => ({ value: v, label: ICON_LABEL[v], path: ICONS[v] }))
/** Icons a rating can use. */
export const RATING_ICONS = (['star', 'heart', 'thumbsUp', 'flag', 'dot'] as IconName[]).map((v) => ({ value: v, label: ICON_LABEL[v], path: ICONS[v] }))

/** Icons that read as a stroke (check, x, flag) rather than a filled shape. */
export const STROKE_ICONS = new Set<IconName>(['check', 'x', 'flag', 'thumbsUp'])

/**
 * Text color for a pill filled with `color`: near-black or white, whichever
 * has more contrast on it. Colors that are not #rgb / #rrggbb get the theme's
 * text color.
 */
export function textOn(color: string | undefined): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color ?? '')
  if (!m) return 'var(--sg-fg, #0f172a)'
  const hex = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  const l = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  // #1d1f25 has a luminance of 0.014; white has 1.
  return (l + 0.05) / 0.064 > 1.05 / (l + 0.05) ? '#1d1f25' : '#ffffff'
}
