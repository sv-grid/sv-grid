import { defineConfig } from 'vitest/config'
import packageJson from './package.json'

export default defineConfig({
  test: {
    name: packageJson.name,
    dir: './',
    include: ['src/**/*.test.ts'],
    watch: false,
    environment: 'jsdom',
    globals: true,
  },
})
