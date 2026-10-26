/**
 * The files an agent reads first agree with each other.
 *
 * llms.txt names functions in backticks and tells the agent to look any name
 * up at /api/<name>.json. Until 2026-10-26 the headless entry it named first,
 * `createSvGrid`, was not in the API reference at all, so that lookup 404ed.
 * And llms.txt pointed at llms-full.txt without saying it is 5 MB.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(ROOT, 'website', 'public')
const LLMS = join(PUBLIC, 'llms.txt')
const ready = existsSync(LLMS) && existsSync(join(PUBLIC, 'api'))

describe.skipIf(!ready)('llms.txt and /api agree', () => {
  const llms = ready ? readFileSync(LLMS, 'utf8') : ''

  it('every camelCase name llms.txt puts in backticks has an /api/<name>.json', () => {
    const names = new Set([...llms.matchAll(/`([a-z][a-z0-9]*[A-Z][A-Za-z0-9]*)`/g)].map((m) => m[1]!))
    expect(names.size).toBeGreaterThan(3)
    const missing = [...names].filter((n) => !existsSync(join(PUBLIC, 'api', `${n.toLowerCase()}.json`)))
    expect(missing, `named in llms.txt, no /api file: ${missing.join(', ')}`).toEqual([])
  })

  it('answers the URLs an agent guesses first', () => {
    for (const f of ['createsvgrid', 'svgrid', 'svgridapi', 'getrowposition', 'oncellclick']) {
      expect(existsSync(join(PUBLIC, 'api', `${f}.json`)), `/api/${f}.json`).toBe(true)
    }
    // The type and the component share a name; the file has to say which is which.
    const svgrid = JSON.parse(readFileSync(join(PUBLIC, 'api', 'svgrid.json'), 'utf8'))
    expect(svgrid.component?.name).toBe('<SvGrid>')
    expect(svgrid.component?.props?.some((p: { name: string }) => p.name === 'onCellClick')).toBe(true)
    // A prop's own file points back at the component.
    const prop = JSON.parse(readFileSync(join(PUBLIC, 'api', 'oncellclick.json'), 'utf8'))
    expect(prop.memberOf[0].signature).toMatch(/^onCellClick\?: \(event:/)
  })

  it('states the size of every file it points an agent at', () => {
    expect(llms).not.toMatch(/@@size:/)
    expect(llms).toMatch(/llms-full\.txt\) \(\d+(\.\d)? MB\)/)
    expect(llms).toMatch(/llms\/grid\.txt\) \(\d+ KB\)/)
  })
})
