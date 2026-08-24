import { describe, it, expect } from 'vitest'
import { themePresets, resolveThemeTokens, type ThemeMode } from './index'

/**
 * WCAG contrast for every built-in theme, in both light and dark.
 *
 * The axe suite (`a11y.axe.test.ts`) runs in jsdom, which does no layout and no
 * painting, so its `color-contrast` rule is disabled there. That leaves a real
 * gap: a theme could ship text nobody can read and nothing would complain.
 * Our tokens are plain hex, so the ratios are computable directly - no browser
 * needed, and every preset is covered rather than whichever one a demo happens
 * to use.
 *
 * Thresholds are the WCAG 2.1 AA ones:
 *   - 4.5:1 for normal-size text
 *   - 3:1   for large text and for non-text UI boundaries (SC 1.4.11)
 */

const AA_TEXT = 4.5
const AA_UI = 3

/** sRGB hex -> relative luminance, per WCAG 2.x. */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`not a plain hex colour: ${hex}`)
  let h = m[1]!
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(fg: string, bg: string): number {
  const a = luminance(fg)
  const b = luminance(bg)
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * Pairs that actually meet a user's eye. Each is [foreground, background,
 * threshold, what it is] - named so a failure says which surface is unreadable
 * rather than just which token.
 */
const PAIRS: Array<[string, string, number, string]> = [
  ['--sg-fg', '--sg-bg', AA_TEXT, 'body text on the grid background'],
  ['--sg-fg', '--sg-row-alt-bg', AA_TEXT, 'body text on zebra-striped rows'],
  ['--sg-fg', '--sg-row-hover-bg', AA_TEXT, 'body text on a hovered row'],
  ['--sg-fg', '--sg-selection-bg', AA_TEXT, 'body text on a selected row'],
  ['--sg-muted', '--sg-bg', AA_TEXT, 'secondary text on the grid background'],
  ['--sg-header-fg', '--sg-header-bg', AA_TEXT, 'header text'],
  ['--sg-on-accent', '--sg-accent', AA_TEXT, 'text on an accent-filled control'],
  ['--sg-accent', '--sg-bg', AA_UI, 'accent used as a focus/selection indicator'],
]

/**
 * Deliberately NOT checked: `--sg-border` against `--sg-bg`.
 *
 * WCAG 1.4.11 covers UI components whose STATE must be perceivable, and
 * graphics required to understand content. A table gridline is neither: the
 * grid's structure is carried by the accessibility tree (role=grid, rows,
 * columnheaders), so a screen reader never depends on the line being visible,
 * and a sighted user reads the table from its alignment and spacing. Holding
 * gridlines to 3:1 would force every preset to draw near-black rules, which is
 * why no mainstream design system does it. Focus rings and selection states DO
 * have to clear 3:1, which is what the `--sg-accent` row above checks.
 */

const MODES: ThemeMode[] = ['light', 'dark']

describe('built-in theme contrast (WCAG 2.1 AA)', () => {
  const cases = themePresets.flatMap((preset) =>
    MODES.map((mode) => [preset.id, mode, preset] as const),
  )

  it.each(cases)('%s / %s meets AA on every text surface', (id, mode, preset) => {
    const tokens = resolveThemeTokens(preset, mode)
    const failures: string[] = []

    for (const [fgToken, bgToken, threshold, label] of PAIRS) {
      const fg = tokens[fgToken]
      const bg = tokens[bgToken]
      // Skip anything a preset expresses as a gradient/color-mix rather than a
      // flat hex - those cannot be judged without painting, and are called out
      // in docs as the consumer's responsibility.
      if (!fg || !bg || !/^#/.test(fg) || !/^#/.test(bg)) continue
      const ratio = contrast(fg, bg)
      if (ratio < threshold) {
        failures.push(
          `${label}: ${fgToken} ${fg} on ${bgToken} ${bg} = ${round(ratio)}:1 (needs ${threshold}:1)`,
        )
      }
    }

    expect(failures, `${id} (${mode}) contrast failures:\n  ${failures.join('\n  ')}`).toEqual([])
  })

  it('checks a meaningful number of presets', () => {
    // Guards against the suite silently passing because the preset list moved.
    expect(themePresets.length).toBeGreaterThanOrEqual(15)
  })

  it('computes known ratios correctly', () => {
    // Sanity-check the maths itself against WCAG's canonical extremes.
    expect(round(contrast('#000000', '#ffffff'))).toBe(21)
    expect(round(contrast('#ffffff', '#ffffff'))).toBe(1)
  })
})
