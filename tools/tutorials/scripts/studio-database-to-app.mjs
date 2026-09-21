/**
 * Marketing cut: SvGrid Studio, from a database to a running app. Title,
 * the CLI on the stage, the designer on the website, end card. YouTube only,
 * 1920x1080. The terminal output follows packages/enterprise/src/studio/
 * init-flow.ts.
 */
export default {
  id: 'studio-database-to-app',
  kind: 'marketing',
  title: 'SvGrid Studio: from a database to an app',
  description: 'Point SvGrid Studio at your tables and get a SvelteKit app: a searchable list, an edit form and a record page per table, from the CLI or the visual designer.',
  tags: ['svgrid studio', 'sveltekit', 'crud generator', 'admin panel', 'internal tools', 'low code', 'svelte 5'],
  gif: { beats: [3, 4] },
  poster: { beat: 3 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'SvGrid Studio', title: 'Your tables. A SvelteKit app. Minutes.', subtitle: 'A list, an edit form and a record page for every table, generated, and yours to edit.' })
      },
      beats: [
        { say: 'Every internal tool starts the same way: tables in a database, and the pages to browse and edit them. SvGrid Studio generates those pages.', lead: 200 },
      ],
    },
    {
      stage: true,
      introHold: 0.4,
      async setup(page, h) {
        await h.stage.show('terminal', { title: 'Terminal' })
      },
      beats: [
        {
          say: 'From the terminal, init reads the tables and writes the app.',
          lead: 300,
          async do(page, h) {
            await h.stage.term.run('npx @svgrid/studio init --db postgres --url $DATABASE_URL --out shop', {
              typeMs: 32,
              output: [
                { text: 'SvGrid Studio - let\'s build your app.', after: 500 },
                '  Connecting...',
                { text: '', after: 700 },
                'Found 3 tables:',
                '  1. customers (24 rows)',
                '  2. orders (58 rows)',
                '  3. products (12 rows)',
                { text: '  Read 3 tables.', after: 400 },
                '',
                { text: 'Built "Shop": 3 tables, 9 screens, 31 files.', cls: 'ok', after: 500 },
                '',
                { text: 'Next:', cls: 'bold' },
                '  cd shop',
                '  npm install',
                '  npm run dev',
              ],
            })
          },
          hold: 700,
        },
      ],
    },
    {
      site: 'studio/new',
      // The designer is laid out for a desktop viewport; at 1080p, zoom 1.4 gives it 1371 css px.
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.sv-wiz', { timeout: 90_000 })
        await h.pause(600)
      },
      beats: [
        {
          say: 'Or do it visually. The designer asks where the data is, which pages each table gets, and builds the app in the browser.',
          lead: 400,
          async do(page, h) {
            await h.click(page.locator('.sv-wiz__card', { hasText: /sample data/i }))
            await h.pause(800)
            await h.click(page.locator('.sv-wiz__btn--primary', { hasText: /continue/i }))
            await h.pause(800)
            await h.click(page.locator('.sv-wiz__btn--primary', { hasText: /continue/i }))
            await h.pause(800)
            await h.click(page.locator('.sv-wiz__btn--primary', { hasText: /open my app/i }))
            await page.waitForSelector('.sv-wiz', { state: 'detached', timeout: 15_000 })
          },
          hold: 1000,
        },
        {
          say: 'Screens are blocks on a canvas: a KPI, a chart, a grid, a form. Drag them around, bind them to data, add an action.',
          lead: 300,
          async do(page, h) {
            await h.hover(page.getByRole('button', { name: /^Customer\b/ }).first())
            await h.pause(500)
            await h.hover(page.getByRole('button', { name: /^Order\b/ }).first())
          },
          hold: 300,
        },
        {
          say: 'Preview runs it as your users will see it.',
          lead: 200,
          async do(page, h) {
            await h.click(page.getByRole('button', { name: /^preview$/i }).first())
            await page.waitForSelector('text=Live preview', { timeout: 15_000 })
            await h.pause(1000)
            await h.click(page.locator('.sv-studio__pv-nav-item[title="Customer"]').first())
          },
          hold: 900,
        },
        {
          say: 'Generate app writes a real SvelteKit project: typed schemas, routes, a data layer and a CI workflow. Download it, or open it in StackBlitz. It is code, and it is yours.',
          lead: 200,
          async do(page, h) {
            await h.press('Escape')
            await h.pause(600)
            await h.click(page.getByRole('button', { name: /generate app/i }).first())
            await page.waitForSelector('text=Generated app', { timeout: 15_000 })
            await h.pause(900)
            await h.hover(page.getByRole('button', { name: /download \.zip/i }).first())
          },
          hold: 700,
        },
      ],
      async verify(page) {
        const text = await page.locator('[role="dialog"]').first().textContent().catch(() => '')
        if (!/Generated app/i.test(text ?? '')) throw new Error('the Generated app dialog did not open')
        return 'Generated app dialog open'
      },
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.6,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'SvGrid Studio', title: 'Generate the boring parts. Keep the code.', subtitle: 'Postgres, MySQL, SQL Server, SQLite, Supabase, REST or OpenAPI in. SvelteKit out.', lines: ['npx @svgrid/studio init', 'svgrid.com/studio'] })
      },
      beats: [
        { say: 'Postgres, MySQL, SQL Server, SQLite, Supabase, a REST endpoint or an OpenAPI spec. Try it at svgrid.com slash studio.', lead: 200 },
      ],
    },
  ],
}
