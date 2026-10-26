/**
 * Demo titles and blurbs carry no competitor names.
 *
 * They ship far past the gallery: /demos.md, every /demos/<id>.md, the MCP
 * corpus an agent searches, and the registry the website renders. AGENTS.md
 * keeps rival names to the comparison and migration pages, and nothing checked
 * this copy: demo 338 called itself "a FullCalendar-style scheduler" until
 * 2026-10-26, served to every agent that listed the demos.
 *
 * The names come from the comparison data, so a new comparison is covered
 * without editing this file, plus the calendar, Gantt and spreadsheet vendors
 * that data has no page for.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Not rivals: the integrations our own docs set up, and jQWidgets' own
 * products (jqxGrid, Smart Web Components - demo 77 integrates Smart.Chart).
 */
const NOT_RIVALS = new Set(['Flowbite', 'Skeleton', 'shadcn-svelte', 'jqxGrid', 'Smart'])
const EXTRA = ['FullCalendar', 'Bryntum', 'DHTMLX', 'SpreadJS']

function rivalNames(): string[] {
  const dir = join(ROOT, 'docs', '_data', 'comparisons')
  const names = new Set(EXTRA)
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const { competitor } = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { competitor?: string }
    if (!competitor) continue
    // "AG Grid (community + enterprise)" -> "AG Grid"; "PrimeVue / PrimeNG / ..." -> each.
    for (const part of competitor.replace(/\s*\(.*\)\s*/, '').split('/')) {
      const name = part.replace(/\b(tables?|DataTable|DataGrid|Grid)\b$/i, '').trim().replace(/\.$/, '')
      if (name.length >= 4 && !NOT_RIVALS.has(name)) names.add(name)
    }
  }
  return [...names]
}

const SOURCES = [
  join(ROOT, 'examples', 'src', 'shared', 'registry.ts'),
  join(ROOT, 'website', 'src', 'lib', 'demos.ts'),
].filter(existsSync)

describe('demo copy names no competitor', () => {
  it('derives a usable list of names', () => {
    const names = rivalNames()
    expect(names).toContain('FullCalendar')
    expect(names.length).toBeGreaterThan(10)
  })

  it('keeps every demo(...) title and blurb free of them', () => {
    const names = rivalNames()
    const hits: string[] = []
    for (const file of SOURCES) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (!/^\s*demo\(/.test(line)) return
        for (const n of names) {
          if (new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(line)) {
            hits.push(`${file.slice(ROOT.length + 1)}:${i + 1} names "${n}"`)
          }
        }
      })
    }
    expect(hits, hits.join('\n')).toEqual([])
  })
})
