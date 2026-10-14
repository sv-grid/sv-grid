#!/usr/bin/env node
/**
 * Exports each SvGrid Base template demo as Postgres SQL, through the base's
 * own "Download as SQL" (baseToSql), into the `base` template of
 * `npm create @svgrid`, where the wizard offers them as the tables to start
 * with: packages/create-sv-grid/templates/base/db/templates/<name>.sql.
 *
 *   pnpm dev                                  # the gallery on :5174
 *   node tools/base-template-sql.mjs          # or: SVGRID_GALLERY=http://localhost:5174
 *
 * Run it again after changing a template demo. Dates come out relative to
 * the day it runs (`current_date + 3`), so the samples stay current.
 */
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(root, 'packages', 'create-sv-grid', 'templates', 'base', 'db', 'templates')
const GALLERY = process.env.SVGRID_GALLERY ?? 'http://localhost:5174'

/** Wizard name -> gallery demo. Keep in step with BASE_SAMPLES in packages/create-sv-grid/index.mjs. */
export const BASE_TEMPLATES = {
  'project-tracker': '504-project-tracker',
  'content-calendar': '511-base-content-calendar',
  'sales-crm': '512-base-sales-crm',
  'product-roadmap': '513-base-product-roadmap',
  'hiring-tracker': '514-base-hiring-tracker',
  inventory: '515-base-inventory',
  'bug-tracker': '520-base-bug-tracker',
  'event-planning': '521-base-event-planning',
  okrs: '522-base-okrs',
  expenses: '523-base-expenses',
  onboarding: '524-base-onboarding',
}

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
try {
  for (const [name, demo] of Object.entries(BASE_TEMPLATES)) {
    const page = await browser.newPage({ acceptDownloads: true })
    await page.goto(`${GALLERY}/#/${demo}`)
    await page.locator('.sv-btabs').waitFor({ timeout: 120_000 })
    await page.waitForTimeout(800)
    await page.evaluate(() => document.querySelectorAll('[data-svgrid-enterprise-upgrade], vite-error-overlay').forEach((n) => n.remove()))
    await page.locator('.sv-btabs-tools button[aria-label="All tables"]').click()
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Download as SQL' }).click()])
    const file = join(OUT, `${name}.sql`)
    await download.saveAs(file)
    // A first line naming the template, in place of the generic one.
    const sql = readFileSync(file, 'utf8').replace(/^-- .*\n/, (line) => line.replace(/^-- [^,]+(, [^,]+)*, as Postgres tables\./, `-- The ${name.replace(/-/g, ' ')} template, as Postgres tables.`))
    writeFileSync(file, sql)
    console.log(`${name}: ${Math.round(sql.length / 1024)} KB`)
    await page.close()
  }
} finally {
  await browser.close()
}
