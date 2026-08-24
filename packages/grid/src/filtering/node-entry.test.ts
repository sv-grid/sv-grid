import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * `@svgrid/grid/filtering` is one of the few entry points consumed by RAW NODE
 * rather than by a bundler: @svgrid/enterprise's Studio bundle keeps
 * `@svgrid/grid` external, so the published dist is imported by Node's own ESM
 * resolver at runtime.
 *
 * Node ESM does not guess extensions. The rest of the package can use
 * extensionless relative imports because a bundler resolves them; anything
 * reachable from this entry cannot. `import './x'` works in Vite and throws
 * ERR_MODULE_NOT_FOUND under Node.
 *
 * This was not hypothetical. Splitting the operator catalogue out of
 * `excel-filters.ts` gave that file its first relative import and broke every
 * generated Studio app at startup. Only `pnpm verify:app` caught it, after the
 * change was committed.
 *
 * The rule enforced here is deliberately blunt - EVERY relative specifier in
 * this folder ends in `.js`, type-only ones included. Type imports are erased
 * and would be safe either way, but exempting them means parsing TypeScript to
 * decide which is which, and a subtle parser in a guard test is how the guard
 * silently stops guarding. TypeScript resolves `./excel-filters.js` to
 * `excel-filters.ts` regardless, so the strict rule costs nothing.
 */

const DIR = import.meta.dirname

/** Every relative module specifier in the file, however it is imported. */
function relativeSpecifiers(source: string): string[] {
  const out: string[] = []
  // Covers `from './x'`, bare `import './x'`, and dynamic `import('./x')`.
  const re = /(?:from|import)\s*\(?\s*['"](\.[^'"]*)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) out.push(m[1]!)
  return out
}

const files = readdirSync(DIR).filter(
  (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
)

describe('the /filtering entry stays resolvable by raw Node', () => {
  it('finds the source files to check', () => {
    // Guards against the directory read silently matching nothing, which would
    // turn every case below into a vacuous pass.
    expect(files.length).toBeGreaterThan(0)
    expect(files).toContain('excel-filters.ts')
  })

  it.each(files)('%s gives every relative import a .js extension', (file) => {
    const offenders = relativeSpecifiers(readFileSync(join(DIR, file), 'utf8')).filter(
      (spec) => !spec.endsWith('.js'),
    )
    expect(
      offenders,
      `${file} imports ${offenders.join(', ')} without a .js extension. ` +
        'Node cannot resolve that in the published dist, which breaks every ' +
        'generated Studio app at startup. Add .js to the specifier.',
    ).toEqual([])
  })

  it('detects a missing extension', () => {
    // The guard has to be able to fail. Without this the regex could stop
    // matching and every case above would pass for the wrong reason.
    expect(relativeSpecifiers(`export { a } from './some-module'`)).toEqual([
      './some-module',
    ])
    expect(relativeSpecifiers(`import './side-effect'`)).toEqual(['./side-effect'])
    expect(relativeSpecifiers(`const m = await import('./lazy')`)).toEqual(['./lazy'])
    expect(relativeSpecifiers(`import { a } from './ok.js'`)).toEqual(['./ok.js'])
  })
})
