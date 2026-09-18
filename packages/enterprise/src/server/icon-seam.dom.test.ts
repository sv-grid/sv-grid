/**
 * Source scan: the group chrome goes through the `icons` seam.
 *
 * `SvRowGroupPanel` and `SvGroupCell` are mounted by the app, not by the grid,
 * so they cannot inherit `<SvGrid icons>` - they take the same map as a prop
 * instead. That only pays off if every glyph they draw actually reads it, and
 * coverage is the kind of thing that rots one commit at a time: somebody adds
 * a chip button with an inline `<svg>`, it works, and nobody notices it ignores
 * `icons` until a consumer reports a stray glyph in a re-skinned grid.
 *
 * This is the enterprise half of `packages/grid/src/icon-seam.test.ts`, which
 * covers the chrome the grid itself renders. It moved here with the components
 * in the Server-Side Row Model relocation.
 *
 * It reads source rather than DOM on purpose: a rendering test can only cover
 * the states it happens to mount, and the icons most likely to be missed are
 * the ones behind a rarely-exercised branch.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GRID_ICON_GLYPHS, GRID_ICON_NAMES, type GridIconName } from '@svgrid/grid'

const SRC = join(process.cwd(), 'src', 'server')
const read = (f: string) => readFileSync(join(SRC, f), 'utf8')

/** Files that render group chrome and therefore must go through the seam. */
const CHROME = ['SvRowGroupPanel.svelte', 'SvGroupCell.svelte']

/**
 * Drop the regions allowed to contain raw icon markup: the `ic` snippet's own
 * body (which IS the built-in set), the `chevron` fallback in SvGroupCell
 * (drawn only when `icons` supplies nothing), and every `<script>` block.
 */
function stripAllowedRegions(src: string): string {
  let out = src.replace(/<script[\s\S]*?<\/script>/g, '')
  out = out.replace(/\{#snippet ic\(name: GridIconName\)\}[\s\S]*?\{\/snippet\}/g, '')
  // `{#if chevron}{@render chevron()}{:else}<svg .../>{/if}` - the else branch
  // is the built-in glyph, reached only when the seam supplied nothing.
  out = out.replace(/\{#if chevron\}[\s\S]*?\{\/if\}/g, '')
  return out
}

describe('icon seam (server group chrome)', () => {
  it('leaves no inline <svg> outside the built-in fallbacks', () => {
    const offenders: string[] = []
    for (const file of CHROME) {
      const body = stripAllowedRegions(read(file))
      for (const [i, line] of body.split('\n').entries()) {
        if (!line.includes('<svg')) continue
        offenders.push(`${file}:${i + 1} ${line.trim().slice(0, 80)}`)
      }
    }
    expect(
      offenders,
      `Inline <svg> outside the icon fallback - route it through the \`icons\` prop ` +
        `and add a name to grid-icons.ts:\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })

  it('leaves no glyph character used as an icon', () => {
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
