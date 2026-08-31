/**
 * Guardrails for the shadcn-svelte registry we serve at https://svgrid.com/r/,
 * which lets a shadcn app install the grid with the CLI it already has:
 *
 *   npx shadcn-svelte@latest add https://svgrid.com/r/data-table.json
 *
 *   - The served item must carry the SAME bytes as the @svgrid/ui recipe. Two
 *     install routes shipping two different components is the failure mode this
 *     whole generator exists to prevent.
 *   - `files[].target` must be RELATIVE to the project's components alias. The
 *     CLI joins the two, so a target of `src/lib/components/ui/x.svelte`
 *     installs to `src/lib/components/src/lib/components/ui/x.svelte`. That is
 *     a real bug we shipped once; this test is why it cannot come back.
 *   - The fields the CLI actually reads must be present and non-empty.
 *
 * Regenerate with: `node tools/build-shadcn-registry.mjs`
 * Run: `pnpm vitest run tools/shadcn-registry.test.ts`
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ROOT = process.cwd()
const R_DIR = join(ROOT, 'website', 'public', 'r')
const RECIPES = join(ROOT, 'packages', 'svgrid-ui', 'recipes')

// Item name -> the recipe whose bytes it must carry. Mirrors ITEMS in
// tools/build-shadcn-registry.mjs; a new entry there needs one here.
const EXPECTED = [{ name: 'data-table', recipe: 'data/data-table.svelte' }]

const readJson = async (p: string) => JSON.parse(await readFile(p, 'utf8'))

describe('shadcn-svelte registry', () => {
  it('lists every published item in the index', async () => {
    const index = await readJson(join(R_DIR, 'registry.json'))
    const names = index.items.map((i: { name: string }) => i.name)
    expect(names).toEqual(EXPECTED.map((e) => e.name))
  })

  for (const { name, recipe } of EXPECTED) {
    describe(name, () => {
      it('serves the recipe byte-for-byte', async () => {
        const item = await readJson(join(R_DIR, `${name}.json`))
        const source = await readFile(join(RECIPES, recipe), 'utf8')
        expect(item.files).toHaveLength(1)
        expect(item.files[0].content).toBe(source)
      })

      it('targets a path relative to the components alias', async () => {
        const item = await readJson(join(R_DIR, `${name}.json`))
        const target: string = item.files[0].target
        expect(target).toBeTruthy()
        // The CLI prepends the alias, so any of these would double up the path.
        expect(target.startsWith('/')).toBe(false)
        expect(target.startsWith('src/')).toBe(false)
        expect(target).not.toContain('$lib')
        expect(target).not.toContain('components/ui/components')
        expect(target.endsWith('.svelte')).toBe(true)
      })

      it('carries the fields the CLI reads', async () => {
        const item = await readJson(join(R_DIR, `${name}.json`))
        expect(item.$schema).toBe('https://shadcn-svelte.com/schema/registry-item.json')
        expect(item.name).toBe(name)
        expect(item.title).toBeTruthy()
        expect(item.description).toBeTruthy()
        expect(item.type).toBe('registry:block')
        expect(item.dependencies).toContain('@svgrid/grid')
        expect(item.files[0].type).toBe('registry:component')
      })

      it('has no em-dash glyph', async () => {
        const raw = await readFile(join(R_DIR, `${name}.json`), 'utf8')
        // Built from its code point so this file does not itself contain the
        // glyph the repo-wide house rule forbids.
        expect(raw).not.toContain(String.fromCharCode(0x2014))
      })
    })
  }
})
