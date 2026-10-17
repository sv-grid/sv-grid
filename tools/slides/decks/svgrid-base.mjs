/**
 * "SvGrid Base" - a table database inside your Svelte app, on your own
 * database. For TikTok and LinkedIn (render with --format all).
 *
 * Every screen is a gallery demo captured in the run: 504 (project tracker)
 * for the grid, the views, a record and the automations, 519 for "plain SQL
 * in, an app out" on a real Postgres (PGlite) in the page. The field-type
 * count is read from BUILTIN_FIELD_TYPES in the source, not typed. The
 * trigger and action lists on the automations slide are the ones
 * BaseAutomations.svelte offers. The Supabase snippet is the call from
 * docs/help/base/quick-start.md.
 *
 * Shots run unlicensed, as a visitor sees them: the watermark stays, the
 * one-time upgrade card is closed.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

const facts = {}

// The built-in field types, as the "Field type" picker lists them.
{
  const src = readFileSync(join(ROOT, 'packages', 'enterprise', 'src', 'fields', 'builtin-types.ts'), 'utf8')
  const list = src.slice(src.indexOf('export const BUILTIN_FIELD_TYPES'))
  facts.fieldTypes = [...list.matchAll(/\bid: '(\w+)', label: '([^']+)'/g)].map((m) => m[2])
  if (facts.fieldTypes.length < 20) throw new Error(`read only ${facts.fieldTypes.length} field types: has builtin-types.ts changed shape?`)
}

// The one-time upgrade card a visitor closes; it can appear after the page settles.
export const HIDE_CARD = '[data-svgrid-enterprise-upgrade] { display: none !important; }'

export async function closeUpgradeCard(page) {
  await page.locator('[data-svgrid-enterprise-upgrade] button', { hasText: '×' }).click({ timeout: 4000 }).catch(() => {})
}

/** Demo 504 in one of its saved views (or the default grid), cropped to the base. */
export function tracker({ view, viewport = { width: 1000, height: 1150 }, then, selector = '.sv-fbase', assert, trim }) {
  return {
    server: 'gallery',
    path: '/#/504-project-tracker',
    css: HIDE_CARD,
    viewport,
    waitFor: '.sv-btabs',
    async setup(page) {
      await page.locator('.sv-btabs').waitFor({ timeout: 90_000 })
      await closeUpgradeCard(page)
      if (view) {
        await page.locator('.sv-fvb-view').first().click()
        await page.locator('.sv-fviews-pick', { hasText: view }).first().click()
        await page.waitForTimeout(900)
      }
      if (then) await then(page)
    },
    assert,
    selector,
    trim,
    settle: 900,
  }
}

export default {
  id: 'svgrid-base',
  facts,
  caption:
    'SvGrid Base: tables your team works in, inside your own Svelte app, on your own database. Grid, Kanban, calendar, gallery and form views, linked records, formulas, automations, comments. Point it at Postgres or Supabase and it builds the app from your tables. Part of SvGrid Suite. Docs: svgrid.com/docs/help/base/quick-start/',
  linkedinCaption: [
    'Most teams end up with their real data in Postgres and their working copy in a hosted spreadsheet-database. Then someone writes a sync script.',
    '',
    'SvGrid Base puts that tool inside your own Svelte app, on your own database:',
    '- one call reads your tables, columns and foreign keys and builds the app',
    '- grid, Kanban, calendar, gallery and form views over the same records',
    '- linked records, lookups, rollups and formulas',
    '- automations that run in the browser or on your server',
    '- edits go straight to your tables; on Supabase, other people\'s changes arrive through Realtime',
    '',
    'Every screen in this carousel is a live demo, captured as is.',
    '',
    'Part of SvGrid Suite, with a 30-day trial. Docs: https://svgrid.com/docs/help/base/quick-start/',
  ].join('\n'),
  hashtags: ['svelte', 'sveltejs', 'postgres', 'supabase', 'webdev', 'javascript', 'nocode', 'internaltools'],
  slides: [
    {
      kind: 'title',
      title: 'Your team\'s tables, ==inside your Svelte app==.',
      body: 'SvGrid Base: fields, views, records and automations, on your own database.',
      shot: tracker({
        trim: true,
        async assert(page) {
          const n = await page.locator('.sv-fvb-count').innerText()
          if (!/\d+ records/.test(n)) throw new Error(`no record count on the tracker ("${n}")`)
        },
      }),
    },
    {
      kind: 'shot',
      title: 'Plain SQL in. ==An app out.==',
      body: '`baseFromDatabase` reads your tables, columns and foreign keys. You get tabs, typed fields, links and views.',
      shot: {
        server: 'gallery',
        path: '/#/519-base-from-database',
        css: HIDE_CARD,
        viewport: { width: 1000, height: 860 },
        async setup(page) {
          await page.getByRole('button', { name: 'Make the app' }).waitFor({ timeout: 90_000 })
          await closeUpgradeCard(page)
          await page.getByRole('tab', { name: 'Shop', exact: true }).click()
          await page.getByRole('button', { name: 'Make the app' }).click()
          await page.getByText(/Read \d+ tables/).waitFor({ timeout: 30_000 })
        },
        async assert(page) {
          const tabs = await page.locator('.sv-btabs [role="tab"]').allInnerTexts()
          for (const t of ['Orders', 'Customers', 'Products']) {
            if (!tabs.some((x) => x.includes(t))) throw new Error(`the shop app has no ${t} tab (${tabs.join(', ')})`)
          }
          if (await page.locator('.sv-fbase .sv-grid-row').count() === 0) throw new Error('the shop app has no rows')
        },
        selector: '.demo-page > main',
        settle: 900,
      },
      after: 'A real Postgres, running in the page.',
    },
    {
      kind: 'shot',
      title: 'One table. ==Five views.==',
      body: 'Grid, Kanban, calendar, gallery and a form, over the same records.',
      shot: tracker({
        view: 'By status',
        viewport: { width: 1000, height: 960 },
        async assert(page) {
          if (await page.locator('.sv-board-card').count() === 0) throw new Error('the Kanban view has no cards')
        },
      }),
    },
    {
      kind: 'shot',
      title: 'Any date field ==is a calendar==.',
      shot: tracker({
        view: 'Due dates',
        viewport: { width: 1000, height: 900 },
      }),
      after: 'And a form view adds a record from the same fields.',
    },
    {
      kind: 'shot',
      title: (f) => `==${f.fieldTypes.length}== field types.`,
      body: 'People, files, ratings, links to other tables, lookups, rollups, formulas.',
      shot: tracker({ view: 'Gallery', viewport: { width: 1000, height: 1150 } }),
    },
    {
      kind: 'shot',
      title: 'Open any record.',
      body: 'Every field, its history, and a comment thread.',
      shot: tracker({
        selector: '.sv-modal',
        async then(page) {
          await page.getByText('Attachment cell', { exact: true }).first().hover()
          await page.locator('.sv-frh-expand:visible').first().click()
          await page.locator('.sv-modal').waitFor()
          await page.waitForTimeout(600)
        },
      }),
    },
    {
      kind: 'shot',
      title: 'Automations, ==no code==.',
      body: 'When a record is created, changes or matches, or a form is sent: update, notify, color, call a webhook, send an email.',
      shot: tracker({
        selector: '.sv-modal',
        async then(page) {
          await page.getByRole('button', { name: /\d+ automations/ }).click()
          await page.locator('.sv-modal').waitFor()
          await page.waitForTimeout(600)
        },
      }),
    },
    {
      kind: 'code',
      title: 'On Supabase: ==one call==.',
      file: '+page.svelte',
      code: [
        'const tables = await baseFromSupabase({',
        '  client: supabase, url, key,',
        '})',
        '',
        '<SvBase {tables} editable />',
      ].join('\n'),
      after: 'Edits write to your tables, and other people\'s changes arrive through Realtime. Postgres, MySQL, SQLite and SQL Server work behind your own endpoint.',
    },
    {
      kind: 'end',
      title: 'Meet ==SvGrid Base==.',
      lines: ['svgrid.com/docs/help/base', '`npm i @svgrid/enterprise`', 'Part of SvGrid Suite. 30-day trial.'],
    },
  ],
}
