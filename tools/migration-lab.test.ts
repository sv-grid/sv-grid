/**
 * The Svelte 5 upgrade guide quotes tools/migration-lab, never types.
 *
 * docs/help/svelte-5-upgrade-data-tables.md marks each quoted fence with
 * `<!-- captured: <file> -->` on the line above it. This pins that every such
 * fence is a contiguous, verbatim excerpt of that file under
 * tools/migration-lab/captured/ (or tools/migration-lab/fixture/ for the
 * inputs), that every capture the lab writes exists, and that no fence in the
 * guide's "what the tools printed" sections goes unmarked.
 *
 * Run: `pnpm vitest run tools/migration-lab.test.ts`
 * Regenerate the captures: `node tools/migration-lab/run.mjs`
 */
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const LAB = join(ROOT, 'tools', 'migration-lab')
const GUIDE = join(ROOT, 'docs', 'help', 'svelte-5-upgrade-data-tables.md')

const STEPS = [
  '01-svelte4-baseline.txt',
  '02-npm-install-svelte5.txt',
  '03-svelte5-legacy-component.txt',
  '04-svelte5-runes-component.txt',
  '05-codemod.txt',
  '06-after-codemod.txt',
  '07-hand-edits.txt',
  'PeopleTable.after.svelte',
]

const norm = (s: string) => s.replace(/\r\n/g, '\n')

/** A capture without its `# ` header lines. */
function bodyOf(text: string): string {
  return norm(text).replace(/^(#[^\n]*\n)+/, '')
}

function quotedFences(md: string): Array<{ file: string; code: string; line: number }> {
  const out: Array<{ file: string; code: string; line: number }> = []
  const re = /<!-- captured: ([^\s]+) -->\n```[a-z]*\n([\s\S]*?)\n```/g
  for (const m of md.matchAll(re)) {
    out.push({ file: m[1]!, code: m[2]!, line: md.slice(0, m.index).split('\n').length })
  }
  return out
}

describe('migration lab captures', () => {
  it('exist for every step the script writes', async () => {
    const present = new Set(await readdir(join(LAB, 'captured')))
    expect(STEPS.filter((s) => !present.has(s))).toEqual([])
  })

  it('each starts with the header that records the versions it was made with', async () => {
    for (const s of STEPS.filter((f) => f.endsWith('.txt'))) {
      const text = norm(await readFile(join(LAB, 'captured', s), 'utf-8'))
      expect(text, s).toMatch(/^# \d\d /)
      expect(text, s).toMatch(/^# captured \d{4}-\d{2}-\d{2} by tools\/migration-lab\/run\.mjs/m)
      expect(text, s).toMatch(/^# node v[\d.]+, npm [\d.]+, svelte [\d.]+, svelte-check [\d.]+/m)
    }
  })

  it('carry no absolute path or wall-clock timing', async () => {
    for (const s of STEPS) {
      const text = await readFile(join(LAB, 'captured', s), 'utf-8')
      expect(text, s).not.toMatch(/[A-Za-z]:\\(?:Users|xampp)|\/home\/|\/Users\//)
      expect(text, s).not.toMatch(/ in \d+(?:\.\d+)?(?:ms|s)\b/)
    }
  })
})

describe('the Svelte 5 upgrade guide', () => {
  it('quotes the lab verbatim in every marked fence', async () => {
    const md = norm(await readFile(GUIDE, 'utf-8'))
    const fences = quotedFences(md)
    expect(fences.length).toBeGreaterThan(8)
    const problems: string[] = []
    for (const f of fences) {
      const path = f.file.startsWith('fixture/') ? join(LAB, f.file) : join(LAB, 'captured', f.file)
      if (!existsSync(path)) {
        problems.push(`line ${f.line}: ${f.file} does not exist`)
        continue
      }
      const source = f.file.startsWith('fixture/') ? norm(await readFile(path, 'utf-8')) : bodyOf(await readFile(path, 'utf-8'))
      if (!source.includes(f.code)) problems.push(`line ${f.line}: the fence is not a verbatim excerpt of ${f.file} (rerun node tools/migration-lab/run.mjs, then re-quote)`)
    }
    expect(problems).toEqual([])
  })

  it('marks every text fence as a capture', async () => {
    const md = norm(await readFile(GUIDE, 'utf-8'))
    const unmarked: number[] = []
    const lines = md.split('\n')
    lines.forEach((l, i) => {
      if (l.startsWith('```text') && !(lines[i - 1] ?? '').startsWith('<!-- captured: ')) unmarked.push(i + 1)
    })
    expect(unmarked).toEqual([])
  })

  it('names every step at least once', async () => {
    const md = await readFile(GUIDE, 'utf-8')
    const missing = STEPS.filter((s) => !md.includes(`<!-- captured: ${s} -->`))
    expect(missing).toEqual([])
  })
})
