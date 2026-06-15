#!/usr/bin/env node
/**
 * Capture real screenshots of the live demos for use in blog posts. Runs
 * against the dev server (vite on :5180), grabs the grid element on each demo
 * page at 2x for crisp images, and writes PNGs into website/public/blog-media/
 * so they are served at /blog-media/<name>.png and committed as real assets.
 *
 * Usage: with the dev server running, `node tools/blog-screenshots.mjs`
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'website', 'public', 'blog-media')
const BASE = process.env.SHOT_BASE ?? 'http://localhost:5180'

// demo id -> output name (used in blog posts as /blog-media/<name>.png)
const SHOTS = [
  ['31-lazy-tree-load', 'lazy-tree'],
  ['09-server-side', 'server-side-2'],
  ['64-filter-between-operator', 'filter-between'],
]

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 })

let ok = 0
for (const [id, name] of SHOTS) {
  try {
    await page.goto(`${BASE}/demos/${id}`, { waitUntil: 'load', timeout: 30000 })
    const grid = page.locator('[role="grid"]').first()
    await grid.waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(1400) // let data render and any intro animation settle
    await grid.screenshot({ path: join(OUT, `${name}.png`) })
    ok += 1
    process.stdout.write(`shot ${name} (from ${id})\n`)
  } catch (e) {
    process.stdout.write(`skip ${id}: ${String(e.message).split('\n')[0]}\n`)
  }
}

await browser.close()
process.stdout.write(`\n${ok}/${SHOTS.length} screenshots written to website/public/blog-media/\n`)
