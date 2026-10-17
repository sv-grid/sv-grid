/**
 * "Is the designer a black box? (SvGrid Studio, Svelte 5 code view)."
 *
 * Filmed in the published designer (`npx svgrid-studio dev`, @svgrid/studio
 * 0.8.2 on @svgrid/enterprise 3.1.7) on a dark `init --kit 3` project: the
 * Code tab of the Manage Customer page, its generated +page.svelte, then its
 * handlers.ts. The code beat is the handlers.ts the same project holds on disk
 * (comment lines from its header and the empty onLoad), asserted against it.
 */
import { designerClip, openPage, projectFile } from './_designer.mjs'

const codeTab = (name) => (p) => p.locator('button', { hasText: name }).first().click()

export default {
  id: 'sd-code',
  series: 'SvGrid Studio designer',
  posterBeat: 1,
  caption: "Is a visual app builder a black box? In the SvGrid Studio designer every page has a Code tab: the Svelte 5 it generates (runes, SvGrid, a typed data source) and a handlers.ts that Studio writes once and never overwrites. It's your code. SvGrid Studio ships with the SvGrid Enterprise Suite.",
  hashtags: ['sveltekit', 'svelte', 'svelte5', 'webdev', 'lowcode', 'typescript', 'programming'],
  clips: {
    code: designerClip({
      prepare: openPage('/customers-manage'),
      actions: [
        { at: 0.6, run: (p) => p.locator('[role="tab"]', { hasText: 'Code' }).first().click() },
        { at: 1.8, run: codeTab('+page.svelte') },
        { at: 4.2, run: (p) => p.mouse.move(640, 700).then(() => p.mouse.wheel(0, 640)) },
        { at: 7.0, run: (p) => p.mouse.wheel(0, -640) },
        { at: 7.6, run: codeTab('handlers.ts') },
        // Save writes handlers.ts only once the page has handler code.
        { at: 8.6, run: (p) => p.locator('button', { hasText: 'Log on mount' }).first().click() },
      ],
      crop: { x: 285, y: 85, w: 580 },
      async assert(page) {
        if (!(await page.locator('button', { hasText: 'handlers.ts' }).count())) throw new Error('the Code tab did not open')
      },
    }),
    // `init` writes no handlers.ts; Save to folder is what puts it in the project.
    save: designerClip({
      prepare: openPage('/customers-manage'),
      actions: [
        { at: 0.4, run: (p) => p.getByRole('button', { name: 'Generate app' }).first().click() },
        { at: 1.5, run: (p) => p.getByRole('button', { name: 'Save to folder' }).click() },
      ],
      crop: { x: 140, y: 280, w: 720 },
      async assert(page) {
        await page.waitForTimeout(2500)
        const handlers = projectFile('src/routes/customers-manage/handlers.ts')
        if (!handlers.includes("scaffolds this file once and never overwrites it - it's yours")) throw new Error('the saved handlers.ts lacks its header')
        if (!handlers.includes("console.log('page mounted', ctx)")) throw new Error('the saved handlers.ts lacks the inserted line')
      },
    }),
  },
  beats: [
    { kind: 'title', title: 'Visual builder. ==Black box?==', sub: "SvGrid Studio's designer.", mood: 'worried',
      say: '[skeptical] Visual app builders... are usually a black box. [beat] Is this one?' },
    { kind: 'browser', clip: 'code', mood: 'neutral', cap: 'Every page has a ==Code== tab',
      say: 'Every page has a code tab. This is the Svelte five it generates. Runes, the grid, a typed data source... and a handlers file, for your own code.' },
    { kind: 'browser', clip: 'save', mood: 'neutral', cap: 'Save to the ==folder==',
      say: 'Save the app to your folder.' },
    { kind: 'code', file: 'customers-manage/handlers.ts', mood: 'happy', cap: "Written once. ==It's yours.==", size: 21,
      code: "// Your code for the \"Manage Customer\" screen.\n// SvGrid Studio scaffolds this file once and\n// never overwrites it - it's yours.\n// Design the screen visually in Studio; write\n// its behavior here.\nimport type { PageContext } from './page-context'\n\nexport async function onLoad(ctx: PageContext): Promise<void> {\n  console.log('page mounted', ctx)\n}",
      focus: [2, 3], focusAt: 0.3,
      say: "And that handlers file is written once. Studio never overwrites it. [beat] It's your code." },
    { kind: 'end', title: 'Visual, and\n==your code.==', mood: 'happy', cmd: 'npx @svgrid/studio designer',
      note: 'Studio ships with the SvGrid Enterprise Suite.',
      say: '[upbeat] SvGrid Studio. Follow for more.' },
  ],
}
