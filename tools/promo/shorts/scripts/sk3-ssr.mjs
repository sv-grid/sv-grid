/**
 * "Is your data grid really server-rendered? (SvelteKit 3)"
 *
 * Code from tutorials-out/app/kit3-orders (long lines wrapped, types left out
 * of the excerpt). The JavaScript-off beats are recorded with scripting
 * disabled and assert the claim: rows in the page, sorted by total, highest
 * first, exactly as the URL asks.
 */
function totals(page) {
  return page.evaluate(() => {
    const byRow = new Map()
    for (const c of document.querySelectorAll('[data-svgrid-row]')) {
      const r = c.getAttribute('data-svgrid-row')
      byRow.set(r, [...(byRow.get(r) ?? []), c.textContent.trim()])
    }
    return [...byRow.values()].map((cells) => Number(cells[cells.length - 1].replace(/[^0-9.]/g, '')))
  })
}

export default {
  id: 'sk3-ssr',
  series: 'SvelteKit 3 · SvGrid',
  posterBeat: 4,
  caption: 'Is your SvelteKit 3 data grid really server-rendered? Load the rows in +page.server.ts, let the grid show the sort (externalSort), then turn JavaScript off and reload. The rows are still there, sorted by the server. Real SvelteKit 3.0.1 app with SvGrid.',
  hashtags: ['sveltekit', 'sveltekit3', 'ssr', 'svelte', 'webdev', 'javascript', 'programming'],
  clips: {
    on: { app: 'kit3', path: '/orders' },
    off: {
      app: 'kit3',
      path: '/orders?sort=total&dir=desc',
      js: false,
      async assert(page) {
        const t = await totals(page)
        if (t.length < 10) throw new Error(`JavaScript off: ${t.length} rows in the page`)
        if (t.some((v, i) => i && v > t[i - 1])) throw new Error(`JavaScript off: not sorted by total desc (${t.slice(0, 5).join(', ')})`)
      },
    },
  },
  beats: [
    { kind: 'title', title: 'Is your table ==really== server-rendered?', sub: 'SvelteKit 3 edition.', mood: 'worried',
      say: "[skeptical] Is your data grid really server rendered? [beat] Let's check." },
    { kind: 'code', file: 'orders/+page.server.ts', mood: 'neutral', cap: 'The ==load== runs on the server',
      code: "export const load = ({ url }) => {\n  const sortBy = url.searchParams.get('sort')\n    ?? 'id'\n  const desc =\n    url.searchParams.get('dir') === 'desc'\n  return {\n    rows: listOrders(sortBy, desc),\n    sortBy, desc, region: ORDERS_REGION,\n  }\n}",
      focus: [7],
      say: 'The load runs on the server. It reads the sort from the URL, and returns the rows already sorted.' },
    { kind: 'code', file: 'orders/+page.svelte', mood: 'neutral', cap: 'The grid ==shows== the sort', size: 26,
      code: "<SvGrid\n  data={data.rows}\n  {columns}\n  sortable\n  externalSort\n  initialSorting={[{ id: data.sortBy, desc: data.desc }]}\n  {onSortingChange}\n/>",
      focus: [5],
      say: 'The grid gets those rows as data. External sort means it shows the sort... and lets the server do it.' },
    { kind: 'browser', clip: 'on', mood: 'neutral', cap: 'JavaScript ==on==',
      say: "With JavaScript on, it's a normal grid." },
    { kind: 'browser', clip: 'off', badge: 'JavaScript: off', mood: 'worried', cap: 'JavaScript !!off!!',
      say: '[whispers] Now turn JavaScript off... and reload. [beat] [excited] The rows are still there.' },
    { kind: 'browser', clip: 'off', badge: 'JavaScript: off', mood: 'happy', cap: "That's the ==server's HTML==",
      say: 'Sorted by total, straight from the server. No script ran.' },
    { kind: 'end', title: 'Server-rendered grids,\n==on SvelteKit 3.==', mood: 'happy',
      say: '[upbeat] SvGrid. Follow for more SvelteKit three.' },
  ],
}
