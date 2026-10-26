/**
 * The Bolt and Lovable tutorials (docs/help/bolt-new.md, lovable.md,
 * ai-app-builders.md) quote the starters under templates/ verbatim: the
 * Lovable prompt carries DataGrid.tsx and the theme block, the knowledge
 * blocks are the starters' AGENTS.md, and each "Open this prompt" link
 * carries its prompt URL-encoded. Any of these drifting means a reader pastes
 * or launches something other than what was tested.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PAGES, promptFromLink, syncPromptLinks } from './sync-ai-builder-links.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

const bolt = read('docs/help/bolt-new.md')
const lovable = read('docs/help/lovable.md')
const hub = read('docs/help/ai-app-builders.md')

/** Every fenced block with the given info string, in order. */
function fences(md: string, info: string): string[] {
  const out: string[] = []
  const re = new RegExp('^```' + info + '\\n([\\s\\S]*?)^```$', 'gm')
  for (const m of md.matchAll(re)) out.push(m[1]!.replace(/\n$/, ''))
  return out
}

/** Lines that are code: no blanks, no comment-only lines. */
function codeLines(src: string): string[] {
  return src
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() && !/^\s*(\/\/|\/\*\*|\*\/|\*)/.test(l))
}

/** AGENTS.md from its "## Tables and data grids" heading to the end. */
function knowledgeOf(agentsMd: string): string {
  const i = agentsMd.indexOf('## Tables and data grids')
  expect(i).toBeGreaterThan(-1)
  return agentsMd.slice(i).trimEnd()
}

describe('AI app builder tutorials', () => {
  it('every "Open this prompt" link carries the prompt shown above it', () => {
    for (const rel of PAGES) {
      const md = read(rel)
      const { markdown, prompts } = syncPromptLinks(md)
      expect(markdown, `${rel}: run node tools/sync-ai-builder-links.mjs`).toBe(md)
      expect(prompts.length).toBeGreaterThan(0)
      for (const { prompt, line } of prompts) {
        const url = /\]\((.*)\)\s*$/.exec(md.split('\n')[line - 1]!)![1]!
        expect(url).not.toMatch(/[()\s]/)
        expect(promptFromLink(url)).toBe(prompt)
      }
    }
  })

  it("the Lovable prompt carries the starter's DataGrid.tsx and theme block", () => {
    const prompt = fences(lovable, 'text')[0]!
    const promptLines = prompt.split('\n').map((l) => l.trimEnd())
    let at = 0
    for (const line of codeLines(read('templates/lovable-react-grid/src/components/DataGrid.tsx'))) {
      const found = promptLines.indexOf(line, at)
      expect(found, `missing or out of order in the prompt: ${line}`).toBeGreaterThanOrEqual(0)
      at = found + 1
    }
    const css = /\.svgrid-theme \{[\s\S]*?\n\}/.exec(read('templates/lovable-react-grid/src/index.css'))![0]
    expect(prompt).toContain(css)
  })

  it("the commented DataGrid listing is the starter's code", () => {
    const listing = fences(lovable, 'tsx \\{nocheck\\}')[0]!
    expect(codeLines(listing)).toEqual(codeLines(read('templates/lovable-react-grid/src/components/DataGrid.tsx')))
  })

  it("the knowledge blocks are the starters' AGENTS.md and fit Lovable's limit", () => {
    const boltKnowledge = fences(bolt, 'md')[0]!
    const lovableKnowledge = fences(lovable, 'md')[0]!
    expect(boltKnowledge).toBe(knowledgeOf(read('templates/bolt-svelte-grid/AGENTS.md')))
    expect(lovableKnowledge).toBe(knowledgeOf(read('templates/lovable-react-grid/AGENTS.md')))
    // Lovable project knowledge holds up to 10,000 characters.
    expect(boltKnowledge.length).toBeLessThan(10_000)
    expect(lovableKnowledge.length).toBeLessThan(10_000)
  })

  it('the starters stay on Vite 7, which WebContainers can run', () => {
    for (const t of ['bolt-svelte-grid', 'lovable-react-grid']) {
      const pkg = JSON.parse(read(`templates/${t}/package.json`))
      const dev = { ...pkg.dependencies, ...pkg.devDependencies }
      expect(dev.vite, t).toMatch(/^\^7\./)
      if (dev['@sveltejs/vite-plugin-svelte']) expect(dev['@sveltejs/vite-plugin-svelte']).toMatch(/^\^6\./)
    }
  })

  it('DataGrid.tsx never imports the element at module scope', () => {
    const src = read('templates/lovable-react-grid/src/components/DataGrid.tsx')
    const imports = src.match(/^import .*$/gm) ?? []
    for (const line of imports.filter((l) => l.includes('@svgrid/grid-wc'))) {
      expect(line, 'a value import would run on the server').toMatch(/^import type /)
    }
    expect(src).toMatch(/lazy\(\(\) => import\('@svgrid\/grid-wc\/react'\)/)
  })

  it('every image the tutorials embed exists', () => {
    for (const md of [bolt, lovable, hub]) {
      for (const [, src] of md.matchAll(/!\[[^\]]*\]\((\/docs-media\/[^)]+)\)/g)) {
        expect(existsSync(join(ROOT, 'website', 'public', src!)), src).toBe(true)
      }
    }
  })
})
