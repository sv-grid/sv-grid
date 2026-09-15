/**
 * Every relative link in docs/ points at a file that exists.
 *
 * The website resolves a `.md` link against the page's folder and, when the
 * result is not a known page, falls back to a GitHub URL, so a link written
 * with one `../` too many renders fine and lands on a GitHub 404. The chart
 * pages shipped with twenty-one of those: `tools/check-links.mjs --local`
 * reported them, but that script only ran by hand before a release. This is
 * the same rule as a test, over docs/ alone so it stays fast.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')
const DOCS = join(ROOT, 'docs')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.md')) out.push(p)
  }
  return out
}

describe('docs relative links', () => {
  it('resolve to a file in the repo', () => {
    const broken: string[] = []
    for (const file of walk(DOCS)) {
      const src = readFileSync(file, 'utf8')
      // Code is not prose: a number format such as 0.00;[Red](0.00) in a
      // fence or in backticks has the shape of a link and is none. Fences
      // and inline code are blanked (line breaks kept, so line numbers
      // still point at the right place) before the links are read.
      const prose = src
        .replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, ' '))
        .replace(/`[^`\n]*`/g, (code) => ' '.repeat(code.length))
      for (const m of prose.matchAll(/\]\(([^)]+)\)/g)) {
        const link = m[1]!.trim().split('#')[0]!
        // Absolute URLs, in-page anchors and site-served root paths (/docs-media) are not files here.
        if (!link || /^(https?:|mailto:|#|\/)/.test(link)) continue
        if (!existsSync(resolve(dirname(file), link))) {
          const line = src.slice(0, m.index).split('\n').length
          broken.push(`${file.slice(ROOT.length + 1)}:${line} -> ${link}`)
        }
      }
    }
    expect(broken).toEqual([])
  })
})
