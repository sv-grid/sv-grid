import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import { ELEMENT_PROPS, ELEMENT_EVENTS, ELEMENT_METHODS } from './surface-sheet.generated.js'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = join(here, '..', '..')

/**
 * The member names of `<SvSheet>`'s Props type, read from the source with a
 * parser of this test's own, so a bug in the generator's parser cannot pass
 * itself: the block from `type Props = {` to its closing brace, comments
 * stripped, one member per line at the type's indent.
 */
function propsMembers(): string[] {
  const svelte = readFileSync(join(pkg, 'src', 'SvSheet.svelte'), 'utf8')
  const start = svelte.indexOf('\n  type Props = {')
  const end = svelte.indexOf('\n  }\n', start)
  const block = svelte.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '')
  return [...block.matchAll(/^ {4}([A-Za-z_][A-Za-z0-9_]*)\??:/gm)].map((m) => m[1]!)
}

/**
 * The element's surface is generated from `<SvSheet>`'s own Props type. These
 * are what catches a prop landing on the component and never reaching the
 * element, and the generator drifting from its outputs.
 */
describe('the generated <sv-sheet> surface is current', () => {
  it('regenerating produces no diff (--check)', () => {
    expect(() => execFileSync(process.execPath, [join(pkg, 'scripts', 'generate-sheet-surface.mjs'), '--check'], { encoding: 'utf8' })).not.toThrow()
  })
})

describe('parity with <SvSheet>', () => {
  const members = propsMembers()
  const declared = new Set(ELEMENT_PROPS.map((p) => p.name))
  const events = new Set(ELEMENT_EVENTS.map((e) => e.callback))

  it('reads the Props type', () => {
    expect(members.length).toBeGreaterThan(15)
    expect(members).toContain('document')
    expect(members).toContain('onAction')
  })

  it('every data prop is declared by the element and every callback is an event', () => {
    expect(members.filter((n: string) => !/^on[A-Z]/.test(n) && !declared.has(n))).toEqual([])
    expect(members.filter((n: string) => /^on[A-Z]/.test(n) && !events.has(n))).toEqual([])
    expect(ELEMENT_PROPS.filter((p) => !members.includes(p.name))).toEqual([])
  })

  it('primitives are attributes, objects are properties, height keeps a string attribute', () => {
    const byName = Object.fromEntries(ELEMENT_PROPS.map((p) => [p.name, p]))
    expect(byName.showRibbon).toMatchObject({ type: 'Boolean', attribute: 'show-ribbon' })
    expect(byName.rows).toMatchObject({ type: 'Number', attribute: 'rows' })
    expect(byName.height).toMatchObject({ type: 'String', attribute: 'height' })
    expect(byName.look).toMatchObject({ type: 'String', attribute: 'look' })
    expect(byName.document).toMatchObject({ type: 'Object', attribute: null })
    expect(byName.data).toMatchObject({ type: 'Array', attribute: null })
    expect(ELEMENT_EVENTS.map((e) => [e.event, e.params])).toEqual([
      ['action', ['action', 'cmd']], ['ready', ['api', 'document']], ['change', ['reasons']], ['presence', ['me']],
    ])
    expect(ELEMENT_METHODS).toEqual(['getState', 'setState', 'refresh', 'act', 'open', 'toXlsx', 'toOds', 'toCsv', 'newWorkbook', 'print', 'printHtml'])
  })
})
