#!/usr/bin/env node
// Copies the canonical, forkable starter from the monorepo
// (templates/sveltekit-admin-dashboard) into this package's bundled
// templates/admin-dashboard so the published `@svgrid/create` is
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
const SRC = join(__dirname, '..', '..', 'templates', 'sveltekit-admin-dashboard')
const DEST = join(__dirname, 'templates', 'admin-dashboard')

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

async function main() {
  if (!existsSync(SRC)) {
    console.error(`[sync-templates] source not found: ${SRC}`)
    process.exit(1)
  }
  await rm(DEST, { recursive: true, force: true })
  await mkdir(DEST, { recursive: true })
  // Skip build artifacts / installed deps from the source tree.
  await cp(SRC, DEST, {
    recursive: true,
    filter: (src) =>
      !/[\\/](node_modules|\.svelte-kit|\.vercel|build|dist)([\\/]|$)/.test(src),
  })
  await renameDotfiles(DEST)
  console.log(`[sync-templates] admin-dashboard synced -> ${DEST}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
