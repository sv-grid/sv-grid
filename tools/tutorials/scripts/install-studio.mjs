/**
 * Tutorial: install SvGrid Studio and build a CRUD app. Two takes joined:
 * the CLI on the stage terminal (output as packages/create-studio/index.mjs
 * and packages/enterprise/src/studio/init-flow.ts print it), then the visual
 * designer on the website (/studio/new): the New app wizard, the generated
 * screens, the live preview and the Generate app dialog.
 */
export default {
  id: 'install-studio',
  title: 'SvGrid Studio: database to CRUD app',
  description: 'Scaffold a SvelteKit data app from the command line or the visual designer: tables in, a list, an edit form and a record page per table out.',
  docsPage: 'docs/enterprise/studio/getting-started.md',
  anchor: '## Guided path - answer a few questions, get the app',
  tags: ['svgrid studio', 'sveltekit crud generator', 'database to app', 'admin panel svelte', 'low code svelte'],
  gif: { beats: [4, 5] },
  poster: { beat: 6 },

  segments: [
    {
      stage: true,
      async setup(page, h) {
        await h.stage.show('terminal', { title: 'Terminal' })
      },
      beats: [
        {
          say: 'SvGrid Studio turns tables into a SvelteKit app. From the command line, one create command scaffolds a runnable app with sample tables.',
          lead: 800,
          async do(page, h) {
            await h.stage.term.run('npm create @svgrid/studio@latest my-app', {
              typeMs: 45,
              output: [
                { text: '', after: 700 },
                { text: 'Scaffolded my-app into ./my-app', cls: 'ok' },
                '',
                { text: 'Next steps', cls: 'bold' },
                '  cd my-app',
                '  npm install',
                '  npm run dev',
                '',
                { text: 'Have a database? npx @svgrid/studio init reads your tables and scaffolds a page for each.', cls: 'dim' },
              ],
            })
          },
          hold: 300,
        },
        {
          say: 'Point init at a real database and it reads the tables, then writes a list, an edit form and a record page for each one.',
          lead: 300,
          async do(page, h) {
            await h.stage.term.run('npx @svgrid/studio init --db postgres --url $DATABASE_URL --out shop', {
              typeMs: 40,
              output: [
                { text: 'SvGrid Studio - let\'s build your app.', after: 700 },
                '  Connecting...',
                { text: '', after: 900 },
                'Found 3 tables:',
                '  1. customers (24 rows)',
                '  2. orders (58 rows)',
                '  3. products (12 rows)',
                { text: '  Read 3 tables.', after: 500 },
                '',
                { text: 'Built "Shop": 3 tables, 9 screens, 31 files.', cls: 'ok', after: 600 },
                '',
                { text: 'Next:', cls: 'bold' },
                '  cd shop',
                '  npm install',
                '  npm run dev',
              ],
            })
          },
          hold: 600,
        },
      ],
    },
    {
      site: 'studio/new',
      async setup(page, h) {
        await page.waitForSelector('.sv-wiz', { timeout: 90_000 })
        await h.pause(800)
      },
      beats: [
        {
          say: 'The same generator runs in the browser. The designer opens with a wizard: start from sample data, your own database, or blank.',
          lead: 600,
          async do(page, h) {
            await h.click(page.locator('.sv-wiz__card', { hasText: /sample data/i }))
          },
          hold: 300,
        },
        {
          say: 'Pick a dataset, choose which pages each table gets, and open the app.',
          lead: 200,
          async do(page, h) {
            await h.click(page.locator('.sv-wiz__btn--primary', { hasText: /continue/i }))
            await h.pause(900)
            await h.click(page.locator('.sv-wiz__btn--primary', { hasText: /continue/i }))
            await h.pause(900)
            await h.click(page.locator('.sv-wiz__btn--primary', { hasText: /open my app/i }))
            await page.waitForSelector('.sv-wiz', { state: 'detached', timeout: 15_000 })
          },
          hold: 900,
        },
        {
          say: 'Two tables became six screens: an overview with a KPI and a chart, a list, a manage page and a detail page per table, all on the canvas to rearrange.',
          lead: 300,
          async do(page, h) {
            await h.hover(page.getByRole('button', { name: /^Customer\b/ }).first())
            await h.pause(400)
            await h.hover(page.getByRole('button', { name: /^Order\b/ }).first())
          },
          hold: 300,
        },
        {
          say: 'Preview runs the app as a user sees it: the grid, the new record button, the navigation.',
          lead: 200,
          async do(page, h) {
            await h.click(page.getByRole('button', { name: /^preview$/i }).first())
            await page.waitForSelector('text=Live preview', { timeout: 15_000 })
            await h.pause(1200)
            await h.click(page.locator('.sv-studio__pv-nav-item[title="Customer"]').first())
          },
          hold: 900,
        },
        {
          say: 'Generate app writes the SvelteKit project: twenty-seven files, typed schemas, routes and a CI workflow. Download the zip or open it in StackBlitz.',
          lead: 200,
          async do(page, h) {
            await h.press('Escape')
            await h.pause(700)
            await h.click(page.getByRole('button', { name: /generate app/i }).first())
            await page.waitForSelector('text=Generated app', { timeout: 15_000 })
            await h.pause(900)
            await h.hover(page.getByRole('button', { name: /download \.zip/i }).first())
          },
          hold: 800,
        },
      ],
      async verify(page) {
        const text = await page.locator('[role="dialog"]').first().textContent().catch(() => '')
        if (!/Generated app/i.test(text ?? '')) throw new Error('the Generated app dialog did not open')
        return 'Generated app dialog open'
      },
    },
  ],
}
