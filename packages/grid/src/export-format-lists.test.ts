/** A list cell starts a formula as easily as a string does: `=1+1,b` is one cell of a CSV. */
import { describe, expect, it } from 'vitest'
import { serializeDelimited } from './export-format'

const csv = (value: unknown, escapeFormulas = true) =>
  serializeDelimited([{ a: 'A' }, { a: value }], ['a'], { csv: { delimiter: ',', bom: false, escapeFormulas } })

describe('escapeFormulas on values that are not strings', () => {
  it('guards a list', async () => {
    const text = await csv(['=1+1', 'b'])
    expect(text).not.toMatch(/(^|\n)"?=/)
    expect(text).toContain(`'=1+1`)
  })

  it('guards an object that writes itself as a formula', async () => {
    expect(await csv({ toString: () => '=cmd()' })).toContain(`'=cmd()`)
  })

  it('leaves a negative number a number', async () => {
    expect((await csv(-5)).trim().split(/\r?\n/).pop()).toBe('-5')
  })

  it('leaves a date and a boolean as they are', async () => {
    expect((await csv(true)).trim().split(/\r?\n/).pop()).toBe('true')
  })

  it('an opt-out still writes the value as it is', async () => {
    expect(await csv(['=1+1', 'b'], false)).toContain('"=1+1,b"')
  })
})
