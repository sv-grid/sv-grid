/** Marketing cut: the headless core. YouTube only, 1920x1080. */
export default {
  id: 'mk-headless',
  kind: 'marketing',
  title: 'Headless first: bring your own markup',
  description: 'SvGrid is an engine plus a renderer. Use createSvGrid for sorting, filtering and row models in your own table markup, and the virtualizer for 50,000 rows.',
  tags: ['headless table svelte', 'svelte table library', 'virtualization', 'svelte 5', 'data grid'],
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Headless-first', title: 'Bring your own markup.', subtitle: 'The engine computes the rows. You own every pixel.' })
      },
      beats: [{ say: 'Sometimes you want the logic, not the look. SvGrid separates the two.', lead: 200 }],
    },
    {
      demo: '186-headless-table',
      zoom: 1.45,
      introHold: 0.4,
      async setup(page, h) {
        await h.focusGrid()
        await h.pause(900)
      },
      beats: [
        {
          say: 'This is a hand-written table, not the grid component. createSvGrid does the sorting and the filtering; the markup is yours.',
          lead: 400,
          async do(page, h) {
            const input = page.locator('.ht-input').first()
            if (await input.count()) {
              await h.click(input)
              await h.type('a', { delay: 150 })
              await h.pause(1200)
            }
            await h.click(page.locator('.ht-table th').nth(1))
            await h.pause(1200)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '187-headless-virtual',
      zoom: 1.45,
      introHold: 0.4,
      async setup(page, h) {
        await h.focusGrid()
        await h.pause(900)
      },
      beats: [
        {
          say: 'The virtualizer is separate too: it tells you which rows are in view and where to put them, so fifty thousand rows cost about twenty nodes.',
          lead: 400,
          async do(page, h) {
            const scroller = await page.evaluate(() => {
              const el = [...document.querySelectorAll('main div')].find((d) => d.scrollHeight > d.clientHeight * 3 && d.clientHeight > 200)
              if (!el) return null
              el.setAttribute('data-tut-scroller', '1')
              return true
            })
            if (scroller) await h.easedScroll(0.4, 3400, '[data-tut-scroller]')
            else await h.pause(2500)
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
        await h.stage.show('end', { kicker: 'Two ways in', title: 'Headless when you want it. Rendered when you do not.', subtitle: 'Same row model, same features, one package.', lines: ['import { createSvGrid } from "@svgrid/grid"', 'svgrid.com/docs/help/headless/overview'] })
      },
      beats: [{ say: 'Same package, same row model, whichever half you use. Headless at svgrid.com.', lead: 200 }],
    },
  ],
}
