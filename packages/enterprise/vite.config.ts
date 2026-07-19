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
        plugins: [svelte({ compilerOptions: { dev: false } })],
        resolve: { conditions: ['browser'] },
        test: {
          name: 'dom',
          dir: './',
          include: ['src/**/*.dom.test.ts'],
          environment: 'jsdom',
          globals: true,
        },
      },
    ],
  },
})
