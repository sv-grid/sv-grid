import { test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderGridExports } from './scripts/generate-grid-exports.mjs'

// The codemod drops TanStack import names @svgrid/grid does not export, judged
// against a list generated from the grid's source index. Stale, it would either
// keep a name that no longer resolves or drop one that does.
test('grid-exports.generated.mjs matches packages/grid/src/index.ts', () => {
  const onDisk = readFileSync(new URL('./grid-exports.generated.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  expect(onDisk, 'run node packages/migrate/scripts/generate-grid-exports.mjs').toBe(renderGridExports())
})
