import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(here, '..')
const examples = join(pkgRoot, 'examples')

/**
 * The docs' "Open in StackBlitz" button posts a whole project - package.json,
 * entry, config, the example's own files - to StackBlitz, which then runs
 * `npm install` and boots it. CI cannot boot a WebContainer, so what is checked
 * here is everything that decides whether it CAN boot: that the example files
 * the payload reads actually exist, that each one imports only packages the
 * payload would declare, and that the versions are not hand-written literals
 * that will rot.
 *
 * The builder itself lives in the private website submodule
 * (`website/src/lib/stackblitz.ts`), so this asserts the inputs it consumes
 * rather than importing it.
 */
const FRAMEWORKS = {
  react: 'App.tsx',
  vue: 'App.vue',
  angular: 'app.component.ts',
} as const

const recipes = (fw: string) =>
  readdirSync(join(examples, fw))
    .filter((f) => statSync(join(examples, fw, f)).isDirectory())
    .sort()

describe('every example the payload reads is present', () => {
  it.each(Object.keys(FRAMEWORKS))('%s', (fw) => {
    const entry = FRAMEWORKS[fw as keyof typeof FRAMEWORKS]
    expect(existsSync(join(examples, fw, 'data.ts')), `${fw}/data.ts`).toBe(true)
    const found = recipes(fw)
    expect(found.length).toBeGreaterThan(4)
    for (const recipe of found)
      expect(existsSync(join(examples, fw, recipe, entry)), `${fw}/${recipe}/${entry}`).toBe(true)
  })
})

describe('examples import only what a StackBlitz project would install', () => {
  // The payload declares a fixed dependency set per framework. An example that
  // reached for another package would install nothing and fail at boot - after
  // the reader has waited through `npm install`.
  // `@svgrid/enterprise` is allowed because the payload declares it when the
  // recipe imports it (see `needsEnterprise` in the builder) - not because the
  // Enterprise recipes get a pass. Widening this list without widening the
  // builder is how a sandbox boots to an unresolved import.
  const ALLOWED: Record<string, RegExp> = {
    react: /^(react|react-dom|@svgrid\/(grid-wc|enterprise)(\/\w+)?|\.\.?\/)/,
    vue: /^(vue|@svgrid\/(grid-wc|enterprise)(\/\w+)?|\.\.?\/)/,
    angular: /^(@angular\/\w+|zone\.js|@svgrid\/(grid-wc|enterprise)(\/\w+)?|\.\.?\/)/,
  }

  for (const [fw, entry] of Object.entries(FRAMEWORKS)) {
    it(`${fw}`, () => {
      for (const recipe of recipes(fw)) {
        const src = readFileSync(join(examples, fw, recipe, entry), 'utf8')
        for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
          const spec = m[1]!
          expect(ALLOWED[fw]!.test(spec), `${fw}/${recipe} imports "${spec}"`).toBe(true)
        }
      }
    })
  }
})

describe('enterprise imports stay on the Svelte-free subpaths', () => {
  // A StackBlitz project for these frameworks has no Svelte plugin, and the
  // `@svgrid/enterprise` MAIN entry pulls .svelte components - so importing it
  // builds a sandbox that fails to compile. The four subpaths below are plain
  // JavaScript. Same boundary the docs state in
  // docs/help/web-components/enterprise.md.
  const SVELTE_FREE = /^@svgrid\/enterprise\/(export|import|print|pivot|license)$/

  for (const [fw, entry] of Object.entries(FRAMEWORKS)) {
    it(`${fw}`, () => {
      for (const recipe of recipes(fw)) {
        const src = readFileSync(join(examples, fw, recipe, entry), 'utf8')
        for (const m of src.matchAll(/from\s+['"](@svgrid\/enterprise[^'"]*)['"]/g)) {
          expect(
            SVELTE_FREE.test(m[1]!),
            `${fw}/${recipe} imports "${m[1]}", which needs a Svelte-aware bundler`,
          ).toBe(true)
        }
      }
    })
  }
})

describe('every relative import an example makes is a sibling of the shared module', () => {
  // The payload writes the shared module to `src/data.ts` and the example one
  // level below it, at `src/app/<entry>`, so `../data` resolves. Flattening
  // both into `src/` broke that silently: the project installed, booted, and
  // died on a module it could not find - which cost a real debugging round.
  //
  // So every relative import here must be exactly `../<name>` pointing at a
  // file that sits beside data.ts.
  it.each(Object.keys(FRAMEWORKS))('%s', (fw) => {
    const entry = FRAMEWORKS[fw as keyof typeof FRAMEWORKS]
    for (const recipe of recipes(fw)) {
      const src = readFileSync(join(examples, fw, recipe, entry), 'utf8')
      for (const m of src.matchAll(/from\s+['"](\.[^'"]*)['"]/g)) {
        const spec = m[1]!
        expect(spec, `${fw}/${recipe}: unexpected relative import "${spec}"`).toMatch(
          /^\.\.\/[\w.-]+$/,
        )
        const target = spec.replace('../', '')
        expect(
          existsSync(join(examples, fw, `${target}.ts`)),
          `${fw}/${recipe} imports "${spec}" but ${fw}/${target}.ts does not exist`,
        ).toBe(true)
      }
    }
  })
})

describe('the wrapper import each example uses is a real subpath', () => {
  const exports = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')).exports as Record<
    string,
    unknown
  >

  it.each(Object.keys(FRAMEWORKS))('%s', (fw) => {
    // `@svgrid/grid-wc/react` has to be an exports entry, or the StackBlitz
    // install resolves the package and the import still fails.
    expect(Object.keys(exports)).toContain(`./${fw}`)
    const entry = FRAMEWORKS[fw as keyof typeof FRAMEWORKS]
    const src = readFileSync(join(examples, fw, recipes(fw)[0]!, entry), 'utf8')
    expect(src).toContain(`@svgrid/grid-wc/${fw}`)
  })
})

describe('framework versions come from the manifest, not a literal', () => {
  it('grid-wc declares every framework as an optional peer', () => {
    // The Svelte StackBlitz builder carries a comment about a hand-pinned
    // literal that rotted to ^1.0.0 while the demos were on v2. The framework
    // payload reads these instead, so they have to be here.
    const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'))
    for (const dep of ['react', 'react-dom', 'vue', '@angular/core', '@angular/common'])
      expect(pkg.peerDependencies?.[dep], `peerDependencies.${dep}`).toBeTruthy()
    for (const dep of ['react', 'vue', '@angular/core'])
      expect(pkg.peerDependenciesMeta?.[dep]?.optional, `${dep} must be optional`).toBe(true)
  })
})
