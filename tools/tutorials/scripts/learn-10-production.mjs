/**
 * Course lesson 10: the checks before this ships.
 *
 * Demo-driven rather than typed: each point is something you verify in a
 * running grid rather than a line you add. The TypeScript note is the one
 * exception and comes from docs/getting-started/6-going-to-production.md.
 */
import { activeCell } from '../lib/lesson.mjs'

export default {
  id: 'learn-10-production',
  kind: 'course',
  title: 'Learn SvGrid 10: going to production',
  description: 'Lesson ten: virtualization, the accessibility you already have, server-rendered markup, and the TypeScript habit that prevents blank columns.',
  docsPage: 'docs/getting-started/6-going-to-production.md',
  tags: ['svelte data grid tutorial', 'learn svgrid', 'virtualization', 'accessibility', 'production', 'svelte 5'],
  view: { width: 1920, height: 1080 },
  poster: { beat: 2 },
  gif: { beats: [1, 2] },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Learn SvGrid · lesson 10', title: 'Before this ships.', subtitle: 'Scale, accessibility, server rendering, and one TypeScript habit.' })
      },
      beats: [
        { say: 'Your grid works. This last lesson is the review a colleague would give it: the four things that decide whether it survives contact with real data and real users.', lead: 300 },
      ],
    },
    {
      demo: '06-large-dataset',
      zoom: 1.45,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(800)
      },
      beats: [
        {
          say: 'First, scale. Virtualization is on by default, so only the rows in view have DOM nodes. Fifty thousand rows by seventy-seven columns scroll in both directions, and the count of nodes stays roughly the same as it was with ten rows.',
          lead: 400,
          async do(page, h) {
            await h.easedScroll(0.4, 3000)
            await h.pause(400)
            await h.easedScrollX(0.5, 2400)
          },
          hold: 400,
        },
        {
          say: 'What you do have to give it is a height. A grid inside a container with no height cannot know what is on screen, and that is the single most common reason a large table feels slow.',
          lead: 300,
          async do(page, h) {
            await h.easedScroll(0.7, 2200)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '17-accessibility',
      zoom: 1.45,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(800)
      },
      beats: [
        {
          say: 'Second, accessibility, which you mostly already have. It is a real table element carrying the ARIA grid pattern, so a screen reader announces rows and columns, and every cell is reachable from the keyboard.',
          lead: 400,
          async do(page, h) {
            await h.clickCell(1, 1)
            await h.pause(600)
            const start = await activeCell(page, '')
            for (const key of ['ArrowDown', 'ArrowRight', 'ArrowDown']) {
              await h.press(key)
              await h.pause(420)
            }
            const moved = await activeCell(page, '')
            if (!start || moved === start) throw new Error(`arrow keys did not move the active cell (${start} -> ${moved})`)
            await h.press('End')
            await h.pause(800)
            const end = await activeCell(page, '')
            if (end === moved) throw new Error('End did not jump to the end of the row')
            h.log(`keyboard: ${start} -> ${moved} -> End ${end}`)
          },
          hold: 400,
        },
        {
          say: 'What is on you is the rest of the page: a label on the grid, contrast that passes, and not removing the focus ring. There is a high-contrast preset in the box if procurement asks.',
          lead: 300,
          async do(page, h) {
            await h.park(undefined, undefined, { ms: 600 })
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
        await h.stage.show('end', { kicker: 'Course complete', title: 'Type your columns. Ship it.', subtitle: 'GridColumns<Row> checks every field name; a bare GridColumns stops checking and a typo becomes a blank column.', lines: ['svgrid.com/docs/getting-started/6-going-to-production', 'svgrid.com/demos'] })
      },
      beats: [
        {
          say: 'Third, the markup server-renders, so a viewport of real rows reaches the browser before hydration. And fourth, the habit that costs nothing: type the column array as GridColumns of your row. A bare GridColumns widens the row and stops checking field names, and a typo becomes a blank column nobody notices until a user does.',
          lead: 300,
        },
        {
          say: 'That is the course. You can build a grid, shape its columns, sort and filter it, edit it, group it, theme it, feed it from a server and ship it. Everything past this point is a feature you turn on when you need it, and the demos on the site show each one running.',
          lead: 300,
        },
      ],
    },
  ],
}
