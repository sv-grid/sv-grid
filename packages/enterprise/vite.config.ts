import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import packageJson from './package.json'

// Two projects so the svelte plugin is scoped to the DOM (`*.dom.test.ts`) tests
// only. Loading it for the whole suite would compile every grid-dist .svelte on
// demand, ballooning transform time and timing out the compile-heavy verify/cli
// tests. The unit project stays plugin-free (fast); the dom project mounts
// components in jsdom (svelte's `browser` condition -> client `mount()`).
export default defineConfig({
  test: {
    name: packageJson.name,
    watch: false,
    projects: [
      {
        test: {
          name: 'unit',
          dir: './',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.dom.test.ts', '**/node_modules/**'],
          environment: 'jsdom',
          globals: true,
        },
      },
      {
        plugins: [svelte({
          compilerOptions: { dev: false },
          // The <sv-sheet> wrapper compiles as a custom element; the
          // components inside it compile as the ordinary components they are.
          dynamicCompileOptions({ filename }) {
            if (filename.endsWith('sv-sheet-element.svelte')) return { customElement: true }
          },
        })],
        resolve: { conditions: ['browser'] },
        test: {
          name: 'dom',
          dir: './',
          include: ['src/**/*.dom.test.ts'],
          environment: 'jsdom',
          globals: true,
          // jsdom's gaps (ResizeObserver, IntersectionObserver, scrollIntoView,
          // the animations API) - the same stubs the grid's own suite mounts
          // with, so a test here can mount <SvGrid> too. Tests that stubbed
          // one inline before this keep working: every stub is guarded.
          setupFiles: ['../grid/src/test-setup.ts'],
        },
      },
    ],
  },
})
