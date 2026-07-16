import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import rollupReplace from '@rollup/plugin-replace'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

export default defineConfig({
  plugins: [
    rollupReplace({
      preventAssignment: true,
      values: {
        __DEV__: JSON.stringify(true),
        'process.env.NODE_ENV': JSON.stringify('development'),
      },
    }),
    svelte(),
  ],
  resolve: {
    alias: {
      // Live-edit the grid + enterprise packages: alias to src/ so HMR fires on
      // changes without needing a `build` of the package. Every demo imports the
      // bare `@svgrid/enterprise` main entry (no subpath imports), so aliasing
      // the entry point is safe and keeps a single module instance.
      // The Svelte-free `/format` subpath (used by @svgrid/enterprise's export
      // code). Must precede the bare alias below so it wins for this specifier.
      '@svgrid/grid/format': path.resolve(repoRoot, 'packages/grid/src/export-format.ts'),
      '@svgrid/grid': path.resolve(repoRoot, 'packages/grid/src/index.ts'),
      // Studio subpath (Svelte-free core) - must precede the bare alias below.
      '@svgrid/enterprise/studio': path.resolve(repoRoot, 'packages/enterprise/src/studio/index.ts'),
      // Private: visual designer components (only used by git-ignored demos).
      '@svgrid/enterprise': path.resolve(repoRoot, 'packages/enterprise/src/index.ts'),
    },
  },
  optimizeDeps: {
    // PGlite ships WASM + a worker; excluding it lets Vite serve it as-is
    // (the 193-studio-live-sql demo runs Postgres in the browser).
    exclude: ['@svgrid/grid', '@svgrid/enterprise', '@electric-sql/pglite'],
  },
  server: { port: 5174, fs: { allow: [repoRoot] } },
})
