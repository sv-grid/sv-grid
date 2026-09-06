/**
 * Builds everything the package publishes:
 *
 *   dist/sv-grid-element.js          <sv-grid>          (light DOM)
 *   dist/shadow/...-shadow-...js     <sv-grid-shadow>   (open shadow root)
 *   dist/react/index.js              React wrapper
 *   dist/vue/index.js                Vue wrapper
 *   dist/angular/                    Angular wrapper (ng-packagr, partial Ivy)
 *   dist/*.d.ts                      element types, generated from the surface
 *
 * A node script rather than shell chaining in the npm script, because the
 * element passes need an env var to select which element to build and that
 * syntax is not portable to a Windows shell.
 *
 * Order matters. The elements build first because everything else resolves
 * `@svgrid/grid-wc` through this package's own `exports` map, which points at
 * `dist/`. Angular builds last and is the only step that needs a compiler
 * beyond vite.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const cwd = join(here, '..')
const repo = join(cwd, '..', '..')
const vite = join(repo, 'node_modules', 'vite', 'bin', 'vite.js')
const ngPackagr = join(cwd, 'node_modules', 'ng-packagr', 'src', 'cli', 'main.js')

function run(label, args, env = {}) {
  const r = spawnSync(process.execPath, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  if (r.status !== 0) {
    console.error(`grid-wc: build failed for ${label}`)
    process.exit(r.status ?? 1)
  }
}

// 1. The two custom elements, one build each.
//
// Not two entries in ONE build, which is the obvious way and was measured and
// rejected: sharing a build makes rollup hoist the code both entries touch into
// a common eager chunk, and <sv-grid>'s initial payload went 102.5 -> 133.1 KiB
// gzip. Separate builds duplicate the lazy chunks on disk instead, which costs
// bytes in the tarball and nothing at runtime, because a page loads one element
// or the other.
for (const shadow of ['0', '1']) {
  run(shadow === '1' ? '<sv-grid-shadow>' : '<sv-grid>', [vite, 'build'], {
    SVGRID_WC_SHADOW: shadow,
  })
}

// 2. Element type declarations, beside each entry so the `exports` map can
//    point `types` at them. Without these the package shipped no types at all:
//    `import '@svgrid/grid-wc'` was an error under `moduleResolution: bundler`,
//    and `document.querySelector('sv-grid')` came back as a bare `Element`.
const types = readFileSync(join(cwd, 'src', 'types', 'elements.d.ts'), 'utf8')
mkdirSync(join(cwd, 'dist', 'shadow'), { recursive: true })
writeFileSync(join(cwd, 'dist', 'sv-grid-element.d.ts'), types)
writeFileSync(join(cwd, 'dist', 'shadow', 'sv-grid-shadow-element.d.ts'), types)

// 3. The React and Vue wrappers. They externalise everything, including
//    `@svgrid/grid-wc` itself, so a wrapper is a couple of KB that reuses the
//    one element bundle rather than shipping a second copy of the grid.
for (const target of ['react', 'vue']) {
  run(`${target} wrapper`, [vite, 'build', '--config', 'vite.wrappers.config.js'], {
    SVGRID_WRAPPER: target,
  })
}

// 3b. Declarations for the React and Vue wrappers. Vite lib mode emits none,
//     and the exports map promises `types` for both - a subpath whose types
//     point at a missing file resolves to `any` with no error at all, which is
//     worse than shipping no types.
run('wrapper declarations', [
  join(repo, 'node_modules', 'typescript', 'bin', 'tsc'),
  '-p',
  'tsconfig.wrappers.json',
])

// 4. Angular, via ng-packagr. It needs Angular's partial-Ivy compilation -
//    plain tsc output makes consumers hit "component is not compiled".
if (existsSync(ngPackagr)) {
  run('angular wrapper', [
    ngPackagr,
    '-p',
    join('src', 'angular', 'ng-package.json'),
    '-c',
    'tsconfig.angular.json',
  ])
} else {
  console.error('grid-wc: ng-packagr is missing - run pnpm install')
  process.exit(1)
}

console.log('grid-wc: built 2 elements, 3 wrappers, and element type declarations')
