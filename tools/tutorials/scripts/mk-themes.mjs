/**
 * Marketing cut: theming. The same demo recorded under four presets, so the
 * viewer sees one grid wearing four design systems. YouTube only, 1920x1080.
 */
const themeSegment = (preset, say, lead = 400) => ({
  demo: '10-custom-cells-and-themes',
  preset,
  zoom: 1.4,
  introHold: 0.35,
  async setup(page, h) {
    await h.gridReady(5)
    await h.focusGrid()
    await h.pause(700)
  },
  beats: [
    {
      say,
      lead,
      async do(page, h) {
        await h.easedScroll(0.35, 2200)
      },
      hold: 350,
    },
  ],
})

export default {
  id: 'mk-themes',
  kind: 'marketing',
  title: 'One grid, twenty themes',
  description: 'SvGrid themes are CSS custom properties, so the same grid wears your design system: twenty presets, light and dark, plus density and a live theme builder.',
  tags: ['svelte data grid theme', 'dark mode', 'design tokens', 'shadcn table', 'svelte 5'],
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Theming', title: 'One grid. Your design system.', subtitle: 'Tokens, not utility classes. Twenty presets, light and dark.' })
      },
      beats: [{ say: 'A grid that looks like a grid library is a grid that never ships. SvGrid is themed with CSS variables.', lead: 200 }],
    },
    themeSegment('ember', 'This is the same demo, the same markup, under four presets. Here is the signature one.'),
    themeSegment('shadcn', 'The same grid in a shadcn-flavoured palette. Nothing changed but the tokens.'),
    themeSegment('material', 'Material, with its own density and radius.'),
    themeSegment('excel', 'And a spreadsheet look, for users who expect one.'),
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.6,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'Build your own', title: 'Twenty presets, or your tokens.', subtitle: 'Every colour, radius and density is a --sg- custom property. Dark mode is an attribute.', lines: ['import "@svgrid/grid/themes/shadcn.css"', 'svgrid.com/theme-builder'] })
      },
      beats: [{ say: 'Start from a preset or set the tokens yourself in the theme builder at svgrid.com.', lead: 200 }],
    },
  ],
}
