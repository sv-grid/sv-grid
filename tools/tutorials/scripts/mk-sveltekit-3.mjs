/**
 * SvelteKit 3: what changed, and a data grid app generated for it.
 *
 * SvelteKit 3 shipped on 2026-10-01. Every claim about it here was checked on
 * 2026-10-08 against the official announcement
 * (svelte.dev/blog/sveltekit-3-is-here) and the migration guide
 * (svelte.dev/docs/kit/migrating-to-sveltekit-3), and where the two disagreed,
 * against SvelteKit 3's own type definitions. Nothing is from memory: the
 * release is newer than the model that wrote this.
 *
 * The code on screen is real Studio output: `svgrid-studio init --kit 3` was
 * run and these files were copied from what it wrote. The app segments record
 * that same command's app (`appScaffold.kit: 3`), so the video shows exactly
 * what the flag produces.
 *
 * DO NOT PUBLISH before @svgrid/studio and @svgrid/enterprise are released with
 * the --kit flag. Until then a viewer running the command gets SvelteKit 2.
 */
export default {
  id: 'mk-sveltekit-3',
  kind: 'marketing',
  title: 'SvelteKit 3: what changed, and a data grid app built for it',
  description: 'SvelteKit 3 shipped on October 1. The changes that matter, a Svelte data grid running on it, and SvGrid Studio generating SvelteKit 3 apps.',
  tags: ['sveltekit 3', 'sveltekit', 'sveltekit 3 migration', 'svelte 5', 'svelte data grid', 'vite 8', 'sveltekit app'],
  view: { width: 1920, height: 1080 },
  appScaffold: { studio: 'customers-orders', theme: 'ember', dark: true, kit: 3 },
  poster: { beat: 5 },
  gif: { beats: [5, 5] },

  segments: [
    {
      stage: true,
      introHold: 0.7,
      async setup(page, h) {
        await h.stage.show('title', {
          kicker: 'SvelteKit 3',
          title: 'SvelteKit 3 is out.',
          subtitle: 'What changed, and an app built for it.',
        })
      },
      beats: [
        {
          say: 'SvelteKit 3 shipped on the first of October. The Svelte team describe it as the same framework with a little more polish, a little more type safety and a little less junk, and that is about right. Most of how you write a page has not changed. What has changed is mostly where things live, and that is what trips people up when they upgrade.',
          lead: 300,
        },
      ],
    },

    {
      stage: true,
      introHold: 0.4,
      async setup(page, h) {
        await h.stage.show('editor', { file: 'vite.config.ts' })
      },
      beats: [
        {
          say: 'The first thing you will notice is a file that is gone. There is no svelte config any more. The adapter and the preprocessor move into the SvelteKit plugin call, inside your Vite config, so the whole build is configured in one place.',
          lead: 350,
          async do(page, h) {
            await h.stage.editor.type(
              [
                "import adapter from '@sveltejs/adapter-auto'",
                "import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'",
                "import { sveltekit } from '@sveltejs/kit/vite'",
                "import { defineConfig } from 'vite'",
                '',
                'export default defineConfig({',
                '  plugins: [sveltekit({ preprocess: vitePreprocess(), adapter: adapter() })],',
                '})',
              ].join('\n'),
              { typeMs: 14 },
            )
            await h.pause(1600)
          },
          hold: 400,
        },
      ],
    },

    {
      stage: true,
      introHold: 0.4,
      async setup(page, h) {
        await h.stage.show('editor', { file: 'src/routes/customers/+page.svelte' })
      },
      beats: [
        {
          say: 'The second is the dollar lib alias. It is now hash lib, and that is more than a rename: it is a standard Node subpath import, declared in package dot json, so every tool resolves it, not only Vite. The catch is that it wants a real file extension, which is why these imports end in dot js even though the files are TypeScript.',
          lead: 350,
          async do(page, h) {
            await h.stage.editor.type(
              [
                "import { customersSchema, type Customers } from '#lib/schemas.js'",
                "import { customersSource, nextId } from '#lib/data.js'",
              ].join('\n'),
              { typeMs: 18 },
            )
            await h.pause(1800)
          },
          hold: 300,
        },
        {
          say: 'And environment variables are declared now, not discovered. You list the ones your app reads, they become typed imports from dollar app slash env, and a missing one is something you decided about rather than something you find out about in production. The headline feature people were waiting for, remote functions, is not in this release. The Svelte team say it is their top priority.',
          lead: 350,
          async do(page, h) {
            await h.pause(2400)
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
          say: 'So here is a SvelteKit 3 app with a data grid in it, without writing any of that by hand. SvGrid Studio generates SvelteKit apps from a database, a schema or a sample dataset, and it now takes a flag for the major version. Pass kit three and you get the new layout: config in Vite, hash lib imports, and environment variables declared wherever the app reads any.',
          lead: 350,
          async do(page, h) {
            await h.stage.term.run('npx svgrid-studio init --dataset customers-orders --kit 3', {
              typeMs: 32,
              output: [
                { text: '', after: 700 },
                { text: "SvGrid Studio - let's build your app.", cls: 'dim' },
                { text: '  Using Customers & orders (2 tables).', cls: 'dim' },
                '',
                // Copied from a real `init --kit 3` run on 2026-10-08, not
                // reconstructed. 27 files where the SvelteKit 2 app has 28: the
                // difference is the svelte.config.js v3 no longer has.
                { text: 'Built "Customers & orders": 2 tables, 6 screens, 27 files.', cls: 'ok' },
              ],
            })
            await h.pause(800)
          },
          hold: 400,
        },
      ],
    },

    {
      app: '/customers',
      zoom: 1.15,
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.sv-grid-body [role="row"]', { timeout: 40_000 })
        await h.pause(1000)
      },
      beats: [
        {
          // The list screen renders on the server now (Studio's default since
          // in-memory data moved behind /api), and a server-rendered list edits
          // through an Edit button per row, not a double click - the earlier
          // line said double click, which stopped being true.
          say: 'And that is the result, running on SvelteKit 3. A customers screen with the grid wired to the schema: a filter panel, sorting and paging, and an edit button on every row. The grid itself did not need to change for the new major, which is the point of building on the framework rather than around it.',
          lead: 350,
          async do(page, h) {
            const rows = await page.locator('.sv-grid-body [role="row"]').count()
            if (rows < 3) throw new Error(`the generated SvelteKit 3 app rendered ${rows} rows`)
            h.log(`SvelteKit 3 app: ${rows} rows on the customers grid`)
            await h.callout(page.locator('.sv-grid-container').first(), 'SvGrid, on SvelteKit 3', { hold: 1600 })
            await h.clearCallout()
          },
          hold: 300,
        },
        {
          // An earlier version of this beat was cut because its assertion found
          // 0 rows in the HTML: Studio screens loaded in the browser then. They
          // render on the server by default now, so the claim is checked again.
          say: 'And this screen renders on the server. The rows are in the HTML before any JavaScript runs, and the sort and the page live in the URL, so a link to page two is a link to page two.',
          lead: 350,
          async do(page, h) {
            const html = await (await page.request.get(page.url())).text()
            const ssrRows = new Set([...html.matchAll(/data-svgrid-row="(\d+)"/g)].map((m) => m[1])).size
            if (ssrRows < 3) throw new Error(`the server HTML for /customers has ${ssrRows} grid rows`)
            h.log(`server HTML: ${ssrRows} grid rows before hydration`)
            await h.callout(page.locator('.sv-grid-pagination').first(), 'Page and sort in the URL', { hold: 1600 })
            await h.clearCallout()
          },
          hold: 300,
        },
      ],
    },

    {
      stage: true,
      introHold: 0.5,
      outroHold: 2,
      async setup(page, h) {
        await h.stage.show('end', {
          kicker: 'SvelteKit 3',
          title: 'svgrid-studio init --kit 3',
          subtitle: 'Generate it, then keep editing it in the designer.',
          lines: ['svgrid.com/docs/enterprise/studio'],
        })
      },
      beats: [
        {
          say: 'Two things worth knowing. The version is saved in the project, so when you reopen the app in the Studio designer and keep editing, it regenerates as SvelteKit 3, not back to 2. And the default is still 2 for now, deliberately: SvelteKit 3 needs Vite 8, and its new bundler does not yet run inside StackBlitz, so version 3 is the one you opt into. The grid is MIT on npm.',
          lead: 350,
        },
      ],
    },
  ],
}
