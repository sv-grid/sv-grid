/**
 * Excel's colour picker, as data: the ten theme colours with five tints and
 * shades each, then the ten standard colours. These are the values a
 * spreadsheet user expects to find under Fill Colour and Font Colour, and
 * they are cell DATA (a fill the document carries) rather than chrome, which
 * is why they are literal hex here and not theme tokens.
 */

export type PaletteColour = { value: string; label: string }

/** The Office theme's base row: white, black, two greys, then six accents. */
const THEME_BASE: ReadonlyArray<PaletteColour> = [
  { value: '#FFFFFF', label: 'White, Background 1' },
  { value: '#000000', label: 'Black, Text 1' },
  { value: '#E7E6E6', label: 'Light Gray, Background 2' },
  { value: '#44546A', label: 'Blue-Gray, Text 2' },
  { value: '#4472C4', label: 'Blue, Accent 1' },
  { value: '#ED7D31', label: 'Orange, Accent 2' },
  { value: '#A5A5A5', label: 'Gray, Accent 3' },
  { value: '#FFC000', label: 'Gold, Accent 4' },
  { value: '#5B9BD5', label: 'Blue, Accent 5' },
  { value: '#70AD47', label: 'Green, Accent 6' },
]

export const STANDARD_COLOURS: ReadonlyArray<PaletteColour> = [
  { value: '#C00000', label: 'Dark Red' },
  { value: '#FF0000', label: 'Red' },
  { value: '#FFC000', label: 'Orange' },
  { value: '#FFFF00', label: 'Yellow' },
  { value: '#92D050', label: 'Light Green' },
  { value: '#00B050', label: 'Green' },
  { value: '#00B0F0', label: 'Light Blue' },
  { value: '#0070C0', label: 'Blue' },
  { value: '#002060', label: 'Dark Blue' },
  { value: '#7030A0', label: 'Purple' },
]

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const part = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0').toUpperCase()
  return `#${part(r)}${part(g)}${part(b)}`
}

/** Mix `hex` toward white (`amount` > 0) or black (`amount` < 0). */
export function tint(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const target = amount > 0 ? 255 : 0
  const t = Math.abs(amount)
  return rgbToHex([r + (target - r) * t, g + (target - g) * t, b + (target - b) * t])
}

/**
 * Excel's five variations under each theme colour. Lighter 80/60/40 % for
 * the accents; the white and black columns run the other way, as they do in
 * Excel, so white gets greys and black gets lighter greys rather than five
 * identical swatches.
 */
const STEPS: ReadonlyArray<{ amount: number; label: string }> = [
  { amount: 0.8, label: 'Lighter 80%' },
  { amount: 0.6, label: 'Lighter 60%' },
  { amount: 0.4, label: 'Lighter 40%' },
  { amount: -0.25, label: 'Darker 25%' },
  { amount: -0.5, label: 'Darker 50%' },
]
const WHITE_STEPS = [-0.05, -0.15, -0.25, -0.35, -0.5]
const BLACK_STEPS = [0.5, 0.35, 0.25, 0.15, 0.05]

export type PaletteRow = ReadonlyArray<PaletteColour>

/** Ten columns by six rows: the base row, then five variations per column. */
export const THEME_COLOURS: ReadonlyArray<PaletteRow> = (() => {
  const rows: PaletteColour[][] = [THEME_BASE.map((c) => ({ ...c }))]
  for (let step = 0; step < 5; step += 1) {
    rows.push(THEME_BASE.map((base, col) => {
      const amount = col === 0 ? WHITE_STEPS[step]! : col === 1 ? BLACK_STEPS[step]! : STEPS[step]!.amount
      const name = base.label.split(',')[0]!
      const how = col === 0
        ? `Darker ${Math.round(Math.abs(amount) * 100)}%`
        : col === 1
          ? `Lighter ${Math.round(amount * 100)}%`
          : STEPS[step]!.label
      return { value: tint(base.value, amount), label: `${name}, ${how}` }
    }))
  }
  return rows
})()

/** The whole picker flattened, for a `select` fallback and for tests. */
export const ALL_COLOURS: ReadonlyArray<PaletteColour> = [
  ...THEME_COLOURS.flat(),
  ...STANDARD_COLOURS,
]
