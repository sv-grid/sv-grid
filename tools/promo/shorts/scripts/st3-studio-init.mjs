/**
 * "A SvelteKit 3 CRUD app in one command (SvGrid Studio)."
 *
 * Everything on screen happened on 2026-10-11 in tutorials-out/app/st3-crm:
 *   - `npx @svgrid/studio@0.8.2 init --kit 3 --dataset customers-orders
 *     --title "Acme CRM" -y` printed the three lines below (the published CLI
 *     on the published @svgrid/enterprise 3.1.7, no license key set);
 *   - npm install, `npm run check` (the summary line is svelte-check's own,
 *     warnings included) and `npm run build`.
 * The browser beats record that app, untouched. The sidebar is collapsed with
 * the app's own button so the grid's Edit column fits the window.
 */
const collapse = (p) => p.getByRole('button', { name: 'Collapse sidebar' }).click()

export default {
  id: 'st3-studio-init',
  series: 'SvelteKit 3 · SvGrid Studio',
  posterBeat: 4,
  caption: 'A SvelteKit 3 CRUD app in one command: npx @svgrid/studio init --kit 3 writes 6 screens and 37 files (load functions, form actions, an /api route per table), and it type-checks and builds. Then add a customer: it is saved on the server. SvGrid Studio ships with the SvGrid Enterprise Suite.',
  hashtags: ['sveltekit', 'sveltekit3', 'svelte', 'webdev', 'crud', 'javascript', 'programming'],
  clips: {
    overview: {
      app: 'studio',
      path: '/customers-overview',
      viewport: 1200,
      colorScheme: 'light',
      prepare: collapse,
      async assert(page) {
        const text = await page.locator('body').innerText()
        if (!/TOTAL CUSTOMER\s+24/i.test(text)) throw new Error('the overview does not show the 24 seeded customers')
      },
    },
    create: {
      app: 'studio',
      path: '/customers',
      viewport: 1200,
      colorScheme: 'light',
      prepare: collapse,
      actions: [
        { at: 0.5, run: (p) => p.getByRole('button', { name: 'New Customer' }).click() },
        { at: 1.0, run: (p) => p.fill('.sk-form input[name="name"]', 'Kestrel Robotics') },
        { at: 1.5, run: (p) => p.fill('.sk-form input[name="email"]', 'ops@kestrel.test') },
        { at: 2.0, run: (p) => p.fill('.sk-form input[name="city"]', 'Oslo') },
        { at: 2.4, run: (p) => p.selectOption('.sk-form select[name="tier"]', 'enterprise') },
        { at: 3.0, run: (p) => p.locator('.sk-form button[type="submit"]').click() },
        { at: 4.0, run: (p) => p.fill('.sk-facets input[name="f_name"]', 'Kestrel') },
        { at: 4.6, run: (p) => p.locator('.sk-facets button[type="submit"]').click() },
      ],
      async assert(page) {
        if (!/f_name=Kestrel/.test(page.url())) throw new Error(`the filter did not reach the URL: ${page.url()}`)
        const row = await page.locator('[data-svgrid-row="0"]').allTextContents()
        if (!row.join(' ').includes('Kestrel Robotics')) throw new Error(`the new customer is not in the filtered grid: ${row.join(' | ')}`)
      },
    },
  },
  beats: [
    { kind: 'title', title: 'A SvelteKit 3 CRUD app in ==one command.==', sub: "Generated. Then it's your code.", mood: 'neutral',
      say: '[excited] A full CRUD app on SvelteKit three. [beat] One command.' },
    { kind: 'terminal', mood: 'neutral', cap: 'SvGrid Studio ==init==', minHeight: 640,
      lines: [
        { cmd: 'npx @svgrid/studio init --kit 3 --dataset customers-orders --title "Acme CRM" -y', at: 0 },
        { text: "SvGrid Studio - let's build your app.", cls: 'dim', at: 0.2 },
        { text: '  Using Customers & orders (2 tables).', at: 0.32 },
        { text: 'Built "Acme CRM": 2 tables, 6 screens, 37 files.', cls: 'ok', at: 0.55 },
      ],
      say: "Studio's init, with kit three. Two tables in... [beat] six screens and thirty-seven files out." },
    { kind: 'terminal', mood: 'happy', cap: 'Type-checks. ==Builds.==', minHeight: 640,
      lines: [
        { cmd: 'npm install', at: 0 },
        { text: 'added 83 packages in 13s', cls: 'dim', at: 0.12 },
        { cmd: 'npm run check', at: 0.3 },
        { text: 'svelte-check found 0 errors and 40 warnings in 4 files', cls: 'hl', at: 0.48 },
        { cmd: 'npm run build', at: 0.66 },
        { text: '✔ done', cls: 'ok', at: 0.82 },
      ],
      say: 'Install it. Zero type errors... and it builds.' },
    { kind: 'browser', clip: 'overview', mood: 'happy', cap: 'An ==overview==, out of the box',
      say: 'You get an overview page, with a chart and a grid.' },
    { kind: 'browser', clip: 'create', mood: 'happy', cap: 'Create it. ==Saved on the server.==',
      say: '[impressed] And real CRUD. Add a customer, save it... it lives on the server. Filter... and there it is.' },
    { kind: 'end', title: 'CRUD apps,\n==on SvelteKit 3.==', mood: 'happy', cmd: 'npx @svgrid/studio init --kit 3',
      note: 'Studio ships with the SvGrid Enterprise Suite.',
      say: '[upbeat] SvGrid Studio. Follow for more SvelteKit three.' },
  ],
}
