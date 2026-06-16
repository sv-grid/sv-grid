#!/usr/bin/env node
/**
 * Capture real screenshots of the live demos for use in blog posts. Runs
 * against the dev server (vite on :5180), grabs the grid on each demo page, and
 * writes PNGs into website/public/blog-media/ (served at /blog-media/<name>.png,
 * committed as real assets).
 *
 * Screenshots are clipped to the grid and capped at 800px tall so they stay a
 * sensible size in a blog post (and so tall/virtualized grids capture cleanly).
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
const MAX_H = 800 // hard cap on screenshot height (px)

// demo id -> output name (used in blog posts as /blog-media/<name>.png)
const SHOTS = [
  ['01-quick-start', 'quick-start'],
  ['02-sort-filter-paginate', 'sorting'],
  ['03-excel-filters', 'excel-filters'],
  ['05-inline-editing', 'inline-editing'],
  ['06-large-dataset', 'large-dataset'],
  ['07-grouping-aggregation', 'grouping'],
  ['08-tree-and-master-detail', 'tree-master-detail'],
  ['11-stock-market', 'stock-market'],
  ['52-pivot-table', 'pivot'],
  ['10-custom-cells-and-themes', 'custom-cells-themes'],
  ['04-selection-copy-paste', 'selection'],
  ['09-server-side', 'server-side'],
  ['09-server-side', 'server-side-2'],
  ['49-admin-dashboard', 'admin-dashboard'],
  ['118-live-dashboard', 'live-dashboard'],
  ['66-custom-cell-editors', 'custom-cell-editors'],
  ['118-range-selection', 'range-selection'],
  ['94-conditional-formatting', 'conditional-formatting'],
  ['116-websocket-live-updates', 'websocket-live'],
  ['29-wbs-project-tree', 'wbs-tree'],
  ['20-industrial-dashboard', 'industrial-dashboard'],
  ['90-selection-api', 'selection-api'],
  ['110-locale-aware-filter', 'locale-filter'],
  ['96-high-contrast-theme', 'high-contrast'],
  ['74-theme-integrations', 'theme-integrations'],
  ['40-forms-master-detail', 'forms-master-detail'],
  ['25-column-pinning', 'column-pinning'],
  ['104-column-reorder', 'column-reorder'],
  ['95-fill-handle', 'fill-handle'],
  ['67-context-menu', 'context-menu'],
  ['85-tooltips-and-notes', 'tooltips'],
  ['105-row-reorder', 'row-reorder'],
  ['115-optimistic-updates', 'optimistic-updates'],
  ['34-realtime-orders', 'realtime-orders'],
  ['17-accessibility', 'accessibility'],
  ['48-crm-sales-pipeline', 'crm'],
  ['46-scheduler', 'scheduler'],
  ['21-export-and-print', 'export'],
  ['27-spreadsheet-ribbon', 'spreadsheet'],
  ['54-columns-hierarchy', 'columns-hierarchy'],
  ['63-column-layout-api', 'column-layout'],
  ['111-set-filter-advanced', 'set-filter'],
  ['148-server-row-model', 'server-row-model'],
  ['100-anomaly-highlights', 'anomaly'],
  ['112-barcode-cells', 'barcode'],
  ['31-lazy-tree-load', 'lazy-tree'],
  ['28-org-chart-tree', 'org-chart'],
]

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch()
// deviceScaleFactor 1 + a generous viewport so the 800px clip is honoured exactly.
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 })

let ok = 0
for (const [id, name] of SHOTS) {
  try {
    await page.goto(`${BASE}/demos/${id}`, { waitUntil: 'load', timeout: 30000 })
    const grid = page.locator('[role="grid"]').first()
    await grid.waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(1400) // let data render and any intro animation settle
    const box = await grid.boundingBox()
    if (!box) throw new Error('no bounding box')
    const x = Math.max(0, Math.floor(box.x))
    const y = Math.max(0, Math.floor(box.y))
    const clip = {
      x,
      y,
      width: Math.min(Math.ceil(box.width), 1280 - x),
      height: Math.min(Math.ceil(box.height), MAX_H, 1000 - y),
    }
    await page.screenshot({ path: join(OUT, `${name}.png`), clip })
    ok += 1
    process.stdout.write(`shot ${name} (${id}) ${clip.width}x${clip.height}\n`)
  } catch (e) {
    process.stdout.write(`skip ${id}: ${String(e.message).split('\n')[0]}\n`)
  }
}

await browser.close()
process.stdout.write(`\n${ok}/${SHOTS.length} screenshots written (max height ${MAX_H}px)\n`)
