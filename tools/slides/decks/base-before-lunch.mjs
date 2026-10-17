/**
 * "Shipped it before lunch" - SvGrid Base for developers, told as one
 * morning: the PM wants a table-database tool, the data may not leave the
 * company's Postgres, and the developer has until lunch. TikTok photo mode.
 *
 * The chat slides are a skit; every other slide is a live gallery demo
 * captured in the run: 519 (a real Postgres in the page, read into an app),
 * 504 (the project tracker's Kanban and automations) and 700 (a stand-in AI
 * agent writing SQL, the base marking what it changed). The licensing line
 * on the last chat slide is the pricing FAQ's: per developer, unlimited
 * deployed apps. "Runs without a key, with a watermark" is the trial FAQ.
 */
import { HIDE_CARD, closeUpgradeCard, tracker } from './svgrid-base.mjs'

const PM = { who: 'Product manager', av: 'PM' }
const ME = { who: 'You', av: 'ME', me: true }

export default {
  id: 'base-before-lunch',
  caption:
    'The PM wanted a spreadsheet-database tool. Legal said the data stays in our Postgres. SvGrid Base is a self-hosted Airtable-style base you drop into your own Svelte app: grid, Kanban, calendar, gallery and form views, automations, and AI agents that write SQL while your team sees every cell they changed. Your database, your auth, your server. npm i @svgrid/enterprise and it runs right away (with a watermark until you buy). Docs: svgrid.com/docs/help/base/quick-start/',
  hashtags: ['svelte', 'sveltejs', 'selfhosted', 'airtablealternative', 'postgres', 'supabase', 'webdev', 'programming', 'devhumor'],
  slides: [
    {
      kind: 'chat',
      stamp: '10:58',
      title: 'POV: the PM found ==a new tool==.',
      chat: [
        { ...PM, time: '10:58', text: 'Can we get one of those spreadsheet-database things? Grid, Kanban, calendar, forms.' },
        { ...PM, time: '10:59', text: 'Oh and legal says the data ==can\'t leave our Postgres==.' },
        { ...ME, time: '11:00', text: 'Give me until lunch.' },
      ],
    },
    {
      kind: 'shot',
      stamp: '11:02',
      title: 'Pointed it at ==our Postgres==.',
      body: '`baseFromDatabase` read the tables and foreign keys. Out came tabs, typed fields and links.',
      shot: {
        server: 'gallery',
        path: '/#/519-base-from-database',
        css: HIDE_CARD,
        viewport: { width: 720, height: 860 },
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
      after: 'That is a real Postgres running in the page, not a mockup.',
    },
    {
      kind: 'shot',
      stamp: '11:09',
      title: '"Can it do Kanban?" ==Same rows.== Yes.',
      body: 'Grid, Kanban, calendar, gallery and a form. One table, five views.',
      shot: tracker({
        view: 'By status',
        viewport: { width: 700, height: 900 },
        async assert(page) {
          if (await page.locator('.sv-board-card').count() === 0) throw new Error('the Kanban view has no cards')
        },
      }),
    },
    {
      kind: 'shot',
      stamp: '11:21',
      title: '"Ping me when it\'s ==Blocked==."',
      body: 'Automations the PM edits without a ticket: notify, update a field, call a webhook, send an email.',
      shot: tracker({
        selector: '.sv-modal',
        viewport: { width: 760, height: 1250 },
        async then(page) {
          await page.getByRole('button', { name: /\d+ automations/ }).click()
          await page.locator('.sv-modal').waitFor()
          await page.locator('.sv-bauto-pick', { hasText: 'Task blocked' }).click()
          await page.waitForTimeout(600)
        },
        async assert(page) {
          const name = await page.locator('.sv-bauto-head input').first().inputValue()
          if (name !== 'Task blocked') throw new Error(`the automation editor shows "${name}", not "Task blocked"`)
        },
      }),
    },
    {
      kind: 'shot',
      stamp: '11:40',
      title: 'Let an AI agent ==do the triage==.',
      body: 'It writes SQL to your table. The base tints every cell it changed and says who changed it.',
      shot: {
        server: 'gallery',
        path: '/#/700-base-ai-triage',
        css: HIDE_CARD,
        viewport: { width: 720, height: 760 },
        async setup(page) {
          const run = page.getByRole('button', { name: 'Run the triage agent' })
          await run.waitFor({ timeout: 90_000 })
          await closeUpgradeCard(page)
          await run.click()
          await page.getByText(/Triaged \d+ tickets/).waitFor({ timeout: 30_000 })
          await page.locator('.sv-fvb-changed').waitFor({ timeout: 10_000 })
        },
        async assert(page) {
          const chip = await page.locator('.sv-fvb-changed').innerText()
          if (!/changed by Triage agent/.test(chip)) throw new Error(`no "changed by" chip ("${chip}")`)
        },
        selector: '.aitri',
        settle: 900,
      },
      after: 'It filed "can\'t wait for Excel export" as an urgent login bug. You fix that one.',
    },
    {
      kind: 'code',
      stamp: '11:52',
      title: 'The whole ==integration==.',
      file: '+page.svelte',
      code: [
        'const tables = await baseFromSupabase({',
        '  client: supabase, url, key,',
        '})',
        '',
        '<SvBase {tables} editable />',
      ].join('\n'),
      after: 'Records stay in your database, behind your auth, on your server. Postgres, MySQL, SQLite and SQL Server work behind your own endpoint.',
    },
    {
      kind: 'chat',
      stamp: '12:00',
      title: 'The ==demo==.',
      chat: [
        { ...PM, time: '12:00', text: 'Which SaaS is this? How many seats do we buy?' },
        { ...ME, time: '12:00', text: 'It\'s a Svelte component in our app. Licensed ==per developer==, not per person using it.' },
        { ...PM, time: '12:01', text: 'Can marketing get one too?' },
        { ...ME, time: '12:01', text: 'After lunch.' },
      ],
    },
    {
      kind: 'end',
      title: 'Try ==SvGrid Base== before your lunch.',
      lines: ['`npm i @svgrid/enterprise`', 'Runs right away, no key. Watermark until you buy.', 'svgrid.com/docs/help/base'],
    },
  ],
}
