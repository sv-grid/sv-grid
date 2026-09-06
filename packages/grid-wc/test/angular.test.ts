import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { ELEMENT_PROPS, ELEMENT_EVENTS, LEGACY_EVENTS } from '../src/surface.generated.js'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, '..', 'dist', 'angular')
const fesm = join(dist, 'fesm2022', 'svgrid-grid-wc-angular.mjs')
const types = join(dist, 'types', 'svgrid-grid-wc-angular.d.ts')

/**
 * The Angular wrapper, checked against its COMPILED output.
 *
 * Not a mounted-component test: the library is compiled in partial-Ivy mode,
 * which a consumer's build links at install time, so loading it outside an
 * Angular toolchain is not possible - a vite fixture cannot run it the way the
 * React and Vue fixtures run theirs.
 *
 * That is less of a loss than it sounds. An Angular wrapper's correctness is
 * almost entirely in its declaration metadata: whether every prop is an
 * `@Input`, every event an `@Output`, and whether the component carries
 * CUSTOM_ELEMENTS_SCHEMA so a consumer does not have to. All of that is in the
 * emitted bundle, and all of it is what drifts. The runtime half - assigning
 * properties rather than attributes - is shared code, exercised by the React
 * and Vue suites.
 */
describe('the Angular wrapper is built', () => {
  it('emits a FESM bundle and type declarations', () => {
    expect(existsSync(fesm), `missing ${fesm} - run pnpm --filter @svgrid/grid-wc build`).toBe(true)
    expect(existsSync(types)).toBe(true)
  })
})

describe('the Angular wrapper matches the surface', () => {
  const src = existsSync(fesm) ? readFileSync(fesm, 'utf8') : ''
  const dts = existsSync(types) ? readFileSync(types, 'utf8') : ''

  it('declares every prop as an input', () => {
    // Partial-Ivy output records inputs in the ɵɵngDeclareComponent call.
    const missing = ELEMENT_PROPS.map((p) => p.name).filter(
      (n) => !new RegExp(`\\b${n}\\s*:\\s*"${n}"`).test(src) && !src.includes(`${n}: "${n}"`),
    )
    expect(missing, `props with no @Input: ${missing.slice(0, 8).join(', ')}`).toEqual([])
  })

  it('declares every event as an output', () => {
    const events = [
      ...ELEMENT_EVENTS.map((e) => e.event),
      ...LEGACY_EVENTS.filter((l) => !ELEMENT_EVENTS.some((e) => e.event === l.event)).map(
        (l) => l.event,
      ),
    ]
    const missing = events.filter((n) => !src.includes(`${n}: "${n}"`))
    expect(missing, `events with no @Output: ${missing.slice(0, 8).join(', ')}`).toEqual([])
  })

  it('uses the element tag as its selector, so there is no wrapper element', () => {
    // The component has no template: its HOST is the <sv-grid> the browser
    // upgrades. A wrapper with its own tag would put a redundant element in
    // every consumer DOM and give the same grid two names depending on which
    // framework you came from.
    expect(src).toContain("sv-grid, sv-grid-shadow")
    // The compiled template must be EMPTY. Grepping the bundle for markup is
    // not enough - the prose in this file mentions the tag too, which is how
    // the first version of this assertion failed on its own comment.
    expect(src, 'the component must render no template of its own').toMatch(
      /template:\s*(''|""|``),\s*isInline/,
    )
  })

  it('matches the shadow tag too, so the variant is a tag choice not an input', () => {
    expect(src).toContain("sv-grid-shadow")
    expect(dts, 'shadow should no longer be an @Input').not.toMatch(/shadow\??:\s*boolean/)
  })

  it('is standalone, so it can be imported directly', () => {
    expect(src).toMatch(/isStandalone:\s*true|standalone:\s*true/)
  })

  it('exposes the api getter', () => {
    expect(dts).toContain('get api()')
  })

  it('does not bundle the grid - it reuses the one element build', () => {
    // A wrapper that inlined the element would ship a second ~100 KB copy of
    // the grid to anyone loading both.
    expect(src.length).toBeLessThan(60_000)
    expect(src).toContain('@svgrid/grid-wc')
  })
})
