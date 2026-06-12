import { defineConfig } from 'vitest/config'

// Tests load the BUILT bundle (dist/sv-grid-element.js), so they validate the
// real published artifact, not the source. Run `pnpm build` first.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
})
