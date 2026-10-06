/**
 * Smoke test for the callout layer. Not a published video: it proves the
 * spotlight, label and pulse land on the right pixels through the recorder's
 * CSS zoom, which is the one thing that cannot be checked by assertion - the
 * rect can be correct and the overlay still drawn in the wrong place.
 *
 *   TTS_PROVIDER=silence node tools/tutorials/record.mjs callout-smoke --serve
 *
 * Then look at the frames. The ring must sit on the element the label names.
 */
export default {
  id: 'callout-smoke',
  kind: 'marketing',
  internal: true,
  title: 'callout layer smoke test',
  description: 'Internal: proves the callout spotlight, label and pulse align with their target through the recorder CSS zoom.',
  tags: ['internal'],
  view: { width: 1920, height: 1080 },

  segments: [
    {
      demo: '03-excel-filters',
      zoom: 1.25,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.pause(600)
      },
      beats: [
        {
          say: 'A callout on a column header, placed below it.',
          lead: 200,
          async do(page, h) {
            const r = await h.callout(
              page.locator('[role="columnheader"]').nth(2),
              'every column carries its own <b>filter menu</b>',
              { hold: 900 },
            )
            h.log(`header callout at ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`)
          },
          hold: 300,
        },
        {
          say: 'The same mark on a row, placed above, with no dimming.',
          lead: 200,
          async do(page, h) {
            const r = await h.callout(page.locator('.sv-grid-body [role="row"]').nth(2), 'one row of the data', {
              place: 'above',
              dim: false,
              hold: 900,
            })
            h.log(`row callout at ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`)
            await h.clearCallout()
            await h.pulse(page.locator('.sv-grid-body [role="row"]').nth(2))
          },
          hold: 400,
        },
      ],
    },
  ],
}
