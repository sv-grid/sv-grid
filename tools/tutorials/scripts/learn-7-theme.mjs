/**
 * Course lesson 7: making the grid look like your product.
 *
 * Two runnable blocks from docs/getting-started/5-theme-and-density.md carry
 * the code: --10 sets the tokens directly, --9 changes row height. The
 * dark-mode half is a demo rather than a snippet, because the block that
 * shows the attribute flip (--3) is only the toggle button - it has no grid
 * in it, so there would be nothing on screen to change colour.
 */
import { typeLines, reveal, SNIPPET_ROW } from '../lib/lesson.mjs'

const TOKENS = 'getting-started-5-theme-and-density--10'
const DENSITY = 'getting-started-5-theme-and-density--9'

export default {
  id: 'learn-7-theme',
  kind: 'course',
  title: 'Learn SvGrid 7: themes, dark mode and density',
  description: 'Lesson seven of the SvGrid course: set the CSS custom properties yourself, flip dark mode with one attribute, and change row density with a prop.',
  docsPage: 'docs/getting-started/5-theme-and-density.md',
  tags: ['svelte data grid tutorial', 'learn svgrid', 'theming', 'dark mode', 'css variables', 'svelte 5'],
  view: { width: 1920, height: 1080 },
  poster: { beat: 3 },
  gif: { beats: [2, 3] },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Learn SvGrid · lesson 7', title: 'Make it look like your product.', subtitle: 'A preset, your own tokens, one attribute for dark mode.' })
      },
      beats: [
        { say: 'A grid that looks like a grid library is a grid that never ships. Theming here is CSS custom properties, not utility classes and not a config object.', lead: 300 },
      ],
    },
    {
      stage: true,
      introHold: 0.4,
      async setup(page, h) {
        await h.stage.show('editor', { file: 'src/App.svelte', code: '' })
      },
      beats: [
        {
          say: 'Twenty presets ship with the package, and importing one stylesheet is the whole setup. What a preset sets is a list of custom properties, which means you can set them yourself when one is close but not right. Same five people as before.',
          lead: 400,
          async do(page, h) {
            await typeLines(h, TOKENS, 0, 26, 130)
          },
          hold: 250,
        },
        {
          say: 'A wrapper, and a handful of properties on it. Background, text, border, the header colours, the accent, the hover. They cascade like any other custom property, so this theme is scoped to this one grid rather than the page.',
          lead: 300,
          async do(page, h) {
            await typeLines(h, TOKENS, 26, 42, 55)
            await h.stage.editor.cursor(false)
          },
          hold: 250,
        },
        {
          say: 'The whole file, so nothing is hidden: the rows, the columns, a wrapper around the grid, and the properties on that wrapper.',
          lead: 300,
          async do(page, h) {
            await h.stage.editor.pan(0, { ms: 900 })
            await h.pause(700)
            await h.stage.editor.pan(1, { ms: 4800 })
            await h.pause(500)
          },
          hold: 300,
        },
        {
          say: 'Here is that file running. Nine declarations, and nothing about the grid was configured to accept them.',
          lead: 300,
          async do(page, h) {
            await reveal(h, TOKENS, { focus: "--sg-bg" })
            await page.waitForSelector(SNIPPET_ROW, { timeout: 30_000 })
            await h.pause(2400)
          },
          hold: 400,
        },
        {
          say: 'Density is separate from colour, and it is the setting people actually argue about. Row height is a prop, so the compact table and the comfortable one are the same component with one number changed.',
          lead: 300,
          async do(page, h) {
            await reveal(h, DENSITY, { loadMs: 600, focus: "rowHeight={28}" })
            await page.waitForSelector(SNIPPET_ROW, { timeout: 30_000 })
            await h.pause(2400)
          },
          hold: 400,
        },
      ],
      async verify(page) {
        const rows = await page.locator(SNIPPET_ROW).count()
        if (rows < 2) throw new Error(`the density snippet rendered ${rows} rows`)
        return `${rows} rows across the two density grids`
      },
    },
    {
      demo: '10-custom-cells-and-themes',
      zoom: 1.3,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'Dark mode is not a second stylesheet you maintain. Every preset declares a light palette and a dark one, and an attribute on the document element picks which is live. Every surface follows, including the parts you never styled.',
          lead: 400,
          async do(page, h) {
            const theme = page.locator('main label', { hasText: /theme/i }).first().locator('select')
            // The palette is CSS custom properties, so the root's own
            // background-color is transparent; read the token the demo sets.
            const bg = () =>
              page.evaluate(() => {
                const el = document.querySelector('.sv-grid-root') ?? document.body
                const cs = getComputedStyle(el)
                return cs.getPropertyValue('--sg-bg').trim() || cs.backgroundColor
              })
            const light0 = await bg()
            await h.selectOption(theme, 'dark')
            await h.pause(2000)
            const dark = await bg()
            if (dark === light0) throw new Error(`the dark palette did not repaint the grid (${dark})`)
            await h.selectOption(theme, 'high-contrast')
            await h.pause(1600)
            const hc = await bg()
            if (hc === dark) throw new Error('high contrast did not repaint the grid')
            await h.selectOption(theme, 'light')
            await h.pause(1400)
            h.log(`palettes: ${light0} -> ${dark} -> ${hc}`)
          },
          hold: 400,
        },
        {
          say: 'The density control here is the same row height prop behind a dropdown, which is what it usually becomes: a preference you save per user rather than a decision you make once for everybody.',
          lead: 300,
          async do(page, h) {
            const density = page.locator('main label', { hasText: /density/i }).first().locator('select')
            const rowHeight = async () =>
              (await page.locator('.sv-grid-body [role="row"]').first().boundingBox())?.height ?? 0
            await h.selectOption(density, 'compact')
            await h.pause(1700)
            const compact = await rowHeight()
            await h.selectOption(density, 'comfortable')
            await h.pause(1700)
            const comfortable = await rowHeight()
            if (!(comfortable > compact)) {
              throw new Error(`density did not change the row height (${compact} -> ${comfortable})`)
            }
            h.log(`row height: compact ${compact}px -> comfortable ${comfortable}px`)
          },
          hold: 400,
        },
      ],
      async verify(page) {
        const rows = await page.locator('.sv-grid-body [role="row"]').count()
        if (rows < 2) throw new Error(`the themes demo showed ${rows} rows`)
        return `${rows} rows through four palettes`
      },
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.8,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'Lesson 7 complete', title: 'Next: data from a server.', subtitle: 'Sort, filter and page on the backend, and what the request looks like.', lines: ['svgrid.com/theme-builder'] })
      },
      beats: [
        { say: 'The theme builder on the site edits these tokens live and hands you the CSS at the end. Every property is listed on the page below. See you in lesson eight.', lead: 300 },
      ],
    },
  ],
}
