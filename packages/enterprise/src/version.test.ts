import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SVGRID_VERSION } from './version'

describe('SVGRID_VERSION', () => {
  it('matches package.json, so generated apps pin a version that exists', () => {
    // Generated apps depend on `^SVGRID_VERSION`. If this drifts below the real
    // version, every scaffolded app asks for a runtime older than the generator
    // and can miss features the emitted code uses.
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as { name: string; version: string }
    // Guard the guard: if the runner's cwd ever moves, fail loudly here rather
    // than quietly comparing against some other package's version.
    expect(pkg.name).toBe('@svgrid/enterprise')
    expect(SVGRID_VERSION).toBe(pkg.version)
  })
})
