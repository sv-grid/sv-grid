/**
 * Build the Studio visual designer SPA into `dist/designer/`.
 *
 * The `@svgrid/studio designer` and `... dev` CLI commands serve this static
 * bundle: they resolve `@svgrid/enterprise/package.json` and look for
 * `dist/designer/index.html` next to it (see packages/studio/src/designer-server.ts).
 * So the bundle has to be built here and listed in this package's "files".
 *
 * The designer *sources* live in the private website submodule
 * (website/designer-app + website/src/lib/designer) - the public repo keeps only
 * the Studio codegen. When that submodule isn't checked out there is nothing to
 * build, so this exits 0 with a note instead of failing: a public contributor
 * running `pnpm build` should not hit an error for a private artifact. The
 * release path must therefore run with the submodule present - `pnpm pack`
 * prints a warning below if the bundle is missing.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..')
const designerApp = join(repoRoot, 'website', 'designer-app')
const config = join(designerApp, 'vite.config.ts')

if (!existsSync(config)) {
  console.log('build-designer: skipped (website/designer-app not checked out - private submodule)')
  process.exit(0)
}

// Run from the website workspace so its own devDependencies (svelte plugin,
// codemirror, typescript) resolve. The config pins root + outDir absolutely.
const r = spawnSync('pnpm', ['exec', 'vite', 'build', '--config', 'designer-app/vite.config.ts'], {
  cwd: join(repoRoot, 'website'),
  stdio: 'inherit',
  shell: true,
})

if (r.status !== 0) {
  console.error('build-designer: FAILED - `svgrid-studio designer` would ship broken.')
  process.exit(r.status || 1)
}

const out = join(here, '..', 'dist', 'designer', 'index.html')
console.log(existsSync(out) ? 'build-designer: dist/designer ready' : 'build-designer: WARNING - no index.html emitted')
