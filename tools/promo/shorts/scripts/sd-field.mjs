/**
 * "Add a field in the designer; the SvelteKit 3 app has it (SvGrid Studio)."
 *
 * Filmed in the published designer (`npx svgrid-studio dev`, @svgrid/studio
 * 0.8.2 on @svgrid/enterprise 3.1.7) on a dark `init --kit 3` project. The
 * fields list sits far below the canvas, so `add` is filmed in a tall window
 * and the crop frames the list. `save` writes the app; `app` is the generated
 * SvelteKit 3 app `studio dev` runs, after its hot reload, asserted to carry the
 * new column and the new form input.
 */
import { designerClip, openPage, fieldsSection, projectFile } from './_designer.mjs'

const newRow = (p) => fieldsSection(p).locator('li.sv-studio__field').last()

export default {
  id: 'sd-field',
  series: 'SvGrid Studio designer',
  posterBeat: 3,
  caption: 'Add a field in the SvGrid Studio designer: Customers gets a phone field with a phone input. Save to folder and the running SvelteKit 3 app has it, in the schema and in the create form, country code included. SvGrid Studio ships with the SvGrid Enterprise Suite.',
  hashtags: ['sveltekit', 'sveltekit3', 'svelte', 'webdev', 'lowcode', 'crud', 'programming'],
  clips: {
    add: designerClip({
      height: 2900,
      prepare: openPage('/customers-manage'),
      actions: [
        { at: 0.6, run: (p) => fieldsSection(p).locator('.sv-studio__sec-add').click() },
        { at: 1.6, run: (p) => newRow(p).locator('input.sv-studio__field-name').fill('phone') },
        { at: 2.4, run: (p) => newRow(p).locator('input.sv-studio__field-name').press('Tab') },
        { at: 3.2, run: (p) => newRow(p).locator('select[aria-label="Form control"]').selectOption({ label: 'Phone' }) },
      ],
      crop: { x: 680, y: 2160, w: 600 },
      async assert(page) {
        await page.waitForTimeout(1200)
        if (!/"field": "phone"/.test(projectFile('studio.config.json'))) throw new Error('the phone field did not reach studio.config.json')
      },
    }),
    save: designerClip({
      prepare: openPage('/customers-manage'),
      actions: [
        { at: 0.4, run: (p) => p.getByRole('button', { name: 'Generate app' }).first().click() },
        { at: 1.5, run: (p) => p.getByRole('button', { name: 'Save to folder' }).click() },
      ],
      crop: { x: 140, y: 280, w: 720 },
      async assert(page) {
        await page.waitForTimeout(2500)
        if (!/phone: string/.test(projectFile('src/lib/schemas.ts'))) throw new Error('the saved schemas.ts has no phone field')
      },
    }),
    app: {
      app: 'designerApp',
      path: '/customers-manage',
      viewport: 1200,
      actions: [
        { at: 0.8, run: (p) => p.getByRole('button', { name: /New Customer/ }).first().click() },
        { at: 1.8, run: (p) => p.fill('#sv-ef-name', 'Kestrel Robotics') },
        { at: 2.8, run: (p) => p.fill('#sv-ef-phone', '415 555 0134') },
      ],
      // The page, then in on the New Customer dialog.
      crop: [{ at: 0, x: 0, y: 0, w: 1200 }, { at: 1.1, x: 0, y: 0, w: 1200 }, { at: 1.7, x: 300, y: 330, w: 600 }],
      async assert(page) {
        if ((await page.getAttribute('#sv-ef-phone', 'type')) !== 'tel') throw new Error('the phone field is not a phone input')
        if ((await page.inputValue('#sv-ef-phone')).replace(/\D/g, '') !== '4155550134') throw new Error('the phone input did not take the number')
      },
    },
  },
  beats: [
    { kind: 'title', title: 'Add a field. ==Ship it.==', sub: "SvGrid Studio's designer, on SvelteKit 3.", mood: 'neutral',
      say: '[excited] Your customers need a phone number. [beat] Watch.' },
    { kind: 'browser', clip: 'add', mood: 'determined', cap: 'Customers: ==+ phone==',
      say: 'In the designer, add a field to customers. Call it phone... and give it a phone input.' },
    { kind: 'browser', clip: 'save', mood: 'neutral', cap: 'Save to the ==folder==',
      say: 'Save the app to your folder.' },
    { kind: 'browser', clip: 'app', mood: 'happy', cap: 'In the app, ==with a country code==',
      say: '[impressed] The running SvelteKit three app has it. New customer... and there is the phone field, with a country code.' },
    { kind: 'end', title: 'One field,\n==everywhere.==', mood: 'happy', cmd: 'npx @svgrid/studio designer',
      note: 'Studio ships with the SvGrid Enterprise Suite.',
      say: '[upbeat] SvGrid Studio. Follow for more.' },
  ],
}
