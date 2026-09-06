/**
 * Builds the React and Vue fixture apps that tests/e2e/wc-wrappers.spec.ts
 * drives.
 *
 * Real apps built by vite against the BUILT wrappers, not jsdom: the thing
 * under test is how each framework hands an object prop to a custom element,
 * and jsdom has no custom-element upgrade timing to get wrong. This is what
 * caught the element throwing when it renders before `columns` is assigned -
 * the exact order React and Angular produce.
 *
 * `--base ./` because they are served from a subdirectory; absolute asset
 * paths 404 there, silently, with an empty page and no error in the console
 * except the missing script.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const cwd = join(here, '..')
const vite = join(cwd, '..', '..', 'node_modules', 'vite', 'bin', 'vite.js')

for (const app of ['react', 'vue']) {
  const r = spawnSync(
    process.execPath,
    [vite, 'build', `test/apps/${app}`, '--base', './', '--outDir', `../../../dist-test/${app}`, '--emptyOutDir'],
    { cwd, stdio: 'inherit' },
  )
  if (r.status !== 0) {
    console.error(`grid-wc: fixture build failed for ${app}`)
    process.exit(r.status ?? 1)
  }
}
console.log('grid-wc: built the react + vue fixture apps')
