/**
 * Source scan: every chrome icon goes through the `icon` snippet.
 *
 * The `icons` prop is only worth having if it covers the chrome, and coverage
 * is the kind of thing that rots one commit at a time - somebody adds a toolbar
 * button with an inline `<svg>`, it works, nobody notices it ignores `icons`
 * until a consumer reports a stray glyph in a re-skinned grid. This is the
 * check that turns that into a red test instead.
 *
 * It reads source rather than DOM on purpose: a rendering test can only cover
 * the states it happens to mount, and the icons most likely to be missed are
 * the ones behind a rarely-exercised branch.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GRID_ICON_GLYPHS, GRID_ICON_NAMES, type GridIconName } from './grid-icons'

const SRC = join(process.cwd(), 'src')
const read = (f: string) => readFileSync(join(SRC, f), 'utf8')

/** Files that render grid chrome and therefore must go through the seam. */
const CHROME = ['SvGrid.svelte', 'GridMenus.svelte', 'GridFooter.svelte', 'SvRowGroupPanel.svelte']

/**
 * Drop the regions allowed to contain raw icon markup: the `icon` snippet's own
 * body (which IS the built-in set), the `ic` snippet in SvRowGroupPanel, and
 * every `<script>` block.
 */
function stripAllowedRegions(src: string): string {
  let out = src.replace(/<script[\s\S]*?<\/script>/g, '')
  // The built-in catalogue: from the snippet header to its closing tag.
  out = out.replace(/\{#snippet icon\(name: GridIconName\)\}[\s\S]*?\n\{\/snippet\}/g, '')
  out = out.replace(/\{#snippet ic\(name: GridIconName\)\}[\s\S]*?\{\/snippet\}/g, '')
  return out
}

describe('icon seam', () => {
  it('leaves no inline <svg> outside the built-in catalogue', () => {
    // Data visualisation is not chrome: these draw values, not affordances, and
    // there is nothing for a consumer's icon set to say about them.
    const ALLOWED = ['sv-grid-sparkline']

    const offenders: string[] = []
    for (const file of CHROME) {
      const body = stripAllowedRegions(read(file))
      for (const [i, line] of body.split('\n').entries()) {
        if (!line.includes('<svg')) continue
        if (ALLOWED.some((a) => body.split('\n').slice(i, i + 3).join(' ').includes(a))) continue
        offenders.push(`${file}:${i + 1} ${line.trim().slice(0, 80)}`)
      }
    }
    expect(
      offenders,
      `Inline <svg> outside the icon snippet - route it through {@render icon("...")} ` +
        `and add a name to grid-icons.ts:\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })

  it('leaves no glyph character used as an icon', () => {
    // Every character the catalogue owns. If one of these appears as an
    // element's text content outside the snippet, it is an icon that bypassed
    // the seam.
    const glyphs = [...new Set(Object.values(GRID_ICON_GLYPHS))].filter((g) => g !== '#')
    const offenders: string[] = []
    for (const file of CHROME) {
      const body = stripAllowedRegions(read(file))
      for (const [i, line] of body.split('\n').entries()) {
        for (const g of glyphs) {
          // `>GLYPH<` is the shape of a glyph rendered as element content.
          if (new RegExp(`>\\s*${escapeRe(g)}\\s*<`).test(line)) {
            offenders.push(`${file}:${i + 1} ${JSON.stringify(g)} in ${line.trim().slice(0, 70)}`)
          }
        }
      }
    }
    expect(
      offenders,
      `Glyph rendered directly instead of through the icon seam:\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })

  it('only renders names the catalogue defines', () => {
    const unknown: string[] = []
    for (const file of CHROME) {
      const src = read(file)
      for (const m of src.matchAll(/\{@render ic(?:on)?\(\s*["']([a-zA-Z-]+)["']\s*\)\}/g)) {
        const name = m[1] as GridIconName
        if (!GRID_ICON_NAMES.includes(name)) unknown.push(`${file}: ${name}`)
      }
    }
    expect(unknown, `Icon names with no entry in grid-icons.ts:\n  ${unknown.join('\n  ')}`).toEqual(
      [],
    )
  })
})

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
