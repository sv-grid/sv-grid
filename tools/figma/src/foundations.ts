/**
 * The Overview page: the cover (also the file thumbnail) and the foundations,
 * meaning every variable with its value per mode, the text styles and the
 * shadows.
 */
import { KIT, absolute, canTheme, fallbackThemes, frame, inst, put, rect, setStroke, shadow, skippedModes, text, themeAs } from './lib'
import type { UiKit } from './fields'
import { DARK, EFFECTS, TYPE, example, section } from './doc'

const ROW = 30

/**
 * 1920x1080 cover: what the file is, which version it was built from, and
 * the Orders screen as the picture. Orange appears only where the product
 * puts it (selection, the active cell, the primary action).
 */
export function buildCover(screen: ComponentNode): FrameNode {
  const shown = KIT.modes.filter((m) => canTheme(m.id))
  const themes = [...new Set(shown.map((m) => m.name.replace(/ (Light|Dark)$/, '')))].join(', ')
  const both = shown.some((m) => m.id.endsWith('-dark')) ? 'light and dark' : 'light'
  // The light screen in front, the same screen in dark behind it, offset up and right.
  const shots = frame({ name: 'Screens', dir: 'none', w: screen.width + 150, h: screen.height + 120 })
  if (DARK && canTheme(DARK.id)) {
    const back = frame({ name: 'Dark screen', dir: 'v', radius: 14, clip: true, fill: '--sg-bg' }, screen.createInstance())
    themeAs(back, DARK.id)
    shadow(back, 'Dialog')
    absolute(shots, back, 150, 0)
  }
  const front = screen.createInstance()
  shadow(front, 'Dialog')
  absolute(shots, front, 0, 120)
  return frame(
    { name: 'Cover', gap: 72, align: 'center', pad: [0, 88], w: 1920, h: 1080, fill: '--sg-bg-subtle', clip: true },
    frame(
      { name: 'Text', dir: 'v', gap: 36, w: 520 },
      frame({ name: 'Wordmark', gap: 10, align: 'baseline' }, text('SvGrid', { size: 24, weight: 'semibold', letterSpacing: -0.3 }), text('Design kit', { size: 24, color: '--sg-muted' })),
      text('Headless-first.\nRender-ready.', { name: 'Headline', size: 76, weight: 'semibold', lineHeight: 82, letterSpacing: -2.2 }),
      text('The Svelte data grid and its UI components as Figma components. Every color is a variable named after its --sg-* token, so a frame switches theme the way a stylesheet does.', {
        name: 'Body',
        size: 20,
        lineHeight: 31,
        color: '--sg-muted',
        w: 'fill',
      }),
      frame(
        { name: 'Meta', dir: 'v', gap: 8 },
        text(`@svgrid/grid ${KIT.gridVersion}`, { size: 14, mono: true, color: '--sg-muted' }),
        text(`${themes}, ${both}`, { size: 14, mono: true, color: '--sg-muted' }),
        text(`Built from ${KIT.commit} on ${KIT.builtAt}`, { size: 14, mono: true, color: '--sg-muted' }),
      ),
    ),
    shots,
  )
}

export type OverviewInputs = { screen?: ComponentNode; kit?: UiKit }

function chipList(items: string[]): FrameNode {
  return frame(
    { name: 'Sections', gap: 6, wrap: true, w: 'fill' },
    ...items.map((t) => frame({ name: t, pad: [3, 10], radius: 999, stroke: '--sg-border' }, text(t, { size: 12, color: '--sg-muted' }))),
  )
}

/** A page tile: a live preview above the page name, a line about it and its sections. */
function tile(name: string, body: string, sections: string[], preview: FrameNode): FrameNode {
  return frame(
    { name, dir: 'v', gap: 18, w: 520 },
    preview,
    frame(
      { name: 'Text', dir: 'v', gap: 8, w: 'fill' },
      text(name, { size: 20, weight: 'semibold', letterSpacing: -0.2 }),
      text(body, { size: 14, lineHeight: 22, color: '--sg-muted', w: 'fill' }),
    ),
    chipList(sections),
  )
}

function previewBox(name: string): FrameNode {
  return frame({ name, dir: 'none', w: 520, h: 300, fill: '--sg-bg-subtle', stroke: '--sg-border', radius: 14, clip: true })
}

/** What is in the file, page by page, each with a live preview made of kit instances. */
function contents(o: OverviewInputs): FrameNode {
  const s = section('Contents', 'Three pages', undefined, {
    dark: false,
    summary: 'Every component sits on a card with its usage, props and source file, and its variants in Light and Dark.',
  })

  // Overview: the type and the theme colors.
  const ov = previewBox('Overview preview')
  absolute(ov, text('Aa', { size: 120, weight: 'semibold', letterSpacing: -4, lineHeight: 120 }), 36, 36)
  const sw = frame({ name: 'Swatches', gap: 10 }, ...['--sg-fg', '--sg-accent', '--sg-selection-bg', '--sg-success', '--sg-warning', '--sg-danger', '--sg-info'].map((t) => rect(t, 40, 40, t, 999)))
  absolute(ov, sw, 36, 224)
  absolute(ov, text('Inter, 13px grid text', { size: 13, color: '--sg-muted' }), 300, 92)
  absolute(ov, text('Ember, shadcn/ui', { size: 13, color: '--sg-muted' }), 300, 116)

  // Grid: the orders screen, scaled down.
  const gr = previewBox('Grid preview')
  if (o.screen) {
    const shot = o.screen.createInstance()
    shot.rescale(0.62)
    absolute(gr, shot, 28, 28)
  }

  // Components: a handful of real instances.
  const cp = frame({ name: 'Components preview', dir: 'h', wrap: true, gap: 14, pad: 28, align: 'center', w: 520, h: 300, fill: '--sg-bg-subtle', stroke: '--sg-border', radius: 14, clip: true })
  const k = o.kit
  const add = (fn: () => SceneNode) => {
    try {
      put(cp, fn())
    } catch {
      // A preview item is decoration; skip it rather than fail the page.
    }
  }
  if (k) {
    add(() => inst(k.Button as ComponentSetNode, { Variant: 'Primary', Size: 'md', State: 'Default' }, { Label: 'Save changes' }))
    add(() => inst(k.Button as ComponentSetNode, { Variant: 'Secondary', Size: 'md', State: 'Default' }, { Label: 'Cancel' }))
    add(() => inst(k.Switch as ComponentSetNode, { Size: 'md', Checked: 'True', State: 'Default' }))
    add(() => inst(k.Checkbox as ComponentSetNode, { Size: 'md', Checked: 'True', State: 'Default' }, { Label: 'Email receipt' }))
    add(() => inst(k.Segmented as ComponentSetNode, { Size: 'md', State: 'Default' }))
    add(() => inst(k.Badge as ComponentSetNode, { Tone: 'Success', Size: 'md', Dot: 'True' }, { Label: 'Active' }))
    add(() => inst(k.Chip as ComponentSetNode, { Tone: 'Accent', Style: 'Soft', Size: 'md', Removable: 'True' }, { Label: 'Germany' }))
    add(() => inst(k.Rating as ComponentSetNode, { Size: 'md', Value: '3' }))
    add(() => inst(k.Select as ComponentSetNode, { Size: 'md', State: 'Default' }, { 'Show label': false, Value: 'All countries' }))
    add(() => (k['Avatar group'] as ComponentNode).createInstance())
  }

  put(
    s,
    frame(
      { name: 'Pages', gap: 40, align: 'start' },
      tile('Overview', 'This page: the theme palettes, every variable per mode, text styles and shadows.', ['Palettes', 'Color variables', 'Number variables', 'Text styles', 'Effect styles'], ov),
      tile('Grid', 'SvGrid assembled and taken apart: a full screen, the example grids in every theme, then each part with its states.', ['Orders screen', 'Data grid', 'Themes and density', 'States', 'Cells', 'Rows', 'Pager', 'Menus'], gr),
      tile('Components', 'The UI kit that ships in @svgrid/grid, in seven groups.', ['Actions', 'Inputs', 'Selection', 'Navigation', 'Data display', 'Feedback', 'Overlays'], cp),
    ),
  )
  return s
}

const PALETTE: [string, string][] = [
  ['--sg-bg', 'Background'],
  ['--sg-fg', 'Text'],
  ['--sg-muted', 'Muted'],
  ['--sg-border', 'Border'],
  ['--sg-header-bg', 'Header'],
  ['--sg-accent', 'Accent'],
  ['--sg-selection-bg', 'Selection'],
  ['--sg-success', 'Success'],
  ['--sg-warning', 'Warning'],
  ['--sg-danger', 'Danger'],
]

/** One strip per theme the file can show, each pinned to its theme. */
function palettes(): FrameNode {
  const s = section('Palettes', 'SvGrid collection', undefined, {
    dark: false,
    summary: 'The ten colors that set a theme apart, per theme and mode. Each strip is pinned to its theme, so it reads the way a grid in that theme reads.',
  })
  const strips: FrameNode[] = []
  for (const mode of KIT.modes) {
    if (!canTheme(mode.id)) continue
    const values = Object.fromEntries(KIT.colors.map((d) => [d.token, String(d.values[mode.id])]))
    const swatch = (token: string, label: string) =>
      frame(
        { name: label, dir: 'v', w: 128 },
        // A hairline so Background (and any color equal to the strip) still reads as a swatch.
        (() => {
          const r = rect('Color', 128, 76, token)
          setStroke(r, ['--sg-fg', 0.08], 1, 'INSIDE')
          return r
        })(),
        frame(
          { name: 'Label', dir: 'v', gap: 2, pad: [10, 12], w: 'fill' },
          text(label, { size: 12, weight: 'semibold' }),
          text(values[token] ?? '', { size: 10.5, mono: true, color: '--sg-muted' }),
        ),
      )
    const strip = frame(
      { name: mode.name, dir: 'v', gap: 0, fill: '--sg-bg', stroke: '--sg-border', radius: 14, clip: true, strokeInLayout: false },
      frame({ name: 'Head', pad: [14, 16], w: 'fill' }, text(mode.name, { size: 13, weight: 'semibold' })),
      frame({ name: 'Swatches' }, ...PALETTE.map(([t, l]) => swatch(t, l))),
    )
    if (themeAs(strip, mode.id)) strips.push(strip)
    else strip.remove()
  }
  put(s, frame({ name: 'Strips', dir: 'v', gap: 20 }, ...strips))
  return s
}

/** Four short steps, then where the values come from and what differs from a browser. */
function about(): FrameNode {
  const s = section('Using this file', `tools/figma, built from ${KIT.commit} on ${KIT.builtAt}`, undefined, {
    dark: false,
    summary: 'Generated from the sv-grid repository, so the values here are the values the code ships.',
  })
  const starter = fallbackThemes.length > 0
  const steps: [string, string][] = [
    [
      'Pick a theme',
      starter
        ? 'Select a frame and set its SvGrid mode in the right sidebar. On this plan each theme past Ember Light is its own collection (SvGrid / Ember Dark, ...); the dark copies here already use them.'
        : 'Select a frame and set its SvGrid mode in the right sidebar. Every theme and its light and dark modes are modes of one collection.',
    ],
    ['Set the density', 'SvGrid density switches row height, header height and cell padding between Default (rowHeight 30, 7px padding) and Comfortable (36px rows, 12px padding).'],
    ['Use the components', 'Variant properties follow the Svelte props: Variant, Size, State. Text, icons and optional parts are component properties on the instance.'],
    ['Hand off', 'Dev Mode shows every color as its CSS custom property, var(--sg-...). Each card names the Svelte component and the file it was measured from.'],
  ]
  const step = (n: number, title: string, body: string) =>
    frame(
      { name: title, dir: 'v', gap: 10, pad: 24, w: 380, fill: '--sg-bg-subtle', stroke: '--sg-border', radius: 14, strokeInLayout: false },
      frame({ name: 'Number', w: 28, h: 28, radius: 999, fill: '--sg-bg', stroke: '--sg-border', align: 'center', justify: 'center' }, text(String(n), { size: 13, weight: 'semibold' })),
      text(title, { size: 16, weight: 'semibold' }),
      text(body, { size: 13.5, lineHeight: 21, color: '--sg-muted', w: 'fill' }),
    )
  const grid = frame({ name: 'Steps', gap: 20, wrap: true, w: 780 }, ...steps.map(([t, b], i) => step(i + 1, t, b)))
  const notes = [
    `Values come from resolveThemeTokens() in packages/grid/src/themes/index.ts, the function that writes @svgrid/grid/themes/*.css, so a variable and its CSS custom property always match.`,
    'Known differences from a browser: Inter stands in for the system font stack; the grid inherits the host font size and the kit uses 13px; heights assume a border-box reset; text glyph icons (alert, pager) render in Inter.',
  ]
  if (!starter && skippedModes.length) notes.push(`This file's plan refused some modes, so they were skipped: ${skippedModes.join(', ')}.`)
  put(s, grid, frame({ name: 'Notes', dir: 'v', gap: 10, w: 780 }, ...notes.map((l, i) => text(l, { name: `Note ${i + 1}`, size: 13, lineHeight: 21, color: '--sg-muted', w: 'fill' }))))
  return s
}

const GROUP_TITLES: Record<string, string> = {
  surface: 'Surface',
  text: 'Text',
  border: 'Border',
  accent: 'Accent',
  header: 'Header',
  row: 'Rows and selection',
  pinned: 'Pinned columns and rows',
  input: 'Inputs',
  status: 'Status',
  validation: 'Validation',
  rating: 'Rating',
  scrollbar: 'Scrollbar',
  derived: 'Derived (color-mix results)',
}

function colorTable(): FrameNode {
  const s = section('Color variables', 'SvGrid collection', undefined, {
    dark: false,
    summary: 'Swatches are bound to the variables and each column pins one mode, so this table is the theme. Derived entries are color-mix() results the components paint, not CSS tokens.',
  })
  const groups: { key: string; defs: typeof KIT.colors }[] = []
  for (const d of KIT.colors) {
    const key = d.name.split('/')[0]!
    let g = groups.find((x) => x.key === key)
    if (!g) groups.push((g = { key, defs: [] }))
    g.defs.push(d)
  }
  const groupHead = (title: string) =>
    frame({ name: title, h: 44, align: 'end', pad: [0, 0, 8, 0] }, text(title, { size: 11, weight: 'semibold', color: '--sg-muted', upper: true, letterSpacing: 0.6 }))
  const blank = (name: string) => frame({ name, h: 44 })

  const names = frame({ name: 'Names', dir: 'v', w: 340 }, frame({ name: 'Head', h: ROW, align: 'center' }, text('Variable', { size: 12, weight: 'semibold', color: '--sg-muted' })))
  for (const g of groups) {
    put(names, groupHead(GROUP_TITLES[g.key] ?? g.key))
    for (const d of g.defs)
      put(
        names,
        frame(
          { name: d.name, dir: 'v', h: ROW + 6, justify: 'center', w: 'fill' },
          text(d.name, { size: 12.5, weight: 'medium' }),
          text(d.code ?? `var(${d.token})`, { size: 10.5, color: '--sg-muted', mono: true, truncate: true, w: 'fill' }),
        ),
      )
  }
  const columns = KIT.modes.map((mode) => {
    const col = frame({ name: mode.name, dir: 'v', w: 180, pad: [0, 14], fill: '--sg-bg', stroke: '--sg-border', radius: 10, strokeInLayout: false }, frame({ name: 'Head', h: ROW, align: 'center' }, text(mode.name, { size: 12, weight: 'semibold', color: '--sg-muted' })))
    for (const g of groups) {
      put(col, blank(g.key))
      for (const d of g.defs)
        put(
          col,
          frame(
            { name: d.name, h: ROW + 6, gap: 10, align: 'center' },
            rect('Swatch', 32, 22, d.token, 6),
            text(String(d.values[mode.id]), { size: 11, color: '--sg-muted', mono: true }),
          ),
        )
    }
    // Swatches bind to the variable; the column's mode decides which value shows.
    return themeAs(col, mode.id) ? col : (col.remove(), null)
  }).filter((c): c is FrameNode => c !== null)
  put(s, frame({ name: 'Table', gap: 12 }, names, ...columns))
  return s
}

function numbers(): FrameNode {
  const s = section('Number variables', 'SvGrid and SvGrid density collections', undefined, {
    dark: false,
    summary: 'Radius and header weight follow the theme. Row height, header height and cell padding are density, a separate collection, so any theme can be compact or comfortable.',
  })
  const row = (cells: string[], head = false) =>
    frame(
      { name: cells[0]!, h: ROW + 4, align: 'center', stroke: '--sg-border', strokeWeight: { bottom: 1 } },
      ...cells.map((c, i) => frame({ name: `c${i}`, w: i === 0 ? 220 : 160 }, text(c, { size: 12, weight: head ? 'semibold' : 'regular', color: head ? '--sg-muted' : '--sg-fg', mono: !head }))),
    )
  const theme = frame(
    { name: 'Theme numbers', dir: 'v' },
    row(['Variable', ...KIT.modes.map((m) => m.name)], true),
    ...KIT.numbers.map((d) => row([d.name, ...KIT.modes.map((m) => String(d.values[m.id]))])),
  )
  const density = frame(
    { name: 'Density numbers', dir: 'v' },
    row(['Variable', ...KIT.density.modes.map((m) => m.name)], true),
    ...KIT.density.variables.map((d) => row([d.name, ...KIT.density.modes.map((m) => String(d.values[m.id]))])),
  )
  put(s, example('SvGrid', theme), example('SvGrid density', density))
  return s
}

function typeScale(): FrameNode {
  const s = section('Text styles', 'Local styles under SvGrid/', undefined, {
    summary: 'Every text layer in the kit with matching metrics is linked to one of these styles. Inter stands in for the system font stack.',
  })
  const rows = Object.entries(TYPE).map(([name, d]) =>
    frame(
      { name, gap: 32, align: 'center', pad: [12, 0], w: 1000, stroke: '--sg-border', strokeWeight: { bottom: 1 } },
      frame({ name: 'Meta', dir: 'v', gap: 4, w: 300 }, text(`SvGrid/${name}`, { size: 12.5, weight: 'medium' }), text(d.description, { size: 11.5, color: '--sg-muted', w: 300, lineHeight: 16 })),
      text('Northwind Traders 12,055.75', { size: d.size, weight: d.weight, lineHeight: d.lineHeight, letterSpacing: d.letterSpacing, upper: d.upper }),
    ),
  )
  put(s, frame({ name: 'Rows', dir: 'v' }, ...rows))
  return s
}

function effects(): FrameNode {
  const s = section('Effect styles', 'Local styles under SvGrid/', undefined, {
    summary: 'Shadows are literals in the CSS, except the pinned-column shadow, whose color is the pinned/shadow variable.',
  })
  const cards = Object.entries(EFFECTS).map(([name, e]) => {
    const card = frame(
      { name, dir: 'v', gap: 6, pad: 18, w: 210, h: 104, fill: '--sg-bg', stroke: '--sg-border', radius: 12, strokeInLayout: false },
      text(name, { size: 13, weight: 'semibold' }),
      text(e.description.split('.')[0]!, { size: 11.5, color: '--sg-muted', w: 'fill', lineHeight: 16 }),
    )
    shadow(card, name)
    return card
  })
  put(s, frame({ name: 'Cards', gap: 44, wrap: true, w: 1000, pad: [20, 8] }, ...cards))
  return s
}

export function buildFoundations(o: OverviewInputs = {}): FrameNode[] {
  return [contents(o), about(), palettes(), colorTable(), numbers(), typeScale(), effects()]
}
