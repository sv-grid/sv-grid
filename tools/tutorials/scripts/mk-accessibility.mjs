/** Marketing cut: accessibility. YouTube only, 1920x1080. */
export default {
  id: 'mk-accessibility',
  kind: 'marketing',
  title: 'An accessible data grid, not a div soup',
  description: 'SvGrid renders the WAI-ARIA grid pattern on a real table: keyboard navigation everywhere, a command palette, a cheat sheet, and a high-contrast preset.',
  tags: ['accessible data grid', 'wai-aria', 'keyboard navigation', 'wcag', 'svelte data grid', 'svelte 5'],
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Accessibility', title: 'A real table. A real grid role.', subtitle: 'Keyboard first, screen reader ready, high contrast included.' })
      },
      beats: [{ say: 'Most grids are a pile of divs. This one is a table with the ARIA grid pattern on it.', lead: 200 }],
    },
    {
      demo: '17-accessibility',
      zoom: 1.45,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'Arrow keys move the active cell, Home and End jump to the row edges, Control Home goes to the corner, and the focus ring follows.',
          lead: 400,
          async do(page, h) {
            await h.clickCell(1, 1)
            await h.pause(500)
            for (const key of ['ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowDown']) {
              await h.press(key)
              await h.pause(320)
            }
            await h.press('End')
            await h.pause(700)
            await h.press('Home')
            await h.pause(600)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '65-keyboard-shortcuts',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'Control K opens a command palette over the grid, and Control slash shows every shortcut the app has bound.',
          lead: 400,
          async do(page, h) {
            await h.clickCell(1, 1)
            await h.pause(400)
            await h.press('Control+k')
            await h.pause(1600)
            await h.press('Escape')
            await h.pause(600)
            await h.press('Control+/')
            await h.pause(1700)
            await h.press('Escape')
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '96-high-contrast-theme',
      zoom: 1.45,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'And a high-contrast preset ships with it, for the procurement checklist that asks.',
          lead: 400,
          async do(page, h) {
            await h.click(page.locator('main button', { hasText: /high contrast/i }).first())
            await h.pause(1800)
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
        await h.stage.show('end', { kicker: 'Compliance', title: 'Keyboard, roles, contrast, and the paperwork.', subtitle: 'A published accessibility conformance report, and a11y tests in the suite.', lines: ['role="grid" on a real <table>', 'svgrid.com/docs/help/accessibility'] })
      },
      beats: [{ say: 'There is a published conformance report to hand to whoever asks for one. Accessibility at svgrid.com.', lead: 200 }],
    },
  ],
}
