import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// Vite 7 on purpose. Bolt and StackBlitz run the dev server in a WebContainer,
// which cannot load Vite 8's native Rolldown bundler, so `npm install` fails
// on a missing rolldown binding. Keep vite on ^7 and
// @sveltejs/vite-plugin-svelte on ^6 until WebContainers support Rolldown.
export default defineConfig({
  plugins: [svelte()],
})
