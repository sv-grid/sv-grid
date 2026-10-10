/**
 * The skill's frontmatter must parse as YAML. An unquoted value holding ": "
 * (or " #") is not a plain scalar, and Claude Code then loads the skill with
 * empty metadata: no description, so nothing ever triggers it. That shipped on
 * 2026-10-10 when a sentence with "project: install" went into the description;
 * `claude plugin validate` caught it, nothing in CI did.
 *
 * No YAML dependency at the root, so this checks the one rule that bites: a
 * single-line `key: value` whose value is unquoted may not contain ": " or " #".
 *
 * Run: `pnpm vitest run tools/skill-frontmatter.test.ts`
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')
const FILES = ['skills/svgrid/SKILL.md', 'plugins/svgrid/skills/svgrid/SKILL.md']

function frontmatter(text: string): string[] {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!m) throw new Error('no frontmatter')
  return m[1].split(/\r?\n/)
}

describe.each(FILES)('%s frontmatter', (file) => {
  const lines = frontmatter(readFileSync(join(ROOT, file), 'utf8'))

  it('has a name and a description', () => {
    expect(lines.some((l) => /^name: \S/.test(l))).toBe(true)
    expect(lines.some((l) => /^description: \S/.test(l))).toBe(true)
  })

  it('has no unquoted value that YAML would reject', () => {
    const bad = lines.filter((l) => {
      const m = /^[A-Za-z][\w-]*: (.+)$/.exec(l)
      if (!m) return false
      const v = m[1].trim()
      if (/^["']/.test(v)) return !/["']$/.test(v)
      return v.includes(': ') || v.includes(' #')
    })
    expect(bad).toEqual([])
  })
})

it('the plugin folder carries its own LICENSE', () => {
  expect(readFileSync(join(ROOT, 'plugins', 'svgrid', 'LICENSE'), 'utf8')).toMatch(/^MIT License/)
})
