/**
 * The QA gate: ties the public surface to this directory.
 *
 * 1. Every `SvGridApi` member in the type must be exercised by a QA case.
 * 2. Every `<SvGrid>` prop must be exercised by a QA case.
 * 3. Every `ColumnDef` option must be exercised by a QA case.
 * 4. The object handed to `onApiReady` must expose exactly the members the type
 *    promises - no missing methods, no undocumented extras.
 *
 * A new prop, column option or api member therefore cannot ship without a QA
 * case (or an explicit, reasoned exemption).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { mountQaGrid } from './harness.svelte'

const here = dirname(fileURLToPath(import.meta.url))
const srcDir = join(here, '..')

/** Body of a top-level `export type X` object type, brace-matched. */
function typeBody(file: string, declaration: string): string {
  const source = readFileSync(join(srcDir, file), 'utf8')
  const start = source.indexOf(declaration)
  expect(start, `${declaration} not found in ${file}`).toBeGreaterThan(-1)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open, i)
    }
  }
  throw new Error(`unbalanced braces in ${declaration}`)
}

/** Member names declared at the top level of an object type body. */
function topLevelMembers(body: string): string[] {
  const names = new Set<string>()
  let depth = 0
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (depth === 1) {
      const m = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*(\??\s*:|\(|<)/.exec(trimmed)
      if (m) names.add(m[1]!)
    }
    for (const ch of line) {
      if (ch === '{' || ch === '(' || ch === '[') depth += 1
      else if (ch === '}' || ch === ')' || ch === ']') depth -= 1
    }
  }
  return [...names]
}

const apiMembers = topLevelMembers(
  typeBody('svgrid-wrapper.types.ts', 'export type SvGridApi<'),
)
const propNames = topLevelMembers(typeBody('SvGrid.types.ts', 'export type Props<'))
const columnOptions = topLevelMembers(typeBody('core.ts', 'export type ColumnDef<'))

/** Every QA test source, concatenated. */
const qaSources = readdirSync(here)
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => readFileSync(join(here, f), 'utf8'))
  .join('\n')

/**
 * Props with no QA case, and why. Empty on purpose: every prop the component
 * accepts is exercised somewhere in this directory. Add an entry only with a
 * reason, and only when jsdom genuinely cannot reach the behaviour.
 */
const EXEMPT: Record<string, string> = {}

/**
 * Does a QA source actually USE this name? A prose mention does not count, so
 * the name has to appear as an object key (`prop: value`) or as a quoted string
 * (`setOption('prop', ...)`, `getOption('prop')`).
 */
function isExercised(name: string): boolean {
  return (
    // `prop: value`
    new RegExp(`(?:^|[\\s({,[])${name}\\s*:`, 'm').test(qaSources) ||
    // `{ prop }` shorthand
    new RegExp(`[{,]\\s*${name}\\s*[,}]`).test(qaSources) ||
    // `setOption('prop', ...)` / `getOption('prop')`
    new RegExp(`['"\`]${name}['"\`]`).test(qaSources)
  )
}

describe('QA gate: the api surface is fully exercised', () => {
  it('finds the api members in the type', () => {
    // A parse failure would make the gate pass vacuously.
    expect(apiMembers.length).toBeGreaterThan(80)
    expect(apiMembers).toContain('getCellValue')
    expect(apiMembers).toContain('setState')
  })

  it('exercises every SvGridApi member in a QA case', () => {
    const missing = apiMembers.filter((m) => !new RegExp(`\\.${m}\\s*\\(`).test(qaSources))
    expect(missing, `SvGridApi members with no QA case: ${missing.join(', ')}`).toEqual([])
  })

  it('hands back exactly the members the type promises', async () => {
    const { api } = await mountQaGrid()
    const runtime = Object.keys(api as unknown as Record<string, unknown>)

    const missing = apiMembers.filter((m) => !runtime.includes(m))
    expect(missing, `typed but absent at runtime: ${missing.join(', ')}`).toEqual([])

    const extra = runtime.filter((m) => !apiMembers.includes(m))
    expect(extra, `present at runtime but untyped: ${extra.join(', ')}`).toEqual([])

    for (const member of apiMembers) {
      expect(typeof (api as unknown as Record<string, unknown>)[member]).toBe('function')
    }
  })
})

describe('QA gate: the column surface is fully exercised', () => {
  it('finds the column options in the type', () => {
    expect(columnOptions.length).toBeGreaterThan(30)
    expect(columnOptions).toContain('field')
    expect(columnOptions).toContain('cellClass')
  })

  it('exercises every ColumnDef option in a QA case', () => {
    const missing = columnOptions.filter((o) => !(o in EXEMPT) && !isExercised(o))
    expect(missing, `ColumnDef options with no QA case: ${missing.join(', ')}`).toEqual([])
  })
})

describe('QA gate: the prop surface is fully exercised', () => {
  it('finds the props in the type', () => {
    expect(propNames.length).toBeGreaterThan(100)
    expect(propNames).toContain('data')
    expect(propNames).toContain('onApiReady')
  })

  it('exercises every prop in a QA case', () => {
    const missing = propNames.filter((p) => !(p in EXEMPT) && !isExercised(p))
    expect(missing, `props with no QA case: ${missing.join(', ')}`).toEqual([])
  })

  it('keeps the exemption list honest', () => {
    const stale = Object.keys(EXEMPT).filter((p) => !propNames.includes(p))
    expect(stale, `exempted props that no longer exist: ${stale.join(', ')}`).toEqual([])
  })
})
