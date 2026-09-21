/** Marketing cut: client-side scale. YouTube only, 1920x1080. */
export default {
  id: 'mk-million-rows',
  kind: 'marketing',
  title: 'A million rows in the browser',
  description: 'SvGrid virtualizes rows and columns: one million rows sorted, filtered and grouped in the browser, and 100 columns that scroll both ways.',
  tags: ['svelte data grid', 'virtualization', 'million rows', 'large dataset', 'performance', 'svelte 5'],
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Row and column virtualization', title: 'A million rows. Sixty frames.', subtitle: 'The browser draws only what is on screen. The grid keeps the rest.' })
      },
      beats: [{ say: 'How many rows can a Svelte grid hold before it slows down? Let us find out.', lead: 200 }],
    },
    {
      demo: '78-million-rows',
      zoom: 1.5,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(10)
        await h.settleRowCount()
        await h.focusGrid()
        await h.pause(600)
      },
      beats: [
        {
          say: 'One million rows, generated in the browser. Scroll anywhere; only the rows in view are drawn.',
          lead: 300,
          async do(page, h) {
            await h.easedScroll(0.45, 4000)
          },
        },
        {
          say: 'Group them by department and the same million rows fold into groups, still in place.',
          lead: 200,
          async do(page, h) {
            await h.click(page.getByRole('button', { name: /^Department$/ }).first())
            await h.pause(1800)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '06-large-dataset',
      zoom: 1.5,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.click(page.getByRole('button', { name: /50k/ }).first())
        await page.waitForFunction(() => !document.querySelector('button.ds-btn[disabled]:not(.ds-btn-on)'), null, { timeout: 60_000 }).catch(() => {})
        await h.gridReady(5)
        await h.pause(800)
      },
      beats: [
        {
          say: 'Columns virtualize too. Fifty thousand rows by seventy-seven columns scroll in both directions without a stutter.',
          lead: 300,
          async do(page, h) {
            await h.easedScrollX(0.6, 3000)
            await h.easedScroll(0.5, 3000)
          },
          hold: 400,
        },
      ],
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.6,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'Measured, not claimed', title: 'Zero dropped frames at a million rows.', subtitle: 'The benchmark harness is in the repo. Run it yourself.', lines: ['npm install @svgrid/grid', 'svgrid.com/docs/help/benchmarks'] })
      },
      beats: [{ say: 'The numbers are on the benchmarks page, with the harness that produced them. Start at svgrid.com.', lead: 200 }],
    },
  ],
}
