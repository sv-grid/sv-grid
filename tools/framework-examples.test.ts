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

/**
 * The fourth copy, which is not a fourth framework page.
 *
 * `examples/svelte/` exists so each listing on the three framework pages has a
 * RUNNING grid above it - the website mounts these through
 * `data-docs-mirror="<recipe>"`. They have to track the other three exactly, or
 * a reader is shown one app and handed the code for another.
 */
const MIRROR = 'svelte'
const MIRROR_ENTRY = 'App.svelte'

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

  it('the Svelte previews cover exactly the same recipes', () => {
    // The failure this catches: a tenth recipe added to all three frameworks
    // and not to the previews, so its doc section renders "Unknown example"
    // above a listing that is otherwise fine.
    expect(recipesOf(MIRROR), `${MIRROR} differs from ${FRAMEWORKS[0]}`).toEqual(
      recipesOf(FRAMEWORKS[0]),
    )
    for (const recipe of recipesOf(MIRROR))
      expect(existsSync(join(EXAMPLES, MIRROR, recipe, MIRROR_ENTRY)), recipe).toBe(true)
  })

  it('every copy of data.ts is byte-identical', () => {
    // "The same app, four ways" only means anything if the rows are the same
    // rows. A preview seeded differently from its listing is worse than no
    // preview: it looks authoritative and is wrong.
    const read = (fw: string) => readFileSync(join(EXAMPLES, fw, 'data.ts'), 'utf8')
    const baseline = read(FRAMEWORKS[0])
    for (const fw of [...FRAMEWORKS.slice(1), MIRROR])
      expect(read(fw), `${fw}/data.ts has drifted from ${FRAMEWORKS[0]}/data.ts`).toBe(baseline)
  })

  it('no preview uses a class name the site already defines', () => {
    // The previews mount into a Tailwind page, and a Svelte component's scoped
    // styles do not stop a global rule from also matching. A wrapper named
    // `class="grid"` picked up Tailwind's `.grid { display: grid }`, turned into
    // a grid container, and its `min-width: auto` child blew out to min-content
    // - so the grid rendered ~130px wider than its card and was silently
    // clipped, worse at every viewport. Nothing failed; it just looked wrong.
    const UTILITIES = [
      'grid', 'flex', 'block', 'inline', 'hidden', 'container', 'table', 'border',
      'absolute', 'relative', 'fixed', 'static', 'sticky', 'group', 'peer',
    ]
    const clashes: string[] = []
    for (const recipe of recipesOf(MIRROR)) {
      const src = readFileSync(join(EXAMPLES, MIRROR, recipe, MIRROR_ENTRY), 'utf8')
      for (const m of src.matchAll(/class="([^"{}]+)"/g))
        for (const name of m[1]!.split(/\s+/))
          if (UTILITIES.includes(name)) clashes.push(`${recipe}: class="${name}"`)
    }
    expect(clashes).toEqual([])
  })

  it('every preview renders through the element body, not a hand-rolled grid', () => {
    // The preview's whole claim is "this is what that code renders". It holds
    // only because these mount GridBody.svelte - the component <sv-grid> and
    // <sv-grid-shadow> render. Reaching for <SvGrid> directly would quietly
    // drop the element's own defaults (filterMode, selectionMode, fitColumns)
    // and the picture would stop matching the listing.
    for (const recipe of recipesOf(MIRROR)) {
      const src = readFileSync(join(EXAMPLES, MIRROR, recipe, MIRROR_ENTRY), 'utf8')
      expect(src, `${recipe} does not import GridBody`).toContain(
        "import GridBody from '../../../src/GridBody.svelte'",
      )
      // GridBody calls `emit` from every callback it forwards; omitting it
      // throws on the first event the grid fires, which for most recipes is
      // `apiready` at mount.
      expect(src, `${recipe} does not pass emit`).toMatch(/emit=\{/)
    }
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

  it('every preview placeholder resolves', () => {
    // Same failure as a bad sandbox spec, one step earlier: the reader sees
    // "Unknown example" where the running grid should be, and there is nothing
    // in the markdown or the build to say so.
    const mirrors = docFiles().flatMap(([file, text]) =>
      [...text.matchAll(/data-docs-mirror="([^"]+)"/g)].map((m) => ({ file, recipe: m[1]! })),
    )
    expect(mirrors.length, 'no preview placeholders found at all').toBeGreaterThan(20)
    const bad = mirrors
      .filter((m) => !existsSync(join(EXAMPLES, MIRROR, m.recipe, MIRROR_ENTRY)))
      .map((m) => `${m.file}: ${m.recipe}`)
    expect(bad).toEqual([])
  })

  it('every section pairs a preview with its own listing', () => {
    // A mirror pointing at a different recipe than the sandbox beside it would
    // caption one app with another's code - exactly the thing the previews
    // exist to avoid, and invisible on the rendered page.
    const mismatched: string[] = []
    for (const [file, text] of docFiles()) {
      const fw = file.replace(/.*\//, '').replace(/\.md$/, '')
      if (!(FRAMEWORKS as readonly string[]).includes(fw)) continue
      for (const m of text.matchAll(
        /data-docs-mirror="([^"]+)"[\s\S]{0,200}?data-docs-sandbox="([^"]+)"/g,
      )) {
        if (m[2] !== `${fw}:${m[1]}`) mismatched.push(`${file}: ${m[1]} paired with ${m[2]}`)
      }
    }
    expect(mismatched).toEqual([])
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
