/**
 * Series A, video 1: "From a database to a SvelteKit app in one command."
 *
 * The first video in this pipeline to record a REAL scaffolded app rather than
 * the gallery or a stage mock: `appScaffold` tells record.mjs to run
 * `svgrid-studio init --dataset customers-orders`, install it, and serve it,
 * and the `app:` segments below record that running SvelteKit app.
 *
 * `--dataset` is deliberate: no database, no credentials, reproducible on any
 * machine, and the exact command a viewer can run while watching.
 *
 * Studio is Suite-tier. The end card says so; the narration does not imply the
 * generated app is free.
 */
export default {
  id: 'mk-sveltekit-studio-crud',
  kind: 'marketing',
  title: 'A SvelteKit CRUD app from a database, in one command',
  description: 'Point SvGrid Studio at a schema and it writes a SvelteKit app: a list, an edit form and a record page per table, as source you own and keep editing.',
  tags: ['sveltekit crud', 'sveltekit data grid', 'svelte admin panel', 'code generation', 'svelte 5', 'crud app'],
  view: { width: 1920, height: 1080 },
  poster: { beat: 3 },
  gif: { beats: [3, 4] },
  appScaffold: { studio: 'customers-orders', theme: 'ember', dark: true },

  segments: [
    {
      stage: true,
      introHold: 0.7,
      async setup(page, h) {
        await h.stage.show('title', {
          kicker: 'SvelteKit',
          title: 'A database. One command. An app.',
          subtitle: 'Not a demo you clone. Source you own.',
        })
      },
      beats: [
        { say: 'Every internal tool starts the same way. There are tables, somebody needs to see them and change them, and two weeks disappear into list screens and forms the same shape as the last ones you wrote.', lead: 300 },
      ],
    },
    {
      demo: '48-crm-sales-pipeline',
      zoom: 1.25,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'This is the kind of thing people mean. A sales pipeline: every row a deal, every column a number somebody has to defend on Friday. Owners, stages, values, close dates, the lot. It is not hard work exactly, it is just a lot of it, and it looks the same in every company you have ever worked at.',
          lead: 350,
          async do(page, h) {
            const rows = await page.locator('.sv-grid-body [role="row"]').count()
            if (rows < 3) throw new Error(`the CRM demo rendered ${rows} rows`)
            h.log(`CRM pipeline: ${rows} deals on screen`)
            await h.easedScrollBy(900, 2200)
            await h.pause(1200)
          },
          hold: 400,
        },
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
          say: 'So point the generator at where your data already lives. A Postgres or MySQL connection string, a Drizzle or Prisma schema file, an OpenAPI document, or for this one a sample dataset so you can follow along without a database. Pick a theme while you are there.',
          lead: 400,
          async do(page, h) {
            await h.stage.term.run('npx svgrid-studio init --dataset customers-orders --theme ember --dark', {
              typeMs: 34,
              output: [
                { text: '', after: 700 },
                { text: "SvGrid Studio - let's build your app.", cls: 'dim' },
                { text: '  Using Customers & orders (2 tables).', cls: 'dim' },
                '',
                { text: 'Built "Customers & orders": 2 tables, 6 screens, 28 files.', cls: 'ok' },
              ],
            })
            await h.pause(600)
          },
          hold: 300,
        },
        {
          say: 'Twenty eight files, six screens, two tables. Install it and run it the way you would any SvelteKit project, because that is all it is.',
          lead: 300,
          async do(page, h) {
            await h.stage.term.run('npm install && npm run dev', {
              typeMs: 34,
              output: [
                { text: '', after: 900 },
                { text: '  VITE ready in 612 ms', cls: 'ok' },
                '',
                { text: '  ->  Local:   http://localhost:5173/', cls: 'dim' },
              ],
            })
            await h.pause(700)
          },
          hold: 400,
        },
      ],
    },
    {
      app: '/',
      zoom: 1.1,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(2200)
      },
      beats: [
        {
          say: 'And that is the app, in the theme you asked for. A nav built from your tables, a card per entity, and a working screen behind each one. Nothing here is a placeholder waiting for you to fill it in, and nothing is a component from a library you now depend on at runtime. It is routes, components and a schema file, in your repository.',
          lead: 350,
          async do(page, h) {
            const links = await page.locator('a[href]').count()
            if (links < 3) throw new Error(`the generated home page has ${links} links`)
            h.log(`home: ${links} links in the generated nav`)
            await h.pause(2400)
          },
          hold: 400,
        },
      ],
    },
    {
      app: '/customers',
      zoom: 1.1,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(2200)
      },
      beats: [
        {
          say: 'The list screen is the grid you already know, wired to the schema: a column per field, a filter per column, paging at the bottom, and the types carried through from the table definition rather than retyped by hand. Which is the quiet part that matters. The schema file is one place, and the grid columns, the form controls and the validation all read from it. Add a field to the table and it appears in all three, instead of you remembering the three files that have to agree.',
          lead: 350,
          async do(page, h) {
            await page.waitForSelector('.sv-grid-body [role="row"]', { timeout: 30_000 })
            const rows = await page.locator('.sv-grid-body [role="row"]').count()
            if (rows < 3) throw new Error(`the customers grid rendered ${rows} rows`)
            const filters = await page.locator('main input[type="search"], main input[placeholder*="Search" i]').count()
            h.log(`customers: ${rows} rows, ${filters} filter inputs`)
            await h.pause(2600)
          },
          hold: 400,
        },
      ],
    },
    {
      app: '/customers-manage',
      zoom: 1.1,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(2200)
      },
      beats: [
        {
          say: 'The manage screen pairs the list with an editor. Pick a record and its form appears underneath, built from the same schema: every field gets the control its type asks for, and the validation is that schema read back to you. Create and update are both already wired. This is the part that normally eats the fortnight.',
          lead: 350,
          async do(page, h) {
            // The form is not on screen until a row is chosen: the page opens
            // on "Select a row to see its details". Counting inputs before
            // picking one found exactly the search box.
            await page.waitForSelector('.sv-grid-body [role="row"]', { timeout: 30_000 })
            const fields = () => page.locator('main input, main select, main textarea').count()
            const before = await fields()
            await h.clickCell(0, 0)
            await h.pause(2000)
            const after = await fields()
            if (after <= before + 1) {
              throw new Error(`selecting a row revealed no edit form (${before} -> ${after} controls)`)
            }
            h.log(`manage: picking a row revealed ${after - before} form controls from the schema`)
            await h.pause(2600)
          },
          hold: 400,
        },
      ],
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 2,
      async setup(page, h) {
        await h.stage.show('end', {
          kicker: 'Suite licence',
          title: 'npx svgrid-studio init',
          subtitle: 'Studio and the spreadsheet are the Suite tier. The grid underneath is MIT on npm.',
          lines: ['svgrid.com/docs/enterprise/studio'],
        })
      },
      beats: [
        { say: 'The important part is what it is not. It is not a runtime you ship, and it is not a black box you configure forever. It is source in your repository, under your version control, which you edit like anything else you wrote. Re-run the generator and the parts you changed stay changed, because the generated regions are marked and the rest is left alone. Studio is the Suite tier; the grid it builds on is MIT on npm.', lead: 350 },
      ],
    },
  ],
}
