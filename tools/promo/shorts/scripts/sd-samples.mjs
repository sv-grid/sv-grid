/**
 * "Eighteen sample apps, one click (SvGrid Studio designer)."
 *
 * Filmed in the published designer (`npx svgrid-studio dev`, @svgrid/studio
 * 0.8.2 on @svgrid/enterprise 3.1.7). `gallery` opens Sample apps and loads
 * CRM; the CRM sample comes in light with its own preset, so `crm` switches it
 * to dark with the theme menu's own toggle, then walks its pages.
 */
import { designerClip, openPage } from './_designer.mjs'

const SAMPLES = ['CRM', 'E-commerce admin', 'Subscriptions', 'Invoicing', 'Inventory', 'Support desk', 'Recruiting', 'HR', 'Project tracker', 'Clinic', 'School', 'Events', 'Restaurant', 'Real estate', 'Fleet', 'Gym', 'Library', 'Insurance Claims']
const page_ = (route) => (p) => p.locator('.sv-studio__tree-btn', { hasText: route }).first().click()

export default {
  id: 'sd-samples',
  series: 'SvGrid Studio designer',
  posterBeat: 2,
  caption: 'Eighteen sample apps in the SvGrid Studio designer: CRM, inventory, HR, a clinic, a school and more. One click loads a whole app, dashboards, pipeline and record pages included, ready to edit and generate as SvelteKit. SvGrid Studio ships with the SvGrid Enterprise Suite.',
  hashtags: ['sveltekit', 'svelte', 'webdev', 'dashboard', 'crm', 'lowcode', 'programming'],
  clips: {
    gallery: designerClip({
      async prepare(page) {
        await openPage()(page)
      },
      actions: [
        { at: 0.4, run: (p) => p.getByRole('button', { name: 'Sample apps' }).click() },
        { at: 1.6, run: (p) => p.mouse.move(640, 700).then(() => p.mouse.wheel(0, 520)) },
        { at: 3.2, run: (p) => p.mouse.wheel(0, -520) },
        { at: 4.4, run: (p) => p.locator('button', { hasText: 'Companies, contacts' }).first().click() },
      ],
      crop: { x: 150, y: 50, w: 980 },
      async assert(page) {
        await page.waitForTimeout(1200)
        const routes = await page.locator('.sv-studio__tree-route').allInnerTexts()
        if (!routes.includes('/pipeline')) throw new Error(`CRM did not load: ${routes.join(' ')}`)
      },
    }),
    crm: designerClip({
      async prepare(page) {
        await openPage()(page)
        // The gallery lists the eighteen apps the narration counts.
        await page.getByRole('button', { name: 'Sample apps' }).click()
        for (const name of SAMPLES) {
          if (!(await page.locator('button', { hasText: name }).count())) throw new Error(`the gallery has no "${name}"`)
        }
        // Escape does not close this dialog; its own close button does.
        await page.getByRole('button', { name: 'Close' }).last().click()
        await page.waitForTimeout(300)
      },
      actions: [
        { at: 0.4, run: (p) => p.getByRole('button', { name: 'Salesforce', exact: true }).first().click() },
        { at: 1.1, run: (p) => p.getByRole('button', { name: 'Dark', exact: true }).click() },
        // The open menu covers the page tree; a click on the status bar closes it.
        { at: 1.8, run: (p) => p.mouse.click(700, 1236) },
        { at: 2.4, run: page_('/pipeline') },
        { at: 3.8, run: page_('/deal-360') },
        { at: 5.2, run: page_('/forecast') },
      ],
      crop: { x: 0, y: 50, w: 980 },
      async assert(page) {
        const routes = await page.locator('.sv-studio__tree-route').allInnerTexts()
        if (routes.length < 10) throw new Error(`CRM has ${routes.length} pages`)
      },
    }),
  },
  beats: [
    { kind: 'title', title: 'A whole app. ==One click.==', sub: "Eighteen sample apps in SvGrid Studio's designer.", mood: 'neutral',
      say: "[excited] Don't start from a blank page. [beat] Start from a whole app." },
    { kind: 'browser', clip: 'gallery', mood: 'happy', cap: '==18== sample apps',
      say: 'Eighteen sample apps. A CRM, inventory, HR, a clinic, a school... Open the CRM.' },
    { kind: 'browser', clip: 'crm', mood: 'happy', cap: 'Every page, ==ready to edit==',
      say: '[impressed] Dark mode on. Dashboards, a pipeline, a deal page, a forecast... every page, ready to edit.' },
    { kind: 'end', title: 'Start from\n==a whole app.==', mood: 'happy', cmd: 'npx @svgrid/studio designer',
      note: 'Studio ships with the SvGrid Enterprise Suite.',
      say: '[upbeat] SvGrid Studio. Follow for more.' },
  ],
}
