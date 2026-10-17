/**
 * "SvelteKit 3 broke my app: the 4 changes."
 *
 * Each change is shown as it appears in tutorials-out/app/kit3-orders, a
 * SvelteKit 3.0.1 + Vite 8 app built for this series, and the last beat is
 * that app running. Claims checked against SvelteKit 3's migration guide and
 * types (see packages/enterprise/src/studio/sveltekit3.ts for the sources).
 */
const sortClip = {
  app: 'kit3',
  path: '/orders',
  actions: [
    { at: 0.9, run: (p) => p.locator('[role="columnheader"]', { hasText: 'Total' }).first().click() },
    { at: 2.6, run: (p) => p.locator('[role="columnheader"]', { hasText: 'Total' }).first().click() },
  ],
  async assert(page) {
    if (!/sort=total&dir=desc/.test(page.url())) throw new Error(`sort did not reach the URL: ${page.url()}`)
  },
}

export default {
  id: 'sk3-four-changes',
  series: 'SvelteKit 3 · SvGrid',
  posterBeat: 0,
  caption: 'SvelteKit 3 is out and my app stopped building. The 4 changes: svelte.config.js moves into vite.config.ts, $lib becomes #lib with .js extensions, env vars are declared in src/env.ts, and goto() takes reset instead of keepFocus/noScroll. Then the SvGrid data grid runs on SvelteKit 3.',
  hashtags: ['sveltekit', 'sveltekit3', 'svelte', 'webdev', 'javascript', 'typescript', 'programming'],
  clips: { sort: sortClip },
  beats: [
    { kind: 'title', title: 'SvelteKit 3 ==broke== my app.', sub: 'The 4 changes that did it.', mood: 'worried',
      say: '[frustrated] SvelteKit three broke my app. [beat] Four changes did it.' },
    { kind: 'code', file: 'vite.config.ts', mood: 'neutral', cap: '1. `svelte.config.js` is ==gone==',
      code: "import adapter from '@sveltejs/adapter-node'\nimport { sveltekit } from '@sveltejs/kit/vite'\n\nexport default defineConfig({\n  plugins: [sveltekit({\n    preprocess: vitePreprocess(),\n    adapter: adapter(),\n  })],\n})",
      focus: [5, 6, 7],
      say: 'One. Svelte config is gone. The adapter moves into your Vite config.' },
    { kind: 'code', file: '+page.server.ts', mood: 'neutral', cap: '2. `$lib` is now ==`#lib`==', diff: true,
      code: "- import { listOrders } from '$lib/orders'\n+ import { listOrders } from '#lib/orders.js'",
      say: 'Two. Dollar lib is now hash lib. [emphasized] And it needs the dot J S.' },
    { kind: 'code', file: 'src/env.ts', mood: 'neutral', cap: '3. Env vars are ==declared==',
      code: "export const variables = defineEnvVars({\n  ORDERS_REGION: {\n    schema: (input) => input ?? 'eu-west',\n  },\n})\n\n// +page.server.ts\nimport { ORDERS_REGION } from '$app/env/private'",
      say: 'Three. Env vars are declared now, in source slash env dot T S.' },
    { kind: 'code', file: 'orders/+page.svelte', mood: 'determined', cap: '4. `goto` gets ==`reset`==', diff: true,
      code: '- goto(next, { keepFocus: true, noScroll: true })\n+ goto(next, { reset: false })',
      say: "Four. goto lost keep focus and no scroll. [beat] Now it's reset: false." },
    { kind: 'browser', clip: 'sort', mood: 'happy', cap: 'SvGrid on ++SvelteKit 3++',
      say: '[relieved] Fixed. My grid runs on SvelteKit three, sorted on the server.' },
    { kind: 'end', title: 'The Svelte data grid,\n==on SvelteKit 3.==', mood: 'happy',
      say: '[upbeat] SvGrid. Follow for part two.' },
  ],
}
