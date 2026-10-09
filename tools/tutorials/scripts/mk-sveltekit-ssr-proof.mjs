/**
 * Series A, video 2: "SvelteKit data grid SSR: prove your rows render on the server."
 *
 * Lesson 9 and `mk-sveltekit` both ASSERT that SvGrid server-renders. Neither
 * shows it. This one shows the grid first, then proves it twice: once by
 * switching JavaScript off and finding the rows still there, and once with the
 * repo's own SSR check for the guarantees you cannot see by looking.
 *
 * On the terminal output: it is the real output of
 * `node packages/grid/scripts/check-ssr.mjs`, captured on 2026-10-07 and
 * replayed line for line. The stage terminal animates text rather than running
 * a shell, so nothing is invented - but it is a re-enactment, and a line must
 * never be edited to say something the command did not print.
 *
 * An earlier draft of this script showed a curl returning a row count that was
 * never measured. In a video whose premise is proof, that is the one thing that
 * cannot be faked, so the count is gone and the no-JS segment carries the
 * argument instead: it is measured live, every take, by the assertion below.
 */
export default {
  id: 'mk-sveltekit-ssr-proof',
  kind: 'marketing',
  title: 'SvelteKit data grid SSR: prove your rows render on the server',
  description: 'How to prove a SvelteKit data grid really server-renders: turn JavaScript off and watch the rows stay, then run the SSR check suite for the rest.',
  tags: ['sveltekit', 'sveltekit ssr', 'sveltekit data grid', 'svelte data grid', 'server side rendering', 'svelte 5', 'seo'],
  view: { width: 1920, height: 1080 },
  appScaffold: { template: 'sveltekit', theme: 'ember', dark: true },
  poster: { beat: 2 },
  gif: { beats: [2, 2] },

  segments: [
    {
      stage: true,
      introHold: 0.7,
      async setup(page, h) {
        await h.stage.show('title', {
          kicker: 'SvelteKit',
          title: 'Does it render on the server?',
          subtitle: 'Turn JavaScript off and find out.',
        })
      },
      beats: [
        {
          say: 'Every component library says it supports server side rendering, and most of the time what that means is that it does not crash when you import it on the server. In SvelteKit the question that matters is different: when the browser receives the HTML, before a single line of JavaScript has run, are your rows in it? There is a very direct way to find out.',
          lead: 300,
        },
      ],
    },

    {
      app: '/people',
      zoom: 2.6,
      introHold: 0.4,
      async setup(page, h) {
        // /people is in the template's PROTECTED list and redirects to sign-in.
        // With scripting off the form is a native POST, so the page navigates
        // the instant the button is pressed. Wait for the form first, and start
        // the navigation wait BEFORE the click: otherwise the click's own
        // actionability check runs into a destroyed execution context.
        if (/\/login/.test(page.url())) {
          await page.waitForSelector('#email', { timeout: 30_000 })
          await page.fill('#email', 'admin@example.com')
          await page.fill('#password', 'password')
          await Promise.all([
            page.waitForURL(/\/people/, { timeout: 30_000 }),
            page.click('button[type="submit"]'),
          ])
        }
        await page.waitForSelector('.sv-grid-body [role="row"]', { timeout: 40_000 })
        await h.pause(900)
      },
      beats: [
        {
          say: 'This is the page in question. The SvelteKit template, a grid of people, sortable and editable. Nothing unusual about it. The question is where these rows came from, and you cannot tell by looking: a grid that fetched them in the browser and a grid that was handed them by the server look exactly the same once they are on screen.',
          lead: 350,
          async do(page, h) {
            const rows = await page.locator('.sv-grid-body [role="row"]').count()
            if (rows < 3) throw new Error(`the people grid rendered ${rows} rows`)
            h.log(`people grid: ${rows} rows with JavaScript enabled`)
            await h.callout(page.locator('.sv-grid-body [role="row"]').first(), 'where did this row come from?', { hold: 1600 })
            await h.clearCallout()
          },
          hold: 300,
        },
        {
          say: 'So ask the server directly. Request the same page the way a crawler would, with no browser rendering it, and look at the bytes that come back. The row elements are already in there. Nothing in the browser built them: they were in the HTML before any script ran, which is the whole difference between a table that is server-rendered and one that merely appears quickly.',
          lead: 350,
          async do(page, h) {
            // A real request through the context, so it carries the session
            // cookie, and nothing renders it. This is the measurement an
            // earlier draft of this script invented a number for; here it is
            // taken live, on every take, from the server's own response.
            const res = await page.request.get(page.url())
            const html = await res.text()
            // data-svgrid-row sits on every CELL, so a raw match counts cells,
            // not rows - 5 rows of 3 columns reads as 15. check-ssr.mjs names
            // that same number `cells` for the same reason. Count the distinct
            // row indices, which is the number the narration can honestly say.
            const rows = new Set([...html.matchAll(/data-svgrid-row="(\d+)"/g)].map((m) => m[1])).size
            const onScreen = await page.locator('.sv-grid-body [role="row"]').count()
            if (rows < 3) {
              throw new Error(`the server HTML carried ${rows} rows: the grid is NOT server-rendering`)
            }
            if (rows !== onScreen) {
              throw new Error(`server HTML has ${rows} rows but ${onScreen} are on screen: they should be the same rows`)
            }
            h.log(`server HTML for ${new URL(page.url()).pathname}: ${rows} rows, matching the ${onScreen} on screen`)
            await h.callout(page.locator('.sv-grid-body').first(), `all ${rows} rows, already in the server's HTML`, {
              place: 'above',
              hold: 2000,
            })
            await h.clearCallout()
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
          say: 'That covers the thing you can see. The rest of it you cannot, so the repository checks it on every build. This renders the grid on the server with no browser anywhere and reads the string that comes back.',
          lead: 350,
          async do(page, h) {
            // One run, all twelve lines. A second term.run() for the rest opened
            // a bare prompt mid-output, which reads like a command was run with
            // nothing in it, and the scene has no append API.
            await h.stage.term.run('pnpm ssr:check', {
              typeMs: 34,
              output: [
                { text: '', after: 500 },
                { text: '  ok    row values appear in the server HTML', cls: 'ok', after: 300 },
                { text: '  ok    cell values appear (not just names)', cls: 'ok', after: 300 },
                { text: '  ok    real row elements render', cls: 'ok', after: 300 },
                { text: '  ok    the empty-state row is NOT what rendered', cls: 'ok', after: 300 },
                { text: '  ok    header labels render', cls: 'ok', after: 300 },
                { text: '  ok    a large grid still renders its first rows', cls: 'ok', after: 800 },
                { text: '  ok    virtualization survives SSR (not every row serialised)', cls: 'ok', after: 700 },
                { text: '  ok    the summary row server-renders its totals, not empty cells', cls: 'ok', after: 700 },
                { text: '  ok    summary totals are the REAL aggregate (sum of the year column)', cls: 'ok', after: 500 },
                { text: '  ok    a plain grid has NO summary row (it is opt-in)', cls: 'ok', after: 300 },
                { text: '  ok    the empty state still renders for no rows', cls: 'ok', after: 300 },
                { text: '  ok    feature props do not break SSR', cls: 'ok', after: 500 },
                { text: '', after: 300 },
                { text: 'SSR OK - <SvGrid> renders rows on the server.', cls: 'ok' },
              ],
            })
            await h.pause(600)
          },
          hold: 300,
        },
        {
          // No terminal action: the output is already on screen from the beat
          // above, which is why those two lines are paced to land last.
          say: 'And this is the pair worth reading twice. Virtualization survives server rendering, which means it does not quietly serialise a hundred thousand rows into your page to look good on this test. And the summary row renders its real totals, computed on the server, rather than empty cells that fill in after hydration.',
          lead: 300,
          async do(page, h) {
            await h.pause(2400)
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
          kicker: 'SvelteKit',
          title: 'Turn JavaScript off.',
          subtitle: 'If the rows vanish, they were never server-rendered.',
          lines: ['npm create @svgrid@latest -- --template sveltekit'],
        })
      },
      beats: [
        {
          say: 'Run that test on your own application, whatever grid is in it. Switch scripting off and reload. If the table empties out, your rows are being drawn in the browser, and a crawler, a slow phone and your first paint all see what you just saw. The SvelteKit template has this wired already, and the grid is MIT on npm.',
          lead: 350,
        },
      ],
    },
  ],
}
