/**
 * "Is generated code real SvelteKit 3? (SvGrid Studio)"
 *
 * The code beats are excerpts of tutorials-out/app/st3-crm as
 * `npx @svgrid/studio@0.8.2 init --kit 3` wrote it on 2026-10-11 (long lines
 * wrapped; vite.config.ts's dev-server watch line left out). The browser beat is
 * recorded with scripting disabled and asserts the claim: the filter form goes
 * to the server and every row that comes back is an enterprise customer.
 */
export default {
  id: 'st3-studio-real-code',
  series: 'SvelteKit 3 · SvGrid Studio',
  posterBeat: 4,
  caption: 'Is generated code real SvelteKit 3? A SvGrid Studio app opened up: the adapter in vite.config.ts, #lib imports, a load function that reads sort, filters and paging from the URL, form actions validated on the server. Turn JavaScript off and the filter still works. SvGrid Studio ships with the SvGrid Enterprise Suite.',
  hashtags: ['sveltekit', 'sveltekit3', 'svelte', 'ssr', 'webdev', 'typescript', 'programming'],
  clips: {
    nojs: {
      app: 'studio',
      path: '/customers',
      js: false,
      viewport: 1320,
      colorScheme: 'light',
      actions: [
        { at: 1.2, run: (p) => p.selectOption('select[name="f_tier"]', 'enterprise') },
        { at: 2.2, run: (p) => Promise.all([p.waitForURL(/f_tier=enterprise/), p.locator('.sk-facets button[type="submit"]').click()]) },
      ],
      async assert(page) {
        if (!/f_tier=enterprise/.test(page.url())) throw new Error(`JavaScript off: the filter did not reach the URL: ${page.url()}`)
        const tiers = await page.evaluate(() => {
          const byRow = new Map()
          for (const c of document.querySelectorAll('[data-svgrid-row]')) {
            const r = c.getAttribute('data-svgrid-row')
            byRow.set(r, [...(byRow.get(r) ?? []), c.textContent.trim()])
          }
          return [...byRow.values()].map((cells) => cells[4])
        })
        if (tiers.length < 5 || tiers.some((t) => t !== 'enterprise')) throw new Error(`JavaScript off: rows are not all enterprise (${tiers.join(', ')})`)
      },
    },
  },
  beats: [
    { kind: 'title', title: 'Is generated code ==real SvelteKit?==', sub: 'Opening a Studio app.', mood: 'worried',
      say: "[skeptical] Generated code is usually a black box. [beat] Let's open this one." },
    { kind: 'code', file: 'vite.config.ts', mood: 'neutral', cap: 'SvelteKit 3 ==config==', size: 22,
      code: "import adapter from '@sveltejs/adapter-auto'\nimport { vitePreprocess } from '@sveltejs/vite-plugin-svelte'\nimport { sveltekit } from '@sveltejs/kit/vite'\nimport { defineConfig } from 'vite'\n\nexport default defineConfig({\n  plugins: [sveltekit({\n    preprocess: vitePreprocess(),\n    adapter: adapter(),\n  })],\n})",
      focus: [7, 8, 9],
      say: "SvelteKit three config. The adapter lives in the Vite config... there's no svelte config file." },
    { kind: 'code', file: 'customers/+page.server.ts', mood: 'neutral', cap: 'A plain ==load==', size: 24,
      code: "import { planFromSearchParams } from '#lib/server/query.js'\n\nexport const load: PageServerLoad =\n  async ({ url, fetch }) => {\n    const plan = planFromSearchParams(url, 10)\n    const { rows, rowCount } =\n      await source(fetch).getRows(plan)\n    return {\n      rows, total: rowCount, page: plan.pageIndex,\n      size: plan.pageSize, sort: plan.sortModel,\n    }\n  }",
      focus: [5], focusAt: 0.35,
      say: 'The list page is a plain load function. It reads sort, filters and paging from the URL... on the server.' },
    { kind: 'code', file: 'customers/+page.server.ts', mood: 'determined', cap: 'Form ==actions==, checked on the server', size: 24,
      code: "create: async ({ request, fetch }) => {\n  const values =\n    formToValues(await request.formData())\n  const errors =\n    await validateAll(customersSchema, values)\n  if (Object.keys(errors).length)\n    return fail(422, { errors, values })\n  await source(fetch).createRow(values)\n  return { ok: true }\n},",
      focus: [5, 7], focusAt: 0.3,
      say: 'Create, update and delete are form actions. Validated on the server... and a bad one gets four twenty two.' },
    { kind: 'browser', clip: 'nojs', badge: 'JavaScript: off', mood: 'happy', cap: 'JavaScript !!off!!. Still filters.',
      say: '[whispers] Now turn JavaScript off. [beat] Pick a tier, hit filter... [excited] the server still does it.' },
    { kind: 'end', title: 'Real SvelteKit 3,\n==generated.==', mood: 'happy', cmd: 'npx @svgrid/studio init --kit 3',
      note: 'Studio ships with the SvGrid Enterprise Suite.',
      say: '[upbeat] SvGrid Studio. Follow for more SvelteKit three.' },
  ],
}
