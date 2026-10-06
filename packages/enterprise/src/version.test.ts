import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SVGRID_VERSION, GRID_VERSION } from './version'

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

  it('GRID_VERSION matches @svgrid/grid, which releases on its own line', () => {
    // A scaffolded app depends on both packages. Pinning the grid to THIS
    // package's version asked for `@svgrid/grid@^3.1.1`, which was never
    // published, so `npm install` failed on every app `svgrid-studio init`
    // wrote. Enterprise is on 3.1.x and the grid on 3.0.x; they are not
    // interchangeable.
    const grid = JSON.parse(
      readFileSync(resolve(process.cwd(), '..', 'grid', 'package.json'), 'utf8'),
    ) as { name: string; version: string }
    expect(grid.name).toBe('@svgrid/grid')
    expect(GRID_VERSION).toBe(grid.version)
  })
})
