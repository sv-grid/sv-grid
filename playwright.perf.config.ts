import { defineConfig, devices } from '@playwright/test'

/**
 * The perf specs alone, with no web servers.
 *
 * playwright.config.ts starts the website, the web-component builds and the
 * gallery before any test, whichever project runs. For a measurement that
 * costs twice: a slow start fails the run (the 120 s webServer timeout) and
 * the builds load the machine while it measures. The comparison specs take
 * the harness URL from SVGRID_BENCH_PORT, so start the server yourself:
 *
 *   cd examples && npx vite build --config vite.bench.config.js && npx vite preview --config vite.bench.config.js
 *   SVGRID_BENCH_PORT=4190 npx playwright test -c playwright.perf.config.ts tests/perf/compare.spec.ts
 */
export default defineConfig({
  testDir: 'tests/perf',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    ...devices['Desktop Chrome'],
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
})
