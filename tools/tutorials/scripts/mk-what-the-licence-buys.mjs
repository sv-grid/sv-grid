/**
 * D3: the video for /pricing - 125 impressions at position 5.5 and zero clicks.
 *
 * A pricing page already lists the features. What it cannot do is show them
 * running, so this video answers "what does $599 actually get me" by pointing
 * at working software rather than at a feature table.
 *
 * Every price and tier claim here is read from website/src/routes/Pricing.svelte
 * (2026-10-06): Community MIT and free, Enterprise $599 per developer, Suite
 * $999 per developer, both perpetual with an optional yearly renewal, both
 * unlimited production apps. Nothing is rounded or remembered.
 *
 * The trial segment sets `watermark: true`, so the unlicensed watermark is in
 * the frame while the narration describes it. Saying "it runs unlicensed with a
 * watermark" over a watermark-free recording is the gap this avoids.
 */
import { firstRow } from '../lib/lesson.mjs'

export default {
  id: 'mk-what-the-licence-buys',
  kind: 'marketing',
  title: 'What the SvGrid licence actually buys you',
  description: 'What is free, what Enterprise adds at $599 and what Suite adds at $999, shown as working software rather than a feature table.',
  tags: ['svelte data grid', 'pricing', 'licensing', 'enterprise', 'svelte 5', 'data grid licence'],
  // Narrated on the page: 3 minutes is watched once, not looped silently.
  player: true,
  view: { width: 1920, height: 1080 },
  poster: { beat: 2 },
  gif: { beats: [3, 3] },

  segments: [
    {
      stage: true,
      introHold: 0.7,
      async setup(page, h) {
        await h.stage.show('title', {
          kicker: 'Pricing',
          title: 'What the licence actually buys.',
          subtitle: 'Not a feature table. The features, running.',
        })
      },
      beats: [
        {
          say: 'Every component library has a pricing page, and every pricing page is a wall of ticks. Here is the same thing shown as software, so you can see what you would be paying for before you decide whether it is worth it.',
          lead: 300,
        },
      ],
    },

    // ---- Free -------------------------------------------------------------
    {
      demo: '03-excel-filters',
      zoom: 1.25,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.pause(500)
      },
      beats: [
        {
          say: 'Start with what costs nothing. The grid itself is MIT on npm. Sorting, Excel-style filters per column, inline editing, grouping with totals, row and column virtualization, keyboard navigation and screen reader support. There is no key to install, no sign-up, and no row cap waiting to stop you at ten thousand.',
          lead: 350,
          async do(page, h) {
            // Open the menu rather than ringing a header: the beat claims a
            // filter menu per column, and a header with no menu on it does not
            // show that. The first take ringed a bare header and the frame did
            // not support the sentence being said over it.
            await h.clickHeaderFilter(/Country/)
            await page.waitForSelector('[role="listbox"][aria-label="Filter values"] [role="option"]', { timeout: 10_000 })
            const values = page.locator('[role="listbox"][aria-label="Filter values"] [role="option"]')
            const n = await values.count()
            if (n < 2) throw new Error(`the filter menu listed ${n} values`)
            h.log(`filter menu open with ${n} values from the column`)
            await h.callout(values.first().locator('xpath=ancestor::*[@role="listbox"]'), 'the values that are actually in the column', {
              hold: 1600,
            })
            await h.clearCallout()
            await page.keyboard.press('Escape')
            await h.pause(400)
          },
          hold: 300,
        },
      ],
    },
    {
      demo: '78-million-rows',
      zoom: 1.2,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.pause(600)
      },
      beats: [
        {
          say: 'That includes the part people assume is the paid tier. This is a million rows in the browser, scrolling, in the free package. The number of DOM nodes stays about what it was with ten.',
          lead: 300,
          async do(page, h) {
            const before = await firstRow(page)
            await h.easedScrollBy(5200, 2400)
            const after = await firstRow(page)
            if (after === before) throw new Error(`the million-row demo did not scroll (first row stayed ${before})`)
            h.log(`million rows: first visible row ${before} -> ${after}`)
            await h.pause(700)
          },
          hold: 300,
        },
      ],
    },

    // ---- Enterprise, with the real watermark -------------------------------
    {
      demo: '467-server-row-model-1m',
      zoom: 1.2,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.pause(500)
      },
      beats: [
        {
          say: 'Now the paid pack. What it adds, at five hundred and ninety nine dollars per developer, starts with the server side row model. The grid asks your backend for one block of rows at a time, so the table on screen is a window onto a database rather than a copy of it. The panel on the right is every request as it goes out.',
          lead: 300,
          async do(page, h) {
            // Not firstRow(): this demo is grouped, so the first visible row is
            // a sticky group header that does not move when you scroll. The
            // demo's own request log is the thing the narration is claiming -
            // new blocks fetched on demand - so assert on that instead.
            const requests = () => page.locator('.log-row').count()
            const before = await requests()
            await h.easedScrollBy(4200, 2200)
            await h.pause(900)
            const after = await requests()
            if (after <= before) throw new Error(`scrolling fetched no new blocks (${before} -> ${after} logged requests)`)
            h.log(`server row model: ${before} -> ${after} block requests while scrolling`)
            await h.callout('.log', 'one block per request, on demand', { hold: 1400 })
            await h.clearCallout()
          },
          hold: 300,
        },
      ],
    },
    {
      demo: '360-pivot-mode-grid',
      zoom: 1.2,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.pause(700)
      },
      beats: [
        {
          say: 'The same licence turns the grid into a pivot table, with a designer you drag fields into, and an exporter that writes real Excel files and PDFs rather than a comma separated file with an xls extension on it.',
          lead: 300,
          async do(page, h) {
            await h.callout(page.locator('[role="columnheader"]').first(), 'the same grid, pivoted', { hold: 1300 })
            await h.clearCallout()
            await h.pause(400)
          },
          hold: 300,
        },
      ],
    },
    {
      demo: '343-kanban-board',
      zoom: 1.45,
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.sv-board-card', { timeout: 30_000 })
        await h.pause(700)
      },
      beats: [
        {
          say: 'And it is the licence that turns those same rows into a Kanban board, or a scheduler, by passing one more prop to the grid you already have. They are not separate products with their own data model to learn. Both tiers cover an unlimited number of deployed applications, so this is per developer, not per app.',
          lead: 350,
          async do(page, h) {
            const cards = await page.locator('.sv-board-card').count()
            if (cards < 2) throw new Error(`the board rendered ${cards} cards`)
            h.log(`board: ${cards} cards in lanes`)
            await h.callout(page.locator('.sv-board-card').first(), 'the same rows, as cards', { hold: 1300 })
            await h.clearCallout()
          },
          hold: 300,
        },
      ],
    },

    // ---- Suite -------------------------------------------------------------
    {
      demo: '490-sheet-let-lambda',
      zoom: 1.15,
      introHold: 0.4,
      // No licence beat here any more. The unlicensed nudge was meant to be
      // the proof, but it does not fire reliably on this demo: a probe found
      // zero .sv-grid elements in the sheet, which is what the watermark
      // attaches to, and no console nudge either. It appeared on one take out
      // of four. A beat whose visual shows up at random is not a beat, so the
      // trial claim moved to the end card, where it needs nothing on screen.
      async setup(page, h) {
        await page.waitForSelector('.sv-sheet, .sv-ribbon', { timeout: 40_000 })
        await h.pause(1200)
      },
      beats: [
        {
          say: 'Nine hundred and ninety nine dollars buys one more thing, and it is the one piece that is genuinely its own product. A spreadsheet: a ribbon, a formula bar, sheet tabs, a formula engine with named ranges and LAMBDA, and codecs that open and save real workbooks. That is why it sits in its own tier rather than being another grid prop.',
          lead: 350,
          async do(page, h) {
            await h.pause(2600)
          },
          hold: 400,
        },
      ],
    },

    {
      demo: '200-studio-dashboard',
      zoom: 1.15,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(1800)
      },
      beats: [
        {
          say: 'The same tier includes Studio, which points at a database or a schema and writes a SvelteKit application you own and keep editing. Source in your repository, not a runtime you ship.',
          lead: 300,
          async do(page, h) {
            await h.pause(2200)
          },
          hold: 400,
        },
      ],
    },

    // ---- End ---------------------------------------------------------------
    {
      stage: true,
      introHold: 0.5,
      outroHold: 2,
      async setup(page, h) {
        await h.stage.show('end', {
          kicker: 'Perpetual licence',
          title: 'Free. $599. $999.',
          subtitle: 'Per developer, unlimited apps. Buy once and keep it forever.',
          lines: ['svgrid.com/pricing'],
        })
      },
      beats: [
        {
          say: 'Two last things, because both are unusual. You do not need a key to try any of the paid pack. Install it and use it, and it runs in full: nothing disabled, nothing capped, and no clock running out. What you get instead is a watermark and a line in the console, and setting a key removes them. And it is a perpetual licence, not a rental. You buy it once and the version you have keeps working forever. The yearly renewal only pays for new updates and support, you can cancel any time, and you keep every version released while you were paying. The grid underneath all of it is still MIT.',
          lead: 350,
        },
      ],
    },
  ],
}
