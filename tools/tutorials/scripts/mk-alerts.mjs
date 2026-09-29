/** Marketing cut: no-code alert rules on grid data. YouTube only, 1920x1080. */
export default {
  id: 'mk-alerts',
  kind: 'marketing',
  title: 'Alert rules your users write themselves',
  description: 'Let users define rules over grid data at run time: raise a toast, tint a row, flash a cell, watch a whole-table total, or veto an edit that breaks a limit.',
  tags: ['alert rules', 'conditional formatting', 'real time dashboard', 'svelte data grid', 'svelte 5'],
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Rules at run time', title: 'Alerts your users write.', subtitle: 'No deploy. No code. On the rows already on screen.' })
      },
      beats: [{ say: 'The rule a user needs tomorrow is never the one you shipped today. So let them write it.', lead: 200 }],
    },
    {
      demo: '399-alert-rules-engine',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(1000)
      },
      beats: [
        {
          say: 'A live trading desk with rules watching it. When a row matches, the rule raises a toast, tints the row or flashes the cell.',
          lead: 400,
          async do(page, h) {
            await h.hover(page.locator('.sv-grid-body [role="row"]').nth(2))
            await h.pause(3000)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '401-alert-aggregate-kpi',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.focusGrid()
        await h.pause(900)
      },
      beats: [
        {
          say: 'Rules can watch an aggregate rather than a row: a total, an average, a count across the whole table.',
          lead: 400,
          async do(page, h) {
            await h.park(undefined, undefined, { ms: 600 })
            await h.pause(2600)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '402-alert-validation-guardrails',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.focusGrid()
        await h.pause(900)
      },
      beats: [
        {
          say: 'And a validation rule runs on edit, so a change that breaks a limit is refused before it lands.',
          lead: 400,
          async do(page, h) {
            await h.dblclickCell(1, 2)
            await h.press('Control+A')
            await h.type('999999', { delay: 90 })
            await h.press('Enter')
            await h.pause(1800)
            await h.press('Escape')
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
        await h.stage.show('end', { kicker: 'Expression engine', title: 'Rules are data, not deploys.', subtitle: 'Authored in a builder, stored as JSON, evaluated with a push observer model.', lines: ['alerts={{ rules }}', 'svgrid.com/docs/help/alerts'] })
      },
      beats: [{ say: 'Rules are stored as data, so users keep their own and you ship nothing. Alerts at svgrid.com.', lead: 200 }],
    },
  ],
}
