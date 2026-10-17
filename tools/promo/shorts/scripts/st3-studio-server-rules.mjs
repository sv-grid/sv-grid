/**
 * "Your form validates. Does your server? (SvGrid Studio, SvelteKit 3)"
 *
 * Code from tutorials-out/app/st3-crm as `npx @svgrid/studio@0.8.2 init --kit 3`
 * wrote it on 2026-10-11 (schemas.ts excerpted to the two fields). Both curl
 * responses are that app's, captured the same day (Date/Vary/keep-alive headers
 * trimmed). The browser beat makes the same valid POST before the page loads and
 * asserts the row is in the grid.
 */
const collapse = (p) => p.getByRole('button', { name: 'Collapse sidebar' }).click()

export default {
  id: 'st3-studio-server-rules',
  series: 'SvelteKit 3 · SvGrid Studio',
  posterBeat: 3,
  caption: 'Your form validates. Does your server? In a SvGrid Studio app on SvelteKit 3, one schema drives the form and the API route: createKitHandlers({ validate: true }). Skip the form, POST junk with curl, and the server answers 422 with both field errors. A valid POST is saved and shows up in the grid. SvGrid Studio ships with the SvGrid Enterprise Suite.',
  hashtags: ['sveltekit', 'sveltekit3', 'svelte', 'webdev', 'api', 'validation', 'programming'],
  clips: {
    created: {
      app: 'studio',
      path: '/customers?f_name=Kestrel',
      viewport: 1200,
      colorScheme: 'light',
      async setup(base) {
        const res = await fetch(`${base}/api/customers`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'mutate', op: 'create', input: { name: 'Kestrel Robotics', email: 'ops@kestrel.test', city: 'Oslo', tier: 'enterprise' } }),
        })
        if (res.status !== 200) throw new Error(`the valid POST answered ${res.status}`)
      },
      prepare: collapse,
      async assert(page) {
        const row = await page.locator('[data-svgrid-row="0"]').allTextContents()
        if (!row.join(' ').includes('Kestrel Robotics')) throw new Error(`the posted customer is not in the grid: ${row.join(' | ')}`)
      },
    },
  },
  beats: [
    { kind: 'title', title: 'Your form validates. ==Does your server?==', sub: 'SvGrid Studio on SvelteKit 3.', mood: 'worried',
      say: '[serious] Your form checks the input. [beat] But does your server?' },
    { kind: 'code', file: 'src/lib/schemas.ts', mood: 'neutral', cap: 'One ==schema==', size: 26,
      code: '{\n  "field": "name",\n  "type": "text",\n  "label": "Customer",\n  "required": true,\n  "minLength": 2\n},\n{\n  "field": "email",\n  "type": "text",\n  "label": "Email",\n  "format": "email"\n},',
      focus: [5, 6, 12], focusAt: 0.3,
      say: 'Studio writes one schema. A customer needs a name, at least two characters... and a real email.' },
    { kind: 'code', file: 'api/customers/+server.ts', mood: 'determined', cap: 'The API route ==enforces== it', size: 22,
      code: "import { createKitHandlers } from '@svgrid/enterprise'\nimport { customersSchema } from '#lib/schemas.js'\nimport { customersStore as source } from '#lib/server/store.js'\n\nexport const { POST } = createKitHandlers({\n  schema: customersSchema,\n  source,\n  validate: true,\n})",
      focus: [8], focusAt: 0.4,
      say: 'And the API route checks the same schema. Validate: true.' },
    { kind: 'terminal', mood: 'worried', cap: 'Skip the form: !!422!!', minHeight: 640,
      lines: [
        { cmd: `curl -i -X POST localhost:4323/api/customers -H 'content-type: application/json' -d '{"kind":"mutate","op":"create","input":{"name":"X","email":"not-an-email"}}'`, at: 0 },
        { text: 'HTTP/1.1 422 Unprocessable Entity', cls: 'err', at: 0.45 },
        { text: '{"error":"validation failed","fieldErrors":{"name":"Customer must be at least 2 characters","email":"Email must be a valid email"}}', cls: 'err', at: 0.55 },
      ],
      say: '[tense] So skip the form. Post junk straight to the API... [beat] four twenty two. Both fields rejected.' },
    { kind: 'terminal', mood: 'happy', cap: 'A valid one: ++200++', minHeight: 640,
      lines: [
        { cmd: `curl -i -X POST localhost:4323/api/customers -H 'content-type: application/json' -d '{"kind":"mutate","op":"create","input":{"name":"Kestrel Robotics","email":"ops@kestrel.test","city":"Oslo","tier":"enterprise"}}'`, at: 0 },
        { text: 'HTTP/1.1 200 OK', cls: 'ok', at: 0.45 },
        { text: '{"name":"Kestrel Robotics","email":"ops@kestrel.test","city":"Oslo","tier":"enterprise","id":"c25"}', at: 0.55 },
      ],
      say: "A valid one goes through. Two hundred, it's saved." },
    { kind: 'browser', clip: 'created', mood: 'happy', cap: "And it's ==in the grid==", hold: 1.2,
      say: 'And there it is, in the grid.' },
    { kind: 'end', title: 'Rules your server\n==enforces.==', mood: 'happy', cmd: 'npx @svgrid/studio init --kit 3',
      note: 'Studio ships with the SvGrid Enterprise Suite.',
      say: '[upbeat] SvGrid Studio. Follow for more SvelteKit three.' },
  ],
}
