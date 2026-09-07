import { describe, expect, it } from 'vitest'
import { execSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * A published package's executable entry point must actually load.
 *
 * `files` in package.json is an allow-list, so adding a module and forgetting
 * to list it produces a package that is fine in the repo, fine in CI, and fine
 * in every test - and dead on arrival for anyone who installs it. Nothing in
 * the normal build notices, because the repo always has the file.
 *
 * `@svgrid/migrate@0.2.0` shipped exactly that. `index.mjs` is the bin, it
 * imports `./tanstack.mjs`, and `files` listed index/transform/scan but not
 * tanstack, so `npx @svgrid/migrate` died on ERR_MODULE_NOT_FOUND for every
 * user - on the one version whose entire reason for existing was that file.
 * Publishing it and running it was the only thing that found out.
 *
 * This LOADS the entry from a real tarball rather than scanning it. Two earlier
 * attempts regexed the source for relative imports and both drowned in false
 * positives, because the things this repo publishes are full of import
 * statements that are data, not code: JSDoc examples in grid, the code Studio's
 * `emit-project` generates, the doc and example corpus compiled into the MCP
 * server. Nothing short of a parser can tell those apart - but Node resolves
 * the real module graph at LINK time, before a single statement executes, so
 * loading the entry answers the question exactly and answers it for free.
 *
 * Scope is the packages whose entry is plain JS. The Svelte libraries cannot be
 * imported by bare Node at all; their equivalent proof is scaffolding an app
 * against the published tarball and building it.
 */
const PKGS = ['mcp', 'create-sv-grid', 'create-studio', 'migrate']

/** Files named by `bin`, plus `main` - where a consumer's process comes in. */
function binEntries(pkgDir: string): string[] {
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  const out: string[] = []
  const take = (v: unknown) => {
    if (typeof v === 'string') out.push(v)
    else if (v && typeof v === 'object')
      for (const nested of Object.values(v as Record<string, unknown>)) take(nested)
  }
  take(pkg.bin)
  take(pkg.main)
  // `bin` is commonly bare ("index.mjs"), `main` often "./dist/index.js". Both
  // are relative to the package root.
  return [...new Set(out)]
    .filter((p) => !p.includes('*'))
    .map((p) => resolve(pkgDir, p))
    .filter((p) => existsSync(p) && statSync(p).isFile() && /\.(m?js|cjs)$/.test(p))
}

describe('published CLIs load every module they import', () => {
  for (const dir of PKGS) {
    it(
      `${dir}`,
      () => {
        const root = resolve('packages', dir)
        const tmp = mkdtempSync(join(tmpdir(), `svgrid-load-${dir}-`))
        try {
          // `pnpm pack` runs the same prepack hook `pnpm publish` does, so this
          // is the tarball a consumer would receive.
          execSync(`pnpm pack --pack-destination "${tmp}"`, { cwd: root, stdio: 'pipe' })
          const tgz = readdirSync(tmp).find((f) => f.endsWith('.tgz'))!
          // cwd + bare filename: Git Bash tar reads a `C:\...` argument as a
          // remote host spec and tries to open a network connection.
          execSync(`tar -xzf "${tgz}"`, { cwd: tmp, stdio: 'pipe' })

          const pkgDir = join(tmp, 'package')
          const entries = binEntries(pkgDir)
          expect(entries.length, `${dir}: no JS entry point inside the tarball`).toBeGreaterThan(0)

          for (const entry of entries) {
            // `--help` and a closed stdin so a CLI prints and exits rather than
            // waiting for input. What matters is only whether the module graph
            // linked: a CLI that runs, prompts, or exits non-zero has already
            // proved every import resolved.
            const r = spawnSync(process.execPath, [entry, '--help'], {
              encoding: 'utf8',
              timeout: 30_000,
              input: '',
              cwd: tmp,
            })
            const output = `${r.stdout ?? ''}${r.stderr ?? ''}`

            // Only the package's OWN files count. The tarball is extracted with
            // no node_modules beside it, so every external dependency is also
            // unresolvable - and Node words the two differently: "Cannot find
            // package '<bare name>'" for a dependency, "Cannot find module
            // '<absolute path>'" for a relative import. Failing on both would
            // make this fire for every package that has dependencies at all.
            const ownMissing = [...output.matchAll(/Cannot find module '([^']+)'/g)]
              .map((m) => m[1]!)
              .filter((p) => p.startsWith(pkgDir))

            expect(
              ownMissing,
              `${dir}: ${entry.slice(pkgDir.length)} imports a file the tarball does not ` +
                `contain - add it to "files" in package.json`,
            ).toEqual([])
          }
        } finally {
          rmSync(tmp, { recursive: true, force: true })
        }
      },
      180_000,
    )
  }
})
