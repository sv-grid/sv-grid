/**
 * Guard that `docs/reference/SvGrid.md` agrees with the code about defaults.
 *
 * This class of bug is invisible in review and expensive in practice. The API
 * reference documented `enableRowSummaries` as defaulting to `false` while the
 * component defaulted it to `true`, and a Studio page asserted the opposite of
 * the reference. Every reader who trusted the docs was wrong, and 375 call
 * sites in this repo worked around the real behaviour.
 *
 * Deliberately narrow, because a noisy guard gets disabled:
 *   - only tables that actually declare a `Default` header column
 *   - only `true` / `false` / plain-number defaults
 *   - only props whose default is written in the code as `props.X ?? <literal>`
 * Anything else is reported as unverified rather than guessed at, and the test
 * asserts the verified set does not shrink by accident.
 *
 * Run: `pnpm vitest run tools/reference-defaults.test.ts`
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const DOC = join(ROOT, 'docs', 'reference', 'SvGrid.md')
const SOURCES = [
  join(ROOT, 'packages', 'grid', 'src', 'SvGrid.controller.svelte.ts'),
  join(ROOT, 'packages', 'grid', 'src', 'SvGrid.svelte'),
]

type Documented = { prop: string; value: string; line: number }

/** Rows from every markdown table that has its own `Default` column. */
function parseDocumentedDefaults(md: string): Documented[] {
  const lines = md.split('\n')
  const out: Documented[] = []
  let defaultCol = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (!line.trim().startsWith('|')) {
      defaultCol = -1
      continue
    }
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())

    // A header row re-scopes which column holds the default.
    const headerIdx = cells.findIndex((c) => /^Default$/i.test(c))
    if (headerIdx !== -1) {
      defaultCol = headerIdx
      continue
    }
    if (/^-+$/.test(cells[0]?.replace(/[\s-]/g, '') ?? '') || cells.every((c) => /^-*$/.test(c))) {
      continue // the |---|---| separator
    }
    if (defaultCol === -1) continue

    const prop = /^`([a-zA-Z][\w]*)`$/.exec(cells[0] ?? '')?.[1]
    const raw = cells[defaultCol]
    if (!prop || raw === undefined) continue

    const value = raw.replace(/`/g, '').trim()
    // Only unambiguous literals; `derived`, `-`, prose and unions are skipped.
    if (!/^(true|false|-?\d+(\.\d+)?)$/.test(value)) continue
    out.push({ prop, value, line: i + 1 })
  }
  return out
}

/** The literal on the right of `props.X ?? ...`, following alias chains. */
function actualDefault(code: string, prop: string): string | null {
  const re = new RegExp(
    `(?:props|opt)\\.${prop}\\s*\\?\\?\\s*((?:(?:props|opt)\\.\\w+\\s*\\?\\?\\s*)*)([^;,)\\n}]+)`,
  )
  const m = re.exec(code)
  if (!m) return null
  const literal = m[2]!.trim().replace(/[)\s]+$/, '')
  return /^(true|false|-?\d+(\.\d+)?)$/.test(literal) ? literal : null
}

describe('docs/reference/SvGrid.md defaults', () => {
  it('matches the defaults the code actually applies', async () => {
    const md = await readFile(DOC, 'utf8')
    const code = (await Promise.all(SOURCES.map((f) => readFile(f, 'utf8')))).join('\n')

    const documented = parseDocumentedDefaults(md)
    expect(documented.length).toBeGreaterThan(5)

    const mismatches: string[] = []
    let verified = 0

    for (const { prop, value, line } of documented) {
      const actual = actualDefault(code, prop)
      if (actual === null) continue // not expressed as a `?? literal`; unverifiable here
      verified++
      if (actual !== value) {
        mismatches.push(
          `${prop}: docs/reference/SvGrid.md:${line} says \`${value}\`, code applies \`${actual}\``,
        )
      }
    }

    expect(mismatches, mismatches.join('\n')).toEqual([])
    // Keep the guard honest: if a refactor stops the extractor resolving
    // defaults, this fails rather than silently verifying nothing.
    expect(verified).toBeGreaterThanOrEqual(5)
  })
})
