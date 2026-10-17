/**
 * "A server rule, no code (SvGrid Studio designer, SvelteKit 3)."
 *
 * Filmed in the published designer (`npx svgrid-studio dev`, @svgrid/studio
 * 0.8.2 on @svgrid/enterprise 3.1.7) on a dark `init --kit 3` project. The rule
 * is built with the inspector's own controls; `save` clicks Generate app, then
 * Save to folder, and asserts the route it wrote carries the compiled check.
 * The code beat is that file; the curl lines are the generated app's answers on
 * 2026-10-11 (Date/Vary/keep-alive headers trimmed).
 *
 * The inspector also prints a note that rules only run on a SQL source. That
 * note is stale for in-memory data since 2026-10-09 (the 422 below is an
 * in-memory app), so the crop frames the rule editor, not the note.
 */
import { designerClip, openPage, reveal, rulesSection, projectFile, maximizeInspector } from './_designer.mjs'

const RULE_MSG = 'An order needs a total above zero'

export default {
  id: 'sd-rules',
  series: 'SvGrid Studio designer',
  posterBeat: 1,
  caption: 'A server-side business rule without writing it: in the SvGrid Studio designer, Orders > Server rules > Before create > Reject when total <= 0. Generate the SvelteKit 3 app and the rule is a hook on the API route, so a POST that skips the form still gets a 422. SvGrid Studio ships with the SvGrid Enterprise Suite.',
  hashtags: ['sveltekit', 'sveltekit3', 'svelte', 'webdev', 'lowcode', 'api', 'programming'],
  clips: {
    build: designerClip({
      async prepare(page) {
        await openPage('/orders-manage')(page)
        await maximizeInspector(page)
        const rules = rulesSection(page)
        await rules.locator(':scope > summary').click()
        await reveal(rules.locator('details.sv-studio__section--sub').first(), 60)
      },
      actions: [
        { at: 0.6, run: (p) => rulesSection(p).locator('details.sv-studio__section--sub').first().locator(':scope > summary').click() },
        { at: 1.5, run: (p) => rulesSection(p).locator('details.sv-studio__section--sub').first().getByRole('button', { name: 'Reject when...' }).click() },
        { at: 2.6, run: (p) => rulesSection(p).locator('details.sv-studio__section--sub').first().locator('select').nth(1).selectOption('total') },
        { at: 3.5, run: (p) => rulesSection(p).locator('details.sv-studio__section--sub').first().locator('select').nth(2).selectOption('lte') },
        { at: 4.3, run: (p) => rulesSection(p).locator('details.sv-studio__section--sub').first().locator('input').nth(0).fill('0') },
        { at: 5.2, run: (p) => rulesSection(p).locator('details.sv-studio__section--sub').first().locator('input').nth(1).fill(RULE_MSG) },
        { at: 5.8, run: (p) => rulesSection(p).locator('details.sv-studio__section--sub').first().locator('input').nth(1).press('Tab') },
      ],
      // Below the inspector's stale "SQL only" note; ends on the message and the compiled check.
      // A camera on the rule row: the field, then across to "<= 0" while it is
      // filled, then back for the message and the compiled check under it.
      crop: [
        { at: 0, x: 0, y: 58, w: 640 }, { at: 2.9, x: 0, y: 58, w: 640 },
        { at: 3.4, x: 380, y: 58, w: 640 }, { at: 4.8, x: 380, y: 58, w: 640 },
        { at: 5.3, x: 0, y: 58, w: 640 }, { at: 6.2, x: 0, y: 58, w: 640 },
        { at: 7.0, x: 0, y: 110, w: 620 },
      ],
      async assert(page) {
        const code = await rulesSection(page).locator('details.sv-studio__section--sub').first().locator('pre').innerText()
        if (!code.includes("Number(v?.['total']) <= Number(0)") || !code.includes(RULE_MSG)) throw new Error(`the compiled rule reads: ${code}`)
      },
    }),
    save: designerClip({
      prepare: openPage('/orders-manage'),
      actions: [
        { at: 0.5, run: (p) => p.getByRole('button', { name: 'Generate app' }).first().click() },
        { at: 1.9, run: (p) => p.getByRole('button', { name: 'Save to folder' }).click() },
      ],
      crop: { x: 140, y: 280, w: 720 },
      async assert(page) {
        await page.waitForTimeout(2500)
        const route = projectFile('src/routes/api/orders/+server.ts')
        if (!route.includes('beforeCreate') || !route.includes(RULE_MSG)) throw new Error('the saved orders route has no rule hook')
        if (!projectFile('package.json').includes('"@sveltejs/kit": "^3')) throw new Error('the saved app is not SvelteKit 3')
      },
    }),
  },
  beats: [
    { kind: 'title', title: 'A server rule. ==No code.==', sub: "SvGrid Studio's designer, on SvelteKit 3.", mood: 'neutral',
      say: '[excited] A business rule on your server... [beat] without writing it.' },
    { kind: 'browser', clip: 'build', mood: 'determined', cap: 'Reject when ==total ≤ 0==',
      say: 'Orders, server rules, before create. Reject when the total is zero or less... and say why.' },
    { kind: 'browser', clip: 'save', mood: 'neutral', cap: 'Generate the ==SvelteKit 3== app',
      say: 'Generate the app into your folder.' },
    { kind: 'code', file: 'routes/api/orders/+server.ts', mood: 'happy', cap: 'A hook on the ==API route==', size: 22,
      code: "export const { POST } = createKitHandlers({\n  schema: ordersSchema,\n  source,\n  validate: true,\n  hooks: {\n    beforeCreate: async ({ values }) => {\n      const v = values as Record<string, unknown>\n      if (Number(v?.['total']) <= Number(0))\n        throw new Error('An order needs a total above zero')\n    },\n  },\n})",
      focus: [6, 8, 9], focusAt: 0.35,
      say: "Here's what it wrote: a before create hook on the API route. The same check, in plain TypeScript." },
    { kind: 'terminal', mood: 'worried', cap: 'Skip the form: !!422!!', minHeight: 640,
      lines: [
        { cmd: `curl -i -X POST localhost:4341/api/orders -H 'content-type: application/json' -d '{"kind":"mutate","op":"create","input":{"reference":"SO-9002","customer_id":"cu1","total":0,"status":"pending"}}'`, at: 0 },
        { text: 'HTTP/1.1 422 Unprocessable Entity', cls: 'err', at: 0.5 },
        { text: '{"error":"An order needs a total above zero"}', cls: 'err', at: 0.58 },
      ],
      say: '[tense] Post an order with a zero total, straight to the API... [beat] four twenty two. The server says no.' },
    { kind: 'end', title: 'Server rules,\n==no code.==', mood: 'happy', cmd: 'npx @svgrid/studio designer',
      note: 'Studio ships with the SvGrid Enterprise Suite.',
      say: '[upbeat] SvGrid Studio. Follow for more.' },
  ],
}
