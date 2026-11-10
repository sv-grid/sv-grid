#!/usr/bin/env node
// Copies the canonical, forkable starters from the monorepo (templates/) into
// this package's bundled templates/ so the published `@svgrid/create` is
// self-contained. Runs automatically on `prepack` (before publish).
//
// Dotfiles and package.json are stored `_`-prefixed inside the package because
// npm refuses to publish a literal `.gitignore` and mangles a few others. The
// CLI renames them back when it scaffolds.

import { cp, mkdir, rename, rm, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// [folder in the monorepo's templates/, name in this package's templates/]
const SOURCES = [
  ['sveltekit-admin-dashboard', 'admin-dashboard'],
  ['sveltekit-saas-starter', 'saas'],
]

// Never shipped: installs, build output, and what a local run leaves behind.
// `.env` holds a real secret once `npm run dev` has run, and `.data` is the
// local database; `.env.example` is the one that ships. Tested against the
// path relative to the source root, so a checkout under `.../build/...`
// doesn't skip everything.
const SKIP = /(^|[\\/])(node_modules|\.svelte-kit|\.vercel|build|dist|\.data|\.env|test-results|playwright-report)([\\/]|$)/

// Names that must be `_`-prefixed in the package so npm ships them intact.
const RENAME_ON_COPY = new Map([
  ['.gitignore', '_gitignore'],
  ['.npmrc', '_npmrc'],
  ['.env.example', '_env.example'],
  ['package.json', '_package.json'],
])

async function renameDotfiles(dir) {
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry)
    if ((await stat(full)).isDirectory()) {
      await renameDotfiles(full)
    } else if (RENAME_ON_COPY.has(entry)) {
      await rename(full, join(dir, RENAME_ON_COPY.get(entry)))
    }
  }
}

async function sync(from, name) {
  const src = join(__dirname, '..', '..', 'templates', from)
  const dest = join(__dirname, 'templates', name)
  if (!existsSync(src)) {
    console.error(`[sync-templates] source not found: ${src}`)
    process.exit(1)
  }
  await rm(dest, { recursive: true, force: true })
  await mkdir(dest, { recursive: true })
  await cp(src, dest, { recursive: true, filter: (p) => !SKIP.test(p.slice(src.length)) })
  await renameDotfiles(dest)
  console.log(`[sync-templates] ${name} synced -> ${dest}`)
}

async function main() {
  for (const [from, name] of SOURCES) await sync(from, name)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
