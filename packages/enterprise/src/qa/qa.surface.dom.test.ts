/**
 * The enterprise QA gate, mirroring `packages/grid/src/qa/qa.surface.test.ts`.
 *
 * 1. Every member `installEnterprise` adds - on the api, on `ai`, on `pivot` -
 *    must be exercised by a QA case in this directory.
 * 2. The installed api must match the `EnterpriseGridApi` type at runtime.
 * 3. Every `enable*` registration the install performs must be exercised.
 *
 * A new enterprise api member therefore cannot ship without a QA case.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { mountProGrid } from './harness.svelte'

const here = dirname(fileURLToPath(import.meta.url))
const srcDir = join(here, '..')

/** Member names declared at the top level of an object type body. */
function typeMembers(file: string, declaration: string): string[] {
  const source = readFileSync(join(srcDir, file), 'utf8')
  const start = source.indexOf(declaration)
  expect(start, `${declaration} not found in ${file}`).toBeGreaterThan(-1)
  const open = source.indexOf('{', start)
  let depth = 0
  let end = -1
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const body = source.slice(open, end)
  const names = new Set<string>()
  let level = 0
  for (const line of body.split('\n')) {
    if (level === 1) {
      const m = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*(\??\s*:|\(|<)/.exec(line.trim())
      if (m) names.add(m[1]!)
    }
    for (const ch of line) {
      if (ch === '{' || ch === '(' || ch === '[') level += 1
      else if (ch === '}' || ch === ')' || ch === ']') level -= 1
    }
  }
  return [...names]
}

const apiMembers = typeMembers('install.ts', 'export type EnterpriseGridApi<').filter(
  // The type intersects SvGridApi, whose members are covered by the grid's own
  // QA suite; only what enterprise ADDS is this gate's business.
  (m) => m !== '_rowType',
)
const aiMembers = typeMembers('install.ts', 'export type EnterpriseAIApi<').filter(
  (m) => m !== '_rowType',
)
const pivotMembers = typeMembers('install.ts', 'export type EnterprisePivotApi<')

const qaSources = readdirSync(here)
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => readFileSync(join(here, f), 'utf8'))
  .join('\n')

describe('QA gate: the enterprise api surface', () => {
  it('finds the members in the types', () => {
    expect(apiMembers).toEqual(
      expect.arrayContaining(['exportData', 'copyExport', 'print', 'importData', 'ai', 'pivot']),
    )
    expect(aiMembers.length).toBeGreaterThanOrEqual(7)
    expect(pivotMembers).toEqual(['build', 'buildFrom'])
  })

  it('exercises every api member in a QA case', () => {
    const missing = apiMembers.filter((m) => !new RegExp(`\\.${m}\\b`).test(qaSources))
    expect(missing, `enterprise api members with no QA case: ${missing.join(', ')}`).toEqual([])
  })

  it('exercises every ai.* and pivot.* member in a QA case', () => {
    const missingAi = aiMembers.filter((m) => !new RegExp(`ai\\.${m}\\s*\\(`).test(qaSources))
    expect(missingAi, `ai members with no QA case: ${missingAi.join(', ')}`).toEqual([])

    const missingPivot = pivotMembers.filter(
      (m) => !new RegExp(`pivot\\.${m}\\s*\\(`).test(qaSources),
    )
    expect(missingPivot, `pivot members with no QA case: ${missingPivot.join(', ')}`).toEqual([])
  })

  it('the installed api matches the type at runtime', async () => {
    const { pro } = await mountProGrid()
    const runtime = pro as unknown as Record<string, unknown>

    for (const member of apiMembers) {
      expect(runtime[member], member).toBeDefined()
    }
    expect(typeof runtime.exportData).toBe('function')
    expect(typeof runtime.copyExport).toBe('function')
    expect(typeof runtime.print).toBe('function')
    expect(typeof runtime.importData).toBe('function')

    const ai = runtime.ai as Record<string, unknown>
    for (const member of aiMembers) expect(typeof ai[member], `ai.${member}`).toBe('function')

    const pivot = runtime.pivot as Record<string, unknown>
    for (const member of pivotMembers) {
      expect(typeof pivot[member], `pivot.${member}`).toBe('function')
    }
  })

  it('exercises every registration the install performs', () => {
    // installEnterprise calls these for their side effects; each one is what
    // makes a community prop stop rendering an upsell.
    const install = readFileSync(join(srcDir, 'install.ts'), 'utf8')
    const registrations = [
      ...new Set(
        [...install.matchAll(/\b(enable[A-Z][A-Za-z]*|registerExportProvider)\(/g)].map(
          (m) => m[1]!,
        ),
      ),
    ]
    expect(registrations.length).toBeGreaterThanOrEqual(5)

    // The install is what wires them, so a QA case that installs and then
    // asserts the resulting behaviour is the coverage. Name them here so a new
    // registration has to be accounted for.
    const accounted = new Set([
      'enableAiCharting',       // qa.ai: pro.ai.chart on a charting grid
      'enableSchedulerView',    // qa.install: no scheduler upsell after install
      'enableBoardView',        // qa.install: board renders its host
      'enableSelectionBar',     // qa.install: install adds it without throwing
      'registerExportProvider', // qa.ai: ai.export writes through the engine
      'enablePivot',            // qa.pivot: pro.pivot.build
      'enableAdvancedFilter',   // qa.advanced-filter: rows actually drop
    ])
    const unaccounted = registrations.filter((r) => !accounted.has(r))
    expect(
      unaccounted,
      `install registrations with no QA case: ${unaccounted.join(', ')}`,
    ).toEqual([])
  })
})
