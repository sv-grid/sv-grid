/**
 * Deep QA: the shell against its own tables.
 *
 * A missing key shows as the key: `cannotOpenLink` in the status bar rather
 * than a sentence, and only on the path that raises it, which is why a
 * feature can ship with one. This reads the sources instead of the screen,
 * so a `t('...')` added without its default fails here rather than in front
 * of someone. The same for the ribbon: an item whose action nothing
 * handles is a button that does nothing when it is pressed, which type
 * checking cannot see because the id it emits is a valid one.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultSheetMessages } from './messages'

// The package's own src, found from where vitest runs rather than from the
// module URL, which vitest serves over its own scheme.
const root = join(process.cwd(), 'src')

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) { sources(path, out); continue }
    if (/\.(svelte|ts)$/.test(name) && !/\.(test|test-harness)\.(ts|svelte\.ts)$/.test(name)) out.push(path)
  }
  return out
}

/** `t('someKey')` and `t('some.key', { … })`, but not `t(variable)`. */
const CALL = /\bt\(\s*'([A-Za-z][A-Za-z0-9_.]*)'/g
/** Keys built from a value at runtime, which no scan can resolve. */
const DYNAMIC = new Set(['key', 'nav.'])

describe('the messages map answers every key the shell asks for', () => {
  it('no source asks for a message the defaults do not carry', () => {
    const missing = new Map<string, string[]>()
    for (const path of sources(root)) {
      const text = readFileSync(path, 'utf8')
      for (const match of text.matchAll(CALL)) {
        const key = match[1]!
        if (DYNAMIC.has(key) || key in defaultSheetMessages) continue
        missing.set(key, [...(missing.get(key) ?? []), path.slice(root.length + 1)])
      }
    }
    expect(Object.fromEntries(missing), 'keys with no default').toEqual({})
  })

  it('found enough calls to be reading the shell at all', () => {
    let found = 0
    for (const path of sources(root)) found += [...readFileSync(path, 'utf8').matchAll(CALL)].length
    expect(found, 'message calls seen').toBeGreaterThan(400)
  })
})

/** `emits`, `launcher` and `lit` on a ribbon item: what pressing it raises. */
const RIBBON_ACTION = /(?:emits|launcher|lit):\s*'([a-z0-9-]+)'/g
/** The shell's `handleAction` is a switch, so each action it runs is a case. */
const HANDLED = /case '([a-z0-9-]+)'/g

describe('the shell handles every action its ribbon raises', () => {
  it('no ribbon item raises an action nothing runs', () => {
    const ribbon = readFileSync(join(root, 'sheet', 'ribbon.ts'), 'utf8')
    const shell = readFileSync(join(root, 'SvSheet.svelte'), 'utf8')
    const handled = new Set([...shell.matchAll(HANDLED)].map((m) => m[1]!))
    const raised = new Set([...ribbon.matchAll(RIBBON_ACTION)].map((m) => m[1]!))
    expect(raised.size, 'ribbon actions found').toBeGreaterThan(100)
    expect([...raised].filter((id) => !handled.has(id)), 'actions with no case').toEqual([])
  })
})
