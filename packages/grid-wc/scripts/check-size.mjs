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
 * roughly fourteen times the API. The budget keeps ~2 KiB of headroom, which is
 * about one more feature's worth of props.
 */
const BUDGET_KIB = {
  '<sv-grid>': { file: join(dist, 'sv-grid-element.js'), budget: 106.0 },
  '<sv-grid-shadow>': { file: join(dist, 'shadow', 'sv-grid-shadow-element.js'), budget: 106.5 },
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
