/** Marketing cut: connecting the grid to an API. YouTube only, 1920x1080. */
export default {
  id: 'mk-rest-api',
  kind: 'marketing',
  title: 'Connect a Svelte data grid to your API',
  description: 'Point SvGrid at a REST endpoint: server sort, filter and paging over a live public API, cursor pagination, and a loading state that does not flicker.',
  tags: ['svelte data grid rest api', 'server side data', 'pagination', 'sveltekit', 'svelte 5'],
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Real data', title: 'Point it at your API.', subtitle: 'Sort, filter and page on the server. The grid sends the request.' })
      },
      beats: [{ say: 'A demo with hard-coded rows proves nothing. This one is talking to a real endpoint over the network.', lead: 200 }],
    },
    {
      demo: '497-live-rest-dummyjson',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4, 90_000)
        await h.focusGrid()
        await h.pause(1000)
      },
      beats: [
        {
          say: 'Every page turn is an HTTP request. The grid asks for the slice it needs, and the adapter maps your response shape to rows and a total.',
          lead: 400,
          async do(page, h) {
            const next = page.locator('main button', { hasText: /next/i }).first()
            if (await next.count()) {
              await h.click(next)
              await h.pause(1600)
              await h.click(next)
              await h.pause(1600)
            }
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '113-cursor-pagination',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.focusGrid()
        await h.pause(800)
      },
      beats: [
        {
          say: 'Cursor APIs work the same way: the grid keeps the cursor your backend returned and asks for what follows it.',
          lead: 400,
          async do(page, h) {
            const next = page.locator('main button', { hasText: /next/i }).first()
            await h.click(next)
            await h.pause(1400)
            await h.click(next)
            await h.pause(1400)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '09-server-side',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.focusGrid()
        await h.pause(800)
      },
      beats: [
        {
          say: 'Sorting and searching go the same way, debounced, with the loading state on the rows rather than a spinner over the page.',
          lead: 400,
          async do(page, h) {
            const search = page.locator('input[placeholder*="name" i]').first()
            if (await search.count()) {
              await h.click(search)
              await h.type('an', { delay: 150 })
              await h.pause(1800)
            }
            await h.click(page.locator('[role="columnheader"]').nth(1))
            await h.pause(1400)
          },
          hold: 500,
        },
      ],
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.6,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'Any backend', title: 'REST, GraphQL, SQL, Supabase.', subtitle: 'One request shape the grid sends, and a planner that turns it into SQL.', lines: ['createServerDataSource({ getRows })', 'svgrid.com/docs/help/server-side-data'] })
      },
      beats: [{ say: 'REST, GraphQL, SQL or Supabase, it is one function you implement. Server data at svgrid.com.', lead: 200 }],
    },
  ],
}
