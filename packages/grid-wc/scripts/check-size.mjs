/**
 * Size budget for the two custom elements, measured on the BUILT bundles.
 *
 * Separate from `packages/grid/scripts/measure-size.mjs` because that script
 * bundles from source with its own vite config, and a custom element only
 * exists when compiled with `customElement: true`. Measuring the real dist is
 * both simpler and closer to what a consumer downloads.
 *
 * Until this file existed grid-wc had no budget at all - which is part of why
 * nobody noticed the elements exposed 7 of 100 props, and why nobody would have
 * noticed them getting heavy either.
 *
 * KiB (1024), not vite's kB (1000). The two differ by ~2.4% at this size, which
 * is enough to look like a regression that is not there - it did once.
 */
import { gzipSync } from 'node:zlib'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, '..', 'dist')

/**
 * Entry-file gzip, in KiB. The entry is what a `<script type="module" src>`
 * pulls first; its lazy chunks load on demand and are deliberately not counted.
 *
 * 102.5 -> 106.0 when the surface became generated. The elements went from 7
 * props and 2 events to 98 and 19, so grouping, pagination, pinning, tree data,
 * master/detail, board, scheduler and the enterprise features became reachable
 * from a non-Svelte host at all. Measured 102.5 -> 104.1 KiB, so 1.6 KiB for
 * roughly fourteen times the API. The budget kept ~2 KiB of headroom, which was
 * about one more feature's worth of props.
 *
 * 106.0 -> 107.1 and 106.5 -> 107.3, and the headroom is now 0.3 KiB rather
 * than 2. None of the growth is in the element layer: it is the grid's own base
 * bundle, +0.8 KiB for the `icons` prop and the chart panel's type picker
 * (measured 84.4 KB against 83.6 before, see the note in
 * packages/grid/scripts/measure-size.mjs). An element inlines the grid, so any
 * grid base change lands here at roughly 1:1.
 *
 * The cushion is gone on purpose. It was sized for a layer that only moved when
 * someone touched the element surface, and it silently absorbed grid-side growth
 * instead. Tracking the measurement closely means a grid base increase now has to
 * be acknowledged in both budgets, which is two edits and the intended cost: this
 * file is the only thing that measures what a non-Svelte consumer actually
 * downloads, and 2 KiB is a lot of room to grow into unnoticed.
 *
 * 107.1 -> 107.5 and 107.3 -> 107.8. Measured 107.2 / 107.5, so +0.4 for a wave
 * of charting work, and this is the two-edit cost that note above predicted -
 * the growth is the grid's base, reaching the element at 1:1.
 *
 * What landed in base: locale-aware value formatting wired through the
 * controller and the chart-view config (a chart of localized data now reads in
 * that locale without being told twice), and the base half of box plots and
 * error bars. What did NOT land here is the interesting part - the chart engine
 * is a separate chunk (`SvGridChart-*.js`), so box plots, candlesticks, the
 * custom-series seam, interactive annotations and the large-series work cost a
 * `<sv-grid>` consumer nothing unless they chart. That chunk grew 27.6 -> 31.9
 * KB over the same period, all of it deferred.
 */
const BUDGET_KIB = {
  '<sv-grid>': { file: join(dist, 'sv-grid-element.js'), budget: 107.5 },
  '<sv-grid-shadow>': { file: join(dist, 'shadow', 'sv-grid-shadow-element.js'), budget: 107.8 },
}

const failures = []
for (const [label, { file, budget }] of Object.entries(BUDGET_KIB)) {
  if (!existsSync(file)) {
    console.error(`check-size: ${file} is missing - run the build first.`)
    process.exit(1)
  }
  const gz = gzipSync(readFileSync(file)).length / 1024
  const over = gz > budget
  console.log(
    `=> ${label.padEnd(18)} entry gzip ${gz.toFixed(1)} KiB (budget ${budget} KiB${over ? ' - OVER' : ''})`,
  )
  if (over) failures.push(`${label}: ${gz.toFixed(1)} KiB exceeds ${budget} KiB`)
}

if (failures.length) {
  console.error('\nSize budget exceeded:')
  for (const f of failures) console.error(`  - ${f}`)
  console.error(
    '\nRaise the budget only with a note saying what was added and what it\n' +
      'bought, in the style of the comment above. Never ratchet it silently.',
  )
  process.exit(1)
}
