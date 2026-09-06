import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The framework docs advertise every example as "open this and it runs", and a
 * `data-docs-sandbox` placeholder that points at a directory which does not
 * exist fails at CLICK time, in a reader's browser, with an error they cannot
 * act on. Nothing else notices: the markdown is valid, the page renders, and
 * the button appears.
 *
 * `packages/grid-wc/scripts/check-examples.mjs` proves the examples COMPILE.
 * This proves the docs point at the ones that exist, and that the three
 * frameworks have not drifted apart.
 */
const EXAMPLES = join('packages', 'grid-wc', 'examples')
const FRAMEWORKS = ['react', 'vue', 'angular'] as const
const ENTRY: Record<string, string> = {
  react: 'App.tsx',
  vue: 'App.vue',
  angular: 'app.component.ts',
}

function recipesOf(framework: string): string[] {
  const dir = join(EXAMPLES, framework)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => statSync(join(dir, f)).isDirectory())
    .sort()
}

function docFiles(): Array<[string, string]> {
  const dir = join('docs', 'help', 'web-components')
  const out: Array<[string, string]> = []
  for (const f of readdirSync(dir))
    if (f.endsWith('.md')) out.push([`${dir}/${f}`, readFileSync(join(dir, f), 'utf8')])
  out.push(['docs/help/web-components.md', readFileSync('docs/help/web-components.md', 'utf8')])
  return out
}

describe('framework examples exist', () => {
  it('finds them (a walker matching nothing would pass vacuously)', () => {
    for (const fw of FRAMEWORKS) expect(recipesOf(fw).length, fw).toBeGreaterThan(4)
  })

  it('every framework implements the same recipes', () => {
    // The failure this catches: a recipe added to React and quietly skipped in
    // Angular, so the landing page's comparison table links to a 404.
    const [first, ...rest] = FRAMEWORKS
    const expected = recipesOf(first)
    for (const fw of rest)
      expect(recipesOf(fw), `${fw} differs from ${first}`).toEqual(expected)
  })

  it('every recipe has its entry file', () => {
    for (const fw of FRAMEWORKS)
      for (const recipe of recipesOf(fw)) {
        const entry = join(EXAMPLES, fw, recipe, ENTRY[fw]!)
        expect(existsSync(entry), `missing ${entry}`).toBe(true)
      }
  })

  it('every framework ships the shared data module', () => {
    // Each example imports `../data`, so a missing one breaks all eight and
    // the StackBlitz payload has nothing to write.
    for (const fw of FRAMEWORKS)
      expect(existsSync(join(EXAMPLES, fw, 'data.ts')), fw).toBe(true)
  })
})

describe('the docs point at examples that exist', () => {
  const placeholders = docFiles().flatMap(([file, text]) =>
    [...text.matchAll(/data-docs-sandbox="([^"]+)"/g)].map((m) => ({ file, spec: m[1]! })),
  )

  it('finds the placeholders', () => {
    expect(placeholders.length).toBeGreaterThan(20)
  })

  it.each(placeholders.map((p) => [p.spec, p]))('%s resolves', (_spec, entry) => {
    const { spec, file } = entry as { spec: string; file: string }
    const [framework, recipe] = spec.split(':')
    expect(FRAMEWORKS as readonly string[], `${file}: unknown framework "${framework}"`).toContain(
      framework,
    )
    expect(
      existsSync(join(EXAMPLES, framework!, recipe!, ENTRY[framework!]!)),
      `${file}: no example for ${spec}`,
    ).toBe(true)
  })

  it('every recipe is reachable from the docs', () => {
    // The reverse direction: an example nobody links to is dead weight, and
    // usually means a doc section was forgotten.
    const linked = new Set(placeholders.map((p) => p.spec))
    const missing: string[] = []
    for (const fw of FRAMEWORKS)
      for (const recipe of recipesOf(fw)) if (!linked.has(`${fw}:${recipe}`)) missing.push(`${fw}:${recipe}`)
    expect(missing, `examples with no doc section: ${missing.join(', ')}`).toEqual([])
  })
})
