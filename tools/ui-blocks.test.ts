/**
 * Guardrails for the page blocks (/demos SvGrid UI > Blocks, and
 * `npx @svgrid/ui add blocks/<group>`).
 *
 * A block is copied into someone else's app as one file, so it has to stand
 * on its own:
 *   - the @svgrid/ui recipe is a byte copy of the gallery demo, and the
 *     recipe registry lists exactly the blocks the gallery has
 *     (tools/sync-block-recipes.mjs writes both);
 *   - every Blocks demo sits in a known sub-group (block-groups.json);
 *   - imports come from '@svgrid/grid' only (no demo helpers, no other deps);
 *   - no remote images or fonts: art is inline SVG or CSS;
 *   - no `as` casts in template expressions (they pass svelte-check but
 *     break vitest and the build);
 *   - no em-dash, and a header comment that MCP and the docs use as the pitch.
 *
 * Fix drift with: node tools/sync-block-recipes.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { transform } from 'esbuild'
import { createRequire } from 'node:module'
import { planBlockRecipes, mergeRegistry } from './sync-block-recipes.mjs'
import { parseDemoRegistry } from './lib/demo-registry.mjs'
import { moduleScript } from '../packages/svgrid-ui/headless.mjs'

const ROOT = process.cwd()
const RECIPES = join(ROOT, 'packages', 'svgrid-ui', 'recipes')
const DEMOS = join(ROOT, 'examples', 'src', 'demos')

// svelte is a dev dependency of @svgrid/ui, whose recipes these blocks become.
const { compileModule } = createRequire(join(ROOT, 'packages', 'svgrid-ui', 'package.json'))('svelte/compiler') as typeof import('svelte/compiler')

const plan = await planBlockRecipes(ROOT)
const blocks = (await parseDemoRegistry(ROOT)).filter((d: { category: string }) => d.category === 'Blocks')
const registry = JSON.parse(readFileSync(join(RECIPES, 'registry.json'), 'utf8'))

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? listFiles(p) : [p]
  })
}

/** Every sv-* class the kit's own components style. A block class that equals
 *  one of these would pick up (or fight) the kit's rules. */
const KIT_CLASSES = new Set(
  listFiles(join(ROOT, 'packages', 'grid', 'src'))
    .filter((f) => f.endsWith('.svelte'))
    .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/\.(sv-[\w-]+)/g)].map((m) => m[1]!)),
)

/** The markup part of a component: <script> and <style> blocks removed. */
function templateOf(src: string): string {
  return src.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
}

describe('ui blocks: recipe sync', () => {
  it('has blocks to check', () => {
    expect(blocks.length).toBeGreaterThan(0)
  })

  it('puts every Blocks demo in a known sub-group', () => {
    expect(plan.problems).toEqual([])
  })

  it('ships each block as a byte copy of its demo', () => {
    const stale: string[] = []
    for (const [dest, src] of plan.files) {
      if (!existsSync(dest) || !readFileSync(dest).equals(readFileSync(src))) stale.push(dest)
    }
    expect(stale, 'run node tools/sync-block-recipes.mjs').toEqual([])
  })

  it('has no orphan block recipes', () => {
    const orphans = listFiles(join(RECIPES, 'blocks')).filter((f) => !plan.files.has(f))
    expect(orphans, 'run node tools/sync-block-recipes.mjs').toEqual([])
  })

  it('lists exactly the gallery blocks in the recipe registry', () => {
    expect(registry, 'run node tools/sync-block-recipes.mjs').toEqual(mergeRegistry(registry, plan))
  })

  it('resolves every `npx @svgrid/ui add` button in the docs', () => {
    // Docs.svelte turns <div data-docs-add="add x y"> into a copyable command.
    // A token that is not an id, alias or group fails for the reader, and an
    // id shadowed by a group installs the whole group (that was `add layout`).
    const known = new Set<string>(Object.keys(registry.groups))
    for (const it of registry.items) {
      known.add(it.id)
      for (const a of it.aliases ?? []) known.add(a.toLowerCase())
    }
    const bad: string[] = []
    for (const f of listFiles(join(ROOT, 'docs')).filter((p) => p.endsWith('.md'))) {
      for (const m of readFileSync(f, 'utf8').matchAll(/data-docs-add="add ([^"]+)"/g)) {
        for (const tok of m[1]!.split(/\s+/).filter((t) => !t.startsWith('-'))) {
          if (!known.has(tok.toLowerCase())) bad.push(`${f.slice(ROOT.length + 1)}: ${tok}`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('keeps the CLI docs group table in step with the registry', () => {
    const md = readFileSync(join(ROOT, 'docs', 'help', 'ui-components', 'cli.md'), 'utf8')
    const rows = [...md.matchAll(/^\| `([^`]+)` \| ([^|]+) \|\s*$/gm)].map((m) => [m[1], m[2]!.trim()])
    const want = Object.entries(registry.groups as Record<string, { items: string[] }>)
      .filter(([k]) => !k.startsWith('blocks/'))
      .map(([k, g]) => [k, g.items.join(', ')])
    expect(rows).toEqual(want)
  })

  it('keeps recipe ids unique across components and blocks', () => {
    const ids = registry.items.map((it: { id: string }) => it.id)
    expect(ids.filter((id: string, i: number) => ids.indexOf(id) !== i)).toEqual([])
    const groups = new Set(Object.keys(registry.groups))
    expect(ids.filter((id: string) => groups.has(id))).toEqual([])
  })
})

describe('ui blocks: each block stands alone', () => {
  for (const d of blocks) {
    const src = readFileSync(join(DEMOS, `${d.id}.svelte`), 'utf8')
    describe(d.id, () => {
      it("imports from '@svgrid/grid' only", () => {
        // Import statements (single- or multi-line) and dynamic import(), not
        // string literals that happen to contain the word 'import'.
        const script = (src.match(/<script[^>]*>([\s\S]*?)<\/script>/g) ?? []).join('\n')
        // `import x from 'm'`, `import { a,\n b } from 'm'`, `import 'm'`, and
        // `export { a } from 'm'` / `export * from 'm'` - not `export const x = 'm'`.
        const specs = [
          ...script.matchAll(/^\s*import\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm),
          ...script.matchAll(/^\s*export\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/gm),
          ...script.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g),
        ].map((m) => m[1])
        expect(specs.filter((s) => s !== '@svgrid/grid')).toEqual([])
      })

      it('loads no remote images or fonts', () => {
        expect(src).not.toMatch(/\b(?:src|srcset)\s*=\s*["']?https?:/i)
        expect(src).not.toMatch(/url\(\s*["']?https?:/i)
        expect(src).not.toMatch(/@import\s/)
      })

      it('has no `as` cast in a template expression', () => {
        const casts = templateOf(src).match(/\{[^{}]*\bas\s+(?:const\b|[A-Z][\w.]*)[^{}]*\}/g) ?? []
        expect(casts).toEqual([])
      })

      it('uses --sg-focus-ring as a color, not as a whole box-shadow', () => {
        // The kit and every theme set it to a color; `box-shadow: var(--sg-focus-ring)`
        // is an invalid declaration there, so the focus ring silently disappears.
        expect(src).not.toMatch(/box-shadow:\s*var\(--sg-focus-ring/)
      })

      it('has no em-dash', () => {
        expect(src).not.toContain(String.fromCharCode(0x2014))
      })

      it('opens with a header comment naming the block', () => {
        expect(src).toMatch(/^\s*<script[^>]*>\s*\/\*\*[\s\S]{0,200}?\bblock\b/i)
      })

      it('has a headless core: an exported create*() in <script module>, used by the render', async () => {
        const core = moduleScript(src)
        expect(core, 'no <script lang="ts" module>').not.toBeNull()
        const fns = [...core!.matchAll(/export function (create[A-Z]\w*)\s*[<(]/g)].map((m) => m[1]!)
        expect(fns.length, 'export a create<Name>() core').toBeGreaterThan(0)
        const instance = src.replace(/<script\b(?=[^>]*\bmodule\b)[^>]*>[\s\S]*?<\/script>/, '')
        expect(fns.some((f) => new RegExp(`\\b${f}\\(`).test(instance)), 'the styled render calls the core').toBe(true)
        // The core ships alone as <block>.svelte.ts (npx @svgrid/ui add --headless).
        // Types like SvGridApi are fine; a component (a value import) is not.
        const valueImports = [...core!.matchAll(/^\s*import\s+(?!type\b)\{([^}]*)\}/gm)]
          .flatMap((m) => m[1]!.split(','))
          .map((s) => s.trim())
          .filter((s) => s && !s.startsWith('type '))
        expect(valueImports.filter((s) => /^Sv[A-Z]/.test(s)), 'the core imports no components').toEqual([])
        const js = (await transform(core!, { loader: 'ts' })).code
        expect(() => compileModule(js, { filename: `${d.id}.svelte.js` })).not.toThrow()
      })

      it('prefixes every class it defines with sv- and reuses no kit class', () => {
        const style = (src.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/:global\((?:[^()]|\([^()]*\))*\)/g, '')
        const defined = new Set([...style.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]!))
        const markup = templateOf(src)
        for (const m of markup.matchAll(/\sclass="([^"{]*)/g)) for (const c of m[1]!.split(/\s+/)) if (c) defined.add(c)
        for (const m of markup.matchAll(/\sclass:([\w-]+)/g)) defined.add(m[1]!)
        const bad = [...defined].filter((c) => !c.startsWith('sv-') || KIT_CLASSES.has(c))
        expect(bad, 'block classes must be sv-<block>-*, and not a kit class').toEqual([])
      })
    })
  }
})
