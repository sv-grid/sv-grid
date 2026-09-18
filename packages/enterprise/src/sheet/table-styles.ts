/**
 * The table styles gallery: Excel's presets, by the names Excel stores.
 *
 * A table's look is drawn rather than written into the cells, which is what
 * lets a row typed under the last one arrive already banded. That drawing
 * needs colours, and "the theme's accent" is one look rather than a gallery,
 * so this is the set to pick from.
 *
 * The ids are Excel's own (`TableStyleMedium2`), and the colours are the
 * Office theme's accents, so a table saved here opens in Excel wearing the
 * same style rather than something approximate. A style is three tones of
 * one accent: Light tints the header, Medium fills it, Dark fills it with a
 * deeper shade, exactly as Excel's three families do.
 */

export type TableStyleTone = 'light' | 'medium' | 'dark'

export type TableStyle = {
  /** Excel's name for it, which is what goes in the file. */
  id: string
  /** The colour's name, for the gallery. */
  colour: string
  tone: TableStyleTone
  /** The Office theme accent it is built from. */
  accent: string
}

/** The Office theme's six accents, in Excel's order. */
const ACCENTS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'Blue', hex: '#4472c4' },
  { name: 'Orange', hex: '#ed7d31' },
  { name: 'Grey', hex: '#7f7f7f' },
  { name: 'Gold', hex: '#ffc000' },
  { name: 'Sky', hex: '#5b9bd5' },
  { name: 'Green', hex: '#70ad47' },
]

const TONES: ReadonlyArray<{ tone: TableStyleTone; family: string }> = [
  { tone: 'light', family: 'Light' },
  { tone: 'medium', family: 'Medium' },
  { tone: 'dark', family: 'Dark' },
]

/**
 * Eighteen styles: six accents in three tones. Excel numbers each family
 * from 1, with 1 reserved for the black-and-white variant, so the accents
 * start at 2 and this maps one for one onto the built-in names.
 */
export const TABLE_STYLES: ReadonlyArray<TableStyle> = TONES.flatMap(({ tone, family }) =>
  ACCENTS.map((accent, i) => ({
    id: `TableStyle${family}${i + 2}`,
    colour: accent.name,
    tone,
    accent: accent.hex,
  })),
)

/** What a table wears unless it is given something else: Excel's own default. */
export const DEFAULT_TABLE_STYLE = 'TableStyleMedium2'

/** No style at all: the cells keep whatever formats they carry. */
export const NO_TABLE_STYLE = 'None'

export function findTableStyle(id: string | undefined): TableStyle | undefined {
  if (!id || id === NO_TABLE_STYLE) return undefined
  return TABLE_STYLES.find((s) => s.id.toLowerCase() === id.toLowerCase())
}

export type TableStyleColours = {
  /** The header row's fill, and the colour its text needs to stay readable. */
  header: string
  headerText: string
  /** Every other data row. */
  band: string
  /** The totals row, and the line over it. */
  totals: string
  border: string
}

/**
 * A style as CSS colours.
 *
 * `color-mix` rather than fixed hexes for the tints, so a table keeps its
 * colour over a dark sheet as well as a light one: the accent is mixed with
 * the surface underneath rather than painted over it.
 */
export function tableStyleColours(style: TableStyle | string | undefined): TableStyleColours | null {
  const found = typeof style === 'string' || style === undefined ? findTableStyle(style) : style
  if (!found) return null
  const accent = found.accent
  const mix = (percent: number, into = 'transparent') => `color-mix(in srgb, ${accent} ${percent}%, ${into})`
  if (found.tone === 'light') {
    return {
      header: mix(18),
      headerText: 'inherit',
      band: mix(8),
      totals: mix(14),
      border: mix(50),
    }
  }
  if (found.tone === 'dark') {
    return {
      header: `color-mix(in srgb, ${accent} 65%, #000)`,
      headerText: '#ffffff',
      band: mix(22),
      totals: mix(30),
      border: mix(70),
    }
  }
  return {
    header: accent,
    headerText: '#ffffff',
    band: mix(13),
    totals: mix(20),
    border: mix(55),
  }
}

/** "Blue, Medium", for the gallery's tooltip and for a screen reader. */
export function tableStyleLabel(style: TableStyle): string {
  const tone = style.tone === 'light' ? 'Light' : style.tone === 'dark' ? 'Dark' : 'Medium'
  return `${style.colour}, ${tone}`
}
