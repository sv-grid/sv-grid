import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * `import '@svgrid/enterprise/wc'` exists only for its side effect: defining
 * `<sv-sheet>`. With `sideEffects` listing CSS alone, every bundler is allowed
 * to drop that import, and in production builds they did: the chunk came out at
 * 256 bytes, the element never registered, and the React and Vue wrappers
 * (which register it the same way) rendered nothing.
 */
describe('the custom-element entry survives tree-shaking', () => {
  const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
    name: string
    sideEffects: string[]
    exports: Record<string, { import?: string }>
  }

  it('lists the ./wc export target in sideEffects', () => {
    expect(pkg.name).toBe('@svgrid/enterprise')
    const target = pkg.exports['./wc']?.import
    expect(target).toBeTruthy()
    expect(pkg.sideEffects).toContain(target)
  })
})
