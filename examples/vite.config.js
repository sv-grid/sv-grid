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
      // Live-edit the grid package: alias to src/ so HMR fires on changes
      // without needing `pnpm --filter ./packages/grid build`.
      '@svgrid/grid': path.resolve(repoRoot, 'packages/grid/src/index.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['@svgrid/grid'],
  },
  server: { port: 5174, fs: { allow: [repoRoot] } },
})
