/**
 * "Twenty design systems, one click (SvGrid Studio designer, SvelteKit 3)."
 *
 * Filmed in the published designer (`npx svgrid-studio dev`, @svgrid/studio
 * 0.8.2 on @svgrid/enterprise 3.1.7) on a dark `init --kit 3` project. Presets
 * are picked from the designer's own theme menu; `save` writes the app with
 * Save to folder, and `app` films the generated SvelteKit 3 app that the same
 * `studio dev` runs, after its hot reload.
 */
import { designerClip, openPage, projectFile } from './_designer.mjs'

const PRESETS = ['Ember', 'shadcn/ui', 'Tailwind', 'Material 3', 'Excel', 'Fluent 2', 'Carbon', 'SAP Fiori', 'Salesforce', 'Atlassian', 'GitHub', 'Ant Design', 'Alpine', 'Bootstrap 5', 'Vercel', 'Linear', 'Notion', 'Nord', 'Dracula', 'Catppuccin']
/** A preset tile in the open theme menu, by its visible name. */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const tile = (p, name) => p.locator('button').filter({ hasText: new RegExp(`^\\s*${escapeRe(name)}\\s*$`) }).last()
const pick = (name) => (p) => tile(p, name).click()

export default {
  id: 'sd-themes',
  series: 'SvGrid Studio designer',
  posterBeat: 1,
  caption: 'Twenty design-system presets in the SvGrid Studio designer: pick one and the whole app restyles, light or dark. Save to folder and the generated SvelteKit 3 app runs in it. SvGrid Studio ships with the SvGrid Enterprise Suite.',
  hashtags: ['sveltekit', 'sveltekit3', 'svelte', 'webdev', 'designsystem', 'darkmode', 'programming'],
  clips: {
    presets: designerClip({
      async prepare(page) {
        await openPage()(page)
        await page.getByRole('button', { name: 'Ember', exact: true }).first().click()
        await page.waitForTimeout(300)
        for (const name of PRESETS) {
          if (!(await tile(page, name).count())) throw new Error(`the theme menu has no "${name}" preset`)
        }
      },
      actions: [
        { at: 0.9, run: pick('shadcn/ui') },
        { at: 2.0, run: pick('Material 3') },
        { at: 3.1, run: pick('Carbon') },
        { at: 4.2, run: pick('GitHub') },
        { at: 5.3, run: pick('Nord') },
        { at: 6.4, run: pick('Dracula') },
      ],
      crop: { x: 280, y: 0, w: 700 },
      async assert(page) {
        await page.waitForTimeout(1200)
        if (!/"preset": "dracula"/.test(projectFile('studio.config.json'))) throw new Error('Dracula did not reach studio.config.json')
      },
    }),
    mode: designerClip({
      async prepare(page) {
        await openPage()(page)
        await page.getByRole('button', { name: 'Dracula', exact: true }).first().click()
        await page.waitForTimeout(300)
      },
      actions: [
        { at: 0.5, run: (p) => p.getByRole('button', { name: 'Light', exact: true }).click() },
        { at: 1.6, run: (p) => p.getByRole('button', { name: 'Dark', exact: true }).click() },
      ],
      crop: { x: 280, y: 0, w: 700 },
      async assert(page) {
        await page.waitForTimeout(1200)
        if (!/"mode": "dark"/.test(projectFile('studio.config.json'))) throw new Error('the project did not end in dark mode')
      },
    }),
    save: designerClip({
      prepare: openPage(),
      actions: [
        { at: 0.4, run: (p) => p.getByRole('button', { name: 'Generate app' }).first().click() },
        { at: 1.5, run: (p) => p.getByRole('button', { name: 'Save to folder' }).click() },
      ],
      crop: { x: 140, y: 280, w: 720 },
      async assert(page) {
        await page.waitForTimeout(2500)
        // Dracula's accent, written as an --sg-* token.
        if (!/--sg-accent: #bd93f9/.test(projectFile('src/app.css'))) throw new Error('the saved app.css does not carry the Dracula tokens')
      },
    }),
    app: {
      app: 'designerApp',
      path: '/customers-overview',
      viewport: 1200,
      async assert(page) {
        const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sg-accent').trim().toLowerCase())
        if (accent !== '#bd93f9') throw new Error(`the running app's accent is ${accent}, not Dracula's`)
      },
    },
  },
  beats: [
    { kind: 'title', title: 'Twenty design systems. ==One click.==', sub: "SvGrid Studio's designer.", mood: 'neutral',
      say: '[excited] Twenty design systems... [beat] one click each.' },
    { kind: 'browser', clip: 'presets', mood: 'happy', cap: 'Pick a ==preset==',
      say: 'Pick a preset, and the whole app restyles. The grid, the chart, the buttons... every time.' },
    { kind: 'browser', clip: 'mode', mood: 'happy', cap: 'Light or ==dark==', hold: 1,
      say: 'Light or dark is one switch.' },
    { kind: 'browser', clip: 'save', mood: 'neutral', cap: 'Save it to the ==folder==',
      say: 'Save it to your folder...' },
    { kind: 'browser', clip: 'app', mood: 'happy', cap: 'The ==SvelteKit 3== app, restyled',
      say: '[impressed] and the running SvelteKit three app is in the new theme.' },
    { kind: 'end', title: 'Your design system,\n==one click.==', mood: 'happy', cmd: 'npx @svgrid/studio designer',
      note: 'Studio ships with the SvGrid Enterprise Suite.',
      say: '[upbeat] SvGrid Studio. Follow for more.' },
  ],
}
