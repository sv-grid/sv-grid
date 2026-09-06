import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { ELEMENT_PROPS, ELEMENT_EVENTS, ELEMENT_EXCLUDED, LEGACY_EVENTS } from '../src/surface.generated.js'
// @ts-expect-error - plain .mjs helper, no types
import { parseTypeMembers } from '../../mcp/scripts/api-surface.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const gridSrc = join(root, '..', 'grid', 'src')

/**
 * The elements' prop + event surface is generated from `<SvGrid>`'s own Props
 * type. Before that they declared 7 props and 2 events by hand against a type
 * with 100 props and 19 callbacks, so grouping, pagination, pinning, tree data
 * and every enterprise feature were unreachable from a non-Svelte host - while
 * the docs said they "all come along".
 *
 * These tests are the thing that would have caught that on the day it appeared,
 * and the thing that stops it recurring the next time a prop lands.
 */
describe('the generated surface is current', () => {
  it('regenerating produces no diff (--check)', () => {
    expect(() =>
      execFileSync(process.execPath, [join(root, 'scripts', 'generate-surface.mjs'), '--check'], {
        encoding: 'utf8',
      }),
    ).not.toThrow()
  })
})

describe('parity with <SvGrid>', () => {
  // Read from the SOURCE, not from the generated file - comparing that file
  // against itself would pass however wrong it was.
  //
  // It shares `parseTypeMembers` with the generator, so this is not a fully
  // independent parse and would not catch a bug in the parser itself. Two
  // things cover that gap: the generator refuses to emit when it sees fewer
  // than 100 members, and the attribute tests below assert named props by hand.
  // A second hand-rolled parser was tried and found 8 of 119 members - a wrong
  // oracle is worse than a shared one.
  const propsType = readFileSync(join(gridSrc, 'SvGrid.types.ts'), 'utf8')
  const declared = new Set(ELEMENT_PROPS.map((p) => p.name))
  const excluded = new Set(ELEMENT_EXCLUDED.map((e) => e.name))
  const events = new Set(ELEMENT_EVENTS.map((e) => e.callback))
  const members = parseTypeMembers(propsType, 'Props').map((m: { name: string }) => m.name)

  it('reads the Props type (guards against the walker matching nothing)', () => {
    expect(members.length).toBeGreaterThan(100)
    expect(members).toContain('columns')
    expect(members).toContain('onCellValueChange')
  })

  it('every data prop is declared by the elements, or excluded with a reason', () => {
    const missing = members.filter(
      (n) => !/^on[A-Z]/.test(n) && !declared.has(n) && !excluded.has(n),
    )
    expect(missing, `not reachable from <sv-grid>: ${missing.join(', ')}`).toEqual([])
  })

  it('every callback becomes an event', () => {
    const missing = members.filter((n) => /^on[A-Z]/.test(n) && !events.has(n))
    expect(missing, `callbacks with no event: ${missing.join(', ')}`).toEqual([])
  })

  it('every exclusion states why', () => {
    for (const e of ELEMENT_EXCLUDED) expect(e.reason.length).toBeGreaterThan(20)
  })
})

describe('attributes are only offered where an attribute can work', () => {
  const byName = (n: string) => ELEMENT_PROPS.find((p) => p.name === n)

  it('arrays and objects are property-only', () => {
    // An HTML attribute is a string. `columns='[object Object]'` cannot work,
    // and offering the attribute would invite exactly that.
    for (const p of ELEMENT_PROPS)
      if (p.type === 'Array' || p.type === 'Object')
        expect(p.attribute, `${p.name} should not have an attribute`).toBeNull()
  })

  it('primitives get a kebab-case attribute', () => {
    expect(byName('rowHeight')?.attribute).toBe('row-height')
    expect(byName('showRowNumbers')?.attribute).toBe('show-row-numbers')
    expect(byName('pageSize')?.attribute).toBe('page-size')
  })

  it('a number-or-string prop is typed String, so a percentage survives', () => {
    // `containerHeight: number | string` has to accept container-height="100%".
    // Number would coerce that to NaN.
    expect(byName('containerHeight')?.type).toBe('String')
  })

  it('a named string-union alias resolves rather than falling back to Object', () => {
    // groupDisplayMode is typed `GroupDisplayType`, declared in another file.
    // Unresolved it would be Object and lose its attribute.
    expect(byName('groupDisplayMode')?.type).toBe('String')
    expect(byName('groupDisplayMode')?.attribute).toBe('group-display-mode')
  })

  it('a union of boolean and a config keeps the boolean attribute', () => {
    // `<sv-grid selection-bar>` for the simple case, `el.selectionBar = {...}`
    // for the configured one - which is how HTML already behaves.
    expect(byName('selectionBar')?.type).toBe('Boolean')
    expect(byName('selectionBar')?.attribute).toBe('selection-bar')
  })
})

describe('the docs quote the real counts', () => {
  /**
   * The web-components pages state the surface size in prose - "98 properties,
   * 72 attributes, 19 events". Those are hand-written numbers describing a
   * generated thing, which is precisely the drift this whole feature exists to
   * remove: the old page said grouping and pagination "all come along" while
   * the element exposed neither.
   *
   * So every `<n> properties|attributes|events` in that section must match the
   * generated surface. Lines describing the PAST are exempt - the sentence
   * about the element once declaring 7 props and 2 events is a fact about the
   * old behaviour, not a claim about this one - and are marked by "used to".
   */
  const docsDir = join(root, '..', '..', 'docs', 'help', 'web-components')
  const pages = [
    join(root, '..', '..', 'docs', 'help', 'web-components.md'),
    ...readdirSync(docsDir).map((f) => join(docsDir, f)),
  ].filter((p) => p.endsWith('.md'))

  // `events` counts the distinct event NAMES a consumer can listen for, which
  // is the generated set plus any legacy alias that is not one of them. That is
  // 19 + `selectionchange` = 20. Counting only the generated 19 undersells both
  // the element and the wrappers, and the two halves of the docs disagreed
  // about it until this test said so.
  const aliasNames = LEGACY_EVENTS.filter(
    (l) => !ELEMENT_EVENTS.some((e) => e.event === l.event),
  ).length

  const expected: Record<string, number> = {
    properties: ELEMENT_PROPS.length,
    attributes: ELEMENT_PROPS.filter((p) => p.attribute).length,
    events: ELEMENT_EVENTS.length + aliasNames,
  }

  const claims = pages.flatMap((p) => {
    const text = readFileSync(p, 'utf8')
    return text
      .split(/\r?\n/)
      .filter((line) => !/used to|before this|historically/i.test(line))
      .flatMap((line) =>
        [...line.matchAll(/\b(\d+)\s+(properties|attributes|events)\b/g)].map((m) => ({
          file: p.split(/[\\/]/).pop()!,
          n: Number(m[1]),
          noun: m[2]!,
        })),
      )
  })

  it('finds the claims (a walker matching nothing would pass vacuously)', () => {
    expect(claims.length).toBeGreaterThan(2)
  })

  it.each(claims.map((c) => [`${c.file}: "${c.n} ${c.noun}"`, c]))('%s is current', (_label, c) => {
    const claim = c as { n: number; noun: string }
    expect(claim.n, `docs say ${claim.n} ${claim.noun}`).toBe(expected[claim.noun])
  })
})

describe('events published before the surface existed keep their payload', () => {
  it('rowclick and selectionchange are still emitted', () => {
    // <sv-grid> 2.6.2 shipped exactly these two. Their `detail` predates the
    // generic "detail = the callback's argument" rule, and changing it would
    // break every consumer already reading them.
    const body = readFileSync(join(root, 'src', 'GridBody.svelte'), 'utf8')
    expect(body).toContain('LEGACY_EVENTS')
  })

  it('rowclick is the only name that collides with a generated event', () => {
    const generated = new Set(ELEMENT_EVENTS.map((e) => e.event))
    expect(generated.has('rowclick')).toBe(true)
    expect(generated.has('selectionchange')).toBe(false)
  })

  it('a multi-argument callback carries a named detail', () => {
    // onRowSelectionChange(selection, rows) is the only one, and positional
    // args in a CustomEvent detail would be unreadable.
    const e = ELEMENT_EVENTS.find((x) => x.callback === 'onRowSelectionChange')
    expect(e?.params).toEqual(['selection', 'rows'])
  })
})
