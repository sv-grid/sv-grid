/**
 * Series A, video 3: "Sorting that survives a refresh."
 *
 * Lesson 9 explicitly defers this, and nothing else covers it. The grid sorts
 * on the server, the sort lives in the URL, and a reload keeps it: that is the
 * difference between a table widget and a page you can link to.
 *
 * Recorded against the real `sveltekit` template (`appScaffold` below), whose
 * people route already does this: `externalSort` + `initialSorting` +
 * `onSortingChange` calling `goto()`, with `+page.server.ts` reading ?sort/?dir.
 * The code shown in the editor beat is that file, copied verbatim.
 *
 * On what is NOT shown: the stage's browser frame renders stage content, not a
 * live app, so there is no real URL bar over a running page. Rather than draw
 * fake chrome, the proof here is the reload - sort it, reload it, still sorted -
 * and the URL is asserted in the run log instead of mocked on screen.
 */
export default {
  id: 'mk-sveltekit-url-sorting',
  kind: 'marketing',
  title: 'SvelteKit server-side sorting: keep the grid sort in the URL',
  description: 'Server-side sorting in SvelteKit: put the sort in the URL so a reload and a shared link land on the same view. externalSort and goto, wired end to end.',
  tags: ['sveltekit', 'sveltekit data grid', 'sveltekit sorting', 'server side sorting', 'svelte data grid', 'url state', 'svelte 5'],
  view: { width: 1920, height: 1080 },
  // dark: the template follows the OS otherwise, and every other video in the
  // set is dark. It also gives the scaffold its own directory, which sidesteps a
  // stale Windows handle on the previous one.
  appScaffold: { template: 'sveltekit', theme: 'ember', dark: true },
  poster: { beat: 1 },
  gif: { beats: [1, 1] },

  segments: [
    {
      stage: true,
      introHold: 0.7,
      async setup(page, h) {
        await h.stage.show('title', {
          kicker: 'SvelteKit',
          title: 'Sorting that survives a refresh.',
          subtitle: 'The sort belongs in the URL, not in a component.',
        })
      },
      beats: [
        {
          say: 'Here is a small thing that separates a table widget from a page. Sort a data grid in SvelteKit, send someone the link, and they should see what you saw. Reload it yourself and it should still be sorted. That only works if the sort lives in the URL and the server does the sorting, and in SvelteKit it is about ten lines to wire up.',
          lead: 300,
        },
      ],
    },

    {
      app: '/people',
      // The template page is three columns with containerHeight 320, so at a
      // normal zoom the grid is a small box in the corner of a 1080p frame.
      zoom: 2.6,
      introHold: 0.4,
      // This segment reloads the page on purpose: that is the proof. Without
      // this the recorder treats the reload as a dev-server restart and throws
      // the take away, which it did once with every assertion already green.
      allowReload: true,
      async setup(page, h) {
        // /people is in the template's PROTECTED list, so it redirects to the
        // sign-in page. The template seeds two demo users and prints both on
        // that page; admin is the one that can also rename, which the next
        // video in this series needs.
        if (/\/login/.test(page.url())) {
          await page.fill('#email', 'admin@example.com')
          await page.fill('#password', 'password')
          await page.click('button[type="submit"]')
          await page.waitForURL(/\/people/, { timeout: 30_000 })
          h.log('signed in as admin@example.com')
        }
        await page.waitForSelector('.sv-grid-body [role="row"]', { timeout: 40_000 })
        // The template boots in light mode and every other video in the set is
        // dark. Its own toggle, not a localStorage key: the app owns its theme.
        const toggle = page.locator('button[aria-pressed]').first()
        if ((await toggle.count()) && (await toggle.getAttribute('aria-pressed')) === 'false') {
          await toggle.click()
          await h.pause(500)
        }
        await h.pause(900)
      },
      beats: [
        {
          say: 'This is the SvelteKit template, and this grid does not sort itself. Clicking a header asks the server for the rows in that order, and the page navigates to a URL that carries the sort. The rows that come back were sorted by the server, not reordered in the browser.',
          lead: 350,
          async do(page, h) {
            const firstCell = () => page.locator('.sv-grid-body [role="row"]').first().innerText()
            const before = (await firstCell()).trim()
            const urlBefore = page.url()
            // Click the header itself, not its filter button.
            await page.locator('[role="columnheader"]').filter({ hasText: 'Name' }).first().click()
            await page.waitForFunction(() => /[?&]sort=/.test(location.search), null, { timeout: 15_000 })
            await h.pause(1200)
            const urlAfter = page.url()
            const after = (await firstCell()).trim()
            if (urlAfter === urlBefore) throw new Error('clicking the header did not change the URL')
            if (!/[?&]sort=/.test(urlAfter)) throw new Error(`the URL carries no sort: ${urlAfter}`)
            h.log(`sort went into the URL: ${urlAfter.replace(/^https?:\/\/[^/]+/, '')}`)
            h.log(`first row: "${before.slice(0, 40)}" -> "${after.slice(0, 40)}"`)
            await h.callout(page.locator('[role="columnheader"]').filter({ hasText: 'Name' }).first(), 'the server sorted these rows', { hold: 1500 })
            await h.clearCallout()
          },
          hold: 300,
        },
        {
          say: 'And now the part that matters. Reload the page. Not a client side rerender, a full round trip to the server, the way a shared link arrives. The sort is still there, because it was never in the component in the first place.',
          lead: 350,
          async do(page, h) {
            const firstCell = () => page.locator('.sv-grid-body [role="row"]').first().innerText()
            const sorted = (await firstCell()).trim()
            const url = page.url()
            await page.reload({ waitUntil: 'domcontentloaded' })
            await page.waitForSelector('.sv-grid-body [role="row"]', { timeout: 30_000 })
            await h.pause(1500)
            const afterReload = (await firstCell()).trim()
            if (page.url() !== url) throw new Error(`the URL changed across the reload: ${url} -> ${page.url()}`)
            if (afterReload !== sorted) {
              throw new Error(`the sort did not survive the reload: "${sorted}" became "${afterReload}"`)
            }
            h.log(`reload kept the sort: first row is still "${afterReload.slice(0, 40)}"`)
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
        await h.stage.show('editor', { file: 'src/routes/people/+page.svelte' })
      },
      beats: [
        {
          say: 'This is all of it. Three props on the grid: external sort, which tells it not to sort the rows itself, the sort the server already applied, and a callback. The callback writes the sort into the URL and navigates. The load function on the server reads those two parameters back and returns the rows in that order. There is no store, no effect, and nothing to keep in sync.',
          lead: 350,
          async do(page, h) {
            await h.stage.editor.type(
              [
                '<SvGrid',
                '  data={data.rows}',
                '  {columns}',
                '  sortable',
                '  externalSort',
                '  initialSorting={[{ id: data.sortBy, desc: data.desc }]}',
                '  {onSortingChange}',
                '/>',
                '',
                'function onSortingChange(sorting) {',
                '  const next = new URL(page.url)',
                "  next.searchParams.set('sort', sorting[0].id)",
                "  next.searchParams.set('dir', sorting[0].desc ? 'desc' : 'asc')",
                '  goto(next, { keepFocus: true, noScroll: true })',
                '}',
              ].join('\n'),
              { typeMs: 14 },
            )
            await h.pause(2200)
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
          title: 'externalSort + goto()',
          subtitle: 'The sort is a URL, so a link and a reload both work.',
          lines: ['npm create @svgrid@latest -- --template sveltekit'],
        })
      },
      beats: [
        {
          say: 'The same shape works for filtering and paging: put the state in the URL, let the load function read it, and the grid becomes a view of a page rather than the owner of it. The template has this wired already, and the grid is MIT on npm.',
          lead: 300,
        },
      ],
    },
  ],
}
